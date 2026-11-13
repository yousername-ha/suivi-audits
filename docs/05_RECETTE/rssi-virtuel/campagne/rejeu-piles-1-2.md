# Campagne de recette, phase 3 : rejeu des constats des piles 1 et 2

| Élément | Valeur |
| --- | --- |
| Code de l’application testé | `2e63e86` (branche `claude/recette-rssi-2026-11-12`, HEAD `e61b008` : documentation et outillage de recette seulement) |
| Date | 13/11/2026, à partir de 01:15 (Europe/Paris) |
| Piles | pile 1 `https://127.0.0.11` (pilote 9334, `.pilote-1`), pile 2 `https://127.0.0.12` (pilote 9335, `.pilote-2`), remplies par les phases 1 et 2 |
| Comptes | `rssi` (administrateur), comptes `test7-*` de la phase 2 ; aucun secret recopié ici |
| Outillage | `pilote.mjs` (écran, arbre d’accessibilité, API) ; scripts Playwright reliés au Chrome du pilote ou à une session API par compte, gardés dans le bloc-notes (préfixe `r12-`), hors du dépôt |
| Règle | rejouer avant d’inscrire (CAMPAGNE-MULTI-AGENT.md §5, phase 3, point 2) ; aucune modification de l’application ni des tests |

Rejeu en cours : le tableau et les sections sont complétés au fil des constats.

## Synthèse

| Constat | Verdict | Gravité proposée → retenue | Doublon de | Test déterministe (oui/non) |
| --- | --- | --- | --- | --- |
| C1-03 | reproduit | majeur → majeur | même cause que C2-10 ; volet export : C1-04, C2-05 | oui (page) |
| C1-04 | reproduit | bloquant → bloquant | même cause que BUG-020 (lecture du registre historique au lieu des objets) | oui (API) |
| C1-05 | reproduit | majeur → majeur | même famille que BUG-020 et C1-04 (sources historiques au lieu des objets) | oui (API) |
| C1-07 | reproduit | majeur → majeur | aucun | oui (page) |
| C1-10 | reproduit | majeur → majeur | même cause que BUG-037 (`smsi === SOCLE` dans `Pilotage.tsx`) | oui (page) |
| C1-12 | reproduit en partie (l’écart est bien dans la DdA ; INV-08 est un faux positif) | bloquant → majeur | recoupe BUG-034 (action sans responsable ni échéance) et BUG-035 (« action » comptée ou non) | oui (API) |
| T1-01 | reproduit | majeur → majeur, à arbitrer (bloquant si le cloisonnement est retenu comme exigence) | T2-01, et T3-01, T4-01, T5-01, T6-02 des autres piles | oui (API) |
| T2-01 | reproduit (pile 2, API) | majeur → majeur, à arbitrer | T1-01 (même défaut) | oui (API) |
| C2-01 | reproduit | majeur → majeur | même mécanisme que BUG-022 (« Méthode publiée » vidée) ; message technique : famille BUG-025 ; alerte hors de vue : C2-02 | oui (page) |
| C2-03 | reproduit | majeur → bloquant | aucun (voisin de BUG-024 : acceptabilité sans contrôle) | oui (API) |
| C2-05 | reproduit | majeur → majeur | même famille que C1-04 et le volet export de C1-03 (les exports Excel ne lisent pas les objets du Pilotage) | oui (API) |
| C2-06 | reproduit | majeur → majeur | extension de BUG-023 (à fusionner si la correction est commune) | oui (page et API) |
| C2-07 | reproduit (157 options au lieu de 160) | majeur → majeur | volet « liens » : même famille que BUG-026 (mesure du traitement invisible dans la DdA) | oui (page et API) |
| C2-08 | reproduit en partie (pile 2 seulement : aucun référentiel appliqué ; sur la pile 1, le sous-périmètre propose les mesures héritées) | majeur → mineur | aucun dans la liste ; voisin de C2-07 (deux sources de mesures selon le périmètre) | oui (API) |

## Détail par constat

### C1-03 — Ni archivage ni export depuis les registres du contexte (pile 1)

Fait (compte `rssi`) :

- `pilote.mjs ouvrir "/pilotage/responsabilites?perimetre=00000000-0000-4000-8000-000000000001"`, puis
  `cliquer button "Autres actions pour Doublon de test (fictif, à ignorer : aucune suppression possible)"` et
  `cliquer button "Ouvrir"`.
- Même contrôle sous « Hébergement HDS » (`?perimetre=d8161580-…`) sur `/pilotage/contexte`, `/pilotage/parties`,
  `/pilotage/swot`.
- Second chemin : création par l’écran d’une fiche « rejeu C1-03 SWOT à archiver (fictif) » sous HDS (« Ajouter analyse
  swot », « Intitulé », « Enregistrer »), puis archivage par l’API avec la session `rssi`.

Vu :

- Menu `menu "Autres actions pour …"` : un seul `menuitem "Décisions et réalisations"`, sur les quatre registres et les
  deux périmètres, y compris sur la fiche qui vient d’être créée.
- Fiche ouverte (`dialog "Fiche — Responsabilité"`, `dialog "Fiche — Analyse SWOT"`) : `button "Fermer la fiche"`, onglets
  « Informations », « Liens et justificatifs », « Historique », `button "Fermer"`, `button "Enregistrer"` ; aucun
  « Archiver ».
- En-tête de liste : `button "Ajouter …"`, `button "Filtres"`, `textbox "Rechercher"`, « N fiches » ; aucun bouton
  d’export.
- L’API sait archiver : `DELETE /api/grc/d8161580-…/objects/d09d37ea-…` sans en-tête → **HTTP 428** « Version attendue
  manquante (en-tête If-Match) » ; avec `If-Match: "1"` → **HTTP 200** `"version":2,"archived":true` ; la fiche ne
  figure plus dans `GET …/objects?kind=swot`. Le défaut est donc dans l’écran : le composant générique
  `apps/web/src/grc/ObjectEditor.tsx` (l. 591) porte « Archiver la fiche », que la fiche des registres du Pilotage
  n’affiche pas.

Gravité : majeur confirmé : une fiche créée par erreur (doublon de rôle) reste dans le registre remis à l’auditeur et
ne peut être retirée que par l’API (7.5.3), sans que la donnée soit fausse.

Doublon : même cause que C2-10 (traitements, actifs, opportunités : même fiche générique). Le volet « export » recoupe
C1-04 (export du contexte) et C2-05 (export des risques) : à traiter avec eux.

Test déterministe (page) : en `rssi`, créer par l’API (`POST /api/grc/<HDS>/objects`, `{"kind":"swot","name":"Fiche
fictive à archiver"}`), `goto /pilotage/swot?perimetre=<HDS>`, `getByRole('button', { name: 'Autres actions pour Fiche
fictive à archiver' }).click()` ; attendu après correction : un `menuitem` ou, dans la fiche ouverte par « Ouvrir », un
`button` dont le nom contient « Archiver » ; observé : seul `menuitem "Décisions et réalisations"`. Contrôle API (déjà
vert, à garder) : `DELETE /api/grc/<HDS>/objects/<id>` avec `If-Match` → 200, `archived:true`.

### C1-04 — Export Excel « Contexte du SMSI » vide malgré les fiches saisies (pile 1)

Fait (compte `rssi`) : `pilote.mjs ouvrir /exports`, clic sur `button "Excel classique : Contexte du SMSI"` puis
`button "Excel pro : Contexte du SMSI"` (script `r12-dl.mjs` relié au Chrome du pilote, qui enregistre le
téléchargement) ; lecture des feuilles ; comptage des fiches à l’écran (`/pilotage/contexte`, `/parties`, `/swot`,
`/responsabilites` du principal) et par l’API.

Vu :

- Requête émise par le bouton : `GET /api/suivi/export?groupe=ctx&mode=std` (resp. `mode=pro`), HTTP 200.
- Classeur classique : « Périmètre du SMSI » : lignes Version, Validé le, Validé par, Énoncé, Sites, Processus inclus,
  **toutes sans contenu** ; « Parties intéressées », « Analyses SWOT », « Rôles et responsabilités » : **ligne d’en-tête
  seule**. Classeur pro : « Parties intéressées — 0 ligne(s) », « Analyses SWOT — 0 ligne(s) », « Rôles et
  responsabilités — 0 ligne(s) ».
- Écrans du principal : « 2 fiches » (contexte), « 2 fiches » (parties intéressées), « 1 fiches » (SWOT), « 5 fiches »
  (rôles). API : `GET /api/grc/00000000-…-0001/objects?kind=stakeholder` → `"total":2`, `kind=swot` → 1,
  `kind=governance` → 5.
- Cause confirmée : `GET /api/suivi/etat` → `interested: []`, `swots: []`, `roles: []` ; `scope` porte `org`, `desc`,
  `text`, `issues`, `exclusions`, `interfaces`, alors que `apps/api/src/export/rubriques.ts` (jeu `perimetre`, l. 428 à
  443) lit `statement`, `sites`, `processes`, `excl`, et les jeux `parties`, `swot`, `roles` lisent `etat.interested`,
  `etat.swots`, `etat.roles`. L’export n’a aucun paramètre de périmètre.

Gravité : bloquant confirmé : le classeur remis à un auditeur affirme qu’il n’y a ni partie intéressée, ni SWOT, ni rôle
(donnée fausse, 4.2 et 5.3).

Doublon : même cause que BUG-020 (bandeau des parties intéressées lu dans `interested`) ; à consolider avec lui, mais
c’est un symptôme distinct (export). Le volet « pas d’export par périmètre » rejoint C1-03.

Test déterministe (API) : en `rssi`, `POST /api/grc/00000000-0000-4000-8000-000000000001/objects`
`{"kind":"stakeholder","name":"Partie intéressée fictive d’export"}` → 200 ; puis
`GET /api/suivi/export?groupe=ctx&mode=std` → 200, feuille « Parties intéressées » ; attendu après correction : une
ligne contenant « Partie intéressée fictive d’export » ; observé : en-tête seul. Même assertion pour `kind=swot`
(feuille « Analyses SWOT ») et `kind=governance` (feuille « Rôles et responsabilités »).

### C1-05 — PESTEL, cartographie et processus ignorent les SWOT et enjeux saisis à l’écran (pile 1)

Fait (compte `rssi`) : `pilote.mjs ouvrir "/pilotage/pestel?perimetre=00000000-…-0001"` ; `ouvrir
/pilotage/processus-cartes`, clic sur la carte du processus PR1 ; `ouvrir /cartographie`, `cliquer button "Générer…"` ;
contrôle par l’API des fiches `swot` et `context` du principal et de `GET /api/grc/<smsi>/pilotage/pestel`.

Vu :

- Données saisies : `GET /api/grc/00000000-…-0001/objects?kind=swot` → « SWOT du processus Hébergement (fictif) » avec
  `threats` « Rançongiciels visant le secteur de la santé (fictif) » et `opportunities` « Mutualisation régionale de la
  sauvegarde (fictif) » ; `kind=context` → « Contexte réglementaire de la santé (fictif) », `issues` « Externes :
  obligations HDS v2, déclaration des incidents, attentes des adhérents (fictif) ».
- PESTEL : six facteurs « (0) — Aucun enjeu classé dans ce facteur. », `paragraph: Enjeux externes non classés (0)`,
  « Tous les enjeux externes sont classés. », seul « Enjeux internes, hors PESTEL (1) » (l’enjeu saisi dans l’objectif).
  API : `GET /api/grc/00000000-…-0001/pilotage/pestel` → HTTP 200 `"nonClasses":[]`, `parFacteur[*].enjeux = []`,
  `internes` = 1. Sous HDS : `GET /api/grc/d8161580-…/pilotage/pestel` → **HTTP 404** « Ces données appartiennent au
  pilotage commun. » (le SWOT du sous-périmètre n’a aucun PESTEL).
- Processus : carte `button "PR1 Hébergement et infogérance … SWOT 0 …"` ; fiche `dialog "PR1 · Hébergement et
  infogérance"`, groupe « SWOT » : `combobox "Rattacher : SWOT" [disabled]`.
- Cartographie, `dialog "Générer la carte du contexte"` : `checkbox "Enjeux externes (0)"`, `checkbox "Parties
  intéressées (0)"` (BUG-020), `checkbox "Enjeux internes (1)"`.
- Cause lue : `apps/api/src/pilotage/pestel.ts` construit les enjeux depuis `LegacyCartoSource` (objets
  `external_issue`/`internal_issue` du registre historique) et refuse tout autre périmètre que `DEFAULT_SMSI`.

Gravité : majeur confirmé : les enjeux externes (4.1) saisis à l’écran n’apparaissent dans aucune des trois vues de
synthèse et le SWOT ne peut pas être rattaché au processus, sans contournement possible par l’écran.

Doublon : même famille que BUG-020 et C1-04 (lecture du registre historique, pas des objets du Pilotage) ; symptômes
distincts, cause commune à confirmer à la correction.

Test déterministe (API) : en `rssi`, `POST /api/grc/00000000-0000-4000-8000-000000000001/objects`
`{"kind":"swot","name":"SWOT fictif PESTEL","data":{"threats":"Menace fictive PESTEL"}}` → 200, puis
`GET /api/grc/00000000-0000-4000-8000-000000000001/pilotage/pestel` → 200 ; attendu après correction : « Menace fictive
PESTEL » dans `nonClasses` ou un `parFacteur[].enjeux` ; observé : absent (`nonClasses: []`). Page : `goto
/pilotage/pestel`, `getByText('Enjeux externes non classés (0)')` visible aujourd’hui.

### C1-07 — Évaluation d’un fournisseur : la page plante en cochant un critère (pile 1)

Fait (compte `rssi`) : `pilote.mjs ouvrir "/pilotage/fournisseurs?perimetre=00000000-…-0001"`, `cliquer button "Évaluer
le fournisseur Infogérant fictif"`, puis script `r12-c107.mjs` (relié au Chrome du pilote) qui clique la case
`checkbox "Authentification multifacteur sur les accès d'administration"` (cocher, décocher, recocher) et relève les
erreurs. Rejoué deux fois de plus sur `Évaluer le fournisseur Opérateur réseau fictif`, case `checkbox "Certification
HDS en cours de validité"`. Rien n’a été enregistré (aucun clic sur « Enregistrer l’évaluation »).

Vu, trois fois sur trois, à l’identique :

- clic 1 : case cochée, aucune erreur ; clic 2 : case décochée, aucune erreur ;
- clic 3 : la fenêtre disparaît, `heading "Une erreur est survenue" [level=1]`, `paragraph: Cannot read properties of
  null (reading 'checked')`, `button "Recharger"` ; console : `TypeError: Cannot read properties of null (reading
  'checked')` puis « React Router caught the following error during render ». La saisie en cours est perdue.
- Cause lue : `apps/web/src/pilotage/Fournisseurs.tsx` l. 770 à 775 : `e.currentTarget.checked` est lu dans la fonction
  passée à `setChoix`, exécutée par React après la fin du gestionnaire d’événement (où `currentTarget` vaut `null`).

Différence avec la phase 1 : le défaut n’est pas aléatoire (« deux fois sur quatre ») mais systématique au troisième
clic de la séquence cocher, décocher, recocher.

Gravité : majeur confirmé : l’évaluation (A.5.19 à A.5.22) est perdue et la page inutilisable jusqu’au rechargement ;
aucune donnée fausse n’est enregistrée.

Test déterministe (page) : en `rssi`, `goto /pilotage/fournisseurs?perimetre=00000000-0000-4000-8000-000000000001`,
`getByRole('button', { name: 'Évaluer le fournisseur <fournisseur fictif>' }).click()`, puis trois
`getByRole('checkbox', { name: '<critère actif>' }).click()` ; attendu après correction : la case est cochée et
`getByRole('heading', { name: 'Une erreur est survenue' })` absent (aucun `pageerror`) ; observé : l’écran d’erreur au
troisième clic. Prérequis : un fournisseur et un critère actif (création par l’API `POST` des fournisseurs et critères,
ou données de la tranche 1).

### C1-10 — Objectifs et indicateurs : deux modèles selon le périmètre (pile 1)

Fait (compte `rssi`) : `pilote.mjs ouvrir "/pilotage/processus?perimetre=…"`, `/pilotage/objectifs`,
`/pilotage/indicateurs` et `/pilotage/synthese`, sous le principal puis sous « Hébergement HDS » ; ouverture d’une fiche
d’objectif et d’indicateur de chaque côté ; contrôle par l’API.

Vu :

- Principal : `heading "Objectifs par processus"`, boutons « Ajouter un processus », « Ajouter un objectif », « Ajouter un
  indicateur », OBJ1 et OBJ2 avec leurs indicateurs. `dialog "Objectif OBJ1"` : « Objectif », « Échéance »,
  « Responsable », « Enjeux associés (un par ligne) », « Ce qui sera fait », « Ressources nécessaires », « Comment les
  résultats seront évalués ». `dialog "Indicateur IND1"` : « Objectif » (liste), « Sens », « Cible » « 100 % », méthodes
  de surveillance, « Valeur », « Ajouter la mesure » (historique) ; **aucun champ « Unité »**.
- Sous HDS : même menu, mais `button "Ajouter processus"`, `button "Ajouter objectif"`, `button "Ajouter indicateur"`
  (registre générique, « 1 fiches »). `dialog "Fiche — Objectif"` : « Intitulé », « Description », « Responsable »,
  « Résultat attendu », « Échéance » (ni processus, ni indicateur, ni ressources, ni méthode d’évaluation).
  `dialog "Fiche — Indicateur"` : « Valeur mesurée », « Cible », « Unité », « Date de mesure » (ni objectif, ni
  historique).
- Synthèse sous HDS : titres de niveau 2 absents ; seuls les anneaux « Actions », « Risques », « Contrôles »,
  « Preuves » et « Référentiels activés… » ; **aucune carte « Objectifs et indicateurs »** (présente au principal :
  `heading "Objectifs et indicateurs" [level=2]`), alors qu’un objectif et un indicateur existent sous HDS.
- API : principal `GET /api/grc/00000000-…-0001/objects?kind=objective` → `total 0` (OBJ1, OBJ2 sont dans
  `GET /api/suivi/etat`, `objectives`, clés `enjeux`, `plan`, `resources`, `evaluation`, `processes`) ; HDS
  `kind=objective` → 1 (clés `description`, `dueAt`, `ownerId`, `target`), `kind=indicator` → 1 (clés `target`, `unit`,
  `value`, `measuredAt`). Le principal ne liste pas l’objectif de HDS (attendu par ADR 0039 : pas de consolidation).

Gravité : majeur confirmé : sous le sous-périmètre, l’objectif ne peut pas porter les éléments de planification du 6.2
(ressources, méthode d’évaluation) ni être relié à son indicateur, et la Synthèse ne le montre pas (9.1).

Doublon : même cause que BUG-037 (`apps/web/src/pages/Pilotage.tsx`, `smsi === SOCLE` : registre historique au principal,
registre générique ailleurs) ; l’absence d’unité au principal est BUG-028.

Test déterministe (page) : en `rssi`, sur un sous-périmètre fictif, `POST /api/grc/<sous-périmètre>/objects`
`{"kind":"objective","name":"Objectif fictif du sous-périmètre"}` → 200, puis `goto /pilotage/synthese?perimetre=<id>` ;
attendu après correction : `getByRole('heading', { name: 'Objectifs et indicateurs', level: 2 })` visible ; observé :
absent. Second test : `goto /pilotage/objectifs?perimetre=<id>` ; attendu : `button "Ajouter un objectif"` (même modèle
qu’au principal) ; observé : `button "Ajouter objectif"` et fiche « Fiche — Objectif » sans « Ressources nécessaires ».

### C1-12 — Écart créé par le clausier sans responsable, sans échéance, absent de la DdA (pile 1), et INV-08

Fait (compte `rssi`) :

1. `pilote.mjs invariants` sur l’état laissé par les phases 1 et 2.
2. Lecture de l’écart existant : `GET /api/grc/00000000-…-0001/objects?kind=nonconformity`, `GET /api/dda?reference=A`,
   `GET /api/suivi/etat` (`findings`) ; écrans « Annexe A (DdA) » (`/pilotage/dda-annexe-a`), « Amélioration continue »
   (`/pilotage/amelioration`), « Plan d’actions » (`/pilotage/actions`).
3. Rejeu du chemin par l’écran : `/pilotage/evaluations-clausier`, `cliquer button "Nouvelle évaluation"`, « Produit ou
   prestation » « rejeu C1-12 prestation (fictif) », « Évaluateur », `choisir "État du point O-1.1" "Non conforme"`,
   réponse, puis `cliquer button "Créer les actions pour les écarts"`. Contrôles, puis nettoyage : évaluation de rejeu
   supprimée (`DELETE /api/evaluations-clausier/EVAL-mwe8m7xl` → 200) et écart de rejeu FOU-02 archivé
   (`DELETE /api/grc/00000000-…-0001/objects/e79402bb-… [If-Match "1"]` → 200) ; état final : FOU-01 seul, dans le
   registre comme dans la DdA.

Vu :

- Invariants : `ALERTE INV-06 … « Évaluation sécurité Infogérant fictif : 1 point(s) à traiter » sans responsable ni
  échéance` ; `ÉCHEC INV-08 … « Évaluation sécurité Infogérant fictif : 1 point(s) à traiter » absent de la DdA`.
- **L’écart est pourtant dans la DdA** : `GET /api/dda?reference=A` → `"ecarts":[{"id":"FOU-01","type":"PP",
  "status":"Ouvert","items":["A-5.19","A-5.20","A-5.21","A-5.22"]}]` ; à l’écran « Annexe A (DdA) » :
  `row "A.5.19 Sécurité de l'information dans les relations avec les fournisseurs FOU-01"`, de même A.5.20, A.5.21 et
  A.5.22 (`cell "FOU-01"`).
- L’objet du registre : `id "aa5d058a-…"`, `legacyKey "findings"`, `legacyId "FOU-01"`, `refs`
  `legacy:items:A-5.19` à `A-5.22`, `ownerId: null`, `dueAt: ""`, `findingType: "opportunity"`.
- Rejeu : message `alert: Action FOU-02 créée avec 1 point(s) à traiter.` ; résultat : un **second écart de même nom**
  « Évaluation sécurité Infogérant fictif : 1 point(s) à traiter » (FOU-02), `ownerId: null`, `dueAt: ""`, nature
  « opportunity » (« Opportunité d’amélioration » dans la fiche) pour un point « Non conforme » ;
  `GET …/objects?kind=action` → `total 0` ; « Plan d’actions » : `alert: Aucune action dans cette période et ces
  filtres.` ; « Amélioration continue » : « 0 ouvertes · 0 closes · 0 en retard » (actions) et « 1 constats ». La DdA
  liste aussitôt FOU-02 sur A.5.19 à A.5.22, et INV-08 signale aussi FOU-02 « absent de la DdA ».
- Contournement possible par l’écran : fiche « Fiche — Non-conformité » (`combobox "Responsable"`, `textbox
  "Échéance"`) et menu « Autres actions » → `menuitem "Créer une action suivie"` (voir BUG-034).
- Effet de bord relevé : « Nouvelle évaluation » crée l’évaluation dès le clic (`GET /api/evaluations-clausier` →
  `EVAL-mwe8m7xl`, sans produit ni évaluateur), avant toute saisie (même famille que C1-20).

**INV-08 : faux positif de l’invariant.** `tests/e2e/rssi-virtuel/invariants.ts` (l. 177 à 182) indexe les écarts de la
DdA par `e.id` (identifiant historique « FOU-01 », `apps/api/src/historique/dda.ts` l. 49 : la DdA lit
`findings`) et les cherche avec l’`id` de l’objet du registre (UUID « aa5d058a-… »). Les deux ne coïncident jamais pour
un écart issu du registre historique, qui porte l’identifiant de la DdA dans `legacyId`. En cherchant par
`legacyId ?? id`, FOU-01 est trouvé, ses mesures (A-5.19 à A-5.22) sont les mêmes et les deux états sont ouverts
(« open » / « Ouvert ») : la règle passerait. La correction de l’invariant (ajouter `legacyId` à l’interface `Ecart` et
l’utiliser pour la recherche) revient à la session de correction ; l’échec ne prouve aucune incohérence des données.

Gravité : **baissée de bloquant à majeur** : la donnée n’est pas fausse (l’écart est tracé dans la DdA sur les bonnes
mesures), mais « Créer les actions pour les écarts » ne crée aucune action, annonce le contraire, laisse l’écart sans
responsable ni échéance (10.2) et le duplique à chaque évaluation ; le plan d’actions s’obtient seulement par
contournement.

Doublon : l’absence de responsable et d’échéance recoupe BUG-034 ; « Action … créée » sans action dans le plan recoupe
BUG-035 (ce qui est compté comme action d’un écran à l’autre) ; le reste est propre au clausier.

Test déterministe (API) : en `rssi`, avec un fournisseur fictif `SUP-…` : `POST /api/evaluations-clausier`
`{"supplier":"SUP-…"}` → 201, `PUT /api/evaluations-clausier/<id>/points/O-1.1` `{"st":"Non conforme","c":"fictif"}`
(schéma `ReponsePoint` de `packages/shared/src/suivi-evals-fournisseurs.ts`), puis `POST /api/evaluations-clausier/<id>/action` → 201 `{"action":"FOU-0n","taches":1}` ; attendu après
correction : `GET /api/grc/00000000-0000-4000-8000-000000000001/objects?kind=action` contient une action liée à l’écart,
ou l’écart créé a `ownerId` et `dueAt` renseignés ; observé : `kind=action` → `total 0`, `ownerId: null`, `dueAt: ""`.
À garder vert : `GET /api/dda?reference=A` → `ecarts[]` contient `FOU-0n` avec `A-5.19` à `A-5.22`. INV-08 : à corriger
avant de s’en servir comme preuve (sinon il échoue sur tout écart issu du registre historique rattaché à une mesure).

### T1-01 et T2-01 — Impossible de limiter un compte au sous-périmètre (piles 1 et 2)

Fait :

- Pile 1, `rssi` : `GET /api/grc/d8161580-…/members` → `test7-restreint` membre du seul « Hébergement HDS » (écriture).
- Pile 1, session API de `test7-restreint` (Contributeur) : lectures et écritures sur le principal ; création d’une
  fiche « rejeu T1-01 écriture du compte restreint (fictif) », archivée ensuite par `rssi`.
- Pile 1, écran : connexion de `test7-restreint` dans le Chrome du pilote (mot de passe + TOTP), `ouvrir
  "/pilotage/parties?perimetre=00000000-…-0001"`, liste « Périmètre affiché », fiche d’une partie intéressée ; puis
  retour au compte `rssi` : `/pilotage/perimetres`, `Modifier le périmètre SMSI Groupement Santé Fictif`, `Créer un
  périmètre`.
- Pile 2 (T2-01), session API de `test7-restreint` : `GET /api/grc/smsis`, registre des risques du principal, création
  d’une opportunité « rejeu T2-01 … », archivée ensuite par `rssi`.

Vu :

- Pile 1, API (`test7-restreint`) : `GET /api/grc/smsis` → HTTP 200, « SMSI Groupement Santé Fictif » (`visibility
  "instance"`) et « Hébergement HDS » (`restricted`) ; `GET /api/grc/00000000-…-0001/objects?kind=context` → **HTTP 200**
  (« Contexte réglementaire de la santé (fictif) ») ; `kind=governance` → 200 ; `GET /api/suivi/etat` → 200 (`items`
  157, `findings` 1, `suppliers` 2, `objectives` 2, `indicators` 2, `supEvals` 1) ;
  `POST /api/grc/00000000-…-0001/objects` `{"kind":"stakeholder","name":"rejeu T1-01 …"}` → **HTTP 200**,
  `createdBy "test7-restreint"` ; `PATCH /api/grc/00000000-…-0001/pilotage/objectifs/processes/PR999` → HTTP 404
  « Processus introuvable. » (le contrôle d’accès est passé) ; `DELETE` de sa fiche → 403 « Droit requis :
  pilotage:supprimer » (attendu pour un contributeur). Témoin d’isolement : `GET /api/grc/1bb500a2-…/objects?kind=context`
  (périmètre restreint dont il n’est pas membre) → **HTTP 404** « Périmètre introuvable ou non accessible. ».
- Pile 1, écran (`test7-restreint`, « Contributeur ») : `combobox "Périmètre affiché": SMSI Groupement Santé Fictif`,
  options `option "SMSI Groupement Santé Fictif" [selected]`, `option "Hébergement HDS"` ; `button "Ajouter partie
  intéressée"`, « 2 fiches » ; `dialog "Fiche — Partie intéressée"` avec `textbox "Intitulé"` modifiable et `button
  "Enregistrer"` (pas de mention « lecture seule »).
- Pile 1, écran (`rssi`) : `dialog "Modifier le périmètre"` du principal : « Nom », « Type », « Rattaché à », « Hériter des
  référentiels du parent » [disabled], « Périmètre », « Fuseau horaire » : **aucun champ d’accès** ; `Créer un périmètre` :
  mêmes champs, aucun choix d’accès. La colonne « Accès » de la liste affiche « Toute l’organisation » pour
  `visibility = 'instance'` (`apps/web/src/pilotage/Perimetres.tsx` l. 305).
- Pile 2, API (`test7-restreint`, membre du seul HDS) : `GET /api/grc/smsis` → deux périmètres ;
  `GET /api/grc/00000000-…-0001/risks/register` → **HTTP 200** (risques du principal) ;
  `POST /api/grc/00000000-…-0001/objects` `{"kind":"opportunity",…}` → **HTTP 200**. (Au passage : sur la pile 2,
  `test7-lecteur` et `test7-auditeur` sont membres de HDS avec `write: true` ; leur rôle bloque l’écriture, constat de
  la tranche 2, non rejoué ici.)
- Code : `apps/api/src/grc/core.ts` crée le périmètre commun avec `visibility: 'instance'` (l. 282, `initialize()`) et
  `access()` ne contrôle l’appartenance que si `visibility === 'restricted'` (l. 327 à 329) ; aucune route ne modifie
  `visibility`.

Ce que dit la documentation (éléments pour l’arbitrage, sans trancher) :

- ADR 0039, décision 1 : « le périmètre reste l’unité de partitionnement des droits, des objets et des liens » ; décision 4 :
  « objets, preuves, évaluations, droits et membres ne se propagent pas » (d’un parent vers un enfant). L’ADR ne dit pas
  qu’un membre d’un enfant perd l’accès au parent, ni que le périmètre racine peut être restreint.
- ADR 0010 : droits = module × action, union des rôles ; seule portée prévue : les modules de l’auditeur externe ;
  « l’outil historique est filtré par module ». Aucune portée par périmètre pour un compte.
- ADR 0043 : droits par ressource (registre ou élément, rôles lecteur, contributeur, gestionnaire) et registre
  « restreint » qui supprime l’accès par les droits de module ; c’est le seul mécanisme documenté pour fermer un
  ensemble d’éléments à des comptes, et il porte sur les registres (plans, écarts, tâches récurrentes), pas sur le contexte,
  les risques ou les fournisseurs.
- `docs/03_ARCHITECTURE/SECURITE.md` : « Autorisations : Module × action, rôles/groupes, relecture serveur et périmètres
  GRC » ; « Export : … pas d’export global inter-périmètre ». `docs/03_ARCHITECTURE/DAT.md` : portée de lecture (ADR
  0083) « droit de module, périmètre, registre restreint, rôle attribué », sans promesse de cloisonnement du périmètre
  commun.
- `docs/archive/refonte-grc/01-DIAGNOSTIC.md` (archivé) décrit l’existant : « L’organisation, c’est l’instance » ;
  isolement « par la visibilité du périmètre (`instance` ou `restricted`) plus l’appartenance ». Le périmètre commun est
  donc, par construction, celui de toute l’organisation.
- Aucun document lu ne promet de limiter un compte à un sous-périmètre en lui fermant le périmètre commun ; aucun ne
  signale non plus cette limite à l’administrateur (l’écran « Accès au périmètre » ne l’explique pas).

Verdict : reproduit sur les deux piles, à l’identique. Gravité : majeur confirmé en l’état de la documentation (rien n’est
lu ou écrit hors des droits **documentés**) ; il devient bloquant si le RSSI retient le cloisonnement comme exigence
(A.5.15, A.8.3, séparation des activités d’hébergement HDS), puisque le compte de l’équipe d’hébergement lit et modifie
alors tout le périmètre commun et les registres de l’organisation.

Doublon : T1-01 et T2-01 décrivent le même défaut (et T3-01, T4-01, T5-01, T6-02 des autres piles) : une seule entrée.

Test déterministe (API) : en `rssi`, créer un compte Contributeur fictif, un sous-périmètre fictif (`POST
/api/grc/smsis`, parent `00000000-0000-4000-8000-000000000001`), l’y rendre membre en écriture (`PUT /api/grc/<sous-périmètre>/members` `{"userId":"<id>","write":true}`) ; avec la session du
compte : `GET /api/grc/smsis` ; attendu après décision « cloisonnement » : seul le sous-périmètre ; observé : les deux.
`POST /api/grc/00000000-0000-4000-8000-000000000001/objects` `{"kind":"stakeholder","name":"Fiche fictive hors
périmètre"}` ; attendu : 404 « Périmètre introuvable ou non accessible. » ; observé : 200. Témoin à garder vert : le même
compte reçoit 404 sur un autre périmètre restreint dont il n’est pas membre. Si le RSSI retient la limite assumée, le test
porte plutôt sur l’avertissement de l’écran « Accès au périmètre ».

### C2-01 — « Stratégie » affiche « Réduire » mais envoie une valeur vide (pile 2)

Fait (compte `rssi`) : `pilote.mjs ouvrir "/pilotage/risques?perimetre=00000000-…-0001"`, `cliquer button "Ajouter un
risque"` ; script `r12-c201.mjs` (relié au Chrome du pilote) : « Nom de la fiche » « rejeu C2-01 risque re-sélection
(fictif) », les cinq « Analyse et justification » remplies, clic sur `combobox "Stratégie"` puis sur `option
"Réduire"` (la valeur déjà affichée), « Enregistrer la fiche », capture du corps de la requête et de la réponse. Rejoué
deux fois. Témoin : même fiche sans toucher à « Stratégie » (fiche « rejeu C2-01 témoin … » créée, puis archivée par
l’API, `DELETE …/objects/31e5571f-… [If-Match "1"]` → 200).

Vu :

- Avant et après le clic : `combobox "Stratégie"` vaut « Réduire ».
- Corps envoyé : `"methodId":"f1d25479-…" ; "strategy":null` ; réponse **HTTP 422** `{"error":"Données invalides —
  strategy : Option invalide : une valeur parmi \"reduce\"|\"accept\"|\"transfer\"|\"avoid\"|\"treated\"
  attendue"}` ; alerte « Erreur Données invalides — strategy : … » placée hors de la fenêtre (`y = -3166`, invisible sans
  défiler : C2-02). Deux fois sur deux.
- Témoin sans re-sélection : `"strategy":"reduce"`, HTTP 200 : seule la re-sélection de la valeur affichée la vide.
- Cause lue : `apps/web/src/grc/ObjectEditor.tsx` l. 476 à 479 : `value={String(data.strategy ?? 'reduce')}` affiche
  « Réduire » quand la valeur est `null`, et la liste Mantine désélectionne l’option déjà choisie (pas
  d’`allowDeselect={false}`, que d’autres écrans posent, `config-grc/commun.tsx` l. 149).

Gravité : majeur confirmé : l’écran affiche une valeur qui n’est pas celle envoyée et refuse l’enregistrement dans des
termes techniques, hors de vue ; le RSSI ne peut s’en sortir qu’en choisissant une autre option puis « Réduire ».

Doublon : même mécanisme que BUG-022 (« Méthode publiée » re-cliquée → `methodId` nul) ; message technique de la famille
BUG-025 ; position de l’alerte : C2-02. À corriger ensemble (même composant).

Test déterministe (page) : en `rssi`, périmètre ayant une méthode publiée, `goto /pilotage/risques?perimetre=<id>`,
`getByRole('button', { name: 'Ajouter un risque' }).click()`, remplir `Nom de la fiche` et les champs obligatoires,
`getByRole('combobox', { name: 'Stratégie' }).click()`, `getByRole('option', { name: 'Réduire', exact: true }).click()`,
puis `waitForRequest` sur `POST /api/grc/<id>/objects` et clic sur `Enregistrer la fiche` ; attendu après correction :
`postDataJSON().data.strategy === 'reduce'` et réponse 200 (ou combobox vide et message « Choisissez une stratégie ») ;
observé : `strategy: null`, 422.

### C2-03 — Un risque jamais apprécié peut être formellement accepté (pile 2)

Fait (compte `rssi`) : création par l’écran (« Ajouter un risque », script `r12-c201.mjs accept`) d’un risque « rejeu
C2-03 risque jamais apprécié (fictif) », « Stratégie » « Accepter », « Justification d’acceptation » remplie, sans
appréciation ; puis, sur sa ligne du registre, `button "Décider de l’acceptation"` (script `r12-c203.mjs`) : échéance
2027-11-12, « Conditions et justification de la décision », case de confirmation, « Confirmer l’enregistrement ». Le
risque a ensuite été archivé (`DELETE /api/grc/00000000-…-0001/objects/b2dc61f6-… [If-Match "2"]` → 200 ; la décision
reste dans l’historique).

Vu :

- Avant la décision : `GET /api/grc/00000000-…-0001/risks/register` → `"brut": null, "residuel": null,
  "acceptabilite": null, "appreciationValidee": false, "acceptation": "a_decider"` ; ligne `row "rejeu C2-03 … ISO/IEC
  27005 Non apprécié — Accepter Acceptation à décider …"`.
- Fenêtre `dialog "Décider de l’acceptation du risque"` : « Date de la décision », « Échéance de l’acceptation »,
  `combobox "Résultat": Risque accepté`, aide « Niveau de risque accepté, conditions … », justificatifs, case « Je
  confirme l’enregistrement de cette décision » ; **aucun avertissement** sur l’absence d’appréciation.
- `POST /api/grc/00000000-…-0001/pilotage/decisions` corps `{"ref":"object:b2dc61f6-…","decision":{"operation":
  "risk_acceptance","result":"accepted","until":"2027-11-12","confirm":"ENREGISTRER",…}}` → **HTTP 200** ; registre :
  `"version": 2, "brut": null, "acceptation": "acceptee", "decisionAcceptation": {"by":"rssi","date":"2026-11-13",
  "until":"2027-11-12","result":"accepted"}` ; ligne « Non apprécié — Accepter Acceptée jusqu’au 12/11/2027 ».

Gravité : **montée de majeur à bloquant** : l’application enregistre une décision formelle d’acceptation d’un risque
sans niveau de risque comparé aux critères d’acceptation (6.1.2 e), 6.1.3 f), 8.3) ; c’est une non-conformité qu’un
auditeur relèverait sur le registre produit, et la décision est immuable.

Doublon : aucun dans la liste ; voisin de BUG-024 (niveau choisi sans contrôle de la matrice), cause distincte (aucun
contrôle de présence d’une appréciation dans la décision).

Test déterministe (API) : en `rssi`, sur un périmètre ayant une méthode publiée, `POST /api/grc/<id>/objects`
`{"kind":"risk","name":"Risque fictif non apprécié","data":{"methodId":"<méthode>","strategy":"accept",
"acceptanceReason":"fictif"}}` (les étapes de la fiche, `stages`, telles que l’écran les envoie), puis `POST /api/grc/<id>/pilotage/decisions`
`{"ref":"object:<id risque>","decision":{"operation":"risk_acceptance","step":"","requestId":"<uuid>","note":"fictif",
"date":"<aujourd’hui>","result":"accepted","refs":[],"createFinding":false,"createAction":false,"until":"<+1 an>",
"confirm":"ENREGISTRER"}}` ; attendu après correction : 409 ou 422 avec un message du type « Appréciez le risque avant
de décider de son acceptation » ; observé : 200 et `acceptation: "acceptee"` dans `GET /api/grc/<id>/risks/register`.

### C2-05 — Registre des risques, plan de traitement et études EBIOS RM non exportables (pile 2)

Fait (compte `rssi`, principal) : `pilote.mjs ouvrir` `/pilotage/risques`, `/opportunites`, `/etudes` (puis « Ouvrir
l’étude », onglets « 5. Traitement du risque » et « Suivi, matrice et cercle »), `/traitements`, `/scenarios`, `/carte`,
recherche de tout bouton dont le nom contient export, Excel, télécharger, CSV, PDF, imprimer ou rapport ; `ouvrir
/exports`, clic sur `button "Excel classique : export complet"` (script `r12-dl.mjs`) ; `/pilotage/imports`, clic sur
`button "Données du rapport JSON"`.

Vu :

- Aucun bouton d’export sur le registre, les opportunités, les études (ni dans les onglets de l’étude), les traitements,
  les scénarios et actifs ; seule la carte a `button "Exporter SVG"`, `"Exporter PNG"`, `"Exporter PDF"`, `"Exporter
  JSON"`.
- `GET /api/suivi/export?groupe=all&mode=std` → classeur de **28 feuilles** (Pronostic de l’audit 2027 … DdA A et H,
  Registre des écarts, Plan d’actions, fournisseurs, contexte, incidents, preuves, plans, tâches récurrentes, GAP) :
  **aucune feuille de risques, d’appréciations, de traitements ni d’EBIOS RM**, alors que
  `GET /api/grc/00000000-…-0001/objects?kind=treatment` → 5 traitements (T-01 à T-05).
- `GET /api/grc/00000000-…-0001/report` (« Données du rapport JSON ») → `sections` = `risks`, `tasks`, `frameworks`,
  `mappings` : pas de section de traitements ; « T-01 » n’apparaît nulle part (0 occurrence), alors que « R-01 » apparaît ;
  valeurs brutes « conditional » (9), « unacceptable » (6), « reduce » (19), « draft » (4) (voir C2-06).
- Les boutons « Exporter JSON » et « Exporter Excel » de « Import et rapports » exportent un référentiel (« Erreur
  Choisissez un référentiel. »), pas les risques.

Gravité : majeur confirmé : le plan de traitement (6.1.3 e) et les livrables EBIOS RM ne peuvent pas être remis hors de
l’application ; l’auditeur doit les consulter à l’écran ; aucune donnée n’est faussée.

Doublon : même famille que C1-04 et le volet export de C1-03 (le jeu d’export de `apps/api/src/export/rubriques.ts`
ignore les objets du Pilotage) ; à traiter ensemble.

Test déterministe (API) : en `rssi`, `GET /api/suivi/export?groupe=all&mode=std` ; attendu après correction : une
feuille de registre des risques et une feuille de plan de traitement (noms à fixer à la correction), contenant le code
d’un risque et d’un traitement fictifs créés par l’API (`POST /api/grc/<id>/objects` `kind` `risk` et `treatment`) ;
observé : 28 feuilles, aucune. Second test : `GET /api/grc/<id>/report` → `sections` sans traitement.

### C2-06 — Codes anglais et valeurs techniques hors de l’historique des décisions (pile 2)

Fait (compte `rssi`, principal) : `pilote.mjs ouvrir "/pilotage/carte?perimetre=00000000-…-0001"` ; `/pilotage/etudes`,
« Ouvrir l’étude », `cliquer tab "5. Traitement du risque"` ; `/pilotage/configuration`, `cliquer button "Créer ISO
27005"` (brouillon local, non publié, abandonné en rechargeant la page), sections « Échelles et niveaux », « Dimensions
d’impact », « Règles de calcul » dépliées ; `/pilotage/imports`, `button "Rapport de pilotage / audit"` (HTML) et
`button "Données du rapport JSON"` (script `r12-dl.mjs`).

Vu :

- Carte des risques, légende : `paragraph: ISO/IEC 27005 — politique d’appréciation · publication b6fcedd4`,
  `paragraph: Modéré · conditional`, `paragraph: Élevé · unacceptable` (et « publication 6acec5cb », « Moyen ·
  conditional » pour la version 2).
- Étude EBIOS RM, atelier 5 : `cell "Option : reduce"`.
- Éditeur de méthode : `button "Retirer configuration.dimensions 1"`, `button "Retirer configuration.levels 1"` à
  `levels 3` (le composant `apps/web/src/config-grc/editeurs.tsx` l. 144 compose `Retirer ${libelle}` avec la clé
  technique).
- Rapport HTML (`GET /api/grc/00000000-…-0001/report`) : « R-02 … Élevé Modéré conditional reduce 2027-03-01 1 draft
  rssi 2026-11-12T20:10:38.070636+00:00 … » ; occurrences dans le texte : « conditional » 3, « reduce » 4, « draft » 4,
  horodatages « +00:00 » 4. Rapport JSON : « conditional » 9, « unacceptable » 6, « reduce » 19, « draft » 4.
- Non revu dans ce rejeu : « Mode » = « judgement » (la section « Mode » s’ouvre sans valeur lisible dans l’arbre).

Gravité : majeur confirmé : le rapport remis au comité ou à l’auditeur et la légende de la carte mêlent codes anglais et
horodatages techniques (7.5, consigne « interface en français » d’AGENTS.md) ; les valeurs sont justes.

Doublon : extension de BUG-023 (« draft », « unacceptable » dans l’appréciation) ; à fusionner si la traduction des
valeurs est centralisée au même endroit.

Test déterministe : (page) `goto /pilotage/carte?perimetre=<id>` avec au moins une méthode publiée ; attendu après
correction : aucun texte `/\b(conditional|unacceptable|acceptable)\b/` ni « publication <hex> » dans `main` ; observé :
« Modéré · conditional ». (API) `GET /api/grc/<id>/report` (HTML) : attendu : aucune occurrence de `conditional`,
`reduce`, `draft` ni d’horodatage ISO hors attributs ; observé : présentes. (page) `/pilotage/configuration`, « Créer
ISO 27005 », « Échelles et niveaux » : aucun `button` dont le nom contient `configuration.`.

### C2-07 — Choix des mesures d’un traitement sans référence, avec doublons et textes tronqués (pile 2)

Fait (compte `rssi`, principal) : `pilote.mjs ouvrir "/pilotage/traitements?perimetre=00000000-…-0001"`, `cliquer button
"Ajouter un traitement"`, puis script `r12-options.mjs` qui ouvre `combobox "Mesures de sécurité (mesures, DdA)"` et
relève les options (fenêtre refermée sans enregistrer) ; lecture de T-01 et de ses liens par l’API.

Vu :

- `dialog "Ajouter — Traitement"` : 157 options dans un `listbox` ; **aucune** ne commence par une référence (A.x, 4.x,
  HDS) ; premières options « Compréhension de l’organisation et de son contexte », « Compréhension des besoins et attentes
  des parties intéressées », « Détermination du domaine d’application du SMSI »… (clauses 4 à 10, annexe A et HDS
  mélangées) ; « Sauvegarde des informations » sans « A.8.13 ».
- Doublons : 3 × « Généralités », 2 × « Appréciation des risques de sécurité de l’information », 2 × « Traitement des
  risques de sécurité de l’information » (6.1.2 / 8.2 et 6.1.3 / 8.3 indiscernables).
- 31 options tronquées par « … », dont 9 qui commencent par « Conformément au n° de l’article R.1111-11 du CSP, le
  contrat d’hébergement conclu entre l’Hébergeur et son… » (seul le numéro d’alinéa les distingue).
- T-01 : `GET /api/grc/00000000-…-0001/objects/dc2b7133-…` → `"measureRefs":["legacy:items:A-8.13",
  "legacy:items:A-8.14"]`, `"refs":[]` ; `GET /api/grc/00000000-…-0001/links?ref=object:dc2b7133-…` → HTTP 200, deux
  liens seulement : l’action « Mettre en œuvre : T-01 … » (`implements`, entrant) et le risque (`related_to`, `derived`,
  « Référence saisie dans la fiche source ») ; **aucun lien vers A.8.13 ni A.8.14** (le risque saisi dans un champ est
  dérivé en lien, les mesures ne le sont pas).

Différence avec la phase 1 : 157 options (et non 160) ; le reste est identique. Second chemin (pile 1, sous-périmètre
« Hébergement HDS » qui hérite des copies appliquées d’ISO/IEC 27001 et HDS v2) : 157 options **préfixées** de leur
référence (« A-8.13 · 8.13 — Sauvegarde des informations », « HDS-01 · … »), sans doublon de nom, mais 31 toujours
tronquées. Le défaut de libellé tient donc à la source historique (`legacy:items`) utilisée au périmètre commun quand les
mesures sont proposées depuis la DdA historique.

Gravité : majeur confirmé : le choix des mesures (6.1.3 b) et c)) ne peut pas se faire par référence de l’annexe A, des
exigences homonymes sont indiscernables, et la trace traitement → mesure n’apparaît pas dans les liens.

Doublon : le volet « mesure liée invisible » est de la même famille que BUG-026 (vu depuis la DdA) ; le libellé des
options est propre à ce constat.

Test déterministe : (page) en `rssi`, `goto /pilotage/traitements?perimetre=00000000-0000-4000-8000-000000000001`,
« Ajouter un traitement », `getByRole('combobox', { name: 'Mesures de sécurité (mesures, DdA)' }).click()` ; attendu
après correction : une `option` dont le nom commence par « A.8.13 » et aucune paire d’options de même nom ; observé :
`option "Sauvegarde des informations"`, 3 × « Généralités ». (API) créer un traitement fictif avec
`"measureRefs":["legacy:items:A-8.13"]` puis `GET /api/grc/<id>/links?ref=object:<traitement>` ; attendu : un lien
vers `legacy:items:A-8.13` ; observé : aucun.

### C2-08 — Sous-périmètre : aucune mesure proposée pour un traitement (piles 2 et 1)

Fait (compte `rssi`) : pile 2, `pilote.mjs ouvrir "/pilotage/traitements?perimetre=4dbcd8d1-…"` (Hébergement HDS),
`cliquer button "Ajouter un traitement"`, script `r12-options.mjs` sur `combobox "Mesures de sécurité (mesures, DdA)"`,
sans saisie puis en tapant « Sauv » ; même chose sous le principal ; requêtes relevées et rejouées par l’API. Second
chemin : pile 1, même écran sous « Hébergement HDS » (`d8161580-…`), dont le parent a ISO/IEC 27001 et HDS v2
appliqués et qui en hérite. Fenêtres refermées sans enregistrer.

Vu :

- Pile 2, HDS : 0 option, 0 `listbox`, avec ou sans saisie, sans message ; requête émise
  `GET /api/grc/4dbcd8d1-…/sources?search=Sauv&cibles=object:measure,object:soa,requirement,legacy:items,legacy:soa`
  → HTTP 200 `{"items":[],"truncated":false}`. Même requête sous le principal → `{"items":[{"ref":
  "legacy:items:A-8.13","name":"Sauvegarde des informations","kind":"items"}]}`.
- Pile 2 : `GET /api/grc/4dbcd8d1-…/framework-attachments` → `[]` **et** `GET /api/grc/00000000-…-0001/
  framework-attachments` → `[]` : aucun référentiel n’est appliqué sur cette pile (la tranche 2 ne couvre pas les
  référentiels) ; HDS a `inheritFrameworks: true` mais n’a rien à hériter. Les 157 options du principal viennent de la
  DdA historique (`legacy:items`), réservée au périmètre commun (FCT-043 : « données historiques limitées au périmètre
  commun »).
- Pile 1, HDS (référentiels appliqués au parent et hérités) : 157 options, et la recherche « Sauvegarde » renvoie
  `option "A-8.13 · 8.13 — Sauvegarde des informations"` (`GET /api/grc/d8161580-…/sources?search=Sauvegarde&…` →
  `requirement:30b52917-…:1:A-8.13`). **Le sous-périmètre propose bien les mesures dès qu’un référentiel est appliqué.**

Verdict : reproduit en partie : le défaut décrit (« aucune mesure proposée sous un sous-périmètre qui hérite ») ne se
reproduit pas quand le parent a des référentiels appliqués ; il reste que, sans référentiel appliqué, la liste est vide
sans explication alors que la DdA historique existe au périmètre commun.

Gravité : **baissée de majeur à mineur** : le parcours prévu (appliquer ISO/IEC 27001 et HDS v2 au périmètre, ce que fait
la tranche des référentiels) rend les mesures disponibles ; manque un message « appliquez un référentiel à ce périmètre ou
à son parent » sur la liste vide.

Doublon : aucun dans la liste ; voisin de C2-07 (deux sources de mesures, historique au principal, copies de référentiel
ailleurs, aux libellés différents).

Test déterministe (API) : sur une pile neuve, sous-périmètre fictif rattaché au principal, sans référentiel appliqué :
`GET /api/grc/<sous-périmètre>/sources?search=Sauvegarde&cibles=object%3Ameasure%2Cobject%3Asoa%2Crequirement%2Clegacy%3Aitems%2Clegacy%3Asoa`
→ `items: []` (observé) ; à garder vert : après application d’ISO/IEC 27001 au parent avec héritage, la même requête
renvoie un `requirement:…:A-8.13`. La correction attendue (message ou proposition de la DdA historique) se vérifie à
l’écran : liste vide accompagnée d’un texte explicatif.
