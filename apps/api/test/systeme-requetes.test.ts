/* Requêtes d'exploitation (conversion Kysely, ADR 0062) : migrations en attente sur une base neuve (table des migrations
   absente) puis migrée, dernière migration appliquée. */
import { afterAll, describe, expect, it } from 'vitest';
import { lastMigration, migrationFiles, pendingMigrations } from '../src/systeme.js';
import { createTestApp, type TestApp } from './helpers.js';

const apps: TestApp[] = [];
afterAll(async () => {
  for (const a of apps) await a.close();
});

describe('migrations', () => {
  it('base neuve : toutes en attente ; base migrée : aucune, dernière connue', async () => {
    const neuve = await createTestApp({}, { migrate: false });
    apps.push(neuve);
    expect(await pendingMigrations(neuve.svc.db)).toEqual(migrationFiles());

    const migree = await createTestApp();
    apps.push(migree);
    expect(await pendingMigrations(migree.svc.db)).toEqual([]);
    expect(await lastMigration(migree.svc.db)).toBe(migrationFiles().at(-1));
  });
});
