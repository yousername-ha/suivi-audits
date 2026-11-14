/* Bibliothèque de référentiels (refonte Neon, lot 4, ADR 0093) : type de présentation existant du catalogue
   (`GET /api/library/frameworks`), extrait de Bibliotheque.tsx sans changer son contrat, et fonctions pures de la vue
   Studio (recherche, provenance, barre des états). Aucun schéma serveur ajouté. */
import { ETATS_EXIGENCE, type EtatExigence, type SyntheseEtats } from '@suivi/shared';

export interface ReferentielBibliotheque {
  id: string;
  identifier: string;
  name: string;
  version: number;
  requirements: number;
  scopes: number;
  source: { status: string; organisation: string };
  /** Toujours vrai : la bibliothèque est figée (la personnalisation se fait dans la copie d'un périmètre). */
  locked: boolean;
  derivedFrom: { identifier: string; name: string; version: number } | null;
}

/** Statut déclaré de la source d'un référentiel ; une source reprise de l'outil de suivi n'est pas une source officielle
    vérifiée : elle reste « à vérifier ». */
export const LIBELLES_SOURCE: Record<string, string> = {
  official_verified: 'Source officielle vérifiée',
  licensed_import: 'Importé sous licence',
  organisation: 'Choix de l’organisation',
  unverified: 'Source à vérifier',
};

/** Provenance affichée sous le nom : copie d'un autre référentiel, sinon statut de la source. */
export function provenance(f: Pick<ReferentielBibliotheque, 'derivedFrom' | 'source'>): string {
  return f.derivedFrom ? `Copie de ${f.derivedFrom.name}` : (LIBELLES_SOURCE[f.source.status] ?? f.source.status);
}

/** Texte sans accents ni majuscules, pour une recherche tolérante. */
export const normaliser = (v: string) =>
  v
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('fr');

/** Référentiels dont le nom ou l'identifiant contient la recherche (sans tenir compte des accents ni de la casse). */
export function filtrerReferentiels<T extends Pick<ReferentielBibliotheque, 'name' | 'identifier'>>(
  liste: readonly T[],
  recherche: string,
): T[] {
  const q = normaliser(recherche.trim());
  return q ? liste.filter((f) => normaliser(`${f.name} ${f.identifier}`).includes(q)) : [...liste];
}

/** Segments de la barre des états (largeur totale 1000, interstice de 2) ; aucun segment pour un état sans exigence. */
export function segmentsEtats(etats: SyntheseEtats): { etat: EtatExigence; x: number; largeur: number }[] {
  const total = ETATS_EXIGENCE.reduce((n, e) => n + etats[e], 0);
  let position = 0;
  return ETATS_EXIGENCE.flatMap((etat) => {
    const x = position,
      w = total ? (etats[etat] / total) * 1000 : 0;
    position += w;
    return w > 0 ? [{ etat, x, largeur: Math.max(w - 2, 0) }] : [];
  });
}
