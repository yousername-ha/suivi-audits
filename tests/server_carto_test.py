"""Références et droits des cartes, sans données réelles."""
import copy, tempfile, unittest, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from legacy_server import Store, Problem
from legacy_cartography import validate_maps, hashed
ADMIN={'id':'ADMIN-FICTIF','name':'Auteur FICTIF','permission':'admin','perimeterIds':[],'canValidate':True}
EDITOR={**ADMIN,'id':'ED-FICTIF','permission':'editor','perimeterIds':['A']}
NODE={'x':0,'y':0,'w':200,'h':80,'label':'Activité FICTIVE'}
class CartographyTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.store=Store(self.tmp.name)
        self.s={'v':1,'items':[],'findings':[],'years':[2026], 'perimeters':[{'id':'G','name':'G FICTIF','type':'GHT'},{'id':'A','name':'A FICTIF','type':'Établissement','parentId':'G'},{'id':'B','name':'B FICTIF','type':'Établissement','parentId':'G'}], 'processes':[{'id':'PA','name':'Activité FICTIVE','perimeterIds':['A']},{'id':'PB','name':'Objet secret FICTIF','perimeterIds':['B']}], 'cartography':{'schema':1,'maps':[{'id':'M','view':'context','perimeterIds':['A'],'nodes':{'process:PA':copy.deepcopy(NODE)},'edges':[],'versions':[]}]}}
    def tearDown(self):self.tmp.cleanup()
    def validate(self,s,old=None,u=ADMIN):validate_maps(s,old,u,self.store,Problem)
    def test_own_map_and_ancestor_consolidation(self):
        self.validate(self.s);s=copy.deepcopy(self.s);s['cartography']['maps'][0]['perimeterIds']=['G'];s['cartography']['maps'][0]['nodes']['process:PB']=NODE.copy();self.validate(s)
    def test_foreign_node_and_version_rejected(self):
        for historical in [False,True]:
            s=copy.deepcopy(self.s);m=s['cartography']['maps'][0]
            if historical:m['versions']=[{'id':'V','map':{'nodes':{'process:PB':NODE.copy()}}}]
            else:m['nodes']['process:PB']=NODE.copy()
            with self.assertRaises(Problem):self.validate(s,self.s)
    def test_invalid_sizes_unknown_relations_and_volume(self):
        for change in ['nan','edge','count']:
            s=copy.deepcopy(self.s);m=s['cartography']['maps'][0]
            if change=='nan':m['nodes']['process:PA']['x']=float('nan')
            elif change=='edge':m['edges']=[{'id':'E','s':'process:PA','t':'process:PB','type':'related_to'}]
            else:m['nodes']={f'process:{i}':NODE.copy() for i in range(401)}
            with self.assertRaises(Problem):self.validate(s)
    def test_historical_label_reclassification_redacted_and_readonly(self):
        self.s['cartography']['maps'][0]['versions']=[{'id':'V','map':{'nodes':{'process:PA':NODE.copy()},'edges':[]}}]
        self.s['processes'][0]['perimeterIds']=['B'];out=self.store.project(self.s,EDITOR);m=out['cartography']['maps'][0]
        self.assertTrue(m['restricted']);self.assertNotIn('process:PA',m['nodes']);self.assertEqual(m['versions'][0]['map']['nodes'],{})
        self.assertNotIn('Activité FICTIVE',str(out));merged=self.store.merge(self.s,out,EDITOR);self.assertEqual(merged['cartography']['maps'],self.s['cartography']['maps'])
        out['cartography']['maps'][0]['nodes']['scope']=NODE.copy()
        with self.assertRaises(Problem):self.store.merge(self.s,out,EDITOR)
    def test_private_and_foreign_maps_not_projected_and_hidden_preserved(self):
        self.s['cartography']['maps'].append({'id':'H','view':'process','perimeterIds':[],'nodes':{},'edges':[]})
        self.s['cartography']['maps'].append({'id':'BMAP','view':'context','perimeterIds':['B'],'nodes':{},'edges':[]})
        out=self.store.project(self.s,EDITOR);self.assertEqual(len(out['cartography']['maps']),1)
        merged=self.store.merge(self.s,out,EDITOR);self.validate(merged,self.s,EDITOR);self.assertEqual(len(merged['cartography']['maps']),3)
    def test_server_authorship_and_version_immutable(self):
        s=copy.deepcopy(self.s);s['cartography']['maps'][0]['versions']=[{'id':'V','label':'COPIL FICTIF','author':'Usurpation','map':{'nodes':{'process:PA':NODE.copy()},'edges':[]}}];self.validate(s,self.s)
        self.assertEqual(s['cartography']['maps'][0]['versions'][0]['author'],'Auteur FICTIF');new=copy.deepcopy(s);new['cartography']['maps'][0]['versions'][0]['map']['nodes']['process:PA']['x']=1
        with self.assertRaises(Problem):self.validate(new,s)
    def test_gone_node_preserved_but_forged_new_label_rejected(self):
        new=copy.deepcopy(self.s);new['processes']=[];self.validate(new,self.s);new['cartography']['maps'][0]['nodes']['process:PA']['label']='Autre donnée'
        with self.assertRaises(Problem):self.validate(new,self.s)
    def test_map_prefix_allocated_and_viewer_write_rejected(self):
        with self.store.connect() as db:self.store.allocate_identifiers(self.s,None,ADMIN,db)
        self.assertRegex(self.s['cartography']['maps'][0]['internalId'],r'^MAP-\d{6}$')
        with self.assertRaises(Problem):self.store.merge(self.s,self.s,{**EDITOR,'permission':'viewer'})
    def test_issue_reference_uses_actual_source_scope(self):
        self.s['objectives']=[{'id':'O','perimeterIds':['B'],'enjeux':['Cybermenace: explication FICTIVE']}]
        self.s['cartography']['maps'][0]['nodes']['issue:'+hashed('Cybermenace')]=NODE.copy()
        with self.assertRaises(Problem):self.validate(self.s)
if __name__=='__main__':unittest.main()
