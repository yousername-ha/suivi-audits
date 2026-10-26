/* Reprise des collections de l'outil de suivi en tables (ADR 0040, migration 024) : la copie SQL et l'écriture par la
   correspondance restituent exactement la valeur d'origine, entrées atypiques comprises. Données fictives. */
import { copyFileSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type Json, type JsonObject } from '@suivi/shared/legacy';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS_DIR } from '../src/db/db.js';
import { ecrireCarte, ecrireCollection, ecrireGroupe } from '../src/historique/tables/collection.js';
import { COLLECTIONS } from '../src/historique/tables/collections.js';
import { CLES_REGLAGES } from '../src/historique/tables/coeur.js';
import { CARTES, GROUPES } from '../src/historique/tables/groupes.js';
import { etatJeuDeTest } from '../src/jeu-de-test.js';
import { createTestApp, fixturePath, REPO } from './helpers.js';
import { createDatabase } from './pg.js';

const ETAT: JsonObject = {
  incidents: [
    {
      id: 'INC-001',
      detectedAt: '2026-10-01T08:00',
      title: 'Incident fictif',
      kind: 'Incident de sécurité',
      answers: { q1: 'oui' },
      notified: {},
      inconnu: { garde: [1, 2] },
      impact: null, // null explicite : conservé, ni perdu ni confondu avec « absent »
    },
    'entrée atypique',
    { id: 'INC-002' },
    { title: 'sans identifiant' },
  ],
  plans: [],
  accessReviews: [{ id: 'RA-1', app: 'App fictive', freq: '12', month: '2026-01', comment: 7 }],
  appGaps: [
    {
      id: 'GAP-1',
      name: 'Application fictive',
      lines: { 'A-1': { st: 'ok', comment: 'c' } },
      custom: [],
      profile: null,
      profileAt: '',
    },
  ],
  // supEvals absente : la clé ne doit pas apparaître.
};


/** Migre jusqu'à la 042 comprise : la 043 vide volontairement les données IA (ADR 0057), que ces tests comparent encore. */
async function migrerAvant043(t: Awaited<ReturnType<typeof createTestApp>>) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'avant043-'));
  for (const f of readdirSync(MIGRATIONS_DIR).filter((x) => x < '043'))
    copyFileSync(path.join(MIGRATIONS_DIR, f), path.join(dir, f));
  return t.svc.db.migrate(dir);
}

describe('migration 024 et correspondance générique', () => {
  it('copie les clés d’app_state et les restitue à l’identique', async () => {
    const dbName = await createDatabase();
    const t = await createTestApp({}, { migrate: false, dbName });
    try {
      const avant = mkdtempSync(path.join(os.tmpdir(), 'coll-'));
      for (const f of readdirSync(MIGRATIONS_DIR).filter((x) => x < '024'))
        copyFileSync(path.join(MIGRATIONS_DIR, f), path.join(avant, f));
      await t.svc.db.migrate(avant);
      await t.svc.db.q("INSERT INTO app_state (id, version, data, sha256, updated_by) VALUES (1, 1, $1, 'x', 'v2')", [
        ETAT,
      ]);
      expect(await migrerAvant043(t)).toContain('024_collections_suivi_tables.sql');
      const etat = (await t.svc.legacy.recompose())!.data;
      for (const k of ['incidents', 'plans', 'accessReviews', 'appGaps']) expect(etat[k], k).toEqual(ETAT[k]);
      expect('supEvals' in etat).toBe(false);
      // Ordre des entrées conservé, entrée non objet conservée à sa place.
      expect((etat.incidents as Json[])[1]).toBe('entrée atypique');
      // Valeur de type inattendu conservée dans extra, colonne laissée NULL.
      const ra = await t.svc.db.one<{ freq: number | null; extra: JsonObject }>(
        "SELECT freq, extra FROM suivi_access_reviews WHERE id='RA-1'",
      );
      expect(ra!.freq).toBeNull();
      expect(ra!.extra).toEqual({ freq: '12', comment: 7 });
      // Colonnes typées renseignées pour les champs conformes.
      const inc = await t.svc.db.one<{ title: string; answers: unknown }>(
        "SELECT title, answers FROM suivi_incidents WHERE id='INC-001'",
      );
      expect(inc).toMatchObject({ title: 'Incident fictif', answers: { q1: 'oui' } });
    } finally {
      await t.close();
    }
  });

  it('l’écriture par la correspondance donne le même résultat que la copie SQL, et vider retire la clé', async () => {
    const t = await createTestApp();
    try {
      for (const spec of COLLECTIONS) {
        const valeur = ETAT[spec.key];
        await t.svc.db.tx((c) => ecrireCollection(c, spec, valeur as Json | undefined));
      }
      const etat = (await t.svc.legacy.recompose())!.data;
      for (const k of ['incidents', 'plans', 'accessReviews', 'appGaps']) expect(etat[k], k).toEqual(ETAT[k]);
      expect('supEvals' in etat).toBe(false);
      const spec = COLLECTIONS.find((s) => s.key === 'incidents')!;
      await t.svc.db.tx((c) => ecrireCollection(c, spec, undefined));
      expect('incidents' in (await t.svc.legacy.recompose())!.data).toBe(false);
      // Une valeur qui n'est pas une liste est refusée, sans rien casser.
      await expect(t.svc.db.tx((c) => ecrireCollection(c, spec, { a: 1 }))).rejects.toThrow(/liste/);
    } finally {
      await t.close();
    }
  });

  const CLES = [
    'invest',
    'incidents',
    'plans',
    'accessReviews',
    'appGaps',
    'supEvals',
    'crrc',
    'crisis',
    'ai',
    'dda',
    'groups',
    'items',
    'processes',
    'objectives',
    'indicators',
    'suppliers',
    'frameworks',
    'reviews',
    'interested',
    'swots',
    'roles',
    'recurring',
    'evidences',
    ...CLES_REGLAGES,
  ];
  const SOURCES: [string, () => JsonObject][] = [
    ['fixture legacy', () => JSON.parse(readFileSync(fixturePath, 'utf8')) as JsonObject],
    ['données d’audit', () => JSON.parse(readFileSync(path.join(REPO, 'tests/fixtures/audit-donnees.json'), 'utf8'))],
    [
      'données de cartographie',
      () => JSON.parse(readFileSync(path.join(REPO, 'tests/fixtures/carto-donnees.json'), 'utf8')),
    ],
    ['jeu de test', () => etatJeuDeTest() as JsonObject],
  ];
  it.each(SOURCES)(
    'jeu de départ complet (%s) : la copie SQL et l’écriture par la correspondance restituent tout à l’identique',
    async (_nom, charger) => {
      const fixture = charger();
      const attendu = Object.fromEntries(CLES.filter((k) => k in fixture).map((k) => [k, fixture[k]]));
      // 1) Migration SQL depuis une base ancienne qui contient la fixture.
      const dbName = await createDatabase();
      const t = await createTestApp({}, { migrate: false, dbName });
      try {
        const avant = mkdtempSync(path.join(os.tmpdir(), 'fixt-'));
        for (const f of readdirSync(MIGRATIONS_DIR).filter((x) => x < '023'))
          copyFileSync(path.join(MIGRATIONS_DIR, f), path.join(avant, f));
        await t.svc.db.migrate(avant);
        await t.svc.db.q("INSERT INTO app_state (id, version, data, sha256, updated_by) VALUES (1, 1, $1, 'x', 'v2')", [
          fixture,
        ]);
        await migrerAvant043(t);
        const etat = (await t.svc.legacy.recompose())!.data;
        for (const [k, v] of Object.entries(attendu)) expect(etat[k], `SQL ${k}`).toEqual(v);
        // Après un enregistrement natif, plus aucune clé de module repris ne subsiste dans app_state.
        await t.svc.db.tx(async (c) => {
          const r = (await t.svc.legacy.recompose(c))!;
          const w = await t.svc.legacy.nativeWrite(c, r.data, null, r.version, 'contrôle');
          if (w.conflict) throw new Error('conflit');
        });
        const brut = await t.svc.db.one<{ data: Record<string, unknown> }>('SELECT data FROM app_state WHERE id=1');
        expect(Object.keys(brut!.data).filter((k) => t.svc.legacy.takenOver().includes(k))).toEqual([]);
      } finally {
        await t.close();
      }
      // 2) Écriture par la correspondance (import, restauration) sur une base neuve.
      const t2 = await createTestApp();
      try {
        for (const g of GROUPES) await t2.svc.db.tx((c) => ecrireGroupe(c, g, attendu[g.key] as Json | undefined));
        for (const k of CARTES) await t2.svc.db.tx((c) => ecrireCarte(c, k, attendu[k.key] as Json | undefined));
        const etat = (await t2.svc.legacy.recompose())!.data;
        for (const k of ['crrc', 'crisis', 'ai', 'dda'])
          if (k in attendu) expect(etat[k], `TS ${k}`).toEqual(attendu[k]);
      } finally {
        await t2.close();
      }
    },
  );
});
