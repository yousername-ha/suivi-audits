# 05 — Journal technique complet, autonome et expurgé

**Spécification proposée pour l'IA qui implémente. Aucun collecteur, endpoint ou mécanisme d'autorisation décrit comme nouveau dans ce document n'est implémenté par ce dossier.**

Périmètre : le journal de la page de mise à jour Neon, disponible pendant la maintenance même quand l'API applicative est arrêtée. Il ne s'agit pas d'une refonte du journal d'audit métier ni d'un accès général aux journaux du serveur.

Exigence utilisateur : « Tout les log possibles sauf si y a des secrets d'affiche ». L'affichage doit garder les détails techniques utiles, présenter les erreurs en rouge et conserver le diagnostic malgré le fondu des lignes dans l'interface.

## 1. Sources et état vérifié avant rédaction

Sources de cette spécification :

- `docs/refonte-neon/propositions/maintenance-neon-journal-technique/SPECIFICATION-FLUX-LOGS.md`, proposition locale du 15 novembre 2026 ;
- audit GitHub en lecture seule du 15 novembre 2026, branche `claude/refonte-neon` au SHA `28d48cacc3995200359fd4854286584a89d8b34f` ;
- comparaison de 16 fichiers maintenance avec `claude-suivi-smsi` au SHA `8ff37b62fa5645368158d7c3b3c37ef40a177d65` : contenus strictement identiques sur ce périmètre.

L'IA doit relire le code de sa branche au moment de l'intégration. Les SHAs ci-dessus sont des points de constat, pas une preuve que le code cible n'a pas changé.

### Réellement présent dans les sources inspectées

| Élément | État constaté |
| --- | --- |
| `GET /update/status.json` | État **public**, servi directement par le gateway, sans cache. Contient phases, résultat et horodatages ; aucun journal technique. |
| `docker/maintenance/maintenance.js` | Suivi public autonome et contrôle de santé avant retour à l'application. |
| `scripts/update-worker.py` | Exécutant privilégié. Crée `${DATA_DIR}/reprise-updates` avec des droits `0700`. Le fichier `<jobId>.log` est privé. |
| Sorties du script | Le worker redirige stdout et stderr de `mettre-a-jour.sh` dans ce fichier privé. Les deux flux y sont fusionnés. |
| `Worker.run()` | Capture des sorties de certaines commandes sans les ajouter au journal : choix de confidentialité explicite dans le code. |
| Téléchargement d'images | Des opérations de préparation ont lieu dans le worker ; le script utilise aussi `dc pull --quiet`. Toutes les couches/progressions ne sont donc pas émises dans le journal privé actuel. |
| `GET /api/admin/journaux-techniques` | Journal API général, permission `administration:lire`, filtres et pagination ; export NDJSON avec droit d'exportation. Il dépend de l'API. |
| `apps/api/src/log.ts` | Pino : masquage de champs structurés, stdout et tampon mémoire de 5 000 entrées. Ce n'est pas un sanitizer de sortie shell. |
| `PUT /api/admin/journaux-techniques/niveau` | Réglage du seuil API, administrateur ; `debug` temporaire. Ne change pas la collecte du worker. |
| Gateway | Seul montage public de l'état des updates. Aucun montage du dossier privé de reprise. |
| Updater | Aucun port ni API HTTP. Possède des privilèges et l'accès Docker : ne pas l'exposer au navigateur. |

### Absent du périmètre inspecté

Il n'existe pas de route de journal live de mise à jour dans `apps/api/src/routes/updates.ts`, de flux SSE correspondant, de route `/update/logs` dans Caddy, ni de service autonome d'autorisation de lecture de ce journal. Le contrat public ne fournit pas d'octets, de pourcentage, de débit ou d'ETA de téléchargement.

**Ne pas présenter le journal API existant comme une solution déjà raccordée à la maintenance. Ne pas présenter les URLs illustratives de ce document comme des routes présentes.**

## 2. Objectif et limites de l'exhaustivité

Collecter toutes les sorties techniques **réellement disponibles et pertinentes pour l'opération suivie**, notamment préparation, image/téléchargement/extraction, signature, sauvegarde, arrêt/démarrage de services, migrations, contrôles, reprise et retour arrière. Conserver la source, l'heure, l'ordre, le niveau et le détail diagnostique après expurgation.

Un message jamais produit ne peut pas être reconstruit. Un composant en mode silencieux, une couche Docker sans progression émise, un flux déjà tronqué par sa rétention ou une période où le composant était arrêté doivent être signalés comme limites de collecte. Ne pas augmenter globalement les niveaux à `debug`, ne pas activer `set -x`, ne pas journaliser l'environnement ou les fichiers secrets pour créer artificiellement davantage de détails.

La couverture doit être décrite par source pour chaque opération. « Journal complet » signifie toutes les entrées disponibles dans le périmètre et la rétention annoncés, avec les omissions visibles ; cela ne promet pas la totalité des informations internes de Docker, de l'OS ou d'une bibliothèque.

## 3. Sources à distinguer lors du raccordement

| Source | Collecte proposée | Précautions et limite réelle |
| --- | --- | --- |
| Événements du worker | Émettre des événements structurés aux transitions et aux contrôles, avec `jobId`. | Les événements de phase ne remplacent pas les sorties de commandes. Préserver les contrôles/signatures et le verrou de mise à jour. |
| Commandes de `Worker.run()` | Instrumenter explicitement les sorties utiles vers le pipeline d'expurgation. | Ces sorties sont actuellement retenues hors journal pour raison de confidentialité. Auditer commande par commande ; ne pas activer une recopie brute générale. |
| Script `mettre-a-jour.sh` | Capturer les flux dans des pipes bornés pour traitement avant publication. | Actuellement stdout/stderr sont fusionnés dans un fichier privé. Préserver l'ordre de réception ; ne pas attribuer rétrospectivement une origine certaine aux anciennes lignes fusionnées. |
| Sortie stdout/stderr d'une commande | Conserver `stream` si réellement connu, nom de composant et contexte de phase. | `stderr` n'est pas une sévérité. Ne pas afficher arguments sensibles, variables d'environnement ou prompts d'authentification. |
| API/Pino | Réutiliser la structure et le masquage existants, puis passer par les règles finales du canal d'affichage. | Le tampon actuel est en mémoire et limité. Les logs d'autres requêtes/utilisateurs ne deviennent pas automatiquement ceux de la mise à jour. |
| Services/migrations | Ne collecter que les composants nécessaires au diagnostic du job, sur la fenêtre et le périmètre annoncés. | Le collecteur privilégié conserve ce privilège côté serveur ; le service de lecture ne reçoit aucun accès Docker. Prévenir les doubles collectes. |
| Reçus et état public | Les afficher dans leurs fonctions existantes. | Aucune sortie brute dans `status.json`, `message`, `etapes` ou les reçus. Ce ne sont pas des canaux de logs. |

Le pipeline doit identifier les sources absentes, désactivées, inaccessibles ou tronquées. Si l'API est arrêtée, il ne génère aucune entrée Pino fictive ; il peut afficher un événement structuré indiquant que cette source n'émet plus pendant cette phase.

Les canaux sont distincts : état public, journal technique privé de mise à jour, journal API général, journal d'audit et reçus. Une corrélation peut les relier ; elle ne doit pas fusionner leurs permissions ni leurs politiques de confidentialité.

## 4. Pipeline obligatoire : expurger avant stockage affichable et transmission

Ordre attendu :

1. Recevoir une sortie dans un collecteur de confiance et la rattacher au bon job/source.
2. Décoder et reconstituer les fragments nécessaires **en mémoire bornée**, sans publier de fragment incomplet.
3. Normaliser les contrôles de terminal et déterminer les unités à traiter.
4. Détecter et masquer les valeurs sensibles, y compris entre fragments ou lignes.
5. Créer une entrée assainie, horodatée, ordonnée et de taille bornée.
6. Écrire uniquement cette entrée dans le stockage destiné à la consultation/export.
7. La rendre accessible via le transport privé autorisé.

Le navigateur, la réponse réseau, le cache, les traces du service de diffusion et les fichiers d'export ne doivent jamais recevoir le contenu brut. Une censure en JavaScript/CSS ou après écriture dans le fichier affichable arrive trop tard.

Le fichier brut privé existant n'est pas rendu public, déplacé dans `/updates`, monté dans le gateway, ajouté à un export ou assoupli en permissions. Il n'est pas nécessaire de modifier sa politique de conservation pour accomplir l'habillage. Si sa collecte change, traiter ce sujet séparément et documenter explicitement les garanties conservées.

### 4.1 Règles de masquage

Remplacer la valeur par `[masqué]` et conserver le reste utile lorsque possible : nom du champ, service, code HTTP ou erreur, état, trace expurgée, nom d'étape et empreinte d'image non sensible.

Masquer au minimum :

- mots de passe et variantes des champs `password`, secrets de configuration et chaînes de connexion ;
- clés API, clés privées et blocs de certificats/identifiants lorsqu'ils contiennent une donnée secrète ;
- tokens, Bearer/Basic Authorization, cookies, identifiants de session, codes MFA et CSRF ;
- secrets présents dans les arguments d'une commande ou un diagnostic multiligne ;
- identifiants `user:password@host`, paramètres sensibles et fragments sensibles des URLs ;
- valeurs secrètes connues au moment de l'exécution, dans les formats explicitement couverts.

Réutiliser les règles structurées de `apps/api/src/log.ts` comme base, en conservant leur comportement existant. Ajouter une couche destinée au texte libre : les règles Pino seules ne suffisent pas à expurger un shell, une stack contenant une URL ou un message contenant un objet sérialisé.

Ne pas masquer indistinctement toutes les empreintes, tous les identifiants de service ou toutes les lignes d'erreur : le diagnostic doit rester utile. Ne pas utiliser une liste de secrets réels recopiée dans les fichiers de configuration, la télémétrie ou les fixtures. Les valeurs connues nécessaires à la comparaison restent dans la mémoire du composant autorisé, avec une durée de vie limitée.

### 4.2 Fragments de flux et blocs multilignes

Les frontières des lectures réseau/processus ne sont pas des frontières de secrets. Exemple : `Authori` puis `zation: Bear` puis `er ...` doit être expurgé comme un seul champ, sans qu'un premier fragment soit déjà visible.

- Utiliser un décodeur UTF-8 incrémental ; ne pas casser un caractère entre deux buffers.
- Réassembler une ligne logique avant émission, et garder un état entre lignes pour les blocs structurés/multilignes.
- Un début de bloc de clé privée PEM ouvre un état de masquage conservé jusqu'à sa fin ; aucune ligne intermédiaire, en-tête partiel ou contenu base64 ne part au client. Une fin de flux sans fermeture produit un marqueur de contenu masqué, pas le bloc incomplet.
- Une valeur connue coupée à n'importe quelle frontière de chunk reste détectable. Le tampon de rétention doit couvrir la longueur maximale des secrets connus pris en charge ou l'unité entière doit être retenue et expurgée avant émission.
- Couvrir les continuations de lignes, chaînes citées et représentations JSON/URL/base64 uniquement selon des formats explicitement identifiés. Éviter les décodages récursifs non bornés. Documenter les formes réellement prises en charge.
- Les lignes sans retour à la ligne, très longues, binaires ou impossibles à analyser sont remplacées par un marqueur horodaté. Une limite de mémoire ne doit pas conduire à envoyer la partie brute « en attendant ».
- En cas d'erreur du sanitizer, arrêter la publication de cette unité/source et produire un marqueur non sensible. La mise à jour et le suivi public continuent ; aucun mode de secours ne transmet le brut.

Un seul regex et une capture d'écran ne garantissent pas l'absence de secrets. La prévention à la source, l'expurgation structurée, les règles de texte et les contrôles par canaris sont complémentaires.

### 4.3 ANSI et contrôles de terminal

Retirer ou normaliser les séquences ANSI/OSC, liens terminal (`OSC 8`), effacements, déplacements du curseur et retours chariot utilisés par les progressions. Cela empêche l'obfuscation de secrets ou de messages affichés. La normalisation elle-même doit gérer des séquences coupées entre chunks.

Un retour chariot de progression peut remplacer la dernière observation technique de progression selon un événement structuré ; il ne doit ni réécrire arbitrairement l'historique ni créer des milliers d'entrées identiques. Documenter l'agrégation et conserver les erreurs/événements significatifs.

Afficher avec `textContent` ou équivalent d'échappement sûr. Ne pas interpréter HTML/Markdown provenant des logs, ne pas rendre les URLs automatiquement actives et ne pas envoyer les lignes dans la console navigateur.

## 5. Autorisation autonome pendant l'arrêt API

Le suivi public de l'état reste accessible dans son périmètre actuel. Les détails techniques sont réservés à l'administrateur habilité ; reprendre les garanties de session/MFA et `administration:administrer` demandées pour ce parcours. Le droit `administration:lire` du journal API existant n'est pas automatiquement une autorisation pour le nouveau journal de maintenance.

Le lancement conserve son flux actuel : confirmation exacte, rôle administrateur système revalidé, MFA non rejouable, limites d'essais, fenêtre de maintenance et audit. Le journal ne crée pas un second chemin pour installer, annuler, restaurer ou exécuter une commande.

Pendant la maintenance, une lecture privée ne peut pas dépendre d'un appel à l'API applicative ou à sa base pour chaque message. Une session non vérifiable ne doit pas devenir implicitement autorisée. Un simple visiteur de `/update/` n'obtient aucun détail technique.

### Option A proposée — diffuseur autonome séparé, recommandé à évaluer

Un petit service de lecture reste disponible auprès du gateway. Il lit exclusivement les fichiers **déjà expurgés** et les métadonnées nécessaires à l'autorisation, avec des montages et droits minimaux. Il ne possède ni socket Docker, ni accès au répertoire de secrets, ni droit d'exécuter les commandes du worker.

Avant l'arrêt, l'API peut délivrer une autorisation courte et signée, limitée à un utilisateur administrateur, une opération, une audience et une fonction de lecture. Le diffuseur la vérifie localement avec du matériel de vérification séparé. Une clé publique de validation peut éviter de partager la clé de signature API. Expiration, révocation et stockage éventuel des autorisations doivent être conçus explicitement.

Le choix d'un droit autonome a une conséquence : une modification de rôle/session dans une API indisponible ne peut pas être revalidée en direct. Il faut une durée bornée et un mécanisme de révocation exploitable par le composant stable ; ne pas prétendre à une révocation instantanée provenant d'un composant arrêté. À l'expiration, le flux privé se ferme et l'état public continue. Une durée prolongée nécessite un mécanisme explicite et une nouvelle vérification fiable, pas une extension silencieuse côté navigateur.

Le service ne reçoit pas de chemins de fichiers arbitraires. Un `jobId` validé est résolu dans un catalogue interne autorisé, sans traversée de chemin ni lien symbolique permettant de sortir du stockage assaini.

### Option B proposée — lecture protégée via le frontal stable

Le frontal peut être associé à une autorisation autonome et à un lecteur minimal de segments expurgés. Ce choix nécessite également un véritable contrôle d'accès local, la pagination et la gestion des reprises. Un simple `file_server` Caddy sur les fichiers ne fournit pas ces garanties. Cette option ne consiste jamais à servir le dossier privé actuel.

### Option C — livraison progressive si le transport privé n'est pas prêt

Intégrer le suivi public réel et l'habillage, avec un message discret « Journal technique indisponible » ou « Accès administrateur requis ». Garder le diagnostic privé accessible par les outils existants de l'exploitant. Aucun journal simulé, aucune publication brute et aucun faux endpoint de secours.

### Contraintes communes aux options privées

- Transport same-origin HTTPS, réponses privées sans cache, aucune ouverture CORS générale.
- Aucun bearer durable dans l'URL, l'historique, le referer, les logs d'accès ou les captures. Si une autorisation est portée par cookie, définir `Secure`, `HttpOnly`, SameSite et un scope adapté ; ne pas inventer un préfixe de cookie incompatible avec son `Path`.
- Si le transport exige `Authorization`, prévoir un lecteur compatible : `EventSource` natif n'accepte pas librement un en-tête bearer. Un flux lu par `fetch` ou un cookie adéquat est un choix à instruire.
- API/DB arrêtées, gateway encore actif, reconnexion, remplacement de l'updater et expiration sont des cas normaux du contrat.
- Authentifier l'accès et filtrer le job **avant** d'émettre le premier octet technique. Refus et métadonnées d'erreur ne doivent pas révéler l'existence des jobs d'un autre utilisateur.
- Auditer les délivrances/consultations/exportations selon une politique bornée ; aucune écriture d'audit ne contient l'autorisation ni les secrets du journal.
- Limiter connexions simultanées, débit, taille des lots et durée d'inactivité ; une panne du diffuseur n'interrompt pas l'installation ni le suivi public.
- Les nouvelles routes, exceptions Caddy, volumes Compose et règles CSP doivent être implémentés et revus explicitement. Aucune de ces modifications n'est déjà réalisée par le présent dossier.

## 6. Schéma minimal proposé — non implémenté

Le schéma ci-dessous illustre un contrat possible à adapter aux conventions du dépôt. Il n'ajoute aucun champ au contrat public et ne correspond à aucune route existante.

```json
{
  "schemaVersion": 1,
  "jobId": "UUID_DE_L_OPERATION_AUTORISEE",
  "cursor": "CURSEUR_OPAQUE_MONOTONE_DANS_CE_JOB",
  "at": "2026-11-15T12:34:56.000Z",
  "source": "installer",
  "stream": "stderr",
  "phase": "installing",
  "level": "warn",
  "text": "Réessai du téléchargement du service web ; identifiant [masqué]",
  "redacted": true,
  "kind": "log"
}
```

Champs minimaux : `jobId`, identifiant/cursor stable de l'entrée, date, source, niveau et texte assaini. `phase`, `stream` et détails de masquage sont optionnels lorsque réellement connus. `redacted: false` ne signifie pas une preuve absolue qu'aucun secret n'a existé ; ce champ indique seulement qu'aucune substitution n'a été nécessaire selon le pipeline.

Valeurs proposées :

- `source` : identifiants contrôlés tels que `worker`, `installer`, `docker`, `migration`, `healthcheck`, `api`. Pas une commande libre ni un chemin sensible.
- `level` : `debug`, `info`, `warn`, `error`, `fatal` ; `unknown` possible pour du texte non classable.
- `kind` : `log`, `gap`, `source_status`, `redaction_notice`, `rotation`, `end`.
- `stream` : `stdout` ou `stderr`, seulement si l'origine n'a pas été fusionnée/perdue.

Enveloppe de page proposée : `jobId`, `entries`, `nextCursor`, `hasMore`, bornes de l'historique disponible et métadonnées de rétention. Le transport live peut utiliser les mêmes entrées, un curseur de reprise et des heartbeats sans texte métier. Aucun nom d'URL n'est prescrit ici.

L'ordre d'affichage s'appuie sur le numéro/cursor stable attribué par le collecteur du job, pas uniquement sur les horloges de conteneurs. Conserver l'heure source si utile sans l'utiliser pour effacer ou réordonner des entrées reçues. Un redémarrage ne remet pas les cursors à zéro pour le même journal.

## 7. Reprise, pagination, rétention et flux longs

### Côté serveur

- Stockage expurgé append-only par opération, segmenté et borné selon une politique documentée. Les permissions restent privées.
- Curseur opaque ou identifiant monotone stable ; validation stricte du job et de la position. Un curseur d'un autre job n'est jamais accepté implicitement.
- La reconnexion reprend **après** la dernière entrée acquittée/reçue ; le client déduplique les identifiants. Un événement peut être livré à nouveau après une coupure : mieux vaut une déduplication qu'une perte.
- Un curseur devenu trop ancien provoque une réponse explicite signalant l'intervalle manquant et la première position disponible. Ne pas sauter silencieusement à la fin.
- Distinguer : interruption réseau temporaire, segment tourné mais encore paginable, entrée supprimée par rétention, erreur de source et contenu masqué. Chacun possède une information non sensible visible.
- Définir avant déploiement les limites de taille par entrée, lot et job, la rétention en jours/octets/nombre d'opérations, ainsi que les privilèges d'export. Ces valeurs doivent être configurables et documentées ; le présent dossier n'invente pas la politique de l'exploitant.
- Atteindre une limite ne doit pas bloquer le processus d'installation par backpressure infinie. Appliquer une stratégie bornée et signalée : segmenter, agréger les progressions répétitives ou suspendre cette source ; ne jamais prétendre que des détails omis sont conservés.
- La clôture est liée à l'état terminal réel du job. Le dernier lot reste lisible après la fin tant que la rétention et l'autorisation le permettent.

### Côté navigateur

- La zone flottante affiche la fin du flux. Un nombre borné de lignes et d'octets est présent dans le DOM ; le plafond et les limites de lot sont définis lors du portage selon les écrans de bureau visés.
- Retirer une ancienne ligne du DOM après son fondu libère de la mémoire. Cela ne la supprime pas du stockage assaini.
- Les événements entrants sont traités en petits lots ; une rafale ne provoque pas une animation par caractère ni un blocage du navigateur.
- En consultation manuelle de l'historique, ne pas ramener brutalement l'utilisateur en bas. Fournir un moyen discret de revenir au direct et un état de nouvelles entrées.
- L'historique complet disponible se consulte par pagination et/ou export autorisé. Une collection JavaScript infinie ne remplace pas la pagination.
- Le client peut annoncer une reconnexion ou une limite, mais ne fabrique pas des lignes techniques pour meubler le silence.

La maquette locale conserve toutes ses fixtures dans son DOM pour les montrer ; ce comportement de démonstration ne doit pas être copié comme stratégie de rétention du produit réel.

## 8. Niveaux et erreurs rouges

Priorité au niveau structuré de la source. Pour Pino, utiliser sa sévérité déjà disponible ; `error` et `fatal` sont rouges. Pour un événement contrôlé du worker, émettre explicitement son niveau. Pour du texte non structuré, une règle de repli peut reconnaître un préfixe non ambigu et documenté ; sinon conserver `unknown` ou `info`.

- `error`/`fatal` : rouge lisible, persistant dans le diagnostic, sans clignotement agressif.
- `warn` : niveau conservé ; texte blanc dans le flux flottant retenu. Une couleur ambre dans un historique dédié serait une proposition séparée à valider, pas une demande déjà approuvée.
- `info`/`unknown` : blanc légèrement transparent dans le fond sombre.
- `debug` : blanc dans le flux flottant, détails de niveau lisibles dans l’historique. Ne pas atténuer arbitrairement une ligne au point de perdre sa lecture.

Ne pas classer tout `stderr` en erreur. Ne pas colorer en rouge `0 erreurs`, `no error`, une variable nommée `error` ou la simple présence du mot dans un chemin. Un code de sortie non nul produit un événement d'échec approprié, sans requalifier rétrospectivement toutes les lignes précédentes.

Une erreur suivie d'un réessai réussi demeure une entrée d'erreur technique. Le résultat global de mise à jour est piloté par l'état réel, jamais par la dernière couleur affichée. L'expurgation d'une ligne ne doit pas effacer sa date, son niveau ou son origine.

## 9. Rendu Neon attendu

Les lignes apparaissent directement **dans la grande dalle centrale, centrées à droite**, sans sous-carte, encadré de terminal, titre supplémentaire ou compteur décoratif. Texte technique monospace blanc légèrement transparent ; nouvelles lignes qui montent ; opacité qui diminue vers le haut jusqu'à disparition visuelle.

Le fond reste bleu/cyan avec une touche violette légère. Les lignes d'erreur restent rouges pendant le fondu avec un contraste suffisant. Le réseau et les effets de téléchargement sont décoratifs et ne doivent pas gêner la lecture ni signifier que des logs ou paquets réels ont été collectés.

Respecter `prefers-reduced-motion`, proposer une pause du mouvement si nécessaire et éviter de faire annoncer chaque ligne d'un flux rapide par un lecteur d'écran. Les changements d'état importants et la disponibilité du journal peuvent être annoncés séparément. L'historique doit fournir une lecture stable, sans disparition pendant la consultation.

## 10. Vérifications à effectuer lors de l'implémentation autorisée

Ce dossier n'exécute aucun test. L'IA qui réalise le portage doit vérifier le comportement réel, puis fournir des preuves de résultat.

### Canaris sans données réelles

Créer uniquement des secrets sentinelles synthétiques et distincts : token, cookie, Basic/Bearer, mot de passe JSON, URL de base de données, paramètre sensible, clé PEM factice multiligne et valeur connue. Les couper à toutes les frontières pertinentes : début/milieu/fin de champ, UTF-8, délimiteur PEM, ANSI, URL encodée, séquence échappée, fin de ligne et fin de flux.

Vérifier qu'aucune valeur ni fragment révélateur n'apparaît dans :

- les fichiers assainis et leurs rotations ;
- la réponse réseau, les reconnections et les pages d'historique ;
- les exports, caches et logs d'accès/erreur du diffuseur ;
- le DOM, les attributs, les messages d'erreur et la console navigateur.

Contrôler aussi les cas sans secret pour conserver les détails utiles, les codes d'erreur, noms de service et empreintes d'image. Prévoir les faux positifs et les erreurs du sanitizer ; un test qui ne cherche qu'une valeur complète ne couvre pas la fuite de fragments.

### Fonctionnement et droits

- Visiteur, compte lecteur, administrateur sans droit, autorisation expirée/révoquée et autre `jobId` : aucun octet technique reçu.
- Flux avant/pendant/après arrêt API, remplacement de l'updater, reboot/reconnexion du lecteur et retour arrière : reprise cohérente sans faux succès.
- Longue sortie, aucune fin de ligne, bruit répété, journal très volumineux et disque/segment limite : consommation bornée et omissions annoncées.
- Pagination/rotation et export : ordre stable, aucune duplication non dédupliquée, aucune perte silencieuse, contrôle d'accès appliqué partout.
- `stderr` informatif, `0 errors`, vrai `error/fatal` et réessai réussi : couleurs et résultat global distincts.
- Le suivi public, l'attente du bon job, les verrous de mise à jour, la MFA, la fenêtre de maintenance et le contrôle `/healthz` réel restent inchangés.

Les tests actuels du journal Pino ne prouvent pas la sûreté du nouveau journal shell. Ajouter des vérifications ciblées du nouveau pipeline plutôt que de remplacer les assertions existantes par des délais ou des captures acceptées automatiquement.

## 11. Livrable attendu de l'IA qui implémente

Fournir la liste des fichiers réellement modifiés, les routes/contrats effectivement ajoutés, l'architecture d'autorisation retenue, les sources collectées et leurs limites, les paramètres de rétention et les résultats de vérification. Indiquer expressément ce qui reste indisponible.

Ne pas livrer une animation remplie de fixtures comme si le journal réel était raccordé. Si le backend autonome n'est pas réalisé, conserver la mention d'indisponibilité et le suivi public fonctionnel. Les captures fixes sont à faire valider **avant toute nouvelle vidéo**, conformément à la règle utilisateur.

---

Résumé pour l'IA : document de spécification uniquement. Séparation entre journal public de phase, sorties privées du worker et tampon Pino explicitée ; architecture autonome et schéma proposés ; expurgation streaming avant stockage affichable/transmission, autorisation admin, reprise, rétention, DOM borné et erreurs rouges définis. Aucun code applicatif, endpoint, test, push ni déploiement réalisé pour ce document.
