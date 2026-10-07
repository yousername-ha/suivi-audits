import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  canonical,
  collectPaths,
  CONTRACT_PATHS,
  ID_LISTS,
  isEmptyState,
  LegacyFileError,
  listsAt,
  migrateToSchema15,
  planImport,
  readLegacyFile,
  schema15Problems,
  unknownPaths,
  type Json,
  type JsonObject,
} from '../src/legacy/index.js';
// @ts-expect-error script JavaScript sans déclaration de types
import { parseContract, render } from '../scripts/gen-contract.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const fixture = (): JsonObject => JSON.parse(readFileSync(path.join(root, 'tests/fixtures/legacy-fixture.json'), 'utf8'));
const seed = (): JsonObject => JSON.parse(readFileSync(path.join(root, 'apps/api/seed/state.json'), 'utf8'));
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

describe('contrat legacy', () => {
  it('contract.generated.ts est à jour avec LEGACY-FORMAT.md', () => {
    const md = readFileSync(path.join(root, 'docs/legacy/LEGACY-FORMAT.md'), 'utf8');
    const expected = render(parseContract(md));
    const actual = readFileSync(path.join(here, '../src/legacy/contract.generated.ts'), 'utf8');
    expect(actual, 'lancer : pnpm --filter @suivi/shared gen:contract').toBe(expected);
    expect(CONTRACT_PATHS.length).toBeGreaterThan(400);
  });

  it('la fixture ne contient que des chemins du contrat, sauf l’artefact d’anonymisation des fournisseurs', () => {
    expect(unknownPaths(fixture())).toEqual(['$.suppliers[].MFA-001']);
  });

  it('collecte les dictionnaires indexés sous {clé}', () => {
    const p = collectPaths({ dda: { 'A-5.1': { app: 'oui' } } } as Json);
    expect([...p]).toEqual(['$.dda', '$.dda.{clé}', '$.dda.{clé}.app']);
  });
});

describe('schéma 15', () => {
  it('attribue des identifiants stables et déterministes aux 9 listes', () => {
    const f = fixture();
    const a = migrateToSchema15(f);
    const b = migrateToSchema15(f);
    expect(a).toEqual(b);
    expect(a.schema).toBe(15);
    expect(f.schema).toBe(14);
    expect(schema15Problems(a)).toEqual([]);
    expect(schema15Problems(f).length).toBeGreaterThan(0);
    for (const { path: p, prefix } of ID_LISTS) {
      for (const l of listsAt(a, p)) for (const el of l) expect((el as { id: string }).id.startsWith(prefix)).toBe(true);
    }
    expect((a.roles as JsonObject[])[0]!.id).toBe('RO-001');
    expect(Object.keys((a.roles as JsonObject[])[0]!)[0]).toBe('id');
  });

  it('conserve les identifiants existants et numérote à la suite', () => {
    const s = { schema: 14, roles: [{ id: 'RO-007', name: 'a' }, { name: 'b' }] } as JsonObject;
    const m = migrateToSchema15(s);
    expect((m.roles as JsonObject[]).map((r) => r.id)).toEqual(['RO-007', 'RO-008']);
    expect(migrateToSchema15(m)).toEqual(m);
  });
});

describe('lecture d’un fichier legacy', () => {
  it('accepte le format brut au schéma 14', () => {
    const r = readLegacyFile(fixture(), sha);
    expect(r.schema).toBe(14);
    expect(r.envelope).toBeNull();
  });

  it('accepte l’enveloppe et vérifie son empreinte', () => {
    const data = migrateToSchema15(fixture());
    const env = { format: 'suivi-audits-legacy', formatVersion: 1, schema: 15, exportedAt: '2026-10-07T00:00:00Z', appVersion: 't', sha256: sha(JSON.stringify(data)), data };
    expect(readLegacyFile(env, sha).schema).toBe(15);
    expect(() => readLegacyFile({ ...env, sha256: '0'.repeat(64) }, sha)).toThrow(/empreinte/);
  });

  it('refuse un fichier au schéma 13 ou antérieur avec un message clair', () => {
    for (const schema of [13, 9, undefined]) {
      const f = { ...fixture(), schema };
      expect(() => readLegacyFile(f, sha)).toThrow(LegacyFileError);
      expect(() => readLegacyFile(f, sha)).toThrow(/trop ancien.*réexportez/);
    }
  });

  it('refuse un schéma 15 sans identifiants', () => {
    expect(() => readLegacyFile({ ...fixture(), schema: 15 }, sha)).toThrow(/Identifiants du schéma 15/);
  });

  it('refuse une structure inattendue en indiquant le chemin', () => {
    try {
      readLegacyFile({ ...fixture(), items: 'x' }, sha);
      expect.unreachable();
    } catch (e) {
      expect((e as LegacyFileError).details.join('\n')).toMatch(/\$\.items/);
    }
  });
});

describe('planification d’un import', () => {
  it('Initialiser sur l’état initial vide reproduit le fichier (au schéma 15)', () => {
    const f = fixture();
    expect(isEmptyState(seed())).toBe(true);
    const { next, report } = planImport(seed(), f, { mode: 'init', sourceSchema: 14, envelope: false });
    expect(canonical(next)).toEqual(canonical(migrateToSchema15(f)));
    expect(report.totals.created).toBeGreaterThan(0);
    expect(report.unknownPaths).toEqual(['$.suppliers[].MFA-001']);
  });

  it('Initialiser est refusé sur une base qui contient des données', () => {
    expect(() => planImport(fixture(), fixture(), { mode: 'init', sourceSchema: 14, envelope: false })).toThrow(/base vide/);
  });

  it('Fusionner crée et met à jour sans rien supprimer', () => {
    const cur = migrateToSchema15(fixture());
    const inc = structuredClone(cur);
    const findings = inc.findings as JsonObject[];
    findings[0]!.status = 'Clos';
    findings.splice(1, 1);
    findings.push({ id: 'ID-NEW', source: 'Interne', text: 'nouveau' });
    const { next, report } = planImport(cur, inc, { mode: 'merge', sourceSchema: 15, envelope: false });
    const ids = (next.findings as JsonObject[]).map((x) => x.id);
    expect(ids).toContain((cur.findings as JsonObject[])[1]!.id);
    expect(ids).toContain('ID-NEW');
    const m = report.modules.find((x) => x.module === 'findings')!;
    expect(m.collections[0]).toMatchObject({ created: 1, updated: 1, deleted: 0 });
    expect(report.affected).toEqual(['findings']);
  });

  it('Remplacer un module supprime les éléments absents et ne touche pas aux autres modules', () => {
    const cur = migrateToSchema15(fixture());
    const inc = structuredClone(cur);
    (inc.findings as JsonObject[]).splice(0, 1);
    (inc.processes as JsonObject[]).splice(0, 1);
    const { next, report } = planImport(cur, inc, { mode: 'replace', module: 'findings', sourceSchema: 15, envelope: false });
    expect((next.findings as JsonObject[]).length).toBe((cur.findings as JsonObject[]).length - 1);
    expect(next.processes).toEqual(cur.processes);
    expect(report.modules.map((m) => m.module)).toEqual(['findings']);
    expect(report.modules[0]!.collections[0]!.deleted).toBe(1);
  });

  it('Remplacer exige un module présent et non technique', () => {
    const f = fixture();
    expect(() => planImport(f, f, { mode: 'replace', sourceSchema: 14, envelope: false })).toThrow(/Choisissez/);
    expect(() => planImport(f, f, { mode: 'replace', module: 'schema', sourceSchema: 14, envelope: false })).toThrow(/technique/);
    expect(() => planImport(f, f, { mode: 'replace', module: 'nope', sourceSchema: 14, envelope: false })).toThrow(/absent/);
  });

  it('signale les références cassées', () => {
    const { report } = planImport(seed(), fixture(), { mode: 'init', sourceSchema: 14, envelope: false });
    expect(report.brokenRefs.some((r) => r.path.startsWith('$.findings['))).toBe(true);
  });

  it('ne modifie pas ses entrées', () => {
    const cur = migrateToSchema15(fixture());
    const inc = fixture();
    const before = JSON.stringify([cur, inc]);
    planImport(cur, inc, { mode: 'merge', sourceSchema: 14, envelope: false });
    expect(JSON.stringify([cur, inc])).toBe(before);
  });
});
