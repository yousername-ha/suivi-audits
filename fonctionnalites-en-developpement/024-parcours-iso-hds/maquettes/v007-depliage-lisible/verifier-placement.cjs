const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});let count=0;try{
for(const mobile of [false,true]){
 const p=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:720},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});
 await p.goto('http://127.0.0.1:19120/fonctionnalites-en-developpement/024-parcours-iso-hds/maquettes/v007-depliage-lisible/index.html');
 assert.equal(await p.locator('.branch-toggle').first().evaluate(e=>getComputedStyle(e,'::before').width),'18px');count++;
 if(mobile){assert.equal(await p.locator('.branch-toggle').first().evaluate(e=>getComputedStyle(e).width),'40px');count++}
 const keys=await p.locator('[data-expand-branch]').evaluateAll(es=>es.map(e=>e.dataset.expandBranch));
 for(const selected of ['risk','treatment','hds-scope']){
  await p.locator(`[data-display="${selected}"]`).click();
  for(const key of keys){
   if(await p.locator(`[data-expand-branch="${key}"]`).getAttribute('aria-expanded')!=='true')await p.locator(`[data-expand-branch="${key}"]`).click();
   await p.locator('#sub-toggle').click();await p.evaluate(()=>window.dispatchEvent(new Event('resize')));await p.locator('#sub-toggle').click();
   await p.waitForTimeout(30);
   const errors=await p.evaluate(key=>{
    const layer=document.getElementById('children-'+key),errors=[],box=e=>e.getBoundingClientRect();
    if(layer.dataset.layout!=='ready')errors.push('placement non résolu');
    const children=[...layer.querySelectorAll('.child-node')],obstacles=[...document.querySelectorAll('.node-title,.branch-title,.compact-card,.root-node,.legend,.all-steps,.motion-indicator')].filter(e=>e.getClientRects().length);
    const overlap=(a,b)=>a.left<b.right-.5&&a.right>b.left+.5&&a.top<b.bottom-.5&&a.bottom>b.top+.5;
    children.forEach((c,i)=>{for(const o of [...obstacles,...children.slice(0,i)])if(overlap(box(c),box(o)))errors.push('enfant '+i+' / '+o.textContent.trim())});
    const text=[...obstacles,...layer.querySelectorAll('.child-label')];
    for(const [i,path]of [...layer.querySelectorAll('path')].entries()){
      const matrix=path.getScreenCTM(),length=path.getTotalLength();
      for(let s=0;s<=length;s+=2){const q=path.getPointAtLength(s),pt=new DOMPoint(q.x,q.y).matrixTransform(matrix);
        for(const o of text){const r=box(o);if(pt.x>r.left+.5&&pt.x<r.right-.5&&pt.y>r.top+.5&&pt.y<r.bottom-.5){errors.push('liaison '+i+' / '+o.textContent.trim());s=length+2;break}}
      }
    }return [...new Set(errors)];
   },key);
   assert.deepEqual(errors,[],`${mobile?'mobile':'desktop'} ${selected} / ${key}`);count++;
  }
 }
 await p.close();
}
fs.writeFileSync(path.join(__dirname,'verification-placement.json'),JSON.stringify({date:'2026-10-23',resultat:'reussi',nombre:count,description:'66 combinaisons : 11 branches × 3 cartes sélectionnées × bureau/tactile. Cercles et libellés enfants sans recouvrement ; liaisons échantillonnées tous les 2 px hors des textes ; diamètre visuel 18 px, cible tactile 40 px. Chromium, sans essai téléphone physique.'},null,2)+'\n');console.log(count+' contrôles de placement réussis');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
