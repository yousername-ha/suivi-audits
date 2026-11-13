/* global window, document, location, matchMedia, history */
/* Proposition autonome : données fictives, classement illustratif en mémoire seulement. */
(() => {
  'use strict';
  const d = structuredClone(window.DEMO_ORGANISATION);
  const paths = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    tree: '<rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M12 8v4H5v4m7-4h7v4"/>',
    chart: '<path d="M3 3v18h18M7 16l4-5 4 2 5-8"/>',
    diamond: '<path d="m12 3 9 9-9 9-9-9Z"/>',
    shield: '<path d="m12 2 8 4v7c0 5-8 9-8 9S4 18 4 13V6Z"/><path d="m8 12 3 3 5-6"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1"/>',
    restore: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7m2-4v6l4 2"/>',
    document: '<path d="M6 2h8l4 4v16H6Zm8 0v5h4M9 11h6m-6 4h6m-6 4h4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    moon: '<path d="M20.5 13A9 9 0 0 1 11 3.5 9 9 0 1 0 20.5 13Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    arrow: '<path d="m5 12 14 0m-5-5 5 5-5 5"/>',
    globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6h14M5 18h14"/>',
    politique: '<path d="m3 8 9-5 9 5H3Zm2 2v8m5-8v8m4-8v8m5-8v8M3 21h18"/>',
    economique: '<path d="M18 5a7 7 0 1 0 0 14M3 10h11M3 14h10"/>',
    social: '<circle cx="9" cy="7" r="3"/><path d="M2 21v-3a5 5 0 0 1 10 0v3m3-17a3 3 0 0 1 0 6m2 4a5 5 0 0 1 5 5v2"/>',
    technologique: '<rect x="6" y="6" width="12" height="12" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/>',
    environnemental: '<path d="M19 3C6 2 1 8 6 16s16 4 13-13Zm-1 2L6 18m6-7-5-1m6 0 1 5"/>',
    legal: '<path d="M12 3v18M5 21h14M3 7h18M5 7l-3 7h6L5 7Zm14 0-3 7h6l-3-7Z"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    warning: '<path d="m12 3 10 18H2Z"/><path d="M12 9v5m0 3h.01"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    play: '<path d="m8 4 12 8-12 8Z"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>'
  };
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.document}</svg>`;
  const query = new URLSearchParams(location.search);
  let active = d.factors.some(f => f.id === query.get('facteur')) ? query.get('facteur') : 'technologique';
  let theme = query.get('theme') === 'dark' ? 'dark' : 'light';
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  let moving = !motionQuery.matches, registry = false, search = '', internals = false;
  const externes = () => d.issues.filter(e => e.nature === 'ext');
  const known = e => d.factors.some(f => f.id === e.factor);
  const nonClasses = () => externes().filter(e => !known(e));
  const entries = id => externes().filter(e => e.factor === id);
  function setTheme() {
    document.documentElement.dataset.theme = theme;
    $('theme').innerHTML = icon(theme === 'dark' ? 'sun' : 'moon') + `<span>Mode ${theme === 'dark' ? 'clair' : 'sombre'}</span>`;
    history.replaceState(null, '', '?' + new URLSearchParams({ theme, facteur: active }));
  }
  function processTags(e) {
    return e.processus.map(name => {
      const p = d.processes.find(p => p.name === name);
      return `<span class="process-tag">${icon('tree')}${p ? `<b>${esc(p.id)}</b>` : ''}<span>${esc(name)}</span></span>`;
    }).join('') || '<span class="no-process">Aucun processus renseigné</span>';
  }
  function choice(e, prefix) {
    return `<label class="assignment"><span>Classement</span><select data-assign="${e.id}" id="${prefix}-${e.id}" aria-label="Facteur de l’enjeu ${esc(e.label)}"><option value="">Non classé</option>${d.factors.map(f => `<option value="${f.id}" ${e.factor === f.id ? 'selected' : ''}>${esc(f.label)}</option>`).join('')}</select></label>`;
  }
  function issue(e, prefix) {
    return `<article class="focus-issue"><div class="issue-title"><span class="issue-pin">${icon('document')}</span><h3>${esc(e.label)}</h3></div>${e.description ? `<p>${esc(e.description)}</p>` : ''}<div class="issue-bottom"><div class="process-tags">${processTags(e)}</div>${choice(e, prefix)}</div></article>`;
  }
  function metrics() {
    return `<section class="overview" aria-label="Synthèse des enjeux"><div><span class="metric-icon">${icon('globe')}</span><span><b>${externes().length}</b><small>Enjeux externes</small></span></div><div class="metric-green"><span class="metric-icon">${icon('check')}</span><span><b>${externes().length - nonClasses().length}</b><small>Classés par facteur</small></span></div><div class="metric-amber"><span class="metric-icon">${icon('warning')}</span><span><b>${nonClasses().length}</b><small>À classer</small></span></div><div><span class="metric-icon">${icon('tree')}</span><span><b>${d.issues.filter(e => e.nature === 'int').length}</b><small>Internes · hors PESTEL</small></span></div></section>`;
  }
  function graph() {
    const nodes = d.factors.map((f, i) => {
      const angle = (-90 + i * 60) * Math.PI / 180;
      return { ...f, x: 220 + Math.cos(angle) * 142, y: 202 + Math.sin(angle) * 142, i };
    });
    return `<div class="constellation"><svg class="connections" viewBox="0 0 440 404" aria-hidden="true"><circle class="orbit" cx="220" cy="202" r="142"/><circle class="orbit-inner" cx="220" cy="202" r="98"/>${nodes.map(f => `<g data-factor="${f.id}" class="${f.id === active ? 'current' : ''}"><path class="ray" d="M220 202L${f.x} ${f.y}"/><path class="flow" d="M220 202L${f.x} ${f.y}" style="--delay:${f.i * -.4}s"/></g>`).join('')}</svg><div class="context-hub" aria-label="${externes().length} enjeux externes"><span>${icon('globe')}</span><strong>${externes().length}</strong><small>ENJEUX EXTERNES</small><i aria-hidden="true"></i></div>${nodes.map(f => `<button class="factor-node" data-factor="${f.id}" data-pick="${f.id}" aria-pressed="${f.id === active}" aria-label="${esc(f.label)}, ${entries(f.id).length} enjeux" style="--x:${f.x / 440 * 100}%;--y:${f.y / 404 * 100}%"><span class="node-top">${icon(f.id)}<b>${entries(f.id).length}</b></span><strong>${esc(f.label)}</strong></button>`).join('')}</div>`;
  }
  function render() {
    const f = d.factors.find(f => f.id === active), list = entries(active), unknown = nonClasses(), ints = d.issues.filter(e => e.nature === 'int');
    document.documentElement.dataset.motion = moving ? 'on' : 'off';
    $('content').innerHTML = `${metrics()}<section class="pestel-stage" aria-labelledby="stage-title"><header class="stage-heading"><div><span class="eyebrow">LECTURE DE L’ENVIRONNEMENT</span><h2 id="stage-title">Une vue d’ensemble, six perspectives</h2></div><button class="button small" id="motion" aria-pressed="${!moving}">${icon(moving ? 'pause' : 'play')}<span>${moving ? 'Pause animations' : 'Reprendre les animations'}</span></button></header><div class="explorer"><div class="graph-panel">${graph()}<p class="graph-caption">${icon('info')}Sélectionnez un facteur pour explorer ses enjeux.</p></div><section class="factor-focus" data-factor="${active}" aria-labelledby="factor-title"><header><div class="focus-icon">${icon(active)}</div><div class="factor-heading"><span class="eyebrow">0${d.factors.indexOf(f) + 1} / FACTEUR SÉLECTIONNÉ</span><h2 id="factor-title">${esc(f.label)}</h2></div><span class="focus-count"><b>${list.length}</b> enjeu${list.length > 1 ? 'x' : ''}</span></header><div class="focus-list">${list.length ? list.map(e => issue(e, 'focus')).join('') : `<div class="factor-empty">${icon(f.id)}<h3>Aucun enjeu classé</h3><p>Les enjeux associés à ce facteur apparaîtront ici.</p><button class="button small" data-show-unknown>Voir les enjeux à classer ${icon('arrow')}</button></div>`}</div><footer><span class="factor-dot"></span>Enjeux externes du contexte de l’organisation</footer></section></div><div class="factor-legend">${d.factors.map(f => `<button data-pick="${f.id}" data-factor="${f.id}" aria-pressed="${f.id === active}"><span>${esc(f.letter)}</span>${esc(f.label)}<b>${entries(f.id).length}</b></button>`).join('')}</div></section>
    <section class="unclassified" id="unknown" aria-labelledby="unknown-title"><header><span class="metric-icon">${icon('warning')}</span><div><span class="eyebrow">À COMPLÉTER</span><h2 id="unknown-title">Enjeux externes à classer <b>${unknown.length}</b></h2></div></header>${unknown.length ? unknown.map(e => `<div class="unknown-row"><div><h3>${esc(e.label)}</h3><div class="process-tags">${processTags(e)}</div></div>${choice(e, 'unknown')}</div>`).join('') : '<p class="all-classified">Tous les enjeux externes sont classés.</p>'}</section>
    <section class="internal-shelf" aria-label="Enjeux internes hors PESTEL"><button id="internal-toggle" aria-expanded="${internals}" aria-controls="internal-content"><span class="metric-icon">${icon('tree')}</span><span><strong>Enjeux internes <b>${ints.length}</b></strong><small>Conservés dans le contexte et le SWOT, hors classement PESTEL.</small></span><span class="shelf-plus" aria-hidden="true">${internals ? '−' : '+'}</span></button><div id="internal-content" ${internals ? '' : 'hidden'}>${ints.map(e => `<article><h3>${esc(e.label)}</h3>${e.description ? `<p>${esc(e.description)}</p>` : ''}<div class="process-tags">${processTags(e)}</div></article>`).join('')}</div></section>
    <section class="registry panel" id="registry" aria-labelledby="registry-title" ${registry ? '' : 'hidden'}><header><div><span class="eyebrow">TOUS LES ENJEUX EXTERNES</span><h2 id="registry-title">Registre complet <span>${externes().length}</span></h2></div><label><span>Rechercher un enjeu</span><input id="issue-search" type="search" value="${esc(search)}" placeholder="Intitulé ou processus…"></label></header><div class="registry-rows">${externes().map(e => `<article class="registry-row" data-label="${esc((e.label + ' ' + e.processus.join(' ')).toLowerCase())}"><div><h3>${esc(e.label)}</h3><div class="process-tags">${processTags(e)}</div></div>${choice(e, 'registry')}</article>`).join('')}</div><p id="search-empty" hidden>Aucun enjeu ne correspond à votre recherche.</p></section>
    <details class="methodology"><summary>${icon('info')}Comprendre cette lecture PESTEL<span>À propos</span></summary><p>Le PESTEL n’est pas exigé par la norme ISO 9001:2015 : c’est une présentation facultative des enjeux externes de l’article 4.1. La note 2 cite l’environnement juridique, technologique, concurrentiel, commercial, culturel, social et économique ; les facteurs « politique » et « environnemental » vont au-delà. Les facteurs affichés suivent votre nomenclature. Les enjeux internes restent dans le contexte et le SWOT.</p></details>`;
    $('registry-toggle').setAttribute('aria-expanded', String(registry));
    $('motion').onclick = () => { moving = !moving; render(); $('motion').focus({preventScroll:true}); };
    $('internal-toggle').onclick = () => { internals = !internals; render(); $('internal-toggle').focus({preventScroll:true}); };
    document.querySelectorAll('[data-pick]').forEach(b => { b.onclick = () => { const graph = b.classList.contains('factor-node'); active = b.dataset.pick; render(); document.querySelector(`${graph ? '.factor-node' : '.factor-legend button'}[data-pick="${active}"]`).focus({preventScroll:true}); setTheme(); }; });
    document.querySelector('[data-show-unknown]')?.addEventListener('click', () => { $('unknown').scrollIntoView({block:'center',behavior:motionQuery.matches ? 'instant' : 'smooth'}); $('unknown').querySelector('select')?.focus({preventScroll:true}); });
    document.querySelectorAll('[data-assign]').forEach(s => { s.onchange = () => { const e = d.issues.find(e => e.id === s.dataset.assign), controlId = s.id; e.factor = s.value || null; render(); const focus = $(controlId) || document.querySelector(`.factor-node[data-pick="${active}"]`); focus.focus({preventScroll:true}); announce('Classement illustratif modifié dans la maquette.'); }; });
    $('issue-search').oninput = e => { search = e.target.value; applySearch(); };
    applySearch();
  }
  function applySearch() {
    let count = 0;
    document.querySelectorAll('.registry-row').forEach(r => { r.hidden = !r.dataset.label.includes(search.trim().toLowerCase()); if (!r.hidden) count++; });
    $('search-empty').hidden = count > 0;
  }
  function announce(message) { $('notice').textContent = message; $('notice').hidden = false; window.clearTimeout(announce.timer); announce.timer = window.setTimeout(() => { $('notice').hidden = true; }, 2600); }
  document.querySelectorAll('[data-icon]').forEach(n => n.outerHTML = icon(n.dataset.icon));
  $('theme').onclick = () => { theme = theme === 'light' ? 'dark' : 'light'; setTheme(); };
  $('registry-toggle').onclick = () => { registry = !registry; render(); if (registry) { $('registry').scrollIntoView({block:'start',behavior:motionQuery.matches ? 'instant' : 'smooth'}); $('issue-search').focus({preventScroll:true}); } };
  $('mobile-menu').onclick = () => { const opened = document.querySelector('.sidebar').classList.toggle('open'); $('mobile-menu').setAttribute('aria-expanded', String(opened)); };
  document.querySelector('[data-reference=swot]').onclick = () => location.href = '../organisation-swot-matrice/?theme=' + theme;
  document.querySelector('[data-reference=parties]').onclick = () => location.href = '../organisation-contexte-studio/?vue=parties&theme=' + theme;
  document.querySelector('[data-retained]').onclick = () => announce('La présentation validée du contexte est conservée.');
  motionQuery.addEventListener('change', e => { moving = !e.matches; render(); });
  setTheme(); render();
})();
