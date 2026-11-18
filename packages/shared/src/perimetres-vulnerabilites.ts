/* Module Vulnérabilités (ADR 0100, point 17 et V12 ; lot PC3) : onglet « Périmètres », poste de commandement vu par
   périmètre. Fonctions pures et déterministes, communes à l'API (agrégats d'un périmètre, tri) et à l'interface
   (présentation « au global », mode réduit, « et n autres »).
   - Une carte par périmètre que la personne lit : machines lues, priorité la plus haute, failles présentes par gravité
     (chaque faille comptée une fois par périmètre), machines marquées « zero-day » et « exploitable », machines sans rôle,
     actifs exposés sur Internet rattachés (périmètres AlgoLightHouse reliés au périmètre). Une carte « Sans périmètre »
     n'existe que pour qui administre le module (seul à lire ces machines, règle du point 14).
   - Priorité et marques des machines : celles du lot PC2 (parc-machines.ts), calculées sur tous les faits connus, les
     mêmes pour tout le monde (lot ALH5). Une machine se lit par son périmètre effectif (lot V4d) : qui lit un périmètre
     lit toutes ses machines, et deux personnes qui lisent un même périmètre en voient la même carte.
   - Détail d'un périmètre : le parc du lot PC2 restreint au périmètre (zones de rôle, borne par zone), présenté par ligne
     (front, back applicatif, base de données, rôle non indiqué, séparés par les murs) ou au global (toutes ensemble, dans
     l'ordre du rang). Aucun lien de machine à machine : aucune source ne les fournit (point ouvert 5). */
import { z } from 'zod';
import {
  GRAVITES_TENABLE,
  type GraviteTenable,
  NIVEAUX_PRIORITE,
  type NiveauPriorite,
  type RoleMachine,
} from './failles-tenable.js';
import type { MachineMarqueeDto, MarquesMachineDto, ParcMachinesDto } from './parc-machines.js';
import type { TypeActifAlh } from './surface-externe.js';

/* ------------------------------------------------------------------ Adresse et présentation */
/** Identifiant de la carte « Sans périmètre » dans l'adresse (`?perimetre=aucun`) et dans la route. */
export const PERIMETRE_AUCUN = 'aucun';
export const IdPerimetreVue = z.union([z.uuid(), z.literal(PERIMETRE_AUCUN)]);
export type IdPerimetreVue = z.infer<typeof IdPerimetreVue>;
/** Présentation du détail : par ligne (zones de rôle séparées par les murs) ou au global (toutes ensemble). */
export const PRESENTATIONS_PERIMETRE = ['lignes', 'global'] as const;
export type PresentationPerimetre = (typeof PRESENTATIONS_PERIMETRE)[number];
/** Présentation « au global », mode réduit : machines montrées avant la tuile « et n autres : tout montrer ». */
export const PERIMETRE_GLOBAL_REDUIT = 24;
/** Actifs exposés nommés au plus par machine dans le détail ; les autres actifs lisibles sont comptés (« et n autres »). */
export const EXPOSITIONS_PAR_MACHINE = 3;

/* ------------------------------------------------------------------ Cartes */
export type FaillesParGravite = Record<GraviteTenable, number>;
export const FAILLES_GRAVITE_VIDES: FaillesParGravite = { critique: 0, elevee: 0, moyenne: 0, faible: 0 };

export interface CartePerimetreDto {
  /** Identifiant du périmètre de la plateforme ; null : carte « Sans périmètre » (administration du module). */
  id: string | null;
  nom: string | null;
  /** Machines lues dont c'est le périmètre effectif. */
  machines: number;
  /** Priorité la plus haute des machines (null : aucune faille présente). */
  priorite: NiveauPriorite | null;
  /** Failles présentes (constats de Tenable non traités, failles déclarées non traitées), chacune comptée une fois. */
  failles: FaillesParGravite;
  /** Machines marquées « zero-day » (faille présente à exploitation avérée). */
  machinesExploitationAveree: number;
  /** Machines marquées « exploitable » (code d'exploitation disponible, sans exploitation avérée). */
  machinesExploitables: number;
  machinesSansRole: number;
  /** Actifs exposés sur Internet (AlgoLightHouse) présents, dont le périmètre AlgoLightHouse est relié à ce périmètre. */
  actifsExposes: number;
}

export interface PerimetresVulnerabilitesDto {
  /** Périmètres lus, du plus critique au moins critique (rangerPerimetres). */
  perimetres: CartePerimetreDto[];
  /** Carte « Sans périmètre » : seulement pour qui administre le module, sinon null. */
  sansPerimetre: CartePerimetreDto | null;
}

/** Actifs exposés lisibles reliés à une machine par une liaison confirmée (lot ALH3), bornés. */
export interface ExpositionTuileDto {
  machineId: string;
  actifs: { id: string; type: TypeActifAlh; valeur: string }[];
  /** Autres actifs lisibles reliés, au-delà de la borne. Rien d'un actif illisible n'est dit. */
  autres: number;
}

export interface DetailPerimetreDto {
  carte: CartePerimetreDto;
  /** Parc du lot PC2 restreint au périmètre (zones de rôle, borne par zone, totaux exacts). */
  parc: ParcMachinesDto;
  expositions: ExpositionTuileDto[];
}

/* ------------------------------------------------------------------ Agrégats et tri */
/** Résumé des machines d'un périmètre (machines lues seulement). */
export function resumerMachines(
  machines: readonly { role: RoleMachine | null; marques: MarquesMachineDto }[],
): Pick<
  CartePerimetreDto,
  'machines' | 'priorite' | 'machinesExploitationAveree' | 'machinesExploitables' | 'machinesSansRole'
> {
  let rang: number = NIVEAUX_PRIORITE.length;
  let zd = 0;
  let ex = 0;
  let sansRole = 0;
  for (const m of machines) {
    if (m.marques.priorite) rang = Math.min(rang, NIVEAUX_PRIORITE.indexOf(m.marques.priorite));
    if (m.marques.exploitationAveree) zd++;
    if (m.marques.exploitable) ex++;
    if (m.role === null) sansRole++;
  }
  return {
    machines: machines.length,
    priorite: rang < NIVEAUX_PRIORITE.length ? NIVEAUX_PRIORITE[rang]! : null,
    machinesExploitationAveree: zd,
    machinesExploitables: ex,
    machinesSansRole: sansRole,
  };
}

const ordrePriorite = (p: NiveauPriorite | null) => (p ? NIVEAUX_PRIORITE.indexOf(p) : NIVEAUX_PRIORITE.length);

/** Du plus critique au moins critique : priorité la plus haute, machines « zero-day », failles critiques, machines
    « exploitable », failles élevées, puis moyennes et faibles, actifs exposés, machines ; à égalité, le nom puis
    l'identifiant (ordre stable). Aucun nombre lié à ce qui est illisible n'y entre. */
export function comparerPerimetres(a: CartePerimetreDto, b: CartePerimetreDto): number {
  const cles: [number, number][] = [
    [ordrePriorite(a.priorite), ordrePriorite(b.priorite)],
    [b.machinesExploitationAveree, a.machinesExploitationAveree],
    [b.failles.critique, a.failles.critique],
    [b.machinesExploitables, a.machinesExploitables],
    ...GRAVITES_TENABLE.slice(1).map((g): [number, number] => [b.failles[g], a.failles[g]]),
    [b.actifsExposes, a.actifsExposes],
    [b.machines, a.machines],
  ];
  for (const [x, y] of cles) if (x !== y) return x - y;
  const n = (a.nom ?? '').localeCompare(b.nom ?? '', 'fr', { sensitivity: 'base' });
  if (n) return n;
  return (a.id ?? '').localeCompare(b.id ?? '');
}

export const rangerPerimetres = (cartes: readonly CartePerimetreDto[]): CartePerimetreDto[] =>
  [...cartes].sort(comparerPerimetres);

/** La carte porte au moins une machine ou un actif exposé. */
export const perimetreOccupe = (c: CartePerimetreDto) => c.machines > 0 || c.actifsExposes > 0;

/* ------------------------------------------------------------------ Présentation « au global » */
/** Toutes les machines reçues du parc, ensemble, dans l'ordre du rang (la plus critique d'abord). */
export function machinesGlobal(parc: ParcMachinesDto): MachineMarqueeDto[] {
  return parc.zones.flatMap((z) => z.machines).sort((a, b) => a.rang.position - b.rang.position);
}

/** Machines montrées au global et nombre résumé par « et n autres » (réduit : les PERIMETRE_GLOBAL_REDUIT premières, sauf
    si déplié). Le reste compte aussi les machines au-delà de la borne de la route. */
export function visiblesGlobal<T>(
  machines: readonly T[],
  total: number,
  deplie: boolean,
): { visibles: T[]; autres: number } {
  const visibles = deplie ? machines.slice() : machines.slice(0, PERIMETRE_GLOBAL_REDUIT);
  return { visibles, autres: Math.max(0, total - visibles.length) };
}
