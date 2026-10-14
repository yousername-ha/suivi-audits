"""Contrôles du dossier proposé, sans accès aux données ARM réelles ou au runtime."""
from pathlib import Path
import json,csv,copy,re
from jsonschema import Draft202012Validator
D=Path(__file__).resolve().parents[1]
def read(p):return json.loads((D/p).read_text())
schema=read('contrats/bundle.schema.json');Draft202012Validator.check_schema(schema);struct=Draft202012Validator(schema)
def validate(b):
 struct.validate(b);ss={x['id']:x for x in b['scales']};ms={x['id']:x for x in b['matrices']}
 assert len(ss)==len(b['scales']) and len(ms)==len(b['matrices']),'Duplicate version ID'
 assert not set(ss)&set(ms),'Ambiguous version ID'
 for s in ss.values():
  levels=s['levels'];assert len({x['id'] for x in levels})==len(levels),'Duplicate level ID';assert len({x['order'] for x in levels})==len(levels),'Duplicate order'
  for l in levels:
   if s['mode']=='quantitative':assert l.get('numericValue') is not None and l.get('unit'),'Quantitative level missing value/unit'
 for m in ms.values():
  r=ss[m['rowScaleVersionId']];c=ss[m['columnScaleVersionId']];out=ss[m['resultScaleVersionId']];expected={(x['id'],y['id']) for x in r['levels'] for y in c['levels']};actual=[(x['rowLevelId'],x['columnLevelId']) for x in m['cells']]
  assert len(actual)==len(set(actual)) and set(actual)==expected,'Incomplete or duplicate matrix';assert all(x['resultLevelId'] in {v['id'] for v in out['levels']} for x in m['cells']),'Unknown output level'
 assert all(v in set(ss)|set(ms) for v in b['context']['configBindings'].values()),'Unresolved binding'
b=read('contrats/bundle-exemple.json');validate(b);checks=['Schéma JSON Draft 2020-12 valide','Fixture synthétique conforme au schéma et invariants','Références et cellules complètes']
mutations=[('cellule absente',lambda x:x['matrices'][0]['cells'].pop()),('cellule dupliquée',lambda x:x['matrices'][0]['cells'].append(copy.deepcopy(x['matrices'][0]['cells'][0]))),('résultat étranger',lambda x:x['matrices'][0]['cells'][0].update(resultLevelId='inconnu')),('ordre dupliqué',lambda x:x['scales'][0]['levels'][1].update(order=1)),('affectation introuvable',lambda x:x['context']['configBindings'].update(relevance='inconnu')),('quantitatif sans valeur',lambda x:x['scales'][0].update(mode='quantitative'))]
for name,mut in mutations:
 x=copy.deepcopy(b);mut(x)
 try:validate(x)
 except (AssertionError,KeyError):checks.append('Rejet vérifié : '+name)
 else:raise AssertionError('Mutation non rejetée : '+name)
with (D/'annexes/inventaire-export.csv').open(encoding='utf-8-sig') as f:inventory=list(csv.DictReader(f))
assert len(inventory)==25;assert sum(x['type']=='.xlsx' for x in inventory)==21;assert sum(x['type']=='.png' for x in inventory)==3
scales=read('annexes/echelles-observees.json');assert len(scales)==8;assert sum(len(s['levels']) for s in scales)==28
cols=read('annexes/colonnes-export.json');assert len(cols)==21 and all(x['formulas']==0 and x['excelTables']==0 for x in cols)
mission=next(x for x in cols if 'Identifier les missions' in x['file']);assert mission['rows']==91 and len(mission['mergedRanges'])==60
m=read('annexes/matrice-pertinence.json');expected=[['Faible','Faible','Moyenne'],['Faible','Moyenne','Élevée'],['Moyenne','Élevée','Élevée']];assert len(m['cells'])==9
for c in m['cells']:assert c['result']==expected[c['resources']-1][c['motivation']-1]
nav=read('annexes/navigation-cible.json');assert sum(g['placement']=='main' for g in nav['groups'])==7 and sum(g['placement']=='footer' for g in nav['groups'])==1
with (D/'annexes/navigation-correspondances.csv').open(encoding='utf-8-sig') as f:routes=list(csv.DictReader(f))
assert len(routes)==102 and len({r['sourceId'] for r in routes})==102;assert all(r['targetGroup']!='À classer' for r in routes)
for id in ['dmap','mb-ctx','mb-proc']:assert 'inchangés' in next(r['transition'] for r in routes if r['sourceId']==id)
for p in D.rglob('*.md'):
 for target in re.findall(r'\]\(([^)]+)\)',p.read_text()):
  if '://' in target or target.startswith('#'):continue
  assert (p.parent/target.split('#')[0]).exists(),f'Missing link: {p.name} -> {target}'
checks+=['25 fichiers inventoriés, 21 classeurs et 3 PNG','8 échelles et 28 niveaux','Missions : 91 lignes dont 2 en-têtes, 60 fusions (9 missions constatées dans audit privé)','9 correspondances de pertinence exactes','7 familles métier + Administration','102 destinations/alias documentés classés sans ID dupliqué','3 accès cartographiques protégés','Liens locaux du dossier existants']
report={'scope':'Contrats proposés et intégrité documentaire ; pas une recette du moteur métier','status':'passed','checks':checks,'negativeCases':len(mutations),'sourceAuditCommit':'472a81fe315ac323d75a59db74e16b8d39a5b0e8'}
(D/'verification/contrats-annexes.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'status':'passed','checks':len(checks),'negativeCases':len(mutations)},ensure_ascii=False))
