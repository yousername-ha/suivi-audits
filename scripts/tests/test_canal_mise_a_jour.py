"""Canal de publication lié à l'étiquette (mettre-a-jour.sh) : seule une version dont le manifeste porte la version et le canal
« stable » est choisie par défaut ou acceptée ; « development » exige UPDATE_CHANNEL=development dans .env."""
import json
import re
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = (ROOT / 'scripts/mettre-a-jour.sh').read_text()
# Fonctions du script, extraites telles quelles (aucune copie à maintenir).
BLOC = SCRIPT[SCRIPT.index('canal_publie() {'):SCRIPT.index('if [ -z "$CIBLE" ]; then\n  for v in')]


def git(repo, *args):
    return subprocess.run(['git', '-C', str(repo), *args], check=True, capture_output=True, text=True).stdout


class CanalMiseAJour(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.repo = Path(self.tmp.name)
        git(self.repo, 'init', '-q')
        git(self.repo, 'config', 'user.email', 'test@exemple.test')
        git(self.repo, 'config', 'user.name', 'Test')

    def publier(self, version, manifeste):
        (self.repo / '.github').mkdir(exist_ok=True)
        (self.repo / '.github/publication.json').write_text(manifeste if isinstance(manifeste, str) else json.dumps(manifeste))
        git(self.repo, 'add', '-A')
        git(self.repo, 'commit', '-q', '-m', f'v{version}')
        git(self.repo, 'tag', f'v{version}')

    def autorise(self, version, canal_env=''):
        script = f'''set -u
valeur_env() {{ [ "$1" = UPDATE_CHANNEL ] && printf %s "{canal_env}" || true; }}
{BLOC}
canal_autorise "{version}" && echo oui || echo non'''
        return subprocess.run(['bash', '-c', script], cwd=self.repo, capture_output=True, text=True).stdout.strip()

    def test_stable_accepte_developpement_refuse_sauf_option(self):
        self.publier('6.0.0', {'version': '6.0.0', 'channel': 'stable'})
        self.publier('6.1.0', {'version': '6.1.0', 'channel': 'development'})
        self.assertEqual(self.autorise('6.0.0'), 'oui')
        self.assertEqual(self.autorise('6.1.0'), 'non')
        self.assertEqual(self.autorise('6.1.0', 'development'), 'oui')
        self.assertEqual(self.autorise('6.0.0', 'development'), 'oui')

    def test_manifeste_illisible_incoherent_ou_absent_refuse(self):
        self.publier('7.0.0', 'pas du json')
        self.publier('7.1.0', {'version': '7.0.0', 'channel': 'stable'})  # autre version
        self.publier('7.2.0', {'version': '7.2.0', 'channel': 'stable', 'extra': 1})
        self.publier('7.3.0', ['stable'])
        for v in ('7.0.0', '7.1.0', '7.2.0', '7.3.0', '9.9.9'):
            with self.subTest(version=v):
                self.assertEqual(self.autorise(v), 'non')
                self.assertEqual(self.autorise(v, 'development'), 'non')

    def test_le_script_utilise_le_canal_pour_le_choix_par_defaut_et_la_cible_explicite(self):
        self.assertIn('canal_autorise "$v"', SCRIPT)
        self.assertIn('canal_autorise "$CIBLE" || arret', SCRIPT)
        self.assertRegex(SCRIPT, re.compile(r"sort -rV"))


if __name__ == '__main__':
    unittest.main()
