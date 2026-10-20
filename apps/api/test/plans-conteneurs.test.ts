/* Plan d'actions conteneur : dates, statut, responsable, avancement et actions ordonnées (L4). Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

const donnees = (extra: Record<string, unknown> = {}) => ({
  description: '',
  status: 'todo',
  ownerId: null,
  startAt: null,
  dueAt: null,
  priority: 'normal',
  category: 'action',
  justification: '',
  reminderDays: 7,
  dependencies: [],
  ...extra,
});

describe('plan d’actions conteneur', () => {
  let t: TestApp;
  let admin: Agent;
  let A: string, B: string;
  let plan: string, version: number;
  let a1: string, a2: string, a3: string;
  let groupe: string;

  beforeAll(async () => {
    t = await createTestApp();
    const u = await makeUser(t, 'plan_admin', 'admin');
    admin = await login(t, u);
    const p = async (n: string) =>
      (await admin.post('/api/grc/smsis', { name: n, scope: n, timezone: 'Europe/Paris' })).json().id as string;
    [A, B] = [await p('Périmètre plan A'), await p('Périmètre plan B')];
    groupe = (
      await admin.post('/api/admin/groups', { name: 'Groupe plan', description: '', roles: [], members: [u.id] })
    ).json().id;
  });
  afterAll(async () => t.close());

  it('crée un plan daté avec responsable et refuse une période inversée', async () => {
    const inverse = await admin.post('/api/registres', {
      kind: 'plan_actions',
      name: 'Plan inversé',
      referenceId: A,
      dateDebut: '2026-12-01',
      dateFin: '2026-01-01',
    });
    expect(inverse.statusCode).toBe(422);
    const r = await admin.post('/api/registres', {
      kind: 'plan_actions',
      name: 'Plan 2026',
      referenceId: A,
      perimetres: [B],
      dateDebut: '2026-01-01',
      dateFin: '2026-12-31',
      statut: 'en_cours',
      responsable: { type: 'groupe', id: groupe },
    });
    expect(r.statusCode).toBe(201);
    const dto = r.json();
    plan = dto.id;
    version = dto.version;
    expect(dto).toMatchObject({
      dateDebut: '2026-01-01',
      dateFin: '2026-12-31',
      statut: 'en_cours',
      responsable: { type: 'groupe', id: groupe },
      avancement: { total: 0, terminees: 0 },
    });
  });

  it('refuse un responsable inconnu et les champs de plan hors famille « plan d’actions »', async () => {
    const inconnu = await admin.post('/api/registres', {
      kind: 'plan_actions',
      name: 'Plan sans titulaire',
      referenceId: A,
      responsable: { type: 'fonction', id: '00000000-0000-4000-8000-0000000000aa' },
    });
    expect(inconnu.statusCode).toBe(422);
    const ecarts = await admin.post('/api/registres', {
      kind: 'ecarts',
      name: 'Écarts datés',
      referenceId: A,
      dateDebut: '2026-01-01',
    });
    expect(ecarts.statusCode).toBe(422);
  });

  it('modifie le plan : les champs absents gardent leur valeur, null les efface', async () => {
    const r = await admin.patch(
      `/api/registres/${plan}`,
      { name: 'Plan 2026', description: 'Plan annuel', restreint: false, statut: 'termine', responsable: null },
      { 'if-match': `"${version}"` },
    );
    expect(r.statusCode).toBe(200);
    const dto = r.json();
    version = dto.version;
    expect(dto).toMatchObject({ statut: 'termine', responsable: null, dateDebut: '2026-01-01', dateFin: '2026-12-31' });
    const inverse = await admin.patch(
      `/api/registres/${plan}`,
      { name: 'Plan 2026', description: '', restreint: false, dateFin: '2025-01-01' },
      { 'if-match': `"${version}"` },
    );
    expect(inverse.statusCode).toBe(422);
  });

  it('ordonne les actions, calcule l’avancement et refuse une action étrangère au plan', async () => {
    const creer = async (name: string, extra = {}) =>
      (
        await admin.post(`/api/grc/${A}/objects`, {
          kind: 'action',
          name,
          registreId: plan,
          data: donnees(extra),
        })
      ).json().id as string;
    a1 = await creer('Action 1');
    a2 = await creer('Action 2');
    a3 = await creer('Action 3');
    await t.svc.db.q("UPDATE grc_objects SET data=jsonb_set(data,'{status}','\"done\"') WHERE id=$1", [a2]);
    const lire = async () =>
      (await admin.get(`/api/registres/${plan}/elements`)).json() as {
        registre: { avancement: { total: number; terminees: number }; version: number };
        items: { id: string }[];
      };
    let l = await lire();
    expect(l.registre.avancement).toEqual({ total: 3, terminees: 1 });
    version = l.registre.version;

    const ordre = await admin.put(
      `/api/registres/${plan}/ordre`,
      { ids: [a3, a1, a2] },
      { 'if-match': `"${version}"` },
    );
    expect(ordre.statusCode).toBe(200);
    version = ordre.json().version;
    l = await lire();
    expect(l.items.map((o) => o.id)).toEqual([a3, a1, a2]);

    // Une action absente de la liste passe après les actions ordonnées.
    const partiel = await admin.put(`/api/registres/${plan}/ordre`, { ids: [a2] }, { 'if-match': `"${version}"` });
    version = partiel.json().version;
    expect((await lire()).items[0]!.id).toBe(a2);

    const autre = (
      await admin.post(`/api/grc/${A}/objects`, { kind: 'action', name: 'Ailleurs', data: donnees() })
    ).json().id;
    expect(
      (await admin.put(`/api/registres/${plan}/ordre`, { ids: [autre] }, { 'if-match': `"${version}"` })).statusCode,
    ).toBe(422);
    expect(
      (await admin.put(`/api/registres/${plan}/ordre`, { ids: [a1, a1] }, { 'if-match': `"${version}"` })).statusCode,
    ).toBe(422);
    // Version périmée : refus.
    expect((await admin.put(`/api/registres/${plan}/ordre`, { ids: [a1] }, { 'if-match': '"1"' })).statusCode).toBe(
      412,
    );
    // Sans If-Match : refus.
    expect((await admin.put(`/api/registres/${plan}/ordre`, { ids: [a1] })).statusCode).toBe(428);
  });

  it('l’ordre est inscrit au journal et un registre d’écarts n’a pas d’ordre', async () => {
    const entree = await t.svc.db.one<{ n: number }>(
      "SELECT count(*)::int AS n FROM audit_log WHERE action='registre.ordre' AND target=$1",
      [plan],
    );
    expect(entree!.n).toBeGreaterThanOrEqual(2);
    const re = (
      await admin.post('/api/registres', { kind: 'ecarts', name: 'Écarts sans ordre', referenceId: A })
    ).json();
    expect(
      (await admin.put(`/api/registres/${re.id}/ordre`, { ids: [a1] }, { 'if-match': `"${re.version}"` })).statusCode,
    ).toBe(422);
  });
});
