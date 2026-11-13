/* Animation décorative de la maquette : aucune progression métier représentée. */
(() => {
  'use strict';
  const ns='http://www.w3.org/2000/svg',reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let cachedSvg=null,streams=[],elapsed=0,lastTick=0;
  function node(tag,attrs){const el=document.createElementNS(ns,tag);for(const [name,value]of Object.entries(attrs))el.setAttribute(name,String(value));return el;}
  function rebuild(){
    const svg=document.querySelector('.pi-wires'),model=window.PARTIES_LIAISONS;
    if(!svg||!model){cachedSvg=null;streams=[];return;}
    if(svg===cachedSvg&&svg.querySelector('.pi-flow-layer'))return;
    cachedSvg=svg;streams=[];
    const layer=node('g',{'class':'pi-flow-layer','aria-hidden':'true'});
    for(const side of ['internal','external']){
      const routes=model.routes.filter(r=>r.side===side),outlet=routes.find(r=>r.role==='outlet'),feed=routes.find(r=>r.role==='feed');
      if(!outlet)continue;
      const paths=[];
      for(const branch of routes.filter(r=>r.role==='branch')){
        const points=[...outlet.points];
        if(feed&&Math.abs(branch.points[0][0]-outlet.points[1][0])>.1)points.push(feed.points[0],[branch.points[0][0],feed.points[0][1]]);
        points.push(branch.points[0],branch.points[1]);
        const d=points.map(([x,y],i)=>`${i?'L':'M'}${x} ${y}`).join(' ');
        const path=node('path',{d});layer.append(path);paths.push({path,id:branch.target});
      }
      const dot=node('circle',{'class':'pi-flow-dot',r:2.7,cx:outlet.points[0][0],cy:outlet.points[0][1]});layer.append(dot);
      streams.push({side,paths,dot,offset:side==='external'?1100:0});
    }
    svg.append(layer);
  }
  function frame(now){
    const dt=lastTick?Math.min(now-lastTick,100):0;lastTick=now;
    const playing=!reduce.matches&&!document.hidden&&document.documentElement.dataset.motion!=='off';
    if(playing)elapsed+=dt;
    for(const stream of streams){
      if(!stream.paths.length)continue;
      const time=elapsed+stream.offset,cycle=Math.floor(time/4400),phase=time%4400;
      const current=stream.paths[cycle%stream.paths.length];
      const p=current.path.getPointAtLength(current.path.getTotalLength()*Math.min(1,phase/3800));
      stream.dot.setAttribute('cx',p.x.toFixed(2));stream.dot.setAttribute('cy',p.y.toFixed(2));
      stream.dot.setAttribute('opacity',phase<3800?'1':'0');stream.dot.dataset.target=current.id;
    }
    requestAnimationFrame(frame);
  }
  new MutationObserver(rebuild).observe(document.querySelector('#pi-content'),{childList:true,subtree:true});
  rebuild();requestAnimationFrame(frame);
  window.PARTIES_FLUX={snapshot:()=>({elapsed,streams:streams.length,playing:!reduce.matches&&!document.hidden&&document.documentElement.dataset.motion!=='off'})};
})();
