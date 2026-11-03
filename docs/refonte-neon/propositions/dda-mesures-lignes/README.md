# DdA — mesures en lignes compactes

03/11/2026, Europe/Paris. Session : Codex. Branche `codex/refonte-neon-main` ; référence applicative inchangée `aaac67c`.

**Format en lignes explicitement validé par le demandeur.** Un nouvel essai de fonds légèrement plus foncés est présenté avant intégration ; seul cet ajustement de luminosité reste à valider. Le demandeur préfère une lecture en ligne compte tenu du nombre de mesures et écarte la proposition en cartes. Le registre est désormais présenté en lignes compactes ; la synthèse et la fiche de la nouvelle DdA restent la base. Aucun code applicatif modifié, aucun build ni test applicatif exécuté.

## Nuance légèrement plus foncée

03/11/2026. Après « Oui, essai un peu moins Claire », le format en lignes est retenu. Les fonds de page, surfaces et panneaux sont légèrement foncés dans les deux thèmes ; le clair adopte un gris bleuté plus présent. Textes, bordures, couleurs des niveaux, dimensions, données et JavaScript conservés. Dix rendus autonomes actualisés, code 0, sans chargement d’application ni d’API. Aucun build/test applicatif exécuté. La nuance est en attente de validation avant intégration.

[Comparer avec le clair précédent](https://raw.githubusercontent.com/yousername-ha/suivi-audits/cdf11372cc3d9809e879fadcd65a72eb1c49a107/docs/refonte-neon/propositions/dda-mesures-lignes/lignes-light-1440.png) · [Sombre précédent](https://raw.githubusercontent.com/yousername-ha/suivi-audits/cdf11372cc3d9809e879fadcd65a72eb1c49a107/docs/refonte-neon/propositions/dda-mesures-lignes/lignes-dark-1440.png).

## Format retenu

Une mesure occupe une ligne d’au moins 66 px sur ordinateur, avec 4 px d’écart : pastille de code, titre dominant, liseré de niveau turquoise/orange/rouge, contrôles courts d’applicabilité et mise en œuvre, actions ou justification, document, écarts et accès à la fiche. Les colonnes restent alignées, sans quadrillage vertical. Les textes longs agrandissent naturellement la ligne. Sur téléphone, les réglages et justificatifs se répartissent sous le titre, sans ascenseur interne.

![Lignes compactes, sombre](lignes-dark-1440.png)

[Clair](lignes-light-1440.png) · [Alertes et écarts](alertes-dark-1440.png) · [Alertes claires](alertes-light-1440.png) · [Page sombre](registre-dark-1440.png) · [Page claire](registre-light-1440.png) · [Mobile sombre](lignes-dark-390.png) · [Mobile clair](lignes-light-390.png) · [HTML autonome](index.html).

Dix captures Chromium du seul prototype avec données fictives : deux thèmes, deux largeurs, pages et gros plans, plus deux vues filtrées sur Insuffisant. Les rendus finaux correspondent au HTML autonome. Inter et sa licence SIL OFL sont embarqués. Les manipulations locales de référentiel, filtres, champs et fiche ne sauvegardent aucune donnée et ne chargent pas l’application ou l’API.

Les six informations existantes et les filtres sont conservés. Aucun score ni métrique de niveau n’est ajouté. L’applicabilité ISO obligatoire, l’exclusion, les justifications et la sémantique des écarts sont repris : NC rouge, autres écarts orange. Aucun rose. Les calculs et données de synthèse restent ceux de la proposition précédente.

Après validation, conserver les composants et parcours existants : calculs partagés, droits audit:modifier, enregistrement au fil de l’eau, erreurs et cas vides, liens/documents, extrait req, texte de référence, marqueur Tenacy et champs de fiche. Les contrôles serveur ne sont pas simulés par cette maquette. Aucun fichier de apps/, packages/ ou des tests n’a changé pour ce lot.

**Prochaine action : validation de la nuance plus foncée ; ne pas redemander l’accord sur le format en lignes déjà retenu.** Après accord, intégrer la DdA, effectuer les contrôles pertinents et fournir de nouvelles captures réelles, selon la règle visuel → validation → intégration et tests → nouveau visuel réel.

[Synthèse et fiche de référence](../dda-neon-nouveau/README.md) · [Cartes écartées](../dda-mesures-cartes/README.md).
