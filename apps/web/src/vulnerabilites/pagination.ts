/* Boutons de pagination nommés (flèches comprises) : sans nom, l'axe `wcag2a` (« button-name ») les refuse dès qu'il y a
   deux pages, pour le bouton désactivé comme pour la page active. À passer à chaque <Pagination> : `{...NOMS_PAGINATION}`.
   Même texte que celui de « Failles détectées » et de la vue d'ensemble. */
export const NOMS_PAGINATION = {
  getControlProps: (c: 'first' | 'previous' | 'last' | 'next') => ({
    'aria-label':
      c === 'previous'
        ? 'Page précédente'
        : c === 'next'
          ? 'Page suivante'
          : c === 'first'
            ? 'Première page'
            : 'Dernière page',
  }),
  getItemProps: (n: number) => ({ 'aria-label': `Page ${n}` }),
};
