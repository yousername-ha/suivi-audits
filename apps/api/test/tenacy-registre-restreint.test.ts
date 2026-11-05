/* L'import Tenacy ne lit, ne modifie ni ne clôt un écart d'un registre restreint sans droit attribué (ADR 0043).
   Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

const ENTETE = [
  'Id',
  'Name FR',
  'Description FR',
  'Recommandation FR',
  'Perimeter',
  'Measure',
  'Status',
  'Resolution status',
  'Deadline',
  'Manager',
  'Group',
  'Criticality',
  'Requirements',
  'Actions',
];
const ligne = (o: Record<string, string>) => ENTETE.map((h) => o[h] ?? '');

describe('import Tenacy et registre restreint', () => {
  let t: TestApp;
  let admin: Agent, rssi: Agent;
  let P: string, R: string, ecartId: string;
  const etat = async (id: string) =>
    (await t.svc.db.one<{ name: string; status: string; registre_id: string; restricted: boolean; version: number }>(
      `SELECT o.name, o.data->>'status' AS status, o.registre_id, r.restricted, o.version
         FROM grc_objects o JOIN registres r ON r.id=o.registre_id WHERE o.id=$1`,
      [id],
    ))!;

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'tn_admin', 'admin'));
    P = (
      await admin.post('/api/grc/smsis', { name: 'Périmètre fictif D4', scope: 'x', timezone: 'Europe/Paris' })
    ).json().id;
    // 1. L'administrateur importe un écart Tenacy (sans tâche).
    const corps = { perimetre: P, lignes: [ENTETE, ligne({ Id: 'T-1', 'Name FR': 'Ecart fictif', Status: 'OPEN' })] };
    const sim = (await admin.post('/api/admin/import/tenacy/simulate', corps)).json();
    const ap = await admin.post('/api/admin/import/tenacy/apply', { ...corps, empreinte: sim.empreinte });
    expect(ap.statusCode, ap.body).toBe(201);
    ecartId = (
      (await admin.get(`/api/grc/${P}/objects?kind=nonconformity`)).json().items as { id: string; name: string }[]
    ).find((e) => e.name === 'Ecart fictif')!.id;
    // 2. Registre d'écarts restreint de référence P ; l'écart y est déplacé.
    const rr = await admin.post('/api/registres', {
      kind: 'ecarts',
      name: 'Écarts confidentiels',
      referenceId: P,
      perimetres: [],
      restreint: true,
    });
    expect(rr.statusCode, rr.body).toBe(201);
    R = rr.json().id;
    const v = (await etat(ecartId)).version;
    const dep = await admin.post(
      `/api/grc/${P}/objects/${ecartId}/deplacement`,
      { registreId: R, reason: 'Déplacement fictif pour audit' },
      { 'if-match': `"${v}"` },
    );
    expect(dep.statusCode, dep.body).toBeLessThan(300);
    // 3. Utilisateur RSSI, membre en écriture de P, sans droit attribué sur R.
    const u = await makeUser(t, 'tn_rssi', 'rssi');
    expect((await admin.put(`/api/grc/${P}/members`, { userId: u.id, write: true })).statusCode).toBe(204);
    rssi = await login(t, u);
  });
  afterAll(async () => t.close());

  it('témoin : le chemin interactif masque l’écart du registre restreint', async () => {
    const e = await etat(ecartId);
    expect(e.restricted).toBe(true);
    expect((await rssi.get(`/api/grc/${P}/objects/${ecartId}`)).statusCode).toBe(404);
  });

  it('simulation : la ligne est refusée sans différence de champs ni action', async () => {
    const r = await rssi.post('/api/admin/import/tenacy/simulate', {
      perimetre: P,
      lignes: [ENTETE, ligne({ Id: 'T-1', 'Name FR': 'Ecart modifie', Status: 'CLOSE', Actions: 'Tâche fictive' })],
    });
    expect(r.statusCode, r.body).toBe(200);
    const l = r.json().lignes[0];
    expect(l.resultat).toBe('refuse');
    expect(l.changements).toEqual([]);
    expect(l.actionsACreer).toBe(0);
    expect(r.json().totaux.refuses).toBe(1);
  });

  it('application : rien n’est renommé, clos ni créé', async () => {
    const corps = { perimetre: P, lignes: [ENTETE, ligne({ Id: 'T-1', 'Name FR': 'Ecart modifie', Status: 'CLOSE' })] };
    const sim = (await rssi.post('/api/admin/import/tenacy/simulate', corps)).json();
    const ap = await rssi.post('/api/admin/import/tenacy/apply', { ...corps, empreinte: sim.empreinte });
    expect(ap.statusCode, ap.body).toBe(201);
    const e = await etat(ecartId);
    expect(e.name).toBe('Ecart fictif');
    expect(e.status).not.toBe('closed');
    const n = await t.svc.db.one<{ n: number }>(
      "SELECT count(*)::int AS n FROM grc_objects WHERE smsi_id=$1 AND kind='nonconformity'",
      [P],
    );
    expect(n!.n).toBe(1);
  });

  it('une fois le rôle de gestionnaire attribué sur le registre, l’import met l’écart à jour', async () => {
    const g = await admin.put(`/api/droits/registre/${R}`, {
      subjectType: 'utilisateur',
      subjectId: (await t.svc.db.one<{ id: string }>("SELECT id FROM users WHERE username='tn_rssi'"))!.id,
      role: 'gestionnaire',
    });
    expect(g.statusCode, g.body).toBeLessThan(300);
    const corps = { perimetre: P, lignes: [ENTETE, ligne({ Id: 'T-1', 'Name FR': 'Ecart modifie', Status: 'CLOSE' })] };
    const sim = (await rssi.post('/api/admin/import/tenacy/simulate', corps)).json();
    expect(sim.lignes[0].resultat).toBe('maj');
    const ap = await rssi.post('/api/admin/import/tenacy/apply', { ...corps, empreinte: sim.empreinte });
    expect(ap.statusCode, ap.body).toBe(201);
    expect((await etat(ecartId)).name).toBe('Ecart modifie');
  });
});
