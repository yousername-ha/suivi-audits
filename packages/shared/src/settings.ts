/* Paramètres de l'application, par section (page Paramètres). Chaque section a son schéma, ses valeurs par défaut,
   sa permission d'écriture et son propre enregistrement (version par section, If-Match). */
import { z } from 'zod';
import type { Permission } from './permissions.js';

export const SETTINGS_SECTIONS = [
  'general',
  'cycle',
  'referentiels',
  'apparence',
  'notifications',
  'import_export',
  'sauvegardes',
  'conservation',
  'courriel',
  'securite',
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const SETTINGS_LABELS: Record<SettingsSection, string> = {
  general: 'Général',
  cycle: 'Cycle d’audit et années',
  referentiels: 'Référentiels',
  apparence: 'Apparence',
  notifications: 'Notifications',
  import_export: 'Import et export',
  sauvegardes: 'Sauvegardes',
  conservation: 'Conservation',
  courriel: 'Courriel',
  securite: 'Sécurité',
};

/** Lire : parametres:lire ; enregistrer : parametres:modifier ; la sécurité exige parametres:administrer. */
export const SETTINGS_WRITE: Record<SettingsSection, Permission> = {
  general: 'parametres:modifier',
  cycle: 'parametres:modifier',
  referentiels: 'parametres:modifier',
  apparence: 'parametres:modifier',
  notifications: 'parametres:modifier',
  import_export: 'parametres:modifier',
  sauvegardes: 'parametres:modifier',
  conservation: 'parametres:modifier',
  courriel: 'parametres:administrer',
  securite: 'parametres:administrer',
};

const txt = (max: number) => z.string().trim().max(max);
const optDate = z.union([z.literal(''), z.iso.date()]);

export const GeneralSettings = z.object({
  appName: txt(80).min(1, 'Nom obligatoire.'),
  orgName: txt(120).min(1, 'Organisation obligatoire.'),
  adresse: txt(300),
  telephone: txt(40),
  email: z.union([z.literal(''), z.email('Adresse e-mail invalide.').max(200)]),
  site: z.union([z.literal(''), z.url({ protocol: /^https?$/, error: 'Adresse web invalide (http ou https).' })]),
  rssi: txt(120),
});
/** Cycle d'audit : valeurs de l'outil historique (module audit), modifiées ici. */
export const CycleSettings = z.object({
  years: z.array(z.number().int().min(2000).max(2100)).min(1, 'Au moins une année.').max(10),
  yearLabels: z.record(z.string().regex(/^\d{4}$/), txt(60)),
  nextYear: z.number().int().min(2000).max(2100).nullable(),
  nextDate: optDate,
  internalDate: optDate,
  iso27001Certified: z.boolean(),
});
/** Référentiels : référentiel complémentaire actif et catégorie d'entité (NIS 2) ; listes en lecture. */
export const ReferentielsSettings = z.object({
  activeFw: txt(80),
  entityCategory: z.enum(['', 'essentielle', 'importante', 'hors_champ']),
});
export const THEMES = ['auto', 'clair', 'sombre'] as const;
export const DENSITES = ['compacte', 'normale', 'confortable'] as const;
/** Style global de l'instance (identique pour tous les comptes) : « sage » = Référence 08 (défaut), « clair » = clair bleuté.
    Il ne remplace que les fonds et bordures claires ; le mode clair/sombre reste une préférence distincte. */
export const STYLES = ['sage', 'clair'] as const;
export const ApparenceSettings = z.object({
  theme: z.enum(THEMES),
  densite: z.enum(DENSITES),
  style: z.enum(STYLES).default('sage'),
});
export const NotificationsSettings = z.object({
  echeancesJours: z.number().int().min(0).max(365),
  conventionJours: z.number().int().min(0).max(365),
  alerterImports: z.boolean(),
  alerterDroits: z.boolean(),
});
export const ImportExportSettings = z.object({
  formatRevue: z.enum(['xlsx', 'csv']),
});
export const SauvegardesSettings = z.object({
  emplacement: txt(300),
  dernierTestRestauration: optDate,
  frequenceTestMois: z.number().int().min(1).max(36),
});
/** Durées de conservation (décision 2 du 25/10/2026) : nombre de jours après lesquels un élément devient candidat à une purge ;
    `null` = conservation sans limite. Aucune purge n'est automatique : ces durées ne servent qu'à l'aperçu de ce qui serait purgé. */
const joursConservation = z.number().int().min(1).max(3650).nullable();
export const ConservationSettings = z.object({
  documentsCorbeilleJours: joursConservation,
  rappelsLusJours: joursConservation,
  elementsArchivesJours: joursConservation,
});
/** Envoi de courriels (décision 1 du 25/10/2026) : SMTP avec STARTTLS ou SMTPS (TLS implicite) uniquement ; un échange sans
    chiffrement n'est pas proposé. Le mot de passe n'est jamais dans ces valeurs : il est scellé à part. `contactTechnique` reçoit
    les alertes d'exploitation et le message de test ; il est distinct des rappels métier. */
const adresse = z.union([z.literal(''), z.email('Adresse e-mail invalide.').max(200)]);
export const CourrielSettings = z.object({
  actif: z.boolean(),
  hote: txt(255).regex(/^[A-Za-z0-9.-]*$/, 'Nom d’hôte invalide.'),
  port: z.number().int().min(1).max(65535),
  securite: z.enum(['starttls', 'smtps']),
  utilisateur: txt(255),
  expediteur: adresse,
  contactTechnique: adresse,
  /** Certificat PEM de l'autorité qui signe celui du serveur SMTP (relais interne) ; vide : autorités du système. */
  autoriteCertification: z
    .string()
    .max(20000)
    .refine((v) => v.trim() === '' || /-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/.test(v), {
      message: 'Certificat PEM attendu (-----BEGIN CERTIFICATE-----).',
    }),
});
/** Politique de sécurité : bornes non négociables (mot de passe ≥ 12, double authentification toujours obligatoire). */
export const SecuriteSettings = z.object({
  passwordMinLength: z.number().int().min(12, 'Au moins 12 caractères.').max(64),
  sessionIdleMinutes: z.number().int().min(5).max(240),
  sessionMaxHours: z.number().int().min(1).max(24),
  lockoutThreshold: z.number().int().min(3).max(10),
  lockoutMinutes: z.number().int().min(5).max(1440),
  mfaRequired: z.literal(true, 'La double authentification reste obligatoire.'),
});

export const SETTINGS_SCHEMAS = {
  general: GeneralSettings,
  cycle: CycleSettings,
  referentiels: ReferentielsSettings,
  apparence: ApparenceSettings,
  notifications: NotificationsSettings,
  import_export: ImportExportSettings,
  sauvegardes: SauvegardesSettings,
  conservation: ConservationSettings,
  courriel: CourrielSettings,
  securite: SecuriteSettings,
} as const;
export type SettingsValues = { [K in SettingsSection]: z.infer<(typeof SETTINGS_SCHEMAS)[K]> };

/** Réponse d'une section : valeurs, version (ETag), droit d'écriture, informations en lecture seule. */
export const SettingsSectionOut = z.object({
  section: z.enum(SETTINGS_SECTIONS),
  values: z.record(z.string(), z.unknown()),
  version: z.number(),
  canWrite: z.boolean(),
  info: z.record(z.string(), z.unknown()).optional(),
});
export type SettingsSectionOut = z.infer<typeof SettingsSectionOut>;

export const CATEGORIES_CONSERVATION = ['documents_corbeille', 'rappels_lus', 'elements_archives'] as const;
export type CategorieConservation = (typeof CATEGORIES_CONSERVATION)[number];
export interface CategorieApercuConservation {
  id: CategorieConservation;
  label: string;
  /** Durée réglée (jours) ; nul : conservation sans limite, rien n'est candidat. */
  days: number | null;
  /** Éléments plus anciens que la durée ; nul quand la durée n'est pas réglée. */
  candidates: number | null;
  /** Parmi eux, ceux qu'une règle de conservation protège (document cité comme preuve). */
  protectedCount: number;
  /** Date du plus ancien candidat. */
  oldest: string | null;
  /** Ce que le produit permet de faire de ces éléments aujourd'hui. */
  note: string;
}
export interface ApercuConservation {
  generatedAt: string;
  automaticPurge: false;
  categories: CategorieApercuConservation[];
}

export const CourrielMotDePasseBody = z.object({ password: z.string().min(1).max(500) }).strict();
export type CourrielMotDePasseBody = z.output<typeof CourrielMotDePasseBody>;
export interface EtapeCourriel {
  step: string;
  ok: boolean;
  detail: string;
}
/** Demande de message de test, traitée par l'exécutant d'exploitation du serveur. Aucun secret : seulement l'état et la trace. */
export interface TestCourrielDto {
  id: string;
  status: 'en_attente' | 'en_cours' | 'reussie' | 'echec';
  requestedBy: string;
  to: string;
  createdAt: string;
  finishedAt: string | null;
  steps: EtapeCourriel[];
  /** Explication en clair quand l'envoi échoue. */
  error: string | null;
}
