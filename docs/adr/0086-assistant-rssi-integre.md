# ADR 0086 — Assistant RSSI intégré : agent natif, modèle distant réglable, autonomie bornée, propositions validées

- Statut : **acceptée** par le RSSI le 11/11/2026, dans la session (numéro 0086 annoncé et confirmé ; libre sur toutes les
  branches du dépôt à cette date).
- Date : 2026-11-11
- Rédaction : session « Assistant RSSI intégré plateforme » (`session_01EnWdzfTjPHLznQbaTS7Ugc`)
- Contexte : le RSSI demande, le 11/11/2026, un **assistant RSSI intégré à la plateforme**, qui surveille, analyse et
  questionne pour maintenir la certification ISO/IEC 27001 et HDS, en tenant deux rôles : aide à la mise en œuvre (« lead
  implementer ») et aide à l'audit interne (« lead auditor »). Cadrage détaillé et lots :
  [CADRAGE-ASSISTANT-RSSI](../unification/CADRAGE-ASSISTANT-RSSI.md).
- S'appuie sur : [ADR 0014](0014-donnees-sur-le-serveur-et-mises-a-jour.md) (API sans accès Internet),
  [ADR 0019](0019-activation-modules.md) (modules), [ADR 0049](0049-courriel-et-sortie-reseau-optionnelle.md),
  [ADR 0058](0058-notifications-metier.md), [ADR 0083](0083-porte-de-lecture-autorisee-entre-modules.md) (porte de
  lecture). Sans rapport avec le « RSSI virtuel » de recette ([guide](../05_RECETTE/RSSI_VIRTUEL.md)), qui teste
  l'application de l'extérieur.
- Historique de la proposition : la première rédaction du 11/11/2026 retenait un serveur MCP et l'agent Hermes (Nous
  Research) dans un conteneur, avec un modèle hébergé sur le serveur. Le serveur étant un VPS sans carte graphique, le
  modèle sera distant ; le RSSI a alors retenu, le même jour, un agent écrit dans la plateforme (décision A2 ci-dessous).

## Décisions du RSSI (11/11/2026)

| N° | Question | Décision |
|---|---|---|
| A1 | Modèle de langage | Point d'accès **réglable**, compatible OpenAI. Le serveur (VPS OVHcloud VPS-2, sans carte graphique) ne peut pas l'héberger : le modèle est **distant**. **Mistral** est le premier fournisseur retenu |
| A2 | Forme de l'agent | **Agent natif**, écrit dans la plateforme, relié directement au modèle. Pas de Hermes. Serveur MCP reporté en lot optionnel |
| A3 | Écritures | L'assistant **lit et propose** ; rien n'est écrit dans un registre sans validation d'une personne |
| A4 | Démarrage | Cadrage et ADR d'abord, sans code |
| A5 | Ce que lit l'assistant | **Tout ce que la plateforme contient** dans ses périmètres : référentiels (ISO/IEC 27001, HDS…), **contenu des documents**, actions, tâches récurrentes et leur historique |
| A6 | Progression | L'assistant **s'améliore avec l'usage** : mémoire de l'organisation et prise en compte des décisions rendues sur ses propositions |
| A7 | Échanges | Un **chat** dans l'interface, et des **notifications à l'initiative de l'assistant** (rappel, question, proposition) |
| A8 | Accès | Un **droit dédié** pour utiliser l'assistant, attribué explicitement, afin d'en limiter l'accès |
| A9 | Recherche dans les documents | **Index de recherche accepté** : il reste sur le serveur |
| A10 | Branche | Une **branche dédiée**, copie de `claude-suivi-smsi`, porte tout l'assistant : `claude/assistant-rssi` |
| A11 | Autonomie | L'assistant doit rester **autonome** : il travaille sans qu'on l'interroge (point 9) |

## Faits relevés le 11/11/2026

- **Existant de la plateforme** : une seule authentification nominative (session par cookie) ; `route()` porte tous les
  contrôles ; journal `audit_log` en ajout seul avec des acteurs non humains déjà admis (`planification`,
  `Automate SMSI`) ; tic de 60 s de l'API (`server.ts`) qui génère déjà occurrences et rappels ; modèle « proposition puis
  décision » des rapprochements (`pending | confirmed | rejected | withdrawn`) ; réseaux `edge`, `backend` et `antivirus`
  internes, l'API parlant à l'antivirus sur un réseau interne ; secrets scellés par le coffre en écriture seule
  (courriel) ; documents chiffrés, formats contrôlés par `files.ts`, **aucune extraction de texte existante**.
- **Serveur** : VPS-2 de la gamme 2026 ; d'après des fiches tierces, 6 cœurs virtuels, 12 Go de mémoire, 100 Go de disque,
  à confirmer dans l'espace client.
- **Non vérifié** : compatibilité exacte de l'API de Mistral et d'OVHcloud AI Endpoints avec le format « chat completions »
  et l'appel d'outils tels que l'agent les utilisera ; conditions de Mistral (non-entraînement, conservation, option sans
  conservation) lues sur des sources tierces seulement ; **aucune certification HDS trouvée** pour Mistral ; périmètre HDS
  d'OVHcloud AI Endpoints ; qualité réelle d'un modèle sur ces outils. Ces points sont levés par essai ou par lecture des
  contrats avant la mise en service.

## Décision

1. **Agent natif dans l'API.** La boucle de l'agent (demande, appels d'outils, réponse) s'exécute dans l'API, avec Fastify
   et zod, **sans dépendance nouvelle**. Les outils sont des fonctions internes qui appellent les services existants : il
   n'y a ni compte de service, ni jeton, ni route ouverte à un programme extérieur.
2. **Relais de modèle, seul à sortir.** L'API garde **zéro accès sortant**. Elle parle, sur un réseau interne dédié, à un
   conteneur `assistant-relais` (même image que l'API, autre commande, sans base, sans fichiers, sans privilège), comme elle
   parle à l'antivirus. Le relais ne sait faire qu'une chose : transmettre une requête de modèle à l'adresse réglée par
   l'administrateur, en HTTPS, certificat vérifié, taille et durée bornées. Il n'a aucun accès à la base. Conteneur
   optionnel (profil Compose `assistant`), activé en ligne de commande sur le serveur.
3. **Réglages du modèle dans l'interface** (droit `assistant:administrer`) : adresse, nom du modèle, clé. La clé est
   scellée par le coffre, en écriture seule, jamais réaffichée ni journalisée, sur le modèle de `secret:courriel`. Un test
   de connexion dit ce qui a marché. L'interface affiche en permanence **vers quel fournisseur partent les extraits**.
4. **Nouveau module `assistant`** (non métier), désactivé par défaut. Actions : `assistant:lire` (**utiliser
   l'assistant** : chat, propositions, questions et rapports), `assistant:modifier` (décider d'une proposition),
   `assistant:administrer` (profils, réglages du modèle, missions, mémoire, pause). **Ce droit est dédié et ne se déduit
   d'aucun autre** : sans `assistant:lire`, ni rubrique, ni chat, ni propositions, et l'API refuse. Parmi les rôles
   prédéfinis, seuls `administrateur` et `rssi` le portent. Il s'attribue à d'autres personnes par un rôle personnalisé.
   Recevoir un rappel ou une question, et y répondre depuis la notification, ne demande pas ce droit. Décider d'une
   proposition exige **en plus** le droit de la cible et l'écriture sur le périmètre. Migration additive qui recrée
   `module_activation_disabled_connus`.
5. **Profils et portée.** Un profil d'assistant (« Mise en œuvre », « Audit interne ») est un acteur non humain, avec des
   périmètres explicites et la lecture seule. Chaque outil lit par la porte de lecture (ADR 0083) :
   - en **ronde autonome**, avec la portée du profil ;
   - en **chat**, avec l'**intersection** de la portée du profil et de celle de la personne : le chat ne montre jamais plus
     que ce que la personne peut lire elle-même.

   Sont exclus par construction : comptes, sessions, secrets, journal technique, configuration système, sauvegardes.
6. **Outils de lecture.** Exigences et couverture, déclaration d'applicabilité, écarts et actions, risques, plan et
   programme d'audit, audits et constats, incidents, fournisseurs, tâches récurrentes et leurs occurrences, parcours
   ISO/HDS, documents (point 12), historique des objets. Réponses paginées et bornées.
7. **Signaux calculés par la plateforme, pas par le modèle.** Un outil « signaux » rend des faits déterministes : actions
   en retard, exigences sans évaluation ou sans preuve, évaluations anciennes, audits à venir ou non tenus, risques à
   revoir, questions restées sans réponse. Le modèle hiérarchise et rédige ; il ne calcule **aucun taux**. Tout chiffre
   vient d'un outil et toute affirmation cite les identifiants des objets lus.
8. **Propositions puis décision humaine**, sur le modèle des rapprochements : propositions typées (écart, action, tâche,
   constat d'audit, évaluation d'exigence) avec `pending | confirmed | rejected | withdrawn`, `decided_by`, `decided_at`,
   `decision_note` et sources citées. La confirmation écrit par le service de la cible, **sous l'identité de la personne
   qui décide**, avec la mention de l'origine. Une proposition rejetée n'est pas redéposée tant que ses sources n'ont pas
   changé. L'assistant ne valide, ne clôt et ne publie jamais rien.
9. **Autonomie.** L'assistant travaille sans être interrogé, de quatre façons :
   - **rondes planifiées** : le tic de l'API inscrit les rondes échues (par défaut une ronde quotidienne par profil et une
     synthèse hebdomadaire ; horaires réglables), une seule à la fois ;
   - **déclenchement sur événement** : un écart créé, une action passée en retard, une nouvelle version de document, un
     audit qui approche inscrivent une ronde ciblée sur l'objet ;
   - **missions** : des consignes durables rédigées par le RSSI pour chaque profil (« suivre le plan d'action de l'audit de
     certification », « préparer l'audit interne de mars »), que l'assistant reprend à chaque ronde jusqu'à leur clôture
     par le RSSI ;
   - **suivi de ses propres demandes** : une question sans réponse est relancée après un délai réglable, puis signalée au
     RSSI ; une proposition en attente est rappelée.

   Ce qu'il fait **seul** : lire, analyser, envoyer des rappels et des questions, déposer des propositions, rédiger des
   rapports de ronde, tenir sa mémoire. Ce qu'il ne fait **jamais seul** : écrire dans un registre. Bornes : budget
   quotidien de jetons et durée maximale par ronde, plafond de notifications, **interrupteur de pause** immédiat pour
   le RSSI, journal de chaque ronde (déclencheur, outils appelés, résultat). Si le modèle est injoignable, la ronde est
   consignée en échec et les rappels existants de l'automate continuent : la surveillance de base ne dépend pas du modèle.
10. **Notifications à l'initiative de l'assistant**, par le circuit existant (ADR 0058) : trois types, **rappel**,
    **question** et **proposition à décider**. Un rappel ou une question n'écrit dans aucun registre : l'assistant les
    émet seul, vers des personnes qui ont déjà accès à l'objet cité. L'expéditeur affiché est « Assistant ». Les réglages
    de chaque personne s'appliquent ; plafond par personne et par jour ; pas de réémission à objet inchangé. La réponse à
    une question se donne depuis la notification ou dans le chat.
11. **Chat dans l'interface.** Un fil par personne et par profil, conservé par la plateforme, lisible par son seul auteur,
    purgeable ; réponse affichée au fil de l'eau par le temps réel existant ; sources en liens vers les objets. CSP stricte
    respectée.
12. **Contenu des documents.** L'assistant lit le texte des documents de ses périmètres, avec les droits du document.
    L'extraction se fait **hors de l'API**, dans une étape isolée, sans réseau et sans privilège, après le contrôle
    antivirus. Ordre : formats texte, puis PDF et bureautique, dont les bibliothèques seront retenues par un addendum
    (dépendances nouvelles). Images et PDF numérisés non lus au départ. Le texte extrait est rattaché à la **version** du
    document, recalculé quand elle change et supprimé avec elle. Un **index de recherche en texte intégral** est tenu dans
    la base (A9), interrogé seulement à travers les droits du document. Un texte de norme n'entre que si l'organisation l'a
    déposé ou importé elle-même : rien n'est reconstitué.
13. **Amélioration avec l'usage, sans entraînement de modèle.** Trois sources : l'**état courant**, relu à chaque ronde ;
    une **mémoire** par profil, tenue dans des tables de la plateforme (contexte de l'organisation, réponses reçues,
    préférences), que l'assistant met à jour par un outil et que le RSSI peut **lire, corriger et purger** ; les
    **retours**, c'est-à-dire la décision et le motif rendus sur chaque proposition. La plateforme calcule et affiche le
    **taux de propositions acceptées** par type et par mois. La mémoire d'un profil est purgée quand ses périmètres sont
    réduits. Les deux profils n'ont pas de mémoire commune.
14. **Deux profils séparés.** Le profil d'audit ne dépose que des constats et des éléments de préparation, jamais d'action
    corrective. Un constat qui porte sur un objet issu d'une proposition de l'assistant est signalé comme tel. La
    responsabilité de l'audit et sa conclusion restent celles de l'auditeur humain désigné.
15. **Traçabilité.** Chaque ronde, chaque conversation et chaque appel d'outil écrit un audit `assistant.*` (profil,
    personne s'il y en a une, outil, périmètre, nombre d'éléments), sans contenu métier ni clé. La consommation de jetons
    est comptée par jour.
16. **Serveur MCP : lot optionnel, plus tard.** Les outils étant écrits une seule fois, les exposer par MCP à un agent
    extérieur (Hermes ou autre) reste possible ; cela demandera alors un jeton et un addendum à cette ADR.

## Conséquences

- **Des extraits du SMSI quittent le serveur** à chaque appel du modèle : la question posée et ce que l'assistant a lu
  pour y répondre (intitulés d'écarts, descriptions de risques, passages de documents, noms). La base entière ne part
  pas ; comptes, secrets et sauvegardes ne peuvent pas partir. Restreindre les périmètres d'un profil restreint ce qui
  sort. Ce flux est à inscrire dans l'appréciation des risques ; les périmètres susceptibles de contenir des données de
  santé ne sont pas ouverts à l'assistant tant que le fournisseur n'est pas qualifié pour cela.
- La boucle d'agent, la mémoire et la planification sont **du code de la plateforme**, à maintenir ; en contrepartie,
  aucun logiciel tiers n'entre dans le déploiement et les droits s'appliquent à chaque lecture.
- L'**injection par le contenu** reste un risque : un texte importé peut chercher à détourner l'agent. Parades : aucun
  outil d'écriture directe, aucune navigation web, une seule sortie (le fournisseur du modèle), décision humaine avec
  sources visibles. Le risque résiduel est une proposition ou un rappel trompeur.
- L'index de recherche contient le texte des documents **en clair dans la base**, alors que les fichiers sont chiffrés sur
  disque. Accepté par le RSSI (A9), la base n'étant pas exposée.
- Le fournisseur facture à l'usage : le budget quotidien de jetons borne la dépense, non estimée à ce jour.
- **Branche dédiée** (A10) : les lots se développent sur `claude/assistant-rssi`, qui reprend régulièrement
  `claude-suivi-smsi` par fusion. Rien de l'assistant n'entre dans `claude-suivi-smsi`, donc dans `main` ni dans une
  version publiée, avant une PR décidée par le RSSI, contrôles verts.
- L'assistant est lui-même un usage d'IA de l'organisation : il passe par le GAP IA
  ([ADR 0064](0064-gap-ia-iso-27001-hds.md)) avant sa mise en service.
- **Limites assumées** : pas d'écriture autonome dans les registres ; pas d'apprentissage automatique de savoir-faire
  (seulement mémoire et retours) ; images et PDF numérisés non lus au départ ; pas d'activation du relais depuis
  l'interface ; qualité dépendante du modèle, **non mesurée**.
- **Alternatives écartées** : Hermes Agent en conteneur (logiciel tiers à durcir, mémoire hors de la plateforme, droits
  par conversation non vérifiés, peu d'intérêt sans modèle local) ; appel du modèle par l'exécutant d'exploitation comme
  le courriel (passage toutes les 30 s, incompatible avec un chat) ; sortie réseau donnée à l'API (contraire aux ADR 0014
  et 0049) ; modèle sur le VPS (pas de carte graphique) ; écritures directes par l'agent ; un seul profil pour la mise en
  œuvre et l'audit.

## Réponses du RSSI aux points ouverts (11/11/2026)

1. ADR acceptée, numéro 0086 confirmé.
2. Fournisseur du modèle : **Mistral**. La lecture des conditions et de l'accord de traitement des données reste à faire
   par l'organisation avant la mise en service.
3. Périmètres : non arrêtés. **Première version réservée aux rôles administrateur et RSSI** (le droit dédié du point 4
   n'est porté que par eux). Un profil n'a **aucun périmètre par défaut** : l'administrateur les choisit dans l'écran de
   réglages.
4. Aucune autre session ne travaille sur le code de l'API sur cette branche.
5. Réglages par défaut (plafond de notifications, délai de relance, budget de jetons) : à arrêter aux lots A2 et A3.

## Addendum du 11/11/2026 — lot A1 réalisé (socle et chat)

Écarts assumés entre la décision et ce premier lot, sur la branche `claude/assistant-rssi` :

- **Module actif, assistant inactif.** Le module `assistant` est activable et désactivable comme les autres et n'est pas
  désactivé à la migration ; c'est l'assistant lui-même qui reste inactif (`assistant_reglages.actif = false`) tant qu'un
  administrateur ne l'a pas réglé. L'entrée de menu n'apparaît qu'une fois l'assistant activé.
- **Droits de la personne.** En chat, chaque outil s'exécute avec la session de la personne et refuse d'abord tout périmètre
  hors du profil : l'intersection du point 5 est obtenue par construction. La portée propre d'un profil, sans personne,
  n'existe pas encore : elle viendra avec les rondes autonomes (lot A3).
- **Réponse en tâche de fond, sans affichage au fil de l'eau.** La requête rend la main tout de suite ; l'interface relit le
  fil jusqu'à l'arrivée de la réponse. Cela évite de tenir un verrou de module pendant l'appel du modèle.
- **Sources.** La réponse liste les lectures faites et le nom des éléments lus ; le lien ouvre la synthèse du périmètre, pas
  encore la fiche de l'élément.
- **Relais.** Il accepte toute adresse HTTPS publique que lui remet l'API (l'adresse se règle dans l'interface, droit
  `assistant:administrer`) ; il refuse HTTP, les identifiants dans l'adresse et les adresses privées ou locales, contrôlées
  à la résolution. Un modèle sur une adresse privée demande `ASSISTANT_RELAIS_PRIVE=true` sur le serveur.
- **Non vérifié** : aucun appel à Mistral ni à un autre fournisseur réel (tests sur faux fournisseur) ; Docker, Node 26 et
  PostgreSQL 18 (contrôles locaux sur Node 22 et PostgreSQL 16) ; tests de bout en bout Playwright.

## Addendum du 12/11/2026 — lot A3, première tranche (rondes autonomes)

Le RSSI a rappelé le 12/11/2026 que l'**autonomie**, la qualité et la confidentialité priment : l'autonomie est donc
réalisée avant les propositions du lot A2. Un connecteur de chat extérieur (application de chat reliée par MCP) n'est pas
retenu : il retire à l'assistant ses rondes et fait sortir plus de données.

Réalisé sur `claude/assistant-rssi` (migration `056`) :

- **Rondes** : une ronde quotidienne par profil, à l'heure réglée (heure de Paris), ou à la demande d'un administrateur de
  l'assistant. Une seule à la fois ; 14 tours et 10 minutes au plus ; budget quotidien de jetons ; **pause** immédiate
  (aucune ronde ne part, la ronde en cours conclut). Un échec est consigné et n'est pas retenté le même jour ; l'automate
  des rappels existants n'en dépend pas.
- **Écart avec le point 5 : le référent.** La « portée du profil » sans personne n'existe pas. Chaque profil a un
  **référent**, compte actif porteur de `assistant:lire`. La ronde lit **avec les droits de ce compte**, bornés aux
  périmètres du profil : elle ne lit jamais plus que ce que cette personne peut lire. Le rapport n'est rendu qu'au référent
  et aux porteurs de `assistant:administrer`. Sans référent valide, la ronde échoue et le dit.
- **Ce que la ronde émet seule** : un **rappel** (type de notification `assistant_rappel`, circuit de l'ADR 0058, réglages
  de chaque personne respectés), une **note de mémoire**, un **rapport**. Rien n'est écrit dans un registre.
- **Rappel** : le destinataire est choisi par la plateforme, jamais par le modèle. C'est le responsable nommé de l'élément,
  s'il est actif et a accès au périmètre. Un seul rappel par élément tant qu'il n'a pas changé de version ; plafond par
  personne et par jour (5 par défaut) et par ronde (20). Le titre, repris dans un courriel éventuel, ne porte aucune donnée
  métier ; le texte rédigé par le modèle n'est visible que dans l'application. Les responsables de type groupe ou fonction
  ne sont pas encore rappelés.
- **Missions** par profil, rédigées et closes par un administrateur de l'assistant, relues à chaque ronde.
- **Mémoire** par profil (200 notes au plus, 5 par ronde), lisible et supprimable, **purgée** quand un périmètre est retiré
  au profil.
- **Outil « signaux »** (point 7), disponible aussi en chat : actions en retard, actions sans responsable, risques dont la
  revue est dépassée, exigences non couvertes ou à valider par référentiel.
- **Traçabilité** : audits `assistant.ronde`, `assistant.rappel`, `assistant.ronde_demandee`, `assistant.mission_*`,
  `assistant.memoire_*`, sans contenu métier ; acteur « Assistant RSSI ».

Reste à faire pour l'autonomie : déclenchement sur événement, synthèse hebdomadaire, questions avec réponse, relances,
propositions (lot A2), jeu d'évaluation mesuré. **Non vérifié** : aucun modèle réel n'a exécuté une ronde ; la qualité des
rapports et la pertinence des rappels ne sont pas mesurées.

## Addendum du 12/11/2026 — amélioration avec l'usage (point 13)

Le RSSI a demandé pourquoi ne pas reprendre Hermes pour que l'assistant « apprenne » la plateforme. Réponse retenue : Hermes
n'entraîne pas le modèle, il écrit une mémoire et des fiches de savoir-faire qu'il relit. Le même mécanisme est réalisé dans la
plateforme, **avec validation par une personne**, ce qu'Hermes ne fait pas. Décision du RSSI : accord (12/11/2026).

Réalisé sur `claude/assistant-rssi` (migration `057`) :

- **Fiches de méthode** par profil. L'assistant peut en proposer une par ronde (outil `proposer_methode`, dix en attente au
  plus). **Seules les fiches validées par un administrateur de l'assistant sont relues**, en ronde comme en conversation ; la
  personne peut corriger le texte en validant, en rédiger elle-même, refuser ou supprimer. Une fiche refusée n'est jamais relue.
- **Contexte de l'organisation** : texte rédigé par le RSSI dans les réglages, relu à chaque ronde et à chaque conversation.
  Il part chez le fournisseur du modèle, comme les fiches : ni donnée de santé ni donnée personnelle.
- **Avis** : le référent ou un administrateur de l'assistant dit si une ronde était utile, avec un motif ; les huit derniers
  avis sont relus à la ronde suivante. Le destinataire d'un rappel dit s'il était utile, sans droit particulier.
- **Mesure** : la plateforme compte par mois, sur six mois, les rondes (dont échecs et avis), les rappels (dont avis) et les
  fiches validées ou refusées. Le modèle ne calcule rien.

Aucun entraînement de modèle. Limite : rien ne prouve encore que ces textes améliorent les rapports d'un modèle réel ; la
mesure sert à le constater à l'usage.

## Addendum du 12/11/2026 — premier essai avec un modèle réel (Mistral)

Essai du 12/11/2026 avec une clé de test fournie par le RSSI, sur une organisation **fictive** (cinq actions, une mission, un
contexte), modèles `mistral-small-latest` et `mistral-large-latest`. Montage : API et relais réels ; dans le bac à sable de
développement, la sortie passait par un passe-plat local, donc **la connexion HTTPS directe du relais à Mistral n'est pas
vérifiée** (ni Docker).

Constaté :

- **Compatibilité** : le format « chat completions » et l'appel d'outils fonctionnent tels quels avec les deux modèles (test de
  connexion, conversation, ronde).
- **Défaut trouvé et corrigé** : à la première ronde, le petit modèle a écrit dans son rapport avoir envoyé trois rappels sans
  en avoir envoyé aucun. Correction : la plateforme **constate elle-même** ce que la ronde a émis (rappels envoyés ou refusés,
  notes, fiches ; migration `058`, colonne `actions`) et l'affiche sous le rapport ; la consigne interdit au modèle d'en
  parler et impose l'ordre des étapes. Après correction, les deux modèles ont envoyé deux rappels justifiés, essuyé un refus
  (action sans responsable) et rendu un rapport fidèle.
- **Contenu piégé** : une instruction glissée dans la description d'une action n'a été suivie par aucun des deux modèles ;
  tous deux l'ont signalée comme anormale. Un seul essai : ce n'est pas une garantie.
- **Identité** : `lire_element` ne transmet plus l'identifiant du responsable, seulement le fait qu'il est nommé.
- **Consommation** : 29 000 à 42 000 jetons par ronde sur ce petit jeu, 9 à 18 secondes.
- **Limites vues** : le grand modèle écrit en Markdown malgré la consigne (l'écran affiche du texte simple) ; le petit modèle
  répète parfois une lecture. Qualité jugée sur trois rondes seulement, sans jeu d'évaluation.

## Addendum du 12/11/2026 — questions, relances, responsables collectifs, filet de ronde

Réalisé sur `claude/assistant-rssi` (migration `059`) :

- **Questions** (points 9 et 10) : pendant une ronde, l'assistant peut interroger le responsable d'un élément (outil
  `poser_question`, type de notification `assistant_question`). La personne répond depuis ses rappels, **sans droit
  particulier** ; elle seule peut répondre. La réponse est remise à l'assistant **une seule fois**, à la ronde suivante, comme
  une déclaration et non comme une consigne. Une seule question ouverte par élément et par personne ; dix par ronde au plus.
  Le texte de la réponse n'entre pas au journal d'audit. Il part chez le fournisseur du modèle : l'écran le dit à la personne.
- **Relances, par la plateforme et non par le modèle** : au début de chaque ronde, une question sans réponse après le délai
  réglé (3 jours par défaut) est relancée une fois ; sans réponse après un second délai, elle passe « sans réponse » et est
  signalée au référent dans le constat et dans la consigne. Une réponse tardive reste possible.
- **Responsables collectifs** : rappels et questions vont au responsable nommé, sinon aux membres du groupe ou de la fonction
  responsable qui ont accès au périmètre (dix au plus). Le plafond par personne et par jour compte rappels et questions.
- **Lecture des questions** : par le référent des rondes concernées et par les administrateurs de l'assistant.
- **Filet de ronde**, ajouté après essai avec `mistral-small-latest` : une ronde sur deux, ce modèle relevait les retards sans
  écrire à personne. Si le modèle veut conclure sans aucun rappel ni question alors que des retards ont été relevés, la
  plateforme l'y renvoie **une fois**. Les listes disent aussi, pour chaque élément, s'il a un responsable (sans identité).
  Après correction : trois rondes réelles sur trois ont envoyé les deux rappels attendus.
- **Limite constatée** : sur le jeu d'essai, le modèle préfère le rappel à la question ; l'outil de question n'a été exercé
  que par les tests automatisés. À observer en recette.
- **Erreur 404 de la console** (essais navigateur) : `/update/client.js`, script de maintenance servi par la passerelle en
  production, absent du mode développement. Sans rapport avec l'assistant ; rien à corriger.

## Addendum du 12/11/2026 — propositions d'action (point 8)

Réalisé sur `claude/assistant-rssi` (migration `060`) :

- **Dépôt** : pendant une ronde, le profil « Mise en œuvre » peut proposer la création d'une action (outil `proposer_action`),
  avec l'élément qui la motive. Rien n'est écrit dans un registre. Cinq propositions par ronde, trente en attente par profil,
  une seule en attente par élément. Le profil « Audit interne » ne peut pas proposer d'action (point 14).
- **Décision** : droit `assistant:modifier`, par le référent des rondes concernées ou un administrateur de l'assistant. La
  personne corrige au besoin l'intitulé, la description et l'échéance, puis confirme ou rejette, avec un motif facultatif.
- **Confirmation** : l'action est créée par le service du registre (`createObject`), **sous l'identité et avec les droits de la
  personne qui décide** ; sans droit d'écriture sur le module ou le périmètre, rien n'est créé et la proposition reste à
  décider. La justification de l'action porte la mention de l'origine.
- **Rejet** : la proposition n'est pas redéposée tant que l'élément source n'a pas changé de version.
- **Retour** : les huit dernières décisions, avec leur motif, sont relues par l'assistant à chaque ronde ; la mesure mensuelle
  compte propositions confirmées et rejetées.

Reste du point 8 : propositions d'écart, de tâche, d'évaluation d'exigence et de constat d'audit ; notification « proposition
à décider » (les propositions se lisent pour l'instant sur la page de l'assistant).

## Addendum du 12/11/2026 — synthèse hebdomadaire et ronde sur événement (point 9)

Réalisé sur `claude/assistant-rssi` (migration `061`), **inactifs par défaut** :

- **Synthèse de la semaine** : le jour réglé, la ronde quotidienne de chaque profil rend un bilan de la semaine (avancées,
  retards qui durent, questions sans réponse, propositions en attente, trois priorités) à la place du rapport habituel.
- **Ronde sur événement** : le tic de l'API compte, sur les seuls périmètres du profil, les actions qui viennent de dépasser
  leur échéance et les écarts créés depuis la dernière ronde. S'il y en a, une ronde ciblée part, au plus toutes les quatre
  heures par profil. Le compte est fait par la plateforme et ne révèle aucun contenu ; la ronde lit ensuite avec les droits du
  référent. Événements non couverts : nouvelle version d'un document, audit qui approche.

Avec cet addendum, le point 9 (autonomie) est réalisé hors ces deux événements. Vérifié par les tests automatisés ; ni la
synthèse ni la ronde sur événement n'ont été exécutées par un modèle réel.
