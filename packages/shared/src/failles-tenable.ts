/* Module Vulnérabilités (ADR 0100, lot V5) : failles et machines lues dans Tenable Security Center. L'API ne joint jamais
   Tenable (ADR 0014) : l'exécutant d'exploitation lance le script isolé scripts/integration-http.py (opération
   « synchroniser » du connecteur « tenable »), qui ne garde de chaque résultat que les champs listés ici et rapporte des
   éléments par lots bornés. Chaque élément est validé strictement par l'API avant d'être rangé ; un seul élément refusé fait
   refuser tout le lot. Forme des réponses relevée sur une instance 6.9.1 (cadrage, §5 bis) ; aucun autre champ n'est
   supposé. Les textes de Tenable sont gardés en anglais, tels quels (V19), nettoyés et bornés comme un texte externe. */
import { z } from 'zod';
import type { Priorite, RangMachineDto, SourcesFailleDto } from './priorite-vulnerabilites.js';
import type { MachineMarqueeDto } from './parc-machines.js';
import { type DelaiFailleDto, EtatDelaiFiltre, TriFailles } from './delais-vulnerabilites.js';
import { FiltreSuivi, type SuiviResumeDto } from './suivi-vulnerabilites.js';
import { CVE_ID, texteExterneValide } from './veille-vulnerabilites.js';
import type { EtatCorrectifDto } from './correctifs-vulnerabilites.js';
import { FiltreAcr, FiltreAes } from './scores-tenable.js';

/* ------------------------------------------------------------------ Gravités */
/** Gravités retenues (identifiants stables : base, filtre de l'instance). La gravité « info » de Tenable n'est jamais lue. */
export const GRAVITES_TENABLE = ['critique', 'elevee', 'moyenne', 'faible'] as const;
export const GraviteTenable = z.enum(GRAVITES_TENABLE);
export type GraviteTenable = z.infer<typeof GraviteTenable>;
export const GRAVITE_TENABLE_LIBELLES: Record<GraviteTenable, string> = {
  critique: 'Critique',
  elevee: 'Élevée',
  moyenne: 'Moyenne',
  faible: 'Faible',
};
/** Identifiant de la gravité dans Tenable (`severity.id`), utilisé pour le filtre de l'analyse. */
export const GRAVITE_TENABLE_ID: Record<GraviteTenable, string> = {
  critique: '4',
  elevee: '3',
  moyenne: '2',
  faible: '1',
};
/** Filtre par défaut d'une instance : critiques et élevées. */
export const GRAVITES_PAR_DEFAUT: GraviteTenable[] = ['critique', 'elevee'];
/** Filtre de gravité réglé sur l'instance : au moins une, sans doublon, rangé de la plus grave à la moins grave. */
export const FiltreGravites = z
  .array(GraviteTenable)
  .min(1, 'Choisissez au moins une gravité.')
  .max(GRAVITES_TENABLE.length)
  .refine((g) => new Set(g).size === g.length, 'Gravité en double.')
  .transform((g) => GRAVITES_TENABLE.filter((x) => g.includes(x)));

/** Niveaux de priorité calculés par la plateforme (ADR 0100, point 9 ; calcul dans priorite-vulnerabilites.ts). */
export const NIVEAUX_PRIORITE = ['P1', 'P2', 'P3', 'P4'] as const;
export const NiveauPriorite = z.enum(NIVEAUX_PRIORITE);
export type NiveauPriorite = z.infer<typeof NiveauPriorite>;

/* ------------------------------------------------------------------ Bornes */
/** Bornes reprises par la migration 075, par le script de l'exécutant (BORNES_SYNCHRO) et par l'exécutant lui-même ; un
    test d'architecture vérifie que les copies concordent. */
export const TENABLE_BORNES = {
  /** Résultats demandés par page de l'analyse (`vulndetails`), et pages au plus : 20 000 détections. */
  pageAnalyse: 200,
  pagesAnalyse: 100,
  detections: 20000,
  /** Machines demandées par page de l'inventaire (`GET /rest/hosts`), et pages au plus. */
  pageMachines: 500,
  pagesMachines: 20,
  /** Durée d'une synchronisation, en secondes, lectures comprises : au-delà, elle s'arrête et se dit incomplète. */
  dureeSecondes: 480,
  /** Taille d'une réponse de Tenable (octets) : analyse, inventaire. */
  reponseAnalyse: 8 * 1024 * 1024,
  reponseMachines: 4 * 1024 * 1024,
  cvesParConstat: 500,
  nomControle: 300,
  famille: 100,
  synopsis: 1000,
  correctif: 2000,
  libelleExploit: 100,
  voirAussi: 500,
  nomMachine: 255,
  systeme: 200,
  exposition: 40,
  /** Nom d'un dépôt de Tenable (`repository.name`, lot V4d). */
  nomDepot: 200,
  /** Lot QF-TEN : correctifs regroupés (`sumremediation`) lus au plus, pages de cette vue au plus (par `pageAnalyse`),
      contrôles gardés par correctif, longueur de l'identifiant (`solutionID`). Le texte est borné par `correctif`. */
  correctifs: 5000,
  pagesCorrectifs: 25,
  controlesParCorrectif: 1000,
  identifiantCorrectif: 64,
  /** Éléments par lot rapporté par l'exécutant, et lots par synchronisation. */
  lot: 500,
  lots: 200,
} as const;

/* ------------------------------------------------------------------ Formes contrôlées */
/** Numéro d'un contrôle de Tenable (`pluginID`). */
export const PLUGIN_ID = /^[1-9]\d{0,8}$/;
/** Adresse IPv4, ou IPv6 en minuscules. */
export const ADRESSE_IP =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}|(?=[0-9a-f:.]*:)[0-9a-f:.]{2,45})$/;
/** Nom d'une machine (nom DNS ou NetBIOS), en minuscules : lettres, chiffres, point, tiret et soulignement. */
export const NOM_MACHINE = /^[a-z0-9][a-z0-9._-]{0,254}$/;
const UUID_MINUSCULES = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
/** Identifiant d'une machine dans sa source : `uuid:<hostUUID>`, ou à défaut `ip:<adresse>` suivi de `|<nom>` s'il est connu. */
export const CLE_MACHINE = new RegExp(
  `^(?:uuid:${UUID_MINUSCULES}|ip:[0-9a-f:.]{2,45}(?:\\|[a-z0-9][a-z0-9._-]{0,254})?)$`,
);
/** Indice d'exposition lu dans `keyDrivers` (« internet exposure ») : mot court en minuscules. */
export const EXPOSITION = /^[a-z][a-z0-9 _-]{0,39}$/;
/** Vecteur CVSS v3 tel que Tenable le rend (préfixe « CVSS:3.x/ » facultatif), affiché tel quel. */
export const CVSS3_VECTEUR_TENABLE =
  /^(?:CVSS:3\.[01]\/)?[A-Za-z]{1,3}:[A-Za-z]{1,2}(?:\/[A-Za-z]{1,3}:[A-Za-z]{1,2}){0,20}$/;
/** Lien « voir aussi » : https seulement, sans espace ni guillemet ni chevron. */
export const VOIR_AUSSI = /^https:\/\/[A-Za-z0-9.-]{1,253}(?::\d{1,5})?(?:[/?#][\x21-\x7e]*)?$/;
const VOIR_AUSSI_INTERDITS = /["'<>\\`]/;
export const PROTOCOLE = /^[A-Z0-9]{1,10}$/;
/** Identifiant d'un dépôt de Tenable (`repository.id`, nombre entier positif ; lot V4d). */
export const DEPOT_TENABLE = /^[1-9]\d{0,8}$/;

/** Identifiant d'une machine dans sa source, calculé de la même façon par le script (cle_machine) et par l'API. */
export function cleMachine(uuid: string | null, adresse: string | null, nom: string | null): string | null {
  if (uuid) return `uuid:${uuid.toLowerCase()}`;
  if (!adresse) return null;
  return nom ? `ip:${adresse}|${nom}` : `ip:${adresse}`;
}

const texteTenable = (max: number) =>
  z.string().min(1).max(max).refine(texteExterneValide, 'Texte externe non nettoyé : refusé.');
const instant = z.iso.datetime().nullable();
const uuid = z.string().regex(new RegExp(`^${UUID_MINUSCULES}$`), 'Identifiant UUID en minuscules attendu.');
const score10 = z.number().min(0).max(10).nullable();

/* ------------------------------------------------------------------ Éléments rapportés par l'exécutant */
/** Dépôt de Tenable où l'analyse a vu la machine (lot V4d) : identifiant et nom seulement (liste blanche du script). */
export const DepotElementTenable = z
  .object({ id: z.string().regex(DEPOT_TENABLE), nom: texteTenable(TENABLE_BORNES.nomDepot) })
  .strict();
export type DepotElementTenable = z.infer<typeof DepotElementTenable>;

/** Machine vue par l'analyse : identifiant, nom, adresse, système, dates, indice d'exposition, criticité de l'actif, dépôt
    (lot V4d ; absent : inconnu, la machine garde son dépôt rangé), score d'exposition de l'actif (AES, lot TEN-SCORES :
    entier de 0 à 1000 ; facultatif pour rester compatible avec un script plus ancien ; absent ou null : non fourni). */
export const ElementMachineTenable = z
  .object({
    type: z.literal('machine'),
    cle: z.string().max(400).regex(CLE_MACHINE),
    uuid: uuid.nullable(),
    nom: z.string().max(TENABLE_BORNES.nomMachine).regex(NOM_MACHINE).nullable(),
    adresse: z.string().max(45).regex(ADRESSE_IP).nullable(),
    systeme: texteTenable(TENABLE_BORNES.systeme).nullable(),
    premiere: instant,
    derniere: instant,
    exposition: z.string().max(TENABLE_BORNES.exposition).regex(EXPOSITION).nullable(),
    acr: score10,
    aes: z.number().int().min(0).max(1000).nullable().optional(),
    depot: DepotElementTenable.nullable().optional(),
  })
  .strict()
  .refine((m) => m.cle === cleMachine(m.uuid, m.adresse, m.nom), { message: 'Identifiant de machine incohérent.' });
export type ElementMachineTenable = z.infer<typeof ElementMachineTenable>;

/** Kits d'exploitation nommés par Tenable (« Exploit available », « Exploitable with ») : Metasploit, Core Impact, CANVAS
    (ADR 0100, lot PRIO-1). Security Center les cite dans la CHAÎNE `exploitFrameworks` (pas une liste) ; un fichier .nessus
    dans `exploit_framework_metasploit`, `exploit_framework_core` et `exploit_framework_canvas`. Aucun autre nom n'est
    retenu. Rangés avec « exploitable » (source `tenable-kit` de la grille), jamais comme exploitation avérée. */
export const KITS_EXPLOITATION = ['metasploit', 'core_impact', 'canvas'] as const;
export type KitExploitation = (typeof KITS_EXPLOITATION)[number];
export const KIT_EXPLOITATION_LIBELLES: Record<KitExploitation, string> = {
  metasploit: 'Metasploit',
  core_impact: 'Core Impact',
  canvas: 'CANVAS',
};
/** Liste de kits, sans doublon (schéma des éléments reçus). */
export const KitsExploitation = z
  .array(z.enum(KITS_EXPLOITATION))
  .max(KITS_EXPLOITATION.length)
  .refine((l) => new Set(l).size === l.length, 'Kit cité deux fois.');

/** Kits cités par la chaîne `exploitFrameworks` de Security Center : chaque nom connu présent (casse ignorée), dans l'ordre
    de KITS_EXPLOITATION ; tout autre texte est ignoré (rien n'est inventé). */
export function kitsDepuisTexte(texte: string | null | undefined): KitExploitation[] {
  const t = (texte ?? '').toLowerCase();
  if (!t.trim()) return [];
  const motifs: Record<KitExploitation, RegExp> = {
    metasploit: /\bmetasploit\b/,
    core_impact: /\bcore\s+impact\b/,
    canvas: /\bcanvas\b/,
  };
  return KITS_EXPLOITATION.filter((k) => motifs[k].test(t));
}

/** Kits rangés dans l'ordre de KITS_EXPLOITATION, sans doublon ni valeur inconnue. */
export const kitsRanges = (kits: readonly string[] | null | undefined): KitExploitation[] =>
  KITS_EXPLOITATION.filter((k) => (kits ?? []).includes(k));

/** Libellé d'une liste de kits : « Metasploit, CANVAS ». */
export const libelleKits = (kits: readonly KitExploitation[]) =>
  kits.map((k) => KIT_EXPLOITATION_LIBELLES[k]).join(', ');

/** Constat de Tenable (un par contrôle) : champs du contrôle, CVE (bornées), sans aucune machine. */
export const ElementConstatTenable = z
  .object({
    type: z.literal('constat'),
    plugin: z.string().regex(PLUGIN_ID),
    nom: texteTenable(TENABLE_BORNES.nomControle),
    gravite: GraviteTenable,
    famille: texteTenable(TENABLE_BORNES.famille).nullable(),
    synopsis: texteTenable(TENABLE_BORNES.synopsis).nullable(),
    correctif: texteTenable(TENABLE_BORNES.correctif).nullable(),
    cvss3Vecteur: z.string().max(200).regex(CVSS3_VECTEUR_TENABLE).nullable(),
    cvss3Score: score10,
    vpr: score10,
    /** Probabilité EPSS entre 0 et 1 (Tenable la rend en pourcentage : convertie par le script). */
    epss: z.number().min(0).max(1).nullable(),
    exploitable: z.boolean(),
    exploitLibelle: texteTenable(TENABLE_BORNES.libelleExploit).nullable(),
    /** Lot PRIO-1 : kits d'exploitation cités par Tenable (absent : aucun). */
    kitsExploitation: KitsExploitation.optional(),
    failleLe: instant,
    correctifLe: instant,
    finSupportLe: instant,
    voirAussi: z
      .string()
      .max(TENABLE_BORNES.voirAussi)
      .regex(VOIR_AUSSI)
      .refine((s) => !VOIR_AUSSI_INTERDITS.test(s), 'Lien refusé.')
      .nullable(),
    cves: z
      .array(z.string().regex(CVE_ID, 'Identifiant CVE attendu.'))
      .max(TENABLE_BORNES.cvesParConstat)
      .refine((c) => new Set(c).size === c.length, 'CVE en double.'),
    /** Le contrôle citait plus de CVE que la borne : les premières seulement sont gardées. */
    cvesTronquees: z.boolean(),
  })
  .strict();
export type ElementConstatTenable = z.infer<typeof ElementConstatTenable>;

/** Détection d'un constat sur une machine (et un port). */
export const ElementDetectionTenable = z
  .object({
    type: z.literal('detection'),
    plugin: z.string().regex(PLUGIN_ID),
    machine: z.string().max(400).regex(CLE_MACHINE),
    port: z.number().int().min(0).max(65535),
    protocole: z.string().regex(PROTOCOLE),
    premiere: instant,
    derniere: instant,
    attenue: z.boolean(),
    risqueAccepte: z.boolean(),
    risqueRequalifie: z.boolean(),
  })
  .strict();
export type ElementDetectionTenable = z.infer<typeof ElementDetectionTenable>;

/** Machine de l'inventaire (`GET /rest/hosts`, accès annoncé expérimental) : complète une machine connue, ou en ajoute une. */
export const ElementHoteTenable = z
  .object({
    type: z.literal('hote'),
    uuid,
    tenableUuid: uuid.nullable(),
    nom: z.string().max(TENABLE_BORNES.nomMachine).regex(NOM_MACHINE).nullable(),
    adresse: z.string().max(45).regex(ADRESSE_IP).nullable(),
    systeme: texteTenable(TENABLE_BORNES.systeme).nullable(),
    premiere: instant,
    derniere: instant,
  })
  .strict();
export type ElementHoteTenable = z.infer<typeof ElementHoteTenable>;

/** Identifiant d'un correctif regroupé de Tenable (`solutionID`, par exemple « SC-33850 ») : forme prudente, seul exemple connu. */
export const IDENTIFIANT_CORRECTIF_TENABLE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const compteTenable = z.number().int().min(0).max(100_000_000).nullable();

/** Lot QF-TEN : correctif regroupé de Tenable (vue `sumremediation` de l'analyse, liste blanche du script) : identifiant,
    texte de la solution (anglais, nettoyé), contrôles corrigés (`pluginID`), nombres de Tenable (machines `hostTotal`, CVE
    `cveTotal`, détections `total`, sur tout ce qu'il analyse) et scores. Jamais `remediationList` ni aucune machine. */
export const ElementCorrectifTenable = z
  .object({
    type: z.literal('correctif'),
    identifiant: z.string().max(TENABLE_BORNES.identifiantCorrectif).regex(IDENTIFIANT_CORRECTIF_TENABLE),
    solution: texteTenable(TENABLE_BORNES.correctif),
    plugins: z
      .array(z.string().regex(PLUGIN_ID))
      .min(1)
      .max(TENABLE_BORNES.controlesParCorrectif)
      .refine((l) => new Set(l).size === l.length, 'Contrôle cité deux fois.'),
    machines: compteTenable,
    cves: compteTenable,
    detections: compteTenable,
    vpr: score10,
    cvss3Score: score10,
    /** Probabilité EPSS entre 0 et 1 (rendue en pourcentage par Tenable, convertie par le script, comme pour un constat). */
    epss: z.number().min(0).max(1).nullable(),
  })
  .strict();
export type ElementCorrectifTenable = z.infer<typeof ElementCorrectifTenable>;

export const ElementSynchronisation = z.union([
  ElementMachineTenable,
  ElementConstatTenable,
  ElementDetectionTenable,
  ElementHoteTenable,
  ElementCorrectifTenable,
]);
export type ElementSynchronisation = z.infer<typeof ElementSynchronisation>;

/** Entrée de `suivi integrations-lot <id>` : un lot borné d'éléments, validés ensuite un à un. */
export const LotSynchronisation = z.object({ elements: z.array(z.unknown()).min(1).max(TENABLE_BORNES.lot) }).strict();
export type LotSynchronisation = z.infer<typeof LotSynchronisation>;

const ErreurUneLigne = z
  .string()
  .min(1)
  .max(300)
  // eslint-disable-next-line no-control-regex
  .regex(/^[^\u0000-\u001f\u007f]+$/, 'Erreur sur une seule ligne, sans caractère de contrôle.');
const compte = (max: number) => z.number().int().min(0).max(max);

/** Bilan d'une synchronisation, compté par le script et l'exécutant (résultat de l'exécution, sans aucune donnée de Tenable
    autre que des nombres). `tronque` : une borne (pages, détections, durée) a été atteinte, la synchronisation est
    incomplète et ne marque aucune détection comme disparue. L'inventaire peut échouer sans faire échouer les failles. */
export const BilanSynchronisation = z
  .object({
    elements: compte(TENABLE_BORNES.lot * TENABLE_BORNES.lots),
    pages: compte(TENABLE_BORNES.pagesAnalyse),
    constats: compte(TENABLE_BORNES.detections),
    detections: compte(TENABLE_BORNES.detections),
    machines: compte(TENABLE_BORNES.detections),
    hotes: compte(TENABLE_BORNES.pageMachines * TENABLE_BORNES.pagesMachines),
    ecartes: compte(10_000_000),
    tronque: z.boolean(),
    inventaire: z
      .object({ ok: z.boolean(), erreur: ErreurUneLigne.nullable() })
      .strict()
      .refine((i) => i.ok === (i.erreur === null), { message: 'Inventaire : une erreur seulement en échec.' }),
  })
  .strict();
export type BilanSynchronisation = z.infer<typeof BilanSynchronisation>;

/* ------------------------------------------------------------------ API : lecture */
/** Source d'une machine et d'un constat : le type de l'instance qui l'a rapporté (lot N1 : Security Center par
    synchronisation, ou Nessus par import de fichier). Un contrôle Nessus reste un contrôle de Tenable. */
export const SOURCES_MACHINE = ['tenable', 'nessus-fichier'] as const;
export type SourceMachine = (typeof SOURCES_MACHINE)[number];
export const SOURCE_MACHINE_LIBELLES: Record<SourceMachine, string> = {
  tenable: 'Tenable Security Center',
  'nessus-fichier': 'Nessus, import de fichier',
};
/** Instance qui a rapporté une machine ou un constat (lot N1 : marque de la source dans les écrans du module). */
export interface OrigineConnecteurDto {
  id: string;
  nom: string;
  type: SourceMachine;
}

export const ROLES_MACHINE = ['front', 'back', 'bdd'] as const;
export const RoleMachine = z.enum(ROLES_MACHINE);
export type RoleMachine = z.infer<typeof RoleMachine>;
export const ROLE_MACHINE_LIBELLES: Record<RoleMachine, string> = {
  front: 'Front',
  back: 'Back applicatif',
  bdd: 'Base de données',
};

export const FAILLES_PAR_PAGE = 25;
const recherche = z.string().trim().max(100).optional();
const page = z.coerce.number().int().min(1).max(1000).default(1);
const oui = z.enum(['oui']).optional();

/** Constats : recherche par identifiant CVE, numéro ou nom du contrôle ; filtres par gravité, exploité (catalogue KEV),
    exploitable (code d'exploitation connu de Tenable), non maintenu (constat sans CVE), priorité calculée (lot V4a), suivi
    (lot V4b : absent, les failles encore à traiter ; un état ; `a_clore` ; `tous`). */
export const RechercheConstats = z
  .object({
    q: recherche,
    gravite: GraviteTenable.optional(),
    exploite: oui,
    exploitable: oui,
    nonMaintenu: oui,
    /** Lot S3 : constats en fin de support selon Tenable (date `seolDate` passée). */
    finSupport: oui,
    priorite: NiveauPriorite.optional(),
    etat: FiltreSuivi.optional(),
    /** Lot S1 : état du délai de correction, et tri par échéance. */
    delai: EtatDelaiFiltre.optional(),
    tri: TriFailles.optional(),
    page,
  })
  .strict();
export type RechercheConstats = z.infer<typeof RechercheConstats>;

/** Machines : recherche par nom ; filtres par rôle (`aucun` : sans rôle) et par périmètre effectif (`aucun` : sans périmètre,
    ni propre ni hérité du dépôt). */
export const RechercheMachines = z
  .object({
    q: recherche,
    role: z.enum([...ROLES_MACHINE, 'aucun']).optional(),
    perimetre: z.union([z.uuid(), z.literal('aucun')]).optional(),
    /** Lot S3 : machines en fin de support (au moins un constat présent dont la fin de support est passée). */
    finSupport: oui,
    /** Lot TEN-SCORES : catégorie minimale de criticité (ACR) et d'exposition (AES) selon Tenable ; une machine sans valeur
        ne répond à aucun filtre actif. */
    acr: FiltreAcr.optional(),
    aes: FiltreAes.optional(),
    /** Lot GRP-MACHINES : machines d'un groupe, ou `aucun` (machines lues qui ne sont dans aucun groupe). */
    groupe: z.union([z.uuid(), z.literal('aucun')]).optional(),
    page,
  })
  .strict();
export type RechercheMachines = z.infer<typeof RechercheMachines>;

export interface PageFailles<T> {
  total: number;
  page: number;
  parPage: number;
  elements: T[];
}

export interface ConstatResumeDto {
  id: string;
  plugin: string;
  nom: string;
  gravite: GraviteTenable;
  famille: string | null;
  cvss3Score: number | null;
  vpr: number | null;
  epss: number | null;
  exploitable: boolean;
  /** Une CVE du constat figure au catalogue KEV rangé par la veille (jointure en lecture). */
  exploite: boolean;
  /** Lot N2 : contrôle marqué « exploité par un logiciel malveillant » par Tenable (import Nessus seulement : Security
      Center ne le rapporte pas) ; exploitation avérée selon Tenable. */
  exploiteMalware: boolean;
  /** Lot PRIO-1 : kits d'exploitation disponibles selon Tenable (« Exploitable with ») ; rangés avec « exploitable ». */
  kitsExploitation: KitExploitation[];
  /** Lot PRIO-1 : présent sur au moins une machine en fin de support, et n'est pas lui-même le contrôle de fin de support :
      un cran de priorité de plus (décisions du RSSI des 19 et 20/11/2026). */
  surMachineFinSupport: boolean;
  /** Constat sans CVE : système ou logiciel qui n'est plus maintenu (V18). */
  nonMaintenu: boolean;
  /** Date de fin de support du logiciel selon Tenable (`seolDate`), ou null. */
  finSupportLe: string | null;
  /** Lot S3 : fin de support atteinte (date passée) : plus de correctif de sécurité de l'éditeur. */
  finDeSupport: boolean;
  /** Lot S3 : état du correctif (Tenable `patchPubDate`, mention du CERT Santé) et sources qui le disent. */
  correctifEtat: EtatCorrectifDto;
  /** Nombre de CVE du constat, et les premières (cinq au plus). */
  nombreCves: number;
  cves: string[];
  /** Machines où le constat est présent, parmi celles que la personne peut lire ; pour un constat qui n'est plus rapporté,
      celles où il a été vu en dernier (lot V4b). */
  machines: number;
  derniereDetection: string | null;
  /** Le constat est rapporté par la dernière synchronisation complète (ou plus récente) sur au moins une machine. */
  present: boolean;
  /** État de suivi décidé par une personne, proposition « corrigée » et actions liées (lot V4b). */
  suivi: SuiviResumeDto;
  /** Une CVE du constat est citée par une alerte du CERT-FR rangée par la veille (lot V4a). */
  alerteCertFr: boolean;
  /** Ce que chaque source dit des CVE du constat et de Tenable lui-même (V26, V27) : sources de l'exploitation avérée et
      de « exploitable » avec leur date, valeurs par source, mentions du CERT Santé. */
  sources: SourcesFailleDto;
  /** Priorité calculée par la plateforme et faits qui la fondent (lot V4a). */
  priorite: Priorite;
  /** Délai de correction (lot S1) : âge, échéance calculée, état. */
  delai: DelaiFailleDto;
  /** Lot N1 : instance qui a rapporté le constat (Security Center ou import Nessus). */
  integration: OrigineConnecteurDto;
}

export interface MachineDetectionDto {
  machineId: string;
  nom: string | null;
  adresse: string | null;
  role: RoleMachine | null;
  perimetreId: string | null;
  perimetreNom: string | null;
  port: number;
  protocole: string;
  premiere: string | null;
  derniere: string | null;
  attenue: boolean;
  risqueAccepte: boolean;
  risqueRequalifie: boolean;
}

export interface ConstatDto extends ConstatResumeDto {
  synopsis: string | null;
  correctif: string | null;
  cvss3Vecteur: string | null;
  exploitLibelle: string | null;
  failleLe: string | null;
  correctifLe: string | null;
  voirAussi: string | null;
  cvesTronquees: boolean;
  /** Toutes les CVE, avec leur présence au catalogue KEV. */
  cvesDetail: { cve: string; kev: boolean }[];
  /** Machines lisibles où le constat est présent, regroupées par rôle (`aucun` : rôle non renseigné). */
  parRole: Record<RoleMachine | 'aucun', MachineDetectionDto[]>;
}

export interface CompteursMachine {
  critique: number;
  elevee: number;
  moyenne: number;
  faible: number;
  exploites: number;
  exploitables: number;
  /** Failles déclarées (CVE rattachées à un produit relié à la machine), comptées une fois et seulement si Tenable ne les
      détecte pas sur cette machine ; déjà incluses dans les compteurs par gravité (lot V4a). */
  declarees: number;
  /** Failles présentes, détectées ou déclarées, dont l'exploitation est avérée (catalogue KEV, alerte du CERT-FR ou fiche du
      CERT Santé). */
  exploitationAveree: number;
}

/** Origine du périmètre effectif d'une machine (lot V4d) : indiqué à la main sur la machine (prime), ou hérité de son dépôt
    Tenable relié ; `null` : sans périmètre. */
export const ORIGINES_PERIMETRE_MACHINE = ['machine', 'depot'] as const;
export type OriginePerimetreMachine = (typeof ORIGINES_PERIMETRE_MACHINE)[number];

export interface MachineDto {
  id: string;
  nom: string | null;
  adresse: string | null;
  systeme: string | null;
  role: RoleMachine | null;
  /** Périmètre effectif : celui de la machine, sinon celui de son dépôt relié (lot V4d). */
  perimetreId: string | null;
  perimetreNom: string | null;
  perimetreOrigine: OriginePerimetreMachine | null;
  /** Dépôt de Tenable où la machine a été vue (lot V4d), et le périmètre auquel il est relié. */
  depot: { id: string; nom: string; perimetreId: string | null; perimetreNom: string | null } | null;
  exposition: string | null;
  /** Lot TEN-SCORES : criticité (ACR, 0 à 10) et exposition (AES, 0 à 1000) de l'actif selon Tenable Security Center ; null :
      non fournie (import Nessus, valeur absente). Affichées seulement : ni la priorité, ni le rang, ni les alertes n'en
      dépendent. */
  acr: number | null;
  aes: number | null;
  premiere: string | null;
  derniere: string | null;
  /** Lot N1 : source de la machine (type de son instance) et instance. Une machine vue par Security Center et par un import
      Nessus apparaît deux fois, une par instance (pas de fusion). */
  source: SourceMachine;
  integration: OrigineConnecteurDto;
  /** Constats présents sur la machine, par gravité, puis exploités et exploitables. */
  compteurs: CompteursMachine;
  /** Rang parmi les machines que la personne peut lire, et faits qui le fondent (lot V4a). */
  rang: RangMachineDto;
  /** Lot S3 : la machine porte un constat présent de Tenable dont la fin de support est passée (`seolDate`), quel que soit
      son état de suivi : le système ou un logiciel ne reçoit plus de correctif de sécurité de l'éditeur. */
  finDeSupport: boolean;
  /** Contrôles de Tenable en fin de support présents sur la machine (cinq au plus), avec leur date. */
  finsDeSupport: { nom: string; le: string }[];
  version: number;
}

/** Machines de la page, avec leurs marques (priorité la plus haute, zero-day, exploitable ; lot PC2). */
export interface PageMachines extends PageFailles<MachineMarqueeDto> {
  /** Machines lisibles sans rôle (bandeau), tous filtres confondus. */
  sansRole: number;
}

/* ------------------------------------------------------------------ API : écriture */
/** Rôle et périmètre d'une machine : absent, inchangé. Rôle `null` : retiré. Périmètre `null` : plus de périmètre indiqué à
    la main, la machine reprend celui de son dépôt relié, s'il y en a un (lot V4d). La version attendue passe par If-Match. */
export const AffectationMachine = z
  .object({ role: RoleMachine.nullable(), perimetreId: z.uuid().nullable() })
  .partial()
  .strict()
  .refine((p) => Object.keys(p).length > 0, 'Aucune modification.');
export type AffectationMachine = z.infer<typeof AffectationMachine>;

/** Affectation en masse : chaque machine avec sa version attendue (équivalent de If-Match, élément par élément) ; tout ou
    rien. */
export const AFFECTATION_MAX = 200;
export const AffectationMachines = z
  .object({
    machines: z
      .array(z.object({ id: z.uuid(), version: z.number().int().min(1) }).strict())
      .min(1)
      .max(AFFECTATION_MAX)
      .refine((m) => new Set(m.map((x) => x.id)).size === m.length, 'Machine en double.'),
    role: RoleMachine.nullable().optional(),
    perimetreId: z.uuid().nullable().optional(),
  })
  .strict()
  .refine((p) => p.role !== undefined || p.perimetreId !== undefined, 'Aucune modification.');
export type AffectationMachines = z.infer<typeof AffectationMachines>;

export interface PerimetreAffectableDto {
  id: string;
  nom: string;
}

/* ------------------------------------------------------------------ Dépôts de Tenable (lot V4d) */
/** Dépôt de Tenable et sa liaison à un périmètre de la plateforme (administration du module). Ses machines sans périmètre
    indiqué à la main prennent ce périmètre. */
export interface DepotTenableDto {
  id: string;
  /** Identifiant du dépôt dans Tenable. */
  depotTenable: number;
  nom: string;
  perimetreId: string | null;
  perimetreNom: string | null;
  /** Vu par la dernière synchronisation complète, ou plus récemment. */
  present: boolean;
  /** Machines rangées dans ce dépôt, et celles dont le périmètre est indiqué à la main (exceptions). */
  machines: number;
  exceptions: number;
  version: number;
  majPar: string | null;
  majLe: string;
  integration: { id: string; nom: string };
}

/** Relier un dépôt à un périmètre (`null` : délier). La version attendue passe par If-Match. */
export const LiaisonDepotTenable = z.object({ perimetreId: z.uuid().nullable() }).strict();
export type LiaisonDepotTenable = z.infer<typeof LiaisonDepotTenable>;

/* ------------------------------------------------------------------ API : état */
export interface EtatSynchronisationDto {
  integrationId: string;
  nom: string;
  actif: boolean;
  gravites: GraviteTenable[];
  /** Dernière synchronisation (demandée, en cours ou terminée). */
  derniere: {
    id: string;
    etat: 'en_file' | 'en_cours' | 'recu' | 'echec' | 'expire';
    origine: 'manuel' | 'planifie';
    demandeLe: string;
    termineLe: string | null;
    bilan: BilanSynchronisation | null;
    erreur: string | null;
  } | null;
  /** Dernière synchronisation complète (sans borne atteinte) : seule celle-ci fait foi pour les détections disparues. */
  derniereCompleteLe: string | null;
  inventaire: { ok: boolean; erreur: string | null; le: string } | null;
  /** Lot F1 : fréquence de la synchronisation automatique (heures) et prochaine prévue (null si l'instance n'est pas prête :
      inactive, clé manquante ou flux fermé). Lecture seule : le réglage vit dans la carte « Intégrations ». */
  frequenceHeures: number;
  prochaineSynchronisation: string | null;
}
