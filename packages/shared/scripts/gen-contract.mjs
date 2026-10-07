// Génère src/legacy/contract.generated.ts à partir de docs/legacy/LEGACY-FORMAT.md (section « Tous les chemins »).
// Usage : pnpm --filter @suivi/shared gen:contract   (un test vérifie que le fichier généré est à jour)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
export function parseContract(md) {
  const section = md.split(/^## Tous les chemins\s*$/m)[1];
  if (!section) throw new Error('Section « Tous les chemins » introuvable dans LEGACY-FORMAT.md');
  const out = [];
  for (const line of section.split('\n')) {
    const m = /^\|\s*`([^`]+)`\s*\|\s*([^|]*)\|\s*(\d+)\s*\|/.exec(line);
    if (m) out.push({ path: m[1], types: m[2].trim() });
  }
  return out;
}
export function render(entries) {
  return (
    '// Fichier généré par scripts/gen-contract.mjs depuis docs/legacy/LEGACY-FORMAT.md — ne pas modifier à la main.\n' +
    'export const CONTRACT_PATHS: ReadonlyArray<{ path: string; types: string }> = ' +
    JSON.stringify(entries, null, 2) +
    ';\n'
  );
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const md = readFileSync(path.join(root, 'docs/legacy/LEGACY-FORMAT.md'), 'utf8');
  const entries = parseContract(md);
  writeFileSync(path.join(here, '../src/legacy/contract.generated.ts'), render(entries));
  console.log(`${entries.length} chemins écrits dans src/legacy/contract.generated.ts`);
}
