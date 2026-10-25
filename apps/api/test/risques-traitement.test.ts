/* Traitement d'un risque (dossier 002) : une mesure peut être une exigence d'un cadre publié (ex. Annexe A) sans que le lien
   vaille conformité ; l'action de traitement s'ajoute au plan d'actions choisi, sous contrôle du droit de gestion ; l'archivage
   de l'étude ne réécrit aucune évaluation. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { methodTemplate, type FrameworkDefinition, type RiskData, type RiskMethod } from '@suivi/shared';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

let t: TestApp, a: Agent, contributeur: Agent, smsi: string, cadre: string;
const root = () => `/api/grc/${smsi}`;
const definition: FrameworkDefinition = {
  name: 'Annexe A fictive',
  identifier: 'ANNEXE-A-FICTIVE',
  source: {
    organisation: 'Organisation fictive',
    document: 'Cadre de recette',
    url: 'https://example.invalid/annexe-a',
    version: '2022',
    date: '2026-10-21',
    license: 'Données fictives de test',
    verifiedAt: '',
    normative: false,
    status: 'organisation',
  },
  domains: [{ id: 'organisationnel', label: 'Mesures organisationnelles' }],
  requirements: [
    {
      id: 'A.5.1',
      domain: 'organisationnel',
      title: 'Politiques de sécurité (fictif)',
      description: 'Exigence fictive',
      applicability: 'Périmètre de test',
      measureRefs: [],
    },
  ],
};
const risque = (methodId: string, studyRef?: string): { kind: 'risk'; name: string; data: RiskData } => ({
  kind: 'risk',
  name: 'Risque de recette',
  data: {
    description: 'Analyse de recette',
    code: 'RR',
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
    ...(studyRef ? { studyRef } : {}),
  } as RiskData,
});
async function publierMethode(definitionMethode: RiskMethod) {
  const p = await a.post(root() + '/methods/preview', { id: null, definition: definitionMethode });
  const r = await a.post(
    root() + '/methods/publish',
    {
      id: null,
      definition: definitionMethode,
      previewId: p.json().previewId,
      reason: 'Politique validée pour la recette',
      confirm: 'PUBLIER',
    },
    { 'if-match': '"0"' },
  );
  expect(r.statusCode, r.body).toBe(200);
  return r.json().methodId as string;
}

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'trait_admin', 'admin'));
  const c = await makeUser(t, 'trait_contrib', 'rw');
  smsi = (await a.post('/api/grc/smsis', { name: 'Traitements', scope: 'Recette', timezone: 'Europe/Paris' })).json()
    .id;
  expect((await a.put(`${root()}/members`, { userId: c.id, write: true })).statusCode).toBeLessThan(300);
  contributeur = await login(t, c);
  const p = await a.post(root() + '/frameworks/preview', { id: null, definition });
  const r = await a.post(
    root() + '/frameworks/publish',
    {
      id: null,
      definition,
      previewId: p.json().previewId,
      reason: 'Cadre fictif revu pour la recette',
      confirm: 'PUBLIER',
    },
    { 'if-match': '"0"' },
  );
  expect(r.statusCode, r.body).toBe(200);
  cadre = r.json().id;
});
afterAll(() => t.close());

describe('mesure d’un traitement : exigence d’un cadre publié', () => {
  it('accepte une exigence publiée, refuse une exigence inconnue, et ne modifie pas la couverture', async () => {
    const couverture = async () =>
      (await a.get(root() + '/dashboard')).json().sections.frameworks.find((f: { id: string }) => f.id === cadre);
    const avant = await couverture();
    const ok = await a.post(root() + '/objects', {
      kind: 'treatment',
      name: 'Rédiger la politique',
      data: { description: '', measureRefs: [`requirement:${cadre}:1:A.5.1`] },
    });
    expect(ok.statusCode, ok.body).toBe(200);
    const inconnue = await a.post(root() + '/objects', {
      kind: 'treatment',
      name: 'Mesure inconnue',
      data: { description: '', measureRefs: [`requirement:${cadre}:1:A.9.9`] },
    });
    expect(inconnue.statusCode).toBeGreaterThanOrEqual(400);
    expect(await couverture()).toEqual(avant);
    // Le lien est lisible depuis l'exigence (relation dérivée du champ de la fiche).
    const liens = await a.get(root() + '/links?ref=' + encodeURIComponent(`requirement:${cadre}:1:A.5.1`));
    expect(liens.statusCode, liens.body).toBe(200);
    expect(liens.json().some((l: { other: { ref: string } }) => l.other.ref === 'object:' + ok.json().id)).toBe(true);
    // Depuis le traitement, l'exigence est lue avec son applicabilité dans CE périmètre (ici : aucune évaluation), sans effet
    // sur la couverture.
    const sortants = await a.get(root() + '/links?ref=' + encodeURIComponent('object:' + ok.json().id));
    const exigence = (
      sortants.json() as { other: { ref: string; kind: string; applicabilite?: string | null } }[]
    ).find((l) => l.other.ref === `requirement:${cadre}:1:A.5.1`);
    expect(exigence?.other).toMatchObject({ kind: 'requirement', applicabilite: 'non_evaluee' });
    expect(await couverture()).toEqual(avant);
  });
  it('propose les exigences publiées dans le sélecteur du champ typé', async () => {
    const r = await a.get(
      root() + '/sources?search=Politiques&cibles=' + encodeURIComponent('object:measure,requirement'),
    );
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json().items.map((i: { ref: string }) => i.ref)).toContain(`requirement:${cadre}:1:A.5.1`);
  });
});

describe('partie prenante de l’écosystème (atelier 3)', () => {
  it('référence ses mesures (exigence publiée) sans copie, et refuse une cible d’un autre type', async () => {
    const etude = (
      await a.post(root() + '/objects', {
        kind: 'risk_study',
        name: 'Étude de l’écosystème',
        data: { objective: 'Recette', scope: 'Service fictif' },
      })
    ).json();
    const partie = (data: Record<string, unknown>) =>
      a.post(root() + '/objects', {
        kind: 'ecosystem_party',
        name: 'Prestataire fictif',
        data: { studyRef: 'object:' + etude.id, category: 'prestataire', ...data },
      });
    const ok = await partie({
      measureRefs: [`requirement:${cadre}:1:A.5.1`],
      dangerJustification: 'Accès distant permanent, maturité faible',
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().data.measureRefs).toEqual([`requirement:${cadre}:1:A.5.1`]);
    const refus = await partie({ measureRefs: ['object:' + etude.id] });
    expect(refus.statusCode).toBe(422);
  });
});

describe('action de traitement : plan d’accueil', () => {
  it('place l’action dans le plan choisi si l’on en a la gestion, refuse sinon', async () => {
    const traitement = (
      await a.post(root() + '/objects', { kind: 'treatment', name: 'Durcir', data: { description: '' } })
    ).json();
    const plan = (
      await a.post('/api/registres', { kind: 'plan_actions', name: 'Plan des traitements', referenceId: smsi })
    ).json().id;
    const action = await a.post(root() + `/treatments/${traitement.id}/action`, {
      name: 'Mettre en œuvre le durcissement',
      dueAt: null,
      ownerId: null,
      registreId: plan,
    });
    expect(action.statusCode, action.body).toBe(200);
    expect(action.json().registreId).toBe(plan);
    // Sans choix : registre par défaut du périmètre, différent du plan choisi.
    const defaut = await a.post(root() + `/treatments/${traitement.id}/action`, {
      name: 'Action au plan par défaut',
      dueAt: null,
      ownerId: null,
    });
    expect(defaut.statusCode, defaut.body).toBe(200);
    expect(defaut.json().registreId).not.toBe(plan);
    // Un plan restreint sans rôle pour la personne : elle ne peut pas y déposer l'action.
    const restreint = (
      await a.post('/api/registres', {
        kind: 'plan_actions',
        name: 'Plan restreint',
        referenceId: smsi,
        perimetres: [],
        restreint: true,
      })
    ).json().id;
    const refus = await contributeur.post(root() + `/treatments/${traitement.id}/action`, {
      name: 'Action refusée',
      dueAt: null,
      ownerId: null,
      registreId: restreint,
    });
    expect([403, 404]).toContain(refus.statusCode);
    // Un registre d'une autre famille est refusé.
    const ecarts = (
      await a.post('/api/registres', { kind: 'ecarts', name: 'Écarts de test', referenceId: smsi })
    ).json().id;
    const autre = await a.post(root() + `/treatments/${traitement.id}/action`, {
      name: 'Mauvais registre',
      dueAt: null,
      ownerId: null,
      registreId: ecarts,
    });
    expect(autre.statusCode).toBe(422);
  });
});

describe('étude archivée', () => {
  it('l’archivage de l’étude ne réécrit aucune évaluation du risque', async () => {
    const methodeId = await publierMethode(methodTemplate('custom'));
    const etude = (
      await a.post(root() + '/objects', {
        kind: 'risk_study',
        name: 'Étude à archiver',
        data: { objective: 'Recette', scope: 'Service fictif' },
      })
    ).json();
    const r = await a.post(root() + '/objects', risque(methodeId, 'object:' + etude.id));
    expect(r.statusCode, r.body).toBe(200);
    const avant = (await a.get(root() + `/risks/${r.json().id}/evaluations`)).json();
    const archive = await a.del(root() + `/objects/${etude.id}`, { 'if-match': `"${etude.version}"` });
    expect(archive.statusCode, archive.body).toBeLessThan(300);
    expect((await a.get(root() + `/risks/${r.json().id}/evaluations`)).json()).toEqual(avant);
    expect((await a.get(root() + `/objects/${r.json().id}`)).statusCode).toBe(200);
  });
});
