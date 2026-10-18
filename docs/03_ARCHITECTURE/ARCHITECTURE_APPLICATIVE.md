# Architecture applicative

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

Le DAT est le point d’entrée. Organisation :

| Chemin                              | Responsabilité réelle                                                                                    |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| packages/shared                     | zod, permissions, format legacy, géométrie/scènes, récurrences, politiques/méthodes et modèles Pilotage. |
| packages/ui                         | Thème Mantine, jetons, styles et composants de la charte.                                                |
| apps/web/src/main.tsx               | Routes SPA, gardes de confort, provider Query/session/temps réel.                                        |
| apps/web/src/pages/Pilotage.tsx     | Périmètre commun par défaut, rubrique métier ; /grc redirige ici.                                        |
| apps/web/src/pilotage / grc / carto | Registres, formulaires/décisions, tâches/méthodes et canevas réutilisé.                                  |
| apps/api/src/app.ts / http/route.ts | Assemblage déclaratif, gardes, zod, limites et OpenAPI.                                                  |
| apps/api/src/pilotage/legacy.ts     | Adaptateurs scope/interested/swots/roles/processes/objectives/indicators/evidences/findings/reviews.     |
| apps/api/src/grc                    | Objets partagés, relations, sources, méthodes, récurrences, référentiels et rapports.                    |
| apps/api/src/legacy/store.ts        | app_state + recomposition ; un mapper enregistré, maps.                                                  |
| app/public/index.html               | Outil historique conservé comme référence de parité (non servi) et bibliothèques embarquées.             |
| scripts                             | Commandes serveur et workers ; distincts de l’API métier.                                                |

Les objets GRC natifs, sources legacy et dispositions cartographiques sont
distincts. Un graphe est une projection, pas un deuxième registre. Les liens
sont bidirectionnels si les deux objets sont autorisés ; pas de lecture implicite
inter-périmètre. Les objets communs ne deviennent pas privés par simple filtre UI.

React valide le confort ; Fastify/services valident les droits. Les formulaires
ne peuvent fabriquer une décision sensible ; il faut l’opération de décision
versionnée et ses conditions métier. Retirer une source ne réécrit pas une
décision historique. Distinguer décision immuable et simple champ de statut.
