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


# Conservation, contrôle d'espace et ménage des images (ADR 0106) : blocs du script extraits tels quels.
ROTATION = SCRIPT[SCRIPT.index('rang=0\nwhile IFS='):SCRIPT.index('MIGRATIONS_AVANT=$(migrations_appliquees)')]
ESPACE = SCRIPT[SCRIPT.index("mo() { printf '%s Mo'"):SCRIPT.index('# ---------------------------------------------------------------- 2. Notes')]
LIB = (Path(__file__).resolve().parents[2] / 'scripts/lib-commun.sh').read_text()
OCTETS_LIBRES = LIB[LIB.index('octets_libres() {'):LIB.index('# ---------------------------------------------------------------- PostgreSQL')]


class ConservationAvantMiseAJour(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.sauv = Path(self.tmp.name) / 'sauvegardes'
        self.dossier = self.sauv / 'avant-mise-a-jour'
        self.dossier.mkdir(parents=True)

    def archives(self, nombre):
        for i in range(nombre):
            archive = self.dossier / f'avant-maj-7.{i}.0-vers-7.{i + 1}.0-202601{i + 1:02d}-000000.tar.age'
            archive.write_bytes(b'x')
            (self.dossier / (archive.name + '.sha256')).write_text('0' * 64 + '  ' + archive.name + '\n')
            for f in (archive, self.dossier / (archive.name + '.sha256')):
                os.utime(f, (1000 + i * 100, 1000 + i * 100))

    def tourner(self, gardees):
        script = f'set -euo pipefail\nSAUV="{self.sauv}"\nGARDEES={gardees}\n{ROTATION}'
        return subprocess.run(['bash', '-c', script], capture_output=True, text=True)

    def test_garde_le_nombre_regle_avec_leurs_empreintes(self):
        self.archives(6)
        self.assertEqual(self.tourner(3).returncode, 0)
        restantes = sorted(f.name for f in self.dossier.glob('*.tar.age'))
        self.assertEqual(restantes, [f'avant-maj-7.{i}.0-vers-7.{i + 1}.0-202601{i + 1:02d}-000000.tar.age' for i in (3, 4, 5)])
        self.assertEqual(sorted(f.name for f in self.dossier.glob('*.sha256')), [n + '.sha256' for n in restantes])
        self.assertEqual(self.tourner(1).returncode, 0)
        self.assertEqual(len(list(self.dossier.glob('*.tar.age'))), 1)

    def test_ni_lien_ni_sous_dossier_ni_ancien_format_ni_autre_nom(self):
        self.archives(4)
        dehors = Path(self.tmp.name) / 'dehors.tar.age'
        dehors.write_bytes(b'x')
        lien = self.dossier / 'avant-maj-0.0.1-vers-0.0.2-20200101-000000.tar.age'
        lien.symlink_to(dehors)
        gardes = [self.dossier / 'avant-maj-1-vers-2.tar.enc', self.dossier / 'avant-maj-1-vers-2.tar',
                  self.dossier / 'autre-20200101.tar.age', self.dossier / 'sous/avant-maj-1-vers-2-x.tar.age']
        (self.dossier / 'sous').mkdir()
        for f in gardes:
            f.write_bytes(b'x')
            os.utime(f, (1, 1))
        self.assertEqual(self.tourner(1).returncode, 0)
        for f in gardes + [dehors]:
            self.assertTrue(f.exists(), f)
        self.assertTrue(lien.is_symlink())
        self.assertEqual(len([f for f in self.dossier.glob('avant-maj-*.tar.age') if not f.is_symlink()]), 1)

    def test_nombre_lu_dans_l_environnement_puis_env_borne_et_controle_avant_toute_modification(self):
        self.assertIn('GARDEES="${UPDATE_SAUVEGARDES_GARDEES:-$(valeur_env UPDATE_SAUVEGARDES_GARDEES 3)}"', SCRIPT)
        controle = SCRIPT.index('|| arret "UPDATE_SAUVEGARDES_GARDEES doit être compris entre 1 et 10."')
        self.assertLess(controle, SCRIPT.index('PHASE=sauvegarde\n'))
        self.assertLess(controle, SCRIPT.index('git fetch --tags --quiet'))
        self.assertNotIn('tail -n +6', SCRIPT)
        # La sauvegarde d'avant mise à jour n'est pas soumise au nombre maximal des sauvegardes régulières.
        self.assertIn('RETENTION_DAYS=36500 BACKUP_GARDER_MAX=365 BACKUP_PREFIXE="avant-maj-', SCRIPT)


class EspaceAvantMiseAJour(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.racine = Path(self.tmp.name)
        self.sauv = self.racine / 'sauvegardes'
        (self.sauv / 'avant-mise-a-jour').mkdir(parents=True)
        (self.sauv / 'avant-mise-a-jour/avant-maj-7.2.0-vers-7.2.3-20260101-000000.tar.age').write_bytes(b'x' * (3 * 1024 * 1024))
        (self.racine / 'bin').mkdir()
        (self.racine / 'data/etat').mkdir(parents=True)

    def controler(self, libres, web=False, verifier=0):
        df = self.racine / 'bin/df'
        df.write_text('#!/usr/bin/env bash\necho "Filesystem 1B-blocks Used Available Capacity Mounted"\n'
                      f'echo "/dev/fictif 100000000000 1 {libres} 1% /"\n')
        df.chmod(0o700)
        script = f'''set -euo pipefail
{OCTETS_LIBRES}
info() {{ printf '%s\\n' "$*"; }}
arret() {{ printf 'ERREUR : %s\\n' "$*" >&2; exit 1; }}
rapport() {{ printf '%s|%s\\n' "$1" "$2" > "{self.racine}/rapport"; }}
SAUV="{self.sauv}"; DATA_DIR="{self.racine}/data"; REPO="{self.racine}"; LOCALES=0; VERIFIER={verifier}; taille_base=0
{'export SUIVI_MAJ_WEB=1' if web else ''}
{ESPACE}
echo suite'''
        return subprocess.run(['bash', '-c', script], capture_output=True, text=True,
                              env={**os.environ, 'PATH': f'{self.racine}/bin:' + os.environ['PATH'], 'TMPDIR': str(self.racine)})

    def test_refus_avant_toute_modification_avec_libre_necessaire_et_occupation(self):
        r = self.controler(2 * 1024 ** 3)
        self.assertNotEqual(r.returncode, 0)
        self.assertNotIn('suite', r.stdout)
        # Dernière sauvegarde 3 Mo, images 2048 Mo (forfait en ligne de commande), marge 1024 Mo, plus la zone de travail
        # sur le même disque (deux fois 3 Mo plus 10 %).
        self.assertIn('espace disque insuffisant pour la mise à jour : 2048 Mo libres pour les sauvegardes, 3082 Mo nécessaires', r.stderr)
        self.assertIn('(dernière sauvegarde 3 Mo, images à télécharger 2048 Mo, marge 1024 Mo, zone de travail sur le même disque)', r.stderr)
        self.assertIn('Occupation : sauvegardes 3 Mo, images de l\'application non mesurées.', r.stderr)
        self.assertTrue((self.racine / 'rapport').read_text().startswith('abandon|espace disque insuffisant'))

    def test_mise_a_jour_web_images_deja_telechargees_et_simulation_sans_rapport(self):
        # Depuis l'interface, les images sont déjà téléchargées et vérifiées par l'exécutant : seule la sauvegarde compte.
        r = self.controler(2 * 1024 ** 3, web=True)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn('suite', r.stdout)
        r = self.controler(100 * 1024 ** 2, verifier=1)
        self.assertNotEqual(r.returncode, 0)
        self.assertFalse((self.racine / 'rapport').exists())

    def test_controle_place_avant_la_sauvegarde_et_les_verrous(self):
        self.assertLess(SCRIPT.index(ESPACE), SCRIPT.index('PHASE=notes\n'))
        self.assertLess(SCRIPT.index(ESPACE), SCRIPT.index('PHASE=sauvegarde\n'))


class MenageImagesMiseAJour(unittest.TestCase):
    """ADR 0106 : ménage par scripts/images-application.py après une réussite et après un retour arrière (sauf images locales
    de recette), sans « prune » global ni liste d'étiquettes qui manquerait les images sans étiquette."""

    def test_menage_par_le_script_dedie_jamais_de_prune(self):
        self.assertNotIn('docker image prune', SCRIPT)
        self.assertNotIn("docker image ls --format '{{.Repository}}:{{.Tag}}'", SCRIPT)
        self.assertIn('menage_images "$CIBLE" "$ACTUELLE" "$REPO/.env" "$REPO/.env.avant-mise-a-jour"\nrm -f "$REPO/.env.avant-mise-a-jour"', SCRIPT)
        retour = SCRIPT[SCRIPT.index('retour_arriere() {'):SCRIPT.index('ecarter_copie_donnees() {')]
        self.assertIn('[ "$LOCALES" = 1 ] || menage_images "$ACTUELLE" \'\' "$REPO/.env"', retour)
        # Après la santé de l'ancienne version, jamais avant.
        self.assertLess(retour.index('if attendre_sante "$DELAI"; then'), retour.index('menage_images'))

    def test_frontal_garde_celui_en_service(self):
        bloc = SCRIPT[SCRIPT.index('menage_images() {'):SCRIPT.index('echec() {')]
        script = f'''set -u
valeur_env() {{ case "$1" in GATEWAY_VERSION) printf %s "${{GW:-${{2:-}}}}" ;; APP_VERSION) printf %s "${{2:-}}" ;; esac; }}
avertir() {{ :; }}
python3() {{ printf '%s\\n' "$@"; }}
REPO="$1"
{bloc}
menage_images 7.3.0 7.2.3 "$REPO/.env"'''
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / 'scripts').mkdir()
            (Path(d) / 'scripts/images-application.py').write_text('')
            for gw, attendu in (('7.1.5', '7.1.5'), ('', '7.3.0')):
                with self.subTest(gw=gw):
                    r = subprocess.run(['bash', '-c', script, 'x', d], capture_output=True, text=True, env={**os.environ, 'GW': gw})
                    args = r.stdout.split('\n')
                    self.assertEqual(args[args.index('--frontal') + 1], attendu)
                    self.assertEqual(args[args.index('--precedente') + 1], '7.2.3')
                    self.assertEqual(args[args.index('--en-service') + 1], '7.3.0')


if __name__ == '__main__':
    unittest.main()
