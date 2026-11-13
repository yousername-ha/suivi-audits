/* global window, document */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const escape = (v) =>
    String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const families = [
    {
      id: 'organisation',
      name: 'Organisation',
      items: [
        ['contexte', 'Contexte de l’organisation'],
        ['perimetres', 'Périmètres'],
        ['processus', 'Processus'],
        ['responsabilites', 'Rôles et responsabilités'],
        ['cartographie', 'Cartographie du SMSI'],
        ['fournisseurs', 'Fournisseurs'],
        ['revues-acces', 'Revues des accès'],
        ['plans', 'Plans annuels'],
      ],
    },
    {
      id: 'pilotage',
      name: 'Pilotage',
      items: [
        ['synthese', 'Synthèse'],
        ['parcours', 'Parcours guidé'],
        ['objectifs', 'Objectifs et indicateurs'],
        ['revues', 'Revues de direction'],
        ['rappels', 'Rappels et configuration'],
      ],
    },
    { id: 'risques', name: 'Risques', items: [['risques', 'Gestion des risques']] },
    {
      id: 'conformite',
      name: 'Conformité et audits',
      items: [
        ['bibliotheque', 'Bibliothèque de référentiels'],
        ['dda', 'Applicabilité et mesures'],
        ['audits', 'Gestion de l’audit'],
        ['preuves', 'Preuves et contrôles'],
      ],
    },
    {
      id: 'actions',
      name: 'Actions',
      items: [
        ['amelioration', 'Amélioration continue'],
        ['actions', 'Plan d’actions'],
        ['recurrences', 'Tâches récurrentes'],
        ['registres', 'Registres et droits'],
      ],
    },
    {
      id: 'resilience',
      name: 'Résilience',
      items: [
        ['continuite', 'Continuité d’activité'],
        ['incidents', 'Incidents et crise'],
      ],
    },
    {
      id: 'documents',
      name: 'Documents',
      items: [
        ['documents', 'Documents et liens'],
        ['echanges', 'Imports et exports'],
      ],
    },
  ];
  const traces = {
    dashboard:
      '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    organisation: '<path d="M9 2h6v5H9ZM2 17h6v5H2Zm14 0h6v5h-6ZM12 7v5M5 17v-5h14v5"/>',
    pilotage: '<path d="M3 18 8 11l4 3 8-10M15 4h5v5M3 21h18"/>',
    risques: '<path d="m12 3 10 18H2ZM12 9v5m0 3h.01"/>',
    conformite: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Zm-4 9 3 3 5-6"/>',
    actions: '<path d="m3 5 2 2 3-4m3 3h10M3 13l2 2 3-4m3 3h10M3 21l2 2 3-4m3 3h10"/>',
    resilience: '<path d="M20 8a9 9 0 1 0 1 7M20 3v5h-5M12 7v5l3 2"/>',
    documents: '<path d="M6 3h8l4 4v14H6ZM14 3v5h4M9 12h6m-6 4h6"/>',
  };
  const icon = (name) =>
    `<svg class="mh-icon" viewBox="0 0 24 24" fill="none" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${traces[name] ?? traces.dashboard}</svg>`;
  let page = 'bibliotheque',
    opened = 'conformite';
  const infos = () => {
    const family = families.find((f) => f.items.some((i) => i[0] === page));
    return {
      family,
      title:
        family?.items.find((i) => i[0] === page)?.[1] ??
        (page === 'dashboard' ? 'Tableau de bord' : page === 'parametres' ? 'Configuration système' : 'Mon compte'),
    };
  };
  function menu() {
    const { family } = infos();
    $('mh-menu').innerHTML =
      `<button type="button" class="mh-family" data-mh-page="dashboard" aria-current="${page === 'dashboard'}">${icon('dashboard')}<strong>Tableau de bord</strong></button>` +
      families
        .map(
          (f) =>
            `<button type="button" class="mh-family" data-mh-family="${f.id}" aria-expanded="${opened === f.id}" aria-current="${family?.id === f.id}">${icon(f.id)}<strong>${f.name}</strong><small>${f.items.length}</small><b aria-hidden="true">${opened === f.id ? '⌄' : '›'}</b></button><div class="mh-destinations" data-mh-group="${f.id}" ${opened === f.id ? '' : 'hidden'}>${f.items.map(([id, label]) => `<button type="button" class="mh-destination" data-mh-page="${id}" ${page === id ? 'aria-current="page"' : ''}>${label}</button>`).join('')}</div>`,
        )
        .join('');
    document.querySelectorAll('.mh-comptes [data-mh-page]').forEach((b) => {
      if (b.dataset.mhPage === page) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
  }
  function row(name, target, value, state, tone = 'green') {
    return `<div class="mh-sample-row"><strong>${name}</strong><span class="mh-cell" data-tone="${page === 'dda' ? 'green' : 'target'}">${target}</span><span class="mh-cell" data-tone="${tone}">${value}</span><span class="mh-cell" data-tone="${tone}">${state}</span></div>`;
  }
  function content() {
    const { family, title } = infos();
    const label = title;
    $('mh-library').hidden = page !== 'bibliotheque';
    $('mh-other').hidden = page === 'bibliotheque';
    if (page === 'bibliotheque') return;
    let body;
    let mode = 'Vue d’ensemble';
    if (page === 'objectifs') {
      mode = 'Vue compacte';
      body =
        '<div class="mh-sample-head"><span>Objectif</span><span>Cible à atteindre</span><span>Valeur mesurée</span><span>État</span></div>' +
        row('Former les collaborateurs à la sécurité', '95 %', '97 %', 'Atteint') +
        row('Réaliser les revues d’accès', '100 %', '78 %', '⚠ Non atteint', 'red') +
        row('Vérifier les sauvegardes', '100 %', '100 %', 'Atteint');
    } else if (page === 'dda') {
      mode = 'Mesures · Lignes';
      body =
        '<div class="mh-sample-head"><span>Mesure du référentiel</span><span>Applicable</span><span>Mise en œuvre</span><span>Évaluation</span></div>' +
        row('Exemple de mesure de démonstration 1', 'Oui', 'Total', 'Renseignée') +
        row('Exemple de mesure de démonstration 2', 'Oui', 'Partiel', 'À compléter', 'amber') +
        row('Exemple de mesure de démonstration 3', 'Oui', 'Total', 'Renseignée');
    } else if (['actions', 'recurrences'].includes(page)) {
      mode = 'Timeline · Vue par défaut';
      body =
        '<svg class="mh-timeline" viewBox="0 0 1000 280" role="img" aria-label="Exemple fictif de Timeline"><g><text x="270" y="26">Novembre</text><text x="510" y="26">Décembre</text><text x="750" y="26">Janvier</text><line x1="250" y1="40" x2="250" y2="270"/><line x1="490" y1="40" x2="490" y2="270"/><line x1="730" y1="40" x2="730" y2="270"/><text x="12" y="86">Revue des accès</text><text x="12" y="156">Contrôle des sauvegardes</text><text x="12" y="226">Révision des procédures</text><rect x="290" y="65" width="230" height="22" rx="8"/><rect data-tone="green" x="420" y="135" width="180" height="22" rx="8"/><rect data-tone="blue" x="560" y="205" width="270" height="22" rx="8"/></g></svg>';
    } else if (page === 'cartographie') {
      mode = 'Cartographie conservée';
      body =
        '<p class="mh-note">Le canevas et la génération automatique restent ceux de la cartographie existante. Seul le menu extérieur appartient à cette proposition.</p>';
    } else {
      body =
        '<div class="mh-overview"><article><small>Éléments suivis</small><strong>12</strong></article><article><small>Points à traiter</small><strong>3</strong></article><article><small>Revue à venir</small><strong>1</strong></article></div><div class="mh-simple-list"><div>Exemple de suivi de démonstration <span>À consulter</span></div><div>Exemple de fiche rattachée <span>À jour</span></div><div>Exemple de point à préciser <span>En cours</span></div></div>';
    }
    $('mh-other').innerHTML =
      `<div class="breadcrumb">${escape(family?.name ?? 'Plateforme')} <span>/</span>${escape(title)}</div><header class="page-heading"><div><h1>${escape(label)}</h1><p>Cadre de navigation commun · ${escape(title)}</p></div></header><section class="mh-content-panel"><div class="mh-content-toolbar"><strong>${escape(label)}</strong><span>${mode}</span></div><div class="mh-sample-content">${body}<p class="mh-note">Contenu illustratif pour comparer le même menu sur différentes pages. Cette proposition porte uniquement sur le menu latéral ; les écrans métier conservent leurs fonctions et leurs vues.</p></div></section>`;
  }
  function select(id) {
    page = id;
    opened = infos().family?.id ?? opened;
    document.body.dataset.mhPage = page;
    menu();
    content();
    document.querySelector(`[data-mh-page="${page}"]`)?.focus();
  }
  document.addEventListener('click', (e) => {
    const family = e.target.closest('[data-mh-family]');
    if (family) {
      opened = opened === family.dataset.mhFamily ? null : family.dataset.mhFamily;
      menu();
      document.querySelector(`[data-mh-family="${family.dataset.mhFamily}"]`)?.focus();
      return;
    }
    const nav = e.target.closest('[data-mh-page]');
    if (nav && nav !== document.body) {
      select(nav.dataset.mhPage);
      return;
    }
  });
  window.MENU_COMMUN_APERCU = { select, snapshot: () => ({ page, opened }) };
  menu();
})();
