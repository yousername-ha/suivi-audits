# Recette automatisée

Complète le [plan de tests](PLAN_DE_TESTS.md) et l'[ADR 0029](../adr/0029-recette-automatisee.md). Trois contrôles
automatiques s'ajoutent aux suites existantes. Aucun ne remplace la recette humaine : ils rendent reproductible ce qui
peut l'être et laissent au RSSI ce qui demande un jugement.

| Contrôle | Où | Cas du registre | Ce qu'il prouve | Ce qu'il ne prouve pas |
| --- | --- | --- | --- | --- |
| `scripts/recette-serveur.sh` | sur le serveur ; aussi en CI sur la pile complète | TEST-041, TEST-045 (en partie) | conteneurs sains, version, migrations, données relues, HTTPS, certificat, en-têtes, accès sans session refusés, droits des secrets, sauvegarde chiffrée réelle puis archive vérifiée | parcours métier authentifiés, restauration sur une autre machine, validation humaine |
| `apps/api/test/performance.test.ts` | CI (Vitest + PostgreSQL) | TEST-043 | temps de réponse des lectures qui agrègent 10 000 risques, rafale de 40 lectures | capacité sur le matériel du client, niveau de service garanti |
| `tests/e2e/specs/zzzzz-accessibilite.spec.ts` | CI (Playwright) | TEST-051 (nouveau) ; prépare TEST-042 | aucune violation WCAG 2.0/2.1 A et AA détectable par axe-core sur 14 écrans, clair et sombre, ordinateur et téléphone | navigation au clavier sensée, lecteur d'écran, compréhension des libellés, ergonomie |

## Recette du serveur : mode d'emploi

À lancer sur le serveur, dans le dossier de l'application, après une installation ou une mise à jour (compte
administrateur du système, aucun compte applicatif) :

```sh
sudo ./scripts/recette-serveur.sh --version 3.1.0
```

Avec la sauvegarde chiffrée réelle et la vérification de son archive (écrit une sauvegarde dans un dossier temporaire,
supprimée ensuite ; laisse un rapport de sauvegarde dans l'état de l'application) :

```sh
sudo BACKUP_PASSPHRASE_FILE=/root/.suivi-backup-pass ./scripts/recette-serveur.sh --version 3.1.0 --avec-sauvegarde
```

Les rapports `recette-AAAAMMJJ-HHMMSS.md` et `.json` (sans secret) sont écrits dans `DATA_DIR/etat/recette/`, ou dans le
dossier donné par `--sortie`. Le code de sortie est 0 si aucun contrôle n'a échoué ; les avertissements (sauvegarde
absente ou ancienne, version attendue non précisée) ne font pas échouer. Joindre le rapport au
[procès-verbal de recette](PV_RECETTE.md). Un contrôle en échec indique le résultat observé ; il ne corrige rien.

## Performance : volumes et budgets

Volume de référence **proposé** : 10 000 risques dans un périmètre (le test existant `grc-frameworks.test.ts` en
vérifie déjà la pagination). Budgets de recette : p95 inférieur à 800 ms par écran (15 mesures), rafale de 40 lectures
simultanées terminée en moins de 3 s. Les mesures de chaque exécution sont publiées en artefact de la CI
(`performance-mesures`). Ces seuils sont des garde-fous contre une régression nette, pas un engagement ; le RSSI
reste libre de fixer d'autres volumes et d'autres seuils (OPT-008).

## Accessibilité : écarts connus

Toute violation nouvelle fait échouer la CI. Les écarts volontairement tolérés sont listés dans `ECARTS_CONNUS` du
fichier de test, avec leur justification. Le premier passage a relevé 53 constats ; ceux qui n'ont pas d'effet visuel
sont corrigés (lien d'accueil nommé sur téléphone, tableaux défilants atteignables au clavier). **Sept écarts visuels
sont reportés** à la demande du RSSI, le graphisme étant en cours de travail dans la branche `legacy` :

| Règle WCAG | Écrans | Cause | Correctif prêt |
| --- | --- | --- | --- |
| contraste du texte (1.4.3) | tableau de bord, cartographie, utilisateurs, système, documents, objectifs | couleurs d'état de Mantine trop claires (badges et boutons pleins, titres d'alertes, boutons légers) ; onglet actif en mode sombre | couleurs assombries dans `packages/ui` (`ETATS`), 166 contrôles de contraste unitaires, voir le commit `e8af11a` |
| lien distinguable sans la couleur (1.4.1) | tableau de bord | lien dans un texte, souligné au survol seulement | souligner les liens en permanence (thème `Anchor`) |

Le rapport complet de chaque exécution (`accessibilite.json`) est écrit dans `tests/e2e/test-results/accessibilite/`.

## Ce qui reste manuel

TEST-042 (acceptation ergonomique), TEST-044 (références officielles sous licence), TEST-028 à TEST-038 pour leur
part non reprise, et la recette de bout en bout sur le serveur du RSSI (parcours métier avec de vrais comptes).
