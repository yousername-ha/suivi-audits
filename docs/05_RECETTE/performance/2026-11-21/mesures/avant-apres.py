# Tableau avant (19/11, commit 3038043c) / témoin (21/11, v7.4.0 sur la même pile, avant mise à jour) / après (21/11,
# v7.5.0) des routes mesurées les deux fois, à une personne. Médiane / p95 en ms (15 répétitions, 5 pour les exports).
#   python3 avant-apres.py <mesures-19-11/api-une-personne.json> <api-v740-une-personne.json> <api-v750-une-personne.json> [extra-19-11.json ...]
import json, sys
def charger(f):
    try:
        return {(m['compte'], m['nom']): m for m in json.load(open(f))['mesures']}
    except FileNotFoundError:
        return {}
avant = charger(sys.argv[1]); temoin = charger(sys.argv[2]); apres = charger(sys.argv[3])
for f in sys.argv[4:]:
    for k, v in charger(f).items(): avant.setdefault(k, v)
def cell(m):
    if not m: return 'non mesuré'
    if m['statut'] != 200: return f"{m['statut']}"
    return f"{m['medianeMs']} / {m['p95Ms']}"
lignes = []
for (compte, nom), a in avant.items():
    b = apres.get((compte, nom)); t = temoin.get((compte, nom))
    if not b: continue
    ratio = ''
    if a['statut'] == 200 and b['statut'] == 200 and a['p95Ms']:
        r = b['p95Ms'] / a['p95Ms']; ratio = f"×{r:.2f}"
    etat = ''
    if b['statut'] == 200:
        etat = '**dépasse**' if b['p95Ms'] > b['seuilMs'] else 'tient'
        if a['statut'] == 200 and b['p95Ms'] <= b['seuilMs'] and b['p95Ms'] > 1.2 * a['p95Ms'] and b['medianeMs'] > 1.2 * a['medianeMs'] and b['p95Ms'] - a['p95Ms'] >= 20:
            etat = 'tient, **+20 %**'
    lignes.append((compte, nom, b['seuilMs'], cell(a), cell(t), cell(b), ratio, etat))
print('| Route | Compte | Objectif | 19/11 (3038043c) méd. / p95 | 21/11 témoin v7.4.0 | 21/11 v7.5.0 | p95 après / avant | |')
print('| --- | --- | --- | --- | --- | --- | --- | --- |')
for l in lignes:
    print(f"| {l[1]} | {'adm.' if l[0] == 'admin' else 'RSSI'} | {l[2]} ms | {l[3]} | {l[4]} | {l[5]} | {l[6]} | {l[7]} |")
