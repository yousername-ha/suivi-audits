/* Mise en page de la maquette uniquement ; aucune connexion à l'application. */
(() => {
  const scope = document.querySelector('.scope-line');
  const context = document.createElement('div');
  context.className = 'context-line';
  scope.before(context);
  context.append(scope, document.querySelector('.quiet-meta'));
  const tabs=document.querySelector('.page-tabs');
  const tabAnchor=document.createComment('Position habituelle des rubriques');tabs.before(tabAnchor);
  function placeTabs(){if(innerWidth>=1100&&innerHeight<=850){document.querySelector('.topbar > strong').after(tabs);tabs.classList.add('tabs-in-topbar');}else{tabAnchor.after(tabs);tabs.classList.remove('tabs-in-topbar');}}
  window.addEventListener('resize',placeTabs);placeTabs();
  const registry = document.querySelector('#registry');
  const months={'janvier':'janv.','février':'févr.','mars':'mars','avril':'avr.','mai':'mai','juin':'juin','juillet':'juil.','août':'août','septembre':'sept.','octobre':'oct.','novembre':'nov.','décembre':'déc.'};
  function shortMonths(){registry.querySelectorAll('.frise-months > span').forEach(e=>{e.dataset.fullMonth ||= e.textContent;e.title=e.dataset.fullMonth;e.textContent=innerWidth<=700?e.dataset.fullMonth.replace(/janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre/gi,m=>months[m.toLowerCase()]):e.dataset.fullMonth;});}
  window.addEventListener('resize',shortMonths);
  const names = {timeline:'Timeline',list:'Liste compacte',kanban:'Kanban',calendar:'Calendrier',gantt:'Planning',dashboard:'Synthèse'};
  const trigger=document.createElement('button');
  trigger.type='button';trigger.className='mobile-view-trigger';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-controls','mobile-view-panel');
  document.querySelector('.view-cluster').append(trigger);
  const menu=document.createElement('div');menu.className='flyout mobile-view-panel';menu.id='mobile-view-panel';menu.hidden=true;menu.setAttribute('role','dialog');menu.setAttribute('aria-label','Choisir la vue');document.body.append(menu);
  let open=false;
  function close(restore=false){open=false;menu.hidden=true;trigger.setAttribute('aria-expanded','false');if(restore)trigger.focus({preventScroll:true});}
  function position(){if(!open)return;const r=trigger.getBoundingClientRect();menu.style.left=Math.max(12,Math.min(innerWidth-menu.offsetWidth-12,r.left))+'px';menu.style.top=Math.max(12,Math.min(innerHeight-menu.offsetHeight-12,r.bottom+8))+'px';}
  trigger.onclick=()=>{if(open){close(true);return;}open=true;menu.hidden=false;trigger.setAttribute('aria-expanded','true');position();menu.querySelector('[aria-pressed=true]')?.focus({preventScroll:true});};
  document.addEventListener('pointerdown',e=>{if(open&&!menu.contains(e.target)&&!trigger.contains(e.target))close();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open){e.preventDefault();close(true);}});
  window.addEventListener('resize',()=>{if(innerWidth>700)close();else position();});
  function hint() {
    const board = registry.querySelector('.frise-board');
    if (board && !registry.querySelector('.pan-hint')) {
      const text = document.createElement('p');
      text.className = 'pan-hint';
      text.textContent = '↔ Faites glisser la frise pour parcourir les dates';
      board.before(text);
    }
    const state=window.STUDIO_DEMO.state;
    const active=document.querySelector(`#views [data-view="${state.view}"]`);
    const glyph=active?.querySelector('svg')?.outerHTML||'';
    trigger.innerHTML=glyph+`<span>${names[state.view]}</span>`;trigger.setAttribute('aria-label','Changer de vue : '+names[state.view]);
    menu.replaceChildren();
    document.querySelectorAll('#views button').forEach(source=>{const choice=document.createElement('button');choice.type='button';choice.className='mobile-view-choice';choice.innerHTML=(source.querySelector('svg')?.outerHTML||'')+names[source.dataset.view];choice.setAttribute('aria-pressed',String(state.view===source.dataset.view));choice.onclick=()=>{source.click();close(true);};menu.append(choice);});
    const tools=registry.querySelector('.frise-tools');
    if(tools&&!tools.querySelector('.mobile-period-input')){
      const select=document.createElement('select');select.className='mobile-period-input';select.setAttribute('aria-label','Période de la Timeline');
      const choices=[...tools.querySelectorAll('.frise-zoom button')];
      choices.forEach((b,i)=>{const opt=document.createElement('option');opt.value=String(i);opt.textContent=b.textContent;opt.selected=b.getAttribute('aria-pressed')==='true';select.append(opt);});
      select.onchange=()=>{choices[Number(select.value)].click();requestAnimationFrame(()=>registry.querySelector('.mobile-period-input')?.focus({preventScroll:true}));};tools.append(select);
      const all=tools.querySelector('[data-period=all]');if(all){all.dataset.fullLabel=all.textContent;all.setAttribute('aria-label','Tout afficher');}
    }
    registry.querySelectorAll('.identity-text>.frise-sub').forEach(e=>e.title=e.textContent.trim());
    shortMonths();
  }
  new MutationObserver(hint).observe(registry, {childList: true});
  hint();
})();
