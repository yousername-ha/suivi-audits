/* Cartes de périmètres (graphe des périmètres) : compteurs de synthèse d'un périmètre. Un compteur que la personne n'a pas
   le droit de lire, ou que le périmètre ne peut pas produire, vaut `null` : l'écran affiche « indisponible », jamais un zéro
   fictif. Chaque élément n'est compté qu'une fois dans une carte : les occurrences de tâches récurrentes ne figurent que
   dans `recurrentes`, jamais dans `actions`. Une carte compte les éléments visibles dans son périmètre (les siens et ceux des
   registres qui le portent) ; les cartes ne s'additionnent pas, un registre multi-périmètre apparaissant dans chacune : le total
   de la synthèse compte chaque élément une seule fois. */

export interface CompteurRetard {
  /** Éléments ouverts : ni archivés, ni dans un état terminal de la politique du périmètre. */
  ouverts: number;
  enRetard: number;
}
/** Écarts ouverts par classification (celle de la fiche, sinon celle de l'outil de suivi historique). */
export interface EcartsParClassification {
  majeure: number;
  mineure: number;
  point_sensible: number;
  non_classe: number;
}
export interface CarteCompteurs {
  /** Actions autonomes (hors occurrences de tâches récurrentes). */
  actions: CompteurRetard | null;
  /** Séries actives et occurrences ouvertes de tâches récurrentes. */
  recurrentes: { series: number; occurrences: CompteurRetard } | null;
  /** Constats (écarts) non clos, avec leur ventilation par classification. */
  ecarts: (CompteurRetard & { parClassification: EcartsParClassification }) | null;
  /** Analyses d'impact (BIA) et plans de continuité (PCA, PRA, PCRA) non archivés. */
  continuite: { bia: number; plans: number } | null;
  /** Couverture des référentiels rattachés ou hérités du périmètre (même calcul que l'écran « Couverture ») : exigences
      applicables et, parmi elles, celles dont la mise en œuvre est testée ou validée. Ce n'est pas un taux de conformité.
      Null : droit manquant ou aucun référentiel effectif (indisponible, jamais 0 %). */
  couverture: {
    referentiels: number;
    exigences: number;
    applicables: number;
    testees: number;
    /** Exigences dont l'applicabilité n'est pas encore tranchée : à revoir (comptées parmi les applicables). */
    aDeterminer: number;
    /** Clauses obligatoires (4 à 10 de l'ISO/IEC 27001) pas encore conformes : à traiter. */
    obligatoiresNonConformes: number;
  } | null;
}
export interface CartePerimetre {
  id: string;
  name: string;
  parentId: string | null;
  nature: string;
  entityKind: string;
  /** Éléments du périmètre lui-même (les siens et ceux des registres qui le portent). */
  compteurs: CarteCompteurs;
  /** Le périmètre et ses sous-périmètres, chaque élément une seule fois : jamais la somme des cartes enfants. Égal à
      `compteurs` sans sous-périmètre ; la couverture n'est pas agrégée. */
  total: CarteCompteurs;
  /** Nombre de sous-périmètres accessibles (descendants à tous niveaux) pris en compte dans `total`. */
  sousPerimetres: number;
}

/** Réponse de la synthèse : une carte par périmètre accessible et le total sans doublon (jamais la somme des cartes). */
export interface SyntheseCartes {
  cartes: CartePerimetre[];
  total: CarteCompteurs;
}
