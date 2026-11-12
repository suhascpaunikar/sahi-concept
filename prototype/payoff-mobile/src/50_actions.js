/* =========================================================================
   Quick actions. Hold a chart's timeframe button: a panel opens under it;
   slide to an action and release to apply it to that chart. A tap on the
   button still opens the chart menu, and every action is also in the
   Quick actions sheet.
   This is the placement study's V6 (press-drag list). The other five
   placements (pill fan, axis-corner fan, price-axis arc, split-handle dial,
   thumb dock) were removed from this prototype; they remain in
   prototype/quick-wheel-placements/.
   Three layouts of the panel (S.qa):
   - pills3: titled sections with action pills, three a row, like the chart
     menu's timeframe sections: Timeframe, Drawing, Indicator, Template, Payoff.
   - pills: the same sections with two wider pills a row.
   - list: one row per action, as V6 was; it has no templates.
   The actions themselves are built by rebuildSlots() in 55_quick.js.
   ========================================================================= */
const HOLD_MS = 300, SLOP = 10;
const SLOTS = [];
const escH = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SEE = { drawing: 'a drawing', indicator: 'an indicator', template: 'a template' };

/* what a slot shows and does on chart id. status: ok | current (already on this timeframe) | na */
function describe(slot, id) {
  const c = CH[id], [label, name] = slot.lab || [slot.tf, 'Timeframe ' + slot.tf];
  if (slot.kind === 'empty') return { label: 'Add', name: `Empty ${slot.what} slot`, icon: 'plus', cap: '', status: 'na', empty: true, verb: `Add ${SEE[slot.what]}`, action: `Empty slot. Tap the flash icon beside ${SEE[slot.what]} to add it here` };
  // While the Payoff list covers the option chart (S3), that chart's actions are unavailable, except Payoff (FR-28)
  if (id === 'opt' && slot.kind !== 'payoff' && PM.on && PM.s3) return { label, name, icon: slot.icon, big: slot.kind === 'tf', cap: 'Hidden', status: 'na', verb: 'Hidden by the Payoff list', action: 'The Payoff list covers the option chart' };
  if (slot.kind === 'tf') {
    const cur = c.tf === slot.tf;
    return { label: slot.tf, big: true, name: cur ? 'Current timeframe' : name, cap: cur ? 'Current' : '', capOn: cur, status: cur ? 'current' : 'ok', verb: cur ? `Already ${slot.tf}` : `Switch to ${slot.tf}`, action: cur ? `${c.short} is already on ${slot.tf}` : `Switch ${c.short} to ${slot.tf}` };
  }
  if (slot.kind === 'tool') { const armed = c.draft && c.draft.tool === slot.tool; return { label, name, icon: slot.icon, cap: armed ? 'Armed' : '', capOn: armed, status: 'ok', verb: `Draw ${name}`, action: `Draw a ${name} on ${c.short}` }; }
  if (slot.kind === 'tpl') return { label, name, icon: slot.icon, cap: '', status: 'ok', verb: `Apply ${name}`, action: `Apply ${name} to ${c.short}` };
  if (slot.kind === 'ind') { const on = !!(slot.ind && c.ind[slot.ind]); return { label, name, icon: slot.icon, cap: on ? 'On' : 'Off', capOn: on, status: 'ok', verb: `Turn ${on ? 'off' : 'on'} ${name}`, action: `Turn ${on ? 'off' : 'on'} ${name} · ${c.short}` }; }
  // Payoff: one switch for both charts, from either chart's panel (BR-32)
  if (!payoffAvailable()) return { label, name, icon: slot.icon, cap: 'No options', status: 'na', verb: 'Payoff needs an index with options', action: 'Payoff needs an index with options', scope: 'Both charts' };
  const on = PM.on;
  return { label, name, icon: slot.icon, cap: on ? 'On' : 'Off', capOn: on, status: 'ok', verb: on ? 'Hide payoff' : 'Show payoff', action: 'Breakeven and P&L at any level and time', scope: 'Both charts' };
}
function applySlot(i, id, meta = {}) {
  const slot = SLOTS[i], d = describe(slot, id);
  if (d.status === 'current' || d.status === 'na') return false;
  if (slot.kind === 'tf') setTimeframe(id, slot.tf, { route: meta.route });
  else if (slot.kind === 'tool') { if (DRAWABLE.has(slot.tool)) armTool(id, slot.tool, meta); else toast(`${d.name} is not drawn in this prototype`); }
  else if (slot.kind === 'ind') { if (slot.ind) toggleIndicator(id, slot.ind, meta); else toast(`${d.name} is not drawn in this prototype`); }
  else if (slot.kind === 'tpl') applyTemplate(id, slot.tpl);
  else setPayoff(!PM.on, { source: meta.route === 'q1' ? 'quick_actions' : 'panel', chart: id });
  return true;
}

/* ---- Geometry: where the panel sits and where each action is, in app coordinates ---- */
const MCTX = document.createElement('canvas').getContext('2d');
function tw(t, px, wt = 500) { MCTX.font = `${wt} ${px}px Inter, sans-serif`; return MCTX.measureText(t).width; }
const inRect = (p, r, pad = 0) => p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
function geometry(id) {
  const pr = rectIn($('.tfb', CH[id].el)), fs = S.fs || 1, f = Math.min(fs, 1.3);
  let w, hh; const cells = [], titles = [];
  if (S.qa === 'list') {
    const px = 14 * fs, rowH = Math.max(44, Math.round(px * 1.3 + 20)); let need = 228;
    for (const sl of SLOTS) { const d = describe(sl, id); need = Math.max(need, 14 + (d.big ? Math.max(18, tw(d.label, 13 * fs, 600)) : 18) + 12 + tw(d.name, px, 400) + 12 + (d.big ? 0 : tw(d.cap || 'Off', 11 * fs, 400)) + 14); }
    w = clamp(Math.ceil(need), 228, Math.min(L.W - 16, 340)); hh = SLOTS.length * rowH + 12;
    SLOTS.forEach((sl, i) => cells.push({ i, x: 0, y: 6 + i * rowH, w, h: rowH }));
  } else {
    // sections in the order of the slots; three pills a row (pills3) or two wider ones (pills)
    const cols = S.qa === 'pills' ? 2 : 3, pad = 14, gap = 10, th = Math.round(26 * f), ph = Math.round(34 * f), foot = Math.round(30 * f);
    w = Math.min(Math.round((cols === 3 ? 340 : 300) * f), L.W - 16); const cw = (w - 2 * pad - gap * (cols - 1)) / cols;
    let y = 8, grp = null, col = 0;
    SLOTS.forEach((sl, i) => {
      if (sl.grp !== grp) { if (grp != null) y += (col ? ph : 0) + 6; grp = sl.grp; col = 0; titles.push({ t: grp, y, h: th }); y += th; }
      else if (col === 0) y += 8;
      cells.push({ i, x: pad + col * (cw + gap), y, w: cw, h: ph }); col++;
      if (col === cols) { col = 0; y += ph; }
    });
    hh = y + (col ? ph : 0) + 10 + foot;
  }
  // The panel always opens downwards, under the button. Where the screen ends first (the option chart's button), it moves
  // up only as far as it must to fit, and may then cover the button: it never flips to open above it.
  const maxTop = L.H - L.sab - 8 - hh, ok = maxTop >= L.sat + 4;
  const top = Math.min(pr.y + pr.h + 6, maxTop), below = true;
  const x = clamp(pr.x + pr.w - w, 8, L.W - w - 8);
  return { kind: S.qa === 'list' ? 'list' : 'pills', cols: S.qa === 'list' ? 1 : S.qa === 'pills' ? 2 : 3, rect: { x, y: top, w, h: hh }, cells, titles, ok, reason: ok ? null : 'space', chart: id, above: !below, anchor: pr };
}
function hitTest(geo, p) {
  const q = { x: p.x - geo.rect.x, y: p.y - geo.rect.y }, pad = geo.kind === 'list' ? 0 : 5;
  // the button itself is never an action, also where the panel covers it: lifting the finger without sliding picks nothing
  if (inRect(p, geo.anchor, 6)) return { zone: 'inner' };
  const c = geo.cells.find(c => inRect(q, c, pad));
  if (c) return { zone: 'slot', i: c.i, chart: geo.chart };
  return { zone: inRect(p, geo.rect) ? 'gap' : 'outside' };
}

/* =========================================================================
   Gesture: idle → pending (300 ms, 10 px) → panel | fallback. 'drag' is a
   plain drag (price axis, time axis, split handle) that shares the plumbing.
   ========================================================================= */
const G = { st: 'idle' };
function startHold(e, id, el, handlers = {}) {
  if (G.st !== 'idle' || LAYERS.length) return false;
  const p = appPt(e);
  Object.assign(G, { st: 'pending', pid: e.pointerId, chart: id, el, p0: p, last: p, t0: now(), handlers, iid: 'qa-' + (++IID), hover: null, geo: null });
  try { el.setPointerCapture(e.pointerId); } catch {}
  el.classList.add('held');
  G.timer = setTimeout(onHold, HOLD_MS);
  showTouch(p);
  return true;
}
function onHold() {
  if (G.st !== 'pending') return;
  const id = G.chart, geo = geometry(id);
  G.geo = geo;
  if (geo.ok) { G.st = 'panel'; $('#ov').classList.add('on'); renderOverlay(); Haptic.fire('open', G.p0); track('panel_open', { chart: id, layout: geo.kind, iid: G.iid }); }
  else { G.st = 'fallback'; renderFallback(); Haptic.fire('open', G.p0); track('fallback_open', { chart: id, reason: geo.reason, iid: G.iid }); }
  dismissCoach(true);
}
function onMove(e) {
  if (G.st === 'idle' || e.pointerId !== G.pid) return;
  const p = appPt(e); G.last = p; showTouch(p);
  if (G.st === 'pending') {
    if (hyp(p.x - G.p0.x, p.y - G.p0.y) > SLOP) { clearTimeout(G.timer); hideTouch(); endGesture(); track('cancel', { reason: 'prehold_move' }); }
    return;
  }
  if (G.st === 'drag') { G.drag && G.drag.move(p, e); return; }
  if (G.st === 'panel') {
    const hit = hitTest(G.geo, p), key = hit.zone === 'slot' ? 's' + hit.i : hit.zone;
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
  const hit = hitTest(G.geo, p), ms = Math.round(now() - G.t0), iid = G.iid, chart = G.chart;
  endGesture();
  if (hit.zone !== 'slot') { Haptic.fire('cancel'); track('cancel', { reason: hit.zone, chart, ms, iid }); return; }
  const i = hit.i, d = describe(SLOTS[i], chart);
  if (d.status === 'current') { Haptic.fire('cancel'); toast(d.action); track('cancel', { reason: 'current', chart, slot: SLOTS[i].id, iid }); return; }
  if (d.status === 'na') { Haptic.fire('error', p); toast(d.action); track('cancel', { reason: 'unavailable', chart, slot: SLOTS[i].id, iid }); return; }
  applySlot(i, chart, { route: 'panel' }); Haptic.fire('success', p);
  track('commit', { chart, slot: SLOTS[i].id, ms, iid });
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
  $('#ov').classList.remove('on'); $$('.qlist, .qpanel, .fbhint', app).forEach(x => x.remove());
  hideTouch();
}
window.addEventListener('pointermove', onMove, true);
window.addEventListener('pointerup', onUp, true);
window.addEventListener('pointercancel', e => { if (G.st !== 'idle' && e.pointerId === G.pid) cancelGesture('interrupted'); }, true);
window.addEventListener('pointerdown', e => { if ((G.st === 'pending' || G.st === 'panel' || G.st === 'fallback') && e.pointerId !== G.pid) { e.stopPropagation(); cancelGesture('interrupted'); } }, true);
window.addEventListener('blur', () => cancelGesture('interrupted'));
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelGesture('interrupted'); });
app.addEventListener('contextmenu', e => e.preventDefault());

/* ---- The panel. One element per hold: rebuilding it on every hover change would replay its open animation ---- */
function renderOverlay() {
  const geo = G.geo, hov = G.hover; if (!geo) return;
  const id = geo.chart, r = geo.rect, hi = hov && hov.zone === 'slot' ? hov.i : -1, list = geo.kind === 'list';
  let el = $(list ? '#ov .qlist' : '#ov .qpanel');
  if (!el || el._geo !== geo) {
    if (el) el.remove();
    const style = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;transform-origin:${geo.above ? 'bottom' : 'top'} right`;
    if (list) el = h(`<div class="qlist fit" style="${style}">${geo.cells.map(c => { const d = describe(SLOTS[c.i], id); return `<div class="qli${d.status !== 'ok' ? ' na' : ''}" data-i="${c.i}" style="height:${c.h}px">${d.big ? `<b class="qtf">${escH(d.label)}</b>` : ic(d.icon, 18, 1.8)}<span class="qn">${escH(d.name)}</span><span class="s${d.capOn ? ' on' : ''}">${d.big ? '' : escH(d.cap)}</span></div>`; }).join('')}</div>`);
    else el = h(`<div class="qpanel${geo.cols === 3 ? ' c3' : ''}" style="${style}">${geo.titles.map(t => `<div class="qpt" style="top:${t.y}px;height:${t.h}px">${escH(t.t)}</div>`).join('')}${geo.cells.map(c => {
      const d = describe(SLOTS[c.i], id), on = d.capOn;
      return `<div class="qp${on ? ' on' : ''}${d.empty ? ' emp' : d.status === 'na' ? ' na' : ''}" data-i="${c.i}" style="left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px">${d.big || (on && geo.cols === 3) ? '' : ic(d.icon, 15, 1.9)}<span>${escH(d.label)}</span>${on ? ic('check', 13, 2.4, 'ck') : ''}</div>`;
    }).join('')}<div class="qpf"></div></div>`);
    el._geo = geo; $('#ov').appendChild(el);
  }
  $$('[data-i]', el).forEach(n => n.classList.toggle('hov', +n.dataset.i === hi));
  const f = $('.qpf', el); if (f) {
    const d = hi >= 0 ? describe(SLOTS[hi], id) : null;
    f.textContent = d ? `${d.status === 'ok' ? d.verb : d.action}${d.status === 'ok' ? ' · ' + (d.scope || CH[id].short) : ''}` : hov && (hov.zone === 'outside') ? 'Release to cancel' : `Slide to an action · ${CH[id].short}`;
    f.classList.toggle('act', !!d && d.status === 'ok');
  }
}
function renderFallback() {
  const p = G.p0, el = h('<div class="fbhint">Not enough room for the panel · release for Quick actions</div>');
  $('#ov').appendChild(el); const w = el.offsetWidth;
  el.style.left = clamp(p.x - w / 2, 8, L.W - w - 8) + 'px'; el.style.top = clamp(p.y + 28, L.sat + 8, L.H - 60) + 'px';
  if (p.y > L.H - 120) el.style.top = (p.y - 70) + 'px';
}
function showTouch(p) { const t = $('#touch'); t.style.left = p.x + 'px'; t.style.top = p.y + 'px'; t.classList.add('on'); }
function hideTouch() { $('#touch').classList.remove('on'); }

/* ---- Quick actions sheet (when the panel has no room, and the route without the gesture) ---- */
function openQ1(id, from = 'a11y') {
  const render = () => `<div class="qhead">Applies to <span class="chipx">${escH(CH[id].short)}</span><button class="chipx swap" style="margin-left:auto">Switch chart</button></div>` + SLOTS.map((sl, i) => {
    const d = describe(sl, id);
    return `<button class="qrow" data-i="${i}" aria-disabled="${d.status !== 'ok'}"><span class="qi">${d.big ? `<b style="font-size:13px;font-weight:600">${escH(d.label)}</b>` : ic(d.icon, 18, 1.8)}</span><span class="qt">${escH(d.name)}<small>${escH(d.action)}</small></span><span class="qs${d.capOn ? ' on' : ''}">${escH(d.cap)}</span></button>`;
  }).join('');
  const sh = h(`<div class="sheet lsheet" style="max-height:${L.H - L.sat - 40}px"><div class="sh-title">Quick actions</div><button class="sh-x" aria-label="Close">${ic('x', 18, 1.7)}</button><div class="rows"></div></div>`);
  $('.rows', sh).innerHTML = render();
  const layer = openLayer(sh, { label: 'Quick actions' });
  track('q1_open', { chart: id, from });
  sh.addEventListener('click', e => {
    if (e.target.closest('.sh-x')) return layer.close('close');
    if (e.target.closest('.swap')) { id = other(id); S.focus = id; $('.rows', sh).innerHTML = render(); return; }
    const b = e.target.closest('.qrow'); if (!b) return;
    const i = +b.dataset.i; if (b.getAttribute('aria-disabled') === 'true') return toast(describe(SLOTS[i], id).action);
    layer.close('picked'); applySlot(i, id, { route: 'q1' }); Haptic.fire('success'); track('commit', { chart: id, slot: SLOTS[i].id, route: 'q1' });
  });
}
