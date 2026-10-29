"""Contrat de l'exécutant et reprise durable. Les commandes Docker sont simulées ici ; la CI teste la vraie pile."""
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
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


def fake_run(revision='b'*40, attest=None, fetch_fail_origin=False, fetched=None):
    """Simule git, docker et cosign pour signatures() ; « attest » remplace la sortie de verify-attestation."""
    def run(args, **kwargs):
        if args[:2]==['git','fetch']:
            if fetched is not None: fetched.append(args[3])
            if fetch_fail_origin and args[3]=='origin': raise m.Failure('ssh')
            return ''
        if args[0]=='git' and args[1]=='rev-parse': return revision
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

    def test_preversion_numerotee_detectee_par_ancien_chemin_depot_prive(self):
        # GitHub /latest n'expose pas les préversions. Le dépôt privé est déjà lu par la clé Git.
        tags = 'a\trefs/tags/v3.0.0\nb\trefs/tags/v3.0.1\nc\trefs/tags/v3.0.2-beta\n'
        def run(args, **kwargs):
            return tags if args[0] == 'git' else '{}'
        with patch.object(m.urllib.request, 'urlopen', side_effect=urllib.error.HTTPError('url',404,'private',{},None)), \
                patch.object(self.w,'run',side_effect=run) as commands:
            self.w.check()
        self.assertEqual(self.w.state['available'],'3.0.1')
        self.assertEqual(self.w.state['notes'],f'https://github.com/{m.REPOSITORY}/releases/tag/v3.0.1')
        self.assertFalse(self.w.state['checkError'])
        for component in ('api','web','updater'):
            self.assertIn(unittest.mock.call(['docker','manifest','inspect',f'ghcr.io/{m.REPOSITORY}-{component}:3.0.1'],timeout=45),commands.call_args_list)

    def test_publication_partielle_nest_pas_annoncee(self):
        def run(args, **kwargs):
            if args[0]=='git': return 'a\trefs/tags/v3.0.1\n'
            if args[-1].endswith('-updater:3.0.1'): raise m.Failure('absente')
            return '{}'
        with patch.object(m.urllib.request, 'urlopen', side_effect=urllib.error.HTTPError('url',404,'private',{},None)), \
                patch.object(self.w,'run',side_effect=run):
            with self.assertRaises(m.Failure): self.w.check()
        self.assertIsNone(self.w.state['available'])
        self.assertTrue(self.w.state['checkError'])

    def test_exploitation_automatique_utilise_les_cles_age_du_dossier_des_donnees_et_stockage_prive(self):
        with patch.object(self.w,'run') as run:
            self.w.exploitation()
        args, options = run.call_args
        self.assertEqual(args[0],['python3',str(self.root/'scripts/exploitation-worker.py')])
        self.assertEqual(options['timeout'],4000)
        env = options['extra_env']
        self.assertEqual(env['BACKUP_KEY_FILE'],str(self.data/'cles-sauvegarde/serveur.key'))
        self.assertEqual(env['BACKUP_RECIPIENTS_FILE'],str(self.data/'cles-sauvegarde/secours.pub'))
        self.assertNotIn('BACKUP_PASSPHRASE_FILE',env)
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

    def test_pas_de_recu_pour_une_verification(self):
        self.w.job={'id':self.id,'kind':'check','target':None}
        with patch.object(self.w,'cli',return_value=''):
            self.w.finish('success','Vérification terminée.')
        self.assertFalse((self.data/'etat/recus-mises-a-jour').exists())


if __name__=='__main__': unittest.main()
