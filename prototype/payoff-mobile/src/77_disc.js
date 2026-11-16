/* =========================================================================
   Discipline: stop loss and target on the payoff
   The trader sets a stop loss in rupees and a risk:reward ratio (1:1, 1:2, 1:3),
   as in their SAHI profile. The target is the stop times the ratio. Payoff marks
   the Nifty levels where the position's P&L reaches −stop and +target.
   Four ways to show it (PM.disc.style), picked in the demo panel:
   - 'lines': red and green dashed lines across the future zone, with labels
   - 'zone':  the areas past the stop and past the target shaded red and green
   - 'price': tags on the price axis at the point's time
   - 'box':   only in the payoff box
   ========================================================================= */
PM.disc = { style: store.get('discStyle', 'lines'), stop: store.get('discStop', 2000), ratio: store.get('discRatio', 2) };
const DISC_STYLES = [['lines', 'Lines'], ['zone', 'Zone'], ['price', 'Price axis'], ['box', 'Box'], ['off', 'Off']];
const DISC_COL = { sl: '#f2545f', tg: '#3fd297', slA: 'rgba(242,54,69,.28)', tgA: 'rgba(8,153,129,.34)' };
const discOn = () => uxB() && PM.disc.style !== 'off' && PM.disc.stop > 0;
const discTarget = () => PM.disc.stop * PM.disc.ratio;
const rupeeK = n => E.rupees(Math.round(Math.abs(n)));

// Nifty levels where the book's P&L at time T equals P, in the same ±10% band as the breakevens
function levelRoots(b, T, P) {
  if (!PM.dc || PM.dc.ver !== PM.ver || PM.dc.S0 !== Math.round(b.S0) || PM.dc.m.size > 6000) PM.dc = { ver: PM.ver, S0: Math.round(b.S0), m: new Map() };
  const key = `${T}|${P}`; let v = PM.dc.m.get(key); if (v) return v;
  const f = S => PF.pnl(b, S, T) - P, lo = Math.floor(b.S0 * .9 / SAMPLE) * SAMPLE, hi = Math.ceil(b.S0 * 1.1 / SAMPLE) * SAMPLE;
  v = []; let pS = lo, pV = f(lo);
  for (let S = lo + SAMPLE; S <= hi; S += SAMPLE) {
    const vv = f(S);
    if ((pV <= 0) !== (vv <= 0)) { let a = pS, z = S, fa = pV; for (let k = 0; k < 8; k++) { const m = (a + z) / 2, fm = f(m); if ((fa <= 0) === (fm <= 0)) { a = m; fa = fm; } else z = m; } v.push((a + z) / 2); }
    pS = S; pV = vv;
  }
  PM.dc.m.set(key, v); return v;
}
const discLv = (b, T) => ({ sl: levelRoots(b, T, -PM.disc.stop), tg: levelRoots(b, T, discTarget()) });
// the level the market reaches first: the root nearest the current level
const nearest = (xs, S0) => xs.slice().sort((p, q) => Math.abs(p - S0) - Math.abs(q - S0))[0];
// why a level has no line: the position can't make the target or lose the stop, or it is beyond ±10%
function discWhyNot(b, k) {
  const st = panelStats(b);
  if (k === 'tg' && st.maxP !== Infinity && st.maxP < discTarget()) return `above max profit ${rupeeK(Math.max(0, st.maxP))}`;
  if (k === 'sl' && st.maxL !== -Infinity && -st.maxL < PM.disc.stop) return `more than max loss ${rupeeK(Math.min(0, st.maxL))}`;
  return 'not within 10% of now';
}

/* ---------- on the index chart (called from payoffOver, after the breakevens) ---------- */
function drawDisc(ctx, g, b, nowX, endX, vis) {
  if (!discOn() || !vis.length || !poPriced() || !b.legs.length) return;
  const st = PM.disc.style; if (st === 'box' || st === 'price') return;
  const fs = fsC(), top = g.y2p(g.pT), bot = g.y2p(g.pB), stop = PM.disc.stop, tgt = discTarget();
  ctx.save(); ctx.beginPath(); ctx.rect(Math.max(0, nowX), g.pT, Math.min(endX, g.paneR) - Math.max(0, nowX), g.pB - g.pT); ctx.clip();
  if (st === 'zone') {
    const red = new Path2D(), green = new Path2D();
    vis.forEach((i, k) => {
      const T = g.slotAt(i).T1, d = discLv(b, T), xa = k === 0 ? nowX : Math.round(g.xOf(i) - g.s / 2), xb = Math.round(g.xOf(i) + g.s / 2);
      const cuts = [bot, ...[...d.sl, ...d.tg].filter(x => x > bot && x < top).sort((p, q) => p - q), top];
      for (let q = 0; q < cuts.length - 1; q++) {
        const p = PF.pnl(b, (cuts[q] + cuts[q + 1]) / 2, T), y1 = g.p2y(cuts[q + 1]), y0 = g.p2y(cuts[q]);
        if (p <= -stop) red.rect(xa, y1, Math.max(0, xb - xa), y0 - y1); else if (p >= tgt) green.rect(xa, y1, Math.max(0, xb - xa), y0 - y1);
      }
    });
    ctx.fillStyle = DISC_COL.slA; ctx.fill(red); ctx.fillStyle = DISC_COL.tgA; ctx.fill(green);
  }
  // the lines: solid edges for the zone, dashed for the lines
  ctx.lineWidth = st === 'zone' ? 1 : 1.6; ctx.setLineDash(st === 'zone' ? [] : [6, 4]);
  for (const k of ['sl', 'tg']) {
    ctx.strokeStyle = DISC_COL[k]; let prev = null;
    for (const i of vis) { const d = discLv(b, g.slotAt(i).T1)[k], x = g.xOf(i); if (prev && prev.d.length === d.length) d.forEach((v, j) => { ctx.beginPath(); ctx.moveTo(prev.x, g.p2y(prev.d[j])); ctx.lineTo(x, g.p2y(v)); ctx.stroke(); }); prev = { d, x }; }
  }
  ctx.restore();
  // labels just right of Now, on the first slot's levels, so they stay clear of the breakeven labels at the right edge
  const d0 = discLv(b, g.slotAt(vis[0]).T1), xL = Math.max(4, nowX + 8);
  // the breakeven labels at the right edge, the edge arrows and the Now tag: places the labels keep clear of
  const taken = slotRoots(b, g.slotAt(vis[vis.length - 1]).T1).roots.map(v => clamp(g.p2y(v), g.pT + 30 * fs, g.pB - 10 * fs)).concat([g.pB - 10 * fs]);
  ctx.save(); ctx.font = `600 ${10.5 * fs}px Inter, sans-serif`; ctx.textBaseline = 'middle';
  const lab = (v, k) => {
    // a level off the top or bottom of the chart keeps its label at that edge, with an arrow
    const y = g.p2y(v), off = y < g.pT + 10 ? '↑' : y > g.pB - 10 ? '↓' : '';
    const t = `${k === 'sl' ? `${st === 'zone' ? 'Stop loss' : 'SL'} −${rupeeK(stop)}` : `Target +${rupeeK(tgt)} (1:${PM.disc.ratio})`} · ${lvl(v)}${off ? ' ' + off : ''}`;
    const w = ctx.measureText(t).width, x = Math.min(xL, g.paneR - w - 10), up = PF.pnl(b, v + 30, g.slotAt(vis[0]).T1) > PF.pnl(b, v, g.slotAt(vis[0]).T1);
    // the label sits on the far side of the line from the shaded zone
    let ly = off === '↑' ? g.pT + 30 * fs : off === '↓' ? g.pB - 30 * fs : clamp(y + ((k === 'sl') === up ? -11 : 11) * fs, g.pT + 9, g.pB - 9);
    // step away from the breakeven labels and from labels already placed
    for (let n = 0; n < 6 && taken.some(q => Math.abs(q - ly) < 18 * fs); n++) ly += (ly > (g.pT + g.pB) / 2 ? -19 : 19) * fs;
    taken.push(ly);
    ctx.fillStyle = 'rgba(23,23,23,.9)'; ctx.fillRect(x - 4, ly - 8.5 * fs, w + 8, 17 * fs); ctx.fillStyle = DISC_COL[k]; ctx.fillText(t, x, ly);
  };
  d0.sl.forEach(v => lab(v, 'sl')); d0.tg.forEach(v => lab(v, 'tg'));
  // a stop or target with no line says why, at the top of the future zone
  ctx.font = `500 ${10.5 * fs}px Inter, sans-serif`;
  for (const k of ['sl', 'tg']) if (!d0[k].length) {
    const t = `${k === 'sl' ? `SL −${rupeeK(stop)}` : `Target +${rupeeK(tgt)}`}: ${discWhyNot(b, k)}`, w = ctx.measureText(t).width, x = Math.min(xL, g.paneR - w - 10);
    let ly = g.pT + 30 * fs; for (let n = 0; n < 6 && taken.some(q => Math.abs(q - ly) < 18 * fs); n++) ly += 19 * fs; taken.push(ly);
    ctx.fillStyle = 'rgba(23,23,23,.9)'; ctx.fillRect(x - 4, ly - 8.5 * fs, w + 8, 17 * fs); ctx.fillStyle = DISC_COL[k]; ctx.globalAlpha = .8; ctx.fillText(t, x, ly); ctx.globalAlpha = 1;
  }
  ctx.restore();
}

/* ---------- price axis tags at the point's time (style 'price'; called from payoffAxes) ---------- */
function drawDiscAxis(ctx, g) {
  if (!discOn() || PM.disc.style !== 'price' || !PM.pt || !poPriced()) return;
  const b = book(); if (!b.legs.length) return;
  const d = discLv(b, PM.pt.T), fs = fsC();
  ctx.save(); ctx.font = FONT_AX; ctx.textBaseline = 'middle';
  for (const k of ['sl', 'tg']) for (const v of d[k]) {
    const y = g.p2y(v); if (y < g.pT + 9 || y > g.pB - 9) continue;
    const t = lvl(v), w = Math.max(ctx.measureText(t).width + 10, g.axisW - 2);
    ctx.fillStyle = DISC_COL[k]; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(g.paneR + 1, y - 9, w, 18, 4) : ctx.rect(g.paneR + 1, y - 9, w, 18); ctx.fill();
    ctx.fillStyle = k === 'sl' ? '#fff' : '#08251b'; ctx.fillText(t, g.paneR + 6, y + .4);
    // a short stub into the chart and a word beside it
    ctx.strokeStyle = DISC_COL[k]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(g.paneR - 14, Math.round(y) + .5); ctx.lineTo(g.paneR, Math.round(y) + .5); ctx.stroke();
    ctx.font = `600 ${10 * fs}px Inter, sans-serif`; const word = k === 'sl' ? 'SL' : `T 1:${PM.disc.ratio}`, ww = ctx.measureText(word).width;
    ctx.fillStyle = 'rgba(23,23,23,.9)'; ctx.fillRect(g.paneR - 18 - ww - 6, y - 8 * fs, ww + 8, 16 * fs); ctx.fillStyle = DISC_COL[k]; ctx.fillText(word, g.paneR - 18 - ww - 2, y + .4); ctx.font = FONT_AX;
  }
  ctx.restore();
}

/* ---------- in the payoff box (style 'box') ---------- */
function discBoxHTML(b, v) {
  if (!discOn() || PM.disc.style !== 'box' || !v) return '';
  const d = discLv(b, v.T), stop = PM.disc.stop, tgt = discTarget();
  const row = (k, xs, amt) => { const x = nearest(xs, b.S0); return `<div class="bx6 ${k}"><i></i>${k === 'sl' ? 'Stop loss' : `Target 1:${PM.disc.ratio}`} <b>${amt}</b> ${x == null ? `<span>${discWhyNot(b, k)}</span>` : `at <b>${lvl(x)}</b> <span>(${ptsTxt(x - b.S0)})</span>`}</div>`; };
  const past = v.pnl <= -stop + .5 ? '<div class="bx7 sl">Past your stop loss</div>' : v.pnl >= tgt - .5 ? '<div class="bx7 tg">Target reached</div>' : '';
  return `<div class="bx6w">${row('sl', d.sl, '−' + rupeeK(stop))}${row('tg', d.tg, '+' + rupeeK(tgt))}${past}</div>`;
}

/* ---------- on the seller panel's payoff graph: P&L is the y axis, so they are flat lines ---------- */
function discGraph(ctx, Y, x0, w, yT, h, fs) {
  if (!discOn() || PM.disc.style === 'box') return;
  ctx.save(); ctx.font = `600 ${10 * fs}px Inter, sans-serif`; ctx.textBaseline = 'bottom'; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2;
  for (const [k, p, t] of [['sl', -PM.disc.stop, 'SL'], ['tg', discTarget(), `Target 1:${PM.disc.ratio}`]]) {
    const y = Math.round(Y(p)) + .5; if (y < yT || y > yT + h) continue;
    ctx.strokeStyle = DISC_COL[k]; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x0 + w, y); ctx.stroke();
    ctx.fillStyle = DISC_COL[k]; ctx.textAlign = 'right'; ctx.fillText(t, x0 + w - 2, y - 2);
  }
  ctx.restore();
}

/* ---------- a tick when a dragged point crosses the stop or the target ---------- */
function discCrossed(b, a, z) {
  if (!discOn() || !a || !z) return false;
  const p = PF.pnl(b, a.S, a.T), q = PF.pnl(b, z.S, z.T), s = PM.disc.stop, t = discTarget();
  return (p > -s) !== (q > -s) || (p < t) !== (q < t);
}
