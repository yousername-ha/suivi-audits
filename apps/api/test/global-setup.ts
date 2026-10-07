/* Prépare le serveur PostgreSQL de test : rôle applicatif non superutilisateur (comme en production). */
import pg from 'pg';
import { adminConn, APP_ROLE, APP_ROLE_PASSWORD } from './pg.js';

export default async function setup() {
  const c = new pg.Client(adminConn('postgres'));
  try {
    await c.connect();
  } catch (e) {
    throw new Error(
      `PostgreSQL de test injoignable (${(e as Error).message}). ` +
        'Lancer : docker run -d --name pgtest -e POSTGRES_PASSWORD=test -p 127.0.0.1:55432:5432 postgres:17-alpine',
    );
  }
  const exists = await c.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [APP_ROLE]);
  if (!exists.rowCount) await c.query(`CREATE ROLE ${APP_ROLE} LOGIN PASSWORD '${APP_ROLE_PASSWORD}' NOSUPERUSER NOCREATEDB NOCREATEROLE`);
  // Nettoyage des bases laissées par une exécution interrompue.
  const old = await c.query<{ datname: string }>("SELECT datname FROM pg_database WHERE datname LIKE 'suivi_t_%'");
  for (const r of old.rows) await c.query(`DROP DATABASE IF EXISTS "${r.datname}" WITH (FORCE)`);
  await c.end();
}
