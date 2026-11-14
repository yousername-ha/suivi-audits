# Constats de l’agent 7, tranche 4 : écarts, actions, plans annuels, revue de direction, registres (passage transversal)

| Élément | Valeur |
|---|---|
| Commit testé | `2171449` (branche `claude/recette-rssi-2026-11-12`) au début ; la branche est passée à `f5ebb35` pendant le passage (commits de documentation de la campagne, aucun changement de l’application) |
| Date | 12/11/2026, 22:00 à 22:40 (Europe/Paris) |
| Pile | `https://127.0.0.14`, pile Docker n° 4, installée et remplie par l’agent 4 en phase 1 (`GET /api/version` : `local`, migration `054_retrait_revues_acces.sql`) ; pile laissée en marche |
| Périmètres | principal « SMSI Groupement Santé Fictif » (« Toute l’organisation ») ; sous-périmètre « Hébergement HDS » (« Membres seulement ») |
| Données | jeu fictif uniquement ; données de la phase 1 inchangées (voir « Écritures faites pendant le passage ») |
| Matrice | `agent-7-tranche-4.csv` : 100 cases, **60 ok, 40 défaut, 0 sans objet, 0 non testée** |

## Comptes créés (par le compte `rssi`, écran Plateforme › Utilisateurs)

Mot de passe provisoire affiché une fois, puis enrôlement TOTP et mot de passe personnel. Identifiants et secrets dans
`tests/e2e/rssi-virtuel/.pilote-4/comptes.json` (ignoré par Git) ; aucun secret ici.

| Rôle de la matrice | Compte | Rôle attribué | Accès au sous-périmètre HDS (Périmètres › Accès) |
|---|---|---|---|
| administrateur | `test7-admin` | Administrateur | aucun (l’administrateur voit tout) |
| contributeur | `test7-contrib` | Contributeur | Lecture et écriture |
| lecteur | `test7-lecteur` | Lecteur | Lecture seule |
| auditeur_externe | `test7-auditeur` | Auditeur externe, modules « Écarts et actions » et « Pilotage du SMSI », expiration 31/12/2026 | Lecture seule |
| restreint | `test7-restreint` | Contributeur | Lecture et écriture (seul accès qu’on puisse lui limiter, voir T4-01) |

Les cinq créations sont possibles par l’interface. La liste « Modules ouverts à l’auditeur externe », vide, n’a pas pu être
ouverte par le pilote (champ masqué tant qu’il est vide) : sélection faite par un script relié au même Chrome ; à
vérifier au clavier par l’agent 6.

## Méthode

- Chaque compte connecté par l’écran de connexion (mot de passe puis TOTP), dans le Chrome du pilote.
- Chaque écran ouvert sous `?perimetre=<principal>` puis `?perimetre=<HDS>` ; arbre d’accessibilité relevé (boutons,
  champs, alertes).
- Écritures rejouées avec la session du compte (`fetch` dans la page : CSRF, origine et `If-Match`), sur des objets de
  test « test7 » ou construites pour échouer sans effet si le droit était accordé (version périmée, justificatif absent).
- Téléphone : compte `rssi`, 390 × 844, captures relues et mesure de `scrollWidth` de la page et des éléments hors écran.
- Sources des droits attendus : [ADR 0010](../../../adr/0010-droits-rbac.md) (rôles prédéfinis, auditeur externe à
  portée et expiration, « un Contributeur ne peut plus supprimer », l’interface masque ce qui n’est pas permis),
  `packages/shared/src/permissions.ts` (permissions des rôles), [ADR 0068](../../../adr/0068-suppressions-reservees-au-droit-supprimer.md)
  (suppression réservée à `supprimer`, boutons masqués), [ADR 0043](../../../adr/0043-registres-perimetres-herites-et-droits-par-ressource.md)
  (registres : seul le gestionnaire « modifie, archive et attribue »), [ADR 0039](../../../adr/0039-hierarchie-des-perimetres.md)
  (« Rien d’autre » n’est hérité : ni droits ni membres), DAT (§ lecture entre modules, périmètre).
- Aucune erreur JavaScript, CSP ni HTTP 5xx au journal du pilote pendant le passage (533 commandes) ; seules erreurs : les
  401/403/422 provoqués.

## Ce qui est conforme (vérifié)

- **Lecteur** : aucun bouton d’ajout, de validation ni d’export sur les neuf écrans du Pilotage ; fiches désactivées.
  API : `POST` écart `403 Droit requis : ecarts:modifier` ; `POST` action HDS `403 Votre accès à ce périmètre est en
  lecture seule.` ; `PUT` écart, archivage d’action, contribution, validation d’occurrence `403 Votre accès à ce registre
  ne permet pas cette opération.` ; `POST`/`PATCH`/`DELETE /api/plans`, décalage `403` ; création de revue `403
  pilotage:modifier` ; validation de revue `403` ; exports `403`.
- **Auditeur externe** : permissions effectives `ecarts:lire`, `pilotage:lire` seulement ; mêmes refus que le lecteur
  (14 essais, tous `403`) ; la recherche de références (`/sources`) ne propose pas les mesures du module Audit non ouvert ;
  `GET …/objects?kind=measure` → `403 Droit requis : audit:lire`. **Expiration** : date passée au 11/11/2026 par
  l’administrateur → connexion refusée dès le mot de passe (« Identifiant ou mot de passe incorrect, ou compte
  temporairement verrouillé… »), compte passé « désactivé » automatiquement ; date remise au 31/12/2026 et compte réactivé
  ensuite.
- **Contributeur** : crée écarts, actions, actions de plan, registres ; ne voit ni « Archiver la fiche », ni
  « Supprimer » de plan, ni « Valider » de revue, ni exports. API : archivage d’écart et d’action `403`, `DELETE
  /api/plans/PL-FOR-003` `403 … supprimer dans « Pilotage du SMSI »`, validation de revue `403 Droit requis :
  pilotage:administrer`, exports `403`.
- **Administrateur** : tout visible sous les deux périmètres sans appartenance à HDS ; exports `200` ; validation `200` ;
  archivage des fiches de test `200` ; suppression de PL-FOR-003 confirmée à l’écran.
- **Sous-périmètre** : sans appartenance, HDS n’est pas lisible (périmètre « Membres seulement ») ; l’accès « Lecture
  seule » interdit l’écriture même à un rôle qui a `modifier`.
- **Journal d’audit** : création, modification, archivage de registre et connexion des comptes test7 tracés avec leur
  auteur (`grc.object.updated`, `registre.archived`, `plan.created`…).
- **Téléphone** : aucun défilement horizontal de page sur les dix écrans (largeur de page = largeur utile) ; tableaux dans
  des zones défilantes nommées (« Tableau, défilement horizontal possible », « Registres accessibles, … »).

## Constats

### T4-01 — Aucun compte ne peut être limité au sous-périmètre : le périmètre principal reste lisible et modifiable

- Gravité : majeur
- Écrans : les dix écrans de la tranche (cases `restreint`)
- Référence : ISO/IEC 27001:2022 A.5.15, A.5.18, A.8.3 ; HDS (séparation des activités d’hébergement) ; ADR 0039 (droits
  et membres non hérités) ; consigne de la campagne (« le contributeur restreint ne doit rien voir ni écrire hors du
  sous-périmètre »)
- Observé : `GET /api/grc/smsis` → principal `"visibility":"instance"`, HDS `"visibility":"restricted"`. Périmètres (vue
  Liste) : « Gérer l’accès au périmètre Hébergement HDS » existe, aucun bouton « Accès » pour « SMSI Groupement Santé
  Fictif » ; la fiche « Modifier le périmètre » n’a pas de réglage de visibilité. Avec `test7-restreint` (Contributeur,
  membre d’HDS seulement) : les dix écrans sous le principal affichent les données du groupement avec « Ajouter un
  constat », « Ajouter une action », « Ajouter » (plans), « Préparer une revue avec ces entrées » ;
  `PUT /api/grc/<principal>/objects/<écart test7>` (description modifiée) → `HTTP 200 ETag "2"`, journal
  `grc.object.updated` par `test7-restreint` ; `GET /api/plans` → `200` (plans du groupement entier).
- Attendu : pouvoir donner à un compte (prestataire d’infogérance, équipe d’hébergement) l’accès au seul périmètre HDS :
  périmètre racine restreignable, ou accès par périmètre indépendant de la visibilité.
- Remarque : l’écriture se fait dans les droits techniques du compte (rôle Contributeur sur un périmètre « Toute
  l’organisation ») ; c’est l’absence de réglage qui fait défaut. À arbitrer par le RSSI : bloquant si la séparation HDS
  doit être portée par l’outil.
- Reproductible par : à écrire (compte contributeur membre d’HDS seulement, `PUT` d’un objet du principal attendu `403` ou `404`).

### T4-02 — Un contributeur archive un registre (plan d’actions) qu’il n’a pas créé, sans rôle de gestionnaire

- Gravité : bloquant
- Écran : `/registres/:id` (onglet « Paramètres »), sous les deux périmètres
- Référence : ADR 0043, point 4 (« gestionnaire : modifie, crée dans le registre, archive ») ; ADR 0010 et ADR 0068 (un
  Contributeur ne supprime pas ; boutons de suppression masqués sans `supprimer`) ; ISO/IEC 27001:2022 7.5.3, 6.1.3
- Observé : registres de test créés par l’administrateur (« test7 plan créé par l’administrateur (fictif) », principal ;
  « test7 registre d’écarts HDS de l’administrateur (fictif) », HDS). Connecté `test7-contrib` : onglet « Paramètres » →
  boutons « Enregistrer » et « Archiver le registre » ; `cliquer button "Archiver le registre"` puis « Confirmer » →
  registre archivé (`GET /api/registres?archives=true` : `archivé`, `rôle: None`) ; même essai par l’API
  `POST /api/registres/9567d480…/archivage` (`If-Match: "1"`) → `HTTP 200 … "archived":true`. Journal : `registre.archived`
  par `test7-contrib`. Pour comparaison, le même compte reçoit `403 « Votre accès à ce registre ne permet pas cette
  opération. »` en archivant une seule action ou un seul écart. Aucune commande de désarchivage n’existe dans l’interface
  ni dans l’API.
- Cause probable (lecture du code, à confirmer par la session de développement) : `archive()` exige `gerer`, que
  `parModule` accorde avec le droit `modifier` du module quand tous les périmètres sont accessibles en écriture.
- Attendu : archivage d’un registre réservé à son gestionnaire, à l’administrateur ou au droit `ecarts:supprimer` (ou
  `administrer`) ; bouton masqué sinon.
- Modifié pendant l’essai : trois registres de test « test7 » archivés (aucune donnée de la phase 1).
- Reproductible par : à écrire (registre créé par l’administrateur, `POST /api/registres/:id/archivage` par un
  contributeur attendu `403`).

### T4-03 — Un contributeur modifie les décisions d’une revue de direction validée, que seul un administrateur du pilotage peut valider

- Gravité : majeur
- Écran : Revues de direction (principal)
- Référence : ISO/IEC 27001:2022 9.3.3 (décisions de la direction conservées), 7.5.3 ; ADR 0010 ; constat C4-06 de la
  phase 1 (immuabilité à confirmer par le RSSI)
- Observé : revue de test « test7 revue de droits (fictive) » validée par `test7-admin` (décision `approval` acceptée,
  `HTTP 200`, état `validated`). Connecté `test7-contrib` : pas de bouton « Valider » (validation par l’API → `403 Droit
  requis : pilotage:administrer`), mais « Ouvrir » donne une fiche entièrement modifiable avec l’alerte « Une
  modification demande une nouvelle vérification. » ; `remplir "Décisions et moyens" …` puis « Enregistrer » → revue en
  version 3, `statut draft`, `updatedBy: test7-contrib`, décisions remplacées. La validation de la direction est
  défaite par un compte qui n’a pas le droit de la donner.
- Attendu : une revue validée en lecture seule pour qui n’a pas `pilotage:administrer` (ou modification réservée au
  valideur), la version validée restant la référence.
- Modifié pendant l’essai : la revue de test seulement, archivée ensuite par l’administrateur ; la revue 2026 de la phase
  1 n’a pas été touchée.
- Reproductible par : à écrire.

### T4-04 — « Nouveau registre » proposé au lecteur et à l’auditeur externe

- Gravité : mineur
- Écran : `/registres` (les deux périmètres)
- Référence : ADR 0010 (« L’interface masque ou désactive ce qui n’est pas permis ») ; ADR 0068, point 5
- Observé : connecté `test7-lecteur` puis `test7-auditeur` : `button "Nouveau registre"` présent ; formulaire rempli puis
  « Créer » → alerte « Erreur Droit requis : ecarts:modifier » (`HTTP 403 /api/registres`). Le refus serveur est correct.
- Attendu : bouton masqué sans `ecarts:modifier` ; à défaut, message en français sans clé technique.
- Reproductible par : à écrire.

### T4-05 — Téléphone : libellés coupés sur Tâches récurrentes et sur les plans annuels

- Gravité : mineur
- Écrans : Tâches récurrentes, Calendrier des plans, Planning annuel des plans (390 × 844, compte `rssi`)
- Référence : ergonomie, accessibilité (WCAG 1.4.10 redistribution)
- Observé : capture `t4-tel-recurrences.png` : dans « Séries proposées (ISO 9001:2015) », les huit boutons « Préparer la
  série » sont coupés (« Préparer l », « Prépar », « Prépare ») ; mesure : `scrollWidth > clientWidth` sur les huit
  libellés. Calendrier : trois intitulés d’actions tronqués dans la grille, mois de mai à décembre hors écran dans la zone
  défilante. Planning : diagramme SVG de 840 px dans une zone défilante de 347 px sans nom accessible ni barre visible,
  intitulés des actions superposés aux colonnes de mois (capture `t4-tel-plans-planning.png`). Aucune page ne défile
  horizontalement.
- Attendu : boutons qui passent à la ligne, zone du planning nommée et signalée comme les tableaux.
- Reproductible par : à écrire (mesure des libellés à 390 px).

### T4-06 — Messages de refus hétérogènes, avec la clé de permission

- Gravité : remarque
- Observé : plans : « Droits insuffisants : vous ne pouvez pas supprimer dans « Pilotage du SMSI ». » ; ailleurs « Droit
  requis : pilotage:administrer », « Droit requis : ecarts:modifier », « Droit requis : import_export:exporter ». L’export
  « Exporter le registre et ses décisions » exige `import_export:exporter` et non `ecarts:exporter` ou
  `pilotage:exporter` (l’export docx de revue exige `pilotage:exporter`) : un rôle personnalisé « export des écarts » ne
  pourrait pas exporter le registre des écarts.
- Attendu : un seul message en français, nommant le module et l’action ; permission d’export cohérente par module.

### T4-07 — Séries proposées « ISO 9001:2015 » dans un SMSI ISO/IEC 27001

- Gravité : remarque (même famille que BUG-031)
- Écran : Tâches récurrentes, sous les deux périmètres
- Observé : carte « Séries proposées (ISO 9001:2015) » : « Satisfaction… », « Étalonnage ou vérification des équipements
  de mesure (7.1.5.2) », « Réévaluation des prestataires externes (8.4.1) ».
- Attendu : séries tirées du référentiel du périmètre (ISO/IEC 27001 : 9.2, 9.3, 9.1, 6.1.2/8.2, A.5.22…).

## Défauts connus reconfirmés sous d’autres rôles

| Défaut | Résultat | Observé |
|---|---|---|
| C4-02 | reconfirmé pour tous les rôles | sous HDS, le contributeur, le lecteur, l’auditeur externe et l’administrateur voient PL-FOR-001/002/003, PL-AUD-001, PL-SEN-001 (mêmes listes sous les deux périmètres) ; `GET /api/plans` sans périmètre. Pas de lecture hors droits pour ces comptes (le principal leur est ouvert) ; pour le compte limité, voir T4-01 |
| C4-05 | reconfirmé pour tous les rôles | sous HDS, pas de bandeau « Préparer la prochaine revue » ni d’entrées 9.3.2, quel que soit le rôle |
| C4-06 | aggravé (T4-03) | la remise en brouillon d’une revue validée est accessible au contributeur |
| C4-10 | reconfirmé au téléphone | trois cartes « Échéance SMSI » identiques sans intitulé ni date |
| C4-12 | reconfirmé | « Tâches récurrentes » liste aussi les actions ordinaires ; boutons de fermeture sans nom (« Nouveau compte », « Nouveau registre », « Confirmation », fiche de plan) |
| BUG-035 | vu au téléphone | Amélioration continue : « Actions 5 ouvertes · 2 closes · 2 en retard » |

## Signalé aux autres tranches (non vérifié ici)

- Agent 6 : la date d’expiration du compte est un champ natif affiché « mm/dd/yyyy » dans un Chrome anglais ; le choix
  « Accès au périmètre » d’« Accès au périmètre HDS » repasse à « Lecture seule » si l’on rechoisit la valeur déjà
  affichée (le contributeur limité a d’abord reçu « Lecture ») ; la déconnexion déclenche six requêtes en 401.
- Agent 5 : l’auditeur externe sans module Documents voit le lien « Documents » ; l’écran affiche l’erreur « Droits
  insuffisants : vous ne pouvez pas consulter dans « Documents et liens ». » (3 requêtes 403).
- Agents 2 et 3 : l’auditeur externe limité à « Écarts et actions » et « Pilotage du SMSI » lit le registre des risques
  (le type `risk` relève du module Pilotage) et voit les menus « Risques », « Conformité et audits », « Résilience » :
  conforme au découpage des modules, à confirmer par le RSSI.

## Écritures faites pendant le passage

Objets de test seulement, tous préfixés « test7 » : écart (principal, modifié par `test7-restreint`, archivé), action HDS
(archivée), action de plan PL-FOR-003 (supprimée), revue de direction de test (validée, modifiée, archivée), trois
registres de test (archivés, sans commande de désarchivage). Comptes test7 et accès à HDS ajoutés ; `test7-auditeur`
réactivé, expiration au 31/12/2026. Aucune donnée de la phase 1 modifiée : toutes les tentatives d’écriture sur ces
données ont été refusées (`403`).

## Outillage

Scripts du bloc-notes (hors dépôt) : `t4-preparer.mjs` (mot de passe provisoire lu dans la fenêtre sans être affiché,
enrôlement TOTP, mot de passe personnel), `t4-connexion.sh`, `t4-survol.sh`, `t4-api.mjs` (appel depuis la page avec
`If-Match`), `t4-ecritures.sh` (14 écritures rejouées par compte), `t4-tel.mjs` (mesure au téléphone), `t4-cdp.mjs`.
Le pilote est laissé connecté avec le compte `rssi`.
