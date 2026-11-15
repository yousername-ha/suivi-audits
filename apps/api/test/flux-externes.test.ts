/* Flux vers l'extérieur (ADR 0097, lot 1) : tout est fermé par défaut ; l'administrateur ouvre ou ferme un module après
   confirmation explicite, la décision est inscrite au journal d'audit avec ses destinations ; l'exécutant lit l'état voulu
   et rapporte l'état appliqué par la vraie CLI, dont l'entrée est validée strictement. Données fictives. */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { FLUX_MODULES, type FluxExterneEtat } from '@suivi/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, REPO, type TestApp } from './helpers.js';
import { APP_ROLE, APP_ROLE_PASSWORD, PG } from './pg.js';

let t: TestApp, admin: Agent, lecteurAdmin: Agent, contributeur: Agent;
const url = '/api/admin/flux-externes';
const etats = async () => ((await admin.get(url)).json() as { modules: FluxExterneEtat[] }).modules;
const etat = async (m: string) => (await etats()).find((e) => e.module === m)!;
const journal = (action: string, module: string) =>
  t.svc.db.q<{ username: string; details: Record<string, unknown> }>(
    'SELECT username, details FROM audit_log WHERE action=$1 AND target=$2 ORDER BY id',
    [action, module],
  );

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
  admin = await login(t, await makeUser(t, 'flux_admin', 'admin'));
  contributeur = await login(t, await makeUser(t, 'flux_rw', 'rw'));
  await t.svc.db.q("INSERT INTO roles(id, name, permissions) VALUES ('flux_lecture', 'Lecture administration', $1)", [
    ['administration:lire'],
  ]);
  lecteurAdmin = await login(t, await makeUser(t, 'flux_lecteur', 'flux_lecture'));
}, 60_000);
afterAll(() => t.close());

describe('flux vers l’extérieur : état et droits', () => {
  it('par défaut, tous les modules du registre sont fermés, jamais décidés ni appliqués', async () => {
    const e = await etats();
    expect(e.map((x) => x.module)).toEqual([...FLUX_MODULES]);
    for (const x of e)
      expect(x).toEqual({
        module: x.module,
        ouvert: false,
        decidePar: null,
        decideLe: null,
        applique: null,
        appliqueLe: null,
        erreur: null,
      });
    for (const m of FLUX_MODULES) expect(await t.svc.flux.ouvert(m)).toBe(false);
  });

  it('lecture avec administration:lire, changement avec administration:administrer seulement', async () => {
    expect((await contributeur.get(url)).statusCode).toBe(403);
    expect((await lecteurAdmin.get(url)).statusCode).toBe(200);
    const corps = { ouvert: true, confirmation: true };
    expect((await contributeur.put(`${url}/assistant`, corps)).statusCode).toBe(403);
    expect((await lecteurAdmin.put(`${url}/assistant`, corps)).statusCode).toBe(403);
    expect((await admin.req('PUT', `${url}/assistant`, { json: corps, csrf: false })).statusCode).toBe(403);
    expect((await admin.put(`${url}/assistant`, corps, { origin: 'https://evil.test' })).statusCode).toBe(403);
    expect((await etat('assistant')).ouvert).toBe(false);
  });

  it('confirmation explicite obligatoire, schéma fermé, module inconnu en 404', async () => {
    for (const corps of [
      { ouvert: true },
      { ouvert: true, confirmation: false },
      { ouvert: true, confirmation: 'oui' },
      { ouvert: 'oui', confirmation: true },
      { ouvert: true, confirmation: true, destinations: ['ailleurs.example'] },
    ])
      expect((await admin.put(`${url}/assistant`, corps)).statusCode, JSON.stringify(corps)).toBe(422);
    expect((await admin.put(`${url}/inconnu`, { ouvert: true, confirmation: true })).statusCode).toBe(404);
    expect((await admin.put(`${url}/ASSISTANT`, { ouvert: true, confirmation: true })).statusCode).toBe(404);
    expect((await t.svc.db.q('SELECT 1 FROM flux_externes')).rowCount).toBe(0);
  });
});

describe('flux vers l’extérieur : décision et journal', () => {
  it('ouvrir un module activé par son flux : état voulu enregistré, journal avec destinations ; une seconde demande identique ne change rien', async () => {
    const r = await admin.put(`${url}/antivirus`, { ouvert: true, confirmation: true });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ module: 'antivirus', ouvert: true, decidePar: 'flux_admin', applique: null });
    expect(Number.isNaN(Date.parse(r.json().decideLe))).toBe(false);
    expect(await t.svc.flux.ouvert('antivirus')).toBe(true);
    const j = (await journal('flux.externe.ouvert', 'antivirus')).rows;
    expect(j).toHaveLength(1);
    expect(j[0]!.username).toBe('flux_admin');
    expect(j[0]!.details).toMatchObject({ module: 'antivirus', origine: 'flux', sens: ['sortant'] });
    const destinations = j[0]!.details.destinations as { sens: string; hote: string; ports: string }[];
    expect(
      destinations.some(
        (d) => d.hote === 'Miroirs des signatures ClamAV (database.clamav.net)' && d.ports === 'TCP 443 (HTTPS)',
      ),
    ).toBe(true);
    // Idempotence : même état demandé, aucune nouvelle entrée ni nouvelle date.
    const encore = await admin.put(`${url}/antivirus`, { ouvert: true, confirmation: true });
    expect(encore.statusCode).toBe(200);
    expect(encore.json().decideLe).toBe(r.json().decideLe);
    expect((await journal('flux.externe.ouvert', 'antivirus')).rowCount).toBe(1);
    // Les autres modules restent fermés.
    expect((await etats()).filter((e) => e.ouvert).map((e) => e.module)).toEqual(['antivirus']);
  });

  it('fermer : confirmé, inscrit au journal, et relu aussitôt sans redémarrer l’API', async () => {
    const r = await admin.put(`${url}/antivirus`, { ouvert: false, confirmation: true });
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({ module: 'antivirus', ouvert: false, decidePar: 'flux_admin' });
    expect(await t.svc.flux.ouvert('antivirus')).toBe(false);
    const j = (await journal('flux.externe.ferme', 'antivirus')).rows;
    expect(j).toHaveLength(1);
    expect(j[0]!.details).toMatchObject({ module: 'antivirus' });
  });

  it('un module activé par son propre geste ne s’ouvre pas par la route commune (sans étape séparée), mais s’y ferme', async () => {
    for (const m of ['assistant', 'courriel', 'acme']) {
      const r = await admin.put(`${url}/${m}`, { ouvert: true, confirmation: true });
      expect(r.statusCode, m).toBe(409);
      expect(r.json(), m).toMatchObject({ reason: 'flux_par_module', module: m });
      expect(r.json().error, m).toContain('activant le module');
      expect(await t.svc.flux.ouvert(m as 'acme'), m).toBe(false);
    }
    // Ouvert par son geste d'activation (ici simulé par le service), il se ferme depuis le résumé.
    await t.svc.flux.changer('acme', true, { username: 'flux_admin' }, '127.0.0.1', 'operation.tls_acme');
    expect((await admin.put(`${url}/acme`, { ouvert: true, confirmation: true })).statusCode).toBe(200);
    const f = await admin.put(`${url}/acme`, { ouvert: false, confirmation: true });
    expect(f.statusCode).toBe(200);
    expect(f.json().ouvert).toBe(false);
    expect((await journal('flux.externe.ouvert', 'acme')).rows[0]!.details).toMatchObject({
      origine: 'operation.tls_acme',
      sens: ['sortant', 'entrant'],
    });
  });
});

describe('flux vers l’extérieur : protocole de l’exécutant (CLI)', () => {
  it('flux-souhaites : JSON des seuls modules voulus ouverts', async () => {
    await t.svc.flux.changer('assistant', true, { username: 'flux_admin' }, '127.0.0.1', 'assistant.reglages');
    expect((await admin.put(`${url}/mises-a-jour`, { ouvert: true, confirmation: true })).statusCode).toBe(200);
    const r = await cli(['flux-souhaites']);
    expect(r.code, r.err).toBe(0);
    expect(JSON.parse(r.out)).toEqual({ ouverts: ['assistant', 'mises-a-jour'] });
  }, 30_000);

  it('flux-appliques : état appliqué enregistré, journal seulement au changement, relu par l’administration', async () => {
    const rapport = JSON.stringify({
      assistant: { etat: 'ouvert' },
      antivirus: { etat: 'erreur', erreur: 'Profil « antivirus » introuvable.' },
    });
    const r = await cli(['flux-appliques'], rapport);
    expect(r.code, r.err).toBe(0);
    expect(await etat('assistant')).toMatchObject({ ouvert: true, applique: 'ouvert', erreur: null });
    expect(await etat('antivirus')).toMatchObject({
      ouvert: false,
      applique: 'erreur',
      erreur: 'Profil « antivirus » introuvable.',
    });
    expect(Number.isNaN(Date.parse((await etat('assistant')).appliqueLe!))).toBe(false);
    // Un module non rapporté garde son état.
    expect((await etat('courriel')).applique).toBeNull();
    expect((await journal('flux.externe.applique', 'assistant')).rowCount).toBe(1);
    // Même rapport au passage suivant : rien de nouveau au journal.
    expect((await cli(['flux-appliques'], rapport)).code).toBe(0);
    expect((await journal('flux.externe.applique', 'assistant')).rowCount).toBe(1);
    expect((await journal('flux.externe.applique', 'antivirus')).rowCount).toBe(1);
    // Retour à la normale : l'erreur est effacée.
    expect((await cli(['flux-appliques'], JSON.stringify({ antivirus: { etat: 'ferme' } }))).code).toBe(0);
    expect(await etat('antivirus')).toMatchObject({ applique: 'ferme', erreur: null });
    expect((await journal('flux.externe.applique', 'antivirus')).rowCount).toBe(2);
    // L'état voulu n'est jamais modifié par l'exécutant.
    expect((await etat('assistant')).decidePar).toBe('flux_admin');
  }, 60_000);

  it('flux-appliques refuse un module inconnu, un champ inattendu, une erreur mal formée ou un JSON illisible', async () => {
    const avant = await etats();
    for (const entree of [
      JSON.stringify({ inconnu: { etat: 'ouvert' } }),
      JSON.stringify({ assistant: { etat: 'ouvert', commande: 'docker compose up' } }),
      JSON.stringify({ assistant: { etat: 'erreur' } }),
      JSON.stringify({ assistant: { etat: 'ouvert', erreur: 'x' } }),
      JSON.stringify({ assistant: { etat: 'erreur', erreur: 'x'.repeat(301) } }),
      JSON.stringify({ assistant: { etat: 'erreur', erreur: 'ligne\nsuivante' } }),
      JSON.stringify({ assistant: { etat: 'demarre' } }),
      'pas du json',
    ]) {
      const r = await cli(['flux-appliques'], entree);
      expect(r.code, entree).toBe(2);
      expect(r.err, entree).toMatch(/refusé|illisible/);
    }
    expect(await etats()).toEqual(avant);
  }, 120_000);
});
