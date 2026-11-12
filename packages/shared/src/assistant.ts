/* Assistant RSSI intégré (ADR 0086) : profils, réglages du modèle, conversations. Schémas communs à l'API et à l'interface.
   L'assistant lit avec les droits de la personne qui l'interroge, bornés aux périmètres du profil ; il n'écrit dans aucun
   registre. */
import { z } from 'zod';

/** Deux profils séparés : un auditeur n'audite pas son propre travail (ADR 0086, point 14). */
export const PROFILS_ASSISTANT = ['mise_en_oeuvre', 'audit_interne'] as const;
export type ProfilAssistant = (typeof PROFILS_ASSISTANT)[number];
export const PROFIL_ASSISTANT_LIBELLES: Record<ProfilAssistant, string> = {
  mise_en_oeuvre: 'Mise en œuvre',
  audit_interne: 'Audit interne',
};

export const BUDGET_JETONS_DEFAUT = 500_000;
export const CONTEXTE_ASSISTANT_MAX = 4000;
export const MESSAGE_ASSISTANT_MAX = 4000;

/** Adresse du service de modèle (API compatible OpenAI) : HTTPS, sans identifiants, sans paramètres ni fragment. */
export const AdresseModele = z
  .string()
  .trim()
  .max(300)
  .refine((v) => {
    if (v === '') return true;
    try {
      const u = new URL(v);
      return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash;
    } catch {
      return false;
    }
  }, 'Adresse HTTPS attendue, sans identifiants ni paramètres (exemple : https://api.mistral.ai/v1).');

export const ReglagesAssistantBody = z
  .object({
    actif: z.boolean(),
    adresse: AdresseModele,
    modele: z
      .string()
      .trim()
      .max(120)
      .regex(/^[A-Za-z0-9._:/-]*$/, 'Nom de modèle invalide.'),
    budgetJetonsJour: z.number().int().min(1000).max(50_000_000),
    /* Autonomie (lot A3). Un champ absent laisse le réglage inchangé. */
    enPause: z.boolean().optional(),
    heureRonde: z.number().int().min(0).max(23).optional(),
    plafondRappelsJour: z.number().int().min(0).max(50).optional(),
    delaiRelanceJours: z.number().int().min(1).max(30).optional(),
    /** Contexte de l'organisation, relu par l'assistant à chaque ronde et à chaque conversation. */
    contexte: z.string().trim().max(CONTEXTE_ASSISTANT_MAX).optional(),
    profils: z
      .array(
        z
          .object({
            id: z.enum(PROFILS_ASSISTANT),
            actif: z.boolean(),
            perimetres: z.array(z.uuid()).max(200),
            rondeQuotidienne: z.boolean().optional(),
            referent: z.uuid().nullable().optional(),
          })
          .strict(),
      )
      .length(PROFILS_ASSISTANT.length)
      .refine((l) => new Set(l.map((p) => p.id)).size === l.length, 'Un profil ne peut apparaître qu’une fois.'),
    version: z.number().int().min(1),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.actif && (!v.adresse || !v.modele))
      ctx.addIssue({ code: 'custom', message: 'Renseignez l’adresse et le modèle avant d’activer l’assistant.' });
    for (const p of v.profils)
      if (p.rondeQuotidienne && p.referent === null)
        ctx.addIssue({ code: 'custom', message: 'Désignez un référent avant d’activer la ronde quotidienne.' });
  });
export type ReglagesAssistantBody = z.infer<typeof ReglagesAssistantBody>;

export const CleModeleBody = z.object({ cle: z.string().min(8).max(400) }).strict();
export const NouvelleConversationBody = z.object({ profil: z.enum(PROFILS_ASSISTANT) }).strict();
export const LancerRondeBody = z.object({ profil: z.enum(PROFILS_ASSISTANT) }).strict();
export const MISSION_ASSISTANT_MAX = 2000;
export const NouvelleMissionBody = z
  .object({ profil: z.enum(PROFILS_ASSISTANT), consigne: z.string().trim().min(1).max(MISSION_ASSISTANT_MAX) })
  .strict();
export const ProfilAssistantQuery = z.object({ profil: z.enum(PROFILS_ASSISTANT).optional() }).strict();
export const MessageAssistantBody = z.object({ texte: z.string().trim().min(1).max(MESSAGE_ASSISTANT_MAX) }).strict();

export interface ProfilAssistantDto {
  id: ProfilAssistant;
  libelle: string;
  actif: boolean;
  perimetres: string[];
  /** Une ronde part chaque jour pour ce profil, à l'heure réglée. */
  rondeQuotidienne: boolean;
  /** Compte dont les droits bornent ce que la ronde lit, et qui reçoit le rapport. */
  referent: string | null;
}
export interface ReglagesAssistantDto {
  actif: boolean;
  adresse: string;
  modele: string;
  budgetJetonsJour: number;
  /** Pause : aucune ronde ne part, la ronde en cours conclut ; le chat reste disponible. */
  enPause: boolean;
  /** Heure de départ de la ronde quotidienne (heure de Paris). */
  heureRonde: number;
  /** Nombre maximal de rappels de l'assistant reçus par une personne en un jour. */
  plafondRappelsJour: number;
  /** Jours sans réponse avant la relance d'une question, puis avant son signalement au référent. */
  delaiRelanceJours: number;
  contexte: string;
  profils: ProfilAssistantDto[];
  version: number;
  /** Une clé est enregistrée (elle n'est jamais renvoyée). */
  cleDefinie: boolean;
  /** Le relais de modèle est déclaré sur le serveur (profil Compose « assistant »). */
  relaisDeclare: boolean;
  updatedAt: string | null;
  updatedBy: string;
}
/** Ce que voit une personne qui peut utiliser l'assistant : rien des réglages sensibles. */
export interface EtatAssistantDto {
  /** L'assistant est activé dans les réglages (le menu ne le propose qu'alors). */
  actif: boolean;
  /** Activé, réglé, clé présente et relais déclaré. */
  pret: boolean;
  /** Raison affichée quand l'assistant n'est pas prêt. */
  motif: string | null;
  /** Hôte vers lequel partent les extraits (affiché en permanence). */
  fournisseur: string | null;
  modele: string | null;
  profils: { id: ProfilAssistant; libelle: string; perimetres: { id: string; nom: string }[] }[];
  jetonsDuJour: number;
  budgetJetonsJour: number;
  enPause: boolean;
}
/** Objet ou périmètre lu pour répondre, affiché en lien sous la réponse. */
export interface SourceAssistant {
  perimetre: string;
  /** Identifiant de l'objet ; absent quand la source est le périmètre lui-même. */
  objet?: string;
  type?: string;
  nom: string;
}
export interface MessageAssistantDto {
  id: string;
  role: 'utilisateur' | 'assistant';
  contenu: string;
  sources: SourceAssistant[];
  /** Outils appelés pour produire la réponse, avec le nombre d'éléments rendus. */
  outils: { nom: string; elements: number }[];
  erreur: boolean;
  createdAt: string;
}
export interface ConversationAssistantDto {
  id: string;
  profil: ProfilAssistant;
  titre: string;
  etat: 'pret' | 'en_cours';
  createdAt: string;
  updatedAt: string;
}
export interface ConversationAssistantDetailDto extends ConversationAssistantDto {
  messages: MessageAssistantDto[];
}
export interface TestModeleDto {
  ok: boolean;
  detail: string;
}

/* ------------------------------------------------------------------ Autonomie (lot A3) */
export const RONDE_DECLENCHEURS = ['planifiee', 'manuelle'] as const;
export type RondeDeclencheur = (typeof RONDE_DECLENCHEURS)[number];
export type RondeEtat = 'en_cours' | 'terminee' | 'echec';
export interface RondeAssistantDto {
  id: string;
  profil: ProfilAssistant;
  declencheur: RondeDeclencheur;
  etat: RondeEtat;
  /** Nom du référent dont les droits ont borné les lectures. */
  referent: string;
  demandeePar: string;
  debut: string;
  fin: string | null;
  erreur: string;
  /** Rappels envoyés et notes de mémoire écrites pendant la ronde. */
  rappels: number;
  notes: number;
  /** Fiches de méthode proposées pendant la ronde. */
  methodes: number;
  /** Propositions déposées pendant la ronde, à décider par une personne. */
  propositions: number;
  jetons: number;
  /** Avis rendu sur la ronde par son référent ou un administrateur de l'assistant. */
  avis: 'utile' | 'inutile' | null;
  avisMotif: string;
}
export interface RondeAssistantDetailDto extends RondeAssistantDto {
  rapport: string;
  /** Ce que la ronde a réellement émis, constaté par la plateforme (et non raconté par le modèle). */
  actions: string[];
  sources: SourceAssistant[];
  outils: { nom: string; elements: number }[];
}
export interface MissionAssistantDto {
  id: string;
  profil: ProfilAssistant;
  consigne: string;
  etat: 'ouverte' | 'close';
  createdBy: string;
  createdAt: string;
  closedAt: string | null;
}
export interface MemoireAssistantDto {
  id: string;
  profil: ProfilAssistant;
  contenu: string;
  createdAt: string;
}
/** Compte qui peut être référent d'un profil : actif et porteur du droit d'utiliser l'assistant. */
export interface ReferentAssistantDto {
  id: string;
  nom: string;
}

/* ------------------------------------------------------------------ Amélioration avec l'usage (ADR 0086, point 13) */
export const METHODE_TITRE_MAX = 120;
export const METHODE_CONTENU_MAX = 2000;
export const AVIS_MOTIF_MAX = 500;
export const AvisRondeBody = z
  .object({ avis: z.enum(['utile', 'inutile']), motif: z.string().trim().max(AVIS_MOTIF_MAX).default('') })
  .strict();
export const AvisRappelBody = z.object({ avis: z.enum(['utile', 'inutile']) }).strict();
const methode = {
  titre: z.string().trim().min(1).max(METHODE_TITRE_MAX),
  contenu: z.string().trim().min(1).max(METHODE_CONTENU_MAX),
};
/** Fiche rédigée par une personne : validée d'office. */
export const NouvelleMethodeBody = z.object({ profil: z.enum(PROFILS_ASSISTANT), ...methode }).strict();
/** Décision sur une fiche : la personne peut corriger le texte en la validant. */
export const DecisionMethodeBody = z
  .object({
    decision: z.enum(['valider', 'refuser']),
    titre: methode.titre.optional(),
    contenu: methode.contenu.optional(),
  })
  .strict();
export interface MethodeAssistantDto {
  id: string;
  profil: ProfilAssistant;
  titre: string;
  contenu: string;
  etat: 'proposee' | 'validee' | 'refusee';
  origine: 'assistant' | 'personne';
  createdAt: string;
  decidedBy: string;
}
/** Chiffres d'un mois, calculés par la plateforme : l'assistant progresse-t-il ? */
export interface MesureAssistantDto {
  /** Mois au format AAAA-MM. */
  mois: string;
  rondes: number;
  rondesEnEchec: number;
  rondesUtiles: number;
  rondesInutiles: number;
  propositionsConfirmees: number;
  propositionsRejetees: number;
  rappels: number;
  rappelsUtiles: number;
  rappelsInutiles: number;
  methodesValidees: number;
  methodesRefusees: number;
}
export type DecisionMethodeBody = z.infer<typeof DecisionMethodeBody>;

/* ------------------------------------------------------------------ Questions de l'assistant (ADR 0086, points 9 et 10) */
export const QUESTION_ASSISTANT_MAX = 400;
export const REPONSE_QUESTION_MAX = 2000;
export const ReponseQuestionBody = z.object({ texte: z.string().trim().min(1).max(REPONSE_QUESTION_MAX) }).strict();
export interface QuestionAssistantDto {
  id: string;
  profil: ProfilAssistant;
  perimetre: string;
  objet: string;
  objetNom: string;
  /** Nom affiché de la personne interrogée. */
  destinataire: string;
  texte: string;
  etat: 'ouverte' | 'repondue' | 'sans_reponse';
  reponse: string;
  relances: number;
  createdAt: string;
  repondueAt: string | null;
}

/* ------------------------------------------------------------------ Propositions de l'assistant (ADR 0086, point 8) */
export const PROPOSITION_TITRE_MAX = 200;
export const PROPOSITION_DESCRIPTION_MAX = 2000;
const DateJour = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date attendue au format AAAA-MM-JJ.');
/** Décision sur une proposition : la personne peut corriger le texte et l'échéance en confirmant. */
export const DecisionPropositionBody = z
  .object({
    decision: z.enum(['confirmer', 'rejeter']),
    titre: z.string().trim().min(1).max(PROPOSITION_TITRE_MAX).optional(),
    description: z.string().trim().max(PROPOSITION_DESCRIPTION_MAX).optional(),
    echeance: DateJour.nullable().optional(),
    note: z.string().trim().max(AVIS_MOTIF_MAX).default(''),
  })
  .strict();
export type DecisionPropositionBody = z.infer<typeof DecisionPropositionBody>;
export interface PropositionAssistantDto {
  id: string;
  profil: ProfilAssistant;
  perimetre: string;
  type: 'action';
  titre: string;
  description: string;
  echeance: string | null;
  /** Élément qui motive la proposition. */
  sourceNom: string;
  etat: 'en_attente' | 'confirmee' | 'rejetee';
  decidedBy: string;
  decisionNote: string;
  /** Élément créé à la confirmation. */
  objetCree: string | null;
  createdAt: string;
}
