/* Parité entre l'outil historique (app/public/index.html) et la nouvelle version : mêmes identifiants du schéma 15. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { migrateToSchema15 } from '../src/legacy/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('outil historique : schéma 15', () => {
  const html = readFileSync(path.join(root, 'app/public/index.html'), 'utf8');

  it('déclare le schéma 15 et l’export pour la nouvelle version', () => {
    expect(html).toContain('const SCHEMA=15;');
    expect(html).toContain('data-act="jsonv3">Exporter pour la nouvelle version');
    expect(html).toContain("format:'suivi-audits-legacy',formatVersion:1");
  });

  it('attribue exactement les mêmes identifiants que la nouvelle version', () => {
    const start = html.indexOf('const LID_LISTS=');
    const end = html.indexOf('function migrate15(s)');
    expect(start).toBeGreaterThan(0);
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const legacyIds = new Function(html.slice(start, end) + '; return legacyIds;')() as (s: unknown) => Record<string, unknown>;
    const f = JSON.parse(readFileSync(path.join(root, 'tests/fixtures/legacy-fixture.json'), 'utf8'));
    const a = legacyIds(structuredClone(f));
    a.schema = 15;
    expect(JSON.stringify(a)).toBe(JSON.stringify(migrateToSchema15(f)));
  });
});
