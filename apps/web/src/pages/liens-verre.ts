/* Liens en style « Verre » (dessin DocLiens validé par le RSSI le 28/11/2026) : fonctions pures, testées sans navigateur
   (apps/web/test/liens-verre.test.tsx). Tout est calculé sur les champs rendus par l'API (LinkOut) : genre de l'adresse,
   tuiles de synthèse, puces et filtre par genre, adresse abrégée des lignes. */
import type { LinkOut } from '@suivi/shared';
import { compterPuces, type OptionPuce } from '../components/recherche-liste';

/** Genre d'un lien, déduit de son adresse : site web (http, https), partage réseau (\\serveur\…, smb://), fichier
    (file://) ; toute autre adresse (lecteur « D:\… », par exemple) est neutre. */
export type GenreLien = 'web' | 'partage' | 'fichier' | 'autre';
/** Ordre d'affichage des genres (puces, détail de la tuile). */
export const GENRES_LIEN: readonly GenreLien[] = ['web', 'partage', 'fichier', 'autre'];

export function genreLien(url: string): GenreLien {
  const u = url.trim();
  if (/^https?:\/\//i.test(u)) return 'web';
  if (/^\\\\/.test(u) || /^smb:\/\//i.test(u)) return 'partage';
  if (/^file:\/\//i.test(u)) return 'fichier';
  return 'autre';
}

/** Libellé d'un genre : au singulier (puce du lien choisi), au pluriel (puces de filtre), en un mot (tuile). */
export const GENRE_LIBELLE: Readonly<Record<GenreLien, { un: string; plusieurs: string; mot: string }>> = {
  web: { un: 'Site web', plusieurs: 'Sites web', mot: 'sites' },
  partage: { un: 'Partage réseau', plusieurs: 'Partages réseau', mot: 'partages' },
  fichier: { un: 'Fichier', plusieurs: 'Fichiers', mot: 'fichiers' },
  autre: { un: 'Autre adresse', plusieurs: 'Autres adresses', mot: 'autres' },
};

export interface TuilesLiens {
  total: number;
  /** Genres présents, dans l'ordre d'affichage. */
  genres: GenreLien[];
  /** Liens ayant au moins un rattachement. */
  rattaches: number;
  partages: number;
  web: number;
}

/** Compteurs des quatre tuiles, sur la liste complète (sans recherche ni filtre). */
export function tuilesLiens(liens: readonly Pick<LinkOut, 'url' | 'refs'>[]): TuilesLiens {
  const presents = new Set<GenreLien>();
  let rattaches = 0,
    partages = 0,
    web = 0;
  for (const l of liens) {
    const g = genreLien(l.url);
    presents.add(g);
    if (l.refs.length) rattaches++;
    if (g === 'partage') partages++;
    if (g === 'web') web++;
  }
  return { total: liens.length, genres: GENRES_LIEN.filter((g) => presents.has(g)), rattaches, partages, web };
}

/** Détail de la tuile « Liens » : « 3 genres : sites, partages, fichiers » ; sans lien, « aucun genre ». */
export function detailGenres(t: Pick<TuilesLiens, 'genres'>): string {
  const n = t.genres.length;
  if (!n) return 'aucun genre';
  return `${n} genre${n > 1 ? 's' : ''} : ${t.genres.map((g) => GENRE_LIBELLE[g].mot).join(', ')}`;
}

/** Puces de genre : seuls les genres présents, avec leur nombre, dans l'ordre web, partage, fichier, autre. */
export function pucesGenre(liens: readonly Pick<LinkOut, 'url'>[]): OptionPuce[] {
  return compterPuces(liens, (l) => genreLien(l.url), {
    ordre: GENRES_LIEN,
    libelle: (g) => GENRE_LIBELLE[g as GenreLien]?.plusieurs ?? g,
  }).filter((o) => o.compte > 0);
}

/** Filtre par genre (fait dans le navigateur : l'API ne connaît pas le genre) ; sans genre, toute la liste. */
export function filtrerGenre<T extends Pick<LinkOut, 'url'>>(liens: readonly T[], genre: string | null): T[] {
  return genre ? liens.filter((l) => genreLien(l.url) === genre) : [...liens];
}

/** Adresse abrégée d'une ligne : un site web perd son protocole et sa barre finale (« exemple.invalid/hds ») ; les
    autres adresses restent entières. L'adresse complète reste dans l'infobulle et dans le panneau. */
export function adresseCourte(url: string): string {
  const u = url.trim();
  if (genreLien(u) !== 'web') return u;
  return u.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}
