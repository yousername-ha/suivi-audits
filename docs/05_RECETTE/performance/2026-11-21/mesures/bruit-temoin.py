# Bruit de la machine : rapport des médianes témoin (21/11, v7.4.0) / 19/11 sur les routes de plus de 50 ms.
#   python3 -I bruit-temoin.py <19-11 api-une-personne.json> <api-v740-une-personne.json>
import json, sys, statistics as st
a = {(m['compte'], m['nom']): m for m in json.load(open(sys.argv[1]))['mesures']}
t = {(m['compte'], m['nom']): m for m in json.load(open(sys.argv[2]))['mesures']}
r = []
for k, x in a.items():
    y = t.get(k)
    if y and x['statut'] == 200 and y['statut'] == 200 and x['medianeMs'] >= 50:
        r.append((y['medianeMs'] / x['medianeMs'], k[1], k[0]))
r.sort()
q = [x[0] for x in r]
print(len(r), 'routes ; min', round(q[0], 2), r[0][1:], '; max', round(q[-1], 2), r[-1][1:], '; médiane', round(st.median(q), 2),
      '; 10e centile', round(q[len(q) // 10], 2), '; 90e centile', round(q[(9 * len(q)) // 10], 2))
