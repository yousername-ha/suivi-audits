/* Migration 052 (ADR 0082) : sur une base arrêtée à la 051, chaque rattachement existant devient une copie propre au
   périmètre, appliquée, sauf celui qui ne fait que reprendre, à la même édition, le référentiel hérité d'un ancêtre (« Désactiver
   ici ») : il reste une surcharge qui suit la copie de l'ancêtre. Évaluations et liens restent valables sans réécriture.
   Données fictives. */
import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { nomCopiePerimetre } from '@suivi/shared';
import { MIGRATIONS_DIR } from '../src/db/db.js';
import { createDatabase } from './pg.js';
import { createTestApp } from './helpers.js';

const definition = (ids: string[]) =>
  JSON.stringify({
    name: 'Référentiel fictif',
    identifier: 'MIG-FICTIF',
    source: {
      organisation: 'Organisation fictive',
      document: 'Document de recette',
      url: 'https://example.invalid/recette',
      version: '1',
      date: '2026-11-05',
      license: 'Données fictives de test',
      verifiedAt: '',
      normative: false,
      status: 'organisation',
    },
    domains: [{ id: 'gouvernance', label: 'Gouvernance' }],
    requirements: ids.map((id) => ({
      id,
      domain: 'gouvernance',
      title: `Exigence ${id}`,
      description: 'Fictif',
      applicability: 'Tout',
      measureRefs: [],
    })),
  });

describe('migration 052 : rattachements convertis en copies des périmètres', () => {
  it('donne une copie à chaque rattachement propre, garde les surcharges héritées et ne perd aucune évaluation', async () => {
    const t = await createTestApp({}, { migrate: false, dbName: await createDatabase() });
    try {
      const avant = mkdtempSync(path.join(os.tmpdir(), 'm052-'));
      for (const f of readdirSync(MIGRATIONS_DIR).filter((f) => /^0([0-4]\d|5[01])_.*\.sql$/.test(f)))
        copyFileSync(path.join(MIGRATIONS_DIR, f), path.join(avant, f));
      await t.svc.db.migrate(avant);
      const bv = await t.svc.db.one<{ v: number }>(
        `INSERT INTO business_policy_versions (version, definition, reason, created_by)
         VALUES ((SELECT COALESCE(MAX(version), 0) + 1 FROM business_policy_versions), '{}', 'Test fictif', 'fictif')
         RETURNING version AS v`,
      );
      const perimetre = async (name: string, parent: string | null, inherit: boolean) =>
        (await t.svc.db.one<{ id: string }>(
          `INSERT INTO grc_smsis (name, parent_id, inherit_frameworks, business_version, created_by)
           VALUES ($1, $2, $3, $4, 'fictif') RETURNING id`,
          [name, parent, inherit, bv!.v],
        ))!.id;
      const groupe = await perimetre('Groupe', null, false);
      const hopital = await perimetre('Hôpital', groupe, true);
      const labo = await perimetre('Laboratoire', hopital, true);
      const clinique = await perimetre('Clinique', groupe, true);
      const service = await perimetre('Service autonome', groupe, false);
      const fw = (await t.svc.db.one<{ id: string }>(
        `INSERT INTO lib_frameworks (identifier, name, version, created_by, updated_by)
         VALUES ('MIG-FICTIF', 'Référentiel fictif', 2, 'fictif', 'fictif') RETURNING id`,
      ))!.id;
      for (const [v, ids] of [
        [1, ['R1', 'R2']],
        [2, ['R1', 'R2', 'R3']],
      ] as const)
        await t.svc.db.q(
          `INSERT INTO lib_framework_versions (framework_id, version, definition, reason, created_by)
           VALUES ($1, $2, $3, 'Publication fictive', 'fictif')`,
          [fw, v, definition([...ids])],
        );
      const rattacher = (smsi: string, version: number, enabled: boolean) =>
        t.svc.db.q(
          `INSERT INTO grc_scope_frameworks (smsi_id, framework_id, version, enabled, attached_by)
           VALUES ($1, $2, $3, $4, 'fictif')`,
          [smsi, fw, version, enabled],
        );
      await rattacher(groupe, 1, true);
      await rattacher(hopital, 1, false); // « Désactiver ici » : reprise de l'édition héritée
      await rattacher(clinique, 2, true); // sa propre édition, différente de celle du groupe
      await rattacher(service, 1, true); // n'hérite pas : rattachement propre
      await t.svc.db.q(
        `INSERT INTO grc_requirement_assessments
           (smsi_id, framework_id, framework_version, requirement_id, version, applicability, reason, created_by)
         VALUES ($1, $2, 1, 'R1', 1, 'applicable', 'Évaluation fictive', 'fictif')`,
        [groupe, fw],
      );

      expect(await t.svc.db.migrate()).toEqual([
        '052_referentiels_copies_perimetre.sql',
        '053_retrait_crrc_investissements.sql',
        '054_retrait_revues_acces.sql',
        '055_assistant.sql',
        '056_assistant_rondes.sql',
        '057_assistant_apprentissage.sql',
        '058_assistant_rondes_actions.sql',
      ]);

      const { rows } = await t.svc.db.q<{
        smsi_id: string;
        version: number;
        copy_version: number | null;
        status: string;
      }>('SELECT smsi_id, version, copy_version, status FROM grc_scope_frameworks');
      const ligne = (id: string) => rows.find((r) => r.smsi_id === id);
      expect(rows).toHaveLength(4);
      expect(ligne(groupe)).toMatchObject({ version: 1, copy_version: 1, status: 'applique' });
      expect(ligne(hopital)).toMatchObject({ version: 1, copy_version: null });
      expect(ligne(clinique)).toMatchObject({ version: 2, copy_version: 1, status: 'applique' });
      expect(ligne(service)).toMatchObject({ version: 1, copy_version: 1, status: 'applique' });
      const copies = await t.svc.db.q<{ smsi_id: string; source_version: number; n: number; nom: string }>(
        `SELECT smsi_id, source_version, jsonb_array_length(definition->'requirements')::int AS n,
                definition->>'name' AS nom
         FROM grc_framework_copy_versions ORDER BY smsi_id`,
      );
      expect(copies.rows).toHaveLength(3);
      expect(copies.rows.find((c) => c.smsi_id === clinique)).toMatchObject({
        source_version: 2,
        n: 3,
        nom: 'Référentiel fictif (PRIVE - Clinique)',
      });
      // Même règle de nom qu'à l'attribution (nomCopiePerimetre).
      expect(copies.rows.find((c) => c.smsi_id === groupe)!.nom).toBe(
        nomCopiePerimetre('Référentiel fictif', 'Groupe'),
      );

      // Lecture par l'application : héritage de la copie du groupe, surcharge de l'hôpital propagée au laboratoire.
      const eff = async (id: string) => (await t.svc.grc.effectiveFrameworks(id))[0];
      expect(await eff(groupe)).toMatchObject({ detenteurId: groupe, statut: 'applique', suivi: true });
      expect(await eff(hopital)).toMatchObject({
        detenteurId: groupe,
        origineId: hopital,
        enabled: false,
        suivi: false,
      });
      expect(await eff(labo)).toMatchObject({ detenteurId: groupe, enabled: false, suivi: false });
      expect(await eff(clinique)).toMatchObject({ detenteurId: clinique, version: 2, suivi: true });
      expect(await eff(service)).toMatchObject({ detenteurId: service, suivi: true });
      // L'évaluation existante reste celle de l'exigence, sans réécriture.
      const ev = await t.svc.grc.evaluations.courantes(groupe, [fw]);
      expect(ev.get(`${fw}:R1`)).toMatchObject({ applicability: 'applicable', frameworkVersion: 1 });
    } finally {
      await t.close();
    }
  });
});
