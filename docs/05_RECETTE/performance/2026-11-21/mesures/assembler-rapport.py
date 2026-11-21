# Assemble le rapport : remplace les repères de tableaux ⟦TABLE_…⟧ du texte source par les tableaux calculés depuis les
# mesures brutes. Refuse de produire le rapport s'il reste un repère.
#   python3 -I assembler-rapport.py <dossier du banc> <rapport 19/11 : dossier mesures> <sortie>
import json, sys, re
B, O, SORTIE = sys.argv[1:4]; M = f'{B}/mesures'
src = open(f'{B}/RAPPORT.src.md').read()
J = lambda f: json.load(open(f'{M}/{f}'))
def jl(f): return [json.loads(l) for l in open(f'{M}/{f}') if l.strip().startswith('{')]
avant = {m['nom'] for m in json.load(open(f'{O}/api-une-personne.json'))['mesures']} | {m['nom'] for f in ('api-journal.json', 'api-coquille.json') for m in json.load(open(f'{O}/{f}'))['mesures']}
v750 = J('api-v750-une-personne.json')['mesures']
def mm(m): return 'non mesuré' if not m else (f"{m['statut']} (droit)" if m['statut'] == 403 else f"{m['statut']} (attendu)" if m['statut'] == 404 else f"{m['medianeMs']} / {m['p95Ms']} / {m['maxMs']}")
tables = {}
# Routes nouvelles.
par = {}
for m in v750:
    if m['nom'] in avant: continue
    par.setdefault(m['nom'], {})[m['compte']] = m
L = ['| Route | Objectif | Administrateur | RSSI (non administrateur) | Taille (Ko) | |', '| --- | --- | --- | --- | --- | --- |']
for nom, d in par.items():
    a, r = d.get('admin'), d.get('charge01')
    dep = any(x and x['statut'] == 200 and x['p95Ms'] > x['seuilMs'] for x in (a, r))
    ko = round(max((x['octets'] for x in (a, r) if x), default=0) / 1024)
    L.append(f"| {nom} | {(a or r)['seuilMs']} ms | {mm(a)} | {mm(r)} | {ko} | {'**dépasse**' if dep else ''} |")
tables['TABLE_NOUVELLES'] = '\n'.join(L)
# Écritures nouvelles.
L = ['| Écriture | Médiane / p95 / max (ms) | Répétitions |', '| --- | --- | --- |']
for m in J('ecritures-v750.json')['mesures']: L.append(f"| {m['nom']} | {m['medianeMs']} / {m['p95Ms']} / {m['maxMs']} | {m['repetitions']} |")
tables['TABLE_ECRITURES'] = '\n'.join(L)
# Requêtes SQL par appel.
L = ['| Route | Réponse (un appel) | Requêtes SQL exécutées | Somme de leurs durées (ms) |', '| --- | --- | --- | --- |']
for x in jl('requetes-par-appel.jsonl'):
    ch = re.sub(r'[0-9a-f]{8}-[0-9a-f-]{27}', ':id', x['chemin'])
    L.append(f"| `{ch}` | {x['reponse'].replace('B', ' o')} | {x['requetesSql']} | {x['sommeMs']} |")
tables['TABLE_SQL'] = '\n'.join(L)
L = ['| Route | Réponse (un appel, journal complet actif) | Requêtes SQL | Somme SQL (ms) | Lectures des faits des avis | Leur durée (ms) |', '| --- | --- | --- | --- | --- | --- |']
for x in jl('lectures-faits-avis.jsonl'):
    L.append(f"| `{x['chemin']}` | {x['reponse'].replace('B', ' o')} | {x['requetesSql']} | {x['sommeSqlMs']} | {x['lecturesFaitsAvis']} | {x['faitsAvisMs']} |")
tables['TABLE_FAITS'] = '\n'.join(L)
# Veille : dix ans puis 90 jours.
dix = {(m['compte'], m['nom']): m for m in J('api-veille-journal-dix-ans.json')['mesures']}
L = ['| Route | Compte | 178 473 collectes (dix ans) : méd. / p95 / max | 4 405 collectes (90 jours, après purge) : méd. / p95 / max |', '| --- | --- | --- | --- |']
for m in v750:
    k = (m['compte'], m['nom'])
    if k in dix and 'réglementaire' not in m['nom']:
        L.append(f"| {m['nom']} | {'adm.' if m['compte'] == 'admin' else 'RSSI'} | {mm(dix[k])} | {mm(m)} |")
tables['TABLE_VEILLE'] = '\n'.join(L)
for nom, f in (('TABLE_AVANT_APRES', 'table-avant-apres.md'), ('TABLE_PAGES', 'table-pages.md'), ('TABLE_CHARGE', 'table-charge.md'), ('TABLE_LEGERE', 'table-legere.md')):
    try: tables[nom] = open(f'{B}/{f}').read().strip()
    except FileNotFoundError: pass
for k, v in tables.items(): src = src.replace(f'⟦{k}⟧', v)
reste = re.findall(r'⟦[^⟧]*⟧', src)
if reste: sys.exit(f'repères non remplis : {sorted(set(reste))}')
if re.search(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', src): sys.exit('identifiant brut dans le rapport')
open(SORTIE, 'w').write(src)
print(len(src), 'octets')
