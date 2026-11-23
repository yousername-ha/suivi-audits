/* Remise à vide (ADR 0065) : classement exhaustif des tables, garde-fous (interrupteur, phrase, code, sauvegarde récente,
   exploitation libre), effacement des deux portées sur des données réelles (triggers d'immuabilité compris), rétablissement
   des triggers, base réutilisable ensuite, journal d'audit conservé. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { REMISE_A_VIDE_PHRASES } from '@suivi/shared';
import { controleRelations } from '../src/controle-relations.js';
import { chargerJeuDeTest } from '../src/jeu-de-test.js';
import { TABLES_CONFIGURATION, TABLES_SYSTEME, TABLES_TRAVAIL, tablesAVider } from '../src/remise-a-vide.js';
import { hotp } from '../src/security/crypto.js';
import { createTestApp, login, makeUser, type Agent, type TestApp, type TestUser } from './helpers.js';

let t: TestApp, admin: TestUser, lecteur: TestUser, a: Agent;
const code = async () => {
  await t.svc.db.q('UPDATE users SET totp_last_step=0 WHERE id=$1', [admin.id]);
  return hotp(admin.key, Math.floor(Date.now() / 30000));
};
const compte = async (table: string) =>
  Number((await t.svc.db.one<{ n: string }>(`SELECT count(*)::text AS n FROM ${table}`))!.n);
const sauvegardeRecente = async (minutesPassees = 1) => {
  await t.svc.db.q('DELETE FROM backup_jobs');
  await t.svc.db.q(
    `INSERT INTO backup_jobs(request_id, status, requested_by, finished_at) VALUES ($1,'reussie','test', now() - ($2 || ' minutes')::interval)`,
    [randomUUID(), String(minutesPassees)],
  );
};
const autoriser = async (v: boolean) =>
  t.svc.remiseAVide.definirAutorisation(v, { id: admin.id, username: admin.username }, '127.0.0.1');
const requete = async (portee: 'travail' | 'tout', changes: Record<string, unknown> = {}) => ({
  requestId: randomUUID(),
  portee,
  confirm: REMISE_A_VIDE_PHRASES[portee],
  code: await code(),
  ...changes,
});

beforeAll(async () => {
  t = await createTestApp();
  admin = await makeUser(t, 'raz-admin', 'admin');
  lecteur = await makeUser(t, 'raz-lecteur', 'ro');
});
afterAll(() => t.close());
beforeEach(async () => {
  t.svc.limits.updateMfaByUser.reset();
  await autoriser(false);
  await t.svc.db.q('DELETE FROM backup_jobs');
  await t.svc.db.q('DELETE FROM operation_jobs');
  a = await login(t, admin);
});

describe('remise à vide : classement des tables', () => {
  it('classe chaque table du schéma, une seule fois, et seulement des tables qui existent', async () => {
    const reel = (
      await t.svc.db.q<{ table_name: string }>(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'",
      )
    ).rows.map((r) => r.table_name);
    const classees = [...TABLES_SYSTEME, ...TABLES_CONFIGURATION, ...TABLES_TRAVAIL];
    expect(new Set(classees).size).toBe(classees.length);
    expect(reel.filter((n) => !classees.includes(n as never))).toEqual([]);
    expect(classees.filter((n) => !reel.includes(n))).toEqual([]);
  });
  it('« travail » n’inclut ni comptes ni réglages ; « tout » ajoute la configuration', () => {
    expect(tablesAVider('travail')).not.toContain('settings');
    expect(tablesAVider('travail')).not.toContain('groups');
    expect(tablesAVider('tout')).toContain('settings');
    expect(tablesAVider('tout')).toContain('groups');
    expect(tablesAVider('tout')).not.toContain('audit_log');
    expect(tablesAVider('tout')).not.toContain('schema_migrations');
  });
});

describe('remise à vide : garde-fous', () => {
  it('est réservée aux administrateurs', async () => {
    const r = await login(t, lecteur);
    expect((await r.get('/api/admin/remise-a-vide')).statusCode).toBe(403);
    expect((await r.post('/api/admin/remise-a-vide', await requete('travail'))).statusCode).toBe(403);
    expect((await r.put('/api/admin/remise-a-vide/autorisation', { autorisee: false })).statusCode).toBe(403);
  });
  it('est interdite par défaut et refusée sans consommer le code', async () => {
    expect((await a.get('/api/admin/remise-a-vide')).json()).toMatchObject({ autorisee: false });
    const res = await a.post('/api/admin/remise-a-vide', await requete('travail'));
    expect(res.statusCode).toBe(403);
    expect(res.json().reason).toBe('interdite');
  });
  it('exige un code pour autoriser, pas pour interdire, et journalise', async () => {
    expect((await a.put('/api/admin/remise-a-vide/autorisation', { autorisee: true })).statusCode).toBe(422);
    expect((await a.put('/api/admin/remise-a-vide/autorisation', { autorisee: true, code: '000000' })).statusCode).toBe(
      401,
    );
    const ok = await a.put('/api/admin/remise-a-vide/autorisation', { autorisee: true, code: await code() });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().autorisee).toBe(true);
    const off = await a.put('/api/admin/remise-a-vide/autorisation', { autorisee: false });
    expect(off.json().autorisee).toBe(false);
    const actions = (
      await t.svc.db.q<{ action: string }>("SELECT action FROM audit_log WHERE action LIKE 'remise_a_vide.%'")
    ).rows.map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(['remise_a_vide.autorisee', 'remise_a_vide.interdite']));
  });
  it('refuse une phrase fausse (celle de l’autre portée comprise), un code faux ou rejoué, et trace le code faux', async () => {
    await autoriser(true);
    await sauvegardeRecente();
    expect(
      (await a.post('/api/admin/remise-a-vide', await requete('tout', { confirm: 'VIDER LES DONNÉES' }))).statusCode,
    ).toBe(422);
    expect((await a.post('/api/admin/remise-a-vide', await requete('travail', { confirm: 'oui' }))).statusCode).toBe(
      422,
    );
    expect((await a.post('/api/admin/remise-a-vide', await requete('travail', { code: '000000' }))).statusCode).toBe(
      401,
    );
    expect(
      (await t.svc.db.q("SELECT 1 FROM audit_log WHERE action='remise_a_vide.mfa_failed'")).rowCount,
    ).toBeGreaterThan(0);
    expect(await compte('users')).toBeGreaterThan(0);
  });
  it('exige une sauvegarde réussie de moins de 30 minutes', async () => {
    await autoriser(true);
    const sans = await a.post('/api/admin/remise-a-vide', await requete('travail'));
    expect(sans.statusCode).toBe(409);
    expect(sans.json().reason).toBe('sauvegarde_requise');
    await sauvegardeRecente(45);
    expect((await a.post('/api/admin/remise-a-vide', await requete('travail'))).statusCode).toBe(409);
    expect((await a.get('/api/admin/remise-a-vide')).json().sauvegarde).toMatchObject({ recente: false });
  });
  it('est refusée pendant une sauvegarde ou une opération d’exploitation', async () => {
    await autoriser(true);
    await sauvegardeRecente();
    await t.svc.db.q(`INSERT INTO backup_jobs(request_id, status, requested_by) VALUES ($1,'en_cours','test')`, [
      randomUUID(),
    ]);
    expect((await a.post('/api/admin/remise-a-vide', await requete('travail'))).statusCode).toBe(409);
  });
});

describe('remise à vide : effacement', () => {
  it('portée « travail » : efface les données (triggers d’immuabilité compris), garde comptes et réglages, rétablit les triggers', async () => {
    await chargerJeuDeTest(t.svc, t.app, admin.username, { publicUrl: 'https://suivi.test' });
    const avant = {
      objets: await compte('grc_objects'),
      versions: await compte('grc_object_versions'),
      methodes: await compte('grc_method_versions'),
      evaluations: await compte('sup_evaluations'),
    };
    expect(avant.objets).toBeGreaterThan(0);
    expect(avant.versions + avant.methodes + avant.evaluations).toBeGreaterThan(0);
    const auditAvant = await compte('audit_log');
    const comptesAvant = await compte('users');
    // Lot PRIO-1 (décision du RSSI du 20/11/2026) : fréquences choisies pour la veille, et état d'une source (à effacer).
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_veille_sources (source, frequence_heures, derniere_reussite, planifiee_le)
       VALUES ('cisa-kev', 12, now(), now()), ('nvd', 4, NULL, now()), ('cert-fr', NULL, now(), NULL)
       ON CONFLICT (source) DO UPDATE SET frequence_heures = EXCLUDED.frequence_heures,
         derniere_reussite = EXCLUDED.derniere_reussite, planifiee_le = EXCLUDED.planifiee_le`,
    );
    // Décision du RSSI du 23/11/2026 : réglages des sources facultatives (activation, fréquence) à garder, état à effacer ;
    // une source jamais réglée n'est pas recréée ; annonces et journal des collectes effacés.
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_veille_annonces_sources
         (source, activee, frequence_minutes, planifiee_le, derniere_reussite, dernier_essai, erreur, version)
       VALUES ('cloudflare-radar', true, 30, now(), now(), now(), 'Erreur fictive.', 4), ('tldrcve', false, NULL, now(), NULL, now(), NULL, 2)
       ON CONFLICT (source) DO UPDATE SET activee = EXCLUDED.activee, frequence_minutes = EXCLUDED.frequence_minutes`,
    );
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_veille_annonces (source, identifiant, cves, titre)
       VALUES ('cloudflare-radar', 'cf-fictif', '{CVE-2026-90001}', 'Préavis fictif')`,
    );
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_veille_annonces_collectes (source, origine, etat, demande_par, demande_le, debute_le, termine_le)
       VALUES ('cloudflare-radar', 'planifie', 'recu', 'planification', now(), now(), now())`,
    );
    await autoriser(true);
    await sauvegardeRecente();

    const res = await a.post('/api/admin/remise-a-vide', await requete('travail'));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ portee: 'travail', jeton: false });
    // Fréquences gardées, état des sources reparti de zéro ; une source sans fréquence choisie n'est pas recréée.
    expect(
      (
        await t.svc.db.q(
          'SELECT source, frequence_heures, derniere_reussite, planifiee_le FROM vulnerabilites_veille_sources ORDER BY source',
        )
      ).rows,
    ).toEqual([
      { source: 'cisa-kev', frequence_heures: 12, derniere_reussite: null, planifiee_le: null },
      { source: 'nvd', frequence_heures: 4, derniere_reussite: null, planifiee_le: null },
    ]);
    // Sources facultatives : activation et fréquence gardées, état reparti de zéro ; données collectées effacées.
    expect(
      (
        await t.svc.db.q(
          `SELECT source, activee, frequence_minutes, planifiee_le, derniere_reussite, dernier_essai, erreur
           FROM vulnerabilites_veille_annonces_sources ORDER BY source`,
        )
      ).rows,
    ).toEqual([
      {
        source: 'cloudflare-radar',
        activee: true,
        frequence_minutes: 30,
        planifiee_le: null,
        derniere_reussite: null,
        dernier_essai: null,
        erreur: null,
      },
    ]);
    expect(await compte('vulnerabilites_veille_annonces')).toBe(0);
    expect(await compte('vulnerabilites_veille_annonces_collectes')).toBe(0);
    expect((await t.svc.vulnerabilites.annonces.etat()).map((e) => [e.source, e.activee, e.frequenceMinutes])).toEqual([
      ['cloudflare-radar', true, 30],
      ['tldrcve', false, 1440],
    ]);

    for (const table of [
      'grc_objects',
      'grc_object_versions',
      'grc_method_versions',
      'sup_evaluations',
      'sup_criterion_links',
      'documents',
      'links',
    ])
      expect(await compte(table)).toBe(0);
    expect(await compte('users')).toBe(comptesAvant);
    expect(await compte('roles')).toBeGreaterThan(0);
    expect(await compte('audit_log')).toBeGreaterThan(auditAvant);
    expect(
      (await t.svc.db.q("SELECT 1 FROM audit_log WHERE action='remise_a_vide.executee' AND target='travail'")).rowCount,
    ).toBe(1);
    // Les triggers d'immuabilité sont rétablis (aucun reste désactivé) et la suppression est de nouveau refusée.
    const desactives = await t.svc.db.q(
      "SELECT c.relname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE NOT t.tgisinternal AND t.tgenabled <> 'O'",
    );
    expect(desactives.rows).toEqual([]);
    await expect(t.svc.db.q('DELETE FROM audit_log')).rejects.toThrow(/ajout seul|immuable/i);
    // La session reste valable, l'état initial est reconstitué et le jeu de test peut être rechargé.
    expect((await a.get('/api/auth/me')).json()).toMatchObject({ stage: 'ok' });
    expect(await compte('app_state')).toBe(1);
    const bilan = await chargerJeuDeTest(t.svc, t.app, admin.username, { publicUrl: 'https://suivi.test' });
    expect(bilan.etat).toBe('oui');
    const relations = await controleRelations(t.svc);
    expect(relations.ok).toBe(true);
  }, 120_000);

  it('portée « tout » : efface aussi comptes, groupes, rôles personnalisés et réglages, et réémet le jeton d’installation', async () => {
    await t.svc.db.q(
      "INSERT INTO roles(id, name, system) VALUES ('perso_raz','Rôle perso', false) ON CONFLICT DO NOTHING",
    );
    await t.svc.db.q("INSERT INTO groups(name) VALUES ('Groupe raz') ON CONFLICT DO NOTHING");
    // Flux vers l'extérieur (ADR 0097) : décision de l'administrateur, ni rouverte ni refermée par la remise à vide.
    await t.svc.flux.changer('assistant', true, { id: admin.id, username: admin.username }, '127.0.0.1');
    const rolesSysteme = Number(
      (await t.svc.db.one<{ n: string }>('SELECT count(*)::text n FROM roles WHERE system'))!.n,
    );
    await autoriser(true);
    await sauvegardeRecente();

    await t.svc.db.q(
      `INSERT INTO vulnerabilites_veille_sources (source, frequence_heures) VALUES ('cisa-kev', 12)
       ON CONFLICT (source) DO UPDATE SET frequence_heures = EXCLUDED.frequence_heures`,
    );
    await t.svc.db.q(
      `INSERT INTO vulnerabilites_veille_annonces_sources (source, activee, frequence_minutes) VALUES ('cloudflare-radar', true, 60)
       ON CONFLICT (source) DO UPDATE SET activee = EXCLUDED.activee, frequence_minutes = EXCLUDED.frequence_minutes`,
    );
    const res = await a.post('/api/admin/remise-a-vide', await requete('tout'));
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ portee: 'tout', jeton: true });
    // Lot PRIO-1 : la portée « tout » efface aussi la configuration, fréquences de la veille comprises.
    expect(await compte('vulnerabilites_veille_sources')).toBe(0);
    // Décision du RSSI du 23/11/2026 : réglages des sources facultatives effacés aussi par la portée « tout ».
    expect(await compte('vulnerabilites_veille_annonces_sources')).toBe(0);

    expect(await compte('users')).toBe(0);
    expect(await compte('sessions')).toBe(0);
    expect(await compte('groups')).toBe(0);
    expect(Number((await t.svc.db.one<{ n: string }>('SELECT count(*)::text n FROM roles WHERE NOT system'))!.n)).toBe(
      0,
    );
    expect(Number((await t.svc.db.one<{ n: string }>('SELECT count(*)::text n FROM roles WHERE system'))!.n)).toBe(
      rolesSysteme,
    );
    expect(await t.svc.auth.setupPending()).toBe(true);
    expect(await t.svc.remiseAVide.autorisee()).toBe(false);
    expect(await t.svc.flux.ouvert('assistant')).toBe(true);
    expect(await t.svc.flux.ouvert('courriel')).toBe(false);
    expect(
      (await t.svc.db.q("SELECT 1 FROM audit_log WHERE action='remise_a_vide.executee' AND target='tout'")).rowCount,
    ).toBe(1);
    // Le service reste exploitable : état initial reconstitué, API publique de configuration répond.
    expect(await compte('app_state')).toBe(1);
    const anonyme = await t.app.inject({
      method: 'GET',
      url: '/api/setup',
      headers: { host: 'suivi.test', 'x-forwarded-proto': 'https' },
    });
    expect(anonyme.statusCode).toBe(200);
  }, 120_000);
});
