// ─── graph.js ─────────────────────────────────────────────────
// D3 v7 — Mind map (radial tree) + Force cluster
// Fixes: node visibility in both light/dark modes, theme-aware colors

const COLORS = {
  root:     { dark: '#ffffff', light: '#1a1a2e' },
  work:     { dark: '#a78bfa', light: '#5b21b6' },
  personal: { dark: '#fb923c', light: '#c2410c' },
  health:   { dark: '#34d399', light: '#065f46' },
  finance:  { dark: '#fbbf24', light: '#92400e' },
  study:    { dark: '#38bdf8', light: '#0369a1' },
  other:    { dark: '#e879f9', light: '#86198f' },
};

function catColor(cat) {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  return (COLORS[cat] || COLORS.other)[theme];
}

// Node sizes
function nodeR(d)        { return d.size === 3 ? 34 : d.size === 2 ? 22 : 11; }
function nodeFontSize(d) { return d.size === 3 ? 13 : d.size === 2 ? 11 : 9; }

function wrapLabel(text, maxChars) {
  if (text.length <= maxChars) return [text];
  const words = text.split(' ');
  const lines = []; let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars) { if (line) lines.push(line.trim()); line = w; }
    else line = (line + ' ' + w).trim();
  }
  if (line) lines.push(line.trim());
  return lines.slice(0, 3);
}

// ── State ──────────────────────────────────────────────────────
window._graph = null;
let _view = 'mindmap', _svg = null, _g = null;
let _zoom = null, _sim = null, _width = 0, _height = 0;
let _searchTerm = '', _priorityFilter = 'all';

// ── Init canvas ────────────────────────────────────────────────
function initCanvas() {
  const svgEl = document.getElementById('graphSVG');
  _width  = svgEl.clientWidth  || window.innerWidth;
  _height = svgEl.clientHeight || (window.innerHeight - 56);
  d3.select(svgEl).selectAll('*').remove();
  _svg = d3.select(svgEl);
  _svg.append('defs').append('marker')
    .attr('id','arr-rel').attr('viewBox','0 0 8 8')
    .attr('refX',8).attr('refY',4).attr('markerWidth',5).attr('markerHeight',5)
    .attr('orient','auto').append('path').attr('d','M0,0 L8,4 L0,8')
    .attr('fill','none').attr('stroke','rgba(128,128,128,0.4)').attr('stroke-width',1.2);
  _zoom = d3.zoom().scaleExtent([0.15, 5])
    .on('zoom', e => _g.attr('transform', e.transform));
  _svg.call(_zoom);
  _g = _svg.append('g');
}

// ── Public API ─────────────────────────────────────────────────
function drawGraph(graph, view) {
  window._graph = graph; _view = view || _view;
  buildLegend(graph); buildStatsRibbon(graph);
  initCanvas();
  _view === 'mindmap' ? drawMindmap() : drawCluster();
}

function switchView(view) {
  _view = view;
  document.getElementById('tabMindmap').classList.toggle('active', view === 'mindmap');
  document.getElementById('tabCluster').classList.toggle('active', view === 'cluster');
  if (!window._graph) return;
  if (_sim) { _sim.stop(); _sim = null; }
  initCanvas();
  _view === 'mindmap' ? drawMindmap() : drawCluster();
}

// ── Theme redraw ───────────────────────────────────────────────
function redrawForTheme() {
  if (!window._graph) return;
  initCanvas();
  _view === 'mindmap' ? drawMindmap() : drawCluster();
}

// ── Search ─────────────────────────────────────────────────────
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
    const ms = !_searchTerm || data.label.toLowerCase().includes(_searchTerm);
    const mp = _priorityFilter === 'all' || data.priority === _priorityFilter || data.size > 1;
    d3.select(this).transition().duration(180).attr('opacity', (ms && mp) ? 1 : 0.08);
  });
  _g.selectAll('.link').each(function(d) {
    const s = d.source?.data || d.source, t = d.target?.data || d.target;
    const sm = !_searchTerm || s.label?.toLowerCase().includes(_searchTerm);
    const tm = !_searchTerm || t.label?.toLowerCase().includes(_searchTerm);
    d3.select(this).transition().duration(180).attr('opacity', (sm || tm) ? 1 : 0.04);
  });
}

function setPriorityFilter(p, btn) {
  _priorityFilter = p;
  document.querySelectorAll('.pf-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyNodeOpacity();
}

// ── NODE RENDERING helper ──────────────────────────────────────
// This is the fix: solid filled circles with border stroke, 
// text always contrasted. No more invisible 0.15 opacity fills.
function renderNode(sel) {
  const theme = document.documentElement.getAttribute('data-theme') || 'dark';
  const isDark = theme === 'dark';

  // Glow ring for urgent leaf nodes only
  sel.filter(d => {
    const dd = d.data || d;
    return dd.priority === 'urgent' && dd.size === 1;
  }).append('circle')
    .attr('class','node-glow')
    .attr('r', d => nodeR(d.data || d) + 10)
    .attr('fill', d => catColor((d.data||d).category))
    .attr('opacity', isDark ? 0.15 : 0.12);

  // Main circle — solid enough to always be visible
  sel.append('circle')
    .attr('class','node-circle')
    .attr('r', d => nodeR(d.data || d))
    .attr('fill', d => {
      const dd = d.data || d;
      // Root: always opaque
      if (dd.size === 3) return isDark ? '#1e1b4b' : '#ede9fe';
      // Category: semi-solid
      if (dd.size === 2) return isDark ? `${catColor(dd.category)}22` : `${catColor(dd.category)}18`;
      // Leaf: visible solid-ish fill
      return isDark ? `${catColor(dd.category)}30` : `${catColor(dd.category)}20`;
    })
    .attr('stroke', d => catColor((d.data||d).category))
    .attr('stroke-width', d => {
      const s = (d.data||d).size;
      return s === 3 ? 2 : s === 2 ? 1.8 : 1.5;
    });

  // Labels — always full opacity, color matches stroke
  sel.each(function(d) {
    const dd    = d.data || d;
    const maxC  = dd.size === 3 ? 11 : dd.size === 2 ? 9 : 13;
    const lines = wrapLabel(dd.label, maxC);
    const fs    = nodeFontSize(dd);
    const lh    = fs + 3.5;
    const oy    = -(lines.length - 1) * lh / 2;
    const g     = d3.select(this);
    // Text shadow/halo for legibility in both modes
    lines.forEach((line, i) => {
      // Halo (outline trick)
      g.append('text')
        .attr('class','node-label-halo')
        .attr('y', oy + i * lh)
        .attr('font-size', fs)
        .attr('font-weight', dd.size > 1 ? 600 : 500)
        .attr('fill', isDark ? '#0b0c10' : '#ffffff')
        .attr('stroke', isDark ? '#0b0c10' : '#ffffff')
        .attr('stroke-width', 3)
        .attr('paint-order','stroke')
        .attr('text-anchor','middle')
        .attr('dominant-baseline','central')
        .text(line);
      // Actual text
      g.append('text')
        .attr('class','node-label')
        .attr('y', oy + i * lh)
        .attr('font-size', fs)
        .attr('font-weight', dd.size > 1 ? 600 : 500)
        .attr('fill', catColor(dd.category))
        .attr('text-anchor','middle')
        .attr('dominant-baseline','central')
        .text(line);
    });
  });
}

// ── MIND MAP ──────────────────────────────────────────────────
function drawMindmap() {
  if (!window._graph) return;
  const nodeMap = {};
  window._graph.nodes.forEach(n => { nodeMap[n.id] = { ...n, children: [] }; });
  window._graph.links.filter(l => l.type === 'hierarchy').forEach(l => {
    const s = nodeMap[l.source?.id||l.source], t = nodeMap[l.target?.id||l.target];
    if (s && t && s !== t) s.children.push(t);
  });
  const rootNode = nodeMap['root'] || Object.values(nodeMap)[0];
  const r = Math.min(_width, _height) * 0.42;
  const hier = d3.hierarchy(rootNode, d => d.collapsed ? [] : d.children);
  const root = d3.tree().size([2*Math.PI, r])
    .separation((a,b) => (a.parent===b.parent ? 1.2 : 2) / a.depth)(hier);

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const linkColor = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.12)';

  // Links
  const ll = _g.append('g');
  ll.selectAll('.link').data(root.links()).join('path')
    .attr('class','link').attr('stroke', linkColor)
    .attr('d', d3.linkRadial().angle(d=>d.x).radius(d=>d.y));

  // Related links
  const rel = window._graph.links.filter(l => l.type==='related');
  if (rel.length) {
    const pm = {};
    root.each(d => { pm[d.data.id] = d; });
    ll.selectAll('.link-rel').data(rel).join('line')
      .attr('class','link link-rel').attr('stroke-dasharray','4 3')
      .attr('stroke', isDark?'rgba(255,255,255,0.2)':'rgba(0,0,0,0.2)')
      .attr('marker-end','url(#arr-rel)')
      .attr('x1',d=>{const n=pm[d.source?.id||d.source];return n?n.y*Math.sin(n.x):0;})
      .attr('y1',d=>{const n=pm[d.source?.id||d.source];return n?-n.y*Math.cos(n.x):0;})
      .attr('x2',d=>{const n=pm[d.target?.id||d.target];return n?n.y*Math.sin(n.x):0;})
      .attr('y2',d=>{const n=pm[d.target?.id||d.target];return n?-n.y*Math.cos(n.x):0;});
  }

  // Nodes
  const ng = _g.append('g').selectAll('.node-group')
    .data(root.descendants()).join('g')
    .attr('class', d => `node-group${d.data.collapsed?' collapsed':''}`)
    .attr('transform', d => `translate(${d.y*Math.sin(d.x)},${-d.y*Math.cos(d.x)})`)
    .style('cursor','pointer')
    .on('click', (e, d) => {
      e.stopPropagation();
      if (d.data.size === 1) { openPanel(d.data, window._graph); return; }
      d.data.collapsed = !d.data.collapsed;
      drawMindmap();
    });

  renderNode(ng);
  _svg.call(_zoom.transform, d3.zoomIdentity.translate(_width/2, _height/2));
  applyNodeOpacity();
}

// ── CLUSTER ───────────────────────────────────────────────────
function drawCluster() {
  if (!window._graph) return;
  const nodes = window._graph.nodes.map(n => ({...n}));
  const links = window._graph.links.map(l => ({
    source: l.source?.id||l.source, target: l.target?.id||l.target, type: l.type,
  }));

  const cats  = [...new Set(nodes.filter(n=>n.size===2).map(n=>n.category))];
  const clR   = Math.min(_width,_height) * 0.28;
  const centers = {};
  cats.forEach((c,i) => {
    const a = (2*Math.PI/cats.length)*i - Math.PI/2;
    centers[c] = { x: _width/2 + clR*Math.cos(a), y: _height/2 + clR*Math.sin(a) };
  });

  nodes.forEach(n => {
    if (n.id==='root') { n.x=_width/2; n.y=_height/2; n.fx=_width/2; n.fy=_height/2; return; }
    if (n.size===2 && centers[n.category]) { n.x=centers[n.category].x; n.y=centers[n.category].y; return; }
    const c = centers[n.category];
    n.x=(c?.x||_width/2)+(Math.random()-.5)*60;
    n.y=(c?.y||_height/2)+(Math.random()-.5)*60;
  });

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const linkColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';

  const ll = _g.append('g');
  const linkSel = ll.selectAll('.link').data(links).join('line')
    .attr('class', d => `link${d.type==='related'?' link-rel':''}`)
    .attr('stroke', linkColor)
    .attr('stroke-dasharray', d => d.type==='related'?'4 3':null)
    .attr('marker-end', d => d.type==='related'?'url(#arr-rel)':null);

  const drag = d3.drag()
    .on('start', (e,d) => { if(!e.active) _sim.alphaTarget(0.2).restart(); d.fx=d.x; d.fy=d.y; })
    .on('drag',  (e,d) => { d.fx=e.x; d.fy=e.y; })
    .on('end',   (e,d) => { if(!e.active) _sim.alphaTarget(0); if(d.id!=='root'){d.fx=null;d.fy=null;} });

  const ng = _g.append('g').selectAll('.node-group')
    .data(nodes).join('g').attr('class','node-group')
    .call(drag)
    .on('click', (e, d) => {
      e.stopPropagation();
      openPanel(d, window._graph);
      linkSel.classed('highlighted', l =>
        (l.source?.id||l.source)===d.id || (l.target?.id||l.target)===d.id
      );
    });

  renderNode(ng);

  _sim = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links).id(d=>d.id)
      .distance(d => (d.source?.id||d.source)==='root' ? 160 : 70).strength(0.5))
    .force('charge', d3.forceManyBody().strength(d => d.size===1?-140:d.size===2?-300:-450))
    .force('center', d3.forceCenter(_width/2,_height/2).strength(0.04))
    .force('collision', d3.forceCollide().radius(d => nodeR(d)+16))
    .force('cluster', alpha => {
      nodes.forEach(n => {
        if (n.size!==1) return;
        const c = centers[n.category]; if(!c) return;
        n.vx += (c.x-n.x)*0.02*alpha;
        n.vy += (c.y-n.y)*0.02*alpha;
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

// ── Stats ribbon ───────────────────────────────────────────────
function buildStatsRibbon(graph) {
  const leaves  = graph.nodes.filter(n => n.size===1);
  const urgent  = leaves.filter(n => n.priority==='urgent').length;
  const normal  = leaves.filter(n => n.priority==='normal').length;
  const someday = leaves.filter(n => n.priority==='someday').length;
  const minutes = leaves.reduce((s,n) => s+(n.estimatedMinutes||0), 0);

  function fmt(m) {
    if (!m) return '—';
    if (m < 60) return `${m}m`;
    const h=Math.floor(m/60), r=m%60;
    return r ? `${h}h ${r}m` : `${h}h`;
  }

  document.getElementById('statsRibbon').innerHTML = `
    <div class="sr-header">${graph.title || 'Your thoughts'}</div>
    <div class="sr-row">
      <div class="sr-pill sr-total">
        <span class="sr-n">${leaves.length}</span>
        <span class="sr-l">tasks</span>
      </div>
      <div class="sr-pill sr-urgent">
        <span class="sr-dot"></span>
        <span class="sr-n">${urgent}</span>
        <span class="sr-l">urgent</span>
      </div>
      <div class="sr-pill sr-normal">
        <span class="sr-dot"></span>
        <span class="sr-n">${normal}</span>
        <span class="sr-l">normal</span>
      </div>
      <div class="sr-pill sr-someday">
        <span class="sr-dot"></span>
        <span class="sr-n">${someday}</span>
        <span class="sr-l">someday</span>
      </div>
      <div class="sr-pill sr-time">
        <span class="sr-n">${fmt(minutes)}</span>
        <span class="sr-l">est. total</span>
      </div>
    </div>`;
}

// ── Legend ─────────────────────────────────────────────────────
function buildLegend(graph) {
  const cats = [...new Set(graph.nodes.filter(n=>n.size<=2&&n.category!=='root').map(n=>n.category))];
  document.getElementById('legend').innerHTML = cats.map(c => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${catColor(c)}"></div>${c}
    </div>`).join('');
}

// ── Panel ──────────────────────────────────────────────────────
function openPanel(nodeData, graph) {
  const related = (graph.links||[]).filter(l => {
    const s=l.source?.id||l.source, t=l.target?.id||l.target;
    return (s===nodeData.id||t===nodeData.id) && l.type==='related';
  });
  const relNodes = related.map(l => {
    const oid = (l.source?.id||l.source)===nodeData.id?(l.target?.id||l.target):(l.source?.id||l.source);
    return graph.nodes.find(n=>n.id===oid);
  }).filter(Boolean);

  document.getElementById('panelDot').style.background       = catColor(nodeData.category);
  document.getElementById('panelCategory').textContent       = nodeData.category;
  document.getElementById('panelPriority').textContent       = nodeData.priority!=='root'?nodeData.priority:'';
  document.getElementById('panelPriority').className         = `panel-priority pri-${nodeData.priority}`;
  document.getElementById('panelTitle').textContent          = nodeData.label;
  document.getElementById('panelTags').innerHTML             =
    nodeData.estimatedMinutes ? `<span class="ptag">⏱ ${fmt(nodeData.estimatedMinutes)}</span>` : '';
  document.getElementById('panelConnections').textContent    = relNodes.length ? 'Cross-links:' : 'No cross-category connections';
  document.getElementById('panelRelated').innerHTML          = relNodes.map(n=>`
    <div class="related-node" style="border-left-color:${catColor(n.category)}">
      <span class="rn-cat">${n.category}</span>
      <span class="rn-label">${n.label}</span>
    </div>`).join('');
  document.getElementById('nodePanel').classList.add('open');
}

function fmt(m) {
  if (!m) return '';
  if (m<60) return `${m}m`;
  const h=Math.floor(m/60),r=m%60;
  return r?`${h}h ${r}m`:`${h}h`;
}

function closePanel() { document.getElementById('nodePanel').classList.remove('open'); }
function resetZoom() {
  if (!_svg||!_zoom) return;
  const t = _view==='mindmap'
    ? d3.zoomIdentity.translate(_width/2,_height/2)
    : d3.zoomIdentity;
  _svg.transition().duration(500).call(_zoom.transform, t);
}
function exportSVG() {
  const blob = new Blob([document.getElementById('graphSVG').outerHTML],{type:'image/svg+xml'});
  Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:'mindscape.svg'}).click();
}
function exportJSON() {
  if (!window._graph) return;
  const blob = new Blob([JSON.stringify(window._graph,null,2)],{type:'application/json'});
  Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:'mindscape.json'}).click();
}

window.addEventListener('resize', () => { if (window._graph) drawGraph(window._graph, _view); });