# Diagnostic — trois alertes HIGH après le lot A

Branche exclusive : feature/gpt6-evolution-smsi-grc. Aucune fusion ni intervention de production.

La CI du commit 417b2f0 rapporte Drizzle ORM 0.44.7 / CVE-2026-39356 et la bibliothèque Go 1.26.8 du binaire Caddy / CVE-2026-78667, CVE-2026-97031. Les images et le dépôt ont passé le seuil CRITICAL existant ; cela ne corrige pas ces alertes HIGH.

Drizzle est utilisé par le schéma PostgreSQL et les requêtes de documents. Le correctif stable 0.45.2 sera épinglé avec le lockfile, puis vérifié par les tests API, migrations, import et documents. Pas de migration métier ni de modification des données.

L'image officielle Caddy 2.11.7 disponible est compilée avec Go 1.26.8. La version Caddy et ses modules standards sont conservés ; son point d'entrée officiel sera compilé avec Go 1.26.9, vérification des modules Go conservée et téléchargement automatique d'une autre toolchain interdit. Le binaire livré doit indiquer cette version corrigée. Le compilateur reste hors de l'image d'exécution.

Validation : compilation, types et suites existantes ; scan Trivy des deux images réellement reconstruites et du dépôt ; démarrage HTTPS, authentification, documents, SSE, restauration et TLS par la CI complète. Les seuils et vérifications de sécurité ne sont pas abaissés.

Sources vérifiées le 9 octobre 2026 : métadonnées npm de drizzle-orm@0.45.2 ; publication officielle Caddy v2.11.7 (https://github.com/caddyserver/caddy/releases/tag/v2.11.7) et point d'entrée officiel cmd/caddy/main.go ; manifeste de l'image officielle golang:1.26.9-alpine ; rapports Trivy de la CI 37980690444.

## Résultat de la remédiation

Drizzle 0.45.2 est épinglé dans le manifeste et le lockfile. Caddy 2.11.7 et ses modules standards sont compilés avec Go 1.26.9. Le scan de cette compilation a également détecté CVE-2026-78669 dans golang.org/x/net 0.59.0 : la compilation utilise désormais le correctif 0.60.0, avec vérification des modules et sommes Go conservée.

Les deux images reconstruites et le dépôt passent Trivy 0.75.0 avec **zéro HIGH et zéro CRITICAL**, sans suppression ni option ignore-unfixed. Le binaire annonce Go 1.26.9. Les 160 tests API PostgreSQL, la compilation, les types, le lint et le format ont réussi sur la mise à jour Drizzle. La CI bloque désormais les HIGH et CRITICAL pour prévenir la réintroduction de ces alertes ; les rapports complets et SBOM restent produits.

Les builds acceptent un certificat de confiance supplémentaire facultatif par secret BuildKit `build_ca` pour les environnements avec proxy TLS. Ce certificat n'est ni copié dans l'image livrée ni inscrit dans le dépôt. Sans ce secret, les autorités publiques des images officielles restent utilisées. Aucune vérification TLS, signature ou somme n'est désactivée.

La CI complète du correctif `69e6782` est verte : [CI 37984479716](https://github.com/yousername-ha/suivi-audits/actions/runs/37984479716), [CodeQL 37984479823](https://github.com/yousername-ha/suivi-audits/actions/runs/37984479823). Elle inclut les 115 tests Playwright et le guide rejoué sur Ubuntu vierge avec restauration/TLS. Le job de montée de version depuis main est déclaré sans objet parce que la base est une v2 ; il ne valide pas un parcours de mise à jour v3.

La compilation finale garde Caddy comme dépendance du point d'entrée officiel, afin que `caddy version` annonce correctement **v2.11.7**. Les 137 lignes de sa liste de modules correspondent à celles de l'image officielle ; le contrôle de construction confirme Go 1.26.9 et x/net 0.60.0. Le nouveau scan du dépôt et des deux images reste à zéro HIGH/CRITICAL.
