# Lot 1 — intégration contrôlée de la base Sauge

Date : 9 octobre 2026. Branche : `feature/gpt6-evolution-smsi-grc` exclusivement. PR de travail : #12, en brouillon vers main, sans fusion ni publication de version.

## Résultat et conservation

Le ZIP `Suivi_SMSI_refonte_Sauge.zip` (SHA-256 `e01d85d2f20eadd7a641e652e0763ec197541a88b17ab409da1b7977741e2697`) devient la base active du dépôt : 364 fichiers. Le diagnostic initial est conservé.

Les 44 fichiers suivis de la v2 au commit `b148c1ba303954b7023996fce3d0eff2923326b5` sont conservés intégralement dans `archives/v2-source.zip`. Chaque entrée a été comparée au blob Git original. Le manifeste `archives/v2-manifest.json` donne leurs empreintes et l'inventaire des fichiers retirés de la racine active. La v2 reste également dans l'historique Git ; aucune modification n'est faite à main. Les dépendances locales ne font pas partie de l'archive source.

Les anciennes sources CommonJS `app/src`, les pages `app/web`, le Dockerfile v2 et le frontal `caddy/` quittent la racine active, mais ne sont pas perdus : ils sont dans l'archive. La v3 utilise `apps/api`, `apps/web`, `packages/shared`, `packages/ui` et les Dockerfiles de `docker/`. L'outil historique fourni par Sauge reste dans `app/public`, servi sous `/legacy`. Cette intégration reprend les différences fonctionnelles déjà présentes dans le ZIP ; elle ne constitue pas une nouvelle réécriture.

Tous les fichiers applicatifs, migrations, tests, composants graphiques et captures de référence du ZIP sont importés sans transformation de contenu. Les seules adaptations de fichiers du ZIP dans ce lot sont :

- `.dockerignore` : exclure l'archive de conservation des images ;
- `CHANGELOG.md` : préciser le lot, la branche et la conservation de la v2 ;
- `docs/INSTALLATION.md` : distinguer intégration de branche, recette cloud et déploiement de production.

Aucune migration n'a été appliquée à la base v2 de l'environnement. Ses volumes et secrets sont conservés. Les services v2 lancés par l'onboarding ont été arrêtés pour éviter de continuer à servir une base source déplacée. Les tests utilisent un conteneur PostgreSQL distinct et leurs propres bases temporaires.

## Vérifications

Depuis le checkout intégré `/workspace/suivi-audits`, Node 24.19.0 et pnpm 10.34.6 :

- Installation `--frozen-lockfile` réussie ; dépendances et lockfile du ZIP conservés.
- Lint, typage et formatage réussis.
- Build partagé/API/web réussi. Le CSS et le JavaScript compilés portent les mêmes noms d'empreinte que lors du diagnostic sur le ZIP isolé (`index-BVNHOy3h.css`, `index-BNYOU9lL.js`). Les avertissements de taille du bundle et d'annotation zod demeurent non bloquants.
- Vitest : 410 tests réussis sur 21 fichiers (192 shared, 102 UI, 113 API et 3 web), PostgreSQL 17.11 isolé. Les tests de migration v2→v3, import/export, chiffrement, droits, concurrence et cartographie ont été exécutés.
- Archive v2 et manifeste vérifiés après intégration ; comparaison exhaustive des fichiers actifs au ZIP effectuée.
- Contrôle du CHANGELOG réussi ; les 57 blocs Bash du guide d'installation sont correctement extraits par le script CI. Leur exécution complète sur serveur vierge n'est pas revendiquée.

## Recette navigateur cloud

La recette emploie le code compilé du checkout : API Node native, PostgreSQL dédié et Caddy officiel en lecture seule, sans capacités ajoutées, avec TLS interne. Le frontal reprend la configuration Caddy du dépôt ; les ports et la cible upstream sont adaptés dans un fichier local hors Git. L'API utilise les mécanismes normaux de session, CSRF et MFA. Aucun contournement de MFA ou des contrôles de l'application.

La base de recette `suivi_gpt6_e2e` est distincte de la base v2 et des bases temporaires Vitest. Les comptes et documents créés sont les données fictives des tests existants. Le certificat local est vérifié par les requêtes curl ; les tests Playwright conservent leur configuration de certificat interne.

Les essais initiaux ont échoué sur la préparation du frontal local (tmpfs trop petit pour Caddy, puis mauvaise cible upstream). Ces erreurs de configuration ont été corrigées hors dépôt avant relance ; elles ne sont pas des modifications applicatives.

Résultats finaux : **8 scénarios navigateur réussis**. Les sept tests de `parcours.spec.ts` passent (installation, MFA et refus d’un code erroné, dépôt/version de document, simulation et application d’import, SSE/presence entre navigateurs, groupes et rôles, menu mobile). Le test `systeme.spec.ts` passe après injection des métadonnées de déploiement attendues et d’un dossier d’état local. Sa première exécution avait échoué car `DATA_DIR_HOTE` n’était pas renseigné, pas à cause d’une erreur métier.

Pour ce scénario, le chemin affiché `/srv/suivi-audits/donnees` est une métadonnée de déploiement de test ; aucun dossier de production n’a été créé. Les fichiers d’état de recette restent dans `/workspace/onboarding-suivi/v3-runtime/etat`. Les huit réussites proviennent du parcours complet (7 succès, 1 échec de configuration), puis de la relance ciblée du test Système (1 succès). Le navigateur utilisé est Chromium installé sur la machine, avec la configuration Playwright locale ignorée par Git. Les surveillances CSP et erreurs JavaScript des scénarios existants sont conservées.

## Limites et suite

L'intégration ne corrige pas encore les constats du diagnostic : erreurs de déconnexion masquées côté frontend, validation des réponses, atomicité de l'audit ou extension du moteur de référentiels. Ces travaux nécessitent leurs tests ciblés et un diff distinct.

La recette cloud n'est pas une validation des images de production, des signatures cosign, des scanners Trivy/CodeQL, du replay complet du guide ou d'une restauration réelle. Les comparaisons pixel à pixel officielles nécessitent le conteneur Playwright prévu par le dépôt ; le Chromium installé sur la machine ne fournit pas la même référence de rendu. Aucune capture de référence n'est régénérée.

Prochain lot recommandé : reproduire et corriger la déconnexion, avec invalidation serveur vérifiée, gestion des erreurs et purge des caches, sans toucher à la charte graphique.
