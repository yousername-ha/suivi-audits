/* Jeu de données de test : chargé par l'API publique sur une instance vide, cohérent (aucune référence cassée), refusé sur une
   instance qui contient déjà des données ; le contrôle des relations détecte une référence cassée. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { comparerOptions, revuesSynthese, syntheseIncidents } from '@suivi/shared';
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
      opportunites: 3,
      criteres: 3,
      evaluations: 2,
    });
    expect(bilan.liens).toBeGreaterThanOrEqual(8);
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
    // Modules annexes : incidents (dont un incident de sécurité ouvert avec obligation traitée), budget, revues des accès.
    expect(bilan.annexes).toMatchObject({ incidents: 5, investissements: 6, revuesAcces: 5 });
    const incidents = (await a.get('/api/incidents')).json();
    expect(syntheseIncidents(incidents.incidents)).toMatchObject({ total: 5, securiteOuverts: 1, clos: 3 });
    const budget = (await a.get('/api/investissements')).json();
    expect(budget.lignes).toHaveLength(6);
    expect(comparerOptions(budget.lignes).map((g) => g.type)).toEqual(['Supervision de sécurité']);
    const revues = (await a.get('/api/revues-acces')).json();
    const jour = new Date().toISOString().slice(0, 7);
    expect(revuesSynthese(revues.revues, jour)).toMatchObject({
      total: 5,
      aJour: 1,
      aPlanifier: 1,
      enRetard: 2,
      jamais: 1,
    });
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
