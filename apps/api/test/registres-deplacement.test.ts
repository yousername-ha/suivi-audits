/* Déplacement d'un élément entre registres (R03) et liste filtrée par registres (R02). Données fictives. */
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
const action = (name: string, registreId?: string) => ({ kind: 'action', name, data: donnees(), registreId });

describe('déplacement entre registres', () => {
  let t: TestApp;
  let admin: Agent, contributeur: Agent;
  let A: string, B: string, C: string;
  let r1: string, r2: string, r3: string, rEcarts: string;
  let element: string;
  const objet = async (id: string) =>
    (await t.svc.db.one<{ smsi_id: string; registre_id: string; version: number }>(
      'SELECT smsi_id,registre_id,version FROM grc_objects WHERE id=$1',
      [id],
    ))!;
  const creerRegistre = async (kind: string, name: string, referenceId: string, perimetres: string[] = []) =>
    (await admin.post('/api/registres', { kind, name, referenceId, perimetres })).json().id as string;
  const deplacer = (smsi: string, id: string, data: Record<string, unknown>, version?: number, agent = admin) =>
    agent.post(
      `/api/grc/${smsi}/objects/${id}/deplacement`,
      data,
      version === undefined ? {} : { 'if-match': `"${version}"` },
    );

  beforeAll(async () => {
    t = await createTestApp();
    admin = await login(t, await makeUser(t, 'dep_admin', 'admin'));
    const c = await makeUser(t, 'dep_contrib', 'ro');
    contributeur = await login(t, c);
    const p = async (n: string) =>
      (await admin.post('/api/grc/smsis', { name: n, scope: n, timezone: 'Europe/Paris' })).json().id as string;
    [A, B, C] = [await p('Périmètre A'), await p('Périmètre B'), await p('Périmètre C')];
    r1 = await creerRegistre('plan_actions', 'Plan A/B', A, [B]);
    r2 = await creerRegistre('plan_actions', 'Plan C', C);
    r3 = await creerRegistre('plan_actions', 'Plan A seul', A);
    rEcarts = await creerRegistre('ecarts', 'Écarts A', A);
    element = (await admin.post(`/api/grc/${A}/objects`, action('Action à déplacer', r1))).json().id;
    await admin.put(`/api/droits/registre/${r1}`, {
      subjectType: 'utilisateur',
      subjectId: c.id,
      role: 'contributeur',
    });
  });
  afterAll(async () => t.close());

  it('liste les éléments d’un périmètre filtrés par registres choisis, sans doublon', async () => {
    const autre = (await admin.post(`/api/grc/${A}/objects`, action('Action du plan A seul', r3))).json().id;
    const tous = (await admin.get(`/api/registres/elements?perimetre=${A}`)).json();
    const ids = tous.items.map((o: { id: string }) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining([element, autre]));
    // Le périmètre B n'est rattaché qu'au registre r1 : le filtre sur B ne remonte que ses éléments.
    const surB = (await admin.get(`/api/registres/elements?perimetre=${B}`)).json();
    expect(surB.items.map((o: { id: string }) => o.id)).toEqual([element]);
    expect(surB.registres.map((r: { id: string }) => r.id)).toEqual([r1]);
    // Plusieurs registres sélectionnés : union, sans doublon.
    const choisis = (await admin.get(`/api/registres/elements?perimetre=${A}&registres=${r1},${r3}`)).json();
    expect(choisis.items.map((o: { id: string }) => o.id).sort()).toEqual([autre, element].sort());
    // Un identifiant de registre mal formé est refusé.
    expect((await admin.get(`/api/registres/elements?perimetre=${A}&registres=pas-un-uuid`)).statusCode).toBe(422);
    // Un lecteur sans droit ne voit rien (registre non lisible : liste vide, aucune fuite).
    const lecteur = await login(t, await makeUser(t, 'dep_lecteur', null));
    expect((await lecteur.get(`/api/registres/elements?perimetre=${A}`)).json().items).toEqual([]);
  });

  it('prévisualise l’impact sans rien écrire', async () => {
    const constat = await admin.post(`/api/grc/${A}/objects`, {
      kind: 'nonconformity',
      name: 'Constat lié',
      data: { cause: 'Cause de recette' },
    });
    expect(constat.statusCode, constat.body).toBe(200);
    const lien = await admin.post(`/api/grc/${A}/links`, {
      source: 'object:' + element,
      target: 'object:' + constat.json().id,
      type: 'treats',
      note: '',
    });
    expect(lien.statusCode, lien.body).toBe(200);
    const avant = await objet(element);
    const r = await deplacer(A, element, { registreId: r2, apercu: true });
    expect(r.statusCode, r.body).toBe(200);
    const impact = r.json().impact;
    expect(impact).toMatchObject({ elements: 1, referenceChange: true, problemes: [] });
    expect(impact.depuis.perimetres.map((p: { name: string }) => p.name)).toEqual(['Périmètre A', 'Périmètre B']);
    expect(impact.vers.perimetres.map((p: { name: string }) => p.name)).toEqual(['Périmètre C']);
    expect(impact.liensIncompatibles.map((l: { nom: string }) => l.nom)).toEqual(['Constat lié']);
    expect(await objet(element)).toEqual(avant);
  });

  it('refuse sans motif, sans confirmation des liens, avec une version périmée ou un registre d’une autre famille', async () => {
    const v = (await objet(element)).version;
    expect((await deplacer(A, element, { registreId: r2 }, v)).statusCode).toBe(422); // motif manquant
    expect((await deplacer(A, element, { registreId: r2, reason: 'Réorganisation du plan.' }, v)).statusCode).toBe(409);
    expect(
      (
        await deplacer(
          A,
          element,
          { registreId: r2, reason: 'Réorganisation du plan.', retirerLiensIncompatibles: true },
          v - 1,
        )
      ).statusCode,
    ).toBe(412);
    expect((await deplacer(A, element, { registreId: rEcarts, apercu: true })).statusCode).toBe(422);
    expect((await deplacer(A, element, { registreId: r1, apercu: true })).statusCode).toBe(422); // déjà dedans
    // Un contributeur lit et contribue mais ne déplace pas.
    expect((await deplacer(A, element, { registreId: r2, apercu: true }, undefined, contributeur)).statusCode).toBe(
      403,
    );
  });

  it('déplace l’élément : même identifiant, contexte du registre cible, liens incompatibles retirés, historique conservé', async () => {
    const avant = await objet(element);
    const r = await deplacer(
      A,
      element,
      { registreId: r2, reason: 'Réorganisation du plan.', retirerLiensIncompatibles: true },
      avant.version,
    );
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().element.id).toBe(element);
    const apres = await objet(element);
    expect(apres).toMatchObject({ smsi_id: C, registre_id: r2, version: avant.version + 1 });
    expect(
      (await t.svc.db.one<{ n: number }>('SELECT count(*)::int n FROM grc_links WHERE source_ref=$1', [
        'object:' + element,
      ]))!.n,
    ).toBe(0);
    // Les versions d'origine restent rattachées à leur ancien périmètre ; la nouvelle porte le nouveau.
    const versions = (
      await t.svc.db.q<{ smsi_id: string; version: number }>(
        'SELECT smsi_id,version FROM grc_object_versions WHERE object_id=$1 ORDER BY version',
        [element],
      )
    ).rows;
    expect(versions[0]!.smsi_id).toBe(A);
    expect(versions[versions.length - 1]).toEqual({ smsi_id: C, version: apres.version });
    // Il se lit désormais depuis son nouveau périmètre et plus depuis l'ancien.
    expect((await admin.get(`/api/grc/${C}/objects/${element}`)).statusCode).toBe(200);
    expect((await admin.get(`/api/grc/${A}/objects/${element}`)).statusCode).toBe(404);
    // Le journal d'audit garde le déplacement et son motif.
    const audit = await t.svc.db.one<{ details: { raison: string; liensRetires: number } }>(
      "SELECT details FROM audit_log WHERE action='registre.element.deplace' AND target=$1",
      [element],
    );
    expect(audit!.details).toMatchObject({ raison: 'Réorganisation du plan.', liensRetires: 1 });
  });

  it('une série se déplace avec ses occurrences ; une occurrence seule ne se déplace pas', async () => {
    const rs1 = await creerRegistre('recurrences', 'Récurrences A', A);
    const rs2 = await creerRegistre('recurrences', 'Récurrences C', C);
    const serie = await admin.post(`/api/grc/${A}/objects`, {
      kind: 'task_series',
      name: 'Série à déplacer',
      registreId: rs1,
      data: {
        description: '',
        ownerId: null,
        category: 'action',
        priority: 'normal',
        refs: [],
        recurrence: {
          start: '2026-10-01',
          time: '09:00',
          timezone: 'Europe/Paris',
          unit: 'month',
          interval: 1,
          until: null,
          count: 2,
          reminderDays: 7,
          active: true,
        },
      },
    });
    expect(serie.statusCode, serie.body).toBe(200);
    await t.svc.grc.tasks.tick(new Date('2026-12-15T00:00:00Z'));
    const occ = (
      await t.svc.db.q<{ id: string }>("SELECT id FROM grc_objects WHERE data->>'seriesId'=$1", [serie.json().id])
    ).rows.map((r) => r.id);
    expect(occ.length).toBeGreaterThanOrEqual(2);
    expect((await deplacer(A, occ[0]!, { registreId: rs2, apercu: true })).statusCode).toBe(422);
    const apercu = await deplacer(A, serie.json().id, { registreId: rs2, apercu: true });
    expect(apercu.json().impact.elements).toBe(1 + occ.length);
    const v = (await objet(serie.json().id)).version;
    const r = await deplacer(A, serie.json().id, { registreId: rs2, reason: 'Série rattachée au périmètre C.' }, v);
    expect(r.statusCode, r.body).toBe(200);
    for (const id of [serie.json().id, ...occ]) expect(await objet(id)).toMatchObject({ smsi_id: C, registre_id: rs2 });
  });
});
