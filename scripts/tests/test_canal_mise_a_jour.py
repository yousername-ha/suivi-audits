"""Canal de publication lié à l'étiquette (mettre-a-jour.sh) : seule une version dont le manifeste porte la version et le canal
« stable » est choisie par défaut ou acceptée ; « development » exige UPDATE_CHANNEL=development dans .env."""
import json
import os
import re
import stat
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = (ROOT / 'scripts/mettre-a-jour.sh').read_text()
# Fonctions du script, extraites telles quelles (aucune copie à maintenir).
BLOC = SCRIPT[SCRIPT.index('canal_publie() {'):SCRIPT.index('if [ -z "$CIBLE" ]; then\n  for v in')]
EMPREINTE = SCRIPT[SCRIPT.index('empreinte_image() {'):SCRIPT.index('if [ "$LOCALES" = 0 ]; then\n  APP_VERSION')]


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
        self.assertIn('[ "$LOCALES" = 1 ] || canal_autorise "$CIBLE" || arret', SCRIPT)
        self.assertRegex(SCRIPT, re.compile(r"sort -rV"))


class EmpreinteEpinglee(unittest.TestCase):
    """Chemin en ligne de commande : c'est l'empreinte tirée (RepoDigest) qui est vérifiée et épinglée, pas l'étiquette."""

    def lire(self, repo_digests):
        with tempfile.TemporaryDirectory() as d:
            docker = Path(d) / 'docker'
            docker.write_text('#!/bin/sh\nprintf %s "$1_$2" >/dev/null\necho \'' + json.dumps(repo_digests) + '\'\n')
            docker.chmod(docker.stat().st_mode | stat.S_IEXEC)
            script = f"""set -u\n{EMPREINTE}\nempreinte_image ghcr.io/yousername-ha/suivi-audits-api 6.2.0"""
            return subprocess.run(['bash', '-c', script], capture_output=True, text=True,
                                  env={**os.environ, 'PATH': d + ':' + os.environ['PATH']}).stdout

    def test_retient_l_empreinte_du_bon_depot_et_rien_d_autre(self):
        bon = 'ghcr.io/yousername-ha/suivi-audits-api@sha256:' + 'a' * 64
        self.assertEqual(self.lire(['autre.example/x@sha256:' + 'b' * 64, bon]), bon)
        self.assertEqual(self.lire(['ghcr.io/yousername-ha/suivi-audits-web@sha256:' + 'a' * 64]), '')
        self.assertEqual(self.lire(['ghcr.io/yousername-ha/suivi-audits-api@sha256:' + 'z' * 64]), '')
        self.assertEqual(self.lire([]), '')

    def test_le_script_verifie_et_epingle_l_empreinte(self):
        self.assertIn('cosign verify "$EMPREINTE"', SCRIPT)
        self.assertIn('cosign verify-attestation "$EMPREINTE"', SCRIPT)
        self.assertIn('ecrire_env "$(printf \'%s_IMAGE\' "$i" | tr \'a-z\' \'A-Z\')" "$EMPREINTE"', SCRIPT)
        # L'étiquette n'est plus l'objet des vérifications.
        self.assertNotIn('cosign verify "$DEPOT_IMAGES-$i:$CIBLE"', SCRIPT)


if __name__ == '__main__':
    unittest.main()
