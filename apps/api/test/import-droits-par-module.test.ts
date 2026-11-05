/* L'import legacy ne divulgue pas, par sa simulation, son rapport enregistré ou le téléchargement du fichier brut, les
   modules que la personne ne peut pas lire ou exporter ; un fichier illisible n'est jamais servi. Données fictives. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { JsonObject } from '@suivi/shared/legacy';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, fixturePath, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, limite: Agent;
let lotComplet = 0;
const fixture = (): JsonObject => JSON.parse(readFileSync(fixturePath, 'utf8'));
const sha = (b: Buffer) => createHash('sha256').update(b).digest('hex');
const simuler = (a: Agent, buf: Buffer, q: string) =>
  a.req('POST', `/api/admin/import/simulate?${q}`, { body: buf, headers: { 'x-file-name': 'import.json' } });
const appliquer = (a: Agent, buf: Buffer, q: string) =>
  a.req('POST', `/api/admin/import/apply?${q}&sha256=${sha(buf)}`, {
    body: buf,
    headers: { 'x-file-name': 'import.json' },
  });
/** Fichier ne touchant que des clés du module audit. */
const fichierAudit = () => {
  const f = fixture();
  return Buffer.from(JSON.stringify({ v: f.v, schema: f.schema, years: f.years, groups: f.groups, items: f.items }));
};

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'imp_admin', 'admin'));
  await t.svc.db.q(
    "INSERT INTO roles(id,name,permissions) VALUES ('r_import_audit','Import et export, audit seul',ARRAY['import_export:lire','import_export:modifier','import_export:exporter','audit:lire','audit:modifier','audit:exporter'])",
  );
  limite = await login(t, await makeUser(t, 'imp_limite', 'r_import_audit'));
  // L'administrateur importe le jeu complet (fournisseurs compris), avec un BOM en tête du fichier.
  const brut = Buffer.concat([Buffer.from('﻿'), readFileSync(fixturePath)]);
  const r = await appliquer(admin, brut, 'mode=init');
  expect(r.statusCode, r.body).toBe(201);
  lotComplet = (r.json() as { batch: number }).batch;
});
afterAll(() => t.close());

describe('simulation', () => {
  it('témoin : l’administrateur voit tous les modules du rapport', async () => {
    const r = await simuler(admin, fichierAudit(), 'mode=merge');
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().report.modules.map((m: { module: string }) => m.module)).toContain('suppliers');
  });

  it('un fichier contenant un module illisible est refusé', async () => {
    const r = await simuler(limite, readFileSync(fixturePath), 'mode=merge');
    expect(r.statusCode, r.body).toBe(403);
  });

  it('en fusion, le rapport ne décrit que les modules lisibles et les totaux les excluent', async () => {
    const r = await simuler(limite, fichierAudit(), 'mode=merge');
    expect(r.statusCode, r.body).toBe(200);
    const rapport = r.json().report as {
      modules: { module: string; collections: { created: number; updated: number; unchanged: number }[] }[];
      affected: string[];
      totals: { created: number; updated: number; unchanged: number; deleted: number };
    };
    expect(rapport.modules.map((m) => m.module)).not.toContain('suppliers');
    expect(rapport.affected).not.toContain('suppliers');
    const somme = rapport.modules
      .flatMap((m) => m.collections)
      .reduce((n, c) => n + c.unchanged + c.created + c.updated, 0);
    expect(rapport.totals.unchanged + rapport.totals.created + rapport.totals.updated).toBe(somme);
  });

  it('le remplacement exige aussi le droit de suppression, comme l’application', async () => {
    const r = await simuler(limite, fichierAudit(), 'mode=replace&module=items');
    expect(r.statusCode, r.body).toBe(403);
  });
});

describe('rapport enregistré et fichier brut', () => {
  it('le détail et la liste d’un import touchant des modules illisibles ne les montrent pas', async () => {
    const d = await limite.get(`/api/admin/import/${lotComplet}`);
    if (d.statusCode === 200) {
      const j = d.json() as { report: { modules: { module: string }[]; affected: string[] }; modules: string[] };
      expect(j.report.modules.map((m) => m.module)).not.toContain('suppliers');
      expect(j.modules).not.toContain('suppliers');
    } else expect([403, 404]).toContain(d.statusCode);
    const adm = (await admin.get(`/api/admin/import/${lotComplet}`)).json() as { modules: string[] };
    expect(adm.modules).toContain('suppliers');
  });

  it('le téléchargement du fichier brut préfixé d’un BOM exige l’export de chaque module', async () => {
    const r = await limite.get(`/api/admin/import/${lotComplet}/file`);
    expect(r.statusCode, r.body).toBe(403);
    expect((await admin.get(`/api/admin/import/${lotComplet}/file`)).statusCode).toBe(200);
  });

  it('un fichier brut illisible n’est pas servi', async () => {
    const id = lotComplet;
    const vide = Buffer.from('ceci n’est pas du json');
    const enc = t.svc.vault.encrypt(vide, `import:${id}`);
    await t.svc.db.q(
      'UPDATE import_batches SET sha256=$2, raw_key_id=$3, raw_iv=$4, raw_tag=$5, raw_content=$6 WHERE id=$1',
      [id, sha(vide), enc.keyId, enc.iv, enc.tag, enc.content],
    );
    const r = await limite.get(`/api/admin/import/${id}/file`);
    expect(r.statusCode, r.body).toBe(422);
  });
});
