/* =====================================================================
   SahiChart: a small canvas candlestick chart in the Sahi Charts style.
   The x axis is trading time (minutes since the first sample session,
   nights and holidays have no width), so the future zone can run across
   sessions without gaps.
   ===================================================================== */
class SahiChart {
  constructor(canvas, opts) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.o = Object.assign({ tf: 3, axisW: 64, timeH: 28, volFrac: 0.14, sub: null, dec: 2, minSpan: 30, maxSpan: 375 * 20, padTop: 8, minY: null }, opts);
    this.candles = [];
    this.view = { t0: 0, t1: 375 };
    this.hooks = {};
    this.dpr = 1;
    this.w = 300; this.h = 150;
    this.dirty = true;
    this.drag = null;
    this.pointer = null;
    this.lastPrice = null;
    this.nowT = 0;
    this.limitT = null;
    // how far right the view may go even without a future zone (empty space to look into)
    this.panT = null;
    this._bind();
  }
  on(name, fn) { this.hooks[name] = fn; return this; }
  resize() {
    const r = this.cv.parentElement;
    const w = r.clientWidth, h = r.clientHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === this.w && h === this.h && dpr === this.dpr) return;
    this.w = w; this.h = h; this.dpr = dpr;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
    this.invalidate();
  }
  setData(candles, nowT, lastPrice) { this.candles = candles; this.nowT = nowT; this.lastPrice = lastPrice; this.invalidate(); }
  setView(t0, t1) { this.view = { t0, t1 }; this.invalidate(); }
  invalidate() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = null; this.render(); });
  }
  /* ---------- geometry ---------- */
  get plotW() { return this.w - this.o.axisW; }
  get mainH() { return (this.h - this.o.timeH) * (this.o.sub ? 1 - this.o.sub.frac : 1); }
  get subTop() { return this.mainH; }
  get subH() { return (this.h - this.o.timeH) - this.mainH; }
  tToX(T) { return (T - this.view.t0) / (this.view.t1 - this.view.t0) * this.plotW; }
  xToT(x) { return this.view.t0 + x / this.plotW * (this.view.t1 - this.view.t0); }
  pToY(p) { return this.o.padTop + (this.yr.hi - p) / (this.yr.hi - this.yr.lo) * (this.mainH * (1 - this.o.volFrac) - this.o.padTop - 8); }
  yToP(y) { return this.yr.hi - (y - this.o.padTop) / (this.mainH * (1 - this.o.volFrac) - this.o.padTop - 8) * (this.yr.hi - this.yr.lo); }
  // Candles carry their own start and end (t0, t1): each session starts fresh, so the last one of a day can be short.
  visible() {
    const { t0, t1 } = this.view;
    return this.candles.filter(c => c.t1 >= t0 && c.t0 <= t1);
  }
  computeY() {
    let lo = Infinity, hi = -Infinity;
    for (const c of this.visible()) { if (c.l < lo) lo = c.l; if (c.h > hi) hi = c.h; }
    const extra = this.hooks.extraRange && this.hooks.extraRange(this);
    if (extra) { lo = Math.min(lo, extra[0]); hi = Math.max(hi, extra[1]); }
    if (!isFinite(lo)) { lo = (this.lastPrice || 100) * 0.99; hi = (this.lastPrice || 100) * 1.01; }
    const pad = Math.max((hi - lo) * 0.06, (hi + lo) / 2 * 0.0004, 0.05);
    this.yr = { lo: this.o.minY != null ? Math.max(this.o.minY, lo - pad) : lo - pad, hi: hi + pad };
  }
  /* ---------- drawing ---------- */
  render() {
    const { ctx, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    this.computeY();
    const css = getComputedStyle(document.documentElement);
    const col = n => css.getPropertyValue(n).trim();
    this.col = { bg: col('--chart-bg'), grid: col('--chart-grid'), text: col('--text-3'), text2: col('--text-2'), up: col('--up'), down: col('--down'), line: col('--line'), cross: col('--cross') };
    ctx.fillStyle = this.col.bg; ctx.fillRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, this.plotW, this.h - this.o.timeH); ctx.clip();
    this._grid();
    this.hooks.below && this.hooks.below(ctx, this);
    this._volume();
    this._candles();
    if (this.o.sub && (this.candles.length || this.lastPrice != null)) this._sub();
    this.hooks.above && this.hooks.above(ctx, this);
    ctx.restore();
    this._axes();
    this.hooks.axis && this.hooks.axis(ctx, this);
    this._crosshair();
    this.hooks.top && this.hooks.top(ctx, this);
  }
  niceStep(range, n) {
    const raw = range / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const f = raw / mag;
    return (f < 1.5 ? 1 : f < 2.25 ? 2 : f < 3.5 ? 2.5 : f < 7.5 ? 5 : 10) * mag;
  }
  _priceTicks() {
    const n = Math.max(3, Math.floor((this.mainH * (1 - this.o.volFrac) - this.o.padTop) / 50));
    const step = this.niceStep(this.yr.hi - this.yr.lo, n);
    this._tickStep = step;
    const out = [];
    for (let p = Math.ceil(this.yr.lo / step) * step; p <= this.yr.hi; p += step) out.push(p);
    return out;
  }
  _timeTicks() {
    const E = Engine, span = this.view.t1 - this.view.t0;
    const pxPerMin = this.plotW / span;
    const steps = [15, 30, 60, 75, 125, 375, 750, 1875];
    let step = steps.find(s => s * pxPerMin >= 78) || 1875;
    const out = [];
    if (step < 375) {
      const start = Math.ceil(this.view.t0 / 15) * 15;
      for (let T = start; T <= this.view.t1; T += 15) {
        const m = T % 375;
        if (m === 0) { if (!(this.hooks.skipDay && this.hooks.skipDay(T))) out.push({ T, label: E.DAYS[T / 375].short, day: true }); }
        else if (m % step === 0 && m >= 30) { const mm = E.OPEN + m; out.push({ T, label: `${Math.floor(mm / 60)}:${String(mm % 60).padStart(2, '0')}` }); }
      }
      // keep day labels, drop time labels that collide with them
      return out.filter((t, i) => t.day || !out.some(u => u.day && Math.abs(u.T - t.T) * pxPerMin < 52));
    }
    const dayStep = step / 375;
    for (let d = Math.ceil(this.view.t0 / 375); d * 375 <= this.view.t1; d++) {
      if (d % dayStep === 0 && E.DAYS[d] && !(this.hooks.skipDay && this.hooks.skipDay(d * 375))) out.push({ T: d * 375, label: E.DAYS[d].short, day: true });
    }
    return out;
  }
  _grid() {
    const { ctx } = this;
    if (!this.candles.length && this.lastPrice == null) return;
    ctx.strokeStyle = this.col.grid; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const p of this._priceTicks()) { const y = Math.round(this.pToY(p)) + 0.5; ctx.moveTo(0, y); ctx.lineTo(this.plotW, y); }
    for (const t of this._timeTicks()) { const x = Math.round(this.tToX(t.T)) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, this.mainH); }
    ctx.stroke();
  }
  _candles() {
    const { ctx } = this;
    const k = this.plotW / (this.view.t1 - this.view.t0);
    for (const c of this.visible()) {
      const bw = Math.max(1, Math.min((c.t1 - c.t0) * k * 0.72, 28));
      const x = this.tToX((c.t0 + c.t1) / 2);
      const up = c.c >= c.o;
      ctx.fillStyle = ctx.strokeStyle = up ? this.col.up : this.col.down;
      const yH = this.pToY(c.h), yL = this.pToY(c.l), yO = this.pToY(c.o), yC = this.pToY(c.c);
      ctx.fillRect(Math.round(x) , yH, 1, Math.max(1, yL - yH));
      if (bw > 2) ctx.fillRect(Math.round(x - bw / 2), Math.min(yO, yC), Math.round(bw), Math.max(1, Math.abs(yC - yO)));
    }
  }
  _volume() {
    const { ctx } = this;
    const vis = this.visible();
    if (!vis.length || !this.o.volFrac) return;
    const maxV = Math.max(...vis.map(c => c.v || 0));
    if (!(maxV > 0)) return; // an index has no volume
    const base = this.mainH, hh = this.mainH * this.o.volFrac;
    const k = this.plotW / (this.view.t1 - this.view.t0);
    ctx.globalAlpha = 0.32;
    for (const c of vis) {
      const bw = Math.max(1, Math.min((c.t1 - c.t0) * k * 0.72, 28));
      const x = this.tToX((c.t0 + c.t1) / 2), h = (c.v || 0) / maxV * hh;
      ctx.fillStyle = c.c >= c.o ? this.col.up : this.col.down;
      ctx.fillRect(Math.round(x - bw / 2), base - h, Math.max(1, Math.round(bw)), h);
    }
    ctx.globalAlpha = 1;
  }
  _sub() {
    const { ctx } = this, sub = this.o.sub;
    const top = this.subTop, h = this.subH;
    ctx.strokeStyle = this.col.line; ctx.beginPath(); ctx.moveTo(0, top + 0.5); ctx.lineTo(this.w, top + 0.5); ctx.stroke();
    const pts = sub.series.filter(p => p.T >= this.view.t0 - 30 && p.T <= this.view.t1 + 30 && p.T <= this.nowT);
    if (!pts.length) { this._subY = null; return; }
    // scale to what is in view, with round ticks
    let lo = Math.min(...pts.map(p => p.v)), hi = Math.max(...pts.map(p => p.v));
    if (hi - lo < hi * 0.02) { lo -= hi * 0.01 + 1; hi += hi * 0.01 + 1; }
    const step = this.niceStep(hi - lo, 3);
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    this._subTicks = []; for (let v = lo + step; v < hi; v += step) this._subTicks.push(v);
    const y = v => top + 10 + (hi - v) / (hi - lo) * (h - 20);
    ctx.strokeStyle = sub.color; ctx.lineWidth = 1.4; ctx.beginPath();
    pts.forEach((p, i) => { const x = this.tToX(p.T); i ? ctx.lineTo(x, y(p.v)) : ctx.moveTo(x, y(p.v)); });
    ctx.stroke(); ctx.lineWidth = 1;
    this._subY = y;
  }
  _axes() {
    const { ctx } = this;
    const x0 = this.plotW;
    ctx.fillStyle = this.col.bg; ctx.fillRect(x0, 0, this.o.axisW, this.h); ctx.fillRect(0, this.h - this.o.timeH, this.w, this.o.timeH);
    ctx.strokeStyle = this.col.line; ctx.beginPath();
    ctx.moveTo(x0 + 0.5, 0); ctx.lineTo(x0 + 0.5, this.h);
    ctx.moveTo(0, this.h - this.o.timeH + 0.5); ctx.lineTo(this.w, this.h - this.o.timeH + 0.5);
    ctx.stroke();
    ctx.font = '500 11.5px Inter, system-ui, sans-serif'; ctx.textBaseline = 'middle';
    ctx.fillStyle = this.col.text2;
    const empty = !this.candles.length && this.lastPrice == null;
    for (const p of empty ? [] : this._priceTicks()) {
      const y = this.pToY(p);
      if (y < 6 || y > this.mainH - 6) continue;
      const st = this._tickStep || 1;
      ctx.fillText(st >= 1 ? Math.round(p).toString() : p.toFixed(st >= 0.1 ? 1 : 2), x0 + 8, y);
    }
    if (this.o.sub && this._subY && !empty) {
      const sub = this.o.sub;
      const lastV = sub.series.filter(q => q.T <= this.nowT).pop();
      // tick labels give way to the last-value tag
      for (const v of this._subTicks || []) { const y = this._subY(v); if (lastV && Math.abs(y - this._subY(lastV.v)) < 16) continue; ctx.fillText(sub.fmt(v), x0 + 8, y); }
      if (lastV) this.tag(x0, this._subY(lastV.v), sub.fmt(lastV.v), sub.color, '#fff');
    }
    ctx.textAlign = 'center';
    for (const t of this._timeTicks()) {
      const x = this.tToX(t.T);
      if (x < 16 || x > this.plotW - 16) continue;
      ctx.fillStyle = t.day ? this.col.text2 : this.col.text2;
      ctx.font = t.day ? '600 11.5px Inter, system-ui, sans-serif' : '500 11.5px Inter, system-ui, sans-serif';
      ctx.fillText(t.label, x, this.h - this.o.timeH / 2);
    }
    ctx.textAlign = 'left';
    // last price tag
    if (this.lastPrice != null) {
      const y = this.pToY(this.lastPrice);
      if (y > 0 && y < this.mainH) {
        ctx.strokeStyle = this.col.up; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(this.tToX(this.nowT), y + 0.5); ctx.lineTo(x0, y + 0.5); ctx.stroke(); ctx.setLineDash([]);
        this.tag(x0, y, this.lastPrice.toFixed(2), this.col.up, '#fff');
      }
    }
  }
  tag(x, y, text, bg, fg, align = 'axis') {
    const { ctx } = this;
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    const w = align === 'axis' ? this.o.axisW - 2 : ctx.measureText(text).width + 12;
    const x0 = align === 'axis' ? x + 1 : x;
    ctx.fillStyle = bg; ctx.fillRect(x0, Math.round(y - 9), w, 18);
    ctx.fillStyle = fg; ctx.textBaseline = 'middle'; ctx.fillText(text, x0 + 6, y + 0.5);
  }
  _crosshair() {
    const p = this.pointer;
    if (!p || this.drag || p.x > this.plotW || p.y > this.h - this.o.timeH) return;
    if (this.hooks.crosshair && this.hooks.crosshair(this.ctx, this, p) === false) return;
    const { ctx } = this;
    // An app hook can snap the horizontal line and its label (Payoff snaps to 5 index points).
    const snap = this.hooks.crossY ? this.hooks.crossY(this, p) : null;
    const cy = snap ? snap.y : p.y;
    ctx.strokeStyle = this.col.cross; ctx.setLineDash([4, 4]); ctx.beginPath();
    ctx.moveTo(Math.round(p.x) + 0.5, 0); ctx.lineTo(Math.round(p.x) + 0.5, this.h - this.o.timeH);
    if (p.y < this.mainH) { ctx.moveTo(0, Math.round(cy) + 0.5); ctx.lineTo(this.plotW, Math.round(cy) + 0.5); }
    ctx.stroke(); ctx.setLineDash([]);
    if (p.y < this.mainH) this.tag(this.plotW, cy, snap ? snap.label : this.yToP(p.y).toFixed(2), '#363c47', '#fff');
    const T = this.xToT(p.x);
    const label = this.hooks.timeLabel ? this.hooks.timeLabel(T) : Engine.fmtT(Math.round(T));
    ctx.font = '600 11px Inter, system-ui, sans-serif';
    const tw = ctx.measureText(label).width + 14;
    const tx = Math.max(0, Math.min(this.plotW - tw, p.x - tw / 2));
    ctx.fillStyle = '#363c47'; ctx.fillRect(tx, this.h - this.o.timeH + 4, tw, 20);
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(label, tx + 7, this.h - this.o.timeH / 2 + 2);
  }
  /* ---------- input ---------- */
  local(e) {
    const r = this.cv.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (this.w / r.width), y: (e.clientY - r.top) * (this.h / r.height) };
  }
  // Keep the view between the first candle and the right limit: the axis end, or panT when that is later.
  clampView(t0, t1) {
    let span = Math.max(this.o.minSpan, Math.min(this.o.maxSpan, t1 - t0));
    const first = this.candles.length ? this.candles[0].t0 : t0;
    const right = Math.max(this.limitT != null ? this.limitT : this.nowT, this.panT != null ? this.panT : -Infinity);
    span = Math.min(span, (right - first) / 0.89);
    const maxRight = right + span * 0.06;
    if (t0 < first - span * 0.05) t0 = first - span * 0.05;
    if (t0 + span > maxRight) t0 = maxRight - span;
    return [t0, t0 + span];
  }
  _bind() {
    const cv = this.cv;
    cv.addEventListener('mousemove', e => {
      const p = this.local(e);
      if (this.drag) {
        const dT = (this.drag.x - p.x) / this.plotW * (this.drag.t1 - this.drag.t0);
        const [a, b] = this.clampView(this.drag.t0 + dT, this.drag.t1 + dT);
        if (Math.abs(p.x - this.drag.x) > 3) this.drag.moved = true;
        this.view = { t0: a, t1: b };
        this.pointer = p;
        this.hooks.viewchange && this.hooks.viewchange(this, true);
        this.invalidate();
        return;
      }
      this.pointer = p;
      this.hooks.hover && this.hooks.hover(this, p);
      this.invalidate();
    });
    cv.addEventListener('mouseleave', () => { this.pointer = null; this.hooks.leave && this.hooks.leave(this); this.invalidate(); });
    cv.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      const p = this.local(e);
      if (this.hooks.down && this.hooks.down(this, p, e) === false) return;
      this.drag = { x: p.x, t0: this.view.t0, t1: this.view.t1, moved: false };
      cv.style.cursor = 'grabbing';
    });
    window.addEventListener('mouseup', e => {
      if (!this.drag) return;
      const d = this.drag; this.drag = null; this.cv.style.cursor = '';
      if (!d.moved && this.hooks.click) this.hooks.click(this, this.local(e), e);
      if (d.moved) this.hooks.viewchange && this.hooks.viewchange(this, false, true);
      this.invalidate();
    });
    cv.addEventListener('wheel', e => {
      e.preventDefault();
      const p = this.local(e);
      const T = this.xToT(p.x);
      const k = Math.exp(e.deltaY * 0.0015);
      const t0 = T - (T - this.view.t0) * k, t1 = T + (this.view.t1 - T) * k;
      const [a, b] = this.clampView(t0, t1);
      this.view = { t0: a, t1: b };
      this.pointer = p;
      this.hooks.viewchange && this.hooks.viewchange(this, false, true);
      this.invalidate();
    }, { passive: false });
  }
}
