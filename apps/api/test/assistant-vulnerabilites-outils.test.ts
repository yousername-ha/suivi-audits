/* Assistant RSSI, outils du module Vulnérabilités (ADR 0100, lot ASSISTANT-V1, décisions du RSSI du 20/11/2026) :
   - failles_prioritaires lit la même source que le tableau « Cibles par priorité » de la vue d'ensemble (calcul global,
     mêmes droits de lecture) : mêmes failles, dans le même ordre, pour l'administrateur et pour deux personnes à périmètre
     restreint ; produits « à confirmer » signalés ;
   - machines_prioritaires rend aussi les actifs exposés sur Internet, sous des repères « E-… », à côté des machines « M-… » ;
   - evaluer_cve : rubrique « Quoi faire » sans renvoi interne (contenu réel, source nommée ; rubrique vide omise ; mention
     « aucun correctif publié par les sources lues ») ;
   - `elements` : ce que chaque outil rend ;
   - serveur sans connecteur Tenable configuré : les trois outils répondent ;
   - aucune sortie des trois outils (résultat rendu par le service, puis requête remise au modèle) ne contient un nom de
     machine, une adresse, un domaine, un fournisseur d'accès, un numéro d'AS ni un nom de périmètre des jeux d'essai.
   Faux modèle seulement, aucun service joint. Données entièrement fictives : noms en .invalid et .example, adresses de
   192.0.2.0/24 et 198.51.100.0/24, CVE et contrôles fictifs. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { DemandeModele, MessageModele, ReponseModele, TransportModele } from '../src/assistant/modele.js';
import { QUOI_FAIRE_SANS_CORRECTIF } from '../src/vulnerabilites/assistant.js';
import {
  type Agent,
  appliquerFlux,
  createTestApp,
  login,
  makeUser,
  ouvrirFlux,
  sessionUser,
  type TestApp,
  type TestUser,
} from './helpers.js';

const A = '/api/assistant';
const SYSTEME = { username: 'test' };
const EMPREINTE = 'b'.repeat(64);
/** P1 : catalogue KEV (action exigée), déclarée par un produit surveillé ; détectée ensuite sur la machine 2 seulement. */
const CVE_KEV = 'CVE-2026-97001';
/** Déclarée, aucune source ne publie de correctif. */
const CVE_SANS = 'CVE-2026-97002';
/** KEV, produit seulement proposé : à confirmer. */
const CVE_PROPOSEE = 'CVE-2026-97003';
/** Exposée sur Internet (AlgoLightHouse) ; fiche du CERT Santé : un correctif existe. */
const CVE_EXPOSEE = 'CVE-2026-97004';
/** Détectée par Tenable sur les machines 1 et 2, correctif de Tenable. */
const CVE_TENABLE = 'CVE-2026-97005';
/** Exposée sur l'hôte B seulement. */
const CVE_EXPOSEE_B = 'CVE-2026-97006';
const CORRECTIF_TENABLE = 'Upgrade the fictional agent to 3.1 or later.';
const ACTION_KEV = 'Apply the fictional vendor update.';

/* ------------------------------------------------------------------ Identifiants fictifs qui ne doivent jamais sortir */
const NOM_A = 'Périmètre outils Alpha';
const NOM_B = 'Périmètre outils Bravo';
const PERIM_ALH_A = 'Périmètre ALH outils Alpha';
const PERIM_ALH_B = 'Périmètre ALH outils Bravo';
const DOMAINE = 'portail.outils-fictif.example';
const IP_A = '192.0.2.40';
const IP_B = '198.51.100.40';
const RESOLUTION = '192.0.2.41';
const FAI = 'FAI fictif outils';
const AS = '64512';
const uuidMachine = (n: number) => `00000000-0000-4000-8000-0000000008${(0xa0 + n).toString(16)}`;
const nomMachine = (n: number) => `srv-outils-0${n}.exemple.invalid`;
const adresse = (n: number) => `192.0.2.${60 + n}`;
const OS = 'Systeme Fictif Outils 2';
const U = (n: number) => `0190b000-0000-7000-8000-${String(n).padStart(12, '0')}`;

function sansIdentifiant(texte: string, contexte: string) {
  for (const x of [
    NOM_A,
    NOM_B,
    PERIM_ALH_A,
    PERIM_ALH_B,
    DOMAINE,
    'outils-fictif.example',
    IP_A,
    IP_B,
    RESOLUTION,
    FAI,
    AS,
    OS,
    'srv-outils',
    'uuid:',
    '198.51.100.',
    '192.0.2.',
  ])
    expect(texte, `${contexte} : ${x}`).not.toContain(x);
  for (const n of [1, 2]) {
    expect(texte, contexte).not.toContain(nomMachine(n));
    expect(texte, contexte).not.toContain(adresse(n));
    expect(texte, contexte).not.toContain(uuidMachine(n));
  }
}

/* ------------------------------------------------------------------ Faux modèle */
class FauxModele implements TransportModele {
  demandes: DemandeModele[] = [];
  etapes: ((d: DemandeModele) => MessageModele)[] = [];
  declare() {
    return true;
  }
  async completer(_adresse: string, _cle: string, demande: DemandeModele): Promise<ReponseModele> {
    this.demandes.push(structuredClone(demande));
    const e = this.etapes.shift();
    return {
      message: e ? e(demande) : { role: 'assistant', content: 'Réponse fictive.' },
      jetonsEntree: 10,
      jetonsSortie: 5,
    };
  }
}
const appel = (id: string, nom: string, args: unknown): MessageModele => ({
  role: 'assistant',
  content: '',
  tool_calls: [{ id, type: 'function', function: { name: nom, arguments: JSON.stringify(args) } }],
});

/* ------------------------------------------------------------------ Surface externe fictive (AlgoLightHouse) */
/** Hôte A et domaine (périmètre ALH Alpha), hôte B (Bravo) ; nginx 1.18.0 sur l'hôte A et le domaine (CVE 97004), 1.20.0
    sur l'hôte B (CVE 97004 et 97006) ; une alerte ouverte sur l'hôte A, qui cite 97004, avec une résolution de l'éditeur. */
const espace = () => {
  const hote = (n: number, perim: number, adr: string) => ({
    type: 'hote',
    id: U(n),
    perimetre: U(perim),
    statut: 'monitored',
    adresse: adr,
    fai: FAI,
    asn: AS,
    pays: 'FR',
    mutualise: false,
    cdn: false,
    joignable: true,
    joignableLe: null,
    importManuel: false,
    creeLe: null,
    majLe: null,
  });
  const lien = (version: string, actif: number, typeActif: string, libelle: string) => ({
    type: 'technologie_actif',
    technologie: 'f5|nginx|',
    version,
    actif: U(actif),
    typeActif,
    libelle,
    actuel: true,
  });
  const cve = (version: string, id: string) => ({
    type: 'technologie_cve',
    technologie: 'f5|nginx|',
    version,
    cve: id,
    titre: 'Faille fictive',
    cvss: 7.5,
    epss: 0.1,
    severite: 'high',
    preuve: false,
    exploitee: false,
    publieeLe: null,
  });
  return [
    { type: 'perimetre', id: U(1), nom: PERIM_ALH_A },
    { type: 'perimetre', id: U(2), nom: PERIM_ALH_B },
    hote(11, 1, IP_A),
    hote(12, 2, IP_B),
    {
      type: 'domaine',
      id: U(21),
      perimetre: U(1),
      statut: 'monitored',
      domaine: DOMAINE,
      niveau: 2,
      importManuel: false,
      adresse: RESOLUTION,
      parent: null,
      creeLe: null,
      majLe: null,
    },
    {
      type: 'alerte',
      id: U(31),
      perimetre: U(1),
      typeAlerte: 'vulnerable_service',
      criticite: 'major',
      statut: 'untreated',
      titre: 'Serveur web fictif vulnérable',
      verifiee: true,
      detail: true,
      cibleType: 'host',
      cibleValeur: IP_A,
      cibleHote: U(11),
      cibleDomaine: null,
      cves: [CVE_EXPOSEE],
      defauts: [
        {
          nom: 'Composant vulnérable',
          description: 'Une version vulnérable du serveur web fictif est exposée.',
          resolutions: [
            {
              nom: 'Mettre à jour le serveur web',
              description: 'Installer la version corrigée du serveur web fictif.',
              facilite: 'Quick Win',
              gain: 'Strong',
            },
          ],
        },
      ],
      creeLe: '2026-11-10T10:00:00.000Z',
      majLe: '2026-11-15T10:00:00.000Z',
      termineeLe: null,
    },
    {
      type: 'technologie',
      cle: 'f5|nginx|',
      nom: 'nginx',
      editeur: 'F5',
      produit: 'nginx',
      technologie: null,
      derniere: null,
      tronquee: false,
    },
    lien('1.18.0', 11, 'hote', IP_A),
    lien('1.18.0', 21, 'domaine', DOMAINE),
    lien('1.20.0', 12, 'hote', IP_B),
    cve('1.18.0', CVE_EXPOSEE),
    cve('1.20.0', CVE_EXPOSEE),
    cve('1.20.0', CVE_EXPOSEE_B),
  ];
};

/* ------------------------------------------------------------------ Parc Tenable fictif (seconde partie) */
const machine = (n: number) => ({
  type: 'machine',
  cle: `uuid:${uuidMachine(n)}`,
  uuid: uuidMachine(n),
  nom: nomMachine(n),
  adresse: adresse(n),
  systeme: OS,
  premiere: '2026-07-18T01:05:01.000Z',
  derniere: '2026-11-16T06:04:48.000Z',
  exposition: 'internal',
  acr: 4,
});
const constat = (plugin: string, cves: string[], extra: Record<string, unknown> = {}) => ({
  type: 'constat',
  plugin,
  nom: `Produit fictif : contrôle ${plugin}`,
  gravite: 'elevee',
  famille: 'Misc.',
  synopsis: 'The remote host is missing a fictional update.',
  correctif: null,
  cvss3Vecteur: null,
  cvss3Score: 7.5,
  vpr: null,
  epss: null,
  exploitable: false,
  exploitLibelle: null,
  failleLe: null,
  correctifLe: null,
  finSupportLe: null,
  voirAussi: null,
  cves,
  cvesTronquees: false,
  ...extra,
});
const detection = (plugin: string, n: number) => ({
  type: 'detection',
  plugin,
  machine: `uuid:${uuidMachine(n)}`,
  port: 443,
  protocole: 'TCP',
  premiere: '2026-07-18T01:05:01.000Z',
  derniere: '2026-11-16T06:04:48.000Z',
  attenue: false,
  risqueAccepte: false,
  risqueRequalifie: false,
});
const parc = (): Record<string, unknown>[] => [
  machine(1),
  machine(2),
  constat('970001', [CVE_KEV]),
  constat('970005', [CVE_TENABLE], {
    gravite: 'critique',
    correctif: CORRECTIF_TENABLE,
    correctifLe: '2026-10-05T00:00:00.000Z',
  }),
  constat('970009', [], { gravite: 'moyenne' }),
  detection('970001', 2),
  detection('970005', 1),
  detection('970005', 2),
  detection('970009', 1),
];

let t: TestApp;
let modele: FauxModele;
let adminUser: TestUser, lecteurAUser: TestUser, lecteurBUser: TestUser;
let admin: Agent, lecteurA: Agent, lecteurB: Agent;
let perimA: string, perimB: string;

type Outils = ReturnType<NonNullable<TestApp['svc']['assistant']['vulnerabilites']>['pour']>;
/** Les outils du module pour une personne, dans une conversation neuve à elle. */
const outils = async (u: TestUser, a: Agent): Promise<{ o: Outils; conv: string }> => {
  const r = await a.post(`${A}/conversations`, { profil: 'mise_en_oeuvre' });
  expect(r.statusCode, r.body).toBe(201);
  const conv = r.json().id as string;
  return { o: t.svc.assistant.vulnerabilites!.pour(await sessionUser(t, u), conv, '127.0.0.1'), conv };
};

interface Cible {
  cve: string | null;
  titre: string;
  produit: string | null;
  priorite: { niveau: string };
  presences: string[];
  aConfirmer: boolean;
  exploitee: boolean;
  machines: { lisibles: number; horsLecture: boolean };
  actifs: { lisibles: number; horsLecture: boolean };
  fiche: { nature: string; id: string } | null;
}
interface Faille {
  rang: number;
  cve: string | null;
  titre: string;
  produit: string | null;
  priorite: { niveau: string };
  presences: string[];
  produitAConfirmer?: true;
  seulementAConfirmer?: true;
  exploitee: boolean;
  machinesLisibles: number;
  machinesAussiHorsDeVosDroits?: true;
  actifsExposesLisibles: number;
  actifsAussiHorsDeVosDroits?: true;
  nature?: string;
  id?: string;
}
interface FaillesRendues {
  failles: Faille[];
  faillesSuiviesAuTotal: number;
}
interface Actif {
  repere: string | null;
  rang: number;
  rangSur: number;
  faillesExposees: number;
  faillesParPriorite?: Record<string, number>;
}
interface MachinesRendues {
  machinesDansLaPortee: number;
  machines: { repere: string }[];
  actifsExposesDansLaPortee: number;
  actifsExposes: Actif[];
}

const LIBELLES: Record<string, string> = {
  detectee: 'Détectée par Tenable',
  declaree: 'Déclarée (produit surveillé)',
  exposee: 'Exposée sur Internet (AlgoLightHouse)',
  a_confirmer: 'Produit à confirmer',
};
/** Égalité outil / écran : pour la personne, les failles rendues par l'outil sont les premières cibles du tableau, dans le
    même ordre, avec les mêmes faits et les mêmes nombres lisibles ; le total est celui de l'écran. */
async function egaliteOutilEcran(u: TestUser, a: Agent) {
  const ecran = await a.get('/api/vulnerabilites/vue-ensemble');
  expect(ecran.statusCode, ecran.body).toBe(200);
  const v = ecran.json() as { total: number; cibles: Cible[] };
  const { o } = await outils(u, a);
  const r = await o.faillesPrioritaires({ nombre: 25 });
  const d = r.donnees as FaillesRendues;
  expect(r.elements).toBe(d.failles.length);
  expect(d.faillesSuiviesAuTotal).toBe(v.total);
  expect(d.failles.length).toBe(Math.min(25, v.cibles.length));
  expect(d.failles.map((f) => f.cve)).toEqual(v.cibles.slice(0, 25).map((c) => c.cve));
  d.failles.forEach((f, i) => {
    const c = v.cibles[i]!;
    expect(f.rang).toBe(i + 1);
    expect(f.titre).toBe(c.titre);
    expect(f.produit).toBe(c.produit);
    expect(f.priorite.niveau).toBe(c.priorite.niveau);
    expect(f.presences).toEqual(c.presences.map((p) => LIBELLES[p]));
    expect(f.exploitee).toBe(c.exploitee);
    expect(!!f.produitAConfirmer).toBe(c.presences.includes('a_confirmer'));
    expect(!!f.seulementAConfirmer).toBe(c.aConfirmer);
    expect(f.machinesLisibles).toBe(c.machines.lisibles);
    expect(!!f.machinesAussiHorsDeVosDroits).toBe(c.machines.horsLecture);
    expect(f.actifsExposesLisibles).toBe(c.actifs.lisibles);
    expect(!!f.actifsAussiHorsDeVosDroits).toBe(c.actifs.horsLecture);
    expect(f.nature ?? null).toBe(c.fiche?.nature ?? null);
    expect(f.id ?? null).toBe(c.fiche?.id ?? null);
  });
  return d;
}

beforeAll(async () => {
  modele = new FauxModele();
  t = await createTestApp({}, { modele });
  await ouvrirFlux(t, 'assistant');
  await appliquerFlux(t, 'assistant');
  adminUser = await makeUser(t, 'avo_admin', 'admin');
  admin = await login(t, adminUser);
  expect((await admin.put(`${A}/reglages/cle`, { cle: 'cle-fictive-de-test-0123456789' })).statusCode).toBe(204);
  await t.svc.db.q(
    "UPDATE assistant_reglages SET actif = true, adresse = $1, modele = 'modele-fictif', budget_jetons_jour = 10000000",
    ['https://modele.example.invalid/v1'],
  );
  await t.svc.db.q('UPDATE assistant_profils SET actif = true, tous_perimetres = true, documents = false');
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES ('r_avo_lecteur', 'Assistant, lecture des vulnérabilités',
       ARRAY['assistant:lire','assistant:modifier','vulnerabilites:lire','ecarts:lire'])`,
  );
  const perimetre = async (name: string) =>
    (await admin.post('/api/grc/smsis', { name, scope: 'Périmètre fictif', timezone: 'Europe/Paris' })).json()
      .id as string;
  perimA = await perimetre(NOM_A);
  perimB = await perimetre(NOM_B);
  lecteurAUser = await makeUser(t, 'avo_lecteur_a', 'r_avo_lecteur', { rattache: false });
  lecteurBUser = await makeUser(t, 'avo_lecteur_b', 'r_avo_lecteur', { rattache: false });
  await t.svc.db.q('INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $2, false), ($3, $4, false)', [
    perimA,
    lecteurAUser.id,
    perimB,
    lecteurBUser.id,
  ]);
  lecteurA = await login(t, lecteurAUser);
  lecteurB = await login(t, lecteurBUser);

  // Veille : CVE fictives ; KEV (action exigée, échéance) pour 97001 et 97003 ; fiche du CERT Santé pour 97004.
  await t.svc.db.q(
    `INSERT INTO vulnerabilites_veille_cve (cve, kev_ajout, kev_nom, kev_produit, kev_action, kev_echeance)
     VALUES ($1, '2026-11-01', 'Fictional Portal Remote Code Execution', 'Portail fictif', $3, '2026-11-22'),
            ($2, '2026-11-02', 'Fictional Switch Authentication Bypass', 'Commutateur fictif', NULL, NULL)`,
    [CVE_KEV, CVE_PROPOSEE, ACTION_KEV],
  );
  await t.svc.db.q('INSERT INTO vulnerabilites_veille_cve (cve) VALUES ($1), ($2), ($3), ($4)', [
    CVE_SANS,
    CVE_EXPOSEE,
    CVE_TENABLE,
    CVE_EXPOSEE_B,
  ]);
  await t.svc.db.q(
    `INSERT INTO vulnerabilites_veille_avis (source, identifiant, nature, titre, publie_le, cves, cves_lues, produit,
       fiche_lue_le, fiche_titre, fiche_correctif, fiche_contournement)
     VALUES ('cert-sante', '970004', 'alerte', 'Serveur web fictif - CVE-2026-97004', '2026-11-06T08:00:00Z',
             ARRAY[$1], true, 'Serveur web fictif', now(), 'Fiche fictive', 'oui', 'non')`,
    [CVE_EXPOSEE],
  );
  // Produits surveillés : 97001 et 97002 rattachées au produit « web » (sans machine reliée : déclarées, V22) ; 97003
  // seulement proposée pour le produit « réseau » (à confirmer).
  const produit = async (nom: string, famille: string) =>
    (await t.svc.db.one<{ id: string }>(
      `INSERT INTO vulnerabilites_produits (editeur, nom, version_produit, famille, criticite, created_by, updated_by)
       VALUES ('Éditeur fictif', $1, '1.0', $2, 'elevee', 'test', 'test') RETURNING id`,
      [nom, famille],
    ))!.id;
  const web = await produit('Portail fictif', 'web');
  const reseau = await produit('Commutateur fictif', 'reseau');
  await t.svc.db.q(
    `INSERT INTO vulnerabilites_rapprochements
       (produit_id, cve, statut, motif, version_dans_plage, par_identifiant, empreinte_produit, empreinte_cve)
     VALUES ($1, $3, 'rattachee', NULL, 'oui', true, $6, $6),
            ($1, $4, 'rattachee', NULL, 'oui', true, $6, $6),
            ($2, $5, 'proposee', 'nom_seulement', NULL, false, $6, $6)`,
    [web, reseau, CVE_KEV, CVE_SANS, CVE_PROPOSEE, EMPREINTE],
  );

  // Surface externe : instance AlgoLightHouse fictive synchronisée par le service ; périmètres ALH reliés.
  const r = await admin.post('/api/integrations/instances', {
    type: 'algolighthouse',
    nom: 'AlgoLightHouse fictif',
    configuration: { adresse: 'https://espace-fictif.algolighthouse.fr' },
  });
  const instance = r.json().id as string;
  await admin.put(`/api/integrations/instances/${instance}/secrets`, { cleApi: 'cle-api-fictive-0123456789abcdef' });
  expect(
    (
      await admin.put(
        `/api/integrations/instances/${instance}/activation`,
        { actif: true, fluxConfirme: true },
        { 'if-match': `"${r.json().version}"` },
      )
    ).statusCode,
  ).toBe(200);
  await t.svc.flux.changer('algolighthouse', true, SYSTEME, '127.0.0.1');
  await t.svc.backups.heartbeat(true);
  await t.svc.db.q(
    "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'manuel', 'test')",
    [instance],
  );
  const job = (await t.svc.integrations.reclamer(true))!;
  const elements = espace();
  await t.svc.integrations.lot(job.id as string, elements);
  const compte = (x: string) => elements.filter((e) => e.type === x).length;
  await t.svc.integrations.terminer(job.id as string, {
    ok: true,
    resultat: {
      elements: elements.length,
      perimetres: compte('perimetre'),
      hotes: compte('hote'),
      domaines: compte('domaine'),
      alertes: compte('alerte'),
      details: 1,
      technologies: compte('technologie'),
      ecartes: 0,
      tronque: false,
    },
    erreur: null,
  });
  await t.svc.db.q('UPDATE vulnerabilites_alh_perimetres SET perimetre_id = $2 WHERE alh_id = $1', [U(1), perimA]);
  await t.svc.db.q('UPDATE vulnerabilites_alh_perimetres SET perimetre_id = $2 WHERE alh_id = $1', [U(2), perimB]);
}, 90_000);
afterAll(async () => {
  if (t) await t.close();
});

describe('serveur sans connecteur Tenable configuré', () => {
  it('aucune instance Tenable : les trois outils répondent', async () => {
    expect(
      (await t.svc.db.one<{ n: number }>("SELECT count(*)::int AS n FROM integrations WHERE type = 'tenable'"))!.n,
    ).toBe(0);
    const { o } = await outils(adminUser, admin);
    const f = await o.faillesPrioritaires({ nombre: 25 });
    const failles = (f.donnees as FaillesRendues).failles;
    expect(failles.map((x) => x.cve).sort()).toEqual(
      [CVE_KEV, CVE_SANS, CVE_PROPOSEE, CVE_EXPOSEE, CVE_EXPOSEE_B].sort(),
    );
    // Produit à confirmer signalé.
    expect(failles.find((x) => x.cve === CVE_PROPOSEE)).toMatchObject({
      produitAConfirmer: true,
      seulementAConfirmer: true,
      presences: ['Produit à confirmer'],
    });
    expect(failles.find((x) => x.cve === CVE_KEV)).not.toHaveProperty('produitAConfirmer');
    const m = await o.machinesPrioritaires({ nombre: 10 });
    expect(m.donnees).toMatchObject({ machinesDansLaPortee: 0, machines: [], actifsExposesDansLaPortee: 3 });
    expect(m.elements).toBe(3);
    const e = await o.evaluerCve(CVE_KEV);
    expect(e.donnees).toMatchObject({ cve: CVE_KEV, connue: true, presence: { detecteeParTenable: false } });
  });

  it('failles_prioritaires = tableau « Cibles par priorité », pour l’administrateur et deux personnes à périmètre restreint', async () => {
    for (const [u, a] of [
      [adminUser, admin],
      [lecteurAUser, lecteurA],
      [lecteurBUser, lecteurB],
    ] as const)
      await egaliteOutilEcran(u, a);
  });
});

describe('machines_prioritaires : actifs exposés sous des repères « E-… »', () => {
  it('rangés par la faille la plus prioritaire qu’ils portent, puis par nombre de failles ; selon les droits', async () => {
    const { o, conv } = await outils(adminUser, admin);
    const r = await o.machinesPrioritaires({ nombre: 10 });
    const d = r.donnees as MachinesRendues;
    expect(d.actifsExposes.map((x) => x.repere)).toEqual(['E-001', 'E-002', 'E-003']);
    expect(d.actifsExposes.map((x) => x.rang)).toEqual([1, 2, 3]);
    expect(d.actifsExposes.every((x) => x.rangSur === 3)).toBe(true);
    // L'hôte B porte les deux failles exposées : premier.
    expect(d.actifsExposes[0]!.faillesExposees).toBe(2);
    expect(d.actifsExposes.slice(1).map((x) => x.faillesExposees)).toEqual([1, 1]);
    const total = (x: Actif) => Object.values(x.faillesParPriorite ?? {}).reduce((s, n) => s + n, 0);
    expect(d.actifsExposes.map(total)).toEqual([2, 1, 1]);
    // Correspondance locale, à l'affichage : le repère désigne l'hôte B.
    const resoudre = await t.svc.assistant.vulnerabilites!.resolveur(await sessionUser(t, adminUser), conv);
    expect(resoudre('E-001')).toEqual({ machine: IP_B });
    expect([resoudre('E-002'), resoudre('E-003')].map((x) => (x as { machine: string }).machine).sort()).toEqual(
      [DOMAINE, IP_A].sort(),
    );
    // Personne à périmètre restreint : les actifs qu'elle lit, et eux seuls.
    const a = (await (await outils(lecteurAUser, lecteurA)).o.machinesPrioritaires({ nombre: 10 }))
      .donnees as MachinesRendues;
    expect(a.actifsExposesDansLaPortee).toBe(2);
    expect(a.actifsExposes.map((x) => x.faillesExposees)).toEqual([1, 1]);
    const b = (await (await outils(lecteurBUser, lecteurB)).o.machinesPrioritaires({ nombre: 10 }))
      .donnees as MachinesRendues;
    expect(b.actifsExposesDansLaPortee).toBe(1);
    expect(b.actifsExposes).toEqual([
      expect.objectContaining({ repere: 'E-001', rang: 1, rangSur: 1, faillesExposees: 2 }),
    ]);
  });

  it('avec une CVE : les actifs qui la portent, mêmes repères que dans evaluer_cve ; borne du nombre', async () => {
    const { o } = await outils(lecteurAUser, lecteurA);
    const e = (await o.evaluerCve(CVE_EXPOSEE)).donnees as { surfaceExterne: { reperes: string[] } };
    const r = await o.machinesPrioritaires({ nombre: 10, cve: CVE_EXPOSEE });
    const d = r.donnees as MachinesRendues;
    expect(d.actifsExposesDansLaPortee).toBe(2);
    expect(d.actifsExposes.map((x) => x.repere).sort()).toEqual([...e.surfaceExterne.reperes].sort());
    expect(d.actifsExposes.every((x) => x.faillesExposees === 1 && x.faillesParPriorite === undefined)).toBe(true);
    expect(r.elements).toBe(2);
    const un = await o.machinesPrioritaires({ nombre: 1, cve: CVE_EXPOSEE });
    expect((un.donnees as MachinesRendues).actifsExposes).toHaveLength(1);
    expect(un.elements).toBe(1);
  });
});

describe('evaluer_cve : rubrique « Quoi faire » sans renvoi interne', () => {
  const quoiFaire = async (cve: string, u: TestUser = adminUser, a: Agent = admin) => {
    const r = await (await outils(u, a)).o.evaluerCve(cve);
    const d = r.donnees as { quoiFaire: Record<string, unknown>; surfaceExterne?: unknown };
    // Plus aucun renvoi vers une autre partie du résultat.
    expect(JSON.stringify(r.donnees)).not.toMatch(
      /\bvoir (chaque|surfaceExterne)|correctifPublieParTenable|recommandationsDeLEditeur/,
    );
    return { d, elements: r.elements };
  };

  it('contenu réel avec sa source : catalogue KEV ; rubriques vides omises', async () => {
    const { d, elements } = await quoiFaire(CVE_KEV);
    expect(d.quoiFaire).toEqual({
      catalogueKev: { source: 'Catalogue KEV de la CISA', actionExigee: ACTION_KEV, echeance: '2026-11-22' },
    });
    // La CVE, un produit surveillé, une rubrique ; aucun avis, aucun constat, pas de surface externe.
    expect(elements).toBe(3);
  });

  it('contenu réel avec sa source : CERT Santé et recommandations de l’éditeur de la surface externe', async () => {
    const { d } = await quoiFaire(CVE_EXPOSEE, lecteurAUser, lecteurA);
    expect(d.quoiFaire).toEqual({
      certSante: { source: 'CERT Santé', unCorrectifExiste: 'oui', unContournementExiste: 'non' },
      algoLightHouse: {
        source: 'AlgoLightHouse (recommandations de l’éditeur de la surface externe)',
        recommandations: [
          {
            alerte: 'Serveur web fictif vulnérable',
            defauts: [
              {
                defaut: 'Composant vulnérable',
                description: 'Une version vulnérable du serveur web fictif est exposée.',
                resolutions: [
                  {
                    resolution: 'Mettre à jour le serveur web',
                    description: 'Installer la version corrigée du serveur web fictif.',
                    facilite: 'Quick Win',
                    gain: 'Strong',
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    // Les recommandations ne sont plus recopiées dans la surface externe : seulement les alertes.
    expect(d).toMatchObject({
      surfaceExterne: { alertesOuvertes: 1, alertes: [{ titre: 'Serveur web fictif vulnérable' }] },
    });
    expect(JSON.stringify(d.surfaceExterne)).not.toContain('Mettre à jour le serveur web');
  });

  it('aucun correctif : la mention explicite, et rien d’autre', async () => {
    const { d, elements } = await quoiFaire(CVE_SANS);
    expect(QUOI_FAIRE_SANS_CORRECTIF).toBe('aucun correctif publié par les sources lues');
    expect(d.quoiFaire).toEqual({ correctif: QUOI_FAIRE_SANS_CORRECTIF });
    // La CVE et son produit surveillé ; la mention n'est pas comptée.
    expect(elements).toBe(2);
  });

  it('pour qui ne lit pas l’alerte : ni recommandation de l’éditeur ni repère ; reste la fiche du CERT Santé', async () => {
    const { d } = await quoiFaire(CVE_EXPOSEE, lecteurBUser, lecteurB);
    expect(d.quoiFaire).toEqual({
      certSante: { source: 'CERT Santé', unCorrectifExiste: 'oui', unContournementExiste: 'non' },
    });
  });
});

describe('avec un connecteur Tenable : machines et constats', () => {
  beforeAll(async () => {
    const r = await admin.post('/api/integrations/instances', {
      type: 'tenable',
      nom: 'Tenable fictif',
      configuration: { adresse: 'https://tenable.exemple.invalid' },
    });
    const tenable = r.json().id as string;
    await admin.put(`/api/integrations/instances/${tenable}/secrets`, {
      accessKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
      secretKey: 'f0e1d2c3b4a5968778695a4b3c2d1e0f',
    });
    expect(
      (
        await admin.put(
          `/api/integrations/instances/${tenable}/activation`,
          { actif: true, fluxConfirme: true },
          { 'if-match': `"${r.json().version}"` },
        )
      ).statusCode,
    ).toBe(200);
    await t.svc.flux.changer('tenable', true, SYSTEME, '127.0.0.1');
    await t.svc.backups.heartbeat(true);
    await t.svc.db.q(
      "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'manuel', 'test')",
      [tenable],
    );
    const job = (await t.svc.integrations.reclamer(true))!;
    const elements = parc();
    await t.svc.integrations.lot(job.id as string, elements);
    const compte = (x: string) => elements.filter((e) => e.type === x).length;
    await t.svc.integrations.terminer(job.id as string, {
      ok: true,
      resultat: {
        elements: elements.length,
        pages: 1,
        constats: compte('constat'),
        detections: compte('detection'),
        machines: compte('machine'),
        hotes: 0,
        ecartes: 0,
        tronque: false,
        inventaire: { ok: true, erreur: null },
      },
      erreur: null,
    });
    for (const n of [1, 2])
      await t.svc.db.q(
        'UPDATE vulnerabilites_machines SET perimetre_id = $2, role = $3 WHERE identifiant_source = $1',
        [`uuid:${uuidMachine(n)}`, n === 1 ? perimA : perimB, n === 1 ? 'front' : 'bdd'],
      );
  }, 60_000);

  it('égalité outil / écran, restreint compris ; fiche ouverte seulement pour qui lit une machine touchée', async () => {
    const ad = await egaliteOutilEcran(adminUser, admin);
    const a = await egaliteOutilEcran(lecteurAUser, lecteurA);
    const b = await egaliteOutilEcran(lecteurBUser, lecteurB);
    // Mêmes failles, même ordre pour tout le monde (calcul global) ; nombres lisibles et fiche selon les droits.
    expect(a.failles.map((f) => f.cve)).toEqual(ad.failles.map((f) => f.cve));
    expect(b.failles.map((f) => f.cve)).toEqual(ad.failles.map((f) => f.cve));
    const kevA = a.failles.find((f) => f.cve === CVE_KEV)!;
    expect(kevA).toMatchObject({ machinesLisibles: 0, machinesAussiHorsDeVosDroits: true });
    expect(kevA).not.toHaveProperty('id');
    expect(b.failles.find((f) => f.cve === CVE_KEV)).toMatchObject({ machinesLisibles: 1, nature: 'constat' });
    // Constat sans CVE : présent dans la liste, titre du contrôle.
    expect(ad.failles.find((f) => f.cve === null)).toMatchObject({ titre: 'Produit fictif : contrôle 970009' });
  });

  it('« Quoi faire » : le correctif de Tenable, avec le numéro du contrôle', async () => {
    const r = await (await outils(lecteurAUser, lecteurA)).o.evaluerCve(CVE_TENABLE);
    const d = r.donnees as { quoiFaire: Record<string, unknown>; constats: Record<string, unknown>[] };
    expect(d.quoiFaire).toEqual({
      tenable: {
        source: 'Tenable (correctif publié pour chaque contrôle)',
        correctifs: [{ controles: ['970005'], correctif: CORRECTIF_TENABLE, publieLe: '2026-10-05' }],
      },
    });
    expect(d.constats[0]).toMatchObject({ controle: { numero: '970005' }, correctifPublieLe: '2026-10-05' });
    expect(d.constats[0]).not.toHaveProperty('correctifPublieParTenable');
    // La CVE, un constat, une rubrique.
    expect(r.elements).toBe(3);
  });

  it('machines et actifs exposés côte à côte ; elements = machines + actifs', async () => {
    const r = await (await outils(adminUser, admin)).o.machinesPrioritaires({ nombre: 10 });
    const d = r.donnees as MachinesRendues;
    expect(d.machines.map((m) => m.repere)).toEqual(['M-001', 'M-002']);
    expect(d.actifsExposes.map((x) => x.repere)).toEqual(['E-001', 'E-002', 'E-003']);
    expect(r.elements).toBe(5);
    // Avec un constat de Tenable : les machines seulement.
    const c = (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_constats WHERE plugin_id = 970005'))!
      .id;
    const rc = await (await outils(adminUser, admin)).o.machinesPrioritaires({ nombre: 10, constat: c });
    expect(rc.donnees).not.toHaveProperty('actifsExposes');
    expect(rc.elements).toBe(2);
  });

  it('confidentialité : aucune sortie des trois outils ne contient nom, adresse, domaine, FAI, AS ni périmètre', async () => {
    // 1. Ce que le service rend à l'assistant, pour chaque outil et chaque personne.
    for (const [u, a] of [
      [adminUser, admin],
      [lecteurAUser, lecteurA],
      [lecteurBUser, lecteurB],
    ] as const) {
      const { o } = await outils(u, a);
      const sorties = [
        ['failles_prioritaires', await o.faillesPrioritaires({ nombre: 25 })],
        ['machines_prioritaires', await o.machinesPrioritaires({ nombre: 30 })],
        ['machines_prioritaires (CVE)', await o.machinesPrioritaires({ nombre: 30, cve: CVE_EXPOSEE })],
        ['machines_prioritaires (CVE détectée)', await o.machinesPrioritaires({ nombre: 30, cve: CVE_TENABLE })],
        ...(await Promise.all(
          [CVE_KEV, CVE_SANS, CVE_PROPOSEE, CVE_EXPOSEE, CVE_TENABLE, CVE_EXPOSEE_B].map(
            async (cve) => [`evaluer_cve ${cve}`, await o.evaluerCve(cve)] as const,
          ),
        )),
      ] as const;
      for (const [nom, s] of sorties) {
        sansIdentifiant(JSON.stringify(s), `${nom}, ${u.username}`);
        expect(JSON.stringify(s), `${nom}, ${u.username}`).not.toMatch(/"role"|Rôle|\bfront\b|\bbdd\b/);
      }
    }
    // 2. Ce qui part réellement chez le fournisseur du modèle, sur une conversation qui appelle les trois outils.
    const r = await lecteurA.post(`${A}/conversations`, { profil: 'mise_en_oeuvre' });
    const conv = r.json().id as string;
    modele.demandes = [];
    modele.etapes = [
      () => appel('o1', 'failles_prioritaires', { nombre: 25 }),
      () => appel('o2', 'machines_prioritaires', {}),
      () => appel('o3', 'machines_prioritaires', { cve: CVE_EXPOSEE }),
      () => appel('o4', 'evaluer_cve', { cve: CVE_EXPOSEE }),
      () => appel('o5', 'evaluer_cve', { cve: CVE_TENABLE }),
      () => ({ role: 'assistant', content: 'Réponse fictive.' }),
    ];
    const m = await lecteurA.post(`${A}/conversations/${conv}/messages`, { texte: 'Quoi corriger en premier ?' });
    expect(m.statusCode, m.body).toBe(202);
    await t.svc.assistant.attendre(conv);
    expect(modele.etapes).toHaveLength(0);
    const resultats = modele.demandes
      .at(-1)!
      .messages.filter((x) => x.role === 'tool')
      .map((x) => x.content ?? '');
    expect(resultats).toHaveLength(5);
    expect(resultats.join('\n')).toContain('E-00');
    expect(resultats.join('\n')).toContain('M-00');
    sansIdentifiant(JSON.stringify(modele.demandes), 'requêtes au modèle');
  });
});
