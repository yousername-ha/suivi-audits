# Constats de l’agent 7, tranche 2 : risques sous chaque rôle, chaque périmètre et au téléphone

| Élément | Valeur |
|---|---|
| Commit du dépôt | `2171449` au début du passage, `f5ebb35` à la fin (seuls des documents de recette ont changé) ; pile construite par la phase 1 depuis `2e63e86` (voir `constats-agent-2.md`) |
| Date | 12/11/2026, 22:05 à 22:45 (Europe/Paris) |
| Pile | `https://127.0.0.12`, pile Docker éphémère n° 2, remplie par l’agent 2 (principal « SMSI Groupement Santé Fictif », visible de toute l’organisation ; sous-périmètre « Hébergement HDS », « Membres seulement ») |
| Données | jeu fictif uniquement ; fiches d’essai nommées « test7 … (fictif) » |
| Matrice | tranche 2, agent 7 : 70 cases, **46 ok, 24 défaut, 0 sans objet, 0 non testée** |

## Comptes créés

Tous créés par l’écran « Plateforme › Utilisateurs › Nouveau compte » avec le compte `rssi` (mot de passe temporaire
affiché une fois). Premier passage (TOTP, mot de passe personnel) fait par l’API, comme `preparerCompte` des tests de
bout en bout. Identifiants et secrets dans `tests/e2e/rssi-virtuel/.pilote-2/comptes.json` (ignoré par Git).

| Rôle de la matrice | Compte | Rôle attribué | Accès au sous-périmètre HDS |
|---|---|---|---|
| administrateur | `test7-admin` | Administrateur | implicite (administrateur) |
| contributeur | `test7-contrib` | Contributeur | membre, « Lecture et écriture selon les droits métier » |
| lecteur | `test7-lecteur` | Lecteur | membre, « Lecture et écriture selon les droits métier » (pour vérifier que l’adhésion n’élève pas le rôle) |
| auditeur_externe | `test7-auditeur` | Auditeur externe, modules « Pilotage du SMSI » et « Cartographie du SMSI », expiration 31/12/2026 | membre, « Lecture et écriture selon les droits métier » |
| restreint | `test7-restreint` | Contributeur | membre ; seul compte prévu pour HDS (voir T2-01) |

Les adhésions ont été données par « Pilotage › Périmètres › Liste › Accès » (bouton absent de la vue « Graphe », T2-06).

## Méthode

- **Écrans** : connexion par l’écran de chaque compte dans le Chrome du pilote, puis les 7 écrans sous chaque
  périmètre (`t2-ecrans.mjs` : titre, boutons visibles, lignes ; arbres conservés dans `.pilote-2/t2-arbres/`), et
  ouverture des fenêtres proposées (fiche, appréciation, liens, étude atelier par atelier).
- **API** : `t2-droits.mjs <compte> <P|H>` rejoue avec la session du compte les écritures que font les écrans
  (`POST /api/grc/:smsi/objects` pour les six types, `PUT …/objects/:id` avec `If-Match`, `POST …/risks/:id/preview`
  puis `/evaluate`, `POST …/links`, `POST …/treatments/:id/action`, `DELETE …/objects/:id` avec `If-Match`,
  `POST …/methods/preview`, `PUT …/method`, `POST /api/config-grc/items` en portée organisation et périmètre,
  `POST /api/config-grc/templates/:id/adopt`). Les écritures refusées visaient des fiches cibles créées par `rssi` ;
  leur version a été relue avant et après (toujours 1 → 1).
- **Droits attendus** : `packages/shared/src/permissions.ts` (`SYSTEM_ROLE_DEFS` : Contributeur « lire et modifier
  les modules métier … ; exporter les cartes », Lecteur « lecture seule … ; export des cartes », Auditeur externe
  « lecture seule des modules choisis … date d’expiration ») ; INVENTAIRE_FONCTIONNEL FCT-002 (droits effectifs,
  périmètres auditeur, expiration) ; DAT et ADR 0039 / 0043 (le périmètre est l’unité de partition des droits, accès
  « Toute l’organisation » ou « Membres seulement »).
- **Nettoyage** : les 52 fiches « test7 … » (risques, opportunités, études, traitements, actifs, actions générées) ont
  été archivées par `rssi`, les 4 brouillons d’échelle `t7_…` supprimés. Restent : les 5 comptes, leurs adhésions à
  HDS, les appréciations (immuables) et relations des fiches archivées. Aucune donnée de la phase 1 n’a été modifiée.
  Invariants INV-01 à INV-08 : OK après nettoyage.

## Ce qui est conforme (vérifié)

- **Isolation du sous-périmètre** : avant adhésion, contributeur, lecteur, auditeur et restreint reçoivent
  `404 {"error":"Périmètre introuvable ou non accessible."}` sur les 12 lectures des écrans de la tranche sous HDS
  (registre, objets, bibliothèque, carte, méthodes, politique, responsables) ; l’échelle de portée HDS n’apparaît pas
  dans leur catalogue. Sous HDS, les sélecteurs (liens, actifs) ne proposent que des objets HDS.
- **Lecteur et auditeur externe** : toutes les écritures rejouées sont refusées (403), sous le principal comme sous
  HDS, y compris quand l’adhésion à HDS est en écriture : l’adhésion n’élève pas le rôle. Fiches et ateliers EBIOS RM
  grisés.
- **Auditeur externe** : ne lit que ses deux modules ; les relations sont filtrées (l’action liée à T-01 visible du
  lecteur n’est pas renvoyée à l’auditeur par `GET …/links`) ; le sélecteur de liens ne propose que des objets du
  pilotage. **Expiration** : date passée au 11/11/2026 par « Modifier » (`PATCH /api/admin/users/:id` → 200, « expiré
  2026-11-11 ») : session ouverte refusée (`401 {"error":"Authentification requise.","stage":"anon"}`), nouvelle
  connexion refusée (401) ; date rétablie au 31/12/2026, connexion de nouveau possible.
- **Contributeur** : crée, modifie, apprécie (décision « Proposition documentée »), relie, génère une action (200) ;
  ne peut ni archiver (`403 Droit requis : pilotage:supprimer`), ni approuver une appréciation (`403 … pilotage:administrer`),
  ni publier ou choisir une méthode, ni créer d’échelle ou adopter un modèle ; l’écran ne propose pas ces actions.
- **Administrateur** : toutes les écritures aboutissent sous les deux périmètres (archivage, choix de méthode,
  échelles en brouillon, export de carte autorisé).
- **Traçabilité** : `GET /api/admin/audit` attribue chaque création, modification, appréciation et relation au compte
  qui l’a faite (`grc.object.created`, `grc.object.updated`, `grc.risk.evaluated`, `grc.link.saved`, `config.create`).
- **Téléphone** (390 × 844, compte `rssi`, principal) : aucune page ne défile horizontalement (`scrollWidth` 375 pour
  375 utiles) ; les 7 captures (`.pilote-2/captures/t2-tel-*.png`) ont été relues.

## Constats

### T2-01 — Impossible de limiter un compte au sous-périmètre : le périmètre principal reste lisible et modifiable
- Gravité : majeur
- Écrans : les 7 écrans de la tranche (case `restreint`)
- Référence : ISO/IEC 27001:2022 A.5.15 et A.8.3 (moindre privilège), A.5.18 ; HDS v2 (cloisonnement des activités
  d’hébergement) ; ADR 0039 (« le périmètre reste l’unité de partitionnement des droits »)
- Observé : `test7-restreint` (Contributeur) est membre du seul périmètre « Hébergement HDS ». Le périmètre racine est
  créé avec l’accès « Toute l’organisation » (`visibility: "instance"`, `grc/core.ts`) et aucun écran ne permet de le
  passer en « Membres seulement » (le bouton « Accès » n’existe que pour un périmètre « Membres seulement »). Résultat :
  - `GET /api/grc/smsis` avec la session du compte → 200, deux périmètres ; « Périmètre affiché » propose
    « SMSI Groupement Santé Fictif » et « Hébergement HDS » ;
  - les 7 écrans du principal s’affichent avec leurs boutons de création (« Ajouter un risque », « Nouvelle étude »,
    « Ajouter un traitement »…) ;
  - `t2-droits.mjs test7-restreint P` : `POST /api/grc/00000000-…-0001/objects` (risque, opportunité, étude, traitement,
    valeur métier, bien support) → `HTTP 200` ; `POST …/risks/<id>/evaluate` → `HTTP 200` ; `POST …/links` → `HTTP 200` ;
    `POST …/treatments/<id>/action` → `HTTP 200`. Fiches modifiées : uniquement celles créées par l’essai, archivées
    ensuite.
- Attendu : un contributeur de l’équipe d’hébergement ne voit et ne modifie que le périmètre HDS ; soit le périmètre
  racine peut être restreint aux membres, soit l’adhésion à un sous-périmètre peut être exclusive.
- Reproductible par : à écrire (compte Contributeur membre d’un seul sous-périmètre : `GET /api/grc/smsis` ne doit
  renvoyer que ce périmètre, `POST /api/grc/<principal>/objects` doit répondre 404).

### T2-02 — Actions d’écriture proposées aux comptes en lecture seule
- Gravité : mineur
- Écrans : Registre des risques, Traitements, Scénarios et actifs (lecteur et auditeur externe, principal et HDS)
- Référence : ergonomie (AGENTS.md : pas d’impasse) ; A.5.15
- Observé (`test7-lecteur`, puis `test7-auditeur`, même résultat) :
  - Traitements : bouton « Ajouter un traitement » ; il ouvre « Ajouter — Traitement » avec « Cette fiche est
    consultable en lecture seule. » et tous les champs `[disabled]`.
  - Registre des risques : « Apprécier / réévaluer » ouvre « Appréciation — … » avec `combobox "Gravité"`,
    `combobox "Vraisemblance"`, `textbox "Justification de l’appréciation"` actifs, sans bouton d’enregistrement.
  - « Liens et preuves » (risques, traitements, scénarios) : le formulaire se remplit ; « Enregistrer la relation »
    envoie `POST /api/grc/00000000-…-0001/links` → `403 {"error":"Droit requis : pilotage:modifier"}`, affiché
    « Erreur Droit requis : pilotage:modifier ».
  - Le serveur refuse tout (aucune écriture aboutie, versions des cibles inchangées).
- Attendu : comme pour « Ajouter un risque », « Nouvelle étude » ou « Créer valeur métier », déjà masqués pour ces
  rôles : masquer « Ajouter un traitement » et le formulaire de relation, présenter l’appréciation en consultation.
- Reproductible par : à écrire (compte Lecteur : aucun bouton « Ajouter un traitement » ni « Enregistrer la relation »).

### T2-03 — Refus de droit en codes techniques
- Gravité : mineur
- Écrans : tous les écrans de la tranche (message affiché après un refus, voir T2-02)
- Référence : AGENTS.md (messages en français) ; `apps/api/src/rights.ts` (`permissionDenied` produit déjà « Droits
  insuffisants : vous ne pouvez pas créer ou modifier dans « Pilotage du SMSI » »)
- Observé : les refus du module GRC passent par `grc.permission`, qui répond
  `403 {"error":"Droit requis : pilotage:modifier"}` (de même `pilotage:supprimer`, `pilotage:administrer`,
  `parametres:modifier`, `parametres:administrer`, `ecarts:modifier`, `import_export:exporter`) ; l’écran l’affiche tel
  quel (« Erreur Droit requis : pilotage:modifier »).
- Attendu : le message en français de `permissionDenied`, qui nomme l’action et le module.
- Reproductible par : à écrire (assertion sur le texte du refus de `POST /api/grc/:smsi/objects` par un Lecteur).

### T2-04 — Carte des risques non exportable par le contributeur et le lecteur, contrairement à leur rôle
- Gravité : mineur
- Écran : Cartographie des risques (contributeur et lecteur, principal et HDS)
- Référence : `packages/shared/src/permissions.ts` (Contributeur « exporter les cartes », Lecteur « export des
  cartes », permission `cartographie:exporter`) ; écran « Rôles et droits » qui affiche ces descriptions
- Observé : pour `test7-contrib` et `test7-lecteur`, la carte n’offre que « Ajuster la carte » ; les boutons
  « Exporter SVG / PNG / PDF / JSON » n’apparaissent qu’à l’administrateur. `GET /api/grc/<périmètre>/export/authorize?kind=risks`
  → `403 {"error":"Droit requis : import_export:exporter"}` pour les deux comptes (200 pour `test7-admin`) :
  l’écran (`grc/RiskMap.tsx`) et le serveur exigent aussi `import_export:exporter`, qu’aucun des deux rôles ne possède.
- Attendu : la description du rôle et le droit effectif concordent (soit l’export de la carte des risques relève de
  `cartographie:exporter`, soit la description du rôle le dit).
- Reproductible par : à écrire (compte Lecteur : bouton « Exporter PDF » visible et `export/authorize` → 200, ou
  description du rôle corrigée).

### T2-05 — Téléphone : colonne des actions hors champ dans les tableaux
- Gravité : remarque
- Écrans : Registre des risques, Configuration des analyses (compte `rssi`, 390 × 844)
- Référence : ergonomie d’un RSSI pressé
- Observé : `pilote` à 390 × 844, captures `t2-tel-risques-SMSI.png` et `t2-tel-configuration-analyses-SMSI.png` : la
  page ne défile pas horizontalement, mais le tableau (cadre `table-wrap`, `scrollWidth` 706 pour 330 visibles) coupe
  la colonne « Actions » (« Ouvrir », « Apprécier / réévaluer ») et la colonne « État » ; il faut faire défiler le
  tableau seul pour les atteindre. Les autres écrans de la tranche passent en cartes et restent complets.
- Attendu : comme pour Opportunités et Traitements, une présentation en cartes ou une colonne d’actions toujours visible.
- Reproductible par : à écrire (390 × 844 : le bouton « Ouvrir » de la première ligne est dans la zone visible).

### T2-06 — Remarques hors tranche relevées en préparant les comptes
- Gravité : remarque
- Écrans : Utilisateurs, Périmètres (tranches 6 et 1, signalé seulement)
- Observé :
  - « Nouveau compte » : bouton de fermeture sans nom (`button: img`) ; le champ « Modules ouverts à l’auditeur externe
    (lecture seule) » n’est pas cliquable par son nom (champ masqué, il faut cliquer son cadre).
  - Expiration choisie « 31/12/2026 » enregistrée `2026-12-31T23:59:59.000Z`, soit le 01/01/2027 à 00:59 à Paris.
  - « Périmètres » : le bouton « Accès » n’existe que dans la vue « Liste », pas dans la vue « Graphe » affichée par défaut.
  - « Accès au périmètre » : recliquer l’option déjà affichée la désélectionne. Un nouveau clic sur le compte déjà
    choisi a envoyé `PUT /api/grc/<HDS>/members` → 422 (compte désélectionné) ; un nouveau clic sur « Lecture et écriture
    selon les droits métier » repasse en « Lecture seule » (l’affichage suit, mais le piège est fréquent).
- Reproductible par : à confier aux agents des tranches 1 et 6.

## Défauts déjà connus, reconfirmés sous d’autres rôles

| Référence | Observation de la tranche 2 |
|---|---|
| BUG-023 | « Appréciation — … » vue par le lecteur : « Décisions conservées » en JSON brut et « Méthode conservée : … · draft » ; légende de la carte « conditional / unacceptable », au téléphone aussi. |
| C2-15 | Bouton de fermeture sans nom (`button:`) dans « Appréciation — … » et « Liens et justificatifs », sous tous les rôles. |
| C2-16 | Sous le principal, « Configuration des analyses » liste des échelles de portée HDS (`t7_test7_admin_h_smsi` créée pour l’essai, `besoin_dispo_hds`) sans indiquer leur portée. |
| C2-10 | L’administrateur archive une opportunité ou un actif par l’API (`DELETE …/objects/:id` → 200), mais aucun écran ne propose l’archivage. |

## Ce qui a bloqué

Rien de bloquant. La création des comptes, l’adhésion aux périmètres et le changement de compte ont été faits par
l’interface ; le premier passage des comptes (TOTP) et le rejeu des écritures par l’API, avec de petits scripts
Playwright gardés dans le bloc-notes de la session (`t2-*.mjs`), car le pilote n’envoie pas `If-Match`. Le passage au
téléphone n’a été fait que sous le principal, comme le demande la matrice.
