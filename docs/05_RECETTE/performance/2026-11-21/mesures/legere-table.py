# Charge légère : tableau par route, 19/11 et 21/11 (appels, erreurs, médiane / p95 / max).
#   python3 -I legere-table.py <19-11 legere-1h.json> <21-11 legere-1h.json>
import json, sys
a = {r['route']: r for r in json.load(open(sys.argv[1]))['parRoute']}
b = json.load(open(sys.argv[2]))['parRoute']
print('| Route | Appels 21/11 | Erreurs 21/11 | 21/11 : méd. / p95 / max (ms) | 19/11 : méd. / p95 / max (erreurs) |')
print('| --- | --- | --- | --- | --- |')
for r in b:
    x = a.get(r['route'])
    av = f"{x['medianeMs']} / {x['p95Ms']} / {x['maxMs']} ({x['erreurs']})" if x else '—'
    print(f"| {r['route']} | {r['n']} | {r['erreurs']} | {r['medianeMs']} / {r['p95Ms']} / {r['maxMs']} | {av} |")
