const fs = require('fs');
const path = require('path');

// In serverless environments (Netlify), the project dir is read-only.
// Use /tmp as a fallback for writable storage.
const isServerless = !!process.env.NETLIFY || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
const DATA_DIR = isServerless ? '/tmp/data' : path.join(__dirname, '..', 'data');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');

/**
 * Ensure data directory and file exist
 */
function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(POSTS_FILE)) {
    fs.writeFileSync(POSTS_FILE, JSON.stringify([], null, 2));
  }
}

/**
 * Get all post history
 */
function getPostHistory() {
  ensureDataFile();
  try {
    const data = fs.readFileSync(POSTS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

const crypto = require('crypto');

/**
 * Save a new post record
 */
function savePost(post) {
  ensureDataFile();
  const posts = getPostHistory();
  
  // Deduplication check: Do not save if exact content was already published
  // This prevents UI double-clicks from cluttering the history payload
  const isDuplicate = posts.some(p => p.content === post.content && p.status === 'published');
  if (isDuplicate) {
    console.log('Got duplicate save request; ignoring history update.');
    return post;
  }

  posts.unshift(post); // Add to beginning (newest first)
  
  // Keep only last 365 posts
  if (posts.length > 365) {
    posts.length = 365;
  }
  
  fs.writeFileSync(POSTS_FILE, JSON.stringify(posts, null, 2));
  return post;
}

/**
 * Get post statistics
 */
function getStats() {
  const posts = getPostHistory();
  const published = posts.filter(p => p.status === 'published');
  const failed = posts.filter(p => p.status === 'failed');
  
  const today = new Date().toISOString().split('T')[0];
  const todayPosts = posts.filter(p => p.postedAt?.startsWith(today));

  // Get this week's posts
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekPosts = posts.filter(p => new Date(p.postedAt) >= weekAgo);

  // Get this month's posts
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthPosts = posts.filter(p => new Date(p.postedAt) >= monthStart);

  // Topic distribution
  const topicCounts = {};
  published.forEach(p => {
    if (p.topic) {
      topicCounts[p.topic] = (topicCounts[p.topic] || 0) + 1;
    }
  });

  return {
    totalPosts: posts.length,
    published: published.length,
    failed: failed.length,
    todayPosts: todayPosts.length,
    weekPosts: weekPosts.length,
    monthPosts: monthPosts.length,
    successRate: posts.length > 0 ? Math.round((published.length / posts.length) * 100) : 0,
    topicDistribution: topicCounts,
    lastPost: posts[0] || null
  };
}

/**
 * Delete a post from history
 */
function deletePost(id) {
  const posts = getPostHistory();
  const filtered = posts.filter(p => p.id !== id);
  fs.writeFileSync(POSTS_FILE, JSON.stringify(filtered, null, 2));
  return filtered.length < posts.length;
}

module.exports = {
  getPostHistory,
  savePost,
  getStats,
  deletePost
};
