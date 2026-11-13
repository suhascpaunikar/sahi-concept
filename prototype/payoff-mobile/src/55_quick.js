/* =========================================================================
   Quick view: what the quick action panel holds, picked by the trader.
   - Two timeframes, from the two dropdowns under "Quick view" in the chart menu.
   - Two drawings, from the flash icon on each row of the Drawing Tools sheet.
   - Two indicators, from the flash icon on each row of Add indicators.
   - Two templates, from the flash icon on each row of My Templates. Templates
     show in the pills layout only; the list layout has no template rows.
   A group holds two picks. When it is full the other flash icons are dimmed, and
   tapping one says to remove a pick first. A group with fewer than two picks
   leaves an "Add" slot in the panel. Payoff is always the last action.
   The Drawing Tools and My Templates sheets follow the Sahi app's screens
   (screenshots shared on 11 Nov 2026).
   ========================================================================= */
// [key, icon, name in the sheet, short label for a pill]. The prototype draws the first four it had: the rest only arm a toast.
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

const QV_DEF = { tf: ['1m', '15m'], tools: ['trend', 'fib'], inds: ['vwap', 'ema'], tpls: [] };
const QV = (() => { const s = store.get('quick', null), ok = s && Array.isArray(s.tf) && s.tf.length === 2 && s.tf.every(t => TF[t]) && Array.isArray(s.tools) && Array.isArray(s.inds); return ok ? s : JSON.parse(JSON.stringify(QV_DEF)); })();
// picks saved while a template shared the indicator slots: the templates move to their own group
if (!Array.isArray(QV.tpls)) { QV.tpls = QV.inds.filter(k => String(k).startsWith('tpl:')); QV.inds = QV.inds.filter(k => !String(k).startsWith('tpl:')); }
const TPLS = store.get('tpls', [{ id: 1, name: '1', inds: ['RSI Bars', 'OI Profile'] }]);
const tplOf = id => TPLS.find(t => t.id === id);
const QGROUP = { tools: 'drawings', inds: 'indicators', tpls: 'templates' };

// The panel's actions, in order: [label on a pill, name in a row or sentence]; grp is the section title in the pills layout
function rebuildSlots() {
  QV.tools = QV.tools.filter(toolOf).slice(0, 2);
  QV.inds = QV.inds.filter(indOf).slice(0, 2);
  QV.tpls = QV.tpls.filter(k => tplOf(+String(k).slice(4))).slice(0, 2);
  const out = QV.tf.map((tf, k) => ({ id: k ? 'tfB' : 'tfA', kind: 'tf', tf, grp: 'Timeframe' }));
  for (let k = 0; k < 2; k++) {
    const key = QV.tools[k], t = key && toolOf(key);
    out.push(t ? { id: 'tool:' + key, kind: 'tool', tool: key, icon: t[1], lab: [t[3], t[2]], grp: 'Drawing' } : { id: 'empty-tool' + k, kind: 'empty', what: 'drawing', grp: 'Drawing' });
  }
  for (let k = 0; k < 2; k++) {
    const key = QV.inds[k], x = key && indOf(key);
    out.push(x ? { id: 'ind:' + key, kind: 'ind', ind: x.k || null, icon: x.k && P[x.k] ? x.k : 'fx', lab: [indShort(x), x.k ? IND[x.k].name : x.n], grp: 'Indicator' } : { id: 'empty-ind' + k, kind: 'empty', what: 'indicator', grp: 'Indicator' });
  }
  if (S.qa !== 'list') for (let k = 0; k < 2; k++) {
    const key = QV.tpls[k], t = key && tplOf(+key.slice(4));
    out.push(t ? { id: key, kind: 'tpl', tpl: t.id, icon: 'grid', lab: [String(t.name).length > 8 ? t.name : `Tpl ${t.name}`, `Template ${t.name}`], grp: 'Template' } : { id: 'empty-tpl' + k, kind: 'empty', what: 'template', grp: 'Template' });
  }
  out.push({ id: 'payoff', kind: 'payoff', icon: 'payoff', lab: ['Payoff', 'Payoff'], grp: 'Payoff' });
  SLOTS.splice(0, SLOTS.length, ...out);
}
function saveQuick() { store.set('quick', QV); store.set('tpls', TPLS); rebuildSlots(); }
function resetQuick() { Object.assign(QV, JSON.parse(JSON.stringify(QV_DEF))); saveQuick(); }

// the Quick view picks first, in the order they were picked, then the rest in the list's own order
function picksFirst(list, picks, keyOf) { const at = x => { const i = picks.indexOf(keyOf(x)); return i < 0 ? 99 : i; }; return list.map((x, i) => [x, i]).sort((a, b) => at(a[0]) - at(b[0]) || a[1] - b[1]).map(a => a[0]); }

/* ---- the flash icon ---- */
function flashBtn(group, key, name) {
  const on = QV[group].includes(key), dis = !on && QV[group].length >= 2;
  return `<button class="flb${on ? ' on' : ''}${dis ? ' dis' : ''}" data-fl="${group}" data-key="${escH(key)}" aria-pressed="${on}"${dis ? ' aria-disabled="true"' : ''} aria-label="${on ? 'Remove' : 'Add'} ${escH(name)} ${on ? 'from' : 'to'} Quick view">${ic('flash', 17, 1.8)}</button>`;
}
// true when the picks changed
function quickToggle(group, key, name) {
  const a = QV[group], i = a.indexOf(key);
  if (i >= 0) { a.splice(i, 1); saveQuick(); toast(`${name} removed from Quick view`); track('quick_pick', { group, on: false }); return true; }
  if (a.length >= 2) { Haptic.fire('error'); toast(`Only 2 ${QGROUP[group]}. Remove one to add another.`); track('quick_pick_full', { group }); return false; }
  a.push(key); saveQuick(); Haptic.fire('select'); toast(`${name} added to Quick view`, true); track('quick_pick', { group, on: true }); return true;
}
// A tap on a flash icon. The row that was picked grows 5%, travels to the top of its list while the rows it passes
// slide down, then settles back to its size. An unpicked row slides back to its usual place. rows: selector of the
// list's rows inside scroller, each carrying data-k.
function flashClick(e, rerender, scroller, rows) {
  const f = e.target.closest('.flb'); if (!f) return false;
  const group = f.dataset.fl, key = f.dataset.key, name = group === 'tools' ? toolOf(key)[2] : group === 'tpls' ? `Template ${tplOf(+key.slice(4)).name}` : indOf(key).n;
  const was = QV[group].includes(key), before = new Map();
  if (scroller) $$(rows, scroller).forEach(r => before.set(r.dataset.k, r.getBoundingClientRect().top));
  if (!quickToggle(group, key, name)) return true;
  rerender();
  if (!scroller) return true;
  const added = !was, me = $$(rows, scroller).find(r => r.dataset.k === key);
  // bring the top of the list into view, with its title and the picks before this one, so the row is seen arriving
  if (added && me) { const sr = scroller.getBoundingClientRect(), fr = $$(rows, scroller)[0].getBoundingClientRect(); if (fr.top - 44 < sr.top) scroller.scrollTop = Math.max(0, scroller.scrollTop - (sr.top - (fr.top - 44))); }
  const still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  for (const r of $$(rows, scroller)) {
    const d = before.has(r.dataset.k) ? before.get(r.dataset.k) - r.getBoundingClientRect().top : 0;
    if (Math.abs(d) < .5 || still || !r.animate) continue;
    if (r === me && added) {
      r.classList.add('flmv');
      r.animate([{ transform: `translateY(${d}px) scale(1)`, offset: 0, easing: 'ease-out' }, { transform: `translateY(${d}px) scale(1.05)`, offset: .2, easing: 'cubic-bezier(.4,0,.2,1)' }, { transform: 'translateY(0) scale(1.05)', offset: .8, easing: 'ease-in-out' }, { transform: 'translateY(0) scale(1)', offset: 1 }], { duration: 620 }).onfinish = () => r.classList.remove('flmv');
    } else r.animate([{ transform: `translateY(${d}px)` }, { transform: 'translateY(0)' }], { duration: added ? 370 : 300, delay: added ? 125 : 0, easing: 'cubic-bezier(.3,.7,.3,1)', fill: 'backwards' });
  }
  return true;
}

/* ---- Quick view section of the chart menu: the two timeframes ---- */
function quickTfHTML() {
  const opts = cur => TF_GROUPS.map(([g, list]) => `<optgroup label="${g}">${list.map(tf => `<option value="${tf}"${tf === cur ? ' selected' : ''}>${tf}</option>`).join('')}</optgroup>`).join('');
  return `<div class="sech qvh"><span>${ic('flash', 15, 1.9)}Quick view</span></div><div class="qvdd">${[0, 1].map(i => `<label><span>Timeframe ${i + 1}</span><select data-qtf="${i}" aria-label="Quick view timeframe ${i + 1}">${opts(QV.tf[i])}</select></label>`).join('')}</div><div class="qvn">The two timeframes in the quick action panel. Hold the timeframe button to open it.</div>`;
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
    const el = $('.dlist', sh), sc = el.scrollTop, tools = picksFirst(DRAW_TOOLS, QV.tools, t => t[0]);
    el.innerHTML = `<div class="dsec">Tools</div>${DRAW_OPTS.map(([k, icn, n]) => `<button class="drow" data-do="${k}" role="switch" aria-checked="${!!S.draw[k]}"><span class="di">${ic(P[icn] ? icn : 'gear', 20, 1.7)}</span><span class="dnm">${n}</span><span class="tog${S.draw[k] ? ' on' : ''}"></span></button>`).join('')}<hr class="dhr"><div class="dsec">Drawings</div>${tools.map(([k, icn, n]) => `<div class="drow" data-k="${k}"><button class="dtap" data-dt="${k}"><span class="di">${ic(P[icn] ? icn : 'pen', 20, 1.7)}</span><span class="dnm">${n}</span></button>${flashBtn('tools', k, n)}</div>`).join('')}<div style="height:calc(20px + var(--sab))"></div>`;
    el.scrollTop = sc;
  };
  render();
  const layer = openLayer(sh, { label: 'Drawing Tools' });
  sh.addEventListener('click', e => {
    if (e.target.closest('.sh-x')) return layer.close('close');
    if (flashClick(e, render, $('.dlist', sh), '.drow[data-k]')) return;
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
    $('.tlist', sh).innerHTML = TPLS.length ? picksFirst(TPLS, QV.tpls, t => 'tpl:' + t.id).map(t => `<div class="trow" data-k="tpl:${t.id}"><button class="ttap" data-tp="${t.id}"><b>${escH(t.name)}</b><small>${escH(t.inds.join(', '))}</small></button>${flashBtn('tpls', 'tpl:' + t.id, 'Template ' + t.name)}<button class="tdel" data-td="${t.id}" aria-label="Delete template ${escH(t.name)}">${ic('trash', 18, 1.7)}</button></div>`).join('') : '<div class="tnone">No templates yet. Add indicators to the chart, then save them here.</div>';
  };
  render();
  const layer = openLayer(sh, { label: 'My Templates' });
  sh.addEventListener('click', e => {
    if (e.target.closest('.tback')) return layer.close('back');
    if (flashClick(e, render, $('.tlist', sh), '.trow')) return;
    const d = e.target.closest('[data-td]'); if (d) { const i = TPLS.findIndex(t => t.id === +d.dataset.td), nm = TPLS[i].name; TPLS.splice(i, 1); saveQuick(); render(); return toast(`Template ${nm} deleted`); }
    const a = e.target.closest('[data-tp]'); if (a) { layer.close('picked'); return applyTemplate(id, +a.dataset.tp); }
    if (e.target.closest('.tsave')) {
      const on = Object.keys(c.ind).filter(k => c.ind[k]); if (!on.length) return toast(`Add an indicator to ${c.short} first`);
      const nid = Math.max(0, ...TPLS.map(t => t.id)) + 1; TPLS.push({ id: nid, name: String(nid), inds: on.map(k => IND[k].full) }); saveQuick(); render(); toast(`Template ${nid} saved`, true);
    }
  });
}
