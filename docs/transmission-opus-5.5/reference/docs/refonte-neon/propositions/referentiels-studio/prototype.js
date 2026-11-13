/* global document, window */
'use strict';
// Proposition autonome : aucun appel à une API ni sauvegarde.
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
Object.assign(icons,{
 book:'<path d="M5 3h13a1 1 0 0 1 1 1v17H6a3 3 0 0 1 0-6h13M5 3v12M8 7h7m-7 4h5"/>',
 library:'<path d="M3 3h4v18H3Zm7 0h4v18h-4Zm7 2 3-1 4 16-3 1Z"/>',
 layers:'<path d="m12 3 10 5-10 5L2 8Zm-10 9 10 5 10-5M2 16l10 5 10-5"/>',
 lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3"/>',
 edition:'<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14ZM13 21h8"/>',
 upload:'<path d="M12 17V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
 download:'<path d="M12 3v14m-5-5 5 5 5-5M4 17v4h16v-4"/>',
 code:'<path d="m8 5-6 7 6 7m8-14 6 7-6 7m-3-17-2 20"/>',
 arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',
 archive:'<rect x="3" y="3" width="18" height="5" rx="1"/><path d="M5 8v13h14V8m-10 5h6"/>',
 spark:'<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
});
const frameworks=[
 {id:'ISO',identifier:'ISO-27001-CLAUSES',name:'ISO/IEC 27001',subtitle:'Clauses du système de management',edition:'2022',tone:'indigo',active:true,version:1,scopes:2},
 {id:'A',identifier:'ISO-27001-ANNEXE-A',name:'Annexe A',subtitle:'Mesures de sécurité de l’information',edition:'ISO/IEC 27001:2022',tone:'teal',active:true,version:1,scopes:2},
 {id:'HDS',identifier:'HDS-DEMONSTRATION',name:'HDS',subtitle:'Hébergement de données de santé',edition:'Import de démonstration',tone:'amber',active:false,version:1,scopes:1},
];
const requirements=window.exigencesDemo;
let selected='ISO',page='referentiels',limit=50,legacyLimit=50,lastFocus,noticeTimer;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const of=f=>requirements.filter(i=>i.ref===f.id);
const chosen=()=>frameworks.find(f=>f.id===selected);
function domain(i){
 if(i.ref==='ISO')return ({4:'Contexte de l’organisation',5:'Leadership',6:'Planification',7:'Support',8:'Fonctionnement',9:'Évaluation des performances',10:'Amélioration'})[Number(i.id.match(/ISO-(\d+)/)?.[1])]||'Management';
 if(i.ref==='A')return ({5:'Organisation',6:'Personnes',7:'Sécurité physique',8:'Technologie'})[Number(i.id.match(/A-(\d+)/)?.[1])]||'Mesures de sécurité';
 return 'Hébergement de données de santé';
}
function book(tone='indigo',small=false){return `<span class="reference-icon ${small?'small':''}" data-tone="${tone}">${icon('book')}</span>`;}
function renderCatalogue(){
 document.getElementById('catalogue').innerHTML=frameworks.map(f=>`<article class="reference-card" data-ref="${f.id}" data-tone="${f.tone}" data-selected="${f.id===selected}"><div class="reference-top">${book(f.tone)}<span class="pill ${f.active?'active':'inactive'}"><i class="dot"></i>${f.active?'Actif':'Inactif'}</span><button class="card-menu" data-actions="${f.id}" aria-label="Actions de ${esc(f.name)}">···</button></div><h2><button data-select="${f.id}">${f.name}</button></h2><p class="descriptor">${f.subtitle}</p><div class="reference-numbers"><p><strong>${of(f).length}</strong><span>exigences</span></p><span class="edition-label">Édition <b>${f.edition}</b></span></div><footer class="reference-foot"><small>${icon('layers')}Version publiée ${f.version}</small><button class="consult-button" data-select="${f.id}" aria-pressed="${f.id===selected}">${f.id===selected?'Consulté':'Consulter'}${icon('arrow')}</button></footer></article>`).join('');
}
function renderRequirements(){
 const f=chosen(),rows=of(f),shown=rows.slice(0,limit);
 document.getElementById('register-title').textContent=f.name;
 document.getElementById('register-subtitle').textContent=f.subtitle;
 document.getElementById('requirement-total').textContent=`${rows.length} exigences`;
 document.getElementById('requirements').innerHTML=shown.map(i=>`<tr><td><span class="requirement-code">${esc(i.id)}</span></td><td>${esc(i.title)}<span class="mobile-domain">${domain(i)}</span></td><td><span class="domain-label">${domain(i)}</span></td></tr>`).join('');
 document.getElementById('shown-count').textContent=`${shown.length} exigence${shown.length>1?'s':''} affichée${shown.length>1?'s':''} sur ${rows.length}`;
 document.getElementById('load-more').hidden=limit>=rows.length;
 document.getElementById('framework-select').innerHTML=frameworks.map(r=>`<option value="${r.id}" ${r.id===selected?'selected':''}>${r.name} · version ${r.version}</option>`).join('');
 document.getElementById('history-json').textContent=JSON.stringify({name:f.name,identifier:f.identifier,source:{status:'unverified',normative:false},requirements:rows.map(i=>({id:i.id,title:i.title}))},null,2);
}
function renderLibrary(){
 document.getElementById('library-list').innerHTML=frameworks.map(f=>`<article class="library-row"><div class="library-name">${book(f.tone,true)}<div><h2>${f.name}</h2><p>${f.identifier}</p></div></div><div class="library-metric"><strong>v${f.version}</strong><span>version publiée</span></div><div class="library-metric"><strong>${of(f).length}</strong><span>exigences</span></div><div class="library-metric"><strong>${f.scopes}</strong><span>périmètres rattachés</span></div><footer class="library-meta"><span class="pill locked">${icon('lock')}Version source verrouillée</span><span>Repris de l’outil de suivi</span><div class="library-buttons"><button class="button" data-library-requirements="${f.id}">Exigences</button><button class="button" data-copy="${f.id}">Créer une copie</button><button class="button soft-button" data-edition="${f.id}">Nouvelle édition</button></div></footer></article>`).join('');
}
function renderPage(){
 const library=page==='bibliotheque';
 document.querySelectorAll('[data-page]').forEach(el=>{if(el.dataset.page===page)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
 document.getElementById('page-title').textContent=library?'Bibliothèque de référentiels':'Référentiels et exigences';
 document.getElementById('page-subtitle').textContent=library?'Une source commune, des versions précises pour chaque périmètre.':'Vos référentiels, leurs versions et les exigences qui structurent votre pilotage.';
 document.getElementById('create').innerHTML=`${icon(library?'upload':'plus')}<span>${library?'Importer un référentiel':'Créer un référentiel'}</span>`;
 for(const id of ['scope-bar','catalogue','published-scene','legacy-panel'])document.getElementById(id).hidden=library;
 document.getElementById('library-scene').hidden=!library;
 document.getElementById('summary-line').innerHTML=library?`<span><b>3</b> référentiels dans la bibliothèque</span><span><b>157</b> exigences</span><span>${icon('lock')}Sources verrouillées</span><span class="summary-end">Contenu de démonstration</span>`:`<span><b>3</b> référentiels publiés</span><span><b>157</b> exigences</span><span><i class="dot green"></i><b>2</b> actifs dans le périmètre</span><span class="summary-end">${icon('layers')}Versions et provenance conservées</span>`;
 renderCatalogue();renderRequirements();renderLibrary();
}
function notify(action){clearTimeout(noticeTimer);const n=document.getElementById('notice');n.textContent=`${action} : démonstration visuelle uniquement, aucune sauvegarde.`;n.hidden=false;noticeTimer=setTimeout(()=>{n.hidden=true;},4500);}
function modal(title,kicker,body,actions='<button class="button" data-close>Fermer</button>'){
 const m=document.getElementById('modal');
 m.innerHTML=`<header class="modal-head"><div><span class="eyebrow">${kicker}</span><h2 id="modal-title">${title}</h2></div><button class="button quiet close" data-close aria-label="Fermer la fenêtre">${icon('close')}</button></header>${body}<footer class="modal-actions"><small>Maquette autonome · Aucune action serveur</small><div>${actions}</div></footer>`;
 lastFocus=document.activeElement;document.getElementById('veil').hidden=false;m.focus();
}
function closeModal(){document.getElementById('veil').hidden=true;lastFocus?.focus();}
function showSource(f){
 modal('Source et publication',`Référentiel / ${f.name}`,`<div class="modal-source-row">${book(f.tone,true)}<span><strong>${f.name}</strong>${f.subtitle} · version publiée ${f.version}</span></div><dl class="source-grid"><div><dt>Identifiant</dt><dd>${f.identifier}</dd></div><div><dt>Édition de la source</dt><dd>${f.edition}</dd></div><div><dt>Provenance</dt><dd>Repris de l’outil de suivi<small>Intitulés du jeu de démonstration fourni</small></dd></div><div><dt>Statut dans le périmètre</dt><dd>${f.active?'Actif':'Inactif'}</dd></div><div><dt>Contenu de la version</dt><dd>${of(f).length} exigences</dd></div><div><dt>Statut de la source</dt><dd>Non vérifiée<small>La provenance ne vaut pas validation normative</small></dd></div><div class="wide"><dt>Motif de publication</dt><dd>Publication de démonstration<small>Exemple d’historique de la maquette, distinct des données de l’application</small></dd></div></dl><div class="source-note">${icon('info')}<span>Aucun texte ISO sous licence n’est fourni. Les intitulés sont ceux saisis dans le jeu de démonstration.</span></div>`);
}
function showActions(f){modal(f.name,'Référentiel / Commandes existantes',`<div class="action-list"><button class="button" data-source="${f.id}">${icon('document')}Source et publication</button><button class="button" data-notice="${f.active?'Désactiver':'Activer'} ${f.name}">${f.active?'Désactiver':'Activer'}</button><button class="button" data-prepare="${f.id}">Préparer une nouvelle version</button><button class="button" data-notice="Exporter la définition JSON">Exporter la définition JSON</button><button class="button" data-notice="Promouvoir dans la bibliothèque">Promouvoir dans la bibliothèque</button></div>`);}
function showEditor(f,mode='edition'){
 const imported=mode==='import',copy=mode==='copy',newRef=mode==='create';
 const title=imported?'Importer un référentiel':copy?'Créer une copie personnalisable':newRef?'Créer un référentiel':'Préparer une nouvelle version';
 const json={name:f?.name||'PSSI — exemple fictif',identifier:f?.identifier||'PSSI-EXEMPLE',source:{organisation:'Organisation fictive',status:'organisation',normative:false},domains:[{id:'gouvernance',label:'Gouvernance'}],requirements:[{id:'PSSI-01',title:'Revue périodique de la politique',description:'Exemple fictif.'}]};
 const input=(label,value='',wide=false)=>`<label ${wide?'class="wide"':''}>${label}<input value="${esc(value)}"></label>`;
 modal(title,'Référentiels / Démonstration',`<p class="help">${copy?'La version source est conservée. La copie appartient à l’organisation.':imported?'Importez les exigences dont vous détenez les droits. Une simulation précède toute publication.':'Les versions précédentes restent conservées après la publication d’une nouvelle version.'}</p><div class="form-grid">${imported?`<label class="wide">Définition du référentiel (JSON)<textarea class="code-input">${esc(JSON.stringify(json,null,2))}</textarea></label>`:`${input('Nom',copy?f.name+' — copie':f?.name||'PSSI — exemple fictif',true)}${input('Identifiant',copy?'COPIE-'+f.identifier:f?.identifier||'PSSI-EXEMPLE')}${input('Organisation source','Organisation fictive')}${input('Document source',f?.subtitle||'Politique de sécurité fictive',true)}<label class="wide">Domaines et exigences<textarea>${esc(f?of(f).slice(0,3).map(i=>i.id+' · '+i.title).join('\n'):'PSSI-01 · Revue périodique de la politique')}</textarea></label>`}${input('Motif de publication','',true)}</div>`,`<button class="button" data-close>Annuler</button><button class="button primary" data-notice="${copy?'Créer une copie':'Simuler la publication'}">${copy?'Créer une copie':'Simuler la publication'}</button>`);
}
function showLibraryRequirements(f){modal(`Exigences de ${f.name}`,'Bibliothèque / Consultation',`<div class="version-bar"><label>Version<select><option>Version ${f.version}</option></select></label><span class="pill locked">${icon('lock')}Version source verrouillée</span></div><div class="requirements-table"><table><colgroup><col class="code-col"><col></colgroup><thead><tr><th>Code</th><th>Intitulé</th></tr></thead><tbody>${of(f).map(i=>`<tr><td><span class="requirement-code">${esc(i.id)}</span></td><td>${esc(i.title)}</td></tr>`).join('')}</tbody></table></div>`);}
function renderLegacy(){
 const q=document.getElementById('legacy-search').value.toLocaleLowerCase('fr');const list=requirements.filter(i=>(i.id+' '+i.title).toLocaleLowerCase('fr').includes(q));
 document.getElementById('legacy-results').innerHTML=list.slice(0,legacyLimit).map(i=>`<div class="legacy-line"><span class="requirement-code">${esc(i.id)}</span><div>${esc(i.title)}<small>Référence liée : legacy:items:${esc(i.id)}</small></div></div>`).join('')||'<p>Aucune exigence historique pour cette recherche.</p>';
 document.getElementById('legacy-more').hidden=list.length<=legacyLimit;
}
function select(id){selected=id;limit=50;document.getElementById('version-select').value='current';document.getElementById('history').hidden=true;renderCatalogue();renderRequirements();}
paintIcons();renderPage();renderLegacy();
// La navigation entre les autres rubriques reste illustrée ; leurs fonctions ne sont pas remplacées par la maquette.
let currentNotice;
 document.addEventListener('click',event=>{
 const el=event.target.closest('button');
 if(!el){if(event.target.id==='veil')closeModal();return;}
 if(el.dataset.select)select(el.dataset.select);
 if(el.dataset.page){page=el.dataset.page;renderPage();}
 if(el.dataset.unshown){currentNotice=el.dataset.unshown;notify(`${currentNotice} : rubrique existante conservée`);}
 if(el.dataset.actions)showActions(frameworks.find(f=>f.id===el.dataset.actions));
 if(el.dataset.source)showSource(frameworks.find(f=>f.id===el.dataset.source));
 if(el.dataset.prepare)showEditor(frameworks.find(f=>f.id===el.dataset.prepare));
 if(el.dataset.copy)showEditor(frameworks.find(f=>f.id===el.dataset.copy),'copy');
 if(el.dataset.edition)showEditor(frameworks.find(f=>f.id===el.dataset.edition),'import');
 if(el.dataset.libraryRequirements)showLibraryRequirements(frameworks.find(f=>f.id===el.dataset.libraryRequirements));
 if(el.id==='source-details')showSource(chosen());
 if(el.id==='new-version')showEditor(chosen());
 if(el.id==='create')showEditor(null,page==='bibliotheque'?'import':'create');
 if(el.id==='export')notify('Exporter la définition JSON');
 if(el.id==='promote')notify('Promouvoir dans la bibliothèque');
 if(el.id==='load-more'){limit+=50;renderRequirements();}
 if(el.id==='legacy-more'){legacyLimit+=50;renderLegacy();}
 if(el.dataset.notice)notify(el.dataset.notice);
 if(el.hasAttribute('data-close'))closeModal();
 if(el.id==='theme'){const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';el.innerHTML=`${icon(dark?'sun':'moon')}<span>Mode ${dark?'clair':'sombre'}</span>`;}
});
document.getElementById('framework-select').addEventListener('change',event=>select(event.target.value));
document.getElementById('version-select').addEventListener('change',event=>{document.getElementById('history').hidden=event.target.value==='current';});
document.getElementById('legacy-search').addEventListener('input',()=>{legacyLimit=50;renderLegacy();});
document.addEventListener('keydown',event=>{
 if(document.getElementById('veil').hidden)return;
 if(event.key==='Escape')closeModal();
 if(event.key==='Tab'){
  const els=[...document.getElementById('modal').querySelectorAll('button,input,textarea,select,summary')],first=els[0],last=els.at(-1);
  if(event.shiftKey&&(document.activeElement===first||document.activeElement.id==='modal')){event.preventDefault();last.focus();}
  if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
 }
});
window.maquette={frameworks,requirements,select};
