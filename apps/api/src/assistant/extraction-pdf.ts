/* Texte d'un PDF (ADR 0086, point 12) par pdfjs-dist, la bibliothèque de lecture de PDF de Mozilla : seule dépendance de
   l'extraction, chargée à la demande. Aucun rendu graphique, aucune police système. En
   production, ce module ne s'exécute que dans le processus d'extraction isolé (assistant-extracteur). Les PDF numérisés
   (images sans couche de texte) ne rendent aucun texte : ils sont signalés comme non lus. */
import { TEXTE_MAX, type Extraction } from './extraction.js';

export const PAGES_PDF_MAX = 500;

export async function extrairePdf(buf: Buffer): Promise<Extraction> {
  try {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const tache = getDocument({
      data: new Uint8Array(buf),
      useSystemFonts: false,
      disableFontFace: true,
      verbosity: 0,
    });
    const doc = await tache.promise;
    let texte = '';
    for (let i = 1; i <= Math.min(doc.numPages, PAGES_PDF_MAX) && texte.length < TEXTE_MAX; i++) {
      const contenu = await (await doc.getPage(i)).getTextContent();
      for (const x of contenu.items) if ('str' in x) texte += x.str + (x.hasEOL ? '\n' : '');
      texte += '\n';
    }
    await tache.destroy();
    texte = texte
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, TEXTE_MAX);
    return texte
      ? { etat: 'extrait', texte }
      : { etat: 'non_lu', motif: 'Aucun texte dans ce PDF : document numérisé (images) ou vide.' };
  } catch (e) {
    const protege = (e as { name?: string }).name === 'PasswordException';
    return { etat: 'non_lu', motif: protege ? 'PDF protégé par un mot de passe.' : 'Le PDF n’a pas pu être lu.' };
  }
}
