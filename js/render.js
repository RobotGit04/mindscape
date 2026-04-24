// ─── render.js ────────────────────────────────────────────────
// Pure DOM rendering. No API calls, no state mutation.
// Receives task data, builds HTML. That's it.

// ── Build one task card ────────────────────────────────────────
function buildTaskCard(task) {
  const card = document.createElement('div');
  card.className = `task-card ${task.priority}${task.done ? ' done' : ''}`;
  card.dataset.id       = task.id;
  card.dataset.priority = task.priority;

  const timeLabel = formatTime(task.estimatedMinutes);

  card.innerHTML = `
    <div class="task-check">${task.done ? '✓' : ''}</div>
    <div class="task-content">
      <p class="task-text">${escapeHtml(task.task)}</p>
      <div class="task-meta">
        <span class="priority-badge ${task.priority}">${task.priority}</span>
        <span class="category-badge">${task.category}</span>
        <span class="time-badge">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.2"/>
            <path d="M8 5v3.5l2 2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          ${timeLabel}
        </span>
      </div>
    </div>
  `;

  // Toggle done state on click
  card.addEventListener('click', () => toggleDone(task.id, card));
  return card;
}

// ── Render all tasks to the grid ───────────────────────────────
function renderTasks(tasks) {
  const grid = document.getElementById('tasksGrid');
  grid.innerHTML = '';

  if (tasks.length === 0) {
    grid.innerHTML = `
      <div style="text-align:center;padding:2.5rem;color:var(--ink-4);font-size:0.9rem;font-style:italic;">
        No tasks in this filter.
      </div>`;
    return;
  }

  tasks.forEach(task => {
    grid.appendChild(buildTaskCard(task));
  });
}

// ── Update stats bar ───────────────────────────────────────────
function renderStats(tasks) {
  const total   = tasks.length;
  const urgent  = tasks.filter(t => t.priority === 'urgent').length;
  const minutes = tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);

  document.getElementById('statTotal').textContent  = total;
  document.getElementById('statUrgent').textContent = urgent;
  document.getElementById('statTime').textContent   = formatTime(minutes);
}

// ── Helpers ────────────────────────────────────────────────────
function formatTime(minutes) {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function escapeHtml(str) {
  return str
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ── Loading messages (cycles while waiting) ────────────────────
const LOADING_MESSAGES = [
  'Reading between the lines…',
  'Untangling the chaos…',
  'Finding the signal in the noise…',
  'Organising your thoughts…',
  'Almost there…',
];

let _loadingTimer = null;

function startLoadingMessages() {
  let i = 0;
  const label = document.getElementById('loadingLabel');
  label.textContent = LOADING_MESSAGES[0];
  _loadingTimer = setInterval(() => {
    i = (i + 1) % LOADING_MESSAGES.length;
    label.style.opacity = '0';
    setTimeout(() => {
      label.textContent = LOADING_MESSAGES[i];
      label.style.opacity = '1';
    }, 200);
  }, 2200);
}

function stopLoadingMessages() {
  if (_loadingTimer) {
    clearInterval(_loadingTimer);
    _loadingTimer = null;
  }
}