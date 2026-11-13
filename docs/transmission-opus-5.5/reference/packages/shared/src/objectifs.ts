/* Objectifs, indicateurs et processus du Pilotage (interface reprise de l'outil de suivi) : corps des requêtes.
   Les champs additionnels sont ceux que l'ISO 9001:2015 demande de définir (4.4.1 a à h, 6.2.2, 9.1.1, 9.1.2) ; tous sont
   facultatifs et vides par défaut : la norme n'impose ni valeur, ni fréquence, ni méthode. */
import { z } from 'zod';

const court = z.string().trim().max(300);
const long = z.string().trim().max(5000);
const jour = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Date AAAA-MM-JJ attendue.');
const identifiants = z.array(z.string().trim().min(1).max(60)).max(200);

/** Familles de processus de l'outil de suivi (la norme n'en impose aucune). */
export const FAMILLES_PROCESSUS = ['Management', 'Réalisation', 'Support'] as const;

/** Fiche processus : identité de l'outil de suivi et points de l'ISO 9001:2015, 4.4.1 a à h. */
export const ProcessusBody = z
  .object({
    name: z.string().trim().min(1).max(200),
    owner: court,
    family: court,
    parent: court,
    purpose: long,
    entity: court,
    scope: long,
    /** 4.4.1 a : entrées requises et sorties attendues. */
    inputs: long,
    outputs: long,
    /** 4.4.1 b : séquence et interaction avec les autres processus. */
    sequence: long,
    /** 4.4.1 c : critères et méthodes (surveillance, mesures, indicateurs de performance) nécessaires à la maîtrise. */
    controlCriteria: long,
    /** 4.4.1 d : ressources nécessaires et disponibilité. */
    resources: long,
    /** 4.4.1 e : responsabilités et autorités (rôle de la gouvernance : référence `legacy:roles:<id>`). */
    responsibilities: long,
    governanceRef: z.string().trim().max(200),
    /** 4.4.1 f : risques et opportunités (6.1). */
    risksOpportunities: long,
    /** 4.4.1 g : évaluation du processus et changements nécessaires. */
    evaluation: long,
    /** 4.4.1 h : amélioration du processus et du système de management. */
    improvement: long,
  })
  .partial()
  .strict();
export type ProcessusBody = z.infer<typeof ProcessusBody>;

/** Objectif : identité de l'outil de suivi et points de l'ISO 9001:2015, 6.2.2 (quoi, ressources, responsable, échéance, évaluation). */
export const ObjectifBody = z
  .object({
    name: z.string().trim().min(1).max(200),
    due: jour,
    owner: court,
    processes: identifiants,
    enjeux: z.array(z.string().trim().min(1).max(1000)).max(200),
    plan: long,
    resources: long,
    evaluation: long,
  })
  .partial()
  .strict();
export type ObjectifBody = z.infer<typeof ObjectifBody>;

/** Indicateur : identité de l'outil de suivi et points de l'ISO 9001:2015, 9.1.1 (quoi, comment, quand surveiller, quand analyser). */
export const IndicateurBody = z
  .object({
    name: z.string().trim().min(1).max(200),
    obj: z.string().trim().min(1).max(60),
    dir: z.enum(['', '≤', '≥', '=']),
    /** Cible : nombre, ou texte pour un sens « = » (par exemple « Oui »). Vide : cible à définir. */
    target: z.union([z.number().finite(), z.string().trim().max(120)]),
    owner: court,
    freq: court,
    action: long,
    actionOwner: court,
    actionDue: jour,
    lastReview: jour,
    auto: z.boolean(),
    /** 9.1.1 : ce qui est surveillé et mesuré, méthodes, moment de la surveillance, moment de l'analyse. */
    monitored: long,
    method: long,
    monitorWhen: court,
    analyzeWhen: court,
    /** Rattachement direct à des processus (en plus du rattachement par l'objectif). */
    processes: identifiants,
    /** Catégorie facultative : « satisfaction » (9.1.2, perception du client ; la source est choisie par l'organisme). */
    category: z.enum(['', 'satisfaction']),
    source: court,
  })
  .partial()
  .strict();
export type IndicateurBody = z.infer<typeof IndicateurBody>;

export const ValeurIndicateurBody = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date AAAA-MM-JJ attendue.'),
    value: z.string().trim().min(1).max(120),
    note: z.string().trim().max(500).default(''),
    /** Période d'une valeur historique (par exemple « 2025-2026 ») : affichée en gris, hors état courant. */
    hist: z.string().trim().max(40).default(''),
  })
  .strict();
export type ValeurIndicateurBody = z.infer<typeof ValeurIndicateurBody>;

export const SuppressionBody = z.object({ confirm: z.literal('SUPPRIMER') }).strict();
