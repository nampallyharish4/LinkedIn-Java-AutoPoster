const cron = require('node-cron');
const { generatePost } = require('./ai-generator');
const { createPost } = require('./linkedin-api');
const { savePost, getPostHistory } = require('./post-store');
const config = require('../config/config');

let scheduledJob = null;
let isRunning = false;

/**
 * Execute the daily posting workflow
 */
async function executePost() {
  if (isRunning) {
    console.log('⏳ A posting job is already running, skipping...');
    return { success: false, message: 'Job already running' };
  }

  isRunning = true;
  console.log(`\n🚀 [${new Date().toISOString()}] Starting daily post generation...`);

  try {
    // Step 1: Generate AI content
    console.log('🤖 Generating AI content...');
    const generated = await generatePost();
    console.log(`✅ Content generated! Topic: ${generated.topic}`);

    // Step 2: Post to LinkedIn
    console.log('📤 Publishing to LinkedIn...');
    const result = await createPost(generated.content);
    console.log(`✅ Posted successfully! Post ID: ${result.postId}`);

    // Step 3: Save to history
    const postRecord = {
      id: Date.now().toString(),
      content: generated.content,
      topic: generated.topic,
      style: generated.style,
      linkedinPostId: result.postId,
      status: 'published',
      postedAt: new Date().toISOString()
    };

    savePost(postRecord);
    console.log('💾 Post saved to history.\n');

    isRunning = false;
    return { success: true, post: postRecord };
  } catch (error) {
    console.error(`❌ Posting failed: ${error.message}\n`);

    // Save failed attempt
    const failedRecord = {
      id: Date.now().toString(),
      content: error.generatedContent || 'Generation failed',
      topic: 'Unknown',
      style: 'Unknown',
      status: 'failed',
      error: error.message,
      postedAt: new Date().toISOString()
    };

    savePost(failedRecord);
    isRunning = false;
    return { success: false, error: error.message };
  }
}

/**
 * Start the scheduled cron job
 */
function startScheduler() {
  const [hour, minute] = config.schedule.postTime.split(':');
  const cronExpression = `${minute} ${hour} * * *`;

  if (scheduledJob) {
    scheduledJob.stop();
  }

  scheduledJob = cron.schedule(cronExpression, async () => {
    console.log(`⏰ Scheduled trigger at ${config.schedule.postTime}`);
    await executePost();
  }, {
    scheduled: true,
    timezone: config.schedule.timezone
  });

  console.log(`📅 Scheduler started: Daily at ${config.schedule.postTime} (${config.schedule.timezone})`);
  return true;
}

/**
 * Stop the scheduled cron job
 */
function stopScheduler() {
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
    console.log('🛑 Scheduler stopped.');
    return true;
  }
  return false;
}

/**
 * Get scheduler status
 */
function getSchedulerStatus() {
  return {
    isActive: scheduledJob !== null,
    isRunning,
    scheduledTime: config.schedule.postTime,
    timezone: config.schedule.timezone
  };
}

module.exports = {
  executePost,
  startScheduler,
  stopScheduler,
  getSchedulerStatus
};
