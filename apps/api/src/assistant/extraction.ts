/* Extraction du texte d'un document (ADR 0086, point 12). Fonctions pures, bibliothèque standard de Node uniquement, sans
   accès au réseau ni au disque : elles reçoivent des octets et rendent du texte borné. Formats lus : texte brut et formats
   bureautiques ouverts (archives ZIP de fichiers XML). PDF, anciens formats binaires et images ne sont pas lus : ils
   demandent une bibliothèque tierce (dépendance nouvelle, à décider par addendum). En production, ce code s'exécute dans un
   processus séparé et sans droits (assistant-extracteur). */
import { inflateRawSync } from 'node:zlib';

export const TEXTE_MAX = 400_000;
const ENTREE_MAX = 30 * 1024 * 1024;
const TOTAL_MAX = 60 * 1024 * 1024;
const ENTREES_MAX = 5000;

export type Extraction = { etat: 'extrait'; texte: string } | { etat: 'non_lu'; motif: string };

const TEXTE = new Set(['txt', 'md', 'csv', 'json', 'xml', 'log', 'eml']);
const NON_LUS: Record<string, string> = {
  pdf: 'Le format PDF n’est pas encore lu par l’assistant.',
  doc: 'L’ancien format Word (.doc) n’est pas lu : enregistrer le document en .docx.',
  xls: 'L’ancien format Excel (.xls) n’est pas lu : enregistrer le document en .xlsx.',
  ppt: 'L’ancien format PowerPoint (.ppt) n’est pas lu : enregistrer le document en .pptx.',
  msg: 'Les messages Outlook (.msg) ne sont pas lus.',
  zip: 'Les archives ne sont pas lues.',
  png: 'Les images ne sont pas lues.',
  jpg: 'Les images ne sont pas lues.',
  jpeg: 'Les images ne sont pas lues.',
  gif: 'Les images ne sont pas lues.',
};

class Illisible extends Error {}

/** Entrées d'une archive ZIP, lues depuis le répertoire central. Tailles bornées ; ZIP64 et chiffrement refusés. */
function entreesZip(buf: Buffer): Map<string, () => Buffer> {
  let fin = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--)
    if (buf.readUInt32LE(i) === 0x06054b50) {
      fin = i;
      break;
    }
  if (fin < 0) throw new Illisible('Archive illisible.');
  const nombre = buf.readUInt16LE(fin + 10);
  let p = buf.readUInt32LE(fin + 16);
  if (nombre > ENTREES_MAX || p === 0xffffffff) throw new Illisible('Archive trop volumineuse.');
  const entrees = new Map<string, () => Buffer>();
  let total = 0;
  for (let n = 0; n < nombre; n++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Illisible('Archive illisible.');
    const drapeaux = buf.readUInt16LE(p + 8);
    const methode = buf.readUInt16LE(p + 10);
    const compresse = buf.readUInt32LE(p + 20);
    const taille = buf.readUInt32LE(p + 24);
    const lNom = buf.readUInt16LE(p + 28);
    const lExtra = buf.readUInt16LE(p + 30);
    const lCommentaire = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const nom = buf.toString('utf8', p + 46, p + 46 + lNom);
    p += 46 + lNom + lExtra + lCommentaire;
    if (drapeaux & 1) throw new Illisible('Document protégé par un mot de passe.');
    if (taille > ENTREE_MAX || compresse === 0xffffffff || local === 0xffffffff) continue;
    total += taille;
    if (total > TOTAL_MAX) throw new Illisible('Archive trop volumineuse.');
    entrees.set(nom, () => {
      if (local + 30 > buf.length || buf.readUInt32LE(local) !== 0x04034b50) throw new Illisible('Archive illisible.');
      const debut = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const donnees = buf.subarray(debut, debut + compresse);
      if (methode === 0) return donnees;
      if (methode !== 8) throw new Illisible('Compression non prise en charge.');
      return inflateRawSync(donnees, { maxOutputLength: ENTREE_MAX });
    });
  }
  return entrees;
}

const ENTITES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
/** Texte d'un fragment XML : fins de paragraphe en sauts de ligne, balises retirées, entités décodées. */
function texteXml(xml: string, finsDeParagraphe: RegExp): string {
  return xml
    .replace(finsDeParagraphe, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-fA-F]{1,6}|#\d{1,7}|[a-z]+);/g, (tout, e: string) => {
      if (e[0] !== '#') return ENTITES[e] ?? tout;
      const code = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    });
}

/** Caractères de contrôle retirés (PostgreSQL refuse l'octet nul), sauf tabulation, saut de ligne et retour chariot. */
function sansControle(t: string): string {
  let out = '';
  for (const c of t) {
    const code = c.codePointAt(0)!;
    if (code >= 32 || code === 9 || code === 10 || code === 13) out += c;
  }
  return out;
}
const propre = (t: string) =>
  sansControle(t.slice(0, TEXTE_MAX * 2))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, TEXTE_MAX);

function bureautique(ext: string, buf: Buffer): string {
  const z = entreesZip(buf);
  const lire = (nom: string) => z.get(nom)?.().toString('utf8') ?? '';
  const numerotes = (motif: RegExp) =>
    [...z.keys()]
      .filter((n) => motif.test(n))
      .sort((a, b) => Number(/(\d+)\.xml$/.exec(a)?.[1] ?? 0) - Number(/(\d+)\.xml$/.exec(b)?.[1] ?? 0));
  switch (ext) {
    case 'docx':
      return texteXml(lire('word/document.xml'), /<\/w:p>|<w:br\s*\/>|<w:tab\s*\/>/g);
    case 'pptx':
      return numerotes(/^ppt\/slides\/slide\d+\.xml$/)
        .map((n, i) => `Diapositive ${i + 1}\n` + texteXml(lire(n), /<\/a:p>/g))
        .join('\n\n');
    case 'xlsx':
      return texteXml(lire('xl/sharedStrings.xml'), /<\/si>/g);
    default:
      // odt, ods, odp : un seul fichier de contenu.
      return texteXml(lire('content.xml'), /<\/text:p>|<\/text:h>|<text:line-break\s*\/>|<text:tab\s*\/>/g);
  }
}

/** Texte d'un document d'après son extension (déjà contrôlée à l'envoi par files.ts). Ne lève jamais. */
export function extraireTexte(ext: string, buf: Buffer): Extraction {
  const e = ext.toLowerCase();
  try {
    if (TEXTE.has(e)) {
      const texte = propre(buf.subarray(0, TEXTE_MAX * 4).toString('utf8'));
      return texte ? { etat: 'extrait', texte } : { etat: 'non_lu', motif: 'Le document est vide.' };
    }
    if (['docx', 'pptx', 'xlsx', 'odt', 'ods', 'odp'].includes(e)) {
      const texte = propre(bureautique(e, buf));
      return texte
        ? { etat: 'extrait', texte }
        : { etat: 'non_lu', motif: 'Aucun texte trouvé dans ce document (contenu en images ?).' };
    }
    return { etat: 'non_lu', motif: NON_LUS[e] ?? 'Ce format n’est pas lu par l’assistant.' };
  } catch (x) {
    return { etat: 'non_lu', motif: x instanceof Illisible ? x.message : 'Le document n’a pas pu être lu.' };
  }
}
