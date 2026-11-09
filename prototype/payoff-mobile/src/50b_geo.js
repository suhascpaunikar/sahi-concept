/* =========================================================================
   Placements
   ========================================================================= */
const HOLD_MS = 300, SLOP = 10;
const VARIANTS = [
  { id: 'v1', n: 'V1', name: 'Pill fan', tag: 'Baseline (PRD v1.4)', region: 'pill', blurb: 'Hold the timeframe pill. A quarter wheel fans down and to the left.', how: ['Hold the 5m pill on either chart.', 'Slide out to an action.', 'Release to apply. Slide back in to cancel.'] },
  { id: 'v2', n: 'V2', name: 'Axis-corner fan', tag: 'Per chart, lower', region: 'corner', blurb: 'Hold the corner where the price and time axes meet. A quarter wheel fans up and to the left.', how: ['Hold the small wheel glyph at the bottom right of a chart.', 'Slide up or left to an action.', 'Release to apply.'] },
  { id: 'v3', n: 'V3', name: 'Price-axis arc', tag: 'Per chart, any height', region: 'axis', blurb: 'Hold anywhere on the price axis. A half ring opens to the left at your finger’s height.', how: ['Hold still on the price axis (dragging still scales it).', 'Slide left to an action.', 'Release to apply.'] },
  { id: 'v4', n: 'V4', name: 'Split-handle dial', tag: 'Both charts, centre', region: 'divider', blurb: 'Hold the handle between the charts. The top half acts on NIFTY50, the bottom half on the option.', how: ['Hold the white handle between the charts (dragging still resizes).', 'Slide up for NIFTY50, down for the option.', 'Release to apply.'] },
  { id: 'v5', n: 'V5', name: 'Thumb dock', tag: 'Global button', region: 'dock', blurb: 'A floating button in the thumb zone. It acts on the chart you touched last.', how: ['Tap a chart to choose it (it gets an outline).', 'Hold the round button at the bottom right.', 'Slide to an action and release.'] },
  { id: 'v6', n: 'V6', name: 'Press-drag list', tag: 'Linear control', region: 'pill', blurb: 'Hold the timeframe pill. A list drops down; slide onto a row and release.', how: ['Hold the 5m pill on either chart.', 'Slide down the list.', 'Release on a row to apply.'] },
];
const VAR = Object.fromEntries(VARIANTS.map(v => [v.id, v]));
const claims = region => VAR[S.v].region === region;
function glyph(v, size = 44) {
  const w = '#fff', f = 'rgba(255,255,255,.88)';
  const parts = {
    v1: `<path d="M28 10.5H17.5A10.5 10.5 0 0 0 28 21z" fill="${f}"/><rect x="25" y="9" width="5" height="3" rx="1.5" fill="#8a8a8a"/>`,
    v2: `<path d="M28 22.3H17.5A10.5 10.5 0 0 1 28 11.8z" fill="${f}"/><circle cx="28" cy="22.3" r="1.6" fill="#8a8a8a"/>`,
    v3: `<path d="M30 8.5A8 8 0 0 0 30 24.5z" fill="${f}"/><path d="M30 6v20" stroke="#8a8a8a" stroke-width="1.2"/>`,
    v4: `<circle cx="22" cy="24" r="9" fill="${f}"/><path d="M12 24h20" stroke="#111" stroke-width="1.4"/><rect x="19" y="23.2" width="6" height="1.6" rx=".8" fill="#111"/>`,
    v5: `<path d="M28.5 36.5H18A10.5 10.5 0 0 1 28.5 26z" fill="${f}"/><circle cx="28.5" cy="36.5" r="3" fill="#8a8a8a" stroke="#111" stroke-width="1"/>`,
    v6: `<rect x="17" y="12" width="12" height="13" rx="2" fill="${f}"/><path d="M19 15.5h8M19 18.5h8M19 21.5h8" stroke="#111" stroke-width="1.2"/><rect x="25" y="9" width="5" height="2.4" rx="1.2" fill="#8a8a8a"/>`,
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 44 44" aria-hidden="true"><rect x="11.5" y="2.5" width="21" height="39" rx="4.5" fill="none" stroke="#4a4a4a"/><rect x="13.5" y="7.5" width="17" height="15" rx="2" fill="#262626"/><rect x="13.5" y="24.5" width="17" height="15" rx="2" fill="#262626"/>${parts[v]}</svg>`;
}

/* ---- Geometry ---- */
function fan(start, span, n, trim, dir) {
  const step = span / n, out = [];
  for (let i = 0; i < n; i++) { let a = start + dir * i * step, b = start + dir * (i + 1) * step; if (a > b) [a, b] = [b, a]; out.push({ a0: (a + trim + 720) % 360, a1: (b - trim + 720) % 360, span: step - 2 * trim }); }
  return out;
}
const inArc = (th, s) => ((th - s.a0 + 720) % 360) <= s.span;
function chartBounds(id) { const r = L.cards[id]; return { l: r.x, t: Math.max(r.y, L.sat), r: r.x + r.w, b: Math.min(r.y + r.h, L.H - L.sab) }; }
function cornerHub(id) { const r = L.cards[id], g = CH[id].g || geomOf(id); return S.hand === 'left' ? { x: r.x + 22, y: r.y + r.paneB + 12 } : { x: r.x + g.paneR + g.axisW / 2, y: r.y + r.paneB + 12 }; }
function geometry(ctx) {
  const v = S.v, id = ctx.chart, left = S.hand === 'left';
  if (v === 'v1' || v === 'v2' || v === 'v5') {
    let hub, start, dir, R, bounds;
    if (v === 'v1') { const pr = rectIn($('.tfb', CH[id].el)); hub = { x: pr.x + pr.w / 2, y: pr.y + pr.h / 2 }; bounds = chartBounds(id); R = Math.min(280, hub.x - bounds.l - 8, bounds.b - hub.y - 8); start = 180; dir = -1; }
    else if (v === 'v2') { hub = cornerHub(id); bounds = chartBounds(id); R = Math.min(280, (left ? bounds.r - hub.x : hub.x - bounds.l) - 8, hub.y - bounds.t - 8); start = left ? 0 : 180; dir = left ? -1 : 1; }
    else { const dr = rectIn($('#dock')); hub = { x: dr.x + dr.w / 2, y: dr.y + dr.h / 2 }; R = Math.min(280, (left ? L.W - hub.x : hub.x) - 8, hub.y - L.sat - 8); start = left ? 0 : 180; dir = left ? -1 : 1; }
    const sectors = fan(start, 90, 7, .5, dir).map((s, i) => ({ ...s, i, chart: id }));
    const ok = R >= 264, bis = start + dir * 45;
    return withLabels({ kind: 'radial', quarter: true, hub, rIn: 120, rOut: Math.max(R, 0), R, need: 264, ok, reason: ok ? null : 'space', sectors, bis, chart: id });
  }
  if (v === 'v3') {
    const hub = { x: ctx.p0.x, y: ctx.p0.y }, rIn = 56, rOut = 156;
    const sectors = fan(270, 180, 7, .75, -1).map((s, i) => ({ ...s, i, chart: id }));
    const top = L.sat + 4, bot = L.H - L.sab - 4, roomUp = hub.y - top - 8, roomDown = bot - hub.y - 8;
    const ok = roomUp >= rOut && roomDown >= rOut && hub.x - rOut - 8 >= 0;
    return withLabels({ kind: 'radial', hub, rIn, rOut, ok, reason: ok ? null : 'space', need: rOut, R: Math.min(roomUp, roomDown), sectors, chart: id, band: [top + 8 + rOut, bot - 8 - rOut] });
  }
  if (v === 'v4') {
    const hub = { x: L.W / 2, y: L.divY + L.gap / 2 }, rIn = 56;
    const rOut = Math.min(196, L.W / 2 - 8, hub.y - L.sat - 8, L.H - L.sab - hub.y - 8);
    const topS = fan(186, 168, 7, .75, 1).map((s, i) => ({ ...s, i, chart: 'idx' }));
    const botS = fan(174, 168, 7, .75, -1).map((s, i) => ({ ...s, i, chart: 'opt' }));
    const ok = rOut >= 150;
    return withLabels({ kind: 'radial', dial: true, hub, rIn, rOut, ok, reason: ok ? null : 'space', need: 150, R: rOut, sectors: [...topS, ...botS], chart: null });
  }
  // v6: list under the pill
  const pr = rectIn($('.tfb', CH[id].el)), m = listMetrics(id), w = m.w, hh = SLOTS.length * m.rowH + 12;
  let top = pr.y + pr.h + 6; const below = top + hh <= L.H - L.sab - 8;
  if (!below) top = pr.y - 6 - hh;
  const x = clamp(pr.x + pr.w - w, 8, L.W - w - 8);
  const ok = top >= L.sat + 4;
  return { kind: 'list', rect: { x, y: top, w, h: hh }, rowsTop: top + 6, rowH: m.rowH, ok, reason: ok ? null : 'space', chart: id, above: !below, anchor: pr };
}
function withLabels(geo) {
  if (!geo.ok) return geo;
  for (const s of geo.sectors) s.lay = layoutSlot(geo, s, describe(SLOTS[s.i], s.chart));
  if (S.fit !== false) {
    // one structure per group in each wheel: both timeframes keep or drop their caption together,
    // the three on/off slots likewise, and icons go from every slot or from none
    const grp = s => SLOTS[s.i].kind === 'tf' ? 'tf' : SLOTS[s.i].kind === 'tool' ? 'tool' : 'state';
    for (const chart of [...new Set(geo.sectors.map(s => s.chart))]) {
      const secs = geo.sectors.filter(s => s.chart === chart && s.lay), noCap = {}, noIcon = secs.some(s => s.lay.noIcon);
      for (const s of secs) if (s.lay.noCap) noCap[grp(s)] = true;
      for (const s of secs) {
        const d = describe(SLOTS[s.i], s.chart), f = { noCap: !!noCap[grp(s)] && !!d.cap, noIcon: noIcon && !!d.icon };
        if ((f.noCap && s.lay.cap) || (f.noIcon && s.lay.icon)) s.lay = layoutSlot(geo, s, d, f);
      }
    }
  }
  const bad = geo.sectors.filter(s => !s.lay);
  if (bad.length) { geo.ok = false; geo.reason = 'labels'; geo.bad = [...new Set(bad.map(s => SLOTS[s.i].id))]; }
  return geo;
}
function hitTest(geo, p) {
  if (geo.kind === 'list') {
    const r = geo.rect;
    if (p.x < r.x || p.x > r.x + r.w || p.y < geo.rowsTop || p.y > geo.rowsTop + SLOTS.length * geo.rowH) return { zone: inRect(p, geo.anchor, 6) ? 'inner' : 'outside' };
    const i = Math.min(SLOTS.length - 1, Math.floor((p.y - geo.rowsTop) / geo.rowH)); return { zone: 'slot', sec: { i, chart: geo.chart } };
  }
  const dx = p.x - geo.hub.x, dy = p.y - geo.hub.y, r = hyp(dx, dy);
  if (r < geo.rIn) return { zone: 'inner', r };
  if (r > geo.rOut) return { zone: 'outside', r };
  let th = Math.atan2(dy, dx) * 180 / Math.PI; if (th < 0) th += 360;
  for (const s of geo.sectors) if (inArc(th, s)) return { zone: 'slot', sec: s, r };
  return { zone: 'separator', r };
}
const inRect = (p, r, pad = 0) => p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;

function fitCounts(geo) {
  if (geo.kind !== 'radial') return {};
  const o = { labels: S.labels || 'default', fs: S.fs || 1 };
  for (const s of geo.sectors) { const k = s.lay.how; if (k !== 'full' && k !== 'raw') o['fit_' + k] = (o['fit_' + k] || 0) + 1; if (s.lay.noCap) o.fit_nostate = (o.fit_nostate || 0) + 1; if (s.lay.noIcon) o.fit_noicon = (o.fit_noicon || 0) + 1; }
  return o;
}

/* =========================================================================
   Gesture: idle → pending (300 ms, 10 px) → wheel | list | fallback
   ========================================================================= */
const G = { st: 'idle' };
function startHold(e, region, id, el, handlers = {}) {
  if (G.st !== 'idle' || LAYERS.length) return false;
  const p = appPt(e);
  Object.assign(G, { st: 'pending', pid: e.pointerId, region, chart: id, el, p0: p, last: p, t0: now(), handlers, iid: 'qa-' + (++IID), hover: null, geo: null, maxR: 0 });
  try { el.setPointerCapture(e.pointerId); } catch {}
  el.classList.add('held');
  G.timer = setTimeout(onHold, HOLD_MS);
  showTouch(p);
  return true;
}
function onHold() {
  if (G.st !== 'pending') return;
  const id = VAR[S.v].region === 'dock' ? S.focus : G.chart;
  G.chart = id;
  const geo = geometry({ chart: id, p0: G.p0, region: G.region });
  G.geo = geo;
  if (geo.ok) { G.st = geo.kind === 'list' ? 'list' : 'wheel'; $('#ov').classList.add('on'); renderOverlay(); Haptic.fire('open', geo.hub || G.p0); track('wheel_open', { chart: geo.dial ? 'both' : id, region: G.region, R: Math.round(geo.R || 0), iid: G.iid, ...fitCounts(geo) }); }
  else { G.st = 'fallback'; renderFallback(); Haptic.fire('open', G.p0); track('fallback_open', { chart: id, region: G.region, reason: geo.reason, R: Math.round(geo.R || 0), iid: G.iid, ...(geo.bad ? { slots: geo.bad.join(',') } : {}) }); }
  if (S.v === 'v5') $$('.card').forEach(c => c.classList.toggle('focus', c.dataset.chart === id));
  dismissCoach(true);
}
function onMove(e) {
  if (G.st === 'idle' || e.pointerId !== G.pid) return;
  const p = appPt(e); G.last = p; showTouch(p);
  if (G.st === 'pending') {
    if (hyp(p.x - G.p0.x, p.y - G.p0.y) > SLOP) {
      clearTimeout(G.timer); G.el.classList.remove('held'); hideTouch();
      const early = G.handlers.early;
      G.drag = early ? early(G.p0, e) : null;
      if (G.drag) { G.st = 'drag'; G.drag.move(p, e); }
      else { const region = G.region; endGesture(); track('cancel', { reason: 'prehold_move', region }); }
    }
    return;
  }
  if (G.st === 'drag') { G.drag && G.drag.move(p, e); return; }
  if (G.st === 'wheel' || G.st === 'list') {
    const hit = hitTest(G.geo, p), key = hit.zone === 'slot' ? hit.sec.chart + ':' + hit.sec.i : hit.zone;
    G.maxR = Math.max(G.maxR, hit.r || 0);
    if (key !== (G.hover && G.hover.key)) { G.hover = { ...hit, key }; if (hit.zone === 'slot') Haptic.fire('select'); renderOverlay(); }
  }
  if (G.st === 'fallback') { const far = hyp(p.x - G.p0.x, p.y - G.p0.y) > 120; $('.fbhint') && ($('.fbhint').style.opacity = far ? .45 : 1); }
}
function onUp(e) {
  if (G.st === 'idle' || e.pointerId !== G.pid) return;
  const p = appPt(e);
  if (G.st === 'pending') { clearTimeout(G.timer); const tap = G.handlers.tap; endGesture(); tap && tap(); return; }
  if (G.st === 'drag') { G.drag && G.drag.end && G.drag.end(p, e); G.drag = null; endGesture(); return; }
  if (G.st === 'fallback') {
    const far = hyp(p.x - G.p0.x, p.y - G.p0.y) > 120, id = G.chart, iid = G.iid;
    endGesture();
    if (far) { track('cancel', { reason: 'outside', chart: id, iid }); return; }
    openQ1(id, 'fallback'); return;
  }
  const hit = hitTest(G.geo, p), ms = Math.round(now() - G.t0), iid = G.iid, region = G.region;
  if (hit.zone === 'slot') {
    const { i, chart } = hit.sec, d = describe(SLOTS[i], chart);
    endGesture();
    if (d.status === 'current') { Haptic.fire('cancel'); toast(d.action); track('cancel', { reason: 'current', chart, slot: SLOTS[i].id, iid }); return; }
    if (d.status === 'na') { Haptic.fire('error', p); toast(d.action); track('cancel', { reason: 'unavailable', chart, slot: SLOTS[i].id, iid }); if (SLOTS[i].kind === 'payoff') track('wheel_action', { action: 'payoff_unavailable', chart }); return; }
    applySlot(i, chart, { route: 'wheel' }); Haptic.fire('success', p);
    if (S.v === 'v5') S.focus = chart;
    track('commit', { chart, slot: SLOTS[i].id, ms, region, iid });
  } else { endGesture(); Haptic.fire('cancel'); track('cancel', { reason: hit.zone, chart: G.chart, ms, iid }); }
}
function cancelGesture(reason = 'interrupted') {
  if (G.st === 'idle') return;
  if (G.st === 'drag') { G.drag && G.drag.end && G.drag.end(G.last); G.drag = null; endGesture(); return; }
  clearTimeout(G.timer); const was = G.st;
  endGesture(); if (was !== 'pending') track('cancel', { reason });
}
function endGesture() {
  if (G.el) { G.el.classList.remove('held'); try { G.el.releasePointerCapture(G.pid); } catch {} }
  G.st = 'idle'; G.geo = null; G.hover = null;
  const ov = $('#ov'); ov.classList.remove('on'); $$('svg.wheel, .vpill, .qlist, .fbhint', app).forEach(x => x.remove());
  if (S.v === 'v5') $$('.card').forEach(c => c.classList.toggle('focus', c.dataset.chart === S.focus)); else $$('.card').forEach(c => c.classList.remove('focus'));
  hideTouch();
}
window.addEventListener('pointermove', onMove, true);
window.addEventListener('pointerup', onUp, true);
window.addEventListener('pointercancel', e => { if (G.st !== 'idle' && e.pointerId === G.pid) cancelGesture('interrupted'); }, true);
window.addEventListener('pointerdown', e => { if ((G.st === 'pending' || G.st === 'wheel' || G.st === 'list' || G.st === 'fallback') && e.pointerId !== G.pid) { e.stopPropagation(); cancelGesture('interrupted'); } }, true);
window.addEventListener('blur', () => cancelGesture('interrupted'));
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelGesture('interrupted'); });
app.addEventListener('contextmenu', e => e.preventDefault());

