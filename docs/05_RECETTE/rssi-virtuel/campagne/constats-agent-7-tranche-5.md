# Constats de l’agent 7, tranche 5 : incidents, crise, continuité, documents, exports (passage transversal)

| Élément | Valeur |
|---|---|
| Commit testé | `2171449` (branche `claude/recette-rssi-2026-11-12`) au début du passage ; la branche est à `bb3c706` à la rédaction (commits de documentation de la campagne, aucun changement de l’application) |
| Date | 12/11/2026, 22:00 à 22:55 (Europe/Paris) pour les essais ; rédaction le 13/11/2026 à 00:40 après une interruption (limite d’utilisation, puis redémarrage de la machine par la session principale) |
| Pile | `https://127.0.0.15`, pile Docker n° 5 installée et remplie par l’agent 5 en phase 1 (`GET /api/setup` : `needed:false`, `adminExists:true`) ; pile laissée en marche |
| Périmètres | principal « SMSI Groupement Santé Fictif » (visibilité « Toute l’organisation ») ; sous-périmètre « Hébergement HDS » (« Membres seulement ») |
| Données | jeu fictif uniquement ; données de la phase 1 inchangées (empreinte des versions identique avant et après les essais refusés, voir « Écritures faites pendant le passage ») |
| Matrice | `agent-7-tranche-5.csv` : 150 cases, **74 ok, 52 défaut, 24 sans objet, 0 non testée** |

## Comptes créés (par le compte `rssi`, écran Plateforme › Utilisateurs)

Mot de passe provisoire affiché une fois par l’écran, puis enrôlement TOTP et mot de passe personnel. Secrets dans
`tests/e2e/rssi-virtuel/.pilote-5/comptes.json` (ignoré par Git) ; aucun secret ici.

| Rôle de la matrice | Compte | Rôle attribué | Accès au sous-périmètre HDS (Périmètres › Liste › Accès) |
|---|---|---|---|
| administrateur | `test7-admin` | Administrateur | aucun (l’administrateur voit tout) |
| contributeur | `test7-contrib` | Contributeur | Lecture et écriture |
| lecteur | `test7-lecteur` | Lecteur | Lecture seule |
| auditeur_externe | `test7-auditeur` | Auditeur externe, modules « Incidents et PCA/PRA », « Documents et liens », « Pilotage du SMSI », expiration 31/12/2026 | Lecture seule |
| restreint | `test7-hds` | Contributeur | Lecture et écriture, seul accès qu’on puisse limiter (voir T5-01) |

Les cinq créations sont possibles par l’interface. Le pilote ne sait pas choisir dans la liste multiple « Modules ouverts à
l’auditeur externe » (`choisir` attend un champ masqué) : sélection faite par un script relié au même Chrome. La touche
Échap dans la liste « Rôles » ferme toute la fenêtre « Nouveau compte » et perd la saisie (écran de l’agent 6, noté T5-08).

## Méthode

- Écrans : les 15 écrans de la tranche, pour chaque compte, sous le périmètre racine puis sous HDS (`?perimetre=<id>`),
  avec un script relié au Chrome du pilote qui relève titre, périmètre affiché, boutons visibles, lignes, alertes, erreurs
  HTTP et JavaScript. Fiches ouvertes à la main avec le pilote (`voir`) pour le lecteur et l’auditeur.
- API : pour chaque compte, sa propre session (connexion complète avec TOTP, contexte séparé), lectures puis écritures
  rejouées comme l’écran les envoie (`POST`, `PUT` avec `If-Match`, `PATCH`, `DELETE`). Les écritures du contributeur ont
  porté sur des fiches « test7 » qu’il a créées lui-même ; les refus du lecteur et de l’auditeur visaient les fiches de la
  phase 1 avec un contenu identique. Empreinte des versions (`/api/incidents`, `/api/crise`, `/api/plans`, documents,
  liens, fiches de continuité des deux périmètres) relevée avec `rssi` avant et après : inchangée.
- Téléphone : compte `rssi`, fenêtre 390 × 844 (même émulation que `pilote taille 390 844`), largeur de défilement de la
  page, éléments qui débordent hors d’une zone défilante, capture pleine page relue avec l’outil d’image
  (`.pilote-5/captures/t5-tel-*.png`).
- Attentes : rôles prédéfinis de `packages/shared/src/permissions.ts` (contributeur « lire et modifier », lecteur « lecture
  seule », auditeur externe « lecture seule des modules choisis », date d’expiration obligatoire) ; inventaire FCT-002
  (droits effectifs, périmètres auditeur, expiration) ; DAT, rubrique porte de lecture (ADR 0083) ; ADR 0043 (404 sans
  lecture, 403 avec lecture) ; ADR 0080 (contribution RETEX déléguée, 404 uniforme).

## Synthèse

| Gravité | Constats |
|---|---|
| Bloquant | T5-01, T5-02 |
| Majeur | T5-03 |
| Mineur | T5-04, T5-05, T5-06, T5-07 |
| Remarque | T5-08, T5-09 |

Conforme, vérifié : lecteur et auditeur externe ne peuvent rien écrire (22 écritures rejouées, toutes 403, état
inchangé) ; le contributeur ne peut ni supprimer ni archiver (403 `pilotage:supprimer`, `incidents:supprimer`,
`documents:supprimer`), ni importer, ni exporter (403 `import_export:*`) ; boutons masqués en cohérence ; un compte non
membre reçoit 404 sur HDS ; un membre en lecture reçoit 403 « Votre accès à ce périmètre est en lecture seule. » ; la
synthèse du mur et la liste des incidents sont expurgées pour l’auditeur (écarts `null`, statuts d’écart vides) ; un compte
non invité reçoit 404 « RETEX introuvable. » ; un compte expiré est refusé à la connexion (401, message générique) et
désactivé ; la modification des droits ferme les sessions du compte.

## Constats

### T5-01 — Aucun compte ne peut être limité au sous-périmètre : le périmètre commun reste lisible et modifiable

- Gravité : bloquant (règle de campagne : écriture hors du sous-périmètre ; l’origine est une limite de conception, à arbitrer en phase 3)
- Écrans : toute la tranche (cases `restreint`)
- Référence : ISO/IEC 27001:2022, A.5.15, A.5.18, A.8.3 ; HDS v2 (périmètre des activités d’hébergement) ; consigne de campagne §5 phase 2
- Observé : `test7-hds` (Contributeur) n’est membre que de « Hébergement HDS ». Le racine est en « Toute l’organisation »
  (`GET /api/grc/smsis` : `"visibility":"instance"`) et l’écran Périmètres n’offre aucun moyen de le changer (colonne en
  lecture seule, bouton « Accès » réservé aux périmètres restreints). Avec la session de `test7-hds` :
  `GET /api/grc/<racine>/objects?kind=continuity_plan` → 200 ; `POST /api/grc/<racine>/objects`
  `{"kind":"continuity_exercise","name":"test7 test7-hds écriture hors sous-périmètre (fictif)"}` → **200** (fiche archivée
  ensuite par `rssi`) ; `GET /api/grc/<racine>/objects?kind=nonconformity` → 200 ; `GET /api/incidents` → INC-2026-001 du
  racine. Écran : `combobox "Périmètre affiché"` propose `option "SMSI Groupement Santé Fictif"` et `option "Hébergement
  HDS"`. Mur : synthèse de toute l’organisation. Incidents, cellules, contacts, scénarios, documents : registres sans
  périmètre (C5-06), donc entièrement visibles et modifiables.
- Attendu : pouvoir donner à un compte l’accès au seul sous-périmètre HDS (lecture et écriture), sans lecture ni écriture
  dans le périmètre commun ni dans les registres des autres activités.
- Reproductible par : à écrire (compte contributeur membre du seul sous-périmètre, `POST` d’une fiche dans le racine :
  refus attendu).

### T5-02 — Un contributeur retire des événements de la chronologie RETEX sans le droit « supprimer »

- Gravité : bloquant (suppression hors des droits documentés du rôle ; trace de preuve perdue)
- Écran : RETEX et chronologie (`/pilotage/incidents-retex`)
- Référence : ISO/IEC 27001:2022, A.5.27, A.5.28, 7.5.3 ; rôle Contributeur « Lire et modifier » (`permissions.ts`)
- Observé : connecté `test7-contrib`, RETEX de INC-2026-001 : `button "Retirer"` × 9 (un par événement, noms identiques).
  Sans toucher aux données de la phase 1 : événement créé sur l’incident de test INC-2026-004
  (`POST /api/incidents/INC-2026-004/retex` → 201), puis `DELETE /api/incidents/INC-2026-004/retex/EV-001` → **200**.
  Journal (`GET /api/admin/audit`) : `"username":"test7-contrib","action":"incident.retex-deleted","details":{"version":104}`,
  sans le contenu retiré. La route est déclarée `incidents:modifier`
  (`apps/api/src/routes/historique/incidents.ts`), alors que les suppressions voisines exigent `incidents:supprimer`
  (`DELETE /api/incidents/:id`, échéances de cellule, contacts, actions de scénario : 403 pour ce compte). Le compte limité à
  HDS a le même pouvoir sur les RETEX du racine.
- Attendu : retrait d’un événement réservé au droit `incidents:supprimer` (ou retrait logique avec motif), contenu retiré
  conservé au journal.
- Reproductible par : à écrire (contributeur : `DELETE …/retex/:eid` → 403 attendu).

### T5-03 — Le module « Incidents et PCA/PRA » n’ouvre pas les PCA/PRA

- Gravité : majeur (moindre privilège impossible pour un auditeur de la continuité)
- Écrans : Continuité et reprise, Exercices et RETEX
- Référence : A.5.15, A.5.18, A.5.29, A.5.30 ; rôle Auditeur externe « lecture seule des modules choisis »
- Observé : `test7-auditeur` modifié par l’écran Utilisateurs avec les seuls modules « Incidents et PCA/PRA » et
  « Documents et liens ». `GET /api/grc/<racine>/objects?kind=continuity_plan` → 403 `"Droit requis : pilotage:lire"` ;
  `GET /api/plans` → 403 ; écrans Continuité et Exercices : « Vous ne disposez pas du droit de consulter cette rubrique. »
  Les plans de continuité et les exercices relèvent du module `pilotage` (`packages/shared/src/grc.ts`). Pour les montrer
  il faut ouvrir « Pilotage du SMSI » en entier (contexte, risques, objectifs, revues…). Modules remis ensuite à trois.
- Attendu : le module qui s’intitule « PCA/PRA » donne accès aux plans et exercices, ou le libellé dit exactement ce qu’il
  ouvre, et l’écran de création de compte le signale.
- Reproductible par : à écrire.

### T5-04 — Accès au périmètre : choisir de nouveau « Lecture et écriture » donne « Lecture seule »

- Gravité : mineur (écran de la tranche 1, signalé ici car il fixe les droits ; même famille que C5-17)
- Écran : Périmètres › Accès au périmètre Hébergement HDS
- Observé : `pilote choisir "Accès au périmètre" "Lecture et écriture selon les droits métier"` deux fois de suite →
  `combobox "Accès au périmètre": Lecture seule`. En attribuant l’accès à quatre comptes à la suite, `test7-contrib` a
  reçu « Contributeur test7 (fictif) · Lecture » au lieu d’écriture, sans message ; corrigé ensuite.
- Attendu : choisir l’option déjà sélectionnée ne change rien.
- Reproductible par : à écrire (sélection répétée, lecture du combobox).

### T5-05 — Téléphone : filtres, boutons et champs coupés sur quatre écrans

- Gravité : mineur
- Écrans : Registre des incidents, Qualifier un signalement, Scénarios et check-lists, fiche d’un document
- Observé (390 × 844, compte `rssi`, captures `t5-tel-*.png` relues) : aucune page ne défile horizontalement, mais
  - Registre des incidents : filtres « Ouverts … Demandes, Tous » dans une zone `overflow-x:hidden` (561 px pour 362) :
    « Événements d… » coupé, « Demandes » et « Tous » hors écran, donc inaccessibles au doigt ;
  - Qualifier un signalement : deux colonnes conservées, bouton « Créer la fiche dans le reg… » tronqué ;
  - Scénarios et check-lists : éditeur sur une demi-largeur, champs d’action réduits à « Is », « A », « Re » ;
  - fiche du document : empreinte SHA-256 non coupée, barre de défilement horizontale dans la fiche.
- Attendu : une colonne au téléphone, filtres repliés ou défilants, textes longs coupés.
- Reproductible par : à écrire (mesure du débordement à 390 px).

### T5-06 — Import et rapports : page vide sans explication pour un compte sans droit d’import

- Gravité : mineur
- Écran : `/pilotage/imports`
- Observé : contributeur, lecteur, auditeur externe, compte restreint : `heading "Import et rapports"`, sélecteur de
  périmètre, puis rien (aucun bouton, aucun message). Le lien est absent du menu, mais la route directe s’ouvre. L’écran
  voisin `/exports` dit « Vous ne disposez pas du droit d’exporter les données. »
- Attendu : même message de refus que les exports.
- Reproductible par : à écrire.

### T5-07 — Un auditeur externe peut être invité à écrire dans un RETEX

- Gravité : mineur (délégation voulue par l’ADR 0080, mais contraire au rôle « lecture seule »)
- Écran : RETEX et chronologie (invitation) ; `/retex/:incident`
- Observé : `GET /api/retex/candidats` (rssi) liste « Auditeur externe test7 (fictif) ». Invité sur l’incident de test
  INC-2026-004, `POST /api/retex/INC-2026-004/propositions` avec sa session → **201** (proposition `PR-001` en attente,
  supprimée avec l’incident de test). Rien n’avertit le pilote qu’il invite un compte externe à durée limitée.
- Attendu : comptes auditeur externe exclus des candidats, ou signalés et invitables seulement par choix explicite.
- Reproductible par : à écrire.

### T5-08 — Remarques d’accessibilité

- Gravité : remarque
- Observé : `/retex` sans titre de niveau 1 (`heading "Mes contributions RETEX" [level=2]`) ; boutons « Retirer » et
  « Modifier » de la chronologie sans nom distinctif ; pastilles des listes « Rôles » et « Modules ouverts » sans bouton de
  retrait accessible ; Échap dans la liste « Rôles » ferme la fenêtre « Nouveau compte » et perd la saisie ; boutons de
  fermeture sans nom (déjà C5-27).

### T5-09 — Remarques diverses

- Gravité : remarque
- Observé : auditeur sans « Pilotage du SMSI » sur le Registre des incidents : `403 GET /api/grc/<racine>/methods` relevé
  pendant le chargement ; menu « Conformité et audits » et « Actions » affichés sans les modules correspondants (écrans
  d’autres tranches). Date d’expiration enregistrée `2026-12-31T23:59:59.000Z` (soit 01/01/2027 00:59 à Paris). Un compte
  expiré dont on reporte la date reste « Désactivé » jusqu’à réactivation manuelle, sans que l’écran le dise.
  `POST /api/crise/contacts` et `POST /api/crise/scenarios` ignorent le nom envoyé (contact vide, « Nouveau scénario »).

## Défauts connus reconfirmés

| Défaut | Constat dans ce passage |
|---|---|
| C5-06 | Reconfirmé pour tous les rôles : incidents, RETEX, cellules, contacts, scénarios identiques sous les deux périmètres ; aggrave T5-01 |
| C5-04 | Un PL-EXO créé « depuis HDS » apparaît sous le racine |
| C5-01 | Mur : « 1 plans de continuité et de reprise (PCRA) » alors que des PCA de test existaient |
| C5-25 | Échéance du 30/11 vue le 12/11 : « J-19 » pour 18 jours |
| C5-27 | Boutons de fermeture sans nom |

## Écritures faites pendant le passage

- Comptes `test7-*` (cinq) et leurs adhésions au sous-périmètre HDS ; modules de l’auditeur modifiés puis rétablis ; date
  d’expiration passée au 11/11/2026 puis rétablie au 31/12/2026 et compte réactivé.
- Fiches de test créées par `test7-contrib` et `test7-hds`, puis retirées par `rssi` : deux plans et trois exercices
  « test7 » (archivés), INC-2026-004 et INC-2026-005 (supprimés ; RETEX ouvert, invitations et proposition de l’auditeur
  disparus avec eux), PL-EXO-002 et PL-EXO-003, deux scénarios « Nouveau scénario », deux contacts vides, deux liens.
  Le compteur des incidents réattribuera INC-2026-004 (C5-09).
- Aucune donnée de la phase 1 modifiée : empreinte avant et après identique pour les incidents, la crise, les plans, les
  documents, les liens et les fiches de continuité des deux périmètres.

## Outillage (pas l’application)

Scripts du bloc-notes (`t5-*.mjs`, hors dépôt) : création et préparation des comptes, changement de compte du Chrome par
l’API de connexion, sessions API séparées par compte, tour des écrans, passage au téléphone. Le pilote ne sait ni choisir
dans une liste multiple Mantine, ni cliquer le n-ième bouton homonyme (« Modifier » des comptes), ni envoyer `If-Match`.
L’attente `networkidle` ne se termine jamais (flux temps réel) : à proscrire dans les scripts.
