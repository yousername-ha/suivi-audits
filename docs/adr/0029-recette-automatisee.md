# ADR 0029 — Recette automatisée : serveur, performance, accessibilité (axe-core)

**Statut** : proposée le 12/10/2026, à la demande du RSSI (« automatiser la recette au maximum »). Complète le
[plan de tests](../05_RECETTE/PLAN_DE_TESTS.md) ; ajoute une dépendance de test, ce qui exige cet ADR.

## Contexte

Après la publication de la 3.1.0, 13 cas du registre restent « NON EXÉCUTÉ » : installation sur le serveur
(TEST-041) et reprise hors serveur (TEST-045), ergonomie (TEST-042), performance aux volumes cibles (TEST-043),
référentiels officiels (TEST-044) et huit fonctions encore historiques. Une partie n'est pas automatisable (avis
humain, textes officiels sous licence, fonctions non reprises) ; trois volets le sont.

## Décision

1. **Recette du serveur** : `scripts/recette-serveur.sh`, à lancer sur le serveur après une installation ou une
   mise à jour. Sans compte ni donnée métier : conteneurs, version, migrations, contrôle des données (documents
   chiffrés relus), HTTPS et certificat, en-têtes de sécurité, refus des accès sans session, droits des secrets,
   dernière sauvegarde ; avec `--avec-sauvegarde`, une sauvegarde chiffrée réelle puis `restore.sh --verifier`
   (aucune restauration). Rapport Markdown et JSON sans secret. Le script est aussi exécuté en CI sur la pile
   complète (preuve que le script fonctionne), ce qui **ne vaut pas** recette du serveur réel.
2. **Performance** : `apps/api/test/performance.test.ts`, 10 000 risques fictifs, lectures répétées des écrans qui
   agrègent le registre (carte, liste, registre filtré, tableau de bord) et rafale parallèle. Budgets de recette
   proposés (p95 < 800 ms, rafale de 40 lectures < 3 s), mesurés en CI et publiés en artefact. Ce ne sont pas des
   objectifs de niveau de service : ils détectent une régression nette. Volumes à valider par le RSSI.
3. **Accessibilité** : `tests/e2e/specs/zzzzz-accessibilite.spec.ts` avec **`@axe-core/playwright` 4.13.0**
   (dépendance de développement du paquet `@suivi/e2e`, version exacte, `axe-core` 4.13.0 en dépendance transitive,
   licence MPL-2.0, aucun code embarqué dans les images). 14 écrans, clair et sombre, ordinateur et téléphone, règles
   WCAG 2.0/2.1 A et AA. Toute violation nouvelle fait échouer la CI ; les écarts tolérés sont listés avec leur
   justification, aucune règle n'est désactivée en bloc.
   Les écarts à effet visuel (contrastes, soulignement des liens) sont consignés et reportés tant que le graphisme
   est en cours de refonte (décision du RSSI du 12/10/2026) ; leur correctif a été écrit et validé (commit `e8af11a`).

## Conséquences

- La CI passe de 0 à 3 contrôles automatiques supplémentaires ; durée de la pile complète : environ +1 à 2 minutes.
- Une dépendance de test s'ajoute (`pnpm-lock.yaml`) ; elle n'est ni installée ni exécutée en production.
- **Limites assumées** : un contrôle automatique d'accessibilité ne détecte qu'une partie des défauts (ordre de
  tabulation sensé, lecture au lecteur d'écran, compréhension des libellés) ; TEST-042 (acceptation ergonomique
  humaine) reste ouvert. La performance est mesurée sur un exécuteur partagé, pas sur le matériel du client.
  Le script serveur ne teste ni les parcours métier authentifiés ni une restauration sur une autre machine.
- Retour arrière : supprimer les trois fichiers, l'étape CI et la dépendance ; aucune donnée ni migration.
