/* Jeu de données de test, entièrement fictif et cohérent : une petite organisation avec ses processus, objectifs,
   indicateurs (atteints, non atteints, non mesurés, calculés, satisfaction), parties intéressées, fournisseurs évalués,
   écarts, plans d'audit, une revue de direction, un référentiel de démonstration, une méthode de risque, des risques
   appréciés, des actions, une série récurrente et des opportunités reliés entre eux. Aucun texte normatif, aucun nom réel.
   Chargé uniquement à la demande (`suivi jeu-de-test`), jamais automatiquement, et refusé sur une instance qui contient
   déjà des données de pilotage : les données de départ restent vides. Toutes les écritures passent par l'API publique
   (mêmes validations que l'interface). Les dates sont relatives au jour du chargement : retards et échéances à venir
   existent toujours. */
import crypto from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { methodTemplate } from '@suivi/shared';
import type { JsonObject } from '@suivi/shared/legacy';
import type { Services } from './services.js';

export const ORGANISATION_TEST = 'Association Fictive de Santé (jeu de test)';
type Json = Record<string, unknown>;

const decaler = (jours: number) => new Date(Date.now() + jours * 86400e3).toISOString().slice(0, 10);

/** État historique du jeu de test (objets de l'outil de suivi). Pur : testable sans base. */
export function etatJeuDeTest(): Json {
  const aujourdhui = decaler(0);
  const annee = new Date().getFullYear();
  return {
    scope: {
      organisation: ORGANISATION_TEST,
      text: 'Activités d’accueil, de prise en charge et de gestion des dossiers de l’association fictive.',
      interfaces: 'Prestataires informatiques, autorité de tutelle fictive, établissements partenaires fictifs.',
      issues:
        'Évolution de la législation sur les données de santé\nMenace cyber sur les dossiers\nCompétences internes en sécurité\nDépendance à un hébergeur unique',
      exclusions: 'Aucune exclusion déclarée dans ce jeu de test.',
    },
    processes: [
      {
        id: 'PR1',
        name: 'Pilotage de l’association',
        family: 'Management',
        owner: 'Direction',
        purpose: 'Définir les orientations et les moyens.',
      },
      {
        id: 'PR2',
        name: 'Accueil et prise en charge',
        family: 'Réalisation',
        owner: 'Responsable accueil',
        purpose: 'Accueillir et accompagner les personnes.',
        inputs: 'Demandes d’admission',
        outputs: 'Dossiers ouverts et suivis',
        sequence: 'Après le pilotage, avant la facturation',
        controlCriteria: 'Délai de première réponse ; satisfaction des usagers',
        resources: 'Équipe d’accueil, logiciel de dossiers',
        evaluation: 'Revue trimestrielle du processus',
      },
      {
        id: 'PR3',
        name: 'Achats et prestataires',
        family: 'Support',
        owner: 'Responsable achats',
        purpose: 'Choisir et suivre les prestataires externes.',
      },
      {
        id: 'PR4',
        name: 'Systèmes d’information',
        family: 'Support',
        owner: 'RSI',
        purpose: 'Exploiter et protéger les systèmes.',
      },
      {
        id: 'PR5',
        name: 'Amélioration continue',
        family: 'Management',
        owner: 'Responsable qualité',
        purpose: 'Traiter écarts, audits et revues.',
      },
      { id: 'PR6', name: 'Gestion documentaire', family: 'Support', owner: 'Assistante de direction', purpose: '' },
    ],
    objectives: [
      {
        id: 'OBJ1',
        name: 'Garantir la satisfaction des usagers',
        due: `${annee}-12-31`,
        owner: 'Responsable accueil',
        processes: ['PR2'],
        enjeux: ['Attentes des usagers : qualité d’accueil'],
      },
      {
        id: 'OBJ2',
        name: 'Maîtriser les accès aux systèmes',
        due: `${annee}-12-31`,
        owner: 'RSI',
        processes: ['PR4', 'PR3'],
        enjeux: ['Menace cyber : comptes compromis', 'Législation données de santé : exigences d’accès'],
      },
      {
        id: 'OBJ3',
        name: 'Réduire les écarts d’audit',
        due: `${annee + 1}-06-30`,
        owner: 'Responsable qualité',
        processes: ['PR5'],
        enjeux: [],
      },
      {
        id: 'OBJ4',
        name: 'Formaliser la gouvernance',
        due: `${annee + 1}-03-31`,
        owner: 'Direction',
        processes: [],
        enjeux: [],
      },
    ],
    indicators: [
      {
        id: 'IND1',
        obj: 'OBJ1',
        name: 'Taux de satisfaction des usagers',
        category: 'satisfaction',
        source: 'Enquête annuelle fictive',
        dir: '≥',
        target: 0.85,
        owner: 'Responsable accueil',
        freq: 'Annuelle',
        values: [
          { date: `${annee - 1}-12-15`, v: 0.78, hist: `${annee - 1}`, note: 'Année précédente' },
          { date: `${annee}-06-30`, v: 0.88, note: 'Enquête' },
        ],
      },
      {
        id: 'IND2',
        obj: 'OBJ1',
        name: 'Délai moyen de première réponse (jours)',
        dir: '≤',
        target: 3,
        owner: 'Responsable accueil',
        freq: 'Mensuelle',
        values: [
          { date: `${annee}-03-31`, v: 4 },
          { date: `${annee}-06-30`, v: 5 },
        ],
      },
      { id: 'IND3', obj: 'OBJ2', name: 'Services SaaS avec MFA', calc: 'saasMfa', dir: '≥', target: 0.9, values: [] },
      { id: 'IND4', obj: 'OBJ2', name: 'Services SaaS avec SSO', calc: 'saasSso', dir: '≥', target: 0.9, values: [] },
      {
        id: 'IND5',
        obj: 'OBJ2',
        name: 'Comptes revus dans l’année',
        dir: '≥',
        target: 1,
        values: [{ date: `${annee}-05-15`, v: 1 }],
      },
      {
        id: 'IND6',
        obj: 'OBJ3',
        name: 'Écarts majeurs ouverts',
        calc: 'interneNcMajOpen',
        dir: '≤',
        target: 0,
        values: [],
      },
      { id: 'IND7', obj: 'OBJ3', name: 'Délai moyen de clôture des écarts (jours)', dir: '≤', target: 60, values: [] },
      { id: 'IND8', obj: 'OBJ4', name: 'Politiques revues dans l’année', dir: '', target: '', values: [] },
    ],
    interested: [
      {
        id: 'PI1',
        name: 'Usagers',
        type: 'Externe',
        cat: 'Patient ou usager',
        needs: 'Accueil de qualité, confidentialité',
        req: 'Respect de la vie privée',
        addressed: 'Oui',
        how: 'Charte d’accueil',
        owner: 'Responsable accueil',
        reviewed: decaler(-120),
      },
      {
        id: 'PI2',
        name: 'Autorité de tutelle fictive',
        type: 'Externe',
        cat: 'Autorité ou régulateur',
        needs: 'Conformité réglementaire',
        req: 'Déclarations annuelles',
        addressed: 'Partiel',
        how: 'Suivi des déclarations',
        owner: 'Direction',
        reviewed: decaler(-500),
      },
      {
        id: 'PI3',
        name: 'Personnel',
        type: 'Interne',
        cat: 'Personnel',
        needs: 'Outils fiables, formation',
        req: '',
        addressed: 'Oui',
        how: 'Plan de formation',
        owner: 'Direction',
        reviewed: decaler(-60),
      },
      {
        id: 'PI4',
        name: 'Établissements partenaires',
        type: 'Externe',
        cat: 'Partenaire',
        needs: 'Échanges sécurisés',
        req: 'Clauses de confidentialité',
        addressed: 'Non',
        how: '',
        owner: 'Responsable achats',
        reviewed: '',
      },
      {
        id: 'PI5',
        name: 'Hébergeur de données fictif',
        type: 'Externe',
        cat: 'Fournisseur ou prestataire',
        needs: 'Contrat à jour',
        req: 'Certificat valide',
        addressed: 'Oui',
        how: 'Suivi du certificat',
        owner: 'RSI',
        reviewed: decaler(-30),
      },
      {
        id: 'PI6',
        name: 'Conseil d’administration',
        type: 'Interne',
        cat: 'Instance de gouvernance',
        needs: 'Tableaux de bord',
        req: '',
        addressed: 'Oui',
        how: 'Revue de direction',
        owner: 'Direction',
        reviewed: decaler(-90),
      },
    ],
    swots: [
      {
        id: 'SW1',
        process: 'PR2',
        date: decaler(-45),
        author: 'Responsable accueil',
        version: '1',
        S: [{ text: 'Équipe stable' }],
        W: [{ text: 'Charge de travail en pointe' }],
        O: [{ text: 'Téléconsultation fictive' }],
        T: [{ text: 'Évolution des exigences réglementaires' }],
      },
    ],
    roles: [
      {
        id: 'RL1',
        name: 'Direction',
        role: 'Direction',
        resp: 'Politique, ressources, revue de direction',
        resources: 'Budget annuel',
        commitment: 'Engagement signé',
      },
      {
        id: 'RL2',
        name: 'Responsable qualité',
        role: 'Responsable qualité',
        resp: 'Système de management, audits',
        resources: '0,5 ETP',
        commitment: '',
      },
      {
        id: 'RL3',
        name: 'RSI',
        role: 'Responsable des systèmes d’information',
        resp: 'Sécurité opérationnelle',
        resources: '1 ETP',
        commitment: '',
      },
    ],
    reviews: [
      {
        id: 'R1',
        title: 'Revue de direction du premier semestre',
        date: decaler(-200),
        participants: 'Direction, responsable qualité, RSI',
        inputs: {},
        decisions: [],
        followup: '',
      },
    ],
    suppliers: [
      {
        id: 'SUP-001',
        name: 'Hébergeur de données fictif',
        saas: true,
        sso: 'Oui',
        mfa: 'Oui',
        critical: 'Oui',
        hds: 'Oui',
        rattachement: 'Cloud',
        contact: 'contact@exemple.invalid',
        notes: 'Hébergement des dossiers (fictif).',
        certs: [{ type: 'HDS', validUntil: decaler(400), received: decaler(-50), scope: 'Hébergement', location: '' }],
        controls: [
          {
            id: 'ctl-1',
            t: 'Vérifier l’activation de l’authentification multifacteur',
            ref: '',
            freq: 12,
            last: decaler(-100),
            result: 'Conforme',
            comment: '',
          },
          { id: 'ctl-2', t: 'Revue des accès', ref: '', freq: 6, last: decaler(-250), result: 'Conforme', comment: '' },
        ],
      },
      {
        id: 'SUP-002',
        name: 'Messagerie collaborative fictive',
        saas: true,
        sso: 'En cours',
        mfa: 'Oui',
        critical: 'Non',
        hds: 'Non',
        rattachement: '',
        contact: '',
        notes: '',
        certs: [],
        controls: [
          { id: 'ctl-3', t: 'Vérifier l’intégration au SSO', ref: '', freq: 12, last: '', result: '', comment: '' },
        ],
      },
      {
        id: 'SUP-003',
        name: 'Logiciel de dossiers fictif',
        saas: true,
        sso: 'Non',
        mfa: 'Non',
        critical: 'Oui',
        hds: 'Oui',
        rattachement: 'Cloud',
        contact: '',
        notes: 'MFA à activer.',
        certs: [{ type: 'ISO 27001', validUntil: decaler(-20), received: decaler(-400), scope: '', location: '' }],
        controls: [],
      },
      {
        id: 'SUP-004',
        name: 'Prestataire de maintenance fictif',
        saas: false,
        sso: '',
        mfa: '',
        critical: 'Non',
        hds: 'Non',
        rattachement: '',
        contact: '',
        notes: '',
        certs: [],
        controls: [],
      },
      {
        id: 'SUP-005',
        name: 'Outil de visioconférence fictif',
        saas: true,
        sso: 'Oui',
        mfa: 'Oui',
        critical: 'Non',
        hds: 'Non',
        rattachement: '',
        contact: '',
        notes: '',
        certs: [],
        controls: [
          {
            id: 'ctl-4',
            t: 'Revue du service',
            ref: '',
            freq: 12,
            last: decaler(-400),
            result: 'Non conforme',
            comment: '',
          },
        ],
      },
    ],
    plans: [
      {
        id: 'PL1',
        type: 'audit',
        title: 'Audit interne du premier semestre',
        start: `${annee}-03-10`,
        end: `${annee}-03-12`,
        status: 'Réalisé',
        done: `${annee}-03-12`,
        owner: 'Responsable qualité',
        scope: 'Processus PR2 et PR4',
      },
      {
        id: 'PL2',
        type: 'audit',
        title: 'Audit interne du second semestre',
        start: decaler(40),
        end: decaler(42),
        status: 'Planifié',
        owner: 'Responsable qualité',
        scope: 'Processus PR3 et PR5',
      },
      {
        id: 'PL3',
        type: 'exo',
        title: 'Exercice de restauration',
        start: decaler(-60),
        end: decaler(-59),
        status: 'Planifié',
        owner: 'RSI',
        scope: 'Restauration des sauvegardes',
      },
      {
        id: 'PL4',
        type: 'formation',
        title: 'Formation à la sécurité des accès',
        start: decaler(20),
        end: decaler(20),
        status: 'Planifié',
        owner: 'Direction',
      },
      {
        id: 'PL5',
        type: 'sensi',
        title: 'Sensibilisation des nouveaux arrivants',
        start: decaler(-10),
        end: decaler(-10),
        status: 'Réalisé',
        done: decaler(-10),
        owner: 'RSI',
      },
    ],
    frameworks: [],
    today: aujourdhui,
  };
}

/** Définition du référentiel de démonstration de la bibliothèque (aucun texte normatif). */
export function referentielDemonstration() {
  return {
    name: 'Référentiel fictif de démonstration',
    identifier: 'demo-fictif',
    source: {
      organisation: 'Organisation fictive',
      document: 'Exigences fictives du jeu de test',
      url: 'https://example.invalid/demo',
      version: '1',
      date: decaler(0),
      license: 'Contenu fictif libre ; ne reproduit aucun référentiel officiel.',
      verifiedAt: '',
      normative: false,
      status: 'organisation' as const,
    },
    domains: [
      { id: 'gouvernance', label: 'Gouvernance' },
      { id: 'exploitation', label: 'Exploitation' },
    ],
    requirements: [
      ['DEMO-01', 'gouvernance', 'Définir les responsabilités'],
      ['DEMO-02', 'gouvernance', 'Revoir la politique chaque année'],
      ['DEMO-03', 'exploitation', 'Contrôler les accès'],
      ['DEMO-04', 'exploitation', 'Sauvegarder et tester la restauration'],
      ['DEMO-05', 'exploitation', 'Suivre les prestataires'],
      ['DEMO-06', 'gouvernance', 'Mesurer et analyser les résultats'],
    ].map(([id, domain, title]) => ({
      id: id!,
      domain: domain!,
      title: title!,
      description: 'Exigence fictive.',
      applicability: 'Tout le périmètre fictif',
      measureRefs: [],
    })),
  };
}

export interface BilanChargement {
  etat: string;
  referentiel: string | null;
  methode: string | null;
  risques: number;
  actions: number;
  ecarts: number;
  serie: number;
  opportunites: number;
  liens: number;
  criteres: number;
  evaluations: number;
}

/** Charge le jeu de test par l'API publique, au nom d'un compte administrateur existant (session temporaire). */
export async function chargerJeuDeTest(
  svc: Services,
  app: FastifyInstance,
  compte: string,
  cfg: { publicUrl: string },
): Promise<BilanChargement> {
  const u = await svc.db.one<{ id: string }>('SELECT id FROM users WHERE lower(username)=lower($1) AND NOT disabled', [
    compte,
  ]);
  if (!u) throw new Error(`Compte inconnu ou désactivé : ${compte}`);
  const jeton = crypto.randomBytes(32).toString('base64url');
  const csrf = crypto.randomBytes(24).toString('base64url');
  const hash = crypto.createHash('sha256').update(jeton).digest();
  await svc.db.q(
    `INSERT INTO sessions(id_hash,user_id,csrf,mfa_ok,ip,user_agent,expires_at) VALUES($1,$2,$3,true,'127.0.0.1','jeu-de-test',now()+interval '1 hour')`,
    [hash, u.id, csrf],
  );
  const origine = new URL(cfg.publicUrl).origin;
  const appel = async (
    method: 'GET' | 'POST' | 'PUT',
    url: string,
    json?: unknown,
    headers: Record<string, string> = {},
  ) => {
    const res = await app.inject({
      method,
      url,
      headers: {
        'x-forwarded-proto': 'https',
        host: new URL(cfg.publicUrl).host,
        cookie: `suivi_sid=${jeton}; __Host-suivi_sid=${jeton}`,
        ...(method === 'GET' ? {} : { origin: origine, 'x-csrf-token': csrf }),
        ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
        ...headers,
      },
      payload: json !== undefined ? JSON.stringify(json) : undefined,
    });
    return res;
  };
  const exiger = async <T>(res: Awaited<ReturnType<typeof appel>>, quoi: string): Promise<T> => {
    if (res.statusCode >= 400) throw new Error(`${quoi} : ${res.statusCode} ${res.body}`);
    return (res.body ? res.json() : {}) as T;
  };
  try {
    const bilan: BilanChargement = {
      etat: 'non',
      referentiel: null,
      methode: null,
      risques: 0,
      actions: 0,
      ecarts: 0,
      serie: 0,
      opportunites: 0,
      liens: 0,
      criteres: 0,
      evaluations: 0,
    };
    const commun = '00000000-0000-4000-8000-000000000001';
    // 1) État de l'outil de suivi : refusé s'il contient déjà des données de pilotage.
    const lu = await appel('GET', '/api/suivi/etat');
    const courant = (await exiger<Json>(lu, 'Lecture de l’état')) as Json;
    const existants = ['processes', 'objectives', 'indicators', 'suppliers', 'findings', 'interested'].filter(
      (k) => Array.isArray(courant[k]) && (courant[k] as unknown[]).length > 0,
    );
    if (existants.length)
      throw new Error(
        `L’instance contient déjà des données de pilotage (${existants.join(', ')}) : le jeu de test se charge sur une instance vide.`,
      );
    const { today: _jour, ...jeu } = etatJeuDeTest();
    void _jour;
    // Écriture directe par le service : les modules repris vont dans leurs tables (ADR 0040), /legacy les refuse.
    await svc.db.tx(async (c) => {
      await c.query('SELECT 1 FROM app_state WHERE id=1 FOR UPDATE');
      const r = await svc.legacy.nativeWrite(c, { ...courant, ...jeu } as JsonObject, null, null, 'Jeu de test');
      if (r.conflict) throw new Error('Écriture de l’état : conflit de version.');
    }, compte);
    bilan.etat = 'oui';
    // 2) Référentiel de démonstration dans la bibliothèque, rattaché au pilotage commun.
    const definition = referentielDemonstration();
    const apercu = await exiger<{ previewId: string }>(
      await appel('POST', '/api/library/frameworks/preview', { id: null, definition }),
      'Simulation du référentiel',
    );
    const publie = await exiger<{ id: string }>(
      await appel(
        'POST',
        '/api/library/frameworks/publish',
        {
          id: null,
          definition,
          previewId: apercu.previewId,
          reason: 'Jeu de test fictif (référentiel de démonstration).',
          confirm: 'PUBLIER',
        },
        { 'if-match': '"0"' },
      ),
      'Publication du référentiel',
    );
    await exiger(
      await appel('PUT', `/api/grc/${commun}/framework-attachments/${publie.id}`, { version: 1, confirm: 'RATTACHER' }),
      'Rattachement du référentiel',
    );
    bilan.referentiel = definition.identifier;
    // 3) Méthode de risque publiée, trois risques appréciés.
    const methode = methodTemplate('ebios_rm');
    const apercuM = await exiger<{ previewId: string }>(
      await appel('POST', `/api/grc/${commun}/methods/preview`, { id: null, definition: methode }),
      'Simulation de la méthode',
    );
    const m = await exiger<{ methodId: string }>(
      await appel(
        'POST',
        `/api/grc/${commun}/methods/publish`,
        {
          id: null,
          definition: methode,
          previewId: apercuM.previewId,
          reason: 'Jeu de test fictif (méthode de recette).',
          confirm: 'PUBLIER',
        },
        { 'if-match': '"0"' },
      ),
      'Publication de la méthode',
    );
    bilan.methode = methode.name;
    const risque = (nom: string, code: string, domaine: string) => ({
      kind: 'risk',
      name: nom,
      data: {
        description: 'Risque fictif du jeu de test.',
        code,
        ownerId: null,
        methodId: m.methodId,
        methodVersion: 1,
        domain: domaine,
        entity: 'Association fictive',
        scope: 'Périmètre fictif',
        strategy: 'reduce',
        acceptanceReason: '',
        reviewAt: decaler(180),
        stages: {},
      },
    });
    const notes = { dimensions: { severity: 'impact_2' }, likelihood: 'likelihood_2', level: null, inputs: {} };
    const refs: Record<string, string> = {};
    for (const [nom, code, dom] of [
      ['Compromission d’un compte administrateur', 'R01', 'SSI'],
      ['Indisponibilité de l’hébergeur', 'R02', 'Continuité'],
      ['Perte de données de dossiers', 'R03', 'SSI'],
    ] as const) {
      const c = await exiger<{ id: string; version: number }>(
        await appel('POST', `/api/grc/${commun}/objects`, risque(nom, code, dom)),
        `Création du risque ${code}`,
      );
      refs[code] = c.id;
      const intention = {
        ratings: { gross: notes, residual: notes },
        rationale: 'Appréciation fictive documentée pour le jeu de test.',
        decision: 'draft',
      };
      const p = await exiger<{ previewId: string }>(
        await appel('POST', `/api/grc/${commun}/risks/${c.id}/preview`, intention),
        'Simulation du risque',
      );
      await exiger(
        await appel(
          'POST',
          `/api/grc/${commun}/risks/${c.id}/evaluate`,
          { ...intention, previewId: p.previewId, requestId: crypto.randomUUID(), confirm: 'ENREGISTRER' },
          { 'if-match': `"${c.version}"` },
        ),
        `Appréciation du risque ${code}`,
      );
      bilan.risques++;
    }
    // 4) Actions, série récurrente, opportunités et liens avec les processus.
    const action = (nom: string, statut: string, echeance: string, justification = '') => ({
      kind: 'action',
      name: nom,
      data: {
        description: 'Action fictive du jeu de test.',
        status: statut,
        ownerId: null,
        startAt: null,
        dueAt: `${echeance}T09:00:00Z`,
        priority: 'normal',
        category: 'action',
        justification,
        reminderDays: 7,
        dependencies: [],
      },
    });
    const actions: Record<string, string> = {};
    for (const [cle, nom, statut, ech] of [
      ['A1', 'Revoir les comptes à privilèges', 'progress', decaler(-15)],
      ['A2', 'Activer la MFA du logiciel de dossiers', 'todo', decaler(30)],
      ['A3', 'Mettre à jour le registre des prestataires', 'todo', decaler(12)],
      ['A4', 'Planifier le test de restauration', 'progress', decaler(60)],
    ] as const) {
      const c = await exiger<{ id: string }>(
        await appel('POST', `/api/grc/${commun}/objects`, action(nom, statut, ech)),
        `Action ${cle}`,
      );
      actions[cle] = c.id;
      bilan.actions++;
    }
    // Écarts du périmètre commun : de vrais écarts de registre, que le module Audit et le tableau de bord relisent.
    for (const [nom, source, classification, type, statut, echeance, cause] of [
      [
        'Procédure de revue des accès non appliquée',
        'Interne',
        'majeure',
        'nonconformity',
        'open',
        decaler(-30),
        'Charge de travail',
      ],
      ['Documents non revus depuis deux ans', 'Interne', 'mineure', 'nonconformity', 'progress', decaler(45), ''],
      [
        'Absence de sauvegarde testée',
        'AFNOR',
        'majeure',
        'nonconformity',
        'closed',
        decaler(-200),
        'Test non planifié',
      ],
      ['Sensibilisation des nouveaux arrivants', 'Interne', '', 'observation', 'open', decaler(90), ''],
      ['Pistes d’amélioration de l’accueil téléphonique', 'Interne', '', 'opportunity', 'open', decaler(120), ''],
      ['Registre des prestataires incomplet', 'Interne', 'mineure', 'nonconformity', 'open', decaler(10), ''],
    ] as const) {
      const c = await exiger<{ id: string }>(
        await appel('POST', `/api/grc/${commun}/objects`, {
          kind: 'nonconformity',
          name: nom,
          data: { source, classification, findingType: type, dueAt: echeance, cause },
        }),
        `Écart « ${nom} »`,
      );
      // Un écart ne se crée pas clos : l'état clos du jeu de démonstration est posé directement (aucune preuve fictive à produire).
      if (statut !== 'open')
        await svc.db.q(`UPDATE grc_objects SET data=jsonb_set(data,'{status}',$2::jsonb) WHERE id=$1`, [
          c.id,
          JSON.stringify(statut),
        ]);
      bilan.ecarts++;
    }
    const serie = await exiger<{ id: string }>(
      await appel('POST', `/api/grc/${commun}/objects`, {
        kind: 'task_series',
        name: 'Revue trimestrielle des accès',
        data: {
          description: 'Revue récurrente fictive.',
          ownerId: null,
          category: 'action',
          priority: 'normal',
          refs: ['legacy:processes:PR4'],
          recurrence: {
            start: decaler(30),
            time: '09:00',
            timezone: 'Europe/Paris',
            unit: 'month',
            interval: 3,
            until: null,
            count: null,
            reminderDays: 7,
            active: true,
          },
        },
      }),
      'Série récurrente',
    );
    bilan.serie = serie.id ? 1 : 0;
    const opportunite = (nom: string, statut: string) => ({
      kind: 'opportunity',
      name: nom,
      data: {
        description: 'Opportunité fictive.',
        ownerId: null,
        refs: [],
        source: 'Enjeu externe fictif',
        benefit: 'Bénéfice attendu fictif',
        status: statut,
        decision: '',
        reviewAt: decaler(120),
        dueAt: '',
      },
    });
    const opps: string[] = [];
    for (const [nom, st] of [
      ['Ouverture à la téléconsultation', 'identified'],
      ['Mutualisation des achats avec un partenaire', 'evaluated'],
      ['Certification de l’accueil', 'pursued'],
    ] as const) {
      const c = await exiger<{ id: string }>(
        await appel('POST', `/api/grc/${commun}/objects`, opportunite(nom, st)),
        `Opportunité ${nom}`,
      );
      opps.push(c.id);
      bilan.opportunites++;
    }
    const lier = async (source: string, cible: string, note: string) => {
      await exiger(
        await appel('POST', `/api/grc/${commun}/links`, { source, target: cible, type: 'related_to', note }),
        'Lien',
      );
      bilan.liens++;
    };
    await lier(`object:${actions.A1}`, 'legacy:processes:PR4', 'Action rattachée au processus');
    await lier(`object:${actions.A2}`, 'legacy:processes:PR3', 'Action rattachée au processus');
    await lier(`object:${actions.A3}`, 'legacy:processes:PR3', 'Action rattachée au processus');
    await lier(`object:${actions.A4}`, 'legacy:processes:PR4', 'Action rattachée au processus');
    await lier(`object:${opps[0]}`, 'legacy:processes:PR2', 'Opportunité rattachée au processus');
    await lier(`object:${opps[1]}`, 'legacy:processes:PR3', 'Opportunité rattachée au processus');
    await lier(`object:${refs.R01}`, 'legacy:processes:PR4', 'Risque rattaché au processus');
    await lier(`object:${refs.R02}`, 'legacy:processes:PR3', 'Risque rattaché au processus');
    // 5) Fournisseurs : critères propres à l'organisme et deux évaluations immuables.
    const exigence = (id: string) => `requirement:${publie.id}:1:${id}`;
    const critere = async (label: string, purposes: string[], requirementRefs: string[]) =>
      (
        await exiger<{ id: string }>(
          await appel('POST', '/api/suppliers/criteria', {
            label,
            description: 'Critère fictif.',
            purposes,
            requirementRefs,
            reason: 'Critère fictif du jeu de test.',
          }),
          `Critère ${label}`,
        )
      ).id;
    const c1 = await critere('Authentification multifacteur', ['evaluation', 'surveillance'], [exigence('DEMO-03')]);
    const c2 = await critere('Certificat valide', ['selection', 'reevaluation'], [exigence('DEMO-05')]);
    const c3 = await critere('Plan de continuité documenté', ['evaluation'], [exigence('DEMO-04')]);
    bilan.criteres = 3;
    const evaluation = (
      items: { criterionId: string; meets: boolean | null; result?: string }[],
      suivante: string | null,
    ) => ({
      evaluatedAt: decaler(-20),
      conclusion: 'Évaluation fictive du jeu de test.',
      nextReviewAt: suivante,
      items,
      confirm: 'ENREGISTRER',
    });
    await exiger(
      await appel(
        'POST',
        '/api/suppliers/SUP-001/evaluations',
        evaluation(
          [
            { criterionId: c1, meets: true },
            { criterionId: c2, meets: true },
            { criterionId: c3, meets: null },
          ],
          decaler(340),
        ),
      ),
      'Évaluation SUP-001',
    );
    await exiger(
      await appel(
        'POST',
        '/api/suppliers/SUP-003/evaluations',
        evaluation(
          [
            { criterionId: c1, meets: false, result: 'MFA non activée' },
            { criterionId: c2, meets: false, result: 'Certificat expiré' },
          ],
          decaler(-5),
        ),
      ),
      'Évaluation SUP-003',
    );
    bilan.evaluations = 2;
    // 6) Décision de la revue de direction précédente : crée une action suivie (entrée 9.3.2 a de la revue suivante).
    const revue = await exiger<{ version: number }>(
      await appel('GET', `/api/grc/${commun}/pilotage/legacy/reviews/R1`),
      'Lecture de la revue',
    );
    await exiger(
      await appel(
        'POST',
        `/api/grc/${commun}/pilotage/decisions`,
        {
          ref: 'legacy:reviews:R1',
          decision: {
            operation: 'action_create',
            requestId: crypto.randomUUID(),
            note: 'Décision fictive de la revue : renforcer la revue des accès.',
            date: decaler(-200),
            result: 'completed',
            refs: [],
            step: '',
            createFinding: false,
            createAction: true,
            until: '',
            confirm: 'ENREGISTRER',
          },
        },
        { 'if-match': `"${revue.version}"` },
      ),
      'Décision de la revue',
    );
    bilan.actions++;
    await svc.db.audit({ username: 'jeu-de-test' } as never, '127.0.0.1', 'jeu-de-test.loaded', commun, {
      compte,
      ...bilan,
    });
    return bilan;
  } finally {
    await svc.db.q('DELETE FROM sessions WHERE id_hash=$1', [hash]);
  }
}
