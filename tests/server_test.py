"""Fixtures synthétiques : sessions, cloisonnement, pièces et concurrence."""
import sys, tempfile, unittest, threading, secrets, urllib.request, urllib.error, json, http.cookiejar, functools
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from legacy_server import Store, Handler, ThreadingHTTPServer

class ServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.password = secrets.token_urlsafe(30)
        cls.account_password = secrets.token_urlsafe(30)
        cls.tmp = tempfile.TemporaryDirectory()
        Handler.store = Store(cls.tmp.name)
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(Path(__file__).resolve().parents[1])))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True); cls.thread.start()
        cls.url = 'http://127.0.0.1:' + str(cls.server.server_port)
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.server.server_close(); cls.tmp.cleanup()
    def client(self):
        return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def call(self, client, path, method='GET', data=None, csrf='', raw=None, origin=True):
        headers = {'Content-Type':'application/json', 'X-CSRF-Token':csrf}
        if origin: headers['Origin']=self.url
        body = raw if raw is not None else json.dumps(data).encode() if data is not None else None
        req=urllib.request.Request(self.url+path,data=body,method=method,headers=headers)
        try:
            with client.open(req) as r:
                blob=r.read();return r.status,json.loads(blob) if r.headers.get('Content-Type','').startswith('application/json') else blob
        except urllib.error.HTTPError as e:return e.code,json.loads(e.read())
    def test_01_end_to_end_auth_scopes_files_versions(self):
        a=self.client(); self.assertEqual(self.call(a,'/api/state')[0],401)
        status,auth=self.call(a,'/api/setup','POST',{'login':'recette_admin','password':self.password,'name':'Administration fictive'})
        self.assertEqual(status,200); token=auth['csrf']
        self.assertEqual(self.call(a,'/api/setup','POST',{},token)[0],409)
        self.assertEqual(self.call(a,'/api/state','PUT',{},origin=False)[0],403)
        self.assertEqual(self.call(a,'/api/state','PUT',{})[0],403)
        self.assertEqual(self.call(a,'/api/files/FILE-1','PUT',csrf=token,raw=b'preuve fictive')[0],200)
        import hashlib
        s={'v':1,'schema':15,'items':[],'years':[2026],'findings':[{'id':'ACTION-A','text':'Action A','perimeterIds':['A']},{'id':'ACTION-B','text':'Action B','perimeterIds':['B']}], 'perimeters':[{'id':'G','name':'GHT fictif','type':'GHT','parentId':''},{'id':'A','name':'Centre A fictif','type':'Établissement','parentId':'G'},{'id':'B','name':'Centre B fictif','type':'Établissement','parentId':'G'}], 'evidences':[{'id':'PROOF-A','perimeterIds':['A'],'dfVersions':[{'id':'V1','fileKey':'FILE-1','size':14,'sha256':hashlib.sha256(b'preuve fictive').hexdigest()}]}]}
        status,res=self.call(a,'/api/state','PUT',{'version':0,'state':s},token);self.assertEqual(status,200,res)
        self.assertEqual(self.call(a,'/api/state','PUT',{'version':0,'state':s},token)[0],409)
        users=[]
        for name,pids,permission in [('a',['A'],'editor'),('b',['B'],'viewer'),('ght',['G'],'viewer')]:
            data={'login':'recette_'+name,'name':'Compte fictif '+name,'password':self.account_password,'permission':permission,'perimeterIds':pids}
            status,usr=self.call(a,'/api/users','POST',data,token);self.assertEqual(status,200,usr)
            c=self.client();status,session=self.call(c,'/api/login','POST',data);self.assertEqual(status,200);users.append((c,session['csrf']))
        c,ct=users[0];status,res=self.call(c,'/api/state');self.assertEqual([f['id'] for f in res['state']['findings']],['ACTION-A'])
        res['state']['findings'][0]['text']='Modification autorisée'
        status,changed=self.call(c,'/api/state','PUT',res,ct);self.assertEqual(status,200,changed)
        _,full=self.call(a,'/api/state');self.assertEqual(full['state']['findings'][1]['text'],'Action B')
        _,sub=self.call(c,'/api/state');sub['state']['findings'][0]['perimeterIds']=['B']
        self.assertEqual(self.call(c,'/api/state','PUT',sub,ct)[0],403)
        self.assertEqual(self.call(users[1][0],'/api/files/FILE-1')[0],403)
        self.assertEqual(self.call(c,'/api/files/FILE-1')[1],b'preuve fictive')
        self.assertEqual(len(self.call(users[2][0],'/api/state')[1]['state']['findings']),2)
        self.assertEqual(self.call(users[1][0],'/api/state','PUT',full,users[1][1])[0],403)
        self.assertEqual(self.call(c,'/api/users','POST',{},ct)[0],403)
        self.assertEqual(self.call(a,'/.legacy-data/legacy.sqlite3')[0],404)
        self.assertEqual(self.call(a,'/.git/config')[0],404)
        self.assertEqual(self.call(a,'/api/files/FILE-1','PUT',csrf=token,raw=b'change')[0],409)
        _,bad=self.call(a,'/api/state')
        bad['state']['findings'][0]['id']='ACTION-" onmouseover="alert(1)'
        self.assertEqual(self.call(a,'/api/state','PUT',bad,token)[0],422)
        self.assertEqual(self.call(a,'/api/state')[1]['state']['findings'][0]['id'],'ACTION-A')
        self.assertTrue(self.call(a,'/api/audit')[1]['events'])
        self.assertEqual(self.call(a,'/api/logout','POST',{},token)[0],200)
        self.assertEqual(self.call(a,'/api/state')[0],401)
    def test_02_canonical_journey_ignores_forged_progress(self):
        with tempfile.TemporaryDirectory() as folder:
            st=Store(folder)
            state={'v':1,'items':[],'years':[2026],'findings':[], 'perimeters':[{'id':'A','name':'Centre fictif','type':'Établissement'}], 'journey':{'runs':[{'id':'J1','perimeterIds':['A'],'steps':[{'id':'inventé','status':'Terminé'}],'progress':100}], 'tasks':[{'id':'T1','journeyId':'J1','stepId':'context','perimeterIds':['A'],'businessRef':None,'completionRequested':True,'status':'Terminé','mandatory':True,'requiresValidation':True}]}}
            st.reconcile(state)
            self.assertEqual(state['journey']['tasks'][0]['status'],'Bloqué')
            self.assertEqual(len(state['journey']['runs'][0]['steps']),12)
            self.assertNotEqual(state['journey']['runs'][0]['progress'],100)
            state['journey']['tasks'][0]['dependsOn']=['T1']
            from legacy_server import Problem
            with self.assertRaises(Problem):st.reconcile(state)

    def test_03_projection_hides_history_and_preserves_hidden_records_on_write(self):
        with tempfile.TemporaryDirectory() as folder:
            st=Store(folder)
            s={'v':1,'years':[2026],'items':[], 'perimeters':[{'id':'G','name':'GHT fictif','type':'GHT'}, {'id':'A','name':'Centre A fictif','type':'Établissement','parentId':'G'},{'id':'B','name':'Centre B fictif','type':'Établissement','parentId':'G'}], 'findings':[{'id':'FA','text':'Action A','perimeterIds':['A'],'history':[{'snapshot':{'confidential':'MARQUEUR_FICTIF_INTERDIT'}}],'objectRefs':[{'kind':'action','id':'FB'}]},{'id':'FB','text':'Action B privée','perimeterIds':['B']}], 'frameworks':[{'id':'FW','requirements':[{'id':'R1','title':'Exigence publique fictive','self':'Évaluation privée fictive','maps':[{'item':'PRIVATE'}]}]}]}
            user={'id':'U1','permission':'editor','perimeterIds':['A'],'roleIds':[],'canValidate':False,'name':'Recette'}
            projected=st.project(s,user)
            self.assertEqual(projected['perimeters'][0]['parentId'],'')
            self.assertTrue(projected['perimeters'][0]['restrictedParent'])
            self.assertNotIn('MARQUEUR_FICTIF_INTERDIT',json.dumps(projected))
            self.assertEqual(projected['findings'][0]['objectRefs'],[])
            self.assertEqual(projected['frameworks'][0]['requirements'][0]['self'],'')
            projected['findings'][0]['text']='Action A corrigée'
            merged=st.merge(s,projected,user)
            self.assertEqual(merged['perimeters'][1]['parentId'],'G')
            self.assertEqual(merged['findings'][1],s['findings'][1])
            self.assertEqual(merged['findings'][0]['history'],s['findings'][0]['history'])
            self.assertEqual(merged['findings'][0]['objectRefs'][0]['id'],'FB')

    def test_04_validation_permission_checked_without_browser(self):
        from legacy_server import Problem
        with tempfile.TemporaryDirectory() as folder:
            st=Store(folder)
            s={'v':1,'items':[],'years':[2026],'findings':[], 'perimeters':[{'id':'A','name':'Centre fictif','type':'Établissement'}], 'journey':{'runs':[{'id':'J','perimeterIds':['A']}],'tasks':[{'id':'T','journeyId':'J','stepId':'scope','perimeterIds':['A'],'validation':{'date':'2026-10-11','dataSnapshot':{}}}]}}
            u={'id':'U','permission':'editor','perimeterIds':['A'],'canValidate':False,'name':'Compte fictif'}
            with st.connect() as db:
                with self.assertRaises(Problem) as failure:st.validate(s,{'v':1},u,db)
                self.assertEqual(failure.exception.status,403)

    def test_05_bia_change_reopens_plan_on_server(self):
        with tempfile.TemporaryDirectory() as folder:
            st=Store(folder)
            policy={'id':'POL','title':'Politique fictive','perimeterIds':['A'],'horizons':[{'id':'H','label':'1 heure','hours':1}], 'dimensions':[{'id':'D','label':'Patient'}], 'levels':[{'id':'L','label':'Important','rank':3,'color':'#d6b979'}]}
            activity={'id':'ACT','name':'Activité fictive','maxInterruptionHours':4,'rtoBusinessHours':2,'impacts':{'H':{'D':'L'}},**{key:'Contenu fictif' for key in ('minimumService','humanNeeds','materialNeeds','siNeeds','buildingNeeds','supplierNeeds','dependencies','workarounds','justification')}}
            bia={'id':'BIA','title':'BIA fictif','policyId':'POL','perimeterIds':['A'],'activities':[activity],'contentRevision':1,'validation':{'contentRevision':1},'status':'Validé en interne'}
            plan={'id':'PCA','kind':'PCA','biaId':'BIA','biaRevision':1,'perimeterIds':['A'],'activityIds':['ACT'],'version':1,'validation':{'version':1,'biaRevision':1},**{key:'Contenu fictif' for key in ('activation','procedure','communication','resources','dependencies','returnToNormal')}}
            state={'perimeters':[{'id':'A','name':'Centre fictif','type':'Établissement'}],'pcra':{'policies':[policy],'bias':[bia],'plans':[plan]}}
            old=json.loads(json.dumps(state));activity['maxInterruptionHours']=3
            st.validate_pcra(state,old,{'permission':'admin'})
            self.assertEqual(bia['contentRevision'],2)
            self.assertEqual(bia['status'],'À réévaluer')
            self.assertEqual(plan['status'],'À réévaluer')
            self.assertTrue(plan['needsReview'])

if __name__=='__main__':unittest.main()
