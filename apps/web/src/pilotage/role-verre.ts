/* Fenêtre d'un rôle en style « Verre » (dessin FicheRole validé par le RSSI le 28/11/2026) : calculs purs. Les champs sont
   ceux du registre « Rôles et responsabilités » (PILOTAGE_FIELDS.governance) ; les lettres du rôle sont lues dans la
   matrice « Qui décide quoi » du périmètre (ADR 0115), sans rien recopier ni recalculer ; le pied ne cite que ce que la
   fiche porte réellement. */
import {
  RACI_DECISIONS_LETTRES_LIBELLES,
  type GrcObject,
  type LettreRaci,
  type MatriceDecisionsReponse,
} from '@suivi/shared';
import { dateMiseAJour } from './contexte-dossier';

/** Ordre des champs du dessin : le rôle, puis titulaire et suppléant, contact, responsabilités, moyens et engagement. */
export const ORDRE_CHAMPS_ROLE = [
  'role',
  'holder',
  'deputy',
  'email',
  'phone',
  'responsibilities',
  'resources',
  'commitment',
] as const;
/** Champs qui prennent toute la largeur du bloc « Le rôle » ; les autres vont par deux. */
export const CHAMPS_ROLE_PLEINE_LARGEUR: readonly string[] = ['role', 'responsibilities'];
/** Champs d'une ligne (nom, adresse, téléphone) : en creux d'une seule ligne de haut dans le dessin. */
export const CHAMPS_ROLE_COURTS: readonly string[] = ['role', 'holder', 'deputy', 'email', 'phone'];

/** Libellé du registre, repris au pied de la fenêtre. */
export const REGISTRE_ROLES = 'Rôles et responsabilités';
/** Ancre de la matrice « Qui décide quoi » de la page (QuiDecideQuoi.tsx), visée par « Voir la matrice complète ». */
export const ANCRE_QUI_DECIDE_QUOI = 'qui-decide-quoi';

const renseigne = (v: unknown) => typeof v === 'string' && v.trim() !== '';

/** Puces de l'en-tête : « Titulaire désigné », « Suppléant désigné », seulement quand le champ est renseigné. */
export function pucesRole(data: Record<string, unknown> | undefined): string[] {
  if (!data) return [];
  return [
    ...(renseigne(data.holder) ? ['Titulaire désigné'] : []),
    ...(renseigne(data.deputy) ? ['Suppléant désigné'] : []),
  ];
}

/** Référence du rôle dans la matrice : « object:<uuid> » pour une fiche du Pilotage, l'identifiant lui-même
    (« legacy:roles:<id> ») pour un rôle de l'outil de suivi ; null pour une fiche pas encore enregistrée. */
export function refRoleRaci(o: Pick<GrcObject, 'id'> | null | undefined): string | null {
  if (!o) return null;
  return o.id.startsWith('legacy:') ? o.id : `object:${o.id}`;
}

export interface LettreDuRole {
  decision: string;
  libelle: string;
  lettre: LettreRaci;
  /** « R · réalise » : lettre et mot de la légende de la matrice. */
  texte: string;
}
export type MatriceDuRole =
  | { etat: 'sans-fiche' }
  | { etat: 'sans-decision' }
  | { etat: 'sans-lettre'; decisions: number }
  | { etat: 'lettres'; lettres: LettreDuRole[] };

/** Lettres du rôle dans la matrice « Qui décide quoi », dans l'ordre des décisions. */
export function matriceDuRole(
  reponse: Pick<MatriceDecisionsReponse, 'matrice'> | null | undefined,
  ref: string | null,
): MatriceDuRole {
  if (!ref) return { etat: 'sans-fiche' };
  const decisions = reponse?.matrice?.decisions ?? [];
  if (!decisions.length) return { etat: 'sans-decision' };
  const cases = reponse?.matrice?.cases ?? [];
  const lettres = decisions.flatMap((d) => {
    const k = cases.find((c) => c.decision === d.id && c.role === ref);
    return k
      ? [
          {
            decision: d.id,
            libelle: d.libelle,
            lettre: k.lettre,
            texte: `${k.lettre} · ${RACI_DECISIONS_LETTRES_LIBELLES[k.lettre]}`,
          },
        ]
      : [];
  });
  return lettres.length ? { etat: 'lettres', lettres } : { etat: 'sans-lettre', decisions: decisions.length };
}

/** Auteur affichable : l'outil de suivi signe ses fiches « Historique », ce n'est pas une personne. */
const auteurConnu = (v: string | null | undefined) => (v && v.trim() && v !== 'Historique' ? v.trim() : null);

/** Pied de la fenêtre : « Rôles et responsabilités — <périmètre> · modifié par <auteur> le <jour> ». Chaque partie n'est
    écrite que si la donnée existe : sans périmètre connu, pas de tiret ; sans date connue (fiche reprise sans date),
    ni auteur ni date ; sans auteur, la date seule. */
export function ligneRegistreRole(
  perimetre: string | null | undefined,
  fiche: Pick<GrcObject, 'updatedAt' | 'updatedBy'> | null | undefined,
): string {
  const tete = perimetre?.trim() ? `${REGISTRE_ROLES} — ${perimetre.trim()}` : REGISTRE_ROLES;
  const jour = fiche ? dateMiseAJour(fiche.updatedAt) : null;
  if (!jour) return tete;
  const auteur = auteurConnu(fiche?.updatedBy);
  return auteur ? `${tete} · modifié par ${auteur} le ${jour}` : `${tete} · modifié le ${jour}`;
}
