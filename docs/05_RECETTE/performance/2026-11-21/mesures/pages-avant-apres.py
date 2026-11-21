# Pages à l'écran : avant (19/11) / après (21/11), cache vide et cache chaud, administrateur (15 rép.) et RSSI (5 rép.).
#   python3 -I pages-avant-apres.py <19-11 pages-admin.json> <19-11 pages-charge01.json> <21-11 pages-admin.json> <21-11 pages-charge01.json>
import json, sys
def L(f): return {m['chemin']: m for m in json.load(open(f))['mesures']}
aa, ar, pa, pr = (L(f) for f in sys.argv[1:5])
c = lambda m, k: f"{m[k + 'MedianeMs']} / {m[k + 'P95Ms']}" if m else '—'
print('| Page | Adm. cache vide 19/11 | Adm. cache vide 21/11 | Adm. cache chaud 19/11 | Adm. cache chaud 21/11 | RSSI cache vide 19/11 | RSSI cache vide 21/11 | Appels API / Ko (adm., chaud, 21/11) | |')
print('| --- | --- | --- | --- | --- | --- | --- | --- | --- |')
for ch, m in pa.items():
    a, r0, r1 = aa.get(ch), ar.get(ch), pr.get(ch)
    d = m['dernier']['chaud']
    dep = m['froidP95Ms'] > 2000 or m['chaudP95Ms'] > 2000 or (r1 and (r1['froidP95Ms'] > 2000 or r1['chaudP95Ms'] > 2000))
    print(f"| {m['nom']} (`{ch}`) | {c(a, 'froid')} | {c(m, 'froid')} | {c(a, 'chaud')} | {c(m, 'chaud')} | {c(r0, 'froid')} | {c(r1, 'froid')} | {d['requetesApi']} / {round(d['octetsApi'] / 1024)} | {'**dépasse**' if dep else 'tient'} |")
