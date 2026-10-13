# Cadrage — module Qualité ISO 9001 (système de management intégré)

**Statut** : réflexion du 13/10/2026, à la demande du RSSI, **mise à jour le même jour avec ses décisions (§1 bis)**. Aucun code, aucune migration. L'ADR 0030 ([proposée](../adr/0030-perimetre-agnostique-qualite-fournisseurs.md))
consigne les décisions structurantes ; les lots (§8) ne démarrent qu'après les réponses restantes du §9.

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
- « **ISO 27001 2007** » : cette édition n'existe pas ; le RSSI a confirmé l'**ISO/IEC 27001:2022** (décision D1).

## 1 bis. Décisions du RSSI (13/10/2026)

| Id | Décision | Effet sur ce cadrage |
| -- | -------- | -------------------- |
| D1 | Le référentiel de sécurité est l'**ISO/IEC 27001:2022**. | Plus d'ambiguïté d'édition. |
| D2 | **Groupe « Qualité » dans le Pilotage**, sans nouveau module de droits. | §4.8. |
| D3 | La solution est **agnostique au démarrage** : si le SMQ et le SMSI ont le même périmètre, ils le **partagent au sein d'un SMI**. | §4.9. |
| D4 | **Gestion des périmètres d'un côté**, à laquelle on **attache un référentiel, une méthode de risque, etc.**, pour créer un SMSI, un SMQ, un SMI… | §4.9 : nouvelle page « Périmètres » et, plus loin, bibliothèque de référentiels. |
| D5 | **Gestion des fournisseurs à part**, dans le Pilotage, en lien avec les critères de l'ISO/IEC 27001:2022, de l'HDS et de l'ISO 9001. Un fournisseur évalué peut être rattaché à **plusieurs périmètres** ; **son évaluation ne change pas selon le périmètre**. | §4.4 réécrit : fournisseur et évaluation **hors périmètre** (migration additive). |
| D6 | **Pas de grille d'évaluation des fournisseurs pour le moment.** | Livraison **sans grille**, critères saisis par l'organisme. |
| D7 | Granularité des exigences 9001 : **article + alinéas énumérés** (Q3). | §4.1. |
| D8 | **PESTEL ajouté**, même si la norme ne l'exige pas (Q7). | §4.5. |
| D9 | **On n'attend pas le texte de la révision 2026** : on construit avec l'édition 2015 fournie, et le mécanisme de versions absorbera la suivante. | §6 ; Q9 close. |
| D10 | **Bibliothèque de référentiels au niveau de l'organisation** : c'est le **cœur** du chantier, pour s'évaluer sur plusieurs référentiels à la fois **sans refaire les mêmes déclarations**. | [ADR 0031](../adr/0031-bibliotheque-de-referentiels.md) ; lots M2 et M3. |
| D11 | Une action, un constat ou un rappel issu d'une évaluation de fournisseur naît **dans un périmètre choisi à la création** (par défaut le périmètre courant). | §4.4 ; Q12 close. |
| D12 | La page « Périmètres » est ouverte au **rôle de Pilotage** : droit `pilotage:administrer`, déjà exigé pour créer un périmètre (RSSI, administrateur). | §4.9 ; Q14 close. |
| D13 | **Les fonctionnalités d'abord, le style ensuite** : le RSSI fournira rapidement un style proche de l'actuel ; aucun écran n'est figé sur un style d'ici là. | §7 ; Q10 close. |

Reste ouverte (§9) : **Q8**, les opportunités de 6.1 (expliquée en clair), et Q15, une règle d'affichage proposée par ADR 0031.

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
| Périmètres | Table `grc_smsis` (nom, texte du périmètre, visibilité, méthode de risque, fuseau, politique métier, membres) ; API de lecture **et de création** (`/api/grc/smsis`) ; un périmètre « Pilotage de l'organisation » créé à l'initialisation | **Aucun écran de gestion** : l'interface ne fait que lire la liste (sélecteur). Pas de nature (SMSI, SMQ…), pas de rattachement de référentiel hors publication dans le périmètre (D4) |
| Fournisseurs | Registre **historique** à l'échelle de l'instance dans `app_state` (contrôles avec fréquence, dernière date, résultat), références déjà résolues par le registre commun, `ecosystem_party` pour EBIOS (FCT-031, **NON VÉRIFIÉ**, aucun parcours Sauge) ; les objets du registre commun (contrôle, action, série) portent un **périmètre obligatoire** | Gestion des fournisseurs **hors périmètre** à créer (D5, §4.4) ; aucune grille d'évaluation (D6) |
| Référentiels et mesures | Référentiels **publiés dans chaque périmètre** (versions immuables par périmètre), exigences, mesures (module audit), correspondances révisables et validées par périmètre, applicabilité ; livrés **vides**, importés par l'administrateur (FCT-020, FCT-030) | Aucun référentiel 9001 ; pas de bibliothèque commune à plusieurs périmètres ; la cartographie exclut volontairement l'ISO 9001 de ses filtres (ADR 0013, point 7 : à réviser) |
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
  embarqué. Granularité (**décision D7**) : l'article **et** les alinéas là où la norme énumère (par exemple 4.4.1 a à h,
  6.2.2 a à e, 9.1.3 a à g, 8.4.1 à 8.4.3).
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

### 4.4 Gestion des fournisseurs du Pilotage, indépendante des périmètres (décisions D5 et D6)

**Principe** : le fournisseur et son évaluation appartiennent à **l'organisation**, pas à un périmètre. Un périmètre ne fait que
**rattacher** des fournisseurs et **lire** leur évaluation. Un fournisseur évalué une fois l'est pour tous les périmètres où
il est rattaché ; son évaluation ne change pas selon le périmètre.

**Correction de ma proposition précédente.** J'avais prévu des critères sous forme de contrôles du plan de contrôle, sans
migration. Or les objets du registre commun (`control`, `action`, `task_series`) ont un périmètre **obligatoire**
(`smsi_id`) : y stocker l'évaluation la rattacherait à un périmètre, ce que D5 interdit. Cette partie de la proposition **ne
tient plus**. En revanche le registre historique des fournisseurs est déjà à l'échelle de l'instance.

**Proposition** (à confirmer à l'ADR) :

- **Registre** : le module présente et édite le registre historique existant sous verrou, comme la DdA, **sans copie** ;
  l'identité d'un fournisseur reste son identifiant historique. Droits : module `fournisseurs` existant.
- **Évaluation au niveau de l'organisation** : structure propre, **sans périmètre**, par **migration additive** : critères
  d'évaluation définis par l'organisme ; évaluations **datées et immuables** (résultat, justification, auteur, date, version
  du critère) avec historique conservé. Il n'existe qu'une évaluation courante par fournisseur ; aucun périmètre n'en détient de
  copie.
- **Rattachement** : lien fournisseur ↔ périmètre (plusieurs à la fois), **sans donnée d'évaluation**. Retirer un
  rattachement ne supprime ni le fournisseur ni son évaluation.
- **Critères et exigences** : un critère peut être relié à des exigences **de la bibliothèque de référentiels** (§4.9,
  ADR 0031), désignées comme dans le registre commun, sans dépendre d'un périmètre. Un périmètre n'affiche, par
  référentiel, que les critères reliés aux référentiels qui lui sont rattachés. Côté **ISO 9001** je peux déjà indiquer le
  rattachement, car j'en ai le texte : 8.4.1 (critères d'évaluation, de sélection, de surveillance et de réévaluation,
  informations conservées), 8.4.2 (type et étendue de la maîtrise), 8.4.3 (informations transmises au prestataire), 9.1.3 f et
  9.3.2 c 7. Côté **ISO/IEC 27001:2022** et **HDS**, je ne cite aucune exigence : aucune source ne m'a été fournie dans cette
  session ; elles viendront des référentiels que vous importerez, ou de votre relecture.
- **Sans grille** (D6) : au démarrage, aucun critère, aucune fréquence, aucun seuil ; l'écran propose d'en créer.
- **Écarts, actions et rappels** : une action ou un constat naît **dans un périmètre** (ce sont des objets de périmètre).
  L'utilisateur choisit ce périmètre à la création, par défaut le périmètre courant (**décision D11**), et l'objet garde un
  lien vers l'évaluation. Il en va de même pour la série de ré-évaluation périodique.
- **Lectures par périmètre** (sans copie) : fournisseurs rattachés, évalués, non évalués, à réévaluer ; ces lectures nourrissent
  l'entrée « performances des prestataires externes » de la revue de direction (9.3.2).
- Les contrôles historiques existants (champ de référence libre, fréquence, dernière date) restent lisibles tels quels ; leur
  conversion en critères d'évaluation est une action explicite et simulée, jamais automatique. Les indicateurs calculés
  qui lisent aujourd'hui ce registre (`saasMfa`, `saasSso`) sont inchangés.

### 4.5 PESTEL (décision D8)

- Le PESTEL est **ajouté**, bien que la norme ne l'exige pas : c'est une **présentation facultative** des enjeux externes de
  4.1. Les six axes (politique, économique, social, technologique, environnemental, légal) forment une **nomenclature
  organisationnelle** paramétrable (le catalogue métier gère déjà des nomenclatures).
- Un court texte d'information sur l'écran précise que la norme ne l'exige pas, et que « politique » et « environnemental »
  vont au-delà de la note 2 de 4.1 (juridique, technologique, concurrentiel, commercial, culturel, social, économique) :
  l'écran ne doit pas laisser croire le contraire.
- Chaque facteur est un **enjeu externe** relié aux risques et opportunités (6.1) et aux processus concernés ; la vue PESTEL
  est un regroupement des enjeux existants, et non un nouvel objet. Les enjeux **internes** (valeurs, culture, connaissances,
  performance, note 3) restent dans le SWOT / contexte.
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

### 4.8 Droits, modules et navigation (décision D2)

- **Groupe « Qualité » dans le Pilotage**, sans nouveau module RBAC ni nouvelle ligne de la matrice des droits : les droits
  des objets partagés restent ceux de leurs modules (pilotage, écarts, documents, audit, fournisseurs). Ce choix est
  réversible : si le RSSI veut un jour séparer les droits d'un responsable qualité, un module `qualite` pourra être ajouté
  sans refaire les données.
- Le groupe n'apparaît que si un référentiel qualité est actif dans le périmètre (§4.9) ; l'activation par périmètre et la
  conservation des données (FCT-014) restent la règle.
- **Fournisseurs** : une entrée du Pilotage qui s'appuie sur le module `fournisseurs` existant (§4.4).

### 4.9 Gestion des périmètres, SMI et bibliothèque de référentiels (décisions D3 et D4)

- **Constat de lecture** : un périmètre est une ligne de `grc_smsis` (nom, texte du périmètre, visibilité, méthode de risque,
  fuseau, politique métier, membres). L'API sait **lister et créer** des périmètres ; l'interface web ne fait que les lire. Le
  conteneur s'appelle « SMSI » dans le code et l'interface, mais rien n'y est propre à la sécurité. Chaque objet du registre
  commun appartient à **un** périmètre.
- **Nouvelle page « Périmètres »** (niveau organisation) : créer et modifier un périmètre, lui donner une **nature** (SMSI,
  SMQ, SMI, autre : simple étiquette, sans règle de comportement) et lui **rattacher** : référentiels, méthode de risque et
  politique métier (qui existent déjà), membres (existent déjà) et fournisseurs (§4.4). **Agnostique** : aucune nature ni
  référentiel n'est requis au démarrage, et aucune vue 9001 n'apparaît tant qu'un référentiel 9001 n'est pas rattaché.
- **SMI** : ce n'est pas un nouvel objet, c'est un périmètre où plusieurs référentiels (27001:2022, HDS, 9001) sont rattachés ;
  processus, indicateurs, risques, actions, audits et revues y sont saisis une fois et lus selon chaque référentiel. **SMQ et
  SMSI distincts** : deux périmètres. Ce qui est transverse (fournisseurs, évaluations, bibliothèque de référentiels et leurs
  correspondances) vit au niveau organisation.
- **Bibliothèque de référentiels (décision D10, [ADR 0031](../adr/0031-bibliotheque-de-referentiels.md))** : aujourd'hui un
  référentiel est **publié dans chaque périmètre** et ses correspondances sont validées par périmètre. La cible est une
  **bibliothèque au niveau de l'organisation** : on importe un référentiel **une fois**, on le **rattache** à plusieurs
  périmètres (version précise, changement explicite), et ses **correspondances** se valident **une fois**. La mesure d'un
  périmètre est l'**unité de déclaration** : elle peut mettre en œuvre des exigences de plusieurs référentiels, et une
  correspondance validée fait apparaître l'exigence équivalente comme « **couverte par correspondance** », en lecture seule,
  distincte de la couverture explicite et exclue des taux. Les référentiels déjà publiés dans un périmètre continuent de
  fonctionner sans changement ; une promotion vers la bibliothèque est explicite et simulée.
- **Droits (décision D12)** : créer, modifier un périmètre et lui rattacher un référentiel exigent `pilotage:administrer`,
  c'est-à-dire le rôle de Pilotage (RSSI, administrateur), comme l'exige déjà la création d'un périmètre.
- **Vocabulaire** : le libellé « SMSI » du conteneur devient neutre (« périmètre de management ») dans l'interface, avec le
  design (Q10) ; les noms techniques (`grc_smsis`, `/api/grc/smsis`) ne changent pas.

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
| 8.4                           | Revue des fournisseurs commune                                                                                           | Gestion des fournisseurs (§4.4, M4)   |
| 8.7, 10.2                     | Non-conformités, causes, actions, efficacité, clôture                                                                    | Existant (FCT-025)                    |
| 9.1, 9.1.2, 9.1.3             | Indicateurs, satisfaction du client, analyse                                                                             | À compléter                           |
| 9.2                           | Audit interne, programme, constats                                                                                      | Partiel (FCT-028) ; audit combiné     |
| 9.3                           | Revue de direction avec les entrées de 9.3.2                                                                            | Non vérifié de bout en bout (FCT-037) |
| 10.1, 10.3                    | Amélioration continue                                                                                                   | Existant                              |

Je ne propose **aucune fonction de réalisation** (conception, production, libération, après livraison) : ce sont des
activités métier de chaque organisme, que l'outil trace sans les piloter.

## 6. Prise en compte de la révision 2026 (décision D9 : on n'attend pas)

- On construit **maintenant** avec l'ISO 9001:2015 fournie. La révision ne conditionne aucun lot.
- Les référentiels de la bibliothèque sont des **versions immuables** ; la prochaine édition sera une version de plus,
  importée quand son texte officiel sera fourni, et non une modification du code.
- Une **correspondance entre versions** (2015 → suivante) permet de reporter liens, preuves et déclarations avec revue
  humaine des écarts, via le mécanisme de changement de version de l'ADR 0031.
- Aucun numéro d'article ni aucune édition n'est écrit en dur dans le code ; les libellés viennent de la version importée.

## 7. Données, sécurité et recette

- Données de départ **vides**, fixtures anonymisées, aucun texte normatif dans le dépôt public (mêmes règles que les autres
  référentiels).
- Droits : lecture / modification par module existant, journal d'audit des modifications, concurrence optimiste, SSE
  filtré, comme pour le Pilotage.
- Recette prévue par lot : tests Vitest (calculs d'état, droits, refus 422 des paires non prévues), parcours Playwright,
  accessibilité axe-core (14 écrans + nouveaux écrans), performance sur le volume cible. Les cas de test seront ajoutés au
  registre documentaire avec leurs limites, sans passer un cas non exécuté pour réussi.
- Charte (décision D13) : on crée les **fonctionnalités d'abord** avec les composants actuels, sans figer de style ; le
  RSSI fournira rapidement un style proche de l'actuel, appliqué ensuite en une fois (captures de référence régénérées à
  ce moment-là).

## 8. Lots proposés (M0 à M9, ordre, sans calendrier)

| Lot | Contenu | Migration |
| --- | ------- | --------- |
| M0 | Décisions D1 à D13, ADR 0030 et 0031, révision de l'ADR 0013 (filtre 9001) | aucune |
| M1 | **Page « Périmètres »** : créer et modifier, nature, rattachement (méthode de risque, politique, membres), libellés neutres, droit `pilotage:administrer` | aucune attendue |
| M2 | **Bibliothèque de référentiels** : stockage organisationnel, import et publication, rattachement d'une version à un périmètre, double résolution des références, promotion explicite et simulée | additive, **lourde** |
| M3 | **Déclarer une fois** : correspondances organisationnelles, couverture déduite, confirmation, vue commune multi-référentiels, tableau de bord de conformité étendu | additive |
| M4 | **Gestion des fournisseurs** hors périmètre : adaptateur du registre, évaluations immuables, rattachement à plusieurs périmètres, critères reliés à la bibliothèque, sans grille | **additive** |
| M5 | Fiche processus 4.4.1, lien indicateurs ↔ processus, calque « santé » sur la carte | additive éventuelle |
| M6 | Indicateurs et objectifs (6.2, 9.1), **boxes** et tableau de bord qualité | aucune attendue |
| M7 | Contexte, **PESTEL**, parties intéressées, opportunités (6.1), séries récurrentes proposées | additive éventuelle |
| M8 | Revue de direction (9.3.2) et audit combiné, amélioration continue | aucune attendue |
| M9 | Recette, accessibilité, performance, documentation, application du style fourni, réévaluation du registre | aucune |

Ordre recommandé : **M0 à M9 dans l'ordre**. M1 est petit et débloque le rattachement ; **M2 et M3, le cœur voulu par le
RSSI, passent avant les fournisseurs** : M4 en dépend (ses critères visent la bibliothèque). Tout ce qui précède M5 sert déjà
l'ISO/IEC 27001:2022 et l'HDS, sans le référentiel 9001. Chaque lot : branche `claude-suivi-smsi`, PR vers `main` après CI
verte, CHANGELOG, retour arrière décrit, registre réévalué à la fin du lot.

## 9. Décisions et questions

**Tranchées le 13/10/2026** (§1 bis) : D1 à D13, soit les anciennes Q1 à Q7 et Q9 à Q14.

**Reste ouverte, sans bloquer M0 à M5**

1. **Q8** — Opportunités de 6.1. La norme demande de déterminer des **risques et des opportunités** (6.1.1, notes de 6.1.2).
   Un risque est une situation défavorable qu'on veut réduire ; une **opportunité** est une situation **favorable** qu'on veut
   saisir (la note 2 de 6.1 cite : nouvelles pratiques, nouveaux produits, nouveaux marchés, nouveaux clients, partenariats,
   nouvelle technologie). Le registre des risques de l'outil est fait pour les premiers (matrice de gravité et de
   vraisemblance). Où enregistrer les secondes ? **A)** dans le même registre, avec une « nature » risque ou opportunité ;
   **B)** dans un **objet « Opportunité » séparé**, plus léger (description, bénéfice attendu, actions), affiché avec les
   risques dans une vue commune « Risques et opportunités ». **Recommandation : B**, car une matrice de gravité n'a pas de
   sens pour une opportunité, et la norme n'impose aucune méthode de risque (A.4). Ne pas confondre avec l'« opportunité
   d'amélioration » d'un constat (10.1), déjà dans l'outil.
2. **Q15** — Règle d'affichage proposée par l'ADR 0031 : une exigence « couverte par correspondance » est affichée **à
   part** et **ne compte pas** dans les taux de couverture, tant que l'utilisateur ne l'a pas confirmée. D'accord ?

## 10. Ce que ce cadrage n'établit pas

Il ne prouve ni la conformité à l'ISO 9001, ni l'équivalence avec une autre norme, ni la faisabilité chiffrée des lots (non
estimés), ni la couverture des exigences de réalisation (§5). Les états « existant » du §3 sont des constats de lecture
du code à 78ba57e et de l'inventaire fonctionnel ; ils seront vérifiés lot par lot.
