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

Toute violation nouvelle fait échouer la CI. Les écarts volontairement tolérés sont listés dans
`ECARTS_CONNUS` du fichier de test, avec leur justification (aucun à ce jour). Le rapport complet de chaque exécution
(`accessibilite.json`) est publié en artefact.

## Contrôles ajoutés depuis la version 3.4.0

Tenu à jour à chaque livraison : ce que chaque évolution a ajouté comme contrôle automatique, et ce qui reste à valider
à la main. Les résultats chiffrés d'une exécution sont dans la CI de la demande de fusion correspondante.

| Évolution | Contrôles automatiques | Reste manuel |
| --- | --- | --- |
| Hiérarchie des périmètres et héritage des référentiels | `packages/shared/test/hierarchie-perimetres.test.ts`, `apps/api/test/perimetres-hierarchie.test.ts` | Lecture de l'arbre et du choix du parent par le RSSI |
| Modules en tables (migrations 022 à 027) | `apps/api/test/reprise-tables-*.test.ts`, `historique-*.test.ts` ; job CI « Montée de version » (dernière version publiée vers la version courante) | Mise à jour réelle sur le serveur du RSSI, avec sauvegarde |
| Couverture par exigence | `packages/shared/test/couverture.test.ts`, `apps/api/test/couverture-exigences.test.ts`, `tests/e2e/specs/zzzzzzzzzzzzzzzz-couverture-exigences.spec.ts` | Justesse métier des états et de la validation |
| Exports de revue de direction (Word, PowerPoint, Excel) | `apps/api/test/export-revue.test.ts` (structure des archives, rubriques vides) | Ouverture dans Word, PowerPoint et Excel sans demande de réparation |
| Exports Excel par rubrique, dont pronostic de l'audit, GAP applications et évaluations fournisseurs | `apps/api/test/export-suivi.test.ts`, `export-suivi-complements.test.ts`, `tests/e2e/specs/zzzzzzzzzzzzzzzzz-exports-excel.spec.ts` | Ouverture dans Excel, lisibilité du mode pro à l'impression |
| Retrait de l'écran `/legacy` | `apps/api/test/suivi-lecture.test.ts`, parcours Playwright adaptés (aucune écriture par l'ancienne route) | Parcours d'un utilisateur habitué à l'ancien outil |

## Ce qui reste manuel

TEST-042 (acceptation ergonomique), TEST-044 (références officielles sous licence), TEST-028 à TEST-038 pour leur
part non reprise, et la recette de bout en bout sur le serveur du RSSI (parcours métier avec de vrais comptes).
