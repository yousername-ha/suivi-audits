> 03/11/2026 : la partie Mesures est reprise dans une [nouvelle proposition en cartes](../dda-mesures-cartes/README.md), à valider. La synthèse et la fiche de cette page restent la base de présentation.

# DdA — nouvelle proposition néon depuis zéro

03/11/2026, Europe/Paris. Session : Codex. Branche `codex/refonte-neon-main` ; référence applicative `aaac67c`.

**Le demandeur souhaite reprendre la DdA depuis zéro sur les deux images fournies : cette nouvelle maquette remplace les propositions DdA précédentes et attend sa propre validation explicite.** Les images servent de références graphiques ; aucune instruction de document n'est considérée comme une demande. Aucun fichier applicatif modifié, aucun build ni test applicatif de cette proposition.

## Direction visuelle

Fond bleu nuit profond, cartes bleu ardoise, traits lumineux cyan/bleu et graphiques néon inspirés des images. Rouge franc pour Insuffisant et les alertes, orange pour Partiel et turquoise pour Total ; pas de rose. Quatre graphiques montrent les niveaux déclarés des mesures applicables, leur répartition en barres, l’applicabilité et les points de vigilance. Un registre et une fiche reprennent les informations existantes ; un affichage clair et un affichage mobile sont proposés.

![Nouvelle DdA sombre](registre-dark-1440.png)

[Clair](registre-light-1440.png) · [Sombre mobile](registre-dark-390.png) · [Clair mobile](registre-light-390.png) · [Fiche sombre](fiche-dark-1440.png) · [Fiche claire](fiche-light-1440.png) · [Synthèse sombre](synthese-dark.png) · [Alertes](insuffisant-dark-1440.png) · [Maquette autonome](index.html).

La maquette comprend des données fictives et fonctionne localement sans connexion à l’API : filtre, choix de référentiel, ouverture de fiche, champs et changement de thème sont des simulations sans sauvegarde. Les contrôles de droit, la validation et les écritures sont ceux de l’application existante à conserver lors de l’intégration. Inter et sa licence SIL OFL sont embarqués.

## Données et fonctionnalités à conserver

Les graphiques se limitent au référentiel affiché. `statsDda` compte les mesures dont l’applicabilité n’est pas « non », y compris celles non renseignées, puis leurs niveaux Total, Partiel, Insuffisant ou Non renseigné ; les exclues sont décomptées à part. Le pourcentage est Total/applicables : il ne constitue pas un score de certification. Aucune chronologie ni comparaison de données non chargées n’est inventée. Exemple fictif Annexe A : 93 mesures, 91 applicables, 2 exclues, 55 Total, 27 Partiel, 9 Insuffisant et 60 % Total déclaré.

Lors d’une éventuelle intégration, conserver `statsDda`, `filtrerMesures`, `incoherente`, `lireDda`, les filtres, les six colonnes et les champs modifiables au fil de l’eau selon `audit:modifier`. Le code de mesure ouvre la fiche ; conserver les clauses ISO obligatoires, les exclusions, les justificatifs, risques, actions, documents, liens, commentaire, texte de référence, extrait `req`, identifiants d’écarts et indicateur Tenacy. Les erreurs, cas vides et appels PATCH restent ceux du produit. Aucune nouvelle sauvegarde globale ni import Excel n’est ajouté. La fiche réelle conservera le défilement extérieur pour les contenus longs.

## Rendu et suite

Douze captures Chromium de la maquette indépendante : registre et fiche, deux thèmes et deux largeurs, deux vues de synthèse et deux vues filtrées sur Insuffisant. Ces visuels sont des propositions et non des captures d’une DdA intégrée. Aucune modification dans `apps/`, `packages/` ou les tests, aucun build ni test applicatif, aucun snapshot CI mis à jour.

**Prochaine action : validation du nouveau visuel.** Après accord, intégrer la présentation dans les composants existants, vérifier données, interactions, droits, affichage et défilement, puis fournir des captures réelles. La règle du demandeur est : visuel → validation → intégration et tests → nouveau visuel réel.
