/* Maquette autonome. Interactions uniquement en mémoire, sans appel à l’application. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const E = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const paths = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="4" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="11" width="7" height="10" rx="1"/>',
    tree: '<rect x="9" y="3" width="6" height="5" rx="1"/><path d="M12 8v5M5 16v-3h14v3"/><rect x="2" y="16" width="6" height="5" rx="1"/><rect x="16" y="16" width="6" height="5" rx="1"/>',
    chart: '<path d="M3 3v18h18M7 14l4-5 4 3 5-7"/>',
    shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6z"/><path d="m8 12 3 3 5-6"/>',
    check: '<path d="m5 12 4 4L20 5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1"/>',
    restore: '<path d="M3 10a9 9 0 1 1 2 8M3 4v6h6M12 7v5l3 2"/>',
    document: '<path d="M14 3H5v18h14V8zM14 3v5h5M8 12h8M8 16h6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    moon: '<path d="M20.5 14A9 9 0 0 1 10 3a9 9 0 1 0 10.5 11Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1 1M18 18l1 1M5 19l1-1M18 6l1-1"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    play: '<path d="m8 4 12 8-12 8z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 17h2"/>',
    search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
    reset: '<path d="M4 11a8 8 0 1 1 2 6M4 5v6h6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    warning: '<path d="m12 3 10 18H2zM12 9v5M12 17h.01"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-3a8 8 0 0 1 16 0v3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    cycle: '<path d="M20 8a8 8 0 0 0-14-3L3 8M3 3v5h5M4 16a8 8 0 0 0 14 3l3-3M21 21v-5h-5"/>',
    edit: '<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14zM12 21h9"/>',
    link: '<path d="m10 14 4-4M8 16l-2 2a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 8l2-2a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0" transform="translate(1 0) scale(.92)"/>',
    kanban: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="5" height="14" rx="1"/>',
    timeline: '<path d="M6 3v18M6 6h15M6 12h10M6 18h15"/><circle cx="6" cy="6" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="6" cy="18" r="2"/>',
    gantt: '<path d="M3 4v17h19M7 7h8M10 12h10M6 17h8"/>',
    done: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    blocked: '<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
    todo: '<circle cx="12" cy="12" r="7"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    group: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6M21 21v-4a5 5 0 0 0-3-4"/>',
  };
  const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.list}</svg>`;
  const decorate = () => document.querySelectorAll('[data-icon]').forEach((e) => { e.outerHTML = icon(e.dataset.icon); });
  const data = structuredClone(window.DEMO_OPERATIONS);
  const params = new URLSearchParams(location.search);
  const state = { page: params.get('page') === 'recurrences' ? 'recurrences' : 'actions', sub: 'occurrences', view: ['list','kanban','calendar','timeline','gantt','dashboard'].includes(params.get('view')) ? params.get('view') : 'timeline', timelineDays: 42, timelineStart: null, quick: 'all', expanded: null, edit: null, create: false };
  const statuses = { todo: ['À faire', 'amber', 'todo'], progress: ['En cours', 'blue', 'play'], blocked: ['Bloquée', 'red', 'blocked'], done: ['Terminée', 'teal', 'done'], cancelled: ['Annulée', 'muted', 'close'] };
  const priorities = { low: ['Basse', 'muted'], normal: ['Normale', 'blue'], high: ['Haute', 'amber'], urgent: ['Urgente', 'red'] };
  const views = [['timeline', 'Timeline', 'timeline'], ['list', 'Liste compacte', 'list'], ['kanban', 'Kanban', 'kanban'], ['calendar', 'Calendrier', 'calendar'], ['gantt', 'Planning / Gantt', 'gantt'], ['dashboard', 'Synthèse', 'chart']];
  const date = (d, short = false) => d ? new Date(d + 'T12:00:00Z').toLocaleDateString('fr-FR', short ? { day: '2-digit', month: 'short' } : { day: '2-digit', month: 'short', year: 'numeric' }) : 'Sans échéance';
  const diff = (d) => Math.round((Date.parse(d) - Date.parse(data.date)) / 86400000);
  const isClosed = (o) => ['done', 'cancelled'].includes(o.status) || !!o.validation;
  const isLate = (o) => !isClosed(o) && o.due && diff(o.due) < 0;
  const series = () => state.page === 'recurrences' && state.sub === 'series';
  const occurrences = () => data.occurrences.map((o) => ({ ...data.series.find((s) => s.id === o.series), ...o, seriesId: o.series, plan: 'Contrôles récurrents', start: o.due, dependencies: [], justification: '' }));
  const base = () => state.page === 'actions' ? data.actions : series() ? data.series : occurrences();
  const tone = (o) => o.active !== undefined && series() ? (o.active ? 'teal' : 'muted') : o.validation === 'KO' || isLate(o) ? 'red' : statuses[o.status][1];
  const chip = (text, color, glyph) => `<span class="state-chip" data-tone="${color}">${icon(glyph)}${E(text)}</span>`;
  const priority = (o) => `<span class="priority" data-tone="${priorities[o.priority][1]}"><i class="priority-dot"></i>${priorities[o.priority][0]}</span>`;
  const owner = (o) => `<div class="owner ${o.owner ? '' : 'unassigned'}">${E(o.owner || 'Non attribuée')}<small>${icon(o.ownerType === 'Groupe' ? 'group' : 'user')}${E(o.ownerType || 'À désigner')}</small></div>`;
  const ring = (percent) => `<div class="ring" aria-label="${percent} %"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="32"/><circle class="value" cx="40" cy="40" r="32" stroke-dasharray="${(201.062 * percent / 100).toFixed(2)} 201.062"/></svg><span class="ring-text">${percent}%</span></div>`;
  const result = (v) => `<span class="result-pill" data-tone="${v === 'OK' ? 'teal' : v === 'KO' ? 'red' : 'muted'}">${icon(v === 'OK' ? 'check' : v === 'KO' ? 'warning' : 'blocked')}${v}</span>`;
  const bar = (count, total, color) => `<span class="track" data-tone="${color}"><span style="--fill:${total ? count / total * 100 : 0}%"></span></span>`;
  let noticeTimer;
  function notice(message) { $('#notice').textContent = message; $('#notice').hidden = false; clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { $('#notice').hidden = true; }, 4500); }
  function updateMotion(on) { document.documentElement.dataset.motion = on ? 'on' : 'off'; $('#motion').innerHTML = icon(on ? 'pause' : 'play') + `<span>${on ? 'Pause animations' : 'Reprendre les animations'}</span>`; }
  function updateTheme(theme) { document.documentElement.dataset.theme = theme; $('#theme').innerHTML = icon(theme === 'light' ? 'moon' : 'sun') + `<span>${theme === 'light' ? 'Mode sombre' : 'Mode clair'}</span>`; }

  function overview() {
    const recurring = state.page === 'recurrences', items = recurring ? occurrences() : data.actions;
    const open = items.filter((o) => !isClosed(o)), late = items.filter(isLate), done = items.filter((o) => o.status === 'done'), unassigned = open.filter((o) => !o.owner);
    const metrics = recurring ? [
      [data.series.length, 'Séries récurrentes', 'cycle', 'violet', `${data.series.filter((s) => s.active).length} actives · ${data.series.filter((s) => !s.active).length} en pause`],
      [open.length, 'Occurrences ouvertes', 'list', 'blue', `Toutes les échéances disponibles`],
      [late.length, 'Occurrence en retard', 'warning', 'red', 'Échéance dépassée · sans validation'],
      [items.filter((o) => o.validation === 'KO').length, 'Validation KO', 'warning', 'red', 'Résultat à examiner · occurrence validée'],
    ] : [
      [items.length, 'Actions du périmètre', 'list', 'blue', `${new Set(items.map((o) => o.plan)).size} plans d’actions représentés`],
      [open.length, 'Actions ouvertes', 'play', 'teal', `${open.filter((o) => o.status === 'progress').length} en cours · ${open.filter((o) => o.status === 'blocked').length} bloquée`],
      [late.length, 'Actions en retard', 'warning', 'red', 'Échéance dépassée · action ouverte'],
      [unassigned.length, 'Sans responsable', 'user', 'amber', 'Actions ouvertes à attribuer'],
    ];
    const bands = [[late.length, 'Échéance dépassée', 'red'], [open.filter((o) => diff(o.due) >= 0 && diff(o.due) <= 7).length, '7 prochains jours', 'amber'], [open.filter((o) => diff(o.due) > 7).length, 'Au-delà de 7 jours', 'blue']];
    const pct = items.length ? Math.round(done.length / items.length * 100) : 0;
    $('#overview').innerHTML = `<div class="metrics">${metrics.map(([count, label, glyph, color, note]) => `<article class="metric" data-tone="${color}"><header><span>${label}</span><span class="metric-icon">${icon(glyph)}</span></header><strong>${count}</strong><footer>${note}</footer></article>`).join('')}</div><section class="insight-strip" aria-label="Synthèse du périmètre"><div class="horizon"><header><span class="eyebrow">01 / Horizon</span><h2>Échéances ouvertes</h2><p>Au 10 novembre 2026</p></header><div class="horizon-bands">${bands.map(([n, label, color]) => `<div class="horizon-band" data-tone="${color}"><b>${n}</b><small>${label}</small>${bar(n, open.length, color)}</div>`).join('')}</div></div><div class="closure">${recurring ? `<span class="metric-icon" data-tone="teal">${icon('done')}</span><div><span class="eyebrow">02 / Résultats des occurrences</span><h2>${items.filter((o) => o.validation).length} occurrences validées</h2><div class="validation-pills">${['OK', 'KO', 'NA'].map((v) => `<span class="result-pill" data-tone="${v === 'OK' ? 'teal' : v === 'KO' ? 'red' : 'muted'}">${icon(v === 'OK' ? 'check' : v === 'KO' ? 'warning' : 'blocked')}<b>${items.filter((o) => o.validation === v).length}</b>${v}</span>`).join('')}</div></div>` : `${ring(pct)}<div><span class="eyebrow">02 / Clôture des actions</span><h2><strong>${done.length} sur ${items.length}</strong> actions terminées</h2><p>${open.length} actions restent ouvertes.</p></div>`}</div></section>`;
  }

  function filters() {
    const b = base();
    const plans = [...new Set(b.map((o) => o.plan).filter(Boolean))];
    $('#plan').innerHTML = `<option value="">${state.page === 'actions' ? 'Tous les plans' : 'Tous les registres'}</option>` + plans.map((p) => `<option>${E(p)}</option>`).join('');
    $('#plan').disabled = series();
    $('#owner').innerHTML = '<option value="">Tous les responsables</option><option value="none">Non attribuée</option>' + [...new Set(b.map((o) => o.owner).filter(Boolean))].map((p) => `<option>${E(p)}</option>`).join('');
    $('#status').innerHTML = '<option value="">Tous les états</option>' + (series() ? '<option value="active">Active</option><option value="paused">En pause</option>' : Object.entries(statuses).map(([id, [label]]) => `<option value="${id}">${label}</option>`).join(''));
    $('#search').value = '';
    $('#search').placeholder = series() ? 'Rechercher une série, une référence…' : 'Rechercher une action, une référence…';
    $('#closed').checked = true;
    $('#closed-label').textContent = series() ? 'Afficher les séries en pause' : state.page === 'actions' ? 'Afficher les actions closes' : 'Afficher les occurrences validées';
  }
  function quickFilters() {
    const b = base();
    const opts = series() ? [['all', 'Toutes', b.length, 'blue'], ['active', 'Actives', b.filter((o) => o.active).length, 'teal'], ['paused', 'En pause', b.filter((o) => !o.active).length, 'muted']] : [['all', 'Toutes', b.length, 'blue'], ['late', 'En retard', b.filter(isLate).length, 'red'], ['week', '7 prochains jours', b.filter((o) => !isClosed(o) && diff(o.due) >= 0 && diff(o.due) <= 7).length, 'amber'], ...(state.page === 'recurrences' ? [['ko', 'Validées KO', b.filter((o) => o.validation === 'KO').length, 'red']] : [['blocked', 'Bloquées', b.filter((o) => o.status === 'blocked').length, 'red']])];
    $('#quick-filters').innerHTML = opts.map(([id, label, n, color]) => `<button type="button" data-quick="${id}" data-tone="${color}" aria-pressed="${state.quick === id}">${id === 'late' || id === 'ko' ? icon('warning') : ''}${label}<b>${n}</b></button>`).join('');
  }
  function filtered() {
    const search = $('#search').value.toLocaleLowerCase('fr'), plan = $('#plan').value, own = $('#owner').value, status = $('#status').value;
    return base().filter((o) => [o.name, o.id, o.ref, o.description, o.owner, o.seriesId, o.plan].join(' ').toLocaleLowerCase('fr').includes(search) && (!plan || o.plan === plan) && (!own || (own === 'none' ? !o.owner : o.owner === own)) && (!status || (series() ? (status === 'active' ? o.active : !o.active) : o.status === status)) && ($('#closed').checked || (series() ? o.active : !isClosed(o))) && (state.quick === 'all' || (state.quick === 'active' && o.active) || (state.quick === 'paused' && !o.active) || (state.quick === 'late' && isLate(o)) || (state.quick === 'week' && !isClosed(o) && diff(o.due) >= 0 && diff(o.due) <= 7) || (state.quick === 'blocked' && o.status === 'blocked') || (state.quick === 'ko' && o.validation === 'KO')));
  }
  function due(o) {
    let label = '';
    if (isLate(o)) label = `${-diff(o.due)} jour${diff(o.due) < -1 ? 's' : ''} de retard`;
    else if (o.validation) label = 'Occurrence validée';
    else if (isClosed(o)) label = 'Action close';
    else if (diff(o.due) === 0) label = 'Aujourd’hui';
    else if (diff(o.due) > 0) label = `Dans ${diff(o.due)} jours`;
    return `<div class="due ${isLate(o) ? 'overdue' : diff(o.due) === 0 ? 'today' : ''}">${date(o.due)}<small>${label}</small></div>`;
  }
  function statusCell(o) {
    if (series()) return `<div class="state">${chip(o.active ? 'Active' : 'En pause', o.active ? 'teal' : 'muted', o.active ? 'cycle' : 'pause')}</div>`;
    if (o.validation) return `<div class="state">${chip('Validée ' + o.validation, o.validation === 'OK' ? 'teal' : o.validation === 'KO' ? 'red' : 'muted', o.validation === 'OK' ? 'check' : o.validation === 'KO' ? 'warning' : 'blocked')}<span class="validation-label" data-tone="muted">${icon('done')}Action terminée</span></div>`;
    const [label, color, glyph] = statuses[o.status];
    return `<div class="state">${chip(label, color, glyph)}${isLate(o) ? `<span class="state-alert">${icon('warning')}Échéance dépassée</span>` : o.validation ? `<span class="validation-label" data-tone="${o.validation === 'OK' ? 'teal' : o.validation === 'KO' ? 'red' : 'muted'}">${icon(o.validation === 'OK' ? 'check' : o.validation === 'KO' ? 'warning' : 'blocked')}Validée ${o.validation}</span>` : ''}</div>`;
  }
  function rows(items) {
    const recurrent = state.page === 'recurrences';
    const header = ['Action', 'Priorité', 'Responsable', 'Échéance', 'État'];
    if (recurrent) header.splice(0, 5, series() ? 'Série récurrente' : 'Occurrence', 'Périodicité', 'Responsable', series() ? 'Prochaine occurrence' : 'Échéance', series() ? 'État de la série' : 'État / résultat');
    return `<div class="list-head" aria-hidden="true">${header.map((h) => `<span>${h}</span>`).join('')}<span></span></div>${items.map((o) => {
      const expanded = state.expanded === o.id;
      const next = series() ? occurrences().filter((p) => p.seriesId === o.id && !isClosed(p) && diff(p.due) >= 0).sort((a, b) => a.due.localeCompare(b.due))[0] : null;
      return `<article class="row-group" data-id="${o.id}" data-expanded="${expanded}" aria-label="${E(o.name)}"><div class="data-row" data-tone="${tone(o)}"><div class="row-main"><span class="row-code">${E(o.id)}</span><div><button class="row-title" data-expand="${o.id}" aria-expanded="${expanded}" aria-controls="detail-${o.id}">${E(o.name)}</button><div class="row-meta"><span class="ref-tag">${E(o.ref)}</span>${recurrent ? `${icon('cycle')}<span>${E(series() ? `${o.time} · ${o.timezone}` : o.seriesId)}</span>` : `<span>${E(o.plan)}</span>`}</div></div></div>${recurrent ? `<div class="rhythm">${E(o.rhythm)}<small>${series() ? `Rappel J−${o.reminder}` : o.time + ' · Paris'}</small></div>` : priority(o)}${owner(o)}${series() ? `<div class="due">${o.active && next ? date(next.due) : '—'}<small>${o.active ? (next ? 'Occurrence connue' : 'Aucune à venir générée') : 'Série en pause'}</small></div>` : due(o)}${statusCell(o)}<button class="expand" data-expand="${o.id}" aria-label="${expanded ? 'Replier' : 'Déplier'} ${E(o.name)}" aria-expanded="${expanded}" aria-controls="detail-${o.id}">${icon('plus')}</button></div><div id="detail-${o.id}" ${expanded ? '' : 'hidden'}>${expanded ? detail(o) : ''}</div></article>`;
    }).join('')}`;
  }
  function dl(items) { return `<dl>${items.map(([a, b]) => `<div><dt>${a}</dt><dd>${b}</dd></div>`).join('')}</dl>`; }
  function detail(o) {
    const recurrent = state.page === 'recurrences', s = recurrent ? (series() ? o : data.series.find((p) => p.id === o.seriesId)) : null;
    const deps = (o.dependencies || []).map((id) => data.actions.find((p) => p.id === id)).filter(Boolean);
    return `<section class="row-detail" aria-label="Détail ${E(o.id)}"><header class="detail-heading"><div><span class="eyebrow">${recurrent ? 'Série & occurrence' : 'Lecture de l’action'} / ${E(o.id)}</span><h3>${E(o.name)}</h3><p>${E(o.description)}</p></div><button class="button small" data-edit="${o.id}">${icon('edit')}${series() ? 'Modifier la série' : 'Modifier la fiche'}</button></header><div class="detail-grid"><section><h4>${icon('user')}Réalisation</h4>${dl([['Responsable', E(o.owner || 'Non attribuée')], ['Désignation', E(o.ownerType || 'À renseigner')], ['Priorité', priority(o)], ...(series() ? [['Début de la série', date(o.start)], ['Heure & fuseau', `${o.time} · ${E(o.timezone)}`]] : [['Début', date(o.start)], ['Échéance', date(o.due)]])])}</section><section><h4>${icon(recurrent ? 'clock' : 'link')}${recurrent ? 'Rythme & fenêtre' : 'Liens & dépendances'}</h4>${recurrent ? `${dl([['Périodicité', E(s.rhythm)], ['Rappel', `${s.reminder} jour(s) avant`], ['Fenêtre', s.window ? `J−${s.window[0]} à J+${s.window[1]}` : 'Sans limite de fenêtre']])}${s.window ? `<div class="window-map"><span>J−${s.window[0]}</span><b>Échéance</b><span>J+${s.window[1]}</span></div>` : ''}<p class="muted">${s.excluded.length ? `Jours exclus : ${E(s.excluded.join(', '))}.` : 'Aucun jour de semaine exclu.'}${s.dates.length ? ` Date exclue : ${s.dates.map((d) => date(d)).join(', ')}.` : ''}</p>` : `<div class="detail-tags"><span>${E(o.ref)}</span><span>${E(o.plan)}</span></div>${deps.length ? `<p>Prérequis : ${deps.map((p) => E(p.id) + ' · ' + E(p.name)).join(' ; ')}.</p>` : '<p class="muted">Aucune dépendance renseignée.</p>'}<p class="muted">Les liens restent accessibles depuis la fiche.</p>`}</section><section><h4>${icon(recurrent ? 'done' : 'document')}${recurrent ? 'Validation & preuve' : 'Justification & documents'}</h4>${recurrent ? (series() ? `<p>Chaque occurrence porte son propre résultat <b>OK, KO ou NA</b>, son compte rendu et sa preuve.</p><div class="detail-tags"><span>${E(s.ref)}</span></div>` : o.validation ? `<div class="validation-pills">${result(o.validation)}</div><p class="muted">Occurrence validée. La série et les autres occurrences gardent leur propre état.</p>` : `<p class="muted">Cette occurrence n’a pas encore de validation.</p><div class="validation-pills">${['OK', 'KO', 'NA'].map((v) => result(v)).join('')}</div>`) : `<p${o.justification ? '' : ' class="muted"'}>${E(o.justification || 'Aucune justification renseignée.')}</p>`}${o.document ? `<div class="detail-doc">${icon('document')}${E(o.document)}</div>` : '<p class="muted">Aucune preuve documentaire renseignée.</p>'}</section></div><div class="detail-footer"><span>${recurrent ? 'La validation reste propre à chaque occurrence.' : 'L’état, la priorité et le retard se lisent séparément.'}</span><div>${recurrent && !series() && !o.validation ? `<button class="button primary small" data-validate="${o.id}">${icon('check')}Valider l’occurrence</button>` : ''}<button class="button quiet small" data-history="${o.id}">${icon('restore')}Historique</button><button class="button quiet small" data-expand="${o.id}">Replier</button></div></div><div id="editor-${o.id}"></div></section>`;
  }

  function kanban(items) { return `<div class="kanban">${Object.entries(statuses).filter(([k]) => k !== 'cancelled').map(([key, [label, color]]) => `<section class="kanban-column" data-tone="${color}"><h3>${label}<b>${items.filter((o) => o.status === key).length}</b></h3>${items.filter((o) => o.status === key).map((o) => `<button class="kanban-card" data-tone="${tone(o)}" data-read="${o.id}"><span class="eyebrow">${o.id}</span><strong>${E(o.name)}</strong><small>${E(o.owner || 'Non attribuée')}</small><small>${date(o.due)}</small>${isLate(o) ? `<span class="state-alert">${icon('warning')}En retard</span>` : o.validation ? `<span class="validation-label">Validée ${o.validation}</span>` : ''}</button>`).join('')}</section>`).join('')}</div>`; }
  function calendar(items) { return `<div class="calendar-heading"><span>Novembre 2026</span><span class="count">Mois de démonstration</span></div><div class="calendar-grid">${['Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.', 'Dim.'].map((d) => `<strong>${d}</strong>`).join('')}${Array.from({ length: 6 }, () => '<div class="calendar-day"></div>').join('')}${Array.from({ length: 30 }, (_, i) => { const n = String(i + 1).padStart(2, '0'), day = '2026-11-' + n; return `<div class="calendar-day ${day === data.date ? 'is-today' : ''}"><b>${i + 1}</b>${items.filter((o) => o.due === day).map((o) => `<button data-tone="${tone(o)}" data-read="${o.id}">${E(o.name)}</button>`).join('')}</div>`; }).join('')}</div><div class="calendar-agenda">${agenda(items.filter((o) => o.due?.startsWith('2026-11')))}</div>`; }
  function agenda(items) { return [['Échéance dépassée', (o) => isLate(o)], ['7 prochains jours', (o) => !isClosed(o) && diff(o.due) >= 0 && diff(o.due) <= 7], ['À venir ensuite', (o) => !isClosed(o) && diff(o.due) > 7], ['Terminées / validées', (o) => isClosed(o)]].map(([label, predicate]) => `<section class="timeline-group"><h3>${label}</h3><div>${items.filter(predicate).map((o) => `<button class="timeline-card" data-tone="${tone(o)}" data-read="${o.id}"><span class="row-title">${E(o.name)}</span><small>${date(o.due)}</small>${o.validation ? result(o.validation) : chip(...statuses[o.status])}</button>`).join('') || '<p class="empty">Aucun élément.</p>'}</div></section>`).join(''); }
  function timeline(items) { return window.STUDIO_TIMELINE.render(items, { state, data, E, icon, date, isLate, isClosed, statuses, detail, chip }); }
  function gantt(items) {
    return `<svg class="gantt" viewBox="0 0 1040 ${68 + items.length * 43}" role="group" aria-label="Planning des échéances de novembre 2026"><g>${Array.from({ length: 30 }, (_, i) => `<line class="grid" x1="${280 + i * 24}" y1="40" x2="${280 + i * 24}" y2="${52 + items.length * 43}"/><text x="${280 + i * 24}" y="24" text-anchor="middle">${i + 1}</text>`).join('')}</g><line class="today-line" x1="496" y1="37" x2="496" y2="${52 + items.length * 43}"/>${items.map((o, i) => { const start = o.start?.startsWith('2026-11') ? Number(o.start.slice(-2)) : 1, end = o.due?.startsWith('2026-11') ? Number(o.due.slice(-2)) : start; return `<g data-tone="${tone(o)}" data-read="${o.id}" role="button" tabindex="0" aria-label="Lire ${E(o.name)}"><text x="10" y="${68 + i * 43}" class="gantt-label">${E(o.name.length > 38 ? o.name.slice(0, 37) + '…' : o.name)}</text><rect class="bar" x="${280 + (start - 1) * 24}" y="${54 + i * 43}" width="${Math.max(11, (end - start + 1) * 24 - 3)}" height="17"/><title>${E(o.name)} · ${date(o.due)}</title></g>`; }).join('')}</svg><div class="gantt-note"><i class="dot"></i>Le trait marque aujourd’hui. Sélectionnez une barre pour lire la fiche.</div><div class="gantt-mobile">${agenda(items)}</div>`;
  }
  function dashboard(items) {
    return `<div class="status-summary"><section class="summary-panel"><span class="eyebrow">Répartition du registre filtré</span><h3>Actions par état</h3>${Object.entries(statuses).map(([id, [label, color]]) => { const n = items.filter((o) => o.status === id).length; return `<div class="summary-bar" data-tone="${color}"><span>${label}</span>${bar(n, items.length, color)}<b>${n}</b></div>`; }).join('')}<p>Les données de cette vue suivent les filtres du registre.</p></section><section class="summary-panel"><span class="eyebrow">Répartition du registre filtré</span><h3>Charge par responsable</h3>${[...new Set(items.map((o) => o.owner))].map((name) => { const n = items.filter((o) => o.owner === name).length; return `<div class="summary-bar" data-tone="${name ? 'teal' : 'amber'}"><span>${E(name || 'Non attribuée')}</span>${bar(n, items.length, name ? 'teal' : 'amber')}<b>${n}</b></div>`; }).join('')}</section></div>`;
  }
  function adaptOverview() {
    const strip = $('#overview .insight-strip'), wrapper = $('#overview .timeline-overview-details');
    if (!strip) return;
    if (state.view === 'timeline' && !series() && !wrapper) {
      const box = document.createElement('details'); box.className = 'timeline-overview-details';
      box.innerHTML = `<summary>${icon('chart')}Échéances et ${state.page === 'actions' ? 'clôture des actions' : 'résultats des occurrences'}<b>Afficher la synthèse</b></summary>`;
      strip.replaceWith(box); box.append(strip);
    } else if ((state.view !== 'timeline' || series()) && wrapper) wrapper.replaceWith(strip);
  }
  function renderRegistry() {
    const items = filtered();
    $('#main').dataset.activeView = series() ? 'series' : state.view;
    adaptOverview();
    $('#register-title').textContent = series() ? 'Les séries récurrentes' : state.view === 'timeline' ? (state.page === 'actions' ? 'La Timeline des actions' : 'La Timeline des occurrences') : (state.page === 'actions' ? 'Les actions à conduire' : 'Les occurrences à suivre');
    $('#result-count').textContent = `${items.length} ${series() ? 'séries' : state.page === 'recurrences' ? 'occurrences' : 'actions'}`;
    $('#footer-count').textContent = `${items.length} élément${items.length > 1 ? 's' : ''} affiché${items.length > 1 ? 's' : ''} sur ${base().length}`;
    $('#registry').innerHTML = (state.create ? draft() : '') + (!items.length ? `<div class="empty">${icon('search')}Aucun élément ne correspond à ces filtres.</div>` : (series() || state.view === 'list' ? rows(items) : state.view === 'kanban' ? kanban(items) : state.view === 'calendar' ? calendar(items) : state.view === 'timeline' ? timeline(items) : state.view === 'gantt' ? gantt(items) : dashboard(items)));
    window.STUDIO_TIMELINE.layout();
  }
  function renderViews() { $('#views').hidden = series(); $('#views').innerHTML = views.map(([id, label, glyph]) => `<button data-view="${id}" aria-pressed="${state.view === id}">${icon(glyph)}${label}${id === 'timeline' ? '<small class="default-badge" aria-hidden="true">Par défaut</small>' : ''}</button>`).join(''); }
  function renderPage() {
    const recurring = state.page === 'recurrences';
    document.querySelectorAll('[data-page]').forEach((el) => { if (el.dataset.page === state.page) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
    $('#title').textContent = recurring ? 'Tâches récurrentes' : 'Plan d’actions';
    $('#subtitle').textContent = recurring ? 'Gardez le rythme. Suivez les échéances, validez chaque occurrence.' : 'De la décision à la clôture. Vos priorités, vos responsables, vos échéances.';
    $('#create').innerHTML = icon('plus') + `<span>${recurring ? 'Créer une série' : 'Ajouter une action'}</span>`;
    $('#register-eyebrow').textContent = recurring ? 'Registre récurrent / Séries & réalisations' : 'Registre opérationnel / Plans d’actions';
    $('#register-title').textContent = recurring ? (series() ? 'Les séries récurrentes' : 'Les occurrences à suivre') : 'Les actions à conduire';
    $('#subviews').innerHTML = recurring ? `<button data-sub="occurrences" aria-pressed="${state.sub === 'occurrences'}">Occurrences <b>${data.occurrences.length}</b></button><button data-sub="series" aria-pressed="${state.sub === 'series'}">Séries <b>${data.series.length}</b></button>` : '';
    overview(); filters(); quickFilters(); renderViews(); renderRegistry();
  }
  function read(id) { if (state.view !== 'timeline') state.view = 'list'; state.expanded = id; renderViews(); renderRegistry(); requestAnimationFrame(() => { const row = document.querySelector(`[data-mark="${id}"]`)?.closest('.frise-row') || document.querySelector(`[data-id="${id}"]`) || document.querySelector(`#detail-${id}`); row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); (row?.querySelector(`[data-mark="${id}"]`) || row?.querySelector('[data-expand],button'))?.focus({ preventScroll: true }); }); }
  function editor(id, validation) {
    const o = base().find((p) => p.id === id); if (!o) return;
    const host = $('#editor-' + id);
    host.innerHTML = `<form class="inline-editor" data-form="${validation ? 'validation' : 'edit'}" data-id="${id}">${validation ? `<label>Résultat de l’occurrence<select name="validation"><option>OK</option><option>KO</option><option>NA</option></select></label><label>Compte rendu<input name="note" placeholder="Compte rendu de réalisation"></label>` : `<label>Intitulé<input name="name" value="${E(o.name)}" required></label><label>Responsable<select name="owner"><option value="">Non attribuée</option>${[...new Set(base().map((p) => p.owner).filter(Boolean))].map((name) => `<option ${name === o.owner ? 'selected' : ''}>${E(name)}</option>`).join('')}</select></label>${series() ? `<label>État de la série<select name="active"><option value="1" ${o.active ? 'selected' : ''}>Active</option><option value="0" ${!o.active ? 'selected' : ''}>En pause</option></select></label>` : `<label>État<select name="status">${Object.entries(statuses).map(([value, [label]]) => `<option value="${value}" ${value === o.status ? 'selected' : ''}>${label}</option>`).join('')}</select></label><label>Échéance<input type="date" name="due" value="${o.due}"></label>`}`}<div class="form-actions"><button class="button primary small" type="submit">Enregistrer dans la maquette</button><button class="button quiet small" type="button" data-cancel="${id}">Annuler</button></div></form><p class="prototype-hint">Interaction illustrative, uniquement en mémoire. Les formulaires complets existants seront conservés à l’intégration.</p>`;
    host.querySelector('select,input').focus();
  }
  function draft() { return `<section class="new-draft"><span class="eyebrow">Création illustrative</span><h3>${state.page === 'recurrences' ? 'Nouvelle série récurrente' : 'Nouvelle action'}</h3><form class="inline-editor" data-form="create"><label>Intitulé<input name="name" required placeholder="Intitulé de ${state.page === 'recurrences' ? 'la série' : 'l’action'}"></label><div class="form-actions"><button class="button primary small" type="submit">Préparer la fiche</button><button class="button quiet small" type="button" data-cancel-create>Annuler</button></div></form><p class="prototype-hint">La création complète, les permissions et l’affectation à un registre sont conservées dans l’application ; cette proposition porte sur la présentation.</p></section>`; }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('button,[data-read]'); if (!button) return;
    if (button.dataset.zoom || button.dataset.period) { window.STUDIO_TIMELINE.navigate(button.dataset.zoom ? 'zoom' : 'period', button.dataset.zoom || button.dataset.period); renderRegistry(); document.querySelector(button.dataset.zoom ? `[data-zoom="${button.dataset.zoom}"]` : `[data-period="${button.dataset.period}"]`)?.focus({preventScroll:true}); }
    else if (button.dataset.friseRead || button.dataset.detachedRead) { const id = button.dataset.friseRead || button.dataset.detachedRead; if (state.expanded === id) { state.expanded = null; renderRegistry(); document.querySelector(`[data-mark="${id}"]`)?.focus({preventScroll:true}); } else read(id); }
    else if (button.dataset.page) { state.page = button.dataset.page; state.quick = 'all'; state.expanded = null; state.view = 'timeline'; state.create = false; $('#filters').reset(); renderPage(); const url = new URL(location.href); url.searchParams.set('page', state.page); history.replaceState(null, '', url); $('.sidebar').classList.remove('open'); }
    else if (button.dataset.sub) { state.sub = button.dataset.sub; state.quick = 'all'; state.expanded = null; state.create = false; renderPage(); }
    else if (button.dataset.view) { state.view = button.dataset.view; state.expanded = null; renderViews(); renderRegistry(); document.querySelector(`[data-view="${state.view}"]`)?.focus({preventScroll:true}); }
    else if (button.dataset.quick) { state.quick = button.dataset.quick; quickFilters(); renderRegistry(); }
    else if (button.dataset.expand) { const id = button.dataset.expand; state.expanded = state.expanded === id ? null : id; renderRegistry(); (document.querySelector(`[data-id="${id}"] .expand`) || document.querySelector(`[data-mark="${id}"]`))?.focus({ preventScroll: true }); }
    else if (button.dataset.read) read(button.dataset.read);
    else if (button.dataset.edit) editor(button.dataset.edit, false);
    else if (button.dataset.validate) editor(button.dataset.validate, true);
    else if (button.dataset.history) { const id = button.dataset.history, host = $('#editor-' + id); host.innerHTML = '<p class="prototype-hint">L’historique réel et ses dates restent accessibles par le parcours existant. Aucun événement fictif n’a été ajouté pour cette proposition.</p>'; }
    else if (button.dataset.cancel) { $('#editor-' + button.dataset.cancel).innerHTML = ''; document.querySelector(`[data-id="${button.dataset.cancel}"] [data-edit]`)?.focus(); }
    else if (button.hasAttribute('data-cancel-create')) { state.create = false; renderRegistry(); $('#create').focus(); }
  });
  $('#filters').addEventListener('submit', (e) => e.preventDefault());
  $('#filters').addEventListener('reset', () => { state.quick = 'all'; requestAnimationFrame(() => { quickFilters(); renderRegistry(); }); });
  $('#search').addEventListener('input', renderRegistry);
  ['#plan', '#owner', '#status', '#closed'].forEach((id) => $(id).addEventListener('change', renderRegistry));
  $('#theme').addEventListener('click', () => updateTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
  $('#motion').addEventListener('click', () => updateMotion(document.documentElement.dataset.motion !== 'on'));
  $('#menu').addEventListener('click', () => { const open = $('.sidebar').classList.toggle('open'); $('#menu').setAttribute('aria-expanded', String(open)); });
  $('#create').addEventListener('click', () => { state.create = true; state.view = 'list'; renderViews(); renderRegistry(); $('.new-draft input').focus(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('.sidebar').classList.remove('open'); state.expanded = null; state.create = false; renderRegistry(); } if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('g[data-read]')) { e.preventDefault(); read(e.target.dataset.read); } });
  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-form]'); if (!form) return; e.preventDefault(); const values = Object.fromEntries(new FormData(form));
    if (form.dataset.form === 'create') { notice('La fiche « ' + values.name + ' » sera préparée par le formulaire existant. Aucune donnée applicative créée.'); state.create = false; renderRegistry(); $('#create').focus(); return; }
    const id = form.dataset.id;
    if (form.dataset.form === 'validation') { const o = data.occurrences.find((p) => p.id === id); o.validation = values.validation; o.status = 'done'; o.note = values.note; }
    else { const target = state.page === 'actions' ? data.actions.find((p) => p.id === id) : series() ? data.series.find((p) => p.id === id) : data.occurrences.find((p) => p.id === id); target.name = values.name; target.owner = values.owner; if (series()) target.active = values.active === '1'; else { target.status = values.status; target.due = values.due || null; } }
    overview(); quickFilters(); renderRegistry(); (document.querySelector(`[data-id="${id}"] .expand`) || document.querySelector(`[data-mark="${id}"]`))?.focus({ preventScroll: true }); notice('Modification de démonstration appliquée en mémoire.');
  });
  decorate();
  updateTheme(params.get('theme') === 'dark' ? 'dark' : 'light');
  updateMotion(!matchMedia('(prefers-reduced-motion: reduce)').matches);
  renderPage();
  window.STUDIO_DEMO = { state, renderPage, data };
})();
