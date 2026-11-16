/* Module Vulnérabilités (ADR 0100, point 10 ; lot V4b) : suivi d'une faille. Deux objets suivis : un constat de Tenable (un
   contrôle, pour une instance) et une faille déclarée (une CVE rattachée à un produit surveillé, c'est-à-dire un
   rapprochement). Chaque objet porte un état décidé par une personne ; la plateforme ne fait que proposer « corrigée » quand
   la source ne rapporte plus la faille, et remettre « à traiter » une faille corrigée qui réapparaît. Le traitement passe par
   une action du registre existant, liée à la faille. Schémas, libellés et fonctions pures (testés à part). */
import { z } from 'zod';

/* ------------------------------------------------------------------ États */
export const ETATS_SUIVI = [
  'nouvelle',
  'a_traiter',
  'en_cours',
  'corrigee',
  'risque_accepte',
  'non_concernee',
] as const;
export const EtatSuiviFaille = z.enum(ETATS_SUIVI);
export type EtatSuiviFaille = z.infer<typeof EtatSuiviFaille>;
export const ETAT_SUIVI_LIBELLES: Record<EtatSuiviFaille, string> = {
  nouvelle: 'Nouvelle',
  a_traiter: 'À traiter',
  en_cours: 'En cours',
  corrigee: 'Corrigée',
  risque_accepte: 'Risque accepté',
  non_concernee: 'Non concernée',
};
/** États qui sortent une faille des compteurs, du rang des machines et de la liste par défaut. */
export const ETATS_SUIVI_CLOS = [
  'corrigee',
  'risque_accepte',
  'non_concernee',
] as const satisfies readonly EtatSuiviFaille[];
/** États d'une faille encore à traiter : ceux de la liste par défaut. */
export const ETATS_SUIVI_ACTIFS = ['nouvelle', 'a_traiter', 'en_cours'] as const satisfies readonly EtatSuiviFaille[];
export const estEtatClos = (e: EtatSuiviFaille) => (ETATS_SUIVI_CLOS as readonly EtatSuiviFaille[]).includes(e);
/** États qui exigent une note de la personne qui décide. */
export const ETATS_SUIVI_NOTE_OBLIGATOIRE = [
  'risque_accepte',
  'non_concernee',
] as const satisfies readonly EtatSuiviFaille[];
export const noteObligatoire = (e: EtatSuiviFaille) =>
  (ETATS_SUIVI_NOTE_OBLIGATOIRE as readonly EtatSuiviFaille[]).includes(e);
/** États qu'une personne peut choisir : tous sauf « nouvelle », qui n'est que l'état initial. */
export const ETATS_SUIVI_CHOISIS = ['a_traiter', 'en_cours', 'corrigee', 'risque_accepte', 'non_concernee'] as const;

/** Objet suivi : constat de Tenable ou faille déclarée (rapprochement d'un produit surveillé). */
export const NATURES_SUIVI = ['constat', 'declaree'] as const;
export const NatureSuivi = z.enum(NATURES_SUIVI);
export type NatureSuivi = z.infer<typeof NatureSuivi>;

/** Proposition « corrigée » de la plateforme : aucune, à confirmer (la source ne rapporte plus la faille), refusée par une
    personne (gardée jusqu'à ce que la faille réapparaisse). */
export const PROPOSITIONS_SUIVI = ['aucune', 'a_confirmer', 'refusee'] as const;
export type PropositionSuivi = (typeof PROPOSITIONS_SUIVI)[number];

/** Événements de l'historique (en ajout seul). */
export const EVENEMENTS_SUIVI = [
  'changement',
  'action',
  'proposition',
  'refus',
  'retrait_proposition',
  'reapparition',
] as const;
export type EvenementSuivi = (typeof EVENEMENTS_SUIVI)[number];
export const EVENEMENT_SUIVI_LIBELLES: Record<EvenementSuivi, string> = {
  changement: 'Changement d’état',
  action: 'Action liée',
  proposition: 'Corrigée selon la source, à confirmer',
  refus: 'Proposition « corrigée » refusée',
  retrait_proposition: 'Proposition retirée : la faille est de nouveau rapportée',
  reapparition: 'Réapparue',
};

/** Changement d'état admis ? Rend le motif du refus, ou null. Une personne ne remet pas une faille à « nouvelle » ; un même
    état n'est rechoisi que pour renouveler une acceptation du risque (nouvelle note, nouvelle date de revue). */
export function refusChangementSuivi(avant: EtatSuiviFaille, apres: EtatSuiviFaille): string | null {
  if (apres === 'nouvelle') return 'L’état « nouvelle » est l’état initial : il ne se choisit pas.';
  if (avant === apres && apres !== 'risque_accepte')
    return `La faille est déjà dans l’état « ${ETAT_SUIVI_LIBELLES[apres]} ».`;
  return null;
}

/* ------------------------------------------------------------------ Écritures */
export const NOTE_SUIVI_MAX = 1000;
const note = z.string().trim().max(NOTE_SUIVI_MAX, `Note de ${NOTE_SUIVI_MAX} caractères au plus.`);

/** Changement d'état (If-Match : version du suivi). Note obligatoire pour « risque accepté » et « non concernée » ; date de
    revue facultative, seulement pour « risque accepté » (sa date passée est refusée par l'API, au fuseau de l'organisation). */
export const ChangementEtatSuivi = z
  .object({
    etat: z.enum(ETATS_SUIVI_CHOISIS),
    note: note.default(''),
    revueLe: z.iso.date().nullable().optional(),
  })
  .strict()
  .superRefine((v, c) => {
    if (noteObligatoire(v.etat) && !v.note)
      c.addIssue({
        code: 'custom',
        path: ['note'],
        message: `Une note est obligatoire pour l’état « ${ETAT_SUIVI_LIBELLES[v.etat]} ».`,
      });
    if (v.revueLe && v.etat !== 'risque_accepte')
      c.addIssue({
        code: 'custom',
        path: ['revueLe'],
        message: 'Une date de revue ne se donne qu’à un risque accepté.',
      });
  });
export type ChangementEtatSuivi = z.infer<typeof ChangementEtatSuivi>;

/** Refus de la proposition « corrigée » : note obligatoire ; l'état ne change pas. */
export const RefusPropositionSuivi = z
  .object({ note: note.min(1, 'Une note est obligatoire pour refuser la proposition.') })
  .strict();
export type RefusPropositionSuivi = z.infer<typeof RefusPropositionSuivi>;

/** Création d'une action du registre depuis une faille : périmètre choisi parmi ceux où la personne écrit, intitulé et
    description corrigés par elle, échéance facultative (vide par défaut). */
export const CreationActionSuivi = z
  .object({
    perimetreId: z.uuid(),
    titre: z.string().trim().min(1, 'Intitulé obligatoire.').max(200),
    description: z.string().max(10000),
    echeance: z.iso.date().nullable(),
  })
  .strict();
export type CreationActionSuivi = z.infer<typeof CreationActionSuivi>;

/** Relier une action existante du registre, que la personne peut lire. */
export const LienActionSuivi = z.object({ actionId: z.uuid() }).strict();
export type LienActionSuivi = z.infer<typeof LienActionSuivi>;

/** Filtre de suivi des listes : absent, les failles encore à traiter (nouvelles, à traiter, en cours), hors propositions
    « corrigée » à confirmer ; un état ; `a_clore` : les propositions « corrigée » à confirmer ; `tous`. */
export const FILTRES_SUIVI = [...ETATS_SUIVI, 'a_clore', 'tous'] as const;
export const FiltreSuivi = z.enum(FILTRES_SUIVI);
export type FiltreSuivi = z.infer<typeof FiltreSuivi>;

/* ------------------------------------------------------------------ Lecture */
/** Suivi résumé, porté par chaque ligne des listes. `present` : la source rapporte encore la faille (constat présent après
    la dernière synchronisation complète, rapprochement rattaché). */
export interface SuiviResumeDto {
  etat: EtatSuiviFaille;
  proposition: PropositionSuivi;
  revueLe: string | null;
  /** Risque accepté dont la date de revue est passée : signal calculé, sans changement d'état. */
  revueDepassee: boolean;
  nombreActions: number;
  version: number;
}

export interface EntreeHistoriqueSuiviDto {
  id: string;
  evenement: EvenementSuivi;
  etatAvant: EtatSuiviFaille | null;
  etatApres: EtatSuiviFaille;
  note: string;
  revueLe: string | null;
  auteur: string;
  le: string;
}

/** Action liée. Ses détails ne sont rendus que si la personne peut la lire. */
export type ActionLieeDto =
  | {
      lisible: true;
      id: string;
      perimetreId: string;
      nom: string;
      statut: string;
      statutLibelle: string;
      terminee: boolean;
      archivee: boolean;
      echeance: string | null;
      relieLe: string;
    }
  | { lisible: false; relieLe: string };

export interface SuiviDto extends SuiviResumeDto {
  nature: NatureSuivi;
  objetId: string;
  present: boolean;
  majLe: string | null;
  majPar: string | null;
  historique: EntreeHistoriqueSuiviDto[];
  actions: ActionLieeDto[];
  /** La personne peut décider : droit de modifier le module et toutes les machines touchées lisibles. Sinon, le motif. */
  peutDecider: boolean;
  motifRefus: string | null;
  /** Préremplissage du formulaire « Créer une action ». */
  preremplissage: { titre: string; description: string };
}

/* ------------------------------------------------------------------ Action préremplie */
export const ORIGINE_ACTION_VULNERABILITES = 'Créée depuis le module Vulnérabilités';
const coupe = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export type SourceAction =
  | { nature: 'constat'; plugin: string; nom: string; correctif: string | null }
  | {
      nature: 'declaree';
      cve: string;
      produit: { editeur: string; nom: string; versionProduit: string };
      actionKev: string | null;
    };

/** Intitulé et description proposés : nom du contrôle, ou CVE et produit ; correctif de la source en anglais, tel quel.
    Aucun nom ni adresse de machine. */
export function preremplirAction(s: SourceAction): { titre: string; description: string } {
  if (s.nature === 'constat')
    return {
      titre: coupe(`Corriger : ${s.nom}`, 200),
      description: coupe(
        `Faille détectée par Tenable Security Center : contrôle n° ${s.plugin}, « ${s.nom} ».` +
          (s.correctif ? `\n\nCorrectif indiqué par Tenable (en anglais, tel quel) :\n${s.correctif}` : ''),
        10000,
      ),
    };
  const produit = `${s.produit.editeur} ${s.produit.nom} ${s.produit.versionProduit}`;
  return {
    titre: coupe(`Corriger ${s.cve} : ${produit}`, 200),
    description: coupe(
      `Faille ${s.cve} rattachée au produit surveillé « ${produit} ».` +
        (s.actionKev ? `\n\nAction exigée par le catalogue KEV (en anglais, telle quelle) :\n${s.actionKev}` : ''),
      10000,
    ),
  };
}

/** Justification de l'action créée : mention de l'origine et de la faille, sans nom ni adresse de machine. */
export function mentionOrigineAction(s: Pick<SourceAction, 'nature'> & { plugin?: string; cve?: string }): string {
  return s.nature === 'constat'
    ? `${ORIGINE_ACTION_VULNERABILITES} (contrôle n° ${s.plugin} de Tenable Security Center).`
    : `${ORIGINE_ACTION_VULNERABILITES} (faille déclarée ${s.cve}).`;
}
