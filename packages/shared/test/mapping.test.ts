import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CONTRACT_PATHS, SCHEMA15_PATHS } from '../src/legacy/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const md = readFileSync(path.resolve(here, '../../../docs/legacy/MAPPING-LEGACY.md'), 'utf8');

interface Row {
  path: string;
  target: string;
  justification: string;
}
const rows: Row[] = [];
for (const line of md.split('\n')) {
  const m = /^\|\s*`([^`]+)`\s*\|([^|]*)\|([^|]*)\|([^|]*)\|([^|]*)\|\s*$/.exec(line);
  if (m) rows.push({ path: m[1]!, target: m[2]!.trim(), justification: m[5]!.trim() });
}
const TARGET = /^(ignoré|extra|[a-z_]+\.[a-z_]+(\.[a-z_]+)?)$/;

describe('MAPPING-LEGACY.md : couverture du contrat', () => {
  const expected = [...CONTRACT_PATHS.map((c) => c.path), ...SCHEMA15_PATHS];

  it('chaque chemin de LEGACY-FORMAT.md (et du schéma 15) est traité', () => {
    const mapped = new Set(rows.map((r) => r.path));
    const missing = expected.filter((p) => !mapped.has(p));
    expect(missing, 'chemins absents de MAPPING-LEGACY.md').toEqual([]);
  });

  it('aucune ligne obsolète ni en double', () => {
    const known = new Set(expected);
    expect(rows.filter((r) => !known.has(r.path)).map((r) => r.path)).toEqual([]);
    const seen = new Set<string>();
    expect(rows.filter((r) => (seen.has(r.path) ? true : (seen.add(r.path), false))).map((r) => r.path)).toEqual([]);
  });

  it('chaque cible est une colonne, « extra » ou « ignoré » justifié', () => {
    for (const r of rows) {
      expect(r.target, r.path).toMatch(TARGET);
      if (r.target === 'ignoré') expect(r.justification, `${r.path} : justification obligatoire`).not.toBe('');
    }
  });
});
