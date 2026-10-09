# Reprise intégrale du socle v2 dans Sauge

## Périmètre et état vérifié au 9 octobre 2026

La demande utilisateur couvre toutes les fonctionnalités de l'ancienne interface, y compris celles encore utilisées sous `/legacy`. Sources examinées : `archives/v2-manifest.json` (44 fichiers v2 conservés), `app/public/index.html`, `packages/shared/src/permissions.ts`, `docs/legacy/LEGACY-FORMAT.md`, `MAPPING-LEGACY.md`, `docs/ROADMAP.md` et `BACKLOG-FONCTIONNEL.md`. L'archive est une garantie de conservation du code, pas une preuve d'équivalence fonctionnelle.

Le ZIP Sauge fournit l'outil historique et ses bibliothèques, son pont API, le stockage `app_state`, l'historique, l'import/export et les permissions. La cartographie seule dispose aujourd'hui d'un mapper métier vers ses tables. Les autres familles restent modifiables dans l'outil historique selon leurs droits. Elles doivent toutes être reprises dans la charte Sauge, sans retirer leur parcours opérationnel pendant la transition.

## Contrôle de conservation du code historique

Comparaison directe avec `archives/v2-source.zip` : les **326 fonctions nommées** relevées dans le HTML v2 sont toutes encore présentes dans `app/public/index.html` (330 dans le socle fourni). Les cinq bibliothèques d'export embarquées (`docx`, `exceljs`, `jszip`, `pptxgen`, `xlsx`) sont identiques octet pour octet. Le HTML complet diffère, ce qui est attendu avec le pont et les adaptations de transition ; aucune conclusion d'équivalence de comportement n'est tirée du seul comptage des fonctions.

Ce contrôle complète l'archive et le contrat des chemins. Il ne remplace pas la recette des écrans, traitements, exports et liens métier de chaque famille avant sa reprise dans Sauge.

## Matrice obligatoire de reprise

| Famille / permission | Clés legacy à conserver | Rattachement à l'évolution A–L | État de l'interface et recette de remplacement |
|---|---|---|---|
| Audit / `audit` | years, yearLabels, nextYear, nextDate, internalDate, iso27001Certified, groups, items, hdsChap | C référentiels ; F auditeur ; K parcours | Historique actif ; conserver couverture interne/certification par année, préparation, responsables et remarques |
| Écarts / `ecarts` | findings, source, closeDeadline, findingsRev | H amélioration ; G preuves ; K | Historique actif ; conserver sources, tâches, états, échéances, clôture, preuves et liens aux exigences |
| Plan d'audit / `plan_audit` | plan | F, G, K | Historique actif ; conserver journées, créneaux, participants, questions et preuves attendues |
| Pilotage / `pilotage` | processes, objectives, indicators, dda, accessReviews, reviews, scope, interested, swots, roles, plans, recurring, evidences | B configuration ; C ; E continuité ; G ; H ; K | Historique actif ; conserver processus, objectifs/valeurs, DDA, contexte/périmètre, parties intéressées, revues, responsabilités, récurrences et preuves |
| Fournisseurs / `fournisseurs` | suppliers, supEvals | B ; G contrôles ; H | Historique actif ; conserver caractéristiques, certifications, évaluations, contacts, fréquences et historique des contrôles |
| Conformité / `conformite` | frameworks, activeFw, entityCategory, appGaps | C moteur/mappings ; D programmes ; F HAS ; K | Historique actif ; conserver versions, domaines/exigences, GAP, applicabilité et liens ; la sélection active ne remplace pas l'activation B |
| IA / `ia` | ai | B ; C ; G ; H ; J | Historique actif ; conserver contexte, registre, évaluations, plans et politiques. Le registre IA existant est distinct d'un futur assistant MCP |
| CRRC / `crrc` | crrc | D suivi programme et finances ; G ; H | Historique actif ; reprendre établissements, offres, ressources, statuts/historique et exports. Critères supplémentaires CRRC-01 à CRRC-04 du backlog conservés |
| Investissements / `investissements` | invest | D finances ; B configuration ; H | Historique actif ; conserver registre, montants, étapes, filtres et exports existants. INV-01/INV-02 restent à livrer, pas supposés existants |
| Incidents / `incidents` | incidents, crisis | E BIA/PCA/PRA/PCRA ; H ; G | Historique actif ; conserver incidents, crise/main courante et liens aux plans. INC-01/INC-02/INC-03 restent au backlog |
| Cartographie / `cartographie` | maps | A6 ; E dépendances ; K | Sauge livrée, tables maps/map_versions et mapper. Recomposition/import/export, positions et versions à préserver ; CARTO-01 à CARTO-14 restent le contrat |
| Paramètres / `parametres` | branding ; clés inconnues soumises au contrôle serveur | B2 ; A5 | Paramètres Sauge et configuration historique coexistent ; aucune clé inconnue n'est supprimée au motif de normalisation |
| Métadonnées | v, updatedAt, schema | Tous les lots de reprise | Versions du format et horodatages conservés ; identifiants stables du schéma 15 et champs extra traités selon le contrat |
| Documents et liens / `documents` | Données relationnelles et fichiers chiffrés, hors JSON métier | G preuves ; F auditeur ; K | Sauge livrée ; préserver versions, rattachements, droits, clés et intégrité des téléchargements |
| Comptes, sessions et accès / `administration` | Comptes v2, rôles, sessions, audit append-only | A4 ; B ; F ; J | Sauge livrée ; correspondance admin/rw/ro conservée, MFA/CSRF/contrôle d'origine obligatoires, scopes auditeur et expirations |
| Import/export / `import_export` | État complet, fichiers sources, rapports, batches et historique | C6 et tous les lots | Sauge livrée ; simulation, initialisation/fusion/remplacement, annulation et recomposition en un état cohérent |
| Exploitation serveur | Secrets, base, documents, rapports, certificats et sauvegardes | A1/A2 ; I transports | Scripts disponibles ; pilotage web des sauvegardes/TLS non livré. Conservation des volumes v2 jusqu'à recette de migration explicite |

## Passage d'une famille vers Sauge

1. Relever ses écrans, opérations, raccourcis, filtres, exports et relations dans l'outil historique ; construire une recette avec des données fictives. Le contrat des chemins est nécessaire mais ne remplace pas la recette des fonctions.
2. Réutiliser le modèle existant ou ajouter une migration non destructive ; conserver identifiants, champs non modélisés et relations. Mettre à jour MAPPING-LEGACY et fournir un mapper avec test d'aller-retour.
3. Vérifier droits serveur, CSRF, concurrence, historique, temps réel et refus d'accès hors périmètre. Aucune seconde source modifiable du même module.
4. Recetter création, modification, consultation, suppression autorisée, import/export, annulation, relations et versions ; comparer aux capacités historiques, documenter les différences voulues.
5. Valider Sauge en clair/sombre, téléphone/tablette/bureau/4K, CSP et absence de débordement. Revoir les captures modifiées avant de les approuver.
6. Seulement après validation, basculer cette famille en lecture seule dans `/legacy`. Le retrait complet de `/legacy` et de `app_state` attend la reprise de toutes les familles et un export d'archive vérifié.

## Statut de ce lot

Inventaire et rattachement au backlog réalisés. Le guide d'utilisation embarqué expose chaque famille métier autorisée, avec un accès à l'outil historique et une explication de la transition. A3/A4/A5/A6 font l'objet du premier lot de fiabilisation. **Les interfaces historiques ci-dessus ne sont pas encore toutes réécrites dans Sauge** ; leurs migrations et recettes détaillées constituent les lots suivants. Aucun jeu de données de production n'est migré par ce lot.
