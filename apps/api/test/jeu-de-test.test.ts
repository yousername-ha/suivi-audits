/* Jeu de données de test : chargé par l'API publique sur une instance vide, cohérent (aucune référence cassée), refusé sur une
   instance qui contient déjà des données ; le contrôle des relations détecte une référence cassée. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { syntheseIncidents } from '@suivi/shared';
import { controleRelations } from '../src/controle-relations.js';
import { chargerJeuDeTest, etatJeuDeTest, ORGANISATION_TEST } from '../src/jeu-de-test.js';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';
import { DEFAULT_SMSI } from '../src/grc/core.js';

let t: TestApp, a: Agent;
beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'jdt_admin', 'admin'));
});
afterAll(() => t.close());

describe('jeu de données de test', () => {
  it('est entièrement fictif et ne reproduit aucun texte normatif', () => {
    const texte = JSON.stringify(etatJeuDeTest());
    expect(texte).toMatch(/fictif/i);
    expect(ORGANISATION_TEST).toMatch(/fictif.*démonstration/);
    expect(texte).not.toMatch(/ISO\/IEC 27001:2022|ReCyF|Annexe A/);
  });
  it('se charge sur une instance vide et produit des données cohérentes', { timeout: 180_000 }, async () => {
    const bilan = await chargerJeuDeTest(t.svc, t.app, 'jdt_admin', { publicUrl: 'https://suivi.test' });
    expect(bilan).toMatchObject({
      etat: 'oui',
      risques: 3,
      actions: 5,
      ecarts: 6,
      serie: 1,
      criteres: 3,
      evaluations: 2,
    });
    expect(bilan.liens).toBeGreaterThanOrEqual(6);
    // ISO 27001 / HDS : référentiels de la bibliothèque, couverture par exigence, déclaration d'applicabilité, étude EBIOS RM.
    expect(bilan.normes).toMatchObject({
      referentiels: ['iso-27001-2022', 'hds'],
      exigencesEvaluees: 157,
      ddaRenseignees: 126,
      risquesEbios: 4,
      traitements: 5,
    });
    expect(bilan.normes!.elementsEbios).toBeGreaterThan(30);
    const etude = (await a.get(`/api/grc/${DEFAULT_SMSI}/risk-studies/${bilan.normes!.etudeEbios}`)).json();
    expect(JSON.stringify(etude)).toMatch(/Rançongiciel/);
    // Les cinq ateliers sont validés et aucun élément n'a été modifié depuis.
    expect(etude.ateliers.map((x: { id: string }) => x.id)).toEqual(['a1', 'a2', 'a3', 'a4', 'a5']);
    for (const atelier of etude.ateliers) {
      expect(atelier.valide, atelier.id).toBe(true);
      expect(atelier.modifieDepuisValidation, atelier.id).toBe(false);
    }
    const dda = (await a.get('/api/suivi/etat')).json().dda as Record<string, { app?: string; level?: string }>;
    expect(dda['A-8.30']).toMatchObject({ app: 'non' });
    expect(Object.values(dda).filter((d) => d.level === 'Total').length).toBeGreaterThan(30);
    const relations = await controleRelations(t.svc);
    expect(relations.controles.flatMap((c) => c.anomalies)).toEqual([]);
    expect(relations.ok).toBe(true);
    expect(relations.controles.reduce((n, c) => n + c.verifies, 0)).toBeGreaterThan(50);
    // Modules annexes : incidents (dont un incident de sécurité ouvert avec obligation traitée).
    expect(bilan.annexes).toMatchObject({ incidents: 5 });
    const crise = (await a.get('/api/crise')).json().etat;
    expect(crise.scenarios).toHaveLength(2);
    expect(crise.cells).toHaveLength(1);
    expect(crise.cells[0]).toMatchObject({ status: 'Clôturée', mode: 'Exercice' });
    expect(crise.cells[0].log.length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(crise.cells[0].checks)).toHaveLength(3);
    expect(crise.contacts.length).toBeGreaterThanOrEqual(6);
    const incidents = (await a.get('/api/incidents')).json();
    expect(syntheseIncidents(incidents.incidents)).toMatchObject({ total: 5, securiteOuverts: 1, clos: 3 });
    // Ce que l'on retrouve par l'API, comme l'interface le fait.
    const etat = (await a.get('/api/suivi/etat')).json();
    expect(etat.processes).toHaveLength(6);
    // Les six écarts du jeu sont des écarts de registre, relus comme constats par le module Audit.
    expect(etat.findings).toHaveLength(6);
    expect(etat.findings.filter((f: { status: string }) => f.status === 'Clos')).toHaveLength(1);
    expect(etat.indicators.filter((i: { calc?: string }) => i.calc)).toHaveLength(3);
    const synthese = (await a.get('/api/mur/synthese')).json();
    expect(synthese.indicateurs.nonAtteints).toBeGreaterThan(0);
    expect(synthese.indicateurs.atteints).toBeGreaterThan(0);
    const fournisseurs = (await a.get('/api/suppliers')).json() as {
      id: string;
      current: unknown;
      toReview: boolean;
    }[];
    expect(fournisseurs).toHaveLength(5);
    expect(fournisseurs.filter((f) => f.current)).toHaveLength(2);
    expect(fournisseurs.find((f) => f.id === 'SUP-003')!.toReview).toBe(true);
    const boites = (await a.get(`/api/grc/${DEFAULT_SMSI}/pilotage/boites`)).json() as {
      ref: string;
      actionsOuvertes: number;
      risques: number;
    }[];
    expect(boites.find((b) => b.ref === 'legacy:processes:PR4')).toMatchObject({ actionsOuvertes: 2, risques: 1 });
    const pestel = (await a.get(`/api/grc/${DEFAULT_SMSI}/pilotage/pestel`)).json();
    expect(pestel.nonClasses.length + pestel.internes.length).toBeGreaterThan(0);
    const revue = (await a.get(`/api/grc/${DEFAULT_SMSI}/pilotage/revue/entrees`)).json();
    expect(revue.precedente).toMatchObject({ id: 'R1' });
    expect(revue.entrees.find((e: { id: string }) => e.id === 'a').faits.join(' ')).toMatch(/1 action décidée/);
    // Compléments : les rubriques que le reste du jeu laissait vides sont alimentées, et se relisent par l'API.
    expect(bilan.complements).toEqual({
      plans: 6,
      audit: { jours: 3, creneaux: 9, personnes: 5 },
      clausier: { evaluations: 2, points: 26 },
      perimetres: 2,
      fournisseursRattaches: 6,
      cartes: 2,
      retex: 6,
      continuite: { plans: 2, exercices: 1 },
      controles: 2,
      preuves: 1,
      series: 1,
      traitements: 1,
    });
    const plans = (await a.get('/api/plans')).json().plans as { type: string; status: string; result: string }[];
    expect(plans).toHaveLength(11);
    for (const type of ['formation', 'sensi', 'audit', 'exo'])
      expect(plans.filter((p) => p.type === type).length, type).toBeGreaterThanOrEqual(2);
    expect(plans.find((p) => p.type === 'exo' && p.status === 'Réalisé')).toMatchObject({
      result: 'Partiellement atteint',
    });
    const audit = (await a.get('/api/audit-suivi')).json();
    expect(audit.nextDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(audit.plan.days).toHaveLength(3);
    expect(audit.plan.days.every((d: { date: string }) => d.date)).toBe(true);
    expect(audit.plan.slots).toHaveLength(9);
    expect(audit.plan.people).toHaveLength(5);
    expect(audit.plan.slots.flatMap((s: { items: string[] }) => s.items)).toContain('A-8.5');
    const clausier = (await a.get('/api/evaluations-clausier')).json().evaluations as { supplier: string }[];
    expect(clausier.map((e) => e.supplier).sort()).toEqual(['SUP-001', 'SUP-003']);
    const sites = (await a.get('/api/grc/smsis')).json() as { id: string; parentId: string | null }[];
    const enfants = sites.filter((p) => p.parentId === DEFAULT_SMSI);
    expect(enfants).toHaveLength(2);
    const rattaches = (await a.get(`/api/grc/${DEFAULT_SMSI}/suppliers`)).json();
    expect(rattaches.summary.attached).toBe(4);
    expect(rattaches.summary.evaluated).toBeGreaterThan(0);
    let duSite = 0;
    for (const p of enfants) duSite += (await a.get(`/api/grc/${p.id}/suppliers`)).json().summary.attached;
    expect(duSite).toBe(2);
    const cartesPerimetres = (await a.get('/api/grc/perimetres/synthese')).json().cartes as {
      parentId: string | null;
      compteurs: { actions: { ouverts: number } } | null;
    }[];
    expect(
      cartesPerimetres.filter((c) => c.parentId === DEFAULT_SMSI).map((c) => c.compteurs?.actions.ouverts ?? 0),
    ).toContain(1);
    const cartes = (await a.get('/api/carto/maps')).json() as { view: string; layout: { nodes: object } }[];
    expect(cartes.map((c) => c.view).sort()).toEqual(['context', 'process']);
    for (const c of cartes) expect(Object.keys(c.layout.nodes).length, c.view).toBeGreaterThan(5);
    const indispo = (incidents.incidents as { title: string; timeline: unknown[] }[]).find((i) =>
      /Indisponibilité du logiciel/.test(i.title),
    )!;
    expect(indispo.timeline).toHaveLength(6);
    for (const [kind, n] of [
      ['continuity_plan', 2],
      ['continuity_exercise', 1],
      ['control', 2],
      ['evidence', 1],
      ['task_series', 2],
    ] as const)
      expect((await a.get(`/api/grc/${DEFAULT_SMSI}/objects?kind=${kind}`)).json().total, kind).toBe(n);
    const r03 = (await a.get(`/api/grc/${DEFAULT_SMSI}/objects?kind=risk`))
      .json()
      .items.find((r: { data: { code?: string } }) => r.data.code === 'R03');
    const liensR03 = JSON.stringify((await a.get(`/api/grc/${DEFAULT_SMSI}/links?ref=object:${r03.id}`)).json());
    expect(liensR03).toMatch(/treats/);
    expect(liensR03).toMatch(/Sauvegarder les dossiers hors site/);
  });
  it('refuse de se charger deux fois : les données de départ restent vides sauf demande explicite', async () => {
    await expect(chargerJeuDeTest(t.svc, t.app, 'jdt_admin', { publicUrl: 'https://suivi.test' })).rejects.toThrow(
      /contient déjà des données/,
    );
    await expect(chargerJeuDeTest(t.svc, t.app, 'inconnu', { publicUrl: 'https://suivi.test' })).rejects.toThrow(
      /Compte inconnu/,
    );
  });
  it('détecte une référence logique cassée', async () => {
    await t.svc.db.tx(async (c) => {
      await c.query('SELECT 1 FROM app_state WHERE id=1 FOR UPDATE');
      const st = (await t.svc.legacy.recompose(c))!;
      (st.data.objectives as Record<string, unknown>[])[0]!.processes = ['PR-INCONNU'];
      (st.data.indicators as Record<string, unknown>[])[0]!.obj = 'OBJ-INCONNU';
      await t.svc.legacy.nativeWrite(c, st.data, { username: 'test' } as never, st.version);
    }, 'test');
    const r = await controleRelations(t.svc);
    expect(r.ok).toBe(false);
    const anomalies = r.controles.flatMap((c) => c.anomalies).join(' | ');
    expect(anomalies).toMatch(/processus inconnu PR-INCONNU/);
    expect(anomalies).toMatch(/objectif inconnu OBJ-INCONNU/);
  });
});
