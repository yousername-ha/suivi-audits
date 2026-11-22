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
 'aide':('/aide','.barre-boite',1),
 'admin':('/admin/audit','.barre-boite',1),
 'failles':('/vulnerabilites/failles','.barre-boite',1),
 'machines':('/vulnerabilites/machines','.barre-boite',1),
 'alertes':('/vulnerabilites/alertes','.barre-boite',1),
 'documents':('/documents','.barre-boite',1),
 'bibliotheque':('/pilotage/bibliotheque','.barre-boite',1),
}

def main():
 ap=argparse.ArgumentParser()
 ap.add_argument('--base',default='http://127.0.0.1:5173')
 ap.add_argument('--chromium',default='/usr/bin/chromium')
 ap.add_argument('--stage',required=True,choices=['avant','apres','essai'])
 ap.add_argument('--out',default=str(ROOT/'captures'))
 ap.add_argument('--pages',default=','.join(PAGES))
 ap.add_argument('--sizes',default='1440x900,1920x1080')
 ap.add_argument('--themes',default='clair,sombre')
 ap.add_argument('--densities',default='compacte,normale')
 ap.add_argument('--taille',default='100',choices=['auto','90','100','115','130','150'])
 ap.add_argument('--pixel-ratio',type=float,default=1)
 ap.add_argument('--no-images',action='store_true')
 ap.add_argument('--interactions',action='store_true')
 ap.add_argument('--fenetres',action='store_true')
 args=ap.parse_args()
 out=Path(args.out)/args.stage;out.mkdir(parents=True,exist_ok=True)
 fixture=json.loads((ROOT.parent.parent/'propositions/fenetres-maintenance-2026-11-22/outils/fixtures.json').read_text())
 report={'kind':'Frontend réel Vite, API entièrement interceptée, données fictives ; pas de recette serveur',
   'stage':args.stage,'base':args.base,'date':'2026-11-22','taille':args.taille,'layouts':[],'errors':[],'unexpected':[],'mutationsMetier':[],'interactions':[],'ecrituresSimulees':[],'fenetres':[],'requetesLecture':[]}
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path=args.chromium,headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
  for size in args.sizes.split(','):
   width,height=map(int,size.split('x'))
   for theme in args.themes.split(','):
    for density in args.densities.split(','):
     for name in args.pages.split(','):
      path,selector,count=PAGES[name]
      ident=f'{name}-{width}-{height}-{theme}-{density}'
      context=browser.new_context(viewport={'width':width,'height':height},device_scale_factor=args.pixel_ratio,locale='fr-FR',reduced_motion='reduce')
      page=context.new_page()
      me=deepcopy(fixture['me']);me['preferences'].update({'theme':theme,'densite':density,'taille':args.taille})
      page.on('pageerror',lambda e,ident=ident:report['errors'].append({'case':ident,'message':str(e)}))
      def handle(route):
       request=route.request;u=urlsplit(request.url);q=parse_qs(u.query);path=u.path;method=request.method
       def reply(body,status=200):return route.fulfill(status=status,content_type='application/json',body=json.dumps(body))
       if method=='GET':report['requetesLecture'].append({'case':ident,'path':path,'query':q})
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
       if path=='/api/admin/audit':return reply([{'id':1,'at':'2026-11-21T10:00:00Z','user_id':'recette','username':'compte_recette','action':'lecture','target':'objet fictif','ip':'192.0.2.10','detail':{}}])
       if path in ['/api/documents','/api/documents/categories','/api/documents/tags','/api/refs','/api/library/frameworks','/api/library/tracker-import']:return reply([])
       if path.endswith('/couverture'):return reply({'frameworks':[]})
       if path.endswith('/framework-attachments'):return reply([])
       if path.endswith('/sources'):return reply({'items':[]})
       if path=='/api/vulnerabilites/responsables':return reply(fixture['responsables'])
       if path.endswith('/owners'):
        return reply(fixture['owners'])
       if path.endswith('/responsables'):return reply(fixture['responsables'])
       if path.endswith('/history'):return reply([])
       if path.endswith('/links'):return reply([])
       if re.fullmatch('/api/suppliers/[^/]+/evaluations',path):return reply([])
       if path in ['/api/vulnerabilites/constats','/api/vulnerabilites/declarees','/api/vulnerabilites/correctifs']:return reply({'elements':[],'total':0,'page':1,'parPage':50})
       if path=='/api/vulnerabilites/machines':return reply({'elements':[],'total':0,'page':1,'parPage':50,'sansRole':0})
       if path=='/api/library/ia-kit':return reply({'version':1,'modele':{},'instructions':'Données fictives de recette.'})
       if path=='/api/vulnerabilites/perimetres':return reply([])
       if path=='/api/vulnerabilites/machines/perimetres':return reply([])
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
       if path=='/api/vulnerabilites/alertes/fenetre':return reply({'alertes':[],'total':0,'enCours':0,'peutPrendreEnCompte':True})
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
       if args.fenetres:
        inspecter(page,name,ident,width,height,out,report)
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
 if report['errors'] or report['unexpected'] or report['mutationsMetier']:raise SystemExit(1)

def inspecter(page,name,ident,width,height,out,report):
 import re
 from urllib.parse import urlsplit,parse_qs
 bilan={'case':ident,'points':[],'dialogues':[]}
 barres=page.locator('.barre-boite')
 if barres.count():
  fonds=barres.evaluate_all('(xs)=>[...new Set(xs.map(e=>getComputedStyle(e).backgroundImage))]')
  assert len(fonds)==1 and 'gradient' in fonds[0],fonds
  bilan['points'].append('Une seule apparence de boîte d’outils')
 if name=='risques':
  centres=page.locator('.risque-commande').evaluate_all('''xs=>xs.map(e=>{const r=e.getBoundingClientRect(),s=e.querySelector('svg').getBoundingClientRect();return {dx:Math.abs((r.x+r.width/2)-(s.x+s.width/2)),dy:Math.abs((r.y+r.height/2)-(s.y+s.height/2))}})''')
  assert all(c['dx']<1 and c['dy']<1 for c in centres),centres
  bilan['centrage']=centres
  bilan['points'].append('Pictogrammes des 24 commandes centrés à moins de 1 px')
 bouton=page.get_by_role('button',name=re.compile('^Filtres avancés')).first
 if bouton.count():
  bouton.click()
  panel=page.locator('.filtres-avances').filter(visible=True).first
  panel.wait_for(state='visible')
  rect=panel.bounding_box();assert rect['x']>=-1 and rect['x']+rect['width']<=width+1,rect
  # Un panneau peut être dans les limites et néanmoins recouvert par le tableau voisin.
  occultes=panel.evaluate('''e=>{const p=e.getBoundingClientRect();return [...e.querySelectorAll('input:not([type=hidden]),button,select')].filter(c=>{const r=c.getBoundingClientRect();return r.width&&r.height&&r.y+r.height/2>p.y&&r.y+r.height/2<p.bottom}).filter(c=>{const r=c.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return !e.contains(top)}).map(c=>c.getAttribute('aria-label')||c.id||c.tagName)}''')
  assert not occultes,{'controlesRecouverts':occultes}
  bilan['points'].append('Contrôles du panneau au premier plan, sans recouvrement par les tableaux')
  if name in ['fournisseurs','failles','admin','produits']:page.screenshot(path=str(out/(ident+'-filtres.png')))
  if name=='admin':
   compte=panel.get_by_role('textbox',name='Compte',exact=True)
   assert compte.evaluate('e=>e.form===e.closest("form")'), 'Champ sorti du formulaire'
   compte.fill('compte_recette')
  if name=='failles':
   priorite=panel.get_by_role('combobox',name='Priorité',exact=True)
   priorite.click();page.get_by_role('option',name='P1',exact=True).click()
  page.keyboard.press('Escape');panel.wait_for(state='hidden')
  page.wait_for_function('document.activeElement?.classList.contains("barre-boite__outil")')
  bilan['points'].append('Filtres : ouverture, dimensions, Échap et retour du focus')
 search=page.locator('.barre-boite__recherche input').first
 if search.count():
  page.locator('main h1').first.click()
  page.keyboard.press('/')
  assert search.evaluate('e=>e===document.activeElement'),'Raccourci / intercepté par un panneau fermé'
  bilan['points'].append('Raccourci / disponible après fermeture du panneau')
 if name=='admin':
  search.fill('auditdemo')
  with page.expect_response(lambda r:urlsplit(r.url).path=='/api/admin/audit' and parse_qs(urlsplit(r.url).query).get('q')==['auditdemo']):search.press('Enter')
  req=next(x for x in reversed(report['requetesLecture']) if x['case']==ident and x['path']=='/api/admin/audit')
  assert req['query'].get('user')==['compte_recette'],req
  bilan['points'].append('Entrée soumet la recherche ET le filtre Compte saisi dans le panneau fermé')
 def ouvrir(opener,nom):
  opener.click()
  dlg=page.get_by_role('dialog').last;dlg.wait_for(state='visible')
  page.wait_for_timeout(150)
  page.wait_for_timeout(300)
  dimensions=dlg.evaluate('''e=>{const r=e.getBoundingClientRect(),h=e.querySelector('.mantine-Modal-header'),b=e.querySelector('.mantine-Modal-body');return {x:r.x,y:r.y,width:r.width,height:r.height,entete:h?.getBoundingClientRect().height,policeTitre:h?getComputedStyle(h.querySelector('.mantine-Modal-title')).fontSize:null,bodyClient:b?.clientWidth,bodyScroll:b?.scrollWidth,bodyClientH:b?.clientHeight,bodyScrollH:b?.scrollHeight,champs:[...e.querySelectorAll('.mantine-InputWrapper-root')].map(r=>{let l=r.querySelector('.mantine-InputWrapper-label'),c=r.querySelector('input:not([type=hidden]),select,textarea'),d=r.querySelector('.mantine-InputWrapper-description');let q=c?.getBoundingClientRect(),a=l?.getBoundingClientRect(),z=d?.getBoundingClientRect();return {nom:l?.textContent,classes:r.className,x:q?.x,y:q?.y,largeur:q?.width,hauteur:q?.height,labelX:a?.x,labelY:a?.y,descriptionY:d?.getClientRects().length?z?.y:null}})}}''')
  assert dimensions['x']>=-1 and dimensions['x']+dimensions['width']<=width+1,dimensions
  assert abs(dimensions['x']+dimensions['width']/2-width/2)<1,dimensions
  assert abs(dimensions['y']+dimensions['height']/2-height/2)<1,dimensions
  assert dimensions['y']>=-1 and dimensions['y']+dimensions['height']<=height+1,dimensions
  assert dimensions['bodyScrollH']<=dimensions['bodyClientH']+1,dimensions
  assert dimensions['entete']<=90,dimensions
  # Mesures d'alignement : le bord du contrôle (et non son texte intérieur) rejoint celui de son libellé.
  police=float(page.evaluate('parseFloat(getComputedStyle(document.documentElement).fontSize)'))
  for c in dimensions['champs']:
   if c.get('x') is None or c.get('labelX') is None or c.get('largeur',0)<30:continue
   if 'MultiSelect' not in c['classes'] and 'barre-boite__recherche' not in c['classes']:assert abs(c['x']-c['labelX'])<1,(nom,c)
   if c.get('descriptionY') is not None:assert c['descriptionY']>=c['y']+c['hauteur']-1,(nom,c)
  if name=='risques' and nom=='fiche':
   code=next(c for c in dimensions['champs'] if c.get('nom')=='Code');assert code['largeur']<=10*police+1,code
   responsable=dlg.get_by_role('combobox',name='Responsable',exact=True)
   responsable.click()
   choix='Responsable fictif de la coordination sécurité et continuité des activités'
   option=page.get_by_role('option',name=choix,exact=True);option.wait_for(state='visible')
   menu=page.locator('.mantine-Select-dropdown:visible, .mantine-Combobox-dropdown:visible').last;rect=menu.bounding_box()
   assert rect['width']<=32*police+1 and rect['x']>=-1 and rect['x']+rect['width']<=width+1,rect
   page.screenshot(path=str(out/(ident+'-responsable-choix-long.png')))
   option.click();assert responsable.input_value()==choix
   responsable.click();page.get_by_role('option',name='Camille Exemple',exact=True).click()
   assert responsable.input_value()=='Camille Exemple'
   bilan['points'].append('Code court, noms longs lisibles dans un menu borné et sélection conservée')
  if name=='produits':
   aides=dlg.locator('.champ-aide-bouton:visible')
   assert aides.count()>=3,'Aides React attendues'
   aide=aides.first
   aide.click();page.wait_for_timeout(100)
   assert aide.get_attribute('aria-expanded')=='true'
   controle=aide.get_attribute('aria-controls')
   assert page.locator('[id="'+controle+'"]').is_visible()
   aide.focus();page.keyboard.press('Escape');page.wait_for_timeout(100)
   assert aide.get_attribute('aria-expanded')=='false' and dlg.is_visible()
   dlg.locator('.mantine-Modal-title').click()
   bilan['points'].append('Aide React native : description originale accessible, ouverture et Échap sans fermeture de la fiche')
  page.screenshot(path=str(out/(ident+'-fenetre-'+nom+'.png')))
  dlg.screenshot(path=str(out/(ident+'-detail-'+nom+'.png')))
  mini=dlg.get_by_role('navigation',name='Parties de la fiche')
  if mini.count():
   boutons=mini.get_by_role('button');total=boutons.count()
   for i in range(total):
    boutons.nth(i).click()
    page.wait_for_timeout(60)
    m=dlg.locator('.mantine-Modal-body').evaluate('b=>({h:b.clientHeight,sh:b.scrollHeight,x:b.scrollLeft,w:b.clientWidth,sw:b.scrollWidth})')
    assert m['sh']<=m['h']+1,(nom,i,m)
    page.screenshot(path=str(out/(ident+'-fenetre-'+nom+'-partie-'+str(i+1)+'.png')))
   boutons.nth(0).click()
   if name=='risques' and nom=='fiche':
    premier=dlg.get_by_role('textbox',name='Nom de la fiche',exact=True)
    premier.fill('Risque fictif conservé entre les parties')
    analyse=dlg.get_by_role('textbox',name='Menace',exact=True)
    analyse.focus();analyse.fill('Commentaire fictif conservé')
    boutons.nth(0).click()
    assert premier.input_value()=='Risque fictif conservé entre les parties'
    assert analyse.input_value()=='Commentaire fictif conservé'
    boutons.nth(0).focus();page.keyboard.press('ArrowRight');page.wait_for_timeout(80)
    assert boutons.nth(1).get_attribute('aria-current')=='page'
    page.keyboard.press('Home');page.wait_for_timeout(80)
    assert boutons.nth(0).get_attribute('aria-current')=='page'
    summary=dlg.locator('summary').filter(has_text='Liens et preuves');summary.click();page.wait_for_timeout(250)
    m=dlg.locator('.mantine-Modal-body').evaluate('b=>({h:b.clientHeight,sh:b.scrollHeight})')
    assert m['sh']<=m['h']+1,{'liensDeplies':m}
    summary.click();page.wait_for_timeout(80)
    bilan['points'].append('Saisies conservées entre parties, focus et clavier du mini-menu, liens dépliés sans débordement vertical')
   bilan['points'].append(f'{nom} : {total} parties sans débordement vertical')
  bilan['dialogues'].append({'nom':nom,'dimensions':dimensions})
  if name=='produits':
   dlg.get_by_role('button',name='Annuler',exact=True).click()
   bilan['points'].append('Annuler natif ferme la fiche sans écriture métier')
  else:dlg.locator('.mantine-Modal-close').click()
  dlg.wait_for(state='hidden')
 if name=='fournisseurs':
  ouvrir(page.get_by_role('button',name='Ajouter un fournisseur',exact=True),'creation')
  ouvrir(page.locator('.fs-row').first,'fiche')
  ouvrir(page.get_by_role('button',name=re.compile('Évaluer le fournisseur')).first,'evaluation')
 if name=='risques':
  ouvrir(page.get_by_role('button',name='Ajouter un risque',exact=True),'creation')
  ouvrir(page.get_by_role('button',name=re.compile('^Ouvrir ')).first,'fiche')
  ouvrir(page.get_by_role('button',name=re.compile('^Liens et preuves de ')).first,'liens')
 if name=='produits':
  ouvrir(page.get_by_role('button',name='Ajouter un produit',exact=True),'creation')
 report['fenetres'].append(bilan)

if __name__=='__main__':main()
