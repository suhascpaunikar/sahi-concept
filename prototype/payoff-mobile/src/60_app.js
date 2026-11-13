/* =========================================================================
   Chart gestures: pan, pinch, crosshair (long-press), axis scale, split
   ========================================================================= */
function startDrag(e, el, drag) {
  if (G.st !== 'idle' || !drag) return;
  Object.assign(G, { st: 'drag', pid: e.pointerId, el, drag, region: 'drag', last: appPt(e) });
  try { el.setPointerCapture(e.pointerId); } catch {}
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
    e.preventDefault(); S.focus = id;
    startHold(e, id, tfb, { tap: () => openPopover(id) });
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
    S.focus = id;
    if (reg === 'axis') {
      const t = now(); if (t - lastAxisTap < 300) { c.ys = null; redraw(id); lastAxisTap = 0; return; } lastAxisTap = t;
      startDrag(e, cv, axisDrag(id, p));
      return;
    }
    if (reg === 'corner') return;
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
      if (G.st === 'idle' && !LAYERS.length && !isNative()) { const reg = regionAt(id, appPt(e)); cv.style.cursor = reg === 'axis' ? 'ns-resize' : reg === 'taxis' ? 'ew-resize' : 'crosshair'; }
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
    startDrag(e, dv, splitDrag(appPt(e)));
  });
  $('.b-more').addEventListener('click', () => openMenu());
  $('.b-x').addEventListener('click', () => toast('Closing the chart is not part of this prototype'));
  $('.b-rot').addEventListener('click', () => toast('Landscape is not part of this prototype'));
  $('.b-ai').addEventListener('click', () => toast('Sahi AI is not part of this prototype'));
  $$('.tpills .tp').forEach(t => t.addEventListener('click', () => toast(`${t.dataset.n || t.textContent.trim()} is not part of this prototype`)));
}

/* =========================================================================
   Menu (⋮), coach mark, desktop panel
   ========================================================================= */
const TEXT_SIZES = [1, 1.3, 2];
const QA_LAYOUTS = [['pills', 'Pills × 2'], ['pills3', 'Pills × 3'], ['list', 'List']];
function openMenu() {
  const sh = h(`<div class="sheet lsheet" style="max-height:${L.H - L.sat - 24}px"><div class="sh-title">Payoff prototype</div><button class="sh-x" aria-label="Close">${ic('x', 18, 1.7)}</button>
    <div class="rows"><div class="secl">Payoff demo</div><div class="pdev">${payoffDevHTML()}</div>
    <div class="secl">Quick actions</div>
    <div class="segl"><span>Panel layout (hold 5m to open it)</span><div class="seg2">${QA_LAYOUTS.map(([k, n]) => `<button data-qa="${k}" class="${S.qa === k ? 'on' : ''}">${n}</button>`).join('')}</div></div>
    <div class="segl"><span>Text size</span><div class="seg2">${TEXT_SIZES.map(f => `<button data-fs="${f}" class="${S.fs === f ? 'on' : ''}">${Math.round(f * 100)}%</button>`).join('')}</div></div>
    <button class="setrow" data-o="haptics" style="width:100%"><span>Haptics</span><span class="tog${S.haptics ? ' on' : ''}"></span></button>
    <div class="secl">Try it</div>
    <button class="qrow" data-a="q1"><span class="qi">${ic('dots3', 18, 1.8)}</span><span class="qt">Quick actions sheet<small>The same actions without the gesture</small></span></button>
    <button class="qrow" data-a="picks"><span class="qi">${ic('flash', 18, 1.8)}</span><span class="qt">Reset quick action picks<small>1m and 15m, Trend Line and Fib, VWAP and EMA 20, no templates</small></span></button>
    <button class="qrow" data-a="reset"><span class="qi">${ic('trash', 18, 1.8)}</span><span class="qt">Reset charts<small>5m, no indicators, no drawings</small></span></button></div></div>`);
  const layer = openLayer(sh, { label: 'Prototype settings' });
  bindPayoffDev(sh, () => layer.close('picked'));
  sh.addEventListener('click', e => {
    if (e.target.closest('.sh-x')) return layer.close('close');
    if (e.target.closest('.pdev')) return;
    const qb = e.target.closest('[data-qa]'); if (qb) { setQa(qb.dataset.qa); $$('[data-qa]', sh).forEach(b => b.classList.toggle('on', b === qb)); return; }
    const fb = e.target.closest('[data-fs]'); if (fb) { setTextSize(+fb.dataset.fs); $$('[data-fs]', sh).forEach(b => b.classList.toggle('on', b === fb)); return; }
    const o = e.target.closest('.setrow'); if (o) { const k = o.dataset.o; S[k] = !S[k]; $('.tog', o).classList.toggle('on', S[k]); syncDev(); return; }
    const a = e.target.closest('[data-a]'); if (!a) return; layer.close('picked');
    setTimeout(() => ({ q1: () => openQ1(S.focus, 'menu'), picks: () => { resetQuick(); toast('Quick action picks reset'); }, reset: () => { resetCharts(); toast('Charts reset'); } })[a.dataset.a](), 280);
  });
}
function setTextSize(f, { silent = false } = {}) {
  cancelGesture('invalid_context');
  S.fs = TEXT_SIZES.includes(f) ? f : 1; app.style.setProperty('--fs', S.fs);
  syncDev();
  if (!silent) track('text_size', { to: S.fs });
}
// the quick action panel's layout: pills in titled sections, or the list
function setQa(v, { silent = false } = {}) {
  cancelGesture('invalid_context');
  S.qa = QA_LAYOUTS.some(q => q[0] === v) ? v : 'pills'; store.set('qa3', S.qa); rebuildSlots(); syncDev();
  if (!silent) track('qa_layout', { to: S.qa });
}
let coachEl = null;
function showCoach(force = false) {
  dismissCoach(true);
  if (sstore.get('coach', false) && !force) return;
  const r = rectIn($('.tfb', CH.opt.el)), a = { x: r.x + r.w / 2, y: r.y + r.h };
  coachEl = h(`<div class="coach" role="note"><b>Quick actions</b>Press and hold ${CH.opt.tf}. Slide to what you want and let go.<div class="cbtns"><button data-c="ok">Got it</button></div></div>`);
  app.appendChild(coachEl);
  const w = coachEl.offsetWidth, hh = coachEl.offsetHeight, x = clamp(a.x - w / 2, 10, L.W - w - 10);
  coachEl.style.left = x + 'px'; coachEl.style.top = clamp(a.y + 12, L.sat + 4, L.H - hh - 8) + 'px';
  coachEl.style.setProperty('--ax', clamp(a.x - x, 18, w - 18) + 'px'); coachEl.style.setProperty('--ay', '-5px');
  coachEl.addEventListener('click', e => { if (e.target.closest('[data-c]')) dismissCoach(); });
}
function dismissCoach(soft = false) { if (!coachEl) return; coachEl.remove(); coachEl = null; if (!soft) { sstore.set('coach', true); setTimeout(() => showPayoffTip(), 500); } }
function copyJSON(obj) { const s = JSON.stringify(obj, null, 2); (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(() => toast('Copied'), () => { const t = document.createElement('textarea'); t.value = s; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast('Copied'); } catch { toast('Copy failed'); } t.remove(); }); }
function resetCharts(quiet) {
  if (PM.on) setPayoff(false, { source: 'reset' });
  for (const id of CHART_IDS) { const c = CH[id]; Object.assign(c, { tf: '5m', type: 'candle', ind: {}, draws: [], draft: null, ys: null, cross: null, spacing: BASE[id].spacing, ro: BASE[id].ro, _ic: {}, _rk: null }); }
  S.linked = false; $$('.dtool').forEach(x => x.remove()); updateHeaders(); redraw();
}

function buildDev() {
  const dev = $('#dev'); if (!dev) return;
  dev.innerHTML = `
    <div><h1>Sahi Payoff · mobile</h1></div>
    <div class="sub">Tap Payoff in the index chart's header, then tap, drag or long-press in the shaded area. Hold a timeframe button for the quick action panel; tap it for the chart menu, where the flash icons choose the panel's actions. PRD in docs/sahi-payoff-mobile-prd.md.</div>
    <div class="box"><h2>Payoff demo</h2>${payoffDevHTML()}</div>
    <div class="box"><h2>Quick actions</h2><div class="seg" id="qas">${QA_LAYOUTS.map(([k, n]) => `<button data-qa="${k}">${n}</button>`).join('')}</div>
      <div class="seg" id="lfs" style="margin-top:6px">${TEXT_SIZES.map(f => `<button data-fs="${f}">${Math.round(f * 100)}% text</button>`).join('')}</div>
      <div style="display:flex;gap:6px;margin-top:10px"><button class="dbtn" data-d="q1">Quick actions sheet</button><button class="dbtn" data-d="picks">Reset picks</button><button class="dbtn" data-d="coach">Coach mark</button></div></div>
    <div class="box"><h2>Phone</h2><div class="seg" id="frames">${Object.entries(FRAMES).map(([k, f]) => `<button data-f="${k}" title="${f.note}">${f.label}</button>`).join('')}</div></div>
    <div class="box"><h2>Options</h2>
      <label class="dt">Show touches<input type="checkbox" data-t="touches"></label>
      <label class="dt">Haptics (vibration, iOS tick)<input type="checkbox" data-t="haptics"></label>
      <label class="dt">Sound ticks (desktop stand-in for haptics)<input type="checkbox" data-t="sound"></label>
      <div class="hmeter" style="margin-top:6px"><i id="hDot"></i><span id="hTxt">${Haptic.canVibrate ? 'Vibration API available' : 'No Vibration API here: optional sound stands in'}</span></div></div>
    <div class="box"><h2>Event log</h2><ul class="log" id="log"></ul><div style="display:flex;gap:6px;margin-top:8px"><button class="dbtn" data-d="copylog">Copy JSON</button><button class="dbtn" data-d="reset">Reset charts</button></div></div>`;
  dev.addEventListener('click', e => {
    const fb = e.target.closest('[data-f]'); if (fb) { S.frame = fb.dataset.f; relayout(); syncDev(); return; }
    const qb = e.target.closest('[data-qa]'); if (qb) return setQa(qb.dataset.qa);
    const zb = e.target.closest('[data-fs]'); if (zb) return setTextSize(+zb.dataset.fs);
    const d = e.target.closest('[data-d]'); if (!d) return;
    ({ coach: () => showCoach(true), q1: () => openQ1(S.focus, 'panel'), picks: () => { resetQuick(); toast('Quick action picks reset'); }, copylog: () => copyJSON(LOG), reset: () => resetCharts() })[d.dataset.d]();
  });
  bindPayoffDev(dev);
  dev.addEventListener('change', e => { const t = e.target.dataset.t; if (!t) return; S[t] = e.target.checked; if (t === 'touches') app.classList.toggle('touches', S.touches); });
}
function syncDev() {
  const dev = $('#dev'); if (!dev) return;
  $$('#frames button', dev).forEach(b => b.classList.toggle('on', b.dataset.f === S.frame));
  $$('#qas button', dev).forEach(b => b.classList.toggle('on', b.dataset.qa === S.qa));
  $$('#lfs button', dev).forEach(b => b.classList.toggle('on', +b.dataset.fs === S.fs));
  $$('input[data-t]', dev).forEach(i => { i.checked = !!S[i.dataset.t]; });
}
function syncDevHints() {}
function renderLog() {
  const el = $('#log'); if (!el) return;
  el.innerHTML = LOG.slice(-40).reverse().map(e => { const { t, event, ...rest } = e; const cls = event === 'commit' ? 'commit' : event === 'cancel' ? 'cancel' : ''; return `<li class="${cls}"><b>${event}</b> ${Object.entries(rest).map(([k, x]) => `${k}=${x}`).join(' ')}</li>`; }).join('') || '<li>No events yet. Hold a timeframe button.</li>';
}

/* =========================================================================
   Layout, fit, init
   ========================================================================= */
function relayout() {
  computeLayout(); placeChrome(); redraw(); renderOrderPanel(); renderPayoffUI();
  requestAnimationFrame(() => { drawChart('idx'); drawChart('opt'); });
  fit();
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
  if (FRAMES[q.get('frame')]) S.frame = q.get('frame');
  if (q.get('touches') === '1') { S.touches = true; app.classList.add('touches'); }
  S.qa = ['list', 'pills', 'pills3'].includes(q.get('qa')) ? q.get('qa') : store.get('qa3', 'pills');   // the quick action panel's layout
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
  const qt = +q.get('text');
  rebuildSlots(); setTextSize(qt ? qt / 100 : 1, { silent: true });
  computeLayout(); placeChrome(); fit(); syncDev();
  try { await Promise.race([Promise.all(['400 11.3px RobotoQW', '400 12.5px RobotoQW', '400 14px InterQW', '500 14px InterQW', '600 18px InterQW'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 1500))]); } catch {}
  S.fontsReady = true; redraw(); requestAnimationFrame(frame);
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
