const express = require('express');
const path = require('path');
const fs = require('fs');
const config = require('./config/config');
const { generatePreview, JAVA_TOPICS } = require('./services/ai-generator');
const { createPost, getAuthUrl, exchangeCodeForToken, getPersonUrn } = require('./services/linkedin-api');
const { executePost, startScheduler, stopScheduler, getSchedulerStatus } = require('./services/scheduler');
const { getPostHistory, getStats, savePost, deletePost } = require('./services/post-store');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ═══════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════

// Get dashboard stats
app.get('/api/stats', (req, res) => {
  try {
    const stats = getStats();
    const scheduler = getSchedulerStatus();
    res.json({ ...stats, scheduler });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get post history
app.get('/api/posts', (req, res) => {
  try {
    const posts = getPostHistory();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const start = (page - 1) * limit;
    const paginated = posts.slice(start, start + limit);
    
    res.json({
      posts: paginated,
      total: posts.length,
      page,
      totalPages: Math.ceil(posts.length / limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate a preview post (AI only, no LinkedIn posting)
app.post('/api/preview', async (req, res) => {
  try {
    const { topic } = req.body;
    const preview = await generatePreview(topic || null);
    res.json(preview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Publish a post to LinkedIn
app.post('/api/publish', async (req, res) => {
  try {
    const { content, topic, style } = req.body;
    
    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const result = await createPost(content);
    
    const postRecord = {
      id: Date.now().toString(),
      content,
      topic: topic || 'Custom',
      style: style || 'custom',
      linkedinPostId: result.postId,
      status: 'published',
      postedAt: new Date().toISOString()
    };

    savePost(postRecord);
    res.json({ success: true, post: postRecord });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trigger immediate post (AI generate + LinkedIn publish)
app.post('/api/post-now', async (req, res) => {
  try {
    const result = await executePost();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start scheduler
app.post('/api/scheduler/start', (req, res) => {
  try {
    startScheduler();
    res.json(getSchedulerStatus());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stop scheduler
app.post('/api/scheduler/stop', (req, res) => {
  try {
    stopScheduler();
    res.json(getSchedulerStatus());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get scheduler status
app.get('/api/scheduler', (req, res) => {
  res.json(getSchedulerStatus());
});

// Update schedule time
app.put('/api/scheduler/time', (req, res) => {
  try {
    const { time } = req.body;
    if (!time || !/^\d{2}:\d{2}$/.test(time)) {
      return res.status(400).json({ error: 'Invalid time format. Use HH:MM' });
    }

    // Update the .env file
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf-8');
    envContent = envContent.replace(/POST_TIME=.*/, `POST_TIME=${time}`);
    fs.writeFileSync(envPath, envContent);

    // Update runtime config
    process.env.POST_TIME = time;
    config.schedule.postTime = time;

    // Restart scheduler if active
    const status = getSchedulerStatus();
    if (status.isActive) {
      stopScheduler();
      startScheduler();
    }

    res.json({ success: true, time });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get available Java topics
app.get('/api/topics', (req, res) => {
  res.json(JAVA_TOPICS);
});

// Delete a post from history
app.delete('/api/posts/:id', (req, res) => {
  try {
    const deleted = deletePost(req.params.id);
    res.json({ deleted });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════
// LinkedIn OAuth Routes
// ═══════════════════════════════════════════════

app.get('/auth/linkedin', (req, res) => {
  const redirectUri = `http://localhost:${config.server.port}/auth/linkedin/callback`;
  const authUrl = getAuthUrl(redirectUri);
  res.redirect(authUrl);
});

app.get('/auth/linkedin/callback', async (req, res) => {
  try {
    const { code, error } = req.query;
    
    if (error) {
      return res.redirect(`/?auth_error=${encodeURIComponent(error)}`);
    }

    const redirectUri = `http://localhost:${config.server.port}/auth/linkedin/callback`;
    const tokenData = await exchangeCodeForToken(code, redirectUri);

    // Update .env with new token
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf-8');
    envContent = envContent.replace(/LINKEDIN_ACCESS_TOKEN=.*/, `LINKEDIN_ACCESS_TOKEN=${tokenData.access_token}`);
    fs.writeFileSync(envPath, envContent);

    // Update runtime
    process.env.LINKEDIN_ACCESS_TOKEN = tokenData.access_token;
    config.linkedin.accessToken = tokenData.access_token;

    // Try to get person URN
    try {
      const personUrn = await getPersonUrn();
      envContent = fs.readFileSync(envPath, 'utf-8');
      envContent = envContent.replace(/LINKEDIN_PERSON_URN=.*/, `LINKEDIN_PERSON_URN=${personUrn}`);
      fs.writeFileSync(envPath, envContent);
      process.env.LINKEDIN_PERSON_URN = personUrn;
      config.linkedin.personUrn = personUrn;
    } catch (e) {
      console.log('⚠️ Could not auto-fetch Person URN:', e.message);
    }

    res.redirect('/?auth_success=true');
  } catch (error) {
    res.redirect(`/?auth_error=${encodeURIComponent(error.message)}`);
  }
});

// Check authentication status
app.get('/api/auth/status', (req, res) => {
  res.json({
    hasAccessToken: !!config.linkedin.accessToken,
    hasPersonUrn: !!config.linkedin.personUrn,
    hasGroqKey: !!config.groq.apiKey,
    clientId: config.linkedin.clientId ? '***' + config.linkedin.clientId.slice(-4) : null
  });
});

// ═══════════════════════════════════════════════
// Serve Dashboard
// ═══════════════════════════════════════════════

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ═══════════════════════════════════════════════
// Start Server
// ═══════════════════════════════════════════════

app.listen(config.server.port, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║   ☕ LinkedIn Java AutoPoster                     ║
║   📍 Dashboard: http://localhost:${config.server.port}             ║
║   📅 Schedule: ${config.schedule.postTime} (${config.schedule.timezone})            ║
╚══════════════════════════════════════════════════╝
  `);

  // Auto-start scheduler
  startScheduler();
});
