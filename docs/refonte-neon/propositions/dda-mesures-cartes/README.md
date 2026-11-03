# DdA — mesures en cartes graphiques

03/11/2026, Europe/Paris. Session : Codex. Branche `codex/refonte-neon-main`, référence applicative inchangée `aaac67c`.

**Nouvelle proposition à valider avant intégration**, après le retour du demandeur : « la partie mesure […] très classique, à la limite d’Excel ». Seule la présentation des mesures est reprise ; la synthèse et la fiche de la proposition précédente restent la base. Aucun code applicatif modifié, aucun build/test applicatif lancé.

## Présentation proposée

Chaque mesure possède une carte à hauteur naturelle : code cyan, titre fort, état lumineux turquoise/orange/rouge et liseré d’état. Les actions ou la justification et les documents occupent deux zones de lecture distinctes. Les écarts sont isolés avec leurs identifiants. Un socle plus sombre regroupe les deux réglages d’applicabilité et de mise en œuvre ; le code et Voir la fiche ouvrent la fiche. Deux cartes par rangée sur ordinateur, une sur mobile.

Les six informations de l’ancien registre restent présentes et les filtres gardent leurs sens. Aucun pourcentage, jauge ou score n’est ajouté aux niveaux catégoriels. Les clauses ISO demeurent obligatoires, les mesures exclues montrent leur justification, les écarts NC restent rouges et les autres écarts orange. Pas de rose. Les contenus longs agrandissent naturellement les cartes, sans ascenseur interne.

![Mesures en cartes, sombre](cartes-dark-1440.png)

[Cartes claires](cartes-light-1440.png) · [Alertes et écarts](alertes-dark-1440.png) · [Alertes claires](alertes-light-1440.png) · [Page sombre](registre-dark-1440.png) · [Page claire](registre-light-1440.png) · [Mobile sombre](registre-dark-390.png) · [Mobile clair](registre-light-390.png) · [HTML autonome](index.html).

## Portée et suite

Huit captures du prototype HTML autonome avec données fictives : deux thèmes, ordinateur/mobile, gros plans des cartes et des alertes. Les filtres, le référentiel et la fiche sont manipulables dans le fichier ; les modifications y sont locales et non sauvegardées. La synthèse et les calculs de maquette sont conservés. Police Inter et licence SIL OFL embarquées. Aucun appel à l’application ni à son API, aucune référence CI remplacée.

Lors de l’intégration après validation, conserver données, calculs partagés, erreurs et cas vides, droits `audit:modifier`, conditions ISO/exclusions, enregistrement au fil de l’eau, liens et documents, extrait `req`, indicateur Tenacy, texte de référence et tous les champs de fiche. Les interactions serveur ne sont pas validées par une maquette. Aucun fichier de `apps/`, `packages/` ou des tests n’a évolué pour cette proposition.

**Prochaine action : validation du visuel des cartes.** Après accord, intégrer, effectuer les contrôles pertinents puis fournir les captures réelles, selon la règle visuel → validation → intégration et tests → nouveau visuel réel.

[Synthèse et fiche de référence](../dda-neon-nouveau/README.md).
