/* Module Vulnérabilités (ADR 0100, points 15 et 16 ; lot PC2) : écran « Machines », mode « Parc » (une tuile par machine,
   rangée dans la zone de son rôle : front, back applicatif, base de données, rôle non indiqué). Fonctions pures et
   déterministes, communes à l'API (répartition et borne par zone) et à l'interface (mode réduit, « et n autres »).
   - Le rang reste celui de la plateforme (rangerMachines, priorite-vulnerabilites.ts) : chaque zone garde l'ordre du rang,
     la plus critique d'abord. Rien n'est demandé à l'assistant.
   - Marques d'une machine (V16) : « zero-day » quand elle porte une faille présente à exploitation avérée (définition du
     lot V6 : exploitation avérée et faille présente, c'est-à-dire P1 de la grille) ; « exploitable » quand elle porte une
     faille présente pour laquelle une source dit qu'un code d'exploitation existe (SOURCES_EXPLOITABLE de la grille), sans
     exploitation avérée. Priorité de la machine : la plus haute de ses failles présentes, calculée sur tous les faits connus
     (lot ALH5 : la même pour tout le monde), sans majoration par la surface externe.
   - Aucun nombre de machines illisibles : la route ne compte que les machines que la personne lit. */
import { z } from 'zod';
import {
  type MachineDto,
  NIVEAUX_PRIORITE,
  type NiveauPriorite,
  ROLE_MACHINE_LIBELLES,
  ROLES_MACHINE,
  type RoleMachine,
} from './failles-tenable.js';

/* ------------------------------------------------------------------ Affichage mémorisé (préférences de la personne) */
/** Présentation de l'écran « Machines » : la liste existante ou le parc en tuiles. */
export const VUES_MACHINES = ['liste', 'parc'] as const;
export type VueMachines = (typeof VUES_MACHINES)[number];
/** Échelle du parc : réduit (les plus prioritaires de chaque zone) ou grand écran (tout le parc reçu, tuiles denses). */
export const ECHELLES_PARC = ['reduit', 'grand'] as const;
export type EchelleParc = (typeof ECHELLES_PARC)[number];

/* ------------------------------------------------------------------ Zones */
export const ZONES_PARC = ['front', 'back', 'bdd', 'aucun'] as const;
export type ZoneParc = (typeof ZONES_PARC)[number];
export const ZONE_PARC_LIBELLES: Record<ZoneParc, string> = {
  ...ROLE_MACHINE_LIBELLES,
  aucun: 'Rôle non indiqué',
};
/** Zone d'une machine : celle de son rôle, sinon « Rôle non indiqué ». */
export const zoneParc = (role: RoleMachine | null): ZoneParc => role ?? 'aucun';

/** Borne de la route : machines rendues au plus par zone (les plus prioritaires) ; le total de la zone est toujours rendu. */
export const PARC_PAR_ZONE = 250;
/** Mode réduit : machines montrées par zone avant la tuile « et n autres ». */
export const PARC_REDUIT: Record<ZoneParc, number> = { front: 5, back: 5, bdd: 5, aucun: 8 };

/* ------------------------------------------------------------------ Marques d'une machine */
/** Une faille présente sur la machine (constat de Tenable présent ou faille déclarée, non traitée), réduite à ce qui fait
    les marques : sa priorité, son exploitation avérée, et si une source la dit exploitable. */
export interface FailleMarquee {
  niveau: NiveauPriorite;
  exploitee: boolean;
  exploitable: boolean;
  /** Lot S3 : aucun correctif connu selon les sources (jamais déduit d'une absence d'information). */
  sansCorrectif?: boolean;
}
export interface MarquesMachineDto {
  /** Priorité la plus haute des failles présentes, ou null sans faille présente. */
  priorite: NiveauPriorite | null;
  /** Marque « zero-day » : au moins une faille présente à exploitation avérée. */
  exploitationAveree: boolean;
  /** Marque « exploitable » : au moins une faille présente dite exploitable par une source, sans exploitation avérée. */
  exploitable: boolean;
  /** Lot S3, précision à côté de la marque « zero-day » : au moins une faille présente à exploitation avérée pour laquelle
      une source dit qu'aucun correctif n'existe (« exploitée, sans correctif connu »). */
  exploiteeSansCorrectif: boolean;
}
export const MARQUES_VIDES: MarquesMachineDto = {
  priorite: null,
  exploitationAveree: false,
  exploitable: false,
  exploiteeSansCorrectif: false,
};

export function marquesMachine(failles: readonly FailleMarquee[]): MarquesMachineDto {
  let rang: number = NIVEAUX_PRIORITE.length;
  let exploitationAveree = false;
  let exploitable = false;
  let exploiteeSansCorrectif = false;
  for (const f of failles) {
    rang = Math.min(rang, NIVEAUX_PRIORITE.indexOf(f.niveau));
    if (f.exploitee) {
      exploitationAveree = true;
      if (f.sansCorrectif) exploiteeSansCorrectif = true;
    } else if (f.exploitable) exploitable = true;
  }
  const priorite: NiveauPriorite | null = rang < NIVEAUX_PRIORITE.length ? NIVEAUX_PRIORITE[rang]! : null;
  return { priorite, exploitationAveree, exploitable, exploiteeSansCorrectif };
}

/** Machine lisible avec ses marques (liste et parc de l'écran « Machines »). */
export interface MachineMarqueeDto extends MachineDto {
  marques: MarquesMachineDto;
}

/* ------------------------------------------------------------------ Route du parc */
/** Filtres du parc : ceux de la liste, sans page (recherche par nom, rôle, périmètre). */
export const RechercheParc = z
  .object({
    q: z.string().trim().max(100).optional(),
    role: z.enum([...ROLES_MACHINE, 'aucun']).optional(),
    perimetre: z.union([z.uuid(), z.literal('aucun')]).optional(),
    /** Lot S3 : machines en fin de support seulement. */
    finSupport: z.enum(['oui']).optional(),
  })
  .strict();
export type RechercheParc = z.infer<typeof RechercheParc>;

export interface ZoneParcDto {
  zone: ZoneParc;
  /** Machines lisibles de la zone qui répondent aux filtres. */
  total: number;
  /** Parmi elles, celles qui portent la marque « zero-day ». */
  exploitationAveree: number;
  /** Les plus prioritaires, dans l'ordre du rang (PARC_PAR_ZONE au plus). */
  machines: MachineMarqueeDto[];
}
export interface ParcMachinesDto {
  /** Les quatre zones, toujours dans l'ordre de ZONES_PARC. */
  zones: ZoneParcDto[];
  total: number;
  parZone: number;
  /** Au moins une zone est tronquée par la borne. */
  tronquee: boolean;
}

/** Répartition par zone, dans l'ordre reçu (celui du rang), bornée par zone ; les totaux restent ceux de la zone, comme
    le nombre de machines marquées « zero-day » (marques facultatives : sans elles, zéro). */
export function repartirParc<T extends { role: RoleMachine | null; marques?: MarquesMachineDto }>(
  machines: readonly T[],
  borne: number = PARC_PAR_ZONE,
): { zone: ZoneParc; total: number; exploitationAveree: number; machines: T[] }[] {
  const zones = ZONES_PARC.map((zone) => ({ zone, total: 0, exploitationAveree: 0, machines: [] as T[] }));
  for (const m of machines) {
    const z = zones[ZONES_PARC.indexOf(zoneParc(m.role))]!;
    z.total++;
    if (m.marques?.exploitationAveree) z.exploitationAveree++;
    if (z.machines.length < borne) z.machines.push(m);
  }
  return zones;
}

/** Machines montrées dans une zone et nombre de machines résumées par la tuile « et n autres ». Réduit : les PARC_REDUIT
    premières, sauf zone dépliée ; grand écran ou zone dépliée : toutes celles reçues. Le reste compte aussi les machines
    au-delà de la borne de la route. */
export function visiblesZone<T>(
  zone: ZoneParc,
  machines: readonly T[],
  total: number,
  echelle: EchelleParc,
  deplie = false,
): { visibles: T[]; autres: number } {
  const limite = echelle === 'reduit' && !deplie ? PARC_REDUIT[zone] : machines.length;
  const visibles = machines.slice(0, limite);
  return { visibles, autres: Math.max(0, total - visibles.length) };
}
