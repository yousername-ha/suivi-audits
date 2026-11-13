/* global document, window, matchMedia, innerWidth, innerHeight, ResizeObserver, requestAnimationFrame, location */
/* Maquette autonome : mêmes fiches fictives, aucun appel à l'API. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const all = structuredClone(window.DEMO_ORGANISATION.parties);
  const date = window.DEMO_ORGANISATION.date;
  const cutoff = new Date(new Date(date + 'T00:00:00Z').getTime() - 365 * 864e5).toISOString().slice(0, 10);
  const state = { mode: 'panorama', selected: null, paused: matchMedia('(prefers-reduced-motion: reduce)').matches };
  const paths = {
    dashboard:
      '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
    tree: '<rect x="8" y="2" width="8" height="5" rx="1"/><path d="M12 7v5M4 17v-5h16v5"/><rect x="1" y="17" width="6" height="5" rx="1"/><rect x="9" y="17" width="6" height="5" rx="1"/><rect x="17" y="17" width="6" height="5" rx="1"/>',
    chart: '<path d="M3 3v18h18M6 15l5-5 4 3 6-7"/>',
    shield: '<path d="m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6z"/><path d="m8 12 3 3 5-6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    list: '<path d="M7 6h14M7 12h14M7 18h14M3 6h.01M3 12h.01M3 18h.01"/>',
    restore: '<path d="M3 11a9 9 0 1 1 3 8M3 4v7h7M12 7v5l3 2"/>',
    document: '<path d="M6 2h8l4 4v16H6zM14 2v5h4M9 11h6M9 15h6"/>',
    network:
      '<circle cx="12" cy="12" r="3"/><circle cx="4" cy="4" r="2"/><circle cx="20" cy="4" r="2"/><circle cx="4" cy="20" r="2"/><circle cx="20" cy="20" r="2"/><path d="m6 6 4 4m4 4 4 4m0-12-4 4m-4 4-4 4"/>',
    people: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M17 4a3 3 0 0 1 0 6m1 4a6 6 0 0 1 3 5v2"/>',
    building: '<path d="M4 22V3h14v19M2 22h20M8 7h2m4 0h1M8 11h2m4 0h1M8 15h2m4 0h1M10 22v-3h3v3"/>',
    globe: '<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6h14M5 18h14"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>',
    search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 11h18M7 15h3m4 0h3"/>',
    warning: '<path d="m12 3 10 18H2zM12 9v5m0 3h.01"/>',
    pause: '<path d="M8 4v16M16 4v16"/>',
    play: '<path d="m7 4 14 8-14 8z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    message: '<path d="M3 3h18v14H8l-5 4zM7 7h10M7 11h7"/>',
    edit: '<path d="m15 3 6 6-12 12H3v-6zM13 5l6 6"/>',
  };
  const icon = (n) =>
    `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[n] || paths.people}</svg>`;
  const E = (v) =>
    String(v ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const flat = (v) =>
    String(v ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr');
  const fmt = (v) =>
    v ? new Date(v.slice(0, 10) + 'T00:00:00Z').toLocaleDateString('fr-FR', { timeZone: 'UTC' }) : 'Non renseignée';
  const tone = (p) =>
    p.addressed === 'Oui' ? 'teal' : p.addressed === 'Partiel' ? 'amber' : p.addressed === 'Non' ? 'red' : 'muted';
  const label = (p) =>
    p.addressed === 'Oui'
      ? 'Traitées'
      : p.addressed === 'Partiel'
        ? 'Partiellement'
        : p.addressed === 'Non'
          ? 'Non traitées'
          : 'Non renseigné';
  const reviewCheck = (p) => !p.reviewed || p.reviewed.slice(0, 10) < cutoff;
  const badge = (p) =>
    `<span class="pi-treatment" data-tone="${tone(p)}">${icon(p.addressed === 'Oui' ? 'check' : p.addressed === 'Non' ? 'close' : p.addressed === 'Partiel' ? 'restore' : 'message')}${label(p)}</span>`;
  const filterIds = ['nature', 'addressed', 'review', 'category', 'owner'];
  let opened = null,
    lastTrigger = null,
    noticeTimer;
  function hydrate() {
    document.querySelectorAll('[data-icon]').forEach((e) => (e.outerHTML = icon(e.dataset.icon)));
  }
  function notice(message) {
    $('#notice').textContent = message;
    $('#notice').hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => ($('#notice').hidden = true), 3500);
  }
  function popupTrigger(p) {
    return p.id === 'pi-search'
      ? $('#search-trigger')
      : p.id === 'pi-filters'
        ? $('#filter-trigger')
        : $('#options-trigger');
  }
  function positionPopup() {
    if (!opened) return;
    const r = popupTrigger(opened).getBoundingClientRect();
    opened.style.left =
      Math.max(12, Math.min(innerWidth - opened.offsetWidth - 12, r.right - opened.offsetWidth)) + 'px';
    opened.style.top = Math.max(12, Math.min(innerHeight - opened.offsetHeight - 12, r.bottom + 8)) + 'px';
  }
  function closePopup(restore = false) {
    if (!opened) return;
    const t = popupTrigger(opened);
    opened.hidden = true;
    t.setAttribute('aria-expanded', 'false');
    opened = null;
    if (restore) t.focus({ preventScroll: true });
  }
  function togglePopup(id) {
    const p = $('#' + id);
    if (opened === p) return closePopup(true);
    closePopup();
    opened = p;
    p.hidden = false;
    popupTrigger(p).setAttribute('aria-expanded', 'true');
    positionPopup();
    p.querySelector('input,select,button')?.focus({ preventScroll: true });
  }
  function filters() {
    return Object.fromEntries(filterIds.map((id) => [id, $('#pi-' + id).value]));
  }
  function filtered() {
    const f = filters(),
      q = flat($('#pi-query').value);
    return all.filter(
      (p) =>
        flat([p.name, p.id, p.type, p.cat, p.needs, p.req, p.how, p.owner, p.contact].join(' ')).includes(q) &&
        (!f.nature || (f.nature === 'unknown' ? !['Interne', 'Externe'].includes(p.type) : p.type === f.nature)) &&
        (!f.addressed || (f.addressed === 'unknown' ? !p.addressed : p.addressed === f.addressed)) &&
        (!f.category || p.cat === f.category) &&
        (!f.owner || p.owner === f.owner) &&
        (!f.review || (f.review === 'check' ? reviewCheck(p) : f.review === 'missing' ? !p.reviewed : !reviewCheck(p))),
    );
  }
  function card(p) {
    return `<button type="button" class="pi-card" data-read="${E(p.id)}" data-tone="${tone(p)}"><span class="pi-card-top"><span class="pi-glyph">${icon(p.type === 'Interne' ? 'building' : 'globe')}</span><span class="pi-card-code">${E(p.id)}</span><span class="pi-card-type">${E(p.type || 'Nature à préciser')}</span></span><strong>${E(p.name)}</strong><span class="pi-card-category">${E(p.cat || 'Catégorie non renseignée')}</span><span class="pi-card-expectation">${E(p.needs || 'Besoins et attentes non renseignés')}</span><span class="pi-card-bottom">${badge(p)}<span class="pi-review ${reviewCheck(p) ? 'check' : ''}" title="Dernière revue : ${E(fmt(p.reviewed))}${reviewCheck(p) ? ' — date absente ou de plus d’un an' : ''}">${icon(reviewCheck(p) ? 'warning' : 'calendar')}${p.reviewed ? E(fmt(p.reviewed)) : 'À renseigner'}</span></span></button>`;
  }
  function cluster(parties, nature) {
    return `<section class="pi-cluster ${nature === 'Externe' ? 'external' : 'internal'}" data-group="${nature}"><header>${icon(nature === 'Externe' ? 'globe' : 'building')}<h2>${nature === 'Externe' ? 'Acteurs externes' : 'Acteurs internes'}</h2><span>${parties.length}</span></header><div class="pi-group-cards">${parties.map(card).join('')}</div></section>`;
  }
  function panorama(items) {
    const internal = items.filter((p) => p.type === 'Interne'),
      external = items.filter((p) => p.type === 'Externe'),
      unknown = items.filter((p) => !['Interne', 'Externe'].includes(p.type));
    return `<div class="pi-panorama" data-groups="${internal.length && external.length ? 'both' : external.length ? 'external' : internal.length ? 'internal' : 'unknown'}"><svg class="pi-wires" aria-hidden="true"></svg>${internal.length ? cluster(internal, 'Interne') : ''}<div class="pi-hub"><span class="pi-hub-circle">${icon('tree')}<span>${items.length}</span></span><div class="pi-hub-caption"><span class="pi-hub-label">Périmètre</span><strong>${E(window.DEMO_ORGANISATION.scope)}</strong><small>Acteurs de la vue</small></div></div>${external.length ? cluster(external, 'Externe') : ''}${unknown.length ? `<section class="pi-unknown"><h2>Nature à préciser</h2><div class="pi-group-cards">${unknown.map(card).join('')}</div></section>` : ''}</div>`;
  }
  function rows(items) {
    return `<div class="pi-list-header" aria-hidden="true"><span>Partie intéressée</span><span>Besoins et attentes</span><span>Responsable</span><span>Exigences</span><span>Dernière revue</span><span></span></div>${items.map((p) => `<button type="button" class="pi-row" data-read="${E(p.id)}" data-tone="${tone(p)}"><span class="pi-row-title"><strong>${E(p.name)}</strong><span>${E(p.id)} · ${E(p.type || 'Nature à préciser')} · ${E(p.cat || 'Catégorie non renseignée')}</span></span><span class="pi-row-expectation">${E(p.needs || 'Non renseignés')}</span><span class="pi-row-owner">${E(p.owner || 'Non attribué')}</span>${badge(p)}<span class="pi-review ${reviewCheck(p) ? 'check' : ''}">${icon(reviewCheck(p) ? 'warning' : 'calendar')}${E(fmt(p.reviewed))}${reviewCheck(p) ? '<small>À vérifier</small>' : ''}</span><span class="pi-open-arrow" aria-hidden="true">↗</span></button>`).join('')}`;
  }
  let wireCanvas = null;
  const wireObserver = new ResizeObserver(() => requestAnimationFrame(wires));
  function wires() {
    const canvas = $('.pi-panorama'),
      hub = $('.pi-hub-circle');
    if (!canvas || !hub) {
      wireObserver.disconnect();
      wireCanvas = null;
      return;
    }
    if (wireCanvas !== canvas) {
      wireObserver.disconnect();
      wireCanvas = canvas;
      [canvas, hub, ...canvas.querySelectorAll('.pi-cluster,.pi-card')].forEach((e) => wireObserver.observe(e));
    }
    const cr = canvas.getBoundingClientRect(),
      hr = hub.getBoundingClientRect();
    const cx = hr.left - cr.left + hr.width / 2,
      cy = hr.top - cr.top + hr.height / 2;
    const fragments = [],
      routes = [],
      hubPorts = [];
    const n = (value) => Number(value.toFixed(2));
    function line(side, role, points, target = '') {
      if (points.every((p) => Math.abs(p[0] - points[0][0]) < 0.01 && Math.abs(p[1] - points[0][1]) < 0.01)) return;
      const d = points.map(([x, y], i) => `${i ? 'L' : 'M'}${n(x)} ${n(y)}`).join(' ');
      fragments.push(
        `<path data-side="${side}" data-role="${role}"${target ? ` data-target="${E(target)}"` : ''} d="${d}"/>`,
      );
      routes.push({ side, role, target, points: points.map(([x, y]) => [n(x), n(y)]) });
    }
    function point(side, role, x, y, r = 1.8) {
      fragments.push(`<circle data-side="${side}" data-role="${role}" cx="${n(x)}" cy="${n(y)}" r="${r}"/>`);
    }
    for (const cluster of canvas.querySelectorAll('.pi-cluster')) {
      const side = cluster.classList.contains('external') ? 'external' : 'internal';
      const cards = [...cluster.querySelectorAll('.pi-card')].map((el) => {
        const b = el.getBoundingClientRect();
        return {
          id: el.dataset.read,
          left: b.left - cr.left,
          right: b.right - cr.left,
          top: b.top - cr.top,
          bottom: b.bottom - cr.top,
          cy: b.top - cr.top + b.height / 2,
        };
      });
      if (!cards.length) continue;
      const left = side === 'internal',
        px = cx + (left ? -1 : 1) * (hr.width / 2 + 8);
      hubPorts.push({ side, x: n(px), y: n(cy) });
      point(side, 'hub-port', px, cy, 2.5);
      if (left) {
        const rail = (Math.max(...cards.map((c) => c.right)) + px) / 2;
        line(side, 'outlet', [
          [px, cy],
          [rail, cy],
        ]);
        line(side, 'trunk', [
          [rail, Math.min(cy, ...cards.map((c) => c.cy))],
          [rail, Math.max(cy, ...cards.map((c) => c.cy))],
        ]);
        for (const c of cards) {
          line(
            side,
            'branch',
            [
              [rail, c.cy],
              [c.right, c.cy],
            ],
            c.id,
          );
          point(side, 'junction', rail, c.cy);
          point(side, 'card-port', c.right, c.cy, 2.1);
        }
        continue;
      }
      const columns = [];
      for (const card of cards.sort((a, b) => a.left - b.left || a.top - b.top)) {
        let column = columns.find((col) => Math.abs(col.left - card.left) < 1);
        if (!column) {
          column = { left: card.left, cards: [] };
          columns.push(column);
        }
        column.cards.push(card);
      }
      const firstRail = (px + columns[0].left) / 2;
      const rails = columns.map((col, i) =>
        i === 0 ? firstRail : (Math.max(...columns[i - 1].cards.map((c) => c.right)) + col.left) / 2,
      );
      const rows = [];
      for (const card of [...cards].sort((a, b) => a.top - b.top)) {
        let row = rows.find((r) => Math.abs(r.top - card.top) < 1);
        if (!row) {
          row = { top: card.top, bottom: card.bottom };
          rows.push(row);
        }
        row.bottom = Math.max(row.bottom, card.bottom);
      }
      // Le passage vers la seconde colonne reste dans une gouttière libre.
      const channel = rows.length > 1 ? (rows[0].bottom + rows[1].top) / 2 : rows[0].top - 11;
      line(side, 'outlet', [
        [px, cy],
        [firstRail, cy],
      ]);
      if (columns.length > 1) {
        line(side, 'feed', [
          [firstRail, channel],
          [rails.at(-1), channel],
        ]);
        point(side, 'junction', firstRail, channel);
      }
      columns.forEach((col, i) => {
        const ys = [...col.cards.map((c) => c.cy), ...(i === 0 ? [cy] : []), ...(columns.length > 1 ? [channel] : [])];
        line(side, 'trunk', [
          [rails[i], Math.min(...ys)],
          [rails[i], Math.max(...ys)],
        ]);
        if (i > 0) point(side, 'junction', rails[i], channel);
        for (const c of col.cards) {
          line(
            side,
            'branch',
            [
              [rails[i], c.cy],
              [c.left, c.cy],
            ],
            c.id,
          );
          point(side, 'junction', rails[i], c.cy);
          point(side, 'card-port', c.left, c.cy, 2.1);
        }
      });
    }
    const svg = $('.pi-wires');
    svg.setAttribute('viewBox', `0 0 ${cr.width} ${cr.height}`);
    svg.innerHTML = fragments.join('');
    window.PARTIES_LIAISONS = { hubPorts, routes, branches: routes.filter((r) => r.role === 'branch').length };
  }
  document.fonts.ready.then(() => requestAnimationFrame(wires));
  document.fonts.addEventListener?.('loadingdone', () => requestAnimationFrame(wires));

  function syncFilters(items) {
    const fs = filters(),
      active = [];
    if ($('#pi-query').value) active.push(['query', 'Recherche : ' + $('#pi-query').value]);
    for (const [id, val] of Object.entries(fs))
      if (val) active.push([id, $('#pi-' + id).selectedOptions[0].textContent]);
    $('#pi-active-filters').hidden = !active.length;
    $('#pi-active-filters').innerHTML =
      active
        .map(
          ([id, text]) =>
            `<button type="button" class="active-filter" data-remove="${id}"><span>${E(text)}</span>${icon('close')}<span class="sr-only">Retirer ce filtre</span></button>`,
        )
        .join('') +
      (active.length ? '<button type="button" class="clear-filters" data-reset>Tout effacer</button>' : '');
    $('#pi-filter-count').hidden = !active.length;
    $('#pi-filter-count').textContent = active.length;
    $('#filter-trigger').setAttribute('aria-label', active.length ? `Filtres, ${active.length} actifs` : 'Filtres');
    $('#filter-trigger').classList.toggle('is-active', !!active.length);
    $('#search-trigger').classList.toggle('is-active', !!$('#pi-query').value);
    $('#pi-filter-results').textContent = `${items.length} acteur${items.length > 1 ? 's' : ''}`;
  }
  function render() {
    const items = filtered();
    $('#pi-content').innerHTML = items.length
      ? state.mode === 'panorama'
        ? panorama(items)
        : rows(items)
      : '<div class="pi-empty"><h2>Aucune partie dans cette vue</h2><p>Adaptez les critères pour retrouver les acteurs du périmètre.</p><button class="button" data-reset>Réinitialiser les filtres</button></div>';
    $('#pi-result').textContent =
      `${items.length} partie${items.length > 1 ? 's' : ''} affichée${items.length > 1 ? 's' : ''} sur ${all.length}`;
    $('#pi-summary').innerHTML =
      `<span><b>${all.length}</b> acteurs</span><span><i class="pi-dot teal"></i><b>${all.filter((p) => p.addressed === 'Oui').length}</b> traités</span><span title="Exigences partiellement ou non traitées"><i class="pi-dot amber"></i><b>${all.filter((p) => ['Partiel', 'Non'].includes(p.addressed)).length}</b> partiel / non</span><span title="Date de revue absente ou de plus de 365 jours"><i class="pi-dot red"></i><b>${all.filter(reviewCheck).length}</b> revues à vérifier</span>`;
    document
      .querySelectorAll('[data-mode]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)));
    $('#pi-view-label').textContent = state.mode === 'panorama' ? 'Panorama' : 'Liste compacte';
    syncFilters(items);
    requestAnimationFrame(wires);
  }
  function reset() {
    filterIds.forEach((id) => ($('#pi-' + id).value = ''));
    $('#pi-query').value = '';
    render();
  }
  function setInert(value) {
    $('#shell').inert = value;
    $('.sidebar').inert = value;
  }
  function openModal(content, trigger) {
    closePopup();
    if (trigger) lastTrigger = trigger;
    $('#pi-modal').innerHTML = content;
    $('#pi-veil').hidden = false;
    setInert(true);
    $('#pi-modal').focus({ preventScroll: true });
  }
  function closeModal() {
    const id = state.selected;
    $('#pi-veil').hidden = true;
    $('#pi-modal').innerHTML = '';
    setInert(false);
    state.selected = null;
    (lastTrigger?.isConnected ? lastTrigger : document.querySelector(`[data-read="${id}"]`) || $('#create')).focus({
      preventScroll: true,
    });
  }
  function detailPanel(title, glyph, text) {
    return `<section class="pi-detail-panel"><h3>${icon(glyph)}${title}</h3><p class="${text ? '' : 'empty-value'}">${E(text || 'Non renseigné')}</p></section>`;
  }
  function read(id, trigger) {
    const p = all.find((p) => p.id === id);
    if (!p) return;
    state.selected = id;
    const title = `<header class="pi-modal-header"><span class="pi-glyph">${icon(p.type === 'Interne' ? 'building' : 'globe')}</span><div class="pi-modal-title"><p class="pi-modal-code">${E(p.id)} · Partie intéressée</p><h2 id="pi-modal-title">${E(p.name)}</h2><div class="pi-modal-heading-meta"><span>${E(p.type || 'Nature à préciser')}</span><span>${E(p.cat || 'Catégorie non renseignée')}</span></div></div><button class="close-flyout" data-close-modal aria-label="Fermer la fiche">${icon('close')}</button></header>`;
    openModal(
      title +
        `<div class="pi-modal-body">${detailPanel('Besoins et attentes', 'people', p.needs)}${detailPanel('Exigences pertinentes', 'shield', p.req)}<section class="pi-detail-panel"><h3>${icon('check')}Prise en compte des exigences</h3>${badge(p)}<p class="${p.how ? '' : 'empty-value'}">${E(p.how || 'Traitement non renseigné')}</p></section><section class="pi-detail-panel review"><h3>${icon('calendar')}Revue et suivi</h3><dl><div><dt>Dernière revue</dt><dd>${E(fmt(p.reviewed))}</dd></div><div><dt>Responsable</dt><dd>${E(p.owner || 'Non attribué')}</dd></div><div><dt>Contact</dt><dd>${E(p.contact || 'Non renseigné')}</dd></div></dl></section></div><footer class="pi-modal-footer"><span>${reviewCheck(p) ? `${icon('warning')} Date absente ou revue de plus d’un an` : 'Revue renseignée dans l’année'}</span><div><button class="button" data-edit="${E(id)}">${icon('edit')}Modifier</button><button class="button primary" data-close-modal>Fermer</button></div></footer>`,
      trigger,
    );
  }
  const option = (v, label, current) =>
    `<option value="${E(v)}" ${v === current ? 'selected' : ''}>${E(label)}</option>`;
  function editor(id, trigger) {
    const p = all.find((p) => p.id === id) || {
      id: '',
      name: '',
      type: 'Externe',
      cat: '',
      needs: '',
      req: '',
      how: '',
      reviewed: '',
      addressed: '',
      contact: '',
    };
    state.selected = p.id || null;
    const input = (key, label, type = 'text', wide = false) =>
      `<label class="${wide ? 'wide' : ''}">${label}${type === 'textarea' ? `<textarea name="${key}">${E(p[key])}</textarea>` : `<input name="${key}" type="${type}" value="${E(p[key])}" ${key === 'name' ? 'required' : ''}>`}</label>`;
    const natureValues = [
      'Interne',
      'Externe',
      ...(!['Interne', 'Externe'].includes(p.type) && p.type ? [p.type] : []),
    ];
    openModal(
      `<header class="pi-modal-header"><div class="pi-modal-title"><p class="pi-modal-code">${p.id ? E(p.id) : 'Nouvelle fiche'}</p><h2 id="pi-modal-title">${p.id ? 'Modifier la partie' : 'Ajouter une partie'}</h2></div><button class="close-flyout" data-close-modal aria-label="Fermer l’édition">${icon('close')}</button></header><form class="pi-edit" id="pi-edit-form" data-id="${E(p.id)}">${input('name', 'Intitulé', 'text', true)}<label>Nature<select name="type">${option('', 'Non renseignée', p.type)}${natureValues.map((v) => option(v, v, p.type)).join('')}</select></label>${input('cat', 'Catégorie')}${input('needs', 'Besoins et attentes', 'textarea')}${input('req', 'Exigences pertinentes', 'textarea')}<label>Exigences traitées<select name="addressed">${[
        ['', 'Non renseigné'],
        ['Oui', 'Oui'],
        ['Partiel', 'Partiellement'],
        ['Non', 'Non'],
      ]
        .map(([v, l]) => option(v, l, p.addressed))
        .join(
          '',
        )}</select></label>${input('reviewed', 'Dernière revue', 'date')}${input('how', 'Traitement dans le système de management', 'textarea', true)}${input('contact', 'Contact', 'text', true)}<footer class="pi-modal-footer"><span>Maquette · Données fictives</span><div><button type="button" class="button" ${p.id ? `data-read="${E(p.id)}"` : 'data-close-modal'}>Annuler</button><button class="button primary" type="submit">Enregistrer</button></div></footer></form>`,
      trigger,
    );
  }
  function populateOptions() {
    for (const [id, key] of [
      ['category', 'cat'],
      ['owner', 'owner'],
    ]) {
      const select = $('#pi-' + id),
        value = select.value;
      select.querySelectorAll('option:not(:first-child)').forEach((e) => e.remove());
      [...new Set(all.map((p) => p[key]).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'fr'))
        .forEach((v) => select.insertAdjacentHTML('beforeend', option(v, v, value)));
    }
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.read) {
      const sel = window.getSelection();
      if (sel?.toString().trim() && b.contains(sel.anchorNode) && b.contains(sel.focusNode)) return;
      read(b.dataset.read, $('#pi-veil').hidden ? b : null);
    } else if (b.dataset.edit) editor(b.dataset.edit);
    else if (b.hasAttribute('data-close-modal')) closeModal();
    else if (b.hasAttribute('data-close-popup')) closePopup(true);
    else if (b.dataset.mode) {
      state.mode = b.dataset.mode;
      render();
    } else if (b.hasAttribute('data-reset')) reset();
    else if (b.dataset.remove) {
      if (b.dataset.remove === 'query') $('#pi-query').value = '';
      else $('#pi-' + b.dataset.remove).value = '';
      render();
    } else if (b.dataset.retained) notice(`La vue ${b.dataset.retained} déjà intégrée est conservée.`);
  });
  $('#search-trigger').onclick = () => togglePopup('pi-search');
  $('#filter-trigger').onclick = () => togglePopup('pi-filters');
  $('#options-trigger').onclick = () => togglePopup('pi-options');
  $('#create').onclick = () => editor('', $('#create'));
  $('#pi-query').addEventListener('input', render);
  $('#pi-query').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      closePopup(true);
    }
  });
  filterIds.forEach((id) => $('#pi-' + id).addEventListener('change', render));
  $('#pi-filter-form').addEventListener('submit', (e) => e.preventDefault());
  $('#pi-filter-form').addEventListener('reset', (e) => {
    e.preventDefault();
    reset();
  });
  $('#pi-more-filters').addEventListener('toggle', positionPopup);
  $('#pi-motion').onclick = () => {
    state.paused = !state.paused;
    setMotion();
  };
  function setMotion() {
    document.documentElement.dataset.motion = state.paused ? 'off' : 'on';
    $('#pi-motion').setAttribute('aria-pressed', String(state.paused));
    $('#pi-motion').innerHTML =
      icon(state.paused ? 'play' : 'pause') + `<span>${state.paused ? 'Reprendre' : 'Suspendre'} les animations</span>`;
  }
  $('#theme').onclick = () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('#theme').innerHTML = icon(dark ? 'sun' : 'moon') + `<span>Mode ${dark ? 'clair' : 'sombre'}</span>`;
  };
  $('#pi-veil').addEventListener('click', (e) => {
    if (e.target === $('#pi-veil')) closeModal();
  });
  document.addEventListener('pointerdown', (e) => {
    if (opened && !opened.contains(e.target) && !popupTrigger(opened).contains(e.target)) closePopup();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (opened) {
        e.preventDefault();
        closePopup(true);
      } else if (!$('#pi-veil').hidden) {
        e.preventDefault();
        closeModal();
      }
    } else if (e.key === '/' && $('#pi-veil').hidden && !e.target.closest('input,textarea,select')) {
      e.preventDefault();
      if (opened?.id !== 'pi-search') togglePopup('pi-search');
      $('#pi-query').focus();
    }
    if (e.key === 'Tab' && !$('#pi-veil').hidden) {
      const targets = [...$('#pi-modal').querySelectorAll('button,input,textarea,select,[tabindex="0"]')].filter(
        (el) => !el.disabled,
      );
      if (e.shiftKey && (document.activeElement === targets[0] || document.activeElement === $('#pi-modal'))) {
        e.preventDefault();
        targets.at(-1)?.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === targets.at(-1) || document.activeElement === $('#pi-modal'))
      ) {
        e.preventDefault();
        targets[0]?.focus();
      }
    }
  });
  document.addEventListener('submit', (e) => {
    if (e.target.id !== 'pi-edit-form') return;
    e.preventDefault();
    const form = e.target,
      values = Object.fromEntries(new FormData(form)),
      id = form.dataset.id,
      existing = all.find((p) => p.id === id);
    if (existing) Object.assign(existing, values);
    else
      all.push({
        id: 'PI' + (Math.max(0, ...all.map((p) => Number(p.id.replace(/\D/g, '')) || 0)) + 1),
        owner: '',
        ...values,
      });
    const savedId = existing?.id || all.at(-1).id;
    closeModal();
    populateOptions();
    render();
    (document.querySelector(`[data-read="${savedId}"]`) || $('#create')).focus({ preventScroll: true });
    notice('Modification appliquée à cette maquette.');
  });
  const tab = $('.page-tabs'),
    anchor = document.createComment('rubriques');
  tab.before(anchor);
  function placeTabs() {
    if (innerWidth >= 1100 && innerHeight <= 850) {
      $('.topbar>strong').after(tab);
      tab.classList.add('tabs-in-topbar');
    } else {
      anchor.after(tab);
      tab.classList.remove('tabs-in-topbar');
    }
  }
  window.addEventListener('resize', () => {
    placeTabs();
    wires();
    positionPopup();
  });
  new ResizeObserver(wires).observe($('#pi-content'));
  hydrate();
  if (new URLSearchParams(location.search).get('theme') === 'dark') $('#theme').click();
  populateOptions();
  placeTabs();
  setMotion();
  render();
  window.PARTIES_DEMO = { state, parties: all, render, cutoff, date };
})();
