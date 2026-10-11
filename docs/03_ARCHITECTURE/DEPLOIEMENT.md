# Déploiement et versions

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

Source opérationnelle : [INSTALLATION](../INSTALLATION.md), rejouée en CI.
Trois images applicatives : API, web et updater ; gateway réutilise l’image web.
Images PostgreSQL et ClamAV séparées. Release via tag numérique immuable, signatures
cosign et SBOM. Aucun build/release/deploy effectué dans cet audit.

Stable : tag appartenant à main. Exception de développement documentée dans
.github/publication.json : branche feature/gpt6-evolution-smsi-grc, préversion
numérotée et trois images exactes, sans alias stable. v3.0.2 pointe vers fad0205 ;
c704fa6 est une optimisation de CI, pas une nouvelle image signée.

Mise à jour web : administrateur système, confirmation, publication complète,
signature/source exactes, sauvegarde, maintenance, migrations, santé/données,
receipt et retour arrière. Un environnement privé utilise les accès Git/GHCR
serveur existants ; expiration des accès et connectivité peuvent empêcher l’opération.

Une installation construite localement se reconstruit depuis la branche avec
docker-compose.build.yml. Ne pas confondre image locale et release signée.
Une vieille image updater manquant de findutils nécessite une première
reconstruction/redéploiement selon INSTALLATION 12.0.

Variables : SITE_ADDRESS, APP_VERSION, DATA_DIR, CADDY_TLS, GATEWAY_VERSION,
API_IMAGE/WEB_IMAGE/UPDATER_IMAGE si références épinglées, EXPLOITATION_AUTO et
options BACKUP. Valeurs et chemins serveur réels non collectés.
Ne pas remplacer le .env existant par .env.example ni changer DATA_DIR pendant
une mise à jour. Les migrateurs volumes → bind conservent les anciens volumes ;
destruction éventuelle après recette distincte, jamais exécutée dans cet audit.
