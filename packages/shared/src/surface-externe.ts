/* Module Vulnérabilités (ADR 0100, lot ALH1) : surface externe lue dans AlgoLightHouse (ALH, service de surveillance de la
   surface d'attaque exposée sur Internet, éditeur AlgoSecure), en lecture seule. L'API ne joint jamais ALH (ADR 0014) :
   l'exécutant d'exploitation lance le script isolé scripts/integration-http.py (opération « synchroniser » du connecteur
   « algolighthouse »), qui ne garde de chaque réponse que les champs listés ici et rapporte des éléments par lots bornés.
   Chaque élément est validé strictement par l'API avant d'être rangé ; un seul élément refusé fait refuser tout le lot.
   Forme des réponses lue sur le descriptif OpenAPI 3 de l'éditeur (version 1.14.0) ; aucune réponse réelle n'a été vue.
   Textes de l'éditeur gardés tels quels (titres en anglais ou en français), nettoyés et bornés comme un texte externe. Ne
   sont jamais lus ni gardés : description HTML (`note`), commentaires, pièces jointes (`uploads`), données sensibles des
   fragments (`sensitive_data`, `has_sensitive_data`), contacts.
   Lot ALH2 (décisions du RSSI du 17/11/2026) : les défauts et leurs résolutions (`defects` du détail d'une alerte) sont lus
   en liste blanche (nom, description, résolutions avec leur nom, leur description, leur facilité et leur gain), balises
   retirées par le script : du texte simple, jamais du HTML ; les CVE vues par l'éditeur entrent dans la priorité (V26). */
import { z } from 'zod';
import type { PageFailles } from './failles-tenable.js';
import { ADRESSE_IP } from './failles-tenable.js';
import type { Priorite, SourcesFailleDto } from './priorite-vulnerabilites.js';
import { comparerVersions, identiteCpe, normaliserNom } from './rapprochement-vulnerabilites.js';
import { CVE_ID, texteExterneValide } from './veille-vulnerabilites.js';

/* ------------------------------------------------------------------ Adresse de l'espace */
/** Adresse d'un espace AlgoLightHouse : `https://<espace>.algolighthouse.fr`, port 443, sans chemin. Le domaine de l'éditeur
    est écrit dans le code (le script le recontrôle) : la clé d'API ne part jamais vers un autre hôte. */
export const ADRESSE_ALH = /^https:\/\/[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.algolighthouse\.fr$/;
export const DOMAINE_ALH = 'algolighthouse.fr';

export function erreurAdresseAlh(brute: string): string | null {
  const v = brute.trim().toLowerCase().replace(/\/$/, '');
  if (!v) return 'Adresse obligatoire (https://espace.algolighthouse.fr).';
  if (!ADRESSE_ALH.test(v))
    return `Indiquez l’adresse de votre espace, de la forme https://espace.${DOMAINE_ALH}, sans port, chemin ni identifiant.`;
  return null;
}

/** Adresse normalisée : minuscules, sans barre finale. */
export const AdresseAlh = z
  .string()
  .max(300)
  .superRefine((v, ctx) => {
    const e = erreurAdresseAlh(v);
    if (e) ctx.addIssue({ code: 'custom', message: e });
  })
  .transform((v) => v.trim().toLowerCase().replace(/\/$/, ''));

/** Clé d'API (en-tête X-API-Key) : forme non documentée par l'éditeur ; caractères admis dans un en-tête, sans espace. */
export const CLE_API_ALH = /^[A-Za-z0-9._~+/=-]{16,256}$/;

/** Version rendue par « Tester la connexion » (`GET /api/v1/version`), seule information gardée. */
export const VERSION_ALH = /^[0-9]{1,4}(?:\.[0-9]{1,6}){0,4}$/;
export const ResultatTestAlh = z.object({ version: z.string().max(40).regex(VERSION_ALH) }).strict();

/* ------------------------------------------------------------------ Valeurs de l'éditeur */
/** Types d'alerte de l'éditeur (`type.value`) : tous repris (décision du RSSI). */
export const TYPES_ALERTE_ALH = [
  'vulnerable_service',
  'exposed_service',
  'config_defect',
  'data_leak',
  'typosquatting',
] as const;
export const TypeAlerteAlh = z.enum(TYPES_ALERTE_ALH);
export type TypeAlerteAlh = z.infer<typeof TypeAlerteAlh>;
export const TYPE_ALERTE_ALH_LIBELLES: Record<TypeAlerteAlh, string> = {
  vulnerable_service: 'Service vulnérable',
  exposed_service: 'Service exposé',
  config_defect: 'Défaut de configuration',
  data_leak: 'Fuite de données',
  typosquatting: 'Typosquatting',
};

/** Criticités de l'éditeur (`criticity.value`), de la plus grave à la moins grave. */
export const CRITICITES_ALH = ['critical', 'major', 'important', 'minor'] as const;
export const CriticiteAlh = z.enum(CRITICITES_ALH);
export type CriticiteAlh = z.infer<typeof CriticiteAlh>;
export const CRITICITE_ALH_LIBELLES: Record<CriticiteAlh, string> = {
  critical: 'Critique',
  major: 'Majeure',
  important: 'Importante',
  minor: 'Mineure',
};

/** Statuts d'une alerte chez l'éditeur : lus, jamais modifiés par la plateforme. */
export const STATUTS_ALERTE_ALH = [
  'untreated',
  'in-progress',
  'to-retest',
  'to-reprocess',
  'standbye',
  'completed',
  'abandoned',
  'accepted-risk',
] as const;
export const StatutAlerteAlh = z.enum(STATUTS_ALERTE_ALH);
export type StatutAlerteAlh = z.infer<typeof StatutAlerteAlh>;
export const STATUT_ALERTE_ALH_LIBELLES: Record<StatutAlerteAlh, string> = {
  untreated: 'Non traitée',
  'in-progress': 'En cours',
  'to-retest': 'À retester',
  'to-reprocess': 'À retraiter',
  standbye: 'En attente',
  completed: 'Terminée',
  abandoned: 'Abandonnée',
  'accepted-risk': 'Risque accepté',
};
/** Statuts d'une alerte encore ouverte chez l'éditeur. */
export const STATUTS_ALERTE_ALH_OUVERTS: readonly StatutAlerteAlh[] = [
  'untreated',
  'in-progress',
  'to-retest',
  'to-reprocess',
  'standbye',
];

/** Statut de surveillance d'un actif (hôte ou domaine) chez l'éditeur. */
export const STATUTS_ACTIF_ALH = ['new', 'monitored', 'ignored', 'pending-approval', 'provider'] as const;
export const StatutActifAlh = z.enum(STATUTS_ACTIF_ALH);
export type StatutActifAlh = z.infer<typeof StatutActifAlh>;
export const STATUT_ACTIF_ALH_LIBELLES: Record<StatutActifAlh, string> = {
  new: 'Nouveau',
  monitored: 'Surveillé',
  ignored: 'Ignoré',
  'pending-approval': 'En attente d’approbation',
  provider: 'Fournisseur',
};

/** Nature de la cible d'une alerte chez l'éditeur. */
export const TYPES_CIBLE_ALH = ['domain', 'host', 'service', 'keyword'] as const;
export const TypeCibleAlh = z.enum(TYPES_CIBLE_ALH);
export type TypeCibleAlh = z.infer<typeof TypeCibleAlh>;
export const TYPE_CIBLE_ALH_LIBELLES: Record<TypeCibleAlh, string> = {
  domain: 'Domaine',
  host: 'Hôte',
  service: 'Service',
  keyword: 'Mot-clé',
};

/** Actifs rangés par la plateforme : hôtes (adresses IP) et domaines. */
export const TYPES_ACTIF_ALH = ['hote', 'domaine'] as const;
export const TypeActifAlh = z.enum(TYPES_ACTIF_ALH);
export type TypeActifAlh = z.infer<typeof TypeActifAlh>;
export const TYPE_ACTIF_ALH_LIBELLES: Record<TypeActifAlh, string> = { hote: 'Hôte', domaine: 'Domaine' };

/* ------------------------------------------------------------------ Bornes */
/** Bornes reprises par la migration 080, par le script de l'exécutant (BORNES_ALH, comparées par un test d'architecture) et
    par l'exécutant. Le descriptif de l'éditeur ne documente aucune pagination : chaque liste est lue en une réponse, bornée
    en taille et en nombre d'éléments ; au-delà, la synchronisation est incomplète et ne fait rien disparaître. */
export const ALH_BORNES = {
  /** Taille d'une réponse (octets) : listes (alertes, actifs, technologies), détail d'une alerte, réponses courtes. */
  reponseListe: 16 * 1024 * 1024,
  reponseDetail: 2 * 1024 * 1024,
  reponseCourte: 64 * 1024,
  /** Éléments gardés par liste. */
  perimetres: 500,
  alertes: 5000,
  hotes: 10000,
  domaines: 10000,
  technologies: 2000,
  /** Détails d'alerte lus par synchronisation (type, criticité, cible, CVE), les plus récentes d'abord. */
  details: 300,
  versionsParTechnologie: 50,
  actifsParVersion: 200,
  cvesParVersion: 200,
  cvesParAlerte: 200,
  /** Liens technologie-actif et CVE de technologie, au plus, par synchronisation. */
  liensTechnologies: 20000,
  cvesTechnologies: 20000,
  /** Durée d'une synchronisation, en secondes, lectures comprises. */
  dureeSecondes: 480,
  titre: 300,
  nomPerimetre: 200,
  valeurCible: 300,
  domaine: 253,
  fai: 200,
  nomTechnologie: 200,
  editeur: 100,
  produit: 100,
  version: 100,
  cleTechnologie: 410,
  titreCve: 300,
  severite: 20,
  /** Défauts d'une alerte, résolutions par défaut (lot ALH2), et longueur de leurs textes. */
  defautsParAlerte: 20,
  resolutionsParDefaut: 10,
  nomDefaut: 300,
  descriptionDefaut: 4000,
  niveauResolution: 60,
  /** Éléments par lot rapporté par l'exécutant, et lots par synchronisation. */
  lot: 500,
  lots: 200,
} as const;

/* ------------------------------------------------------------------ Formes contrôlées */
const UUID_MINUSCULES = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
/** Nom de domaine en minuscules (un joker « *. » de tête est admis), 253 caractères au plus. */
export const NOM_DOMAINE_ALH =
  /^(?:\*\.)?(?:[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
export const ASN_ALH = /^[0-9]{1,10}$/;
export const PAYS_ALH = /^[A-Z]{2}$/;
const uuid = z.string().regex(UUID_MINUSCULES, 'Identifiant UUID en minuscules attendu.');
const instant = z.iso.datetime().nullable();
const texte = (max: number) =>
  z.string().min(1).max(max).refine(texteExterneValide, 'Texte externe non nettoyé : refusé.');
const adresseIp = z.string().max(45).regex(ADRESSE_IP);
const domaine = z.string().max(ALH_BORNES.domaine).regex(NOM_DOMAINE_ALH);
const cves = (max: number) =>
  z
    .array(z.string().regex(CVE_ID, 'Identifiant CVE attendu.'))
    .max(max)
    .refine((c) => new Set(c).size === c.length, 'CVE en double.');

/* ------------------------------------------------------------------ Éléments rapportés par l'exécutant */
export const ElementPerimetreAlh = z
  .object({ type: z.literal('perimetre'), id: uuid, nom: texte(ALH_BORNES.nomPerimetre) })
  .strict();
export type ElementPerimetreAlh = z.infer<typeof ElementPerimetreAlh>;

/** Hôte (adresse IP) de la cartographie. */
export const ElementHoteAlh = z
  .object({
    type: z.literal('hote'),
    id: uuid,
    perimetre: uuid.nullable(),
    statut: StatutActifAlh.nullable(),
    adresse: adresseIp,
    fai: texte(ALH_BORNES.fai).nullable(),
    asn: z.string().regex(ASN_ALH).nullable(),
    pays: z.string().regex(PAYS_ALH).nullable(),
    mutualise: z.boolean().nullable(),
    cdn: z.boolean().nullable(),
    joignable: z.boolean().nullable(),
    joignableLe: instant,
    importManuel: z.boolean().nullable(),
    creeLe: instant,
    majLe: instant,
  })
  .strict();
export type ElementHoteAlh = z.infer<typeof ElementHoteAlh>;

/** Domaine de la cartographie. */
export const ElementDomaineAlh = z
  .object({
    type: z.literal('domaine'),
    id: uuid,
    perimetre: uuid.nullable(),
    statut: StatutActifAlh.nullable(),
    domaine,
    niveau: z.number().int().min(1).max(127).nullable(),
    importManuel: z.boolean().nullable(),
    adresse: adresseIp.nullable(),
    parent: uuid.nullable(),
    creeLe: instant,
    majLe: instant,
  })
  .strict();
export type ElementDomaineAlh = z.infer<typeof ElementDomaineAlh>;

/** Résolution recommandée par l'éditeur pour un défaut (lot ALH2) : texte simple, balises retirées par le script. Facilité
    (`ease_of_execution.value`, par exemple « Quick Win ») et gain (`security_gain.value`, par exemple « Strong ») tels quels. */
export const ResolutionAlh = z
  .object({
    nom: texte(ALH_BORNES.nomDefaut),
    description: texte(ALH_BORNES.descriptionDefaut).nullable(),
    facilite: texte(ALH_BORNES.niveauResolution).nullable(),
    gain: texte(ALH_BORNES.niveauResolution).nullable(),
  })
  .strict();
export type ResolutionAlh = z.infer<typeof ResolutionAlh>;

/** Défaut d'une alerte (description de la vulnérabilité) et ses résolutions, lus dans le détail. */
export const DefautAlh = z
  .object({
    nom: texte(ALH_BORNES.nomDefaut),
    description: texte(ALH_BORNES.descriptionDefaut).nullable(),
    resolutions: z.array(ResolutionAlh).max(ALH_BORNES.resolutionsParDefaut),
  })
  .strict();
export type DefautAlh = z.infer<typeof DefautAlh>;
/** Défauts rangés avec une alerte (colonne `defauts` de la migration 081), relus avec ce schéma ; illisibles : aucun. */
export const DefautsAlh = z.array(DefautAlh).max(ALH_BORNES.defautsParAlerte);

/** Alerte : champs de la liste ; type, criticité, cible, CVE et défauts viennent du détail (`detail` vrai), lu pour les
    alertes les plus récentes seulement (ALH_BORNES.details). Sans détail, la valeur déjà rangée est gardée. */
export const ElementAlerteAlh = z
  .object({
    type: z.literal('alerte'),
    id: uuid,
    perimetre: uuid.nullable(),
    typeAlerte: TypeAlerteAlh.nullable(),
    criticite: CriticiteAlh.nullable(),
    statut: StatutAlerteAlh,
    titre: texte(ALH_BORNES.titre),
    verifiee: z.boolean().nullable(),
    detail: z.boolean(),
    cibleType: TypeCibleAlh.nullable(),
    cibleValeur: texte(ALH_BORNES.valeurCible).nullable(),
    cibleHote: uuid.nullable(),
    cibleDomaine: uuid.nullable(),
    cves: cves(ALH_BORNES.cvesParAlerte),
    defauts: DefautsAlh,
    creeLe: instant,
    majLe: instant,
    termineeLe: instant,
  })
  .strict()
  .refine(
    (a) =>
      a.detail || (a.cves.length === 0 && a.defauts.length === 0 && a.cibleType === null && a.cibleValeur === null),
    { message: 'Cible, CVE et défauts ne viennent que du détail d’une alerte.' },
  );
export type ElementAlerteAlh = z.infer<typeof ElementAlerteAlh>;

/** Technologie détectée : identifiée par une clé calculée par le script (éditeur, produit, technologie, en minuscules). */
export const ElementTechnologieAlh = z
  .object({
    type: z.literal('technologie'),
    cle: texte(ALH_BORNES.cleTechnologie),
    nom: texte(ALH_BORNES.nomTechnologie),
    editeur: texte(ALH_BORNES.editeur).nullable(),
    produit: texte(ALH_BORNES.produit).nullable(),
    technologie: texte(ALH_BORNES.nomTechnologie).nullable(),
    derniere: instant,
    /** La technologie avait plus de versions, d'actifs ou de CVE que les bornes : les premiers seulement sont gardés. */
    tronquee: z.boolean(),
  })
  .strict();
export type ElementTechnologieAlh = z.infer<typeof ElementTechnologieAlh>;

/** Actif qui exécute une version d'une technologie (`actuel` : version encore détectée ; sinon actif où elle ne l'est
    plus, version vide). */
export const ElementTechnologieActifAlh = z
  .object({
    type: z.literal('technologie_actif'),
    technologie: texte(ALH_BORNES.cleTechnologie),
    version: z.string().max(ALH_BORNES.version).refine(texteExterneValide, 'Texte externe non nettoyé : refusé.'),
    actif: uuid,
    typeActif: TypeActifAlh,
    libelle: texte(ALH_BORNES.valeurCible),
    actuel: z.boolean(),
  })
  .strict();
export type ElementTechnologieActifAlh = z.infer<typeof ElementTechnologieActifAlh>;

/** CVE associée à une version d'une technologie, avec ce qu'en dit l'éditeur. */
export const ElementTechnologieCveAlh = z
  .object({
    type: z.literal('technologie_cve'),
    technologie: texte(ALH_BORNES.cleTechnologie),
    version: z.string().max(ALH_BORNES.version).refine(texteExterneValide, 'Texte externe non nettoyé : refusé.'),
    cve: z.string().regex(CVE_ID, 'Identifiant CVE attendu.'),
    titre: texte(ALH_BORNES.titreCve).nullable(),
    cvss: z.number().min(0).max(10).nullable(),
    epss: z.number().min(0).max(1).nullable(),
    severite: z
      .string()
      .max(ALH_BORNES.severite)
      .regex(/^[a-z]{1,20}$/)
      .nullable(),
    preuve: z.boolean().nullable(),
    exploitee: z.boolean().nullable(),
    publieeLe: instant,
  })
  .strict();
export type ElementTechnologieCveAlh = z.infer<typeof ElementTechnologieCveAlh>;

export const ElementSurfaceExterne = z.union([
  ElementPerimetreAlh,
  ElementHoteAlh,
  ElementDomaineAlh,
  ElementAlerteAlh,
  ElementTechnologieAlh,
  ElementTechnologieActifAlh,
  ElementTechnologieCveAlh,
]);
export type ElementSurfaceExterne = z.infer<typeof ElementSurfaceExterne>;

const compte = (max: number) => z.number().int().min(0).max(max);

/** Bilan d'une synchronisation d'ALH, compté par le script et l'exécutant (nombres seulement). `tronque` : une borne a été
    atteinte (nombre d'éléments d'une liste, détails, durée) ; la synchronisation est incomplète et ne fait rien disparaître. */
export const BilanSynchronisationAlh = z
  .object({
    elements: compte(ALH_BORNES.lot * ALH_BORNES.lots),
    perimetres: compte(ALH_BORNES.perimetres),
    hotes: compte(ALH_BORNES.hotes),
    domaines: compte(ALH_BORNES.domaines),
    alertes: compte(ALH_BORNES.alertes),
    details: compte(ALH_BORNES.details),
    technologies: compte(ALH_BORNES.technologies),
    ecartes: compte(10_000_000),
    tronque: z.boolean(),
  })
  .strict();
export type BilanSynchronisationAlh = z.infer<typeof BilanSynchronisationAlh>;

/* ------------------------------------------------------------------ API : lecture */
export const SURFACE_PAR_PAGE = 25;
const recherche = z.string().trim().max(100).optional();
const page = z.coerce.number().int().min(1).max(1000).default(1);

/** Ordre des listes (lot ALH2) : `priorite` (priorité calculée par la plateforme, puis l'ordre par défaut) ; absent : ordre
    par défaut (criticité de l'éditeur pour les alertes, CVE exploitées pour les technologies). */
export const TriSurface = z.enum(['priorite']);
export type TriSurface = z.infer<typeof TriSurface>;

/** Alertes : recherche dans le titre, la cible ou une CVE ; filtres type, criticité, statut (absent : les alertes encore
    ouvertes chez l'éditeur ; `toutes`) ; ordre. */
export const RechercheAlertesAlh = z
  .object({
    q: recherche,
    type: TypeAlerteAlh.optional(),
    criticite: CriticiteAlh.optional(),
    statut: z.union([StatutAlerteAlh, z.literal('toutes')]).optional(),
    tri: TriSurface.optional(),
    page,
  })
  .strict();
export type RechercheAlertesAlh = z.infer<typeof RechercheAlertesAlh>;

/** Actifs : recherche dans l'adresse ou le domaine ; filtre par type. */
export const RechercheActifsAlh = z.object({ q: recherche, type: TypeActifAlh.optional(), page }).strict();
export type RechercheActifsAlh = z.infer<typeof RechercheActifsAlh>;

/** Technologies : recherche dans le nom, l'éditeur, le produit ou une CVE ; filtre « exploitée selon l'éditeur ». */
export const RechercheTechnologiesAlh = z
  .object({ q: recherche, exploitee: z.enum(['oui']).optional(), tri: TriSurface.optional(), page })
  .strict();
export type RechercheTechnologiesAlh = z.infer<typeof RechercheTechnologiesAlh>;

export interface PerimetreLieDto {
  /** Périmètre ALH (nom de l'éditeur) et périmètre de la plateforme auquel il est relié (null : non relié). */
  perimetreAlh: string | null;
  perimetreNom: string | null;
}

export interface AlerteAlhDto extends PerimetreLieDto {
  id: string;
  type: TypeAlerteAlh | null;
  criticite: CriticiteAlh | null;
  statut: StatutAlerteAlh;
  titre: string;
  verifiee: boolean | null;
  /** Le détail de l'alerte a été lu au moins une fois (sinon type, criticité, cible et CVE peuvent manquer). */
  detail: boolean;
  cible: { type: TypeCibleAlh | null; valeur: string | null } | null;
  cves: string[];
  creeLe: string | null;
  majLe: string | null;
  termineeLe: string | null;
  integration: { id: string; nom: string };
  /** Priorité calculée par la plateforme (lot ALH2) : la plus haute des CVE de l'alerte, présence « exposée » tant que
      l'alerte est ouverte chez l'éditeur (sinon « absente ») ; null pour une alerte sans CVE. */
  priorite: Priorite | null;
  /** Défauts décrits par l'éditeur (recommandations, dans la fiche de l'alerte). */
  nombreDefauts: number;
}

/** CVE d'une alerte, avec sa priorité et ce que chaque source en dit (fiche de l'alerte). */
export interface CveAlerteAlhDto {
  cve: string;
  priorite: Priorite;
  sources: SourcesFailleDto;
}

/** Fiche d'une alerte (lot ALH2) : ses CVE avec leur priorité, et les défauts et résolutions recommandés par l'éditeur,
    en texte simple (à afficher comme texte, jamais comme HTML). */
export interface FicheAlerteAlhDto extends AlerteAlhDto {
  cvesDetail: CveAlerteAlhDto[];
  defauts: DefautAlh[];
}

export interface ActifAlhDto extends PerimetreLieDto {
  id: string;
  type: TypeActifAlh;
  /** Adresse IP (hôte) ou nom de domaine. */
  valeur: string;
  statut: StatutActifAlh | null;
  /** Domaine : adresse vers laquelle il résout ; hôte : null. */
  adresse: string | null;
  fai: string | null;
  asn: string | null;
  pays: string | null;
  cdn: boolean | null;
  mutualise: boolean | null;
  joignable: boolean | null;
  joignableLe: string | null;
  niveau: number | null;
  /** Alertes encore ouvertes lisibles dont l'actif est la cible. */
  alertesOuvertes: number;
  /** Technologies encore détectées sur l'actif. */
  technologies: number;
  creeLe: string | null;
  majLe: string | null;
  integration: { id: string; nom: string };
}

export interface CveTechnologieAlhDto {
  cve: string;
  titre: string | null;
  cvss: number | null;
  epss: number | null;
  severite: string | null;
  preuve: boolean | null;
  exploitee: boolean | null;
  publieeLe: string | null;
  /** Priorité calculée par la plateforme (présence « exposée », toutes les sources ; lot ALH2). */
  priorite: Priorite;
}

/** Produit surveillé rapproché d'une technologie (lot ALH2), par la règle du rapprochement des CVE : identifiant normalisé
    (CPE) du produit s'il en porte un, sinon noms normalisés de l'éditeur et du produit. Indication seulement : rien n'est
    rattaché ni décidé ; `memeVersion` compare la version déclarée aux versions détectées (null : non comparable). */
export interface ProduitRapprocheAlhDto {
  id: string;
  editeur: string;
  nom: string;
  versionProduit: string;
  par: 'cpe' | 'nom';
  memeVersion: boolean | null;
}

export interface VersionTechnologieAlhDto {
  /** Version détectée ; vide quand l'éditeur ne la connaît pas. */
  version: string;
  actifs: { type: TypeActifAlh; libelle: string }[];
  cves: CveTechnologieAlhDto[];
}

export interface TechnologieAlhDto {
  id: string;
  nom: string;
  editeur: string | null;
  produit: string | null;
  technologie: string | null;
  derniere: string | null;
  tronquee: boolean;
  /** Versions encore détectées sur au moins un actif lisible. */
  versions: VersionTechnologieAlhDto[];
  /** Actifs lisibles où la technologie n'est plus détectée. */
  actifsInactifs: number;
  nombreCves: number;
  /** CVE que l'éditeur dit exploitées, et celles qui ont une preuve de concept publique. */
  exploitees: number;
  preuves: number;
  cvssMax: number | null;
  integration: { id: string; nom: string };
  /** Priorité la plus haute de ses CVE (null : aucune CVE) ; lot ALH2. */
  priorite: Priorite | null;
  /** Produits surveillés rapprochés (lot ALH2). */
  produits: ProduitRapprocheAlhDto[];
}

/** Ce que la surface externe dit d'une CVE, pour la personne qui regarde (lot ALH2) : actifs lisibles qui la portent (par
    une version détectée d'une technologie, ou comme cible d'une alerte ouverte), alertes ouvertes lisibles qui la citent. */
export interface SurfaceCveDto {
  actifs: number;
  alertes: number;
}

/** Technologie de la surface externe rapprochée d'un produit surveillé (fiche du produit, lot ALH2). */
export interface TechnologieRapprocheeDto {
  id: string;
  nom: string;
  editeur: string | null;
  produit: string | null;
  versions: string[];
  actifs: number;
  par: 'cpe' | 'nom';
  memeVersion: boolean | null;
}

/** Périmètre ALH et sa liaison (lecture et liaison réservées à vulnerabilites:administrer). */
export interface PerimetreAlhDto {
  id: string;
  nom: string;
  perimetreId: string | null;
  perimetreNom: string | null;
  /** Vu par la dernière synchronisation complète, ou plus récemment. */
  present: boolean;
  alertes: number;
  actifs: number;
  version: number;
  majPar: string | null;
  majLe: string;
  integration: { id: string; nom: string };
}

/** Relier (ou délier, `null`) un périmètre ALH à un périmètre de la plateforme ; version attendue par If-Match. */
export const LiaisonPerimetreAlh = z.object({ perimetreId: z.uuid().nullable() }).strict();
export type LiaisonPerimetreAlh = z.infer<typeof LiaisonPerimetreAlh>;

export interface EtatSurfaceExterneDto {
  integrationId: string;
  nom: string;
  actif: boolean;
  derniere: {
    id: string;
    etat: 'en_file' | 'en_cours' | 'recu' | 'echec' | 'expire';
    origine: 'manuel' | 'planifie';
    demandeLe: string;
    termineLe: string | null;
    bilan: BilanSynchronisationAlh | null;
    erreur: string | null;
  } | null;
  derniereCompleteLe: string | null;
  /** Périmètres ALH présents sans liaison : leur contenu n'est visible que de l'administration du module ; ce nombre aussi
      (null sans le droit d'administrer). */
  perimetresNonRelies: number | null;
}

export type PageSurface<T> = PageFailles<T>;

/* ------------------------------------------------------------------ Rapprochement avec les produits surveillés (lot ALH2) */
/** Règle du rapprochement des CVE (ADR 0100, point 8), appliquée à une technologie détectée : par l'identifiant normalisé
    (CPE) du produit s'il en porte un (éditeur et produit exacts, à la casse près : l'éditeur les tire du CPE), sinon par
    les noms normalisés de l'éditeur et du produit. Une technologie sans éditeur ou sans produit connu n'est pas rapprochée.
    Rend la manière du rapprochement, ou null. */
export function rapprochementTechnologie(
  t: { editeur: string | null; produit: string | null },
  p: { editeur: string; nom: string; cpe: string | null },
): 'cpe' | 'nom' | null {
  if (!t.editeur || !t.produit) return null;
  const identite = identiteCpe(p.cpe);
  if (identite)
    return t.editeur.toLowerCase() === identite.editeur && t.produit.toLowerCase() === identite.produit ? 'cpe' : null;
  const e = normaliserNom(p.editeur);
  const n = normaliserNom(p.nom);
  return e && n && normaliserNom(t.editeur) === e && normaliserNom(t.produit) === n ? 'nom' : null;
}

/** La version déclarée d'un produit figure parmi les versions détectées : vrai si l'une est égale ; faux si toutes se
    comparent et aucune n'est égale ; null sinon (version vide ou non comparable). */
export function memeVersionDetectee(versions: readonly string[], versionDeclaree: string): boolean | null {
  const connues = versions.filter((v) => v.trim());
  if (!connues.length) return null;
  const r = connues.map((v) => comparerVersions(v.trim(), versionDeclaree.trim()));
  if (r.includes(0)) return true;
  return r.every((x) => x !== null) ? false : null;
}
