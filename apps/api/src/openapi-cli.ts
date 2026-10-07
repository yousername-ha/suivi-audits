/* Écrit la description OpenAPI 3.1 de l'API (sans base de données) : pnpm --filter @suivi/api openapi [fichier]. */
import { writeFileSync } from 'node:fs';
import { allRoutes } from './app.js';
import { loadConfig } from './config.js';
import { buildOpenApi } from './http/route.js';

const doc = buildOpenApi(allRoutes(), { title: 'Suivi des audits SMSI — API', version: loadConfig().version });
const out = process.argv[2];
const json = JSON.stringify(doc, null, 2) + '\n';
if (out) {
  writeFileSync(out, json);
  console.log(`OpenAPI : ${Object.keys(doc.paths).length} chemins écrits dans ${out}`);
} else process.stdout.write(json);
