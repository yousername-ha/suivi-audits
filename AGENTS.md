# Branche legacy — refonte ASTRA

L’utilisateur a autorisé le 11 octobre 2026 la publication de la copie legacy
locale sur une branche GitHub dédiée, pour permettre son téléchargement et ses tests.
Cette instruction remplace l’interdiction initiale de publication pour cette livraison.

- Branche exclusive de travail et de livraison : `legacy`, conformément à la demande
  explicite du 12 octobre 2026. La refonte ASTRA est intégrée sur cette branche.
- Ne modifier, fusionner ni réécrire aucune autre branche. Conserver `main` et
  `feature/gpt6-evolution-smsi-grc` dans leur état existant.
- Historique indépendant : aucune PR de fusion de cette branche vers l’application
  principale ; aucune CI, release, image Docker ou mise à jour déployée par cette livraison.
- Copie HTML/CSS/JavaScript/JSON : appliquer la navigation et le design ASTRA
  demandés par l’utilisateur, en préservant les fonctions et parcours métier.
- Le périmètre actuel inclut la refonte demandée : périmètres, parcours guidé, CaRE D2, preuves financières et PCRA (BIA/PCA/PRA/exercices), puis navigation. Exécuter les phases dans cet ordre. I et J restent exclus.
- Il inclut désormais l’administration (sans sauvegarde ni mise à jour), les rôles de base,
  les références internes automatiques, le jeu FICTIF et le registre central des risques.
  Séparer risques, études, évaluations, scénarios, mesures et décisions. Les évaluations,
  décisions et politiques sont immuables. La cartographie utilise les références explicites ;
  archiver une étude ou clôturer une action ne supprime ni ne recalcule les risques.
- Il inclut les cartographies historiques contexte/processus et l'ordonnancement
  du menu ; les cartes restent liées aux registres et soumises aux périmètres serveur.
- Les risques se rattachent aux mesures de l’Annexe A ISO 27001:2022 via les
  `objectRefs` bidirectionnels existants. Conserver les liens des plans de traitement ;
  un rattachement ne valide ni la conformité ni le risque résiduel.
- Aucun secret, email personnel, document réel, cookie ni profil navigateur en Git.
  Utiliser une identité de commit anonyme et des fixtures synthétiques.
- Exception explicitement demandée : compte public de test local `admin` / `admin`,
  provisionné par le lanceur Legacy, sans écraser un compte existant. Aucun mot de
  passe réel ni aucune base locale n'est publié.
- Les données restent locales : SQLite et pièces dans `.legacy-data`, exclu de Git.
  Les contrôles de session et de périmètres sont côté serveur. Ne pas exposer
  le serveur localhost sur Internet.
- Conserver les restrictions physiques du dossier auditeur et la validation
  humaine des observations. Ne pas inventer de critères ou d’éligibilité officiels.
- Consigner les tests réellement exécutés, sans attribuer une ancienne CI au nouveau SHA.

Les résultats historiques dans `recette/` concernent la recette locale originale.
Le contrôle de préparation de la branche est documenté séparément.

## Cartographie dynamique — restriction explicite de l’utilisateur

- Ne modifier ni le fonctionnement ni l’interface de la cartographie dynamique
  du module cartographique. Cette restriction prévaut sur le périmètre de refonte
  général décrit plus haut. Les propositions visuelles restent isolées dans `fonctionnalites-en-developpement/` et `references/`.

## Organisation par fonctionnalité — demande du 14 octobre 2026

- Point d’entrée : `fonctionnalites-en-developpement/README.md` et `docs/ORGANISATION-LEGACY.md`.
- Chaque fonctionnalité possède `maquettes/`, `tests/` et `implementation/`.
- Ajouter les nouvelles propositions dans une version `vNNN-description`, mettre à jour
  le catalogue, le statut explicite, les références, les résultats et le téléchargement concerné.
- Le dossier commun est `fonctionnalites-en-developpement/_dossiers-transversaux/socle-astra/` ; les références partagées sont
  dans `references/`. `samples/` conserve uniquement l’orientation et le relevé historique.
- Préserver les versions utiles et les images originales. Les suppressions restent
  soumises à une demande explicite ; le nettoyage des séries 01–19 a déjà été autorisé.
- Les tests techniques ne valent pas validation utilisateur et une maquette ne prouve
  pas une intégration métier. Ne jamais marquer une recette réussie sans exécution.
- Conserver le lien stable `downloads/EBIOS-RM-maquette-Windows.zip` pour la maquette
  courante et publier son empreinte SHA-256 lorsqu’elle est régénérée.
- Ce travail de maquettes et d’organisation reste sur `legacy`. L’agent chargé de
  l’implémentation utilise exclusivement sa propre branche dédiée, selon le prompt
  commun et l’instruction explicite de l’utilisateur ; `legacy` est sa référence en lecture.
- Ne modifier aucune cartographie dynamique, autre branche, donnée privée ni travail
  local étranger à la tâche. Aucun déploiement, aucune CI ni fusion automatique.

## ZIP de test — clarification utilisateur du 14 octobre 2026

- Continuer à publier les ZIP de maquettes sur GitHub, sur `legacy`, pour que l’utilisateur puisse les télécharger et les tester. Ne pas attendre la validation de la maquette pour publier son ZIP de test.
- Marquer clairement les propositions « à valider » : publier un ZIP ne vaut pas validation utilisateur ni autorisation d’intégration en production.
- Consolider le dossier final destiné à l’IA de codage après validation ; l’agent de codage reste limité à sa propre branche.

## Cycle à trois dossiers — dernière demande utilisateur

Cette règle remplace l’ancienne organisation par dossier unique. Les propositions suivent :
`fonctionnalites-en-developpement/` → `fonctionnalites-a-implementer/` → `fonctionnalites-implementees/`.

- Commencer toute nouvelle maquette en développement ; publier son ZIP de test sur GitHub sans attendre sa validation.
- Après validation explicite de la version et du périmètre par l’utilisateur, préparer le dossier technique et graphique complet, puis déplacer le dossier entier vers « à implémenter ».
- Après intégration terminée et vérifiée, consigner branche, SHA et recette, puis déplacer vers « implémentées ». Ne pas déduire une intégration d’un test de maquette.
- Suivre `docs/ORGANISATION-LEGACY.md`, `docs/catalogue-fonctionnalites.json` et le `suivi.json` de chaque fonctionnalité. Mettre à jour tous les liens et manifestes après déplacement.
- Les dossiers transversaux préparatoires sont dans `fonctionnalites-en-developpement/_dossiers-transversaux/`. Le prototype commun est dans `fonctionnalites-en-developpement/_prototype-transversal/`.
- Conserver les ZIP téléchargeables, les versions utiles et les preuves. L’IA de codage reste limitée à sa propre branche ; legacy lui sert de référence en lecture.

## Numérotation stable des fonctionnalités — demande utilisateur

- Chaque fonctionnalité a son propre dossier `NNN-identifiant`, par exemple `003-ebios-rm`, conservé à l’identique lors des passages entre les trois étapes.
- La liste séparée `LISTE-FONCTIONNALITES.md` présente numéro, nom, description courte, étape et lien vers le dossier. Elle est générée depuis `docs/catalogue-fonctionnalites.json` par `python scripts/generer_liste_fonctionnalites.py`.
- Pour une nouvelle fonctionnalité, attribuer `prochainNumero` (sur au moins trois chiffres), puis incrémenter ce compteur. Ne jamais réattribuer ni renuméroter un numéro existant. Conserver une entrée d’historique si une fonctionnalité est retirée.
- Mettre à jour le catalogue, la liste, les liens et `suivi.json` après chaque création, changement de nom, description ou étape. Les dossiers préfixés `_` sont des ressources communes ou modèles, pas des fonctionnalités supplémentaires.

## Consignes courantes — livraison et marqueur « implémentation ok » (19 octobre 2026)

Ces instructions utilisateur remplacent les consignes antérieures contradictoires sur les livrables et le classement.

- Produire et publier les visuels sur `legacy`. **Ne plus générer de ZIP ou BAT sans nouvelle demande explicite.** Conserver les archives historiques.
- Quand la fonctionnalité est prête (version/périmètre validés et dossier technique complet), déplacer tout son dossier numéroté de `fonctionnalites-en-developpement/` vers `fonctionnalites-a-implementer/`, avec maquettes, sources, spécifications UI/UX, contrats, recette et prompt de codage. Ne pas laisser une fonctionnalité prête en développement.
- À chaque reprise, rechercher puis **lire** les fichiers « implémentation ok » des fonctionnalités. Nom conseillé : `implementation/IMPLEMENTATION-OK.md` ; accepter aussi le nom littéral avec espaces/accents, sans imposer une extension. Ne pas créer soi-même un marqueur de livraison pour une simple maquette.
- Lorsque le marqueur confirme l’implémentation de la version concernée, déplacer le dossier complet vers `fonctionnalites-implementees/`. Conserver le marqueur et consigner sa provenance et son contenu utile dans `suivi.json`. C’est une confirmation fournie par l’implémenteur, pas la preuve que Codex a exécuté ses tests. Mentionner « non communiqué » pour les résultats ou SHA absents ; ne pas en inventer.
- Un modèle vide, un exemple ou une annonce de travaux futurs n’est pas une confirmation. Un marqueur limité à une version ne valide pas automatiquement une nouvelle version en développement.
- Si le marqueur est accessible sur la branche de codage, le consulter en lecture seule depuis l’espace Codex ; aucune mutation de cette branche ni de l’espace Claude. L’agent de codage le publie sur sa propre branche ; Codex gère le classement documentaire sur `legacy`.
- Mettre à jour catalogue, liste numérotée, liens, manifestes et historique lors des déplacements. Préserver les modifications locales non commitées.
- Pour 010 : liste et graphique des périmètres sont deux vues des **mêmes objets métier**. Création/modification depuis l’une se répercute dans l’autre et les sélecteurs de la plateforme, via l’API et les identifiants existants. Aucun registre de périmètres parallèle. Le fournisseur externe est une fiche du registre fournisseurs rattachée à un ou plusieurs périmètres, jamais un enfant implicite.

## Périmètres des registres — règle transversale confirmée le 19 octobre 2026

- Un registre (plans d’action, écarts, tâches récurrentes) porte un ou plusieurs périmètres. Ses éléments héritent de ce rattachement ; aucune sélection indépendante de périmètre dans leurs formulaires.
- Les fiches peuvent afficher les périmètres hérités en lecture seule. Le filtre global recherche les registres concernés et leurs éléments. L’héritage est résolu depuis le registre, sans copie métier divergente sur chaque élément.
- Changer de registre actualise le contexte hérité ; les droits, liens, évaluations et traces historiques doivent être contrôlés par le serveur. Ne pas réécrire une validation immuable à la suite d’un changement de périmètre.
- Cette règle corrige les anciennes maquettes : les conserver comme références historiques, pas comme règles concurrentes. Dossier courant : `fonctionnalites-a-implementer/_dossiers-transversaux/implementation-ui-2026-10/README.md`.

## Deux espaces de paramètres — proposition du 20 octobre 2026

- La demande actuelle inclut la **conception des écrans** de sauvegarde/restauration, mises à jour, stack, statistiques de ressources et certificat dans « Paramètres système ». Elle ne lance aucune opération technique réelle.
- « Paramètres plateforme » regroupe configuration métier (échelles, matrices, catalogues), utilisateurs/groupes/droits et préférences communes. La maquette 012 v002 fournit ces points d’entrée ; réutiliser 019 et 022, sans créer de gestion concurrente.
- Deux entrées dans Administration sont proposées, avec cartes à icônes et détails centraux. L’ordonnancement reste à valider. Les métriques et états des captures sont fictifs.

## Personnalisation des paramètres — complément du 20 octobre 2026

- Les échelles doivent permettre création, suppression adaptée à leur statut, ajout/retrait de niveaux, réordonnancement et personnalisation des valeurs, libellés, critères et couleurs. Préserver les versions publiées et leurs usages ; utiliser le catalogue existant.
- Le parcours certificat comporte trois choix : import du certificat de l’organisation, génération autosignée, service Let’s Encrypt / ACME. La livraison actuelle reste une maquette ; aucune émission, clé, opération DNS ou installation réelle n’est autorisée implicitement par ce travail graphique.

## Historique et conservation — demande du 20 octobre 2026

- Prévoir une configuration du nettoyage automatique, activable globalement et par catégorie, avec délais propres aux pièces justificatives, écarts clôturés, actions terminées et autres contenus admissibles.
- Séparer archivage, corbeille récupérable et purge optionnelle après délai. Conserver les usages protégés, les validations immuables et le journal d’audit. Réexaminer les statuts/liens avant traitement ; un aperçu ancien ne vaut pas autorisation de suppression.
- La livraison actuelle est une maquette : aucune tâche serveur, suppression réelle ou opération sur les sauvegardes. Les durées et volumes sont fictifs ; aucun gain de performance n’est attesté par les visuels.

## Notifications et dépendances — demande du 20 octobre 2026

- Contact technique dédié pour alertes de sauvegarde, mises à jour et exploitation. Les notifications métier (actions, tâches, rapports) sont configurées dans les groupes ou profils utilisateurs ; ne pas les ajouter automatiquement aux destinataires techniques.
- Prévoir les connexions mail SMTP/SMTPS adaptées à Exchange Server, Exchange Online et Postfix, et Teams via Workflow. Secrets et URL protégés côté serveur ; aucun envoi réel autorisé par la seule conception de la maquette.
- Avant nettoyage, contrôler le graphe des liens directs/indirects et les versions conservées, éviter les cascades, protéger les fichiers partagés et revérifier les dépendances au moment du traitement. Ne pas confondre suppression de fiche et suppression du fichier physique.

## Journaux et niveaux — demande du 20 octobre 2026

- Prévoir le téléchargement des journaux de traçabilité et des journaux techniques dans Paramètres système, avec filtres et formats adaptés.
- Info, Warning et Debug règlent les logs techniques ; ne jamais désactiver ou réduire la traçabilité métier avec ce réglage. Préserver les traces historiques et contrôler les droits d'export côté serveur.
- La maquette n'utilise que des données fictives. Réutiliser le journal d'audit existant du socle ; documenter les extensions nécessaires sans créer de moteur concurrent.

## Échelles transversales — demande du 20 octobre 2026

- Risques et EBIOS RM utilisent les échelles déclarées dans Paramètres plateforme, leurs versions publiées et identifiants de niveaux. Ne pas créer de barèmes concurrents ni imposer quatre niveaux.
- Préserver les versions des évaluations historiques. Une nouvelle publication ou un archivage ne recalcule pas les résultats passés. La matrice/politique compatible détermine la criticité, pas un calcul frontend implicite.
- Le partage local des maquettes 012 v007 / 003 v002 est illustratif ; l'intégration réutilise le catalogue de configuration et les services d'évaluation du socle.

## Dossiers techniques et contrôle de l’existant — accord du 20 octobre 2026

- Périmètres approuvés pour transmission : 020, 019, 012, 022, 010, 017, 021, 018, 002 et 003. Le 010 a été explicitement inclus par l’utilisateur ; l’ordre technique de référence est `fonctionnalites-a-implementer/_dossiers-transversaux/implementation-ui-2026-10/ORDRE-IMPLEMENTATION.md`.
- Avant de coder chaque fonctionnalité, l’IA doit rechercher ce qui est déjà implémenté dans sa branche, vérifier les comportements et tests, et fournir la preuve par exigence. Si conforme, conserver ; si partiel, compléter le manque ; si absent, réutiliser les briques existantes avant de créer. Documentation seule et CI d’un ancien SHA ne suffisent pas.
- Le dossier technique courant consolide demandes, corrections et critères de recette avec des identifiants stables. L’IA n’a pas à relire la conversation ; les hypothèses restantes sont explicites.
- Un déplacement vers « à implémenter » valide la transmission documentaire, pas une intégration ni un succès serveur. Aucun marqueur « implémentation ok » ne doit être créé pour cette seule préparation.

## Premier lancement et parcours SMSI — 22 octobre 2026

- 023 : assistant de configuration métier entièrement facultatif, reprenable, avec modèles personnalisables et échelles du catalogue commun. Ne pas contourner l’installation/authentification initiale, ne pas écraser une configuration existante.
- 024 : arbre de progression ISO 27001/HDS, sourcé officiellement ; progression distincte de la conformité et de la certification. Les dépendances de travail et modèles UI ne sont pas des prescriptions normatives. Lire les limites et sources avant tout enrichissement.
- Les deux propositions restent en développement jusqu’à validation. Aucun ZIP/BAT ni passage automatique à implémenter.

## Onboarding et sous-actions — précision du 22 octobre 2026

- Premier lancement = onboarding après installation et création de l’administrateur, une fois l’accès authentifié établi ; report complet et reprise ultérieure depuis les paramètres, sans forcer chaque utilisateur à repasser l’assistant.
- Parcours 024 : chaque étape se déplie/replie en sous-actions, avec icône, description et attendu au clic dans une fenêtre centrale. Les attendus restent sourcés et ne créent pas de critères normatifs supposés.

## Parcours intégré à la plateforme — précision du 22 octobre 2026

- Tout élément métier du parcours ISO/HDS doit être accessible dans le module correspondant de la plateforme, avec les mêmes identifiants, versions et permissions. Créations et modifications sont réciproques ; retrouver le travail existant sans duplication.
- Le parcours guide vers les fiches/formulaires existants. Il ne crée pas de registre concurrent, ne contourne pas l’héritage des périmètres et ne confond pas synchronisation, préparation, revue et conformité. Vérifier les contrats réels avant codage ; voir les critères 024-INT-01 à 06 du dossier 024.

## Aperçu mobile hébergé — autorisation du 23 octobre 2026

- L’utilisateur demande un hébergement temporaire de validation de la maquette 024 pour consultation sur téléphone, sans téléchargement. Publication privée via Sites autorisée pour cet aperçu isolé ; elle ne déploie pas l’application GRC et ne change pas les restrictions des autres branches.
- Identité et URL dans `fonctionnalites-en-developpement/024-parcours-iso-hds/maquettes/v005-brume-lueurs/hebergement.json`. Réutiliser ce Site pour ses mises à jour ; ne jamais publier de secret, donnée métier réelle ou credential. Aucun délai d’expiration automatique n’est configuré : ne pas en promettre un.
- Le style v004 est conservé ; v005 ajoute uniquement brume et lueurs discrètes, désactivables et respectant le mouvement réduit. Aucun ZIP/BAT livré à l’utilisateur.
