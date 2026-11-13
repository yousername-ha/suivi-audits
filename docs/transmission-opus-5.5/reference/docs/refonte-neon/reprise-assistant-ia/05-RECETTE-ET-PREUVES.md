# Recette à reprendre et preuves historiques

## Preuves déjà obtenues, non rejouées pour fabriquer ce dossier

Référence frontend `04a310f` : 287 tests web (dont les huit de l’assistant), 246 UI, TypeScript web/E2E, lint/format ciblés et build Vite réussis. Dix parcours Assistant du frontend compilé à API fictive interceptée ; sept Fournisseurs avaient aussi été rejoués en non-régression du cadre global. Ces derniers ne constituent pas un module à livrer dans ce paquet.

Seize dispositions PC clair/sombre (1024×768, 1280×720, 1366×768, 1440×900, 1536×864, 1920×1080, 2560×1440 et 1920×800), plus taille d’affichage 150 %. Cinq analyses Axe Assistant sans violation détectée dans les écrans contrôlés, sans certification exhaustive. Une capture du frontend compilé à 3840×2160, avec données fictives et API interceptée.

Les reçus et rapports exacts sont dans `references/`. Le conditionnement du présent dossier vérifie fichiers, patches et archive ; il ne transforme pas ces résultats historiques en tests exécutés sur la branche cible.

## Tests fournis et prérequis

Le test unitaire `tests/apps/web/test/assistant-global.test.ts` est inclus dans le patch des nouveaux fichiers. L’exécuter dans le dépôt hôte, avec ses dépendances Vitest et les fonctions de `contrats.ts` conservées.

`references/tests-e2e/` contient les sources originales des dix scénarios Assistant et leur jeu fictif, pour lecture/adaptation. **Ce sous-dossier n’est pas une suite autonome à copier aveuglément.** Dans leur environnement de validation, ces tests importent `tests/e2e/interface/fournisseurs-fixture.ts`, lisent `fixtures/fournisseurs-studio.json` et ouvrent la page Fournisseurs comme arrière-plan. Ces deux dépendances de présentation, la configuration Playwright et les modules d’arrière-plan ne sont pas embarqués dans ce paquet Assistant uniquement.

Pour la branche backend assistant, remplacer ce support par les fixtures/pages déjà disponibles dans le dépôt cible, sans importer le module Fournisseurs pour faire passer un test. Conserver les assertions sur les permissions, le corps des requêtes, les brouillons et la continuité ; ne pas les réduire pour obtenir un résultat vert. En environnement de frontend intercepté, bloquer les vrais appels Mistral et les notifications sortantes.

## Parcours à valider sur l’intégration cible

1. Ouverture/réduction/agrandissement, retour du focus, Échap et conversation/brouillon conservés entre rubriques ; contexte joint figé alors que le nom de la page courante change.
2. Séparation Mise en œuvre/Audit interne : fils, historique, brouillons et réponse asynchrone rattachés au profil réel, sans mélange après une navigation.
3. Envoi strict `{texte}`, CSRF, 4000 caractères contexte inclus, erreur conservant la saisie, attente par relecture serveur sans fausse réponse locale.
4. Pause des rondes laissant le chat disponible, quota réel distinct, indisponibilité, profil sans périmètre, service absent/refusé sans simulation.
5. Question personnelle : réponse 2000 caractères, échec conservant le texte, état commun fil/boîte, destinataire autorisé sans droit de discussion, reprise annoncée à une prochaine ronde.
6. Rappel : lecture, avis utile/inutile, compteur dérivé des états, pas d’ouverture forcée ou de vol de focus à la réception.
7. Proposition : correction, confirmation/rejet, refus sans droit, pas de création avant confirmation ; constat en brouillon, nature et avertissement sur source issue de l’assistant conservés.
8. Mission : `{profil,consigne}`, 2000 caractères, prochaine ronde sans date/heure de rappel inventée, erreur conservant le texte.
9. Sources : métadonnées du serveur et accès au périmètre autorisé ; pas de citation/page de PDF fabriquée, pas de HTML de message exécuté.
10. Historique et nouvelle discussion, suppression confirmée, `/admin/*` gardant le même cadre et son refus sans droit ; déconnexion/change d’identité purgeant les données privées.

Vérifier également les huit tailles PC dans les deux thèmes : dock/compositeur bornés, listes longues à défilement propre, lisibilité et taille 150 %, cartographie inchangée, autres dialogues prioritaires, pause/mouvement réduit. Réaliser une capture réelle du résultat intégré.

## Commandes indicatives dans le dépôt hôte

Utiliser sa version de Node et ses scripts, sans copier de dépendances depuis le paquet. La référence utilise Node 26, React/Mantine, TanStack Query et React Router.

```bash
pnpm --filter @suivi/web typecheck
pnpm --filter @suivi/web test
pnpm --filter @suivi/ui test
pnpm --filter @suivi/web build
```

Adapter le lint et les tests Playwright aux chemins intégrés. Une recette du vrai backend exige une pile de test isolée, des comptes/périmètres de test et la configuration Mistral déjà prévue par le dépôt. Les contrôles API/DB, conversations Mistral, rondes/notifications réelles, extraction documentaire et essai Docker Windows restent **à exécuter** : ils ne sont pas attestés par ce dossier.
