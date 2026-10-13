# ADR 0031 — Bibliothèque de référentiels de l'organisation : déclarer une fois, évaluer sur plusieurs référentiels

**Statut** : proposée le 13/10/2026. Le RSSI en fait le **cœur** du chantier : « s'évaluer sur plusieurs référentiels en même
temps sans devoir refaire, à chaque référentiel, les mêmes déclarations ». Complète l'[ADR 0030](0030-perimetre-agnostique-qualite-fournisseurs.md)
et le [cadrage](../unification/CADRAGE-MODULE-QUALITE-9001.md). Aucun code n'est écrit.

## Contexte (constats de lecture du code, état `78ba57e`)

- Un référentiel est un objet `framework` **d'un périmètre** : sa définition (`FrameworkDefinition` : nom, identifiant, source
  officielle avec licence, domaines, exigences) est publiée par versions immuables **par périmètre**
  (`grc_framework_versions.smsi_id`). Importer l'ISO/IEC 27001:2022 dans deux périmètres le duplique.
- Une exigence se désigne par `requirement:<identifiant du référentiel>:<version>:<identifiant d'exigence>` ; ses
  `measureRefs` sont écrits **dans** la définition publiée, donc figés avec elle.
- Une **correspondance** (`mapping`) relie deux exigences de deux versions publiées, avec un type (identique, équivalente,
  partielle, complémentaire, liée, aucune), une justification de 10 caractères au moins, un taux de couverture, une origine
  (humaine ou IA) et un statut (proposée, relue, validée). Elle est validée **par périmètre**.
- Le registre commun sait déjà exprimer qu'une **mesure met en œuvre** une exigence (relation `implements`, ADR 0028) et
  qu'une **preuve démontre** une exigence (`demonstrates`).
- Le tableau de bord ne calcule la conformité que pour les trois référentiels de la déclaration d'applicabilité historique.
- Créer un périmètre exige déjà le droit `pilotage:administrer` ; publier un référentiel, `conformite:modifier` ; valider une
  correspondance, `conformite:administrer`.

## Décision

1. **Bibliothèque au niveau de l'organisation.** Un référentiel est importé **une fois** dans une bibliothèque (hors
   périmètre), par versions immuables, avec la même définition qu'aujourd'hui. Les `measureRefs` n'y figurent plus : un lien
   entre une exigence et une mesure est une donnée **de périmètre**, jamais une donnée de la bibliothèque.
2. **Rattachement.** Un périmètre se rattache à une **version précise** d'un référentiel de la bibliothèque. Passer à une
   autre version est une action explicite, assistée par la correspondance entre versions (même mécanisme pour toute
   nouvelle édition d'une norme) ; rien ne bascule seul.
3. **Correspondances organisationnelles.** Elles se rédigent et se valident **une fois pour l'organisation** (mêmes types,
   mêmes règles, validation par `conformite:administrer`). Aucune correspondance n'est livrée.
4. **Déclarer une fois.** L'unité de déclaration est la **mesure** d'un périmètre, avec son état de mise en œuvre, son
   responsable, ses preuves et ses actions. Une mesure peut « mettre en œuvre » des exigences de **n'importe quel**
   référentiel rattaché ; la saisie reste unique, la lecture se fait par référentiel.
5. **Rapprochement proposé, jamais affirmé.** Quand une exigence d'un référentiel A est reliée à une mesure et qu'une
   correspondance **validée** la rattache à une exigence d'un référentiel B, le système crée une **proposition de
   rapprochement** (mesure, exigence cible, correspondance, type et taux de la correspondance). Tant qu'elle n'est pas
   décidée, l'exigence de B s'affiche « **rapprochement à valider** » : état **calculé, en lecture seule**, distinct de la
   couverture explicite, **exclu des taux**. Une correspondance « partielle » ne donne jamais une couverture complète.
   Le **pilote** la **confirme** (cela crée alors un lien explicite « met en œuvre », au nom du pilote, avec la date et le
   motif éventuel) ou la **rejette** (motif conservé).
   - **Menu « Rapprochements à valider »** dans le Pilotage, **visible** : une **pastille avec le nombre** de propositions en
     attente dans la navigation, filtrable par référentiel et par mesure, décision unitaire ou **en lot** après revue.
   - **Notification visuelle** au pilote du périmètre, par le mécanisme de notifications existant (rubrique « Mes rappels » du
     Pilotage ; il n'y a pas de cloche dans l'en-tête), à chaque nouvelle proposition, **regroupée** pour éviter un message par exigence ; un **bandeau** sur la synthèse du Pilotage tant
     que des rapprochements attendent une décision.
   - Une proposition rejetée n'est **pas reproposée** tant que la correspondance ou le lien source ne changent pas ; les
     rejets restent consultables et révisables.
   - Qui décide : un membre du périmètre ayant le droit d'écriture et `pilotage:modifier` (confirmé au lot M3 : droit d'écriture sur le périmètre, `pilotage:modifier` et `conformite:lire`).
6. **Applicabilité.** Elle se décide par périmètre et par exigence. Une correspondance peut la **proposer** pour une
   exigence équivalente ; la reprise passe par la même file de validation, jamais automatiquement.
7. **Vue commune multi-référentiels.** Pour un périmètre : par référentiel rattaché, nombre d'exigences, applicables,
   couvertes explicitement, **rapprochements à valider**, non couvertes ; et, pour chaque mesure, la liste des exigences
   qu'elle couvre dans chaque référentiel. Ce sont des **indicateurs d'aide au pilotage**, pas un taux de conformité certifié.
8. **Compatibilité.** Les référentiels publiés dans un périmètre **continuent de fonctionner sans changement** (aucune
   migration automatique, aucune rupture des références existantes ni de la déclaration d'applicabilité historique).
   Une opération explicite, **simulée avant application**, permet de **promouvoir** une version publiée dans la
   bibliothèque : la définition est copiée, un alias conserve la validité des anciennes références.
9. **Licences et sources.** Chaque entrée porte sa source (organisation, document, version, licence, statut :
   vérifiée, importée sous licence, organisationnelle, non vérifiée). Aucun texte normatif n'est livré ; l'import se fait
   depuis l'exemplaire dont l'organisation détient les droits. Le texte de l'ISO 9001 fourni est importé par l'organisme
   avec ses propres intitulés, au niveau « article et alinéas énumérés » (décision D7).
10. **Droits.** Importer, publier et corriger la bibliothèque : `conformite:modifier` ; valider une correspondance :
    `conformite:administrer` ; rattacher un référentiel à un périmètre : `pilotage:administrer`, comme créer un périmètre.

## Conséquences

- **Migration additive** (lots M2 et M3) : tables de la bibliothèque (référentiels, versions, alias), rattachements périmètre ↔
  version, correspondances organisationnelles, propositions de rapprochement et leurs décisions. Aucune table existante n'est modifiée ni supprimée.
- **Double résolution des références** pendant la transition : une référence `requirement:` doit se résoudre soit dans un
  périmètre, soit dans la bibliothèque. C'est le point technique le plus délicat ; il est couvert par des tests de non-régression
  sur les 27001 et HDS déjà publiés.
- Le tableau de bord de conformité par référentiel s'étend aux référentiels rattachés ; les trois référentiels de la
  déclaration historique restent affichés tels quels.
- Les critères d'évaluation des fournisseurs (ADR 0030) désignent leurs exigences **dans la bibliothèque**, ce qui évite de
  saisir les références en texte libre.
- La mise à jour d'une norme (ISO 9001:2026 ou autre) est une nouvelle version de la bibliothèque et une correspondance
  entre versions ; on **n'attend pas** son texte pour construire le mécanisme (décision du RSSI).
- **Risques** : volume des correspondances (limites existantes : 10 000 exigences par version, 1 000 correspondances par
  import, à reprendre) ; confusion entre couverture explicite et rapprochement non validé (d'où l'affichage séparé, l'exclusion des taux et la file de validation) ;
  surcharge du pilote (d'où le regroupement des notifications et la décision en lot).
- Ces états sont des constats de lecture ; chaque comportement sera vérifié par des tests. Ils ne prouvent la conformité à
  aucun référentiel.
- Retour arrière : la bibliothèque est additive ; la supprimer laisse les référentiels des périmètres intacts. Les liens
  « mesure met en œuvre exigence » qui visent une version de la bibliothèque seraient à reprendre : d'où la promotion
  copiée avec alias et la sauvegarde automatique avant mise à jour.
