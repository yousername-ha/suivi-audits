"""Flux vers l'extérieur (ADR 0097, lot 2) appliqués par l'exécutant de mise à jour : conteneurs dédiés démarrés et arrêtés par
leur profil Compose, silence des mises à jour quand le flux est fermé, rapport de l'état appliqué. Docker et la CLI « suivi »
sont simulés ; la CI rejoue la vraie pile."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('updates_flux', ROOT / 'scripts/update-worker.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

PROFILS = {'assistant', 'antivirus'}
SERVICES = {'assistant-relais', 'freshclam', 'clamav'}
CLI = ['docker', 'compose', 'exec', '-T', 'app', 'suivi']


class FauxServeur:
    """Docker Compose et la CLI de l'application, simulés. « souhaites » : réponse de flux-souhaites (None : application
    injoignable) ; « conteneurs » : service -> {State, Health} ; « echecs » : services dont le démarrage échoue."""

    def __init__(self, souhaites='{"ouverts":[]}'):
        self.souhaites = souhaites
        self.conteneurs = {}
        self.echecs = set()
        self.sante_au_demarrage = {'freshclam': 'starting'}
        self.appels = []
        self.rapports = []

    def __call__(self, args, timeout=120, extra_env=None, input_text=None):
        self.appels.append(list(args))
        if args[:6] == CLI:
            commande = args[6]
            if commande == 'flux-souhaites':
                if self.souhaites is None:
                    raise m.Failure('Commande interrompue')
                return self.souhaites
            if commande == 'flux-appliques':
                self.rapports.append(json.loads(input_text))
                return '{"modules":[]}'
            return ''
        if args[:2] != ['docker', 'compose']:
            raise AssertionError(f'commande inattendue : {args}')
        reste = list(args[2:])
        profils = []
        while reste[:1] == ['--profile']:
            profils.append(reste[1])
            reste = reste[2:]
        assert set(profils) <= PROFILS, profils
        if reste[:4] == ['ps', '-a', '--format', 'json']:
            lignes = [{'Service': s, 'State': c['State'], 'Health': c.get('Health', ''), 'Name': 'suivi-' + s} for s, c in self.conteneurs.items()]
            # Un conteneur hors des listes fermées n'est jamais retenu.
            lignes.append({'Service': 'app', 'State': 'running', 'Health': 'healthy'})
            return '\n'.join(json.dumps(x) for x in lignes) + '\n'
        if reste[:3] == ['up', '-d', '--no-deps']:
            service = reste[3]
            assert len(reste) == 4 and service in SERVICES, reste
            if service in self.echecs:
                raise m.Failure('Commande interrompue')
            self.conteneurs[service] = {'State': 'running', 'Health': self.sante_au_demarrage.get(service, '')}
            return ''
        if reste[:3] == ['rm', '--stop', '--force']:
            assert set(reste[3:]) <= SERVICES, reste
            for s in reste[3:]:
                self.conteneurs.pop(s, None)
            return ''
        raise AssertionError(f'commande Compose inattendue : {args}')

    def docker(self):
        return [a for a in self.appels if a[:6] != CLI]


class FluxExecutant(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / '.env').write_text('APP_VERSION=3.0.0\n')
        self.data = self.root / 'data'
        (self.data / 'etat').mkdir(parents=True)
        with patch.dict(os.environ, REPO=str(self.root), DATA_DIR=str(self.data)):
            self.w = m.Worker()
        self.serveur = FauxServeur()
        self.w.run = self.serveur

    def ouvrir(self, *modules):
        self.serveur.souhaites = json.dumps({'ouverts': list(modules)})

    def test_etat_voulu_lu_strictement_illisible_vaut_ferme(self):
        self.assertEqual(m.flux_souhaites('{"ouverts":["assistant","mises-a-jour"]}'), {'assistant', 'mises-a-jour'})
        # Un nom inconnu est ignoré : il ne servira jamais d'argument de commande.
        self.assertEqual(m.flux_souhaites('{"ouverts":["assistant","clamav; rm -rf /","--profile"]}'), {'assistant'})
        for brut in ('', 'pas du json', '[]', '{"ouverts":"assistant"}', '{"ouverts":[1]}', '{"ouverts":[],"autre":1}', 'null'):
            with self.subTest(brut=brut):
                self.assertIsNone(m.flux_souhaites(brut))

    def test_flux_ouvert_demarre_le_relais_puis_rapporte_ouvert(self):
        self.ouvrir('assistant')
        self.w.flux()
        self.assertIn(['docker', 'compose', '--profile', 'assistant', 'up', '-d', '--no-deps', 'assistant-relais'], self.serveur.appels)
        # Démarrage lancé : l'assistant n'est pas encore rapporté ouvert ; les autres modules le sont, fermés.
        self.assertEqual(self.serveur.rapports, [{'antivirus': {'etat': 'ferme'}, 'mises-a-jour': {'etat': 'ferme'}}])
        self.w.flux()
        self.assertEqual(self.serveur.rapports[-1], {'assistant': {'etat': 'ouvert'}, 'antivirus': {'etat': 'ferme'}, 'mises-a-jour': {'etat': 'ferme'}})

    def test_antivirus_demarre_dans_l_ordre_sans_bloquer_la_boucle(self):
        self.ouvrir('antivirus')
        self.w.flux()
        ups = [a for a in self.serveur.appels if 'up' in a]
        self.assertEqual(ups, [['docker', 'compose', '--profile', 'antivirus', 'up', '-d', '--no-deps', 'freshclam']])
        # freshclam télécharge les signatures : clamav attend qu'il soit sain.
        self.w.flux()
        self.assertEqual(len([a for a in self.serveur.appels if 'up' in a]), 1)
        self.assertNotIn('antivirus', self.serveur.rapports[-1])
        self.serveur.conteneurs['freshclam']['Health'] = 'healthy'
        self.w.flux()
        self.assertEqual([a for a in self.serveur.appels if 'up' in a][-1][-1], 'clamav')
        self.w.flux()
        self.assertEqual(self.serveur.rapports[-1]['antivirus'], {'etat': 'ouvert'})

    def test_flux_ferme_arrete_et_retire_les_conteneurs_de_son_profil(self):
        self.serveur.conteneurs = {'assistant-relais': {'State': 'running'}, 'freshclam': {'State': 'exited'}, 'clamav': {'State': 'running'}}
        self.w.flux()
        self.assertIn(['docker', 'compose', '--profile', 'assistant', 'rm', '--stop', '--force', 'assistant-relais'], self.serveur.appels)
        self.assertIn(['docker', 'compose', '--profile', 'antivirus', 'rm', '--stop', '--force', 'freshclam', 'clamav'], self.serveur.appels)
        self.assertEqual(self.serveur.conteneurs, {})
        self.assertEqual(self.serveur.rapports[-1], {'assistant': {'etat': 'ferme'}, 'antivirus': {'etat': 'ferme'}, 'mises-a-jour': {'etat': 'ferme'}})
        # Rien à arrêter : aucune commande d'arrêt.
        self.w.flux()
        self.assertEqual(len([a for a in self.serveur.appels if 'rm' in a]), 2)

    def test_application_injoignable_rien_n_est_emis_ni_arrete(self):
        """Règle du lot 2 : état voulu illisible, l'exécutant n'émet rien lui-même et laisse les conteneurs comme il les a mis."""
        self.ouvrir('assistant', 'mises-a-jour')
        self.w.flux()
        self.w.flux()
        self.assertEqual(self.serveur.conteneurs['assistant-relais']['State'], 'running')
        for souhaites in (None, 'réponse inattendue'):
            with self.subTest(souhaites=souhaites):
                self.serveur.souhaites = souhaites
                avant, rapports = len(self.serveur.docker()), len(self.serveur.rapports)
                self.w.flux()
                self.assertEqual(len(self.serveur.docker()), avant)
                self.assertEqual(len(self.serveur.rapports), rapports)
                self.assertEqual(self.serveur.conteneurs['assistant-relais']['State'], 'running')
                # Et rien ne part vers GitHub : la vérification est refusée sans appel réseau.
                with patch.object(m.urllib.request, 'urlopen') as urlopen:
                    with self.assertRaises(m.Failure):
                        self.w.check()
                urlopen.assert_not_called()

    def test_rapport_seulement_au_changement_ou_periodiquement(self):
        self.w.flux()
        self.w.flux()
        self.w.flux()
        self.assertEqual(len(self.serveur.rapports), 1)
        self.ouvrir('mises-a-jour')
        self.w.flux()
        self.assertEqual(len(self.serveur.rapports), 2)
        self.assertEqual(self.serveur.rapports[-1]['mises-a-jour'], {'etat': 'ouvert'})
        self.w.flux_rapporte_le -= m.FLUX_RAPPORT_PERIODE + 1
        self.w.flux()
        self.assertEqual(len(self.serveur.rapports), 3)
        # Un rapport refusé ou perdu est renvoyé au passage suivant.
        self.ouvrir()
        original = self.serveur.__call__
        def refus(args, **kwargs):
            if args[6:7] == ['flux-appliques']:
                raise m.Failure('Commande interrompue')
            return original(args, **kwargs)
        self.w.run = refus
        self.w.flux()
        self.w.run = self.serveur
        self.w.flux()
        self.assertEqual(self.serveur.rapports[-1]['mises-a-jour'], {'etat': 'ferme'})

    def test_echec_de_demarrage_rapporte_une_erreur_courte_sans_sortie_de_commande(self):
        self.ouvrir('assistant')
        self.serveur.echecs = {'assistant-relais'}
        self.w.flux()
        erreur = self.serveur.rapports[-1]['assistant']
        self.assertEqual(erreur['etat'], 'erreur')
        self.assertEqual(erreur['erreur'], 'Démarrage du conteneur « assistant-relais » (profil Compose « assistant ») en échec.')
        self.assertLessEqual(len(erreur['erreur']), m.FLUX_ERREUR_MAX)
        self.assertEqual(m.flux_entree('erreur', 'ligne 1\nligne 2\x07' + 'x' * 400)['erreur'][:16], 'ligne 1 ligne 2 ')
        self.assertEqual(len(m.flux_entree('erreur', 'x' * 400)['erreur']), m.FLUX_ERREUR_MAX)
        self.assertEqual(m.flux_entree('ouvert', 'ignorée'), {'etat': 'ouvert'})
        # Nouvel essai seulement après FLUX_REESSAI : un échec ne bloque pas la boucle à chaque passage.
        self.w.flux()
        self.assertEqual(len([a for a in self.serveur.appels if 'up' in a]), 1)
        self.serveur.echecs = set()
        self.w.flux_reessai['assistant'] -= m.FLUX_REESSAI + 1
        self.w.flux()
        self.assertEqual(len([a for a in self.serveur.appels if 'up' in a]), 2)

    def test_convergence_au_demarrage_puis_periodique(self):
        """Nouvel exécutant (après une mise à jour) : « up -d » une fois sur les conteneurs ouverts qui tournent déjà, pour
        reprendre la nouvelle image ; ensuite seulement à la période."""
        self.ouvrir('assistant')
        self.serveur.conteneurs = {'assistant-relais': {'State': 'running'}}
        self.w.flux()
        self.w.flux()
        ups = [a for a in self.serveur.appels if 'up' in a]
        self.assertEqual(len(ups), 1)
        self.w.flux_convergence -= m.FLUX_CONVERGENCE_PERIODE + 1
        self.w.flux()
        self.assertEqual(len([a for a in self.serveur.appels if 'up' in a]), 2)

    def test_arguments_fermes_seuls_les_profils_et_services_du_registre(self):
        self.serveur.souhaites = json.dumps({'ouverts': ['assistant', 'antivirus', 'assistant-relais', '--privileged', 'app']})
        self.serveur.sante_au_demarrage = {}
        for _ in range(4):
            self.w.flux()
        for args in self.serveur.docker():
            for valeur in args:
                self.assertTrue(valeur in PROFILS | SERVICES or valeur.startswith('-') or valeur in ('docker', 'compose', 'ps', 'json', 'up', 'rm'), args)
        self.assertEqual(set(self.serveur.conteneurs), SERVICES)

    def test_flux_mises_a_jour_ferme_aucune_verification_ni_installation(self):
        with patch.object(m.urllib.request, 'urlopen') as urlopen:
            with self.assertRaises(m.Failure):
                self.w.check()
            with self.assertRaises(m.Failure):
                self.w.install({'id': '00000000-0000-4000-8000-000000000000', 'kind': 'install', 'target': '3.1.0'})
        urlopen.assert_not_called()
        # Ni git fetch, ni docker pull, ni cosign : seule la CLI locale a été appelée.
        self.assertEqual(self.serveur.docker(), [])
        self.assertFalse(self.w.state['checking'])

    def test_flux_mises_a_jour_ouvert_la_verification_part(self):
        self.ouvrir('mises-a-jour')
        reponse = unittest.mock.MagicMock()
        reponse.__enter__.return_value.read.return_value = json.dumps({'tag_name': 'v3.1.0', 'draft': False, 'prerelease': False}).encode()
        with patch.object(m.urllib.request, 'urlopen', return_value=reponse) as urlopen:
            self.w.check()
        urlopen.assert_called_once()
        self.assertEqual(self.w.state['available'], '3.1.0')


if __name__ == '__main__':
    unittest.main()
