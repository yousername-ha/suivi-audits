/* Module Vulnérabilités (ADR 0100, lot ALH4 ; carte « Lignes d'approche » retenue par le RSSI le 17/11/2026) : graphe de la
   surface externe rendu par une route de lecture dédiée, déjà filtré par les droits de la personne (périmètres ALH lisibles,
   périmètre effectif des machines), borné ; la mise en page est calculée côté interface par une fonction pure.
   La carte ne montre que ce qui est rangé : des hôtes et des domaines (lot ALH1), leurs alertes ouvertes, et les machines
   internes reliées par une liaison confirmée (lot ALH3). Lot ALH6 : les services (port, protocole, produit) d'un actif,
   connus seulement par les alertes ouvertes qui les portent (l'éditeur ne publie pas la liste des ports ouverts). */
import type { NiveauPriorite, RoleMachine } from './failles-tenable.js';
import type { CriticiteAlh, ServiceAlhDto, TypeActifAlh, TypeAlerteAlh, TypeCibleAlh } from './surface-externe.js';

/** Bornes de la carte : au-delà, la route rend les premiers éléments (actifs portant une alerte ouverte d'abord, alertes les
    plus graves d'abord) et signale la troncature. Une liaison d'actif mène au plus à LIAISONS_MACHINES_PAR_ACTIF_MAX
    machines (lot ALH3). */
export const CARTE_SURFACE_BORNES = {
  actifs: 3000,
  alertes: 3000,
  /** CVE gardées par alerte (pour la recherche et le libellé ; la fiche de l'alerte les donne toutes). */
  cvesParAlerte: 20,
} as const;

/** Machine interne reliée (liaison confirmée), lisible par la personne. */
export interface MachineCarteDto {
  id: string;
  nom: string | null;
  adresse: string | null;
  role: RoleMachine | null;
}

/** Actif exposé lisible et présent (vu par la dernière synchronisation complète de son instance). */
export interface ActifCarteDto {
  id: string;
  type: TypeActifAlh;
  /** Adresse IP (hôte) ou nom de domaine. */
  valeur: string;
  /** Domaine : adresse vers laquelle il résout ; hôte : null. */
  adresse: string | null;
  niveau: number | null;
  /** Domaine parent (identifiant interne), seulement s'il est lui aussi lisible et présent ; sinon null. */
  parentId: string | null;
  perimetreNom: string | null;
  perimetreAlh: string | null;
  /** Machines internes reliées (liaisons confirmées) que la personne peut lire. */
  machines: MachineCarteDto[];
  /** Propositions à décider dont la machine est lisible (une proposition vers une machine illisible ne se voit pas). */
  propositions: number;
  /** L'actif est aussi relié à au moins une machine que la personne ne peut pas lire (ni nommée ni comptée). */
  autresMachines: boolean;
  /** Version des liaisons de l'actif (If-Match de la fiche de l'actif). */
  versionLiaisons: number;
  /** Services connus de l'actif (lot ALH6) : ceux que porte au moins une alerte ouverte et présente, mêmes droits de
      lecture que l'actif ; SERVICES_PAR_ACTIF_MAX au plus, `nombreServices` en donne le total. */
  services: ServiceAlhDto[];
  nombreServices: number;
}

/** Alerte ouverte chez l'éditeur, lisible et présente. */
export interface AlerteCarteDto {
  id: string;
  type: TypeAlerteAlh | null;
  criticite: CriticiteAlh | null;
  titre: string;
  /** CVE citées (les premières, CARTE_SURFACE_BORNES.cvesParAlerte au plus). */
  cves: string[];
  /** Priorité calculée par la plateforme (la plus haute de ses CVE, présence « exposée ») ; null sans CVE. */
  priorite: NiveauPriorite | null;
  cible: { type: TypeCibleAlh | null; valeur: string | null } | null;
  /** Actif de la carte visé par l'alerte (null : cible absente de la carte ou non rangée). */
  actifId: string | null;
}

export interface CarteSurfaceDto {
  actifs: ActifCarteDto[];
  alertes: AlerteCarteDto[];
  /** Une borne a été atteinte : la carte n'est pas complète. */
  tronquee: boolean;
  /** Nombre total d'actifs et d'alertes ouvertes lisibles, avant les bornes. */
  totaux: { actifs: number; alertes: number };
}
