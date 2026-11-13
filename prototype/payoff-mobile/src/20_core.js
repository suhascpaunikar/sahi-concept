'use strict';
/* =========================================================================
   Sahi Payoff on mobile (Payoff mobile PRD v1.0), on the Option Scalper
   rebuild from the Quick Action Wheel placement study. Of the six placements
   only V6 remains (hold the timeframe button for a panel of quick actions),
   with Payoff as one of the actions.
   Reference frame: Android, 412 x 915 CSS px.
   ========================================================================= */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const now = () => performance.now();
const hyp = (dx, dy) => Math.hypot(dx, dy);
const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
const app = $('#app');
const store = {
  get(k, d) { try { const v = localStorage.getItem('sahi.pom.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('sahi.pom.' + k, JSON.stringify(v)); } catch {} },
};
const sstore = {
  get(k, d) { try { const v = sessionStorage.getItem('sahi.pom.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { sessionStorage.setItem('sahi.pom.' + k, JSON.stringify(v)); } catch {} },
};
const isNative = () => window.matchMedia('(max-width: 560px)').matches;

/* ---- Icons: Lucide paths (ISC) where Sahi uses them, custom paths for the rest ---- */
const P = {
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  moveH: '<path d="m18 8 4 4-4 4"/><path d="M2 12h20"/><path d="m6 8-4 4 4 4"/>',
  pen: '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  grid: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  share: '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" x2="12" y1="2" y2="15"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  scan: '<path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  /* custom */
  tfmenu: '<path d="M.6 .6h11.4"/><path d="M.6 4.1h11.4"/><path d="M.6 7.6h5.8"/><path d="m8 6.5 2.1 2 2.1-2"/>',
  chev: '<path d="M3.3 4.5 6 1.1l2.7 3.4"/><path d="M3.3 7.5 6 10.9l2.7-3.4"/>',
  rot: '<rect x="12.6" y="9.4" width="6.9" height="11.4" rx="1.9" transform="rotate(-38 16 16)"/><path d="M19.2 7.6a9.3 9.3 0 0 1 4.6 7.7"/><path d="m18.6 9.6.5-2-2-.6"/><path d="M12.8 24.4A9.3 9.3 0 0 1 8.2 16.7"/><path d="m13.4 22.4-.5 2 2 .6"/>',
  ai: '<path d="M16 6.5v5.2M16 20.3v5.2M6.5 16h5.2M20.3 16h5.2"/><path d="m13.9 12.4 2.1 1.6 2.1-1.6M13.9 19.6l2.1-1.6 2.1 1.6M12.4 13.9l1.6 2.1-1.6 2.1M19.6 13.9 18 16l1.6 2.1"/>',
  fx: '<path d="M10.5 4.5c-1.6-.4-3 .5-3.2 2.4L6.1 18.4c-.2 1.7-1.6 2.6-3.1 2.2"/><path d="M4.5 10.5h6"/><path d="m13.5 13.5 6 6M19.5 13.5l-6 6"/>',
  trend: '<path d="M5.5 18.5 18.5 5.5"/><circle cx="4.5" cy="19.5" r="2"/><circle cx="19.5" cy="4.5" r="2"/>',
  fib: '<path d="M3 5h18"/><path d="M3 9.5h14"/><path d="M3 14h10"/><path d="M3 18.5h18"/>',
  vwap: '<path d="M3 16.5c2.2-4.8 4.4-4.8 6.6-1.6s4.4 2.9 6.6-3.4 3.3-5.3 4.8-5.5"/><circle cx="9.6" cy="14.9" r="1.4"/>',
  ema: '<path d="M3 18c3.4-.3 5.2-2.2 7-6.2s3.6-5.6 11-5.8"/><path d="M3 21h18" opacity=".45"/>',
  hline: '<path d="M3 12h18"/><circle cx="12" cy="12" r="2"/>',
  rect: '<rect x="4" y="6" width="16" height="12" rx="1.5"/>',
  ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/>',
  payoff: '<path d="M2.5 17h8.2L21.5 6.2"/><path d="M2.5 13.9c4.4 0 7.6-.9 10.6-3S18.4 6.5 21.5 4.6" stroke-dasharray="2.3 2.1"/>',
  minus: '<path d="M5 12h14"/>',
  chevL: '<path d="m15 18-6-6 6-6"/>',
  flash: '<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2z"/>',
  chevR: '<path d="m9 18 6-6-6-6"/>',
  info: '<circle cx="12" cy="12" r="9.2"/><path d="M12 16.2v-4.6"/><path d="M12 8.1h.01"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.8V5h6v5.8l2.4 3.2H6.6z"/>',
  dots3: '<circle cx="12" cy="5.2" r="1.9" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none"/><circle cx="12" cy="18.8" r="1.9" fill="currentColor" stroke="none"/>',
  /* chart type icons (Settings sheet) */
  ct_line: '<path d="M2.6 17.6 8.4 11.1l4.3 4 5.5-6.6 3.4 2.6"/>',
  ct_step: '<path d="M2.6 18h4.3v-5.2h5.6v2.6h3.9V8.4h5.2"/>',
  ct_area: '<path d="M2.6 15.6 8.4 10.2l4.3 3.4 5.5-5.8 3.4 2.6V19H2.6Z" fill="#5c5c5c" stroke="none"/><path d="M2.6 15.6 8.4 10.2l4.3 3.4 5.5-5.8 3.4 2.6"/>',
  ct_candle: '<path d="M7.8 2.8v18.4M16.2 5v17"/><rect x="5.6" y="6.6" width="4.4" height="10.3" rx=".9" fill="currentColor"/><rect x="14" y="8.4" width="4.4" height="10" rx=".9" fill="currentColor"/>',
  ct_ha: '<path d="M6.7 13v4.6M12.5 16.3v4.6M18.9 2.6v4"/><rect x="4.3" y="3.6" width="4.8" height="9.6" rx=".9" fill="currentColor"/><rect x="10.1" y="8" width="4.8" height="9" rx=".9" fill="currentColor"/><rect x="16.5" y="6.4" width="4.8" height="8.6" rx=".9"/>',
  ct_hollow: '<path d="M7.8 2.8v3.8M7.8 16.9v4.3M16.2 5v3.4M16.2 18.4V22"/><rect x="5.6" y="6.6" width="4.4" height="10.3" rx=".9"/><rect x="14" y="8.4" width="4.4" height="10" rx=".9"/>',
  ct_renko: '<rect x="2.4" y="15" width="5" height="5" rx="1"/><rect x="7.4" y="10" width="5" height="5" rx="1"/><rect x="12.4" y="5" width="5" height="5" rx="1" fill="currentColor"/><rect x="16.6" y="10" width="5" height="5" rx="1" fill="currentColor"/>',
};
function ic(name, size = 16, sw = 2, cls = '') {
  return `<svg class="ico ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" stroke-width="${sw}" aria-hidden="true">${P[name]}</svg>`;
}
function ic32(name, size, sw) { return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 32 32" stroke-width="${sw}" aria-hidden="true">${P[name]}</svg>`; }
const LOGO = `<svg viewBox="0 0 21 18" width="21" height="18" aria-hidden="true"><g fill="#ececec" stroke="#141414" stroke-width=".7" stroke-linejoin="round">
  <path d="M12.4 1.2h7.3l-1.6 3.4h-7.3z"/><path d="M3.8 5.3h7.3L9.5 8.7H2.2z"/><path d="M11.6 5.3h7.3l-1.6 3.4H10z"/>
  <path d="M3.1 9.3h7.3l-1.6 3.4H1.5z"/><path d="M10.9 9.3h7.3l-1.6 3.4H9.3z"/><path d="M2.4 13.3h7.3l-1.6 3.4H.8z"/></g></svg>`;

/* =========================================================================
   Frames. The reference frame is the phone your screenshots came from.
   ========================================================================= */
const FRAMES = {
  ref: { w: 412, h: 915, sat: 48, sab: 12, os: 'android', label: 'Android 412 × 915', note: 'your screenshots' },
  small: { w: 360, h: 800, sat: 36, sab: 12, os: 'android', label: 'Android 360 × 800', note: 'small Android' },
  iphone: { w: 390, h: 844, sat: 47, sab: 34, os: 'ios', label: 'iPhone 390 × 844', note: 'iPhone 13–16' },
  max: { w: 430, h: 932, sat: 59, sab: 34, os: 'ios', label: 'iPhone 430 × 932', note: 'Pro Max' },
};

/* =========================================================================
   Session state
   ========================================================================= */
const S = {
  frame: 'ref', haptics: true, sound: false, touches: false, qa: 'pills',
  linked: false, focus: 'opt', split: .5, fontsReady: false,
  fs: 1, order: false,
};

/* ---- Event log (no prices, symbols only as chart ids) ---- */
const LOG = [];
let IID = 0;
function track(event, props = {}) {
  const e = { t: Math.round(performance.now()), event, ...props };
  LOG.push(e); if (LOG.length > 400) LOG.shift();
  if (typeof renderLog === 'function') renderLog();
  return e;
}

/* ---- Haptics: Vibration API on Android, iOS 18 switch tick. No visual pulse: the ring that used to mark a pick was removed ---- */
const Haptic = (() => {
  const K = { open: { vib: 10, label: 'Light impact', why: 'panel opened' }, select: { vib: 6, label: 'Selection', why: 'hovered action changed' }, success: { vib: [12, 45, 18], label: 'Success', why: 'change applied' }, error: { vib: [26, 60, 26], label: 'Warning', why: 'not available' }, cancel: { vib: 4, label: 'Soft', why: 'released to cancel' } };
  const canVibrate = typeof navigator.vibrate === 'function';
  let iosLabel = null, actx = null, lastSel = -1e9, dotT = 0;
  function iosTick() {
    try {
      if (!iosLabel) {
        iosLabel = document.createElement('label'); iosLabel.setAttribute('aria-hidden', 'true');
        iosLabel.style.cssText = 'position:fixed;left:-200px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
        const inp = document.createElement('input'); inp.type = 'checkbox'; inp.setAttribute('switch', ''); inp.tabIndex = -1;
        iosLabel.appendChild(inp); document.body.appendChild(iosLabel);
      }
      iosLabel.click();
    } catch {}
  }
  function sound(kind) {
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime, beeps = kind === 'success' ? [0, .06] : [0];
      beeps.forEach((d, k) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.frequency.value = kind === 'select' ? 1800 : kind === 'open' ? 900 : kind === 'error' ? 300 : kind === 'cancel' ? 500 : (k ? 1320 : 990);
        g.gain.setValueAtTime(.0001, t + d); g.gain.exponentialRampToValueAtTime(kind === 'select' ? .05 : .09, t + d + .004); g.gain.exponentialRampToValueAtTime(.0001, t + d + .05);
        o.connect(g).connect(actx.destination); o.start(t + d); o.stop(t + d + .07);
      });
    } catch {}
  }
  function meter(kind) {
    const dot = $('#hDot'), txt = $('#hTxt'); if (!dot) return;
    dot.classList.remove('fire'); void dot.offsetWidth; dot.classList.add('fire'); clearTimeout(dotT); dotT = setTimeout(() => dot.classList.remove('fire'), 140);
    const p = K[kind]; txt.innerHTML = `<b>${p.label}</b> · ${p.why} · ${Array.isArray(p.vib) ? p.vib.join('/') : p.vib} ms`;
  }
  function fire(kind, at) {
    if (!S.haptics) return;
    if (kind === 'select') { const t = now(); if (t - lastSel < 50) return; lastSel = t; }
    if (canVibrate) { try { navigator.vibrate(K[kind].vib); } catch {} }
    else { iosTick(); if (kind === 'success') setTimeout(iosTick, 70); }
    if (S.sound) sound(kind);
    meter(kind);
  }
  return { fire, canVibrate };
})();

/* ---- Toast and screen-reader announcements ---- */
let toastT = 0;
function toast(msg, ok = false) {
  const t = $('#toast');
  t.innerHTML = (ok ? `<span class="tk">${ic('check', 12, 3)}</span>` : '') + `<span>${msg}</span>`;
  t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200);
  say(msg);
}
function say(msg) { const l = $('#sr'); l.textContent = ''; setTimeout(() => { l.textContent = msg; }, 30); }

/* =========================================================================
   Market data: real 1-minute candles from Zerodha Kite (prototype/payoff/src/
   data.js) for NIFTY 50 and the NIFTY 19 Oct 22500 Call and Put, Tue 29 Sep
   to 12:59 pm on Wed 14 Oct 2026, read through the desktop Payoff engine.
   Later minutes are simulated and other contracts are modelled from the real
   index (Engine). Chart times are calendar minutes from Mon 28 Sep 2026 00:00
   (day 0 is a Monday); T is the engine's trading time (375 minutes a session,
   no width for nights and holidays).
   ========================================================================= */
const E = Engine, PF = Payoff;
const CAL0 = Date.UTC(2026, 8, 28);
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gaussOf(r) { return () => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }; }
const OPEN_MIN = 9 * 60 + 15, DAY = 1440;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const tick = (v, t = .05) => Math.round(v / t) * t;
const calDay = di => Math.round((Date.UTC(E.DAYS[di].y, E.DAYS[di].m, E.DAYS[di].d) - CAL0) / 864e5);
// a candle's start (trading time) as calendar minutes; a session boundary reads as 9:15 am of the next session
const calStart = T => { const di = Math.floor(T / E.SESSION + 1e-9); return calDay(di) * DAY + OPEN_MIN + (T - di * E.SESSION); };
// a moment such as a candle's close; a session boundary reads as 3:30 pm of the session it ends
const calEnd = T => { const { di, mod } = E.split(T); return calDay(di) * DAY + mod; };

/* ---- Market clock: "now" defaults to the last real minute, 12:59 pm on Wed 14 Oct ---- */
const REAL_END_MOD = E.REAL_END_T - E.tOf(E.TODAY, E.OPEN) + E.OPEN;
const MK = {
  mod: REAL_END_MOD, sec: 0, noise: 0, pricing: 'live',
  opt: E.contract('CE', 22500, '2026-10-19'),
  closed() { return this.mod >= E.CLOSE; },
  nowT() { return this.closed() ? E.tOf(E.TODAY, E.CLOSE) : E.tOf(E.TODAY, this.mod); },
  ticking() { return this.pricing === 'live' && !this.closed(); },
  S0() { return E.pathAt(this.nowT(), this.closed()) + (this.ticking() ? this.noise : 0); },
  optLtp(c = this.opt) {
    if (!c) return 0;
    if (c.type !== 'FUT' && c.expT <= this.nowT()) return E.roundTick(E.intrinsic(c, E.settleS(c)));
    return Math.max(E.TICK, E.roundTick(E.price(c, this.S0(), this.nowT())));
  },
};
const DATA = { idx: {}, opt: {} };
function resetData(id) {
  (id ? [id] : ['idx', 'opt']).forEach(k => { DATA[k] = {}; if (typeof CH !== 'undefined' && CH[k]) { CH[k]._ic = {}; CH[k]._rk = null; } });
}
function engineBars(id, tfMin) {
  const T1 = MK.nowT(), T0 = E.HIST_START * E.SESSION;
  const raw = id === 'idx' ? E.indexCandles(tfMin, T0, T1) : (MK.opt ? E.optionCandles(MK.opt, tfMin, T0, T1) : []);
  return raw.map(b => ({ t: calStart(b.t0), T0: b.t0, T1: b.t1, o: b.o, h: b.h, l: b.l, c: b.c }));
}

/* bridge one bar into n sub-bars that keep its open, high, low and close */
function bridge(b, n, r, g, step) {
  if (b.e) return Array.from({ length: n }, (_, k) => ({ t: b.t + k * step, o: b.c, h: b.c, l: b.c, c: b.c, e: true }));
  const pts = [b.o];
  for (let k = 1; k < n; k++) { const prev = pts[k - 1], left = n - k; pts.push(prev + (b.c - prev) / (left + 1) + g() * (b.h - b.l) * .22); }
  pts.push(b.c);
  const out = [];
  for (let k = 0; k < n; k++) {
    const o = clamp(pts[k], b.l, b.h), c = clamp(pts[k + 1], b.l, b.h), w = (b.h - b.l) * .12;
    out.push({ t: b.t + k * step, o, c, h: clamp(Math.max(o, c) + Math.abs(g()) * w, b.l, b.h), l: clamp(Math.min(o, c) - Math.abs(g()) * w, b.l, b.h) });
  }
  const ih = Math.floor(r() * n), il = Math.floor(r() * n);
  out[ih].h = b.h; out[il].l = b.l;
  out.forEach(x => { x.o = tick(x.o); x.c = tick(x.c); x.h = tick(Math.max(x.h, x.o, x.c)); x.l = tick(Math.min(x.l, x.o, x.c)); });
  return out;
}
const TF = {
  '5s': 5 / 60, '15s': .25, '30s': .5, '1m': 1, '2m': 2, '3m': 3, '5m': 5, '10m': 10, '15m': 15, '25m': 25, '30m': 30, '75m': 75, '125m': 125,
  '1h': 60, '2h': 120, '3h': 180, '4h': 240, '1D': 1440, '1W': 10080, '1M': 43200,
};
const TF_GROUPS = [['Second', ['5s', '15s', '30s']], ['Minute', ['1m', '2m', '3m', '5m', '10m', '15m', '25m', '30m', '75m', '125m']], ['Hour', ['1h', '2h', '3h', '4h']], ['Day', ['1D', '1W', '1M']]];
const tfName = tf => ({ '1h': '1 hour', '2h': '2 hours', '3h': '3 hours', '4h': '4 hours', '1D': '1 day', '1W': '1 week', '1M': '1 month' }[tf] || tf);
function daily(id) {
  const d = DATA[id];
  if (d.D) return d.D;
  const intraday = engineBars(id, E.SESSION).map(b => ({ ...b, t: Math.floor(b.t / DAY) * DAY }));
  if (!intraday.length) return (d.D = []);
  const first = intraday[0], r = mulberry(id === 'idx' ? 5 : 9), g = gaussOf(r), sig = id === 'idx' ? .009 : .08;
  const hist = []; let cur = first.o, day = Math.floor(first.t / DAY);
  for (let k = 0; k < 360; k++) {
    day -= 1; const dow = ((day % 7) + 7) % 7; if (dow === 5 || dow === 6) { k--; continue; }   // day 0 is a Monday
    const c = cur, o = c * Math.exp(-g() * sig), hi = Math.max(o, c) * (1 + Math.abs(g()) * sig * .5), lo = Math.min(o, c) * (1 - Math.abs(g()) * sig * .5);
    hist.unshift({ t: day * DAY, o: tick(o), h: tick(hi), l: tick(lo), c: tick(c) }); cur = o;
  }
  return (d.D = [...hist, ...intraday]);
}
function calAgg(bars, keyFn) {
  const out = []; let cur = null, key = null;
  for (const b of bars) { const k = keyFn(b.t); if (k !== key) { if (cur) out.push(cur); key = k; cur = { ...b }; } else { cur.h = Math.max(cur.h, b.h); cur.l = Math.min(cur.l, b.l); cur.c = b.c; if (b.T1 != null) cur.T1 = b.T1; } }
  if (cur) out.push(cur); return out;
}
const dayDate = t => new Date(CAL0 + Math.floor(t / DAY) * 864e5);
function getBars(id, tf) {
  const d = DATA[id];
  if (d[tf]) return d[tf];
  let out;
  const m = TF[tf];
  if (m < 1) {
    const per = Math.round(1 / m), one = getBars(id, '1m').slice(-480), r = mulberry(7 + per), g = gaussOf(r);
    out = one.flatMap(b => bridge(b, per, r, g, m).map((x, k) => ({ ...x, T0: b.T0 + k * m, T1: b.T0 + (k + 1) * m })));
  } else if (m < 1440) out = engineBars(id, m);
  else if (tf === '1D') out = daily(id);
  else if (tf === '1W') out = calAgg(daily(id), t => Math.floor(Math.floor(t / DAY) / 7));
  else out = calAgg(daily(id), t => { const dt = dayDate(t); return dt.getUTCFullYear() * 12 + dt.getUTCMonth(); });
  return (d[tf] = out);
}
