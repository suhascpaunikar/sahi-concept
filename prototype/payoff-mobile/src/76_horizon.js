/* =========================================================================
   The point's opening time (UX-19) and the most a position can lose (UX-20).
   Used when the improved Payoff is on (uxB).
   The time slider strip between the charts (UX-03, UX-04) was removed: the
   point's level and time are both set by dragging it on the chart.
   ========================================================================= */
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
