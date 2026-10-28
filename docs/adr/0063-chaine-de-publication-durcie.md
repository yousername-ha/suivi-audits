# ADR 0063 — Chaîne de publication durcie (actions par empreinte, Trivy isolé, attestation SBOM vérifiée)

- Statut : acceptée
- Date : 2026-10-26
- Contexte : décisions du RSSI du 26/10/2026 (points 3, 4 et 7). Depuis l'[ADR 0061](0061-mise-a-jour-web-renforcee.md),
  un compte administrateur compromis ne peut installer qu'une version publiée et signée : le risque principal devient une
  **version malveillante correctement signée** par le pipeline lui-même. En mars 2026, l'attaque TeamPCP a redirigé environ
  75 étiquettes de `trivy-action`, toutes celles de `setup-trivy`, et poussé des images Trivy malveillantes sur Docker Hub,
  pour voler les secrets des pipelines (CVE-2026-33634). Le job de publication détenait jusqu'ici, dans une même exécution,
  l'identité de signature (`id-token: write`), l'écriture sur GHCR et un Trivy lancé par étiquette avec `~/.docker` monté.

## Décision

1. **Actions épinglées par empreinte de commit.** Chaque `uses:` des workflows désigne un commit complet, la version en
   commentaire (`@<sha> # v5.1.0`). Le commit retenu est celui que l'étiquette majeure désignait le 26/10/2026 : aucun
   changement de comportement. `scripts/ci/verifier-epinglage.mjs` (testé) fait échouer la CI sur toute action par
   étiquette, branche, empreinte courte, action `docker://` ou outil de sécurité lancé par image à étiquette.
2. **Dependabot** (`.github/dependabot.yml`) propose chaque semaine, en pull request, les nouvelles empreintes des actions
   (regroupées) et les images de base des Dockerfiles. Rien n'est fusionné automatiquement.
3. **Outils de CI par binaire vérifié.** Trivy et gitleaks sont installés depuis leurs publications GitHub officielles par
   `scripts/ci/installer-outils.sh`, qui compare une empreinte SHA-256 figée dans le dépôt et refuse toute différence. Plus
   d'image Docker Hub ou GHCR à étiquette mobile pour ces outils.
4. **Trivy sans secret ni socket.** Il analyse une archive `docker save` (`--input`), jamais le registre ni le démon :
   ni `~/.docker` (jeton de publication) ni `/var/run/docker.sock` ne lui sont exposés, en CI comme en publication.
5. **Publication en trois jobs.** `images` construit et pousse l'image candidate (écriture GHCR, sans identité de
   signature) ; `scan` (lecture seule, jeton effacé avant l'analyse) lance Trivy et produit le SBOM ; `sign`, seul à
   détenir `id-token: write`, signe **l'empreinte analysée** et attache l'attestation SBOM, uniquement après succès du scan.
   La page de version vérifie signature **et** attestation avant d'exposer les étiquettes installables.
6. **Attestation SBOM exigée à l'installation.** L'exécutant (`update-worker.py`) et `mettre-a-jour.sh` vérifient, pour chaque
   image, `cosign verify-attestation --type cyclonedx` avec la même identité exacte que la signature. L'exécutant exige
   aussi que l'attestation désigne l'empreinte installée et contienne un SBOM CycloneDX ; sinon l'installation est refusée
   avant toute maintenance. Le SBOM vérifié est conservé dans `DATA_DIR/etat/sbom/<version>/` et son empreinte inscrite dans
   le reçu ; l'administrateur le télécharge depuis les reçus (téléchargement journalisé, empreinte recontrôlée). Toutes les
   versions publiées depuis 3.0 portent cette attestation.

## Ce qui n'est pas fait

- Les versions de Trivy et gitleaks figées dans `installer-outils.sh` ne sont pas suivies par Dependabot : revue manuelle
  (notes de version, empreinte du fichier `*_checksums.txt`).
- Les images de service de la CI (`postgres:18-alpine`) et de recette (`mcr.microsoft.com/playwright`) restent par étiquette :
  elles ne s'exécutent dans aucun job qui publie ou signe.
- Le contenu du SBOM n'est pas confronté à une base de vulnérabilités sur le serveur (veille à mener depuis le fichier).
- Réglages GitHub hors dépôt, faits par le RSSI le 26/10/2026 : règles d'étiquettes `v*` (création réservée au rôle
  administrateur, ni déplacement ni suppression), protection de `main` (PR obligatoire, sept contrôles verts, fusion
  classique) et environnement `publication` (approbation du RSSI, étiquettes `v*` seulement), exigé par le job
  `sign`. Reste à faire : clé matérielle sur le compte.

## Addendum du 28/10/2026 — images de base épinglées par empreinte

Les images tierces des Dockerfiles (`node`, `caddy`, `golang`, `alpine`) et du compose de production (`postgres` 17 et 18,
`clamav`) sont désignées par `étiquette@sha256:<empreinte>`, l'empreinte étant celle de l'index multi-architecture relevée avec
`docker buildx imagetools inspect`. Dependabot (écosystèmes `docker` sur `/docker` et `docker-compose` sur `/`) propose
chaque semaine la nouvelle empreinte avec la version ; la proposition passe par la CI complète et la relecture du RSSI. Si
l'écosystème `docker-compose` ne couvrait pas un service, la revue reste manuelle à chaque mise à jour de version. Les images
du projet (GHCR) restent désignées par version : la publication les signe et atteste leur nomenclature. Le contrôle
`scripts/tests/conteneurs.test.mjs` refuse une image tierce sans empreinte.
