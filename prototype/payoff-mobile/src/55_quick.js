/* =========================================================================
   Quick view: what the wheel (the quick view panel) holds, picked by the trader.
   - Two timeframes, from the two dropdowns under "Quick view" in the chart menu.
   - Two drawings, from the flash icon on each row of the Drawing Tools sheet.
   - Two indicators or templates (they share the two slots), from the flash icon
     on each row of Add indicators and of My Templates.
   A group holds two picks. When it is full the other flash icons are dimmed, and
   tapping one says to remove a pick first. A group with fewer than two picks
   leaves an "Empty" slot in the wheel. Slot 7 stays Payoff.
   The Drawing Tools and My Templates sheets follow the Sahi app's screens
   (screenshots shared on 11 Nov 2026).
   ========================================================================= */
// [key, icon, name in the sheet, short label for the wheel]. The prototype draws the first four it had: the rest only arm a toast.
const DRAW_TOOLS = [
  ['trend', 'trend', 'Trend Line', 'Trend'], ['hline', 'hline', 'Horizontal Line', 'H line'], ['hray', 'hline', 'Horizontal Ray', 'H ray'], ['rect', 'rect', 'Rectangle', 'Rect'],
  ['fib', 'fib', 'Fibonacci Retracement', 'Fib'], ['channel', 'trend', 'Parallel Channel', 'Channel'], ['long', 'fib', 'Long Position', 'Long'], ['short', 'fib', 'Short Position', 'Short'],
  ['fibext', 'fib', 'Trend-Based Fib Extension', 'Fib ext'], ['text', 'pen', 'Text', 'Text'], ['ray', 'trend', 'Ray', 'Ray'], ['extline', 'trend', 'Extended Line', 'Ext line'],
  ['brush', 'pen', 'Brush', 'Brush'], ['circle', 'pen', 'Circle', 'Circle'], ['arrow', 'trend', 'Arrow', 'Arrow'], ['arrowup', 'pen', 'Arrow Up', 'Arrow up'],
  ['arrowdn', 'pen', 'Arrow Down', 'Arrow dn'], ['measure', 'ruler', 'Measure', 'Measure'], ['vline', 'hline', 'Vertical Line', 'V line'], ['prange', 'moveH', 'Price Range', 'Range'],
];
const DRAWABLE = new Set(['trend', 'hline', 'fib', 'rect']);
const toolOf = k => DRAW_TOOLS.find(t => t[0] === k);
const IND_SHORT = { 'Accumulation/Distribution': 'A/D', 'Advance/Decline Ratio': 'A/D ratio', 'Lite Zones & 34 EMA Band': 'Lite Zones', 'Pushkar Premium Trend': 'Pushkar', 'Auto Fib Extension': 'Auto Fib', 'Bollinger Bands %B': 'BB %B', 'Pivot Points Standard': 'Pivots', 'Stochastic RSI': 'Stoch RSI', 'Stochastic': 'Stoch', 'Parabolic SAR': 'PSAR', 'Ichimoku Cloud': 'Ichimoku', 'Expected Move': 'Exp Move', 'OI Resistance': 'OI Resist', 'Williams %R': '%R', 'Adaptive SuperTrend (AS)': 'Adapt ST', '52 Week High/Low (52W H/L)': '52W H/L' };
const indKey = x => x.k || x.n;
const indOf = key => IND_LIST.find(x => indKey(x) === key);
function indShort(x) {
  if (x.k) return IND[x.k].name;
  if (IND_SHORT[x.n]) return IND_SHORT[x.n];
  const m = /\(([^)]+)\)\s*$/.exec(x.n); if (m) return m[1];
  return x.n.length <= 10 ? x.n : x.n.split(' ')[0].slice(0, 9);
}

const QV_DEF = { tf: ['1m', '15m'], tools: ['trend', 'fib'], inds: ['vwap', 'ema'] };
const QV = (() => { const s = store.get('quick', null), ok = s && Array.isArray(s.tf) && s.tf.length === 2 && s.tf.every(t => TF[t]) && Array.isArray(s.tools) && Array.isArray(s.inds); return ok ? s : JSON.parse(JSON.stringify(QV_DEF)); })();
const TPLS = store.get('tpls', [{ id: 1, name: '1', inds: ['RSI Bars', 'OI Profile'] }]);
const tplOf = id => TPLS.find(t => t.id === id);
const BASE_SLOTS = SLOTS.slice();
const QGROUP = { tools: 'drawings', inds: 'indicators or templates' };

function rebuildSlots() {
  QV.tools = QV.tools.filter(toolOf).slice(0, 2);
  QV.inds = QV.inds.filter(k => String(k).startsWith('tpl:') ? tplOf(+k.slice(4)) : indOf(k)).slice(0, 2);
  const tf = S.labels && S.labels !== 'default' ? LS.tf : QV.tf, out = [{ id: 'tfA', kind: 'tf', tf: tf[0] }, { id: 'tfB', kind: 'tf', tf: tf[1] }];
  for (let k = 0; k < 2; k++) {
    const key = QV.tools[k], t = key && toolOf(key);
    if (!t) out.push({ id: 'empty-tool' + k, kind: 'empty', what: 'drawing', icon: 'flash' });
    else if (key === 'trend' || key === 'fib') out.push(BASE_SLOTS[key === 'trend' ? 2 : 3]);
    else out.push({ id: 'tool:' + key, kind: 'tool', tool: key, icon: t[1], lab: [t[3], t[3], t[2]] });
  }
  for (let k = 0; k < 2; k++) {
    const key = QV.inds[k];
    if (!key) { out.push({ id: 'empty-ind' + k, kind: 'empty', what: 'indicator or template', icon: 'flash' }); continue; }
    if (key === 'vwap' || key === 'ema') { out.push(BASE_SLOTS[key === 'vwap' ? 4 : 5]); continue; }
    if (key.startsWith('tpl:')) { const t = tplOf(+key.slice(4)); out.push({ id: key, kind: 'tpl', tpl: t.id, icon: 'grid', lab: [`Tpl ${t.name}`, `Tpl ${t.name}`, `Template ${t.name}`] }); continue; }
    const x = indOf(key), s = indShort(x);
    out.push({ id: 'ind:' + key, kind: 'ind', ind: x.k || null, nm: x.n, icon: x.k && P[x.k] ? x.k : 'fx', lab: [s, s, x.n] });
  }
  out.push(BASE_SLOTS[6]);
  SLOTS.splice(0, SLOTS.length, ...out);
}
function saveQuick() { store.set('quick', QV); store.set('tpls', TPLS); rebuildSlots(); if (typeof syncDevHints === 'function' && CH.idx.g) syncDevHints(); }
function resetQuick() { Object.assign(QV, JSON.parse(JSON.stringify(QV_DEF))); saveQuick(); }

/* ---- the flash icon ---- */
function flashBtn(group, key, name) {
  const on = QV[group].includes(key), dis = !on && QV[group].length >= 2;
  return `<button class="flb${on ? ' on' : ''}${dis ? ' dis' : ''}" data-fl="${group}" data-key="${escH(key)}" aria-pressed="${on}"${dis ? ' aria-disabled="true"' : ''} aria-label="${on ? 'Remove' : 'Add'} ${escH(name)} ${on ? 'from' : 'to'} Quick view">${ic('flash', 17, 1.8)}</button>`;
}
// true when the picks changed
function quickToggle(group, key, name) {
  const a = QV[group], i = a.indexOf(key);
  if (i >= 0) { a.splice(i, 1); saveQuick(); toast(`${name} removed from Quick view`); track('quick_pick', { group, on: false }); return true; }
  if (a.length >= 2) { Haptic.fire('error'); toast(`Quick view already has 2 ${QGROUP[group]}. Remove one to add another.`); track('quick_pick_full', { group }); return false; }
  a.push(key); saveQuick(); Haptic.fire('select'); toast(`${name} added to Quick view`, true); track('quick_pick', { group, on: true }); return true;
}
function flashClick(e, rerender) {
  const f = e.target.closest('.flb'); if (!f) return false;
  const group = f.dataset.fl, key = f.dataset.key, name = group === 'tools' ? toolOf(key)[2] : key.startsWith('tpl:') ? `Template ${tplOf(+key.slice(4)).name}` : indOf(key).n;
  if (quickToggle(group, key, name)) rerender();
  return true;
}

/* ---- Quick view section of the chart menu: the two timeframes ---- */
function quickTfHTML() {
  const opts = cur => TF_GROUPS.map(([g, list]) => `<optgroup label="${g}">${list.map(tf => `<option value="${tf}"${tf === cur ? ' selected' : ''}>${tf}</option>`).join('')}</optgroup>`).join('');
  return `<div class="sech qvh"><span>${ic('flash', 15, 1.9)}Quick view</span></div><div class="qvdd">${[0, 1].map(i => `<label><span>Timeframe ${i + 1}</span><select data-qtf="${i}" aria-label="Quick view timeframe ${i + 1}">${opts(QV.tf[i])}</select></label>`).join('')}</div><div class="qvn">The two timeframes in the quick view panel. Hold the timeframe button to open it.</div>`;
}
function bindQuickTf(pop) {
  pop.addEventListener('change', e => {
    const i = e.target.dataset.qtf; if (i == null) return;
    const old = QV.tf[+i], v = e.target.value; QV.tf[+i] = v; if (QV.tf[1 - i] === v) QV.tf[1 - i] = old;   // picking the other slot's timeframe swaps the two
    saveQuick(); $$('[data-qtf]', pop).forEach(s => { s.value = QV.tf[+s.dataset.qtf]; });
    toast(`Quick view timeframes: ${QV.tf[0]} and ${QV.tf[1]}`, true); track('quick_tf', { a: QV.tf[0], b: QV.tf[1] });
  });
}

/* ---- Drawing Tools sheet ---- */
const DRAW_OPTS = [['toolbar', 'grid', 'Enable drawing toolbar'], ['magnet', 'pin', 'Enable magnet'], ['hide', 'eye', 'Hide all drawings'], ['lock', 'gear', 'Lock all drawings']];
function openDrawing(id) {
  const c = CH[id]; S.draw = S.draw || {}; S.draw.toolbar = !!$('.dtool');
  const sh = h(`<div class="sheet dsheet" style="top:${L.sat + 16}px"><div class="sh-title">Drawing Tools</div><button class="sh-x" aria-label="Close">${ic('x', 18, 1.7)}</button><hr class="dhr"><div class="dlist"></div></div>`);
  const render = () => {
    const el = $('.dlist', sh), sc = el.scrollTop;
    el.innerHTML = `<div class="dsec">Tools</div>${DRAW_OPTS.map(([k, icn, n]) => `<button class="drow" data-do="${k}" role="switch" aria-checked="${!!S.draw[k]}"><span class="di">${ic(P[icn] ? icn : 'gear', 20, 1.7)}</span><span class="dnm">${n}</span><span class="tog${S.draw[k] ? ' on' : ''}"></span></button>`).join('')}<hr class="dhr"><div class="dsec">Drawings</div>${DRAW_TOOLS.map(([k, icn, n]) => `<div class="drow"><button class="dtap" data-dt="${k}"><span class="di">${ic(P[icn] ? icn : 'pen', 20, 1.7)}</span><span class="dnm">${n}</span></button>${flashBtn('tools', k, n)}</div>`).join('')}<div style="height:calc(20px + var(--sab))"></div>`;
    el.scrollTop = sc;
  };
  render();
  const layer = openLayer(sh, { label: 'Drawing Tools' });
  sh.addEventListener('click', e => {
    if (e.target.closest('.sh-x')) return layer.close('close');
    if (flashClick(e, render)) return;
    const o = e.target.closest('[data-do]'); if (o) {
      const k = o.dataset.do; S.draw[k] = !S.draw[k];
      if (k === 'toolbar') { if (S.draw.toolbar) openDrawToolbar(id); else { $$('.dtool').forEach(x => x.remove()); } }
      if (k === 'hide') redraw();
      render(); return;
    }
    const t = e.target.closest('[data-dt]'); if (!t) return;
    const k = t.dataset.dt; if (!DRAWABLE.has(k)) return toast(`${toolOf(k)[2]} is not drawn in this prototype`);
    layer.close('picked'); armTool(id, k, {});
  });
}

/* ---- My Templates sheet ---- */
function applyTemplate(id, tid) {
  const t = tplOf(tid), c = CH[id]; if (!t) return;
  const drawn = t.inds.map(n => IND_LIST.find(x => x.n === n)).filter(x => x && x.k), miss = t.inds.length - drawn.length;
  c.ind = {}; drawn.forEach(x => { c.ind[x.k] = true; }); updateHeaders(); redraw(id);
  toast(`Template ${t.name} applied to ${c.short}${miss ? ` · ${miss} of its indicators ${miss > 1 ? 'are' : 'is'} not drawn in this prototype` : ''}`, true);
  track('template_apply', { chart: id });
}
function openTemplates(id) {
  const c = CH[id];
  const sh = h(`<div class="sheet tsheet" style="height:${Math.round(L.H * .62)}px"><div class="th"><button class="tback" aria-label="Back">${ic('chevL', 18, 2)}</button><h3></h3></div><hr class="dhr"><div class="tlist"></div><button class="tsave">Save current indicators as template</button></div>`);
  const render = () => {
    $('h3', sh).textContent = `My Templates (${TPLS.length})`;
    $('.tlist', sh).innerHTML = TPLS.length ? TPLS.map(t => `<div class="trow"><button class="ttap" data-tp="${t.id}"><b>${escH(t.name)}</b><small>${escH(t.inds.join(', '))}</small></button>${flashBtn('inds', 'tpl:' + t.id, 'Template ' + t.name)}<button class="tdel" data-td="${t.id}" aria-label="Delete template ${escH(t.name)}">${ic('trash', 18, 1.7)}</button></div>`).join('') : '<div class="tnone">No templates yet. Add indicators to the chart, then save them here.</div>';
  };
  render();
  const layer = openLayer(sh, { label: 'My Templates' });
  sh.addEventListener('click', e => {
    if (e.target.closest('.tback')) return layer.close('back');
    if (flashClick(e, render)) return;
    const d = e.target.closest('[data-td]'); if (d) { const i = TPLS.findIndex(t => t.id === +d.dataset.td), nm = TPLS[i].name; TPLS.splice(i, 1); saveQuick(); render(); return toast(`Template ${nm} deleted`); }
    const a = e.target.closest('[data-tp]'); if (a) { layer.close('picked'); return applyTemplate(id, +a.dataset.tp); }
    if (e.target.closest('.tsave')) {
      const on = Object.keys(c.ind).filter(k => c.ind[k]); if (!on.length) return toast(`Add an indicator to ${c.short} first`);
      const nid = Math.max(0, ...TPLS.map(t => t.id)) + 1; TPLS.push({ id: nid, name: String(nid), inds: on.map(k => IND[k].full) }); saveQuick(); render(); toast(`Template ${nid} saved`, true);
    }
  });
}
