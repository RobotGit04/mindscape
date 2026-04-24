// ─── app.js ──────────────────────────────────────────────────

document.getElementById('dumpInput').addEventListener('input', updateCharCount);
function updateCharCount() {
  document.getElementById('charCount').textContent =
    document.getElementById('dumpInput').value.length;
}

document.getElementById('dumpInput').addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSubmit();
});

// ── Submit ────────────────────────────────────────────────────
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

  try {
    const graph = await callGemini(text);
    showLoading(false);
    drawGraph(graph, 'mindmap');
    // Show restore button for next session
    document.getElementById('restoreBtn')?.classList.remove('hidden');
    window._savedGraph = graph;
  } catch (err) {
    showLoading(false);
    const code = err.code || err.message || 'UNKNOWN';
    if (code === 'NO_KEY' || code === 'BAD_KEY') {
      if (code === 'BAD_KEY') localStorage.removeItem(CONFIG.STORAGE_KEY);
      showToast(friendlyError(code));
      showScreen('input');
    } else {
      showToast(friendlyError(code));
      // Stay on canvas if graph already loaded, else go back
      if (!_graph) showScreen('input');
    }
  } finally {
    setBtn(false);
  }
}

// ── Demo mode ─────────────────────────────────────────────────
function loadDemo() {
  showScreen('canvas');
  showLoading(false);
  drawGraph(getDemoGraph(), 'mindmap');
}

// ── Restore last session ──────────────────────────────────────
function restoreGraph() {
  if (!window._savedGraph) return;
  showScreen('canvas');
  showLoading(false);
  drawGraph(window._savedGraph, 'mindmap');
}

// ── Go back ───────────────────────────────────────────────────
function goBack() {
  if (window._sim) { window._sim.stop(); window._sim = null; }
  showScreen('input');
}

// ── Screen transitions ─────────────────────────────────────────
function showScreen(name) {
  document.getElementById('inputScreen').classList.toggle('active', name === 'input');
  document.getElementById('canvasScreen').classList.toggle('active', name === 'canvas');
}

// ── Loading ───────────────────────────────────────────────────
const LOADING_MSGS = [
  'Mapping connections…',
  'Finding the clusters…',
  'Untangling your thoughts…',
  'Building the graph…',
  'Almost there…',
];
let _loadTimer = null;

function showLoading(on) {
  const el  = document.getElementById('canvasLoading');
  const sub = document.getElementById('loadingSub');
  if (on) {
    el.classList.remove('hidden');
    sub.textContent = '';
    let i = 0;
    const lbl = document.getElementById('loadingMsg');
    lbl.textContent = LOADING_MSGS[0];
    _loadTimer = setInterval(() => {
      i = (i+1) % LOADING_MSGS.length;
      lbl.style.opacity = '0';
      setTimeout(() => { lbl.textContent = LOADING_MSGS[i]; lbl.style.opacity = '1'; }, 180);
    }, 2000);
  } else {
    el.classList.add('hidden');
    if (_loadTimer) { clearInterval(_loadTimer); _loadTimer = null; }
  }
}

function updateLoadingMsg(msg) {
  const sub = document.getElementById('loadingSub');
  if (sub) sub.textContent = msg;
}

// ── Button state ──────────────────────────────────────────────
function setBtn(loading) {
  const btn = document.getElementById('mapBtn');
  btn.disabled = loading;
  btn.querySelector('.map-btn-text').textContent = loading ? 'Mapping…' : 'Map my thoughts';
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg) {
  document.getElementById('toastMsg').textContent = msg;
  document.getElementById('toast').classList.remove('hidden');
  if (window._toastTimer) clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(dismissToast, 8000);
}
function dismissToast() { document.getElementById('toast').classList.add('hidden'); }

// ── Shake textarea ────────────────────────────────────────────
function shakeDump() {
  const el = document.getElementById('dumpInput');
  [4,-4,3,-3,1,0].forEach((px,i) =>
    setTimeout(() => el.style.transform = `translateX(${px}px)`, i*55)
  );
  el.focus();
}