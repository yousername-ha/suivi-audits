/* Revue de direction (ISO 9001:2015, 9.3) : structure des entrées (9.3.2 a à f, c 1 à 7) et des sorties (9.3.3). Seuls les
   intitulés courts sont repris, jamais le texte de la norme. Les entrées sont préparées à partir des données de la plateforme
   (faits chiffrés), jamais interprétées : la conclusion reste celle de la direction. */
export interface EntreeRevue {
  id: string;
  article: string;
  titre: string;
  /** Faits tirés des données de la plateforme, vides quand la donnée n'existe pas. */
  faits: string[];
  /** Entrée qui ne se déduit d'aucune donnée : à renseigner par la direction. */
  aSaisir: boolean;
}
export const ENTREES_REVUE: readonly { id: string; article: string; titre: string }[] = [
  { id: 'a', article: '9.3.2 a', titre: 'Statut des actions décidées lors des revues précédentes' },
  { id: 'b', article: '9.3.2 b', titre: 'Évolution des enjeux externes et internes pertinents' },
  { id: 'c1', article: '9.3.2 c 1', titre: 'Satisfaction du client et retours des parties intéressées' },
  { id: 'c2', article: '9.3.2 c 2', titre: 'Atteinte des objectifs qualité' },
  { id: 'c3', article: '9.3.2 c 3', titre: 'Performance des processus et conformité des produits et services' },
  { id: 'c4', article: '9.3.2 c 4', titre: 'Non-conformités et actions correctives' },
  { id: 'c5', article: '9.3.2 c 5', titre: 'Résultats de surveillance et de mesure' },
  { id: 'c6', article: '9.3.2 c 6', titre: 'Résultats d’audit' },
  { id: 'c7', article: '9.3.2 c 7', titre: 'Performance des prestataires externes' },
  { id: 'd', article: '9.3.2 d', titre: 'Adéquation des ressources' },
  { id: 'e', article: '9.3.2 e', titre: 'Efficacité des actions face aux risques et opportunités' },
  { id: 'f', article: '9.3.2 f', titre: 'Opportunités d’amélioration' },
];
/** Sorties de la revue (9.3.3) : champs de la fiche de revue. */
export const SORTIES_REVUE = [
  { cle: 'improvements', article: '9.3.3 a', titre: 'Opportunités d’amélioration' },
  { cle: 'changes', article: '9.3.3 b', titre: 'Besoins de changement du système de management' },
  { cle: 'resourceNeeds', article: '9.3.3 c', titre: 'Besoins en ressources' },
] as const;
/** Clé du champ de la fiche pour l'entrée `id` (a, b, c1…). */
export const cleEntree = (id: string) => `entree_${id}`;
