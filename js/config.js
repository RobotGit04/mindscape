// ─── config.js ───────────────────────────────────────────────
const CONFIG = {
  GEMINI_API_KEY: '',

  // ✅ Verified free-tier model names (April 2026)
  // Priority order: fastest → most quota → safest fallback
  GEMINI_MODEL:   'gemini-1.5-flash',        // primary — best free quota
  FALLBACK_MODEL: 'gemini-1.5-flash-latest', // fallback on 429

  ENDPOINT:       'https://generativelanguage.googleapis.com/v1beta/models',
  STORAGE_KEY:    'mindscape_key',
  GRAPH_KEY:      'mindscape_last_graph',
  RETRY_DELAY_MS: 5000,
  MAX_RETRIES:    1,
};

function getApiKey() {
  if (CONFIG.GEMINI_API_KEY) return CONFIG.GEMINI_API_KEY;
  return localStorage.getItem(CONFIG.STORAGE_KEY) || null;
}

function saveInlineKey() {
  const input = document.getElementById('apiKeyInline');
  const key   = input.value.trim();
  if (!key)                    { showKeyStatus('Enter a key first', false); return; }
  if (!key.startsWith('AIza')) { showKeyStatus('Key should start with AIza…', false); return; }
  localStorage.setItem(CONFIG.STORAGE_KEY, key);
  showKeyStatus('Key saved ✓', true);
  input.value = '';
  if (window._pendingSubmit) { window._pendingSubmit = false; handleSubmit(); }
}

function showKeyStatus(msg, ok) {
  const el = document.getElementById('keyStatus');
  el.textContent = msg;
  el.className   = 'key-status ' + (ok ? 'ok' : 'err');
  setTimeout(() => { el.textContent = ''; el.className = 'key-status'; }, 3500);
}

window.addEventListener('DOMContentLoaded', () => {
  if (getApiKey()) showKeyStatus('API key loaded ✓', true);
  const saved = localStorage.getItem(CONFIG.GRAPH_KEY);
  if (saved) {
    try {
      window._savedGraph = JSON.parse(saved);
      const btn = document.getElementById('restoreBtn');
      if (btn) btn.classList.remove('hidden');
    } catch { /* ignore */ }
  }
});