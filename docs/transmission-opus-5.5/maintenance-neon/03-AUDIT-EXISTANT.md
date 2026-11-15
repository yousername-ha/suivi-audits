# Audit ciblé — maintenance Neon

Observation GitHub en lecture seule, 15 novembre 2026 UTC. Aucun test applicatif exécuté, aucun dépôt ni compte GitHub modifié ; aucun fichier d'exploitation, jeton ou journal privé réel consulté. Les chemins ci-dessous désignent les sources du dépôt `yousername-ha/suivi-audits`.

## 1. Révisions réellement observées

| Référence | SHA observé | Interprétation |
| --- | --- | --- |
| `claude/refonte-neon` | `28d48cacc3995200359fd4854286584a89d8b34f` | Branche active d'implémentation Neon. Dernier commit : 14/11/2026 21:54:31 UTC, captures de référence de recherche acceptées. |
| `claude-suivi-smsi` | `8ff37b62fa5645368158d7c3b3c37ef40a177d65` | Autre branche de travail actuelle, comparée sur le périmètre maintenance. |
| `codex/transmission-neon-opus-5-5` | `fb1ca1448479c370bd3fcb112b824e9471ee5b61` | Branche du dossier de transmission, différente de l'implémentation active. |
| `codex/refonte-neon-main` | `f37db87b8c45e866ecb2a86d64d46465aa847c55` | Ancienne référence Neon. |
| `design/refonte-maquettes` | `0846ec053000237502075d67314f29006e6ca185` | Référence de maquettes. |
| `main` | `5d03b21d707617abc42e2e75f7d948d03949a867` | Branche principale. |

Aucune PR ouverte au contrôle. Ce constat est une photographie, pas une instruction de sélectionner aveuglément une branche : l'IA qui implémente doit refaire `git status`, vérifier sa branche, ses instructions locales et les fichiers existants avant toute modification.

Les 16 fichiers ci-dessous sont **strictement identiques octet par octet** entre `claude/refonte-neon@28d48ca` et `claude-suivi-smsi@8ff37b6` :

- `docker/maintenance/index.html`, `maintenance.css`, `maintenance.js`, `client.js`
- `docker/Caddyfile.gateway`
- `scripts/update-worker.py`, `scripts/mettre-a-jour.sh`
- `apps/api/src/updates.ts`, `apps/api/src/routes/updates.ts`, `apps/api/src/log.ts`
- `packages/shared/src/updates.ts`
- `apps/web/src/components/Updates.tsx`
- `tests/e2e/specs/zy-updates.spec.ts`
- `apps/api/test/updates.test.ts`, `apps/api/test/update-scripts.test.ts`
- `scripts/tests/test_updates.py`

Les copies de lecture de la branche Neon sont dans `annexes/existant-2026-11-15/`. La seconde copie équivalente de la branche de travail n’est pas dupliquée. [Les métadonnées GitHub](annexes/SOURCES-GITHUB-AUDITEES.json) contiennent référence, chemin, SHA de blob et taille de chaque fichier comparé. Ces instantanés sont des preuves de lecture, jamais des fichiers à recopier sur l’application actuelle. Les fichiers complémentaires `routes/admin.ts`, `journal-technique.ts`, son test et `docker-compose.yml` ont été lus sur `28d48ca` uniquement.

## 2. État réel, distinct des nouvelles maquettes

La maintenance en production dans ces sources est encore une page autonome simple. La nouvelle grande dalle Neon, les animations distinctes par étape et les lignes techniques flottantes ne sont pas présentes dans `docker/maintenance`.

L'écran réel est servi par le frontal stable et continue de fonctionner sans React, API applicative ni PostgreSQL. Préserver cette autonomie. L'updater est un composant privilégié **sans port ni API HTTP** (`docker-compose.yml:215`). Le navigateur ne doit pas avoir accès à Docker ou au répertoire de reprise pour afficher des effets.

La nouvelle maquette doit remplacer l'habillage en raccordant les états existants. Les fixtures JavaScript de la proposition visuelle ne constituent pas une API réelle et ne doivent pas produire de faux journaux ou faux succès en production.

## 3. Contrats et routes présents

### État public de maintenance

`GET /update/status.json` est servi directement par Caddy depuis `/updates/status.json` avec `Cache-Control: no-store` (`docker/Caddyfile.gateway:57`). Les assets `/update/*` sont autonomes, avec une CSP `script-src 'self'`, `style-src 'self'`, `connect-src 'self'` et `frame-ancestors 'none'`.

Le schéma partagé dans `packages/shared/src/updates.ts` expose notamment :

- `id`, `target`, `status`, `phase`, `message` court ;
- `startedAt`, `updatedAt`, `finishedAt` ;
- `maintenance` ;
- `etapes: [{ phase, at }]`, au plus 30 entrées ;
- les renseignements de version/détection et de préparation existants.

Les états `status` sont `idle`, `queued`, `running`, `success`, `rolled_back`, `failed`, `intervention`. Les phases comprennent `idle`, `checking`, `preparing`, `backup`, `installing`, `verifying`, `rollback`, `complete`.

**Absents du schéma actuel** : pourcentage réel, nombre d'octets transférés, total d'octets, débit, ETA et lignes de log technique. La frise `etapes` contient l'heure d'entrée dans une phase : ce n'est ni un journal, ni la preuve que cette phase s'est terminée avec succès.

### API de mise à jour

| Route présente dans `apps/api/src/routes/updates.ts` | Accès et fonction |
| --- | --- |
| `GET /api/updates` | Compte authentifié ; état d'information. |
| `POST /api/admin/updates/check` | Permission d'administration ; recherche de publication. |
| `POST /api/admin/updates/install` | Administration système, confirmation exacte, MFA fraîche, limites d'essais, fenêtre de maintenance, audit et idempotence. |
| `GET /api/admin/updates/receipts` | Reçus privés pour l'administrateur. |
| `GET /api/admin/updates/receipts/:id` | Téléchargement privé, audité, `no-store`. |
| `GET /api/admin/updates/receipts/:id/sbom/:composant` | SBOM vérifié associé au reçu, privé, `no-store`. |

**Pas de route de journal de mise à jour ni SSE de mise à jour dans ce fichier. Pas de route `/update/logs` dans Caddy.** Ne pas documenter un futur endpoint comme s'il était déjà fourni.

### Journal technique général déjà présent

`apps/api/src/routes/admin.ts:250` fournit `GET /api/admin/journaux-techniques` : permission `administration:lire`, filtre de niveau minimal, recherche `q`, curseur `avant`, limite au plus 5 000. Le résultat JSON expose `{ etat, entrees, reste }`. `format=ndjson&export=1` requiert aussi `administration:exporter`, produit un téléchargement chronologique audité et sans cache. `PUT /api/admin/journaux-techniques/niveau` exige `administration:administrer` et une confirmation `APPLIQUER` ; `debug` est temporaire.

Ce journal est un tampon **en mémoire** de l'API (`apps/api/src/log.ts`, capacité 5 000 ; `apps/api/src/journal-technique.ts`). Il ne représente pas le stdout privé du script d'installation, ne fournit pas de stream SSE existant et disparaît du parcours accessible quand l'API est arrêtée. Son existence ne résout donc pas le journal live de maintenance autonome.

## 4. Invariants de cycle à préserver

Le comportement de `docker/maintenance/maintenance.js` doit rester fonctionnel sous le nouvel habillage :

1. Lecture d'état toutes les **2,5 secondes**, timeout de **8 secondes**, sans cache. Une erreur de connexion affiche une information d'attente et garde le polling actif.
2. `demande` dans l'URL est un UUID de l'opération suivie. L'écran attend l'état du bon `id` jusqu'à **2 minutes**, sans réutiliser la frise ou le résultat d'une opération précédente. Les données de journal devront respecter le même périmètre d'opération.
3. `next` reste une destination **same-origin**, de chemin absolu valide, hors `/update`. Rejeter protocol-relative, origine externe et contournements par barres obliques inverses ou normalisation.
4. Une opération `queued/running` récente (`updatedAt` de moins de 2 minutes) est active. Les états terminaux restent distingués ; une perte de connexion ne fabrique jamais un succès.
5. Le délai long est signalé après **10 minutes**. Ce n'est pas un échec automatique.
6. `etapes` et le temps écoulé restent réels ; figer le temps final sur `finishedAt` quand il existe.
7. Aucun retour à l'application tant que `maintenance` est vrai, que l'opération est encore active ou attendue, ou que l'état est `intervention`.
8. Après libération de maintenance, vérifier réellement **`GET /healthz`**, timeout de 5 secondes, statut HTTP réussi et corps trimé exactement **`ok`**. Le healthcheck Docker du gateway prouve seulement que Caddy répond, pas que l'application est opérationnelle.
9. Succès et santé réelle permettent le retour automatique via `location.replace`. Échec/retour arrière conservent le diagnostic ; le retour reste manuel et seulement après santé réelle. `intervention` ne retourne jamais automatiquement.
10. Ne pas confondre phase `complete` et résultat `success`. Le script peut annoncer sa phase finale avant les derniers contrôles de l'updater. Le reçu appartient à l'opération réellement suivie et au bon état terminal.

Le flag `/updates/maintenance` déclenche l'interception Caddy : HTML GET/HEAD redirigé vers `/update/`, autres requêtes applicatives en JSON 503. Les exceptions sont `/update/*` et `/healthz` (`docker/Caddyfile.gateway`). Un futur flux privé placé ailleurs serait intercepté tant qu'une exception explicite et contrôlée n'est pas implémentée.

## 5. Phases réelles et animation honnête

`scripts/update-worker.py:31` mappe les étapes du script : `controles/notes → preparing`, `sauvegarde → backup`, `images/demarrage → installing`, `sante → verifying`, `termine → complete`.

Le worker publie `preparing` puis tire/vérifie les images et signatures ; il n'active la maintenance qu'avant la sauvegarde (`update-worker.py:467–471`). Le script possède encore un `dc pull --quiet` (`scripts/mettre-a-jour.sh:380`) en phase d'installation. Il n'existe donc pas de phase publique exclusivement consacrée au téléchargement, ni de progression de téléchargement précise.

L'animation de téléchargement peut être **indéterminée** avec une mention cohérente « préparation / téléchargement et vérifications ». Une barre chiffrée exige une nouvelle collecte réelle et un contrat étendu testé. Ne pas transformer les cinq phases en faux pourcentages 20/40/60/80/100. Les cubes, scanner et orbites sont une traduction visuelle de la phase ; le résultat final est piloté par `status` et les contrôles de santé.

## 6. Ce qui existe réellement pour les logs du worker

`scripts/update-worker.py:92` crée `${DATA_DIR}/reprise-updates` avec des droits **0700**. `status.json` est une publication publique distincte en 0644. Le fichier privé par opération est `${DATA_DIR}/reprise-updates/<jobId>.log` (`update-worker.py:477`). Le sous-processus de `mettre-a-jour.sh` écrit stdout et stderr dans ce fichier (`:484`). Ce fichier n'est pas monté dans le gateway.

La fonction `run()` du worker ne journalise délibérément pas les sorties stdout/stderr des commandes initiales (`:143`) : elles peuvent contenir des données sensibles. Des étapes de préparation, vérification de signature et récupération d'image sont donc absentes du `.log` du sous-processus. De plus, des commandes du script sont silencieuses (`pull --quiet`). **Le fichier privé actuel n'est pas « tous les logs possibles ».** Ne pas promettre l'exhaustivité sans instrumentation explicite.

Les reçus sont des synthèses structurées conçues sans sortie brute de commandes. Ne pas recycler `message`, `etapes`, les reçus ou `status.json` pour y ajouter un journal privé.

Pino censure des champs structurés (`cookie`, `authorization`, CSRF, mots de passe, tokens, clés, codes…), mais cette censure ne s'applique pas automatiquement à du texte libre de shell, à un bloc PEM ou à un secret incorporé dans une URL/erreur multiligne. Aucun test de sanitizer de journal de mise à jour n'est présent dans les fichiers inspectés.

## 7. Dépendances du véritable journal admin durant l'arrêt API

Ces points sont des **travaux d'implémentation à concevoir et vérifier**, pas des fonctionnalités constatées :

- Collecter les événements disponibles du worker et du script avec `jobId`, identifiant/cursor croissant, date, source, niveau et texte. Conserver la continuation à travers reconnexion et remplacement de l'updater ; éviter doublons et mélange de deux jobs.
- Expurger **côté serveur avant toute publication** : secrets structurés et texte libre/multiligne, cookies, Authorization, URL d'identifiants, clés et valeurs sensibles. Le navigateur ne doit jamais recevoir la version brute. Échapper le texte dans le DOM (`textContent`) et contrôler les séquences terminales.
- Concevoir un transport privé servi par un composant restant disponible pendant l'arrêt/remplacement de l'API. Le service `updater` actuel n'expose aucun HTTP et possède Docker ; ne pas lui ouvrir un endpoint public improvisé. Le frontal `gateway` a seulement le montage public `/etat/updates:/updates:ro` et ne connaît pas le répertoire privé.
- Définir une autorisation administrateur à durée et périmètre limités, indépendante d'une requête à l'API/DB au moment de chaque lecture de maintenance. Ne pas supposer qu'un cookie de session sera vérifiable hors API. Éviter tout secret durable dans l'URL, l'historique ou le journal. Conserver les restrictions de rôle/MFA existantes pour le lancement de mise à jour.
- Définir expiration, révocation, rafraîchissement/reconnexion, absence d'autorisation pour un simple visiteur de `/update/`, débit/taille maximum, rétention et traçabilité des accès. Un échec de permission/log doit laisser le suivi public et le mécanisme de mise à jour fonctionner.
- Adapter au besoin Compose, montages, routage Caddy et CSP selon ce transport. Une route SSE future doit fonctionner sans tamponnage indéfini, rester same-origin et ne pas dépendre d'un proxy arrêté. Caddy actuel exclut déjà `text/event-stream` des types compressés et utilise `flush_interval -1` sur son proxy principal ; cela n'ajoute pas un serveur SSE.
- Garder un historique consultable/téléchargeable pour le compte autorisé : le fondu visuel des lignes n'est pas une politique de suppression. Ne jamais afficher des lignes fictives pour remplir un silence.
- Classer les erreurs par sévérité structurée et, en dernier recours, préfixe non ambigu ; le flux `stderr` seul ne veut pas dire erreur. « 0 erreurs », « no error » ou une commande contenant le mot `error` ne doivent pas devenir rouges arbitrairement.

L'option minimale honnête en l'absence de ce backend est de livrer d'abord l'écran public réel, puis un état « journal technique indisponible/non autorisé », sans injecter de journal factice ni rendre le répertoire privé public.

## 8. Vérifications existantes à préserver, lues mais non exécutées

- `tests/e2e/specs/zy-updates.spec.ts` : lancement confirmé, lecteur sans commande, réessai, attente du bon `demande`, interruption/santé réelle, retour arrière visible, `next` sûr, MFA/fenêtre/reçu, frise/temps et absence de bannière login.
- `apps/api/test/updates.test.ts` : frontière admin système/permissions, CSRF/origine/schéma fermé, idempotence, job unique, rôle revalidé, MFA non rejouable, créneau, reçus et SBOM.
- `scripts/tests/test_updates.py` : aucune écriture de secret dans état public, stockage privé, interruption/reprise, véritable santé après remplacement de l'updater, signatures/attestations avant maintenance, verrou, distinction santé/intégrité, frise horodatée, reçu sans données sensibles.
- `apps/api/test/update-scripts.test.ts` appelle les vérifications de l'exécutant.
- `apps/api/test/journaux-techniques.test.ts` couvre permissions, niveaux temporaires, censure structurée, pagination et export audité du journal API général. Ces tests ne couvrent pas le futur flux autonome de logs de mise à jour.

À ajouter lors de la réalisation du journal : secrets répartis sur plusieurs fragments/lignes, téléchargement refusé aux non-admins, expiration/reconnexion, association stricte au bon job, reprise après remplacement de l'updater et API arrêtée, curseurs sans duplication, limite/rétention, vrai niveau rouge et rendu texte sans injection. Les tests existants ne doivent pas être « réparés » en remplaçant leurs assertions de santé par des délais ou en acceptant artificiellement les captures.

## 9. Livraison des assets de maintenance dans l’image actuelle

Lecture complémentaire de `docker/web.Dockerfile` et `docker/maintenance/notice.css` sur le même SHA Neon, sans comparaison supplémentaire avec la branche de travail. Ces deux copies s’ajoutent aux 20 copies déjà réunies ; la comparaison d’identité annoncée plus haut reste limitée aux 16 fichiers centraux.

`docker/web.Dockerfile:57–59` copie `docker/maintenance` dans `/maintenance`, le CSS généré Mantine depuis `/src/apps/web/src/generated/mantine-vars.css` dans `/maintenance/theme.css`, puis `packages/ui/src/fonts` dans `/maintenance/fonts`. L’index réel charge `/update/theme.css`. **Ce fichier de thème est généré dans l’image ; ce n’est pas un fichier manquant à créer arbitrairement dans `docker/maintenance`.** La nouvelle police/SVG/CSS doivent être livrés par le pipeline de l’image actuelle et rester servis par le gateway stable. Une modification du Dockerfile n’est pas nécessaire si les nouveaux assets restent dans le répertoire déjà copié ; le constater dans la cible.

La maquette jointe possède son propre `assets/inter.woff2` pour être consultable isolément. Ce chemin de démonstration ne prescrit pas de dupliquer la police en production. `notice.css` reste le style du bandeau transversal, pas celui de la grande dalle de maintenance.

## 10. Contrainte visuelle de la demande actuelle

Le journal demandé flotte directement dans la grande dalle centrale, centré à droite : texte technique blanc légèrement transparent, nouvelles lignes qui montent et s'effacent progressivement en haut, **sans carte de journal supplémentaire**. Erreurs en rouge lisible. Cyan/bleu dominants avec une touche légère de violet Neon. Réseau et paquets en arrière-plan ; animation logique différente par étape.

L'utilisateur a demandé des **captures fixes pour valider avant une vidéo**. Le dossier d'implémentation doit distinguer captures proposées, validation utilisateur éventuelle et intégration effective ; aucune nouvelle vidéo n'est nécessaire pour ce dossier.
