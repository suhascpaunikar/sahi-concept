/* =========================================================================
   Seller-panel look (from the Option Seller panel screenshots, 11 Nov 2026)
   - payBoxHTML: the payoff box, worded and styled like the seller panel's payoff-graph tooltip
   - renderSellerPanel: several positions (S3) in the seller panel's structure:
     title, Positions | Analyse tabs, leg cards, Max Loss / Max Profit / POP bar,
     Summary (premium, Greeks, breakeven) and Payoff graph (the point's time and Expiry date)
   Used when the improved Payoff is on (uxB); ?ux=a keeps the first Payoff list and readout.
   ========================================================================= */
const kfmt = n => { const a = Math.abs(n), s = Math.round(n) > 0 ? '+' : Math.round(n) < 0 ? '−' : ''; return `${s}₹${a >= 1e5 ? (a / 1e5).toFixed(2) + 'L' : a >= 1000 ? (a / 1000).toFixed(2) + 'K' : Math.round(a)}`; };
const pctTxt = p => `${p > 0.004 ? '+' : p < -0.004 ? '−' : ''}${Math.abs(p).toFixed(2)}%`;
const pctCls = p => p > 0.004 ? 'up' : p < -0.004 ? 'dn' : '';
// the expiry the "Expiry date" values use: the first one still ahead; none for an intraday-only book
function payExpT(b) {
  if (!b.legs.length || (!b.pretrade && b.legs.every(l => l.product === 'INTRADAY'))) return null;
  const now = MK.nowT(), xs = b.legs.filter(l => l.c.type !== 'FUT' && l.product !== 'INTRADAY' && l.c.expT > now).map(l => l.c.expT);
  const fx = b.legs.filter(l => l.c.type === 'FUT' && l.c.expT > now).map(l => l.c.expT);
  return xs.length ? Math.min(...xs) : fx.length ? Math.min(...fx) : null;
}
function boxWhen(T) { const { di, mod } = E.split(T); return di === E.TODAY ? `Today, ${E.clock(mod)}` : `${E.DAYS[di].label}, ${E.clock(mod)}`; }
// rows of the payoff box: the point's time, then the expiry date (one row when the point is at or past it)
function payRows(b, v) {
  const TE = payExpT(b);
  if (TE == null || v.T > TE + 1e-6) return [[boxWhen(v.T), v.pnl]];
  if (v.T >= TE - 1e-6) return [['Expiry date', v.pnl]];
  return [[boxWhen(v.T), v.pnl], ['Expiry date', PF.pnl(b, v.S, TE)]];
}
function payBoxHTML(b, v, extra = '') {
  const pct = (v.S - b.S0) / b.S0 * 100;
  return `<div class="bx1">When price is at</div><div class="bx2"><b>${v.S.toFixed(2)}</b> <span class="${pctCls(pct)}">${pctTxt(pct)}</span></div><div class="bx3">Expected P&amp;L on</div>${payRows(b, v).map(([k, n]) => `<div class="bx4">${k}: <b class="${pnlCls(n)}">${kfmt(n)}</b></div>`).join('')}${extra}`;
}

/* Three takes on the payoff box (S.box: a, b or c; 0 keeps the seller-panel box above). The crosshair already
   shows the level on the price axis and the time on the time axis, so each take leads with the expected P&L
   and leaves the level and the time to the axes. What stays is what the axes can't say: the same level at
   expiry, and how far that level is from the market now.
   a: the P&L as a headline. b: the point's time and the expiry as two aligned rows. c: a tag beside the point. */
function moveTxt(b, v) { const d = v.S - b.S0; return Math.abs(d) < 2.5 ? `${idxName()} unchanged` : `${idxName()} ${ptsTxt(d)} pts (${pctTxt(d / b.S0 * 100)})`; }
function payBoxV(b, v, extra = '') {
  const rows = payRows(b, v), atExp = rows[0][0] === 'Expiry date', exp = rows[1] ? rows[1][1] : null;
  const num = (n, cls = '') => `<b class="${cls} ${pnlCls(n)}">${sgn(n)}</b>`;
  if (S.box === 'c') return `<div class="bn ${pnlCls(v.pnl)}">${sgn(v.pnl)}</div>${exp != null ? `<div class="bm">Expiry ${num(exp)}</div>` : atExp ? '<div class="bm">at expiry</div>' : ''}${extra}`;
  const head = `<div class="bl">Expected P&amp;L${atExp ? ' at expiry' : ''}</div>`, foot = `<div class="bm">${moveTxt(b, v)}</div>${extra}`;
  if (S.box === 'b') return `${head}<div class="bg"><span class="p">${atExp ? 'Expiry' : ptTimeShort(v.T)}</span>${num(v.pnl, 'p')}${exp != null ? `<span>Expiry</span>${num(exp)}` : ''}</div>${foot}`;
  return `${head}<div class="bn ${pnlCls(v.pnl)}">${sgn(v.pnl)}</div>${exp != null ? `<div class="bs">At expiry ${num(exp)}</div>` : ''}${foot}`;
}

/* ---------- numbers for the Summary ---------- */
const ncdf = x => { const t = 1 / (1 + .2316419 * Math.abs(x)), d = .3989423 * Math.exp(-x * x / 2), p = d * t * (.3193815 + t * (-.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; };
function panelStats(b) {
  const now = MK.nowT(), S0 = b.S0, key = `${PM.ver}|${Math.round(now)}|${Math.round(S0)}`;
  if (PM.statC && PM.statC.key === key) return PM.statC;
  const TE = payExpT(b) ?? PF.axisEnd(b), f = S => PF.pnl(b, S, TE), o = { key, TE };
  // max profit and max loss at the expiry: open-ended when the payoff still slopes far above the market
  const strikes = b.legs.filter(l => l.c.type !== 'FUT').map(l => l.c.strike), pts = [1, ...strikes, 2 * S0];
  for (let S = S0 * .7; S <= S0 * 1.3; S += 25) pts.push(S);
  const vals = pts.map(f), slope = f(2 * S0) - f(2 * S0 - 100);
  // a payoff that still slopes far below the market (a sold or bought put on its own) counts as open-ended too
  const low = f(S0 * .5) - f(S0 * .5 + 100);
  o.maxP = slope > 1 || low > 1 ? Infinity : Math.max(...vals); o.maxL = slope < -1 || low < -1 ? -Infinity : Math.min(...vals);
  // POP: the chance the book is in profit at that expiry, on a lognormal spread at the at-the-money IV
  const tau = E.tauOf(TE, now), sd = E.baseIv() * Math.sqrt(tau);
  if (sd < 1e-6) o.pop = f(S0) > 0 ? 100 : 0;
  else { const cdf = x => ncdf((Math.log(x / S0) + sd * sd / 2) / sd); let p = 0, x0 = S0 * .5, c0 = cdf(x0); if (f(x0) > 0) p += c0; for (let x = x0 + 10; x <= S0 * 1.5; x += 10) { const c1 = cdf(x); if (f(x - 5) > 0) p += c1 - c0; c0 = c1; } if (f(S0 * 1.5) > 0) p += 1 - c0; o.pop = Math.round(p * 100); }
  // position Greeks now: per index point, per session, per IV point
  let dl = 0, th = 0, ga = 0, ve = 0;
  for (const l of b.legs) {
    const q = l.side * l.qty, c = l.c;
    if (c.type === 'FUT') { dl += q; continue; }
    if (c.expT <= now || (l.product === 'INTRADAY' && now >= PF.SQ_T)) continue;
    const p0 = E.price(c, S0, now), up = E.price(c, S0 + 1, now), dn = E.price(c, S0 - 1, now);
    dl += q * (up - dn) / 2; ga += q * (up - 2 * p0 + dn); th += q * (E.price(c, S0, Math.min(c.expT, now + E.SESSION)) - p0); ve += q * (E.price(c, S0, now, .01) - p0);
  }
  Object.assign(o, { delta: dl, theta: th, gamma: ga, vega: ve });
  const opts = b.legs.filter(l => l.c.type !== 'FUT');
  o.net = opts.reduce((a, l) => a + l.side * l.qty * l.avg, 0); o.unit = opts.length ? o.net / Math.max(...opts.map(l => l.qty)) : 0;
  o.pnlNow = PF.pnl(b, S0, now);
  PM.cache.delete(TE); o.be = slotRoots(b, TE).roots.slice();
  return PM.statC = o;
}
const statBar = st => `<div class="spstat"><span><i>Max Loss</i><b class="dn">${st.maxL === -Infinity ? 'Unlimited' : E.rupees(Math.round(Math.abs(Math.min(0, st.maxL))))}</b></span><span><i>Max Profit</i><b class="up">${st.maxP === Infinity ? 'Unlimited' : E.rupees(Math.round(Math.max(0, st.maxP)))}</b></span><span><i>POP</i><b>${st.pop}%</b></span></div>`;
const beTxt = (st, b) => st.be.length ? st.be.map(x => `${x.toFixed(2)} (${pctTxt((x - b.S0) / b.S0 * 100)})`).join('  ·  ') : 'None in range';
const SP_IC = { min: '<path d="M14.5 3.5v6h6M9.5 20.5v-6h-6"/>', max: '<path d="M20.5 9.5v-6h-6M3.5 14.5v6h6"/>', ok: '<path d="m5 12.5 4.5 4.5L19 7.5"/>' };
const spIc = (k, s = 16, w = 2) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${SP_IC[k]}</svg>`;

/* ---------- the panel ---------- */
function renderSellerPanel(b, v) {
  const el = $('#plist'), r = L.cards.opt, top = PM.pexp ? L.cards.idx.y : r.y;
  el.style.top = top + 'px'; el.style.height = (r.y + r.h - top) + 'px'; el.classList.add('sp');
  const tab = PM.tab || 'pos', sub = PM.sub || 'sum', n = positionCount();
  const T = PM.pt ? PM.pt.T : MK.nowT(), S = PM.pt ? PM.pt.S : b.S0;
  let body = '', foot = '';
  if (!v) body = `<p class="spn">Payoff can't load prices. Values are hidden until prices load.</p>`;
  else if (tab === 'pos') {
    const rows = [...b.legs.map(l => ({ l, d: PF.legDetail(l, S, T, b) })), ...b.settled.map(l => { const val = E.intrinsic(l.c, E.settleS(l.c)); return { l, d: { value: val, pnl: PF.legPnl(l, val), status: 'Settled' } }; })];
    rows.sort((a, c) => a.l.c.expT - c.l.c.expT || (a.l.c.strike || 0) - (c.l.c.strike || 0));
    const cards = rows.map(({ l, d }) => {
      const fut = l.c.type === 'FUT', sq = d.status === 'Squared off', e = l.c.exp, lots = l.qty / E.LOT;
      const ltp = fut ? b.S0 : d.status === 'Settled' || d.status === 'Expired' ? d.value : MK.optLtp(l.c);
      const st = d.status === 'Live' ? '' : `<i class="stc ${d.status.toLowerCase().replace(/ /g, '')}">${d.status}</i>`;
      const name = fut ? `${e.info.short} FUT` : `${e.info.short} ${l.c.strike} ${l.c.type}`;
      return `<button class="lrow spc${PM.strike === l.id ? ' sel' : ''}${sq ? ' sq' : ''}" data-leg="${l.id}" aria-label="${l.side > 0 ? 'Buy' : 'Sell'} ${l.qty}, ${name}, average ${E.prem(l.avg)}, P&L at the point ${sgn(d.pnl)}, ${d.status}"><span class="c1"><b class="sd ${l.side > 0 ? 'b' : 's'}">${l.side > 0 ? 'Buy' : 'Sell'}</b><span class="ex">${e.info.short}</span>${st}<span class="ltp">LTP :<b>${fut ? lvl(ltp) : ltp.toFixed(2)}</b></span></span><span class="c2"><span class="ty">${fut ? 'Future' : l.c.type === 'CE' ? 'Call' : 'Put'}</span>${fut ? '' : `<span class="pill">${l.c.strike}</span>`}<span class="pill q"><b>${l.qty}</b><small>${lots} lot${lots === 1 ? '' : 's'}</small></span><span class="lv"><b class="${sq ? '' : pnlCls(d.pnl)}"${sq ? ' data-tip="sq"' : ''}>${sgn(d.pnl)}</b><small>avg ${E.prem(l.avg)}</small></span></span></button>`;
    }).join('');
    const others = PM.others.length ? `<button class="ochip" data-tip="others">${PM.others.length} on other charts</button>` : '';
    body = `<div class="spr"><button class="ltitle" data-a="b1">P&amp;L at ${lvl(S)} · ${boxWhen(T)}${ic('chevR', 14, 2)}</button>${others}</div><div class="lrows">${cards}</div>${PM.pexp ? statBar(panelStats(b)) : ''}`;
    foot = `<div class="spf"><div class="spfl"><span>Total open P&amp;L</span>${PM.realised ? `<small>Realised today <b class="${pnlCls(PM.realised)}">${sgn(PM.realised)}</b></small>` : ''}<small class="mi" data-tip="model">Model estimate, not a forecast ${ic('info', 12, 2)}</small></div><b class="tot ${pnlCls(v.pnl)}">${sgn(v.pnl)}</b></div>`;
  } else {
    const st = panelStats(b), paid = st.net >= 0;
    const chips = `<div class="spchips" role="group" aria-label="Analyse"><button data-sub="sum" class="${sub === 'sum' ? 'on' : ''}" aria-pressed="${sub === 'sum'}">Summary${sub === 'sum' ? spIc('ok', 14, 2.4) : ''}</button><button data-sub="graph" class="${sub === 'graph' ? 'on' : ''}" aria-pressed="${sub === 'graph'}">Payoff graph${sub === 'graph' ? spIc('ok', 14, 2.4) : ''}</button></div>`;
    const view = `<button class="spv" data-tab="pos">View positions (${n})${ic('chevR', 16, 2)}</button>`;
    if (sub === 'sum') {
      body = `${view}${chips}<div class="spsum">${statBar(st)}
        <div class="spg g3"><div><i>${paid ? 'You paid' : 'You received'}</i><b>${E.rupees(Math.round(Math.abs(st.net)))}</b></div><div><i>Open P&amp;L</i><b class="${pnlCls(st.pnlNow)}">${sgn(st.pnlNow)}</b></div><div><i>Strategy Price</i><b>${paid ? 'Paid' : 'Got'} ${E.prem(Math.abs(st.unit))}</b></div></div>
        <div class="spg g4"><div><i>Delta</i><b>${st.delta.toFixed(2)}</b></div><div><i>Theta</i><b>${st.theta.toFixed(2).replace('-', '−')}</b></div><div><i>Gamma</i><b>${st.gamma.toFixed(4).replace('-', '−')}</b></div><div><i>Vega</i><b>${st.vega.toFixed(2).replace('-', '−')}</b></div></div>
        <div class="spbe"><i>Breakeven</i><b>${beTxt(st, b)}</b></div></div>`;
    } else {
      const TE = payExpT(b), two = TE != null && T < TE - 1e-6;
      body = `${view}${chips}<div class="spleg">${two || TE == null ? `<span><i class="l1"></i>${boxWhen(T)}</span>` : ''}${TE != null ? `<span><i class="l2"></i>Expiry date</span>` : ''}</div><div class="spgw" role="img" aria-label="Payoff graph: profit and loss against the ${idxName()} level"><canvas class="spcv"></canvas><div class="pbox spgt" hidden></div></div><div class="spbe one"><i>Breakeven</i><b>${beTxt(st, b)}</b></div>`;
    }
  }
  const html = `<div class="sph"><b>NIFTY50 positions</b><button class="spx" data-a="exp" aria-label="${PM.pexp ? 'Make the panel smaller' : 'Make the panel larger'}">${spIc(PM.pexp ? 'min' : 'max', 18, 1.8)}</button></div>
    <div class="spt" role="tablist"><button role="tab" data-tab="pos" aria-selected="${tab === 'pos'}" class="${tab === 'pos' ? 'on' : ''}">Positions</button><button role="tab" data-tab="ana" aria-selected="${tab === 'ana'}" class="${tab === 'ana' ? 'on' : ''}">Analyse</button></div>
    <div class="spb ${tab}">${body}</div>${foot}`;
  if (el._h !== html) { const sc = $('.lrows', el) ? $('.lrows', el).scrollTop : 0; el.innerHTML = html; el._h = html; if ($('.lrows', el)) $('.lrows', el).scrollTop = sc; }
  if (v && tab === 'ana' && sub === 'graph') drawPayGraph(el, b, v);
}

/* ---------- Payoff graph: P&L against the index level, at the point's time and at the expiry ---------- */
function niceStep(span, n) { const raw = span / n, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; }
const axK = v => Math.abs(v) < 1e-9 ? '0' : `${v > 0 ? '+' : '−'}${Math.abs(v) >= 1000 ? +(Math.abs(v) / 1000).toFixed(1) + 'K' : Math.round(Math.abs(v))}`;
function graphRange(b, st) {
  const S0 = b.S0, xs = [S0 * .978, S0 * 1.022, ...st.be, ...b.legs.filter(l => l.c.type !== 'FUT').map(l => l.c.strike)].filter(x => x > S0 * .92 && x < S0 * 1.08);
  let lo = Math.min(...xs), hi = Math.max(...xs); const pad = (hi - lo) * .06; return [lo - pad, hi + pad];
}
function drawPayGraph(el, b, v) {
  const wrap = $('.spgw', el), cv = $('.spcv', el); if (!wrap || !cv) return;
  const W = wrap.clientWidth, H = wrap.clientHeight; if (W < 40 || H < 40) return;
  const dpr = window.devicePixelRatio || 1; if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  const st = panelStats(b), TE = payExpT(b), Tp = v.T, two = TE != null && Tp < TE - 1e-6, fs = Math.min(S.fs || 1, 1.3);
  const [lo, hi] = graphRange(b, st), N = 96;
  const key = `${st.key}|${Tp}|${TE}|${lo}|${hi}`;
  if (!PM.gC || PM.gC.key !== key) { const a = [], e = []; for (let i = 0; i <= N; i++) { const S = lo + (hi - lo) * i / N; a.push(PF.pnl(b, S, Tp)); e.push(TE != null ? PF.pnl(b, S, Math.max(TE, Tp)) : null); } PM.gC = { key, a, e }; }
  const { a, e } = PM.gC, main = TE != null ? e : a;   // the filled line: the expiry, or the point's time for an intraday-only book
  const all = two ? [...a, ...e] : main; let y0 = Math.min(0, ...all), y1 = Math.max(0, ...all); const yp = (y1 - y0) || 100; y0 -= yp * .24; y1 += yp * .26;
  const mL = 44 * fs, mR = 8, mT = 28, mB = 22, pw = W - mL - mR, ph = H - mT - mB;
  const X = S => mL + (S - lo) / (hi - lo) * pw, Y = p => mT + (y1 - p) / (y1 - y0) * ph, zy = Y(0);
  PM.gGeo = { lo, hi, mL, pw };
  ctx.font = `400 ${10.5 * fs}px Inter, sans-serif`; ctx.textBaseline = 'middle';
  // y axis
  const step = niceStep(y1 - y0, 6); ctx.textAlign = 'right'; ctx.fillStyle = '#e6e6e6';
  for (let t = Math.ceil(y0 / step) * step; t <= y1; t += step) { const y = Y(t); if (y < mT + 4 || y > H - mB - 2) continue; ctx.fillText(axK(t), mL - 6, y); }
  ctx.save(); ctx.translate(9, mT + ph / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillStyle = '#e6e6e6'; ctx.fillText('Profit/Loss', 0, 0); ctx.restore();
  // x axis
  const xs = niceStep(hi - lo, 4); ctx.textAlign = 'center'; ctx.fillStyle = '#e6e6e6';
  for (let t = Math.ceil(lo / xs) * xs; t <= hi; t += xs) { const x = X(t); if (x < mL + 14 || x > W - mR - 14) continue; ctx.fillText(String(Math.round(t)), x, H - mB / 2 + 2); }
  // the filled line: green above zero, red below
  const path = new Path2D(); main.forEach((p, i) => { const x = mL + pw * i / N, y = Y(p); i ? path.lineTo(x, y) : path.moveTo(x, y); });
  const area = new Path2D(path); area.lineTo(mL + pw, zy); area.lineTo(mL, zy); area.closePath();
  for (const [top, hgt, fill, stroke] of [[mT, zy - mT, 'rgba(8,153,129,.30)', '#3fd297'], [zy, mT + ph - zy, 'rgba(242,54,69,.20)', '#f08379']]) {
    ctx.save(); ctx.beginPath(); ctx.rect(mL, top, pw, Math.max(0, hgt)); ctx.clip(); ctx.fillStyle = fill; ctx.fill(area); ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.strokeStyle = stroke; ctx.stroke(path); ctx.restore();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(mL, Math.round(zy) + .5); ctx.lineTo(mL + pw, Math.round(zy) + .5); ctx.stroke();
  // the point's time
  if (two) { ctx.save(); ctx.beginPath(); ctx.rect(mL, mT, pw, ph); ctx.clip(); ctx.beginPath(); a.forEach((p, i) => { const x = mL + pw * i / N, y = Y(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.strokeStyle = '#b3186d'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore(); }
  // LTP
  const tag = (txt, x, y, parts) => { ctx.font = `500 ${10.5 * fs}px Inter, sans-serif`; const w = ctx.measureText(txt).width + 14, h = 19 * fs; x = clamp(x, 2, W - w - 2); ctx.fillStyle = '#171717'; ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.roundRect(Math.round(x) + .5, Math.round(y) + .5, w, h, 9); ctx.fill(); ctx.stroke(); ctx.textAlign = 'left'; let cx = x + 7; for (const [t, col] of parts) { ctx.fillStyle = col; ctx.fillText(t, cx, y + h / 2 + 1); cx += ctx.measureText(t).width; } };
  const lx = X(b.S0); ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(Math.round(lx) + .5, mT - 4); ctx.lineTo(Math.round(lx) + .5, mT + ph); ctx.stroke(); ctx.restore();
  const lt = `LTP ${b.S0.toFixed(2)}`; ctx.font = `500 ${10.5 * fs}px Inter, sans-serif`; tag(lt, lx - (ctx.measureText(lt).width + 14) / 2, 2, [[lt, '#fff']]);
  // max profit and max loss
  const mp = st.maxP === Infinity ? 'Unlimited' : E.rupees(Math.round(Math.max(0, st.maxP))), ml = st.maxL === -Infinity ? 'Unlimited' : E.rupees(Math.round(Math.abs(Math.min(0, st.maxL))));
  const iMax = main.indexOf(Math.max(...main)), iMin = main.indexOf(Math.min(...main));
  ctx.font = `500 ${10.5 * fs}px Inter, sans-serif`;
  const wP = ctx.measureText(`Max profit: ${mp}`).width + 14, wL = ctx.measureText(`Max loss: ${ml}`).width + 14;
  tag(`Max profit: ${mp}`, iMax >= N / 2 ? mL + pw - wP : mL + 2, mT + 2, [['Max profit: ', '#fff'], [mp, '#3fd297']]);
  tag(`Max loss: ${ml}`, iMin > N / 2 ? mL + pw - wL : mL + 2, mT + ph - 19 * fs - 2, [['Max loss: ', '#fff'], [ml, '#f08379']]);
  // the Payoff point: dashed line, a ring on the filled line, and the payoff box beside it
  const tip = $('.spgt', el), inR = v.S >= lo && v.S <= hi;
  tip.hidden = !inR || !PM.pexp;
  if (inR) {
    const px = X(v.S), py = Y(TE != null ? PF.pnl(b, v.S, Math.max(TE, Tp)) : v.pnl);
    ctx.save(); ctx.setLineDash([4, 4]); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(Math.round(px) + .5, mT); ctx.lineTo(Math.round(px) + .5, mT + ph); ctx.stroke(); ctx.restore();
    ctx.beginPath(); ctx.arc(px, py, 5.5, 0, 7); ctx.fillStyle = '#171717'; ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = '#fff'; ctx.stroke();
    if (PM.pexp) { const bh = payBoxHTML(b, v); if (tip._h !== bh) { tip.innerHTML = bh; tip._h = bh; }
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let tx = px - tw - 12; if (tx < mL + 2) tx = px + 12; tx = clamp(tx, 2, W - tw - 2);
    let ty = py - th - 12; if (ty < mT + 2) ty = Math.min(py + 12, H - mB - th - 2); ty = clamp(ty, 2, H - th - 2);
    tip.style.left = tx + 'px'; tip.style.top = ty + 'px'; }
  }
}
// touching the graph moves the point's level; its time stays
function graphPointAt(e) {
  const wrap = $('#plist .spgw'), g = PM.gGeo; if (!wrap || !g || !PM.pt) return;
  const r = wrap.getBoundingClientRect(), k = r.width / wrap.clientWidth || 1, x = (e.clientX - r.left) / k;
  const S = snap5(clamp(g.lo + (x - g.mL) / g.pw * (g.hi - g.lo), g.lo, g.hi)); if (S === PM.pt.S) return;
  setPoint({ T: PM.pt.T, S }, 'drag');
}
function bindSellerPanel() {
  const list = $('#plist'); let drag = null;
  list.addEventListener('click', e => {
    const t = e.target.closest('[data-tab]'); if (t) { PM.tab = t.dataset.tab; track('payoff_panel_tab', { tab: PM.tab }); renderPayoffUI(); return; }
    const s = e.target.closest('[data-sub]'); if (s) { PM.sub = s.dataset.sub; track('payoff_panel_view', { view: PM.sub }); renderPayoffUI(); return; }
    if (e.target.closest('[data-a="exp"]')) { PM.pexp = !PM.pexp; track('payoff_panel_size', { large: PM.pexp }); renderPayoffUI(); }
  });
  list.addEventListener('pointerdown', e => { if (!e.target.closest('.spgw')) return; drag = e.pointerId; try { e.target.closest('.spgw').setPointerCapture(e.pointerId); } catch {} graphPointAt(e); e.preventDefault(); });
  list.addEventListener('pointermove', e => { if (drag === e.pointerId) graphPointAt(e); });
  const end = e => { if (drag === e.pointerId) { drag = null; track('payoff_point_move', { method: 'graph' }); } };
  list.addEventListener('pointerup', end); list.addEventListener('pointercancel', end);
}
