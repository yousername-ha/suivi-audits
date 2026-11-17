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


class Updates(unittest.TestCase):
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


class FrontalPonctuel(unittest.TestCase):
    """Exception ponctuelle du RSSI du 17/11/2026 (ADR 0061, addendum) : la mise à jour web vers FRONTAL_AVEC_LA_VERSION met
    aussi le frontal à jour, à la fin. À retirer avec la constante à la version suivante (voir le garde-fou ci-dessous)."""
    WEB = 'ghcr.io/yousername-ha/suivi-audits-web@sha256:' + 'a' * 64

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.cible = m.FRONTAL_AVEC_LA_VERSION or '7.2.2'
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

    def gateway_version(self):
        return self.w.env().get('GATEWAY_VERSION')

    def faux_run(self, args, timeout=120, extra_env=None, input_text=None):
        self.journal.append((args, extra_env, self.gateway_version()))
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
        self.w.job = {'id': self.id, 'kind': 'install', 'target': target or self.cible, 'installed': '7.2.1', 'handoff': True,
                      'images': {'api': 'x', 'web': self.WEB, 'updater': 'y'}, **job}
        self.w.publish(id=self.id, status='running', phase='verifying', startedAt=m.now(), maintenance=True)
        with patch.object(self.w, 'health', side_effect=lambda v: self.ordre.append('sante')) as health, \
                patch.object(self.w, 'cli', return_value=''), patch.object(self.w, 'run', side_effect=self.faux_run), \
                patch.object(self.w, 'frontal_sonde', side_effect=lambda: self.fausse_sonde()), \
                patch.object(m.time, 'sleep'), patch.object(m, 'FRONTAL_DELAI', 0):
            self.w.recover()
        return health

    def recu(self):
        return json.loads((self.data/'etat/recus-mises-a-jour'/f'{self.id}.json').read_text())

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

    def test_garde_fou_constante_a_retirer_a_la_version_suivante(self):
        """Échoue dès que le dépôt passe à une version postérieure : retirer alors FRONTAL_AVEC_LA_VERSION, frontal_ponctuel()
        et ces tests (décision du RSSI : « remettre comme avant après la mise à jour »)."""
        depot = json.loads((ROOT/'package.json').read_text())['version']
        if m.FRONTAL_AVEC_LA_VERSION:
            self.assertGreaterEqual(m.version(m.FRONTAL_AVEC_LA_VERSION), m.version(depot),
                                    'FRONTAL_AVEC_LA_VERSION désigne une version déjà publiée : retirer l’exception ponctuelle.')

    def test_version_designee_valide_puis_recree_le_frontal_a_la_fin(self):
        health = self.reprendre()
        health.assert_called_once_with(self.cible)
        # Santé et données d'abord, puis image vérifiée, validation dans un conteneur éphémère, certificat relevé,
        # recréation et contrôle du nouveau frontal (même certificat).
        self.assertEqual(self.ordre, ['sante', 'image', 'validation', 'sonde', 'recreation', 'sonde'])
        validation = next(c for c in self.journal if c[0][:3] == ['docker', 'compose', 'run'])
        self.assertEqual(validation[0][3:], ['--rm', '--no-deps', 'gateway', '/usr/local/bin/demarrer-gateway', '--valider'])
        # La nouvelle image est désignée pour la seule validation ; .env n'est pas encore modifié, aucun réglage TLS transmis.
        self.assertEqual(validation[1], {'GATEWAY_VERSION': self.cible})
        self.assertEqual(validation[2], '7.1.0')
        recreation = next(c for c in self.journal if c[0][:3] == ['docker', 'compose', 'up'])
        self.assertEqual(recreation[0], ['docker', 'compose', 'up', '-d', '--no-deps', 'gateway'])
        self.assertIsNone(recreation[1])
        self.assertEqual(recreation[2], self.cible)
        self.assertEqual(self.gateway_version(), self.cible)
        self.assertEqual((self.w.state['status'], self.w.state['maintenance']), ('success', False))
        self.assertEqual(self.recu()['message'], 'Mise à jour installée et vérifiée. Votre espace est prêt.')
        self.assertIn('mis à jour de 7.1.0', (self.w.private/f'{self.id}.log').read_text())

    def test_validation_refusee_garde_l_ancien_frontal_et_l_annonce(self):
        self.validation_refusee = True
        self.reprendre()
        self.assertNotIn('recreation', self.ordre)
        self.assertEqual(self.gateway_version(), '7.1.0')
        self.assertEqual(self.w.state['status'], 'success')
        self.assertIn('Frontal non mis à jour', self.w.state['message'])
        self.assertIn('Frontal non mis à jour', self.recu()['message'])
        self.assertEqual(self.recu()['statut'], 'success')

    def test_image_locale_differente_de_l_image_verifiee_refusee_sans_rien_toucher(self):
        self.WEB = 'ghcr.io/yousername-ha/suivi-audits-web@sha256:' + 'b' * 64
        self.reprendre(images={'web': 'ghcr.io/yousername-ha/suivi-audits-web@sha256:' + 'a' * 64})
        self.assertEqual(self.ordre, ['sante', 'image'])
        self.assertEqual(self.gateway_version(), '7.1.0')
        self.assertIn('Frontal non mis à jour', self.recu()['message'])

    def test_certificat_different_apres_recreation_retablit_l_ancien_frontal(self):
        # HSTS : le frontal recréé doit servir le même certificat (même mode TLS) ; sinon retour à l'ancien.
        self.certificats = ['c' * 64, 'd' * 64, 'c' * 64]
        self.reprendre()
        recreations = [c for c in self.journal if c[0][:3] == ['docker', 'compose', 'up']]
        self.assertEqual([c[2] for c in recreations], [self.cible, '7.1.0'])
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
        # Rétablissement impossible : avertissement explicite, l'application reste mise à jour.
        self.setUp()
        def muette():
            if self.ordre.count('recreation'): raise m.Failure('rien')
            return 'c' * 64
        self.fausse_sonde = muette
        self.reprendre()
        self.assertEqual(self.ordre.count('recreation'), 4)
        self.assertEqual(self.gateway_version(), '7.1.0')
        self.assertEqual(self.w.state['status'], 'success')
        self.assertIn('sudo docker compose up -d gateway', self.recu()['message'])

    def test_autre_cible_ne_touche_pas_au_frontal(self):
        (self.root/'.env').write_text('APP_VERSION=99.0.0\nSITE_ADDRESS=suivi.example.test\nGATEWAY_VERSION=7.1.0\n')
        self.reprendre(target='99.0.0')
        self.assertEqual(self.ordre, ['sante'])
        self.assertEqual(self.journal, [])
        self.assertEqual(self.gateway_version(), '7.1.0')
        self.assertEqual(self.recu()['message'], 'Mise à jour installée et vérifiée. Votre espace est prêt.')

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
        self.reprendre(frontal={'avant': '7.1.0', 'etape': 'recreation'})
        self.assertEqual(self.ordre[:3], ['recreation', 'sonde', 'sante'])
        self.assertEqual(self.ordre.count('validation'), 0)
        self.assertEqual(self.gateway_version(), '7.1.0')
        self.assertEqual(self.w.state['status'], 'success')
        self.assertIn('Frontal non mis à jour', self.recu()['message'])


if __name__=='__main__': unittest.main()
