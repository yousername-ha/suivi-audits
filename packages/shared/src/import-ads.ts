/* Module Vulnérabilités (ADR 0100, lot AD-1 ; décisions du RSSI du 20/11/2026) : import du rapport d'analyse de l'Active
   Directory produit par le service ADS de l'ANSSI à partir d'une collecte ORADAD. Le rapport (JSON) est lu dans le
   navigateur (apps/web/src/vulnerabilites/ads.ts, fonction lireRapportAds) ; seul un extrait en liste blanche part vers l'API,
   en une requête, et l'API le revalide ici champ par champ (un champ en trop ou une forme inattendue fait refuser tout
   l'import). Un import est l'état du rapport à sa date : note globale (1 à 5), progression par niveau, points de contrôle
   NON conformes (les conformes ne paraissent que dans un total), et pour chacun le nombre d'objets de l'annuaire concernés
   et, bornés, leur nom affichable et leur nature.
   Protections décidées par le RSSI :
   1. les noms font partie du droit « Analyste », branché sur l'accès au module (`vulnerabilites:lire`) en attendant le
      lot 3 de l'ADR 0092 : pas de droit à part. Ils ne se lisent que par une route à part, point par point ; la lecture
      ordinaire de la page ne rend que des nombres ;
   2. les noms ne sortent jamais de la plateforme : ni assistant, ni courriel, ni notification, ni rapport, ni journal
      d'audit, ni journal applicatif ; ces canaux ne reçoivent que des nombres ;
   3. chaque consultation des noms est tracée au journal d'audit (qui, quand, quel point de contrôle), sans les noms ;
   4. seuls les noms des deux derniers imports sont gardés (ADS_BORNES.importsAvecNoms) : les imports plus anciens ne
      gardent que les nombres (purge à chaque import) ;
   5. jamais gardés : mots de passe, empreintes, attributs détaillés des comptes, SID, chemins LDAP complets (réduits au
      nom court) ; nom borné à ADS_BORNES.nom caractères et ADS_BORNES.nomsParPoint noms par point, le surplus compté ;
   6. un import se supprime (noms et nombres).
   Forme du rapport connue par sa seule structure : AUCUN rapport réel n'a été lu. Le type d'un point est gardé en numéro
   (1 information, 2 avertissement, 3 vulnérabilité) avec son libellé. */
import { z } from 'zod';
import { NESSUS_BORNES } from './import-nessus.js';
import { texteExterneValide } from './veille-vulnerabilites.js';

/** Bornes de l'import, reprises par le navigateur (lecture) et par l'API (revalidation). */
export const ADS_BORNES = {
  /** Taille maximale du fichier lu dans le navigateur, en mégaoctets (Mo de 1 000 000 octets). */
  fichierMo: 50,
  /** Points de contrôle non conformes par import (la liste publique de l'ANSSI en compte quelques centaines au plus). */
  points: 300,
  /** Noms gardés par point : au-delà, les objets sont seulement comptés (« et N autres, non conservés »). */
  nomsParPoint: 200,
  /** Nom affichable d'un objet (un nom de compte Windows tient en 20 caractères, un nom de groupe en 64). */
  nom: 64,
  titre: 200,
  reference: 64,
  identifiant: 96,
  /** Nombre d'objets annoncé pour un point. */
  objetsMax: 10_000_000,
  /** Corps de la requête d'import admis par l'API (300 × 200 noms de 64 caractères tiennent sous 7 Mio). */
  corps: 8 * 1024 * 1024,
  /** Imports dont les noms sont gardés (décision 4 du RSSI) : le dernier et celui d'avant, pour « corrigés » et « apparus ». */
  importsAvecNoms: 2,
  /** Imports rendus dans l'historique de la note. */
  historique: 24,
  /** Même limite que les imports Nessus et Silène : fichiers commencés par heure et par personne, tous imports confondus. */
  importsParHeure: NESSUS_BORNES.importsParHeure,
} as const;

/* ------------------------------------------------------------------ Type, niveau, nature */
export const TYPES_POINT_ADS = [1, 2, 3] as const;
export type TypePointAds = (typeof TYPES_POINT_ADS)[number];
export const TYPE_POINT_ADS_LIBELLES: Record<TypePointAds, string> = {
  1: 'information',
  2: 'avertissement',
  3: 'vulnérabilité',
};
/** Préfixe de l'identifiant public supposé d'un point (« vuln1_… ») : HYPOTHÈSE, non vérifiée sur un rapport réel. */
export const PREFIXE_TYPE_ADS: Record<TypePointAds, 'info' | 'warn' | 'vuln'> = { 1: 'info', 2: 'warn', 3: 'vuln' };
/** « 3 · vulnérabilité » : le numéro reste visible (décision du RSSI). */
export const libelleTypeAds = (t: TypePointAds) => `${t} · ${TYPE_POINT_ADS_LIBELLES[t]}`;

export const NIVEAUX_ADS = [1, 2, 3, 4, 5] as const;
export type NiveauAds = (typeof NIVEAUX_ADS)[number];

/** Nature d'un objet de l'annuaire : seule information gardée avec son nom. */
export const NATURES_OBJET_ADS = [
  'utilisateur',
  'service',
  'groupe',
  'ordinateur',
  'controleur',
  'gpo',
  'approbation',
  'autre',
] as const;
export type NatureObjetAds = (typeof NATURES_OBJET_ADS)[number];
export const NATURE_OBJET_ADS_LIBELLES: Record<NatureObjetAds, string> = {
  utilisateur: 'compte d’utilisateur',
  service: 'compte de service',
  groupe: 'groupe',
  ordinateur: 'ordinateur',
  controleur: 'contrôleur de domaine',
  gpo: 'stratégie de groupe (GPO)',
  approbation: 'relation d’approbation',
  autre: 'autre objet',
};

/* ------------------------------------------------------------------ Formes contrôlées */
/** Identifiant d'un point (son identité d'un import à l'autre) : forme prudente. */
export const IDENTIFIANT_POINT_ADS = /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,95}$/;
/** Identifiant public supposé : « vuln1_reference », « warn3_reference », « info2_reference ». HYPOTHÈSE. */
export const IDENTIFIANT_PUBLIC_ADS = /^(vuln|warn|info)([1-5])_(.+)$/;
export const DATE_ADS = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
/** SID Windows (jamais gardé, même comme nom). */
export const SID_ADS = /^S-1-\d+(?:-\d+)+$/i;
/** Chemin LDAP (nom distinctif) : jamais gardé, réduit à son premier élément par le navigateur. */
export const CHEMIN_LDAP_ADS = /(?:^|,)\s*(?:CN|OU|DC|O)\s*=/i;

/** Nom affichable admis : texte simple sur une ligne, borné, ni SID, ni chemin LDAP, ni « domaine\nom ». */
export function nomObjetAdsValide(v: string): boolean {
  return (
    v.length >= 1 &&
    v.length <= ADS_BORNES.nom &&
    texteExterneValide(v) &&
    !SID_ADS.test(v) &&
    !CHEMIN_LDAP_ADS.test(v) &&
    !v.includes('\\')
  );
}

const texte = (max: number) =>
  z.string().min(1).max(max).refine(texteExterneValide, 'Texte externe non nettoyé : refusé.');
const compte = (max: number) => z.number().int().min(0).max(max);
const COMPTE_MAX = 10_000_000;

export const NomObjetAds = z
  .object({
    nom: z.string().refine(nomObjetAdsValide, 'Nom d’objet attendu (nom court, sans SID ni chemin LDAP).'),
    nature: z.enum(NATURES_OBJET_ADS),
  })
  .strict();
export type NomObjetAds = z.infer<typeof NomObjetAds>;

/** Point de contrôle non conforme : identité, type, niveau, référence, titre, nombre d'objets et noms (bornés). */
export const PointAds = z
  .object({
    identifiant: z.string().regex(IDENTIFIANT_POINT_ADS, 'Identifiant de point attendu.'),
    reference: texte(ADS_BORNES.reference),
    type: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    niveau: z.number().int().min(1).max(5),
    titre: texte(ADS_BORNES.titre),
    /** Objets concernés selon le rapport : au moins les noms envoyés, le surplus étant seulement compté. */
    objets: compte(ADS_BORNES.objetsMax),
    noms: z.array(NomObjetAds).max(ADS_BORNES.nomsParPoint),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.noms.length > p.objets) ctx.addIssue({ code: 'custom', message: 'Plus de noms que d’objets annoncés.' });
    if (new Set(p.noms.map((n) => `${n.nature}\u0000${n.nom}`)).size !== p.noms.length)
      ctx.addIssue({ code: 'custom', message: 'Nom en double dans un point.' });
  });
export type PointAds = z.infer<typeof PointAds>;

/** Progression d'un niveau : points conformes et total du niveau, ou pourcentage seul (une décimale). */
export const ProgressionNiveauAds = z
  .object({
    niveau: z.number().int().min(1).max(5),
    conformes: compte(COMPTE_MAX).nullable(),
    total: compte(COMPTE_MAX).nullable(),
    pourcentage: z
      .number()
      .min(0)
      .max(100)
      .refine((v) => Math.round(v * 10) / 10 === v, 'Une décimale au plus.')
      .nullable(),
  })
  .strict()
  .refine((n) => n.conformes === null || n.total === null || n.conformes <= n.total, {
    message: 'Plus de points conformes que de points.',
  });
export type ProgressionNiveauAds = z.infer<typeof ProgressionNiveauAds>;

/** Synthèse du rapport : date (sans heure), note globale, progression par niveau, total des points conformes. */
export const RapportAds = z
  .object({
    date: z.string().regex(DATE_ADS).nullable(),
    note: z.number().int().min(1).max(5),
    progression: z.array(ProgressionNiveauAds).max(5),
    conformes: compte(COMPTE_MAX).nullable(),
  })
  .strict()
  .refine((r) => new Set(r.progression.map((n) => n.niveau)).size === r.progression.length, {
    message: 'Niveau en double dans la progression.',
  });
export type RapportAds = z.infer<typeof RapportAds>;

/** Éléments écartés ou raccourcis par le navigateur, comptés (jamais tronqués en silence) : nombres seulement. */
export const ECARTS_ADS = [
  'nomsAuDela',
  'nomsIllisibles',
  'identifiantsSeuls',
  'nomsRaccourcis',
  'nomsEnDouble',
  'titresRaccourcis',
] as const;
export type EcartAds = (typeof ECARTS_ADS)[number];
export const ECART_ADS_LIBELLES: Record<EcartAds, string> = {
  nomsAuDela: `objets au-delà de ${ADS_BORNES.nomsParPoint} noms par point (comptés, noms non conservés)`,
  nomsIllisibles: 'objets sans nom lisible (comptés, noms non conservés)',
  identifiantsSeuls: 'objets désignés par leur seul SID (comptés, SID jamais conservé)',
  nomsRaccourcis: `noms raccourcis à ${ADS_BORNES.nom} caractères (marqués « … »)`,
  nomsEnDouble: 'noms en double dans un même point (gardés une fois)',
  titresRaccourcis: `titres raccourcis à ${ADS_BORNES.titre} caractères (marqués « … »)`,
};
export const EcartsImportAds = z
  .object(Object.fromEntries(ECARTS_ADS.map((e) => [e, compte(COMPTE_MAX)])) as Record<EcartAds, z.ZodNumber>)
  .strict();
export type EcartsImportAds = z.infer<typeof EcartsImportAds>;
export const ecartsAdsVides = (): EcartsImportAds =>
  Object.fromEntries(ECARTS_ADS.map((e) => [e, 0])) as EcartsImportAds;

/** Corps de l'import (une requête) : synthèse, points non conformes, éléments écartés. Ni nom de fichier, ni domaine. */
export const ImportAds = z
  .object({
    rapport: RapportAds,
    points: z.array(PointAds).max(ADS_BORNES.points),
    ecartes: EcartsImportAds,
  })
  .strict()
  .refine((b) => new Set(b.points.map((p) => p.identifiant)).size === b.points.length, {
    message: 'Point en double dans l’import.',
  });
export type ImportAds = z.infer<typeof ImportAds>;

/** Bilan d'un import : nombres seulement. */
export interface BilanImportAdsDto {
  id: string;
  numero: number;
  points: number;
  objets: number;
  noms: number;
  /** Imports plus anciens dont les noms viennent d'être effacés (seuls leurs nombres restent). */
  nomsPurges: number;
  ecartes: EcartsImportAds;
}

/* ------------------------------------------------------------------ Lecture (page « Active Directory ») */
/** Un import, en nombres. `version` sert d'If-Match à sa suppression. */
export interface ImportAdsDto {
  id: string;
  numero: number;
  version: number;
  dateRapport: string | null;
  note: number;
  progression: ProgressionNiveauAds[];
  conformes: number | null;
  points: number;
  objets: number;
  /** Faux pour un import plus ancien que les deux derniers : ses noms ont été effacés. */
  nomsConserves: boolean;
  importePar: string;
  importeLe: string;
}

/** Point ouvert du dernier import, en nombres, et sa variation depuis l'import précédent. */
export interface PointOuvertAdsDto {
  identifiant: string;
  reference: string;
  type: TypePointAds;
  niveau: number;
  titre: string;
  objets: number;
  /** Objets du même point à l'import précédent ; null : point absent de l'import précédent (« apparu ») ou pas d'import
      précédent. */
  objetsAvant: number | null;
  /** Vrai si l'import précédent existe et ne contenait pas ce point. */
  apparu: boolean;
}

/** Point de l'import précédent absent du dernier (« corrigé depuis »), en nombres. */
export interface PointCorrigeAdsDto {
  identifiant: string;
  reference: string;
  type: TypePointAds;
  niveau: number;
  titre: string;
  objets: number;
}

export interface AnnuaireAdsDto {
  courant: ImportAdsDto | null;
  precedent: ImportAdsDto | null;
  /** Imports du plus récent au plus ancien (ADS_BORNES.historique au plus). */
  historique: ImportAdsDto[];
  points: PointOuvertAdsDto[];
  corriges: PointCorrigeAdsDto[];
}

/** Noms d'un point (route à part, consultation tracée) : dernier import, et comparaison avec le précédent. */
export interface NomsPointAdsDto {
  identifiant: string;
  titre: string;
  numero: number;
  /** Noms au dernier import (vide si le point y est corrigé). */
  noms: NomObjetAds[];
  /** Objets du dernier import comptés sans nom conservé (au-delà de la borne, illisibles). */
  sansNom: number;
  /** Null s'il n'y a pas d'import précédent dont les noms sont gardés. */
  comparaison: {
    numero: number;
    apparus: NomObjetAds[];
    corriges: NomObjetAds[];
    /** Faux si l'un des deux imports n'a pas gardé tous les noms du point : la comparaison est partielle. */
    complete: boolean;
  } | null;
}

export const IdentifiantPointAdsParams = z.object({ identifiant: z.string().regex(IDENTIFIANT_POINT_ADS) }).strict();

/** Variation d'un nombre d'objets, en clair (« +2 », « −1 », « = », « apparu »). */
export function variationAds(p: Pick<PointOuvertAdsDto, 'objets' | 'objetsAvant' | 'apparu'>): string {
  if (p.apparu) return 'apparu';
  if (p.objetsAvant === null) return '—';
  const d = p.objets - p.objetsAvant;
  return d === 0 ? '=' : d > 0 ? `+${d.toLocaleString('fr-FR')}` : `−${(-d).toLocaleString('fr-FR')}`;
}

/** Évolution de la note globale d'un import au précédent (null s'il n'y en a pas). */
export const evolutionNoteAds = (courant: ImportAdsDto | null, precedent: ImportAdsDto | null): number | null =>
  courant && precedent ? courant.note - precedent.note : null;

/** Points ouverts comptés par niveau (lignes) et par type (colonnes). */
export function pointsParNiveauEtType(
  points: readonly Pick<PointOuvertAdsDto, 'niveau' | 'type'>[],
): Record<number, Record<TypePointAds, number>> {
  const out: Record<number, Record<TypePointAds, number>> = {};
  for (const n of NIVEAUX_ADS) out[n] = { 1: 0, 2: 0, 3: 0 };
  for (const p of points) if (out[p.niveau]) out[p.niveau]![p.type] += 1;
  return out;
}
