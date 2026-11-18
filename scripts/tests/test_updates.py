"""Contrat de l'exécutant et reprise durable. Les commandes Docker sont simulées ici ; la CI teste la vraie pile."""
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import socket
import ssl
import subprocess
import tempfile
import threading
import urllib.error
import unittest
import uuid
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('updates', ROOT / 'scripts/update-worker.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def attestation(digest_hex, predicate=None, predicate_type='https://cyclonedx.org/bom'):
    statement={'_type':'https://in-toto.io/Statement/v1','predicateType':predicate_type,
               'subject':[{'name':'ghcr.io/x','digest':{'sha256':digest_hex}}],
               'predicate':predicate if predicate is not None else {'bomFormat':'CycloneDX','specVersion':'1.6','components':[{'name':'openssl','version':'3.5.4'}]}}
    return json.dumps({'payloadType':'application/vnd.in-toto+json','payload':base64.b64encode(json.dumps(statement).encode()).decode(),'signatures':[{'sig':'x'}]})+'\n'


def fake_run(revision='b'*40, attest=None, fetch_fail_origin=False, fetched=None, manifest=None):
    """Simule git, docker et cosign pour signatures() ; « attest » remplace la sortie de verify-attestation."""
    def run(args, **kwargs):
        if args[:2]==['git','fetch']:
            if fetched is not None: fetched.append(args[3])
            if fetch_fail_origin and args[3]=='origin': raise m.Failure('ssh')
            return ''
        if args[0]=='git' and args[1]=='rev-parse': return revision
        if args[0]=='git' and args[1]=='show': return manifest if manifest is not None else json.dumps({'version':'3.1.0','channel':'stable'})
        if args[0]=='docker' and args[1]=='inspect' and 'Labels' in args[3]: return 'b'*40
        if args[0]=='docker' and args[1]=='inspect': return json.dumps([args[-1].split(':')[0]+'@sha256:'+'a'*64])
        if args[:2]==['cosign','verify-attestation']: return attest if attest is not None else attestation('a'*64)
        return ''
    return run


class Isolement:
    def isoler_moteur(self):
        """Socket du moteur Docker inexistant et configuration de la CLI vide : rien ne joint le moteur ni le registre réels."""
        for p in (patch.object(m, 'DOCKER_SOCKET', str(self.root/'moteur-absent.sock')),
                  patch.dict(os.environ, DOCKER_CONFIG=str(self.root/'config-docker'))):
            p.start()
            self.addCleanup(p.stop)


class Updates(Isolement, unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root/'.env').write_text('APP_VERSION=3.0.0\n')
        self.data = self.root/'data'
        (self.data/'etat').mkdir(parents=True)
        with patch.dict(os.environ, REPO=str(self.root), DATA_DIR=str(self.data)):
            self.w = m.Worker()
        self.id = str(uuid.uuid4())
        # Moteur Docker absent et aucun identifiant de registre (ADR 0104) : le téléchargement passe par « docker pull », simulé
        # par fake_run ; aucun test de cette classe ne joint le moteur Docker de la machine.
        self.isoler_moteur()
        # Flux « mises-a-jour » ouvert par l'administrateur (ADR 0097) ; les tests du flux fermé le referment.
        self.ouverts = {'mises-a-jour'}
        self.w.flux_ouvert = lambda module: module in self.ouverts

    def test_publication_stable_uniquement(self):
        self.assertEqual(m.release({'tag_name':'v3.1.0','draft':False,'prerelease':False})[0], '3.1.0')
        for data in [{'tag_name':'v3.1.0','draft':True},{'tag_name':'v3.1.0','prerelease':True},
                     {'tag_name':'v3.1.0-beta'},{'tag_name':'v3.1.0;id'},{'tag_name':'main'},
                     {'tag_name':'v03.1.0'},{'tag_name':{'evil':'x'}}]:
            with self.assertRaises(ValueError): m.release(data)

    def test_aucune_ecriture_de_secret_dans_etat_public(self):
        self.w.job = {'id':self.id,'previousEnv':'SECRET=confidentiel','target':'3.1.0'}
        self.w.publish(maintenance=True,status='running',phase='backup',id=self.id)
        self.assertTrue((self.w.public/'maintenance').is_file())
        public = (self.w.public/'status.json').read_text()
        self.assertNotIn('confidentiel', public)
        self.assertEqual((self.w.public/'status.json').stat().st_mode & 0o777, 0o644)
        self.assertEqual(self.w.private.stat().st_mode & 0o777, 0o700)

    def depot_prive(self, extra=''):
        """Déploiement déclaré privé : clé de déploiement montée (UPDATER_SSH_DIR), le repli sur les étiquettes est permis."""
        (self.root/'.env').write_text('APP_VERSION=3.0.0\nUPDATER_SSH_DIR=/root/.ssh\n'+extra)

    @staticmethod
    def git_depot(tags, canaux):
        """Simule git : liste des étiquettes distantes, manifeste de publication par étiquette (canaux = {version: canal})."""
        def run(args, **kwargs):
            if args[0]=='git' and args[1]=='ls-remote': return tags
            if args[0]=='git' and args[1]=='show':
                v=args[2].split('refs/tags/v',1)[1].split(':',1)[0]
                return json.dumps({'version':v,'channel':canaux.get(v,'stable')})
            return '{}'
        return run

    def test_preversion_numerotee_detectee_par_ancien_chemin_depot_prive(self):
        # GitHub /latest n'expose pas les préversions. Le dépôt privé est déjà lu par la clé Git ; seul le canal stable est annoncé.
        self.depot_prive()
        tags = 'a\trefs/tags/v3.0.0\nb\trefs/tags/v3.0.1\nc\trefs/tags/v3.0.2-beta\n'
        with patch.object(m.urllib.request, 'urlopen', side_effect=urllib.error.HTTPError('url',404,'private',{},None)), \
                patch.object(self.w,'run',side_effect=self.git_depot(tags,{})) as commands:
            self.w.check()
        self.assertEqual(self.w.state['available'],'3.0.1')
        self.assertEqual(self.w.state['notes'],f'https://github.com/{m.REPOSITORY}/releases/tag/v3.0.1')
        self.assertFalse(self.w.state['checkError'])
        for component in ('api','web','updater'):
            self.assertIn(unittest.mock.call(['docker','manifest','inspect',f'ghcr.io/{m.REPOSITORY}-{component}:3.0.1'],timeout=45),commands.call_args_list)

    def test_la_prerelease_de_developpement_n_est_annoncee_que_sur_le_canal_choisi(self):
        tags = 'a\trefs/tags/v3.0.1\nb\trefs/tags/v3.0.5\n'
        canaux = {'3.0.5':'development'}
        self.depot_prive()
        with patch.object(m.urllib.request, 'urlopen', side_effect=urllib.error.HTTPError('url',404,'private',{},None)), \
                patch.object(self.w,'run',side_effect=self.git_depot(tags,canaux)):
            self.w.check()
        self.assertEqual(self.w.state['available'],'3.0.1')
        self.depot_prive('UPDATE_CHANNEL=development\n')
        with patch.object(m.urllib.request, 'urlopen', side_effect=urllib.error.HTTPError('url',404,'private',{},None)), \
                patch.object(self.w,'run',side_effect=self.git_depot(tags,canaux)):
            self.w.check()
        self.assertEqual(self.w.state['available'],'3.0.5')

    def test_depot_public_limite_de_debit_ou_refus_n_active_pas_le_repli_sur_les_etiquettes(self):
        """Sans déclaration de dépôt privé, une réponse 403/429/404 de l'API est une erreur de vérification : aucun repli sur
        git ls-remote, donc aucune préversion de développement annoncée."""
        tags = 'a\trefs/tags/v3.0.1\nb\trefs/tags/v3.0.5\n'
        for code in (403,429,404,401):
            with self.subTest(code=code), \
                    patch.object(m.urllib.request, 'urlopen', side_effect=urllib.error.HTTPError('url',code,'x',{},None)), \
                    patch.object(self.w,'run',side_effect=self.git_depot(tags,{'3.0.5':'development'})) as commands:
                with self.assertRaises(m.Failure): self.w.check()
            self.assertFalse([c for c in commands.call_args_list if c.args[0][:2]==['git','ls-remote']])
            self.assertTrue(self.w.state['checkError'])

    def test_publication_partielle_nest_pas_annoncee(self):
        self.depot_prive()
        def run(args, **kwargs):
            if args[0]=='git' and args[1]=='ls-remote': return 'a\trefs/tags/v3.0.1\n'
            if args[0]=='git' and args[1]=='show': return json.dumps({'version':'3.0.1','channel':'stable'})
            if args[0]=='git': return ''
            if args[-1].endswith('-updater:3.0.1'): raise m.Failure('absente')
            return '{}'
        with patch.object(m.urllib.request, 'urlopen', side_effect=urllib.error.HTTPError('url',404,'private',{},None)), \
                patch.object(self.w,'run',side_effect=run):
            with self.assertRaises(m.Failure): self.w.check()
        self.assertIsNone(self.w.state['available'])
        self.assertTrue(self.w.state['checkError'])

    def test_l_installation_refuse_une_revision_dont_le_canal_n_est_pas_autorise(self):
        """Le canal est lié à la révision signée : le manifeste de publication de cette révision doit porter la version cible et
        « stable » (ou « development » si le serveur l'a choisi)."""
        for manifest in (json.dumps({'version':'3.1.0','channel':'development'}),
                         json.dumps({'version':'3.2.0','channel':'stable'}),
                         json.dumps({'version':'3.1.0','channel':'stable','extra':1}),
                         'pas du json', json.dumps(['x'])):
            with self.subTest(manifest=manifest), patch.object(self.w,'run',side_effect=fake_run(manifest=manifest)):
                with self.assertRaises(m.Failure): self.w.signatures('3.1.0')
        # Canal de développement choisi explicitement : accepté.
        (self.root/'.env').write_text('APP_VERSION=3.0.0\nUPDATE_CHANNEL=development\n')
        self.w.job = {'id':self.id,'target':'3.1.0'}
        with patch.object(self.w,'run',side_effect=fake_run(manifest=json.dumps({'version':'3.1.0','channel':'development'}))):
            self.w.signatures('3.1.0')

    def test_exploitation_automatique_utilise_les_cles_age_du_dossier_des_donnees_et_stockage_prive(self):
        with patch.object(self.w,'run') as run:
            self.w.exploitation()
        args, options = run.call_args
        self.assertEqual(args[0],['python3',str(self.root/'scripts/exploitation-worker.py')])
        self.assertEqual(options['timeout'],4000)
        env = options['extra_env']
        self.assertEqual(env['BACKUP_KEY_FILE'],str(self.data/'cles-sauvegarde/serveur.key'))
        self.assertEqual(env['BACKUP_RECIPIENTS_FILE'],str(self.data/'cles-sauvegarde/secours.pub'))
        self.assertEqual(env['BACKUP_DEST'],str(self.data/'sauvegardes'))
        self.assertEqual(env['EXPLOITATION_TLS_HOST'],'gateway')
        for path in (Path(env['TMPDIR']),Path(env['BACKUP_DEST'])):
            self.assertEqual(path.stat().st_mode & 0o777,0o700)

    def test_configuration_sauvegarde_existante_prioritaire_sans_changement_de_cle(self):
        (self.root/'.env').write_text('APP_VERSION=3.0.0\nBACKUP_DEST=/catalogue-existant\nBACKUP_KEY_FILE=/cle-existante\nBACKUP_RECIPIENTS_FILE=/secours-existant\n')
        with patch.object(self.w,'run') as run:
            self.w.exploitation()
        self.assertEqual(run.call_args.kwargs['extra_env']['BACKUP_DEST'],'/catalogue-existant')
        self.assertEqual(run.call_args.kwargs['extra_env']['BACKUP_KEY_FILE'],'/cle-existante')
        self.assertEqual(run.call_args.kwargs['extra_env']['BACKUP_RECIPIENTS_FILE'],'/secours-existant')

    def test_maintenance_et_mode_hote_nexecutent_pas_de_sauvegarde_automatique(self):
        with patch.object(self.w,'run') as run:
            self.w.state['maintenance'] = True
            self.w.exploitation()
            self.w.state['maintenance'] = False
            (self.root/'.env').write_text('APP_VERSION=3.0.0\nEXPLOITATION_AUTO=0\n')
            self.w.exploitation()
        run.assert_not_called()

    def test_interruption_avant_remplacement_ne_rejoue_pas_installation(self):
        self.w.job={'id':self.id,'target':'3.1.0','handoff':False}
        with patch.object(self.w,'cli',return_value='') as cli:
            self.w.recover()
        self.assertEqual(self.w.state['status'],'failed')
        self.assertFalse(self.w.state['maintenance'])
        self.assertTrue((self.w.private/'receipts'/f'{self.id}.json').is_file())
        self.assertFalse(any('claim' in str(c) for c in cli.call_args_list))

    def test_remplacement_executant_exige_sante_reelle(self):
        self.w.job={'id':self.id,'target':'3.1.0','handoff':True}
        with patch.object(self.w,'health',side_effect=m.Failure('absent')),patch.object(self.w,'cli',return_value=''):
            self.w.recover()
        self.assertEqual(self.w.state['status'],'intervention')
        self.assertTrue(self.w.state['maintenance'])
        self.assertFalse(self.w.state['ready'])

    def test_reprise_apres_remplacement_termine_operation(self):
        (self.root/'.env').write_text('APP_VERSION=3.1.0\n')
        self.w.job={'id':self.id,'target':'3.1.0','handoff':True}
        database={'status':'running'}
        def cli(command,*args):
            if command=='update-finish' and database['status']=='running': database['status']=args[1]
            if command=='update-sync' and database['status']=='running': database['status']='failed'
            return ''
        with patch.object(self.w,'health') as health,patch.object(self.w,'cli',side_effect=cli):
            self.w.recover()
        health.assert_called_once_with('3.1.0')
        self.assertEqual(self.w.state['status'],'success')
        self.assertFalse(self.w.state['maintenance'])
        self.assertEqual(self.w.state['installed'],'3.1.0')
        self.assertEqual(database['status'],'success')

    def test_signature_pour_chaque_digest_et_identite_exacte(self):
        self.w.job={'id':self.id,'target':'3.1.0'}
        calls=[]
        run=fake_run()
        def spy(args, **kwargs):
            calls.append(args); return run(args, **kwargs)
        with patch.object(self.w,'run',side_effect=spy): self.w.signatures('3.1.0')
        identity='https://github.com/yousername-ha/suivi-audits/.github/workflows/release.yml@refs/tags/v3.1.0'
        signed=[args for args in calls if args[:2]==['cosign','verify']]
        attested=[args for args in calls if args[:2]==['cosign','verify-attestation']]
        self.assertEqual((len(signed),len(attested)),(3,3))
        for args in signed+attested:
            self.assertIn('@sha256:',args[2])
            self.assertIn(identity,args)
            self.assertNotIn('--insecure-ignore-tlog',args)
        for args in attested: self.assertEqual(args[args.index('--type')+1],'cyclonedx')
        self.assertEqual(set(self.w.job['images']),{'api','web','updater'})

    def test_signature_invalide_avant_maintenance(self):
        self.w.job={'id':self.id,'target':'3.1.0'}
        with patch.object(self.w,'run',side_effect=m.Failure('signature')):
            with self.assertRaises(m.Failure): self.w.signatures('3.1.0')
        self.assertFalse(self.w.state['maintenance'])

    def test_echec_preparation_publie_la_demande_terminee_pour_permettre_un_reessai(self):
        self.w.publish(id=str(uuid.uuid4()), status='success')
        self.w.job={'id':self.id,'target':'3.1.0'}
        with patch.object(self.w,'cli',return_value=''):
            self.w.finish('failed','GitHub indisponible avant préparation.')
        self.assertEqual(self.w.state['id'],self.id)
        self.assertEqual(self.w.state['target'],'3.1.0')
        self.assertEqual(self.w.state['status'],'failed')
        self.assertTrue(self.w.state['ready'])
        self.assertFalse(self.w.state['maintenance'])

    def test_verrou_commun_exclut_operations_et_est_libere(self):
        with open(self.data/'etat/backup-worker.lock','a+') as lock:
            m.fcntl.flock(lock,m.fcntl.LOCK_EX|m.fcntl.LOCK_NB)
            with self.assertRaises(BlockingIOError): self.w.locked_operation(lambda: self.fail('operation executee'))
        values=[]
        self.w.locked_operation(lambda: values.append(self.w.locked))
        self.assertEqual(values,[True])
        self.assertFalse(self.w.locked)

    def test_controle_documents_ne_confond_pas_sante_et_integrite(self):
        self.w.job={'before':{'documents':{'empreinte':'avant'},'tables':{'users':3}}}
        ready=json.dumps({'pret':True,'version':'3.1.0','migrationsEnAttente':[]})
        with patch.object(self.w,'run',return_value=ready),patch.object(self.w,'cli',return_value=json.dumps({'ok':True,'documents':{'empreinte':'apres'},'tables':{'users':3}})):
            with self.assertRaises(m.Failure):self.w.health('3.1.0')
        with patch.object(self.w,'run',return_value=ready),patch.object(self.w,'cli',return_value=json.dumps({'ok':True,'documents':{'empreinte':'avant'},'tables':{'users':2}})):
            with self.assertRaises(m.Failure):self.w.health('3.1.0')

    def test_sans_cle_de_deploiement_etiquette_lue_en_https_public(self):
        # ADR 0061 : /root/.ssh n'est plus monté ; l'origine SSH échoue, la lecture publique prend le relais.
        self.w.job={'id':self.id,'target':'3.1.0'}
        fetched=[]
        with patch.object(self.w,'run',side_effect=fake_run(fetch_fail_origin=True,fetched=fetched)): self.w.signatures('3.1.0')
        self.assertEqual(fetched,['origin','https://github.com/yousername-ha/suivi-audits.git'])
        self.assertEqual(self.w.job['revision'],'b'*40)

    def test_sources_publiques_differentes_des_images_signees_refusees(self):
        self.w.job={'id':self.id,'target':'3.1.0'}
        with patch.object(self.w,'run',side_effect=fake_run(revision='c'*40,fetch_fail_origin=True)):
            with self.assertRaises(m.Failure): self.w.signatures('3.1.0')
        self.assertNotIn('revision',self.w.job)

    def test_sbom_verifie_conserve_et_empreinte_retenue(self):
        self.w.job={'id':self.id,'target':'3.1.0'}
        with patch.object(self.w,'run',side_effect=fake_run()): self.w.signatures('3.1.0')
        for c in ('api','web','updater'):
            ref=self.w.job['sbom'][c]
            f=self.data/'etat/sbom/3.1.0'/ref['fichier']
            self.assertEqual(ref['fichier'],f'{c}.cdx.json')
            self.assertEqual(hashlib.sha256(f.read_bytes()).hexdigest(),ref['sha256'])
            self.assertEqual(f.stat().st_mode & 0o777,0o644)
            self.assertEqual(json.loads(f.read_text())['bomFormat'],'CycloneDX')

    def test_attestation_absente_ou_invalide_refusee_avant_maintenance(self):
        cas={
            'absente':'',
            'pas du json':'xx\n',
            'autre type':attestation('a'*64,predicate_type='https://slsa.dev/provenance/v1'),
            'autre image':attestation('f'*64),
            'pas un SBOM':attestation('a'*64,predicate={'bomFormat':'SPDX'}),
        }
        for nom,sortie in cas.items():
            with self.subTest(nom):
                self.w.job={'id':self.id,'target':'3.1.0'}
                with patch.object(self.w,'run',side_effect=fake_run(attest=sortie)):
                    with self.assertRaises(m.Failure): self.w.signatures('3.1.0')
                self.assertNotIn('revision',self.w.job)
                self.assertFalse(self.w.state['maintenance'])
        # Échec de cosign lui-même (signature d'attestation invalide) : refus aussi.
        def fails(args, **kwargs):
            if args[:2]==['cosign','verify-attestation']: raise m.Failure('attestation')
            return fake_run()(args, **kwargs)
        self.w.job={'id':self.id,'target':'3.1.0'}
        with patch.object(self.w,'run',side_effect=fails):
            with self.assertRaises(m.Failure): self.w.signatures('3.1.0')

    def test_frise_horodatee_des_etapes_de_l_installation(self):
        self.w.job={'id':self.id,'kind':'install','target':'3.1.0'}
        self.w.publish(id=self.id,status='running',phase='preparing',etapes=[],startedAt=m.now())
        self.w.publish(phase='preparing',message='toujours')
        self.w.publish(phase='backup')
        self.w.publish(phase='installing')
        public=json.loads((self.w.public/'status.json').read_text())
        self.assertEqual([e['phase'] for e in public['etapes']],['preparing','backup','installing'])
        self.assertTrue(all(e['at'].endswith('Z') for e in public['etapes']))
        # Nouvelle installation : la frise repart de zéro.
        self.w.publish(phase='preparing',etapes=[])
        self.assertEqual([e['phase'] for e in self.w.state['etapes']],['preparing'])
        # Une simple vérification des publications n'alimente pas la frise.
        self.w.job={'id':str(uuid.uuid4()),'kind':'check','target':None}
        self.w.publish(phase='checking')
        self.assertEqual([e['phase'] for e in self.w.state['etapes']],['preparing'])

    def test_retour_a_l_application_seulement_a_la_reussite(self):
        """Fin du script (phase « termine ») : les vérifications finales restent à faire (santé, relève de l'exécutant, frontal) ;
        l'étape « Retour à l'application » n'est franchie que par finish('success'), jamais avant la vérification."""
        self.assertEqual(m.PHASES['termine'],'verifying')
        self.assertNotIn('complete',m.PHASES.values())
        self.w.job={'id':self.id,'kind':'install','target':'3.1.0'}
        self.w.publish(id=self.id,status='running',phase='preparing',etapes=[],startedAt=m.now())
        for phase in ('backup','installing','verifying',m.PHASES['termine']):
            self.w.publish(phase=phase)
        self.w.publish(phase='verifying',message='Vérification finale du système de mise à jour.')
        self.assertEqual([e['phase'] for e in self.w.state['etapes']],['preparing','backup','installing','verifying'])
        with patch.object(self.w,'cli',return_value=''), patch.object(self.w,'receipt'):
            self.w.finish('success','Mise à jour installée et vérifiée.')
        self.assertEqual([e['phase'] for e in self.w.state['etapes']][-2:],['verifying','complete'])

    def test_recu_structure_sans_donnee_sensible(self):
        backup=self.data/'sauvegardes-updates/avant-maj-3.0.0-vers-3.1.0.tar.age'
        backup.parent.mkdir(parents=True)
        backup.write_bytes(b'chiffre')
        (backup.parent/(backup.name+'.sha256')).write_text('d'*64+'  '+backup.name+'\n')
        m.atomic(self.w.private/'progress.json',{'jobId':self.id,'phase':'termine','backup':str(backup)})
        self.w.job={'id':self.id,'kind':'install','target':'3.1.0','installed':'3.0.0','previousEnv':'SECRET=confidentiel',
                    'images':{c:f'ghcr.io/yousername-ha/suivi-audits-{c}@sha256:'+'a'*64 for c in ('api','web','updater')},
                    'revision':'b'*40,'sbom':{'api':{'fichier':'api.cdx.json','sha256':'e'*64},'autre':{}},'before':{'ok':True,'documents':{'empreinte':'x'},'tables':{'users':3}},
                    'after':{'ok':True,'documentsIdentiques':True}}
        self.w.publish(id=self.id,status='running',phase='preparing',etapes=[],startedAt='2026-10-26T10:00:00Z')
        with patch.object(self.w,'cli',return_value=''):
            self.w.finish('success','Mise à jour installée et vérifiée.')
        file=self.data/'etat/recus-mises-a-jour'/f'{self.id}.json'
        self.assertEqual(file.stat().st_mode & 0o777,0o644)
        text=file.read_text()
        self.assertNotIn('confidentiel',text)
        self.assertNotIn(str(self.data),text)
        r=json.loads(text)
        self.assertEqual((r['format'],r['depuis'],r['vers'],r['statut']),(1,'3.0.0','3.1.0','success'))
        self.assertEqual(r['sauvegarde'],{'fichier':backup.name,'sha256':'d'*64})
        self.assertTrue(r['signature']['verifiee'])
        self.assertEqual(r['signature']['identite'],'https://github.com/yousername-ha/suivi-audits/.github/workflows/release.yml@refs/tags/v3.1.0')
        self.assertEqual(r['controles'],{'avant':True,'apres':True,'documentsIdentiques':True})
        self.assertEqual(r['sbom'],{'api':{'fichier':'api.cdx.json','sha256':'e'*64}})
        self.assertEqual([e['phase'] for e in r['etapes']],['preparing','complete'])
        self.assertIsInstance(r['dureeSecondes'],int)
        self.assertEqual(self.w.state['finishedAt'],r['fin'])

    def test_verification_en_echec_n_est_plus_affichee_en_cours(self):
        """R6-03 : une vérification en échec est terminée ; la phase « checking » ne reste pas publiée, pour que la page
        annonce l'échec dès qu'il est connu. Une installation en échec garde sa phase (elle dit où elle s'est arrêtée)."""
        self.w.job={'id':self.id,'kind':'check','target':None}
        self.w.publish(id=self.id,status='running',phase='checking')
        with patch.object(self.w,'cli',return_value=''):
            self.w.finish('failed','Le serveur n’a pas pu joindre GitHub.')
        public=json.loads((self.w.public/'status.json').read_text())
        self.assertEqual((public['id'],public['status'],public['phase']),(self.id,'failed','idle'))
        self.assertEqual(public['message'],'Le serveur n’a pas pu joindre GitHub.')
        autre=str(uuid.uuid4())
        self.w.job={'id':autre,'kind':'install','target':'3.1.0'}
        self.w.publish(id=autre,status='running',phase='backup',startedAt=m.now())
        with patch.object(self.w,'cli',return_value=''):
            self.w.finish('failed','Échec fictif.')
        self.assertEqual(self.w.state['phase'],'backup')

    def test_pas_de_recu_pour_une_verification(self):
        self.w.job={'id':self.id,'kind':'check','target':None}
        with patch.object(self.w,'cli',return_value=''):
            self.w.finish('success','Vérification terminée.')
        self.assertFalse((self.data/'etat/recus-mises-a-jour').exists())


class FrontalALaDemande(unittest.TestCase):
    """Frontal mis à jour à la demande (ADR 0103, qui remplace l'exception ponctuelle de la 7.2.2) : à la fin d'une mise à jour
    web réussie, le frontal n'est recréé que si son empreinte diffère de celle de l'image web vérifiée de la cible, avec la
    coupure annoncée sur la page de maintenance."""
    WEB = 'ghcr.io/yousername-ha/suivi-audits-web@sha256:' + 'a' * 64
    CIBLE = 'e' * 64

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.cible = '7.3.0'
        (self.root/'.env').write_text(f'APP_VERSION={self.cible}\nSITE_ADDRESS=suivi.example.test\nGATEWAY_VERSION=7.1.0\n')
        self.data = self.root/'data'
        (self.data/'etat').mkdir(parents=True)
        with patch.dict(os.environ, REPO=str(self.root), DATA_DIR=str(self.data)):
            self.w = m.Worker()
        self.id = str(uuid.uuid4())
        self.journal = []
        self.validation_refusee = False
        self.certificats = ['c' * 64]
        self.ordre = []
        # Empreinte lue dans l'image de la cible, et dans le frontal en service (None : fichier absent, image antérieure).
        self.empreinte_cible = self.CIBLE
        self.empreinte_en_service = None

    def gateway_version(self):
        return self.w.env().get('GATEWAY_VERSION')

    def faux_run(self, args, timeout=120, extra_env=None, input_text=None):
        self.journal.append((args, extra_env, self.gateway_version(), self.w.state.get('coupure')))
        if args[:2] == ['docker', 'run']:
            self.ordre.append('empreinte-cible')
            if isinstance(self.empreinte_cible, Exception): raise self.empreinte_cible
            return self.empreinte_cible + '\n'
        if args[:5] == ['docker', 'compose', 'exec', '-T', 'gateway'] and args[5:] == ['cat', m.FRONTAL_EMPREINTE]:
            self.ordre.append('empreinte-service')
            if self.empreinte_en_service is None: raise m.Failure('Commande interrompue')
            return self.empreinte_en_service + '\n'
        if args[:3] == ['docker', 'image', 'inspect']:
            self.ordre.append('image')
            return json.dumps([self.WEB])
        if args[:3] == ['docker', 'compose', 'run']:
            self.ordre.append('validation')
            if self.validation_refusee: raise m.Failure('Commande interrompue')
            return ''
        if args[:3] == ['docker', 'compose', 'up']:
            self.ordre.append('recreation')
            return ''
        return ''

    def fausse_sonde(self):
        self.ordre.append('sonde')
        return self.certificats[0] if len(self.certificats) == 1 else self.certificats.pop(0)

    def reprendre(self, target=None, **job):
        self.w.job = {'id': self.id, 'kind': 'install', 'target': target or self.cible, 'installed': '7.2.2', 'handoff': True,
                      'images': {'api': 'x', 'web': self.WEB, 'updater': 'y'}, **job}
        self.w.publish(id=self.id, status='running', phase='verifying', startedAt=m.now(), maintenance=True)
        self.messages = []
        publier = self.w.publish
        def publication(**changes):
            # Changements de l'indicateur de coupure, dans l'ordre des commandes ; messages d'étape publiés.
            if 'coupure' in changes and changes['coupure'] != self.w.state.get('coupure'):
                self.ordre.append('coupure' if changes['coupure'] else 'fin de coupure')
            if 'message' in changes: self.messages.append(changes['message'])
            publier(**changes)
        with patch.object(self.w, 'health', side_effect=lambda v: self.ordre.append('sante')) as health, \
                patch.object(self.w, 'cli', return_value=''), patch.object(self.w, 'run', side_effect=self.faux_run), \
                patch.object(self.w, 'publish', side_effect=publication), \
                patch.object(self.w, 'frontal_sonde', side_effect=lambda: self.fausse_sonde()), \
                patch.object(m.time, 'sleep'), patch.object(m, 'FRONTAL_DELAI', 0):
            self.w.recover()
        return health

    def recu(self):
        return json.loads((self.data/'etat/recus-mises-a-jour'/f'{self.id}.json').read_text())

    def etat_public(self):
        return json.loads((self.w.public/'status.json').read_text())

    def test_sonde_releve_le_certificat_servi_en_https_local(self):
        """Sonde réelle sur un serveur TLS local : empreinte du certificat présenté et réponse « 200 » de /healthz."""
        p = self.root/'tls'
        p.mkdir()
        subprocess.run(['openssl', 'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', str(p/'key'), '-out', str(p/'cert'),
                        '-days', '2', '-subj', '/CN=suivi.example.test'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(p/'cert', p/'key')
        serveur = socket.create_server(('127.0.0.1', 0))
        self.addCleanup(serveur.close)
        recues = []
        def servir(reponse):
            brut, _ = serveur.accept()
            with context.wrap_socket(brut, server_side=True) as tls:
                recues.append(tls.recv(1024))
                tls.sendall(reponse)
        connecter = socket.create_connection
        adresses = []
        def vers_local(adresse, timeout=None):
            adresses.append(adresse)
            return connecter(('127.0.0.1', serveur.getsockname()[1]), timeout=timeout)
        attendue = hashlib.sha256(ssl.PEM_cert_to_DER_cert((p/'cert').read_text())).hexdigest()
        with patch.object(self.w, 'run', return_value='ok\n'), patch.object(m.socket, 'create_connection', side_effect=vers_local):
            fil = threading.Thread(target=servir, args=(b'HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nok',)); fil.start()
            self.assertEqual(self.w.frontal_sonde(), attendue)
            fil.join(5)
            fil = threading.Thread(target=servir, args=(b'HTTP/1.1 503 Service Unavailable\r\n\r\n',)); fil.start()
            with self.assertRaises(m.Failure): self.w.frontal_sonde()
            fil.join(5)
        self.assertEqual(adresses, [('gateway', 8443)] * 2)
        self.assertTrue(recues[0].startswith(b'GET /healthz HTTP/1.1\r\nHost: suivi.example.test\r\n'))
        # Relais interne en échec : rien n'est tenté en HTTPS.
        with patch.object(self.w, 'run', return_value='erreur'), patch.object(m.socket, 'create_connection') as connexion:
            with self.assertRaises(m.Failure): self.w.frontal_sonde()
        connexion.assert_not_called()

    def test_empreinte_calculee_a_la_construction_de_l_image_web(self):
        """L'image web écrit, à sa construction, l'empreinte lue par l'exécutant, au chemin qu'il lit : contenu de tout ce que
        le frontal exécute ou sert, chemins triés, après la dernière copie de ces fichiers. Un seul calcul, dans le script
        partagé par l'image web et la recette CI qui construit une image web dont le frontal diffère."""
        dockerfile = (ROOT/'docker/web.Dockerfile').read_text()
        script = (ROOT/'docker/empreinte-frontal.sh').read_text()
        self.assertIn(f'SORTIE={m.FRONTAL_EMPREINTE}\n', script)
        calcul_script = script.index('> "$SORTIE"')
        for fichier in ('/usr/local/bin/caddy', '/usr/local/bin/demarrer-gateway', '/etc/caddy/Caddyfile.gateway',
                        '/etc/caddy/Caddyfile.internal', '/bin/busybox', '/lib/ld-musl-*.so.1', 'find /maintenance -type f'):
            self.assertIn(fichier, script[:calcul_script])
        self.assertIn('LC_ALL=C sort', script[:calcul_script])
        self.assertIn('set -eu\n', script)
        self.assertIn("grep -Eqx '[a-f0-9]{64}' \"$SORTIE\"", script)
        self.assertIn('chmod 0444 "$SORTIE"', script)
        # Le Dockerfile lance ce script, monté pour cette seule étape (jamais copié dans l'image) ; la recette CI aussi.
        appel = 'RUN --mount=type=bind,source=docker/empreinte-frontal.sh,target=/tmp/empreinte-frontal.sh sh /tmp/empreinte-frontal.sh'
        self.assertFalse([ligne for ligne in dockerfile.splitlines() if 'empreinte-frontal' in ligne and ligne.startswith(('COPY', 'ADD'))])
        calcul = dockerfile.index(appel)
        recette = (ROOT/'scripts/ci/update-integree.py').read_text()
        self.assertIn("'docker/empreinte-frontal.sh'", recette)
        self.assertIn('RUN --mount=type=bind,source=empreinte-frontal.sh,target=/tmp/empreinte-frontal.sh sh /tmp/empreinte-frontal.sh', recette)
        copies = [ligne for ligne in dockerfile.splitlines() if ligne.startswith('COPY ')
                  and any(c in ligne for c in ('/maintenance', '/etc/caddy', 'demarrer-gateway', '/usr/local/bin/caddy'))]
        self.assertGreaterEqual(len(copies), 6)
        self.assertTrue(all(dockerfile.index(c) < calcul for c in copies))
        # Le frontal du compose est bien cette image (étiquette GATEWAY_VERSION).
        self.assertIn('image: ghcr.io/yousername-ha/suivi-audits-web:${GATEWAY_VERSION:-${APP_VERSION}}',
                      (ROOT/'docker-compose.yml').read_text())

    def test_frontal_sans_empreinte_valide_puis_recree_le_frontal_a_la_fin(self):
        # Frontal en service d'une image antérieure à l'ADR 0103 : pas d'empreinte, il est mis à jour.
        health = self.reprendre()
        health.assert_called_once_with(self.cible)
        # Santé et données d'abord, puis empreintes, image vérifiée, validation dans un conteneur éphémère, certificat relevé,
        # coupure annoncée, recréation et contrôle du nouveau frontal (même certificat), coupure retirée.
        self.assertEqual(self.ordre, ['sante', 'empreinte-cible', 'empreinte-service', 'image', 'validation', 'sonde', 'coupure',
                                      'recreation', 'sonde', 'fin de coupure'])
        lecture = next(c for c in self.journal if c[0][:2] == ['docker', 'run'])
        # Empreinte de la cible lue dans l'image vérifiée, désignée par son empreinte de dépôt, sans réseau ni téléchargement.
        self.assertEqual(lecture[0], ['docker', 'run', '--rm', '--pull', 'never', '--network', 'none', '--cap-drop', 'ALL',
                                      '--read-only', '--entrypoint', 'cat', self.WEB, '/etc/suivi-frontal.sha256'])
        validation = next(c for c in self.journal if c[0][:3] == ['docker', 'compose', 'run'])
        self.assertEqual(validation[0][3:], ['--rm', '--no-deps', 'gateway', '/usr/local/bin/demarrer-gateway', '--valider'])
        # La nouvelle image est désignée pour la seule validation ; .env n'est pas encore modifié, aucun réglage TLS transmis.
        self.assertEqual(validation[1], {'GATEWAY_VERSION': self.cible})
        self.assertEqual(validation[2], '7.1.0')
        self.assertFalse(validation[3])
        recreation = next(c for c in self.journal if c[0][:3] == ['docker', 'compose', 'up'])
        self.assertEqual(recreation[0], ['docker', 'compose', 'up', '-d', '--no-deps', 'gateway'])
        self.assertIsNone(recreation[1])
        self.assertEqual(recreation[2], self.cible)
        # Coupure publiée dans l'état public pendant la recréation.
        self.assertIs(recreation[3], True)
        self.assertEqual(self.gateway_version(), self.cible)
        self.assertEqual((self.w.state['status'], self.w.state['maintenance']), ('success', False))
        self.assertIs(self.etat_public()['coupure'], False)
        self.assertIn('Redémarrage du frontal du site. Cette page peut s’interrompre quelques secondes, puis elle reprend toute seule.',
                      self.messages)
        self.assertFalse(any('page de maintenance' in message for message in self.messages))
        self.assertEqual(self.recu()['message'], 'Mise à jour installée et vérifiée. Votre espace est prêt.')
        self.assertIn('mis à jour de 7.1.0', (self.w.private/f'{self.id}.log').read_text())

    def test_empreintes_differentes_ou_illisibles_en_service_le_frontal_est_mis_a_jour(self):
        for en_service in ('f' * 64, 'pas une empreinte'):
            self.setUp()
            self.empreinte_en_service = en_service
            self.reprendre()
            self.assertEqual(self.ordre.count('recreation'), 1)
            self.assertEqual(self.gateway_version(), self.cible)
            self.assertEqual(self.recu()['message'], 'Mise à jour installée et vérifiée. Votre espace est prêt.')

    def test_empreintes_identiques_rien_n_est_touche(self):
        self.empreinte_en_service = self.CIBLE
        env = (self.root/'.env').read_text()
        self.reprendre()
        self.assertEqual(self.ordre, ['sante', 'empreinte-cible', 'empreinte-service'])
        # Aucune validation, aucune recréation, GATEWAY_VERSION inchangée, ni coupure ni message d'étape publiés.
        self.assertEqual([c[0][:3] for c in self.journal], [['docker', 'run', '--rm'], ['docker', 'compose', 'exec']])
        self.assertEqual((self.root/'.env').read_text(), env)
        self.assertEqual(self.gateway_version(), '7.1.0')
        self.assertFalse(any('frontal' in message.lower() for message in self.messages))
        self.assertIs(self.etat_public()['coupure'], False)
        self.assertNotIn('frontal', self.w.job or {})
        self.assertEqual((self.w.state['status'], self.w.state['maintenance']), ('success', False))
        self.assertEqual(self.recu()['message'], 'Mise à jour installée et vérifiée. Votre espace est prêt.')
        self.assertIn('inchangé', (self.w.private/f'{self.id}.log').read_text())

    def test_empreinte_de_la_cible_illisible_frontal_non_touche_et_avertissement(self):
        cas = [(m.Failure('Commande interrompue'), self.WEB, ['sante', 'empreinte-cible']),
               ('abc', self.WEB, ['sante', 'empreinte-cible']),
               (self.CIBLE + '\n' + self.CIBLE, self.WEB, ['sante', 'empreinte-cible']),
               # Image de la cible non désignée par une empreinte de dépôt vérifiée : rien n'est lu ni exécuté.
               (self.CIBLE, 'ghcr.io/yousername-ha/suivi-audits-web:7.3.0', ['sante'])]
        for empreinte, image, ordre in cas:
            self.setUp()
            self.empreinte_cible = empreinte
            self.reprendre(images={'api': 'x', 'web': image, 'updater': 'y'})
            self.assertEqual(self.ordre, ordre)
            self.assertFalse(any(c[0][:3] in (['docker', 'compose', 'up'], ['docker', 'compose', 'run']) for c in self.journal))
            self.assertEqual(self.gateway_version(), '7.1.0')
            self.assertIs(self.etat_public()['coupure'], False)
            self.assertEqual(self.w.state['status'], 'success')
            self.assertEqual(self.recu()['statut'], 'success')
            self.assertIn('Frontal non mis à jour : l’empreinte de sa nouvelle image n’a pas pu être lue', self.recu()['message'])
            self.assertIn('Frontal non mis à jour', (self.w.private/f'{self.id}.log').read_text())

    def test_validation_refusee_garde_l_ancien_frontal_et_l_annonce(self):
        self.validation_refusee = True
        self.reprendre()
        self.assertNotIn('recreation', self.ordre)
        self.assertNotIn('coupure', self.ordre)
        self.assertEqual(self.gateway_version(), '7.1.0')
        self.assertEqual(self.w.state['status'], 'success')
        self.assertIn('Frontal non mis à jour', self.w.state['message'])
        self.assertIn('Frontal non mis à jour', self.recu()['message'])
        self.assertEqual(self.recu()['statut'], 'success')

    def test_image_locale_differente_de_l_image_verifiee_refusee_sans_rien_toucher(self):
        self.WEB = 'ghcr.io/yousername-ha/suivi-audits-web@sha256:' + 'b' * 64
        self.reprendre(images={'web': 'ghcr.io/yousername-ha/suivi-audits-web@sha256:' + 'a' * 64})
        self.assertEqual(self.ordre, ['sante', 'empreinte-cible', 'empreinte-service', 'image'])
        self.assertEqual(self.gateway_version(), '7.1.0')
        self.assertIn('Frontal non mis à jour', self.recu()['message'])

    def test_certificat_different_apres_recreation_retablit_l_ancien_frontal(self):
        # HSTS : le frontal recréé doit servir le même certificat (même mode TLS) ; sinon retour à l'ancien.
        self.certificats = ['c' * 64, 'd' * 64, 'c' * 64]
        self.reprendre()
        recreations = [c for c in self.journal if c[0][:3] == ['docker', 'compose', 'up']]
        self.assertEqual([c[2] for c in recreations], [self.cible, '7.1.0'])
        # Coupure annoncée pendant la recréation et le rétablissement, retirée une seule fois, ancien frontal vérifié.
        self.assertEqual([c[3] for c in recreations], [True, True])
        self.assertEqual(self.ordre[-4:], ['sonde', 'recreation', 'sonde', 'fin de coupure'])
        self.assertEqual(self.ordre.count('coupure'), 1)
        self.assertIs(self.etat_public()['coupure'], False)
        self.assertEqual(self.gateway_version(), '7.1.0')
        self.assertEqual(self.w.state['status'], 'success')
        self.assertIn('l’ancien a été rétabli', self.recu()['message'])
        self.assertEqual(self.w.job, None)

    def test_frontal_qui_ne_repond_plus_est_retabli_puis_signale(self):
        def sonde():
            self.ordre.append('sonde')
            if self.gateway_version() == self.cible: raise m.Failure('ne répond pas')
            return 'c' * 64
        self.fausse_sonde = sonde
        self.reprendre()
        self.assertEqual(self.gateway_version(), '7.1.0')
        self.assertIn('Frontal non mis à jour', self.recu()['message'])
        self.assertEqual(self.ordre[-1], 'fin de coupure')
        self.assertIs(self.etat_public()['coupure'], False)
        # Rétablissement impossible : avertissement explicite, coupure retirée, l'application reste mise à jour.
        self.setUp()
        def muette():
            if self.ordre.count('recreation'): raise m.Failure('rien')
            return 'c' * 64
        self.fausse_sonde = muette
        self.reprendre()
        self.assertEqual(self.ordre.count('recreation'), 4)
        self.assertEqual(self.ordre[-1], 'fin de coupure')
        self.assertIs(self.etat_public()['coupure'], False)
        self.assertEqual(self.gateway_version(), '7.1.0')
        self.assertEqual(self.w.state['status'], 'success')
        self.assertIn('sudo docker compose up -d gateway', self.recu()['message'])

    def test_frontal_deja_a_la_version_ou_sans_reglage_rien_a_faire(self):
        for env in (f'APP_VERSION={self.cible}\nGATEWAY_VERSION={self.cible}\n', f'APP_VERSION={self.cible}\n'):
            (self.root/'.env').write_text(env)
            self.journal, self.ordre = [], []
            self.reprendre()
            self.assertEqual(self.ordre, ['sante'])
            self.assertEqual((self.root/'.env').read_text(), env)

    def test_sante_en_echec_intervention_sans_toucher_au_frontal(self):
        self.w.job = {'id': self.id, 'kind': 'install', 'target': self.cible, 'handoff': True, 'images': {'web': self.WEB}}
        with patch.object(self.w, 'health', side_effect=m.Failure('absent')), patch.object(self.w, 'cli', return_value=''), \
                patch.object(self.w, 'run', side_effect=self.faux_run):
            self.w.recover()
        self.assertEqual(self.w.state['status'], 'intervention')
        self.assertEqual(self.journal, [])
        self.assertEqual(self.gateway_version(), '7.1.0')

    def test_executant_relance_pendant_la_recreation_retablit_l_ancien_frontal_avant_la_sante(self):
        (self.root/'.env').write_text(f'APP_VERSION={self.cible}\nSITE_ADDRESS=suivi.example.test\nGATEWAY_VERSION={self.cible}\n')
        # Coupure annoncée par l'exécutant interrompu, encore dans l'état public.
        self.w.publish(coupure=True)
        self.reprendre(frontal={'avant': '7.1.0', 'etape': 'recreation'})
        self.assertEqual(self.ordre[:4], ['recreation', 'sonde', 'fin de coupure', 'sante'])
        self.assertEqual(self.journal[0][3], True)
        self.assertEqual(self.ordre.count('validation'), 0)
        self.assertNotIn('empreinte-cible', self.ordre)
        self.assertEqual(self.gateway_version(), '7.1.0')
        self.assertIs(self.etat_public()['coupure'], False)
        self.assertEqual(self.w.state['status'], 'success')
        self.assertIn('Frontal non mis à jour', self.recu()['message'])

    def test_coupure_jamais_conservee_sans_operation_active(self):
        # État public resté avec une coupure (arrêt brutal) : sans demande active, l'exécutant redémarré la retire ; une
        # opération terminée la retire aussi.
        self.w.publish(coupure=True)
        with patch.dict(os.environ, REPO=str(self.root), DATA_DIR=str(self.data)):
            self.assertIs(m.Worker().state['coupure'], False)
        self.w.job = {'id': self.id, 'kind': 'install', 'target': self.cible}
        with patch.object(self.w, 'cli', return_value=''):
            self.w.finish('failed', 'Échec fictif.')
        self.assertIs(self.etat_public()['coupure'], False)


def couche(c):
    return 'sha256:' + c * 64


def manifeste(couches, plateforme=('linux', 'amd64')):
    """Sortie de « docker manifest inspect -v » pour un index : image de la plateforme et son attestation (unknown/unknown)."""
    return json.dumps([
        {'Ref': 'x', 'Descriptor': {'digest': couche('1'), 'size': 1, 'platform': {'os': plateforme[0], 'architecture': plateforme[1]}},
         'OCIManifest': {'layers': [{'digest': couche(c), 'size': s} for c, s in couches]}},
        {'Ref': 'y', 'Descriptor': {'digest': couche('2'), 'size': 1, 'platform': {'os': 'unknown', 'architecture': 'unknown'}},
         'OCIManifest': {'layers': [{'digest': couche('9'), 'size': 22781}]}},
    ])


class FauxFlux:
    """Réponse de l'API du moteur : lignes JSON lues une à une, chaque lecture avance l'horloge simulée. Une exception de la liste
    est levée à sa lecture."""

    def __init__(self, test, status, lignes):
        self.test, self.status, self.lignes = test, status, list(lignes)

    def read(self, n=-1):
        return self.lignes.pop(0) if self.lignes else b''

    def readline(self, n=-1):
        self.test.t[0] += self.test.pas
        if not self.lignes:
            return b''
        ligne = self.lignes.pop(0)
        if isinstance(ligne, BaseException):
            raise ligne
        return ligne if isinstance(ligne, bytes) else (json.dumps(ligne) + '\r\n').encode()


class FausseConnexion:
    def __init__(self):
        self.brut = self
        self.fermee = False

    def settimeout(self, valeur):
        assert valeur > 0

    def close(self):
        self.fermee = True


class Telechargement(Isolement, unittest.TestCase):
    """Progression réelle du téléchargement (ADR 0104) : images tirées par l'API du moteur Docker (simulée ici), octets reçus sur
    un total fixé avant le début, publiés au plus une fois par seconde puis retirés ; repli sur « docker pull » ; vérifications
    de signature inchangées après le téléchargement."""
    API = f'ghcr.io/{m.REPOSITORY}-api'
    WEB = f'ghcr.io/{m.REPOSITORY}-web'
    UPDATER = f'ghcr.io/{m.REPOSITORY}-updater'

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root/'.env').write_text('APP_VERSION=3.0.0\n')
        self.data = self.root/'data'
        (self.data/'etat').mkdir(parents=True)
        with patch.dict(os.environ, REPO=str(self.root), DATA_DIR=str(self.data)):
            self.w = m.Worker()
        self.isoler_moteur()
        self.w.job = {'id': str(uuid.uuid4()), 'kind': 'install', 'target': '3.1.0'}
        # Couches : A partagée par api et web et déjà présente sur le serveur ; l'image updater est déjà à jour.
        self.manifestes = {self.API: manifeste([('a', 100), ('b', 200)]), self.WEB: manifeste([('a', 100), ('c', 300)]),
                           self.UPDATER: manifeste([('d', 50)])}
        self.flux = {
            self.API: [{'status': 'Pulling from yousername-ha/suivi-audits-api', 'id': '3.1.0'},
                       {'status': 'Pulling fs layer', 'progressDetail': {}, 'id': 'a' * 12},
                       {'status': 'Already exists', 'progressDetail': {'hidecounts': True}, 'id': 'a' * 12},
                       {'status': 'Pulling fs layer', 'progressDetail': {}, 'id': 'b' * 12},
                       {'status': 'Downloading', 'progressDetail': {'current': 50, 'total': 200}, 'id': 'b' * 12},
                       {'status': 'Downloading', 'progressDetail': {'current': 120, 'total': 200}, 'id': 'b' * 12},
                       # Valeur en recul, puis au-delà de la taille, puis décompression (secondes) : ni recul ni dépassement.
                       {'status': 'Downloading', 'progressDetail': {'current': 80, 'total': 200}, 'id': 'b' * 12},
                       {'status': 'Downloading', 'progressDetail': {'current': 999, 'total': 200}, 'id': 'b' * 12},
                       {'status': 'Extracting', 'progressDetail': {'current': 1, 'units': 's'}, 'id': 'b' * 12},
                       {'status': 'Pull complete', 'progressDetail': {'hidecounts': True}, 'id': 'b' * 12},
                       # Couche hors manifeste de la plateforme (attestation) : ignorée.
                       {'status': 'Downloading', 'progressDetail': {'current': 10 ** 9}, 'id': '9' * 12},
                       {'status': 'Digest: sha256:' + 'e' * 64},
                       {'status': 'Status: Downloaded newer image for ghcr.io/yousername-ha/suivi-audits-api:3.1.0'}],
            self.WEB: [{'status': 'Already exists', 'id': 'a' * 12},
                       {'status': 'Downloading', 'progressDetail': {'current': 100, 'total': 300}, 'id': 'c' * 12},
                       {'status': 'Download complete', 'id': 'c' * 12},
                       {'status': 'Pull complete', 'id': 'c' * 12},
                       {'status': 'Status: Downloaded newer image for ghcr.io/yousername-ha/suivi-audits-web:3.1.0'}],
            self.UPDATER: [{'status': 'Pulling from yousername-ha/suivi-audits-updater', 'id': '3.1.0'},
                           {'status': 'Status: Image is up to date for ghcr.io/yousername-ha/suivi-audits-updater:3.1.0'}],
        }
        self.statuts = {}
        self.requetes, self.commandes, self.publications, self.connexions = [], [], [], []
        self.t, self.pas = [1000.0], 0.3
        self.moteur_absent = False

    def faux_moteur(self, methode, chemin, timeout):
        self.requetes.append((methode, chemin))
        if self.moteur_absent:
            raise FileNotFoundError(2, 'absent')
        connexion = FausseConnexion()
        self.connexions.append(connexion)
        if chemin == '/version':
            return connexion, FauxFlux(self, 200, [json.dumps({'Os': 'linux', 'Arch': 'amd64', 'ApiVersion': '1.52'}).encode()])
        query = m.urllib.parse.parse_qs(m.urllib.parse.urlsplit(chemin).query)
        depot = query['fromImage'][0]
        self.assertEqual(query['tag'], ['3.1.0'])
        return connexion, FauxFlux(self, self.statuts.get(depot, 200), self.flux[depot])

    def faux_run(self, args, **kwargs):
        self.commandes.append(args)
        if args[:4] == ['docker', 'manifest', 'inspect', '-v']:
            sortie = self.manifestes[args[4].rsplit(':', 1)[0]]
            if isinstance(sortie, Exception): raise sortie
            return sortie
        return fake_run()(args, **kwargs)

    def signatures(self, erreur=None):
        publier = self.w.publish
        def publication(**changes):
            if 'telechargement' in changes:
                self.publications.append((self.t[0], changes['telechargement']))
            publier(**changes)
        with patch.object(self.w, 'moteur', side_effect=self.faux_moteur), patch.object(self.w, 'run', side_effect=self.faux_run), \
                patch.object(self.w, 'publish', side_effect=publication), patch.object(m.time, 'monotonic', lambda: self.t[0]):
            if erreur:
                with self.assertRaises(erreur) as contexte: self.w.signatures('3.1.0')
                return contexte.exception
            self.w.signatures('3.1.0')

    def tirages(self):
        return [m.urllib.parse.parse_qs(m.urllib.parse.urlsplit(c).query)['fromImage'][0] for _, c in self.requetes if c.startswith('/images/create')]

    def cli_pull(self):
        return [a[2] for a in self.commandes if a[:2] == ['docker', 'pull']]

    def verifications(self):
        return [a for a in self.commandes if a[:2] == ['cosign', 'verify']]

    def test_progression_mesuree_monotone_bornee_puis_retiree_et_signatures_verifiees_apres(self):
        # Une lecture par seconde : chaque changement est publié.
        self.pas = 1.0
        self.signatures()
        valeurs = [v for _, v in self.publications]
        # Trois images tirées par l'API, dans l'ordre, sans aucun « docker pull » ; total fixé avant le premier octet.
        self.assertEqual(self.tirages(), [self.API, self.WEB, self.UPDATER])
        self.assertEqual(self.requetes[0], ('GET', '/version'))
        self.assertEqual(self.requetes[1][1], '/images/create?fromImage=ghcr.io%2Fyousername-ha%2Fsuivi-audits-api&tag=3.1.0')
        self.assertEqual(self.cli_pull(), [])
        self.assertEqual(valeurs[0], {'recu': 0, 'total': 650})
        self.assertIsNone(valeurs[-1])
        mesures = [v for v in valeurs if v is not None]
        self.assertTrue(all(set(v) == {'recu', 'total'} and v['total'] == 650 and 0 <= v['recu'] <= 650 for v in mesures))
        # A déjà présente (100), B reçue par morceaux sans recul ni dépassement, C, puis l'image déjà à jour (D, 50) comptée à
        # la fin de son flux : le total est atteint, jamais dépassé.
        self.assertEqual([v['recu'] for v in mesures], [0, 100, 150, 220, 300, 400, 600, 650])
        # Toutes les connexions au moteur sont refermées ; l'état public ne garde rien.
        self.assertTrue(all(c.fermee for c in self.connexions))
        self.assertIsNone(json.loads((self.w.public/'status.json').read_text())['telechargement'])
        # Vérifications inchangées, après le téléchargement complet.
        self.assertEqual(len(self.verifications()), 3)
        premiere = self.commandes.index(self.verifications()[0])
        self.assertTrue(all(i < premiere for i, a in enumerate(self.commandes) if a[:3] == ['docker', 'manifest', 'inspect']))
        self.assertEqual(set(self.w.job['images']), {'api', 'web', 'updater'})
        self.assertEqual(self.w.job['revision'], 'b' * 40)

    def test_compte_des_octets_par_couche(self):
        p = m.Progression({couche('a'): 100, couche('b'): 200})
        etapes = [({'status': 'Downloading', 'progressDetail': {'current': 120}, 'id': 'b' * 12}, 120),
                  ({'status': 'Downloading', 'progressDetail': {'current': 80}, 'id': 'b' * 12}, 120),
                  ({'status': 'Downloading', 'progressDetail': {'current': True}, 'id': 'b' * 12}, 120),
                  ({'status': 'Downloading', 'progressDetail': {'current': -5}, 'id': 'b' * 12}, 120),
                  ({'status': 'Downloading', 'progressDetail': 'x', 'id': 'b' * 12}, 120),
                  ({'status': 'Extracting', 'progressDetail': {'current': 1, 'units': 's'}, 'id': 'a' * 12}, 220),
                  ({'status': 'Downloading', 'progressDetail': {'current': 10 ** 6}, 'id': 'b' * 12}, 300),
                  ({'status': 'Downloading', 'progressDetail': {'current': 10 ** 6}, 'id': 'c' * 12}, 300),
                  ({'status': 'Already exists', 'id': ['a']}, 300)]
        for evenement, attendu in etapes:
            p.evenement(evenement)
            self.assertEqual(p.recu, attendu, evenement)
        self.assertEqual(p.total, 300)

    def test_couches_deja_presentes_comptees_recues_des_le_debut_et_une_seule_fois(self):
        self.pas = 2.0
        self.signatures()
        recus = [v['recu'] for _, v in self.publications if v]
        # A (100 octets) déjà présente : comptée reçue dès son annonce, la barre part au-dessus de zéro ; partagée par web,
        # elle n'est comptée qu'une fois dans le total.
        self.assertEqual(recus[:3], [0, 100, 150])
        self.assertEqual(recus[-1], 650)

    def test_publication_au_plus_une_fois_par_seconde(self):
        self.pas = 0.05
        self.flux[self.API][4:6] = [{'status': 'Downloading', 'progressDetail': {'current': n, 'total': 200}, 'id': 'b' * 12}
                                    for n in range(1, 200)]
        self.signatures()
        instants = [t for t, v in self.publications if v is not None]
        self.assertGreater(len(instants), 3)
        self.assertTrue(all(b - a >= 1.0 for a, b in zip(instants, instants[1:])), instants)

    def test_erreur_dans_le_flux_echec_sans_repli_ni_verification(self):
        self.flux[self.WEB][2:2] = [{'errorDetail': {'message': 'refus du registre'}, 'error': 'refus du registre'}]
        erreur = self.signatures(m.Failure)
        self.assertEqual(str(erreur), 'Téléchargement en échec')
        # Ni nouvel essai par la CLI, ni image suivante, ni vérification ; progression retirée de l'état public.
        self.assertEqual(self.cli_pull(), [])
        self.assertEqual(self.tirages(), [self.API, self.WEB])
        self.assertEqual(self.verifications(), [])
        self.assertIsNone(self.publications[-1][1])
        self.assertIsNone(json.loads((self.w.public/'status.json').read_text())['telechargement'])
        self.assertNotIn('refus du registre', (self.w.public/'status.json').read_text())
        self.assertNotIn('revision', self.w.job)

    def test_flux_coupe_ou_illisible_apres_le_debut_echec_sans_repli(self):
        for incident in (ConnectionResetError(104, 'coupé'), b'pas du json\r\n', m.http.client.IncompleteRead(b'')):
            with self.subTest(incident=repr(incident)):
                self.setUp()
                self.flux[self.API][5:5] = [incident]
                self.assertEqual(str(self.signatures(m.Failure)), 'Téléchargement interrompu')
                self.assertEqual((self.cli_pull(), self.verifications()), ([], []))
                self.assertIsNone(self.w.state['telechargement'])

    def test_delai_depasse_par_image(self):
        self.pas = m.TELECHARGEMENT_DELAI / 4
        self.assertEqual(str(self.signatures(m.Failure)), 'Délai dépassé')
        self.assertEqual((self.cli_pull(), self.tirages()), ([], [self.API]))
        self.assertIsNone(self.w.state['telechargement'])

    def test_identifiants_de_registre_configures_docker_pull_sans_progression(self):
        dossier = self.root/'config-docker'
        dossier.mkdir()
        for config in ({'auths': {'registre.example.test': {}}}, {'credsStore': 'pass'}, {'credHelpers': {'registre.example.test': 'x'}},
                       'illisible', ['x']):
            with self.subTest(config=config):
                (dossier/'config.json').write_text(config if isinstance(config, str) else json.dumps(config))
                self.requetes, self.commandes, self.publications = [], [], []
                self.signatures()
                self.assertEqual(self.requetes, [])
                self.assertFalse([a for a in self.commandes if a[:2] == ['docker', 'manifest']])
                self.assertEqual(self.cli_pull(), [f'{d}:3.1.0' for d in (self.API, self.WEB, self.UPDATER)])
                self.assertEqual(self.publications, [])
                self.assertEqual(len(self.verifications()), 3)
        # Configuration sans identifiant (dossier monté par défaut, ou entrées vides) : API du moteur.
        (dossier/'config.json').write_text(json.dumps({'auths': {}, 'credHelpers': {}}))
        self.requetes, self.commandes = [], []
        self.signatures()
        self.assertEqual((self.tirages(), self.cli_pull()), ([self.API, self.WEB, self.UPDATER], []))

    def test_api_indisponible_avant_tout_octet_repli_sur_docker_pull(self):
        def moteur_absent(t): t.moteur_absent = True
        def manifeste_illisible(t): t.manifestes[t.WEB] = m.Failure('Commande interrompue')
        def plateforme_absente(t): t.manifestes[t.UPDATER] = manifeste([('d', 50)], plateforme=('linux', 'arm64'))
        def premiere_ligne_illisible(t): t.flux[t.API].insert(0, b'<html>\r\n')
        def flux_vide(t): t.flux[t.API] = []
        for preparer in (moteur_absent, manifeste_illisible, plateforme_absente, premiere_ligne_illisible, flux_vide):
            with self.subTest(preparer.__name__):
                self.setUp()
                preparer(self)
                self.signatures()
                self.assertEqual(self.cli_pull(), [f'{d}:3.1.0' for d in (self.API, self.WEB, self.UPDATER)])
                self.assertTrue(all(v is None for _, v in self.publications[1:]))
                self.assertIsNone(self.w.state['telechargement'])
                self.assertEqual(len(self.verifications()), 3)
        # Réponse HTTP en erreur pour la deuxième image, la première étant tirée : elle et la suivante passent par la CLI.
        self.setUp()
        self.statuts[self.WEB] = 500
        self.signatures()
        self.assertEqual(self.tirages(), [self.API, self.WEB])
        self.assertEqual(self.cli_pull(), [f'{self.WEB}:3.1.0', f'{self.UPDATER}:3.1.0'])
        self.assertIsNone(self.publications[-1][1])
        self.assertEqual(len(self.verifications()), 3)

    def test_progression_jamais_conservee_hors_telechargement(self):
        # Exécutant redémarré (même pendant une opération) ou opération terminée : aucune progression publiée.
        self.w.publish(telechargement={'recu': 1, 'total': 2})
        (self.w.private/'active.json').write_text(json.dumps(self.w.job))
        with patch.dict(os.environ, REPO=str(self.root), DATA_DIR=str(self.data)):
            self.assertIsNone(m.Worker().state['telechargement'])
        self.w.publish(telechargement={'recu': 1, 'total': 2})
        with patch.object(self.w, 'cli', return_value=''):
            self.w.finish('failed', 'Échec fictif.')
        self.assertIsNone(json.loads((self.w.public/'status.json').read_text())['telechargement'])

    def test_api_du_moteur_par_un_vrai_socket_unix(self):
        """Connexion http.client sur un socket Unix réel : chemin de l'API sans préfixe de version, flux découpé (chunked)."""
        chemin = str(self.root/'m.sock')
        serveur = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        serveur.bind(chemin)
        self.addCleanup(serveur.close)
        serveur.listen(4)
        recues = []
        def servir():
            for corps in ([json.dumps({'Os': 'linux', 'Arch': 'amd64'}).encode()],
                          [(json.dumps(e) + '\r\n').encode() for e in self.flux[self.API]]):
                brut, _ = serveur.accept()
                with brut:
                    requete = b''
                    while b'\r\n\r\n' not in requete: requete += brut.recv(4096)
                    recues.append(requete.split(b'\r\n', 1)[0].decode())
                    brut.sendall(b'HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nTransfer-Encoding: chunked\r\n\r\n')
                    for morceau in corps:
                        brut.sendall(b'%x\r\n%s\r\n' % (len(morceau), morceau))
                    brut.sendall(b'0\r\n\r\n')
        fil = threading.Thread(target=servir, daemon=True)
        fil.start()
        progression = m.Progression({couche('a'): 100, couche('b'): 200})
        with patch.object(m, 'DOCKER_SOCKET', chemin), patch.object(m, 'TELECHARGEMENT_PERIODE', 0):
            self.assertEqual(self.w.plateforme(), ('linux', 'amd64'))
            self.w.tirer(self.API, '3.1.0', {couche('a'): 100, couche('b'): 200}, progression)
        fil.join(5)
        self.assertEqual(recues, ['GET /version HTTP/1.1',
                                  'POST /images/create?fromImage=ghcr.io%2Fyousername-ha%2Fsuivi-audits-api&tag=3.1.0 HTTP/1.1'])
        self.assertEqual(progression.recu, 300)
        self.assertEqual(self.w.state['telechargement'], {'recu': 300, 'total': 300})

if __name__=='__main__': unittest.main()
