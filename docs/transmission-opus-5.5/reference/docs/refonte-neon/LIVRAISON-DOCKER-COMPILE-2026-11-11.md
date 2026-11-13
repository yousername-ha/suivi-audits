# Livraison Docker interfaces compilé

11 novembre 2026 — Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

- Sources applicatives du ZIP : `9052a18a21c1c9f0c918c12037faf005a0dc44c0`.
- Archive : `suivi-audits-neon-interfaces-docker-2026-11-11.zip`, 1325 fichiers, 34938393 octets.
- SHA-256 : `f912ba864235e13066050f31b93d24e7efdb5d90f5dee643e8cec2f119ced1b4`.
- Export : `/workspace/exports/suivi-audits-neon-interfaces-docker-2026-11-11.zip`.
- Vidéo native Docker : `/workspace/exports/neon-docker-animation.mp4`, 1600 × 1050, 27,27 s, H.264, plage TV.
- Captures natives de 3840 px dans `docs/refonte-neon/captures/docker-compile/` et dans le ZIP.

Contrôles de l’archive : CRC, absence de doublons et de traversée de chemin, comparaison de toutes les sources applicatives et des fichiers critiques avec le commit, recherche des secrets générés réellement dans la recette Docker : aucun trouvé. Aucune base, dépendance installée, identité locale ou clé n’est livrée. Configuration Compose relue depuis le dossier extrait.

[Guide de lancement](DOCKER-INTERFACES.md) · [Recette Docker, topologie et limites](DOCKER-COMPILE-VERIFIE.md). Le conteneur applicatif a été exécuté contre une base fictive nouvelle sur le PostgreSQL 18 Docker existant du cloud ; la création simultanée des deux nouveaux conteneurs du Compose utilisateur n’y a pas été rejouée. L’essai Windows reste à effectuer. Les validations historiques restent datées séparément.

Aucun push, publication, fusion ou déploiement. L’ancienne archive du profil Vite est conservée ; cette livraison utilise le frontal compilé et corrige la référence de passerelle absente.
