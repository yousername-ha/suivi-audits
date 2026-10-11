"""Reproduit la grille depuis le texte officiel contrôlé. pdftotext -layout, pas de source secondaire."""
from pathlib import Path
import json, re, hashlib, argparse
parser=argparse.ArgumentParser();parser.add_argument('recherche',type=Path);args=parser.parse_args()
root=Path(__file__).resolve().parents[1]; guide=args.recherche/'d2-guide-prod-convergence.esante.gouv.fr.pdf'
finance=args.recherche/'d2-finance-prod-convergence.esante.gouv.fr.pdf'
pages=guide.with_suffix('.txt').read_text().split('\f')
url='https://prod-convergence.esante.gouv.fr/sites/default/files/media/document/Guide%20des%20pr%C3%A9requis%20et%20objectifs%20du%20domaine%20V1.1.6.pdf'
finance_url='https://prod-convergence.esante.gouv.fr/sites/default/files/media/document/Guide%20des%20de%CC%81penses%20e%CC%81ligibles%20domaine%202_v1.0.pdf'
entries=[
('D2.P1',7,8,"Disposer d’une Politique de Sécurité des Systèmes d’Information (PSSI) formalisée et à jour"),
('D2.P2',9,10,"Décrire l’organisation prévue pour la mise en œuvre du Plan de Continuité et de Reprise d’Activité"),
('D2.O1.A',12,13,"Mettre en place une gouvernance pour la Continuité et de Reprise d’activité"),
('D2.O1.B',14,15,"Décrire les procédures de réponse à la crise cyber"),
('D2.O1.C',16,18,"Formaliser un plan de continuité d’activité (PCA) et un plan de reprise d’activité (PRA)"),
('D2.O1.D',18,20,"Tester la mise en œuvre d’un Plan de Continuité d’Activité (PCA) dans un exercice terrain"),
('D2.O2.A',21,23,"Définir une politique de sauvegarde et de restauration et la maintenir à jour"),
('D2.O2.B',24,25,"Formaliser un/des plan(s) de sauvegarde et de restauration et le(s) maintenir à jour"),
('D2.O3.A',26,27,"Mettre en œuvre une authentification sécurisée pour les infrastructures de sauvegarde"),
('D2.O3.B',28,29,"S’inscrire dans une trajectoire pour un cloisonnement de son infrastructure de sauvegarde"),
('D2.O3.C',30,32,"S’inscrire dans une trajectoire pour la mise en œuvre du 3-2-1"),
('D2.O3.D',33,34,"Mettre en place une supervision des sauvegardes"),
('D2.O4',35,36,"Tester la sauvegarde et la restauration")]
requirements=[]
for rid,start,end,title in entries:
 text='\n'.join(pages[start-1:end]);anchor=re.search(re.escape(rid)+r'\s*[-–:]',text);assert anchor, rid
 text=text[anchor.start():]
 if rid=='D2.P2':text=re.split(r'\n\s*3\s+ELIGIBILITE',text)[0]
 if rid=='D2.O1.C':text=re.split(r'\n\s*D2\.O1\.D\s*[-–]',text)[0]
 text='\n'.join(re.sub(r' +',' ',line).strip() for line in text.splitlines() if not re.match(r'^\s*(Statut : Validé|\d+\s*$)',line))
 assert len(text)<=10000, (rid,len(text))
 proof=re.split(r'Documents justificatifs\s*',text,maxsplit=1)
 requirements.append({'id':rid,'title':title,'text':title,'chapter':'Prérequis' if '.P' in rid else rid.rsplit('.',1)[0] if rid.count('.')>1 else rid,'objective':rid,'sourceUrl':url,'sourcePage':f'{start}–{end}','prerequisites':'D2.P1 et D2.P2 — apprécier le périmètre et les conditions du guide.' if '.O' in rid else '', 'criteria':text,'expectedProofs':proof[-1].split('Opération de contrôle')[0].strip() if len(proof)>1 else '', 'sourceStatus':'Extrait officiel lu — décision humaine attendue','maps':[],'self':''})
catalog=json.loads((root/'sources/catalogue.json').read_text())
framework={'id':'CARE-D2-1.1.6-LEGACY','dfKind':'CARE','domain':'D2','name':'CaRE D2 — Stratégie de continuité et de reprise d’activité','version':'1.1.6 (pied de page du PDF)','sourceUrl':url,'publisher':'Agence du Numérique en Santé','publishedAt':'2026-05-06','checkedAt':'2026-10-11','sourceStatus':'Document officiel consulté — dernière version non confirmée','reuse':'Extraits attribués à l’ANS ; vérifier les conditions de réutilisation avant redistribution.','source':'Guide ANS D2, pied de page 1.1.6 du 6 mai 2026 ; historique mentionne aussi 1.1.7 (8 juillet 2026). Incohérence conservée et signalée.','requirements':requirements,'objectives':{}}
catalog['frameworks']=[f for f in catalog['frameworks'] if f['id']!=framework['id']]+[framework]
for key,path,title,version,date in [('D2-guide',guide,framework['name'],framework['version'],'2026-05-06'),('D2-finance',finance,'CaRE D2 — Guide des dépenses éligibles','1.0','2026-03-11')]:
 catalog['sources']=[x for x in catalog['sources'] if x.get('id')!=key]+[{'id':key,'kind':'CARE','domain':'D2','title':title,'version':version,'url':url if key=='D2-guide' else finance_url,'publisher':'Agence du Numérique en Santé','publishedAt':date,'checkedAt':'2026-10-11','status':'PDF officiel lu ; ne vaut pas validation d’éligibilité ou de conformité.','reuse':'Conditions de redistribution à vérifier.'}]
(root/'sources/catalogue.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
(root/'modules/df-sources.js').write_text('/* Sources et limites : sources/catalogue.json. */\nwindow.LegacyDFCatalog = '+json.dumps(catalog,ensure_ascii=False)+';\n')
verification=json.loads((root/'sources/verification.json').read_text());verification['CARE_D2']={'url':url,'sha256':hashlib.sha256(guide.read_bytes()).hexdigest(),'criteria':len(requirements),'versionLabel':framework['version'],'versionHistoryConflict':True,'latestVersionConfirmed':False,'finance':{'url':finance_url,'sha256':hashlib.sha256(finance.read_bytes()).hexdigest(),'version':'1.0','publishedAt':'2026-03-11'},'sourcePagesRead':[list(x[1:3]) for x in entries]}
(root/'sources/verification.json').write_text(json.dumps(verification,ensure_ascii=False,indent=2)+'\n')
print('13 entrées D2 officielles extraites ; version contradictoire signalée.')
