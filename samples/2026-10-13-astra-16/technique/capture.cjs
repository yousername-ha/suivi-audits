/* Documentation uniquement : prévisualisation en mémoire, serveur et base temporaires. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawn,execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const ROOT=path.resolve(__dirname,'../../..'),OUT=path.resolve(__dirname,'..'),PORT=Number(process.env.STYLE_PORT||8242),URL=`http://127.0.0.1:${PORT}`,TEMP=fs.mkdtempSync(path.join(os.tmpdir(),'nes-style-'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
let server,browser; const errors=[],external=[],files=[],checks=[];
(async()=>{
 server=spawn('python3',['demarrer.py','--sans-navigateur','--port',String(PORT),'--donnees',path.join(TEMP,'data')],{cwd:ROOT,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',c=>reject(Error('Serveur arrêté '+c)))});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1600,height:1400},locale:'fr-FR',timezoneId:'Europe/Paris'});
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(URL))external.push(r.url())});
 await page.goto(URL);await page.locator('#lx-auth [name=login]').fill('admin');await page.locator('#lx-auth [name=password]').fill('admin');await page.locator('#lx-auth [type=submit]').click();await page.locator('#lx-account').waitFor();
 await page.evaluate(async()=>{const u=LegacyIntegrationUI.toolkit;u.api().replaceState(LegacyDemo.build(u.state(),'Dossier style FICTIF').state);await u.mutate(s=>{
 const R=LegacyRisks,p=JSON.parse(JSON.stringify(R.DEFAULT_POLICY));
 p.title='Matrice ASTRA (FICTIF)';p.perimeterIds=s.perimeters.map(p=>p.id);p.calculation='matrix';
 p.levels.forEach((l,i)=>l.color=['#4DBB69','#FFDF45','#FF8335','#FF293F'][i]);
 p.impactScale.forEach((im,i)=>p.likelihoodScale.forEach((lk,j)=>p.matrix[im.id+':'+lk.id]='L'+Math.min(4,1+Math.floor((i+j)/2))));
 const pol=R.policy(s,p);
 s.riskMgmt.risks.forEach((r,i)=>{const a=R.assessment(s,{riskId:r.id,policyId:pol.id,impactId:'I'+(4-i),likelihoodId:'V'+(4-i),stage:'initial',date:'2026-10-13',justification:'Évaluation fictive pour aperçu de la matrice colorée'},'Démonstration (FICTIF)');R.reference(s,r.id,a.id)});

 });await LegacyServer.flush();u.api().render()});
 const css=fs.readFileSync(path.join(__dirname,'preview.css'),'utf8');
 const header=`<div class="nes-preview-header"><div class="nes-preview-brand"><span class="nes-preview-monogram">S</span><div><strong>Suivi des audits SMSI</strong><small>Qualité, sécurité et référentiels</small></div></div><div class="nes-preview-signature">Normand’e-Santé<small>NUMÉRIQUE EN SANTÉ</small></div><span class="nes-preview-demo">DÉMONSTRATION</span><a class="nes-preview-site" href="https://www.normand-esante.fr/" target="_blank" rel="noopener noreferrer">Site Normand’e-Santé <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg></a></div>`;
 async function reset(){await page.evaluate(()=>{document.querySelectorAll('#nes-preview-style,.nes-preview-header,.nes-preview-caption').forEach(e=>e.remove());delete document.documentElement.dataset.stylePreview;document.querySelectorAll('dialog[open]').forEach(e=>e.close())})}
 async function skin(label){await page.addStyleTag({content:css}).then(l=>l.evaluate(e=>e.id='nes-preview-style'));await page.evaluate(([header,label])=>{document.documentElement.dataset.stylePreview='nes-sage';document.body.insertAdjacentHTML('afterbegin',header);const c=document.createElement('div');c.className='nes-preview-caption';c.textContent='PRÉVISUALISATION · Données fictives · '+label;document.body.append(c)},[header,label])}
 async function save(filename,meta){await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(90);const b=await page.screenshot({path:path.join(OUT,'images',filename),animations:'disabled'});const bounds=await page.evaluate(()=>({width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));files.push({file:'images/'+filename,...meta,width:1600,height:1100,sha256:hash(b),documentOverflow:bounds.width>bounds.client+4});return b}
 await page.evaluate(()=>LegacyIntegrationUI.toolkit.api().navigate('risks',{riskView:'map',riskId:''}));
 await page.locator('[data-astra=view][data-value=matrix]').click();
 await skin('Matrice des risques corrigée · Style référence 08');
 await page.locator('.as-cell-select').first().click();
 const matrix=page.locator('.as-surface').filter({has:page.locator('.as-matrix')});
 const cells=await page.locator('.as-risk-cell').evaluateAll(es=>es.map(e=>({color:getComputedStyle(e).backgroundColor,selected:e.classList.contains('selected'),count:e.querySelector('b').innerText,outline:getComputedStyle(e).outlineColor})));
 checks.push({name:'Grille 4 × 4',pass:cells.length===16});
 checks.push({name:'Quatre couleurs pleines',pass:new Set(cells.map(c=>c.color)).size===4&&['rgb(77, 187, 105)','rgb(255, 223, 69)','rgb(255, 131, 53)','rgb(255, 41, 63)'].every(c=>cells.some(x=>x.color===c))});
 checks.push({name:'Cellule vide sélectionnée en bleu',pass:cells[0].selected&&cells[0].outline==='rgb(38, 100, 184)'&&cells[0].count==='–'});
 checks.push({name:'Panneau de sélection vide',pass:(await matrix.innerText()).includes('Risques sélectionnés · 0')&&(await matrix.innerText()).includes('Aucun risque dans cette cellule.')});
 checks.push({name:'Trois références cliquables',pass:await page.locator('.as-risk-dots button').count()===3});
 await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('.side-nav')?.scrollTo(0,0)});
 await page.evaluate(()=>document.fonts.ready);
 for(const [file,target] of [['001-matrice-corrigee-vue-complete.png',page],['002-matrice-corrigee-detail.png',matrix]]){const bytes=await target.screenshot({path:path.join(OUT,'images',file),animations:'disabled'});files.push({file:'images/'+file,sha256:hash(bytes)})}
 await page.locator('.as-risk-dots button').first().click();checks.push({name:'Référence ouvre la fiche',pass:await page.locator('#as-detail').isVisible()});await page.locator('#as-detail [data-astra=close]').click();
 await page.locator('[data-astra=risk-cell][data-id=""]').click();checks.push({name:'Réinitialisation',pass:await page.locator('.as-risk-cell.selected').count()===0&&(await matrix.innerText()).includes('Dans cette matrice · 3')});
 const manifest={branch:'legacy',applicationReference:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),date:'2026-10-13',type:'Aperçu sur serveur temporaire : nouvelle politique fictive matricielle, palette demandée et habillage injecté ; aucun code applicatif modifié',checks,errors,externalRequests:external,files};
 fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify(manifest,null,2)+'\n');
 if(checks.some(c=>!c.pass)||errors.length||external.length)throw Error('Vérifications échouées');console.log(JSON.stringify(manifest,null,2));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)server.kill()});
