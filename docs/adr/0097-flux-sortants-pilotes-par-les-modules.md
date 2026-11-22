# ADR 0097 — Flux réseau vers l'extérieur pilotés par les modules, validés par l'administrateur, sans commande sur le serveur

- Statut : **acceptée** par le RSSI le 15/11/2026, dans la session (numéro 0097 annoncé et accepté).
- Date : 2026-11-15
- Rédaction : session « Projet audit_suivi Coeur » (`session_01ES6jrfuR1tD6Az1XDgAnS3`)
- **Complète** l'[ADR 0086](0086-assistant-rssi-integre.md) (relais de l'assistant) et s'appuie sur l'[ADR 0014](0014-donnees-sur-le-serveur-et-mises-a-jour.md)
  (l'API n'a pas d'accès Internet), l'[ADR 0049](0049-courriel-et-sortie-reseau-optionnelle.md) (courriel envoyé par l'exécutant
  d'exploitation), l'[ADR 0019](0019-activation-modules.md) (activation des modules) et l'[ADR 0077](0077-installation-sans-ligne-de-commande.md)
  (installation sans ligne de commande).

## Contexte

Le 14/11/2026, à la mise en service de la 7.1.0, l'assistant RSSI affichait « Le relais de modèle n'est pas installé sur le serveur » :
activer l'assistant dans l'interface ne suffisait pas, il fallait démarrer un conteneur et modifier `.env` en ligne de commande. Le RSSI
demande une règle générale : **par défaut, aucun accès vers l'extérieur** ; c'est l'activation d'un module dans l'interface, validée
explicitement par l'administrateur, qui ouvre le flux dont ce module a besoin, et sa désactivation qui le referme ; **aucune commande
ne passe par SSH**. Les mêmes questions sont posées dès l'installation, avec la possibilité de les passer.

## Décision

1. **Un registre des flux externes**, partagé (`packages/shared`), décrit chaque module qui communique hors des réseaux internes
   Docker ou qui expose un port : identifiant, libellé, sens (sortant ou entrant), destinations (hôtes, ports) et ce qui sort.
   Modules concernés aujourd'hui :
   - **Assistant RSSI** : sortie TCP 443 vers le fournisseur du modèle réglé (par exemple `api.mistral.ai`), par le relais
     `assistant-relais` seul ;
   - **Courriel (SMTP/SMTPS)** : sortie vers le serveur de messagerie réglé, par l'exécutant d'exploitation ;
   - **Certificat public ACME** (Let's Encrypt ou autre autorité ACME) : sortie vers l'autorité, ports 80 et 443 joignables depuis
     Internet ;
   - **Antivirus, mise à jour des signatures** : sortie vers les miroirs ClamAV, par le service `freshclam` seul ;
   - **Mises à jour de la plateforme** : sortie vers GitHub et le registre d'images, par l'exécutant de mise à jour.
   Tout **module futur** qui doit sortir ou exposer un port s'inscrit dans ce registre ; un test d'architecture le vérifie.
2. **Par défaut, tout est fermé.** Sur une installation neuve, aucun de ces flux n'est ouvert tant que l'administrateur ne l'a pas
   activé. Le fonctionnement interne (application, base, sauvegardes locales) ne dépend d'aucun d'eux.
3. **Activation validée explicitement.** Dans **Administration**, une page « Flux vers l'extérieur » liste les modules. Activer un
   module affiche ce qu'il va faire (destinations, ports, données qui sortent) et demande une **confirmation explicite** de
   l'administrateur (droit `administration:administrer`). Activation et désactivation sont inscrites au **journal d'audit**
   (qui, quand, quel module, quelles destinations). Le réglage propre au module (clé, hôte SMTP, autorité ACME…) reste dans sa page.
4. **Ouverture et fermeture par la plateforme, sans SSH.** L'API enregistre seulement l'état voulu ; elle ne reçoit jamais Docker.
   L'**exécutant d'exploitation** (`updater`, déjà doté du socket Docker et sans port ni API HTTP) l'applique à son passage suivant
   (moins d'une minute) :
   - modules portés par un conteneur dédié (assistant, antivirus) : démarrage ou arrêt du conteneur de sortie (profil Compose),
     et configuration interne correspondante (adresse du relais de l'assistant connue de l'API sans modifier `.env`) ;
   - modules portés par l'exécutant lui-même (courriel, mises à jour) : l'exécutant n'émet aucun flux tant que le module est fermé ;
   - certificat ACME : le mode ACME de la passerelle n'est appliqué que si le module est ouvert ; fermé, la passerelle garde
     l'autorité interne.
   L'interface affiche l'état réel (voulu / appliqué) et l'erreur éventuelle.
5. **Questions dès l'installation.** L'assistant d'installation (étape 8) propose, pour chaque module du registre, « Activer » ou
   « Plus tard », avec le même texte de validation. « Plus tard » laisse le flux fermé ; tout se change ensuite dans Administration.
6. **Limite assumée.** La plateforme ouvre ou ferme **ses** flux (conteneurs et exécutants). Le pare-feu de l'hôte et celui du
   réseau restent du ressort de l'équipe infrastructure : la page indique, pour chaque module ouvert, le flux à autoriser.

## Ce qui n'est pas fait dans cette ADR

- Le code : livré par lots (registre et page Administration ; exécutant ; installation ; documentation), chacun dans sa PR.
- La reprise des réglages d'un serveur existant : l'application n'est pas encore en production (consigne du 14/11/2026, pas de
  reprise de données) ; un serveur déjà installé retrouve ses flux fermés et l'administrateur les rouvre depuis la page.

## Précision du RSSI (15/11/2026) : l'activation du module ouvre son flux, sans étape séparée

- Le geste d'activation du module, là où il se fait déjà, affiche une fois la fenêtre de validation (destinations, ports,
  données qui sortent, case de validation obligatoire). La validation enregistre l'activation **et** ouvre le flux en une seule
  opération ; désactiver le module referme le flux. Les deux sont inscrits au journal.
- Gestes retenus : assistant, l'interrupteur « Activer l'assistant » de sa page de réglage (Plateforme > Assistant RSSI) ;
  courriel, « Activer l'envoi de courriels » de sa page ; certificat ACME, le choix du mode ACME (« Obtenir un certificat
  ACME »), et le retour à l'autorité interne ou à un certificat fourni le referme ; antivirus, « Activer l'analyse antivirus »
  (geste créé dans Configuration système > Sécurité) ; mises à jour, « Activer les mises à jour depuis l'interface » dans la
  page Mises à jour.
- Côté serveur, voie retenue : les routes d'activation existantes portent la validation (`fluxConfirme: true`) et ouvrent le
  flux dans **leur** transaction (`PUT /api/assistant/reglages`, `PUT /api/settings/courriel`, demande `tls_acme`) ; sans
  validation, 409 (`flux_validation`) ; sans le droit `administration:administrer`, 403 (`flux_droit`), même si la personne a
  le droit du module (droit non élargi). Pour l'antivirus et les mises à jour, qui n'ont pas d'autre état, l'activation est la
  décision de flux elle-même, par la route commune `PUT /api/admin/flux-externes/:module`. Cette route n'ouvre pas le flux
  d'un module activé par son propre geste (409 `flux_par_module`) ; elle ferme toujours.
- La page Administration « Flux vers l'extérieur » devient un **résumé** : état voulu et appliqué, erreur, flux à autoriser sur
  le pare-feu, lien vers la page du module et bouton Fermer. On n'y ouvre rien.
- La fenêtre de validation est un composant réutilisable (`apps/web/src/components/ValidationFlux.tsx` : fenêtre, contenu seul
  et `useValidationFlux`), que l'assistant d'installation (lot 3) reprendra pour « Activer / Plus tard ».

## Précision du RSSI (16/11/2026) : une mise à jour ne referme pas un flux en service

- **Incident (15-16/11/2026).** Un serveur en 7.1.1 doté d'un certificat public ACME a été mis à jour en 7.2.0 depuis
  l'interface. La migration `071` a fermé tous les flux (point « Ce qui n'est pas fait » ci-dessus : pas de reprise) ; l'exécutant
  d'exploitation (lot 2) a alors ramené la passerelle à l'autorité interne. Comme le site envoie l'en-tête HSTS (un an), son nom
  de domaine est devenu inaccessible dans les navigateurs ; le RSSI a rétabli le service en passant par l'adresse IP du serveur et
  en rouvrant ACME. Le RSSI a aussi signalé que l'ouverture du flux des mises à jour (GitHub, Sigstore) « n'avait pas bien
  fonctionné ».
- **Règle : « une mise à jour de l'interface ne peut pas enlever le flux ouvert ».** Elle remplace, pour les serveurs déjà
  installés, le point « un serveur déjà installé retrouve ses flux fermés » de la section « Ce qui n'est pas fait » :
  - **reprise de l'existant** : un module du registre qui n'a encore **aucune décision enregistrée** et qui est **réellement en
    service** sur le serveur voit son flux enregistré **ouvert**, par l'acteur système `reprise-mise-a-jour`, inscrit au journal
    d'audit sous un événement distinct (`flux.externe.repris`) avec le motif constaté. Critères : ACME, passerelle en mode `acme`
    ou `CADDY_TLS` de `.env` réglé sur une adresse ACME ; assistant, conteneur `assistant-relais` présent ou
    `ASSISTANT_RELAIS_URL` renseigné dans `.env` ; antivirus, conteneur `freshclam` ou `clamav` présent ou `CLAMAV_HOST`
    renseigné ; courriel, envoi actif avec un hôte SMTP renseigné ; mises à jour, au moins une mise à jour déjà installée (reçu
    d'installation réussie ou rapport réussi du script de mise à jour) : une installation neuve reste fermée ;
  - **jamais sur un module décidé** : ouvert ou fermé par un administrateur, il n'est pas touché ; une fermeture décidée reste
    une fermeture ;
  - **avant toute fermeture** : l'exécutant ne ramène plus jamais la passerelle à l'autorité interne, ni n'arrête un conteneur,
    pour un module jamais décidé et en service ;
  - **pas de migration** : la table `flux_externes` distingue déjà un module décidé (`decide_par` renseigné) d'un module jamais
    décidé (aucune ligne, ou une ligne créée par le seul rapport de l'état appliqué).
- **Garde-fou HSTS** : fermer le flux ACME (depuis le résumé, ou en quittant le mode ACME dans la page Certificats) affiche dans
  la confirmation que le site repassera sur le certificat interne, risque de devenir inaccessible par son nom de domaine (HSTS)
  et reste joignable par l'adresse IP du serveur. Information claire, sans blocage.
- Version corrective **7.2.1**, numérotée par le RSSI.

## Mise en œuvre

- **Lot 1 — registre, état, gestes d'activation et résumé : livré** (session « Projet audit_suivi Coeur »). Registre partagé
  `packages/shared/src/flux-externes.ts` (cinq modules, destinations, ports, porteur, données qui sortent, pare-feu, geste
  d'activation) ; migration `071` additive (`flux_externes` : état voulu, décidé par / le, état appliqué, date, erreur courte),
  sans reprise : tout est fermé, y compris sur un serveur déjà installé ; table de configuration conservée par la remise à
  vide. Lecture `GET /api/admin/flux-externes` (`administration:lire`) ; ouverture par les gestes d'activation ci-dessus ;
  journal `flux.externe.ouvert` / `flux.externe.ferme` avec les destinations et l'origine du geste. CLI de l'exécutant :
  `suivi flux-souhaites` et `suivi flux-appliques` (entrée validée strictement, journal `flux.externe.applique` au
  changement). Blocages côté API, état relu à chaque usage : assistant (relais `http://assistant-relais:8787` par défaut, sans
  `.env`), antivirus (hôte `clamav` par défaut ; fermé, dépôt accepté « non analysé »), courriel (rien n'est remis à
  l'exécutant, test refusé), mises à jour (vérification et installation refusées, demande en file close), ACME (demande en
  attente annulée à la fermeture). Test d'architecture `apps/api/test/architecture-flux.test.ts`.
  Demande du RSSI après revue (15/11/2026) : désactiver un module dans Administration > Modules (ADR 0019) referme aussi son
  flux, dans la même transaction (journal `flux.externe.ferme`, origine `modules.update`) ; la réactivation du module ne rouvre
  rien, il faut repasser par son geste d'activation et la validation. Généralisé par le champ `moduleActivation` du registre
  (aujourd'hui l'assistant seul : les autres modules du registre ne sont pas des modules de l'ADR 0019).
- **Lot 2 — exécutant : livré** (session « Projet audit_suivi Coeur »). À chaque passage (environ 15 s), l'exécutant lit
  `suivi flux-souhaites` et l'applique, sans commande à taper ni SSH :
  - conteneurs dédiés (`scripts/update-worker.py`) : flux ouvert, `docker compose --profile <profil> up -d --no-deps <service>`,
    services dans l'ordre et sans bloquer la boucle (`clamav` n'est lancé qu'une fois `freshclam` sain) ; fermé,
    `docker compose --profile <profil> rm --stop --force <services>` (arrêtés et retirés, ils ne redémarrent pas avec Docker).
    Un `up -d` est renouvelé au démarrage de l'exécutant et toutes les heures, pour reprendre une nouvelle image après une mise
    à jour ou un réglage changé. Après une erreur de démarrage, nouvel essai dix minutes plus tard ;
  - mises à jour : flux fermé, ni contrôle automatique toutes les six heures, ni vérification ou installation demandée (la
    demande est close en échec, avec un message explicite), ni `git fetch`, `docker pull`, `docker manifest` ou `cosign` ; l'état est relu au moment de
    vérifier et d'installer ;
  - courriel (`scripts/exploitation-worker.py`) : flux fermé, aucune demande n'est réclamée (`mail-claim`), en plus du blocage
    côté API. Aucune autre sortie de cet exécutant (l'observation du certificat vise le frontal du site) ;
  - ACME : l'exécutant relit le flux juste avant d'appliquer une demande `tls_acme` (fermé : échec avant application, rien ne
    part) ; fermé alors que la passerelle est en ACME (mode `acme`, ou mode `env` avec `CADDY_TLS` réglé sur un courriel), il
    la ramène à l'autorité interne par le chemin d'une demande `tls_internal` (marqueur `interne`, validation, recréation,
    contrôle du certificat servi), sous le verrou des sauvegardes. Un certificat fourni (mode `web`) et le réglage ACME ne sont
    jamais touchés. Configuration refusée : marqueur antérieur rétabli, erreur rapportée, nouvel essai dix minutes plus tard ;
    `TLS_WEB_MANAGEMENT=0` : rien n'est modifié, erreur rapportée.
  Règle d'un état voulu illisible (application arrêtée ou en redémarrage, réponse inattendue) : l'exécutant n'émet rien
  lui-même (ni courriel, ni vérification ou téléchargement de version, ni demande ACME) et laisse les conteneurs de sortie dans
  l'état où il les a mis, sans rien rapporter ; une indisponibilité passagère n'arrête donc pas l'assistant ni l'antivirus et
  n'ouvre jamais rien. Rapport `suivi flux-appliques` (assistant, antivirus et mises à jour par `update-worker.py` ; courriel
  et ACME par `exploitation-worker.py`) au changement et au plus tard toutes les 30 minutes, erreur courte en phrase fixe
  (≤ 300 caractères, jamais de sortie de commande). Arguments fermés : profils, services et modules viennent de constantes des
  deux scripts ; un nom reçu de l'application et inconnu est ignoré ; le test d'architecture vérifie leur concordance avec le
  registre et l'ordre de démarrage (`depends_on`). Côté API, l'assistant ne joint son relais que si son flux est ouvert **et**
  appliqué ouvert (sinon un message dit que l'exécutant l'applique, ou qu'il a échoué). L'antivirus suit l'état voulu seul :
  la connexion de l'API à `clamav` est interne, et `CLAMAV_REQUIRED` refuse déjà un dépôt tant que le démon ne répond pas ;
  exiger l'état appliqué y ferait accepter des fichiers « non analysés » pendant le démarrage. Le périmètre de confiance de
  l'exécutant ne change pas (il avait déjà le socket Docker). Tests : `scripts/tests/test_flux_executant.py`,
  `scripts/tests/test_exploitation.py`, `apps/api/test/assistant.test.ts`, `apps/api/test/architecture-flux.test.ts`.
- **Lot 3 — questions de l'assistant d'installation (étape 8) : livré** (session « Projet audit_suivi Coeur »). Endroit retenu :
  la **première connexion complète** du compte administrateur créé par l'installation (après l'enrôlement du second facteur,
  et de la clé de sécurité facultative), pas la page `/setup` : avant, la personne n'a pas de session complète, donc ni le droit
  `administration:administrer` ni le journal nominatif des gestes du lot 1. La page de connexion renvoie alors vers
  `/installation/flux-externes` (page de l'application), puis vers la page demandée. Mécanisme le plus proche, sans migration :
  celui des données de démonstration. La demande est mémorisée dans `settings` (`flux_questions_en_attente`, compte créé) par
  la transaction qui consomme le jeton, sauf pour un administrateur de secours (jeton `recovery`) ; elle n'est proposée qu'à
  ce compte, et consommée quand il termine ou passe l'étape (`POST /api/installation/flux-externes/vues`, journal
  `setup.flux_questions_vues` avec les flux ouverts et fermés) ; `GET /api/installation/flux-externes` dit si elle reste à
  proposer. Ces deux routes (`administration:administrer`) n'ouvrent rien. Pour chaque module : « Activer » ou « Plus tard » ;
  « Passer l'étape : tout plus tard » laisse tout fermé. « Plus tard » ne fait aucun appel. « Activer » affiche
  `DetailValidationFlux` (case obligatoire) et passe par le geste du lot 1 :
  - antivirus et mises à jour : route commune `PUT /api/admin/flux-externes/:module` (`confirmation: true`) ;
  - assistant : `PUT /api/assistant/reglages` (`actif: true`, `fluxConfirme: true`, autres réglages inchangés), avec l'adresse
    du service de modèle et le nom du modèle, que le schéma exige pour activer. La clé et les profils se règlent ensuite dans
    sa page, indiquée à la fin de l'étape. État obtenu : assistant actif, flux ouvert, relais démarré, aucune clé ; rien ne sort
    (l'assistant répond « Aucune clé de modèle n'est enregistrée »), état déjà atteignable depuis la page de l'assistant. Sans
    `assistant:administrer` (ou module désactivé), l'assistant renvoie à sa page ;
  - courriel et certificat ACME : **pas d'ouverture depuis l'étape**. Le courriel n'a de sens qu'avec son serveur SMTP (hôte,
    port, chiffrement, compte, mot de passe scellé, expéditeur, message de test) ; ACME exige un nom public, les ports 80 et
    443 joignables depuis Internet et l'exécutant prêt, souvent pas encore le cas à l'installation (site ouvert par son
    adresse IP). « Activer » montre destinations et données, puis renvoie à leur page, dont le geste affiche la validation
    (une seule fois) ; d'ici là, le flux reste fermé.
  Aucun chemin n'ouvre un flux sans la validation explicite. L'exécutant applique au passage suivant (lot 2, inchangé).
  Tests : `apps/web/test/installation-flux.test.ts`, `apps/api/test/installation-flux.test.ts`, parcours d'installation e2e
  (`parcours.spec.ts`, `rssi-virtuel/specs/00-installation.spec.ts`).
- Lot 4 — documentation : à faire.
- **Précision du 16/11/2026 — reprise de l'existant et garde-fou HSTS : livrée en 7.2.1** (session « Projet audit_suivi
  Coeur »), sans migration ni dépendance nouvelle :
  - registre partagé : acteur `FLUX_REPRISE_ACTEUR` (`reprise-mise-a-jour`), motifs fermés par module `FLUX_REPRISE_MOTIFS`
    (code et phrase), schéma strict `FluxReprise` de l'entrée de l'exécutant (modules qu'il constate : `FLUX_REPRISE_EXECUTANT`,
    tous sauf le courriel) ;
  - API (`apps/api/src/flux-externes.ts`, `reprendre`) : dans une transaction, pour chaque module déclaré en service, ligne
    verrouillée ; si aucune décision n'est enregistrée, `ouvert = true`, `decide_par = reprise-mise-a-jour`, journal
    `flux.externe.repris` (motif, phrase, origine `executant` ou `demarrage`, destinations, porteur) ; sinon rien. Courriel :
    constaté au démarrage de l'API (`prepareDatabase`, après le chargement des réglages) ;
  - CLI `suivi flux-reprise` : entrée JSON validée strictement (module inconnu, courriel, motif étranger au module, champ
    inattendu ou JSON illisible : code 2, rien n'est enregistré), sortie identique à `suivi flux-souhaites` ;
  - exécutants : au début de chaque passage, avant toute fermeture, l'état voulu est lu par `flux-reprise` quand un module porté
    est en service (`flux-souhaites` sinon). `scripts/update-worker.py` lit d'abord l'état des conteneurs (lecture seule), puis
    déclare assistant et antivirus (conteneur présent, ou réglage de `.env`) et les mises à jour (reçu d'installation réussie
    dans `etat/recus-mises-a-jour`, ou rapport réussi dans `etat/mises-a-jour`) ; Docker muet, aucun conteneur n'est touché.
    `scripts/exploitation-worker.py` déclare la passerelle en ACME (`acme_motif` : mode `acme`, ou `CADDY_TLS` ACME en mode
    `env`). Réponse illisible : rien n'est fermé ni rapporté (règle du lot 2). Les codes de motif des deux scripts concordent
    avec le registre (test d'architecture) ;
  - interface : confirmation de fermeture du flux ACME (résumé) et de changement de mode (page Certificats : autorité
    interne, certificat fourni, réglage de départ) avec l'avertissement HSTS et le recours par l'adresse IP
    (`apps/web/src/flux-externes.ts`) ;
  - mises à jour (signalement GitHub/Sigstore) : cause trouvée dans l'annonce de la vérification (constat R6-03 de la recette).
    Après un échec, l'exécutant laissait la phase `checking` publiée et la page affichait « Vérification en cours » pendant
    90 s, puis « prend plus de temps que prévu », sans jamais dire l'échec ; un échec ancien (`checkError` resté vrai) pouvait
    aussi passer pour le résultat d'une nouvelle vérification. L'exécutant publie désormais la phase `idle` après l'échec
    d'une vérification, et la page reconnaît sa demande à son identifiant ; le message dit que le serveur n'a pas pu joindre
    GitHub et renvoie au pare-feu (le flux ouvert dans l'application ne règle pas le pare-feu). Sur un serveur passé de la
    7.1.1 à la 7.2.0, le flux « mises-a-jour » était en outre fermé par la migration `071` : c'est la reprise qui le garde
    ouvert désormais ;
  - affichage (demande du RSSI du 16/11/2026) : le résumé passe de huit à quatre colonnes repliées aux mots, puis en lignes
    empilées avec intitulés dans un cadre étroit (classes `tableau-empilable` et `flux-texte` de `packages/ui`) ; la fenêtre de
    validation liste le pare-feu ligne à ligne, garde les ports groupés et ne dépasse jamais l'écran (`fenetre-flux`).
  Tests : `apps/api/test/flux-reprise.test.ts`, `apps/api/test/architecture-flux.test.ts`, `packages/shared/test/flux-externes.test.ts`,
  `scripts/tests/test_flux_executant.py`, `scripts/tests/test_exploitation.py`, `scripts/tests/test_updates.py`,
  `apps/web/test/flux-repli-hsts.test.ts`, `apps/web/test/mises-a-jour-verification.test.ts`.

## Addendum du 22/11/2026 — veille active du poller (recherche CPE)

Décision du RSSI du 22/11/2026 : dans la saisie d'un produit surveillé, les versions connues du produit choisi doivent
arriver en quelques secondes, sans copie complète du dictionnaire CPE et sans nouveau composant à sortie permanente.

- **Ce qui ne change pas.** L'application ne lance jamais l'exécutant et n'écrit rien sur l'hôte (conteneur en lecture
  seule, montages en lecture seule). Aucune destination nouvelle : la demande part sous le flux « veille-vulnerabilites »
  déjà validé ; fermé, rien ne part.
- **Mécanisme.** À chaque passage, l'exécutant d'exploitation demande à l'application si une saisie de produit est en
  cours et pose ou retire un témoin dans son dossier privé (`reprise-exploitation/cpe-chaud`). Tant que ce témoin a moins
  de deux minutes, le poller (`scripts/update-worker.py`) intercale, entre deux passages complets (toutes les 15 secondes),
  des passages courts toutes les 3 secondes : `exploitation-worker.py` lancé avec `EXPLOITATION_SEULEMENT=cpe-versions`,
  délai borné à 30 secondes, limité à la file des versions CPE. Sans témoin : aucun appel de plus.
- **Conditions d'un passage court** : témoin ordinaire, du compte du poller et récent ; flux « veille-vulnerabilites »
  voulu ouvert au dernier passage complet (l'exécutant le revérifie avant toute sortie) ; ni maintenance, ni
  intervention, ni mise à jour en cours ; exécutant automatique actif. Une sauvegarde, une restauration ou une mise à
  jour demandée dans l'application s'exécute dans le fil du poller : aucun passage court ne tourne en même temps. Un
  passage court ne prend aucun verrou de données et ne lit que sa file ; lancé pendant une opération faite à la main sur
  l'hôte, il échoue sans effet si l'application est arrêtée.
- **Effet attendu.** L'ouverture de la saisie réchauffe le poller en 15 secondes au plus ; une demande de versions part
  ensuite en 3 à 6 secondes. Pire cas (demande dans les premières secondes) : 15 à 20 secondes, le champ de version
  restant libre. Ces délais restent à mesurer sur une pile réelle avec la file du module Vulnérabilités.
- **Écarté** : attente active dans l'exécutant (il doit rester court et borné) ; fichier écrit par l'application (elle
  n'a aucun montage en écriture) ; relais permanent vers la NVD (composant et sortie de plus, gardé en réserve).

Tests : `scripts/tests/test_updates.py` (cadence inchangée sans témoin, passages courts, conditions de refus, échec sans
effet, effacement devant le passage complet). La file, le témoin et le mode court de l'exécutant sont livrés par le lot
« recherche CPE » du module Vulnérabilités (ADR 0100).

## Conséquences

- Plus aucune commande à taper pour l'assistant, l'antivirus, le courriel, le certificat public ou les mises à jour.
- Une décision tracée pour chaque sortie de données hors du serveur, utile au SMSI (maîtrise des flux, A.8.20 à A.8.22).
- L'exécutant d'exploitation gagne la gestion de deux profils Compose : son périmètre de confiance ne change pas (il avait déjà le
  socket Docker).
