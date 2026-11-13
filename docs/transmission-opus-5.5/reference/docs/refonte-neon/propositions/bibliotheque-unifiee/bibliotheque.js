/* global window, document */
(() => {
  'use strict';
  const data = structuredClone(window.BIBLIOTHEQUE_UNIFIEE_DONNEES);
  const $ = (id) => document.getElementById(id);
  const escape = (value) =>
    String(value ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
    );
  const states = [
    ['non_implemente', 'Sans mise en œuvre'],
    ['partiel', 'Partielles'],
    ['implemente', 'Mises en œuvre'],
    ['teste', 'Testées'],
    ['valide_metier', 'Validées métier'],
    ['non_applicable', 'Non applicables'],
  ];
  const paths = {
    library: 'M3 3h4v18H3Zm7 0h4v18h-4Zm7 2 3-1 4 16-3 1Z',
    plus: 'M12 5v14M5 12h14',
    search: 'm16 16 5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    chart: 'M4 20h17M7 16V8m5 8V3m5 13v-6',
    book: 'M5 3h13a1 1 0 0 1 1 1v17H6a3 3 0 0 1 0-6h13M5 3v12M8 7h7m-7 4h5',
    link: 'm9 15 6-6M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1',
    warning: 'm12 3 10 18H2ZM12 9v5m0 3h.01',
    close: 'm6 6 12 12M6 18 18 6',
    code: 'm8 5-6 7 6 7m8-14 6 7-6 7m-3-17-2 20',
    file: 'M6 3h8l4 4v14H6Zm8 0v5h4M9 12h6M9 16h6',
    more: 'M4 12h.01M12 12h.01M20 12h.01',
    arrow: 'M5 12h14m-5-5 5 5-5 5',
  };
  const icon = (name) =>
    `<svg class="bb-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.file}"/></svg>`;
  let lastFocus = null;
  const state = { scope: 'socle', query: '' };
  const coverage = (f) => (state.scope ? data.couverture.frameworks.find((c) => c.frameworkId === f.id) : undefined);
  const normalize = (text) =>
    text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
  function bar(c) {
    const total = states.reduce((n, [key]) => n + (c.etats[key] ?? 0), 0);
    let x = 0;
    return `<svg class="bb-bar" viewBox="0 0 1000 10" preserveAspectRatio="none" role="img" aria-label="Répartition des ${c.requirements} exigences selon leur état d’évaluation">${states
      .map(([key]) => {
        const value = c.etats[key] ?? 0;
        const width = total ? (value / total) * 1000 : 0;
        const rect = width
          ? `<rect data-state="${key}" x="${x}" y="0" width="${Math.max(width - 2, 0)}" height="10" rx="2"/>`
          : '';
        x += width;
        return rect;
      })
      .join('')}</svg>`;
  }
  function record(f, index) {
    const c = coverage(f);
    return `<article class="bb-record" tabindex="0" aria-label="Afficher ${escape(f.name)}" data-tone="${index % 2 ? 'teal' : 'blue'}" data-framework="${escape(f.id)}"><header class="bb-record-head"><span class="bb-book" aria-hidden="true">${icon('book')}</span><div class="bb-record-name"><h2>${escape(f.name)}</h2><p><span class="bb-version">Fiche v${f.version}</span><span>${f.locked ? 'Source verrouillée' : 'Copie de l’organisation'}</span><span>·</span><span>${f.source.status === 'unverified' ? 'Source à vérifier' : 'Source de l’organisation'}</span></p></div><div class="bb-catalogue-stats"><div><strong>${f.requirements}</strong><small>exigences au catalogue</small></div><div><strong>${f.scopes}</strong><small>périmètre${f.scopes > 1 ? 's' : ''} rattaché${f.scopes > 1 ? 's' : ''}</small></div></div><div class="bb-record-actions"><button type="button" class="bb-small" data-bb-action="catalogue" data-id="${escape(f.id)}" aria-label="Consulter les exigences de ${escape(f.name)}">${icon('file')}Exigences</button><button type="button" class="bb-icon-button" data-bb-action="actions" data-id="${escape(f.id)}" aria-label="Autres actions pour ${escape(f.name)}">${icon('more')}</button></div></header><div class="bb-record-body">${c ? `<div class="bb-coverage-heading"><strong>État des exigences dans le périmètre</strong><span>Version active v${c.version} · ${c.etats.applicables} applicables ou à déterminer</span></div>${bar(c)}<div class="bb-states">${states.map(([key, label]) => `<div class="bb-state" data-state="${key}"><strong>${c.etats[key]}</strong><small>${label}</small></div>`).join('')}</div><div class="bb-coverage-bottom"><div class="bb-links">${icon('link')}<span>${c.covered} avec mesure reliée</span><span>·</span><span>${c.uncovered} sans mesure</span>${c.toValidate ? `<span>·</span><span>${c.toValidate} rapprochement(s) non compté(s)</span>` : ''}</div><button type="button" class="bb-small" data-bb-action="coverage" data-id="${escape(f.id)}">Voir la couverture${icon('arrow')}</button></div>${c.etats.obligatoiresNonConformes ? `<div class="bb-warning">${icon('warning')}${c.etats.obligatoiresNonConformes} clauses obligatoires pas encore conformes</div>` : ''}` : `<div class="bb-catalogue-only">${state.scope ? 'Ce référentiel n’est pas rattaché et actif dans le périmètre choisi.' : 'Choisissez un périmètre pour afficher l’état de ses exigences.'}</div>`}</div></article>`;
  }
  function render() {
    const filtered = data.catalogue.filter((f) =>
      normalize(f.name + ' ' + f.identifier).includes(normalize(state.query)),
    );
    $('records').innerHTML = filtered.length
      ? filtered.map(record).join('')
      : '<p class="bb-catalogue-only">Aucun référentiel ne correspond à cette recherche.</p>';
    $('bb-total').textContent = `${data.catalogue.length} référentiels`;
    $('result').textContent =
      `${filtered.length} référentiel${filtered.length > 1 ? 's' : ''} affiché${filtered.length > 1 ? 's' : ''} sur ${data.catalogue.length}`;
    $('criteria').hidden = !state.query;
    $('criteria-label').textContent = `Recherche : ${state.query}`;
  }
  function close() {
    $('detail').close();
    if (lastFocus?.isConnected) lastFocus.focus();
    else $('search-toggle').focus();
  }
  function show(kind, id) {
    const f = data.catalogue.find((f) => f.id === id);
    const c = f ? coverage(f) : undefined;
    lastFocus = document.activeElement;
    let body, title, kicker;
    if (kind === 'coverage' && c) {
      title = f.name;
      kicker = 'Couverture · Pilotage de l’organisation';
      body = `<div class="bb-detail-grid">${states.map(([key, label]) => `<article class="bb-state" data-state="${key}"><div><strong>${c.etats[key]}</strong><small>${label}</small></div></article>`).join('')}</div><dl><div><dt>Applicables ou à déterminer</dt><dd>${c.etats.applicables}</dd></div><div><dt>Applicabilité à déterminer</dt><dd>${c.etats.aDeterminer}</dd></div><div><dt>Rapprochements non comptés</dt><dd>${c.toValidate}</dd></div></dl>${c.etats.obligatoiresNonConformes ? `<div class="bb-warning">${icon('warning')}${c.etats.obligatoiresNonConformes} clauses obligatoires pas encore conformes</div>` : ''}<p class="bb-dialog-note">Une exigence évaluée et une mesure reliée sont deux informations distinctes. Les rapprochements non décidés ne sont pas comptés. Ces états ne constituent pas un taux de conformité.</p>`;
    } else if (kind === 'catalogue' && f) {
      title = f.name;
      kicker = 'Catalogue de l’organisation';
      body = `<dl><div><dt>Version de fiche</dt><dd>v${f.version}</dd></div><div><dt>Exigences enregistrées</dt><dd>${f.requirements}</dd></div><div><dt>Périmètres rattachés</dt><dd>${f.scopes}</dd></div></dl><div class="bb-detail-grid"><article><small>Origine déclarée</small><p>${escape(f.source.organisation)}</p></article><article><small>Statut de source</small><p>À vérifier</p></article><article><small>Personnalisation</small><p>${f.locked ? 'Source verrouillée' : 'Copie de l’organisation'}</p></article></div><p class="bb-dialog-note">La version de fiche du catalogue et la version active dans un périmètre restent distinctes. Ce visuel présente les métadonnées du jeu de recette, sans reproduire de texte normatif.</p>`;
    } else if (kind === 'actions' && f) {
      title = f.name;
      kicker = 'Commandes du catalogue';
      body =
        '<p class="bb-dialog-note">Commandes existantes conservées dans la bibliothèque, selon vos droits :</p><div class="bb-actions-list"><button type="button" class="bb-small" data-bb-demo>Créer une copie personnalisable</button>' +
        (f.locked ? '' : '<button type="button" class="bb-small" data-bb-demo>Ajouter une exigence</button>') +
        '<button type="button" class="bb-small" data-bb-demo>Importer une nouvelle édition</button></div><p class="bb-dialog-note" id="demo-message">Aucune écriture n’est effectuée dans cette maquette.</p>';
    } else if (kind === 'import') {
      title = 'Importer un référentiel';
      kicker = 'Commande conservée';
      body =
        '<p class="bb-dialog-note">L’import, la simulation et la confirmation restent accessibles depuis cette bibliothèque réunie. Cet aperçu ne réalise aucun import.</p>';
    } else {
      return;
    }
    $('detail-content').innerHTML =
      `<header><div><span class="bb-kicker">${escape(kicker)}</span><h2 id="detail-title">${escape(title)}</h2></div><button type="button" class="bb-icon-button" data-bb-close aria-label="Fermer le détail">${icon('close')}</button></header>${body}`;
    $('detail').showModal();
    $('detail').querySelector('[data-bb-close]').focus();
  }
  document.querySelectorAll('[data-bb-icon]').forEach((el) => {
    el.outerHTML = icon(el.dataset.bbIcon);
  });
  $('scope').addEventListener('change', () => {
    state.scope = $('scope').value;
    render();
  });
  $('theme').addEventListener('click', () => {
    const light = document.documentElement.dataset.theme === 'light';
    document.documentElement.dataset.theme = light ? 'dark' : 'light';
    $('theme').textContent = light ? 'Mode clair' : 'Mode sombre';
  });
  $('search-toggle').addEventListener('click', () => {
    const shown = $('search-box').hidden;
    $('search-box').hidden = !shown;
    $('search-toggle').setAttribute('aria-expanded', String(shown));
    if (shown) $('query').focus();
  });
  $('query').addEventListener('input', () => {
    state.query = $('query').value;
    render();
  });
  $('query').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      $('search-box').hidden = true;
      $('search-toggle').setAttribute('aria-expanded', 'false');
      $('search-toggle').focus();
    }
  });
  $('clear-query').addEventListener('click', () => {
    state.query = '';
    $('query').value = '';
    render();
    $('search-toggle').focus();
  });
  $('importer').addEventListener('click', () => show('import'));
  $('records').addEventListener('click', (e) => {
    const b = e.target.closest('[data-bb-action]');
    if (b) {
      show(b.dataset.bbAction, b.dataset.id);
      return;
    }
    const card = e.target.closest('.bb-record');
    if (card && !window.getSelection()?.toString()) {
      card.focus();
      const f = data.catalogue.find((f) => f.id === card.dataset.framework);
      show(coverage(f) ? 'coverage' : 'catalogue', f.id);
    }
  });
  $('records').addEventListener('keydown', (e) => {
    const card = e.target.closest('.bb-record');
    if (card && e.target === card && ['Enter', ' '].includes(e.key)) {
      e.preventDefault();
      const f = data.catalogue.find((f) => f.id === card.dataset.framework);
      show(coverage(f) ? 'coverage' : 'catalogue', f.id);
    }
  });
  $('detail').addEventListener('click', (e) => {
    if (e.target.closest('[data-bb-close]')) close();
    if (e.target.closest('[data-bb-demo]'))
      $('demo-message').textContent = 'Commande illustrative : aucune donnée modifiée.';
  });
  $('detail').addEventListener('cancel', (e) => {
    e.preventDefault();
    close();
  });
  window.BIBLIOTHEQUE_UNIFIEE_APERCU = {
    snapshot: () => structuredClone(data),
    setData: (next) => {
      Object.assign(data, structuredClone(next));
      render();
    },
  };
  render();
})();
