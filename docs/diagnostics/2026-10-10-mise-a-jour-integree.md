# Diagnostic avant implémentation : mise à jour intégrée

Le dépôt est un monorepo pnpm 10 / Node 24, API Fastify / PostgreSQL 17, interface React / Mantine avec CSP sans scripts ni styles en ligne. La charte Sauge et le socle v2 sont servis dans les images versionnées API et web. `route()` centralise session complète, RBAC, origine, CSRF et validation Zod. Le rôle système `administrateur` peut être attribué directement ou par groupe ; une permission personnalisée d'administration ne doit pas suffire pour installer du code.

La production Compose expose uniquement `web` (Caddy), qui contient également les fichiers React. API et base sont sur des réseaux internes, sans sortie Internet. DATA_DIR contient les données persistantes, les secrets, les certificats et les rapports, hors du dépôt. `mettre-a-jour.sh` vérifie les signatures cosign, sauvegarde obligatoirement, applique les migrations et contrôle la santé ; le retour arrière restaure la base lorsque nécessaire. Ces scripts exigent actuellement une intervention serveur. Le bandeau existant est réservé aux administrateurs et la détection nécessite un cron manuel.

## Choix

Conserver l'API sans socket Docker ni accès Internet. Un exécutant de confiance séparé prend uniquement des demandes authentifiées et auditées, à schéma fermé, déposées par la CLI locale de l'API. Un frontal HTTPS stable, indépendant des conteneurs applicatifs remplacés, sert une page et un état de maintenance depuis DATA_DIR en lecture seule. L'interface versionnée et l'API peuvent donc redémarrer sans couper la maintenance. Aucun pourcentage inventé ; afficher les étapes réellement atteintes.

Le service d'exécution fait partie de Compose et démarre automatiquement ; la clé des sauvegardes de mise à jour sont générés par init, sans remplacer les secrets existants. Les requêtes de mise à jour sont en base et leur journal durable hors base. Une seule opération active, réessais idempotents, contrôle de version disponible et confirmation explicite. Sauvegarde chiffrée avant modification ; échec de sauvegarde ou de signature sans redémarrage. Publication GitHub stable uniquement ; pas de branche, URL, chemin, option shell ou version arbitraire fournis par le navigateur.

## Points à vérifier

Installation normale et reprise d'une installation existante ; compatibilité des commandes serveur et du TLS du lot A ; redirection et état disponibles pendant arrêt API/interface/exécutant ; authentification/MFA/CSRF/rôle réel, détection obsolète, verrou commun avec restauration/sauvegarde ; signatures sur références immuables ; reprise après interruption ; succès seulement après santé, version et contrôle des données ; retour arrière après migration ; disparition du bandeau, interface v2 et mural inclus. Le frontal stable est une infrastructure distincte : son moteur TLS doit être entretenu indépendamment, sans le remplacer au milieu d'une mise à jour applicative.

## Validation locale avant PR

- 203 tests partagés, 180 tests API sur PostgreSQL 17, 102 tests UI et 16 tests web : 501 tests Vitest réussis. Les tests couvrent le rôle système (une permission personnalisée ne suffit pas), CSRF/origine, confirmation, versions obsolètes, idempotence/concurrence et neutralisation des intentions réintroduites par restauration.
- Neuf tests Python de l'exécutant (dans le test API des scripts) : versions stables, signatures par empreinte/identité, verrous, reprise, intervention bloquante et refus d'un contrôle de santé dont les données/documents divergent.
- Cinq scénarios Playwright de la nouvelle fonctionnalité réussis, avec API réelle pour la session et publications simulées pour l'affichage : administrateur/mobile, lecteur sans commande, redirection/reprise, panne de suivi/retour arrière, socle v2. Aucun seuil de capture modifié ni capture régénérée.
- Arrêt physique des conteneurs API et interface : maintenance, JSON, scripts, CSS et police restent accessibles en HTTP 200 ; les API et la santé répondent en HTTP 503 (JSON côté API). TLS vérifié avec la racine de recette.
- Construction, typage et lint réussis ; scripts bash/ShellCheck et configurations Caddy validés. La charte utilise les jetons existants ; la maintenance embarque les variables générées et la police Inter locale.
- Trivy : aucun HIGH/CRITICAL dans le dépôt et les images API, web et updater. L'ajout de cosign 3.1.3 a nécessité les correctifs x/mod 0.40.0 et grpc 1.83.2, compilés avec Go 1.26.9 ; aucune exclusion ni vérification TLS/signature désactivée.

La CI ajoute une recette Docker réelle (publication locale de test) : demande via l'API, migration témoin, sauvegarde chiffrée, remplacement du conteneur exécutant et contrôle d'intégrité ; puis échec injecté après migration et restauration réelle. L'accès à la maintenance est surveillé en parallèle. Cette recette ne simule pas une publication/signature GitHub de production : le contrat cosign est testé séparément et les images officielles seront produites uniquement par le workflow de publication après revue. Les résultats GitHub sur le commit final seront indiqués dans la PR.
