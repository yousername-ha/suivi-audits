/* Documentation uniquement : prévisualisation en mémoire, serveur et base temporaires. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawn,execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const ROOT=path.resolve(__dirname,'../../..'),OUT=path.resolve(__dirname,'..'),PORT=Number(process.env.STYLE_PORT||8232),URL=`http://127.0.0.1:${PORT}`,TEMP=fs.mkdtempSync(path.join(os.tmpdir(),'nes-style-'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
let server,browser; const errors=[],external=[],files=[],checks=[];
(async()=>{
 server=spawn('python3',['demarrer.py','--sans-navigateur','--port',String(PORT),'--donnees',path.join(TEMP,'data')],{cwd:ROOT,stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',c=>reject(Error('Serveur arrêté '+c)))});
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1600,height:1100},locale:'fr-FR',timezoneId:'Europe/Paris'});
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(URL))external.push(r.url())});
 await page.goto(URL);await page.locator('#lx-auth [name=login]').fill('admin');await page.locator('#lx-auth [name=password]').fill('admin');await page.locator('#lx-auth [type=submit]').click();await page.locator('#lx-account').waitFor();
 await page.evaluate(async()=>{const u=LegacyIntegrationUI.toolkit;u.api().replaceState(LegacyDemo.build(u.state(),'Dossier style FICTIF').state);await u.mutate(s=>{
 s.nextDate='2027-05-03';s.internalDate='2027-03-01';s.nextYear=2027;
 const scope=s.perimeters.map(p=>p.id);
 for(let n=0;n<4;n++)s.findings.push({id:'STYLE-DEMO-'+n,text:['Revue des habilitations (FICTIF)','Test de restauration (FICTIF)','Exercice de continuité (FICTIF)','Collecte de preuves (FICTIF)'][n],action:'Activité de démonstration',type:n===0?'NC min':'PS',source:'Interne',year:2026,status:n<2?'Ouvert':'En cours',due:n===0?'2026-10-01':'2026-11-20',start:'2026-10-01',owner:'Équipe SSI (FICTIF)',items:[],perimeterIds:scope,tasks:[{t:'Préparer',done:false}],createdAt:'2026-10-01T09:00:00Z'});
 });await LegacyServer.flush();u.api().render()});
 const navigation=await page.evaluate(()=>LegacyIntegrationUI.toolkit.api().astra.navigation());
 fs.writeFileSync(path.join(OUT,'technique/navigation.json'),JSON.stringify(navigation,null,2)+'\n');
 const css=fs.readFileSync(path.join(__dirname,'preview.css'),'utf8');
 const header=`<div class="nes-preview-header"><div class="nes-preview-brand"><span class="nes-preview-monogram">S</span><div><strong>Suivi des audits SMSI</strong><small>Qualité, sécurité et référentiels</small></div></div><div class="nes-preview-signature">Normand’e-Santé<small>NUMÉRIQUE EN SANTÉ</small></div><span class="nes-preview-demo">DÉMONSTRATION</span><a class="nes-preview-site" href="https://www.normand-esante.fr/" target="_blank" rel="noopener noreferrer">Site Normand’e-Santé <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg></a></div>`;
 async function reset(){await page.evaluate(()=>{document.querySelectorAll('#nes-preview-style,.nes-preview-header,.nes-preview-caption').forEach(e=>e.remove());delete document.documentElement.dataset.stylePreview;document.querySelectorAll('dialog[open]').forEach(e=>e.close())})}
 async function skin(label){await page.addStyleTag({content:css}).then(l=>l.evaluate(e=>e.id='nes-preview-style'));await page.evaluate(([header,label])=>{document.documentElement.dataset.stylePreview='nes-sage';document.body.insertAdjacentHTML('afterbegin',header);const c=document.createElement('div');c.className='nes-preview-caption';c.textContent='PRÉVISUALISATION · Données fictives · '+label;document.body.append(c)},[header,label])}
 async function save(filename,meta){await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(90);const b=await page.screenshot({path:path.join(OUT,'images',filename),animations:'disabled'});const bounds=await page.evaluate(()=>({width:document.documentElement.scrollWidth,client:document.documentElement.clientWidth}));files.push({file:'images/'+filename,...meta,width:1600,height:1100,sha256:hash(b),documentOverflow:bounds.width>bounds.client+4});return b}
 let n=0;
 for(const section of navigation){
  for(const item of section.items){
   await reset();
   await page.evaluate(([sec,id])=>{document.querySelector(`[data-act=nav][data-sec="${sec}"]:not([data-sub])`).click();const b=document.querySelector(`[data-act=nav][data-sec="${sec}"][data-sub="${id}"]`);if(b)b.click()},[section.id,item.id]);
   await page.evaluate(item=>{const a=LegacyIntegrationUI.toolkit.api();if(a.ui.tab!==item.tab)a.navigate(item.tab,item.set||{})},item);
   await page.waitForTimeout(100);
   const actual=await page.evaluate(()=>({tab:LegacyIntegrationUI.toolkit.api().ui.tab,text:document.querySelector('#panel').innerText}));
   if(actual.tab!==item.tab||actual.text.trim().length<5)throw Error('Route inattendue '+item.id+' '+actual.tab);
   const protectedView=section.id==='carto';
   if(!protectedView)await skin(section.label+' / '+item.label);
   await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('.side-nav')?.scrollTo(0,0)});
   const fname=String(++n).padStart(3,'0')+'-'+section.id+'-'+item.id+'.png';
   const b=await save(fname,{section:section.id,sectionLabel:section.label,id:item.id,label:item.label,tab:item.tab,set:item.set||{},protected:protectedView,kind:'route'});
   if(protectedView){const b2=await page.screenshot({animations:'disabled'});checks.push({name:'Cartographie sans habillage '+item.id,pass:hash(b)===hash(b2)&&!await page.locator('#nes-preview-style').count()})}
  }
  console.log(section.id,section.items.length,'captures');
 }
 // Utilitaires accessibles dans l’interface actuelle, sans déclencher d’import/export.
 await reset();await page.evaluate(()=>LegacyIntegrationUI.toolkit.api().navigate('dash',{dashView:'cards'}));await skin('Utilitaires');
 for(const [id,selector,dialog] of [['parametres','[data-act=settings]','#settings'],['recherche','[data-act=search]','#searchDlg'],['export','[data-act=xexport]','#exportDlg']]){
  await page.evaluate(s=>document.querySelector(s).click(),selector);if(id!=='parametres')await page.locator('dialog[open]').first().waitFor({state:'visible',timeout:10000});else await page.waitForTimeout(150);await save('utilitaire-'+id+'.png',{id,label:id,kind:'utility',protected:false});await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(d=>d.close()));
 }
 await page.evaluate(()=>document.querySelector('#bell').click());await save('utilitaire-notifications.png',{id:'notifications',label:'Notifications',kind:'utility',protected:false});
 const widths=[];await reset();await page.evaluate(()=>LegacyIntegrationUI.toolkit.api().navigate('dash',{dashView:'cards'}));await skin('Contrôle de largeur');
 for(const width of [390,768,1440,1920]){await page.setViewportSize({width,height:1050});widths.push(await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,pass:document.documentElement.scrollWidth<=innerWidth+4})))}
 const sourceFiles=execFileSync('git',['ls-files','index.html','modules','demarrer.py','legacy_server.py','legacy_cartography.py','legacy_risks.py'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n');
 const sourceHashes=Object.fromEntries(sourceFiles.map(f=>[f,hash(fs.readFileSync(path.join(ROOT,f)))]));
 const manifest={branch:'legacy',applicationReference:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),date:'2026-10-13',type:'Écrans réels avec habillage de prévisualisation en mémoire ; cartographies sans habillage',sections:navigation.length,routes:n,images:files.length,errors,externalRequests:external,checks,responsive:widths,sourceHashes,files};
 fs.writeFileSync(path.join(OUT,'technique/verification.json'),JSON.stringify(manifest,null,2)+'\n');
 if(errors.length||external.length||checks.some(c=>!c.pass)||n!==100)throw Error('Contrôles non satisfaits : voir verification.json');
 console.log('TERMINÉ',n,'routes',files.length,'images',JSON.stringify(widths));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)server.kill()});
