/* global document, window, matchMedia, innerWidth, addEventListener */
/* Maquette autonome : valeurs entièrement fictives, aucune requête ou sauvegarde serveur. */
const nodes=[
  {id:'organisation',parent:null,name:'Pilotage de l’organisation',kind:'Périmètre',nature:'SMSI',tested:80,applicable:155,requirements:157,frameworks:2,actions:10,late:1,gaps:7,gapsLate:1,series:1,occurrences:0,bia:1,pcra:1,mandatory:16,children:3},
  {id:'soins',parent:'organisation',name:'Établissement de santé',kind:'Établissement',nature:'SMSI',tested:24,applicable:40,requirements:42,frameworks:1,actions:4,late:1,gaps:3,gapsLate:1,series:0,occurrences:0,bia:1,pcra:1,mandatory:2,children:0},
  {id:'hebergement',parent:'organisation',name:'Hébergement de données',kind:'Service',nature:'HDS',tested:18,applicable:31,requirements:31,frameworks:1,actions:3,late:0,gaps:2,gapsLate:0,series:0,occurrences:0,bia:1,pcra:0,mandatory:0,children:0},
  {id:'support',parent:'organisation',name:'Services support',kind:'Service',nature:'SMI',tested:null,applicable:null,requirements:0,frameworks:0,actions:2,late:0,gaps:1,gapsLate:0,series:0,occurrences:0,bia:0,pcra:0,mandatory:0,children:0},
];
const provider={id:'hebergeur-fictif',name:'Hébergeur fictif',linked:'hebergement'};
const paths={
 dashboard:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
 tree:'M9 3h6v5H9z M3 16h6v5H3z M15 16h6v5h-6z M12 8v4 M6 16v-4h12v4',
 chart:'M4 19V9 M10 19V4 M16 19v-8 M22 19V6',risk:'M12 3 22 21H2Z M12 9v5 M12 17v1',
 shield:'M12 3 21 6v6c0 5-5 8-9 10-4-2-9-5-9-10V6Z M8 12l3 3 5-6',tasks:'M3 6h3 M10 6h11 M3 12h3 M10 12h11 M3 18h3 M10 18h11',
 document:'M6 3h8l4 4v14H6Z M14 3v5h4 M9 12h6 M9 16h6',moon:'M20 14a8 8 0 1 1-10-10 8 8 0 0 0 10 10Z',
 plus:'M5 12h14 M12 5v14',minus:'M5 12h14',center:'M3 8V3h5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5 M8 12h8 M12 8v8',
 list:'M6 5h14 M6 12h14 M6 19h14 M2 5h.1 M2 12h.1 M2 19h.1',layers:'m12 3 10 5-10 5L2 8Z M2 12l10 5 10-5 M2 16l10 5 10-5',
 pause:'M8 5v14 M16 5v14',play:'m8 4 12 8-12 8Z',collapse:'m6 3 6 6 6-6 M6 21l6-6 6 6',
 external:'M14 3h7v7 M21 3 10 14 M10 5H4v15h15v-6',close:'M6 6l12 12 M18 6 6 18',open:'M5 12h14 M13 6l6 6-6 6',
};
const icon=k=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[k]??paths.document}"/></svg>`;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const opened=new Set();let active='organisation',view='graphe',single=false,paused=matchMedia('(prefers-reduced-motion:reduce)').matches,pan={x:0,y:0},drag=null;
const visible=()=>single?nodes.slice(0,1):nodes;
const fmt=v=>v===null?'—':String(v);
const coverage=c=>c.tested===null||c.applicable===null?null:c.applicable>0?Math.round(c.tested/c.applicable*100):null;
function details(c,inModal=false){
 const cov=coverage(c);
 return `<div class="node-extra"${inModal?'':` id="details-${c.id}"`}>
 <div class="detail-columns">
  <section class="detail-pane coverage-pane" aria-label="Couverture des exigences"><h3>${icon('shield')}Couverture des exigences</h3>${cov===null?'<p>Indisponible pour ce périmètre.</p>':`<p><b>${c.tested}</b> testées ou validées sur <b>${c.applicable}</b> applicables</p><p>${c.frameworks} référentiel(s) · ${c.requirements} exigences</p><p class="detail-note">Évaluation renseignée, sans taux de conformité.</p>${c.mandatory?`<p class="warn">${icon('risk')}${c.mandatory} clauses à traiter</p>`:''}`}</section>
  <section class="detail-pane activity-pane" aria-label="Activité et continuité"><h3>${icon('tasks')}Activité & continuité</h3><dl class="activity-values"><div><dt>Tâches récurrentes</dt><dd><b>${c.occurrences}</b> occurrence ouverte</dd><small>${c.series} série(s)</small></div><div><dt>Continuité</dt><dd><b>${c.bia}</b> BIA <span>·</span> <b>${c.pcra}</b> PCRA</dd></div></dl></section>
  <section class="detail-pane gap-pane" aria-label="Écarts et actions"><h3>${icon('risk')}Écarts & actions</h3><p class="gap-line"><b>${c.gaps}</b> écarts ouverts <span class="${c.gapsLate?'danger':''}">${c.gapsLate} en retard</span></p><div class="classifs"><span>Majeurs <b>${c.id==='organisation'?2:0}</b></span><span>Mineurs <b>${c.id==='organisation'?3:c.gaps}</b></span><span>Sensibles <b>${c.id==='organisation'?2:0}</b></span></div><div class="actions-line"><span>Actions ouvertes <b>${c.actions}</b></span><span class="${c.late?'danger':''}">${c.late} en retard</span></div></section>
 </div>
 ${c.children?`<details class="subtotals"><summary><span>Total avec ${c.children} sous-périmètres</span><small>Sans doublon</small></summary><div class="subtotal-values"><span><b>12</b> actions ouvertes</span><span><b>9</b> écarts ouverts</span><span><b>3</b> BIA · <b>2</b> PCRA</span></div><p>Total de démonstration fourni séparément des cartes.</p></details>`:''}
 </div>`;
}
function card(c){
 const cov=coverage(c),isOpen=opened.has(c.id);
 return `<article class="node" id="node-${c.id}" data-id="${c.id}" data-current="${c.id===active}" data-open="${isOpen}" role="group" aria-label="Périmètre ${esc(c.name)}">
 <div class="node-main"><div class="node-identity"><header class="node-head"><span class="node-meta">${c.kind} · ${c.nature}</span>${c.id===active?'<span class="active-badge">Affiché</span>':''}</header><h2 class="node-title">${esc(c.name)}</h2></div>
 <dl class="node-metrics"><div class="coverage" title="${cov===null?'Couverture indisponible':`${c.tested} testées ou validées / ${c.applicable} applicables`}"><dt>${cov===null?'Indisponible':'Couverture'}</dt><dd>${cov===null?'—':cov+'<span class="pct">%</span>'}</dd></div><div><dt>Actions${c.late?`<i class="late-dot" title="${c.late} en retard" aria-label="${c.late} en retard"></i>`:''}</dt><dd>${fmt(c.actions)}</dd></div><div><dt>Écarts ouverts${c.gapsLate?`<i class="late-dot" title="${c.gapsLate} en retard" aria-label="${c.gapsLate} en retard"></i>`:''}</dt><dd>${fmt(c.gaps)}</dd></div></dl></div>
 ${isOpen?details(c):`<div id="details-${c.id}" hidden></div>`}
 <footer class="node-footer">
 <div class="footer-left">${isOpen?`<div class="admin-actions"><button data-detail="${c.id}">Détail</button><button data-admin="Modifier le périmètre" data-id="${c.id}">Modifier</button><button data-admin="Ajouter un enfant" data-id="${c.id}">Ajouter un enfant</button></div>`:c.mandatory?`<small class="warn">${icon('risk')}${c.mandatory} clauses à traiter</small>`:`<small>${c.children?c.children+' sous-périmètres':'Données propres au périmètre'}</small>`}</div>
 <button class="toggle" data-toggle="${c.id}" aria-expanded="${isOpen}" aria-controls="details-${c.id}" aria-label="${isOpen?'Replier':'Déplier'} la carte ${esc(c.name)}">${icon(isOpen?'minus':'plus')}</button>
 <div class="footer-right">${c.id!==active?`<button data-select="${c.id}">Afficher ${icon('open')}</button>`:'<span class="current-label">Périmètre affiché</span>'}</div>
 </footer></article>`;
}
function render(){
 document.getElementById('nodes').innerHTML=visible().map(card).join('');
 document.getElementById('providers').innerHTML=single?'':`<aside class="provider" id="provider"><small>${icon('external')}Fournisseur extérieur</small><strong>${provider.name}</strong></aside>`;
 document.querySelector('.map-title').innerHTML=icon('tree')+`${visible().length} périmètre${single?'':'s'} accessible${single?'':'s'}<small>${single?'Aucun lien hiérarchique':`${visible().length-1} liens hiérarchiques · 1 fournisseur extérieur`}</small>`;
 document.getElementById('list-scene').innerHTML=`<table class="scope-table"><thead><tr><th>Nom</th><th>Nature</th><th>Accès</th><th>Fuseau</th><th>Actions</th></tr></thead><tbody>${visible().map(c=>`<tr><td>${c.parent?'↳ ':''}${esc(c.name)}</td><td>${c.nature}</td><td>Instance</td><td>Europe/Paris</td><td><button data-select="${c.id}">${c.id===active?'Affiché':'Afficher'}</button></td></tr>`).join('')}</tbody></table>`;
 const ss=document.querySelectorAll('.summary-stat');
 ss[0].innerHTML=`<b>${single?10:12}</b> actions ouvertes<i class="late-dot" title="${single?1:2} en retard"></i>`;
 ss[2].innerHTML=`<b>${single?7:9}</b> écarts ouverts`;
 ss[3].innerHTML=`<b>${single?1:3}</b> BIA · <b>${single?1:2}</b> PCRA`;
 document.getElementById('collapse').disabled=opened.size===0;
 document.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);});
 updatePause();layout();
}
function layout(){
 if(view!=='graphe')return;
 const stage=document.getElementById('stage'),canvas=document.getElementById('canvas'),mobile=innerWidth<=680,list=visible();
 const widths={};
 for(const c of list){
  const width=mobile?Math.max(230,Math.min(opened.has(c.id)?620:260,stage.clientWidth-44)):opened.has(c.id)?620:260;
  const el=document.getElementById('node-'+c.id);el.style.width=width+'px';widths[c.id]=width;
 }
 const heights=Object.fromEntries(list.map(c=>[c.id,document.getElementById('node-'+c.id).offsetHeight]));
 const placements=[];let W,H;
 if(mobile){
  const right=Math.max(...list.map(c=>widths[c.id]+(c.parent?16:0)));let y=0;
  list.forEach(c=>{placements.push({c,x:(right-widths[c.id])/2+(c.parent?8:-8),y,w:widths[c.id],h:heights[c.id]});y+=heights[c.id]+26;});
  const left=Math.min(...placements.map(p=>p.x));placements.forEach(p=>p.x-=left);W=Math.max(...placements.map(p=>p.x+p.w));H=y-26;
 }else{
  const children=c=>list.filter(x=>x.parent===c.id);
  const spans={};
  const measure=c=>{const sub=children(c);return spans[c.id]=Math.max(widths[c.id],sub.reduce((sum,ch)=>sum+measure(ch),0)+Math.max(0,sub.length-1)*26);};
  const roots=list.filter(c=>!c.parent||!list.some(p=>p.id===c.parent));roots.forEach(measure);
  const levels={};const depth=c=>c.parent&&list.some(x=>x.id===c.parent)?1+depth(list.find(x=>x.id===c.parent)):0;
  list.forEach(c=>levels[depth(c)]=Math.max(levels[depth(c)]??0,heights[c.id]));
  const ys=[0];for(let i=1;i<=Math.max(...list.map(depth));i++)ys[i]=ys[i-1]+levels[i-1]+76;
  const place=(c,left)=>{const sub=children(c),area=spans[c.id];placements.push({c,x:left+(area-widths[c.id])/2,y:ys[depth(c)],w:widths[c.id],h:heights[c.id]});const total=sub.reduce((sum,ch)=>sum+spans[ch.id],0)+Math.max(0,sub.length-1)*26;let next=left+(area-total)/2;for(const child of sub){place(child,next);next+=spans[child.id]+26;}};
  let left=0;roots.forEach(c=>{place(c,left);left+=spans[c.id]+40;});W=Math.max(...placements.map(p=>p.x+p.w));H=Math.max(...placements.map(p=>p.y+p.h));
 }
 placements.forEach(p=>{const el=document.getElementById('node-'+p.c.id);el.style.left=p.x+'px';el.style.top=p.y+'px';});
 let supplierPlace=null;
 if(!single){
  const el=document.getElementById('provider'),attached=placements.find(p=>p.c.id===provider.linked);
  el.style.width='176px';
  if(mobile){supplierPlace={x:W-176,y:H+32,w:176,h:el.offsetHeight};H=supplierPlace.y+supplierPlace.h;}
  else{supplierPlace={x:W+40,y:attached.y+attached.h/2-el.offsetHeight/2,w:176,h:el.offsetHeight};W+=216;H=Math.max(H,supplierPlace.y+supplierPlace.h);}
  el.style.left=supplierPlace.x+'px';el.style.top=supplierPlace.y+'px';
 }
 const defs='<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path class="wire-tip" d="M0 0L10 5L0 10Z"/></marker></defs>';
 const links=placements.filter(p=>p.c.parent).map(p=>{const parent=placements.find(q=>q.c.id===p.c.parent);const d=mobile?`M${Math.min(parent.x,p.x)-9} ${parent.y+parent.h} V${p.y+p.h/2} H${p.x}`:`M${parent.x+parent.w/2} ${parent.y+parent.h} V${(parent.y+parent.h+p.y)/2} H${p.x+p.w/2} V${p.y}`;return `<path class="wire" d="${d}" marker-end="url(#arrow)"/><path class="wire wire-flow" d="${d}"/>`;}).join('');
 let external='';if(supplierPlace){const a=placements.find(p=>p.c.id===provider.linked),s=supplierPlace;const d=mobile?`M${a.x+a.w} ${a.y+a.h/2} H${W+10} V${s.y+s.h/2} H${s.x+s.w}`:`M${a.x+a.w} ${a.y+a.h/2} H${a.x+a.w+13} V${a.y-22} H${s.x-20} V${s.y+s.h/2} H${s.x}`;external=`<path class="wire-external" d="${d}"/>`;}
 const svg=document.getElementById('wires');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.innerHTML=defs+links+external;
 const scale=mobile?1:Math.min(1,(stage.clientWidth-46)/W),stageH=Math.max(mobile?H+48:(innerWidth>=1700?620:560),H*scale+60);
 stage.style.height=stageH+'px';canvas.style.width=W+'px';canvas.style.height=H+'px';canvas.style.top=Math.max(24,(stageH-H*scale)/2)+'px';canvas.style.transform=`translateX(-50%) translate(${pan.x}px,${pan.y}px) scale(${scale})`;
}
function updatePause(){document.getElementById('canvas').dataset.paused=String(paused);const b=document.getElementById('pause');b.setAttribute('aria-pressed',String(paused));b.innerHTML=icon(paused?'play':'pause')+`<span>${paused?'Reprendre le flux':'Mettre le flux en pause'}</span>`;}
function modal(title,body){document.getElementById('modal').innerHTML=`<header><h2 id="modal-title">${esc(title)}</h2><button class="modal-close" aria-label="Fermer">${icon('close')}</button></header>${body}`;document.getElementById('modal-veil').classList.add('open');document.getElementById('modal-veil').setAttribute('aria-hidden','false');document.querySelector('.modal-close').focus();}
const closeModal=()=>{document.getElementById('modal-veil').classList.remove('open');document.getElementById('modal-veil').setAttribute('aria-hidden','true');};
document.addEventListener('click',e=>{
 const t=e.target.closest('[data-toggle]');if(t){if(opened.has(t.dataset.toggle))opened.delete(t.dataset.toggle);else opened.add(t.dataset.toggle);pan={x:0,y:0};render();document.querySelector(`[data-toggle="${t.dataset.toggle}"]`)?.focus();return;}
 const s=e.target.closest('[data-select]');if(s){active=s.dataset.select;render();return;}
 const v=e.target.closest('[data-view]');if(v){view=v.dataset.view;document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));document.getElementById('graph-scene').hidden=view!=='graphe';document.getElementById('list-scene').style.display=view==='liste'?'block':'none';layout();return;}
 if(e.target.closest('[data-center]')){pan={x:0,y:0};layout();return;}
 if(e.target.closest('#collapse')){opened.clear();pan={x:0,y:0};render();return;}
 if(e.target.closest('#pause')){paused=!paused;updatePause();return;}
 if(e.target.closest('#theme')){const dark=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=dark?'dark':'light';document.querySelector('#theme span').textContent=dark?'Mode clair':'Mode sombre';return;}
 const a=e.target.closest('[data-admin]');if(a){const c=nodes.find(x=>x.id===a.dataset.id);modal(a.dataset.admin,`<label>Intitulé<input value="${esc(c?.name??'')}" readonly></label><label>Nature<input value="${esc(c?.nature??'SMSI')}" readonly></label><p class="modal-notice">Aperçu de l’action existante. La maquette ne crée ni ne modifie de périmètre.</p>`);return;}
 const d=e.target.closest('[data-detail]');if(d){const c=nodes.find(x=>x.id===d.dataset.detail);modal(c.name,`<p>Données propres au périmètre.</p>${details(c,true)}<p class="modal-notice">Données fictives de la proposition visuelle.</p>`);return;}
 if(e.target.closest('.modal-close')||e.target.id==='modal-veil')closeModal();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal();});
document.addEventListener('toggle',e=>{if(e.target.matches('.subtotals'))layout();},true);
const stage=document.getElementById('stage');stage.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||e.target.closest('.node,.provider')||e.button!==0)return;drag={x:e.clientX,y:e.clientY,px:pan.x,py:pan.y};stage.setPointerCapture(e.pointerId);stage.classList.add('dragging');});stage.addEventListener('pointermove',e=>{if(!drag)return;pan={x:drag.px+e.clientX-drag.x,y:drag.py+e.clientY-drag.y};layout();});stage.addEventListener('pointerup',()=>{drag=null;stage.classList.remove('dragging');});stage.addEventListener('pointercancel',()=>{drag=null;stage.classList.remove('dragging');});
addEventListener('resize',()=>{pan={x:0,y:0};layout();});
window.maquette={layout,open(id){opened.add(id);render();},closeAll(){opened.clear();render();},single(v){single=v;opened.clear();active='organisation';render();}};
window.maquette.preview=(id,expanded)=>{const previous=new Set(opened);if(expanded)opened.add(id);else opened.delete(id);const html=card(nodes.find(c=>c.id===id));opened.clear();previous.forEach(v=>opened.add(v));return html;};
render();document.fonts.ready.then(layout);
