# Nettoyage du dépôt — 11 octobre 2026

Référence avant nettoyage : `7cc35dc00b2d936c1195ed4f9ff04acbf74f56c9`.
Branche exclusive : `feature/gpt6-evolution-smsi-grc` ; application 3.0.2.
Intervention demandée par l’utilisateur ; aucun changement de fonction métier.

## Inventaire et critères

592 fichiers suivis, 30 657 846 octets avant nettoyage. Aucun fichier strictement
identique à un autre n’a été trouvé dans cette révision. La recherche porte sur
les sources suivies, la configuration, les imports, les scripts, les tests et
la documentation. L’absence d’un nom littéral seule ne prouve pas l’inutilité :
les variantes de maquette et les scripts historiques encore utiles sont conservés.

## Éléments retirés

| Ancien chemin                             | Motif et vérifications                                                                                                                                                                                                                          |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/cartographie/PROMPT-CLAUDE-CODE.md` | Prompt des chantiers de cartographie/exploitation déjà livrés ; demandait de reconstituer des branches et un ordre de fusion anciens. Sa seule référence active était le guide cartographique, remplacé par des liens vers la reprise actuelle. |
| `docs/refonte-ui/verification.json`       | Rapport ponctuel de la refonte initiale, sans lecteur dans l’application, les scripts, les tests ou la documentation. Les résultats actuels restent dans les preuves de recette ; galerie et captures historiques conservées.                   |

Ces deux fichiers représentent 10 288 octets. Leur contenu demeure récupérable
avec Git au commit de référence ci-dessus ; l’historique n’est pas réécrit.

## Simplifications et renvois

- `CLAUDE.md` devient un point d’entrée vers AGENTS/HANDOVER/DAT/CONTRIBUTING.
  Règles encore valides conservées, descriptions de déploiement anciennes retirées.
- `.prettierignore` et ESLint : suppression des exclusions de `scripts/carto/`,
  dossier absent et remplacé par les références documentaires conservées.
- Guide cartographique : retrait des anciennes consignes de réalisation/fusion,
  renvoi vers les sources et la recette actuelles.
- Contrat bêta : chemin du script corrigé ; intervention sur une copie locale,
  pas sur le fichier en service.
- Maquette : mention claire du caractère historique et retrait de la référence
  à un `index.html` absent. Les propositions React Flow/ELK ne décrivent pas
  l’implémentation native SVG React.
- Consignes, journal, backlog et vérificateur documentaire actualisés.

## Éléments conservés sur preuve d’usage

- Archive v2, manifeste, application legacy et cinq bibliothèques ; préservation
  requise pendant les reprises encore incomplètes.
- `reference-beta-legacy/carto.js`, lu par les tests de parité partagés.
- Scripts/contrat/captures historiques de la cartographie, utiles à sa comparaison.
- Maquette JSON et TypeScript : comparaison native sous Node 24 ; les données
  ne sont pas identiques, donc aucune assimilation à des doublons supprimables.
- Galerie Sauge et toutes ses images référencées ; captures Playwright actuelles
  consommées par les comparaisons visuelles.
- Dockerfiles, Caddyfiles et scripts de sauvegarde/mise à jour : usages runtime,
  construction, test ou procédure documentée identifiés. Le Caddyfile autonome
  demeure chargé par le démarrage web quand WEB_INTERNAL n’est pas actif.
- Migrations publiées, ADR et diagnostics datés : contrats et traçabilité.

## Vérifications et limites

Un premier essai de comparaison TS/JSON avec `node --import tsx` depuis la racine
échoue (code 1) : tsx est une dépendance de l’API, pas de la racine. L’essai natif
Node 24 passe (code 0) sans installer de dépendance ; les trois comparaisons
retournent « différent ». Cela justifie la conservation des variantes.

Les premières commandes `pnpm lint`, `pnpm format:check` et `pnpm typecheck`
retournent 1 avant les contrôles : le pnpm fourni par le workspace (11.19.0)
tente de vérifier/réinstaller les dépendances dans un dossier de stockage absent.
Les mêmes scripts passent avec `--config.verify-deps-before-run=false`, en
utilisant les dépendances présentes. Le dépôt reste épinglé à pnpm 10.34.6 et
la CI utilise cette version ; aucun manifeste ni lockfile n’est changé.

La CI du commit documentaire 7cc35dc a échoué : 245/246 tests API passent, le
protocole de retour arrière simulé échoue dans `operations-scripts.test.ts`
(`test_failed_restore_rolls_back_without_replaying_target`, état intervention
au lieu de retour_arriere_termine). Qualité, guide d’installation et CodeQL
passent ; les jobs aval sont ignorés. Les sources applicatives n’ayant pas changé,
la cause n’est pas attribuée au nettoyage et reste à confirmer. Les logs bruts
restent privés hors Git. [Run concerné](https://github.com/yousername-ha/suivi-audits/actions/runs/38093984247).

Les contrôles finaux et leurs codes sont consignés dans
[le reçu de nettoyage](../../05_RECETTE/preuves/2026-10-11-nettoyage.json).
Le vérificateur documentaire est étendu aux documents touchés par ce nettoyage.
Les suites API, recettes Docker et tests destructifs ne sont pas exécutés
localement. Les workflows de la PR assurent les contrôles isolés complémentaires.

Ce nettoyage concerne les fichiers de la branche de travail. Il ne supprime
ni branche distante, ni tag, ni artefact, ni journal GitHub et ne réduit pas
rétroactivement le stockage de l’historique. Aucun gain de minutes CI n’est
attribué à ces suppressions. Main et la visibilité privée sont préservées.

Les 15 tests isolés du protocole d’exploitation passent localement ; cet échec CI
précédent n’est pas reproduit dans cette exécution. La cause n’est pas déclarée
corrigée. Avec les 222 tests partagés et les 17 tests web, le nettoyage dispose
de **254 tests locaux passés**, zéro échec final de suite locale. Les 405 fichiers
protégés sont identiques par SHA-256, après compilation également. Lint, format,
typage, compilation et cohérence documentaire passent.

Le contrôle Prettier forcé initial incluant le CHANGELOG historique a retourné 1.
Le projet ignore volontairement ce fichier et ses sections publiées restent
identiques. Le contrôle standard passe ; le contrôle explicite des 16 autres
fichiers formatables passe. Cet essai est conservé dans le reçu. Gitleaks :
aucun secret trouvé dans les 18 fichiers ajoutés/modifiés analysés ; scope local
uniquement, sans réécriture d’historique.
