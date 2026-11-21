/* Module Vulnérabilités (ADR 0100, point 21 et lot V6 ; décision du RSSI du 17/11/2026 « les alertes ensuite ») : alertes
   décidées par la PLATEFORME, par règle, jamais par l'assistant ni par le modèle. Fonctions pures et déterministes : à faits
   égaux, même décision (rejouable). La priorité vient de la grille partagée (priorite-vulnerabilites.ts), majoration du lot
   ALH5 comprise ; ce fichier ne dit que quand une alerte s'ouvre, se met à jour, monte, descend ou se clôt.
   - Alerte CRITIQUE : une faille présente chez nous (détectée par Tenable, déclarée par un produit surveillé rattaché, ou
     exposée sur Internet) est en P1, c'est-à-dire exploitation avérée et présence, ou (lot PRIO-1) P2 montée d'un cran sur
     une machine en fin de support.
   - Alerte SIMPLE (décision du RSSI du 18/11/2026, lot V6b : « P1 et P2 exploitable sur les asset qui sont exposé
     directement sur internet ») : une faille en P2 qui est à la fois « exploitable » au sens de la grille (une source dit
     qu'un code d'exploitation existe : Tenable, preuve de concept du CERT Santé ou d'AlgoLightHouse, SOURCES_EXPLOITABLE) et
     exposée directement sur Internet (présence « exposée » du lot ALH2 : actif vu par AlgoLightHouse). Une faille P2
     présente seulement sur des machines internes (détectée ou déclarée), même reliées à un actif exposé, n'en ouvre pas.
     Rien pour P3 et P4.
   - Une seule alerte ouverte par faille (CVE, ou constat de Tenable sans CVE) ; elle se met à jour sans se rejouer.
   - Elle se clôt d'elle-même quand la faille n'est plus présente, est traitée (corrigée, risque accepté, non concernée) ou
     redescend sous le seuil ; la clôture porte son motif.
   - Lot PRIO-1 (décision du RSSI du 20/11/2026) : une faille P1 dont un objet suivi est sous exception (risque accepté en
     vigueur) garde son alerte critique, marquée « risque accepté », au lieu d'être close ; la marque seule ne notifie
     personne (même niveau : mise à jour sans rejeu). */
import { z } from 'zod';
import { type NiveauPriorite } from './failles-tenable.js';
import type { SystemRole } from './permissions.js';
import {
  type Presence,
  PRESENCE_LIBELLES,
  type Priorite,
  type Signalement,
  type SourceExploitation,
  SOURCE_EXPLOITATION_LIBELLES,
} from './priorite-vulnerabilites.js';

/* ------------------------------------------------------------------ Niveaux et seuils */
export const NIVEAUX_ALERTE = ['critique', 'simple'] as const;
export type NiveauAlerte = (typeof NIVEAUX_ALERTE)[number];
export const NIVEAU_ALERTE_LIBELLES: Record<NiveauAlerte, string> = {
  critique: 'Alerte critique',
  simple: 'Alerte',
};

/** Ce qui décide du niveau d'alerte d'une faille PRÉSENTE (et non traitée), sur tous les faits connus. */
export interface FaitsSeuilAlerte {
  /** Priorité de la faille : la plus haute de ses présences (majoration du lot ALH5 comprise). */
  priorite: NiveauPriorite;
  /** Au moins une source dit qu'un code d'exploitation existe (SOURCES_EXPLOITABLE : Tenable, preuve de concept du CERT
      Santé, preuve de concept d'AlgoLightHouse), sur l'une de ses présences non traitées. */
  exploitable: boolean;
  /** Présence « exposée » : la faille est portée par un actif vu par AlgoLightHouse (exposé directement sur Internet). Une
      machine interne reliée à un actif exposé ne la rend pas exposée. */
  exposee: boolean;
}

/** Libellé de la règle, repris par l'écran, l'aide et le motif de clôture. */
export const REGLE_ALERTE_LIBELLE =
  'critique : P1 (faille exploitée présente chez nous, ou montée en P1 sur une machine en fin de support) ; simple : P2 exploitable sur un actif exposé directement sur Internet';

/** Niveau d'alerte d'une faille présente (décision du RSSI du 18/11/2026) : critique en P1 ; simple en P2 si la faille est
    exploitable ET exposée directement sur Internet ; sinon null (sous le seuil). */
export function niveauAlerte(f: FaitsSeuilAlerte): NiveauAlerte | null {
  if (f.priorite === 'P1') return 'critique';
  if (f.priorite === 'P2' && f.exploitable && f.exposee) return 'simple';
  return null;
}

/* ------------------------------------------------------------------ États et clôture */
export const ETATS_ALERTE = ['ouverte', 'prise_en_compte', 'close'] as const;
export type EtatAlerte = (typeof ETATS_ALERTE)[number];
export const ETAT_ALERTE_LIBELLES: Record<EtatAlerte, string> = {
  ouverte: 'Ouverte',
  prise_en_compte: 'Prise en compte',
  close: 'Close',
};

export const MOTIFS_CLOTURE_ALERTE = ['plus_presente', 'traitee', 'sous_le_seuil'] as const;
export type MotifClotureAlerte = (typeof MOTIFS_CLOTURE_ALERTE)[number];
export const MOTIF_CLOTURE_ALERTE_LIBELLES: Record<MotifClotureAlerte, string> = {
  plus_presente:
    'La faille n’est plus présente (absente des synchronisations complètes, produit non rattaché, exposition close)',
  traitee: 'Faille traitée (corrigée, risque accepté ou non concernée)',
  sous_le_seuil:
    'Sous le seuil d’alerte : ni P1, ni P2 exploitable sur un actif exposé directement sur Internet (priorité redescendue, ou faille non exploitable ou non exposée)',
};

/** Ce que la plateforme sait de la faille au moment de l'évaluation, pour choisir le motif d'une clôture. */
export interface SituationFaille {
  /** Priorité de la faille présente et non traitée (la plus haute de ses présences), ou null : rien de présent à alerter. */
  priorite: NiveauPriorite | null;
  /** Au moins un objet présent (constat présent, faille déclarée rattachée) porte la faille, mais tous sont traités. */
  traitee: boolean;
}

/** Motif de clôture : sous le seuil si la faille est encore présente et non traitée (priorité redescendue, ou P2 qui n'est plus
    exploitable et exposée directement sur Internet) ; traitée si tout ce qui la porte encore
    est corrigé, en risque accepté ou non concerné ; sinon, plus présente. */
export function motifCloture(s: SituationFaille): MotifClotureAlerte {
  if (s.priorite !== null) return 'sous_le_seuil';
  return s.traitee ? 'traitee' : 'plus_presente';
}

/* ------------------------------------------------------------------ Décision (création, mise à jour, clôture) */
/** Nombres globaux d'une faille, sur tous les faits connus (jamais montrés tels quels : chacun ne voit que ce qu'il lit). */
export interface NombresFaille {
  machines: number;
  produits: number;
  actifs: number;
}

/** Faits d'une alerte, les mêmes pour tout le monde (lot ALH5, décision A) : aucun nom de machine, de domaine, d'adresse ni
    de périmètre. */
export interface FaitsAlerte {
  priorite: Priorite;
  /** Présences avérées qui portent la faille (détectée, déclarée, exposée). */
  presences: Presence[];
  /** Sources de l'exploitation avérée, de la première à la dernière (V26). */
  exploitation: Signalement<SourceExploitation>[];
  nombres: NombresFaille;
  titre: string;
  produit: string | null;
  /** Lot PRIO-1 (décision du RSSI du 20/11/2026) : l'alerte critique ne tient qu'à des objets suivis en P1 sous exception
      (risque accepté en vigueur) ; elle reste ouverte et visible, marquée « risque accepté ». Absent : non. */
  risqueAccepte?: boolean;
}

/** Marque d'une alerte critique gardée sous exception (lot PRIO-1). */
export const MARQUE_RISQUE_ACCEPTE = 'Risque accepté';
export const DEFINITION_RISQUE_ACCEPTE =
  'Risque accepté : la faille est en P1, mais une exception (risque accepté) est en vigueur sur ce qui la porte. L’alerte critique reste visible jusqu’à la fin de l’exception ou de la faille.';

/** Empreinte stable des faits : une alerte n'est mise à jour (et sa version avancée) que si elle change. La marque « risque
    accepté » n'y entre que lorsqu'elle est posée : les alertes sans elle gardent leur empreinte d'avant le lot PRIO-1. */
export function empreinteAlerte(f: FaitsAlerte): string {
  return JSON.stringify([
    f.priorite.niveau,
    f.priorite.faits,
    [...f.presences].sort(),
    f.exploitation.map((x) => [x.source, x.le]),
    [f.nombres.machines, f.nombres.produits, f.nombres.actifs],
    f.titre,
    f.produit,
    ...(f.risqueAccepte ? ['risque_accepte'] : []),
  ]);
}

export interface AlerteExistante {
  niveau: NiveauAlerte;
  etat: EtatAlerte;
  empreinte: string;
}

export type DecisionAlerte =
  | { action: 'rien' }
  | { action: 'creer'; niveau: NiveauAlerte; notifier: NiveauAlerte }
  /** `notifier` : niveau à notifier (montée d'une alerte simple en critique), sinon null : la mise à jour ne se rejoue pas.
      `reprise` : la prise en compte est annulée (une alerte simple prise en compte devient critique). */
  | { action: 'mettre_a_jour'; niveau: NiveauAlerte; notifier: NiveauAlerte | null; reprise: boolean }
  | { action: 'clore'; motif: MotifClotureAlerte };

/** Décision pour une faille. `existante` : son alerte encore ouverte ou prise en compte (null : aucune, ou close) ;
    `niveau` : niveau d'alerte de la faille présente (null : rien à alerter) ; `empreinte` : celle des faits évalués. */
export function deciderAlerte(
  existante: AlerteExistante | null,
  evaluation: { niveau: NiveauAlerte | null; empreinte: string | null; situation: SituationFaille },
): DecisionAlerte {
  const ouverte = existante && existante.etat !== 'close' ? existante : null;
  if (!ouverte)
    return evaluation.niveau
      ? { action: 'creer', niveau: evaluation.niveau, notifier: evaluation.niveau }
      : { action: 'rien' };
  if (!evaluation.niveau) return { action: 'clore', motif: motifCloture(evaluation.situation) };
  if (evaluation.niveau === ouverte.niveau)
    return evaluation.empreinte === ouverte.empreinte
      ? { action: 'rien' }
      : { action: 'mettre_a_jour', niveau: ouverte.niveau, notifier: null, reprise: false };
  if (evaluation.niveau === 'critique')
    return {
      action: 'mettre_a_jour',
      niveau: 'critique',
      notifier: 'critique',
      reprise: ouverte.etat === 'prise_en_compte',
    };
  return { action: 'mettre_a_jour', niveau: 'simple', notifier: null, reprise: false };
}

/* ------------------------------------------------------------------ Clé d'une faille */
const MOTIF_CVE = /^CVE-[12][0-9]{3}-[0-9]{4,9}$/;
const MOTIF_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Clé d'une faille : la CVE, ou « constat:<identifiant> » pour un constat de Tenable sans CVE. */
export function cleAlerte(f: { cve: string } | { constatId: string }): string {
  if ('cve' in f) {
    if (!MOTIF_CVE.test(f.cve)) throw new Error('CVE invalide.');
    return f.cve;
  }
  if (!MOTIF_UUID.test(f.constatId)) throw new Error('Identifiant de constat invalide.');
  return `constat:${f.constatId}`;
}

/* ------------------------------------------------------------------ Notifications (aucun nom) */
const propre = (v: string, max: number) =>
  v
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

/** Titre d'une notification (repris dans l'objet du courriel, qui sort de la plateforme) : niveau, CVE ou « constat de
    Tenable », produit. Jamais de nom de machine, de domaine, d'adresse ni de périmètre, ni de nombre. */
export function titreNotificationAlerte(a: {
  niveau: NiveauAlerte;
  cve: string | null;
  produit: string | null;
}): string {
  const produit = a.produit ? propre(a.produit, 40) : '';
  const faille = a.cve ?? 'constat de Tenable sans CVE';
  // Court : le courriel n'en reprend que 80 caractères (NotificationsMetier.composer).
  const tete = a.niveau === 'critique' ? 'Alerte critique' : 'Alerte P2';
  return `${tete} : ${faille}${produit ? ` (${produit})` : ''}`;
}
export const MESSAGE_NOTIFICATION_ALERTE =
  'Faille présente chez nous, priorité calculée par la plateforme. Le détail est dans la rubrique Vulnérabilités, Alertes, selon vos droits de lecture.';

/** Résumé des alertes simples ouvertes par une même évaluation (décision C du RSSI du 18/11/2026) : une seule notification
    par personne et par évaluation, au lieu d'une par alerte. Seul le nombre est donné : ni CVE, ni produit, ni nom. */
export const PREFIXE_RESUME_ALERTES = 'resume:';
export function titreResumeAlertes(n: number): string {
  return n === 1 ? 'Vulnérabilités : 1 nouvelle alerte' : `Vulnérabilités : ${n} nouvelles alertes`;
}
export const MESSAGE_RESUME_ALERTES =
  'Failles P2 exploitables, présentes sur des actifs exposés directement sur Internet. La liste est dans la rubrique Vulnérabilités, Alertes, selon vos droits de lecture.';
/** Onglet « Alertes » filtré sur les alertes simples ouvertes (lien du résumé). */
export const LIEN_RESUME_ALERTES = '/vulnerabilites/alertes?niveau=simple&etat=ouverte';

/* ------------------------------------------------------------------ Prise en compte (décision B du 18/11/2026) */
/** Seul le rôle prédéfini « RSSI » de la plateforme (identifiant `rssi`, direct ou par un groupe) prend une alerte en compte,
    pour tout le monde. Aucun droit ne s'y substitue : ni vulnerabilites:modifier, ni vulnerabilites:administrer, ni le rôle
    Administrateur. Les autres personnes ne peuvent que masquer la fenêtre pour leur session. */
export const ROLE_PRISE_EN_COMPTE_ALERTE: SystemRole = 'rssi';
export const PRISE_EN_COMPTE_RESERVEE = 'Seul le RSSI peut prendre en compte une alerte.';

/* ------------------------------------------------------------------ Bornes */
/** Alertes critiques listées dans la fenêtre (la plus récente en tête). */
export const ALERTES_FENETRE_MAX = 5;
export const ALERTES_PAR_PAGE = 50;

/* ------------------------------------------------------------------ Échanges avec l'API */
export const FILTRES_ETAT_ALERTE = ['actives', 'ouverte', 'prise_en_compte', 'close', 'toutes'] as const;
export type FiltreEtatAlerte = (typeof FILTRES_ETAT_ALERTE)[number];
export const FILTRE_ETAT_ALERTE_LIBELLES: Record<FiltreEtatAlerte, string> = {
  actives: 'Ouvertes ou prises en compte',
  ouverte: 'Ouvertes',
  prise_en_compte: 'Prises en compte',
  close: 'Closes',
  toutes: 'Toutes',
};
export const RechercheAlertesVulnerabilites = z
  .object({
    etat: z.enum(FILTRES_ETAT_ALERTE).default('actives'),
    niveau: z.enum(NIVEAUX_ALERTE).optional(),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();
export type RechercheAlertesVulnerabilites = z.infer<typeof RechercheAlertesVulnerabilites>;

/** Nombre d'éléments que la personne peut lire ; `horsLecture` : il y en a d'autres, qu'elle ne lit pas (sans nombre ni
    nom, lot ALH5). */
export interface NombreLisible {
  lisibles: number;
  horsLecture: boolean;
}

export interface AlerteVulnerabiliteDto {
  id: string;
  /** CVE, ou « constat:<identifiant> » pour un constat sans CVE. */
  cle: string;
  cve: string | null;
  titre: string;
  produit: string | null;
  niveau: NiveauAlerte;
  priorite: Priorite;
  presences: Presence[];
  exploitation: Signalement<SourceExploitation>[];
  etat: EtatAlerte;
  ouverteLe: string;
  /** Passage au niveau critique (création critique, ou montée), sinon null. */
  critiqueLe: string | null;
  majLe: string;
  priseEnCompte: { par: string; le: string } | null;
  cloture: { le: string; motif: MotifClotureAlerte } | null;
  /** La notification de son dernier niveau est partie (individuelle pour une critique, dans le résumé pour une simple). */
  notifiee: boolean;
  /** Machines touchées que la personne lit (alerte close : celles du dernier état connu ne sont plus comptées). */
  machines: NombreLisible;
  /** Actifs exposés sur Internet que la personne lit. */
  actifs: NombreLisible;
  /** Produits surveillés rattachés (registre de l'organisation, lisible avec le module). */
  produits: number;
  /** Lot PRIO-1 : alerte critique gardée sous exception (marque « risque accepté »). */
  risqueAccepte: boolean;
  version: number;
}

export interface PageAlertesVulnerabilites {
  elements: AlerteVulnerabiliteDto[];
  total: number;
  page: number;
  parPage: number;
  /** La personne tient le rôle RSSI (ROLE_PRISE_EN_COMPTE_ALERTE) : elle peut prendre une alerte en compte. */
  peutPrendreEnCompte: boolean;
}

/** Fenêtre d'alerte critique : alertes critiques ouvertes, pas encore prises en compte, la plus récente en tête (bornées). */
export interface FenetreAlertesDto {
  alertes: AlerteVulnerabiliteDto[];
  /** Nombre d'alertes critiques ouvertes non prises en compte (au-delà de la borne comprise). */
  total: number;
  /** Alertes critiques en cours (ouvertes ou prises en compte, non closes) : rappel de l'en-tête du module. */
  enCours: number;
  /** La personne tient le rôle RSSI (ROLE_PRISE_EN_COMPTE_ALERTE) : elle peut prendre une alerte en compte. */
  peutPrendreEnCompte: boolean;
}

/* ------------------------------------------------------------------ Libellés */
export const libellePresenceAlerte = (p: Presence) => PRESENCE_LIBELLES[p];
export function resumeExploitationAlerte(liste: readonly Signalement<SourceExploitation>[]): string {
  return liste.length ? liste.map((x) => SOURCE_EXPLOITATION_LIBELLES[x.source]).join(' · ') : 'Non avérée';
}
/** « 3 », « 3 que vous pouvez lire, et d'autres hors de vos droits », « aucune que vous puissiez lire, … ». */
export function resumeNombreLisible(n: NombreLisible, genre: 'f' | 'm' = 'f'): string {
  if (!n.horsLecture) return String(n.lisibles);
  const aucun = genre === 'f' ? 'aucune' : 'aucun';
  return n.lisibles
    ? `${n.lisibles} que vous pouvez lire, et d’autres hors de vos droits`
    : `${aucun} que vous puissiez lire (hors de vos droits)`;
}
