/* Parcours ISO / HDS (ADR 0045, addendum) : associations d'une fiche ou d'une preuve à une sous-action (journal immuable,
   idempotent, motif de retrait, droits, cible lisible) et applicabilité HDS lue dans le périmètre. Données fictives. */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FrameworkDefinition } from '@suivi/shared';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, writer: Agent, reader: Agent, smsi: string, autre: string, action: string, hors: string;
const root = (s = smsi) => `/api/grc/${s}/parcours`;
const SOUS = 'risk-2';
const corps = (ref: string, extra: Record<string, unknown> = {}) => ({
  requestId: randomUUID(),
  sousAction: SOUS,
  ref,
  ...extra,
});
const hds: FrameworkDefinition = {
  name: 'HDS fictif',
  identifier: 'hds',
  source: {
    organisation: 'Organisation fictive',
    document: 'Cadre de recette',
    url: 'https://example.invalid/hds',
    version: '1',
    date: '2026-10-25',
    license: 'Données fictives de test',
    verifiedAt: '',
    normative: false,
    status: 'organisation',
  },
  domains: [{ id: 'd', label: 'Domaine' }],
  requirements: ['H1', 'H2', 'H3'].map((id) => ({
    id,
    domain: 'd',
    title: `Exigence ${id}`,
    description: 'Fictive',
    applicability: '',
    measureRefs: [],
  })),
};

beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'parc_admin', 'admin'));
  const w = await makeUser(t, 'parc_writer', 'rw'),
    r = await makeUser(t, 'parc_reader', 'ro');
  const creer = async (name: string) =>
    (await admin.post('/api/grc/smsis', { name, scope: 'Recette', nature: '', timezone: 'Europe/Paris' })).json()
      .id as string;
  smsi = await creer('Périmètre parcours');
  autre = await creer('Autre périmètre');
  expect((await admin.put(`/api/grc/${smsi}/members`, { userId: w.id, write: true })).statusCode).toBe(204);
  expect((await admin.put(`/api/grc/${smsi}/members`, { userId: r.id, write: false })).statusCode).toBe(204);
  writer = await login(t, w);
  reader = await login(t, r);
  const fiche = (s: string, name: string) =>
    admin.post(`/api/grc/${s}/objects`, {
      kind: 'action',
      name,
      data: {
        description: 'Fiche fictive',
        status: 'todo',
        ownerId: null,
        startAt: null,
        dueAt: null,
        priority: 'normal',
        category: 'action',
        justification: '',
        reminderDays: 7,
        dependencies: [],
      },
    });
  action = (await fiche(smsi, 'Action associée')).json().id;
  hors = (await fiche(autre, 'Action d’un autre périmètre')).json().id;
});
afterAll(() => t.close());

describe('associations', () => {
  it('associe une fiche, rejoue la commande sans doublon et refuse un doublon', async () => {
    const c = corps('object:' + action, { note: 'Action qui prépare cette étape' });
    const a = await writer.post(root() + '/associations', c);
    expect(a.statusCode, a.body).toBe(201);
    expect(a.json()).toEqual({ rejoue: false });
    expect((await writer.post(root() + '/associations', c)).json()).toEqual({ rejoue: true });
    const doublon = await writer.post(root() + '/associations', corps('object:' + action));
    expect(doublon.statusCode).toBe(409);
    const l = (await reader.get(root() + '/associations')).json().items;
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({
      sousAction: SOUS,
      ref: 'object:' + action,
      name: 'Action associée',
      kind: 'action',
      note: 'Action qui prépare cette étape',
      associePar: 'parc_writer',
    });
    // Le même identifiant de requête ne sert pas à une autre commande.
    const detourne = await writer.post(root() + '/associations', { ...c, ref: 'object:' + hors });
    expect(detourne.statusCode).toBe(409);
  });

  it('refuse une sous-action inconnue, une cible d’un autre périmètre et une référence mal formée', async () => {
    expect(
      (await writer.post(root() + '/associations', corps('object:' + action, { sousAction: 'inconnue' }))).statusCode,
    ).toBe(422);
    expect((await writer.post(root() + '/associations', corps('object:' + hors))).statusCode).toBeGreaterThanOrEqual(
      400,
    );
    expect((await writer.post(root() + '/associations', corps('legacy:items:X'))).statusCode).toBe(422);
    expect((await writer.post(root() + '/associations', { ...corps('object:' + action), extra: 1 })).statusCode).toBe(
      422,
    );
  });

  it('droits : la lecture suffit pour lister, la modification est exigée pour associer et retirer', async () => {
    expect((await reader.post(root() + '/associations', corps('object:' + action))).statusCode).toBe(403);
    expect(
      (await reader.post(root() + '/associations/retrait', corps('object:' + action, { reason: 'Motif de retrait' })))
        .statusCode,
    ).toBe(403);
    const sans = await login(t, await makeUser(t, 'parc_sans', null));
    expect((await sans.get(root() + '/associations')).statusCode).toBe(403);
  });

  it('retire avec un motif, conserve l’historique, journalise et laisse la fiche intacte', async () => {
    const avant = (await admin.get(`/api/grc/${smsi}/objects/${action}`)).json();
    const sans = await writer.post(root() + '/associations/retrait', corps('object:' + action, { reason: 'ok' }));
    expect(sans.statusCode).toBe(422);
    const r = await writer.post(
      root() + '/associations/retrait',
      corps('object:' + action, { reason: 'Associée par erreur' }),
    );
    expect(r.statusCode, r.body).toBe(201);
    expect((await writer.get(root() + '/associations')).json().items).toEqual([]);
    expect(
      (await writer.post(root() + '/associations/retrait', corps('object:' + action, { reason: 'Encore une fois' })))
        .statusCode,
    ).toBe(404);
    const lignes = (
      await t.svc.db.q<{ operation: string; note: string }>(
        'SELECT operation,note FROM parcours_associations WHERE smsi_id=$1 ORDER BY seq',
        [smsi],
      )
    ).rows;
    expect(lignes.map((x) => x.operation)).toEqual(['associer', 'retirer']);
    expect(lignes[1]!.note).toBe('Associée par erreur');
    await expect(t.svc.db.q('DELETE FROM parcours_associations WHERE smsi_id=$1', [smsi])).rejects.toThrow();
    const apres = (await admin.get(`/api/grc/${smsi}/objects/${action}`)).json();
    expect(apres.version).toBe(avant.version);
    const journal = await t.svc.db.q<{ action: string }>(
      "SELECT action FROM audit_log WHERE action LIKE 'parcours.%' ORDER BY id",
    );
    expect(journal.rows.map((x) => x.action)).toEqual(['parcours.association', 'parcours.association_retiree']);
    // On peut de nouveau associer ce qui a été retiré.
    expect((await writer.post(root() + '/associations', corps('object:' + action))).statusCode).toBe(201);
  });

  it('une cible archivée ne s’associe plus', async () => {
    const f = (
      await admin.post(`/api/grc/${smsi}/objects`, {
        kind: 'action',
        name: 'À archiver',
        data: {
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
        },
      })
    ).json();
    expect(
      (await admin.req('DELETE', `/api/grc/${smsi}/objects/${f.id}`, { headers: { 'if-match': `"${f.version}"` } }))
        .statusCode,
    ).toBeLessThan(300);
    expect((await writer.post(root() + '/associations', corps('object:' + f.id))).statusCode).toBe(422);
  });
});

describe('applicabilité HDS (lecture seule)', () => {
  it('sans référentiel HDS rattaché : aucune applicabilité déduite', async () => {
    const r = await reader.get(root() + '/hds');
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toEqual({ referentiel: null, total: 0, applicable: 0, exclue: 0, aDeterminer: 0, nonEvaluee: 0 });
  });

  it('compte les exigences du référentiel HDS rattaché selon leur évaluation courante', async () => {
    const p = await admin.post('/api/library/frameworks/preview', { id: null, definition: hds });
    const pub = await admin.post(
      '/api/library/frameworks/publish',
      { id: null, definition: hds, previewId: p.json().previewId, reason: 'Publication fictive', confirm: 'PUBLIER' },
      { 'if-match': '"0"' },
    );
    expect(pub.statusCode, pub.body).toBe(200);
    const fw = pub.json().id as string;
    expect(
      (await admin.put(`/api/grc/${smsi}/framework-attachments/${fw}`, { version: 1, confirm: 'RATTACHER' }))
        .statusCode,
    ).toBe(200);
    const evaluer = (req: string, applicability: string, attendue: number) =>
      admin.post(
        `/api/grc/${smsi}/exigences/${fw}/${req}/evaluations`,
        {
          applicability,
          implementation: 'aucune',
          justification: applicability === 'exclue' ? 'Hors périmètre de recette' : '',
          reason: 'Revue de recette',
          confirm: 'EVALUER',
        },
        { 'if-match': `"${attendue}"` },
      );
    expect((await evaluer('H1', 'applicable', 0)).statusCode).toBe(201);
    expect((await evaluer('H2', 'exclue', 0)).statusCode).toBe(201);
    const r = (await writer.get(root() + '/hds')).json();
    expect(r.referentiel).toMatchObject({ id: fw, name: 'HDS fictif', version: 1, heritage: false });
    expect(r).toMatchObject({ total: 3, applicable: 1, exclue: 1, aDeterminer: 0, nonEvaluee: 1 });
    // Un autre périmètre, sans rattachement, ne voit rien.
    expect((await admin.get(root(autre) + '/hds')).json().referentiel).toBeNull();
  });
});
