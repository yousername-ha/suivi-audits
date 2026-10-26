/* Cœur du GRC (core.ts) : liste paginée et filtrée des fiches, historique par pages, dépendances circulaires, gestion des
   membres d'un périmètre restreint, liste des périmètres visibles. Complète les suites existantes (équivalence de la
   conversion Kysely, ADR 0062). Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp, type TestUser } from './helpers.js';

const action = (extra: Record<string, unknown> = {}) => ({
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

let t: TestApp, admin: Agent, adminUser: TestUser, membre: TestUser, autre: TestUser, S: string, R: string;
const objets = (smsi: string) => `/api/grc/${smsi}/objects`;
const creer = (name: string, extra: Record<string, unknown> = {}, smsi = S) =>
  admin.post(objets(smsi), { kind: 'action', name, data: action(extra) });

beforeAll(async () => {
  t = await createTestApp();
  adminUser = await makeUser(t, 'core_admin', 'admin');
  admin = await login(t, adminUser);
  membre = await makeUser(t, 'core_membre', 'rw');
  autre = await makeUser(t, 'core_autre', 'rw');
  S = (await admin.post('/api/grc/smsis', { name: 'Périmètre cœur', scope: 'C', timezone: 'Europe/Paris' })).json().id;
  R = (await admin.post('/api/grc/smsis', { name: 'Périmètre réservé', scope: 'R', timezone: 'Europe/Paris' })).json()
    .id;
  expect((await admin.put(`/api/grc/${S}/members`, { userId: membre.id, write: true })).statusCode).toBe(204);
});
afterAll(() => t.close());

describe('cœur du GRC', () => {
  it('liste : recherche aux jokers échappés, filtres d’état et de responsable, pagination par 50, archivées exclues', async () => {
    for (let i = 0; i < 52; i++) expect((await creer(`Lot ${String(i).padStart(2, '0')}`)).statusCode).toBe(200);
    const pct = (await creer('Taux 100% atteint')).json();
    const souligne = (await creer('note_interne')).json();
    const porteur = (await creer('Action portée', { ownerId: membre.id })).json();
    const r = await creer('Action en cours', { status: 'progress' });
    expect(r.statusCode, r.body).toBe(200);
    const enCours = r.json();
    const liste = async (qs: string) => (await admin.get(`${objets(S)}?kind=action${qs}`)).json();
    const p1 = await liste('');
    expect(p1.total).toBe(56);
    expect(p1.items).toHaveLength(50);
    expect(p1.nextOffset).toBe(50);
    const p2 = await liste('&offset=50');
    expect(p2.items).toHaveLength(6);
    expect(p2.nextOffset).toBeNull();
    expect(new Set([...p1.items, ...p2.items].map((o: { id: string }) => o.id)).size).toBe(56);
    expect((await liste('&search=100%25')).items.map((o: { id: string }) => o.id)).toEqual([pct.id]);
    expect((await liste('&search=note_int')).items.map((o: { id: string }) => o.id)).toEqual([souligne.id]);
    expect((await liste('&search=note%25int')).total).toBe(0);
    expect((await liste('&search=LOT 0')).total).toBe(10);
    expect((await liste(`&ownerId=${membre.id}`)).items.map((o: { id: string }) => o.id)).toEqual([porteur.id]);
    expect((await liste('&status=progress')).items.map((o: { id: string }) => o.id)).toEqual([enCours.id]);
    // La plus récemment modifiée d'abord ; une fiche archivée sort de la liste.
    expect(p1.items[0].id).toBe(enCours.id);
    expect((await admin.req('DELETE', `${objets(S)}/${pct.id}`, { headers: { 'if-match': '"1"' } })).statusCode).toBe(
      200,
    );
    expect((await liste('&search=100%25')).total).toBe(0);
  });

  it('historique par pages (before) ; dépendance circulaire refusée', async () => {
    const a = (await creer('Action A')).json();
    let v = 1;
    for (const nom of ['Action A1', 'Action A2', 'Action A3']) {
      const r = await admin.put(
        `${objets(S)}/${a.id}`,
        { kind: 'action', name: nom, data: action() },
        { 'if-match': `"${v}"` },
      );
      expect(r.statusCode, r.body).toBe(200);
      v = r.json().version;
    }
    const h = (await admin.get(`${objets(S)}/${a.id}/history`)).json() as {
      version: number;
      snapshot: { name: string };
    }[];
    expect(h.map((x) => x.version)).toEqual([4, 3, 2, 1]);
    expect(h[0]!.snapshot.name).toBe('Action A3');
    const avant3 = (await admin.get(`${objets(S)}/${a.id}/history?before=3`)).json() as { version: number }[];
    expect(avant3.map((x) => x.version)).toEqual([2, 1]);
    // B dépend de A ; faire dépendre A de B ferme le cycle.
    const b = (await creer('Action B', { dependencies: [a.id] })).json();
    const cycle = await admin.put(
      `${objets(S)}/${a.id}`,
      { kind: 'action', name: 'Action A3', data: action({ dependencies: [b.id] }) },
      { 'if-match': `"${v}"` },
    );
    expect(cycle.statusCode).toBe(409);
    expect(cycle.json().error).toMatch(/circulaire/);
  });

  it('membres d’un périmètre : lecture seule, retrait, compte désactivé, propre droit conservé, sessions fermées', async () => {
    const membres = async () =>
      (
        (await admin.get(`/api/grc/${S}/members`)).json() as { userId: string; username: string; write: boolean }[]
      ).filter((m) => m.userId !== adminUser.id);
    expect(await membres()).toEqual([
      { userId: membre.id, username: 'core_membre', displayName: expect.any(String), write: true },
    ]);
    const session = await login(t, membre);
    expect((await admin.put(`/api/grc/${S}/members`, { userId: membre.id, write: false })).statusCode).toBe(204);
    expect((await membres())[0]!.write).toBe(false);
    // La désignation ferme les sessions de la personne.
    expect((await session.get('/api/auth/me')).json().stage).not.toBe('ok');
    expect((await admin.req('DELETE', `/api/grc/${S}/members/${membre.id}`)).statusCode).toBe(204);
    expect(await membres()).toEqual([]);
    await t.svc.db.q('UPDATE users SET disabled=true WHERE id=$1', [autre.id]);
    expect((await admin.put(`/api/grc/${S}/members`, { userId: autre.id, write: true })).statusCode).toBe(404);
    const soi = await admin.put(`/api/grc/${S}/members`, { userId: adminUser.id, write: false });
    expect(soi.statusCode).toBe(409);
  });

  it('périmètres visibles : le commun d’abord ; un périmètre réservé n’apparaît qu’à ses membres', async () => {
    const lecteur = await login(t, await makeUser(t, 'core_lecteur', 'rw'));
    const noms = async (a: Agent) => (await a.get('/api/grc/smsis')).json() as { id: string; visibility: string }[];
    const vus = await noms(lecteur);
    expect(vus.some((s) => s.id === R)).toBe(false);
    expect(vus[0]!.visibility).toBe('instance');
    const tous = await noms(admin);
    expect(tous.some((s) => s.id === R)).toBe(true);
    const i = tous.findIndex((s) => s.visibility !== 'instance');
    expect(tous.slice(i).every((s) => s.visibility !== 'instance')).toBe(true);
  });
});
