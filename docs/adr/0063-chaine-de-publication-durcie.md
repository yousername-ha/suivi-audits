# ADR 0063 — Chaîne de publication durcie (actions par empreinte, Trivy isolé, attestation SBOM vérifiée)

- Statut : acceptée
- **Complétée par** l'[ADR 0102](0102-etiquette-de-version-par-workflow-approuve.md) (étiquette posée par un workflow approuvé par le RSSI).
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

## Complément du 27/10/2026 (audit DevSecOps)

7. **Dépendances npm et quarantaine.** Dependabot suit aussi l'écosystème npm (`pnpm-lock.yaml`) : correctifs et mineures
   regroupés en une pull request, chaque majeure seule (lecture des notes de version et validation du RSSI, ADR 0009).
   Toutes les propositions Dependabot (actions, images, npm) attendent 7 jours après la publication (`cooldown`). Côté
   pnpm (`pnpm-workspace.yaml`) : `minimumReleaseAge` (7 jours), `trustPolicy: no-downgrade` (refus d'une version dont la
   preuve de provenance régresse) et `blockExoticSubdeps` (dépendances transitives du registre seulement). Un correctif de
   sécurité urgent publié depuis moins de 7 jours s'installe en ajoutant le paquet à `minimumReleaseAgeExclude`, dans la PR
   qui le monte, avec la référence de l'avis, puis en l'en retirant une fois le délai écoulé.
8. **Jeton GitHub hors de la copie de travail.** Les checkouts de `ci.yml` et `codeql.yml` utilisent
   `persist-credentials: false` (aucune opération Git authentifiée n'y a lieu) ; aucune expression `${{ }}` n'est interpolée
   dans un script, les valeurs passent par `env`. `release.yml` est inchangé à ce stade : son job `notes` relit
   `origin` (`git fetch`) et la chaîne n'a pas encore été exécutée avec les actions de #130.

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

## Addendum du 28/10/2026 — exceptions du scan des images

Une alerte sans correctif publié peut faire l'objet d'une exception dans `.trivyignore.yaml`, sur décision du RSSI. Chaque
exception cible une bibliothèque précise (adresse de paquet), porte sa justification et expire à une date donnée : passé ce
jour, le scan des images échoue et force le réexamen. Le workflow `veille-caddy.yml` compare chaque jour la version de
Caddy épinglée à la dernière publiée et ouvre une demande quand le correctif existe ou que l'exception approche de son terme.
Il ne modifie aucun fichier. Première exception : go-jose v3 dans Caddy, jusqu'au 27/11/2026 ; go-jose v4 est fixé à 4.1.6
dans `docker/web.Dockerfile`.

## Addendum du 27/11/2026 — prolongation de l'exception go-jose v3

L'exception go-jose v3 (CVE-2026-116587) a expiré le 27/11/2026 : le scan des images a échoué comme prévu. Réexamen du même
jour : Caddy 2.11.9, dernière version publiée, embarque toujours go-jose v3 ; seule la branche de développement de Caddy
l'a retiré (son `go.mod` ne cite plus que go-jose v4). L'exposition est inchangée : déni de service à l'analyse de clés JWK
RSA, sans effet sur la confidentialité ni l'intégrité. Décision du RSSI du 27/11/2026 : prolonger l'exception de 30 jours,
jusqu'au 27/12/2026, ou jusqu'à la sortie d'un Caddy sans go-jose v3 si elle est plus proche ; la veille Caddy reste le
signal de retrait.

## Addendum du 28/10/2026 — images de base épinglées par empreinte

Les images tierces des Dockerfiles (`node`, `caddy`, `golang`, `alpine`) et du compose de production (`postgres` 17 et 18,
`clamav`) sont désignées par `étiquette@sha256:<empreinte>`, l'empreinte étant celle de l'index multi-architecture relevée avec
`docker buildx imagetools inspect`. Dependabot (écosystèmes `docker` sur `/docker` et `docker-compose` sur `/`) propose
chaque semaine la nouvelle empreinte avec la version ; la proposition passe par la CI complète et la relecture du RSSI. Si
l'écosystème `docker-compose` ne couvrait pas un service, la revue reste manuelle à chaque mise à jour de version. Les images
du projet (GHCR) restent désignées par version : la publication les signe et atteste leur nomenclature. Le contrôle
`scripts/tests/conteneurs.test.mjs` refuse une image tierce sans empreinte.

## Addendum du 31/10/2026 — exceptions de l'audit des dépendances

Sur le modèle des exceptions du scan des images, un avis sans correctif adoptable peut être ignoré par `pnpm audit` (CI,
job « Qualité »), sur décision du RSSI. L'exception est déclarée dans `pnpm-workspace.yaml` (`auditConfig.ignoreGhsas`), un
identifiant GHSA par entrée, avec sa justification en commentaire et ici, et une date de réexamen. pnpm ne sait pas faire
expirer une exception : le réexamen est manuel, et l'exception est retirée dans la PR qui adopte le correctif.

Première exception (décision du RSSI du 31/10/2026) : **GHSA-g3hv-75wg-m249**, déni de service dans `minimatch` < 11.0.1
(gravité modérée), par amplification des motifs `{…}`.
- `minimatch` n'est tiré que par ESLint (`eslint`, `@eslint/config-array`, `@typescript-eslint/typescript-estree`), outil
  de développement absent des images publiées. Les motifs qu'il évalue viennent de la configuration ESLint du dépôt, relue en
  PR, jamais d'une saisie extérieure.
- Seule la série 11 est corrigée (11.0.1, publiée le 27/10/2026), sans correctif 10.x ; ESLint 10.14.0 et ses paquets
  exigent `minimatch` ^10. Forcer la 11 imposerait une substitution de version majeure sous ESLint, et `minimumReleaseAge`
  la refuse jusqu'au 03/11/2026.
- Réexamen au plus tard le **30/11/2026**, ou dès qu'ESLint accepte `minimatch` 11 (propositions Dependabot) : monter alors
  les versions et retirer l'exception.

Deuxième exception (décision du RSSI du 17/11/2026) : **GHSA-fc5q-39xc-vjpf**, déni de service par expression régulière
dans `picomatch` ≤ 4.0.7 (gravité élevée), sur des motifs « extglob » répétés.
- `picomatch` n'est tiré que par `typescript-eslint`, Vite et Vitest (par `tinyglobby`), outils de développement et de
  construction : `pnpm audit --prod` ne signale rien, le paquet n'entre pas dans les dépendances d'exécution. Les motifs
  qu'il évalue viennent de la configuration du dépôt, relue en PR, jamais d'une saisie extérieure.
- Aucune version corrigée n'est publiée au 17/11/2026 (la 4.0.7 est la dernière) : il n'y a rien à adopter. Aucun
  remplaçant n'est possible sans changer ces trois outils, eux-mêmes les plus répandus dans leur rôle. L'avis, publié ce
  jour, faisait échouer le job « Qualité ».
- Réexamen au plus tard le 25/11/2026 (décision du RSSI du 18/11/2026) ; l'exception est retirée dans la PR qui adopte la version corrigée.
- **Exception retirée le 20/11/2026** (décision du RSSI du 19/11/2026) : depuis le 19/11/2026, ni `pnpm audit` (rejoué sur une
  copie du dépôt sans aucune exception) ni le registre npm ne signalent plus cet avis pour `picomatch` 4.0.7, restée la
  dernière version ; la raison de ce retrait de l'avis n'a pas été établie. L'exception ne servait donc plus à rien. Si
  l'avis réapparaît, le job « Qualité » échouera de nouveau et la question sera reposée au RSSI.
