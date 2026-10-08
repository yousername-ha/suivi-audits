# Audit (phase 1) — spécification pour la nouvelle application (v3)

> Exigences `AUD-01` à `AUD-16`, à citer dans les commits et les PR. **Statut : proposée**, à valider par le RSSI
> avant tout développement (points à arbitrer : § 6). Décisions d'architecture : [ADR 0015](../adr/0015-audit.md).
> Recette : [RECETTE.md](RECETTE.md). Référence de comportement : l'outil historique (`app/public/index.html`,
> schéma 15), inventorié le 08/10/2026 ; les numéros de ligne cités sont indicatifs.

## 1. Objectif
Reprendre dans la v3 le cœur de l'outil historique : **préparer l'audit de certification** (ISO 27001 et HDS),
**suivre la couverture** des exigences par l'AFNOR et par l'audit interne sur le cycle de certification, **tenir le
registre des écarts** et leurs actions, **organiser le plan d'audit** (journées, créneaux, participants, preuves,
questions) et **présenter la synthèse** (bandeau, graphiques). Un enregistrement par élément, concurrence par
enregistrement (`If-Match`), temps réel, droits par module, journal d'audit.

Modules legacy repris (ADR 0007) : `years`, `yearLabels`, `nextYear`, `nextDate`, `internalDate`,
`iso27001Certified`, `groups`, `items`, `hdsChap`, `findings`, `source`, `closeDeadline`, `findingsRev`, `plan`.
Après la reprise, `/legacy` les affiche en lecture seule (« Module géré dans la nouvelle interface »).

## 2. Ce que fait l'outil historique (constat)
- **Cycle** : années du cycle (`years`), libellés (« Certification initiale », « Surveillance 1 »…), prochaine année
  d'audit AFNOR `N` (`nextYear`, l'année précédente `P = N-1` sert au pronostic), date de l'audit AFNOR (compte à
  rebours), date de l'audit interne (saisie, inutilisée), échéance globale de clôture des écarts (`closeDeadline`).
  Ajout d'une année ; ni suppression, ni copie, ni archivage.
- **Référentiels** : 12 chapitres (`ISO-4` à `ISO-10`, `A-5` à `A-8`, `HDS`) et 157 exigences : 35 sous-clauses ISO
  (profondeur 1 ou 2), 93 mesures de l'Annexe A, 31 exigences HDS. Titre modifiable, texte de référence facultatif.
- **Couverture** : pour chaque exigence et chaque année, statut AFNOR et statut interne (`''` non auditée, `P`
  prévue, `X` auditée). **Préparation, pilote et notes ne sont pas annualisés** (écrasés d'un cycle à l'autre) ;
  remarques AFNOR et interne importées du fichier de préparation, en lecture seule.
- **Pronostic** (`analyze`, l. 858) : score par exigence (écarts ouverts liés, rotation du cycle, angle mort, plan
  AFNOR), niveaux « Certain », « Très probable », « Probable », « Systématique » (socle : clauses et HDS),
  « Peu probable », motifs affichés.
- **Écrans** : bandeau d'audit (compte à rebours, frise du cycle, 4 faits cliquables) ; « Pronostic N » (carte de
  pastilles avec 3 lentilles, liste « Mesures à préparer ») ; « Couverture du cycle » (tableau exigences × années,
  clic qui fait tourner `'' → P → X`) ; fiche exigence en tiroir ; « Organisation de l'audit » (Déroulé, Planning,
  Participants, fiche créneau) ; registre des écarts (filtres, tri, ligne dépliable, tâches) ; plan d'actions ;
  tableau de bord (4 cartes, graphiques en anneau et en barres) ; carte du SMSI par mesure (4 lentilles).
- **Écarts** : `{id, createdAt, source, year, type, status, text, desc, action, tasks[], comment, items[], owner, due,
  proof}` ; types NC majeure, NC mineure, Point sensible, Piste de progrès, Remarque ; statuts Ouvert, En cours,
  Clos ; 8 sources (AFNOR, Interne, Tenacy, Veille, GAP, Exercice, Incident, Fournisseur). Règles : cocher une tâche
  d'un écart ouvert le passe « En cours » ; passer « Clos » coche toutes les tâches. **Ni date ni auteur de
  clôture, ni réouverture tracée, ni revue d'efficacité.**
- **Plan d'audit** : objet unique, **non rattaché à une année** ; statut (Projet, Plan reçu de l'AFNOR, Plan
  validé) ; jours, créneaux (type, horaires, lieu, exigences, participants, preuves cochables, questions),
  participants (nom, rôle) ; alerte « mesures ciblées sans créneau » ; preuves et questions types tirées du guide
  embarqué (111 clauses et mesures, aucune HDS).
- **Imports et exports** : fichier Excel de préparation « PRM02 » (écarts, couverture AFNOR et interne, remarques),
  Tenacy (import et export), rapport Excel (5 feuilles), modèle consolidé réimportable, exports par rubrique,
  diaporama et document Word des comités. Aucun PDF, aucune impression dédiée.
- **Liens avec d'autres modules** (restés dans l'outil historique jusqu'à leur reprise) : DdA (`dda`, phase 2) lue
  par le tableau de bord ; programme d'audit interne (`plans` de type audit, phase 2) qui coche la couverture
  interne ; registre des preuves (`evidences`, phase 2) ; écarts **créés par** les modules GAP, exercices,
  incidents et évaluations fournisseurs (identifiants `GAP-`, `EXO-`, `INC-AC-`, `FOU-`).

## 3. Exigences

### AUD-01 — Droits
- Modules déjà déclarés (ADR 0010) : `audit` (référentiels, cycle, couverture, préparation, pronostic),
  `ecarts` (écarts et tâches), `plan_audit` (plan d'audit). Aucun nouveau module : la liste des permissions ne
  change pas (75).
- Rôles prédéfinis : Administrateur et RSSI tout ; Contributeur lire, modifier, exporter ; Lecteur lire, exporter ;
  Auditeur externe lire sur les modules qui lui sont ouverts (avec expiration du compte).
- Le cycle (années, dates, échéance de clôture) et les référentiels relèvent de `audit:administrer` ; la
  suppression d'un écart, d'un jour ou d'un créneau de `…:supprimer`. Lecture seule réelle (aucun contrôle de
  saisie affiché sans le droit, 403 côté serveur), vérifiée par la matrice rôles × routes.

### AUD-02 — Cycle de certification
- Table `audit_cycles` : une ligne par année (`year`, `label`, `afnor_date`, `internal_date`, `findings_deadline`,
  `version`), plus un réglage « année du prochain audit » (`N`) et « certification ISO 27001 obtenue ».
- Écran Paramètres > Audit (permission `audit:administrer`) : libellés, dates, année `N`, ajout d'une année
  (initialise la couverture vide), **suppression d'une année** seulement si aucune donnée ne s'y rattache.
- Changer l'échéance de clôture propose (case cochée par défaut, comme l'outil historique) de reporter la nouvelle
  date sur les écarts non clos sans échéance ou à l'ancienne échéance ; le nombre d'écarts concernés est affiché
  avant validation et chaque écart modifié est journalisé.
- La date de l'audit AFNOR alimente le compte à rebours et les dates des jours du plan sans date (jours ouvrés
  consécutifs, comme `fillPlanDates`).

### AUD-03 — Référentiels
- Tables `requirement_groups` et `requirements` (`framework` ISO27001 / ANNEXE_A / HDS, `framework_version`
  « 2022 » / « v2 », `code`, `num`, `title`, `group_id`, `depth`, `ref_text`, `position`, `legacy_id`), chargées par
  migration depuis le contenu de référence actuel (157 exigences, identifiants du schéma 15 conservés).
- Titre et texte de référence modifiables (`audit:administrer`), journalisés ; l'identifiant et le code ne changent
  jamais. Une nouvelle version d'un référentiel s'ajoute plus tard sans toucher aux données existantes.
- Le guide des preuves et questions types (actuellement embarqué dans l'outil historique) devient une table
  `requirement_guides` (preuves[], questions[]) lue en lecture seule, chargée par migration.

### AUD-04 — Couverture et préparation par cycle
- `requirement_coverage` (exigence × année) : `afnor` et `internal` ∈ { non auditée, prévue, auditée },
  `version`. Un clic sur une pastille fait tourner la valeur (non auditée → prévue → auditée → non auditée), avec
  `If-Match` sur la ligne.
- `requirement_preparation` (exigence × année) : préparation (À préparer, En cours, Prête), pilote (texte, puis
  compte utilisateur facultatif), notes « Preuves à présenter », remarques AFNOR et interne du fichier de
  préparation (lecture seule, renseignées par l'import). **Annualisée** (voir § 6, point 1) : à la reprise, les
  valeurs actuelles sont rattachées à l'année `N` ; « Reprendre la préparation de l'année précédente » copie
  pilote et notes (pas le statut) dans une nouvelle année.
- Le programme d'audit interne (module `plans`, phase 2) continue de cocher la couverture interne : tant qu'il est
  dans l'outil historique, l'action « Réalisé → couverture » passe par la passerelle d'AUD-15.

### AUD-05 — Pronostic
- Portage **à l'identique** de `analyze` en fonction pure (`packages/shared/src/audit/pronostic.ts`) : mêmes
  pondérations (NC +100, PS AFNOR +70, PS autre source +35, autre type +10, écarts clos +15, non vue par l'AFNOR en
  P +60, angle mort P +25, inscrite au plan AFNOR N +40), mêmes seuils (100 / 60 / 30), même socle (clauses et HDS),
  mêmes motifs. Tests de **parité** : le code de l'outil historique exécuté dans un bac à sable donne les mêmes
  scores, niveaux et motifs sur le jeu de recette et sur des états aléatoires (même méthode que la cartographie).
- Indicateurs dérivés : couverture des exigences ciblées par le plan (`coverage`), pire pronostic d'un créneau,
  écarts à présenter dans un créneau, « Pas encore prévue à l'audit interne N ».

### AUD-06 — Écran « Préparation de l'audit » (Pronostic N)
- Bandeau d'audit commun aux écrans du module : compte à rebours (« J-x », « Aujourd'hui », « Passé de x j »,
  bouton « Saisir la date »), frise du cycle (barres AFNOR et interne par année, Annexe A), 4 faits cliquables
  (écarts à clôturer avant l'échéance, exigences certaines ou très probables en N, angles morts P, exigences
  ciblées prêtes en %).
- Carte du prochain audit : une rangée de pastilles par chapitre (clauses 4 à 10, A.5 à A.8, HDS), lentilles
  « Pronostic N », « AFNOR P », « Interne P », légende avec effectifs ; pastille = niveau, point si écart ouvert,
  coche si prête ; clic = fiche exigence. Libellé HDS corrigé (« Exigences 1 à 31 »).
- Liste « Exigences à préparer » : filtres (Certain et très probable, Avec probable, Socle, Toutes), tri (niveau,
  score, ordre du référentiel), motifs et drapeaux, préparation modifiable sur la ligne.
- Accessibilité : la couleur n'est jamais le seul porteur d'information (lettre ou icône dans la pastille, texte de
  la légende, libellé ARIA « A.5.15, certain, écart ouvert, prête »).

### AUD-07 — Écran « Couverture du cycle »
- Tableau exigences × (AFNOR par année, Interne par année, Écarts, Pronostic N), lignes de chapitre avec effectif,
  colonnes par priorité (ADR 0012), première colonne figée au défilement horizontal du tableau.
- Filtres : recherche (code, titre, numéro), référentiel (Tout, Clauses, Annexe A, HDS), « Non vues AFNOR P »,
  « Angles morts P », « Avec écart ouvert » ; compteur ; filtres mémorisés dans les préférences de la personne.
- Badges d'écarts (NC, PS, R, avec A pour AFNOR et I pour les autres sources, barrés si clos).
- Comparaison de deux années côte à côte (sélecteur) au-delà de 4 années dans le cycle.

### AUD-08 — Fiche exigence
- Panneau latéral (maître-détail), feuille basse au téléphone : code, niveau, titre, chapitre ; remarques du
  fichier de préparation ; « Pourquoi ce pronostic » ; historique des audits (pastilles modifiables) ; écarts liés
  et « Ajouter un écart sur cette exigence » ; « Dans le plan d'audit N » (créneaux, avertissement si ciblée sans
  créneau, « Placer dans un créneau ») ; preuves et questions types du guide ; préparation (statut, pilote, notes).
- Blocs dépendant de modules non repris (DdA, registre des preuves, correspondances SecNumCloud) : affichés en
  lecture seule depuis l'état legacy si la personne a le droit de lire leur module, avec un lien vers `/legacy`.

### AUD-09 — Registre des écarts
- Tables `findings` (`id` stable, `legacy_id`, `source`, `year`, `type`, `status`, `title` (constat), `description`,
  `corrective_action`, `comment`, `owner`, `due_date`, `proof`, `created_at/by`, `updated_at/by`, `closed_at`,
  `closed_by`, `version`, champs Tenacy facultatifs), `finding_requirements` (N-N) et `finding_tasks` (`id` stable,
  texte, fait, date de création, **échéance et pilote facultatifs**, `done_at`, `done_by`).
- Écran : en-tête (« n écarts suivis, dont n clos »), bandeau d'échéance de clôture (J-x, ouverts par type, actions
  restantes, en retard, barre de progression), filtres (statut « À traiter » par défaut, source, référentiel,
  **année et pilote** en plus de l'existant), tri identique à l'outil historique, ligne dépliable, fiche complète,
  liaison et déliaison d'exigences, tâches (ajouter, cocher, modifier, supprimer).
- Règles métier conservées : cocher une tâche d'un écart ouvert le passe « En cours » ; toutes les tâches faites :
  invitation à clôturer ; « Clos » coche les tâches restantes. Ajouts : **date et auteur de clôture** enregistrés,
  **réouverture explicite** (motif obligatoire, journalisé), écart en retard = non clos et échéance dépassée.
- Création : identifiant `F01`, `F02`… pour les écarts saisis à la main (suite de l'outil historique), préfixes
  conservés pour les autres sources. Suppression : `ecarts:supprimer`, confirmation, journalisée.
- Concurrence : `If-Match` par écart ; une tâche se modifie avec la version de son écart (412 seulement si cet
  écart a changé) ; présence « X modifie l'écart F07 ».

### AUD-10 — Plan d'actions
- Vue transversale des tâches : à faire / réalisées / en retard / % d'avancement ; filtre (À faire, Réalisées,
  Toutes), colonnes Action, Écart, Constat, Pilote, Échéance (de la tâche si renseignée, sinon de l'écart), Créée le ;
  cocher depuis la liste.

### AUD-11 — Plan d'audit
- Tables `audit_plans` (**une par année du cycle**, statut, note), `audit_plan_days`, `audit_plan_slots` (type :
  Réunion d'ouverture, Entretien, Visite terrain, Synthèse, Réunion de clôture, Pause ; horaires, lieu, titre,
  contenu), `audit_plan_people`, liens créneau ↔ exigences et créneau ↔ personnes, `audit_plan_proofs` (cochables) et
  `audit_plan_questions` (**identifiant stable** ajouté, absent du schéma 15).
- Écrans : Déroulé (par jour, recherche), Planning (grille horaire par jour, couleur = pire pronostic),
  Participants (temps mobilisé), fiche créneau ; alerte « n exigences ciblées sans créneau » ; « Ajouter les preuves
  types des exigences » (sans doublon) ; règles de saisie de l'outil historique (créneau suivant à la suite,
  60 minutes par défaut, fin recalée, renumérotation des jours, première date → date de l'audit si vide).
- Note du plan **modifiable** (affichée seulement dans l'outil historique).

### AUD-12 — Synthèse et graphiques
- Tableau de bord (accueil et écran mural) : cartes « Audit AFNOR N » (J-x, exigences prêtes), « Écarts ouverts »
  (en retard, actions réalisées), « Couverture du cycle ».
- **Graphiques en SVG, sans dépendance** (composant `packages/ui`, jetons de couleur clair et sombre, contrastes AA,
  aucun attribut `style`) :
  - anneau « Écarts ouverts » par type (centre : nombre d'ouverts ; légende avec effectif et %) et barre « Actions
    réalisées x/y » ;
  - histogramme « Couverture du cycle » : exigences auditées par l'AFNOR et en interne, par année ;
  - histogramme empilé à 100 % « Conformité par référentiel » (Total, Partiel, Insuffisant, Non renseigné) **lu
    dans la DdA de l'outil historique** tant que la DdA (phase 2) n'est pas reprise ;
  - chaque graphique a une alternative textuelle (tableau de données accessible, bouton « Voir les données »).
- Voir aussi `UI-02` (graphiques réutilisables pour les autres modules).

### AUD-13 — Imports
- **Fichier de préparation PRM02** (Excel) : écarts (mise à jour champ par champ, identifiants conservés, écarts
  Tenacy ignorés, action découpée en action et tâches), couverture AFNOR et interne par année (`x` = auditée si
  l'année est passée, sinon prévue), remarques. **Simulation obligatoire** avant application (comme l'import legacy :
  résumé, empreinte du fichier, application exacte de la simulation), annulation possible, journal d'audit.
- **Tenacy** (onglet `Gaps`) : correspondance des statuts et des groupes, codes de mesures `ISO-01-22 x.y`,
  `HDS-2.0 EXIn` ; même simulation.
- Lecture des classeurs **sans nouvelle dépendance** : archive ZIP lue avec `node:zlib`, feuilles SpreadsheetML
  lues par un analyseur restreint (chaînes partagées, cellules en ligne, nombres, dates), limites de taille et de
  nombre de cellules, rejet des fichiers chiffrés ou à macros (voir § 6, point 4).

### AUD-14 — Exports
- Excel (écrit par `apps/api/src/export/tabular.ts`, étendu au classeur multi-feuilles) : rapport d'audit (Pronostic
  N, Couverture, Écarts restant à clôturer, Plan d'audit, Participants), modèle consolidé réimportable (vierge ou
  rempli), export pour Tenacy ; CSV de chaque tableau filtré. Permission `…:exporter`, export journalisé.
- **Impression du plan d'audit et de la fiche écart** (feuille de style d'impression, A4), absente de l'outil
  historique. Les diaporamas et documents Word des comités restent dans l'outil historique jusqu'à la phase 4.

### AUD-15 — Reprise legacy et transition
- `ModuleMapper` pour chaque clé reprise (§ 1) ; `MAPPING-LEGACY.md` et `LEGACY-FORMAT.md` complétés (champs
  manquants du contrat : `findings[].createdAt`, `findings[].tenacy*`, `findings[].tasks[].createdAt`,
  `items[].refText`) ; test d'aller-retour sur la fixture (import, export et annulation à l'identique).
- **Passerelle d'ajout d'écarts** (§ 6, point 2) : tant que les modules GAP, exercices, incidents et évaluations
  fournisseurs restent dans l'outil historique, un enregistrement de `/legacy` qui **ajoute** un écart (identifiant
  nouveau, préfixe de ces modules) ou **coche la couverture interne** depuis le programme d'audit est accepté : le
  serveur crée l'enregistrement dans les tables, au nom de la personne, et journalise. Toute **modification** d'un
  écart ou de la couverture existants depuis `/legacy` reste refusée (409, « Module géré dans la nouvelle
  interface »).
- Recherche globale de la v3 : exigences (code, titre, texte de référence, notes, pilote) et écarts (identifiant,
  constat, description, action, tâches, commentaire, pilote).

### AUD-16 — Temps réel, journal, performances
- Événements SSE par entité (`audit_cycles`, `requirements`, `requirement_coverage`, `findings`, `audit_plans`…)
  filtrés par permission ; présence sur un écart, un créneau, la couverture.
- Journal d'audit : changement de couverture, de préparation, création, modification, clôture, réouverture et
  suppression d'un écart, modification du plan, imports, exports, changement de cycle.
- 157 exigences × 4 années et 500 écarts s'affichent en moins d'une seconde sur un poste courant ; pronostic
  calculé côté navigateur et côté serveur par la même fonction partagée.

## 4. Charte, écrans, accessibilité
- Composants `packages/ui` uniquement, jetons pour les couleurs (niveaux du pronostic, statuts AFNOR / interne,
  types d'écarts), contrastes AA, aucune couleur ni espacement codés en dur, CSP stricte.
- Grilles ADR 0012 : maître-détail (registre des écarts, couverture), `grille-cartes` (synthèse), colonnes par
  priorité ; 390, 1920, 3840 px sans défilement horizontal de la page.
- Clavier : pastilles focusables (Entrée = fiche, Espace = faire tourner le statut), raccourcis de la recherche.

## 5. Tests attendus
- Vitest `packages/shared` : pronostic en parité avec l'outil historique, règles des écarts (statuts, tâches,
  clôture, réouverture), calcul des retards, lecture des classeurs PRM02 et Tenacy (fichiers fictifs).
- Vitest `apps/api` : routes et matrice des droits, `If-Match` / 412 par enregistrement, migrations et mappers
  (aller-retour), passerelle d'ajout (ajout accepté, modification refusée), imports simulés puis appliqués,
  annulation, journal.
- Playwright : parcours de [RECETTE.md](RECETTE.md), captures 390 / 1920 / 3840 px (clair et sombre), aucune violation
  de CSP, lecture seule.

## 6. Points à arbitrer (défaut retenu entre parenthèses)
1. Préparation, pilote et notes : valeur unique comme aujourd'hui, ou **par année du cycle** ? (**par année**, avec
   « Reprendre l'année précédente » ; l'historique d'un cycle n'est plus écrasé)
2. Écarts créés par les modules restés dans l'outil historique (GAP, exercices, incidents, fournisseurs) : bloquer
   ces créations jusqu'à la reprise de ces modules, ou les accepter ? (**passerelle d'ajout**, AUD-15)
3. Plan d'audit : unique comme aujourd'hui, ou **un par année** ? (**un par année**, le plan de l'année `N` est
   celui de l'outil historique à la reprise)
4. Imports Excel : lecteur maison sans dépendance, ou bibliothèque (ADR 0009, votre accord) ? (**lecteur maison**,
   limité aux classeurs .xlsx non chiffrés)
5. Tâches : échéance et pilote propres, ou ceux de l'écart ? (**facultatifs sur la tâche**, sinon ceux de l'écart)
6. Réouverture d'un écart clos : libre, ou **motif obligatoire** ? (**motif obligatoire**, journalisé)
7. Diaporama et document Word des comités : en phase 1, ou **phase 4** avec les autres exports ? (**phase 4** ; en
   attendant, ils restent produits par l'outil historique à partir de l'état recomposé)
8. Pilote d'une exigence ou d'un écart : texte libre, ou **compte utilisateur** ? (**texte libre**, avec suggestion
   des comptes existants ; un lien vers un compte permettra les notifications plus tard)
