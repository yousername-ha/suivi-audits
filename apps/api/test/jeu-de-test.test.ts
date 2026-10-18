/* Jeu de données de test : chargé par l'API publique sur une instance vide, cohérent (aucune référence cassée), refusé sur une
   instance qui contient déjà des données ; le contrôle des relations détecte une référence cassée. Données fictives. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { controleRelations } from '../src/controle-relations.js';
import { chargerJeuDeTest, etatJeuDeTest, ORGANISATION_TEST, referentielDemonstration } from '../src/jeu-de-test.js';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';
import { DEFAULT_SMSI } from '../src/grc/core.js';

let t: TestApp, a: Agent;
beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'jdt_admin', 'admin'));
});
afterAll(() => t.close());

describe('jeu de données de test', () => {
  it('est entièrement fictif et ne reproduit aucun référentiel officiel', () => {
    const texte = JSON.stringify({ etat: etatJeuDeTest(), ref: referentielDemonstration() });
    expect(texte).toMatch(/fictif/i);
    expect(referentielDemonstration().source.normative).toBe(false);
    expect(ORGANISATION_TEST).toMatch(/jeu de test/);
    expect(texte).not.toMatch(/ISO\/IEC 27001:2022|ReCyF|Annexe A/);
  });
  it('se charge sur une instance vide et produit des données cohérentes', async () => {
    const bilan = await chargerJeuDeTest(t.svc, t.app, 'jdt_admin', { publicUrl: 'https://suivi.test' });
    expect(bilan).toMatchObject({
      etat: 'oui',
      risques: 3,
      actions: 5,
      serie: 1,
      opportunites: 3,
      criteres: 3,
      evaluations: 2,
    });
    expect(bilan.liens).toBeGreaterThanOrEqual(8);
    const relations = await controleRelations(t.svc);
    expect(relations.controles.flatMap((c) => c.anomalies)).toEqual([]);
    expect(relations.ok).toBe(true);
    expect(relations.controles.reduce((n, c) => n + c.verifies, 0)).toBeGreaterThan(50);
    // Ce que l'on retrouve par l'API, comme l'interface le fait.
    const etat = (await a.get('/api/legacy/state')).json();
    expect(etat.processes).toHaveLength(6);
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
