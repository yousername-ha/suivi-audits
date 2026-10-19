/* Service « init » (en root, sans réseau), exécuté avant les autres services à chaque démarrage, puis arrêté.
   1. Contrôle le dossier des données du serveur (DATA_DIR, monté sur /donnees, EXPL-01) : chemin sûr, système de
      fichiers persistant, hors du dossier de l'application, préparé par scripts/preparer-donnees.sh ou
      scripts/migrer-donnees-vers-dossier.sh (fichier témoin) — refus de démarrer sinon.
   2. Crée les sous-dossiers absents avec leurs propriétaires et leurs droits :
        postgres18/    base PostgreSQL 18                    uid 70,   0700
        postgres/      ancienne base PostgreSQL 17 (si migrée, conservée intacte)   uid 70, 0700
        secrets/       secrets générés ci-dessous            root,     0711 (traversée seule : pas de listage)
        caddy/data/    certificats, autorité interne         uid 1001, 0700
        caddy/config/  configuration du frontal              uid 1001, 0700
        clamav/        signatures antivirus (facultatif)     uid 100,  0755
        etat/          rapports des scripts du serveur       root,     0755 (lecture seule pour l'application)
   3. Génère les secrets manquants, sans jamais remplacer un secret existant :
        db_superuser_password  -> postgres seul          (0400, uid 70)
        db_app_password        -> postgres + application (0440, uid 70, gid 1000)
        doc_master_key         -> application seule      (0400, uid 1000)
   Sans DONNEES (ancien déploiement à volumes nommés) : seules les étapes 3 et l'attribution des dossiers du frontal
   (CADDY_DIRS) sont faites, comme avant. */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const PG_UID = parseInt(process.env.PG_UID || '70', 10);
const APP_UID = parseInt(process.env.APP_UID || '1000', 10);
const APP_GID = parseInt(process.env.APP_GID || '1000', 10);
const WEB_UID = parseInt(process.env.WEB_UID || '1001', 10);
const CLAMAV_UID = parseInt(process.env.CLAMAV_UID || '100', 10);
const CLAMAV_GID = parseInt(process.env.CLAMAV_GID || '101', 10);

/** Fichier témoin déposé par preparer-donnees.sh ou migrer-donnees-vers-dossier.sh. */
export const MARQUEUR = '.suivi-audits-donnees';

/** Emplacements interdits pour DATA_DIR sur le serveur (système, Docker, fichiers temporaires). */
const INTERDITS = [
  '/var/lib/docker',
  '/var/lib/containerd',
  '/proc',
  '/sys',
  '/dev',
  '/run',
  '/var/run',
  '/tmp',
  '/var/tmp',
  '/boot',
  '/etc',
  '/usr',
  '/bin',
  '/sbin',
  '/lib',
  '/lib64',
];
const NON_PERSISTANTS = new Set(['tmpfs', 'ramfs', 'overlay', 'devtmpfs', 'proc', 'sysfs']);

function arret(message: string): never {
  console.error(`ERREUR (dossier des données) : ${message}`);
  process.exit(1);
}

/** Contrôle du chemin indiqué dans .env (DATA_DIR), tel qu'il existe sur le serveur. */
export function cheminRefuse(hote: string): string | null {
  if (!hote) return 'DATA_DIR est vide : renseigner DATA_DIR dans .env.';
  if (!path.isAbsolute(hote)) return `DATA_DIR doit être un chemin absolu (reçu : « ${hote} »).`;
  const n = path.posix.normalize(hote).replace(/\/+$/, '') || '/';
  if (n === '/') return 'DATA_DIR ne peut pas être la racine « / ».';
  for (const d of INTERDITS)
    if (n === d || n.startsWith(`${d}/`))
      return `DATA_DIR ne peut pas être dans ${d} (dossier système, Docker ou temporaire).`;
  return null;
}

/** Type de système de fichiers monté exactement sur `point` (null : pas un montage). */
export function typeMontage(point: string, mountinfo: string): string | null {
  for (const l of mountinfo.split('\n')) {
    const [avant, apres] = l.split(' - ');
    if (!avant || !apres) continue;
    if (avant.split(' ')[4] === point) return apres.split(' ')[0] ?? null;
  }
  return null;
}

function controlerEmplacement(donnees: string, hote: string, projet: string | undefined) {
  const refus = cheminRefuse(hote);
  if (refus) arret(refus);
  let mi: string;
  try {
    mi = fs.readFileSync('/proc/self/mountinfo', 'utf8');
  } catch {
    mi = '';
  }
  if (mi) {
    const type = typeMontage(donnees, mi);
    if (!type) arret(`${donnees} n'est pas monté depuis le serveur (vérifier docker-compose.yml).`);
    if (NON_PERSISTANTS.has(type))
      arret(
        `DATA_DIR (${hote}) est sur un système de fichiers non persistant (${type}) : choisir un disque du serveur.`,
      );
  }
  if (!fs.existsSync(path.join(donnees, MARQUEUR)))
    arret(
      `${hote} n'a pas été préparé.\n` +
        '  - Nouvelle installation : sudo ./scripts/preparer-donnees.sh\n' +
        '  - Serveur déjà installé (données dans des volumes Docker) : sudo ./scripts/migrer-donnees-vers-dossier.sh\n' +
        'Voir docs/INSTALLATION.md, étapes 6.5 et 12.4.',
    );
  // DATA_DIR dans le dossier de l'application ? Une sonde écrite dans DATA_DIR ne doit apparaître nulle part sous
  // le dossier de l'application (monté sur `projet`), quel que soit le chemin relatif.
  if (projet && fs.existsSync(projet)) {
    const sonde = `.sonde-${crypto.randomBytes(6).toString('hex')}`;
    fs.writeFileSync(path.join(donnees, sonde), '');
    try {
      const parts = path.posix.normalize(hote).split('/').filter(Boolean);
      for (let i = 0; i <= parts.length; i++)
        if (fs.existsSync(path.join(projet, ...parts.slice(i), sonde)))
          arret(
            `DATA_DIR (${hote}) est dans le dossier de l'application : choisir un dossier à part, par exemple /srv/suivi-audits/donnees.`,
          );
    } finally {
      fs.rmSync(path.join(donnees, sonde), { force: true });
    }
  }
}

/** Vrai si une ancienne base PostgreSQL 17 (postgres/) existe sans que la base 18 (postgres18/) ait été créée par la migration
    (scripts/lib-commun.sh) : démarrer alors PostgreSQL 18 créerait une base vide à côté des données (ADR 0035). La migration
    pose elle-même le témoin postgres18/.migration-en-cours le temps de son exécution. */
export function migrationPostgresqlRequise(donnees: string): boolean {
  const ancienne = fs.existsSync(path.join(donnees, 'postgres', 'PG_VERSION'));
  const nouvelle = fs.existsSync(path.join(donnees, 'postgres18', '18', 'docker', 'PG_VERSION'));
  const enCours = fs.existsSync(path.join(donnees, 'postgres18', '.migration-en-cours'));
  return ancienne && !nouvelle && !enCours;
}

function dossier(p: string, uid: number, gid: number, mode: number) {
  fs.mkdirSync(p, { recursive: true });
  fs.lchownSync(p, uid, gid);
  fs.chmodSync(p, mode);
}

// lchown ne suit pas les liens symboliques ; le parcours n'utilise que les types renvoyés par readdir.
function attribuer(dir: string, uid: number): number {
  let n = 1;
  fs.lchownSync(dir, uid, uid);
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) n += attribuer(p, uid);
    else {
      fs.lchownSync(p, uid, uid);
      n++;
    }
  }
  return n;
}

function genererSecrets(dir: string): number {
  const SECRETS = [
    {
      name: 'db_superuser_password',
      gen: () => crypto.randomBytes(32).toString('base64url'),
      uid: PG_UID,
      gid: PG_UID,
      mode: 0o400,
    },
    {
      name: 'db_app_password',
      gen: () => crypto.randomBytes(32).toString('base64url'),
      uid: PG_UID,
      gid: APP_GID,
      mode: 0o440,
    },
    {
      name: 'doc_master_key',
      gen: () => crypto.randomBytes(32).toString('base64'),
      uid: APP_UID,
      gid: APP_GID,
      mode: 0o400,
    },
  ];
  fs.mkdirSync(dir, { recursive: true });
  fs.chmodSync(dir, 0o711);
  let created = 0;
  for (const s of SECRETS) {
    const f = path.join(dir, s.name);
    try {
      // « wx » : création exclusive, un secret existant n'est jamais remplacé.
      fs.writeFileSync(f, s.gen() + '\n', { mode: 0o400, flag: 'wx' });
      created++;
      console.log(`secret créé : ${s.name}`);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
    fs.chownSync(f, s.uid, s.gid);
    fs.chmodSync(f, s.mode);
  }
  return created;
}

/** Création exclusive ; les droits sont appliqués au descripteur, jamais à un chemin recontrôlé. */
export function genererCleMiseAJour(file: string, owner = 0) {
  let fd: number;
  let created = false;
  try {
    fd = fs.openSync(
      file,
      fs.constants.O_WRONLY | fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_NOFOLLOW,
      0o600,
    );
    created = true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  }
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1 || (!created && stat.size === 0))
      throw new Error('Clé de sauvegarde des mises à jour invalide.');
    if (created) {
      fs.writeFileSync(fd, crypto.randomBytes(48).toString('base64') + '\n');
      fs.fsyncSync(fd);
    }
    fs.fchownSync(fd, owner, owner);
    fs.fchmodSync(fd, 0o600);
  } finally {
    fs.closeSync(fd);
  }
}

function main() {
  const donnees = process.env.DONNEES;
  let secretsDir = process.env.SECRETS_DIR || '/secrets';
  let caddyDirs = (process.env.CADDY_DIRS || '').split(',').filter(Boolean);
  if (donnees) {
    const hote = process.env.DATA_DIR_HOTE || '';
    controlerEmplacement(donnees, hote, process.env.PROJET);
    const pg = path.join(donnees, 'postgres18');
    const neuf = !fs.existsSync(pg) || fs.readdirSync(pg).length === 0;
    dossier(pg, PG_UID, PG_UID, 0o700);
    // Ancienne base PostgreSQL 17 : jamais créée, seulement protégée si elle existe (retour arrière possible).
    const ancien = path.join(donnees, 'postgres');
    if (fs.existsSync(ancien)) dossier(ancien, PG_UID, PG_UID, 0o700);
    if (migrationPostgresqlRequise(donnees))
      arret(
        "une base PostgreSQL 17 existe (DATA_DIR/postgres) et n'a pas encore été migrée vers PostgreSQL 18 : démarrer avec « docker compose up » " +
          'créerait une base vide à côté de vos données (qui restent intactes). Lancer la mise à jour avec le script, qui migre la base ' +
          'avec sauvegarde et retour arrière : sudo ./scripts/mettre-a-jour.sh (docs/INSTALLATION.md, section 12).',
      );
    dossier(path.join(donnees, 'secrets'), 0, 0, 0o711);
    dossier(path.join(donnees, 'caddy'), 0, 0, 0o755);
    dossier(path.join(donnees, 'clamav'), CLAMAV_UID, CLAMAV_GID, 0o755);
    dossier(path.join(donnees, 'etat'), 0, 0, 0o755);
    dossier(path.join(donnees, 'etat', 'updates'), 0, 0, 0o755);
    const updateSecrets = path.join(donnees, 'update-secrets');
    dossier(updateSecrets, 0, 0, 0o700);
    const updateKey = path.join(updateSecrets, 'backup-pass');
    genererCleMiseAJour(updateKey);
    dossier(path.join(donnees, 'etat', 'mises-a-jour'), 0, 0, 0o755);
    dossier(path.join(donnees, 'etat', 'sauvegardes'), 0, 0, 0o755);
    const tlsDir = path.join(donnees, 'secrets', 'tls-web');
    dossier(tlsDir, WEB_UID, WEB_UID, 0o700);
    for (const e of fs.readdirSync(tlsDir, { withFileTypes: true })) {
      if (e.isFile() && ['cert.pem', 'key.pem', 'mode'].includes(e.name)) {
        fs.chownSync(path.join(tlsDir, e.name), WEB_UID, WEB_UID);
        fs.chmodSync(path.join(tlsDir, e.name), 0o400);
      }
    }
    secretsDir = path.join(donnees, 'secrets');
    caddyDirs = [path.join(donnees, 'caddy', 'data'), path.join(donnees, 'caddy', 'config')];
    for (const d of caddyDirs) dossier(d, WEB_UID, WEB_UID, 0o700);
    console.log(`données : ${hote}${neuf ? ' (nouvelle base)' : ''}`);
  }
  const created = genererSecrets(secretsDir);
  let fixed = 0;
  for (const d of caddyDirs) {
    try {
      fixed += attribuer(d, WEB_UID);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  }
  if (fixed) console.log(`frontal web : ${fixed} fichier(s) attribué(s) à l'uid ${WEB_UID}.`);
  console.log(
    created
      ? `${created} secret(s) généré(s). Ils sont inclus dans les sauvegardes (scripts/backup.sh).`
      : 'Secrets déjà présents, rien à faire.',
  );
}

if (process.argv[1] && /init-secrets\.(js|ts)$/.test(process.argv[1])) main();
