# ADR 0086 — Assistant RSSI : serveur MCP de la plateforme, agent Hermes en conteneur optionnel, propositions validées

- Statut : **proposée** le 11/11/2026. Numéro 0086 annoncé au RSSI dans la session ; libre sur toutes les branches du dépôt
  à cette date. À accepter par le RSSI avant tout développement.
- Date : 2026-11-11
- Rédaction : session « Assistant RSSI intégré plateforme » (`session_01EnWdzfTjPHLznQbaTS7Ugc`)
- Contexte : le RSSI demande, le 11/11/2026, un **assistant RSSI intégré à la plateforme**, « type Hermes et MCP », qui
  surveille, analyse et questionne pour maintenir la certification ISO/IEC 27001 et HDS, en tenant deux rôles : aide à la
  mise en œuvre (« lead implementer ») et aide à l'audit interne (« lead auditor »). Cadrage détaillé et lots :
  [CADRAGE-ASSISTANT-RSSI](../unification/CADRAGE-ASSISTANT-RSSI.md).
- S'appuie sur : [ADR 0014](0014-donnees-sur-le-serveur-et-mises-a-jour.md) (API sans accès Internet),
  [ADR 0019](0019-activation-modules.md) (modules), [ADR 0049](0049-courriel-et-sortie-reseau-optionnelle.md),
  [ADR 0058](0058-notifications-metier.md), [ADR 0063](0063-chaine-de-publication-durcie.md) (épinglage),
  [ADR 0083](0083-porte-de-lecture-autorisee-entre-modules.md) (porte de lecture). Ne dépend pas du module Intégrations
  ([ADR 0076](0076-module-integrations.md), non développé). Sans rapport avec le « RSSI virtuel » de recette
  ([guide](../05_RECETTE/RSSI_VIRTUEL.md)), qui teste l'application de l'extérieur.

## Décisions du RSSI (11/11/2026)

| N° | Question | Décision |
|---|---|---|
| A1 | Où tourne le modèle de langage | Point d'accès **réglable**, compatible OpenAI ; **local par défaut** : rien ne sort du serveur |
| A2 | Forme de l'agent | **Serveur MCP natif** dans la plateforme ; **Hermes Agent** dans un conteneur optionnel qui s'y connecte |
| A3 | Autonomie | L'assistant **lit et propose** ; rien n'est écrit dans un registre sans validation d'une personne |
| A4 | Démarrage | Cadrage et ADR d'abord, sans code |
| A5 | Ce que lit l'assistant | **Tout ce que la plateforme contient** dans ses périmètres : référentiels (ISO/IEC 27001, HDS…), **contenu des documents**, actions, tâches récurrentes et leur historique |
| A6 | Progression | L'assistant **s'améliore avec l'usage** : mémoire de l'organisation et prise en compte des décisions rendues sur ses propositions |
| A7 | Échanges | Un **chat** dans l'interface, et des **notifications à l'initiative de l'assistant** (rappel, question, proposition) |
| A8 | Accès | Un **droit dédié** pour utiliser l'assistant, attribué explicitement, afin d'en limiter l'accès |
| A9 | Recherche dans les documents | **Index de recherche accepté** : il reste sur le serveur |
| A10 | Branche | Une **branche dédiée**, copie de `claude-suivi-smsi`, porte tout l'assistant : `claude/assistant-rssi` |

## Faits vérifiés le 11/11/2026 (sources officielles)

- **Hermes Agent** (Nous Research) : licence MIT, version 0.23.1 du 09/11/2026, image `nousresearch/hermes-agent`, état
  dans `/opt/data`. Client MCP en HTTP (Streamable HTTP) avec en-tête `Authorization`, liste blanche d'outils par serveur
  (`tools.include`). Fournisseur `custom` avec `base_url` compatible OpenAI (Ollama, vLLM, llama.cpp). Exige **au moins
  64 000 jetons de contexte** et un serveur de modèle qui gère l'appel d'outils. Planificateur intégré (tic de 60 s de sa
  passerelle). Serveur d'API compatible OpenAI (port 8642, clé obligatoire). Outils natifs sur l'hôte (terminal, fichiers,
  navigateur, exécution de code, web) désactivables par jeu d'outils. Pas de télémétrie selon sa FAQ ; un contrôle de mise
  à jour interroge GitHub au plus une fois par jour.
  Sources : [dépôt](https://github.com/NousResearch/hermes-agent), [MCP](https://hermes-agent.nousresearch.com/docs/reference/mcp-config-reference),
  [fournisseurs](https://hermes-agent.nousresearch.com/docs/integrations/providers), [Docker](https://hermes-agent.nousresearch.com/docs/user-guide/docker),
  [API](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server), [FAQ](https://hermes-agent.nousresearch.com/docs/reference/faq).
- **MCP** : révision courante 2026-07-28 (transport HTTP sans session ni poignée de main, en-têtes `Mcp-Method` et
  `Mcp-Name`) ; précédente 2025-11-25. Source : [journal de la spécification](https://modelcontextprotocol.io/specification/latest/changelog).
- **Non vérifié** : la révision MCP que parle le client de Hermes 0.23.1 ; une recette documentée « outils MCP seulement »
  pour Hermes ; le comportement réel d'un modèle local sur ces outils ; le fonctionnement de la mémoire et des savoir-faire
  appris de Hermes quand ses outils de fichiers sont désactivés ; la possibilité de borner les droits conversation par
  conversation. Ces points sont levés par essai au lot concerné.
- **Existant de la plateforme** : une seule authentification nominative (session par cookie) ; aucun jeton d'API ni compte
  de service ; `route()` porte tous les contrôles ; journal `audit_log` en ajout seul avec des acteurs non humains déjà
  admis (`planification`, `Automate SMSI`) ; modèle « proposition puis décision » des rapprochements
  (`pending | confirmed | rejected | withdrawn`) ; réseaux `edge`, `backend` et `antivirus` internes ; documents chiffrés,
  formats admis contrôlés par `files.ts` (PDF, bureautique, images, texte), **aucune extraction de texte existante**.

## Décision

1. **Deux pièces séparées.** La plateforme expose un **serveur MCP** ; l'**agent** (Hermes) est un programme tiers, dans son
   propre conteneur, qui n'a ni accès à la base, ni socket Docker, ni fichiers de l'application. Tout ce que l'agent sait ou
   fait passe par les outils MCP, donc par les droits, les limites et le journal de la plateforme. Un autre client MCP peut
   remplacer Hermes sans changer la plateforme.
2. **Nouveau module `assistant`** (non métier), désactivé par défaut, avec dépendances facultatives vers les modules qu'il
   lit. Actions : `assistant:lire` (**utiliser l'assistant** : chat, propositions, questions et rapports),
   `assistant:modifier` (décider d'une proposition), `assistant:administrer` (comptes d'assistant, jetons, réglages,
   mémoire). **Ce droit est dédié et ne se déduit d'aucun autre** : sans `assistant:lire`, ni rubrique, ni chat, ni
   propositions, et l'API refuse. Parmi les rôles prédéfinis, seuls `administrateur` et `rssi` le portent ; `contributeur`,
   `lecteur` et `auditeur_externe` ne le reçoivent pas. Il s'attribue à d'autres personnes par un rôle personnalisé.
   Recevoir un rappel ou une question de l'assistant, et y répondre depuis la notification, ne demande pas ce droit : la
   personne ne voit que l'objet auquel elle a déjà accès. Décider d'une proposition exige
   **en plus** le droit de la cible et l'écriture sur le périmètre : le droit sur le module ne contourne jamais celui de la
   cible. Migration additive qui recrée `module_activation_disabled_connus`, sans réécrire les précédentes.
3. **Compte d'assistant et jeton.** Un compte d'assistant est un compte non humain, créé par un administrateur, rattaché à
   un **profil** (point 9), à un rôle en lecture et à des périmètres explicites. Il s'authentifie par un jeton porteur
   aléatoire, affiché une seule fois, conservé haché, révocable, à expiration obligatoire. Il ne peut ni ouvrir de session
   d'interface, ni recevoir une permission `modifier`, `supprimer` ou `administrer`.
4. **Nouveau type d'accès `assistant` dans `route()`**, réservé à la route MCP : jeton porteur, pas de cookie (donc pas de
   CSRF), module actif, limiteur de débit propre au jeton, corps borné. Le serveur MCP reste **sans état** et n'offre que
   des outils (ni ressources, ni invites, ni échantillonnage). `rbac.test.ts` reçoit le nouveau type.
5. **Outils de lecture par la porte de lecture** (ADR 0083). Chaque outil appelle les services existants avec la portée
   du compte d'assistant : exigences et couverture, déclaration d'applicabilité, écarts et actions, risques, plan et
   programme d'audit, audits et constats, incidents, fournisseurs, tâches récurrentes et leurs occurrences, parcours ISO/HDS, documents (point 15), et l'**historique** des
   objets (versions, validations d'occurrences) pour suivre les évolutions. Les réponses sont paginées et bornées. Sont exclus par construction : comptes, sessions, secrets, journal technique, configuration
   système, sauvegardes.
6. **Signaux calculés par la plateforme, pas par le modèle.** Un outil « signaux » rend des faits déterministes :
   actions en retard, exigences sans évaluation ou sans preuve, évaluations anciennes, audits du programme à venir ou non
   tenus, risques à revoir. Le modèle hiérarchise et rédige ; il ne calcule **aucun taux**. Tout chiffre affiché vient d'un
   outil et toute affirmation cite les identifiants des objets lus.
7. **Propositions puis décision humaine**, sur le modèle des rapprochements. L'assistant dépose, par des outils dédiés, des
   **propositions** typées (écart, action, tâche, constat d'audit, évaluation d'exigence). Table de propositions avec `pending | confirmed | rejected | withdrawn`, `decided_by`,
   `decided_at`, `decision_note`, sources citées. La confirmation écrit par le service existant de la cible, **sous
   l'identité de la personne qui décide**, avec la mention de l'origine. Une proposition rejetée n'est pas redéposée tant
   que ses sources n'ont pas changé (empreinte). L'assistant ne valide, ne clôt et ne publie jamais rien.
8. **Notifications à l'initiative de l'assistant**, par le circuit existant (ADR 0058) : trois types, **rappel**,
   **question** et **proposition à décider**. Un rappel ou une question n'écrit dans aucun registre : l'assistant les émet
   seul, sans validation préalable, vers des personnes qui ont déjà accès à l'objet cité. L'expéditeur affiché est
   « Assistant ». Les réglages de chaque personne (application, courriel) s'appliquent ; un plafond par personne et par
   jour évite l'envahissement, et un même rappel n'est pas réémis tant que l'objet n'a pas changé. La réponse à une
   question se donne depuis la notification ou dans le chat ; l'assistant la relit par un outil. Aucun nouveau canal.
9. **Deux profils séparés.** « Mise en œuvre » et « Audit interne » sont deux comptes d'assistant, deux jetons et deux
   profils Hermes sans mémoire commune. Le profil d'audit ne dépose que des constats et des éléments de préparation ; il ne
   dépose aucune action corrective. Un constat qui porte sur un objet issu d'une proposition de l'assistant est signalé
   comme tel. La responsabilité de l'audit et sa conclusion restent celles de l'auditeur humain désigné.
10. **Hermes en conteneur optionnel** (profil Compose `assistant`, comme l'antivirus), image épinglée par empreinte
    (ADR 0063), sans privilège, système de fichiers en lecture seule hors de son dossier d'état, aucun montage de
    l'application. Jeux d'outils natifs **désactivés** (terminal, fichiers, navigateur, exécution de code, web) ; liste
    blanche des outils MCP de la plateforme. Réseau interne dédié `assistant` entre `app` et l'agent : le contrôle de mise à
    jour de Hermes n'a aucune sortie. L'activation se fait en ligne de commande sur le serveur ; l'API n'obtient toujours
    pas le socket Docker.
11. **Modèle : local par défaut.** Le serveur de modèle (compatible OpenAI) tourne dans un second conteneur optionnel, sur
    un réseau interne. Pointer vers un fournisseur extérieur est un réglage explicite de l'exploitant, qui place alors
    l'agent sur un réseau sortant ; l'interface affiche que des extraits du SMSI quittent le serveur. **L'API de la
    plateforme garde zéro accès sortant** dans les deux cas.
12. **Chat dans l'interface** : l'API relaie vers le serveur d'API de Hermes sur le réseau interne, comme elle parle à
    l'antivirus. Un fil par personne et par profil, conservé par la plateforme, lisible par son seul auteur, purgeable.
    Chaque réponse cite ses sources par des liens vers les objets. **Le chat ne montre jamais plus que ce que la personne
    peut lire elle-même** : les lectures faites pendant une conversation sont bornées à l'intersection des périmètres du
    compte d'assistant et de ceux de la personne. Si Hermes ne permet pas de borner chaque conversation, le chat d'un
    profil est réservé aux personnes dont les droits couvrent tout le périmètre de ce profil. La même règle protège la
    mémoire (point 16).
13. **Traçabilité.** Chaque appel d'outil écrit un audit `assistant.*` (compte d'assistant, outil, périmètre, nombre
    d'éléments rendus), sans contenu métier ni jeton. Le nom du champ du jeton rejoint le masquage `REDACT`.
14. **Implémentation du protocole.** Sous-ensemble « outils » de MCP écrit dans l'API avec Fastify et zod, **sans
    dépendance nouvelle**, si l'essai d'interopérabilité avec Hermes du premier lot réussit. Sinon, le paquet officiel
    `@modelcontextprotocol/server` est retenu par un addendum à cette ADR, avec sa version et sa licence.
15. **Contenu des documents.** L'assistant lit le texte des documents de ses périmètres, avec les droits du document.
    L'extraction du texte se fait **hors de l'API**, dans une étape isolée, sans réseau et sans privilège, après le
    contrôle antivirus existant. Ordre : formats texte (txt, md, csv, json, xml), puis PDF et bureautique (docx, xlsx,
    pptx, odt…), dont les bibliothèques d'extraction seront retenues par un addendum (dépendances nouvelles). Les images
    et les PDF numérisés ne sont pas lus au départ (pas de reconnaissance de caractères). Le texte extrait est rattaché à
    la **version** du document, chiffré comme lui, recalculé quand la version change et supprimé avec elle. Un **index de recherche en texte intégral** est tenu dans la base, sur le serveur (décision A9) ; il n'est interrogé
    qu'à travers les droits du document et il est couvert par les sauvegardes chiffrées. Un texte de
    norme n'entre que si l'organisation l'a déposé ou importé elle-même : rien n'est reconstitué.
16. **Amélioration avec l'usage, sans entraînement de modèle.** Trois sources, toutes sur le serveur :
    - l'**état courant**, relu à chaque ronde par les outils : l'assistant n'a pas de copie périmée des registres ;
    - la **mémoire** de Hermes, propre à chaque profil : contexte de l'organisation, réponses reçues, préférences ;
    - les **retours** : un outil rend la décision prise sur chaque proposition (confirmée, modifiée, rejetée, avec le
      motif). L'assistant en tient compte et ne répète pas ce qui a été refusé.

    La plateforme calcule et affiche le **taux de propositions acceptées** par type et par mois : c'est la mesure de la
    progression, et elle ne vient pas du modèle. La mémoire est **lisible, corrigeable et purgeable** par le RSSI depuis
    l'administration ; elle est purgée quand les périmètres d'un compte d'assistant sont réduits. Aucun modèle n'est
    réentraîné et aucune donnée ne sert à un tiers.

## Conséquences

- La plateforme reçoit sa **première authentification par jeton** et son premier compte non humain qui lit des données
  métier : nouvelle surface, bornée à une route, en lecture, sous porte de lecture, limitée et journalisée.
- Un **logiciel tiers** (Hermes, puis un serveur de modèle) entre dans le déploiement : image à épingler, à suivre et à
  mettre à jour ; ces images ne sont pas construites ni signées par le projet.
- L'**injection par le contenu** est un risque réel : un texte importé (rapport, fiche fournisseur) peut chercher à
  détourner l'agent. Parades retenues : aucun outil d'écriture directe, aucune sortie réseau par défaut, aucun outil sur
  l'hôte, décision humaine avec sources visibles. Le risque résiduel est une proposition trompeuse : la personne qui valide
  reste le contrôle.
- Le texte extrait des documents double une donnée sensible : il suit les droits, le chiffrement et la suppression du
  document. L'extraction traite des fichiers non fiables : elle reste hors de l'API, isolée.
- La **mémoire de l'agent** contient des extraits du SMSI : elle vit dans `DATA_DIR`, suit les sauvegardes chiffrées et se
  purge depuis l'administration.
- L'assistant est lui-même un usage d'IA de l'organisation : il passe par le GAP IA ([ADR 0064](0064-gap-ia-iso-27001-hds.md))
  et par l'appréciation des risques avant sa mise en service.
- L'index de recherche contient le texte des documents **en clair dans la base**, alors que les fichiers sont chiffrés sur
  disque : une personne qui accède à la base du serveur lit ce texte. Accepté par le RSSI (A9), la base n'étant pas exposée.
- **Branche dédiée** (A10) : les lots se développent sur `claude/assistant-rssi`, qui reprend régulièrement
  `claude-suivi-smsi` par fusion. Rien de l'assistant n'entre dans `claude-suivi-smsi`, donc dans `main` ni dans une
  version publiée, avant une PR décidée par le RSSI, contrôles verts.
- **Limites assumées** : pas d'écriture autonome dans les registres ; images et PDF numérisés non lus au départ ; pas
  d'activation du conteneur depuis l'interface ; qualité dépendante du modèle, **non mesurée** à ce jour ; le serveur est un
  VPS sans carte graphique : le modèle tournera ailleurs que sur ce VPS (point ouvert 2), aucune promesse de performance.
- **Alternatives écartées** : boucle d'agent écrite dans l'API (mémoire, planification et dialogue à maintenir, et le
  modèle appelé depuis l'API) ; accès direct de l'agent à la base ; écritures directes par l'agent (contraire à A3 et à
  la règle « ne jamais simuler une validation humaine ») ; un seul profil pour la mise en œuvre et l'audit (un auditeur
  n'audite pas son propre travail) ; kit de développement MCP en version 1 (apporte `express`, `hono`, `cors` et d'autres
  paquets pour un besoin limité aux outils).

## Points ouverts pour le RSSI

1. Accepter cette ADR et confirmer le numéro 0086.
2. **Où tourne le modèle.** Le serveur est un VPS OVHcloud (indication du RSSI du 11/11/2026), donc **sans carte
   graphique**. Un modèle tenant 64 000 jetons de contexte avec appel d'outils y sera très probablement trop lent pour
   Hermes ; ce n'est pas mesuré. La décision A1 (point d'accès réglable) reste valable, mais « sur le VPS lui-même » n'est
   pas un choix réaliste. À décider avant le lot A3 (les lots A1 et A2 n'ont besoin d'aucun modèle) :
   - **a.** une instance OVHcloud Public Cloud avec carte graphique, dans le compte de l'organisation, qui ne fait tourner
     que le modèle : rien ne sort du compte ; coût horaire à l'allumage (ordre de grandeur relevé le 11/11/2026 sur des
     comparateurs : environ 1 $ l'heure pour une carte L4, à vérifier sur la grille officielle) ; liaison privée avec le
     VPS à vérifier ;
   - **b.** le service OVHcloud AI Endpoints (API compatible OpenAI, appel d'outils sur certains modèles, facturation à
     l'usage) : pas de machine à gérer ; **non vérifié** : périmètre HDS du service, engagement de non-réutilisation des
     données, modèles offrant 64 000 jetons de contexte ;
   - **c.** déplacer la plateforme sur un serveur doté d'une carte graphique.
3. Périmètres ouverts à chaque profil, et personnes destinataires des questions.
4. Prévenir les autres sessions avant le premier lot, qui touche `apps/api/src` (`http/route.ts`, `auth.ts`).
5. Plafond de notifications par personne et par jour (proposition : 5).
