import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { methodTemplate, type RiskMethod } from '@suivi/shared';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, rssi: Agent, smsi: string, other: string;
const cfg = '/api/config-grc';
const root = () => `/api/grc/${smsi}`;
beforeAll(async () => {
  t = await createTestApp();
  rssi = await login(t, await makeUser(t, 'cfgm_rssi', 'rssi'));
  smsi = (await rssi.post('/api/grc/smsis', { name: 'Périmètre A', scope: 'Test', timezone: 'Europe/Paris' })).json()
    .id;
  other = (await rssi.post('/api/grc/smsis', { name: 'Périmètre B', scope: 'Test', timezone: 'Europe/Paris' })).json()
    .id;
});
afterAll(() => t.close());

const etag = async (id: string) => (await rssi.get(`${cfg}/items/${id}`)).headers.etag as string;
async function publishItem(kind: string, key: string, definition: unknown, extra: Record<string, unknown> = {}) {
  const c = await rssi.post(`${cfg}/items`, { kind, key, definition, ...extra });
  expect(c.statusCode, c.body).toBe(201);
  const id = c.json().id as string;
  const p = (await rssi.post(`${cfg}/items/${id}/preview`)).json();
  const r = await rssi.post(
    `${cfg}/items/${id}/publish`,
    { previewId: p.previewId, reason: 'Publication de contrôle', confirm: 'PUBLIER' },
    { 'if-match': await etag(id) },
  );
  expect(r.statusCode, r.body).toBe(200);
  return id;
}
const scale = (name: string, ids: string[], category: string, extra: Record<string, unknown> = {}) => ({
  name,
  category,
  nature: 'qualitative',
  levels: ids.map((id) => ({ id, label: id.toUpperCase(), description: '' })),
  ...extra,
});
const palette = [
  { color: '#718975', acceptability: 'acceptable' },
  { color: '#A36F65', acceptability: 'unacceptable' },
];
const riskLevels = (complete = true) =>
  scale('Niveaux de risque', ['bas', 'haut'], 'risk_level', {
    levels: ['bas', 'haut'].map((id, i) => ({
      id,
      label: id.toUpperCase(),
      description: '',
      ...(complete ? palette[i] : {}),
    })),
  });
const ref = (item: string) => ({ item, version: 1 });
const dimId = methodTemplate('custom').dimensions[0]!.id;
async function catalogue(suffix: string, complete = true) {
  const impact = await publishItem('scale', `imp_${suffix}`, scale('Impact', ['i1', 'i2', 'i3'], 'impact'));
  const vrais = await publishItem('scale', `vra_${suffix}`, scale('Vraisemblance', ['v1', 'v2'], 'likelihood'));
  const niveaux = await publishItem('scale', `niv_${suffix}`, riskLevels(complete));
  const cells = ['i1', 'i2', 'i3'].flatMap((row) =>
    ['v1', 'v2'].map((column) => ({
      row,
      column,
      result: row === 'i3' || column === 'v2' ? 'haut' : 'bas',
      score: null,
    })),
  );
  const matrix = await publishItem('matrix', `mat_${suffix}`, {
    name: 'Matrice',
    category: 'risk',
    rows: { scale: ref(impact), label: 'Impact' },
    columns: { scale: ref(vrais), label: 'Vraisemblance' },
    result: { scale: ref(niveaux) },
    cells,
  });
  return { impact, vrais, niveaux, matrix };
}
const bound = (c: { impact: string; vrais: string; niveaux: string; matrix: string }): RiskMethod => ({
  ...methodTemplate('custom'),
  bindings: {
    dimensions: { [dimId]: ref(c.impact) },
    likelihood: ref(c.vrais),
    levels: ref(c.niveaux),
    matrix: { ref: ref(c.matrix), dimension: dimId },
  },
});
async function publishMethod(definition: RiskMethod, id: string | null = null, version = 0) {
  const p = await rssi.post(root() + '/methods/preview', { id, definition });
  if (p.statusCode !== 200) return p;
  return rssi.post(
    root() + '/methods/publish',
    { id, definition, previewId: p.json().previewId, reason: 'Politique validée pour contrôle', confirm: 'PUBLIER' },
    { 'if-match': `"${version}"` },
  );
}

describe('méthodes épinglées au catalogue', () => {
  it('fige dans la méthode publiée les niveaux et la matrice du catalogue, et enregistre les usages', async () => {
    const c = await catalogue('a');
    const r = await publishMethod(bound(c));
    expect(r.statusCode, r.body).toBe(200);
    const def = r.json().definition as RiskMethod;
    expect(def.dimensions[0]!.levels.map((l) => l.id)).toEqual(['i1', 'i2', 'i3']);
    expect(def.likelihood.map((l) => l.id)).toEqual(['v1', 'v2']);
    expect(def.levels.map((l) => l.id)).toEqual(['bas', 'haut']);
    expect(def.calculation.kind).toBe('matrix');
    expect(def.bindings?.matrix?.ref.item).toBe(c.matrix);
    for (const id of [c.impact, c.vrais, c.niveaux, c.matrix]) {
      const usages = (await rssi.get(`${cfg}/items/${id}/usages`)).json() as {
        consumerKind: string;
        consumerId: string;
      }[];
      expect(
        usages.some((u) => u.consumerKind === 'method_version' && u.consumerId === r.json().id),
        id,
      ).toBe(true);
    }
  });

  it('archiver les éléments du catalogue ne change ni la méthode publiée ni un risque déjà apprécié (019-03)', async () => {
    const c = await catalogue('archive');
    const publiee = (await publishMethod(bound(c))).json();
    const methodId = (publiee.methodId ?? publiee.id) as string;
    const corps = (nom: string) => ({
      kind: 'risk',
      name: nom,
      data: {
        description: 'Risque de contrôle',
        code: 'RA',
        ownerId: null,
        methodId,
        methodVersion: 1,
        domain: 'information',
        entity: 'Entité A',
        scope: 'Hébergement',
        strategy: 'reduce',
        acceptanceReason: '',
        reviewAt: '2026-10-12',
        stages: {},
      },
    });
    const r = await rssi.post(root() + '/objects', corps('Risque avant archivage'));
    expect(r.statusCode, r.body).toBe(200);
    const instantane = async () => {
      const carte = (await rssi.get(root() + `/risk-map?methodId=${methodId}`)).json() as Record<string, unknown>;
      delete carte.generatedAt; // seul l'horodatage de la lecture change
      return {
        carte,
        evaluations: (await rssi.get(root() + `/risks/${r.json().id}/evaluations`)).json(),
        methode: (await rssi.get(root() + `/methods/${methodId}/history`)).json(),
      };
    };
    const avant = await instantane();
    for (const id of [c.matrix, c.impact, c.vrais, c.niveaux])
      expect((await rssi.post(`${cfg}/items/${id}/archive`)).statusCode).toBe(200);
    const apres = await instantane();
    expect(apres).toEqual(avant);
    // La méthode publiée reste utilisable : un nouveau risque se crée toujours avec ses niveaux figés.
    expect((await rssi.post(root() + '/objects', corps('Risque après archivage'))).statusCode).toBe(200);
  });

  it('la version 2 d’une échelle ne change pas la méthode publiée ; une nouvelle version de méthode peut l’adopter', async () => {
    const c = await catalogue('b');
    const first = (await publishMethod(bound(c))).json();
    const save = await rssi.put(
      `${cfg}/items/${c.impact}/draft`,
      { definition: scale('Impact', ['i1', 'i2', 'i3', 'i4'], 'impact') },
      { 'if-match': await etag(c.impact) },
    );
    expect(save.statusCode, save.body).toBe(200);
    const p = (await rssi.post(`${cfg}/items/${c.impact}/preview`)).json();
    expect(
      (
        await rssi.post(
          `${cfg}/items/${c.impact}/publish`,
          { previewId: p.previewId, reason: 'Ajout d’un niveau', confirm: 'PUBLIER' },
          { 'if-match': await etag(c.impact) },
        )
      ).statusCode,
    ).toBe(200);
    const history = (await rssi.get(`${root()}/methods/${first.methodId}/history`)).json() as {
      definition: RiskMethod;
    }[];
    expect(history[0]!.definition.dimensions[0]!.levels).toHaveLength(3);
    const again = await publishMethod(bound(c), first.methodId, 1);
    expect(again.statusCode, again.body).toBe(200);
    expect(again.json().version).toBe(2);
  });

  it('refuse un niveau de risque sans couleur ni acceptabilité, sans rien inventer', async () => {
    const c = await catalogue('c', false);
    const r = await publishMethod(bound(c));
    expect(r.statusCode, r.body).toBe(422);
    expect(r.body).toMatch(/couleur et une acceptabilité/);
  });

  it('refuse une référence inconnue, un type inattendu, une famille incompatible et un autre périmètre', async () => {
    const c = await catalogue('d');
    const inconnue = bound(c);
    inconnue.bindings!.likelihood = { item: '00000000-0000-4000-8000-00000000dead', version: 1 };
    expect((await publishMethod(inconnue)).statusCode).toBe(422);
    const ambigu = bound(c);
    ambigu.bindings!.levels = ref(c.matrix);
    expect((await publishMethod(ambigu)).body).toMatch(/à la fois comme échelle et comme matrice/);
    const seule = await publishItem('scale', 'seule_d', scale('Seule', ['s1', 's2'], 'other'));
    const mauvaisType = bound(c);
    mauvaisType.bindings!.matrix = { ref: ref(seule), dimension: dimId };
    expect((await publishMethod(mauvaisType)).body).toMatch(/une matrice est attendue/);
    const ebiosOnly = await publishItem(
      'scale',
      'ebios_seul',
      scale('Réservée EBIOS', ['v1', 'v2'], 'likelihood', { appliesTo: ['ebios_rm'] }),
    );
    const famille = bound(c);
    famille.bindings!.likelihood = ref(ebiosOnly);
    expect((await publishMethod(famille)).body).toMatch(/ne s’applique pas à la famille/);
    const locale = await publishItem('scale', 'locale_b', scale('Locale B', ['v1', 'v2'], 'likelihood'), {
      scope: 'smsi',
      smsiId: other,
    });
    const autre = bound(c);
    autre.bindings!.likelihood = ref(locale);
    expect((await publishMethod(autre)).body).toMatch(/autre périmètre/);
  });

  it('refuse une matrice dont les axes ne sont pas les échelles épinglées par la méthode', async () => {
    const c = await catalogue('e');
    const autre = await publishItem('scale', 'vra_autre_e', scale('Autre vraisemblance', ['v1', 'v2'], 'likelihood'));
    const def = bound(c);
    def.bindings!.likelihood = ref(autre);
    const r = await publishMethod(def);
    expect(r.statusCode).toBe(422);
    expect(r.body).toMatch(/colonnes de la matrice/);
  });

  it('un élément archivé ne reçoit plus de nouvel usage mais reste valable pour la méthode qui l’épingle déjà', async () => {
    const c = await catalogue('f');
    const first = (await publishMethod(bound(c))).json();
    expect((await rssi.post(`${cfg}/items/${c.vrais}/archive`)).statusCode).toBe(200);
    const again = await publishMethod(bound(c), first.methodId, 1);
    expect(again.statusCode, again.body).toBe(200);
    const nouvelle = await publishMethod(bound(c));
    expect(nouvelle.statusCode).toBe(422);
    expect(nouvelle.body).toMatch(/archivé/);
  });

  it('l’empreinte d’aperçu couvre la définition résolue ; une méthode sans épinglage est publiée telle quelle', async () => {
    const c = await catalogue('g');
    const p = (await rssi.post(root() + '/methods/preview', { id: null, definition: bound(c) })).json();
    expect(p.pinned).toHaveLength(4);
    const altered = bound(c);
    altered.name = 'Autre nom';
    const r = await rssi.post(
      root() + '/methods/publish',
      {
        id: null,
        definition: altered,
        previewId: p.previewId,
        reason: 'Politique validée pour contrôle',
        confirm: 'PUBLIER',
      },
      { 'if-match': '"0"' },
    );
    expect(r.statusCode).toBe(422);
    const plain = methodTemplate('iso27005');
    const ok = await publishMethod(plain);
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().definition.bindings).toBeUndefined();
  });
});
