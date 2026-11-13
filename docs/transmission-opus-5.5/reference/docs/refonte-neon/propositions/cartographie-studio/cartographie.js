/* global window, document, matchMedia, innerWidth, innerHeight, ResizeObserver, requestAnimationFrame */
/* Maquette de consultation uniquement : objets/relations figés, aucune API ni écriture. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s),
    data = structuredClone(window.CARTOGRAPHIE_STUDIO),
    byRef = new Map(data.objects.map((o) => [o.ref, o]));
  const state = { view: 'context', paused: matchMedia('(prefers-reduced-motion: reduce)').matches, full: false };
  let popup = null,
    returnTo = null,
    selected = null;
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
  const paths = {
    context: '<circle cx="12" cy="12" r="4"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M5 19l3-3m8-8 3-3"/>',
    process:
      '<rect x="3" y="4" width="7" height="6" rx="1"/><rect x="14" y="14" width="7" height="6" rx="1"/><path d="M10 7h7v7M3 17h6m-3-3 3 3-3 3"/>',
    search: '<circle cx="10" cy="10" r="7"/><path d="m15 15 6 6"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    pause: '<path d="M8 4v16M16 4v16"/>',
    play: '<path d="m7 4 14 8-14 8z"/>',
    expand: '<path d="M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6"/>',
    open: '<path d="M6 18 18 6M6 6h12v12"/>',
    people:
      '<circle cx="9" cy="8" r="4"/><path d="M2 22v-3a7 7 0 0 1 14 0v3m0-18a4 4 0 0 1 0 8m4 10v-3a7 7 0 0 0-3-6"/>',
    issue: '<path d="m12 3 10 18H2zM12 9v5m0 3v1"/>',
    box: '<path d="m12 2 10 6v10l-10 5-10-5V8zM2 8l10 5 10-5M12 13v10M7 5l10 5"/>',
    si: '<rect x="3" y="3" width="18" height="13" rx="2"/><path d="M12 16v5M7 21h10M7 8h10m-10 4h6"/>',
    hub: '<rect x="8" y="2" width="8" height="5" rx="1"/><path d="M12 7v5M4 17v-5h16v5"/><circle cx="4" cy="20" r="2.5"/><circle cx="12" cy="20" r="2.5"/><circle cx="20" cy="20" r="2.5"/>',
  };
  const icon = (n) =>
    `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[n] || paths.process}</svg>`;
  const labels = {
    isms: 'SMSI',
    scope: 'Périmètre SMSI',
    process: 'Processus',
    subprocess: 'Sous-processus',
    stakeholder: 'Partie intéressée',
    external_issue: 'Enjeu externe',
    internal_issue: 'Enjeu interne',
    supplier: 'Fournisseur',
    application: 'Application / service',
    site: 'Site',
    infrastructure: 'Infrastructure',
  };
  const relations = {
    part_of: 'Fait partie de',
    contains: 'Contient',
    interacts_with: 'Interagit avec',
    supports: 'Soutient',
    depends_on: 'Dépend de',
    impacts: 'A un impact sur',
  };
  const fieldLabels = {
    nature: 'Nature',
    category: 'Catégorie',
    needs: 'Attentes',
    requirements: 'Exigences',
    addressed: 'Prise en compte',
    reviewed: 'Dernière revue',
    sso: 'SSO',
    mfa: 'MFA',
    certs: 'Certifications déclarées',
    supplier: 'Fournisseur déclaré',
    statement: 'Périmètre',
    validatedOn: 'Date de validation',
    validatedBy: 'Validation par',
    cloud: 'Hébergement',
    status: 'État',
    dscp: 'Données de santé',
  };
  const txt = (v) =>
    Array.isArray(v) ? v.filter((x) => typeof x === 'string').join('\n') : typeof v === 'string' ? v : '';
  function matches(o) {
    const q = flat($('#query').value.trim()),
      ref = $('#reference').value,
      nature = $('#nature').value;
    return (
      (!q || flat([o.name, o.code, o.owner, o.sub].join(' ')).includes(q)) &&
      (!ref || o.std?.includes(ref)) &&
      (!nature ||
        (nature === 'issue'
          ? o.type.endsWith('_issue')
          : nature === 'si'
            ? ['application', 'site', 'infrastructure'].includes(o.type)
            : nature === 'process'
              ? ['process', 'subprocess'].includes(o.type)
              : o.type === nature))
    );
  }
  function row(o) {
    const scope = ['process', 'subprocess'].includes(o.type)
      ? o.scope === 'in'
        ? 'Dans le périmètre'
        : o.scope === 'out'
          ? 'Hors périmètre'
          : 'Périmètre non défini'
      : '';
    const sub = [o.code || labels[o.type], o.owner || scope].filter(Boolean).join(' · ');
    return `<button type="button" class="mc-object" data-ref="${E(o.ref)}" data-sub="${o.type === 'subprocess'}"><span><strong>${E(o.name)}</strong><small>${E(sub)}</small></span>${icon('open')}</button>`;
  }
  function group(key, title, sub, tone, symbol, items, categories = false) {
    const visible = items.filter(matches);
    const body = categories
      ? [
          ['Interne', visible.filter((o) => o.type === 'internal_issue' || o.ext === false)],
          ['Externe', visible.filter((o) => o.type === 'external_issue' || o.ext === true)],
        ]
          .map(
            ([l, items]) =>
              `<div class="mc-category"><span>${l}</span><span>${items.length}</span></div>${items.map(row).join('')}`,
          )
          .join('')
      : visible.map(row).join('');
    return `<section class="mc-panel" data-group="${key}" data-tone="${tone}" aria-label="${title}"><header class="mc-panel-head"><span class="mc-seal">${icon(symbol)}</span><div><h2>${title}</h2><small>${sub}</small></div><span class="mc-count">${visible.length}</span></header><div class="mc-objects" tabindex="0" aria-label="Objets : ${title}">${visible.length ? body : '<p class="mc-empty">Aucun objet pour ces critères.</p>'}</div></section>`;
  }
  const ofType = (...types) => data.objects.filter((o) => types.includes(o.type));
  function render() {
    const map = $('#map'),
      processes = ofType('process', 'subprocess');
    $('#summary').innerHTML = [
      ['objets', data.objects.length],
      ['relations dérivées', data.relations.length],
      ['processus', processes.length],
    ]
      .map(([label, n]) => `<span><b>${n}</b>${label}</span>`)
      .join('');
    document
      .querySelectorAll('[data-view]')
      .forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
    $('#view-label').textContent = state.view === 'context' ? 'Vue contexte' : 'Vue processus';
    map.className = 'mc-map' + (state.view === 'process' ? ' mc-process-map' : '');
    if (state.view === 'context') {
      const scope = byRef.get('scope');
      map.innerHTML = `<svg class="mc-wires" aria-hidden="true"></svg><div class="mc-stack">${group('stakeholders', 'Parties intéressées', 'Interagissent avec le périmètre', 'cyan', 'people', ofType('stakeholder'), true)}${group('issues', 'Enjeux', 'Ont un impact sur le périmètre', 'amber', 'issue', ofType('external_issue', 'internal_issue'), true)}</div><div class="mc-center"><div class="mc-hub"><div class="mc-ring" data-anchor="isms"><button type="button" class="mc-hub-button" data-ref="isms" aria-label="Consulter le SMSI">${icon('hub')}<strong>SMSI</strong><small>Organisation fictive</small></button></div></div><button type="button" class="mc-scope" data-anchor="scope" data-ref="scope"><span class="rr-kicker">Le cadre de la carte</span><h2>Périmètre SMSI</h2><p>${E(scope.sub)}</p><span class="mc-scope-foot"><span>Consulter le périmètre</span>${icon('open')}</span></button>${group(
        'processes',
        'Processus du périmètre',
        'Les autres sont dans la vue processus',
        'blue',
        'process',
        processes.filter((o) => o.scope === 'in'),
      )}</div><div class="mc-stack">${group('si', 'Applications & SI', 'Font partie du SMSI', 'blue', 'si', ofType('application', 'site', 'infrastructure'))}${group('suppliers', 'Fournisseurs', 'Soutiennent le périmètre', 'green', 'box', ofType('supplier'))}</div>`;
    } else {
      map.innerHTML =
        [
          ['Management', 'Pilotage', 'blue'],
          ['Réalisation', 'Réalisation', 'cyan'],
          ['Support', 'Support', 'green'],
        ]
          .map(([family, title, tone]) =>
            group(
              'family-' + family,
              title,
              'Processus et sous-processus',
              tone,
              'process',
              processes.filter((o) => o.family === family),
            ),
          )
          .join('') +
        `<div class="mc-process-caption"><span><strong>Rattachements conservés</strong><br>Les sous-processus restent identifiés par leur code.</span><span>Aucun flux de fonctionnement n’est déduit des familles.<br>Les propositions de flux restent à valider dans l’éditeur.</span></div>`;
    }
    const count = map.querySelectorAll('[data-ref]').length;
    $('#result').textContent = count + ' objets affichés · Données de recette fictives';
    $('#map-legend').textContent =
      state.view === 'context'
        ? 'Traits : relations dérivées regroupées par famille'
        : 'Familles de processus · Aucun flux inventé';
    const criteria = [
      $('#query').value.trim() && `Recherche : ${$('#query').value.trim()}`,
      $('#reference').value,
      $('#nature').selectedIndex ? $('#nature').selectedOptions[0].textContent : '',
    ].filter(Boolean);
    $('#criteria').hidden = !criteria.length;
    $('#criteria-text').textContent = criteria.join(' · ');
    requestAnimationFrame(wires);
  }
  function wires() {
    const svg = $('.mc-wires');
    if (!svg) return;
    const root = $('#map').getBoundingClientRect();
    svg.setAttribute('width', String(root.width));
    svg.setAttribute('height', String(root.height));
    const box = (el) => {
      const b = el.getBoundingClientRect();
      return { x: b.left - root.left, y: b.top - root.top, w: b.width, h: b.height };
    };
    const scope = box($('[data-anchor=scope]')),
      isms = box($('[data-anchor=isms]'));
    const descriptors = [
      ['stakeholders', 'scope', 'left', 'interacts_with'],
      ['issues', 'scope', 'left', 'impacts'],
      ['si', 'isms', 'right', 'part_of'],
      ['suppliers', 'scope', 'right', 'supports'],
    ];
    svg.innerHTML = descriptors
      .map(([key, target, side, type], i) => {
        const section = $(`[data-group="${key}"]`);
        const objects = [...section.querySelectorAll('[data-ref]')].map((b) => b.dataset.ref);
        const edges = data.relations.filter((r) => r.t === target && r.type === type && objects.includes(r.s));
        if (!edges.length) return '';
        const a = box(section),
          b = target === 'scope' ? scope : isms;
        const left = side === 'left';
        const sx = left ? a.x + a.w : a.x,
          sy = a.y + Math.min(a.h / 2, 140),
          tx = left ? b.x : b.x + b.w,
          ty = b.y + b.h / 2 + (key === 'issues' ? 15 : key === 'stakeholders' ? -15 : 0),
          mx = left ? sx + (tx - sx) * 0.5 : sx - (sx - tx) * 0.5;
        const d = `M${sx} ${sy}H${mx}V${ty}H${tx}`;
        return `<path class="mc-wire" data-group-wire="${key}" data-count="${edges.length}" d="${d}"/><circle class="mc-wire-end" cx="${sx}" cy="${sy}" r="3"/><circle class="mc-wire-end" cx="${tx}" cy="${ty}" r="3"/>${i < 2 ? `<path class="mc-flow" d="${d}"/>` : ''}`;
      })
      .join('');
  }
  function open(ref, trigger) {
    const o = byRef.get(ref);
    if (!o) return;
    if (trigger) returnTo = trigger;
    selected = ref;
    closePopup();
    const detail = o.details || {},
      r = data.relations.filter((x) => x.s === ref || x.t === ref);
    const fields = [
      ['Référence', o.ref],
      ['Nature', labels[o.type]],
      ['Responsable', o.owner || 'Non renseigné'],
      ['Famille', o.family],
      ['Périmètre', o.scope ? { in: 'Dans le périmètre', out: 'Hors périmètre', unk: 'Non défini' }[o.scope] : ''],
      ...Object.entries(detail)
        .filter(([k, v]) => fieldLabels[k] && txt(v))
        .map(([k, v]) => [fieldLabels[k], txt(v)]),
    ];
    $('#detail-content').innerHTML =
      `<header class="rr-detail-head"><div><span class="rr-kicker">${E(labels[o.type])}</span><h2 id="detail-title">${E(o.name)}</h2><p>${E(o.sub || o.code || o.ref)}</p></div><button class="rr-tool" type="button" data-close-dialog aria-label="Fermer la fiche">×</button></header><div class="mc-dialog-body"><section><h3>Informations de l’objet</h3><dl>${fields
        .filter(([, v]) => v)
        .map(([l, v]) => `<div><dt>${E(l)}</dt><dd>${E(v)}</dd></div>`)
        .join(
          '',
        )}</dl></section><section><h3>${r.length} relation${r.length > 1 ? 's' : ''} dérivée${r.length > 1 ? 's' : ''}</h3><div class="mc-relations">${
        r
          .map((x) => {
            const src = byRef.get(x.s),
              dest = byRef.get(x.t),
              other = x.s === ref ? x.t : x.s;
            return `<button type="button" data-related="${E(other)}"><span>${E(src.name)} → ${E(dest.name)}</span><small>${E(relations[x.type] || x.type)}${x.sec ? ' · Secondaire' : ''}</small></button>`;
          })
          .join('') || '<p class="mc-empty">Aucune relation dérivée dans ce jeu.</p>'
      }</div></section></div><footer class="rr-detail-footer"><span>Consultation · Jeu fictif · Aucune écriture</span><div>${r.length && o.ref !== 'scope' ? '<button class="button" type="button" data-related="scope">Voir le périmètre</button>' : ''}<button class="button" type="button" data-close-dialog>Fermer</button></div></footer>`;
    if (!$('#detail').open) $('#detail').showModal();
    $('#detail').querySelector('button').focus();
  }
  function closeDialog() {
    $('#detail').close();
    selected = null;
    if (returnTo?.isConnected) returnTo.focus({ preventScroll: true });
    else $('#search-toggle').focus({ preventScroll: true });
  }
  function positionPopup() {
    if (!popup) return;
    const b = $('#' + (popup.id === 'search-box' ? 'search-toggle' : 'filter-toggle')).getBoundingClientRect();
    popup.style.left = Math.max(12, Math.min(innerWidth - popup.offsetWidth - 12, b.right - popup.offsetWidth)) + 'px';
    popup.style.top = Math.max(12, Math.min(innerHeight - popup.offsetHeight - 12, b.bottom + 8)) + 'px';
  }
  function closePopup(focus = false) {
    if (!popup) return;
    const trigger = $('#' + (popup.id === 'search-box' ? 'search-toggle' : 'filter-toggle'));
    popup.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    popup = null;
    if (focus) trigger.focus({ preventScroll: true });
  }
  function togglePopup(id) {
    if (popup?.id === id) return closePopup(true);
    closePopup();
    popup = $('#' + id);
    popup.hidden = false;
    $('#' + (id === 'search-box' ? 'search-toggle' : 'filter-toggle')).setAttribute('aria-expanded', 'true');
    positionPopup();
    popup.querySelector('input,select,button').focus();
  }
  function motion() {
    document.documentElement.dataset.motion = state.paused ? 'off' : 'on';
    $('#motion-toggle').innerHTML = icon(state.paused ? 'play' : 'pause');
    $('#motion-toggle').setAttribute('aria-label', state.paused ? 'Reprendre les animations' : 'Pause animations');
    $('#motion-toggle').title = state.paused ? 'Reprendre les animations' : 'Pause animations';
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.ref) open(b.dataset.ref, b);
    else if (b.dataset.related) open(b.dataset.related);
    else if (b.hasAttribute('data-close-dialog')) closeDialog();
    else if (b.hasAttribute('data-close-popup')) closePopup(true);
    else if (b.dataset.view) {
      state.view = b.dataset.view;
      render();
    }
  });
  $('#search-toggle').onclick = () => togglePopup('search-box');
  $('#filter-toggle').onclick = () => togglePopup('filter-box');
  $('#query').addEventListener('input', render);
  ['reference', 'nature'].forEach((id) => $('#' + id).addEventListener('change', render));
  $('#reset').onclick = () => {
    ['query', 'reference', 'nature'].forEach((id) => ($('#' + id).value = ''));
    render();
    $('#filter-toggle').focus({ preventScroll: true });
  };
  $('#theme').onclick = () => {
    const dark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('#theme').textContent = dark ? 'Mode clair' : 'Mode sombre';
  };
  $('#motion-toggle').onclick = () => {
    state.paused = !state.paused;
    motion();
  };
  $('#focus-toggle').onclick = () => {
    state.full = !state.full;
    document.body.classList.toggle('mc-full', state.full);
    $('#focus-toggle').setAttribute('aria-pressed', String(state.full));
    $('#focus-toggle').setAttribute('aria-label', state.full ? 'Réduire la carte' : 'Agrandir la carte');
    $('#focus-toggle').title = state.full ? 'Réduire la carte' : 'Agrandir la carte';
    requestAnimationFrame(wires);
  };
  $('#detail').addEventListener('cancel', (e) => {
    e.preventDefault();
    closeDialog();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && popup) {
      e.preventDefault();
      closePopup(true);
    } else if (e.key === 'Escape' && state.full && !selected) $('#focus-toggle').click();
    else if (e.key === '/' && !e.target.closest('input,select,textarea') && !$('#detail').open) {
      e.preventDefault();
      if (popup?.id !== 'search-box') togglePopup('search-box');
      $('#query').focus();
    }
  });
  document.addEventListener('pointerdown', (e) => {
    if (popup && !popup.contains(e.target) && !e.target.closest('#search-toggle,#filter-toggle')) closePopup();
  });
  window.addEventListener('resize', positionPopup);
  new ResizeObserver(wires).observe($('#map'));
  document.fonts.ready.then(wires);
  document.querySelectorAll('[data-icon]').forEach((el) => (el.innerHTML = icon(el.dataset.icon)));
  const params = new URLSearchParams(window.location.search);
  if (params.get('theme') === 'light') document.documentElement.dataset.theme = 'light';
  if (params.get('view') === 'process') state.view = 'process';
  $('#theme').textContent = document.documentElement.dataset.theme === 'dark' ? 'Mode clair' : 'Mode sombre';
  render();
  motion();
  window.CARTOGRAPHIE_APERCU = { snapshot: () => structuredClone(data), render, wires };
})();
