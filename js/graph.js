// ─── graph.js ─────────────────────────────────────────────────
// D3 v7 — Mind map (radial tree) + Force cluster
// Features: drag, collapse, zoom, search highlight, priority dim, export

const COLORS = {
  root:     '#ffffff',
  work:     '#7c6af7',
  personal: '#f97b6b',
  health:   '#4ecb9e',
  finance:  '#f5c842',
  study:    '#60b8f5',
  other:    '#c084fc',
};
function catColor(cat) { return COLORS[cat] || COLORS.other; }

function nodeR(d)        { return d.size === 3 ? 32 : d.size === 2 ? 20 : 10; }
function nodeFontSize(d) { return d.size === 3 ? 13 : d.size === 2 ? 11 : 9;  }

function wrapLabel(text, maxChars) {
  if (text.length <= maxChars) return [text];
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars) { if (line) lines.push(line.trim()); line = w; }
    else line = (line + ' ' + w).trim();
  }
  if (line) lines.push(line.trim());
  return lines.slice(0, 3);
}

// ── State ──────────────────────────────────────────────────────
let _graph          = null;
let _view           = 'mindmap';
let _svg            = null;
let _g              = null;
let _zoom           = null;
let _sim            = null;
let _width          = 0;
let _height         = 0;
let _searchTerm     = '';
let _priorityFilter = 'all';

// ── Init canvas ────────────────────────────────────────────────
function initCanvas() {
  const svgEl = document.getElementById('graphSVG');
  _width  = svgEl.clientWidth  || window.innerWidth;
  _height = svgEl.clientHeight || (window.innerHeight - 52);
  d3.select(svgEl).selectAll('*').remove();
  _svg = d3.select(svgEl);

  _svg.append('defs').append('marker')
    .attr('id','arr-rel').attr('viewBox','0 0 8 8')
    .attr('refX',8).attr('refY',4)
    .attr('markerWidth',5).attr('markerHeight',5)
    .attr('orient','auto')
    .append('path').attr('d','M0,0 L8,4 L0,8')
    .attr('fill','none').attr('stroke','rgba(255,255,255,0.2)').attr('stroke-width',1.2);

  _zoom = d3.zoom().scaleExtent([0.15, 5])
    .on('zoom', e => _g.attr('transform', e.transform));
  _svg.call(_zoom);
  _g = _svg.append('g');
}

// ── Public API ─────────────────────────────────────────────────
function drawGraph(graph, view) {
  _graph = graph;
  _view  = view || _view;
  buildLegend(graph);
  buildStatsRibbon(graph);
  initCanvas();
  if (_view === 'mindmap') drawMindmap();
  else                     drawCluster();
}

function switchView(view) {
  _view = view;
  document.getElementById('tabMindmap').classList.toggle('active', view === 'mindmap');
  document.getElementById('tabCluster').classList.toggle('active', view === 'cluster');
  if (!_graph) return;
  if (_sim) { _sim.stop(); _sim = null; }
  initCanvas();
  if (view === 'mindmap') drawMindmap();
  else                    drawCluster();
}

// ── Search ────────────────────────────────────────────────────
function handleSearch(term) {
  _searchTerm = term.toLowerCase().trim();
  document.getElementById('searchClear').classList.toggle('hidden', !term);
  applyNodeOpacity();
}

function clearSearch() {
  _searchTerm = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').classList.add('hidden');
  applyNodeOpacity();
}

function applyNodeOpacity() {
  if (!_g) return;
  _g.selectAll('.node-group').each(function(d) {
    const data = d.data || d;
    const matchSearch   = !_searchTerm || data.label.toLowerCase().includes(_searchTerm);
    const matchPriority = _priorityFilter === 'all' || data.priority === _priorityFilter || data.size > 1;
    const opacity = (matchSearch && matchPriority) ? 1 : 0.1;
    d3.select(this).transition().duration(200).attr('opacity', opacity);
  });
  _g.selectAll('.link').each(function(d) {
    const src = (d.source?.data || d.source);
    const tgt = (d.target?.data || d.target);
    const srcMatch = !_searchTerm || src.label?.toLowerCase().includes(_searchTerm);
    const tgtMatch = !_searchTerm || tgt.label?.toLowerCase().includes(_searchTerm);
    d3.select(this).transition().duration(200)
      .attr('opacity', (srcMatch || tgtMatch) ? 1 : 0.05);
  });
}

// ── Priority filter ───────────────────────────────────────────
function setPriorityFilter(p, btn) {
  _priorityFilter = p;
  document.querySelectorAll('.pf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyNodeOpacity();
}

// ── MIND MAP ──────────────────────────────────────────────────
function drawMindmap() {
  if (!_graph) return;

  const nodeMap = {};
  _graph.nodes.forEach(n => { nodeMap[n.id] = { ...n, children: [] }; });
  _graph.links.filter(l => l.type === 'hierarchy').forEach(l => {
    const s = nodeMap[l.source?.id || l.source];
    const t = nodeMap[l.target?.id || l.target];
    if (s && t && s !== t) s.children.push(t);
  });

  const rootNode = nodeMap['root'] || Object.values(nodeMap)[0];
  const r = Math.min(_width, _height) * 0.42;
  const hierarchy = d3.hierarchy(rootNode, d => d.collapsed ? [] : d.children);
  const root = d3.tree().size([2 * Math.PI, r])
    .separation((a, b) => (a.parent === b.parent ? 1.2 : 2) / a.depth)(hierarchy);

  // Links
  const ll = _g.append('g');
  ll.selectAll('.link').data(root.links()).join('path')
    .attr('class','link')
    .attr('d', d3.linkRadial().angle(d => d.x).radius(d => d.y));

  // Related links
  const relLinks = _graph.links.filter(l => l.type === 'related');
  if (relLinks.length) {
    const posMap = {};
    root.each(d => { posMap[d.data.id] = d; });
    ll.selectAll('.link-rel').data(relLinks).join('line')
      .attr('class','link link-rel')
      .attr('stroke-dasharray','4 3')
      .attr('marker-end','url(#arr-rel)')
      .attr('x1', d => { const n=posMap[d.source?.id||d.source]; return n?radX(n.x,n.y):0; })
      .attr('y1', d => { const n=posMap[d.source?.id||d.source]; return n?radY(n.x,n.y):0; })
      .attr('x2', d => { const n=posMap[d.target?.id||d.target]; return n?radX(n.x,n.y):0; })
      .attr('y2', d => { const n=posMap[d.target?.id||d.target]; return n?radY(n.x,n.y):0; });
  }

  // Nodes
  const ng = _g.append('g').selectAll('.node-group')
    .data(root.descendants()).join('g')
    .attr('class', d => `node-group${d.data.collapsed?' collapsed':''}`)
    .attr('transform', d => `translate(${radX(d.x,d.y)},${radY(d.x,d.y)})`)
    .on('click', (e, d) => {
      e.stopPropagation();
      if (d.data.size === 1) { openPanel(d.data, _graph); return; }
      d.data.collapsed = !d.data.collapsed;
      drawMindmap();
    });

  // Glow urgent
  ng.filter(d => d.data.priority==='urgent' && d.data.size===1)
    .append('circle').attr('r', d => nodeR(d.data)+8)
    .attr('fill', d => catColor(d.data.category)).attr('opacity', 0.1);

  ng.append('circle').attr('class','node-circle')
    .attr('r', d => nodeR(d.data))
    .attr('fill', d => catColor(d.data.category))
    .attr('fill-opacity', d => d.data.size===1 ? 0.15 : 0.25)
    .attr('stroke', d => catColor(d.data.category))
    .attr('stroke-width', d => d.data.size===1 ? 1 : 1.8);

  // Labels
  ng.each(function(d) {
    const maxC  = d.data.size===3 ? 12 : d.data.size===2 ? 10 : 14;
    const lines = wrapLabel(d.data.label, maxC);
    const fs    = nodeFontSize(d.data);
    const lh    = fs + 3;
    const oy    = -(lines.length-1)*lh/2;
    lines.forEach((line, i) => {
      d3.select(this).append('text')
        .attr('class','node-label').attr('y', oy + i*lh)
        .attr('font-size', fs)
        .attr('font-weight', d.data.size > 1 ? 600 : 400)
        .attr('fill', d.data.category==='root' ? '#fff' : catColor(d.data.category))
        .attr('fill-opacity', d.data.size===1 ? 0.85 : 1)
        .text(line);
    });
  });

  _svg.call(_zoom.transform, d3.zoomIdentity.translate(_width/2, _height/2));
  applyNodeOpacity();
}

function radX(a, r) { return r * Math.sin(a); }
function radY(a, r) { return -r * Math.cos(a); }

// ── CLUSTER ──────────────────────────────────────────────────
function drawCluster() {
  if (!_graph) return;

  const nodes = _graph.nodes.map(n => ({...n}));
  const nodeById = {};
  nodes.forEach(n => { nodeById[n.id] = n; });

  const links = _graph.links.map(l => ({
    source: l.source?.id || l.source,
    target: l.target?.id || l.target,
    type:   l.type,
  }));

  const cats   = [...new Set(nodes.filter(n=>n.size===2).map(n=>n.category))];
  const angle  = (2*Math.PI) / Math.max(cats.length, 1);
  const clR    = Math.min(_width, _height) * 0.28;
  const centers = {};
  cats.forEach((c, i) => {
    centers[c] = {
      x: _width/2  + clR * Math.cos(i*angle - Math.PI/2),
      y: _height/2 + clR * Math.sin(i*angle - Math.PI/2),
    };
  });

  nodes.forEach(n => {
    if (n.id==='root') { n.x=_width/2; n.y=_height/2; n.fx=_width/2; n.fy=_height/2; return; }
    if (n.size===2 && centers[n.category]) { n.x=centers[n.category].x; n.y=centers[n.category].y; return; }
    const c = centers[n.category];
    n.x = (c?.x||_width/2)  + (Math.random()-.5)*60;
    n.y = (c?.y||_height/2) + (Math.random()-.5)*60;
  });

  const ll = _g.append('g');
  const linkSel = ll.selectAll('.link').data(links).join('line')
    .attr('class', d => `link${d.type==='related'?' link-rel':''}`)
    .attr('stroke-dasharray', d => d.type==='related'?'4 3':null)
    .attr('marker-end', d => d.type==='related'?'url(#arr-rel)':null);

  const drag = d3.drag()
    .on('start', (e,d) => { if(!e.active) _sim.alphaTarget(0.2).restart(); d.fx=d.x; d.fy=d.y; })
    .on('drag',  (e,d) => { d.fx=e.x; d.fy=e.y; })
    .on('end',   (e,d) => { if(!e.active) _sim.alphaTarget(0); if(d.id!=='root'){d.fx=null;d.fy=null;} });

  const ng = _g.append('g').selectAll('.node-group')
    .data(nodes).join('g')
    .attr('class','node-group')
    .call(drag)
    .on('click', (e, d) => {
      e.stopPropagation();
      openPanel(d, _graph);
      linkSel.classed('highlighted', l =>
        (l.source?.id||l.source)===d.id || (l.target?.id||l.target)===d.id
      );
    });

  ng.filter(d => d.priority==='urgent' && d.size===1)
    .append('circle').attr('r', d=>nodeR(d)+8)
    .attr('fill', d=>catColor(d.category)).attr('opacity',0.1);

  ng.append('circle').attr('class','node-circle')
    .attr('r', d=>nodeR(d))
    .attr('fill', d=>catColor(d.category))
    .attr('fill-opacity', d => d.size===1?0.15:d.size===2?0.22:0.3)
    .attr('stroke', d=>catColor(d.category))
    .attr('stroke-width', d=>d.size===1?1:1.8);

  ng.each(function(d) {
    const maxC  = d.size===3?10:d.size===2?9:13;
    const lines = wrapLabel(d.label, maxC);
    const fs    = nodeFontSize(d);
    const lh    = fs+3;
    const oy    = -(lines.length-1)*lh/2;
    lines.forEach((line,i) => {
      d3.select(this).append('text')
        .attr('class','node-label').attr('y', oy+i*lh)
        .attr('font-size', fs)
        .attr('font-weight', d.size>1?600:400)
        .attr('fill', d.category==='root'?'#fff':catColor(d.category))
        .attr('fill-opacity', d.size===1?0.85:1)
        .text(line);
    });
  });

  _sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d=>d.id)
      .distance(d => d.source?.id==='root'||d.source==='root' ? 160 : 65)
      .strength(0.6))
    .force('charge', d3.forceManyBody().strength(d => d.size===1?-130:d.size===2?-280:-420))
    .force('center', d3.forceCenter(_width/2, _height/2).strength(0.04))
    .force('collision', d3.forceCollide().radius(d => nodeR(d)+14))
    .force('cluster', alpha => {
      nodes.forEach(n => {
        if (n.size!==1) return;
        const c = centers[n.category];
        if (!c) return;
        n.vx += (c.x-n.x)*0.018*alpha;
        n.vy += (c.y-n.y)*0.018*alpha;
      });
    })
    .on('tick', () => {
      linkSel.attr('x1',d=>d.source?.x??0).attr('y1',d=>d.source?.y??0)
             .attr('x2',d=>d.target?.x??0).attr('y2',d=>d.target?.y??0);
      ng.attr('transform', d=>`translate(${d.x??0},${d.y??0})`);
    });

  _svg.call(_zoom.transform, d3.zoomIdentity);
  _svg.on('click', () => { linkSel.classed('highlighted',false); closePanel(); });
  applyNodeOpacity();
}

// ── Stats ribbon ──────────────────────────────────────────────
function buildStatsRibbon(graph) {
  const leaves  = graph.nodes.filter(n => n.size===1);
  const urgent  = leaves.filter(n => n.priority==='urgent').length;
  const normal  = leaves.filter(n => n.priority==='normal').length;
  const someday = leaves.filter(n => n.priority==='someday').length;
  const minutes = leaves.reduce((s,n) => s+(n.estimatedMinutes||0), 0);
  const cats    = [...new Set(leaves.map(n=>n.category))].length;

  document.getElementById('statsRibbon').innerHTML = `
    <div class="sr-item"><span class="sr-num">${leaves.length}</span><span class="sr-lbl">tasks</span></div>
    <div class="sr-sep"></div>
    <div class="sr-item"><span class="sr-num" style="color:#f97b6b">${urgent}</span><span class="sr-lbl">urgent</span></div>
    <div class="sr-item"><span class="sr-num" style="color:#f5c842">${normal}</span><span class="sr-lbl">normal</span></div>
    <div class="sr-item"><span class="sr-num" style="color:#5c657a">${someday}</span><span class="sr-lbl">someday</span></div>
    <div class="sr-sep"></div>
    <div class="sr-item"><span class="sr-num">${formatTime(minutes)}</span><span class="sr-lbl">total time</span></div>
    <div class="sr-item"><span class="sr-num">${cats}</span><span class="sr-lbl">categories</span></div>
  `;
}

// ── Legend ────────────────────────────────────────────────────
function buildLegend(graph) {
  const cats = [...new Set(graph.nodes.filter(n=>n.size<=2&&n.category!=='root').map(n=>n.category))];
  document.getElementById('legend').innerHTML = cats.map(c => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${catColor(c)}"></div>${c}
    </div>`).join('');
}

// ── Node panel ────────────────────────────────────────────────
function openPanel(nodeData, graph) {
  const related = (graph.links||[]).filter(l => {
    const s = l.source?.id||l.source, t = l.target?.id||l.target;
    return (s===nodeData.id || t===nodeData.id) && l.type==='related';
  });

  const relNodes = related.map(l => {
    const otherId = (l.source?.id||l.source)===nodeData.id ? (l.target?.id||l.target) : (l.source?.id||l.source);
    return graph.nodes.find(n => n.id===otherId);
  }).filter(Boolean);

  document.getElementById('panelDot').style.background = catColor(nodeData.category);
  document.getElementById('panelCategory').textContent = nodeData.category;
  document.getElementById('panelPriority').textContent = nodeData.priority !== 'root' ? nodeData.priority : '';
  document.getElementById('panelPriority').className   = `panel-priority pri-${nodeData.priority}`;
  document.getElementById('panelTitle').textContent    = nodeData.label;

  const tags = [];
  if (nodeData.estimatedMinutes) tags.push('⏱ ' + formatTime(nodeData.estimatedMinutes));
  document.getElementById('panelTags').innerHTML = tags.map(t=>`<span class="ptag">${t}</span>`).join('');

  document.getElementById('panelConnections').textContent =
    relNodes.length ? `Cross-links:` : 'No cross-category connections';

  document.getElementById('panelRelated').innerHTML = relNodes
    .map(n => `<div class="related-node" style="border-left-color:${catColor(n.category)}">
      <span class="rn-cat">${n.category}</span>
      <span class="rn-label">${n.label}</span>
    </div>`).join('');

  document.getElementById('nodePanel').classList.add('open');
}

function closePanel() { document.getElementById('nodePanel').classList.remove('open'); }

// ── Zoom reset ────────────────────────────────────────────────
function resetZoom() {
  if (!_svg||!_zoom) return;
  const t = _view==='mindmap'
    ? d3.zoomIdentity.translate(_width/2, _height/2)
    : d3.zoomIdentity;
  _svg.transition().duration(500).call(_zoom.transform, t);
}

// ── Export SVG ────────────────────────────────────────────────
function exportSVG() {
  const el   = document.getElementById('graphSVG');
  const blob = new Blob([el.outerHTML], { type:'image/svg+xml' });
  const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'mindscape.svg' });
  a.click();
}

// ── Export JSON ───────────────────────────────────────────────
function exportJSON() {
  if (!_graph) return;
  const blob = new Blob([JSON.stringify(_graph, null, 2)], { type:'application/json' });
  const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'mindscape.json' });
  a.click();
}

// ── Helpers ───────────────────────────────────────────────────
function formatTime(m) {
  if (!m) return '';
  if (m < 60) return `${m}m`;
  const h=Math.floor(m/60), rm=m%60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

window.addEventListener('resize', () => { if (_graph) drawGraph(_graph, _view); });