/* Procédures d'exploitation du poivre (L9, ADR 0072) par la vraie CLI, sur une base de test :
   poivre-restaurer (clé maîtresse perdue, base intacte) et poivre-reinitialiser (poivre perdu, procédure d'urgence). */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  Agent,
  createTestApp,
  definirPoivreDeTest,
  login,
  makeUser,
  PASSWORD,
  REPO,
  type TestApp,
  type TestUser,
} from './helpers.js';
import { APP_ROLE, APP_ROLE_PASSWORD, PG } from './pg.js';

const SAISI = 'Vq7!mZ3#kP9$wX2@nR5%tL8&yB4*cD6^hF1(';
let t: TestApp, admin: TestUser, alice: TestUser;

/** Lance « suivi <commande> » comme `docker compose exec app suivi` (même base, clé maîtresse éventuellement différente). */
function cli(args: string[], o: { stdin?: string; cleMaitresse?: string } = {}) {
  return new Promise<{ code: number | null; out: string; err: string }>((resolve, reject) => {
    const enfant = spawn(
      path.join(REPO, 'apps/api/node_modules/.bin/tsx'),
      ['--conditions=source', path.join(REPO, 'apps/api/src/cli.ts'), ...args],
      {
        cwd: path.join(REPO, 'apps/api'),
        env: {
          ...process.env,
          DB_HOST: PG.host,
          DB_PORT: String(PG.port),
          DB_NAME: t.dbName,
          DB_USER: APP_ROLE,
          DB_PASSWORD: APP_ROLE_PASSWORD,
          DOC_MASTER_KEY: o.cleMaitresse ?? t.svc.cfg.masterKey,
          SECRETS_DIR: '/nonexistent',
          LOG_LEVEL: 'silent',
        },
      },
    );
    let out = '',
      err = '';
    enfant.stdout.on('data', (d) => (out += d));
    enfant.stderr.on('data', (d) => (err += d));
    enfant.on('error', reject);
    enfant.on('close', (code) => resolve({ code, out, err }));
    enfant.stdin.end(o.stdin ?? '');
  });
}
const hashes = async () =>
  (
    await t.svc.db.q<{ username: string; h: string }>(
      'SELECT username, password_hash AS h FROM users ORDER BY username',
    )
  ).rows;
const connexion = async (u: { username: string }, mdp: string) => {
  for (const l of [t.svc.limits.loginByIp, t.svc.limits.loginByUser]) l.reset();
  return (await new Agent(t).post('/api/auth/login', { username: u.username, password: mdp })).statusCode;
};

describe('CLI du poivre', () => {
  beforeAll(async () => {
    t = await createTestApp();
    admin = await makeUser(t, 'rssi', 'admin');
    alice = await makeUser(t, 'alice', 'rw');
    await definirPoivreDeTest(t, admin, SAISI);
  }, 60_000);
  afterAll(async () => {
    await t.close();
  });

  it('poivre-restaurer : mauvais poivre refusé, bon poivre rescelle la clé sous une nouvelle clé maîtresse', async () => {
    const avant = await hashes();
    const nouvelleCle = Buffer.alloc(32, 7).toString('base64');
    // Clé maîtresse perdue : le poivre scellé est illisible, les connexions poivrées sont refusées.
    const faux = await cli(['poivre-restaurer'], { stdin: SAISI + 'x\n', cleMaitresse: nouvelleCle });
    expect(faux.code).toBe(1);
    expect(faux.err).toContain('ne correspond pas');
    expect(await hashes()).toEqual(avant);
    const bon = await cli(['poivre-restaurer'], { stdin: SAISI + '\n', cleMaitresse: nouvelleCle });
    expect(bon.code, bon.err).toBe(0);
    expect(bon.out).toContain('Poivre repris');
    expect(JSON.stringify(bon)).not.toContain(SAISI);
    // Les empreintes n'ont pas changé ; la nouvelle clé maîtresse ouvre désormais le poivre.
    expect(await hashes()).toEqual(avant);
    const { Vault } = await import('../src/security/crypto.js');
    const ligne = (await t.svc.db.one<{ value: { scelle: string } }>(
      "SELECT value FROM settings WHERE key='secret:poivre'",
    ))!.value;
    expect(() => new Vault(nouvelleCle).openSmall(Buffer.from(ligne.scelle, 'base64'), 'poivre')).not.toThrow();
    const audit = await t.svc.db.q("SELECT details FROM audit_log WHERE action='securite.poivre_restaure'");
    expect(audit.rows).toHaveLength(1);
    // Sans entrée standard : refus explicite.
    const vide = await cli(['poivre-restaurer'], { stdin: '' });
    expect(vide.code).toBe(1);
    // Retour à la clé maîtresse de l'application de test pour la suite.
    const retour = await cli(['poivre-restaurer'], { stdin: SAISI });
    expect(retour.code, retour.err).toBe(0);
  }, 60_000);

  it('poivre-reinitialiser : exige --confirmer, puis nouveau poivre, mots de passe temporaires pour tous, sessions fermées', async () => {
    const agent = await login(t, alice);
    expect((await agent.get('/api/auth/me')).json().user.username).toBe('alice');
    const avant = await hashes();
    const sans = await cli(['poivre-reinitialiser']);
    expect(sans.code).toBe(1);
    expect(sans.err).toContain('--confirmer');
    expect(await hashes()).toEqual(avant);

    const r = await cli(['poivre-reinitialiser', '--confirmer']);
    expect(r.code, r.err).toBe(0);
    // Le nouveau poivre est affiché une fois, par groupes de 4 ; les mots de passe temporaires de chaque compte aussi.
    const poivre = (r.out.match(/NOUVEAU POIVRE[^\n]*\n\s+([A-Z2-7-]{64,})/) ?? [])[1];
    expect(poivre).toBeTruthy();
    expect(poivre).toMatch(/^([A-Z2-7]{4}-){12}[A-Z2-7]{4}$/);
    const temporaire = (nom: string) => (r.out.match(new RegExp(`'${nom}'\\s*│\\s*'([^']+)'`)) ?? [])[1];
    for (const u of [admin, alice]) expect(temporaire(u.username), u.username).toBeTruthy();
    // Empreintes poivrées par la nouvelle clé, changement imposé, anciens mots de passe refusés, sessions fermées.
    const apres = await hashes();
    expect(apres.every((x) => x.h.startsWith('poivre$'))).toBe(true);
    expect(apres.map((x) => x.h)).not.toEqual(avant.map((x) => x.h));
    expect(await connexion(alice, PASSWORD)).toBe(401);
    expect(await connexion(alice, temporaire('alice')!)).toBe(200);
    const musts = await t.svc.db.q<{ must_change_password: boolean }>('SELECT must_change_password FROM users');
    expect(musts.rows.every((x) => x.must_change_password)).toBe(true);
    expect((await agent.get('/api/auth/me')).json().user).toBeNull();
    expect(
      (await t.svc.db.one<{ n: number }>('SELECT count(*)::int AS n FROM sessions WHERE user_id = $1', [alice.id]))!.n,
    ).toBe(
      1, // la connexion qui vient d'avoir lieu
    );
    expect(await t.svc.motsDePasse.estLePoivre(poivre!)).toBe(true);
    expect(await t.svc.motsDePasse.estLePoivre(SAISI)).toBe(false);
    // Journal et alerte : l'évènement est tracé sans poivre ni mot de passe.
    const trace = JSON.stringify(
      (await t.svc.db.q("SELECT details FROM audit_log WHERE action='securite.poivre_reinitialise'")).rows,
    );
    expect(trace).toContain('idCle');
    expect(trace).not.toContain(poivre!.replace(/-/g, ''));
  }, 60_000);
});
