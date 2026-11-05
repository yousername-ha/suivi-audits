/* Référentiels du périmètre (ADR 0082) : la bibliothèque est figée ; attribuer un référentiel crée une copie propre au
   périmètre, modifiable librement, « en préparation » ; l'appliquer en fait un référentiel suivi en conformité. Les
   périmètres qui héritent lisent la copie de leur ancêtre. Données fictives : aucun texte normatif. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FrameworkDefinition } from '@suivi/shared';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp,
  a: Agent,
  writer: Agent,
  reader: Agent,
  fa: string,
  fb: string,
  parent: string,
  enfant: string,
  autre: string;
const definition = (identifier: string, ids: string[]): FrameworkDefinition => ({
  name: `Référentiel ${identifier}`,
  identifier,
  source: {
    organisation: 'Organisation fictive',
    document: 'Document de recette',
    url: 'https://example.invalid/recette',
    version: '1',
    date: '2026-11-05',
    license: 'Données fictives de test',
    verifiedAt: '',
    normative: false,
    status: 'organisation',
  },
  domains: [{ id: 'gouvernance', label: 'Gouvernance' }],
  requirements: ids.map((id) => ({
    id,
    domain: 'gouvernance',
    title: `Exigence ${id}`,
    description: 'Fictif',
    applicability: 'Tout',
    measureRefs: [],
  })),
});
async function publier(def: FrameworkDefinition, id: string | null, attendue: number) {
  const p = await a.post('/api/library/frameworks/preview', { id, definition: def });
  expect(p.statusCode, p.body).toBe(200);
  const r = await a.post(
    '/api/library/frameworks/publish',
    {
      id,
      definition: def,
      previewId: p.json().previewId,
      reason: 'Publication fictive de recette',
      confirm: 'PUBLIER',
    },
    { 'if-match': `"${attendue}"` },
  );
  expect(r.statusCode, r.body).toBe(200);
  return r.json().id as string;
}
interface Attribue {
  frameworkId: string;
  name: string;
  statut: string;
  suivi: boolean;
  enabled: boolean;
  version: number;
  latestVersion: number;
  copyVersion: number;
  requirements: number;
  inherited: boolean;
  overridden: boolean;
  originName: string | null;
}
const attribues = async (smsi: string) => (await a.get(`/api/grc/${smsi}/framework-attachments`)).json() as Attribue[];
const de = async (smsi: string, fw: string) => (await attribues(smsi)).find((x) => x.frameworkId === fw);
const attribuer = (smsi: string, fw: string, version = 1, agent = a) =>
  agent.put(`/api/grc/${smsi}/framework-attachments/${fw}`, { version, confirm: 'RATTACHER' });
const statut = (smsi: string, fw: string, s: 'preparation' | 'applique', agent = a) =>
  agent.put(`/api/grc/${smsi}/framework-attachments/${fw}/statut`, { statut: s, confirm: 'APPLIQUER' });
const copie = async (smsi: string, fw: string, agent = a) =>
  (await agent.get(`/api/grc/${smsi}/framework-copies/${fw}`)).json() as {
    version: number;
    versionCourante: number;
    sourceVersion: number;
    statut: string;
    modifiable: boolean;
    definition: FrameworkDefinition;
    historique: { version: number; reason: string; requirements: number }[];
  };
const exigence = (smsi: string, fw: string, corps: Record<string, unknown>, agent = a) =>
  agent.post(`/api/grc/${smsi}/framework-copies/${fw}/requirements`, corps);
const couverture = async (smsi: string, fw?: string) =>
  (await a.get(`/api/grc/${smsi}/couverture${fw ? `?frameworkId=${fw}` : ''}`)).json() as {
    frameworks: { frameworkId: string; name: string; requirements: number }[];
    detail: { id: string; etat: string }[] | null;
  };
const evaluer = (smsi: string, fw: string, req: string, attendue = 0) =>
  a.post(
    `/api/grc/${smsi}/exigences/${fw}/${req}/evaluations`,
    { applicability: 'applicable', implementation: 'partielle', reason: 'Revue de recette', confirm: 'EVALUER' },
    { 'if-match': `"${attendue}"` },
  );

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'copie_admin', 'admin'));
  const uw = await makeUser(t, 'copie_writer', 'rw'),
    ur = await makeUser(t, 'copie_reader', 'ro');
  fa = await publier(definition('COPIE-A', ['A-1', 'A-2']), null, 0);
  fb = await publier(definition('COPIE-B', ['B-1', 'B-2']), null, 0);
  const creer = async (name: string, extra: Record<string, unknown> = {}) =>
    (await a.post('/api/grc/smsis', { name, scope: 'Recette', timezone: 'Europe/Paris', ...extra })).json()
      .id as string;
  parent = await creer('Parent copies');
  enfant = await creer('Enfant copies', { parentId: parent, inheritFrameworks: true });
  autre = await creer('Autre copies');
  for (const smsi of [parent, enfant])
    for (const [u, write] of [
      [uw, true],
      [ur, false],
    ] as const)
      expect((await a.put(`/api/grc/${smsi}/members`, { userId: u.id, write })).statusCode).toBe(204);
  writer = await login(t, uw);
  reader = await login(t, ur);
});
afterAll(() => t.close());

describe('attribution : une copie en préparation', () => {
  it('crée une copie propre au périmètre, en préparation, hors conformité', async () => {
    expect((await attribuer(parent, fa, 1, writer)).statusCode).toBe(403);
    const r = await attribuer(parent, fa);
    expect(r.statusCode, r.body).toBe(200);
    expect(await de(parent, fa)).toMatchObject({
      statut: 'preparation',
      suivi: false,
      enabled: true,
      version: 1,
      copyVersion: 1,
      requirements: 2,
      inherited: false,
    });
    expect(await copie(parent, fa)).toMatchObject({ version: 1, sourceVersion: 1, modifiable: true });
    // En préparation : ni couverture, ni évaluation, ni cible de lien.
    expect((await couverture(parent)).frameworks).toEqual([]);
    expect((await evaluer(parent, fa, 'A-1')).statusCode).toBe(404);
    expect(JSON.stringify((await a.get(`/api/grc/${parent}/sources?search=A-1`)).json())).not.toContain(
      `requirement:${fa}`,
    );
    const journal = await t.svc.db.q<{ action: string }>(
      "SELECT action FROM audit_log WHERE action = 'library.framework.attached' AND target = $1",
      [parent],
    );
    expect(journal.rows).toHaveLength(1);
  });
  it('se modifie librement : ajout, modification, retrait et renommage, en versions immuables', async () => {
    // Un lecteur ne modifie rien ; une version attendue périmée est refusée.
    expect(
      (await exigence(parent, fa, { expectedVersion: 1, domain: 'gouvernance', id: 'X', title: 'x' }, reader))
        .statusCode,
    ).toBe(403);
    expect(
      (await exigence(parent, fa, { expectedVersion: 9, domain: 'gouvernance', id: 'X', title: 'x' })).statusCode,
    ).toBe(412);
    let r = await exigence(
      parent,
      fa,
      {
        expectedVersion: 1,
        domain: 'gouvernance',
        id: 'ORG-1',
        title: 'Mesure de l’organisation',
        description: 'Fictive',
      },
      writer,
    );
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ version: 2, requirements: 3 });
    r = await exigence(parent, fa, {
      expectedVersion: 2,
      domain: 'gouvernance',
      id: 'A-1',
      title: 'Intitulé adapté au périmètre',
    });
    expect(r.json()).toMatchObject({ version: 3, requirements: 3 });
    r = await exigence(parent, fa, {
      expectedVersion: 3,
      newDomainLabel: 'Mesures locales',
      id: 'ORG-2',
      title: 'Autre',
    });
    expect(r.json()).toMatchObject({ version: 4, requirements: 4 });
    expect(
      (await exigence(parent, fa, { expectedVersion: 4, domain: 'inconnu', id: 'Y', title: 'y' })).statusCode,
    ).toBe(422);
    r = await a.del(`/api/grc/${parent}/framework-copies/${fa}/requirements/A-2`, { 'if-match': '"4"' });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ version: 5, requirements: 3 });
    r = await a.put(`/api/grc/${parent}/framework-copies/${fa}`, { name: 'A — version du parent', expectedVersion: 5 });
    expect(r.json()).toMatchObject({ version: 6 });
    const c = await copie(parent, fa);
    expect(c.definition.name).toBe('A — version du parent');
    expect(c.definition.identifier).toBe('COPIE-A');
    expect(c.definition.requirements.map((x) => x.id)).toEqual(['A-1', 'ORG-1', 'ORG-2']);
    expect(c.definition.requirements[0]!.title).toBe('Intitulé adapté au périmètre');
    expect(c.historique.map((h) => h.version)).toEqual([6, 5, 4, 3, 2, 1]);
    // Versions précédentes consultables ; versions immuables, même pour la base.
    const v1 = (await a.get(`/api/grc/${parent}/framework-copies/${fa}?version=1`)).json();
    expect(v1.definition.requirements.map((x: { id: string }) => x.id)).toEqual(['A-1', 'A-2']);
    await expect(
      t.svc.db.q("UPDATE grc_framework_copy_versions SET reason = 'x' WHERE smsi_id = $1", [parent]),
    ).rejects.toThrow();
    // La bibliothèque reste intacte.
    const lib = (await a.get(`/api/library/frameworks/${fa}/versions/1`)).json().definition as FrameworkDefinition;
    expect(lib.name).toBe('Référentiel COPIE-A');
    expect(lib.requirements.map((x) => x.id)).toEqual(['A-1', 'A-2']);
    expect(await de(parent, fa)).toMatchObject({ name: 'A — version du parent', copyVersion: 6, version: 1 });
  });
});

describe('application : un référentiel suivi en conformité', () => {
  it('appliquer est réservé à l’administration du Pilotage, et fait entrer la copie dans la conformité', async () => {
    expect((await statut(parent, fa, 'applique', writer)).statusCode).toBe(403);
    const r = await statut(parent, fa, 'applique');
    expect(r.statusCode, r.body).toBe(200);
    expect(await de(parent, fa)).toMatchObject({ statut: 'applique', suivi: true });
    const c = await couverture(parent, fa);
    expect(c.frameworks).toEqual([
      expect.objectContaining({ frameworkId: fa, name: 'A — version du parent', requirements: 3 }),
    ]);
    expect(c.detail!.map((x) => x.id)).toEqual(['A-1', 'ORG-1', 'ORG-2']);
    // Une exigence ajoutée dans la copie s'évalue et se relie comme les autres.
    const e = await evaluer(parent, fa, 'ORG-1');
    expect(e.statusCode, e.body).toBe(201);
    expect((await evaluer(parent, fa, 'A-2')).statusCode).toBe(404);
    expect(JSON.stringify((await a.get(`/api/grc/${parent}/sources?search=ORG-1`)).json())).toContain(
      `requirement:${fa}:1:ORG-1`,
    );
  });
  it('reste modifiable une fois appliqué : l’évaluation suit l’exigence par son identifiant', async () => {
    const r = await exigence(parent, fa, {
      expectedVersion: 6,
      domain: 'gouvernance',
      id: 'ORG-1',
      title: 'Mesure de l’organisation, reformulée',
    });
    expect(r.statusCode, r.body).toBe(200);
    const d = (await couverture(parent, fa)).detail!;
    expect(d.find((x) => x.id === 'ORG-1')).toMatchObject({ etat: 'partiel' });
  });
  it('repasser en préparation sort la copie du suivi sans rien effacer', async () => {
    expect((await statut(parent, fa, 'preparation')).statusCode).toBe(200);
    expect((await couverture(parent)).frameworks).toEqual([]);
    const n = await t.svc.db.one<{ n: number }>(
      'SELECT count(*)::int AS n FROM grc_requirement_assessments WHERE smsi_id = $1',
      [parent],
    );
    expect(n!.n).toBe(1);
    expect((await statut(parent, fa, 'applique')).statusCode).toBe(200);
    expect((await couverture(parent, fa)).detail!.find((x) => x.id === 'ORG-1')).toMatchObject({ etat: 'partiel' });
  });
});

describe('héritage : les sous-périmètres suivent la copie du parent', () => {
  it('l’enfant lit la copie du parent, sans pouvoir la modifier ni l’appliquer', async () => {
    expect(await de(enfant, fa)).toMatchObject({
      inherited: true,
      originName: 'Parent copies',
      statut: 'applique',
      suivi: true,
      name: 'A — version du parent',
    });
    expect((await couverture(enfant, fa)).detail!.map((x) => x.id)).toEqual(['A-1', 'ORG-1', 'ORG-2']);
    expect(await copie(enfant, fa)).toMatchObject({ modifiable: false });
    expect(
      (await exigence(enfant, fa, { expectedVersion: 7, domain: 'gouvernance', id: 'Z', title: 'z' })).statusCode,
    ).toBe(404);
    expect((await statut(enfant, fa, 'preparation')).statusCode).toBe(404);
    // Une modification du parent se voit aussitôt chez l'enfant.
    await exigence(parent, fa, { expectedVersion: 7, domain: 'gouvernance', id: 'ORG-3', title: 'Nouvelle' });
    expect((await couverture(enfant, fa)).frameworks[0]).toMatchObject({ requirements: 4 });
  });
  it('« Désactiver ici » crée une surcharge locale, sans copie ; l’enfant ne peut pas la modifier', async () => {
    const r = await a.put(`/api/grc/${enfant}/framework-attachments/${fa}/activation`, { enabled: false });
    expect(r.statusCode, r.body).toBe(200);
    expect(await de(enfant, fa)).toMatchObject({ inherited: true, overridden: true, enabled: false, suivi: false });
    expect((await couverture(enfant)).frameworks).toEqual([]);
    expect((await statut(enfant, fa, 'applique')).statusCode).toBe(422);
    await a.put(`/api/grc/${enfant}/framework-attachments/${fa}/activation`, { enabled: true });
    expect(await de(enfant, fa)).toMatchObject({ inherited: true, suivi: true });
  });
  it('attribuer chez l’enfant lui donne sa propre copie, qui l’emporte sur celle du parent', async () => {
    const r = await attribuer(enfant, fa);
    expect(r.statusCode, r.body).toBe(200);
    expect(await de(enfant, fa)).toMatchObject({ inherited: false, statut: 'preparation', requirements: 2 });
    expect(await copie(enfant, fa)).toMatchObject({ modifiable: true });
    expect(await de(parent, fa)).toMatchObject({ requirements: 4, statut: 'applique' });
    // Détacher la copie de l'enfant rend la copie héritée du parent.
    expect((await a.del(`/api/grc/${enfant}/framework-attachments/${fa}`)).statusCode).toBe(200);
    expect(await de(enfant, fa)).toMatchObject({ inherited: true, requirements: 4 });
  });
});

describe('édition de la bibliothèque, correspondances et détachement', () => {
  it('reprendre une nouvelle édition de la bibliothèque remplace le contenu de la copie, statut conservé', async () => {
    await publier(definition('COPIE-A', ['A-1', 'A-2', 'A-3']), fa, 1);
    expect(await de(parent, fa)).toMatchObject({ version: 1, latestVersion: 2 });
    const r = await attribuer(parent, fa, 2);
    expect(r.statusCode, r.body).toBe(200);
    expect(await de(parent, fa)).toMatchObject({ version: 2, statut: 'applique', requirements: 3 });
    const c = await copie(parent, fa);
    expect(c.sourceVersion).toBe(2);
    expect(c.historique[0]!.reason).toMatch(/Reprise de l’édition 2/);
  });
  it('les correspondances de l’organisation s’appliquent aux copies appliquées', async () => {
    await attribuer(autre, fa, 2);
    await statut(autre, fa, 'applique');
    await attribuer(autre, fb);
    const m = await a.post('/api/library/mappings', {
      source: { frameworkId: fa, version: 2, requirementId: 'A-3' },
      target: { frameworkId: fb, version: 1, requirementId: 'B-1' },
      type: 'equivalent',
      justification: 'Correspondance fictive de recette, revue par le pilote',
      coverage: 100,
      origin: 'human',
      sourceUrl: 'https://example.invalid/correspondance',
    });
    expect(m.statusCode, m.body).toBe(200);
    const v = await a.post(
      `/api/library/mappings/${m.json().id}/validate`,
      { note: 'Correspondance examinée par le responsable', confirm: 'VALIDER' },
      { 'if-match': '"1"' },
    );
    expect(v.statusCode, v.body).toBe(200);
    const mesure = (await a.post(`/api/grc/${autre}/objects`, { kind: 'measure', name: 'Mesure', data: {} })).json()
      .id as string;
    const l = await a.post(`/api/grc/${autre}/links`, {
      source: 'object:' + mesure,
      target: `requirement:${fa}:2:A-3`,
      type: 'implements',
      note: 'Lien de recette',
    });
    expect(l.statusCode, l.body).toBe(200);
    const enAttente = async () =>
      ((await a.get(`/api/grc/${autre}/rapprochements?status=pending`)).json() as unknown[]).length;
    // B est en préparation : aucune proposition. Appliqué : une proposition.
    expect(await enAttente()).toBe(0);
    await statut(autre, fb, 'applique');
    expect(await enAttente()).toBe(1);
    // L'exigence cible retirée de la copie : la proposition est retirée.
    await a.del(`/api/grc/${autre}/framework-copies/${fb}/requirements/B-1`, { 'if-match': '"1"' });
    expect(await enAttente()).toBe(0);
  });
  it('détacher la copie du parent retire aussi les surcharges devenues sans effet chez l’enfant', async () => {
    await a.put(`/api/grc/${enfant}/framework-attachments/${fb}`, { version: 1, confirm: 'RATTACHER' });
    await a.del(`/api/grc/${enfant}/framework-attachments/${fb}`);
    await attribuer(parent, fb);
    await a.put(`/api/grc/${enfant}/framework-attachments/${fb}/activation`, { enabled: false });
    expect(await de(enfant, fb)).toMatchObject({ overridden: true });
    expect((await a.del(`/api/grc/${parent}/framework-attachments/${fb}`)).statusCode).toBe(200);
    expect(await de(enfant, fb)).toBeUndefined();
    const lignes = await t.svc.db.q('SELECT 1 FROM grc_scope_frameworks WHERE smsi_id = $1 AND framework_id = $2', [
      enfant,
      fb,
    ]);
    expect(lignes.rows).toHaveLength(0);
  });
});
