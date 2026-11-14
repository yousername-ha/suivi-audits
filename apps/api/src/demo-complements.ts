/* Démonstration, compléments : alimente les rubriques que le reste du jeu laisse vides (plans du SMSI, organisation de
   l'audit, évaluations par le clausier, périmètres enfants, cartographie, chronologie d'un RETEX, continuité, contrôles,
   preuves, tâches récurrentes, traitement d'un risque du registre). Même principe que `demo-annexes.ts` : tout passe par
   l'API publique, au nom de l'administrateur créé à l'installation, avec les mêmes validations que l'interface.
   Organisation, sites, personnes et fournisseurs sont entièrement fictifs et reprennent ceux du jeu (SUP-001 à SUP-005) ;
   les dates sont relatives au jour du chargement. */
import crypto from 'node:crypto';
import {
  cartoContext,
  defaultGenerateOptions,
  generateLayout,
  MAP_VIEWS,
  selectForGeneration,
  type CartoObject,
} from '@suivi/shared/carto';
import type { ContexteDemo } from './demo-normes.js';

type Json = Record<string, unknown>;
type Complements = Pick<ContexteDemo, 'appel' | 'exiger' | 'commun' | 'decaler'>;

export interface BilanComplements {
  plans: number;
  audit: { jours: number; creneaux: number; personnes: number };
  clausier: { evaluations: number; points: number };
  perimetres: number;
  cartes: number;
  retex: number;
  continuite: { plans: number; exercices: number };
  controles: number;
  preuves: number;
  series: number;
  traitements: number;
}

/** Plans du SMSI : formation, sensibilisation, exercices PRA et de crise, avec leurs résultats (le jeu de base n'y place
    que des actions sommaires). */
async function plans({ appel, exiger, decaler }: Complements): Promise<number> {
  const fiches: Json[] = [
    {
      type: 'formation',
      title: 'Formation des administrateurs à la gestion des comptes à privilèges',
      kind: 'Présentiel',
      start: decaler(-35),
      end: decaler(-35),
      done: decaler(-35),
      status: 'Réalisé',
      owner: 'RSI',
      provider: 'Organisme de formation fictif',
      audience: 'Équipe informatique',
      planned: '6',
      attended: '5',
      duration: '7 h',
      proof: 'Feuille d’émargement (démonstration)',
    },
    {
      type: 'formation',
      title: 'Formation du DPO et de la qualité à la gestion des violations de données',
      kind: 'Distanciel',
      start: decaler(55),
      end: decaler(55),
      status: 'En préparation',
      owner: 'Direction',
      audience: 'DPO, responsable qualité',
      planned: '2',
      duration: '3 h',
    },
    {
      type: 'sensi',
      title: 'Campagne d’hameçonnage simulé du trimestre',
      kind: 'Campagne d’hameçonnage simulé',
      start: decaler(-28),
      end: decaler(-21),
      done: decaler(-21),
      status: 'Réalisé',
      owner: 'RSSI',
      audience: 'Ensemble des agents',
      planned: '120',
      attended: '120',
      participation: '100 %',
      success: '82 %',
      notes: 'Taux de clic de 18 % : rappel ciblé auprès des services concernés.',
    },
    {
      type: 'sensi',
      title: 'Module en ligne : protéger les données des patients',
      kind: 'Module e-learning',
      start: decaler(15),
      end: decaler(45),
      status: 'Planifié',
      owner: 'RSSI',
      audience: 'Personnel soignant et administratif',
      planned: '120',
    },
    {
      type: 'exo',
      title: 'Exercice de crise sur table : rançongiciel',
      kind: 'Exercice de crise sur table',
      start: decaler(-50),
      end: decaler(-50),
      done: decaler(-50),
      status: 'Réalisé',
      owner: 'Direction',
      scenario: 'Chiffrement malveillant des serveurs du dossier patient un vendredi soir.',
      systems: 'Dossier patient, messagerie',
      objectives: 'Vérifier l’activation de la cellule de crise et la bascule en mode dégradé papier.',
      result: 'Partiellement atteint',
      retex: 'Cellule activée en 40 minutes ; l’annuaire de crise papier n’était pas à jour.',
    },
    {
      type: 'exo',
      title: 'Test de bascule vers le site de secours de l’hébergeur',
      kind: 'Test de bascule',
      start: decaler(70),
      end: decaler(70),
      status: 'Planifié',
      owner: 'RSI',
      provider: 'Hébergeur de données fictif',
      systems: 'Dossier patient',
      objectives: 'Reprendre l’activité en moins de quatre heures.',
    },
  ];
  for (const f of fiches) await exiger(await appel('POST', '/api/plans', f), `Plan « ${String(f.title)} »`);
  return fiches.length;
}

/** Gestion de l'audit : dates du cycle, organisation de l'audit de surveillance (deux jours, créneaux, participants). */
async function audit({ appel, exiger, decaler }: Complements): Promise<BilanComplements['audit']> {
  await exiger(
    await appel('PATCH', '/api/audit-suivi/cycle', {
      nextDate: decaler(45),
      internalDate: decaler(40),
      closeDeadline: decaler(135),
    }),
    'Cycle d’audit',
  );
  await exiger(
    await appel('PATCH', '/api/audit-suivi/plan', {
      status: 'Projet',
      note: 'Plan de démonstration : à confirmer avec l’organisme de certification fictif.',
    }),
    'Organisation de l’audit',
  );
  const personnes: Record<string, string> = {};
  for (const [cle, name, role] of [
    ['dir', 'Direction', 'Directeur de l’établissement'],
    ['rssi', 'RSSI', 'Responsable de la sécurité des systèmes d’information'],
    ['rsi', 'RSI', 'Responsable des systèmes d’information'],
    ['qua', 'Responsable qualité', 'Pilote du système de management'],
    ['aud', 'Auditeur fictif', 'Organisme de certification fictif'],
  ] as const)
    personnes[cle] = (
      await exiger<{ id: string }>(
        await appel('POST', '/api/audit-suivi/plan/personnes', { name, role }),
        `Participant ${name}`,
      )
    ).id;
  const jours: string[] = [];
  for (const [label, d] of [
    ['Jour 1', 45],
    ['Jour 2', 46],
  ] as const)
    jours.push(
      (
        await exiger<{ id: string }>(
          await appel('POST', '/api/audit-suivi/plan/jours', { label, date: decaler(d) }),
          `Jour d’audit ${label}`,
        )
      ).id,
    );
  const creneaux: [number, Json][] = [
    [
      0,
      {
        type: 'ouverture',
        start: '09:00',
        end: '09:30',
        title: 'Réunion d’ouverture',
        place: 'Salle de direction',
        people: ['dir', 'rssi', 'qua', 'aud'],
      },
    ],
    [
      0,
      {
        type: 'audit',
        start: '09:30',
        end: '11:00',
        title: 'Contexte, périmètre et appréciation des risques',
        place: 'Salle de direction',
        requirements: ['ISO-4.1', 'ISO-6.1'],
        people: ['rssi', 'qua', 'aud'],
        proofs: [
          { t: 'Analyse du contexte et des parties intéressées', done: true },
          { t: 'Étude EBIOS RM validée', done: true },
        ],
        questions: ['Comment les enjeux externes sont-ils revus ?'],
      },
    ],
    [
      0,
      {
        type: 'audit',
        start: '11:00',
        end: '12:30',
        title: 'Gestion des accès et authentification',
        place: 'Service informatique',
        requirements: ['A-5.15', 'A-8.5'],
        people: ['rsi', 'aud'],
        proofs: [{ t: 'Dernière revue des comptes à privilèges', done: false }],
        questions: ['Où en est l’activation de la MFA du logiciel de dossiers ?'],
      },
    ],
    [0, { type: 'pause', start: '12:30', end: '13:30', title: 'Déjeuner' }],
    [
      0,
      {
        type: 'visite',
        start: '13:30',
        end: '14:30',
        title: 'Visite de la salle informatique',
        place: 'Bâtiment technique',
        people: ['rsi', 'aud'],
      },
    ],
    [
      1,
      {
        type: 'audit',
        start: '09:00',
        end: '10:30',
        title: 'Sauvegardes et continuité',
        place: 'Service informatique',
        requirements: ['A-8.13', 'A-5.30'],
        people: ['rsi', 'rssi', 'aud'],
        proofs: [{ t: 'Compte rendu du dernier test de restauration', done: false }],
      },
    ],
    [
      1,
      {
        type: 'synthese',
        start: '14:00',
        end: '15:00',
        title: 'Synthèse de l’auditeur',
        people: ['aud'],
      },
    ],
    [
      1,
      {
        type: 'cloture',
        start: '15:00',
        end: '15:30',
        title: 'Réunion de clôture',
        place: 'Salle de direction',
        people: ['dir', 'rssi', 'qua', 'aud'],
      },
    ],
  ];
  for (const [j, c] of creneaux) {
    const cree = await exiger<{ id: string }>(
      await appel('POST', '/api/audit-suivi/plan/creneaux', { day: jours[j] }),
      'Créneau d’audit',
    );
    const corps = { ...c, people: ((c.people as string[] | undefined) ?? []).map((p) => personnes[p]!) };
    await exiger(
      await appel('PATCH', `/api/audit-suivi/plan/creneaux/${cree.id}`, corps),
      `Créneau « ${String(c.title)} »`,
    );
  }
  return { jours: jours.length, creneaux: creneaux.length, personnes: Object.keys(personnes).length };
}

/** Évaluations par le clausier : une évaluation complète d'un fournisseur conforme, une évaluation en cours d'un
    fournisseur à revoir. Les réponses sont des exemples ; aucune action n'est créée (le registre des écarts reste celui
    du jeu de base). */
async function clausier({ appel, exiger, decaler }: Complements): Promise<BilanComplements['clausier']> {
  const evaluations: { supplier: string; fiche: Json; etats: string[]; nombre: number }[] = [
    {
      supplier: 'SUP-001',
      fiche: {
        product: 'Hébergement des dossiers (offre fictive)',
        date: decaler(-25),
        evaluator: 'RSSI',
        source: 'Questionnaire rempli par le fournisseur fictif',
        cases: ['rgpd', 'cloud'],
      },
      etats: ['Conforme', 'Conforme', 'Conforme', 'Non applicable'],
      nombre: 16,
    },
    {
      supplier: 'SUP-003',
      fiche: {
        product: 'Logiciel de dossiers (version fictive)',
        date: decaler(-8),
        evaluator: 'RSSI',
        source: 'Entretien avec l’éditeur fictif',
        cases: ['rgpd', 'cloud'],
      },
      etats: ['Conforme', 'Partiel', 'Non conforme', 'Conforme'],
      nombre: 10,
    },
  ];
  let points = 0;
  for (const e of evaluations) {
    const cree = await exiger<{ id: string }>(
      await appel('POST', '/api/evaluations-clausier', { supplier: e.supplier }),
      `Évaluation par le clausier de ${e.supplier}`,
    );
    await exiger(
      await appel('PATCH', `/api/evaluations-clausier/${cree.id}`, e.fiche),
      `Évaluation par le clausier de ${e.supplier}`,
    );
    const detail = await exiger<{ points: { id: string }[] }>(
      await appel('GET', `/api/evaluations-clausier/${cree.id}`),
      'Points du clausier',
    );
    for (const [k, p] of detail.points.slice(0, e.nombre).entries()) {
      const st = e.etats[k % e.etats.length]!;
      await exiger(
        await appel('PUT', `/api/evaluations-clausier/${cree.id}/points/${encodeURIComponent(p.id)}`, {
          st,
          c: st === 'Conforme' ? 'Engagement contractuel vérifié (démonstration).' : 'À compléter (démonstration).',
        }),
        `Point ${p.id} du clausier`,
      );
      points++;
    }
  }
  return { evaluations: evaluations.length, points };
}

/** Pyramide des périmètres (ADR 0092) : deux sites fictifs rattachés au périmètre de l'organisation. */
async function perimetres({ appel, exiger, commun }: Complements): Promise<number> {
  const sites = [
    {
      name: 'Site fictif de consultations externes',
      scope: 'Consultations externes et accueil du site secondaire de l’établissement fictif.',
    },
    {
      name: 'Centre fictif de soins de suite',
      scope: 'Hospitalisation de soins de suite et réadaptation, rattachée à l’établissement fictif.',
    },
  ];
  for (const s of sites)
    await exiger(
      await appel('POST', '/api/grc/smsis', {
        ...s,
        parentId: commun,
        entityKind: 'organisation',
        timezone: 'Europe/Paris',
      }),
      `Périmètre « ${s.name} »`,
    );
  return sites.length;
}

/** Cartographie du SMSI : les deux vues (contexte et processus) générées comme le fait l'assistant de l'écran. */
async function cartes({ appel, exiger }: Complements): Promise<number> {
  const lus = await exiger<{ objects: CartoObject[] }>(await appel('GET', '/api/carto/objects'), 'Objets de la carte');
  const objs = new Map(lus.objects.map((o) => [o.ref, o] as const));
  const ctx = cartoContext(objs);
  const nouvelId = () => 'e' + crypto.randomBytes(6).toString('hex');
  let n = 0;
  for (const view of MAP_VIEWS) {
    const options = defaultGenerateOptions(view, objs);
    const refs = selectForGeneration(ctx, view, options);
    const layout = generateLayout(null, ctx, view, refs, options, nouvelId);
    await exiger(await appel('POST', '/api/carto/maps', { view, layout }), `Carte « ${view} »`);
    n++;
  }
  return n;
}

/** RETEX : chronologie de l'indisponibilité du logiciel de dossiers (incident résolu du jeu). */
async function retex({ appel, exiger, decaler }: Complements): Promise<number> {
  const liste = await exiger<{ incidents: { id: string; title: string }[] }>(
    await appel('GET', '/api/incidents'),
    'Lecture des incidents',
  );
  const incident = liste.incidents.find((i) => /Indisponibilité du logiciel de dossiers/.test(i.title));
  if (!incident) throw new Error('Incident d’indisponibilité absent du jeu.');
  const jour = decaler(-24);
  const evenements: Json[] = [
    {
      ts: `${jour}T08:05`,
      type: 'Détection',
      titre: 'Appels de l’accueil : dossiers inaccessibles',
      acteur: 'Accueil',
      gravite: 'Modérée',
    },
    {
      ts: `${jour}T08:20`,
      type: 'Qualification',
      titre: 'Incident qualifié : indisponibilité de service',
      acteur: 'RSI',
      gravite: 'Élevée',
    },
    {
      ts: `${jour}T08:30`,
      type: 'Décision',
      titre: 'Passage en mode dégradé papier à l’accueil',
      acteur: 'Direction',
      gravite: 'Élevée',
    },
    {
      ts: `${jour}T09:15`,
      type: 'Analyse',
      titre: 'Disque du serveur d’application saturé après la mise à jour',
      description: 'Diagnostic conjoint avec l’éditeur fictif.',
      acteur: 'RSI',
    },
    {
      ts: `${jour}T10:40`,
      type: 'Rétablissement',
      titre: 'Service redémarré par l’éditeur',
      acteur: 'Éditeur fictif',
      gravite: 'Faible',
    },
    {
      ts: `${jour}T11:05`,
      type: 'Clôture',
      titre: 'Fin du mode dégradé, saisie des dossiers papier',
      acteur: 'Accueil',
      gravite: 'Aucune',
    },
  ];
  for (const e of evenements)
    await exiger(await appel('POST', `/api/incidents/${incident.id}/retex`, e), `Événement « ${String(e.titre)} »`);
  return evenements.length;
}

/** Continuité, contrôles, preuves, tâche récurrente et traitement d'un risque du registre (objets du pilotage commun). */
async function pilotage(ctx: Complements): Promise<Omit<BilanComplements, 'plans' | 'audit' | 'clausier' | 'perimetres' | 'cartes' | 'retex'>> {
  const { appel, exiger, commun, decaler } = ctx;
  const creer = async (kind: string, name: string, data: Json) =>
    (
      await exiger<{ id: string }>(
        await appel('POST', `/api/grc/${commun}/objects`, { kind, name, data }),
        `Objet « ${name} »`,
      )
    ).id;
  await creer('continuity_plan', 'Plan de reprise du dossier patient', {
    planType: 'pra',
    description: 'Reprise du dossier patient informatisé après un sinistre ou un chiffrement (démonstration).',
    scope: 'Dossier patient, serveurs d’application, sauvegardes hors site.',
    trigger: 'Indisponibilité supérieure à quatre heures ou chiffrement malveillant.',
    strategy: 'Restauration depuis la copie hors site, bascule sur le site de secours de l’hébergeur fictif.',
    procedures: 'Procédure de restauration (démonstration).',
    roles: 'RSI : pilotage technique ; direction : décision de bascule.',
    returnToNormal: 'Contrôle d’intégrité des données, reprise des saisies papier.',
    testedAt: decaler(-90),
    reviewAt: decaler(275),
    status: 'review',
  });
  await creer('continuity_plan', 'Plan de continuité de l’accueil des patients', {
    planType: 'pca',
    description: 'Maintien de l’accueil des patients sans le logiciel de dossiers (démonstration).',
    scope: 'Accueil et admissions.',
    trigger: 'Indisponibilité du logiciel de dossiers.',
    workaround: 'Formulaires papier d’admission, liste des rendez-vous imprimée chaque soir.',
    reviewAt: decaler(180),
    status: 'draft',
  });
  await creer('continuity_exercise', 'Exercice de restauration du dossier patient', {
    plannedAt: decaler(-62),
    performedAt: decaler(-60),
    scenario: 'Restauration complète de la base du dossier patient sur un serveur de test.',
    criteria: 'Restauration en moins de quatre heures, données cohérentes.',
    result: 'partial',
    observations: 'Restauration réussie en cinq heures.',
    lessons: 'La procédure omet la reconstruction des index.',
    improvements: 'Compléter la procédure et refaire le test dans six mois.',
    status: 'done',
  });
  const controles: [string, Json][] = [
    [
      'Revue trimestrielle des comptes à privilèges',
      {
        objective: 'S’assurer que seuls les comptes autorisés disposent de droits d’administration.',
        method: 'Extraction des comptes, rapprochement avec la liste des habilitations.',
        criteria: 'Aucun compte orphelin.',
        category: 'review',
        frequency: 'quarterly',
        dueAt: decaler(20),
        status: 'active',
      },
    ],
    [
      'Contrôle mensuel des sauvegardes',
      {
        objective: 'Vérifier la réussite des sauvegardes et de leur copie hors site.',
        method: 'Lecture des rapports de sauvegarde.',
        criteria: 'Aucun échec non traité.',
        category: 'test',
        frequency: 'monthly',
        dueAt: decaler(8),
        status: 'scheduled',
      },
    ],
  ];
  for (const [nom, data] of controles) await creer('control', nom, data);
  await creer('evidence', 'Rapport de la dernière revue des comptes', {
    category: 'record',
    source: 'Extraction de l’annuaire (démonstration).',
    validUntil: decaler(90),
    status: 'draft',
  });
  await creer('task_series', 'Vérification mensuelle des certificats des fournisseurs', {
    description: 'Tâche récurrente fictive.',
    ownerId: null,
    category: 'action',
    priority: 'normal',
    refs: [],
    recurrence: {
      start: decaler(3),
      time: '10:00',
      timezone: 'Europe/Paris',
      unit: 'month',
      interval: 1,
      until: null,
      count: null,
      reminderDays: 3,
      active: true,
    },
  });
  // Plan d'actions dans la fiche d'un risque du registre : un traitement qui « traite » le risque R03, et son action.
  const risques = await exiger<{ items: { id: string; data: { code?: string } }[] }>(
    await appel('GET', `/api/grc/${commun}/objects?kind=risk`),
    'Lecture des risques',
  );
  const r03 = risques.items.find((r) => r.data.code === 'R03');
  if (!r03) throw new Error('Risque R03 absent du jeu.');
  const traitement = await creer('treatment', 'Sauvegarder les dossiers hors site', {
    strategy: 'reduce',
    expectedEffect: 'Pouvoir reconstituer les dossiers après une perte de données.',
    verification: 'Test de restauration semestriel (démonstration).',
    reviewAt: decaler(180),
    riskRefs: [`object:${r03.id}`],
    measureRefs: ['legacy:items:A-8.13'],
  });
  await exiger(
    await appel('POST', `/api/grc/${commun}/links`, {
      source: `object:${traitement}`,
      target: `object:${r03.id}`,
      type: 'treats',
      note: 'Traitement du risque (démonstration)',
    }),
    'Lien « Traite »',
  );
  await exiger(
    await appel('POST', `/api/grc/${commun}/treatments/${traitement}/action`, {
      name: 'Mettre en place la copie hors site des sauvegardes',
      dueAt: `${decaler(40)}T09:00:00Z`,
      ownerId: null,
    }),
    'Action du traitement du risque R03',
  );
  return { continuite: { plans: 2, exercices: 1 }, controles: controles.length, preuves: 1, series: 1, traitements: 1 };
}

/** Charge les compléments de la démonstration. */
export async function modulesComplements(ctx: Complements): Promise<BilanComplements> {
  const plansCharges = await plans(ctx);
  const auditCharge = await audit(ctx);
  const clausierCharge = await clausier(ctx);
  const sites = await perimetres(ctx);
  const retexCharge = await retex(ctx);
  const objets = await pilotage(ctx);
  // La carte est générée en dernier : elle reprend les objets créés ci-dessus.
  const cartesChargees = await cartes(ctx);
  return {
    plans: plansCharges,
    audit: auditCharge,
    clausier: clausierCharge,
    perimetres: sites,
    cartes: cartesChargees,
    retex: retexCharge,
    ...objets,
  };
}
