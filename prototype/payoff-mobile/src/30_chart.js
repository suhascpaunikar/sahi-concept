/* =========================================================================
   Chart model, layout and rendering (TradingView-style canvas, Sahi chrome)
   ========================================================================= */
// Names follow the Sahi app: "19 Oct 22500 Call" on the option chart, "22500 CE" where space is short.
function optNames(c) {
  if (!c) return { sym: 'No contract', ty: '', short: 'Option' };
  const d = c.exp.info, ty = c.type === 'FUT' ? 'Fut' : c.type === 'CE' ? 'Call' : 'Put';
  return { sym: c.type === 'FUT' ? `${String(d.d).padStart(2, '0')} ${MONTHS[d.m]} NIFTY` : `${String(d.d).padStart(2, '0')} ${MONTHS[d.m]} ${c.strike}`, ty, short: c.type === 'FUT' ? `${MONTHS[d.m]} FUT` : `${c.strike} ${c.type}` };
}
const BASE = {
  idx: { sym: 'NIFTY50', ty: 'Spot', short: 'NIFTY50', ltp: 0, tag: 0, prev: E.PREV_CLOSE, spacing: 4.3177, ro: 5.94 },
  opt: { ...optNames(MK.opt), ltp: 0, tag: 0, prev: 0, spacing: 7.5089, ro: 3.51 },
};
const fresh = id => ({ id, ...BASE[id], tf: '5m', type: 'candle', ind: {}, draws: [], draft: null, ys: null, cross: null, opts: { breaks: true, hilo: true, pline: true, wm: true, legend: true } });
const CH = { idx: fresh('idx'), opt: fresh('opt') };
const CHART_IDS = ['idx', 'opt'];
const other = id => id === 'idx' ? 'opt' : 'idx';
const UP = '#089981', DN = '#f23645';
const IND = {
  ema: { name: 'EMA 20', full: 'Exponential Moving Average (EMA)', color: '#2962ff' },
  vwap: { name: 'VWAP', full: 'Volume Weighted Average Price (VWAP)', color: '#ff9800' },
  sma: { name: 'SMA 20', full: 'Simple Moving Average (SMA)', color: '#f7c948' },
  bb: { name: 'BB 20 2', full: 'Bollinger Bands (BB)', color: '#2196f3' },
  kl: { name: 'Key Levels', full: 'Key Levels', color: '#b39ddb' },
};

/* ---- Layout ---- */
const L = { W: 412, H: 915, sat: 48, sab: 12, cards: {} };
let probe = null;
function insets() {
  if (!probe) { probe = document.createElement('div'); probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)'; document.body.appendChild(probe); }
  const cs = getComputedStyle(probe); return { t: parseFloat(cs.paddingTop) || 0, b: parseFloat(cs.paddingBottom) || 0 };
}
function computeLayout() {
  const f = FRAMES[S.frame];
  if (isNative()) {
    const ins = insets();
    L.W = app.clientWidth; L.H = app.clientHeight; L.sat = ins.t; L.sab = Math.max(ins.b, 0); L.os = /iPhone|iPad/.test(navigator.userAgent) ? 'ios' : 'android';
    app.style.removeProperty('width'); app.style.removeProperty('height');
  } else {
    L.W = f.w; L.H = f.h; L.sat = f.sat; L.sab = f.sab; L.os = f.os;
    app.style.width = f.w + 'px'; app.style.height = f.h + 'px';
    app.style.setProperty('--sat', f.sat + 'px'); app.style.setProperty('--sab', f.sab + 'px');
  }
  const ordH = S.order ? 128 + Math.max(0, L.sab - 4) : 0;
  const top = L.sat + 8 + 32 + 12.6, gap = 16.5, avail = L.H - top - gap - ordH;
  L.ordH = ordH;
  const h1 = Math.round(avail * S.split * 10) / 10, h2 = avail - h1;
  L.cards.idx = { x: 4, y: top, w: L.W - 8, h: h1, padB: 0 };
  L.divY = top + h1; L.gap = gap;
  L.cards.opt = { x: 4, y: top + h1 + gap, w: L.W - 8, h: h2, padB: S.order ? 0 : Math.max(0, L.sab - .7) };
  for (const id of CHART_IDS) { const c = L.cards[id]; c.paneT = 52 + (id === 'idx' && typeof PM !== 'undefined' && PM.on ? pbarH() : 0); c.paneB = c.h - 24 - c.padB; }
}

/* ---- Card chrome ---- */
function cardMarkup(id) {
  const c = CH[id];
  return `
  <canvas></canvas>
  <div class="hd">
    <button class="sym" data-act="symbol"><span class="nm">${c.sym}</span><span class="ty">${c.ty}</span><svg class="ico chv" viewBox="0 0 12 12" stroke-width="1.5">${P.chev}</svg></button>
    <div class="pxl"><span class="ltp">${c.ltp.toFixed(2)}</span><span class="chg"></span></div>
    <div class="hdr">${id === 'idx' ? `<button class="pobtn" aria-pressed="false" aria-label="Show payoff" hidden>${ic('payoff', 14, 2)}<span>Payoff</span></button>` : ''}<button class="tfb" data-chart="${id}" aria-haspopup="dialog" aria-label="Timeframe ${c.tf}. Tap for chart menu"><span class="tfl">${c.tf}</span><i class="sep"></i><svg class="ico tfi" width="12.8" height="9.2" viewBox="0 0 12.8 9.2" stroke-width="1.15">${P.tfmenu}</svg></button></div>
  </div>
  <div class="legend"></div>
  ${id === 'idx' ? `<div class="pbar" hidden><div class="pchips" role="group" aria-label="Look ahead to"></div><button class="pclose" aria-label="Close payoff">${ic('x', 16, 2.2)}</button></div><div class="pban" role="status" hidden></div><div class="pread" role="button" tabindex="0" hidden></div><button class="pedge" hidden></button><div class="phint" hidden></div><div class="pempty" hidden>Pick a contract on the option chart to see its payoff</div>` : `<button class="pchip" hidden></button><div class="pcard" hidden></div>`}
  <div class="ptip" role="tooltip" hidden></div>
  <div class="banner"><span class="bt"></span><button aria-label="Stop drawing">${ic('x', 12, 2.6)}</button></div>
  <div class="wm">${LOGO}</div>
  <div class="cornerglyph" aria-hidden="true">${ic('wheel', 18, 1.6)}</div>`;
}
function buildCards() {
  for (const id of CHART_IDS) {
    const el = $('#card-' + id); el.innerHTML = cardMarkup(id);
    CH[id].el = el; CH[id].cv = $('canvas', el); CH[id].ctx = CH[id].cv.getContext('2d');
  }
  updateHeaders();
}
function updateHeaders() {
  for (const id of CHART_IDS) {
    const c = CH[id], el = c.el, d = c.ltp - c.prev, pct = c.prev ? d / c.prev * 100 : 0;
    $('.nm', el).textContent = c.sym; $('.ty', el).textContent = c.ty;
    $('.ltp', el).textContent = c.ltp.toFixed(2);
    const chg = $('.chg', el); chg.textContent = `${d < 0 ? '-' : '+'}${Math.abs(d).toFixed(2)} (${Math.abs(pct).toFixed(2)}%)`; chg.className = 'chg ' + (d < 0 ? 'dn' : 'up');
    $('.tfl', el).textContent = c.tf; $('.tfb', el).setAttribute('aria-label', `Timeframe ${c.tf}. Tap for chart menu`);

    const lg = $('.legend', el);
    const inds = Object.keys(c.ind).filter(k => c.ind[k]);
    lg.innerHTML = !c.opts.legend ? '' : inds.map(k => `<div class="lg"><i style="background:${IND[k].color}"></i>${IND[k].name}<b style="color:${IND[k].color}" data-ind="${k}"></b></div>`).join('');
    const bn = $('.banner', el); bn.classList.toggle('on', !!c.draft);
    if (c.draft) $('.bt', bn).textContent = c.draft.tool === 'fib' ? (c.draft.pts.length ? 'Tap the second point' : 'Fib: tap the first point') : c.draft.tool === 'hline' ? 'Tap a price level' : c.draft.tool === 'rect' ? (c.draft.pts.length ? 'Tap the opposite corner' : 'Rectangle: tap a corner') : (c.draft.pts.length ? 'Tap the second point' : 'Trend line: tap the first point');
  }
  const lk = $('.lnk'); if (lk) { lk.classList.toggle('on', S.linked); lk.setAttribute('aria-pressed', String(S.linked)); }
}
function placeChrome() {
  for (const id of CHART_IDS) {
    const r = L.cards[id], el = CH[id].el;
    el.style.top = r.y + 'px'; el.style.height = r.h + 'px';
    const dpr = Math.min(window.devicePixelRatio || 1, 3), cv = CH[id].cv;
    cv.width = Math.round(r.w * dpr); cv.height = Math.round(r.h * dpr); cv.style.width = r.w + 'px'; cv.style.height = r.h + 'px'; CH[id].dpr = dpr;
    $('.wm', el).style.top = (r.paneB - 16 - 17.5) + 'px';
    $('.wm', el).style.display = CH[id].opts.wm ? '' : 'none';
    const g = CH[id].g || (S.fontsReady ? geomOf(id) : null), cg = $('.cornerglyph', el);
    if (g) { const cx = S.hand === 'left' ? 22 : g.paneR + g.axisW / 2; cg.style.left = (cx - 11) + 'px'; cg.style.top = (r.paneB + 12 - 11) + 'px'; }
  }
  const dv = $('#divider'); dv.style.top = L.divY + 'px';
  const dock = $('#dock'), oc = L.cards.opt;
  const dx = S.hand === 'left' ? 34 : L.W - 34;
  dock.style.left = (dx - 22) + 'px'; dock.style.top = (oc.y + oc.paneB - 62) + 'px';
}

/* ---- Indicators ---- */
function emaArr(v, p) { const k = 2 / (p + 1); let e = null; return v.map(x => (e = e == null ? x : x * k + e * (1 - k))); }
function smaArr(v, p) { let s = 0; return v.map((x, i) => { s += x; if (i >= p) s -= v[i - p]; return i >= p - 1 ? s / p : null; }); }
function indSeries(c, bars, k) {
  const key = c.tf + ':' + k + ':' + bars.length; c._ic = c._ic || {};
  if (c._ic[key]) return c._ic[key];
  const cl = bars.map(b => b.c); let out;
  if (k === 'ema') out = [emaArr(cl, 20)];
  else if (k === 'sma') out = [smaArr(cl, 20)];
  else if (k === 'bb') { const m = smaArr(cl, 20); const sd = cl.map((_, i) => { if (i < 19) return null; let s = 0; for (let j = i - 19; j <= i; j++) s += (cl[j] - m[i]) ** 2; return Math.sqrt(s / 20); }); out = [m, m.map((x, i) => x == null ? null : x + 2 * sd[i]), m.map((x, i) => x == null ? null : x - 2 * sd[i])]; }
  else if (k === 'vwap') { let day = null, pv = 0, vv = 0; out = [bars.map(b => { const d = Math.floor(b.t / DAY); if (d !== day || TF[c.tf] >= 1440) { day = d; pv = 0; vv = 0; } const v = b.e ? 0 : 1 + Math.abs(b.c - b.o) / (b.c || 1) * 400; pv += (b.h + b.l + b.c) / 3 * v; vv += v; return vv ? pv / vv : b.c; })]; }
  else out = [];
  return (c._ic[key] = out);
}
function keyLevels(id) {
  const d = daily(id), prev = d[d.length - 2];
  return [{ p: prev.h, t: 'PDH' }, { p: prev.l, t: 'PDL' }, { p: prev.c, t: 'PDC' }];
}

/* ---- Rendering ---- */
const FONT_AX = '400 12px Roboto, "Roboto Fallback", Arial, sans-serif', FONT_TAG = '400 13px Roboto, Arial, sans-serif', FONT_HL = '400 12.5px Roboto, Arial, sans-serif';
function niceStep(range, target) { const raw = range / target, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
const fmtP = (v, id) => v.toFixed(2);
function haBars(bars) { const out = []; let po = null, pc = null; for (const b of bars) { const c = (b.o + b.h + b.l + b.c) / 4, o = po == null ? (b.o + b.c) / 2 : (po + pc) / 2; out.push({ ...b, o, c, h: Math.max(b.h, o, c), l: Math.min(b.l, o, c) }); po = o; pc = c; } return out; }
function renkoBars(bars, box) { const out = []; let base = null; for (const b of bars) { if (b.e) continue; if (base == null) { base = Math.round(b.c / box) * box; continue; } while (b.c >= base + box) { out.push({ t: b.t, o: base, c: base + box, h: base + box, l: base }); base += box; } while (b.c <= base - box) { out.push({ t: b.t, o: base, c: base - box, h: base, l: base - box }); base -= box; } } return out; }
function viewBars(c) {
  const raw = getBars(c.id, c.tf);
  if (c.type === 'ha') return haBars(raw);
  if (c.type === 'renko') { c._rk = c._rk || {}; const k = c.tf; if (!c._rk[k]) c._rk[k] = renkoBars(raw, c.id === 'idx' ? 10 : 2); return c._rk[k]; }
  return raw;
}
function geomOf(id) {
  const c = CH[id], r = L.cards[id], bars = viewBars(c), n = bars.length;
  const ctx = c.ctx; ctx.font = FONT_AX;
  const axisW = Math.round((ctx.measureText(c.tag.toFixed(2)).width + 8.9) * 4) / 4;
  const paneR = r.w - axisW, s = c.spacing;
  const fut = futureSlots(c, bars), N = n + fut.length;
  c.ro = clamp(c.ro, -(n - 3), Math.max(2, fut.length + 9));
  const xOf = i => paneR - (c.ro + (n - 1 - i)) * s;
  const i0 = Math.max(0, Math.floor(n - 1 - (paneR / s - c.ro)) - 1), i1 = Math.min(n - 1, Math.ceil(n - 1 + c.ro + 1)), j1 = Math.min(N - 1, Math.ceil(n - 1 + c.ro + 1));
  const slotAt = i => i < n ? bars[i] : fut[i - n];
  let hi = -Infinity, lo = Infinity, ih = -1, il = -1;
  const lineType = c.type === 'line' || c.type === 'step' || c.type === 'area';
  for (let i = Math.max(0, i0); i <= i1; i++) {
    const b = bars[i]; if (!b || b.e) continue; const x = xOf(i); if (x < -s || x > paneR + s) continue;
    const H = lineType ? b.c : b.h, Lw = lineType ? b.c : b.l;
    if (H > hi) { hi = H; ih = i; } if (Lw < lo) { lo = Lw; il = i; }
  }
  if (!isFinite(hi)) { hi = c.tag * 1.01; lo = c.tag * .99; }
  if (typeof payoffYRange === 'function') { const ex = payoffYRange(c.id, { n, fut, i0, j1, xOf, s, paneR }); if (ex) { hi = Math.max(hi, ex[1]); lo = Math.min(lo, ex[0]); } }
  const pT = r.paneT, pB = r.paneB, PH = pB - pT;
  let top, bot, mt = .103, mb = .105;
  if (c.ys) { top = c.ys.hi; bot = c.ys.lo; mt = 0; mb = 0; } else { top = hi; bot = lo; if (top - bot < 1e-9) { top += 1; bot -= 1; } }
  const p2y = p => pT + mt * PH + (top - p) / (top - bot) * (1 - mt - mb) * PH;
  const y2p = y => top - (y - pT - mt * PH) / ((1 - mt - mb) * PH) * (top - bot);
  return { c, r, bars, n, s, paneR, axisW, xOf, i0, i1, hi, lo, ih, il, p2y, y2p, pT, pB, PH, top, bot, mt, mb, fut, N, j1, slotAt };
}
function xToTime(g, x) { const fi = g.n - 1 - ((g.paneR - x) / g.s - g.c.ro); const i = clamp(Math.round(fi), 0, g.n - 1); const b = g.bars[i]; const step = TF[g.c.tf]; return b.t + (fi - i) * step; }
function timeToX(g, t) {
  const b = g.bars; let lo = 0, hi = b.length - 1;
  if (t <= b[0].t) return g.xOf(0); if (t >= b[hi].t) return g.xOf(hi) + (t - b[hi].t) / TF[g.c.tf] * g.s;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (b[m].t <= t) lo = m; else hi = m; }
  const f = (t - b[lo].t) / Math.max(1e-9, b[hi].t - b[lo].t); return g.xOf(lo) + f * g.s;
}
function fmtTime(t, tfm) {
  const d = Math.floor(t / DAY), m = Math.round(t - d * DAY), dt = dayDate(t);
  if (tfm >= 43200) return MONTHS[dt.getUTCMonth()] + (dt.getUTCMonth() === 0 ? ' ' + dt.getUTCFullYear() : '');
  if (tfm >= 1440) return dt.getUTCDate() + ' ' + MONTHS[dt.getUTCMonth()];
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0') + (tfm < 1 ? ':' + String(Math.round((t % 1) * 60) % 60).padStart(2, '0') : '');
}
function drawChart(id) {
  const c = CH[id]; if (!c.ctx || !S.fontsReady) return;
  const g = geomOf(id), ctx = c.ctx, dpr = c.dpr, r = g.r;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, r.w, r.h);
  const { bars, xOf, p2y, s, paneR, pT, pB } = g;
  c.el.style.setProperty('--axw', g.axisW + 'px');
  const cg = $('.cornerglyph', c.el); if (cg) { const cx = S.hand === 'left' ? 22 : g.paneR + g.axisW / 2; cg.style.left = (cx - 11) + 'px'; cg.style.top = (r.paneB + 12 - 11) + 'px'; }
  const snap = v => Math.round(v * dpr) / dpr, half = .5 / dpr;
  // pane clip
  ctx.save(); ctx.beginPath(); ctx.rect(0, pT, paneR, pB - pT); ctx.clip();
  // session breaks
  if (c.opts.breaks && TF[c.tf] < 1440) {
    ctx.strokeStyle = 'rgba(255,255,255,.17)'; ctx.lineWidth = 1; ctx.setLineDash([2.2, 1.9]);
    for (let i = Math.max(1, g.i0); i <= g.j1; i++) if (Math.floor(g.slotAt(i).t / DAY) !== Math.floor(g.slotAt(i - 1).t / DAY)) { const x = snap(xOf(i)) + half; ctx.beginPath(); ctx.moveTo(x, pT); ctx.lineTo(x, pB); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  // series
  const bw = Math.max(1 / dpr, Math.round(s * .67 * dpr) / dpr), ww = Math.max(1, Math.floor(dpr)) / dpr;
  if (c.type === 'line' || c.type === 'step' || c.type === 'area') {
    ctx.beginPath(); let first = true, lastX = 0, lastY = 0;
    for (let i = g.i0; i <= g.i1; i++) { const b = bars[i]; if (!b) continue; const x = xOf(i), y = p2y(b.c); if (first) { ctx.moveTo(x, y); first = false; } else if (c.type === 'step') { ctx.lineTo(x, lastY); ctx.lineTo(x, y); } else ctx.lineTo(x, y); lastX = x; lastY = y; }
    if (c.type === 'area') { const grad = ctx.createLinearGradient(0, pT, 0, pB); grad.addColorStop(0, 'rgba(41,98,255,.32)'); grad.addColorStop(1, 'rgba(41,98,255,0)'); ctx.save(); ctx.lineTo(lastX, pB); ctx.lineTo(xOf(g.i0), pB); ctx.closePath(); ctx.fillStyle = grad; ctx.fill(); ctx.restore(); ctx.beginPath(); first = true; for (let i = g.i0; i <= g.i1; i++) { const b = bars[i]; if (!b) continue; const x = xOf(i), y = p2y(b.c); if (first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y); } }
    ctx.strokeStyle = '#2962ff'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke();
  } else {
    let emptyRun = null;
    const flushEmpty = () => { if (!emptyRun) return; const y = snap(p2y(emptyRun.p)) + half; ctx.strokeStyle = '#4b4b4b'; ctx.lineWidth = 1; ctx.setLineDash([2.2, 2]); ctx.beginPath(); ctx.moveTo(emptyRun.x0, y); ctx.lineTo(emptyRun.x1, y); ctx.stroke(); ctx.setLineDash([]); emptyRun = null; };
    for (let i = g.i0; i <= g.i1; i++) {
      const b = bars[i]; if (!b) continue; const x = xOf(i);
      if (b.e) { if (!emptyRun) emptyRun = { x0: x - s * .5, x1: x + s * .5, p: b.c }; else emptyRun.x1 = x + s * .5; continue; }
      flushEmpty();
      const up = b.c >= b.o, col = up ? UP : DN, xc = snap(x);
      ctx.fillStyle = col;
      const yH = p2y(b.h), yL = p2y(b.l), yO = p2y(b.o), yC = p2y(b.c);
      const bt = snap(Math.min(yO, yC)), bb = Math.max(bt + 1 / dpr, snap(Math.max(yO, yC)));
      const hollowUp = c.type === 'hollow' && up;
      // wick
      ctx.fillRect(xc - ww / 2, snap(yH), ww, Math.max(1 / dpr, snap(yL) - snap(yH)));
      if (hollowUp) { ctx.fillStyle = '#171717'; ctx.fillRect(xc - bw / 2, bt, bw, bb - bt); ctx.strokeStyle = col; ctx.lineWidth = 1 / dpr * Math.max(1, Math.floor(dpr)); ctx.strokeRect(xc - bw / 2 + half, bt + half, bw - 1 / dpr, bb - bt - 1 / dpr); }
      else ctx.fillRect(xc - bw / 2, bt, bw, bb - bt);
    }
    flushEmpty();
  }
  // indicators and drawings
  if (typeof payoffUnder === 'function') payoffUnder(id, ctx, g);
  {
    for (const k of Object.keys(c.ind)) {
      if (!c.ind[k]) continue;
      if (k === 'kl') { for (const lv of keyLevels(id)) { const y = snap(p2y(lv.p)) + half; ctx.strokeStyle = IND.kl.color; ctx.lineWidth = 1; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(paneR, y); ctx.stroke(); ctx.setLineDash([]); ctx.font = '500 10px Inter, sans-serif'; ctx.fillStyle = IND.kl.color; ctx.textBaseline = 'bottom'; ctx.fillText(lv.t, 8, y - 2); } continue; }
      const raw = getBars(id, c.tf), ser = indSeries(c, raw, k), col = IND[k].color;
      ser.forEach((arr, si) => {
        ctx.beginPath(); let started = false;
        for (let i = g.i0; i <= g.i1; i++) { const v = arr[i]; if (v == null) { started = false; continue; } const x = xOf(i), y = p2y(v); if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y); }
        ctx.strokeStyle = col; ctx.globalAlpha = si ? .7 : 1; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.stroke(); ctx.globalAlpha = 1;
      });
      const val = ser[0] && ser[0][Math.min(g.i1, raw.length - 1)]; const lb = $(`.legend [data-ind="${k}"]`, c.el); if (lb && val != null) lb.textContent = val.toFixed(2);
    }
    for (const d of c.draws) drawShape(ctx, g, d, false);
  }
  if (c.draft && c.draft.pts.length) drawShape(ctx, g, { tool: c.draft.tool, a: c.draft.pts[0], b: c.draft.hover || c.draft.pts[0] }, true);
  if (typeof payoffOver === 'function') payoffOver(id, ctx, g);
  // high and low markers
  if (c.opts.hilo && g.ih >= 0 && c.type !== 'renko') {
    ctx.font = FONT_HL; ctx.textBaseline = 'middle';
    for (const [i, p] of [[g.ih, g.hi], [g.il, g.lo]]) {
      const x = xOf(i), y = snap(p2y(p)) + half, txt = fmtP(p, id), tw = ctx.measureText(txt).width;
      const right = x + 21.9 + 3.7 + tw < paneR - 2, ex = right ? x + 21.9 : x - 21.9;
      ctx.strokeStyle = '#353535'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, y); ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex, y, 1.65, 0, Math.PI * 2); ctx.fill();
      ctx.textAlign = right ? 'left' : 'right'; ctx.fillText(txt, right ? ex + 3.7 : ex - 3.7, y + .3);
    }
    ctx.textAlign = 'left';
  }
  // last price line
  const last = bars[bars.length - 1], tagUp = last ? last.c >= last.o : true, tagCol = tagUp ? UP : DN, ty = snap(p2y(c.tag)) + half;
  if (c.opts.pline) { ctx.strokeStyle = tagCol; ctx.lineWidth = 1; ctx.setLineDash([4.1, 6.2]); ctx.beginPath(); ctx.moveTo(xOf(g.n - 1) + s * .5 + 2, ty); ctx.lineTo(paneR, ty); ctx.stroke(); ctx.setLineDash([]); }
  // crosshair lines
  if (c.cross) { ctx.strokeStyle = 'rgba(200,200,200,.55)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); const cx = snap(c.cross.x) + half, cy = snap(c.cross.y) + half; ctx.beginPath(); ctx.moveTo(cx, pT); ctx.lineTo(cx, pB); ctx.moveTo(0, cy); ctx.lineTo(paneR, cy); ctx.stroke(); ctx.setLineDash([]); }
  ctx.restore();
  // axes
  ctx.fillStyle = '#2b2b2b'; ctx.fillRect(snap(paneR), pT, 1 / dpr * Math.max(1, Math.round(dpr / 2)), pB + 24 - pT);
  ctx.fillStyle = '#252525'; ctx.fillRect(0, snap(pB), r.w, 1 / dpr * Math.max(1, Math.round(dpr / 2)));
  ctx.font = FONT_AX; ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const pxPer = (1 - g.mt - g.mb) * g.PH / (g.top - g.bot), step = niceStep(40 / pxPer * 1, 1), pStep = step * pxPer < 40 ? step * 2 : step;
  const dec = pStep >= 1 ? 0 : Math.min(2, Math.ceil(-Math.log10(pStep)));
  for (let v = Math.ceil(g.y2p(pB) / pStep) * pStep; v <= g.y2p(pT); v += pStep) { const y = p2y(v); if (y < pT + 6 || y > pB - 6) continue; ctx.fillText(v.toFixed(dec), paneR + 5.1, y + .4); }
  // price tag over the axis
  ctx.save(); ctx.beginPath(); ctx.rect(0, pT - 10, r.w, pB - pT + 20); ctx.clip();
  ctx.fillStyle = tagCol; const tx = paneR - 3.5, tyy = p2y(c.tag);
  ctx.beginPath(); ctx.moveTo(tx + 8, tyy - 8); ctx.lineTo(r.w + 12, tyy - 8); ctx.lineTo(r.w + 12, tyy + 8); ctx.lineTo(tx + 8, tyy + 8); ctx.arc(tx + 8, tyy, 8, Math.PI / 2, Math.PI * 1.5); ctx.fill();
  ctx.font = FONT_TAG; ctx.fillStyle = '#fff'; ctx.fillText(c.tag.toFixed(2), paneR + 2.8, tyy + .5);
  ctx.restore();
  // crosshair labels
  if (c.cross) {
    const p = g.y2p(c.cross.y), lbl = p.toFixed(2); ctx.font = FONT_AX; const lw = ctx.measureText(lbl).width + 10;
    ctx.fillStyle = '#3d3d3d'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(paneR + 1, c.cross.y - 9, Math.max(lw, g.axisW - 2), 18, 4) : ctx.rect(paneR + 1, c.cross.y - 9, lw, 18); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(lbl, paneR + 6, c.cross.y + .4);
  }
  // time axis
  ctx.save(); ctx.beginPath(); ctx.rect(0, pB, paneR, 24); ctx.clip();
  ctx.font = FONT_AX; ctx.textAlign = 'center'; ctx.fillStyle = '#fff';
  const tfm = TF[c.tf] || 5, cands = [1, 2, 5, 10, 15, 30, 60, 120, 180, 240, 1440, 10080, 43200, 525600], minPx = 78;
  let iv = cands.find(m => m >= tfm && (m / tfm) * s >= minPx) || 525600;
  if (c.type === 'renko') iv = 1e12;
  let lastX = -1e9;
  const ly = pB + 10.6;
  for (let i = Math.max(0, g.i0 - 4); i <= g.j1; i++) {
    const b = g.slotAt(i); if (!b) continue; const x = xOf(i);
    let hit;
    if (iv >= 43200) { const a = dayDate(b.t), p = g.slotAt(i - 1) && dayDate(g.slotAt(i - 1).t); hit = !p || (iv >= 525600 ? a.getUTCFullYear() !== p.getUTCFullYear() : a.getUTCMonth() !== p.getUTCMonth()); }
    else if (iv >= 1440) { const p = g.slotAt(i - 1); hit = !p || Math.floor(b.t / iv) !== Math.floor(p.t / iv); }
    else { const m = b.t - Math.floor(b.t / DAY) * DAY - OPEN_MIN; hit = Math.abs(m / iv - Math.round(m / iv)) < 1e-6 && m >= 0; }
    if (!hit) continue;
    if (iv < 1440) { let nb = false; for (let j = i + 1; j <= Math.min(g.N - 1, i + 12); j++) { if (Math.floor(g.slotAt(j).t / DAY) !== Math.floor(g.slotAt(j - 1).t / DAY)) { nb = xOf(j) - x < 25; break; } } if (nb) continue; }
    const label = fmtTime(b.t, iv >= 43200 ? 43200 : iv >= 1440 ? 1440 : tfm), w = ctx.measureText(label).width;
    if (x - w / 2 < lastX + 10) continue;
    ctx.fillText(label, x, ly); lastX = x + w / 2;
  }
  if (c.cross) { const t = xToTime(g, c.cross.x), lbl = fmtTime(Math.round(t), tfm < 1 ? tfm : tfm), lw = ctx.measureText(lbl).width + 12; ctx.fillStyle = '#3d3d3d'; ctx.fillRect(c.cross.x - lw / 2, pB + 2, lw, 19); ctx.fillStyle = '#fff'; ctx.fillText(lbl, c.cross.x, ly); }
  ctx.restore();
  c.g = g;
  if (typeof payoffAxes === 'function') payoffAxes(id, ctx, g);
}
function drawShape(ctx, g, d, temp) {
  const ax = timeToX(g, d.a.t), ay = g.p2y(d.a.p), bx = timeToX(g, d.b.t), by = g.p2y(d.b.p);
  ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = '#2962ff'; ctx.globalAlpha = temp ? .8 : 1;
  if (d.tool === 'trend') { ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); for (const [x, y] of [[ax, ay], [bx, by]]) { ctx.beginPath(); ctx.arc(x, y, 4, 0, 7); ctx.fillStyle = '#171717'; ctx.fill(); ctx.lineWidth = 1.6; ctx.stroke(); } }
  else if (d.tool === 'hline') { ctx.beginPath(); ctx.moveTo(0, ay); ctx.lineTo(g.paneR, ay); ctx.stroke(); }
  else if (d.tool === 'rect') { ctx.strokeStyle = '#9c27b0'; ctx.fillStyle = 'rgba(156,39,176,.18)'; ctx.fillRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay)); ctx.lineWidth = 1.5; ctx.strokeRect(Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay)); }
  else if (d.tool === 'fib') {
    const lv = [[0, '#787b86'], [.236, '#f23645'], [.382, '#ff9800'], [.5, '#4caf50'], [.618, '#089981'], [.786, '#00bcd4'], [1, '#787b86']];
    const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx, x0 + 40);
    ctx.font = '400 10px Roboto, Arial, sans-serif'; ctx.textBaseline = 'bottom';
    lv.forEach(([f, col], k) => { const p = d.b.p + (d.a.p - d.b.p) * f, y = g.p2y(p); if (k) { const yp = g.p2y(d.b.p + (d.a.p - d.b.p) * lv[k - 1][0]); ctx.fillStyle = col; ctx.globalAlpha = .1; ctx.fillRect(x0, Math.min(y, yp), x1 - x0, Math.abs(y - yp)); ctx.globalAlpha = 1; } ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.fillStyle = col; ctx.fillText(`${f} (${p.toFixed(2)})`, x0 + 2, y - 1); });
    ctx.setLineDash([3, 3]); ctx.strokeStyle = '#787b86'; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.restore();
}
let dirty = { idx: true, opt: true };
function redraw(id) { if (id) dirty[id] = true; else dirty = { idx: true, opt: true }; }
function frame() { let any = false; for (const id of CHART_IDS) if (dirty[id]) { dirty[id] = false; drawChart(id); any = true; } if (any && PM.on) renderPayoffUI(); requestAnimationFrame(frame); }

/* Future slots: candles of the chart's timeframe after the last bar, in trading time, so nights take no
   width and every session starts its candles at 9:15 am, as the engine's candles do. They run to 3:30 pm
   on the next trading day, or to the Payoff axis end when that is later (BR-27). */
function futureSlots(c, bars) {
  const last = bars[bars.length - 1]; if (!last || last.T1 == null) return [];
  const m = Math.min(TF[c.tf] || 5, E.SESSION), limit = Math.max((E.TODAY + 2) * E.SESSION, typeof payoffAxisLimit === 'function' ? payoffAxisLimit() : 0);
  const key = c.tf + ':' + last.T1 + ':' + limit;
  c._fut = c._fut || {}; if (c._fut.key === key) return c._fut.v;
  const out = []; let a = last.T1;
  while (a < limit - 1e-9 && out.length < 20000) {
    const d0 = Math.floor(a / E.SESSION + 1e-9) * E.SESSION;
    const end = Math.min(a + m, d0 + E.SESSION);
    out.push({ t: calStart(a), T0: a, T1: end, f: true });
    a = end;
  }
  c._fut = { key, v: out };
  return out;
}
// The trading time at the close of slot i (a past bar or a future slot)
const slotEnd = (g, i) => { const b = g.slotAt(i); return b ? b.T1 : null; };
