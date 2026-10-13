"""Apparence globale : contrat API, droits, validation, concurrence, audit, migration (fixtures synthétiques)."""
import functools, http.cookiejar, json, secrets, sqlite3, sys, tempfile, threading, unittest, urllib.error, urllib.request
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from legacy_server import Handler, Store, ThreadingHTTPServer, encoded


class AppearanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        Handler.store = Store(cls.tmp.name)
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.url = 'http://127.0.0.1:' + str(cls.server.server_port)
        cls.password = secrets.token_urlsafe(30)
        cls.admin, cls.admin_csrf = cls.login_new('apparence_admin', 'admin', setup=True)
        cls.second_admin, cls.second_csrf = cls.login_new('apparence_admin2', 'admin')
        cls.editor, cls.editor_csrf = cls.login_new('apparence_editeur', 'editor')
        cls.viewer, cls.viewer_csrf = cls.login_new('apparence_lecteur', 'viewer')

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown(); cls.server.server_close(); cls.tmp.cleanup()

    @classmethod
    def client(cls):
        return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

    @classmethod
    def call(cls, client, path, method='GET', data=None, csrf='', raw=None, origin=True):
        headers = {'Content-Type': 'application/json', 'X-CSRF-Token': csrf}
        if origin: headers['Origin'] = cls.url
        body = raw if raw is not None else json.dumps(data).encode() if data is not None else None
        request = urllib.request.Request(cls.url + path, data=body, method=method, headers=headers)
        try:
            with client.open(request) as r: return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e: return e.code, json.loads(e.read())

    @classmethod
    def login_new(cls, login, permission, setup=False):
        c = cls.client()
        if setup:
            status, auth = cls.call(c, '/api/setup', 'POST', {'login': login, 'password': cls.password, 'name': login})
            assert status == 200, auth
            return c, auth['csrf']
        status, auth = cls.call(cls.admin, '/api/users', 'POST', {'login': login, 'password': cls.password, 'name': login, 'permission': permission}, cls.admin_csrf)
        assert status == 200, auth
        status, auth = cls.call(c, '/api/login', 'POST', {'login': login, 'password': cls.password})
        assert status == 200, auth
        return c, auth['csrf']

    def current(self):
        return self.call(self.admin, '/api/appearance')[1]

    def put(self, client, csrf, body, **kw):
        return self.call(client, '/api/admin/appearance', 'PUT', body, csrf, **kw)

    def audit_count(self):
        with Handler.store.connect() as db:
            return db.execute("SELECT count(*) FROM audit WHERE action='Apparence globale'").fetchone()[0]

    def test_01_default_and_read_access(self):
        self.assertEqual(self.call(self.client(), '/api/appearance')[0], 401)
        for client in (self.admin, self.editor, self.viewer):
            self.assertEqual(self.call(client, '/api/appearance'), (200, {'style': 'sage', 'revision': 1}))

    def test_02_write_requires_active_admin_csrf_and_origin(self):
        body = {'style': 'clair', 'revision': 1}
        self.assertEqual(self.put(self.client(), '', body)[0], 401)
        self.assertEqual(self.put(self.editor, self.editor_csrf, body)[0], 403)
        self.assertEqual(self.put(self.viewer, self.viewer_csrf, body)[0], 403)
        self.assertEqual(self.put(self.admin, '', body)[0], 403)
        self.assertEqual(self.put(self.admin, 'jeton-invalide', body)[0], 403)
        self.assertEqual(self.put(self.admin, self.admin_csrf, body, origin=False)[0], 403)
        self.assertEqual(self.call(self.admin, '/api/appearance', 'PUT', body, self.admin_csrf)[0], 404)
        self.assertEqual(self.current(), {'style': 'sage', 'revision': 1})

    def test_03_strict_validation_without_partial_write(self):
        bad = [{'style': 'sombre', 'revision': 1}, {'style': 1, 'revision': 1}, {'style': 'clair'}, {'revision': 1},
               {'style': 'clair', 'revision': '1'}, {'style': 'clair', 'revision': True}, {'style': 'clair', 'revision': 1.5},
               {'style': 'clair', 'revision': 0}, {'style': 'clair', 'revision': -3}, {'style': 'clair', 'revision': 2**60},
               {'style': 'clair', 'revision': 1, 'extra': 'x'}, ['clair', 1], 'clair', None]
        before = self.audit_count()
        for body in bad:
            self.assertEqual(self.put(self.admin, self.admin_csrf, None, raw=json.dumps(body).encode())[0], 422, body)
        self.assertEqual(self.put(self.admin, self.admin_csrf, None, raw=b'{invalide')[0], 400)
        self.assertEqual(self.current(), {'style': 'sage', 'revision': 1})
        self.assertEqual(self.audit_count(), before)

    def test_04_save_conflict_noop_and_audit(self):
        stale = self.current()
        status, saved = self.put(self.admin, self.admin_csrf, {'style': 'clair', 'revision': stale['revision']})
        self.assertEqual((status, saved['style'], saved['revision']), (200, 'clair', stale['revision'] + 1))
        for client in (self.editor, self.viewer, self.second_admin):
            self.assertEqual(self.call(client, '/api/appearance')[1], saved)
        # Deuxième administrateur sur l'ancienne révision : conflit, valeur conservée, valeur actuelle renvoyée.
        status, conflict = self.put(self.second_admin, self.second_csrf, {'style': 'sage', 'revision': stale['revision']})
        self.assertEqual(status, 409)
        self.assertEqual({k: conflict[k] for k in ('style', 'revision')}, saved)
        self.assertEqual(self.current(), saved)
        # Même style sur la révision à jour : aucun changement, aucune révision ni trace de plus.
        count = self.audit_count()
        self.assertEqual(self.put(self.second_admin, self.second_csrf, saved)[1], saved)
        self.assertEqual(self.audit_count(), count)
        # Retour au défaut : doit être enregistré comme tout autre changement.
        status, back = self.put(self.second_admin, self.second_csrf, {'style': 'sage', 'revision': saved['revision']})
        self.assertEqual((status, back['style'], back['revision']), (200, 'sage', saved['revision'] + 1))
        self.assertEqual(self.audit_count(), count + 1)
        with Handler.store.connect() as db:
            row = db.execute("SELECT * FROM audit WHERE action='Apparence globale' ORDER BY id DESC LIMIT 1").fetchone()
        details = json.loads(row['details'])
        self.assertEqual(details['before']['style'], 'clair')
        self.assertEqual(details['after'], back)
        self.assertNotIn(self.password, json.dumps(dict(row)))

    def test_05_disabled_account_is_refused(self):
        c, csrf = self.login_new('apparence_inactif', 'editor')
        self.assertEqual(self.call(c, '/api/appearance')[0], 200)
        _, users = self.call(self.admin, '/api/users')
        target = next(u for u in users['users'] if u['login'] == 'apparence_inactif')
        self.assertEqual(self.call(self.admin, '/api/users', 'POST', {'id': target['id'], 'active': False}, self.admin_csrf)[0], 200)
        self.assertEqual(self.call(c, '/api/appearance')[0], 401)

    def test_06_status_reports_schema_and_choice_survives_restart(self):
        current = self.current()
        self.assertEqual(self.call(self.admin, '/api/admin/status')[1]['schema'], 3)
        again = Store(self.tmp.name)
        with again.connect() as db:
            self.assertEqual(again.appearance(db), current)
            self.assertEqual(again.schema_version(db), 3)


class AppearanceMigrationTests(unittest.TestCase):
    def legacy_base(self, tmp, version):
        """Base d'une version antérieure : tables métier seulement, sans configuration d'apparence."""
        path = Path(tmp) / 'legacy.sqlite3'
        db = sqlite3.connect(path)
        db.executescript('''CREATE TABLE state(id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL, data TEXT);
            INSERT INTO state VALUES(1,7,NULL);''')
        db.execute('UPDATE state SET data=?', (encoded({'v': 1, 'findings': [{'id': 'ACTION-FICTIVE'}]}),))
        db.execute(f'PRAGMA user_version={version}'); db.commit(); db.close()

    def test_existing_base_is_preserved_with_default_style(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.legacy_base(tmp, 2)
            store = Store(tmp)
            with store.connect() as db:
                self.assertEqual(store.appearance(db), {'style': 'sage', 'revision': 1})
                self.assertEqual(store.schema_version(db), 3)
                self.assertEqual(store.state(db)[0], 7)
                self.assertEqual(store.state(db)[1]['findings'], [{'id': 'ACTION-FICTIVE'}])

    def test_migration_is_repeatable_and_keeps_choice(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = Store(tmp)
            with store.connect() as db:
                db.execute("UPDATE appearance SET style='clair',revision=4 WHERE id=1")
            for _ in range(2):
                again = Store(tmp)
                with again.connect() as db:
                    self.assertEqual(again.appearance(db), {'style': 'clair', 'revision': 4})
                    self.assertEqual(db.execute('SELECT count(*) FROM appearance').fetchone()[0], 1)

    def test_newer_schema_is_never_downgraded(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.legacy_base(tmp, 9)
            store = Store(tmp)
            with store.connect() as db:
                self.assertEqual(store.schema_version(db), 9)
                self.assertEqual(store.appearance(db), {'style': 'sage', 'revision': 1})

    def test_table_rejects_unknown_style_or_second_row(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = Store(tmp)
            with store.connect() as db:
                with self.assertRaises(sqlite3.IntegrityError): db.execute("UPDATE appearance SET style='sombre'")
                with self.assertRaises(sqlite3.IntegrityError): db.execute("INSERT INTO appearance VALUES(2,'sage',1)")


if __name__ == '__main__':
    unittest.main()
