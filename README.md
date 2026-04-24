# Mindscape — Brain Dump to Visual Mind Map

> Turn a stream of thoughts into an interactive mind map and cluster graph, powered by Gemini AI.

**Live Demo:** _(deploy to Firebase or Vercel — see below)_

---

## What it does

Paste anything on your mind — tasks, worries, plans, ideas. Gemini parses the structure underneath and renders two interactive visualisations:

- **Mind Map** — radial tree: root idea → categories → individual tasks. Click to collapse branches.
- **Cluster Graph** — force-directed physics: nodes pulled toward their category centre. Fully draggable.

Cross-category links (e.g. a work deadline related to a finance task) appear as dashed arrows.

---

## How to run locally

```bash
# 1. Clone or unzip
cd mindscape

# 2. Open in Chrome — no build step, no npm needed
open index.html
# or: python3 -m http.server 3000  →  localhost:3000
```

**Get a free Gemini API key:** [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

Enter it in the inline field on the input screen. It's saved to `localStorage` — never sent anywhere except directly to the Gemini API.

---

## Deploy to Firebase (5 minutes)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # set public dir to "." (current folder)
firebase deploy
```

You'll get a live `*.web.app` URL to share.

---

## Tech stack

| Layer      | Technology |
|------------|-----------|
| AI         | Gemini 2.0 Flash (free tier) |
| Graphs     | D3.js v7 — radial tree + force simulation |
| Frontend   | Vanilla HTML/CSS/JS — zero framework, zero build |
| Hosting    | Firebase Hosting (or any static host) |
| Storage    | Browser `localStorage` (API key + last graph) |

---

## File structure

```
mindscape/
├── index.html          # Two screens: input + canvas
├── css/
│   └── style.css       # Full dark theme, animations, responsive
└── js/
    ├── config.js       # API key management + retry config
    ├── examples.js     # 3 pre-written brain dumps
    ├── gemini.js       # Prompt, fetch, auto-retry on rate limit
    ├── graph.js        # D3 mind map + cluster, drag, search, export
    └── app.js          # Screen transitions, loading, error handling
```

---

## Features

- **Two graph views** — mind map and force cluster, switch with tabs
- **Drag nodes** freely in cluster view; nodes snap back when released
- **Collapse branches** in mind map by clicking category nodes
- **Search** — type to highlight matching nodes, dim everything else
- **Priority filter** — show only urgent / normal / someday nodes
- **Node detail panel** — click any leaf to see priority, time estimate, cross-links
- **Stats ribbon** — total tasks, urgent count, estimated total time
- **Rate limit retry** — auto-retries after 5s on 429, falls back to `gemini-1.5-flash-8b`
- **Restore last session** — last graph saved to localStorage, one click to reload
- **Export SVG** — download the graph as a scalable vector file
- **Export JSON** — download the raw graph data structure
- **Demo mode** — works without an API key using a prebuilt sample graph

---

## AI prompt strategy

Gemini is asked to return a **graph data structure** — not a flat list. The prompt requests:
1. A root node (the overall topic)
2. Category nodes (work, health, finance, etc.)
3. Leaf nodes (individual tasks with priority + time estimate)
4. Cross-category `related` edges where ideas connect across domains

`temperature: 0.25` keeps output consistent. JSON fences are stripped before parsing. Missing fields fall back to safe defaults.

---

## What to build next (Day 3+)

- [ ] Share link — encode graph as URL param (base64 JSON)
- [ ] Edit node labels inline (double-click)
- [ ] Mark tasks done — strikethrough + fade
- [ ] Multiple saved sessions — dropdown to load past maps
- [ ] Colour themes — light mode, sepia, high contrast

---

## Known limitations

- Free Gemini tier: ~15 req/min. Use `gemini-1.5-flash-8b` for higher quota.
- Very large dumps (2000+ chars) may hit output token limits — split into two dumps.
- No backend — API key lives in browser localStorage. Don't share your browser profile.

---

*Built for Google Solution Challenge 2026 — one developer, three days.*
