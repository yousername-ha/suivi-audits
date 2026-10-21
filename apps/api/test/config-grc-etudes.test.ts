/* Liaison d'une étude EBIOS RM au catalogue de configuration (ADR 0038) : la matrice de pertinence est épinglée à une
   version précise, vérifiée par le serveur, et l'étude est enregistrée comme usage « analyse » de cette version. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent, smsi: string, matrice: { item: string; version: number }, echelle: string, autre: string;
const cfg = '/api/config-grc';
const root = () => `/api/grc/${smsi}`;
beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'cfge_admin', 'admin'));
  smsi = (await a.post('/api/grc/smsis', { name: 'Périmètre études', scope: 'Test', timezone: 'Europe/Paris' })).json()
    .id;
  const adopt = await a.post(`${cfg}/templates/ebios-pertinence-sr-ov/adopt`, {});
  expect(adopt.statusCode, adopt.body).toBe(201);
  const items = adopt.json() as { id: string; kind: string; key: string; currentVersion: number }[];
  const m = items.find((i) => i.kind === 'matrix')!;
  matrice = { item: m.id, version: m.currentVersion };
  echelle = items.find((i) => i.kind === 'scale')!.id;
  const c = await a.post(`${cfg}/items`, {
    kind: 'matrix',
    key: 'matrice_iso_seule',
    definition: {
      name: 'Matrice réservée à ISO',
      category: 'risk',
      appliesTo: ['iso27005'],
      rows: { scale: { item: echelle, version: 1 }, label: 'L' },
      columns: { scale: { item: echelle, version: 1 }, label: 'C' },
      result: { scale: { item: echelle, version: 1 } },
      cells: [],
    },
  });
  expect(c.statusCode, c.body).toBe(201);
  autre = c.json().id;
});
afterAll(() => t.close());

const etude = (configuration: unknown, name = 'Étude fictive') =>
  a.post(root() + '/objects', { kind: 'risk_study', name, data: { objective: 'Recette', configuration } });
const usages = async (id: string) =>
  (await a.get(`${cfg}/items/${id}/usages`)).json() as { consumerKind: string; consumerId: string }[];

describe('étude liée à une matrice de pertinence', () => {
  it('épingle la matrice, enregistre l’usage « analyse » et garde l’étude sans liaison inchangée', async () => {
    const sans = await etude(null, 'Sans liaison');
    expect(sans.statusCode, sans.body).toBe(200);
    const r = await etude({ relevanceMatrix: matrice });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().data.configuration.relevanceMatrix).toEqual(matrice);
    const u = (await usages(matrice.item)).filter((x) => x.consumerKind === 'analysis');
    expect(u.map((x) => x.consumerId)).toContain(r.json().id);
    expect(u.map((x) => x.consumerId)).not.toContain(sans.json().id);
  });

  it('refuse une référence inconnue, un élément d’un autre type et une famille incompatible', async () => {
    const inconnue = await etude({ relevanceMatrix: { item: '00000000-0000-4000-8000-00000000beef', version: 1 } });
    expect(inconnue.statusCode).toBe(422);
    const mauvaisType = await etude({ relevanceMatrix: { item: echelle, version: 1 } });
    expect(mauvaisType.statusCode).toBe(422);
    expect(mauvaisType.body).toMatch(/type attendu/);
    // Brouillon jamais publié : pas de version à épingler.
    const brouillon = await etude({ relevanceMatrix: { item: autre, version: 1 } });
    expect(brouillon.statusCode).toBe(422);
  });

  it('refuse un champ inconnu dans la liaison et accepte les niveaux du couple sur les échelles épinglées', async () => {
    expect((await etude({ relevanceMatrix: matrice, extra: 1 })).statusCode).toBe(422);
    const e = await etude({ relevanceMatrix: matrice }, 'Étude des couples');
    const couple = await a.post(root() + '/objects', {
      kind: 'sr_ov',
      name: 'Couple fictif',
      data: {
        studyRef: 'object:' + e.json().id,
        resourcesLevel: 'n2',
        motivationLevel: 'n3',
        relevanceLevel: 'medium',
        justification: 'Choix de l’analyste, argumenté pour la recette',
      },
    });
    expect(couple.statusCode, couple.body).toBe(200);
    expect(couple.json().data.relevanceLevel).toBe('medium');
    // Un niveau qui n'existe pas dans l'échelle épinglée est refusé par le serveur, champ par champ.
    for (const champ of ['resourcesLevel', 'motivationLevel', 'relevanceLevel']) {
      const refus = await a.post(root() + '/objects', {
        kind: 'sr_ov',
        name: 'Couple hors échelle',
        data: { studyRef: 'object:' + e.json().id, [champ]: 'niveau_inconnu' },
      });
      expect(refus.statusCode, champ).toBe(422);
      expect(refus.body).toContain(champ);
    }
  });

  it('exige une justification quand la pertinence retenue diffère de la proposition, et refuse « retenu » sur un couple écarté', async () => {
    const e = await etude({ relevanceMatrix: matrice }, 'Étude de la pertinence retenue');
    const base = { studyRef: 'object:' + e.json().id, resourcesLevel: 'n3', motivationLevel: 'n3' };
    const creer = (data: Record<string, unknown>) =>
      a.post(root() + '/objects', { kind: 'sr_ov', name: 'Couple', data: { ...base, ...data } });
    // La proposition suit la matrice : la retenir telle quelle ne demande aucune justification.
    const propose = (await creer({ relevanceLevel: 'high' })).json();
    expect(propose.data.relevanceLevel).toBe('high');
    // Un choix différent sans justification est refusé, avec justification il est accepté.
    const sans = await creer({ relevanceLevel: 'low' });
    expect(sans.statusCode, sans.body).toBe(422);
    expect(sans.body).toMatch(/Justifiez/);
    const avec = await creer({ relevanceLevel: 'low', justification: 'Source sans objectif crédible ici' });
    expect(avec.statusCode, avec.body).toBe(200);
    // Un couple dont le niveau écarte ne peut pas être « retenu » ; non retenu, il est accepté.
    const source = (
      await a.post(root() + '/objects', {
        kind: 'risk_source',
        name: 'Source fictive',
        data: { studyRef: base.studyRef, category: 'crime' },
      })
    ).json();
    const retenu = await creer({
      relevanceLevel: 'low',
      retained: true,
      sourceRef: 'object:' + source.id,
      justification: 'Choix argumenté',
    });
    expect(retenu.statusCode, retenu.body).toBe(422);
    expect(retenu.body).toMatch(/écarte/);
  });

  it('archiver la matrice interdit une nouvelle liaison mais pas la modification d’une étude déjà liée', async () => {
    const liee = await etude({ relevanceMatrix: matrice }, 'Étude déjà liée');
    expect((await a.post(`${cfg}/items/${matrice.item}/archive`)).statusCode).toBe(200);
    const nouvelle = await etude({ relevanceMatrix: matrice }, 'Nouvelle liaison');
    expect(nouvelle.statusCode).toBe(422);
    expect(nouvelle.body).toMatch(/archivé/);
    const maj = await a.put(
      root() + '/objects/' + liee.json().id,
      { kind: 'risk_study', name: 'Étude déjà liée', data: { ...liee.json().data, objective: 'Objet mis à jour' } },
      { 'if-match': `"${liee.json().version}"` },
    );
    expect(maj.statusCode, maj.body).toBe(200);
  });
});

describe('étude liée à une correspondance impact → gravité (atelier 1)', () => {
  let correspondance: { item: string; version: number };
  const publier = async (kind: string, key: string, definition: unknown) => {
    const c = await a.post(`${cfg}/items`, { kind, key, definition });
    expect(c.statusCode, c.body).toBe(201);
    const id = c.json().id as string;
    const p = (await a.post(`${cfg}/items/${id}/preview`)).json();
    const r = await a.post(
      `${cfg}/items/${id}/publish`,
      { previewId: p.previewId, reason: 'Publication de contrôle', confirm: 'PUBLIER' },
      { 'if-match': (await a.get(`${cfg}/items/${id}`)).headers.etag as string },
    );
    expect(r.statusCode, r.body).toBe(200);
    return id;
  };
  const niveaux = (ids: string[]) => ids.map((id) => ({ id, label: id.toUpperCase(), description: '' }));
  beforeAll(async () => {
    const impact = await publier('scale', 'impact_etude', {
      name: 'Impact',
      category: 'impact',
      nature: 'qualitative',
      dimensions: [{ id: 'activite', label: 'Activité' }],
      levels: niveaux(['i1', 'i2', 'i3']),
    });
    const gravite = await publier('scale', 'gravite_etude', {
      name: 'Gravité',
      category: 'severity',
      nature: 'qualitative',
      levels: niveaux(['g1', 'g2', 'g3', 'g4']),
    });
    const m = await publier('mapping', 'impact_vers_gravite', {
      name: 'Impact vers gravité',
      from: { item: impact, version: 1 },
      to: { item: gravite, version: 1 },
      pairs: [
        { from: 'i1', to: 'g1' },
        { from: 'i2', to: 'g3' },
        { from: 'i3', to: 'g4' },
      ],
      aggregation: 'max',
    });
    correspondance = { item: m, version: 1 };
  });

  it('épingle la correspondance, enregistre l’usage et accepte les impacts et la gravité retenue', async () => {
    const e = await etude({ severityMapping: correspondance }, 'Étude gravité');
    expect(e.statusCode, e.body).toBe(200);
    expect((await usages(correspondance.item)).some((x) => x.consumerId === e.json().id)).toBe(true);
    const er = await a.post(root() + '/objects', {
      kind: 'feared_event',
      name: 'Événement fictif',
      data: {
        studyRef: 'object:' + e.json().id,
        impactLevels: [
          { category: 'activite', level: 'i1' },
          { category: null, level: 'i2' },
        ],
        severityLevel: 'g3',
      },
    });
    expect(er.statusCode, er.body).toBe(200);
    expect(er.json().data.severityLevel).toBe('g3');
    expect(er.json().data.impactLevels).toHaveLength(2);
  });

  it('refuse une gravité ou un niveau d’impact absents des échelles épinglées', async () => {
    const e = await etude({ severityMapping: correspondance }, 'Étude niveaux hors échelle');
    const creer = (data: Record<string, unknown>) =>
      a.post(root() + '/objects', {
        kind: 'feared_event',
        name: 'Événement hors échelle',
        data: { studyRef: 'object:' + e.json().id, ...data },
      });
    const gravite = await creer({ severityLevel: 'g9' });
    expect(gravite.statusCode, gravite.body).toBe(422);
    expect(gravite.body).toContain('severityLevel');
    const impact = await creer({ impactLevels: [{ category: null, level: 'i9' }] });
    expect(impact.statusCode, impact.body).toBe(422);
    expect(impact.body).toContain('impactLevels');
    expect((await creer({ severityLevel: 'g2', impactLevels: [{ category: null, level: 'i1' }] })).statusCode).toBe(
      200,
    );
  });

  it('refuse un élément qui n’est pas une correspondance et un champ inconnu dans un impact', async () => {
    const mauvais = await etude({ severityMapping: matrice });
    expect(mauvais.statusCode).toBe(422);
    expect(mauvais.body).toMatch(/type attendu/);
    const e = await etude({ severityMapping: correspondance }, 'Étude impacts');
    const er = await a.post(root() + '/objects', {
      kind: 'feared_event',
      name: 'Événement invalide',
      data: { studyRef: 'object:' + e.json().id, impactLevels: [{ level: 'i1', extra: 1 }] },
    });
    expect(er.statusCode).toBe(422);
  });
});

describe('partie prenante de l’écosystème liée au registre des fournisseurs (atelier 3)', () => {
  it('lie un fournisseur du registre ; refuse une autre cible', async () => {
    const f = await a.post('/api/suppliers', { name: 'Prestataire fictif atelier 3' });
    expect(f.statusCode, f.body).toBeLessThan(300);
    const ref = 'legacy:suppliers:' + (f.json().id ?? f.json().supplier?.id);
    const e = await etude(null, 'Étude écosystème');
    const studyRef = 'object:' + e.json().id;
    const ok = await a.post(root() + '/objects', {
      kind: 'ecosystem_party',
      name: 'Prestataire (écosystème)',
      data: { studyRef, supplierRef: ref },
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().data.supplierRef).toBe(ref);
    const mauvais = await a.post(root() + '/objects', {
      kind: 'ecosystem_party',
      name: 'Mauvaise cible',
      data: { studyRef, supplierRef: studyRef },
    });
    expect(mauvais.statusCode).toBe(422);
  });
});

describe('migration explicite d’une étude vers une nouvelle version de configuration', () => {
  it('mesure l’impact, exige confirmation et motif, ne réécrit aucune évaluation', async () => {
    // La matrice a été archivée par un test précédent : on la restaure avant de lier une nouvelle étude.
    await a.post(`${cfg}/items/${matrice.item}/restore`);
    const e = await a.post(root() + '/objects', {
      kind: 'risk_study',
      name: 'Étude à migrer',
      data: { objective: 'Migration', configuration: { relevanceMatrix: { item: matrice.item, version: 1 } } },
    });
    expect(e.statusCode, e.body).toBe(200);
    const studyRef = 'object:' + e.json().id;
    const couple = await a.post(root() + '/objects', {
      kind: 'sr_ov',
      name: 'Couple migré',
      data: {
        studyRef,
        resourcesLevel: 'n2',
        motivationLevel: 'n3',
        relevanceLevel: 'medium',
        justification: 'Choix de l’analyste, argumenté pour la recette',
      },
    });
    expect(couple.statusCode, couple.body).toBe(200);
    const url = `${root()}/studies/${e.json().id}/configuration-migration`;

    // Rien à migrer tant que la matrice épinglée est la version courante.
    const avant = (await a.get(url)).json();
    expect(avant.upToDate).toBe(true);

    // Nouvelle version de la matrice : une cellule change de résultat.
    const item = (await a.get(`${cfg}/items/${matrice.item}`)).json();
    const definition = structuredClone(item.definition) as { cells: { row: string; column: string; result: string }[] };
    const cellule = definition.cells[0]!;
    cellule.result = definition.cells.find((c) => c.result !== cellule.result)!.result;
    expect(
      (
        await a.put(
          `${cfg}/items/${matrice.item}/draft`,
          { definition },
          { 'if-match': (await a.get(`${cfg}/items/${matrice.item}`)).headers.etag as string },
        )
      ).statusCode,
    ).toBe(200);
    const p = (await a.post(`${cfg}/items/${matrice.item}/preview`)).json();
    const pub = await a.post(
      `${cfg}/items/${matrice.item}/publish`,
      { previewId: p.previewId, reason: 'Cellule corrigée pour la recette', confirm: 'PUBLIER' },
      { 'if-match': (await a.get(`${cfg}/items/${matrice.item}`)).headers.etag as string },
    );
    expect(pub.statusCode, pub.body).toBe(200);

    const apercu = (await a.get(url)).json();
    expect(apercu.upToDate).toBe(false);
    expect(apercu.pins[0]).toMatchObject({ slot: 'relevanceMatrix', from: 1, to: 2, changed: true, resultsChanged: 1 });
    expect(apercu.pins[0].evaluations).toBe(1);

    const ifMatch = { 'if-match': `"${apercu.version}"` };
    const corps = { previewId: apercu.previewId, reason: 'Adoption de la matrice corrigée', confirm: 'MIGRER' };
    expect((await a.post(url, { ...corps, confirm: 'OUI' }, ifMatch)).statusCode).toBe(422);
    expect((await a.post(url, { ...corps, reason: 'court' }, ifMatch)).statusCode).toBe(422);
    expect((await a.post(url, { ...corps, previewId: 'a'.repeat(64) }, ifMatch)).statusCode).toBe(422);
    expect((await a.post(url, corps, { 'if-match': '"999"' })).statusCode).toBe(412);
    const ok = await a.post(url, corps, ifMatch);
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().data.configuration.relevanceMatrix).toEqual({ item: matrice.item, version: 2 });

    // L'étude est à jour, l'usage de la version 2 est enregistré et l'évaluation du couple n'a pas changé.
    expect((await a.get(url)).json().upToDate).toBe(true);
    expect((await a.post(url, corps, { 'if-match': `"${ok.json().version}"` })).statusCode).toBe(422);
    expect((await usages(matrice.item)).some((u) => u.consumerId === e.json().id)).toBe(true);
    const relu = (await a.get(`${root()}/objects/${couple.json().id}`)).json();
    expect(relu.data.relevanceLevel).toBe('medium');
  });
});
