/* Connexion au PostgreSQL de test (variables TEST_PG_*, par défaut le conteneur local « pgtest »). */
import crypto from 'node:crypto';
import pg from 'pg';

export const PG = {
  host: process.env.TEST_PG_HOST || '127.0.0.1',
  port: parseInt(process.env.TEST_PG_PORT || '55432', 10),
  user: process.env.TEST_PG_USER || 'postgres',
  password: process.env.TEST_PG_PASSWORD || 'test',
};
export const APP_ROLE = 'suivi_test';
export const APP_ROLE_PASSWORD = 'suivi_test_pw';

export const adminConn = (database: string): pg.ClientConfig => ({ ...PG, database });

/** Crée une base vide possédée par le rôle applicatif (même préparation que db/init/10-app-role.sh). */
export async function createDatabase(): Promise<string> {
  const name = `suivi_t_${crypto.randomBytes(6).toString('hex')}`;
  const c = new pg.Client(adminConn('postgres'));
  await c.connect();
  await c.query(`CREATE DATABASE "${name}" OWNER ${APP_ROLE} ENCODING 'UTF8' TEMPLATE template0`);
  await c.end();
  const d = new pg.Client(adminConn(name));
  await d.connect();
  await d.query('REVOKE ALL ON SCHEMA public FROM PUBLIC');
  await d.query(`ALTER SCHEMA public OWNER TO ${APP_ROLE}`);
  await d.end();
  return name;
}

export async function dropDatabase(name: string) {
  const c = new pg.Client(adminConn('postgres'));
  await c.connect();
  await c.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await c.end();
}
