/* Gestion des risques (lot U3, ADR 0027) : étude EBIOS RM par ateliers d'objets typés, références vérifiées par le
   serveur, validation d'atelier et acceptation formelle immuables, registre filtré, cloisonnement des périmètres. */
import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { methodTemplate } from '@suivi/shared';
import { DEFAULT_SMSI } from '../src/grc/core.js';
import { type Agent, createTestApp, login, makeUser, type TestApp } from './helpers.js';

let t: TestApp, a: Agent, rw: Agent, ro: Agent, smsi: string;
const ids: Record<string, string> = {};
const root = () => `/api/grc/${smsi}`;
const ref = (k: string) => 'object:' + ids[k];

async function creer(agent: Agent, kind: string, name: string, data: Record<string, unknown>, cle?: string) {
  const r = await agent.post(root() + '/objects', { kind, name, data });
  if (cle && r.statusCode === 200) ids[cle] = r.json().id;
  return r;
}
async function decider(
  agent: Agent,
  cible: string,
  version: number,
  decision: Record<string, unknown>,
  perimetre = smsi,
) {
  return agent.post(
    `/api/grc/${perimetre}/pilotage/decisions`,
    {
      ref: cible,
      decision: {
        requestId: crypto.randomUUID(),
        note: 'Décision justifiée et documentée pour la recette',
        date: '2026-10-11',
        refs: [],
        step: '',
        createFinding: false,
        createAction: false,
        confirm: 'ENREGISTRER',
        ...decision,
      },
    },
    { 'if-match': `"${version}"` },
  );
}

beforeAll(async () => {
  t = await createTestApp();
  a = await login(t, await makeUser(t, 'risques_admin', 'admin'));
  const contributeur = await makeUser(t, 'risques_rw', 'rw');
  ro = await login(t, await makeUser(t, 'risques_ro', 'ro'));
  const r = await a.post('/api/grc/smsis', {
    name: 'Périmètre risques',
    scope: 'Recette U3',
    timezone: 'Europe/Paris',
  });
  expect(r.statusCode, r.body).toBe(200);
  smsi = r.json().id;
  // Contributeur membre en écriture : les refus testés viennent du droit, pas de l'accès au périmètre.
  const m = await a.put(`/api/grc/${smsi}/members`, { userId: contributeur.id, write: true });
  expect(m.statusCode, m.body).toBeLessThan(300);
  // Un changement d'accès ferme les sessions du compte : connexion après l'ajout.
  rw = await login(t, contributeur);
});
afterAll(() => t.close());

describe('étude EBIOS RM : ateliers d’objets typés', () => {
  it('crée l’étude et les éléments des ateliers 1 à 4, reliés par des références typées', async () => {
    expect(
      (
        await creer(
          a,
          'risk_study',
          'Étude fictive',
          { objective: 'Plateforme de recette', scope: 'Service fictif' },
          'etude',
        )
      ).statusCode,
    ).toBe(200);
    const s = { studyRef: ref('etude') };
    expect((await creer(a, 'business_asset', 'Soins (fictif)', { ...s, nature: 'process' }, 'vm')).statusCode).toBe(
      200,
    );
    expect(
      (await creer(a, 'support_asset', 'Serveur fictif', { ...s, businessAssetRefs: [ref('vm')] }, 'bs')).statusCode,
    ).toBe(200);
    const er = await creer(
      a,
      'feared_event',
      'Indisponibilité',
      { ...s, businessAssetRef: ref('vm'), impacts: ['D'], gravity: 3 },
      'er',
    );
    expect(er.statusCode, er.body).toBe(200);
    expect((await creer(a, 'risk_source', 'Groupe fictif', { ...s, category: 'crime' }, 'sr')).statusCode).toBe(200);
    expect(
      (
        await creer(
          a,
          'sr_ov',
          'Rançon',
          { ...s, sourceRef: ref('sr'), objective: 'Lucratif', retained: true, motivation: 4 },
          'srov',
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await creer(
          a,
          'ecosystem_party',
          'Prestataire fictif',
          { ...s, dependency: 4, penetration: 3, maturity: 2, trust: 2 },
          'pp',
        )
      ).statusCode,
    ).toBe(200);
    const ss = await creer(
      a,
      'strategic_scenario',
      'Attaque par le prestataire',
      { ...s, srOvRef: ref('srov'), fearedEventRefs: [ref('er')], partyRefs: [ref('pp')] },
      'ss',
    );
    expect(ss.statusCode, ss.body).toBe(200);
    expect(
      (
        await creer(
          a,
          'operational_scenario',
          'Hameçonnage puis chiffrement',
          { ...s, strategicScenarioRef: ref('ss'), supportAssetRefs: [ref('bs')], likelihood: 2 },
          'so',
        )
      ).statusCode,
    ).toBe(200);
  });

  it('refuse une référence du mauvais type, d’un autre périmètre ou historique hors du périmètre commun', async () => {
    // Un événement redouté vise une valeur métier, pas une source de risque.
    const mauvaisType = await creer(a, 'feared_event', 'Mauvais lien', { businessAssetRef: ref('sr') });
    expect(mauvaisType.statusCode).toBe(422);
    expect(mauvaisType.json().error).toContain('Cible non autorisée');
    const commun = await a.post(`/api/grc/${DEFAULT_SMSI}/objects`, {
      kind: 'feared_event',
      name: 'Événement du périmètre commun',
      data: {},
    });
    expect(commun.statusCode, commun.body).toBe(200);
    expect(
      (await creer(a, 'strategic_scenario', 'Fuite', { fearedEventRefs: ['object:' + commun.json().id] })).statusCode,
    ).toBe(404);
    expect((await creer(a, 'business_asset', 'Processus', { processRefs: ['legacy:processes:P1'] })).statusCode).toBe(
      422,
    );
  });

  it('vue de l’étude : objets par atelier, indice de menace et gravité proposée', async () => {
    const r = await a.get(root() + '/risk-studies/' + ids.etude);
    expect(r.statusCode, r.body).toBe(200);
    const v = r.json();
    expect(v.ateliers.map((x: { objets: unknown[] }) => x.objets.length)).toEqual([3, 2, 2, 1, 0]);
    const tous = v.ateliers.flatMap((x: { objets: unknown[] }) => x.objets);
    expect(tous.find((o: { id: string }) => o.id === ids.pp).calcul.menace).toBe(3);
    expect(tous.find((o: { id: string }) => o.id === ids.ss).calcul.graviteProposee).toBe(3);
    // Un autre type d'objet n'est pas une étude.
    expect((await a.get(root() + '/risk-studies/' + ids.vm)).statusCode).toBe(422);
  });

  it('validation d’atelier : droit d’administration, ordre des ateliers, élément de l’atelier requis, immuable', async () => {
    const etude = (await a.get(root() + '/objects/' + ids.etude)).json();
    expect(
      (
        await decider(rw, ref('etude'), etude.version, {
          operation: 'step_validation',
          step: 'a1',
          result: 'completed',
          refs: [ref('vm')],
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await decider(a, ref('etude'), etude.version, {
          operation: 'step_validation',
          step: 'a2',
          result: 'completed',
          refs: [ref('sr')],
        })
      ).statusCode,
    ).toBe(409);
    expect(
      (
        await decider(a, ref('etude'), etude.version, {
          operation: 'step_validation',
          step: 'a1',
          result: 'completed',
          refs: [ref('sr')],
        })
      ).statusCode,
    ).toBe(422);
    const ok = await decider(a, ref('etude'), etude.version, {
      operation: 'step_validation',
      step: 'a1',
      result: 'completed',
      refs: [ref('vm'), ref('er')],
    });
    expect(ok.statusCode, ok.body).toBe(200);
    expect(
      (
        await decider(a, ref('etude'), etude.version, {
          operation: 'step_validation',
          step: 'a2',
          result: 'completed',
          refs: [ref('srov')],
        })
      ).statusCode,
    ).toBe(200);
    const v = (await a.get(root() + '/risk-studies/' + ids.etude)).json();
    expect(v.ateliers.map((x: { valide: boolean }) => x.valide)).toEqual([true, true, false, false, false]);
    await expect(t.svc.db.q("UPDATE pilotage_decisions SET note='Altération'")).rejects.toThrow();
  });
  it('une modification postérieure à la validation la rend caduque : jamais de faux « validé »', async () => {
    const avant = (await a.get(root() + '/risk-studies/' + ids.etude)).json();
    expect(avant.ateliers[0].valide).toBe(true);
    expect(avant.ateliers[0].modifieDepuisValidation).toBe(false);
    const vm = (await a.get(root() + '/objects/' + ids.vm)).json();
    const maj = await a.put(
      root() + '/objects/' + ids.vm,
      { kind: vm.kind, name: vm.name, data: { ...vm.data, mission: 'Mission précisée après la validation' } },
      { 'if-match': `"${vm.version}"` },
    );
    expect(maj.statusCode, maj.body).toBe(200);
    const apres = (await a.get(root() + '/risk-studies/' + ids.etude)).json();
    expect(apres.ateliers[0].valide).toBe(false);
    expect(apres.ateliers[0].modifieDepuisValidation).toBe(true);
    // L'atelier suivant, non touché, reste validé ; l'historique des validations est conservé.
    expect(apres.ateliers[1].valide).toBe(true);
    expect(apres.ateliers[0].validations).toHaveLength(1);
  });
  it('conserve le socle de sécurité de l’étude (atelier 1) et le restitue dans la vue', async () => {
    const etude = (await a.get(root() + '/objects/' + ids.etude)).json();
    const socle = [
      { referential: 'Socle fictif', status: 'partial', gap: 'Journalisation à compléter', requirementRefs: [] },
    ];
    const maj = await a.put(
      root() + '/objects/' + ids.etude,
      { kind: etude.kind, name: etude.name, data: { ...etude.data, baseline: socle } },
      { 'if-match': `"${etude.version}"` },
    );
    expect(maj.statusCode, maj.body).toBe(200);
    const vue = (await a.get(root() + '/risk-studies/' + ids.etude)).json();
    expect(vue.etude.data.baseline).toEqual(socle);
    // Un état de socle inconnu est refusé par le serveur.
    const refus = await a.put(
      root() + '/objects/' + ids.etude,
      { kind: etude.kind, name: etude.name, data: { ...etude.data, baseline: [{ ...socle[0], status: 'conforme' }] } },
      { 'if-match': `"${maj.json().version}"` },
    );
    expect(refus.statusCode).toBe(422);
  });
});

describe('bibliothèque partagée des sources de risque (décision 10)', () => {
  it('une source sans étude est réutilisée par référence, versionnée, avec son usage et sa dérive signalés', async () => {
    const source = await creer(a, 'risk_source', 'Groupe criminel de la bibliothèque', {
      category: 'Criminel organisé',
      motive: 'Gain financier',
      targetObjective: 'Chiffrer les données et exiger une rançon',
    });
    expect(source.statusCode, source.body).toBe(200);
    const id = source.json().id as string;
    let lib = (await a.get(root() + '/risk-library')).json();
    expect(lib.items.find((x: { id: string }) => x.id === id)).toMatchObject({
      name: 'Groupe criminel de la bibliothèque',
      category: 'Criminel organisé',
      usages: 0,
      etudes: 0,
      version: 1,
    });
    // Une source propre à une étude n'est pas dans la bibliothèque.
    expect(lib.items.some((x: { id: string }) => x.id === ids.sr)).toBe(false);
    // Le couple de l'étude référence la source de la bibliothèque : lecture, pas copie.
    const couple = await creer(a, 'sr_ov', 'Couple issu de la bibliothèque', {
      studyRef: ref('etude'),
      sourceRef: 'object:' + id,
      sourceVersion: 1,
      objective: 'Chiffrer les données et exiger une rançon',
    });
    expect(couple.statusCode, couple.body).toBe(200);
    lib = (await a.get(root() + '/risk-library')).json();
    expect(lib.items.find((x: { id: string }) => x.id === id)).toMatchObject({ usages: 1, etudes: 1 });
    const vue = async () =>
      (await a.get(root() + '/risk-studies/' + ids.etude)).json() as {
        ateliers: { id: string; objets: { id: string; kind: string; calcul: Record<string, unknown> }[] }[];
      };
    let a2 = (await vue()).ateliers.find((x) => x.id === 'a2')!;
    expect(a2.objets.find((o) => o.id === id)?.calcul.bibliotheque).toBe(true);
    expect(a2.objets.find((o) => o.id === couple.json().id)?.calcul.sourceModifiee ?? null).toBeNull();
    // La source évolue : nouvelle version, la dérive est signalée sur le couple, rien n'est modifié en silence.
    const maj = await a.put(
      root() + '/objects/' + id,
      {
        kind: 'risk_source',
        name: 'Groupe criminel de la bibliothèque',
        data: { ...source.json().data, motive: 'Gain et revente' },
      },
      { 'if-match': '"1"' },
    );
    expect(maj.statusCode, maj.body).toBe(200);
    a2 = (await vue()).ateliers.find((x) => x.id === 'a2')!;
    expect(a2.objets.find((o) => o.id === couple.json().id)?.calcul.sourceModifiee).toBe(2);
    expect((await a.get(root() + '/objects/' + couple.json().id)).json().data.sourceVersion).toBe(1);
    // Droits : un compte sans accès au périmètre ne lit pas la bibliothèque.
    expect((await ro.get(root() + '/risk-library')).statusCode).toBe(404);
    expect((await ro.get(`/api/grc/${DEFAULT_SMSI}/risk-library`)).statusCode).toBe(200);
  });
});

describe('risque du registre : processus ISO/IEC 27005 et acceptation formelle', () => {
  let methodId: string, riskId: string;
  it('publie une méthode et crée un risque issu de l’étude, avec identification ISO', async () => {
    const definition = methodTemplate('iso27005');
    const p = await a.post(root() + '/methods/preview', { id: null, definition });
    const pub = await a.post(
      root() + '/methods/publish',
      { id: null, definition, previewId: p.json().previewId, reason: 'Méthode de la recette U3', confirm: 'PUBLIER' },
      { 'if-match': '"0"' },
    );
    expect(pub.statusCode, pub.body).toBe(200);
    methodId = pub.json().methodId;
    const r = await creer(a, 'risk', 'Risque : hameçonnage puis chiffrement', {
      description: 'Issu du scénario opérationnel',
      code: 'R-U3',
      ownerId: null,
      methodId,
      methodVersion: 1,
      domain: '',
      entity: '',
      scope: '',
      strategy: 'accept',
      acceptanceReason: 'Coût de réduction disproportionné pour la recette',
      reviewAt: '2027-06-30',
      stages: {},
      studyRef: ref('etude'),
      scenarioRef: ref('so'),
      assetRefs: [ref('bs')],
      threat: 'Rançongiciel',
      vulnerability: 'Messagerie sans filtrage',
      consequences: 'Interruption des soins',
    });
    expect(r.statusCode, r.body).toBe(200);
    riskId = r.json().id;
    // Le scénario d'origine doit être un scénario opérationnel.
    expect(
      (await creer(a, 'risk', 'Mauvaise filiation', { ...r.json().data, scenarioRef: ref('ss') })).statusCode,
    ).toBe(422);
  });

  it('acceptation : réservée à l’administration, échéance requise, décision immuable', async () => {
    const risk = (await a.get(root() + '/objects/' + riskId)).json();
    const accepter = { operation: 'risk_acceptance', result: 'accepted', until: '2027-06-30' };
    expect((await decider(rw, 'object:' + riskId, risk.version, accepter)).statusCode).toBe(403);
    expect((await decider(a, 'object:' + riskId, risk.version, { ...accepter, until: '' })).statusCode).toBe(422);
    const ok = await decider(a, 'object:' + riskId, risk.version, accepter);
    expect(ok.statusCode, ok.body).toBe(200);
    expect(ok.json().terms).toEqual({ until: '2027-06-30' });
    const reg = await a.get(root() + '/risks/register?acceptation=acceptee');
    expect(reg.statusCode, reg.body).toBe(200);
    expect(reg.json().items.map((x: { id: string }) => x.id)).toEqual([riskId]);
    expect(reg.json().items[0]).toMatchObject({ demarche: 'iso27005', strategie: 'accept', acceptation: 'acceptee' });
    expect((await a.get(root() + '/risks/register?acceptation=a_decider')).json().items).toEqual([]);
    expect((await a.get(root() + '/risks/register?etude=' + ids.etude)).json().items).toHaveLength(1);
    // Le drapeau « revue en retard » suit la date de prochaine revue, et le filtre ne garde que les risques en retard.
    const item = reg.json().items[0] as { prochaineRevue: string | null; enRetard: boolean };
    expect(item.enRetard).toBe(!!item.prochaineRevue && item.prochaineRevue < new Date().toISOString().slice(0, 10));
    const enRetard = (await a.get(root() + '/risks/register?enRetard=1')).json().items as { enRetard: boolean }[];
    expect(enRetard.every((x) => x.enRetard)).toBe(true);
  });

  it('une option autre qu’« accepter » ne peut pas recevoir d’acceptation', async () => {
    const r = await a.post(`/api/grc/${smsi}/objects`, {
      kind: 'risk',
      name: 'Risque à réduire',
      data: {
        description: '',
        code: '',
        ownerId: null,
        methodId,
        methodVersion: 1,
        domain: '',
        entity: '',
        scope: '',
        strategy: 'reduce',
        acceptanceReason: '',
        reviewAt: null,
        stages: {},
      },
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(
      (
        await decider(a, 'object:' + r.json().id, 1, {
          operation: 'risk_acceptance',
          result: 'accepted',
          until: '2027-01-01',
        })
      ).statusCode,
    ).toBe(409);
  });
});

describe('cloisonnement et droits', () => {
  it('lecture sans accès au périmètre : refus ; sans pilotage:lire : refus', async () => {
    expect((await ro.get(root() + '/risks/register')).statusCode).toBe(404);
    expect((await ro.get(root() + '/risk-studies/' + ids.etude)).statusCode).toBe(404);
    expect((await ro.get(`/api/grc/${DEFAULT_SMSI}/risks/register`)).statusCode).toBe(200);
    // L'étude d'un périmètre restreint n'est pas lisible depuis le périmètre commun.
    expect((await a.get(`/api/grc/${DEFAULT_SMSI}/risk-studies/${ids.etude}`)).statusCode).toBe(404);
  });
  it('le sélecteur de références ne propose que les cibles demandées', async () => {
    const r = await a.get(root() + '/sources?search=&cibles=' + encodeURIComponent('object:feared_event'));
    expect(r.statusCode, r.body).toBe(200);
    expect(new Set(r.json().items.map((x: { kind: string }) => x.kind))).toEqual(new Set(['feared_event']));
    expect((await a.get(root() + '/sources?cibles=' + encodeURIComponent('object:../x'))).statusCode).toBe(422);
  });
});
