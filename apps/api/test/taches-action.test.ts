/* Tâches d'une action (ADR 0111) : enregistrées avec l'action (version, If-Match), bornes et champ strict refusés (422),
   responsable d'une tâche sans effet sur les droits (il n'ouvre l'action à personne), seul qui peut modifier l'action
   modifie ses tâches, et cocher toutes les tâches ne termine pas l'action. Données fictives. */
import { randomUUID } from 'node:crypto';
import type { LightMyRequestResponse } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Agent, createTestApp, login, makeUser, type TestApp, type TestUser } from './helpers.js';

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
const tache = (extra: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  intitule: 'Tâche fictive',
  faite: false,
  echeance: null,
  ...extra,
});
const etag = (r: LightMyRequestResponse) => String(r.headers.etag);
const refuse = (statut: number) => expect([403, 404]).toContain(statut);

let t: TestApp, admin: Agent, designeUser: TestUser, designe: Agent, attribueUser: TestUser, attribue: Agent;
let P: string, registre: string;
const objet = (id: string) => `/api/grc/${P}/objects/${id}`;
const creer = async (name: string, extra: Record<string, unknown> = {}) =>
  admin.post(`/api/grc/${P}/objects`, { kind: 'action', name, data: donnees(extra), registreId: registre });

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'ta_admin', 'admin'));
  // Aucun rôle global, aucun accès au périmètre.
  designeUser = await makeUser(t, 'ta_designe', null);
  attribueUser = await makeUser(t, 'ta_attribue', null);
  P = (
    await admin.post('/api/grc/smsis', { name: 'Périmètre des tâches', scope: 'T', timezone: 'Europe/Paris' })
  ).json().id;
  const r = await admin.post('/api/registres', { kind: 'plan_actions', name: 'Plan des tâches', referenceId: P });
  expect(r.statusCode, r.body).toBe(201);
  registre = r.json().id;
  designe = await login(t, designeUser);
  attribue = await login(t, attribueUser);
});
afterAll(() => t.close());

describe('tâches d’une action : enregistrement et bornes', () => {
  it('enregistre les tâches avec l’action et nettoie l’intitulé ; sans champ, aucune tâche', async () => {
    const r = await creer('Action avec tâches', {
      taches: [
        tache({ intitule: '  Inventorier\tles   comptes\n administrateurs ', faite: true, echeance: '2026-11-25' }),
        tache({ intitule: 'Choisir la solution', echeance: null }),
      ],
    });
    expect(r.statusCode, r.body).toBe(200);
    const lu = (await admin.get(objet(r.json().id))).json();
    expect(lu.data.taches.map((x: { intitule: string }) => x.intitule)).toEqual([
      'Inventorier les comptes administrateurs',
      'Choisir la solution',
    ]);
    expect(lu.data.taches[0]).toMatchObject({ faite: true, echeance: '2026-11-25' });
    const sans = await creer('Action sans tâche');
    expect(sans.statusCode, sans.body).toBe(200);
    expect(sans.json().data.taches).toBeUndefined();
  });

  it('refuse les volumes aberrants, les champs inconnus et les valeurs invalides (422)', async () => {
    const cas: [string, unknown][] = [
      ['51 tâches', Array.from({ length: 51 }, (_, i) => tache({ intitule: `Tâche ${i}` }))],
      ['intitulé vide', [tache({ intitule: '   ' })]],
      ['intitulé de 201 caractères', [tache({ intitule: 'x'.repeat(201) })]],
      ['champ inconnu', [tache({ commentaire: 'non prévu' })]],
      ['échéance inexistante', [tache({ echeance: '2026-02-30' })]],
      ['échéance au mauvais format', [tache({ echeance: '20/12/2026' })]],
      ['identifiant non uuid', [tache({ id: 'tache-1' })]],
      ['case non booléenne', [tache({ faite: 'oui' })]],
      [
        'identifiants dupliqués',
        (() => {
          const id = randomUUID();
          return [tache({ id }), tache({ id })];
        })(),
      ],
      ['responsable : groupe inexistant', [tache({ responsable: { type: 'groupe', id: randomUUID() } })]],
      ['responsable : compte inexistant', [tache({ responsable: { type: 'utilisateur', id: randomUUID() } })]],
      ['tableau attendu', { intitule: 'Seule' }],
    ];
    for (const [nom, taches] of cas) {
      const r = await creer(`Action refusée : ${nom}`, { taches });
      expect(r.statusCode, `${nom} : ${r.body}`).toBe(422);
    }
    // Exactement 50 tâches : accepté.
    const max = await creer('Action à 50 tâches', {
      taches: Array.from({ length: 50 }, (_, i) => tache({ intitule: `Tâche ${i}` })),
    });
    expect(max.statusCode, max.body).toBe(200);
  });

  it('cocher toutes les tâches ne termine pas l’action', async () => {
    const r = await creer('Action dont toutes les tâches seront faites', { taches: [tache(), tache()] });
    expect(r.statusCode, r.body).toBe(200);
    const o = r.json();
    const faites = o.data.taches.map((x: Record<string, unknown>) => ({ ...x, faite: true }));
    const maj = await admin.put(
      objet(o.id),
      { kind: 'action', name: o.name, data: { ...o.data, taches: faites } },
      { 'if-match': etag(r) },
    );
    expect(maj.statusCode, maj.body).toBe(200);
    expect(maj.json().data.status).toBe('todo');
    expect(maj.json().data.taches.every((x: { faite: boolean }) => x.faite)).toBe(true);
    // La mise à jour garde le contrôle de concurrence : une version périmée est refusée.
    const perimee = await admin.put(
      objet(o.id),
      { kind: 'action', name: o.name, data: { ...o.data, taches: [] } },
      { 'if-match': etag(r) },
    );
    expect(perimee.statusCode).toBe(412);
  });
});

describe('tâches d’une action : droits (le responsable d’une tâche est un simple affichage)', () => {
  it('une personne désignée responsable d’une tâche, sans droit sur l’action, ne la voit pas et ne la modifie pas', async () => {
    const r = await creer('Action dont une tâche est confiée à une personne sans droit', {
      taches: [tache({ intitule: 'Tâche confiée', responsable: { type: 'utilisateur', id: designeUser.id } })],
    });
    expect(r.statusCode, r.body).toBe(200);
    const o = r.json();
    expect(o.data.taches[0].responsable).toEqual({ type: 'utilisateur', id: designeUser.id });
    expect((await designe.get(objet(o.id))).statusCode).toBe(404);
    refuse((await designe.get(`/api/registres/elements/${o.id}/acces`)).statusCode);
    expect((await designe.get('/api/registres/mes-elements')).json().items).toEqual([]);
    const faite = o.data.taches.map((x: Record<string, unknown>) => ({ ...x, faite: true }));
    refuse(
      (
        await designe.put(
          objet(o.id),
          { kind: 'action', name: o.name, data: { ...o.data, taches: faite } },
          { 'if-match': etag(r) },
        )
      ).statusCode,
    );
    refuse(
      (
        await designe.req('POST', `${objet(o.id)}/contribution`, {
          json: { status: 'progress' },
          headers: { 'if-match': etag(r) },
        })
      ).statusCode,
    );
    // L'action est intacte.
    const lu = (await admin.get(objet(o.id))).json();
    expect(lu.version).toBe(o.version);
    expect(lu.data.taches[0].faite).toBe(false);
  });

  it('seul qui peut modifier l’action modifie ses tâches : la personne attribuée renseigne l’état, pas les tâches', async () => {
    const r = await creer('Action attribuée, avec une tâche', { ownerId: attribueUser.id, taches: [tache()] });
    expect(r.statusCode, r.body).toBe(200);
    const o = r.json();
    expect((await attribue.get(objet(o.id))).statusCode).toBe(200);
    const cochee = o.data.taches.map((x: Record<string, unknown>) => ({ ...x, faite: true }));
    const modif = await attribue.put(
      objet(o.id),
      { kind: 'action', name: o.name, data: { ...o.data, taches: cochee } },
      { 'if-match': etag(r) },
    );
    expect(modif.statusCode).toBe(403);
    // La contribution n'accepte que l'état et la justification : les tâches n'y passent pas.
    const contribution = await attribue.req('POST', `${objet(o.id)}/contribution`, {
      json: { status: 'progress', taches: cochee },
      headers: { 'if-match': etag(r) },
    });
    expect(contribution.statusCode).toBe(422);
    // L'administrateur, qui peut modifier l'action, coche la tâche.
    const ok = await admin.put(
      objet(o.id),
      { kind: 'action', name: o.name, data: { ...o.data, taches: cochee } },
      { 'if-match': etag(r) },
    );
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().data.taches[0].faite).toBe(true);
  });
});
