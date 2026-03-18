// ═══════════════════════════════════════════════
// LinkedIn Java AutoPoster — Frontend Application
// ═══════════════════════════════════════════════

let currentPage = 1;
let currentPreview = null;

// ═══════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  checkAuthStatus();
  loadStats();
  loadTopics();
  loadHistory();
  checkUrlParams();

  // Update preview character count on edit
  const preview = document.getElementById('postPreview');
  preview.addEventListener('input', updateCharCount);
});

// ═══════════════════════════════════════════════
// AUTH STATUS
// ═══════════════════════════════════════════════

async function checkAuthStatus() {
  try {
    const res = await fetch('/api/auth/status');
    const data = await res.json();

    updateCheckmark('checkGroq', data.hasGroqKey);
    updateCheckmark('checkToken', data.hasAccessToken);
    updateCheckmark('checkUrn', data.hasPersonUrn);

    // Hide setup card if everything is configured
    const allDone = data.hasGroqKey && data.hasAccessToken && data.hasPersonUrn;
    document.getElementById('setupCard').style.display = allDone ? 'none' : 'block';
  } catch (error) {
    console.error('Auth check failed:', error);
  }
}

function updateCheckmark(id, isDone) {
  const el = document.getElementById(id);
  el.className = `setup-check ${isDone ? 'done' : 'pending'}`;
  el.textContent = isDone ? '✓' : '○';
}

function checkUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('auth_success')) {
    showToast('LinkedIn connected successfully!', 'success');
    window.history.replaceState({}, '', '/');
    checkAuthStatus();
  }
  if (params.get('auth_error')) {
    showToast(`Auth error: ${params.get('auth_error')}`, 'error');
    window.history.replaceState({}, '', '/');
  }
}

// ═══════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════

async function loadStats() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();

    document.getElementById('statTotal').textContent = data.published || 0;
    document.getElementById('statWeek').textContent = data.weekPosts || 0;
    document.getElementById('statMonth').textContent = data.monthPosts || 0;
    document.getElementById('statRate').textContent = data.totalPosts > 0 ? `${data.successRate}%` : '—';

    // Update scheduler badge
    updateSchedulerUI(data.scheduler);
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

// ═══════════════════════════════════════════════
// TOPICS
// ═══════════════════════════════════════════════

async function loadTopics() {
  try {
    const res = await fetch('/api/topics');
    const topics = await res.json();
    const select = document.getElementById('topicSelect');

    topics.forEach(topic => {
      const option = document.createElement('option');
      option.value = topic;
      option.textContent = topic;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Failed to load topics:', error);
  }
}

// ═══════════════════════════════════════════════
// POST GENERATION
// ═══════════════════════════════════════════════

async function generatePreview() {
  const btnGenerate = document.getElementById('btnGenerate');
  const btnRegenerate = document.getElementById('btnRegenerate');
  const preview = document.getElementById('postPreview');
  const topicSelect = document.getElementById('topicSelect');
  const topic = topicSelect.value || null;

  // Set loading state
  btnGenerate.disabled = true;
  btnRegenerate.disabled = true;
  btnGenerate.innerHTML = '<span class="loading-spinner"></span> Processing...';
  preview.className = 'post-preview empty';
  preview.textContent = 'Processing content draft...';
  preview.contentEditable = false;

  try {
    const res = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }

    const data = await res.json();
    currentPreview = data;

    preview.className = 'post-preview';
    preview.textContent = data.content;
    preview.contentEditable = true;

    document.getElementById('btnPublish').disabled = false;
    btnRegenerate.disabled = false;
    updateCharCount();

    showToast(`Draft generated. Topic: ${data.topic}`, 'success');
  } catch (error) {
    preview.className = 'post-preview empty';
    preview.textContent = `Error: ${error.message}`;
    showToast(`Compose failed: ${error.message}`, 'error');
  } finally {
    btnGenerate.disabled = false;
    btnGenerate.innerHTML = 'Generate Draft';
  }
}

function updateCharCount() {
  const preview = document.getElementById('postPreview');
  const counter = document.getElementById('charCount');
  const text = preview.innerText || '';
  const len = text.length;

  counter.textContent = `${len} characters`;
  counter.className = 'char-count';

  if (len > 3000) {
    counter.className = 'char-count danger';
    counter.textContent += ' (too long!)';
  } else if (len > 1500) {
    counter.className = 'char-count warning';
  }
}

// ═══════════════════════════════════════════════
// PUBLISHING
// ═══════════════════════════════════════════════

async function publishPost() {
  const preview = document.getElementById('postPreview');
  const content = preview.innerText.trim();
  const btnPublish = document.getElementById('btnPublish');

  if (!content || content.startsWith('Click') || content.startsWith('Processing') || content.startsWith('Error')) {
    showToast('Please generate a draft first.', 'error');
    return;
  }

  btnPublish.disabled = true;
  btnPublish.innerHTML = '<span class="loading-spinner"></span> Publishing...';

  try {
    const res = await fetch('/api/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        topic: currentPreview?.topic || 'Custom',
        style: currentPreview?.style || 'custom'
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }

    const data = await res.json();
    showToast('Content published to LinkedIn.', 'success');

    // Reset composer
    preview.className = 'post-preview empty';
    preview.textContent = 'Click "Generate Draft" to initiate content composition...';
    preview.contentEditable = false;
    currentPreview = null;

    // Refresh data
    loadStats();
    loadHistory();
  } catch (error) {
    showToast(`Publish failed: ${error.message}`, 'error');
  } finally {
    btnPublish.disabled = false;
    btnPublish.innerHTML = 'Post to LinkedIn';
  }
}

async function postNow() {
  const btn = document.getElementById('btnPostNow');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span> Working...';

  try {
    const res = await fetch('/api/post-now', { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      showToast('Content successfully compiled and published.', 'success');
      loadStats();
      loadHistory();
    } else {
      throw new Error(data.error || 'Unknown error');
    }
  } catch (error) {
    showToast(`Execution failed: ${error.message}`, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = 'Execute Immediate Post';
  }
}

// ═══════════════════════════════════════════════
// SCHEDULER
// ═══════════════════════════════════════════════

async function toggleScheduler(start) {
  const endpoint = start ? '/api/scheduler/start' : '/api/scheduler/stop';

  try {
    const res = await fetch(endpoint, { method: 'POST' });
    const data = await res.json();
    updateSchedulerUI(data);
    showToast(start ? 'Scheduler started! 🕐' : 'Scheduler stopped.', start ? 'success' : 'info');
  } catch (error) {
    showToast(`Scheduler error: ${error.message}`, 'error');
  }
}

async function updateScheduleTime() {
  const time = document.getElementById('scheduleTime').value;
  if (!time) return;

  try {
    const res = await fetch('/api/scheduler/time', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ time })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }

    showToast(`Schedule updated to ${time}`, 'success');
    loadStats();
  } catch (error) {
    showToast(`Failed to update time: ${error.message}`, 'error');
  }
}

function updateSchedulerUI(scheduler) {
  if (!scheduler) return;

  const dot = document.getElementById('schedulerDot');
  const badgeText = document.getElementById('schedulerBadgeText');
  const btnStart = document.getElementById('btnStartScheduler');
  const btnStop = document.getElementById('btnStopScheduler');
  const statusValue = document.getElementById('schedStatusValue');
  const timeValue = document.getElementById('schedTimeValue');
  const tzValue = document.getElementById('schedTzValue');

  if (scheduler.isActive) {
    dot.className = 'status-dot active';
    badgeText.textContent = `Active — ${scheduler.scheduledTime}`;
    btnStart.style.display = 'none';
    btnStop.style.display = 'flex';
    statusValue.textContent = 'Active';
    statusValue.className = 'scheduler-status-value active';
  } else {
    dot.className = 'status-dot inactive';
    badgeText.textContent = 'Scheduler Off';
    btnStart.style.display = 'flex';
    btnStop.style.display = 'none';
    statusValue.textContent = 'Inactive';
    statusValue.className = 'scheduler-status-value inactive';
  }

  timeValue.textContent = scheduler.scheduledTime || '09:00';
  tzValue.textContent = scheduler.timezone || 'Asia/Kolkata';

  // Update time input
  document.getElementById('scheduleTime').value = scheduler.scheduledTime || '09:00';
}

// ═══════════════════════════════════════════════
// POST HISTORY
// ═══════════════════════════════════════════════

async function loadHistory() {
  try {
    const res = await fetch(`/api/posts?page=${currentPage}&limit=5`);
    const data = await res.json();

    const container = document.getElementById('postList');
    const info = document.getElementById('historyInfo');
    const pagination = document.getElementById('pagination');

    info.textContent = `${data.total} posts total`;

    if (data.posts.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px; color:var(--text-muted);">
          <div style="font-size:48px; margin-bottom:16px;">📭</div>
          <p>No posts yet. Generate your first Java post above!</p>
        </div>
      `;
      pagination.style.display = 'none';
      return;
    }

    container.innerHTML = data.posts.map(post => renderPostItem(post)).join('');

    // Pagination
    if (data.totalPages > 1) {
      pagination.style.display = 'flex';
      document.getElementById('pageInfo').textContent = `Page ${data.page} of ${data.totalPages}`;
      document.getElementById('btnPrevPage').disabled = data.page <= 1;
      document.getElementById('btnNextPage').disabled = data.page >= data.totalPages;
    } else {
      pagination.style.display = 'none';
    }

    // Update today's post status
    const todayPost = data.posts.find(p => {
      const postDate = new Date(p.postedAt).toDateString();
      return postDate === new Date().toDateString();
    });
    document.getElementById('schedTodayValue').textContent = todayPost ? '✓ Posted' : 'Not yet';
  } catch (error) {
    console.error('Failed to load history:', error);
  }
}

function renderPostItem(post) {
  const date = new Date(post.postedAt).toLocaleString();
  const statusClass = post.status === 'published' ? 'published' : 'failed';
  const statusIcon = post.status === 'published' ? '✓' : '✕';
  const contentPreview = (post.content || '').substring(0, 180);

  return `
    <div class="post-item">
      <div class="post-item-header">
        <span class="post-status ${statusClass}">${statusIcon} ${post.status}</span>
        <span class="post-date">${date}</span>
      </div>
      <div class="post-topic">Topic: ${post.topic || 'Unknown topic'}</div>
      <div class="post-content-preview">${escapeHtml(contentPreview)}${post.content?.length > 180 ? '...' : ''}</div>
      <div class="post-item-actions">
        <button class="btn btn-outline btn-sm" onclick="viewPost('${post.id}')">View</button>
        <button class="btn btn-outline btn-sm" onclick="copyPostContent('${post.id}')">Copy</button>
        <button class="btn btn-outline btn-sm" onclick="deletePost('${post.id}')" style="color:var(--danger);">Delete</button>
      </div>
    </div>
  `;
}

function changePage(delta) {
  currentPage += delta;
  if (currentPage < 1) currentPage = 1;
  loadHistory();
}

// Store posts data for modal access
let postsCache = [];

async function viewPost(id) {
  try {
    const res = await fetch(`/api/posts?page=1&limit=100`);
    const data = await res.json();
    const post = data.posts.find(p => p.id === id);

    if (post) {
      document.getElementById('modalTitle').textContent = `Topic: ${post.topic || 'Post Details'}`;
      document.getElementById('modalContent').textContent = post.content;
      document.getElementById('postModal').classList.add('show');
    }
  } catch (error) {
    showToast('Failed to load post details', 'error');
  }
}

async function copyPostContent(id) {
  try {
    const res = await fetch(`/api/posts?page=1&limit=100`);
    const data = await res.json();
    const post = data.posts.find(p => p.id === id);

    if (post) {
      await navigator.clipboard.writeText(post.content);
      showToast('Post content copied!', 'success');
    }
  } catch (error) {
    showToast('Failed to copy', 'error');
  }
}

async function deletePost(id) {
  if (!confirm('Delete this post from history?')) return;

  try {
    await fetch(`/api/posts/${id}`, { method: 'DELETE' });
    showToast('Post deleted', 'info');
    loadHistory();
    loadStats();
  } catch (error) {
    showToast('Failed to delete post', 'error');
  }
}

// ═══════════════════════════════════════════════
// MODAL
// ═══════════════════════════════════════════════

function closeModal() {
  document.getElementById('postModal').classList.remove('show');
}

function copyModalContent() {
  const content = document.getElementById('modalContent').textContent;
  navigator.clipboard.writeText(content).then(() => {
    showToast('Content copied to clipboard!', 'success');
  });
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.id === 'postModal') {
    closeModal();
  }
});

// ═══════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════

function showAlert(type, message) {
  const id = type === 'success' ? 'alertSuccess' : 'alertError';
  const textId = type === 'success' ? 'alertSuccessText' : 'alertErrorText';
  document.getElementById(textId).textContent = message;
  document.getElementById(id).classList.add('show');

  setTimeout(() => hideAlert(id), 5000);
}

function hideAlert(id) {
  document.getElementById(id).classList.remove('show');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 5000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
