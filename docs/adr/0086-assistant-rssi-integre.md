# ADR 0086 — Assistant RSSI intégré : agent natif, modèle distant réglable, autonomie bornée, propositions validées

- Statut : **proposée** le 11/11/2026. Numéro 0086 annoncé au RSSI dans la session ; libre sur toutes les branches du dépôt
  à cette date. À accepter par le RSSI avant tout développement.
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
| A1 | Modèle de langage | Point d'accès **réglable**, compatible OpenAI. Le serveur (VPS OVHcloud VPS-2, sans carte graphique) ne peut pas l'héberger : le modèle est **distant**. Mistral est envisagé comme premier fournisseur, à confirmer |
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

## Points ouverts pour le RSSI

1. Accepter cette ADR et confirmer le numéro 0086.
2. Fournisseur du modèle : confirmer Mistral (ou OVHcloud AI Endpoints, qui héberge des modèles Mistral), après lecture
   des conditions et de l'accord de traitement des données.
3. Périmètres ouverts à chaque profil, et personnes destinataires des questions. Exclure ceux qui peuvent contenir des
   données de santé.
4. Dire si une autre session travaille sur `apps/api/src` : le premier lot touche `server.ts`, `http/route.ts` et les
   modules partagés.
5. Réglages par défaut : plafond de notifications (proposition : 5 par personne et par jour), délai de relance d'une
   question (proposition : 5 jours ouvrés), budget quotidien de jetons.
