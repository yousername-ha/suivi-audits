/* Notifications métier (décision 012-10 du 26/10/2026, ADR 0058) : types, canaux, réglage à trois niveaux (groupe, rôle,
   utilisateur) et règle de résolution. Tout ce fichier est pur : le serveur, l'interface et les tests partagent la même règle.

   Un réglage est tri-état par (portée, type, canal) : « activé » (true), « désactivé » (false) ou « non défini » (null, la
   portée hérite). Règle de résolution, dans cet ordre :
   (a) un réglage explicite de l'utilisateur (activé ou désactivé) l'emporte toujours sur ses groupes et ses rôles ;
   (b) sinon, c'est activé si au moins un de ses groupes ou de ses rôles est explicitement activé (un autre groupe ou rôle
       désactivé ne retire rien) ; si aucun n'est activé mais qu'au moins un est explicitement désactivé, c'est désactivé ;
   (c) sinon, la valeur par défaut : application activée, courriel désactivé. */
import { z } from 'zod';

export const NOTIFICATION_CANAUX = ['application', 'courriel'] as const;
export type NotificationCanal = (typeof NOTIFICATION_CANAUX)[number];
export const NOTIFICATION_CANAL_LABELS: Record<NotificationCanal, string> = {
  application: 'Dans l’application',
  courriel: 'Par courriel',
};

/** Valeur appliquée quand ni l'utilisateur, ni ses groupes, ni ses rôles n'ont rien défini. */
export const NOTIFICATION_PAR_DEFAUT: Record<NotificationCanal, boolean> = { application: true, courriel: false };

/** Types réellement émis par le serveur (table `grc_notifications`, colonne `kind`) : liste fermée. */
export const NOTIFICATION_TYPES = [
  {
    id: 'task_due',
    label: 'Échéance d’une action',
    description:
      'Rappel adressé au responsable d’une action (ou aux membres du groupe ou de la fonction responsable) dont l’échéance approche, selon le délai de rappel de l’action.',
  },
  {
    id: 'risk_review',
    label: 'Réévaluation d’un risque',
    description: 'Rappel adressé au propriétaire d’un risque dont l’appréciation périodique est à préparer.',
  },
  {
    id: 'retex_contribution',
    label: 'Contribution à un RETEX',
    description:
      'Invitation ou relance adressée à une personne d’un autre pôle pour qu’elle ajoute ses éléments au retour d’expérience d’un incident.',
  },
  {
    id: 'assistant_rappel',
    label: 'Rappel de l’assistant RSSI',
    description:
      'Rappel que l’assistant RSSI adresse, pendant une ronde, au responsable nommé d’un élément (action en retard, risque à revoir). Il n’est émis qu’une fois tant que l’élément n’a pas changé.',
  },
  {
    id: 'assistant_question',
    label: 'Question de l’assistant RSSI',
    description:
      'Question que l’assistant RSSI pose, pendant une ronde, au responsable d’un élément. La personne y répond depuis ses rappels ; sans réponse, elle est relancée une fois.',
  },
  // Module Vulnérabilités (ADR 0100, lot V6) : alertes décidées par la plateforme, adressées aux personnes qui lisent le
  // module. Aucun nom de machine, de domaine, d'adresse ni de périmètre : la CVE, le produit et le niveau seulement.
  {
    id: 'vulnerabilites_alerte_critique',
    label: 'Vulnérabilités : alerte critique',
    description:
      'Une faille exploitée est présente chez nous (détectée par Tenable, déclarée par un produit surveillé ou exposée sur Internet) : priorité P1. Adressée aux personnes qui lisent le module Vulnérabilités, une fois par alerte.',
  },
  {
    id: 'vulnerabilites_alerte',
    label: 'Vulnérabilités : alerte',
    description:
      'Résumé des alertes simples ouvertes par une même évaluation (failles P2 exploitables, présentes sur des actifs exposés directement sur Internet) : une seule notification par évaluation, avec leur nombre et un lien vers l’onglet « Alertes ». Adressée aux personnes qui lisent le module Vulnérabilités.',
  },
  // Lot S1 (ADR 0100) : délais de correction et exceptions à échéance ; résumés seulement, sans CVE ni nom.
  {
    id: 'vulnerabilites_delais',
    label: 'Vulnérabilités : délais dépassés',
    description:
      'Résumé des failles suivies entrées en dépassement de leur délai de correction depuis l’évaluation précédente (délai cible par priorité) : une seule notification par évaluation, avec leur nombre et un lien vers « Failles détectées » filtrée. Adressée aux personnes qui lisent le module Vulnérabilités.',
  },
  {
    id: 'vulnerabilites_exceptions',
    label: 'Vulnérabilités : exceptions à échéance',
    description:
      'Résumé des exceptions (risques acceptés) échues, qui rendent la faille à traiter, et de celles qui arrivent à échéance sous quatorze jours : une seule notification par évaluation, avec leur nombre et un lien vers l’onglet « Délais et exceptions ». Adressée aux personnes qui lisent le module Vulnérabilités.',
  },
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]['id'];
export const NOTIFICATION_TYPE_IDS = NOTIFICATION_TYPES.map((t) => t.id) as [NotificationType, ...NotificationType[]];
export const isNotificationType = (v: string): v is NotificationType =>
  (NOTIFICATION_TYPE_IDS as readonly string[]).includes(v);
export const notificationLabel = (id: string) => NOTIFICATION_TYPES.find((t) => t.id === id)?.label ?? id;

/** Rubrique de l'application où la personne retrouve la notification (lien relatif, repris dans le courriel). */
export const NOTIFICATION_LIEN = '/pilotage/rappels';
/** Rubriques propres à certains types (lien relatif et libellé de la rubrique, repris dans le courriel). */
export const NOTIFICATION_RUBRIQUES: Partial<Record<NotificationType, { lien: string; rubrique: string }>> = {
  retex_contribution: { lien: '/retex', rubrique: 'Mes contributions RETEX' },
  vulnerabilites_alerte_critique: { lien: '/vulnerabilites/alertes', rubrique: 'Vulnérabilités, Alertes' },
  // Résumé des alertes simples (lot V6b) : onglet « Alertes » filtré sur les alertes simples ouvertes (LIEN_RESUME_ALERTES).
  vulnerabilites_alerte: {
    lien: '/vulnerabilites/alertes?niveau=simple&etat=ouverte',
    rubrique: 'Vulnérabilités, Alertes',
  },
  // Lot S1 : failles en dépassement (Failles détectées filtrée) ; exceptions (onglet « Délais et exceptions »).
  vulnerabilites_delais: {
    lien: '/vulnerabilites/failles?delai=en_depassement',
    rubrique: 'Vulnérabilités, Failles détectées',
  },
  vulnerabilites_exceptions: { lien: '/vulnerabilites/delais', rubrique: 'Vulnérabilités, Délais et exceptions' },
};
/** Types émis par le module Vulnérabilités (lots V6 et S1) : sans périmètre ni objet du socle, lus avec vulnerabilites:lire. */
export const NOTIFICATION_TYPES_VULNERABILITES = [
  'vulnerabilites_alerte_critique',
  'vulnerabilites_alerte',
  'vulnerabilites_delais',
  'vulnerabilites_exceptions',
] as const;

export const PORTEE_KINDS = ['groupe', 'role', 'utilisateur'] as const;
export type PorteeKind = (typeof PORTEE_KINDS)[number];
/** Portées qui transmettent leur réglage aux utilisateurs. */
export type PorteeParent = Exclude<PorteeKind, 'utilisateur'>;

/** Tri-état : true activé, false désactivé, null non défini (hérite). */
export type Reglage = boolean | null;

export interface HeritageReglage {
  kind: PorteeParent;
  id: string;
  nom: string;
  valeur: Reglage;
}
export type OrigineNotification = 'utilisateur' | PorteeParent | 'defaut';
export interface SourceNotification {
  kind: PorteeParent;
  id: string;
  nom: string;
}
export interface ResolutionNotification {
  actif: boolean;
  /** D'où vient la valeur : le réglage personnel, un groupe, un rôle ou la valeur par défaut. */
  origine: OrigineNotification;
  /** Groupes ou rôles à l'origine de la valeur héritée (vide pour un réglage personnel ou la valeur par défaut). */
  sources: SourceNotification[];
  /** Vrai quand un réglage personnel désactive ce que les groupes ou rôles auraient activé. */
  exclu: boolean;
  /** Vrai quand un réglage personnel active ce que l'héritage ne donnait pas. */
  ajoute: boolean;
}

/** Valeur héritée seule (sans l'utilisateur) : activé si un parent est activé, sinon désactivé si un parent est désactivé. */
export function resoudreHeritage(
  heritages: readonly HeritageReglage[],
  canal: NotificationCanal,
): Omit<ResolutionNotification, 'exclu' | 'ajoute'> {
  const source = (h: HeritageReglage): SourceNotification => ({ kind: h.kind, id: h.id, nom: h.nom });
  const actives = heritages.filter((h) => h.valeur === true);
  const origineDe = (liste: readonly HeritageReglage[]): OrigineNotification =>
    liste.some((h) => h.kind === 'groupe') ? 'groupe' : 'role';
  if (actives.length) return { actif: true, origine: origineDe(actives), sources: actives.map(source) };
  const inactives = heritages.filter((h) => h.valeur === false);
  if (inactives.length) return { actif: false, origine: origineDe(inactives), sources: inactives.map(source) };
  return { actif: NOTIFICATION_PAR_DEFAUT[canal], origine: 'defaut', sources: [] };
}

/** Règle de résolution complète : réglage personnel, puis groupes et rôles, puis valeur par défaut. */
export function resoudreNotification(
  personnel: Reglage | undefined,
  heritages: readonly HeritageReglage[],
  canal: NotificationCanal,
): ResolutionNotification {
  const herite = resoudreHeritage(heritages, canal);
  if (personnel === true || personnel === false)
    return {
      actif: personnel,
      origine: 'utilisateur',
      sources: [],
      exclu: !personnel && herite.actif,
      ajoute: personnel && !herite.actif,
    };
  return { ...herite, exclu: false, ajoute: false };
}

/* ---------------------------------------------------------------- Échanges avec l'API */
export const ReglageValeur = z.boolean().nullable();
export const ChangementReglage = z
  .object({
    type: z.enum(NOTIFICATION_TYPE_IDS),
    canal: z.enum(NOTIFICATION_CANAUX),
    valeur: ReglageValeur,
  })
  .strict();
export type ChangementReglage = z.output<typeof ChangementReglage>;
/** Changements d'une portée : chaque (type, canal) au plus une fois ; ce qui n'est pas cité reste inchangé. */
export const ReglagesBody = z
  .object({
    changements: z
      .array(ChangementReglage)
      .min(1, 'Aucun changement.')
      .max(NOTIFICATION_TYPES.length * NOTIFICATION_CANAUX.length),
  })
  .strict()
  .refine((b) => new Set(b.changements.map((c) => c.type + '/' + c.canal)).size === b.changements.length, {
    message: 'Un même réglage est cité deux fois.',
  });
export type ReglagesBody = z.output<typeof ReglagesBody>;

export const ApercuQuery = z
  .object({ type: z.enum(NOTIFICATION_TYPE_IDS), canal: z.enum(NOTIFICATION_CANAUX) })
  .strict();

export interface ReglageDto {
  type: NotificationType;
  canal: NotificationCanal;
  valeur: Reglage;
}
export interface EffectifDto extends ResolutionNotification {
  type: NotificationType;
  canal: NotificationCanal;
}
export interface CanalCourrielDto {
  /** Courriel configuré et activé : sinon aucun courriel n'est envoyé. */
  actif: boolean;
  message: string;
}
/** Réglages d'une portée (groupe ou rôle : valeurs explicites ; utilisateur : valeurs explicites et résultat effectif). */
export interface ReglagesPorteeDto {
  portee: { kind: PorteeKind; id: string; nom: string };
  /** Version de la portée (ETag) : à renvoyer en If-Match pour modifier. */
  version: number;
  reglages: ReglageDto[];
  /** Présent pour un utilisateur seulement. */
  effectifs?: EffectifDto[];
  /** Utilisateur sans adresse courriel : le canal courriel ne peut rien envoyer. */
  sansAdresse?: boolean;
  /** Nombre de comptes actifs concernés (groupe ou rôle). */
  membres?: number;
  courriel: CanalCourrielDto;
}
export interface DestinataireApercuDto {
  userId: string;
  username: string;
  displayName: string;
  origine: OrigineNotification;
  sources: SourceNotification[];
  /** Courriel : la personne n'a pas d'adresse, rien ne peut lui être envoyé. */
  sansAdresse: boolean;
}
export interface ApercuDestinatairesDto {
  type: NotificationType;
  canal: NotificationCanal;
  courriel: CanalCourrielDto;
  destinataires: DestinataireApercuDto[];
  /** Comptes actifs que les groupes ou rôles auraient inclus et qu'un réglage personnel exclut. */
  exclus: DestinataireApercuDto[];
  /** Comptes actifs qui ne reçoivent pas (ni exclus, ni destinataires). */
  autres: number;
}
export interface PorteeListeDto {
  kind: PorteeParent;
  id: string;
  nom: string;
  membres: number;
}
