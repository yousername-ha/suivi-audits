/* global window, document, location, matchMedia, history, ResizeObserver */
/* Maquette indépendante : jeu fictif existant, lecture locale, aucune API ni persistance. */
(() => {
  'use strict';
  const d = window.DEMO_ORGANISATION;
  const paths = {
    dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    tree:'<rect x="9" y="2" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="16" y="16" width="6" height="6" rx="1"/><path d="M12 8v4H5v4m7-4h7v4"/>',
    chart:'<path d="M3 3v18h18M7 16l4-5 4 2 5-8"/>',
    diamond:'<path d="m12 3 9 9-9 9-9-9Z"/>',
    shield:'<path d="m12 2 8 4v7c0 5-8 9-8 9S4 18 4 13V6Z"/><path d="m8 12 3 3 5-6"/>',
    list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1"/>',
    restore:'<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7m2-4v6l4 2"/>',
    document:'<path d="M6 2h8l4 4v16H6Zm8 0v5h4M9 11h6m-6 4h6m-6 4h4"/>',
    people:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m18 0v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18m-13 4h2m3 0h2"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    arrow:'<path d="M5 19 19 5M5 5h14v14"/>',
    moon:'<path d="M20.5 13A9 9 0 0 1 11 3.5 9 9 0 1 0 20.5 13Z"/>',
    sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    link:'<path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1"/>',
    layers:'<path d="m12 3 10 6-10 6L2 9Zm-9 10 9 5 9-5m-18 5 9 5 9-5"/>',
    bolt:'<path d="m13 2-9 12h7l-1 8 10-12h-7Z"/>',
    adjust:'<path d="M4 6h16M4 18h16M7 2v8m10 4v8"/><circle cx="7" cy="6" r="3"/><circle cx="17" cy="18" r="3"/>',
    compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2 6-6 2 2-6Z"/>',
    warning:'<path d="m12 3 10 18H2Z"/><path d="M12 9v5m0 3h.01"/>',
    pause:'<path d="M8 5v14M16 5v14"/>',
    play:'<path d="m8 4 12 8-12 8Z"/>',
    expand:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m8 0h5v-5"/>',
    edit:'<path d="m15 4 5 5-11 11-6 1 1-6Zm-1 1 5 5"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>'
  };
  const specs = [
    {key:'S',label:'Forces',nature:'Interne',angle:'Favorable',sign:'+',icon:'bolt'},
    {key:'W',label:'Faiblesses',nature:'Interne',angle:'Défavorable',sign:'−',icon:'adjust'},
    {key:'O',label:'Opportunités',nature:'Externe',angle:'Favorable',sign:'+',icon:'compass'},
    {key:'T',label:'Menaces',nature:'Externe',angle:'Défavorable',sign:'−',icon:'warning'}
  ];
  const el = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.document}</svg>`;
  const date = value => value ? value.split('-').reverse().join('/') : 'Non renseignée';
  const query = new URLSearchParams(location.search);
  let processId = d.processes.some(p=>p.id===query.get('processus')) ? query.get('processus') : d.swots[0].process;
  let analysisId = query.get('analyse') || d.swots.find(s=>s.process===processId)?.id;
  let theme = query.get('theme')==='dark' ? 'dark' : 'light';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let motion = !reduced.matches, previousFocus, noticeTimer, resizeObserver;
  const currentProcess = () => d.processes.find(p=>p.id===processId);
  const linked = () => d.swots.filter(s=>s.process===processId);
  const currentAnalysis = () => linked().find(s=>s.id===analysisId) || linked()[0];
  function updateUrl(){const q=new URLSearchParams({theme,processus:processId});if(currentAnalysis())q.set('analyse',currentAnalysis().id);history.replaceState(null,'','?'+q);}
  function updateTheme(){document.documentElement.dataset.theme=theme;el('theme').innerHTML=icon(theme==='dark'?'sun':'moon')+`<span>${theme==='dark'?'Mode clair':'Mode sombre'}</span>`;updateUrl();}
  function updateMotion(){document.documentElement.dataset.motion=motion?'on':'off';const button=el('motion');if(button){button.innerHTML=icon(motion?'pause':'play')+`<span>${motion?'Pause animations':'Reprendre les animations'}</span>`;button.setAttribute('aria-pressed',String(!motion));}}
  function notice(text){clearTimeout(noticeTimer);el('notice').textContent=text;el('notice').hidden=false;noticeTimer=setTimeout(()=>{el('notice').hidden=true;},4000);}
  function openModal(title,body,kind='layers'){
    if(el('veil').hidden)previousFocus=document.activeElement;
    el('modal').innerHTML=`<header class="modal-heading"><span class="tile-icon teal">${icon(kind)}</span><h2 id="modal-title">${esc(title)}</h2><button class="button icon-only" aria-label="Fermer" data-close>${icon('close')}</button></header><div class="modal-content">${body}</div>`;
    el('veil').hidden=false;
    document.querySelector('.shell').inert=true;document.querySelector('.sidebar').inert=true;
    el('modal').focus();
  }
  function closeModal(){el('veil').hidden=true;el('modal').innerHTML='';document.querySelector('.shell').inert=false;document.querySelector('.sidebar').inert=false;if(previousFocus?.isConnected)previousFocus.focus();}
  function processHero(){const p=currentProcess(),count=linked().length;return `
    <section class="process-hero" aria-label="Processus rattaché">
      <div class="hero-identity"><span class="hero-symbol">${icon('tree')}<small>${esc(p.id)}</small></span><div>
        <div class="hero-eyebrow">Processus rattaché <i class="dot"></i> ${esc(p.family)}</div>
        <h2>${esc(p.name)}</h2>
        <div class="hero-meta"><span>${icon('people')}Pilote : ${esc(p.owner)}</span><span>${icon('link')}${count} analyse${count>1?'s':''} SWOT</span></div>
      </div></div>
      <label class="hero-picker" for="process-picker"><span id="process-label">Choisir un processus</span>
        <select id="process-picker" aria-labelledby="process-label" aria-describedby="process-help">${d.processes.map(x=>`<option value="${esc(x.id)}" ${x.id===p.id?'selected':''}>${esc(x.id)} · ${esc(x.name)}</option>`).join('')}</select>
        <small id="process-help">Ses analyses sont regroupées dans cette vue.</small>
      </label>
    </section>`;}
  function renderSector(spec,s){const entries=s[spec.key];return `
    <article class="sector" data-key="${spec.key}" aria-label="${spec.label}">
      <span class="sector-cut-line" aria-hidden="true"></span>
      <header><span class="sector-mark">${icon(spec.icon)}</span><div class="sector-title"><small>${spec.nature}</small><h3>${spec.label}</h3></div><span class="sector-count"><b>${entries.length}</b><small>élément${entries.length>1?'s':''}</small></span></header>
      ${entries.length?`<ul>${entries.map(x=>`<li><i aria-hidden="true"></i>${esc(x.text)}</li>`).join('')}</ul>`:'<p class="sector-empty">Aucun élément renseigné.</p>'}
      <footer><span class="sector-nature"><i aria-hidden="true">${spec.sign}</i>${spec.angle}</span><button class="sector-read" data-focus="${spec.key}" aria-label="Agrandir ${spec.label}">Lire ${icon('expand')}</button></footer>
    </article>`;}
  function renderMatrix(){const p=currentProcess(),s=currentAnalysis();if(!s)return `
    <section class="panel empty-analysis" aria-label="Analyses du processus ${esc(p.id)}"><span class="tile-icon teal">${icon('layers')}</span><h2>Aucune analyse SWOT rattachée à ${esc(p.id)}</h2><p>${esc(p.name)}</p><button class="button primary" data-create>${icon('plus')}Ajouter une analyse à ce processus</button></section>`;
    return `
    <section class="matrix-wrap" aria-label="Matrice SWOT du processus ${esc(p.id)}"><div class="matrix-surface">
      <header class="matrix-toolbar"><div class="matrix-heading"><span class="tile-icon blue">${icon('layers')}</span><div><h2>Analyse SWOT <span>· ${esc(s.id)}</span></h2><p>${date(s.date)} <span aria-hidden="true">/</span> Version ${esc(s.version)}</p></div></div><div class="matrix-actions"><button class="button motion-control" id="motion"></button><button class="button" data-open-analysis="${esc(s.id)}">${icon('edit')}Ouvrir la fiche</button></div></header>
      <div class="column-axis" aria-hidden="true"><span><i>+</i>FAVORABLE</span><span><i>−</i>DÉFAVORABLE</span></div>
      <div class="matrix-layout"><div class="row-axis" aria-hidden="true"><span>ENVIRONNEMENT INTERNE</span><span>ENVIRONNEMENT EXTERNE</span></div><div class="matrix-plane" id="matrix-plane">
        <svg class="circuit" id="circuit" aria-hidden="true" preserveAspectRatio="none">${specs.map(x=>`<path data-wire="${x.key}"/><path class="wire-flow" data-wire="${x.key}"/>`).join('')}</svg>
        <div class="matrix-grid">${specs.map(x=>renderSector(x,s)).join('')}</div>
        <button class="process-hub" data-process aria-label="Voir le processus ${esc(p.id)}"><span class="hub-orbit" aria-hidden="true"></span><span class="hub-core">${icon('tree')}<strong>${esc(p.id)}</strong><small>PROCESSUS</small></span></button>
      </div></div>
      <footer class="matrix-foot"><span>${icon('link')}Processus <b class="relation-id">${esc(p.id)}</b> → Analyse <b class="relation-id">${esc(s.id)}</b><span>·</span>Auteur : ${esc(s.author)}</span><span>${icon('info')}Analyse qualitative</span></footer>
    </div></section>
    <section class="analysis-strip" aria-label="Analyses rattachées à ${esc(p.id)}"><span class="tile-icon teal">${icon('layers')}</span><div class="strip-title"><h2>Les analyses de ce processus</h2><p>${esc(s.id)} · ${date(s.date)} · ${esc(s.author)}</p></div><span class="counter">${linked().length} analyse${linked().length>1?'s':''}</span><button class="button" data-analyses>Parcourir ${icon('arrow')}</button><button class="button quiet" data-history>Décisions et réalisations</button></section>`;
  }
  function syncMatrix(){const plane=el('matrix-plane');if(!plane)return;const svg=el('circuit'),hub=plane.querySelector('.process-hub'),top=plane.querySelector('[data-key=S]'),bottom=plane.querySelector('[data-key=O]');if(matchMedia('(max-width:760px)').matches){hub.style.removeProperty('top');return;}
    const w=plane.clientWidth,h=plane.clientHeight,x=w/2,y=(top.offsetTop+top.offsetHeight+bottom.offsetTop)/2,left=w*.34,right=w*.66;
    hub.style.top=y+'px';svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
    const lines={S:`M ${x-22} ${y-18} H ${left+14} Q ${left} ${y-18} ${left} ${y-32} V ${top.offsetTop+top.offsetHeight-5}`,W:`M ${x+22} ${y-18} H ${right-14} Q ${right} ${y-18} ${right} ${y-32} V ${top.offsetTop+top.offsetHeight-5}`,O:`M ${x-22} ${y+18} H ${left+14} Q ${left} ${y+18} ${left} ${y+32} V ${bottom.offsetTop+5}`,T:`M ${x+22} ${y+18} H ${right-14} Q ${right} ${y+18} ${right} ${y+32} V ${bottom.offsetTop+5}`};
    svg.querySelectorAll('[data-wire]').forEach(path=>path.setAttribute('d',lines[path.dataset.wire]));
  }
  function render(){resizeObserver?.disconnect();el('content').innerHTML=processHero()+renderMatrix();updateUrl();updateMotion();if(el('matrix-plane')){resizeObserver=new ResizeObserver(syncMatrix);resizeObserver.observe(el('matrix-plane'));document.fonts.ready.then(syncMatrix);}}
  function focusSector(key){const spec=specs.find(x=>x.key===key),s=currentAnalysis(),p=currentProcess();if(!spec||!s)return;
    openModal(spec.label,`<div class="focus-body" data-focus="${key}"><div class="focus-context">${icon('tree')}<strong>${esc(p.id)} · ${esc(p.name)}</strong><span>→ SWOT ${esc(s.id)}</span></div><div class="focus-banner"><span class="sector-mark">${icon(spec.icon)}</span><div><h3>${spec.label}</h3><p>${spec.nature} · ${spec.angle} · ${s[key].length} élément${s[key].length>1?'s':''}</p></div></div><ul class="focus-list">${s[key].map((x,i)=>`<li><span>${String(i+1).padStart(2,'0')}</span>${esc(x.text)}</li>`).join('')}</ul>${s[key].length?'':'<p>Aucun élément renseigné.</p>'}<footer class="modal-footer"><button class="button" data-close>Revenir à la matrice</button><button class="button primary" data-open-analysis="${esc(s.id)}">${icon('edit')}Ouvrir la fiche SWOT</button></footer></div>`,spec.icon);
  }
  const field = (label,value,wide=false) => `<label class="${wide?'wide':''}">${esc(label)}<input value="${esc(value)}"></label>`;
  const textArea = (label,value) => `<label>${esc(label)}<textarea aria-label="${esc(label)}">${esc(value)}</textarea></label>`;
  function openRecord(id){const s=d.swots.find(x=>x.id===id),p=d.processes.find(x=>x.id===(s?.process||processId));openModal(s?'Fiche — Analyse SWOT':'Nouvelle analyse SWOT',`
    <div class="form-tabs"><button aria-pressed="true" data-form-tab="information">Informations</button><button aria-pressed="false" data-form-tab="liens">Liens et justificatifs</button><button aria-pressed="false" data-form-tab="historique">Historique</button></div>
    <div id="form-information"><div class="record-context">${icon('tree')}<div><small>Processus rattaché</small><strong>${esc(p.id)} · ${esc(p.name)}</strong></div></div><div class="form-grid">${field('Intitulé',s?.id||'',true)}${field('Description','',true)}<label class="wide">Registre<select aria-label="Registre"><option>Non renseigné dans la maquette</option></select></label>${field('Responsable','',true)}${specs.map(x=>textArea(x.label,(s?.[x.key]||[]).map(y=>y.text).join('\n'))).join('')}</div></div><p id="form-extra" class="modal-links" hidden></p><p class="modal-note">Formulaire illustratif, données fictives. Aucun enregistrement.</p><footer class="modal-footer"><button class="button" data-close>Annuler</button><button class="button primary" data-save>Enregistrer</button></footer>`,'layers');}
  function openProcess(){const p=currentProcess();openModal('Processus — '+p.id,`<div class="record-context">${icon('tree')}<div><small>Processus rattaché à l’analyse affichée</small><strong>${esc(p.name)}</strong></div></div><dl class="process-details"><div><dt>Type</dt><dd>${esc(p.family)}</dd></div><div><dt>Pilote</dt><dd>${esc(p.owner)}</dd></div><div class="wide"><dt>Finalité</dt><dd>${esc(p.purpose||'Non renseignée')}</dd></div><div class="wide"><dt>Analyses SWOT rattachées</dt><dd>${linked().map(s=>esc(s.id)).join(', ')||'Aucune'}</dd></div></dl><footer class="modal-footer"><button class="button" data-close>Revenir à la matrice</button></footer>`,'tree');}
  function browse(){const p=currentProcess();openModal('Analyses du processus '+p.id,`<div class="record-context">${icon('tree')}<div><small>Processus rattaché</small><strong>${esc(p.name)}</strong></div></div>${linked().map(s=>`<article class="analysis-option"><div><h3>SWOT · ${esc(s.id)}</h3><p>${date(s.date)} · ${esc(s.author)} · Version ${esc(s.version)}<br>Existant</p></div><div><button class="button" data-select-analysis="${esc(s.id)}">Afficher</button><button class="button" data-open-analysis="${esc(s.id)}">Ouvrir</button></div></article>`).join('')}<footer class="modal-footer"><button class="button" data-close>Fermer</button></footer>`);}
  document.addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.id==='theme'){theme=theme==='light'?'dark':'light';updateTheme();return;}
    if(button.id==='motion'){motion=!motion;updateMotion();return;}
    if(button.id==='mobile-menu'){document.querySelector('.sidebar').classList.toggle('open');return;}
    if(button.dataset.focus){focusSector(button.dataset.focus);return;}
    if(button.hasAttribute('data-process')){openProcess();return;}
    if(button.hasAttribute('data-create')){openRecord();return;}
    if(button.dataset.openAnalysis){openRecord(button.dataset.openAnalysis);return;}
    if(button.dataset.selectAnalysis){analysisId=button.dataset.selectAnalysis;closeModal();render();return;}
    if(button.hasAttribute('data-analyses')){browse();return;}
    if(button.hasAttribute('data-close')){closeModal();return;}
    if(button.hasAttribute('data-save')){closeModal();notice('Maquette : aucun enregistrement effectué.');return;}
    if(button.hasAttribute('data-history')){openModal('Décisions et réalisations','<p class="modal-links">L’historique existant reste accessible depuis la fiche. Aucune décision ou réalisation fictive ajoutée.</p><footer class="modal-footer"><button class="button" data-close>Fermer</button></footer>','restore');return;}
    if(button.dataset.formTab){document.querySelectorAll('[data-form-tab]').forEach(x=>x.setAttribute('aria-pressed',String(x===button)));const information=button.dataset.formTab==='information';el('form-information').hidden=!information;el('form-extra').hidden=information;el('form-extra').textContent=button.dataset.formTab==='liens'?'Les liens et justificatifs de la fiche restent consultables ici.':'L’historique existant reste consultable ici ; aucun événement simulé.';return;}
    if(button.dataset.reference){location.href='../organisation-contexte-studio/index.html?vue='+button.dataset.reference+'&theme='+theme;return;}
    if(button.hasAttribute('data-retained'))notice('La présentation Périmètre et contexte déjà validée est conservée.');
  });
  document.addEventListener('change',event=>{if(event.target.id==='process-picker'){processId=event.target.value;analysisId=linked()[0]?.id;render();el('process-picker').focus();}});
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'){closeModal();document.querySelector('.sidebar').classList.remove('open');}
    if(event.key==='Tab'&&!el('veil').hidden){const nodes=[...el('modal').querySelectorAll('button,input,textarea,select,a')].filter(x=>!x.disabled&&x.getBoundingClientRect().width);const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===el('modal'))){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
  });
  el('veil').addEventListener('click',event=>{if(event.target===el('veil'))closeModal();});
  reduced.addEventListener('change',event=>{motion=!event.matches;updateMotion();});
  document.querySelectorAll('[data-icon]').forEach(x=>{x.innerHTML=icon(x.dataset.icon);});
  updateTheme();render();
})();
