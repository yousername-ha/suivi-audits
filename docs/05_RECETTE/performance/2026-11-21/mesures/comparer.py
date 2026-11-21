# Compare les temps en charge (charge20.json) aux temps à une personne (api-une-personne.json, compte charge01).
import json, sys
B = sys.argv[1]
UN = sys.argv[2] if len(sys.argv) > 2 else 'api-v750-une-personne.json'; CH = sys.argv[3] if len(sys.argv) > 3 else 'charge20.json'
un = {m['nom']: m for m in json.load(open(f'{B}/mesures/{UN}'))['mesures'] if m['compte'] == 'charge01'}
ch = {r['route']: r for r in json.load(open(f'{B}/mesures/{CH}'))['parRoute']}
M = {'tasks': 'Tâches récurrentes : occurrences (page 1)', 'tasks-window': 'Tâches récurrentes : calendrier du mois',
 'tasks-dashboard': 'Tâches récurrentes : tableau de bord', 'actions': 'Plan d’actions (page 1)', 'fiche-action': 'Fiche action',
 'risques-registre': 'Registre des risques', 'risk-map': 'Carte des risques', 'incidents': 'Incidents (un périmètre)',
 'documents': 'Documents (liste)', 'vuln-constats': 'Vulnérabilités : constats (page 1)', 'vuln-machines': 'Vulnérabilités : machines (page 1)',
 'vuln-fiche-machine': 'Vulnérabilités : fiche machine la plus touchée', 'vuln-fiche-constat': 'Vulnérabilités : fiche constat le plus répandu',
 'vuln-vue': 'Vulnérabilités : vue d’ensemble', 'notifications': 'Notifications (cloche)', 'dashboard': 'Tableau de bord du périmètre',
 'synthese-perimetres': 'Cartes des périmètres (synthèse)', 'mes-elements': 'Registres : mes éléments', 'me': 'Session (auth/me)',
 'accueil-tableaux': 'Accueil : liste des tableaux de bord', 'vuln-veille-avis': 'Veille : avis (page 1, marques parc et Internet)',
 'vr-publications': 'Veille réglementaire : publications (page 1)'}
out = []
for r, nom in M.items():
    if r not in ch: continue
    u, c = un[nom], ch[r]
    out.append({'route': r, 'n': c['n'], 'unP50': u['medianeMs'], 'unP95': u['p95Ms'], 'chP50': c['medianeMs'], 'chP95': c['p95Ms'],
                'ratioP50': round(c['medianeMs'] / max(u['medianeMs'], 1), 1), 'ratioP95': round(c['p95Ms'] / max(u['p95Ms'], 1), 1)})
json.dump(out, open(f'{B}/mesures/comparaison-' + CH, 'w'), indent=1, ensure_ascii=False)
for o in sorted(out, key=lambda x: -x['ratioP95']):
    print(f"| {o['route']} | {o['n']} | {o['unP50']} / {o['unP95']} | {o['chP50']} / {o['chP95']} | ×{o['ratioP50']} / ×{o['ratioP95']} |")
