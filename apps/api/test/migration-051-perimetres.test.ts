/* Migration 051 (ADR 0039 amendée le 01/11/2026) : un périmètre est une organisation ou un fournisseur. Sur une base arrêtée
   à la 050, les périmètres marqués « entité » ou « périmètre » deviennent « organisation », sans perte de parent, d'héritage
   ni de ligne. Données fictives. */
import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS_DIR } from '../src/db/db.js';
import { createDatabase } from './pg.js';
import { createTestApp } from './helpers.js';

describe('migration 051 : périmètres organisation ou fournisseur', () => {
  it('convertit « entité » et « périmètre » en « organisation » et garde la hiérarchie', async () => {
    const t = await createTestApp({}, { migrate: false, dbName: await createDatabase() });
    try {
      const avant = mkdtempSync(path.join(os.tmpdir(), 'm051-'));
      for (const f of readdirSync(MIGRATIONS_DIR).filter((f) => /^0([0-4]\d|50)_.*\.sql$/.test(f)))
        copyFileSync(path.join(MIGRATIONS_DIR, f), path.join(avant, f));
      await t.svc.db.migrate(avant);
      // Version de politique métier fictive : un périmètre en exige une (clé étrangère).
      const bv = await t.svc.db.one<{ v: number }>(
        `INSERT INTO business_policy_versions (version, definition, reason, created_by)
         VALUES ((SELECT COALESCE(MAX(version), 0) + 1 FROM business_policy_versions), '{}', 'Test fictif', 'fictif')
         RETURNING version AS v`,
      );
      const inserer = async (name: string, kind: string, parent: string | null, inherit = false) =>
        (await t.svc.db.one<{ id: string }>(
          `INSERT INTO grc_smsis (name, entity_kind, parent_id, inherit_frameworks, business_version, created_by)
           VALUES ($1, $2, $3, $4, $5, 'fictif') RETURNING id`,
          [name, kind, parent, inherit, bv!.v],
        ))!.id;
      const groupe = await inserer('Groupe fictif', 'organisation', null);
      const entite = await inserer('Entité fictive', 'entite', groupe, true);
      const service = await inserer('Service fictif', 'perimetre', entite, true);

      expect(await t.svc.db.migrate()).toEqual([
        '051_perimetres_organisation_fournisseur.sql',
        '052_referentiels_copies_perimetre.sql',
        '053_retrait_crrc_investissements.sql',
        '054_retrait_revues_acces.sql',
        '055_assistant.sql',
        '056_assistant_rondes.sql',
        '057_assistant_apprentissage.sql',
        '058_assistant_rondes_actions.sql',
        '059_assistant_questions.sql',
      ]);
      const { rows: lignes } = await t.svc.db.q<{
        id: string;
        entity_kind: string;
        parent_id: string | null;
        inherit: boolean;
      }>('SELECT id, entity_kind, parent_id, inherit_frameworks AS inherit FROM grc_smsis ORDER BY name');
      const de = (id: string) => lignes.find((l) => l.id === id);
      expect(lignes).toHaveLength(3);
      expect(de(groupe)).toMatchObject({ entity_kind: 'organisation', parent_id: null });
      expect(de(entite)).toMatchObject({ entity_kind: 'organisation', parent_id: groupe, inherit: true });
      expect(de(service)).toMatchObject({ entity_kind: 'organisation', parent_id: entite, inherit: true });
      // Après migration : fournisseur accepté, organisation par défaut, anciennes étiquettes refusées.
      expect(await inserer('Fournisseur fictif', 'fournisseur', groupe)).toBeTruthy();
      await expect(inserer('Ancienne étiquette', 'entite', groupe)).rejects.toThrow(/grc_smsis_entity_kind_check/);
      const defaut = await t.svc.db.one<{ entity_kind: string }>(
        `INSERT INTO grc_smsis (name, business_version, created_by) VALUES ('Sans type', $1, 'fictif') RETURNING entity_kind`,
        [bv!.v],
      );
      expect(defaut!.entity_kind).toBe('organisation');
    } finally {
      await t.close();
    }
  });
});
