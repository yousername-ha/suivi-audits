/* Registre des flux réseau vers l'extérieur (ADR 0097) : chaque module qui communique hors des réseaux internes Docker ou
   qui expose un port y est décrit (destinations, ports, porteur, données qui sortent). Par défaut, tout est fermé : seul
   l'administrateur ouvre un flux, après confirmation explicite. L'API enregistre l'état voulu ; l'exécutant d'exploitation
   l'applique et rapporte l'état appliqué. Un test d'architecture vérifie que tout service du compose qui sort ou publie un
   port est porté par un module de ce registre ou figure dans la courte liste du cœur de plateforme. */
import { z } from 'zod';
import type { Module } from './permissions.js';

/** Identifiants stables (base, journal d'audit, CLI de l'exécutant) : ne jamais renommer. */
export const FLUX_MODULES = ['assistant', 'courriel', 'acme', 'antivirus', 'mises-a-jour'] as const;
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

export const FluxExternesOut = z.object({ modules: z.array(FluxExterneEtat) });
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
