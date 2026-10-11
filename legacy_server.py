"""API locale Legacy : SQLite, sessions et autorisations. Aucune dépendance externe."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from http.cookies import SimpleCookie
from urllib.parse import urlsplit, unquote
import copy, hashlib, hmac, json, re, secrets, sqlite3, threading, time
from legacy_risks import validate_risks
ID_PREFIXES = json.loads((Path(__file__).resolve().parent / "sources/identifiants.json").read_text())
BASE_ROLES = json.loads((Path(__file__).resolve().parent / "sources/roles-base.json").read_text())

JOURNEY_STEPS = json.loads((Path(__file__).resolve().parent / 'sources/journey-steps.json').read_text())
MAX_JSON = 40 * 1024 * 1024
MAX_FILE = 20 * 1024 * 1024
KEY = re.compile(r'^[A-Za-z0-9_-]{1,200}$')
# Les autres conteneurs historiques restent privés à l'administration jusqu'à classement.
PATHS = [('items',), ('findings',), ('roles',), ('perimeters',), ('processes',),
         ('objectives',), ('indicators',), ('suppliers',), ('evidences',), ('plans',),
         ('interested',), ('swots',), ('incidents',), ('recurring',), ('supEvals',),
         ('reviews',), ('appGaps',), ('accessReviews',), ('df', 'dossiers'),
         ('df', 'evaluations'), ('df', 'budgets'), ('df', 'observations'),
         ('journey', 'runs'), ('journey', 'tasks'), ('pcra', 'bias'),
         ('pcra', 'plans'), ('pcra', 'exercises'), ('pcra', 'policies'), ('crrc', 'establishments'),
         ('crrc', 'resources'), ('crrc', 'runs'), ('crrc', 'restores'), ('crrc', 'alerts'),
         ('invest', 'lines')] + [('riskMgmt', k) for k in ('risks','studies','assessments','scenarios','policies','treatments','measures','decisions')]

def get(s, path):
    for k in path:
        s = s.get(k, {}) if isinstance(s, dict) else {}
    return s if isinstance(s, list) else []

def put(s, path, rows):
    for k in path[:-1]:
        s = s.setdefault(k, {})
    s[path[-1]] = rows

def encoded(s):
    return json.dumps(s, ensure_ascii=False, separators=(',', ':'), sort_keys=True)

def without_codes(value):
    """Une référence de présentation ne modifie pas le contenu métier validé."""
    if isinstance(value, dict): return {k:without_codes(v) for k,v in value.items() if k!='internalId'}
    if isinstance(value, list): return [without_codes(v) for v in value]
    return value

def digest(s):
    return hashlib.sha256(encoded(s).encode()).hexdigest()

def password_hash(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 310000).hex()

def public_user(u):
    return {k: u[k] for k in ('id', 'name', 'login', 'permission', 'perimeterIds', 'roleIds', 'canValidate', 'active')}

class Problem(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message

class Store:
    def __init__(self, directory):
        self.directory = Path(directory).resolve()
        self.directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.directory.chmod(0o700)
        self.lock = threading.RLock()
        self.dbpath = self.directory / 'legacy.sqlite3'
        with self.connect() as db:
            db.executescript('''
            PRAGMA journal_mode=WAL;
            CREATE TABLE IF NOT EXISTS state(id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, data TEXT);
            INSERT OR IGNORE INTO state VALUES(1,0,NULL);
            CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, login TEXT UNIQUE, data TEXT, salt TEXT, hash TEXT);
            CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT, csrf TEXT, expires REAL);
            CREATE TABLE IF NOT EXISTS files(key TEXT PRIMARY KEY, owner TEXT, sha256 TEXT, mime TEXT, data BLOB);
            CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY, at REAL, actor TEXT, action TEXT, before_hash TEXT, after_hash TEXT, details TEXT);
            CREATE TABLE IF NOT EXISTS code_counters(prefix TEXT PRIMARY KEY, value INTEGER NOT NULL);
            PRAGMA user_version=2;
            ''')
        self.dbpath.chmod(0o600)
        self.attempts = []

    def connect(self):
        db = sqlite3.connect(self.dbpath, timeout=15)
        db.row_factory = sqlite3.Row
        return db

    def state(self, db):
        row = db.execute('SELECT * FROM state WHERE id=1').fetchone()
        return row['version'], json.loads(row['data']) if row['data'] else None

    def users(self, db):
        return [json.loads(x['data']) for x in db.execute('SELECT data FROM users')]

    def trace(self, db, actor, action, before, after, details=None):
        db.execute('INSERT INTO audit(at,actor,action,before_hash,after_hash,details) VALUES(?,?,?,?,?,?)',
                   (time.time(), actor, action, digest(before), digest(after), encoded(details or {})))

    def allowed(self, s, u):
        ids = set(u['perimeterIds'])
        changed = True
        while changed:
            changed = False
            for p in s.get('perimeters', []):
                if p.get('parentId') in ids and p['id'] not in ids:
                    ids.add(p['id']); changed = True
        return ids

    def record_index(self, s):
        return {r['id']: r for path in PATHS for r in get(s, path) if isinstance(r, dict) and isinstance(r.get('id'), str)}

    def scopes(self, r, index, seen=None):
        if not isinstance(r, dict):
            return set()
        ids = set(r.get('perimeterIds') or [])
        if r.get('type') in ('GHT', 'Support', 'Établissement', 'Entité juridique', 'Site', 'Activité', 'SI mutualisé') and r.get('id'):
            ids.add(r['id'])
        seen = set(seen or [])
        # Les rattachements ne peuvent pas élargir implicitement la visibilité d'un objet privé.
        if not ids:
            for key in ('dossierId', 'journeyId', 'biaId', 'planId', 'evaluationId'):
                parent = r.get(key)
                if parent and parent not in seen and parent in index:
                    ids |= self.scopes(index[parent], index, seen | {parent})
        return ids

    def visible(self, r, index, allowed):
        ids = self.scopes(r, index)
        return bool(ids) and ids <= allowed

    def project(self, s, u):
        if s is None or u['permission'] == 'admin':
            return copy.deepcopy(s)
        allowed, index = self.allowed(s, u), self.record_index(s)
        out = {k: copy.deepcopy(s[k]) for k in ('v', 'schema', 'updatedAt', 'years', 'yearLabels', 'nextYear', 'groups', 'hdsChap', 'frameworks', 'activeFw') if k in s}
        out.update({'nextDate': '', 'internalDate': '', 'source': '', 'closeDeadline': '', 'findingsRev': 0,
                    'scope': {}, 'dda': {}, 'plan': {'status': '', 'note': '', 'days': [], 'slots': [], 'people': []},
                    'ai': {'register': [], 'evals': [], 'plan': [], 'policies': []},
                    'crisis': {'active': None, 'contacts': [], 'scenarios': []}, 'branding': {}})
        for path in PATHS:
            if path == ('roles',):
                rows = []
                for r in get(s, path):
                    covered = self.allowed(s, {'perimeterIds': r.get('perimeterIds', [])})
                    if covered & allowed or r.get('baseRoleKey') and not r.get('perimeterIds'):
                        role = copy.deepcopy(r); role['perimeterIds'] = sorted(covered & allowed); rows.append(role)
                put(out, path, rows)
            elif path in [('pcra','policies'), ('riskMgmt','policies')]:
                put(out, path, [copy.deepcopy(r) for r in get(s,path) if self.allowed(s, {'perimeterIds':r.get('perimeterIds',[])}) & allowed])
            else:
                put(out, path, [copy.deepcopy(r) for r in get(s, path) if self.visible(r, index, allowed)])
        visible_perimeters = {p['id'] for p in out.get('perimeters', [])}
        for p in out.get('perimeters', []):
            if p.get('parentId') not in visible_perimeters and p.get('parentId'):
                p['parentId'] = ''; p['restrictedParent'] = True
            p['relatedIds'] = [id for id in p.get('relatedIds', []) if id in visible_perimeters]
        visible_ids = {r.get('id') for path in PATHS for r in get(out, path)}
        for path in PATHS:
            for r in get(out, path):
                if 'history' in r: r['history'] = []
                if 'objectRefs' in r: r['objectRefs'] = [ref for ref in r['objectRefs'] if ref.get('id') in visible_ids]
        for f in out.get('frameworks', []):
            for requirement in f.get('requirements', []):
                requirement['self'] = ''; requirement['maps'] = []
        # Journaux client non transmis : peuvent contenir des snapshots hors périmètre.
        out.setdefault('df', {}).update({'schema': 1, 'actor': u['name'], 'history': [], 'auditPackages': []})
        out.setdefault('journey', {})['schema'] = 1
        out.setdefault('riskMgmt', {})['schema'] = 1
        out.setdefault('pcra', {}).update({'schema': 1, 'settings': copy.deepcopy(s.get('pcra', {}).get('settings', {}))})
        out.setdefault('crrc', {})['offers'] = []
        return out

    def merge(self, old, incoming, u):
        if u['permission'] == 'admin':
            return copy.deepcopy(incoming)
        if u['permission'] != 'editor' or old is None:
            raise Problem(403, 'Modification non autorisée.')
        allowed, index = self.allowed(old, u), self.record_index(old)
        projection, result = self.project(old, u), copy.deepcopy(old)
        def meaningful(value):
            if isinstance(value, dict): return any(meaningful(v) for v in value.values())
            if isinstance(value, list): return any(meaningful(v) for v in value)
            return bool(value)
        for key in ('scope', 'dda', 'plan', 'ai', 'crisis', 'branding', 'frameworks'):
            if incoming.get(key) != projection.get(key) and (meaningful(incoming.get(key)) or meaningful(projection.get(key))):
                raise Problem(403, 'Cette rubrique commune est réservée à l’administration ; utilisez les objets affectés à vos périmètres.')
        for path in PATHS:
            rows, previous = get(incoming, path), get(projection, path)
            if path in [('perimeters',), ('roles',)]:
                if encoded(rows) != encoded(previous): raise Problem(403, 'La structure des périmètres et des rôles est réservée à l’administration.')
                continue
            if path in [('pcra','policies'), ('riskMgmt','policies')]:
                inherited = {r['id']:r for r in previous if not self.visible(r,index,allowed)}
                for r in rows:
                    if r.get('id') in inherited and encoded(r)!=encoded(inherited[r['id']]): raise Problem(403, 'Politique héritée en lecture seule.')
                rows = [r for r in rows if r.get('id') not in inherited]
            hidden = [r for r in get(old, path) if not self.visible(r, index, allowed)]
            hidden_ids = {r.get('id') for r in hidden}
            for r in rows:
                if not isinstance(r, dict) or r.get('id') in hidden_ids:
                    raise Problem(403, 'Identifiant inaccessible.')
                if not self.visible(r, {**index, **self.record_index(incoming)}, allowed):
                    raise Problem(403, 'Objet sans périmètre autorisé ou couvrant un autre établissement.')
            by_id = {r.get("id"): copy.deepcopy(r) for r in rows}
            merged = [copy.deepcopy(r) if r.get("id") in hidden_ids else by_id.pop(r.get("id")) for r in get(old, path) if r.get("id") in hidden_ids or r.get("id") in by_id]
            old_by_id = {r.get('id'): r for r in get(old, path)}
            for r in merged + list(by_id.values()):
                before = old_by_id.get(r.get('id'), {})
                if r.get('id') not in hidden_ids:
                    if 'history' in before: r['history'] = copy.deepcopy(before['history'])
                    hidden_refs = [ref for ref in before.get('objectRefs', []) if ref not in next((x.get('objectRefs', []) for x in previous if x.get('id') == r.get('id')), [])]
                    if hidden_refs or 'objectRefs' in before or 'objectRefs' in r: r['objectRefs'] = hidden_refs + r.get('objectRefs', [])
            put(result, path, merged + list(by_id.values()))
        result['updatedAt'] = incoming.get('updatedAt', old.get('updatedAt'))
        return result

    def validate(self, s, old, u, db):
        if not isinstance(s, dict) or s.get('v') != 1 or not all(isinstance(s.get(k), list) for k in ('items', 'findings', 'years')):
            raise Problem(422, 'État Legacy non reconnu.')
        def identifiers(value):
            if isinstance(value, dict):
                identifier = value.get('id')
                if identifier is not None and (not isinstance(identifier, (str, int, float)) or isinstance(identifier, str) and (len(identifier) > 500 or re.search(r'''["'<>\\\x00-\x1f]''', identifier))):
                    raise Problem(422, 'Identifiant métier invalide.')
                for child in value.values(): identifiers(child)
            elif isinstance(value, list):
                for child in value: identifiers(child)
        identifiers(s)
        ps = s.get('perimeters', [])
        if len(ps) > 10000:
            raise Problem(422, 'Trop de périmètres.')
        pids = {p.get('id') for p in ps}
        for p in ps:
            if not p.get('name') or p.get('parentId') and p['parentId'] not in pids:
                raise Problem(422, 'Rattachement de périmètre invalide.')
            visited, cur = set(), p
            while cur.get('parentId'):
                if cur['id'] in visited:
                    raise Problem(422, 'Cycle dans les périmètres.')
                visited.add(cur['id'])
                cur = next(x for x in ps if x['id'] == cur['parentId'])
        index = self.record_index(s)
        all_ids = []
        for path in PATHS:
            rows = get(s, path)
            if len(rows) > 100000:
                raise Problem(422, 'Collection trop volumineuse.')
            local_ids = [r.get('id') for r in rows if isinstance(r, dict)]
            if len(local_ids) != len(set(local_ids)):
                raise Problem(422, 'Identifiants dupliqués.')
            for r in rows:
                if not isinstance(r, dict):
                    raise Problem(422, 'Objet métier invalide.')
                if not set(r.get('perimeterIds') or []) <= pids:
                    raise Problem(422, 'Périmètre inexistant.')
                for ref in r.get('proofRefs', []):
                    proof = next((p for p in s.get('evidences', []) if p.get('id') == ref.get('evidenceId')), None)
                    if not proof or not any(v.get('id') == ref.get('versionId') for v in proof.get('dfVersions', [])) and ref.get('versionId') != 'legacy':
                        raise Problem(422, 'Version de preuve inexistante.')
                    rscope, pscope = self.scopes(r, index), self.scopes(proof, index)
                    if rscope and (not pscope or not rscope <= pscope):
                        raise Problem(422, 'La preuve ne couvre pas les établissements de cet objet.')
                for parent_key in ('dossierId', 'journeyId', 'biaId', 'planId', 'evaluationId'):
                    parent_id = r.get(parent_key)
                    if parent_id and parent_id not in index:
                        raise Problem(422, 'Relation métier inexistante : ' + parent_key)
                responsible = r.get('responsible')
                if responsible:
                    roles = {x.get('id'): x for x in s.get('roles', [])}
                    role = roles.get(responsible.get('roleId'))
                    if not role: raise Problem(422, 'Rôle responsable inexistant.')
                    if responsible.get('userId'):
                        member = next((x for x in self.users(db) if x['id'] == responsible['userId'] and x['active']), None)
                        if not member or role['id'] not in member['roleIds'] and member['id'] not in role.get('userIds', []): raise Problem(422, 'Compte non affecté au rôle.')
                        if member['permission'] != 'admin' and not self.scopes(r, index) <= self.allowed(s, member): raise Problem(422, 'Le responsable ne couvre pas cet établissement.')
                for dep in r.get('dependsOn', []):
                    if dep not in index:
                        raise Problem(422, 'Dépendance inexistante.')
        if u['permission'] != 'admin':
            old_tasks = {t.get('id'): t for t in get(old or {}, ('journey', 'tasks'))}
            if not old_tasks.keys() <= {t.get('id') for t in get(s, ('journey', 'tasks'))}: raise Problem(403, 'La suppression des sous-tâches est réservée à l’administration.')
            for t in get(s, ('journey', 'tasks')):
                prior = old_tasks.get(t.get('id'))
                if prior and any(t.get(k) != prior.get(k) for k in ('mandatory', 'requiresValidation', 'requireProof', 'requireLatestProof', 'requiredFields', 'requirement')):
                    raise Problem(403, 'La configuration des contrôles est réservée à l’administration.')
        before_proofs = {p.get('id'): p for p in (old or {}).get('evidences', [])}
        for p in s.get('evidences', []):
            before = before_proofs.get(p.get('id'), {})
            if encoded(before.get('dfValidations', [])) != encoded(p.get('dfValidations', [])) and not u['canValidate']:
                raise Problem(403, 'Validation des preuves non autorisée.')
            financial = p.get('financial')
            if financial:
                if any(not isinstance(financial.get(k), int) or isinstance(financial.get(k), bool) or financial[k] < 0 or financial[k] > 100000000000000 for k in ('amountHT', 'amountTTC')) or financial['amountTTC'] < financial['amountHT']:
                    raise Problem(422, 'Montants du justificatif financier invalides.')
            prior_validations = {v.get('id') for v in before.get('dfValidations', [])}
            for val in p.get('dfValidations', []):
                if val.get('id') not in prior_validations:
                    val['actorId'] = u['id']; val['actor'] = u['name']
            for v in p.get('dfVersions', []):
                blob = db.execute('SELECT * FROM files WHERE key=?', (v.get('fileKey'),)).fetchone()
                if blob and u['permission'] != 'admin' and blob['owner'] != u['id']:
                    allowed_keys = {v.get('fileKey') for p in (self.project(old, u) or {}).get('evidences', []) for v in p.get('dfVersions', [])}
                    if v.get('fileKey') not in allowed_keys: raise Problem(403, 'Pièce physique hors périmètre.')
                if not blob or blob['sha256'] != v.get('sha256') or len(blob['data']) != v.get('size'):
                    raise Problem(422, 'Pièce physique absente ou empreinte invalide. Importez la sauvegarde complète.')
        for e in s.get('df', {}).get('evaluations', []):
            if e.get('status') in ('Atteint', 'Conforme'):
                accepted = any(self.proof_accepted(s, r, latest=False) for r in e.get('proofRefs', []))
                if not accepted and any(x.get('id') == e.get('id') and x.get('status') == e.get('status') for x in (old or {}).get('df', {}).get('evaluations', [])):
                    e['status'] = 'À vérifier' if e['status'] == 'Atteint' else 'Partiel'
                    continue
                previous_status = next((x.get('status') for x in (old or {}).get('df', {}).get('evaluations', []) if x.get('id') == e.get('id')), None)
                if previous_status != e.get('status') and not u['canValidate']:
                    raise Problem(403, 'Validation d’exigence non autorisée.')
                if not accepted or not e.get('reviewer') or not e.get('reviewedAt'):
                    raise Problem(422, 'Validation interne incomplète : preuve acceptée, vérificateur et date requis.')
        # Les nouvelles validations humaines ne peuvent pas être usurpées côté navigateur.
        for path in [('journey', 'runs'), ('journey', 'tasks'), ('pcra', 'bias'), ('pcra', 'plans'), ('pcra', 'exercises'), ('pcra', 'policies')]:
            previous = {x.get('id'): x for x in get(old or {}, path)}
            for r in get(s, path):
                validation = r.get('validation')
                if validation and validation != previous.get(r.get('id'), {}).get('validation'):
                    if not u['canValidate']:
                        raise Problem(403, 'Validation humaine non autorisée.')
                    validation['actorId'] = u['id']; validation['actor'] = u['name']
        validate_risks(s, old, u, self, Problem)
        self.sync_perimeters(s, old, u)
        self.validate_pcra(s, old, u)
        self.reconcile(s)
        s.setdefault('df', {})['actor'] = u['name']
        prior_events = {x.get('id') for x in (old or {}).get('df', {}).get('history', [])}
        for event in s.get('df', {}).get('history', []):
            if event.get('id') not in prior_events:
                event['actorId'] = u['id']; event['actor'] = u['name']

    def allocate_identifiers(self, s, old, u, db):
        if not isinstance(s, dict): raise Problem(422, 'État invalide.')
        if u['permission'] == 'admin':
            s.setdefault('integration', {'schema':1})['adminSchema'] = 1
            roles = s.setdefault('roles', [])
            for template in BASE_ROLES:
                if not any(r.get('baseRoleKey') == template['key'] or r.get('name', '').casefold() == template['name'].casefold() for r in roles):
                    roles.append({**template, 'baseRoleKey': template['key'], 'id': 'ROLE-' + secrets.token_hex(12), 'holder': '', 'deputy': '', 'email': '', 'phone': '', 'refs': [], 'perimeterIds': [], 'userIds': []})
        records = []
        for prefix, paths in ID_PREFIXES.items():
            for path in paths:
                for r in get(s, path):
                    if not isinstance(r, dict): raise Problem(422, 'Objet invalide.')
                    selected = 'PRA' if prefix == 'PCA' and r.get('kind') == 'PRA' else prefix
                    records.append((selected, r))
                    if prefix == 'IMP': records.extend(('ACTI', a) for a in r.get('activities', []))
        old_codes = {r.get('id'): r.get('internalId') for path in PATHS for r in get(old or {}, path) if isinstance(r, dict)}
        old_codes.update({a.get('id'):a.get('internalId') for b in (old or {}).get('pcra',{}).get('bias',[]) for a in b.get('activities',[])})
        used = set()
        for prefix, r in records:
            code = r.get('internalId')
            previous = old_codes.get(r.get('id'))
            if previous and code != previous: raise Problem(422, 'L’identifiant interne est immuable.')
            if code:
                if not isinstance(code,str) or len(code)>100 or code.casefold() in used: raise Problem(422,'Identifiant interne dupliqué ou invalide.')
                if not previous and u['permission'] != 'admin': raise Problem(403, 'Identifiant attribué par le serveur.')
                used.add(code.casefold())
                match = re.fullmatch(re.escape(prefix)+r'-(\d+)',code)
                if match: db.execute('INSERT INTO code_counters VALUES(?,?) ON CONFLICT(prefix) DO UPDATE SET value=MAX(value,excluded.value)',(prefix,int(match.group(1))))
        for prefix, r in records:
            if not r.get('internalId'):
                db.execute('INSERT OR IGNORE INTO code_counters VALUES(?,0)',(prefix,))
                while True:
                    db.execute('UPDATE code_counters SET value=value+1 WHERE prefix=?',(prefix,))
                    n=db.execute('SELECT value FROM code_counters WHERE prefix=?',(prefix,)).fetchone()[0]
                    code=prefix+'-'+str(n).zfill(6)
                    if code.casefold() not in used: break
                r['internalId']=code;used.add(code.casefold())

    def sync_perimeters(self, s, old, u):
        perimeters = {p['id']: p for p in s.get('perimeters', [])}
        old_perimeters = {p['id']: p for p in (old or {}).get('perimeters', [])}
        old_establishments = {e.get('id'): e for e in (old or {}).get('crrc', {}).get('establishments', [])}
        for e in s.get('crrc', {}).get('establishments', []):
            p = perimeters.get(e.get('perimeterId'))
            if not p: continue
            previous = old_establishments.get(e.get('id'), {})
            if previous.get('perimeterId') == p['id'] and e.get('name') != previous.get('name') and p.get('name') == old_perimeters.get(p['id'], {}).get('name'):
                if u['permission'] != 'admin': raise Problem(403, 'La désignation organisationnelle est réservée à l’administration.')
                p['name'] = e['name']
            e['name'] = p['name']; e['syncedPerimeterName'] = p['name']; e['perimeterIds'] = [p['id']]
        for d in s.get('df', {}).get('dossiers', []):
            if d.get('perimeterIds'): d['scope'] = [perimeters[id]['name'] for id in d['perimeterIds']]

    def changes(self, before, after):
        changes = []
        for path in PATHS:
            old = {r.get('id'): r for r in get(before or {}, path)}
            new = {r.get('id'): r for r in get(after or {}, path)}
            for id in old.keys() | new.keys():
                a, b = old.get(id, {}), new.get(id, {})
                keys = (a.keys() | b.keys()) - {'history'}
                delta = {k: {'before': a.get(k), 'after': b.get(k)} for k in keys if a.get(k) != b.get(k)}
                if delta: changes.append({'path': '.'.join(path), 'id': id, 'changes': delta})
        return changes

    def validate_pcra(self, s, old, u):
        pcra = s.get('pcra', {})
        policies = {p['id']: p for p in pcra.get('policies', [])}
        old_policies = {p['id']: p for p in (old or {}).get('pcra', {}).get('policies', [])}
        bias = {b['id']: b for b in pcra.get('bias', [])}
        old_bias = {b['id']: b for b in (old or {}).get('pcra', {}).get('bias', [])}
        for p in policies.values():
            if p['id'] in old_policies and without_codes(p) != without_codes(old_policies[p['id']]): raise Problem(422, 'Une politique est immuable : créez une nouvelle version.')
            for key in ('horizons', 'dimensions', 'levels'):
                rows = p.get(key, [])
                if not 1 <= len(rows) <= 30 or len({r.get('id') for r in rows}) != len(rows) or any(not r.get('label') for r in rows): raise Problem(422, 'Politique BIA invalide.')
            if any(not isinstance(h.get('hours'), (int, float)) or h['hours'] <= 0 for h in p['horizons']): raise Problem(422, 'Horizon BIA invalide.')
            if any(not isinstance(l.get('rank'), (int, float)) or not re.fullmatch(r'#[0-9a-fA-F]{6}', l.get('color', '')) for l in p['levels']): raise Problem(422, 'Niveau BIA invalide.')
        for b in bias.values():
            p = policies.get(b.get('policyId'))
            if not p or not b.get('perimeterIds'): raise Problem(422, 'Politique et périmètre BIA requis.')
            covered = self.allowed(s, {'perimeterIds': p.get('perimeterIds', [])})
            if not set(b['perimeterIds']) <= covered: raise Problem(422, 'Politique hors périmètre BIA.')
            previous = old_bias.get(b['id'])
            changed = not previous or any(without_codes(b.get(k)) != without_codes(previous.get(k)) for k in ('activities', 'policyId', 'perimeterIds'))
            b['contentRevision'] = (previous or {}).get('contentRevision', 0) + int(changed)
            issues = self.bia_issues(b, p)
            b['issues'] = issues
            validation = b.get('validation') or {}
            if validation and (validation != (previous or {}).get('validation')) and issues: raise Problem(422, 'BIA incomplet : ' + ' · '.join(issues[:3]))
            b['status'] = 'Validé en interne' if validation.get('contentRevision') == b['contentRevision'] and not issues else 'À réévaluer' if validation else 'Brouillon'
        for p in pcra.get('plans', []):
            b = bias.get(p.get('biaId'))
            if not b or p.get('kind') not in ('PCA', 'PRA') or not set(p.get('perimeterIds', [])) <= set(b['perimeterIds']) or any(a not in {x['id'] for x in b['activities']} for a in p.get('activityIds', [])):
                raise Problem(422, 'Plan PCRA ou activités associés invalides.')
            issues = self.plan_issues(p, b)
            previous = next((x for x in (old or {}).get('pcra', {}).get('plans', []) if x['id'] == p['id']), {})
            val = p.get('validation') or {}
            if val and val != previous.get('validation') and issues: raise Problem(422, 'Plan incomplet : ' + ' · '.join(issues[:3]))
            p['needsReview'] = p.get('biaRevision') != b['contentRevision']
            valid = not issues and val.get('version') == p.get('version') and val.get('biaRevision') == b['contentRevision']
            p['status'] = 'À réévaluer' if p['needsReview'] else 'Validé en interne' if valid else 'Brouillon'
            p['reviewState'] = 'BIA modifié — plan à réexaminer' if p['needsReview'] else 'Version actuelle validée' if valid else 'À valider'
        for e in pcra.get('exercises', []):
            if e.get('status') == 'Réalisé' and not all(e.get(k) for k in ('date', 'results', 'retex')): raise Problem(422, 'Exercice réalisé : date, résultats et RETEX requis.')

    def bia_issues(self, b, p):
        issues = []
        if not b.get('activities'): issues.append('Aucune activité')
        for a in b.get('activities', []):
            if not isinstance(a.get('maxInterruptionHours'), (int, float)) or a['maxInterruptionHours'] <= 0: issues.append('Délai maximal acceptable requis')
            for key in ('minimumService', 'humanNeeds', 'materialNeeds', 'siNeeds', 'buildingNeeds', 'supplierNeeds', 'dependencies', 'workarounds', 'justification'):
                if not a.get(key): issues.append('Renseigner ' + key)
            for h in p['horizons']:
                for d in p['dimensions']:
                    if (a.get('impacts') or {}).get(h['id'], {}).get(d['id']) not in {l['id'] for l in p['levels']}: issues.append('Impact temporel non évalué')
            if a.get('rtoBusinessHours') is not None and a.get('maxInterruptionHours') and a['rtoBusinessHours'] > a['maxInterruptionHours']: issues.append('RTO métier supérieur au délai maximal')
        return issues

    def plan_issues(self, p, b):
        issues = []
        if b.get('status') != 'Validé en interne': issues.append('BIA actuel non validé')
        if p.get('biaRevision') != b.get('contentRevision'): issues.append('BIA modifié : réexaminer le plan')
        if not p.get('activityIds'): issues.append('Activités couvertes à sélectionner')
        for key in ('activation', 'procedure', 'communication', 'resources', 'dependencies', 'returnToNormal'):
            if not p.get(key): issues.append('Renseigner ' + key)
        if p.get('kind') == 'PRA' and (p.get('technicalRtoHours') is None or p.get('technicalRpoHours') is None): issues.append('Objectifs techniques RTO/RPO à définir')
        return issues

    def proof_accepted(self, s, ref, latest=True):
        p = next((p for p in s.get('evidences', []) if p.get('id') == ref.get('evidenceId')), {})
        versions = p.get('dfVersions', [])
        vals = [v for v in p.get('dfValidations', []) if v.get('versionId') == ref.get('versionId')]
        return bool(versions and (versions[-1].get('id') == ref.get('versionId') if latest else any(v.get('id') == ref.get('versionId') for v in versions)) and vals and vals[-1].get('status') == 'Acceptée en interne' and not p.get('obsolete') and (not p.get('review') or p['review'] >= time.strftime('%Y-%m-%d')))

    def reconcile(self, s):
        """Réconciliation canonique partagée par chaque sauvegarde, y compris les anciens menus."""
        index = self.record_index(s)
        tasks = s.get('journey', {}).get('tasks', [])
        by_id = {t['id']: t for t in tasks}
        actions = {a.get('id'): a for a in s.get('findings', [])}
        def snapshot(r):
            ignored = {'id', 'createdAt', 'updatedAt', 'history', 'validation', 'objectRefs', 'actionIds', 'reviewState', 'needsReview'}
            return without_codes({k: copy.deepcopy(v) for k, v in (r or {}).items() if k not in ignored})
        visited = set()
        def task_status(t, chain):
            if t['id'] in chain: raise Problem(422, 'Cycle entre les sous-tâches.')
            if t['id'] in visited: return
            chain = chain | {t['id']}
            for dep in t.get('dependsOn', []):
                if dep not in by_id: raise Problem(422, 'Dépendance de sous-tâche inconnue.')
                task_status(by_id[dep], chain)
            a = actions.get(t.get('actionId'))
            if a and a.get('status') != t.get('lastActionStatus'):
                t['completionRequested'] = a.get('status') == 'Clos'
                t['started'] = a.get('status') != 'Ouvert'
                t['lastActionStatus'] = a.get('status')
            ref = t.get('businessRef') or {}
            obj = index.get(ref.get('id'))
            missing = []
            if not obj: missing.append('Objet métier à renseigner')
            for key in t.get('requiredFields', []):
                if not (obj or {}).get(key): missing.append('Donnée manquante : ' + key)
            if obj and not set(t.get('perimeterIds') or []) <= self.scopes(obj, index): missing.append('Couverture des périmètres à compléter')
            refs = t.get('proofRefs') or (obj or {}).get('proofRefs') or []
            if not refs and ref.get('kind') == 'proof' and (obj or {}).get('dfVersions'):
                refs = [{'evidenceId': obj['id'], 'versionId': obj['dfVersions'][-1]['id']}]
            if t.get('requireProof') and not any(self.proof_accepted(s, r, latest=t.get('requireLatestProof', True)) for r in refs): missing.append('Version actuelle de preuve acceptée en interne requise')
            if t.get('requirement') and obj and obj.get('status') not in ('Atteint', 'Conforme', 'Non applicable'): missing.append('Exigence à évaluer et valider dans son registre')
            if any(by_id[dep].get('status') != 'Terminé' for dep in t.get('dependsOn', [])): missing.append('Dépendance non terminée')
            needs = bool(t.get('requiresValidation') and (not t.get('validation') or snapshot(t['validation'].get('dataSnapshot')) != snapshot(obj)))
            requested = t.get('completionRequested', False)
            status = 'Bloqué' if t.get('blocked') or requested and missing else 'En attente de validation' if requested and needs else 'Terminé' if requested else 'En cours' if t.get('started') or a and a.get('status') == 'En cours' else 'Non commencé'
            t.update({'status': status, 'issues': missing, 'needsValidation': needs})
            visited.add(t['id'])
        for t in tasks:
            if t.get('stepId') not in {step['id'] for step in JOURNEY_STEPS}: raise Problem(422, 'Étape inconnue.')
            task_status(t, set())
        for r in s.get('journey', {}).get('runs', []):
            r['steps'] = [{'id': step['id'], 'label': step['label']} for step in JOURNEY_STEPS]
            for step in r['steps']:
                ts = [t for t in tasks if t.get('journeyId') == r['id'] and t.get('stepId') == step['id'] and t.get('mandatory')]
                done = sum(t.get('status') == 'Terminé' for t in ts)
                status = 'Terminé' if done == len(ts) else 'Bloqué' if any(t.get('status') == 'Bloqué' for t in ts) else 'En attente de validation' if any(t.get('status') == 'En attente de validation' for t in ts) else 'En cours' if any(t.get('status') != 'Non commencé' for t in ts) else 'Non commencé'
                step.update({'total': len(ts), 'done': done, 'status': status})
            steps = r.get('steps', [])
            r['currentStep'] = next((step['id'] for step in steps if step['status'] != 'Terminé'), 'finished')
            r['progress'] = round(sum(step.get('status') == 'Terminé' for step in steps) / len(steps) * 100) if steps else 0
        return s

class Handler(SimpleHTTPRequestHandler):
    store = None
    def log_message(self, fmt, *args):
        # Ni corps, ni cookie, ni paramètres de session dans les journaux.
        if not self.path.startswith('/api/'):
            super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('X-Frame-Options', 'DENY')
        self.send_header('Cross-Origin-Resource-Policy', 'same-origin')
        super().end_headers()

    def host_check(self):
        expected = {'127.0.0.1:' + str(self.server.server_port), 'localhost:' + str(self.server.server_port)}
        if self.headers.get('Host') not in expected:
            raise Problem(403, 'Accès local uniquement.')
        if self.command != 'GET' and self.headers.get('Origin') not in {'http://' + h for h in expected}:
            raise Problem(403, 'Origine non autorisée.')
        if self.headers.get('Sec-Fetch-Site') == 'cross-site':
            raise Problem(403, 'Requête intersite refusée.')

    def send_json(self, data, status=200, cookie=None):
        raw = encoded(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        if cookie: self.send_header('Set-Cookie', cookie)
        self.end_headers(); self.wfile.write(raw)

    def read_body(self, limit=MAX_JSON):
        try: n = int(self.headers.get('Content-Length', '-1'))
        except ValueError: n = -1
        if n < 0 or n > limit: raise Problem(413, 'Requête trop volumineuse.')
        body = self.rfile.read(n)
        if len(body) != n: raise Problem(400, 'Corps incomplet.')
        return body

    def read_json(self):
        try:
            def pairs(rows):
                out = {}
                for k, v in rows:
                    if k in ('__proto__', 'prototype', 'constructor') or k in out:
                        raise ValueError()
                    out[k] = v
                return out
            return json.loads(self.read_body(), object_pairs_hook=pairs, parse_constant=lambda value: (_ for _ in ()).throw(ValueError('Constante JSON interdite')))
        except (ValueError, UnicodeError): raise Problem(400, 'JSON invalide.')

    def auth(self, db, mutate=False):
        cookie = SimpleCookie()
        try: cookie.load(self.headers.get('Cookie', ''))
        except Exception: raise Problem(401, 'Connexion requise.')
        token = cookie.get('legacy_session')
        row = db.execute('SELECT * FROM sessions WHERE token=? AND expires>?', (hashlib.sha256(token.value.encode()).hexdigest() if token else '', time.time())).fetchone()
        if not row: raise Problem(401, 'Connexion requise.')
        ur = db.execute('SELECT data FROM users WHERE id=?', (row['user_id'],)).fetchone()
        u = json.loads(ur['data']) if ur else None
        if not u or not u['active']: raise Problem(401, 'Compte désactivé.')
        if mutate and not hmac.compare_digest(self.headers.get('X-CSRF-Token', ''), row['csrf']):
            raise Problem(403, 'Protection de session : rechargez la page.')
        return u, row['csrf']

    def create_user(self, db, data, initial=False):
        login = str(data.get('login', '')).strip()
        password, name = data.get('password', ''), str(data.get('name', '')).strip()
        if not re.fullmatch(r'[A-Za-z0-9_.-]{3,80}', login) or not name or len(name) > 200 or not isinstance(password, str) or not 12 <= len(password) <= 200:
            raise Problem(422, 'Identifiant (3 à 80 caractères), nom et mot de passe (12 à 200 caractères) requis.')
        permission = 'admin' if initial else data.get('permission', 'viewer')
        if permission not in ('admin', 'editor', 'viewer'): raise Problem(422, 'Permission inconnue.')
        _, s = self.store.state(db)
        pids, rids = data.get('perimeterIds', []), data.get('roleIds', [])
        if not isinstance(pids, list) or not isinstance(rids, list) or not set(pids) <= {p['id'] for p in (s or {}).get('perimeters', [])} or not set(rids) <= {r['id'] for r in (s or {}).get('roles', [])}:
            raise Problem(422, 'Affectation inconnue.')
        u = {'id': 'USER-' + secrets.token_hex(12), 'login': login, 'name': name, 'permission': permission, 'perimeterIds': pids, 'roleIds': rids, 'canValidate': True if permission == 'admin' else bool(data.get('canValidate', False)), 'active': True}
        salt = secrets.token_hex(24)
        try: db.execute('INSERT INTO users VALUES(?,?,?,?,?)', (u['id'], login, encoded(u), salt, password_hash(password, salt)))
        except sqlite3.IntegrityError: raise Problem(409, 'Cet identifiant existe déjà.')
        return u

    def api(self):
        self.host_check()
        path = urlsplit(self.path).path
        st = self.store
        with st.lock, st.connect() as db:
            if path == '/api/session' and self.command == 'GET':
                setup = bool(db.execute('SELECT 1 FROM users').fetchone())
                try:
                    u, csrf = self.auth(db)
                    return self.send_json({'configured': setup, 'user': public_user(u), 'csrf': csrf})
                except Problem: return self.send_json({'configured': setup, 'user': None})
            if path in ('/api/setup', '/api/login') and self.command == 'POST':
                st.attempts = [x for x in st.attempts if x > time.time() - 300]
                if len(st.attempts) >= 20: raise Problem(429, 'Trop de tentatives : réessayez dans cinq minutes.')
                data = self.read_json()
                if path == '/api/setup':
                    if db.execute('SELECT 1 FROM users').fetchone(): raise Problem(409, 'Installation déjà initialisée.')
                    u = self.create_user(db, data, True)
                    st.trace(db, u['id'], 'Initialisation administrateur', None, public_user(u))
                else:
                    row = db.execute('SELECT * FROM users WHERE login=?', (data.get('login'),)).fetchone()
                    salt = row['salt'] if row else '0' * 48
                    good = hmac.compare_digest(password_hash(str(data.get('password', ''))[:200], salt), row['hash'] if row else '0' * 64)
                    if not good or not row or not json.loads(row['data'])['active']:
                        st.attempts.append(time.time()); raise Problem(401, 'Identifiants incorrects.')
                    u = json.loads(row['data'])
                token, csrf = secrets.token_urlsafe(40), secrets.token_urlsafe(32)
                db.execute('DELETE FROM sessions WHERE expires<?', (time.time(),))
                db.execute('INSERT INTO sessions VALUES(?,?,?,?)', (hashlib.sha256(token.encode()).hexdigest(), u['id'], csrf, time.time() + 8 * 3600))
                db.commit()
                return self.send_json({'user': public_user(u), 'csrf': csrf}, cookie='legacy_session=' + token + '; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800')
            u, csrf = self.auth(db, self.command != 'GET')
            if path == '/api/logout' and self.command == 'POST':
                db.execute('DELETE FROM sessions WHERE user_id=? AND csrf=?', (u['id'], csrf)); db.commit()
                return self.send_json({}, cookie='legacy_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
            if path == '/api/users':
                if self.command == 'GET':
                    users = st.users(db)
                    if u['permission'] != 'admin':
                        allowed = st.allowed(st.state(db)[1] or {}, u)
                        _, state = st.state(db)
                        roles = [r for r in (state or {}).get('roles', []) if st.allowed(state or {}, {'perimeterIds': r.get('perimeterIds', [])}) & allowed]
                        members = {id for r in roles for id in r.get('userIds', [])}
                        role_ids = {r['id'] for r in roles}
                        users = [x for x in users if x['id'] == u['id'] or bool(set(x['perimeterIds']) & allowed) or x['id'] in members or set(x['roleIds']) & role_ids]
                    return self.send_json({'users': [public_user(x) for x in users]})
                if u['permission'] != 'admin': raise Problem(403, 'Administration requise.')
                if self.command == 'POST':
                    data = self.read_json()
                    target = next((x for x in st.users(db) if x['id'] == data.get('id')), None)
                    if target:
                        before = copy.deepcopy(target)
                        permission = data.get('permission', target['permission'])
                        if permission not in ('admin', 'editor', 'viewer'): raise Problem(422, 'Permission inconnue.')
                        target.update({k: data[k] for k in ('name', 'active', 'canValidate', 'perimeterIds', 'roleIds') if k in data})
                        target['permission'] = permission
                        _, s = st.state(db)
                        if not set(target['perimeterIds']) <= {p['id'] for p in (s or {}).get('perimeters', [])} or not set(target['roleIds']) <= {r['id'] for r in (s or {}).get('roles', [])}: raise Problem(422, 'Affectation inconnue.')
                        if not any((x if x['id'] != target['id'] else target)['active'] and (x if x['id'] != target['id'] else target)['permission'] == 'admin' for x in st.users(db)):
                            raise Problem(422, 'Conservez au moins un administrateur actif.')
                        db.execute('UPDATE users SET data=? WHERE id=?', (encoded(target), target['id']))
                        if data.get('password'):
                            if not 12 <= len(data['password']) <= 200: raise Problem(422, 'Mot de passe trop court.')
                            salt = secrets.token_hex(24)
                            db.execute('UPDATE users SET salt=?,hash=? WHERE id=?', (salt, password_hash(data['password'], salt), target['id']))
                        db.execute('DELETE FROM sessions WHERE user_id=?', (target['id'],))
                    else:
                        target = self.create_user(db, data); before = None
                    st.trace(db, u['id'], 'Habilitation', before, public_user(target)); db.commit()
                    return self.send_json({'user': public_user(target)})
            if path == '/api/state':
                version, old = st.state(db)
                if self.command == 'GET': return self.send_json({'version': version, 'state': st.project(old, u)})
                if self.command == 'PUT':
                    incoming = self.read_json()
                    if incoming.get('version') != version: raise Problem(409, 'Données modifiées ailleurs. Rechargez avant de poursuivre ; votre saisie peut être exportée.')
                    next_state = st.merge(old, incoming.get('state'), u)
                    st.allocate_identifiers(next_state, old, u, db)
                    st.validate(next_state, old, u, db)
                    st.trace(db, u['id'], 'Sauvegarde métier', old, next_state, {'objects': st.changes(old, next_state)})
                    db.execute('UPDATE state SET version=?,data=? WHERE id=1', (version + 1, encoded(next_state))); db.commit()
                    return self.send_json({'version': version + 1, 'state': st.project(next_state, u)})
            if path.startswith('/api/files/'):
                key = unquote(path[len('/api/files/'):])
                if not KEY.fullmatch(key): raise Problem(400, 'Référence de pièce invalide.')
                version, s = st.state(db)
                if self.command == 'PUT':
                    if u['permission'] not in ('admin', 'editor'): raise Problem(403, 'Dépôt non autorisé.')
                    existing = db.execute('SELECT key FROM files WHERE key=?', (key,)).fetchone()
                    if existing: raise Problem(409, 'La pièce est immuable : créez une nouvelle version.')
                    data = self.read_body(MAX_FILE)
                    if not data: raise Problem(422, 'Pièce vide.')
                    db.execute('INSERT INTO files VALUES(?,?,?,?,?)', (key, u['id'], hashlib.sha256(data).hexdigest(), self.headers.get('Content-Type', 'application/octet-stream')[:200], data))
                    st.trace(db, u['id'], 'Dépôt de pièce', None, {'key': key, 'sha256': hashlib.sha256(data).hexdigest()}); db.commit()
                    return self.send_json({'key': key})
                if self.command == 'GET':
                    blob = db.execute('SELECT * FROM files WHERE key=?', (key,)).fetchone()
                    if not blob: raise Problem(404, 'Pièce introuvable.')
                    proofs = [p for p in (s or {}).get('evidences', []) if any(v.get('fileKey') == key for v in p.get('dfVersions', []))]
                    if u['permission'] != 'admin' and not any(st.visible(p, st.record_index(s or {}), st.allowed(s or {}, u)) for p in proofs):
                        if proofs or blob['owner'] != u['id']: raise Problem(403, 'Pièce hors périmètre.')
                    self.send_response(200); self.send_header('Content-Type', 'application/octet-stream'); self.send_header('Content-Disposition', 'attachment; filename="piece"'); self.send_header('Content-Length', str(len(blob['data']))); self.end_headers(); self.wfile.write(blob['data']); return
            if path == '/api/admin/status' and self.command == 'GET':
                if u['permission'] != 'admin': raise Problem(403, 'Administration requise.')
                _, state = st.state(db)
                return self.send_json({'schema': 2, 'users': len(st.users(db)), 'perimeters': len((state or {}).get('perimeters',[])), 'sessions': db.execute('SELECT COUNT(*) FROM sessions WHERE expires>?',(time.time(),)).fetchone()[0], 'prefixes': sorted(set(ID_PREFIXES) | {'PRA','ACTI'}), 'riskSchema': 1})
            if path == '/api/audit' and self.command == 'GET':
                if u['permission'] != 'admin': raise Problem(403, 'Administration requise.')
                rows = [dict(x) for x in db.execute('SELECT * FROM audit ORDER BY id DESC LIMIT 500')]
                return self.send_json({'events': rows})
            raise Problem(404, 'Route inconnue.')

    def dispatch(self):
        try:
            if self.path.startswith('/api/'):
                return self.api()
            self.host_check()
            if self.command != 'GET': raise Problem(405, 'Méthode non autorisée.')
            path = unquote(urlsplit(self.path).path)
            if path == '/favicon.ico':
                self.send_response(204); self.end_headers(); return
            parts = Path(path).parts
            # Liste explicite : aucun répertoire de données, dépôt, tests ou doc interne servi.
            if '..' in parts or not (path in ('/', '/index.html', '/favicon.ico') or path.startswith(('/modules/', '/lib/', '/sources/'))):
                raise Problem(404, 'Fichier non publié.')
            root = Path(self.directory).resolve()
            target = (root / path.lstrip('/')).resolve()
            if not target.is_relative_to(root) or target.is_dir() and path != '/': raise Problem(404, 'Fichier non publié.')
            super().do_GET()
        except Problem as e: self.send_json({'error': e.message}, e.status)
        except (TypeError, KeyError, AttributeError, ValueError, RecursionError): self.send_json({'error': 'Données invalides.'}, 422)

    do_GET = dispatch
    do_POST = dispatch
    do_PUT = dispatch
    do_DELETE = dispatch
