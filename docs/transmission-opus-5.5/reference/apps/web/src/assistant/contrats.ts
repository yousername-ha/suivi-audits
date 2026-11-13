/* Contrats de lecture du service claude/assistant-rssi, référence 460060a (12/11/2026).
   Pont frontend : aucun module, droit ou backend ajouté à cette branche de refonte.
   À remplacer par les imports @suivi/shared correspondants lors de la réunion des branches. */
export type Profil = 'mise_en_oeuvre' | 'audit_interne';
export interface EtatAssistant {
  actif: boolean;
  pret: boolean;
  motif: string | null;
  fournisseur: string | null;
  modele: string | null;
  profils: { id: Profil; libelle: string; perimetres: { id: string; nom: string }[] }[];
  jetonsDuJour: number;
  budgetJetonsJour: number;
  enPause: boolean;
}
export interface Source {
  perimetre: string;
  objet?: string;
  type?: string;
  nom: string;
}
export interface Message {
  id: string;
  role: 'utilisateur' | 'assistant';
  contenu: string;
  sources: Source[];
  outils: { nom: string; elements: number }[];
  erreur: boolean;
  createdAt: string;
}
export interface Conversation {
  id: string;
  profil: Profil;
  titre: string;
  etat: 'pret' | 'en_cours';
  createdAt: string;
  updatedAt: string;
}
export interface Fil extends Conversation {
  messages: Message[];
}
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
export interface Proposition {
  id: string;
  profil: Profil;
  perimetre: string;
  type: 'action' | 'constat';
  nature?: '' | 'observation' | 'nonconformity' | 'opportunity';
  sourceIssueAssistant?: boolean;
  titre: string;
  description: string;
  echeance: string | null;
  sourceNom: string;
  etat: 'en_attente' | 'confirmee' | 'rejetee';
  decidedBy: string;
  decisionNote: string;
  objetCree: string | null;
  createdAt: string;
}
export interface Mission {
  id: string;
  profil: Profil;
  consigne: string;
  etat: 'ouverte' | 'close';
}
export const LIBELLES: Record<Profil, string> = { mise_en_oeuvre: 'Mise en œuvre', audit_interne: 'Audit interne' };
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
