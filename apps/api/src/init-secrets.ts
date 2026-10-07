/* Premier démarrage : génère les secrets manquants dans le volume « secrets ».
   Exécuté par le service « init » (en root, sans réseau), puis s'arrête. Ne remplace jamais un secret existant.
   Droits minimaux par consommateur :
     db_superuser_password  -> postgres seul          (0400, uid 70)
     db_app_password        -> postgres + application (0440, uid 70, gid 1000)
     doc_master_key         -> application seule      (0400, uid 1000) */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DIR = process.env.SECRETS_DIR || '/secrets';
const PG_UID = parseInt(process.env.PG_UID || '70', 10);
const APP_UID = parseInt(process.env.APP_UID || '1000', 10);
const APP_GID = parseInt(process.env.APP_GID || '1000', 10);

const SECRETS = [
  { name: 'db_superuser_password', gen: () => crypto.randomBytes(32).toString('base64url'), uid: PG_UID, gid: PG_UID, mode: 0o400 },
  { name: 'db_app_password', gen: () => crypto.randomBytes(32).toString('base64url'), uid: PG_UID, gid: APP_GID, mode: 0o440 },
  { name: 'doc_master_key', gen: () => crypto.randomBytes(32).toString('base64'), uid: APP_UID, gid: APP_GID, mode: 0o400 },
];

fs.mkdirSync(DIR, { recursive: true });
fs.chmodSync(DIR, 0o711);
let created = 0;
for (const s of SECRETS) {
  const f = path.join(DIR, s.name);
  if (!fs.existsSync(f)) {
    fs.writeFileSync(f, s.gen() + '\n', { mode: 0o400, flag: 'wx' });
    created++;
    console.log(`secret créé : ${s.name}`);
  }
  fs.chownSync(f, s.uid, s.gid);
  fs.chmodSync(f, s.mode);
}
console.log(
  created
    ? `${created} secret(s) généré(s). Pensez à les inclure dans vos sauvegardes (scripts/backup.sh).`
    : 'Secrets déjà présents, rien à faire.',
);
