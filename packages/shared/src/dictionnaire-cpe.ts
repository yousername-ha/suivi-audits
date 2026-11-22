/* Module Vulnérabilités (ADR 0100, lot CPE-1 ; décisions du RSSI du 22/11/2026) : saisie assistée d'un produit surveillé par
   le dictionnaire CPE 2.3 de la NVD.
   - Liste locale des produits distincts du dictionnaire (partie, éditeur, produit, intitulé anglais sans la version),
     entrées obsolètes exclues, chargée par lots sur plusieurs passages de l'exécutant d'exploitation (curseur rangé côté
     API), puis tenue à jour par les nouveautés (fenêtre de dates de modification). Source désactivée au départ.
   - Versions d'un produit choisi : demande rangée dans une file dédiée, traitée par l'exécutant (une lecture de la NVD par
     éditeur et produit, bornée), gardée en cache par produit ; ou lues dans la copie complète du dictionnaire si elle est
     faite (aucune demande à la NVD).
   - Identifiant CPE 2.3 construit à partir de la partie, de l'éditeur, du produit et de la version, et lu dans l'autre sens
     (un CPE collé remplit les champs), sans aucun appel : fonctions pures ci-dessous.
   L'API ne joint aucune source (ADR 0014) : le script isolé scripts/veille-vulnerabilites.py lit la NVD, sous le flux
   « veille-vulnerabilites » (même hôte que la veille). Sa liste fermée (SOURCE_DICTIONNAIRE_CPE) est recopiée dans le
   script et comparée par apps/api/test/veille-architecture.test.ts. */
import { z } from 'zod';
import type { FluxEtatApplique } from './flux-externes.js';
import { FrequenceHeures } from './frequences-synchronisation.js';
import { composantesCpe } from './rapprochement-vulnerabilites.js';
import { NOM_CPE, type PartieCpe, PARTIES_CPE, VERSION_CPE } from './veille-vulnerabilites.js';
import { CPE_23 } from './vulnerabilites.js';

/* ------------------------------------------------------------------ Source (liste fermée) */
/** Hôte et chemin exacts du dictionnaire : le même hôte que la veille NVD (aucune destination nouvelle). */
export const SOURCE_DICTIONNAIRE_CPE = {
  id: 'nvd-cpe',
  libelle: 'Dictionnaire des produits (CPE)',
  organisme: 'NIST (États-Unis)',
  hote: 'services.nvd.nist.gov',
  chemins: ['/rest/json/cpes/2.0'],
  format: 'API JSON (CPE 2.0), paginée',
  langue: 'en',
  demande:
    'Les pages du dictionnaire (par lots, puis les entrées modifiées pendant une fenêtre de dates) ; à la demande d’une personne qui saisit un produit surveillé, les versions d’un éditeur et d’un produit, sauf si la copie complète est faite.',
} as const;

/** Bornes, reprises par la migration 101, par le script de l'exécutant et par l'exécutant lui-même. */
export const CPE_BORNES = {
  /** Terme de recherche dans la liste locale. */
  termeMin: 2,
  termeMax: 100,
  /** Produits proposés pendant la frappe. */
  resultats: 20,
  /** Versions gardées par produit (les plus récentes d'abord). */
  versions: 2000,
  /** Entrées demandées par page de la NVD (maximum de l'API) et pages lues par passage complet de l'exécutant : une seule,
      sans aucune attente (le passage complet ne dort jamais pour le dictionnaire). */
  parPage: 10000,
  pagesParPassage: 1,
  /** Éléments par lot remonté par l'exécutant (produits, versions de la copie complète) et lots par tranche. */
  lot: 5000,
  lotsMax: 20,
  /** Intitulé anglais gardé (texte simple). */
  intitule: 300,
  /** Demandes de versions à la NVD par personne et par heure. */
  demandesParHeure: 30,
  /** Demandes purgées après ce nombre de jours. */
  purgeJours: 7,
  /** Fenêtre des nouveautés de la NVD (limite de l'API) ; au-delà, rechargement complet. */
  fenetreJours: 120,
  /** Fenêtre « saisie en cours » : l'exécutant enchaîne des passages courts pendant ce délai après l'activité. */
  saisieMinutes: 2,
  /** Cache des versions : actualisé au plus une fois par jour, à la demande. */
  cacheHeures: 24,
} as const;

/** Fréquence de la mise à jour (nouveautés) de la liste : une fois par jour par défaut, ou une fois par semaine. */
export const FREQUENCES_DICTIONNAIRE_CPE = [24, 168] as const;
export const FREQUENCE_DICTIONNAIRE_CPE_DEFAUT = 24;
export const frequenceDictionnaireCpe = (reglee: number | null | undefined) =>
  reglee ?? FREQUENCE_DICTIONNAIRE_CPE_DEFAUT;
export const frequenceDictionnaireCpeAdmise = (h: number) =>
  (FREQUENCES_DICTIONNAIRE_CPE as readonly number[]).includes(h);

/** Message d'attente honnête (décision du RSSI) : aucune durée précise promise. */
export const MESSAGE_ATTENTE_VERSIONS =
  'Recherche des versions à la NVD… (quelques secondes, jusqu’à une vingtaine de secondes). Vous pouvez saisir la version vous-même.';
/** Explication de la copie complète : texte du RSSI, durée recalculée (une page par passage, mêmes pages que la liste). */
export const EXPLICATION_COPIE_COMPLETE =
  'Copie sur votre serveur la liste officielle des produits et de leurs versions (environ 1,9 million d’entrées). Les versions s’affichent alors immédiatement, sans demande à la NVD. Place : environ 270 Mo dans la base, et environ 17 Mo de plus par sauvegarde. Chargement : les mêmes pages que la liste des produits, une par passage de l’exécutant, soit environ une heure la première fois (une heure de plus si la liste est déjà chargée), puis les nouveautés chaque jour.';
/** Place de la liste des produits seule (mesure du RSSI sur le vrai dictionnaire, 22/11/2026). */
export const EXPLICATION_LISTE_PRODUITS =
  'Copie sur votre serveur la liste des produits distincts du dictionnaire CPE de la NVD (environ 150 000 produits, sans leurs versions), pour proposer un produit pendant la saisie sans aucun appel extérieur. Place : environ 40 Mo dans la base et 3 Mo par sauvegarde. Premier chargement : environ une heure (environ 190 pages de la NVD, une par passage de l’exécutant), puis les nouveautés à la fréquence choisie.';

/* ------------------------------------------------------------------ CPE 2.3 : construction et lecture */
/** Composante sans valeur précise : « * » (toute valeur) ou « - » (sans objet). */
const SANS_VALEUR = ['*', '-', ''];

/** Échappement d'une composante au format « chaîne formatée » du CPE 2.3 (NISTIR 7695, § 6.2) : lettres, chiffres, « _ »,
    « - » et « . » restent tels quels ; tout autre caractère est précédé d'une barre oblique inverse (« \: », « \! »,
    « \\ », « \* »…). */
export const echapperComposanteCpe = (s: string) => s.replace(/[^A-Za-z0-9_.-]/g, (c) => `\\${c}`);

/** Choix d'un produit : partie, éditeur et produit tels que la NVD les écrit (échappements retirés). */
export interface ChoixCpe {
  partie: PartieCpe;
  editeur: string;
  produit: string;
  /** Version choisie ou saisie ; vide ou « * » : toutes versions ; « - » : sans objet. */
  version?: string | null;
}

const nomValide = (s: string) => NOM_CPE.test(s) && !SANS_VALEUR.includes(s);

/** Identifiant CPE 2.3 (13 composantes) construit à partir du choix : version en « * » quand elle n'est pas précisée, autres
    composantes en « * ». null si l'éditeur, le produit ou la version n'ont pas une forme admise. */
export function construireCpe23(c: ChoixCpe): string | null {
  if (!(PARTIES_CPE as readonly string[]).includes(c.partie) || !nomValide(c.editeur) || !nomValide(c.produit))
    return null;
  const v = (c.version ?? '').trim();
  let version: string;
  if (v === '' || v === '*') version = '*';
  else if (v === '-') version = '-';
  else if (VERSION_CPE.test(v)) version = echapperComposanteCpe(v);
  else return null;
  const cpe = `cpe:2.3:${c.partie}:${echapperComposanteCpe(c.editeur)}:${echapperComposanteCpe(c.produit)}:${version}:*:*:*:*:*:*:*`;
  return CPE_23.test(cpe) ? cpe : null;
}

/** Lecture d'un CPE 2.3 collé : partie, éditeur, produit (échappements retirés) et version (null pour « * » ou « - »). null
    si la chaîne n'est pas un CPE 2.3 formaté valide. Aucun appel. */
export function analyserCpe23(brut: string): (ChoixCpe & { version: string | null }) | null {
  const s = brut.trim();
  if (s.length > 500 || !CPE_23.test(s)) return null;
  const p = composantesCpe(s);
  if (p.length !== 13) return null;
  const [partie, editeur, produit, version] = [p[2]!, p[3]!, p[4]!, p[5]!];
  if (!(PARTIES_CPE as readonly string[]).includes(partie) || !nomValide(editeur) || !nomValide(produit)) return null;
  if (SANS_VALEUR.includes(version)) return { partie: partie as PartieCpe, editeur, produit, version: null };
  if (!VERSION_CPE.test(version)) return null;
  return { partie: partie as PartieCpe, editeur, produit, version };
}

/* ------------------------------------------------------------------ Tri des versions */
/** Morceaux d'une version : suites de chiffres (nombres) et suites de lettres ; tout autre caractère sépare. */
function morceaux(v: string): (number | string)[] {
  return (v.toLowerCase().match(/\d+|[a-z]+/g) ?? []).map((m) => (/^\d/.test(m) ? Number(m.slice(0, 15)) : m));
}

/** Comparaison raisonnable de deux versions (plus grande = plus récente), documentée dans l'ADR 0100 (lot CPE-1) :
    morceau par morceau, nombres comparés comme des nombres (« 10 » après « 9 »), lettres dans l'ordre alphabétique ; un
    nombre l'emporte sur des lettres (« 1.0.1 » après « 1.0.rc1 ») ; un morceau de plus qui est un nombre rend la version plus
    récente (« 1.0.1 » après « 1.0 »), un morceau de plus en lettres la rend plus ancienne (« 1.0 » après « 1.0rc1 » ou
    « 1.0-beta »). À égalité, ordre des textes, pour un résultat stable. */
export function comparerVersionsCpe(a: string, b: string): number {
  const x = morceaux(a);
  const y = morceaux(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const u = x[i];
    const w = y[i];
    if (u === undefined) return typeof w === 'number' ? -1 : 1;
    if (w === undefined) return typeof u === 'number' ? 1 : -1;
    if (typeof u === 'number' && typeof w === 'number') {
      if (u !== w) return u < w ? -1 : 1;
    } else if (typeof u === 'number') return 1;
    else if (typeof w === 'number') return -1;
    else if (u !== w) return u < w ? -1 : 1;
  }
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Versions sans doublon ni valeur vide (« * », « - »), de la plus récente à la plus ancienne, bornées. */
export function trierVersionsCpe(versions: readonly string[], max: number = CPE_BORNES.versions): string[] {
  const uniques = [...new Set(versions.filter((v) => VERSION_CPE.test(v) && !SANS_VALEUR.includes(v)))];
  return uniques.sort((a, b) => comparerVersionsCpe(b, a)).slice(0, max);
}

/* ------------------------------------------------------------------ Recherche dans la liste locale */
/** Forme comparée par la recherche : sans accent, en minuscules, toute suite d'autres caractères que lettres et chiffres
    réduite à une espace (« Internet_Explorer », « internet-explorer » et « internet explorer » se valent). */
export function normaliserRechercheCpe(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Intitulé anglais d'une entrée sans sa version : « GLPI Project GLPI 9.5.1 » devient « GLPI Project GLPI ». La version
    n'est retirée que si elle figure en mot entier ; sinon l'intitulé est gardé tel quel. Même règle dans le script. */
export function intituleSansVersion(titre: string, version: string | null): string {
  const t = titre.trim();
  if (!version || SANS_VALEUR.includes(version)) return t;
  const motif = ` ${version}`;
  for (let i = t.lastIndexOf(motif); i > 0; i = t.lastIndexOf(motif, i - 1)) {
    const apres = t[i + motif.length];
    if (apres === undefined || apres === ' ') return t.slice(0, i).trim() || t;
    if (i === 0) break;
  }
  return t;
}

/* ------------------------------------------------------------------ Schémas (routes et CLI de l'exécutant) */
const sansControle = (s: string) => !/\p{Cc}/u.test(s);
const nomCpe = z
  .string()
  .regex(NOM_CPE)
  .refine((s) => !SANS_VALEUR.includes(s), 'Valeur précise attendue.');
export const PartieCpeSchema = z.enum(PARTIES_CPE);

/** Produit du dictionnaire désigné par la saisie (demande de versions). */
export const IdentiteProduitCpe = z.object({ partie: PartieCpeSchema, editeur: nomCpe, produit: nomCpe }).strict();
export type IdentiteProduitCpe = z.infer<typeof IdentiteProduitCpe>;

/** Recherche pendant la frappe : 2 à 100 caractères. */
export const RechercheProduitsCpe = z
  .object({ q: z.string().trim().min(CPE_BORNES.termeMin).max(CPE_BORNES.termeMax) })
  .strict();
export type RechercheProduitsCpe = z.infer<typeof RechercheProduitsCpe>;

export interface ProduitCpeDto {
  partie: PartieCpe;
  editeur: string;
  produit: string;
  /** Intitulé anglais de la NVD sans la version, texte simple ; null s'il manque. */
  intitule: string | null;
}

/** D'où vient une version proposée : cache de la NVD (file), copie complète, ou CVE déjà vues par la veille. */
export const SOURCES_VERSION_CPE = ['nvd', 'copie', 'veille'] as const;
export type SourceVersionCpe = (typeof SOURCES_VERSION_CPE)[number];
export const SOURCE_VERSION_CPE_LIBELLES: Record<SourceVersionCpe, string> = {
  nvd: 'dictionnaire de la NVD',
  copie: 'copie complète du dictionnaire',
  veille: 'vue dans une CVE de la veille',
};

export interface VersionCpeDto {
  version: string;
  source: SourceVersionCpe;
}

/** Réponse d'une demande de versions : prête (cache frais ou copie complète), en attente (file), ou indisponible (source
    désactivée, flux fermé, échec : le champ version reste libre). */
export interface VersionsCpeDto {
  etat: 'pret' | 'en_attente' | 'indisponible';
  versions: VersionCpeDto[];
  /** La liste de la NVD dépassait la borne : seules les plus récentes sont proposées. */
  tronque: boolean;
  /** Date de la réponse de la NVD gardée en cache, ou de la fin de la copie complète. */
  obtenuLe: string | null;
  message: string | null;
}

/** État utile au formulaire, rendu à son ouverture (qui note aussi la saisie en cours). */
export interface EtatSaisieCpeDto {
  /** Au moins un produit dans la liste locale : l'autocomplétion est proposée. */
  listeChargee: boolean;
  /** Les versions peuvent être demandées à la NVD (source activée, flux ouvert). */
  versionsDistantes: boolean;
  /** Copie complète terminée : les versions viennent de la base locale. */
  copieComplete: boolean;
}

export const ETATS_DICTIONNAIRE_CPE = ['inactif', 'en_attente', 'chargement', 'a_jour', 'erreur'] as const;
export type EtatDictionnaireCpe = (typeof ETATS_DICTIONNAIRE_CPE)[number];

export interface EtatDictionnaireCpeDto {
  source: typeof SOURCE_DICTIONNAIRE_CPE;
  activee: boolean;
  frequenceHeures: number;
  flux: { ouvert: boolean; applique: FluxEtatApplique | null };
  executant: { disponible: boolean };
  /** inactif (désactivée), en_attente (activée, rien de chargé encore), chargement (lots en cours), a_jour, erreur. */
  etat: EtatDictionnaireCpe;
  /** Chargement en cours : complet (tout le dictionnaire) ou nouveautés ; entrées lues sur le total annoncé par la NVD. */
  chargement: { mode: 'complet' | 'nouveautes'; lues: number; total: number | null } | null;
  produits: number;
  /** Fin du dernier chargement complet. */
  completLe: string | null;
  /** Date jusqu'à laquelle la liste est à jour (dernières nouveautés lues). */
  derniereMiseAJour: string | null;
  dernierEssai: string | null;
  erreur: string | null;
  prochaineMiseAJour: string | null;
  copie: { voulue: boolean; complete: boolean; completeLe: string | null; versions: number };
  version: number;
}

/** Réglage de la source (droit d'administrer le module, If-Match sur la version). */
export const ReglageDictionnaireCpe = z
  .object({ activee: z.boolean().optional(), frequenceHeures: FrequenceHeures.optional() })
  .strict()
  .refine((r) => r.activee !== undefined || r.frequenceHeures !== undefined, 'Aucune modification.');
export type ReglageDictionnaireCpe = z.infer<typeof ReglageDictionnaireCpe>;

const erreurCourte = z.string().min(1).max(300).refine(sansControle);
const entier = (max: number) => z.number().int().min(0).max(max);

/** Un produit distinct remonté par l'exécutant (texte de la NVD nettoyé et borné par le script, revalidé ici). */
export const ElementProduitCpe = z
  .object({
    partie: PartieCpeSchema,
    editeur: nomCpe,
    produit: nomCpe,
    intitule: z.string().min(1).max(CPE_BORNES.intitule).refine(sansControle).nullable(),
  })
  .strict();
export type ElementProduitCpe = z.infer<typeof ElementProduitCpe>;

/** Une version d'un produit (copie complète). */
export const ElementVersionCpe = z
  .object({
    partie: PartieCpeSchema,
    editeur: nomCpe,
    produit: nomCpe,
    version: z
      .string()
      .regex(VERSION_CPE)
      .refine((s) => !SANS_VALEUR.includes(s)),
  })
  .strict();
export type ElementVersionCpe = z.infer<typeof ElementVersionCpe>;

/** `suivi cpe-dictionnaire-lot <id>` : un lot de produits et, avec la copie complète, de versions. */
export const LotDictionnaireCpe = z
  .object({
    produits: z.array(ElementProduitCpe).max(CPE_BORNES.lot),
    versions: z.array(ElementVersionCpe).max(CPE_BORNES.lot),
  })
  .strict();
export type LotDictionnaireCpe = z.infer<typeof LotDictionnaireCpe>;

/** `suivi cpe-dictionnaire-finish <id>` : fin d'une tranche ; `suivant` : prochain indice à lire, `total` : annoncé par la
    NVD. */
export const RapportDictionnaireCpe = z
  .object({
    ok: z.boolean(),
    erreur: erreurCourte.nullable(),
    bilan: z
      .object({
        total: entier(10_000_000),
        suivant: entier(10_000_000),
        entrees: entier(1_000_000),
        obsoletes: entier(1_000_000),
        ecartes: entier(1_000_000),
      })
      .strict()
      .nullable(),
  })
  .strict()
  .refine((r) => (r.ok ? r.bilan !== null && r.erreur === null : r.bilan === null && r.erreur !== null), {
    message: 'Rapport incohérent.',
  });
export type RapportDictionnaireCpe = z.infer<typeof RapportDictionnaireCpe>;

/** `suivi cpe-versions-finish <id>` : versions lues pour un produit, bornées. */
export const RapportVersionsCpe = z
  .object({
    ok: z.boolean(),
    erreur: erreurCourte.nullable(),
    versions: z
      .array(
        z
          .string()
          .regex(VERSION_CPE)
          .refine((s) => !SANS_VALEUR.includes(s)),
      )
      .max(CPE_BORNES.versions),
    tronque: z.boolean(),
  })
  .strict()
  .refine((r) => (r.ok ? r.erreur === null : r.erreur !== null && r.versions.length === 0), {
    message: 'Rapport incohérent.',
  });
export type RapportVersionsCpe = z.infer<typeof RapportVersionsCpe>;
