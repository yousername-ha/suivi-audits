# Résumé d'un relevé docker stats (t|nom|cpu%|mem / limite) et des connexions (t|actives|inactives en transaction|verrou|total) :
# min, médiane, max, moyennes par tranche de 10 min, pente (régression linéaire) de la mémoire de l'API.
#   python3 -I stats.py <fichier docker-stats> [fichier connexions]
import sys, statistics as st, collections
def mio(s):
    v = s.strip().split('/')[0].strip()
    for u, f in (('GiB', 1024), ('MiB', 1), ('KiB', 1 / 1024)):
        if v.endswith(u): return float(v[:-len(u)]) * f
    return float(v.rstrip('B')) / 1048576
par = collections.defaultdict(list)
for l in open(sys.argv[1]):
    p = l.strip().split('|')
    if len(p) < 4: continue
    par[p[1]].append((int(p[0]), float(p[2].rstrip('%')), mio(p[3])))
for nom, v in par.items():
    cpu = [x[1] for x in v]; mem = [x[2] for x in v]; t = [x[0] for x in v]
    n = len(v); mt = sum(t) / n; mm = sum(mem) / n
    pente = sum((a - mt) * (b - mm) for a, b in zip(t, mem)) / max(sum((a - mt) ** 2 for a in t), 1) * 3600
    tranches = collections.defaultdict(list)
    for a, b in zip(t, mem): tranches[a // 600].append(b)
    q = n // 4
    print(f"{nom}: {n} relevés ; CPU {min(cpu):.0f} à {max(cpu):.0f} % (médiane {st.median(cpu):.0f}) ; mémoire {min(mem):.0f} à {max(mem):.0f} Mio (médiane {st.median(mem):.0f}) ;"
          f" premier quart {st.mean(mem[:q]) if q else 0:.0f}, dernier quart {st.mean(mem[-q:]) if q else 0:.0f} Mio ; tranches de 10 min {[round(st.mean(x)) for k, x in sorted(tranches.items())]} ; pente {pente:+.1f} Mio/h")
if len(sys.argv) > 2:
    c = collections.Counter(); att = 0; tot = []
    for l in open(sys.argv[2]):
        p = l.strip().split('|')
        if len(p) < 5: continue
        c[int(p[1])] += 1; att += int(p[3]) > 0; tot.append(int(p[4]))
    print('connexions actives :', dict(sorted(c.items())), '; relevés avec attente de verrou :', att, '; connexions ouvertes', min(tot), 'à', max(tot))
