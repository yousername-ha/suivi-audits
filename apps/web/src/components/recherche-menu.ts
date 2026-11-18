/* Recherche de pages dans le menu (demande du RSSI du 18/11/2026) : un champ sous le logo trouve une page du menu par
   son nom ou par le nom de sa famille, sans tenir compte des accents ni de la casse. */

export interface PageMenu {
  to: string;
  label: string;
  groupe: string;
}

/** Nombre maximal de pages proposées sous le champ. */
export const RESULTATS_MAX = 8;

const plier = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr')
    .trim();

/** Pages dont le libellé (en priorité) ou la famille contient la saisie ; une page n'apparaît qu'une fois. */
export function trouverPages(pages: readonly PageMenu[], saisie: string): PageMenu[] {
  const q = plier(saisie);
  if (!q) return [];
  const vues = new Set<string>();
  const parLibelle: PageMenu[] = [];
  const parGroupe: PageMenu[] = [];
  for (const p of pages) {
    if (vues.has(p.to)) continue;
    if (plier(p.label).includes(q)) {
      vues.add(p.to);
      parLibelle.push(p);
    } else if (plier(p.groupe).includes(q)) {
      vues.add(p.to);
      parGroupe.push(p);
    }
  }
  return [...parLibelle, ...parGroupe].slice(0, RESULTATS_MAX);
}
