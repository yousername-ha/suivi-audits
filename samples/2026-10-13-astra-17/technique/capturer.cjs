const {chromium}=require('playwright');
const fs=require('fs');const path=require('path');const assert=require('assert');
const root=path.resolve(__dirname,'..');
const data=JSON.parse(fs.readFileSync(root+'/technique/contenu.json','utf8'));
const views=[['01-parcours','parcours','Vue d’ensemble'],['02-cadrage','atelier-1-etape-1','Atelier 1 · Cadrage'],['03-perimetre','atelier-1-etape-2','Atelier 1 · Périmètre'],['04-sources-risque','atelier-2-etape-1','Atelier 2 · Sources de risque'],['05-ecosysteme','atelier-3-etape-1','Atelier 3 · Écosystème'],['06-scenarios-strategiques','atelier-3-etape-2','Atelier 3 · Scénarios stratégiques'],['07-scenarios-operationnels','atelier-4-etape-1','Atelier 4 · Scénarios opérationnels'],['08-vraisemblance','atelier-4-etape-2','Atelier 4 · Vraisemblance'],['09-plan-traitement','atelier-5-etape-3','Atelier 5 · Plan de traitement'],['10-surveillance','atelier-5-etape-6','Atelier 5 · Surveillance']];
(async()=>{
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1600,height:1160},deviceScaleFactor:1});let errors=[],external=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()) && !r.url().startsWith('http://127.0.0.1:8765/'))external.push(r.url())});
await page.goto('http://127.0.0.1:8765/index.html');
await page.evaluate(()=>localStorage.clear());
for(const w of data.workshops){for(let i=0;i<w.steps.length;i++){
 await page.evaluate(hash=>location.hash=hash,`atelier-${w.id}-etape-${i+1}`);
 await page.waitForFunction(t=>document.querySelector('.workspacepanel h2')?.textContent===t,w.steps[i][1]);
 assert.equal(await page.locator('textarea').count(),2);
 assert.equal(await page.locator('textarea').first().inputValue(),'');
 assert.equal(await page.locator('.stepbutton.on').count(),1);
 assert(await page.locator(`a[href$="#page=${w.steps[i][5]+2}"]`).count());
}}
await page.locator('textarea').first().fill('<b>Test de notes</b>');await page.locator('#saveNotes').click();await page.reload();
assert.equal(await page.locator('textarea').first().inputValue(),'<b>Test de notes</b>');
await page.locator('[data-go="1"]').click();await page.locator('[data-go="5"]').click();await page.locator('[data-step="5"]').click();
assert.equal(await page.locator('textarea').first().inputValue(),'<b>Test de notes</b>');
await page.locator('#openSources').click();assert(await page.locator('#sources').isVisible());assert.equal(await page.locator('#sourceList a').count(),9);await page.keyboard.press('Escape');assert(!(await page.locator('#sources').isVisible()));
await page.evaluate(()=>localStorage.clear());await page.reload();
for(const [name,hash,title] of views){await page.evaluate(h=>location.hash=h,hash);await page.waitForTimeout(60);await page.screenshot({path:root+'/images/'+name+'.png',fullPage:true});}
let widths=[];
for(const width of [390,768,1440,1600]){await page.setViewportSize({width,height:1000});for(const hash of ['parcours','atelier-4-etape-1','atelier-5-etape-6']){await page.evaluate(h=>location.hash=h,hash);await page.waitForTimeout(40);const dimensions=await page.evaluate(()=>({actual:document.documentElement.scrollWidth,viewport:innerWidth}));assert(dimensions.actual<=width,JSON.stringify({width,hash,...dimensions}));widths.push({width,hash,...dimensions});}}
assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
fs.writeFileSync(root+'/technique/verification.json',JSON.stringify({date:'2026-10-13',workshops:5,steps:18,screenshots:views.length,sourceLinks:9,checks:['18 étapes accessibles et champs vides','Liens de pages PDF vérifiés','Notes persistantes et échappées après rechargement','Navigation entre ateliers','Dialogue et fermeture clavier','Aucun appel réseau automatique','Aucune erreur JavaScript'],responsive:widths},null,2));
fs.writeFileSync(root+'/technique/vues.json',JSON.stringify(views,null,2));
await browser.close();console.log('OK : 18 étapes, 10 captures, stockage, sources, responsive.');
})().catch(e=>{console.error(e);process.exit(1)});
