/* Registre des flux réseau vers l'extérieur (ADR 0097) : chaque module qui communique hors des réseaux internes Docker ou
   qui expose un port y est décrit (destinations, ports, porteur, données qui sortent). Par défaut, tout est fermé : seul
   l'administrateur ouvre un flux, après confirmation explicite. L'API enregistre l'état voulu ; l'exécutant d'exploitation
   l'applique et rapporte l'état appliqué. Un test d'architecture vérifie que tout service du compose qui sort ou publie un
   port est porté par un module de ce registre ou figure dans la courte liste du cœur de plateforme. */
import { z } from 'zod';
import type { Module } from './permissions.js';
import { SOURCES_REGLEMENTAIRES_JOINTES } from './veille-reglementaire.js';
import { SOURCES_ANNONCES_DEFINITIONS } from './annonces-veille.js';
import { SOURCE_CVE_ORG } from './cve-inconnue.js';
import { SOURCES_VEILLE_DEFINITIONS } from './veille-vulnerabilites.js';

/** Lot CVE-INC (ADR 0100, addendum « lot CVE-INC », tableau « Hôtes nouveaux autorisés par le RSSI ») : hôtes nouveaux du
    flux « veille-vulnerabilites », joints seulement sur le clic d'une personne (cve.org, décision du RSSI du 19/11/2026) ou si
    la source facultative est activée (Cloudflare Radar, décision du 20/11/2026 ; tldrcve, décision du 20/11/2026 ; lot retenu
    le 22/11/2026). */
export const HOTES_VEILLE_COMPLEMENTAIRES: readonly { hote: string; organisme: string }[] = [
  { hote: SOURCE_CVE_ORG.hote, organisme: SOURCE_CVE_ORG.organisme },
  ...SOURCES_ANNONCES_DEFINITIONS.map((s) => ({ hote: s.hote, organisme: s.organisme })),
];
const HOTES_VEILLE = [...SOURCES_VEILLE_DEFINITIONS, ...HOTES_VEILLE_COMPLEMENTAIRES];

/** Identifiants stables (base, journal d'audit, CLI de l'exécutant) : ne jamais renommer. */
export const FLUX_MODULES = [
  'assistant',
  'courriel',
  'acme',
  'antivirus',
  'mises-a-jour',
  'tenable',
  'veille-vulnerabilites',
  'algolighthouse',
  'veille-reglementaire',
] as const;
export const FluxModule = z.enum(FLUX_MODULES);
export type FluxModule = z.infer<typeof FluxModule>;

export type FluxSens = 'sortant' | 'entrant';

/** Une destination (ou une source, pour un flux entrant) : qui, par quel port, dans quel sens. */
export interface FluxDestination {
  sens: FluxSens;
  /** Hôte, ou description de l'hôte quand il dépend d'un réglage (« serveur SMTP réglé »). */
  hote: string;
  /** Protocole et ports (« TCP 443 (HTTPS) »). */
  ports: string;
}

/** Qui émet ou reçoit le flux : un conteneur dédié démarré par son profil Compose, l'exécutant d'exploitation (`updater`)
    ou la passerelle (`gateway`). `services` nomme les services de docker-compose.yml concernés. */
export interface FluxPorteur {
  type: 'conteneur' | 'executant' | 'passerelle';
  services: readonly string[];
  /** Profil Compose démarré à l'ouverture et arrêté à la fermeture (porteur « conteneur »). */
  profil?: string;
  libelle: string;
}

export interface FluxExterneDefinition {
  id: FluxModule;
  libelle: string;
  /** Pourquoi le module a besoin de ce flux. */
  role: string;
  destinations: readonly FluxDestination[];
  porteur: FluxPorteur;
  /** Ce qui quitte le serveur quand le flux est ouvert. */
  donnees: string;
  /** Page où se règle et s'active le module (clé, hôte SMTP, autorité ACME…). */
  reglage: { libelle: string; lien: string };
  /** Geste qui ouvre le flux (précision du RSSI du 15/11/2026 : activer le module ouvre son flux, sans étape séparée).
      « module » : l'activation propre du module (interrupteur de l'assistant, envoi des courriels, mode ACME) ouvre le flux
      dans la même opération ; « flux » : le module n'a pas d'autre état, son activation est la décision de flux elle-même
      (analyse antivirus, mises à jour depuis l'interface). Dans les deux cas, la fermeture est toujours possible. */
  activation: { par: 'module' | 'flux'; geste: string };
  /** Module de l'activation globale (ADR 0019) dont la désactivation, dans Administration > Modules, referme aussi ce flux
      dans la même transaction. Sa réactivation ne rouvre rien : il faut repasser par le geste et la validation. */
  moduleActivation?: Module;
  /** Flux à autoriser sur le pare-feu de l'hôte et du réseau (ADR 0097, point 6 : ce n'est pas la plateforme qui le fait). */
  pareFeu: readonly string[];
  /** Ce qui se passe tant que le flux est fermé. */
  siFerme: string;
}

export const FLUX_EXTERNES: readonly FluxExterneDefinition[] = [
  {
    id: 'assistant',
    libelle: 'Assistant RSSI',
    role: 'Transmettre les questions posées à l’assistant au fournisseur du modèle de langage réglé.',
    destinations: [
      { sens: 'sortant', hote: 'Fournisseur du modèle réglé (par exemple api.mistral.ai)', ports: 'TCP 443 (HTTPS)' },
    ],
    porteur: {
      type: 'conteneur',
      services: ['assistant-relais'],
      profil: 'assistant',
      libelle: 'Conteneur « assistant-relais » (profil Compose « assistant »), seul à sortir',
    },
    donnees:
      'La question posée, les extraits que l’assistant a lus pour y répondre (intitulés d’écarts, descriptions de risques, noms d’éléments, extraits de documents) et la clé du fournisseur.',
    reglage: { libelle: 'Plateforme > Assistant RSSI', lien: '/plateforme/assistant' },
    activation: { par: 'module', geste: 'Interrupteur « Activer l’assistant », puis Enregistrer' },
    moduleActivation: 'assistant',
    pareFeu: ['Sortie TCP 443 du serveur vers l’adresse du fournisseur du modèle.'],
    siFerme: 'L’assistant ne répond pas et ses rondes ne partent pas ; ses réglages sont conservés.',
  },
  {
    id: 'courriel',
    libelle: 'Courriel (SMTP/SMTPS)',
    role: 'Envoyer les notifications, les alertes d’exploitation et le message de test.',
    destinations: [
      {
        sens: 'sortant',
        hote: 'Serveur de messagerie réglé',
        ports: 'TCP du port réglé (25, 465 ou 587 le plus souvent)',
      },
    ],
    porteur: {
      type: 'executant',
      services: ['updater'],
      libelle: 'Exécutant d’exploitation du serveur (service « updater »)',
    },
    donnees:
      'Les messages envoyés : adresse du destinataire, objet et texte des notifications ou des alertes ; identifiant et mot de passe du compte SMTP s’il est réglé.',
    reglage: { libelle: 'Configuration système > Courriel', lien: '/systeme/courriel' },
    activation: { par: 'module', geste: 'Interrupteur « Activer l’envoi de courriels », puis Enregistrer' },
    pareFeu: ['Sortie TCP du serveur vers le serveur de messagerie, sur le port réglé.'],
    siFerme: 'Aucun courriel ne part : les notifications restent en file jusqu’à leur expiration.',
  },
  {
    id: 'acme',
    libelle: 'Certificat public ACME',
    role: 'Obtenir et renouveler un certificat publiquement reconnu (Let’s Encrypt ou autre autorité ACME).',
    destinations: [
      {
        sens: 'sortant',
        hote: 'Autorité ACME réglée (par défaut acme-v02.api.letsencrypt.org)',
        ports: 'TCP 443 (HTTPS)',
      },
      { sens: 'entrant', hote: 'Serveurs de validation de l’autorité ACME, depuis Internet', ports: 'TCP 80 et 443' },
    ],
    porteur: {
      type: 'passerelle',
      services: ['gateway'],
      libelle: 'Passerelle HTTPS (service « gateway »)',
    },
    donnees:
      'Le nom public du site, l’adresse de contact ACME et la demande de certificat (clé publique) ; aucune donnée métier.',
    reglage: { libelle: 'Configuration système > Certificats et opérations', lien: '/systeme/certificats' },
    activation: { par: 'module', geste: 'Bouton « Obtenir un certificat ACME »' },
    pareFeu: [
      'Sortie TCP 443 du serveur vers l’autorité ACME.',
      'Entrée TCP 80 et 443 depuis Internet vers le serveur (validation du nom par l’autorité).',
    ],
    siFerme:
      'La passerelle garde l’autorité interne du serveur (ou le certificat fourni) ; aucune demande ACME ne part.',
  },
  {
    id: 'antivirus',
    libelle: 'Antivirus (mise à jour des signatures)',
    role: 'Analyser les fichiers déposés avec ClamAV, dont les signatures se mettent à jour depuis Internet.',
    destinations: [
      {
        sens: 'sortant',
        hote: 'Miroirs des signatures ClamAV (database.clamav.net)',
        ports: 'TCP 443 (HTTPS)',
      },
      {
        sens: 'sortant',
        hote: 'Docker Hub (registry-1.docker.io), téléchargement de l’image ClamAV à la première activation',
        ports: 'TCP 443 (HTTPS)',
      },
    ],
    porteur: {
      type: 'conteneur',
      services: ['freshclam', 'clamav'],
      profil: 'antivirus',
      libelle:
        'Conteneurs « freshclam » (seul à sortir) et « clamav » (analyse, réseau interne seulement), profil Compose « antivirus »',
    },
    donnees:
      'Des demandes de téléchargement des signatures (adresse IP du serveur, version de ClamAV) ; aucun fichier déposé ne sort.',
    reglage: { libelle: 'Configuration système > Sécurité', lien: '/systeme/securite' },
    activation: { par: 'flux', geste: 'Bouton « Activer l’analyse antivirus »' },
    pareFeu: [
      'Sortie TCP 443 du serveur vers les miroirs ClamAV.',
      'Sortie TCP 443 du serveur vers Docker Hub (registry-1.docker.io, auth.docker.io, production.cloudflare.docker.com), pour l’image ClamAV.',
    ],
    siFerme:
      'Les fichiers déposés ne sont pas analysés : ils sont acceptés et marqués « non analysé », comme sans antivirus.',
  },
  {
    id: 'mises-a-jour',
    libelle: 'Mises à jour de la plateforme',
    role: 'Vérifier les nouvelles versions publiées et installer celle que l’administrateur confirme.',
    destinations: [
      { sens: 'sortant', hote: 'github.com et api.github.com (publications)', ports: 'TCP 443 (HTTPS)' },
      { sens: 'sortant', hote: 'ghcr.io (registre des images)', ports: 'TCP 443 (HTTPS)' },
      {
        sens: 'sortant',
        hote: 'Sigstore (tuf-repo-cdn.sigstore.dev, rekor.sigstore.dev) : vérification des signatures',
        ports: 'TCP 443 (HTTPS)',
      },
    ],
    porteur: {
      type: 'executant',
      services: ['updater'],
      libelle: 'Exécutant de mise à jour du serveur (service « updater »)',
    },
    donnees: 'Des demandes de lecture des publications et des images (adresse IP du serveur, version installée).',
    reglage: { libelle: 'Configuration système > Mises à jour et versions', lien: '/systeme/mises-a-jour' },
    activation: { par: 'flux', geste: 'Bouton « Activer les mises à jour depuis l’interface »' },
    pareFeu: [
      'Sortie TCP 443 du serveur vers github.com, api.github.com, ghcr.io et pkg-containers.githubusercontent.com.',
      'Sortie TCP 443 du serveur vers tuf-repo-cdn.sigstore.dev et rekor.sigstore.dev.',
    ],
    siFerme: 'Aucune vérification ni installation de version : la version installée reste en place.',
  },
  {
    // Connecteur Tenable Security Center du module Intégrations (ADR 0076, point 5 ; ADR 0100, points 4 et 6). Le flux ne
    // quitte pas le réseau interne en général ; il est déclaré quand même, puisqu'il quitte le serveur.
    id: 'tenable',
    libelle: 'Tenable Security Center',
    role: 'Lire Tenable Security Center, en lecture seule, pour le module Intégrations : tester la connexion, lire les failles et les machines pour le module Vulnérabilités.',
    destinations: [
      {
        sens: 'sortant',
        hote: 'Adresse réglée de Tenable Security Center (réseau interne en général)',
        ports: 'TCP du port réglé (443 par défaut, HTTPS)',
      },
    ],
    porteur: {
      type: 'executant',
      services: ['updater'],
      libelle: 'Exécutant d’exploitation du serveur (service « updater »), par un script isolé sans privilège',
    },
    donnees:
      'Les clés d’API du compte de consultation Tenable (clé d’accès et clé secrète) et des requêtes de lecture (version du service, failles, machines ; à l’ouverture de la fiche d’une CVE inconnue de la veille, les contrôles Tenable qui citent cette CVE, par son seul identifiant). Aucune autre donnée de la plateforme n’est envoyée.',
    reglage: { libelle: 'Plateforme > Intégrations', lien: '/plateforme/integrations' },
    activation: { par: 'module', geste: 'Bouton « Activer » de la tuile du connecteur Tenable Security Center' },
    moduleActivation: 'integrations',
    pareFeu: ['Sortie TCP du serveur vers Tenable Security Center, sur le port réglé (443 par défaut).'],
    siFerme:
      'Aucune requête ne part vers Tenable Security Center : une demande en file est close sans appel ; la configuration et les clés sont conservées.',
  },
  {
    // Veille du module Vulnérabilités sur cinq sources publiques (ADR 0100, points 3 à 5 ; lots V2 et V3). Les hôtes viennent
    // de la liste fermée du module (veille-vulnerabilites.ts), recopiée dans le script de l'exécutant.
    id: 'veille-vulnerabilites',
    libelle: 'Veille sur les vulnérabilités',
    role: 'Lire les catalogues et flux publics de vulnérabilités (CISA KEV, NVD, EPSS, CERT-FR, CERT Santé ; sur clic, cve.org ; sources facultatives : Cloudflare Radar, tldrcve) pour le module Vulnérabilités.',
    destinations: HOTES_VEILLE.map((s) => ({
      sens: 'sortant' as const,
      hote: `${s.hote} (${s.organisme})`,
      ports: 'TCP 443 (HTTPS)',
    })),
    porteur: {
      type: 'executant',
      services: ['updater'],
      libelle: 'Exécutant d’exploitation du serveur (service « updater »), par un script isolé sans privilège',
    },
    donnees:
      'L’adresse IP du serveur et des demandes de lecture : le catalogue KEV, une fenêtre de dates pour NVD, les identifiants CVE déjà publiés par ces sources pour EPSS, les flux RSS et les avis du CERT-FR, le flux RSS du CERT Santé et la page de ses publications nouvelles ou modifiées qui citent une CVE (30 au plus par collecte). Si la source « Dictionnaire des produits (CPE) » est activée : les pages du dictionnaire CPE de la NVD, et, quand une personne choisit un produit dans la saisie d’un produit surveillé, l’éditeur et le produit choisis pour en lire les versions (la NVD voit alors ce produit ; rien de tel avec la copie complète du dictionnaire). Sur le clic d’une personne qui ouvre la fiche d’une CVE inconnue de la veille : l’identifiant de cette CVE, vers cve.org (cveawg.mitre.org) et NVD. Si les sources facultatives sont activées : la lecture du flux des CVE annoncées de Cloudflare Radar et du flux RSS de tldrcve, sans aucun paramètre (le filtre par produit surveillé est fait sur le serveur ; rien n’est envoyé). Aucune donnée métier en dehors de ce produit et de cet identifiant : ni machine, ni adresse, ni domaine, ni périmètre, ni version déclarée, ni contenu de la plateforme.',
    reglage: { libelle: 'Risques > Vulnérabilités > Veille', lien: '/vulnerabilites/veille' },
    activation: { par: 'flux', geste: 'Bouton « Activer la veille »' },
    moduleActivation: 'vulnerabilites',
    pareFeu: [`Sortie TCP 443 du serveur vers ${HOTES_VEILLE.map((s) => s.hote).join(', ')}.`],
    siFerme:
      'Aucune source n’est jointe : aucune collecte n’est inscrite ni réclamée, une demande en file est close sans appel ; les failles et avis déjà collectés restent consultables.',
  },
  {
    // Connecteur AlgoLightHouse du module Intégrations (ADR 0076 ; ADR 0100, lot ALH1). Service de l'éditeur sur Internet :
    // la sortie passe par le mandataire de l'établissement quand il est actif (ADR 0101), contrairement à Tenable.
    id: 'algolighthouse',
    libelle: 'AlgoLightHouse',
    role: 'Lire AlgoLightHouse (surveillance de la surface exposée sur Internet), en lecture seule, pour le module Intégrations : tester la connexion, lire les périmètres, hôtes, domaines, alertes et technologies pour le module Vulnérabilités.',
    destinations: [
      {
        sens: 'sortant',
        hote: 'Espace AlgoLightHouse réglé (espace.algolighthouse.fr, sur Internet)',
        ports: 'TCP 443 (HTTPS)',
      },
    ],
    porteur: {
      type: 'executant',
      services: ['updater'],
      libelle: 'Exécutant d’exploitation du serveur (service « updater »), par un script isolé sans privilège',
    },
    donnees:
      'La clé d’API de l’espace AlgoLightHouse et des requêtes de lecture (version du service, périmètres, hôtes, domaines, alertes et leur détail, technologies), ainsi que l’adresse IP du serveur, ou celle du mandataire de l’établissement s’il est actif. Aucune donnée de la plateforme n’est envoyée : ni commentaire, ni changement de statut, ni recherche.',
    reglage: { libelle: 'Plateforme > Intégrations', lien: '/plateforme/integrations' },
    activation: { par: 'module', geste: 'Bouton « Activer » de la tuile du connecteur AlgoLightHouse' },
    moduleActivation: 'integrations',
    pareFeu: ['Sortie TCP 443 du serveur vers l’espace AlgoLightHouse réglé (espace.algolighthouse.fr).'],
    siFerme:
      'Aucune requête ne part vers AlgoLightHouse : une demande en file est close sans appel ; la configuration, la clé et les données déjà lues sont conservées.',
  },
  {
    // Veille réglementaire (ADR 0110, lot VR-1) : flux publics de la CNIL, du CEPD, d'EUR-Lex et de l'ANSSI, lus
    // par le même script isolé que la veille des vulnérabilités. Les hôtes viennent de la liste fermée du module
    // (veille-reglementaire.ts), recopiée dans le script de l'exécutant.
    id: 'veille-reglementaire',
    libelle: 'Veille réglementaire',
    role: 'Lire les flux publics de publications réglementaires (CNIL, CEPD, EUR-Lex, ANSSI) pour le module Veille réglementaire.',
    destinations: SOURCES_REGLEMENTAIRES_JOINTES.map((s) => ({
      sens: 'sortant' as const,
      hote: `${s.hote} (${s.organisme})`,
      ports: 'TCP 443 (HTTPS)',
    })),
    porteur: {
      type: 'executant',
      services: ['updater'],
      libelle: 'Exécutant d’exploitation du serveur (service « updater »), par un script isolé sans privilège',
    },
    donnees:
      'L’adresse IP du serveur, ou celle du mandataire de l’établissement s’il est actif, et la demande de lecture du flux RSS de chaque source activée. Aucune donnée métier : ni qualification, ni contenu de la plateforme.',
    reglage: { libelle: 'Conformité et audits > Veille réglementaire', lien: '/veille-reglementaire' },
    activation: { par: 'flux', geste: 'Bouton « Activer la veille réglementaire »' },
    moduleActivation: 'veille_reglementaire',
    pareFeu: [`Sortie TCP 443 du serveur vers ${SOURCES_REGLEMENTAIRES_JOINTES.map((s) => s.hote).join(', ')}.`],
    siFerme:
      'Aucune source n’est jointe : aucune collecte n’est inscrite ni réclamée, une demande en file est close sans appel ; les publications déjà collectées et leur qualification restent consultables.',
  },
];

export const fluxExterne = (id: FluxModule): FluxExterneDefinition => FLUX_EXTERNES.find((f) => f.id === id)!;

/** Sens d'un flux, dans l'ordre sortant puis entrant, sans doublon. */
export const sensDuFlux = (f: Pick<FluxExterneDefinition, 'destinations'>): FluxSens[] =>
  (['sortant', 'entrant'] as const).filter((s) => f.destinations.some((d) => d.sens === s));

/* ------------------------------------------------------------------ État voulu et appliqué */
export const FLUX_ETATS_APPLIQUES = ['ouvert', 'ferme', 'erreur'] as const;
export const FluxEtatApplique = z.enum(FLUX_ETATS_APPLIQUES);
export type FluxEtatApplique = z.infer<typeof FluxEtatApplique>;

/** Erreur courte rapportée par l'exécutant : une ligne, sans caractère de contrôle. */
export const FLUX_ERREUR_MAX = 300;
const ErreurCourte = z
  .string()
  .min(1)
  .max(FLUX_ERREUR_MAX)
  // eslint-disable-next-line no-control-regex
  .regex(/^[^\u0000-\u001f\u007f]+$/, 'Erreur sur une seule ligne, sans caractère de contrôle.');

/** État d'un module tel que l'administration le voit. Aucun enregistrement : fermé, jamais décidé, jamais appliqué. */
export const FluxExterneEtat = z.object({
  module: FluxModule,
  /** État voulu, décidé par l'administrateur. */
  ouvert: z.boolean(),
  decidePar: z.string().nullable(),
  decideLe: z.string().datetime().nullable(),
  /** État appliqué rapporté par l'exécutant ; null tant qu'il n'a rien rapporté. */
  applique: FluxEtatApplique.nullable(),
  appliqueLe: z.string().datetime().nullable(),
  erreur: z.string().max(FLUX_ERREUR_MAX).nullable(),
});
export type FluxExterneEtat = z.infer<typeof FluxExterneEtat>;

export const FluxExternesOut = z.object({
  modules: z.array(FluxExterneEtat),
  /** Mandataire sortant de l'établissement (ADR 0101) : seulement s'il est actif ; ni adresse ni compte. */
  mandataire: z.object({ actif: z.boolean() }),
});
export type FluxExternesOut = z.infer<typeof FluxExternesOut>;

/** Ouvrir ou fermer un module par la route commune : la confirmation explicite est obligatoire dans les deux sens.
    L'ouverture n'y est admise que pour un module dont l'activation est le flux lui-même (activation.par = « flux »). */
export const FluxChangement = z.object({ ouvert: z.boolean(), confirmation: z.literal(true) }).strict();
export type FluxChangement = z.infer<typeof FluxChangement>;

/** Validation explicite jointe au geste d'activation d'un module dont le flux est fermé (« module ») : la même opération
    enregistre l'activation et ouvre le flux. */
export const FluxConfirme = z.literal(true);

/** Sortie de `suivi flux-souhaites` (exécutant) : les modules voulus ouverts ; tout autre module est voulu fermé. */
export const FluxSouhaites = z.object({ ouverts: z.array(FluxModule) }).strict();
export type FluxSouhaites = z.infer<typeof FluxSouhaites>;

/** Entrée de `suivi flux-appliques` (exécutant) : état appliqué par module. Un module inconnu ou un champ inattendu est
    refusé ; une erreur n'accompagne que l'état « erreur », qui en exige une. */
export const FluxApplique = z
  .object({ etat: FluxEtatApplique, erreur: ErreurCourte.nullable().optional() })
  .strict()
  .refine((v) => (v.etat === 'erreur') === !!v.erreur, {
    message: 'Une erreur accompagne l’état « erreur », et lui seul.',
  });
export type FluxApplique = z.infer<typeof FluxApplique>;
export const FluxAppliques = z
  .object(
    Object.fromEntries(FLUX_MODULES.map((m) => [m, FluxApplique.optional()])) as Record<
      FluxModule,
      z.ZodOptional<typeof FluxApplique>
    >,
  )
  .strict();
export type FluxAppliques = z.infer<typeof FluxAppliques>;

/* ------------------------------------------------------------------ Reprise de l'existant (précision du RSSI du 16/11/2026) */
/** « Une mise à jour de l'interface ne peut pas enlever le flux ouvert. » Un module du registre qui n'a encore aucune décision
    enregistrée et qui est réellement en service sur le serveur voit son flux enregistré ouvert par cet acteur système, inscrit
    au journal (`flux.externe.repris`) avec le motif. Un module déjà décidé (ouvert ou fermé par un administrateur) n'est
    jamais touché : une fermeture décidée reste une fermeture. */
export const FLUX_REPRISE_ACTEUR = 'reprise-mise-a-jour';

/** Flux nés avec le registre (connecteurs Tenable et AlgoLightHouse de l'ADR 0076, veille de l'ADR 0100) : ils n'ont jamais
    pu être en service sans décision enregistrée, puisqu'ils ne s'ouvrent que par leur geste d'activation. Il n'y a donc rien
    à reprendre pour eux : la reprise ne les concerne pas, et aucune déclaration d'un exécutant ne peut les ouvrir. */
export const FLUX_SANS_REPRISE = [
  'tenable',
  'veille-vulnerabilites',
  'algolighthouse',
  'veille-reglementaire',
] as const satisfies readonly FluxModule[];
/** Modules que la reprise de l'existant peut concerner : ceux qui existaient avant le registre des flux. */
export type FluxModuleRepris = Exclude<FluxModule, (typeof FLUX_SANS_REPRISE)[number]>;
export const estFluxRepris = (m: FluxModule): m is FluxModuleRepris =>
  !(FLUX_SANS_REPRISE as readonly FluxModule[]).includes(m);

/** Motifs de la reprise, par module : codes fermés (journal d'audit, CLI de l'exécutant) et phrase affichée. Les exécutants
    Python recopient ces codes (concordance vérifiée par apps/api/test/architecture-flux.test.ts). */
export const FLUX_REPRISE_MOTIFS = {
  assistant: {
    'conteneur-present': 'Le conteneur « assistant-relais » est présent sur le serveur.',
    'env-renseigne': 'ASSISTANT_RELAIS_URL est renseigné dans .env.',
  },
  courriel: {
    'envoi-actif': 'L’envoi de courriels est actif dans les réglages, avec un serveur SMTP renseigné.',
  },
  acme: {
    'passerelle-acme': 'La passerelle HTTPS est en mode ACME (choisi dans l’application).',
    'env-acme': 'CADDY_TLS de .env est réglé sur une adresse de contact ACME.',
  },
  antivirus: {
    'conteneur-present': 'Les conteneurs « freshclam » ou « clamav » sont présents sur le serveur.',
    'env-renseigne': 'CLAMAV_HOST est renseigné dans .env.',
  },
  'mises-a-jour': {
    'mise-a-jour-installee': 'Au moins une mise à jour a déjà été installée sur ce serveur.',
  },
} as const satisfies Record<FluxModuleRepris, Record<string, string>>;
export type FluxRepriseMotif<M extends FluxModuleRepris = FluxModuleRepris> = keyof (typeof FLUX_REPRISE_MOTIFS)[M] &
  string;

/** Modules dont l'exécutant constate la mise en service ; le courriel est constaté par l'API elle-même, au démarrage. */
export const FLUX_REPRISE_EXECUTANT = ['assistant', 'acme', 'antivirus', 'mises-a-jour'] as const;

const motifs = <M extends FluxModuleRepris>(m: M) =>
  z.enum(Object.keys(FLUX_REPRISE_MOTIFS[m]) as [FluxRepriseMotif<M>, ...FluxRepriseMotif<M>[]]).optional();

/** Entrée de `suivi flux-reprise` (exécutant) : modules réellement en service et motif constaté. Un module inconnu ou que
    l'exécutant ne constate pas (courriel), un motif étranger au module ou un champ inattendu sont refusés. La sortie est
    celle de `suivi flux-souhaites`. */
export const FluxReprise = z
  .object({
    enService: z
      .object({
        assistant: motifs('assistant'),
        acme: motifs('acme'),
        antivirus: motifs('antivirus'),
        'mises-a-jour': motifs('mises-a-jour'),
      })
      .strict(),
  })
  .strict();
export type FluxReprise = z.infer<typeof FluxReprise>;

/* ------------------------------------------------------------------ Questions de l'installation (lot 3) */
/** Étape « Flux vers l'extérieur » de l'assistant d'installation (ADR 0097, point 5) : proposée une seule fois, à la première
    connexion complète du compte administrateur créé par l'installation, jusqu'à ce qu'il la termine ou la passe. Elle
    n'ouvre rien elle-même : chaque ouverture passe par le geste d'activation du module et sa validation explicite. */
export const QuestionsFluxOut = z.object({ aProposer: z.boolean() });
export type QuestionsFluxOut = z.infer<typeof QuestionsFluxOut>;
