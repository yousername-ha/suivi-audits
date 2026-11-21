# Routes sous l'objectif par catégorie (liste, tdb, export), pour tous les comptes où la route répond 200.
#   python3 -I compter-objectifs.py <api-v750-une-personne.json> <19-11 api-une-personne.json>
import json, sys, collections
v = json.load(open(sys.argv[1]))['mesures']
avant = {m['nom'] for m in json.load(open(sys.argv[2]))['mesures']}
for portee, garder in (('routes du 19/11', lambda n: n in avant), ('routes nouvelles', lambda n: n not in avant)):
    par = collections.defaultdict(lambda: collections.defaultdict(list))
    for m in v:
        if garder(m['nom']) and m['statut'] == 200: par[m['categorie']][m['nom']].append(m['p95Ms'] <= m['seuilMs'])
    for cat, d in par.items():
        ok = [n for n, l in d.items() if all(l)]
        print(portee, cat, f"{len(ok)} / {len(d)} sous l'objectif ; au-delà :", [n for n in d if n not in ok])
