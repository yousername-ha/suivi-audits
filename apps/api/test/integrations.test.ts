/* Module Intégrations (ADR 0076), socle des connecteurs réseau : migration 073 sur base vierge, droits (lire, modifier,
   administrer), module désactivé, CSRF, If-Match, secrets en écriture seule (jamais renvoyés, ni dans le journal d'audit, ni
   dans les journaux techniques), activation qui ouvre le flux « tenable » avec validation explicite (ADR 0097), flux fermé =
   rien de réclamé, cycle réclamation -> retour par la vraie CLI de l'exécutant. Données entièrement fictives. */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { pino } from 'pino';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { REDACT } from '../src/log.js';
import { type Agent, createTestApp, login, makeUser, REPO, type TestApp } from './helpers.js';
import { APP_ROLE, APP_ROLE_PASSWORD, PG } from './pg.js';

const base = '/api/integrations';
const CLE_ACCES = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const CLE_SECRETE = 'f0e1d2c3b4a5968778695a4b3c2d1e0f';
const CONF = { adresse: 'https://tenable.exemple.test' };
let t: TestApp;
let admin: Agent, rssi: Agent, lecture: Agent, operateur: Agent, contributeur: Agent, lecteur: Agent, sansRole: Agent;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const audits = async (action: string) =>
  (
    await t.svc.db.q<{ username: string; target: string; details: Record<string, unknown> }>(
      'SELECT username, target, details FROM audit_log WHERE action = $1 ORDER BY id',
      [action],
    )
  ).rows;
const creer = async (nom = 'Tenable fictif', configuration: Record<string, unknown> = CONF) => {
  const r = await admin.post(`${base}/instances`, { type: 'tenable', nom, configuration });
  expect(r.statusCode, r.body).toBe(201);
  return r.json() as { id: string; version: number; actif: boolean; secrets: Record<string, boolean> };
};
const definirCles = async (id: string) =>
  expect(
    (await admin.put(`${base}/instances/${id}/secrets`, { accessKey: CLE_ACCES, secretKey: CLE_SECRETE })).statusCode,
  ).toBe(204);
const activer = async (a: Agent, id: string, actif: boolean, extra: Record<string, unknown> = {}) => {
  const v = (await admin.get(`${base}/instances/${id}`)).json().version as number;
  return a.put(`${base}/instances/${id}/activation`, { actif, ...extra }, ifMatch(v));
};
/** Instance active, clés enregistrées, flux ouvert, exécutant vu. */
const pret = async (nom = 'Tenable fictif') => {
  const i = await creer(nom);
  await definirCles(i.id);
  expect((await activer(admin, i.id, true, { fluxConfirme: true })).statusCode).toBe(200);
  await t.svc.backups.heartbeat(true);
  return i.id;
};

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
  admin = await login(t, await makeUser(t, 'integ_admin', 'admin'));
  rssi = await login(t, await makeUser(t, 'integ_rssi', 'rssi'));
  contributeur = await login(t, await makeUser(t, 'integ_rw', 'rw'));
  lecteur = await login(t, await makeUser(t, 'integ_ro', 'ro'));
  sansRole = await login(t, await makeUser(t, 'integ_sans_role', null));
  await t.svc.db.q(
    "INSERT INTO roles(id, name, permissions) VALUES ('r_integ_lire', 'Intégrations, lecture', ARRAY['integrations:lire']), ('r_integ_modif', 'Intégrations, lancement', ARRAY['integrations:lire','integrations:modifier'])",
  );
  lecture = await login(t, await makeUser(t, 'integ_lecture', 'r_integ_lire'));
  operateur = await login(t, await makeUser(t, 'integ_operateur', 'r_integ_modif'));
}, 60_000);
afterAll(async () => {
  if (t) await t.close();
});
beforeEach(async () => {
  await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
  await t.svc.db.q('DELETE FROM integrations');
  await t.svc.db.q("DELETE FROM settings WHERE key LIKE 'secret:integration:%'");
  await t.svc.db.q("DELETE FROM flux_externes WHERE module IN ('tenable', 'algolighthouse')");
  await t.svc.db.q('DELETE FROM backup_worker');
  // Limite de débit des tests de connexion remise à neuf : chaque cas part de zéro.
  t.svc.limits.integrationTest.reset();
});

describe('migration 073 sur base vierge', () => {
  it('crée les tables vides, admet le module dans la contrainte et borne la file', async () => {
    expect((await t.svc.db.one("SELECT 1 AS ok FROM schema_migrations WHERE name = '073_integrations.sql'"))?.ok).toBe(
      1,
    );
    for (const table of ['integrations', 'integration_executions'])
      expect((await t.svc.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM ${table}`))!.n).toBe(0);
    await t.svc.db.q("UPDATE module_activation SET disabled = ARRAY['integrations'] WHERE id = 1");
    await expect(
      t.svc.db.q("UPDATE module_activation SET disabled = ARRAY['integrations_inconnu'] WHERE id = 1"),
    ).rejects.toThrow();
    const { id } = (await t.svc.db.one<{ id: string }>(
      "INSERT INTO integrations (type, nom, created_by, updated_by) VALUES ('tenable', 'SQL', 'test', 'test') RETURNING id",
    ))!;
    const ins = (etat: string, extra = '', valeurs = '') =>
      t.svc.db.q(
        `INSERT INTO integration_executions (integration_id, operation, demande_par, etat${extra}) VALUES ($1, 'tester', 'test', $2${valeurs})`,
        [id, etat],
      );
    await ins('en_file');
    await expect(ins('autre')).rejects.toThrow();
    // Un résultat n'accompagne que « recu », une erreur sur une ligne seulement un échec ; terminé = date de fin.
    await expect(ins('recu', ', debute_le, termine_le', ', now(), now()')).rejects.toThrow();
    await expect(ins('echec', ', termine_le, erreur', ", now(), E'ligne 1\\nligne 2'")).rejects.toThrow();
    await expect(ins('echec', ', erreur', ", 'sans date de fin'")).rejects.toThrow();
    await ins('echec', ', termine_le, erreur', ", now(), 'Flux fermé.'");
    await expect(
      t.svc.db.q("INSERT INTO integrations (type, nom, created_by, updated_by) VALUES ('Tenable!', 'X', 't', 't')"),
    ).rejects.toThrow();
  });
});

describe('droits, module et CSRF', () => {
  it('sans droit du module : refus 403 sur chaque route, y compris pour le contributeur et le lecteur', async () => {
    const i = await creer();
    for (const a of [sansRole, contributeur, lecteur]) {
      expect((await a.get(`${base}/catalogue`)).statusCode).toBe(403);
      expect((await a.get(`${base}/etat`)).statusCode).toBe(403);
      expect((await a.get(`${base}/instances`)).statusCode).toBe(403);
      expect((await a.get(`${base}/instances/${i.id}`)).statusCode).toBe(403);
      expect((await a.get(`${base}/instances/${i.id}/executions`)).statusCode).toBe(403);
      expect((await a.post(`${base}/instances`, { type: 'tenable', nom: 'X', configuration: CONF })).statusCode).toBe(
        403,
      );
      expect((await a.post(`${base}/instances/${i.id}/tester`)).statusCode).toBe(403);
    }
  });

  it('lire ne permet ni de configurer ni de lancer ; modifier lance mais ne configure pas', async () => {
    const i = await creer();
    expect((await lecture.get(`${base}/catalogue`)).json()[0].id).toBe('tenable');
    expect((await lecture.get(`${base}/instances`)).json()).toHaveLength(1);
    expect((await lecture.post(`${base}/instances/${i.id}/tester`)).statusCode).toBe(403);
    expect((await lecture.put(`${base}/instances/${i.id}/secrets`, { accessKey: CLE_ACCES })).statusCode).toBe(403);
    expect((await lecture.del(`${base}/instances/${i.id}/secrets/accessKey`)).statusCode).toBe(403);
    expect((await activer(lecture, i.id, true, { fluxConfirme: true })).statusCode).toBe(403);
    expect((await lecture.patch(`${base}/instances/${i.id}`, { nom: 'Y' }, ifMatch(1))).statusCode).toBe(403);
    // Modifier : le lancement passe le contrôle de droit (refus métier : connecteur inactif), la configuration non.
    const test = await operateur.post(`${base}/instances/${i.id}/tester`);
    expect(test.statusCode).toBe(409);
    expect(test.json().error).toMatch(/Activez/);
    expect(
      (await operateur.post(`${base}/instances`, { type: 'tenable', nom: 'X', configuration: CONF })).statusCode,
    ).toBe(403);
  });

  it('module désactivé : toutes les routes refusent, même à l’administrateur', async () => {
    const i = await creer();
    await t.svc.db.q("UPDATE module_activation SET disabled = ARRAY['integrations'], version = version + 1 WHERE id=1");
    for (const r of [
      await admin.get(`${base}/catalogue`),
      await admin.get(`${base}/instances`),
      await admin.post(`${base}/instances/${i.id}/tester`),
      await admin.put(`${base}/instances/${i.id}/secrets`, { accessKey: CLE_ACCES }),
    ]) {
      expect(r.statusCode).toBe(409);
      expect(r.json().reason).toBe('module_disabled');
    }
  });

  it('écriture sans jeton CSRF refusée', async () => {
    const r = await admin.req('POST', `${base}/instances`, {
      json: { type: 'tenable', nom: 'X', configuration: CONF },
      csrf: false,
    });
    expect(r.statusCode).toBe(403);
  });
});

describe('instances : création, modification, If-Match', () => {
  it('crée une instance inactive, sans secret, à la configuration normalisée, et l’inscrit au journal', async () => {
    const r = await admin.post(`${base}/instances`, {
      type: 'tenable',
      nom: 'Tenable fictif',
      configuration: { adresse: 'https://Tenable.Exemple.Test/' },
    });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.headers.etag).toBe('"1"');
    const i = r.json();
    expect(i).toMatchObject({
      type: 'tenable',
      nom: 'Tenable fictif',
      smsiId: null,
      actif: false,
      version: 1,
      configuration: {
        adresse: 'https://tenable.exemple.test',
        autoriteCertification: '',
        delaiSecondes: 30,
        gravites: ['critique', 'elevee'],
      },
      secrets: { accessKey: false, secretKey: false },
      derniereExecution: null,
    });
    expect((await audits('integration.creee')).at(-1)).toMatchObject({ username: 'integ_admin', target: i.id });
  });

  it('refuse une adresse non HTTPS ou avec chemin, un périmètre pour un type d’organisation, un nom en double', async () => {
    for (const adresse of [
      'http://tenable.exemple.test',
      'https://tenable.exemple.test/rest',
      'https://compte:mdp@tenable.exemple.test',
    ])
      expect(
        (await admin.post(`${base}/instances`, { type: 'tenable', nom: 'X', configuration: { adresse } })).statusCode,
      ).toBe(422);
    const smsi = await admin.post(`${base}/instances`, {
      type: 'tenable',
      nom: 'X',
      smsiId: '00000000-0000-4000-8000-000000000001',
      configuration: CONF,
    });
    expect(smsi.statusCode).toBe(422);
    expect(smsi.json().error).toMatch(/toute l’organisation/);
    await creer('Tenable fictif');
    expect(
      (await admin.post(`${base}/instances`, { type: 'tenable', nom: ' tenable FICTIF ', configuration: CONF }))
        .statusCode,
    ).toBe(409);
  });

  it('AlgoLightHouse : adresse de l’espace chez l’éditeur seulement, sans autorité propre ; clé de forme contrôlée', async () => {
    for (const adresse of [
      'https://tenable.exemple.test',
      'https://espace.algolighthouse.fr:8443',
      'https://espace.algolighthouse.fr/api',
      'https://espace.algolighthouse.fr.exemple.invalid',
      'http://espace.algolighthouse.fr',
    ])
      expect(
        (await admin.post(`${base}/instances`, { type: 'algolighthouse', nom: 'A', configuration: { adresse } }))
          .statusCode,
        adresse,
      ).toBe(422);
    expect(
      (
        await admin.post(`${base}/instances`, {
          type: 'algolighthouse',
          nom: 'A',
          configuration: { adresse: 'https://espace.algolighthouse.fr', autoriteCertification: '' },
        })
      ).statusCode,
    ).toBe(422);
    const r = await admin.post(`${base}/instances`, {
      type: 'algolighthouse',
      nom: 'AlgoLightHouse fictif',
      configuration: { adresse: 'https://Espace-Fictif.AlgoLightHouse.fr/' },
    });
    expect(r.statusCode, r.body).toBe(201);
    expect(r.json()).toMatchObject({
      configuration: { adresse: 'https://espace-fictif.algolighthouse.fr', delaiSecondes: 30 },
      secrets: { cleApi: false },
    });
    const id = r.json().id as string;
    expect((await admin.put(`${base}/instances/${id}/secrets`, { cleApi: 'courte' })).statusCode).toBe(422);
    expect((await admin.put(`${base}/instances/${id}/secrets`, { accessKey: CLE_ACCES })).statusCode).toBe(422);
    expect(
      (await admin.put(`${base}/instances/${id}/secrets`, { cleApi: 'cle-api-fictive-0123456789abcdef' })).statusCode,
    ).toBe(204);
    expect((await admin.get(`${base}/instances/${id}`)).json().secrets).toEqual({ cleApi: true });
    expect(JSON.stringify(await audits('integration.secret_defini'))).not.toContain('cle-api-fictive');
    // Activer ouvre le flux propre au type, et lui seul.
    const a = await admin.put(`${base}/instances/${id}/activation`, { actif: true, fluxConfirme: true }, ifMatch(1));
    expect(a.statusCode, a.body).toBe(200);
    expect(await t.svc.flux.ouvert('algolighthouse')).toBe(true);
    expect(await t.svc.flux.ouvert('tenable')).toBe(false);
    const cat = (await admin.get(`${base}/catalogue`)).json() as { id: string; pointsAcces: { methode: string }[] }[];
    expect(cat.find((x) => x.id === 'algolighthouse')!.pointsAcces.every((p) => p.methode === 'GET')).toBe(true);
  });

  it('modification : If-Match exigé, version périmée refusée, version incrémentée', async () => {
    const i = await creer();
    expect((await admin.patch(`${base}/instances/${i.id}`, { nom: 'Renommé' })).statusCode).toBe(428);
    expect((await admin.patch(`${base}/instances/${i.id}`, { nom: 'Renommé' }, ifMatch(9))).statusCode).toBe(412);
    const r = await admin.patch(`${base}/instances/${i.id}`, { nom: 'Renommé' }, ifMatch(1));
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ nom: 'Renommé', version: 2 });
    expect(r.headers.etag).toBe('"2"');
    expect(
      (await admin.patch(`${base}/instances/${i.id}`, { configuration: { adresse: 'ftp://x' } }, ifMatch(2)))
        .statusCode,
    ).toBe(422);
    expect((await admin.put(`${base}/instances/${i.id}/activation`, { actif: false })).statusCode).toBe(428);
  });
});

describe('secrets en écriture seule', () => {
  it('jamais renvoyés, ni dans le journal d’audit, ni dans les journaux techniques ; seul « défini » sort', async () => {
    const sorties: string[] = [];
    const ecrire = vi.spyOn(process.stdout, 'write').mockImplementation((s: string | Uint8Array) => {
      sorties.push(String(s));
      return true;
    });
    const niveau = t.svc.log.level;
    t.svc.log.level = 'trace';
    try {
      const i = await creer();
      await definirCles(i.id);
      const lu = await admin.get(`${base}/instances/${i.id}`);
      expect(lu.json().secrets).toEqual({ accessKey: true, secretKey: true });
      const textes = [
        lu.body,
        (await admin.get(`${base}/instances`)).body,
        (await admin.get(`${base}/catalogue`)).body,
        JSON.stringify(await audits('integration.secret_defini')),
        JSON.stringify((await t.svc.db.q('SELECT details FROM audit_log')).rows),
        JSON.stringify((await t.svc.db.q("SELECT value FROM settings WHERE key LIKE 'secret:integration:%'")).rows),
      ];
      for (const x of textes) {
        expect(x).not.toContain(CLE_ACCES);
        expect(x).not.toContain(CLE_SECRETE);
      }
      expect((await audits('integration.secret_defini')).at(-1)!.details).toEqual({
        type: 'tenable',
        nom: 'Tenable fictif',
        champs: ['accessKey', 'secretKey'],
      });
      // Le journal technique masque les noms de champs secrets (REDACT), même si un appelant les journalisait.
      t.svc.log.info({ accessKey: CLE_ACCES, secrets: { secretKey: CLE_SECRETE } }, 'essai de masquage');
    } finally {
      t.svc.log.level = niveau;
      ecrire.mockRestore();
    }
    const journal = sorties.join('');
    expect(journal).toContain('essai de masquage');
    expect(journal).not.toContain(CLE_ACCES);
    expect(journal).not.toContain(CLE_SECRETE);
  });

  it('forme contrôlée, champ inconnu refusé, retrait, et suppression quand la destination change', async () => {
    const i = await creer();
    expect((await admin.put(`${base}/instances/${i.id}/secrets`, { accessKey: 'trop;court' })).statusCode).toBe(422);
    expect((await admin.put(`${base}/instances/${i.id}/secrets`, { motDePasse: 'x' })).statusCode).toBe(422);
    expect((await admin.del(`${base}/instances/${i.id}/secrets/motDePasse`)).statusCode).toBe(422);
    await definirCles(i.id);
    expect((await admin.del(`${base}/instances/${i.id}/secrets/accessKey`)).statusCode).toBe(204);
    expect((await admin.get(`${base}/instances/${i.id}`)).json().secrets).toEqual({
      accessKey: false,
      secretKey: true,
    });
    expect((await audits('integration.secret_retire')).at(-1)!.details).toMatchObject({ champ: 'accessKey' });
    await definirCles(i.id);
    // Renommer garde les clés ; changer d'adresse ou d'autorité de certification les supprime.
    let v = (await admin.patch(`${base}/instances/${i.id}`, { nom: 'Autre nom' }, ifMatch(1))).json();
    expect(v.secrets).toEqual({ accessKey: true, secretKey: true });
    v = (
      await admin.patch(
        `${base}/instances/${i.id}`,
        { configuration: { adresse: 'https://autre.exemple.test' } },
        ifMatch(v.version),
      )
    ).json();
    expect(v.secrets).toEqual({ accessKey: false, secretKey: false });
    expect(await audits('integration.secrets_invalides')).toHaveLength(1);
  });
});

describe('activation et flux « tenable » (ADR 0097)', () => {
  it('activer ouvre le flux avec la validation explicite d’un administrateur ; désactiver la dernière instance le referme', async () => {
    const i = await creer();
    const sans = await activer(admin, i.id, true);
    expect(sans.statusCode).toBe(409);
    expect(sans.json().reason).toBe('flux_validation');
    // Le RSSI administre les intégrations mais pas l'administration technique : il ne peut pas ouvrir le flux.
    const parRssi = await activer(rssi, i.id, true, { fluxConfirme: true });
    expect(parRssi.statusCode).toBe(403);
    expect(parRssi.json().reason).toBe('flux_droit');
    expect(await t.svc.flux.ouvert('tenable')).toBe(false);
    const ok = await activer(admin, i.id, true, { fluxConfirme: true });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json()).toMatchObject({ actif: true, version: 2 });
    expect(await t.svc.flux.ouvert('tenable')).toBe(true);
    expect(
      (await t.svc.db.q("SELECT details FROM audit_log WHERE action='flux.externe.ouvert' AND target='tenable'"))
        .rows[0]!.details,
    ).toMatchObject({
      origine: 'integrations.activation',
      module: 'tenable',
    });
    // Seconde instance : flux déjà ouvert, le RSSI peut l'activer ; désactiver l'une ne ferme pas le flux de l'autre.
    const j = await creer('Tenable second');
    expect((await activer(rssi, j.id, true)).statusCode).toBe(200);
    expect((await activer(admin, i.id, false)).statusCode).toBe(200);
    expect(await t.svc.flux.ouvert('tenable')).toBe(true);
    expect((await activer(rssi, j.id, false)).statusCode).toBe(200);
    expect(await t.svc.flux.ouvert('tenable')).toBe(false);
    expect(await audits('integration.desactivee')).toHaveLength(2);
    const etat = (await lecture.get(`${base}/etat`)).json();
    // Un flux par type du catalogue : celui d'AlgoLightHouse est resté fermé.
    expect(etat.flux).toEqual([
      { type: 'tenable', flux: 'tenable', ouvert: false },
      { type: 'algolighthouse', flux: 'algolighthouse', ouvert: false },
    ]);
  });

  it('désactiver le module Intégrations referme le flux ; le réactiver ne rouvre rien', async () => {
    const id = await pret();
    expect(await t.svc.flux.ouvert('tenable')).toBe(true);
    const intent = { changes: [{ id: 'integrations', enabled: false }], cascade: false };
    const apercu = await admin.post('/api/admin/modules/preview', intent);
    expect(apercu.statusCode, apercu.body).toBe(200);
    const applique = await admin.put(
      '/api/admin/modules',
      { intent, previewId: apercu.json().previewId, confirm: 'VALIDER' },
      { 'if-match': `"${apercu.json().version}"` },
    );
    expect(applique.statusCode, applique.body).toBe(200);
    expect(await t.svc.flux.ouvert('tenable')).toBe(false);
    await t.svc.db.q("UPDATE module_activation SET disabled='{}', version=version+1 WHERE id=1");
    expect(await t.svc.flux.ouvert('tenable')).toBe(false);
    // Le connecteur est resté actif ; le relancer exige de rouvrir le flux par l'activation, avec validation.
    expect((await admin.post(`${base}/instances/${id}/tester`)).json().reason).toBe('flux_ferme');
    expect((await activer(admin, id, true)).json().reason).toBe('flux_validation');
    expect((await activer(admin, id, true, { fluxConfirme: true })).statusCode).toBe(200);
    expect(await t.svc.flux.ouvert('tenable')).toBe(true);
  });
});

describe('« Tester la connexion » et exécutant', () => {
  it('refuse sans clés, flux fermé ou exécutant absent', async () => {
    const i = await creer();
    expect((await activer(admin, i.id, true, { fluxConfirme: true })).statusCode).toBe(200);
    const sansCles = await operateur.post(`${base}/instances/${i.id}/tester`);
    expect(sansCles.statusCode).toBe(409);
    expect(sansCles.json().error).toMatch(/Clé d’accès, Clé secrète/);
    await definirCles(i.id);
    const sansExecutant = await operateur.post(`${base}/instances/${i.id}/tester`);
    expect(sansExecutant.statusCode).toBe(503);
    expect((await lecture.get(`${base}/etat`)).json().executant).toEqual({ disponible: false, vuLe: null });
    await t.svc.backups.heartbeat(true);
    expect((await lecture.get(`${base}/etat`)).json().executant.disponible).toBe(true);
    await t.svc.flux.changer('tenable', false, { username: 'test' }, '127.0.0.1');
    const ferme = await operateur.post(`${base}/instances/${i.id}/tester`);
    expect(ferme.statusCode).toBe(409);
    expect(ferme.json().reason).toBe('flux_ferme');
  });

  it('cycle complet par la CLI : réclamation avec les clés, retour de la seule version, journal sans secret', async () => {
    const id = await pret();
    const d = await operateur.post(`${base}/instances/${id}/tester`);
    expect(d.statusCode, d.body).toBe(201);
    expect(d.json()).toMatchObject({
      etat: 'en_file',
      operation: 'tester',
      origine: 'manuel',
      demandePar: 'integ_operateur',
    });
    expect((await operateur.post(`${base}/instances/${id}/tester`)).statusCode).toBe(409);

    const claim = await cli(['integrations-claim']);
    expect(claim.code, claim.err).toBe(0);
    const job = JSON.parse(claim.out);
    expect(job).toEqual({
      id: d.json().id,
      type: 'tenable',
      operation: 'tester',
      configuration: {
        adresse: 'https://tenable.exemple.test',
        autoriteCertification: '',
        delaiSecondes: 30,
        gravites: ['critique', 'elevee'],
      },
      secrets: { accessKey: CLE_ACCES, secretKey: CLE_SECRETE },
    });
    expect((await lecture.get(`${base}/executions/${job.id}`)).json().etat).toBe('en_cours');
    expect((await cli(['integrations-claim'])).out.trim()).toBe('');

    // Rapport mal formé (champ inattendu, erreur sur plusieurs lignes, détail avec un succès ou sur plusieurs lignes) :
    // refusé par la CLI, rien n'est écrit.
    for (const mauvais of [
      { ok: true, resultat: { version: '6.9.1' }, erreur: null, secrets: {} },
      { ok: false, resultat: null, erreur: 'ligne 1\nligne 2' },
      { ok: true, resultat: { version: '6.9.1' }, erreur: null, detail: 'Mandataire fictif : détail.' },
      { ok: false, resultat: null, erreur: 'Échec.', detail: 'ligne 1\nligne 2' },
    ]) {
      const r = await cli(['integrations-finish', job.id], JSON.stringify(mauvais));
      expect(r.code).toBe(2);
    }
    const fin = await cli(
      ['integrations-finish', job.id],
      JSON.stringify({ ok: true, resultat: { version: '6.9.1' }, erreur: null }),
    );
    expect(fin.code, fin.err).toBe(0);
    const e = (await lecture.get(`${base}/executions/${job.id}`)).json();
    expect(e).toMatchObject({ etat: 'recu', resultat: { version: '6.9.1' }, erreur: null });
    expect((await lecture.get(`${base}/instances/${id}/executions`)).json()).toHaveLength(1);
    expect((await lecture.get(`${base}/instances/${id}`)).json().derniereExecution.etat).toBe('recu');
    const journal = JSON.stringify(
      (await t.svc.db.q("SELECT action, details FROM audit_log WHERE action LIKE 'integration.%'")).rows,
    );
    expect(journal).toContain('integration.execution.demandee');
    expect(journal).toContain('integration.execution.reclamee');
    expect(journal).toContain('integration.execution.terminee');
    expect(journal).not.toContain(CLE_ACCES);
    expect(journal).not.toContain(CLE_SECRETE);
    // Exécution déjà terminée : un second retour est refusé.
    expect(
      (await cli(['integrations-finish', job.id], JSON.stringify({ ok: false, resultat: null, erreur: 'x' }))).code,
    ).toBe(1);
  });

  it('un résultat qui porte autre chose que la version est refusé ; un échec garde une erreur courte', async () => {
    const id = await pret();
    for (const [rapport, attendu] of [
      [{ ok: true, resultat: { version: '6.9.1', ActivationCode: 'CODE-FICTIF' }, erreur: null }, 'Résultat refusé'],
      [{ ok: false, resultat: null, erreur: 'Délai dépassé : le service ne répond pas.' }, 'Délai dépassé'],
    ] as const) {
      expect((await operateur.post(`${base}/instances/${id}/tester`)).statusCode).toBe(201);
      const job = (await t.svc.integrations.reclamer(true))!;
      const e = await t.svc.integrations.terminer(job.id as string, rapport);
      expect(e.etat).toBe('echec');
      expect(e.resultat).toBeNull();
      expect(e.erreur).toContain(attendu);
      expect(JSON.stringify(e)).not.toContain('CODE-FICTIF');
    }
  });

  it('flux fermé ou module désactivé : rien n’est réclamé, la demande est close sans appel', async () => {
    const id = await pret();
    expect((await operateur.post(`${base}/instances/${id}/tester`)).statusCode).toBe(201);
    await t.svc.flux.changer('tenable', false, { username: 'test' }, '127.0.0.1');
    const claim = await cli(['integrations-claim']);
    expect(claim.code, claim.err).toBe(0);
    expect(claim.out.trim()).toBe('');
    const [e] = (await lecture.get(`${base}/instances/${id}/executions`)).json();
    expect(e).toMatchObject({ etat: 'echec', debuteLe: null });
    expect(e.erreur).toMatch(/Flux fermé/);
    // Module désactivé (flux pourtant ouvert) : rien n'est remis non plus.
    await t.svc.flux.changer('tenable', true, { username: 'test' }, '127.0.0.1');
    expect((await operateur.post(`${base}/instances/${id}/tester`)).statusCode).toBe(201);
    await t.svc.db.q("UPDATE module_activation SET disabled = ARRAY['integrations'], version = version + 1 WHERE id=1");
    expect((await cli(['integrations-claim'])).out.trim()).toBe('');
    expect(await t.svc.integrations.reclamer(false)).toBeNull();
  });

  it('une demande jamais réclamée expire ; une demande interrompue est close', async () => {
    const id = await pret();
    const d = (await operateur.post(`${base}/instances/${id}/tester`)).json();
    await t.svc.db.q("UPDATE integration_executions SET demande_le = now() - interval '11 minutes' WHERE id = $1", [
      d.id,
    ]);
    expect(await t.svc.integrations.reclamer(true)).toBeNull();
    expect((await t.svc.integrations.execution(d.id)).etat).toBe('expire');
    const d2 = (await operateur.post(`${base}/instances/${id}/tester`)).json();
    expect((await t.svc.integrations.reclamer(true))!.id).toBe(d2.id);
    await t.svc.db.q("UPDATE integration_executions SET debute_le = now() - interval '6 minutes' WHERE id = $1", [
      d2.id,
    ]);
    expect((await operateur.post(`${base}/instances/${id}/tester`)).statusCode).toBe(201);
    const e2 = await t.svc.integrations.execution(d2.id);
    expect(e2.etat).toBe('echec');
    expect(e2.erreur).toMatch(/interrompu/);
  });
});

describe('débit', () => {
  it('au-delà de dix demandes par minute et par personne, « Tester la connexion » est refusé (429)', async () => {
    const i = await creer();
    const codes: number[] = [];
    for (let n = 0; n < 11; n++) codes.push((await operateur.post(`${base}/instances/${i.id}/tester`)).statusCode);
    expect(codes.slice(0, 10).every((c) => c === 409)).toBe(true);
    expect(codes[10]).toBe(429);
  });
});

describe('journaux techniques', () => {
  it('les noms des champs secrets des connecteurs sont masqués', () => {
    for (const champ of ['*.accessKey', '*.secretKey', '*.appToken', '*.userToken', '*.clientSecret', '*.cleApi'])
      expect(REDACT).toContain(champ);
    const lignes: string[] = [];
    const l = pino({ redact: { paths: REDACT, censor: '[masqué]' } }, { write: (s: string) => lignes.push(s) });
    l.info({ job: { accessKey: CLE_ACCES, secretKey: CLE_SECRETE } }, 'réclamation');
    l.info({ secrets: { cleApi: 'cle-api-fictive-0123456789abcdef' } }, 'réclamation');
    l.info({ job: { cleApi: 'cle-api-fictive-0123456789abcdef' } }, 'réclamation');
    expect(lignes.join('')).not.toContain('cle-api-fictive');
    expect(lignes.join('')).not.toContain(CLE_SECRETE);
    expect(lignes.join('')).not.toContain(CLE_ACCES);
  });
});
