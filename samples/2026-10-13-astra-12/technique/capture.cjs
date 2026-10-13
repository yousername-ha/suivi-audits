const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const http=require('node:http');
const {chromium}=require('playwright');
(async()=>{const out=path.resolve(__dirname,'..');const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(out,'index.html')))});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});try{
const page=await browser.newPage({viewport:{width:1600,height:1100}});const errors=[],external=[],checks=[],files=[];
page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith(url+'/'))external.push(r.url())});
const check=(name,pass)=>{checks.push({name,pass});if(!pass)throw Error(name)};
await page.goto(url);
for(const [i,value] of ['sage','clair'].entries()){
await page.locator(`input[value=${value}]`).check();
check('Sélection '+value,await page.locator('html').getAttribute('data-style')===value);
await page.reload();check('Persistance '+value,await page.locator(`input[value=${value}]`).isChecked());
const filename=`images/00${i+1}-administration-${value}.png`;
const b=await page.screenshot({path:path.join(out,filename),animations:'disabled'});
files.push({file:filename,width:1600,height:1100,sha256:crypto.createHash('sha256').update(b).digest('hex')});
}
await page.locator('input[value=clair]').focus();await page.keyboard.press('ArrowLeft');check('Choix au clavier',await page.locator('input[value=sage]').isChecked());
await page.locator('input[value=clair]').check();await page.locator('#reset').click();check('Retour au défaut',await page.locator('input[value=sage]').isChecked());
await page.evaluate(()=>localStorage.setItem('astra-appearance-prototype-v1','invalide'));await page.reload();check('Valeur invalide',await page.locator('input[value=sage]').isChecked());
for(const width of [390,768,1440,1920]){await page.setViewportSize({width,height:1100});check('Pas de débordement '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
check('Aucune erreur JavaScript',errors.length===0);check('Aucune requête externe',external.length===0);
fs.writeFileSync(path.join(__dirname,'verification.json'),JSON.stringify({date:'2026-10-13',scope:'Prototype autonome seulement : pas de recette de l’application',checks,errors,externalRequests:external,files},null,2)+'\n');console.log(JSON.stringify({checks,files},null,2));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}})().catch(e=>{console.error(e);process.exitCode=1});
