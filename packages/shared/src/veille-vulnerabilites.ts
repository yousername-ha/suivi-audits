/* Module Vulnérabilités (ADR 0100, lots V2 et V3) : veille sur cinq sources publiques, liste fermée écrite dans le code et
   jamais réglable dans l'interface. L'API ne joint aucune source (ADR 0014) : l'exécutant d'exploitation lance un script
   isolé (scripts/veille-vulnerabilites.py), dont la liste recopiée des hôtes et des chemins est comparée à celle-ci par
   apps/api/test/veille-architecture.test.ts. Les avis sont des données, pas des consignes (ADR 0100, point 5) : seuls des
   champs structurés sont retenus, les identifiants sont contrôlés par expression régulière, le texte libre est nettoyé et
   borné, une adresse n'est gardée qu'en https sur l'hôte de sa source. */
import { z } from 'zod';
import type { FluxEtatApplique } from './flux-externes.js';

/* ------------------------------------------------------------------ Sources (liste fermée) */
/** Identifiants stables (base, journal d'audit, CLI de l'exécutant) : ne jamais renommer. */
export const SOURCES_VEILLE = ['cisa-kev', 'nvd', 'epss', 'cert-fr', 'cert-sante'] as const;
export const SourceVeille = z.enum(SOURCES_VEILLE);
export type SourceVeille = z.infer<typeof SourceVeille>;

export interface SourceVeilleDefinition {
  id: SourceVeille;
  libelle: string;
  organisme: string;
  /** Hôte joint (TCP 443), seul admis pour cette source. */
  hote: string;
  /** Chemins admis, exacts ; `{reference}` est la seule partie variable (identifiant CERT-FR contrôlé). */
  chemins: readonly string[];
  format: string;
  /** Langue des textes repris tels quels. */
  langue: 'fr' | 'en';
  /** Ce qui est demandé à la source : jamais un produit ni un élément du parc (ADR 0100, point 3). */
  demande: string;
}

export const SOURCES_VEILLE_DEFINITIONS: readonly SourceVeilleDefinition[] = [
  {
    id: 'cisa-kev',
    libelle: 'Catalogue des failles exploitées (KEV)',
    organisme: 'CISA (États-Unis)',
    hote: 'www.cisa.gov',
    chemins: ['/sites/default/files/feeds/known_exploited_vulnerabilities.json'],
    format: 'Fichier JSON unique',
    langue: 'en',
    demande: 'Le catalogue entier, en une lecture.',
  },
  {
    id: 'nvd',
    libelle: 'Base nationale des vulnérabilités (NVD)',
    organisme: 'NIST (États-Unis)',
    hote: 'services.nvd.nist.gov',
    chemins: ['/rest/json/cves/2.0'],
    format: 'API JSON (CVE 2.0), paginée',
    langue: 'en',
    demande: 'Les failles modifiées pendant une fenêtre de dates, jamais par produit ni par mot-clé.',
  },
  {
    id: 'epss',
    libelle: 'Probabilité d’exploitation (EPSS)',
    organisme: 'FIRST',
    hote: 'api.first.org',
    chemins: ['/data/v1/epss'],
    format: 'API JSON',
    langue: 'en',
    demande: 'Le score des failles déjà connues de la veille (KEV, avis, fenêtre NVD), jamais une liste tirée du parc.',
  },
  {
    id: 'cert-fr',
    libelle: 'Alertes et avis du CERT-FR',
    organisme: 'ANSSI (CERT-FR)',
    hote: 'cert.cyber.gouv.fr',
    chemins: ['/alerte/feed/', '/avis/feed/', '/alerte/{reference}/json/', '/avis/{reference}/json/'],
    format: 'Flux RSS, puis export JSON documenté de chaque avis (identifiants CVE)',
    langue: 'fr',
    demande: 'Les deux flux RSS, puis l’export JSON des alertes et des avis nouveaux qu’ils citent.',
  },
  {
    id: 'cert-sante',
    libelle: 'Alertes et vulnérabilités du CERT Santé',
    organisme: 'ANS (CERT Santé)',
    hote: 'cyberveille.esante.gouv.fr',
    chemins: ['/alertes-et-vulnerabilites/rss.xml'],
    format: 'Flux RSS',
    langue: 'fr',
    demande: 'Le flux RSS, en une lecture.',
  },
];

export const sourceVeille = (id: SourceVeille): SourceVeilleDefinition =>
  SOURCES_VEILLE_DEFINITIONS.find((s) => s.id === id)!;

/* ------------------------------------------------------------------ Formes contrôlées */
/** Identifiant CVE (« CVE-AAAA-NNNN », quatre chiffres ou plus). */
export const CVE_ID = /^CVE-[12]\d{3}-\d{4,9}$/;
/** Identifiant d'une alerte ou d'un avis du CERT-FR (forme publiée par son API, depuis 2010). */
export const CERTFR_ID = /^CERTFR-20\d{2}-(?:ALE|AVI)-\d{2,4}$/;
/** Identifiant d'une alerte du CERT Santé : numéro de l'élément du flux (guid). */
export const CERTSANTE_ID = /^[1-9]\d{0,9}$/;
/** Adresse d'un avis : https, sur l'hôte de sa source, chemin d'avis seulement. Celle du CERT-FR est recomposée à partir de
    l'identifiant contrôlé, sur l'hôte joint. */
export const ADRESSE_CERTFR =
  /^https:\/\/cert\.cyber\.gouv\.fr\/(?:alerte|avis)\/CERTFR-20\d{2}-(?:ALE|AVI)-\d{2,4}\/$/;
export const ADRESSE_CERTSANTE = /^https:\/\/cyberveille\.esante\.gouv\.fr\/alertes\/[a-z0-9-]{1,200}$/;
/** Vecteurs CVSS publiés par NVD. */
export const CVSS31_VECTEUR = /^CVSS:3\.1(?:\/[A-Z]{1,3}:[A-Z]{1,2}){8,20}$/;
export const CVSS40_VECTEUR = /^CVSS:4\.0(?:\/[A-Za-z]{1,3}:[A-Za-z]{1,10}){11,40}$/;
/** Nom d'éditeur ou de produit tiré d'un CPE 2.3 (échappements retirés) : caractères imprimables, sans balise. */
export const NOM_CPE = /^[\x21-\x3b\x3d\x3f-\x7e]{1,100}$/;

/** Bornes de taille, reprises par la migration 074 et par le script de l'exécutant. */
export const VEILLE_BORNES = {
  titre: 300,
  resume: 1000,
  description: 1000,
  action: 1000,
  nomFaille: 300,
  editeur: 200,
  produit: 200,
  nomsCpe: 20,
  cvesParAvis: 200,
  /** Éléments par lot rapporté par l'exécutant, et lots par collecte. */
  lot: 500,
  lots: 40,
  /** Failles dont le score EPSS est demandé en une collecte. */
  epss: 2000,
} as const;

/** Texte venu d'une source : sur une ligne, sans caractère de contrôle ni de mise en forme invisible, sans balise. Le script
    de l'exécutant le nettoie ; l'API refuse ce qui ne l'aurait pas été. */
export const texteExterneValide = (s: string) =>
  !/[\p{Cc}\p{Cf}\p{Co}\p{Cs}]/u.test(s) && !/<[A-Za-z/!?]/.test(s) && s === s.trim();
const texteExterne = (max: number) =>
  z.string().max(max).refine(texteExterneValide, 'Texte externe non nettoyé : refusé.');
const cve = z.string().regex(CVE_ID, 'Identifiant CVE attendu.');

/* ------------------------------------------------------------------ Éléments rapportés par l'exécutant */
export const ElementKev = z
  .object({
    cve,
    editeur: texteExterne(VEILLE_BORNES.editeur),
    produit: texteExterne(VEILLE_BORNES.produit),
    nom: texteExterne(VEILLE_BORNES.nomFaille),
    description: texteExterne(VEILLE_BORNES.description),
    action: texteExterne(VEILLE_BORNES.action),
    ajoutLe: z.iso.date(),
    echeance: z.iso.date().nullable(),
    /** « Known » de la source : utilisée dans une campagne de rançongiciel ; « Unknown » : false ; autre valeur : null. */
    rancongiciel: z.boolean().nullable(),
  })
  .strict();
export type ElementKev = z.infer<typeof ElementKev>;

export const GRAVITES_CVSS = ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
export type GraviteCvss = (typeof GRAVITES_CVSS)[number];
const Cvss = (vecteur: RegExp) =>
  z
    .object({
      score: z.number().min(0).max(10),
      vecteur: z.string().max(400).regex(vecteur, 'Vecteur CVSS inattendu.'),
      gravite: z.enum(GRAVITES_CVSS),
    })
    .strict();

export const ElementNvd = z
  .object({
    cve,
    publieLe: z.iso.datetime(),
    modifieLe: z.iso.datetime(),
    /** Description anglaise, reprise telle quelle (bornée). */
    description: texteExterne(VEILLE_BORNES.description),
    cvss31: Cvss(CVSS31_VECTEUR).nullable(),
    cvss40: Cvss(CVSS40_VECTEUR).nullable(),
    /** Éditeurs et produits des CPE vulnérables, sans doublon, bornés. */
    editeurs: z.array(z.string().regex(NOM_CPE)).max(VEILLE_BORNES.nomsCpe),
    produits: z.array(z.string().regex(NOM_CPE)).max(VEILLE_BORNES.nomsCpe),
  })
  .strict();
export type ElementNvd = z.infer<typeof ElementNvd>;

export const ElementEpss = z
  .object({
    cve,
    /** Probabilité publiée par la source, entre 0 et 1. */
    score: z.number().min(0).max(1),
    centile: z.number().min(0).max(1),
    date: z.iso.date(),
  })
  .strict();
export type ElementEpss = z.infer<typeof ElementEpss>;

export const NATURES_AVIS = ['alerte', 'avis'] as const;
export type NatureAvis = (typeof NATURES_AVIS)[number];
const ElementAvisBase = z
  .object({
    identifiant: z.string().max(40),
    nature: z.enum(NATURES_AVIS),
    titre: texteExterne(VEILLE_BORNES.titre).refine((s) => s.length > 0, 'Titre vide.'),
    resume: texteExterne(VEILLE_BORNES.resume),
    adresse: z.string().max(300).nullable(),
    publieLe: z.iso.datetime().nullable(),
    cves: z.array(cve).max(VEILLE_BORNES.cvesParAvis),
    /** Les identifiants CVE ont-ils été lus (export JSON du CERT-FR) ? Sinon, ceux déjà connus sont gardés. */
    cvesLues: z.boolean(),
  })
  .strict();
export const ElementCertFr = ElementAvisBase.refine((a) => CERTFR_ID.test(a.identifiant), {
  message: 'Identifiant CERT-FR attendu.',
})
  .refine((a) => (a.nature === 'alerte') === a.identifiant.includes('-ALE-'), { message: 'Nature incohérente.' })
  .refine((a) => a.adresse === null || ADRESSE_CERTFR.test(a.adresse), { message: 'Adresse refusée.' });
export const ElementCertSante = ElementAvisBase.refine((a) => CERTSANTE_ID.test(a.identifiant), {
  message: 'Identifiant CERT Santé attendu.',
})
  .refine((a) => a.nature === 'alerte', { message: 'Nature incohérente.' })
  .refine((a) => a.adresse === null || ADRESSE_CERTSANTE.test(a.adresse), { message: 'Adresse refusée.' });
export type ElementAvis = z.infer<typeof ElementAvisBase>;

/** Schéma d'un élément selon la source de la collecte. */
export const ELEMENT_VEILLE: Record<SourceVeille, z.ZodType> = {
  'cisa-kev': ElementKev,
  nvd: ElementNvd,
  epss: ElementEpss,
  'cert-fr': ElementCertFr,
  'cert-sante': ElementCertSante,
};

/** Entrée de `suivi veille-lot <id>` : un lot borné d'éléments, validés ensuite un à un selon la source de la collecte. */
export const LotVeille = z.object({ elements: z.array(z.unknown()).min(1).max(VEILLE_BORNES.lot) }).strict();
export type LotVeille = z.infer<typeof LotVeille>;

export const VEILLE_ERREUR_MAX = 300;
const ErreurCourte = z
  .string()
  .min(1)
  .max(VEILLE_ERREUR_MAX)
  // eslint-disable-next-line no-control-regex
  .regex(/^[^\u0000-\u001f\u007f]+$/, 'Erreur sur une seule ligne, sans caractère de contrôle.');

/** Bilan d'une collecte, compté par le script (rien d'autre ne revient de la source). */
export const BilanCollecte = z
  .object({
    elements: z
      .number()
      .int()
      .min(0)
      .max(VEILLE_BORNES.lot * VEILLE_BORNES.lots),
    /** Éléments écartés par le script (identifiant mal formé, champ manquant…). */
    ecartes: z.number().int().min(0).max(1_000_000),
    /** La source annonçait plus d'éléments que la borne : la collecte est incomplète. */
    tronque: z.boolean(),
    /** CERT-FR : exports JSON d'avis qui n'ont pas pu être lus (identifiants CVE repris au passage suivant). */
    detailsEchoues: z.number().int().min(0).max(1000),
  })
  .strict();
export type BilanCollecte = z.infer<typeof BilanCollecte>;

/** Entrée de `suivi veille-finish <id>` : succès avec son bilan, ou échec avec une erreur sur une ligne. */
export const RapportCollecte = z
  .object({ ok: z.boolean(), bilan: BilanCollecte.nullable(), erreur: ErreurCourte.nullable() })
  .strict()
  .refine((r) => (r.ok ? r.bilan !== null && r.erreur === null : r.bilan === null && r.erreur !== null), {
    message: 'Un succès porte un bilan sans erreur ; un échec, une erreur sans bilan.',
  });
export type RapportCollecte = z.infer<typeof RapportCollecte>;

/* ------------------------------------------------------------------ API */
export const ETATS_COLLECTE = ['en_file', 'en_cours', 'recu', 'echec', 'expire'] as const;
export type EtatCollecte = (typeof ETATS_COLLECTE)[number];

/** Source sans collecte réussie depuis ce délai, alors que la veille est active : signalée en retard. */
export const VEILLE_RETARD_HEURES = 36;

export interface CollecteVeilleDto {
  id: string;
  source: SourceVeille;
  origine: 'manuel' | 'planifie';
  etat: EtatCollecte;
  demandePar: string;
  demandeLe: string;
  termineLe: string | null;
  elements: number;
  tronque: boolean;
  erreur: string | null;
}

export interface EtatSourceVeilleDto {
  source: SourceVeille;
  libelle: string;
  organisme: string;
  hote: string;
  format: string;
  langue: 'fr' | 'en';
  demande: string;
  derniereReussite: string | null;
  dernierEssai: string | null;
  /** Erreur de la dernière collecte, sur une ligne ; null si elle a réussi. */
  erreur: string | null;
  enRetard: boolean;
  derniereCollecte: CollecteVeilleDto | null;
}

export interface EtatVeilleDto {
  flux: { ouvert: boolean; applique: FluxEtatApplique | null };
  executant: { disponible: boolean };
  sources: EtatSourceVeilleDto[];
}

/** « Collecter maintenant » : une source, ou toutes. */
export const DemandeCollecte = z.object({ source: SourceVeille.optional() }).strict();
export type DemandeCollecte = z.infer<typeof DemandeCollecte>;

export const VEILLE_PAR_PAGE = 25;
const recherche = z.string().trim().max(100).optional();
const page = z.coerce.number().int().min(1).max(400).default(1);

/** Recherche dans les avis : identifiant CVE cité, identifiant de l'avis ou texte du titre. */
export const RechercheAvis = z
  .object({ q: recherche, source: z.enum(['cert-fr', 'cert-sante']).optional(), page })
  .strict();
export type RechercheAvis = z.infer<typeof RechercheAvis>;

/** Recherche dans les failles connues : identifiant CVE, éditeur, produit, ou nom de la faille (KEV). `kev` : seulement
    celles du catalogue des failles exploitées, les plus récemment ajoutées d'abord. */
export const RechercheFailles = z.object({ q: recherche, kev: z.enum(['oui']).optional(), page }).strict();
export type RechercheFailles = z.infer<typeof RechercheFailles>;

export interface PageVeille<T> {
  total: number;
  page: number;
  parPage: number;
  elements: T[];
}

export interface AvisVeilleDto {
  id: string;
  source: 'cert-fr' | 'cert-sante';
  identifiant: string;
  nature: NatureAvis;
  titre: string;
  resume: string;
  adresse: string | null;
  publieLe: string | null;
  cves: string[];
  vuLe: string;
}

export interface FailleVeilleDto {
  cve: string;
  description: string | null;
  publieLe: string | null;
  modifieLe: string | null;
  cvss31: { score: number; vecteur: string; gravite: GraviteCvss } | null;
  cvss40: { score: number; vecteur: string; gravite: GraviteCvss } | null;
  editeurs: string[];
  produits: string[];
  epss: { score: number; centile: number; date: string } | null;
  kev: {
    editeur: string;
    produit: string;
    nom: string;
    description: string;
    action: string;
    ajoutLe: string;
    echeance: string | null;
    rancongiciel: boolean | null;
  } | null;
}
