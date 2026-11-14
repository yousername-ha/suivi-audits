# Constats de l’agent 7, tranche 3 : rôles, périmètres et téléphone sur la conformité, la DdA, les audits, les preuves et les contrôles

| Élément | Valeur |
|---|---|
| Commit testé | `2171449` au début du passage (branche `claude/recette-rssi-2026-11-12`), `f5ebb35` à la fin (sauvegarde intermédiaire de la campagne, `docs/` seulement). Pile construite pendant la phase 1, aucune différence dans `apps/` ni `packages/` depuis |
| Date | 12/11/2026, 21:05 à 22:45 (Europe/Paris) |
| Pile | `https://127.0.0.13`, pile Docker éphémère n° 3, remplie par l’agent 3 de la phase 1 (aucune réinstallation, aucune opération d’exploitation) |
| Périmètres | principal « SMSI Groupement Santé Fictif » (visibilité `instance`) ; sous-périmètre « Hébergement HDS » (visibilité `restricted`, rattaché au principal) |
| Matrice | tranche 3 : 210 cases, **146 ok, 64 défaut, 0 sans objet, 0 non testée** (`matrice.mjs bilan`, ligne agent 7 : 146 / 64 / 0 pour cette tranche) |

## Comptes créés (aucun secret ici ; TOTP dans `.pilote-3/comptes.json`, ignoré par Git)

| Compte | Rôle de la matrice | Création | Accès au sous-périmètre (« Configuration du pilotage », « Accès au périmètre existant ») |
|---|---|---|---|
| `rssi` (existant) | `rssi` | installation (rôle Administrateur) | administrateur |
| `test7-admin` | `administrateur` | Plateforme > Utilisateurs > « Nouveau compte », rôle Administrateur | administrateur (voit tous les périmètres) |
| `test7-contributeur` | `contributeur` | rôle Contributeur | Écriture |
| `test7-lecteur` | `lecteur` | rôle Lecteur | Lecture |
| `test7-auditeur` | `auditeur_externe` | rôle Auditeur externe, modules Audit, Plan d’audit, Pilotage du SMSI, Conformité, Documents et liens, expiration 31/12/2026 | Lecture |
| `test7-restreint` | `restreint` | rôle Contributeur | Écriture sur « Hébergement HDS » seulement (le principal ne peut pas être restreint : T3-01) |

Chaque compte a été préparé comme un utilisateur réel (mot de passe provisoire affiché une fois, enrôlement TOTP, mot de passe
personnel), dans un contexte séparé du même Chrome. Tous les comptes ont pu être créés par l’interface ; seul le « contributeur
limité au sous-périmètre » ne peut pas l’être réellement (T3-01).

## Méthode

- **Ce que le rôle voit** : les 21 écrans de la tranche ouverts avec chaque compte, sous le principal puis sous « Hébergement
  HDS » (`?perimetre=<id>`), soit 252 chargements ; pour chacun, arbre d’accessibilité de `main`, contrôles désactivés, appels
  d’API et erreurs de la page, puis comparaison contrôle par contrôle avec le compte `rssi`. **Aucune erreur JavaScript, CSP ni
  HTTP 4xx/5xx** sur les 252 chargements.
- **Ce que l’API refuse** : rejeu, avec la session de chaque compte, des écritures que font les écrans, sous une forme sans
  effet quand elle est acceptée : `PUT /api/grc/:smsi/objects/:id` et `DELETE` avec `If-Match: "999"` (403 si le droit manque,
  412 s’il passe) ; corps invalide sur les routes à droit déclaré (403 avant 422) ; identifiants inexistants sur les routes à
  contrôle interne (403 avant 404). Les créations réelles (`POST /objects`, `POST /api/gap`, `POST /api/grc/smsis`) n’ont été
  jouées qu’avec le lecteur et l’auditeur, qui devaient être refusés : **toutes refusées, rien n’a été écrit**.
- **Attentes citées** : [ADR 0010](../../../adr/0010-droits-rbac.md) (rôles prédéfinis, auditeur externe à modules choisis et
  expiration obligatoire, « l’interface masque ou désactive ce qui n’est pas permis ») ; `packages/shared/src/permissions.ts`
  (liste unique : le Contributeur lit et modifie sans supprimer ni exporter, le Lecteur lit, l’Auditeur lit ses modules) ;
  [ADR 0039](../../../adr/0039-hierarchie-des-perimetres.md) (le périmètre est l’unité de partitionnement des droits) ;
  [ADR 0043](../../../adr/0043-registres-perimetres-herites-et-droits-par-ressource.md) (404 uniforme sans lecture, 403 avec lecture
  sans droit) ; [DAT](../../../03_ARCHITECTURE/DAT.md) (porte de lecture : droit de module, périmètre, rôle) ;
  [inventaire](../../../02_FONCTIONNALITES/INVENTAIRE_FONCTIONNEL.md) FCT-002.
- **Téléphone** : chaque écran ouvert par `rssi` en 390 × 844 (largeur utile 375 px), largeur de la page et éléments hors écran
  mesurés, capture pleine page relue (`.pilote-3/captures/t7-tel-*.png`, `t7-zoom-*.png`).

## Ce qui est conforme (vérifié)

| Rôle | Écran | API |
|---|---|---|
| Administrateur | identique au `rssi` sur les 42 écrans × périmètres (aucune différence de contrôle) | écritures acceptées (412 / 422 / 404 selon la sonde), export du registre 200 |
| Contributeur | lecture et modification comme le `rssi` ; absents : « Supprimer ce jour », « Retirer » (plan d’audit), « Promouvoir dans la bibliothèque », « Exporter le registre et ses décisions », « Télécharger le rapport imprimable » (preuves, contrôles) ; menu « Autres actions » : « Décisions et réalisations » seulement | `PUT` fiches 412 (droit accordé) ; `DELETE` 403 « Droit requis : audit:supprimer » (et `documents`, `pilotage`, `plan_audit`, `conformite`) ; `DELETE /api/audit-suivi/plan/personnes/…` et `/api/gap/…` 403 ; validation des correspondances 403 `conformite:administrer` ; statut des rattachements 403 `pilotage:administrer` ; export 403 `import_export:exporter` |
| Lecteur | boutons d’ajout absents (mesure, preuve, contrôle, audit, référentiel, GAP, correspondance) ; DdA, plan d’audit, pastilles de la couverture du cycle et fenêtre « Cycle d’audit » désactivées ; fiches ouvertes : champs désactivés, seulement « Fermer » ; « Créer le service » désactivé avec « Le droit de modifier la conformité est nécessaire pour analyser un service. » | toutes les écritures 403 : fiches du principal « Droit requis : audit:modifier » (etc.), fiches du sous-périmètre « Votre accès à ce périmètre est en lecture seule. », `PATCH /api/dda/A-5.1` « Droits insuffisants : vous ne pouvez pas créer ou modifier dans « Audit (référentiels et couverture) » », créations 403 |
| Auditeur externe | même vue que le lecteur sur ses 5 modules ; « Amélioration continue » : « Vous ne disposez pas du droit de consulter cette rubrique. » | écritures 403 comme le lecteur ; `GET /api/grc/:smsi/objects?kind=nonconformity` et `kind=incident` 403, `/api/suppliers` 403, `/api/grc/:smsi/members` 403 ; export 403 ; périmètres non attribués (« Sauvegarde externalisée… ») 404 |
| Auditeur, expiration | Plateforme > Utilisateurs > « Modifier test7-auditeur », date 11/11/2026 : « Compte modifié. Ses sessions ont été fermées si ses droits ont changé. », ligne « expiré 2026-11-11 » | connexion suivante : `POST /api/auth/login` 401 (message générique, sans fuite) ; date remise au 31/12/2026, compte de nouveau utilisable |
| Tous | périmètres restreints non attribués : `GET /api/grc/455027dc-…/objects` 404 « Périmètre introuvable ou non accessible. » | |

Écrans au téléphone sans défaut (pas de défilement horizontal de la page, rien de coupé hors zones défilantes) : carte du
prochain audit, couverture du cycle, déroulé, planning, audits internes, référentiels et exigences, bibliothèque,
applicabilité, mesures, correspondances, rapprochements, couverture par référentiel, analyser un service, applications à
intégrer, correspondances de la bibliothèque, preuves, plan de contrôle.

## Synthèse

| Gravité | Nombre | Constats |
|---|---|---|
| Bloquant | 1 | T3-01 |
| Majeur | 1 | T3-03 |
| Mineur | 3 | T3-02, T3-04, T3-06 |
| Remarque | 2 | T3-05, T3-07 |

## Constats

### T3-01 — Un contributeur ne peut pas être limité au sous-périmètre : il voit et modifie le périmètre principal

- Gravité : bloquant (règle de la campagne : écriture hors du périmètre attribué)
- Écrans : les 21 écrans de la tranche (cases `restreint`)
- Référence : ISO/IEC 27001:2022, A.5.15, A.5.18 et A.8.3 (moindre privilège) ; HDS v2 (cloisonnement des activités
  d’hébergement) ; ADR 0039 point 1 (« le périmètre reste l’unité de partitionnement des droits »)
- Observé : `test7-restreint` (Contributeur) n’a reçu l’accès « Lecture et écriture selon les droits métier » que sur
  « Hébergement HDS ». `GET /api/grc/smsis` avec sa session : `200 SMSI Groupement Santé Fictif ; Hébergement HDS`. Sous le
  principal, ses 21 écrans sont identiques à ceux de `test7-contributeur` (même liste de contrôles actifs). Sondes :
  `PUT /api/grc/00000000-…-0001/objects/2b384f3a-…` (mesure du principal) avec `If-Match: "999"` → `HTTP 412 {"error":"La
  fiche a changé. Rechargez avant de confirmer."}` (le droit d’écrire est accordé, seule la version bloque) ; même résultat
  sur la preuve, le contrôle, l’audit et le référentiel du principal ; `PATCH /api/dda/A-5.1 {}` → `HTTP 200` (DdA de
  l’organisation, sans périmètre, voir C3-01) ; `PATCH /api/audit-suivi/cycle`, `/plan`, `/api/gap/APP01`,
  `POST /api/library/standards/adopt` → 422 (droit accordé). Cause : le principal a la visibilité `instance` ; la rubrique
  « Accès au périmètre existant » n’est pas proposée pour lui (`Pilotage.tsx` : `smsi !== '00000000-…-0001'`) et
  `SmsiUpdate` n’a pas de champ de visibilité : aucun écran ni aucune API ne permet de le restreindre. Seuls les autres
  périmètres restreints sont bien fermés (404).
- Attendu : un compte rattaché au seul sous-périmètre ne voit ni ne modifie le principal ni les données communes
  (DdA, cycle et plan d’audit, GAP, bibliothèque) ; ou, si le modèle l’exclut, une décision écrite (ADR) et un écran qui le
  dit à l’administrateur quand il attribue l’accès.
- Reproductible par : à écrire (compte contributeur membre du seul sous-périmètre, `PUT` d’une fiche du principal avec
  version périmée : 403 attendu, 412 obtenu).

### T3-02 — « Analyser un service » : le contributeur remplit l’assistant puis reçoit un refus technique

- Gravité : mineur
- Écran : Analyser un service (principal et sous-périmètre)
- Référence : ADR 0010 (« L’interface masque ou désactive ce qui n’est pas permis ») ; même famille que BUG-025 (message
  technique)
- Observé : avec `test7-contributeur`, `remplir "Nom du service"`, « Suivant », « Créer le service » (actif) : alerte
  « Erreur Droit requis : pilotage:administrer », `POST /api/grc/smsis` → `403`. L’écran n’exige que `conformite:modifier`
  (`AnalyserService.tsx`, `modifier = can('conformite', 'modifier')`) ; l’API exige `pilotage:administrer`
  (`createSmsi`). Le lecteur, lui, voit « Créer le service » désactivé avec une explication en français.
- Attendu : bouton désactivé avec la même explication que pour le lecteur (droit d’administrer le pilotage), message
  en français sans nom de permission technique.
- Reproductible par : à écrire.

### T3-03 — Au téléphone, la DdA n’affiche pas les décisions : valeurs d’applicabilité et de mise en œuvre invisibles

- Gravité : majeur (au téléphone, la DdA ne se lit pas sans repasser au bureau)
- Écrans : Clauses ISO 27001 (DdA), Annexe A (DdA), HDS (DdA), compte `rssi`, 390 × 844
- Référence : ISO/IEC 27001:2022, 6.1.3 d) (DdA lisible) ; consigne de la tranche (« rien de coupé »)
- Observé : `t3-zoom.mjs /pilotage/dda-annexe-a` : `Applicabilité de A.5.1=Oui (largeur 52)`, `Niveau de A.5.1=Total
  (largeur 42)` ; capture `t7-zoom-dda-a-ligne.png` : les deux listes de la ligne A.5.1 ne montrent que la croix
  d’effacement « × » et le chevron, ni « Oui » ni « Total ». Même chose pour 4.3 « Total » (clauses) et HDS 01 « Oui /
  Partiel » (`t7-tel-dda-iso.png`, `t7-tel-dda-hds.png`). La page elle-même ne déborde pas (375 px), le tableau défile dans
  sa zone.
- Attendu : la décision se lit au téléphone (valeur en clair, ou liste qui prend la largeur nécessaire).
- Reproductible par : à écrire (390 × 844 : la valeur de « Applicabilité de A.5.1 » est visible).

### T3-04 — Au téléphone, « Organisation : participants » tronque les noms et fonctions

- Gravité : mineur
- Écran : Organisation : participants, `rssi`, 390 × 844
- Observé : capture `t7-tel-audit-participants.png` : la ligne du participant montre « Pilot » et « P » dans les champs
  « Nom » et « Fonction » (texte complet « Pilote du processus infrastructure (fictif) »), le reste de la ligne est dans le
  tableau défilant.
- Attendu : nom et fonction lisibles (champs sur toute la largeur, ou carte par personne au téléphone).
- Reproductible par : à écrire.

### T3-05 — Au téléphone, l’onglet actif de la rubrique n’est pas visible

- Gravité : remarque
- Écrans : Correspondances entre exigences, Rapprochements, Couverture par référentiel, Analyser un service, Applications à
  intégrer, Correspondances de la bibliothèque (onglet « C… » coupé) ; Organisation : déroulé, planning, participants
  (« Organisat… »)
- Observé : barre d’onglets défilante, mais l’onglet de la page ouverte reste hors écran à l’ouverture (captures
  `t7-tel-correspondances.png`, `t7-tel-audit-deroule.png`).
- Attendu : onglet actif amené dans la partie visible.

### T3-06 — Carte du prochain audit : l’auditeur externe voit un pronostic différent, sans être prévenu

- Gravité : mineur
- Écran : Carte du prochain audit (principal et sous-périmètre), `test7-auditeur` (modules sans « Écarts et actions »)
- Référence : grille du RSSI (« un indicateur affiché doit se recalculer à partir des données ») ; ADR 0083 (porte de
  lecture)
- Observé : comparaison avec le lecteur et le `rssi` : `button "A.5.15 Contrôle d'accès. Certain, écart ouvert"` chez eux,
  `button "A.5.15 Contrôle d'accès. Très probable"` chez l’auditeur. Aucune fuite (l’écart n’est pas lisible), mais la légende
  et la case changent sans mention que les écarts ne sont pas pris en compte pour ce compte.
- Attendu : mention « écarts non visibles avec vos droits » (ou pronostic calculé sur les données complètes sans exposer
  l’écart), pour que l’auditeur ne se fonde pas sur une probabilité minorée.
- Reproductible par : à écrire.

### T3-07 — Remarques

- Gravité : remarque
- Expiration du compte d’auditeur : date choisie 31/12/2026, enregistrée `2026-12-31T23:59:59.000Z` (`/api/auth/me`), soit
  jusqu’au 01/01/2027 00:59:59 heure de Paris.
- Création de compte : la liste « Modules ouverts à l’auditeur externe (lecture seule) » n’est pas atteignable par son rôle
  tant qu’elle est vide (`cliquer combobox …` : élément non visible ; le clic sur le libellé l’ouvre) ; le bouton de
  fermeture de « Nouveau compte » n’a pas de nom (déjà relevé, C3-14).
- « Attribuer l’accès » (Configuration du pilotage) : aucun message de confirmation, la liste se met à jour seule.
- Hors tranche, vu avec l’auditeur : le menu affiche « Actions », « Résilience » et « Plateforme » pour des modules non
  ouverts ; « Registre des incidents » s’affiche vide sans message (« Amélioration continue » dit bien « Vous ne disposez pas
  du droit de consulter cette rubrique. »).
- « 1 fiches » (preuves, contrôles, audits internes).

## Défauts connus reconfirmés

| Défaut | Résultat | Observé |
|---|---|---|
| C3-01 | reconfirmé pour tous les rôles | sous « Hébergement HDS », carte du prochain audit, couverture du cycle, déroulé, planning, participants, DdA (3 écrans) et applications à intégrer affichent les données du principal pour l’administrateur, le contributeur, le lecteur et l’auditeur ; les droits y sont respectés. Conséquence aggravée avec T3-01 : une écriture « dans le sous-périmètre » modifie la DdA de l’organisation |
| C3-03, C3-13, C3-02, BUG-017 | non répétés en case | contenu identique à celui du `rssi` pour chaque rôle (défauts de domaine notés par l’agent 3 sur ses cases) |
| C3-14 | reconfirmé | bouton de fermeture sans nom (« Nouveau compte ») |

## État laissé

Aucune donnée de la phase 1 modifiée : toutes les sondes acceptées l’étaient sur une version périmée, un corps invalide, un
identifiant inexistant ou un corps vide (`PATCH /api/dda/A-5.1 {}` : champs conservés). Seule écriture : la date
d’expiration de `test7-auditeur` passée au 11/11/2026 puis remise au 31/12/2026. Comptes `test7-*` et leurs accès à
« Hébergement HDS » laissés en place pour la phase 3. Pile en marche.
