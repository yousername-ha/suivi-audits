/* Porte d'évaluation de la refonte « Verre » (branche refonte-verre seulement, décision du RSSI du 26/11/2026).
   Pile jetable sur le poste (docker-compose.verre.yml) : aucune page de connexion, pour juger la refonte graphique.

   Au premier démarrage, sur une base vide : compte administrateur fictif créé par la commande « recette-locale »
   (route d'installation normale), jeu de démonstration chargé, style d'instance réglé sur « Verre ». Ensuite, un relais
   HTTP local placé devant l'interface (Vite) ajoute à chaque requête le témoin d'une session déjà ouverte pour ce compte.
   L'application n'est pas modifiée : la session est une ligne ordinaire de la table « sessions », comme celle du jeu de
   test. Garde-fous : refus si l'adresse du site n'est pas « localhost », refus si un autre administrateur existe déjà,
   relais publié sur 127.0.0.1 seulement. Ne jamais reporter ce fichier ni docker-compose.verre.yml hors de refonte-verre. */
import crypto from 'node:crypto';
import http from 'node:http';
import net from 'node:net';
import { buildApp } from '../../apps/api/src/app.js';
import { loadConfig } from '../../apps/api/src/config.js';
import { chargerJeuDeTest } from '../../apps/api/src/jeu-de-test.js';
import { createLogger } from '../../apps/api/src/log.js';
import { COMPTE_RECETTE, installerRecetteLocale } from '../../apps/api/src/recette-locale.js';
import { createServices } from '../../apps/api/src/services.js';

const API = process.env.EVALUATION_API || 'http://api:8080';
const WEB = new URL(process.env.EVALUATION_WEB || 'http://web:5173');
const PORT = Number(process.env.EVALUATION_PORT || 5173);

const cfg = loadConfig();
const publique = new URL(cfg.publicUrl);
if (publique.hostname !== 'localhost') {
  console.error('Porte d’évaluation refusée : l’adresse du site (PUBLIC_URL) doit être « localhost ».');
  process.exit(1);
}
if (cfg.cookieSecure !== 'false') {
  console.error('Porte d’évaluation refusée : COOKIE_SECURE doit valoir « false » (pile locale en HTTP).');
  process.exit(1);
}
const svc = createServices(cfg, createLogger('warn'));
const attendre = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** L'API répond : elle n'écoute qu'une fois ses migrations appliquées. Sonde publique « /healthz » : « /api/health/ready »
    ne répond qu'aux appels du conteneur lui-même (404 depuis la porte, qui tourne dans un autre conteneur). */
async function attendreApi() {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(`${API}/healthz`);
      if (r.ok) return;
    } catch {
      /* API pas encore démarrée */
    }
    if (i % 15 === 0) console.log('Porte d’évaluation : attente de l’API…');
    await attendre(2000);
  }
}

async function compteRecette(): Promise<{ id: string } | undefined> {
  const r = await svc.db.pool.query<{ id: string }>(
    'SELECT id FROM users WHERE lower(username) = $1 AND NOT disabled',
    [COMPTE_RECETTE],
  );
  return r.rows[0];
}

/* ---------------------------------------------------------------- Session du compte d'évaluation */
let jeton = '';
let verifieLe = 0;

const empreinte = (t: string) => crypto.createHash('sha256').update(t).digest();

async function ouvrirSession(userId: string) {
  const t = crypto.randomBytes(32).toString('base64url');
  await svc.db.pool.query(
    `INSERT INTO sessions (id_hash, user_id, csrf, mfa_ok, reauth_at, ip, user_agent, expires_at)
     VALUES ($1, $2, $3, true, now(), '127.0.0.1', 'porte-evaluation-verre', now() + interval '30 days')`,
    [empreinte(t), userId, crypto.randomBytes(24).toString('base64url')],
  );
  jeton = t;
}

/** Session valide, entretenue (dernière activité rafraîchie), rouverte si elle a disparu ou expire bientôt. */
async function sessionCourante(): Promise<string> {
  if (jeton && Date.now() - verifieLe < 5e3) return jeton;
  const u = await compteRecette();
  if (!u) throw new Error('Compte d’évaluation introuvable.');
  const r = jeton
    ? await svc.db.pool.query(
        `UPDATE sessions SET last_seen_at = now() WHERE id_hash = $1 AND expires_at > now() + interval '1 hour'`,
        [empreinte(jeton)],
      )
    : null;
  if (r?.rowCount !== 1) await ouvrirSession(u.id);
  verifieLe = Date.now();
  return jeton;
}

/* ---------------------------------------------------------------- Préparation de l'instance */
async function regleStyleVerre() {
  const t = await sessionCourante();
  const entetes = { host: publique.host, cookie: `suivi_sid=${t}` };
  const lu = await fetch(`${API}/api/settings/apparence`, { headers: entetes });
  if (!lu.ok) throw new Error(`Lecture de l’apparence : ${lu.status}`);
  const section = (await lu.json()) as { values: Record<string, unknown> };
  if (section.values.style === 'verre') return;
  const me = (await (await fetch(`${API}/api/auth/me`, { headers: entetes })).json()) as { csrf: string };
  const ecrit = await fetch(`${API}/api/settings/apparence`, {
    method: 'PUT',
    headers: {
      ...entetes,
      origin: publique.origin,
      'content-type': 'application/json',
      'x-csrf-token': me.csrf,
      'if-match': lu.headers.get('etag') || '',
    },
    body: JSON.stringify({ ...section.values, style: 'verre' }),
  });
  if (!ecrit.ok) throw new Error(`Style « Verre » : ${ecrit.status} ${await ecrit.text()}`);
}

async function preparer() {
  await attendreApi();
  if (!(await svc.auth.adminExists())) {
    console.log(
      'Porte d’évaluation : création du compte fictif et chargement du jeu de démonstration (quelques minutes)…',
    );
    const app = await buildApp(svc);
    await app.ready();
    try {
      await installerRecetteLocale(svc, app);
      const bilan = await chargerJeuDeTest(svc, app, COMPTE_RECETTE, { publicUrl: cfg.publicUrl });
      console.log(`Porte d’évaluation : jeu de démonstration ${bilan.etat === 'non' ? 'non chargé' : 'chargé'}.`);
    } finally {
      await app.close();
    }
  } else if (!(await compteRecette())) {
    console.error(
      'Porte d’évaluation refusée : un administrateur existe déjà et ce n’est pas le compte d’évaluation. ' +
        'Utilisez une pile vierge (dossier .donnees-verre supprimé).',
    );
    process.exit(1);
  }
  await regleStyleVerre();
}

/* ---------------------------------------------------------------- Relais vers l'interface */
/** Remplace le témoin de session du navigateur par celui de la session d'évaluation. */
function avecTemoin(cookie: string | string[] | undefined, t: string) {
  const autres = (Array.isArray(cookie) ? cookie.join('; ') : cookie || '')
    .split(';')
    .map((c) => c.trim())
    .filter((c) => c && !/^(__Host-)?suivi_sid=/.test(c));
  return [...autres, `suivi_sid=${t}`].join('; ');
}

function relais() {
  const serveur = http.createServer(async (req, res) => {
    // La déconnexion fermerait la session d'évaluation : elle est simplement acquittée.
    if (req.method === 'POST' && req.url?.split('?')[0] === '/api/auth/logout') {
      res.writeHead(204).end();
      return;
    }
    let t: string;
    try {
      t = await sessionCourante();
    } catch (e) {
      res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' }).end((e as Error).message);
      return;
    }
    const amont = http.request(
      {
        host: WEB.hostname,
        port: WEB.port,
        method: req.method,
        path: req.url,
        headers: { ...req.headers, cookie: avecTemoin(req.headers.cookie, t) },
      },
      (r) => {
        // Session refusée par l'API (fermée entre deux vérifications) : rouverte à la requête suivante.
        if (r.statusCode === 401) verifieLe = 0;
        res.writeHead(r.statusCode || 502, r.headers);
        r.pipe(res);
      },
    );
    amont.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Interface pas encore prête : rechargez dans quelques secondes.');
    });
    req.pipe(amont);
  });
  // Rechargement à chaud de Vite (WebSocket) : connexion relayée telle quelle.
  serveur.on('upgrade', (req, socket, tete) => {
    const amont = net.connect(Number(WEB.port), WEB.hostname, () => {
      const lignes = [`${req.method} ${req.url} HTTP/${req.httpVersion}`];
      for (let i = 0; i < req.rawHeaders.length; i += 2) lignes.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}`);
      amont.write(lignes.join('\r\n') + '\r\n\r\n');
      if (tete.length) amont.write(tete);
      amont.pipe(socket).pipe(amont);
    });
    amont.on('error', () => socket.destroy());
    socket.on('error', () => amont.destroy());
  });
  serveur.listen(PORT, '0.0.0.0', () =>
    console.log(
      `\n${'='.repeat(72)}\n  REFONTE « VERRE » PRÊTE : ouvrir ${publique.origin}\n` +
        `  Sans connexion (compte fictif « ${COMPTE_RECETTE} », administrateur, jeu de démonstration).\n${'='.repeat(72)}\n`,
    ),
  );
}

await preparer();
relais();
