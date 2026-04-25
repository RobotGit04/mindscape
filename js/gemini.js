// ─── gemini.js ───────────────────────────────────────────────
// Gemini API call with auto-retry + model fallback on rate limit

function buildGraphPrompt(dump) {
  return `You are an expert at extracting structure from unorganised thoughts.

The user has given you a brain dump — a stream of tasks, ideas, and worries.

Your job is to produce a GRAPH DATA STRUCTURE with:

1. "title": a short 2-4 word label summarising the whole brain dump (e.g. "Work & Life Chaos")

2. "nodes": an array of node objects. Include:
   - One ROOT node: id="root", label=title, category="root", priority="root", size=3
   - One CATEGORY node per category found. id="cat_work" etc., size=2
   - One LEAF node per individual task/idea. id="n1","n2" etc., size=1,
     priority="urgent"|"normal"|"someday", estimatedMinutes=10|15|20|30|45|60|90|120

   Node shape: { "id", "label", "category", "priority", "size", "estimatedMinutes" }

3. "links": edges array:
   - root → each category node  (type:"hierarchy")
   - each category node → its leaves  (type:"hierarchy")
   - cross-category links you detect  (type:"related")

   Link shape: { "source": id, "target": id, "type": "hierarchy"|"related" }

Categories: root, work, personal, health, finance, study, other

Return ONLY valid JSON. No markdown fences, no explanation.

Brain dump:
${dump}`;
}

// ── fetch with retry + model fallback ────────────────────────
async function fetchGemini(prompt, model, retries) {
  const key = getApiKey();
  const url = `${CONFIG.ENDPOINT}/${model}:generateContent?key=${key}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { maxOutputTokens: 3000, temperature: 0.25, topP: 0.9 },
  };

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw Object.assign(new Error('NETWORK'), { code: 'NETWORK' });
  }

  // Rate limited — retry after delay, fallback model on second attempt
  if (res.status === 429) {
    if (retries > 0) {
      updateLoadingMsg(`Rate limited — retrying in ${CONFIG.RETRY_DELAY_MS / 1000}s…`);
      await sleep(CONFIG.RETRY_DELAY_MS);
      const nextModel = retries === CONFIG.MAX_RETRIES ? model : CONFIG.FALLBACK_MODEL;
      return fetchGemini(prompt, nextModel, retries - 1);
    }
    throw Object.assign(new Error('RATE'), { code: 'RATE' });
  }

  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    const c = b?.error?.code || res.status;
    if (c === 400 || c === 401) throw Object.assign(new Error('BAD_KEY'), { code: 'BAD_KEY' });
    throw Object.assign(new Error(`API_${c}`), { code: `API_${c}` });
  }

  return res;
}

async function callGemini(dump) {
  const key = getApiKey();
  if (!key) throw Object.assign(new Error('NO_KEY'), { code: 'NO_KEY' });

  const prompt = buildGraphPrompt(dump);
  const res    = await fetchGemini(prompt, CONFIG.GEMINI_MODEL, CONFIG.MAX_RETRIES);
  const data   = await res.json();
  const raw    = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const graph  = parseGraph(raw);

  // Persist to localStorage for "restore last session"
  localStorage.setItem(CONFIG.GRAPH_KEY, JSON.stringify(graph));

  return graph;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }


// ── Parse + sanitise ─────────────────────────────────────────
function parseGraph(raw) {
  let clean = raw
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '').trim();
  let graph;
  try { graph = JSON.parse(clean); }
  catch {
    const m = clean.match(/\{[\s\S]*\}/);
    if (!m) throw Object.assign(new Error('PARSE'), { code: 'PARSE' });
    graph = JSON.parse(m[0]);
  }
  if (!graph.nodes?.length) throw Object.assign(new Error('EMPTY'), { code: 'EMPTY' });

  graph.nodes = graph.nodes.map((n, i) => ({
    id:               n.id   || `n${i}`,
    label:            String(n.label || '?').slice(0, 80),
    category:         n.category || 'other',
    priority:         ['urgent','normal','someday','root'].includes(n.priority) ? n.priority : 'normal',
    size:             Number(n.size) || 1,
    estimatedMinutes: n.estimatedMinutes ?? null,
    collapsed:        false,
  }));

  graph.links = (graph.links || []).map(l => ({
    source: l.source?.id || l.source,
    target: l.target?.id || l.target,
    type:   l.type || 'hierarchy',
  }));

  graph.title = graph.title || 'Your thoughts';
  return graph;
}

// ── Demo graph ───────────────────────────────────────────────
function getDemoGraph() {
  return {
    title: 'Week Ahead',
    nodes: [
      {id:'root',       label:'Week Ahead',              category:'root',     priority:'root',    size:3, estimatedMinutes:null},
      {id:'cat_work',   label:'Work',                    category:'work',     priority:'root',    size:2, estimatedMinutes:null},
      {id:'cat_health', label:'Health',                  category:'health',   priority:'root',    size:2, estimatedMinutes:null},
      {id:'cat_fin',    label:'Finance',                 category:'finance',  priority:'root',    size:2, estimatedMinutes:null},
      {id:'cat_pers',   label:'Personal',                category:'personal', priority:'root',    size:2, estimatedMinutes:null},
      {id:'cat_study',  label:'Study',                   category:'study',    priority:'root',    size:2, estimatedMinutes:null},
      {id:'n1',  label:'Reply to Priya',                 category:'work',     priority:'urgent',  size:1, estimatedMinutes:15},
      {id:'n2',  label:'Fix login crash on mobile',      category:'work',     priority:'urgent',  size:1, estimatedMinutes:60},
      {id:'n3',  label:'Finish quarterly report',        category:'work',     priority:'urgent',  size:1, estimatedMinutes:120},
      {id:'n4',  label:'Review Arjun PR',                category:'work',     priority:'normal',  size:1, estimatedMinutes:30},
      {id:'n5',  label:'Schedule team retro',            category:'work',     priority:'normal',  size:1, estimatedMinutes:15},
      {id:'n6',  label:'Book dentist appointment',       category:'health',   priority:'normal',  size:1, estimatedMinutes:10},
      {id:'n7',  label:'Restart gym routine',            category:'health',   priority:'someday', size:1, estimatedMinutes:60},
      {id:'n8',  label:'Pay electricity bill',           category:'finance',  priority:'urgent',  size:1, estimatedMinutes:10},
      {id:'n9',  label:'Renew vehicle insurance',        category:'finance',  priority:'normal',  size:1, estimatedMinutes:20},
      {id:'n10', label:'Call mom back',                  category:'personal', priority:'normal',  size:1, estimatedMinutes:20},
      {id:'n11', label:'Birthday gift for Rohan',        category:'personal', priority:'someday', size:1, estimatedMinutes:30},
      {id:'n12', label:'ML assignment due Friday',       category:'study',    priority:'urgent',  size:1, estimatedMinutes:120},
      {id:'n13', label:'Revise for DBMS test',           category:'study',    priority:'urgent',  size:1, estimatedMinutes:90},
      {id:'n14', label:'Apply to Google DSC event',      category:'study',    priority:'someday', size:1, estimatedMinutes:20},
    ],
    links: [
      {source:'root',       target:'cat_work',   type:'hierarchy'},
      {source:'root',       target:'cat_health', type:'hierarchy'},
      {source:'root',       target:'cat_fin',    type:'hierarchy'},
      {source:'root',       target:'cat_pers',   type:'hierarchy'},
      {source:'root',       target:'cat_study',  type:'hierarchy'},
      {source:'cat_work',   target:'n1',  type:'hierarchy'},
      {source:'cat_work',   target:'n2',  type:'hierarchy'},
      {source:'cat_work',   target:'n3',  type:'hierarchy'},
      {source:'cat_work',   target:'n4',  type:'hierarchy'},
      {source:'cat_work',   target:'n5',  type:'hierarchy'},
      {source:'cat_health', target:'n6',  type:'hierarchy'},
      {source:'cat_health', target:'n7',  type:'hierarchy'},
      {source:'cat_fin',    target:'n8',  type:'hierarchy'},
      {source:'cat_fin',    target:'n9',  type:'hierarchy'},
      {source:'cat_pers',   target:'n10', type:'hierarchy'},
      {source:'cat_pers',   target:'n11', type:'hierarchy'},
      {source:'cat_study',  target:'n12', type:'hierarchy'},
      {source:'cat_study',  target:'n13', type:'hierarchy'},
      {source:'cat_study',  target:'n14', type:'hierarchy'},
      {source:'n3',         target:'n8',  type:'related'},
      {source:'n12',        target:'n2',  type:'related'},
    ],
  };
}

// ── Error messages ───────────────────────────────────────────
const ERROR_MAP = {
  NO_KEY:  'No API key saved. Enter your Gemini key below.',
  NETWORK: 'Network error. Check your internet connection.',
  BAD_KEY: 'API key is invalid. Check aistudio.google.com.',
  RATE:    'Rate limit hit. Wait a minute, or switch to gemini-1.5-flash-8b in config.js.',
  PARSE:   'Could not parse Gemini response. Try a shorter dump.',
  EMPTY:   'No tasks found. Add more detail to your brain dump.',
};
function friendlyError(code) { return ERROR_MAP[code] || `Error: ${code}`; }