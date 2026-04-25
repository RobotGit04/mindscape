// ─── app.js ──────────────────────────────────────────────────
// FIX 1: _graph exposed via window so app.js can access it
// FIX 2: updateLoadingMsg only defined here, not in gemini.js
// FIX 3: prewarm cache stores resolved graph only, not Promise

// ── Char counter ─────────────────────────────────────────────
document.getElementById('dumpInput').addEventListener('input', updateCharCount);
function updateCharCount() {
  document.getElementById('charCount').textContent =
    document.getElementById('dumpInput').value.length;
}
document.getElementById('dumpInput').addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSubmit();
});

// ── Pre-warm cache ────────────────────────────────────────────
// Stores ONLY resolved graph objects, never Promises.
// Called on chip hover — silently fires Gemini in background.
window._warmCache = {};
window._warmInFlight = {};

function prewarmExample(type) {
  if (!getApiKey()) return;
  if (window._warmCache[type] || window._warmInFlight[type]) return;
  window._warmInFlight[type] = true;
  callGemini(EXAMPLES[type])
    .then(g  => { window._warmCache[type] = g; })
    .catch(() => { /* silent — user will wait on submit */ })
    .finally(() => { window._warmInFlight[type] = false; });
}

// ── Submit ─────────────────────────────────────────────────
async function handleSubmit() {
  const text = document.getElementById('dumpInput').value.trim();
  if (!text || text.length < 10) { shakeDump(); return; }

  const key = getApiKey();
  if (!key) {
    window._pendingSubmit = true;
    showToast('Add your Gemini API key below, then click Map again.');
    document.getElementById('apiKeyInline').focus();
    return;
  }

  showScreen('canvas');
  showLoading(true);
  setBtn(true);

  // Check pre-warm cache (only resolved objects stored here)
  const cachedType = Object.keys(EXAMPLES).find(k => EXAMPLES[k] === text);
  const cached     = cachedType ? window._warmCache[cachedType] : null;

  try {
    const graph = (cached && cached.nodes) ? cached : await callGemini(text);
    showLoading(false);
    drawGraph(graph, 'mindmap');
    window._savedGraph = graph;
    const btn = document.getElementById('restoreBtn');
    if (btn) btn.classList.remove('hidden');
  } catch (err) {
    showLoading(false);
    const code = err.code || err.message || 'UNKNOWN';
    if (code === 'NO_KEY' || code === 'BAD_KEY') {
      if (code === 'BAD_KEY') localStorage.removeItem(CONFIG.STORAGE_KEY);
      showToast(friendlyError(code));
      showScreen('input');
    } else {
      showToast(friendlyError(code));
      // Stay on canvas only if a graph is already drawn
      if (!window._graph) showScreen('input');
    }
  } finally {
    setBtn(false);
  }
}

// ── Restore ───────────────────────────────────────────────────
function restoreGraph() {
  if (!window._savedGraph) return;
  showScreen('canvas');
  showLoading(false);
  drawGraph(window._savedGraph, 'mindmap');
}

function goBack() {
  if (window._sim) { window._sim.stop(); window._sim = null; }
  showScreen('input');
}

// ── Theme toggle ──────────────────────────────────────────────
function toggleTheme() {
  const html   = document.documentElement;
  const isDark = html.getAttribute('data-theme') !== 'light';
  const next   = isDark ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('mindscape_theme', next);

  const sunSVG  = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.3"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`;
  const moonSVG = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M13.5 10A6 6 0 0 1 6 2.5a6 6 0 1 0 7.5 7.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`;

  document.querySelectorAll('#themeBtn, .theme-btn-input').forEach(btn => {
    if (btn) btn.innerHTML = next === 'dark' ? sunSVG : moonSVG;
  });

  if (window._graph) redrawForTheme();
  if (window._graph) buildLegend(window._graph);
}

window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('mindscape_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  if (saved === 'light') {
    const moonSVG = `<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M13.5 10A6 6 0 0 1 6 2.5a6 6 0 1 0 7.5 7.5z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`;
    document.querySelectorAll('#themeBtn, .theme-btn-input').forEach(btn => {
      if (btn) btn.innerHTML = moonSVG;
    });
  }
  // Restore last saved graph
  const saved_graph = localStorage.getItem(CONFIG.GRAPH_KEY);
  if (saved_graph) {
    try {
      window._savedGraph = JSON.parse(saved_graph);
      const btn = document.getElementById('restoreBtn');
      if (btn) btn.classList.remove('hidden');
    } catch { /* ignore */ }
  }
});

// ── Screens ───────────────────────────────────────────────────
function showScreen(name) {
  document.getElementById('inputScreen').classList.toggle('active', name === 'input');
  document.getElementById('canvasScreen').classList.toggle('active', name === 'canvas');
}

// ── Loading ───────────────────────────────────────────────────
const LOADING_MSGS = [
  'Mapping connections…', 'Finding the clusters…',
  'Untangling your thoughts…', 'Building the graph…', 'Almost there…',
];
let _loadTimer = null;

function showLoading(on) {
  const el = document.getElementById('canvasLoading');
  if (on) {
    el.classList.remove('hidden');
    let i = 0;
    const lbl = document.getElementById('loadingMsg');
    lbl.textContent = LOADING_MSGS[0];
    _loadTimer = setInterval(() => {
      i = (i + 1) % LOADING_MSGS.length;
      lbl.style.opacity = '0';
      setTimeout(() => { lbl.textContent = LOADING_MSGS[i]; lbl.style.opacity = '1'; }, 180);
    }, 2000);
  } else {
    el.classList.add('hidden');
    if (_loadTimer) { clearInterval(_loadTimer); _loadTimer = null; }
  }
}

// Single definition — gemini.js calls this for retry messages
function updateLoadingMsg(msg) {
  const s = document.getElementById('loadingSub');
  if (s) s.textContent = msg;
}

function setBtn(loading) {
  const btn = document.getElementById('mapBtn');
  btn.disabled = loading;
  btn.querySelector('.map-btn-text').textContent = loading ? 'Mapping…' : 'Map my thoughts';
}

function showToast(msg) {
  document.getElementById('toastMsg').textContent = msg;
  document.getElementById('toast').classList.remove('hidden');
  if (window._toastTimer) clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(dismissToast, 8000);
}
function dismissToast() { document.getElementById('toast').classList.add('hidden'); }

function shakeDump() {
  const el = document.getElementById('dumpInput');
  [4, -4, 3, -3, 1, 0].forEach((px, i) =>
    setTimeout(() => el.style.transform = `translateX(${px}px)`, i * 55));
  el.focus();
}