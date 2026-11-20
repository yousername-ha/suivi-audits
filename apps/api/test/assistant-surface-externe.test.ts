/* Assistant RSSI et surface externe (ADR 0100, lot ALH2, décision C du RSSI du 17/11/2026). Un faux transport de modèle
   enregistre toutes les requêtes émises : sur une conversation qui évalue une CVE vue par AlgoLightHouse, aucune requête ne
   contient un domaine, une adresse, un nom de périmètre (de l'éditeur ou de la plateforme), un FAI ni un numéro d'AS ; les
   actifs exposés n'y sont que des repères « E-001 », stables, remplacés à l'affichage selon les droits de la personne qui
   regarde ; les recommandations de l'éditeur partent masquées. Le masque couvre les domaines et adresses d'AlgoLightHouse
   (sous-domaines compris), même en ronde : un test échoue s'il n'y est plus branché. Faux modèle seulement, aucun service
   joint. Données entièrement fictives : domaines en .example, adresses de 192.0.2.0/24 et 198.51.100.0/24, CVE fictives.
   Lot ALH5 (décision A) : la priorité d'une CVE est la même pour qui ne lit pas les actifs exposés ; l'exposition lui est
   dite par un oui, sans repère, nom ni nombre. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ConversationAssistantDetailDto } from '@suivi/shared';
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

const A = '/api/assistant';
const SYSTEME = { username: 'test' };
const ADRESSE_MODELE = 'https://modele.example.invalid/v1';
const CVE = 'CVE-2026-92001';
const U = (n: number) => `0190a000-0000-7000-8000-${String(n).padStart(12, '0')}`;
const DOMAINE = 'www.exemple-fictif.example';
const SOUS_DOMAINE = 'api.www.exemple-fictif.example';
const IP_A = '192.0.2.10';
const IP_B = '198.51.100.20';
const RESOLUTION = '192.0.2.77';
const FAI = 'FAI fictif ALH';
const AS = '64511';
const PERIM_ALH_A = 'Périmètre ALH fictif Alpha';
const PERIM_ALH_B = 'Périmètre ALH fictif Bravo';
const NOM_A = 'Périmètre surface Alpha';
const NOM_B = 'Périmètre surface Bravo';

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
const dernierOutil = <T = Record<string, unknown>>(d: DemandeModele): T =>
  JSON.parse([...d.messages].reverse().find((x) => x.role === 'tool')?.content ?? 'null') as T;

/** Espace fictif : hôtes A (périmètre ALH Alpha) et B (Bravo), domaine dans Alpha ; nginx 1.18.0 sur l'hôte A et le
    domaine (CVE 92001), 1.20.0 sur l'hôte B (CVE 92003) ; alerte ouverte sur l'hôte A, qui cite 92001 et dont les
    recommandations citent le domaine, l'adresse et un sous-domaine. */
const espace = () => {
  const hote = (n: number, perim: number, adresse: string) => ({
    type: 'hote',
    id: U(n),
    perimetre: U(perim),
    statut: 'monitored',
    adresse,
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
    cvss: 9.8,
    epss: 0.42,
    severite: 'critical',
    preuve: true,
    exploitee: true,
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
      criticite: 'critical',
      statut: 'untreated',
      titre: `Nginx vulnérable sur ${DOMAINE}`,
      verifiee: true,
      detail: true,
      cibleType: 'host',
      cibleValeur: IP_A,
      cibleHote: U(11),
      cibleDomaine: null,
      cves: [CVE],
      defauts: [
        {
          nom: 'Composant vulnérable',
          description: `Le service de ${DOMAINE} (${IP_A}) répond aussi sur ${SOUS_DOMAINE}.`,
          resolutions: [
            {
              nom: 'Mettre à jour nginx',
              description: `Mettre à jour le serveur ${IP_A} puis retester ${DOMAINE}.`,
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
    cve('1.18.0', CVE),
    cve('1.20.0', 'CVE-2026-92003'),
  ];
};

let t: TestApp;
let modele: FauxModele;
let adminUser: TestUser, lecteurAUser: TestUser;
let lecteurA: Agent, lecteurB: Agent;

/** Aucune valeur identifiante de la surface externe ni nom de périmètre. */
function sansIdentifiant(texte: string, contexte: string) {
  for (const x of [
    DOMAINE,
    'exemple-fictif.example',
    IP_A,
    IP_B,
    RESOLUTION,
    FAI,
    AS,
    PERIM_ALH_A,
    PERIM_ALH_B,
    NOM_A,
    NOM_B,
  ])
    expect(texte, `${contexte} : ${x}`).not.toContain(x);
}
const ouvrir = async (a: Agent) => {
  const r = await a.post(`${A}/conversations`, { profil: 'mise_en_oeuvre' });
  expect(r.statusCode, r.body).toBe(201);
  return r.json().id as string;
};
const demander = async (a: Agent, conversation: string, texte: string) => {
  const r = await a.post(`${A}/conversations/${conversation}/messages`, { texte });
  expect(r.statusCode, r.body).toBe(202);
  await t.svc.assistant.attendre(conversation);
};

beforeAll(async () => {
  modele = new FauxModele();
  t = await createTestApp({}, { modele });
  await ouvrirFlux(t, 'assistant');
  await appliquerFlux(t, 'assistant');
  adminUser = await makeUser(t, 'ase_admin', 'admin');
  const admin = await login(t, adminUser);
  expect((await admin.put(`${A}/reglages/cle`, { cle: 'cle-fictive-de-test-0123456789' })).statusCode).toBe(204);
  await t.svc.db.q(
    "UPDATE assistant_reglages SET actif = true, adresse = $1, modele = 'modele-fictif', budget_jetons_jour = 10000000",
    [ADRESSE_MODELE],
  );
  await t.svc.db.q('UPDATE assistant_profils SET actif = true, tous_perimetres = true, documents = false');
  await t.svc.db.q(
    `INSERT INTO roles(id, name, permissions) VALUES ('r_ase_lecteur', 'Assistant et surface externe',
       ARRAY['assistant:lire','assistant:modifier','vulnerabilites:lire','ecarts:lire'])`,
  );
  const perimetre = async (name: string) =>
    (await admin.post('/api/grc/smsis', { name, scope: 'Périmètre fictif', timezone: 'Europe/Paris' })).json()
      .id as string;
  const perimA = await perimetre(NOM_A);
  const perimB = await perimetre(NOM_B);
  lecteurAUser = await makeUser(t, 'ase_lecteur_a', 'r_ase_lecteur', { rattache: false });
  const uB = await makeUser(t, 'ase_lecteur_b', 'r_ase_lecteur', { rattache: false });
  await t.svc.db.q('INSERT INTO grc_members(smsi_id, user_id, can_write) VALUES ($1, $2, false), ($3, $4, false)', [
    perimA,
    lecteurAUser.id,
    perimB,
    uB.id,
  ]);
  lecteurA = await login(t, lecteurAUser);
  lecteurB = await login(t, uB);

  // Instance AlgoLightHouse fictive, synchronisée par le service ; périmètres reliés.
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

describe('masque de sortie et surface externe', () => {
  it('le masque est branché sur les domaines et adresses d’AlgoLightHouse : en ronde, « [actif externe] »', async () => {
    // Ce test échoue si le service de l'assistant ne reçoit plus la surface externe (services.ts) : les domaines et
    // adresses d'AlgoLightHouse, absents de l'inventaire des machines, partiraient alors sans masque.
    const masquer = await t.svc.assistant.vulnerabilites!.masque(await sessionUser(t, adminUser), null);
    expect(
      await masquer(
        `Voir ${DOMAINE.toUpperCase()}, https://${SOUS_DOMAINE}/login, ${IP_A}:443, ${IP_B}, ${RESOLUTION} et *.exemple-fictif.example.`,
      ),
    ).toBe(
      'Voir [actif externe], https://[actif externe]/login, [actif externe], [actif externe], [actif externe] et *.exemple-fictif.example.',
    );
    // Fournisseur d'accès et numéro d'AS d'un hôte : masqués aussi.
    expect(await masquer(`Hébergé chez ${FAI}, AS${AS} (${AS}).`)).toBe(
      'Hébergé chez [réseau externe], [réseau externe] ([réseau externe]).',
    );
    // Un domaine voisin, inconnu de la surface externe, n'est pas un actif : il passe.
    expect(await masquer('Voir autre.example.')).toBe('Voir autre.example.');
  });
});

describe('évaluer une CVE exposée sur Internet (décision C)', () => {
  let conv: string;
  let evaluation: Record<string, unknown> = {};

  it('repères « E-… », compteurs et recommandations ; aucune requête ne contient domaine, adresse, périmètre, FAI ni AS', async () => {
    conv = await ouvrir(lecteurA);
    modele.demandes = [];
    modele.etapes = [
      () => appel('e1', 'evaluer_cve', { cve: CVE }),
      (d) => {
        evaluation = dernierOutil(d);
        const s = evaluation.surfaceExterne as { reperes: string[] };
        return {
          role: 'assistant',
          content: `Sommes-nous touchés : oui, exposée sur Internet.\nActifs à traiter d’abord : ${s.reperes.join(', ')}, puis E-777.`,
        };
      },
    ];
    await demander(
      lecteurA,
      conv,
      `Sommes-nous touchés par ${CVE} ? Notre site ${DOMAINE} (${IP_A}, chez ${FAI}, AS${AS}) est-il concerné ?`,
    );
    expect(modele.etapes).toHaveLength(0);
    expect(evaluation).toMatchObject({
      cve: CVE,
      connue: true,
      connueDeLaVeille: false,
      presence: { exposeeSurInternet: true, detecteeParTenable: false },
      priorite: { niveau: 'P1' },
    });
    const s = evaluation.surfaceExterne as {
      actifsExposes: number;
      reperes: string[];
      technologies: { nom: string; versions: string[]; selonAlgoLightHouse: { exploitee: boolean } }[];
      alertes: { criticite: string; titre: string; recommandationsDeLEditeur: { description: string }[] }[];
    };
    // Lecteur du périmètre Alpha : l'hôte A et le domaine ; jamais l'hôte B (Bravo) ni sa version.
    expect(s.actifsExposes).toBe(2);
    expect(s.reperes).toEqual(['E-001', 'E-002']);
    expect(s.technologies).toEqual([
      expect.objectContaining({
        nom: 'nginx',
        versions: ['1.18.0'],
        selonAlgoLightHouse: expect.objectContaining({ exploitee: true }),
      }),
    ]);
    expect(s.alertes[0]).toMatchObject({ criticite: 'Critique' });
    // Lot ASSISTANT-V1 : les recommandations de l'éditeur sont dans « Quoi faire », avec leur source, plus dans les alertes.
    expect(evaluation.quoiFaire).toMatchObject({
      algoLightHouse: {
        source: 'AlgoLightHouse (recommandations de l’éditeur de la surface externe)',
        recommandations: [
          {
            defauts: [
              expect.objectContaining({
                defaut: 'Composant vulnérable',
                resolutions: [expect.objectContaining({ resolution: 'Mettre à jour nginx' })],
              }),
            ],
          },
        ],
      },
    });
    expect(evaluation.quoiFaire).not.toHaveProperty('correctif');
    expect(s.alertes[0]).not.toHaveProperty('recommandationsDeLEditeur');
    // Le résultat d'outil est rendu en clair au service ; c'est le masque qui le relit avant l'envoi.
    const tout = JSON.stringify(modele.demandes);
    sansIdentifiant(tout, 'requêtes au modèle');
    expect(tout).not.toContain('192.0.2.');
    expect(tout).not.toContain('198.51.100.');
    // Recommandation de l'éditeur : partie, avec les repères à la place du domaine et de l'adresse.
    expect(tout).toMatch(/Mettre à jour le serveur E-00\d puis retester E-00\d/);
    // Un sous-domaine d'un domaine connu désigne cet actif : même repère.
    expect(tout).toMatch(/répond aussi sur E-00\d\./);
    // Texte gardé en base avec ses repères.
    const stocke = (await t.svc.db.one<{ contenu: string }>(
      "SELECT contenu FROM assistant_messages WHERE conversation_id = $1 AND role = 'assistant'",
      [conv],
    ))!.contenu;
    expect(stocke).toContain('E-001');
    sansIdentifiant(stocke, 'message gardé en base');
    // Journal sans domaine ni adresse.
    sansIdentifiant(JSON.stringify((await t.svc.db.q('SELECT details FROM audit_log')).rows), 'journal');
  });

  it('affichage : repère remplacé par le domaine ou l’adresse pour qui lit l’actif ; inventé : signalé', async () => {
    const f = (await lecteurA.get(`${A}/conversations/${conv}`)).json() as ConversationAssistantDetailDto;
    const m = f.messages.find((x) => x.role === 'assistant')!;
    const valeurs = (m.segments ?? []).flatMap((x) => ('machine' in x ? [x.machine] : []));
    expect(valeurs.sort()).toEqual([DOMAINE, IP_A].sort());
    expect(m.segments).toEqual(expect.arrayContaining([{ repere: 'E-777', etat: 'inconnu' }]));
    // Après déliaison du périmètre Alpha, le lecteur ne lit plus ces actifs : les repères restent.
    await t.svc.db.q('UPDATE vulnerabilites_alh_perimetres SET perimetre_id = NULL WHERE alh_id = $1', [U(1)]);
    try {
      const g = (
        (await lecteurA.get(`${A}/conversations/${conv}`)).json() as ConversationAssistantDetailDto
      ).messages.find((x) => x.role === 'assistant')!;
      expect(g.contenu).not.toContain(DOMAINE);
      expect(g.segments).toEqual(expect.arrayContaining([{ repere: 'E-001', etat: 'non_lisible' }]));
    } finally {
      await t.svc.db.q(
        'UPDATE vulnerabilites_alh_perimetres SET perimetre_id = (SELECT id FROM grc_smsis WHERE name = $2) WHERE alh_id = $1',
        [U(1), NOM_A],
      );
    }
  });

  it('pour qui ne lit pas ces actifs : même priorité (lot ALH5), exposition dite sans repère, nom ni nombre', async () => {
    const evaluer = async (a: Agent) => {
      const c = await ouvrir(a);
      let r: Record<string, unknown> = {};
      modele.etapes = [
        () => appel('e2', 'evaluer_cve', { cve: CVE }),
        (d) => ((r = dernierOutil(d)), { role: 'assistant', content: 'ok' }),
      ];
      await demander(a, c, `Et ${CVE} ?`);
      return r as {
        connue: boolean;
        priorite: unknown;
        presence: Record<string, unknown>;
        surfaceExterne: Record<string, unknown>;
      };
    };
    const rA = await evaluer(lecteurA);
    const rB = await evaluer(lecteurB);
    // Décision A : la priorité et les faits sont les mêmes pour tout le monde.
    expect(rB).toMatchObject({ cve: CVE, connue: true });
    expect(rB.priorite).toEqual(rA.priorite);
    expect(rB.presence).toMatchObject({ exposeeSurInternet: true });
    // Le détail reste limité à ce que la personne lit : aucun actif, aucune technologie, aucune alerte, aucun repère.
    expect(rB.surfaceExterne).toMatchObject({
      exposeeSurInternet: true,
      aussiHorsDeVosDroits: true,
      actifsExposes: 0,
      reperes: [],
      technologies: [],
      alertesOuvertes: 0,
    });
    const texte = JSON.stringify(rB);
    for (const x of [DOMAINE, SOUS_DOMAINE, IP_A, RESOLUTION, FAI, NOM_A, PERIM_ALH_A, 'E-0'])
      expect(texte, x).not.toContain(x);
  });
});
