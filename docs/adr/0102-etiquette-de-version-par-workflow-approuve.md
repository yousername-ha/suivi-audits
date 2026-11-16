# ADR 0102 — Étiquette de version posée par un workflow déclenché par l'agent et approuvé par le RSSI

- Statut : **acceptée** par le RSSI le 16/11/2026, dans la session (numéro 0102 annoncé et accepté ; approbation d'un clic retenue).
- Date : 2026-11-16
- Rédaction : session « Projet audit_suivi Coeur » (`session_01ES6jrfuR1tD6Az1XDgAnS3`)
- **Modifie** la règle d'AGENTS.md « Aucune étiquette `v*` sans le RSSI » et la procédure de publication de CONTRIBUTING.md :
  l'étiquette reste soumise au RSSI, mais par une approbation dans GitHub au lieu d'une commande `git tag` sur un poste.
- **S'appuie sur** l'[ADR 0063](0063-chaine-de-publication-durcie.md) (chaîne de publication durcie : règles d'étiquettes,
  environnement `publication`, identité de signature exacte) sans en changer la chaîne de signature.

## Contexte

Les versions 7.2.0 et 7.2.1 (15-16/11/2026) ont attendu leur étiquette des heures après une CI verte :

- les sessions de code (Claude Code dans le cloud) poussent par un relais Git qui n'autorise que les branches de travail ;
  la création d'une étiquette et la suppression d'une branche sont refusées (403), sans contournement possible côté session ;
- le RSSI suit souvent le travail depuis un téléphone, où `git tag … && git push` n'est pas praticable.

Le RSSI demande que l'agent puisse lancer la publication lui-même, tout en gardant la main : il a choisi une **approbation
d'un clic** dans GitHub (application mobile ou site), plutôt qu'une publication sans contrôle.

Deux contraintes de l'ADR 0063 encadrent la solution :

1. **Identité de signature.** Les serveurs vérifient chaque image avec l'identité exacte
   `…/.github/workflows/release.yml@refs/tags/vX.Y.Z` (`scripts/update-worker.py`, `scripts/mettre-a-jour.sh`). La publication
   doit donc rester un `release.yml` lancé **sur l'étiquette**, et non un workflow appelé depuis `main`.
2. **Règles d'étiquettes.** La création des étiquettes `v*` est réservée au rôle administrateur (réglage GitHub du 26/10/2026),
   et une étiquette créée avec le jeton intégré de GitHub Actions (`GITHUB_TOKEN`) ne déclenche aucun autre workflow.

## Décision

1. **Un workflow dédié, `.github/workflows/poser-etiquette.yml`**, lancé à la main (`workflow_dispatch`) avec un seul champ :
   la version `X.Y.Z`. L'agent le déclenche par l'API GitHub, comme il relance déjà la CI ; le RSSI peut aussi le lancer depuis
   l'onglet Actions.
2. **Premier job, en lecture seule, qui vérifie avant toute demande d'approbation** et fige le commit :
   - le commit est la tête de `main` au moment du lancement ; son empreinte est retenue et transmise au job suivant ;
   - `.github/publication.json` de ce commit porte exactement la version demandée et le canal `stable` ;
   - le CHANGELOG contient la section `[X.Y.Z]` avec ses notes de mise à jour (`verifier-changelog.mjs --section`) ;
   - les derniers contrôles **CI et CodeQL** de ce commit sont terminés et réussis (même fonction que
     `preparer-publication.mjs`, `verifierControles`) ;
   - l'étiquette `vX.Y.Z` n'existe pas encore.
   Tout écart arrête le workflow avant l'approbation, avec un message clair.
3. **Second job, soumis à l'approbation du RSSI** : il s'exécute dans un nouvel environnement GitHub **`etiquette-version`**,
   protégé par l'approbation du RSSI et limité à la branche `main`. GitHub notifie le RSSI (application mobile, courriel) ;
   l'approbation affiche la version et le commit. Après approbation seulement, le job crée l'étiquette annotée `vX.Y.Z`
   **sur l'empreinte retenue au point 2** (jamais sur une tête de `main` qui aurait avancé entre-temps), puis la pousse.
4. **Jeton de l'étiquette.** L'étiquette est poussée avec un **jeton dédié, stocké comme secret de l'environnement
   `etiquette-version`** et donc lisible seulement après l'approbation : jeton d'accès fin (*fine-grained*) du RSSI ou d'une
   GitHub App, limité à ce dépôt et au droit `contents: write`, avec une date d'expiration. Poussée par ce jeton, l'étiquette
   respecte la règle « création réservée au rôle administrateur » et **déclenche `release.yml` normalement** : la chaîne de
   l'ADR 0063 (images, analyse, approbation `publication`, signature avec l'identité `release.yml@refs/tags/vX.Y.Z`) est
   inchangée.
5. **Deux approbations restent distinctes** : `etiquette-version` (poser l'étiquette) puis `publication` (signer et exposer
   les images, ADR 0063). Le RSSI peut approuver les deux depuis son téléphone. Aucune ne peut être donnée par l'agent.
6. **Règle pour l'agent** (AGENTS.md, à la mise en œuvre) : l'agent ne déclenche `poser-etiquette.yml` que sur demande
   explicite du RSSI dans la conversation (« go version X.Y.Z » ou équivalent), une fois la CI de `main` verte ; il ne crée
   jamais d'étiquette par un autre moyen et ne déplace ni ne supprime jamais une étiquette.

## Réglages GitHub à faire par le RSSI (hors dépôt)

- Créer l'environnement `etiquette-version` : réviseur requis = le RSSI ; branches de déploiement = `main` seulement.
- Créer le jeton dédié (point 4) et l'enregistrer comme secret de cet environnement (nom proposé : `ETIQUETTE_VERSION_JETON`).
- Vérifier que les règles d'étiquettes `v*` admettent l'identité de ce jeton (rôle administrateur, ou la GitHub App en
  contournement si une App est retenue).

## Ce qui n'est pas fait dans cette ADR

- Le workflow lui-même, son test (script de vérification du premier job) et la mise à jour d'AGENTS.md et de CONTRIBUTING.md :
  livrés dans une PR suivante, après relecture de cette ADR.
- Aucune étiquette de développement (`development`) : ce workflow ne publie que le canal `stable` depuis `main`.

## Conséquences

- Plus de commande à taper pour publier : l'agent prépare et lance, le RSSI approuve d'un clic, deux fois.
- Le contrôle « CI et CodeQL verts sur le commit exact » a lieu avant même la demande d'approbation : une étiquette posée trop
  tôt (cas de la 7.1.1) ou sur un commit sans CI verte (cas de la 7.2.0) n'est plus possible par ce chemin.
- Un secret de plus à gérer (expiration et rotation du jeton), exposé seulement après approbation.
- La création manuelle d'une étiquette par le RSSI reste possible ; elle suit alors les contrôles déjà présents dans
  `release.yml`.
