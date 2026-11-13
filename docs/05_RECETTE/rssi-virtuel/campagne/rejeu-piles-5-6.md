# Rejeu de la phase 3 : piles 5 et 6

| Élément | Valeur |
| --- | --- |
| Campagne | Phase 3, point 2 ([CAMPAGNE-MULTI-AGENT.md](../CAMPAGNE-MULTI-AGENT.md), §5) : rejeu indépendant des défauts bloquants et majeurs avant inscription |
| Code testé | commit `2e63e86` (images des piles) ; dépôt à `e61b008` au début du rejeu (commits de documentation et d'outillage de recette seulement) |
| Date | 13/11/2026, de 01:15 à 01:38 (Europe/Paris) |
| Piles | 5 = `https://127.0.0.15` (`PILOTE_PORT=9338`, `.pilote-5`) ; 6 = `https://127.0.0.16` (`PILOTE_PORT=9339`, `.pilote-6`). Remplies par les phases 1 et 2, `GET /api/setup` : `needed:false`, `adminExists:true` |
| Comptes | `rssi` (administrateur) et comptes `test7-*` de la phase 2 ; secrets dans `.pilote-N/` seulement, aucun ici |
| Hors rejeu | T5-01 et T6-02 (rejoués par l'agent des piles 1 et 2) |

Abréviations : `pilote` = `node tests/e2e/rssi-virtuel/pilote.mjs` ; `<racine>` = `00000000-0000-4000-8000-000000000001`
(« SMSI Groupement Santé Fictif ») ; `<HDS-5>` = `f027169d-c8cb-43a0-adb7-de6e2c41be96` (« Hébergement HDS », pile 5).
Les objets créés pour le rejeu portent le préfixe « rejeu ».

## Tableau de synthèse

| Constat | Verdict | Gravité proposée → retenue | Doublon de | Test déterministe (oui/non) |
| --- | --- | --- | --- | --- |
| C5-01 Compteur « Continuité » limité aux PCRA | reproduit | majeur → **bloquant** | — | oui (API `GET /api/grc/perimetres/synthese`) |
| C5-03 Aucune fiche de continuité ou d'exercice archivable à l'écran | reproduit | majeur → majeur | — | oui (page, menu « Autres actions ») |
| C5-04 Deux registres d'exercices qui s'ignorent | reproduit | majeur → majeur | famille BUG-037 ; cause commune C5-16 | oui (API `GET /api/crise`) |
| C5-05 Responsable d'action de scénario perdu | reproduit (5/5 ; cause différente : clé de ligne) | majeur → majeur | — | oui (page puis `GET /api/crise`) |
| C5-06 Incidents et crise sans périmètre | reproduit | majeur → **bloquant** | cause commune T5-01 / T6-02 ; famille BUG-037 | oui (API, compte non membre) |
| C5-11 Gravité RETEX « Faible » inventée | reproduit | majeur → **bloquant** | — | oui (unitaire `indicateursRetex`) |
| C5-15 Export : « Piste de progrès » libellée « Point sensible » | reproduit | majeur → **bloquant** | — | oui (unitaire `feuillesDuGroupe('ec')`) |
| C5-16 « Export complet » incomplet et sans périmètre | reproduit | majeur → majeur | cause commune C5-04, BUG-020, BUG-037 | oui (API `GET /api/suivi/export?groupe=all`) |
| C5-17 Resélection du périmètre → racine | reproduit | majeur → majeur | **T5-04** (même défaut, autre liste) | oui (page, combobox) |
| C5-18 Bandeau de crise réelle absent | reproduit | majeur → majeur | — | oui (page `/` après `POST /api/crise/cellules`) |
| C5-19 Incidents absents des synthèses | reproduit | majeur → majeur | recoupe BUG-031 (revue) | oui (API mur et rapport) |
| C6-04 Référentiel complémentaire actif vide ; ReCyF désactivé | reproduit | majeur → **bloquant** | — | oui (API et page) |
| C6-05 Catégorie NIS 2 non remise à vide ; journal inexact | reproduit | majeur → **bloquant** | voisin C6-15 | oui (API `PUT`/`GET` + journal) |
| C6-12 Revue des accès sans périmètres | reproduit | majeur → majeur | lié à T5-01 / T6-02 | oui (API `GET /api/admin/access-review`) |
| C6-15 Valeurs numériques corrigées en silence | reproduit en partie (pas d'écart durable écran/donnée ; serveur correct) | majeur → **mineur** | famille C6-01, C5-26 | oui (page Sécurité) |
| C6-20 Exécutant d'exploitation indisponible | **outillage** (`docker compose` de l'exécutant sans nom de projet de la pile) | majeur → sans objet | — | non (outillage à corriger d'abord) |
| C6-21 Test de restauration daté dans le futur accepté | reproduit | majeur → majeur | famille C5-02, C5-10 | oui (API `PUT /api/settings/sauvegardes`) |
| C6-22 Versions de l'état vides | reproduit, défaut propre (indépendant de C6-20) | majeur → majeur | — | oui (API `GET /api/admin/versions/:v`) |
| T5-02 Contributeur retire des événements RETEX | reproduit | bloquant → bloquant | — | oui (API `DELETE …/retex/:eid`) |
| T5-03 Module « Incidents et PCA/PRA » sans les PCA/PRA | reproduit | majeur → majeur | — | oui (API, auditeur à un module) |
| INV-08 en ÉCHEC (pile 5) | faux positif de l'invariant (outillage) | bloquant → sans objet | BUG-019 (double identifiant) | correction dans `invariants.ts` |
| T5-01, T6-02 | non rejoués ici (agent des piles 1 et 2) | — | — | — |

Bilan : 18 reproduits, 1 reproduit en partie, 0 non reproduit, 2 outillage (C6-20, INV-08). Gravités montées : C5-01,
C5-06, C5-11, C5-15, C6-04, C6-05 (majeur → bloquant). Gravité baissée : C6-15 (majeur → mineur).

## Rejeu par constat

### C5-01 — Le compteur « Continuité » ne compte que les plans de type PCRA (pile 5)

- Fait : `pilote ouvrir "/pilotage/continuite?perimetre=<racine>"` ; `pilote api GET
  "/api/grc/<racine>/objects?kind=continuity_plan"` et idem `<HDS-5>` ; `pilote ouvrir /pilotage/perimetres` ;
  `pilote ouvrir /` ; `pilote api GET /api/grc/perimetres/synthese` ; `pilote api GET /api/mur/synthese`.
- Vu :
  - écran Continuité et reprise, racine : `paragraph: 1 fiches`, ligne « PRA de la plateforme d'hébergement (fictif) … À
    préparer » ; API : racine 1 plan `planType:"pra"`, HDS 1 plan `planType:"pcra"`, aucun archivé.
  - Périmètres : sous le racine `link "0 PCRA"` (lien vers `/pilotage/continuite?perimetre=<racine>`, où l'écran montre
    1 fiche) ; `Total · Continuité : 1 PCRA`.
  - Tableau de bord, région « Risques et continuité » : `paragraph: "1"` / `paragraph: plans de continuité et de reprise`
    alors que deux plans existent (PRA + PCRA).
  - `GET /api/grc/perimetres/synthese` → 200, carte racine `"compteurs":{…"continuite":{"pcra":0}}`, `"total":{…"continuite":{"pcra":1}}` ;
    `GET /api/mur/synthese` → 200, `"continuite":{"pcra":1}`.
  - Cause confirmée par lecture : `apps/api/src/grc/cartes.ts:66` filtre `o.data->>'planType'='pcra'` ; les types
    possibles sont `pca`, `pra`, `pcra`, `activity` (`packages/shared/src/pilotage.ts:92`).
- Verdict : **reproduit**.
- Gravité : majeur → **bloquant** (chiffre faux sur le tableau de bord, la carte des périmètres et le mur : un auditeur lit
  « 1 plan de continuité et de reprise » pour deux plans, et « 0 » pour un périmètre qui a son PRA).
- Doublon : aucun dans BUG-016 à BUG-037.
- Test déterministe : oui, par l'API. Créer sous un périmètre vierge `POST /api/grc/:smsi/objects`
  `{"kind":"continuity_plan","name":"rejeu PRA","data":{"planType":"pra"}}`, puis `GET /api/grc/perimetres/synthese` :
  attendu après correction `cartes[i].compteurs.continuite` = 1 plan (quel que soit le nom du champ) ; observé
  `{"pcra":0}`. À l'écran : `/pilotage/perimetres`, lien « 0 PCRA » sous le périmètre qui a un PRA.

### C5-03 — Continuité et exercices : aucune fiche ne peut être archivée ni supprimée à l'écran (pile 5)

- Fait : `pilote ouvrir "/pilotage/exercices?perimetre=<racine>"` ; `pilote cliquer button "Autres actions pour Exercice
  incohérent à supprimer (fictif)"` ; `pilote cliquer button "Ouvrir"` ; même chose sur `/pilotage/continuite` pour
  « PRA de la plateforme d'hébergement (fictif) ». Second chemin : fiche « rejeu exercice réalisé (fictif) » créée par
  « Ajouter exercice et retour d'expérience », cherchée à l'écran comment la retirer, puis archivée par l'API avec un
  script relié au Chrome du pilote (`r56-c503.mjs`, bloc-notes).
- Vu :
  - menu de ligne : `menu "Autres actions pour Exercice incohérent à supprimer (fictif)"` → `menuitem "Créer une action
    suivie"`, `menuitem "Décisions et réalisations"`, rien d'autre ; fiche ouverte (`dialog "Fiche — Exercice et retour
    d'expérience"`, onglets Informations, Liens et justificatifs, Historique) : `button "Fermer"`, `button "Enregistrer"`.
    Même menu et mêmes boutons pour le PRA et pour la fiche « rejeu » créée à l'instant.
  - API : `DELETE /api/grc/<racine>/objects/<id rejeu>` sans `If-Match` → 428 « Version attendue manquante (en-tête
    If-Match) » ; avec `If-Match: 1` → **200**, la fiche disparaît de `GET …/objects?kind=continuity_exercise`. Le
    service sait archiver, l'écran ne le propose pas.
  - Cause lue : `apps/web/src/pages/Pilotage.tsx` n'utilise `ObjectEditor` (qui porte « Archiver la fiche ») que pour
    `action`, `task_series` et `risk` ; `apps/web/src/pilotage/Registry.tsx` n'a aucune commande d'archivage.
- Verdict : **reproduit** (fiche « Exercice incohérent à supprimer (fictif) » toujours présente ; la fiche « rejeu » a été
  archivée par l'API pour ne rien laisser).
- Gravité : majeur → **majeur, confirmé** (une fiche saisie par erreur ne peut être retirée que par l'API).
- Doublon : aucun.
- Test déterministe : oui, par la page. Créer par l'API une fiche `continuity_exercise` « rejeu », ouvrir
  `/pilotage/exercices`, cliquer `button "Autres actions pour <intitulé>"` : attendu après correction un `menuitem`
  « Archiver la fiche » (ou un bouton du même nom dans la fiche) ; observé : seulement « Créer une action suivie » et
  « Décisions et réalisations ». Même test sur `/pilotage/continuite` (`kind: continuity_plan`).

### C5-04 — Deux registres d'exercices qui s'ignorent (pile 5)

- Fait : sur `/pilotage/exercices?perimetre=<racine>`, création par l'écran de « rejeu exercice réalisé (fictif) »
  (date prévue 02/11/2026, réalisé le 05/11/2026, résultat Réussi, état Réalisé, retour d'expérience saisi) ; relecture du
  bandeau ; `pilote ouvrir /` (tuile « Plans du SMSI 2026 ») ; `pilote ouvrir /pilotage/crise-cellule`, `pilote cliquer
  combobox "Exercice planifié lié"` ; même écran Exercices sous `<HDS-5>` ; `pilote api GET /api/crise`, `GET /api/plans`,
  `GET /api/grc/<racine>/objects?kind=continuity_plan`.
- Vu :
  - Exercices (racine), après création : registre `paragraph: 3 fiches` dont deux « Réalisé » en 2026 (restauration du
    15/10/2026, « rejeu » du 05/11/2026), mais bandeau du bloc « Plan d'exercices PRA et crise » : `paragraph: 1/1`,
    `paragraph: réalisé(s) en 2026` (seul PL-EXO-001 du registre historique `GET /api/plans` est compté).
  - Tableau de bord, « Plans du SMSI 2026 » : `row "Exercice 1 0 0"` (réalisé 1).
  - Cellule de crise : `combobox "Exercice planifié lié" [expanded]` sans aucune option ; `GET /api/crise` → 200,
    `"exercices": []`, alors que le registre a deux exercices « Planifié » (« Exercice incohérent à supprimer (fictif) »
    au racine, « Test de bascule du site d'hébergement HDS (fictif) » sous HDS). Cause lue :
    `apps/api/src/historique/crise.ts:81` ne lit que `plans` du registre historique (`type === 'exo'`, non réalisés), et
    l'ouverture d'une cellule refuse tout autre exercice (`crise.ts:120-121` : 422 « Exercice planifié absent. »).
  - Sous HDS : pas de bloc « Plan d'exercices », 1 fiche, aucun compteur d'exercices.
  - PRA lié à A.8.13 : `testedAt: ""` malgré l'exercice de restauration réalisé.
  - Le constat d'origine citait « 0/0 » : la différence vient de PL-EXO-001 passé à « Réalisé » depuis ; le défaut est le
    même (les exercices du registre ne sont jamais comptés).
- Verdict : **reproduit**.
- Gravité : majeur → **majeur, confirmé** (les compteurs disent ce qu'ils comptent, le registre historique ; l'étape est
  faisable en saisissant deux fois, ce qui est le contournement).
- Doublon : même famille que BUG-037 (deux registres parallèles, l'un historique sans périmètre) mais pas le même objet.
  T5 l'a reconfirmé (PL-EXO créé « depuis HDS » visible sous le racine).
- Test déterministe : oui, par l'API. `POST /api/grc/<racine>/objects`
  `{"kind":"continuity_exercise","name":"rejeu exercice planifié","data":{"plannedAt":"<date future>"}}` (champs de
  `packages/shared/src/pilotage.ts`, `continuity_exercise`), puis `GET /api/crise` : attendu après correction
  l'exercice dans `exercices` ; observé `[]`. À l'écran : `/pilotage/exercices`, nombre de lignes « Réalisé » de l'année
  du registre comparé au bandeau « n/m réalisé(s) en <année> ».

### C5-05 — Scénario de crise : responsable d'une action perdu sans message (pile 5)

- Fait : `pilote ouvrir /pilotage/crise-scenarios`, `pilote cliquer button "Ajouter un scénario"`, renommé « rejeu
  scénario (fictif) » ; puis quatre fois : `pilote remplir "Action N" "rejeu action N"`, `pilote remplir "Responsable de
  l’action N" "rejeu responsable N"`, `pilote cliquer button "Ajouter une action"` ; rechargement ;
  `pilote api GET /api/crise` ; `pilote api GET "/api/admin/audit?limit=30"`. Deux contre-épreuves (ci-dessous). Scénario
  « rejeu » supprimé ensuite par l'écran (« Supprimer ce scénario ? », Confirmer).
- Vu :
  - après les quatre saisies : `textbox "Action 1": rejeu action 1` … `textbox "Action 4": rejeu action 4`, mais
    `textbox "Responsable de l’action 1"` … `"Responsable de l’action 4"` **vides**, sans alerte (« Alertes : aucune ») ;
    `GET /api/crise` → 200, `"items":[{"t":"rejeu action 1","owner":""}, … ]` : **4 pertes sur 4**.
  - journal d'audit : pour chaque action, un seul `crisis.scenario-action-updated` (le texte de l'action) suivi de
    `crisis.scenario-action-added` ; aucune écriture du responsable.
  - contre-épreuve 1 : même saisie de l'action 5, puis clic ailleurs et attente de 4 s avant « Ajouter une action » :
    responsable **perdu aussi** ; ce n'est donc pas la course avec « Ajouter une action » supposée en phase 1.
  - contre-épreuve 2 : responsable saisi sur une action dont le texte est déjà enregistré (action 1), puis « Ajouter une
    action » aussitôt : **enregistré** ; texte de l'action 6 saisi puis validé (clic ailleurs) avant de saisir son
    responsable : **enregistré**.
  - Cause probable, lue dans `apps/web/src/incidents/Crise.tsx` (lignes 693 à 717) : la ligne porte la clé
    `` `${k}-${x.t}` `` ; l'enregistrement du texte de l'action (à la sortie du champ « Action N ») change `x.t`, donc la
    ligne est recréée pendant que l'on tape le responsable, et la saisie locale du champ disparaît sans être envoyée.
- Verdict : **reproduit** (plus fréquent qu'en phase 1 : 5 sur 5 dans l'enchaînement naturel action puis responsable ;
  cause différente de celle supposée).
- Gravité : majeur → **majeur, confirmé** (perte silencieuse ; le RSSI doit ressaisir chaque responsable une seconde fois).
- Doublon : aucun.
- Test déterministe : oui, par la page (sans attente fixe). Sur `/pilotage/crise-scenarios`, ajouter un scénario puis une
  action ; `getByRole('textbox', { name: 'Action 1' }).fill('rejeu action 1')`, puis
  `getByRole('textbox', { name: 'Responsable de l’action 1' }).fill('rejeu responsable 1')`, puis clic sur
  `button "Ajouter une action"` ; attendre la réponse `POST /api/crise/scenarios/<id>/actions` ; recharger et lire
  `GET /api/crise` : attendu après correction `items[0].owner === "rejeu responsable 1"` ; observé `""`.

### C5-06 — Incidents, RETEX, cellules, contacts et scénarios de crise ne sont rattachés à aucun périmètre (pile 5)

- Fait : `pilote ouvrir "/pilotage/incidents-registre?perimetre=<racine>"` puis `<HDS-5>`, `pilote cliquer-texte "Tous"` ;
  `pilote api GET /api/incidents` (champs d'une fiche) et `GET "/api/incidents?smsi=<HDS-5>"` ; second chemin : session
  API séparée de `pilote.infra` (contributeur, **non membre** de « Hébergement HDS » : `GET /api/grc/<HDS-5>/members` ne
  le liste pas), script `r56-c506.mjs`.
- Vu :
  - registre sous le racine et sous HDS : mêmes trois lignes `row "INC-2026-003 …"`, `row "INC-2026-002 … Incident
    fournisseur P2 …"`, `row "INC-2026-001 … Incident de sécurité …"`, seul le `combobox "Périmètre affiché"` change.
  - `GET /api/incidents` → 200 ; clés d'une fiche : `actions, answers, cat, cause, collecte, desc, detectedAt, findingId,
    id, impact, kind, notified, owner, reporter, resolvedAt, retex, status, timeline, title, urgency` : **aucun champ de
    périmètre** ; le paramètre `?smsi=<HDS-5>` est ignoré (même réponse).
  - `pilote.infra` : `GET /api/grc/smsis` → `["SMSI Groupement Santé Fictif"]` ; `GET /api/grc/<HDS-5>/objects?kind=continuity_plan`
    → **404** « Périmètre introuvable ou non accessible. » ; mais `GET /api/incidents` → **200** avec INC-2026-002 (saisi
    sous HDS en phase 1) et `GET /api/crise` → 200 avec les cellules (dont la crise réelle ouverte sous HDS), le scénario
    et les deux contacts.
  - Les routes `apps/api/src/routes/historique/incidents.ts` et `crise.ts` n'ont aucun paramètre de périmètre.
- Verdict : **reproduit**.
- Gravité : majeur → **bloquant** (un compte exclu du périmètre restreint HDS lit les incidents et cellules de crise
  saisis sous ce périmètre, et l'auditeur HDS ne peut pas isoler les incidents des activités d'hébergement ; limite de
  conception à arbitrer, comme T5-01).
- Doublon : cause commune avec T5-01 et T6-02 (impossible de limiter un compte au sous-périmètre) ; même famille que
  BUG-037 (registre historique sans colonne de périmètre). T5 l'a reconfirmé pour tous les rôles.
- Test déterministe : oui, par l'API. Compte contributeur non membre d'un périmètre restreint P : `GET /api/grc/<P>/…` →
  404 (déjà vrai) ; incident créé par l'administrateur avec P affiché (`POST /api/incidents` tel que l'écran l'envoie sous
  P), puis `GET /api/incidents` avec la session du contributeur : attendu après correction, l'incident absent (ou la fiche
  porte un champ de périmètre égal à P) ; observé : incident présent, aucun champ de périmètre.

### C5-11 — RETEX : gravité « Faible » inventée pour un incident critique (pile 5)

- Fait : `/pilotage/incidents-registre`, `pilote cliquer button "Saisir directement"` → fiche `INC-2026-004`, intitulé
  « rejeu incident critique (fictif) », Qualification « Incident de sécurité », Impact « Élevé », Urgence « Élevé » ;
  `pilote cliquer button "RETEX et chronologie (0 événement)"` ; événement « rejeu alerte EDR (fictif) », type Détection,
  12/11/2026 23:00, **gravité laissée vide**, `pilote cliquer button "Ajouter à la chronologie"` ; `pilote api GET
  /api/incidents`. Second chemin : lecture de la fonction partagée qui calcule la gravité.
- Vu :
  - fiche : `paragraph: Priorité` / `paragraph: P1 Critique`.
  - RETEX : `row "12/11/2026 23:00 T0 Détection rejeu alerte EDR (fictif) Faible (reportée) Saisie du pilote …"`,
    `term: Gravité maximale` / `definition: Faible` (avant l'ajout : `definition: –`).
  - `GET /api/incidents` → 200, INC-2026-004 `"impact":"Élevé","urgency":"Élevé"`, événement `"gravite":""` : la donnée
    enregistrée est vide, « Faible » est fabriqué à l'affichage.
  - Cause lue : `packages/shared/src/retex-incidents.ts`, `chronologieRetex()` part de `let precedent = 1` (« sinon 1 »),
    soit `GRAVITES_RETEX[1] = 'Faible'`, et `indicateursRetex().graviteMax` reprend ce niveau ; la priorité de l'incident
    n'est pas lue.
- Verdict : **reproduit** (sur un incident neuf, sans import ; la fiche INC-2026-004 « rejeu » reste sur la pile jusqu'à la
  fin du rejeu, voir « Nettoyage »).
- Gravité : majeur → **bloquant** (donnée fausse : « Gravité maximale : Faible » affichée pour un incident P1 Critique
  sans aucune gravité saisie, alors que la grille classe une donnée fausse en bloquant).
- Doublon : aucun.
- Test déterministe : oui, test unitaire de `packages/shared` sans pile : `indicateursRetex([{ id: 'EV-001', ts:
  '2026-11-12T23:00', type: 'Détection', titre: 'x', description: '', acteur: '', gravite: '', source: '', apport: '' }])
  .graviteMax` : attendu après correction `''` (non renseignée) ; observé `'Faible'`. Par la page : fiche d'incident P1
  sans gravité, `/pilotage/incidents-retex?incident=<id>`, `term "Gravité maximale"` suivi de `definition "Faible"`.

### C5-15 — Export Excel : « Piste de progrès » libellée « Point sensible » (pile 5)

- Fait : `/exports`, clic sur `button "Excel classique : export complet"` par un script relié au Chrome du pilote
  (`r56-export.mjs`, téléchargement enregistré dans le bloc-notes), feuilles relues par un lecteur local
  (`r56-xlsx.py`) ; `pilote api GET "/api/grc/<racine>/objects?kind=nonconformity"` ; `pilote ouvrir /`.
- Vu :
  - classeur `export-all-std-2026-11-13.xlsx`, feuille « Registre des écarts » : `INC-AC-01 | Interne | 2026 | Point
    sensible | Ouvert | Action issue de l’incident INC-2026-001 …`.
  - API → 200 : l'écart `legacyId:"INC-AC-01"` a `findingType:"opportunity"` ; tableau de bord : `img "Écarts ouverts par
    type : NC majeure : 0, NC mineure : 0, Point sensible : 0, Piste de progrès : 1, Remarque : 0"`.
  - Cause lue : `apps/api/src/export/rubriques.ts:64-65`, `typeEcart` : `{ NC: 'Non-conformité', PP: 'Point sensible',
    OBS: 'Observation' }`, alors que `packages/shared/src/audit/model.ts:69-70` définit `PS: 'Point sensible'`,
    `PP: 'Piste de progrès'`. Les autres codes du modèle (`NC maj`, `NC min`, `PS`, `Remarque`) sortent bruts. La même
    fonction sert aux feuilles « Registre des écarts » et « Plan d'actions » (lignes 309 et 343).
- Verdict : **reproduit**.
- Gravité : majeur → **bloquant** (donnée fausse dans le document remis à l'auditeur : une piste de progrès y devient un
  point sensible, classification qui pèse sur la décision de certification).
- Doublon : aucun.
- Test déterministe : oui, test unitaire de l'API sans pile : `feuillesDuGroupe('ec', { etat: { findings: [{ id:
  'rejeu-01', type: 'PP', status: 'Ouvert', tasks: [] }], items: [] }, aujourdhui: '2026-11-13' })`, feuille « Registre
  des écarts », 4e colonne : attendu `Piste de progrès` ; observé `Point sensible`. Par l'API sur pile :
  `GET /api/suivi/export?groupe=ec&mode=std` (droit `import_export:exporter`) puis lecture de la feuille.

### C5-16 — « Export complet » incomplet et sans périmètre (pile 5)

- Fait : même classeur que C5-15 ; `pilote ouvrir /exports` ; lecture de `apps/api/src/routes/export-suivi.ts`.
- Vu :
  - 28 feuilles : `Pronostic de l'audit 2027, Plan de l'audit 2027, Participants, Couverture du cycle d'audit, Objectifs
    de sécurité, Indicateurs, Processus, ISO 27001 — clauses 4 à 10, Déclaration d'applicabilité — A, Déclaration
    d'applicabilité — H, Registre des écarts, Plan d'actions, Fournisseurs et applications, Certificats fournisseurs,
    Contrôles fournisseurs, Évaluations sécurité fournisseu, Périmètre du SMSI, Parties intéressées, Analyses SWOT, Rôles
    et responsabilités, Registre des incidents, Contacts de crise, Mains courantes, Registre des preuves, Plans du SMSI,
    Tâches récurrentes, GAP — applications à intégrer, GAP — points de contrôle`. Aucune feuille pour les plans de
    continuité (PRA racine, PCRA HDS), les exercices du registre, les RETEX et chronologies, les scénarios de crise, les
    documents, les risques, traitements ou revues de direction.
  - « Plans du SMSI » : PL-EXO-001 seul. « Périmètre du SMSI » : lignes `Version`, `Validé le`, `Validé par`, `Énoncé`,
    `Sites`, `Processus inclus` **sans valeur**, alors que `GET /api/grc/smsis` donne un `scope` renseigné pour les deux
    périmètres. « Mains courantes » : `2026-11-12 20:17:02.168Z` (horodatage brut UTC). Noms de feuilles tronqués à 31
    caractères (« Déclaration d'applicabilité — A », « Évaluations sécurité fournisseu »).
  - `/exports` : `heading "Exports Excel"` puis les groupes ; **aucun** `combobox "Périmètre affiché"`.
  - Cause lue : `GET /api/suivi/export` ne lit que l'état historique (`PorteeLecture…etatHistoriqueSiPresent()`), jamais
    les fiches du Pilotage ni les périmètres.
- Verdict : **reproduit**.
- Gravité : majeur → **majeur, confirmé** (chaque registre du Pilotage a son bouton « Exporter le registre et ses
  décisions », contournement possible mais long ; la feuille « Périmètre du SMSI » vide reste trompeuse).
- Doublon : pas un doublon, mais même cause que C5-04, BUG-020 et BUG-037 (lecture du seul registre historique, pas
  des fiches du Pilotage ni des périmètres).
- Test déterministe : oui, par l'API. Après création d'un `continuity_plan` « rejeu » :
  `GET /api/suivi/export?groupe=all&mode=std` → 200 ; attendu après correction une feuille des plans de continuité qui
  contient « rejeu », et la ligne « Énoncé » de « Périmètre du SMSI » égale au `scope` du périmètre ; observé : aucune
  feuille, ligne vide. `GET /api/suivi/export/groupes` sert à vérifier la liste des groupes.

### C5-17 — Resélectionner le périmètre affiché bascule sur le périmètre racine (pile 5)

- Fait : `pilote ouvrir "/pilotage/imports?perimetre=<HDS-5>"`, `pilote choisir "Périmètre affiché" "Hébergement HDS"`,
  `pilote voir` ; second chemin sur `/pilotage/continuite?perimetre=<HDS-5>`, même choix. Aucun import lancé.
- Vu :
  - Import et rapports : avant `combobox "Périmètre affiché": Hébergement HDS` ; après avoir choisi la même option,
    `combobox "Périmètre affiché": SMSI Groupement Santé Fictif`, alors que l'adresse reste
    `/pilotage/imports?perimetre=<HDS-5>`.
  - Continuité et reprise : avant `row "PCA de l'activité d'infogérance HDS (fictif) Validé …"` ; après, le registre
    affiché est celui du racine : `row "PRA de la plateforme d'hébergement (fictif) …"`, combobox sur le racine, adresse
    inchangée. Un ajout fait à ce moment irait dans le racine.
  - Cause lue : `apps/web/src/pages/Pilotage.tsx:289-296`, `<Select label="Périmètre affiché" … onChange={chooseScope}>`
    sans `allowDeselect={false}` : Mantine désélectionne l'option déjà choisie et `chooseScope(null)` retombe sur le
    racine. Les écrans de `apps/web/src/config-grc/` posent `allowDeselect={false}`, pas celui-ci.
- Verdict : **reproduit** (deux écrans, à chaque essai).
- Gravité : majeur → **majeur, confirmé** (la saisie part dans le mauvais périmètre si l'on ne relit pas le sélecteur ; la
  confirmation d'import ne nomme pas le périmètre).
- Doublon : même défaut que T5-04 (liste « Accès au périmètre » de `apps/web/src/pilotage/Members.tsx` : choisir de
  nouveau « Lecture et écriture » donne « Lecture seule ») ; une seule correction (`allowDeselect={false}` sur les listes
  sans valeur vide) les ferme tous deux.
- Test déterministe : oui, par la page. `page.goto('/pilotage/continuite?perimetre=<sous-périmètre>')`, ouvrir
  `getByRole('combobox', { name: 'Périmètre affiché' })`, cliquer `getByRole('option', { name: '<sous-périmètre>' })` ;
  attendu après correction `toHaveValue('<sous-périmètre>')` ; observé : nom du périmètre racine.

### C5-18 — Crise réelle : le bandeau rouge annoncé n'existe pas (pile 5)

- Fait : `pilote ouvrir /pilotage/crise-cellule`, `pilote cliquer-texte "Crise réelle — situation avérée : bandeau rouge sur
  le tableau de bord et dans le menu jusqu’à la clôture."`, `pilote remplir "Intitulé" "rejeu crise réelle (fictive)"`,
  `pilote cliquer button "Ouvrir la cellule de crise"`, « Déclencher une cellule de CRISE RÉELLE ? » → Confirmer ; puis,
  cellule ouverte : `pilote ouvrir /` (arbre enregistré), `pilote capture r56-tdb-crise-reelle` relue,
  `pilote api GET /api/mur/synthese` ; enfin « Clôturer la cellule » → Confirmer.
- Vu :
  - cellule : `paragraph: rejeu crise réelle (fictive)`, `text: CRISE RÉELLE`, `paragraph: ouverte le 13/11/2026 00:25`.
  - tableau de bord pendant la crise : « Alertes : aucune », aucun texte contenant « crise » dans tout l'arbre
    d'accessibilité (bannière, menu, contenu) ; capture relue : en-tête « En direct », menu et tuiles ordinaires, aucun
    bandeau rouge.
  - `GET /api/mur/synthese` → 200, clés `actions, auditInterne, conformite, continuite, ecarts, ecartsOuverts, echeances,
    ecran, genereLe, indicateurs, mesures, organisation, pilotage, plan, plans, prochainAudit, recurrences, risques` :
    aucune information de crise pour le mur.
  - Recherche dans le code : « Réel » / « CRISE » n'apparaissent dans `apps/web/src` que dans `incidents/Crise.tsx` et
    `incidents/Retex.tsx` (reprise de la main courante) ; aucun composant de bandeau.
  - Cellule « rejeu » clôturée à 00:26 ; elle reste dans « Cellules précédentes » (pas de suppression possible).
- Verdict : **reproduit**.
- Gravité : majeur → **majeur, confirmé** (l'écran promet une alerte qui n'existe pas ; la crise se gère depuis la cellule,
  mais les autres utilisateurs ne sont pas prévenus).
- Doublon : aucun.
- Test déterministe : oui, par la page. `POST /api/crise/cellules` `{"mode":"Réel","title":"rejeu crise"}` → 201 (corps lu dans
  `apps/api/src/historique/crise.ts:111-130`), puis `page.goto('/')` : attendu
  après correction un élément visible (`getByRole('alert')` ou texte « Crise réelle en cours ») ; observé : aucun. Clôture
  par `POST /api/crise/cellules/:id/cloture` en fin de test.

### C5-19 — Les incidents ne remontent dans aucune synthèse (pile 5)

- Fait : incidents présents : INC-2026-001 (incident de sécurité P1, résolu, RETEX), INC-2026-002, INC-2026-003 et la fiche
  « rejeu » INC-2026-004 (P1 Critique, statut Nouveau). `pilote ouvrir /` (arbre + capture `r56-tdb-crise-reelle` relue) ;
  `pilote ouvrir /pilotage/synthese` ; `pilote api GET /api/mur/synthese` ; `pilote api GET /api/grc/<racine>/report` ;
  recherche du texte « Revue des incidents » dans le code.
- Vu :
  - tableau de bord : tuiles Prochain audit, Écarts, Actions en retard, Taux de conformité, Niveau de mise en œuvre, Écarts
    ouverts par type, Prochaines échéances, Risques et continuité, Tâches récurrentes, Plans du SMSI 2026, Mesures suivies,
    Plan d'audit, Écarts par statut, par classification, par audit : **aucune tuile ni chiffre d'incident**, alors qu'un
    incident P1 est ouvert.
  - `/pilotage/synthese` : titres `Objectifs et indicateurs`, `Écarts ouverts`, `Conformité par référentiel`, `Plans du
    SMSI 2026`, `Actions et tâches récurrentes`, `Risques et continuité` ; 0 occurrence du mot « incident » dans la zone
    principale.
  - `GET /api/mur/synthese` → 200, aucune clé d'incident (liste des clés en C5-18).
  - `GET /api/grc/<racine>/report` → 200, `sections` = `risks, tasks, frameworks, mappings` ; ni « incident » ni
    « INC-2026 » dans le corps.
  - L'écran du registre annonce « … alimentent la diapositive « Revue des incidents » du COPIL sécurité »
    (`apps/web/src/incidents/Incidents.tsx:76`) : ce texte n'existe nulle part ailleurs dans `apps/` ni `packages/`
    (générateur de diapositives `apps/api/src/export/office.ts` sans incident) ; `apps/api/src/pilotage/revue.ts` ne lit
    pas les incidents.
- Verdict : **reproduit**.
- Gravité : majeur → **majeur, confirmé** (le RSSI doit recompter et reporter à la main les incidents dans la revue ; la
  promesse de l'écran est fausse).
- Doublon : recoupe BUG-031 (entrées de la revue de direction sans les incidents) pour la partie revue ; le reste
  (tableau de bord, synthèse, mur, rapport, texte « Revue des incidents ») est propre à C5-19.
- Test déterministe : oui, par l'API. Avec un incident `kind:"Incident de sécurité"` ouvert : `GET /api/mur/synthese` et
  `GET /api/grc/<racine>/report` → attendu après correction un compteur d'incidents (ouverts, P1) ; observé : aucune clé.
  Par la page : `/pilotage/synthese`, `getByText(/incident/i)` dans `main` : attendu au moins un, observé 0.

### T5-02 — Un contributeur retire des événements de la chronologie RETEX sans le droit « supprimer » (pile 5)

- Fait : session API séparée de `test7-contrib` (rôle « Contributeur », vérifié par `GET /api/auth/me`), script
  `r56-t502.mjs`, sur la fiche « rejeu » INC-2026-004 (créée pour C5-11) : `POST /api/incidents/INC-2026-004/retex`
  `{"ts":"2026-11-12T23:10","type":"Confinement","titre":"rejeu événement du contributeur (fictif)","gravite":""}`, puis
  `DELETE /api/incidents/INC-2026-004/retex/EV-002` (son événement), `DELETE …/retex/EV-001` (événement saisi par
  `rssi`), et en contraste `DELETE /api/incidents/INC-2026-004`. Journal relu avec `rssi`. Second chemin, par l'écran :
  Chrome du pilote connecté en `test7-contrib` (`r56-switch.mjs`), `pilote ouvrir
  "/pilotage/incidents-retex?incident=INC-2026-001"`.
- Vu :
  - `POST …/retex` → 201 ; `DELETE …/retex/EV-002` → **200** ; `DELETE …/retex/EV-001` (saisi par un autre compte) →
    **200** ; chronologie ensuite `[]`. `DELETE /api/incidents/INC-2026-004` → **403** `"Droits insuffisants : vous ne
    pouvez pas supprimer dans « Incidents et PCA/PRA ».","permission":"incidents:supprimer"`.
  - journal (`GET /api/admin/audit`) : `test7-contrib incident.retex-deleted legacy:incidents:INC-2026-004
    {"version":150}` puis `{"version":151}` : ni l'identifiant ni le contenu de l'événement retiré.
  - écran, compte `test7-contrib`, RETEX de INC-2026-001 (données de la phase 1, non modifiées) : **9** `button
    "Retirer"`, un par événement, tous de même nom.
  - Cause lue : `apps/api/src/routes/historique/incidents.ts:104-112`, `DELETE /api/incidents/:id/retex/:eid` déclaré
    `access: 'incidents:modifier'`, alors que `DELETE /api/incidents/:id` exige `incidents:supprimer`.
- Verdict : **reproduit** (y compris sur un événement saisi par un autre compte).
- Gravité : bloquant → **bloquant, confirmé** (suppression hors des droits du rôle, d'un élément de preuve d'un
  incident, sans trace de ce qui a été retiré).
- Doublon : aucun dans BUG-016 à BUG-037. Voisin de C5-09 (suppression sans trace exploitable).
- Test déterministe : oui, par l'API. Compte contributeur (sans `incidents:supprimer`) : `POST /api/incidents/<id>/retex`
  (corps ci-dessus) → 201, puis `DELETE /api/incidents/<id>/retex/<eid>` → attendu après correction **403**
  (`"permission":"incidents:supprimer"`) ; observé **200**. Par la page : contributeur sur
  `/pilotage/incidents-retex?incident=<id>` : attendu 0 `button "Retirer"`, observé un par événement.

### T5-03 — Le module « Incidents et PCA/PRA » n'ouvre pas les PCA/PRA (pile 5)

- Fait : modules de `test7-auditeur` (Auditeur externe) ramenés à « Incidents et PCA/PRA » et « Documents et liens » par
  `PATCH /api/admin/users/<id>` avec `If-Match` (script `r56-t503.mjs restreindre`, session `rssi` ; même effet que la
  fenêtre « Modifier » de Plateforme › Utilisateurs, dont la liste multiple n'est pas pilotable) ; session API de
  l'auditeur (`r56-t503.mjs tester`) ; écran : Chrome du pilote connecté en `test7-auditeur`, `pilote ouvrir
  /pilotage/continuite` ; modules rétablis ensuite à trois (`r56-t503.mjs retablir` → 200, `incidents, documents,
  pilotage`, comme laissé par la phase 2).
- Vu :
  - `GET /api/incidents` → 200 ; `GET /api/crise` → 200 ; `GET /api/grc/<racine>/objects?kind=continuity_plan` → **403**
    `"Droit requis : pilotage:lire"` ; `…?kind=continuity_exercise` → **403** idem ; `GET /api/plans` → **403** « Droits
    insuffisants : vous ne pouvez pas consulter dans « Pilotage du SMSI ». ».
  - écran : `heading "Continuité et reprise"`, puis `paragraph: Vous ne disposez pas du droit de consulter cette
    rubrique.`
  - Cause lue : `packages/shared/src/permissions.ts:34` `incidents: 'Incidents et PCA/PRA'`, mais
    `packages/shared/src/grc.ts:73-74` rattache `continuity_plan` et `continuity_exercise` au module `pilotage`.
- Verdict : **reproduit**.
- Gravité : majeur → **majeur, confirmé** (pour montrer les PCA/PRA à un auditeur, il faut lui ouvrir tout le Pilotage :
  moindre privilège impossible, sans écriture hors droits).
- Doublon : aucun.
- Test déterministe : oui, par l'API. Compte auditeur externe avec `modules: ["incidents"]` :
  `GET /api/grc/<racine>/objects?kind=continuity_plan` → attendu après correction 200 (ou libellé du module corrigé, test
  sur `MODULE_LABELS.incidents` sans « PCA/PRA ») ; observé 403 `pilotage:lire`.

### INV-08 en ÉCHEC sur la pile 5 — analyse

- Fait : `pilote invariants` (pile 5, 13/11/2026 vers 01:35) ; `pilote api GET "/api/dda?reference=A"` ;
  `pilote api GET "/api/grc/<racine>/objects?kind=nonconformity"` ; lecture de `tests/e2e/rssi-virtuel/invariants.ts:171-194`.
- Vu :
  - `ÉCHEC INV-08 … bloquant : « Action issue de l’incident INC-2026-001 : … » absent de la DdA` ; `ALERTE INV-06` (même
    écart sans responsable ni échéance, C5-21) ; INV-01 à INV-05 et INV-07 OK.
  - DdA A → 200, `"ecarts":[{"id":"INC-AC-01","type":"PP","status":"Ouvert","items":["A-5.27"], …}]`.
  - registre → 200, un seul écart : `id 2910ea00-…`, `legacyId "INC-AC-01"`, `refs ["legacy:items:A-5.27"]`,
    `status "open"`, non archivé.
  - la règle cherche l'écart de la DdA par `vusDda.get(e.id)` (identifiant de l'objet) sans regarder `legacyId` ; pour un
    écart né dans le registre historique (ici, créé depuis un incident), la DdA l'expose sous son `legacyId`.
- Verdict : **faux positif de l'invariant (outillage)** : même écart, même mesure A-5.27, même état ouvert des deux
  côtés. Correction à faire dans `tests/` (hors de ce passage) : apparier sur `e.legacyId ?? e.id` (ajouter `legacyId` au
  type de l'écart lu par `lireInstantane`). Aucun constat applicatif nouveau ; le double identifiant d'un même écart
  selon l'écran reste couvert par BUG-019.

### C6-04 — « Référentiel complémentaire actif » affiché vide ; le choisir désactive ReCyF (pile 6)

- Fait : `pilote api GET /api/settings/referentiels` ; `pilote ouvrir /plateforme/referentiels` ; `pilote ouvrir
  /pilotage/referentiels` ; puis `pilote cliquer combobox "Référentiel complémentaire actif"`, `pilote cliquer option
  "ReCyF"`, `pilote cliquer button "Enregistrer"`, relecture de l'API et de `/pilotage/referentiels` ; valeur d'origine
  remise par `PUT /api/settings/referentiels` avec `If-Match` (`r56-reglage.mjs`).
- Vu :
  - `GET /api/settings/referentiels` → 200, `"activeFw":"recyf-2.5"` ; fenêtre « Référentiels » : tableau `row "ReCyF 152"`,
    mais `combobox "Référentiel complémentaire actif"` **sans valeur** ; seule option `option "ReCyF"`.
  - `/pilotage/referentiels` avant : `paragraph: Actif dans le socle historique · 152 exigences`.
  - après le choix de « ReCyF » et « Enregistrer » : « Référentiels : enregistré. » ; API `"activeFw":"ReCyF"` (le nom au
    lieu de l'identifiant), version 8 ; `/pilotage/referentiels` : `paragraph: Conservé dans le socle historique · 152
    exigences` (ReCyF n'est plus actif).
  - remise : `PUT` → 200, `"activeFw":"recyf-2.5"`, version 9 ; `/pilotage/referentiels` de nouveau « Actif dans le socle
    historique ».
  - La réponse `info.complementaires` ne donne que `{"nom":"ReCyF","exigences":152}`, sans identifiant : l'écran ne peut
    proposer que le nom (`apps/web/src/pages/Settings.tsx`, `comp.map((c) => c.nom)`).
- Verdict : **reproduit**.
- Gravité : majeur → **bloquant** (donnée fausse à l'écran, le référentiel actif paraît non choisi, et l'enregistrement
  du formulaire tel qu'il s'affiche désactive silencieusement ReCyF pour tout le socle).
- Doublon : aucun.
- Test déterministe : oui. Par l'API : `GET /api/settings/referentiels` → `info.complementaires` doit contenir
  l'identifiant égal à `values.activeFw` (attendu après correction : un élément dont l'identifiant vaut `recyf-2.5` ;
  observé : `[{"nom":"ReCyF","exigences":152}]`). Par la page : `/plateforme/referentiels`,
  `getByRole('combobox', { name: 'Référentiel complémentaire actif' })` : attendu `toHaveValue('ReCyF')`, observé vide.

### C6-05 — Catégorie NIS 2 impossible à remettre à « Non renseignée » ; « enregistré » et journal d'audit inexacts (pile 6)

- Fait : `/plateforme/referentiels`, `pilote choisir "Catégorie d’entité (NIS 2)" "Non renseignée"`, `pilote cliquer
  button "Enregistrer"`, rechargement ; `pilote api GET /api/settings/referentiels` ; `pilote api GET
  "/api/admin/audit?limit=5"` ; second chemin : `PUT /api/settings/referentiels`
  `{"activeFw":"recyf-2.5","entityCategory":""}` avec `If-Match` (`r56-reglage.mjs`).
- Vu :
  - écran : `combobox "Catégorie d’entité (NIS 2)": Non renseignée`, puis « Alertes : Référentiels : enregistré. » ; après
    rechargement `combobox "Catégorie d’entité (NIS 2)": Entité importante`.
  - API → 200, `"entityCategory":"importante"`, version passée de 9 à **10** (une version de l'état créée sans
    changement).
  - journal : `rssi settings.update referentiels {"after": {"activeFw": "recyf-2.5", "entityCategory": ""}, "before":
    {"activeFw": "recyf-2.5", "entityCategory": "importante"}, "version": 10}` : trace un changement qui n'a pas eu lieu.
  - second chemin : `PUT` → **200**, et la réponse elle-même renvoie `"entityCategory":"importante"` (version 11).
  - Cause lue : `apps/api/src/settings.ts:205-208` supprime la clé de l'état quand la valeur est vide (`delete data[k]`)
    puis `nativeWrite` ; la valeur précédente revient à la recomposition, et `after` (journalisé) est la saisie, pas
    l'état relu.
- Verdict : **reproduit** (la catégorie reste « Entité importante » sur la pile 6, comme en phase 1 : c'est le défaut).
- Gravité : majeur → **bloquant** (le journal d'audit, preuve A.8.15, consigne une modification inexistante, et l'écran
  confirme un enregistrement qui n'a pas eu lieu : donnée fausse).
- Doublon : aucun. Voisin de C6-15 (réglage enregistré différent de ce qui est affiché, sans message).
- Test déterministe : oui, par l'API. `PUT /api/settings/referentiels` `{"entityCategory":"importante",…}` puis
  `{"entityCategory":"",…}` (en-tête `If-Match` = version lue) ; `GET /api/settings/referentiels` : attendu après
  correction `entityCategory === ""` (ou 422 au second `PUT`) ; observé `"importante"` avec 200. Puis
  `GET /api/admin/audit` : la dernière entrée `settings.update` doit porter un `after` égal à la valeur relue.

### C6-12 — Revue des accès sans les accès aux périmètres (pile 6)

- Fait : `pilote api GET "/api/grc/<HDS-6>/members"` (`<HDS-6>` = `b657ff37-f2ac-469e-81db-50a7a7bbeb7c`, visibilité
  `restricted`) ; `pilote api GET "/api/admin/access-review?format=csv"` (même route que les boutons « CSV » et « Excel »
  de Plateforme › Utilisateurs) ; `pilote ouvrir /plateforme/utilisateurs` ; fenêtre « Droits effectifs » de
  `pilote.infra` ouverte par un script relié au Chrome (`r56-droits.mjs`, boutons homonymes).
- Vu :
  - membres d'Hébergement HDS → 200 : `pilote.infra` (écriture), `rssi` (écriture), `test7-auditeur` (lecture),
    `test7-lecteur` (lecture), `test7-restreint` (écriture).
  - export de revue des accès → 200, colonnes `"Identifiant";"Nom";"E-mail";"État";"Double authentification";"Groupes";
    "Rôles (directs et [groupe])";"Droits effectifs";"Dernière connexion";"Expiration"` : aucune colonne de périmètre ;
    les lignes de `pilote.infra` et `test7-restreint` ne disent pas qu'ils écrivent dans HDS (la seule occurrence de
    « HDS » est dans le nom affiché de `test7-restreint`).
  - liste des comptes : `row "Compte Rôles État Actions"`, rien sur les périmètres.
  - « Droits effectifs de pilote.infra » : 13 lignes de modules (`Audit (référentiels et couverture)` … `Tableau de bord
    de l’accueil`), **0** mention de périmètre, d'Hébergement ou de HDS.
- Verdict : **reproduit**.
- Gravité : majeur → **majeur, confirmé** (la revue des accès A.5.18 se reconstitue à la main périmètre par périmètre
  depuis Périmètres › Accès ; pas de donnée fausse, mais un document de revue incomplet).
- Doublon : lié à T5-01 / T6-02 (accès par périmètre) sans être le même défaut ; aucun dans BUG-016 à BUG-037.
- Test déterministe : oui, par l'API. Compte membre en écriture d'un périmètre restreint : `GET
  /api/admin/access-review?format=csv` → attendu après correction une colonne de périmètres dont la valeur, sur la ligne
  du compte, contient le nom du périmètre et le niveau (lecture ou écriture) ; observé : 10 colonnes, aucune de
  périmètre.

### C6-15 — Valeurs numériques corrigées en silence, parfois différentes de ce qui est affiché (pile 6)

- Fait : `pilote ouvrir /systeme/securite`, `pilote remplir "Échecs avant verrouillage du compte" 0`, `pilote cliquer
  button "Enregistrer"`, `pilote api GET /api/settings/securite` ; `pilote ouvrir /plateforme/notifications`, `pilote
  remplir "Alerte avant une échéance (jours)" 99999`, Enregistrer, relecture API. Second chemin : mêmes valeurs envoyées
  directement par `PUT /api/settings/<section>` avec `If-Match` (`r56-reglage.mjs`). Valeurs d'origine remises
  (`lockoutThreshold 5`, `echeancesJours 30`, relues).
- Vu :
  - Sécurité : avant le clic `textbox "Échecs avant verrouillage du compte": "0"` ; après « Alertes : Sécurité :
    enregistré. », le champ affiche `"3"` ; API `"lockoutThreshold":3`. Aucun message sur la correction.
  - Notifications : `"99999"` au clic, puis « Notifications : enregistré. » et `"365"` ; API `"echeancesJours":365`.
  - Par l'API, le serveur **refuse** : `PUT /api/settings/securite` avec `lockoutThreshold:0` et `passwordMinLength:8` →
    **422** « passwordMinLength : Au moins 12 caractères. ; lockoutThreshold : Trop petit : nombre doit être >=3 » ;
    `PUT /api/settings/notifications` avec `echeancesJours:99999` → **422** « Trop grand : nombre doit être <=365 ».
  - Cause lue : `apps/web/src/pages/Settings.tsx:217-243`, composant `Num` = `NumberInput` Mantine avec `min`/`max` :
    la valeur est ramenée dans les bornes à la sortie du champ, avant l'envoi, sans message.
- Verdict : **reproduit en partie** : la correction silencieuse est reproduite sur deux écrans ; en revanche, après
  l'enregistrement, le champ affiche la valeur réellement enregistrée (3, 365) : je n'ai pas revu d'écart durable entre
  l'écran et la donnée. Le serveur, lui, contrôle correctement.
- Gravité : majeur → **mineur** (aucune donnée fausse ni étape impossible : la valeur retenue est la borne, visible après
  l'enregistrement ; il manque le message qui désigne le champ et la borne).
- Doublon : même famille que C6-01 (messages de refus) et C5-26 (durée d'écran mural 400 ramenée à 365 sans message).
- Test déterministe : oui, par la page. `/systeme/securite`, `getByRole('textbox', { name: 'Échecs avant verrouillage
  du compte' }).fill('0')`, clic `button "Enregistrer"` (le premier de la fenêtre) : attendu après correction un message
  d'erreur lié au champ (`aria-invalid="true"` ou texte « au moins 3 ») et aucune écriture (`GET /api/settings/securite`
  inchangé) ; observé « Sécurité : enregistré. » et `lockoutThreshold: 3`.

### C6-20 — Exécutant d'exploitation indisponible sur la pile Docker (pile 6)

- Fait : `pilote api GET /api/admin/sauvegardes` (piles 6 et 5) ; `pilote ouvrir /systeme/sauvegardes` ; `pilote api GET
  /api/updates` ; inspection en lecture seule de la pile : `docker compose -p suivi-rssi-virtuel-6 … ps`, `docker inspect`
  du conteneur `updater` (montages), fichier de surcharge `/srv/suivi-rssi-virtuel-6/compose.rssi-virtuel.yml`, puis, dans
  le conteneur `updater`, `cd /home/user/suivi-audits && docker compose ps -a`, `docker compose ls`,
  `docker compose exec -T app true`. Lecture de `scripts/update-worker.py` (boucle et `exploitation()`).
- Vu :
  - `GET /api/admin/sauvegardes` → 200 `{"worker":{"available":false,"seenAt":null,"message":"Exécutant serveur non
    configuré."},"jobs":[]}` sur la pile 6 **et** sur la pile 5 : la table `backup_worker` n'a jamais reçu de signal.
  - écran : `region "Clé de secours des sauvegardes"` → `text: En attente de l’exécutant`, « Clé se terminant par …,
    définie le 12/11/2026 20:00 par rssi » (la clé de secours est donc **déjà définie** depuis l'installation) ;
    `alert "Exécutant serveur indisponible"` ; `button "Demander une sauvegarde" [disabled]`. Le message attendu par la
    consigne (« Clé de secours des sauvegardes non définie… ») n'apparaît pas sur la pile 6.
  - conteneur `updater` : `running`, 0 redémarrage depuis 23:39 UTC, montage `/srv/suivi-rssi-virtuel-6/.env ->
    /home/user/suivi-audits/.env` présent (correctif de l'outillage `2171449` appliqué) ; `GET /api/updates` → 200,
    `"ready":true` (le démon tourne).
  - mais, dans le conteneur, `docker compose` lancé dans le dépôt résout le projet `suivi-audits`, qui n'existe pas :
    `docker compose ps -a` vide, `docker compose ls` liste `suivi-rssi-virtuel-1` à `-6`, et
    `docker compose exec -T app true` → « service "app" is not running », code 1. Or l'exécutant appelle
    `docker compose exec -T app …` (`update-worker.py:160-161`) et `scripts/exploitation-worker.py` depuis le dépôt ;
    l'échec est avalé (`contextlib.suppress(Failure, OSError)`, ligne 557-560), d'où aucun signal.
- Verdict : **outillage**. Les piles de recette sont lancées avec `-p suivi-rssi-virtuel-N` et un fichier de surcharge,
  mais l'exécutant, lui, appelle `docker compose` sans nom de projet ni fichiers : il ne trouve pas l'application de sa
  pile. Une installation standard (projet = nom du dossier du dépôt) n'a pas cet écart. Le correctif du `.env` ne suffit
  pas : il faut aussi donner à `updater` `COMPOSE_PROJECT_NAME=suivi-rssi-virtuel-N` et `COMPOSE_FILE` (dépôt +
  surcharge), et une pile par copie du dépôt si plusieurs piles partagent le même dossier. Je n'ai donc **pas pu** définir
  la clé, demander une sauvegarde ni vérifier qu'elle est listée : la chaîne de sauvegarde reste **non vérifiée** par
  la campagne.
- Gravité : majeur → **sans objet pour l'application** (outillage) ; à rejouer sur une pile corrigée. Remarque applicative
  mineure possible, non retenue ici : l'exécutant ne signale nulle part la cause de son échec (« non configuré »).
- Doublon : aucun.
- Test déterministe : sans objet tant que l'outillage n'est pas corrigé ; ensuite, `GET /api/admin/sauvegardes` une
  minute après le démarrage d'une pile neuve → attendu `worker.available: true`.

### C6-21 — Date du dernier test de restauration dans le futur acceptée : l'alerte disparaît (pile 6)

- Fait : `pilote api GET /api/settings/sauvegardes` (valeurs d'origine) ; `pilote ouvrir /systeme/sauvegardes`,
  `pilote remplir "Date du dernier test de restauration" 2027-12-01`, `pilote cliquer button "Enregistrer"`, relecture de
  l'écran et de l'API ; second chemin : `PUT /api/settings/sauvegardes` avec `dernierTestRestauration:"2099-01-01"` et
  `If-Match` (`r56-reglage.mjs`) ; valeur d'origine (`""`) remise par le même moyen, relue (`"enRetard":true`).
- Vu :
  - avant : `"dernierTestRestauration":"","info":{"prochainTest":"","enRetard":true}` et `alert "Test de restauration à
    faire"` à l'écran.
  - après l'écran : « Sauvegardes : enregistré. », API `"dernierTestRestauration":"2027-12-01"`,
    `"info":{"prochainTest":"2028-12-01","enRetard":false}` ; l'alerte « Test de restauration à faire » n'est plus dans
    l'arbre (0 occurrence).
  - par l'API : `2099-01-01` → **200**, `"prochainTest":"2100-01-01","enRetard":false`.
- Verdict : **reproduit** (le constat d'origine citait `prochainTest 2028-01-01` ; ici 2028-12-01 avec une fréquence de
  12 mois, même défaut).
- Gravité : majeur → **majeur, confirmé** (une saisie erronée efface l'alerte A.8.13 sans contrôle ; aucune donnée n'est
  fabriquée par l'application).
- Doublon : même famille que C5-02 et C5-10 (dates futures ou incohérentes acceptées), sur un réglage plus sensible.
- Test déterministe : oui, par l'API. `PUT /api/settings/sauvegardes` (`If-Match` = version lue)
  `{"emplacement":"/srv/sauvegardes/suivi-audits","dernierTestRestauration":"<aujourd'hui + 1 an>","frequenceTestMois":12}`
  → attendu après correction **422** ; observé 200 et `info.enRetard:false`. Remettre `""` en fin de test.

### C6-22 — Versions de l'état toutes vides : télécharger ou restaurer une version ne rend rien (piles 6 et 5)

- Fait : `pilote api GET /api/admin/versions`, `GET /api/admin/versions/1`, `/7`, `/11` (pile 6) ; `pilote ouvrir
  /systeme/mises-a-jour` (zone des versions) ; second chemin sur la pile 5 : `GET /api/admin/versions`, puis
  `GET /api/admin/versions/152` comparé à `GET /api/incidents` (même version 152). Lecture de
  `apps/api/src/legacy/store.ts:121-190` et `apps/api/src/routes/admin.ts:315-385`. Aucune restauration lancée.
- Vu :
  - pile 6 : 11 versions, chacune `"bytes":5,"items":0`, même empreinte `44136fa355b3…` ; `GET /api/admin/versions/1`,
    `/7`, `/11` → 200 `{}`. Écran : `region "Versions de l’application"`, `row "v11 13/11/2026 00:30 rssi Paramètres :
    referentiels 0 mesures Télécharger Restaurer"` (v8 à v11 créées par mes essais de C6-04 et C6-05 : même la valeur
    `activeFw` n'y figure pas).
  - pile 5 : 12 versions, une seule taille (5 octets), une seule empreinte ; `GET /api/admin/versions/152` → 200 `{}`
    alors que `GET /api/incidents` → `{"version":152,"incidents":[{"id":"INC-2026-001",…` : la version 152 ne contient
    pas l'état qu'elle date.
  - Cause lue : `LegacyStore.save()` retire de l'objet tous les modules repris dans des tables (`for (const m of
    this.mappers.values()) delete obj[m.key]`) puis écrit ce reste dans `state_history` ; tous les modules étant repris,
    il reste `{}`. `POST /api/admin/versions/:v/restore` réécrirait ce `{}` par `nativeWrite` (effet non essayé).
- Verdict : **reproduit**, défaut **propre**, sans lien avec C6-20 : les versions sont écrites par l'application dans la
  base, l'exécutant d'exploitation n'y intervient pas (vu aussi sur la pile 5).
- Gravité : majeur → **majeur, confirmé** (fonction de retour arrière inopérante présentée comme disponible ; je ne la
  monte pas faute d'avoir mesuré l'effet d'une restauration).
- Doublon : aucun.
- Test déterministe : oui, par l'API. Après une écriture de l'état (par exemple `POST /api/incidents`), `GET
  /api/admin/versions` puis `GET /api/admin/versions/<dernière>` : attendu après correction un JSON qui contient
  l'incident créé (ou la version absente de la liste) ; observé `{}` et `bytes: 5`.

## Nettoyage et écritures du rejeu

- Pile 5 : exercice « rejeu exercice réalisé (fictif) » créé puis archivé (API) ; scénario « rejeu scénario (fictif) »
  créé puis supprimé (écran) ; incident « rejeu » INC-2026-004 créé, événements RETEX ajoutés puis retirés (dont par
  `test7-contrib`, T5-02), incident supprimé (écran) : la référence INC-2026-004 sera réattribuée (C5-09) ; cellule
  « rejeu crise réelle (fictive) » ouverte puis clôturée, elle reste dans « Cellules précédentes » (aucune suppression
  possible) ; modules de `test7-auditeur` ramenés à deux puis rétablis à trois. Données des phases 1 et 2 non modifiées.
- Pile 6 : `activeFw` passé à « ReCyF » puis remis à `recyf-2.5` ; catégorie NIS 2 toujours « Entité importante » (le
  défaut C6-05 empêche de la vider) ; `lockoutThreshold` passé à 3 puis remis à 5 ; `echeancesJours` passé à 365 puis
  remis à 30 ; date du dernier test de restauration remise à vide. Ces essais ont ajouté les versions v8 à v11 de l'état
  (vides, C6-22) et des entrées `settings.update` au journal d'audit. Aucune sauvegarde, restauration, mise à jour, remise
  à vide, ni changement d'adresse, de poivre ou de clé de secours.
- Scripts (bloc-notes, hors dépôt) : `r56-lib.mjs`, `r56-c503.mjs`, `r56-c506.mjs`, `r56-export.mjs`, `r56-xlsx.py`,
  `r56-t502.mjs`, `r56-switch.mjs`, `r56-t503.mjs`, `r56-reglage.mjs`, `r56-droits.mjs`. Aucun secret recopié ici.

## Outillage relevé pendant le rejeu

- C6-20 : l'exécutant `updater` des piles de recette appelle `docker compose` sans `-p` ni fichiers de surcharge ;
  depuis le dossier du dépôt il vise le projet `suivi-audits`, absent. Même situation sur la pile 5. À corriger dans
  `lancer.sh` (`COMPOSE_PROJECT_NAME`, `COMPOSE_FILE` dans l'environnement d'`updater`), puis rejouer C6-20.
- INV-08 : apparier les écarts sur `legacyId ?? id`.
- `pilote.mjs cliquer` ne sait pas viser un bouton homonyme dans une ligne (« Droits effectifs », « Ouvrir ») : scripts
  reliés au Chrome nécessaires.
