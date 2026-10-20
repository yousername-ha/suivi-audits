# Plan technique par lots vérifiables

L’IA d’implémentation travaille exclusivement sur sa branche dédiée, fondée sur `origin/legacy`. Chaque lot produit un commit révisable, sa documentation et les tests effectivement exécutés. Ne pas modifier `legacy`, fusionner ou déployer. Les fichiers de cartographie dynamique restent exclus.

| Lot | Modifications concrètes | Porte de sortie |
|---|---|---|
| 0 — Revalidation et sauvegarde | Comparer SHA audité et SHA courant ; inventorier registres et formulaires suivis ; relever les tests disponibles ; préparer copie de données synthétique et migration | Rapport factuel, absence de doublon canonique, frontières organisationnelles décidées |
| 1 — Socle et permissions | Namespace `grc`, schémas, références typées, adaptateurs ; `legacy_grc.py`, projection/fusion serveur, audit ; pas d’ouverture UI publique prématurée | Tests inter-organisations/périmètres, rejet IDs interdits, historiques et concurrence |
| 2 — Configurations | Échelles/taxonomies/critères/matrices/profils, versions immuables, affectations, dépendances, résolution ; administration et composants partagés | 9 cellules ARM exactes, tailles variables, ordre ≠ valeur, conflits et forks testés |
| 3 — Registres et import | Réutiliser fournisseurs/rôles/processus ; ajouter uniquement types absents ; import dry-run et rapprochement ; objets/revisions/relations | 25 fichiers classés, 9 missions, 8 échelles, aucun lien absent inventé, réimport sans doublon |
| 4 — Méthodes et études | Registre de méthodes, version publiée, assistant/bundle, contextes révisés, notes héritées, adaptateurs v1 | Création EBIOS et personnalisée sans couplage forcé ; MÉHARI historique intact |
| 5 — EBIOS ateliers 1–2 | Objets/relations/observations, besoins et ER, couples/pertinence/activité, tableau et panneaux liés | Parcours complet A1–A2, décision humaine, cas accidentel signalé, sélections cohérentes |
| 6 — EBIOS ateliers 3–5 | Écosystème/scénarios, graphe, vraisemblance, évaluation centrale v2, mesures/actions/preuves/décisions/surveillance | Étude de bout en bout synthétique, résiduel explicite, permissions de validation, mouvement réduit |
| 7 — Autres méthodes | Parcours ISO documenté après choix d’édition ; éditeur personnalisé contrôlé ; exports par version | Méthodes sans SR/OV obligatoires, résultats typés, configurations compatibles |
| 8 — Généralisation | Navigation, thème global clair/sauge, usages transversaux volontaires PCRA/conformité, accessibilité, recette et packaging | Tests de non-régression, migration/restauration, dossier à jour ; aucune activation automatique |

Les lots 1–2 précèdent l’import validant et toute création d’étude nouvelle. Les ateliers 3–5 n’attendent pas de fausses données ARM : utiliser des fixtures synthétiques et les sources méthodologiques. Les choix non confirmés de calcul empêchent la publication concernée, pas le travail indépendant sur le socle.

## Contrôles existants à réutiliser

`tests/risk.test.cjs`, `tests/server_risk_test.py`, `tests/integration.test.cjs`, `tests/browser-risks.cjs` ; vérifier leurs commandes, dépendances et prérequis au SHA de travail avant exécution. Ajouter des tests au bon niveau, pas des assertions qui recopient simplement le code. Les tests de maquette dans `fonctionnalites-a-implementer/003-ebios-rm/tests/` restent des tests de prototype, distincts des tests métier.

## Compte rendu exigé par lot

Liste des fichiers modifiés ; schémas/migrations introduits ; données préservées ; tests avec commande, résultat, SHA et limites ; captures synthétiques ; problèmes et décisions restantes. Ne pas écrire « complet » si une étape est simulée, si les permissions sont seulement UI ou si les liens ne persistent pas après rechargement.
