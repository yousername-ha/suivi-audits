/* Génère (ou contrôle avec --check) src/db/types.generated.ts depuis une base temporaire migrée (ADR 0062).
   Connexion d'administration : variables TEST_PG_* (comme les tests), par défaut le PostgreSQL de test local.
     pnpm --filter @suivi/api db:types           réécrit le fichier
     pnpm --filter @suivi/api db:types --check   échoue si le fichier versionné diffère (CI) */
import crypto from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { createLogger } from '../log.js';
import { Db } from './db.js';
import { lireCatalogue, rendreTypes } from './introspection.js';

const FICHIER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'types.generated.ts');
const admin = {
  host: process.env.TEST_PG_HOST || '127.0.0.1',
  port: parseInt(process.env.TEST_PG_PORT || '55432', 10),
  user: process.env.TEST_PG_USER || 'postgres',
  password: process.env.TEST_PG_PASSWORD || 'test',
};

async function main() {
  const check = process.argv.includes('--check');
  const base = `suivi_types_${crypto.randomBytes(6).toString('hex')}`;
  const c = new pg.Client({ ...admin, database: 'postgres' });
  await c.connect();
  await c.query(`CREATE DATABASE "${base}" ENCODING 'UTF8' TEMPLATE template0`);
  let rendu: string;
  try {
    const db = new Db({ ...admin, database: base, ssl: false, max: 2 }, createLogger('silent'));
    try {
      await db.migrate();
      const client = await db.pool.connect();
      try {
        const { colonnes, enums, checks } = await lireCatalogue(client);
        rendu = rendreTypes(colonnes, enums, checks);
      } finally {
        client.release();
      }
    } finally {
      await db.end();
    }
  } finally {
    await c.query(`DROP DATABASE IF EXISTS "${base}" WITH (FORCE)`);
    await c.end();
  }
  if (!check) {
    writeFileSync(FICHIER, rendu);
    console.log(`Types de la base écrits : ${path.relative(process.cwd(), FICHIER)}`);
    return;
  }
  let actuel = '';
  try {
    actuel = readFileSync(FICHIER, 'utf8');
  } catch {
    /* fichier absent : différence signalée ci-dessous */
  }
  if (actuel !== rendu) {
    console.error(
      '::error::src/db/types.generated.ts ne correspond pas aux migrations. Lancer « pnpm --filter @suivi/api db:types » et versionner le résultat.',
    );
    process.exit(1);
  }
  console.log('Types de la base à jour avec les migrations.');
}

await main();
