/* Assistant RSSI branché sur le module Vulnérabilités (ADR 0100, V14, V25, V28, V29, V30 ; ADR 0086). Pièce maîtresse :
   un faux transport de modèle enregistre toutes les requêtes émises ; sur une conversation de plusieurs tours qui utilise
   tous les nouveaux outils, dépose une proposition, la fait confirmer, puis relit l'action créée (qui nomme les machines,
   V30), aucune requête ne contient un nom de machine, une adresse, un rôle, un identifiant de la source, un système ni un
   nom de périmètre des jeux d'essai. Aussi : migration 079 sur base vierge ; outils absents sans le droit, module désactivé,
   autre profil ; intersection des droits ; stabilité des repères ; remplacement à l'affichage selon les droits ; repère
   inventé non remplacé ; CVE inconnue ; proposition déposée, corrigée, confirmée, rejetée, redépôt refusé ; refus sans les
   droits de la cible ; journal sans nom ; suppression de la conversation. Faux modèle seulement, aucun service joint.
   Données entièrement fictives : noms en .invalid, adresses de 192.0.2.0/24, CVE et contrôles fictifs. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ConversationAssistantDetailDto, PropositionVulnerabiliteDto } from '@suivi/shared';
import type { DemandeModele, MessageModele, ReponseModele, TransportModele } from '../src/assistant/modele.js';
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

const V = '/api/vulnerabilites';
const A = '/api/assistant';
const SYSTEME = { username: 'test' };
const ADRESSE = 'https://modele.example.invalid/v1';
const CLE = 'cle-fictive-de-test-0123456789';
const CPE = 'cpe:2.3:a:editeur_av:produit_av:*:*:*:*:*:*:*:*';
const CVE_TENABLE = 'CVE-2026-96001';
const CVE_DECLAREE = 'CVE-2026-96101';
const OS = 'Systeme Fictif 9.3';

/* ------------------------------------------------------------------ Faux modèle */
type Etape = (d: DemandeModele) => MessageModele;
/** Faux modèle : une file d'étapes ; chaque requête consomme la suivante. Toutes les requêtes sont enregistrées. */
class FauxModele implements TransportModele {
  demandes: DemandeModele[] = [];
  etapes: Etape[] = [];
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
const reponse = (content: string): MessageModele => ({ role: 'assistant', content });
/** Dernier résultat d'outil remis au modèle. */
const dernierOutil = <T = Record<string, unknown>>(d: DemandeModele): T => {
  const m = [...d.messages].reverse().find((x) => x.role === 'tool');
  return JSON.parse(m?.content ?? 'null') as T;
};
const outilsDeclares = (d: DemandeModele) => (d.tools ?? []).map((o) => o.function.name);

/* ------------------------------------------------------------------ Parc fictif */
const uuidMachine = (n: number) => `00000000-0000-4000-8000-0000000007${(0xa0 + n).toString(16)}`;
const nomMachine = (n: number) => `srv-av-0${n}.exemple.invalid`;
const libelleMachine = (n: number) => `srv-av-0${n}`;
const adresse = (n: number) => `192.0.2.${90 + n}`;
/** Machines 1, 3 et 4 (sans nom) dans le périmètre Alpha, 2 dans Bravo. */
const machine = (n: number) => ({
  type: 'machine',
  cle: `uuid:${uuidMachine(n)}`,
  uuid: uuidMachine(n),
  nom: n === 4 ? null : nomMachine(n),
  adresse: adresse(n),
  systeme: OS,
  premiere: '2026-07-18T01:05:01.000Z',
  derniere: '2026-11-16T06:04:48.000Z',
  exposition: 'internal',
  acr: 4,
});
const constat = (plugin: string, extra: Record<string, unknown> = {}) => ({
  type: 'constat',
  plugin,
  nom: `Produit fictif : contrôle ${plugin}`,
  gravite: 'critique',
  famille: 'Misc.',
  synopsis: 'The remote host is missing a fictional update.',
  correctif: 'Upgrade the fictional package to 2.0 or later.',
  cvss3Vecteur: 'AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
  cvss3Score: 9.8,
  vpr: 7,
  epss: 0.2,
  exploitable: true,
  exploitLibelle: null,
  failleLe: null,
  correctifLe: '2026-10-05T00:00:00.000Z',
  finSupportLe: null,
  voirAussi: null,
  cves: [],
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
  machine(3),
  machine(4),
  constat('960001', { cves: [CVE_TENABLE] }),
  constat('960002', { gravite: 'elevee', exploitable: false, cves: ['CVE-2026-96002'] }),
  constat('960003', { gravite: 'moyenne', exploitable: false }),
  detection('960001', 1),
  detection('960001', 3),
  detection('960001', 4),
  detection('960002', 1),
  detection('960002', 2),
  detection('960003', 3),
];

let t: TestApp;
let modele: FauxModele;
let adminUser: TestUser;
let admin: Agent, rssiA: Agent, sansVuln: Agent, sansRegistre: Agent, lecteurVuln: Agent;
let perimA: string, perimB: string, instance: string;
const NOM_A = 'Périmètre vulnérabilités Alpha';
const NOM_B = 'Périmètre vulnérabilités Bravo';
const idMachine: Record<number, string> = {};
let constat1: string, constat2: string, rapprochement: string;

const ifMatch = (v: number) => ({ 'if-match': `"${v}"` });
const n = async (table: string, where = 'true', p: unknown[] = []) =>
  (await t.svc.db.one<{ n: number }>(`SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, p))!.n;
const ouvrir = async (a: Agent, profil = 'mise_en_oeuvre') => {
  const r = await a.post(`${A}/conversations`, { profil });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().id as string;
};
const demander = async (a: Agent, conversation: string, texte: string) => {
  const r = await a.post(`${A}/conversations/${conversation}/messages`, { texte });
  expect(r.statusCode, r.body).toBe(202);
  await t.svc.assistant.attendre(conversation);
};
const fil = async (a: Agent, conversation: string) =>
  (await a.get(`${A}/conversations/${conversation}`)).json() as ConversationAssistantDetailDto;
const propositions = async (a: Agent) =>
  (await a.get(`${A}/vulnerabilites/propositions`)).json() as PropositionVulnerabiliteDto[];
/** Repère attribué à une machine dans une conversation. */
const repereDe = async (conversation: string, m: number) => {
  const r = await t.svc.db.one<{ numero: number }>(
    'SELECT numero FROM vulnerabilites_assistant_reperes WHERE conversation_id = $1 AND machine_id = $2',
    [conversation, idMachine[m]],
  );
  return r ? `M-${String(r.numero).padStart(3, '0')}` : null;
};

/** Aucune chaîne identifiante d'une machine, d'un périmètre ou d'un rôle des jeux d'essai. */
function sansIdentifiant(texte: string, contexte: string) {
  for (const k of [1, 2, 3, 4]) {
    if (k !== 4) {
      expect(texte, contexte).not.toContain(nomMachine(k));
      expect(texte, contexte).not.toContain(libelleMachine(k));
    }
    expect(texte, contexte).not.toContain(adresse(k));
    expect(texte, contexte).not.toContain(uuidMachine(k));
  }
  expect(texte, contexte).not.toContain('srv-av');
  expect(texte, contexte).not.toContain('uuid:');
  expect(texte, contexte).not.toContain(OS);
  expect(texte, contexte).not.toContain(NOM_A);
  expect(texte, contexte).not.toContain(NOM_B);
  expect(texte, contexte).not.toMatch(/"role":"(front|back|bdd)"|"perimetreNom"|"adresse"|"systeme"/);
  expect(texte, contexte).not.toMatch(/\b(front|bdd)\b|Back applicatif|Base de données/i);
}

/** Une synchronisation de Tenable par le service : inscrite, réclamée, lots rangés, terminée. */
async function synchroniser(elements: unknown[]) {
  await t.svc.backups.heartbeat(true);
  await t.svc.db.q(
    "INSERT INTO integration_executions (integration_id, operation, origine, demande_par) VALUES ($1, 'synchroniser', 'manuel', 'test')",
    [instance],
  );
  const job = (await t.svc.integrations.reclamer(true))!;
  await t.svc.integrations.lot(job.id as string, elements);
  const compte = (x: string) => elements.filter((e) => (e as { type: string }).type === x).length;
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
}
const nvd = (cve: string, editeur: string, produit: string) => ({
  cve,
  publieLe: '2026-09-26T15:16:40.587Z',
  modifieLe: '2026-11-14T19:16:50.940Z',
  description: 'Fictional NVD description.',
  cvss31: { score: 9.8, vecteur: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H', gravite: 'CRITICAL' },
  cvss40: null,
  editeurs: [editeur],
  produits: [produit],
  produitsTouches: [
    {
      partie: 'a',
      editeur,
      produit,
      version: null,
      debutInclus: null,
      debutExclus: null,
      finInclus: null,
      finExclus: '2.0',
      vulnerable: true,
    },
  ],
  produitsTronques: false,
});

beforeAll(async () => {
  modele = new FauxModele();
  t = await createTestApp({}, { modele });
  await ouvrirFlux(t, 'assistant');
  await appliquerFlux(t, 'assistant');
  adminUser = await makeUser(t, 'av_admin', 'admin');
  admin = await login(t, adminUser);
  expect((await admin.put(`${A}/reglages/cle`, { cle: CLE })).statusCode).toBe(204);
  await t.svc.db.q(
    "UPDATE assistant_reglages SET actif = true, adresse = $1, modele = 'modele-fictif', budget_jetons_jour = 10000000",
    [ADRESSE],
  );
  await t.svc.db.q('UPDATE assistant_profils SET actif = true, tous_perimetres = true, documents = false');
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES
       ('r_av_rssi', 'Assistant et vulnérabilités', ARRAY['assistant:lire','assistant:modifier','vulnerabilites:lire','vulnerabilites:modifier','ecarts:lire','ecarts:modifier']),
       ('r_av_sans', 'Assistant sans vulnérabilités', ARRAY['assistant:lire','assistant:modifier','ecarts:lire','ecarts:modifier']),
       ('r_av_sansreg', 'Assistant sans registre', ARRAY['assistant:lire','assistant:modifier','vulnerabilites:lire','vulnerabilites:modifier','ecarts:lire']),
       ('r_av_lecteur', 'Assistant, lecture des vulnérabilités', ARRAY['assistant:lire','assistant:modifier','vulnerabilites:lire','ecarts:lire','ecarts:modifier'])`,
  );
  const perimetre = async (name: string) =>
    (await admin.post('/api/grc/smsis', { name, scope: 'Périmètre fictif', timezone: 'Europe/Paris' })).json()
      .id as string;
  perimA = await perimetre(NOM_A);
  perimB = await perimetre(NOM_B);
  const comptes: [string, string][] = [
    ['av_rssi_a', 'r_av_rssi'],
    ['av_sans_vuln', 'r_av_sans'],
    ['av_sans_registre', 'r_av_sansreg'],
    ['av_lecteur', 'r_av_lecteur'],
  ];
  const agents: Agent[] = [];
  for (const [nom, role] of comptes) {
    const u = await makeUser(t, nom, role, { rattache: false });
    await t.svc.db.q('INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $2, true)', [perimA, u.id]);
    agents.push(await login(t, u));
  }
  [rssiA, sansVuln, sansRegistre, lecteurVuln] = agents as [Agent, Agent, Agent, Agent];

  // Tenable fictif, synchronisé ; rôles et périmètres des machines.
  const r = await admin.post('/api/integrations/instances', {
    type: 'tenable',
    nom: 'Tenable fictif',
    configuration: { adresse: 'https://tenable.exemple.invalid' },
  });
  instance = r.json().id as string;
  await admin.put(`/api/integrations/instances/${instance}/secrets`, {
    accessKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    secretKey: 'f0e1d2c3b4a5968778695a4b3c2d1e0f',
  });
  expect(
    (
      await admin.put(
        `/api/integrations/instances/${instance}/activation`,
        { actif: true, fluxConfirme: true },
        ifMatch(r.json().version),
      )
    ).statusCode,
  ).toBe(200);
  await t.svc.flux.changer('tenable', true, SYSTEME, '127.0.0.1');
  await synchroniser(parc());
  for (const k of [1, 2, 3, 4]) {
    const id = (await t.svc.db.one<{ id: string }>(
      'SELECT id FROM vulnerabilites_machines WHERE identifiant_source = $1',
      [`uuid:${uuidMachine(k)}`],
    ))!.id;
    idMachine[k] = id;
    await t.svc.db.q('UPDATE vulnerabilites_machines SET perimetre_id = $2, role = $3 WHERE id = $1', [
      id,
      k === 2 ? perimB : perimA,
      { 1: 'front', 2: 'bdd', 3: 'back', 4: null }[k],
    ]);
  }
  const plugin = async (p: string) =>
    (await t.svc.db.one<{ id: string }>('SELECT id FROM vulnerabilites_constats WHERE plugin_id = $1', [Number(p)]))!
      .id;
  constat1 = await plugin('960001');
  constat2 = await plugin('960002');

  // Veille : deux CVE publiées par NVD ; la première au catalogue KEV et dans une alerte du CERT-FR.
  await t.svc.flux.changer('veille-vulnerabilites', true, SYSTEME, '127.0.0.1');
  await t.svc.db.q(
    "INSERT INTO vulnerabilites_veille_collectes (source, origine, demande_par) VALUES ('nvd', 'manuel', 'test')",
  );
  const job = (await t.svc.vulnerabilites.veille.reclamer(true))!;
  await t.svc.vulnerabilites.veille.lot(job.id as string, {
    elements: [nvd(CVE_TENABLE, 'editeur_tenable', 'produit_tenable'), nvd(CVE_DECLAREE, 'editeur_av', 'produit_av')],
  });
  await t.svc.vulnerabilites.veille.terminer(job.id as string, {
    ok: true,
    bilan: { elements: 2, ecartes: 0, tronque: false, detailsEchoues: 0 },
    erreur: null,
  });
  await t.svc.db.q(
    `UPDATE vulnerabilites_veille_cve SET kev_ajout = '2026-10-01', kev_echeance = '2026-10-22',
       kev_action = 'Apply mitigations per vendor instructions.' WHERE cve = $1`,
    [CVE_TENABLE],
  );
  await t.svc.db.q(
    `INSERT INTO vulnerabilites_veille_avis (source, identifiant, nature, titre, publie_le, cves)
     VALUES ('cert-fr', 'CERTFR-2026-ALE-091', 'alerte', 'Vulnérabilité fictive dans un produit fictif', '2026-10-02', $1)`,
    [[CVE_TENABLE]],
  );
  // Produit surveillé (CPE, version 1.5 dans la plage) relié à la machine 3 : faille déclarée.
  const p = await admin.post(`${V}/produits`, {
    editeur: 'Éditeur fictif AV',
    nom: 'Produit fictif AV',
    versionProduit: '1.5',
    cpe: CPE,
    famille: 'applications_metier',
    criticite: 'elevee',
  });
  expect(p.statusCode, p.body).toBe(201);
  const l = await admin.post(
    `${V}/produits/${p.json().id}/machines`,
    { machineId: idMachine[3] },
    ifMatch(p.json().version),
  );
  expect(l.statusCode, l.body).toBe(200);
  rapprochement = (await t.svc.db.one<{ id: string }>(
    "SELECT id FROM vulnerabilites_rapprochements WHERE cve = $1 AND statut = 'rattachee'",
    [CVE_DECLAREE],
  ))!.id;
}, 90_000);
afterAll(async () => {
  if (t) await t.close();
});

describe('migration 079 sur base vierge', () => {
  it('crée les deux tables vides, avec leurs contraintes', async () => {
    expect(
      (await t.svc.db.one("SELECT 1 AS ok FROM schema_migrations WHERE name = '079_vulnerabilites_assistant.sql'"))?.ok,
    ).toBe(1);
    expect(await n('vulnerabilites_assistant_reperes')).toBe(0);
    expect(await n('vulnerabilites_assistant_propositions')).toBe(0);
    const conv = await ouvrir(admin);
    const refus = (q: string, p: unknown[] = []) => expect(t.svc.db.q(q, p)).rejects.toThrow();
    await refus(
      'INSERT INTO vulnerabilites_assistant_reperes (conversation_id, numero, machine_id) VALUES ($1, 0, $2)',
      [conv, idMachine[1]],
    );
    await refus(
      'INSERT INTO vulnerabilites_assistant_reperes (conversation_id, numero, machine_id) VALUES ($1, 1000, $2)',
      [conv, idMachine[1]],
    );
    await t.svc.db.q(
      'INSERT INTO vulnerabilites_assistant_reperes (conversation_id, numero, machine_id) VALUES ($1, 1, $2)',
      [conv, idMachine[1]],
    );
    // Une machine, un repère par conversation.
    await refus(
      'INSERT INTO vulnerabilites_assistant_reperes (conversation_id, numero, machine_id) VALUES ($1, 2, $2)',
      [conv, idMachine[1]],
    );
    // Nature et faille cohérentes ; une proposition décidée porte sa date.
    await refus(
      "INSERT INTO vulnerabilites_assistant_propositions (conversation_id, nature, rapprochement_id, titre) VALUES ($1, 'constat', $2, 'x')",
      [conv, rapprochement],
    );
    await refus(
      "INSERT INTO vulnerabilites_assistant_propositions (conversation_id, nature, constat_id, titre, etat) VALUES ($1, 'constat', $2, 'x', 'rejetee')",
      [conv, constat1],
    );
    await t.svc.db.q(
      "INSERT INTO vulnerabilites_assistant_propositions (conversation_id, nature, constat_id, titre) VALUES ($1, 'constat', $2, 'x')",
      [conv, constat1],
    );
    // Supprimer la conversation supprime ses repères et ses propositions.
    expect((await admin.del(`${A}/conversations/${conv}`)).statusCode).toBe(204);
    expect(await n('vulnerabilites_assistant_reperes')).toBe(0);
    expect(await n('vulnerabilites_assistant_propositions')).toBe(0);
  });
});

describe('outils offerts', () => {
  const declares = async (a: Agent, profil = 'mise_en_oeuvre') => {
    modele.demandes = [];
    modele.etapes = [() => reponse('Réponse fictive.')];
    await demander(a, await ouvrir(a, profil), 'Quoi corriger en premier ?');
    return outilsDeclares(modele.demandes[0]!);
  };
  const NOUVEAUX = ['evaluer_cve', 'machines_prioritaires', 'failles_prioritaires', 'proposer_action_vulnerabilite'];

  it('le masque des machines est branché par les services : sans lui, l’assistant enverrait les demandes sans contrôle', () => {
    // Le masque n'est posé que si le service du module est branché sur l'assistant (services.ts). Ce test échoue si ce
    // branchement disparaît : l'assistant partirait alors sans masque et sans erreur (relecture du 16/11/2026).
    expect(t.svc.assistant.vulnerabilites).toBeDefined();
  });

  it('présents pour la mise en œuvre avec le droit de lecture du module, et la consigne qui va avec', async () => {
    const noms = await declares(rssiA);
    expect(noms).toEqual(expect.arrayContaining(NOUVEAUX));
    expect(modele.demandes[0]!.messages[0]!.content).toContain('Sommes-nous touchés');
  });

  it('absents sans le droit, avec le profil d’audit, et module désactivé', async () => {
    for (const noms of [await declares(sansVuln), await declares(rssiA, 'audit_interne')]) {
      expect(noms).toContain('lister_perimetres');
      for (const x of NOUVEAUX) expect(noms).not.toContain(x);
    }
    expect(modele.demandes[0]!.messages[0]!.content).not.toContain('Sommes-nous touchés');
    await t.svc.db.q("UPDATE module_activation SET disabled = '{vulnerabilites}', version = version + 1 WHERE id = 1");
    try {
      const noms = await declares(rssiA);
      for (const x of NOUVEAUX) expect(noms).not.toContain(x);
    } finally {
      await t.svc.db.q("UPDATE module_activation SET disabled = '{}', version = version + 1 WHERE id = 1");
    }
  });
});

describe('confidentialité : rien d’identifiant sur une machine ne part chez le fournisseur du modèle', () => {
  let conv: string;
  let propositionId: string;
  let action: string;
  const reperesTour1: Record<number, string | null> = {};

  it('tour 1 : évaluer une CVE, machines et failles prioritaires ; repères et intersection des droits', async () => {
    conv = await ouvrir(rssiA);
    modele.demandes = [];
    let evaluation: Record<string, unknown> = {};
    let toutes: { machinesDansLaPortee: number; machines: { repere: string; rang: number; faits: string[] }[] } = {
      machinesDansLaPortee: 0,
      machines: [],
    };
    modele.etapes = [
      () => appel('a1', 'evaluer_cve', { cve: CVE_TENABLE.toLowerCase() }),
      (d) => {
        evaluation = dernierOutil(d);
        return appel('a2', 'machines_prioritaires', { cve: CVE_TENABLE });
      },
      () => appel('a3', 'failles_prioritaires', { nombre: 5 }),
      (d) => {
        const f = dernierOutil<{ failles: { id: string }[] }>(d);
        return appel('a4', 'machines_prioritaires', { constat: f.failles[0]!.id });
      },
      () => appel('a5', 'machines_prioritaires', {}),
      () => appel('a6', 'evaluer_cve', { cve: 'CVE-2026-99999' }),
      (d) => {
        toutes = JSON.parse(d.messages.filter((m) => m.role === 'tool').at(-2)!.content!);
        const inconnue = dernierOutil(d);
        expect(inconnue).toMatchObject({ cve: 'CVE-2026-99999', connue: false });
        const r = toutes.machines.map((m) => m.repere);
        return reponse(
          `Sommes-nous touchés : oui, ${CVE_TENABLE} est détectée par Tenable et exploitée (catalogue KEV).\n` +
            `Quoi faire : appliquer le correctif publié.\nActifs à traiter d’abord : ${r.join(', ')}, puis M-777.\n` +
            'Plan d’action proposé : corriger, puis vérifier.',
        );
      },
    ];
    await demander(rssiA, conv, `Sommes-nous touchés par ${CVE_TENABLE} ?`);
    expect(modele.etapes).toHaveLength(0);
    // Évaluation : présence, sources avec dates, correctif de la source, repères des machines lisibles.
    expect(evaluation).toMatchObject({
      cve: CVE_TENABLE,
      connue: true,
      presence: { detecteeParTenable: true },
      priorite: { niveau: 'P1' },
      recommandations: { actionExigeeParLeCatalogueKev: 'Apply mitigations per vendor instructions.' },
    });
    const c = (evaluation.constats as Record<string, unknown>[])[0]!;
    expect(c).toMatchObject({
      id: constat1,
      controle: { numero: '960001' },
      correctifPublieParTenable: 'Upgrade the fictional package to 2.0 or later.',
      // Machines 1, 3 et 4 lisibles par la personne (périmètre Alpha) ; jamais la 2.
      machinesTouchees: 3,
    });
    expect((c.reperes as string[]).every((r) => /^M-\d{3}$/.test(r))).toBe(true);
    expect(evaluation.avis).toEqual([
      expect.objectContaining({ source: 'CERT-FR', identifiant: 'CERTFR-2026-ALE-091' }),
    ]);
    // Intersection des droits : la machine 2 (Bravo) n'a pas de repère et ne compte pas.
    expect(toutes.machinesDansLaPortee).toBe(3);
    expect(toutes.machines.map((m) => m.rang)).toEqual([1, 2, 3]);
    expect(await repereDe(conv, 2)).toBeNull();
    for (const k of [1, 3, 4]) reperesTour1[k] = await repereDe(conv, k);
    expect(Object.values(reperesTour1).every((r) => r !== null)).toBe(true);
    // Les faits du rang ne disent pas le rôle.
    expect(JSON.stringify(toutes)).not.toMatch(/Rôle|role/i);
    // Le texte gardé en base garde ses repères ; aucun nom.
    const stocke = (await t.svc.db.one<{ contenu: string }>(
      "SELECT contenu FROM assistant_messages WHERE conversation_id = $1 AND role = 'assistant'",
      [conv],
    ))!.contenu;
    expect(stocke).toContain(reperesTour1[1]!);
    sansIdentifiant(stocke, 'message gardé en base');
  });

  it('affichage : repère remplacé par le nom pour la personne, repère inventé non remplacé et signalé', async () => {
    const f = await fil(rssiA, conv);
    const m = f.messages.find((x) => x.role === 'assistant')!;
    expect(m.contenu).toContain(nomMachine(1));
    expect(m.contenu).toContain(nomMachine(3));
    // Machine sans nom : son adresse, lisible par la personne dans le module.
    expect(m.contenu).toContain(adresse(4));
    expect(m.contenu).toContain('M-777');
    expect(m.segments).toEqual(
      expect.arrayContaining([
        { repere: reperesTour1[1], machine: nomMachine(1) },
        { repere: 'M-777', etat: 'inconnu' },
      ]),
    );
    // Selon les droits de la personne qui regarde : la machine 3 passe dans un périmètre qu'elle ne lit pas.
    await t.svc.db.q('UPDATE vulnerabilites_machines SET perimetre_id = $2 WHERE id = $1', [idMachine[3], perimB]);
    try {
      const g = (await fil(rssiA, conv)).messages.find((x) => x.role === 'assistant')!;
      expect(g.contenu).not.toContain(nomMachine(3));
      expect(g.contenu).toContain(reperesTour1[3]!);
      expect(g.segments).toEqual(expect.arrayContaining([{ repere: reperesTour1[3], etat: 'non_lisible' }]));
    } finally {
      await t.svc.db.q('UPDATE vulnerabilites_machines SET perimetre_id = $2 WHERE id = $1', [idMachine[3], perimA]);
    }
  });

  it('tour 2 : nom tapé par la personne masqué, repères stables ; proposition contrôlée puis déposée', async () => {
    modele.demandes = [];
    let refus: { enregistre: boolean; detail: string } | null = null;
    modele.etapes = [
      () => appel('b1', 'evaluer_cve', { cve: CVE_TENABLE }),
      (d) => {
        // Stabilité : mêmes repères qu'au premier tour.
        const c = (dernierOutil(d).constats as { reperes: string[] }[])[0]!;
        expect(new Set(c.reperes)).toEqual(new Set([reperesTour1[1], reperesTour1[3], reperesTour1[4]]));
        return appel('b2', 'proposer_action_vulnerabilite', {
          nature: 'constat',
          faille: constat1,
          titre: `Corriger le contrôle 960001 sur ${reperesTour1[1]}`,
          description: `Appliquer le correctif publié par Tenable sur ${reperesTour1[1]}, puis sur ${reperesTour1[3]}.`,
          echeance: '2099-01-31',
          machines: [reperesTour1[1], reperesTour1[3]],
        });
      },
      () =>
        appel('b3', 'proposer_action_vulnerabilite', {
          nature: 'constat',
          faille: constat1,
          titre: 'Corriger une machine inventée',
          description: 'Appliquer le correctif sur M-555, une machine inventée.',
          machines: ['M-555'],
        }),
      (d) => {
        refus = dernierOutil(d);
        return reponse(`Plan d’action proposé : traiter ${reperesTour1[1]} puis ${reperesTour1[3]}.`);
      },
    ];
    // La personne tape le nom d'une machine qu'elle lit et l'adresse d'une machine qu'elle ne lit pas.
    await demander(rssiA, conv, `Et ${libelleMachine(1)}, ou la machine ${adresse(2)} ?`);
    expect(modele.etapes).toHaveLength(0);
    const question = modele.demandes[0]!.messages.filter((m) => m.role === 'user').at(-1)!.content!;
    expect(question).toContain(reperesTour1[1]!);
    expect(question).toContain('[machine]');
    expect(refus).toMatchObject({ enregistre: false });
    expect(refus!.detail).toContain('M-555');
    expect(await n('vulnerabilites_assistant_reperes', 'conversation_id = $1', [conv])).toBe(3);
    const l = await propositions(rssiA);
    expect(l).toHaveLength(1);
    const p = l[0]!;
    propositionId = p.id;
    // Gardée avec ses repères ; affichée avec les noms pour la personne.
    const brut = (await t.svc.db.one<{ titre: string; description: string; reperes: number[] }>(
      'SELECT titre, description, reperes FROM vulnerabilites_assistant_propositions WHERE id = $1',
      [p.id],
    ))!;
    expect(brut.titre).toContain(reperesTour1[1]!);
    sansIdentifiant(JSON.stringify(brut), 'proposition gardée en base');
    expect(p).toMatchObject({
      etat: 'en_attente',
      echeance: '2099-01-31',
      faille: { nature: 'constat', id: constat1 },
      titre: `Corriger le contrôle 960001 sur ${nomMachine(1)}`,
      machines: [
        { repere: reperesTour1[1], nom: nomMachine(1) },
        { repere: reperesTour1[3], nom: nomMachine(3) },
      ],
    });
    expect(p.description).toContain(nomMachine(3));
  });

  it('confirmation : noms à la place des repères, actifs touchés (V30), action liée à la faille, sans retour au modèle', async () => {
    const avant = modele.demandes.length;
    const r = await rssiA.post(`${A}/vulnerabilites/propositions/${propositionId}/decision`, {
      decision: 'confirmer',
      perimetreId: perimA,
      echeance: '2099-02-28',
      note: 'Confirmée pour l’essai.',
    });
    expect(r.statusCode, r.body).toBe(200);
    expect(r.json()).toMatchObject({ etat: 'confirmee', decidedBy: 'av_rssi_a' });
    action = r.json().actionId as string;
    expect(modele.demandes.length).toBe(avant);
    const a = (await t.svc.db.one<{ name: string; smsi_id: string; data: Record<string, string>; created_by: string }>(
      'SELECT name, smsi_id, data, created_by FROM grc_objects WHERE id = $1',
      [action],
    ))!;
    expect(a).toMatchObject({ smsi_id: perimA, created_by: 'av_rssi_a' });
    expect(a.name).toBe(`Corriger le contrôle 960001 sur ${nomMachine(1)}`);
    expect(a.data.dueAt).toBe('2099-02-28T12:00:00.000Z');
    expect(a.data.description).toContain(`sur ${nomMachine(1)}, puis sur ${nomMachine(3)}`);
    expect(a.data.description).toContain(`Machines concernées par cette action : ${nomMachine(1)}, ${nomMachine(3)}.`);
    // V30 : machines touchées lisibles par rang (la 2 n'est pas lisible), machine sans nom comptée, application touchée.
    expect(a.data.description).toMatch(
      /Machines touchées : srv-av-0[13]\.exemple\.invalid, srv-av-0[13]\.exemple\.invalid et 1 machine sans nom/,
    );
    expect(a.data.description).toContain('Application touchée : Produit fictif : contrôle 960001.');
    expect(a.data.description).not.toContain(nomMachine(2));
    for (const k of [1, 2, 3, 4]) expect(JSON.stringify(a)).not.toContain(adresse(k));
    expect(a.data.description).not.toMatch(/M-\d{3}/);
    expect(a.data.justification).toBe(
      'Créée depuis le module Vulnérabilités (contrôle n° 960001 de Tenable Security Center). Proposée par l’assistant RSSI, confirmée par Nom av_rssi_a.',
    );
    // Liée à la faille par la mécanique du lot V4b : « nouvelle » passe « à traiter ».
    expect(
      await n(
        'vulnerabilites_suivi_actions sa JOIN vulnerabilites_suivis s ON s.id = sa.suivi_id',
        's.constat_id = $1 AND sa.action_id = $2 AND sa.cree_ici',
        [constat1, action],
      ),
    ).toBe(1);
    expect((await rssiA.get(`${V}/suivis/constat/${constat1}`)).json()).toMatchObject({
      etat: 'a_traiter',
      nombreActions: 1,
    });
    // Déjà décidée.
    expect(
      (await rssiA.post(`${A}/vulnerabilites/propositions/${propositionId}/decision`, { decision: 'rejeter' }))
        .statusCode,
    ).toBe(409);
  });

  it('tour 3 : l’action relue par les outils généraux part masquée ; aucune requête ne contient d’identifiant', async () => {
    let lue = '';
    modele.etapes = [
      () => appel('c1', 'lire_element', { perimetre: perimA, id: action }),
      (d) => {
        lue = d.messages.filter((m) => m.role === 'tool').at(-1)!.content!;
        return appel('c2', 'lister_elements', { perimetre: perimA, type: 'action' });
      },
      () => reponse('L’action est créée.'),
    ];
    await demander(rssiA, conv, 'Relis l’action créée.');
    expect(modele.etapes).toHaveLength(0);
    // La description nomme les machines en base ; dans la requête, ce sont des repères ou « [machine] ».
    expect(lue).toContain(reperesTour1[1]!);
    expect(lue).toContain('Application touchée');
    // Pièce maîtresse : toutes les requêtes de tous les tours.
    expect(modele.demandes.length).toBeGreaterThanOrEqual(3);
    const tout = JSON.stringify(modele.demandes);
    sansIdentifiant(tout, 'requêtes au modèle');
    expect(tout).toContain(reperesTour1[1]!);
  });

  it('journal d’audit : outils et nombres, aucun nom, adresse ni repère', async () => {
    const { rows } = await t.svc.db.q<{ action: string; details: unknown }>(
      "SELECT action, details FROM audit_log WHERE action LIKE 'assistant.%' OR action LIKE 'vulnerabilites.suivi.%'",
    );
    const message = rows.filter((r) => r.action === 'assistant.message');
    expect(JSON.stringify(message)).toContain('evaluer_cve');
    expect(rows.map((r) => r.action)).toEqual(
      expect.arrayContaining([
        'assistant.vulnerabilites.proposition_deposee',
        'assistant.vulnerabilites.proposition_decidee',
        'vulnerabilites.suivi.action_creee',
      ]),
    );
    const j = JSON.stringify(rows);
    sansIdentifiant(j, 'journal');
    expect(j).not.toMatch(/M-\d{3}/);
    expect(rows.find((r) => r.action === 'vulnerabilites.suivi.action_creee')!.details).toMatchObject({
      origine: 'assistant',
      proposition: propositionId,
    });
  });

  it('rejet : pas de redépôt à l’identique ; une nouvelle proposition sur la même faille remplace la précédente', async () => {
    const deposer = (titre: string) =>
      appel('d' + titre.length, 'proposer_action_vulnerabilite', {
        nature: 'declaree',
        faille: rapprochement,
        titre,
        description: `Mettre à jour le produit fictif sur ${reperesTour1[3]}.`,
        machines: [],
      });
    const resultats: { enregistre: boolean; detail: string }[] = [];
    const garder = (d: DemandeModele) => {
      resultats.push(dernierOutil(d));
    };
    modele.etapes = [
      () => deposer('Mettre à jour le produit fictif'),
      (d) => {
        garder(d);
        return reponse('Déposée.');
      },
    ];
    await demander(rssiA, conv, `Que faire pour ${CVE_DECLAREE} ?`);
    const p1 = (await propositions(rssiA)).find((x) => x.etat === 'en_attente')!;
    expect(p1.faille).toMatchObject({ nature: 'declaree', libelle: `Faille déclarée ${CVE_DECLAREE}` });
    const rj = await rssiA.post(`${A}/vulnerabilites/propositions/${p1.id}/decision`, {
      decision: 'rejeter',
      note: 'Hors sujet pour l’essai.',
    });
    expect(rj.statusCode, rj.body).toBe(200);
    expect(rj.json()).toMatchObject({ etat: 'rejetee', actionId: null, decisionNote: 'Hors sujet pour l’essai.' });
    modele.etapes = [
      () => deposer('Mettre à jour le produit fictif'),
      (d) => {
        garder(d);
        return deposer('Mettre à jour le produit fictif en 2.0');
      },
      (d) => {
        garder(d);
        return deposer('Mettre à jour le produit fictif en 2.1');
      },
      (d) => {
        garder(d);
        return reponse('Déposées.');
      },
    ];
    await demander(rssiA, conv, 'Propose autre chose.');
    expect(resultats.map((r) => r.enregistre)).toEqual([true, false, true, true]);
    expect(resultats[1]!.detail).toContain('déjà été rejetée');
    const l = (await propositions(rssiA)).filter((x) => x.faille.nature === 'declaree');
    expect(l.map((x) => [x.titre, x.etat]).sort()).toEqual(
      [
        ['Mettre à jour le produit fictif', 'rejetee'],
        ['Mettre à jour le produit fictif en 2.0', 'retiree'],
        ['Mettre à jour le produit fictif en 2.1', 'en_attente'],
      ].sort(),
    );
    // Corrigée par la personne à la confirmation : son texte remplace celui du modèle ; actifs touchés de la faille déclarée.
    const ok = await rssiA.post(
      `${A}/vulnerabilites/propositions/${l.find((x) => x.etat === 'en_attente')!.id}/decision`,
      {
        decision: 'confirmer',
        perimetreId: perimA,
        titre: 'Mettre à jour le produit fictif AV',
        description: `Version 2.0 au moins, d’abord sur ${reperesTour1[3]}.`,
      },
    );
    expect(ok.statusCode, ok.body).toBe(200);
    const a = (await t.svc.db.one<{ name: string; data: Record<string, string> }>(
      'SELECT name, data FROM grc_objects WHERE id = $1',
      [ok.json().actionId],
    ))!;
    expect(a.name).toBe('Mettre à jour le produit fictif AV');
    expect(a.data.description).toContain(`d’abord sur ${nomMachine(3)}.`);
    expect(a.data.description).toContain(`Machine touchée : ${nomMachine(3)}.`);
    expect(a.data.description).toContain('Application touchée : Éditeur fictif AV Produit fictif AV 1.5.');
    expect(a.data.dueAt).toBeNull();
  });
});

describe('refus sans les droits de la cible', () => {
  /** Dépose, dans une conversation de la personne, une proposition sur un constat ; rend son identifiant. */
  const proposer = async (a: Agent, faille: string) => {
    const conv = await ouvrir(a);
    modele.etapes = [
      () => appel('e1', 'machines_prioritaires', { constat: faille }),
      (d) => {
        const r = dernierOutil<{ machines: { repere: string }[] }>(d).machines.map((m) => m.repere);
        return appel('e2', 'proposer_action_vulnerabilite', {
          nature: 'constat',
          faille,
          titre: 'Corriger le contrôle fictif',
          description: 'Appliquer le correctif publié par Tenable.',
          machines: r,
        });
      },
      (d) => {
        expect(dernierOutil(d)).toMatchObject({ enregistre: true });
        return reponse('Déposée.');
      },
    ];
    await demander(a, conv, 'Propose une action.');
    return (await propositions(a)).find((x) => x.etat === 'en_attente' && x.faille.id === faille)!.id;
  };
  const confirmer = (a: Agent, id: string) =>
    a.post(`${A}/vulnerabilites/propositions/${id}/decision`, { decision: 'confirmer', perimetreId: perimA });

  it('sans le droit du registre des actions, sans le droit de modifier les vulnérabilités, ou machines non lisibles', async () => {
    const actions = await n('grc_objects', "kind = 'action'");
    const p1 = await proposer(sansRegistre, constat1);
    expect((await confirmer(sansRegistre, p1)).statusCode).toBe(403);
    const p2 = await proposer(lecteurVuln, constat1);
    const r2 = await confirmer(lecteurVuln, p2);
    expect(r2.statusCode).toBe(403);
    expect(r2.json().error).toContain('modifier les vulnérabilités');
    // Règle du lot V4b : le constat 960002 touche la machine 2, que la personne ne lit pas.
    const p3 = await proposer(rssiA, constat2);
    const r3 = await confirmer(rssiA, p3);
    expect(r3.statusCode).toBe(403);
    expect(r3.json().error).toMatch(/machines que vous ne pouvez pas lire/);
    // Sans périmètre choisi : refus de validation.
    expect(
      (await rssiA.post(`${A}/vulnerabilites/propositions/${p3}/decision`, { decision: 'confirmer' })).statusCode,
    ).toBe(422);
    expect(await n('grc_objects', "kind = 'action'")).toBe(actions);
    for (const id of [p1, p2, p3])
      expect(
        (await t.svc.db.one<{ etat: string }>('SELECT etat FROM vulnerabilites_assistant_propositions WHERE id = $1', [
          id,
        ]))!.etat,
      ).toBe('en_attente');
    // La proposition d'une autre personne est introuvable, y compris pour qui ne lit pas les vulnérabilités.
    expect((await confirmer(rssiA, p1)).statusCode).toBe(404);
    expect(
      (await sansVuln.post(`${A}/vulnerabilites/propositions/${p1}/decision`, { decision: 'rejeter' })).statusCode,
    ).toBe(404);
  });
});

describe('masque en ronde et action créée depuis la fiche (V30)', () => {
  it('en ronde, aucune machine n’a de repère : « [machine] »', async () => {
    const masquer = await t.svc.assistant.vulnerabilites!.masque(await sessionUser(t, adminUser), null);
    expect(
      await masquer(
        `Corriger ${nomMachine(1)} (${adresse(1)}) et ${libelleMachine(2)}:443 puis uuid:${uuidMachine(3)}.`,
      ),
    ).toBe('Corriger [machine] ([machine]) et [machine] puis [machine].');
  });

  it('création depuis la fiche : noms des machines lisibles et application, journal sans nom', async () => {
    const constat3 = (await t.svc.db.one<{ id: string }>(
      'SELECT id FROM vulnerabilites_constats WHERE plugin_id = 960003',
    ))!.id;
    const s = (await rssiA.get(`${V}/suivis/constat/${constat3}`)).json();
    expect(s.actifsAction).toContain(`Machine touchée : ${nomMachine(3)}.`);
    expect(s.actifsAction).toContain('Application touchée : Produit fictif : contrôle 960003.');
    const r = await rssiA.post(
      `${V}/suivis/constat/${constat3}/actions`,
      { perimetreId: perimA, titre: s.preremplissage.titre, description: s.preremplissage.description, echeance: null },
      ifMatch(s.version),
    );
    expect(r.statusCode, r.body).toBe(201);
    const a = (await t.svc.db.one<{ data: Record<string, string> }>(
      `SELECT o.data FROM grc_objects o JOIN vulnerabilites_suivi_actions sa ON sa.action_id = o.id
       JOIN vulnerabilites_suivis su ON su.id = sa.suivi_id WHERE su.constat_id = $1`,
      [constat3],
    ))!;
    expect(a.data.description).toContain('Upgrade the fictional package to 2.0 or later.');
    expect(String(a.data.description).endsWith(s.actifsAction)).toBe(true);
    expect(a.data.description).not.toContain(adresse(3));
    const j = await t.svc.db.q("SELECT details FROM audit_log WHERE action = 'vulnerabilites.suivi.action_creee'");
    sansIdentifiant(JSON.stringify(j.rows), 'journal du suivi');
  });
});
