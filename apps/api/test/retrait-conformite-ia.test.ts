/* Retrait de la page « Conformité IA » (ADR 0057) : la migration 043 vide les données IA et retire le module de droits « ia »
   des rôles personnalisés, des attributions et de l'activation des modules, sans toucher au reste. Elle se rejoue sans effet. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MIGRATIONS_DIR } from '../src/db/db.js';
import { createTestApp, makeUser, type TestApp } from './helpers.js';

let t: TestApp;
const sql = () => readFileSync(path.join(MIGRATIONS_DIR, '043_retrait_conformite_ia.sql'), 'utf8');
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => t.close());

describe('migration 043 : retrait de la conformité IA', () => {
  it('vide le registre IA, nettoie les droits « ia » et se rejoue sans effet', async () => {
    const q = (text: string, values: unknown[] = []) => t.svc.db.q(text, values);
    await q(
      `INSERT INTO suivi_ia_usages(position,id,ai_presence,category,provider,usecase) VALUES (0,'EXT-IA-01','Oui','Test','Fictif','Usage fictif')`,
    );
    await q(
      `INSERT INTO roles(id,name,permissions) VALUES ('role_ia_fictif','Rôle fictif IA','{ia:lire,ia:modifier,audit:lire}')`,
    );
    const u = await makeUser(t, 'retrait_ia', null);
    await q(`INSERT INTO user_roles(user_id,role_id,modules) VALUES ($1,'role_ia_fictif','{ia,audit}')`, [u.id]);

    await t.svc.db.pool.query(sql());

    expect((await q('SELECT 1 FROM suivi_ia_usages')).rowCount).toBe(0);
    const role = (await q(`SELECT permissions FROM roles WHERE id='role_ia_fictif'`)).rows[0] as {
      permissions: string[];
    };
    expect(role.permissions).toEqual(['audit:lire']);
    const lien = (await q(`SELECT modules FROM user_roles WHERE user_id=$1`, [u.id])).rows[0] as { modules: string[] };
    expect(lien.modules).toEqual(['audit']);
    // Le réglage des modules n'accepte plus « ia ».
    await expect(q(`UPDATE module_activation SET disabled='{ia}' WHERE id=1`)).rejects.toThrow();
    // Rejeu : aucun changement, aucune erreur.
    await t.svc.db.pool.query(sql());
    expect(
      ((await q(`SELECT permissions FROM roles WHERE id='role_ia_fictif'`)).rows[0] as { permissions: string[] })
        .permissions,
    ).toEqual(['audit:lire']);
  });
});
