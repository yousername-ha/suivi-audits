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
- Cette règle corrige les anciennes maquettes : les conserver comme références historiques, pas comme règles concurrentes. Dossier courant : `fonctionnalites-en-developpement/_dossiers-transversaux/implementation-ui-2026-10/README.md`.
