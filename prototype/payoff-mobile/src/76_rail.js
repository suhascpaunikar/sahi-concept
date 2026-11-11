/* =========================================================================
   Time rail (UX-03) in a strip between the charts (UX-04), and the most a
   position can lose (UX-20). Used when the improved Payoff is on (uxB).
   - The strip names the mode, closes it, and holds the rail.
   - The rail sets the point's time: Now to the end of the future zone. Today's
     session takes a third of it and each later session an equal share. It stops
     at each hour, the 3:20 pm square-off, session ends and expiries.
   - Dragging the point on the chart then sets only its level.
   ========================================================================= */
function railModel(b) {
  const now = MK.nowT(), end = poAxisEnd(b);
  if (end == null || end <= now + 1e-6 || !PM.pt) return null;
  const key = `${PM.ver}|${Math.round(now)}|${end}`;
  if (PM.railM && PM.railM.key === key) return PM.railM;
  const SS = E.SESSION, di0 = Math.floor(now / SS + 1e-9), c0 = (di0 + 1) * SS, segs = [];
  if (end <= c0 + 1e-6) segs.push({ a: now, z: end, x0: 0, x1: 1 });
  else {
    const rest = []; for (let a = c0; a < end - 1e-6; a += SS) rest.push([a, Math.min(end, a + SS)]);
    const w0 = c0 - now > 1 ? 1 / 3 : 0, w = (1 - w0) / rest.length;
    if (w0) segs.push({ a: now, z: c0, x0: 0, x1: w0 });
    rest.forEach(([a, z], k) => segs.push({ a, z, x0: w0 + k * w, x1: w0 + (k + 1) * w }));
  }
  const f = T => { T = clamp(T, now, end); const s = segs.find(q => T <= q.z + 1e-9) || segs[segs.length - 1]; return s.x0 + (T - s.a) / (s.z - s.a) * (s.x1 - s.x0); };
  const inv = x => { x = clamp(x, 0, 1); const s = segs.find(q => x <= q.x1 + 1e-9) || segs[segs.length - 1]; return s.a + (x - s.x0) / (s.x1 - s.x0) * (s.z - s.a); };
  const map = new Map(), add = (T, t, kind, pri) => { if (T < now - 1e-6 || T > end + 1e-6) return; const k = Math.round(T * 100), o = map.get(k); if (!o || pri > o.pri) map.set(k, { T, t, kind, pri }); };
  add(now, 'Now', 'now', 5);
  for (let h = 10; h <= 15; h++) { const T = E.tOf(di0, h * 60); if (T > now + 10 && T < Math.min(c0, end) - 10) add(T, `${h > 12 ? h - 12 : h} ${h >= 12 ? 'pm' : 'am'}`, 'h', 1); }
  if (!b.pretrade && b.legs.some(l => l.product === 'INTRADAY')) add(PF.SQ_T, '3:20', 'sq', 3);
  for (let c = c0, k = 0; c <= end + 1e-6; c += SS, k++) { const d = E.DAYS[Math.round(c / SS) - 1]; add(c, k === 0 && di0 === E.TODAY ? '3:30' : d ? d.label.split(' ')[0] : '', 'day', k === 0 ? 4 : 2); }
  for (const l of b.legs) if (l.c.expT > now && (l.product === 'CARRY' || b.pretrade)) add(l.c.expT, l.c.exp.info.short, 'exp', 6);
  return PM.railM = { key, now, end, f, inv, stops: [...map.values()].sort((p, q) => p.T - q.T) };
}
function renderRail() {
  const st = $('#pstrip'); if (!st) return;
  const show = PM.on && uxB(); st.hidden = !show; if (!show) return;
  st.style.top = L.stripY + 'px';
  const b = book(), m = poPriced() ? railModel(b) : null, rail = $('.prail', st);
  rail.hidden = !m; if (!m) return;
  const W = rail.clientWidth, fs = Math.min(S.fs || 1, 1.3), k = `${m.key}|${W}|${fs}`;
  if (rail._k !== k) {
    // ticks at every stop; labels by priority, dropped when they would overlap
    const placed = [], lab = [];
    for (const s of m.stops.slice().sort((p, q) => q.pri - p.pri)) {
      if (!s.t) continue; const x = m.f(s.T) * W, w = (s.t.length * 6.1 + 6) * fs, l = clamp(x - w / 2, 0, W - w);
      if (placed.some(p => l < p[1] + 4 && l + w > p[0] - 4)) continue;
      placed.push([l, l + w]); lab.push(`<span class="lb ${s.kind}" style="left:${l.toFixed(1)}px;width:${w.toFixed(1)}px">${s.t}</span>`);
    }
    $('.tks', rail).innerHTML = m.stops.map(s => `<i class="tk ${s.kind}" style="left:${(m.f(s.T) * W).toFixed(1)}px"></i>`).join('') + lab.join('');
    rail._k = k;
  }
  const x = m.f(PM.pt.T) * W; $('.th', rail).style.left = x + 'px'; $('.fill', rail).style.width = x + 'px';
  rail.setAttribute('aria-valuetext', ptTime(PM.pt.T));
}
// keep the point in view while the rail moves it; on release, bring Now back into view if it scrolled away
function railView(done) {
  const T = PM.pt.T, now = MK.nowT();
  for (const id of PM.s3 ? ['idx'] : ['idx', 'opt']) {
    const g = geomOf(id), x = xAtT(g, T), m = id === 'idx' ? 14 : 24;
    if (x > g.paneR - m) CH[id].ro += (x - (g.paneR - m)) / g.s; else if (x < m) CH[id].ro -= (m - x) / g.s;
  }
  if (done) {
    const g = geomOf('idx');
    if (xAtT(g, now) < 0) { fitTo(Math.max(T, sessionEndT(book())), 'rail'); return; }
    fitPrice();
  }
  redraw(); renderPayoffUI();
}
function railAt(e, done) {
  const rail = $('#pstrip .prail'), m = PM.railM; if (!rail || !m || !PM.pt) return;
  const r = rail.getBoundingClientRect(), W = rail.clientWidth, sc = r.width / W || 1, x = clamp((e.clientX - r.left) / sc, 0, W);
  let T = m.inv(x / W), hit = null;
  for (const s of m.stops) { const d = Math.abs(m.f(s.T) * W - x); if (d < 8 && (!hit || d < hit.d)) hit = { s, d }; }
  if (hit) T = hit.s.T;
  const g = geomOf('idx'), rg = ptRange(g); if (!rg) return;
  const Ts = g.slotAt(clamp(slotOfT(g, T), rg[0], rg[1])).T1;
  if (hit && hit.s.kind !== 'now' && PM.railStop !== hit.s.T) Haptic.fire('select');
  PM.railStop = hit ? hit.s.T : null;
  if (Ts !== PM.pt.T) setPoint({ T: Ts, S: PM.pt.S }, 'drag', { quiet: true });
  railView(done);
}
function bindRail() {
  if (!$('#pstrip')) app.appendChild(h(`<div class="pstrip" id="pstrip" hidden><button class="pspill" aria-label="Close payoff">Payoff<span>${ic('x', 13, 2.4)}</span></button><div class="prail" role="slider" tabindex="0" aria-label="Time of the Payoff point"><i class="trk"></i><i class="fill"></i><div class="tks"></div><i class="th"></i></div></div>`));
  const st = $('#pstrip'), rail = $('.prail', st); let drag = null;
  $('.pspill', st).addEventListener('click', () => setPayoff(false, { source: 'strip' }));
  rail.addEventListener('pointerdown', e => { drag = e.pointerId; try { rail.setPointerCapture(e.pointerId); } catch {} rail.classList.add('drag'); PM.railStop = null; railAt(e, false); e.preventDefault(); });
  rail.addEventListener('pointermove', e => { if (drag === e.pointerId) railAt(e, false); });
  const end = e => { if (drag !== e.pointerId) return; drag = null; rail.classList.remove('drag'); railAt(e, true); track('payoff_point_move', { method: 'rail', sessions_ahead: +((PM.pt.T - MK.nowT()) / E.SESSION).toFixed(2) }); };
  rail.addEventListener('pointerup', end); rail.addEventListener('pointercancel', end);
  rail.addEventListener('keydown', e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); stepPoint(e.key === 'ArrowRight' ? 't+' : 't-'); railView(true); } });
}

/* ---------- UX-19: open the point at the trader's horizon ---------- */
// 30 minutes ahead when every position is intraday or expires today; null keeps the session end
function horizonT(b, g) {
  if (!uxB() || !b.legs.length || MK.closed()) return null;
  const now = MK.nowT(), today = l => l.product === 'INTRADAY' || (l.c.type !== 'FUT' && E.dayOfT(l.c.expT - 1e-6) === E.TODAY);
  if (!b.legs.every(today)) return null;
  const rg = ptRange(g); if (!rg) return null;
  return g.slotAt(clamp(slotOfT(g, Math.min(now + 30, sessionEndT(b))), rg[0], rg[1])).T1;
}

/* ---------- UX-20: the most the position can lose ---------- */
// short: one line for the option chart's point card; the point sheet gives the reason too
function maxLossTxt(b, short) {
  if (!b.legs.length) return '';
  if (b.legs.length > 1) { const st = panelStats(b); return st.maxL === -Infinity ? 'Loss isn’t capped' : `Most you can lose: ${E.rupees(Math.round(Math.abs(Math.min(0, st.maxL))))}${short ? '' : ' at expiry'}`; }
  const l = b.legs[0], c = l.c, at = short ? '' : ' at expiry';
  if (c.type === 'FUT') return `Loss isn’t capped ${l.side > 0 ? 'below' : 'above'} ${lvl(l.avg)}`;
  if (l.side > 0) return `Most you can lose: ${E.rupees(Math.round(l.avg * l.qty))}${short ? '' : `, the premium${b.pretrade ? '' : ' paid'}`}`;
  return c.type === 'PE' ? `Loss isn’t capped below ${lvl(c.strike - l.avg)}${at}` : `Loss isn’t capped above ${lvl(c.strike + l.avg)}${at}`;
}
