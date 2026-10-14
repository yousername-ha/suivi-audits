/* Test local de la maquette : lancer un serveur sur 127.0.0.1:8769 dans sa version courante. */
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto'),cp=require('child_process');
const feature=path.resolve(__dirname,'..');
const repo=path.resolve(__dirname,'../../..');
const catalog=JSON.parse(fs.readFileSync(path.join(repo,'fonctionnalites/catalogue.json'),'utf8'));
const root=path.join(repo,catalog.fonctionnalites.find(x=>x.id==='ebios-rm').maquetteCourante);
const data=JSON.parse(fs.readFileSync(path.join(root,'contenu.js'),'utf8').trim().replace(/^window\.EBIOS_CONTENT = /,'').replace(/;$/,''));
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1600,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8769/parcours-complet.html');await page.waitForURL('**/index.html#parcours');
 assert.equal(await page.locator('.overviewcard').count(),5);
 await page.locator('.overviewhero [data-go="1"]').click();
 let completed=0;
 for(const w of data.workshops)for(let step=0;step<w.steps.length;step++){
  const hash=`#atelier-${w.id}-etape-${step+1}`;await page.waitForFunction(h=>location.hash===h,hash);
  assert.equal(await page.locator('.workspacepanel h2').textContent(),w.steps[step][1]);
  assert.equal(await page.locator('textarea').count(),2);
  for(let field=0;field<2;field++)await page.locator('textarea').nth(field).fill(`NOTE DE TEST A${w.id}-${step+1}-${field+1}`);
  await page.locator('#saveNotes').click();assert((await page.locator('#saveStatus').textContent()).includes('enregistrées'));
  assert(await page.locator(`a[href$="#page=${w.steps[step][5]+2}"]`).count());
  completed++;await page.locator('[data-next]').click();
 }
 await page.waitForFunction(()=>location.hash==='#parcours');assert.equal(completed,18);
 await page.reload();
 for(const w of data.workshops)for(let step=0;step<w.steps.length;step++){
  await page.evaluate(h=>location.hash=h,`atelier-${w.id}-etape-${step+1}`);
  await page.waitForFunction(t=>document.querySelector('.workspacepanel h2')?.textContent===t,w.steps[step][1]);
  for(let field=0;field<2;field++)assert.equal(await page.locator('textarea').nth(field).inputValue(),`NOTE DE TEST A${w.id}-${step+1}-${field+1}`);
 }
 await page.locator('[data-view="suivi"]').click();await page.waitForSelector('.riskregister');
 for(const [id,cell,party]of [['R1','3-3',null],['R2','3-2','P3'],['R3','3-4','F3'],['R4','4-2','F2'],['R5','4-1',null]]){
  await page.locator(`.riskselect[data-risk="${id}"]`).click();await page.waitForFunction(x=>document.querySelector('.selectedrow')?.dataset.row===x,id);
  assert.equal(await page.locator('.selectedcell').getAttribute('data-cell'),cell);
  assert.equal(await page.locator('.linkedparty').count(),party?1:0);if(party)assert.equal(await page.locator('.linkedparty').getAttribute('data-party'),party);
 }
 await page.locator('[data-view="scenario"]').click();await page.waitForSelector('.attackgraph');
 for(const p of ['1','2','3']){await page.locator(`[data-path="${p}"]`).click();await page.waitForFunction(p=>location.hash.endsWith('/'+p),p);assert(await page.locator('.flowpulse').count());assert(await page.locator('.selectednode').count());assert.deepEqual(await page.locator('.attackedge:not(.faded)').evaluateAll(es=>[...new Set(es.map(e=>e.dataset.pathEdge))]),[p]);}
 await page.locator('#toggleFlow').click();assert.equal(await page.locator('#toggleFlow').getAttribute('aria-pressed'),'true');await page.locator('#toggleFlow').click();
 await page.locator('.iconlibrarybtn').click();assert(await page.locator('#iconLibrary').isVisible());await page.keyboard.press('Escape');
 await page.locator('#openSources').click();assert.equal(await page.locator('#sourceList a').count(),9);await page.keyboard.press('Escape');
 await page.locator('[data-view="parcours"]').click();await page.waitForSelector('.overviewcard');
 assert.deepEqual(errors,[]);
 const report={date:'2026-10-14',baseCommit:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),workingTreeChanges:true,result:'passed',workshops:5,steps:18,savedNotesRestoredAfterReload:36,riskSelections:5,graphFilters:3,sourceDocuments:9,checks:['Entrée parcours-complet.html','Parcours séquentiel des 18 étapes et retour à la vue d’ensemble','36 notes enregistrées et restituées après rechargement','Liens de sources PDF à chaque étape','Tableau / matrice / cercle synchronisés','Trois chemins sélectionnables, flux et contours','Pause et reprise','Palette et sources au clavier','Retour au parcours','Aucune erreur JavaScript'],runtimeFiles:{}};
 for(const file of ['index.html','parcours-complet.html','app.js','contenu.js','vues.js','pictogrammes.js','style.css'])report.runtimeFiles[file]=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
 fs.writeFileSync(path.join(__dirname,'2026-10-14-parcours-complet.json'),JSON.stringify(report,null,2)+'\n');
 await page.evaluate(()=>localStorage.clear());await browser.close();console.log('OK : 5 ateliers / 18 étapes / 36 notes restituées / 5 risques / 3 chemins.');
})().catch(e=>{console.error(e);process.exit(1)});
