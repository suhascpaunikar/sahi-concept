/* ---- Overlay rendering ---- */
const rad = a => a * Math.PI / 180;
const pol = (hub, r, a) => [hub.x + r * Math.cos(rad(a)), hub.y + r * Math.sin(rad(a))];
function sectorPath(hub, r0, r1, s) {
  const a0 = s.a0, a1 = s.a0 + s.span, large = s.span > 180 ? 1 : 0;
  const [x0, y0] = pol(hub, r1, a0), [x1, y1] = pol(hub, r1, a1), [x2, y2] = pol(hub, r0, a1), [x3, y3] = pol(hub, r0, a0);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r1} ${r1} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}A${r0} ${r0} 0 ${large} 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z`;
}
function slotGroup(geo, s, hov) {
  const d = describe(SLOTS[s.i], s.chart), Lo = s.lay;
  const cls = ['slot', hov ? 'hov' : '', d.status === 'current' || d.status === 'na' ? 'cur' : ''].join(' ');
  let inner = '', y = Lo.y - Lo.h / 2;
  if (Lo.icon) { inner += `<svg x="${(Lo.x - 8).toFixed(1)}" y="${y.toFixed(1)}" width="16" height="16" viewBox="0 0 24 24"><g class="wi">${P[d.icon]}</g></svg>`; y += FIT.icon + FIT.gapIcon; }
  for (const t of Lo.lines) { inner += `<text class="lab" x="${Lo.x.toFixed(1)}" y="${(y + Lo.lh / 2).toFixed(1)}" style="font-size:${Lo.px}px;font-weight:${Lo.wt}">${escH(t)}</text>`; y += Lo.lh; }
  if (Lo.cap) inner += `<text class="cap${d.capOn ? ' on' : ''}" x="${Lo.x.toFixed(1)}" y="${(y + FIT.gapCap + Lo.clh / 2).toFixed(1)}" style="font-size:${Lo.capPx}px">${escH(d.cap)}</text>`;
  else if (d.capOn) { const [dx, dy] = pol(geo.hub, geo.rIn + 7, s.a0 + s.span / 2); inner += `<circle class="sdot" cx="${dx.toFixed(1)}" cy="${dy.toFixed(1)}" r="2.6"/>`; }
  return `<g class="${cls}" data-fit="${Lo.how}${Lo.noCap ? '-nocap' : ''}${Lo.noIcon ? '-noicon' : ''}"><path class="sec${hov ? ' hov' : ''}" d="${sectorPath(geo.hub, geo.rIn, geo.rOut, s)}"/>${inner}</g>`;
}
function renderOverlay() {
  $$('svg.wheel, .vpill, .qlist', app).forEach(x => x.remove());
  const geo = G.geo, hov = G.hover, fit = S.fit !== false, fs = S.fs || 1;
  if (geo.kind === 'list') return renderList(geo, hov);
  let s = `<svg class="wheel" width="${L.W}" height="${L.H}" viewBox="0 0 ${L.W} ${L.H}">`;
  // inner (cancel) zone
  if (geo.quarter) {
    const a0 = geo.bis - 45, a1 = geo.bis + 45, [x0, y0] = pol(geo.hub, geo.rIn - 5, a0), [x1, y1] = pol(geo.hub, geo.rIn - 5, a1);
    s += `<path class="hub" d="M${geo.hub.x} ${geo.hub.y}L${x0} ${y0}A${geo.rIn - 5} ${geo.rIn - 5} 0 0 1 ${x1} ${y1}Z"/>`;
  }
  for (const sec of geo.sectors) s += slotGroup(geo, sec, hov && hov.zone === 'slot' && hov.sec === sec);
  if (geo.dial) {
    s += `<line class="split" x1="${geo.hub.x - geo.rOut - 4}" y1="${geo.hub.y}" x2="${geo.hub.x + geo.rOut + 4}" y2="${geo.hub.y}"/>`;
    const up = fitLine(`${CH.idx.short} ▲`, 10 * fs, 500, L.W - 32, 9), dn = fitLine(`▼ ${CH.opt.short}`, 10 * fs, 500, L.W - 32, 9);
    s += `<text class="scope" x="${geo.hub.x}" y="${geo.hub.y - geo.rOut - 11}" style="font-size:${up.px}px">${escH(up.t)}</text><text class="scope" x="${geo.hub.x}" y="${geo.hub.y + geo.rOut + 13}" style="font-size:${dn.px}px">${escH(dn.t)}</text>`;
  }
  if (!fit) {
    // v1.0 behaviour: the readout sits in the hub (and under the finger in V3 and V4)
    const hubTxt = () => {
      if (hov && hov.zone === 'slot') { const d = describe(SLOTS[hov.sec.i], hov.sec.chart); return [d.scope || CH[hov.sec.chart].short, d.verb]; }
      if (geo.dial) return [`Up: ${CH.idx.short}`, `Down: ${CH.opt.short}`];
      return [CH[geo.chart].short, hov && hov.zone === 'outside' ? 'Release to cancel' : 'Slide to an action'];
    };
    const [t1, t2] = hubTxt();
    if (geo.quarter) { const [tx, ty] = pol(geo.hub, 64, geo.bis); s += `<text class="hubt" x="${tx}" y="${ty - 7}">${escH(t1)}</text><text class="hubs" x="${tx}" y="${ty + 9}">${escH(t2)}</text>`; }
    else { s += `<circle class="hub" cx="${geo.hub.x}" cy="${geo.hub.y}" r="${geo.rIn - 5}"/>`; const tx = S.v === 'v3' ? geo.hub.x - 22 : geo.hub.x; s += `<text class="hubt" x="${tx}" y="${geo.hub.y - 8}">${escH(t1)}</text><text class="hubs" x="${tx}" y="${geo.hub.y + 9}"${S.v === 'v3' ? ' style="font-size:9.5px"' : ''}>${escH(t2)}</text>`; }
  } else if (geo.quarter) {
    // the hub keeps only the chart it acts on; the action reads out in the pill outside the wheel
    const [tx, ty] = pol(geo.hub, 66, geo.bis), f = fitLine(CH[geo.chart].short, 12 * fs, 600, 92, 10);
    s += `<text class="hubt" x="${tx}" y="${ty}" style="font-size:${f.px}px">${escH(f.t)}</text>`;
  } else s += `<circle class="hub" cx="${geo.hub.x}" cy="${geo.hub.y}" r="${geo.rIn - 5}"/>`;
  if (geo.quarter) s += anchorGhost();
  else if (geo.dial) s += `<rect x="${geo.hub.x - 18}" y="${geo.hub.y - 1.2}" width="36" height="2.4" rx="1.2" fill="#fff" opacity=".9"/>`;
  s += '</svg>';
  $('#ov').appendChild(h(s));
  if (fit) renderReadout(geo, hov);
}
/* Readout pill: the full action, outside the wheel, on the side away from the hand. Two lines at most. */
function readoutText(geo, hov) {
  if (hov && hov.zone === 'slot') {
    const d = describe(SLOTS[hov.sec.i], hov.sec.chart), c = CH[hov.sec.chart];
    if (d.status === 'current') return { t: `${c.short} is already on ${SLOTS[hov.sec.i].tf}`, muted: true };
    if (d.status === 'na') return { t: d.verb, muted: true };
    return { t: d.verb, sc: d.scope || c.short };
  }
  if (hov && (hov.zone === 'outside' || hov.zone === 'separator')) return { t: 'Release to cancel', muted: true };
  if (geo.dial) return { t: `Up: ${CH.idx.short} · Down: ${CH.opt.short}`, muted: true };
  return { t: 'Slide to an action', sc: CH[geo.chart].short, muted: true };
}
function renderReadout(geo, hov) {
  const r = readoutText(geo, hov), hub = geo.hub, v = S.v;
  const el = h(`<div class="vpill on${r.muted ? ' muted' : ''}"><span class="in">${r.sc ? `<span class="sc">${escH(r.sc)}</span>` : ''}${escH(r.t)}</span></div>`);
  let maxW = Math.min(L.W - 16, 340);
  if (v === 'v3') maxW = Math.min(maxW, Math.max(120, hub.x - geo.rOut - 18));
  el.style.maxWidth = maxW + 'px';
  $('#ov').appendChild(el);
  const w = el.offsetWidth, hh = el.offsetHeight; let x, y;
  if (v === 'v1') { const pr = rectIn($('.tfb', CH[geo.chart].el)); x = pr.x + pr.w - w; y = pr.y - 8 - hh; }
  else if (v === 'v3') { x = hub.x - geo.rOut - 10 - w; y = hub.y - hh / 2; }
  else if (v === 'v4') { x = hub.x - w / 2; y = hub.y - geo.rOut - 24 - hh; if (y < L.sat + 4) y = hub.y + geo.rOut + 24; }
  else { x = (S.hand === 'left' ? hub.x + geo.rOut / 2 : hub.x - geo.rOut / 2) - w / 2; y = hub.y - geo.rOut - 8 - hh; }
  el.style.left = clamp(x, 8, L.W - 8 - w) + 'px'; el.style.top = clamp(y, L.sat + 4, L.H - L.sab - 4 - hh) + 'px';
}
function anchorGhost() {
  if (S.v === 'v1') { const id = G.geo.chart, r = rectIn($('.tfb', CH[id].el)), t = rectIn($('.tfl', CH[id].el)); return `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="12" fill="#3a3a3a"/><text class="ghost" x="${t.x}" y="${r.y + r.h / 2 + .5}">${escH(CH[id].tf)}</text>`; }
  if (S.v === 'v5') { const r = rectIn($('#dock')); return `<circle cx="${r.x + r.w / 2}" cy="${r.y + r.h / 2}" r="22" fill="#3a3a3a"/><svg x="${r.x + 11}" y="${r.y + 11}" width="22" height="22" viewBox="0 0 24 24"><g class="wi" style="stroke-width:1.6">${P.wheel}</g></svg>`; }
  if (S.v === 'v2') { const hub = G.geo.hub; return `<circle cx="${hub.x}" cy="${hub.y}" r="14" fill="#3a3a3a"/><svg x="${hub.x - 9}" y="${hub.y - 9}" width="18" height="18" viewBox="0 0 24 24"><g class="wi" style="stroke-width:1.6">${P.wheel}</g></svg>`; }
  return '';
}
function renderList(geo, hov) {
  const id = geo.chart, r = geo.rect, fit = S.fit !== false;
  const el = h(`<div class="qlist${fit ? ' fit' : ''}" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;transform-origin:${geo.above ? 'bottom' : 'top'} right">${SLOTS.map((sl, i) => {
    const d = describe(sl, id), on = hov && hov.zone === 'slot' && hov.sec.i === i;
    return `<div class="qli${on ? ' hov' : ''}${d.status === 'current' || d.status === 'na' ? ' na' : ''}" style="height:${geo.rowH}px">${d.big ? `<b class="qtf">${escH(d.label)}</b>` : ic(d.icon, 18, 1.8)}<span class="qn">${escH(rowName(sl, d))}</span><span class="s${d.capOn ? ' on' : ''}">${d.big ? '' : escH(d.cap)}</span></div>`;
  }).join('')}</div>`);
  $('#ov').appendChild(el);
}
function renderFallback() {
  const p = G.p0, why = G.geo && G.geo.reason === 'labels' ? 'Labels don’t fit the wheel at this text size' : 'Not enough room for the wheel';
  const el = h(`<div class="fbhint">${why} · release for Quick actions</div>`);
  $('#ov').appendChild(el); const w = el.offsetWidth;
  el.style.left = clamp(p.x - w / 2, 8, L.W - w - 8) + 'px'; el.style.top = clamp(p.y + 28, L.sat + 8, L.H - 60) + 'px';
  if (p.y > L.H - 120) el.style.top = (p.y - 70) + 'px';
}
function showTouch(p) { const t = $('#touch'); t.style.left = p.x + 'px'; t.style.top = p.y + 'px'; t.classList.add('on'); }
function hideTouch() { $('#touch').classList.remove('on'); }

/* ---- Quick actions list (fallback and accessible route) ---- */
function openQ1(id, from = 'a11y') {
  const render = () => `<div class="qhead">Applies to <span class="chipx">${escH(CH[id].short)}</span>${from === 'dock' ? '<button class="chipx swap" style="margin-left:auto">Switch chart</button>' : ''}</div>` + SLOTS.map((sl, i) => {
    const d = describe(sl, id);
    return `<button class="qrow" data-i="${i}" aria-disabled="${d.status === 'current' || d.status === 'na'}"><span class="qi">${d.big ? `<b style="font-size:13px;font-weight:600">${escH(d.label)}</b>` : ic(d.icon, 18, 1.8)}</span><span class="qt">${escH(d.big ? 'Timeframe ' + d.label : d.name)}<small>${escH(d.action)}</small></span><span class="qs${d.capOn ? ' on' : ''}">${d.status === 'current' ? 'Current' : d.big && d.status !== 'na' ? '' : escH(d.cap)}</span></button>`;
  }).join('');
  const sh = h(`<div class="sheet lsheet" style="max-height:${L.H - L.sat - 40}px"><div class="sh-title">Quick actions</div><button class="sh-x" aria-label="Close">${ic('x', 18, 1.7)}</button><div class="rows"></div></div>`);
  $('.rows', sh).innerHTML = render();
  const layer = openLayer(sh, { label: 'Quick actions' });
  track('q1_open', { chart: id, from });
  sh.addEventListener('click', e => {
    if (e.target.closest('.sh-x')) return layer.close('close');
    if (e.target.closest('.swap')) { id = other(id); S.focus = id; $('.rows', sh).innerHTML = render(); syncFocus(); return; }
    const b = e.target.closest('.qrow'); if (!b || b.getAttribute('aria-disabled') === 'true') return;
    const i = +b.dataset.i; layer.close('picked'); applySlot(i, id, { route: 'q1' }); Haptic.fire('success'); track('commit', { chart: id, slot: SLOTS[i].id, route: 'q1' });
  });
}
function syncFocus() { $$('.card').forEach(c => c.classList.toggle('focus', S.v === 'v5' && c.dataset.chart === S.focus)); const t = $('#dock .dt'); if (t) t.textContent = CH[S.focus].short; }
