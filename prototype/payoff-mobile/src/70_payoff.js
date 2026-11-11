/* =========================================================================
   Payoff on mobile (Payoff mobile PRD v1.0)
   S2 one position, S3 several positions, the Payoff point, the docked readout,
   the option chart's point card, the Payoff list, B1 Payoff point sheet,
   B2 Confirm order sheet and N3 (Later release), N1 tip, N2 banner, the
   order panel, and the demo positions. Values come from the desktop Payoff
   engine: Black-Scholes on trading time with IV held (BR-08), range from
   IV moving down 2.5 or up 3 points (BR-09, open item).
   ========================================================================= */
// The Payoff bar grows a little with the phone's text size (BR-35)
const pbarH = () => S.ux !== 'a' ? 0 : Math.round(34 * Math.min(S.fs || 1, 1.3));   // the improved Payoff has no bar: the header's Payoff button closes it, and the point is moved on the chart
const PM = {
  on: false, s3: false, pt: null, chip: null, strike: null, ver: 0, cache: new Map(), optCache: null,
  scenario: store.get('scenario', 'single'), product: 'CARRY', legs: [], others: [], realised: 0, lots: 1, preAvg: null,
  views: null, prevOpt: null, openedAt: 0, later: store.get('later', false), orderFail: false, orders: {}, exits: [],
  tipSeen: store.get('tipSeen', false), hintSeen: store.get('hintSeen', false), hint: false, b1: false, b2: null,
  bannerClosed: false, crossSign: 0, crossExp: null, lastMoveLog: 0,
};

/* ---------- sample positions: the desktop prototype's scenarios on real Kite data ---------- */
const PC = (t, k, e) => E.contract(t, k, e);
const CE19 = PC('CE', 22500, '2026-10-19'), PE19 = PC('PE', 22500, '2026-10-19');
let legSeq = 1;
const mkLeg = (c, side, avg, product = 'CARRY', qty = E.LOT) => ({ id: legSeq++, c, side, qty, avg, product });
const priceAt = (c, day, hh, mm) => E.roundTick(Math.max(E.TICK, E.optionPriceAt(c, E.tOf(E.dayIdx(day), hh * 60 + mm))));
const TODAY_KEY = E.DAYS[E.TODAY].key;
const entryAt = (c, p, day, hh, mm) => p === 'INTRADAY' ? priceAt(c, TODAY_KEY, 9, 20) : priceAt(c, day, hh, mm);
const SCEN = {
  single: { name: 'Bought call · 19 Oct 22500', group: 'One position (S2)', product: true, legs: p => [mkLeg(CE19, 1, entryAt(CE19, p, '2026-10-09', 10, 0), p)], opt: CE19 },
  boughtput: { name: 'Bought put · 19 Oct 22500', group: 'One position (S2)', product: true, legs: p => [mkLeg(PE19, 1, entryAt(PE19, p, '2026-10-13', 14, 0), p)], opt: PE19 },
  soldput: { name: 'Sold put · 19 Oct 22500', group: 'One position (S2)', product: true, legs: p => [mkLeg(PE19, -1, entryAt(PE19, p, '2026-10-12', 11, 0), p)], opt: PE19 },
  pretrade: { name: 'Not holding · pre-trade', group: 'No position (S2)', legs: () => [], opt: CE19 },
  empty: { name: 'Not holding · no contract loaded', group: 'No position (S2)', legs: () => [], opt: null },
  book: {
    name: 'Weekly + monthly book', group: 'Several positions (S3)', opt: CE19, realised: 1240,
    others: [{ label: 'BANKNIFTY 27 Oct 51500 Call', und: 'BANKNIFTY' }],
    legs: () => [mkLeg(PE19, -1, priceAt(PE19, '2026-10-08', 10, 30)), mkLeg(PC('CE', 22950, '2026-10-19'), -1, priceAt(PC('CE', 22950, '2026-10-19'), '2026-10-08', 10, 30)), mkLeg(PC('CE', 22500, '2026-10-27'), 1, priceAt(PC('CE', 22500, '2026-10-27'), '2026-10-09', 11, 0))]
  },
  condor: { name: 'Iron condor · 19 Oct', group: 'Several positions (S3)', opt: PE19, legs: () => [[PC('PE', 22200, '2026-10-19'), 1], [PE19, -1], [PC('CE', 22900, '2026-10-19'), -1], [PC('CE', 23100, '2026-10-19'), 1]].map(([c, sd]) => mkLeg(c, sd, priceAt(c, '2026-10-12', 10, 0))) },
  straddle: { name: 'Long straddle · 19 Oct 22500', group: 'Several positions (S3)', opt: CE19, legs: () => [mkLeg(CE19, 1, priceAt(CE19, '2026-10-13', 9, 30)), mkLeg(PE19, 1, priceAt(PE19, '2026-10-13', 9, 30))] },
  shortstraddle: { name: 'Short straddle · 19 Oct 22500', group: 'Several positions (S3)', opt: CE19, legs: () => [mkLeg(CE19, -1, priceAt(CE19, '2026-10-12', 15, 0)), mkLeg(PE19, -1, priceAt(PE19, '2026-10-12', 15, 0))] },
  calendar: { name: 'Calendar spread · 22500 Call', group: 'Several positions (S3)', opt: CE19, legs: () => [mkLeg(CE19, -1, priceAt(CE19, '2026-10-09', 14, 0)), mkLeg(PC('CE', 22500, '2026-10-27'), 1, priceAt(PC('CE', 22500, '2026-10-27'), '2026-10-09', 14, 0))] },
  futures: { name: 'Futures + protective put', group: 'Several positions (S3)', opt: PC('PE', 22500, '2026-10-27'), legs: () => [mkLeg(PC('FUT', 0, '2026-10-27'), 1, priceAt(PC('FUT', 0, '2026-10-27'), '2026-10-08', 10, 0)), mkLeg(PC('PE', 22500, '2026-10-27'), 1, priceAt(PC('PE', 22500, '2026-10-27'), '2026-10-08', 10, 0))] },
  mixed: { name: 'Intraday call + carry-forward put', group: 'Several positions (S3)', opt: CE19, legs: () => [mkLeg(CE19, 1, priceAt(CE19, TODAY_KEY, 9, 20), 'INTRADAY'), mkLeg(PE19, -1, priceAt(PE19, '2026-10-12', 11, 0))] },
};
const CLOCKS = [[570, '9:30 am'], [675, '11:15 am'], [REAL_END_MOD, `${E.clock(REAL_END_MOD)} · latest data`], [905, '3:05 pm · simulated'], [945, '3:45 pm · closed']];

/* ---------- the book Payoff prices (BR-01, BR-02, BR-14) ---------- */
const expiredC = c => c.type !== 'FUT' && c.expT <= MK.nowT();
function book() {
  const T = MK.nowT();
  const all = PM.legs.filter(l => l.c.und === 'NIFTY' && l.qty > 0);
  const legs = all.filter(l => !expiredC(l.c)), settled = all.filter(l => expiredC(l.c));
  const b = { legs, settled, all, nowT: T, S0: MK.S0(), closed: MK.closed(), pretrade: false };
  if (!all.length && MK.opt && !expiredC(MK.opt)) {
    if (PM.preAvg == null) PM.preAvg = MK.optLtp();
    b.pretrade = true; b.legs = [{ id: 0, c: MK.opt, side: 1, qty: PM.lots * E.LOT, avg: PM.preAvg, product: 'CARRY' }]; b.all = b.legs;
  }
  return b;
}
const positionCount = () => new Set(PM.legs.filter(l => l.c.und === 'NIFTY' && l.qty > 0).map(l => l.c.id)).size;
const isS3 = () => positionCount() >= 2;
const payoffAvailable = () => true;   // the top chart is NIFTY 50, an index with listed options (BR-01)
const poPriced = () => MK.pricing !== 'unavailable';
const poEmpty = b => !b.legs.length && !b.settled.length;
const expiredBook = b => !b.pretrade && !b.legs.length && b.settled.length > 0;
function poAxisEnd(b = book()) { if (!b.legs.length) return expiredBook(b) ? MK.nowT() : null; return PF.axisEnd(b); }
function payoffAxisLimit() { if (!PM.on) return 0; const e = poAxisEnd(); return e == null ? 0 : e; }
// End of the session the point opens on (BR-24, BR-28): today's close, 3:20 pm for an intraday-only book, the axis end if sooner, the next session's close after the market closes
function sessionEndT(b = book()) {
  let T = MK.closed() ? (E.TODAY + 2) * E.SESSION : (E.TODAY + 1) * E.SESSION;
  if (!MK.closed() && b.legs.length && !b.pretrade && b.legs.every(l => l.product === 'INTRADAY')) T = PF.SQ_T;
  const end = poAxisEnd(b); if (end != null) T = Math.min(T, end);
  return T;
}

/* ---------- formatting ---------- */
const lvl = n => E.level(n);
function ptTime(T) { const { di, mod } = E.split(T); return di === E.TODAY ? `${E.clock(mod)} today` : `${E.clock(mod)}, ${E.DAYS[di].label}`; }
function ptTimeShort(T) { const { di, mod } = E.split(T); return di === E.TODAY ? E.clock(mod) : `${E.DAYS[di].label.slice(0, 3)} ${E.clock(mod)}`; }
// canvas labels grow with the phone's text size, up to 1.3x, so they don't cover the chart
const fsC = () => Math.min(S.fs || 1, 1.3);
const pnlCls = v => Math.round(v) > 0 ? 'up' : Math.round(v) < 0 ? 'dn' : '';
const sgn = v => E.signed(v);
const idxName = () => 'Nifty';
const expLabel = e => `${e.kind === 'Monthly' ? 'Monthly' : 'Weekly'} expiry · ${e.info.label}`;

/* ---------- geometry helpers on the chart's slots ---------- */
function xAtT(g, T) {
  const N = g.N; if (!N) return null;
  let lo = 0, hi = N - 1;
  const T0 = i => { const b = g.slotAt(i); return b && b.T0 != null ? b.T0 : -Infinity; };
  if (T >= g.slotAt(hi).T1) return g.xOf(hi) + g.s / 2;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T0(m) <= T) lo = m; else hi = m; }
  if (T0(hi) <= T) lo = hi;
  const b = g.slotAt(lo); if (b.T0 == null) return g.xOf(lo);
  const f = b.T1 > b.T0 ? clamp((T - b.T0) / (b.T1 - b.T0), 0, 1) : 0;
  return g.xOf(lo) - g.s / 2 + f * g.s;
}
// index of the slot whose close is T, or the slot that contains T
function slotOfT(g, T) {
  let lo = 0, hi = g.N - 1;
  const T1 = i => g.slotAt(i).T1 ?? -Infinity;
  if (T > T1(hi)) return hi;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T1(m) < T - 1e-9) lo = m; else hi = m; }
  return T1(lo) >= T - 1e-9 ? lo : hi;
}
const iOfX = (g, x) => Math.round(g.n - 1 - ((g.paneR - x) / g.s - g.c.ro));
// The slots the point may use: closes after Now, up to the axis end (BR-13, BR-26)
function ptRange(g) {
  const b = book(), end = poAxisEnd(b); if (end == null) return null;
  const now = MK.nowT(); let a = slotOfT(g, now + 1e-6); if (g.slotAt(a).T1 <= now + 1e-6) a++;
  let z = slotOfT(g, end); if (g.slotAt(z).T1 > end + 1e-6) z--;
  return a <= z ? [a, z] : null;
}
const snap5 = S => Math.round(S / 5) * 5;

/* ---------- pricing at the point ---------- */
function pointVals(b = book(), pt = PM.pt) {
  if (!pt || !b.legs.length) return null;
  const { T, S } = pt, out = { T, S };
  out.pnl = PF.pnl(b, S, T);
  const fixed = b.legs.every(l => l.c.type !== 'FUT' && T >= l.c.expT) && !b.legs.some(l => l.c.type === 'FUT');
  // the range always contains the value itself: a book with long and short vega can peak between the two IV cases
  const [lo, hi] = PF.range(b, S, T); out.lo = Math.min(lo, out.pnl); out.hi = Math.max(hi, out.pnl); out.fixed = fixed;
  out.flat = PF.pnl(b, snap5(b.S0), T); out.flatS = snap5(b.S0);
  if (!PM.s3 && b.legs.length === 1) {
    const l = b.legs[0], d = PF.legDetail(l, S, T, b);
    out.leg = l; out.prem = d.value; out.premLo = d.lo; out.premHi = d.hi; out.uncertain = d.uncertain; out.timeValue = d.timeValue;
    out.atExpiry = l.c.type !== 'FUT' && T >= l.c.expT; if (out.atExpiry) out.worth = E.intrinsic(l.c, S);
    out.worthAtExp = E.intrinsic(l.c, S);
  } else out.uncertain = false;
  return out;
}

/* ---------- breakevens: roots of the book's P&L per slot, cached per book version (BR-07) ---------- */
const SAMPLE = 25;
function slotRoots(b, T) {
  const key = T; let v = PM.cache.get(key); if (v) return v;
  const lo = Math.floor(b.S0 * .9 / SAMPLE) * SAMPLE, hi = Math.ceil(b.S0 * 1.1 / SAMPLE) * SAMPLE, roots = [];
  let pS = lo, pV = PF.pnl(b, lo, T); const signLow = pV > 0 ? 1 : -1;
  for (let S = lo + SAMPLE; S <= hi; S += SAMPLE) {
    const vv = PF.pnl(b, S, T);
    if ((pV <= 0) !== (vv <= 0)) {
      let a = pS, z = S, fa = pV;
      for (let k = 0; k < 8; k++) { const m = (a + z) / 2, fm = PF.pnl(b, m, T); if ((fa <= 0) === (fm <= 0)) { a = m; fa = fm; } else z = m; }
      roots.push((a + z) / 2);
    }
    pS = S; pV = vv;
  }
  v = { roots, signLow }; PM.cache.set(key, v); return v;
}
// sign of P&L at level S using the cached roots
function signAt(r, S) { let s = r.signLow; for (const x of r.roots) if (S > x) s = -s; return s; }

/* ---------- improved Payoff (UX research note v1.1): UX-01, UX-02, UX-05. ?ux=a turns it off ---------- */
const uxB = () => S.ux !== 'a';
// UX-01: widen the index chart's price scale so the nearest breakeven on each side of the current level,
// at the point's time, is in view. It stops when the candles in view would take less than 20% of the pane's
// height; a breakeven further out keeps its edge label, and tapping that label fits it anyway (full).
function priceFit(full) {
  if (!uxB() || !PM.on || !PM.pt || !poPriced()) return null;
  const b = book(); if (!b.legs.length) return null;
  const c = CH.idx, keep = c.ys; c.ys = PM.ys0 || null;
  const g = geomOf('idx'); c.ys = keep;
  const lo = g.y2p(g.pB), hi = g.y2p(g.pT), cap = full ? Infinity : Math.max(hi - lo, (g.hi - g.lo) / .2);
  const r = slotRoots(b, PM.pt.T).roots, S0 = b.S0;
  const dn = r.filter(x => x < S0).sort((a, z) => z - a)[0], up = r.filter(x => x > S0).sort((a, z) => a - z)[0];
  const span = (a, z) => { let l = lo, h = hi; if (a != null && a < l) l = a; if (z != null && z > h) h = z; const pad = (h - l) * .1; if (l < lo) l -= pad; if (h > hi) h += pad; return { lo: l, hi: h }; };
  const near = dn == null ? [null, up] : up == null ? [dn, null] : (S0 - dn <= up - S0 ? [dn, null] : [null, up]);
  for (const [a, z] of [[dn, up], near]) { const s = span(a, z); if (s.hi - s.lo <= cap + 1e-6) return (s.lo < lo || s.hi > hi) ? s : null; }
  return null;
}
function fitPrice(full) {
  if (!uxB() || !PM.on) return;
  const s = priceFit(full); CH.idx.ys = s || PM.ys0 || null;
}
// the edge label of an off-screen breakeven is a button (UX-01): q is in card coordinates
function beEdgeHit(q) { return uxB() && (PM.beBtns || []).find(r => q.x >= r.x - 6 && q.x <= r.x + r.w + 6 && q.y >= r.y - 15 && q.y <= r.y + r.h + 15); }
// UX-02: the readout says what the point means, how it compares with now, what moves the range and what the position needs
const ptsTxt = n => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(Math.round(n))}`;
function whenTxt(T, stay) { const { di, mod } = E.split(T), w = stay ? 'till' : 'at'; return di === E.TODAY ? `${w} ${E.clock(mod)}` : `${w} ${E.clock(mod)}, ${E.DAYS[di].label}`; }
function plain(b, v) {
  const stay = v.S === snap5(b.S0), hasOpt = b.legs.some(l => l.c.type !== 'FUT');
  const o = { head: `${stay ? `If ${idxName()} stays at` : `If ${idxName()} is at`} ${lvl(v.S)} ${whenTxt(v.T, stay)}`, vs: '', iv: '', needs: '' };
  if (b.pretrade) o.vs = `If you buy ${b.legs[0].qty} now at ${E.prem(b.legs[0].avg)}`;
  else { const d = v.pnl - PF.pnl(b, b.S0, MK.nowT()); o.vs = `<b class="vsn ${pnlCls(d)}">${sgn(d)}</b> vs now${stay && hasOpt && Math.round(d) ? ' · time decay' : ''}`; }
  if (!v.fixed) { const a = Math.round(v.lo), z = Math.round(v.hi), m = Math.round(v.pnl); o.iv = a === m && z === m ? '' : z === m ? `If IV moves: down to ${sgn(v.lo)}` : a === m ? `If IV moves: up to ${sgn(v.hi)}` : `If IV moves: ${sgn(v.lo)} to ${sgn(v.hi)}`; }
  if (b.pretrade || Math.round(v.pnl) < 0) {
    const r = slotRoots(b, v.T), x = r.roots.slice().sort((p, q) => Math.abs(p - b.S0) - Math.abs(q - b.S0))[0];
    if (x != null) { const above = signAt(r, x + 1) > 0, lv2 = above ? Math.ceil(x) : Math.floor(x); o.needs = `Needs ${idxName()} ${above ? 'above' : 'below'} ${lvl(lv2)} (${ptsTxt(lv2 - b.S0)})`; }
  }
  return o;
}

/* ---------- drawing ---------- */
const PO_COL = { be: '#f0b93a', pt: '#7f9bff', up: 'rgba(8,153,129,.16)', dn: 'rgba(242,54,69,.11)', zone: 'rgba(255,255,255,.035)', strike: '#b0b6c3' };
function payoffYRange(id, info) {
  if (!PM.on || id !== 'opt' || PM.s3 || !poPriced()) return null;
  const b = book(); if (!b.legs.length || b.legs.length > 1) return null;
  const l = b.legs[0]; let lo = l.avg, hi = l.avg;
  const v = pointVals(b); if (v && v.premLo != null) { lo = Math.min(lo, v.premLo); hi = Math.max(hi, v.premHi); }
  return [lo, hi];
}
function payoffUnder(id, ctx, g) {
  if (!PM.on) return;
  if (id === 'opt' && PM.s3) return;
  const b = book(), end = poAxisEnd(b), nowX = xAtT(g, MK.nowT());
  const endX = end != null ? xAtT(g, end) : g.paneR;
  if (nowX < g.paneR) { ctx.fillStyle = PO_COL.zone; ctx.fillRect(nowX, g.pT, Math.max(0, Math.min(endX, g.paneR) - nowX), g.pB - g.pT); }
  if (id === 'idx' && poPriced() && b.legs.length) drawShading(ctx, g, b, nowX, endX);
  if (end != null && endX < g.paneR) drawStripes(ctx, g, Math.max(endX, -2), expiredBook(b) ? 'Expired' : b.legs.length && !b.pretrade && b.legs.every(l => l.product === 'INTRADAY') && !MK.closed() ? 'After auto square-off' : 'After expiry');
}
function drawStripes(ctx, g, x0, label) {
  ctx.save(); ctx.beginPath(); ctx.rect(x0, g.pT, g.paneR - x0, g.pB - g.pT); ctx.clip();
  ctx.fillStyle = 'rgba(23,23,23,.55)'; ctx.fillRect(x0, g.pT, g.paneR - x0, g.pB - g.pT);
  ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 6;
  const off = (g.xOf(0) % 14 + 14) % 14;
  for (let x = x0 - (g.pB - g.pT) - 14 + ((off - x0) % 14 + 14) % 14; x < g.paneR + 14; x += 14) { ctx.beginPath(); ctx.moveTo(x, g.pB); ctx.lineTo(x + (g.pB - g.pT), g.pT); ctx.stroke(); }
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(Math.round(x0) + .5, g.pT); ctx.lineTo(Math.round(x0) + .5, g.pB); ctx.stroke();
  const w = g.paneR - x0;
  if (w > 64) { ctx.font = `500 ${11 * fsC()}px Inter, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, x0 + w / 2, (g.pT + g.pB) / 2); ctx.textAlign = 'left'; }
}
function visSlots(g, nowX, endX) {
  const out = [];
  const a = Math.max(0, iOfX(g, Math.max(0, nowX)) - 1), z = Math.min(g.N - 1, iOfX(g, Math.min(g.paneR, endX)) + 1);
  const now = MK.nowT(), end = poAxisEnd();
  for (let i = a; i <= z; i++) { const sl = g.slotAt(i); if (!sl || sl.T1 == null || sl.T1 <= now + 1e-6 || sl.T1 > end + 1e-6) continue; out.push(i); }
  return out;
}
function drawShading(ctx, g, b, nowX, endX) {
  const vis = visSlots(g, nowX, endX); if (!vis.length) return;
  const top = g.y2p(g.pT), bot = g.y2p(g.pB);
  ctx.save(); ctx.beginPath(); ctx.rect(nowX, g.pT, Math.min(endX, g.paneR) - nowX, g.pB - g.pT); ctx.clip();
  const path = new Path2D(), loss = new Path2D();
  vis.forEach((i, k) => {
    const r = slotRoots(b, g.slotAt(i).T1);
    // each slot spans from its left edge to its right edge; the first one starts at Now
    const xa = k === 0 ? nowX : Math.round(g.xOf(i) - g.s / 2), xb = Math.round(g.xOf(i) + g.s / 2);
    const cuts = [bot, ...r.roots.filter(v => v > bot && v < top), top];
    for (let q = 0; q < cuts.length - 1; q++) { const mid = (cuts[q] + cuts[q + 1]) / 2, y1 = g.p2y(cuts[q + 1]), y0 = g.p2y(cuts[q]); (signAt(r, mid) > 0 ? path : loss).rect(xa, y1, Math.max(0, xb - xa), y0 - y1); }
  });
  ctx.fillStyle = PO_COL.up; ctx.fill(path, 'nonzero');
  if (uxB()) { ctx.fillStyle = PO_COL.dn; ctx.fill(loss, 'nonzero'); }   // UX-01: the loss side is shaded too, lighter
  ctx.restore();
}
function payoffOver(id, ctx, g) {
  if (!PM.on) return;
  const b = book(), now = MK.nowT(), nowX = xAtT(g, now), end = poAxisEnd(b), endX = end != null ? xAtT(g, end) : g.paneR;
  const fs = fsC();
  if (id === 'opt') { if (!PM.s3) drawOptOverlay(ctx, g, b, nowX, endX); drawNow(ctx, g, nowX); return; }
  drawNow(ctx, g, nowX);
  if (!poPriced() || !b.legs.length) return;
  // expiry and auto square-off markers (BR-06)
  const marks = [];
  const exps = [...new Map(b.legs.filter(l => l.c.type !== 'FUT' || true).map(l => [l.c.exp.key, l.c.exp])).values()].sort((a, c) => a.T - c.T);
  const carry = b.legs.filter(l => l.product === 'CARRY');
  if (!b.pretrade && b.legs.every(l => l.product === 'INTRADAY') && !MK.closed()) marks.push({ T: PF.SQ_T, t: 'Auto square-off · 3:20 pm', s: 'Square-off · 3:20' });
  else for (const e of exps) if (b.pretrade || carry.some(l => l.c.exp.key === e.key)) marks.push({ T: e.T, t: expLabel(e) + (e.movedFrom ? '' : ''), s: `Expiry · ${e.info.short}`, sub: e.movedFrom ? `moved from ${e.movedFrom.label}` : '' });
  ctx.save(); ctx.font = `500 ${10.5 * fs}px Inter, sans-serif`; ctx.textBaseline = 'top';
  for (const m of marks) {
    if (m.T <= now) continue;
    const x = Math.round(xAtT(g, m.T)) + .5; if (x < 0 || x > g.paneR + 1) continue;
    ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, g.pT); ctx.lineTo(x, g.pB); ctx.stroke(); ctx.setLineDash([]);
    let txt = m.t; let w = ctx.measureText(txt).width;
    if (x - w - 10 < Math.max(0, nowX)) { txt = m.s; w = ctx.measureText(txt).width; }
    const lx = Math.max(2, x - w - 8);
    ctx.fillStyle = 'rgba(23,23,23,.85)'; ctx.fillRect(lx - 3, g.pT + 3, w + 6, 15 * fs);
    ctx.fillStyle = 'rgba(255,255,255,.82)'; ctx.fillText(txt, lx, g.pT + 5);
    if (m.sub && txt === m.t) { const sw = ctx.measureText(m.sub).width; ctx.fillStyle = 'rgba(23,23,23,.85)'; ctx.fillRect(x - sw - 11, g.pT + 3 + 15 * fs, sw + 6, 14 * fs); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillText(m.sub, x - sw - 8, g.pT + 5 + 15 * fs); }
  }
  ctx.restore();
  // breakeven lines (BR-07)
  const vis = visSlots(g, nowX, endX), top = g.y2p(g.pT), bot = g.y2p(g.pB);
  ctx.save(); ctx.beginPath(); ctx.rect(0, g.pT, g.paneR, g.pB - g.pT); ctx.clip();
  ctx.strokeStyle = PO_COL.be; ctx.lineWidth = 1.6; ctx.lineJoin = 'round';
  let prev = null;
  for (const i of vis) {
    const r = slotRoots(b, g.slotAt(i).T1), x = g.xOf(i);
    if (prev && prev.r.roots.length === r.roots.length) r.roots.forEach((v, k) => { ctx.beginPath(); ctx.moveTo(prev.x, g.p2y(prev.r.roots[k])); ctx.lineTo(x, g.p2y(v)); ctx.stroke(); });
    prev = { r, x };
  }
  ctx.restore();
  // labels at the right edge of the view: breakeven levels, Profit and Loss words, edge arrows
  if (vis.length) {
    const iR = vis[vis.length - 1], r = slotRoots(b, g.slotAt(iR).T1), xr = Math.min(g.xOf(iR), g.paneR - 4);
    ctx.save(); ctx.font = `500 ${10.5 * fs}px Inter, sans-serif`; ctx.textBaseline = 'middle';
    const inView = r.roots.filter(v => v > bot && v < top);
    const narrow = L.W < 380;
    inView.forEach(v => { const y = g.p2y(v), txt = `${narrow ? 'BE' : 'Breakeven'} ${lvl(v)}`, w = ctx.measureText(txt).width; const x = Math.max(4, xr - w - 6); ctx.fillStyle = 'rgba(23,23,23,.88)'; ctx.fillRect(x - 4, y - 9 * fs - 1, w + 8, 18 * fs); ctx.fillStyle = PO_COL.be; ctx.fillText(txt, x, y - 1); });
    const above = r.roots.filter(v => v >= top), below = r.roots.filter(v => v <= bot);
    PM.beBtns = [];
    const arrow = (v, up) => {
      const dist = uxB() ? ` · ${ptsTxt(v - b.S0)}` : '', txt = `${narrow || uxB() ? 'BE' : 'Breakeven'} ${lvl(v)} ${up ? '↑' : '↓'}${dist}`, w = ctx.measureText(txt).width, x = Math.max(4, xr - w - 6), y = up ? g.pT + 30 * fs : g.pB - 10 * fs;
      ctx.fillStyle = 'rgba(23,23,23,.88)'; ctx.fillRect(x - 4, y - 9 * fs, w + 8, 18 * fs); ctx.fillStyle = PO_COL.be; ctx.fillText(txt, x, y);
      if (uxB()) { ctx.strokeStyle = 'rgba(240,185,58,.55)'; ctx.lineWidth = 1; ctx.strokeRect(x - 3.5, y - 9 * fs + .5, w + 7, 18 * fs - 1); PM.beBtns.push({ x: x - 4, y: y - 9 * fs, w: w + 8, h: 18 * fs }); }
    };
    if (above.length) arrow(Math.min(...above), true);
    if (below.length) arrow(Math.max(...below), false);
    // Profit / Loss words in the biggest region of each sign at the right edge
    const cuts = [bot, ...inView, top]; let bestP = null, bestL = null;
    for (let k = 0; k < cuts.length - 1; k++) { const mid = (cuts[k] + cuts[k + 1]) / 2, hgt = g.p2y(cuts[k]) - g.p2y(cuts[k + 1]), sgnv = signAt(r, mid); const o = { y: (g.p2y(cuts[k]) + g.p2y(cuts[k + 1])) / 2, h: hgt }; if (sgnv > 0) { if (!bestP || hgt > bestP.h) bestP = o; } else if (!bestL || hgt > bestL.h) bestL = o; }
    ctx.font = `600 ${10.5 * fs}px Inter, sans-serif`;
    const word = (o, t, col) => { if (!o || o.h < 26 * fs) return; const w = ctx.measureText(t).width, x = xr - w - 6; if (x < nowX + 4) return; ctx.fillStyle = col; ctx.fillText(t, x, clamp(o.y + (inView.some(v => Math.abs(g.p2y(v) - o.y) < 14) ? 14 : 0), g.pT + 40, g.pB - 8)); };
    word(bestP, 'Profit', 'rgba(63,210,151,.85)'); word(bestL, 'Loss', 'rgba(238,112,105,.85)');
    if (!r.roots.length || (!inView.length && !above.length && !below.length)) {
      const allP = signAt(r, (top + bot) / 2) > 0, t = allP ? 'Profit at every level shown' : 'Loss at every level shown', w = ctx.measureText(t).width;
      ctx.fillStyle = 'rgba(23,23,23,.85)'; ctx.fillRect(xr - w - 10, g.pB - 30, w + 8, 18); ctx.fillStyle = allP ? 'rgba(63,210,151,.9)' : 'rgba(238,112,105,.9)'; ctx.fillText(t, xr - w - 6, g.pB - 21);
    }
    ctx.restore();
  }
  // strike line of a tapped leg (S3)
  if (PM.s3 && PM.strike != null) { const l = PM.legs.find(x => x.id === PM.strike); if (l && l.c.type !== 'FUT') { const y = Math.round(g.p2y(l.c.strike)) + .5; if (y > g.pT && y < g.pB) { ctx.save(); ctx.strokeStyle = PO_COL.strike; ctx.setLineDash([1.5, 3]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(g.paneR, y); ctx.stroke(); ctx.setLineDash([]); ctx.font = `500 ${10.5 * fs}px Inter, sans-serif`; const t = `${l.c.strike} ${l.c.type}`; ctx.fillStyle = 'rgba(23,23,23,.85)'; ctx.fillRect(6, y - 16, ctx.measureText(t).width + 8, 14); ctx.fillStyle = PO_COL.strike; ctx.textBaseline = 'middle'; ctx.fillText(t, 10, y - 9); ctx.restore(); } } }
  // the Payoff point: crosshair and ring
  const pt = PM.pt; if (!pt) return;
  const i = ptSlot(g); if (i == null) return;
  const x = g.xOf(i), y = g.p2y(pt.S);
  if (x < -4 || x > g.paneR + 4) return;
  ctx.save(); ctx.strokeStyle = 'rgba(127,155,255,.55)'; ctx.setLineDash([4, 4]); ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(Math.round(x) + .5, g.pT); ctx.lineTo(Math.round(x) + .5, g.pB); ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(g.paneR, Math.round(y) + .5); ctx.stroke(); ctx.setLineDash([]);
  const pulse = PM.pulseAt ? clamp((now - 0) && (performance.now() - PM.pulseAt) / 450, 0, 1) : 1;
  if (pulse < 1) { ctx.beginPath(); ctx.arc(x, y, 8 + pulse * 16, 0, 7); ctx.strokeStyle = `rgba(127,155,255,${.6 * (1 - pulse)})`; ctx.lineWidth = 2; ctx.stroke(); requestAnimationFrame(() => redraw('idx')); }
  ctx.beginPath(); ctx.arc(x, y, 8, 0, 7); ctx.fillStyle = 'rgba(127,155,255,.22)'; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, 5.5, 0, 7); ctx.fillStyle = '#171717'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.restore();
}
function drawNow(ctx, g, x) {
  if (x == null || x < 0 || x > g.paneR) return;
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1; ctx.setLineDash([2, 2]);
  ctx.beginPath(); ctx.moveTo(Math.round(x) + .5, g.pT); ctx.lineTo(Math.round(x) + .5, g.pB); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = `600 ${10 * fsC()}px Inter, sans-serif`; ctx.textBaseline = 'bottom'; const w = ctx.measureText('Now').width;
  ctx.fillStyle = '#5a5a5a'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2 - 5, g.pB - 17, w + 10, 15, 4) : ctx.rect(x - w / 2 - 5, g.pB - 17, w + 10, 15); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('Now', x, g.pB - 4); ctx.textAlign = 'left';
  ctx.restore();
}
function drawOptOverlay(ctx, g, b, nowX, endX) {
  if (!poPriced() || b.legs.length !== 1) return;
  const l = b.legs[0], fs = fsC();
  ctx.save(); ctx.beginPath(); ctx.rect(0, g.pT, g.paneR, g.pB - g.pT); ctx.clip();
  // paid line
  const yP = Math.round(g.p2y(l.avg)) + .5;
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, yP); ctx.lineTo(g.paneR, yP); ctx.stroke(); ctx.setLineDash([]);
  ctx.font = `500 ${10.5 * fs}px Inter, sans-serif`; ctx.textBaseline = 'bottom';
  const paid = b.pretrade ? `Last price ${E.prem(l.avg)}` : l.side > 0 ? `Paid ${E.prem(l.avg)}` : `Sold at ${E.prem(l.avg)}`;
  ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillText(paid, Math.max(6, Math.min(nowX, g.paneR) - ctx.measureText(paid).width - 8), yP - 2);
  // flat case: the premium if the index stays where it is
  const S0 = snap5(b.S0), vis = []; const a = Math.max(0, iOfX(g, nowX)), z = Math.min(g.N - 1, iOfX(g, Math.min(endX, g.paneR)) + 1);
  for (let i = a; i <= z; i++) { const sl = g.slotAt(i); if (sl && sl.T1 > b.nowT && sl.T1 <= poAxisEnd(b) + 1e-6) vis.push(i); }
  if (vis.length) {
    ctx.strokeStyle = 'rgba(180,186,200,.75)'; ctx.setLineDash([2, 3]); ctx.lineWidth = 1.4; ctx.beginPath();
    ctx.moveTo(nowX, g.p2y(MK.optLtp(l.c)));
    for (const i of vis) ctx.lineTo(g.xOf(i), g.p2y(PF.legValue(l, S0, g.slotAt(i).T1, b)));
    ctx.stroke(); ctx.setLineDash([]);
    const iL = vis[Math.max(0, Math.floor(vis.length * .55))], yL = g.p2y(PF.legValue(l, S0, g.slotAt(iL).T1, b));
    const t = `If ${idxName()} stays at ${lvl(S0)}`; ctx.fillStyle = 'rgba(180,186,200,.9)'; ctx.textBaseline = 'top';
    const w = ctx.measureText(t).width; ctx.fillText(t, clamp(g.xOf(iL) - w / 2, nowX + 4, g.paneR - w - 4), clamp(yL + 4, g.pT + 4, g.pB - 30));
  }
  // marker at the point's time: the premium and its range
  const v = pointVals(b);
  if (v && PM.pt) {
    const x = xAtT(g, PM.pt.T) - g.s / 2;
    if (x >= -2 && x <= g.paneR + 2) {
      ctx.strokeStyle = 'rgba(127,155,255,.45)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(Math.round(x) + .5, g.pT); ctx.lineTo(Math.round(x) + .5, g.pB); ctx.stroke(); ctx.setLineDash([]);
      if (v.premLo != null && v.premHi - v.premLo > .01) { const y0 = g.p2y(v.premHi), y1 = g.p2y(v.premLo); ctx.fillStyle = 'rgba(127,155,255,.35)'; ctx.fillRect(x - 3, y0, 6, Math.max(1, y1 - y0)); ctx.strokeStyle = PO_COL.pt; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x - 5, y0); ctx.lineTo(x + 5, y0); ctx.moveTo(x - 5, y1); ctx.lineTo(x + 5, y1); ctx.stroke(); }
      const y = g.p2y(v.prem); ctx.beginPath(); ctx.arc(x, y, 4.5, 0, 7); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = PO_COL.pt; ctx.stroke();
      PM.optMarker = { x, y };
    } else PM.optMarker = null;
  }
  ctx.restore();
}
function ptSlot(g) {
  if (!PM.pt) return null;
  const i = slotOfT(g, PM.pt.T); if (i == null) return null;
  return i;
}
function payoffAxes(id, ctx, g) {
  if (!PM.on || !poPriced()) return;
  if (id === 'idx' && PM.pt) {
    const i = ptSlot(g); if (i == null) return;
    const x = g.xOf(i), y = g.p2y(PM.pt.S);
    ctx.save(); ctx.font = FONT_AX; ctx.textBaseline = 'middle';
    if (y > g.pT && y < g.pB) { const t = lvl(PM.pt.S), w = Math.max(ctx.measureText(t).width + 10, g.axisW - 2); ctx.fillStyle = '#4f6ff0'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(g.paneR + 1, y - 9, w, 18, 4) : ctx.rect(g.paneR + 1, y - 9, w, 18); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(t, g.paneR + 6, y + .4); }
    if (x > 0 && x < g.paneR) { const t = ptTimeShort(PM.pt.T), w = ctx.measureText(t).width + 12; ctx.fillStyle = '#4f6ff0'; const lx = clamp(x - w / 2, 0, g.paneR - w); ctx.fillRect(lx, g.pB + 2, w, 19); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(t, lx + w / 2, g.pB + 10.6); ctx.textAlign = 'left'; }
    ctx.restore();
  }
  if (id === 'opt' && !PM.s3 && PM.optMarker) {
    const v = pointVals(); if (!v || v.prem == null) return;
    const y = g.p2y(v.prem); if (y < g.pT || y > g.pB) return;
    ctx.save(); ctx.font = FONT_AX; ctx.textBaseline = 'middle'; const t = v.prem.toFixed(2), w = Math.max(ctx.measureText(t).width + 10, g.axisW - 2);
    ctx.fillStyle = '#4f6ff0'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(g.paneR + 1, y - 9, w, 18, 4) : ctx.rect(g.paneR + 1, y - 9, w, 18); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText(t, g.paneR + 6, y + .4); ctx.restore();
  }
}

/* ---------- turning Payoff on and off (BR-23, BR-24) ---------- */
function setPayoff(on, meta = {}) {
  if (!!on === PM.on) return;
  if (on) {
    if (!payoffAvailable()) { Haptic.fire('error'); toast('Payoff needs an index with options'); return; }
    closeOrderPanel(true);
    PM.on = true; PM.chip = null; PM.strike = null; PM.preAvg = null; PM.bannerClosed = false;
    PM.ys0 = CH.idx.ys; PM.beBtns = [];
    PM.views = { idx: { ro: CH.idx.ro, spacing: CH.idx.spacing, tf: CH.idx.tf }, opt: { ro: CH.opt.ro, spacing: CH.opt.spacing, tf: CH.opt.tf } };
    PM.s3 = isS3(); PM.prevOpt = null;
    const b0 = book();
    if (!PM.s3 && b0.legs.length === 1 && !b0.pretrade && b0.legs[0].c.type !== 'FUT' && b0.legs[0].c !== MK.opt) { PM.prevOpt = MK.opt; setOptContract(b0.legs[0].c, { silent: true }); }
    bookChanged(true);
    relayout();
    openView();
    PM.openedAt = now();
    const b = book();
    track('payoff_open', { source: meta.source || 'wheel', state: b.pretrade ? 'pretrade' : poEmpty(b) ? 'empty' : 'held', leg_count: b.legs.length, chart: meta.chart || null });
    if (meta.source !== 'tip' && !PM.hintSeen && !poEmpty(b)) PM.hint = true;
    if (meta.source === 'tip' && !PM.hintSeen && !poEmpty(b)) PM.hint = true;
    say(PM.s3 ? 'Payoff on. Payoff list shows each position.' : 'Payoff on.');
  } else {
    const dur = Math.round((now() - PM.openedAt) / 1000);
    closeB2(true); closeB1(true);
    PM.on = false; PM.hint = false; PM.pt = null; PM.strike = null;
    const wasS3 = PM.s3; PM.s3 = false;
    if (PM.prevOpt) { setOptContract(PM.prevOpt, { silent: true }); PM.prevOpt = null; }
    relayout();
    restoreViews();
    track('payoff_close', { source: meta.source || 'wheel', duration_s: dur, was: wasS3 ? 'S3' : 'S2' });
    say('Payoff off.');
  }
  renderPayoffUI(); updateHeaders(); redraw(); syncDev && syncDev();
}
function animateRo(targets, ms = 250, done) {
  const t0 = performance.now(), from = {};
  for (const id in targets) { from[id] = { ro: CH[id].ro, sp: CH[id].spacing }; if (targets[id].ys) { const g = geomOf(id); from[id].ys = { hi: g.y2p(g.pT), lo: g.y2p(g.pB) }; } }
  const step = () => {
    const k = clamp((performance.now() - t0) / ms, 0, 1), e = 1 - Math.pow(1 - k, 3);
    for (const id in targets) { const tg = targets[id]; if (tg.sp != null) CH[id].spacing = from[id].sp + (tg.sp - from[id].sp) * e; CH[id].ro = from[id].ro + (tg.ro - from[id].ro) * e; if (tg.ys) CH[id].ys = { hi: from[id].ys.hi + (tg.ys.hi - from[id].ys.hi) * e, lo: from[id].ys.lo + (tg.ys.lo - from[id].ys.lo) * e }; redraw(id); }
    if (k < 1) requestAnimationFrame(step); else done && done();
  };
  requestAnimationFrame(step);
}
// BR-24: keep timeframe and candle width; scroll so the end of the session sits about 8% in from the right edge, with Now between 15% and 60% of the pane
function openView() {
  const gi = geomOf('idx'), b = book(), Tend = sessionEndT(b), now = MK.nowT();
  const xn1 = gi.xOf(gi.n - 1), nowOff = xAtT(gi, now) - xn1, endOff = xAtT(gi, Tend) - xn1;
  const fNow = clamp((.92 * gi.paneR - (endOff - nowOff)) / gi.paneR, .15, .60);
  const tgt = {}; const roFor = (g, off) => (g.paneR - (fNow * g.paneR - off)) / g.s;
  tgt.idx = { ro: roFor(gi, nowOff) };
  if (!PM.s3) {
    const go = geomOf('opt'), xo = go.xOf(go.n - 1), offO = xAtT(go, now) - xo, endO = xAtT(go, Tend) - xo;
    const fO = clamp((.92 * go.paneR - (endO - offO)) / go.paneR, .15, .60);
    tgt.opt = { ro: (go.paneR - (fO * go.paneR - offO)) / go.s };
  }
  // default point: the session end if in view, else the last whole candle in view (BR-28)
  const xn1T = fNow * gi.paneR - nowOff, endX = xn1T + endOff;
  let T = Tend;
  if (endX > gi.paneR - 1) { const iMax = gi.n - 1 + Math.floor((gi.paneR - gi.s / 2 - xn1T) / gi.s); const sl = gi.slotAt(Math.min(iMax, gi.N - 1)); T = sl ? sl.T1 : Tend; }
  const Th = horizonT(b, gi); if (Th != null) T = Th;   // UX-19
  PM.pt = b.legs.length && poPriced() ? { T, S: snap5(b.S0) } : null;
  // UX-01: fit the price scale for the view the chart is scrolling to, and ease into it
  if (uxB()) { const ro0 = CH.idx.ro; CH.idx.ro = tgt.idx.ro; const s = priceFit(); CH.idx.ro = ro0; if (s) tgt.idx.ys = s; }
  animateRo(tgt, 250);
}
function restoreViews() {
  const v = PM.views; if (!v) return; const tgt = {};
  for (const id of CHART_IDS) if (CH[id].tf === v[id].tf) tgt[id] = { ro: v[id].ro, sp: v[id].spacing };
  if (uxB() && CH.idx.tf === v.idx.tf) CH.idx.ys = PM.ys0 || null;   // UX-01: the price scale goes back too
  PM.ys0 = null; PM.beBtns = [];
  PM.views = null; animateRo(tgt, 220);
}
// Horizon chips: fit from Now to the chip's time, Now at 10% and the time at 96% (FR-14)
function fitTo(T, chipKey) {
  const ids = PM.s3 ? ['idx'] : ['idx', 'opt'], tgt = {};
  for (const id of ids) {
    const g = geomOf(id), now = MK.nowT();
    const k = Math.max(1, (xAtT(g, T) - xAtT(g, now)) / g.s);
    const sp = clamp(.86 * g.paneR / k, 1.2, 48);
    const nowOff = (xAtT(g, now) - g.xOf(g.n - 1)) / g.s * sp;
    tgt[id] = { sp, ro: (g.paneR - (.10 * g.paneR - nowOff)) / sp };
  }
  PM.chip = chipKey;
  animateRo(tgt, 260, () => {
    const g = geomOf('idx'), r = ptRange(g);
    if (PM.pt && r) { const i = ptSlot(g), x = g.xOf(i); if (x < 0 || x > g.paneR || i < r[0] || i > r[1]) { setPoint({ T: Math.min(T, g.slotAt(r[1]).T1), S: PM.pt.S }, 'chip'); } }
    fitPrice(); redraw('idx');
    renderPayoffUI();
  });
  track('payoff_horizon_change', { chip: chipKey });
  renderPayoffUI();
}

/* ---------- moving the point (BR-16, BR-29, BR-31) ---------- */
function setPoint(pt, how, opts = {}) {
  const b = book(); if (!b.legs.length) return;
  const prev = PM.pt; PM.pt = pt;
  if (prev && (how === 'drag' || how === 'longpress')) {
    const s0 = Math.sign(Math.round(PF.pnl(b, prev.S, prev.T))), s1 = Math.sign(Math.round(PF.pnl(b, pt.S, pt.T)));
    const crossedExp = b.legs.some(l => (prev.T < l.c.expT) !== (pt.T < l.c.expT)) || (b.legs.every(l => l.product === 'INTRADAY') && (prev.T < PF.SQ_T) !== (pt.T < PF.SQ_T));
    if ((s0 && s1 && s0 !== s1) || crossedExp) { Haptic.fire('select'); PM.crossed = true; }
  }
  if (how === 'tap' || how === 'chip' || how === 'stepper') { PM.pulseAt = performance.now(); if (how !== 'chip') Haptic.fire('open'); }
  if (PM.hint && how !== 'chip') { PM.hint = false; PM.hintSeen = true; store.set('hintSeen', true); }
  const t = now(); if (t - PM.lastMoveLog > 2500 && !opts.quiet) { PM.lastMoveLog = t; track('payoff_point_move', { method: how, sessions_to_expiry: +(((poAxisEnd(b) || pt.T) - pt.T) / E.SESSION).toFixed(1), distance: Math.round(pt.S - b.S0), crossed_breakeven: !!PM.crossed }); PM.crossed = false; }
  if (how !== 'chip') followOpt();
  renderPayoffUI(); redraw('idx'); if (!PM.s3) redraw('opt');
}
// the option chart scrolls with the point's time, so its marker stays in view
function followOpt() {
  if (PM.s3 || !PM.pt || !CH.opt.g) return;
  const g = geomOf('opt'), x = xAtT(g, PM.pt.T), m = 24;
  if (x > g.paneR - m) CH.opt.ro += (x - (g.paneR - m)) / g.s; else if (x < m) CH.opt.ro -= (m - x) / g.s;
}
// card coordinates → a snapped point inside the future zone, or null
function pointFromXY(q, clampToZone = true) {
  const g = CH.idx.g; if (!g) return null;
  const r = ptRange(g); if (!r) return null;
  let i = iOfX(g, q.x);
  if (!clampToZone && (i < r[0] - 1 || i > r[1] + 1)) return null;
  i = clamp(i, r[0], r[1]);
  const y = clamp(q.y, g.pT + 2, g.pB - 2);
  // 5 Nifty points a step; 1 point when the scale is so fine that 5 points would jump more than 6 px under the finger
  const lv = g.y2p(y); return { T: g.slotAt(i).T1, S: g.p2y(0) - g.p2y(5) > 6 ? Math.round(lv) : snap5(lv) };
}
function inFuture(q) {
  const g = CH.idx.g; if (!g || q.y < g.pT || q.y > g.pB || q.x > g.paneR) return false;
  const nowX = xAtT(g, MK.nowT()), end = poAxisEnd(); if (end == null) return false;
  return q.x >= nowX && q.x <= xAtT(g, end);
}
function nearPoint(q) {
  const g = CH.idx.g; if (!g || !PM.pt) return false;
  const i = ptSlot(g); if (i == null) return false;
  return hyp(q.x - g.xOf(i), q.y - g.p2y(PM.pt.S)) <= 26;
}

/* ---------- positions and contracts ---------- */
function setOptContract(c, { silent } = {}) {
  MK.opt = c; Object.assign(CH.opt, optNames(c)); resetData('opt'); CH.opt._fut = null; PM.preAvg = null;
  quotes(); if (!silent) { updateHeaders(); redraw('opt'); }
}
function bookChanged(opening) {
  PM.ver++; PM.cache = new Map();
  if (PM.on) {
    const s3 = isS3();
    if (s3 !== PM.s3) { PM.s3 = s3; PM.strike = null; if (!s3) { const b = book(); if (b.legs.length === 1 && !b.pretrade && b.legs[0].c !== MK.opt && b.legs[0].c.type !== 'FUT') { if (!PM.prevOpt) PM.prevOpt = MK.opt; setOptContract(b.legs[0].c, { silent: true }); } } relayout(); }
    const b = book(), g = CH.idx.g;
    if (!opening && b.legs.length && poPriced() && !PM.pt) PM.pt = { T: sessionEndT(b), S: snap5(b.S0) };
    if (!b.legs.length) PM.pt = null;
    if (PM.pt && g) { const r = ptRange(g); if (r) { const i = ptSlot(g); if (i < r[0] || i > r[1]) PM.pt = { T: g.slotAt(clamp(i, r[0], r[1])).T1, S: PM.pt.S }; } }
    if (!opening) fitPrice();
  }
  renderPayoffUI(); updatePnlPill(); redraw();
}
function squareOffIntraday() {
  PM.legs = PM.legs.filter(l => { if (l.product !== 'INTRADAY') return true; PM.realised += l.side * l.qty * (E.price(l.c, E.pathAt(PF.SQ_T), PF.SQ_T) - l.avg); return false; });
}
function applyScenario(k = PM.scenario) {
  const sc = SCEN[k] || SCEN.single; PM.scenario = k; store.set('scenario', k);
  PM.legs = sc.legs(PM.product); PM.others = (sc.others || []).map(o => ({ ...o })); PM.realised = sc.realised || 0;
  if (MK.closed()) squareOffIntraday();
  PM.orders = {}; PM.exits = [];
  const wasOn = PM.on; if (wasOn) setPayoff(false, { source: 'demo' });
  setOptContract(sc.opt, { silent: true });
  updateHeaders();
  bookChanged();
  if (wasOn) setPayoff(true, { source: 'demo' });
}
function setClock(mod) {
  MK.mod = mod; MK.noise = 0; MK.sec = 0; E.calibrate(MK.nowT());
  const wasOn = PM.on; if (wasOn) setPayoff(false, { source: 'demo' });
  resetData(); CH.idx._fut = CH.opt._fut = null;
  applyScenario(PM.scenario);
  quotes(); updateHeaders(); clockPill(); renderBanner();
  if (wasOn) setPayoff(true, { source: 'demo' });
  redraw();
}
function setPricing(p) {
  MK.pricing = p; if (p === 'live') { PM.asOf = null; } else if (!PM.asOf) PM.asOf = { mod: MK.mod, sec: MK.sec };
  PM.cache = new Map(); renderPayoffUI(); redraw();
}
function quotes() {
  CH.idx.ltp = CH.idx.tag = MK.S0(); CH.idx.prev = E.PREV_CLOSE;
  const c = MK.opt; CH.opt.ltp = CH.opt.tag = c ? MK.optLtp() : 0;
  CH.opt.prev = c ? Math.max(E.TICK, E.roundTick(E.optionCloseBefore(c, E.tOf(E.TODAY, E.OPEN)))) : 0;
}
// live ticks: the index wanders a few points around the data's level, once a second
function liveTick() {
  if (!S.fontsReady) return;
  if (MK.ticking()) {
    MK.sec = (MK.sec + 1) % 60;
    MK.noise = clamp(MK.noise + (Math.random() - .5) * 2.6, -9, 9);
    quotes();
    for (const id of CHART_IDS) for (const tf in DATA[id]) { const a = DATA[id][tf]; const last = a && a[a.length - 1]; if (!last || TF[tf] >= 1440) continue; const v = id === 'idx' ? CH.idx.ltp : CH.opt.ltp; last.c = v; last.h = Math.max(last.h, v); last.l = Math.min(last.l, v); }
    updateHeaders(); updatePnlPill();
    if (PM.on) renderPayoffUI();
    redraw();
  }
  clockPill();
}
function clockPill() {
  const el = $('.tp.clock'); if (!el) return;
  if (MK.closed()) { el.textContent = 'Closed'; return; }
  const h24 = Math.floor(MK.mod / 60), m = MK.mod % 60;
  el.textContent = `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(MK.sec).padStart(2, '0')}`;
}
function updatePnlPill() {
  const el = $('.tp.pnl b'); if (!el) return;
  const T = MK.nowT(), S0 = MK.S0();
  let v = PM.realised;
  for (const l of PM.legs) { if (l.c.und !== 'NIFTY') continue; const p = expiredC(l.c) ? E.intrinsic(l.c, E.settleS(l.c)) : l.c.type === 'FUT' ? S0 : E.price(l.c, S0, T); v += l.side * l.qty * (p - l.avg); }
  el.textContent = E.rupees(Math.round(v)).replace('−', '-'); el.className = v > 0.5 ? 'up' : v < -0.5 ? 'dn' : '';
}

/* ---------- DOM: Payoff bar, readout, card, list, hint, banner ---------- */
function chipsOf(b) {
  const out = [{ k: 'today', t: 'Today', T: MK.closed() ? (E.TODAY + 2) * E.SESSION : (!b.pretrade && b.legs.length && b.legs.every(l => l.product === 'INTRADAY') ? PF.SQ_T : (E.TODAY + 1) * E.SESSION) }];
  if (b.legs.some(l => l.product === 'CARRY') || b.pretrade) {
    const exps = [...new Map(b.legs.filter(l => l.product === 'CARRY' || b.pretrade).map(l => [l.c.exp.key, l.c.exp])).values()].sort((a, c) => a.T - c.T);
    for (const e of exps) if (E.dayOfT(e.T) !== E.TODAY) out.push({ k: e.key, t: e.info.short, T: e.T });
  }
  return out;
}
function renderPayoffUI() {
  const ic_ = CH.idx.el, oc = CH.opt.el; if (!ic_ || !oc) return;
  app.classList.toggle('po-on', PM.on); app.classList.toggle('po-s3', PM.on && PM.s3);
  app.classList.toggle('po-grey', PM.on && (MK.pricing === 'delayed' || MK.pricing === 'offline'));
  const bar = $('.pbar', ic_), rd = $('.pread', ic_), edge = $('.pedge', ic_), hint = $('.phint', ic_), empty = $('.pempty', ic_);
  const chip = $('.pchip', oc), card = $('.pcard', oc), list = $('#plist');
  const hideAll = () => { [bar, rd, edge, hint, empty, chip, card].forEach(e => e.hidden = true); list.hidden = true; $('.pban', ic_).hidden = true; };
  // UX-05: a visible way in, in the index chart's header. It carries its name while a position is held
  const pb = $('.pobtn', ic_);
  if (pb) { const held = PM.legs.some(l => l.c.und === 'NIFTY' && l.qty > 0); pb.hidden = !uxB() || !payoffAvailable(); pb.classList.toggle('on', PM.on); pb.classList.toggle('has', held || PM.on); pb.setAttribute('aria-pressed', PM.on); pb.setAttribute('aria-label', PM.on ? 'Hide payoff' : 'Show payoff'); }
  app.classList.toggle('ux-b', uxB());
  if (!PM.on) { hideAll(); renderB1(); return; }
  const b = book(), g = CH.idx.g, fs = S.fs || 1;
  const r = L.cards.idx;
  bar.hidden = uxB(); bar.style.top = '52px'; bar.style.height = pbarH() + 'px'; bar.style.width = (g ? g.paneR : r.w - 60) + 'px'; app.style.setProperty('--pbh', pbarH() + 'px');
  const lgs = $$('.legend .lg', ic_); lgs.forEach((x, k) => { if (!k) x.dataset.more = lgs.length > 1 ? ` +${lgs.length - 1}` : ''; });
  const chips = chipsOf(b);
  const chipsHTML = poEmpty(b) && !b.pretrade ? '' : chips.map(c => `<button data-chip="${c.k}" data-t="${c.T}" class="${PM.chip === c.k ? 'on' : ''}" aria-pressed="${PM.chip === c.k}">${c.t}</button>`).join('');
  const pc = $('.pchips', bar); if (pc._h !== chipsHTML) { pc.innerHTML = chipsHTML; pc._h = chipsHTML; }
  renderBanner();
  const bannerH = $('.pban', ic_).hidden ? 0 : $('.pban', ic_).offsetHeight + 4;
  // empty: nothing held and no contract (S2 Empty)
  empty.hidden = !(poEmpty(b) && !b.pretrade && !expiredBook(b));
  if (!empty.hidden && g) { empty.style.top = ((g.pT + g.pB) / 2 - 20) + 'px'; }
  // readout (BR-30)
  const v = poPriced() ? pointVals(b) : null;
  const legendH = $('.legend', ic_).offsetHeight || 0;
  let html = '';
  if (expiredBook(b)) {
    const l = b.settled[0], st = E.intrinsic(l.c, E.settleS(l.c)), pnl = b.settled.reduce((a, x) => a + x.side * x.qty * (E.intrinsic(x.c, E.settleS(x.c)) - x.avg), 0);
    html = `<div class="rt">${b.settled.length > 1 ? 'Expired today' : `Expired · settled at ${E.prem(st)}`}</div><div class="rp"><span>P&amp;L</span><b class="${pnlCls(pnl)}">${sgn(pnl)}</b></div>`;
  } else if (!poPriced() && b.legs.length) html = `<div class="rt">Payoff can't load prices</div><div class="rr">Values are hidden until prices load</div>`;
  else if (v) {
    const lead = PM.s3 ? 'Total P&amp;L' : 'P&amp;L';
    let rng;
    if (!PM.s3 && v.atExpiry) rng = `Worth ${E.prem(v.worth)} at expiry`;
    else if (!PM.s3 && v.uncertain) rng = `Too uncertain to price · time value left ${E.prem(v.timeValue)}`;
    else if (v.fixed) rng = '';
    else rng = `Range ${sgn(v.lo)} to ${sgn(v.hi)}`;
    const asOf = MK.pricing === 'delayed' || MK.pricing === 'offline' ? ` <span class="asof">as of ${asOfText(true)}</span>` : '';
    const px = uxB() ? plain(b, v) : null;
    if (px && rng.startsWith('Range')) rng = px.iv;
    html = `<div class="rt">${px ? px.head : `${idxName()} ${lvl(v.S)} · ${ptTime(v.T)}`}</div><div class="rp"><span>${lead}</span><b class="${pnlCls(v.pnl)}">${sgn(v.pnl)}</b></div>${px && px.vs ? `<div class="rr">${px.vs}</div>` : ''}${px && px.needs ? `<div class="rr rn">${px.needs}</div>` : ''}${rng ? `<div class="rr${px ? ' ri' : ''}">${rng}</div>` : ''}<div class="rf"><span class="mi" data-tip="model">Model estimate ${ic('info', 12, 2)}</span>${asOf}<span class="chev">${ic('chevR', 14, 2)}</span></div>`;
    if (uxB()) html = (S.box === '0' ? payBoxHTML : payBoxV)(b, v, asOf ? `<div class="bx5">${asOf}</div>` : '');
  } else if (b.legs.length && !PM.pt) html = `<div class="rt">Pricing your position…</div><div class="rp"><span>P&amp;L</span><b class="sk"></b></div>`;
  if (html && rd._h !== html) { rd.innerHTML = html; rd._h = html; }
  rd.hidden = !html; rd.classList.toggle('pbox', uxB() && !!v && !expiredBook(b)); rd.dataset.box = rd.classList.contains('pbox') ? S.box : '';
  if (!rd.hidden && g) {
    rd.style.maxWidth = Math.round(Math.min(g.paneR - 16, Math.max((uxB() ? 236 : 220) * fs, g.paneR * (fs > 1.5 ? .7 : .62)))) + 'px';
    const w = rd.offsetWidth, h = rd.offsetHeight;
    let left = 8, top = g.pT + 6 + legendH + bannerH;
    const i = PM.pt ? ptSlot(g) : null, px = i != null ? g.xOf(i) : g.paneR, py = PM.pt ? g.p2y(PM.pt.S) : g.pB;
    if (px < g.paneR / 2) { left = g.paneR - w - 8; top += 34 * Math.min(S.fs || 1, 1.45); }
    if (px > left - 14 && px < left + w + 14 && py > top - 14 && py < top + h + 14) top = g.pB - h - 6;
    // take c: the box is a tag beside the point, up and to the left of it, clear of the finger and of the labels at the right edge
    if (rd.dataset.box === 'c' && i != null && px > 0 && px < g.paneR && py > g.pT && py < g.pB) {
      left = px - w - 20; if (left < 4) left = px + 20;
      top = py - h - 20; if (top < g.pT + 4 + bannerH) top = py + 24;
      left = clamp(left, 4, g.paneR - w - 4); top = clamp(top, g.pT + 4, g.pB - h - 4);
    }
    rd.style.left = left + 'px'; rd.style.top = top + 'px';
  }
  // first-run hint
  hint.hidden = !(PM.hint && v && g);
  if (!hint.hidden) {
    hint.textContent = uxB() ? 'Drag the ring, or tap the shaded area, to see P&L at any level and time. Hold it at the right edge to look further ahead.' : 'Drag the ring or tap the shaded area to see P&L at any level and time. Pick a date above to look further ahead.';
    const nowX = xAtT(g, MK.nowT()), zw = Math.max(150, g.paneR - nowX - 12); hint.style.width = Math.min(zw, 230) + 'px';
    const hw = Math.min(zw, 230), hh = hint.offsetHeight, py = PM.pt ? g.p2y(PM.pt.S) : g.pB;
    const hl = clamp(nowX + 6, 6, g.paneR - hw - 6);
    let ht = py > (g.pT + g.pB) / 2 ? Math.max(g.pT + 8, py - hh - 22) : Math.min(g.pB - hh - 24, py + 22);
    // keep clear of the readout: below it if they overlap, else above the time axis
    if (!rd.hidden) { const rl = rd.offsetLeft, rt = rd.offsetTop, rw = rd.offsetWidth, rh = rd.offsetHeight; if (hl < rl + rw && hl + hw > rl && ht < rt + rh && ht + hh > rt) ht = rt + rh + 8 + hh < g.pB - 22 ? rt + rh + 8 : g.pB - hh - 24; }
    hint.style.left = hl + 'px'; hint.style.top = ht + 'px';
  }
  // edge indicator when the point is out of view
  edge.hidden = true;
  if (v && g && PM.pt) {
    const i = ptSlot(g), x = g.xOf(i), y = g.p2y(PM.pt.S);
    if (x > g.paneR + 2 || x < -2) { edge.hidden = false; edge.textContent = x > g.paneR ? `Point · ${ptTimeShort(PM.pt.T)} →` : `← Point · ${ptTimeShort(PM.pt.T)}`; edge.style.top = (g.pB - 34) + 'px'; edge.style.left = x > g.paneR ? '' : '8px'; edge.style.right = x > g.paneR ? (r.w - g.paneR + 6) + 'px' : ''; }
    else if (y < g.pT || y > g.pB) { edge.hidden = false; edge.textContent = `Point · ${lvl(PM.pt.S)} ${y < g.pT ? '↑' : '↓'}`; edge.style.top = (y < g.pT ? g.pT + 4 : g.pB - 30) + 'px'; edge.style.left = clamp(x - 50, 6, g.paneR - 110) + 'px'; edge.style.right = ''; }
  }
  // S2: position chip and point card on the option chart
  chip.hidden = PM.s3 || poEmpty(b) && !b.pretrade;
  if (!chip.hidden) { const l = b.legs[0] || b.settled[0]; chip.textContent = b.pretrade ? `Not holding · as a buy of ${PM.lots * E.LOT}` : l ? `${l.side > 0 ? 'Bought' : 'Sold'} ${l.qty} at ${E.prem(l.avg)}` : ''; }
  card.hidden = PM.s3 || !v || b.legs.length !== 1;
  if (!card.hidden) {
    const go = CH.opt.g, others = PM.others.length ? `<div class="rf2">${PM.others.length} position${PM.others.length > 1 ? 's' : ''} on other charts</div>` : '';
    const prem = v.prem != null ? `${E.prem(v.prem)}` : '';
    const ml = uxB() ? `<div class="rf2 ml">${maxLossTxt(b, true)}</div>` : '';
    const ch = b.pretrade
      ? `<div class="rt">${ptTime(v.T)}</div><div class="rp"><span>Premium</span><b>${prem}</b></div><div class="rr">${v.uncertain ? 'Too uncertain to price' : `${uxB() ? 'If IV moves: ' : ''}${E.prem(v.premLo)} to ${E.prem(v.premHi)}`}</div>${ml}${others}`
      : `<div class="rt">${ptTime(v.T)}</div><div class="rp"><span>P&amp;L</span><b class="${pnlCls(v.pnl)}">${sgn(v.pnl)}</b></div><div class="rr">Premium ${prem}${v.atExpiry || v.uncertain ? '' : uxB() ? `</div><div class="rr ri">If IV moves: ${E.prem(v.premLo)} to ${E.prem(v.premHi)}` : ` · ${E.prem(v.premLo)} to ${E.prem(v.premHi)}`}</div>${ml}${others}`;
    if (card._h !== ch) { card.innerHTML = ch; card._h = ch; }
    if (go) {
      const w = card.offsetWidth, h = card.offsetHeight; let left = 8, top = go.pT + 6;
      const m = PM.optMarker; if (m && m.x > left - 12 && m.x < left + w + 12 && m.y > top - 12 && m.y < top + h + 12) top = go.pB - h - 6;
      if (m && m.x < go.paneR / 2 && m.x > left - 12 && m.x < left + w + 12) left = go.paneR - w - 8;
      card.style.left = left + 'px'; card.style.top = top + 'px';
    }
  }
  // S3: the Payoff list
  list.hidden = !PM.s3;
  if (!PM.s3) PM.pexp = false;
  list.classList.toggle('sp', PM.s3 && uxB());
  if (PM.s3) (uxB() ? renderSellerPanel : renderPayoffList)(b, v);
  renderB1();
}
function asOfText(short) {
  const a = PM.asOf || { mod: MK.mod, sec: MK.sec }, h = Math.floor(a.mod / 60), m = a.mod % 60, h12 = ((h + 11) % 12) + 1;
  return short ? `${h12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}` : `${h12}:${String(m).padStart(2, '0')}:${String(a.sec).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`;
}
function renderBanner() {
  const el = CH.idx.el && $('.pban', CH.idx.el); if (!el) return;
  if (!PM.on) { el.hidden = true; return; }
  let html = '';
  if (MK.pricing === 'delayed') html = `<span>Prices are delayed. Payoff values as of ${asOfText(false)}.</span>`;
  else if (MK.pricing === 'offline') html = `<span>You're offline. Payoff values as of ${asOfText(true)}.</span>`;
  else if (MK.pricing === 'unavailable') html = `<span>Payoff can't load option prices right now.</span><button data-a="retry">Retry</button>`;
  else if (MK.closed() && !PM.bannerClosed) html = `<span>Market closed. Values use the last close; future times start at 9:15 am on ${E.DAYS[E.TODAY + 1].label}.</span><button data-a="bclose" aria-label="Close">${ic('x', 14, 2.2)}</button>`;
  if (el._h !== html) { el.innerHTML = html; el._h = html; }
  el.hidden = !html; el.className = 'pban' + (MK.pricing === 'unavailable' ? ' warn' : '');
  if (html) { el.style.top = (52 + pbarH() + 2) + 'px'; }
}
function renderPayoffList(b, v) {
  const el = $('#plist'), r = L.cards.opt; el.style.top = r.y + 'px'; el.style.height = r.h + 'px';
  const T = PM.pt ? PM.pt.T : MK.nowT(), S = PM.pt ? PM.pt.S : b.S0;
  const groups = new Map();
  const rows = [...b.legs.map(l => ({ l, d: PF.legDetail(l, S, T, b) })), ...b.settled.map(l => { const val = E.intrinsic(l.c, E.settleS(l.c)); return { l, d: { value: val, pnl: PF.legPnl(l, val), status: 'Settled', lo: val, hi: val, pnlLo: null } }; })];
  rows.sort((a, c) => a.l.c.expT - c.l.c.expT || (a.l.c.strike || 0) - (c.l.c.strike || 0));
  for (const x of rows) { const k = x.l.c.exp.key; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(x); }
  const expiries = groups.size, px = uxB() && v ? plain(b, v) : null, title = px ? px.head : PM.pt && poPriced() ? `${idxName()} ${lvl(S)} · ${ptTime(T)}` : 'Payoff now';
  const others = PM.others.length ? `<button class="ochip" data-tip="others">${PM.others.length} position${PM.others.length > 1 ? 's' : ''} on other charts</button>` : '';
  let body = '';
  for (const [k, xs] of groups) {
    const e = xs[0].l.c.exp, kind = e.kind === 'Monthly' ? 'Monthly' : 'Weekly';
    body += `<div class="lgh">${e.info.short} · ${kind} · ${xs.length} leg${xs.length > 1 ? 's' : ''}</div>`;
    for (const { l, d } of xs) {
      const fut = l.c.type === 'FUT', sq = d.status === 'Squared off';
      const name = fut ? `${e.info.short} FUT` : `${e.info.short} ${l.c.strike} ${l.c.type}`;
      const side = fut ? (l.side > 0 ? 'Buy fut' : 'Sell fut') : (l.side > 0 ? 'Buy' : 'Sell');
      const rng = !fut && d.pnlLo != null && d.status === 'Live' || d.status === 'Expires today' ? (d.uncertain ? 'Too uncertain to price' : `${sgn(d.pnlLo)} to ${sgn(d.pnlHi)}`) : '';
      const st = d.status.toLowerCase().replace(/ /g, '');
      body += `<button class="lrow${PM.strike === l.id ? ' sel' : ''}${sq ? ' sq' : ''}" data-leg="${l.id}" aria-label="${side} ${l.qty}, ${name}, average ${E.prem(l.avg)}, value ${E.prem(d.value)}, P&L ${sgn(d.pnl)}, ${d.status}"><span class="lb ${l.side > 0 ? 'b' : 's'}">${l.side > 0 ? 'B' : 'S'}</span><span class="lt"><b>${name}</b><small>${side} ${l.qty} · avg ${E.prem(l.avg)} <i class="stc ${st}">${d.status}</i></small></span><span class="lv"><b class="${sq ? '' : pnlCls(d.pnl)}"${sq ? ' data-tip="sq"' : ''}>${sgn(d.pnl)}</b><small>${E.prem(d.value)}</small>${rng ? `<small class="lr">${rng}</small>` : ''}</span></button>`;
    }
  }
  const total = v ? v.pnl : PF.pnl(b, S, T), rg = px ? `<small>${[px.vs, px.needs, px.iv].filter(Boolean).join(' · ')}</small>` : v && !v.fixed ? `<small>Range ${sgn(v.lo)} to ${sgn(v.hi)}</small>` : '';
  const mx = PF.maxAtExpiry({ ...b, S0: b.S0 });
  const flat = v && !(px && v.S === v.flatS) ? `<div class="lf3">If ${idxName()} stays at ${lvl(v.flatS)}: <b class="${pnlCls(v.flat)}">${sgn(v.flat)}</b></div>` : '';
  const foot = `${PM.realised ? `<div class="lf1">Realised today <b class="${pnlCls(PM.realised)}">${sgn(PM.realised)}</b></div>` : ''}<div class="lf2"><span>Total open P&amp;L</span><b class="${pnlCls(total)}">${sgn(total)}</b>${rg}</div>${flat}${mx ? `<div class="lf4">Max profit at expiry ${E.rupees(mx.maxProfit)} · Max loss at expiry ${E.rupees(Math.abs(mx.maxLoss))}</div>` : ''}<div class="lf5"><span class="mi" data-tip="model">Model estimate, not a forecast ${ic('info', 12, 2)}</span></div>`;
  const html = `<div class="lh"><b>Payoff · ${positionCount()} positions · ${expiries} expir${expiries > 1 ? 'ies' : 'y'}</b>${others}</div><button class="ltitle" data-a="b1">${title}${ic('chevR', 14, 2)}</button><div class="lrows">${body}</div><div class="lfoot">${foot}</div>`;
  if (el._h !== html) { const sc = $('.lrows', el) ? $('.lrows', el).scrollTop : 0; el.innerHTML = html; el._h = html; if ($('.lrows', el)) $('.lrows', el).scrollTop = sc; }
}

/* ---------- B1 Payoff point sheet ---------- */
function openB1(source) {
  if (!PM.on || !PM.pt || !poPriced()) return;
  PM.b1 = true; renderB1(); track('payoff_sheet_open', { source });
  const el = $('#b1'); requestAnimationFrame(() => el.classList.add('on')); setTimeout(() => { const t = $('.b1t', el); t && t.focus({ preventScroll: true }); }, 60);
}
function closeB1(quiet) {
  if (!PM.b1) return; PM.b1 = false; const el = $('#b1'); el.classList.remove('on'); setTimeout(() => { if (!PM.b1) el.hidden = true; }, 220);
  if (!quiet) { track('payoff_sheet_close', {}); const rd = CH.idx.el && $('.pread', CH.idx.el); rd && rd.focus({ preventScroll: true }); }
}
function b1Actions(b, v) {
  if (!PM.later) return '';
  if (b.pretrade) return `<p class="b1n">Not holding · priced as a buy of ${PM.lots * E.LOT} at ${E.prem(b.legs[0].avg)} (last price). Actions appear for positions you hold</p>`;
  const T = v.T, timeTxt = E.dayOfT(T) === E.TODAY ? E.clock(E.split(T).mod) : `${E.clock(E.split(T).mod)}, ${E.DAYS[E.dayOfT(T)].label}`;
  if (PM.s3) return `<p class="b1n">An exit at a time closes at the market price then, wherever Nifty is.</p><button class="b1btn pri" data-o="exitall">Exit all at ${timeTxt}</button>`;
  const l = b.legs[0], cur = MK.optLtp(l.c), pr = E.roundTick(v.prem), up = pr > cur + E.TICK / 2, dn = pr < cur - E.TICK / 2;
  const intradaySq = l.product === 'INTRADAY' && T >= PF.SQ_T;
  const kind = !up && !dn ? null : (l.side > 0 ? (up ? 'target' : 'stop') : (up ? 'stop' : 'target'));
  const ex = PM.orders[l.id] && PM.orders[l.id][kind];
  let h = `<p class="b1n">${kind ? 'Targets and stops trigger on the option’s price, not on Nifty. Time decay moves the Nifty level where they trigger.' : 'An exit at a time closes at the market price then, wherever Nifty is.'}</p>`;
  if (kind) h += `<button class="b1btn pri" data-o="${kind}" data-p="${pr}">Set ${kind} at ${E.prem(pr)}</button>${ex ? `<p class="b1h">Replaces your ${kind} at ${E.prem(ex)}</p>` : ''}`;
  if (intradaySq) h += `<p class="b1h">Auto square-off closes this position at 3:20 pm</p>`;
  else if (!v.atExpiry) h += `<button class="b1btn ${kind ? 'sec' : 'pri'}" data-o="exit">Exit at ${timeTxt}</button>`;
  return h;
}
function renderB1() {
  let el = $('#b1');
  if (!el) return;
  if (!PM.b1 || !PM.on) { if (!PM.b1) el.classList.remove('on'); return; }
  el.hidden = false;
  const b = book(), v = pointVals(b); if (!v) return;
  const g = CH.idx.g, r = g ? ptRange(g) : null, i = g ? ptSlot(g) : null;
  const atFirst = r && i <= r[0], atLast = r && i >= r[1];
  let rng = !PM.s3 && v.uncertain ? `<div class="b1u">Too uncertain to price. Time value left: ${E.prem(v.timeValue)}. Worth at expiry at this level: ${E.prem(v.worthAtExp)}</div>` : !PM.s3 && v.atExpiry ? `<div class="b1r">Worth ${E.prem(v.worth)} at expiry</div>` : v.fixed ? '' : `<div class="b1r">Range ${sgn(v.lo)} to ${sgn(v.hi)}</div>`;
  const px = uxB() ? plain(b, v) : null;
  if (px && rng.includes('>Range ')) rng = px.iv ? `<div class="b1r">${px.iv}</div>` : '';
  const extra = px ? `${px.vs ? `<div class="b1r">${px.vs}</div>` : ''}${px.needs ? `<div class="b1r rn">${px.needs}</div>` : ''}` : '';
  const prem = !PM.s3 && v.prem != null ? `<div class="b1r">Premium ${E.prem(v.prem)}${v.atExpiry || v.uncertain ? '' : ` (${E.prem(v.premLo)} to ${E.prem(v.premHi)})`}</div>` : '';
  const flat = px && v.S === v.flatS ? '' : `<div class="b1r">If ${idxName()} stays at ${lvl(v.flatS)}: <b class="${pnlCls(v.flat)}">${sgn(v.flat)}</b></div>`;
  const lead = b.pretrade ? '' : `<div class="b1p"><span>${PM.s3 ? 'Total P&amp;L' : 'P&amp;L'}</span><b class="${pnlCls(v.pnl)}">${sgn(v.pnl)}</b></div>`;
  const pre = b.pretrade && !PM.later ? `<p class="b1n">Not holding · priced as a buy of ${PM.lots * E.LOT} at ${E.prem(b.legs[0].avg)} (last price). Actions appear for positions you hold</p>` : '';
  const live = MK.pricing === 'live' || MK.pricing === 'offline' && false;
  const acts = b1Actions(b, v);
  const html = `<div class="b1grab"></div><div class="b1hd"><b class="b1t" tabindex="-1">Payoff at a point</b><button class="b1x" aria-label="Close">${ic('x', 18, 1.8)}</button></div>
    <div class="b1st"><span>${idxName()} level</span><button data-s="lv-" aria-label="Lower level 5 points">${ic('minus', 18, 2.2)}</button><b>${lvl(v.S)}</b><button data-s="lv+" aria-label="Raise level 5 points">${ic('plus', 18, 2.2)}</button></div>
    <div class="b1st"><span>Time</span><button data-s="t-" aria-label="One candle earlier"${atFirst ? ' disabled' : ''}>${ic('chevL', 18, 2.2)}</button><b>${ptTime(v.T)}</b><button data-s="t+" aria-label="One candle later"${atLast ? ' disabled' : ''}>${ic('chevR', 18, 2.2)}</button></div>
    <div class="b1v" aria-live="polite">${px ? `<div class="b1r b1q">${px.head}</div>` : ''}${lead}${extra}${rng}${prem}${flat}${px ? `<div class="b1r">${maxLossTxt(b)}</div>` : ''}</div>
    <div class="b1m"><span class="mi" data-tip="model">Model estimate, not a forecast ${ic('info', 12, 2)}</span></div>${pre}<div class="b1a${live ? '' : ' off'}">${acts}</div>${!live && acts ? '<p class="b1h">Prices aren’t live</p>' : ''}`;
  if (el._h !== html) { el.innerHTML = html; el._h = html; }
  const top = L.cards.opt.y - 6;
  el.style.top = Math.max(L.sat + 60, Math.min(top, L.H - el.offsetHeight)) + 'px';
}
function stepPoint(kind) {
  const g = CH.idx.g; if (!g || !PM.pt) return false;
  const r = ptRange(g); if (!r) return false;
  let { T, S: lv } = PM.pt; let i = ptSlot(g);
  if (kind === 'lv+') lv += PM.stepBig ? 25 : 5; else if (kind === 'lv-') lv -= PM.stepBig ? 25 : 5;
  else if (kind === 't+') { if (i >= r[1]) { Haptic.fire('error'); return false; } i++; T = g.slotAt(i).T1; }
  else if (kind === 't-') { if (i <= r[0]) { Haptic.fire('error'); return false; } i--; T = g.slotAt(i).T1; }
  const span = g.y2p(g.pT) - g.y2p(g.pB);
  const lim = [g.y2p(g.pB) - span, g.y2p(g.pT) + span];
  if (lv < lim[0] || lv > lim[1]) { Haptic.fire('error'); return false; }
  // widen the price axis to keep the point in view (BR-28)
  if (lv > g.y2p(g.pT + 6) || lv < g.y2p(g.pB - 6)) { const hi = Math.max(g.y2p(g.pT), lv + span * .08), lo = Math.min(g.y2p(g.pB), lv - span * .08); CH.idx.ys = { hi, lo }; }
  setPoint({ T, S: lv }, 'stepper');
  // keep the point in view horizontally
  const x = g.xOf(i); if (x > g.paneR - 6) { CH.idx.ro += (x - (g.paneR - 6)) / g.s + .5; } else if (x < 6) CH.idx.ro -= (6 - x) / g.s + .5;
  redraw('idx'); return true;
}

/* ---------- B2 Confirm order sheet and N3 (Later release) ---------- */
function openB2(kind, price) {
  const b = book(), v = pointVals(b); if (!v) return;
  const T = v.T, timeTxt = E.dayOfT(T) === E.TODAY ? `${E.clock(E.split(T).mod)}` : `${E.clock(E.split(T).mod)}, ${E.DAYS[E.dayOfT(T)].label}`;
  const fullTime = `${E.clock(E.split(T).mod)}, ${E.DAYS[E.dayOfT(T)].label}`;
  let title, lines = [], pnlLine, note;
  if (kind === 'exitall') {
    title = 'Schedule exit'; const open = b.legs.filter(l => l.c.type === 'FUT' || T < l.c.expT);
    lines.push(`<p class="b2pos">${open.length} legs open at ${fullTime}</p>`);
    open.forEach(l => lines.push(`<p class="b2o">${l.side > 0 ? 'Sell' : 'Buy back'} ${l.qty} NIFTY ${l.c.exp.info.upper} ${l.c.type === 'FUT' ? 'FUT' : `${l.c.strike} ${l.c.type}`}</p>`));
    pnlLine = `P&L depends on prices at ${timeTxt}. Payoff estimate at ${idxName()} ${lvl(v.S)}: ${sgn(v.pnl)}${v.fixed ? '' : ` (range ${sgn(v.lo)} to ${sgn(v.hi)})`}`;
    note = 'Cancelled if you exit before then.';
  } else {
    const l = b.legs[0], cname = `NIFTY ${l.c.exp.info.upper} ${l.c.strike} ${l.c.type}`, verb = l.side > 0 ? 'Bought' : 'Sold';
    lines.push(`<p class="b2pos">${cname} · ${verb} ${l.qty} at ${E.prem(l.avg)}</p>`);
    if (kind === 'exit') { title = 'Schedule exit'; lines.push(`<p class="b2o">${l.side > 0 ? 'Sells' : 'Buys back'} ${l.qty} at market at ${fullTime}, if the position is still open</p>`); pnlLine = `P&L depends on prices at ${timeTxt}. Payoff estimate at ${idxName()} ${lvl(v.S)}: ${sgn(v.pnl)} (range ${sgn(v.lo)} to ${sgn(v.hi)})`; note = 'Cancelled if you exit before then.'; }
    else {
      title = kind === 'target' ? 'Set target' : 'Set stop';
      const o = l.side > 0 ? (kind === 'target' ? `Sells ${l.qty} at market when the option’s price reaches ${E.prem(price)}` : `Sells ${l.qty} at market if the option’s price falls to ${E.prem(price)}`) : (kind === 'target' ? `Buys back ${l.qty} at market when the option’s price falls to ${E.prem(price)}` : `Buys back ${l.qty} at market if the option’s price rises to ${E.prem(price)}`);
      lines.push(`<p class="b2o">${o}</p>`); pnlLine = `P&L if filled at ${E.prem(price)}: ${sgn(PF.legPnl(l, price))} before charges`;
      note = 'Targets and stops trigger on the option’s price, not on Nifty. Time decay moves the Nifty level where they trigger.';
      const ex = PM.orders[l.id] && PM.orders[l.id][kind]; if (ex) note += `</p><p class="b1h">Replaces your current ${kind} at ${E.prem(ex)}`;
    }
  }
  const sh = h(`<div class="sheet lsheet b2"><div class="sh-title">${title}</div><button class="sh-x" aria-label="Close">${ic('x', 18, 1.7)}</button><div class="rows" style="padding:4px 16px 0">${lines.join('')}<p class="b2p">${pnlLine}</p><p class="b2n">${note}</p></div><div class="b2f"><button class="b1btn sec" data-b2="cancel">Cancel</button><button class="b1btn pri" data-b2="ok">${title}</button></div></div>`);
  const layer = openLayer(sh, { label: title, onClose: () => { PM.b2 = null; } });
  PM.b2 = layer; track('payoff_order_confirm_open', { mode: kind });
  sh.addEventListener('click', e => {
    if (e.target.closest('.sh-x') || e.target.closest('[data-b2="cancel"]')) { track('payoff_order_cancel', { mode: kind }); return layer.close('cancel'); }
    const ok = e.target.closest('[data-b2="ok"]'); if (!ok || ok.disabled) return;
    ok.disabled = true; ok.classList.add('busy'); ok.textContent = 'Placing…'; track('payoff_order_confirm', { mode: kind });
    setTimeout(() => {
      if (PM.orderFail) { ok.disabled = false; ok.classList.remove('busy'); ok.textContent = title; track('payoff_order_result', { ok: false, code: 'RMS_REJECT' }); snack(`Couldn't ${kind === 'target' ? 'set target' : kind === 'stop' ? 'set stop' : 'schedule exit'}: margin check failed`, false, true); return; }
      const l = book().legs[0];
      if (kind === 'target' || kind === 'stop') { PM.orders[l.id] = PM.orders[l.id] || {}; PM.orders[l.id][kind] = price; }
      else PM.exits.push({ T: v.T });
      track('payoff_order_result', { ok: true });
      layer.close('done'); closeB1(true);
      snack(kind === 'target' ? `Target set at ${E.prem(price)}` : kind === 'stop' ? `Stop set at ${E.prem(price)}` : `Exit scheduled for ${timeTxt}`, true);
      redraw();
    }, 700);
  });
}
function closeB2(quiet) { if (PM.b2) { PM.b2.close('system'); PM.b2 = null; } }
let snackT = 0;
function snack(msg, ok, sticky) {
  let el = $('#snack'); if (!el) { el = h('<div class="snack" id="snack" role="status"></div>'); app.appendChild(el); }
  el.innerHTML = `${ok ? `<span class="tk">${ic('check', 12, 3)}</span>` : ''}<span>${msg}</span><button aria-label="Close">${ic('x', 14, 2.2)}</button>`;
  el.style.bottom = (L.H - (S.order ? L.H - L.ordH : L.H) + 16 + L.sab) + 'px';
  el.classList.add('on'); clearTimeout(snackT); if (!sticky) snackT = setTimeout(() => el.classList.remove('on'), 4000);
  el.onclick = e => { if (e.target.closest('button')) el.classList.remove('on'); };
  say(msg);
}

/* ---------- order panel (existing Sahi control, unchanged by Payoff, BR-36) ---------- */
function openOrderPanel() { if (S.order) return; S.order = true; relayout(); renderOrderPanel(); track('order_panel', { open: true }); }
function closeOrderPanel(quiet) { if (!S.order) return; S.order = false; relayout(); renderOrderPanel(); if (!quiet) track('order_panel', { open: false }); }
function renderOrderPanel() {
  const el = $('#opanel'); if (!el) return;
  el.hidden = !S.order; if (!S.order) return;
  const c = MK.opt, ltp = c ? MK.optLtp() : 0, q = PM.lots * E.LOT;
  el.style.height = L.ordH + 'px';
  el.innerHTML = `<div class="oph"><div class="opt-tabs"><button class="on">1-Tap Market</button><button data-x="lt">Limit/Trigger</button></div><button class="oppin" aria-label="Pin">${ic('pin', 16, 1.8)}</button></div>
    <div class="opr"><button class="opb buy" data-side="1"${c ? '' : ' disabled'}><b>Buy at</b><b>Mkt</b></button><div class="opq"><button data-q="-" aria-label="One lot less">${ic('minus', 16, 2)}</button><span><b>${q}</b><small>${PM.lots} lot${PM.lots > 1 ? 's' : ''}</small></span><button data-q="+" aria-label="One lot more">${ic('plus', 16, 2)}</button></div><button class="opb sell" data-side="-1"${c ? '' : ' disabled'}><b>Sell at</b><b>Mkt</b></button></div>
    <div class="opm"><span>Margin: ${E.rupees(Math.round(ltp * q))}</span><span>Margin: ${E.rupees(Math.round(1.6e5 * PM.lots))}</span></div>`;
}
function marketOrder(side) {
  const c = MK.opt; if (!c) return;
  const px = MK.optLtp(), qty = PM.lots * E.LOT;
  const ex = PM.legs.find(l => l.c === c && l.qty > 0);
  if (ex && ex.side !== side) { const close = Math.min(ex.qty, qty); PM.realised += ex.side * close * (px - ex.avg); ex.qty -= close; const left = qty - close; if (left > 0) PM.legs.push(mkLeg(c, side, px, 'INTRADAY', left)); PM.legs = PM.legs.filter(l => l.qty > 0); }
  else if (ex) { ex.avg = (ex.avg * ex.qty + px * qty) / (ex.qty + qty); ex.qty += qty; }
  else PM.legs.push(mkLeg(c, side, px, 'INTRADAY', qty));
  PM.preAvg = null;
  toast(`${side > 0 ? 'Bought' : 'Sold'} ${qty} · ${CH.opt.short} at ${E.prem(px)}`, true);
  track('order_fill', { side: side > 0 ? 'buy' : 'sell', qty });
  bookChanged();
}

/* ---------- N1 Payoff introduction tip ---------- */
function showPayoffTip(force) {
  if (!force && (PM.tipSeen || PM.on || $('.coach') || LAYERS.length)) return;
  const pb = uxB() && $('.pobtn', CH.idx.el), tf = pb && !pb.hidden ? pb : $('.tfb', CH.idx.el); if (!tf) return;
  const q = rectIn(tf), viaBtn = tf === pb;
  $$('.ptipn').forEach(x => x.remove());
  const el = h(`<div class="ptipn" role="dialog" aria-label="New in your quick wheel"><div class="pdim"></div><div class="pring" style="left:${q.x - 4}px;top:${q.y - 4}px;width:${q.w + 8}px;height:${q.h + 8}px"></div><div class="pbub" style="top:${q.y + q.h + 12}px"><i class="parr" style="left:${q.x + q.w / 2 - 8}px"></i><div class="pbt"><span class="pic">${ic('payoff', 18, 1.9)}</span>${viaBtn ? `New: Payoff. Tap here to see your breakeven and P&amp;L at any Nifty level and time. It is also in your quick wheel: hold ${CH.idx.tf} and slide to Payoff.` : `New in your quick wheel: Payoff. Hold ${CH.idx.tf} and slide to Payoff to see your breakeven and P&amp;L at any Nifty level and time.`}</div><div class="pbb"><button data-n="got">Got it</button><button class="pri" data-n="show">Show me</button></div></div></div>`);
  app.appendChild(el); track('payoff_tip_shown', {});
  const done = (how) => { el.remove(); PM.tipSeen = true; store.set('tipSeen', true); track('payoff_tip_action', { action: how }); };
  el.addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (b) { done(b.dataset.n === 'show' ? 'show_me' : 'got_it'); if (b.dataset.n === 'show') setPayoff(true, { source: 'tip' }); return; } if (e.target.classList.contains('pdim')) done('outside'); });
}

/* ---------- tooltips (model label, markers, squared-off values, other charts) ---------- */
function showTip(anchorEl, text) {
  $$('.ptipb').forEach(x => x.remove());
  const q = rectIn(anchorEl), el = h(`<div class="ptipb" role="tooltip">${text}</div>`); app.appendChild(el);
  const w = Math.min(280, L.W - 24); el.style.width = w + 'px';
  el.style.left = clamp(q.x + q.w / 2 - w / 2, 12, L.W - w - 12) + 'px';
  const below = q.y + q.h + 8, hgt = el.offsetHeight; el.style.top = (below + hgt < L.H - 20 ? below : q.y - hgt - 8) + 'px';
  setTimeout(() => { const off = ev => { if (!el.contains(ev.target)) { el.remove(); window.removeEventListener('pointerdown', off, true); } }; window.addEventListener('pointerdown', off, true); }, 0);
  say(text.replace(/<[^>]+>/g, ''));
}
const TIPS = {
  model: 'Worked out from live option prices, IV and time left. The range shows values if IV moves. Actual prices can differ, especially near expiry.',
  sq: 'Squared off at 3:20 pm. This is the P&L the square-off books at this Nifty level, and it still counts in the total.',
};

/* ---------- wiring ---------- */
function bindPayoff() {
  const ic_ = CH.idx.el, oc = CH.opt.el;
  if (!$('#plist')) app.appendChild(h('<section class="plist" id="plist" aria-label="Payoff list" hidden></section>'));
  if (!$('#b1')) app.appendChild(h('<div class="b1" id="b1" role="dialog" aria-label="Payoff at a point" hidden></div>'));
  if (!$('#opanel')) app.appendChild(h('<div class="opanel" id="opanel" hidden></div>'));
  $('.pclose', ic_).addEventListener('click', () => setPayoff(false, { source: 'close_button' }));
  $('.pobtn', ic_).addEventListener('click', () => setPayoff(!PM.on, { source: 'header_button', chart: 'idx' }));
  $('.pchips', ic_).addEventListener('click', e => { const b = e.target.closest('[data-chip]'); if (!b) return; fitTo(+b.dataset.t, b.dataset.chip); });
  const rd = $('.pread', ic_);
  rd.addEventListener('click', e => { if (e.target.closest('[data-tip]')) { showTip(e.target.closest('[data-tip]'), TIPS.model); return; } openB1('readout'); });
  rd.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openB1('readout'); } });
  $('.pedge', ic_).addEventListener('click', () => { const g = CH.idx.g; if (!g || !PM.pt) return; const i = ptSlot(g), x = g.xOf(i); const tgt = { idx: { ro: CH.idx.ro + (x - g.paneR * .6) / g.s } }; animateRo(tgt, 220, () => renderPayoffUI()); });
  $('.pban', ic_).addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (!b) return; if (b.dataset.a === 'retry') { track('payoff_retry', {}); toast('Loading prices…'); setTimeout(() => { setPricing('live'); syncPayoffDev(); }, 900); } else { PM.bannerClosed = true; renderBanner(); renderPayoffUI(); } });
  $('.pcard', oc).addEventListener('click', () => openB1('card'));
  $('.pchip', oc).addEventListener('click', () => toast('Positions sheet is not part of this prototype'));
  const list = $('#plist');
  list.addEventListener('click', e => {
    const tip = e.target.closest('[data-tip]'); if (tip) { e.stopPropagation(); if (tip.dataset.tip === 'others') return showTip(tip, PM.others.map(o => o.label).join(', ')); return showTip(tip, TIPS[tip.dataset.tip]); }
    if (e.target.closest('[data-a="b1"]')) return openB1('title');
    const row = e.target.closest('[data-leg]'); if (!row) return;
    const id = +row.dataset.leg; PM.strike = PM.strike === id ? null : id; track('payoff_row_tap', {}); renderPayoffUI(); redraw('idx');
  });
  bindSellerPanel();
  const b1 = $('#b1');
  let rep = 0, repT = 0;
  const stopRep = () => { clearTimeout(rep); clearInterval(repT); PM.stepBig = false; };
  b1.addEventListener('pointerdown', e => {
    const s = e.target.closest('[data-s]'); if (!s || s.disabled) return; e.preventDefault();
    stepPoint(s.dataset.s); const t0 = performance.now();
    rep = setTimeout(() => { repT = setInterval(() => { if (performance.now() - t0 > 1000 && s.dataset.s.startsWith('lv')) PM.stepBig = true; if (!stepPoint(s.dataset.s)) stopRep(); }, 150); }, 400);
    const up = () => { stopRep(); window.removeEventListener('pointerup', up, true); window.removeEventListener('pointercancel', up, true); };
    window.addEventListener('pointerup', up, true); window.addEventListener('pointercancel', up, true);
  });
  b1.addEventListener('click', e => {
    if (e.target.closest('.b1x')) return closeB1();
    const tip = e.target.closest('[data-tip]'); if (tip) return showTip(tip, TIPS.model);
    const o = e.target.closest('[data-o]'); if (o && !o.closest('.off')) { track('payoff_point_action_click', { action: o.dataset.o }); openB2(o.dataset.o, +o.dataset.p || 0); }
  });
  // swipe down on the grab handle or header closes B1
  let sw = null;
  b1.addEventListener('pointerdown', e => { if (e.target.closest('.b1grab, .b1hd') && !e.target.closest('button')) { sw = { y: e.clientY, id: e.pointerId }; } });
  window.addEventListener('pointermove', e => { if (sw && e.pointerId === sw.id) { const dy = Math.max(0, e.clientY - sw.y); b1.style.transform = `translateY(${dy}px)`; } });
  window.addEventListener('pointerup', e => { if (sw && e.pointerId === sw.id) { const dy = e.clientY - sw.y; b1.style.transform = ''; sw = null; if (dy > 60) closeB1(); } });
  const op = $('#opanel');
  op.addEventListener('click', e => {
    const q = e.target.closest('[data-q]'); if (q) { PM.lots = clamp(PM.lots + (q.dataset.q === '+' ? 1 : -1), 1, 20); renderOrderPanel(); if (PM.on && book().pretrade) { PM.preAvg = null; bookChanged(); } return; }
    const s = e.target.closest('[data-side]'); if (s && !s.disabled) { marketOrder(+s.dataset.side); return; }
    if (e.target.closest('[data-x]') || e.target.closest('.oppin')) toast('Not part of this prototype');
  });
  // Android back: B2, then B1, then Payoff (BR-23)
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || LAYERS.length) return;
    if (PM.b1) { closeB1(); e.preventDefault(); return; }
    if (PM.on) { setPayoff(false, { source: 'back' }); e.preventDefault(); }
  });
  setInterval(liveTick, 1000);
}
