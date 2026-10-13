/* Documentation uniquement : prévisualisation en mémoire, serveur et base temporaires. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawn,execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const ROOT=path.resolve(__dirname,'../../..'),OUT=path.resolve(__dirname,'..'),PORT=Number(process.env.STYLE_PORT||8235),URL=`http://127.0.0.1:${PORT}`,TEMP=fs.mkdtempSync(path.join(os.tmpdir(),'nes-style-'));
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
 for(let n=0;n<10;n++)s.findings.push({id:'STYLE-DEMO-'+n,text:['Renforcer les accès privilégiés','Tester la restauration hors ligne','Revoir les habilitations','Segmenter le réseau clinique','Qualifier les alertes critiques','Actualiser le PCA','Collecter les preuves HDS','Évaluer les fournisseurs','Préparer le comité SSI','Actualiser les procédures'][n]+' (FICTIF)',action:'',type:n===0?'NC min':'PS',source:'Interne',year:2026,status:n<4?'Ouvert':n<8?'En cours':'Clos',due:n<2?'2026-10-01':'2026-11-20',start:'2026-10-01',owner:'Équipe SSI (FICTIF)',items:[],perimeterIds:scope,tasks:[{t:'Préparer',done:n>=8}],createdAt:'2026-10-01T09:00:00Z'});
 });await LegacyServer.flush();u.api().render()});
 const allNavigation=await page.evaluate(()=>LegacyIntegrationUI.toolkit.api().astra.navigation());
 const chosen=[['dash','dash'],['risks','risk-register'],['compliance','ann'],['care','df-care-dash'],['audit','cibles'],['proofs','prv-reg'],['actions','fd'],['pcra','pcra-dashboard'],['perimeters','perimeter-registry'],['admin','admin-overview']];
 const navigation=chosen.map(([sec,id])=>{const s=allNavigation.find(x=>x.id===sec);return {...s,items:s.items.filter(x=>x.id===id)}});
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
   if(section.id==='actions')await page.locator('[data-astra=view][data-value=kanban]').click();
   if(!protectedView)await skin(section.label+' / '+item.label+' · Fond clair');
   await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('.side-nav')?.scrollTo(0,0)});
   const fname=String(++n).padStart(3,'0')+'-'+section.id+'-'+item.id+'.png';
   const b=await save(fname,{section:section.id,sectionLabel:section.label,id:item.id,label:item.label,tab:item.tab,set:item.set||{},protected:protectedView,kind:'route'});
   if(protectedView){const b2=await page.screenshot({animations:'disabled'});checks.push({name:'Cartographie sans habillage '+item.id,pass:hash(b)===hash(b2)&&!await page.locator('#nes-preview-style').count()})}
  }
  console.log(section.id,section.items.length,'captures');
 }
 const widths=[];
 const sourceFiles=execFileSync('git',['ls-files','index.html','modules','demarrer.py','legacy_server.py','legacy_cartography.py','legacy_risks.py'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n');
 const sourceHashes=Object.fromEntries(sourceFiles.map(f=>[f,hash(fs.readFileSync(path.join(ROOT,f)))]));
 const manifest={branch:'legacy',applicationReference:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),date:'2026-10-13',type:'Dix aperçus au fond éclairci, habillage en mémoire, données fictives ; cartographies exclues',palette:{background:'#f7f9fb',secondary:'#f0f4f7',surface:'#ffffff',sidebar:'#173f34',accent:'#236b70'},sections:navigation.length,routes:n,images:files.length,errors,externalRequests:external,checks,responsive:widths,sourceHashes,files};
 fs.writeFileSync(path.join(OUT,'technique/verification.json'),JSON.stringify(manifest,null,2)+'\n');
 if(errors.length||external.length||checks.some(c=>!c.pass)||n!==10||files.some(f=>f.documentOverflow)||new Set(files.map(f=>f.sha256)).size!==10)throw Error('Contrôles non satisfaits : voir verification.json');
 console.log('TERMINÉ',n,'routes',files.length,'images',JSON.stringify(widths));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)server.kill()});
