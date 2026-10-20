/* Cartes de périmètres (graphe des périmètres) : compteurs de synthèse d'un périmètre. Un compteur que la personne n'a pas
   le droit de lire, ou que le périmètre ne peut pas produire, vaut `null` : l'écran affiche « indisponible », jamais un zéro
   fictif. Chaque élément n'est compté qu'une fois dans une carte : les occurrences de tâches récurrentes ne figurent que
   dans `recurrentes`, jamais dans `actions`. Une carte compte les éléments visibles dans son périmètre (les siens et ceux des
   registres qui le portent) ; les cartes ne s'additionnent pas, un registre multi-périmètre apparaissant dans chacune. */

export interface CompteurRetard {
  /** Éléments ouverts : ni archivés, ni dans un état terminal de la politique du périmètre. */
  ouverts: number;
  enRetard: number;
}
export interface CarteCompteurs {
  /** Actions autonomes (hors occurrences de tâches récurrentes). */
  actions: CompteurRetard | null;
  /** Séries actives et occurrences ouvertes de tâches récurrentes. */
  recurrentes: { series: number; occurrences: CompteurRetard } | null;
  /** Constats (écarts) non clos. */
  ecarts: CompteurRetard | null;
  /** Analyses d'impact (BIA) et plans de continuité (PCRA) non archivés. */
  continuite: { bia: number; plans: number } | null;
  /** Exigences couvertes par un rapprochement validé, sur les référentiels activés du périmètre. */
  conformite: { couvertes: number; exigences: number } | null;
}
export interface CartePerimetre {
  id: string;
  name: string;
  parentId: string | null;
  nature: string;
  entityKind: string;
  compteurs: CarteCompteurs;
}
