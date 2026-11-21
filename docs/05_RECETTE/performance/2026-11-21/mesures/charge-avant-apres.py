# Charge : par route, 20 personnes le 19/11 et le 21/11, et rapport au temps à une personne (21/11, compte RSSI).
#   python3 -I charge-avant-apres.py <19-11 charge.json> <21-11 charge.json> <21-11 comparaison.json>
import json, sys
a = {r['route']: r for r in json.load(open(sys.argv[1]))['parRoute']}
b = {r['route']: r for r in json.load(open(sys.argv[2]))['parRoute']}
c = {r['route']: r for r in json.load(open(sys.argv[3]))}
print('| Route (mélange) | Appels 21/11 | Une personne RSSI 21/11 : méd. / p95 | Charge 19/11 : méd. / p95 / max | Charge 21/11 : méd. / p95 / max | p95 charge / une personne (21/11) |')
print('| --- | --- | --- | --- | --- | --- |')
for r, x in sorted(b.items(), key=lambda kv: -(c.get(kv[0], {}).get('ratioP95', 0))):
    y = a.get(r); z = c.get(r)
    un = f"{z['unP50']} / {z['unP95']}" if z else 'non mesuré seul'
    av = f"{y['medianeMs']} / {y['p95Ms']} / {y['maxMs']}" if y else '—'
    print(f"| {r} | {x['n']} | {un} | {av} | {x['medianeMs']} / {x['p95Ms']} / {x['maxMs']} | {('×' + str(z['ratioP95'])) if z else '—'} |")
