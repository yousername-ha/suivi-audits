/* Démonstration, partie « Vulnérabilités » (demande du RSSI du 22/11/2026) : après le chargement du jeu de test, une instance
   Tenable fictive inactive et sans clé, deux synchronisations fictives rangées par le chemin d'écriture de l'exécutant
   (aucune exécution ne reste en file ni en cours, rien n'est planifié ni réclamé, même flux ouvert), machines avec ACR et
   AES, constats de chaque gravité, détections disparues et propositions « corrigée » après la seconde synchronisation,
   dépôts reliés aux périmètres du jeu, écrans du module qui répondent. Module désactivé : partie sautée. Données
   entièrement fictives ; aucun service n'est joint. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GRAVITES_TENABLE } from '@suivi/shared';
import { chargerJeuDeTest, type BilanChargement } from '../src/jeu-de-test.js';
import { modulesVulnerabilites, NOM_INSTANCE_DEMO, elementsSynchronisation } from '../src/demo-vulnerabilites.js';
import { DEFAULT_SMSI } from '../src/grc/core.js';
import { createTestApp, login, makeUser, type Agent, type TestApp } from './helpers.js';

const V = '/api/vulnerabilites';
let t: TestApp, a: Agent, bilan: BilanChargement;

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'demo_vuln_admin', 'admin'));
  bilan = await chargerJeuDeTest(t.svc, t.app, 'demo_vuln_admin', { publicUrl: 'https://suivi.test' });
}, 240_000);
afterAll(() => t.close());

describe('jeu de démonstration : module Vulnérabilités', () => {
  it('éléments valides, déterministes, dans la borne d’un lot, aucune donnée réelle', () => {
    const un = elementsSynchronisation(false, '2026-01-01T00:00:00.000Z');
    const deux = elementsSynchronisation(false, '2026-01-01T00:00:00.000Z');
    expect(un).toEqual(deux);
    const texte = JSON.stringify(un);
    // Noms en .invalid, adresses des plages de documentation, liens en .invalid.
    for (const nom of texte.match(/"nom":"[a-z0-9.-]+\.[a-z]+"/g) ?? []) expect(nom).toMatch(/\.exemple\.invalid"$/);
    for (const ip of texte.match(/"adresse":"[^"]+"/g) ?? []) expect(ip).toMatch(/"(192\.0\.2|198\.51\.100)\.\d+"/);
    for (const lien of texte.match(/https:\/\/[^"]+/g) ?? []) expect(lien).toMatch(/^https:\/\/[a-z.]+\.invalid\//);
  });

  it('bilan du chargement', () => {
    expect(bilan.vulnerabilites).toMatchObject({
      depots: 3,
      depotsRattaches: 3,
      machines: 42,
      constats: 34,
      synchronisations: 2,
    });
    expect(bilan.vulnerabilites!.detections).toBeGreaterThanOrEqual(140);
    expect(bilan.vulnerabilites!.detectionsDisparues).toBe(19);
  });

  it('instance inactive, sans clé ; aucune exécution en file ni en cours ; rien de planifié ni de réclamé', async () => {
    const i = await a.get(`/api/integrations/instances/${bilan.vulnerabilites!.instance}`);
    expect(i.statusCode, i.body).toBe(200);
    expect(i.json()).toMatchObject({ type: 'tenable', nom: NOM_INSTANCE_DEMO, actif: false });
    expect(Object.values(i.json().secrets as Record<string, boolean>).some(Boolean)).toBe(false);
    expect(await t.svc.flux.ouvert('tenable')).toBe(false);
    const executions = await t.svc.db.q<{ etat: string; n: number }>(
      'SELECT etat, count(*)::int AS n FROM integration_executions GROUP BY etat ORDER BY etat',
    );
    expect(executions.rows).toEqual([{ etat: 'recu', n: 2 }]);
    // Même flux ouvert : instance inactive et sans clé, jamais planifiée ni réclamée.
    await t.svc.flux.changer('tenable', true, { username: 'test' }, '127.0.0.1');
    try {
      expect(await t.svc.vulnerabilites.tenable.planifier()).toEqual([]);
      expect(await t.svc.integrations.reclamer(true)).toBeNull();
    } finally {
      await t.svc.flux.changer('tenable', false, { username: 'test' }, '127.0.0.1');
    }
    const etat = (await a.get(`${V}/synchronisation`)).json() as {
      actif: boolean;
      derniere: { etat: string } | null;
      derniereCompleteLe: string | null;
      prochaineSynchronisation: string | null;
    }[];
    expect(etat).toHaveLength(1);
    expect(etat[0]).toMatchObject({ actif: false, derniere: { etat: 'recu' }, prochaineSynchronisation: null });
    expect(etat[0]!.derniereCompleteLe).not.toBeNull();
  });

  it('machines avec ACR et AES ; filtres par catégorie ; machines sans valeur ; exposition interne et externe', async () => {
    const tout = await a.get(`${V}/machines`);
    expect(tout.statusCode, tout.body).toBe(200);
    expect(tout.json().total).toBe(42);
    const pages: { acr: number | null; aes: number | null; exposition: string | null }[] = [];
    for (let p = 1; p <= 2; p++) pages.push(...(await a.get(`${V}/machines?page=${p}`)).json().elements);
    expect(pages).toHaveLength(42);
    expect(pages.filter((m) => m.acr !== null && m.aes !== null).length).toBeGreaterThan(30);
    expect(pages.some((m) => m.acr === null)).toBe(true);
    expect(pages.some((m) => m.aes === null)).toBe(true);
    expect(new Set(pages.map((m) => m.exposition))).toEqual(new Set(['internal', 'external', null]));
    let precedent = Infinity;
    for (const acr of ['critique', 'elevee', 'moyenne']) {
      const r = await a.get(`${V}/machines?acr=${acr}`);
      expect(r.statusCode, r.body).toBe(200);
      expect(r.json().total, acr).toBeGreaterThan(0);
      expect(r.json().total, acr).toBeLessThan(42);
      if (precedent !== Infinity) expect(r.json().total).toBeGreaterThan(precedent);
      precedent = r.json().total;
    }
    const elevee = (await a.get(`${V}/machines?aes=elevee`)).json().total as number;
    const moyenne = (await a.get(`${V}/machines?aes=moyenne`)).json().total as number;
    expect(elevee).toBeGreaterThan(0);
    expect(moyenne).toBeGreaterThan(elevee);
    expect((await a.get(`${V}/machines/parc?acr=critique&aes=elevee`)).json().total).toBeGreaterThan(0);
    expect((await a.get(`${V}/machines?finSupport=oui`)).json().total).toBeGreaterThan(0);
  });

  it('constats de chaque gravité, avec VPR, CVSS, EPSS, kits et fins de support', async () => {
    for (const g of GRAVITES_TENABLE) {
      const r = await a.get(`${V}/constats?gravite=${g}&etat=tous`);
      expect(r.statusCode, r.body).toBe(200);
      expect(r.json().total, g).toBeGreaterThan(0);
    }
    const critiques = (await a.get(`${V}/constats?gravite=critique&etat=tous`)).json().elements as {
      vpr: number | null;
      cvss3Score: number | null;
      epss: number | null;
      kitsExploitation: string[];
      finDeSupport: boolean;
    }[];
    expect(critiques.some((c) => c.vpr !== null && c.cvss3Score !== null && c.epss !== null)).toBe(true);
    expect(critiques.some((c) => c.kitsExploitation.length > 0)).toBe(true);
    expect(critiques.some((c) => c.finDeSupport)).toBe(true);
    expect((await a.get(`${V}/constats?exploitable=oui&etat=tous`)).json().total).toBeGreaterThan(0);
    expect((await a.get(`${V}/constats?finSupport=oui&etat=tous`)).json().total).toBe(3);
    // Détections atténuées, à risque accepté ou requalifié selon Tenable.
    const statuts = await t.svc.db.q<{ attenue: number; accepte: number; requalifie: number }>(
      `SELECT count(*) FILTER (WHERE attenue)::int AS attenue, count(*) FILTER (WHERE risque_accepte)::int AS accepte,
              count(*) FILTER (WHERE risque_requalifie)::int AS requalifie FROM vulnerabilites_detections`,
    );
    expect(statuts.rows[0]).toEqual({ attenue: 3, accepte: 3, requalifie: 2 });
  });

  it('seconde synchronisation : détections disparues et propositions « corrigé selon Tenable, à confirmer »', async () => {
    const absentes = await t.svc.db.q<{ n: number }>(
      `SELECT count(*)::int AS n FROM vulnerabilites_detections d
         JOIN vulnerabilites_constats c ON c.id = d.constat_id
         JOIN vulnerabilites_tenable_etat e ON e.integration_id = c.integration_id
        WHERE d.vu_numero < e.numero_complet`,
    );
    expect(absentes.rows[0]!.n).toBe(19);
    const aClore = await a.get(`${V}/constats?etat=a_clore`);
    expect(aClore.statusCode, aClore.body).toBe(200);
    const corriges = aClore.json().elements as { plugin: string; present: boolean; suivi: { proposition: string } }[];
    expect(corriges.map((c) => c.plugin).sort()).toEqual(['990106', '990119', '990128']);
    for (const c of corriges) expect(c).toMatchObject({ present: false, suivi: { proposition: 'a_confirmer' } });
  });

  it('dépôts reliés aux périmètres du jeu : les vues par périmètre sont remplies', async () => {
    const depots = (await a.get(`${V}/depots`)).json() as { nom: string; perimetreId: string | null }[];
    expect(depots).toHaveLength(3);
    expect(depots.every((d) => d.perimetreId)).toBe(true);
    const perimetres = (await a.get('/api/grc/smsis')).json() as { id: string; parentId: string | null }[];
    for (const p of [DEFAULT_SMSI, ...perimetres.filter((x) => x.parentId === DEFAULT_SMSI).map((x) => x.id)]) {
      const r = await a.get(`${V}/machines?perimetre=${p}`);
      expect(r.statusCode, r.body).toBe(200);
      expect(r.json().total, p).toBeGreaterThan(0);
    }
    // Machines de l'inventaire seul : sans dépôt, donc sans périmètre.
    expect((await a.get(`${V}/machines?perimetre=aucun`)).json().total).toBe(4);
    const vue = await a.get(`${V}/machines/perimetres`);
    expect(vue.statusCode, vue.body).toBe(200);
  });

  it('écrans du module : vue d’ensemble, délais, tendances, parc', async () => {
    for (const url of [`${V}/vue-ensemble`, `${V}/delais`, `${V}/tendances`, `${V}/machines/parc`, `${V}/alertes`]) {
      const r = await a.get(url);
      expect(r.statusCode, `${url} ${r.body}`).toBe(200);
    }
    expect(JSON.stringify((await a.get(`${V}/vue-ensemble`)).json())).not.toMatch(/exemple\.invalid/);
  });

  it('nouveau chargement (après une remise à vide « travail ») : instance reprise, rien en double ; active ou avec une clé : refusé', async () => {
    const appel = (method: string, url: string, json?: unknown, headers?: Record<string, string>) =>
      a.req(method as 'GET', url, { json, headers });
    const exiger = async (res: Awaited<ReturnType<typeof appel>>, quoi: string) => {
      if (res.statusCode >= 400) throw new Error(`${quoi} : ${res.statusCode} ${res.body}`);
      return res.json();
    };
    const ctx = { appel: appel as never, exiger: exiger as never, commun: DEFAULT_SMSI };
    const compter = async () =>
      (
        await t.svc.db.q<{ machines: number; constats: number; detections: number; instances: number }>(
          `SELECT (SELECT count(*)::int FROM vulnerabilites_machines) AS machines,
                  (SELECT count(*)::int FROM vulnerabilites_constats) AS constats,
                  (SELECT count(*)::int FROM vulnerabilites_detections) AS detections,
                  (SELECT count(*)::int FROM integrations WHERE type = 'tenable') AS instances`,
        )
      ).rows[0];
    const avant = await compter();
    expect(avant).toEqual({ machines: 42, constats: 34, detections: 151, instances: 1 });
    const b = await modulesVulnerabilites(ctx, t.svc, 'demo_vuln_admin');
    expect(b).toMatchObject({ instance: bilan.vulnerabilites!.instance, depotsRattaches: 3, synchronisations: 2 });
    expect(await compter()).toEqual(avant);
    expect(
      (await t.svc.db.q("SELECT 1 FROM integration_executions WHERE etat <> 'recu'")).rowCount,
      'aucune exécution en file, en cours ou en échec',
    ).toBe(0);
    expect((await a.get(`${V}/constats?etat=a_clore`)).json().total).toBe(3);
    // Une clé enregistrée sur l'instance de démonstration : plus rien n'est rangé.
    await t.svc.integrations.definirSecrets(
      bilan.vulnerabilites!.instance!,
      { accessKey: 'A'.repeat(32) },
      { username: 'test' } as never,
      '127.0.0.1',
    );
    const executions = (await t.svc.db.q('SELECT 1 FROM integration_executions')).rowCount;
    await expect(modulesVulnerabilites(ctx, t.svc, 'demo_vuln_admin')).rejects.toThrow(/active ou porte une clé/);
    expect((await t.svc.db.q('SELECT 1 FROM integration_executions')).rowCount).toBe(executions);
  });

  it('module Vulnérabilités ou Intégrations désactivé : partie sautée, bilan à zéro, aucun appel', async () => {
    const appel = () => Promise.reject(new Error('aucun appel attendu'));
    const exiger = () => Promise.reject(new Error('aucun appel attendu'));
    for (const module of ['vulnerabilites', 'integrations']) {
      await t.svc.db.q('UPDATE module_activation SET disabled = $1, version = version + 1 WHERE id = 1', [[module]]);
      try {
        const b = await modulesVulnerabilites(
          { appel: appel as never, exiger: exiger as never, commun: DEFAULT_SMSI },
          t.svc,
          'demo_vuln_admin',
        );
        expect(b, module).toEqual({
          instance: null,
          depots: 0,
          depotsRattaches: 0,
          machines: 0,
          constats: 0,
          detections: 0,
          detectionsDisparues: 0,
          synchronisations: 0,
        });
      } finally {
        await t.svc.db.q("UPDATE module_activation SET disabled = '{}', version = version + 1 WHERE id = 1");
      }
    }
  });
});
