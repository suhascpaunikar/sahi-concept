/* =========================================================================
   Chart gestures: pan, pinch, crosshair (long-press), axis scale, split
   ========================================================================= */
function startDrag(e, el, drag) {
  if (G.st !== 'idle' || !drag) return;
  Object.assign(G, { st: 'drag', pid: e.pointerId, el, drag, region: 'drag', last: appPt(e) });
  try { el.setPointerCapture(e.pointerId); } catch {}
}
function tapTracker(e, onTap) {
  const p0 = appPt(e), pid = e.pointerId;
  const up = ev => { if (ev.pointerId !== pid) return; done(); const p = appPt(ev); if (hyp(p.x - p0.x, p.y - p0.y) < SLOP) onTap(); };
  const cancel = ev => { if (ev.pointerId === pid) done(); };
  const done = () => { window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', cancel, true); };
  window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', cancel, true);
}
function axisDrag(id, start) {
  const c = CH[id], g = c.g; if (!g) return null;
  const hi0 = g.y2p(g.pT), lo0 = g.y2p(g.pB);
  track('axis_drag', { chart: id });
  return { move(p) { const f = Math.exp((p.y - start.y) * .006), mid = (hi0 + lo0) / 2, half = (hi0 - lo0) / 2 * f; c.ys = { hi: mid + half, lo: mid - half }; redraw(id); }, end() {} };
}
function timeAxisDrag(id, start) {
  const c = CH[id], sp0 = c.spacing;
  return { move(p) { c.spacing = clamp(sp0 * Math.exp((p.x - start.x) * .008), 1.2, 48); redraw(id); }, end() {} };
}
function splitDrag(start) {
  const s0 = S.split, cardTop = L.cards.idx.y, avail = L.cards.idx.h + L.cards.opt.h;
  track('split_drag', {});
  return { move(p) { S.split = clamp(s0 + (p.y - start.y) / avail, .3, .7); relayout(); }, end() {} };
}
let lastAxisTap = 0;
function bindCard(id) {
  const c = CH[id], el = c.el, cv = c.cv, tfb = $('.tfb', el);
  tfb.addEventListener('pointerdown', e => {
    if (e.button !== 0 || LAYERS.length || G.st !== 'idle') return;
    e.preventDefault(); S.focus = id; syncFocus();
    if (claims('pill')) startHold(e, 'pill', id, tfb, { tap: () => openPopover(id), early: null });
    else tapTracker(e, () => openPopover(id));
  });
  tfb.addEventListener('click', e => { if (e.detail === 0) openPopover(id); });
  $('.sym', el).addEventListener('click', () => toast('Symbol search is not part of this prototype'));
  const lk = $('.lnk', el); if (lk) lk.addEventListener('click', () => { toast('The option chain is not part of this prototype'); track('option_chain', {}); });   // in the Sahi app this button opens the option chain
  $('.banner button', el).addEventListener('click', () => { disarm(id); $$('.dtool').forEach(x => x.remove()); });
  // canvas regions
  const P0 = new Map(); let mode = null, lp = 0, start = null, ro0 = 0, sp0 = 0, d0 = 0, moved = false;
  const cardPt = p => ({ x: p.x - L.cards[id].x, y: p.y - L.cards[id].y });
  // Payoff: holding the point near a side edge of the index chart scrolls the chart under it, so later sessions and
  // the expiry are reached in the same drag. It stops when the end of the future zone, or Now, is in view.
  let edgeQ = null, edgeRAF = 0;
  const edgeStep = () => {
    edgeRAF = 0; const g = c.g;
    if (id !== 'idx' || !PM.on || !edgeQ || !g || (mode !== 'ptdrag' && mode !== 'cross')) { edgeQ = null; return; }
    const m = 34, end = poAxisEnd(), over = edgeQ.x > g.paneR - m ? edgeQ.x - (g.paneR - m) : edgeQ.x < m ? edgeQ.x - m : 0;
    const room = over > 0 ? end != null && xAtT(g, end) > g.paneR - m : over < 0 && xAtT(g, MK.nowT()) < m;
    if (!room) { edgeQ = null; return; }
    c.ro += clamp(over / m, -1, 1) * 7 / g.s; c.g = geomOf('idx');
    const pt = pointFromXY(edgeQ); if (pt && PM.pt && (pt.T !== PM.pt.T || pt.S !== PM.pt.S)) setPoint(pt, 'drag', { quiet: true });
    redraw('idx'); edgeRAF = requestAnimationFrame(edgeStep);
  };
  const edgeFrom = q => { edgeQ = q; if (!edgeRAF) edgeRAF = requestAnimationFrame(edgeStep); };
  cv.addEventListener('pointerdown', e => {
    if (e.button !== 0 || LAYERS.length) return;
    const p = appPt(e), reg = regionAt(id, p);
    if (G.st !== 'idle') return;
    S.focus = id; syncFocus();
    if (reg === 'axis') {
      const t = now(); if (t - lastAxisTap < 300) { c.ys = null; redraw(id); lastAxisTap = 0; return; } lastAxisTap = t;
      if (claims('axis')) startHold(e, 'axis', id, cv, { early: st => axisDrag(id, st) }); else startDrag(e, cv, axisDrag(id, p));
      return;
    }
    if (reg === 'corner') { if (claims('corner')) startHold(e, 'corner', id, cv, { early: null }); return; }
    if (reg === 'taxis') { startDrag(e, cv, timeAxisDrag(id, p)); return; }
    if (reg !== 'pane') return;
    P0.set(e.pointerId, p); try { cv.setPointerCapture(e.pointerId); } catch {}
    if (P0.size === 1) {
      mode = 'pending'; start = p; ro0 = c.ro; moved = false;
      // Payoff: a touch that starts on the point drags it, or opens B1 if it lifts without moving (BR-29)
      if (id === 'idx' && PM.on && !c.draft && poPriced() && nearPoint(cardPt(p))) mode = 'ptpend';
      clearTimeout(lp); lp = setTimeout(() => {
        if (mode !== 'pending') return;
        mode = 'cross';
        if (id === 'idx' && PM.on && !c.draft && poPriced() && inFuture(cardPt(start))) { const pt = pointFromXY(cardPt(start)); if (pt) setPoint(pt, 'longpress'); }
        else setCross(id, cardPt(start));
        Haptic.fire('select'); track('crosshair', { chart: id });
      }, 400);
    } else if (P0.size === 2) {
      if (mode === 'ptdrag' || mode === 'ptpend') { /* a second finger ends the point drag and starts a pinch */ }
      if (id === 'idx' && PM.on) PM.chip = null;
      clearTimeout(lp); mode = 'pinch'; const [a, b] = [...P0.values()]; d0 = hyp(a.x - b.x, a.y - b.y) || 1; sp0 = c.spacing; ro0 = c.ro; c.cross = null; redraw(id);
    }
  });
  cv.addEventListener('pointermove', e => {
    if (!P0.has(e.pointerId)) {
      if (G.st === 'idle' && !LAYERS.length && !isNative()) { const reg = regionAt(id, appPt(e)); cv.style.cursor = reg === 'axis' ? 'ns-resize' : reg === 'taxis' ? 'ew-resize' : reg === 'corner' && claims('corner') ? 'pointer' : 'crosshair'; }
      if (c.draft && c.draft.pts.length && c.g && !P0.size) { const q = cardPt(appPt(e)); c.draft.hover = { t: xToTime(c.g, q.x), p: c.g.y2p(q.y) }; redraw(id); }
      return;
    }
    const p = appPt(e); P0.set(e.pointerId, p);
    if (mode === 'ptpend' && hyp(p.x - start.x, p.y - start.y) > 8) { clearTimeout(lp); mode = 'ptdrag'; moved = true; }
    if (mode === 'ptdrag') { const pt = pointFromXY(cardPt(p)); if (pt && PM.pt && (pt.T !== PM.pt.T || pt.S !== PM.pt.S)) setPoint(pt, 'drag'); edgeFrom(cardPt(p)); return; }
    if (mode === 'pending' && hyp(p.x - start.x, p.y - start.y) > 8) { clearTimeout(lp); mode = 'pan'; moved = true; if (id === 'idx' && PM.on && PM.chip) { PM.chip = null; renderPayoffUI(); } }
    if (mode === 'pan') { c.ro = ro0 - (p.x - start.x) / c.spacing; redraw(id); }   // the candles follow the finger
    else if (mode === 'cross') {
      if (id === 'idx' && PM.on && !c.draft && poPriced() && inFuture(cardPt(p))) { if (c.cross) { c.cross = null; setOhlc(id, null); } const pt = pointFromXY(cardPt(p)); if (pt && PM.pt && (pt.T !== PM.pt.T || pt.S !== PM.pt.S)) setPoint(pt, 'longpress'); redraw(id); edgeFrom(cardPt(p)); }
      else { setCross(id, cardPt(p)); if (c.draft && c.draft.pts.length) { c.draft.hover = { t: xToTime(c.g, c.cross.x), p: c.g.y2p(c.cross.y) }; } }
    }
    else if (mode === 'pinch' && P0.size >= 2) { const [a, b] = [...P0.values()]; const d = hyp(a.x - b.x, a.y - b.y); c.spacing = clamp(sp0 * d / d0, 1.2, 48); redraw(id); }
  });
  const end = e => {
    if (!P0.has(e.pointerId)) return;
    P0.delete(e.pointerId); clearTimeout(lp); edgeQ = null;
    if (P0.size) return;
    const p = appPt(e);
    if (mode === 'ptpend' && e.type === 'pointerup') openB1('point');
    if (mode === 'pending' && e.type === 'pointerup' && !moved) {
      if (c.draft && c.g) { const q = cardPt(p); placePoint(id, { t: xToTime(c.g, q.x), p: c.g.y2p(q.y) }); }
      else if (id === 'idx' && PM.on && poPriced() && beEdgeHit(cardPt(p))) { fitPrice(true); Haptic.fire('open'); track('payoff_fit_breakeven', {}); redraw('idx'); renderPayoffUI(); }
      else if (id === 'idx' && PM.on && poPriced() && inFuture(cardPt(p))) { const pt = pointFromXY(cardPt(p)); if (pt) setPoint(pt, 'tap'); }
      else if (id === 'opt' && !(PM.on && PM.s3)) { if (S.order) closeOrderPanel(); else openOrderPanel(); }
    }
    if (mode === 'cross') { if (c.draft && c.g && c.cross) placePoint(id, { t: xToTime(c.g, c.cross.x), p: c.g.y2p(c.cross.y) }); c.cross = null; setOhlc(id, null); redraw(id); }
    mode = null;
  };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
}
function setCross(id, q) {
  const c = CH[id], g = c.g; if (!g) return;
  const fi = Math.round(g.n - 1 - ((g.paneR - q.x) / g.s - c.ro)), i = clamp(fi, 0, g.n - 1);
  c.cross = { x: g.xOf(i), y: clamp(q.y, g.pT + 1, g.pB - 1), i };
  setOhlc(id, g.bars[i]); redraw(id);
}
function setOhlc(id, b) {
  const el = CH[id].el; let o = $('.ohlc', el);
  if (!b) { o && o.remove(); return; }
  if (!o) { o = h('<div class="lg ohlc" style="position:absolute;left:10px;top:56px;z-index:3"></div>'); el.appendChild(o); }
  const col = b.c >= b.o ? '#3fd297' : '#ee7069';
  o.innerHTML = ['O', 'H', 'L', 'C'].map((k, j) => `${k} <b style="color:${col}">${[b.o, b.h, b.l, b.c][j].toFixed(2)}</b>`).join(' ');
}
function bindChrome() {
  CHART_IDS.forEach(bindCard);
  const dv = $('#divider');
  dv.addEventListener('pointerdown', e => {
    if (e.button !== 0 || LAYERS.length || G.st !== 'idle') return; e.preventDefault();
    if (claims('divider')) startHold(e, 'divider', 'idx', dv, { early: st => splitDrag(st) }); else startDrag(e, dv, splitDrag(appPt(e)));
  });
  const dock = $('#dock');
  dock.addEventListener('pointerdown', e => {
    if (e.button !== 0 || LAYERS.length || G.st !== 'idle') return; e.preventDefault();
    startHold(e, 'dock', S.focus, dock, { tap: () => openQ1(S.focus, 'dock'), early: null });
  });
  dock.addEventListener('click', e => { if (e.detail === 0) openQ1(S.focus, 'dock'); });
  $('.b-more').addEventListener('click', () => openMenu());
  $('.b-x').addEventListener('click', () => toast('Closing the chart is not part of this prototype'));
  $('.b-rot').addEventListener('click', () => toast('Landscape is not part of this prototype'));
  $('.b-ai').addEventListener('click', () => toast('Sahi AI is not part of this prototype'));
  $$('.tpills .tp').forEach(t => t.addEventListener('click', () => toast(`${t.dataset.n || t.textContent.trim()} is not part of this prototype`)));
}

/* =========================================================================
   Menu (⋮), intro sheet, coach marks, demo
   ========================================================================= */
function openMenu() {
  const sh = h(`<div class="sheet lsheet" style="max-height:${L.H - L.sat - 24}px"><div class="sh-title">Payoff prototype</div><button class="sh-x" aria-label="Close">${ic('x', 18, 1.7)}</button>
    <div class="rows"><div class="secl">Payoff demo</div><div class="pdev">${payoffDevHTML()}</div><div class="secl">Placement</div>${VARIANTS.map(v => `<button class="vrow" data-v="${v.id}" role="radio" aria-checked="${S.v === v.id}"><span class="vb">${glyph(v.id, 46)}</span><span class="vt"><b>${v.n} · ${v.name}</b><span>${v.blurb}</span></span><span class="radio${S.v === v.id ? ' on' : ''}"></span></button>`).join('')}
    <div class="secl">Options</div>
    <button class="setrow" data-o="hand" style="width:100%"><span>Left-handed (mirrors V2 and V5)</span><span class="tog${S.hand === 'left' ? ' on' : ''}"></span></button>
    <button class="setrow" data-o="haptics" style="width:100%"><span>Haptics</span><span class="tog${S.haptics ? ' on' : ''}"></span></button>
    <button class="setrow" data-o="zones" style="width:100%"><span>Show touch zones</span><span class="tog${S.zones ? ' on' : ''}"></span></button>
    <div class="secl">Label stress test</div>
    <div class="segl"><span>Labels</span><div class="seg2">${Object.entries(LABELSETS).map(([k, l]) => `<button data-l="${k}" class="${S.labels === k ? 'on' : ''}">${l.name}</button>`).join('')}</div></div>
    <div class="segl"><span>Text size</span><div class="seg2">${TEXT_SIZES.map(f => `<button data-fs="${f}" class="${S.fs === f ? 'on' : ''}">${Math.round(f * 100)}%</button>`).join('')}</div></div>
    <button class="setrow" data-o="fit" style="width:100%"><span>Fit rules (shorten, wrap, readout pill)</span><span class="tog${S.fit ? ' on' : ''}"></span></button>
    <div class="secl">Try it</div>
    <button class="qrow" data-a="demo"><span class="qi">${ic('eye', 18, 1.8)}</span><span class="qt">Show me how<small>Plays the gesture for the current placement</small></span></button>
    <button class="qrow" data-a="study"><span class="qi">${ic('ruler', 18, 1.8)}</span><span class="qt">Timed tasks<small>8 tasks, timed, for comparing placements</small></span></button>
    <button class="qrow" data-a="q1"><span class="qi">${ic('dots3', 18, 1.8)}</span><span class="qt">Quick actions list<small>The same actions without the gesture</small></span></button>
    <button class="qrow" data-a="reset"><span class="qi">${ic('trash', 18, 1.8)}</span><span class="qt">Reset charts<small>5m, no indicators, no drawings</small></span></button></div></div>`);
  const layer = openLayer(sh, { label: 'Quick action wheel' });
  bindPayoffDev(sh, () => layer.close('picked'));
  sh.addEventListener('click', e => {
    if (e.target.closest('.sh-x')) return layer.close('close');
    if (e.target.closest('.pdev')) return;
    const v = e.target.closest('.vrow'); if (v) { layer.close('picked'); setVariant(v.dataset.v); return; }
    const lb = e.target.closest('[data-l]'); if (lb) { setLabels(lb.dataset.l); $$('[data-l]', sh).forEach(b => b.classList.toggle('on', b === lb)); return; }
    const fb = e.target.closest('[data-fs]'); if (fb) { setTextSize(+fb.dataset.fs); $$('[data-fs]', sh).forEach(b => b.classList.toggle('on', b === fb)); return; }
    const o = e.target.closest('.setrow'); if (o) { const k = o.dataset.o; if (k === 'hand') S.hand = S.hand === 'left' ? 'right' : 'left'; else S[k] = !S[k]; $('.tog', o).classList.toggle('on', k === 'hand' ? S.hand === 'left' : S[k]); if (k === 'fit') { syncLabelTag(); track('fit_rules', { on: S.fit }); } relayout(); syncDev(); return; }
    const a = e.target.closest('[data-a]'); if (!a) return; layer.close('picked');
    setTimeout(() => ({ demo: () => demo(), study: () => Study.start(), q1: () => openQ1(S.focus, 'menu'), reset: () => { resetCharts(); toast('Charts reset'); } })[a.dataset.a](), 280);
  });
}
/* ---- Label stress test (placements PRD v1.1, section 15) ---- */
const TEXT_SIZES = [1, 1.3, 2];
let ORIG = null;
function setLabels(id, { silent = false } = {}) {
  if (!LABELSETS[id]) return;
  cancelGesture('invalid_context');
  if (!ORIG) ORIG = Object.fromEntries(CHART_IDS.map(c => [c, { sym: CH[c].sym, short: CH[c].short }]));
  S.labels = id; LS = LABELSETS[id];
  rebuildSlots();   // a label set other than Default brings its own two timeframes
  for (const c of CHART_IDS) { const nm = LS.chart && LS.chart[c]; CH[c].sym = nm ? nm[0] : ORIG[c].sym; CH[c].short = nm ? nm[1] : ORIG[c].short; const n = $('.sym .nm', CH[c].el); if (n) n.textContent = CH[c].sym; }
  syncFocus(); syncLabelTag(); syncDev(); syncDevHints();
  if (!silent) track('labels', { to: id });
}
function setTextSize(f, { silent = false } = {}) {
  cancelGesture('invalid_context');
  S.fs = TEXT_SIZES.includes(f) ? f : 1; app.style.setProperty('--fs', S.fs);
  syncLabelTag(); syncDev(); syncDevHints();
  if (!silent) track('text_size', { to: S.fs });
}
function syncLabelTag() {
  let t = $('#ltag'); if (!t) { t = h('<button class="ltag" id="ltag" aria-label="Label stress test settings"></button>'); app.appendChild(t); t.addEventListener('click', () => openMenu()); }
  const on = S.labels !== 'default' || S.fs !== 1 || !S.fit;
  t.classList.toggle('on', on);
  t.textContent = 'Label test · ' + [LABELSETS[S.labels].name, S.fs !== 1 ? Math.round(S.fs * 100) + '% text' : '', S.fit ? '' : 'fit rules off'].filter(Boolean).join(' · ');
}
function setVariant(v, { silent = false } = {}) {
  cancelGesture('invalid_context'); S.v = v; app.dataset.v = v; store.set('v', v);
  try { const u = new URL(location.href); u.searchParams.set('v', v.slice(1)); history.replaceState(null, '', u); } catch {}
  syncFocus(); placeChrome(); renderZones(); syncDev(); track('variant', { to: v });
  if (!silent) { dismissCoach(true); setTimeout(() => showCoach(), 250); }
}
let coachEl = null;
function coachAnchor() {
  const v = S.v;
  if (v === 'v1' || v === 'v6') { const r = rectIn($('.tfb', CH.opt.el)); return { x: r.x + r.w / 2, y: r.y + r.h, below: true }; }
  if (v === 'v2') { const hb = cornerHub('idx'); return { x: hb.x, y: hb.y - 14, below: false }; }
  if (v === 'v3') { const r = L.cards.idx, g = CH.idx.g; return { x: r.x + g.paneR + g.axisW / 2, y: r.y + (r.paneT + r.paneB) / 2 + 30, below: true }; }
  if (v === 'v4') return { x: L.W / 2, y: L.divY, below: false };
  const r = rectIn($('#dock')); return { x: r.x + r.w / 2, y: r.y - 4, below: false };
}
const COACH = {
  v1: ['Quick actions on the pill', 'Hold 5m, slide to an action, release. Slide back in to cancel.'],
  v2: ['Quick actions in the corner', 'Hold the wheel glyph where the axes meet, slide up or left, release.'],
  v3: ['Quick actions on the price axis', 'Hold still on the price axis, slide left, release. Dragging still scales the axis.'],
  v4: ['Quick actions on the split handle', 'Hold the handle. Slide up for NIFTY50, down for the option, release.'],
  v5: ['Quick actions in the thumb dock', 'Tap a chart to pick it, then hold this button, slide, release.'],
  v6: ['Quick actions list on the pill', 'Hold 5m, slide down the list, release on a row.'],
};
function showCoach(force = false) {
  dismissCoach(true);
  const seen = sstore.get('coach', {}); if (seen[S.v] && !force) return;
  const a = coachAnchor(), [t, b] = COACH[S.v];
  coachEl = h(`<div class="coach" role="note"><b>${t}</b>${b}<div class="cbtns"><button class="ghost" data-c="demo">Show me</button><button data-c="ok">Got it</button></div></div>`);
  app.appendChild(coachEl);
  const w = coachEl.offsetWidth, hh = coachEl.offsetHeight, x = clamp(a.x - w / 2, 10, L.W - w - 10);
  const y = a.below ? a.y + 12 : a.y - 12 - hh;
  coachEl.style.left = x + 'px'; coachEl.style.top = clamp(y, L.sat + 4, L.H - hh - 8) + 'px';
  coachEl.style.setProperty('--ax', clamp(a.x - x, 18, w - 18) + 'px'); coachEl.style.setProperty('--ay', a.below ? '-5px' : (hh - 7) + 'px');
  coachEl.addEventListener('click', e => { const c = e.target.closest('[data-c]'); if (!c) return; dismissCoach(); if (c.dataset.c === 'demo') demo(); });
}
function dismissCoach(soft = false) { if (!coachEl) return; coachEl.remove(); coachEl = null; if (!soft) { const s = sstore.get('coach', {}); s[S.v] = true; sstore.set('coach', s); setTimeout(() => showPayoffTip(), 500); } }
let demoT = [];
function demo() {
  if (G.st !== 'idle') return; closeAllLayers('system'); dismissCoach(true);
  const id = S.v === 'v4' ? 'idx' : S.v === 'v5' ? S.focus : 'opt';
  let p0;
  if (S.v === 'v1' || S.v === 'v6') { const r = rectIn($('.tfb', CH[id].el)); p0 = { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
  else if (S.v === 'v2') p0 = cornerHub(id);
  else if (S.v === 'v3') { const r = L.cards.idx, g = CH.idx.g; p0 = { x: r.x + g.paneR + g.axisW / 2, y: r.y + r.paneB - 40 }; }
  else if (S.v === 'v4') p0 = { x: L.W / 2, y: L.divY + L.gap / 2 };
  else { const r = rectIn($('#dock')); p0 = { x: r.x + r.w / 2, y: r.y + r.h / 2 }; }
  const chart = S.v === 'v3' ? 'idx' : id;
  const geo = geometry({ chart, p0, region: VAR[S.v].region });
  if (!geo.ok) { toast('Not enough room for the wheel on this phone: it would open Quick actions'); return; }
  const target = geo.kind === 'list' ? { x: geo.rect.x + geo.rect.w / 2, y: geo.rowsTop + 4 * 44 + 22 } : (() => { const s = geo.sectors.find(x => x.i === 4 && (!geo.dial || x.chart === 'opt')) || geo.sectors[4]; const [x, y] = pol(geo.hub, (geo.rIn + geo.rOut) / 2, s.a0 + s.span / 2); return { x, y }; })();
  Object.assign(G, { st: 'demo', geo, hover: null, chart, region: 'demo', el: null });
  app.classList.add('touches'); showTouch(p0);
  const T = (ms, f) => demoT.push(setTimeout(f, ms));
  T(450, () => { $('#ov').classList.add('on'); renderOverlay(); Haptic.fire('open', geo.hub || p0); });
  const steps = 18;
  for (let k = 1; k <= steps; k++) T(700 + k * 40, () => { const t = k / steps, e = t * t * (3 - 2 * t), p = { x: p0.x + (target.x - p0.x) * e, y: p0.y + (target.y - p0.y) * e }; showTouch(p); const hit = hitTest(geo, p), key = hit.zone === 'slot' ? hit.sec.chart + ':' + hit.sec.i : hit.zone; if (key !== (G.hover && G.hover.key)) { G.hover = { ...hit, key }; if (hit.zone === 'slot') Haptic.fire('select'); renderOverlay(); } });
  T(700 + steps * 40 + 700, () => { const d = describe(SLOTS[4], G.hover && G.hover.sec ? G.hover.sec.chart : chart); endGesture(); G.st = 'idle'; if (!S.touches) app.classList.remove('touches'); toast(`Demo: release here to ${d.verb.toLowerCase()}. Nothing was changed.`); demoT = []; });
}

/* =========================================================================
   Timed tasks (for comparing placements with real people)
   ========================================================================= */
const Study = (() => {
  const TASKS = [['opt', 'tfA', 'Switch the option chart to 1m'], ['idx', 'vwap', 'Turn on VWAP on NIFTY50'], ['opt', 'trend', 'Start a trend line on the option chart'], ['idx', 'tfB', 'Switch NIFTY50 to 15m'], ['opt', 'ema', 'Turn on EMA 20 on the option chart'], ['idx', 'payoff', 'Turn on Payoff'], ['idx', 'fib', 'Start a Fib retracement on NIFTY50'], ['opt', 'tfB', 'Switch the option chart to 15m']];
  let st = null;
  const bar = () => $('#study');
  function show(html) { const b = bar(); b.innerHTML = html; b.classList.add('on'); }
  function start() {
    closeAllLayers('system'); resetCharts(); resetQuick(); if (S.labels !== 'default') setLabels('default'); if (S.fs !== 1) setTextSize(1); S.fit = true; syncLabelTag();
    const order = TASKS.map((t, i) => [Math.random(), t]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    st = { v: S.v, frame: S.frame, hand: S.hand, order, k: -1, rows: [], running: false };
    show(`<div class="sq">Timed tasks · ${VAR[S.v].n} ${VAR[S.v].name}<small>8 tasks. Use the wheel only. The clock starts when each task appears.</small></div><button class="ghost" data-s="quit">Quit</button><button data-s="go">Start</button>`);
    bar().onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; if (b.dataset.s === 'go') next(); else quit(); };
    track('study_start', {});
  }
  function next() {
    st.k++; if (st.k >= st.order.length) return finish();
    resetCharts(true);
    const [chart, slot, text] = st.order[st.k];
    st.cur = { chart, slot, text, t0: now(), errors: 0, cancels: 0, opens: 0, fallbacks: 0 }; st.running = true;
    show(`<div class="sq">${text}<small>Task ${st.k + 1} of ${st.order.length}</small></div><button class="ghost" data-s="skip">Skip</button>`);
    bar().onclick = e => { const b = e.target.closest('[data-s]'); if (b && b.dataset.s === 'skip') done(false); };
  }
  function done(ok) {
    const c = st.cur; st.running = false;
    st.rows.push({ task: c.text, chart: c.chart, slot: c.slot, ok, ms: Math.round(now() - c.t0), errors: c.errors, cancels: c.cancels, opens: c.opens, fallbacks: c.fallbacks });
    setTimeout(next, ok ? 650 : 100);
  }
  function onEvent(e) {
    if (!st || !st.running) return;
    const c = st.cur;
    if (e.event === 'wheel_open') c.opens++;
    else if (e.event === 'fallback_open') c.fallbacks++;
    else if (e.event === 'cancel' && e.reason !== 'prehold_move') c.cancels++;
    else if (e.event === 'commit') { if ((e.chart === c.chart || c.slot === 'payoff') && e.slot === c.slot) done(true); else c.errors++; }
  }
  const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
  function finish() {
    bar().classList.remove('on');
    const okRows = st.rows.filter(r => r.ok), res = { v: st.v, frame: st.frame, hand: st.hand, at: new Date().toISOString(), median_ms: Math.round(median(okRows.map(r => r.ms))), done: okRows.length, errors: st.rows.reduce((a, r) => a + r.errors, 0), cancels: st.rows.reduce((a, r) => a + r.cancels, 0), fallbacks: st.rows.reduce((a, r) => a + r.fallbacks, 0), rows: st.rows };
    const hist = store.get('study', []); hist.push(res); store.set('study', hist.slice(-60));
    track('study_done', { median_ms: res.median_ms, errors: res.errors });
    st = null; showResults(res); renderResults();
  }
  function quit() { bar().classList.remove('on'); st = null; track('study_quit', {}); }
  function showResults(res) {
    const sh = h(`<div class="sheet lsheet" style="max-height:${L.H - L.sat - 24}px"><div class="sh-title">${VAR[res.v].n} results</div><button class="sh-x" aria-label="Close">${ic('x', 18, 1.7)}</button><div class="rows" style="padding:8px 16px 24px">
      <div style="display:flex;gap:10px;margin:6px 0 14px">${[['Median', (res.median_ms / 1000).toFixed(2) + ' s'], ['Done', res.done + '/8'], ['Wrong action', res.errors], ['Cancels', res.cancels]].map(([k, v]) => `<div style="flex:1;background:#202020;border-radius:12px;padding:10px"><div style="font-size:11px;color:#9e9e9e">${k}</div><div style="font-size:17px;font-weight:600;margin-top:2px">${v}</div></div>`).join('')}</div>
      ${res.rows.map(r => `<div style="display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid #242424;font-size:13px"><span style="color:${r.ok ? '#fff' : '#9e9e9e'}">${r.task}</span><span style="white-space:nowrap;color:${r.errors ? '#ffb44c' : '#9e9e9e'}">${r.ok ? (r.ms / 1000).toFixed(2) + ' s' : 'skipped'}${r.errors ? ' · ' + r.errors + ' wrong' : ''}</span></div>`).join('')}
      <button class="dbtn" style="margin-top:16px;height:36px;border-radius:18px;background:#fff;color:#000;border:0;padding:0 16px;font-weight:600" data-copy>Copy results (JSON)</button></div></div>`);
    const layer = openLayer(sh, { label: 'Results' });
    sh.addEventListener('click', e => { if (e.target.closest('.sh-x')) layer.close('close'); if (e.target.closest('[data-copy]')) copyJSON(res); });
  }
  return { start, onEvent, showResults };
})();
function copyJSON(obj) { const s = JSON.stringify(obj, null, 2); (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(() => toast('Copied'), () => { const t = document.createElement('textarea'); t.value = s; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast('Copied'); } catch { toast('Copy failed'); } t.remove(); }); }
function resetCharts(quiet) {
  if (PM.on) setPayoff(false, { source: 'reset' });
  for (const id of CHART_IDS) { const c = CH[id]; Object.assign(c, { tf: '5m', type: 'candle', ind: {}, draws: [], draft: null, ys: null, cross: null, spacing: BASE[id].spacing, ro: BASE[id].ro, _ic: {}, _rk: null }); }
  S.linked = false; $$('.dtool').forEach(x => x.remove()); updateHeaders(); redraw();
}

/* =========================================================================
   Touch zones overlay
   ========================================================================= */
function renderZones() {
  const z = $('#zones'); z.innerHTML = ''; if (!S.zones) return;
  const add = (x, y, w, hh, label, sys) => z.appendChild(h(`<div class="z${sys ? ' sys' : ''}" style="left:${x}px;top:${y}px;width:${w}px;height:${hh}px"><span>${label}</span></div>`));
  const v = S.v;
  for (const id of CHART_IDS) {
    const r = L.cards[id], g = CH[id].g; if (!g) continue;
    if (v === 'v1' || v === 'v6') { const p = rectIn($('.tfb', CH[id].el)); add(p.x - 4, p.y - 6, p.w + 8, p.h + 12, 'hold'); }
    if (v === 'v2') { const hb = cornerHub(id); add(hb.x - 30, hb.y - 19, 60, 38, 'hold'); }
    if (v === 'v3') { const band = [Math.max(r.y + r.paneT, L.sat + 4 + 8 + 156), Math.min(r.y + r.paneB, L.H - L.sab - 4 - 8 - 156)]; add(r.x + g.paneR, r.y + r.paneT, g.axisW, r.paneB - r.paneT, 'drag = scale'); if (band[1] > band[0]) add(r.x + g.paneR + 4, band[0], g.axisW - 8, band[1] - band[0], 'hold = wheel'); }
    add(r.x + 8, r.y + r.paneT + 30, Math.min(150, g.paneR - 16), 22, 'long-press = crosshair');
  }
  if (v === 'v4') add(L.W * .2, L.divY - 10, L.W * .6, L.gap + 20, 'hold = dial · drag = resize');
  if (v === 'v5') { const d = rectIn($('#dock')); add(d.x - 4, d.y - 4, d.w + 8, d.h + 8, 'hold'); }
  if (L.os === 'android') { const gb = Math.max(24, L.sab); add(0, L.sat, 24, L.H - L.sat - gb, 'back', true); add(L.W - 24, L.sat, 24, L.H - L.sat - gb, 'back', true); add(0, L.H - gb, L.W, gb, 'home and recents swipe', true); }
  else { add(0, L.H - Math.max(21, L.sab), L.W, Math.max(21, L.sab), 'home indicator', true); }
}

/* =========================================================================
   Desktop panel
   ========================================================================= */
function buildDev() {
  const dev = $('#dev'); if (!dev) return;
  dev.innerHTML = `
    <div><h1>Sahi Payoff · mobile</h1></div>
    <div class="sub">Payoff in the quick wheel's seventh slot, where Clean View was. Hold a timeframe button, slide to Payoff, release. Then tap, drag or long-press in the shaded area. PRD in docs/sahi-payoff-mobile-prd.md.</div>
    <div class="box"><h2>Payoff demo</h2>${payoffDevHTML()}</div>
    <div class="box"><h2>Placement</h2><div class="vlist">${VARIANTS.map(v => `<button class="vbtn" data-v="${v.id}"><span class="vb">${glyph(v.id, 42)}</span><span><b>${v.n} · ${v.name}</b><span>${v.tag}. ${v.blurb}</span></span></button>`).join('')}</div>
      <div style="display:flex;gap:6px;margin-top:10px"><button class="dbtn" data-d="demo">Show me</button><button class="dbtn" data-d="coach">Coach mark</button><button class="dbtn" data-d="q1">Quick actions list</button></div></div>
    <div class="box"><h2>Phone</h2><div class="seg" id="frames">${Object.entries(FRAMES).map(([k, f]) => `<button data-f="${k}" title="${f.note}">${f.label}</button>`).join('')}</div></div>
    <div class="box"><h2>Options</h2>
      <label class="dt">Left-handed (mirrors V2 and V5)<input type="checkbox" data-t="hand"></label>
      <label class="dt">Show touch zones and system gesture areas<input type="checkbox" data-t="zones"></label>
      <label class="dt">Show touches<input type="checkbox" data-t="touches"></label>
      <label class="dt">Haptics (vibration, iOS tick, pulses)<input type="checkbox" data-t="haptics"></label>
      <label class="dt">Sound ticks (desktop stand-in for haptics)<input type="checkbox" data-t="sound"></label>
      <div class="hmeter" style="margin-top:6px"><i id="hDot"></i><span id="hTxt">${Haptic.canVibrate ? 'Vibration API available' : 'No Vibration API here: pulses and optional sound stand in'}</span></div></div>
    <div class="box"><h2>Wheel geometry on this phone</h2><div class="geo" id="geo"></div></div>
    <div class="box"><h2>Label stress test</h2><div class="seg" id="lsets">${Object.entries(LABELSETS).map(([k, l]) => `<button data-l="${k}" title="${l.note}">${l.name}</button>`).join('')}</div>
      <div class="seg" id="lfs" style="margin-top:6px">${TEXT_SIZES.map(f => `<button data-fs="${f}">${Math.round(f * 100)}% text</button>`).join('')}</div>
      <label class="dt" style="margin-top:6px">Fit rules (shorten, wrap, readout pill)<input type="checkbox" data-t="fit"></label>
      <div class="geo" id="fitrep" style="margin-top:6px"></div></div>
    <div class="box"><h2>Timed tasks</h2><div style="display:flex;gap:6px"><button class="dbtn pri" data-d="study">Run 8 tasks</button><button class="dbtn" data-d="clear">Clear history</button></div><div class="results" id="results" style="margin-top:8px"></div></div>
    <div class="box"><h2>Event log</h2><ul class="log" id="log"></ul><div style="display:flex;gap:6px;margin-top:8px"><button class="dbtn" data-d="copylog">Copy JSON</button><button class="dbtn" data-d="reset">Reset charts</button></div></div>`;
  dev.addEventListener('click', e => {
    const vb = e.target.closest('.vbtn'); if (vb) return setVariant(vb.dataset.v);
    const fb = e.target.closest('[data-f]'); if (fb) { S.frame = fb.dataset.f; relayout(); syncDev(); return; }
    const lb = e.target.closest('[data-l]'); if (lb) return setLabels(lb.dataset.l);
    const zb = e.target.closest('[data-fs]'); if (zb) return setTextSize(+zb.dataset.fs);
    const d = e.target.closest('[data-d]'); if (!d) return;
    ({ demo: () => demo(), coach: () => showCoach(true), q1: () => openQ1(S.focus, 'panel'), study: () => Study.start(), clear: () => { store.set('study', []); renderResults(); }, copylog: () => copyJSON(LOG), reset: () => resetCharts() })[d.dataset.d]();
  });
  bindPayoffDev(dev);
  dev.addEventListener('change', e => { const t = e.target.dataset.t; if (!t) return; if (t === 'hand') S.hand = e.target.checked ? 'left' : 'right'; else S[t] = e.target.checked; if (t === 'touches') app.classList.toggle('touches', S.touches); if (t === 'linked') updateHeaders(); if (t === 'fit') syncLabelTag(); relayout(); });
  renderResults();
}
function syncDev() {
  const dev = $('#dev'); if (!dev) return;
  $$('.vbtn', dev).forEach(b => b.classList.toggle('on', b.dataset.v === S.v));
  $$('#frames button', dev).forEach(b => b.classList.toggle('on', b.dataset.f === S.frame));
  $$('#lsets button', dev).forEach(b => b.classList.toggle('on', b.dataset.l === S.labels));
  $$('#lfs button', dev).forEach(b => b.classList.toggle('on', +b.dataset.fs === S.fs));
  $$('input[data-t]', dev).forEach(i => { const t = i.dataset.t; i.checked = t === 'hand' ? S.hand === 'left' : !!S[t]; });
  syncDevHints();
}
function syncDevHints() {
  const el = $('#geo'); if (!el || !CH.idx.g) return;
  const lines = [];
  const fmt = (ok, s) => `<span class="${ok ? 'ok' : 'bad'}">${s}</span>`;
  for (const id of S.v === 'v4' || S.v === 'v5' ? [S.v === 'v5' ? S.focus : 'idx'] : CHART_IDS) {
    let p0 = { x: 0, y: 0 };
    if (S.v === 'v3') { const r = L.cards[id], g = CH[id].g; p0 = { x: r.x + g.paneR + g.axisW / 2, y: r.y + (r.paneT + r.paneB) / 2 }; }
    const geo = geometry({ chart: id, p0 });
    const name = S.v === 'v4' ? 'Both charts' : CH[id].short;
    if (geo.kind === 'list') lines.push(`${name.padEnd(9)} list ${Math.round(geo.rect.w)}×${Math.round(geo.rect.h)} ${geo.above ? 'above' : 'below'} the pill · ${fmt(geo.ok, geo.ok ? 'fits' : 'no room')}`);
    else if (S.v === 'v3') { const r = L.cards[id], lo = Math.max(r.y + r.paneT, geo.band[0]), hi = Math.min(r.y + r.paneB, geo.band[1]), pct = Math.max(0, (hi - lo) / (r.paneB - r.paneT) * 100); lines.push(`${name.padEnd(9)} half ring r ${geo.rIn}–${geo.rOut} · wheel opens on ${fmt(pct > 40, Math.round(pct) + '%')} of its axis`); }
    else lines.push(`${name.padEnd(9)} ${geo.quarter ? 'quarter' : 'dial'} r ${geo.rIn}–${Math.round(geo.R)} (needs ${geo.need}) · ${fmt(geo.ok, geo.ok ? 'wheel' : 'falls back to list')}`);
  }
  lines.push(`Frame ${L.W}×${Math.round(L.H)} · safe top ${L.sat} · bottom ${L.sab}`);
  el.innerHTML = lines.join('\n');
  const fr = $('#fitrep'); if (!fr) return;
  const HOW = { full: '', wrap: '2 lines', short: 'short', small: 'smaller', raw: 'as typed' };
  const out = [];
  for (const id of S.v === 'v4' ? ['idx', 'opt'] : [S.v === 'v5' ? S.focus : 'idx']) {
    let p0 = { x: 0, y: 0 };
    if (S.v === 'v3') { const r = L.cards[id], g = CH[id].g; p0 = { x: r.x + g.paneR + g.axisW / 2, y: r.y + (r.paneT + r.paneB) / 2 }; }
    const geo = geometry({ chart: id, p0 });
    if (geo.kind === 'list') { out.push(`${escH(CH[id].short)}: list ${geo.rect.w}px wide, rows ${geo.rowH}px · ${fmt(geo.ok, geo.ok ? 'fits' : 'no room')}`); continue; }
    if (!geo.ok) { out.push(`${escH(CH[id].short)}: ${fmt(false, geo.reason === 'labels' ? 'labels do not fit (' + geo.bad.join(', ') + ') → Quick actions' : 'no room → Quick actions')}`); continue; }
    const secs = geo.dial ? geo.sectors.filter(s => s.chart === id) : geo.sectors;
    out.push(`${escH(CH[id].short)}: ` + secs.map(s => { const tag = [HOW[s.lay.how], s.lay.noCap ? 'no state' : '', s.lay.noIcon ? 'no icon' : ''].filter(Boolean).join(', '); return `${escH(s.lay.lines.join(' '))}${tag ? ` <span class="ok">(${tag})</span>` : ''}`; }).join(' · '));
  }
  fr.innerHTML = out.join('\n');
}
function renderLog() {
  const el = $('#log'); if (!el) return;
  el.innerHTML = LOG.slice(-40).reverse().map(e => { const { t, event, v, ...rest } = e; const cls = event === 'commit' ? 'commit' : event === 'cancel' ? 'cancel' : ''; return `<li class="${cls}"><b>${event}</b> ${v} ${Object.entries(rest).map(([k, x]) => `${k}=${x}`).join(' ')}</li>`; }).join('') || '<li>No events yet. Hold an anchor.</li>';
}
function renderResults() {
  const el = $('#results'); if (!el) return;
  const hist = store.get('study', []);
  if (!hist.length) { el.innerHTML = '<span style="color:#8d8d93;font-size:12px">No runs yet. Each run gives 8 timed tasks in random order.</span>'; return; }
  const by = {}; hist.forEach(r => { (by[r.v] = by[r.v] || []).push(r); });
  el.innerHTML = `<table><tr><th>Placement</th><th>Runs</th><th>Median</th><th>Wrong</th><th>Fallbacks</th></tr>${VARIANTS.filter(v => by[v.id]).map(v => { const rs = by[v.id], m = rs.map(r => r.median_ms).sort((a, b) => a - b)[Math.floor((rs.length - 1) / 2)]; return `<tr><td>${v.n} ${v.name}</td><td>${rs.length}</td><td>${(m / 1000).toFixed(2)} s</td><td>${rs.reduce((a, r) => a + r.errors, 0)}</td><td>${rs.reduce((a, r) => a + r.fallbacks, 0)}</td></tr>`; }).join('')}</table>`;
}

/* =========================================================================
   Layout, fit, init
   ========================================================================= */
function relayout() {
  computeLayout(); placeChrome(); redraw(); renderOrderPanel(); renderPayoffUI();
  requestAnimationFrame(() => { drawChart('idx'); drawChart('opt'); renderZones(); syncDevHints(); });
  fit(); syncFocus();
}
function fit() {
  const dv = $('#device'), wrap = $('#devwrap'); if (!dv || isNative()) return;
  const f = FRAMES[S.frame], s = Math.min(1, (window.innerHeight - 40) / (f.h + 18));
  dv.style.transform = `scale(${s})`; wrap.style.width = (f.w + 18) * s + 'px'; wrap.style.height = (f.h + 18) * s + 'px';
}
function clock() { const d = new Date(), t = [d.getHours(), d.getMinutes(), d.getSeconds()].map(x => String(x).padStart(2, '0')).join(':'); const el = $('.tp.clock'); if (el) el.textContent = t; }
window.addEventListener('resize', () => { relayout(); });
async function init() {
  const q = new URLSearchParams(location.search);
  const qv = q.get('v'); S.v = qv && VAR['v' + qv.replace(/^v/, '')] ? 'v' + qv.replace(/^v/, '') : store.get('v', 'v1');
  if (FRAMES[q.get('frame')]) S.frame = q.get('frame');
  if (q.get('hand') === 'left') S.hand = 'left';
  if (q.get('zones') === '1') S.zones = true;
  if (q.get('touches') === '1') { S.touches = true; app.classList.add('touches'); }
  if (q.get('fit') === '0') S.fit = false;
  app.dataset.v = S.v;
  if (SCEN[q.get('pos')]) PM.scenario = q.get('pos');
  if (q.get('product') === 'intraday') PM.product = 'INTRADAY';
  if (q.get('later') === '1') PM.later = true;
  S.box = ['a', 'b', 'c', '0'].includes(q.get('box')) ? q.get('box') : store.get('box', 'a');   // which payoff box: three takes, or 0 for the one before
  S.ux = q.get('ux') === 'a' ? 'a' : 'b';   // b: the improved Payoff (UX-01, UX-02, UX-05); a: PRD v1.0 as first built
  const qc = q.get('clock'); if (qc) { const m = /^(\d{1,2}):?(\d{2})$/.exec(qc); if (m) MK.mod = clamp(+m[1] * 60 + +m[2], 555, 960); }
  E.calibrate(MK.nowT());
  buildCards(); bindChrome(); bindPayoff(); buildDev();
  applyScenario(PM.scenario); quotes(); updateHeaders(); updatePnlPill();
  if (['delayed', 'unavailable', 'offline'].includes(q.get('pricing'))) setPricing(q.get('pricing'));
  const ql = q.get('labels'), qt = +q.get('text');
  setLabels(LABELSETS[ql] ? ql : 'default', { silent: true }); setTextSize(qt ? qt / 100 : 1, { silent: true });
  computeLayout(); placeChrome(); fit(); syncDev(); syncFocus();
  try { await Promise.race([Promise.all(['400 11.3px RobotoQW', '400 12.5px RobotoQW', '400 14px InterQW', '500 14px InterQW', '600 18px InterQW'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 1500))]); } catch {}
  S.fontsReady = true; redraw(); requestAnimationFrame(frame);
  requestAnimationFrame(() => { renderZones(); syncDevHints(); });
  clockPill();
  renderLog();
  if (q.get('coach') !== '0') setTimeout(() => showCoach(), 700);
  else if (q.get('tip') !== '0') setTimeout(() => showPayoffTip(), 600);
  if (q.get('payoff') === '1') setTimeout(() => setPayoff(true, { source: 'link' }), 300);
  syncPayoffDev();
}
init();

/* =========================================================================
   Payoff demo controls (desktop panel and the ⋮ menu)
   ========================================================================= */
function payoffDevHTML() {
  const groups = {}; Object.entries(SCEN).forEach(([k, s]) => (groups[s.group] = groups[s.group] || []).push([k, s.name]));
  return `<label class="pdl">Positions<select data-pd="scen">${Object.entries(groups).map(([g, items]) => `<optgroup label="${g}">${items.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</optgroup>`).join('')}</select></label>
    <div class="seg pseg" data-pd="product"><button data-v="CARRY">Carry forward</button><button data-v="INTRADAY">Intraday</button></div>
    <label class="pdl">Clock<select data-pd="clock">${CLOCKS.map(([m, n]) => `<option value="${m}">${n}</option>`).join('')}</select></label>
    <div class="seg pseg" data-pd="pricing"><button data-v="live">Live</button><button data-v="delayed">Delayed</button><button data-v="offline">Offline</button><button data-v="unavailable">Unavailable</button></div>
    <div class="pdrow"><button class="dbtn pri" data-pa="toggle">Payoff on</button><button class="dbtn" data-pa="tip">Show the tip</button><button class="dbtn" data-pa="order">Order panel</button></div>
    <label class="dt pdt">Improved Payoff: breakevens in view, plain readout, header button<input type="checkbox" data-pt="ux"></label>
    <div class="pdl pdb">Payoff box</div><div class="seg pseg" data-pd="box"><button data-v="a">P&amp;L first</button><button data-v="b">Two rows</button><button data-v="c">At the point</button><button data-v="0">Before</button></div>
    <label class="dt pdt">Later release: order actions in the point sheet<input type="checkbox" data-pt="later"></label>
    <label class="dt pdt">Orders fail (Later release)<input type="checkbox" data-pt="fail"></label>
    <div class="pnote">Real 1-minute Kite data for NIFTY 50 and the 19 Oct 22500 Call and Put up to 12:59 pm on Wed 14 Oct 2026; later times simulated, other contracts modelled.</div>`;
}
function syncPayoffDev() {
  $$('[data-pd="scen"]').forEach(s => s.value = PM.scenario);
  $$('[data-pd="clock"]').forEach(s => s.value = String(MK.mod));
  $$('[data-pd="product"] button').forEach(b => { b.classList.toggle('on', b.dataset.v === PM.product); b.disabled = !SCEN[PM.scenario].product; });
  $$('[data-pd="pricing"] button').forEach(b => b.classList.toggle('on', b.dataset.v === MK.pricing));
  $$('[data-pa="toggle"]').forEach(b => b.textContent = PM.on ? 'Payoff off' : 'Payoff on');
  $$('[data-pd="box"] button').forEach(b => { b.classList.toggle('on', b.dataset.v === S.box); b.disabled = !uxB(); });
  $$('[data-pt="later"]').forEach(c => c.checked = PM.later);
  $$('[data-pt="ux"]').forEach(c => c.checked = S.ux !== 'a');
  $$('[data-pt="fail"]').forEach(c => c.checked = PM.orderFail);
}
function bindPayoffDev(root, closeMenu) {
  root.addEventListener('change', e => {
    const k = e.target.dataset.pd, tk = e.target.dataset.pt;
    if (k === 'scen') { PM.product = 'CARRY'; applyScenario(e.target.value); track('demo_positions', { scenario: e.target.value }); }
    else if (k === 'clock') { setClock(+e.target.value); track('demo_clock', { clock: +e.target.value }); }
    else if (tk === 'later') { PM.later = e.target.checked; store.set('later', PM.later); renderPayoffUI(); }
    else if (tk === 'fail') PM.orderFail = e.target.checked;
    else if (tk === 'ux') { const on = PM.on; if (on) setPayoff(false, { source: 'demo' }); S.ux = e.target.checked ? 'b' : 'a'; renderPayoffUI(); if (on) setPayoff(true, { source: 'demo' }); track('demo_ux', { ux: S.ux }); }
    else return;
    syncPayoffDev();
  });
  root.addEventListener('click', e => {
    const sb = e.target.closest('[data-pd] button'); if (sb && !sb.disabled) {
      const k = sb.closest('[data-pd]').dataset.pd;
      if (k === 'product') { PM.product = sb.dataset.v; applyScenario(PM.scenario); }
      if (k === 'pricing') setPricing(sb.dataset.v);
      if (k === 'box') { S.box = sb.dataset.v; store.set('box', S.box); renderPayoffUI(); track('demo_box', { box: S.box }); }
      syncPayoffDev(); return;
    }
    const a = e.target.closest('[data-pa]'); if (!a) return;
    if (closeMenu) closeMenu();
    setTimeout(() => {
      if (a.dataset.pa === 'toggle') setPayoff(!PM.on, { source: 'demo' });
      if (a.dataset.pa === 'tip') { PM.tipSeen = false; PM.hintSeen = false; store.set('tipSeen', false); store.set('hintSeen', false); if (PM.on) setPayoff(false, { source: 'demo' }); showPayoffTip(true); }
      if (a.dataset.pa === 'order') { if (S.order) closeOrderPanel(); else openOrderPanel(); }
      syncPayoffDev();
    }, closeMenu ? 280 : 0);
  });
  syncPayoffDev();
}
