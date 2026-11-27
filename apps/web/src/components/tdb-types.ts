/* Types communs des dalles du tableau de bord unique (ADR 0108) : dalles du tableau personnalisable (ADR 0069) et
   cartes de la vue analytique Neon (ADR 0093), rendues dans le même cadre. */
import type { Action, IdDalle, Module, ReglagesDalle } from '@suivi/shared';
import type { LargeurDalle } from '@suivi/ui';
import type { ReactNode } from 'react';

/** Familles du catalogue « Ajouter une dalle ». */
export const GROUPES_DALLES = ['Pilotage', 'Conformité', 'Écarts et actions', 'Risques et incidents'] as const;
export type GroupeDalle = (typeof GROUPES_DALLES)[number];

/** Rendu d'une dalle : largeur et hauteur dans la grille, réglages de la dalle, commande de détail. */
export interface RenduDalle {
  /** Identifiant de la dalle rendue (attribut data-dalle, style « Verre » seulement) ; absent : aucun attribut. */
  id?: IdDalle;
  largeur: LargeurDalle;
  /** Lignes de la grille ; absente : hauteur naturelle (détail, petits écrans). */
  hauteur?: number;
  reglages?: ReglagesDalle;
  action?: ReactNode;
  /** Éléments des graphiques cliquables, avec bulle d'intitulé (style « Verre ») ; absent : simple aperçu (mode
      modification de la disposition). */
  interactif?: boolean;
}

/** Une dalle du catalogue : n'existe que si les données lisibles par la personne la permettent. */
export interface DalleTableauDeBord {
  id: IdDalle;
  /** Titre (aria-label de la dalle, poignée, annonces et catalogue). */
  titre: string;
  /** Ce que montre la dalle, en une ligne (catalogue). */
  description: string;
  groupe: GroupeDalle;
  /** Largeur standard à l'écran (ADR 0069, lot 1). */
  largeur: LargeurDalle;
  /** Registre ouvert depuis le détail de la dalle, et droit de lecture qui y donne accès. */
  route: string;
  droit: readonly [Module, Action];
  rendu: (p: RenduDalle) => ReactNode;
}
