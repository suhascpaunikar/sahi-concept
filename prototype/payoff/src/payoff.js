/* =====================================================================
   Payoff maths for a book of positions on the charted index.
   book = { legs: [{ id, c, side: +1 | -1, qty, avg, product: 'INTRADAY' | 'CARRY' }],
            nowT, S0, closed, pretrade }
   ===================================================================== */
const Payoff = (() => {
  const E = (typeof Engine !== 'undefined') ? Engine : require('./engine.js');
  // Range: P&L if IV moves. The research used IV 10% to 15% around 12%; scaled to this sample that is about -2.5 / +3 points (BR-09, open item).
  const IV_LO = -0.025, IV_HI = 0.03;
  const SQ_T = E.tOf(E.TODAY, E.SQOFF);
  const CLOSE_T = E.tOf(E.TODAY, E.CLOSE);

  const hasCarry = book => book.legs.some(l => l.product === 'CARRY');

  // Time a leg is actually valued at: an intraday leg in a mixed book freezes at the square-off (BR-12).
  function legTime(leg, T, book) {
    if (leg.product === 'INTRADAY' && hasCarry(book) && T > SQ_T) return SQ_T;
    return T;
  }
  function legValue(leg, S, T, book, shift = 0) {
    const t = legTime(leg, T, book);
    const c = leg.c;
    if (c.type !== 'FUT' && t >= c.expT) return E.intrinsic(c, S);
    return E.price(c, S, t, shift);
  }
  const legPnl = (leg, value) => leg.side * leg.qty * (value - leg.avg);

  function pnl(book, S, T, shift = 0) {
    let s = 0;
    for (const leg of book.legs) s += legPnl(leg, legValue(leg, S, T, book, shift));
    return s;
  }
  function range(book, S, T) {
    const a = pnl(book, S, T, IV_LO), b = pnl(book, S, T, IV_HI);
    return [Math.min(a, b), Math.max(a, b)];
  }
  function legStatus(leg, T, book) {
    const c = leg.c;
    if (leg.product === 'INTRADAY' && hasCarry(book) && T > SQ_T) return 'Squared off';
    if (c.type !== 'FUT' && T >= c.expT) return (c.exp.di === E.TODAY && book.closed) ? 'Settled' : 'Expired';
    if (c.exp.di === E.TODAY) return 'Expires today';
    return 'Live';
  }
  // Premium detail for one leg at a point, including the expiry-day "too uncertain" rule (BR-10).
  function legDetail(leg, S, T, book) {
    const c = leg.c;
    const t = legTime(leg, T, book);
    const v = legValue(leg, S, T, book);
    const status = legStatus(leg, T, book);
    const out = { leg, value: v, pnl: legPnl(leg, v), status, uncertain: false };
    if (c.type === 'FUT' || t >= c.expT) { out.lo = out.hi = v; out.pnlLo = out.pnlHi = out.pnl; return out; }
    const lo = legValue(leg, S, T, book, IV_LO), hi = legValue(leg, S, T, book, IV_HI);
    out.lo = Math.min(lo, hi); out.hi = Math.max(lo, hi);
    const pa = legPnl(leg, lo), pb = legPnl(leg, hi);
    out.pnlLo = Math.min(pa, pb); out.pnlHi = Math.max(pa, pb);
    if (E.dayOfT(t) === c.exp.di && (out.hi - out.lo) > v) {
      out.uncertain = true;
      out.intrinsic = E.intrinsic(c, S);
      out.timeValue = Math.max(0, v - out.intrinsic);
    }
    return out;
  }
  // Where the future zone ends (BR-03).
  function axisEnd(book) {
    if (!book.legs.length) return null;
    if (book.pretrade) return book.legs[0].c.expT;
    const carry = book.legs.filter(l => l.product === 'CARRY');
    if (!carry.length) return Math.max(book.nowT, SQ_T);
    return Math.max(...carry.map(l => l.c.type === 'FUT' ? l.c.expT : l.c.expT));
  }
  // Breakeven roots in [lo, hi] at time T by sampling and linear interpolation.
  function roots(book, T, lo, hi, step) {
    const out = [];
    let pS = lo, pV = pnl(book, lo, T);
    for (let S = lo + step; S <= hi + 1e-9; S += step) {
      const v = pnl(book, S, T);
      if ((pV <= 0 && v > 0) || (pV > 0 && v <= 0)) out.push(pS + (S - pS) * (pV / (pV - v)));
      pS = S; pV = v;
    }
    return out;
  }
  // Max profit and max loss at expiry for a defined-risk book of options on one expiry (FR-24).
  function maxAtExpiry(book) {
    const legs = book.legs;
    if (legs.length < 2 || legs.some(l => l.c.type === 'FUT')) return null;
    const expT = legs[0].c.expT;
    if (legs.some(l => l.c.expT !== expT)) return null;
    const S0 = book.S0;
    const f = S => legs.reduce((a, l) => a + legPnl(l, E.intrinsic(l.c, S)), 0);
    const lo = S0 * 0.5, hi = S0 * 1.5;
    const slopeLo = f(lo + 1) - f(lo), slopeHi = f(hi + 1) - f(hi);
    if (Math.abs(slopeLo) > 1e-6 || Math.abs(slopeHi) > 1e-6) return null;
    let mx = -Infinity, mn = Infinity;
    for (let S = lo; S <= hi; S += 5) { const v = f(S); if (v > mx) mx = v; if (v < mn) mn = v; }
    return { maxProfit: mx, maxLoss: mn };
  }
  const coneHalf = (S0, iv, nowT, T) => S0 * iv * Math.sqrt(Math.max(0, T - nowT) / E.YEAR);

  return { IV_LO, IV_HI, SQ_T, CLOSE_T, pnl, range, legValue, legPnl, legStatus, legDetail, axisEnd, roots, maxAtExpiry, coneHalf, hasCarry };
})();
if (typeof module !== 'undefined') module.exports = Payoff;
