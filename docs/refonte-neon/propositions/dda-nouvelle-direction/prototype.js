/* Maquette indépendante, données fictives. Aucun réseau ni stockage. */
const data=JSON.parse(document.getElementById('demo-data').textContent);
const names={ISO:'Clauses ISO 27001',A:'Annexe A',HDS:'HDS'};
const levels=['Total','Partiel','Insuffisant'];
let reference='A',filter='all',selected=null,lastTrigger=null;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const paths={
  dashboard:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  organisation:'M9 3h6v5H9z M3 16h6v5H3z M15 16h6v5h-6z M12 8v4 M6 16v-4h12v4',
  chart:'M4 19V9 M10 19V4 M16 19v-8 M22 19V6',
  risk:'M12 3 22 21H2Z M12 9v5 M12 17v1',
  shield:'M12 3 21 6v6c0 5-5 8-9 10-4-2-9-5-9-10V6Z M8 12l3 3 5-6',
  actions:'M3 6h3 M10 6h11 M3 12h3 M10 12h11 M3 18h3 M10 18h11',
  resilience:'M20 7a9 9 0 1 0 1 8 M20 3v5h-5 M12 7v5l3 2',
  document:'M6 3h8l4 4v14H6Z M14 3v5h4 M9 12h6 M9 16h6',
  settings:'M9 3h6l1 3 3 2 3 1v6l-3 1-2 3-2 3H9l-1-3-3-2-3-1V9l3-1 2-3Z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  pie:'M12 3v9h9 M9 3.5a9 9 0 1 0 11.5 11.5',
  check:'M5 12l4 4L19 6',
  open:'M5 12h14 M13 6l6 6-6 6',
  close:'M6 6l12 12 M18 6 6 18',
  info:'M12 8v.1 M12 11v6 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  list:'M6 5h14 M6 12h14 M6 19h14 M2 5h.1 M2 12h.1 M2 19h.1',
  link:'m9 15 6-6 M8 16l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0 M16 8l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0',
};
const icon=type=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[type]??paths.document}"/></svg>`;
const tones={Total:'#2bb18d',Partiel:'#efad55',Insuffisant:'#e47a6f','':'#d9d4e8'};
const tone=v=>v==='Total'?'ok':v==='Partiel'?'part':v==='Insuffisant'?'bad':'';
function stats(){
  const a=data[reference],app=a.filter(x=>x.app!=='non'),c={Total:0,Partiel:0,Insuffisant:0,'':0};
  app.forEach(x=>c[levels.includes(x.level)?x.level:'']++);
  return {total:a.length,app:app.length,na:a.length-app.length,c,pct:app.length?Math.round(c.Total*100/app.length):0,inc:a.filter(x=>x.incoherente).length};
}
function choice(m,key,fiche=false){
  const options=key==='app'?[['','À déterminer'],['oui','Oui'],['non','Non']]:[['','Non renseigné'],...levels.map(x=>[x,x])];
  if(m[key]&&!options.some(x=>x[0]===m[key]))options.push([m[key],m[key]]);
  const col=key==='app'?(m.app==='oui'?'ok':m.app==='non'?'excluded':''):tone(m.level);
  const label=key==='app'?'Applicabilité':'Niveau';
  return `<div class="choice"><select aria-label="${label} de ${esc(m.code)}" data-id="${esc(m.id)}" data-field="${key}" data-tone="${col}">${options.map(([v,l])=>`<option value="${esc(v)}"${m[key]===v?' selected':''}>${l}</option>`).join('')}</select></div>`;
}
function synthese(s){
  const ratio=v=>s.app?100*v/s.app:0,max=Math.max(1,...Object.values(s.c));
  const levelLabels=['Total','Partiel','Insuffisant','Non renseigné'];
  document.getElementById('kpis').innerHTML=`
  <article class="kpi"><div class="kpi-head"><span class="tile-icon">${icon('pie')}</span><div><h2>Niveaux déclarés</h2><small>Mise en œuvre des mesures</small></div></div>
    <div class="donut-layout"><div class="donut" role="img" aria-label="${s.pct} % de mesures applicables au niveau Total" style="--v1:${ratio(s.c.Total)}%;--v2:${ratio(s.c.Total+s.c.Partiel)}%;--v3:${ratio(s.c.Total+s.c.Partiel+s.c.Insuffisant)}%"><span class="donut-centre"><b>${s.pct}<span style="font-size:.5em;margin-left:1px">%</span></b><small>Niveau Total</small></span></div>
    <div class="legend">${['Total','Partiel','Insuffisant',''].map((n,i)=>`<div><i style="--tone:${tones[n]}"></i><span>${levelLabels[i]}</span><b>${s.c[n]}</b></div>`).join('')}</div></div>
    <div class="kpi-footer"><span>Mesures applicables</span><b>${s.app}</b></div></article>
  <article class="kpi"><div class="kpi-head"><span class="tile-icon">${icon('chart')}</span><div><h2>Mesures par niveau</h2><small>Répartition des déclarations</small></div></div>
    <div class="distribution">${['Total','Partiel','Insuffisant',''].map((n,i)=>`<div><span>${levelLabels[i]}</span><span class="bar"><i style="--width:${s.c[n]/max*100}%;--tone:${tones[n]}"></i></span><b>${s.c[n]}</b></div>`).join('')}</div>
    <div class="kpi-footer"><span>Référentiel</span><b>${names[reference]}</b></div></article>
  <article class="kpi"><div class="kpi-head"><span class="tile-icon green">${icon('shield')}</span><div><h2>Applicabilité</h2><small>Périmètre des mesures</small></div></div>
    <div class="coverage-number"><strong>${s.app}</strong><span>/ ${s.total}</span></div><div class="coverage-caption">mesures applicables</div>
    <div class="coverage-bar"><span style="--width:${s.total?s.app/s.total*100:0}%"></span></div><div class="coverage-line">${icon('document')}<b>${s.na}</b> mesure${s.na>1?'s':''} exclue${s.na>1?'s':''}</div></article>
  <article class="kpi"><div class="kpi-head"><span class="tile-icon orange">${icon('risk')}</span><div><h2>Points de vigilance</h2><small>Mesures à examiner</small></div></div>
    <div class="vigilance-number"><strong>${s.c.Insuffisant}</strong><span>mesures au niveau Insuffisant</span></div><div class="vigilance-meta"><div><small>Partielles</small><b>${s.c.Partiel}</b></div><div><small>Total avec écart ouvert</small><b>${s.inc}</b></div></div></article>`;
}
function row(m){
  const action=m.app==='non'?m.just:m.actions,first=m.docs.split('\n')[0]??'',iso=reference==='ISO';
  return `<article class="measure-row" role="listitem"><div class="identity"><span class="measure-code">${esc(m.code)}</span><button class="measure-title" data-open="${esc(m.id)}">${esc(m.title)}</button></div>
    <div><span class="choice-label">Applicable</span>${iso?'<span class="detail">Obligatoire</span>':choice(m,'app')}</div>
    <div><span class="choice-label">Mise en œuvre</span>${m.app==='non'?'<span class="detail">Exclue</span>':choice(m,'level')}</div>
    <div class="detail" data-empty="${!action}">${action?icon('actions'):''}<span>${esc(action)||'<span class="empty-mark">—</span>'}</span></div>
    <div class="detail" data-empty="${!first&&!m.url}">${first||m.url?icon('document'):''}<span>${esc(first)||'<span class="empty-mark">—</span>'}${m.docs.includes('\n')?' …':''}${m.url?`<br><a href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">Ouvrir le document</a>`:''}</span></div>
    <div class="gap-list" data-empty="${!m.ecarts.length&&!/tenacy/i.test(m.comment)}">${m.ecarts.map(e=>`<span class="gap-chip${e.type.startsWith('NC')?' bad':''}">${esc(e.id)}</span>`).join('')}${/tenacy/i.test(m.comment)?'<span class="gap-chip">Tenacy</span>':''}${!m.ecarts.length&&!/tenacy/i.test(m.comment)?'<span class="empty-mark">—</span>':''}</div>
    <button class="open-sheet" data-open="${esc(m.id)}" aria-label="Ouvrir la fiche ${esc(m.code)}">${icon('open')}</button></article>`;
}
function render(){
  const s=stats();
  document.getElementById('refs').innerHTML=Object.keys(names).map(k=>`<button data-ref="${k}" aria-pressed="${reference===k}">${names[k]}<strong>${data[k].length}</strong></button>`).join('');
  synthese(s);
  const filters=[['all','Toutes',s.total],...levels.map(x=>[x,x,s.c[x]]),['none','Non renseignées',s.c['']],['na','Exclues',s.na],['inc','Total avec écart ouvert',s.inc]];
  document.getElementById('filters').innerHTML=filters.map(([k,l,n])=>`<button class="filter" data-filter="${k}" aria-pressed="${filter===k}">${l}<b>${n}</b></button>`).join('');
  const list=data[reference].filter(m=>filter==='all'||filter==='na'&&m.app==='non'||filter==='inc'&&m.incoherente||filter==='none'&&m.app!=='non'&&!levels.includes(m.level)||levels.includes(filter)&&m.app!=='non'&&m.level===filter);
  document.getElementById('register-name').innerHTML='<span class="ref-dot" aria-hidden="true"></span>'+names[reference];
  document.getElementById('count').innerHTML=icon('list')+`<span><b>${list.length}</b> mesure${list.length>1?'s':''}</span>`;
  document.getElementById('rows').innerHTML=list.map(row).join('')||'<p class="table-empty">Aucune mesure.</p>';
  document.querySelectorAll('[data-icon]').forEach(el=>{el.innerHTML=icon(el.dataset.icon);});
  if(selected)renderSheet();
}
const field=(m,key,label,zone=false)=>`<label class="field">${label}${zone?`<textarea rows="2" data-id="${esc(m.id)}" data-field="${key}">${esc(m[key]??'')}</textarea>`:`<input data-id="${esc(m.id)}" data-field="${key}" value="${esc(m[key]??'')}">`}</label>`;
function renderSheet(){
  const m=data[reference].find(x=>x.id===selected);if(!m)return closeSheet();const iso=reference==='ISO';
  document.getElementById('sheet').innerHTML=`<header class="sheet-head"><span class="tile-icon">${icon('shield')}</span><div><span class="eyebrow">${names[reference]} · Fiche mesure</span><h2 id="sheet-title">${esc(m.code)} — ${esc(m.title)}</h2></div><button class="sheet-close" aria-label="Fermer la fiche">${icon('close')}</button></header>
    <div class="sheet-body"><div class="sheet-main"><section class="sheet-section"><h3>${icon('pie')}${iso?'Mise en œuvre de l’exigence':'Déclaration d’applicabilité'}</h3>${!iso&&m.req?`<p class="sheet-req">${esc(m.req.slice(0,600))}${m.req.length>600?'…':''}</p>`:''}
      <div class="form-grid">${!iso?`<div class="field">Applicable${choice(m,'app',true)}</div>`:''}<div class="field">${iso?'Niveau':'Mise en œuvre'}${choice(m,'level',true)}</div></div>
      ${!iso?field(m,'risk','Risques traités')+field(m,'just','Justification',true)+field(m,'actions','Actions',true):''}</section>
      <section class="sheet-section"><h3>${icon('document')}Documents et justificatifs</h3>${field(m,'docs','Documents associés',true)}${field(m,'url','Lien vers le document (URL ou chemin réseau)')}${m.url?`<a class="detail" href="${esc(m.url)}" target="_blank" rel="noopener noreferrer">Ouvrir le document</a>`:''}</section>
      <section class="sheet-section"><h3>${icon('actions')}Revue de la mesure</h3>${field(m,'comment',iso?'Commentaire':'Commentaire de la revue')}</section></div>
    <aside class="sheet-aside"><section class="sheet-section"><h3>${icon('info')}Repères</h3><dl class="sheet-meta"><div><dt>Référentiel</dt><dd>${names[reference]}</dd></div><div><dt>Niveau déclaré</dt><dd>${esc(m.level)||'Non renseigné'}</dd></div><div><dt>Applicabilité</dt><dd>${iso?'Obligatoire':m.app==='oui'?'Oui':m.app==='non'?'Non':'À déterminer'}</dd></div><div><dt>Écarts ouverts</dt><dd>${m.ecarts.length?m.ecarts.map(x=>esc(x.id)).join(' · '):'Aucun'}</dd></div></dl></section>
    <section class="sheet-section"><details ${m.refText?'open':''}><summary>Texte de référence${m.refText?'':' (à saisir depuis votre exemplaire)'}</summary>${field(m,'refText','Texte de référence',true)}</details></section><p class="sheet-note">Maquette · Les modifications restent dans cette page de démonstration.</p></aside></div>`;
  autosize();
}
function autosize(){document.querySelectorAll('textarea').forEach(el=>{el.style.height='auto';el.style.height=el.scrollHeight+'px';});}
function closeSheet(){selected=null;document.getElementById('overlay').classList.remove('open');document.getElementById('overlay').setAttribute('aria-hidden','true');document.body.style.overflow='';lastTrigger?.focus();}
document.addEventListener('click',event=>{
  const ref=event.target.closest('[data-ref]');if(ref){reference=ref.dataset.ref;filter='all';render();return;}
  const f=event.target.closest('[data-filter]');if(f){filter=f.dataset.filter;render();return;}
  const open=event.target.closest('[data-open]');if(open){lastTrigger=open;selected=open.dataset.open;document.getElementById('overlay').classList.add('open');document.getElementById('overlay').setAttribute('aria-hidden','false');document.body.style.overflow='hidden';renderSheet();document.querySelector('.sheet-close').focus();return;}
  if(event.target.closest('.sheet-close')||event.target.id==='overlay')closeSheet();
});
document.addEventListener('change',event=>{
  const el=event.target;if(!el.matches('[data-field]'))return;
  const m=data[reference].find(x=>x.id===el.dataset.id);if(!m)return;
  m[el.dataset.field]=el.value;render();
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&selected)closeSheet();});
document.addEventListener('input',event=>{if(event.target.matches('textarea'))autosize();});
render();
