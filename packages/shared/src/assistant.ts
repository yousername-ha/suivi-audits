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
    profils: z
      .array(
        z
          .object({
            id: z.enum(PROFILS_ASSISTANT),
            actif: z.boolean(),
            perimetres: z.array(z.uuid()).max(200),
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
  });
export type ReglagesAssistantBody = z.infer<typeof ReglagesAssistantBody>;

export const CleModeleBody = z.object({ cle: z.string().min(8).max(400) }).strict();
export const NouvelleConversationBody = z.object({ profil: z.enum(PROFILS_ASSISTANT) }).strict();
export const MessageAssistantBody = z.object({ texte: z.string().trim().min(1).max(MESSAGE_ASSISTANT_MAX) }).strict();

export interface ProfilAssistantDto {
  id: ProfilAssistant;
  libelle: string;
  actif: boolean;
  perimetres: string[];
}
export interface ReglagesAssistantDto {
  actif: boolean;
  adresse: string;
  modele: string;
  budgetJetonsJour: number;
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
