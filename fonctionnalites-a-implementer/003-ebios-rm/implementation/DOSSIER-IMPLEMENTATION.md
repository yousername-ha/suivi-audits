# 003 — Parcours EBIOS RM : dossier d’implémentation

Édition du 20 octobre 2026. **Périmètre approuvé pour transmission au codage**, sous contrôle préalable de l’existant. Référence de conception : [v002-echelles-plateforme](../maquettes/v002-echelles-plateforme/README.md). Aucun statut « implémenté » ni validation serveur revendiqué.

## Instruction obligatoire avant développement

Lire [Contrôle de l’existant et consignes de codage](../../_dossiers-transversaux/implementation-ui-2026-10/CONTROLE-EXISTANT-ET-CODAGE.md). Pour chaque exigence ci-dessous, vérifier la branche/SHA cible et renseigner preuve, état et écart. **Si c’est déjà implémenté et vérifié, conserver l’existant.** Ne coder que le manque ; aucune reconstruction sur la seule base d’une ancienne maquette ou documentation.

## Demandes, règle retenue et recette

Ces lignes consolident les remarques utilisateur applicables au périmètre. Les précisions d’intégrité, d’erreur et d’accessibilité complètent leur traduction technique. Les propositions non confirmées figurent dans les limites ci-dessous ; elles ne deviennent pas des règles normatives implicites.

| ID | Demande / sujet | Règle retenue pour l’intégration | Critère à vérifier sur la cible |
| --- | --- | --- | --- |
| 003-01 | Parcours guidé illustré et professionnel | Cinq ateliers et repères ANSSI ; schémas, explications concises, états de progression fondés sur données réelles. | Parcours de bout en bout après rechargement, retour libre entre ateliers, aucun faux état validé. |
| 003-02 | Atelier 1 — cadrage et socle | Associer étude/périmètre, missions/valeurs métier et supports, événements redoutés/gravité, socle de sécurité selon contrats existants. | Identifiants canoniques ; gravité issue d’échelle publiée ; applicabilité distincte du risque. |
| 003-03 | Atelier 2 — sources de risque | Réutiliser SR/OV, couples contextualisés, critères/pertinence et justification des choix. | Pas de seuil inventé, matrice de pertinence distincte de la matrice de risque. |
| 003-04 | Atelier 3 — scénarios stratégiques | Référencer parties prenantes et écosystème, chemins stratégiques et mesures associées. | Fournisseur partagé conserve son ID ; dangerosité contextualisée et justifiée. |
| 003-05 | Atelier 4 — scénarios opérationnels | Scénarios et chemins avec opérations liées, vraisemblance issue de la configuration d’étude. | Raccordement aux données structurées ; pas d’obligation de quatre colonnes si le modèle réel diffère. |
| 003-06 | Atelier 5 — traitement et suivi | Synthèse, choix de traitement, mesures/actions, risque résiduel, décision et surveillance selon le socle. | Aucune acceptation automatique ; évaluation et décision distinctes, preuves et historique conservés. |
| 003-07 | Suivi ligne par ligne, matrice et cercle | Sélection commune entre tableau, matrice dessous et représentation circulaire contextualisée ; légende et liste équivalente. | Sélection et filtres synchronisés ; données absentes explicites, aucun score déduit des positions décoratives. |
| 003-08 | Représentation visuelle des scénarios | Chemins sélectionnables et alternatives, nœuds reliés dans le sens des étapes. | Sélection par chemin, navigation depuis risque et retour, graphe fondé sur liens canoniques. |
| 003-09 | Pictogrammes SR/OV et couleurs | Icônes d’illustration adaptées (acteur malveillant, voleur, feu selon l’objet), libellés et couleurs pour risques/valeurs métier. | Pictogramme décoratif ne reclasse pas une source ; accident/feu non transformé en attaquant intentionnel. |
| 003-10 | Flux animés et contours épais | Seulement sur chemin sélectionné ; sens départ → pointe, nœuds renforcés ; pause et réduction des mouvements. | Tous chemins reste lisible ; mouvement réduit conserve flèches et sélection. |
| 003-11 | Échelles déclarées dans configuration | Catalogue unique 019, sélection explicite de versions pour gravité/vraisemblance ; critères des autres objets selon leurs contrats. | Publication et historique testés ; aucun recalcul silencieux ou duplication d’échelle. |
| 003-12 | Réutilisation des objets transversaux | Mesures Annexe A, plans, preuves, fournisseurs, actifs et périmètres par références ; ne pas dupliquer le socle ARM/Claude. | Étude alimentée par mêmes objets que registres ; données non accessibles masquées par le serveur. |

## UI/UX, composants et références

Conserver les états et visuels de la [maquette de référence](../maquettes/v002-echelles-plateforme/README.md) et les composants natifs déjà conformes. La règle commune de style 08 et de défilements s’applique ; ne pas recopier globalement les CSS de prototype. Prévoir chargement, vide, recherche sans résultat, refus d’accès, erreur réseau, conflit de version et confirmation lorsqu’une opération le nécessite. Contrôles et actions accessibles au clavier, focus explicite, légendes textuelles, écrans étroits et thèmes Sauge/Clair.

Documents complémentaires à lire :

- [ECHELLES-PLATEFORME.md](ECHELLES-PLATEFORME.md).
- [SOURCES-PARCOURS.md](../maquettes/v001-parcours-anime/SOURCES-PARCOURS.md).
- [06-PARCOURS-METHODES.md](../../../fonctionnalites-en-developpement/_dossiers-transversaux/grc-transversal/v001-dossier-arm/06-PARCOURS-METHODES.md).

## Architecture et contrats à réutiliser

Réutiliser risk-studies/:id et services d’études/configurations/évaluations du socle ; vérifier chaque atelier et chaque objet structuré dans la cible. Les notes locales des 18 étapes ne sont pas un modèle d’étude. Construire l’UI sur les contrats réels et préserver leurs validations et permissions.

002/019 pour cotations et configurations ; périmètres, actifs, fournisseurs, conformité, preuves et actions canoniques existants.

Les modèles/réponses/API réels restent autoritaires. Identifier les composants, queries et mutations existants, conserver les IDs, versions et droits. Les fixtures ne remplacent pas les schémas partagés. Après mutation réussie, actualiser les vues liées sans création en double ; en erreur conserver les saisies. Toute migration doit préserver données et historiques et avoir une reprise documentée.

## Limites et décisions à expliciter

Les 18 étapes et notes sont un parcours pédagogique, pas des formulaires métier exhaustifs. Les sources ANSSI sont référencées depuis le lien utilisateur, sans inventer des obligations normatives ou qualifier l’outil de labellisé. Le cas ANSSI reste fictif pour l’organisation ; ne pas l’importer comme données utilisateur. Les schémas de cercle ont une sémantique par contexte, pas un indicateur universel de risque.

Ces points sont à établir par le contrôle du code courant ou à signaler comme décision manquante. Ils n’autorisent ni invention de méthode normative, ni extension silencieuse des droits, ni annonce d’une capacité non vérifiée. Le code disponible chez Claude n’est consulté qu’en lecture seule ; toute adaptation autorisée se fait sur la branche propre de l’IA de codage.

## Ordre, recette et remise

1. Auditer chaque exigence et les dépendances ; rendre le relevé d’existant avant de modifier.
2. Conserver les comportements satisfaisants et réutiliser leurs composants. Adapter lecture/navigation, puis formulaires et commandes effectivement supportées, puis relations entre modules.
3. Exécuter les critères du tableau sur données synthétiques, les contrôles métier et permissions côté serveur, puis typage/build/lint/tests pertinents et non-régressions UI. Les résultats de [tests historiques](../tests/README.md) ne sont pas une preuve d’intégration actuelle.
4. Livrer branche/SHA, écarts traités, tests, visuels et limites ; utiliser le marqueur uniquement selon les consignes communes, après intégration réelle vérifiée.

[Prompt dédié](PROMPT-IMPLEMENTATION.md). Le classement « à implémenter » transmet ce dossier à l’IA ; il ne signifie pas que tout doit être recodé ni que la maquette contient déjà tous les services.

## Références graphiques complémentaires à conserver

- [v001-parcours-anime](../maquettes/v001-parcours-anime/README.md).
- [v002-echelles-plateforme](../maquettes/v002-echelles-plateforme/README.md).
