# Cadrage — module Qualité ISO 9001 (système de management intégré)

**Statut** : réflexion du 13/10/2026, à la demande du RSSI. **Aucun code, aucune migration, aucune décision d'architecture
définitive.** Ce document prépare les décisions du §9 ; l'ADR et les lots (§8) ne démarrent qu'après leurs réponses.

## 1. Cadre et règles de ce travail

- **Source unique** : NF EN ISO 9001:2015 (version française, corps du document, 37 pages) fournie par le RSSI.
  SHA-256 du fichier fourni : `190dc570c72fbb22193ae91426dd08daeebad66036ae74612ff5612c3654f40c` (156 037 octets).
  Le texte est protégé (AFNOR, ISO, CEN) et le dépôt est public : **aucun passage de la norme n'est reproduit** ici ni
  dans le code ; seuls des numéros d'articles et des reformulations très courtes sont employés. À l'implémentation, la
  source sera consignée dans [le registre des sources](../sources-lot-c.json) avec la même mention que les autres
  référentiels (« référence bibliographique, aucun texte reproduit »).
- **Rien d'inventé** : toute exigence citée renvoie à un article du document fourni. Ce que la norme ne dit pas (fréquences,
  critères d'évaluation, correspondances avec l'ISO/IEC 27001) est **laissé à l'organisme** et signalé comme tel.
- **Révision annoncée de la norme (2026)** : le document fourni n'en dit rien et je n'en connais pas le texte. Elle n'est donc
  pas traitée ; la conception ci-dessous la rend absorbable sans refonte (§6).
- **Aucune revendication de conformité** : l'outil aide à piloter et à tracer ; il ne certifie rien et ne remplace ni
  l'audit de certification ni l'avis humain (même règle que pour la 27001 et l'HDS).
- **Limite du document fourni** : les figures 1 et 2 (schéma d'un processus, structure dans le cycle PDCA) ne sont pas
  reproduites dans le PDF. La fiche processus (§4.2) s'appuie sur le texte de l'article 4.4.1, pas sur la figure.
- « **ISO 27001 2007** » : cette édition n'existe pas ; le dépôt retient l'ISO/IEC 27001:2022. **À confirmer (§9, Q1).**

## 2. Ce que demande le RSSI, et ce que la norme en dit

| Demande                                                | Appui dans la norme fournie                                                                                                                                                                                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vision par processus (lien avec la cartographie)       | 0.3 (approche processus, PDCA, risques) ; 4.4.1 a à h : entrées et sorties, séquence et interactions, critères et indicateurs, ressources, responsabilités, risques et opportunités, évaluation, amélioration ; 4.4.2 ; 5.3 ; 8.1.            |
| « Boxes » / tableau de bord d'indicateurs              | 4.4.1 c ; 6.2.1 (objectifs mesurables, surveillés, communiqués) et 6.2.2 (quoi, ressources, responsable, échéances, évaluation) ; 9.1.1 (quoi, comment, quand surveiller et analyser) ; 9.1.2 ; 9.1.3 a à g ; 9.3.2 (entrées de la revue). |
| Revue des fournisseurs commune avec le SMSI            | 8.4.1 (critères d'évaluation, sélection, surveillance des performances, réévaluation ; informations conservées) ; 8.4.2 (type et étendue de la maîtrise) ; 8.4.3 (informations transmises) ; 9.1.3 f ; 9.3.2 c 7 ; A.1 et A.8 (« prestataire externe »). |
| PESTEL                                                 | **Non cité par la norme.** 4.1 et ses notes 1 à 3 : enjeux externes et internes, à « surveiller et revoir ». La note 2 donne comme aide l'environnement juridique, technologique, concurrentiel, commercial, culturel, social et économique. |
| Lien avec les mesures communes ISO 27001               | 0.4 et A.1 : structure alignée sur les autres normes de systèmes de management (« informations documentées » commun, 7.5, A.6). Aucune table de correspondance avec la 27001 n'est fournie.                                                  |
| Actions et tâches récurrentes                          | La norme fixe des « intervalles planifiés ou spécifiés » sans en donner la valeur : 9.2.1 (audits internes), 9.3.1 (revue de direction), 7.1.5.2 (étalonnage), 4.1 et 4.2 (surveiller et revoir), 8.4.1 (réévaluation des prestataires).  |

**Deux points de vigilance de fond**, tirés de l'annexe A :

1. **Pas de méthode de risque imposée** (A.4) : 6.1 exige de planifier des actions face aux **risques et aux opportunités**
   sans processus de management du risque documenté. Il ne faut donc pas imposer EBIOS RM ni l'ISO/IEC 27005 au volet
   qualité ; le registre commun peut être réutilisé, mais le choix de méthode reste celui de l'organisme.
2. **Pas d'« exclusions »** (A.5, 4.3) : une exigence peut être jugée non applicable seulement si cela n'empêche pas de
   fournir des produits et services conformes ; la justification est une information documentée. Le champ « Exclusions et
   justification » du contexte, la DdA et l'applicabilité du Pilotage portent déjà ce mécanisme.

## 3. Ce que le dépôt fournit déjà (état 78ba57e, version 3.1.0)

Constat de lecture du code et de l'inventaire fonctionnel, pas une preuve de conformité à la norme.

| Besoin                          | Existant (fonction du registre)                                                                                                                                                                     | Écart pour la 9001                                                                                                                                                  |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Processus                       | Objet `process` (mission, entité, périmètre), vue « Processus », cartographie des processus par familles pilotage / réalisation / support (FCT-008, FCT-019)                                          | Pas de champs « entrées, sorties, ressources, séquence » ; pas d'indicateurs de santé par processus sur la carte                                                    |
| Indicateurs et objectifs        | Objets `objective` et `indicator`, séries de valeurs, calcul de l'état atteint / non atteint / non mesuré, graphiques SVG du tableau de bord (FCT-019, FCT-041)                                     | Rattachement indicateur ↔ processus à préciser ; pas de vue par processus ; certains calculs automatiques lisent les fournisseurs historiques (`saasMfa`, `saasSso`)   |
| Contexte et parties intéressées | Objets `context` (enjeux, exclusions), `stakeholder` (besoins, exigences), `swot` ; enjeux interne/externe sur la carte (FCT-018, FCT-008)                                                           | Pas de classement des enjeux externes par facteur ; pas de revue périodique tracée                                                                                  |
| Fournisseurs                    | Registre **historique** dans `app_state` (contrôles avec fréquence, dernière date, résultat), `ecosystem_party` pour EBIOS, liens vers `supplier` (FCT-031, **NON VÉRIFIÉ**, aucun parcours Sauge)       | **Prérequis** : reprise native du registre fournisseurs et de leurs revues avant d'y ajouter une lecture 9001                                                       |
| Référentiels et mesures         | Référentiels publiés immuables, exigences, mesures (module audit), correspondances révisables, applicabilité ; livrés **vides**, importés par l'administrateur (FCT-020, FCT-030)                      | Aucun référentiel 9001 ; la cartographie exclut volontairement l'ISO 9001 de ses filtres (ADR 0013, point 7 : à réviser)                                            |
| Actions et récurrences          | Objet `task_series`, moteur de récurrence (unité, intervalle, fuseau, fin), occurrences idempotentes, cinq vues, rappels internes (FCT-021)                                                          | Aucun modèle de série rattaché à un article de norme                                                                                                                |
| Audit, revue, amélioration      | Audit interne et programme (FCT-028, partiel), revue de direction (FCT-037, non vérifié de bout en bout), causes, actions, efficacité, clôture (FCT-025)                                              | Entrées de revue propres à la 9001 (9.3.2) ; audit combiné SMSI + SMQ                                                                                              |
| Liens transverses               | Catalogue de relations : toute paire non prévue est refusée (422), « Lié à » reste ouvert (FCT-043, ADR 0028)                                                                                         | Paires nouvelles à déclarer explicitement (§4.6)                                                                                                                    |

Enfin, `docs/PILOTAGE.md` indique déjà que l'ISO 9001 peut être importée comme référentiel par qui détient les droits.

## 4. Conception proposée

**Principe directeur : une seule saisie, plusieurs lectures** (déjà posé par l'ADR 0023). Le volet qualité n'est pas un
second silo : c'est une lecture 9001 des mêmes objets (processus, indicateurs, risques, actions, audits, revues,
fournisseurs) du même périmètre, éventuellement partagé avec le SMSI.

### 4.1 Référentiel ISO 9001:2015 comme publication

- Une publication de référentiel **importée par l'administrateur** (mécanisme existant, publications immuables), **livrée
  vide**. Les exigences portent le numéro d'article et l'intitulé choisi par l'organisme ; aucun texte de la norme n'est
  embarqué. Granularité : à décider (§9, Q3) ; je recommande l'article, et l'alinéa seulement là où la norme énumère
  (4.4.1 a à h, 6.2.2 a à e, 9.1.3 a à g).
- L'édition est une **donnée** (version de la publication), jamais une constante du code : c'est ce qui permet d'accueillir
  l'édition 2026 sans refonte (§6).
- **Correspondances 9001 ↔ 27001** : aucune livrée. Elles sont rédigées et validées par le RSSI dans l'écran existant
  (« Correspondances entre exigences », révisables), marquées « proposition organisationnelle », comme les matrices du
  lot C. C'est ce qui alimente la **vue commune** des mesures : une mesure 27001 liée à une exigence 9001 est visible
  des deux côtés, avec sa mise en œuvre et ses preuves, sans double saisie.

### 4.2 Vision par processus et lien avec la cartographie

- **Fiche processus** enrichie, un champ par point de 4.4.1 : entrées attendues, sorties attendues, séquence et
  interactions (liens entre processus, déjà dessinables sur la carte), critères et méthodes de maîtrise, indicateurs
  associés, ressources, responsable (rôle de `governance`), risques et opportunités liés, évaluation et amélioration.
  Champs additifs sur l'objet existant : pas de nouvelle table, à confirmer à l'ADR (migration éventuelle seulement si le
  schéma strict l'exige).
- **Carte des processus** : calque « santé des indicateurs » (couleur d'état par processus, calculée à partir des
  indicateurs liés) et filtre « ISO 9001 » (réviser la décision de l'ADR 0013). La carte reste une projection, jamais une
  source de saisie.
- Les trois familles actuelles (management, réalisation, support) sont conservées ; la norme n'en impose aucune.

### 4.3 Boxes et tableau de bord qualité

- Une « box » par **processus** (et, en vue secondaire, par **objectif**) : valeur et cible des indicateurs, état,
  tendance sur la série, actions ouvertes, non-conformités ouvertes, prochaine échéance récurrente, risques liés. Les
  calculs d'état existent déjà (`valeurIndicateur`, `etatIndicateur`) ; le composant graphique reprend `packages/ui`.
- Une box = un contrôle de 9.1.1 : « ce qui est surveillé, comment, quand, quand analysé ». Ces quatre informations
  deviennent des champs de l'indicateur, **vides par défaut** : la norme n'impose ni valeur ni fréquence.
- Indicateurs de **satisfaction du client** (9.1.2) : la norme demande de surveiller la perception ; la source (enquête,
  réclamations, retours) est choisie par l'organisme. Aucune formule imposée ; saisie manuelle ou import.
- Les chiffres restent des indicateurs d'aide au pilotage : jamais un « taux de conformité » certifié.

### 4.4 Revue des fournisseurs commune avec le SMSI

- **Prérequis** : reprise native du registre fournisseurs (FCT-031) avec ses revues et ses contrôles à fréquence, car
  aujourd'hui il n'existe que dans l'outil historique.
- Ensuite, **une seule revue par fournisseur**, deux grilles de lecture : SMSI (contrôles et références déjà portés) et
  9001 8.4 (critères d'évaluation et de sélection, surveillance de la performance, réévaluation, type et étendue de la
  maîtrise, informations transmises au prestataire, avec 9.1.3 f pour l'analyse). Les **critères** sont ceux de l'organisme :
  la norme exige d'en définir, elle n'en fournit pas.
- La revue périodique réutilise une série récurrente ; son résultat nourrit l'entrée « performances des prestataires
  externes » de la revue de direction (9.3.2 c 7).
- Question de modélisation à trancher à l'ADR : nouveau type d'objet `supplier` du registre commun ou réutilisation de
  `ecosystem_party` (§9, Q5). Je ne tranche pas avant d'avoir lu les usages d'EBIOS.

### 4.5 PESTEL

- La norme n'exige pas PESTEL : c'est **une présentation facultative** des enjeux externes de 4.1. L'outil l'offre comme
  nomenclature organisationnelle (le catalogue métier de l'outil gère déjà des nomenclatures), pas comme exigence.
- Attention : les facteurs « politique » et « environnemental » ne figurent pas dans la note 2 de 4.1 (juridique,
  technologique, concurrentiel, commercial, culturel, social, économique). Ils peuvent être ajoutés par l'organisme, mais
  l'écran ne doit pas laisser croire que la norme les demande (§9, Q7).
- Chaque facteur est un **enjeu externe** relié aux risques et opportunités (6.1) et aux processus concernés ; la vue
  PESTEL est un regroupement des enjeux existants, et non un nouvel objet. Les enjeux **internes** (valeurs, culture,
  connaissances, performance, note 3) restent dans le SWOT / contexte.
- La surveillance et la revue de 4.1 et 4.2 donnent lieu à une série récurrente, à fréquence choisie par l'organisme.

### 4.6 Liens transverses

Paires à déclarer dans le catalogue de relations (ADR 0028), une par une, avec leurs tests : processus ↔ indicateur,
processus ↔ fournisseur, enjeu externe ↔ risque ou opportunité, enjeu ↔ processus, exigence 9001 ↔ mesure, revue
fournisseur ↔ revue de direction. Aucune paire n'est ouverte en bloc.

### 4.7 Actions et tâches récurrentes

Pas de nouveau moteur : modèles de séries du moteur existant, **proposés sans fréquence** (l'organisme choisit, la norme
n'en fixe pas) et rattachés à l'article qui les motive. Candidats strictement tirés du texte :

| Série candidate                                      | Article |
| ---------------------------------------------------- | ------- |
| Programme d'audits internes (intervalles planifiés)  | 9.2.1   |
| Revue de direction (intervalles planifiés)           | 9.3.1   |
| Revue des enjeux et des parties intéressées          | 4.1, 4.2 |
| Surveillance, mesure et analyse des indicateurs      | 9.1.1   |
| Réévaluation des prestataires externes               | 8.4.1   |
| Étalonnage / vérification des équipements de mesure  | 7.1.5.2 |
| Revue des risques et des opportunités                | 6.1     |
| Vérification de l'efficacité des actions correctives | 10.2.1  |

Créer une série reste une action explicite de l'utilisateur ; rien n'est planifié par défaut.

### 4.8 Droits, modules et navigation

- Deux options à arbitrer (§9, Q2) : **(a)** un groupe « Qualité » dans le Pilotage, sans nouveau module RBAC, avec un
  indicateur de référentiel actif ; **(b)** un module d'activation `qualite` avec ses propres droits (nouvelle ligne de la
  matrice, migration RBAC, dépendances dans `modules.ts`). Recommandation : (a) pour le premier lot, (b) seulement si le
  RSSI veut séparer les droits du responsable qualité. L'activation par périmètre et l'absence de perte de données
  (FCT-014) restent la règle.

## 5. Correspondance par article (couverture visée, hors exigences de réalisation)

| Articles                      | Lecture dans l'outil                                                                                                    | État                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| 4.1, 4.2, 4.3                 | Contexte, parties intéressées, SWOT, vue PESTEL, exclusions justifiées                                                  | Existant + vue à créer                |
| 4.4                           | Fiche processus et carte                                                                                                | À étendre                             |
| 5.1 à 5.3                     | Responsabilités (`governance`), politique en information documentée (module documents)                                 | Existant                              |
| 6.1                           | Registre des risques commun ; **opportunités** à traiter (aujourd'hui le SWOT n'a qu'un champ libre) ; méthode au choix | Écart : opportunités                  |
| 6.2                           | Objectifs, indicateurs, plan d'actions (quoi, ressources, responsable, échéance, évaluation)                            | Existant, champs à compléter          |
| 6.3                           | Planification des modifications                                                                                         | Écart : pas d'objet dédié identifié   |
| 7.1 à 7.4                     | Ressources et connaissances (champ de `governance`), compétences, sensibilisation, communication                        | Écart : compétences, communication    |
| 7.5                           | Documents versionnés et chiffrés                                                                                         | Existant                              |
| 8.1 à 8.3, 8.5 à 8.6          | Hors périmètre fonctionnel de l'outil : seule la **preuve** (documents, contrôles) peut y être rattachée                 | Preuves seulement                     |
| 8.4                           | Revue des fournisseurs commune                                                                                           | Prérequis FCT-031                     |
| 8.7, 10.2                     | Non-conformités, causes, actions, efficacité, clôture                                                                    | Existant (FCT-025)                    |
| 9.1, 9.1.2, 9.1.3             | Indicateurs, satisfaction du client, analyse                                                                             | À compléter                           |
| 9.2                           | Audit interne, programme, constats                                                                                      | Partiel (FCT-028) ; audit combiné     |
| 9.3                           | Revue de direction avec les entrées de 9.3.2                                                                            | Non vérifié de bout en bout (FCT-037) |
| 10.1, 10.3                    | Amélioration continue                                                                                                   | Existant                              |

Je ne propose **aucune fonction de réalisation** (conception, production, libération, après livraison) : ce sont des
activités métier de chaque organisme, que l'outil trace sans les piloter.

## 6. Prise en compte de la révision 2026

- Les référentiels sont des **publications immuables et versionnées** ; la 2026 sera une publication de plus, importée
  quand son texte officiel sera fourni, et non une modification du code.
- Les **correspondances révisables** entre publications (2015 → 2026) permettent de reporter risques, mesures, preuves et
  indicateurs sans ressaisie, avec revue humaine des écarts.
- Aucun numéro d'article ni aucune édition ne sera écrit en dur dans le code ; les libellés viennent de la publication.
- Dès que le texte 2026 est publié, il sera relu avec cette même méthode (source consignée, aucun texte reproduit).

## 7. Données, sécurité et recette

- Données de départ **vides**, fixtures anonymisées, aucun texte normatif dans le dépôt public (mêmes règles que les autres
  référentiels).
- Droits : lecture / modification par module existant, journal d'audit des modifications, concurrence optimiste, SSE
  filtré, comme pour le Pilotage.
- Recette prévue par lot : tests Vitest (calculs d'état, droits, refus 422 des paires non prévues), parcours Playwright,
  accessibilité axe-core (14 écrans + nouveaux écrans), performance sur le volume cible. Les cas de test seront ajoutés au
  registre documentaire avec leurs limites, sans passer un cas non exécuté pour réussi.
- Charte : le module suit la charte graphique du dépôt ; **il attendra le design en cours de préparation par le RSSI** pour
  ne pas figer d'écrans avant lui.

## 8. Lots proposés (ordre, sans calendrier)

| Lot | Contenu                                                                                          | Migration            |
| --- | ------------------------------------------------------------------------------------------------ | -------------------- |
| Q0  | Réponses du §9, ADR 0030, registre des sources, révision de l'ADR 0013 (filtre 9001)              | aucune               |
| Q1  | Référentiel 9001 importable, exigences, usage des correspondances 9001 ↔ 27001 par le RSSI       | aucune attendue      |
| Q2  | Fiche processus 4.4.1, lien indicateurs ↔ processus, calque « santé » sur la carte               | additive éventuelle  |
| Q3  | Indicateurs et objectifs (6.2, 9.1), **boxes** et tableau de bord qualité                         | aucune attendue      |
| Q4  | Reprise native des fournisseurs (FCT-031), puis revue commune SMSI + 8.4                          | additive             |
| Q5  | Contexte, vue PESTEL, parties intéressées, opportunités (6.1), séries récurrentes proposées      | additive éventuelle  |
| Q6  | Revue de direction (9.3.2) et audit combiné SMSI + SMQ, amélioration continue                    | aucune attendue      |
| Q7  | Recette, accessibilité, performance, documentation, réévaluation du registre                      | aucune               |

Chaque lot : branche `claude-suivi-smsi`, PR vers `main` après CI verte, CHANGELOG, retour arrière décrit, registre
réévalué à la fin du lot.

## 9. Décisions attendues du RSSI

1. **Q1** — « ISO 27001 2007 » : est-ce bien l'**ISO/IEC 27001:2022** retenue par le dépôt ?
2. **Q2** — Droits : groupe « Qualité » dans le Pilotage sans nouveau module RBAC (recommandé), ou module `qualite` avec droits
   dédiés ?
3. **Q3** — Granularité des exigences 9001 : article seul, ou article + alinéas énumérés (recommandé) ?
4. **Q4** — Périmètre : le SMQ et le SMSI partagent-ils le **même périmètre** (un seul SMI) ou des domaines d'application
   distincts (4.3) ? Le modèle sait gérer les deux ; l'écran change.
5. **Q5** — Fournisseurs : reprise native d'abord (recommandé), et réutiliser `ecosystem_party` ou créer le type `supplier` ?
6. **Q6** — Critères d'évaluation et de réévaluation des fournisseurs : à fournir par l'organisme (la norme n'en donne pas) ;
   existe-t-il déjà une grille ?
7. **Q7** — PESTEL : accepter les six axes comme nomenclature **organisationnelle**, en précisant que la norme ne les exige
   pas, et que « politique » et « environnemental » vont au-delà de la note 2 de 4.1 ?
8. **Q8** — Opportunités (6.1) : les ajouter comme nature du risque commun, ou comme objet séparé ?
9. **Q9** — Révision 2026 : me transmettre le texte officiel (même format) dès qu'il est publié ; d'ici là, rien n'en est
   supposé.
10. **Q10** — Articulation avec le **design** que vous préparez : le module est-il à concevoir dans la nouvelle charte dès le
    départ ?

## 10. Ce que ce cadrage n'établit pas

Il ne prouve ni la conformité à l'ISO 9001, ni l'équivalence avec une autre norme, ni la faisabilité chiffrée des lots (non
estimés), ni la couverture des exigences de réalisation (§5). Les états « existant » du §3 sont des constats de lecture
du code à 78ba57e et de l'inventaire fonctionnel ; ils seront vérifiés lot par lot.
