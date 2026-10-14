import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cfgTemplates } from '@suivi/shared';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, admin: Agent, rssi: Agent, reader: Agent, contributor: Agent, outsider: Agent;
const base = '/api/config-grc';
beforeAll(async () => {
  t = await createTestApp();
  admin = await login(t, await makeUser(t, 'cfg_admin', 'admin'));
  rssi = await login(t, await makeUser(t, 'cfg_rssi', 'rssi'));
  reader = await login(t, await makeUser(t, 'cfg_reader', 'ro'));
  contributor = await login(t, await makeUser(t, 'cfg_contrib', 'rw'));
  outsider = await login(t, await makeUser(t, 'cfg_outsider', 'rssi'));
});
afterAll(() => t.close());

const levels = (ids: string[]) => ids.map((id) => ({ id, label: id.toUpperCase(), description: 'Niveau ' + id }));
const scale = (name: string, ids = ['n1', 'n2', 'n3', 'n4'], category = 'severity') => ({
  name,
  category,
  nature: 'qualitative',
  levels: levels(ids),
});
type Item = { id: string; version: number; currentVersion: number | null; state: string };
const create = async (a: Agent, kind: string, key: string, definition: unknown, extra: Record<string, unknown> = {}) =>
  a.post(`${base}/items`, { kind, key, definition, ...extra });
const etagOf = async (a: Agent, id: string) => (await a.get(`${base}/items/${id}`)).headers.etag as string;
const preview = async (a: Agent, id: string) => (await a.post(`${base}/items/${id}/preview`)).json();
const publishWith = async (a: Agent, id: string, reason = 'Publication de contrôle') => {
  const p = await preview(a, id);
  return a.post(
    `${base}/items/${id}/publish`,
    { previewId: p.previewId, reason, confirm: 'PUBLIER' },
    { 'if-match': await etagOf(a, id) },
  );
};
const saveDraft = async (a: Agent, id: string, definition: unknown, etag?: string) =>
  a.put(`${base}/items/${id}/draft`, { definition }, { 'if-match': etag ?? (await etagOf(a, id)) });
const published = async (
  a: Agent,
  kind: string,
  key: string,
  definition: unknown,
  extra: Record<string, unknown> = {},
) => {
  const r = await create(a, kind, key, definition, extra);
  expect(r.statusCode, r.body).toBe(201);
  const id = (r.json() as Item).id;
  const p = await publishWith(a, id);
  expect(p.statusCode, p.body).toBe(200);
  return { id, item: p.json() as Item };
};
const matrixOf = (
  rows: string,
  columns: string,
  result: string,
  cells: { row: string; column: string; result: string }[],
) => ({
  name: 'Matrice de contrôle',
  category: 'risk',
  rows: { scale: { item: rows, version: 1 }, label: 'Gravité' },
  columns: { scale: { item: columns, version: 1 }, label: 'Vraisemblance' },
  result: { scale: { item: result, version: 1 } },
  cells,
});

describe('catalogue vide, droits et cycle de vie', () => {
  it('est vide à l’installation et propose des modèles sans en livrer', async () => {
    expect((await admin.get(`${base}/items`)).json()).toEqual([]);
    const tpl = (await admin.get(`${base}/templates`)).json() as { id: string; note: string }[];
    expect(tpl.map((x) => x.id)).toContain('ebios-pertinence-sr-ov');
    expect(tpl[0]!.note).toMatch(/valider/);
    expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int n FROM cfg_items'))!.n).toBe(0);
  });
  it('refuse sans session et sans droit de configuration', async () => {
    const anon = (await import('./helpers.js')).Agent;
    expect((await new anon(t).get(`${base}/items`)).statusCode).toBe(401);
    expect((await reader.get(`${base}/items`)).statusCode).toBe(200); // lecture seule
    for (const a of [reader, contributor]) {
      const r = await create(a, 'scale', 'refusee', scale('Refusée'));
      expect(r.statusCode).toBe(403);
    }
    expect((await contributor.post(`${base}/templates/ebios-pertinence-sr-ov/adopt`)).statusCode).toBe(403);
  });
  it('crée un brouillon, le simule, le publie en version 1 immuable avec audit', async () => {
    const r = await create(rssi, 'scale', 'gravite', scale('Gravité'));
    expect(r.statusCode, r.body).toBe(201);
    const item = r.json() as Item;
    expect(item).toMatchObject({ state: 'draft', currentVersion: null, version: 1 });
    const detail = (await rssi.get(`${base}/items/${item.id}`)).json();
    expect(detail.draft.levels).toHaveLength(4);
    expect(detail.definition).toBeNull();
    const p = await preview(rssi, item.id);
    expect(p).toMatchObject({ valid: true, changed: true, nextVersion: 1, currentVersion: null });
    const out = await publishWith(rssi, item.id, 'Première version de l’échelle de gravité');
    expect(out.json()).toMatchObject({ state: 'active', currentVersion: 1 });
    const after = (await rssi.get(`${base}/items/${item.id}`)).json();
    expect(after.draft).toBeNull();
    expect(after.definition.name).toBe('Gravité');
    expect(after.versions).toHaveLength(1);
    const audit = await t.svc.db.one<{ details: { version: number } }>(
      "SELECT details FROM audit_log WHERE action='config.publish' ORDER BY id DESC LIMIT 1",
    );
    expect(audit!.details).toMatchObject({ version: 1 });
  });
  it('refuse confirmation manquante, empreinte altérée, précondition absente ou périmée', async () => {
    const { id } = await published(
      rssi,
      'scale',
      'vraisemblance',
      scale('Vraisemblance', ['v1', 'v2', 'v3'], 'likelihood'),
    );
    expect((await saveDraft(rssi, id, scale('Vraisemblance', ['v1', 'v2', 'v3', 'v4'], 'likelihood'))).statusCode).toBe(
      200,
    );
    const p = await preview(rssi, id);
    const etag = await etagOf(rssi, id);
    const body = { previewId: p.previewId, reason: 'Ajout d’un niveau de vraisemblance', confirm: 'PUBLIER' };
    expect(
      (await rssi.post(`${base}/items/${id}/publish`, { ...body, confirm: 'OK' }, { 'if-match': etag })).statusCode,
    ).toBe(422);
    expect((await rssi.post(`${base}/items/${id}/publish`, body)).statusCode).toBe(428);
    expect(
      (await rssi.post(`${base}/items/${id}/publish`, { ...body, previewId: 'a'.repeat(64) }, { 'if-match': etag }))
        .statusCode,
    ).toBe(422);
    expect((await rssi.post(`${base}/items/${id}/publish`, body, { 'if-match': '"99"' })).statusCode).toBe(412);
    expect((await rssi.post(`${base}/items/${id}/publish`, body, { 'if-match': etag })).statusCode).toBe(200);
  });
  it('refuse deux publications identiques et deux enregistrements concurrents du brouillon', async () => {
    const { id } = await published(rssi, 'scale', 'concurrence', scale('Concurrence'));
    expect((await saveDraft(rssi, id, scale('Concurrence'))).statusCode).toBe(200); // brouillon identique à la version publiée
    const p = await preview(rssi, id);
    expect(p.changed).toBe(false);
    const stale = await etagOf(rssi, id);
    expect((await publishWith(rssi, id)).statusCode).toBe(422); // aucun changement
    expect((await saveDraft(rssi, id, scale('Concurrence 2'), stale)).statusCode).toBe(200);
    expect((await saveDraft(rssi, id, scale('Concurrence 3'), stale)).statusCode).toBe(412);
  });
  it('rejette une définition invalide, un identifiant déjà pris et un type inconnu', async () => {
    expect(
      (await create(rssi, 'scale', 'invalide', { name: 'X', category: 'severity', nature: 'qualitative', levels: [] }))
        .statusCode,
    ).toBe(422);
    expect((await create(rssi, 'scale', 'Majuscules', scale('X'))).statusCode).toBe(422);
    expect((await create(rssi, 'scale', 'gravite', scale('Doublon'))).statusCode).toBe(409);
    expect((await create(rssi, 'inconnu', 'x', scale('X'))).statusCode).toBe(422);
  });
});

describe('versions immuables et étude d’impact', () => {
  it('une version publiée ne change jamais : la version 2 n’altère pas la version 1', async () => {
    const { id } = await published(rssi, 'scale', 'impact_org', scale('Impact', ['i1', 'i2', 'i3', 'i4'], 'impact'));
    const v1 = (await rssi.get(`${base}/items/${id}/versions/1`)).json();
    const d = scale('Impact', ['i1', 'i2', 'i3'], 'impact'); // niveau i4 supprimé
    await saveDraft(rssi, id, d);
    const p = await preview(rssi, id);
    expect(p.impact.scaleDiff).toMatchObject({ removed: ['i4'], breaking: true });
    expect((await publishWith(rssi, id, 'Suppression du niveau 4 (essai)')).statusCode).toBe(200);
    expect((await rssi.get(`${base}/items/${id}/versions/1`)).json().definition).toEqual(v1.definition);
    expect((await rssi.get(`${base}/items/${id}/versions/2`)).json().definition.levels).toHaveLength(3);
    expect((await rssi.get(`${base}/items/${id}/versions/9`)).statusCode).toBe(404);
    const impact = (await rssi.get(`${base}/items/${id}/impact?from=1&to=2`)).json();
    expect(impact.diff).toMatchObject({ removed: ['i4'], breaking: true });
  });
  it('le SQL refuse de modifier ou supprimer une version publiée et un usage enregistré', async () => {
    const row = await t.svc.db.one<{ item_id: string }>('SELECT item_id FROM cfg_versions LIMIT 1');
    await expect(
      t.svc.db.q("UPDATE cfg_versions SET reason='altérée' WHERE item_id=$1", [row!.item_id]),
    ).rejects.toThrow(/ajout seul/);
    await expect(t.svc.db.q('DELETE FROM cfg_versions WHERE item_id=$1', [row!.item_id])).rejects.toThrow(/ajout seul/);
    await expect(t.svc.db.q('TRUNCATE cfg_versions')).rejects.toThrow();
  });
});

describe('matrices, correspondances et références épinglées', () => {
  let gravite: string, vrais: string, niveaux: string;
  beforeAll(async () => {
    gravite = (await published(rssi, 'scale', 'g_mat', scale('Gravité matrice', ['g1', 'g2']))).id;
    vrais = (await published(rssi, 'scale', 'v_mat', scale('Vraisemblance matrice', ['v1', 'v2'], 'likelihood'))).id;
    niveaux = (await published(rssi, 'scale', 'n_mat', scale('Niveaux de risque', ['faible', 'eleve'], 'criticality')))
      .id;
  });
  const cells = (list: [string, string, string][]) => list.map(([row, column, result]) => ({ row, column, result }));
  const full = cells([
    ['g1', 'v1', 'faible'],
    ['g1', 'v2', 'faible'],
    ['g2', 'v1', 'faible'],
    ['g2', 'v2', 'eleve'],
  ]);
  it('refuse une matrice incomplète, puis publie la matrice exhaustive qui épingle ses trois échelles', async () => {
    const r = await create(rssi, 'matrix', 'matrice_risque', matrixOf(gravite, vrais, niveaux, full.slice(1)));
    expect(r.statusCode, r.body).toBe(201);
    const id = (r.json() as Item).id;
    const p = await preview(rssi, id);
    expect(p.valid).toBe(false);
    expect(p.errors.join(' ')).toMatch(/exactement une fois/);
    expect((await publishWith(rssi, id)).statusCode).toBe(422);
    await saveDraft(rssi, id, matrixOf(gravite, vrais, niveaux, full));
    const ok = await publishWith(rssi, id, 'Matrice de risque initiale');
    expect(ok.statusCode, ok.body).toBe(200);
    const usages = (await rssi.get(`${base}/items/${gravite}/usages`)).json() as {
      itemVersion: number;
      consumerKind: string;
      consumerId: string;
      label: string;
    }[];
    expect(usages).toHaveLength(1);
    expect(usages[0]).toMatchObject({ itemVersion: 1, consumerKind: 'cfg_version', consumerId: id });
    expect(usages[0]!.label).toContain('matrix');
    expect((await rssi.get(`${base}/items/${gravite}`)).json().usages).toBe(1);
  });
  it('refuse une référence inconnue, une version inexistante ou un élément qui n’est pas une échelle', async () => {
    const unknown = (
      await create(rssi, 'matrix', 'm_inconnue', matrixOf('00000000-0000-4000-8000-000000000999', vrais, niveaux, full))
    ).json().id;
    expect((await preview(rssi, unknown)).errors.join(' ')).toMatch(/introuvable/);
    const badVersion = {
      ...matrixOf(gravite, vrais, niveaux, full),
      rows: { scale: { item: gravite, version: 9 }, label: 'Gravité' },
    };
    const bv = (await create(rssi, 'matrix', 'm_version', badVersion)).json().id;
    expect((await preview(rssi, bv)).errors.join(' ')).toMatch(/introuvable/);
    const m = (await published(rssi, 'matrix', 'm_ref', matrixOf(gravite, vrais, niveaux, full))).id;
    const nonScale = (await create(rssi, 'matrix', 'm_non_echelle', matrixOf(m, vrais, niveaux, full))).json().id;
    expect((await preview(rssi, nonScale)).errors.join(' ')).toMatch(/pas une échelle/);
  });
  it('la matrice reste épinglée à la version 1 de l’échelle quand la version 2 existe', async () => {
    const m = (await published(rssi, 'matrix', 'm_epinglee', matrixOf(gravite, vrais, niveaux, full))).id;
    await saveDraft(rssi, gravite, scale('Gravité matrice', ['g1', 'g2', 'g3']));
    expect((await publishWith(rssi, gravite, 'Troisième niveau de gravité')).statusCode).toBe(200);
    const def = (await rssi.get(`${base}/items/${m}/versions/1`)).json().definition;
    expect(def.rows.scale).toEqual({ item: gravite, version: 1 });
    const usagesV1 = (await rssi.get(`${base}/items/${gravite}/usages`)).json() as { itemVersion: number }[];
    expect(usagesV1.every((u) => u.itemVersion === 1)).toBe(true);
    expect(usagesV1.length).toBeGreaterThanOrEqual(2); // les deux matrices restent épinglées à la version 1
    // Une troisième version simulée mesure les consommateurs de la version courante (2) : aucun, la 1 reste intacte.
    await saveDraft(rssi, gravite, scale('Gravité matrice', ['g1', 'g2', 'g3', 'g4']));
    expect((await preview(rssi, gravite)).impact.pinnedConsumers).toBe(0);
  });
  it('correspondance exhaustive, puis critères rattachés à une échelle chacun', async () => {
    const mapping = {
      name: 'Vraisemblance → niveaux',
      from: { item: vrais, version: 1 },
      to: { item: niveaux, version: 1 },
      aggregation: 'max',
      pairs: [
        { from: 'v1', to: 'faible' },
        { from: 'v2', to: 'eleve' },
      ],
    };
    const id = (await create(rssi, 'mapping', 'corr_vrais', { ...mapping, pairs: mapping.pairs.slice(1) })).json().id;
    expect((await preview(rssi, id)).errors.join(' ')).toMatch(/Chaque niveau/);
    await saveDraft(rssi, id, mapping);
    expect((await publishWith(rssi, id, 'Correspondance de contrôle')).statusCode).toBe(200);
    const c = await published(rssi, 'criteria', 'criteres_dic', {
      name: 'Critères de sécurité',
      criteria: [
        { id: 'confidentialite', label: 'Confidentialité', scale: { item: gravite, version: 1 } },
        { id: 'integrite', label: 'Intégrité', scale: { item: vrais, version: 1 } },
      ],
    });
    expect(c.item.currentVersion).toBe(1);
  });
  it('une taxonomie hiérarchique est publiée ; un cycle est refusé', async () => {
    const tax = (nodes: unknown) => ({ name: 'Catégories de biens', purpose: 'asset_category', nodes });
    expect(
      (
        await create(
          rssi,
          'taxonomy',
          'cycle',
          tax([
            { id: 'a', label: 'A', parent: 'b' },
            { id: 'b', label: 'B', parent: 'a' },
          ]),
        )
      ).statusCode,
    ).toBe(422);
    const ok = await published(
      rssi,
      'taxonomy',
      'biens',
      tax([
        { id: 'sys', label: 'Systèmes' },
        { id: 'mat', label: 'Matériels', parent: 'sys' },
      ]),
    );
    expect(ok.item.state).toBe('active');
  });
});

describe('variantes, archivage et suppression', () => {
  it('dérive une variante sans modifier l’origine et mémorise son origine', async () => {
    const orig = await published(rssi, 'scale', 'origine', scale('Origine'));
    const before = (await rssi.get(`${base}/items/${orig.id}`)).json();
    const r = await rssi.post(`${base}/items/${orig.id}/derive`, {
      key: 'variante_organisation',
      name: 'Variante de l’organisation',
      scope: 'instance',
    });
    expect(r.statusCode, r.body).toBe(201);
    const v = (await rssi.get(`${base}/items/${(r.json() as Item).id}`)).json();
    expect(v.derivedFrom).toEqual({ id: orig.id, version: 1 });
    expect(v.draft.name).toBe('Variante de l’organisation');
    expect(v.state).toBe('draft');
    expect((await rssi.get(`${base}/items/${orig.id}`)).json()).toEqual({ ...before, derivedCount: undefined });
    expect(
      (await rssi.post(`${base}/items/${orig.id}/derive`, { key: 'variante_organisation', scope: 'instance' }))
        .statusCode,
    ).toBe(409);
    const draftOnly = await create(rssi, 'scale', 'jamais_publiee', scale('Jamais publiée'));
    expect(
      (await rssi.post(`${base}/items/${(draftOnly.json() as Item).id}/derive`, { key: 'x', scope: 'instance' }))
        .statusCode,
    ).toBe(409);
  });
  it('archive sans casser les usages ; un élément archivé ne reçoit plus de nouvel usage mais garde les anciens', async () => {
    const g = (await published(rssi, 'scale', 'arch_g', scale('G', ['a', 'b']))).id;
    const v = (await published(rssi, 'scale', 'arch_v', scale('V', ['a', 'b'], 'likelihood'))).id;
    const r = (await published(rssi, 'scale', 'arch_r', scale('R', ['a', 'b'], 'criticality'))).id;
    const grid = [
      { row: 'a', column: 'a', result: 'a' },
      { row: 'a', column: 'b', result: 'a' },
      { row: 'b', column: 'a', result: 'a' },
      { row: 'b', column: 'b', result: 'b' },
    ];
    const m = (await create(rssi, 'matrix', 'arch_m', matrixOf(g, v, r, grid))).json().id;
    expect((await publishWith(rssi, m, 'Matrice avant archivage')).statusCode).toBe(200);
    expect((await rssi.post(`${base}/items/${g}/archive`)).json().state).toBe('archived');
    expect((await rssi.post(`${base}/items/${g}/archive`)).statusCode).toBe(409);
    // L'ancien usage reste valable : une nouvelle version de la matrice peut republier la même épingle.
    await saveDraft(rssi, m, { ...matrixOf(g, v, r, grid), name: 'Matrice après archivage' });
    expect((await publishWith(rssi, m, 'Renommage, épingle inchangée')).statusCode).toBe(200);
    // Un nouvel usage est refusé.
    const neuf = (await create(rssi, 'matrix', 'arch_neuf', matrixOf(g, v, r, grid))).json().id;
    expect((await preview(rssi, neuf)).errors.join(' ')).toMatch(/archivée/);
    expect((await saveDraft(rssi, g, scale('G', ['a', 'b']))).statusCode).toBe(409);
    expect((await rssi.post(`${base}/items/${g}/restore`)).json().state).toBe('active');
    expect((await rssi.get(`${base}/items?state=archived`)).json()).toEqual([]);
  });
  it('ne supprime qu’un brouillon jamais publié, sans usage ni variante', async () => {
    const d = (await create(rssi, 'scale', 'a_supprimer', scale('À supprimer'))).json().id;
    expect((await rssi.del(`${base}/items/${d}`)).statusCode).toBe(204);
    expect((await rssi.get(`${base}/items/${d}`)).statusCode).toBe(404);
    const p = await published(rssi, 'scale', 'publiee_non_supprimable', scale('Publiée'));
    expect((await rssi.del(`${base}/items/${p.id}`)).statusCode).toBe(409);
  });
  it('liste filtrée par type, famille de méthode, catégorie et texte', async () => {
    await published(rssi, 'scale', 'ebios_seule', {
      ...scale('Réservée EBIOS', ['a', 'b'], 'relevance'),
      appliesTo: ['ebios_rm'],
    });
    const ebios = (await rssi.get(`${base}/items?family=ebios_rm&kind=scale`)).json() as { key: string }[];
    const iso = (await rssi.get(`${base}/items?family=iso27005&kind=scale`)).json() as { key: string }[];
    expect(ebios.map((x) => x.key)).toContain('ebios_seule');
    expect(iso.map((x) => x.key)).not.toContain('ebios_seule');
    expect(iso.map((x) => x.key)).toContain('gravite'); // « all » : convient à toute méthode
    expect((await rssi.get(`${base}/items?category=relevance`)).json().map((x: { key: string }) => x.key)).toEqual([
      'ebios_seule',
    ]);
    expect((await rssi.get(`${base}/items?q=GRAVIT`)).json().length).toBeGreaterThan(0);
  });
});

describe('portée périmètre et isolation', () => {
  let smsi: string, restricted: string;
  beforeAll(async () => {
    smsi = (
      await rssi.post('/api/grc/smsis', { name: 'Périmètre de contrôle', scope: 'Test', timezone: 'Europe/Paris' })
    ).json().id;
    restricted = smsi;
  });
  it('un élément de périmètre n’est visible que des membres ; l’extérieur obtient 404 et ne le voit pas en liste', async () => {
    const r = await create(rssi, 'scale', 'locale', scale('Locale au périmètre'), {
      scope: 'smsi',
      smsiId: restricted,
    });
    expect(r.statusCode, r.body).toBe(201);
    const id = (r.json() as Item).id;
    expect((await rssi.get(`${base}/items?scope=smsi`)).json().map((x: { id: string }) => x.id)).toContain(id);
    expect((await outsider.get(`${base}/items?scope=smsi`)).json().map((x: { id: string }) => x.id)).not.toContain(id);
    expect((await outsider.get(`${base}/items/${id}`)).statusCode).toBe(404);
    expect(
      (await create(outsider, 'scale', 'intrus', scale('Intrus'), { scope: 'smsi', smsiId: restricted })).statusCode,
    ).toBe(404);
  });
  it('exige le périmètre pour une portée « smsi » et l’interdit pour l’organisation', async () => {
    expect((await create(rssi, 'scale', 'sans_smsi', scale('X'), { scope: 'smsi' })).statusCode).toBe(422);
    expect(
      (await create(rssi, 'scale', 'avec_smsi', scale('X'), { scope: 'instance', smsiId: restricted })).statusCode,
    ).toBe(422);
  });
  it('une variante de périmètre dérive d’un élément d’organisation ; une matrice d’organisation ne peut pas épingler une échelle de périmètre', async () => {
    const org = await published(rssi, 'scale', 'org_pour_variante', scale('Organisation'));
    const v = await rssi.post(`${base}/items/${org.id}/derive`, {
      key: 'org_pour_variante',
      name: 'Variante du périmètre',
      scope: 'smsi',
      smsiId: restricted,
    });
    expect(v.statusCode, v.body).toBe(201);
    const vid = (v.json() as Item).id;
    expect((await publishWith(rssi, vid, 'Variante propre au périmètre')).statusCode).toBe(200);
    const g = (await published(rssi, 'scale', 'org_g', scale('G', ['a', 'b']))).id;
    const r = (await published(rssi, 'scale', 'org_r', scale('R', ['a', 'b'], 'criticality'))).id;
    const grid = [
      { row: 'a', column: 'a', result: 'a' },
      { row: 'a', column: 'b', result: 'a' },
      { row: 'b', column: 'a', result: 'a' },
      { row: 'b', column: 'b', result: 'b' },
    ];
    const bad = (await create(rssi, 'matrix', 'org_m', matrixOf(g, vid, r, grid))).json().id;
    expect((await preview(rssi, bad)).errors.join(' ')).toMatch(/autre périmètre/);
    // Dans le périmètre lui-même, l'échelle de périmètre est utilisable avec une échelle d'organisation.
    const ok = (
      await create(rssi, 'matrix', 'smsi_m', matrixOf(g, vid, r, grid), { scope: 'smsi', smsiId: restricted })
    ).json().id;
    expect((await preview(rssi, ok)).errors.join(' ')).toMatch(/Cellule|exactement|niveau inconnu/); // échelles à 4 niveaux : grille incomplète
  });
});

describe('modèle adopté à la demande', () => {
  it('adopte le lot de pertinence : trois échelles et une matrice publiées en version 1 avec les neuf résultats attendus', async () => {
    const r = await rssi.post(`${base}/templates/ebios-pertinence-sr-ov/adopt`);
    expect(r.statusCode, r.body).toBe(201);
    const items = r.json() as {
      id: string;
      key: string;
      kind: string;
      currentVersion: number;
      origin: { template: string };
    }[];
    expect(items.map((x) => x.key)).toEqual([
      'motivation_sr',
      'ressources_sr',
      'pertinence_sr_ov',
      'matrice_pertinence_sr_ov',
    ]);
    expect(items.every((x) => x.currentVersion === 1 && x.origin.template === 'ebios-pertinence-sr-ov')).toBe(true);
    const matrix = items.find((x) => x.kind === 'matrix')!;
    const def = (await rssi.get(`${base}/items/${matrix.id}/versions/1`)).json().definition;
    const table = Object.fromEntries(
      def.cells.map((c: { row: string; column: string; result: string }) => [c.row + c.column, c.result]),
    );
    expect(table).toEqual({
      n1n1: 'low',
      n1n2: 'low',
      n1n3: 'medium',
      n2n1: 'low',
      n2n2: 'medium',
      n2n3: 'high',
      n3n1: 'medium',
      n3n2: 'high',
      n3n3: 'high',
    });
    expect(def.rows.label).toBe('Ressources');
    expect(def.columns.label).toBe('Motivation');
    const scales = items.filter((x) => x.kind === 'scale');
    for (const s of scales) expect((await rssi.get(`${base}/items/${s.id}/usages`)).json()).toHaveLength(1);
    // Compatible EBIOS RM seulement.
    expect((await rssi.get(`${base}/items?family=iso27005&category=relevance`)).json()).toEqual([]);
    expect((await rssi.get(`${base}/items?family=ebios_rm&category=relevance`)).json().length).toBeGreaterThan(0);
    // Adopter une seconde fois est refusé sans rien créer.
    const count = (await t.svc.db.one<{ n: number }>('SELECT count(*)::int n FROM cfg_items'))!.n;
    expect((await rssi.post(`${base}/templates/ebios-pertinence-sr-ov/adopt`)).statusCode).toBe(409);
    expect((await t.svc.db.one<{ n: number }>('SELECT count(*)::int n FROM cfg_items'))!.n).toBe(count);
    expect((await rssi.post(`${base}/templates/inconnu/adopt`)).statusCode).toBe(404);
    expect(cfgTemplates().length).toBe(1);
  });
});

describe('non-régression des données existantes', () => {
  it('le catalogue n’altère ni l’état historique, ni l’environnement, ni les méthodes déjà publiées', async () => {
    const legacy = await t.svc.db.one('SELECT data,version,sha256 FROM app_state WHERE id=1');
    const env = await t.svc.db.one('SELECT count(*)::int n FROM environment_versions');
    const methods = await t.svc.db.one('SELECT count(*)::int n FROM grc_method_versions');
    await published(rssi, 'scale', 'sans_effet_de_bord', scale('Sans effet de bord'));
    expect(await t.svc.db.one('SELECT data,version,sha256 FROM app_state WHERE id=1')).toEqual(legacy);
    expect(await t.svc.db.one('SELECT count(*)::int n FROM environment_versions')).toEqual(env);
    expect(await t.svc.db.one('SELECT count(*)::int n FROM grc_method_versions')).toEqual(methods);
  });
  it('conserve l’historique complet : une version par publication, motif et auteur', async () => {
    const id = (await t.svc.db.one<{ id: string }>("SELECT id FROM cfg_items WHERE key='impact_org'"))!.id;
    const detail = (await admin.get(`${base}/items/${id}`)).json();
    expect(detail.versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);
    expect(detail.versions[0]).toMatchObject({ createdBy: 'cfg_rssi' });
    expect(detail.versions[0].reason).toMatch(/Suppression/);
  });
});
