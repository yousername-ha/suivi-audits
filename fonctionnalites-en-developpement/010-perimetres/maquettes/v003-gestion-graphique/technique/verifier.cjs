// NODE_PATH doit pointer vers une installation externe de Playwright si nécessaire.
// Servir la maquette sur http://127.0.0.1:18778 avant exécution.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1600,height:900}});const errors=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.goto('http://127.0.0.1:18778');
 assert.equal(await page.locator('[data-node]').count(),4);
 assert.equal(await page.locator('[data-node=B] .tag.inherited').count(),2);
 assert.equal(await page.locator('[data-node=C] .tag.inherited').count(),0);checks.push('4 cartes ; héritage explicite B ; référentiels locaux C');
 const topBefore=await page.locator('.top').boundingBox(),sideBefore=await page.locator('.sidebar').boundingBox();
 await page.locator('#main').evaluate(el=>el.scrollTop=300);
 assert.ok(await page.locator('#main').evaluate(el=>el.scrollTop>0));
 assert.deepEqual(await page.locator('.top').boundingBox(),topBefore);assert.deepEqual(await page.locator('.sidebar').boundingBox(),sideBefore);checks.push('défilement du contenu sans déplacement du menu ni du bandeau');
 await page.locator('#main').evaluate(el=>el.scrollTop=0);
 await page.locator('#context').selectOption('selection');
 await page.locator('[data-act=apply-scopes]').click();
 assert.equal(await page.locator('[data-module=plans] b').innerText(),'3');
 await page.locator('[data-module=plans]').click();
 assert.equal(await page.locator('.shared-list .reference-row').count(),3);
 assert.equal(await page.locator('.shared-list').getByText('Plan de remédiation — audit de surveillance',{exact:true}).count(),1);checks.push('union A+B : 3 plans distincts ; PA-01 commun compté une seule fois');
 const box=await page.locator('dialog').boundingBox();assert.ok(Math.abs(box.x+box.width/2-800)<2);assert.ok(box.y>=0&&box.y+box.height<=900);checks.push('fenêtre centrée et contenue dans le viewport');
 await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').evaluate(el=>el.open),false);
 await page.locator('.scope-banner [data-act=inherit]').click();await page.locator('#inherit-toggle').uncheck();
 assert.match(await page.locator('#inherit-preview').innerText(),/Aucun référentiel/);
 await page.locator('[data-act=save-inherit]').click();
 assert.equal(await page.locator('[data-node=B] .tag.inherited').count(),0);
 assert.match(await page.locator('[data-node=B]').innerText(),/Aucun référentiel/);
 assert.match(await page.locator('[data-node=A]').innerText(),/ISO 27001/);checks.push('désactivation de l’héritage B sans mutation des référentiels A');
 await page.locator('.page-heading [data-act=create]').click();
 await page.locator('#name').fill('<img src=x onerror=alert(1)>');
 await page.locator('[form=create-form]').click();
 assert.equal(await page.locator('[data-node]').count(),5);assert.equal(await page.locator('#canvas img').count(),0);
 assert.match(await page.locator('[data-node=N1]').innerText(),/<img src=x onerror=alert\(1\)>/);
 assert.equal(await page.locator('[data-node=N1] .tag.inherited').count(),2);checks.push('création en mémoire, héritage du parent, texte saisi échappé');
 await page.reload();assert.equal(await page.locator('[data-node]').count(),4);checks.push('rechargement : aucune persistance ni écriture métier');
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=390));
 assert.equal(await page.locator('.sidebar').isVisible(),false);
 await page.locator('#mobile-menu').click();assert.equal(await page.locator('.sidebar').isVisible(),true);
 await page.locator('#mobile-menu').click();
 const scroll=page.locator('.canvas-scroll');await scroll.evaluate(el=>el.scrollLeft=350);assert.ok(await scroll.evaluate(el=>el.scrollLeft>0));
 checks.push('390 px : menu repliable, graphique défilant sans débordement de page');
 assert.deepEqual(errors,[]);checks.push('aucune erreur JavaScript pendant les parcours');
 console.log(JSON.stringify({status:'PASS',checks},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
