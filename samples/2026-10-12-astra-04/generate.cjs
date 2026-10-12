/* Captures de propositions visuelles isolées : aucune exécution de l’application. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const server=http.createServer((q,r)=>{if(q.url==='/favicon.ico'){r.writeHead(204);r.end();return;}r.setHeader('Content-Type','text/html; charset=utf-8');r.end(fs.readFileSync(path.join(__dirname,'preview.html')));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1600,height:1280},deviceScaleFactor:1,locale:'fr-FR'}),errors=[],files=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 try{
 await page.goto('http://127.0.0.1:'+server.address().port);
 const views=await page.evaluate(()=>window.views);
 for(let n=0;n<views.length;n++){
  await page.evaluate(n=>window.render(n),n);await page.evaluate(()=>document.fonts.ready);
  const bounds=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
  if(bounds.width>1600||bounds.height>1280)throw Error('Débordement '+JSON.stringify({view:views[n][0],bounds}));
  const name=views[n][0]+'.png',file=path.join(__dirname,name);await page.screenshot({path:file});
  files.push({path:name,title:views[n][1],width:1600,height:1280,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});
 }
 if(errors.length||files.length!==10||new Set(files.map(f=>f.sha256)).size!==10)throw Error(JSON.stringify({errors,count:files.length}));
 fs.writeFileSync(path.join(__dirname,'metadata.json'),JSON.stringify({date:'2026-10-12',branch:'legacy',applicationReference:'06656bfd3e8c25416bf3cf1d51f0a9cb091a752f',type:'Propositions visuelles isolées, données fictives, non intégrées',reference:'https://www.normand-esante.fr/',referenceObserved:'2026-10-12',palette:{navy:'#142f61',turquoise:'#55bdc2',textAccent:'#267c84',background:'#f3f5f5',surface:'#ffffff'},protected:'Interface et fonctionnement du module cartographique dynamique inchangés',renderer:'Chromium / HTML-CSS-SVG',errors,files},null,2)+'\n');console.log('10 captures uniques · 1600 × 1280 · aucun débordement ni erreur navigateur');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
