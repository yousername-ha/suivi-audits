/* Registres restreints : export du registre, sélecteur de références, indicateurs d'amélioration et revue de direction ne
   laissent rien filtrer d'un registre que la personne ne peut pas lire (ADR 0043, scénario R05). Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const ecart = (name: string, cause: string, registreId?: string) => ({
  kind: 'nonconformity',
  name,
  registreId,
  data: { cause },
});

describe('registres restreints : lectures annexes', () => {
  let t: TestApp;
  let admin: Agent, membre: Agent;
  let A: string;

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'rr_admin', 'admin'));
    await t.svc.db.q(
      "INSERT INTO roles(id,name,permissions) VALUES ('r_exporteur','Lecture et export des écarts',ARRAY['ecarts:lire','ecarts:exporter','import_export:exporter','pilotage:lire','audit:lire','plan_audit:lire','conformite:lire'])",
    );
    const u = await makeUser(t, 'rr_membre', 'r_exporteur');
    A = (
      await admin.post('/api/grc/smsis', { name: 'Périmètre restreint', scope: 'x', timezone: 'Europe/Paris' })
    ).json().id;
    expect((await admin.put(`/api/grc/${A}/members`, { userId: u.id, write: true })).statusCode).toBe(204);
    const secret = (
      await admin.post('/api/registres', { kind: 'ecarts', name: 'Écarts secrets', referenceId: A, restreint: true })
    ).json().id as string;
    await admin.post(`/api/grc/${A}/objects`, ecart('Écart public', 'cause commune'));
    await admin.post(`/api/grc/${A}/objects`, ecart('Écart confidentiel', 'cause confidentielle', secret));
    await admin.post(`/api/grc/${A}/objects`, ecart('Autre écart confidentiel', 'cause confidentielle', secret));
    membre = await login(t, u);
  });
  afterAll(() => t.close());

  it('l’export du registre ne contient pas les écarts du registre restreint pour qui ne le lit pas', async () => {
    const noms = async (a: Agent) => {
      const r = await a.get(`/api/grc/${A}/pilotage/export?kind=nonconformity`);
      expect(r.statusCode, r.body).toBe(200);
      return (r.json().objects as { name: string }[]).map((o) => o.name).sort();
    };
    expect(await noms(admin)).toEqual(['Autre écart confidentiel', 'Écart confidentiel', 'Écart public']);
    expect(await noms(membre)).toEqual(['Écart public']);
  });

  it('le sélecteur de références ne propose pas un élément d’un registre restreint illisible', async () => {
    const noms = async (a: Agent) => {
      const r = await a.get(`/api/grc/${A}/sources?search=${encodeURIComponent('écart')}`);
      expect(r.statusCode, r.body).toBe(200);
      return (r.json().items as { name: string }[]).map((o) => o.name);
    };
    expect(await noms(admin)).toEqual(expect.arrayContaining(['Écart confidentiel', 'Écart public']));
    expect(await noms(membre)).toEqual(['Écart public']);
  });

  it('les indicateurs d’amélioration ne comptent ni ne citent les écarts du registre restreint', async () => {
    const lire = async (a: Agent) => {
      const r = await a.get(`/api/grc/${A}/pilotage/improvement-indicators`);
      expect(r.statusCode, r.body).toBe(200);
      return r.json() as { findings: number; repeatedCauses: { cause: string; count: number }[] };
    };
    const vueAdmin = await lire(admin);
    expect(vueAdmin.findings).toBe(3);
    expect(vueAdmin.repeatedCauses).toEqual([{ cause: 'cause confidentielle', count: 2 }]);
    const vueMembre = await lire(membre);
    expect(vueMembre.findings).toBe(1);
    expect(vueMembre.repeatedCauses).toEqual([]);
  });
});
