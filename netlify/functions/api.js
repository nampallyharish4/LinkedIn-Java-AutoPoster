const serverless = require('serverless-http');
const express = require('express');
const path = require('path');
const config = require('../../config/config');
const { generatePreview, JAVA_TOPICS } = require('../../services/ai-generator');
const { createPost, getAuthUrl, exchangeCodeForToken, getPersonUrn } = require('../../services/linkedin-api');
const { getPostHistory, getStats, savePost, deletePost } = require('../../services/post-store');

const app = express();
app.use(express.json());

// ═══════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════

// Get dashboard stats
app.get('/api/stats', (req, res) => {
  try {
    const stats = getStats();
    res.json({ ...stats, scheduler: { isActive: false, isRunning: false, scheduledTime: config.schedule.postTime, timezone: config.schedule.timezone } });
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

// Trigger immediate post
app.post('/api/post-now', async (req, res) => {
  try {
    const generated = await generatePreview();
    const result = await createPost(generated.content);

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
    res.json({ success: true, post: postRecord });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Scheduler (limited in serverless — returns status only)
app.post('/api/scheduler/start', (req, res) => {
  res.json({ isActive: false, isRunning: false, scheduledTime: config.schedule.postTime, timezone: config.schedule.timezone, message: 'Use Netlify Scheduled Functions for automated posting.' });
});

app.post('/api/scheduler/stop', (req, res) => {
  res.json({ isActive: false, isRunning: false, scheduledTime: config.schedule.postTime, timezone: config.schedule.timezone });
});

app.get('/api/scheduler', (req, res) => {
  res.json({ isActive: false, isRunning: false, scheduledTime: config.schedule.postTime, timezone: config.schedule.timezone });
});

app.put('/api/scheduler/time', (req, res) => {
  res.json({ isActive: false, scheduledTime: req.body.time || config.schedule.postTime, timezone: config.schedule.timezone });
});

// Topics
app.get('/api/topics', (req, res) => {
  res.json(JAVA_TOPICS);
});

// Delete a post from history
app.delete('/api/posts/:id', (req, res) => {
  try {
    const deleted = deletePost(req.params.id);
    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'Post not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════
// OAuth Routes
// ═══════════════════════════════════════════════

app.get('/auth/linkedin', (req, res) => {
  const redirectUri = `${req.protocol}://${req.get('host')}/auth/linkedin/callback`;
  const authUrl = getAuthUrl(redirectUri);
  res.redirect(authUrl);
});

app.get('/auth/linkedin/callback', async (req, res) => {
  try {
    const { code, error } = req.query;
    if (error) {
      return res.redirect(`/?auth_error=${encodeURIComponent(error)}`);
    }
    if (!code) {
      return res.redirect('/?auth_error=No authorization code received');
    }

    const redirectUri = `${req.protocol}://${req.get('host')}/auth/linkedin/callback`;
    const tokenData = await exchangeCodeForToken(code, redirectUri);

    // In serverless, we cannot write to .env — tokens must be set as Netlify env vars
    // For now, set them in runtime memory for this invocation
    process.env.LINKEDIN_ACCESS_TOKEN = tokenData.access_token;
    config.linkedin.accessToken = tokenData.access_token;

    try {
      const personUrn = await getPersonUrn();
      process.env.LINKEDIN_PERSON_URN = personUrn;
      config.linkedin.personUrn = personUrn;
    } catch (e) {
      console.log('Could not auto-fetch Person URN:', e.message);
    }

    res.redirect('/?auth_success=true');
  } catch (error) {
    res.redirect(`/?auth_error=${encodeURIComponent(error.message)}`);
  }
});

// Auth status
app.get('/api/auth/status', (req, res) => {
  res.json({
    hasAccessToken: !!config.linkedin.accessToken,
    hasPersonUrn: !!config.linkedin.personUrn,
    hasGroqKey: !!config.groq.apiKey,
    clientId: config.linkedin.clientId ? '***' + config.linkedin.clientId.slice(-4) : null
  });
});

module.exports.handler = serverless(app);
