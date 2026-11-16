/* Reprise de l'existant (ADR 0097, précision du RSSI du 16/11/2026 : « une mise à jour de l'interface ne peut pas enlever le
   flux ouvert ») : un module jamais décidé et réellement en service est enregistré ouvert par l'acteur système
   « reprise-mise-a-jour », inscrit au journal avec son motif ; un module déjà décidé, ouvert ou fermé, n'est jamais touché.
   L'exécutant passe par la vraie CLI (« suivi flux-reprise »), dont l'entrée est validée strictement ; le courriel est
   constaté par l'API elle-même au démarrage. Données fictives. */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { FLUX_REPRISE_ACTEUR, type FluxExterneEtat } from '@suivi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prepareDatabase } from '../src/startup.js';
import { type Agent, createTestApp, login, makeUser, REPO, type TestApp } from './helpers.js';
import { APP_ROLE, APP_ROLE_PASSWORD, PG } from './pg.js';

let t: TestApp, admin: Agent;
const url = '/api/admin/flux-externes';
const etat = async (m: string) =>
  ((await admin.get(url)).json() as { modules: FluxExterneEtat[] }).modules.find((e) => e.module === m)!;
const journal = (action: string, module: string) =>
  t.svc.db.q<{ username: string; ip: string | null; details: Record<string, unknown> }>(
    'SELECT username, ip, details FROM audit_log WHERE action=$1 AND target=$2 ORDER BY id',
    [action, module],
  );
const decisions = async () =>
  (await t.svc.db.q('SELECT module, ouvert, decide_par FROM flux_externes ORDER BY module')).rows;

/** Lance « suivi <commande> » comme l'exécutant (`docker compose exec -T app suivi`), sur la base du test. */
function cli(args: string[], stdin = '') {
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
          DOC_MASTER_KEY: t.svc.cfg.masterKey,
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
    enfant.stdin.end(stdin);
  });
}

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'reprise_admin', 'admin'));
}, 60_000);
afterAll(() => t.close());

describe('reprise de l’existant : protocole de l’exécutant (CLI flux-reprise)', () => {
  it('refuse une entrée qui n’est pas strictement celle attendue, sans rien enregistrer', async () => {
    for (const entree of [
      JSON.stringify({ enService: { inconnu: 'conteneur-present' } }),
      // Le courriel est constaté par l'API, jamais déclaré par l'exécutant.
      JSON.stringify({ enService: { courriel: 'envoi-actif' } }),
      // Motif étranger au module, ou inconnu.
      JSON.stringify({ enService: { acme: 'conteneur-present' } }),
      JSON.stringify({ enService: { assistant: 'passerelle-acme' } }),
      JSON.stringify({ enService: { 'mises-a-jour': 'parce que' } }),
      JSON.stringify({ enService: { acme: true } }),
      JSON.stringify({ enService: { acme: 'passerelle-acme' }, motif: 'texte libre' }),
      JSON.stringify({ enService: ['acme'] }),
      JSON.stringify({ ouverts: ['acme'] }),
      'pas du json',
    ]) {
      const r = await cli(['flux-reprise'], entree);
      expect(r.code, entree).toBe(2);
      expect(r.err, entree).toMatch(/refusée|illisible/);
      expect(r.out, entree).toBe('');
    }
    expect(await decisions()).toEqual([]);
    expect((await t.svc.db.q("SELECT 1 FROM audit_log WHERE action = 'flux.externe.repris'")).rowCount).toBe(0);
  }, 120_000);

  it('enregistre ouverts les modules en service jamais décidés, inscrit le motif au journal, rend l’état voulu', async () => {
    const r = await cli(
      ['flux-reprise'],
      JSON.stringify({ enService: { acme: 'passerelle-acme', 'mises-a-jour': 'mise-a-jour-installee' } }),
    );
    expect(r.code, r.err).toBe(0);
    expect(JSON.parse(r.out)).toEqual({ ouverts: ['acme', 'mises-a-jour'] });
    const acme = await etat('acme');
    expect(acme).toMatchObject({ ouvert: true, decidePar: FLUX_REPRISE_ACTEUR, applique: null });
    expect(Number.isNaN(Date.parse(acme.decideLe!))).toBe(false);
    const j = (await journal('flux.externe.repris', 'acme')).rows;
    expect(j).toHaveLength(1);
    expect(j[0]!.username).toBe('reprise-mise-a-jour');
    expect(j[0]!.ip).toBeNull();
    expect(j[0]!.details).toMatchObject({
      module: 'acme',
      origine: 'executant',
      motif: 'passerelle-acme',
      raison: 'La passerelle HTTPS est en mode ACME (choisi dans l’application).',
      sens: ['sortant', 'entrant'],
    });
    expect((await journal('flux.externe.repris', 'mises-a-jour')).rows[0]!.details).toMatchObject({
      motif: 'mise-a-jour-installee',
    });
    // Ni ouverture ni fermeture « administrateur » : l'événement est distinct.
    expect((await journal('flux.externe.ouvert', 'acme')).rowCount).toBe(0);
    // Second passage de l'exécutant : déjà décidé (par la reprise), rien ne change, rien de nouveau au journal.
    const encore = await cli(['flux-reprise'], JSON.stringify({ enService: { acme: 'env-acme' } }));
    expect(encore.code, encore.err).toBe(0);
    expect(JSON.parse(encore.out)).toEqual({ ouverts: ['acme', 'mises-a-jour'] });
    expect((await journal('flux.externe.repris', 'acme')).rowCount).toBe(1);
    expect((await etat('acme')).decideLe).toBe(acme.decideLe);
  }, 60_000);

  it('ne touche jamais un module décidé : une fermeture décidée reste une fermeture', async () => {
    // Fermé par un administrateur depuis le résumé.
    expect((await admin.put(`${url}/acme`, { ouvert: false, confirmation: true })).statusCode).toBe(200);
    // Ouvert par un administrateur.
    expect((await admin.put(`${url}/antivirus`, { ouvert: true, confirmation: true })).statusCode).toBe(200);
    const avant = await t.svc.db.q("SELECT count(*)::int AS n FROM audit_log WHERE action = 'flux.externe.repris'");
    const r = await cli(
      ['flux-reprise'],
      JSON.stringify({ enService: { acme: 'passerelle-acme', antivirus: 'conteneur-present' } }),
    );
    expect(r.code, r.err).toBe(0);
    expect(JSON.parse(r.out)).toEqual({ ouverts: ['antivirus', 'mises-a-jour'] });
    expect(await etat('acme')).toMatchObject({ ouvert: false, decidePar: 'reprise_admin' });
    expect(await etat('antivirus')).toMatchObject({ ouvert: true, decidePar: 'reprise_admin' });
    expect(
      (await t.svc.db.q("SELECT count(*)::int AS n FROM audit_log WHERE action = 'flux.externe.repris'")).rows,
    ).toEqual(avant.rows);
  }, 60_000);

  it('reprend un module que l’exécutant a seulement rapporté (état appliqué sans décision)', async () => {
    await t.svc.flux.appliquer({ assistant: { etat: 'ferme' } });
    expect(await etat('assistant')).toMatchObject({ ouvert: false, decidePar: null, applique: 'ferme' });
    const r = await cli(['flux-reprise'], JSON.stringify({ enService: { assistant: 'env-renseigne' } }));
    expect(r.code, r.err).toBe(0);
    expect(await etat('assistant')).toMatchObject({ ouvert: true, decidePar: FLUX_REPRISE_ACTEUR, applique: 'ferme' });
    expect((await journal('flux.externe.repris', 'assistant')).rows[0]!.details).toMatchObject({
      motif: 'env-renseigne',
      raison: 'ASSISTANT_RELAIS_URL est renseigné dans .env.',
    });
  }, 60_000);

  it('une entrée vide ne change rien et rend l’état voulu, comme flux-souhaites', async () => {
    const avant = await decisions();
    const r = await cli(['flux-reprise'], JSON.stringify({ enService: {} }));
    expect(r.code, r.err).toBe(0);
    expect(JSON.parse(r.out)).toEqual(JSON.parse((await cli(['flux-souhaites'])).out));
    expect(await decisions()).toEqual(avant);
  }, 60_000);
});

describe('reprise de l’existant : courriel, constaté par l’API au démarrage', () => {
  const regler = async (values: Record<string, unknown>) => {
    await t.svc.db.q(
      `INSERT INTO settings(key, value) VALUES ('section:courriel', $1)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [{ values, version: 1 }],
    );
  };

  it('envoi actif sans serveur SMTP, ou inactif : rien n’est repris', async () => {
    await regler({ actif: true, hote: '' });
    await prepareDatabase(t.svc, { issueToken: false });
    expect(await etat('courriel')).toMatchObject({ ouvert: false, decidePar: null });
    await regler({ actif: false, hote: 'smtp.exemple.test' });
    await prepareDatabase(t.svc, { issueToken: false });
    expect(await etat('courriel')).toMatchObject({ ouvert: false, decidePar: null });
  }, 60_000);

  it('envoi actif avec un serveur SMTP, jamais décidé : flux repris ouvert au démarrage, une seule fois', async () => {
    await regler({ actif: true, hote: 'smtp.exemple.test' });
    await prepareDatabase(t.svc, { issueToken: false });
    expect(await etat('courriel')).toMatchObject({ ouvert: true, decidePar: FLUX_REPRISE_ACTEUR });
    const j = (await journal('flux.externe.repris', 'courriel')).rows;
    expect(j).toHaveLength(1);
    expect(j[0]!.details).toMatchObject({ origine: 'demarrage', motif: 'envoi-actif' });
    await prepareDatabase(t.svc, { issueToken: false });
    expect((await journal('flux.externe.repris', 'courriel')).rowCount).toBe(1);
  }, 60_000);

  it('courriel fermé par décision : jamais rouvert au démarrage', async () => {
    expect((await admin.put(`${url}/courriel`, { ouvert: false, confirmation: true })).statusCode).toBe(200);
    expect(await t.svc.flux.reprendreCourriel({ actif: true, hote: 'smtp.exemple.test' })).toEqual([]);
    await prepareDatabase(t.svc, { issueToken: false });
    expect(await etat('courriel')).toMatchObject({ ouvert: false, decidePar: 'reprise_admin' });
    expect((await journal('flux.externe.repris', 'courriel')).rowCount).toBe(1);
  }, 60_000);
});
