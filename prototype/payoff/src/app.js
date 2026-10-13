/* =====================================================================
   Sahi Payoff prototype: Scalper split view with Payoff (PRD v1.0),
   changed to hold-to-peek: hold Option (Mac) or Alt (Windows) to see
   Payoff, release to hide. The toolbar button keeps it on.
   ===================================================================== */
(() => {
  const E = Engine, P = Payoff;
  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LS = {
    get(k, d) { try { const v = localStorage.getItem('sahiPayoff.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('sahiPayoff.' + k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } },
    clear() { try { Object.keys(localStorage).filter(k => k.startsWith('sahiPayoff.')).forEach(k => localStorage.removeItem(k)); } catch (e) { /* storage blocked */ } }
  };
  const C = (t, k, e) => E.contract(t, k, e);
  // Replace an element's markup only when it changed, so ticks don't drop focus or hover.
  const setHTML = (el, html) => { if (el._html === html) return false; el._html = html; el.innerHTML = html; return true; };
  const SHOT_C = C('CE', 22500, '2026-10-27');
  let legId = 1;
  const leg = (c, side, avg, product = 'CARRY', qty = E.LOT) => ({ id: legId++, c, side, qty, avg, product });

  /* ---------- scenarios (all sample data) ---------- */
  const SCEN = {
    single: { name: 'One call · 27 Oct 22500', group: 'One position (S2)', product: true, legs: p => [leg(SHOT_C, 1, 412.6, p)], opt: SHOT_C },
    expiry: { name: 'Expiry-day call · 13 Oct 22750', group: 'One position (S2)', product: true, legs: p => [leg(C('CE', 22750, '2026-10-13'), 1, 78.4, p)], opt: C('CE', 22750, '2026-10-13') },
    soldput: { name: 'Sold put · 19 Oct 22500', group: 'One position (S2)', product: true, legs: p => [leg(C('PE', 22500, '2026-10-19'), -1, 171.2, p)], opt: C('PE', 22500, '2026-10-19') },
    pretrade: { name: 'Not holding · pre-trade', group: 'No position (S2)', legs: () => [], opt: SHOT_C },
    empty: { name: 'Not holding · no contract loaded', group: 'No position (S2)', legs: () => [], opt: null },
    book: {
      name: 'Weekly + monthly book', group: 'Several positions (S3)', opt: SHOT_C, realised: 1240,
      others: [{ id: 'bn1', label: 'BANKNIFTY 27 Oct 51500 Call', und: 'BANKNIFTY', side: 1, qty: 30, avg: 612.4, ltp: 655.2, product: 'Carry forward' }],
      legs: () => [leg(C('PE', 22500, '2026-10-19'), -1, 171.2), leg(C('CE', 22950, '2026-10-19'), -1, 128.4), leg(SHOT_C, 1, 412.6)]
    },
    condor: { name: 'Iron condor · 19 Oct', group: 'Several positions (S3)', opt: C('PE', 22500, '2026-10-19'), legs: () => [leg(C('PE', 22300, '2026-10-19'), 1, 112.1), leg(C('PE', 22500, '2026-10-19'), -1, 171.2), leg(C('CE', 22950, '2026-10-19'), -1, 128.4), leg(C('CE', 23150, '2026-10-19'), 1, 71.9)] },
    straddle: { name: 'Long straddle · 27 Oct 22700', group: 'Several positions (S3)', opt: C('CE', 22700, '2026-10-27'), legs: () => [leg(C('CE', 22700, '2026-10-27'), 1, 338.5), leg(C('PE', 22700, '2026-10-27'), 1, 352.2)] },
    calendar: { name: 'Calendar spread · 22700 Call', group: 'Several positions (S3)', opt: C('CE', 22700, '2026-10-27'), legs: () => [leg(C('CE', 22700, '2026-10-19'), -1, 241.3), leg(C('CE', 22700, '2026-10-27'), 1, 336.1)] },
    futures: { name: 'Futures + protective put', group: 'Several positions (S3)', opt: C('PE', 22500, '2026-10-27'), legs: () => [leg(C('FUT', 0, '2026-10-27'), 1, 22640), leg(C('PE', 22500, '2026-10-27'), 1, 262.4)] },
    mixed: { name: 'Intraday + carry-forward', group: 'Several positions (S3)', opt: SHOT_C, legs: () => [leg(C('CE', 22700, '2026-10-13'), 1, 104.3, 'INTRADAY'), leg(C('PE', 22500, '2026-10-19'), -1, 171.2)] }
  };
  const CLOCKS = [[570, '9:30 am'], [675, '11:15 am'], [810, '1:30 pm'], [905, '3:05 pm'], [945, '3:45 pm · closed']];

  /* ---------- state ---------- */
  const isMac = /Mac|iPhone|iPad/.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');
  const st = {
    platform: LS.get('platform', isMac ? 'mac' : 'win'),
    clock: 675, pricing: 'live', ticks: true, later: true, orderFail: false,
    scenario: LS.get('scenario', 'single'), product: 'CARRY',
    legs: [], others: [], realised: 0, opt: SHOT_C, lots: 1, oneTap: true,
    sticky: false, peek: false, pin: null, horizon: null, cone: true,
    hover: null, keyPt: null, rowHover: null, noise: 0,
    tipSeen: LS.get('tipSeen', false), hinted: LS.get('hinted', false), demoMin: LS.get('demoMin', innerWidth < 1600),
    orders: {}, exits: [], events: [], fadeStart: 0, loadingUntil: 0, m1: null, popover: null
  };

  const nowT = () => st.clock >= E.CLOSE ? E.tOf(E.TODAY, E.CLOSE) : E.tOf(E.TODAY, st.clock);
  const closed = () => st.clock >= E.CLOSE;
  const S0 = () => E.pathAt(nowT(), closed()) + (st.pricing === 'live' ? st.noise : 0);
  const ltp = c => c.type === 'FUT' ? Math.round(S0() * 20) / 20 : E.roundTick(E.price(c, S0(), nowT()));
  const keyName = () => st.platform === 'mac' ? '⌥' : 'Alt';
  const keyWord = () => st.platform === 'mac' ? 'Option' : 'Alt';
  const optPrevClose = c => (c === SHOT_C) ? E.SHOT.prevClose : E.roundTick(E.optionPathAt(c, E.tOf(E.TODAY, E.OPEN), true));

  function applyScenario() {
    const sc = SCEN[st.scenario] || SCEN.single;
    st.legs = sc.legs(st.product);
    st.others = (sc.others || []).map(o => Object.assign({}, o));
    st.realised = sc.realised || 0;
    st.opt = sc.opt;
    st.pin = null; st.m1 = null; st.orders = {}; st.exits = []; st.horizon = null; st.keyPt = null; st.rowHover = null;
    // After the close, intraday positions were squared off at 3:20 pm and their P&L is realised.
    if (closed()) {
      st.legs = st.legs.filter(l => {
        if (l.product !== 'INTRADAY') return true;
        st.realised += l.side * l.qty * (E.price(l.c, E.pathAt(P.SQ_T), P.SQ_T) - l.avg);
        return false;
      });
    }
    closeM1(true);
    rebuildData();
  }

  /* ---------- the book Payoff prices ---------- */
  function book() {
    const legs = st.legs.filter(l => l.c.und === 'NIFTY' && l.qty > 0);
    const b = { legs, nowT: nowT(), S0: S0(), closed: closed(), pretrade: false };
    if (!legs.length && st.opt) { b.pretrade = true; b.legs = [{ id: 0, c: st.opt, side: 1, qty: st.lots * E.LOT, avg: ltp(st.opt), product: 'CARRY' }]; }
    return b;
  }
  const isS3 = () => st.legs.filter(l => l.c.und === 'NIFTY' && l.qty > 0).length >= 2;
  const payoffOn = () => st.sticky || st.peek || !!st.pin;
  const expiredSingle = b => !isS3() && !b.pretrade && b.legs.length === 1 && b.legs[0].c.type !== 'FUT' && b.legs[0].c.expT <= b.nowT;
  function axisEnd(b) {
    let end = P.axisEnd(b);
    if (end == null) return null;
    return end;
  }
  const otherCount = () => st.others.length;
  const sessionEnd = () => closed() ? (E.TODAY + 2) * E.SESSION : (E.TODAY + 1) * E.SESSION;

  function horizons(b) {
    const end = axisEnd(b);
    if (end == null) return [];
    const allIntraday = !b.pretrade && b.legs.every(l => l.product === 'INTRADAY');
    const todayEnd = allIntraday ? Math.max(nowT(), P.SQ_T) : Math.min(end, sessionEnd());
    const list = [{ key: 'today', label: closed() ? 'Next session' : 'Today', T: todayEnd }];
    if (!allIntraday) {
      const seen = new Set();
      b.legs.filter(l => l.product === 'CARRY' || b.pretrade).map(l => l.c.exp).sort((x, y) => x.T - y.T).forEach(e => {
        if (e.T > todayEnd && !seen.has(e.key)) { seen.add(e.key); list.push({ key: e.key, label: e.info.short, T: e.T }); }
      });
    }
    return list;
  }
  function currentHorizon(b) {
    const hs = horizons(b);
    if (!hs.length) return null;
    const pick = hs.find(h => h.key === st.horizon);
    if (pick) return pick;
    return isS3() ? (hs[1] || hs[0]) : hs[hs.length - 1];
  }
  function markers(b) {
    const out = [];
    const end = axisEnd(b);
    if (end == null) return out;
    const byExp = {};
    b.legs.forEach(l => { if (l.c.expT > nowT() && l.c.expT <= end && !(l.product === 'INTRADAY' && !b.pretrade)) (byExp[l.c.exp.key] = byExp[l.c.exp.key] || { e: l.c.exp, n: 0 }).n++; });
    Object.values(byExp).forEach(({ e, n }) => {
      const lbl = `${e.kind} expiry · ${e.info.label}`;
      out.push({ T: e.T, label: lbl, sub: e.movedFrom ? `moved from ${e.movedFrom.label}` : '', tip: `${lbl}${e.movedFrom ? ` · moved from ${e.movedFrom.label} for a holiday` : ''} · ${n} ${n === 1 ? 'leg expires' : 'legs expire'}` });
    });
    if (!b.pretrade && b.legs.some(l => l.product === 'INTRADAY') && P.SQ_T > nowT()) {
      const n = b.legs.filter(l => l.product === 'INTRADAY').length;
      out.push({ T: P.SQ_T, label: 'Auto square-off · 3:20 pm', sub: '', tip: `Auto square-off · 3:20 pm · ${n} intraday ${n === 1 ? 'position' : 'positions'}` });
    }
    return out.sort((a, c) => a.T - c.T);
  }

  /* ---------- charts ---------- */
  const idx = new SahiChart($('#idxCanvas'), { tf: 3, dec: 2 });
  const OI = [];
  const opt = new SahiChart($('#optCanvas'), {
    tf: 5, dec: 2, volFrac: 0.1,
    sub: { frac: 0.26, series: OI, lo: 21e5, hi: 43e5, ticks: [25e5, 30e5, 35e5, 40e5], fmt: v => (v / 1e5).toFixed(0) + 'L', color: '#2e8cf0' }
  });
  let shownOptId = null;
  const savedViews = { idx: null, opt: null };

  function shownOpt() {
    const b = book();
    if (payoffOn() && !isS3() && !b.pretrade && b.legs.length === 1 && b.legs[0].c.type !== 'FUT') return b.legs[0].c;
    return st.opt;
  }
  function rebuildData() {
    const T = nowT(), S = S0(), cl = closed();
    const ic = E.candles(3, E.tOf(E.TODAY - 1, E.OPEN), T, (t, c) => E.pathAt(t, c), 11);
    const last = ic[ic.length - 1];
    if (last) { last.c = S; last.h = Math.max(last.h, S); last.l = Math.min(last.l, S); }
    idx.setData(ic, T, S);
    const c = shownOpt();
    if (c) {
      const oc = E.candles(5, E.tOf(E.TODAY - 3, E.OPEN), T, (t, cc) => E.optionPathAt(c, t, cc), 7 + (c.strike || 0));
      const lp = ltp(c);
      const ol = oc[oc.length - 1];
      if (ol) { ol.c = lp; ol.h = Math.max(ol.h, lp); ol.l = Math.min(ol.l, lp); }
      opt.setData(oc, T, lp);
    } else opt.setData([], T, null);
    if (!OI.length || OI._T !== T) {
      OI.length = 0;
      const r = E.rng(5);
      let v = 25.5e5;
      for (let t = E.tOf(E.TODAY - 3, E.OPEN); t <= T; t += 5) { v += (r() - 0.47) * 0.32e5 + Math.sin(t / 90) * 0.05e5; v = Math.max(23e5, Math.min(41.5e5, v)); OI.push({ T: t, v }); }
      OI._T = T;
    }
    if (shownOptId !== (c && c.id)) { shownOptId = c && c.id; }
    if (!payoffOn()) defaultViews();
    renderUI();
  }
  function defaultViews() {
    const T = nowT();
    idx.limitT = null; opt.limitT = null;
    idx.setView(...idx.clampView(T - 300, T + 24));
    opt.setView(...opt.clampView(E.tOf(E.TODAY - 3, E.OPEN) - 20, T + 60));
  }
  function fitTo(hT) {
    const T = nowT();
    const span = Math.max(15, hT - T);
    const end = axisEnd(book());
    const t0 = T - Math.max(45, span * 0.28), t1 = hT + span * 0.035;
    idx.setView(t0, t1); opt.setView(t0, t1);
  }
  function enterPayoff(source) {
    const b = book();
    savedViews.idx = savedViews.idx || idx.view; savedViews.opt = savedViews.opt || opt.view;
    const end = axisEnd(b);
    idx.limitT = end; opt.limitT = end;
    const h = currentHorizon(b);
    if (h) fitTo(h.T);
    st.fadeStart = performance.now();
    st.loadingUntil = performance.now() + 240;
    setTimeout(() => { idx.invalidate(); renderUI(); }, 260);
    rebuildData();
    log('payoff_open', `source=${source}${isS3() ? ` leg_count=${b.legs.length} expiry_count=${new Set(b.legs.map(l => l.c.expKey)).size}` : ''}${b.pretrade ? ' pretrade' : ''}`);
    if (b.pretrade) log('payoff_pretrade_open');
    st.openedAt = performance.now();
  }
  function exitPayoff() {
    idx.limitT = null; opt.limitT = null;
    if (savedViews.idx) idx.setView(savedViews.idx.t0, savedViews.idx.t1);
    if (savedViews.opt) opt.setView(savedViews.opt.t0, savedViews.opt.t1);
    savedViews.idx = savedViews.opt = null;
    st.hover = null; st.keyPt = null; st.rowHover = null;
    updateReadout(null); hideTip('canvas'); hideTip('el');
    log('payoff_close', `duration=${((performance.now() - (st.openedAt || performance.now())) / 1000).toFixed(1)}s`);
    rebuildData();
  }
  function setPayoff(fn, source) {
    const was = payoffOn();
    fn();
    const is = payoffOn();
    if (!was && is) enterPayoff(source);
    else if (was && !is) exitPayoff();
    else { rebuildData(); }
  }

  /* ---------- shading and breakevens (cached per view) ---------- */
  let cache = null;
  function payoffGrid(ch, b, coarse) {
    const end = axisEnd(b);
    const key = [ch.view.t0, ch.view.t1, ch.w, ch.h, ch.yr.lo.toFixed(2), ch.yr.hi.toFixed(2), b.S0.toFixed(2), b.nowT, b.legs.map(l => l.id + ':' + l.qty + ':' + l.avg + ':' + l.c.id).join('|'), coarse].join(',');
    if (cache && cache.key === key) return cache;
    const T0 = b.nowT, step = coarse ? 6 : 3;
    const x0 = Math.max(0, ch.tToX(T0)), x1 = Math.min(ch.plotW, ch.tToX(end));
    const lo = ch.yr.lo, hi = ch.yr.hi;
    const pStep = (hi - lo) / Math.max(40, (ch.pToY(lo) - ch.pToY(hi)) / (coarse ? 6 : 3));
    const cols = [];
    for (let x = x0; x < x1; x += step) {
      const T = Math.min(end, ch.xToT(Math.min(x1, x + step)));
      if (T <= T0) continue;
      const roots = P.roots(b, T, lo, hi, pStep);
      const profitAtLo = P.pnl(b, lo, T) > 0;
      const segs = [];
      const edges = [lo, ...roots, hi];
      for (let i = 0; i < edges.length - 1; i++) {
        const profit = (i % 2 === 0) ? profitAtLo : !profitAtLo;
        segs.push({ a: edges[i], b: edges[i + 1], profit });
      }
      cols.push({ x, w: Math.min(step, x1 - x), T, roots, segs });
    }
    // breakeven polylines
    const lines = [];
    let active = [];
    cols.forEach(col => {
      const cx = col.x + col.w / 2;
      const jump = (hi - lo) * 0.12;
      if (col.roots.length !== active.length || col.roots.some((r, i) => Math.abs(r - active[i].pts[active[i].pts.length - 1][1]) > jump)) {
        active = col.roots.map(r => { const l = { pts: [[cx, r]] }; lines.push(l); return l; });
      } else col.roots.forEach((r, i) => active[i].pts.push([cx, r]));
    });
    // breakevens outside the visible range at the right end, for edge arrows
    const last = cols[cols.length - 1];
    let outside = [];
    if (last) {
      const wide = P.roots(b, last.T, b.S0 * 0.6, b.S0 * 1.4, 5);
      outside = wide.filter(r => r > hi || r < lo);
    }
    const anyRoot = cols.some(c => c.roots.length);
    const sign = last ? (P.pnl(b, (lo + hi) / 2, last.T) > 0 ? 'Profit' : 'Loss') : null;
    cache = { key, cols, lines, last, outside, anyRoot, sign, end, x0, x1 };
    return cache;
  }

  /* ---------- canvas helpers ---------- */
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function pill(ctx, x, y, lines, o = {}) {
    lines = Array.isArray(lines) ? lines : [lines];
    ctx.font = o.font || '600 11px Inter, system-ui, sans-serif';
    const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + (o.padX || 14);
    const lh = o.lh || 15, h = lines.length * lh + 7;
    let x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
    let y0 = o.valign === 'bottom' ? y - h : o.valign === 'middle' ? y - h / 2 : y;
    if (o.clampW) x0 = Math.max(2, Math.min(o.clampW - w - 2, x0));
    ctx.fillStyle = o.bg || 'rgba(20, 25, 34, .94)';
    rr(ctx, x0, y0, w, h, o.r == null ? 5 : o.r); ctx.fill();
    if (o.border) { ctx.strokeStyle = o.border; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => {
      ctx.fillStyle = i === 0 ? (o.fg || '#e9ecf1') : (o.fg2 || '#a7afbc');
      ctx.font = i === 0 ? (o.font || '600 11px Inter, system-ui, sans-serif') : '500 10.5px Inter, system-ui, sans-serif';
      ctx.fillText(l, x0 + (o.padX || 14) / 2, y0 + 4 + lh * i + lh / 2);
    });
    return { x: x0, y: y0, w, h };
  }
  const hits = { idx: [], opt: [] };
  const alpha = () => Math.min(1, (performance.now() - st.fadeStart) / 220);

  /* ---------- index chart overlays ---------- */
  idx.on('extraRange', ch => {
    if (!payoffOn() || st.pricing === 'unavailable') return null;
    const b = book(); const end = axisEnd(b); if (end == null) return null;
    const tR = Math.min(end, ch.view.t1);
    const half = P.coneHalf(b.S0, E.BASE_IV, b.nowT, tR);
    return [b.S0 - half * 1.05, b.S0 + half * 1.05];
  });
  idx.on('below', (ctx, ch) => {
    hits.idx = [];
    if (!payoffOn()) return;
    const b = book();
    const end = axisEnd(b);
    if (end == null || expiredSingle(b)) return;
    const a = alpha(); if (a < 1) ch.invalidate();
    ctx.globalAlpha = a;
    const nx = ch.tToX(b.nowT), ex = ch.tToX(end);
    ctx.fillStyle = css('--future-tint'); ctx.fillRect(nx, 0, ex - nx, ch.mainH);
    // day separators in the future zone (trading hours only, BR-15)
    ctx.strokeStyle = 'rgba(255,255,255,.06)'; ctx.setLineDash([2, 4]); ctx.beginPath();
    for (let d = Math.ceil(b.nowT / E.SESSION) * E.SESSION; d < end; d += E.SESSION) { if (d <= b.nowT) continue; const x = Math.round(ch.tToX(d)) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, ch.mainH); }
    ctx.stroke(); ctx.setLineDash([]);
    if (st.pricing === 'unavailable') { ctx.globalAlpha = 1; return; }
    const g = payoffGrid(ch, b, !!ch.drag);
    const stale = st.pricing === 'delayed';
    ctx.fillStyle = stale ? 'rgba(160,170,190,.08)' : css('--profit-tint');
    g.cols.forEach(c => c.segs.forEach(s => { if (s.profit) { const y1 = ch.pToY(s.b), y2 = ch.pToY(s.a); ctx.fillRect(c.x, y1, c.w + 0.5, y2 - y1); } }));
    // expected-move cone
    if (st.cone) {
      const xs = [];
      for (let x = nx; x <= Math.min(ex, ch.plotW); x += 4) xs.push(x);
      xs.push(Math.min(ex, ch.plotW));
      const up = xs.map(x => [x, ch.pToY(b.S0 + P.coneHalf(b.S0, E.BASE_IV, b.nowT, Math.min(end, ch.xToT(x))))]);
      const dn = xs.map(x => [x, ch.pToY(b.S0 - P.coneHalf(b.S0, E.BASE_IV, b.nowT, Math.min(end, ch.xToT(x))))]);
      ctx.fillStyle = 'rgba(216,104,124,.045)';
      ctx.beginPath(); up.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); dn.slice().reverse().forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = stale ? '#7d8596' : css('--cone'); ctx.lineWidth = 1.2; ctx.setLineDash([5, 4]);
      [up, dn].forEach(line => { ctx.beginPath(); line.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke(); });
      ctx.setLineDash([]); ctx.lineWidth = 1;
      // label the cone part-way along its upper edge, clear of the expiry labels at the top right
      const li = Math.floor(up.length * 0.5), [lx, ly] = up[li] || [0, 0];
      if (ly > ch.o.padTop + 30) { ctx.font = '500 10.5px Inter, system-ui, sans-serif'; ctx.fillStyle = stale ? '#7d8596' : css('--cone'); ctx.textAlign = 'center'; ctx.fillText('Typical move (1 SD)', lx, ly - 9); ctx.textAlign = 'left'; }
    }
    ctx.globalAlpha = 1;
  });
  idx.on('above', (ctx, ch) => {
    if (!payoffOn()) { drawExitMarkers(ctx, ch, 'idx'); return; }
    const b = book();
    const end = axisEnd(b);
    if (end == null) return;
    const a = alpha();
    ctx.globalAlpha = a;
    const stale = st.pricing === 'delayed';
    const nx = ch.tToX(b.nowT);
    const topY = ch.o.padTop;
    // markers
    markers(b).forEach(m => {
      const x = Math.round(ch.tToX(m.T)) + 0.5;
      if (x < 0 || x > ch.plotW) return;
      ctx.strokeStyle = '#8b95a8'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x, topY - 4); ctx.lineTo(x, ch.mainH); ctx.stroke(); ctx.setLineDash([]);
      const r = pill(ctx, x - 6, topY + 4, m.sub ? [m.label, m.sub] : m.label, { align: 'right', bg: 'rgba(30,36,48,.95)', border: '#3a4558', clampW: ch.plotW });
      hits.idx.push(Object.assign(r, { tip: m.tip }));
    });
    // Now line
    if (!expiredSingle(b)) {
      ctx.strokeStyle = '#71809a'; ctx.beginPath(); ctx.moveTo(Math.round(nx) + 0.5, topY - 4); ctx.lineTo(Math.round(nx) + 0.5, ch.mainH); ctx.stroke();
      pill(ctx, nx + 5, topY + 4, closed() ? 'Now · last close' : 'Now', { bg: 'rgba(30,36,48,.95)', border: '#3a4558' });
    }
    if (st.pricing === 'unavailable' || expiredSingle(b)) { ctx.globalAlpha = 1; return; }
    const g = payoffGrid(ch, b, !!ch.drag);
    const beCol = stale ? '#8a92a3' : css('--breakeven');
    ctx.strokeStyle = beCol; ctx.lineWidth = 1.8;
    g.lines.forEach(l => { if (l.pts.length < 2) return; ctx.beginPath(); l.pts.forEach(([x, p], i) => i ? ctx.lineTo(x, ch.pToY(p)) : ctx.moveTo(x, ch.pToY(p))); ctx.stroke(); });
    ctx.lineWidth = 1;
    // labels at the right end of the zone shown
    const allIntraday = !b.pretrade && b.legs.every(l => l.product === 'INTRADAY');
    const hz = currentHorizon(b);
    let lc = g.last;
    if (hz && hz.T < end && ch.tToX(hz.T) <= g.x1 + 1) lc = g.cols.filter(c => c.T <= hz.T + 0.5).pop() || g.last;
    const lcT = lc ? lc.T : end;
    const atAxisEnd = lcT >= end - 0.5;
    const endWord = atAxisEnd ? (allIntraday ? 'at 3:20 pm' : 'at expiry') : `at ${E.fmtT(Math.round(lcT / ch.o.tf) * ch.o.tf)}`.replace(/, \w{3} /, ', ');
    const lx = lc ? lc.x + lc.w : g.x1;
    if (g.last) {
      const used = [];
      lc.roots.slice().sort((p, q) => q - p).forEach(r => {
        let y = ch.pToY(r) - 4;
        while (used.some(u => Math.abs(u - y) < 22)) y += 22;
        used.push(y);
        const box = pill(ctx, lx - 6, y, `Breakeven ${E.level(r)} ${endWord}`, { align: 'right', valign: 'bottom', fg: beCol, bg: 'rgba(16,20,28,.92)', border: stale ? '#4a5263' : 'rgba(242,184,75,.45)' });
        hits.idx.push(Object.assign(box, { tip: 'Breakeven: the Nifty level where this position’s P&L is zero at each time' }));
      });
      // edge arrows
      g.outside.forEach(r => {
        const up = r > ch.yr.hi;
        pill(ctx, g.x1 - 6, up ? topY + 34 : ch.mainH * (1 - ch.o.volFrac) - 8, `Breakeven ${E.level(r)} ${up ? '↑' : '↓'}`, { align: 'right', valign: up ? 'top' : 'bottom', fg: beCol, bg: 'rgba(16,20,28,.92)', border: 'rgba(242,184,75,.35)' });
      });
      // Profit / Loss labels
      const col = g.cols[Math.floor(g.cols.length * 0.62)];
      if (col) {
        const big = want => col.segs.filter(s => s.profit === want).sort((p, q) => (q.b - q.a) - (p.b - p.a))[0];
        [[true, 'Profit', stale ? '#8a92a3' : css('--up-2')], [false, 'Loss', stale ? '#8a92a3' : '#e57a89']].forEach(([want, text, color]) => {
          const s = big(want);
          if (!s) return;
          const y1 = ch.pToY(s.b), y2 = ch.pToY(s.a);
          if (y2 - y1 < 26) return;
          const yc = Math.max(topY + 64, Math.min(ch.mainH - 26, (y1 + y2) / 2));
          if (yc < y1 + 8 || yc > y2 - 8) return;
          ctx.font = '600 12px Inter, system-ui, sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'center';
          ctx.fillText(text, col.x, yc); ctx.textAlign = 'left';
        });
      }
      if (!g.anyRoot && !g.outside.length) pill(ctx, nx + 8, topY + 34, `${g.sign} at every level shown`, { fg: g.sign === 'Profit' ? css('--up-2') : '#e57a89', bg: 'rgba(16,20,28,.92)', border: '#3a4558' });
      else if (!g.anyRoot) pill(ctx, nx + 8, topY + 34, `${g.sign} at every level shown`, { fg: g.sign === 'Profit' ? css('--up-2') : '#e57a89', bg: 'rgba(16,20,28,.92)', border: '#3a4558' });
    }
    // hovered table row: that leg's strike
    if (st.rowHover && st.rowHover.c.type !== 'FUT') {
      const y = Math.round(ch.pToY(st.rowHover.c.strike)) + 0.5;
      if (y > topY && y < ch.mainH) {
        ctx.strokeStyle = '#9fb4d8'; ctx.setLineDash([1.5, 3]); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ch.plotW, y); ctx.stroke(); ctx.setLineDash([]);
        pill(ctx, 8, y - 2, `${st.rowHover.c.strike} ${st.rowHover.c.type === 'CE' ? 'Call' : 'Put'} strike`, { valign: 'bottom', fg: '#cfdcf4' });
      }
    }
    drawExitMarkers(ctx, ch, 'idx');
    // hovered or keyboard point, and the pin
    const pt = st.hover && st.hover.T ? st.hover : null;
    if (pt) dot(ctx, ch.tToX(pt.T), ch.pToY(pt.S), '#ffffff', 3.5);
    if (st.pin) {
      const x = ch.tToX(st.pin.T), y = ch.pToY(st.pin.S);
      ctx.strokeStyle = '#ffd98a'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, ch.mainH); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(242,184,75,.25)'; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
      dot(ctx, x, y, '#ffd98a', 5);
    }
    ctx.globalAlpha = 1;
  });
  function dot(ctx, x, y, color, r) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#0d1118'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1; }
  function drawExitMarkers(ctx, ch, which) {
    st.exits.forEach(x0 => {
      const x = Math.round(ch.tToX(x0.T)) + 0.5;
      if (x < 0 || x > ch.plotW) return;
      ctx.strokeStyle = '#f5a524'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, ch.o.padTop); ctx.lineTo(x, ch.mainH); ctx.stroke(); ctx.lineWidth = 1;
      const r = pill(ctx, x + 5, ch.mainH - 40, x0.label, { bg: '#3a2a0e', fg: '#ffd98a', border: '#7a5a1c' });
      hits[which].push(Object.assign(r, { tip: x0.tip }));
    });
  }
  idx.on('timeLabel', T => E.fmtT(Math.max(0, Math.round(T / 3) * 3)));
  idx.on('crosshair', (ctx, ch, p) => {
    if (!payoffOn()) return;
    const b = book(); const end = axisEnd(b);
    if (end == null) return;
    const T = ch.xToT(p.x);
    if (T > end + 1) return false;
  });

  /* ---------- option chart overlays (S2) ---------- */
  opt.on('extraRange', ch => {
    if (!payoffOn() || isS3() || st.pricing === 'unavailable') return null;
    const b = book(); const end = axisEnd(b);
    if (end == null || !b.legs.length) return null;
    const l = b.legs[0];
    if (l.c !== shownOpt()) return null;
    const vals = [l.avg];
    const tR = Math.min(end, ch.view.t1);
    for (let k = 1; k <= 4; k++) {
      const T = b.nowT + (tR - b.nowT) * k / 4;
      const half = P.coneHalf(b.S0, E.BASE_IV, b.nowT, T);
      vals.push(P.legValue(l, b.S0, T, b), P.legValue(l, b.S0 + half * 0.5, T, b), P.legValue(l, b.S0 - half * 0.5, T, b));
    }
    return [Math.max(0, Math.min(...vals)), Math.max(...vals)];
  });
  opt.on('below', (ctx, ch) => {
    hits.opt = [];
    if (!payoffOn() || isS3()) return;
    const b = book(); const end = axisEnd(b);
    if (end == null || expiredSingle(b)) return;
    const nx = ch.tToX(b.nowT), ex = ch.tToX(end);
    ctx.globalAlpha = alpha();
    ctx.fillStyle = css('--future-tint'); ctx.fillRect(nx, 0, ex - nx, ch.mainH);
    ctx.globalAlpha = 1;
  });
  opt.on('above', (ctx, ch) => {
    const b = book();
    const shown = shownOpt();
    // existing position pills on the option chart
    st.legs.filter(l => l.c === shown).forEach(l => {
      const y = Math.round(ch.pToY(l.avg)) + 0.5;
      if (y < ch.o.padTop || y > ch.mainH) return;
      const p = l.side * l.qty * (ltp(l.c) - l.avg);
      ctx.strokeStyle = l.side > 0 ? 'rgba(35,193,165,.55)' : 'rgba(236,74,94,.55)'; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ch.plotW, y); ctx.stroke(); ctx.setLineDash([]);
      pill(ctx, 70, y, `${l.side > 0 ? 'B' : 'S'} ${l.qty} @ ${l.avg.toFixed(2)}  ${E.signed(p)}`, { valign: 'middle', bg: l.side > 0 ? '#0f3a33' : '#3f1820', fg: '#fff', border: l.side > 0 ? '#1fa48e' : '#ec4a5e' });
      const o = st.orders[l.id] || {};
      [['tp', 'TP', '#1fa48e'], ['sl', 'SL', '#ec4a5e']].forEach(([k, lab, colr]) => {
        if (!o[k]) return;
        const yy = Math.round(ch.pToY(o[k])) + 0.5;
        if (yy < ch.o.padTop || yy > ch.mainH) return;
        ctx.strokeStyle = colr; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(ch.plotW, yy); ctx.stroke(); ctx.setLineDash([]);
        pill(ctx, ch.plotW - 8, yy, `${lab} ${o[k].toFixed(2)}`, { align: 'right', valign: 'middle', bg: colr, fg: '#fff' });
      });
    });
    if (!payoffOn() || isS3()) { drawExitMarkers(ctx, ch, 'opt'); return; }
    const end = axisEnd(b);
    if (end == null || expiredSingle(b)) return;
    const l = b.legs[0];
    if (!l || l.c !== shown) return;
    ctx.globalAlpha = alpha();
    const stale = st.pricing === 'delayed';
    const nx = ch.tToX(b.nowT), topY = ch.o.padTop;
    markers(b).forEach(m => {
      const x = Math.round(ch.tToX(m.T)) + 0.5;
      if (x < 0 || x > ch.plotW) return;
      ctx.strokeStyle = '#8b95a8'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x, topY); ctx.lineTo(x, ch.mainH); ctx.stroke(); ctx.setLineDash([]);
    });
    ctx.strokeStyle = '#71809a'; ctx.beginPath(); ctx.moveTo(Math.round(nx) + 0.5, topY); ctx.lineTo(Math.round(nx) + 0.5, ch.mainH); ctx.stroke();
    pill(ctx, nx + 5, topY + 4, closed() ? 'Now · last close' : 'Now', { bg: 'rgba(30,36,48,.95)', border: '#3a4558' });
    if (st.pricing === 'unavailable') { ctx.globalAlpha = 1; return; }
    // paid line
    const yP = Math.round(ch.pToY(l.avg)) + 0.5;
    ctx.strokeStyle = '#c9d0dc'; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(0, yP); ctx.lineTo(ch.plotW, yP); ctx.stroke(); ctx.setLineDash([]);
    pill(ctx, Math.max(nx + 8, 8), yP + 4, b.pretrade ? `Last price ₹${l.avg.toFixed(2)}` : l.side > 0 ? `Paid ₹${l.avg.toFixed(2)}` : `Sold at ₹${l.avg.toFixed(2)}`, { fg: '#e9ecf1' });
    // flat case
    const pts = [];
    for (let x = nx; x <= Math.min(ch.tToX(end), ch.plotW); x += 3) pts.push([x, P.legValue(l, b.S0, Math.min(end, ch.xToT(x)), b)]);
    ctx.strokeStyle = stale ? '#7d8596' : '#a48bff'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath();
    pts.forEach(([x, v], i) => i ? ctx.lineTo(x, ch.pToY(v)) : ctx.moveTo(x, ch.pToY(v))); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    if (pts.length > 2) { const [lx, lv] = pts[pts.length - 1]; pill(ctx, lx - 4, ch.pToY(lv) - 6, `If Nifty stays at ${E.level(b.S0)}`, { align: 'right', valign: 'bottom', fg: stale ? '#9aa2b2' : '#cbbcff' }); }
    // marker for the hovered (or pinned) time
    const pt = st.pin || (st.hover && st.hover.T ? st.hover : null);
    if (pt) {
      const d = P.legDetail(l, pt.S, pt.T, b);
      const x = ch.tToX(pt.T), y = ch.pToY(d.value);
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x, topY); ctx.lineTo(x, ch.mainH); ctx.stroke(); ctx.setLineDash([]);
      if (!d.uncertain && d.hi > d.lo) {
        ctx.strokeStyle = stale ? '#8a92a3' : '#ffd98a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, ch.pToY(d.hi)); ctx.lineTo(x, ch.pToY(d.lo)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 5, ch.pToY(d.hi)); ctx.lineTo(x + 5, ch.pToY(d.hi)); ctx.moveTo(x - 5, ch.pToY(d.lo)); ctx.lineTo(x + 5, ch.pToY(d.lo)); ctx.stroke();
        ctx.lineWidth = 1;
      }
      dot(ctx, x, y, stale ? '#c0c6d2' : '#ffd98a', 4.5);
      const timeTxt = E.fmtT(pt.T, E.dayOfT(pt.T) !== E.dayOfT(b.nowT)).replace(/, (\w{3}) (\d+) (\w{3})$/, ', $1 $2 $3');
      const lines = [`₹${d.value.toFixed(2)} at ${timeTxt}`, d.uncertain ? 'Too uncertain to price' : `₹${d.lo.toFixed(2)} to ₹${d.hi.toFixed(2)}`];
      const right = x + 12 + 190 > ch.plotW;
      const box = pill(ctx, right ? x - 12 : x + 12, y - 10, lines, { align: right ? 'right' : 'left', valign: 'bottom', bg: 'rgba(23,29,39,.97)', border: '#3a4558', fg: stale ? '#9aa2b2' : '#fff' });
      const pnlTxt = `${E.signed(d.pnl)} on ${l.qty}`;
      pill(ctx, right ? x - 12 : x + 12, box.y + box.h + 4, pnlTxt, { align: right ? 'right' : 'left', bg: stale ? '#2a303b' : d.pnl >= 0 ? '#0f3a33' : '#3f1820', fg: stale ? '#9aa2b2' : '#fff', border: stale ? '#3a4558' : d.pnl >= 0 ? '#1fa48e' : '#ec4a5e' });
    }
    drawExitMarkers(ctx, ch, 'opt');
    ctx.globalAlpha = 1;
  });
  opt.on('timeLabel', T => E.fmtT(Math.max(0, Math.round(T / 5) * 5)));

  /* ---------- pointer and keyboard on the index chart ---------- */
  const snapT = (T, b) => { const end = axisEnd(b); return Math.max(b.nowT + 3, Math.min(end, Math.round(T / 3) * 3)); };
  const snapS = S => Math.round(S / 5) * 5;
  function zoneAt(ch, p) {
    if (!payoffOn()) return null;
    const b = book(); const end = axisEnd(b);
    if (end == null || expiredSingle(b) || st.pricing === 'unavailable') return null;
    if (p.x > ch.plotW || p.y > ch.mainH || p.y < ch.o.padTop - 6) return null;
    const T = ch.xToT(p.x);
    if (T <= b.nowT) return { past: true };
    if (T > end + 1.5) return null;
    return { T: snapT(T, b), S: snapS(ch.yToP(p.y)) };
  }
  let pinDrag = false;
  idx.on('hover', (ch, p) => {
    const hit = hits.idx.find(h => p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h);
    if (hit) showCanvasTip(ch, hit); else hideTip('canvas');
    if (pinDrag) { const z = zoneAt(ch, p); if (z && z.T) { st.pin = z; log('payoff_pin_move'); } }
    const z = zoneAt(ch, p);
    st.keyPt = null;
    st.hover = z;
    if (z && z.T && !st.hinted) { st.hinted = true; LS.set('hinted', true); }
    if (z && z.T) sampleHover(z);
    if (st.pin) {
      const px = ch.tToX(st.pin.T), py = ch.pToY(st.pin.S);
      ch.cv.style.cursor = Math.hypot(p.x - px, p.y - py) < 10 ? 'grab' : (z && z.T && st.later ? 'pointer' : '');
    } else ch.cv.style.cursor = z && z.T && st.later ? 'crosshair' : '';
    updateReadout(p);
    opt.invalidate();
    renderTable();
  });
  idx.on('leave', () => { st.hover = null; hideTip('canvas'); updateReadout(null); opt.invalidate(); renderTable(); });
  idx.on('down', (ch, p) => {
    if (st.pin) {
      const px = ch.tToX(st.pin.T), py = ch.pToY(st.pin.S);
      if (Math.hypot(p.x - px, p.y - py) < 10) { pinDrag = true; return false; }
    }
  });
  window.addEventListener('mouseup', () => { if (pinDrag) { pinDrag = false; renderD1(); } });
  idx.on('click', (ch, p) => {
    if (!st.later) return;
    const z = zoneAt(ch, p);
    if (!z || !z.T) return;
    placePin(z);
  });
  idx.on('viewchange', (ch, dragging) => {
    if (!payoffOn()) return;
    opt.setView(ch.view.t0, ch.view.t1);
    if (!dragging) cache = null;
    renderD1();
  });
  opt.on('viewchange', ch => { if (payoffOn() && !isS3()) idx.setView(ch.view.t0, ch.view.t1); });
  opt.on('hover', (ch, p) => {
    const hit = hits.opt.find(h => p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h);
    if (hit) showCanvasTip(ch, hit); else hideTip('canvas');
  });
  opt.on('leave', () => hideTip('canvas'));

  let sampleT = 0;
  function sampleHover(z) {
    const now = performance.now();
    if (now - sampleT < 2500) return;
    sampleT = now;
    const b = book();
    log('payoff_hover', `sampled tte=${((P.axisEnd(b) - z.T) / E.SESSION).toFixed(1)}d dist=${Math.round(z.S - b.S0)}`);
  }
  function placePin(z) {
    const first = !st.pin;
    st.pin = { T: z.T, S: z.S };
    log(first ? 'payoff_pin_place' : 'payoff_pin_move');
    renderUI();
    idx.invalidate(); opt.invalidate();
    if (first) setTimeout(() => { const f = $('.d1 button'); if (f) f.focus(); }, 30);
  }
  function removePin(returnFocus = true) {
    if (!st.pin) return;
    st.pin = null;
    log('payoff_pin_close');
    setPayoff(() => {}, 'pin');
    if (returnFocus) $('#idxCanvas').focus();
  }

  function moveKeyPoint(dx, dy) {
    const b = book(); const end = axisEnd(b);
    if (end == null || expiredSingle(b)) return;
    // With a pin placed, the arrow keys move the pin (D1); otherwise they move the focused point.
    const base = st.pin || st.keyPt || { T: b.nowT, S: snapS(b.S0) };
    let T = base.T + dx * 3, S = base.S + dy;
    if (!st.pin && !st.keyPt) { T = b.nowT + 3; S = snapS(b.S0); }
    T = Math.max(b.nowT + 3, Math.min(end, T));
    const pt = { T, S };
    if (st.pin) { st.pin = pt; log('payoff_pin_move'); renderD1(); renderTable(); }
    else { st.keyPt = pt; st.hover = pt; }
    keepPointInView(pt);
    updateReadout(null);
    idx.invalidate(); opt.invalidate(); renderTable();
  }
  function keepPointInView(pt) {
    const v = idx.view, span = v.t1 - v.t0;
    if (pt.T > v.t1 - span * 0.04 || pt.T < v.t0) { const [a, c] = idx.clampView(pt.T - span * 0.7, pt.T + span * 0.3); idx.setView(a, c); opt.setView(a, c); }
  }

  /* ---------- hold-to-peek and other keys ---------- */
  let altDown = false;
  const typing = t => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  window.addEventListener('keydown', e => {
    if (e.key === 'Alt') {
      e.preventDefault(); // stops Windows from moving focus to the browser menu
      if (e.repeat || typing(e.target) || e.metaKey || e.ctrlKey || e.shiftKey) return;
      altDown = true;
      if (!payoffAvailable()) return;
      if (!st.peek) setPayoff(() => { st.peek = true; }, 'key');
      return;
    }
    if (e.altKey && (e.metaKey || e.ctrlKey) && e.code === 'Digit1') { e.preventDefault(); cancelPeek(); toggleTap(); return; }
    const arrows = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] };
    if (altDown && e.altKey) {
      if (arrows[e.key] && st.peek) { e.preventDefault(); const [dx, dy] = arrows[e.key]; moveKeyPoint(dx, dy * (e.shiftKey ? 5 : 1)); return; }
      if (e.key === 'Enter' && st.peek && st.later && st.keyPt) { e.preventDefault(); placePin(st.keyPt); return; }
      if (e.key !== 'Shift') { cancelPeek(); }
      return;
    }
    if (e.key === 'Escape') { onEsc(e); return; }
    if (typing(e.target)) return;
    if (payoffOn() && document.activeElement === $('#idxCanvas')) {
      if (arrows[e.key]) { e.preventDefault(); const [dx, dy] = arrows[e.key]; moveKeyPoint(dx, dy * (e.shiftKey ? 5 : 1)); return; }
      if (e.key === 'Enter' && st.later) { e.preventDefault(); const pt = st.keyPt || { T: book().nowT + 3, S: snapS(S0()) }; placePin(pt); return; }
    }
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'Alt') { e.preventDefault(); altDown = false; if (st.peek) setPayoff(() => { st.peek = false; }, 'key'); }
  });
  window.addEventListener('blur', () => { altDown = false; if (st.peek) setPayoff(() => { st.peek = false; }, 'key'); });
  function cancelPeek() { if (st.peek) setPayoff(() => { st.peek = false; }, 'key'); }
  function onEsc(e) {
    if (st.m1) { if (st.m1.submitting) return; e.preventDefault(); closeM1(); return; }
    if (st.popover) { closePopover(); return; }
    if (st.pin) { e.preventDefault(); removePin(); return; }
    if (coachOpen()) { dismissCoach(); return; }
    if (st.sticky) { setPayoff(() => { st.sticky = false; }, 'esc'); }
  }
  const payoffAvailable = () => true; // the charted index (NIFTY50) has listed options

  /* ---------- toolbar, buttons ---------- */
  $('#payoffBtn').addEventListener('click', () => {
    dismissCoach(true);
    setPayoff(() => { st.sticky = !st.sticky; if (!st.sticky) st.pin = null; }, 'button');
  });
  function toggleTap() { st.oneTap = !st.oneTap; renderUI(); toast('ok', st.oneTap ? '1-Tap is on. Orders go out instantly.' : '1-Tap is off.'); }
  $('#tapBtn').addEventListener('click', toggleTap);
  $('#qMinus').addEventListener('click', () => { st.lots = Math.max(1, st.lots - 1); cache = null; renderUI(); idx.invalidate(); opt.invalidate(); });
  $('#qPlus').addEventListener('click', () => { st.lots = Math.min(20, st.lots + 1); cache = null; renderUI(); idx.invalidate(); opt.invalidate(); });
  $('#buyBtn').addEventListener('click', () => trade(1));
  $('#sellBtn').addEventListener('click', () => trade(-1));
  $('#cpSwitch').addEventListener('click', () => {
    if (!st.opt || st.opt.type === 'FUT') return;
    st.opt = C(st.opt.type === 'CE' ? 'PE' : 'CE', st.opt.strike, st.opt.expKey);
    cache = null; rebuildData(); if (payoffOn()) { idx.limitT = opt.limitT = axisEnd(book()); }
  });
  $('#railPositions').addEventListener('click', () => openPopover('positions'));
  $('#navPositions').addEventListener('click', () => openPopover('positions'));
  $('#pnlPill').addEventListener('click', () => openPopover('positions'));
  $('#railChain').addEventListener('click', () => openPopover('chain'));

  function trade(side) {
    const c = st.opt;
    if (!c) { toast('err', 'Pick a contract from the option chain first.'); return; }
    const qty = st.lots * E.LOT, px = ltp(c);
    const wasS3 = isS3(), wasOn = payoffOn();
    const ex = st.legs.find(l => l.c === c && l.product === 'INTRADAY') || st.legs.find(l => l.c === c);
    if (ex && ex.side !== side) {
      const q = Math.min(ex.qty, qty);
      st.realised += ex.side * q * (px - ex.avg);
      ex.qty -= q;
      if (ex.qty === 0) st.legs = st.legs.filter(l => l !== ex);
      if (qty > q) st.legs.push(leg(c, side, px, 'INTRADAY', qty - q));
    } else if (ex && ex.side === side && ex.product === 'INTRADAY') {
      ex.avg = (ex.avg * ex.qty + px * qty) / (ex.qty + qty); ex.qty += qty;
    } else st.legs.push(leg(c, side, px, 'INTRADAY', qty));
    toast('ok', `${side > 0 ? 'Bought' : 'Sold'} ${qty} ${c.label} at ₹${px.toFixed(2)}`);
    cache = null;
    afterPositionsChange(wasS3, wasOn);
  }
  function afterPositionsChange(wasS3, wasOn) {
    if (st.pin && isS3() !== wasS3) st.pin = null;
    if (wasOn && payoffOn()) { const b = book(); idx.limitT = opt.limitT = axisEnd(b); const h = currentHorizon(b); if (h && isS3() !== wasS3) fitTo(h.T); }
    if (st.m1) renderM1();
    rebuildData();
  }
  function exitLeg(id) {
    const wasS3 = isS3(), wasOn = payoffOn();
    const l = st.legs.find(x => x.id === id);
    if (l) { st.realised += l.side * l.qty * (ltp(l.c) - l.avg); st.legs = st.legs.filter(x => x !== l); toast('ok', `Exited ${l.c.label}`); }
    const o = st.others.find(x => x.id === id);
    if (o) { st.realised += o.side * o.qty * (o.ltp - o.avg); st.others = st.others.filter(x => x !== o); toast('ok', `Exited ${o.label}`); }
    st.exits = st.exits.filter(x => x.legIds.some(i => st.legs.find(l2 => l2.id === i)));
    cache = null;
    afterPositionsChange(wasS3, wasOn);
    if (st.popover === 'positions') renderPopover();
  }

  /* ---------- readout ---------- */
  function readoutModel(pt) {
    const b = book();
    const s3 = isS3();
    const T = pt.T, S = pt.S;
    const out = { head: `Nifty ${E.level(S)} · ${E.fmtT(T)}` };
    const total = P.pnl(b, S, T);
    out.pnl = total; out.label = s3 ? 'Total P&L' : 'P&L';
    if (!s3 && b.legs.length === 1) {
      const d = P.legDetail(b.legs[0], S, T, b);
      if (d.uncertain) out.unc = `Too uncertain to price. Time value left: ₹${d.timeValue.toFixed(2)}. Worth at expiry at this level: ₹${d.intrinsic.toFixed(2)}`;
      else out.range = d.pnlLo === d.pnlHi ? null : `Range ${E.signed(d.pnlLo)} to ${E.signed(d.pnlHi)}`;
    } else {
      const [lo, hi] = P.range(b, S, T);
      out.range = Math.abs(hi - lo) < 1 ? null : `Range ${E.signed(lo)} to ${E.signed(hi)}`;
    }
    out.flat = `If Nifty stays at ${E.level(b.S0)}: ${E.signed(P.pnl(b, b.S0, T))}`;
    return out;
  }
  let liveTimer = null;
  function updateReadout(p) {
    const wrap = $('#idxWrap');
    let ro = $('#readout');
    const z = st.hover;
    if (!payoffOn() || !z) { if (ro) ro.remove(); return; }
    if (!ro) { ro = document.createElement('div'); ro.id = 'readout'; ro.className = 'readout'; wrap.appendChild(ro); }
    const b = book();
    const stale = st.pricing === 'delayed';
    ro.classList.toggle('stale', stale);
    let html;
    if (z.past) {
      const n = P.pnl(b, b.S0, b.nowT);
      html = `<div class="h">Now · ${esc(E.fmtT(b.nowT))}</div><div class="p num ${n >= 0 ? 'up' : 'down'}"><small>Now:</small>P&amp;L ${E.signed(n)}</div><div class="ft">Model estimate, not a forecast</div>`;
    } else {
      const m = readoutModel(z);
      html = `<div class="h num">${esc(m.head)}</div><div class="p num ${m.pnl >= 0 ? 'up' : 'down'}"><small>${m.label}</small>${E.signed(m.pnl)}</div>` +
        (m.unc ? `<div class="u">${esc(m.unc)}</div>` : m.range ? `<div class="r num">${esc(m.range)}</div>` : '') +
        `<div class="f num">${esc(m.flat)}</div><div class="ft">Model estimate, not a forecast</div>`;
      clearTimeout(liveTimer);
      liveTimer = setTimeout(() => { $('#live').textContent = `${m.head}. ${m.label} ${E.signed(m.pnl)}. ${m.unc || m.range || ''}. ${m.flat}.`; }, 700);
    }
    ro.innerHTML = html;
    const ch = idx;
    const x = p ? p.x : ch.tToX(z.T), y = p ? p.y : ch.pToY(z.S);
    const w = ro.offsetWidth, h = ro.offsetHeight;
    let lx = x + 18, ly = y + 18;
    if (lx + w > ch.plotW - 4) lx = x - 18 - w;
    if (ly + h > ch.mainH - 4) ly = y - 18 - h;
    ro.style.left = Math.max(4, lx) + 'px'; ro.style.top = Math.max(ch.o.padTop, ly) + 'px';
  }

  /* ---------- UI render ---------- */
  function renderUI() {
    const b = book();
    const on = payoffOn();
    const T = nowT(), S = S0();
    const chg = S - E.PREV_CLOSE;
    const chgTxt = `${chg >= 0 ? '+' : '−'}${Math.abs(chg).toFixed(2)} (${(Math.abs(chg) / E.PREV_CLOSE * 100).toFixed(2)}%)`;
    ['#topIdx', '#idxLtp'].forEach(s => { $(s).textContent = S.toFixed(2); });
    ['#topChg', '#idxChg'].forEach(s => { $(s).textContent = chgTxt; $(s).className = (s === '#topChg' ? 'chg ' : 'sub ') + 'num ' + (chg >= 0 ? 'up' : 'down'); });
    // option header
    const c = shownOpt();
    if (c) {
      const lp = ltp(c), pc = optPrevClose(c), oc = lp - pc;
      $('#optTitle').textContent = c.type === 'FUT' ? c.label : `NIFTY ${c.exp.info.short} ${c.strike}`;
      $('#optType').textContent = c.type === 'FUT' ? '' : c.type === 'CE' ? 'Call' : 'Put';
      $('#optLtp').textContent = lp.toFixed(2);
      $('#optChg').textContent = `${oc >= 0 ? '+' : '−'}${Math.abs(oc).toFixed(2)} (${(Math.abs(oc) / pc * 100).toFixed(2)}%)`;
      $('#optChg').className = 'sub num ' + (oc >= 0 ? 'up' : 'down');
    } else { $('#optTitle').textContent = 'No contract loaded'; $('#optType').textContent = ''; $('#optLtp').textContent = ''; $('#optChg').textContent = ''; }
    $('#qVal').textContent = st.lots * E.LOT; $('#qLots').textContent = `${st.lots} Lot${st.lots > 1 ? 's' : ''}`;
    // P&L pill
    const open = st.legs.reduce((a, l) => a + l.side * l.qty * (ltp(l.c) - l.avg), 0) + st.others.reduce((a, o) => a + o.side * o.qty * (o.ltp - o.avg), 0);
    const tot = open + st.realised;
    $('#pnlTop').textContent = (tot > 0 ? '+' : tot < 0 ? '−' : '') + '₹' + E.inr(Math.abs(tot), 2).s;
    $('#pnlTop').className = 'num ' + (tot > 0 ? 'up' : tot < 0 ? 'down' : '');
    $('#tapBtn').setAttribute('aria-pressed', st.oneTap); $('#tapLbl').textContent = st.oneTap ? '1-Tap ON' : '1-Tap OFF';
    // payoff button
    const btn = $('#payoffBtn');
    btn.setAttribute('aria-pressed', st.sticky || !!st.pin);
    btn.classList.toggle('peek', st.peek && !st.sticky);
    $('#payoffKey').textContent = keyName();
    $('#emLegend').style.display = on ? 'none' : '';
    // chart padding for the payoff strip and banner
    const bannerH = on && bannerKind() ? 40 : 0;
    $('#idxWrap').style.setProperty('--bh', bannerH + 'px');
    renderStrip(b);
    const strip = $('#pstrip');
    idx.o.padTop = on ? (strip ? strip.offsetHeight : 40) + 12 + bannerH : 8;
    opt.o.padTop = on && !isS3() ? 12 + bannerH : 8;
    renderBanner(); renderTable(); renderMsgs(b); renderD1();
    $('#oiLabel').style.display = on && isS3() ? 'none' : '';
    idx.invalidate(); opt.invalidate();
    if (st.hover) updateReadout(null);
  }
  function summary(b) {
    if (isS3()) {
      const nExp = new Set(b.legs.map(l => l.c.expKey)).size;
      return `${b.legs.length} positions · ${nExp} ${nExp === 1 ? 'expiry' : 'expiries'}`;
    }
    const l = b.legs[0];
    if (!l) return '';
    if (b.pretrade) return `Not holding · priced as a buy of ${l.qty} at ₹${l.avg.toFixed(2)} (last price)`;
    if (expiredSingle(b)) { const v = E.intrinsic(l.c, b.S0); return `Expired · settled at ₹${v.toFixed(2)} · P&L ${E.signed(l.side * l.qty * (v - l.avg))}`; }
    return `${l.side > 0 ? 'Buy' : 'Sell'} ${l.qty} ${l.c.label} at ₹${l.avg.toFixed(2)}<span class="muted"> · ${l.product === 'INTRADAY' ? 'Intraday' : 'Carry forward'}</span>`;
  }
  function renderStrip(b) {
    let el = $('#pstrip');
    if (!payoffOn() || (!b.legs.length)) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'pstrip'; el.className = 'pstrip'; $('#idxWrap').appendChild(el); }
    el.style.top = 'var(--bh, 0px)';
    const hs = expiredSingle(b) ? [] : horizons(b);
    const cur = currentHorizon(b);
    const others = otherCount();
    const changed = setHTML(el, `<span class="sum">${summary(b)}</span>` +
      (hs.length ? `<div class="chips" role="group" aria-label="Fit the view to">${hs.map(h => `<button type="button" data-h="${h.key}" aria-pressed="${cur && cur.key === h.key}">${esc(h.label)}</button>`).join('')}</div>` : '') +
      `<button type="button" class="tog" id="coneTog" aria-pressed="${st.cone}"><span class="sw"></span>Expected move</button>` +
      (others ? `<span class="ochip" data-tip="others">${others} ${others === 1 ? 'position' : 'positions'} on other charts</span>` : '') +
      `<span class="mlabel">Model estimate, not a forecast <button type="button" data-tip="model" aria-label="About these values"><svg class="i"><use href="#i-info"/></svg></button></span>` +
      `<span class="mode">${st.sticky || st.pin ? 'Payoff on · Esc to close' : `Holding ${esc(keyName())} · release to hide`}</span>`);
    if (!changed) return;
    el.querySelectorAll('[data-h]').forEach(bt => bt.addEventListener('click', () => {
      st.horizon = bt.dataset.h;
      const h = horizons(book()).find(x => x.key === st.horizon);
      if (h) fitTo(h.T);
      cache = null; log('payoff_horizon_change', `to=${h ? h.label : ''}`); renderUI();
    }));
    $('#coneTog').addEventListener('click', () => { st.cone = !st.cone; log('payoff_cone_toggle', `on=${st.cone}`); renderUI(); });
    bindTips(el);
  }
  function bannerKind() {
    if (st.pricing === 'delayed') return 'stale';
    if (st.pricing === 'unavailable') return 'err';
    if (closed()) return 'closed';
    return null;
  }
  function renderBanner() {
    let el = $('#n2');
    const k = payoffOn() ? bannerKind() : null;
    if (!k || st.closedBannerHidden && k === 'closed') { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'n2'; el.setAttribute('role', 'status'); $('#work').appendChild(el); }
    el.className = 'n2' + (k === 'err' ? ' err' : k === 'closed' ? ' closed' : '');
    el.style.top = '84px';
    const asOf = E.clock(st.clock >= E.CLOSE ? E.CLOSE : st.clock).replace(/ (am|pm)/, '') ;
    const stamp = (() => { const m = st.clock - 1; const h = Math.floor(m / 60), mi = m % 60; return `${((h + 11) % 12) + 1}:${String(mi).padStart(2, '0')}:15`; })();
    const html = k === 'stale' ? `<svg class="i"><use href="#i-clock"/></svg><span>Prices are delayed. Payoff values as of ${stamp}.</span>`
      : k === 'closed' ? `<svg class="i"><use href="#i-clock"/></svg><span>Market closed. Values use the last close; future times start at 9:15 am on ${E.DAYS[E.TODAY + 1].label}.</span><span class="act"><button class="x" id="n2x" aria-label="Close"><svg class="i"><use href="#i-x"/></svg></button></span>`
      : `<svg class="i"><use href="#i-alert"/></svg><span>Payoff can’t load option prices right now.</span><span class="act"><button id="n2retry">Retry</button></span>`;
    void asOf;
    if (!setHTML(el, html)) return;
    const x = $('#n2x'); if (x) x.addEventListener('click', () => { st.closedBannerHidden = true; renderUI(); });
    const r = $('#n2retry'); if (r) r.addEventListener('click', () => { r.textContent = 'Retrying…'; r.disabled = true; setTimeout(() => { st.pricing = 'live'; cache = null; log('payoff_retry'); renderUI(); }, 700); });
  }
  function renderMsgs(b) {
    const wrap = $('#idxWrap');
    let m = $('#cmsg');
    const on = payoffOn();
    const empty = on && !b.legs.length;
    if (empty) {
      if (!m) { m = document.createElement('div'); m.id = 'cmsg'; m.className = 'cmsg'; wrap.appendChild(m); }
      m.innerHTML = '<div>Pick a contract on the option chart to see its payoff</div>';
    } else if (m) m.remove();
    let ld = $('#loading');
    if (on && performance.now() < st.loadingUntil && b.legs.length) {
      if (!ld) { ld = document.createElement('div'); ld.id = 'loading'; ld.className = 'loading'; wrap.appendChild(ld); }
      ld.style.top = (idx.o.padTop + 6) + 'px';
      ld.textContent = isS3() ? 'Pricing your positions…' : 'Pricing your position…';
    } else if (ld) ld.remove();
    let hn = $('#hint');
    if (on && !st.hinted && b.legs.length && !expiredSingle(b) && st.pricing !== 'unavailable') {
      if (!hn) { hn = document.createElement('div'); hn.id = 'hint'; hn.className = 'hint'; wrap.appendChild(hn); }
      hn.textContent = 'Move your pointer into the shaded area to see P&L at any level and time';
      const x0 = idx.tToX(b.nowT);
      hn.style.left = Math.max(12, Math.min(idx.plotW - 270, x0 + (idx.plotW - x0) * 0.25)) + 'px';
      hn.style.top = (idx.mainH * 0.72) + 'px';
    } else if (hn) hn.remove();
    // option panel when nothing is loaded
    let om = $('#optEmpty');
    if (!shownOpt()) {
      if (!om) { om = document.createElement('div'); om.id = 'optEmpty'; om.className = 'cmsg'; om.style.pointerEvents = 'auto'; $('#optWrap').appendChild(om); }
      om.innerHTML = '<div>No contract loaded.<br><button class="btn sec" id="openChain" style="margin-top:10px">Open option chain</button></div>';
      $('#openChain').addEventListener('click', () => openPopover('chain'));
    } else if (om) om.remove();
  }

  /* ---------- S3 table ---------- */
  function renderTable() {
    const wrap = $('#optWrap');
    let el = $('#ptable');
    if (!payoffOn() || !isS3()) { if (el) el.remove(); return; }
    const b = book();
    if (!el) { el = document.createElement('div'); el.id = 'ptable'; el.className = 'ptable'; wrap.appendChild(el); }
    el.classList.toggle('stale', st.pricing === 'delayed');
    el.style.top = (bannerKind() ? 40 : 0) + 'px';
    const unavailable = st.pricing === 'unavailable';
    const pt = st.pin || (st.hover && st.hover.T ? st.hover : null);
    const T = pt ? pt.T : b.nowT, S = pt ? pt.S : b.S0;
    const title = pt ? `Payoff at Nifty ${E.level(S)} · ${E.fmtT(T)}${st.pin ? ' · Pinned' : ''}` : 'Payoff now';
    const narrow = wrap.clientWidth < 600, vnarrow = wrap.clientWidth < 520;
    const groups = {};
    b.legs.forEach(l => { (groups[l.c.expKey] = groups[l.c.expKey] || { e: l.c.exp, legs: [] }).legs.push(l); });
    const order = Object.values(groups).sort((x, y) => x.e.T - y.e.T);
    order.forEach(g => g.legs.sort((x, y) => (x.c.strike || 0) - (y.c.strike || 0)));
    const stCls = s => ({ 'Live': 'live', 'Expires today': 'today', 'Expired': 'exp', 'Settled': 'set', 'Squared off': 'sq' }[s]);
    let rows = '';
    order.forEach(g => {
      rows += `<tr class="g"><td colspan="7">${g.e.info.short} · ${g.e.kind}${g.e.movedFrom ? ` (moved from ${g.e.movedFrom.short})` : ''} · ${g.legs.length} ${g.legs.length === 1 ? 'leg' : 'legs'}</td></tr>`;
      g.legs.forEach(l => {
        const d = P.legDetail(l, S, T, b);
        const fut = l.c.type === 'FUT';
        const sideTxt = fut ? (l.side > 0 ? 'Buy fut' : 'Sell fut') : (l.side > 0 ? 'Buy' : 'Sell');
        const rng = unavailable ? '' : d.uncertain ? '<span class="unc">Too uncertain to price</span>' : (fut || d.pnlLo === d.pnlHi) ? '' : `<span class="rg">range ${E.signed(d.pnlLo)} to ${E.signed(d.pnlHi)}</span>`;
        rows += `<tr class="leg" data-leg="${l.id}"><td>${vnarrow ? `<span class="${l.side > 0 ? 'side-b' : 'side-s'}">${l.side > 0 ? 'B' : 'S'}</span> ` : ''}${esc(l.c.label)}${l.product === 'INTRADAY' ? ' <span class="st" style="margin-left:4px">Intraday</span>' : ''}</td>` +
          (vnarrow ? '' : `<td class="${l.side > 0 ? 'side-b' : 'side-s'}">${sideTxt}</td>`) +
          `<td class="n">${l.qty}</td>` + (narrow ? '' : `<td class="n">${l.avg.toFixed(2)}</td>`) +
          `<td class="n">${unavailable ? '—' : '₹' + d.value.toFixed(2)}</td>` +
          `<td class="n"><span class="${d.pnl >= 0 ? 'up' : 'down'}">${unavailable ? '—' : E.signed(d.pnl)}</span>${rng}</td>` +
          `<td><span class="st ${stCls(d.status)}">${d.status}</span></td></tr>`;
      });
    });
    const total = P.pnl(b, S, T), [lo, hi] = P.range(b, S, T);
    const flat = P.pnl(b, b.S0, T);
    const mx = P.maxAtExpiry(b);
    const changed = setHTML(el, `<div class="tt"><h3 id="ptTitle">${esc(title)}</h3><span>Hover the index chart to move the point</span></div>` +
      `<div class="scroll"><table aria-labelledby="ptTitle"><thead><tr><th scope="col">Contract</th>${vnarrow ? '' : '<th scope="col">Side</th>'}<th scope="col" class="n">Qty</th>${narrow ? '' : '<th scope="col" class="n">Avg</th>'}<th scope="col" class="n">Value at point</th><th scope="col" class="n">P&amp;L at point</th><th scope="col">Status</th></tr></thead><tbody>${rows}</tbody></table></div>` +
      `<div class="foot">` +
      (st.realised ? `<div><span class="lbl">Realised today</span><span class="${st.realised >= 0 ? 'up' : 'down'}">${E.signed(st.realised)}</span></div>` : '') +
      `<div><span class="lbl" style="align-self:center">Total open P&amp;L</span><span class="tot ${total >= 0 ? 'up' : 'down'}">${unavailable ? '—' : E.signed(total)}<small>${unavailable ? '' : `Range ${E.signed(lo)} to ${E.signed(hi)}`}</small></span></div>` +
      `<div><span class="lbl">If Nifty stays at ${E.level(b.S0)}</span><span class="${flat >= 0 ? 'up' : 'down'}">${unavailable ? '—' : E.signed(flat)}</span></div>` +
      (mx ? `<div><span class="lbl">At expiry</span><span>Max profit <b class="up">${E.signed(mx.maxProfit)}</b> · Max loss <b class="down">${E.signed(mx.maxLoss)}</b></span></div>` : '') +
      `<div class="model"><svg class="i" style="width:13px;height:13px"><use href="#i-info"/></svg>Model estimate, not a forecast</div></div>`);
    if (!changed) return;
    el.querySelectorAll('tr.leg').forEach(tr => {
      tr.addEventListener('mouseenter', () => { st.rowHover = b.legs.find(l => String(l.id) === tr.dataset.leg); idx.invalidate(); log('payoff_row_hover'); });
      tr.addEventListener('mouseleave', () => { st.rowHover = null; idx.invalidate(); });
    });
  }

  /* ---------- D1 pinned point card (Later release) ---------- */
  function sameDay(T) { return E.dayOfT(T) === E.dayOfT(nowT()) || (closed() && E.dayOfT(T) === E.TODAY + 1); }
  const timeFor = T => sameDay(T) && !closed() ? E.fmtT(T, false) : E.fmtT(T);
  function pinActions(b) {
    const out = { buttons: [], note: '', helper: '', premium: null };
    if (b.pretrade) return out;
    const T = st.pin.T, S = st.pin.S;
    if (isS3()) { out.buttons.push({ kind: 'exitAll', label: `Exit all at ${timeFor(T)}`, pri: true }); out.note = 'An exit at a time closes at the market price then, wherever Nifty is.'; return out; }
    const l = b.legs[0];
    const d = P.legDetail(l, S, T, b);
    out.premium = d;
    const prem = E.roundTick(d.value), cur = ltp(l.c);
    const diff = prem - cur;
    const atSq = l.product === 'INTRADAY' && T >= P.SQ_T;
    if (Math.abs(diff) > E.TICK + 1e-9 && l.c.type !== 'FUT') {
      const target = l.side > 0 ? diff > 0 : diff < 0;
      out.buttons.push({ kind: target ? 'target' : 'stop', label: `Set ${target ? 'target' : 'stop'} at ₹${prem.toFixed(2)}`, price: prem, pri: true });
      const o = st.orders[l.id] || {};
      const ex = target ? o.tp : o.sl;
      if (ex) out.replace = `Replaces your ${target ? 'target' : 'stop'} at ₹${ex.toFixed(2)}`;
      out.note = 'Targets and stops trigger on the option’s price, not on Nifty. Time decay moves the Nifty level where they trigger.';
    }
    if (!atSq) out.buttons.push({ kind: 'exit', label: `Exit at ${timeFor(T)}`, pri: !out.buttons.length });
    else out.helper = 'Auto square-off closes this position at 3:20 pm';
    if (!out.note) out.note = 'An exit at a time closes at the market price then, wherever Nifty is.';
    return out;
  }
  function renderD1() {
    let el = $('#d1');
    if (!st.pin || !payoffOn()) { if (el) el.remove(); return; }
    const b = book();
    if (st.pin.T <= b.nowT) { st.pin = null; if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'd1'; el.className = 'd1'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Pinned point'); $('#idxWrap').appendChild(el); }
    const T = st.pin.T, S = st.pin.S;
    const s3 = isS3();
    const total = P.pnl(b, S, T), [lo, hi] = P.range(b, S, T);
    const acts = pinActions(b);
    const live = st.pricing === 'live';
    const disabledWhy = !live ? 'Prices aren’t live' : closed() ? 'Outside market hours' : '';
    const d = acts.premium;
    const vals = [];
    if (!s3 && d) vals.push(`<div class="m">Premium ₹${d.value.toFixed(2)}${d.uncertain ? '' : ` (₹${d.lo.toFixed(2)} to ₹${d.hi.toFixed(2)})`}</div>`);
    else if (!s3 && b.pretrade) { const dd = P.legDetail(b.legs[0], S, T, b); vals.push(`<div class="m">Premium ₹${dd.value.toFixed(2)} (₹${dd.lo.toFixed(2)} to ₹${dd.hi.toFixed(2)})</div>`); }
    vals.push(`<div class="big num ${total >= 0 ? 'up' : 'down'}">${s3 ? 'Total P&amp;L' : 'P&amp;L'} ${E.signed(total)}</div>`);
    if (d && d.uncertain) vals.push(`<div class="m" style="color:var(--warn-ink)">Too uncertain to price. Time value left: ₹${d.timeValue.toFixed(2)}. Worth at expiry at this level: ₹${d.intrinsic.toFixed(2)}</div>`);
    else vals.push(`<div class="m">Range ${E.signed(lo)} to ${E.signed(hi)}</div>`);
    vals.push(`<div class="m">If Nifty stays at ${E.level(b.S0)}: ${E.signed(P.pnl(b, b.S0, T))}</div>`);
    const changed = setHTML(el, `<div class="hd"><h4><small>Pinned</small>Nifty ${E.level(S)} at ${esc(E.fmtT(T))}</h4><button class="ib" id="d1x" aria-label="Remove pin"><svg class="i"><use href="#i-x"/></svg></button></div>` +
      `<div class="vals">${vals.join('')}</div>` +
      (b.pretrade ? `<div class="note">Actions appear for positions you hold</div>` : `<div class="note">${esc(acts.note)}</div>`) +
      (closed() && !b.pretrade ? `<div class="proto-note">PRD open item 9: whether orders can be set outside market hours. Shown disabled here.</div>` : '') +
      `<div class="acts">${acts.buttons.map((bt, i) => `<button class="btn ${bt.pri ? 'pri' : 'sec'} wide" data-act="${i}" ${disabledWhy ? `disabled data-why="${esc(disabledWhy)}"` : ''}>${esc(bt.label)}</button>${bt.kind !== 'exit' && bt.kind !== 'exitAll' && acts.replace ? `<div class="helper">${esc(acts.replace)}</div>` : ''}`).join('')}${acts.helper ? `<div class="helper">${esc(acts.helper)}</div>` : ''}</div>` +
      `<div class="ml"><svg class="i"><use href="#i-info"/></svg>Model estimate, not a forecast</div>`);
    // position the card beside the pin, flipping near the edges
    const ch = idx, px = ch.tToX(T), py = ch.pToY(S);
    const w = el.offsetWidth, h = el.offsetHeight;
    let x = px + 18, y = py - 30;
    if (x + w > ch.plotW - 6) x = px - 18 - w;
    if (y + h > ch.mainH - 6) y = ch.mainH - 6 - h;
    el.style.left = Math.max(6, x) + 'px'; el.style.top = Math.max(ch.o.padTop, y) + 'px';
    if (!changed) return;
    $('#d1x').addEventListener('click', () => removePin());
    el.querySelectorAll('[data-act]').forEach(bt => {
      bt.addEventListener('click', () => { const a = acts.buttons[+bt.dataset.act]; log('payoff_pin_action_click', `action=${a.kind}`); openM1(a); });
      if (bt.dataset.why) { bt.parentElement.addEventListener('mouseenter', ev => { if (ev.target === bt) showTipFor(bt, bt.dataset.why); }); }
    });
    // disabled buttons don't fire mouse events, so show the reason on the wrapper
    const acts2 = el.querySelector('.acts');
    acts2.onmousemove = ev => { const bt = [...acts2.querySelectorAll('button[disabled]')].find(x2 => { const r = x2.getBoundingClientRect(); return ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom; }); if (bt) showTipFor(bt, bt.dataset.why); else hideTip('btn'); };
    acts2.onmouseleave = () => hideTip('btn');
  }

  /* ---------- M1 confirm order from pin ---------- */
  function openM1(a) {
    st.m1 = { a, pin: Object.assign({}, st.pin), legIds: book().legs.map(l => l.id), submitting: false };
    log('payoff_order_confirm_open', `mode=${a.kind}`);
    renderM1();
  }
  function closeM1(silent) {
    const s = $('#m1scrim'); if (s) s.remove();
    if (st.m1 && !silent) { log('payoff_order_cancel'); const f = $('.d1 button[data-act]'); if (f) f.focus(); }
    st.m1 = null;
  }
  function renderM1() {
    let s = $('#m1scrim');
    if (!st.m1) { if (s) s.remove(); return; }
    if (!s) { s = document.createElement('div'); s.id = 'm1scrim'; s.className = 'scrim'; document.body.appendChild(s); }
    const { a, pin } = st.m1;
    const b = book();
    const legs = st.m1.legIds.map(id => st.legs.find(l => l.id === id)).filter(Boolean);
    const T = pin.T;
    const title = a.kind === 'target' ? 'Set target' : a.kind === 'stop' ? 'Set stop' : 'Schedule exit';
    let body = '', msg = '', canConfirm = true, hideConfirm = false;
    if (!legs.length) { msg = 'This position is closed, so there’s nothing to set.'; hideConfirm = true; }
    else if (a.kind === 'exitAll') {
      const openThen = legs.filter(l => !(l.c.type !== 'FUT' && l.c.expT <= T) && !(l.product === 'INTRADAY' && T >= P.SQ_T));
      body = `<div class="pos">${openThen.length} ${openThen.length === 1 ? 'leg' : 'legs'} open at ${esc(E.fmtT(T))}</div>` +
        `<div class="order">${openThen.map(l => `<div>${l.side > 0 ? 'Sell' : 'Buy back'} ${l.qty} ${esc(l.c.label)}</div>`).join('')}</div>` +
        `<div class="pl">P&amp;L depends on prices at ${esc(timeFor(T))}. Payoff estimate at Nifty ${E.level(pin.S)}: ${E.signed(P.pnl(b, pin.S, T))} (range ${P.range(b, pin.S, T).map(v => E.signed(v)).join(' to ')})</div>` +
        `<div class="tn">Cancelled for any leg you exit before then. Legs that expire or square off before then are left alone.</div>`;
    } else {
      const l = legs[0];
      const bought = l.side > 0;
      body = `<div class="pos">${esc(l.c.label)} · ${bought ? 'Bought' : 'Sold'} ${l.qty} at ₹${l.avg.toFixed(2)}</div>`;
      if (a.kind === 'target' || a.kind === 'stop') {
        const p = a.price;
        const line = a.kind === 'target'
          ? (bought ? `Sells ${l.qty} at market when the option’s price reaches ₹${p.toFixed(2)}` : `Buys back ${l.qty} at market when the option’s price falls to ₹${p.toFixed(2)}`)
          : (bought ? `Sells ${l.qty} at market if the option’s price falls to ₹${p.toFixed(2)}` : `Buys back ${l.qty} at market if the option’s price rises to ₹${p.toFixed(2)}`);
        const pl = l.side * l.qty * (p - l.avg);
        body += `<div class="order">${esc(line)}</div><div class="pl">P&amp;L if filled at ₹${p.toFixed(2)}: ${E.signed(pl)} before charges</div>` +
          `<div class="tn">Targets and stops trigger on the option’s price, not on Nifty. Time decay moves the Nifty level where they trigger.</div>`;
        const o = st.orders[l.id] || {};
        const ex = a.kind === 'target' ? o.tp : o.sl;
        if (ex) body += `<div class="helper">Replaces your current ${a.kind} at ₹${ex.toFixed(2)}</div>`;
        const cur = ltp(l.c);
        const crossed = a.kind === 'target' ? (bought ? cur >= p : cur <= p) : (bought ? cur <= p : cur >= p);
        if (crossed) { msg = `The option is already at or past ₹${p.toFixed(2)}. Move the pin to pick a new price.`; canConfirm = false; }
      } else {
        const r = P.range(b, pin.S, T);
        body += `<div class="order">${bought ? 'Sells' : 'Buys back'} ${l.qty} at market at ${esc(E.fmtT(T))}, if the position is still open</div>` +
          `<div class="pl">P&amp;L depends on prices at ${esc(timeFor(T))}. Payoff estimate at Nifty ${E.level(pin.S)}: ${E.signed(P.pnl(b, pin.S, T))} (range ${E.signed(r[0])} to ${E.signed(r[1])})</div>` +
          `<div class="tn">Cancelled if you exit before then.</div>`;
      }
      if (T <= nowT()) { msg = `${E.fmtT(T, false)} has passed. Pick a later time.`; canConfirm = false; }
    }
 const sub = st.m1.submitting;
    const first = !s._html;
    const changed = setHTML(s, `<div class="m1" role="dialog" aria-modal="true" aria-labelledby="m1t">` +
      `<div class="mh"><h2 id="m1t">${title}</h2><button class="ib" id="m1x" aria-label="Close" ${sub ? 'disabled' : ''}><svg class="i"><use href="#i-x"/></svg></button></div>` +
      `<div class="mb">${body}${msg ? `<div class="msg">${esc(msg)}</div>` : ''}</div>` +
      `<div class="mf"><button class="btn sec" id="m1c" ${sub ? 'disabled' : ''}>Cancel</button>${hideConfirm ? '' : `<button class="btn pri" id="m1ok" ${canConfirm && !sub ? '' : 'disabled'}>${sub ? '<span class="spin"></span>Placing…' : 'Confirm'}</button>`}</div></div>`);
    if (!changed) return;
    const hadFocus = s.contains(document.activeElement) ? document.activeElement.id : null;
    const cancel = () => { if (hideConfirm) { closeM1(); removePin(); } else closeM1(); };
    $('#m1x').addEventListener('click', cancel);
    $('#m1c').addEventListener('click', cancel);
    s.addEventListener('mousedown', e => { if (e.target === s && !st.m1.submitting) cancel(); });
    const ok = $('#m1ok');
    if (ok) ok.addEventListener('click', confirmM1);
    // initial focus on Cancel so Enter can't place an order by accident (assumption 29)
    if (!sub && (first || !hadFocus)) $('#m1c').focus();
    else if (hadFocus && $('#' + hadFocus) && !$('#' + hadFocus).disabled) $('#' + hadFocus).focus();
    else if (!sub) $('#m1c').focus();
    s.onkeydown = e => { if (e.key === 'Tab') { const f = [...s.querySelectorAll('button:not([disabled])')]; if (!f.length) return; const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); } };
  }
  function confirmM1() {
    if (!st.m1) return;
    st.m1.submitting = true; renderM1();
    log('payoff_order_confirm', `mode=${st.m1.a.kind}`);
    setTimeout(() => {
      if (!st.m1) return;
      const { a, pin } = st.m1;
      if (st.orderFail) {
        st.m1.submitting = false; renderM1();
        const what = a.kind === 'target' ? 'set target' : a.kind === 'stop' ? 'set stop' : 'schedule exit';
        toast('err', `Couldn’t ${what}: Order service timed out. Try again.`, true);
        log('payoff_order_result', 'error=ORDER_TIMEOUT');
        return;
      }
      const legs = st.m1.legIds.map(id => st.legs.find(l => l.id === id)).filter(Boolean);
      let msg = '';
      if (a.kind === 'target' || a.kind === 'stop') {
        const l = legs[0];
        st.orders[l.id] = Object.assign(st.orders[l.id] || {}, { [a.kind === 'target' ? 'tp' : 'sl']: a.price });
        msg = `${a.kind === 'target' ? 'Target' : 'Stop'} set at ₹${a.price.toFixed(2)}`;
      } else {
        const label = `Exit at ${timeFor(pin.T)}`;
        st.exits = st.exits.filter(x => x.T !== pin.T);
        st.exits.push({ T: pin.T, legIds: legs.map(l => l.id), label, tip: `Exits at market at ${timeFor(pin.T)} if still open` });
        msg = `Exit scheduled for ${timeFor(pin.T)}`;
      }
      log('payoff_order_result', 'success');
      closeM1(true);
      st.pin = null;
      toast('ok', msg);
      setPayoff(() => {}, 'pin');
    }, 750);
  }

  /* ---------- toasts ---------- */
  function toast(kind, text, sticky) {
    let host = $('#toasts');
    if (!host) { host = document.createElement('div'); host.id = 'toasts'; host.className = 'toasts'; host.setAttribute('role', 'status'); document.body.appendChild(host); }
    const t = document.createElement('div');
    t.className = 'toast ' + kind;
    t.innerHTML = `<svg class="i"><use href="#i-${kind === 'ok' ? 'check' : 'alert'}"/></svg><span>${esc(text)}</span><button aria-label="Close"><svg class="i" style="width:15px;height:15px"><use href="#i-x"/></svg></button>`;
    t.querySelector('button').addEventListener('click', () => t.remove());
    host.appendChild(t);
    while (host.children.length > 3) host.firstChild.remove();
    if (!sticky) setTimeout(() => t.remove(), 4000);
  }

  /* ---------- popovers: positions, option chain ---------- */
  function openPopover(kind) {
    if (st.popover === kind) { closePopover(); return; }
    st.popover = kind; renderPopover();
  }
  function closePopover() { st.popover = null; const p = $('#pop'); if (p) p.remove(); }
  document.addEventListener('mousedown', e => {
    const p = $('#pop');
    if (p && !p.contains(e.target) && !e.target.closest('#railPositions,#railChain,#navPositions,#pnlPill,#openChain')) closePopover();
  });
  let chainExp = '2026-10-27';
  function renderPopover() {
    let p = $('#pop');
    if (!st.popover) { if (p) p.remove(); return; }
    if (!p) { p = document.createElement('div'); p.id = 'pop'; p.className = 'pop'; document.body.appendChild(p); }
    const rail = $('.rail.r').getBoundingClientRect();
    if (st.popover === 'positions') {
      p.style.width = '560px';
      const rows = st.legs.map(l => { const lp = ltp(l.c), pl = l.side * l.qty * (lp - l.avg); return `<tr><td>${esc(l.c.label)}</td><td>${l.product === 'INTRADAY' ? 'Intraday' : 'Carry forward'}</td><td class="n ${l.side > 0 ? 'up' : 'down'}">${l.side > 0 ? '' : '−'}${l.qty}</td><td class="n">${l.avg.toFixed(2)}</td><td class="n">${lp.toFixed(2)}</td><td class="n ${pl >= 0 ? 'up' : 'down'}">${E.signed(pl, 2)}</td><td><button class="xb" data-exit="${l.id}">Exit</button></td></tr>`; })
        .concat(st.others.map(o => { const pl = o.side * o.qty * (o.ltp - o.avg); return `<tr><td>${esc(o.label)}</td><td>${esc(o.product)}</td><td class="n up">${o.qty}</td><td class="n">${o.avg.toFixed(2)}</td><td class="n">${o.ltp.toFixed(2)}</td><td class="n ${pl >= 0 ? 'up' : 'down'}">${E.signed(pl, 2)}</td><td><button class="xb" data-exit="${o.id}">Exit</button></td></tr>`; }));
      if (!setHTML(p, `<div class="poph"><h3>Positions</h3><button class="ib" id="popx" aria-label="Close"><svg class="i"><use href="#i-x"/></svg></button></div><div class="popb">` +
        (rows.length ? `<table><thead><tr><th>Contract</th><th>Product</th><th class="n">Qty</th><th class="n">Avg</th><th class="n">LTP</th><th class="n">P&amp;L</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table>` : `<div class="empty">No open positions.</div>`) +
        (st.realised ? `<div style="padding:9px 12px;display:flex;justify-content:space-between;font-size:12.5px"><span style="color:var(--text-2)">Realised today</span><span class="${st.realised >= 0 ? 'up' : 'down'}">${E.signed(st.realised, 2)}</span></div>` : '') + `</div>`)) { placePop(p, rail); return; }
      p.querySelectorAll('[data-exit]').forEach(b2 => b2.addEventListener('click', () => { const id = b2.dataset.exit; exitLeg(isNaN(+id) ? id : +id); }));
    } else {
      p.style.width = '400px';
      const exps = ['2026-10-13', '2026-10-19', '2026-10-27', '2026-11-03'];
      const S = S0(), atm = Math.round(S / 100) * 100;
      const strikes = []; for (let k = atm - 500; k <= atm + 500; k += 100) strikes.push(k);
      const rows = strikes.map(k => { const ce = C('CE', k, chainExp), pe = C('PE', k, chainExp); const sel = c => st.opt === c ? ' sel' : ''; return `<tr><td class="n"><button class="cp${sel(ce)}" data-c="${ce.id}">${ltp(ce).toFixed(2)}</button></td><td class="k ${k === atm ? 'atm' : ''}">${k}</td><td><button class="cp pe${sel(pe)}" data-c="${pe.id}">${ltp(pe).toFixed(2)}</button></td></tr>`; }).join('');
      if (!setHTML(p, `<div class="poph"><h3>Option chain · NIFTY</h3><button class="ib" id="popx" aria-label="Close"><svg class="i"><use href="#i-x"/></svg></button></div>` +
        `<div class="chain"><div class="ex">${exps.map(k => `<button data-x="${k}" aria-pressed="${k === chainExp}">${E.expiryByKey(k).info.short}${E.expiryByKey(k).movedFrom ? '*' : ''}</button>`).join('')}</div>` +
        `<div class="popb"><table><thead><tr><th class="n">Call LTP</th><th style="text-align:center">Strike</th><th>Put LTP</th></tr></thead><tbody>${rows}</tbody></table></div>` +
        `<div style="padding:8px 12px;color:var(--text-3);font-size:11px">*19 Oct expiry moved from Tue 20 Oct (Dussehra). Click a price to load it on the option chart.</div></div>`)) { placePop(p, rail); return; }
      p.querySelectorAll('[data-x]').forEach(b2 => b2.addEventListener('click', () => { chainExp = b2.dataset.x; renderPopover(); }));
      p.querySelectorAll('[data-c]').forEach(b2 => b2.addEventListener('click', () => {
        const m = b2.dataset.c.match(/^NIFTY-(\d{4}-\d{2}-\d{2})-(\d*)-(CE|PE)$/);
        st.opt = C(m[3], +m[2], m[1]);
        cache = null; rebuildData();
        if (payoffOn()) { idx.limitT = opt.limitT = axisEnd(book()); const h = currentHorizon(book()); if (h) fitTo(h.T); }
        renderPopover();
      }));
    }
    $('#popx').addEventListener('click', closePopover);
    placePop(p, rail);
  }
  function placePop(p, rail) {
    p.style.top = Math.max(70, rail.top + 10) + 'px';
    p.style.left = (rail.left - p.offsetWidth - 8) + 'px';
  }

  /* ---------- tooltips ---------- */
  let tipEl = null, tipOwner = null;
  function tipText(key) {
    const k = keyName();
    if (key === 'tap') return { text: st.oneTap ? 'Turn off instant trade' : 'Turn on instant trade', caps: st.platform === 'mac' ? ['⌘', '⌥', '1'] : ['Ctrl', 'Alt', '1'] };
    if (key === 'payoff') return st.sticky ? { text: 'Hide payoff', caps: ['Esc'] } : { text: 'Payoff: breakeven and P&L at any level and time. Hold to peek, or click to keep on', caps: [k] };
    if (key === 'model') return { text: 'Worked out from live option prices, IV and time left. The range shows values if IV moves. Actual prices can differ, especially near expiry.', wrap: true };
    if (key === 'others') return { text: st.others.map(o => o.und).join(', ') };
    return null;
  }
  function placeTip(r, t, cls) {
    hideTip();
    tipEl = document.createElement('div');
    tipEl.className = 'tip' + (t.wrap ? ' wrap' : '');
    if (t.wrap) tipEl.style.width = '300px';
    tipEl.innerHTML = `<span>${esc(t.text)}</span>${t.caps ? `<span class="caps">${t.caps.map(c => `<kbd>${esc(c)}</kbd>`).join('')}</span>` : ''}`;
    document.body.appendChild(tipEl);
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    let x = r.left + r.width / 2 - w / 2, y = r.bottom + 10;
    x = Math.max(8, Math.min(innerWidth - w - 8, x));
    if (y + h > innerHeight - 8) { y = r.top - h - 10; tipEl.classList.add('above'); }
    tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
    tipEl.style.setProperty('--ax', (r.left + r.width / 2 - x) + 'px');
    tipOwner = cls;
  }
  function showTipFor(target, text) { placeTip(target.getBoundingClientRect(), { text, wrap: text.length > 60 }, 'btn'); }
  function hideTip(owner) { if (tipEl && (!owner || owner === tipOwner)) { tipEl.remove(); tipEl = null; tipOwner = null; } }
  function bindTips(root) {
    root.querySelectorAll('[data-tip]').forEach(n => {
      if (n._tipBound) return; n._tipBound = true;
      n.addEventListener('mouseenter', () => { const t = tipText(n.dataset.tip); if (t) placeTip(n.getBoundingClientRect(), t, 'el'); });
      n.addEventListener('mouseleave', () => hideTip('el'));
      n.addEventListener('focus', () => { const t = tipText(n.dataset.tip); if (t) placeTip(n.getBoundingClientRect(), t, 'el'); });
      n.addEventListener('blur', () => hideTip('el'));
    });
  }
  function showCanvasTip(ch, hit) {
    const r = ch.cv.getBoundingClientRect(), k = r.width / ch.w;
    const rect = { left: r.left + hit.x * k, top: r.top + hit.y * k, width: hit.w * k, height: hit.h * k, bottom: r.top + (hit.y + hit.h) * k };
    if (tipOwner === 'canvas' && tipEl && tipEl._for === hit.tip) return;
    placeTip(rect, { text: hit.tip, wrap: hit.tip.length > 60 }, 'canvas');
    tipEl._for = hit.tip;
  }

  /* ---------- N1 coach mark ---------- */
  const coachOpen = () => !!$('#coach');
  function showCoach() {
    if (st.tipSeen || coachOpen()) return;
    const c = document.createElement('div');
    c.id = 'coach'; c.className = 'coach'; c.setAttribute('role', 'dialog'); c.setAttribute('aria-label', 'New: Payoff');
    c.innerHTML = `<div class="new">New</div><p>Hold <b>${esc(keyName())}</b> to see your breakeven and P&amp;L at any Nifty level and time. Let go to hide it.</p><div class="row"><button class="btn ter" id="coachGot">Got it</button><button class="btn pri" id="coachTry">Try it</button></div>`;
    document.body.appendChild(c);
    placeCoach();
    $('#coachGot').addEventListener('click', () => dismissCoach());
    $('#coachTry').addEventListener('click', () => { dismissCoach(true); log('payoff_open_tip'); setPayoff(() => { st.sticky = true; }, 'tip'); });
  }
  function placeCoach() {
    const c = $('#coach'); if (!c) return;
    const r = $('#payoffBtn').getBoundingClientRect();
    c.style.top = (r.bottom + 12) + 'px';
    c.style.left = Math.max(8, r.right - c.offsetWidth + 20) + 'px';
  }
  function dismissCoach(silent) {
    const c = $('#coach'); if (!c) return;
    c.remove(); st.tipSeen = true; LS.set('tipSeen', true);
    if (!silent) log('payoff_tip_dismissed');
  }
  document.addEventListener('mousedown', e => { const c = $('#coach'); if (c && !c.contains(e.target) && !e.target.closest('#payoffBtn')) dismissCoach(); });

  /* ---------- analytics log ---------- */
  function log(name, props = '') {
    const ev = `${E.clock(Math.min(st.clock, E.CLOSE)).replace(/ (am|pm)/, '')} ${name}${props ? ' ' + props : ''}`;
    st.events.unshift(ev); st.events = st.events.slice(0, 40);
    if (window.console) console.info('[analytics]', name, props);
    const lg = $('#dlog'); if (lg) lg.innerHTML = st.events.slice(0, 12).map(x => `<div>${esc(x)}</div>`).join('');
  }

  /* ---------- prototype controls ---------- */
  function renderDemo() {
    let d = $('#demo');
    if (!d) {
      d = document.createElement('aside'); d.id = 'demo'; d.className = 'demo'; d.setAttribute('aria-label', 'Prototype controls');
      document.body.appendChild(d);
    }
    d.classList.toggle('min', st.demoMin);
    const seg = (name, val, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button data-set="${name}" data-v="${v}" aria-pressed="${String(val) === String(v)}">${esc(l)}</button>`).join('')}</div>`;
    const groups = {};
    Object.entries(SCEN).forEach(([k, s]) => (groups[s.group] = groups[s.group] || []).push([k, s.name]));
    const sc = SCEN[st.scenario];
    const k = keyName();
    d.innerHTML = `<div class="dh"><span class="tag">Prototype</span><b>Demo controls</b><button id="dmin" aria-label="${st.demoMin ? 'Expand' : 'Collapse'}" aria-expanded="${!st.demoMin}"><svg class="i" style="transform:rotate(${st.demoMin ? 180 : 0}deg)"><use href="#i-chev"/></svg></button></div>` +
      `<div class="db">` +
      `<div class="grp"><span class="gl">Keys</span><div class="keys">` +
      `<div><span>Peek at Payoff</span><span class="caps">hold <kbd>${esc(k)}</kbd></span></div>` +
      `<div><span>Keep it on</span><span>click Payoff</span></div>` +
      `<div><span>Move the point</span><span class="caps"><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd></span></div>` +
      `<div><span>Pin a point</span><span>click, or <span class="caps"><kbd>Enter</kbd></span></span></div>` +
      `<div><span>Close</span><span class="caps"><kbd>Esc</kbd></span></div></div></div>` +
      `<div class="grp"><span class="gl">Positions</span><select id="dscen">${Object.entries(groups).map(([g, items]) => `<optgroup label="${esc(g)}">${items.map(([kk, n]) => `<option value="${kk}" ${kk === st.scenario ? 'selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>`).join('')}</select>` +
      (sc.product ? seg('product', st.product, [['CARRY', 'Carry forward'], ['INTRADAY', 'Intraday']]) : '') + `</div>` +
      `<div class="grp"><span class="gl">Clock · Tue 13 Oct</span>${seg('clock', st.clock, CLOCKS)}</div>` +
      `<div class="grp"><span class="gl">Prices</span>${seg('pricing', st.pricing, [['live', 'Live'], ['delayed', 'Delayed'], ['unavailable', 'Unavailable']])}${seg('ticks', st.ticks, [[true, 'Ticking'], [false, 'Frozen']])}</div>` +
      `<div class="grp"><span class="gl">Keyboard</span>${seg('platform', st.platform, [['mac', 'Mac · ⌥ Option'], ['win', 'Windows · Alt']])}</div>` +
      `<div class="grp"><span class="gl">Later release</span>${seg('later', st.later, [[true, 'Pins and orders on'], [false, 'MVP only']])}${seg('orderFail', st.orderFail, [[false, 'Orders succeed'], [true, 'Orders fail']])}</div>` +
      `<div class="grp"><span class="gl">Reset</span><div class="row"><button id="dtip">Show the tip again</button><button id="dreset">Reset prototype</button></div></div>` +
      `<div class="grp"><span class="gl">Analytics events</span><div class="log" id="dlog">${st.events.slice(0, 12).map(x => `<div>${esc(x)}</div>`).join('') || '<div>None yet</div>'}</div></div>` +
      `<div class="note">Sample data for Tue 13 Oct 2026, not market data. Values come from a Black-Scholes model on trading time; IV is held at its current level and the range moves it −2.5 to +3 points.</div>` +
      `</div>`;
    $('#dmin').addEventListener('click', () => { st.demoMin = !st.demoMin; LS.set('demoMin', st.demoMin); renderDemo(); fit(); });
    if (st.demoMin) return;
    $('#dscen').addEventListener('change', e => { st.scenario = e.target.value; LS.set('scenario', st.scenario); st.product = 'CARRY'; reloadScenario(); });
    d.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', () => {
      const name = b.dataset.set; let v = b.dataset.v;
      if (v === 'true') v = true; else if (v === 'false') v = false; else if (!isNaN(+v)) v = +v;
      st[name] = v;
      if (name === 'platform') LS.set('platform', v);
      if (name === 'clock' || name === 'product') { st.closedBannerHidden = false; reloadScenario(); return; }
      if (name === 'pricing') cache = null;
      if (name === 'later' && !v) st.pin = null;
      renderUI(); renderDemo(); if (st.m1) renderM1();
    }));
    $('#dtip').addEventListener('click', () => { st.tipSeen = false; LS.set('tipSeen', false); st.hinted = false; LS.set('hinted', false); showCoach(); renderUI(); renderDemo(); });
    $('#dreset').addEventListener('click', () => { LS.clear(); location.reload(); });
  }
  function reloadScenario() {
    const was = payoffOn();
    applyScenario();
    renderDemo();
    cache = null;
    if (was && payoffOn()) { const b = book(); idx.limitT = opt.limitT = axisEnd(b); const h = currentHorizon(b); if (h) fitTo(h.T); }
    if (!payoffOn()) defaultViews();
    renderUI();
  }

  /* ---------- live ticks ---------- */
  let walk = 0;
  setInterval(() => {
    if (!st.ticks || st.pricing !== 'live' || closed()) return;
    walk = Math.max(-3, Math.min(3, walk + (Math.random() - 0.5) * 1.6));
    st.noise = Math.round(walk * 20) / 20;
    rebuildDataSoft();
  }, 1500);
  // On a tick only the last candle, prices and overlays change (BR-17: at most once a second while the pointer is still).
  function rebuildDataSoft() {
    const S = S0();
    const lc = idx.candles[idx.candles.length - 1];
    if (lc) { lc.c = S; lc.h = Math.max(lc.h, S); lc.l = Math.min(lc.l, S); }
    idx.lastPrice = S;
    const c = shownOpt();
    if (c) { const lp = ltp(c); const ol = opt.candles[opt.candles.length - 1]; if (ol) { ol.c = lp; ol.h = Math.max(ol.h, lp); ol.l = Math.min(ol.l, lp); } opt.lastPrice = lp; }
    renderUI();
    if (st.popover) renderPopover();
    if (st.m1 && !st.m1.submitting) renderM1();
  }

  /* ---------- fit to window ---------- */
  // The demo panel docks on the left when open; the app scales down to fit what is left.
  function fit() {
    const docked = !st.demoMin;
    $('#fit').classList.toggle('docked', docked);
    const aw = innerWidth - (docked ? 332 : 0);
    const s = Math.min(1, aw / 1280, innerHeight / 760);
    const W = aw / s, H = innerHeight / s;
    const app = $('#app');
    app.style.width = W + 'px'; app.style.height = H + 'px';
    app.style.transform = s < 1 ? `scale(${s})` : '';
    requestAnimationFrame(() => { idx.resize(); opt.resize(); cache = null; renderUI(); placeCoach(); if (st.popover) renderPopover(); });
  }
  window.addEventListener('resize', fit);
  new ResizeObserver(() => { idx.resize(); opt.resize(); cache = null; idx.invalidate(); opt.invalidate(); }).observe($('#idxWrap'));

  /* ---------- boot ---------- */
  bindTips(document);
  applyScenario();
  renderDemo();
  fit();
  defaultViews();
  renderUI();
  setTimeout(showCoach, 400);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { idx.invalidate(); opt.invalidate(); placeCoach(); });
  window.__payoff = { st, idx, opt, book, P, E, setPayoff, applyScenario, reloadScenario, renderUI };
})();
