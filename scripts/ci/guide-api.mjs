#!/usr/bin/env node
/* CI, job « guide » : remplace les gestes faits dans le navigateur par le guide d'installation (docs/INSTALLATION.md),
   au moyen de l'API, sur la pile installée en suivant le guide. Sans dépendance (Node 20 ou plus).
     administrateur <url>         étape 8 : jeton d'installation, création de l'administrateur, enrôlement TOTP
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
const fail = (msg) => {
  console.error(`::error::Guide d'installation : ${msg}`);
  process.exit(1);
};

/* ---- HTTP avec cookies (le cookie de session est __Host-, Secure) */
const jar = new Map();
let csrf = '';
async function call(method, url, { json, body, headers = {}, expect = [200, 201] } = {}) {
  const h = { origin: base, ...headers };
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

const legacyState = () => call('GET', '/api/legacy/state');

switch (cmd) {
  case 'administrateur': {
    const out = execFileSync('sudo', ['docker', 'compose', 'exec', '-T', 'app', 'setup-token'], { encoding: 'utf8' });
    const token = /[A-Z2-9]{5}(-[A-Z2-9]{5}){3}/.exec(out)?.[0];
    if (!token) fail('jeton introuvable dans la sortie de « docker compose exec app setup-token »');
    mask(token);
    const password = `Guide-${crypto.randomBytes(12).toString('base64url')}-9a`;
    mask(password);
    const st = { password, secret: '', lastStep: 0 };
    const pre = await call('GET', '/api/setup');
    if (!pre.needed) fail('/api/setup indique que l’installation n’est pas attendue');
    await call('POST', '/api/setup', {
      json: {
        token: token.toLowerCase().replace(/-/g, ' '),
        username: ADMIN,
        displayName: 'Responsable SSI',
        password,
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
    console.log('Étape 8 : administrateur « rssi » créé, double authentification active.');
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
    if ((after.findings || []).length) fail('la simulation a écrit en base');
    const sha = crypto.createHash('sha256').update(buf).digest('hex');
    if (sim.sha256 !== sha) fail('empreinte du fichier simulé incorrecte');
    await call('POST', `/api/admin/import/apply?mode=init&sha256=${sha}`, { body: buf, headers });
    const data = await legacyState();
    const expected = JSON.parse(buf.toString('utf8'));
    for (const k of ['findings', 'processes', 'suppliers']) {
      if ((data[k] || []).length !== (expected[k] || []).length)
        fail(`après import, ${k} : ${(data[k] || []).length} élément(s), ${(expected[k] || []).length} attendu(s)`);
    }
    if (data.schema !== 15) fail(`schéma ${data.schema} après import, 15 attendu`);
    st.findings = data.findings.length;
    save(st);
    console.log(
      `Étape 10 : simulation sans écriture, puis import appliqué (${sim.report.affected.length} module(s), ${st.findings} écart(s)).`,
    );
    break;
  }
  case 'verifier': {
    const st = load();
    await login(st);
    const data = await legacyState();
    if ((data.findings || []).length !== st.findings) fail('données différentes après restauration');
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
      suivi: Object.fromEntries(
        ['findings', 'processes', 'suppliers', 'items'].map((k) => [k, (data[k] || []).length]),
      ),
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
