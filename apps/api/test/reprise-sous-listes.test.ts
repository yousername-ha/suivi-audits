/* Sous-listes de l'outil de suivi en tables liées (ADR 0040, migration 028) : tâches d'un écart (jusqu'à leur retrait par la
   migration 033) et valeurs d'un indicateur. La copie SQL et l'écriture par la correspondance restituent exactement la valeur
   d'origine, entrées atypiques comprises. Données fictives. */
import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type Json, type JsonObject } from '@suivi/shared/legacy';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS_DIR } from '../src/db/db.js';
import { ecrireCollection } from '../src/historique/tables/collection.js';
import { COLLECTIONS_COEUR } from '../src/historique/tables/coeur.js';
import { createTestApp } from './helpers.js';
import { createDatabase } from './pg.js';

const ETAT: JsonObject = {
  findings: [
    {
      id: 'F-1',
      type: 'NC mineure',
      tasks: [
        { id: 'TK-1', t: 'Première tâche', done: true, createdAt: '2026-10-01T08:00', inconnu: { garde: [1, 2] } },
        'tâche atypique',
        { t: 'Sans identifiant', done: 'oui' }, // type inattendu : conservé dans extra
        { t: 'Tâche nulle', done: null },
      ],
    },
    { id: 'F-2', tasks: [] }, // liste vide : conservée
    { id: 'F-3', tasks: 'texte' }, // valeur d'un autre type : conservée
    { id: 'F-4' }, // champ absent : reste absent
    { id: 'F-5', tasks: [{ t: 'Seule tâche', done: false }] },
  ],
  indicators: [
    {
      id: 'IND-1',
      name: 'Indicateur fictif',
      values: [
        { id: 'IV-1', date: '2026-01', v: 1.5, note: 'n', hist: 'h', autre: 1 },
        { date: '2026-02', v: '12' }, // texte : conservé dans extra
        7,
        { date: '2026-04', v: 0 },
      ],
    },
    { id: 'IND-2', values: [] },
    { id: 'IND-3' },
  ],
};
const CLES = ['indicators'];
const spec = (k: string) => COLLECTIONS_COEUR.find((s) => s.key === k)!;

describe('sous-listes en tables liées (migration 028)', () => {
  it('la copie SQL restitue les sous-listes à l’identique et ne modifie pas la colonne du parent', async () => {
    const dbName = await createDatabase();
    const t = await createTestApp({}, { migrate: false, dbName });
    try {
      const avant = mkdtempSync(path.join(os.tmpdir(), 'sl-'));
      for (const f of readdirSync(MIGRATIONS_DIR).filter((x) => x < '026'))
        copyFileSync(path.join(MIGRATIONS_DIR, f), path.join(avant, f));
      await t.svc.db.migrate(avant);
      await t.svc.db.q("INSERT INTO app_state (id, version, data, sha256, updated_by) VALUES (1, 1, $1, 'x', 'v2')", [
        ETAT,
      ]);
      // Jusqu'à la migration 032 : les écarts historiques et leurs tâches sont encore en tables.
      const jusqua032 = mkdtempSync(path.join(os.tmpdir(), 'sl2-'));
      for (const f of readdirSync(MIGRATIONS_DIR).filter((x) => x < '033'))
        copyFileSync(path.join(MIGRATIONS_DIR, f), path.join(jusqua032, f));
      expect(await t.svc.db.migrate(jusqua032)).toEqual(
        expect.arrayContaining(['026_coeur_suivi_tables.sql', '028_sous_listes_en_tables.sql']),
      );
      const etat = (await t.svc.legacy.recompose())!.data;
      for (const k of CLES) expect(etat[k], k).toEqual(ETAT[k]);
      // Lignes liées : ordre, colonnes typées, extra et entrée atypique.
      const taches = (
        await t.svc.db.q<{ id: string; position: number; t: string | null; done: boolean | null; extra: JsonObject }>(
          "SELECT p.id AS pid, k.id, k.position, k.t, k.done, k.extra FROM suivi_ecarts_taches k JOIN suivi_ecarts p ON p.seq = k.parent_seq WHERE p.id = 'F-1' ORDER BY k.position",
        )
      ).rows;
      expect(taches.map((x) => x.position)).toEqual([0, 1, 2, 3]);
      expect(taches[0]).toMatchObject({ id: 'TK-1', t: 'Première tâche', done: true });
      expect(taches[0]!.extra).toEqual({ inconnu: { garde: [1, 2] } });
      expect(taches[1]!.extra).toEqual({ brut: 'tâche atypique' });
      expect(taches[2]).toMatchObject({ t: 'Sans identifiant', done: null });
      expect(taches[2]!.extra).toEqual({ done: 'oui' });
      const vals = (
        await t.svc.db.q<{ v: number | null; extra: JsonObject }>(
          "SELECT k.v, k.extra FROM suivi_indicateurs_valeurs k JOIN suivi_indicateurs p ON p.seq = k.parent_seq WHERE p.id = 'IND-1' ORDER BY k.position",
        )
      ).rows;
      expect(vals.map((x) => x.v)).toEqual([1.5, null, null, 0]);
      expect(vals[1]!.extra).toEqual({ v: '12' });
      expect(vals[2]!.extra).toEqual({ brut: 7 });
      // Listes vides et valeurs d'un autre type : aucune ligne liée, colonne du parent conservée.
      const f23 = (
        await t.svc.db.q<{ id: string; tasks: unknown; n: string }>(
          "SELECT p.id, p.tasks, (SELECT count(*) FROM suivi_ecarts_taches k WHERE k.parent_seq = p.seq)::text AS n FROM suivi_ecarts p WHERE p.id IN ('F-2','F-3','F-4') ORDER BY p.id",
        )
      ).rows;
      expect(f23).toEqual([
        { id: 'F-2', tasks: [], n: '0' },
        { id: 'F-3', tasks: 'texte', n: '0' },
        { id: 'F-4', tasks: null, n: '0' },
      ]);
      // Non destructif : la colonne du parent garde la liste d'origine jusqu'au prochain enregistrement.
      const f1 = await t.svc.db.one<{ tasks: Json[] }>("SELECT tasks FROM suivi_ecarts WHERE id = 'F-1'");
      expect(f1!.tasks).toEqual((ETAT.findings as JsonObject[])[0]!.tasks);
      // Migration 033 : les constats historiques, leurs tâches et la vue associée disparaissent.
      expect(await t.svc.db.migrate()).toEqual([
        '033_retrait_constats_historiques.sql',
        '034_journal_technique.sql',
        '035_types_processus.sql',
        '036_contributions_elements.sql',
        '037_retrait_environnement.sql',
        '038_parcours_associations.sql',
        '039_calendriers_plateforme.sql',
        '040_courriel_jobs.sql',
      ]);
      for (const table of ['suivi_ecarts', 'suivi_ecarts_taches'])
        expect((await t.svc.db.one(`SELECT to_regclass('${table}') AS r`))!.r).toBeNull();
      for (const vue of ['v_findings', 'v_items'])
        expect((await t.svc.db.one(`SELECT to_regclass('${vue}') AS r`))!.r).toBeNull();
      expect((await t.svc.legacy.recompose())!.data.findings).toEqual([]);
    } finally {
      await t.close();
    }
  });

  it('l’écriture par la correspondance range les sous-listes dans les tables liées et se relit à l’identique', async () => {
    const t = await createTestApp();
    try {
      for (const k of CLES) await t.svc.db.tx((c) => ecrireCollection(c, spec(k), ETAT[k] as Json));
      const etat = (await t.svc.legacy.recompose())!.data;
      for (const k of CLES) expect(etat[k], k).toEqual(ETAT[k]);
      const n = async (table: string) =>
        Number((await t.svc.db.one<{ n: string }>(`SELECT count(*)::text AS n FROM ${table}`))!.n);
      expect(await n('suivi_indicateurs_valeurs')).toBe(4);
      // Réécriture : plus de ligne liée orpheline, l'ordre suit la nouvelle valeur.
      const nouveau = [{ id: 'IND-1', values: [{ v: 2 }, { v: 1 }] }];
      await t.svc.db.tx((c) => ecrireCollection(c, spec('indicators'), nouveau));
      expect(await n('suivi_indicateurs_valeurs')).toBe(2);
      expect((await t.svc.legacy.recompose())!.data.indicators).toEqual(nouveau);
      // Vider le module supprime aussi les lignes liées.
      await t.svc.db.tx((c) => ecrireCollection(c, spec('indicators'), undefined));
      expect(await n('suivi_indicateurs_valeurs')).toBe(0);
    } finally {
      await t.close();
    }
  });
});
