import crypto from 'node:crypto';
import { copyFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { Db, MIGRATIONS_DIR } from '../src/db/db.js';
import { lireCatalogue, rendreTypes } from '../src/db/introspection.js';
import { createLogger } from '../src/log.js';
import { hashPassword, hotp, sha256hex, Vault } from '../src/security/crypto.js';
import { Agent, createTestApp, PASSWORD, REPO, type TestApp } from './helpers.js';
import { APP_ROLE, APP_ROLE_PASSWORD, createDatabase, PG } from './pg.js';

const opened: TestApp[] = [];
afterAll(async () => {
  for (const t of opened) await t.close();
});

describe('schéma', () => {
  it('les types Kysely versionnés correspondent exactement à la base migrée (ADR 0062)', async () => {
    const t = await createTestApp();
    opened.push(t);
    const c = await t.svc.db.pool.connect();
    try {
      const { colonnes, enums, checks } = await lireCatalogue(c);
      const attendu = readFileSync(
        path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/db/types.generated.ts'),
        'utf8',
      );
      expect(rendreTypes(colonnes, enums, checks), 'pnpm --filter @suivi/api db:types').toBe(attendu);
      expect(colonnes.length).toBeGreaterThan(500);
    } finally {
      c.release();
    }
  });

  it('chaque table métier porte version, legacy_id (unique), import_batch_id et extra', async () => {
    const t = opened[0]!;
    for (const name of ['documents', 'links', 'maps']) {
      const cols = (
        await t.svc.db.q<{ column_name: string }>(
          'SELECT column_name FROM information_schema.columns WHERE table_name=$1',
          [name],
        )
      ).rows.map((c) => c.column_name);
      expect(cols).toEqual(expect.arrayContaining(['version', 'legacy_id', 'import_batch_id', 'extra']));
      const idx = await t.svc.db.one<{ indexdef: string }>(
        'SELECT indexdef FROM pg_indexes WHERE tablename=$1 AND indexname=$2',
        [name, `${name}_legacy_id`],
      );
      expect(idx!.indexdef).toMatch(/UNIQUE/);
    }
  });

  it('les migrations sont idempotentes', async () => {
    expect(await opened[0]!.svc.db.migrate()).toEqual([]);
  });

  it('les migrations ne requièrent pas de superutilisateur', async () => {
    const r = await opened[0]!.svc.db.one<{ rolsuper: boolean }>(
      'SELECT rolsuper FROM pg_roles WHERE rolname = current_user',
    );
    expect(r!.rolsuper).toBe(false);
  });

  it('001_init.sql est strictement identique au schéma publié en v2 (une migration publiée ne change jamais)', () => {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, '001_init.sql'));
    expect(sha256hex(sql)).toBe('8812f0ed1290a6916e676be9a5f85a1a3e669512585417367175608490df56ae');
  });
});

describe('migration d’une base v2 existante, sans perte', () => {
  it('reprend comptes, sessions, documents chiffrés, liens, état, historique et journal', async () => {
    // 1. Base v2 : uniquement 001_init.sql, comme l'application v2 la laissait.
    const dbName = await createDatabase();
    const log = createLogger('silent');
    const v2 = new Db(
      {
        host: PG.host,
        port: PG.port,
        database: dbName,
        user: APP_ROLE,
        password: APP_ROLE_PASSWORD,
        ssl: false,
        max: 2,
      },
      log,
    );
    const onlyV2 = mkdtempSync(path.join(os.tmpdir(), 'v2-'));
    copyFileSync(path.join(MIGRATIONS_DIR, '001_init.sql'), path.join(onlyV2, '001_init.sql'));
    expect(await v2.migrate(onlyV2)).toEqual(['001_init.sql']);

    // 2. Données v2 (formats v2 : scrypt, TOTP chiffré, document AES-256-GCM, état legacy).
    const masterKey = crypto.randomBytes(32).toString('base64');
    const vault = new Vault(masterKey);
    const totpKey = crypto.randomBytes(20);
    const uid = (await v2.one<{ id: string }>(
      "INSERT INTO users(username, display_name, role, password_hash, totp_enabled) VALUES ('rssi','RSSI','admin',$1,true) RETURNING id",
      [await hashPassword(PASSWORD)],
    ))!.id;
    await v2.q('UPDATE users SET totp_secret=$2 WHERE id=$1', [uid, vault.sealSmall(totpKey, 'totp:' + uid)]);
    await v2.q(
      "INSERT INTO users(username, role, password_hash) VALUES ('adjoint', 'rw', 'x'), ('alternant', 'ro', 'x')",
    );
    const file = Buffer.from('Contenu de la politique v2');
    const docId = (await v2.one<{ id: string }>(
      "INSERT INTO documents(title, refs, current_version, created_by, updated_by) VALUES ('Politique v2', '{A.5.1}', 1, 'rssi', 'rssi') RETURNING id",
    ))!.id;
    const e = vault.encrypt(file, `doc:${docId}:1`);
    await v2.q(
      `INSERT INTO document_versions(document_id, version, filename, mime, size, sha256, key_id, iv, auth_tag, content, uploaded_by)
       VALUES ($1,1,'politique.txt','text/plain',$2,$3,$4,$5,$6,$7,'rssi')`,
      [docId, file.length, sha256hex(file), e.keyId, e.iv, e.tag, e.content],
    );
    await v2.q(
      "INSERT INTO links(title, url, created_by, updated_by) VALUES ('Intranet', 'https://intranet.invalid', 'rssi', 'rssi')",
    );
    const state = JSON.parse(readFileSync(path.join(REPO, 'apps/api/seed/state.json'), 'utf8'));
    state.findings = [
      { id: 'ID-001', source: 'AFNOR', year: 2026, type: 'NC min', status: 'Ouvert', text: 'Écart de test', items: [] },
    ];
    await v2.q("INSERT INTO app_state(id, version, data, sha256, updated_by) VALUES (1, 7, $1, 'x', 'rssi')", [state]);
    await v2.q(
      "INSERT INTO state_history(version, data, sha256, updated_at, updated_by) VALUES (6, $1, 'x', now(), 'rssi'), (7, $1, 'x', now(), 'rssi')",
      [state],
    );
    await v2.q("INSERT INTO audit_log(username, action) VALUES ('rssi', 'auth.login'), ('rssi', 'state.write')");
    const before = await v2.one<
      Record<string, number>
    >(`SELECT (SELECT count(*) FROM users)::int u, (SELECT count(*) FROM documents)::int d,
      (SELECT count(*) FROM document_versions)::int dv, (SELECT count(*) FROM links)::int l, (SELECT count(*) FROM state_history)::int h,
      (SELECT count(*) FROM audit_log)::int a`);
    await v2.end();

    // 3. Démarrage de la v3 sur cette base : migrations 002+ appliquées automatiquement.
    const t = await createTestApp({ DOC_MASTER_KEY: masterKey }, { dbName, poivre: false });
    opened.push(t);
    const applied = (await t.svc.db.q<{ name: string }>('SELECT name FROM schema_migrations ORDER BY name')).rows.map(
      (r) => r.name,
    );
    expect(applied).toEqual([
      '001_init.sql',
      '002_v3_fondations.sql',
      '003_droits.sql',
      '004_affichage_et_ecrans_muraux.sql',
      '005_cartographie.sql',
      '006_sauvegardes.sql',
      '007_exploitation.sql',
      '008_activation_modules.sql',
      '009_mises_a_jour.sql',
      '010_configuration_environnement.sql',
      '011_evaluations_versionnees.sql',
      '012_catalogues_metier.sql',
      '013_socle_smsi_grc.sql',
      '014_automatisation_smsi.sql',
      '015_pilotage_decisions.sql',
      '016_risques_acceptation.sql',
      '017_perimetres_nature.sql',
      '018_bibliotheque_referentiels.sql',
      '019_correspondances_rapprochements.sql',
      '020_fournisseurs_organisation.sql',
      '021_catalogue_configuration.sql',
      '022_hierarchie_perimetres.sql',
      '023_investissements_tables.sql',
      '024_collections_suivi_tables.sql',
      '025_cles_multi_listes_tables.sql',
      '026_coeur_suivi_tables.sql',
      '027_evaluations_exigences.sql',
      '028_sous_listes_en_tables.sql',
      '029_registres_droits_ressources.sql',
      '030_validations_occurrences.sql',
      '031_fonctions_responsables.sql',
      '032_plans_actions_conteneurs.sql',
      '033_retrait_constats_historiques.sql',
      '034_journal_technique.sql',
      '035_types_processus.sql',
      '036_contributions_elements.sql',
      '037_retrait_environnement.sql',
      '038_parcours_associations.sql',
      '039_calendriers_plateforme.sql',
      '040_courriel_jobs.sql',
      '041_tls_modes.sql',
      '042_kit_ia.sql',
      '043_retrait_conformite_ia.sql',
      '044_notifications_metier.sql',
      '045_courriel_relances.sql',
      '046_alertes_securite_notifications.sql',
      '047_tableaux_de_bord.sql',
      '048_webauthn.sql',
      '049_retex_contributions.sql',
      '050_tableaux_de_bord_partages.sql',
    ]);
    // Rôles v2 repris : admin → Administrateur, rw → Contributeur, ro → Lecteur ; colonne users.role supprimée.
    const mapped = await t.svc.db.q<{ username: string; role_id: string }>(
      'SELECT u.username, ur.role_id FROM users u JOIN user_roles ur ON ur.user_id = u.id ORDER BY u.username',
    );
    expect(mapped.rows).toEqual([
      { username: 'adjoint', role_id: 'contributeur' },
      { username: 'alternant', role_id: 'lecteur' },
      { username: 'rssi', role_id: 'administrateur' },
    ]);
    await expect(t.svc.db.q('SELECT role FROM users')).rejects.toThrow(/role/);
    const after = await t.svc.db.one<
      Record<string, number>
    >(`SELECT (SELECT count(*) FROM users)::int u, (SELECT count(*) FROM documents)::int d,
      (SELECT count(*) FROM document_versions)::int dv, (SELECT count(*) FROM links)::int l, (SELECT count(*) FROM state_history)::int h,
      (SELECT count(*) FROM audit_log)::int a`);
    expect(after).toEqual(before);
    expect((await t.svc.db.one<{ version: number }>('SELECT version FROM documents'))!.version).toBe(1);

    // 4. Empreinte v2 non poivrée : refusée et journalisée (ADR 0072, aucune mise à jour sans installation neuve). Reprise d'une
    //    base sans poivre : la procédure d'urgence `suivi poivre-reinitialiser` donne un mot de passe temporaire à chaque compte.
    const refus = await new Agent(t).post('/api/auth/login', { username: 'rssi', password: PASSWORD });
    expect(refus.statusCode).toBe(401);
    expect(
      (await t.svc.db.q("SELECT 1 FROM audit_log WHERE action='securite.poivre_integrite' AND target=$1", [uid]))
        .rowCount,
    ).toBe(1);
    const reprise = await t.svc.motsDePasse.reinitialiser({ username: 'cli' });
    expect(reprise.comptes.map((c) => c.username).sort()).toEqual(['adjoint', 'alternant', 'rssi']);
    const temporaire = reprise.comptes.find((c) => c.username === 'rssi')!.motDePasse;
    t.svc.limits.loginByIp.reset();
    t.svc.limits.loginByUser.reset();

    // 5. Tout reste utilisable : connexion (mot de passe et TOTP v2), document déchiffré, état servi à /legacy.
    const a = new Agent(t);
    expect((await a.post('/api/auth/login', { username: 'rssi', password: temporaire })).json()).toEqual({
      stage: 'mfa',
    });
    await a.me();
    expect((await a.post('/api/auth/mfa', { code: hotp(totpKey, Math.floor(Date.now() / 30000)) })).json()).toEqual({
      stage: 'password',
    });
    await a.me();
    expect((await a.post('/api/account/password', { current: temporaire, next: PASSWORD })).json()).toEqual({
      stage: 'ok',
    });
    await a.me();
    const dl = await a.get(`/api/documents/${docId}/download`);
    expect(dl.statusCode).toBe(200);
    expect(dl.rawPayload.equals(file)).toBe(true);
    const st = await a.get('/api/suivi/etat');
    expect(st.headers.etag).toBe('"v7"');
    // Les constats historiques sont retirés par la migration 033 : il n'en reste aucun (les écarts sont dans les registres).
    expect(st.json().findings).toEqual([]);
    // L'état n'a pas été réinitialisé par l'amorçage (seed) : la base contenait déjà des données.
    expect((await t.svc.db.one<{ version: number }>('SELECT version FROM app_state'))!.version).toBe(7);
    await expect(t.svc.db.q('DELETE FROM audit_log')).rejects.toThrow(/ajout seul/);
  });
});
