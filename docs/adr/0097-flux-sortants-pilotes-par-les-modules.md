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
- Lot 2 — exécutant (profils Compose `assistant` et `antivirus`, silence du courriel, des mises à jour et de l'ACME quand le
  flux est fermé, rapport par `flux-appliques`) : à faire.
- Lot 3 — questions de l'assistant d'installation (étape 8), avec le composant de validation du lot 1 : à faire.
- Lot 4 — documentation : à faire.

## Conséquences

- Plus aucune commande à taper pour l'assistant, l'antivirus, le courriel, le certificat public ou les mises à jour.
- Une décision tracée pour chaque sortie de données hors du serveur, utile au SMSI (maîtrise des flux, A.8.20 à A.8.22).
- L'exécutant d'exploitation gagne la gestion de deux profils Compose : son périmètre de confiance ne change pas (il avait déjà le
  socket Docker).
