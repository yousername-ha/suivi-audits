#!/usr/bin/env node
/* CI, job « guide » : remplace les gestes faits dans le navigateur par le guide d'installation (docs/INSTALLATION.md),
   au moyen de l'API, sur la pile installée en suivant le guide. Sans dépendance (Node 20 ou plus).
     administrateur <url>         étape 8 : poivre, jeton d'installation, création de l'administrateur, enrôlement TOTP
     compte <url>                 étape 9 : création d'un compte « Contributeur » (mot de passe temporaire)
     import <url> <fichier.json>  étape 10 : simulation puis import (mode Initialiser) d'un fichier de l'ancien outil
     verifier <url>               étape 11.4 : après restauration, comptes et données présents
     document <url>               dépôt d'un document fictif (relu ensuite par « instantane »)
     instantane <url> <fichier> [reference]
                                  instantané des données (comptes, données de suivi, document relu, version) ; avec une
                                  référence, échoue si les données diffèrent (mises à jour, retour arrière, EXPL-01 à 04)
     systeme <url>                Administration > Système : dernière sauvegarde connue (rapport de backup.sh)
   Le certificat est vérifié : lancer avec NODE_EXTRA_CA_CERTS=<certificat racine copié à l'étape 8.3>.
   L'état (mot de passe et secret TOTP de l'administrateur de test) est conservé dans $RUNNER_TEMP. */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [cmd, base, file, reference] = process.argv.slice(2);
if (!cmd || !base) {
  console.error('Usage : guide-api.mjs administrateur|compte|import|verifier <url> [fichier]');
  process.exit(2);
}
const STATE = path.join(process.env.RUNNER_TEMP || '/tmp', 'guide-etat.json');
const ADMIN = 'rssi';
const load = () => JSON.parse(readFileSync(STATE, 'utf8'));
const save = (s) => writeFileSync(STATE, JSON.stringify(s), { mode: 0o600 });
const mask = (v) => process.env.GITHUB_ACTIONS && console.log(`::add-mask::${v}`);
/** Poivre des mots de passe de recette (ADR 0072), généré pendant la CI, jamais versionné : 52 caractères base32 sans série de
    plus de 3 caractères identiques ni suite de plus de 4 caractères consécutifs, avec la preuve de recopie (8 derniers caractères). */
const poivreDeRecette = () => {
  for (;;) {
    const bits = [...crypto.randomBytes(32)]
      .map((b) => b.toString(2).padStart(8, '0'))
      .join('')
      .padEnd(260, '0');
    let brut = '';
    for (let i = 0; i + 5 <= bits.length && brut.length < 52; i += 5) brut += B32[parseInt(bits.slice(i, i + 5), 2)];
    const codes = [...brut].map((c) => c.charCodeAt(0));
    const serie = (d) =>
      codes.some((_, i) => i >= 4 && codes.slice(i - 4, i + 1).every((c, j, a) => j === 0 || c - a[j - 1] === d));
    if (/(.)\1{3}/.test(brut) || serie(1) || serie(-1) || new Set(brut).size < 16) continue;
    mask(brut);
    return {
      mode: 'genere',
      valeur: brut.replace(/(.{4})(?=.)/g, '$1-'),
      engagement: { coffre: true, fin: brut.slice(-8) },
    };
  }
};
const fail = (msg) => {
  console.error(`::error::Guide d'installation : ${msg}`);
  process.exit(1);
};

/* ---- HTTP avec cookies (le cookie de session est __Host-, Secure) */
const jar = new Map();
let csrf = '';
async function call(method, url, { json, body, headers = {}, expect = [200, 201] } = {}) {
  const h = { origin: base, ...headers };
  // Cette recette recrée Caddy via execFileSync : l'event loop ne peut traiter la fermeture
  // d'une connexion HTTP inactive pendant l'arrêt. Ne pas réutiliser cette socket après reprise.
  if (cmd === 'lot-a') h.connection = 'close';
  if (jar.size) h.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  if (csrf && method !== 'GET') h['x-csrf-token'] = csrf;
  if (json !== undefined) h['content-type'] = 'application/json';
  const r = await fetch(base + url, { method, headers: h, body: json !== undefined ? JSON.stringify(json) : body });
  for (const c of r.headers.getSetCookie()) {
    const [kv, ...attrs] = c.split(';');
    const i = kv.indexOf('=');
    const k = kv.slice(0, i).trim();
    if (attrs.some((a) => /max-age=0/i.test(a)) || kv.slice(i + 1) === '') jar.delete(k);
    else jar.set(k, kv.slice(i + 1));
  }
  const text = await r.text();
  if (!expect.includes(r.status)) fail(`${method} ${url} : HTTP ${r.status}`);
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}
const me = async () => {
  const m = await call('GET', '/api/auth/me');
  csrf = m.csrf || '';
  return m;
};

/* ---- TOTP (RFC 6238), sans rejouer un pas déjà accepté (le serveur le refuse) */
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function b32decode(s) {
  const out = [];
  let bits = 0,
    val = 0;
  for (const ch of s.toUpperCase().replace(/[^A-Z2-7]/g, '')) {
    val = (val << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((val >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}
function totpAt(secret, step) {
  const c = Buffer.alloc(8);
  c.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac('sha1', b32decode(secret)).update(c).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1e6).padStart(6, '0');
}
async function freshCode(st) {
  for (;;) {
    const step = Math.floor(Date.now() / 30000);
    if (step > (st.lastStep || 0)) {
      st.lastStep = step;
      save(st);
      return totpAt(st.secret, step);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function login(st) {
  // Session de l'appel précédent, si elle est encore valide (évite d'attendre un nouveau pas TOTP).
  if (st.cookies) {
    for (const [k, v] of Object.entries(st.cookies)) jar.set(k, v);
    const m = await call('GET', '/api/auth/me');
    csrf = m.csrf || '';
    if (m.stage === 'ok') return;
    jar.clear();
  }
  await call('POST', '/api/auth/login', { json: { username: ADMIN, password: st.password } });
  await me();
  await call('POST', '/api/auth/mfa', { json: { code: await freshCode(st) } });
  const m = await me();
  if (m.stage !== 'ok') fail(`connexion incomplète (étape ${m.stage})`);
  st.cookies = Object.fromEntries(jar);
  save(st);
}

// Les versions publiées avant l'ADR 0042 servent l'état sous /api/legacy/state : la montée de version part de l'une d'elles.
const legacyState = async () => {
  const r = await call('GET', '/api/suivi/etat', { expect: [200, 404] });
  return r && Array.isArray(r.items) ? r : call('GET', '/api/legacy/state');
};

switch (cmd) {
  case 'administrateur': {
    const out = execFileSync('sudo', ['docker', 'compose', 'exec', '-T', 'app', 'setup-token'], { encoding: 'utf8' });
    const token = /[A-Z2-9]{5}(-[A-Z2-9]{5}){3}/.exec(out)?.[0];
    if (!token) fail('jeton introuvable dans la sortie de « docker compose exec app setup-token »');
    mask(token);
    // Règles de composition (ADR 0075) : pas plus de 3 caractères identiques à la suite, pas l'identifiant ; on retire le tirage sinon.
    let password;
    do password = `Guide-${crypto.randomBytes(12).toString('base64url')}-9a`;
    while (/(.)\1{3}/.test(password) || password.toLowerCase().includes(ADMIN.toLowerCase()));
    mask(password);
    const st = { password, secret: '', lastStep: 0 };
    const pre = await call('GET', '/api/setup');
    if (!pre.needed) fail('/api/setup indique que l’installation n’est pas attendue');
    // La montée de version part d'une version publiée avant le poivre (ADR 0072) : elle ne le propose pas.
    const avecPoivre = 'poivreDefini' in pre;
    await call('POST', '/api/setup', {
      json: {
        token: token.toLowerCase().replace(/-/g, ' '),
        username: ADMIN,
        displayName: 'Responsable SSI',
        password,
        ...(avecPoivre ? { poivre: poivreDeRecette() } : {}),
      },
    });
    if ((await me()).stage !== 'enroll') fail('après /api/setup, l’enrôlement TOTP devrait être demandé');
    const begin = await call('POST', '/api/account/totp/begin', { json: {} });
    st.secret = begin.secret;
    mask(st.secret);
    save(st);
    await call('POST', '/api/account/totp/confirm', { json: { code: await freshCode(st) } });
    const m = await me();
    if (m.stage !== 'ok' || !m.permissions?.includes('administration:administrer'))
      fail(`administrateur incomplet : ${JSON.stringify(m)}`);
    if ((await call('GET', '/api/setup')).needed) fail('/setup devrait être désactivé après la création');
    if (avecPoivre) {
      const poivre = await call('GET', '/api/admin/poivre');
      if (!poivre.defini || poivre.empreintesPoivrees < 1)
        fail(`poivre des mots de passe non défini : ${JSON.stringify(poivre)}`);
    }
    console.log(
      `Étape 8 : administrateur « rssi » créé${avecPoivre ? ', poivre défini' : ''}, double authentification active.`,
    );
    break;
  }
  case 'compte': {
    const st = load();
    await login(st);
    const r = await call('POST', '/api/admin/users', {
      json: { username: 'adjoint', displayName: 'RSSI adjoint', roles: [{ roleId: 'contributeur' }] },
    });
    if (!r.temporaryPassword) fail('mot de passe temporaire absent');
    // Ce mot de passe n’est ni utilisé ni affiché : aucune sortie, y compris une commande de masquage.
    console.log('Étape 9 : compte « adjoint » (Contributeur) créé avec un mot de passe temporaire.');
    break;
  }
  case 'import': {
    const st = load();
    await login(st);
    const buf = readFileSync(file);
    const headers = { 'content-type': 'application/octet-stream', 'x-file-name': path.basename(file) };
    const sim = await call('POST', '/api/admin/import/simulate?mode=init', { body: buf, headers });
    if (!sim.report.affected.length) fail('la simulation ne prévoit aucune modification');
    const after = await legacyState();
    if ((after.processes || []).length) fail('la simulation a écrit en base');
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    if (sim.sha256 !== sha) fail('empreinte du fichier simulé incorrecte');
    await call('POST', `/api/admin/import/apply?mode=init&sha256=${sha}`, { body: buf, headers });
    const data = await legacyState();
    const expected = JSON.parse(buf.toString('utf8'));
    for (const k of ['processes', 'suppliers']) {
      if ((data[k] || []).length !== (expected[k] || []).length)
        fail(`après import, ${k} : ${(data[k] || []).length} élément(s), ${(expected[k] || []).length} attendu(s)`);
    }
    if (data.schema !== 15) fail(`schéma ${data.schema} après import, 15 attendu`);
    st.processes = data.processes.length;
    save(st);
    console.log(
      `Étape 10 : simulation sans écriture, puis import appliqué (${sim.report.affected.length} module(s), ${st.processes} processus).`,
    );
    break;
  }
  case 'verifier': {
    const st = load();
    await login(st);
    const data = await legacyState();
    if ((data.processes || []).length !== st.processes) fail('données différentes après restauration');
    const batches = await call('GET', '/api/admin/import');
    if (!batches.length) fail('historique des imports vide après restauration');
    const users = await call('GET', '/api/admin/users');
    const names = users.map((u) => u.username);
    if (!names.includes('adjoint')) fail('compte « adjoint » absent après restauration');
    console.log('Étape 11.4 : restauration vérifiée (connexion TOTP, comptes, données et historique des imports).');
    break;
  }
  case 'document': {
    const st = load();
    await login(st);
    const contenu = Buffer.from(`Procédure fictive de test — ${new Date().toISOString()}\n`);
    const d = await call('POST', '/api/documents', {
      body: contenu,
      headers: {
        'content-type': 'application/octet-stream',
        'x-file-name': encodeURIComponent('procedure-fictive.txt'),
        'x-meta': encodeURIComponent(JSON.stringify({ title: 'Procédure fictive', refs: ['A.5.1'] })),
      },
    });
    st.document = { id: d.id, sha256: crypto.createHash('sha256').update(contenu).digest('hex') };
    save(st);
    console.log(`Document fictif déposé (${d.id}).`);
    break;
  }
  case 'instantane': {
    const st = load();
    await login(st);
    const data = await legacyState();
    const users = (await call('GET', '/api/admin/users')).map((u) => u.username).sort();
    const docs = (await call('GET', '/api/documents')).map((d) => `${d.id}:${d.current_version}`).sort();
    let docSha = null;
    if (st.document) {
      const r = await fetch(`${base}/api/documents/${st.document.id}/download`, {
        headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') },
      });
      if (!r.ok) fail(`document fictif illisible : HTTP ${r.status}`);
      docSha = crypto
        .createHash('sha256')
        .update(Buffer.from(await r.arrayBuffer()))
        .digest('hex');
      if (docSha !== st.document.sha256) fail('document fictif : contenu différent après déchiffrement');
    }
    const v = await call('GET', '/api/version', { expect: [200, 404] });
    const snap = {
      comptes: users,
      documents: docs,
      documentRelu: docSha,
      suivi: Object.fromEntries(['processes', 'suppliers', 'items'].map((k) => [k, (data[k] || []).length])),
      schema: data.schema,
    };
    writeFileSync(file, JSON.stringify({ ...snap, version: v?.version ?? null }, null, 2));
    if (reference) {
      const ref = JSON.parse(readFileSync(reference, 'utf8'));
      delete ref.version;
      if (JSON.stringify(ref) !== JSON.stringify(snap))
        fail(`données différentes de la référence :\n${JSON.stringify(ref)}\n${JSON.stringify(snap)}`);
      console.log(`Données identiques à la référence (${reference}) ; version en service : ${v?.version ?? '?'}.`);
    } else console.log(`Instantané des données : ${file}`);
    break;
  }
  case 'lot-a': {
    // Recette destructive uniquement sur le runner vierge du guide, jamais sur un serveur désigné par un utilisateur.
    if (!process.env.GITHUB_ACTIONS || process.cwd() !== '/opt/suivi-audits' || base !== 'https://localhost')
      fail('recette lot A réservée à la pile CI isolée');
    const st = load();
    const root = (args, options = {}) => execFileSync('sudo', args, { encoding: 'utf8', timeout: 240000, ...options });
    const worker = () =>
      root([
        'env',
        'BACKUP_DEST=/srv/sauvegardes/suivi-audits',
        'BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass',
        'python3',
        './scripts/exploitation-worker.py',
      ]);
    const result = async (id) => {
      const e = await call('GET', '/api/admin/exploitation');
      const job = e.jobs.find((j) => j.id === id);
      if (!job) fail('journal durable introuvable');
      console.log(
        `Opération lot A : ${JSON.stringify({ kind: job.kind, status: job.status, phase: job.phase, message: job.message })}`,
      );
      return job;
    };
    const operation = async (body) => {
      const job = await call('POST', '/api/admin/exploitation/operations', {
        json: { requestId: crypto.randomUUID(), ...body },
        expect: [202],
      });
      worker();
      return job;
    };
    root(['docker', 'compose', 'up', '-d', 'web']);
    worker();
    await login(st);
    let e = await call('GET', '/api/admin/exploitation');
    if (!e.available || !e.host?.backupReady || !e.host?.tlsManaged) {
      // Diagnostic sans clés, payloads ni contenu des fichiers : seulement erreurs de schéma/permissions.
      console.log(
        root([
          'docker',
          'compose',
          'exec',
          '-T',
          'app',
          'node',
          '--input-type=module',
          '-e',
          `import fs from 'node:fs'; import {HostState} from '@suivi/shared';
        try { const s=HostState.safeParse(JSON.parse(fs.readFileSync('/etat/exploitation/etat.json','utf8')));
          console.log(s.success ? 'Etat hôte valide' : JSON.stringify(s.error.issues.map(x=>({path:x.path,code:x.code}))));
        } catch(e) { console.log('Lecture état hôte : '+(e.code || 'format')); }`,
        ]),
      );
      fail('poller/configuration indisponible');
    }
    await call('PUT', '/api/admin/exploitation/politique', {
      json: { enabled: false, hourUtc: 23, minuteUtc: 47, days: [1, 3, 5], retentionDays: 91 },
      headers: { 'if-match': `"${e.policy.version}"` },
    });
    const before = JSON.stringify(await legacyState());
    const backup = await call('POST', '/api/admin/sauvegardes', {
      json: { requestId: crypto.randomUUID() },
      expect: [202],
    });
    worker();
    const backups = await call('GET', '/api/admin/sauvegardes');
    if (backups.jobs.find((j) => j.id === backup.id)?.status !== 'reussie') fail('sauvegarde manuelle réelle en échec');
    e = await call('GET', '/api/admin/exploitation');
    const archive = e.host.archives.find((a) => a.name === backups.jobs.find((j) => j.id === backup.id).report.fichier);
    if (!archive?.integrity) fail('catalogue réel incohérent');
    const selection = { archiveId: archive.id, sha256: archive.sha256 };
    let job = await operation({ kind: 'verify', ...selection });
    if ((await result(job.id)).status !== 'reussie') fail('vérification réelle en échec');
    job = await operation({ kind: 'restore', confirmation: 'RESTAURER', ...selection });
    // La session initiale a disparu : reconnexion obligatoire, journal hors base toujours lisible.
    await login(st);
    if ((await result(job.id)).status !== 'reussie') fail('restauration guidée réelle en échec');
    if (JSON.stringify(await legacyState()) !== before) fail('données métier modifiées par la restauration');
    e = await call('GET', '/api/admin/exploitation');
    if (e.policy.retentionDays !== 91 || e.policy.days.join(',') !== '1,3,5') fail('politique non conservée');
    console.log(
      'Lot A : demande de sauvegarde, catalogue, vérification et restauration guidée réels ; reconnexion et données conservées.',
    );

    // Archive à structure valide et dump invalide : pg_restore doit refuser, puis le retour arrière réel doit réussir.
    root([
      'bash',
      '-c',
      `set -eu
      work=$(mktemp -d)
      trap 'rm -rf "$work"' EXIT
      printf 'PGDMP-invalide-fictif' > "$work/suivi.dump"
      printf 'recette=lot-a\n' > "$work/INFO"
      tar czf "$work/secrets.tgz" -C /srv/suivi-audits/donnees/secrets .
      tar cf "$work/archive.tar" -C "$work" suivi.dump secrets.tgz INFO
      openssl enc -aes-256-cbc -pbkdf2 -iter 600000 -salt -in "$work/archive.tar" -out /srv/sauvegardes/suivi-audits/suivi-audits-recette-invalide.tar.enc -pass file:/root/.suivi-backup-pass
      cd /srv/sauvegardes/suivi-audits
      sha256sum suivi-audits-recette-invalide.tar.enc > suivi-audits-recette-invalide.tar.enc.sha256`,
    ]);
    worker();
    e = await call('GET', '/api/admin/exploitation');
    const bad = e.host.archives.find((a) => a.name === 'suivi-audits-recette-invalide.tar.enc');
    job = await operation({ kind: 'verify', archiveId: bad.id, sha256: bad.sha256 });
    if ((await result(job.id)).status !== 'reussie') fail('recette préalable de l’archive fictive inattendue');
    job = await operation({ kind: 'restore', confirmation: 'RESTAURER', archiveId: bad.id, sha256: bad.sha256 });
    await login(st);
    if ((await result(job.id)).phase !== 'retour_arriere_termine') fail('retour arrière réel non terminé');
    if (JSON.stringify(await legacyState()) !== before) fail('données différentes après retour arrière');
    console.log(
      'Lot A : archive non restaurable refusée ; sauvegarde de sécurité restaurée, santé et données vérifiées.',
    );

    const plannedBefore = (await call('GET', '/api/admin/sauvegardes')).jobs.filter(
      (j) => j.requestedBy === 'planification',
    ).length;
    const scheduleTime = new Date(Date.now() - 120000);
    e = await call('GET', '/api/admin/exploitation');
    await call('PUT', '/api/admin/exploitation/politique', {
      json: {
        enabled: true,
        hourUtc: scheduleTime.getUTCHours(),
        minuteUtc: scheduleTime.getUTCMinutes(),
        days: [1, 2, 3, 4, 5, 6, 7],
        retentionDays: 91,
      },
      headers: { 'if-match': `"${e.policy.version}"` },
    });
    worker();
    worker();
    const planned = (await call('GET', '/api/admin/sauvegardes')).jobs.filter((j) => j.requestedBy === 'planification');
    if (planned.length !== plannedBefore + 1 || planned[0].status !== 'reussie')
      fail('planification réelle : créneau perdu ou doublon');
    e = await call('GET', '/api/admin/exploitation');
    await call('PUT', '/api/admin/exploitation/politique', {
      json: { enabled: false, hourUtc: 23, minuteUtc: 47, days: [1, 3, 5], retentionDays: 91 },
      headers: { 'if-match': `"${e.policy.version}"` },
    });
    console.log('Lot A : créneau UTC réellement exécuté une fois, sans doublon au deuxième passage.');

    const envBefore = root(['cat', '.env']);
    const ca = '/srv/suivi-audits/donnees/caddy/data/caddy/pki/authorities/local/';
    const temp = root(['mktemp', '-d']).trim();
    try {
      root(
        [
          'openssl',
          'req',
          '-new',
          '-newkey',
          'rsa:2048',
          '-nodes',
          '-keyout',
          `${temp}/key.pem`,
          '-out',
          `${temp}/req.pem`,
          '-subj',
          '/CN=localhost',
        ],
        { stdio: 'ignore' },
      );
      root(['bash', '-c', `printf 'subjectAltName=DNS:localhost\nextendedKeyUsage=serverAuth\n' > '${temp}/ext'`]);
      root(
        [
          'openssl',
          'x509',
          '-req',
          '-in',
          `${temp}/req.pem`,
          '-CA',
          `${ca}root.crt`,
          '-CAkey',
          `${ca}root.key`,
          '-set_serial',
          '27001',
          '-days',
          '2',
          '-extfile',
          `${temp}/ext`,
          '-out',
          `${temp}/cert.pem`,
        ],
        { stdio: 'ignore' },
      );
      const privateKey = root(['cat', `${temp}/key.pem`]);
      const certificate = root(['cat', `${temp}/cert.pem`]) + root(['cat', `${ca}root.crt`]);
      job = await operation({ kind: 'tls_install', certificate, privateKey });
      if ((await result(job.id)).status !== 'reussie') fail('installation TLS réelle en échec');
      e = await call('GET', '/api/admin/exploitation');
      if (e.host.tlsMode !== 'web' || !e.host.certificate?.keyMatches) fail('certificat réellement servi incohérent');
      if (JSON.stringify(e).includes('PRIVATE KEY')) fail('clé privée dans état public');
      if (root(['cat', '.env']) !== envBefore) fail('.env modifié par demande TLS');

      // EKU client seul : cohérence/PEM valides, mais contrôle TLS serveur doit échouer puis restaurer le certificat antérieur.
      root([
        'bash',
        '-c',
        `printf 'subjectAltName=DNS:localhost\nextendedKeyUsage=clientAuth\n' > '${temp}/ext-client'`,
      ]);
      root(
        [
          'openssl',
          'x509',
          '-req',
          '-in',
          `${temp}/req.pem`,
          '-CA',
          `${ca}root.crt`,
          '-CAkey',
          `${ca}root.key`,
          '-set_serial',
          '27002',
          '-days',
          '2',
          '-extfile',
          `${temp}/ext-client`,
          '-out',
          `${temp}/client.pem`,
        ],
        { stdio: 'ignore' },
      );
      job = await operation({
        kind: 'tls_install',
        certificate: root(['cat', `${temp}/client.pem`]) + root(['cat', `${ca}root.crt`]),
        privateKey,
      });
      if ((await result(job.id)).phase !== 'tls_retour_arriere_termine') fail('retour arrière TLS réel non terminé');
      job = await operation({ kind: 'tls_reset', confirmation: 'REVENIR' });
      if ((await result(job.id)).status !== 'reussie') fail('retour à .env réel en échec');
      if ((await call('GET', '/api/admin/exploitation')).host.tlsMode !== 'env') fail('mode .env non rétabli');

      // D3 : autorité interne choisie depuis l'interface (aucun fichier à modifier), racine publique exposée, puis retour.
      job = await operation({ kind: 'tls_internal', confirmation: 'APPLIQUER' });
      if ((await result(job.id)).status !== 'reussie') fail('mode autorité interne réel en échec');
      e = await call('GET', '/api/admin/exploitation');
      if (e.host.tlsMode !== 'interne') fail('mode autorité interne non appliqué');
      if (e.host.racineInterne?.trim() !== root(['cat', `${ca}root.crt`]).trim())
        fail('racine interne exposée incohérente');
      if (JSON.stringify(e).includes('PRIVATE KEY')) fail('clé privée dans état public (autorité interne)');
      if (root(['cat', '.env']) !== envBefore) fail('.env modifié par la demande autorité interne');
      job = await operation({ kind: 'tls_reset', confirmation: 'REVENIR' });
      if ((await result(job.id)).status !== 'reussie')
        fail('retour au réglage de départ après autorité interne en échec');
      console.log(
        'Lot A : remplacement TLS, clé cohérente, certificat servi, retour arrière et retour à .env réels ; autorité interne choisie depuis l’interface ; aucun secret dans état public.',
      );
    } finally {
      root(['rm', '-rf', temp]);
    }
    break;
  }
  case 'systeme': {
    const st = load();
    await login(st);
    const s = await call('GET', '/api/admin/systeme');
    if (!s.sauvegarde.derniereReussie) fail('Administration > Système : aucune sauvegarde connue');
    if (s.sauvegarde.enRetard) fail('Administration > Système : sauvegarde signalée en retard');
    if (!s.donnees.chemin) fail('Administration > Système : emplacement des données absent');
    console.log(
      `Administration > Système : version ${s.version}, sauvegarde du ${s.sauvegarde.derniereReussie.date}, données dans ${s.donnees.chemin}.`,
    );
    break;
  }
  default:
    fail(`commande inconnue : ${cmd}`);
}
