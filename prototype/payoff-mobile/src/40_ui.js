/* =========================================================================
   Layers: popover and sheets (rebuilt from the screenshots)
   ========================================================================= */
const LAYERS = [];
function closeTransient() { if (typeof dismissCoach === 'function') dismissCoach(true); }
function openLayer(inner, { onClose, label = 'Dialog', scrimClose = true, cls = '' } = {}) {
  closeTransient();
  const el = h(`<div class="layer ${cls}" role="dialog" aria-modal="true" aria-label="${label}"><div class="scrim"></div></div>`);
  el.appendChild(inner); app.appendChild(el);
  // a layer that opens on a touch's release sits under the finger, so the click from that same tap would land on it
  // (on its scrim, which closes it). Clicks in its first moments are dropped.
  const t0 = now(); el.addEventListener('click', e => { if (now() - t0 < 350) { e.stopPropagation(); e.preventDefault(); } }, true);
  const layer = { el, close(reason = 'dismissed') { if (layer.closed) return; layer.closed = true; el.classList.remove('in'); const i = LAYERS.indexOf(layer); if (i >= 0) LAYERS.splice(i, 1); setTimeout(() => el.remove(), 260); onClose && onClose(reason); syncDevHints(); } };
  if (scrimClose) $('.scrim', el).addEventListener('click', () => layer.close('scrim'));
  LAYERS.push(layer); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  if (typeof cancelGesture === 'function') cancelGesture('invalid_context');
  return layer;
}
const topLayer = () => LAYERS[LAYERS.length - 1];
function closeAllLayers(reason = 'system') { [...LAYERS].reverse().forEach(l => l.close(reason)); }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && LAYERS.length) { e.preventDefault(); topLayer().close('back'); } });

/* ---- Timeframe popover (screenshot 1) ---- */
function openPopover(id) {
  const tfb = $('.tfb', CH[id].el), pr = rectIn(tfb);
  const right = pr.x + pr.w - 40, width = Math.min(340, right - 8), top = pr.y;
  const tfChips = list => list.map(tf => `<button class="chip${CH[id].tf === tf ? ' on' : ''}" data-tf="${tf}" aria-pressed="${CH[id].tf === tf}">${tf}${CH[id].tf === tf ? ic('check', 14, 2.3) : ''}</button>`).join('');
  const pop = h(`<div class="pop" style="left:${right - width}px;top:${top}px;width:${width}px;height:${L.H - top + 16}px">
    <div class="tiles">
      <button class="tile" data-t="range">${ic('moveH', 16, 2)}<span>Range</span></button>
      <button class="tile" data-t="ind">${ic('fx', 16, 2)}<span>Indicator</span></button>
      <button class="tile" data-t="draw">${ic('pen', 16, 2)}<span>Drawing</span></button>
      <button class="tile" data-t="set">${ic('gear', 16, 2)}<span>Settings</span></button>
    </div><hr>
    <div class="scroll">${TF_GROUPS.map(([g, list], k) => `<div class="sech${k ? '' : ' btn'}"><span>${g}</span>${k ? '' : `<button class="addi">${ic('plus', 18, 1.75)}Add interval</button>`}</div><div class="chips">${tfChips(list)}</div>`).join('')}${quickTfHTML()}<div style="height:24px"></div></div>
  </div>`);
  bindQuickTf(pop);
  tfb.classList.add('active');
  const layer = openLayer(pop, { label: 'Chart menu', onClose: () => tfb.classList.remove('active') });
  pop.addEventListener('click', e => {
    const chip = e.target.closest('.chip'), tile = e.target.closest('.tile');
    if (chip) { layer.close('picked'); setTimeframe(id, chip.dataset.tf, { route: 'popover' }); }
    else if (tile) { const t = tile.dataset.t; layer.close('tile'); setTimeout(() => ({ range: openRange, ind: openIndicators, draw: openDrawing, set: openSettings })[t](id), 60); }
    else if (e.target.closest('.addi')) toast('Custom intervals are not part of this prototype');
  });
  return layer;
}

/* ---- Settings sheet (screenshot 2) ---- */
const CTYPES = [['line', 'Line', 'ct_line'], ['step', 'Step Line', 'ct_step'], ['area', 'Area', 'ct_area'], ['candle', 'Candle', 'ct_candle'], ['ha', 'Heikin Ashi', 'ct_ha'], ['hollow', 'Hollow Candle', 'ct_hollow'], ['renko', 'Renko', 'ct_renko']];
function openSettings(id, tab = 0) {
  const c = CH[id];
  const sh = h(`<div class="sheet" style="height:${Math.round(L.H * .6318)}px">
    <div class="sh-title">Settings</div><button class="sh-x" aria-label="Close">${ic('x', 18, 1.7)}</button>
    <div class="tabs" role="tablist"><button class="tab" role="tab" data-k="0">Chart type</button><button class="tab" role="tab" data-k="1">Customize</button><button class="tab" role="tab" data-k="2">View on chart</button></div>
    <div class="tabpane"></div>
    <button class="sharebtn">${ic('share', 16, 1.9)}Share chart picture</button>
  </div>`);
  const pane = $('.tabpane', sh);
  const render = k => {
    $$('.tab', sh).forEach(t => { const on = +t.dataset.k === k; t.classList.toggle('on', on); t.setAttribute('aria-selected', on); });
    if (k === 0) pane.innerHTML = `<div class="ctgrid">${CTYPES.map(([key, name, icn]) => `<button class="ctrow" data-ct="${key}" role="radio" aria-checked="${c.type === key}"><span class="ci">${ic(icn, 24, 1.7)}</span><span class="lbl">${name}</span><span class="radio${c.type === key ? ' on' : ''}"></span></button>`).join('')}</div>`;
    else if (k === 1) pane.innerHTML = `<div style="height:8px"></div>${[['legend', 'Indicator values'], ['wm', 'Sahi watermark']].map(([o, n]) => `<button class="setrow" data-o="${o}" style="width:100%"><span>${n}</span><span class="tog${c.opts[o] ? ' on' : ''}"></span></button>`).join('')}`;
    else pane.innerHTML = `<div style="height:8px"></div>${[['breaks', 'Session breaks'], ['hilo', 'High and low labels'], ['pline', 'Last price line']].map(([o, n]) => `<button class="setrow" data-o="${o}" style="width:100%"><span>${n}</span><span class="tog${c.opts[o] ? ' on' : ''}"></span></button>`).join('')}`;
    pane._k = k;
  };
  render(tab);
  const layer = openLayer(sh, { label: 'Settings' });
  sh.addEventListener('click', e => {
    if (e.target.closest('.sh-x')) return layer.close('close');
    const t = e.target.closest('.tab'); if (t) return render(+t.dataset.k);
    const ct = e.target.closest('.ctrow'); if (ct) { c.type = ct.dataset.ct; c._rk = null; render(0); redraw(id); track('chart_type', { chart: id, type: c.type }); return; }
    const o = e.target.closest('.setrow'); if (o) { c.opts[o.dataset.o] = !c.opts[o.dataset.o]; render(pane._k); placeChrome(); updateHeaders(); redraw(id); return; }
    if (e.target.closest('.sharebtn')) toast('Sharing is not part of this prototype');
  });
}

/* ---- Add indicators sheet (screenshot 3) ---- */
const IND_LIST = [
  { n: 'Expected Move', only: true, cat: 'main' }, { k: 'kl', n: 'Key Levels', only: true, cat: 'main' }, { n: 'Max Pain', only: true, cat: 'main' }, { n: 'OI Profile', only: true, cat: 'main' }, { n: 'OI Resistance', only: true, cat: 'main' }, { n: 'OI Support', only: true, cat: 'main' },
  { n: 'Lite Zones & 34 EMA Band', by: 'Animesh Kumar', cat: 'main' }, { n: 'Pushkar Premium Trend', by: 'Pushkar Raj Thakur', cat: 'main' }, { n: 'RizeX Lite', by: 'Animesh Kumar', cat: 'main' }, { n: '52 Week High/Low (52W H/L)', cat: 'main' },
  { n: 'Accumulation/Distribution', cat: 'sub' }, { n: 'Adaptive SuperTrend (AS)', cat: 'main' }, { n: 'Advance/Decline Ratio', cat: 'sub' }, { n: 'Arnaud Legoux Moving Average (ALMA)', cat: 'main' }, { n: 'Aroon', cat: 'sub' },
  { n: 'Auto Fib Extension', cat: 'main' }, { n: 'Average Directional Index (ADX)', cat: 'sub' }, { n: 'Average True Range (ATR)', cat: 'sub' }, { n: 'Awesome Oscillator (AO)', cat: 'sub' }, { n: 'Balance of Power (BOP)', cat: 'sub' },
  { k: 'bb', n: 'Bollinger Bands (BB)', cat: 'main' }, { n: 'Bollinger Bands %B', cat: 'sub' }, { n: 'Chaikin Money Flow (CMF)', cat: 'sub' }, { n: 'Commodity Channel Index (CCI)', cat: 'sub' }, { n: 'Donchian Channels (DC)', cat: 'main' },
  { k: 'ema', n: 'Exponential Moving Average (EMA)', cat: 'main' }, { n: 'Ichimoku Cloud', cat: 'main' }, { n: 'Keltner Channels (KC)', cat: 'main' }, { n: 'MACD', cat: 'sub' }, { n: 'Money Flow Index (MFI)', cat: 'sub' },
  { n: 'On Balance Volume (OBV)', cat: 'sub' }, { n: 'Parabolic SAR', cat: 'main' }, { n: 'Pivot Points Standard', cat: 'main' }, { n: 'Relative Strength Index (RSI)', cat: 'sub' }, { k: 'sma', n: 'Simple Moving Average (SMA)', cat: 'main' },
  { n: 'Stochastic', cat: 'sub' }, { n: 'Stochastic RSI', cat: 'sub' }, { n: 'Supertrend', cat: 'main' }, { n: 'Volume', cat: 'sub' }, { k: 'vwap', n: 'Volume Weighted Average Price (VWAP)', cat: 'main' }, { n: 'Williams %R', cat: 'sub' },
];
function openIndicators(id) {
  const c = CH[id];
  const sh = h(`<div class="sheet" style="top:${L.sat + 16}px">
    <div class="ih"><h3>Add indicators</h3><button class="tpl">${ic('grid', 16, 1.9)}My Templates</button><i class="vs"></i><button class="sh-x" aria-label="Close">${ic('x', 18, 1.7)}</button></div>
    <label class="srch">${ic('search', 18, 1.6)}<input type="search" placeholder="Search" aria-label="Search indicators"></label>
    <div class="itabs" role="tablist"><button class="tab on" data-cat="all">All · 147</button><button class="tab" data-cat="main">Main chart · 66</button><button class="tab" data-cat="sub">Sub chart · 55</button><button class="tab" data-cat="ai">AI based · 21</button></div>
    <div class="ilist" role="list"></div>
  </div>`);
  let cat = 'all', q = '';
  const stars = sstore.get('stars', {}), list = picksFirst(IND_LIST, QV.inds.slice(), indKey);
  const render = () => {
    const rows = list.filter(x => (cat === 'all' || x.cat === cat) && x.n.toLowerCase().includes(q));
    $('.ilist', sh).innerHTML = (cat === 'ai' ? '<div class="secl" style="margin:24px 16px">AI-based indicators are not part of this prototype.</div>' : '') + rows.map(x => {
      const on = x.k && c.ind[x.k];
      return `<div class="irow${x.by ? ' two' : ''}${on ? ' on' : ''}" role="listitem"><button class="add" data-n="${x.n}" aria-label="${on ? 'Remove' : 'Add'} ${x.n}">${on ? ic('check', 9, 3.4) : ic('plus', 9, 3.4)}</button><div class="nm"><div class="t1">${x.n}${x.only ? '<span class="only">Only on SAHI</span>' : ''}</div>${x.by ? `<div class="t2">By ${x.by}</div>` : ''}</div>${on ? '<span class="onlbl">On chart</span>' : ''}${flashBtn('inds', indKey(x), x.n)}<button class="stb" data-s="${x.n}" aria-label="Favourite ${x.n}"><svg class="ico st${stars[x.n] ? ' on' : ''}" width="16" height="16" viewBox="0 0 24 24" stroke-width="1.9">${P.star}</svg></button></div>`;
    }).join('');
  };
  render();
  const layer = openLayer(sh, { label: 'Add indicators' });
  $('input', sh).addEventListener('input', e => { q = e.target.value.trim().toLowerCase(); render(); });
  sh.addEventListener('click', e => {
    if (e.target.closest('.sh-x')) return layer.close('close');
    if (e.target.closest('.tpl')) return openTemplates(id);
    if (flashClick(e, render)) return;
    const t = e.target.closest('.itabs .tab'); if (t) { cat = t.dataset.cat; $$('.itabs .tab', sh).forEach(x => x.classList.toggle('on', x === t)); render(); return; }
    const s = e.target.closest('.stb'); if (s) { stars[s.dataset.s] = !stars[s.dataset.s]; sstore.set('stars', stars); render(); return; }
    const a = e.target.closest('.add'); if (a) {
      const x = IND_LIST.find(i => i.n === a.dataset.n);
      if (!x.k) return toast(`${x.n} is not drawn in this prototype`);
      c.ind[x.k] = !c.ind[x.k]; updateHeaders(); redraw(id); render();
      toast(`${IND[x.k].name} ${c.ind[x.k] ? 'added to' : 'removed from'} ${c.short}`, true);
      track('indicator_sheet', { chart: id, ind: x.k, on: c.ind[x.k] });
    }
  });
}

/* ---- Range sheet and drawing toolbar (not in the screenshots: built in the same style) ---- */
function openRange(id) {
  const R = [['1D', '1m', 5.6], ['5D', '5m', 1.5], ['1M', '30m', 1.4], ['3M', '1h', 1], ['6M', '1D', 2.4], ['YTD', '1D', 1.6], ['1Y', '1D', 1.3], ['5Y', '1W', 1.3], ['All', '1M', 6]];
  const sh = h(`<div class="sheet"><div class="sh-title">Range</div><button class="sh-x" aria-label="Close">${ic('x', 18, 1.7)}</button><div class="rgrid">${R.map(([r]) => `<button class="chip" data-r="${r}">${r}</button>`).join('')}</div><div style="height:calc(20px + var(--sab))"></div></div>`);
  const layer = openLayer(sh, { label: 'Range' });
  sh.addEventListener('click', e => {
    if (e.target.closest('.sh-x')) return layer.close('close');
    const b = e.target.closest('[data-r]'); if (!b) return;
    const [r, tf, sp] = R.find(x => x[0] === b.dataset.r); layer.close('picked');
    CH[id].spacing = sp; CH[id].ro = 2; setTimeframe(id, tf, { route: 'range', silent: true }); toast(`${CH[id].short}: showing ${r}`);
  });
}
const TOOLS = [['trend', 'trend', 'Trend line'], ['hline', 'hline', 'Horizontal line'], ['fib', 'fib', 'Fib retracement'], ['rect', 'rect', 'Rectangle']];
function openDrawToolbar(id) {
  const c = CH[id], el = c.el;
  $$('.dtool').forEach(x => x.remove());
  const bar = h(`<div class="dtool" style="top:${L.cards[id].y + 56}px">${TOOLS.map(([k, icn, n]) => `<button data-tool="${k}" aria-label="${n}" class="${c.draft && c.draft.tool === k ? 'on' : ''}">${ic(icn, 20, 1.8)}</button>`).join('')}<button data-tool="clear" aria-label="Remove drawings">${ic('trash', 19, 1.8)}</button><span class="dsp"></span><button data-tool="close" aria-label="Close drawing tools">${ic('x', 18, 2)}</button></div>`);
  app.appendChild(bar);
  bar.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const t = b.dataset.tool;
    if (t === 'close') { bar.remove(); disarm(id); if (S.draw) S.draw.toolbar = false; return; }
    if (t === 'clear') { c.draws = []; redraw(id); toast(`Drawings removed from ${c.short}`); return; }
    armTool(id, t, { route: 'toolbar' }); $$('button', bar).forEach(x => x.classList.toggle('on', x === b));
  });
}

/* =========================================================================
   Chart actions (one path for the popover, the sheets and the quick action panel)
   ========================================================================= */
function setTimeframe(id, tf, meta = {}) {
  const ids = S.linked ? CHART_IDS : [id];
  for (const k of ids) { const c = CH[k]; if (c.tf === tf) continue; c.tf = tf; c.ys = null; c.cross = null; c._ic = {}; if (TF[tf] >= 1440) c.ro = 3; redraw(k); }
  updateHeaders();
  if (!meta.silent) toast(`${ids.map(k => CH[k].short).join(' and ')} switched to ${tf}`, true);
  track('timeframe', { chart: id, tf, linked: S.linked, route: meta.route || 'popover' });
}
function toggleIndicator(id, k, meta = {}) {
  const c = CH[id]; c.ind[k] = !c.ind[k]; updateHeaders(); redraw(id);
  if (!meta.silent) toast(`${IND[k].name} turned ${c.ind[k] ? 'on' : 'off'} for ${c.short}`, true);
  return c.ind[k];
}
function armTool(id, tool, meta = {}) {
  for (const k of CHART_IDS) if (k !== id && CH[k].draft) disarm(k);
  CH[id].draft = { tool, pts: [], hover: null }; updateHeaders(); redraw(id);
  if (meta.route !== 'toolbar') toast(tool === 'hline' ? `Horizontal line: tap a level on ${CH[id].short}` : `${tool === 'fib' ? 'Fib retracement' : tool === 'rect' ? 'Rectangle' : 'Trend line'}: tap two points on ${CH[id].short}`, true);
}
function disarm(id) { const c = CH[id]; if (!c.draft) return; c.draft = null; updateHeaders(); redraw(id); }
function placePoint(id, p) {
  const c = CH[id], d = c.draft; if (!d) return;
  d.pts.push(p);
  const need = d.tool === 'hline' ? 1 : 2;
  if (d.pts.length >= need) { c.draws.push({ tool: d.tool, a: d.pts[0], b: d.pts[1] || d.pts[0] }); c.draft = null; track('drawing_done', { chart: id, tool: d.tool }); toast('Drawing placed', true); }
  updateHeaders(); redraw(id);
}

/* =========================================================================
   Pointer plumbing: app-space coordinates, regions of a chart card
   ========================================================================= */
function appScale() { const r = app.getBoundingClientRect(); return r.width / app.offsetWidth || 1; }
function appPt(e) { const r = app.getBoundingClientRect(), s = r.width / app.offsetWidth || 1; return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s }; }
function rectIn(el) { const a = app.getBoundingClientRect(), b = el.getBoundingClientRect(), s = a.width / app.offsetWidth || 1; return { x: (b.left - a.left) / s, y: (b.top - a.top) / s, w: b.width / s, h: b.height / s }; }
function regionAt(id, p) {
  const r = L.cards[id], g = CH[id].g; if (!g) return 'pane';
  const x = p.x - r.x, y = p.y - r.y;
  if (y < r.paneT) return 'header';
  if (x >= g.paneR - 2) return y >= r.paneB ? 'corner' : 'axis';
  if (y >= r.paneB) return 'taxis';
  return 'pane';
}
