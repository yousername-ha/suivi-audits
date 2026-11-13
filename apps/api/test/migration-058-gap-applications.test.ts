/* Migration 058 (ADR 0089, lot 2) : la table du GAP et la clé `appGaps` disparaissent, et les nœuds « application » (références
   `app:…`) sont retirés des cartes enregistrées et de leurs versions figées, avec leurs relations ; le reste est intact.
   Données fictives. */
import { copyFileSync, mkdtempSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS_DIR } from '../src/db/db.js';
import { createDatabase } from './pg.js';
import { createTestApp } from './helpers.js';

const noeud = (label: string) => ({ x: 0, y: 0, w: 200, h: 80, label });
const layout = (avecApps: boolean) => ({
  nodes: {
    isms: noeud('SMSI'),
    'sup:SUP-1': noeud('Fournisseur fictif'),
    ...(avecApps ? { 'app:APP-1': noeud('Application fictive') } : {}),
  },
  edges: [
    { id: 'e1', s: 'isms', t: 'sup:SUP-1', type: 'supports' },
    ...(avecApps ? [{ id: 'e2', s: 'app:APP-1', t: 'sup:SUP-1', type: 'depends_on' }] : []),
  ],
  hide: {
    'd:isms>sup:SUP-1:supports': 1,
    ...(avecApps ? { 'd:app:APP-1>sup:SUP-1:depends_on': 1, 'd:isms>app:APP-1:part_of': 1 } : {}),
  },
  ignored: { 'sup:SUP-2': 1, ...(avecApps ? { 'app:APP-2': 1 } : {}) },
});

describe('migration 058 : retrait du GAP des applications', () => {
  it('supprime la table et la clé, nettoie les cartes enregistrées et leurs versions', async () => {
    const t = await createTestApp({}, { migrate: false, dbName: await createDatabase() });
    try {
      const avant = mkdtempSync(path.join(os.tmpdir(), 'm058-'));
      for (const f of readdirSync(MIGRATIONS_DIR).filter((f) => f < '058'))
        copyFileSync(path.join(MIGRATIONS_DIR, f), path.join(avant, f));
      await t.svc.db.migrate(avant);
      await t.svc.db.q(
        "INSERT INTO app_state (id, version, data, sha256, updated_by) VALUES (1, 1, $1, 'x', 'fictif') ON CONFLICT (id) DO UPDATE SET data = excluded.data",
        [{ appGaps: [{ id: 'APP-1' }], suppliers: [] }],
      );
      await t.svc.db.q("INSERT INTO suivi_presence(cle) VALUES ('appGaps') ON CONFLICT DO NOTHING");
      await t.svc.db.q("INSERT INTO suivi_app_gaps (position, id, name) VALUES (0, 'APP-1', 'Application fictive')");
      const carte = await t.svc.db.one<{ id: string }>(
        "INSERT INTO maps (view, name, layout, created_by, updated_by) VALUES ('context', 'Carte', $1, 'fictif', 'fictif') RETURNING id",
        [layout(true)],
      );
      await t.svc.db.q(
        "INSERT INTO map_versions (map_id, label, layout, created_by) VALUES ($1, 'Version', $2, 'fictif')",
        [carte!.id, layout(true)],
      );
      const processus = await t.svc.db.one<{ id: string }>(
        "INSERT INTO maps (view, name, layout, created_by, updated_by) VALUES ('process', 'Processus', $1, 'fictif', 'fictif') RETURNING id",
        [layout(false)],
      );

      expect(await t.svc.db.migrate()).toContain('058_retrait_gap_applications.sql');

      expect((await t.svc.db.one("SELECT to_regclass('suivi_app_gaps') AS r"))!.r).toBeNull();
      const etat = await t.svc.db.one<{ data: Record<string, unknown> }>('SELECT data FROM app_state WHERE id = 1');
      expect('appGaps' in etat!.data).toBe(false);
      expect(await t.svc.db.one("SELECT 1 FROM suivi_presence WHERE cle = 'appGaps'")).toBeNull();

      const nettoyee = await t.svc.db.one<{ layout: unknown; version: number }>(
        'SELECT layout, version FROM maps WHERE id = $1',
        [carte!.id],
      );
      expect(nettoyee!.layout).toEqual(layout(false));
      expect(nettoyee!.version).toBe(2);
      const figee = await t.svc.db.one<{ layout: unknown }>('SELECT layout FROM map_versions WHERE map_id = $1', [
        carte!.id,
      ]);
      expect(figee!.layout).toEqual(layout(false));
      // Une carte sans application n'est pas touchée (ni sa disposition, ni sa version).
      const intacte = await t.svc.db.one<{ layout: unknown; version: number }>(
        'SELECT layout, version FROM maps WHERE id = $1',
        [processus!.id],
      );
      expect(intacte!.layout).toEqual(layout(false));
      expect(intacte!.version).toBe(1);
    } finally {
      await t.close();
    }
  });
});
