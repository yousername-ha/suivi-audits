/* global document, window */
'use strict';

// Maquette autonome : seules des données fictives sont affichées, aucune API ni sauvegarde.
const icons = {
  dashboard: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  tree: '<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/><path d="M12 7v5M5 17v-5h14v5"/>',
  chart: '<path d="M3 18 8 11l4 3 8-10M15 4h5v5M3 21h18"/>',
  warning: '<path d="M10.3 4.6a2 2 0 0 1 3.4 0l8 13.9a2 2 0 0 1-1.7 3H4a2 2 0 0 1-1.7-3Z"/><path d="M12 9v5m0 3h.01"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
  tasks: '<path d="m3 5 2 2 3-4m3 3h10M3 13l2 2 3-4m3 3h10M3 21l2 2 3-4m3 3h10"/>',
  resilience: '<path d="M20 8a9 9 0 1 0 1 7M20 3v5h-5M12 7v5l3 2"/>',
  document: '<path d="M6 3h8l4 4v14H6ZM14 3v5h4M9 12h6m-6 4h6"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3"/>',
  measure: '<path d="M4 20h17M6 16V9m6 7V3m6 13V6"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h9M3 6h.01M3 12h.01M3 18h.01"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v5m10-5v5M3 10h18m-13 5h3"/>',
  person: '<circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  moon: '<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  play: '<path d="m8 4 12 8-12 8Z"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
};
const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.document}</svg>`;
function paintIcons(parent = document) {
  parent.querySelectorAll('[data-icon]').forEach((el) => { el.outerHTML = icon(el.dataset.icon); });
}
const objectives = [
  {id:'OBJ1',name:'Garantir la satisfaction des patients',owner:'Responsable accueil',due:'31/12/2026',processes:['PR2'],attained:1},
  {id:'OBJ2',name:'Maîtriser les accès aux systèmes',owner:'RSI',due:'31/12/2026',processes:['PR4','PR3'],attained:1},
  {id:'OBJ3',name:'Réduire les écarts d’audit',owner:'Responsable qualité',due:'30/06/2027',processes:['PR5'],attained:0},
  {id:'OBJ4',name:'Formaliser la gouvernance',owner:'Direction',due:'31/03/2027',processes:[],attained:0},
];
const indicators = [
  {id:'IND1',obj:'OBJ1',name:'Taux de satisfaction des patients',target:'≥ 85 %',value:'88 %',state:'ok',trend:'up',source:'30/06/2026',history:'2025 : 78 %',owner:'Responsable accueil',frequency:'Annuelle',threshold:'85 %',direction:'≥'},
  {id:'IND2',obj:'OBJ1',name:'Délai moyen de première réponse (jours)',target:'≤ 3',value:'5',state:'ko',trend:'up',source:'30/06/2026',owner:'Responsable accueil',frequency:'Mensuelle',threshold:'3',direction:'≤'},
  {id:'IND3',obj:'OBJ2',name:'Services SaaS avec MFA',target:'≥ 90 %',value:'75 %',state:'ko',auto:true,source:'3/4 services SaaS',threshold:'90 %',direction:'≥'},
  {id:'IND4',obj:'OBJ2',name:'Services SaaS avec SSO',target:'≥ 90 %',value:'50 %',state:'ko',auto:true,source:'2/4 services SaaS',threshold:'90 %',direction:'≥'},
  {id:'IND5',obj:'OBJ2',name:'Comptes revus dans l’année',target:'≥ 100 %',value:'100 %',state:'ok',source:'15/05/2026',threshold:'100 %',direction:'≥'},
  {id:'IND6',obj:'OBJ3',name:'Écarts majeurs ouverts',target:'≤ 0',value:'1',state:'ko',auto:true,source:'Écarts internes ouverts',threshold:'0',direction:'≤'},
  {id:'IND7',obj:'OBJ3',name:'Délai moyen de clôture des écarts (jours)',target:'≤ 60',value:'—',state:'na',source:'',threshold:'60',direction:'≤'},
  {id:'IND8',obj:'OBJ4',name:'Politiques revues dans l’année',target:'? —',value:'—',state:'undef',source:'',threshold:'',direction:''},
];
const processes = [
  {id:'PR1',name:'Direction et pilotage de l’établissement',owner:'Direction'},
  {id:'PR2',name:'Accueil et prise en charge des patients',owner:'Responsable accueil'},
  {id:'PR3',name:'Achats et prestataires',owner:'Responsable achats'},
  {id:'PR4',name:'Systèmes d’information',owner:'RSI'},
  {id:'PR5',name:'Amélioration continue',owner:'Responsable qualité'},
  {id:'PR6',name:'Gestion documentaire',owner:'Assistante de direction'},
];
const states = {ok:'Atteint',ko:'Non atteint',na:'Non mesuré',undef:'Cible à définir'};
let filter = 'all', view = 'compacte', noticeTimer, lastFocus;
const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function trend(i) {
  if (!i.trend) return '';
  return `<svg class="trend ${i.trend === 'down' ? 'down' : ''}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" role="img" aria-label="Tendance : ${i.trend === 'up' ? 'en hausse' : 'en baisse'}"><path d="${i.trend === 'up' ? 'M3 13 13 3M5 3h8v8' : 'M3 3 13 13M5 13h8V5'}"/></svg>`;
}
function metric(i, type) {
  if (type === 'target') return `<span class="mobile-label">Cible à atteindre</span><span class="metric target">${i.target}</span>`;
  if (type === 'value') return `<span class="mobile-label">Valeur mesurée</span><span class="metric" data-state="${i.state}">${i.value}${trend(i)}</span>`;
  return `<span class="mobile-label">État</span><span class="metric state" data-state="${i.state}">${i.state === 'ko' ? icon('warning') : ''}${states[i.state]}</span>`;
}
function indicatorName(i) {
  return `<button class="indicator-name" data-indicator="${i.id}" aria-label="Ouvrir l’indicateur ${i.id}"><span class="code">${i.id}</span><span class="indicator-title">${i.name}${i.auto ? '<span class="auto">auto</span>' : ''}</span></button>`;
}
function objectiveHeading(o) {
  const total = indicators.filter((i) => i.obj === o.id).length;
  return `<div class="objective-heading"><div><div class="objective-title"><span class="code">${o.id}</span><button data-objective="${o.id}" aria-label="Ouvrir l’objectif ${o.id}">${o.name}</button></div><div class="objective-meta"><span>${icon('tree')}${o.processes.join(' · ') || 'Sans processus associé'}</span><span>${icon('person')}${o.owner}</span><span>${icon('calendar')}${o.due}</span></div></div><div class="objective-progress"><b><i style="width:${o.attained / total * 100}%"></i></b><span>${o.attained} / ${total} atteints</span></div></div>`;
}
function render() {
  const visible = indicators.filter((i) => filter === 'all' || i.state === filter);
  const table = document.querySelector('.indicators-table');
  table.querySelectorAll('tbody').forEach((el) => el.remove());
  for (const o of objectives) {
    const items = visible.filter((i) => i.obj === o.id);
    if (!items.length) continue;
    const body = document.createElement('tbody');
    body.innerHTML = `<tr class="objective-head"><th colspan="5" scope="rowgroup">${objectiveHeading(o)}</th></tr>${items.map((i,n) => `<tr class="indicator-row${n === 0 ? ' first' : ''}${n === items.length - 1 ? ' last' : ''}" data-state="${i.state}" data-id="${i.id}"><td>${indicatorName(i)}</td><td>${metric(i,'target')}</td><td>${metric(i,'value')}</td><td>${metric(i,'state')}</td><td class="source">${i.source ? `<span class="mobile-label">Relevé / source :</span><span>${i.source}</span>` : ''}${i.history ? `<span class="history">${i.history}</span>` : ''}</td></tr>`).join('')}`;
    table.append(body);
  }
  document.getElementById('filter-count').textContent = `${visible.length} indicateur${visible.length > 1 ? 's' : ''}`;
  document.querySelectorAll('[data-filter]').forEach((el) => el.setAttribute('aria-pressed',String(el.dataset.filter === filter)));
  document.querySelectorAll('[data-view]').forEach((el) => el.setAttribute('aria-selected',String(el.dataset.view === view)));
  document.querySelector('.view-hint').textContent = view === 'compacte' ? 'Vue par défaut' : 'Vue alternative';
  document.getElementById('compact-view').hidden = view !== 'compacte';
  const other = document.getElementById('other-view');
  other.hidden = view === 'compacte';
  if (view === 'objectif') other.innerHTML = objectives.map((o) => {
    const items = visible.filter((i) => i.obj === o.id);
    if (!items.length) return '';
    return `<article class="objective-card"><header class="objective-head">${objectiveHeading(o)}</header><div class="indicator-list">${items.map((i) => `<div class="indicator-card">${indicatorName(i)}<div>${metric(i,'target')}</div><div>${metric(i,'value')}</div><div>${metric(i,'state')}</div></div>`).join('')}</div></article>`;
  }).join('');
  if (view === 'processus') other.innerHTML = processes.map((p) => {
    const items = objectives.filter((o) => o.processes.includes(p.id));
    return `<article class="process-card"><h3><span class="code">${p.id}</span>${p.name}</h3><p>Pilote : ${p.owner}</p>${items.length ? `<div class="process-links">${items.map((o) => `<button data-objective="${o.id}">${o.id} · ${o.name}</button>`).join('')}</div>` : '<p class="empty">Aucun objectif associé</p>'}</article>`;
  }).join('');
  if (view === 'boites') other.innerHTML = '<p class="empty-view">Cette proposition détaille les objectifs et indicateurs. Les boîtes de pilotage et leurs données existantes seront conservées lors de l’intégration.</p>';
}
function notify(title) {
  const el = document.getElementById('notice');
  clearTimeout(noticeTimer);
  el.textContent = `${title} : maquette visuelle uniquement, aucune action enregistrée.`;
  el.hidden = false;
  noticeTimer = setTimeout(() => { el.hidden = true; },4500);
}
function input(label,value='',extra='') { return `<label ${extra}>${label}<input value="${escapeHtml(value)}"></label>`; }
function area(label,value='') { return `<label class="wide">${label}<textarea>${escapeHtml(value)}</textarea></label>`; }
function openModal(type,id) {
  const modal = document.getElementById('modal');
  const i = indicators.find((row) => row.id === id), o = objectives.find((row) => row.id === (i?.obj || id));
  let content;
  if (type === 'indicator') {
    const values = id === 'IND1' ? [['15/12/2025','78 %','Année précédente'],['30/06/2026','88 %','Enquête']] : id === 'IND2' ? [['31/03/2026','4','—'],['30/06/2026','5','—']] : id === 'IND5' ? [['15/05/2026','100 %','—']] : [];
    content = `<fieldset><legend>Définition et cible</legend><div class="form-grid">${input('Indicateur',i.name,'class="wide"')}${input('Objectif',o.name)}${input('Responsable',i.owner || '')}${input('Sens',i.direction)}${input('Cible',i.threshold)}${input('Fréquence de mesure',i.frequency || '')}${input('Calcul automatique',i.auto ? i.source : '')}</div></fieldset><fieldset><legend>Surveillance et mesure</legend><div class="form-grid">${area('Ce qui est surveillé et mesuré')}${area('Méthodes de surveillance et de mesure')}${input('Quand surveiller')}${input('Quand analyser et évaluer')}${input('Catégorie',id === 'IND1' ? 'Satisfaction' : '')}${input('Source de l’information',id === 'IND1' ? 'Enquête annuelle de satisfaction (fictive)' : '')}</div></fieldset><fieldset><legend>Valeurs mesurées</legend>${values.length ? `<table class="values"><thead><tr><th>Date</th><th>Valeur</th><th>Commentaire</th></tr></thead><tbody>${values.map((v) => `<tr>${v.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>` : `<p class="source">${i.auto ? `Calcul automatique : ${i.source}.` : 'Aucune mesure enregistrée.'}</p>`}${i.auto ? '' : `<div class="form-grid" style="margin-top:14px">${input('Date de la mesure')}${input('Valeur')}${input('Commentaire')}${input('Période historique')}</div><button class="button" data-notice="Ajouter une mesure" style="margin-top:12px">${icon('plus')}Ajouter une mesure</button>`}</fieldset><fieldset><legend>Plan d’action si non atteint</legend><div class="form-grid">${area('Action')}${input('Responsable de l’action')}${input('Échéance de l’action')}${input('Dernière revue')}</div></fieldset>`;
  } else {
    content = `<fieldset><legend>Objectif et responsabilité</legend><div class="form-grid">${input('Objectif',o.name,'class="wide"')}${input('Échéance',o.due)}${input('Responsable',o.owner)}</div></fieldset><fieldset><legend>Processus et enjeux</legend><div class="form-grid">${input('Processus associés',o.processes.join(', '),'class="wide"')}${area('Enjeux associés (un par ligne)',o.id === 'OBJ1' ? 'Attentes des patients : qualité d’accueil' : o.id === 'OBJ2' ? 'Menace cyber : comptes compromis\nLégislation données de santé : exigences d’accès' : '')}</div></fieldset><fieldset><legend>Planification de l’atteinte</legend><div class="form-grid">${area('Ce qui sera fait')}${area('Ressources nécessaires')}${area('Comment les résultats seront évalués')}</div></fieldset><fieldset><legend>Indicateurs de l’objectif</legend><div class="indicator-list">${indicators.filter((row) => row.obj === o.id).map(indicatorName).join('')}</div></fieldset>`;
  }
  modal.innerHTML = `<header class="modal-head"><div><span class="eyebrow">Pilotage / Fiche ${type === 'indicator' ? 'indicateur' : 'objectif'} · ${id}</span><h2 id="modal-title">${type === 'indicator' ? i.name : o.name}</h2></div><button class="button quiet close" data-close aria-label="Fermer la fiche">${icon('close')}</button></header>${content}<footer class="modal-actions"><small>Maquette · Aucune modification sauvegardée</small><div><button class="button" data-close>Fermer</button><button class="button primary" data-notice="Enregistrer">Enregistrer</button></div></footer>`;
  lastFocus = document.activeElement;
  document.getElementById('veil').hidden = false;
  modal.focus();
}
function closeModal() {
  document.getElementById('veil').hidden = true;
  lastFocus?.focus();
}
document.addEventListener('click',(event) => {
  const el = event.target.closest('button');
  if (!el) { if (event.target.id === 'veil') closeModal(); return; }
  if (el.dataset.filter) { filter = el.dataset.filter; render(); }
  if (el.dataset.view) { view = el.dataset.view; render(); }
  if (el.id === 'theme') {
    const dark = document.documentElement.dataset.theme !== 'dark';
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    el.innerHTML = `${icon(dark ? 'sun' : 'moon')}<span>Mode ${dark ? 'clair' : 'sombre'}</span>`;
  }
  if (el.id === 'pause') {
    const paused = document.body.classList.toggle('paused');
    el.setAttribute('aria-pressed',String(paused));
    el.innerHTML = `${icon(paused ? 'play' : 'pause')}<span>${paused ? 'Activer les animations' : 'Pause animations'}</span>`;
  }
  if (el.dataset.indicator) openModal('indicator',el.dataset.indicator);
  if (el.dataset.objective) openModal('objective',el.dataset.objective);
  if (el.hasAttribute('data-close')) closeModal();
  if (el.dataset.notice) notify(el.dataset.notice);
});
document.addEventListener('keydown',(event) => {
  if (document.getElementById('veil').hidden) return;
  if (event.key === 'Escape') closeModal();
  if (event.key === 'Tab') {
    const focusable = [...document.getElementById('modal').querySelectorAll('button,input,textarea,select')];
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement.id === 'modal')) { event.preventDefault(); last.focus(); }
    if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
paintIcons();
render();
window.maquette = {objectives,indicators,processes};
