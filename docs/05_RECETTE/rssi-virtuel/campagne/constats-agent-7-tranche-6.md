# Constats de l'agent 7 (passage transversal), tranche 6 : installation, comptes, Plateforme, Système, paramètres

| Élément | Valeur |
| --- | --- |
| Campagne | Phase 2, tranche 6 ([CAMPAGNE-MULTI-AGENT.md](../CAMPAGNE-MULTI-AGENT.md), §5) |
| Commit du dépôt | `217144…` au début du passage, `c0bd393` à la fin (branche `claude/recette-rssi-2026-11-12`) ; images de la pile construites en phase 1 (version affichée « local ») |
| Date | du 12/11/2026 vers 22:05 au 13/11/2026 vers 01:00 (Europe/Paris), avec une interruption (limite d'utilisation, puis redémarrage de la machine : pile relancée par la session principale, données intactes, Chrome relancé et comptes reconnectés) |
| Pile | `https://127.0.0.16` (pile 6), remplie par l'agent 6 en phase 1 ; `GET /api/setup` : `needed:false`, `adminExists:true` |
| Navigateur | Chrome sans interface du pilote (`PILOTE_PORT=9339`, `.pilote-6`), bureau 1440 × 900, téléphone 390 × 844 avec barres de défilement masquées (comme sur un téléphone) |
| Méthode | pour chaque compte et chaque périmètre (« pilotage-scope » du navigateur réglé sur le principal puis sur Hébergement HDS) : relevé des 35 écrans (adresse finale, titres, fenêtres, boutons actifs et désactivés, champs, alertes, erreurs HTTP), puis rejeu par l'API, avec la session du compte, de 85 lectures et écritures des écrans. Les écritures rejouées portent un corps invalide ou un `If-Match` périmé : un refus de droits répond 403/404 ; une écriture qui passerait le contrôle échouerait ensuite (400/422/428) sans rien écrire. Scripts dans le bloc-notes (`t6/`), hors dépôt. |
| Résultat | 350 cases : 293 ok, 57 défaut (dont 30 sur des défauts déjà connus), 0 sans objet, 0 non testée |

## Comptes créés (préfixe test7-, par l'interface « Plateforme > Utilisateurs > Nouveau compte »)

Aucun secret ici : mots de passe temporaires et secrets TOTP sont dans `.pilote-6/comptes.json` (ignoré par Git). Chaque
compte a fait sa première connexion à l'écran (enrôlement TOTP, puis changement imposé du mot de passe temporaire).

| Rôle de la matrice | Compte | Rôle attribué | Accès au périmètre Hébergement HDS (Configuration du pilotage) |
| --- | --- | --- | --- |
| administrateur | `test7-admin` | Administrateur | (tous les périmètres, par le rôle) |
| contributeur | `test7-contrib` | Contributeur | aucun (non membre) |
| lecteur | `test7-lecteur` | Lecteur | Lecture |
| auditeur_externe | `test7-auditeur` | Auditeur externe, module « Pilotage du SMSI », expiration 31/12/2026 | Lecture |
| restreint | `test7-restreint` | Contributeur | Écriture |
| rssi | `rssi` (compte de l'installation, existant) | Administrateur | Écriture |

Les cinq comptes ont pu être créés par l'interface. Pour l'auditeur externe, la fenêtre impose la date d'expiration et le
choix des modules (astérisques, aide « Obligatoire pour un auditeur externe ») ; la liste des modules ne propose que les
modules métier et Documents : « Administration » et « Paramètres », qui portent 34 des 35 écrans de la tranche, ne
peuvent pas lui être ouverts (conforme à `AUDITOR_MODULES`, ADR 0010). Le module Pilotage lui a été ouvert pour couvrir
Configuration du pilotage. Les compteurs de « Rôles et droits » suivent les créations (Administrateur 2 comptes,
Contributeur 4, Lecteur 4 dont 1 groupe, Auditeur externe 1).

## Droits attendus et sources

- Rôles prédéfinis et leurs permissions : `packages/shared/src/permissions.ts` (`SYSTEM_ROLE_DEFS`), ADR 0010 :
  le contributeur lit et modifie les modules métier, sans `administration`, `parametres`, `import_export` ni action
  `administrer` ; le lecteur lit les modules métier ; l'auditeur externe lit les modules choisis, jusqu'à expiration.
- Cartes de Plateforme et de Système : `apps/web/src/administration-droits.ts` (une carte n'apparaît qu'avec `parametres:lire`,
  `administration:lire` ou `import_export:lire` ; « Configuration du pilotage » avec `pilotage:lire`).
- Routes : `access` de chaque route (`apps/api/src/routes/*.ts`) ; Configuration du pilotage et Configuration GRC :
  `pilotage:administrer` pour publier ou attribuer (`apps/api/src/grc/core.ts`, `apps/api/src/config-grc.ts`).
- Périmètres : un périmètre « restreint » n'est visible que de ses membres et des administrateurs, le périmètre commun est
  de visibilité « instance » (`apps/api/src/grc/core.ts`, `access()` et `listSmsis()`), ADR 0039 et 0043.
- Guide administrateur (`docs/06_GUIDES/GUIDE_ADMINISTRATEUR.md`) : « Auditeur externe : date d'expiration et modules requis ;
  pas d'accès global automatique ».

## Ce qui a été vérifié et fonctionne

- **Aucune lecture ni écriture hors droits par l'API sur les écrans de la tranche** : pour `test7-contrib`, `test7-lecteur`,
  `test7-auditeur` et `test7-restreint`, sous les deux périmètres, 75 à 77 des 85 requêtes sont refusées en 403 avec un
  message français (« Droits insuffisants : vous ne pouvez pas administrer dans « Administration (comptes, groupes, rôles,
  sessions, journal) » ») ou en 404 pour le périmètre non accessible ; les autres sont des lectures ouvertes par
  construction (`/api/calendriers-plateforme`, `/api/types-processus`, `/api/modules`, `/api/updates` : « Aucune mise à jour
  en cours. », `/api/setup` public, `/api/grc/smsis`, méthodes et politique du périmètre accessible, catalogue GRC).
  Réglages (10 sections), comptes, groupes, fonctions, rôles, revue des accès, sessions, journal d'audit, journaux techniques,
  versions, sauvegardes, exploitation, poivre, adresse du site, clé de secours, WebAuthn, remise à vide, modules, politique
  métier, écrans muraux, import : tous refusés. Aucune donnée n'a été modifiée (catalogue GRC relu : aucun élément
  `refus_test7_*` ; accès au périmètre commun inchangés).
- **Administrateur `test7-admin`** : les 35 écrans s'ouvrent avec leurs commandes ; les écritures rejouées passent le contrôle
  de droits et s'arrêtent à la validation (422) ou à l'absence d'`If-Match` (428).
- **Interface** : pour les comptes non administrateurs, aucune carte d'administration n'est proposée (seule « Configuration du
  pilotage »), Système et `/admin` renvoient à l'accueil, Configuration du pilotage est en lecture seule (aucun bouton
  Créer, Publier, Simuler, Attribuer ; champs désactivés ; texte « Paramètres réservés aux personnes qui configurent les
  méthodes et les règles de gestion. »).
- **Périmètre restreint** : `test7-contrib`, non membre d'Hébergement HDS, ne le voit pas (`GET /api/grc/smsis` : 1 périmètre ;
  `GET /api/grc/<HDS>/methods` → 404 « Périmètre introuvable ou non accessible. ») et l'échelle « Disponibilité hébergement
  (fictive) », limitée à HDS, est absente de son catalogue GRC (5 éléments au lieu de 6).
- **Auditeur externe** : lecture seule de son seul module ; date d'expiration ramenée au 11/11/2026 par `test7-admin`
  (« Compte modifié. Ses sessions ont été fermées si ses droits ont changé. ») : connexion refusée avec le message générique
  « Identifiant ou mot de passe incorrect, ou compte temporairement verrouillé après plusieurs échecs. » et
  `auth.login_failed` au journal ; date remise au 31/12/2026, connexion de nouveau possible.
- **Téléphone (rssi, 390 × 844)** : aucune page ne défile horizontalement (largeur de document 390 px sur les 37 adresses),
  connexion et installation fermée lisibles ; les défauts relevés sont dans T6-04.
- Aucune erreur JavaScript ni CSP, aucune réponse 5xx pendant le passage.

## Constats

### T6-01 — Paramètres s'ouvre pour un compte sans droit : sections listées et erreur 403

- Gravité : mineur
- Écran : `/parametres/:section?` (`/parametres`, `/parametres/securite`) ; comptes contributeur, lecteur, auditeur externe, restreint
- Référence : AGENTS.md (l'interface masque ce qui n'est pas permis, `useCan`) ; ADR 0010
- Observé : `ouvrir /parametres` avec `test7-contrib` → titre « Paramètres », 9 onglets de sections (« Général », « Cycle d'audit
  et années », « Référentiels », « Apparence », « Notifications », « Sauvegardes », « Conservation », « Courriel »…), alerte
  « Erreur Droits insuffisants : vous ne pouvez pas consulter dans « Paramètres ». », réponse `HTTP 403 GET /api/settings/general`.
  Même chose pour `/parametres/securite` (`HTTP 403 GET /api/settings/securite`) et pour les quatre comptes (7 onglets pour
  l'auditeur). Le serveur refuse bien (PUT `/api/settings/*` → 403) : pas de fuite, mais un écran qui ne devrait pas s'ouvrir.
- Attendu : comme `/systeme` et `/admin`, renvoi vers l'accueil ou message « Cet écran est réservé aux administrateurs »,
  sans onglets de sections ni erreur technique.
- Reproductible par : à écrire (contributeur, `/parametres` : aucun onglet, aucune requête 403).

### T6-02 — Impossible de limiter un compte au sous-périmètre : le périmètre commun reste ouvert à tous

- Gravité : majeur
- Écrans : Configuration du pilotage (`/pilotage/configuration`, carte `/plateforme/configuration-pilotage`) ; effet sur tous les
  écrans par périmètre des autres tranches
- Référence : ISO/IEC 27001:2022, A.5.15 et A.8.3 (restriction d'accès) ; HDS (accès limité au périmètre d'hébergement) ;
  matrice de couverture (« `restreint` : compte limité à un sous-périmètre ») ; consignes de la phase 2 (« Le contributeur
  restreint ne doit rien voir ni écrire hors du sous-périmètre »)
- Observé : `test7-restreint` (Contributeur, accès en écriture au seul périmètre Hébergement HDS) ouvre Configuration du pilotage :
  « Périmètre affiché » vaut « SMSI Groupement Santé Fictif » et propose aussi « Hébergement HDS » ;
  `GET /api/grc/smsis` → 2 périmètres ; `GET /api/grc/00000000-…-000000000001/methods` → 200 (1 méthode) et `…/policy` → 200.
  Le périmètre commun est de visibilité `instance` (`GET /api/grc/smsis` : `"visibility":"instance"`) : `access()`
  (`apps/api/src/grc/core.ts`) ne vérifie l'appartenance que pour un périmètre `restricted`, et `SmsiUpdate` ne permet pas de
  changer la visibilité ; aucun écran ne le propose. Un compte qui a les droits de module lit donc, et par construction
  modifie, tout le périmètre commun. L'écriture dans le périmètre commun n'a pas été rejouée ici (les écritures de Configuration
  du pilotage exigent `pilotage:administrer` et sont refusées en 403 pour ce compte ; les autres relèvent des tranches 1 à 5).
- Attendu : pouvoir limiter un compte (prestataire d'hébergement, pilote HDS) au seul sous-périmètre, ou que l'écran
  d'attribution d'accès dise clairement que le périmètre commun reste ouvert à tous les comptes. Décision à prendre en
  phase 3 : défaut de l'application ou limite assumée à documenter.
- Reproductible par : à écrire (contributeur membre du seul sous-périmètre : `GET /api/grc/smsis` ne doit renvoyer que lui).

### T6-03 — Le périmètre affiché du compte précédent est conservé après la déconnexion

- Gravité : mineur
- Écran : Configuration du pilotage ; tous les écrans (compteur des rapprochements du menu)
- Référence : CAMPAGNE §5.3 (une donnée d'un périmètre n'apparaît pas sous l'autre) ; poste partagé
- Observé : avec `rssi`, `ouvrir /pilotage/configuration`, `choisir "Périmètre affiché" "Hébergement HDS"`, Déconnexion ; connexion
  de `test7-contrib` (non membre de HDS) ; `ouvrir /pilotage/configuration` → titre et « Méthode publiée » vide, sans sélecteur
  de périmètre ni message ; à chaque écran `HTTP 404 GET /api/grc/b657ff37-…/rapprochements/summary`. La Synthèse du
  Pilotage affiche alors « Indicateurs : aucune donnée 0/0 ». Cause visible dans le code : la clé `pilotage-scope` du
  `sessionStorage` n'est pas effacée par `apps/web/src/logout.ts`. Aucune donnée de HDS n'est montrée (l'API refuse en 404),
  mais l'identifiant du périmètre choisi par le compte précédent est réutilisé.
- Attendu : effacer le périmètre affiché à la déconnexion, ou revenir au périmètre commun quand le périmètre mémorisé n'est
  pas accessible, avec un message.
- Reproductible par : à écrire.

### T6-04 — Au téléphone, les colonnes d'actions des tableaux sont coupées ou hors champ

- Gravité : mineur
- Écrans (compte rssi, 390 × 844) : Utilisateurs (tableau 317/903 px), Groupes (396), Fonctions (342), Rôles et droits (646),
  Calendriers (392), Types de processus (635), Écrans muraux (411), Mises à jour et versions (544), Sessions actives (422),
  Journal d'audit (692), Journaux techniques (1078), Détails techniques (597), `/admin`, Configuration GRC, Mon compte
  (tableau des sessions)
- Référence : RGAA 10.11 / WCAG 1.4.10 (redistribution) ; consigne de phase 2 (« rien de coupé, rien d'inaccessible »)
- Observé : la page ne défile pas horizontalement (390/390 px), mais ces tableaux défilent dans leur cadre sans indication :
  captures `.pilote-6/captures/t6-tel-07-fenetre.png` (colonnes Compte, Rôles, État seules, actions « Droits effectifs »
  à « Supprimer » invisibles), `t6-tel-08-fenetre.png` (« Supprimer » coupé), `t6-tel-09-fenetre.png` (« Archive… » coupé),
  `t6-tel-10-fenetre.png` (« 2 compte(s), 0 grou… »), `t6-tel-13-fenetre.png` (seules Type et Code), `t6-tel-24-fenetre.png`
  (Activité et Fermer invisibles), `t6-tel-31.png` (« 12/11/2026 23 » tronqué). Les actions restent atteignables par un
  glissement horizontal dans le tableau.
- Attendu : présentation en fiches sous une largeur de téléphone, ou colonne d'actions fixée et visible.
- Reproductible par : à écrire (390 × 844 : chaque bouton de ligne visible dans la fenêtre).

### T6-05 — Configuration GRC lisible par les contributeurs, lecteurs et auditeurs, mais sans chemin pour y aller

- Gravité : remarque
- Écrans : carte « Échelles et matrices (GRC) », `/parametres/configuration-grc`
- Observé : la carte exige `parametres:lire` (`administration-droits.ts`) et n'apparaît pas pour ces comptes ; le seul autre lien
  est dans Paramètres, qui leur répond en erreur (T6-01). L'adresse directe s'ouvre pourtant en lecture (droit de lecture
  `pilotage:lire`, `config-grc.ts`) : « Ouvrir » seulement, création refusée en 403.
- Attendu : un lien depuis Configuration du pilotage ou la carte visible en lecture, ou l'écran fermé à ces comptes.
- Reproductible par : à écrire.

### T6-06 — Adresse d'un écran d'administration non autorisé : aucun message

- Gravité : remarque
- Écrans : `/plateforme/<carte>` et `/systeme/<carte>`, `/admin`
- Observé : pour un compte non administrateur, `/plateforme/utilisateurs` affiche la grille Plateforme réduite à « Configuration
  du pilotage » ; `/systeme/journal` et `/admin/audit` renvoient à l'accueil (« Bonjour … »). Rien n'explique pourquoi.
- Attendu : un même comportement et un message « Accès réservé aux administrateurs ».
- Reproductible par : à écrire.

### T6-07 — Installation terminée : `POST /api/setup` répond par une erreur de validation

- Gravité : remarque
- Observé : `pilote.mjs api POST /api/setup {}` (tout compte, installation faite) → `HTTP 422` « Données invalides — token :
  Entrée invalide : chaîne de caractères attendu, indéfini reçu ; username : … ». L'écran `/setup` redirige bien.
- Attendu : 409 « L'installation est déjà faite » avant toute validation du corps.
- Reproductible par : à écrire.

### T6-08 — Attribuer un accès au périmètre : aucun retour, et les sessions du compte sont fermées sans le dire

- Gravité : remarque
- Écran : Configuration du pilotage, « Accès au périmètre existant »
- Observé : `choisir "Compte à ajouter" …`, `choisir "Accès au périmètre" "Écriture"`, `cliquer button "Attribuer l'accès"` :
  la ligne « Contributeur limité à l'hébergement HDS (test7) · Écriture » apparaît, aucune notification. Le serveur ferme les
  sessions du compte visé (`setMember`, `apps/api/src/grc/core.ts`) : l'interface ne le signale pas, contrairement à la
  fenêtre de compte (« Ses sessions ont été fermées si ses droits ont changé. »).
- Attendu : « Accès attribué ; les sessions de ce compte ont été fermées. »
- Reproductible par : à écrire.

### T6-09 — Date d'expiration enregistrée à 23:59:59 UTC

- Gravité : remarque
- Écran : Utilisateurs (fenêtre de compte)
- Observé : date d'expiration « 2026-12-31 » → `expires_at: "2026-12-31T23:59:59.000Z"`, soit le 01/01/2027 à 00:59:59 à Paris ;
  l'aide dit « Le compte est désactivé automatiquement à cette date ».
- Attendu : fin de journée à l'heure de l'organisation (Europe/Paris).
- Reproductible par : à écrire.

## Défauts connus reconfirmés

- **BUG-018** : « Toggle password visibility » sur Mon compte pour les cinq rôles, et dans Courriel et Sécurité.
- **C6-04** : Référentiels, « Référentiel complémentaire actif » affiché « Aucun » (bureau et téléphone).
- **C6-06** : `/plateforme/echelles` et `/plateforme/configuration-pilotage` affichent la grille, pour tous les rôles.
- **C6-07** : boutons sans nom dans les fenêtres Cycle, Référentiels, Notifications, Écrans muraux, Sauvegardes, Courriel,
  Certificats et Sécurité (relevé du compte administrateur), noté en commentaire sans changer les cases.
- **C6-12** : la liste des comptes ne montre pas les accès au périmètre Hébergement HDS que je venais d'attribuer.
- **C6-13** : journal d'audit en codes (`grc.membership.changed`, `admin.user_update`, `auth.login_failed`).
- **C6-20** : après le redémarrage de la pile, `GET /api/admin/sauvegardes` → `"worker":{"available":false,"seenAt":null,
  "message":"Exécutant serveur non configuré."}` et « Exécutant serveur indisponible » à l'écran : l'exécutant n'est toujours
  pas vu par l'application sur cette pile.
- **C6-24** : volumétrie en JSON brut, « 14 MB » et « 14 Mo » mêlés ; la ligne « Migrations appliquées » est en revanche
  remplie (liste des migrations visible au téléphone) : cette partie de C6-24 n'est pas reproduite.

## Signalement pour une autre tranche

- Tranche 1, Synthèse du Pilotage : avec un périmètre mémorisé non accessible (T6-03), « Indicateurs : aucune donnée 0/0 »
  sans dire que le périmètre n'est pas accessible.

## Ce qui reste sur la pile

Les cinq comptes `test7-*` (TOTP enrôlés, mot de passe `PASSWORD` de `helpers.ts`) et leurs accès au périmètre Hébergement HDS
(`test7-restreint` en écriture, `test7-lecteur` et `test7-auditeur` en lecture). La date d'expiration de `test7-auditeur` est
revenue au 31/12/2026. Aucune autre donnée de la phase 1 n'a été modifiée.
