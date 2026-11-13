# Livraison locale : registres et validation depuis la Timeline

11 novembre 2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Sources applicatives : `23b33b5ce4fd4cf5eeee0af97c9638b18852b61a` sur `codex/refonte-neon-main`. Aucun push, fusion, publication d’image ou déploiement.

- Archive : `suivi-audits-neon-lignes-validation-docker-2026-11-11.zip`, 29 589 968 octets, 1337 fichiers.
- SHA-256 : `021edcf454a092bc97a6d4d863a3926946c9e1048d8d94a6427ef890a1a5193a`.
- CRC de tous les fichiers et identité des octets avec les objets du commit Git : réussis.
- Répertoires de données, dépendances installées, `.git`, fichiers de sessions et de secrets exclus. Aucun fichier ajouté depuis les volumes du conteneur.
- La copie des identifiants, de la session et de la clé maître du conteneur a été refusée par le contrôle automatique ; elle n’a pas été exécutée. La livraison a été construite par flux `git archive`, avec sélection des seuls fichiers suivis et vérification de leurs empreintes Git. Aucune comparaison avec les valeurs des secrets du conteneur n’est revendiquée.

Le paquet reprend toutes les intégrations applicatives antérieures et les [nouveaux registres et validations rapides](LIGNES-ET-VALIDATION-RAPIDE.md). Il conserve les sources de construction Docker et six captures HD. Les anciennes maquettes, grandes captures et références CI restent dans le dépôt et sont exclues du paquet pour réduire sa taille.

Vidéo réelle livrée séparément : `neon-lignes-validation.mp4`, H.264, 1600 × 1050, 27,8 secondes. Défilement de liste, ouverture du contexte par sa ligne et résultat KO avec preuve/commentaire depuis un repère, puis couleur actualisée.

## Installation et mise à jour

Extraire dans `suivi-audits-neon-test` et lancer depuis le dossier contenant le Compose :

```powershell
docker compose -p neon-interface-test -f docker-compose.ui-test.yml up -d --build
```

Après remplacement d’une livraison précédente, conserver le même projet et les volumes :

```powershell
docker compose -p neon-interface-test -f docker-compose.ui-test.yml up -d --build --force-recreate api
```

Ouvrir **http://localhost:5174**, sans écran de connexion sur ce profil fictif.

## Contrôles et limites

265 tests web, 243 UI, 31 API, 14 parcours navigateur et quatre analyses Axe ciblées réussis ; compilation, TypeScript, ESLint et Prettier réussis. [Détails des commandes, premières anomalies corrigées et périmètre vérifié](LIGNES-ET-VALIDATION-RAPIDE.md).

Le Docker local réutilise l’image de dépendances existante avec API et frontal compilés, les derniers ajustements du frontal ayant été copiés dans le conteneur par l’API Docker. La construction complète du Compose livré avec ses deux nouveaux conteneurs et Docker Desktop Windows restent à essayer. La recette visuelle humaine, la CI distante, CodeQL et un nouveau scan de l’image ne sont pas réalisés dans cette recette. Les anciennes bases et archives n’ont pas été supprimées.
