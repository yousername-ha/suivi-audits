/* Collecte du RETEX d'un incident : le pilote (droit de modification des incidents) ouvre le RETEX, puis le remplit seul
   ou invite des contributeurs d'autres pôles (comptes existants). Un contributeur n'a de droit que sur ce RETEX : il
   propose ses propres événements, sans voir ni modifier le reste. Chaque proposition passe par la file à valider du
   pilote (accepter, corriger puis accepter, doublon, rejeter). À la clôture, le pilote génère la chronologie et peut la
   diffuser en lecture seule aux contributeurs. Données dans l'incident (champ `retexCollecte` de l'entrée `incidents` ; le
   champ historique `retex` reste le texte des enseignements). */
import { z } from 'zod';
import { EvenementRetexModification, EvenementRetexSaisie, horodatageRetexValide } from './retex-incidents.js';

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const objet = (v: unknown): Obj | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : null);
const liste = (v: unknown) => (Array.isArray(v) ? v.map(objet).filter((x): x is Obj => !!x) : []);

export const STATUTS_COLLECTE = ['ouverte', 'cloturee'] as const;
export type StatutCollecte = (typeof STATUTS_COLLECTE)[number];
export const STATUTS_PROPOSITION = ['en_attente', 'acceptee', 'doublon', 'rejetee'] as const;
export type StatutProposition = (typeof STATUTS_PROPOSITION)[number];
export const LIBELLES_PROPOSITION: Record<StatutProposition, string> = {
  en_attente: 'À valider',
  acceptee: 'Intégrée',
  doublon: 'Déjà connue',
  rejetee: 'Non retenue',
};
/** Nombre maximal de contributeurs et de propositions par RETEX (garde de taille de l'état). */
export const MAX_CONTRIBUTEURS_RETEX = 50;
export const MAX_PROPOSITIONS_RETEX = 500;

export interface ContributeurRetex {
  /** Identifiant du compte (uuid). */
  id: string;
  nom: string;
  /** Pôles (groupes du compte) au moment de l'invitation, pour l'affichage. */
  pole: string;
  inviteLe: string;
  relanceLe: string;
  /** Vide tant que le contributeur n'a pas déclaré avoir terminé. */
  termineLe: string;
}
export interface PropositionRetex {
  id: string;
  auteurId: string;
  auteurNom: string;
  soumisLe: string;
  statut: StatutProposition;
  /** Motif du rejet, ou précision du pilote. */
  motif: string;
  /** Événement de la chronologie créé (acceptée) ou désigné (doublon). */
  evenementId: string;
  traiteLe: string;
  ts: string;
  type: string;
  titre: string;
  description: string;
  acteur: string;
  gravite: string;
}
export interface CollecteRetex {
  statut: StatutCollecte;
  piloteId: string;
  piloteNom: string;
  ouverteLe: string;
  clotureeLe: string;
  /** Échéance de la collecte (AAAA-MM-JJ), facultative. */
  echeance: string;
  /** Consigne adressée aux contributeurs. */
  consigne: string;
  diffusee: boolean;
  diffuseeLe: string;
  contributeurs: ContributeurRetex[];
  propositions: PropositionRetex[];
}

/** Collecte lisible (null si le RETEX n'a pas été ouvert). */
export function lireCollecteRetex(brut: unknown): CollecteRetex | null {
  const o = objet(brut);
  if (!o || !str(o.piloteId)) return null;
  return {
    statut: str(o.statut) === 'cloturee' ? 'cloturee' : 'ouverte',
    piloteId: str(o.piloteId),
    piloteNom: str(o.piloteNom),
    ouverteLe: str(o.ouverteLe),
    clotureeLe: str(o.clotureeLe),
    echeance: str(o.echeance),
    consigne: str(o.consigne),
    diffusee: o.diffusee === true,
    diffuseeLe: str(o.diffuseeLe),
    contributeurs: liste(o.contributeurs)
      .filter((c) => str(c.id))
      .map((c) => ({
        id: str(c.id),
        nom: str(c.nom),
        pole: str(c.pole),
        inviteLe: str(c.inviteLe),
        relanceLe: str(c.relanceLe),
        termineLe: str(c.termineLe),
      })),
    propositions: liste(o.propositions)
      .filter((p) => str(p.id) && str(p.auteurId))
      .map((p) => ({
        id: str(p.id),
        auteurId: str(p.auteurId),
        auteurNom: str(p.auteurNom),
        soumisLe: str(p.soumisLe),
        statut: (STATUTS_PROPOSITION as readonly string[]).includes(str(p.statut))
          ? (str(p.statut) as StatutProposition)
          : 'en_attente',
        motif: str(p.motif),
        evenementId: str(p.evenementId),
        traiteLe: str(p.traiteLe),
        ts: str(p.ts),
        type: str(p.type) || 'Autre',
        titre: str(p.titre),
        description: str(p.description),
        acteur: str(p.acteur),
        gravite: str(p.gravite),
      }))
      .sort((a, b) => a.ts.localeCompare(b.ts) || a.id.localeCompare(b.id, 'fr', { numeric: true })),
  };
}

/** Identifiant d'une proposition : PR-nnn, jamais réattribué (compteur `propositionsSeq` de la collecte). */
export function identifiantProposition(existants: readonly string[], dernierAttribue = 0): string {
  const max = existants.reduce(
    (m, id) => {
      const r = /^PR-(\d+)$/.exec(id);
      return r ? Math.max(m, Number(r[1])) : m;
    },
    Number.isInteger(dernierAttribue) && dernierAttribue > 0 ? dernierAttribue : 0,
  );
  return `PR-${String(max + 1).padStart(3, '0')}`;
}

export interface SyntheseCollecte {
  contributeurs: number;
  termines: number;
  enAttente: number;
  traitees: number;
  acceptees: number;
}
export function syntheseCollecte(c: CollecteRetex | null): SyntheseCollecte {
  const p = c?.propositions ?? [];
  return {
    contributeurs: c?.contributeurs.length ?? 0,
    termines: c?.contributeurs.filter((x) => x.termineLe).length ?? 0,
    enAttente: p.filter((x) => x.statut === 'en_attente').length,
    traitees: p.filter((x) => x.statut !== 'en_attente').length,
    acceptees: p.filter((x) => x.statut === 'acceptee').length,
  };
}

/** Une proposition peut être modifiée ou retirée par son auteur tant qu'elle attend et que la collecte est ouverte. */
export const propositionModifiable = (c: CollecteRetex, p: PropositionRetex, auteurId: string) =>
  c.statut === 'ouverte' && p.statut === 'en_attente' && p.auteurId === auteurId;

/* ---------------------------------------------------------------- Échanges avec l'API */
const t = (n: number) => z.string().trim().max(n);
const echeance = z.union([
  z.literal(''),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Échéance invalide (AAAA-MM-JJ).')
    .refine((d) => horodatageRetexValide(`${d}T00:00`), 'Date inexistante.'),
]);
/** Ouverture du RETEX par le pilote. */
export const OuvertureRetex = z
  .object({ consigne: t(2000), echeance })
  .partial()
  .strict();
/** Consigne et échéance, modifiables par le pilote. */
export const ReglageCollecte = OuvertureRetex;
/** Invitation de contributeurs (comptes existants). */
export const InvitationRetex = z
  .object({
    utilisateurs: z.array(z.uuid()).min(1).max(MAX_CONTRIBUTEURS_RETEX),
    consigne: t(2000).optional(),
    echeance: echeance.optional(),
  })
  .strict();
export type InvitationRetex = z.infer<typeof InvitationRetex>;
/** Proposition d'un contributeur : mêmes champs qu'un événement. */
export const PropositionRetexSaisie = EvenementRetexSaisie;
export const PropositionRetexModification = EvenementRetexModification;
/** Décision du pilote sur une proposition. */
export const TraitementProposition = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('accepter'), corrections: EvenementRetexModification.optional() }).strict(),
  z
    .object({ decision: z.literal('doublon'), evenementId: z.string().trim().min(1).max(32), motif: t(500).optional() })
    .strict(),
  z.object({ decision: z.literal('rejeter'), motif: t(500).min(1, 'Motif requis.') }).strict(),
]);
export type TraitementProposition = z.infer<typeof TraitementProposition>;
export const ContributionTerminee = z.object({ terminee: z.boolean() }).strict();
export const DiffusionRetex = z.object({ diffusee: z.boolean() }).strict();

/** Compte proposable comme contributeur (annuaire réduit : nom affiché et pôles). */
export interface CandidatRetex {
  id: string;
  nom: string;
  pole: string;
}
/** Invitation vue par un contributeur : le contexte strictement nécessaire. */
export interface InvitationVue {
  incidentId: string;
  titre: string;
  piloteNom: string;
  consigne: string;
  echeance: string;
  statut: StatutCollecte;
  termineLe: string;
  diffusee: boolean;
  propositions: number;
}
