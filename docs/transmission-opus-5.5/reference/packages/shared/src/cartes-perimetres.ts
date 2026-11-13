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
/** Couverture d'un référentiel (une version) dans un ou plusieurs périmètres. */
export interface CouvertureReferentiel {
  referentielId: string;
  identifiant: string;
  nom: string;
  version: number;
  /** Périmètres comptés où ce référentiel est effectif (1 pour une carte seule). */
  perimetres: number;
  exigences: number;
  applicables: number;
  testees: number;
  aDeterminer: number;
  obligatoiresNonConformes: number;
  /** Carte seule : `rattache` ici ou `herite` d'un parent ; `origine` est le nom de ce parent, null s'il n'est pas accessible.
      Absent dans un agrégat (plusieurs périmètres, provenances différentes). */
  provenance?: 'rattache' | 'herite';
  origine?: string | null;
}
export interface Couverture {
  referentiels: number;
  exigences: number;
  applicables: number;
  testees: number;
  /** Exigences dont l'applicabilité n'est pas encore tranchée : à revoir (comptées parmi les applicables). */
  aDeterminer: number;
  /** Clauses obligatoires (4 à 10 de l'ISO/IEC 27001) pas encore conformes : à traiter. */
  obligatoiresNonConformes: number;
  /** Périmètres dont la couverture est comptée : 1 pour une carte seule ; davantage pour le total avec sous-périmètres, où une
      exigence compte une fois par périmètre où elle est évaluée (l'évaluation est propre à chaque périmètre). */
  perimetres: number;
  /** Périmètres de l'ensemble dont la couverture n'a pas pu être lue : exclus du calcul, jamais comptés comme zéro. */
  nonLus: number;
  /** Détail par référentiel (et version), dont la somme est celle des champs ci-dessus. */
  parReferentiel: CouvertureReferentiel[];
}
export interface CarteCompteurs {
  /** Actions autonomes (hors occurrences de tâches récurrentes). */
  actions: CompteurRetard | null;
  /** Séries actives et occurrences ouvertes de tâches récurrentes. */
  recurrentes: { series: number; occurrences: CompteurRetard } | null;
  /** Constats (écarts) non clos, avec leur ventilation par classification. */
  ecarts: (CompteurRetard & { parClassification: EcartsParClassification }) | null;
  /** Analyses d'impact (BIA) et plans de continuité et de reprise d'activité (PCRA) non archivés. Seuls les plans de type
      PCRA sont comptés (décision du 21/10/2026) : un PCA ou un PRA seul n'est pas un PCRA. */
  continuite: { bia: number; pcra: number } | null;
  /** Couverture des référentiels rattachés ou hérités du périmètre (même calcul que l'écran « Couverture ») : exigences
      applicables et, parmi elles, celles dont la mise en œuvre est testée ou validée. Ce n'est pas un taux de conformité.
      Pour une carte, un seul périmètre ; pour le total avec sous-périmètres, la somme des couvertures de chaque périmètre
      (voir `perimetres`). Null : droit manquant ou aucun référentiel effectif (indisponible, jamais 0 %). */
  couverture: Couverture | null;
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
      `compteurs` sans sous-périmètre ; la couverture est la somme de celle de chaque périmètre de l'ensemble (`perimetres`). */
  total: CarteCompteurs;
  /** Nombre de sous-périmètres accessibles (descendants à tous niveaux) pris en compte dans `total`. */
  sousPerimetres: number;
}

/** Réponse de la synthèse : une carte par périmètre accessible et le total sans doublon (jamais la somme des cartes). */
export interface SyntheseCartes {
  cartes: CartePerimetre[];
  total: CarteCompteurs;
}

/** Couverture agrégée de plusieurs périmètres (un périmètre et ses sous-périmètres) : somme, par référentiel et version, des
    couvertures de chaque périmètre qui a au moins un référentiel effectif. Une exigence compte une fois par périmètre où elle
    est évaluée, jamais de moyenne ni de taux. La provenance n'est conservée que pour un seul périmètre. `nonLus` : périmètres de l'ensemble dont la couverture n'a pas pu être lue, signalés
    et exclus. Null quand aucun périmètre n'a de référentiel effectif (indisponible, jamais 0). */
export function agregerCouvertures(
  entrees: readonly (readonly CouvertureReferentiel[])[],
  nonLus = 0,
): Couverture | null {
  const parCle = new Map<string, CouvertureReferentiel>();
  let perimetres = 0;
  for (const frameworks of entrees) {
    if (!frameworks.length) continue;
    perimetres++;
    for (const f of frameworks) {
      const cle = `${f.referentielId}:${f.version}`;
      const a = parCle.get(cle);
      if (!a) {
        parCle.set(cle, { ...f, perimetres: 1 });
        continue;
      }
      // Plusieurs périmètres : la provenance (rattaché ici / hérité de tel parent) n'a plus de sens pour la somme.
      delete a.provenance;
      delete a.origine;
      a.perimetres++;
      a.exigences += f.exigences;
      a.applicables += f.applicables;
      a.testees += f.testees;
      a.aDeterminer += f.aDeterminer;
      a.obligatoiresNonConformes += f.obligatoiresNonConformes;
    }
  }
  if (!parCle.size) return null;
  const parReferentiel = [...parCle.values()].sort(
    (x, y) =>
      x.nom.localeCompare(y.nom, 'fr') || x.version - y.version || x.referentielId.localeCompare(y.referentielId),
  );
  const somme = (cle: 'exigences' | 'applicables' | 'testees' | 'aDeterminer' | 'obligatoiresNonConformes') =>
    parReferentiel.reduce((t, f) => t + f[cle], 0);
  return {
    referentiels: parReferentiel.length,
    exigences: somme('exigences'),
    applicables: somme('applicables'),
    testees: somme('testees'),
    aDeterminer: somme('aDeterminer'),
    obligatoiresNonConformes: somme('obligatoiresNonConformes'),
    perimetres,
    nonLus,
    parReferentiel,
  };
}
