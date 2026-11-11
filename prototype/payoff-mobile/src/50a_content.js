/* =========================================================================
   The seven actions. Same set and order in every placement (PRD v1.4), with
   slot 7 changed from Clean View to Payoff (Payoff mobile PRD v1.0, BR-32).
   ========================================================================= */
const SLOTS = [
  { id: 'tfA', kind: 'tf', tf: '1m' },
  { id: 'tfB', kind: 'tf', tf: '15m' },
  { id: 'trend', kind: 'tool', tool: 'trend', icon: 'trend' },
  { id: 'fib', kind: 'tool', tool: 'fib', icon: 'fib' },
  { id: 'vwap', kind: 'ind', ind: 'vwap', icon: 'vwap' },
  { id: 'ema', kind: 'ind', ind: 'ema', icon: 'ema' },
  { id: 'payoff', kind: 'payoff', icon: 'payoff' },
];
/* Label sets for the label stress test (placements PRD v1.1, section 15).
   Each action has [label it asks for in the wheel, authored short label, full name].
   For indicators the short label is the chart legend's own short name. Only names change:
   the chart still draws VWAP and EMA, and timeframe slots use real intervals from the catalogue. */
const LABELSETS = {
  default: { name: 'Default', note: 'Shipping defaults', tf: ['1m', '15m'], a: {
    trend: ['Trend', 'Trend', 'Trend line'], fib: ['Fib', 'Fib', 'Fib retracement'], vwap: ['VWAP', 'VWAP', 'VWAP'], ema: ['EMA 20', 'EMA 20', 'EMA 20'], payoff: ['Payoff', 'Payoff', 'Payoff'] } },
  presets: { name: 'Own presets', note: 'Any interval and other VWAP and EMA presets, as the MVP allows', tf: ['125m', '1D'], a: {
    trend: ['Trend', 'Trend', 'Trend line'], fib: ['Fib', 'Fib', 'Fib retracement'], vwap: ['VWAP · weekly', 'VWAP W', 'VWAP · weekly'], ema: ['EMA 200', 'EMA 200', 'EMA 200 · close'], payoff: ['Payoff', 'Payoff', 'Payoff'] } },
  any: { name: 'Any indicator', note: 'If any tool or indicator can go in a slot (after the MVP)', tf: ['125m', '3h'], a: {
    trend: ['Parallel channel', 'Channel', 'Parallel channel'], fib: ['Fib extension', 'Fib ext', 'Trend-based Fib extension'], vwap: ['Supertrend 10 3', 'ST 10 3', 'Supertrend (10, 3)'], ema: ['Bollinger Bands', 'BB 20 2', 'Bollinger Bands (20, 2)'], payoff: ['Payoff', 'Payoff', 'Payoff'] } },
  full: { name: 'Full names', note: 'Catalogue names typed in full, and long chart names', tf: ['125m', '75m'], chart: { idx: ['NIFTY FIN SERVICE', 'FINNIFTY'], opt: ['25 Nov 23500', '23500 CE'] }, a: {
    trend: ['Trend line', 'Trend', 'Trend line'], fib: ['Fibonacci retracement', 'Fib', 'Fibonacci retracement'], vwap: ['Volume Weighted Average Price (VWAP)', 'VWAP', 'Volume Weighted Average Price (VWAP)'], ema: ['Exponential Moving Average (EMA) 200', 'EMA 200', 'Exponential Moving Average (EMA) 200'], payoff: ['Payoff', 'Payoff', 'Payoff: breakeven and P&L'] } },
};
let LS = LABELSETS.default;
// a slot the trader picked carries its own names (lab); the default slots take theirs from the label set
const act = id => { const s = SLOTS.find(x => x.id === id), [label, short, name] = s && s.lab ? s.lab : LS.a[id]; return { label, short, name }; };
const escH = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// tool names read mid-sentence in lower case ("Draw trend line"), except Fib and acronyms
const midS = s => /^(Fib|[A-Z]{2})/.test(s) ? s : s[0].toLowerCase() + s.slice(1);
function describe(slot, id) {
  const c = CH[id];
  if (slot.kind === 'empty') return { label: 'Empty', short: 'Empty', name: 'Empty slot', icon: 'flash', cap: '', status: 'na', verb: `Add a ${slot.what}`, action: `Empty slot. Tap the flash icon beside ${slot.what === 'drawing' ? 'a drawing' : 'an indicator or a template'} to add it here` };
  // While the Payoff list covers the option chart (S3), that chart's actions are unavailable, except Payoff (FR-28)
  if (id === 'opt' && slot.kind !== 'payoff' && PM.on && PM.s3) {
    const a = slot.kind === 'tf' ? { label: slot.tf, short: slot.tf, name: 'Timeframe ' + slot.tf } : act(slot.id);
    return { label: a.label, short: a.short, name: a.name, icon: slot.icon, big: slot.kind === 'tf', cap: 'Hidden', status: 'na', verb: 'Hidden by the Payoff list', action: 'The Payoff list covers the option chart' };
  }
  if (slot.kind === 'tf') {
    const cur = c.tf === slot.tf;
    return { label: slot.tf, big: true, name: cur ? 'Current timeframe' : 'Timeframe ' + slot.tf, cap: cur ? 'Current' : 'Timeframe', status: cur ? 'current' : 'ok', verb: cur ? `Already ${slot.tf}` : `Switch to ${slot.tf}`, action: cur ? `${c.short} is already on ${slot.tf}` : `Switch ${S.linked ? 'both charts' : c.short} to ${slot.tf}` };
  }
  const a = act(slot.id);
  if (slot.kind === 'tool') {
    const armed = c.draft && c.draft.tool === slot.tool;
    return { label: a.label, short: a.short, name: a.name, icon: slot.icon, cap: armed ? 'Armed' : '', status: 'ok', verb: `Draw ${midS(a.name)}`, action: `Draw a ${midS(a.name)} on ${c.short}` };
  }
  if (slot.kind === 'tpl') return { label: a.label, short: a.short, name: a.name, icon: slot.icon, cap: '', status: 'ok', verb: `Apply ${midS(a.name)}`, action: `Apply ${midS(a.name)} to ${c.short}` };
  if (slot.kind === 'ind') {
    const on = !!c.ind[slot.ind], nm = a.name;
    return { label: a.label, short: a.short, name: nm, icon: slot.icon, cap: on ? 'On' : 'Off', capOn: on, status: 'ok', verb: `Turn ${on ? 'off' : 'on'} ${nm}`, action: `Turn ${on ? 'off' : 'on'} ${nm} · ${c.short}` };
  }
  // Payoff: one switch for both charts, from either chart's wheel (BR-32)
  if (!payoffAvailable()) return { label: a.label, short: a.short, name: a.name, icon: slot.icon, cap: 'No options', status: 'na', verb: 'Payoff needs an index with options', action: 'Payoff needs an index with options', scope: 'Both charts' };
  const on = PM.on;
  return { label: a.label, short: a.short, name: a.name, icon: slot.icon, cap: on ? 'On' : 'Off', capOn: on, status: 'ok', verb: on ? 'Hide payoff' : 'Show payoff', action: 'Breakeven and P&L at any level and time', scope: 'Both charts' };
}
function applySlot(i, id, meta = {}) {
  const slot = SLOTS[i], c = CH[id], d = describe(slot, id);
  if (d.status === 'current' || d.status === 'na') return false;
  if (slot.kind === 'tf') setTimeframe(id, slot.tf, { route: meta.route });
  else if (slot.kind === 'tool') { if (DRAWABLE.has(slot.tool)) armTool(id, slot.tool, meta); else toast(`${d.name} is not drawn in this prototype`); }
  else if (slot.kind === 'ind') { if (slot.ind) toggleIndicator(id, slot.ind, meta); else toast(`${d.name} is not drawn in this prototype`); }
  else if (slot.kind === 'tpl') applyTemplate(id, slot.tpl);
  else setPayoff(!PM.on, { source: meta.route === 'q1' ? 'quick_actions' : 'wheel', chart: id });
  return true;
}

/* =========================================================================
   Label fit (placements PRD v1.1, section 15)
   A label must sit inside its own slot. In order, try: the label on one line; on two lines;
   the authored short label; without the state caption; without the icon; smaller type down to
   11 px (13 px for intervals), scaled by the text-size setting. Never an ellipsis. If a slot still
   does not fit, the wheel does not open and the hold falls back to Quick actions (reason "labels").
   With fit rules off (S.fit === false) labels are drawn as the v1.0 build drew them, to show the failure.
   ========================================================================= */
const FIT = { margin: 1.5, icon: 16, gapIcon: 3, gapCap: 1, ink: .92 };
const MCTX = document.createElement('canvas').getContext('2d');
function tw(t, px, wt = 500, ls = -0.2) { MCTX.font = `${wt} ${px}px Inter, sans-serif`; return MCTX.measureText(t).width + ls * Math.max(0, [...t].length - 1); }
function split2(t, px, wt) {
  const w = t.split(' '); if (w.length < 2) return null;
  let best = null;
  for (let k = 1; k < w.length; k++) { const l = [w.slice(0, k).join(' '), w.slice(k).join(' ')], m = Math.max(tw(l[0], px, wt), tw(l[1], px, wt)); if (!best || m < best.m) best = { l, m }; }
  return best.l;
}
function boxFits(geo, s, x0, y0, w, h) {
  const m = FIT.margin;
  for (let k = 0; k <= 4; k++) {
    const f = k / 4;
    for (const [x, y] of [[x0 + f * w, y0], [x0 + f * w, y0 + h], [x0, y0 + f * h], [x0 + w, y0 + f * h]]) {
      const dx = x - geo.hub.x, dy = y - geo.hub.y, r = Math.hypot(dx, dy);
      if (r < geo.rIn + m || r > geo.rOut - m) return false;
      let th = Math.atan2(dy, dx) * 180 / Math.PI; if (th < 0) th += 360;
      const rel = (th - s.a0 + 720) % 360; if (rel > s.span) return false;
      if (r * Math.sin(Math.min(rel, s.span - rel) * Math.PI / 180) < m) return false;
    }
  }
  return true;
}
// The stack is icon, label lines and state caption, centred on a point. Each piece is tested in its
// own box (text by its ink: 0.92 em around the line's middle), so a short caption under a wide label
// is not penalised for the label's width.
function stackOf(c, d) {
  const lh = c.px * 1.18, clh = c.capPx * 1.2, parts = [];
  const h = (c.icon ? FIT.icon + FIT.gapIcon : 0) + c.lines.length * lh + (c.cap ? FIT.gapCap + clh : 0);
  let y = -h / 2;
  if (c.icon) { parts.push([-FIT.icon / 2, y, FIT.icon, FIT.icon]); y += FIT.icon + FIT.gapIcon; }
  for (const t of c.lines) { const w = tw(t, c.px, c.wt); parts.push([-w / 2, y + (lh - c.px * FIT.ink) / 2, w, c.px * FIT.ink]); y += lh; }
  if (c.cap) { const w = tw(d.cap, c.capPx, 400, 0); parts.push([-w / 2, y + FIT.gapCap + (clh - c.capPx * FIT.ink) / 2, w, c.capPx * FIT.ink]); }
  return { parts, h, lh, clh, w: Math.max(...parts.map(p => p[2])) };
}
function placeStack(geo, s, st, lr) {
  const mid = s.a0 + s.span / 2; let best = null;
  for (let r = geo.rIn + 4; r <= geo.rOut - 4; r += 2) {
    const [x, y] = pol(geo.hub, r, mid);
    if (st.parts.every(([dx, dy, w, h]) => boxFits(geo, s, x + dx, y + dy, w, h))) { const dd = Math.abs(r - lr); if (!best || dd < best.dd) best = { x, y, dd }; }
  }
  return best;
}
function labelLR(geo) { return geo.quarter ? (geo.rIn + geo.rOut) / 2 + 6 : (geo.rIn + geo.rOut) / 2 + 2; }
/* Order of attempts, first fit wins:
   1 label, one line, then two lines; authored short label, one line, then two lines   (icon and caption)
   2 the same without the state caption (state shows as a dot when on, and in words in the readout)
   3 smaller type, down to 11 px, still with the icon
   4 the same without the icon
   Never an ellipsis: if the short label does not fit at the smallest size, the wheel does not open.
   `force` carries a group decision: once one timeframe slot drops its caption, the other does too;
   once one slot drops its icon, every slot in that wheel does. */
function layoutSlot(geo, s, d, force = {}) {
  const fs = S.fs || 1, big = !!d.big, base = (big ? 15 : 12.5) * fs, min = (big ? 13 : 11) * fs, wt = big ? 600 : 500, capPx = 10 * fs, lr = labelLR(geo);
  if (S.fit === false) {
    const c = { lines: [d.label], px: base, wt, capPx, icon: !!d.icon, cap: !!d.cap, how: 'raw' }, st = stackOf(c, d), [x, y] = pol(geo.hub, lr, s.a0 + s.span / 2);
    return { ...c, ...st, x, y: big ? y + 3.5 : y - 20 + st.h / 2 };
  }
  const texts = [d.label]; if (d.short && d.short !== d.label) texts.push(d.short);
  const forms = (t, px) => { const o = [[t]], s2 = split2(t, px, wt); if (s2) o.push(s2); return o; };
  const tryC = c => { const st = stackOf(c, d), p = placeStack(geo, s, st, lr); return p ? { ...c, ...st, x: p.x, y: p.y, noCap: !!d.cap && !c.cap, noIcon: !!d.icon && !c.icon } : null; };
  const levels = [];
  if (!force.noCap && !force.noIcon) levels.push({ icon: !!d.icon, cap: !!d.cap });
  if (!force.noIcon) levels.push({ icon: !!d.icon, cap: false });
  for (const lv of levels) for (const [k, t] of texts.entries()) for (const lines of forms(t, base)) {
    const r = tryC({ lines, px: base, wt, capPx, ...lv, how: k ? 'short' : lines.length > 1 ? 'wrap' : 'full' }); if (r) return r;
  }
  const t = texts[texts.length - 1];
  for (const icon of force.noIcon ? [false] : [!!d.icon, false]) {
    if (!icon && d.icon) for (const [k, tt] of texts.entries()) for (const lines of forms(tt, base)) { const r = tryC({ lines, px: base, wt, capPx, icon, cap: false, how: k ? 'short' : lines.length > 1 ? 'wrap' : 'full' }); if (r) return r; }
    for (let px = base - .5; px >= min - 1e-6; px -= .5) for (const lines of forms(t, px)) { const r = tryC({ lines, px, wt, capPx, icon, cap: false, how: 'small' }); if (r) return r; }
  }
  // No ellipsis in a slot: a cut label ("VW…", "EM…") no longer says which action it is.
  // The authored short label is the floor; below it the hold goes to Quick actions.
  return null;
}
// One line of text into maxW: shrink to minPx, then ellipsis.
function fitLine(t, px, wt, maxW, minPx) {
  for (let p = px; p >= minPx - 1e-6; p -= .5) if (tw(t, p, wt) <= maxW) return { t, px: p };
  const ch = [...t]; for (let n = ch.length - 1; n >= 1; n--) { const s = ch.slice(0, n).join('').trimEnd() + '…'; if (tw(s, minPx, wt) <= maxW) return { t: s, px: minPx }; }
  return { t: '…', px: minPx };
}
const rowName = (sl, d) => d.name;
function listMetrics(id) {
  const fs = S.fs || 1;
  if (S.fit === false) return { w: 228, rowH: 44, px: 14 * fs };
  const px = 14 * fs, rowH = Math.max(44, Math.round(px * 1.3 + 20)); let need = 0;
  for (const sl of SLOTS) {
    const d = describe(sl, id), ib = d.big ? Math.max(18, tw(d.label, 13 * fs, 600)) : 18, st = d.big ? 0 : tw(d.cap || 'Off', 11 * fs, 400, 0);
    need = Math.max(need, 14 + ib + 12 + tw(rowName(sl, d), px, 400) + 12 + st + 14);
  }
  return { w: clamp(Math.ceil(need), 228, Math.min(L.W - 16, 340)), rowH, px };
}
