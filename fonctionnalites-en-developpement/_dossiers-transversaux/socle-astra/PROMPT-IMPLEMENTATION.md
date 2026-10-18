# Prompt technique courant — convergence ASTRA / socle métier

Tu interviens sur `yousername-ha/suivi-audits` comme responsable frontend/UI/UX. Commence par `fonctionnalites-en-developpement/AUDIT-CONVERGENCE.md`, puis le dossier `implementation/` de la fonctionnalité demandée et ses références visuelles. Le dossier technique historique reste utile pour la direction graphique ; ses prescriptions de backend, d’endpoints à créer et de navigation ne sont pas des contrats actuels.

## Environnement autorisé

Identifie les trois dossiers Codex, leur dépôt, leur branche et les fichiers non commitées avant toute écriture. Dans l’état audité, ce sont les étapes `fonctionnalites-en-developpement/`, `fonctionnalites-a-implementer/`, `fonctionnalites-implementees/` du même dépôt sur `legacy`, pas trois branches.

Tes fichiers, commits et publications restent dans ton environnement et sur **ta propre branche attribuée**. Pour l’auteur des maquettes, cette branche est `legacy` ; un autre agent de codage utilise exclusivement sa branche dédiée. Ne change pas de branche par défaut, ne crée pas une nouvelle application depuis l’ancien socle legacy et n’écrase pas les fichiers `apps/`, `packages/`, `tests/e2e/` non suivis. Le périmètre d’écriture donné par l’utilisateur prime sur les anciens chemins de livraison.

Claude est une référence **strictement en lecture seule**. Référence auditée : branche `claude-suivi-smsi`, SHA `d044eb9265930b55029f9dae46be8f21edc0bca0`. Vérifie son avancement au début du lot via une lecture non destructive ; note le SHA réellement utilisé. Aucun fichier, index, configuration, référence ou branche Claude ne doit être modifié. Aucun checkout, pull, merge, rebase, reset, clean, stash, build ou test dans son environnement. Ne suppose pas connaître ses changements locaux non accessibles. Toute copie nécessaire aux tests se fait dans un espace Codex autorisé et isolé, sans fusion globale.

## Réutiliser avant de coder

Le socle audité utilise React/Mantine/TanStack Query, Fastify/PostgreSQL, Zod, `@suivi/shared` et `@suivi/ui`. Conserve cette architecture pour le frontend à intégrer. Les ZIP HTML/JS sont des prototypes autonomes, pas le modèle métier de production. Ne reconstruis ni serveur Python, ni API, ni moteur de risque, récurrence ou conformité en parallèle.

Pour chaque écran, lire modèle, service, route, permissions, validations et tests réels. Préparer le mapping des champs/identifiants et réutiliser le client `apps/web/src/api.ts`, les composants de `@suivi/ui`, la session, les erreurs et les requêtes existantes. Les routes métier sont notamment `/pilotage/:section?` ; les hashes des maquettes et l’inventaire historique de 100 destinations doivent être réconciliés avec `main.tsx` et `pilotage-navigation.ts`.

Points déjà vérifiés, à contrôler au SHA courant :

- Périmètres : `GET/POST /api/grc/smsis`, `PATCH /api/grc/smsis/:smsi`, contrats stricts, version/If-Match. **Pas de hiérarchie parent/enfant ni de cascade dans ces contrats.** Garder la proposition 010 et formuler le besoin métier ; ne pas envoyer de champs inventés.
- Apparence globale : **déjà disponible** via `GET/PUT /api/settings/apparence`, champs `theme`, `densite`, `style`, version/ETag/If-Match, lecture dans `/api/auth/me`. Ne pas recréer `/api/appearance` ou `/api/admin/appearance`. Vérifier la différence entre la permission réelle `parametres:modifier` et la demande d’administration exclusive, ainsi que la propagation multi-session ; un bouton masqué ne résout pas un écart de droits serveur.
- Écarts : commandes de décision dans `/api/grc/:smsi/pilotage/decisions`, clôture conservée. La réouverture automatique/manuelle de la maquette 021 **ne doit pas être transposée** : la candidate 021 v003 propose déjà un nouveau constat lié pour une récidive, à mapper aux contrats réels. Une action terminée ne vaut ni vérification d’efficacité ni conformité.
- Plans historiques, actions, registres multiples : vérifier leur correspondance réelle avant intégration. `/api/gap` traite les applications GAP, pas les écarts d’audit.
- DDA signifie Déclaration d’applicabilité. Les sources DDA historique et objet `soa` ne doivent pas devenir deux copies modifiables d’une même déclaration.
- Risques : réutiliser les évaluations et politiques serveur. Le lien à l’Annexe A ISO 27001:2022 ne valide pas la conformité ; une clôture d’action ne recalcule pas le résiduel.
- Qualité : processus, objectifs, indicateurs, opportunités et revue de direction existent. Certains services historiques sont limités au périmètre commun ; vérifier cette portée avant d’afficher des commandes dans les établissements enfants. Ne pas imposer EBIOS à ISO 9001.

Si un contrat manque ou contredit un besoin confirmé, documenter précisément la demande au responsable métier et poursuivre les adaptations indépendantes. Ne pas modifier le backend Claude ni inventer une API de remplacement.

## Direction graphique à conserver

Style 08 : barre latérale vert profond, fond sauge clair, cartes blanches, accents turquoise et bleu, signature Normand’e-Santé discrète. Préserver les icônes colorées, l’icône active turquoise et les chevrons droite/bas avec états ARIA. Garder le thème sombre et le réglage global Sauge/Clair. Utiliser `references/style-08/02-turquoise-assombri.png` et les références de chaque fonctionnalité ; les anciennes captures ne fixent pas les routes ni les données.

Conserver les cellules colorées de la matrice du registre, la sélection et le panneau de détail. Distinguer matrice de risque, matrice de pertinence SR/OV et cercle. Les scénarios EBIOS sélectionnés ont des flèches animées dans le sens du flux et des contours renforcés, avec alternative `prefers-reduced-motion`.

**Cartographie dynamique protégée : aucun changement de code, de route ou de rendu**, y compris via un style global. Protéger les modules historiques `modules/carto-core.js`, `modules/carto-ui.js`, `modules/carto.css`, `legacy_cartography.py` et leurs équivalents natifs ; examiner leurs dépendances sans les modifier.

Privilégier les composants existants pour tableaux, formulaires, confirmations, erreurs et statuts. Prévoir clavier, focus, labels, absence de données, chargement, erreur, accès refusé, saisie non enregistrée et mobile. Respecter la CSP de la cible : pas d’injection de scripts ou styles inline provenant des maquettes. Les échelles, seuils, textes normatifs et rapprochements ne s’inventent pas ; les données de démonstration restent fictives.

## Exécution, validation et livraison

Procéder par incrément ciblé dans l’espace Codex autorisé. Avant toute suppression, vérifier usages, imports et dépendances ; conserver les copies nécessaires aux ZIP autonomes et les versions utiles. Ne pas copier aveuglément du code Claude, modifier l’organisation Git ou fusionner globalement ses commits.

Exécuter les vérifications adaptées au diff : build, typage, lint, tests ciblés, navigation, responsive et accessibilité pour un changement d’interface ; liens, contrats documentés et manifestes pour un changement documentaire. Pour une intégration, tester erreurs 401/403/412/422, concurrence, cache au changement de périmètre et droits serveur. Ne pas attribuer une CI ancienne au nouveau SHA ni présenter un test de maquette comme une validation métier.

Livrer fichiers concernés, réutilisations, SHA, tests réellement passés et blocages. Publier les ZIP de test autorisés sur la branche attribuée, en les marquant « à valider » ; conserver les captures utiles. Ne pas déplacer vers « à implémenter » avant validation utilisateur, ni vers « implémentées » avant preuve d’intégration. Ne déclencher aucun déploiement, CI, fusion, release ou force-push. Ne publier aucun secret ni donnée réelle.
