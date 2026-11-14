/* Revue de direction (ISO/IEC 27001:2022, 9.3) : structure des entrées (9.3.2 a à g, d 1 à 4) et des sorties (9.3.3). Seuls les
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
/* Entrées de la revue de direction selon l'ISO/IEC 27001:2022, 9.3.2 (arbitrage du RSSI du 13/11/2026, BUG-031 : l'ISO 9001
   n'est plus suivie pour le moment ; ADR 0036 amendée). */
export const ENTREES_REVUE: readonly { id: string; article: string; titre: string }[] = [
  { id: 'a', article: '9.3.2 a', titre: 'Statut des actions décidées lors des revues précédentes' },
  { id: 'b', article: '9.3.2 b', titre: 'Évolution des enjeux externes et internes pertinents pour le SMSI' },
  {
    id: 'c',
    article: '9.3.2 c',
    titre: 'Évolution des besoins et attentes des parties intéressées pertinents pour le SMSI',
  },
  { id: 'd1', article: '9.3.2 d 1', titre: 'Performance de sécurité : non-conformités et actions correctives' },
  {
    id: 'd2',
    article: '9.3.2 d 2',
    titre: 'Performance de sécurité : résultats de surveillance et de mesure, incidents',
  },
  { id: 'd3', article: '9.3.2 d 3', titre: 'Performance de sécurité : résultats d’audit' },
  {
    id: 'd4',
    article: '9.3.2 d 4',
    titre: 'Performance de sécurité : réalisation des objectifs de sécurité de l’information',
  },
  { id: 'e', article: '9.3.2 e', titre: 'Retours des parties intéressées' },
  {
    id: 'f',
    article: '9.3.2 f',
    titre: 'Résultats de l’appréciation des risques et état du plan de traitement des risques',
  },
  { id: 'g', article: '9.3.2 g', titre: 'Opportunités d’amélioration continue' },
];
/** Sorties de la revue (9.3.3) : champs de la fiche de revue. */
export const SORTIES_REVUE = [
  { cle: 'improvements', article: '9.3.3', titre: 'Décisions sur les opportunités d’amélioration continue' },
  {
    cle: 'changes',
    article: '9.3.3',
    titre: 'Besoins de changement du système de management de la sécurité de l’information',
  },
] as const;
/** Clé du champ de la fiche pour l'entrée `id` (a, b, c1…). */
export const cleEntree = (id: string) => `entree_${id}`;
