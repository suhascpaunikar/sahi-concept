/* =====================================================================
   Engine: trading calendar, option model, sample market data, payoff maths.
   All prices are generated sample data for Tue 13 Oct 2026. Nothing here
   is market data. The model follows the research: Black-Scholes on a
   trading-time clock (375 minutes a session, 252 sessions a year), priced
   off the index with IV held at its current level (BR-08).
   ===================================================================== */
const Engine = (() => {
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
  for (let t = Date.UTC(2026, 8, 28); t <= Date.UTC(2026, 11, 31); t += 864e5) {
    const key = isoOf(t);
    const dow = new Date(t).getUTCDay();
    if (dow === 0 || dow === 6 || HOLIDAYS[key]) continue;
    DAYS.push(dateInfo(key));
  }
  const dayIdx = key => DAYS.findIndex(d => d.key === key);
  const TODAY = dayIdx('2026-10-13');
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

  /* ---------- sample index path (one value per trading minute) ---------- */
  function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const gauss = r => { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const HIST_START = dayIdx('2026-10-08');
  const PREV_CLOSE = 22363.35;
  const ANCHORS = {
    '2026-10-08': [[555, 22512], [610, 22548], [680, 22470], [760, 22430], [840, 22495], [930, 22468.4]],
    '2026-10-09': [[555, 22455], [600, 22392], [700, 22340], [790, 22410], [860, 22372], [930, 22398.9]],
    '2026-10-12': [[555, 22420], [640, 22465], [720, 22390], [800, 22330], [880, 22385], [930, 22363.35]],
    '2026-10-13': [[555, 22402], [585, 22472], [615, 22540], [640, 22518], [660, 22650], [675, 22721.95], [720, 22690], [765, 22738], [810, 22762], [855, 22714], [900, 22748], [930, 22731.6]]
  };
  const PATH = [];
  const DAY_CLOSE = {};
  {
    const r = rng(20261013);
    Object.keys(ANCHORS).forEach(key => {
      const a = ANCHORS[key];
      const day = [a[0][1]];
      for (let s = 0; s < a.length - 1; s++) {
        const [m0, v0] = a[s], [m1, v1] = a[s + 1];
        const n = m1 - m0;
        const w = [0];
        for (let i = 1; i <= n; i++) w.push(w[i - 1] + gauss(r) * 5.2);
        for (let i = 1; i <= n; i++) day.push(v0 + (v1 - v0) * i / n + (w[i] - w[n] * i / n));
      }
      // day has 376 values: 9:15 .. 15:30 inclusive. Store 375 minute opens plus the close at the boundary.
      day.forEach((v, i) => { if (i < SESSION) { const T = tOf(dayIdx(key), OPEN) + i; PATH[T - HIST_START * SESSION] = v; } });
      DAY_CLOSE[dayIdx(key)] = day[SESSION];
    });
  }
  // closing=true reads a session boundary as that day's close instead of the next day's open.
  const pathAt = (T, closing = false) => {
    if (closing && T % SESSION === 0 && DAY_CLOSE[T / SESSION - 1] !== undefined) return DAY_CLOSE[T / SESSION - 1];
    if (!closing && T % SESSION !== 0 && DAY_CLOSE[Math.floor(T / SESSION)] !== undefined && T - Math.floor(T / SESSION) * SESSION > SESSION - 1) {
      const di = Math.floor(T / SESSION), f = T - di * SESSION - (SESSION - 1);
      return PATH[di * SESSION + SESSION - 1 - HIST_START * SESSION] * (1 - f) + DAY_CLOSE[di] * f;
    }
    const i = T - HIST_START * SESSION;
    const i0 = Math.max(0, Math.min(PATH.length - 1, Math.floor(i))), i1 = Math.min(PATH.length - 1, i0 + 1);
    const f = i - Math.floor(i);
    return PATH[i0] * (1 - f) + PATH[i1] * f;
  };

  /* ---------- contracts ---------- */
  const DEFAULT_NOW = tOf(TODAY, 675); // 11:15 am, Tue 13 Oct
  const S_DEFAULT = 22721.95;
  const SHOT = { type: 'CE', strike: 22500, exp: '2026-10-27', ltp: 470.0, prevClose: 203.65 };
  const tauOf = (expT, T) => Math.max(0, (expT - T) / YEAR);
  const termAdj = key => ({ '2026-10-13': 0.032, '2026-10-19': 0.006, '2026-10-27': 0, '2026-11-03': -0.002 }[key] ?? -0.004);
  const smile = (K, key, base) => { const m = Math.log(K / S_DEFAULT); return base + termAdj(key) - 0.55 * m + 6 * m * m; };
  let BASE_IV;
  {
    const e = expiryByKey(SHOT.exp);
    const ivShot = solveIv('CE', S_DEFAULT, SHOT.strike, tauOf(e.T, DEFAULT_NOW), SHOT.ltp);
    BASE_IV = ivShot - (smile(SHOT.strike, SHOT.exp, 0));
  }
  const CONTRACTS = {};
  function contract(type, strike, expKey) {
    const id = `NIFTY-${expKey}-${strike || ''}-${type}`;
    if (CONTRACTS[id]) return CONTRACTS[id];
    const e = expiryByKey(expKey);
    const c = {
      id, und: 'NIFTY', type, strike, expKey, exp: e, expT: e.T,
      label: type === 'FUT' ? `NIFTY ${e.info.short} FUT` : `NIFTY ${e.info.short} ${strike} ${type === 'CE' ? 'Call' : 'Put'}`,
      tag: type === 'FUT' ? 'FUT' : type,
      iv: type === 'FUT' ? 0 : smile(strike, expKey, BASE_IV)
    };
    CONTRACTS[id] = c;
    return c;
  }
  // Model price of a contract at index level S and time T. ivShift moves IV in absolute points (BR-09 range).
  function price(c, S, T, ivShift = 0) {
    if (c.type === 'FUT') return S;
    return bs(c.type, S, c.strike, tauOf(c.expT, T), Math.max(0.01, c.iv + ivShift));
  }
  const intrinsic = (c, S) => c.type === 'FUT' ? S : c.type === 'CE' ? Math.max(0, S - c.strike) : Math.max(0, c.strike - S);

  // Option price history for the option chart: IV drifts from the level that gives the screenshot's previous close.
  const optHistCache = {};
  function optionPathAt(c, T, closing = false) {
    if (c.type === 'FUT') return pathAt(T, closing);
    let ivPrev = optHistCache[c.id];
    if (ivPrev === undefined) {
      const prevT = tOf(dayIdx('2026-10-12'), CLOSE);
      const isShot = c.type === SHOT.type && c.strike === SHOT.strike && c.expKey === SHOT.exp;
      ivPrev = isShot ? solveIv('CE', PREV_CLOSE, c.strike, tauOf(c.expT, prevT), SHOT.prevClose) : c.iv + 0.01;
      optHistCache[c.id] = ivPrev;
    }
    const t0 = tOf(dayIdx('2026-10-12'), CLOSE), t1 = DEFAULT_NOW;
    const f = Math.max(0, Math.min(1, (T - t0) / (t1 - t0)));
    const iv = T < t0 ? ivPrev + 0.004 * Math.sin(T / 37) : ivPrev + (c.iv - ivPrev) * f;
    return bs(c.type, pathAt(T, closing), c.strike, tauOf(c.expT, T), iv);
  }
  // floor: lowest value a series can take (0 for option prices).
  function candles(tf, fromT, toT, valueAt, seed, floor = -Infinity) {
    const r = rng(seed);
    const out = [];
    const s0 = Math.floor(fromT / tf), s1 = Math.ceil(toT / tf);
    for (let s = s0; s < s1; s++) {
      const a = s * tf, b = Math.min((s + 1) * tf, toT);
      if (b <= a) continue;
      let o = valueAt(a, false), c = valueAt(b, true), h = Math.max(o, c), l = Math.min(o, c);
      for (let m = a + 1; m < b; m++) { const v = valueAt(m); if (v > h) h = v; if (v < l) l = v; }
      // wick size scales with the price, so a ₹0.05 option doesn't get ₹0.60 wicks
      const span = Math.max(Math.min(0.6, Math.abs(o) * 0.01), (h - l) * 0.18);
      h += r() * span; l = Math.max(floor, l - r() * span);
      const mod = (a % SESSION);
      const u = 0.55 + 0.9 * Math.pow(Math.abs(mod - 187) / 187, 2);
      out.push({ s, o, h, l, c, v: u * (0.4 + r()) });
    }
    return out;
  }

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
    OPEN, CLOSE, SESSION, YEAR, SQOFF, LOT, TICK, HOLIDAYS, DAYS, TODAY, EXPIRIES, DEFAULT_NOW, S_DEFAULT, PREV_CLOSE, SHOT, BASE_IV, HIST_START,
    tOf, split, fmtT, clock, dayOfT, dateInfo, expiryByKey, bs, solveIv, roundTick, pathAt, contract, price, intrinsic, optionPathAt, candles, tauOf,
    inr, rupees, signed, level, px, prem, settleS, rng
  };
})();
if (typeof module !== 'undefined') module.exports = Engine;
