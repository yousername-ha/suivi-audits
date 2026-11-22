"""Frontend réel et API interceptée, sans accès à une session ou base réelle."""
from pathlib import Path
from copy import deepcopy
from urllib.parse import urlsplit,parse_qs
import argparse,json,statistics,re
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parent
PAGES={
 'risques':('/pilotage/risques','tbody tr',8),
 'fournisseurs':('/pilotage/fournisseurs','.fs-row',6),
 'planning':('/pilotage/plans-planning','.plan-svg',1),
 'produits':('/vulnerabilites/produits','tbody tr',8),
 'vulnerabilites':('/vulnerabilites/vue','.poste',1),
}

def main():
 ap=argparse.ArgumentParser()
 ap.add_argument('--base',default='http://127.0.0.1:5173')
 ap.add_argument('--stage',required=True,choices=['avant','apres','essai'])
 ap.add_argument('--out',default=str(ROOT/'captures'))
 ap.add_argument('--pages',default=','.join(PAGES))
 ap.add_argument('--sizes',default='1440x900,1920x1080')
 ap.add_argument('--themes',default='clair,sombre')
 ap.add_argument('--densities',default='compacte,normale')
 ap.add_argument('--taille',default='100',choices=['auto','90','100','115','130','150'])
 ap.add_argument('--chromium',default='/usr/bin/chromium')
 ap.add_argument('--no-images',action='store_true')
 ap.add_argument('--interactions',action='store_true')
 args=ap.parse_args()
 out=Path(args.out)/args.stage;out.mkdir(parents=True,exist_ok=True)
 fixture=json.loads((ROOT/'fixtures.json').read_text())
 report={'kind':'Frontend réel Vite, API entièrement interceptée, données fictives ; pas de recette serveur',
   'stage':args.stage,'base':args.base,'date':'2026-11-21','taille':args.taille,'layouts':[],'errors':[],'unexpected':[],'mutationsMetier':[],'interactions':[],'ecrituresSimulees':[]}
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=args.chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  for size in args.sizes.split(','):
   width,height=map(int,size.split('x'))
   for theme in args.themes.split(','):
    for density in args.densities.split(','):
     for name in args.pages.split(','):
      path,selector,count=PAGES[name]
      ident=f'{name}-{width}-{height}-{theme}-{density}'
      context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=1,locale='fr-FR',reduced_motion='reduce')
      page=context.new_page()
      me=deepcopy(fixture['me']);me['preferences'].update({'theme':theme,'densite':density,'taille':args.taille})
      page.on('pageerror',lambda e,ident=ident:report['errors'].append({'case':ident,'message':str(e)}))
      def handle(route):
       request=route.request;u=urlsplit(request.url);q=parse_qs(u.query);path=u.path;method=request.method
       def reply(body,status=200):return route.fulfill(status=status,content_type='application/json',body=json.dumps(body))
       if path=='/api/events':return route.fulfill(status=200,content_type='text/event-stream',body=': recette de presentation\n\n')
       if path=='/api/auth/me':return reply(me)
       if path=='/api/account/preferences' and method=='PUT':
        me['preferences'].update(request.post_data_json);return reply(me['preferences'])
       if path.startswith('/api/presence'):return reply([] if method=='GET' else {})
       if args.interactions and method=='POST' and re.fullmatch(r'/api/plans/[^/]+/decalage',path):
        report['ecrituresSimulees'].append({'case':ident,'path':path,'body':request.post_data_json})
        return reply({})
       if method not in ['GET','HEAD']:
        report['mutationsMetier'].append({'case':ident,'method':method,'path':path});return reply({'error':'Écriture métier interdite dans cette recette'},403)
       if path=='/api/grc/smsis':return reply(fixture['scopes'])
       if path.endswith('/policy'):return reply(fixture['policy'])
       if path=='/api/suppliers':return reply(fixture['suppliers'])
       if path=='/api/suppliers/criteria':return reply(fixture['criteria'])
       if path=='/api/mur/synthese':return reply({})
       if path=='/api/crise':return reply({'etat':{'cells':[]}})
       if path in ['/api/account/alertes-securite','/api/retex/invitations']:return reply([])
       if path=='/api/admin/cle-secours-sauvegardes':
        return reply({'publique':None,'definiLe':None,'definiPar':None,'serveur':['empreinte-publique-fictive'],'vuLe':'2026-11-21T10:00:00Z','sauvegardesPossibles':True})
       if path=='/api/settings/logo':return route.fulfill(status=200,headers={'X-Logo':'defaut'},body='')
       if path=='/api/updates':
        return reply({'installed':'7.5.0','available':None,'checkedAt':'2026-11-21T10:00:00Z','notes':None,'checking':False,'checkError':False,'ready':True,'maintenance':False,'id':None,'target':None,'status':'idle','phase':'idle','message':'','startedAt':None,'updatedAt':'2026-11-21T10:00:00Z','etapes':[],'finishedAt':None})
       if path=='/api/grc/notifications':return reply([])
       if path.endswith('/methods'):return reply([])
       if path.endswith('/risks/register'):return reply({'items':fixture['risks'],'tronque':False})
       if path.endswith('/objects'):
        return reply({'items':fixture['studies'] if q.get('kind')==['risk_study'] else fixture['objects'],'total':len(fixture['objects']),'tronque':False})
       if '/objects/' in path:
        obj=next((x for x in fixture['objects'] if path.endswith('/'+x['id'])),None);return reply(obj or {})
       if path=='/api/plans':return reply(fixture['plans'])
       if path=='/api/vulnerabilites/produits':return reply(fixture['products'])
       if path=='/api/vulnerabilites/vue-ensemble':return reply(fixture['vue'])
       if path=='/api/vulnerabilites/alertes':return reply({'elements':[],'total':0,'page':1,'parPage':25})
       if path=='/api/vulnerabilites/alertes/fenetre':return reply({'alertes':[],'total':0,'peutPrendreEnCompte':True})
       if path=='/api/vulnerabilites/veille/etat':return reply(fixture['veille'])
       if path in ['/api/vulnerabilites/synchronisation','/api/vulnerabilites/surface/etat','/api/vulnerabilites/imports/etat']:return reply([])
       report['unexpected'].append({'case':ident,'method':method,'path':path})
       return reply([])
      page.route('**/api/**',handle)
      page.route('**/update/**',lambda route:route.fulfill(status=200,content_type='application/json',body='{}'))
      page.goto(args.base+path,wait_until='domcontentloaded')
      try:
       page.wait_for_function('(p)=>document.querySelectorAll(p.selector).length>=p.count',arg={'selector':selector,'count':count},timeout=30000)
       page.evaluate('document.fonts.ready');page.wait_for_timeout(350)
       data=page.evaluate('''()=>{
         const rect=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect(),c=getComputedStyle(e);return {width:r.width,height:r.height,top:r.top,left:r.left,bottom:r.bottom,fontSize:c.fontSize,fontWeight:c.fontWeight,lineHeight:c.lineHeight}};
         const rows=[...document.querySelectorAll('.fs-row,tbody tr')].map(e=>e.getBoundingClientRect());
         const controls=[...document.querySelectorAll('main .mantine-Button-root,main .mantine-ActionIcon-root,main .mantine-Input-input')].map(e=>({height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width,label:e.getAttribute('aria-label')||e.textContent.trim()})).filter(r=>r.height>0);
         return {viewport:{width:innerWidth,height:innerHeight},rootFont:getComputedStyle(document.documentElement).fontSize,
           fontFamily:getComputedStyle(document.body).fontFamily,bodyFont:document.querySelector('main')?getComputedStyle(document.querySelector('main')).fontSize:null,
           tableFont:document.querySelector('tbody td')?getComputedStyle(document.querySelector('tbody td')).fontSize:null,
           theme:document.documentElement.dataset.mantineColorScheme,density:document.documentElement.dataset.densite,
           docWidth:document.documentElement.scrollWidth,docHeight:document.documentElement.scrollHeight,
           header:rect('.shell-header'),nav:rect('nav[aria-label="Navigation principale"]'),navLink:rect('.mantine-NavLink-root'),
           title:rect('main h1'),pageHeader:rect('.page-header'),tabs:rect('.onglets-rubriques'),firstRow:rect('.fs-row,tbody tr'),tableHeader:rect('thead'),
           rows:rows.length,fullyVisibleRows:rows.filter(r=>r.top>=0&&r.bottom<=innerHeight).length,
           controls,componentStyles:['.mantine-Input-wrapper','.mantine-Input-input','.barre-boite__outil','.onglets-rubriques a','.risque-action-explicite','.fs-tool'].map(s=>{const e=document.querySelector(s);if(!e)return {selector:s}; const c=getComputedStyle(e);return {selector:s,className:e.className,inlineStyle:e.getAttribute('style'),height:c.height,minHeight:c.minHeight,padding:c.padding,fontSize:c.fontSize,lineHeight:c.lineHeight,inputHeight:c.getPropertyValue('--input-height'),inputSize:c.getPropertyValue('--input-size'),controlHeight:c.getPropertyValue('--suivi-controle-h'),buttonHeight:c.getPropertyValue('--button-height'),aiSize:c.getPropertyValue('--ai-size')}}),planning:rect('.plan-svg'),radar:rect('.pc-radar'),bodyText:document.querySelector('main')?.innerText.slice(0,150)}
       }''')
       data['case']=ident;data['page']=name;data['mode']=density;data['requestedTheme']=theme
       report['layouts'].append(data)
       assert data['docWidth']<=width+1,f'Débordement horizontal document : {data["docWidth"]}>{width}'
       assert data['density']==density,(data['density'],density)
       if not args.no_images:page.screenshot(path=str(out/(ident+'.png')))
       if args.interactions:
        result={'case':ident}
        header=page.locator('.shell-header')
        assert header.locator('.org-signature,.live-badge').count()==0
        switch=header.locator('.theme-bascule')
        assert switch.count()==1 and switch.inner_text().strip()==''
        assert switch.get_attribute('aria-label') and switch.locator('svg').count()==1
        before=page.locator('html').get_attribute('data-mantine-color-scheme')
        switch.click()
        page.wait_for_function('(previous)=>document.documentElement.dataset.mantineColorScheme!==previous',arg=before)
        switch.click()
        page.wait_for_function('(previous)=>document.documentElement.dataset.mantineColorScheme===previous',arg=before)
        result['enteteEtTheme']='OK : signature/état masqués, icône nommée, bascule aller-retour'
        tabs=page.locator('.onglets-rubriques').first
        if tabs.count():
         glass=tabs.evaluate('e=>({fond:getComputedStyle(e).backgroundImage,flou:getComputedStyle(e).backdropFilter})')
         assert 'gradient' in glass['fond'] and 'blur' in glass['flou'],glass
         result['verreOnglets']=glass
        details=page.locator('.a-propos').first
        if details.count():
         assert details.get_attribute('open') is None
         details.locator('summary').focus();page.keyboard.press('Enter')
         assert details.get_attribute('open') is not None
         assert len(details.locator('.a-propos__texte').inner_text())>20
         details.locator('summary').focus();page.keyboard.press('Enter')
         result['aideClavierAccessible']='OK'
        if name=='planning':
         svg=page.locator('.plan-svg')
         ratio=svg.evaluate('(e)=>e.getBoundingClientRect().width/e.viewBox.baseVal.width')
         assert abs(ratio-1)<.01,ratio
         result['rapportSvgViewBox']=ratio
         bar=page.locator('.plan-barre[role="button"]').first
         bar.focus()
         with page.expect_response(lambda r:r.url.endswith('/decalage') and r.request.method=='POST'):
          page.keyboard.press('ArrowRight')
         assert report['ecrituresSimulees'][-1]['body']=={'jours':1}
         with page.expect_response(lambda r:r.url.endswith('/decalage') and r.request.method=='POST'):
          page.keyboard.press('Shift+ArrowLeft')
         assert report['ecrituresSimulees'][-1]['body']=={'jours':-7}
         geometry=svg.evaluate('''e=>{const l=[...e.querySelectorAll('.plan-grille')];const b=e.querySelector('.plan-barre').getBoundingClientRect();return {step:(l[1].x1.baseVal.value-l[0].x1.baseVal.value)/31,x:b.x+b.width/2,y:b.y+b.height/2}}''')
         page.mouse.move(geometry['x'],geometry['y']);page.mouse.down()
         page.wait_for_timeout(100)
         page.mouse.move(geometry['x']+geometry['step']*3,geometry['y'],steps=5)
         page.wait_for_timeout(100)
         with page.expect_response(lambda r:r.url.endswith('/decalage') and r.request.method=='POST'):
          page.mouse.up()
         assert report['ecrituresSimulees'][-1]['body']=={'jours':3},report['ecrituresSimulees'][-1]
         bar.focus();page.keyboard.press('Enter')
         page.get_by_role('dialog').wait_for(state='visible')
         page.keyboard.press('Escape')
         result['clavierEtGlissement']='OK : +1 / -7 / +3 jours, ouverture clavier'
        if name=='vulnerabilites':
         link=page.get_by_role('link',name='Surface externe',exact=True)
         link.focus()
         page.keyboard.press('Shift+Tab');page.keyboard.press('Tab')
         page.get_by_role('tooltip').filter(has_text='Surface externe').wait_for(state='visible')
         result['infobulleAuFocus']='OK'
         # Les préférences explicites et le mural restent disponibles malgré la suppression du zoom auto PC.
         if width>=3840:
          initial=float(page.evaluate('parseFloat(getComputedStyle(document.documentElement).fontSize)'))
          page.evaluate("document.documentElement.dataset.taille='150'")
          page.wait_for_function('Math.abs(parseFloat(getComputedStyle(document.documentElement).fontSize)-24)<.1')
          manuel=float(page.evaluate('parseFloat(getComputedStyle(document.documentElement).fontSize)'))
          assert abs(manuel-24)<.1,{'font':manuel,'html':page.locator('html').get_attribute('data-taille'),'echelle':page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--suivi-echelle')")}
          page.evaluate("document.documentElement.dataset.taille='auto';document.documentElement.setAttribute('data-mur','')")
          page.wait_for_function('parseFloat(getComputedStyle(document.documentElement).fontSize)>24')
          mural=float(page.evaluate('parseFloat(getComputedStyle(document.documentElement).fontSize)'))
          assert mural>manuel,{'manuel':manuel,'mural':mural}
          result['tailles']={'autoPC':initial,'manuel150':manuel,'muralAuto':mural}
        report['interactions'].append(result)
      except Exception as e:
       report['errors'].append({'case':ident,'message':str(e)})
       page.screenshot(path=str(out/(ident+'-ERREUR.png')))
      context.close()
  browser.close()
 (out/'rapport.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'stage':args.stage,'layouts':len(report['layouts']),'errors':report['errors'],'unknownRoutes':sorted(set(x['path'] for x in report['unexpected'])),'mutationsMetier':report['mutationsMetier']},ensure_ascii=False))
 if report['errors'] or report['mutationsMetier'] or report['unexpected']:raise SystemExit(1)

if __name__=='__main__':main()
