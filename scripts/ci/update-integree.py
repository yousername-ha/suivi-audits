"""Recette Docker réelle, dans une copie privée : API administrative -> sauvegarde -> migration -> santé ->
remplacement de l'exécutant ; puis échec injecté -> restauration réelle. Les publications locales de recette
remplacent uniquement le téléchargement/signature (contrat de vérification testé séparément). Aucun push/tag distant.
"""
import base64
import contextlib
import hashlib
import hmac
import http.cookiejar
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import ssl
import subprocess
import tempfile
import threading
import time
import urllib.request
import uuid
from unittest.mock import patch

ROOT = Path.cwd()
BASE_ENV = dict(os.environ)
BASE_ENV.pop('APP_VERSION', None)
BASE_ENV['PWD'] = str(ROOT)
IMAGE = 'ghcr.io/yousername-ha/suivi-audits-'


def run(args, cwd=ROOT, env=None, timeout=300):
    return subprocess.check_output(args, cwd=cwd, env={**BASE_ENV, **(env or {}), 'PWD':str(cwd)}, stderr=subprocess.PIPE, timeout=timeout).decode()


def compose(*args, cwd=ROOT, **kwargs):
    return run(['docker','compose',*args],cwd=cwd,**kwargs)


def wait_health(cwd):
    for _ in range(100):
        with contextlib.suppress(Exception):
            payload=json.loads(compose('exec','-T','app','node','-e',"fetch('http://127.0.0.1:8080/api/health/ready').then(r=>r.text()).then(console.log)",cwd=cwd))
            if payload.get('pret') is True: return
        time.sleep(2)
    raise AssertionError('Service non prêt')


work=Path(tempfile.mkdtemp(prefix='suivi-update-recette-',dir=os.environ.get('RUNNER_TEMP','/tmp')))
repo=work/'repo'
run(['git','clone','--no-hardlinks',str(ROOT),str(repo)])
shutil.copy(ROOT/'.env',repo/'.env')
shutil.copytree(ROOT/'certs',repo/'certs',dirs_exist_ok=True)
run(['git','config','user.name','Recette locale'],cwd=repo)
run(['git','config','user.email','recette@example.invalid'],cwd=repo)
original_env=(repo/'.env').read_text()
original_images={c:run(['docker','inspect','-f','{{.Id}}',IMAGE+c+':ci']).strip() for c in ('api','web','updater')}
def change_version(v):
    text=re.sub(r'^APP_VERSION=.*$',f'APP_VERSION={v}',original_env,flags=re.M)
    text+='\nGATEWAY_VERSION=ci\n'
    (repo/'.env').write_text(text)
change_version('98.0.0')
base_ref=run(['git','rev-parse','HEAD'],cwd=repo).strip()
run(['git','tag','v98.0.0'],cwd=repo)
for component in ('api','web','updater'):
    run(['docker','tag',IMAGE+component+':ci',IMAGE+component+':98.0.0'])
(repo/'apps/api/migrations/012_recette_update.sql').write_text('CREATE TABLE recette_update_temoin(id integer PRIMARY KEY); INSERT INTO recette_update_temoin VALUES (1);\n')
run(['git','add','apps/api/migrations/012_recette_update.sql'],cwd=repo)
run(['git','commit','-m','Fixture privée : témoin de migration'],cwd=repo)
run(['git','tag','v99.0.0'],cwd=repo)
(work/'Dockerfile').write_text('FROM '+IMAGE+'api:ci\nCOPY --chmod=0444 012_recette_update.sql /app/apps/api/migrations/012_recette_update.sql\n')
shutil.copy(repo/'apps/api/migrations/012_recette_update.sql',work/'012_recette_update.sql')
run(['docker','build','-t',IMAGE+'api:99.0.0',str(work)])
for component in ('web','updater'): run(['docker','tag',IMAGE+component+':ci',IMAGE+component+':99.0.0'])
run(['git','checkout','--detach',base_ref],cwd=repo)
compose('stop','updater')
compose('up','-d','db','app','web',cwd=repo)
wait_health(repo)
# Compte fictif supplémentaire, créé uniquement dans cette pile CI. Aucun compte existant n'est modifié.
js="""import crypto from 'node:crypto'; import {createServices} from './dist/services.js'; import {loadConfig} from './dist/config.js'; import {createLogger} from './dist/log.js'; import {hashPassword} from './dist/security/crypto.js';
const svc=createServices(loadConfig(),createLogger('silent')); const key=crypto.randomBytes(20);
const u=await svc.db.one('INSERT INTO users(username,display_name,password_hash,must_change_password) VALUES ($1,$2,$3,false) RETURNING id',['recette_update','Recette mise à jour',await hashPassword('Recette-Update-2026!')]);
await svc.db.q('INSERT INTO user_roles(user_id,role_id) VALUES ($1,$2)',[u.id,'administrateur']);
await svc.db.q('UPDATE users SET totp_secret=$2,totp_enabled=true WHERE id=$1',[u.id,svc.vault.sealSmall(key,'totp:'+u.id)]);
console.log(JSON.stringify({key:key.toString('base64')})); await svc.db.end();"""
secret=base64.b64decode(json.loads(compose('exec','-T','app','node','--input-type=module','-e',js,cwd=repo))['key'])
compose('cp','gateway:/data/caddy/pki/authorities/local/root.crt',str(work/'root.crt'))
context=ssl.create_default_context(cafile=str(work/'root.crt'))
jar=http.cookiejar.CookieJar()
http=urllib.request.build_opener(urllib.request.HTTPSHandler(context=context),urllib.request.HTTPCookieProcessor(jar))
csrf=''
def call(method,path,data=None):
    req=urllib.request.Request('https://localhost'+path,data=json.dumps(data).encode() if data is not None else None,method=method,headers={'Origin':'https://localhost','Content-Type':'application/json','X-CSRF-Token':csrf,'X-Forwarded-For':'203.0.113.10'})
    with http.open(req,timeout=10) as r: return json.loads(r.read())
call('POST','/api/auth/login',{'username':'recette_update','password':'Recette-Update-2026!'})
csrf=call('GET','/api/auth/me')['csrf']
step=int(time.time()//30)-1
raw=hmac.new(secret,step.to_bytes(8,'big'),hashlib.sha1).digest(); offset=raw[-1]&15
code=str((int.from_bytes(raw[offset:offset+4],'big')&0x7fffffff)%1000000).zfill(6)
call('POST','/api/auth/mfa',{'code':code})
csrf=call('GET','/api/auth/me')['csrf']
before=json.loads(compose('exec','-T','app','suivi','controle-donnees',cwd=repo))
def environment_snapshot():
    return json.loads(compose('exec','-T','-u','postgres','db','psql','-d','suivi','-Atc',"SELECT jsonb_build_object('current',(SELECT version FROM environment_configuration WHERE id=1),'versions',(SELECT jsonb_agg(to_jsonb(v) ORDER BY version) FROM environment_versions v),'assessments',(SELECT jsonb_agg(to_jsonb(a) ORDER BY source_id,revision) FROM risk_assessments a))::text",cwd=repo))
before_environment=environment_snapshot()
data=Path(re.search(r'^DATA_DIR=(.*)$',original_env,re.M).group(1).strip('"\'')) if re.search(r'^DATA_DIR=(.*)$',original_env,re.M) else Path('/srv/suivi-audits/donnees')
spec=importlib.util.spec_from_file_location('update_worker',repo/'scripts/update-worker.py'); m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
os.environ.update(REPO=str(repo),DATA_DIR=str(data),PWD=str(repo));os.environ.pop('APP_VERSION',None)
class Fixture(m.Worker):
    def check(self): self.publish(available='99.0.0',notes='https://github.com/yousername-ha/suivi-audits/releases/tag/v99.0.0',checkedAt=m.now(),checking=False,checkError=False)
    def signatures(self,target):
        self.job['images']={c:IMAGE+c+':'+target for c in ('api','web','updater')}
        m.atomic(self.private/'active.json',self.job)

observations=[]; errors=[]; stop=threading.Event()
def monitor():
    while not stop.is_set():
        try:
            with urllib.request.urlopen('https://localhost/update/status.json',context=context,timeout=5) as r: state=json.loads(r.read())
            if state['maintenance']:
                with urllib.request.urlopen(urllib.request.Request('https://localhost/',headers={'Accept':'text/html'}),context=context,timeout=5) as r:
                    html=r.read().decode()
                    if 'maintenance-card' in html:
                        assert '/update/maintenance.js' in html
                    else:
                        # Les deux lectures peuvent encadrer l'ouverture/la fermeture du marqueur atomique.
                        # Une transition est acceptable uniquement vers l'interface et un service réellement sain.
                        assert 'id="root"' in html
                        with urllib.request.urlopen('https://localhost/healthz',context=context,timeout=5) as health:
                            assert health.status==200 and health.read().strip()==b'ok'
                for asset in ('maintenance.js','maintenance.css'):
                    with urllib.request.urlopen('https://localhost/update/'+asset,context=context,timeout=5) as r: assert r.status==200 and r.read()
                observations.append(state['phase'])
        except Exception as e: errors.append(type(e).__name__)
        stop.wait(.4)
thread=threading.Thread(target=monitor,daemon=True);thread.start()
gateway=compose('ps','-q','gateway').strip()
original_popen=subprocess.Popen
forced=False
def local_popen(args,*a,**kwargs):
    if isinstance(args,list) and len(args)>1 and str(args[1]).endswith('/scripts/mettre-a-jour.sh'):
        args=[*args,'--images-locales']
        if forced: kwargs['env']={**kwargs['env'],'SUIVI_TEST_ECHEC_SANTE':'1'}
    return original_popen(args,*a,**kwargs)
try:
    worker=Fixture();worker.reconcile();worker.check();worker.publish(ready=True,status='idle',maintenance=False)
    requested=call('POST','/api/admin/updates/install',{'requestId':str(uuid.uuid4()),'version':'99.0.0','confirm':'METTRE À JOUR'})
    audited_ip=compose('exec','-T','-u','postgres','db','psql','-d','suivi','-Atc',f"SELECT host(ip) FROM audit_log WHERE action='update.install.requested' AND target='{requested['id']}' ORDER BY id DESC LIMIT 1",cwd=repo).strip()
    gateway_networks=json.loads(run(['docker','inspect','-f','{{json .NetworkSettings.Networks}}',gateway]))
    assert audited_ip and audited_ip not in ['203.0.113.10',*[n['IPAddress'] for n in gateway_networks.values()]]
    claimed=json.loads(worker.cli('update-claim'));assert claimed['id']==requested['id']
    with patch.object(m.subprocess,'Popen',side_effect=local_popen): worker.locked_operation(lambda:worker.install(claimed))
    for _ in range(100):
        state=m.read(data/'etat/updates/status.json',{})
        if state.get('status')=='success' and state.get('installed')=='99.0.0' and not state.get('maintenance'): break
        time.sleep(2)
    else: raise AssertionError('Reprise par le nouvel exécutant non terminée')
    assert compose('ps','-q','gateway').strip()==gateway
    updater=compose('ps','-q','updater',cwd=repo).strip()
    assert run(['docker','inspect','-f','{{.Config.Image}}',updater]).strip().endswith(':99.0.0')
    assert json.loads(compose('exec','-T','app','suivi','controle-donnees',cwd=repo))==before
    assert environment_snapshot()==before_environment
    assert compose('exec','-T','-u','postgres','db','psql','-d','suivi','-Atc','SELECT count(*) FROM recette_update_temoin',cwd=repo).strip()=='1'
    assert compose('exec','-T','-u','postgres','db','psql','-d','suivi','-Atc',f"SELECT status FROM update_jobs WHERE id='{requested['id']}'",cwd=repo).strip()=='success'
    print('Mise à jour API 98 -> 99 : sauvegarde chiffrée, migration réelle, données identiques, exécutant remplacé, frontal intact.')
    # Revenir à la base de la fixture avec la sauvegarde précédente, puis injecter un échec après migration.
    compose('stop','updater',cwd=repo)
    private=m.read(data/'reprise-updates/progress.json');backup=private['backup'];assert backup.endswith('.enc')
    run(['git','checkout','--detach',base_ref],cwd=repo);change_version('98.0.0')
    compose('up','-d','db','app','web',cwd=repo);wait_health(repo)
    run(['bash',str(repo/'scripts/restore.sh'),backup],cwd=repo,timeout=1800,env={'SUIVI_MAJ_WEB':'1','RESTAURER_SANS_CONFIRMATION':'1','BACKUP_PASSPHRASE_FILE':str(data/'update-secrets/backup-pass')})
    wait_health(repo)
    jar.clear()
    call('POST','/api/auth/login',{'username':'recette_update','password':'Recette-Update-2026!'})
    csrf=call('GET','/api/auth/me')['csrf']
    step=int(time.time()//30)
    raw=hmac.new(secret,step.to_bytes(8,'big'),hashlib.sha1).digest(); offset=raw[-1]&15
    code=str((int.from_bytes(raw[offset:offset+4],'big')&0x7fffffff)%1000000).zfill(6)
    call('POST','/api/auth/mfa',{'code':code})
    csrf=call('GET','/api/auth/me')['csrf']
    assert json.loads(compose('exec','-T','app','suivi','controle-donnees',cwd=repo))==before
    worker=Fixture();worker.reconcile();worker.check();worker.publish(ready=True,status='idle',maintenance=False)
    requested=call('POST','/api/admin/updates/install',{'requestId':str(uuid.uuid4()),'version':'99.0.0','confirm':'METTRE À JOUR'})
    claimed=json.loads(worker.cli('update-claim'));assert claimed['id']==requested['id']
    forced=True
    with patch.object(m.subprocess,'Popen',side_effect=local_popen):worker.locked_operation(lambda:worker.install(claimed))
    assert worker.state['status']=='rolled_back' and not worker.state['maintenance']
    assert worker.state['installed']=='98.0.0'
    assert environment_snapshot()==before_environment
    assert compose('exec','-T','-u','postgres','db','psql','-d','suivi','-Atc',f"SELECT status FROM update_jobs WHERE id='{requested['id']}'",cwd=repo).strip()=='rolled_back'
    assert json.loads(compose('exec','-T','app','suivi','controle-donnees',cwd=repo))==before
    assert compose('exec','-T','-u','postgres','db','psql','-d','suivi','-Atc',"SELECT to_regclass('recette_update_temoin') IS NULL",cwd=repo).strip()=='t'
    assert compose('ps','-q','gateway').strip()==gateway
    assert {'backup','installing','verifying'}.intersection(observations) and len(observations)>5
    assert not errors, errors
    print('Échec après migration : restauration réelle PostgreSQL/secrets/documents, retour 98 vérifié, maintenance accessible en continu.')
finally:
    stop.set();thread.join(timeout=10)
    compose('stop','updater',cwd=repo)
    # Revenir à la pile originale de CI sans modifier son checkout ni sa branche.
    (repo/'.env').write_text(original_env)
    for component,image in original_images.items(): run(['docker','tag',image,IMAGE+component+':ci'])
    compose('up','-d','db','app','web','updater')
    wait_health(ROOT)
    shutil.rmtree(work)
