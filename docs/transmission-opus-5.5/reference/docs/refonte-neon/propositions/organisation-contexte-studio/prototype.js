/* global window, document, location, history */
/* Prototype autonome : données fictives, interactions locales, aucune API et aucune persistance métier. */
(() => {
  'use strict';
  const d = window.DEMO_ORGANISATION;
  const paths = {
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    tree: '<rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M12 8v4H5v4m7-4h7v4"/>',
    chart: '<path d="M3 3v18h18M7 16l4-5 4 2 5-8"/>',
    diamond: '<path d="m12 3 9 9-9 9-9-9Z"/>',
    shield: '<path d="m12 2 8 4v7c0 5-8 9-8 9S4 18 4 13V6Z"/><path d="m8 12 3 3 5-6"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1"/>',
    restore: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7m2-4v6l4 2"/>',
    document: '<path d="M6 2h8l4 4v16H6Zm8 0v5h4M9 11h6m-6 4h6m-6 4h4"/>',
    people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m18 0v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    check: '<path d="m5 12 4 4L20 5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    warning: '<path d="m12 3 10 18H2Z"/><path d="M12 9v5m0 3h.01"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-13 4h2m3 0h2"/>',
    search: '<circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/>',
    filters: '<path d="M3 5h18M6 12h12M9 19h6"/><circle cx="8" cy="5" r="2"/><circle cx="16" cy="12" r="2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="M5 19 19 5M5 5h14v14"/>',
    moon: '<path d="M20.5 13A9 9 0 0 1 11 3.5 9 9 0 1 0 20.5 13Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',
    edit: '<path d="m15 4 5 5-11 11-6 1 1-6Zm-1 1 5 5"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    link: '<path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1"/>',
    layers: '<path d="m12 3 10 6-10 6L2 9Zm-9 10 9 5 9-5m-18 5 9 5 9-5"/>',
    briefcase: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12c5 3 13 3 18 0m-9 0v4"/>',
  };
  const el = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = (name) => `<svg viewBox="0 0 24 24" class="icon" aria-hidden="true">${paths[name] ?? paths.document}</svg>`;
  const hydrate = () => document.querySelectorAll('[data-icon]').forEach((node) => { node.innerHTML = icon(node.dataset.icon); });
  const limit = new Date(new Date(d.date+'T00:00:00Z').getTime()-365*864e5).toISOString().slice(0,10);
  const stale = (p) => !p.reviewed || p.reviewed < limit;
  const date = (value) => value ? value.split('-').reverse().join('/') : 'Non renseignée';
  const query = new URLSearchParams(location.search);
  let view = ['parties','swot','pestel'].includes(query.get('vue')) ? query.get('vue') : 'parties';
  let theme = query.get('theme') === 'dark' ? 'dark' : 'light';
  let processId = d.processes.some(p=>p.id===query.get('processus')) ? query.get('processus') : d.swots[0].process;
  let swotId = d.swots.find(s=>s.process===processId)?.id;
  let noticeTimer, previousFocus;
  const filters = { owner:'all', origin:'all', due:'all' };
  function updateUrl() { const q=new URLSearchParams({vue:view,theme}); if(view==='swot')q.set('processus',processId); history.replaceState(null,'','?'+q); }
  function setTheme() { document.documentElement.dataset.theme=theme;el('theme').innerHTML=icon(theme==='dark'?'sun':'moon')+`<span>${theme==='dark'?'Mode clair':'Mode sombre'}</span>`; updateUrl(); }
  function notice(text) { clearTimeout(noticeTimer);el('notice').textContent=text;el('notice').hidden=false;noticeTimer=setTimeout(()=>{el('notice').hidden=true;},4200); }
  function openModal(title,body,kind='people') {
    previousFocus=document.activeElement;
    el('modal').innerHTML=`<header class="modal-heading"><span class="tile-icon teal">${icon(kind)}</span><h2 id="modal-title">${esc(title)}</h2><button class="button icon-only" data-close aria-label="Fermer">${icon('close')}</button></header><div class="modal-content">${body}</div>`;
    el('veil').hidden=false;el('modal').focus();hydrate();
  }
  function closeModal(){el('veil').hidden=true;el('modal').innerHTML='';previousFocus?.focus();}
  function stat(iconName,label,value,note,tone='',segments='') { return `<article class="stat"><div class="stat-head"><span class="tile-icon ${tone}">${icon(iconName)}</span>${label}</div><div class="stat-value ${tone}">${value}</div><p>${note}</p>${segments}</article>`; }
  function partyRows(){ return d.parties.map(p=>{
    const tone=p.addressed==='Oui'?'green':p.addressed==='Partiel'?'amber':'red';
    const status=p.addressed==='Oui'?'Traitées':p.addressed==='Partiel'?'Partiellement':'Non traitées';
    return `<article class="party-row" data-name="${esc(p.name.toLowerCase())}" data-owner="${esc(p.owner)}" data-addressed="${esc(p.addressed)}" aria-label="Partie intéressée ${esc(p.name)}">
      <div class="party-name"><span class="avatar ${p.type==='Interne'?'internal':''}">${esc(p.id)}</span><div><h3>${esc(p.name)}</h3><small>${esc(p.cat)}</small><span class="pill nature ${p.type==='Interne'?'internal':''}">${esc(p.type)}</span></div></div>
      <div class="party-expectations">${esc(p.needs)}<div class="requirement"><b>Exigence</b>${esc(p.req||'Non renseignée')}</div></div>
      <div class="party-treatment"><span class="pill ${tone}">${esc(status)}</span><p>${esc(p.how||'Traitement non renseigné')}</p></div>
      <div class="party-review">${date(p.reviewed)}${stale(p)?'<small>'+icon('clock')+'À actualiser</small>':''}</div>
      <div class="party-owner"><span>Responsable</span>${esc(p.owner)}</div>
      <button class="open-record" data-open-party="${p.id}" aria-label="Ouvrir ${esc(p.name)}">${icon('arrow')}</button>
    </article>`;
  }).join(''); }
  function renderParties(){
    const yes=d.parties.filter(p=>p.addressed==='Oui').length,partial=d.parties.filter(p=>p.addressed==='Partiel').length,no=d.parties.filter(p=>p.addressed==='Non').length;
    const internals=d.parties.filter(p=>p.type==='Interne').length;
    const segments='<div class="mini-segments" aria-hidden="true">'+d.parties.map(p=>`<i class="${p.addressed==='Oui'?'green':p.addressed==='Partiel'?'amber':'red'}"></i>`).join('')+'</div>';
    return `<section class="stats" aria-label="Synthèse des parties intéressées">
      ${stat('people','Parties intéressées',d.parties.length,`${internals} internes · ${d.parties.length-internals} externes`,'blue')}
      ${stat('check','Exigences traitées',`${yes}<small>/ ${d.parties.length}</small>`,'Prise en compte renseignée','teal',segments)}
      ${stat('warning','Partiel ou non traité',partial+no,`${partial} partiellement · ${no} non traité`,'amber')}
      ${stat('calendar','Revue à actualiser',d.parties.filter(stale).length,'Revue absente ou de plus d’un an','amber')}
    </section>
    <section class="panel" aria-label="Registre des parties intéressées"><header class="panel-heading"><div class="panel-title"><span class="tile-icon blue">${icon('people')}</span><div><h2>Registre des parties intéressées</h2><p>Les besoins, les exigences et leur prise en compte.</p></div></div><span class="counter">${d.parties.length} fiches</span></header>
    <div class="controls"><div class="search-group"><label class="search">${icon('search')}<input id="search" type="search" aria-label="Rechercher" placeholder="Rechercher une partie intéressée…"></label><button class="button" data-filters>${icon('filters')}Filtres</button></div><div class="legend"><span><i class="dot teal"></i>Traitées</span><span><i class="dot amber"></i>Partiellement</span><span><i class="dot red"></i>Non traitées</span></div></div>
    <div class="reg-head" aria-hidden="true"><span>Partie intéressée</span><span>Besoins & exigences</span><span>Prise en compte</span><span class="review-head">Dernière revue</span><span class="owner-head">Responsable</span><span></span></div>
    <div id="party-rows">${partyRows()}</div><p id="empty" hidden>Aucune partie intéressée ne correspond à la recherche.</p>
    <footer class="panel-footer"><span id="shown-count">6 parties intéressées affichées</span><span>${icon('info')}La revue et la prise en compte sont deux informations distinctes.</span></footer></section>`;
  }
  function renderSwot(){
    const p=d.processes.find(p=>p.id===processId),analyses=d.swots.filter(s=>s.process===p.id);
    const s=analyses.find(s=>s.id===swotId)||analyses[0];
    const columns=[['S','Forces','Interne · favorable'],['W','Faiblesses','Interne · défavorable'],['O','Opportunités','Externe · favorable'],['T','Menaces','Externe · défavorable']];
    const context=`<section class="panel process-context" aria-label="Processus rattaché"><header><span class="eyebrow">${icon('tree')}Processus rattaché</span><span class="counter">${analyses.length} analyse${analyses.length>1?'s':''} SWOT</span></header><div class="process-context-grid"><div class="process-identity"><span class="process-code">${esc(p.id)}</span><div><h2>${esc(p.name)}</h2><div class="process-meta"><span class="process-family">${esc(p.family)}</span><span>${icon('people')}Pilote : ${esc(p.owner)}</span></div>${p.purpose?`<p>${esc(p.purpose)}</p>`:''}</div></div><label class="process-picker" for="process-picker"><span id="process-picker-label">Changer de processus</span><select id="process-picker" aria-labelledby="process-picker-label" aria-describedby="process-picker-help">${d.processes.map(x=>`<option value="${x.id}" ${x.id===p.id?'selected':''}>${esc(x.id)} · ${esc(x.name)}</option>`).join('')}</select><small id="process-picker-help">Les analyses affichées suivent le processus choisi.</small></label></div></section>`;
    if(!s)return context+`<section class="panel swot-empty" aria-label="Analyses du processus ${esc(p.id)}"><span class="tile-icon teal">${icon('layers')}</span><h2>Aucune analyse SWOT rattachée à ${esc(p.id)}</h2><p>${esc(p.name)}</p><button class="button primary" data-create-swot>${icon('plus')}Ajouter une analyse à ce processus</button></section>`;
    return context+`<div class="process-swot-link"><span>${icon('link')}Processus <b>${esc(p.id)}</b></span><i aria-hidden="true"></i><span>Analyse <b>${esc(s.id)}</b></span></div>
    <section class="panel swot-analysis" aria-label="Analyse SWOT du processus ${esc(p.id)}"><header class="analysis-heading"><div><span class="eyebrow">Analyse du processus ${esc(p.id)}</span><h2>SWOT · ${esc(s.id)}</h2><div class="analysis-meta"><span>${icon('calendar')}${date(s.date)}</span><span>${icon('people')}${esc(s.author)}</span><span>${icon('layers')}Version ${esc(s.version)}</span></div></div><div class="analysis-toolbar"><button class="button small" data-open-swot="${esc(s.id)}">${icon('edit')}Ouvrir l’analyse</button><button class="button quiet small" data-history>Décisions et réalisations</button></div></header>
    <div class="swot-grid">${columns.map(([key,label,nature])=>`<article class="quadrant" data-quadrant="${key}" aria-label="${label}"><header><span class="quadrant-letter">${label[0]}</span><div><h3>${label}</h3><small>${nature}</small></div><span class="counter">${s[key].length}</span></header><ul>${s[key].map(x=>`<li>${esc(x.text)}</li>`).join('')}</ul><footer>${s[key].length} élément${s[key].length>1?'s':''} renseigné${s[key].length>1?'s':''}</footer></article>`).join('')}</div>
    <footer class="panel-footer"><span>${icon('tree')}Quatre angles de lecture du processus ${esc(p.id)}.</span><span>${icon('info')}Lecture qualitative, sans score ajouté.</span></footer></section>
    <section class="panel analysis-register" aria-label="Analyses rattachées à ${esc(p.id)}"><header class="panel-heading"><div class="panel-title"><span class="tile-icon teal">${icon('layers')}</span><div><h2>Analyses rattachées à ${esc(p.id)}</h2><p>${esc(p.name)}</p></div></div><span class="counter">${analyses.length} analyse${analyses.length>1?'s':''}</span></header>
    <div class="controls"><div class="search-group"><label class="search">${icon('search')}<input id="swot-search" type="search" aria-label="Rechercher une analyse SWOT" placeholder="Rechercher dans les analyses de ce processus…"></label><button class="button" data-filters>${icon('filters')}Filtres</button></div></div>
    ${analyses.map(x=>`<div class="analysis-row" data-swot-name="${esc((x.id+' '+x.author).toLowerCase())}"><div><strong>SWOT · ${esc(x.id)}</strong><small>${date(x.date)} · ${esc(x.author)} · Version ${esc(x.version)} · Existant</small></div><div class="analysis-process-tag">${icon('link')}${esc(p.id)}</div><button class="button small" data-open-swot="${esc(x.id)}">Ouvrir ${icon('arrow')}</button></div>`).join('')}<p id="swot-search-empty" class="swot-search-empty" hidden>Aucune analyse ne correspond à la recherche dans ce processus.</p></section>`;
  }
  function selector(issue){return `<select data-classify="${issue.id}" aria-label="Facteur de l’enjeu ${esc(issue.label)}"><option value="">Non classé</option>${d.factors.map(f=>`<option value="${f.id}" ${f.id===issue.factor?'selected':''}>${esc(f.label)}</option>`).join('')}</select>`;}
  function renderPestel(){const ext=d.issues.filter(x=>x.nature==='ext'),internal=d.issues.filter(x=>x.nature==='int'),unknown=ext.filter(x=>!d.factors.some(f=>f.id===x.factor));
    return `<details class="method-note"><summary>${icon('info')}Le PESTEL est une lecture facultative des enjeux externes.<b>À propos</b></summary><p>Le PESTEL n’est pas exigé par la norme ISO 9001:2015 : c’est une présentation facultative des enjeux externes de l’article 4.1. La note 2 cite l’environnement juridique, technologique, concurrentiel, commercial, culturel, social et économique ; les facteurs politique et environnemental vont au-delà. Les facteurs sont ceux de votre nomenclature. Les enjeux internes restent dans le contexte et le SWOT.</p></details>
    <section class="panel pestel-summary" aria-label="Répartition des enjeux"><div class="pestel-count"><b>${ext.length}</b>enjeux externes</div><div class="pestel-count teal"><b>${ext.length-unknown.length}</b>classés<small>dans la nomenclature affichée</small></div><div class="pestel-count amber"><b>${unknown.length}</b>non classé<small>facteur à renseigner</small></div><div class="pestel-count"><b>${internal.length}</b>enjeux internes<small>conservés hors PESTEL</small></div></section>
    <section class="pestel-grid" aria-label="Facteurs PESTEL">${d.factors.map(f=>{const entries=ext.filter(x=>x.factor===f.id);return `<article class="panel factor" data-tone="${f.tone}" aria-label="Facteur ${esc(f.label)}"><header><span class="factor-letter">${f.letter}</span><div><h2>${esc(f.label)}</h2><small>Facteur de la nomenclature</small></div><span class="counter">${entries.length}</span></header>${entries.length?entries.map(x=>`<div class="factor-line"><h3>${esc(x.label)}</h3><p>Processus : ${esc(x.processus.join(', ')||'Non renseigné')}</p>${selector(x)}</div>`).join(''):'<p class="empty-factor">Aucun enjeu classé<br>dans ce facteur.</p>'}</article>`;}).join('')}</section>
    <section class="panel issue-box unclassified" aria-label="Enjeux externes non classés"><header><span class="tile-icon amber">${icon('warning')}</span><h2>Enjeux externes non classés</h2><span class="counter">${unknown.length}</span></header>${unknown.length?unknown.map(x=>`<div class="issue-inline"><div><p>${esc(x.label)}</p><small>Processus : ${esc(x.processus.join(', '))}</small></div>${selector(x)}</div>`).join(''):'<p>Tous les enjeux externes sont classés.</p>'}</section>
    <section class="panel issue-box" aria-label="Enjeux internes hors PESTEL"><header><span class="tile-icon teal">${icon('tree')}</span><h2>Enjeux internes · hors PESTEL</h2><span class="counter">${internal.length}</span></header><div class="internal-tags">${internal.map(x=>`<span><i class="dot teal"></i>${esc(x.label)}</span>`).join('')}</div></section>`;
  }
  function render(){const titles={parties:['Parties intéressées','Des acteurs identifiés, des attentes lisibles et un traitement suivi.','Ajouter une partie intéressée'],swot:['SWOT par processus','Choisissez un processus pour consulter les analyses SWOT qui lui sont rattachées.','Ajouter une analyse SWOT'],pestel:['PESTEL des enjeux externes','Les enjeux existants, répartis selon votre nomenclature.','']};
    const [title,subtitle,create]=titles[view];el('title').textContent=title;el('subtitle').textContent=subtitle;el('create').hidden=!create;el('create').querySelector('span').textContent=create;
    document.querySelectorAll('[data-view]').forEach(b=>{if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    el('content').innerHTML=view==='parties'?renderParties():view==='swot'?renderSwot():renderPestel();hydrate();updateUrl();
    el('search')?.addEventListener('input',filterRows);
    el('swot-search')?.addEventListener('input',()=>{const value=el('swot-search').value.toLowerCase();let shown=0;document.querySelectorAll('[data-swot-name]').forEach(row=>{row.hidden=!row.dataset.swotName.includes(value);if(!row.hidden)shown++;});el('swot-search-empty').hidden=shown>0;});
  }
  function filterRows(){const search=(el('search')?.value||'').toLowerCase();let shown=0;document.querySelectorAll('.party-row').forEach(row=>{const match=row.dataset.name.includes(search)&&(filters.owner==='all'||row.dataset.owner===filters.owner)&&(filters.origin!=='natif')&&(filters.due==='all'||filters.due==='sans');row.hidden=!match;if(match)shown++;});el('shown-count').textContent=`${shown} partie${shown>1?'s':''} intéressée${shown>1?'s':''} affichée${shown>1?'s':''}`;el('empty').hidden=shown>0;}
  function input(label,value,wide=false,type='text'){return `<label class="${wide?'wide':''}">${label}<input type="${type}" value="${esc(value)}"></label>`;}
  function textarea(label,value,wide=false){return `<label class="${wide?'wide':''}">${label}<textarea aria-label="${esc(label)}">${esc(value)}</textarea></label>`;}
  function partyForm(id){const p=d.parties.find(x=>x.id===id)||{};openModal('Fiche — Partie intéressée',`<div class="modal-tabs"><button class="active" data-modal-tab="information">Informations</button><button data-modal-tab="liens">Liens et justificatifs</button><button data-modal-tab="historique">Historique</button></div><div id="modal-info"><div class="form-grid">${input('Intitulé',p.name,true)}${input('Description','',true)}<label class="wide">Registre<select aria-label="Registre"><option>Non renseigné dans la maquette</option></select></label>${input('Responsable',p.owner)}<label>Nature<select aria-label="Nature"><option ${p.type!=='Interne'?'selected':''}>Externe</option><option ${p.type==='Interne'?'selected':''}>Interne</option></select></label>${input('Catégorie',p.cat,true)}${textarea('Besoins et attentes',p.needs)}${textarea('Exigences pertinentes',p.req)}<label>Exigences traitées<select aria-label="Exigences traitées">${[['','Non renseigné'],['Oui','Oui'],['Partiel','Partiellement'],['Non','Non']].map(([v,l])=>`<option value="${v}" ${p.addressed===v?'selected':''}>${l}</option>`).join('')}</select></label>${input('Dernière revue',p.reviewed,false,'date')}${textarea('Traitement dans le système de management',p.how,true)}${input('Contact',p.contact,true)}</div></div><p class="modal-note">Illustration du formulaire existant sur données fictives.</p><footer class="modal-footer"><button class="button" data-close>Annuler</button><button class="button primary" data-demo-save>Enregistrer</button></footer>`);}
  function swotForm(id){const s=d.swots.find(s=>s.id===id),p=d.processes.find(p=>p.id===(s?.process||processId));openModal('Fiche — Analyse SWOT',`<div class="swot-form-process"><span class="tile-icon teal">${icon('tree')}</span><label>Processus rattaché<input readonly value="${esc(p.id+' · '+p.name)}"></label></div><div class="form-grid">${input('Intitulé',s?.id||'',true)}${input('Description','',true)}<label class="wide">Registre<select aria-label="Registre"><option>Non renseigné dans la maquette</option></select></label>${input('Responsable',s?.author||'',true)}${textarea('Forces',s?.S.map(x=>x.text).join('\n')||'')}${textarea('Faiblesses',s?.W.map(x=>x.text).join('\n')||'')}${textarea('Opportunités',s?.O.map(x=>x.text).join('\n')||'')}${textarea('Menaces',s?.T.map(x=>x.text).join('\n')||'')}</div><p class="modal-note">Illustration du rattachement existant ; aucun enregistrement dans la maquette.</p><footer class="modal-footer"><button class="button" data-close>Annuler</button><button class="button primary" data-demo-save>Enregistrer</button></footer>`,'layers');}
  function filterModal(){openModal('Filtres du registre',`<div class="filter-grid"><label>État<select aria-label="État"><option>Tous les états</option><option>—</option></select></label><label>Responsable<select id="filter-owner" aria-label="Responsable"><option value="all">Tous</option>${[...new Set(d.parties.map(p=>p.owner))].map(x=>`<option ${filters.owner===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label><label>Échéance<select id="filter-due" aria-label="Échéance"><option value="all">Toutes</option><option value="retard">Dépassée</option><option value="avenir">À venir</option><option value="sans">Sans échéance</option></select></label><label>Origine<select id="filter-origin" aria-label="Origine"><option value="all">Toutes</option><option value="existant">Existant (outil de suivi)</option><option value="natif">Créé dans le Pilotage</option></select></label></div><p class="modal-note">Filtres existants illustrés avec les fiches fictives.</p><footer class="modal-footer"><button class="button" data-reset-filters>Réinitialiser</button><button class="button primary" data-apply-filters>Appliquer</button></footer>`,'filters');}
  document.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;
    if(b.dataset.view){view=b.dataset.view;render();return;}
    if(b.hasAttribute('data-close')){closeModal();return;}
    if(b.dataset.openParty){partyForm(b.dataset.openParty);return;}
    if(b.hasAttribute('data-open-swot')){swotForm(b.dataset.openSwot);return;}
    if(b.hasAttribute('data-create-swot')){swotForm();return;}
    if(b.hasAttribute('data-filters')){filterModal();return;}
    if(b.hasAttribute('data-history')){openModal('Décisions et réalisations','<p>Présentation de l’historique de la fiche. Aucun événement fictif ajouté dans cette proposition.</p><footer class="modal-footer"><button class="button" data-close>Fermer</button></footer>','clock');return;}
    if(b.hasAttribute('data-retained')){notice('La présentation Périmètre et contexte déjà validée est conservée.');return;}
    if(b.hasAttribute('data-demo-save')){closeModal();notice('Maquette : aucun enregistrement effectué.');return;}
    if(b.hasAttribute('data-apply-filters')){filters.owner=el('filter-owner').value;filters.origin=el('filter-origin').value;filters.due=el('filter-due').value;closeModal();if(view==='parties')filterRows();return;}
    if(b.hasAttribute('data-reset-filters')){Object.assign(filters,{owner:'all',origin:'all',due:'all'});closeModal();if(view==='parties')filterRows();return;}
    if(b.dataset.modalTab){document.querySelectorAll('[data-modal-tab]').forEach(x=>x.classList.toggle('active',x===b));el('modal-info').hidden=b.dataset.modalTab!=='information';let pane=el('modal-extra');if(!pane){pane=document.createElement('p');pane.id='modal-extra';el('modal-info').after(pane);}pane.hidden=b.dataset.modalTab==='information';pane.textContent=b.dataset.modalTab==='liens'?'Les liens et justificatifs de la fiche seront consultables ici.':'L’historique existant reste consultable ; aucun événement simulé.';}
  });
  document.addEventListener('change',event=>{const node=event.target;if(node.id==='process-picker'){processId=node.value;swotId=d.swots.find(s=>s.process===processId)?.id;render();el('process-picker').focus();return;}if(node.dataset.classify){d.issues.find(x=>x.id===node.dataset.classify).factor=node.value||null;render();notice('Classement illustratif modifié dans la maquette uniquement.');}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeModal();document.querySelector('.sidebar').classList.remove('open');}if(event.key==='Tab'&&!el('veil').hidden){const nodes=[...el('modal').querySelectorAll('button,input,select,textarea,a')].filter(x=>!x.disabled&&x.getBoundingClientRect().width);const first=nodes[0],last=nodes[nodes.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
  el('veil').addEventListener('click',event=>{if(event.target===el('veil'))closeModal();});
  el('theme').addEventListener('click',()=>{theme=theme==='light'?'dark':'light';setTheme();});
  el('create').addEventListener('click',()=>{if(view==='parties')partyForm();else if(view==='swot')swotForm();});
  el('mobile-menu').addEventListener('click',()=>document.querySelector('.sidebar').classList.toggle('open'));
  setTheme();render();
})();
