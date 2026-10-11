"""Recette synthétique : encodage Windows, réparation et compte de test Legacy."""
import copy, functools, json, runpy, sys, tempfile, threading, unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from legacy_server import BASE_ROLES, Store, Handler, ThreadingHTTPServer, encoded, password_hash
import server_test


class InterfaceStorageTests(unittest.TestCase):
    def test_sources_utf8_even_with_windows_default(self):
        original = Path.read_text
        calls = []
        def windows_read(path, *args, **kwargs):
            calls.append((path.name, kwargs.get('encoding')))
            kwargs.setdefault('encoding', 'cp1252')
            return original(path, *args, **kwargs)
        with patch.object(Path, 'read_text', windows_read):
            module = runpy.run_path(str(ROOT / 'legacy_server.py'))
        self.assertEqual(module['BASE_ROLES'][1]['function'], 'Sécurité des systèmes d’information')
        self.assertEqual(len(calls), 3)
        self.assertTrue(all(encoding == 'utf-8' for _, encoding in calls))

    def test_repair_is_conservative_audited_and_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = Store(tmp)
            direction = {**BASE_ROLES[0], 'baseRoleKey': 'direction', 'id': 'ROLE-ORIGINAL',
                         'internalId': 'ROLE-000123', 'holder': 'Titulaire FICTIF', 'userIds': ['USER-FICTIF'],
                         'perimeterIds': ['PER-FICTIF'], 'email': 'test@example.invalid'}
            rssi = {**BASE_ROLES[1], 'baseRoleKey': 'rssi', 'id': 'ROLE-RSSI'}
            for field in ('name', 'function', 'resp'):
                direction[field] = direction[field].encode('utf-8').decode('cp1252')
                rssi[field] = rssi[field].encode('utf-8').decode('cp1252')
            # Texte personnalisé et rôle sans clé de base : jamais remplacés.
            rssi['resp'] = 'Responsabilité métier personnalisée FICTIVE'
            custom = {'id': 'ROLE-CUSTOM', 'name': 'Rôle FICTIF', 'function': 'Une fonction personnalisée'}
            state = {'roles': [direction, rssi, custom], 'findings': [{'id': 'ACTION-FICTIVE'}],
                     'riskMgmt': {'assessments': [{'id': 'EVR-FICTIVE', 'snapshot': {'role': copy.deepcopy(direction)}}]}}
            with store.connect() as db:
                db.execute('UPDATE state SET version=7,data=? WHERE id=1', (encoded(state),))
            upgraded = Store(tmp)
            with upgraded.connect() as db:
                version, result = upgraded.state(db)
                self.assertEqual(version, 8)
                self.assertEqual(len(result['roles']), 3)
                expected = {**direction, **{field: BASE_ROLES[0][field] for field in ('name','function','resp')}}
                self.assertEqual(result['roles'][0], expected)
                self.assertEqual(result['roles'][1]['function'], BASE_ROLES[1]['function'])
                self.assertEqual(result['roles'][1]['resp'], rssi['resp'])
                self.assertEqual(result['roles'][2], custom)
                self.assertEqual(result['riskMgmt'], state['riskMgmt'])
                self.assertEqual(result['findings'], state['findings'])
                self.assertEqual(db.execute('SELECT count(*) FROM audit').fetchone()[0], 1)
            again = Store(tmp)
            with again.connect() as db:
                self.assertEqual(again.state(db), (version, result))
                self.assertEqual(db.execute('SELECT count(*) FROM audit').fetchone()[0], 1)

    def test_test_account_is_hashed_and_not_reset(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = Store(tmp)
            self.assertTrue(store.ensure_test_admin())
            with store.connect() as db:
                row = dict(db.execute('SELECT * FROM users WHERE login=?', ('admin',)).fetchone())
                self.assertEqual(row['hash'], password_hash('admin', row['salt']))
                self.assertNotIn('password', json.loads(row['data']))
                user = json.loads(row['data'])
                self.assertTrue(user['canValidate'])
                self.assertEqual(user['permission'], 'admin')
                db.execute('UPDATE users SET hash=? WHERE id=?', (password_hash('mot-de-passe-personnalise-FICTIF', row['salt']), row['id']))
            again = Store(tmp)
            self.assertFalse(again.ensure_test_admin())
            with again.connect() as db:
                after = dict(db.execute('SELECT * FROM users').fetchone())
                self.assertEqual(after['id'], row['id'])
                self.assertEqual(after['hash'], password_hash('mot-de-passe-personnalise-FICTIF', row['salt']))
                self.assertEqual(db.execute('SELECT count(*) FROM users').fetchone()[0], 1)
                self.assertEqual(db.execute('SELECT count(*) FROM audit').fetchone()[0], 1)

    def test_existing_disabled_or_reader_admin_is_never_promoted(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = Store(tmp)
            store.ensure_test_admin()
            with store.connect() as db:
                row = db.execute('SELECT * FROM users').fetchone()
                user = json.loads(row['data'])
                user.update({'permission': 'viewer', 'active': False, 'canValidate': False})
                db.execute('UPDATE users SET data=? WHERE id=?', (encoded(user), user['id']))
            self.assertFalse(Store(tmp).ensure_test_admin())
            with store.connect() as db:
                self.assertEqual(store.users(db), [user])
                self.assertEqual(store.state(db), (0, None))


class TestAccountApiTests(unittest.TestCase):
    client = server_test.ServerTests.client
    call = server_test.ServerTests.call

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.store = Store(cls.tmp.name)
        cls.store.ensure_test_admin()
        class LocalHandler(Handler): pass
        LocalHandler.store = cls.store
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(LocalHandler, directory=str(ROOT)))
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = 'http://127.0.0.1:' + str(cls.server.server_port)

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()
        cls.tmp.cleanup()

    def test_login_csrf_strong_creation_and_password_change(self):
        client = self.client()
        self.assertTrue(self.call(client, '/api/session')[1]['testAccountAvailable'])
        self.assertEqual(self.call(client, '/api/state')[0], 401)
        code, auth = self.call(client, '/api/login', 'POST', {'login': 'admin', 'password': 'admin'})
        self.assertEqual(code, 200)
        self.assertEqual(auth['user']['permission'], 'admin')
        self.assertEqual(self.call(client, '/api/users', 'POST', {'login': 'autre', 'password': 'admin', 'name': 'FICTIF'}, auth['csrf'])[0], 422)
        self.assertEqual(self.call(client, '/api/users', 'POST', {'id': auth['user']['id'], 'password': 'admin'}, auth['csrf'])[0], 422)
        self.assertEqual(self.call(client, '/api/users', 'POST', {}, '')[0], 403)
        self.assertEqual(self.call(client, '/api/users', 'POST', {'id': auth['user']['id'], 'password': 'mot-de-passe-personnalise-FICTIF'}, auth['csrf'])[0], 200)
        self.assertFalse(self.store.ensure_test_admin())
        fresh = self.client()
        self.assertFalse(self.call(fresh, '/api/session')[1]['testAccountAvailable'])
        self.assertEqual(self.call(fresh, '/api/login', 'POST', {'login':'admin','password':'admin'})[0], 401)
        self.assertEqual(self.call(fresh, '/api/login', 'POST', {'login':'admin','password':'mot-de-passe-personnalise-FICTIF'})[0], 200)


if __name__ == '__main__': unittest.main()
