"""installer.sh : un .env conservé dont APP_VERSION n'est pas celle du dépôt est signalé, jamais modifié (ADR 0077)."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

RACINE = Path(__file__).resolve().parents[2]
LIB = RACINE / 'scripts' / 'lib-commun.sh'


class VersionDuEnv(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.repo = Path(self.tmp.name)
        self.addCleanup(self.tmp.cleanup)

    def depot(self, version='6.0.1'):
        (self.repo / 'package.json').write_text(f'{{\n  "name": "x",\n  "version": "{version}"\n}}\n')

    def env(self, contenu):
        (self.repo / '.env').write_text(contenu)

    def verifier(self):
        r = subprocess.run(['bash', '-c', 'source "$LIB"; verifier_version_env'], capture_output=True, text=True,
                           env={**os.environ, 'LIB': str(LIB), 'REPO': str(self.repo)}, timeout=20)
        self.assertEqual(r.returncode, 0, r.stderr)
        return r

    def test_version_du_env_differente_signalee_sans_modifier_le_fichier(self):
        self.depot('6.0.1')
        self.env('SITE_ADDRESS=srv01\nAPP_VERSION=6.0.0\n')
        avant = (self.repo / '.env').read_text()
        r = self.verifier()
        self.assertIn('ATTENTION', r.stderr)
        self.assertIn('APP_VERSION=6.0.0', r.stderr)
        self.assertIn('est en 6.0.1', r.stderr)
        self.assertIn("APP_VERSION=6.0.1/' .env", r.stderr)
        self.assertEqual((self.repo / '.env').read_text(), avant)

    def test_meme_version_aucun_message(self):
        self.depot('6.0.1')
        self.env('APP_VERSION=6.0.1\n')
        self.assertEqual(self.verifier().stderr, '')

    def test_versions_non_numeriques_ignorees(self):
        self.depot('6.0.1')
        for valeur in ('test', 'local', '3.0.0-rc1', ''):
            with self.subTest(valeur=valeur):
                self.env(f'APP_VERSION={valeur}\n')
                self.assertEqual(self.verifier().stderr, '')

    def test_guillemets_du_env_ignores(self):
        self.depot('6.0.1')
        self.env('APP_VERSION="6.0.1"\n')
        self.assertEqual(self.verifier().stderr, '')

    def test_sans_env_ou_sans_package_json_aucun_message(self):
        self.depot('6.0.1')
        self.assertEqual(self.verifier().stderr, '')
        self.env('APP_VERSION=6.0.0\n')
        (self.repo / 'package.json').unlink()
        self.assertEqual(self.verifier().stderr, '')

    def test_installateur_ne_controle_que_les_installations_publiees(self):
        """Le contrôle suit « .env existant : conservé » et saute les installations construites ou locales (CI)."""
        texte = (RACINE / 'installer.sh').read_text()
        i = texte.index('Fichier .env existant : conservé.')
        suite = texte[i:i + 400]
        self.assertIn('[ "$CONSTRUIRE" = 1 ] || [ "$LOCALES" = 1 ] || verifier_version_env', suite)


if __name__ == '__main__':
    unittest.main()
