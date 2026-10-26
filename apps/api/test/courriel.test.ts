/* Courriel (décision 1, ADR 0049) : configuration SMTP/SMTPS, mot de passe scellé, file de demandes traitées par l'exécutant du
   serveur (réclamation par la CLI, rapport sans secret) et script d'envoi réel (scripts/courriel-envoi.py) contre un faux serveur
   SMTP local : TLS implicite, STARTTLS, serveur sans STARTTLS, mauvais mot de passe, port fermé. Aucun serveur réel n'est contacté. */
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, lecteur: Agent, dir: string, cert: Buffer, key: Buffer;
const MOT_DE_PASSE = 'Secret-SMTP-à-ne-jamais-voir-42';

interface Faux {
  port: number;
  messages: string[];
  commandes: string[];
  close: () => Promise<void>;
}
/** Faux serveur SMTP : `mode` = smtps (TLS implicite), starttls, ou clair sans STARTTLS ; compte attendu : compte / MOT_DE_PASSE. */
async function fauxServeur(mode: 'smtps' | 'starttls' | 'clair'): Promise<Faux> {
  const messages: string[] = [];
  const commandes: string[] = [];
  function session(socket: net.Socket) {
    let sortie: (s: string) => void = (s) => socket.write(s);
    let tampon = '';
    let enData = false;
    let corps = '';
    let securise = mode === 'smtps';
    let enveloppe = false; // après STARTTLS, le socket brut ne porte plus que du chiffré : on l'ignore
    const dire = (s: string) => sortie(s + '\r\n');
    const traiter = (ligne: string) => {
      if (enData) {
        if (ligne === '.') {
          enData = false;
          messages.push(corps);
          return dire('250 2.0.0 accepté');
        }
        corps += ligne.replace(/^\.\./, '.') + '\n';
        return;
      }
      const cmd = ligne.toUpperCase();
      commandes.push(cmd.startsWith('AUTH') ? 'AUTH ***' : ligne);
      if (cmd.startsWith('EHLO')) {
        dire('250-faux.local');
        if (mode === 'starttls' && !securise) dire('250-STARTTLS');
        if (securise || mode === 'clair') dire('250-AUTH PLAIN LOGIN');
        return dire('250 8BITMIME');
      }
      if (cmd === 'STARTTLS') {
        dire('220 prêt');
        const chiffre = new tls.TLSSocket(socket, { isServer: true, cert, key });
        securise = true;
        enveloppe = true;
        sortie = (s) => chiffre.write(s);
        chiffre.on('data', (d) => lire(d.toString('utf8')));
        chiffre.on('error', () => undefined);
        return;
      }
      if (cmd.startsWith('AUTH PLAIN')) {
        const [, user, pass] = Buffer.from(ligne.slice(11), 'base64').toString('utf8').split('\0');
        return user === 'compte' && pass === MOT_DE_PASSE
          ? dire('235 2.7.0 ok')
          : dire('535 5.7.8 identifiants refusés');
      }
      if (cmd.startsWith('MAIL FROM') || cmd.startsWith('RCPT TO')) return dire('250 ok');
      if (cmd === 'DATA') {
        enData = true;
        corps = '';
        return dire('354 go');
      }
      if (cmd === 'QUIT') return dire('221 bye');
      dire('502 inconnu');
    };
    function lire(morceau: string) {
      tampon += morceau;
      let i;
      while ((i = tampon.indexOf('\r\n')) >= 0) {
        const ligne = tampon.slice(0, i);
        tampon = tampon.slice(i + 2);
        traiter(ligne);
      }
    }
    dire('220 faux.local ESMTP');
    socket.on('data', (d) => {
      if (!enveloppe) lire(d.toString('utf8'));
    });
    socket.on('error', () => undefined);
  }
  const serveur = (
    mode === 'smtps' ? tls.createServer({ cert, key }, session) : net.createServer(session)
  ) as net.Server;
  await new Promise<void>((r) => serveur.listen(0, '127.0.0.1', r));
  return {
    port: (serveur.address() as net.AddressInfo).port,
    messages,
    commandes,
    close: () => new Promise((r) => serveur.close(() => r())),
  };
}

const regler = async (v: Record<string, unknown>) => {
  const g = await admin.get('/api/settings/courriel');
  const r = await admin.put(
    '/api/settings/courriel',
    { ...g.json().values, ...v },
    { 'if-match': g.headers.etag as string },
  );
  expect(r.statusCode, r.body).toBe(200);
};
const SCRIPT = path.resolve(__dirname, '../../../scripts/courriel-envoi.py');
/** Exécute le script d'envoi comme le fait l'exécutant, avec la demande réclamée pour entrée (asynchrone : le faux serveur
    tourne dans ce même processus et doit pouvoir répondre pendant l'envoi). */
const lancer = (job: Record<string, unknown>) =>
  new Promise<{ status: number | null; stdout: string; stderr: string }>((resolve) => {
    const enfant = spawn('python3', ['-I', SCRIPT]);
    let stdout = '',
      stderr = '';
    enfant.stdout.on('data', (d) => (stdout += d));
    enfant.stderr.on('data', (d) => (stderr += d));
    enfant.on('close', (status) => resolve({ status, stdout, stderr }));
    enfant.stdin.end(JSON.stringify(job));
  });
const envoyer = async (job: Record<string, unknown>) => {
  const r = await lancer(job);
  expect(r.status, r.stderr).toBe(0);
  return JSON.parse(r.stdout) as { ok: boolean; steps: { step: string; detail: string }[]; error: string | null };
};
const base = (port: number, extra: Record<string, unknown> = {}) => ({
  host: 'localhost',
  port,
  security: 'smtps',
  username: 'compte',
  password: MOT_DE_PASSE,
  from: 'suivi@exemple.test',
  to: 'technique@exemple.test',
  ca: cert.toString('utf8'),
  requested_by: 'recette',
  ...extra,
});

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), 'smtp-'));
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-days',
      '2',
      '-keyout',
      path.join(dir, 'k.pem'),
      '-out',
      path.join(dir, 'c.pem'),
      '-subj',
      '/CN=localhost',
      '-addext',
      'subjectAltName=DNS:localhost,IP:127.0.0.1',
    ],
    { stdio: 'ignore' },
  );
  cert = readFileSync(path.join(dir, 'c.pem'));
  key = readFileSync(path.join(dir, 'k.pem'));
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'mail_admin', 'admin'));
  lecteur = await login(t, await makeUser(t, 'mail_ro', 'ro'));
});
afterAll(async () => {
  await t.close();
  rmSync(dir, { recursive: true, force: true });
});

describe('configuration et file de demandes', () => {
  beforeEach(() => t.svc.limits.courrielTest.reset());

  it('par défaut : envoi désactivé, aucun mot de passe, test refusé', async () => {
    const g = (await admin.get('/api/settings/courriel')).json();
    expect(g.values).toMatchObject({
      actif: false,
      hote: '',
      port: 587,
      securite: 'starttls',
      autoriteCertification: '',
    });
    expect(g.info.motDePasseDefini).toBe(false);
    expect((await admin.post('/api/settings/courriel/test')).statusCode).toBe(409);
  });

  it('droits : réservé à l’administration des paramètres, mot de passe jamais relu ni journalisé', async () => {
    expect((await lecteur.put('/api/settings/courriel/mot-de-passe', { password: 'x' })).statusCode).toBe(403);
    expect((await lecteur.post('/api/settings/courriel/test')).statusCode).toBe(403);
    expect((await admin.put('/api/settings/courriel/mot-de-passe', { password: MOT_DE_PASSE })).statusCode).toBe(204);
    const g = await admin.get('/api/settings/courriel');
    expect(g.json().info.motDePasseDefini).toBe(true);
    expect(g.body).not.toContain(MOT_DE_PASSE);
    const stocke = await t.svc.db.q<{ value: unknown }>("SELECT value FROM settings WHERE key = 'secret:courriel'");
    expect(JSON.stringify(stocke.rows[0]!.value)).not.toContain(MOT_DE_PASSE);
    const journal = await t.svc.db.q<{ details: unknown }>(
      "SELECT details FROM audit_log WHERE action LIKE 'courriel.%'",
    );
    expect(JSON.stringify(journal.rows)).not.toContain(MOT_DE_PASSE);
  });

  it('valide la configuration : hôte, port, adresses, chiffrement obligatoire, autorité de certification', async () => {
    const g = await admin.get('/api/settings/courriel');
    const essai = (x: Record<string, unknown>) =>
      admin.put('/api/settings/courriel', { ...g.json().values, ...x }, { 'if-match': g.headers.etag as string });
    expect((await essai({ port: 0 })).statusCode).toBe(422);
    expect((await essai({ hote: 'a b' })).statusCode).toBe(422);
    expect((await essai({ expediteur: 'pas-une-adresse' })).statusCode).toBe(422);
    expect((await essai({ securite: 'aucune' })).statusCode).toBe(422);
    expect((await essai({ autoriteCertification: 'pas un certificat' })).statusCode).toBe(422);
    expect((await essai({ autoriteCertification: cert.toString('utf8') })).statusCode).toBe(200);
  });

  it('met la demande en file seulement si l’exécutant est disponible, puis la réclame avec le mot de passe et la clôt sans secret', async () => {
    await regler({
      actif: true,
      hote: 'smtp.exemple.test',
      port: 465,
      securite: 'smtps',
      utilisateur: 'compte',
      expediteur: 'suivi@exemple.test',
      contactTechnique: 'technique@exemple.test',
    });
    await t.svc.db.q('DELETE FROM backup_worker');
    const sans = await admin.post('/api/settings/courriel/test');
    expect(sans.statusCode).toBe(503);
    expect(sans.json().error).toContain('exécutant');

    await t.svc.backups.heartbeat(true);
    const demande = await admin.post('/api/settings/courriel/test');
    expect(demande.statusCode, demande.body).toBe(202);
    expect(demande.json()).toMatchObject({ status: 'en_attente', to: 'technique@exemple.test', steps: [] });
    expect(JSON.stringify(demande.json())).not.toContain(MOT_DE_PASSE);
    // Une seule demande à la fois.
    expect((await admin.post('/api/settings/courriel/test')).statusCode).toBe(409);

    const reclame = await t.svc.courriel.reclamer((await t.svc.settings.read('courriel')).values as never);
    expect(reclame).toMatchObject({
      host: 'smtp.exemple.test',
      port: 465,
      security: 'smtps',
      username: 'compte',
      to: 'technique@exemple.test',
    });
    expect((reclame as { password: string }).password).toBe(MOT_DE_PASSE);
    expect(await t.svc.courriel.reclamer((await t.svc.settings.read('courriel')).values as never)).toBeNull();
    const id = (reclame as { id: string }).id;
    expect((await admin.get(`/api/settings/courriel/test/${id}`)).json().status).toBe('en_cours');

    await t.svc.courriel.terminer(id, {
      ok: false,
      steps: [{ step: 'Connexion', ok: false, detail: 'refusée' }],
      error: 'Connexion refusée.',
    });
    const fin = (await admin.get(`/api/settings/courriel/test/${id}`)).json();
    expect(fin).toMatchObject({ status: 'echec', error: 'Connexion refusée.' });
    expect(fin.steps).toHaveLength(1);
    await expect(t.svc.courriel.terminer(id, { ok: true, steps: [], error: null })).rejects.toThrow();
    expect(JSON.stringify(fin)).not.toContain(MOT_DE_PASSE);
    expect((await admin.get('/api/settings/courriel/test')).json().id).toBe(id);
    const journal = await t.svc.db.q<{ details: unknown }>(
      "SELECT details FROM audit_log WHERE action LIKE 'courriel.test%'",
    );
    expect(JSON.stringify(journal.rows)).not.toContain(MOT_DE_PASSE);
  });

  it('refuse un rapport mal formé ou chargé de champs inattendus', async () => {
    await t.svc.backups.heartbeat(true);
    const d = (await admin.post('/api/settings/courriel/test')).json();
    await t.svc.courriel.reclamer((await t.svc.settings.read('courriel')).values as never);
    await expect(t.svc.courriel.terminer(d.id, { ok: true, steps: [], error: null, password: 'x' })).rejects.toThrow();
    await t.svc.courriel.terminer(d.id, { ok: true, steps: [], error: null });
  });

  it('limite les essais de test pour qu’un compte ne serve pas de relais', async () => {
    for (let i = 0; i < 5; i++) await admin.post('/api/settings/courriel/test');
    expect((await admin.post('/api/settings/courriel/test')).statusCode).toBe(429);
  });
});

describe('script d’envoi (scripts/courriel-envoi.py)', () => {
  it('envoie en TLS implicite (SMTPS) avec authentification, vers le destinataire demandé', async () => {
    const f = await fauxServeur('smtps');
    try {
      const r = await envoyer(base(f.port));
      expect(r.ok, JSON.stringify(r)).toBe(true);
      expect(r.steps.map((s) => s.step)).toEqual([
        'Connexion',
        'Chiffrement',
        'Accueil du serveur',
        'Authentification',
        'Message accepté',
      ]);
      expect(f.messages).toHaveLength(1);
      expect(f.messages[0]).toContain('To: technique@exemple.test');
      expect(JSON.stringify(r)).not.toContain(MOT_DE_PASSE);
    } finally {
      await f.close();
    }
  });

  it('envoie en STARTTLS, et refuse un serveur qui ne le propose pas plutôt que d’écrire en clair', async () => {
    const f = await fauxServeur('starttls');
    try {
      const r = await envoyer(base(f.port, { security: 'starttls' }));
      expect(r.ok, JSON.stringify(r)).toBe(true);
      expect(r.steps.find((s) => s.step === 'Chiffrement')!.detail).toContain('STARTTLS');
    } finally {
      await f.close();
    }
    const clair = await fauxServeur('clair');
    try {
      const r = await envoyer(base(clair.port, { security: 'starttls' }));
      expect(r.ok).toBe(false);
      expect(r.error).toContain('STARTTLS');
      expect(clair.commandes.some((c) => c.toUpperCase().startsWith('MAIL FROM'))).toBe(false);
    } finally {
      await clair.close();
    }
  });

  it('refuse le certificat d’un serveur inconnu quand aucune autorité n’est fournie', async () => {
    const f = await fauxServeur('smtps');
    try {
      const r = await envoyer(base(f.port, { ca: '' }));
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/Certificat du serveur refusé/);
    } finally {
      await f.close();
    }
  });

  it('dit pourquoi l’envoi échoue : mauvais mot de passe, port fermé, hôte introuvable', async () => {
    const f = await fauxServeur('smtps');
    const port = f.port;
    try {
      const r = await envoyer(base(f.port, { password: 'mauvais' }));
      expect(r.ok).toBe(false);
      expect(r.error).toContain('Authentification refusée');
      expect(JSON.stringify(r)).not.toContain('mauvais');
    } finally {
      await f.close();
    }
    const ferme = await envoyer(base(port));
    expect(ferme.ok).toBe(false);
    expect(ferme.error).toMatch(/refusée|injoignable|Délai/);
    const inconnu = await envoyer(base(25, { host: 'smtp.invalid' }));
    expect(inconnu.ok).toBe(false);
    expect(inconnu.error).toMatch(/introuvable|injoignable|Délai/);
  });

  it('envoie une notification : objet et corps fournis, aucune adresse dans la trace, en-tête automatique', async () => {
    const f = await fauxServeur('smtps');
    try {
      const r = await envoyer(
        base(f.port, {
          kind: 'notification',
          to: 'personne@exemple.test',
          subject: 'Suivi des audits : Échéance d’une action',
          body: 'Bonjour,\n\nOuvrez /pilotage/rappels\n',
        }),
      );
      expect(r.ok, JSON.stringify(r)).toBe(true);
      expect(JSON.stringify(r)).not.toContain('personne@exemple.test');
      expect(f.messages).toHaveLength(1);
      expect(f.messages[0]).toContain('To: personne@exemple.test');
      expect(f.messages[0]).toContain('Auto-Submitted: auto-generated');
      expect(f.messages[0]).toContain('Ouvrez /pilotage/rappels');
      expect(f.messages[0]).not.toContain('message de test');
    } finally {
      await f.close();
    }
  });

  it('refuse une notification sans objet, avec un objet multiligne ou de type inconnu', async () => {
    const notif = { kind: 'notification', subject: 'Objet', body: 'Corps' };
    expect((await lancer(base(1, { ...notif, subject: '' }))).status).not.toBe(0);
    expect((await lancer(base(1, { ...notif, subject: 'a\nBcc: x@y.test' }))).status).not.toBe(0);
    expect((await lancer(base(1, { ...notif, body: '' }))).status).not.toBe(0);
    expect((await lancer(base(1, { ...notif, kind: 'autre' }))).status).not.toBe(0);
  });

  it('refuse une valeur contenant un saut de ligne (injection d’en-tête)', async () => {
    const r = await lancer(base(1, { to: 'a@b.test\r\nBcc: x@y.test' }));
    expect(r.status).not.toBe(0);
  });
});
