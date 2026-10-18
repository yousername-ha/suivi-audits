/* Reprise des investissements en tables (ADR 0040) : la migration 023 recopie la clé `invest` d'app_state, l'état
   recomposé pour /legacy reste équivalent, les entrées atypiques sont conservées. Données fictives. */
import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { type JsonObject } from '@suivi/shared/legacy';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS_DIR } from '../src/db/db.js';
import { createTestApp } from './helpers.js';
import { createDatabase } from './pg.js';

describe('migration 023 : investissements', () => {
  it('copie la clé invest d’app_state dans les tables et la restitue à l’identique', async () => {
    const dbName = await createDatabase();
    const t = await createTestApp({}, { migrate: false, dbName });
    try {
      const avant = mkdtempSync(path.join(os.tmpdir(), 'invest-'));
      for (const f of readdirSync(MIGRATIONS_DIR).filter((x) => x < '023'))
        copyFileSync(path.join(MIGRATIONS_DIR, f), path.join(avant, f));
      await t.svc.db.migrate(avant);
      const invest = {
        baseYear: 2026,
        inconnuRacine: { garde: true },
        lines: [
          {
            id: 'INV-001',
            createdAt: '2026-01-02T03:04:05.000Z',
            company: 'Société fictive',
            priority: '2',
            type: 'EDR',
            desc: 'Description fictive',
            n0: 1000.5,
            n1: 0,
            n2: 20,
            comment: 'c',
            alt: 'a',
            account: '615',
            perimeter: 'Groupe',
            status: 'Validé',
            nature: 'Licence perpétuelle',
            renewal: '2027-03-01',
            notice: 30,
            supplier: 'SUP-001',
            inconnu: [1, 2],
          },
          'entrée atypique',
        ],
      } as unknown as JsonObject;
      await t.svc.db.q("INSERT INTO app_state (id, version, data, sha256, updated_by) VALUES (1, 1, $1, 'x', 'v2')", [
        { invest },
      ]);
      expect(await t.svc.db.migrate()).toContain('023_investissements_tables.sql');
      const etat = await t.svc.legacy.recompose();
      expect(etat!.data.invest).toEqual(invest);
      const n = await t.svc.db.one<{ lignes: number; reglages: number }>(
        'SELECT (SELECT count(*)::int FROM invest_lines) AS lignes, (SELECT count(*)::int FROM invest_settings) AS reglages',
      );
      expect(n).toEqual({ lignes: 2, reglages: 1 });
    } finally {
      await t.close();
    }
  });
  it('sans clé invest, aucune table n’est remplie et la clé reste absente', async () => {
    const dbName = await createDatabase();
    const t = await createTestApp({}, { migrate: false, dbName });
    try {
      await t.svc.db.migrate();
      await t.svc.db.q("INSERT INTO app_state (id, version, data, sha256, updated_by) VALUES (1, 1, '{}', 'x', 'v2')");
      expect((await t.svc.legacy.recompose())!.data.invest).toBeUndefined();
    } finally {
      await t.close();
    }
  });
});
