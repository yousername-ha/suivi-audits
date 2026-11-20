/* Tableaux de bord multiples de l'accueil et mode public (ADR 0109, décisions du RSSI du 20/11/2026). Chaque personne voit
   ses tableaux nommés et ceux des autres (proposés d'office, partagés avec elle, publics), qui restent ceux de leur
   auteur, en lecture seule ; 5 favoris au plus en barre, dans l'ordre qu'elle choisit (le premier s'ouvre à l'arrivée). Un
   tableau publié, ou partagé par un détenteur du droit « Publier pour tous » (tableau_de_bord:administrer), ouvre aux
   destinataires les CHIFFRES de son auteur (`ChiffresPublics`, liste blanche de nombres) ; les listes nommées, le journal
   d'audit et l'accès aux registres gardent les droits de chacun. Contrat partagé par l'API et l'interface. */
import { z } from 'zod';
import {
  Disposition,
  DALLES_STANDARD,
  dispositionStandard,
  DALLES_TABLEAU_DE_BORD,
  type IdDalle,
} from './disposition-tableau-de-bord.js';

/** Tableaux personnels par compte, favoris par compte (barre des favoris, choix du RSSI du 20/11/2026), destinataires
    d'un partage. Les « onglets » du stockage sont les favoris. */
export const MAX_TABLEAUX_PAR_COMPTE = 20;
export const MAX_FAVORIS = 5;
export const MAX_ONGLETS = MAX_FAVORIS;
export const MAX_DESTINATAIRES_TABLEAU = 200;

export const NomTableau = z
  .string()
  .trim()
  .min(1, 'Donnez un nom au tableau de bord.')
  .max(60, 'Le nom d’un tableau de bord tient en 60 caractères.');

/* ---------------------------------------------------------------- Tableaux proposés d'office */
/** Tableaux proposés d'office (ADR 0109) : décrits dans le code, toujours à jour du catalogue de dalles ; l'administrateur
    peut modifier leur disposition et leur public (surcharge en base). */
export const MODELES_TABLEAUX = ['global', 'suivi-smsi', 'vulnerabilites', 'suivi-reglementaire'] as const;
export type ModeleTableau = (typeof MODELES_TABLEAUX)[number];

/** Disposition faite des dalles `ids`, affichées dans cet ordre ; les autres dalles du catalogue y sont masquées. */
export function dispositionDe(ids: readonly IdDalle[]): Disposition {
  const standard = dispositionStandard();
  const parId = new Map(standard.dalles.map((x) => [x.id, x]));
  const choisies = new Set(ids);
  return {
    dalles: [
      ...ids.map((id) => ({ ...parId.get(id)!, masquee: false })),
      ...DALLES_TABLEAU_DE_BORD.filter((id) => !choisies.has(id)).map((id) => ({ ...parId.get(id)!, masquee: true })),
    ],
  };
}

export interface DefModele {
  nom: string;
  description: string;
  /** Public visé par défaut : null pour tout le monde, sinon des rôles. */
  roles: readonly string[] | null;
  /** Faux tant que les dalles du tableau n'existent pas (« bientôt » dans la liste des tableaux). */
  disponible: boolean;
  disposition: () => Disposition;
}

export const DEFS_MODELES: Record<ModeleTableau, DefModele> = {
  global: {
    nom: 'Global',
    description: 'Disposition de la vue analytique',
    roles: null,
    disponible: true,
    disposition: () => dispositionDe(DALLES_STANDARD),
  },
  'suivi-smsi': {
    nom: 'Suivi SMSI',
    description: 'Objectifs, indicateurs, plans, tâches récurrentes, écarts',
    roles: null,
    disponible: true,
    disposition: () =>
      dispositionDe([
        'phare',
        'indicateurs',
        'actions-ecarts',
        'vue-consolidee',
        'maturite',
        'plans',
        'recurrences',
        'ecarts',
        'ecarts-type',
        'echeances',
        'actions-etats',
      ]),
  },
  vulnerabilites: {
    nom: 'Vulnérabilités',
    description: 'Dalles du module Vulnérabilités (à venir avec le module)',
    roles: ['rssi'],
    disponible: false,
    disposition: () => dispositionDe([]),
  },
  'suivi-reglementaire': {
    nom: 'Suivi réglementaire',
    description: 'Publications de la veille réglementaire (à venir avec le module)',
    roles: ['rssi'],
    disponible: false,
    disposition: () => dispositionDe([]),
  },
};

/* ---------------------------------------------------------------- Lecture des onglets */
/** D'où vient un tableau pour la personne qui le voit. */
export const OrigineTableau = z.enum(['mien', 'propose', 'partage', 'public']);
export type OrigineTableau = z.infer<typeof OrigineTableau>;

export const TableauResume = z.object({
  id: z.uuid(),
  nom: z.string(),
  origine: OrigineTableau,
  /** Nom affiché de l'auteur ; null pour un tableau proposé d'office. */
  auteur: z.string().nullable(),
  modele: z.enum(MODELES_TABLEAUX).nullable(),
  /** Publié pour tout le monde (globe). */
  public: z.boolean(),
  /** Public visé limité (rôles, groupes, personnes) : cadenas sur l'onglet d'un tableau proposé. */
  restreint: z.boolean(),
  /** Les chiffres de l'auteur sont ouverts à la personne (tableau public, ou partagé par un détenteur du droit de
      publier) ; faux pour ses propres tableaux et les tableaux proposés, vus avec ses droits. */
  chiffresOuverts: z.boolean(),
  /** Faux pour un tableau proposé dont les dalles n'existent pas encore. */
  disponible: z.boolean(),
  /** Déjà dans les onglets de la personne. */
  enOnglet: z.boolean(),
});
export type TableauResume = z.infer<typeof TableauResume>;

export const TableauDetail = TableauResume.extend({
  disposition: Disposition,
  version: z.number().int().min(1),
  /** La personne peut modifier la disposition, le nom et le partage (ses propres tableaux ; modèles : administrateur). */
  modifiable: z.boolean(),
});
export type TableauDetail = z.infer<typeof TableauDetail>;

export const TableauxOut = z.object({
  /** Favoris dans l'ordre de la personne (barre des favoris, 5 au plus) ; le premier s'ouvre à l'arrivée. */
  onglets: z.array(TableauDetail),
  /** Tous les tableaux qu'elle peut afficher (les siens, proposés, partagés avec elle, publics), favoris compris
      (`enOnglet`) : liste du bouton déroulant. */
  disponibles: z.array(TableauResume),
  droits: z.object({
    /** Créer, modifier et partager ses tableaux (tableau_de_bord:modifier). */
    creer: z.boolean(),
    /** Publier pour tous et ouvrir ses chiffres par un partage (tableau_de_bord:administrer). */
    publier: z.boolean(),
    /** Modifier les tableaux proposés d'office (administration:administrer). */
    modeles: z.boolean(),
  }),
});
export type TableauxOut = z.infer<typeof TableauxOut>;

/* ---------------------------------------------------------------- Écritures */
export const DepartTableau = z.discriminatedUnion('type', [
  z.object({ type: z.literal('vide') }).strict(),
  z.object({ type: z.literal('standard') }).strict(),
  /** Copie de la disposition d'un de ses tableaux ou d'un tableau public (aucune donnée, aucun partage copiés). */
  z.object({ type: z.literal('copie'), tableau: z.uuid() }).strict(),
]);
export type DepartTableau = z.infer<typeof DepartTableau>;

export const CreerTableauBody = z.object({ nom: NomTableau, depart: DepartTableau }).strict();
export const ModifierTableauBody = z
  .object({ nom: NomTableau.optional(), disposition: Disposition.optional() })
  .strict()
  .refine((b) => b.nom !== undefined || b.disposition !== undefined, 'Rien à modifier.');
/** Favoris de la personne, dans l'ordre (un tableau absent de la liste sort de ses favoris). */
export const OngletsBody = z.object({ tableaux: z.array(z.uuid()).max(MAX_ONGLETS) }).strict();

export const DestinataireTableau = z
  .object({ type: z.enum(['utilisateur', 'groupe', 'role']), id: z.string().min(1).max(64) })
  .strict();
export type DestinataireTableau = z.infer<typeof DestinataireTableau>;
export const PartageTableauBody = z
  .object({ destinataires: z.array(DestinataireTableau).max(MAX_DESTINATAIRES_TABLEAU), public: z.boolean() })
  .strict()
  .refine(
    (b) => new Set(b.destinataires.map((d) => `${d.type}:${d.id}`)).size === b.destinataires.length,
    'Un destinataire figure deux fois.',
  );
export const PartageTableauOut = z.object({
  destinataires: z.array(DestinataireTableau.extend({ nom: z.string() })),
  public: z.boolean(),
  /** Les destinataires voient les chiffres de l'auteur (droit de publier). */
  chiffresOuverts: z.boolean(),
  version: z.number().int().min(1),
});
export type PartageTableauOut = z.infer<typeof PartageTableauOut>;

/* ---------------------------------------------------------------- Chiffres ouverts (liste blanche) */
const n = z.number().int().min(0);
const compteurs = z.record(z.string().max(80), n);
/** Chiffres de l'auteur d'un tableau ouvert (public ou partagé par un détenteur du droit de publier) : des NOMBRES, et
    des libellés tirés de listes fermées (statuts, classifications, référentiels, types de plans ; inconnu : « Autre »).
    Aucune liste nommée (échéances, journées du plan d'audit, intitulés), aucun journal d'audit. Calculés avec les droits
    et la portée de l'auteur, registres restreints compris (décision du RSSI du 20/11/2026). */
export const ChiffresPublics = z
  .object({
    genereLe: z.string(),
    prochainAudit: z.object({ date: z.string() }).strict().nullable(),
    auditInterne: z.string().nullable(),
    ecarts: z
      .object({
        total: n,
        ouverts: n,
        enRetard: n,
        aEcheance: n,
        parStatut: compteurs,
        parType: compteurs,
        parSource: compteurs,
      })
      .strict()
      .nullable(),
    mesures: z.object({ total: n, parReferentiel: compteurs }).strict().nullable(),
    conformite: z
      .array(
        z
          .object({
            ref: z.string().max(40),
            libelle: z.string().max(80),
            exigences: n,
            applicables: n,
            total: n,
            partiel: n,
            insuffisant: n,
            nonRenseigne: n,
          })
          .strict(),
      )
      .nullable(),
    ecartsOuverts: z
      .object({
        ouverts: n,
        parType: z.array(z.object({ type: z.string().max(40), libelle: z.string().max(80), n }).strict()),
        actionsRealisees: n,
        actionsTotal: n,
      })
      .strict()
      .nullable(),
    indicateurs: z.object({ total: n, atteints: n, nonAtteints: n, nonMesures: n }).strict().nullable(),
    plans: z
      .object({
        annee: z.number().int(),
        types: z.array(
          z
            .object({ type: z.string().max(40), libelle: z.string().max(80), realises: n, aVenir: n, enRetard: n })
            .strict(),
        ),
      })
      .strict()
      .nullable(),
    actions: z.object({ total: n, ouvertes: n, enRetard: n, terminees: n }).strict().nullable(),
    recurrences: z.object({ series: n, occurrencesOuvertes: n, occurrencesEnRetard: n }).strict().nullable(),
    risques: z.object({ total: n, sansDecision: n, revueEchue: n }).strict().nullable(),
    continuite: z.object({ plans: n }).strict().nullable(),
    /** Incidents des périmètres de l'auteur : compteurs et nombre par mois de détection (AAAA-MM). */
    incidents: z
      .object({
        total: n,
        ouverts: n,
        securiteOuverts: n,
        enCours: n,
        clos: n,
        parMois: z.array(z.object({ mois: z.string().regex(/^\d{4}-\d{2}$/), n }).strict()).max(120),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type ChiffresPublics = z.infer<typeof ChiffresPublics>;
