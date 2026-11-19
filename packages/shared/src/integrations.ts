/* Module Intégrations (ADR 0076), socle des connecteurs réseau : catalogue des types en code, instances en base. Un type
   déclare sa portée (organisation ou SMSI), son schéma de configuration non secrète, les noms de ses champs secrets, le
   flux vers l'extérieur qu'il emprunte (ADR 0097) et la liste fermée des points d'accès de lecture qu'il peut appeler.
   L'API n'appelle jamais ces points d'accès : l'exécutant d'exploitation le fait, dans un script isolé
   (scripts/integration-http.py) dont la liste recopiée est comparée à celle-ci par un test. Deux types, chacun avec deux
   opérations, « Tester la connexion » et « Synchroniser », rapportées par lots bornés au module Vulnérabilités :
   - « tenable » (Tenable Security Center, ADR 0100, point 6, lot V5) : failles et machines ; outil interne, joint
     directement ;
   - « algolighthouse » (AlgoLightHouse, éditeur AlgoSecure, lot ALH1) : surface externe (périmètres, hôtes, domaines,
     alertes, technologies) ; service sur Internet, joint par le mandataire de l'établissement quand il est actif
     (ADR 0101).
   Lot N1 (ADR 0100) : un type sans réseau, « nessus-fichier » (Nessus, import de fichier) : ni adresse, ni clé, ni flux,
   ni exécutant ; une seule opération, « Importer un scan », lancée depuis la carte « Intégrations » (import-nessus.ts). */
import { z } from 'zod';
import { FiltreGravites, GRAVITES_PAR_DEFAUT, BilanSynchronisation } from './failles-tenable.js';
import { AdresseAlh, BilanSynchronisationAlh, CLE_API_ALH, ResultatTestAlh } from './surface-externe.js';
import type { FluxModule } from './flux-externes.js';
import { FrequenceHeures } from './frequences-synchronisation.js';
import { BilanImportNessus } from './import-nessus.js';
import type { Module } from './permissions.js';

/* ------------------------------------------------------------------ Champs communs */
/** Adresse d'un service interne : HTTPS seulement, sans identifiants, sans chemin, sans paramètres ni fragment. Les
    adresses privées sont admises (outil interne). Port : 443 par défaut, ou un port explicite de 1 à 65535
    (`https://serveur:PORT`, décision du RSSI du 16/11/2026) ; le flux déclaré suit le port réglé. La valeur rangée est
    l'origine normalisée (`https://hote` ou `https://hote:port`). */
export const ADRESSE_MAX = 253 + 'https://'.length;
const hoteValide =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$|^\[[0-9a-f:.]+\]$/;

/** Motif d'erreur (ou null) d'une adresse saisie ; partagé par le schéma et par l'interface. */
export function erreurAdresse(brute: string): string | null {
  const v = brute.trim();
  if (!v) return 'Adresse obligatoire (https://…).';
  if (v.length > ADRESSE_MAX) return 'Adresse trop longue.';
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f\\]/.test(v)) return 'Adresse invalide : espace ou caractère de contrôle.';
  if (!/^https:\/\//i.test(v)) return 'Seule une adresse https:// est admise.';
  // Port explicite (décision du RSSI du 16/11/2026) : un nombre de 1 à 65535 ; contrôlé avant l'analyse de l'adresse pour
  // un message clair. Une adresse avec identifiant, chemin, paramètre ou fragment est refusée plus loin.
  const port = /^https:\/\/(?:\[[^\]]*\]|[^/:@?#]*):([^/?#@]*)\/?$/i.exec(v)?.[1];
  if (port !== undefined && (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535))
    return 'Port invalide : un nombre de 1 à 65535 (443 par défaut).';
  let u: URL;
  try {
    u = new URL(v);
  } catch {
    return 'Adresse invalide.';
  }
  if (u.protocol !== 'https:') return 'Seule une adresse https:// est admise.';
  if (u.username || u.password || /^https:\/\/[^/]*@/i.test(v))
    return 'Pas d’identifiant dans l’adresse : les clés se saisissent à part.';
  if (u.search || v.includes('?')) return 'Pas de paramètre dans l’adresse.';
  if (u.hash || v.includes('#')) return 'Pas de fragment dans l’adresse.';
  if (u.pathname !== '/' || /^https:\/\/[^/]+\/./i.test(v))
    return 'Indiquez l’adresse du serveur seule, sans chemin (https://serveur).';
  if (!hoteValide.test(u.hostname)) return 'Nom d’hôte invalide.';
  return null;
}

/** Adresse normalisée : `https://hote` ou `https://hote:port` (minuscules, sans barre finale ni port 443 explicite). */
export const AdresseHttps = z
  .string()
  .max(ADRESSE_MAX + 10)
  .superRefine((v, ctx) => {
    const e = erreurAdresse(v);
    if (e) ctx.addIssue({ code: 'custom', message: e });
  })
  .transform((v) => `https://${new URL(v.trim()).host}`);

/** Port TCP d'une adresse normalisée (443 sans port explicite) : celui du flux à ouvrir. */
export function portAdresse(adresse: string): number {
  try {
    const u = new URL(adresse);
    return u.protocol === 'https:' && u.port ? Number(u.port) : 443;
  } catch {
    return 443;
  }
}

/** Autorité de certification interne facultative, collée en PEM comme pour le courriel ; vide : magasin du système. */
export const AutoriteCertificationPem = z
  .string()
  .max(20000)
  .refine((v) => v.trim() === '' || /-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/.test(v), {
    message: 'Certificat PEM attendu (-----BEGIN CERTIFICATE-----).',
  });

/** Délai d'une requête, en secondes : borné, le script ne dépasse jamais cette durée par requête. */
export const DELAI_MIN = 5;
export const DELAI_MAX = 60;
export const DelaiSecondes = z.number().int().min(DELAI_MIN).max(DELAI_MAX);

/* ------------------------------------------------------------------ Tenable Security Center */
export const ConfigurationTenable = z
  .object({
    adresse: AdresseHttps,
    autoriteCertification: AutoriteCertificationPem.default(''),
    delaiSecondes: DelaiSecondes.default(30),
    /** Gravités lues par « Synchroniser » (filtre de l'analyse) : par défaut critiques et élevées. */
    gravites: FiltreGravites.default([...GRAVITES_PAR_DEFAUT]),
  })
  .strict();
export type ConfigurationTenable = z.infer<typeof ConfigurationTenable>;

/** Version de Tenable Security Center rendue par « Tester la connexion » : seule information gardée de /rest/system. */
export const VERSION_TENABLE = /^[0-9]{1,4}(?:\.[0-9]{1,6}){0,4}$/;
export const ResultatTestTenable = z.object({ version: z.string().max(40).regex(VERSION_TENABLE) }).strict();

/* ------------------------------------------------------------------ AlgoLightHouse (lot ALH1) */
/** Espace AlgoLightHouse : adresse `https://<espace>.algolighthouse.fr` (port 443), délai. Pas d'autorité de certification
    propre : le certificat de l'éditeur est vérifié par les autorités du système (et celle de l'établissement, si le
    mandataire inspecte le trafic). */
export const ConfigurationAlh = z
  .object({
    adresse: AdresseAlh,
    delaiSecondes: DelaiSecondes.default(30),
  })
  .strict();
export type ConfigurationAlh = z.infer<typeof ConfigurationAlh>;

/* ------------------------------------------------------------------ Nessus, import de fichier (lot N1) */
/** Aucune adresse, aucune clé : seulement les gravités retenues à l'import (critiques et élevées par défaut, comme Security
    Center). Le navigateur filtre, l'API revérifie d'après cette configuration. */
export const ConfigurationNessusFichier = z
  .object({ gravites: FiltreGravites.default([...GRAVITES_PAR_DEFAUT]) })
  .strict();
export type ConfigurationNessusFichier = z.infer<typeof ConfigurationNessusFichier>;

/* ------------------------------------------------------------------ Catalogue */
export const INTEGRATION_TYPES = ['tenable', 'algolighthouse', 'nessus-fichier'] as const;
export const IntegrationType = z.enum(INTEGRATION_TYPES);
export type IntegrationType = z.infer<typeof IntegrationType>;

/** Portée d'un type : « organisation » (une instance couvre toute l'organisation, sans périmètre) ou « smsi » (une
    instance par SMSI, ADR 0076 R11). Le périmètre de l'instance est facultatif en base et contrôlé selon le type. */
export const PORTEES_INTEGRATION = ['organisation', 'smsi'] as const;
export type PorteeIntegration = (typeof PORTEES_INTEGRATION)[number];

/** Opérations d'un type : « tester » (lecture de la version du service) et « synchroniser » (lecture des failles et des
    machines, rapportée par lots), par l'exécutant ; « importer » (lot N1) : fichier lu dans le navigateur, extrait envoyé à
    l'API par la personne qui importe, jamais par l'exécutant. */
export const OPERATIONS_INTEGRATION = ['tester', 'synchroniser', 'importer'] as const;
export const OperationIntegration = z.enum(OPERATIONS_INTEGRATION);
export type OperationIntegration = z.infer<typeof OperationIntegration>;
export const OPERATION_LIBELLES: Record<OperationIntegration, string> = {
  tester: 'Tester la connexion',
  synchroniser: 'Synchroniser',
  importer: 'Importer un scan',
};
/** Opérations rapportées par lots (`suivi integrations-lot`) avant leur fin, et module qui doit être actif pour qu'elles
    soient inscrites ou réclamées (ce module range les données reçues). */
export const OPERATIONS_EN_LOTS: Partial<Record<OperationIntegration, Module>> = { synchroniser: 'vulnerabilites' };

/** Point d'accès de lecture : méthode et chemin exact, ou motif strict dont `{uuid}` désigne un identifiant UUID.
    `parametres` : noms des paramètres de requête admis (valeurs entières seulement) ; absent, aucun. */
export interface PointAcces {
  methode: 'GET' | 'POST';
  chemin: string;
  parametres?: readonly string[];
}

export interface SecretIntegration {
  id: string;
  libelle: string;
  /** Forme admise (contrôlée par l'API et recontrôlée par le script avant l'envoi). */
  motif: RegExp;
  aide: string;
}

/** Champs de configuration présentés par l'interface pour un type (le schéma du type reste seul juge). */
export const CHAMPS_CONFIGURATION = ['adresse', 'autoriteCertification', 'delaiSecondes', 'gravites'] as const;
export type ChampConfiguration = (typeof CHAMPS_CONFIGURATION)[number];

export interface TypeIntegrationDefinition {
  id: IntegrationType;
  libelle: string;
  description: string;
  portee: PorteeIntegration;
  /** Champs de configuration affichés, et aide de l'adresse. */
  champs: readonly ChampConfiguration[];
  aideAdresse: string;
  configuration: z.ZodType<Record<string, unknown>, unknown>;
  secrets: readonly SecretIntegration[];
  /** Flux vers l'extérieur emprunté (registre de l'ADR 0097) : fermé, rien n'est réclamé ni émis pour ce type. `null` : type
      sans réseau (import de fichier, lot N1), inconnu de l'exécutant, sans entrée au registre des flux. */
  flux: FluxModule | null;
  /** Liste fermée des points d'accès que le script peut appeler, tous en lecture. */
  pointsAcces: readonly PointAcces[];
  operations: readonly OperationIntegration[];
}

const CLE_API = /^[A-Za-z0-9]{16,128}$/;

export const TYPES_INTEGRATION: readonly TypeIntegrationDefinition[] = [
  {
    id: 'tenable',
    libelle: 'Tenable Security Center',
    description:
      'Lecture seule de Tenable Security Center par clés d’API : test de connexion (version du service) et synchronisation périodique (une fois par jour par défaut, réglable) des failles détectées et des machines, rangées dans le module Vulnérabilités.',
    portee: 'organisation',
    champs: ['adresse', 'autoriteCertification', 'delaiSecondes', 'gravites'],
    aideAdresse:
      'https://serveur (port 443) ou https://serveur:port, sans chemin ni identifiant. Une adresse du réseau interne est admise. Changer l’adresse ou le port efface les clés.',
    configuration: ConfigurationTenable as unknown as z.ZodType<Record<string, unknown>, unknown>,
    secrets: [
      {
        id: 'accessKey',
        libelle: 'Clé d’accès',
        motif: CLE_API,
        aide: 'Clé d’accès (« access key ») du compte de consultation, lettres et chiffres.',
      },
      {
        id: 'secretKey',
        libelle: 'Clé secrète',
        motif: CLE_API,
        aide: 'Clé secrète (« secret key ») du même compte, lettres et chiffres.',
      },
    ],
    flux: 'tenable',
    pointsAcces: [
      { methode: 'POST', chemin: '/rest/analysis' },
      // Inventaire des machines, accès annoncé expérimental : paginé par `limit` (lu sur l'instance) et `offset`.
      { methode: 'GET', chemin: '/rest/hosts', parametres: ['limit', 'offset'] },
      { methode: 'GET', chemin: '/rest/hosts/{uuid}' },
      { methode: 'GET', chemin: '/rest/system' },
    ],
    operations: ['tester', 'synchroniser'],
  },
  {
    // AlgoLightHouse (ADR 0100, lot ALH1) : lecture seule, liste fermée des seuls points d'accès de la version 1 de l'API
    // (les adresses sans /v1 sont obsolètes). Jamais d'écriture (commentaires, statut), jamais /api/contacts ni /api/search.
    // Le descriptif ne documente aucune pagination : aucun paramètre de requête n'est émis.
    id: 'algolighthouse',
    libelle: 'AlgoLightHouse',
    description:
      'Lecture seule d’AlgoLightHouse (surveillance de la surface exposée sur Internet, éditeur AlgoSecure) par clé d’API : test de connexion (version du service) et synchronisation périodique (une fois par jour par défaut, réglable) des périmètres, hôtes, domaines, alertes et technologies, rangés dans le module Vulnérabilités (onglet « Surface externe »).',
    portee: 'organisation',
    champs: ['adresse', 'delaiSecondes'],
    aideAdresse:
      'Adresse de votre espace : https://espace.algolighthouse.fr (port 443), sans chemin ni identifiant. Changer l’adresse efface la clé.',
    configuration: ConfigurationAlh as unknown as z.ZodType<Record<string, unknown>, unknown>,
    secrets: [
      {
        id: 'cleApi',
        libelle: 'Clé d’API',
        motif: CLE_API_ALH,
        aide: 'Clé d’API de l’espace (en-tête X-API-Key), de 16 à 256 caractères sans espace.',
      },
    ],
    flux: 'algolighthouse',
    pointsAcces: [
      { methode: 'GET', chemin: '/api/v1/health' },
      { methode: 'GET', chemin: '/api/v1/version' },
      { methode: 'GET', chemin: '/api/v1/alerts' },
      { methode: 'GET', chemin: '/api/v1/alerts/{uuid}' },
      { methode: 'GET', chemin: '/api/v1/perimeters' },
      { methode: 'GET', chemin: '/api/v1/targets/hosts' },
      { methode: 'GET', chemin: '/api/v1/targets/domains' },
      { methode: 'GET', chemin: '/api/v1/technologies' },
    ],
    operations: ['tester', 'synchroniser'],
  },
  {
    // Lot N1 (ADR 0100, décision du RSSI du 19/11/2026) : connecteur à part, sans adresse, sans clé, sans flux sortant, sans
    // exécutant. Le fichier .nessus est lu dans le navigateur ; seul un extrait en liste blanche part vers l'API.
    id: 'nessus-fichier',
    libelle: 'Nessus, import de fichier',
    description:
      'Import d’un scan exporté de Nessus au format .nessus, lu dans votre navigateur : seuls les champs utiles des machines et des failles partent vers le serveur, qui les range dans le module Vulnérabilités comme pour Tenable Security Center. Ni adresse, ni clé, ni flux réseau. Pour chaque machine du fichier, une faille qui n’y figure plus est considérée comme disparue ; les machines absentes du fichier ne changent pas.',
    portee: 'organisation',
    champs: ['gravites'],
    aideAdresse: '',
    configuration: ConfigurationNessusFichier as unknown as z.ZodType<Record<string, unknown>, unknown>,
    secrets: [],
    flux: null,
    pointsAcces: [],
    operations: ['importer'],
  },
];

/** Types qui joignent un outil par le réseau, par l'exécutant d'exploitation (ceux que le script et l'exécutant connaissent). */
export const TYPES_INTEGRATION_RESEAU: readonly TypeIntegrationDefinition[] = TYPES_INTEGRATION.filter(
  (t) => t.flux !== null,
);

export const typeIntegration = (id: IntegrationType): TypeIntegrationDefinition =>
  TYPES_INTEGRATION.find((t) => t.id === id)!;

/** Noms de tous les champs secrets du catalogue (masquage des journaux, corps des routes de secrets). */
export const SECRETS_INTEGRATION = [...new Set(TYPES_INTEGRATION.flatMap((t) => t.secrets.map((s) => s.id)))];

const UUID = '[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}';
/** Le couple méthode/chemin figure-t-il dans la liste fermée du type ? Motif strict : seul `{uuid}` est variable. */
export function pointAccesAdmis(type: IntegrationType, methode: string, chemin: string): boolean {
  return typeIntegration(type).pointsAcces.some(
    (p) =>
      p.methode === methode &&
      new RegExp(
        '^' +
          p.chemin
            .split('{uuid}')
            .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join(UUID) +
          '$',
      ).test(chemin),
  );
}

/** Description du catalogue sans schéma (sortie de l'API). */
export interface TypeIntegrationDto {
  id: IntegrationType;
  libelle: string;
  description: string;
  portee: PorteeIntegration;
  champs: ChampConfiguration[];
  aideAdresse: string;
  secrets: { id: string; libelle: string; aide: string }[];
  flux: FluxModule | null;
  pointsAcces: PointAcces[];
  operations: OperationIntegration[];
}
export const catalogueIntegrations = (): TypeIntegrationDto[] =>
  TYPES_INTEGRATION.map((t) => ({
    id: t.id,
    libelle: t.libelle,
    description: t.description,
    portee: t.portee,
    champs: [...t.champs],
    aideAdresse: t.aideAdresse,
    secrets: t.secrets.map((s) => ({ id: s.id, libelle: s.libelle, aide: s.aide })),
    flux: t.flux,
    pointsAcces: t.pointsAcces.map((p) => ({ ...p, ...(p.parametres ? { parametres: [...p.parametres] } : {}) })),
    operations: [...t.operations],
  }));

/* ------------------------------------------------------------------ Instances */
const sansControle = (s: string) => !/\p{Cc}/u.test(s);
export const NomIntegration = z
  .string()
  .trim()
  .min(1, 'Nom obligatoire.')
  .max(120)
  .refine(sansControle, 'Caractère de contrôle refusé.');

/** Création d'une instance : la configuration est validée par le schéma du type (contrôle fait par `configurationValide`). */
export const IntegrationCreation = z
  .object({
    type: IntegrationType,
    nom: NomIntegration,
    smsiId: z.uuid().nullable().default(null),
    configuration: z.record(z.string(), z.unknown()),
    /** Lot F1 : fréquence de la synchronisation automatique, en heures (liste du type contrôlée par le serveur ; absente :
        valeur par défaut). */
    frequenceHeures: FrequenceHeures.optional(),
  })
  .strict();
export type IntegrationCreation = z.infer<typeof IntegrationCreation>;

/** Modification : nom, configuration et fréquence de la synchronisation automatique (lot F1, liste du type contrôlée par le
    serveur) ; la version attendue passe par If-Match. */
export const IntegrationModification = z
  .object({
    nom: NomIntegration,
    configuration: z.record(z.string(), z.unknown()),
    frequenceHeures: FrequenceHeures,
  })
  .partial()
  .strict()
  .refine((p) => Object.keys(p).length > 0, 'Aucune modification.');
export type IntegrationModification = z.infer<typeof IntegrationModification>;

/** Configuration validée par le schéma du type (erreurs zod rendues telles quelles en 400). */
export const configurationValide = (type: IntegrationType, configuration: unknown): Record<string, unknown> =>
  typeIntegration(type).configuration.parse(configuration);

/** Activation ou désactivation ; activer ouvre le flux du type après validation explicite (ADR 0097). */
export const IntegrationActivation = z
  .object({ actif: z.boolean(), fluxConfirme: z.literal(true).optional() })
  .strict();
export type IntegrationActivation = z.infer<typeof IntegrationActivation>;

/** Secrets en écriture seule : un ou plusieurs champs du catalogue ; la forme est contrôlée selon le type de l'instance. */
const SecretValeur = z.string().min(1).max(512);
export const IntegrationSecrets = z
  .object(Object.fromEntries(SECRETS_INTEGRATION.map((n) => [n, SecretValeur.optional()])))
  .strict()
  .refine((v) => Object.values(v).some((x) => x !== undefined), 'Aucun secret fourni.');
export type IntegrationSecrets = Partial<Record<string, string>>;

export const ETATS_EXECUTION = ['en_file', 'en_cours', 'recu', 'echec', 'expire'] as const;
export type EtatExecution = (typeof ETATS_EXECUTION)[number];
export const ETAT_EXECUTION_LIBELLES: Record<EtatExecution, string> = {
  en_file: 'En file',
  en_cours: 'En cours',
  recu: 'Reçu',
  echec: 'Échec',
  expire: 'Expiré',
};
export const ORIGINES_EXECUTION = ['manuel', 'planifie'] as const;
export type OrigineExecution = (typeof ORIGINES_EXECUTION)[number];

export interface ExecutionIntegrationDto {
  id: string;
  integrationId: string;
  operation: OperationIntegration;
  origine: OrigineExecution;
  etat: EtatExecution;
  demandePar: string;
  demandeLe: string;
  debuteLe: string | null;
  termineLe: string | null;
  /** Résultat borné de l'opération (tester : `{ version }` ; synchroniser : son bilan chiffré) ; null tant qu'il n'est pas
      reçu. */
  resultat: Record<string, unknown> | null;
  erreur: string | null;
}

export interface IntegrationDto {
  id: string;
  type: IntegrationType;
  nom: string;
  smsiId: string | null;
  configuration: Record<string, unknown>;
  actif: boolean;
  /** Chaque secret du type : défini ou non. La valeur n'est jamais renvoyée. */
  secrets: Record<string, boolean>;
  /** Lot F1 : fréquence de la synchronisation automatique, en heures (réglée, sinon la valeur par défaut) ; null pour un type
      sans synchronisation automatique (import de fichier, lot N1). */
  frequenceHeures: number | null;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  derniereExecution: ExecutionIntegrationDto | null;
}

/** État de l'exécutant d'exploitation (signal de vie de moins de deux minutes, comme pour le courriel) et des flux. */
export interface EtatIntegrationsDto {
  executant: { disponible: boolean; vuLe: string | null };
  /** Un flux par type qui joint un outil par le réseau (les types sans réseau n'y figurent pas). */
  flux: { type: IntegrationType; flux: FluxModule; ouvert: boolean }[];
}

/* ------------------------------------------------------------------ Exécutant (CLI) */
/** Erreur courte rapportée par l'exécutant : une ligne, sans caractère de contrôle. */
export const ERREUR_EXECUTION_MAX = 300;
export const ErreurExecution = z
  .string()
  .min(1)
  .max(ERREUR_EXECUTION_MAX)
  // eslint-disable-next-line no-control-regex
  .regex(/^[^\u0000-\u001f\u007f]+$/, 'Erreur sur une seule ligne, sans caractère de contrôle.');

/** Résultat admis par opération du type : borné et typé ; tout champ inattendu est refusé. Le résultat d'un import (lot N1)
    est compté par l'API, jamais reçu de l'exécutant. */
export const RESULTATS_OPERATION: Record<IntegrationType, Partial<Record<OperationIntegration, z.ZodType>>> = {
  tenable: { tester: ResultatTestTenable, synchroniser: BilanSynchronisation },
  algolighthouse: { tester: ResultatTestAlh, synchroniser: BilanSynchronisationAlh },
  'nessus-fichier': { importer: BilanImportNessus },
};

/** Entrée de `suivi integrations-finish <id>` : succès avec résultat, ou échec avec erreur courte. */
export const RapportExecution = z
  .object({
    ok: z.boolean(),
    resultat: z.record(z.string(), z.unknown()).nullable(),
    erreur: ErreurExecution.nullable(),
  })
  .strict()
  .refine((r) => (r.ok ? r.resultat !== null && r.erreur === null : r.resultat === null && r.erreur !== null), {
    message: 'Un succès porte un résultat sans erreur ; un échec, une erreur sans résultat.',
  });
export type RapportExecution = z.infer<typeof RapportExecution>;
