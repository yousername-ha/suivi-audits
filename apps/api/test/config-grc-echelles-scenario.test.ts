/* Ateliers 3 et 4 d'une étude EBIOS RM sur le catalogue (ADR 0038, dossier 003-05 et 003-11) : l'étude épingle une échelle de
   gravité des scénarios stratégiques et une échelle de vraisemblance des scénarios opérationnels. Le serveur contrôle les
   niveaux retenus, la migration mesure l'impact sans réécrire une évaluation, et une étude sans épinglage ne change pas. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

let t: TestApp, a: Agent, smsi: string, vraisemblance: string, gravite: string;
const cfg = '/api/config-grc';
const root = () => `/api/grc/${smsi}`;
const niveaux = (ids: string[]) => ids.map((id) => ({ id, label: 'Niveau ' + id, description: 'Niveau ' + id }));
const echelle = (name: string, ids: string[], category: string) => ({
  name,
  category,
  nature: 'qualitative',
  levels: niveaux(ids),
});
async function publier(id: string, reason: string) {
  const p = (await a.post(`${cfg}/items/${id}/preview`)).json();
  const r = await a.post(
    `${cfg}/items/${id}/publish`,
    { previewId: p.previewId, reason, confirm: 'PUBLIER' },
    { 'if-match': (await a.get(`${cfg}/items/${id}`)).headers.etag as string },
  );
  expect(r.statusCode, r.body).toBe(200);
}
async function creerEchelle(key: string, def: ReturnType<typeof echelle>) {
  const c = await a.post(`${cfg}/items`, { kind: 'scale', key, definition: def });
  expect(c.statusCode, c.body).toBe(201);
  await publier(c.json().id, 'Première version pour la recette');
  return c.json().id as string;
}
beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'cfgs_admin', 'admin'));
  smsi = (
    await a.post('/api/grc/smsis', { name: 'Périmètre scénarios', scope: 'Test', timezone: 'Europe/Paris' })
  ).json().id;
  vraisemblance = await creerEchelle(
    'vraisemblance_scenarios',
    echelle('Vraisemblance', ['v1', 'v2', 'v3'], 'likelihood'),
  );
  gravite = await creerEchelle(
    'gravite_scenarios',
    echelle('Gravité des scénarios', ['g1', 'g2', 'g3', 'g4'], 'severity'),
  );
});
afterAll(() => t.close());

const etude = (configuration: unknown, name = 'Étude des scénarios') =>
  a.post(root() + '/objects', { kind: 'risk_study', name, data: { objective: 'Recette', configuration } });
const scenario = (kind: string, studyRef: string, data: Record<string, unknown>, name = 'Scénario fictif') =>
  a.post(root() + '/objects', { kind, name, data: { studyRef, ...data } });

describe('échelles de scénarios épinglées par l’étude', () => {
  it('épingle les deux échelles, enregistre leur usage et refuse un élément d’un autre type', async () => {
    const ok = await etude({
      likelihoodScale: { item: vraisemblance, version: 1 },
      scenarioSeverityScale: { item: gravite, version: 1 },
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().data.configuration.likelihoodScale).toEqual({ item: vraisemblance, version: 1 });
    const usages = (await a.get(`${cfg}/items/${vraisemblance}/usages`)).json() as { consumerId: string }[];
    expect(usages.map((u) => u.consumerId)).toContain(ok.json().id);

    const inconnue = await etude({ likelihoodScale: { item: '00000000-0000-4000-8000-00000000beef', version: 1 } });
    expect(inconnue.statusCode).toBe(422);
    const matrice = await a.post(`${cfg}/templates/ebios-pertinence-sr-ov/adopt`, {});
    const m = (matrice.json() as { id: string; kind: string }[]).find((i) => i.kind === 'matrix')!;
    const mauvaisType = await etude({ likelihoodScale: { item: m.id, version: 1 } });
    expect(mauvaisType.statusCode).toBe(422);
    expect(mauvaisType.body).toMatch(/type attendu/);
  });

  it('contrôle le niveau retenu par scénario sur l’échelle épinglée, sans toucher aux études sans épinglage', async () => {
    const e = await etude({
      likelihoodScale: { item: vraisemblance, version: 1 },
      scenarioSeverityScale: { item: gravite, version: 1 },
    });
    const studyRef = 'object:' + e.json().id;
    const op = await scenario('operational_scenario', studyRef, { likelihoodLevel: 'v2' });
    expect(op.statusCode, op.body).toBe(200);
    expect(op.json().data.likelihoodLevel).toBe('v2');
    const hors = await scenario('operational_scenario', studyRef, { likelihoodLevel: 'v9' });
    expect(hors.statusCode).toBe(422);
    expect(hors.body).toContain('likelihoodLevel');
    const st = await scenario('strategic_scenario', studyRef, { severityLevel: 'g4' });
    expect(st.statusCode, st.body).toBe(200);
    const horsGravite = await scenario('strategic_scenario', studyRef, { severityLevel: 'v1' });
    expect(horsGravite.statusCode).toBe(422);
    expect(horsGravite.body).toContain('severityLevel');

    // Étude sans épinglage : l'échelle d'origine à quatre niveaux est inchangée, aucun contrôle de niveau n'est ajouté.
    const libre = await etude(null, 'Étude à l’échelle d’origine');
    const ancien = await scenario('operational_scenario', 'object:' + libre.json().id, { likelihood: 3 });
    expect(ancien.statusCode, ancien.body).toBe(200);
    expect(ancien.json().data.likelihood).toBe(3);
    expect(ancien.json().data.likelihoodLevel).toBeNull();
  });

  it('la vue de l’étude porte le libellé publié du niveau retenu', async () => {
    const e = await etude({ likelihoodScale: { item: vraisemblance, version: 1 } }, 'Étude vue atelier 4');
    const op = await scenario('operational_scenario', 'object:' + e.json().id, { likelihoodLevel: 'v3' }, 'Chemin');
    expect(op.statusCode, op.body).toBe(200);
    const vue = (await a.get(`${root()}/risk-studies/${e.json().id}`)).json() as {
      ateliers: { objets: { id: string; calcul: Record<string, unknown> }[] }[];
    };
    const objet = vue.ateliers.flatMap((x) => x.objets).find((o) => o.id === op.json().id);
    expect(objet?.calcul.vraisemblanceCatalogue).toBe('Niveau v3');
  });

  it('la migration mesure les niveaux retirés, exige confirmation et ne réécrit aucune évaluation', async () => {
    const e = await etude({ likelihoodScale: { item: vraisemblance, version: 1 } }, 'Étude à migrer (échelle)');
    const studyRef = 'object:' + e.json().id;
    const op = await scenario('operational_scenario', studyRef, { likelihoodLevel: 'v3' }, 'Chemin migré');
    expect(op.statusCode, op.body).toBe(200);
    const url = `${root()}/studies/${e.json().id}/configuration-migration`;
    expect((await a.get(url)).json().upToDate).toBe(true);

    // Version 2 : le niveau v3 disparaît, v2 est renommé.
    const item = (await a.get(`${cfg}/items/${vraisemblance}`)).json() as {
      definition: { levels: { id: string; label: string }[] };
    };
    const definition = structuredClone(item.definition);
    definition.levels = definition.levels
      .filter((l) => l.id !== 'v3')
      .map((l) => (l.id === 'v2' ? { ...l, label: 'Probable' } : l));
    expect(
      (
        await a.put(
          `${cfg}/items/${vraisemblance}/draft`,
          { definition },
          { 'if-match': (await a.get(`${cfg}/items/${vraisemblance}`)).headers.etag as string },
        )
      ).statusCode,
    ).toBe(200);
    await publier(vraisemblance, 'Niveau v3 retiré pour la recette');

    const apercu = (await a.get(url)).json();
    expect(apercu.upToDate).toBe(false);
    expect(apercu.pins[0]).toMatchObject({
      slot: 'likelihoodScale',
      from: 1,
      to: 2,
      changed: true,
      resultsChanged: 2,
      evaluations: 1,
    });
    expect(apercu.pins[0].orphans).toEqual({ likelihoodLevel: ['v3'] });

    const corps = { previewId: apercu.previewId, reason: 'Adoption de l’échelle révisée', confirm: 'MIGRER' };
    const ifMatch = { 'if-match': `"${apercu.version}"` };
    expect((await a.post(url, { ...corps, confirm: 'OUI' }, ifMatch)).statusCode).toBe(422);
    const ok = await a.post(url, corps, ifMatch);
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().data.configuration.likelihoodScale).toEqual({ item: vraisemblance, version: 2 });

    // Le scénario déjà évalué n'est pas réécrit : son niveau reste, signalé comme absent de la nouvelle échelle.
    const relu = (await a.get(`${root()}/objects/${op.json().id}`)).json();
    expect(relu.data.likelihoodLevel).toBe('v3');
    expect(relu.version).toBe(op.json().version);
  });
});
