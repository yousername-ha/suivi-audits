/* Archivage et désarchivage d'un registre (BUG-049, arbitrage du RSSI du 13/11/2026) : seul le gestionnaire du registre
   (ou un administrateur) archive et désarchive ; un contributeur, même avec le droit de modifier du module, est refusé.
   Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

describe('archivage des registres réservé au gestionnaire', () => {
  let t: TestApp;
  let admin: Agent, createur: Agent, contributeur: Agent, gestionnaire: Agent, inconnu: Agent;
  let registre: string;
  const version = async () =>
    (await t.svc.db.one<{ version: number }>('SELECT version FROM registres WHERE id=$1', [registre]))!.version;
  const si = async () => ({ 'if-match': `"${await version()}"` });
  const poster = async (a: Agent, chemin: 'archivage' | 'desarchivage') =>
    chemin === 'archivage'
      ? a.post(`/api/registres/${registre}/archivage`, undefined, await si())
      : a.post(`/api/registres/${registre}/desarchivage`, undefined, await si());

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'arch_admin', 'admin'));
    createur = await login(t, await makeUser(t, 'arch_createur', 'rw'));
    const c = await makeUser(t, 'arch_contrib', 'rw');
    const g = await makeUser(t, 'arch_gestionnaire', 'rw');
    const i = await makeUser(t, 'arch_inconnu', null);
    const r = await createur.post('/api/registres', {
      kind: 'plan_actions',
      name: 'Plan fictif à archiver',
      referenceId: '00000000-0000-4000-8000-000000000001',
      perimetres: [],
    });
    expect(r.statusCode, r.body).toBe(201);
    registre = r.json().id;
    for (const [u, role] of [
      [c, 'contributeur'],
      [g, 'gestionnaire'],
    ] as const) {
      const d = await admin.put(`/api/droits/registre/${registre}`, {
        subjectType: 'utilisateur',
        subjectId: u.id,
        role,
      });
      expect(d.statusCode, d.body).toBe(200);
    }
    contributeur = await login(t, c);
    gestionnaire = await login(t, g);
    inconnu = await login(t, i);
  });
  afterAll(() => t.close());

  it('un contributeur du registre n’archive pas (403)', async () => {
    const r = await poster(contributeur, 'archivage');
    expect(r.statusCode, r.body).toBe(403);
    expect(r.json().error ?? r.body).toMatch(/gestionnaire/i);
    expect(
      (await t.svc.db.one<{ archived: boolean }>('SELECT archived FROM registres WHERE id=$1', [registre]))!.archived,
    ).toBe(false);
  });
  it('un compte sans accès au registre reçoit 404, sans révéler son existence', async () => {
    expect((await poster(inconnu, 'archivage')).statusCode).toBe(404);
  });
  it('le gestionnaire archive ; le contributeur ne désarchive pas ; le gestionnaire désarchive', async () => {
    const a = await poster(gestionnaire, 'archivage');
    expect(a.statusCode, a.body).toBe(200);
    expect(a.json().archived).toBe(true);
    expect((await poster(contributeur, 'desarchivage')).statusCode).toBe(403);
    expect((await poster(gestionnaire, 'archivage')).statusCode).toBe(409);
    const d = await poster(gestionnaire, 'desarchivage');
    expect(d.statusCode, d.body).toBe(200);
    expect(d.json().archived).toBe(false);
    expect((await poster(gestionnaire, 'desarchivage')).statusCode).toBe(409);
    const journal = await t.svc.db.q<{ action: string }>(
      "SELECT action FROM audit_log WHERE action IN ('registre.archived','registre.unarchived') AND target=$1 ORDER BY id",
      [registre],
    );
    expect(journal.rows.map((r) => r.action)).toEqual(['registre.archived', 'registre.unarchived']);
  });
  it('un administrateur archive et désarchive', async () => {
    expect((await poster(admin, 'archivage')).statusCode).toBe(200);
    expect((await poster(admin, 'desarchivage')).statusCode).toBe(200);
  });
  it('la fiche indique qui peut archiver', async () => {
    const dto = (a: Agent) => a.get(`/api/registres/${registre}`).then((r) => r.json());
    expect((await dto(gestionnaire)).peutArchiver).toBe(true);
    expect((await dto(contributeur)).peutArchiver).toBe(false);
  });
});
