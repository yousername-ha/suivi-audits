/* Documents en style « Verre » (dessin DocDocuments validé par le RSSI le 28/11/2026) : fonctions pures, testées sans
   navigateur (apps/web/test/documents-verre.test.tsx). Tout est calculé sur les champs rendus par l'API (DocumentOut) :
   type du fichier d'après son extension ou son type MIME, tuiles de synthèse, filtre par classification, versions.
   « À revoir » : document non modifié depuis plus d'un an (règle validée par le RSSI le 28/11/2026), d'après la date de
   modification de la fiche (updated_at). */
import { CLASSIFICATION_LABELS, type CLASSIFICATIONS, type DocumentDetailOut, type DocumentOut } from '@suivi/shared';
import { compterPuces, type OptionPuce } from '../components/recherche-liste';

type Classification = (typeof CLASSIFICATIONS)[number];
type DocumentVersionOut = DocumentDetailOut['versions'][number];

/** Famille du fichier : couleur du badge (pdf rouge, texte bleu, tableur vert, présentation orange, image violet,
    autre neutre). */
export type FamilleFichier = 'pdf' | 'texte' | 'tableur' | 'presentation' | 'image' | 'autre';
export interface TypeFichier {
  libelle: string;
  famille: FamilleFichier;
}

const T = (libelle: string, famille: FamilleFichier): TypeFichier => ({ libelle, famille });
const PDF = T('PDF', 'pdf'),
  DOC = T('DOC', 'texte'),
  XLSX = T('XLSX', 'tableur'),
  CSV = T('CSV', 'tableur'),
  PPTX = T('PPTX', 'presentation'),
  IMG = T('IMG', 'image'),
  TXT = T('TXT', 'autre'),
  ZIP = T('ZIP', 'autre');

const PAR_EXTENSION: Readonly<Record<string, TypeFichier>> = {
  pdf: PDF,
  doc: DOC,
  docx: DOC,
  odt: DOC,
  rtf: DOC,
  xls: XLSX,
  xlsx: XLSX,
  ods: XLSX,
  csv: CSV,
  ppt: PPTX,
  pptx: PPTX,
  odp: PPTX,
  png: IMG,
  jpg: IMG,
  jpeg: IMG,
  gif: IMG,
  webp: IMG,
  svg: IMG,
  txt: TXT,
  md: TXT,
  zip: ZIP,
  '7z': ZIP,
  rar: ZIP,
  gz: ZIP,
  tar: ZIP,
};

const PAR_MIME: readonly (readonly [RegExp, TypeFichier])[] = [
  [/^application\/pdf$/, PDF],
  [
    /^application\/(msword|rtf|vnd\.openxmlformats-officedocument\.wordprocessingml|vnd\.oasis\.opendocument\.text)/,
    DOC,
  ],
  [
    /^application\/(vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml|vnd\.oasis\.opendocument\.spreadsheet)/,
    XLSX,
  ],
  [/^text\/csv$/, CSV],
  [
    /^application\/(vnd\.ms-powerpoint|vnd\.openxmlformats-officedocument\.presentationml|vnd\.oasis\.opendocument\.presentation)/,
    PPTX,
  ],
  [/^image\//, IMG],
  [/^text\/(plain|markdown)$/, TXT],
  [/^application\/(zip|x-7z-compressed|x-rar-compressed|gzip|x-tar)$/, ZIP],
];

/** Type du fichier, d'après l'extension du nom de fichier, à défaut le type MIME. Extension inconnue : badge neutre à
    son nom (quatre lettres au plus). Ni nom ni type exploitable : null (pas de badge inventé). */
export function typeFichier(nom: string | null | undefined, mime: string | null | undefined): TypeFichier | null {
  const ext = /\.([a-z0-9]{1,8})$/i.exec(nom ?? '')?.[1]?.toLowerCase();
  if (ext && PAR_EXTENSION[ext]) return PAR_EXTENSION[ext];
  const m = (mime ?? '').toLowerCase().split(';')[0]!.trim();
  for (const [motif, type] of PAR_MIME) if (motif.test(m)) return type;
  return ext ? T(ext.toUpperCase().slice(0, 4), 'autre') : null;
}

/** Document « à revoir » : non modifié depuis plus d'un an (date de modification antérieure au même jour, un an plus
    tôt). Une date illisible ne compte pas. */
export function aRevoir(d: Pick<DocumentOut, 'updated_at'>, maintenant: number): boolean {
  const t = Date.parse(d.updated_at);
  if (Number.isNaN(t)) return false;
  const limite = new Date(maintenant);
  limite.setUTCFullYear(limite.getUTCFullYear() - 1);
  return t < limite.getTime();
}

export interface TuilesDocuments {
  total: number;
  /** Types de fichiers distincts (libellés des badges). */
  types: number;
  /** Catégories distinctes, catégorie vide exclue. */
  categories: number;
  /** Documents ayant au moins un rattachement. */
  rattaches: number;
  aRevoir: number;
  confidentiels: number;
}

/** Compteurs des quatre tuiles, sur le registre (documents hors corbeille, sans recherche ni filtre). */
export function tuilesDocuments(docs: readonly DocumentOut[], maintenant: number): TuilesDocuments {
  const types = new Set<string>(),
    categories = new Set<string>();
  let rattaches = 0,
    revoir = 0,
    confidentiels = 0;
  for (const d of docs) {
    const t = typeFichier(d.filename, d.mime);
    if (t) types.add(t.libelle);
    if (d.category.trim()) categories.add(d.category.trim());
    if (d.refs.length) rattaches++;
    if (aRevoir(d, maintenant)) revoir++;
    if (d.classification === 'confidentiel') confidentiels++;
  }
  return {
    total: docs.length,
    types: types.size,
    categories: categories.size,
    rattaches,
    aRevoir: revoir,
    confidentiels,
  };
}

const pluriel = (n: number, mot: string) => `${n} ${mot}${n > 1 ? 's' : ''}`;
/** Détail de la tuile « Documents » : « 4 types, 7 catégories ». */
export const detailTypes = (t: Pick<TuilesDocuments, 'types' | 'categories'>) =>
  `${pluriel(t.types, 'type')}, ${pluriel(t.categories, 'catégorie')}`;

/** Puces de classification : seules les classifications présentes, avec leur nombre. */
export function pucesClassification(docs: readonly DocumentOut[]): OptionPuce[] {
  return compterPuces(docs, (d) => d.classification, {
    libelle: (c) => CLASSIFICATION_LABELS[c as Classification] ?? c,
  });
}

/** Filtre par classification (fait dans le navigateur : l'API ne filtre pas sur ce champ). */
export function filtrerClassification<T extends Pick<DocumentOut, 'classification'>>(
  docs: readonly T[],
  classification: string | null,
): T[] {
  return classification ? docs.filter((d) => d.classification === classification) : [...docs];
}

/** Rattachements d'une ligne : les deux premiers en puces, puis « +N ». */
export function refsLigne(refs: readonly string[], n = 2): { visibles: string[]; reste: number } {
  return { visibles: refs.slice(0, n), reste: Math.max(0, refs.length - n) };
}

/** Ligne secondaire : catégorie · version · taille ; une valeur absente n'est pas écrite. */
export function metaDocument(
  d: Pick<DocumentOut, 'category' | 'current_version' | 'size'>,
  taille: (n: number | null | undefined) => string,
): string {
  return [d.category.trim(), `v${d.current_version}`, taille(d.size)].filter(Boolean).join(' · ');
}

/** Frise des versions : de la plus récente à la plus ancienne. */
export function versionsFrise(versions: readonly DocumentVersionOut[]): DocumentVersionOut[] {
  return [...versions].sort((a, b) => b.version - a.version);
}

/** Date courte (jour) d'un horodatage ISO, au format français. */
export const jourDocument = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString('fr-FR') : '');
