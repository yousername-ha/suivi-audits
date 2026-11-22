/* Module Vulnérabilités (ADR 0100, lot ALH4 ; carte « Lignes d'approche » retenue par le RSSI le 17/11/2026) : graphe de la
   surface externe rendu par une route de lecture dédiée, déjà filtré par les droits de la personne (périmètres ALH lisibles,
   instances Silène lisibles, périmètre effectif des machines), borné ; la mise en page est calculée côté interface par une
   fonction pure.
   La carte ne montre que ce qui est rangé : des hôtes et des domaines (lot ALH1), leurs alertes ouvertes, et les machines
   internes reliées par une liaison confirmée (lot ALH3). Lot ALH6 : les services (port, protocole, produit) d'un actif,
   connus par les alertes ouvertes qui les portent. Lot SI2 : deux sources. Un actif (adresse IP ou nom de domaine, clé
   `type|valeur` du lot SI1) vu par AlgoLightHouse et par Silène est un seul nœud ; un actif vu par Silène seul est rendu
   aussi ; les ports ouverts de Silène et les constats Silène qui concernent un hôte (ou un de ses ports) sont joints, sans
   priorité P1-P4 (correspondance classe → priorité en attente). */
import type { NiveauPriorite, RoleMachine } from './failles-tenable.js';
import type { PortSileneDto, ProtocoleSilene, SourceSurface } from './import-silene.js';
import type { CriticiteAlh, ServiceAlhDto, TypeActifAlh, TypeAlerteAlh, TypeCibleAlh } from './surface-externe.js';

/** Bornes de la carte : au-delà, la route rend les premiers éléments (actifs d'AlgoLightHouse portant une alerte ouverte
    d'abord, puis les autres, puis ceux de Silène seul ; alertes les plus graves d'abord) et signale la troncature. Une liaison
    d'actif mène au plus à LIAISONS_MACHINES_PAR_ACTIF_MAX machines (lot ALH3). */
export const CARTE_SURFACE_BORNES = {
  /** Actifs rendus, toutes sources confondues. */
  actifs: 3000,
  alertes: 3000,
  /** CVE gardées par alerte (pour la recherche et le libellé ; la fiche de l'alerte les donne toutes). */
  cvesParAlerte: 20,
  /** Constats Silène joints à un hôte (la fiche de l'actif les donne tous) ; `nombreConstats` en donne le total. */
  constatsParActif: 20,
} as const;

/** Machine interne reliée (liaison confirmée), lisible par la personne. */
export interface MachineCarteDto {
  id: string;
  nom: string | null;
  adresse: string | null;
  role: RoleMachine | null;
}

/** Constat Silène qui concerne un hôte, et les ports de cet hôte que ses lignes de détail citent (vide : l'hôte seul). */
export interface ConstatActifCarteDto {
  id: string;
  ports: { port: number; protocole: ProtocoleSilene | null }[];
}

/** Ce que Silène dit d'un actif de la carte (lot SI2). Les ports et les constats appartiennent à l'hôte : un nom de domaine
    n'en porte pas (ils sont sur le nœud de l'adresse vers laquelle il résout). */
export interface SileneCarteDto {
  /** Hôte : son adresse ; nom de domaine : les adresses des hôtes qui le portent par résolution directe. */
  adresses: string[];
  /** Ports ouverts de l'hôte (SERVICES_PAR_ACTIF_MAX au plus, `nombrePorts` en donne le total gardé). */
  ports: PortSileneDto[];
  nombrePorts: number;
  /** Nombre annoncé par Silène (peut dépasser les ports gardés). */
  portsOuverts: number | null;
  /** Constats présents qui concernent l'hôte (CARTE_SURFACE_BORNES.constatsParActif au plus). */
  constats: ConstatActifCarteDto[];
  nombreConstats: number;
}

/** Actif exposé lisible et présent : vu par la dernière synchronisation complète d'AlgoLightHouse, ou par le dernier import
    complet de Silène. */
export interface ActifCarteDto {
  /** Identifiant chez AlgoLightHouse ; vu par Silène seul : celui de l'hôte (ou du nom) chez Silène. */
  id: string;
  type: TypeActifAlh;
  /** Adresse IP (hôte) ou nom de domaine. */
  valeur: string;
  /** Domaine : adresse vers laquelle il résout (AlgoLightHouse, sinon la première selon Silène) ; hôte : null. */
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
  /** Services connus de l'actif par AlgoLightHouse (lot ALH6) : ceux que porte au moins une alerte ouverte et présente,
      mêmes droits de lecture que l'actif ; SERVICES_PAR_ACTIF_MAX au plus, `nombreServices` en donne le total. */
  services: ServiceAlhDto[];
  nombreServices: number;
  /** Lot SI2 : sources qui voient l'actif (ordre fixe). */
  sources: SourceSurface[];
  /** Actif d'AlgoLightHouse (fiche, machines internes) ; null : vu par Silène seul (aucune liaison possible). */
  alhId: string | null;
  /** 7.6.1 : réseau de l'hôte selon AlgoLightHouse (fournisseur, numéro de système autonome, pays, CDN), pour le
      regroupement « Hébergeur » de la carte. Absent ou null : inconnu (domaine, hôte vu par Silène seul). */
  reseau?: { asn: string | null; fai: string | null; pays: string | null; cdn: boolean | null } | null;
  /** Ce que Silène en dit ; null : Silène ne le voit pas (pour la personne). */
  silene: SileneCarteDto | null;
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

/** Constat Silène cité par au moins un actif de la carte (sans priorité : un constat Silène n'a pas de CVE). */
export interface ConstatCarteDto {
  id: string;
  identifiant: string;
  controle: string;
  classe: number;
}

export interface CarteSurfaceDto {
  actifs: ActifCarteDto[];
  alertes: AlerteCarteDto[];
  /** Lot SI2 : constats Silène cités par les actifs rendus. */
  constatsSilene: ConstatCarteDto[];
  /** Une borne a été atteinte : la carte n'est pas complète. */
  tronquee: boolean;
  /** Nombre total d'actifs (toutes sources) et d'alertes ouvertes lisibles, avant les bornes. */
  totaux: { actifs: number; alertes: number };
}
