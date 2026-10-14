/* =====================================================================
   Sahi Payoff prototype: Scalper split view with Payoff (PRD v1.0),
   changed to hold-to-peek: hold Option (Mac) or Alt (Windows) to see
   Payoff, release to hide. The toolbar button keeps it on.
   v1.2: Payoff opens on the view the trader already has (no jump to
   expiry), and the Nifty and option charts keep their own timeframe,
   scroll and zoom.
   v1.3: both charts drag into empty space up to 3:30 pm on the next
   trading day; past the axis end the chart is striped and disabled; no
   expected-move drawings; a simpler readout that leads with the P&L.
   v1.4: real 1-minute data from Zerodha Kite (Nifty and the 19 Oct 22500
   Call and Put) up to 12:59 pm on Wed 14 Oct; simulated after that.
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
  // Replace an element's markup only when it changed, so ticks don't drop focus, hover or scroll.
  const setHTML = (el, html) => { if (el._html === html) return false; el._html = html; el.innerHTML = html; return true; };
  // Rebuild markup but put keyboard focus back on the matching control afterwards.
  function setHTMLKeepFocus(el, html, keyOf) {
    const a = document.activeElement;
    const key = a && el.contains(a) ? keyOf(a) : null;
    const changed = setHTML(el, html);
    if (changed && key) { const n = [...el.querySelectorAll('button, [tabindex]')].find(x => keyOf(x) === key); focusNS(n); }
    return changed;
  }
  // The two contracts with real data from Kite.
  const CE19 = C('CE', 22500, '2026-10-19'), PE19 = C('PE', 22500, '2026-10-19');
  // Focus without letting the browser scroll a clipped panel to reach the element.
  const focusNS = el => { if (el) el.focus({ preventScroll: true }); };
  let legId = 1;
  const leg = (c, side, avg, product = 'CARRY', qty = E.LOT) => ({ id: legId++, c, side, qty, avg, product });

  /* ---------- scenarios ---------- */
  // Entry prices come from the data at the time each position was opened: real for the 19 Oct 22500 pair,
  // modelled from the real index for other contracts. Intraday positions were opened at 9:20 am today.
  const at = (c, day, h, m) => E.roundTick(Math.max(E.TICK, E.optionPriceAt(c, E.tOf(E.dayIdx(day), h * 60 + m))));
  const today = E.DAYS[E.TODAY].key;
  const entry = (c, p, day, h, m) => p === 'INTRADAY' ? at(c, today, 9, 20) : at(c, day, h, m);
  const SCEN = {
    single: { name: 'Bought call · 19 Oct 22500', group: 'One position (S2)', product: true, legs: p => [leg(CE19, 1, entry(CE19, p, '2026-10-09', 10, 0), p)], opt: CE19 },
    boughtput: { name: 'Bought put · 19 Oct 22500', group: 'One position (S2)', product: true, legs: p => [leg(PE19, 1, entry(PE19, p, '2026-10-13', 14, 0), p)], opt: PE19 },
    soldput: { name: 'Sold put · 19 Oct 22500', group: 'One position (S2)', product: true, legs: p => [leg(PE19, -1, entry(PE19, p, '2026-10-12', 11, 0), p)], opt: PE19 },
    pretrade: { name: 'Not holding · pre-trade', group: 'No position (S2)', legs: () => [], opt: CE19 },
    empty: { name: 'Not holding · no contract loaded', group: 'No position (S2)', legs: () => [], opt: null },
    book: {
      name: 'Weekly + monthly book', group: 'Several positions (S3)', opt: CE19, realised: 1240,
      others: [{ id: 'bn1', label: 'BANKNIFTY 27 Oct 51500 Call', und: 'BANKNIFTY', side: 1, qty: 30, avg: 612.4, ltp: 655.2, product: 'Carry forward' }],
      legs: () => [leg(PE19, -1, at(PE19, '2026-10-08', 10, 30)), leg(C('CE', 22950, '2026-10-19'), -1, at(C('CE', 22950, '2026-10-19'), '2026-10-08', 10, 30)), leg(C('CE', 22500, '2026-10-27'), 1, at(C('CE', 22500, '2026-10-27'), '2026-10-09', 11, 0))]
    },
    condor: { name: 'Iron condor · 19 Oct', group: 'Several positions (S3)', opt: PE19, legs: () => [[C('PE', 22200, '2026-10-19'), 1], [PE19, -1], [C('CE', 22900, '2026-10-19'), -1], [C('CE', 23100, '2026-10-19'), 1]].map(([c, sd]) => leg(c, sd, at(c, '2026-10-12', 10, 0))) },
    straddle: { name: 'Long straddle · 19 Oct 22500', group: 'Several positions (S3)', opt: CE19, legs: () => [leg(CE19, 1, at(CE19, '2026-10-13', 9, 30)), leg(PE19, 1, at(PE19, '2026-10-13', 9, 30))] },
    shortstraddle: { name: 'Short straddle · 19 Oct 22500', group: 'Several positions (S3)', opt: CE19, legs: () => [leg(CE19, -1, at(CE19, '2026-10-12', 15, 0)), leg(PE19, -1, at(PE19, '2026-10-12', 15, 0))] },
    calendar: { name: 'Calendar spread · 22500 Call', group: 'Several positions (S3)', opt: CE19, legs: () => [leg(CE19, -1, at(CE19, '2026-10-09', 14, 0)), leg(C('CE', 22500, '2026-10-27'), 1, at(C('CE', 22500, '2026-10-27'), '2026-10-09', 14, 0))] },
    futures: { name: 'Futures + protective put', group: 'Several positions (S3)', opt: C('PE', 22500, '2026-10-27'), legs: () => [leg(C('FUT', 0, '2026-10-27'), 1, at(C('FUT', 0, '2026-10-27'), '2026-10-08', 10, 0)), leg(C('PE', 22500, '2026-10-27'), 1, at(C('PE', 22500, '2026-10-27'), '2026-10-08', 10, 0))] },
    mixed: { name: 'Intraday call + carry-forward put', group: 'Several positions (S3)', opt: CE19, legs: () => [leg(CE19, 1, at(CE19, today, 9, 20), 'INTRADAY'), leg(PE19, -1, at(PE19, '2026-10-12', 11, 0))] }
  };
  // Real data runs to 12:59 pm today; later presets continue on simulated prices.
  const REAL_END_MOD = E.REAL_END_T - E.tOf(E.TODAY, E.OPEN) + E.OPEN;
  const CLOCKS = [[570, '9:30 am'], [675, '11:15 am'], [REAL_END_MOD, `${E.clock(REAL_END_MOD)} · latest data`], [905, '3:05 pm · simulated'], [945, '3:45 pm · closed']];

  /* ---------- state ---------- */
  const isMac = /Mac|iPhone|iPad/.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');
  const st = {
    platform: LS.get('platform', isMac ? 'mac' : 'win'),
    clock: REAL_END_MOD, pricing: 'live', ticks: true, later: true, orderFail: false,
    scenario: (k => SCEN[k] ? k : 'single')(LS.get('scenario', 'single')), product: 'CARRY',
    legs: [], others: [], realised: 0, realisedOther: 0, opt: CE19, lots: 1, oneTap: true,
    sticky: false, peek: false, pin: null, horizon: null,
    tf: Object.assign({ idx: 3, opt: 5 }, LS.get('tf', {})),
    // range presets (1D, 5D, 1M) per chart; cleared when the trader drags or zooms that chart
    range: { idx: null, opt: '1' },
    hover: null, keyPt: null, rowHover: null, noise: 0,
    tipSeen: LS.get('tipSeen', false), hinted: LS.get('hinted', false), demoMin: LS.get('demoMin', innerWidth < 1600),
    orders: {}, exits: [], events: [], fadeStart: 0, loadingUntil: 0, m1: null, popover: null, closedBannerHidden: false
  };

  const closed = () => st.clock >= E.CLOSE;
  const nowT = () => closed() ? E.tOf(E.TODAY, E.CLOSE) : E.tOf(E.TODAY, st.clock);
  // Tick noise only applies while prices are live and ticking during market hours.
  const ticking = () => st.ticks && st.pricing === 'live' && !closed();
  const S0 = () => E.pathAt(nowT(), closed()) + (ticking() ? st.noise : 0);
  const expired = c => c.type !== 'FUT' && c.expT <= nowT();
  // An unexpired option never trades below one tick.
  const ltp = c => c.type === 'FUT' ? Math.round(S0() * 20) / 20 : expired(c) ? E.roundTick(E.intrinsic(c, E.settleS(c))) : Math.max(E.TICK, E.roundTick(E.price(c, S0(), nowT())));
  const keyName = () => st.platform === 'mac' ? '⌥' : 'Alt';
  const keyWord = () => st.platform === 'mac' ? 'Option' : 'Alt';
  const optPrevClose = c => Math.max(E.TICK, E.roundTick(E.optionCloseBefore(c, E.tOf(E.TODAY, E.OPEN))));
  const timeLong = T => E.fmtT(T);

  function squareOffIntraday() {
    // After the close, intraday positions were squared off at 3:20 pm and their P&L is realised.
    st.legs = st.legs.filter(l => {
      if (l.product !== 'INTRADAY') return true;
      st.realised += l.side * l.qty * (E.price(l.c, E.pathAt(P.SQ_T), P.SQ_T) - l.avg);
      return false;
    });
    pruneOrders();
  }
  // Scheduled exits and targets/stops go with the positions they belong to (BR-21).
  function pruneOrders() {
    st.exits = st.exits.map(x => Object.assign({}, x, { legIds: x.legIds.filter(i => st.legs.some(l => l.id === i)) })).filter(x => x.legIds.length);
    Object.keys(st.orders).forEach(id => { if (!st.legs.some(l => String(l.id) === id)) delete st.orders[id]; });
  }
  function clearPin(reason) { if (st.pin) { log('payoff_pin_close', `reason=${reason}`); st.pin = null; } }
  function applyScenario() {
    const sc = SCEN[st.scenario] || SCEN.single;
    st.legs = sc.legs(st.product);
    st.others = (sc.others || []).map(o => Object.assign({}, o));
    st.realised = sc.realised || 0; st.realisedOther = 0;
    st.opt = sc.opt;
    st.pin = null; st.orders = {}; st.exits = []; st.horizon = null; st.keyPt = null; st.rowHover = null;
    if (closed()) squareOffIntraday();
    closeM1(true);
    rebuildData();
  }

  /* ---------- the book Payoff prices ---------- */
  // legs: open legs that Payoff prices. settled: legs that expired earlier today (shown, not priced).
  function book() {
    const T = nowT();
    const all = st.legs.filter(l => l.c.und === 'NIFTY' && l.qty > 0);
    const legs = all.filter(l => !expired(l.c)), settled = all.filter(l => expired(l.c));
    const b = { legs, settled, all, nowT: T, S0: S0(), closed: closed(), pretrade: false };
    if (!all.length && st.opt && !expired(st.opt)) { b.pretrade = true; b.legs = [{ id: 0, c: st.opt, side: 1, qty: st.lots * E.LOT, avg: ltp(st.opt), product: 'CARRY' }]; b.all = b.legs; }
    return b;
  }
  const positionCount = () => new Set(st.legs.filter(l => l.c.und === 'NIFTY' && l.qty > 0).map(l => l.c.id)).size;
  const isS3 = () => positionCount() >= 2;
  const payoffOn = () => st.sticky || st.peek || !!st.pin;
  // Nothing left to price: the position (or every position) settled today.
  const expiredBook = b => !b.pretrade && !b.legs.length && b.settled.length > 0;
  const expiredSingle = b => expiredBook(b) && !isS3();
  const axisEnd = b => (b.legs.length ? P.axisEnd(b) : null);
  // Whether a point in the future zone can be shown: something to price, live-enough prices.
  const pointable = b => { const e = axisEnd(b); return e != null && e > b.nowT && st.pricing !== 'unavailable'; };
  const otherCount = () => st.others.length;
  const sessionEnd = () => closed() ? (E.TODAY + 2) * E.SESSION : (E.TODAY + 1) * E.SESSION;
  // The point moves in steps of one Nifty candle, whatever timeframe that chart is on.
  const step = () => idx.o.tf;
  const firstT = b => Math.ceil((b.nowT + 1) / step()) * step();
  // A point at or before Now shows Now values (BR-13), e.g. after the clock moves on.
  const livePt = (z, b) => (z && z.T && z.T > b.nowT) ? z : null;
  // One P&L per point: a held single position is valued at the tick it would trade at.
  function pointPnl(b, S, T) {
    if (!isS3() && !b.pretrade && b.legs.length === 1) { const l = b.legs[0]; return l.side * l.qty * (heldPrem(l, S, T, b) - l.avg); }
    return P.pnl(b, S, T);
  }
  function heldPrem(l, S, T, b) {
    const v = P.legDetail(l, S, T, b).value;
    if (l.c.type === 'FUT') return v;
    return T < l.c.expT ? Math.max(E.TICK, E.roundTick(v)) : E.roundTick(v);
  }

  function horizons(b) {
    const end = axisEnd(b);
    if (end == null || end <= b.nowT) return [];
    const allIntraday = !b.pretrade && b.legs.every(l => l.product === 'INTRADAY');
    const todayEnd = allIntraday ? Math.max(b.nowT, P.SQ_T) : Math.min(end, sessionEnd());
    const list = [{ key: 'today', label: closed() ? 'Next session' : 'Today', T: todayEnd }];
    if (!allIntraday) {
      const seen = new Set();
      b.legs.filter(l => l.product === 'CARRY' || b.pretrade).map(l => l.c.exp).sort((x, y) => x.T - y.T).forEach(e => {
        if (e.T > todayEnd && !seen.has(e.key)) { seen.add(e.key); list.push({ key: e.key, label: e.info.short, T: e.T }); }
      });
    }
    return list;
  }
  // The chip the trader picked, or null. Payoff opens with none picked, on the view the trader already had;
  // zooming or panning by hand clears the pick.
  function currentHorizon(b) {
    if (!st.horizon) return null;
    return horizons(b).find(h => h.key === st.horizon) || null;
  }
  function markers(b) {
    const out = [];
    const end = axisEnd(b);
    if (end == null) return out;
    const byExp = {};
    b.legs.forEach(l => { if (l.c.expT > b.nowT && l.c.expT <= end && (b.pretrade || l.product !== 'INTRADAY')) (byExp[l.c.exp.key] = byExp[l.c.exp.key] || { e: l.c.exp, n: 0 }).n++; });
    Object.values(byExp).forEach(({ e, n }) => {
      const lbl = `${e.kind} expiry · ${e.info.label}`;
      out.push({ T: e.T, label: lbl, sub: e.movedFrom ? `moved from ${e.movedFrom.label}` : '', tip: `${lbl}${e.movedFrom ? ` · moved from ${e.movedFrom.label} for a holiday` : ''} · ${n} ${n === 1 ? 'leg expires' : 'legs expire'}` });
    });
    if (!b.pretrade && b.legs.some(l => l.product === 'INTRADAY') && P.SQ_T > b.nowT) {
      const n = b.legs.filter(l => l.product === 'INTRADAY').length;
      out.push({ T: P.SQ_T, label: 'Auto square-off · 3:20 pm', sub: '', tip: `Auto square-off · 3:20 pm · ${n} intraday ${n === 1 ? 'position' : 'positions'}` });
    }
    return out.sort((a, c) => a.T - c.T);
  }

  /* ---------- charts ---------- */
  const COL = { up: '#0b9981', down: '#f23645', upBg: '#0c3a33', downBg: '#3f1820' };
  // An index has no volume, so the Nifty chart keeps only a sliver for it.
  const idx = new SahiChart($('#idxCanvas'), { tf: st.tf.idx, dec: 2, volFrac: 0.03 });
  const OI = [];
  const opt = new SahiChart($('#optCanvas'), {
    tf: st.tf.opt, dec: 2, volFrac: 0.1, minY: 0,
    sub: { frac: 0.26, series: OI, fmt: v => v < 1e5 ? (v / 1e3).toFixed(v < 1e4 ? 1 : 0).replace(/\.0$/, '') + 'K' : (v / 1e5).toFixed(v < 1e6 ? 1 : 0).replace(/\.0$/, '') + 'L', color: '#2196f3' }
  });
  const savedViews = { idx: null, opt: null };
  // Both charts drag right into empty space up to 3:30 pm on the next trading day, Payoff on or off (BR-27).
  idx.panT = opt.panT = (E.TODAY + 2) * E.SESSION;

  // In S2 the option chart switches to the held contract while Payoff is on.
  function heldSingle() {
    const b = book();
    if (payoffOn() && !isS3() && !b.pretrade && b.legs.length === 1 && b.legs[0].c.type !== 'FUT') return b.legs[0].c;
    return null;
  }
  const shownOpt = () => heldSingle() || st.opt;
  let calT = null;
  function rebuildData() {
    const T = nowT();
    // real contracts take their IV from their real price at Now, so the model starts where the market is
    if (calT !== T) { E.calibrate(T); calT = T; cache = null; }
    const S = S0(), from = E.tOf(E.HIST_START, E.OPEN);
    const ic = E.indexCandles(idx.o.tf, from, T);
    const last = ic[ic.length - 1];
    if (last) { last.c = S; last.h = Math.max(last.h, S); last.l = Math.min(last.l, S); }
    idx.setData(ic, T, S);
    const c = shownOpt();
    if (c) {
      const oc = E.optionCandles(c, opt.o.tf, from, T);
      const lp = ltp(c);
      const ol = oc[oc.length - 1];
      if (ol) { ol.c = lp; ol.h = Math.max(ol.h, lp); ol.l = Math.min(ol.l, lp); }
      opt.setData(oc, T, lp);
      OI.length = 0;
      oc.forEach(k => { if (k.oi != null) OI.push({ T: Math.min(k.t1, T), v: k.oi }); });
    } else { opt.setData([], T, null); OI.length = 0; }
    renderUI();
    refreshMirror();
  }
  // The window a range preset shows: the last 1 or 5 sessions, or all the data (1M), up to Now.
  function rangeView(key) {
    const T = nowT(), last = E.dayOfT(T);
    const first = key === '1' ? last : key === '5' ? last - 4 : E.HIST_START;
    const t0 = Math.max(E.HIST_START, first) * E.SESSION;
    const span = Math.max(30, T - t0);
    return [t0 - span * 0.01, T + span * 0.06];
  }
  function applyRange(ch, key) { ch.setView(...ch.clampView(...rangeView(key))); }
  function defaultViews() {
    const T = nowT();
    idx.limitT = null; opt.limitT = null;
    st.range = { idx: null, opt: '1' };
    idx.setView(...idx.clampView(T - 300, T + 24));
    applyRange(opt, st.range.opt);
    renderTf();
  }
  // A chip fits both charts to the same window; after that each chart scrolls and zooms on its own.
  function fitTo(hT) {
    const T = nowT();
    const span = Math.max(15, hT - T);
    const t0 = T - Math.max(45, span * 0.28), t1 = hT + span * 0.035;
    idx.setView(...idx.clampView(t0, t1)); opt.setView(...opt.clampView(t0, t1));
    st.range = { idx: null, opt: null }; renderTf();
  }
  // Let the charts scroll as far as the axis end. Only a picked chip moves the view; otherwise it stays put.
  function refit(b) {
    const end = axisEnd(b);
    idx.limitT = opt.limitT = (end != null && end > b.nowT) ? end : null;
    const h = currentHorizon(b);
    if (h) fitTo(h.T);
    else [idx, opt].forEach(ch => ch.setView(...ch.clampView(ch.view.t0, ch.view.t1)));
  }
  // Keep each chart's window where it was relative to Now when the clock moves.
  const shiftView = (v, dT) => v && { t0: v.t0 + dT, t1: v.t1 + dT };
  function followNow(prevT) {
    const dT = nowT() - prevT;
    if (!dT) return;
    [[idx, 'idx'], [opt, 'opt']].forEach(([ch, k]) => {
      if (st.range[k]) applyRange(ch, st.range[k]);
      else if (prevT <= ch.view.t1 + 1) ch.setView(...ch.clampView(ch.view.t0 + dT, ch.view.t1 + dT));
    });
    savedViews.idx = shiftView(savedViews.idx, dT); savedViews.opt = shiftView(savedViews.opt, dT);
  }
  function enterPayoff(source) {
    const b = book();
    savedViews.idx = savedViews.idx || idx.view; savedViews.opt = savedViews.opt || opt.view;
    // Payoff opens on the view the trader already has; the chips, dragging or zooming reach further.
    st.horizon = null;
    { const e = axisEnd(b); idx.limitT = opt.limitT = (e != null && e > b.nowT) ? e : null; }
    st.fadeStart = performance.now();
    st.loadingUntil = performance.now() + 260;
    setTimeout(() => { idx.invalidate(); renderUI(); }, 280);
    rebuildData();
    // a pointer already resting on the chart gets its readout at once
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!payoffOn() || !idx.pointer) return;
      st.hover = zoneAt(idx, idx.pointer); markHinted(st.hover); updateReadout(idx.pointer); idx.invalidate(); opt.invalidate(); renderTable();
    }));
    log('payoff_open', `source=${source}${isS3() ? ` leg_count=${b.all.length} expiry_count=${new Set(b.all.map(l => l.c.expKey)).size}` : ''}${b.pretrade ? ' pretrade' : ''}`);
    if (b.pretrade) log('payoff_pretrade_open');
    st.openedAt = performance.now();
  }
  function exitPayoff() {
    idx.limitT = null; opt.limitT = null;
    if (savedViews.idx) idx.setView(savedViews.idx.t0, savedViews.idx.t1);
    if (savedViews.opt) opt.setView(savedViews.opt.t0, savedViews.opt.t1);
    savedViews.idx = savedViews.opt = null;
    st.hover = null; st.keyPt = null; st.rowHover = null;
    st.horizon = null;
    clearTimeout(liveTimer); lastLive = ''; $('#live').textContent = '';
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
    else rebuildData();
    refreshTip();
  }

  /* ---------- shading and breakevens (cached per view) ---------- */
  let cache = null;
  function payoffGrid(ch, b, coarse) {
    const end = axisEnd(b);
    const key = [ch.view.t0, ch.view.t1, ch.w, ch.h, ch.yr.lo.toFixed(2), ch.yr.hi.toFixed(2), b.S0.toFixed(2), b.nowT, b.legs.map(l => l.id + ':' + l.qty + ':' + l.avg + ':' + l.c.id + ':' + l.product).join('|'), coarse].join(',');
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
      for (let i = 0; i < edges.length - 1; i++) segs.push({ a: edges[i], b: edges[i + 1], profit: (i % 2 === 0) ? profitAtLo : !profitAtLo });
      cols.push({ x, w: Math.min(step, x1 - x), T, roots, segs });
    }
    const lines = [];
    let active = [];
    cols.forEach(col => {
      const cx = col.x + col.w / 2;
      const jump = (hi - lo) * 0.12;
      if (col.roots.length !== active.length || col.roots.some((r, i) => Math.abs(r - active[i].pts[active[i].pts.length - 1][1]) > jump)) {
        active = col.roots.map(r => { const l = { pts: [[cx, r]] }; lines.push(l); return l; });
      } else col.roots.forEach((r, i) => active[i].pts.push([cx, r]));
    });
    const last = cols[cols.length - 1];
    const anyRoot = cols.some(c => c.roots.length);
    const sign = last ? (P.pnl(b, (lo + hi) / 2, last.T) > 0 ? 'Profit' : 'Loss') : null;
    cache = { key, cols, lines, last, anyRoot, sign, end, x0, x1, lo, hi, pStep };
    return cache;
  }

  /* ---------- canvas helpers ---------- */
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  // Draw (or with o.measure, only measure) a label pill; returns its rect.
  function pill(ctx, x, y, lines, o = {}) {
    lines = Array.isArray(lines) ? lines : [lines];
    const font0 = o.font || '600 11px Inter, system-ui, sans-serif';
    ctx.font = font0;
    let w = 0;
    lines.forEach((l, i) => { ctx.font = i === 0 ? font0 : '500 10.5px Inter, system-ui, sans-serif'; w = Math.max(w, ctx.measureText(l).width); });
    w += (o.padX || 14);
    const lh = o.lh || 15, h = lines.length * lh + 7;
    let x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
    let y0 = o.valign === 'bottom' ? y - h : o.valign === 'middle' ? y - h / 2 : y;
    if (o.clampW) x0 = Math.max(2, Math.min(o.clampW - w - 2, x0));
    if (o.clampH) y0 = Math.max(o.clampH[0], Math.min(o.clampH[1] - h, y0));
    const r = { x: x0, y: y0, w, h };
    if (o.measure) return r;
    ctx.fillStyle = o.bg || 'rgba(20, 25, 34, .94)';
    rr(ctx, x0, y0, w, h, o.r == null ? 5 : o.r); ctx.fill();
    if (o.border) { ctx.strokeStyle = o.border; ctx.lineWidth = 1; ctx.stroke(); }
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => {
      ctx.fillStyle = i === 0 ? (o.fg || '#e9ecf1') : (o.fg2 || '#a7afbc');
      ctx.font = i === 0 ? font0 : '500 10.5px Inter, system-ui, sans-serif';
      ctx.fillText(l, x0 + (o.padX || 14) / 2, y0 + 4 + lh * i + lh / 2);
    });
    return r;
  }
  const overlaps = (r, list, pad = 3) => list.some(t => r.x < t.x + t.w + pad && r.x + r.w + pad > t.x && r.y < t.y + t.h + pad && r.y + r.h + pad > t.y);
  // Try each candidate position; draw the first one that collides with nothing already placed.
  const overlapArea = (r, list) => list.reduce((a, t) => a + Math.max(0, Math.min(r.x + r.w, t.x + t.w) - Math.max(r.x, t.x)) * Math.max(0, Math.min(r.y + r.h, t.y + t.h) - Math.max(r.y, t.y)), 0);
  function placePill(ctx, taken, cands, lines, o, plotW) {
    let chosen = null, best = null, bestA = Infinity;
    for (const cd of cands) {
      const r = pill(ctx, cd.x, cd.y, lines, Object.assign({}, o, cd, { measure: true, clampW: plotW }));
      if (!overlaps(r, taken)) { chosen = cd; break; }
      const a = overlapArea(r, taken);
      if (a < bestA) { bestA = a; best = cd; }
    }
    if (!chosen && o.required === false) return null;
    // nothing is clear: take the spot that hides the least
    chosen = chosen || best || cands[cands.length - 1];
    const r = pill(ctx, chosen.x, chosen.y, lines, Object.assign({}, o, chosen, { clampW: plotW }));
    taken.push(r);
    return r;
  }
  const hits = { idx: [], opt: [] };
  const alpha = () => Math.min(1, (performance.now() - st.fadeStart) / 220);
  function dot(ctx, x, y, color, r) { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#12161d'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1; }

  /* ---------- index chart: S1 indicators from the screenshot ---------- */
  // The Exp. Move indicator is left out (v1.3); OI Support stays, at 22500 where the real put OI is highest.
  const OI_SUPPORT = 22500;
  function drawS1Indicators(ctx, ch) {
    const y = Math.round(ch.pToY(OI_SUPPORT)) + 0.5;
    if (y > 0 && y < ch.mainH) { ctx.strokeStyle = 'rgba(40,188,208,.7)'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ch.plotW, y); ctx.stroke(); ctx.setLineDash([]); }
  }
  // Labels for the S1 indicators sit above the candles, inside the plot, with a pointed left edge like Sahi's tags.
  function drawS1Labels(ctx, ch) {
    const y = Math.round(ch.pToY(OI_SUPPORT)) + 0.5;
    if (y > 0 && y < ch.mainH) pill(ctx, 100, y, 'OI Support', { valign: 'middle', font: '500 10.5px Inter, system-ui, sans-serif', bg: 'rgba(18,22,29,.95)', fg: '#7fd7e4', border: 'rgba(40,188,208,.5)', padX: 10, lh: 12 });
  }

  /* ---------- where the real data ends ---------- */
  // Once the clock is past the last real minute, the candles after it are simulated: mark the hand-over.
  function drawSimMark(ctx, ch, taken) {
    if (nowT() <= E.REAL_END_T) return;
    const x = Math.round(ch.tToX(E.REAL_END_T)) + 0.5;
    if (x < 0 || x > ch.plotW) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(167,139,250,.55)'; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x, ch.o.padTop); ctx.lineTo(x, ch.mainH); ctx.stroke();
    ctx.restore();
    const y = ch.mainH * (1 - ch.o.volFrac) - 26;
    placePill(ctx, taken, [{ x: x + 5, y }, { x: x - 5, y, align: 'right' }, { x: x + 5, y: y - 28 }], 'Simulated after ' + E.clock(REAL_END_MOD), { font: '500 10.5px Inter, system-ui, sans-serif', fg: '#c4b5fd', bg: 'rgba(30,24,52,.92)', border: 'rgba(167,139,250,.45)', padX: 10, lh: 12, required: false }, ch.plotW);
  }

  /* ---------- disabled area past the axis end (BR-26) ---------- */
  // Where nothing can be priced any more: after the last expiry, after the 3:20 pm square-off for an
  // intraday-only book, or from Now when every position has already expired.
  function disabledFrom(b) {
    const end = axisEnd(b);
    if (end != null && end > b.nowT) return end;
    return expiredBook(b) ? b.nowT : null;
  }
  function disabledLabel(b) {
    if (!b.legs.length) return 'Expired';
    return !b.pretrade && b.legs.every(l => l.product === 'INTRADAY') ? 'After auto square-off' : 'After expiry';
  }
  // Diagonal stripes, like a disabled control. They are tied to the time axis, so they move with the chart.
  function drawDisabled(ctx, ch, fromT) {
    const xa = ch.tToX(fromT), x0 = Math.max(0, xa), x1 = ch.plotW, H = ch.mainH;
    if (x1 - x0 < 1) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, 0, x1 - x0, H); ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.025)'; ctx.fillRect(x0, 0, x1 - x0, H);
    ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1;
    ctx.beginPath();
    let x = xa - H;
    if (x < x0 - H) x += Math.ceil((x0 - H - x) / 8) * 8;
    for (; x < x1; x += 8) { ctx.moveTo(x, H); ctx.lineTo(x + H, 0); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    if (xa >= 0) { ctx.beginPath(); ctx.moveTo(Math.round(xa) + 0.5, 0); ctx.lineTo(Math.round(xa) + 0.5, H); ctx.stroke(); }
    ctx.restore();
  }
  function labelDisabled(ctx, ch, b, taken) {
    const from = disabledFrom(b);
    if (from == null) return;
    const x0 = Math.max(0, ch.tToX(from)), w = ch.plotW - x0;
    if (w < 120) return;
    const cx = x0 + w / 2, cy = ch.mainH * (1 - ch.o.volFrac) * 0.5;
    placePill(ctx, taken, [{ x: cx, y: cy, align: 'center', valign: 'middle' }, { x: cx, y: cy + 40, align: 'center', valign: 'middle' }, { x: cx, y: cy - 40, align: 'center', valign: 'middle' }], disabledLabel(b), { font: '500 11px Inter, system-ui, sans-serif', fg: '#8a92a3', bg: 'rgba(18,22,29,.92)', border: '#2c3442', required: false }, ch.plotW);
  }

  /* ---------- index chart overlays ---------- */
  idx.on('extraRange', ch => {
    const b = book();
    // the candles set the scale with Payoff on or off; the OI Support line shows only when it falls in range
    const base = [b.S0, b.S0];
    if (!payoffOn()) return base;
    if (!pointable(b)) return st.pin ? [Math.min(base[0], st.pin.S - 10), Math.max(base[1], st.pin.S + 10)] : base;
    // room for a typical move over the future shown, so the shading and breakevens have space (nothing is drawn for it)
    const end = axisEnd(b);
    const tR = Math.min(end, ch.view.t1);
    const half = P.coneHalf(b.S0, E.baseIv(), b.nowT, tR);
    return [Math.min(base[0], b.S0 - half * 1.05), Math.max(base[1], b.S0 + half * 1.05)];
  });
  idx.on('skipDay', T => payoffOn() && markers(book()).some(m => Math.abs(m.T - T) < 1));
  opt.on('skipDay', T => payoffOn() && markers(book()).some(m => Math.abs(m.T - T) < 1));
  idx.on('below', (ctx, ch) => {
    hits.idx = [];
    if (!payoffOn()) { drawS1Indicators(ctx, ch); return; }
    const b = book();
    const end = axisEnd(b);
    { const from = disabledFrom(b); if (from != null) drawDisabled(ctx, ch, from); }
    if (end == null || end <= b.nowT) return;
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
    ctx.globalAlpha = 1;
  });
  idx.on('above', (ctx, ch) => {
    const taken = [];
    ch._taken = taken;
    drawSimMark(ctx, ch, taken);
    if (!payoffOn()) { drawS1Labels(ctx, ch); drawExitMarkers(ctx, ch, 'idx', taken); return; }
    const b = book();
    const end = axisEnd(b);
    if (end == null || end <= b.nowT) { labelDisabled(ctx, ch, b, taken); return; }
    // labels keep clear of the docked Now readout
    if (docking(b)) taken.push(dockRect(ch, b, $('#readout')));
    ctx.globalAlpha = alpha();
    const stale = st.pricing === 'delayed';
    const nx = ch.tToX(b.nowT);
    const topY = ch.o.padTop;
    const plotBottom = ch.mainH * (1 - ch.o.volFrac);
    const beCol = stale ? '#8a92a3' : css('--breakeven');
    const g = st.pricing !== 'unavailable' ? payoffGrid(ch, b, !!ch.drag) : null;
    if (g) {
      // lines first, so every label below sits on top of them
      ctx.strokeStyle = beCol; ctx.lineWidth = 1.8;
      g.lines.forEach(l => { if (l.pts.length < 2) return; ctx.beginPath(); l.pts.forEach(([x, p], i) => i ? ctx.lineTo(x, ch.pToY(p)) : ctx.moveTo(x, ch.pToY(p))); ctx.stroke(); });
      ctx.lineWidth = 1;
    }
    // top row: Now first, then each marker, moving down a row when labels would collide
    const nowTxt = closed() ? 'Now · last close' : 'Now';
    if (nx >= 0 && nx <= ch.plotW) {
      ctx.strokeStyle = '#71809a'; ctx.beginPath(); ctx.moveTo(Math.round(nx) + 0.5, topY - 4); ctx.lineTo(Math.round(nx) + 0.5, ch.mainH); ctx.stroke();
      placePill(ctx, taken, [{ x: nx + 5, y: topY + 4 }, { x: nx - 5, y: topY + 4, align: 'right' }], nowTxt, { bg: 'rgba(30,36,48,.95)', border: '#3a4558' }, ch.plotW);
    } else placePill(ctx, taken, [nx < 0 ? { x: 4, y: topY + 4 } : { x: ch.plotW - 4, y: topY + 4, align: 'right' }], nx < 0 ? `← ${nowTxt}` : `${nowTxt} →`, { bg: 'rgba(30,36,48,.95)', border: '#3a4558' }, ch.plotW);
    markers(b).forEach(m => {
      const x = Math.round(ch.tToX(m.T)) + 0.5;
      if (x < 0 || x > ch.plotW + 1) return;
      ctx.strokeStyle = '#8b95a8'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x, topY - 4); ctx.lineTo(x, ch.mainH); ctx.stroke(); ctx.setLineDash([]);
      const lines = m.sub ? [m.label, m.sub] : m.label;
      const cands = [];
      for (let row = 0; row < 4; row++) { const y = topY + 4 + row * 40; cands.push({ x: x - 6, y, align: 'right' }, { x: x + 6, y }); }
      const r = placePill(ctx, taken, cands, lines, { bg: 'rgba(30,36,48,.95)', border: '#3a4558' }, ch.plotW);
      hits.idx.push(Object.assign({}, r, { tip: m.tip }));
    });
    // labels belong to the shaded zone; when it is dragged off to the left (into the striped area) they go with it
    if (g && ch.tToX(end) > 0) {
      // breakeven labels at the selected chip's time, or at the right end of the zone shown
      const allIntraday = !b.pretrade && b.legs.every(l => l.product === 'INTRADAY');
      const hz = currentHorizon(b);
      let labelT = g.last ? g.last.T : end, lx = g.x1;
      if (hz && ch.tToX(hz.T) <= ch.plotW + 1 && ch.tToX(hz.T) >= nx) { labelT = hz.T; lx = ch.tToX(hz.T); }
      else if (g.last) labelT = Math.min(end, Math.round(g.last.T / ch.o.tf) * ch.o.tf);
      const atAxisEnd = labelT >= end - 0.5;
      const endWord = atAxisEnd ? (allIntraday ? 'at 3:20 pm' : 'at expiry') : `at ${E.fmtT(labelT)}`;
      const rootsAt = labelT > b.nowT ? P.roots(b, labelT, g.lo, g.hi, g.pStep) : [];
      const beTip = isS3() ? 'Breakeven: the Nifty level where your book’s total P&L is zero at each time' : 'Breakeven: the Nifty level where this position’s P&L is zero at each time';
      rootsAt.slice().sort((p, q) => q - p).forEach(r => {
        const y = ch.pToY(r);
        const cands = [{ x: lx - 6, y: y - 4, valign: 'bottom', align: 'right' }, { x: lx - 6, y: y + 4, align: 'right' }, { x: lx - 140, y: y - 4, valign: 'bottom', align: 'right' }, { x: lx - 140, y: y + 4, align: 'right' }, { x: lx - 6, y: y + 30, align: 'right' }, { x: lx - 6, y: y + 56, align: 'right' }, { x: lx - 140, y: y + 30, align: 'right' }, { x: lx - 6, y: y - 30, valign: 'bottom', align: 'right' }];
        const box = placePill(ctx, taken, cands, `Breakeven ${E.level(r)} ${endWord}`, { fg: beCol, bg: 'rgba(16,20,28,.94)', border: stale ? '#4a5263' : 'rgba(242,184,75,.45)', clampH: [topY, plotBottom] }, ch.plotW);
        hits.idx.push(Object.assign({}, box, { tip: beTip }));
      });
      // lines that end before the label time (e.g. a book that is a loss everywhere by then) get a label at their end
      if (!rootsAt.length) g.lines.forEach(l => {
        if (l.pts.length < 6) return;
        const [x, pv] = l.pts[l.pts.length - 1];
        if (x >= lx - 4) return;
        const y = ch.pToY(pv), tEnd = Math.round(ch.xToT(x) / ch.o.tf) * ch.o.tf;
        const box = placePill(ctx, taken, [{ x: x - 4, y: y - 4, valign: 'bottom', align: 'right' }, { x: x - 4, y: y + 4, align: 'right' }, { x: x + 4, y: y - 4, valign: 'bottom' }, { x: x + 4, y: y + 4 }], `Breakeven ${E.level(pv)} at ${E.fmtT(tEnd)}`, { fg: beCol, bg: 'rgba(16,20,28,.94)', border: stale ? '#4a5263' : 'rgba(242,184,75,.45)', clampH: [topY, plotBottom] }, ch.plotW);
        hits.idx.push(Object.assign({}, box, { tip: beTip }));
      });
      // breakevens beyond the visible range, at the same time as the labels
      if (labelT > b.nowT) {
        P.roots(b, labelT, b.S0 * 0.6, b.S0 * 1.4, 5).filter(r => r > ch.yr.hi || r < ch.yr.lo).forEach(r => {
          const up = r > ch.yr.hi;
          const y = up ? topY + 50 : plotBottom - 8;
          placePill(ctx, taken, [{ x: lx - 6, y, align: 'right', valign: up ? 'top' : 'bottom' }, { x: lx - 6, y: up ? y + 26 : y - 26, align: 'right', valign: up ? 'top' : 'bottom' }], `Breakeven ${E.level(r)} ${endWord} ${up ? '↑' : '↓'}`, { fg: beCol, bg: 'rgba(16,20,28,.94)', border: 'rgba(242,184,75,.35)' }, ch.plotW);
        });
      }
      // Profit and Loss labels, in the largest region of a column that is clear of other labels
      if (g.cols.length) {
        const lineRects = [];
        const addPts = pts => pts.forEach(([x, y]) => lineRects.push({ x: x - 1, y: y - 1, w: 2, h: 2 }));
        g.lines.forEach(l => addPts(l.pts.map(([x, pv]) => [x, ch.pToY(pv)])));
        [[true, 'Profit', stale ? '#8a92a3' : css('--up-2')], [false, 'Loss', stale ? '#8a92a3' : '#f0828f']].forEach(([want, text, color]) => {
          for (const f of [0.62, 0.45, 0.76, 0.3, 0.88]) {
            const col = g.cols[Math.floor(g.cols.length * f)];
            if (!col) continue;
            const s = col.segs.filter(q => q.profit === want).sort((p, q) => (q.b - q.a) - (p.b - p.a))[0];
            if (!s) break;
            const y1 = Math.max(topY + 8, ch.pToY(s.b)), y2 = Math.min(plotBottom - 4, ch.pToY(s.a));
            if (y2 - y1 < 26) continue;
            const yc = (y1 + y2) / 2;
            ctx.font = '600 12px Inter, system-ui, sans-serif';
            const w = ctx.measureText(text).width + 8;
            // the zone can be a narrow band at the right edge (Payoff opens on the current view): keep the label inside it, or leave it out
            if (g.x1 - g.x0 < w + 4) break;
            const cx = Math.max(g.x0 + w / 2 + 2, Math.min(g.x1 - w / 2 - 2, col.x));
            const r = { x: cx - w / 2, y: yc - 9, w, h: 18 };
            if (overlaps(r, taken) || overlaps(r, lineRects, 0)) continue;
            taken.push(r);
            ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(text, cx, yc); ctx.textAlign = 'left';
            break;
          }
        });
        const signAt = labelT > b.nowT ? (P.pnl(b, (g.lo + g.hi) / 2, labelT) > 0 ? 'Profit' : 'Loss') : g.sign;
        if (!g.anyRoot || !rootsAt.length) placePill(ctx, taken, [{ x: nx + 8, y: topY + 50 }, { x: nx + 8, y: topY + 90 }, { x: nx + 8, y: plotBottom - 30 }, { x: nx + 8, y: plotBottom - 56 }, { x: nx + 8, y: (topY + plotBottom) / 2 }, { x: lx - 6, y: plotBottom - 30, align: 'right' }], `${g.anyRoot ? signAt : g.sign} at every level shown${g.anyRoot ? ` ${endWord}` : ''}`, { fg: (g.anyRoot ? signAt : g.sign) === 'Profit' ? css('--up-2') : '#f0828f', bg: 'rgba(16,20,28,.94)', border: '#3a4558' }, ch.plotW);
      }
      // hovered table row: that leg's strike
      if (st.rowHover && st.rowHover.c.type !== 'FUT') {
        const y = Math.round(ch.pToY(st.rowHover.c.strike)) + 0.5;
        if (y > topY && y < ch.mainH) {
          ctx.strokeStyle = '#9fb4d8'; ctx.setLineDash([1.5, 3]); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ch.plotW, y); ctx.stroke(); ctx.setLineDash([]);
          placePill(ctx, taken, [{ x: 8, y: y - 2, valign: 'bottom' }, { x: 8, y: y + 2 }], `${st.rowHover.c.strike} ${st.rowHover.c.type === 'CE' ? 'Call' : 'Put'} strike`, { fg: '#cfdcf4' }, ch.plotW);
        }
      }
      // the hovered or keyboard point
      const pt = st.hover && st.hover.T ? st.hover : null;
      if (pt) dot(ctx, ch.tToX(pt.T), ch.pToY(pt.S), '#ffffff', 3.5);
    }
    labelDisabled(ctx, ch, b, taken);
    drawExitMarkers(ctx, ch, 'idx', taken);
    if (st.pin) {
      const x = ch.tToX(st.pin.T), y = ch.pToY(st.pin.S);
      ctx.strokeStyle = '#ffd98a'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, ch.mainH); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(242,184,75,.25)'; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill();
      dot(ctx, x, y, '#ffd98a', 5);
    }
    ctx.globalAlpha = 1;
  });
  // After drawing, keep the first-run hint clear of the labels just placed.
  idx.on('top', (ctx, ch) => placeHint(ch));
  function drawExitMarkers(ctx, ch, which, taken) {
    st.exits.forEach(x0 => {
      const x = Math.round(ch.tToX(x0.T)) + 0.5;
      if (x < 0 || x > ch.plotW) return;
      ctx.strokeStyle = '#f5a524'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x, ch.o.padTop); ctx.lineTo(x, ch.mainH); ctx.stroke(); ctx.lineWidth = 1;
      const y = ch.mainH * (1 - ch.o.volFrac) - 30;
      const r = placePill(ctx, taken || [], [{ x: x + 5, y }, { x: x - 5, y, align: 'right' }, { x: x + 5, y: y - 30 }], x0.label, { bg: '#3a2a0e', fg: '#ffd98a', border: '#7a5a1c' }, ch.plotW);
      hits[which].push(Object.assign({}, r, { tip: x0.tip }));
    });
  }
  // Crosshair time labels show the exact minute on both charts, so a mirrored crosshair reads the same time
  // whatever each chart's timeframe; in the future zone, the snapped Payoff point (BR-16).
  const minuteLabel = T => E.fmtT(Math.max(0, Math.floor(T)) + 1e-6);
  idx.on('timeLabel', T => { const b = book(); return payoffOn() && pointable(b) && T > b.nowT ? E.fmtT(snapT(T, b)) : minuteLabel(T); });
  // no crosshair over the disabled area
  idx.on('crosshair', (ctx, ch, p) => {
    if (!payoffOn()) return;
    const from = disabledFrom(book());
    if (from != null && ch.xToT(p.x) > from + 1) return false;
  });
  // In the future zone the crosshair snaps to the same 5-point level the readout uses (BR-16).
  idx.on('crossY', (ch, p) => {
    const z = payoffOn() ? zoneAt(ch, p) : null;
    if (z && z.T) return { y: ch.pToY(z.S), label: E.level(z.S) };
    return null;
  });

  /* ---------- option chart overlays (S2) ---------- */
  opt.on('extraRange', ch => {
    const b = book();
    const shown = shownOpt();
    const vals = [];
    st.legs.filter(l => l.c === shown).forEach(l => { const o = st.orders[l.id] || {}; if (o.tp) vals.push(o.tp); if (o.sl) vals.push(o.sl); });
    if (payoffOn() && !isS3() && pointable(b)) {
      const end = axisEnd(b);
      const l = b.legs[0];
      if (l && l.c === shown) {
        vals.push(l.avg);
        const tR = Math.min(end, ch.view.t1);
        // option value is monotonic in the index level, so the index chart's visible range bounds every hoverable point
        const lo = idx.yr ? idx.yr.lo : b.S0 * 0.97, hi = idx.yr ? idx.yr.hi : b.S0 * 1.03;
        for (let k = 0; k <= 6; k++) {
          const T = Math.max(b.nowT + 1, b.nowT + (tR - b.nowT) * k / 6);
          vals.push(P.legValue(l, b.S0, T, b), P.legValue(l, hi, T, b), P.legValue(l, lo, T, b));
        }
        if (st.pin) { const d = P.legDetail(l, st.pin.S, st.pin.T, b); vals.push(d.lo, d.hi); }
      }
    }
    if (!vals.length) return null;
    return [Math.max(0, Math.min(...vals)), Math.max(...vals)];
  });
  opt.on('below', (ctx, ch) => {
    hits.opt = [];
    if (!payoffOn() || isS3()) return;
    const b = book();
    { const from = disabledFrom(b); if (from != null) drawDisabled(ctx, ch, from); }
    if (!pointable(b) && st.pricing !== 'unavailable') return;
    const end = axisEnd(b);
    if (end == null || end <= b.nowT) return;
    const nx = ch.tToX(b.nowT), ex = ch.tToX(end);
    ctx.globalAlpha = alpha();
    ctx.fillStyle = css('--future-tint'); ctx.fillRect(nx, 0, ex - nx, ch.mainH);
    ctx.globalAlpha = 1;
  });
  opt.on('above', (ctx, ch) => {
    const taken = [];
    drawSimMark(ctx, ch, taken);
    const b = book();
    const shown = shownOpt();
    const inPayoff = payoffOn() && !isS3();
    // existing position pills (S1). In Payoff the Paid line takes their place for the held leg.
    st.legs.filter(l => l.c === shown).forEach(l => {
      const o = st.orders[l.id] || {};
      [['tp', 'TP', COL.up], ['sl', 'SL', COL.down]].forEach(([k, lab, colr]) => {
        if (!o[k]) return;
        const yy = Math.round(ch.pToY(o[k])) + 0.5;
        if (yy < ch.o.padTop || yy > ch.mainH) return;
        ctx.strokeStyle = colr; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(ch.plotW, yy); ctx.stroke(); ctx.setLineDash([]);
        taken.push(pill(ctx, ch.plotW - 8, yy, `${lab} ${o[k].toFixed(2)}`, { align: 'right', valign: 'middle', bg: colr, fg: '#fff' }));
      });
      if (inPayoff) return;
      const y = Math.round(ch.pToY(l.avg)) + 0.5;
      if (y < ch.o.padTop || y > ch.mainH) return;
      const p = l.side * l.qty * (ltp(l.c) - l.avg);
      ctx.strokeStyle = l.side > 0 ? 'rgba(11,153,129,.6)' : 'rgba(242,54,69,.6)'; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ch.plotW, y); ctx.stroke(); ctx.setLineDash([]);
      taken.push(pill(ctx, 70, y, `${l.side > 0 ? 'B' : 'S'} ${l.qty} @ ${l.avg.toFixed(2)}  ${E.signed(p)}`, { valign: 'middle', bg: l.side > 0 ? COL.upBg : COL.downBg, fg: '#fff', border: l.side > 0 ? COL.up : COL.down }));
    });
    if (!inPayoff) { drawExitMarkers(ctx, ch, 'opt', taken); return; }
    const end = axisEnd(b);
    if (end == null || end <= b.nowT) return;
    const l = b.legs[0];
    if (!l || l.c !== shown) return;
    ctx.globalAlpha = alpha();
    const stale = st.pricing === 'delayed';
    const nx = ch.tToX(b.nowT), topY = ch.o.padTop, plotBottom = ch.mainH * (1 - ch.o.volFrac);
    markers(b).forEach(m => {
      const x = Math.round(ch.tToX(m.T)) + 0.5;
      if (x < 0 || x > ch.plotW + 1) return;
      ctx.strokeStyle = '#8b95a8'; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x, topY); ctx.lineTo(x, ch.mainH); ctx.stroke(); ctx.setLineDash([]);
    });
    taken.push({ x: 0, y: 0, w: 52, h: 42 });
    if (nx >= 0 && nx <= ch.plotW) {
      ctx.strokeStyle = '#71809a'; ctx.beginPath(); ctx.moveTo(Math.round(nx) + 0.5, topY); ctx.lineTo(Math.round(nx) + 0.5, ch.mainH); ctx.stroke();
      placePill(ctx, taken, [{ x: nx + 5, y: topY + 4 }, { x: nx - 5, y: topY + 4, align: 'right' }, { x: nx + 5, y: topY + 30 }], closed() ? 'Now · last close' : 'Now', { bg: 'rgba(30,36,48,.95)', border: '#3a4558' }, ch.plotW);
    }
    if (st.pricing === 'unavailable') { ctx.globalAlpha = 1; return; }
    // paid / sold at / last price line
    const yP = Math.round(ch.pToY(l.avg)) + 0.5;
    ctx.strokeStyle = '#c9d0dc'; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.moveTo(0, yP); ctx.lineTo(ch.plotW, yP); ctx.stroke(); ctx.setLineDash([]);
    // (the paid-line label is placed after the marker so it can move out of the way)
    // flat case: premium over time if the index stays where it is
    const pts = [];
    for (let x = nx; x <= Math.min(ch.tToX(end), ch.plotW); x += 3) pts.push([x, P.legValue(l, b.S0, Math.min(end, ch.xToT(x)), b)]);
    ctx.strokeStyle = stale ? '#7d8596' : '#a48bff'; ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]); ctx.beginPath();
    pts.forEach(([x, v], i) => i ? ctx.lineTo(x, ch.pToY(v)) : ctx.moveTo(x, ch.pToY(v))); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    // (the flat-case label is placed after the marker, which matters more)
    // marker for the hovered or pinned time; with neither, the current premium at Now
    const pt = livePt(st.pin || (st.hover && st.hover.T ? st.hover : null), b);
    const clampY = y => Math.max(topY + 6, Math.min(plotBottom - 6, y));
    if (pt && (ch.tToX(pt.T) < 0 || ch.tToX(pt.T) > ch.plotW)) {
      // the point is outside this view: no marker, rather than a label pinned to the edge
    } else if (pt) {
      const d = P.legDetail(l, pt.S, pt.T, b);
      const x = ch.tToX(pt.T), yRaw = ch.pToY(d.value), y = clampY(yRaw);
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(x, topY); ctx.lineTo(x, ch.mainH); ctx.stroke(); ctx.setLineDash([]);
      const hasRange = !d.uncertain && d.hi - d.lo >= E.TICK;
      if (hasRange) {
        ctx.strokeStyle = stale ? '#8a92a3' : '#ffd98a'; ctx.lineWidth = 2;
        const yh = clampY(ch.pToY(d.hi)), yl = clampY(ch.pToY(d.lo));
        ctx.beginPath(); ctx.moveTo(x, yh); ctx.lineTo(x, yl); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 5, yh); ctx.lineTo(x + 5, yh); ctx.moveTo(x - 5, yl); ctx.lineTo(x + 5, yl); ctx.stroke();
        ctx.lineWidth = 1;
      }
      dot(ctx, x, y, stale ? '#c0c6d2' : '#ffd98a', 4.5);
      if (yRaw !== y) { ctx.fillStyle = '#ffd98a'; ctx.font = '700 11px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText(yRaw < y ? '▲' : '▼', x, yRaw < y ? y - 10 : y + 12); ctx.textAlign = 'left'; }
      const timeTxt = E.fmtT(pt.T, E.dayOfT(pt.T) !== E.dayOfT(b.nowT) || closed());
      const shownV = b.pretrade ? d.value : heldPrem(l, pt.S, pt.T, b);
      const shownPnl = pointPnl(b, pt.S, pt.T);
      const lines = [`${E.prem(shownV)} at ${timeTxt}`, d.uncertain ? 'Too uncertain to price' : hasRange ? `${E.prem(d.lo)} to ${E.prem(d.hi)}` : null].filter(Boolean);
      const tagTxt = `${E.signed(shownPnl)} on ${l.qty}`;
      // the price box and its P&L tag move together: right of the point, left of it, then below it
      const up4 = [{ dx: 12, align: 'left', up: true }, { dx: -12, align: 'right', up: true }], dn4 = [{ dx: 12, align: 'left', up: false }, { dx: -12, align: 'right', up: false }];
      // when the dot is clamped to the top, put the label below it so it never covers the dot
      const both = yRaw < y ? dn4.concat(up4) : up4.concat(dn4);
      let chosen = null;
      for (const c of both) {
        const box = pill(ctx, x + c.dx, c.up ? y - 10 : y + 10, lines, { align: c.align, valign: c.up ? 'bottom' : 'top', measure: true, clampW: ch.plotW, clampH: [topY, plotBottom - 30] });
        const tag = pill(ctx, x + c.dx, box.y + box.h + 4, tagTxt, { align: c.align, measure: true, clampW: ch.plotW });
        if (!overlaps(box, taken) && !overlaps(tag, taken)) { chosen = c; break; }
      }
      chosen = chosen || both[x + 12 + 200 > ch.plotW ? 1 : 0];
      const box = pill(ctx, x + chosen.dx, chosen.up ? y - 10 : y + 10, lines, { align: chosen.align, valign: chosen.up ? 'bottom' : 'top', bg: 'rgba(23,29,39,.97)', border: '#3a4558', fg: stale ? '#9aa2b2' : '#fff', clampW: ch.plotW, clampH: [topY, plotBottom - 30] });
      taken.push(box, { x: box.x, y: box.y + box.h + 4, w: box.w, h: 22 });
      pill(ctx, x + chosen.dx, box.y + box.h + 4, tagTxt, { align: chosen.align, clampW: ch.plotW, bg: stale ? '#2a303b' : shownPnl >= 0 ? COL.upBg : COL.downBg, fg: stale ? '#9aa2b2' : '#fff', border: stale ? '#3a4558' : shownPnl >= 0 ? COL.up : COL.down });
    } else if (nx >= 0 && nx <= ch.plotW) {
      const cur = ltp(l.c), y = clampY(ch.pToY(cur));
      dot(ctx, nx, y, stale ? '#c0c6d2' : '#ffd98a', 4.5);
      const pnlNow = b.pretrade ? 0 : l.side * l.qty * (cur - l.avg);
      const tagTxt = `${E.signed(pnlNow)} on ${l.qty}`;
      const cands = [{ dx: 12, align: 'left', up: true }, { dx: 12, align: 'left', up: false }, { dx: -12, align: 'right', up: true }, { dx: -12, align: 'right', up: false }];
      let ch0 = cands.find(c => { const bx = pill(ctx, nx + c.dx, c.up ? y - 10 : y + 10, `${E.prem(cur)} now`, { align: c.align, valign: c.up ? 'bottom' : 'top', measure: true, clampW: ch.plotW, clampH: [topY + 26, plotBottom - 30] }); const tg = { x: bx.x, y: bx.y + bx.h + 4, w: bx.w + 30, h: 22 }; return !overlaps(bx, taken) && (b.pretrade || !overlaps(tg, taken)); }) || cands[0];
      const box = pill(ctx, nx + ch0.dx, ch0.up ? y - 10 : y + 10, `${E.prem(cur)} now`, { align: ch0.align, valign: ch0.up ? 'bottom' : 'top', bg: 'rgba(23,29,39,.97)', border: '#3a4558', fg: stale ? '#9aa2b2' : '#fff', clampH: [topY + 26, plotBottom - 30], clampW: ch.plotW });
      taken.push(box);
      if (!b.pretrade) taken.push(pill(ctx, nx + ch0.dx, box.y + box.h + 4, tagTxt, { align: ch0.align, bg: stale ? '#2a303b' : pnlNow >= 0 ? COL.upBg : COL.downBg, fg: stale ? '#9aa2b2' : '#fff', border: stale ? '#3a4558' : pnlNow >= 0 ? COL.up : COL.down, clampW: ch.plotW }));
    }
    if (pts.length > 2) { const [lx, lv] = pts[pts.length - 1]; placePill(ctx, taken, [{ x: lx - 4, y: ch.pToY(lv) - 6, align: 'right', valign: 'bottom' }, { x: lx - 4, y: ch.pToY(lv) + 6, align: 'right' }], `If Nifty stays at ${E.level(b.S0)}`, { fg: stale ? '#9aa2b2' : '#cbbcff', clampH: [topY, plotBottom], required: false }, ch.plotW); }
    const paidTxt = b.pretrade ? `Last price ${E.prem(l.avg)}` : l.side > 0 ? `Paid ${E.prem(l.avg)}` : `Sold at ${E.prem(l.avg)}`;
    placePill(ctx, taken, [{ x: 8, y: yP + 4 }, { x: 8, y: yP - 4, valign: 'bottom' }, { x: 60, y: yP + 4 }, { x: 60, y: yP - 4, valign: 'bottom' }, { x: ch.plotW * 0.5, y: yP + 4 }], paidTxt, { fg: '#e9ecf1' }, ch.plotW);
    drawExitMarkers(ctx, ch, 'opt', taken);
    ctx.globalAlpha = 1;
  });
  opt.on('timeLabel', T => minuteLabel(T));

  /* ---------- pointer and keyboard on the index chart ---------- */
  const snapT = (T, b) => { const end = axisEnd(b); return Math.max(firstT(b), Math.min(end, Math.round(T / step()) * step())); };
  const snapS = S => Math.round(S / 5) * 5;
  const clampS = S => Math.max(snapS(idx.yr.lo + 5), Math.min(snapS(idx.yr.hi - 5), S));
  function zoneAt(ch, p) {
    if (!payoffOn()) return null;
    const b = book();
    if (!pointable(b)) return null;
    const end = axisEnd(b);
    if (p.x > ch.plotW || p.y > ch.mainH || p.y < ch.o.padTop - 6) return null;
    const T = ch.xToT(p.x);
    if (T <= b.nowT) return { past: true };
    if (T > end + 1.5) return null;
    return { T: snapT(T, b), S: snapS(ch.yToP(p.y)) };
  }
  function markHinted(z) {
    if (!z || !z.T || st.hinted) return;
    st.hinted = true; LS.set('hinted', true);
    const hn = $('#hint'); if (hn) hn.remove();
  }
  let pinDrag = null;
  idx.on('hover', (ch, p) => {
    const hit = hits.idx.find(h => p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h);
    if (hit) showCanvasTip(ch, hit); else hideTip('canvas');
    const z = zoneAt(ch, p);
    if (pinDrag) {
      if (z && z.T && (z.T !== st.pin.T || z.S !== st.pin.S)) { st.pin = z; pinDrag.moved = true; scheduleD1(); }
    }
    st.keyPt = null;
    st.hover = z;
    markHinted(z);
    if (z && z.T) sampleHover(z);
    if (st.pin) {
      const px = ch.tToX(st.pin.T), py = ch.pToY(st.pin.S);
      ch.cv.style.cursor = Math.hypot(p.x - px, p.y - py) < 10 ? 'grab' : (z && z.T && st.later ? 'pointer' : '');
    } else ch.cv.style.cursor = z && z.T && st.later ? 'crosshair' : '';
    updateReadout(p);
    mirrorFromIdx(p);
    opt.invalidate();
    renderTable();
  });
  idx.on('leave', () => { st.hover = null; hideTip('canvas'); updateReadout(null); opt.setGhost(null); opt.invalidate(); renderTable(); });
  idx.on('down', (ch, p) => {
    if (st.pin) {
      const px = ch.tToX(st.pin.T), py = ch.pToY(st.pin.S);
      if (Math.hypot(p.x - px, p.y - py) < 10) { pinDrag = { moved: false }; return false; }
    }
  });
  window.addEventListener('mouseup', () => { if (pinDrag) { if (pinDrag.moved) log('payoff_pin_move'); pinDrag = null; renderD1(); renderTable(); } });
  let d1Raf = 0;
  function scheduleD1() { if (d1Raf) return; d1Raf = requestAnimationFrame(() => { d1Raf = 0; renderD1(); renderTable(); }); }
  idx.on('click', (ch, p) => {
    if (!st.later) return;
    const z = zoneAt(ch, p);
    if (!z || !z.T) return;
    placePin(z);
  });
  // Each chart scrolls and zooms on its own (the two can be on different timeframes).
  idx.on('viewchange', (ch, dragging, byUser) => {
    if (byUser && st.range.idx) { st.range.idx = null; renderTf(); }
    if (ch.pointer) mirrorFromIdx(ch.pointer);
    if (!payoffOn()) return;
    if (byUser && st.horizon) { st.horizon = null; renderStrip(book()); }
    if (!dragging) cache = null;
    // the point under a still pointer changes when the view moves
    if (ch.pointer && !pinDrag) { st.hover = zoneAt(ch, ch.pointer); updateReadout(ch.pointer); opt.invalidate(); renderTable(); }
    renderD1();
  });
  opt.on('viewchange', (ch, dragging, byUser) => { if (byUser && st.range.opt) { st.range.opt = null; renderTf(); } if (ch.pointer) mirrorFromOpt(ch.pointer); });
  opt.on('hover', (ch, p) => {
    const hit = hits.opt.find(h => p.x >= h.x && p.x <= h.x + h.w && p.y >= h.y && p.y <= h.y + h.h);
    if (hit) showCanvasTip(ch, hit); else hideTip('canvas');
    mirrorFromOpt(p);
  });
  opt.on('leave', () => { hideTip('canvas'); idx.setGhost(null); });

  /* ---------- mirrored crosshair (BR-28) ---------- */
  // Hovering one chart mirrors the crosshair onto the other: the same minute, whatever either chart's timeframe,
  // and the matching level. Up to Now, the option level is the option's real price at that minute, moved by what
  // the model says it gains or loses between Nifty's actual level then and the hovered one. After Now, with Payoff
  // on, it is the Payoff value; with Payoff off, the future gets the time line only. The other chart scrolls to
  // keep the mirrored time in view, at its own zoom.
  const mirrorOn = () => !!shownOpt() && !(payoffOn() && isS3());
  const roundLvl = (c, v) => c.type === 'FUT' ? v : Math.max(E.TICK, E.roundTick(v));
  // The option's actual price and Nifty's actual level at the same instant T (at Now: the live values).
  function actualsAt(c, T, b) {
    if (T >= b.nowT - 0.01) return { o: ltp(c), s: b.S0 };
    return { o: E.optionAt(c, T), s: E.pathAt(T) };
  }
  // After Now there is a level only where Payoff has a point: Payoff on, prices loading, inside the axis end.
  const futureOk = (T, b) => payoffOn() && pointable(b) && !blocked(T, b);
  const blocked = (T, b) => { if (!payoffOn()) return false; const from = disabledFrom(b); return from != null && T > from + 1; };
  function optLevel(c, T, S) {
    const b = book();
    if (T <= b.nowT) { const a = actualsAt(c, T, b); return roundLvl(c, a.o + E.price(c, S, T) - E.price(c, a.s, T)); }
    if (!futureOk(T, b)) return null;
    // the same value the option chart's Payoff marker shows
    const l = b.legs[0];
    if (!isS3() && l && l.c === c) return b.pretrade ? P.legDetail(l, S, T, b).value : heldPrem(l, S, T, b);
    return roundLvl(c, E.price(c, S, T));
  }
  // The Nifty level that gives option price P at time T (option value is monotonic in the index level).
  function idxLevel(c, T, P) {
    const b = book();
    let target;
    if (T <= b.nowT) { const a = actualsAt(c, T, b); target = P - a.o + E.price(c, a.s, T); }
    else if (!futureOk(T, b)) return null;
    else target = P;
    if (c.type === 'FUT') return target;
    const f = S => E.price(c, S, T) - target;
    let lo = b.S0 * 0.7, hi = b.S0 * 1.3, flo = f(lo), fhi = f(hi);
    if (flo * fhi > 0) return Math.abs(flo) < Math.abs(fhi) ? lo : hi;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2, fm = f(mid); if (fm * flo > 0) { lo = mid; flo = fm; } else hi = mid; }
    return (lo + hi) / 2;
  }
  // Keep the mirrored time in the other chart's view: shift it the least needed, at its own zoom.
  // Scrolls only when the minute is outside the view, then leaves an 8% margin.
  function follow(ch, which, T) {
    const v = ch.view, span = v.t1 - v.t0, m = span * 0.08;
    if (T >= v.t0 && T <= v.t1) return;
    const t0 = T < v.t0 ? T - m : T + m - span;
    const [a, c] = ch.clampView(t0, t0 + span);
    if (Math.abs(a - v.t0) < 1e-6) return;
    ch.setView(a, c);
    ch.computeY();
    if (st.range[which]) { st.range[which] = null; renderTf(); }
    if (which === 'idx') {
      if (st.horizon) { st.horizon = null; renderStrip(book()); }
      if (payoffOn()) { updateReadout(null); renderD1(); }
    }
  }
  function mirrorPoint(T, S, noFollow) {
    const c = shownOpt();
    T = Math.max(0, T);
    if (!mirrorOn() || blocked(T, book())) { opt.setGhost(null); return; }
    const lvl = S == null ? null : optLevel(c, T, S);
    if (!noFollow) follow(opt, 'opt', T);
    opt.setGhost({ T, p: lvl, label: lvl == null ? null : lvl.toFixed(2) });
  }
  function mirrorFromIdx(p, noFollow) {
    if (!p || p.x > idx.plotW || p.y > idx.h - idx.o.timeH) { opt.setGhost(null); return; }
    // in the future zone, the same snapped point the readout uses (BR-16)
    const z = payoffOn() ? zoneAt(idx, p) : null;
    if (z && z.T) mirrorPoint(z.T, z.S, noFollow);
    else mirrorPoint(idx.xToT(p.x), p.y <= idx.mainH ? idx.yToP(p.y) : null, noFollow);
  }
  function mirrorFromOpt(p, noFollow) {
    if (!p || !mirrorOn() || p.x > opt.plotW || p.y > opt.h - opt.o.timeH) { idx.setGhost(null); return; }
    const T = Math.max(0, opt.xToT(p.x));
    if (blocked(T, book())) { idx.setGhost(null); return; }
    const S = p.y <= opt.mainH ? idxLevel(shownOpt(), T, opt.yToP(p.y)) : null;
    if (!noFollow) follow(idx, 'idx', T);
    idx.setGhost({ T, p: S, label: S == null ? null : S.toFixed(2) });
  }
  // After data, a tick, Payoff or the clock change, recompute the mirror for wherever the pointer is.
  // Never scrolls: only real pointer moves and arrow keys do. Scales first, since a data change can rescale a chart.
  function refreshMirror() {
    idx.computeY(); opt.computeY();
    if (idx.pointer) mirrorFromIdx(idx.pointer, true);
    else if (st.keyPt && payoffOn() && document.activeElement === idx.cv && !opt.pointer) mirrorPoint(st.keyPt.T, st.keyPt.S, true);
    else opt.setGhost(null);
    if (opt.pointer) mirrorFromOpt(opt.pointer, true); else idx.setGhost(null);
  }
  // Keyboard: focusing the chart puts the point one candle after Now at the current level (PRD S2/S3).
  $('#idxCanvas').addEventListener('blur', () => { if (!idx.pointer) opt.setGhost(null); });
  $('#idxCanvas').addEventListener('focus', () => {
    if (!payoffOn() || st.pin || st.keyPt || !$('#idxCanvas').matches(':focus-visible')) return;
    const b = book();
    if (!pointable(b)) return;
    st.keyPt = st.hover = { T: firstT(b), S: snapS(b.S0) };
    updateReadout(null); mirrorPoint(st.keyPt.T, st.keyPt.S); idx.invalidate(); opt.invalidate(); renderTable();
  });

  let sampleT = 0;
  function sampleHover(z) {
    const now = performance.now();
    if (now - sampleT < 2500) return;
    sampleT = now;
    const b = book();
    log('payoff_hover', `sampled tte=${((axisEnd(b) - z.T) / E.SESSION).toFixed(1)}d dist=${Math.round(z.S - b.S0)}`);
  }
  function placePin(z) {
    if (!st.later || !pointable(book()) || !z || !z.T) return;
    const first = !st.pin;
    st.pin = { T: z.T, S: z.S };
    log(first ? 'payoff_pin_place' : 'payoff_pin_move');
    renderUI();
    idx.invalidate(); opt.invalidate();
    if (first) setTimeout(() => focusNS($('#d1 [data-act]') || $('#d1x')), 30);
  }
  function removePin(returnFocus = true) {
    if (!st.pin) return;
    const was = st.pin;
    log('payoff_pin_close');
    setPayoff(() => { st.pin = null; }, 'pin');
    if (payoffOn()) { st.keyPt = st.hover = { T: was.T, S: was.S }; updateReadout(null); mirrorPoint(was.T, was.S); idx.invalidate(); opt.invalidate(); renderTable(); }
    if (returnFocus) focusNS($(payoffOn() ? '#idxCanvas' : '#payoffBtn'));
  }

  function moveKeyPoint(dx, dy) {
    const b = book();
    if (!pointable(b)) return;
    const end = axisEnd(b);
    // With a pin placed, the arrow keys move the pin (D1); otherwise they move the focused point.
    const seed = { T: firstT(b) - step(), S: snapS(b.S0) };
    const base = st.pin || st.keyPt || (st.hover && st.hover.T ? st.hover : null);
    const from = base || seed;
    let T = Math.round((from.T + dx * step()) / step()) * step();
    if (!base && dx === 0) T = firstT(b);
    T = Math.max(firstT(b), Math.min(end, T));
    // pan first, then change the level only for Up/Down, within the visible range
    keepPointInView({ T, S: from.S });
    idx.computeY();
    const pt = { T, S: dy ? clampS(from.S + dy) : from.S };
    if (st.pin) {
      st.pin = pt; st.keyPt = st.hover = null; log('payoff_pin_move');
      announce(`pin:${T}:${pt.S}`, `Pinned. Nifty ${E.level(pt.S)} · ${E.fmtT(T)}. P&L ${E.signed(pointPnl(b, pt.S, T))}.`);
    } else { st.keyPt = pt; st.hover = pt; }
    markHinted(pt);
    updateReadout(null);
    mirrorPoint(pt.T, pt.S);
    idx.invalidate(); opt.invalidate(); renderTable(); renderD1();
  }
  function keepPointInView(pt) {
    const v = idx.view, span = v.t1 - v.t0;
    if (pt.T > v.t1 - span * 0.04 || pt.T < v.t0) { idx.setView(...idx.clampView(pt.T - span * 0.7, pt.T + span * 0.3)); st.horizon = null; st.range.idx = null; renderTf(); renderStrip(book()); }
  }

  /* ---------- hold-to-peek and other keys ---------- */
  let altDown = false, peekTimer = null;
  const typing = t => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  const ARROWS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 5], ArrowDown: [0, -5] };
  window.addEventListener('keydown', e => {
    if (e.key === 'Alt') {
      e.preventDefault(); // stops Windows from moving focus to the browser menu
      if (e.repeat || typing(e.target) || e.metaKey || e.ctrlKey || e.shiftKey || st.m1) return;
      altDown = true;
      clearTimeout(peekTimer);
      peekTimer = setTimeout(() => { peekTimer = null; if (!altDown || st.m1) return; dismissCoach(true); if (!st.peek) setPayoff(() => { st.peek = true; }, 'key'); }, 140);
      return;
    }
    // any other key while Alt is down makes it a shortcut, not a peek
    if (altDown && peekTimer && !ARROWS[e.key] && e.key !== 'Enter') { clearTimeout(peekTimer); peekTimer = null; }
    // A modal confirm takes all keyboard input; only Esc (and its own Tab trap) apply.
    if (st.m1) { if (e.key === 'Escape') onEsc(e); return; }
    if (e.altKey && (e.metaKey || e.ctrlKey) && e.code === 'Digit1') { e.preventDefault(); cancelPeek(); toggleTap(); return; }
    if (altDown && e.altKey) {
      if (ARROWS[e.key] && st.peek) { e.preventDefault(); const [dx, dy] = ARROWS[e.key]; moveKeyPoint(dx, dy * (e.shiftKey ? 5 : 1)); return; }
      if (e.key === 'Enter' && st.peek) { e.preventDefault(); enterAtPoint(); return; }
      if (e.key !== 'Shift') cancelPeek();
      return;
    }
    if (e.key === 'Escape') { onEsc(e); return; }
    if (typing(e.target)) return;
    if (payoffOn() && document.activeElement === $('#idxCanvas')) {
      if (ARROWS[e.key]) { e.preventDefault(); const [dx, dy] = ARROWS[e.key]; moveKeyPoint(dx, dy * (e.shiftKey ? 5 : 1)); return; }
      if (e.key === 'Enter') { e.preventDefault(); enterAtPoint(); }
    }
  });
  // Enter pins the focused point, or moves focus into the card when a pin is already placed.
  function enterAtPoint() {
    if (!st.later) return;
    if (st.pin) { focusNS($('#d1 [data-act]') || $('#d1x')); return; }
    const b = book();
    if (!pointable(b)) return;
    placePin(st.keyPt || (st.hover && st.hover.T ? st.hover : { T: firstT(b), S: snapS(b.S0) }));
  }
  window.addEventListener('keyup', e => {
    if (e.key === 'Alt') { e.preventDefault(); altDown = false; clearTimeout(peekTimer); peekTimer = null; if (st.peek) setPayoff(() => { st.peek = false; }, 'key'); }
  });
  window.addEventListener('blur', () => { altDown = false; clearTimeout(peekTimer); peekTimer = null; if (st.peek) setPayoff(() => { st.peek = false; }, 'key'); });
  function cancelPeek() { if (st.peek) setPayoff(() => { st.peek = false; }, 'key'); }
  function onEsc(e) {
    if (tfMenu) { e.preventDefault(); closeTfMenu(true); return; }
    if (st.m1) { if (st.m1.submitting) return; e.preventDefault(); closeM1(); return; }
    if (st.popover) { closePopover(); return; }
    if (st.pin) { e.preventDefault(); removePin(); return; }
    if (coachOpen()) { dismissCoach(); return; }
    if (st.sticky) { setPayoff(() => { st.sticky = false; }, 'esc'); focusNS($('#payoffBtn')); }
  }

  /* ---------- toolbar, buttons ---------- */
  // One click turns Payoff off whenever the button shows pressed (kept on, or held on by a pin).
  $('#payoffBtn').addEventListener('click', () => {
    dismissCoach(true);
    const on = st.sticky || !!st.pin;
    setPayoff(() => { if (on) { st.sticky = false; clearPin('button'); } else st.sticky = true; }, 'button');
  });
  function toggleTap() { st.oneTap = !st.oneTap; renderUI(); refreshTip(); toast('ok', st.oneTap ? '1-Tap is on. Orders go out instantly.' : '1-Tap is off.'); }
  $('#tapBtn').addEventListener('click', toggleTap);
  $('#qMinus').addEventListener('click', () => { st.lots = Math.max(1, st.lots - 1); cache = null; renderUI(); });
  $('#qPlus').addEventListener('click', () => { st.lots = Math.min(20, st.lots + 1); cache = null; renderUI(); });
  $('#buyBtn').addEventListener('click', () => trade(1));
  $('#sellBtn').addEventListener('click', () => trade(-1));
  $('#cpSwitch').addEventListener('click', () => {
    const c = shownOpt();
    if (!c || c.type === 'FUT') return;
    if (heldSingle()) { toast('ok', 'Payoff shows your position. Turn Payoff off to switch Call and Put.'); return; }
    st.opt = C(c.type === 'CE' ? 'PE' : 'CE', c.strike, c.expKey);
    cache = null; rebuildData(); if (payoffOn()) refit(book());
  });
  $('#railPositions').addEventListener('click', () => openPopover('positions'));
  $('#navPositions').addEventListener('click', () => openPopover('positions'));
  $('#pnlPill').addEventListener('click', () => openPopover('positions'));
  $('#railChain').addEventListener('click', () => openPopover('chain'));
  /* ---------- timeframes and ranges (each chart has its own) ---------- */
  // Nifty can be on 3m while the option is on 5m. The chevron on 15m opens the longer timeframes.
  const MORE_TF = [[15, '15 minutes', '15m'], [30, '30 minutes', '30m'], [60, '1 hour', '1h']];
  const chartOf = which => which === 'idx' ? idx : opt;
  function renderTf() {
    document.querySelectorAll('.tfs').forEach(g => {
      const tf = st.tf[g.dataset.chart];
      g.querySelectorAll('[data-tf]').forEach(bt => { const on = +bt.dataset.tf === tf; bt.classList.toggle('on', on); bt.setAttribute('aria-pressed', on); });
      const more = g.querySelector('[data-more]'), m = MORE_TF.find(x => x[0] === tf);
      more.classList.toggle('on', !!m);
      more.querySelector('.lbl').textContent = m ? m[2] : '15m';
      more.setAttribute('aria-label', m ? `Timeframe ${m[1]}. More timeframes` : 'More timeframes');
    });
    document.querySelectorAll('.rgs').forEach(g => g.querySelectorAll('[data-range]').forEach(bt => {
      const on = st.range[g.dataset.chart] === bt.dataset.range;
      bt.classList.toggle('on', on); bt.setAttribute('aria-pressed', on);
    }));
  }
  // A new timeframe keeps the candle width, so the window grows or shrinks with the candle size, anchored at its
  // right edge. With a range preset picked (1D, 5D, 1M) the window stays on that range.
  function setTf(which, tf) {
    const ch = chartOf(which), prev = st.tf[which];
    if (prev === tf) return;
    st.tf[which] = tf; LS.set('tf', st.tf); ch.o.tf = tf;
    cache = null; rebuildData();
    if (st.range[which]) applyRange(ch, st.range[which]);
    else {
      const v = ch.view, span = (v.t1 - v.t0) * tf / prev;
      ch.setView(...ch.clampView(v.t1 - span, v.t1));
      if (which === 'idx' && st.horizon) { st.horizon = null; renderStrip(book()); }
    }
    renderTf();
    refreshMirror();
  }
  document.querySelectorAll('.tfs [data-tf]').forEach(bt => bt.addEventListener('click', () => setTf(bt.closest('.tfs').dataset.chart, +bt.dataset.tf)));
  let tfMenu = null;
  function closeTfMenu(focusBack) {
    if (!tfMenu) return;
    const { el, btn } = tfMenu;
    tfMenu = null; el.remove(); btn.setAttribute('aria-expanded', 'false');
    if (focusBack) focusNS(btn);
  }
  function openTfMenu(btn) {
    closeTfMenu();
    const which = btn.closest('.tfs').dataset.chart;
    const el = document.createElement('div');
    el.className = 'tfmenu'; el.setAttribute('role', 'menu'); el.setAttribute('aria-label', 'More timeframes');
    el.innerHTML = MORE_TF.map(([tf, long, short]) => `<button type="button" role="menuitemradio" aria-checked="${st.tf[which] === tf}" data-tf="${tf}"><span>${long}</span><span class="k">${short}</span></button>`).join('');
    document.body.appendChild(el);
    const r = btn.getBoundingClientRect();
    el.style.left = Math.max(8, Math.min(innerWidth - el.offsetWidth - 8, r.left)) + 'px';
    el.style.top = (r.bottom + 4) + 'px';
    btn.setAttribute('aria-expanded', 'true');
    tfMenu = { el, btn };
    const items = [...el.querySelectorAll('button')];
    items.forEach(b => b.addEventListener('click', () => { closeTfMenu(true); setTf(which, +b.dataset.tf); }));
    el.addEventListener('keydown', e => {
      const k = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); focusNS(items[(k + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]); }
      else if (e.key === 'Tab') closeTfMenu();
    });
    focusNS(el.querySelector('[aria-checked="true"]') || items[0]);
  }
  document.querySelectorAll('.tfs [data-more]').forEach(bt => bt.addEventListener('click', e => { e.stopPropagation(); if (tfMenu && tfMenu.btn === bt) closeTfMenu(true); else openTfMenu(bt); }));
  document.addEventListener('mousedown', e => { if (tfMenu && !tfMenu.el.contains(e.target) && !tfMenu.btn.contains(e.target)) closeTfMenu(); });
  window.addEventListener('resize', () => closeTfMenu());
  // 1D, 5D and 1M show the last session, the last five, or all the data, up to Now.
  document.querySelectorAll('.rgs [data-range]').forEach(bt => bt.addEventListener('click', () => {
    const which = bt.closest('.rgs').dataset.chart;
    st.range[which] = bt.dataset.range;
    applyRange(chartOf(which), st.range[which]);
    if (which === 'idx' && st.horizon) { st.horizon = null; renderStrip(book()); }
    cache = null; renderTf(); renderUI(); refreshMirror();
  }));
  renderTf();

  // The order buttons always trade the contract named in the header beside them.
  function trade(side) {
    const c = shownOpt();
    if (!c) { toast('err', 'Pick a contract from the option chain first.'); return; }
    if (closed()) { toast('err', `Market closed. Orders open at 9:15 am on ${E.DAYS[E.TODAY + 1].label}.`); return; }
    if (expired(c)) { toast('err', `${c.label} has expired.`); return; }
    const qty = st.lots * E.LOT, px = ltp(c);
    const before = snapshot();
    // BR-02: fills in the same contract merge into one position at the average price.
    const ex = st.legs.find(l => l.c === c);
    if (ex && ex.side !== side) {
      const q = Math.min(ex.qty, qty);
      st.realised += ex.side * q * (px - ex.avg);
      ex.qty -= q;
      if (ex.qty === 0) st.legs = st.legs.filter(l => l !== ex);
      if (qty > q) st.legs.push(leg(c, side, px, 'INTRADAY', qty - q));
    } else if (ex) {
      ex.avg = (ex.avg * ex.qty + px * qty) / (ex.qty + qty); ex.qty += qty;
    } else st.legs.push(leg(c, side, px, 'INTRADAY', qty));
    toast('ok', `${side > 0 ? 'Bought' : 'Sold'} ${qty} ${c.label} at ${E.prem(px)}`);
    cache = null;
    afterPositionsChange(before);
  }
  const snapshot = () => ({ s3: isS3(), end: axisEnd(book()), on: payoffOn() });
  function afterPositionsChange(before) {
    pruneOrders();
    if (st.pin && isS3() !== before.s3) clearPin('positions');
    const b = book();
    if (before.on && payoffOn()) {
      if (st.horizon && !horizons(b).some(h => h.key === st.horizon)) st.horizon = null;
      if (axisEnd(b) !== before.end || isS3() !== before.s3) refit(b);
    }
    if (st.m1) renderM1();
    rebuildData();
  }
  function exitLeg(id) {
    const before = snapshot();
    const l = st.legs.find(x => x.id === id);
    if (l) { st.realised += l.side * l.qty * (ltp(l.c) - l.avg); st.legs = st.legs.filter(x => x !== l); toast('ok', `Exited ${l.c.label}`); }
    const o = st.others.find(x => x.id === id);
    if (o) { st.realisedOther += o.side * o.qty * (o.ltp - o.avg); st.others = st.others.filter(x => x !== o); toast('ok', `Exited ${o.label}`); }
    cache = null;
    afterPositionsChange(before);
    if (st.popover === 'positions') renderPopover();
  }

  /* ---------- readout ---------- */
  function readoutModel(pt) {
    const b = book();
    const s3 = isS3();
    const T = pt.T, S = pt.S;
    // The level shows on the price-axis crosshair, so the card leads with the time and the P&L.
    const out = { head: E.fmtT(T), level: `Nifty ${E.level(S)}` };
    out.pnl = P.pnl(b, S, T); out.label = s3 ? 'Total P&L' : 'P&L';
    if (!s3 && b.legs.length === 1) {
      const d = P.legDetail(b.legs[0], S, T, b);
      if (d.uncertain) out.unc = `Too uncertain to price. Time value left: ${E.prem(d.timeValue)}. Worth at expiry at this level: ${E.prem(d.intrinsic)}`;
      else out.range = Math.abs(d.pnlHi - d.pnlLo) < 1 ? null : `Range ${E.signed(d.pnlLo)} to ${E.signed(d.pnlHi)}`;
    } else {
      const [lo, hi] = P.range(b, S, T);
      out.range = Math.abs(hi - lo) < 1 ? null : `Range ${E.signed(lo)} to ${E.signed(hi)}`;
    }
    return out;
  }
  // Current P&L at Now: the same figure the platform shows (from last prices, no projections, BR-13).
  const pnlNow = b => b.pretrade ? 0 : b.legs.reduce((a, l) => a + l.side * l.qty * (ltp(l.c) - l.avg), 0);
  let liveTimer = null, lastLive = '';
  function announce(key, text) {
    if (key === lastLive) return;
    lastLive = key;
    clearTimeout(liveTimer);
    liveTimer = setTimeout(() => { if (payoffOn()) $('#live').textContent = text; }, 700);
  }
  function updateReadout(p) {
    const wrap = $('#idxWrap');
    let ro = $('#readout');
    const b = book();
    const z = st.hover;
    if (!payoffOn() || !pointable(b) || (st.pin && (!z || z.past))) { if (ro) ro.remove(); return; }
    if (!ro) { ro = document.createElement('div'); ro.id = 'readout'; ro.className = 'readout'; wrap.appendChild(ro); }
    ro.classList.toggle('stale', st.pricing === 'delayed');
    const ch = idx;
    let html, x, y, docked = false;
    const q = p || idx.pointer;
    if (performance.now() < st.loadingUntil) {
      setHTML(ro, `<div class="h">${isS3() ? 'Pricing your positions…' : 'Pricing your position…'}</div>`);
      const d0 = dockRect(ch, b, ro); ro.style.left = d0.x + 'px'; ro.style.top = d0.y + 'px';
      return;
    }
    if (!z || z.past || !livePt(z, b)) {
      // Pointer over past candles, outside the zone, or off the chart: show Now values (BR-13).
      const n = pnlNow(b);
      const label = b.pretrade ? 'Not holding' : isS3() ? 'Total P&L' : 'P&L';
      html = `<div class="h">Now · ${esc(E.fmtT(b.nowT))}</div>` + (b.pretrade
        ? `<div class="p num"><small>Last price</small>${E.prem(b.legs[0].avg)}</div>`
        : `<div class="p num ${n >= 0 ? 'up' : 'down'}"><small>${label}</small>${E.signed(n)}</div>`) + `<div class="ft">Model estimate, not a forecast</div>`;
      if (z && z.past && q) { x = q.x; y = q.y; } else docked = true;
      if (z && z.past) announce('now', `Now. ${b.pretrade ? 'Not holding' : `${label} ${E.signed(n)}`}.`);
    } else {
      const m = readoutModel(z);
      m.pnl = pointPnl(b, z.S, z.T);
      html = `<div class="h num">${esc(m.head)}</div><div class="p num ${m.pnl >= 0 ? 'up' : 'down'}"><small>${m.label}</small>${E.signed(m.pnl)}</div>` +
        (m.unc ? `<div class="u">${esc(m.unc)}</div>` : m.range ? `<div class="r num">${esc(m.range)}</div>` : '') +
        `<div class="ft">Model estimate, not a forecast</div>`;
      announce(`${z.T}:${z.S}`, [`${m.level} · ${m.head}`, `${m.label} ${E.signed(m.pnl)}`, m.unc || m.range].filter(Boolean).join('. ') + '.');
      x = p ? p.x : ch.tToX(z.T); y = p ? p.y : ch.pToY(z.S);
    }
    setHTML(ro, html);
    const w = ro.offsetWidth, h = ro.offsetHeight;
    let lx, ly;
    if (docked) {
      const d0 = dockRect(ch, b, ro);
      lx = d0.x; ly = d0.y;
    } else {
      lx = x + 18; ly = y + 18;
      if (lx + w > ch.plotW - 4) lx = x - 18 - w;
      if (ly + h > ch.mainH - 4) ly = y - 18 - h;
    }
    ro.style.left = Math.max(4, lx) + 'px'; ro.style.top = Math.max(ch.o.padTop, ly) + 'px';
  }

  // Where the resting Now readout docks: beside the Now line, over past candles where possible, inside the plot.
  function dockRect(ch, b, ro) {
    const w = ro ? ro.offsetWidth || 236 : 236, h = ro ? ro.offsetHeight || 86 : 86;
    const nx = ch.tToX(b.nowT);
    let x = nx - 10 - w >= 4 ? nx - 10 - w : nx + 10;
    x = Math.max(4, Math.min(ch.plotW - w - 4, x));
    return { x, y: ch.o.padTop + 36, w, h };
  }
  const docking = b => payoffOn() && pointable(b) && !st.pin && !livePt(st.hover, b);

  /* ---------- UI render ---------- */
  // Height of the band the banner covers at the top of the chart areas, in unscaled px.
  function bannerBand() {
    const n2 = $('#n2');
    if (!bannerShown() || !n2) return 0;
    const app = $('#app'), k = app.getBoundingClientRect().width / app.offsetWidth || 1;
    return Math.ceil((n2.getBoundingClientRect().bottom - $('#idxWrap').getBoundingClientRect().top) / k) + 4;
  }
  const bannerShown = () => { const k = payoffOn() ? bannerKind() : null; return !!k && !(k === 'closed' && st.closedBannerHidden); };
  function renderUI() {
    const b = book();
    const on = payoffOn();
    const S = S0();
    const chg = S - E.PREV_CLOSE;
    const chgTxt = `${chg >= 0 ? '+' : '−'}${Math.abs(chg).toFixed(2)} (${(Math.abs(chg) / E.PREV_CLOSE * 100).toFixed(2)}%)`;
    ['#topIdx', '#idxLtp'].forEach(s => { $(s).textContent = S.toFixed(2); });
    ['#topChg', '#idxChg'].forEach(s => { $(s).textContent = chgTxt; $(s).className = (s === '#topChg' ? 'chg ' : 'sub ') + 'num ' + (chg >= 0 ? 'up' : 'down'); });
    const c = shownOpt();
    if (c) {
      const lp = ltp(c), pc = optPrevClose(c), oc = lp - pc;
      $('#optTitle').textContent = c.type === 'FUT' ? c.label : `NIFTY ${c.exp.info.short} ${c.strike}`;
      $('#optType').textContent = c.type === 'FUT' ? '' : c.type === 'CE' ? 'Call' : 'Put';
      $('#optLtp').textContent = lp.toFixed(2);
      $('#optChg').textContent = `${oc >= 0 ? '+' : '−'}${Math.abs(oc).toFixed(2)} (${(Math.abs(oc) / pc * 100).toFixed(2)}%)`;
      $('#optChg').className = 'sub num ' + (oc >= 0 ? 'up' : 'down');
      // say when a price isn't from the real data
      $('#optSrc').textContent = !E.isReal(c) ? 'Modelled prices' : nowT() > E.REAL_END_T ? `Simulated after ${E.clock(REAL_END_MOD)}` : '';
    } else { $('#optTitle').textContent = 'No contract loaded'; $('#optType').textContent = ''; $('#optLtp').textContent = ''; $('#optChg').textContent = ''; $('#optSrc').textContent = ''; }
    $('#qVal').textContent = st.lots * E.LOT; $('#qLots').textContent = `${st.lots} Lot${st.lots > 1 ? 's' : ''}`;
    const open = st.legs.reduce((a, l) => a + l.side * l.qty * (ltp(l.c) - l.avg), 0) + st.others.reduce((a, o) => a + o.side * o.qty * (o.ltp - o.avg), 0);
    const tot = open + st.realised + st.realisedOther;
    $('#pnlTop').textContent = (tot > 0 ? '+' : tot < 0 ? '−' : '') + '₹' + E.inr(Math.abs(tot), 2).s;
    $('#pnlTop').className = 'num ' + (tot > 0 ? 'up' : tot < 0 ? 'down' : '');
    $('#tapBtn').setAttribute('aria-pressed', st.oneTap); $('#tapLbl').textContent = st.oneTap ? '1-Tap ON' : '1-Tap OFF';
    const btn = $('#payoffBtn');
    btn.setAttribute('aria-pressed', st.sticky || !!st.pin);
    btn.setAttribute('aria-keyshortcuts', 'Alt');
    btn.classList.toggle('peek', st.peek && !st.sticky && !st.pin);
    $('#payoffDesc').textContent = `Hold ${keyWord()} to peek at your breakeven and P&L, or press to keep Payoff on.`;
    renderBanner();
    const bh = bannerBand();
    $('#idxWrap').style.setProperty('--bh', bh + 'px');
    $('#optWrap').style.setProperty('--bh', bh + 'px');
    renderStrip(b);
    const strip = $('#pstrip');
    idx.o.padTop = on ? (strip ? strip.offsetHeight : bh) + 12 : 8;
    opt.o.padTop = on && !isS3() ? 12 + bh : 8;
    renderTable(); renderMsgs(b); renderD1();
    const oiOn = !!c && !(on && isS3());
    $('#oiLabel').style.display = oiOn ? '' : 'none';
    if (oiOn) { const lastOI = OI.filter(q => q.T <= nowT()).pop(); $('#oiLabel').innerHTML = `OI: <b>${lastOI ? (lastOI.v / 1e5).toFixed(0) : '—'}L</b>`; $('#oiLabel').style.top = (opt.subTop + 8) + 'px'; }
    // the existing Exp. Move legend sits beside its bands in S1
    idx.invalidate(); opt.invalidate();
    updateReadout(null);
  }
  function summary(b) {
    if (isS3()) {
      const n = positionCount(), nExp = new Set(b.all.map(l => l.c.expKey)).size;
      if (expiredBook(b)) return `${n} positions settled today`;
      return `${n} positions · ${nExp} ${nExp === 1 ? 'expiry' : 'expiries'}`;
    }
    if (expiredSingle(b)) { const l = b.settled[0]; const v = E.intrinsic(l.c, E.settleS(l.c)); return `Expired · settled at ${E.prem(v)} · P&L ${E.signed(l.side * l.qty * (v - l.avg))}`; }
    const l = b.legs[0];
    if (!l) return '';
    if (b.pretrade) return `Not holding · priced as a buy of ${l.qty} at ${E.prem(l.avg)} (last price)`;
    return `${l.side > 0 ? 'Buy' : 'Sell'} ${l.qty} ${l.c.label} at ${E.prem(l.avg)}<span class="muted"> · ${l.product === 'INTRADAY' ? 'Intraday' : 'Carry forward'}</span>`;
  }
  function renderStrip(b) {
    let el = $('#pstrip');
    if (!payoffOn() || !b.all.length) { if (el) el.remove(); return; }
    if (!el) { el = document.createElement('div'); el.id = 'pstrip'; el.className = 'pstrip'; $('#idxWrap').appendChild(el); }
    el.style.top = '0px';
    const live = pointable(b) || st.pricing === 'unavailable';
    const hs = live ? horizons(b) : [];
    const cur = currentHorizon(b);
    const others = otherCount();
    const changed = setHTMLKeepFocus(el, `<span class="sum">${summary(b)}</span>` +
      (hs.length ? `<div class="chips" role="group" aria-label="Fit the view to">${hs.map(h => `<button type="button" data-h="${h.key}" aria-pressed="${!!cur && cur.key === h.key}">${esc(h.label)}</button>`).join('')}</div>` : '') +
      (others ? `<button type="button" class="ochip" data-tip="others" aria-label="${others} ${others === 1 ? 'position' : 'positions'} on other charts: ${esc(st.others.map(o => o.und).join(', '))}">${others} ${others === 1 ? 'position' : 'positions'} on other charts</button>` : '') +
      `<span class="mlabel">Model estimate, not a forecast <button type="button" data-tip="model" aria-label="About these values"><svg class="i"><use href="#i-info"/></svg></button></span>` +
      `<span class="mode">${st.sticky || st.pin ? 'Payoff on · Esc to close' : `Holding ${esc(keyName())} · release to hide`}</span>`, n => n.dataset.h || n.id || n.dataset.tip);
    if (!changed) return;
    el.querySelectorAll('[data-h]').forEach(bt => bt.addEventListener('click', () => {
      st.horizon = bt.dataset.h;
      const h = horizons(book()).find(x => x.key === st.horizon);
      if (h) fitTo(h.T);
      cache = null; log('payoff_horizon_change', `to=${h ? h.label : ''}`); renderUI();
    }));
    bindTips(el);
  }
  // When the market is closed, that is the message that matters, even if a feed is also delayed.
  function bannerKind() {
    if (st.pricing === 'unavailable') return 'err';
    if (closed()) return 'closed';
    if (st.pricing === 'delayed') return 'stale';
    return null;
  }
  function renderBanner() {
    let el = $('#n2');
    if (!bannerShown()) { if (el) el.remove(); return; }
    const k = bannerKind();
    if (!el) { el = document.createElement('div'); el.id = 'n2'; el.setAttribute('role', 'status'); $('#work').appendChild(el); }
    el.className = 'n2' + (k === 'err' ? ' err' : k === 'closed' ? ' closed' : '');
    el.style.top = '84px';
    const m = Math.min(st.clock, E.CLOSE) - 1;
    const stamp = `${((Math.floor(m / 60) + 11) % 12) + 1}:${String(m % 60).padStart(2, '0')}:15 ${m >= 720 ? 'pm' : 'am'}`;
    const html = k === 'stale' ? `<svg class="i"><use href="#i-clock"/></svg><span>Prices are delayed. Payoff values as of ${stamp}.</span>`
      : k === 'closed' ? `<svg class="i"><use href="#i-clock"/></svg><span>Market closed. Values use the last close; future times start at 9:15 am on ${E.DAYS[E.TODAY + 1].label}.</span><span class="act"><button class="x" id="n2x" aria-label="Close"><svg class="i"><use href="#i-x"/></svg></button></span>`
      : `<svg class="i"><use href="#i-alert"/></svg><span>Payoff can’t load option prices right now.</span><span class="act"><button id="n2retry">Retry</button></span>`;
    if (!setHTML(el, html)) return;
    const x = $('#n2x'); if (x) x.addEventListener('click', () => { st.closedBannerHidden = true; renderUI(); });
    const r = $('#n2retry'); if (r) r.addEventListener('click', () => { r.textContent = 'Retrying…'; r.disabled = true; setTimeout(() => { st.pricing = 'live'; cache = null; log('payoff_retry'); if (payoffOn() && idx.limitT == null) refit(book()); renderUI(); renderDemo(); }, 700); });
  }
  function renderMsgs(b) {
    const wrap = $('#idxWrap');
    let m = $('#cmsg');
    const on = payoffOn();
    if (on && !b.all.length) {
      if (!m) { m = document.createElement('div'); m.id = 'cmsg'; m.className = 'cmsg'; wrap.appendChild(m); }
      setHTML(m, `<div>${st.opt && expired(st.opt) ? `${esc(st.opt.label)} expired today. Pick a live contract on the option chart to see its payoff.` : 'Pick a contract on the option chart to see its payoff'}</div>`);
    } else if (m) m.remove();
    let ld = $('#loading');
    if (on && performance.now() < st.loadingUntil && pointable(b)) {
      if (!ld) { ld = document.createElement('div'); ld.id = 'loading'; ld.className = 'loading'; wrap.appendChild(ld); }
      ld.style.top = (idx.o.padTop + 6) + 'px';
      ld.textContent = isS3() ? 'Pricing your positions…' : 'Pricing your position…';
    } else if (ld) ld.remove();
    let hn = $('#hint');
    if (on && !st.hinted && pointable(b)) {
      if (!hn) { hn = document.createElement('div'); hn.id = 'hint'; hn.className = 'hint'; wrap.appendChild(hn); }
      hn.textContent = 'Move your pointer into the shaded area, or focus the chart and use the arrow keys, to see P&L at any level and time. Drag the chart or pick a date above to look further ahead.';
    } else if (hn) hn.remove();
    let om = $('#optEmpty');
    if (!shownOpt()) {
      if (!om) {
        om = document.createElement('div'); om.id = 'optEmpty'; om.className = 'cmsg'; om.style.pointerEvents = 'auto'; $('#optWrap').appendChild(om);
        om.innerHTML = '<div>No contract loaded.<br><button class="btn sec" id="openChain" style="margin-top:10px">Open option chain</button></div>';
        $('#openChain').addEventListener('click', () => openPopover('chain'));
      }
    } else if (om) om.remove();
  }
  // Keep the first-run hint away from labels drawn on the chart.
  function placeHint(ch) {
    const hn = $('#hint');
    if (!hn) return;
    const b = book();
    const nx = Math.max(0, ch.tToX(b.nowT)), w = 270, h = hn.offsetHeight || 44;
    const zoneW = Math.min(ch.plotW, ch.tToX(axisEnd(b) || b.nowT)) - nx;
    const bottom = ch.mainH * (1 - ch.o.volFrac);
    const cands = [[nx + zoneW * 0.25, bottom - h - 12], [nx + zoneW * 0.25, ch.o.padTop + 70], [nx + 12, bottom - h - 60], [nx + zoneW * 0.5 - w / 2, (ch.o.padTop + bottom) / 2]];
    const taken = (ch._taken || []).concat($('#readout') ? [{ x: $('#readout').offsetLeft, y: $('#readout').offsetTop, w: $('#readout').offsetWidth, h: $('#readout').offsetHeight }] : []);
    let pick = cands.find(([x, y]) => !overlaps({ x, y, w, h }, taken, 6)) || cands[0];
    hn.style.left = Math.max(12, Math.min(ch.plotW - w - 8, pick[0])) + 'px';
    hn.style.top = Math.max(ch.o.padTop, pick[1]) + 'px';
  }

  /* ---------- S3 table ---------- */
  function renderTable() {
    const wrap = $('#optWrap');
    let el = $('#ptable');
    if (!payoffOn() || !isS3()) { if (el) el.remove(); return; }
    const b = book();
    if (!el) { el = document.createElement('div'); el.id = 'ptable'; el.className = 'ptable'; wrap.appendChild(el); }
    el.classList.toggle('stale', st.pricing === 'delayed');
    el.style.top = '0px';
    const unavailable = st.pricing === 'unavailable';
    const loading = performance.now() < st.loadingUntil;
    const pt = pointable(b) ? livePt(st.pin || (st.hover && st.hover.T ? st.hover : null), b) : null;
    const T = pt ? pt.T : b.nowT, S = pt ? pt.S : b.S0;
    const title = pt ? `Payoff at Nifty ${E.level(S)} · ${E.fmtT(T)}${st.pin ? ' · Pinned' : ''}` : 'Payoff now';
    const narrow = wrap.clientWidth < 600, vnarrow = wrap.clientWidth < 520;
    const groups = {};
    b.all.forEach(l => { (groups[l.c.expKey] = groups[l.c.expKey] || { e: l.c.exp, legs: [] }).legs.push(l); });
    const order = Object.values(groups).sort((x, y) => x.e.T - y.e.T);
    order.forEach(g => g.legs.sort((x, y) => (x.c.strike || 0) - (y.c.strike || 0)));
    const stCls = s => ({ 'Live': 'live', 'Expires today': 'today', 'Expired': 'exp', 'Settled': 'set', 'Squared off': 'sq' }[s]);
    const cls = v => unavailable || loading ? '' : (v >= 0 ? 'up' : 'down');
    const sk = '<span class="skel"></span>';
    let rows = '';
    let settledSum = 0;
    order.forEach(g => {
      rows += `<tr class="g"><td colspan="7">${g.e.info.short} · ${g.e.kind}${g.e.movedFrom ? ` (moved from ${g.e.movedFrom.short})` : ''} · ${g.legs.length} ${g.legs.length === 1 ? 'leg' : 'legs'}</td></tr>`;
      g.legs.forEach(l => {
        const isSettled = expired(l.c);
        const d = P.legDetail(l, S, T, b);
        // "Payoff now" values each leg at its last price, the figure the platform shows
        const value = isSettled ? d.value : pt ? d.value : ltp(l.c);
        const pl = l.side * l.qty * (value - l.avg);
        if (isSettled) settledSum += pl;
        const fut = l.c.type === 'FUT';
        const sideTxt = fut ? (l.side > 0 ? 'Buy fut' : 'Sell fut') : (l.side > 0 ? 'Buy' : 'Sell');
        // A leg squared off before the point is greyed out: its P&L is what the 3:20 pm square-off books, and it still counts in the total.
        const sq = !isSettled && pt && d.status === 'Squared off';
        const rng = unavailable || loading || !pt || isSettled || sq ? '' : d.uncertain ? '<span class="unc">Too uncertain to price</span>' : (fut || Math.abs(d.pnlHi - d.pnlLo) < 1) ? '' : `<span class="rg">range ${E.signed(d.pnlLo)} to ${E.signed(d.pnlHi)}</span>`;
        rows += `<tr class="leg" data-leg="${l.id}"><td>${vnarrow ? `<span class="${l.side > 0 ? 'side-b' : 'side-s'}">${l.side > 0 ? 'B' : 'S'}</span> ` : ''}${esc(l.c.label)}${l.product === 'INTRADAY' ? ' <span class="st" style="margin-left:4px">Intraday</span>' : ''}</td>` +
          (vnarrow ? '' : `<td class="${l.side > 0 ? 'side-b' : 'side-s'}">${sideTxt}</td>`) +
          `<td class="n">${l.qty}</td>` + (narrow ? '' : `<td class="n">${E.prem(l.avg)}</td>`) +
          `<td class="n${sq ? ' off' : ''}">${loading ? sk : unavailable && !isSettled ? '—' : E.prem(value)}</td>` +
          `<td class="n${sq ? ' off' : ''}"><span class="${sq ? '' : cls(pl)}"${sq && !loading && !unavailable ? ' data-tip="sq" tabindex="0"' : ''}>${loading ? sk : unavailable && !isSettled ? '—' : E.signed(pl)}</span>${rng}</td>` +
          `<td><span class="st ${stCls(isSettled ? 'Settled' : d.status)}">${isSettled ? 'Settled' : d.status}</span></td></tr>`;
      });
    });
    const total = pt ? P.pnl(b, S, T) : pnlNow(b);
    const [lo, hi] = pt ? P.range(b, S, T) : [total, total];
    const flat = pt ? P.pnl(b, b.S0, T) : null;
    const mx = unavailable ? null : P.maxAtExpiry(b);
    const realised = st.realised + settledSum;
    const hide = unavailable || loading;
    const scroller = el.querySelector('.scroll');
    const scrollTop = scroller ? scroller.scrollTop : 0;
    const changed = setHTML(el, `<div class="tt"><h3 id="ptTitle">${esc(title)}</h3><span>${pt ? 'Model estimate at the point' : 'Hover the index chart to move the point'}</span></div>` +
      `<div class="scroll"><table aria-labelledby="ptTitle"><thead><tr><th scope="col">Contract</th>${vnarrow ? '' : '<th scope="col">Side</th>'}<th scope="col" class="n">Qty</th>${narrow ? '' : '<th scope="col" class="n">Avg</th>'}<th scope="col" class="n">${pt ? 'Value at point' : 'Value now'}</th><th scope="col" class="n">${pt ? 'P&amp;L at point' : 'P&amp;L now'}</th><th scope="col">Status</th></tr></thead><tbody>${rows}</tbody></table></div>` +
      `<div class="foot">` +
      (realised ? `<div><span class="lbl">Realised today${settledSum ? ' (incl. settled)' : ''}</span><span class="${realised >= 0 ? 'up' : 'down'}">${E.signed(realised)}</span></div>` : '') +
      `<div><span class="lbl" style="align-self:center">Total open P&amp;L</span><span class="tot ${cls(total)}">${hide ? (loading ? sk : '—') : E.signed(total)}${!hide && pt && Math.abs(hi - lo) >= 1 ? `<small>Range ${E.signed(lo)} to ${E.signed(hi)}</small>` : ''}</span></div>` +
      (pt ? `<div><span class="lbl">If Nifty stays at ${E.level(b.S0)}</span><span class="${cls(flat)}">${hide ? '—' : E.signed(flat)}</span></div>` : '') +
      (mx && !loading ? `<div><span class="lbl">At expiry</span><span>Max profit <b class="up">${E.signed(mx.maxProfit)}</b> · Max loss <b class="down">${E.signed(mx.maxLoss)}</b></span></div>` : '') +
      `<div class="model"><svg class="i" style="width:13px;height:13px"><use href="#i-info"/></svg>Model estimate, not a forecast</div></div>`);
    if (!changed) return;
    const sc2 = el.querySelector('.scroll'); if (sc2) sc2.scrollTop = scrollTop;
    // a tooltip whose cell was just redrawn would be left floating
    if (tipNode && !document.body.contains(tipNode)) hideTip('el');
    bindTips(el);
    el.querySelectorAll('tr.leg').forEach(tr => {
      tr.addEventListener('mouseenter', () => { st.rowHover = b.all.find(l => String(l.id) === tr.dataset.leg); idx.invalidate(); log('payoff_row_hover'); });
      tr.addEventListener('mouseleave', () => { st.rowHover = null; idx.invalidate(); });
    });
  }

  /* ---------- D1 pinned point card (Later release) ---------- */
  const timeFor = T => (!closed() && E.dayOfT(T) === E.TODAY) ? E.fmtT(T, false) : E.fmtT(T);
  const isOpenAt = (l, T) => !(l.c.type !== 'FUT' && l.c.expT <= T) && !(l.product === 'INTRADAY' && T >= P.SQ_T);
  function pinActions(b) {
    const out = { buttons: [], note: '', helper: '', premium: null };
    if (b.pretrade || !b.legs.length) return out;
    const T = st.pin.T, S = st.pin.S;
    if (isS3()) {
      const openThen = b.legs.filter(l => isOpenAt(l, T));
      if (openThen.length) { out.buttons.push({ kind: 'exitAll', label: `Exit all at ${timeFor(T)}`, pri: true }); out.note = 'An exit at a time closes at the market price then, wherever Nifty is.'; }
      else out.helper = b.legs.every(l => l.product === 'INTRADAY') ? 'Auto square-off closes these positions at 3:20 pm' : 'Nothing is open at this time';
      return out;
    }
    const l = b.legs[0];
    const d = P.legDetail(l, S, T, b);
    out.premium = d;
    const prem = heldPrem(l, S, T, b), cur = ltp(l.c);
    const diff = prem - cur;
    // BR-20: neither within one tick of the current price, and never at a price below one tick
    if (Math.abs(diff) > E.TICK + 1e-9 && l.c.type !== 'FUT' && prem >= E.TICK) {
      const target = l.side > 0 ? diff > 0 : diff < 0;
      out.buttons.push({ kind: target ? 'target' : 'stop', label: `Set ${target ? 'target' : 'stop'} at ${E.prem(prem)}`, price: prem, pri: true });
      const o = st.orders[l.id] || {};
      const ex = target ? o.tp : o.sl;
      if (ex) out.replace = `Replaces your ${target ? 'target' : 'stop'} at ${E.prem(ex)}`;
      out.note = 'Targets and stops trigger on the option’s price, not on Nifty. Time decay moves the Nifty level where they trigger.';
    }
    const atSq = l.product === 'INTRADAY' && T >= P.SQ_T;
    const atExpiry = l.c.type !== 'FUT' && T >= l.c.expT;
    if (atSq) out.helper = 'Auto square-off closes this position at 3:20 pm';
    else if (atExpiry) out.helper = 'The contract settles at expiry, so there is nothing to exit at this time';
    else out.buttons.push({ kind: 'exit', label: `Exit at ${timeFor(T)}`, pri: !out.buttons.length });
    if (!out.note && out.buttons.length) out.note = 'An exit at a time closes at the market price then, wherever Nifty is.';
    return out;
  }
  let d1Down = false;
  function renderD1() {
    let el = $('#d1');
    if (!st.pin || !payoffOn()) { if (el) el.remove(); return; }
    const b = book();
    if (!b.legs.length || st.pin.T <= b.nowT || axisEnd(b) == null) {
      if (el) el.remove();
      const passed = st.pin.T <= b.nowT && b.legs.length;
      if (passed) toast('ok', 'The pinned time has passed, so the pin was removed.');
      if (st.m1) closeM1(true);
      setPayoff(() => { clearPin(passed ? 'time_passed' : 'nothing_to_price'); }, 'pin');
      focusNS($(payoffOn() ? '#idxCanvas' : '#payoffBtn'));
      return;
    }
    if (!el) {
      el = document.createElement('div'); el.id = 'd1'; el.className = 'd1'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Pinned point');
      el.addEventListener('pointerdown', () => { d1Down = true; });
      window.addEventListener('pointerup', () => { if (d1Down) { d1Down = false; setTimeout(renderD1, 0); } });
      $('#idxWrap').appendChild(el);
    }
    if (d1Down) return; // don't swap the button out from under a click
    const T = st.pin.T, S = st.pin.S;
    const s3 = isS3();
    const acts = pinActions(b);
    const unavailable = st.pricing === 'unavailable';
    const disabledWhy = st.pricing !== 'live' ? 'Prices aren’t live' : closed() ? 'Outside market hours' : '';
    el.classList.toggle('stale', st.pricing !== 'live');
    const d = acts.premium || (!s3 && b.pretrade ? P.legDetail(b.legs[0], S, T, b) : null);
    const vals = [];
    if (unavailable) vals.push('<div class="m">—</div>');
    else {
      // a held single position shows the premium at the tick it would trade at, so the card, button and M1 agree
      const premV = d ? (b.pretrade ? d.value : heldPrem(b.legs[0], S, T, b)) : null;
      const total = pointPnl(b, S, T);
      const [lo, hi] = P.range(b, S, T);
      if (d) vals.push(`<div class="m">Premium ${E.prem(premV)}${!d.uncertain && d.hi - d.lo >= E.TICK ? ` (${E.prem(d.lo)} to ${E.prem(d.hi)})` : ''}</div>`);
      vals.push(`<div class="big num ${total >= 0 ? 'up' : 'down'}">${s3 ? 'Total P&amp;L' : 'P&amp;L'} ${E.signed(total)}</div>`);
      if (d && d.uncertain) vals.push(`<div class="m" style="color:var(--warn-ink)">Too uncertain to price. Time value left: ${E.prem(d.timeValue)}. Worth at expiry at this level: ${E.prem(d.intrinsic)}</div>`);
      else if (Math.abs(hi - lo) >= 1) vals.push(`<div class="m">Range ${E.signed(lo)} to ${E.signed(hi)}</div>`);
      vals.push(`<div class="m">If Nifty stays at ${E.level(b.S0)}: ${E.signed(P.pnl(b, b.S0, T))}</div>`);
    }
    const changed = setHTMLKeepFocus(el, `<div class="hd"><h4><small>Pinned</small>Nifty ${E.level(S)} at ${esc(E.fmtT(T))}</h4><button class="ib" id="d1x" aria-label="Remove pin"><svg class="i"><use href="#i-x"/></svg></button></div>` +
      `<div class="vals">${vals.join('')}</div>` +
      (b.pretrade ? `<div class="note">Actions appear for positions you hold</div>` : acts.note ? `<div class="note">${esc(acts.note)}</div>` : '') +
      (closed() && !b.pretrade ? `<div class="proto-note">PRD open item 9: whether orders can be set outside market hours. Shown disabled here.</div>` : '') +
      `<div class="acts">${acts.buttons.map((bt, i) => `<button class="btn ${bt.pri ? 'pri' : 'sec'} wide" data-act="${i}" ${disabledWhy ? `aria-disabled="true" aria-describedby="d1why" style="opacity:.45;cursor:not-allowed"` : ''}>${esc(unavailable ? bt.label.replace(/ at ₹[\d,.]+$/, '') : bt.label)}</button>${bt.kind !== 'exit' && bt.kind !== 'exitAll' && acts.replace ? `<div class="helper">${esc(acts.replace)}</div>` : ''}`).join('')}${acts.helper ? `<div class="helper">${esc(acts.helper)}</div>` : ''}${disabledWhy && acts.buttons.length ? `<div class="helper" id="d1why">${esc(disabledWhy)}</div>` : ''}</div>` +
      `<div class="ml"><svg class="i"><use href="#i-info"/></svg>Model estimate, not a forecast</div>`, n => n.dataset.act || n.id);
    // beside the pin (right, then left); if neither side fits, above or below it; hidden while the pin is out of view
    const ch = idx, px = ch.tToX(T), py = ch.pToY(S);
    const out = px < 0 || px > ch.plotW || py < ch.o.padTop - 4 || py > ch.mainH;
    el.hidden = out;
    const room = ch.mainH - ch.o.padTop - 12;
    el.style.maxHeight = Math.max(160, room) + 'px';
    const w = el.offsetWidth, h = el.offsetHeight;
    let x, y;
    if (px + 18 + w <= ch.plotW - 6) { x = px + 18; y = py - 30; }
    else if (px - 18 - w >= 6) { x = px - 18 - w; y = py - 30; }
    else { x = px - w / 2; y = py + 22 + h <= ch.mainH - 6 ? py + 22 : py - 22 - h; }
    x = Math.max(6, Math.min(ch.plotW - w - 6, x));
    y = Math.min(ch.mainH - 6 - h, Math.max(ch.o.padTop, y));
    el.style.left = x + 'px'; el.style.top = Math.max(ch.o.padTop, y) + 'px';
    if (!changed) return;
    $('#d1x').addEventListener('click', () => removePin());
    el.querySelectorAll('[data-act]').forEach(bt => {
      bt.addEventListener('click', () => {
        if (bt.getAttribute('aria-disabled') === 'true') { showTipFor(bt, disabledWhy); return; }
        const i = +bt.dataset.act, a = acts.buttons[i];
        log('payoff_pin_action_click', `action=${a.kind}`); openM1(a, i);
      });
      if (disabledWhy) { bt.addEventListener('mouseenter', () => showTipFor(bt, disabledWhy)); bt.addEventListener('mouseleave', () => hideTip('btn')); bt.addEventListener('focus', () => showTipFor(bt, disabledWhy)); bt.addEventListener('blur', () => hideTip('btn')); }
    });
  }

  /* ---------- M1 confirm order from pin ---------- */
  function openM1(a, opener) {
    const b = book();
    const legIds = a.kind === 'exitAll' ? b.legs.filter(l => isOpenAt(l, st.pin.T)).map(l => l.id) : b.legs.map(l => l.id);
    st.m1 = { a, opener, pin: Object.assign({}, st.pin), legIds, submitting: false };
    log('payoff_order_confirm_open', `mode=${a.kind}`);
    renderM1();
  }
  function closeM1(silent) {
    const s = $('#m1scrim'); if (s) s.remove();
    const m = st.m1;
    st.m1 = null;
    if (m && !silent) { log('payoff_order_cancel'); focusNS($(`#d1 [data-act="${m.opener}"]`) || $('#d1 [data-act]') || $(payoffOn() ? '#idxCanvas' : '#payoffBtn')); }
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
    const rangeTxt = () => { const r = P.range(b, pin.S, T); return Math.abs(r[1] - r[0]) >= 1 ? ` (range ${E.signed(r[0])} to ${E.signed(r[1])})` : ''; };
    let body = '', msg = '', canConfirm = true, hideConfirm = false;
    if (!legs.length) { msg = 'This position is closed, so there’s nothing to set.'; hideConfirm = true; }
    else if (a.kind === 'exitAll') {
      const openThen = legs.filter(l => isOpenAt(l, T));
      body = `<div class="pos">${openThen.length} ${openThen.length === 1 ? 'leg' : 'legs'} open at ${esc(E.fmtT(T))}</div>` +
        (openThen.length ? `<div class="order">${openThen.map(l => `<div>${l.side > 0 ? 'Sell' : 'Buy back'} ${l.qty} ${esc(l.c.label)}</div>`).join('')}</div>` : '') +
        `<div class="pl">P&amp;L depends on prices at ${esc(timeFor(T))}. Payoff estimate at Nifty ${E.level(pin.S)}: ${E.signed(pointPnl(b, pin.S, T))}${rangeTxt()}</div>` +
        `<div class="tn">Cancelled for any leg you exit before then. Legs that expire or square off before then are left alone.</div>`;
      if (!openThen.length) { msg = 'Nothing is open at this time.'; canConfirm = false; }
    } else {
      const l = legs[0];
      const bought = l.side > 0;
      body = `<div class="pos">${esc(l.c.label)} · ${bought ? 'Bought' : 'Sold'} ${l.qty} at ${E.prem(l.avg)}</div>`;
      if (a.kind === 'target' || a.kind === 'stop') {
        const p = a.price;
        const line = a.kind === 'target'
          ? (bought ? `Sells ${l.qty} at market when the option’s price reaches ${E.prem(p)}` : `Buys back ${l.qty} at market when the option’s price falls to ${E.prem(p)}`)
          : (bought ? `Sells ${l.qty} at market if the option’s price falls to ${E.prem(p)}` : `Buys back ${l.qty} at market if the option’s price rises to ${E.prem(p)}`);
        body += `<div class="order">${esc(line)}</div><div class="pl">P&amp;L if filled at ${E.prem(p)}: ${E.signed(l.side * l.qty * (p - l.avg))} before charges</div>` +
          `<div class="tn">Targets and stops trigger on the option’s price, not on Nifty. Time decay moves the Nifty level where they trigger.</div>`;
        const o = st.orders[l.id] || {};
        const ex = a.kind === 'target' ? o.tp : o.sl;
        if (ex) body += `<div class="helper">Replaces your current ${a.kind} at ${E.prem(ex)}</div>`;
        const cur = ltp(l.c);
        const crossed = a.kind === 'target' ? (bought ? cur >= p : cur <= p) : (bought ? cur <= p : cur >= p);
        if (p < E.TICK) { msg = 'Pick a price of at least ₹0.05.'; canConfirm = false; }
        else if (crossed) { msg = `The option is already at or past ${E.prem(p)}. Move the pin to pick a new price.`; canConfirm = false; }
      } else {
        body += `<div class="order">${bought ? 'Sells' : 'Buys back'} ${l.qty} at market at ${esc(E.fmtT(T))}, if the position is still open</div>` +
          `<div class="pl">P&amp;L depends on prices at ${esc(timeFor(T))}. Payoff estimate at Nifty ${E.level(pin.S)}: ${E.signed(pointPnl(b, pin.S, T))}${rangeTxt()}</div>` +
          `<div class="tn">Cancelled if you exit before then.</div>`;
      }
    }
    if (legs.length && (a.kind === 'exit' || a.kind === 'exitAll') && T <= nowT()) { msg = `${E.fmtT(T, false)} has passed. Pick a later time.`; canConfirm = false; }
    const sub = st.m1.submitting;
    const first = !s._html;
    const hadFocus = s.contains(document.activeElement) ? document.activeElement.id : null;
    const changed = setHTML(s, `<div class="m1" role="dialog" aria-modal="true" aria-labelledby="m1t">` +
      `<div class="mh"><h2 id="m1t">${title}</h2><button class="ib" id="m1x" aria-label="Close" ${sub ? 'disabled' : ''}><svg class="i"><use href="#i-x"/></svg></button></div>` +
      `<div class="mb">${body}${msg ? `<div class="msg" role="alert">${esc(msg)}</div>` : ''}</div>` +
      `<div class="mf"><button class="btn sec" id="m1c" ${sub ? 'disabled' : ''}>Cancel</button>${hideConfirm ? '' : `<button class="btn pri" id="m1ok" ${!canConfirm ? 'disabled' : sub ? 'aria-disabled="true" aria-busy="true"' : ''}>${sub ? '<span class="spin"></span>Placing…' : 'Confirm'}</button>`}</div></div>`);
    if (!changed) return;
    const cancel = () => { if (hideConfirm) { closeM1(true); log('payoff_order_cancel'); removePin(); } else closeM1(); };
    $('#m1x').addEventListener('click', cancel);
    $('#m1c').addEventListener('click', cancel);
    s.onmousedown = e => { if (e.target === s && st.m1 && !st.m1.submitting) cancel(); };
    const ok = $('#m1ok');
    if (ok) ok.addEventListener('click', () => { if (!st.m1 || st.m1.submitting) return; confirmM1(); });
    // initial focus on Cancel so Enter can't place an order by accident (assumption 29)
    const back = hadFocus && $('#' + hadFocus) && !$('#' + hadFocus).disabled ? $('#' + hadFocus) : null;
    if (sub) focusNS($('#m1ok'));
    else if (first || !back) focusNS($('#m1c')); else focusNS(back);
    s.onkeydown = e => { if (e.key === 'Tab') { const f = [...s.querySelectorAll('button:not([disabled])')]; if (!f.length) { e.preventDefault(); return; } const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); } };
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
      if (!legs.length) { renderM1(); return; }
      let msg = '';
      if (a.kind === 'target' || a.kind === 'stop') {
        const l = legs[0];
        st.orders[l.id] = Object.assign(st.orders[l.id] || {}, { [a.kind === 'target' ? 'tp' : 'sl']: a.price });
        msg = `${a.kind === 'target' ? 'Target' : 'Stop'} set at ${E.prem(a.price)}`;
      } else {
        const ids = legs.filter(l => isOpenAt(l, pin.T)).map(l => l.id);
        st.exits = st.exits.filter(x => x.T !== pin.T);
        st.exits.push({ T: pin.T, legIds: ids, label: `Exit at ${timeFor(pin.T)}`, tip: `Exits at market at ${timeFor(pin.T)} if still open` });
        msg = `Exit scheduled for ${timeFor(pin.T)}`;
      }
      log('payoff_order_result', 'success');
      closeM1(true);
      toast('ok', msg);
      // stay on S2/S3 so the new pill or exit marker is in view (M1 Success)
      setPayoff(() => { st.sticky = true; st.pin = null; }, 'pin');
      focusNS($('#idxCanvas'));
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
    if (p && !p.contains(e.target) && !e.target.closest('#railPositions,#railChain,#navPositions,#pnlPill,#openChain,#demo')) closePopover();
  });
  let chainExp = '2026-10-19';
  function renderPopover() {
    let p = $('#pop');
    if (!st.popover) { if (p) p.remove(); return; }
    if (!p) { p = document.createElement('div'); p.id = 'pop'; p.className = 'pop'; p.setAttribute('role', 'dialog'); document.body.appendChild(p); }
    const rail = $('.rail.r').getBoundingClientRect();
    if (st.popover === 'positions') {
      p.style.width = '700px'; p.setAttribute('aria-label', 'Positions');
      const rows = st.legs.map(l => { const lp = ltp(l.c), pl = l.side * l.qty * (lp - l.avg); return `<tr><td>${esc(l.c.label)}${expired(l.c) ? ' <span class="st set">Settled</span>' : ''}</td><td>${l.product === 'INTRADAY' ? 'Intraday' : 'Carry fwd'}</td><td class="n ${l.side > 0 ? 'up' : 'down'}">${l.side > 0 ? '' : '−'}${l.qty}</td><td class="n">${E.prem(l.avg)}</td><td class="n">${E.prem(lp)}</td><td class="n ${pl >= 0 ? 'up' : 'down'}">${E.signed(pl, 2)}</td><td>${expired(l.c) || closed() ? '' : `<button class="xb" data-exit="${l.id}">Exit</button>`}</td></tr>`; })
        .concat(st.others.map(o => { const pl = o.side * o.qty * (o.ltp - o.avg); return `<tr><td>${esc(o.label)}</td><td>Carry fwd</td><td class="n up">${o.qty}</td><td class="n">${E.prem(o.avg)}</td><td class="n">${E.prem(o.ltp)}</td><td class="n ${pl >= 0 ? 'up' : 'down'}">${E.signed(pl, 2)}</td><td>${closed() ? '' : `<button class="xb" data-exit="${o.id}">Exit</button>`}</td></tr>`; }));
      const realised = st.realised + st.realisedOther;
      if (!setHTML(p, `<div class="poph"><h3>Positions</h3><button class="ib" id="popx" aria-label="Close"><svg class="i"><use href="#i-x"/></svg></button></div><div class="popb">` +
        (rows.length ? `<table><thead><tr><th>Contract</th><th>Product</th><th class="n">Qty</th><th class="n">Avg</th><th class="n">LTP</th><th class="n">P&amp;L</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table>` : `<div class="empty">No open positions.</div>`) +
        (realised ? `<div style="padding:9px 12px;display:flex;justify-content:space-between;font-size:12.5px"><span style="color:var(--text-2)">Realised today</span><span class="${realised >= 0 ? 'up' : 'down'}">${E.signed(realised, 2)}</span></div>` : '') + `</div>`)) { placePop(p, rail); return; }
      p.querySelectorAll('[data-exit]').forEach(b2 => b2.addEventListener('click', () => { const id = b2.dataset.exit; exitLeg(isNaN(+id) ? id : +id); }));
    } else {
      p.style.width = '400px'; p.setAttribute('aria-label', 'Option chain');
      const exps = ['2026-10-19', '2026-10-27', '2026-11-03'].filter(k => !expired(C('CE', 22700, k)));
      if (!exps.includes(chainExp)) chainExp = exps[0];
      const S = S0(), atm = Math.round(S / 100) * 100;
      const strikes = []; for (let k = atm - 500; k <= atm + 500; k += 100) strikes.push(k);
      const cur = st.opt;
      const rows = strikes.map(k => { const ce = C('CE', k, chainExp), pe = C('PE', k, chainExp); const sel = c => cur === c ? ' sel' : ''; return `<tr><td class="n"><button class="cp${sel(ce)}" data-c="${ce.id}" aria-label="${esc(ce.label)} ${ltp(ce).toFixed(2)}">${ltp(ce).toFixed(2)}</button></td><td class="k ${k === atm ? 'atm' : ''}">${k}</td><td><button class="cp pe${sel(pe)}" data-c="${pe.id}" aria-label="${esc(pe.label)} ${ltp(pe).toFixed(2)}">${ltp(pe).toFixed(2)}</button></td></tr>`; }).join('');
      if (!setHTMLKeepFocus(p, `<div class="poph"><h3>Option chain · NIFTY</h3><button class="ib" id="popx" aria-label="Close"><svg class="i"><use href="#i-x"/></svg></button></div>` +
        `<div class="chain"><div class="ex">${exps.map(k => `<button data-x="${k}" aria-pressed="${k === chainExp}">${E.expiryByKey(k).info.short}${E.expiryByKey(k).movedFrom ? '*' : ''}</button>`).join('')}</div>` +
        `<div class="popb"><table><thead><tr><th class="n">Call LTP</th><th style="text-align:center">Strike</th><th>Put LTP</th></tr></thead><tbody>${rows}</tbody></table></div>` +
        `<div style="padding:8px 12px;color:var(--text-3);font-size:11px">*19 Oct expiry moved from Tue 20 Oct (Dussehra). The 19 Oct 22500 Call and Put are real Kite prices; the rest are modelled. Click a price to load it on the option chart.</div></div>`, n => n.dataset.c || n.dataset.x || n.id)) { placePop(p, rail); return; }
      p.querySelectorAll('[data-x]').forEach(b2 => b2.addEventListener('click', () => { chainExp = b2.dataset.x; renderPopover(); }));
      p.querySelectorAll('[data-c]').forEach(b2 => b2.addEventListener('click', () => {
        const m = b2.dataset.c.match(/^NIFTY-(\d{4}-\d{2}-\d{2})-(\d*)-(CE|PE)$/);
        const pick = C(m[3], +m[2], m[1]);
        st.opt = pick;
        if (heldSingle()) toast('ok', `Loaded ${pick.label}. It shows on the option chart when Payoff is off; Payoff keeps your position on screen.`);
        cache = null; rebuildData();
        if (payoffOn()) refit(book());
        renderPopover();
      }));
    }
    $('#popx').addEventListener('click', closePopover);
    placePop(p, rail);
  }
  function placePop(p, rail) {
    p.style.top = Math.max(70, rail.top + 10) + 'px';
    p.style.left = Math.max(8, rail.left - p.offsetWidth - 8) + 'px';
  }

  /* ---------- tooltips ---------- */
  let tipEl = null, tipOwner = null, tipNode = null;
  function tipText(key) {
    const k = keyName();
    if (key === 'tap') return { text: st.oneTap ? 'Turn off instant trade' : 'Turn on instant trade', caps: st.platform === 'mac' ? ['⌘', '⌥', '1'] : ['Ctrl', 'Alt', '1'] };
    if (key === 'payoff') return (st.sticky || st.pin) ? { text: 'Hide payoff', caps: ['Esc'] } : { text: 'Payoff: breakeven and P&L at any level and time. Hold to peek, or click to keep it on', caps: [k], wrap: true };
    if (key === 'model') return { text: 'Worked out from live option prices, IV and time left. The range shows values if IV moves. Actual prices can differ, especially near expiry.', wrap: true };
    if (key === 'others') return { text: st.others.map(o => o.und).join(', ') };
    if (key === 'sq') return { text: 'Squared off at 3:20 pm. This is the P&L the square-off books at this Nifty level, and it still counts in the total.', wrap: true };
    return null;
  }
  function placeTip(r, t, cls) {
    hideTip();
    tipEl = document.createElement('div');
    tipEl.className = 'tip' + (t.wrap ? ' wrap' : '') + (t.caps ? '' : ' nocaps');
    tipEl.setAttribute('role', 'tooltip');
    if (t.wrap) tipEl.style.width = t.caps ? '340px' : '300px';
    tipEl.innerHTML = `<span>${esc(t.text)}</span>${t.caps ? `<span class="caps">${t.caps.map(c => `<kbd>${esc(c)}</kbd>`).join('')}</span>` : ''}`;
    document.body.appendChild(tipEl);
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    let x = r.left + r.width / 2 - w / 2, y = r.bottom + 10;
    x = Math.max(8, Math.min(innerWidth - w - 8, x));
    if (y + h > innerHeight - 8) y = r.top - h - 10;
    tipEl.style.left = x + 'px'; tipEl.style.top = y + 'px';
    tipOwner = cls;
  }
  function showTipFor(target, text) { placeTip(target.getBoundingClientRect(), { text, wrap: text.length > 60 }, 'btn'); }
  function hideTip(owner) { if (tipEl && (!owner || owner === tipOwner)) { tipEl.remove(); tipEl = null; tipOwner = null; tipNode = null; } }
  // After a click changes a control's state, its open tooltip follows.
  function refreshTip() { if (tipOwner === 'el' && tipNode && document.body.contains(tipNode)) { const t = tipText(tipNode.dataset.tip); const n = tipNode; if (t) { placeTip(n.getBoundingClientRect(), t, 'el'); tipNode = n; } } }
  function bindTips(root) {
    root.querySelectorAll('[data-tip]').forEach(n => {
      if (n._tipBound) return; n._tipBound = true;
      const show = () => { const t = tipText(n.dataset.tip); if (t) { placeTip(n.getBoundingClientRect(), t, 'el'); tipNode = n; } };
      n.addEventListener('mouseenter', show);
      n.addEventListener('mouseleave', () => hideTip('el'));
      n.addEventListener('focus', show);
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
    $('#coachTry').addEventListener('click', () => { dismissCoach(true); setPayoff(() => { st.sticky = true; }, 'tip'); });
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
  document.addEventListener('mousedown', e => { const c = $('#coach'); if (c && !c.contains(e.target) && !e.target.closest('#payoffBtn,#demo')) dismissCoach(); });

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
    const sc = SCEN[st.scenario] || SCEN.single;
    const k = keyName();
    const focusKey = d.contains(document.activeElement) ? (document.activeElement.id || `${document.activeElement.dataset.set}:${document.activeElement.dataset.v}`) : null;
    if (st.demoMin) {
      d.innerHTML = `<button id="dmin" class="dpill" aria-label="Open demo controls" aria-expanded="false"><svg class="i"><use href="#i-grid"/></svg><span>Demo</span></button>`;
      $('#dmin').addEventListener('click', () => { st.demoMin = false; LS.set('demoMin', false); renderDemo(); fit(); const b = $('#dmin'); if (b) b.focus(); });
      return;
    }
    d.innerHTML = `<div class="dh"><span class="tag">Prototype</span><b>Demo controls</b><button id="dmin" aria-label="${st.demoMin ? 'Open demo controls' : 'Collapse demo controls'}" aria-expanded="${!st.demoMin}"><svg class="i" style="transform:rotate(${st.demoMin ? 180 : 0}deg)"><use href="#i-chev"/></svg></button></div>` +
      `<div class="db">` +
      `<div class="grp"><span class="gl">Keys</span><div class="keys">` +
      `<div><span>Peek at Payoff</span><span class="caps">hold <kbd>${esc(k)}</kbd></span></div>` +
      `<div><span>Keep it on</span><span>click Payoff</span></div>` +
      `<div><span>Move the point</span><span class="caps"><kbd>←</kbd><kbd>→</kbd><kbd>↑</kbd><kbd>↓</kbd></span></div>` +
      `<div><span>Pin a point</span><span>click, or <span class="caps"><kbd>Enter</kbd></span></span></div>` +
      `<div><span>Close</span><span class="caps"><kbd>Esc</kbd></span></div></div></div>` +
      `<div class="grp"><span class="gl">Positions</span><select id="dscen" aria-label="Sample positions">${Object.entries(groups).map(([g, items]) => `<optgroup label="${esc(g)}">${items.map(([kk, n]) => `<option value="${kk}" ${kk === st.scenario ? 'selected' : ''}>${esc(n)}</option>`).join('')}</optgroup>`).join('')}</select>` +
      (sc.product ? seg('product', st.product, [['CARRY', 'Carry forward'], ['INTRADAY', 'Intraday']]) : '') + `</div>` +
      `<div class="grp"><span class="gl">Clock · ${E.DAYS[E.TODAY].label}${CLOCKS.some(c => c[0] === st.clock) ? '' : ` · now ${E.clock(Math.min(st.clock, E.CLOSE))}`}</span>${seg('clock', st.clock, CLOCKS)}</div>` +
      `<div class="grp"><span class="gl">Simulate</span><div class="row"><button id="dadv">Clock +30 min</button><button id="dclose">Close held positions</button></div></div>` +
      `<div class="grp"><span class="gl">Prices</span>${seg('pricing', st.pricing, [['live', 'Live'], ['delayed', 'Delayed'], ['unavailable', 'Unavailable']])}${seg('ticks', st.ticks, [[true, 'Ticking'], [false, 'Frozen']])}</div>` +
      `<div class="grp"><span class="gl">Keyboard</span>${seg('platform', st.platform, [['mac', 'Mac · ⌥ Option'], ['win', 'Windows · Alt']])}</div>` +
      `<div class="grp"><span class="gl">Later release</span>${seg('later', st.later, [[true, 'Pins and orders on'], [false, 'MVP only']])}${seg('orderFail', st.orderFail, [[false, 'Orders succeed'], [true, 'Orders fail']])}</div>` +
      `<div class="grp"><span class="gl">Reset</span><div class="row"><button id="dtip">Show the tip again</button><button id="dreset">Reset prototype</button></div></div>` +
      `<div class="grp"><span class="gl">Analytics events</span><div class="log" id="dlog">${st.events.slice(0, 12).map(x => `<div>${esc(x)}</div>`).join('') || '<div>None yet</div>'}</div></div>` +
      `<div class="note">Real 1-minute data from Zerodha Kite for NIFTY 50 and the 19 Oct 22500 Call and Put, ${E.DAYS[E.HIST_START].label} to ${E.clock(REAL_END_MOD)} on ${E.DAYS[E.TODAY].label}. Later times are simulated, and other contracts are modelled from the real index. Payoff values come from a Black-Scholes model on trading time, with IV taken from the real prices and held; the range moves IV −2.5 to +3 points.</div>` +
      `</div>`;
    if (focusKey) { const n = d.querySelector('#' + CSS.escape(focusKey.split(':')[0])) || [...d.querySelectorAll('[data-set]')].find(x => `${x.dataset.set}:${x.dataset.v}` === focusKey); if (n) n.focus(); }
    $('#dmin').addEventListener('click', () => { st.demoMin = !st.demoMin; LS.set('demoMin', st.demoMin); renderDemo(); fit(); $('#dmin').focus(); });
    if (st.demoMin) return;
    $('#dscen').addEventListener('change', e => { st.scenario = e.target.value; LS.set('scenario', st.scenario); st.product = 'CARRY'; reloadScenario(); $('#dscen').focus(); });
    d.querySelectorAll('[data-set]').forEach(b => b.addEventListener('click', () => {
      const name = b.dataset.set; let v = b.dataset.v;
      if (v === 'true') v = true; else if (v === 'false') v = false; else if (!isNaN(+v)) v = +v;
      st[name] = v;
      if (name === 'platform') LS.set('platform', v);
      if (name === 'ticks' && !v) { st.noise = 0; walk = 0; }
      if (name === 'clock' || name === 'product') { st.closedBannerHidden = false; st.noise = 0; walk = 0; reloadScenario(); return; }
      if (name === 'pricing') { cache = null; if (v !== 'live') { st.noise = 0; walk = 0; } if (payoffOn() && idx.limitT == null) refit(book()); }
      if (name === 'later' && !v) { closeM1(true); if (st.pin) setPayoff(() => { clearPin('mvp'); }, 'pin'); }
      cache = null;
      rebuildData(); renderDemo(); if (st.m1) renderM1();
    }));
    $('#dadv').addEventListener('click', () => advanceClock(30));
    $('#dclose').addEventListener('click', () => { const ids = st.legs.map(l => l.id); if (!ids.length) { toast('ok', 'No positions to close.'); return; } ids.forEach(id => exitLeg(id)); if (st.m1) renderM1(); });
    $('#dtip').addEventListener('click', () => { st.tipSeen = false; LS.set('tipSeen', false); st.hinted = false; LS.set('hinted', false); showCoach(); renderUI(); renderDemo(); });
    $('#dreset').addEventListener('click', () => { LS.clear(); location.reload(); });
  }
  // Moves the clock without resetting positions, so time-based states (pin passing, time passed) can be seen.
  function advanceClock(min) {
    if (closed()) { toast('ok', 'The market is already closed.'); return; }
    const before = snapshot(), prevT = nowT();
    const wasOpen = !closed();
    st.clock = Math.min(945, st.clock + min);
    if (st.clock > E.CLOSE && st.clock < 945) st.clock = 945;
    // scheduled exits that came due close their legs at market at that time (BR-21)
    st.exits.filter(x => x.T <= nowT()).forEach(x => {
      x.legIds.forEach(id => {
        const l = st.legs.find(q => q.id === id);
        if (!l) return;
        st.realised += l.side * l.qty * (E.price(l.c, E.pathAt(x.T), x.T) - l.avg);
        st.legs = st.legs.filter(q => q !== l);
        toast('ok', `Exited ${l.c.label} at ${E.fmtT(x.T, false)} (scheduled exit)`);
      });
    });
    st.exits = st.exits.filter(x => x.T > nowT());
    if (wasOpen && closed()) squareOffIntraday();
    pruneOrders();
    st.noise = 0; walk = 0; cache = null;
    const b = book();
    if (!livePt(st.hover, b)) { st.hover = null; st.keyPt = null; }
    if (st.pin && isS3() !== before.s3) clearPin('positions');
    rebuildData();
    if (payoffOn()) { if (st.horizon && !horizons(book()).some(h => h.key === st.horizon)) st.horizon = null; refit(book()); }
    if (!currentHorizon(book())) followNow(prevT);
    if (st.m1) renderM1();
    renderDemo();
  }
  function reloadScenario() {
    const was = payoffOn();
    applyScenario();
    renderDemo();
    cache = null;
    defaultViews();
    if (was && payoffOn()) refit(book());
    renderUI();
    refreshMirror();
  }

  /* ---------- live ticks ---------- */
  let walk = 0;
  setInterval(() => {
    if (!ticking()) return;
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
    refreshMirror();
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
    requestAnimationFrame(() => {
      idx.resize(); opt.resize(); cache = null; renderUI(); placeCoach(); if (st.popover) renderPopover();
      // collapsed, the demo control sits in the left rail's empty space so it hides no product UI
      const sep = $('.rail.l .sep').getBoundingClientRect(), d = $('#demo');
      if (d) { d.style.setProperty('--pill-top', (sep.top + 6) + 'px'); d.style.setProperty('--pill-left', Math.max(2, sep.left + sep.width / 2 - 28) + 'px'); }
    });
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
