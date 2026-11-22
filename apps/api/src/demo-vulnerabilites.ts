/* Démonstration, module Vulnérabilités : une instance Tenable Security Center fictive et le résultat de deux
   synchronisations fictives (machines avec criticité ACR et exposition AES, constats, détections), pour que les écrans
   « Vue d'ensemble », « Failles », « Machines » et « Périmètres » du module soient parlants dès le chargement.
   - Aucun appel sortant : l'instance est créée par l'API publique (`POST /api/integrations/instances`), adresse en
     .invalid, et laissée INACTIVE, SANS CLÉ ; le flux « tenable » n'est pas ouvert. Le planificateur ne retient qu'une
     instance active dont les clés sont enregistrées, flux ouvert (`SynchronisationTenable.planifier`) ; l'exécutant ne
     réclame qu'une exécution « en file » d'une instance active (`Integrations.reclamer`). Les exécutions de la
     démonstration sont terminées avant de rendre la main : aucune ne reste en file ni en cours. La remise à vide
     « travail » garde les intégrations : un nouveau chargement reprend l'instance de démonstration si elle est restée
     inactive et sans clé (le rangement sans doublon ne crée rien deux fois), et s'arrête sinon.
   - Seule écriture hors API publique de la démonstration : il n'existe pas de route qui range une synchronisation (c'est
     l'exécutant qui la rapporte, par la CLI). Le résultat est donc rangé par le chemin d'écriture de l'exécutant, avec les
     mêmes validations : inscription par le service (`Integrations.inscrire`, journalisée), passage « en cours » et numéro
     de synchronisation (`SynchronisationTenable.reclamee`) faits ici comme le fait `Integrations.reclamer` (qui refuse une
     instance inactive et rendrait ses secrets), puis lots bornés (`Integrations.lot`, éléments validés un à un par les
     schémas de packages/shared/src/failles-tenable.ts) et fin (`Integrations.terminer`, bilan validé). Aucune écriture
     directe dans les tables `vulnerabilites_*`.
   - Deux synchronisations complètes : la première, il y a une semaine, rapporte toutes les détections ; la seconde en omet
     quelques-unes, corrigées entre-temps. Le module montre ainsi des détections disparues et, pour les constats qui ne sont
     plus présents nulle part, la proposition « corrigé selon Tenable, à confirmer » (lot V4b).
   - Les dépôts sont reliés par l'API publique aux périmètres créés par le jeu (`PUT /api/vulnerabilites/depots/:id`) :
     leurs machines en héritent. Les machines de l'inventaire seul restent sans dépôt, donc sans périmètre.
   - Module Vulnérabilités ou Intégrations désactivé : la partie est sautée (bilan à zéro), sans faire échouer le chargement.
   Établissement, machines, adresses (192.0.2.0/24 et 198.51.100.0/24, réservées à la documentation), noms en .invalid,
   numéros de contrôle, CVE, intitulés et correctifs sont entièrement inventés : aucun identifiant ni texte de Tenable
   n'est recopié. Génération déterministe ; seules les dates dépendent du jour du chargement (premières détections étalées
   sur six mois, pour que délais et retards existent). */
import {
  type ElementSynchronisation,
  type GraviteTenable,
  type KitExploitation,
  TENABLE_BORNES,
  cleMachine,
} from '@suivi/shared';
import { sql } from 'kysely';
import type { ContexteDemo } from './demo-normes.js';
import type { Services } from './services.js';
import { verrouFileIntegrations } from './integrations/index.js';

type Vulnerabilites = Pick<ContexteDemo, 'appel' | 'exiger' | 'commun'>;

export interface BilanVulnerabilites {
  /** Identifiant de l'instance Tenable fictive (null : partie sautée, module désactivé). */
  instance: string | null;
  depots: number;
  /** Dépôts reliés à un périmètre du jeu. */
  depotsRattaches: number;
  machines: number;
  constats: number;
  detections: number;
  /** Détections de la première synchronisation absentes de la seconde (corrigées entre-temps). */
  detectionsDisparues: number;
  synchronisations: number;
}

export const NOM_INSTANCE_DEMO = 'Tenable Security Center (démonstration)';
const JOUR = 86400e3;
/** Instant à `jours` jours avant le chargement, à 2 h UTC (heure de passage fictive des analyses). */
const ilYa = (jours: number) => `${new Date(Date.now() - jours * JOUR).toISOString().slice(0, 10)}T02:00:00.000Z`;

/* ------------------------------------------------------------------ Dépôts */
const DEPOTS = [
  { id: '1', nom: 'Siège - serveurs, postes et équipements', perimetre: null },
  { id: '2', nom: 'Site de consultations externes', perimetre: 'Site fictif de consultations externes' },
  { id: '3', nom: 'Centre de soins de suite', perimetre: 'Centre fictif de soins de suite' },
] as const;

/* ------------------------------------------------------------------ Machines */
const LINUX = 'Exemple Linux 9 (noyau 5.14)';
const WS22 = 'Windows Server 2022 Standard';
const WS19 = 'Windows Server 2019 Standard';
const WS12 = 'Windows Server 2012 R2 Standard';
const W11 = 'Windows 11 Entreprise';
const W10 = 'Windows 10 Entreprise';
const W7 = 'Windows 7 Professionnel';
const EMBARQUE = 'Système embarqué d’équipement biomédical';
const PAREFEU = 'Système de pare-feu générique';
const IMPRIMANTE = 'Système d’imprimante réseau';

interface MachineDemo {
  code: string;
  adresse: string;
  systeme: string;
  acr: number | null;
  aes: number | null;
  externe?: boolean;
  /** Dépôt (indice dans DEPOTS) ; absent : machine de l'inventaire seul. */
  depot?: number;
  /** Identifiée par son adresse et son nom (sans UUID dans Tenable), comme certaines imprimantes. */
  sansUuid?: boolean;
}

/** Machines vues par l'analyse : serveurs, postes, équipements biomédicaux, réseau et impression. */
const MACHINES: MachineDemo[] = [
  // Siège : dossier patient, annuaire, messagerie, sauvegarde, fichiers, impression, réseau, supervision.
  { code: 'dpi-app-01', adresse: '192.0.2.10', systeme: LINUX, acr: 10, aes: 880, depot: 0 },
  { code: 'dpi-app-02', adresse: '192.0.2.11', systeme: LINUX, acr: 10, aes: 860, depot: 0 },
  { code: 'dpi-bdd-01', adresse: '192.0.2.12', systeme: LINUX, acr: 9, aes: 720, depot: 0 },
  { code: 'dpi-web-01', adresse: '198.51.100.10', systeme: LINUX, acr: 9, aes: 940, externe: true, depot: 0 },
  { code: 'ad-dc-01', adresse: '192.0.2.20', systeme: WS22, acr: 10, aes: 810, depot: 0 },
  { code: 'ad-dc-02', adresse: '192.0.2.21', systeme: WS22, acr: 10, aes: 790, depot: 0 },
  { code: 'mail-01', adresse: '192.0.2.25', systeme: WS19, acr: 8, aes: 690, depot: 0 },
  { code: 'mail-relais-01', adresse: '198.51.100.25', systeme: LINUX, acr: 7, aes: 760, externe: true, depot: 0 },
  { code: 'sauv-01', adresse: '192.0.2.30', systeme: WS22, acr: 8, aes: 420, depot: 0 },
  { code: 'sauv-02', adresse: '192.0.2.31', systeme: WS22, acr: 8, aes: 380, depot: 0 },
  { code: 'fichiers-01', adresse: '192.0.2.35', systeme: WS19, acr: 6, aes: 510, depot: 0 },
  { code: 'imp-srv-01', adresse: '192.0.2.36', systeme: WS12, acr: 4, aes: 300, depot: 0 },
  { code: 'fw-ext-01', adresse: '198.51.100.1', systeme: PAREFEU, acr: 9, aes: 970, externe: true, depot: 0 },
  { code: 'fw-int-01', adresse: '192.0.2.1', systeme: PAREFEU, acr: 8, aes: 450, depot: 0 },
  { code: 'vpn-01', adresse: '198.51.100.5', systeme: PAREFEU, acr: 8, aes: 900, externe: true, depot: 0 },
  { code: 'supervision-01', adresse: '192.0.2.40', systeme: LINUX, acr: 5, aes: 330, depot: 0 },
  // Siège : postes d'accueil et de soins.
  { code: 'accueil-pc-01', adresse: '192.0.2.101', systeme: W11, acr: 3, aes: 220, depot: 0 },
  { code: 'accueil-pc-02', adresse: '192.0.2.102', systeme: W11, acr: 3, aes: 240, depot: 0 },
  { code: 'accueil-pc-03', adresse: '192.0.2.103', systeme: W11, acr: 3, aes: null, depot: 0 },
  { code: 'soins-pc-01', adresse: '192.0.2.111', systeme: W10, acr: 5, aes: 410, depot: 0 },
  { code: 'soins-pc-02', adresse: '192.0.2.112', systeme: W10, acr: 5, aes: 390, depot: 0 },
  { code: 'soins-pc-03', adresse: '192.0.2.113', systeme: W10, acr: 5, aes: 120, depot: 0 },
  { code: 'soins-pc-04', adresse: '192.0.2.114', systeme: W10, acr: null, aes: null, depot: 0 },
  // Siège : équipements biomédicaux et imprimantes.
  { code: 'bio-perfusion-01', adresse: '192.0.2.150', systeme: EMBARQUE, acr: 9, aes: 560, depot: 0 },
  { code: 'bio-imagerie-01', adresse: '192.0.2.151', systeme: W7, acr: 9, aes: 600, depot: 0 },
  { code: 'bio-labo-01', adresse: '192.0.2.152', systeme: W10, acr: 7, aes: 350, depot: 0 },
  { code: 'imp-accueil-01', adresse: '192.0.2.200', systeme: IMPRIMANTE, acr: 1, aes: 90, depot: 0, sansUuid: true },
  { code: 'imp-soins-01', adresse: '192.0.2.201', systeme: IMPRIMANTE, acr: 2, aes: 60, depot: 0, sansUuid: true },
  // Site de consultations externes.
  { code: 'cs-srv-01', adresse: '192.0.2.60', systeme: WS22, acr: 6, aes: 470, depot: 1 },
  { code: 'cs-pc-01', adresse: '192.0.2.161', systeme: W11, acr: 4, aes: 260, depot: 1 },
  { code: 'cs-pc-02', adresse: '192.0.2.162', systeme: W11, acr: 4, aes: 0, depot: 1 },
  { code: 'cs-imp-01', adresse: '192.0.2.202', systeme: IMPRIMANTE, acr: 1, aes: 30, depot: 1, sansUuid: true },
  { code: 'cs-portail-01', adresse: '198.51.100.60', systeme: LINUX, acr: 7, aes: 830, externe: true, depot: 1 },
  // Centre de soins de suite.
  { code: 'ssr-srv-01', adresse: '192.0.2.70', systeme: WS22, acr: 6, aes: 440, depot: 2 },
  { code: 'ssr-pc-01', adresse: '192.0.2.171', systeme: W11, acr: 4, aes: 200, depot: 2 },
  { code: 'ssr-pc-02', adresse: '192.0.2.172', systeme: W11, acr: 2, aes: 150, depot: 2 },
  { code: 'ssr-bio-01', adresse: '192.0.2.153', systeme: EMBARQUE, acr: 8, aes: 520, depot: 2 },
  { code: 'ssr-wifi-01', adresse: '192.0.2.5', systeme: PAREFEU, acr: null, aes: 640, depot: 2 },
];

/** Machines connues de l'inventaire de Tenable seulement (`type: 'hote'`) : aucune détection, aucun dépôt. */
const INVENTAIRE = [
  { code: 'poste-stock-01', adresse: '192.0.2.120', systeme: W11 },
  { code: 'serveur-essai-01', adresse: '192.0.2.80', systeme: LINUX },
  { code: 'passerelle-tel-01', adresse: '192.0.2.90', systeme: LINUX },
  { code: 'ancien-dpi-01', adresse: '192.0.2.13', systeme: LINUX },
];

const nomMachine = (code: string) => `${code}.exemple.invalid`;
const uuidDemo = (n: number, famille: 'a' | 'b') =>
  `d3e00000-0000-4000-${famille === 'a' ? '8' : '9'}000-${n.toString(16).padStart(12, '0')}`;
const POSTES = [
  'accueil-pc-01',
  'accueil-pc-02',
  'accueil-pc-03',
  'soins-pc-01',
  'soins-pc-02',
  'soins-pc-03',
  'soins-pc-04',
  'cs-pc-01',
  'cs-pc-02',
  'ssr-pc-01',
  'ssr-pc-02',
];

/* ------------------------------------------------------------------ Constats */
const VECTEURS = {
  v100: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H',
  v98: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
  v90: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:C/C:H/I:H/A:H',
  v88: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:H',
  v88l: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H',
  v86: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:L',
  v81: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H',
  v78: 'CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H',
  v75: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H',
  v65: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N',
  v59: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:N/A:N',
  v53: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N',
  v43: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:N/A:N',
  v37: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N',
} as const;

interface ConstatDemo {
  plugin: string;
  nom: string;
  gravite: GraviteTenable;
  famille: string;
  synopsis: string;
  correctif: string;
  cvss?: [keyof typeof VECTEURS, number];
  vpr?: number;
  epss?: number;
  exploitable?: boolean;
  kits?: KitExploitation[];
  /** Nombre de CVE inventées rattachées (0 : constat sans CVE). */
  cves: number;
  /** Ancienneté de la première détection, en jours. */
  age: number;
  /** Fin de support selon Tenable, en jours avant le chargement. */
  finSupport?: number;
  /** Correctif de l'éditeur non publié. */
  sansCorrectif?: boolean;
  port: number;
  protocole?: string;
  sur: string[];
}

const CONSTATS: ConstatDemo[] = [
  // Critiques.
  {
    plugin: '990101',
    nom: 'Serveur d’application du dossier patient : exécution de code à distance sans authentification',
    gravite: 'critique',
    famille: 'Serveurs d’application',
    synopsis: 'Le serveur d’application fictif accepte une requête forgée qui permet d’exécuter du code sans compte.',
    correctif: 'Appliquer la version corrective de l’éditeur et restreindre l’accès à l’interface d’administration.',
    cvss: ['v98', 9.8],
    vpr: 9.4,
    epss: 0.92,
    exploitable: true,
    kits: ['metasploit', 'core_impact'],
    cves: 2,
    age: 12,
    port: 8443,
    sur: ['dpi-app-01', 'dpi-app-02', 'dpi-web-01', 'cs-portail-01'],
  },
  {
    plugin: '990102',
    nom: 'Annuaire : élévation de privilèges par le service d’authentification',
    gravite: 'critique',
    famille: 'Windows',
    synopsis:
      'Un compte du domaine peut obtenir les droits d’administrateur du domaine par le service d’authentification.',
    correctif: 'Installer la mise à jour de sécurité du système et vérifier les comptes à privilèges.',
    cvss: ['v90', 9.0],
    vpr: 9.0,
    epss: 0.71,
    exploitable: true,
    kits: ['metasploit'],
    cves: 1,
    age: 45,
    port: 445,
    sur: ['ad-dc-01', 'ad-dc-02'],
  },
  {
    plugin: '990103',
    nom: 'Pare-feu : contournement de l’authentification de l’interface d’administration',
    gravite: 'critique',
    famille: 'Pare-feu',
    synopsis: 'L’interface d’administration du pare-feu fictif peut être atteinte sans authentification.',
    correctif: 'Mettre à jour le système du pare-feu et fermer l’interface d’administration côté Internet.',
    cvss: ['v98', 9.8],
    vpr: 9.7,
    epss: 0.95,
    exploitable: true,
    kits: ['canvas'],
    cves: 1,
    age: 9,
    port: 443,
    sur: ['fw-ext-01', 'vpn-01'],
  },
  {
    plugin: '990104',
    nom: 'Système Windows 7 en fin de support',
    gravite: 'critique',
    famille: 'Windows',
    synopsis: 'Le système n’est plus maintenu par l’éditeur : aucun correctif de sécurité n’est publié.',
    correctif: 'Remplacer le poste de la console ou isoler l’équipement dans un réseau dédié.',
    cves: 0,
    age: 178,
    finSupport: 1400,
    port: 0,
    sur: ['bio-imagerie-01'],
  },
  {
    plugin: '990105',
    nom: 'Bibliothèque de journalisation : exécution de code à distance',
    gravite: 'critique',
    famille: 'Divers',
    synopsis: 'Une bibliothèque de journalisation embarquée interprète des données reçues et peut exécuter du code.',
    correctif: 'Mettre à jour la bibliothèque dans les applications concernées, ou désactiver la fonction en cause.',
    cvss: ['v100', 10.0],
    vpr: 9.2,
    epss: 0.88,
    exploitable: true,
    kits: ['metasploit'],
    cves: 2,
    age: 160,
    port: 8080,
    sur: ['dpi-app-01', 'dpi-app-02', 'supervision-01', 'cs-srv-01', 'ssr-srv-01'],
  },
  {
    plugin: '990106',
    nom: 'Messagerie : exécution de code à distance par une requête forgée',
    gravite: 'critique',
    famille: 'Messagerie',
    synopsis: 'Le service web de la messagerie fictive traite une requête forgée qui permet d’exécuter du code.',
    correctif: 'Appliquer la mise à jour cumulative de la messagerie.',
    cvss: ['v98', 9.8],
    vpr: 8.9,
    epss: 0.6,
    exploitable: true,
    cves: 1,
    age: 30,
    port: 443,
    sur: ['mail-01', 'mail-relais-01'],
  },
  {
    plugin: '990107',
    nom: 'Système Windows 10 en fin de support',
    gravite: 'critique',
    famille: 'Windows',
    synopsis: 'Le système n’est plus maintenu par l’éditeur : aucun correctif de sécurité n’est publié.',
    correctif: 'Migrer les postes vers une version maintenue du système.',
    cves: 0,
    age: 120,
    finSupport: 400,
    port: 0,
    sur: ['soins-pc-01', 'soins-pc-02', 'soins-pc-03', 'soins-pc-04'],
  },
  // Élevées.
  {
    plugin: '990111',
    nom: 'Mise à jour de sécurité cumulative du système Windows manquante',
    gravite: 'elevee',
    famille: 'Windows',
    synopsis: 'La dernière mise à jour de sécurité mensuelle du système n’est pas installée.',
    correctif: 'Installer la mise à jour cumulative du mois et redémarrer la machine.',
    cvss: ['v88', 8.8],
    vpr: 7.4,
    epss: 0.12,
    cves: 4,
    age: 20,
    port: 445,
    sur: [
      ...POSTES,
      'ad-dc-01',
      'ad-dc-02',
      'mail-01',
      'fichiers-01',
      'imp-srv-01',
      'cs-srv-01',
      'ssr-srv-01',
      'sauv-01',
      'sauv-02',
    ],
  },
  {
    plugin: '990112',
    nom: 'Navigateur web : plusieurs failles de corruption de mémoire',
    gravite: 'elevee',
    famille: 'Postes de travail',
    synopsis: 'La version installée du navigateur contient plusieurs failles corrigées par l’éditeur.',
    correctif: 'Mettre à jour le navigateur vers la dernière version.',
    cvss: ['v88', 8.8],
    vpr: 6.7,
    epss: 0.05,
    cves: 3,
    age: 14,
    port: 0,
    sur: [...POSTES, 'bio-imagerie-01', 'bio-labo-01'],
  },
  {
    plugin: '990113',
    nom: 'Serveur de base de données : exécution de commandes par un utilisateur authentifié',
    gravite: 'elevee',
    famille: 'Bases de données',
    synopsis: 'Un compte de la base peut faire exécuter des commandes au système par une fonction mal contrôlée.',
    correctif: 'Mettre à jour le serveur de base de données et retirer les droits inutiles des comptes applicatifs.',
    cvss: ['v88l', 8.8],
    vpr: 6.1,
    epss: 0.03,
    cves: 1,
    age: 95,
    port: 5432,
    sur: ['dpi-bdd-01'],
  },
  {
    plugin: '990114',
    nom: 'Protocole de partage de fichiers en version 1 activé',
    gravite: 'elevee',
    famille: 'Windows',
    synopsis:
      'La machine accepte une ancienne version du protocole de partage de fichiers, exposée à des attaques connues.',
    correctif: 'Désactiver la version 1 du protocole après avoir vérifié les équipements qui en dépendent.',
    cvss: ['v81', 8.1],
    vpr: 5.9,
    epss: 0.34,
    exploitable: true,
    kits: ['metasploit'],
    cves: 1,
    age: 170,
    port: 445,
    sur: ['bio-labo-01', 'bio-imagerie-01', 'imp-srv-01', 'fichiers-01'],
  },
  {
    plugin: '990115',
    nom: 'Service d’accès à distance : déni de service et fuite de mémoire',
    gravite: 'elevee',
    famille: 'Pare-feu',
    synopsis:
      'Une requête forgée peut interrompre le service d’accès à distance ou divulguer une partie de sa mémoire.',
    correctif: 'Mettre à jour le système de la passerelle d’accès à distance.',
    cvss: ['v75', 7.5],
    vpr: 6.5,
    epss: 0.2,
    exploitable: true,
    cves: 1,
    age: 60,
    port: 443,
    sur: ['vpn-01'],
  },
  {
    plugin: '990116',
    nom: 'Logiciel de sauvegarde : exécution de code par l’agent de sauvegarde',
    gravite: 'elevee',
    famille: 'Sauvegarde',
    synopsis: 'Le service de l’agent de sauvegarde fictif accepte des commandes d’un client non authentifié du réseau.',
    correctif: 'Appliquer le correctif de l’éditeur et limiter l’accès au port de l’agent aux serveurs de sauvegarde.',
    cvss: ['v88l', 8.8],
    vpr: 8.1,
    epss: 0.4,
    exploitable: true,
    cves: 1,
    age: 25,
    port: 9392,
    sur: ['sauv-01', 'sauv-02'],
  },
  {
    plugin: '990117',
    nom: 'Équipement biomédical : identifiants d’administration par défaut',
    gravite: 'elevee',
    famille: 'Équipements médicaux',
    synopsis: 'L’équipement accepte les identifiants d’administration livrés par le fabricant.',
    correctif: 'Changer les identifiants avec le fabricant et restreindre l’accès au réseau biomédical.',
    cvss: ['v86', 8.6],
    vpr: 6.9,
    epss: 0.08,
    cves: 1,
    age: 150,
    sansCorrectif: true,
    port: 23,
    sur: ['bio-perfusion-01', 'ssr-bio-01'],
  },
  {
    plugin: '990118',
    nom: 'Système Windows Server 2012 R2 en fin de support',
    gravite: 'elevee',
    famille: 'Windows',
    synopsis: 'Le système n’est plus maintenu par l’éditeur : aucun correctif de sécurité n’est publié.',
    correctif: 'Migrer le serveur d’impression vers une version maintenue du système.',
    cves: 0,
    age: 140,
    finSupport: 1100,
    port: 0,
    sur: ['imp-srv-01'],
  },
  {
    plugin: '990119',
    nom: 'Interpréteur de scripts web : plusieurs failles',
    gravite: 'elevee',
    famille: 'Serveurs web',
    synopsis: 'La version de l’interpréteur de scripts du serveur web contient plusieurs failles corrigées.',
    correctif: 'Mettre à jour l’interpréteur vers la dernière version maintenue.',
    cvss: ['v75', 7.5],
    vpr: 5.2,
    epss: 0.02,
    cves: 2,
    age: 75,
    port: 443,
    sur: ['cs-portail-01', 'dpi-web-01'],
  },
  {
    plugin: '990120',
    nom: 'Suite bureautique : exécution de code à l’ouverture d’un document',
    gravite: 'elevee',
    famille: 'Postes de travail',
    synopsis: 'Un document piégé peut exécuter du code à son ouverture dans la suite bureautique.',
    correctif: 'Installer la mise à jour de sécurité de la suite bureautique.',
    cvss: ['v78', 7.8],
    vpr: 7.1,
    epss: 0.15,
    exploitable: true,
    cves: 2,
    age: 35,
    port: 0,
    sur: POSTES,
  },
  // Moyennes.
  {
    plugin: '990121',
    nom: 'Certificat TLS expiré',
    gravite: 'moyenne',
    famille: 'Chiffrement',
    synopsis: 'Le certificat présenté par le service a dépassé sa date de validité.',
    correctif: 'Renouveler le certificat auprès de l’autorité de certification de l’établissement.',
    cvss: ['v53', 5.3],
    cves: 0,
    age: 50,
    port: 443,
    sur: ['mail-relais-01', 'cs-portail-01', 'supervision-01'],
  },
  {
    plugin: '990122',
    nom: 'Suites de chiffrement TLS faibles acceptées',
    gravite: 'moyenne',
    famille: 'Chiffrement',
    synopsis: 'Le service accepte des suites de chiffrement considérées comme faibles.',
    correctif: 'Restreindre la configuration aux suites de chiffrement recommandées.',
    cvss: ['v59', 5.9],
    cves: 0,
    age: 175,
    port: 443,
    sur: ['fw-int-01', 'mail-01', 'fichiers-01', 'sauv-01', 'ssr-srv-01'],
  },
  {
    plugin: '990123',
    nom: 'Signature des échanges de partage de fichiers non exigée',
    gravite: 'moyenne',
    famille: 'Windows',
    synopsis: 'Le serveur n’exige pas la signature des échanges, ce qui permet de les relayer.',
    correctif: 'Exiger la signature des échanges par une stratégie de groupe.',
    cvss: ['v53', 5.3],
    cves: 0,
    age: 165,
    port: 445,
    sur: ['fichiers-01', 'imp-srv-01', 'cs-srv-01', 'ssr-srv-01', 'sauv-02'],
  },
  {
    plugin: '990124',
    nom: 'Serveur SSH : algorithmes d’échange de clés faibles',
    gravite: 'moyenne',
    famille: 'Accès à distance',
    synopsis: 'Le serveur SSH propose des algorithmes d’échange de clés dépassés.',
    correctif: 'Retirer les algorithmes dépassés de la configuration du serveur SSH.',
    cvss: ['v59', 5.9],
    vpr: 4.4,
    epss: 0.01,
    cves: 1,
    age: 130,
    port: 22,
    sur: ['dpi-app-01', 'dpi-app-02', 'dpi-bdd-01', 'supervision-01', 'sauv-01', 'sauv-02', 'fw-int-01'],
  },
  {
    plugin: '990125',
    nom: 'Serveur web : divulgation de la version dans les en-têtes',
    gravite: 'moyenne',
    famille: 'Serveurs web',
    synopsis: 'Le serveur web indique sa version exacte dans les en-têtes de réponse.',
    correctif: 'Masquer la version dans la configuration du serveur web.',
    cvss: ['v53', 5.3],
    vpr: 2.2,
    epss: 0.01,
    cves: 1,
    age: 110,
    port: 443,
    sur: ['dpi-web-01', 'cs-portail-01', 'supervision-01'],
  },
  {
    plugin: '990126',
    nom: 'Imprimante réseau : interface d’administration sans chiffrement',
    gravite: 'moyenne',
    famille: 'Imprimantes',
    synopsis: 'L’interface d’administration de l’imprimante est accessible en clair sur le réseau.',
    correctif: 'Activer l’accès chiffré et désactiver l’accès en clair.',
    cvss: ['v65', 6.5],
    cves: 0,
    age: 155,
    port: 80,
    sur: ['imp-accueil-01', 'imp-soins-01', 'cs-imp-01'],
  },
  {
    plugin: '990127',
    nom: 'Service de temps : réponse aux requêtes d’information',
    gravite: 'moyenne',
    famille: 'Réseau',
    synopsis: 'Le service de temps répond à des requêtes d’information utilisables pour amplifier une attaque.',
    correctif: 'Limiter les requêtes d’information du service de temps au réseau d’administration.',
    cvss: ['v53', 5.3],
    vpr: 3.6,
    epss: 0.02,
    cves: 1,
    age: 90,
    port: 123,
    protocole: 'UDP',
    sur: ['fw-int-01', 'ad-dc-01', 'ad-dc-02'],
  },
  {
    plugin: '990128',
    nom: 'Bibliothèque de compression : lecture hors limites',
    gravite: 'moyenne',
    famille: 'Divers',
    synopsis: 'Une donnée compressée forgée peut faire lire la mémoire hors des limites prévues.',
    correctif: 'Mettre à jour la bibliothèque de compression du système.',
    cvss: ['v65', 6.5],
    vpr: 3.6,
    epss: 0.01,
    cves: 1,
    age: 40,
    port: 0,
    sur: ['dpi-app-01', 'dpi-app-02', 'dpi-bdd-01', 'cs-srv-01', 'ssr-srv-01', 'supervision-01'],
  },
  {
    plugin: '990129',
    nom: 'Équipement biomédical : service Telnet actif',
    gravite: 'moyenne',
    famille: 'Équipements médicaux',
    synopsis: 'L’équipement expose un service d’administration en clair.',
    correctif: 'Faire désactiver le service par le fabricant, ou le filtrer sur le réseau biomédical.',
    cvss: ['v65', 6.5],
    cves: 0,
    age: 145,
    sansCorrectif: true,
    port: 23,
    sur: ['bio-perfusion-01', 'bio-labo-01', 'ssr-bio-01'],
  },
  {
    plugin: '990130',
    nom: 'Lecteur de documents : plusieurs failles',
    gravite: 'moyenne',
    famille: 'Postes de travail',
    synopsis: 'La version installée du lecteur de documents contient plusieurs failles corrigées.',
    correctif: 'Mettre à jour le lecteur de documents.',
    cvss: ['v65', 6.5],
    vpr: 4.9,
    epss: 0.02,
    cves: 2,
    age: 28,
    port: 0,
    sur: POSTES,
  },
  // Faibles.
  {
    plugin: '990131',
    nom: 'Réponse aux requêtes d’horodatage du réseau',
    gravite: 'faible',
    famille: 'Réseau',
    synopsis: 'La machine répond aux requêtes d’horodatage, ce qui renseigne sur son horloge.',
    correctif: 'Filtrer les requêtes d’horodatage entrantes.',
    cvss: ['v37', 3.7],
    cves: 1,
    age: 172,
    port: 0,
    protocole: 'ICMP',
    sur: ['fw-ext-01', 'fw-int-01', 'imp-accueil-01', 'imp-soins-01'],
  },
  {
    plugin: '990132',
    nom: 'Serveur SSH : algorithmes d’intégrité faibles',
    gravite: 'faible',
    famille: 'Accès à distance',
    synopsis: 'Le serveur SSH propose des algorithmes d’intégrité dépassés.',
    correctif: 'Retirer les algorithmes dépassés de la configuration du serveur SSH.',
    cvss: ['v37', 3.7],
    cves: 0,
    age: 125,
    port: 22,
    sur: ['dpi-app-01', 'sauv-01', 'fw-int-01'],
  },
  {
    plugin: '990133',
    nom: 'Serveur de messagerie : version annoncée dans la bannière',
    gravite: 'faible',
    famille: 'Messagerie',
    synopsis: 'Le serveur de messagerie annonce sa version à la connexion.',
    correctif: 'Retirer la version de la bannière du serveur.',
    cves: 0,
    age: 100,
    port: 25,
    sur: ['mail-01', 'mail-relais-01'],
  },
  {
    plugin: '990134',
    nom: 'Cookie de session sans attribut de sécurité',
    gravite: 'faible',
    famille: 'Serveurs web',
    synopsis:
      'Le cookie de session de l’application est envoyé sans l’attribut qui le réserve aux connexions chiffrées.',
    correctif: 'Ajouter l’attribut de sécurité au cookie de session.',
    cvss: ['v43', 4.3],
    cves: 0,
    age: 65,
    port: 443,
    sur: ['cs-portail-01', 'dpi-web-01'],
  },
  {
    plugin: '990135',
    nom: 'Serveur web : liste des répertoires activée',
    gravite: 'faible',
    famille: 'Serveurs web',
    synopsis: 'Le serveur web affiche le contenu de certains répertoires.',
    correctif: 'Désactiver la liste des répertoires dans la configuration du serveur web.',
    cvss: ['v53', 5.3],
    cves: 0,
    age: 80,
    port: 80,
    sur: ['supervision-01'],
  },
  {
    plugin: '990136',
    nom: 'Liste des partages réseau accessible sans compte',
    gravite: 'faible',
    famille: 'Windows',
    synopsis: 'La liste des partages réseau peut être lue sans authentification.',
    correctif: 'Interdire les connexions anonymes par une stratégie de groupe.',
    cvss: ['v53', 5.3],
    cves: 0,
    age: 115,
    port: 445,
    sur: ['fichiers-01', 'cs-srv-01'],
  },
  {
    plugin: '990137',
    nom: 'Protocole de résolution de noms local activé',
    gravite: 'faible',
    famille: 'Postes de travail',
    synopsis: 'Le poste répond à un protocole de résolution de noms local qui peut être détourné sur le réseau.',
    correctif: 'Désactiver le protocole par une stratégie de groupe.',
    cves: 0,
    age: 55,
    port: 5355,
    protocole: 'UDP',
    sur: POSTES,
  },
];

/** Détections atténuées, à risque accepté ou requalifié selon Tenable (`plugin:machine`). */
const ATTENUEES = new Set(['990103:vpn-01', '990114:bio-imagerie-01', '990105:supervision-01']);
const ACCEPTEES = new Set(['990104:bio-imagerie-01', '990117:bio-perfusion-01', '990129:bio-labo-01']);
const REQUALIFIEES = new Set(['990122:fw-int-01', '990131:fw-ext-01']);

/** Corrigé entre les deux synchronisations : constats absents partout de la seconde (propositions « corrigée ») … */
const CONSTATS_CORRIGES = new Set(['990106', '990119', '990128']);
/** … et détections absentes de la seconde, sur des constats encore présents ailleurs. */
const DETECTIONS_CORRIGEES = new Set([
  '990111:accueil-pc-01',
  '990111:accueil-pc-02',
  '990111:cs-pc-01',
  '990112:soins-pc-01',
  '990112:ssr-pc-02',
  '990124:sauv-01',
  '990105:cs-srv-01',
  '990131:imp-soins-01',
  '990120:accueil-pc-03',
]);

/* ------------------------------------------------------------------ Éléments d'une synchronisation */
function cleDe(code: string): string {
  const i = MACHINES.findIndex((m) => m.code === code);
  if (i < 0) throw new Error(`Machine inconnue du jeu : ${code}`);
  const m = MACHINES[i]!;
  return cleMachine(m.sansUuid ? null : uuidDemo(i + 1, 'a'), m.adresse, nomMachine(m.code))!;
}

/** CVE inventées, numérotées à la suite dans une plage haute que le jeu réserve à la fiction. */
const CVES = new Map(
  CONSTATS.map((c, i) => {
    const debut = CONSTATS.slice(0, i).reduce((n, x) => n + x.cves, 0);
    return [c.plugin, Array.from({ length: c.cves }, (_, j) => `CVE-2026-99${String(debut + j + 1).padStart(5, '0')}`)];
  }),
);

/** Éléments d'une synchronisation : machines, constats, détections, puis inventaire. `seconde` : sans ce qui a été
    corrigé entre-temps ; vue à l'instant `derniere`. */
export function elementsSynchronisation(seconde: boolean, derniere: string): ElementSynchronisation[] {
  const detections: ElementSynchronisation[] = [];
  const premieres = new Map<string, string>();
  for (const c of CONSTATS) {
    if (seconde && CONSTATS_CORRIGES.has(c.plugin)) continue;
    c.sur.forEach((code, n) => {
      const cle = `${c.plugin}:${code}`;
      if (seconde && DETECTIONS_CORRIGEES.has(cle)) return;
      // Première détection étalée de quelques jours d'une machine à l'autre, jamais après la première synchronisation.
      const premiere = ilYa(Math.max(8, c.age - (n % 4)));
      const machine = cleDe(code);
      if (!premieres.has(machine) || premieres.get(machine)! > premiere) premieres.set(machine, premiere);
      detections.push({
        type: 'detection',
        plugin: c.plugin,
        machine,
        port: c.port,
        protocole: c.protocole ?? 'TCP',
        premiere,
        derniere,
        attenue: ATTENUEES.has(cle),
        risqueAccepte: ACCEPTEES.has(cle),
        risqueRequalifie: REQUALIFIEES.has(cle),
      });
    });
  }
  const machines: ElementSynchronisation[] = MACHINES.map((m, i) => {
    const uuid = m.sansUuid ? null : uuidDemo(i + 1, 'a');
    const cle = cleMachine(uuid, m.adresse, nomMachine(m.code))!;
    const d = m.depot === undefined ? null : DEPOTS[m.depot]!;
    return {
      type: 'machine',
      cle,
      uuid,
      nom: nomMachine(m.code),
      adresse: m.adresse,
      systeme: m.systeme,
      premiere: premieres.get(cle) ?? ilYa(180),
      derniere,
      exposition: m.externe ? 'external' : 'internal',
      acr: m.acr,
      aes: m.aes,
      depot: d ? { id: d.id, nom: d.nom } : null,
    };
  });
  const constats: ElementSynchronisation[] = CONSTATS.filter((c) => !(seconde && CONSTATS_CORRIGES.has(c.plugin))).map(
    (c) => {
      const failleLe = ilYa(c.age + 20);
      return {
        type: 'constat',
        plugin: c.plugin,
        nom: c.nom,
        gravite: c.gravite,
        famille: c.famille,
        synopsis: c.synopsis,
        correctif: c.correctif,
        cvss3Vecteur: c.cvss ? VECTEURS[c.cvss[0]] : null,
        cvss3Score: c.cvss ? c.cvss[1] : null,
        vpr: c.vpr ?? null,
        epss: c.epss ?? null,
        exploitable: c.exploitable ?? false,
        exploitLibelle: c.exploitable ? 'Code d’exploitation disponible (démonstration)' : null,
        ...(c.kits ? { kitsExploitation: c.kits } : {}),
        failleLe: c.finSupport === undefined ? failleLe : null,
        correctifLe: c.finSupport === undefined && !c.sansCorrectif ? ilYa(c.age + 17) : null,
        finSupportLe: c.finSupport === undefined ? null : ilYa(c.finSupport),
        voirAussi: `https://editeur.exemple.invalid/avis/${c.plugin}`,
        cves: CVES.get(c.plugin)!,
        cvesTronquees: false,
      };
    },
  );
  const hotes: ElementSynchronisation[] = INVENTAIRE.map((h, i) => ({
    type: 'hote',
    uuid: uuidDemo(i + 1, 'b'),
    tenableUuid: null,
    nom: nomMachine(h.code),
    adresse: h.adresse,
    systeme: h.systeme,
    premiere: ilYa(200 - 30 * i),
    derniere,
  }));
  return [...machines, ...constats, ...detections, ...hotes];
}

/* ------------------------------------------------------------------ Rangement par le chemin de l'exécutant */
/** Une synchronisation complète : inscrite par le service, passée « en cours » et numérotée comme à sa réclamation, puis
    lots bornés et fin avec un bilan cohérent. En cas d'échec, l'exécution est close en échec (rien ne reste en cours). */
async function synchroniser(
  svc: Services,
  instance: { id: string; type: 'tenable'; nom: string },
  elements: ElementSynchronisation[],
  compte: string,
): Promise<void> {
  const id = await svc.db.tx(async (c, k) => {
    await verrouFileIntegrations(k);
    const r = await svc.integrations.inscrire(k, c, instance, 'synchroniser', 'manuel', { username: compte }, null);
    // Ce que fait `Integrations.reclamer` pour une instance active, dans la même transaction que l'inscription : la
    // demande n'est jamais visible « en file » par l'exécutant.
    await k
      .updateTable('integration_executions')
      .set({ etat: 'en_cours', debute_le: sql<Date>`now()` })
      .where('id', '=', r.id)
      .execute();
    await svc.vulnerabilites.tenable.reclamee(k, r.id, instance.id);
    return r.id;
  }, compte);
  try {
    for (let i = 0; i < elements.length; i += TENABLE_BORNES.lot)
      await svc.integrations.lot(id, elements.slice(i, i + TENABLE_BORNES.lot));
    const n = (t: ElementSynchronisation['type']) => elements.filter((e) => e.type === t).length;
    const fin = await svc.integrations.terminer(id, {
      ok: true,
      resultat: {
        elements: elements.length,
        pages: Math.max(1, Math.ceil(n('detection') / TENABLE_BORNES.pageAnalyse)),
        constats: n('constat'),
        detections: n('detection'),
        machines: n('machine'),
        hotes: n('hote'),
        ecartes: 0,
        tronque: false,
        inventaire: { ok: true, erreur: null },
      },
      erreur: null,
    });
    if (fin.etat !== 'recu') throw new Error(`Synchronisation de démonstration refusée : ${fin.erreur ?? fin.etat}`);
  } catch (e) {
    await svc.integrations
      .terminer(id, { ok: false, resultat: null, erreur: 'Démonstration interrompue.' })
      .catch(() => undefined);
    throw e;
  }
}

/** Charge la partie « Vulnérabilités » de la démonstration. */
export async function modulesVulnerabilites(
  { appel, exiger, commun }: Vulnerabilites,
  svc: Services,
  compte: string,
): Promise<BilanVulnerabilites> {
  const bilan: BilanVulnerabilites = {
    instance: null,
    depots: 0,
    depotsRattaches: 0,
    machines: 0,
    constats: 0,
    detections: 0,
    detectionsDisparues: 0,
    synchronisations: 0,
  };
  // Modules : aucune activation n'est changée ; l'un des deux désactivé, la partie est sautée.
  const { disabled } = await svc.modules.state(true);
  if (disabled.includes('vulnerabilites') || disabled.includes('integrations')) return bilan;

  // La remise à vide « travail » garde les intégrations (configuration) : l'instance d'un chargement précédent est reprise,
  // seulement si elle est restée inactive et sans clé. Sinon, rien n'est rangé et le chargement s'arrête.
  type Instance = { id: string; type: 'tenable'; nom: string; actif: boolean; secrets: Record<string, boolean> };
  const existantes = await exiger<Instance[]>(
    await appel('GET', '/api/integrations/instances'),
    'Lecture des intégrations',
  );
  const instance =
    existantes.find((i) => i.type === 'tenable' && i.nom === NOM_INSTANCE_DEMO) ??
    (await exiger<Instance>(
      await appel('POST', '/api/integrations/instances', {
        type: 'tenable',
        nom: NOM_INSTANCE_DEMO,
        configuration: {
          adresse: 'https://tenable.exemple.invalid',
          gravites: ['critique', 'elevee', 'moyenne', 'faible'],
        },
      }),
      'Instance Tenable de démonstration',
    ));
  if (instance.actif || Object.values(instance.secrets).some(Boolean))
    throw new Error(
      'L’intégration « Tenable Security Center (démonstration) » est active ou porte une clé : les synchronisations de démonstration ne sont pas chargées.',
    );
  bilan.instance = instance.id;

  const premiere = elementsSynchronisation(false, ilYa(7));
  await synchroniser(svc, instance, premiere, compte);
  const seconde = elementsSynchronisation(true, new Date(Date.now() - 3600e3).toISOString());
  await synchroniser(svc, instance, seconde, compte);
  bilan.synchronisations = 2;

  const compter = (l: ElementSynchronisation[], t: ElementSynchronisation['type']) =>
    l.filter((e) => e.type === t).length;
  bilan.machines = compter(premiere, 'machine') + compter(premiere, 'hote');
  bilan.constats = compter(premiere, 'constat');
  bilan.detections = compter(premiere, 'detection');
  bilan.detectionsDisparues = bilan.detections - compter(seconde, 'detection');

  // Dépôts reliés aux périmètres du jeu (l'organisation et ses deux sites), par l'API publique.
  const perimetres = await exiger<{ id: string; name: string }[]>(
    await appel('GET', '/api/grc/smsis'),
    'Lecture des périmètres',
  );
  const depots = await exiger<{ id: string; depotTenable: number; version: number }[]>(
    await appel('GET', '/api/vulnerabilites/depots'),
    'Lecture des dépôts Tenable',
  );
  bilan.depots = depots.length;
  for (const d of depots) {
    const voulu = DEPOTS.find((x) => x.id === String(d.depotTenable));
    if (!voulu) continue;
    const perimetre = voulu.perimetre === null ? commun : perimetres.find((p) => p.name === voulu.perimetre)?.id;
    if (!perimetre) continue;
    await exiger(
      await appel(
        'PUT',
        `/api/vulnerabilites/depots/${d.id}`,
        { perimetreId: perimetre },
        { 'if-match': `"${d.version}"` },
      ),
      `Liaison du dépôt « ${voulu.nom} »`,
    );
    bilan.depotsRattaches++;
  }
  return bilan;
}
