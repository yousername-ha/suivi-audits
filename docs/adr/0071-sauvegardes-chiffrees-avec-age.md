# ADR 0071 — Sauvegardes chiffrées avec age, avec une clé de secours hors serveur

- Statut : proposée (numéro confirmé par le RSSI le 28/10/2026)
- Date : 2026-10-28
- Contexte : revue de sécurité des sauvegardes (OWASP ASVS 4.0 niveau 2, V6.4 et V8.3 ; CWE-326 et CWE-311 ; ISO 27001:2022 A.8.13 et A.8.24). Les archives étaient chiffrées par `openssl enc -aes-256-cbc -pbkdf2` avec une phrase secrète stockée sur le serveur : (1) CBC n'authentifie pas, une archive modifiée n'était détectée que par l'empreinte `.sha256`, elle-même modifiable à côté ; (2) la phrase secrète, seul moyen de relire les archives, vivait sur le serveur que la sauvegarde doit protéger de la perte ; (3) une archive valide pouvait être renommée ou rejouée à la place d'une autre sans que le contenu le contredise.

## Décision

1. **Format age v1** (`age`, chiffrement authentifié par blocs ChaCha20-Poly1305). Extension `.tar.age`. Toute modification, troncature ou clé inadaptée fait échouer le déchiffrement avant que le moindre octet soit utilisé.
2. **Deux destinataires X25519 par archive** : l'identité du serveur (`BACKUP_KEY_FILE`, défaut `/root/.suivi-backup-key`, fichier régulier 0600) et la ou les **clés publiques de secours** du RSSI (`BACKUP_RECIPIENTS_FILE`, défaut `/root/.suivi-backup-recipients`). La clé privée de secours est générée **hors du serveur** et n'y est jamais copiée : la perte du serveur et de sa clé ne rend plus les archives illisibles.
3. **Chiffrement obligatoire, sans mode en clair.** `backup.sh` contrôle les clés avant de lancer quoi que ce soit (age présent, identité valide et 0600, au moins une clé publique de secours valide, aucune clé privée dans le fichier des destinataires) ; sans elles il s'arrête sans écrire d'archive. L'archive est chiffrée dans un fichier temporaire, déchiffrée à blanc pour vérifier qu'elle se relit, puis seulement renommée ; aucune copie en clair ne reste.
4. **Liaison de l'archive à son nom** : le fichier `INFO` interne porte `fichier`, `date` (horodatage du nom), `horodatage_utc`, `job_id`, `version_application` et `migrations`. `restore.sh` et le vérificateur refusent une archive dont l'INFO ne correspond pas au nom du fichier, à l'horodatage ou à l'identifiant de demande : une archive valide renommée ou substituée est refusée.
5. **`.sha256` conservé** pour détecter une corruption du stockage avant déchiffrement (il ne garantit pas l'authenticité : c'est le rôle du chiffrement authentifié).
6. **Ancien format `.tar.enc`** : restaurable seulement avec `restore.sh --ancien-format` et `BACKUP_PASSPHRASE_FILE`, **pour une version** ; il n'est plus listé dans l'interface web (le catalogue n'accepte que `.tar.age`). Le format est retiré à la version suivante.
7. **Script `scripts/generer-cles-sauvegarde.sh`** : crée la clé du serveur (`age-keygen`, `umask 077`, jamais affichée ni écrasée), explique la génération hors ligne de la clé de secours, n'enregistre la clé publique qu'après confirmation explicite (`ENREGISTRER`, ou `--confirmer` en installation automatique), refuse toute clé privée en entrée.
8. **Compose** : l'exécutant `updater` monte les deux fichiers en lecture seule (syntaxe longue, `create_host_path: false`) : s'ils manquent, le démarrage échoue plutôt que de créer des dossiers à leur place. `init` ne génère plus `update-secrets/backup-pass`. L'image `updater` embarque `age` (`apk add age`) ; l'hôte l'installe avec `apt install age` (prérequis du guide, étape 2.2).
9. **Version majeure** : l'extension, les variables d'environnement et les prérequis changent.

## Conséquences

- **Action avant la mise à jour** : installer `age`, lancer `sudo ./scripts/generer-cles-sauvegarde.sh`, générer la clé de secours hors du serveur et **tester une restauration avec elle**. La sauvegarde de la mise à jour elle-même est faite par la version installée (ancienne phrase secrète) ; sans les clés, la nouvelle version ne démarre pas et le retour arrière automatique rétablit l'ancienne.
- Les rôles sont séparés : le serveur peut sauvegarder sans pouvoir être le seul à relire ; la clé de secours relit sans pouvoir sauvegarder.
- Une clé de secours compromise permet de relire les archives conservées : la renouveler (nouvelle clé publique dans `BACKUP_RECIPIENTS_FILE`) ne protège que les archives futures ; les anciennes restent lisibles par l'ancienne clé.
- `age` n'a pas de politique de rotation des clés intégrée : la rotation est une procédure d'exploitation (documentée dans le guide), non automatisée.
- Dépendance nouvelle : `age` 1.1.x (paquet Ubuntu 24.04 et Alpine), logiciel libre à format stable et spécifié.

## Alternatives écartées

- *openssl AES-256-GCM* : pas d'outil en ligne de commande fiable pour les fichiers volumineux (GCM exige une étiquette finale et le mode flux n'est pas pris en charge par `openssl enc`).
- *GPG* : plus de surface (trousseau, agent, options de compatibilité) pour le même besoin.
- *Phrase secrète age (scrypt)* : garde le défaut majeur de la phrase secrète stockée sur le serveur.
