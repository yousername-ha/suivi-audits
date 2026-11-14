# Rejeu de la phase 3 : piles 3 et 4

| Élément | Valeur |
|---|---|
| Code de l’application testé | `2e63e86` (branche `claude/recette-rssi-2026-11-12`, à `e61b008` au moment du rejeu : aucune différence dans `apps/` ni `packages/` depuis `2e63e86`) |
| Date | 13/11/2026, à partir de 01:16 (Europe/Paris) |
| Piles | n° 3 `https://127.0.0.13` et n° 4 `https://127.0.0.14`, remplies par les phases 1 et 2 ; `GET /api/version` : `local`, migration `054_retrait_revues_acces.sql` |
| Comptes | `rssi` (Administrateur) et comptes `test7-*` de la phase 2 (secrets dans `.pilote-N/comptes.json`, ignoré par Git ; aucun secret ici) |
| Méthode | écran d’abord (pilote, arbre d’accessibilité), API pour confirmer ; sessions des autres comptes dans des contextes séparés du même Chrome (scripts `r34-*` du bloc-notes, hors dépôt) ; objets créés pour le rejeu préfixés « rejeu » |

## Synthèse

| Constat | Verdict | Gravité proposée → retenue | Doublon de | Test déterministe (oui/non) |
|---|---|---|---|---|
| C3-01 | reproduit | majeur → majeur | même cause que C4-02 et BUG-037 | oui |
| C3-02 | reproduit | majeur → majeur | famille de BUG-036 ; lié à C3-05 | oui |
| C3-03 | reproduit | majeur → majeur | aucun (lien avec C4-04 pour le sous-périmètre) | oui |
| C3-04 | reproduit | majeur → majeur | même cause que BUG-016, même indicateur que BUG-017 | oui |
| C3-05 | reproduit | majeur → **bloquant** | prolonge RSSI-13 (BUG-017) | oui |
| C3-06 | reproduit | majeur → **bloquant** | famille de BUG-026 ; même défaut de traçabilité que C4-04 | oui |
| C4-02 | reproduit | majeur → majeur | même cause que C3-01 et BUG-037 | oui |
| C4-04 | reproduit en partie | majeur → majeur | même défaut de traçabilité que C3-06 | oui |
| C4-05 | reproduit | majeur → **bloquant** | famille de BUG-037 (fonction réservée à la racine) | oui |
| T3-01 | reproduit (partie vérifiée : écriture DdA) | bloquant → non arbitré ici (piles 1 et 2) | **T4-01** (même défaut) | oui |
| T3-03 | reproduit | majeur → majeur | famille de T3-04 | oui |
| T4-01 | reproduit (même vérification que T3-01) | majeur → non arbitré ici (piles 1 et 2) | **T3-01** (même défaut) | oui |
| T4-02 | reproduit | bloquant → bloquant | aucun | oui |
| T4-03 | reproduit | majeur → majeur | aggrave C4-06 | oui |

Bilan : 13 reproduits (dont T3-01 et T4-01 sur la seule partie demandée), 1 reproduit en partie (C4-04), 0 non reproduit,
0 outillage. Gravités montées : C3-05, C3-06, C4-05 (majeur → bloquant). Aucune baissée.

Regroupements proposés pour le registre :

- **Registres historiques sans périmètre derrière un sélecteur de périmètre** : C3-01 (DdA, plan d’audit, GAP), C4-02
  (plans annuels), BUG-037 (processus). C4-05 (revue préparée seulement à la racine) relève de la même limite « racine
  seulement ».
- **Applicabilité et traçabilité de la DdA** : C3-02 (couverture qui ignore la DdA), C3-05 (fiche projetée qui écrit la DdA),
  C3-06 et C4-04 (rattachement mesure ↔ écart : références `legacy:items:*` limitées à la racine, références
  `requirement:*` ignorées par la DdA), avec BUG-026 et BUG-036.
- **Règles de saisie de la DdA** : C3-04 avec BUG-016 (aucune règle entre `app`, `level`, `just`).
- **Droits** : T3-01 = T4-01 ; T4-02 et T4-03 sont deux défauts distincts (archivage de registre, revue validée).

## C3-01 — Sélecteur « Périmètre affiché » sans effet (DdA, plan d’audit, applications à intégrer)

Pile 3, compte `rssi`. Principal `00000000-0000-4000-8000-000000000001`, « Hébergement HDS » `f4a66f66-c28f-4c01-ac64-69106b78c4ec`.

- Fait : `ouvrir /pilotage/dda-annexe-a?perimetre=<HDS>` ; `voir main` ; `choisir "Applicabilité de A.6.7" "Oui"` ;
  `ouvrir /pilotage/dda-annexe-a?perimetre=<principal>` ; `voir main` ; contrôle `api GET /api/dda?reference=A` et
  `api GET /api/admin/audit?q=dda&limit=2` ; remise en état `api PATCH /api/dda/A-6.7 {"app":"","level":""}` (HTTP 200,
  A-6.7 de nouveau vide). Second chemin : `/pilotage/audit-participants` et `/pilotage/gap-applications` sous les deux
  périmètres.
- Vu : sous HDS, `combobox "Périmètre affiché": Hébergement HDS`, bandeau `3 %`, `row "A.5.1 Politiques de sécurité de
  l'information Oui Total"`, `row "A.8.30 Développement externalisé Non Exclue Aucun développement externalisé dans le
  périmètre (décision de la revue de direction fictive)"` : identiques au principal. Après le choix fait sous HDS, sous le
  principal : `row "A.6.7 Travail à distance Oui"` ; API `A-6.7 {'app': 'oui'}` ; journal `{"action":"dda.updated",
  "target":"legacy:dda:A-6.7","details":{"version":56}}` (aucun périmètre). Plan d’audit : sous les deux périmètres, la même
  ligne `row "Pilote du processus infrastructure (fictif) … Jour 1 11h00, Sauvegardes et restauration (A.8.13) 1 h 00
  Retirer"`. Applications à intégrer : la même ligne `row "Plateforme de téléexpertise (fictive) … 0/32 conformes, 31 à
  évaluer 1 31/01/2027"` sous les deux. Côté API, `GET /api/dda`, `/api/audit-suivi/*` et `/api/gap*` n’ont aucun paramètre
  de périmètre (`apps/api/src/routes/historique/audit.ts`, `modules-annexes.ts`) : ce sont des registres historiques
  uniques de l’organisation. Remarque : en changeant de périmètre par le sélecteur, l’URL reste
  `?perimetre=<principal>` alors que la liste affiche « Hébergement HDS ».
- Verdict : **reproduit**.
- Gravité : majeur, **confirmée** : l’écran ne fausse pas une donnée (la DdA est bien celle de l’organisation), mais le RSSI
  ne peut pas tenir une DdA ou un plan d’audit propre au périmètre HDS, et une saisie faite « sous HDS » modifie la DdA du
  groupement ; elle monte à bloquant si l’on combine avec T3-01 (compte limité qui écrit la DdA commune).
- Doublons : même cause que C4-02 (plans annuels) et BUG-037 (processus) : registres historiques sans périmètre derrière un
  sélecteur de périmètre. À regrouper en un défaut « registres historiques sans périmètre » avec trois manifestations.
- Test déterministe : **oui** (page, sans parcours long). Sur une pile avec un sous-périmètre S :
  1. `page.goto('/pilotage/dda-annexe-a?perimetre=<S>')`, choisir l’option « Oui » de `combobox "Applicabilité de A.6.7"` ;
  2. `page.goto('/pilotage/dda-annexe-a?perimetre=<racine>')` ;
  3. attendu après correction : `row` dont le nom commence par « A.6.7 Travail à distance » sans « Oui » (ou, si la donnée
     est déclarée commune, aucun `combobox "Périmètre affiché"` sur la page) ; observé : `row "A.6.7 Travail à distance Oui"`.
  Variante API : `GET /api/dda?reference=A` ne prend pas de périmètre et rend la même DdA quel que soit le périmètre choisi.

## C3-02 — Trois registres d’applicabilité qui s’ignorent (DdA, « Applicabilité et justifications », « Couverture par référentiel »)

Pile 3, compte `rssi`.

- Fait : `ouvrir /pilotage/couverture?perimetre=<principal>`, `choisir "Détail par exigence" "ISO/IEC 27001:2022 (PRIVE -
  SMSI Groupement Santé Fictif)"`, `voir main` ; même chose sous `?perimetre=<HDS>` ; `ouvrir
  /pilotage/applicabilite?perimetre=<HDS>`, `cliquer button "Ouvrir"` ; `ouvrir /pilotage/dda-annexe-a?perimetre=<HDS>` ;
  contrôle `GET /api/dda?reference=A` et `GET /api/grc/<principal>/couverture?frameworkId=<copie ISO>`.
- Vu, principal : la DdA porte A-5.15 `oui/Partiel`, A-5.24 `oui/Total`, A-7.4 `oui/Insuffisant`, A-8.13 `oui/Total`
  (`GET /api/dda?reference=A`, HTTP 200). La Couverture affiche `alert "91 exigence(s) à déterminer…"` et
  `row "A-8.13 · 8.13 — Sauvegarde des informations À déterminer : à revoir Non implémenté Sauvegarde chiffrée quotidienne
  des données hébergées (fictive) — Évaluer l’exigence A-8.13"` (idem A-5.15, A-5.24, A-7.4) ; `row "ISO-4.3 · 4.3 — …
  Applicable (obligatoire) Clause pas encore conforme Non implémenté"`. API : `detail[id="A-8.13"]` →
  `"evaluation": null, "etat": "non_implemente"`. Seules A-5.1 et A-8.30, ressaisies dans la Couverture en phase 1, y
  sont tranchées (« Testé 1 · Non applicable 1 »). La page DdA annonce pourtant « Le niveau de mise en œuvre de la DdA
  alimente la couverture présumée des autres référentiels. »
- Vu, sous-périmètre HDS : `paragraph: 1 fiches`, fiche « A-8.30 — Développement externalisé (Hébergement HDS) »,
  `checkbox "Applicable"` non coché, `textbox "Justification de l’applicabilité": Aucun développement externalisé pour les
  activités d’hébergement (fictif)`. La DdA sous HDS affiche la justification du principal (`row "A.8.30 Développement
  externalisé Non Exclue Aucun développement externalisé dans le périmètre (décision de la revue de direction fictive)"`) ;
  la Couverture sous HDS : `row "A-8.30 · 8.30 — Développement externalisé À déterminer : à revoir Non implémenté"` et
  « Non applicable 0 » pour la copie ISO.
- Verdict : **reproduit**.
- Gravité : majeur, **confirmée** : la DdA de référence (6.1.3 d) reste juste ; c’est la couverture qui contredit la DdA
  et oblige à une double saisie (contournement), sans fausser la DdA elle-même.
- Doublons : même famille que BUG-036 (le Parcours ISO ne voit pas la DdA renseignée) et C3-05 (la fiche d’applicabilité
  du principal est une projection de la DdA qui y réécrit). Distinct de BUG-017 (taux de la DdA elle-même).
- Test déterministe : **oui**. API : `PATCH /api/dda/A-8.13 {"app":"oui","level":"Total"}` (rssi), puis
  `GET /api/grc/<racine>/couverture?frameworkId=<copie ISO appliquée>` ; attendu après correction :
  `detail.find(d => d.id === 'A-8.13').etat !== 'non_implemente'` et l’exigence non comptée dans `etats.aDeterminer` ;
  observé : `evaluation: null`, `etat: "non_implemente"`. Page : `/pilotage/couverture`, `combobox "Détail par exigence"`
  → la `row` « A-8.13 · 8.13 — Sauvegarde des informations » contient « À déterminer : à revoir ». Prérequis : ISO/IEC
  27001:2022 ajouté, attribué et appliqué au périmètre racine (`POST /api/library/standards/adopt` puis application).

## C3-03 — « Référentiels et exigences » et « Correspondances entre exigences » ignorent les référentiels attribués et appliqués

Pile 3, compte `rssi`.

- Fait : `ouvrir /pilotage/referentiels?perimetre=<principal|HDS>`, `cliquer combobox "Référentiel publié"` ;
  `ouvrir /pilotage/correspondances?perimetre=<principal|HDS>`, `cliquer combobox "Référentiel source"` ; contrôle
  `GET /api/grc/<périmètre>/objects?kind=framework`, `GET /api/admin/audit?q=referentiel`, `GET /api/grc/smsis`.
- Vu : ISO/IEC 27001:2022 et HDS v2 sont appliqués au principal (journal : deux `grc.referentiel.applique` par `rssi` le
  12/11 à 20:07 ; la Couverture les suit sous les noms « ISO/IEC 27001:2022 (PRIVE - SMSI Groupement Santé Fictif) » et
  « Référentiel HDS v2 (PRIVE - SMSI Groupement Santé Fictif) »). Principal : `listbox "Référentiel publié"` →
  seulement `option "Exigences contractuelles des clients hébergés (fictif)"` (le référentiel créé à la main en phase 1) ;
  `listbox "Référentiel source"` → la même option seule. Sous HDS (`inheritFrameworks: true`) : aucune option du tout,
  seule l’alerte « Activez les référentiels correspondant au périmètre… ». API : principal `objects?kind=framework` →
  `total 1` (le référentiel fictif), HDS → `total 0`.
- Verdict : **reproduit**.
- Gravité : majeur, **confirmée** : une correspondance ISO ↔ HDS ne peut pas être saisie sur l’écran prévu ; le seul
  contournement est « Correspondances de la bibliothèque ».
- Doublons : aucun dans BUG-016 à BUG-037. Même cause probable que C4-04 (le sous-périmètre ne voit pas les exigences
  héritées) pour la partie « sous HDS ».
- Test déterministe : **oui** (page). Prérequis : ISO/IEC 27001:2022 ajouté à la bibliothèque, attribué et appliqué à la
  racine. `page.goto('/pilotage/referentiels')`, ouvrir `combobox "Référentiel publié"` ; attendu après correction : une
  `option` dont le nom contient « ISO/IEC 27001:2022 » ; observé : aucune (liste vide sur une pile sans référentiel créé à
  la main). Même assertion sur `/pilotage/correspondances`, `combobox "Référentiel source"`. API d’appui :
  `GET /api/grc/<racine>/objects?kind=framework` → `{"total":0,…}` alors que la copie ISO est appliquée.

## C3-04 — Niveau de mise en œuvre accepté sur une mesure non examinée et compté « Total »

Pile 3, compte `rssi`. Mesure A-6.7, vide avant l’essai (`app: ''`, `level: ''`).

- Fait : `ouvrir /pilotage/dda-annexe-a?perimetre=<principal>` ; `choisir "Niveau de A.6.7" "Total"` sans toucher
  « Applicabilité de A.6.7 » ; `voir main` ; filtres par `cliquer-texte "Non renseignées"` puis `cliquer-texte "Total"`
  (`cliquer radio …` expire : bouton radio masqué du contrôle segmenté) ; contrôle `GET /api/dda?reference=A` ; remise en
  état `PATCH /api/dda/A-6.7 {"app":"","level":""}` (HTTP 200, A-6.7 vide de nouveau). Second chemin : même écriture par
  `PATCH /api/dda/A-6.7 {"level":"Total"}` → HTTP 200 `{"app":"","level":"Total",…}`.
- Vu : aucune alerte ; bandeau `3 %` → `4 %` ; `row "A.6.7 Travail à distance Total"` (colonne Applicable vide) ; filtre
  « Total » : `paragraph: 4 mesures` dont `row "A.6.7 Travail à distance Total"` ; filtre « Non renseignées » :
  `paragraph: 86 mesures`, A.6.7 absente. API : `A-6.7 {'app': '', 'level': 'Total'}`.
- Verdict : **reproduit**.
- Gravité : majeur, **confirmée** (et non montée) : l’indicateur devient faux, mais seulement après une saisie incohérente
  que l’écran devrait refuser ; la DdA garde son applicabilité vide, visible à la lecture de la ligne.
- Doublons : même cause que BUG-016 (`DdaModification`, `packages/shared/src/suivi-dda.ts`, sans règle entre `app`,
  `level` et `just`) et même indicateur que BUG-017 (`statsDda` compte une mesure non examinée). Manifestation distincte à
  garder sous BUG-016 ou BUG-017 plutôt qu’en défaut séparé.
- Test déterministe : **oui** (API). `PATCH /api/dda/A-6.7` corps `{"level":"Total"}` sur une mesure sans applicabilité ;
  attendu après correction : HTTP 422 (message qui nomme « Applicabilité »), ou HTTP 200 avec `level` resté vide ;
  observé : HTTP 200, `{"id":"A-6.7","dda":{"app":"","level":"Total",…}}`. Règle d’invariant à ajouter : aucune entrée de
  `dda` avec `level` non vide et `app` vide. Page : après l’écriture, `cliquer-texte "Non renseignées"` → la `row` « A.6.7
  Travail à distance » doit rester listée (observé : absente, 86 mesures).

## C3-05 — Enregistrer une fiche d’applicabilité sans rien changer déclare la mesure « Applicable »

Pile 3, compte `rssi`. Mesure A-5.2, non examinée avant l’essai (`GET /api/dda?reference=A` : `app: ''`, tous champs vides).

- Fait : `ouvrir /pilotage/applicabilite?perimetre=<principal>` ; bouton « Ouvrir » de la ligne « A-5.2 — Fonctions et
  responsabilités… » (homonymes : script `r34-clic-ligne.mjs`, clic dans la `row` par son texte) ; `voir` ;
  `cliquer button "Enregistrer"` sans rien modifier ; contrôle `GET /api/dda?reference=A`,
  `GET /api/admin/audit?limit=3` ; `ouvrir /pilotage/dda-annexe-a` ; remise en état `PATCH /api/dda/A-5.2
  {"app":"","level":""}` (HTTP 200, A-5.2 de nouveau vide).
- Vu : `dialog "Fiche — Déclaration d’applicabilité"` avec `checkbox "Applicable" [checked]` et `textbox "Justification de
  l’applicabilité"` vide pour une mesure jamais examinée. Après « Enregistrer » : fenêtre fermée, `Alertes : aucune`
  (aucun message). API : `A-5.2 {'app': 'oui'}` ; journal `rssi pilotage.legacy.updated legacy:dda:A-5.2 {'note':
  'Modification de la fiche historique', 'version': 62}`. DdA annexe A : `row "A.5.2 Fonctions et responsabilités liées à
  la sécurité de l'information Oui"`.
- Verdict : **reproduit**.
- Gravité : majeur → **bloquant** : l’outil écrit dans la DdA une décision d’applicabilité que personne n’a prise et
  l’attribue au RSSI dans le journal ; c’est une donnée fausse de la DdA (6.1.3 d), relevable en audit.
- Doublons : prolonge RSSI-13, rattaché à BUG-017 (case « Applicable » cochée pour une mesure non examinée) : même
  cause d’affichage, conséquence nouvelle (écriture). Même famille que C3-02 (la fiche du principal est une projection de
  la DdA historique, écrite par `PUT /api/grc/:smsi/pilotage/legacy/dda/:id`).
- Test déterministe : **oui** (page courte). Mesure A-5.2 non examinée ; `page.goto('/pilotage/applicabilite')` ;
  `getByRole('row').filter({ hasText: 'A-5.2 — Fonctions' }).getByRole('button', { name: 'Ouvrir', exact: true })` ;
  attendu après correction : `checkbox "Applicable"` non coché (ou état « non examinée ») et, après
  `button "Enregistrer"`, `GET /api/dda?reference=A` → `dda["A-5.2"].app === ''` ; observé : case cochée, puis
  `app: "oui"`.

## C3-06 — Écart rattaché à l’exigence du référentiel (« A-5.24 · 5.24 — … ») ignoré par la DdA

Pile 3, compte `rssi`. Rejoué sur un écart propre au rejeu et une autre mesure (A.5.24, « Oui Total », sans écart) pour ne
pas toucher l’écart de la phase 1.

- Fait : `ouvrir /pilotage/amelioration?perimetre=<principal>` ; `cliquer button "Ajouter un constat"` ;
  `remplir "Intitulé" "rejeu C3-06 : plan de reprise non testé (fictif)"` ; `choisir "Classification" "Non-conformité
  mineure"` ; `cliquer tab "Liens et justificatifs"` ; `remplir "Rechercher une référence" "5.24"` ; `cliquer option "A-5.24
  · 5.24 — Planification et préparation de la gestion des incidents de sécurité de l'information"` ; `cliquer button
  "Enregistrer"` ; `ouvrir /pilotage/dda-annexe-a` ; contrôle `GET /api/grc/<principal>/objects?kind=nonconformity`,
  `GET /api/dda?reference=A`. Second chemin : rouvrir la fiche, rechercher « incidents ». Nettoyage :
  `DELETE /api/grc/<principal>/objects/45e71a55-… If-Match "1"` → HTTP 200 `"archived":true`.
- Vu : à la recherche « 5.24 », une seule option, `option "A-5.24 · 5.24 — …"`. Écart enregistré avec
  `refs: ["requirement:cab686d3-…:1:A-5.24"]`. DdA : `row "A.5.24 Planification et préparation de la gestion des
  incidents de sécurité de l'information Oui Total"` (colonne Écarts vide), indicateur `paragraph: "0"` « « Total » avec
  écart ouvert » ; API `ecarts` : seul l’écart de la phase 1 (`items: ['A-5.15']`, rattaché aussi par
  `legacy:items:A-5.15`). Recherche « incidents » : `option "A-5.24 · 5.24 — …" [selected]` et, en plus,
  `option "Planification et préparation de la gestion des incidents de sécurité de l'information"` (élément historique sans
  code, seul chemin que la DdA lit).
- Verdict : **reproduit**.
- Gravité : majeur → **bloquant** : la DdA affiche « Total » sans écart et l’indicateur « « Total » avec écart ouvert »
  vaut 0 alors qu’une non-conformité ouverte porte sur la mesure : indicateur faux, relevable en audit (6.1.3 d, 10.2).
- Doublons : même famille que BUG-026 (traitement relié à une mesure invisible dans la DdA) : la DdA ne lit que les
  références historiques `legacy:items:<id>`. BUG-019 (identifiant affiché) est distinct. Lien avec C4-04 (sous un
  sous-périmètre, aucune référence n’est proposée).
- Test déterministe : **oui** (API). `POST /api/grc/<racine>/objects` corps `{"kind":"nonconformity","name":"Écart sur
  A-5.24 (fictif)","data":{"refs":["requirement:<id copie ISO>:<version>:A-5.24"],"classification":"mineure",
  "status":"open"}}` (ou par l’écran comme ci-dessus), puis `GET /api/dda?reference=A` ; attendu après correction :
  `ecarts.some(e => e.items.includes('A-5.24'))` et, si A-5.24 est « Total », l’indicateur « « Total » avec écart ouvert »
  à 1 ; observé : aucun écart pour A-5.24, indicateur 0. Page : `/pilotage/dda-annexe-a`, la `row` « A.5.24 … » ne cite
  aucun écart.

## C4-02 — Plans annuels sans périmètre : ce qui est saisi sous un périmètre apparaît sous l’autre

Pile 4, compte `rssi`. Principal `00000000-0000-4000-8000-000000000001`, « Hébergement HDS » `23d9538b-0671-4c55-a2a4-0b30a72a3411`.

- Fait : `ouvrir /pilotage/plans-sensibilisation?perimetre=<HDS>` ; `cliquer button "Ajouter"` ; `remplir "Intitulé de
  l’action" "rejeu C4-02 : sensibilisation saisie sous Hébergement HDS (fictif)"` ; `remplir "Date prévue" "2027-02-15"` ;
  `cliquer button "Enregistrer"` ; `ouvrir /pilotage/plans-sensibilisation?perimetre=<principal>` ; `voir main` ;
  `ouvrir /pilotage/plans-calendrier?perimetre=<HDS>` ; contrôle `GET /api/plans`, `GET /api/admin/audit?q=plan`.
  Nettoyage par l’écran : `cliquer button "PL-SEN-002"`, « Supprimer », « Confirmer » (plans revenus à PL-FOR-001,
  PL-SEN-001, PL-FOR-002, PL-AUD-001).
- Vu : sous HDS, « Modifications enregistrées. » et `row "PL-SEN-002 rejeu C4-02 : sensibilisation saisie sous Hébergement
  HDS (fictif) 15/02/2027 – Planifié –"`. Sous `combobox "Périmètre affiché": SMSI Groupement Santé Fictif`, la même
  `row "PL-SEN-002 …"` et PL-SEN-001 (saisi sous HDS en phase 1). Calendrier sous HDS : `row "Plan de formation 1/2
  réalisé(s), 1 en retard Formation à la PSSI des nouveaux arrivants (fictif) Formation des administrateurs…"` (plans du
  principal). Journal : `plan.created legacy:plans:PL-SEN-002` puis `plan.updated legacy:plans:PL-SEN-002`, sans
  périmètre (un seul « Enregistrer » a produit deux écritures). `GET /api/plans` (HTTP 200) : `{version, plans,
  recurrences, annees, indicateurs, mesures}`, aucun champ ni paramètre de périmètre.
- Verdict : **reproduit**.
- Gravité : majeur, **confirmée** : impossible de tenir un plan de formation ou de sensibilisation propre au périmètre HDS
  (7.2, 7.3) ; pas de lecture hors droits aujourd’hui, puisqu’aucun compte ne peut être privé du principal (T4-01).
- Doublons : même cause que C3-01 (DdA, plan d’audit, GAP) et BUG-037 (processus) : registre historique unique derrière un
  sélecteur de périmètre.
- Test déterministe : **oui** (page). Sous-périmètre S : `/pilotage/plans-sensibilisation?perimetre=<S>`, `button
  "Ajouter"`, `textbox "Intitulé de l’action"`, `textbox "Date prévue"`, `button "Enregistrer"` ; puis
  `/pilotage/plans-sensibilisation?perimetre=<racine>` ; attendu après correction : aucune `row` contenant l’intitulé
  (ou rattachement explicite affiché) ; observé : la `row` « PL-SEN-00n <intitulé> » est listée. API d’appui :
  `GET /api/plans` ne prend aucun paramètre de périmètre et ses entrées n’ont pas de champ de périmètre.

## C4-04 — Écart d’un sous-périmètre impossible à rattacher à une mesure ou une exigence

Pile 4 (aucun référentiel de la bibliothèque appliqué : la DdA repose sur le socle historique), puis pile 3 (ISO/IEC
27001:2022 et HDS v2 ajoutés, attribués et appliqués au principal, HDS « hérite des référentiels du parent »). Compte `rssi`.

- Fait (pile 4) : sous chaque périmètre, `ouvrir /pilotage/amelioration?perimetre=<id>`, `cliquer button "Ajouter un
  constat"`, `cliquer tab "Liens et justificatifs"`, `remplir "Rechercher une référence" "accès"` puis `"5.15"`,
  `cliquer combobox "Éléments liés"`, puis « Fermer » sans enregistrer ; contrôle `GET /api/grc/<id>/sources?search=…`
  (« accès », « 5.15 », « Sauvegarde »), `GET /api/grc/<id>/couverture`, `GET /api/grc/<HDS>/objects?kind=nonconformity`.
  Second chemin (pile 3) : `GET /api/grc/<id>/sources?search=5.15` et `?search=accès` sous les deux périmètres.
- Vu, pile 4 : principal, « accès » → `option "Contrôle d'accès"`, `option "Droits d'accès"`, `option "Droits d'accès
  privilégiés"`, `option "Restrictions d'accès aux informations"` (API : `legacy:items:A-5.15`, `legacy:items:A-5.18`…) ;
  sous HDS, aucune option, aucun message ; API `{"items":[],"truncated":false}` pour « accès » et « 5.15 » ; « Sauvegarde »
  sous HDS ne rend que des objets du périmètre (séries de tâches), pas la mesure A-8.13 du socle. `couverture` :
  `frameworks: []` sous les deux périmètres. L’écart majeur HDS de la phase 1 (« Contrat de l'infogérant sans clause de
  localisation des données (fictif) ») a `refs: []`.
- Vu, pile 3 : sous HDS, « 5.15 » → `{"ref":"requirement:cab686d3-…:1:A-5.15","name":"A-5.15 · 5.15 — Contrôle
  d'accès","kind":"requirement"}` : l’exigence héritée **est** proposée quand le référentiel vient de la bibliothèque.
- Verdict : **reproduit en partie** : le défaut existe tant que l’organisation travaille sur le socle historique de la DdA
  (cas d’une installation neuve, pile 4) ; il disparaît quand ISO/IEC 27001 est ajouté depuis la bibliothèque et appliqué
  (pile 3). Mais dans ce second cas la DdA ignore le rattachement (C3-06) : dans aucun des deux cas l’écart HDS n’atteint
  la DdA.
- Gravité : majeur, **confirmée** : l’étape 10.2 / traçabilité est impossible sous le sous-périmètre sans contournement
  (adopter et appliquer le référentiel de la bibliothèque), et aucun message n’explique pourquoi la liste est vide.
- Doublons : forme avec C3-06 un même défaut de traçabilité « mesure ↔ écart » (deux familles de références,
  `legacy:items:*` limitées à la racine, `requirement:*` ignorées par la DdA). Lien avec C3-03 (sous-périmètre ignoré par
  les écrans de référentiels).
- Test déterministe : **oui** (API, pile neuve sans référentiel de bibliothèque, un sous-périmètre S avec héritage des
  référentiels). `GET /api/grc/<racine>/sources?search=Sauvegarde` → contient `legacy:items:A-8.13` ;
  `GET /api/grc/<S>/sources?search=Sauvegarde` ; attendu après correction : une référence à A-8.13 (ou une réponse qui
  explique l’absence) ; observé : HTTP 200 `{"items":[],"truncated":false}` (pile vide) ou seulement des objets du
  sous-périmètre. Page : `/pilotage/amelioration?perimetre=<S>`, « Ajouter un constat », onglet « Liens et
  justificatifs », `textbox "Rechercher une référence"` = « accès » → aucune `option` dans `combobox "Éléments liés"`.

## C4-05 — Revue de direction : rien de préparé sous un sous-périmètre, et ses écarts absents des entrées du principal

Pile 4, compte `rssi`.

- Fait : `ouvrir /pilotage/revues?perimetre=<principal>` puis `?perimetre=<HDS>`, `voir main` ; sous HDS,
  `cliquer button "Ajouter revue de direction"`, `voir`, « Fermer » sans enregistrer ; contrôle
  `GET /api/grc/<périmètre>/pilotage/revue/entrees` et `GET /api/grc/<périmètre>/objects?kind=nonconformity`.
- Vu : principal : `heading "Préparer la prochaine revue"`, `button "Préparer une revue avec ces entrées"`, entrées 9.3.2 a
  à c 6 ; API (HTTP 200) `9.3.2 c 4 Non-conformités et actions correctives ['3 constats enregistrés, 2 ouvert(s).']`.
  Registres : principal 3 constats (2 ouverts : « Doublon saisi par erreur… », « Politique de sécurité non relue… ») ;
  HDS 1 constat ouvert, classification `majeure` (« Contrat de l'infogérant sans clause de localisation des données
  (fictif) ») : il n’entre pas dans le décompte du principal. Sous HDS : seulement `button "Ajouter revue de direction"`,
  ni bandeau ni entrées ; API `HTTP 404 {"error":"Ces données appartiennent au pilotage commun."}` ; la fiche
  « Ajouter — Revue de direction » a `textbox "Non-conformités et actions correctives (9.3.2 c 4)"` vide.
- Verdict : **reproduit**.
- Gravité : majeur → **bloquant** : la seule revue préparée du SMSI présente « 2 ouvert(s) » alors que le SMSI compte
  une non-conformité majeure ouverte sur son périmètre d’hébergement ; entrée 9.3.2 c) incomplète sans le dire, relevable
  en audit (à ramener à majeur seulement si le RSSI décide que chaque sous-périmètre a sa propre revue, auquel cas il
  reste l’absence de préparation sous HDS).
- Doublons : même famille que BUG-037 (fonction réservée au périmètre racine) ; distinct de BUG-021 (revue précédente
  non reconnue) et BUG-031 (entrées ISO 9001), qui se lisent sur la même page.
- Test déterministe : **oui** (API). Sous-périmètre S avec un écart ouvert. (1) `GET /api/grc/<S>/pilotage/revue/entrees`
  → attendu après correction HTTP 200 avec `entrees` ; observé HTTP 404 `{"error":"Ces données appartiennent au pilotage
  commun."}`. (2) `GET /api/grc/<racine>/pilotage/revue/entrees` → l’entrée `article: "9.3.2 c 4"` compte l’écart de S
  (ou dit explicitement qu’elle exclut les sous-périmètres) ; observé : décompte limité à la racine. Page :
  `/pilotage/revues?perimetre=<S>` → `heading "Préparer la prochaine revue"` absent.

## T4-02 — Un contributeur archive un registre (plan d’actions) qu’il n’a pas créé, sans rôle de gestionnaire

Pile 4. Registres créés pour le rejeu par `rssi` ; `test7-contrib` (rôle Contributeur, membre « Lecture et écriture » de
HDS, aucun droit attribué sur ces registres).

- Fait (écran) : `rssi` : `ouvrir /registres`, `cliquer button "Nouveau registre"`, `remplir "Nom" "rejeu T4-02 plan créé
  par l’administrateur (fictif)"`, `choisir "Périmètre de référence" "SMSI Groupement Santé Fictif"`, `cliquer button
  "Créer"` → registre `8bfc7b02-…`, `role: gestionnaire` pour `rssi`. Connexion de `test7-contrib` par l’écran de connexion
  (`r34-connexion.sh 4 test7-contrib` : mot de passe puis TOTP). `GET /api/registres` (sa session) : `role None peut
  {'lire': True, 'contribuer': True, 'gerer': True}`. `ouvrir /registres/8bfc7b02-…`, `cliquer tab "Paramètres"`,
  `cliquer button "Archiver le registre"`, `cliquer button "Confirmer"`.
- Fait (API, second chemin, registre de référence HDS) : `rssi` `POST /api/registres {"kind":"plan_actions","name":"rejeu
  T4-02 plan HDS créé par l’administrateur (fictif)","referenceId":"<HDS>"}` → HTTP 201 ETag "1" ; `test7-contrib`
  `POST /api/registres/8585db18-…/archivage` avec `If-Match: "1"`. Comparaison : action « rejeu T4-02 action de
  comparaison (fictif) » créée par `rssi` dans le registre par défaut du principal, `test7-contrib` `DELETE
  /api/grc/<principal>/objects/<id>` avec `If-Match: "1"`.
- Vu : onglet Paramètres du contributeur : `button "Enregistrer"`, `button "Archiver le registre"` ; `dialog
  "Confirmation"` « Archiver ce registre ? Il n’accepte plus de nouveaux éléments ; ses éléments, ses périmètres et ses
  droits ne sont pas touchés. » ; après « Confirmer » : retour à `/registres`, aucun message ; `GET
  /api/registres?archives=true` → `archived True version 2`. API : `HTTP 200 … "archived":true`. Journal (lu par `rssi`) :
  `test7-contrib registre.archived 8bfc7b02-…` et `test7-contrib registre.archived 8585db18-…`. Comparaison : archiver une
  seule action → `HTTP 403 {"error":"Votre accès à ce registre ne permet pas cette opération."}` (action archivée ensuite
  par `rssi`, HTTP 200). Aucune commande de désarchivage dans l’interface ni dans les routes `/api/registres*`.
- Verdict : **reproduit**.
- Gravité : bloquant, **confirmée** : écriture hors droits (ADR 0043 point 4 : l’archivage relève du gestionnaire ; le
  même compte est refusé pour une seule action) et irréversible faute de désarchivage. Nuance : le point 5 de l’ADR 0043
  (« modification si tous [les périmètres] le sont en écriture ») est lu par le code (`parModule`, `besoin !== 'lire'` →
  droit `modifier` du module) comme accordant aussi `gerer` ; c’est cette lecture qu’il faut trancher.
- Doublons : aucun dans BUG-016 à BUG-037. Parent de T4-04 (bouton « Nouveau registre » pour le lecteur), autre défaut de
  droits sur les registres, distinct.
- Test déterministe : **oui** (API). Compte Contributeur sans droit attribué sur le registre ; administrateur :
  `POST /api/registres {"kind":"plan_actions","name":"…","referenceId":"<racine>"}` → 201, ETag "1" ; contributeur :
  `POST /api/registres/<id>/archivage`, en-tête `If-Match: "1"`, sans corps ; attendu après correction : HTTP 403 (et
  `peut.gerer: false` dans `GET /api/registres`) ; observé : HTTP 200 `"archived":true`. Page : `/registres/<id>`, onglet
  « Paramètres » : `button "Archiver le registre"` doit être absent pour le contributeur (observé : présent).

## T4-03 — Un contributeur modifie les décisions d’une revue de direction validée

Pile 4, principal. Revue de test propre au rejeu, validée par `rssi` (Administrateur), modifiée par `test7-contrib`
(Contributeur : `pilotage:lire`, `pilotage:modifier`, pas `pilotage:administrer`), archivée ensuite par `rssi`.

- Fait (écran) : `rssi` : « Ajouter revue de direction », `remplir "Intitulé" "rejeu T4-03 revue de droits (fictive)"`,
  « Date de la revue », « Résultats, risques et indicateurs examinés », « Décisions et moyens », « Enregistrer » ; bouton
  « Valider » de la ligne, `remplir "Observations et justification"`, justificatif choisi dans `combobox "Travaux réalisés
  et justificatifs"`, `cocher "Je confirme l’enregistrement de cette décision"`, « Confirmer l’enregistrement » → version 3,
  `status validated`. Connexion de `test7-contrib` par l’écran ; `ouvrir /pilotage/revues` ; « Ouvrir » sur la ligne ;
  `remplir "Décisions et moyens" "Décision remplacée par le contributeur (rejeu, fictif)"` ; `cliquer button
  "Enregistrer"`.
- Fait (API, second chemin) : `rssi` revalide : `POST /api/grc/<racine>/pilotage/decisions` `If-Match: "4"`, corps
  `{"ref":"object:<id>","decision":{"operation":"approval","requestId":"<uuid>","note":"…","date":"2026-11-13",
  "result":"accepted","refs":["object:<id>"],"confirm":"ENREGISTRER"}}` → HTTP 200, version 5 `validated`.
  `test7-contrib` : `PUT /api/grc/<racine>/objects/<id>` `If-Match: "5"`, corps = fiche lue avec `data.decisions` changé :
  avec `data.status: "validated"` → refus `{"error":"Utilisez la commande de vérification ou validation pour conserver la
  décision."}` ; avec `data.status: "draft"` → HTTP 200 ETag "6".
- Vu : pour le contributeur, ligne `row "rejeu T4-03 revue de droits (fictive) Validé Non attribué — Ouvrir Autres
  actions…"` (pas de « Valider ») ; fiche : `alert: Une modification demande une nouvelle vérification. Les décisions
  précédentes restent conservées.`, `textbox "Décisions et moyens"` modifiable, `combobox "État": Brouillon`, `button
  "Enregistrer"` actif. Après « Enregistrer » : `row "rejeu T4-03 revue de droits (fictive) À préparer …"` ; API `v 4
  status draft updatedBy test7-contrib | Décision remplacée par le contributeur (rejeu, fictif)`. Second chemin : `v 6
  draft test7-contrib`. L’historique (`GET …/objects/<id>/history`) garde les six versions.
- Verdict : **reproduit**.
- Gravité : majeur, **confirmée** : la validation de la direction est défaite et les décisions remplacées par un compte
  qui n’a pas le droit de valider ; pas monté à bloquant car rien n’est falsifié (la revue repasse visiblement « À
  préparer » et la version validée reste dans l’historique).
- Doublons : aggrave C4-06 (revue validée affichée « Brouillon » dans sa fiche ; modification après validation
  acceptée) ; distinct de BUG-021 et BUG-032.
- Test déterministe : **oui** (API). Administrateur : créer une revue (`POST /api/grc/<racine>/objects`,
  `kind: "management_review"`, `data.inputs` et `data.decisions` non vides), la valider (`POST
  /api/grc/<racine>/pilotage/decisions` comme ci-dessus). Contributeur : `PUT /api/grc/<racine>/objects/<id>` avec
  `If-Match` de la version validée, `data.status: "draft"` et `data.decisions` modifié ; attendu après correction : HTTP 403
  (ou 409 « revue validée en lecture seule ») ; observé : HTTP 200, `status: "draft"`, `updatedBy` = contributeur. Page :
  pour le contributeur, la fiche d’une revue « Validé » doit être en lecture seule (`button "Enregistrer"` absent ou
  désactivé ; observé : actif).

## T3-03 — Au téléphone, la DdA n’affiche pas les décisions

Pile 3, compte `rssi`, 390 × 844 (largeur utile 375 px), onglet ouvert dans le contexte du pilote (script
`r34-tel.mjs` : mesure des listes par rôle et nom, capture de la ligne). Comparaison au bureau (1440 × 900, `r34-bureau.mjs`).

- Fait : `/pilotage/dda-annexe-a`, listes « Applicabilité de A.5.1 » et « Niveau de A.5.1 » ; `/pilotage/dda-hds`,
  « Applicabilité de HDS 01 » et « Niveau de HDS 01 » ; `/pilotage/dda-iso`, « Niveau de 4.3 » ; captures
  `.pilote-3/captures/r34-tel-dda-a51.png`, `r34-tel-dda-hds01.png`, `r34-tel-dda-iso43.png`, relues.
- Vu : `Applicabilité de A.5.1 {"valeur":"Oui","largeur":52,"clientWidth":50,"scrollWidth":60,"paddingLeft":"10.5px",
  "paddingRight":"29.75px"}` ; `Niveau de A.5.1 {"valeur":"Total","largeur":42,"clientWidth":40,"scrollWidth":68}` ;
  `Niveau de HDS 01 {"valeur":"Partiel","largeur":42,"scrollWidth":77}` ; `Niveau de 4.3 {"valeur":"Total","largeur":42,
  "scrollWidth":68}` ; page `scrollWidth 375 = clientWidth 375` (pas de défilement de page). Captures : dans chaque liste,
  seulement la croix « × » et le chevron, ni « Oui », ni « Total », ni « Partiel ». Au bureau, la même liste mesure 124 px
  (`scrollWidth 122 = clientWidth 122`) : valeur lisible. L’arbre d’accessibilité expose bien la valeur
  (`combobox "Applicabilité de A.5.1": Oui`).
- Verdict : **reproduit**.
- Gravité : majeur, **confirmée** : au téléphone la DdA ne se lit pas (perte d’information à 375 px, WCAG 1.4.10) ; le
  contournement est de repasser au bureau ; aucune donnée n’est fausse.
- Doublons : aucun dans BUG-016 à BUG-037 ; même famille que T3-04 (champs tronqués au téléphone, participants).
- Test déterministe : **oui** (page). Prérequis `PATCH /api/dda/A-5.1 {"app":"oui","level":"Total"}`.
  `page.setViewportSize({ width: 390, height: 844 })`, `page.goto('/pilotage/dda-annexe-a')`,
  `const c = page.getByRole('combobox', { name: 'Niveau de A.5.1', exact: true })` ; attendu après correction :
  `await c.evaluate(e => e.scrollWidth <= e.clientWidth)` vrai (valeur entièrement visible) ; observé : `scrollWidth 68`
  pour `clientWidth 40`. Même assertion sur « Applicabilité de A.5.1 » (60 pour 50).

## T3-01 et T4-01 — Compte impossible à limiter au sous-périmètre (vérification restreinte sur la pile 3)

Rejeu complet confié à l’agent des piles 1 et 2. Vérification demandée ici : l’écriture de `test7-restreint` sur la DdA du
principal passe-t-elle toujours ?

- Fait : session de `test7-restreint` (Contributeur, accès « Lecture et écriture » au seul « Hébergement HDS ») ouverte
  par l’API de connexion (mot de passe puis TOTP) ; `GET /api/auth/me`, `GET /api/grc/smsis`, `GET /api/dda?reference=A` ;
  puis `PATCH /api/dda/A-5.1` avec **les valeurs déjà en place** `{"app":"oui","level":"Total"}` (aucun changement de
  contenu) ; contrôle par `rssi` : `GET /api/dda?reference=A`, `GET /api/admin/audit?q=dda&limit=1`.
- Vu : rôles `['Contributeur']` ; périmètres lisibles : `SMSI Groupement Santé Fictif instance`, `Hébergement HDS
  restricted`. `PATCH` → **HTTP 200** `{"id":"A-5.1","dda":{"app":"oui","level":"Total","just":"Exigence du SMSI et du
  référentiel HDS",…}}` ; DdA version 63 → 64, contenu de A-5.1 identique ; journal `test7-restreint dda.updated
  legacy:dda:A-5.1 {'version': 64}`. Aucune remise en état nécessaire (valeurs inchangées).
- Verdict (partie vérifiée) : **reproduit** : l’écriture du compte « limité » sur la DdA commune passe toujours.
- Gravité : non arbitrée ici (rejeu de l’agent des piles 1 et 2). T3-01 et T4-01 décrivent **le même défaut** (périmètre
  racine non restreignable, `visibility: instance` sans réglage) : à fusionner ; la proposition « bloquant » de T3-01 est
  cohérente avec la grille (écriture hors du périmètre attribué).
- Test déterministe : **oui** (API). Compte Contributeur membre du seul sous-périmètre S : `PATCH /api/dda/A-5.1` corps
  `{}` ou valeurs identiques ; attendu après correction : HTTP 403 (ou 404) ; observé : HTTP 200.

## Outillage, gêne et état laissé

- `pilote.mjs` relancé sur les deux piles (ports 9336 et 9337) ; connexion des comptes par l’écran de connexion
  (`r34-connexion.sh`) ou par l’API de connexion dans un contexte séparé (`r34-lib.mjs`, sessions dans `.pilote-N/`) ; une
  fenêtre TOTP neuve attendue à chaque connexion. Scripts du bloc-notes, préfixe `r34-` : `r34-api.mjs` (appel avec
  `If-Match`), `r34-clic-ligne.mjs` (bouton homonyme dans une ligne), `r34-tel.mjs` et `r34-bureau.mjs` (mesures).
- Gênes : `cliquer radio "Total"` du filtre de la DdA expire (radio masquée), contourné par `cliquer-texte` ; la sortie
  de `pilote.mjs api` est tronquée pour les réponses longues (couverture détaillée, plans), lue par `r34-api.mjs --complet` ;
  validation de revue : il a fallu lire le code pour savoir que « Résultats, risques et indicateurs examinés » est exigé
  (message « Complétez les informations et justificatifs avant validation. » sans nommer le champ, BUG-032).
- Erreurs relevées par le pilote pendant le rejeu : aucune 5xx, aucune erreur JavaScript ni CSP ; des 401 à chaque
  déconnexion sur la pile 4 (déjà signalé par l’agent 7, tranche 4) et les 422 provoqués ci-dessus.
- Données : pile 3, A-6.7 et A-5.2 remises à vide après essai (vérifié par l’API), écart « rejeu C3-06 » archivé,
  `PATCH` de `test7-restreint` sans changement de contenu (version de la DdA passée à 64). Pile 4 : PL-SEN-002 supprimé,
  action « rejeu T4-02 » et revue « rejeu T4-03 » archivées, deux registres « rejeu T4-02 » laissés archivés (aucune
  commande de désarchivage). Aucune donnée des phases 1 et 2 modifiée. Piles en marche ; pilotes connectés avec `rssi`.
