/* Documentation uniquement : prévisualisation en mémoire, serveur et base temporaires. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),{spawn,execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const ROOT=path.resolve(__dirname,'../../..'),OUT=path.resolve(__dirname,'..'),PORT=Number(process.env.STYLE_PORT||8240),URL=`http://127.0.0.1:${PORT}`,TEMP=fs.mkdtempSync(path.join(os.tmpdir(),'nes-style-'));
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
 s.recurring=[];
 const titles=['Revue des habilitations','Test de restauration','Comité de sécurité','Revue des journaux','Contrôle des comptes privilégiés','Revue des fournisseurs'];
 for(let n=0;n<6;n++)s.recurring.push({id:'REC-DEMO-'+n,title:titles[n]+' (FICTIF)',n:[1,1,1,1,3,1][n],u:['m','s','m','s','m','a'][n],start:['2026-09-05','2026-10-14','2026-10-16','2026-10-15','2026-10-20','2026-10-22'][n],last:n===0?'2026-09-05':'',active:true,owner:n%2?'Équipe SSI (FICTIF)':'RSSI (FICTIF)',cat:n<3?'Gouvernance':'Contrôles',history:n===0?[{date:'2026-09-05',by:'RSSI (FICTIF)',comment:'Revue des habilitations effectuée. Écarts transmis au plan d’action.',proof:'Compte rendu fictif de revue des accès.'}]:[],perimeterIds:scope,notes:'Vérifier les éléments attendus et consigner la réalisation avec un commentaire et une preuve.'});

 });await LegacyServer.flush();u.api().render()});
 const allNavigation=await page.evaluate(()=>LegacyIntegrationUI.toolkit.api().astra.navigation());
 const selection=[['dash','dash'],['risks','risk-register'],['risks','risk-map'],['risks','risk-studies'],['compliance','iso'],['compliance','ann'],['care','df-care-dash'],['has','df-has-dash'],['audit','cibles'],['proofs','prv-reg'],['pcra','pcra-dashboard'],['pcra','pcra-bias'],['perimeters','perimeter-registry'],['suppliers','sup'],['admin','admin-overview'],['programs','pl-formation'],['ops','inc-reg'],['ai','reg'],['context','ctx-pi']];
 const navigation=[];
 for(const [sec,id] of selection){const section=allNavigation.find(s=>s.id===sec),route=section?.items.find(i=>i.id===id);if(!route)throw Error('Route absente '+sec+'/'+id);navigation.push({...section,items:[route]})}
 for(const [sec,id,variants] of [['actions','fd',[['list','Liste'],['kanban','Kanban'],['planning','Planning'],['calendar','Calendrier'],['gantt','Gantt'],['summary','Synthèse']]],['recurring','pl-rec',[['list','Liste'],['kanban','Kanban'],['planning','Planning'],['calendar','Calendrier']]]]){
 const section=allNavigation.find(s=>s.id===sec),route=section.items.find(i=>i.id===id);navigation.push({...section,items:variants.map(([previewView,label])=>({...route,label,previewView}))});}
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
   if(protectedView)throw Error('Cartographie exclue de cette série');
   if(item.previewView){
   await page.locator(`[data-astra=view][data-value=${item.previewView}]`).click();
   if(await page.locator(`[data-astra=view][data-value=${item.previewView}]`).getAttribute('aria-pressed')!=='true')throw Error('Vue non activée '+item.previewView);
   }
   if(!protectedView)await skin(section.label+' / '+item.label+' · Style référence 08');
   await page.evaluate(()=>{window.scrollTo(0,0);document.querySelector('.side-nav')?.scrollTo(0,0)});
   const fname=String(++n).padStart(3,'0')+'-'+section.id+'-'+(item.previewView||item.id)+'.png';
   const b=await save(fname,{section:section.id,sectionLabel:section.label,id:item.id,label:item.label,previewView:item.previewView,tab:item.tab,set:item.set||{},protected:protectedView,kind:'route'});
   if(protectedView){const b2=await page.screenshot({animations:'disabled'});checks.push({name:'Cartographie sans habillage '+item.id,pass:hash(b)===hash(b2)&&!await page.locator('#nes-preview-style').count()})}
  }
  console.log(section.id,section.items.length,'captures');
 }
 await reset();await page.locator('[data-astra=view][data-value=list]').click();await skin('Tâches récurrentes / Fiche et historique · Référence 08');
 await page.locator('#panel [data-astra=work-detail][data-id="REC-DEMO-0"]').click();
 checks.push({name:'Historique de réalisation visible',pass:(await page.locator('#as-detail').innerText()).includes('Revue des habilitations effectuée')});
 await save('030-recurring-fiche-historique.png',{section:'recurring',sectionLabel:'Tâches récurrentes',label:'Fiche et historique',kind:'detail'});
 const widths=[];
 const sourceFiles=execFileSync('git',['ls-files','index.html','modules','demarrer.py','legacy_server.py','legacy_cartography.py','legacy_risks.py'],{cwd:ROOT,encoding:'utf8'}).trim().split('\n');
 const sourceHashes=Object.fromEntries(sourceFiles.map(f=>[f,hash(fs.readFileSync(path.join(ROOT,f)))]));
 const manifest={branch:'legacy',applicationReference:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT,encoding:'utf8'}).trim(),date:'2026-10-13',type:'30 vues pour validation, référence visuelle série 08, habillage isolé en mémoire ; cartographies exclues',palette:{background:'#f5f5f0',secondary:'#edf2ee',surface:'#ffffff',sidebar:'#103f33',accent:'#00a8b0',note:'Transposition HTML proposée de l’image 08 ; valeurs non normatives'},sections:new Set(navigation.map(s=>s.id)).size,routes:21,views:30,images:files.length,errors,externalRequests:external,checks,responsive:widths,sourceHashes,files};
 fs.writeFileSync(path.join(OUT,'technique/verification.json'),JSON.stringify(manifest,null,2)+'\n');
 if(errors.length||external.length||checks.some(c=>!c.pass)||n!==29||files.some(f=>f.documentOverflow)||new Set(files.map(f=>f.sha256)).size!==30)throw Error('Contrôles non satisfaits : voir verification.json');
 console.log('TERMINÉ',files.length,'vues',files.length,'images',JSON.stringify(widths));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{if(browser)await browser.close();if(server)server.kill()});
