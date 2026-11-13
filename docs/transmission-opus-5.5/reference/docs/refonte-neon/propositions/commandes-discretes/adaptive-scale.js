/* Échelle calendaire de maquette. Les occurrences du jeu restent inchangées. */
(() => {
  'use strict';
  const DAY=86400000;
  const stamp=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)?Date.parse(d+'T00:00:00Z'):NaN;
  const monday=n=>n-((new Date(n).getUTCDay()+6)%7)*DAY;
  const year=n=>new Date(n).getUTCFullYear();
  const jan=y=>Date.UTC(y,0,1);
  const LABELS={day:'Journalier',week:'Hebdomadaire',month:'Mensuel',year:'Annuel'};
  const unitOf=s=>['day','week','month','year'].includes(s?.unit)?s.unit:'day';
  const weekNumber=n=>{const d=new Date(n);d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));return Math.ceil((((d-jan(d.getUTCFullYear()))/DAY)+1)/7);};
  const fr=(n,options)=>new Date(n).toLocaleDateString('fr-FR',{...options,timeZone:'UTC'});
  const span=(start,end,full,short)=>({start,end,full,short});

  function resolve(items,api){
    const {state,data}=api;
    const today=stamp(data.date),focus=data.series.find(s=>s.id===state.timelineFocus)||null;
    const relevant=focus?[focus]:data.series.filter(s=>items.some(o=>o.seriesId===s.id));
    const order=['day','week','month','year'];
    const inferred=relevant.length?order.find(u=>relevant.some(s=>unitOf(s)===u)):'day';
    const chosen=LABELS[state.timelineScale]?state.timelineScale:'auto';
    const unit=chosen==='auto'?inferred:chosen;
    let start,end;
    const explicit=state.timelineStart;
    if(unit==='day'||unit==='week'){
      const days=unit==='day'?14:84;
      start=explicit??monday(today-(days/2)*DAY);end=start+days*DAY;
    }else{
      const count=unit==='month'?1:5;
      start=explicit??jan(year(today)-(unit==='year'?2:0));end=jan(year(start)+count);
    }
    if(state.timelineFitAll){
      const dates=items.flatMap(o=>[stamp(o.start),stamp(o.due)]).filter(Number.isFinite);
      const first=Math.min(today,...dates),last=Math.max(today,...dates);
      if(unit==='day'||unit==='week'){
        start=monday(first-3*DAY);end=start+Math.max(14,Math.ceil((last+5*DAY-start)/DAY/7)*7)*DAY;
      }else{
        start=jan(Math.min(year(first),year(start)));end=jan(Math.max(year(last)+1,year(end)));
      }
    }
    const days=Math.round((end-start)/DAY),ticks=[],bands=[];
    if(unit==='day'||unit==='week'){
      const step=unit==='day'?Math.max(1,Math.ceil(days/14)):7*Math.max(1,Math.ceil(days/84));
      for(let n=start;n<end;n+=step*DAY){
        ticks.push(span(n,Math.min(end,n+step*DAY),unit==='day'?fr(n,{weekday:'short',day:'2-digit'}):`S${weekNumber(n)} · ${fr(n,{day:'numeric',month:'short'})}`,unit==='day'?fr(n,{day:'2-digit'}):`S${weekNumber(n)}`));
      }
      for(let n=start;n<end;){const d=new Date(n),next=Math.min(end,Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1));bands.push(span(n,next,fr(n,{month:'long',year:'numeric'})));n=next;}
    }else if(unit==='month'){
      for(let n=start;n<end;){const d=new Date(n),next=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1);ticks.push(span(n,next,fr(n,{month:'long'}),fr(n,{month:'2-digit'})));n=next;}
      for(let y=year(start);y<year(end);y++)bands.push(span(jan(y),jan(y+1),String(y)));
    }else{
      for(let y=year(start);y<year(end);y++)ticks.push(span(jan(y),jan(y+1),String(y),String(y)));
      bands.push(span(start,end,`${year(start)} — ${year(end-DAY)}`));
    }
    const fullRange=year(start)===year(end-DAY)
      ?`${fr(start,{day:'numeric',month:'short'})} — ${fr(end-DAY,{day:'numeric',month:'short',year:'numeric'})}`
      :`${fr(start,{day:'numeric',month:'short',year:'numeric'})} — ${fr(end-DAY,{day:'numeric',month:'short',year:'numeric'})}`;
    return {unit,chosen,start,end,days,ticks,bands,focus,fullRange,inferred,emptyMessage:focus&&!focus.active?'Cette série est en pause. Aucune occurrence générée n’est présente dans ce jeu.':'Aucune occurrence dans cette période. Les autres échéances restent accessibles ci-dessous.'};
  }
  function tickMarkup(scale,E){
    return scale.ticks.map(t=>`<span style="width:${(t.end-t.start)/(scale.days*DAY)*100}%" title="${E(t.full)}"><b class="scale-tick-full">${E(t.full)}</b><b class="scale-tick-short">${E(t.short)}</b></span>`).join('');
  }
  function bandMarkup(scale,E){return scale.bands.map(t=>`<span style="width:${(t.end-t.start)/(scale.days*DAY)*100}%">${E(t.full)}</span>`).join('');}
  function grid(scale,today){
    const x=n=>(n-scale.start)/(scale.days*DAY)*100;
    const lines=scale.ticks.slice(1).map(t=>`<i class="scale-boundary" style="left:${x(t.start)}%"></i>`).join('');
    const weekends=scale.unit==='day'||scale.unit==='week'?Array.from({length:scale.days},(_,i)=>scale.start+i*DAY).filter(n=>[0,6].includes(new Date(n).getUTCDay())).map(n=>`<i class="frise-weekend" style="left:${x(n)}%;width:${100/scale.days}%"></i>`).join(''):'';
    return `<div class="frise-grid scale-grid" aria-hidden="true">${lines}${weekends}${today>=scale.start&&today<scale.end?`<i class="frise-now-line" style="left:${x(today)}%"></i>`:''}</div>`;
  }
  function choices(scale){return `<div class="frise-zoom adaptive-zoom" aria-label="Échelle de la Timeline"><button data-scale="auto" aria-pressed="${scale.chosen==='auto'}">Auto</button>${Object.entries(LABELS).map(([id,label])=>`<button data-scale="${id}" aria-pressed="${scale.chosen===id}">${label}</button>`).join('')}</div>`;}
  function context(scale,api){
    const {data,E}=api;
    const count=scale.unit==='day'?`${scale.days} jours`:scale.unit==='week'?`${Math.ceil(scale.days/7)} semaines`:scale.unit==='month'?`${scale.ticks.length} mois`:`${scale.ticks.length} ans`;
    return `<div class="scale-context"><label for="timeline-series-focus">Série à suivre<select id="timeline-series-focus" data-focus-series><option value="">Toutes les séries</option>${data.series.map(s=>`<option value="${E(s.id)}" ${scale.focus?.id===s.id?'selected':''}>${E(s.name)} · ${E(s.rhythm)}${s.active?'':' · En pause'}</option>`).join('')}</select></label><div class="scale-caption"><span class="scale-mode">${scale.chosen==='auto'?'Auto · ':''}${LABELS[scale.unit]}</span><span>${scale.chosen==='auto'?'Adaptée à la périodicité affichée':'Échelle choisie'} · ${count}</span></div></div>`;
  }
  function navigate(current,action,value){
    const {state}=current;
    if(action==='scale'){state.timelineScale=LABELS[value]?value:'auto';state.timelineStart=null;state.timelineFitAll=false;return;}
    if(action==='focus'){state.timelineFocus=value||null;state.timelineScale='auto';state.timelineStart=null;state.timelineFitAll=false;state.expanded=null;return;}
    const scale=resolve(current.items||[],current);
    if(value==='today'){state.timelineStart=null;state.timelineFitAll=false;}
    else if(value==='all'){state.timelineFitAll=true;}
    else{
      state.timelineFitAll=false;
      const direction=value==='prev'?-1:1;
      state.timelineStart=scale.unit==='month'||scale.unit==='year'?jan(year(scale.start)+direction*(year(scale.end)-year(scale.start))):scale.start+direction*scale.days*DAY;
    }
  }
  window.STUDIO_SCALE={resolve,tickMarkup,bandMarkup,grid,choices,context,navigate};
})();
