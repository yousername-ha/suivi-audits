'use strict';
const {workshops, sources} = window.EBIOS_CONTENT;
const paths = {
home:'M3 11 12 3l9 8M5 10v11h5v-7h4v7h5V10',
shield:'m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z M8 12l3 3 5-6',
chart:'M4 20V4m0 16h17M8 16v-4m5 4V8m5 8V5',
check:'M8 4H4v16h16V9M8 11l4 4L21 4',
repeat:'M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5',
file:'M14 3H5v18h14V8zM14 3v5h5M8 12h8m-8 4h6',
network:'M9 3h6v6H9zM2 15h6v6H2zm14 0h6v6h-6zM12 9v3H5v3m7-3h7v3',
settings:'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6m-6 0v6',
scope:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 12h8m-4-4v8',
target:'M21 12a9 9 0 1 1-9-9m5 9a5 5 0 1 1-5-5m0 5 9-9m-5 0h5v5',
route:'M5 5h9a4 4 0 0 1 0 8h-4a4 4 0 0 0 0 8h9M3 3h4v4H3zm14 16h4v4h-4',
arrow:'M4 12h16m-6-6 6 6-6 6',
book:'M12 5C8 3 5 3 2 4v16c3-1 6-1 10 1 4-2 7-2 10-1V4c-3-1-6-1-10 1zm0 0v16',
external:'M14 3h7v7m0-7L10 14M10 4H4v16h16v-6',
people:'M9 7a3 3 0 1 0-6 0 3 3 0 0 0 6 0m12 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0M1 21v-4a5 5 0 0 1 10 0v4m2 0v-4a5 5 0 0 1 10 0v4'
};
const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.file}"/></svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const guide = sources.find(s=>s.id==='G');
const link = (s, label=s.label, page) => `<a class="sourcelink" href="${s.url}${page ? '#page='+page : ''}" target="_blank" rel="noopener noreferrer">${icon('book')}<span>${esc(label)}</span>${icon('external')}</a>`;
const key = 'astra-ebios-maquette-v3';
let notes = {};
try {const saved = JSON.parse(localStorage.getItem(key) || '{}'); if(saved && typeof saved==='object' && !Array.isArray(saved)) notes=saved;} catch (_) {}
let current = {workshop:0,step:0};
const content = document.querySelector('#content');
document.querySelectorAll('.navitem[data-icon]').forEach(n=>n.insertAdjacentHTML('afterbegin',icon(n.dataset.icon)));
function goto(w=0,s=0){ location.hash = w ? `atelier-${w}-etape-${s+1}` : 'parcours'; }
function stash(){document.querySelectorAll('[data-note]').forEach(n=>notes[n.dataset.note]=n.value);}
function overview(){
 document.querySelector('#title').textContent='Conduire votre étude EBIOS RM';
 document.querySelector('#subtitle').textContent='Un cadre commun pour analyser les risques et préparer les décisions avec les participants.';
 document.querySelector('#eyebrow').textContent='MÉTHODE ANSSI / PARCOURS GUIDÉ';
 document.querySelector('#crumbcurrent').textContent='Parcours guidé';
 content.innerHTML=`<div class="overviewhero"><div><div class="eyebrow">COMPRENDRE · ANALYSER · DÉCIDER</div><h2>Cinq ateliers pour construire<br>une analyse partagée.</h2><p>Du cadrage au traitement du risque, retrouvez les questions à examiner, les éléments à produire et les sources de la méthode.</p><button class="btn primary" data-go="1">Commencer par le cadrage ${icon('arrow')}</button></div><div class="loopgraphic" aria-label="Les cinq ateliers forment une démarche itérative"><div class="ring">${icon('repeat')}${workshops.map(w=>`<span class="bubble">${w.id}</span>`).join('')}</div><span class="looptext">DÉMARCHE<br>ITÉRATIVE</span></div></div><div class="overviewgrid">${workshops.map(w=>`<button class="overviewcard" data-go="${w.id}"><div class="iconbox">${icon(w.icon)}</div><div class="smalllabel">ATELIER ${w.id} · ${w.short.toUpperCase()}</div><h3>${w.title}</h3><p>${w.purpose}</p><span class="cardlink">Explorer l’atelier ${icon('arrow')}</span></button>`).join('')}</div><div class="overviewbottom"><div class="panel"><div class="smalllabel">UNE ANALYSE COMPLÉMENTAIRE</div><h3>Conformité et scénarios</h3><div class="inlinepath"><span>Socle de sécurité</span><i>+</i><span>Approche par scénarios</span></div><p>Le socle de sécurité et l’analyse des scénarios contribuent à une même démarche de gestion du risque.</p>${link(guide,'Guide ANSSI · articulation des approches, p. 4',6)}</div><div class="panel soft"><div class="smalllabel">DES ALLERS-RETOURS POSSIBLES</div><h3>Avancer, puis réexaminer</h3><p>Les travaux d’un atelier peuvent conduire à revoir les précédents. Les cycles sont à adapter au contexte de l’étude.</p>${link(guide,'Guide ANSSI · démarche et cycles, p. 6–11',8)}<p class="footnote">La navigation, les champs de notes et les schémas présentés sont une proposition d’interface.</p></div></div>`;
}
function workshop(w,s){
 const step=w.steps[s];
 document.querySelector('#title').textContent=w.title;
 document.querySelector('#subtitle').textContent=w.purpose;
 document.querySelector('#eyebrow').textContent=`ATELIER ${w.id} / ${w.short.toUpperCase()}`;
 document.querySelector('#crumbcurrent').textContent=`Atelier ${w.id}`;
 const diagramCaption = w.id===4 && s===0 ? 'Modèle proposé dans la fiche ANSSI ; adaptable à l’étude.' : 'Schéma de lecture · Éléments de votre étude à renseigner.';
 const stepRefs=[...new Set(step[6])].map(id=>sources.find(x=>x.id===id));
 content.innerHTML=`<div class="workgrid"><aside class="steplist"><h3>Dans cet atelier</h3>${w.steps.map((a,i)=>`<button class="stepbutton ${i===s?'on':''}" data-step="${i}" ${i===s?'aria-current="step"':''}><span class="letter">${String.fromCharCode(65+i)}</span><span>${esc(a[0])}</span></button>`).join('')}<button class="backoverview" data-go="0">← Vue d’ensemble</button><p class="footnote">Navigation libre entre les ateliers. Aucune validation automatique.</p></aside><article class="workspacepanel"><div class="stepcaption">REPÈRE ${String.fromCharCode(65+s)} · ${esc(step[0])}</div><h2>${esc(step[1])}</h2><p>${esc(step[2])}</p><div class="diagram"><div class="diagramhead"><strong>${icon(w.icon)} Lire le raisonnement</strong><span>ATELIER ${w.id}</span></div><div class="flow">${step[4].map((node,i)=>`${i?'<span class="flowarrow">→</span>':''}<div class="flownode">${icon([w.icon,'network',w.id===5?'shield':'target','shield'][i])}<strong>${esc(node)}</strong></div>`).join('')}</div><div class="diagramcaption">${esc(diagramCaption)}</div></div><div class="formtitle"><h3>Préparer les éléments de l’étude</h3><span class="smallbadge">NOTES LIBRES</span></div>${step[3].map((label,i)=>{const id=`a${w.id}s${s}f${i}`;return `<div class="field"><label for="${id}">${esc(label)}</label><textarea id="${id}" data-note="${id}" placeholder="À renseigner avec les participants de votre étude…">${esc(typeof notes[id]==='string'?notes[id]:'')}</textarea></div>`;}).join('')}<div class="savebar"><button class="btn primary" id="saveNotes">Enregistrer les notes</button><p id="saveStatus" role="status">Enregistrement local dans ce navigateur.</p></div><div class="pager"><button class="btn" data-prev>← ${s?'Étape précédente':'Vue d’ensemble'}</button><button class="btn" data-next>${s<w.steps.length-1?'Étape suivante':w.id<5?'Atelier suivant':'Revenir au parcours'} →</button></div></article><aside class="rightcolumn"><div class="panel"><div class="smalllabel">POUR DÉMARRER</div><h3>S’appuyer sur</h3><p>${esc(w.input)}</p></div><div class="panel"><div class="smalllabel">À L’ISSUE DE L’ATELIER</div><h3>Éléments à produire</h3>${w.outputs.map(o=>`<div class="output">${icon('file')}<span>${esc(o)}</span></div>`).join('')}</div><div class="panel soft"><div class="smalllabel">REPÈRES OFFICIELS</div><h3>Consulter la méthode</h3>${link(guide,`Guide ANSSI · p. ${step[5]}`,step[5]+2)}${stepRefs.map(x=>link(x)).join('')}<p class="helpnote">${esc(w.notice)}</p>${!stepRefs.some(x=>x.id===w.noticeRef)&&w.noticeRef!=='G'?link(sources.find(x=>x.id===w.noticeRef)) : ''}</div></aside></div><div class="noticebottom">${icon('repeat')} Les résultats peuvent conduire à réexaminer les autres ateliers. Les décisions et cotations restent à établir pour votre étude.</div>`;
 document.querySelector('#saveNotes').onclick=()=>{stash();try{localStorage.setItem(key,JSON.stringify(notes));document.querySelector('#saveStatus').textContent='Notes enregistrées localement. Aucune validation de l’étude.';}catch(_){document.querySelector('#saveStatus').textContent='Stockage indisponible : les notes restent dans cette page ouverte.';}};
 document.querySelector('[data-prev]').onclick=()=>s?goto(w.id,s-1):goto();
 document.querySelector('[data-next]').onclick=()=>s<w.steps.length-1?goto(w.id,s+1):w.id<5?goto(w.id+1):goto();
}
function render(){
 stash();
 if (window.renderVisual()) return;
 document.querySelector("#workshopNav").hidden=false;
 document.querySelector(".studybar").hidden=false;
 document.querySelectorAll("[data-view]").forEach(a=>a.classList.toggle("on",a.dataset.view==="parcours"));
 const match=location.hash.match(/^#atelier-([1-5])-etape-([1-6])$/);
 current={workshop:match?Number(match[1]):0,step:match?Number(match[2])-1:0};
 const w=workshops.find(a=>a.id===current.workshop);
 if(w) current.step=Math.min(current.step,w.steps.length-1);
 document.querySelector('#workshopNav').innerHTML=workshops.map(a=>`<button class="wbutton ${a.id===current.workshop?'on':''}" data-go="${a.id}" ${a.id===current.workshop?'aria-current="step"':''}><span class="num">${a.id}</span><span><small>${a.short}</small><strong>${a.title}</strong></span></button>`).join('');
 if(w) workshop(w,current.step);else overview();
 document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>goto(Number(b.dataset.go)));
 document.querySelectorAll('[data-step]').forEach(b=>b.onclick=()=>goto(current.workshop,Number(b.dataset.step)));
}
const dialog=document.querySelector('#sources');
document.querySelector('#sourceList').innerHTML=sources.filter(s=>s.id!=='F9').map(s=>link(s)).join('');
document.querySelector('#openSources span').innerHTML=icon('external');
document.querySelector('#openSources').onclick=()=>dialog.showModal();
document.querySelector('#closeSources').onclick=()=>dialog.close();
window.addEventListener('hashchange',()=>{render(); content.focus({preventScroll:true});});
window.addEventListener('input',e=>{if(e.target.matches('[data-note]'))document.querySelector('#saveStatus').textContent='Modifications non enregistrées.';});
render();
