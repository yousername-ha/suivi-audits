# DdA — mesures en lignes compactes

03/11/2026, Europe/Paris. Session : Codex. Branche `codex/refonte-neon-main` ; référence applicative inchangée `aaac67c`.

**Format en lignes explicitement validé par le demandeur.** Les fonds légèrement plus foncés, l’applicabilité colorée, les champs remplis et les liserés néon sont présentés avant intégration ; ces finitions restent à valider. Le demandeur préfère une lecture en ligne compte tenu du nombre de mesures et écarte la proposition en cartes. Le registre est désormais présenté en lignes compactes ; la synthèse et la fiche de la nouvelle DdA restent la base. Aucun code applicatif modifié, aucun build ni test applicatif exécuté.

## Reprise des deux références — sélecteurs sans flèche

03/11/2026. Reprise des deux exemples fournis : halos colorés et lignes lumineuses, sélecteurs arrondis dans le thème sombre et champs remplis dans le thème clair. Les dalles de scores sont conservées. Les flèches des deux sélecteurs Applicable et Mise en œuvre sont masquées ; les contrôles natifs restent cliquables et utilisables au clavier. Les flèches d’accès à la fiche sont conservées.

[Vue sombre](lignes-dark-1440.png) · [Vue claire](lignes-light-1440.png) · [Page complète](registre-dark-1440.png) · [Exclusions](applicabilite-dark-1440.png) · [Mobile](lignes-dark-390.png).

Douze captures du prototype autonome, code 0. Dans Chromium, les deux champs ont été cliqués et leurs choix modifiés dans la maquette, code 0 ; aucune application ni API chargée. Données et JavaScript identiques, seul le CSS évolue. Aucun fichier applicatif modifié, aucun build/test applicatif lancé. Rendu à valider avant intégration et contrôles réels.

## Applicabilité colorée et lignes plus néon

03/11/2026. La demande ajoute une distinction Oui/Non et un effet néon plus présent. Applicable Oui reçoit un fond vert, Non un fond rouge ; À déterminer garde le gris bleuté. Les lignes portent un liseré lumineux plus net de 3 px et une légère teinte selon le niveau : Total vert, Partiel orange, Insuffisant rouge. Les champs de niveau conservent leurs fonds pleins avec des halos plus visibles. Les exclusions gardent un liseré neutre pour distinguer une exclusion d’une insuffisance. Dimensions, densité, données, libellés et JavaScript conservés.

![Applicabilité et niveaux colorés](lignes-light-1440.png)

[Applicable Non en rouge](applicabilite-dark-1440.png) · [Non en clair](applicabilite-light-1440.png) · [Lignes sombres](lignes-dark-1440.png) · [Alertes rouges](alertes-dark-1440.png).

Douze rendus autonomes actualisés, code 0. Les deux vues d’exclusions utilisent les deux véritables mesures exclues du jeu fictif ; aucune valeur n’a été changée pour la capture. Les couleurs des options sont déterminées uniquement en CSS. Aucune application ni API chargée, aucun build/test applicatif, aucune source applicative modifiée. Finitions présentées pour validation avant intégration.

## Mise en œuvre avec fond coloré

03/11/2026. Demande : « mise en ouvre avec couleur remplit ». Le champ de niveau reçoit un fond plein turquoise pour Total, orange pour Partiel, rouge pour Insuffisant et gris bleuté pour Non renseigné. Le texte devient clair, la bordure et le halo gardent la couleur du niveau. Même présentation en clair/sombre et dans la fiche de maquette ; applicabilité et autres champs conservés. Les fonds légèrement foncés et le format validé sont maintenus.

[Remplissage clair](lignes-light-1440.png) · [Rouge en sombre](alertes-dark-1440.png) · [Remplissage sombre](lignes-dark-1440.png).

Dix rendus autonomes actualisés, code 0. Données et script identiques ; seules les couleurs CSS changent. Aucune application ni API chargée, aucun build/test applicatif, aucune source applicative modifiée. Validation du rendu avant intégration.

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

**Prochaine action : validation des finitions de couleurs et de lumière ; ne pas redemander l’accord sur le format en lignes déjà retenu.** Après accord, intégrer la DdA, effectuer les contrôles pertinents et fournir de nouvelles captures réelles, selon la règle visuel → validation → intégration et tests → nouveau visuel réel.

[Synthèse et fiche de référence](../dda-neon-nouveau/README.md) · [Cartes écartées](../dda-mesures-cartes/README.md).
