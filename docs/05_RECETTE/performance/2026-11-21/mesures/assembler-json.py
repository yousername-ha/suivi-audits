# Mesures brutes du rapport du 21/11/2026 (mesures.json) : aucune donnée réelle, aucun secret, identifiants remplacés.
#   python3 -I assembler-json.py <dossier du banc> <fichier de sortie>
import json, sys, re, os
B = sys.argv[1]; M = f'{B}/mesures'
def L(f):
    try: return json.load(open(f'{M}/{f}'))
    except FileNotFoundError: return None
def lignes(f):
    try: return [l.rstrip('\n') for l in open(f'{M}/{f}') if l.strip()]
    except FileNotFoundError: return []
def jsonl(f): return [json.loads(l) for l in lignes(f)]
def abreger(t):
    t = re.sub(r"\{(CVE-2099-\d{5},){20,}CVE-2099-\d{5}\}", lambda m: '{… ' + str(m.group(0).count(',') + 1) + ' CVE fictives …}', t)
    return '\n'.join((l.strip() if l.strip() == 'QUERY PLAN' else '-' * 60) if len(l) > 1000 and set(l) <= set(' -QUERYPLAN') else l for l in t.split('\n'))
def texte(f):
    try: return abreger(open(f'{M}/{f}').read())
    except FileNotFoundError: return None
out = {
  'commit': 'ee255f8468bbd6112ba4a900fba0c09a8ef33ac0', 'etiquette': 'v7.5.0', 'versionDeDepart': 'v7.4.0 (fa6c7e7c)',
  'date': '2026-11-21', 'fuseau': 'Europe/Paris',
  'machine': {'type': 'conteneur de développement partagé', 'vcpu': 4, 'memoireGo': 15, 'postgres': '18.6',
              'avertissement': 'ne vaut pas mesure sur le serveur réel'},
  'reglagesPostgresql': {'avant': texte('base-v740-apres-remplissage.txt'), 'apres': texte('base-v750-apres-maj.txt')},
  'remplissage': {'api': L('remplissage-api.json'), 'occurrences': lignes('occurrences-progression.txt'),
                  'sqlV740': lignes('remplissage-sql.log'), 'vulnerabilites': lignes('remplissage-vulns.log'),
                  'sqlV750': lignes('remplissage-v750.log'), 'preparationV750': L('preparation-v750.json'),
                  'baseFinale': texte('base-v750-fin.txt')},
  'miseAJour': {'journal': lignes('mise-a-jour.log'), 'migrations': lignes('migrations.txt')},
  'apiTemoinV740': L('api-v740-une-personne.json'), 'apiV750': L('api-v750-une-personne.json'),
  'apiVeilleJournalDixAns': L('api-veille-journal-dix-ans.json'),
  'requetesParAppel': jsonl('requetes-par-appel.jsonl'),
  'pages': {'admin': L('pages-admin.json'), 'rssi': L('pages-charge01.json')},
  'charge20': L('charge20.json'), 'charge20Connexions': lignes('charge20-connexions.txt'), 'charge20DockerStats': lignes('charge20-docker-stats.txt'),
  'charge20Comparaison': L('comparaison-charge20.json'), 'lecturesFaitsAvis': jsonl('lectures-faits-avis.jsonl'), 'murSyntheseRequetesLentes': lignes('mur-synthese-requetes-lentes.txt'),
  'legere1h': L('legere-1h.json'), 'legere1hDockerStats': lignes('legere-1h-docker-stats.txt'), 'legere1hConnexions': lignes('legere-1h-connexions.txt'),
  'purge': {'explainDixAns': texte('explain-purge-dix-ans.txt'), 'psqlSeconde': lignes('purge-psql-seconde.txt'), 'reelle': texte('purge-reelle.txt')},
  'synchronisations': jsonl('synchronisations.jsonl'),
  'ecrituresIncidents': L('ecritures-incidents.json'), 'ecrituresV750': L('ecritures-v750.json'),
  'sauvegardeRestauration': L('sauvegarde-restauration.json'),
  'explains': {f: texte(f) for f in sorted(os.listdir(M)) if f.startswith('explain-')},
}
s = json.dumps(out, ensure_ascii=False, indent=1)
s = re.sub(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', ':id', s)
# Garde-fou : aucun secret ni mot de passe dans les mesures.
assert not re.search(r'/tmp/cl[a]ude|[.]cl[a]ude/worktrees', s), 'chemin de travail dans les mesures'
assert 'motCharge' not in s and 'password' not in s.lower(), 'secret dans les mesures'
open(sys.argv[2], 'w').write(s)
print(len(s), 'octets')
