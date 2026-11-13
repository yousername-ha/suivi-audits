/* Proposition autonome : commandes déplacées dans la maquette, jamais dans l'application. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const path = {
    search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
    filter:'<path d="M4 6h16M7 12h10M10 18h4"/>',
    more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    close:'<path d="m6 6 12 12M6 18 18 6"/>',
    chart:'<path d="M4 4v16h16M8 15v-4M12 15V7M16 15V9"/>',
    moon:'<path d="M20 14A9 9 0 0 1 10 3a9 9 0 1 0 10 18 9 9 0 0 0 0-7"/>',
  };
  const icon = name => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path[name]||path.filter}</svg>`;
  const esc = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const views = {timeline:'Timeline',list:'Liste compacte',kanban:'Kanban',calendar:'Calendrier',gantt:'Planning / Gantt',dashboard:'Synthèse'};
  const box = document.createElement('div');
  box.className='compact-toolbar';
  box.innerHTML=`<div class="view-cluster"><div id="view-slot"></div><span id="active-view" class="active-view-label">Timeline</span></div><div class="toolbar-actions"><button class="utility" id="search-trigger" type="button" aria-label="Rechercher" aria-haspopup="dialog" aria-expanded="false" aria-controls="search-flyout" data-hint="Rechercher · /"><span>${icon('search')}</span></button><button class="utility filter-trigger" id="filter-trigger" type="button" aria-label="Filtres" aria-haspopup="dialog" aria-expanded="false" aria-controls="filter-flyout">${icon('filter')}<span class="filter-word">Filtres</span><b class="filter-count" id="filter-count" hidden></b></button><button class="utility" id="more-trigger" type="button" aria-label="Options d’affichage" aria-haspopup="dialog" aria-expanded="false" aria-controls="more-flyout" data-hint="Options d’affichage">${icon('more')}</button></div>`;
  const viewList=$('#views');viewList.before(box);$('#view-slot').replaceWith(viewList);viewList.setAttribute('role','group');
  const active=document.createElement('div');active.id='active-filters';active.className='active-filters';active.hidden=true;box.after(active);active.after($('#overview'));$('#toggle-summary').hidden=true;
  const subviews=$('#subviews');const sub=document.createElement('div');sub.className='compact-subviews';sub.append(subviews);box.before(sub);
  const searchLabel=$('#search').closest('label'), searchInput=$('#search');searchInput.setAttribute('form','filters');
  const searchPanel=document.createElement('div');searchPanel.id='search-flyout';searchPanel.className='flyout search-flyout';searchPanel.hidden=true;searchPanel.setAttribute('role','dialog');searchPanel.setAttribute('aria-label','Recherche');
  searchPanel.innerHTML=`<label for="search">${icon('search')}<span class="sr-only">Rechercher</span></label><small>Recherche dans les intitulés et références <kbd>Échap</kbd></small>`;searchPanel.querySelector('label').append(searchInput);searchLabel.remove();document.body.append(searchPanel);
  const filterPanel=document.createElement('div');filterPanel.id='filter-flyout';filterPanel.className='flyout';filterPanel.hidden=true;filterPanel.setAttribute('role','dialog');filterPanel.setAttribute('aria-labelledby','filter-title');
  filterPanel.innerHTML=`<header class="flyout-heading"><h2 id="filter-title">Affiner la vue</h2><button type="button" class="close-flyout" aria-label="Fermer les filtres">${icon('close')}</button></header><div class="filter-content"></div><footer class="flyout-footer"><span id="filter-results"></span><button type="button" id="apply-filters" class="button primary">Afficher les résultats</button></footer>`;
  const advanced=document.createElement('details');advanced.className='advanced-filters';advanced.innerHTML='<summary>Plus d’options</summary>';advanced.append($('.registry-toolbar'));
  advanced.querySelector('#closed').setAttribute('form','filters');
  filterPanel.querySelector('.filter-content').append($('#filters'),advanced);
  const seriesSlot=document.createElement('div');seriesSlot.className='series-filter-field';seriesSlot.hidden=true;advanced.before(seriesSlot);
  filterPanel.querySelectorAll('.filters>label>span.sr-only').forEach(e=>e.className='field-label');document.body.append(filterPanel);
  const morePanel=document.createElement('div');morePanel.id='more-flyout';morePanel.className='flyout more-flyout';morePanel.hidden=true;morePanel.setAttribute('role','dialog');morePanel.setAttribute('aria-label','Options d’affichage');
  const motion=$('#motion');motion.className='menu-choice';morePanel.append(motion);morePanel.insertAdjacentHTML('beforeend',`<button type="button" class="menu-choice" id="more-summary">${icon('chart')}Synthèse du périmètre</button>`);document.body.append(morePanel);
  let opened=null;
  const triggerFor = panel => panel===searchPanel?$('#search-trigger'):panel===filterPanel?$('#filter-trigger'):$('#more-trigger');
  function close(restore=false){if(!opened)return;const trigger=triggerFor(opened);opened.hidden=true;trigger.setAttribute('aria-expanded','false');opened=null;if(restore)trigger.focus();}
  function position(){if(!opened)return;const rect=triggerFor(opened).getBoundingClientRect();const width=opened.getBoundingClientRect().width;opened.style.left=Math.max(14,Math.min(window.innerWidth-width-14,rect.right-width))+'px';opened.style.top=Math.min(rect.bottom+9,Math.max(14,window.innerHeight-opened.offsetHeight-14))+'px';}
  function fitRegistry(){const registry=$('#registry');registry.style.maxHeight=window.innerWidth>=1100?Math.max(240,Math.min(570,window.innerHeight-registry.getBoundingClientRect().top-90))+'px':'';}
  function toggle(panel){if(opened===panel){close(true);return;}close();opened=panel;panel.hidden=false;triggerFor(panel).setAttribute('aria-expanded','true');position();(panel.querySelector('input,select,button'))?.focus({preventScroll:true});}
  $('#search-trigger').onclick=()=>toggle(searchPanel);$('#filter-trigger').onclick=()=>toggle(filterPanel);$('#more-trigger').onclick=()=>toggle(morePanel);
  filterPanel.querySelector('.close-flyout').onclick=()=>close(true);$('#apply-filters').onclick=()=>close(true);
  function toggleSummary(){const b=$('#views button[data-view=dashboard]');if(b)b.click();}
  $('#toggle-summary').onclick=toggleSummary;$('#more-summary').onclick=()=>{toggleSummary();close(true);};
  document.addEventListener('pointerdown',e=>{if(opened&&!opened.contains(e.target)&&!triggerFor(opened).contains(e.target))close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&opened){e.preventDefault();close(true);}else if(e.key==='/'&&!e.target.closest('input,textarea,select')){e.preventDefault();if(opened!==searchPanel)toggle(searchPanel);searchInput.focus();}});
  window.addEventListener('resize',()=>{fitRegistry();position();});window.addEventListener('scroll',position,{passive:true});
  advanced.addEventListener('toggle',position);
  searchInput.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();close(true);}});
  const labelFor = id => $('#'+id).selectedOptions?.[0]?.textContent || $('#'+id).value;
  function sync(){
    const {state,data}=window.STUDIO_DEMO;
    const seriesInput=$('#registry [data-focus-series]');
    if(seriesInput){const label=document.createElement('label');label.innerHTML='<span class="field-label">Série</span>';seriesInput.setAttribute('form','filters');label.append(seriesInput);seriesSlot.replaceChildren(label);}
    seriesSlot.hidden=state.page!=='recurrences';
    const seriesSelect=seriesSlot.querySelector('select');if(seriesSelect)seriesSelect.value=state.timelineFocus||'';
    document.querySelectorAll('.frise-control-tower').forEach(t=>{let label=t.querySelector('.tower-label');if(!label){label=document.createElement('span');label.className='tower-label';t.append(label);}label.textContent=state.page==='actions'?'Actions / responsables':'Contrôles / responsables';t.setAttribute('aria-label',label.textContent);});
    viewList.querySelectorAll('button[data-view]').forEach(b=>{b.setAttribute('aria-label',views[b.dataset.view]);b.dataset.hint=views[b.dataset.view];});
    $('#overview').hidden=state.view!=='dashboard';
    $('#active-view').textContent=views[state.view];sub.hidden=!subviews.children.length;
    const filters=[];
    if(searchInput.value)filters.push(['search','Recherche : '+searchInput.value]);
    for(const id of ['plan','owner','status'])if($('#'+id).value)filters.push([id,labelFor(id)]);
    if(state.page==='recurrences'&&state.timelineFocus)filters.push(['series','Série : '+(data.series.find(s=>s.id===state.timelineFocus)?.name||state.timelineFocus)]);
    if(!$('#closed').checked)filters.push(['closed',state.page==='recurrences'?'Occurrences en attente':'Actions ouvertes']);
    if(state.quick!=='all'){const selected=$('#quick-filters button[aria-pressed=true]');if(selected)filters.push(['quick',selected.textContent.replace(/\d+$/,'').trim()]);}
    const count=filters.length;
    $('#filter-count').hidden=!count;$('#filter-count').textContent=count;
    $('#filter-trigger').classList.toggle('is-active',count>0);$('#filter-trigger').setAttribute('aria-label',count?`Filtres · ${count} actif${count>1?'s':''}`:'Filtres');
    $('#search-trigger').classList.toggle('is-active',!!searchInput.value);
    active.hidden=!count;
    active.innerHTML=filters.map(([id,label])=>`<button class="active-filter" data-remove-filter="${id}"${id==='status'&&$('#status').value==='todo'?' data-tone="amber"':''}><span>${esc(label)}</span>${icon('close')}<span class="sr-only">Retirer ce filtre</span></button>`).join('')+(count?'<button class="clear-filters" id="clear-filters" type="button">Tout effacer</button>':'');
    $('#filter-results').textContent=$('#result-count').textContent;
    const all=state.page==='actions'?data.actions:(state.sub==='series'?data.series:data.occurrences);
    const pending=all.filter(o=>!o.validation&&!['done','cancelled'].includes(o.status));
    const late=pending.filter(o=>o.due&&o.due<data.date);
    $('#mini-stats').innerHTML=`<span><b>${all.length}</b> ${state.page==='actions'?'actions':state.sub==='series'?'séries':'occurrences'}</span><span><i class="mini-dot amber"></i><b>${pending.length}</b> ${state.page==='actions'?'ouvertes':'en attente'}</span><span><i class="mini-dot red"></i><b>${late.length}</b> en retard</span>`;
    fitRegistry();
  }
  active.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='clear-filters')$('#filters').reset();else{const id=b.dataset.removeFilter;if(id==='quick'){$('#quick-filters button[data-quick=all]')?.click();}else if(id==='series'){const input=seriesSlot.querySelector('select');input.value='';input.dispatchEvent(new Event('change',{bubbles:true}));}else if(id==='closed'){$('#closed').checked=true;$('#closed').dispatchEvent(new Event('change',{bubbles:true}));}else{const input=$('#'+id);input.value='';input.dispatchEvent(new Event(id==='search'?'input':'change',{bubbles:true}));}}requestAnimationFrame(sync);});
  document.addEventListener('input',()=>requestAnimationFrame(sync));document.addEventListener('change',()=>requestAnimationFrame(sync));$('#filters').addEventListener('reset',()=>requestAnimationFrame(sync));
  new MutationObserver(sync).observe($('#registry'),{childList:true});
  sync();
  window.COMMANDES_DEMO={sync,close};
})();
