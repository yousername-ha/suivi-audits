> **Mise à jour du 12/11/2026 : proposition validée puis portée.** Voir [l’intégration et sa recette](../../BIBLIOTHEQUE-UNIFIEE-INTEGREE.md). Seule l’ancienne adresse Couverture redirige ; les six autres routes cachées restent directement accessibles pour préserver les parcours métier. Le reste de ce document conserve la proposition historique.

# Bibliothèque de référentiels — couverture réunie

12/11/2026 · **Proposition autonome à valider avant intégration.**
Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Demande : retirer de l’interface les onglets barrés en bleu dans la capture et réunir « Couverture par référentiel », entouré en rouge, dans la bibliothèque. La règle du demandeur reste visuel → validation → intégration/tests → capture intégrée.

## Proposition

Une seule entrée **Bibliothèque de référentiels** dans Conformité et audits, sans la barre de huit onglets. Les six entrées masquées sont :

- Référentiels et exigences ;
- Correspondances entre exigences ;
- Rapprochements à valider ;
- Analyser un service ;
- Applications à intégrer ;
- Correspondances de la bibliothèque.

« Couverture par référentiel » devient un bloc **dans chaque dalle de la bibliothèque**, sans onglet autonome. Le catalogue reste commun à l’organisation ; un sélecteur précise le périmètre auquel appartiennent les états. La version de fiche au catalogue, la version active et les rattachements sont distingués. Un référentiel sans couverture active reste au catalogue, avec un message explicite plutôt que des zéros fictifs.

Chaque dalle montre ses métadonnées, ses états d’évaluation et ses liens aux mesures ; le détail s’ouvre par la dalle, au clavier ou par son bouton. Les commandes internes gardent leur propre action. Les états et les mesures reliées sont deux informations distinctes ; aucun taux de certification n’est inventé. Une clause obligatoire pas encore conforme reste signalée. Les rapprochements non décidés restent exclus des résultats, même lorsque leur onglet est masqué.

Recherche à la demande par petite icône, critère actif visible après fermeture, remise à zéro. Liste à défilement local lorsqu’elle grandit ; fenêtres de détail bornées sans défilement interne aux tailles PC contrôlées. Commandes d’exigences, import, copie, édition et kit IA conservées comme points d’accès de la bibliothèque ; leurs écritures sont seulement illustratives ici.

[Image HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/bibliotheque-unifiee/bibliotheque-clair-hd.png) : une capture native claire **3840×2160**, viewport 1920×1080 à densité 2. [Aperçu autonome](apercu-autonome.html) pour essayer le sombre, le périmètre, la recherche et les détails. Données de recette **fictives**, sans API ni persistance. Les compteurs proviennent des métadonnées du jeu d’export existant (126 exigences ISO/IEC 27001, 31 HDS), pas d’un texte normatif reconstruit.

## Résumé technique pour une IA connaissant le code

Application inchangée depuis le portage Assistant `04a310f` ; HEAD documentaire de départ `f9167a4`. Cette intervention ajoute seulement cette proposition et sa documentation. Les six écrans existent toujours dans le code de l’application à ce stade. Aucun build/test applicatif, schéma, API, droit, migration, ZIP Docker ou archive Assistant modifié.

- `index.html` : une seule destination visible dans le décor autonome ; pas de barre de rubriques. Catalogue et sélection de périmètre dans le même espace.
- `donnees.js` : copie des deux métadonnées de bibliothèque et des résumés de couverture du jeu fictif déjà utilisé. Pas de nouvelles exigences ni de textes protégés.
- `bibliotheque.js` : jointure par `frameworkId === id`, recherche, absence explicite de contexte/couverture, version active distincte, modales, clic/clavier et retour du focus. Actions d’écriture illustratives sans effet ; texte échappé. Aucun appel API.
- `bibliotheque.css` : mise en page locale `bb-*`, états colorés, barres SVG, variantes clair/sombre, régions à défilement propre et dimensions PC. Réutilise trois feuilles de maquette/police locales, sans toucher aux styles de l’application.
- `exporter.py` : assemble styles/scripts/police dans l’HTML autonome. Ne pas copier ses scripts en ligne sous la CSP de l’application.

## Portage futur après validation

La navigation actuelle est décrite dans `apps/web/src/navigation.ts` et `pilotage-navigation.ts`, puis affichée par `components/OngletsRubriques.tsx`. La destination `referentiels` comporte les huit rubriques de la capture. La réduire à la bibliothèque, renommer son libellé visible et privilégier sa route d’entrée, en préservant autant que possible l’identifiant de destination pour les préférences de menu.

La demande porte sur les accès UI **pour le moment**, pas sur une suppression de données/services. Conserver composants/API, droits, évaluations, références, historique et versions. Prévoir la redirection des anciennes adresses vers la bibliothèque regroupée avec le périmètre/contexte pertinent, sans ressusciter les onglets. Adapter les tests de navigation qui imposaient précédemment de tout afficher : les exclusions doivent être explicites et vérifiées, sans supprimer les assertions des autres familles.

**Ne pas supprimer `CorrespondancesBibliotheque.tsx`** en supprimant son onglet : `CriteresFournisseurs.tsx` importe encore son composant `ExtremiteChamps`. Masquer un accès ne doit pas casser une autre rubrique.

Pour réunir le contenu, partir de `pilotage/Bibliotheque.tsx` et `pilotage/Couverture.tsx`, rendus par `pages/Pilotage.tsx` :

- conserver `GET /api/library/frameworks`, les versions et les actions de catalogue existantes ;
- consommer la couverture du périmètre courant via `GET /api/grc/:smsi/couverture`, avec `?frameworkId=...` pour son détail ; jointure par identifiant, jamais uniquement par nom ;
- réutiliser la sélection de périmètre de Pilotage, présentée à l’intérieur de cette page, sans deux sélecteurs concurrents et sans filtrer le catalogue global comme s’il était propre au périmètre ;
- distinguer la version de fiche courante et la version active, notamment en cas de version ancienne ou héritée ; ne pas transformer un chargement/une erreur API en couverture nulle ;
- conserver le détail par exigence, les filtres d’état, l’historique, les évaluations versionnées avec `If-Match`, les justifications d’exclusion et l’interdiction d’exclure une clause obligatoire ;
- conserver `PlanEcarts` et ses gardes, ainsi que les droits de lecture/modification conformité et de validation métier Pilotage. La fusion graphique n’autorise pas une validation supplémentaire ;
- conserver les fonctions de publication locale et leurs données même si l’onglet est masqué, ainsi que les composants partagés. Ne pas agréger des états de plusieurs périmètres en un taux de conformité.

Le formulaire d’évaluation et le registre détaillé ne sont pas reproduits intégralement dans cette maquette ; le portage devra les réutiliser, pas les remplacer par ces fenêtres de métadonnées. Les autres rubriques, la DDA, la cartographie et sa génération, ainsi que l’assistant restent hors de ce lot.

## Contrôles de maquette uniquement

Huit parcours : navigation simplifiée et couverture dans chaque dalle ; catalogue inchangé sans périmètre ; recherche/Échap/critère/remise à zéro ; détail des états et focus ; référentiel non actif gardé au catalogue ; version active distincte ; trente entrées à défilement local ; dalle cliquable/clavier et commandes indépendantes.

Seize dispositions PC dans les deux thèmes : 1024×768, 1280×720, 1366×768, 1440×900, 1536×864, 1920×1080, 2560×1440 et 1920×800. Pas de débordement horizontal de page/liste, liste bornée, détails sans défilement interne dans ces cas. Quatre analyses Axe catalogue/détail clair/sombre sans violation détectée ; pas une certification complète d’accessibilité.

ESLint ciblé et format HTML/CSS/JS réussis ; aucun appel API, ressource distante ni erreur JavaScript dans le contrôle final de l’aperçu autonome. Rendu via HTTP sur boucle locale seulement ; une première ouverture `file://` était bloquée par la politique du navigateur de recette. Les traces ponctuelles restent privées ; résultats et empreintes dans [controles.json](controles.json).

PR #260 consultée : publication 6.3.0 de `claude-suivi-smsi` vers main, HANDOVER partagé modifié ; aucun fichier de cette proposition ni même regroupement identifié dans ses 267 fichiers. Entrées existantes préservées, nouvelle proposition isolée ; aucun changement de cette PR.

**Non exécutés :** build/tests applicatifs, intégration dans la navigation réelle, services/DB, droits serveur, Docker/Windows ou publication. Suite : avis sur ce visuel, puis portage du regroupement autorisé, tests pertinents et capture de l’application intégrée. Le dossier Assistant IA uniquement reste inchangé et séparé.
