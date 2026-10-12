/* Génération des captures de maquettes, sans exécuter ni modifier l’application. */
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=__dirname, styles=JSON.parse(fs.readFileSync(path.join(root,'styles.json'),'utf8'));
const limit=Number(process.env.PREVIEW_LIMIT||100);
(async()=>{
 const server=http.createServer((req,res)=>{
  const file=req.url.split('?')[0];
  if(file==='/favicon.ico'){res.writeHead(204);res.end();return;}
  if(!['/preview.html','/styles.json'].includes(file)){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',file.endsWith('.json')?'application/json':'text/html; charset=utf-8');
  res.end(fs.readFileSync(path.join(root,file.slice(1))));
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1600,height:1280},deviceScaleFactor:1,locale:'fr-FR',timezoneId:'Europe/Paris'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const files=[];
 try{
 await page.goto('http://127.0.0.1:'+server.address().port+'/preview.html');
 await page.waitForFunction(()=>document.querySelector('main'));
 const views=await page.evaluate(()=>window.views);
 const overflow=[];
 for(const t of styles)for(let i=0;i<views.length;i++){
  await page.evaluate(([theme,index])=>window.renderStyle(theme,index),[t,i]);
  const bounds=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
  if(bounds.width>1600||bounds.height>1280)overflow.push({style:t.id,view:views[i][0],bounds});
 }
 if(overflow.length)throw Error('Cadrages à ajuster : '+JSON.stringify(overflow));

 for(const style of styles){
  const folder=path.join(root,style.id);fs.mkdirSync(folder,{recursive:true});
  for(let i=0;i<views.length;i++){
   if(files.length>=limit)break;
   await page.evaluate(([t,n])=>window.renderStyle(t,n),[style,i]);
   await page.evaluate(()=>document.fonts.ready);
   const bounds=await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}));
   if(bounds.width>1600||bounds.height>1280)throw Error('Débordement '+style.id+' / '+views[i][0]+' : '+JSON.stringify(bounds));
   const filename=views[i][0]+'.png', target=path.join(folder,filename);
   await page.screenshot({path:target,fullPage:false});
   const bytes=fs.readFileSync(target);
   files.push({style:style.id,view:views[i][0],path:style.id+'/'+filename,width:1600,height:1280,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
  console.log(style.id,files.filter(f=>f.style===style.id).length,'captures');
  if(files.length>=limit)break;
 }
 if(errors.length)throw Error(errors.join('\n'));
 if(limit===100){
  if(files.length!==100||new Set(files.map(f=>f.sha256)).size!==100)throw Error('Nombre de captures ou unicité incorrect');
  const manifest={date:'2026-10-12',branch:'legacy',applicationReference:'5369552a9468d12fb559d0e5070d220d91a72be1',type:'Propositions visuelles de cartographie SMSI, données fictives, non intégrées à l’application',styles:10,imagesPerStyle:10,images:100,renderer:'Chromium / HTML-CSS-SVG',sourceHashes:Object.fromEntries(['preview.html','styles.json','generate.cjs'].map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex')])),errors,files};
  fs.writeFileSync(path.join(root,'metadata.json'),JSON.stringify(manifest,null,2)+'\n');
 }
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
