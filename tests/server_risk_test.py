"""Recette des invariants métier, autorisations et compteurs sur SQLite temporaire."""
import copy, json, subprocess, tempfile, unittest, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from legacy_server import Store, Problem
ROOT=Path(__file__).resolve().parents[1]
ADMIN={'id':'COMPTE-FICTIF','name':'Compte FICTIF','permission':'admin','perimeterIds':[],'roleIds':[],'canValidate':True}
class RiskServerTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.store=Store(self.tmp.name);self.db=self.store.connect()
        code="const D=require('./modules/demo-data');const s={v:1,schema:15,years:[2026],nextYear:2026,items:[],findings:[],roles:[],frameworks:[]};process.stdout.write(JSON.stringify(D.build(s,'Auteur usurpé FICTIF').state));"
        self.state=json.loads(subprocess.check_output(['node','-e',code],cwd=ROOT))
        self.store.allocate_identifiers(self.state,None,ADMIN,self.db);self.store.validate(self.state,None,ADMIN,self.db);self.db.commit()
    def tearDown(self):self.db.close();self.tmp.cleanup()
    def test_three_risks_two_studies_and_trusted_author(self):
        s=self.state;self.assertEqual(len(s['riskMgmt']['risks']),3);self.assertEqual(len(s['riskMgmt']['studies']),2)
        r=s['riskMgmt']['risks'][0];a=[a for a in s['riskMgmt']['assessments'] if a['riskId']==r['id']]
        self.assertEqual(len(a),2);self.assertNotEqual(a[0]['studyId'],a[1]['studyId'])
        self.assertTrue(all(x['authorId']==ADMIN['id'] and x['author']==ADMIN['name'] for x in a))
        s2=copy.deepcopy(s);s2['riskMgmt']['studies'][0]['status']='Archivée';self.store.validate(s2,s,ADMIN,self.db)
        self.assertEqual(len(s2['riskMgmt']['risks']),3);self.assertEqual(len(s2['riskMgmt']['assessments']),4)
    def test_evaluation_decision_policy_and_risk_history_cannot_be_erased(self):
        for key in ['assessments','decisions','policies','risks']:
            s=copy.deepcopy(self.state);s['riskMgmt'][key].pop()
            with self.assertRaises(Problem):self.store.validate(s,self.state,ADMIN,self.db)
        s=copy.deepcopy(self.state);s['riskMgmt']['assessments'][0]['levelId']='L1'
        with self.assertRaises(Problem):self.store.validate(s,self.state,ADMIN,self.db)
    def test_scoped_editor_sees_inherited_policy_and_can_edit_own_risk(self):
        s=self.state;a=s['perimeters'][1]['id'];u={**ADMIN,'id':'EDITEUR-FICTIF','name':'Éditeur FICTIF','permission':'editor','perimeterIds':[a],'canValidate':False}
        p=self.store.project(s,u);self.assertEqual(len(p['riskMgmt']['risks']),1);self.assertEqual(len(p['riskMgmt']['policies']),1)
        self.assertEqual(len(p['riskMgmt']['assessments']),2);self.assertEqual(len(p['riskMgmt']['studies']),0)
        p['riskMgmt']['risks'][0]['title']='Titre modifié FICTIF';merged=self.store.merge(s,p,u);self.store.allocate_identifiers(merged,s,u,self.db);self.store.validate(merged,s,u,self.db)
        self.assertEqual(len(merged['riskMgmt']['risks']),3)
        p=self.store.project(s,u);p['riskMgmt']['policies'][0]['levels'][0]['color']='#000000'
        with self.assertRaises(Problem):self.store.merge(s,p,u)
    def test_reference_and_acceptance_require_server_validation_permission(self):
        s=self.state;a=s['perimeters'][1]['id'];u={**ADMIN,'permission':'editor','perimeterIds':[a],'canValidate':False}
        p=self.store.project(s,u);p['riskMgmt']['risks'][0]['referenceEvaluationIds']['initial']=None
        m=self.store.merge(s,p,u)
        with self.assertRaises(Problem) as e:self.store.validate(m,s,u,self.db)
        self.assertEqual(e.exception.status,403)
    def test_identifiers_unique_immutable_and_not_reused(self):
        s=self.state;self.assertTrue(s['perimeters'][0]['internalId'].startswith('PERI-'));self.assertTrue(s['pcra']['bias'][0]['internalId'].startswith('IMP-'))
        codes=[r['internalId'] for prefix,paths in __import__('legacy_server').ID_PREFIXES.items() for path in paths for r in __import__('legacy_server').get(s,path)]
        self.assertEqual(len(codes),len(set(codes)))
        m=copy.deepcopy(s);m['perimeters'][0]['internalId']='PERI-999999'
        with self.assertRaises(Problem):self.store.allocate_identifiers(m,s,ADMIN,self.db)
        old=copy.deepcopy(s);removed=s['perimeters'].pop();prior=int(removed['internalId'].split('-')[1]);s['perimeters'].append({'id':'NEW-PERIMETER-FICTIF','name':'Nouveau FICTIF','type':'Établissement'})
        self.store.allocate_identifiers(s,old,ADMIN,self.db)
        self.assertGreater(int(s['perimeters'][-1]['internalId'].split('-')[1]),prior)
    def test_scope_mismatch_and_false_matrix_result_rejected(self):
        s=copy.deepcopy(self.state);s['riskMgmt']['assessments'][0]['perimeterIds']=[s['perimeters'][2]['id']]
        with self.assertRaises(Problem):self.store.validate(s,None,ADMIN,self.db)
        s=copy.deepcopy(self.state);p=s['riskMgmt']['policies'][0];p['calculation']='matrix';p['matrix']={i['id']+':'+v['id']:'L1' for i in p['impactScale'] for v in p['likelihoodScale']}
        with self.assertRaises(Problem):self.store.validate(s,None,ADMIN,self.db)
    def test_physical_closure_does_not_change_residual_reference(self):
        s=copy.deepcopy(self.state);before=s['riskMgmt']['risks'][0]['referenceEvaluationIds']['residual'];s['findings'][0]['status']='Clos'
        self.store.validate(s,self.state,ADMIN,self.db);self.assertEqual(s['riskMgmt']['risks'][0]['referenceEvaluationIds']['residual'],before)
    def test_last_base_roles_and_counter_migration_are_repeatable(self):
        s=copy.deepcopy(self.state);codes=[r['internalId'] for r in s['roles']];self.store.allocate_identifiers(s,self.state,ADMIN,self.db)
        self.assertEqual([r['internalId'] for r in s['roles']],codes);self.assertEqual(len([r for r in s['roles'] if r.get('baseRoleKey')]),10)
        self.assertEqual(self.db.execute('PRAGMA user_version').fetchone()[0],3)
    def test_upgrade_existing_validated_objects_preserves_business_validation(self):
        from legacy_server import without_codes
        old=without_codes(copy.deepcopy(self.state));old['integration'].pop('adminSchema',None)
        incoming=copy.deepcopy(old);revision=old['pcra']['bias'][0]['contentRevision']
        self.store.allocate_identifiers(incoming,old,ADMIN,self.db);self.store.validate(incoming,old,ADMIN,self.db)
        self.assertEqual(incoming['pcra']['bias'][0]['contentRevision'],revision)
        self.assertEqual(incoming['pcra']['bias'][0]['status'],'Validé en interne')
        self.assertEqual(incoming['pcra']['plans'][0]['status'],'Validé en interne')
        self.assertFalse(incoming['pcra']['plans'][0]['needsReview'])
        self.assertEqual(without_codes(incoming['riskMgmt']['assessments']),old['riskMgmt']['assessments'])
    def test_new_policy_requires_validator_and_valid_version_chain(self):
        s=copy.deepcopy(self.state);p=copy.deepcopy(s['riskMgmt']['policies'][0]);p.update({'id':'POLICY-FICTIVE-NEW','internalId':'POL-999999','previousId':p['id'],'version':2});s['riskMgmt']['policies'].append(p)
        with self.assertRaises(Problem) as e:self.store.validate(s,self.state,{**ADMIN,'permission':'editor','canValidate':False},self.db)
        self.assertEqual(e.exception.status,403)
        p['version']=99
        with self.assertRaises(Problem) as e:self.store.validate(s,self.state,ADMIN,self.db)
        self.assertEqual(e.exception.status,422)
    def test_known_hidden_study_cannot_receive_a_new_assessment_from_scoped_editor(self):
        s=self.state;u={**ADMIN,'permission':'editor','perimeterIds':[s['perimeters'][1]['id']],'canValidate':False}
        projected=self.store.project(s,u);evaluation=copy.deepcopy(projected['riskMgmt']['assessments'][0]);evaluation.update({'id':'EVAL-FICTIVE-NEW','internalId':''})
        projected['riskMgmt']['assessments'].append(evaluation);merged=self.store.merge(s,projected,u)
        with self.assertRaises(Problem) as e:self.store.validate(merged,s,u,self.db)
        self.assertEqual(e.exception.status,403)
    def test_annex_a_links_are_scoped_bidirectional_and_audited(self):
        old=copy.deepcopy(self.state);scope=old['perimeters'][1]['id']
        old['items'].append({'id':'A-5.1','ref':'A','title':'Mesure FICTIVE','perimeterIds':[scope]})
        u={**ADMIN,'permission':'editor','perimeterIds':[scope],'canValidate':False}
        incoming=self.store.project(old,u);risk=incoming['riskMgmt']['risks'][0]
        risk.setdefault('objectRefs',[]).append({'kind':'control','id':'A-5.1'})
        incoming['items'][0].setdefault('objectRefs',[]).append({'kind':'risk','id':risk['id']})
        merged=self.store.merge(old,incoming,u);self.store.validate(merged,old,u,self.db)
        changed=next(r for r in merged['riskMgmt']['risks'] if r['id']==risk['id'])
        self.assertIn('objectRefs',changed['history'][-1]['fields'])
        prior=next(r for r in old['riskMgmt']['risks'] if r['id']==risk['id'])
        self.assertEqual(changed['referenceEvaluationIds'],prior['referenceEvaluationIds'])
        self.assertEqual(merged['riskMgmt']['assessments'],old['riskMgmt']['assessments'])
        for target in ('INCONNU','A-5.1'):
            invalid=copy.deepcopy(old);invalid['riskMgmt']['risks'][0].setdefault('objectRefs',[]).append({'kind':'control','id':target})
            with self.assertRaises(Problem) as e:self.store.validate(invalid,old,ADMIN,self.db)
            self.assertEqual(e.exception.status,422)
        hidden=copy.deepcopy(old);hidden['items'][0]['perimeterIds']=[old['perimeters'][2]['id']]
        invalid=copy.deepcopy(hidden);invalid['riskMgmt']['risks'][0].setdefault('objectRefs',[]).append({'kind':'control','id':'A-5.1'})
        invalid['items'][0]['objectRefs']=[{'kind':'risk','id':invalid['riskMgmt']['risks'][0]['id']}]
        with self.assertRaises(Problem) as e:self.store.validate(invalid,hidden,u,self.db)
        self.assertEqual(e.exception.status,403)
        viewer={**u,'permission':'viewer'}
        with self.assertRaises(Problem) as e:self.store.merge(old,incoming,viewer)
        self.assertEqual(e.exception.status,403)
if __name__=='__main__':unittest.main()
