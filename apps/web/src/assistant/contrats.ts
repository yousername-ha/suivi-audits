/* Contrats de l'assistant global : les formes viennent de @suivi/shared (une seule définition, celle du service).
   Restent ici les fonctions de contexte, de disponibilité et de comptage du panneau, et la forme d'une notification
   personnelle (liste /api/grc/notifications, qui n'a pas de contrat partagé). */
import {
  AVIS_MOTIF_MAX,
  MESSAGE_ASSISTANT_MAX,
  MISSION_ASSISTANT_MAX,
  PROFIL_ASSISTANT_LIBELLES,
  PROPOSITION_DESCRIPTION_MAX,
  PROPOSITION_TITRE_MAX,
  REPONSE_QUESTION_MAX,
  type ConversationAssistantDetailDto,
  type ConversationAssistantDto,
  type EtatAssistantDto,
  type MessageAssistantDto,
  type MissionAssistantDto,
  type ProfilAssistant,
  type PropositionAssistantDto,
  type SourceAssistant,
} from '@suivi/shared';

export type Profil = ProfilAssistant;
export type EtatAssistant = EtatAssistantDto;
export type Source = SourceAssistant;
export type Message = MessageAssistantDto;
export type Conversation = ConversationAssistantDto;
export type Fil = ConversationAssistantDetailDto;
export type Proposition = PropositionAssistantDto;
export type Mission = MissionAssistantDto;
export const LIBELLES: Record<Profil, string> = PROFIL_ASSISTANT_LIBELLES;
/** Longueurs maximales : celles que le serveur contrôle. */
export const LONGUEURS = {
  message: MESSAGE_ASSISTANT_MAX,
  reponse: REPONSE_QUESTION_MAX,
  mission: MISSION_ASSISTANT_MAX,
  titre: PROPOSITION_TITRE_MAX,
  description: PROPOSITION_DESCRIPTION_MAX,
  note: AVIS_MOTIF_MAX,
} as const;

/** Notification personnelle de l'assistant, telle que la rend GET /api/grc/notifications. Elle n'a pas de profil. */
export interface NotificationAssistant {
  id: string;
  smsiId: string;
  objectId: string;
  kind: string;
  title: string;
  message: string;
  avis?: 'utile' | 'inutile' | null;
  reponse?: string | null;
  readAt: string | null;
}
export interface ContextePage {
  nom: string;
  chemin: string;
  perimetre: string | null;
}
export const contexteJoint = (contexte?: ContextePage) =>
  contexte
    ? `[Contexte joint : ${contexte.nom} ; page : ${contexte.chemin}${contexte.perimetre ? ` ; périmètre : ${contexte.perimetre}` : ''}. Référence de navigation, pas une source consultée.]\n\n`
    : '';
export const messageAEnvoyer = (texte: string, contexte?: ContextePage) => contexteJoint(contexte) + texte.trim();
/** enPause concerne les rondes, jamais le chat. Le quota vient de la consommation serveur. */
export function indisponibilite(etat: EtatAssistant | undefined, profil: Profil | null) {
  if (!etat) return 'Chargement de la configuration de l’assistant…';
  if (!etat.actif || !etat.pret) return etat.motif || 'L’assistant n’est pas disponible pour le moment.';
  if (!profil || !etat.profils.find((p) => p.id === profil)?.perimetres.length)
    return 'Aucun périmètre autorisé pour ce profil.';
  if (etat.budgetJetonsJour > 0 && etat.jetonsDuJour >= etat.budgetJetonsJour)
    return 'Le budget de la journée est atteint.';
  return '';
}
export const estNotificationAssistant = (n: NotificationAssistant) =>
  n.kind === 'assistant_question' || n.kind === 'assistant_rappel';
export const pointEnAttente = (n: NotificationAssistant) => (n.kind === 'assistant_question' ? !n.reponse : !n.readAt);
/** Identifiant de conversation porté par un lien direct /assistant/:id, ou null. */
export const conversationDuChemin = (chemin: string): string | null =>
  /^\/assistant\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i.exec(chemin)?.[1] ?? null;
