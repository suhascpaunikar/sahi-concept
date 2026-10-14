/* =====================================================================
   Engine: trading calendar, market data, option model, payoff maths.
   Market data: real 1-minute candles from Zerodha Kite (src/data.js) for
   NIFTY 50 and the NIFTY 19 Oct 22500 Call and Put, from Tue 29 Sep to
   12:59 pm on Wed 14 Oct 2026. After 12:59 pm the index is simulated, and
   every contract without real data is modelled from the real index.
   The model follows the research: Black-Scholes on a trading-time clock
   (375 minutes a session, 252 sessions a year), priced off the index with
   IV held at its current level (BR-08). IV comes from the real prices.
   ===================================================================== */
const Engine = (() => {
  const RD = typeof RealData !== 'undefined' ? RealData : require('./data.js');
  const OPEN = 555, CLOSE = 930, SESSION = 375, YEAR = 252 * 375, SQOFF = 920;
  const LOT = 65, TICK = 0.05;
  const HOLIDAYS = { '2026-10-02': 'Gandhi Jayanti', '2026-10-20': 'Dussehra', '2026-11-24': 'Guru Nanak Jayanti' };
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ---------- calendar ---------- */
  const pad = n => String(n).padStart(2, '0');
  const isoOf = t => { const d = new Date(t); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
  const dateInfo = key => {
    const [y, m, d] = key.split('-').map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    return { key, y, m: m - 1, d, dow, label: `${DOW[dow]} ${d} ${MON[m - 1]}`, short: `${d} ${MON[m - 1]}`, upper: `${d} ${MON[m - 1].toUpperCase()}` };
  };
  const DAYS = [];
  for (let t = Date.UTC(2026, 8, 29); t <= Date.UTC(2026, 11, 31); t += 864e5) {
    const key = isoOf(t);
    const dow = new Date(t).getUTCDay();
    if (dow === 0 || dow === 6 || HOLIDAYS[key]) continue;
    DAYS.push(dateInfo(key));
  }
  const dayIdx = key => DAYS.findIndex(d => d.key === key);
  const TODAY = dayIdx('2026-10-14');
  const tOf = (di, mod) => di * SESSION + (mod - OPEN);
  // A trading-time T on a session boundary is shown as the previous day's 3:30 pm close.
  const split = T => {
    let di = Math.floor(T / SESSION), m = T - di * SESSION;
    if (m === 0 && di > 0) { di -= 1; m = SESSION; }
    return { di, mod: OPEN + m };
  };
  const clock = mod => {
    const h = Math.floor(mod / 60), mi = Math.round(mod % 60);
    const h12 = ((h + 11) % 12) + 1;
    return `${h12}:${pad(mi)} ${h >= 12 ? 'pm' : 'am'}`;
  };
  const fmtT = (T, withDay = true) => {
    const { di, mod } = split(T);
    const t = clock(mod);
    return withDay ? `${t}, ${DAYS[di].label}` : t;
  };
  const dayOfT = T => split(T).di;

  // Expiries: Nifty weeklies on Tuesday, monthly on the last Tuesday; a holiday moves it to the previous trading day (BR-05).
  const EXPIRIES = [];
  {
    const tues = [];
    for (let t = Date.UTC(2026, 9, 13); t <= Date.UTC(2026, 10, 30); t += 7 * 864e5) tues.push(isoOf(t));
    tues.forEach(key => {
      const info = dateInfo(key);
      const nextWeek = dateInfo(isoOf(Date.UTC(info.y, info.m, info.d + 7)));
      const monthly = nextWeek.m !== info.m;
      let actual = key;
      let k = Date.UTC(info.y, info.m, info.d);
      while (HOLIDAYS[isoOf(k)] || [0, 6].includes(new Date(k).getUTCDay())) k -= 864e5;
      actual = isoOf(k);
      const di = dayIdx(actual);
      EXPIRIES.push({ key: actual, di, kind: monthly ? 'Monthly' : 'Weekly', movedFrom: actual !== key ? dateInfo(key) : null, info: dateInfo(actual), T: (di + 1) * SESSION });
    });
  }
  const expiryByKey = key => EXPIRIES.find(e => e.key === key);

  /* ---------- option model ---------- */
  function ncdf(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989422804014327 * Math.exp(-x * x / 2);
    const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return x > 0 ? 1 - p : p;
  }
  function bs(type, S, K, tau, iv) {
    const intrinsic = type === 'CE' ? Math.max(0, S - K) : Math.max(0, K - S);
    if (tau <= 0 || iv <= 0) return intrinsic;
    const v = iv * Math.sqrt(tau);
    if (v < 1e-6) return intrinsic;
    const d1 = (Math.log(S / K) + 0.5 * v * v) / v, d2 = d1 - v;
    const c = S * ncdf(d1) - K * ncdf(d2);
    return type === 'CE' ? Math.max(c, intrinsic) : Math.max(c - S + K, intrinsic);
  }
  function solveIv(type, S, K, tau, price) {
    let lo = 0.01, hi = 2;
    for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (bs(type, S, K, tau, mid) > price) hi = mid; else lo = mid; }
    return (lo + hi) / 2;
  }
  const roundTick = p => Math.round(p / TICK) * TICK;

  /* ---------- market data: one bar per trading minute ---------- */
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const gauss = r => { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const HIST_START = dayIdx(RD.days[0]);
  if (RD.days.some((k, i) => DAYS[HIST_START + i].key !== k)) throw new Error('Real data days do not match the trading calendar');
  const BASE = HIST_START * SESSION;
  const barOf = (s, i) => s.c[i] == null ? null : { o: s.o[i], h: s.h[i], l: s.l[i], c: s.c[i], v: s.v ? s.v[i] : 0, oi: s.oi ? s.oi[i] : null };
  // The real index ends here (the close of the 12:58 pm candle); later minutes are simulated.
  const REAL_END_I = RD.series.NIFTY.c.length;
  const REAL_END_T = BASE + REAL_END_I;
  const SIM_END_T = tOf(TODAY, CLOSE);
  const IDX = [];
  for (let i = 0; i < REAL_END_I; i++) IDX.push(barOf(RD.series.NIFTY, i));
  {
    // Simulated rest of today: a random walk from the real close, sized to the last three sessions' 1-minute moves.
    const recent = IDX.slice(-3 * SESSION).filter(Boolean);
    let sq = 0; for (let k = 1; k < recent.length; k++) sq += (recent[k].c - recent[k - 1].c) ** 2;
    const sd = Math.sqrt(sq / Math.max(1, recent.length - 1));
    const r = rng(20261014);
    let last = IDX[REAL_END_I - 1].c;
    for (let i = REAL_END_I; i < SIM_END_T - BASE; i++) {
      const o = last, c = o + gauss(r) * sd;
      IDX.push({ o, c, h: Math.max(o, c) + Math.abs(gauss(r)) * sd * 0.35, l: Math.min(o, c) - Math.abs(gauss(r)) * sd * 0.35, v: 0, oi: null, sim: true });
      last = c;
    }
  }
  const lastBarBefore = (bars, T) => { for (let i = Math.min(bars.length, Math.ceil(T) - BASE) - 1; i >= 0; i--) if (bars[i]) return bars[i]; return null; };
  // Index level at trading time T. closing=true reads a session boundary as that day's close instead of the next day's open.
  const pathAt = (T, closing = false) => {
    const m = T - Math.floor(T / SESSION) * SESSION;
    if (closing && m === 0) { const b = lastBarBefore(IDX, T); return b ? b.c : IDX[0].o; }
    const i = Math.floor(T) - BASE;
    if (i < 0) return IDX[0].o;
    if (i >= IDX.length) return IDX[IDX.length - 1].c;
    const b = IDX[i] || lastBarBefore(IDX, T);
    return b.o + (b.c - b.o) * (T - Math.floor(T));
  };
  const DEFAULT_NOW = REAL_END_T; // 12:59 pm, Wed 14 Oct: the latest real data
  const S_DEFAULT = pathAt(DEFAULT_NOW);
  const PREV_CLOSE = pathAt(tOf(TODAY, OPEN), true);

  /* ---------- contracts ---------- */
  const tauOf = (expT, T) => Math.max(0, (expT - T) / YEAR);
  const termAdj = key => ({ '2026-10-19': 0.006, '2026-10-27': 0, '2026-11-03': -0.002 }[key] ?? -0.004);
  const smileShape = (K, key) => { const m = Math.log(K / S_DEFAULT); return termAdj(key) - 0.55 * m + 6 * m * m; };
  const realSeries = (type, strike, expKey) => RD.series[`${type}-${strike}-${expKey}`] || null;
  const realBars = {};
  function realBarsOf(key) {
    if (!realBars[key]) { const s = RD.series[key]; realBars[key] = []; for (let i = 0; i < Math.min(REAL_END_I, s.c.length); i++) realBars[key].push(barOf(s, i)); }
    return realBars[key];
  }
  // IV that matches a real price at time T (the open of that minute, or the last close before it).
  function realIvAt(type, strike, expKey, T) {
    const bars = realBarsOf(`${type}-${strike}-${expKey}`);
    const i = Math.floor(T) - BASE;
    const b = i < bars.length && bars[i] ? { p: bars[i].o } : (lastBarBefore(bars, T) ? { p: lastBarBefore(bars, T).c } : null);
    if (!b) return null;
    return solveIv(type, pathAt(T), strike, tauOf(expiryByKey(expKey).T, T), b.p);
  }
  // Smile base from the real 19 Oct 22500 pair at the end of the real data; other contracts use it.
  let BASE_IV;
  {
    const ivs = ['CE', 'PE'].map(t => realIvAt(t, 22500, '2026-10-19', REAL_END_T)).filter(v => v != null);
    BASE_IV = ivs.reduce((a, v) => a + v, 0) / ivs.length - smileShape(22500, '2026-10-19');
  }
  const smile = (K, key) => BASE_IV + smileShape(K, key);
  const CONTRACTS = {};
  function contract(type, strike, expKey) {
    const id = `NIFTY-${expKey}-${strike || ''}-${type}`;
    if (CONTRACTS[id]) return CONTRACTS[id];
    const e = expiryByKey(expKey);
    const real = type === 'FUT' ? null : realSeries(type, strike, expKey);
    const c = {
      id, und: 'NIFTY', type, strike, expKey, exp: e, expT: e.T,
      label: type === 'FUT' ? `NIFTY ${e.info.short} FUT` : `NIFTY ${e.info.short} ${strike} ${type === 'CE' ? 'Call' : 'Put'}`,
      tag: type === 'FUT' ? 'FUT' : type,
      real: real ? `${type}-${strike}-${expKey}` : null,
      iv: type === 'FUT' ? 0 : smile(strike, expKey)
    };
    // A contract with real data prices from its own IV: at Now while the data lasts, and from the last real minute after that.
    if (real) { c.ivEnd = realIvAt(type, strike, expKey, REAL_END_T); c.iv = c.ivEnd; }
    CONTRACTS[id] = c;
    return c;
  }
  const isReal = c => !!(c && c.real);
  // Re-read the IV of each real contract at time T, so its model price at Now equals its real price.
  function calibrate(T) {
    Object.values(CONTRACTS).forEach(c => {
      if (!c.real) return;
      c.iv = T < REAL_END_T ? (realIvAt(c.type, c.strike, c.expKey, T) ?? c.ivEnd) : c.ivEnd;
    });
  }
  // Model price of a contract at index level S and time T. ivShift moves IV in absolute points (BR-09 range).
  function price(c, S, T, ivShift = 0) {
    if (c.type === 'FUT') return S;
    return bs(c.type, S, c.strike, tauOf(c.expT, T), Math.max(0.01, c.iv + ivShift));
  }
  const intrinsic = (c, S) => c.type === 'FUT' ? S : c.type === 'CE' ? Math.max(0, S - c.strike) : Math.max(0, c.strike - S);

  // One bar per minute for a contract: real where there is data, otherwise modelled from the index bar of that minute.
  const optBarCache = {};
  function optionBars(c) {
    if (optBarCache[c.id]) return optBarCache[c.id];
    const real = c.real ? realBarsOf(c.real) : [];
    const r = rng(7 + (c.strike || 0) + (c.type === 'PE' ? 1 : 0));
    const realV = real.filter(Boolean).map(b => b.v).sort((a, b) => a - b);
    const medV = realV.length ? realV[Math.floor(realV.length / 2)] : 0;
    let oi = real.length ? (lastBarBefore(real, REAL_END_T) || {}).oi : null;
    const out = [];
    for (let i = 0; i < IDX.length; i++) {
      if (i < real.length && c.real) { out.push(real[i]); continue; }
      const x = IDX[i], T = BASE + i;
      if (!x) { out.push(null); continue; }
      const iv = c.real ? c.ivEnd : c.iv;
      const at = (S, t) => c.type === 'FUT' ? S : bs(c.type, S, c.strike, tauOf(c.expT, t), iv);
      const vh = at(c.type === 'PE' ? x.l : x.h, T + 0.5), vl = at(c.type === 'PE' ? x.h : x.l, T + 0.5);
      const o = at(x.o, T), cl = at(x.c, T + 1);
      const mod = i % SESSION, u = 0.55 + 0.9 * Math.pow(Math.abs(mod - 187) / 187, 2);
      const v = c.type === 'FUT' ? 0 : Math.round((medV || 40000) * u * (0.4 + r()));
      if (c.real) oi = Math.max(0, Math.round(oi + (r() - 0.5) * 6000));
      else oi = Math.round((22e5 + 9e5 * Math.sin(i / 900) + 3e5 * Math.sin(i / 97)) * (c.type === 'PE' ? 1.25 : 1));
      out.push({ o, h: Math.max(o, cl, vh), l: Math.min(o, cl, vl), c: cl, v, oi, sim: true });
    }
    optBarCache[c.id] = out;
    return out;
  }
  // Price of a contract at time T: the open of that minute's bar, or the last close before it.
  function optionPriceAt(c, T) {
    const bars = optionBars(c), i = Math.floor(T) - BASE;
    if (i >= 0 && i < bars.length && bars[i]) return bars[i].o;
    const b = lastBarBefore(bars, T);
    return b ? b.c : price(c, pathAt(T), T);
  }
  // Price at an instant inside a minute, moving from that bar's open to its close, as pathAt does for the index.
  function optionAt(c, T) {
    const bars = optionBars(c), i = Math.floor(T) - BASE;
    const b = i >= 0 && i < bars.length ? bars[i] : null;
    return b ? b.o + (b.c - b.o) * (T - Math.floor(T)) : optionPriceAt(c, T);
  }
  // The close of the last bar that ended at or before T (e.g. the previous session's close).
  function optionCloseBefore(c, T) { const b = lastBarBefore(optionBars(c), T); return b ? b.c : price(c, pathAt(T, true), T); }

  // Candles of tf minutes from 1-minute bars. Each session starts its own candles at 9:15 am, so 2m, 10m,
  // 30m and 1h candles never run across the night; the last one of a day can be shorter.
  function aggregate(bars, tf, fromT, toT) {
    const out = [];
    for (let d = Math.max(HIST_START, Math.floor(fromT / SESSION)); d * SESSION < toT; d++) {
      const d0 = d * SESSION;
      for (let a = d0; a < d0 + SESSION && a < toT; a += tf) {
        const end = Math.min(a + tf, d0 + SESSION), b = Math.min(end, toT);
        if (b <= fromT) continue;
        let o = null, h = -Infinity, l = Infinity, cl = null, v = 0, oi = null, sim = false;
        for (let t = a; t < b; t++) {
          const x = bars[t - BASE];
          if (!x) continue;
          if (o === null) o = x.o;
          if (x.h > h) h = x.h; if (x.l < l) l = x.l;
          cl = x.c; v += x.v || 0; if (x.oi != null) oi = x.oi; if (x.sim) sim = true;
        }
        if (o === null) continue;
        out.push({ t0: a, t1: end, o, h, l, c: cl, v, oi, sim });
      }
    }
    return out;
  }
  const indexCandles = (tf, fromT, toT) => aggregate(IDX, tf, fromT, toT);
  const optionCandles = (c, tf, fromT, toT) => aggregate(optionBars(c), tf, fromT, toT);

  /* ---------- formatting ---------- */
  const inr = (n, dec = 0) => {
    const neg = n < 0; n = Math.abs(n);
    const [i, f] = n.toFixed(dec).split('.');
    const last3 = i.slice(-3), rest = i.slice(0, -3);
    const g = rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3 : last3;
    return { neg, s: f ? `${g}.${f}` : g };
  };
  const rupees = (n, dec = 0) => { const r = inr(n, dec); return `${r.neg ? '−' : ''}₹${r.s}`; };
  // Round half away from zero, so a loss and the matching gain show the same rupees.
  const signed = (n, dec = 0) => { const v = Math.sign(n) * Math.round(Math.abs(n) * 10 ** dec) / 10 ** dec; const r = inr(v, dec); return `${v > 0 ? '+' : v < 0 ? '−' : ''}₹${r.s}`; };
  const level = n => inr(Math.round(n)).s;
  const px = n => n.toFixed(2);
  const prem = n => rupees(n, 2);
  // The index level at a contract's expiry, used to settle it.
  const settleS = c => pathAt(c.expT, true);

  return {
    OPEN, CLOSE, SESSION, YEAR, SQOFF, LOT, TICK, HOLIDAYS, DAYS, TODAY, EXPIRIES, DEFAULT_NOW, S_DEFAULT, PREV_CLOSE, HIST_START, REAL_END_T, SOURCE: RD.source,
    baseIv: () => BASE_IV, tOf, split, fmtT, clock, dayOfT, dayIdx, dateInfo, expiryByKey, bs, solveIv, roundTick, pathAt, contract, isReal, calibrate, price, intrinsic,
    optionPriceAt, optionAt, optionCloseBefore, indexCandles, optionCandles, tauOf, inr, rupees, signed, level, px, prem, settleS, rng
  };
})();
if (typeof module !== 'undefined') module.exports = Engine;
