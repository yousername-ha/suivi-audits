/* Migration 059 (ADR 0089, lot 3) : les tables des correspondances entre référentiels et des rapprochements disparaissent
   (dans l'ordre imposé par leurs clés étrangères, historique immuable compris), ainsi que les rappels et réglages de
   notification « rapprochement » ; les référentiels, les liens manuels mesure → exigence, les fiches « mapping » déjà
   importées (historique immuable des objets) et les autres réglages ne sont pas touchés. Données fictives. */
import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS_DIR } from '../src/db/db.js';
import { createDatabase } from './pg.js';
import { createTestApp } from './helpers.js';

const definition = { name: 'Référentiel fictif', requirements: [{ id: 'R1' }] };

describe('migration 059 : retrait des correspondances et des rapprochements', () => {
  it('supprime les trois tables et les notifications associées, sans toucher au reste', async () => {
    const t = await createTestApp({}, { migrate: false, dbName: await createDatabase() });
    try {
      const avant = mkdtempSync(path.join(os.tmpdir(), 'm059-'));
      for (const f of readdirSync(MIGRATIONS_DIR).filter((f) => f < '059'))
        copyFileSync(path.join(MIGRATIONS_DIR, f), path.join(avant, f));
      await t.svc.db.migrate(avant);
      const q = (sql: string, params: unknown[] = []) => t.svc.db.q(sql, params);

      await q(
        "INSERT INTO business_policy_versions (version, definition, reason, created_by) VALUES (1, '{}', 'Fictif', 'fictif')",
      );
      const smsi = (await t.svc.db.one<{ id: string }>(
        "INSERT INTO grc_smsis (name, created_by, business_version) VALUES ('Périmètre fictif', 'fictif', 1) RETURNING id",
      ))!.id;
      // Deux référentiels de la bibliothèque, une correspondance, son historique immuable et un rapprochement.
      const fw = async (identifier: string) =>
        (await t.svc.db.one<{ id: string }>(
          "INSERT INTO lib_frameworks (identifier, name, created_by, updated_by) VALUES ($1, $1, 'fictif', 'fictif') RETURNING id",
          [identifier],
        ))!.id;
      const a = await fw('fictif-a');
      const b = await fw('fictif-b');
      for (const id of [a, b])
        await q(
          "INSERT INTO lib_framework_versions (framework_id, version, definition, reason, created_by) VALUES ($1, 1, $2, 'Fictif', 'fictif')",
          [id, definition],
        );
      const m = await t.svc.db.one<{ id: string }>(
        `INSERT INTO lib_mappings (source_framework_id, source_version, source_requirement_id, target_framework_id, target_version,
           target_requirement_id, type, justification, coverage, origin, status, source_url, created_by, updated_by)
         VALUES ($1, 1, 'R1', $2, 1, 'R1', 'equivalent', 'Correspondance fictive de recette', 100, 'human', 'validated',
           'https://example.invalid/source', 'fictif', 'fictif') RETURNING id`,
        [a, b],
      );
      await q(
        "INSERT INTO lib_mapping_history (mapping_id, version, snapshot, reason, created_by) VALUES ($1, 1, '{}', 'Fictif', 'fictif')",
        [m!.id],
      );
      await q(
        `INSERT INTO grc_rapprochements (smsi_id, measure_ref, source_ref, target_ref, mapping_id, mapping_type, coverage, status)
         VALUES ($1, 'object:x', $2, $3, $4, 'equivalent', 100, 'pending')`,
        [smsi, `requirement:${a}:1:R1`, `requirement:${b}:1:R1`, m!.id],
      );
      // L'historique est bien protégé avant la migration (preuve que le DROP ne contourne rien : il retire la table entière).
      await expect(q('DELETE FROM lib_mapping_history')).rejects.toThrow();

      // Une fiche « mapping » importée avec un référentiel, un lien manuel et un rappel : seule la notification disparaît.
      const fiche = await t.svc.db.one<{ id: string }>(
        "INSERT INTO grc_objects (smsi_id, kind, module, name, data, created_by, updated_by) VALUES ($1, 'mapping', 'conformite', 'Correspondance importée', '{}', 'fictif', 'fictif') RETURNING id",
        [smsi],
      );
      const utilisateur = (await t.svc.db.one<{ id: string }>(
        "INSERT INTO users (username, display_name, password_hash) VALUES ('m059_user', 'Compte fictif', 'x') RETURNING id",
      ))!.id;
      await q(
        `INSERT INTO grc_notifications (smsi_id, object_id, user_id, kind, due_key, title, message)
         VALUES ($1, $2, $3, 'rapprochement', 'k', 'Rapprochements à valider', 'Fictif'),
                ($1, $2, $3, 'task_due', 'k', 'Échéance', 'Fictif')`,
        [smsi, fiche!.id, utilisateur],
      );
      await q(
        `INSERT INTO notification_reglages (portee_kind, portee_id, type, canal, valeur, updated_by)
         VALUES ('utilisateur', $1, 'rapprochement', 'application', false, 'fictif'),
                ('utilisateur', $1, 'task_due', 'application', false, 'fictif')`,
        [utilisateur],
      );
      await q(
        "INSERT INTO grc_links (smsi_id, source_ref, target_ref, type, note, created_by) VALUES ($1, 'object:x', $2, 'implements', 'Lien manuel', 'fictif')",
        [smsi, `requirement:${a}:1:R1`],
      );

      expect(await t.svc.db.migrate()).toContain('059_retrait_correspondances_rapprochements.sql');

      for (const table of ['grc_rapprochements', 'lib_mapping_history', 'lib_mappings'])
        expect((await t.svc.db.one('SELECT to_regclass($1) AS r', [table]))!.r).toBeNull();
      const kinds = await q('SELECT kind FROM grc_notifications WHERE user_id = $1', [utilisateur]);
      expect(kinds.rows).toEqual([{ kind: 'task_due' }]);
      const reglages = await q('SELECT type FROM notification_reglages WHERE portee_id = $1', [utilisateur]);
      expect(reglages.rows).toEqual([{ type: 'task_due' }]);
      // Référentiels, lien manuel et fiche « mapping » (historique des objets) sont conservés.
      expect((await q('SELECT 1 FROM lib_frameworks WHERE id IN ($1, $2)', [a, b])).rows).toHaveLength(2);
      expect(
        (await q('SELECT 1 FROM lib_framework_versions WHERE framework_id IN ($1, $2)', [a, b])).rows,
      ).toHaveLength(2);
      expect((await q("SELECT 1 FROM grc_links WHERE note = 'Lien manuel'")).rows).toHaveLength(1);
      expect((await q("SELECT 1 FROM grc_objects WHERE id = $1 AND kind = 'mapping'", [fiche!.id])).rows).toHaveLength(
        1,
      );
    } finally {
      await t.close();
    }
  });
});
