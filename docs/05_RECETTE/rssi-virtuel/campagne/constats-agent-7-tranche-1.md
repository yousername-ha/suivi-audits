# Campagne de recette, phase 2 : agent 7, tranche 1 (organisation, contexte, objectifs, fournisseurs)

| Élément | Valeur |
| --- | --- |
| Commit testé | `2171449` au démarrage, `b305be6` à la fin (commits intermédiaires de documentation de recette des autres agents ; aucun changement dans `apps/` ni `packages/`) |
| Date | 12/11/2026, 22:00 au 13/11/2026, 01:10 (Europe/Paris), avec une interruption (redémarrage de la machine, pile relancée par la session principale, données intactes) |
| Pile | `https://127.0.0.11` (pile Docker n° 1, remplie par l’agent 1 en phase 1) ; `/api/version` : `local`, dernière migration `054_retrait_revues_acces.sql` |
| Pilote | `PILOTE_PORT=9334`, `PILOTE_DOSSIER=.pilote-1` ; petits scripts Playwright reliés au même Chrome, dans le bloc-notes (préfixe `t1-`) |
| Règle | aucune modification de l’application ni des tests ; aucun secret recopié ici |

Premier contact : `GET /api/setup` → `"needed":false,"adminExists":true` (pile installée par la phase 1, attendu).

## Comptes créés (par l’écran Administration > Utilisateurs > Nouveau compte, avec le compte `rssi`)

| Compte | Rôle | Accès aux périmètres (Périmètres > Liste > Accès) | Remarque |
| --- | --- | --- | --- |
| `test7-admin` | Administrateur | aucun ajout (l’administrateur voit tout) | |
| `test7-contrib` | Contributeur | Hébergement HDS : lecture et écriture | |
| `test7-lecteur` | Lecteur | Hébergement HDS : lecture seule | |
| `test7-auditeur` | Auditeur externe, modules « Pilotage du SMSI » et « Fournisseurs » | Hébergement HDS : lecture seule | expiration 2026-11-30 (passée à 2026-11-12 pour l’essai, puis remise) |
| `test7-restreint` | Contributeur | Hébergement HDS : lecture et écriture, seulement | rôle « restreint » de la matrice : restriction impossible (T1-01) |

Mot de passe temporaire changé à la première connexion, TOTP enrôlé ; secrets dans `tests/e2e/rssi-virtuel/.pilote-1/comptes.json`
(ignoré par Git). Création de l’auditeur sans date : refusée avec un message clair (« une date d’expiration est
obligatoire »).

Sources des droits attendus : `packages/shared/src/permissions.ts` (rôles prédéfinis, cité par la rubrique Autorisations
de `docs/03_ARCHITECTURE/SECURITE.md`), ADR 0010 (auditeur externe à portée, expiration obligatoire), ADR 0013
(cartographie : lecteur lit et exporte, auditeur lit si le module lui est ouvert), ADR 0039 (droits et membres ne se
propagent pas d’un périmètre à l’autre), FCT-002 de l’inventaire fonctionnel.

## Méthode

1. Relevé automatique de l’arbre d’accessibilité des 19 écrans, sous le principal puis sous « Hébergement HDS »
   (`?perimetre=`), pour chacun des cinq comptes, avec les réponses HTTP ≥ 400 et les erreurs de console ; comparaison des
   boutons entre rôles (lecteur/contributeur, contributeur/restreint, contributeur/administrateur, lecteur/auditeur).
2. Ouverture des fiches (contexte, parties, SWOT, rôles, processus, objectifs, indicateurs, fournisseur, évaluation par le
   clausier) avec chaque rôle en lecture.
3. Rejeu par l’API, avec la session du compte, des écritures des écrans (création et modification de fiche, relation,
   PESTEL, association de parcours, objectifs historiques, mesures, périmètres, membres, fournisseurs, critères,
   évaluations, cartes, disposition du tableau de bord). Les écritures susceptibles de réussir ont été envoyées sur des
   identifiants inexistants (`PR999`, `OBJ999`) ou avec un `If-Match` faux : une réponse 404 « introuvable » ou 412
   prouve que le contrôle des droits est passé **sans rien modifier**. Aucune donnée de la phase 1 n’a été modifiée.
4. Passage au téléphone (390 × 844, compte `rssi`, principal) : mesure de `scrollWidth`, recherche des éléments qui
   débordent hors d’une région à défilement, capture pleine page relue.
5. Expiration de l’auditeur : date passée à la veille, session ouverte avant l’échéance, puis rejeu après.

## Bilan du CSV

**190 cases : 134 ok, 48 défaut, 8 sans objet, 0 non testée.**

- Défauts : T1-01 (19, toutes les cases du contributeur restreint), T1-02 (22, lecteur et auditeur sur les registres),
  T1-03 (1), T1-05 (2), BUG-037 (4, « Processus » sous le sous-périmètre, tous rôles).
- Sans objet : tableau de bord (`/`) et cartographie sous le sous-périmètre, pour les quatre rôles : écrans sans
  sélecteur de périmètre (tous périmètres lisibles, carte unique de l’organisation, voir C1-18).

Conforme, vérifié : lecteur et auditeur n’ont aucun bouton de création, d’évaluation ou de suppression ; formulaires
historiques et fiche fournisseur entièrement désactivés ; **toutes** les écritures rejouées par l’API sont refusées
(403 `pilotage:modifier`, `pilotage:supprimer`, `pilotage:administrer`, `fournisseurs:modifier`,
`fournisseurs:administrer`, `cartographie:modifier`, `tableau_de_bord:modifier` ; 403 « Votre accès à ce périmètre est
en lecture seule » pour un membre en lecture). Le contributeur n’a ni suppression ni administration (périmètres,
critères, membres, validation d’étape), refusées aussi par l’API. Le périmètre restreint « Doublon de test » (aucun des
comptes n’en est membre) est invisible et `GET /api/grc/<doublon>/objects` → 404 pour lecteur, auditeur et restreint.
L’auditeur ne voit que ses deux modules : tableau de bord réduit, compteurs des autres modules « indisponible »,
`/api/suivi/etat` filtré (écarts, mesures, plans, incidents vides), `kind=action` → 403 `ecarts:lire`, candidats de
relation limités au Pilotage et aux Fournisseurs. Aucune exception JavaScript ni réponse 5xx sur les 180 relevés (seules erreurs : les 403 attendus de la cartographie pour l’uditeur, T1-03).
Téléphone : aucun défilement horizontal de la page sur les 19 écrans.

## Constats

| Constat | Gravité | Titre |
| --- | --- | --- |
| T1-01 | majeur (bloquant selon la règle de la campagne, à arbitrer) | Impossible de limiter un compte au sous-périmètre : le périmètre principal est ouvert à tous |
| T1-02 | mineur | Fiche en lecture seule : formulaire de relation et « Retirer la relation » proposés au lecteur et à l’auditeur |
| T1-03 | mineur | Cartographie refusée à l’auditeur, puis « Aucune carte de contexte… Générez » alors qu’une carte existe |
| T1-04 | mineur | Expiration du compte calculée en UTC : « expire le 2026-11-12 » reste ouvert jusqu’à 00:59:59 le 13/11 à Paris |
| T1-05 | remarque | Téléphone : graphe des périmètres coupé par défaut, colonne d’actions figée posée sur la colonne MFA des fournisseurs |

### T1-01 — Impossible de limiter un compte au sous-périmètre : le périmètre principal est ouvert à tous
- Gravité : majeur. La règle de la campagne classe « bloquant » toute lecture ou écriture hors du sous-périmètre pour le
  contributeur restreint ; ici l’application ne promet pas cette restriction (aucun réglage), d’où « majeur » proposé,
  à arbitrer en phase 3.
- Écrans : les 19 écrans de la tranche (cases `restreint|contributeur`)
- Référence : ISO/IEC 27001:2022, A.5.15 (contrôle d’accès), A.5.18 (droits d’accès), A.8.3 (restriction d’accès à
  l’information) ; HDS v2 (séparation des activités d’hébergement) ; ADR 0039 point 4 (« droits et membres ne se
  propagent pas »)
- Observé : `test7-restreint` (Contributeur) n’a été rendu membre que de « Hébergement HDS » (`Gérer l’accès au
  périmètre Hébergement HDS` → « Contributeur restreint HDS de recette 7 (fictif) · Écriture »). Le périmètre principal
  affiche « Toute l’organisation » dans la colonne Accès ; aucun écran ne permet de le passer en « Membres seulement »
  (bouton « Accès » proposé seulement pour les périmètres restreints) ni de restreindre un compte à des périmètres dans
  « Nouveau compte » (champs : identifiant, nom, e-mail, rôles, groupes, expiration). Résultat :
  - `GET /api/grc/smsis` → « SMSI Groupement Santé Fictif », « Hébergement HDS » ;
    `GET /api/grc/00000000-…-0001/objects?kind=context` → HTTP 200 avec la fiche « Contexte réglementaire de la santé
    (fictif) » du principal ;
  - écriture sur le principal acceptée par le contrôle des droits (sans rien modifier) :
    `PUT /api/grc/00000000-…-0001/objects/87768403-… [If-Match "999999"]` → HTTP 412 « La fiche a changé. Rechargez
    avant de confirmer. » ; `PATCH /api/grc/00000000-…-0001/pilotage/objectifs/processes/PR999 {"name":"EssaiT7"}` →
    HTTP 404 « Processus introuvable. » (le lecteur reçoit 403 sur les mêmes appels) ;
  - les 38 relevés du compte restreint sont identiques à ceux de `test7-contrib` : « Ajouter périmètre et contexte »,
    « Ajouter un objectif », « Ajouter un fournisseur », « Évaluer le fournisseur … », « Nouvelle évaluation »,
    « Générer… » sur la cartographie, etc., sous le principal ;
  - fournisseurs, critères et évaluations par le clausier sont des registres de l’organisation : tout contributeur les
    modifie, quel que soit son périmètre.
  Cause lue : `apps/api/src/grc/core.ts`, `access()` ne contrôle l’appartenance que si `visibility = 'restricted'` ; le
  périmètre commun est créé en `visibility: 'instance'` et aucune route ne la modifie.
- Attendu : pouvoir donner à un compte (sous-traitant, équipe d’hébergement) l’accès au seul périmètre « Hébergement
  HDS », sans lecture ni écriture du périmètre commun ni des registres de l’organisation, ou un avertissement explicite
  dans « Accès au périmètre » que le périmètre commun reste ouvert à tous les comptes.
- Reproductible par : à écrire (compte contributeur membre du seul sous-périmètre ; `PATCH …/processes/PR999` sur le
  principal doit répondre 403/404 « périmètre non accessible », pas « Processus introuvable »).

### T1-02 — Fiche en lecture seule : formulaire de relation et « Retirer la relation » proposés aux comptes en lecture
- Gravité : mineur (le serveur refuse : aucune écriture hors droits)
- Écrans : Périmètre et contexte, Parties intéressées, SWOT, Rôles et responsabilités (deux périmètres), Objectifs par
  processus, Objectifs et Indicateurs sous « Hébergement HDS » (registre générique), pour le lecteur et l’auditeur
- Référence : ergonomie (pas d’action proposée qui sera refusée) ; AGENTS.md (messages en français, sans clé technique)
- Observé : `test7-lecteur`, `/pilotage/contexte`, `cliquer button "Ouvrir"` → `paragraph: Cette fiche est consultable
  en lecture seule.`, tous les champs `[disabled]` ; onglet « Liens et justificatifs » : `combobox "Objet ou version de
  preuve"` actif, `combobox "Type de relation"` actif, `textbox "Justification du lien"` actif, `button "Retirer la
  relation"` actif. `cliquer button "Retirer la relation"` → `alert "Erreur": "Erreur Droit requis :
  pilotage:modifier"`, relation conservée. Même chose pour `test7-auditeur` sur les onze fiches vérifiées (script
  `t1-liens`). API : `POST /api/grc/<principal>/links` → 403 « Droit requis : pilotage:modifier » ; sous HDS (membre en
  lecture) → 403 « Votre accès à ce périmètre est en lecture seule. ». Cause lue : `apps/web/src/grc/Relations.tsx`
  n’a aucun contrôle de droit.
- Attendu : relations affichées en lecture seule (sans formulaire ni bouton de retrait) quand la fiche l’est ; message
  d’erreur sans le code de permission (« Vous n’avez pas le droit de modifier le Pilotage du SMSI »).
- Reproductible par : à écrire (lecteur, onglet « Liens et justificatifs » : aucun bouton « Retirer la relation »).

### T1-03 — Cartographie refusée à l’auditeur, puis « Aucune carte de contexte… Générez une première carte »
- Gravité : mineur
- Écran : `/cartographie` (auditeur externe sans le module Cartographie)
- Référence : ADR 0013 (auditeur : lecture si le module est ouvert) ; ergonomie
- Observé : `test7-auditeur`, `ouvrir /cartographie` → `alert "Erreur": "Erreur Droits insuffisants : vous ne pouvez pas
  consulter dans « Cartographie du SMSI »."` (403 sur `GET /api/carto/objects`, `GET /api/carto/maps`,
  `GET /api/grc/<principal>/framework-attachments`, trois erreurs de console), puis `heading "Aucune carte de contexte"`,
  « Générez une première carte à partir du périmètre… » et « Lecture seule : aucune carte n’a encore été créée pour
  cette vue. » ; une carte de contexte existe (`GET /api/carto/maps` avec le lecteur → « Carte du contexte »).
  Le refus lui-même est conforme.
- Attendu : seul le message de refus (ou une page « module non ouvert »), sans inviter à générer ni affirmer
  qu’aucune carte n’existe.
- Reproductible par : à écrire.

### T1-04 — Expiration du compte calculée en UTC
- Gravité : mineur
- Écran : Administration > Utilisateurs (hors tranche) ; effet sur tous les écrans de l’auditeur
- Référence : ISO/IEC 27001:2022, A.5.18 (fin des droits d’accès) ; ADR 0010 (date d’expiration obligatoire)
- Observé : « Modifier test7-auditeur », « Date d’expiration du compte » `2026-11-12`, « Enregistrer » → ligne « expire
  le 2026-11-12 » ; `GET /api/admin/users` → `"expires_at":"2026-11-12T23:59:59.000Z"`. Connexion réussie à 00:54
  (heure de Paris) le 13/11, `GET …/objects?kind=context` → 200 ; à 01:00:35, même session → HTTP 401
  « Authentification requise. », et nouvelle connexion refusée (« Identifiant ou mot de passe incorrect, ou compte
  temporairement verrouillé… »). Le fuseau de l’instance et du périmètre est Europe/Paris : le compte reste ouvert une
  heure après la date affichée (deux heures en été). La fermeture de session à l’échéance est, elle, conforme.
  Expiration remise ensuite à 2026-11-30.
- Attendu : fin de validité à 23:59:59 dans le fuseau de l’instance (ou libellé « expire le 2026-11-12 à 23:59 UTC »).
- Reproductible par : à écrire (test unitaire sur la conversion de la date saisie).

### T1-05 — Téléphone : graphe des périmètres coupé, colonne d’actions posée sur la colonne MFA
- Gravité : remarque
- Écrans : Périmètres, Fournisseurs de l’organisation (390 × 844, compte `rssi`)
- Référence : ADR 0011 et 0012 (téléphone : aucun défilement horizontal, première colonne figée)
- Observé : aucune page ne défile horizontalement (`scrollWidth` = 390 sur les 19 écrans). Périmètres : la vue par
  défaut « Graphe » coupe les cartes à droite (« 0 ouverte(s) · 0 e… », « Hébergem… ») dans la région « Graphe des
  périmètres, défilement possible » ; la vue « Liste » serait lisible. Fournisseurs : la colonne « Actions » figée
  (x = 257 à 375) recouvre la colonne « MFA » (liste `MFA de Infogérant fictif`, x = 257 à 343) dont le chevron apparaît
  entre « Évaluer » et « Historique » ; la colonne « Type » est vide. Les autres tableaux larges (critères, vue
  compacte des objectifs, référentiels activés de la Synthèse) sont dans des régions à défilement annoncées.
- Attendu : vue Liste par défaut sur téléphone ; colonne d’actions opaque ou colonnes secondaires masquées.
- Reproductible par : à écrire (capture téléphone).

## Défauts connus reconfirmés

- **BUG-037** : page « Processus » blanche sous « Hébergement HDS » pour les quatre rôles (titre et sélecteur seuls,
  aucun bouton).
- **BUG-018** : « Toggle password visibility » sur les trois champs de « Choisir un nouveau mot de passe » (première
  connexion des cinq comptes).
- **BUG-017** (Synthèse, téléphone et bureau) : « Conformité par référentiel » à 100 % « Non renseigné » et « 0 % » au
  tableau de bord.
- Constats de la phase 1 toujours visibles sous tous les rôles et non recomptés ici : C1-15 (renvois à l’ISO 9001),
  C1-13 (« 0 % SaaS avec MFA (0/0) »), C1-17 (« 2027 — Surveillance 2 »).

## Signalements pour d’autres tranches

- Agent 6 (comptes) : T1-04 ; la liste « Révoquer l’accès » du dialogue « Accès au périmètre » répète le même nom de
  bouton pour chaque membre (accessibilité, même famille que C1-16).
- Navigation de l’auditeur (modules Pilotage et Fournisseurs seulement) : le menu garde « Risques », « Conformité et
  audits », « Actions » et « Résilience » ; non vérifié ici (écrans des tranches 2 à 5).

## Ce qui n’a pas été fait

- Aucune écriture réelle hors droits n’a réussi ; la preuve de T1-01 repose sur des réponses 404 et 412 obtenues après
  le contrôle des droits, sans modification de données.
- Les écrans n’ont été passés au téléphone que sous le principal (cases de la matrice : `principal|rssi|telephone`).
