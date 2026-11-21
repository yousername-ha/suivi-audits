# Banc de performance « dix ans d'exploitation » — rapport du 21/11/2026

> Second passage du banc (agent `banc-performance`), à la demande du RSSI, sur la version 7.5.0 publiée. Données entièrement
> fictives, pile jetable détruite à la fin. Les mesures viennent d'un conteneur de développement partagé : elles **ne valent
> pas mesure sur le serveur réel** ; elles valent comparaison relative (avant / après) et ordre de grandeur. Même profil,
> même générateur et même méthode que le [rapport du 19/11](../2026-11-19/RAPPORT.md), pour que les chiffres se comparent.

## 1. Cadre

| Élément | Valeur |
| --- | --- |
| Commit testé | `ee255f8468bbd6112ba4a900fba0c09a8ef33ac0` (étiquette `v7.5.0`, `main`, « Merge pull request #351 ») |
| Version de départ | `v7.4.0` (`fa6c7e7c`) : la pile est installée et remplie en 7.4.0, puis **mise à jour en 7.5.0 sur la base pleine** (chemin d'une mise à jour réelle : `.env` gardé, `APP_VERSION` changé, `docker-compose.yml` de la 7.5.0) |
| Images | construites depuis chaque commit (`docker build`, étiquettes locales `perf740` et `perf750`) : api 7.5.0 `40f4b10cb279`, web 7.5.0 `90428828b44e` ; api 7.4.0 `7af1e98acec7`, web 7.4.0 `301d5596155d` |
| Date, fuseau | 21/11/2026, 10 h 15 – 13 h 30 (Europe/Paris) |
| Machine | conteneur de développement : 4 vCPU Intel Xeon 2,1 GHz, 15 Go de RAM, disque partagé (14 à 16 Go libres pendant le banc) ; démon Docker local (29.9.2) |
| Pile | projet Compose `suivi-banc-perf`, adresse `127.0.0.77`, données dans `/srv/suivi-banc-perf` ; services init, db (PostgreSQL 18.6, `mem_limit` 1 Gio), app (`mem_limit` 768 Mio, pool de 10 connexions), web, gateway. Updater et antivirus non démarrés. |
| Réglages de PostgreSQL | 7.4.0 : `shared_buffers` 128 Mo, `work_mem` 4 Mo, `effective_cache_size` 4 Go, `jit` actif (valeurs par défaut) ; **7.5.0 : vérifiés dans `pg_settings` après la mise à jour** — `shared_buffers` 32 768 × 8 Ko = 256 Mo, `work_mem` 16 384 Ko = 16 Mo, `effective_cache_size` 98 304 × 8 Ko = 768 Mo, `jit` off, tous de source `command line` ; aucun réglage par rôle ou par base (`pg_db_role_setting` vide) |
| Écarts au réglage de production | les mêmes que le 19/11 : `MFA_REQUIRED=false` (connexion scriptée des 20 comptes), `RATE_LIMIT_PER_MINUTE=100000` (toutes les personnes simulées partagent une adresse), `EXPLOITATION_AUTO=0`. Limite de 20 connexions par adresse et par 15 min : sessions réutilisées (deux redémarrages de l'API pendant le remplissage, un après la mise à jour pour déclencher la purge des journaux, aucun pendant les mesures). Diagnostic : `log_min_duration_statement = 300 ms` (`ALTER SYSTEM`) pendant tout le banc ; journal de toutes les requêtes (`0`) quelques secondes par appel compté, hors des séries mesurées. |
| Premier contact | `GET /api/setup` → `{"needed":true,…}` (pile vierge), installation par l'API (compte de recette fictif, poivre généré, clé de secours age jetable). |
| Veille | **aucune collecte réelle** : flux « veille », « veille réglementaire », « tenable » jamais ouverts vers l'extérieur, aucun exécutant d'exploitation ; toutes les données de veille sont insérées en base. |
| Rapport précédent | [19/11/2026](../2026-11-19/RAPPORT.md), commit `3038043c` (7.4.0 + 36 commits). **Témoin** : les 61 routes du 19/11 ont été remesurées aujourd'hui sur la même pile **en 7.4.0, avant la mise à jour** (§ 5) : rapport des médianes témoin / 19/11 sur les 50 routes de plus de 50 ms : médiane ×1,05, 80 % entre ×0,93 et ×1,14, extrêmes ×0,79 et ×1,34 (bruit de la machine), l'écart entre le témoin et la 7.5.0 est celui du code et des réglages. |

## 2. Volumes atteints

| Objet du profil | Cible | Atteint | Chemin |
| --- | --- | --- | --- |
| Périmètres | 30 | 30 (4 établissements et 24 sites rattachés, taille inégale : loi de Zipf, le premier ≈ 12 %) | API |
| Comptes | 300 | 300 (administrateur, RSSI, contributeurs, lecteurs) ; 824 accès à des périmètres | API (110 s pour 299 comptes : hachage) |
| Tâches d'exploitation récurrentes | 150 / mois × 10 ans = 18 000 | 150 séries mensuelles commencées en déc. 2016, **18 000 occurrences** générées par l'automate de l'application (≈ 9 min) ; 93 % des occurrences de plus de 45 jours « faites », le reste en retard ou annulé | API + automate (statuts mis à jour en base) |
| Plan d'actions | 5 000 (le RSSI demande 23 000 actions dont certaines à 50 tâches) | 5 000 actions hors occurrences, **23 000 actions au total** ; **2 201 actions avec des tâches** (ADR 0111) dont **201 à 50 tâches** (borne `TACHES_ACTION_MAX`), 2 000 à 1–12 tâches | 59 par l'API au remplissage (50 actions et 9 ouvertures de plan), une portée à 50 tâches par l'API, 260 créées ensuite pendant les charges (180 + 80) ; le reste en base |
| Vulnérabilités : constats | 100 000 | même interprétation que le 19/11 : **114 716 détections** sur **9 998 constats** (contrôles), 80 % des détections sur 20 % des machines ; faits PRIO-1 : 500 constats avec date de fin de support passée, 100 « exploités par un logiciel malveillant », 1 000 avec kits d'exploitation | 24 000 éléments par une synchronisation simulée, le reste en base |
| Vulnérabilités : machines | 1 000 | 1 000, 6 dépôts reliés à 6 périmètres, 80 machines avec périmètre propre | synchronisation simulée + API |
| Veille : CVE | 20 000 | 20 000 (`CVE-2099-nnnnn`, 5 % au catalogue KEV fictif dont la moitié « rançongiciel ») | base |
| Veille : avis | non fixé (demande du RSSI : « veille remplie ») | **14 150 avis** sur dix ans : CERT-FR 9 000 avis et 150 alertes, CERT Santé 5 000 publications avec fiche lue ; 1 à 6 CVE citées par avis, la moitié présentes sur le parc | base |
| Veille : journal des collectes | dix ans demandés | **178 478 collectes** (toutes les 2 h pour CISA KEV, NVD, CERT-FR, CERT Santé ; une fois par jour pour EPSS), puis 4 405 après la première purge (90 jours) ; 4 159 exécutions du connecteur (synchronisation quotidienne, vérification hebdomadaire), 102 après purge | base |
| Veille réglementaire (ADR 0110) | non fixé (à justifier) | **9 500 publications** sur dix ans : CNIL 3 500, CEPD 1 500, EUR-Lex 3 000 (filtre de mots-clés), ANSSI 1 500, soit ≈ 950 par an ; **14 568 collectes** quotidiennes ; statuts : 75 % sans objet, 18 % à suivre, 7 % impactant, les trois derniers mois surtout « à qualifier » | base ; 15 qualifications par l'API |
| Tableaux de bord (migration 096) | — | les 4 tableaux proposés d'office (dont « Global », 28 dalles), un tableau partagé avec le rôle RSSI, un tableau public, tous deux de l'administrateur | API |
| Annuaire AD | « un rapport fictif de grande taille » | 3 imports de 300 points non conformes × 200 noms (bornes `ADS_BORNES.points` et `nomsParPoint`), 2,97 Mo de corps chacun ; le troisième efface les noms du premier | API |
| Incidents (avec chronologies) | 3 000 | 3 000 (30 par l'API), 8 événements chacun, puis 3 016 après les écritures mesurées | API + base |
| Risques | 2 000 | 2 000 (20 par l'API) | API + base |
| Documents | 2 000 fiches | 2 000 (20 avec pièce déposée par l'API) | API + base |
| Journal d'audit | 2 000 000 | 2 000 012 lignes sur dix ans, puis activité réelle du banc | base + activité |
| Notifications | 200 000 | 200 541 | base + automate |

- **Justification des volumes de veille** (non fixés par le profil) : le CERT-FR publie de l'ordre de 900 à 1 000 avis et
  une quinzaine d'alertes par an ; le CERT Santé quelques centaines de fiches ; la veille réglementaire filtrée (CNIL,
  CEPD, EUR-Lex par mots-clés, ANSSI) de l'ordre d'un millier de publications par an. Le journal des collectes suit la
  cadence par défaut du lot F1 (2 h, EPSS 24 h) sur dix ans, ce qu'aucun serveur réel n'aura (la veille date de 2026 et la
  purge du lot PRIO-1 ne garde que 90 jours) : c'est le pire cas de la première purge.
- **Forme imposée par le schéma** : les liens des publications réglementaires doivent commencer par l'hôte de leur source
  (contrainte de la migration 098) ; ils ont été construits avec un chemin fictif (`/banc-fictif/<n>`), jamais ouverts. Les
  avis de la veille des vulnérabilités sont sans adresse (colonne facultative). Aucun autre nom réel.
- **Surface externe (AlgoLightHouse, Silène)** : non remplie (hors profil) ; la marque « exposée sur Internet » des cartes
  d'avis est donc calculée sur des tables vides (voir § 3).
- Remplissage : API 178 s ; automate 18 000 occurrences ≈ 9 min ; SQL 7.4.0 48 s (notifications 25 s, journal 21 s) ;
  synchronisation simulée 56,7 s ; complément des vulnérabilités 7,8 s ; SQL 7.5.0 6,5 s (collectes de veille 1,4 s,
  veille réglementaire 3,1 s, tâches des actions 0,75 s) ; tableaux, annuaire et 50 tâches par l'API ≈ 10 s.
- Base : **578 Mo** après remplissage en 7.4.0, 579 Mo juste après la mise à jour, **713 Mo** en fin de banc
  (`pg_database_size`). Plus grosses relations : `audit_log` 352 Mo (tas 242 Mo, index 110 Mo), `grc_notifications`
  84 Mo, `grc_objects` 45 Mo (dont 2,6 Mo de tâches), `vulnerabilites_detections` 27 Mo.

## 3. Ce qui a été mesuré, ce qui ne l'a pas été

Mesuré : les 61 routes du 19/11 à une personne sur la 7.4.0 (témoin) puis sur la 7.5.0, administrateur et RSSI non
administrateur, 1 échauffement + 15 répétitions (5 pour les exports) ; 32 routes nouvelles de la 7.5.0 (tableaux de bord,
veille chargée, veille réglementaire, annuaire AD, tâches, parc, correctifs) ; les routes de la veille avec dix ans de
journal puis avec 90 jours ; 16 pages dans Chromium (cache vide et cache chaud, 15 répétitions administrateur, 5 RSSI) ;
20 personnes simultanées pendant 10 min ; 1 h de charge légère avec la mémoire relevée toutes les 30 s ; mise à jour
7.4.0 → 7.5.0 et ses migrations sur la base pleine ; première purge des journaux (réelle) et son plan ; écritures du
registre des incidents, qualification, tâches, tableaux de bord ; import AD de grande taille ; synchronisation simulée à la
borne sur la base pleine ; sauvegarde et restauration ; fichiers temporaires et cache de PostgreSQL ; plans
`EXPLAIN (ANALYZE, BUFFERS)` ; nombre de requêtes SQL par appel.

**Non mesuré** :
- **Synchronisation de 100 000 constats** : toujours impossible par conception (borne de 20 000 détections,
  `TENABLE_BORNES` inchangé) ; seule la réception d'une synchronisation à la borne est mesurée. Lecture de Tenable
  (`integration-http.py`) non exercée (aucun Tenable simulé, aucun réseau).
- **Marque « exposée sur Internet »** des cartes d'avis dans sa forme chargée : la surface externe (AlgoLightHouse,
  Silène) n'est pas dans le profil et n'a pas été remplie ; la requête tourne sur des tables vides, son coût à volume n'est
  pas connu. La marque « présente sur le parc » est, elle, calculée sur les 114 716 détections.
- **Collecte réelle** des veilles (vulnérabilités, réglementaire) : interdite par la consigne ; seules les lectures des
  données insérées sont mesurées, ni la lecture des flux ni leur réception par l'exécutant.
- **Routes de la veille avec dix ans de journal, premier essai** : la purge du lot PRIO-1 s'est déclenchée au premier tic
  de l'API, une minute après le remplissage, avant les mesures ; le journal a été réinséré et les routes remesurées dans
  l'heure suivante (§ 6.1 ter). La purge réelle a été mesurée à ce premier tic.
- **Temps de rendu propre des frises** (dessin de la Timeline) : seul le temps jusqu'à la page utilisable est mesuré (même
  critère que les autres pages) ; la frise s'affiche avec la première page de 50 éléments (bouton « Charger la suite »),
  le rendu de 23 000 éléments n'est jamais demandé par l'écran.
- **Sauvegarde et restauration par `scripts/backup.sh` / `restore.sh`** : comme le 19/11, mesurées avec leurs primitives
  (`pg_dump`, `age`, `pg_restore`, `ANALYZE`) dans une base sœur, sans l'arrêt-redémarrage des conteneurs.
- **Charge d'une heure à 20 personnes** : non tenue (temps) ; la charge longue est une charge légère (5 personnes pendant
  1 h, réflexion 2 à 6 s), comme le 19/11.
- **Fichiers temporaires par opération en 7.4.0** : les statistiques de PostgreSQL n'avaient pas été remises à zéro avant
  le témoin ; le chiffre 7.4.0 (1,4 Go) couvre remplissage et témoin ensemble.
- Pages des autres modules (cartographie, continuité, fournisseurs, conformité, assistant) : non concernées par le profil.

## 4. Synthèse

**Ne tient toujours pas la charge du profil**, mais le module Vulnérabilités n'est plus le seul en cause et ses temps ont
changé de nature. Les correctifs PERF-01 à PERF-04 ont fait leur effet sur ce qu'ils visaient (fiche d'une machine 4,2 s
→ 0,2 s, recherche 4,4 s → 0,2 s, recherche par CVE 2,5 à 11 s → 0,2 s, écart RSSI / administrateur des constats 14,6 s →
4,2 s) ; mais **avec la veille chargée** (14 150 avis), une seule requête nouvelle (PERF-13, lecture des faits des avis,
3,4 à 4,2 s) ramène constats, machines, vue d'ensemble, parc, correctifs et rapport mensuel entre 4 et 6 s, et **la vue
d'ensemble s'aggrave** (1,9 s → 4,7 s). Les réglages de PostgreSQL ont supprimé les fichiers temporaires (4 Go → 0) et la
compilation JIT, sans gain visible sur les routes du socle (même temps qu'au témoin 7.4.0). Le socle n'a pas changé depuis
le 19/11 : ses défauts (registres, écritures des incidents, pages au-delà de 2 s, tenue à 20 personnes) sont toujours là.
Les fonctions nouvelles de la 7.5.0 tiennent leurs objectifs à une personne (veille réglementaire, cartes d'avis, tableaux
de bord, annuaire AD, tâches, purge), sauf l'accueil, qui charge désormais 6,9 Mo par ouverture (PERF-14), et les deux
routes nouvelles des vulnérabilités qui lisent les faits des avis (parc des machines, correctifs : PERF-13).
En charge, **aucune erreur** ni à 20 personnes ni en une heure de charge légère (3 délais d’attente dépassés le 19/11), mémoire de l’API stable, mais 13 routes sur 22 au-delà de ×2 au p95 à 20 personnes. Mise à jour 7.4.0 → 7.5.0 sur la base pleine : **20,6 s d'indisponibilité**, migrations 090 à 099 en
moins de 2 s.

| Gravité | Nombre | Défauts |
| --- | --- | --- |
| Bloquant | 1 | PERF-09 synchronisation de 100 000 constats impossible (borne de 20 000, décision du RSSI) |
| Majeur | 8 | **PERF-13 lecture des faits des avis (nouveau, 3,4 à 4,2 s, cause commune)**, PERF-01 constats (4,0 à 4,4 s ; n'est plus bloquant), PERF-02 machines et parc (3,7 à 6,0 s), PERF-04 vue d'ensemble (**aggravée** : 4,5 à 4,9 s), PERF-05 pages des vulnérabilités (4,5 à 6,5 s), PERF-06 registres de la coquille (2,4 s RSSI), PERF-07 écritures des incidents (3,0 à 3,3 s), PERF-10 dégradation à 20 personnes |
| Mineur | 3 | PERF-08 pages tâches, plan d'actions (frises), documents, risques, journal, périmètres (2,0 à 3,9 s), PERF-11 « mes éléments » (0,83 s RSSI), PERF-12 recherche sans résultat du journal (1,65 s) |
| Remarque | 3 | PERF-14 accueil à 6,9 Mo (+45 %, nouveau), PERF-15 synthèse du mur +44 à +58 % (nouveau), PERF-16 rapport mensuel ×2,7 (nouveau) |
| Résolus | 3 | PERF-03 recherche (0,26 s), fiche d'une machine (0,23 à 0,28 s), recherche de constat par CVE (0,24 à 0,26 s) ; fichiers temporaires et JIT supprimés |

Chiffres clés (p95, conteneur de développement, 4 vCPU) :
- Listes et fiches : **33 des 37 routes du 19/11** tiennent 500 ms pour tous les comptes (32 le 19/11) ; au-delà :
  constats (4,4 s adm. / 4,2 s RSSI), machines (4,1 / 3,9 s), registres de la coquille (0,9 / 2,4 s), « mes éléments »
  (RSSI 0,83 s). Routes nouvelles : 17 sur 19 tiennent ; parc des machines (6,0 / 5,7 s) et correctifs (5,5 / 5,4 s)
  au-delà ; veille réglementaire, cartes d'avis, annuaire, tableaux, fiches à 50 tâches sous 40 ms.
- Tableaux de bord, cartes et recherches : **17 des 19 routes du 19/11** sous 1,5 s (15 le 19/11) ; au-delà : vue
  d'ensemble des vulnérabilités 4,9 s et recherche sans résultat du journal 1,65 s ; recherche des vulnérabilités 0,26 s ;
  les 13 routes nouvelles tiennent (chiffres d'un tableau public 0,79 s au plus).
- Exports et rapports : tous sous 5,1 s (objectif 30 s) ; rapport mensuel des vulnérabilités 1,8 → 5,0 s (PERF-13).
- Pages : 11 pages sur 16 au-delà de 2 s au p95 pour au moins un compte (vulnérabilités 4,5 à 6,5 s ; tâches et plan
  d'actions 2,6 / 3,9 s RSSI ; documents, risques, journal, périmètres juste au-dessus) ; accueil 1,95 s (6,9 Mo).
- 20 personnes, 10 min : 8 343 requêtes, 13,9 req/s, **0 erreur**, p95 global 941 ms (1 098 le 19/11), maximum 6,1 s
  (14,9 s) ; 13 routes sur 22 au-delà de ×2 au p95.
- Charge légère (5 personnes, 1 h) : 4 196 requêtes, **0 erreur** (3 le 19/11), p95 943 ms (2 017), maximum 5,5 s (31,8 s) ; mémoire de l’API **stable** : 120 à 263 Mio, médiane 158, moyennes par tranche de 10 min 164, 157, 167, 153, 160, 159 Mio, pente −6 Mio/h.
- Base : 0 fichier temporaire après les réglages (19/11 : 350 fichiers, 3,98 Go ; 7.4.0 du jour : 130 fichiers, 1,4 Go
  remplissage compris) ; cache 99,70 % ; aucune compilation JIT.
- Opérations : purge des journaux sur dix ans 1,1 s (174 069 lignes) ; import AD de grande taille 1,7 à 1,8 s ;
  mise à jour 7.4.0 → 7.5.0 : 20,6 s d’indisponibilité ; synchronisation à la borne sur la base pleine 86,3 s (76,8 s le 19/11) ; sauvegarde 15,2 s, restauration 21,9 s + ANALYZE 2,6 s (12,7 s, 17,6 s et 1,7 s le 19/11, base 713 Mo au lieu de 624).

## 5. Comparaison avec le rapport précédent

Toutes les routes mesurées les deux fois, à une personne (médiane / p95 en ms, 15 répétitions, 5 pour les exports ; « 403 »
= droit absent, attendu ; « 404 » = route absente de la 7.4.0). Colonne « témoin » : même pile, même jour, en 7.4.0 avant
la mise à jour. « +20 % » : sous l'objectif, mais médiane **et** p95 en hausse de plus de 20 % (et d'au moins 20 ms) par
rapport au 19/11 (remarque au sens du modèle). Les routes « Coquille » du 19/11 avaient été mesurées pendant la charge
légère (légère surévaluation alors) ; celles du journal sans le compte RSSI.

| Route | Compte | Objectif | 19/11 (3038043c) méd. / p95 | 21/11 témoin v7.4.0 | 21/11 v7.5.0 | p95 après / avant | |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Tâches récurrentes : occurrences (page 1) | adm. | 500 ms | 125 / 152 | 124 / 142 | 129 / 153 | ×1.01 | tient |
| Tâches récurrentes : occurrences en retard | adm. | 500 ms | 137 / 161 | 132 / 147 | 130 / 145 | ×0.90 | tient |
| Tâches récurrentes : séries | adm. | 500 ms | 16 / 18 | 15 / 17 | 17 / 19 | ×1.06 | tient |
| Tâches récurrentes : calendrier du mois | adm. | 500 ms | 115 / 184 | 122 / 138 | 128 / 142 | ×0.77 | tient |
| Tâches récurrentes : tableau de bord | adm. | 1500 ms | 138 / 177 | 129 / 171 | 140 / 185 | ×1.05 | tient |
| Plan d’actions (page 1) | adm. | 500 ms | 18 / 26 | 19 / 25 | 23 / 27 | ×1.04 | tient |
| Plan d’actions : page 40 | adm. | 500 ms | 28 / 32 | 28 / 32 | 34 / 37 | ×1.16 | tient |
| Plan d’actions : recherche « fictive » | adm. | 1500 ms | 20 / 30 | 18 / 19 | 21 / 26 | ×0.87 | tient |
| Registres : mes éléments | adm. | 500 ms | 312 / 338 | 336 / 353 | 348 / 377 | ×1.12 | tient |
| Registres : éléments (actions) | adm. | 500 ms | 59 / 66 | 72 / 77 | 66 / 83 | ×1.26 | tient |
| Fiche action | adm. | 500 ms | 8 / 9 | 10 / 13 | 10 / 12 | ×1.33 | tient |
| Risques (page 1) | adm. | 500 ms | 13 / 24 | 15 / 17 | 14 / 18 | ×0.75 | tient |
| Registre des risques | adm. | 500 ms | 27 / 29 | 28 / 33 | 26 / 29 | ×1.00 | tient |
| Carte des risques | adm. | 1500 ms | 30 / 41 | 31 / 52 | 36 / 50 | ×1.22 | tient |
| Fiche risque | adm. | 500 ms | 11 / 19 | 12 / 13 | 12 / 13 | ×0.68 | tient |
| Incidents (registre, tous périmètres) | adm. | 500 ms | 212 / 248 | 232 / 345 | 209 / 253 | ×1.02 | tient |
| Incidents (un périmètre) | adm. | 500 ms | 130 / 157 | 142 / 165 | 118 / 151 | ×0.96 | tient |
| Documents (liste) | adm. | 500 ms | 20 / 24 | 27 / 39 | 27 / 32 | ×1.33 | tient |
| Documents : recherche | adm. | 1500 ms | 22 / 38 | 24 / 36 | 28 / 38 | ×1.00 | tient |
| Fiche document | adm. | 500 ms | 8 / 12 | 7 / 9 | 8 / 12 | ×1.00 | tient |
| Vulnérabilités : constats (page 1) | adm. | 500 ms | 4425 / 4711 | 4837 / 5450 | 4055 / 4447 | ×0.94 | **dépasse** |
| Vulnérabilités : constats recherche CVE | adm. | 1500 ms | 2459 / 2709 | 2380 / 3204 | 183 / 241 | ×0.09 | tient |
| Vulnérabilités : machines (page 1) | adm. | 500 ms | 4382 / 4794 | 4742 / 6161 | 3855 / 4077 | ×0.85 | **dépasse** |
| Vulnérabilités : fiche machine la plus touchée | adm. | 500 ms | 4034 / 4246 | 4335 / 4955 | 201 / 231 | ×0.05 | tient |
| Vulnérabilités : fiche constat le plus répandu | adm. | 500 ms | 51 / 61 | 54 / 60 | 46 / 55 | ×0.90 | tient |
| Vulnérabilités : vue d’ensemble | adm. | 1500 ms | 1779 / 1889 | 1837 / 2174 | 4650 / 4889 | ×2.59 | **dépasse** |
| Vulnérabilités : tendances | adm. | 1500 ms | 9 / 11 | 11 / 22 | 9 / 10 | ×0.91 | tient |
| Vulnérabilités : délais | adm. | 1500 ms | 13 / 16 | 13 / 16 | 12 / 13 | ×0.81 | tient |
| Vulnérabilités : veille (failles) | adm. | 500 ms | 36 / 43 | 38 / 42 | 31 / 37 | ×0.86 | tient |
| Vulnérabilités : produits | adm. | 500 ms | 7 / 9 | 7 / 11 | 6 / 8 | ×0.89 | tient |
| Vulnérabilités : recherche globale | adm. | 1500 ms | 4307 / 4595 | 404 | 207 / 256 | ×0.06 | tient |
| Vulnérabilités : périmètres | adm. | 500 ms | 7 / 10 | 8 / 8 | 8 / 10 | ×1.00 | tient |
| Journal d’audit (200 dernières) | adm. | 500 ms | 8 / 10 | 9 / 14 | 7 / 8 | ×0.80 | tient |
| Journal d’audit : recherche « login » | adm. | 1500 ms | 10 / 16 | 10 / 13 | 8 / 10 | ×0.62 | tient |
| Journal d’audit : recherche rare « verrou » | adm. | 1500 ms | 416 / 488 | 461 / 519 | 371 / 429 | ×0.88 | tient |
| Journal d’audit : un mois de 2019 | adm. | 500 ms | 17 / 21 | 13 / 17 | 17 / 19 | ×0.90 | tient |
| Journal d’audit : un compte | adm. | 500 ms | 14 / 19 | 14 / 16 | 16 / 22 | ×1.16 | tient |
| Notifications (cloche) | adm. | 500 ms | 247 / 290 | 261 / 279 | 257 / 297 | ×1.02 | tient |
| Compte : notifications | adm. | 500 ms | 10 / 10 | 10 / 11 | 11 / 14 | ×1.40 | tient |
| Tableau de bord du périmètre | adm. | 1500 ms | 147 / 183 | 144 / 177 | 133 / 153 | ×0.84 | tient |
| Cartes des périmètres (synthèse) | adm. | 1500 ms | 670 / 800 | 708 / 857 | 828 / 953 | ×1.19 | tient |
| Mur : synthèse | adm. | 1500 ms | 358 / 407 | 393 / 500 | 567 / 667 | ×1.64 | tient, **+20 %** |
| État du suivi (état historique) | adm. | 1500 ms | 197 / 232 | 212 / 268 | 224 / 259 | ×1.12 | tient |
| Administration : informations | adm. | 1500 ms | 57 / 70 | 56 / 63 | 59 / 78 | ×1.11 | tient |
| Administration : système | adm. | 1500 ms | 9 / 12 | 7 / 11 | 7 / 9 | ×0.75 | tient |
| Couverture du périmètre | adm. | 1500 ms | 127 / 160 | 120 / 189 | 132 / 198 | ×1.24 | tient |
| Périmètres accessibles | adm. | 500 ms | 8 / 9 | 9 / 13 | 8 / 12 | ×1.33 | tient |
| Session (auth/me) | adm. | 500 ms | 5 / 6 | 6 / 7 | 6 / 7 | ×1.17 | tient |
| Export : journal d’audit CSV (5 000 lignes) | adm. | 30000 ms | 40 / 42 | 48 / 56 | 41 / 50 | ×1.19 | tient |
| Export : suivi complet (Excel) | adm. | 30000 ms | 372 / 394 | 360 / 415 | 345 / 350 | ×0.89 | tient |
| Rapport comité SMSI | adm. | 30000 ms | 284 / 318 | 263 / 299 | 298 / 312 | ×0.98 | tient |
| Rapport mensuel vulnérabilités (CSV) | adm. | 30000 ms | 1770 / 1833 | 1881 / 2005 | 4905 / 5038 | ×2.75 | tient, **+20 %** |
| Export de l’état historique | adm. | 30000 ms | 372 / 509 | 500 / 544 | 414 / 498 | ×0.98 | tient |
| Tâches récurrentes : occurrences (page 1) | RSSI | 500 ms | 135 / 181 | 112 / 154 | 122 / 152 | ×0.84 | tient |
| Tâches récurrentes : occurrences en retard | RSSI | 500 ms | 117 / 157 | 123 / 159 | 131 / 211 | ×1.34 | tient |
| Tâches récurrentes : séries | RSSI | 500 ms | 13 / 14 | 16 / 30 | 18 / 21 | ×1.50 | tient |
| Tâches récurrentes : calendrier du mois | RSSI | 500 ms | 104 / 128 | 119 / 148 | 120 / 139 | ×1.09 | tient |
| Tâches récurrentes : tableau de bord | RSSI | 1500 ms | 141 / 203 | 128 / 208 | 151 / 166 | ×0.82 | tient |
| Plan d’actions (page 1) | RSSI | 500 ms | 18 / 26 | 19 / 24 | 24 / 31 | ×1.19 | tient |
| Plan d’actions : page 40 | RSSI | 500 ms | 27 / 45 | 35 / 37 | 38 / 46 | ×1.02 | tient |
| Plan d’actions : recherche « fictive » | RSSI | 1500 ms | 22 / 28 | 18 / 20 | 25 / 32 | ×1.14 | tient |
| Registres : mes éléments | RSSI | 500 ms | 683 / 732 | 703 / 790 | 747 / 833 | ×1.14 | **dépasse** |
| Registres : éléments (actions) | RSSI | 500 ms | 138 / 174 | 132 / 147 | 132 / 150 | ×0.86 | tient |
| Fiche action | RSSI | 500 ms | 15 / 23 | 15 / 17 | 14 / 17 | ×0.74 | tient |
| Risques (page 1) | RSSI | 500 ms | 15 / 16 | 15 / 17 | 14 / 31 | ×1.94 | tient |
| Registre des risques | RSSI | 500 ms | 26 / 31 | 22 / 25 | 27 / 31 | ×1.00 | tient |
| Carte des risques | RSSI | 1500 ms | 28 / 32 | 31 / 39 | 31 / 38 | ×1.19 | tient |
| Fiche risque | RSSI | 500 ms | 11 / 11 | 11 / 12 | 10 / 11 | ×1.00 | tient |
| Incidents (registre, tous périmètres) | RSSI | 500 ms | 210 / 254 | 207 / 245 | 210 / 262 | ×1.03 | tient |
| Incidents (un périmètre) | RSSI | 500 ms | 144 / 186 | 149 / 182 | 147 / 175 | ×0.94 | tient |
| Documents (liste) | RSSI | 500 ms | 26 / 29 | 28 / 31 | 21 / 26 | ×0.90 | tient |
| Documents : recherche | RSSI | 1500 ms | 24 / 29 | 27 / 30 | 24 / 32 | ×1.10 | tient |
| Fiche document | RSSI | 500 ms | 8 / 9 | 7 / 8 | 8 / 9 | ×1.00 | tient |
| Vulnérabilités : constats (page 1) | RSSI | 500 ms | 13010 / 14563 | 14404 / 16646 | 4042 / 4239 | ×0.29 | **dépasse** |
| Vulnérabilités : constats recherche CVE | RSSI | 1500 ms | 11221 / 12435 | 14312 / 15261 | 186 / 256 | ×0.02 | tient |
| Vulnérabilités : machines (page 1) | RSSI | 500 ms | 4634 / 5124 | 4915 / 5526 | 3728 / 3880 | ×0.76 | **dépasse** |
| Vulnérabilités : fiche machine la plus touchée | RSSI | 500 ms | 4185 / 4813 | 4467 / 5090 | 238 / 277 | ×0.06 | tient |
| Vulnérabilités : fiche constat le plus répandu | RSSI | 500 ms | 119 / 160 | 124 / 167 | 57 / 76 | ×0.47 | tient |
| Vulnérabilités : vue d’ensemble | RSSI | 1500 ms | 1909 / 2133 | 1865 / 2098 | 4507 / 4791 | ×2.25 | **dépasse** |
| Vulnérabilités : tendances | RSSI | 1500 ms | 10 / 13 | 14 / 16 | 11 / 14 | ×1.08 | tient |
| Vulnérabilités : délais | RSSI | 1500 ms | 13 / 15 | 13 / 14 | 12 / 13 | ×0.87 | tient |
| Vulnérabilités : veille (failles) | RSSI | 500 ms | 30 / 40 | 34 / 42 | 31 / 41 | ×1.02 | tient |
| Vulnérabilités : produits | RSSI | 500 ms | 6 / 8 | 7 / 8 | 6 / 6 | ×0.75 | tient |
| Vulnérabilités : recherche globale | RSSI | 1500 ms | 4246 / 4435 | 404 | 208 / 290 | ×0.07 | tient |
| Vulnérabilités : périmètres | RSSI | 500 ms | 9 / 12 | 11 / 14 | 11 / 18 | ×1.50 | tient |
| Journal d’audit (200 dernières) | RSSI | 500 ms | 403 | 403 | 403 |  |  |
| Journal d’audit : recherche « login » | RSSI | 1500 ms | 403 | 403 | 403 |  |  |
| Journal d’audit : recherche rare « verrou » | RSSI | 1500 ms | 403 | 403 | 403 |  |  |
| Journal d’audit : un mois de 2019 | RSSI | 500 ms | 403 | 403 | 403 |  |  |
| Journal d’audit : un compte | RSSI | 500 ms | 403 | 403 | 403 |  |  |
| Notifications (cloche) | RSSI | 500 ms | 242 / 274 | 272 / 306 | 235 / 265 | ×0.97 | tient |
| Compte : notifications | RSSI | 500 ms | 9 / 15 | 11 / 14 | 8 / 10 | ×0.67 | tient |
| Tableau de bord du périmètre | RSSI | 1500 ms | 160 / 210 | 126 / 186 | 130 / 164 | ×0.78 | tient |
| Cartes des périmètres (synthèse) | RSSI | 1500 ms | 647 / 694 | 609 / 643 | 731 / 896 | ×1.29 | tient |
| Mur : synthèse | RSSI | 1500 ms | 378 / 429 | 361 / 414 | 536 / 651 | ×1.52 | tient, **+20 %** |
| État du suivi (état historique) | RSSI | 1500 ms | 189 / 234 | 193 / 254 | 201 / 241 | ×1.03 | tient |
| Administration : informations | RSSI | 1500 ms | 403 | 403 | 403 |  |  |
| Administration : système | RSSI | 1500 ms | 403 | 403 | 403 |  |  |
| Couverture du périmètre | RSSI | 1500 ms | 113 / 168 | 103 / 123 | 106 / 143 | ×0.85 | tient |
| Périmètres accessibles | RSSI | 500 ms | 11 / 12 | 12 / 14 | 15 / 18 | ×1.50 | tient |
| Session (auth/me) | RSSI | 500 ms | 5 / 7 | 6 / 7 | 6 / 7 | ×1.00 | tient |
| Export : journal d’audit CSV (5 000 lignes) | RSSI | 30000 ms | 403 | 403 | 403 |  |  |
| Export : suivi complet (Excel) | RSSI | 30000 ms | 321 / 340 | 350 / 377 | 321 / 366 | ×1.08 | tient |
| Rapport comité SMSI | RSSI | 30000 ms | 289 / 312 | 316 / 365 | 286 / 323 | ×1.04 | tient |
| Rapport mensuel vulnérabilités (CSV) | RSSI | 30000 ms | 1874 / 1906 | 1879 / 1948 | 4791 / 4990 | ×2.62 | tient, **+20 %** |
| Export de l’état historique | RSSI | 30000 ms | 369 / 402 | 424 / 444 | 361 / 387 | ×0.96 | tient |
| Journal d’audit : recherche sans résultat | adm. | 1500 ms | 1471 / 1600 | 1619 / 1883 | 1521 / 1651 | ×1.03 | **dépasse** |
| Journal d’audit : page 2 000 (before) | adm. | 500 ms | 8 / 9 | 9 / 12 | 9 / 29 | ×3.22 | tient |
| Coquille : registres | adm. | 500 ms | 734 / 865 | 771 / 812 | 786 / 884 | ×1.02 | **dépasse** |
| Coquille : responsables du périmètre | adm. | 500 ms | 193 / 223 | 221 / 245 | 236 / 280 | ×1.26 | tient, **+20 %** |
| Coquille : invitations RETEX | adm. | 500 ms | 170 / 270 | 171 / 189 | 179 / 245 | ×0.91 | tient |
| Coquille : crise | adm. | 500 ms | 96 / 135 | 101 / 143 | 118 / 158 | ×1.17 | tient |
| Coquille : alertes vulnérabilités (fenêtre) | adm. | 500 ms | 19 / 24 | 8 / 10 | 9 / 10 | ×0.42 | tient |
| Coquille : état de l’assistant | adm. | 500 ms | 10 / 11 | 11 / 13 | 10 / 11 | ×1.00 | tient |
| Coquille : registres | RSSI | 500 ms | 1896 / 2517 | 1962 / 2144 | 1959 / 2400 | ×0.95 | **dépasse** |
| Coquille : responsables du périmètre | RSSI | 500 ms | 201 / 242 | 208 / 266 | 204 / 251 | ×1.04 | tient |
| Coquille : invitations RETEX | RSSI | 500 ms | 170 / 217 | 174 / 219 | 147 / 165 | ×0.76 | tient |
| Coquille : crise | RSSI | 500 ms | 115 / 169 | 117 / 144 | 112 / 131 | ×0.78 | tient |
| Coquille : alertes vulnérabilités (fenêtre) | RSSI | 500 ms | 29 / 37 | 8 / 10 | 7 / 14 | ×0.38 | tient |
| Coquille : état de l’assistant | RSSI | 500 ms | 14 / 15 | 17 / 24 | 15 / 18 | ×1.20 | tient |

Lecture : cinq lignes marquées « +20 % ». La synthèse du mur (PERF-15) et le rapport mensuel (PERF-16) le sont aussi par
rapport au témoin du jour : vraies remarques. « Coquille : responsables du périmètre » (adm.) ne l'est pas : le témoin
7.4.0 du jour donne 221 / 245 ms, la 7.5.0 236 / 280 ms (+7 % en médiane) ; l'écart au 19/11 vient de la machine.
Les autres hausses de p95 sans hausse de médiane (une seule mesure haute sur 15) ne sont pas retenues.

## 6. Mesures

### 6.1 Routes nouvelles de la 7.5.0, à une personne (cache chaud, 1 + 15 répétitions, médiane / p95 / max en ms)

Périmètre mesuré : le plus gros (≈ 12 % des données). Compte RSSI `charge01` : rôle RSSI sur 6 périmètres.

| Route | Objectif | Administrateur | RSSI (non administrateur) | Taille (Ko) | |
| --- | --- | --- | --- | --- | --- |
| Fiche action à 50 tâches | 500 ms | 10 / 16 / 16 | 13 / 14 / 14 | 8 |  |
| Plan d’actions : recherche « Action fictive du plan » (tâches) | 500 ms | 23 / 26 / 26 | 21 / 28 / 28 | 96 |  |
| Accueil : liste des tableaux de bord | 1500 ms | 11 / 19 / 19 | 12 / 15 / 15 | 6 |  |
| Accueil : tableau Global (28 dalles) | 1500 ms | 11 / 16 / 16 | 11 / 15 / 15 | 2 |  |
| Accueil : tableau partagé | 1500 ms | 11 / 13 / 13 | 10 / 13 / 13 | 2 |  |
| Accueil : chiffres du tableau partagé (droits de l’auteur) | 1500 ms | 404 (attendu) | 691 / 770 / 770 | 5 |  |
| Accueil : tableau public | 1500 ms | 10 / 11 / 11 | 10 / 13 / 13 | 2 |  |
| Accueil : chiffres du tableau public (droits de l’auteur) | 1500 ms | 404 (attendu) | 694 / 787 / 787 | 5 |  |
| Accueil : journal d’audit de la dalle (500 lignes) | 1500 ms | 10 / 12 / 12 | 403 (droit) | 93 |  |
| Veille : avis (page 1, marques parc et Internet) | 500 ms | 13 / 14 / 14 | 19 / 25 / 25 | 13 |  |
| Veille : avis du CERT Santé (page 1) | 500 ms | 12 / 13 / 13 | 11 / 13 / 13 | 14 |  |
| Veille : avis page 200 | 500 ms | 22 / 26 / 26 | 18 / 21 / 21 | 13 |  |
| Veille : avis recherche CVE | 1500 ms | 42 / 51 / 51 | 32 / 44 / 44 | 12 |  |
| Veille : avis recherche titre | 1500 ms | 50 / 52 / 52 | 33 / 48 / 48 | 13 |  |
| Veille : état des sources | 500 ms | 16 / 30 / 30 | 16 / 18 / 18 | 4 |  |
| Veille : failles du catalogue KEV | 500 ms | 19 / 21 / 21 | 17 / 19 / 19 | 27 |  |
| Veille : failles recherche produit | 1500 ms | 497 / 624 / 624 | 297 / 369 / 369 | 21 |  |
| Vulnérabilités : parc des machines | 500 ms | 5599 / 5962 / 5962 | 5398 / 5741 / 5741 | 364 | **dépasse** |
| Vulnérabilités : correctifs | 500 ms | 4871 / 5496 / 5496 | 4719 / 5420 / 5420 | 1 | **dépasse** |
| Vulnérabilités : alertes | 500 ms | 9 / 26 / 26 | 8 / 10 / 10 | 0 |  |
| Vulnérabilités : état de la synchronisation | 500 ms | 10 / 11 / 11 | 9 / 12 / 12 | 0 |  |
| Vulnérabilités : état des imports | 500 ms | 8 / 10 / 10 | 7 / 10 / 10 | 0 |  |
| Annuaire AD : synthèse | 1500 ms | 10 / 12 / 12 | 10 / 12 / 12 | 59 |  |
| Annuaire AD : noms d’un point (200 noms) | 500 ms | 13 / 18 / 18 | 10 / 20 / 20 | 29 |  |
| Veille réglementaire : synthèse | 1500 ms | 8 / 8 / 8 | 7 / 8 / 8 | 0 |  |
| Veille réglementaire : publications (page 1) | 500 ms | 8 / 11 / 11 | 8 / 11 / 11 | 13 |  |
| Veille réglementaire : à qualifier, sécurité | 500 ms | 8 / 9 / 9 | 7 / 9 / 9 | 11 |  |
| Veille réglementaire : impactant, CNIL | 500 ms | 8 / 23 / 23 | 7 / 10 / 10 | 14 |  |
| Veille réglementaire : recherche | 1500 ms | 33 / 34 / 34 | 22 / 33 / 33 | 12 |  |
| Veille réglementaire : page 300 | 500 ms | 20 / 26 / 26 | 24 / 26 / 26 | 14 |  |
| Veille réglementaire : fiche | 500 ms | 7 / 7 / 7 | 7 / 9 / 9 | 0 |  |
| Veille réglementaire : sources | 500 ms | 24 / 28 / 28 | 22 / 31 / 31 | 6 |  |

Écritures nouvelles (1 échauffement + 15 mesures, `node ecritures-v750.mjs`) :

| Écriture | Médiane / p95 / max (ms) | Répétitions |
| --- | --- | --- |
| Veille réglementaire : qualification (PATCH, RSSI) | 13 / 17 / 17 | 15 |
| Action à 50 tâches : modification (PUT, administrateur) | 19 / 26 / 26 | 15 |
| Tableau de bord : création (POST, RSSI) | 27 / 31 / 31 | 15 |
| Tableau de bord : suppression (DELETE, RSSI) | 14 / 16 / 16 | 15 |

### 6.1 bis Nombre de requêtes SQL par appel

Journal de toutes les requêtes activé le temps d'un appel ; seules les lignes `execute` du rôle applicatif sont comptées
(minimum de trois appels, compte RSSI ; ≈ 6 requêtes sont celles de la reprise de session du banc).
**Correction du 19/11** : les nombres de ce rapport-là (609 pour la cloche, 747 pour la synthèse des périmètres, 771 pour
« mes éléments ») comptaient aussi les étapes `parse` et `bind` du protocole étendu, écrites par le même réglage : ils
sont environ trois fois trop grands (609 = 3 × 203). Les rafales N+1 restent réelles.

| Route | Réponse (un appel) | Requêtes SQL exécutées | Somme de leurs durées (ms) |
| --- | --- | --- | --- |
| `/api/vulnerabilites/constats` | 200 4443ms 41799 o | 13 | 3888 |
| `/api/vulnerabilites/machines` | 200 4182ms 37667 o | 15 | 3734 |
| `/api/vulnerabilites/vue-ensemble` | 200 4999ms 97120 o | 21 | 4121 |
| `/api/vulnerabilites/machines/parc` | 200 6149ms 372756 o | 15 | 4532 |
| `/api/vulnerabilites/correctifs` | 200 5123ms 582 o | 13 | 4262 |
| `/api/vulnerabilites/rapport?mois=2026-10&format=csv` | 200 5301ms 84471 o | 45 | 4045 |
| `/api/vulnerabilites/recherche?q=CVE-2099-1000` | 200 237ms 2378 o | 15 | 245 |
| `/api/vulnerabilites/veille/avis` | 200 17ms 12884 o | 10 | 2 |
| `/api/registres?archives=false` | 200 2335ms 36082 o | 2072 | 254 |
| `/api/registres/mes-elements` | 200 757ms 78073 o | 637 | 104 |
| `/api/grc/notifications` | 200 250ms 34781 o | 203 | 37 |
| `/api/grc/perimetres/synthese` | 200 871ms 22867 o | 268 | 637 |
| `/api/mur/synthese` | 200 559ms 4758 o | 108 | 412 |
| `/api/tableaux-de-bord` | 200 13ms 3059 o | 15 | 1 |
| `/api/tableaux-de-bord/:id/chiffres` | 200 959ms 4847 o | 158 | 589 |
| `/api/grc/:id/tasks?search=&offset=0` | 200 121ms 51212 o | 58 | 45 |
| `/api/grc/:id/objects?kind=action&search=&offset=0` | 200 46ms 50312 o | 13 | 10 |
| `/api/veille-reglementaire/publications` | 200 10ms 13391 o | 8 | 1 |
| `/api/auth/me` | 200 7ms 2474 o | 6 | 0 |
| `/api/incidents` | 200 286ms 6875453 o | 52 | 58 |
| `/api/retex/invitations` | 200 165ms 2 o | 50 | 44 |

Lectures des faits des avis (`lireFaitsCve`, `apps/api/src/vulnerabilites/sources.ts` l. 143–149) par appel, compte RSSI :

| Route | Réponse (un appel, journal complet actif) | Requêtes SQL | Somme SQL (ms) | Lectures des faits des avis | Leur durée (ms) |
| --- | --- | --- | --- | --- | --- |
| `/api/vulnerabilites/constats` | 200 5083ms 41799 o | 13 | 4547 | 1 | 4201 |
| `/api/vulnerabilites/machines` | 200 4047ms 37667 o | 15 | 3599 | 1 | 3286 |
| `/api/vulnerabilites/vue-ensemble` | 200 4728ms 97120 o | 25 | 3877 | 1 | 3675 |
| `/api/vulnerabilites/machines/parc` | 200 6095ms 372756 o | 18 | 4590 | 1 | 3840 |
| `/api/vulnerabilites/correctifs` | 200 5296ms 582 o | 13 | 4482 | 1 | 3858 |
| `/api/vulnerabilites/rapport?mois=2026-10&format=csv` | 200 5313ms 84471 o | 45 | 4317 | 1 | 4020 |
| `/api/vulnerabilites/veille/avis` | 200 17ms 12884 o | 10 | 2 | 0 | 0 |

### 6.1 ter Veille : dix ans de journal, puis 90 jours

| Route | Compte | 178 473 collectes (dix ans) : méd. / p95 / max | 4 405 collectes (90 jours, après purge) : méd. / p95 / max |
| --- | --- | --- | --- |
| Vulnérabilités : veille (failles) | adm. | 42 / 54 / 54 | 31 / 37 / 37 |
| Veille : avis (page 1, marques parc et Internet) | adm. | 16 / 19 / 19 | 13 / 14 / 14 |
| Veille : avis du CERT Santé (page 1) | adm. | 14 / 16 / 16 | 12 / 13 / 13 |
| Veille : avis page 200 | adm. | 20 / 23 / 23 | 22 / 26 / 26 |
| Veille : avis recherche CVE | adm. | 35 / 48 / 48 | 42 / 51 / 51 |
| Veille : avis recherche titre | adm. | 36 / 46 / 46 | 50 / 52 / 52 |
| Veille : état des sources | adm. | 56 / 82 / 82 | 16 / 30 / 30 |
| Veille : failles du catalogue KEV | adm. | 18 / 21 / 21 | 19 / 21 / 21 |
| Veille : failles recherche produit | adm. | 323 / 434 / 434 | 497 / 624 / 624 |
| Vulnérabilités : veille (failles) | RSSI | 34 / 43 / 43 | 31 / 41 / 41 |
| Veille : avis (page 1, marques parc et Internet) | RSSI | 13 / 14 / 14 | 19 / 25 / 25 |
| Veille : avis du CERT Santé (page 1) | RSSI | 12 / 14 / 14 | 11 / 13 / 13 |
| Veille : avis page 200 | RSSI | 18 / 23 / 23 | 18 / 21 / 21 |
| Veille : avis recherche CVE | RSSI | 33 / 51 / 51 | 32 / 44 / 44 |
| Veille : avis recherche titre | RSSI | 37 / 47 / 47 | 33 / 48 / 48 |
| Veille : état des sources | RSSI | 61 / 78 / 78 | 16 / 18 / 18 |
| Veille : failles du catalogue KEV | RSSI | 19 / 19 / 19 | 17 / 19 / 19 |
| Veille : failles recherche produit | RSSI | 324 / 434 / 434 | 297 / 369 / 369 |

### 6.2 Pages à l'écran (Chromium, temps jusqu'à la page utilisable)

Même critère que le 19/11 : plus aucune requête `/api/` en cours depuis 500 ms (flux `/api/events` exclu) et aucun
indicateur de chargement visible ; cache vide = nouveau contexte, cache chaud = seconde navigation dans le même contexte.
Médiane / p95 en ms ; 15 répétitions administrateur, 5 RSSI. Les échecs `/update/status.json`, `/api/events`,
`/api/settings/logo`, `/api/presence` signalés par le navigateur sont des requêtes annulées par la navigation suivante.
Commande : `V750=1 node banc-pages.mjs 15 admin`, puis `V750=1 node banc-pages.mjs 5 charge01`.

| Page | Adm. cache vide 19/11 | Adm. cache vide 21/11 | Adm. cache chaud 19/11 | Adm. cache chaud 21/11 | RSSI cache vide 19/11 | RSSI cache vide 21/11 | Appels API / Ko (adm., chaud, 21/11) | |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Accueil (tableau de bord) (`/`) | 1261 / 1453 | 1831 / 1954 | 941 / 1120 | 1461 / 1662 | 1144 / 1228 | 1801 / 1949 | 18 / 6868 | tient |
| Tâches récurrentes (`/pilotage/recurrences`) | 2319 / 2678 | 2422 / 2599 | 2026 / 2391 | 2080 / 2585 | 3378 / 3433 | 3579 / 3852 | 24 / 314 | **dépasse** |
| Plan d’actions (`/pilotage/actions`) | 2108 / 2607 | 2248 / 2578 | 1843 / 1961 | 1995 / 2205 | 3319 / 3472 | 3438 / 3540 | 23 / 291 | **dépasse** |
| Risques (`/pilotage/risques`) | 1593 / 1694 | 1781 / 2019 | 1242 / 1380 | 1334 / 1581 | 1523 / 1610 | 1530 / 1622 | 19 / 219 | **dépasse** |
| Registre des incidents (`/pilotage/incidents-registre`) | 1359 / 1554 | 1528 / 1639 | 1065 / 1272 | 1210 / 1296 | 1267 / 1360 | 1405 / 1474 | 18 / 1219 | tient |
| Documents (`/documents`) | 1982 / 2367 | 2175 / 2458 | 1596 / 1923 | 1774 / 1963 | 1745 / 2269 | 1770 / 2402 | 18 / 549 | **dépasse** |
| Vulnérabilités : vue d’ensemble (`/vulnerabilites/vue`) | 2256 / 2537 | 5611 / 6518 | 1967 / 2122 | 5230 / 5943 | 2529 / 2571 | 5289 / 5309 | 21 / 151 | **dépasse** |
| Vulnérabilités : failles (`/vulnerabilites/failles`) | 4954 / 5453 | 4949 / 5838 | 4676 / 4944 | 4774 / 5114 | 13379 / 14035 | 4699 / 4853 | 18 / 93 | **dépasse** |
| Vulnérabilités : machines (`/vulnerabilites/machines`) | 4913 / 6104 | 4938 / 5185 | 4820 / 5158 | 4484 / 4966 | 5379 / 5644 | 4458 / 4536 | 16 / 91 | **dépasse** |
| Vulnérabilités : veille (`/vulnerabilites/veille`) | 1243 / 1382 | 1559 / 1737 | 918 / 1051 | 1244 / 1378 | 1216 / 1260 | 1459 / 1550 | 17 / 95 | tient |
| Journal d’audit (`/systeme/journal`) | 1221 / 2044 | 1521 / 2010 | 917 / 1034 | 1226 / 1391 | 1167 / 1341 | 1359 / 1507 | 16 / 110 | **dépasse** |
| Périmètres (cartes) (`/pilotage/perimetres`) | 1684 / 1767 | 2017 / 2113 | 1422 / 1491 | 1668 / 1924 | 1837 / 1976 | 1986 / 2072 | 19 / 92 | **dépasse** |
| Plan d’actions : frise (`/pilotage/actions?tvue=timeline`) | — | 2296 / 2414 | — | 1948 / 2103 | — | 3404 / 3669 | 23 / 291 | **dépasse** |
| Tâches récurrentes : frise (`/pilotage/recurrences?tvue=timeline`) | — | 2440 / 2655 | — | 2082 / 2172 | — | 3458 / 3472 | 24 / 314 | **dépasse** |
| Veille réglementaire (`/veille-reglementaire`) | — | 1396 / 1540 | — | 1126 / 1300 | — | 1487 / 1512 | 18 / 70 | tient |
| Vulnérabilités : annuaire AD (`/vulnerabilites/annuaire`) | — | 1473 / 1643 | — | 1109 / 1318 | — | 1417 / 1493 | 15 / 110 | tient |

- **Accueil** : 18 appels, **6,9 Mo** en cache chaud (52 Ko le 19/11) : la vue analytique du tableau « Global » charge le
  registre complet des incidents (`GET /api/incidents`, 6,7 Mo) pour ses dalles de compteurs, et 500 lignes du journal
  d'audit (93 Ko) pour l'administrateur (PERF-14).
- **Frises** : la page du plan d'actions s'ouvre déjà sur la frise (même temps avec ou sans `?tvue=timeline`) ; elle charge
  la première page de 50 éléments (51 à 101 Ko selon les tâches qu'ils portent), les séries pour les tâches récurrentes.
- Paquet de l'interface : `index-*.js` 2 280 Ko → **2 504 Ko** (+10 %, 666 → 729 Ko compressé), feuille de style 784 →
  831 Ko (+6 %), chargés par toutes les pages : cohérent avec la hausse générale de 5 à 20 % des pages dont les routes
  n'ont pas changé.

### 6.3 Vingt personnes simultanées (10 min)

Commande : `CHARGE_V750=1 node charge.mjs 20 10 charge20 500 2000` — mêmes 20 comptes, même mélange et mêmes poids que le
19/11, plus trois entrées de la 7.5.0 (liste des tableaux de bord de l'accueil, poids 3 ; cartes d'avis, 2, RSSI ;
publications à qualifier de la veille réglementaire, 2, RSSI) : 113 au lieu de 106 de poids total.

| Indicateur | 19/11 | 21/11 |
| --- | --- | --- |
| Requêtes | 7 945 en 10 min, 13,2 req/s | **8 343 en 10 min, 13,9 req/s** |
| Erreurs | 0 | **0** |
| Médiane / p95 / max (toutes routes) | 38 / 1 098 / 14 927 ms | **37 / 941 / 6 133 ms** |
| Connexions actives de l'API (relevé toutes les 5 s) | 0 à 5 | 0 (40 relevés), 1 (36), 2 (31), 3 (12), 4 (1) sur 120 ; aucune attente de verrou ; 11 à 13 connexions ouvertes |
| Processeur (relevé toutes les 30 s) | API 28 à 132 %, base 38 à 226 % | API 0 à 134 % (médiane 62 %), base 4 à 232 % (médiane 91 %) |
| Mémoire | API 190 à 330 Mio, base 630 à 820 Mio | API 161 à 259 Mio, base 390 à 398 Mio |

| Route (mélange) | Appels 21/11 | Une personne RSSI 21/11 : méd. / p95 | Charge 19/11 : méd. / p95 / max | Charge 21/11 : méd. / p95 / max | p95 charge / une personne (21/11) |
| --- | --- | --- | --- | --- | --- |
| vr-publications | 15 | 8 / 11 | — | 16 / 346 / 346 | ×31.5 |
| me | 247 | 6 / 7 | 9 / 77 / 1329 | 9 / 78 / 548 | ×11.1 |
| accueil-tableaux | 257 | 12 / 15 | — | 17 / 132 / 610 | ×8.8 |
| fiche-action | 661 | 14 / 17 | 18 / 326 / 1767 | 18 / 122 / 510 | ×7.2 |
| vuln-veille-avis | 12 | 19 / 25 | — | 24 / 161 / 161 | ×6.4 |
| actions | 863 | 24 / 31 | 23 / 400 / 1641 | 25 / 148 / 685 | ×4.8 |
| risques-registre | 405 | 27 / 31 | 22 / 346 / 1622 | 23 / 143 / 780 | ×4.6 |
| documents | 411 | 21 / 26 | 30 / 136 / 1375 | 32 / 111 / 618 | ×4.3 |
| risk-map | 224 | 31 / 38 | 29 / 159 / 1644 | 32 / 154 / 415 | ×4.1 |
| notifications | 619 | 235 / 265 | 340 / 1423 / 4182 | 372 / 882 / 1488 | ×3.3 |
| incidents | 382 | 147 / 175 | 181 / 914 / 2120 | 171 / 396 / 850 | ×2.3 |
| vuln-fiche-constat | 20 | 57 / 76 | 27 / 109 / 109 | 50 / 178 / 950 | ×2.3 |
| synthese-perimetres | 235 | 731 / 896 | 862 / 2564 / 3117 | 1116 / 1830 / 2947 | ×2.0 |
| dashboard | 385 | 130 / 164 | 49 / 793 / 1994 | 48 / 329 / 1022 | ×2.0 |
| mes-elements | 296 | 747 / 833 | 874 / 2180 / 3338 | 924 / 1601 / 2224 | ×1.9 |
| tasks | 2278 | 122 / 152 | 27 / 497 / 2112 | 29 / 285 / 1039 | ×1.9 |
| tasks-dashboard | 322 | 151 / 166 | 33 / 313 / 1655 | 37 / 283 / 861 | ×1.7 |
| vuln-fiche-machine | 18 | 238 / 277 | 4385 / 4771 / 4771 | 256 / 438 / 438 | ×1.6 |
| tasks-window | 353 | 120 / 139 | 24 / 456 / 1992 | 23 / 217 / 721 | ×1.6 |
| vuln-vue | 17 | 4507 / 4791 | 2015 / 2372 / 2372 | 4998 / 6133 / 6133 | ×1.3 |
| vuln-machines | 18 | 3728 / 3880 | 4987 / 5655 / 5685 | 4282 / 5158 / 5158 | ×1.3 |
| vuln-constats | 21 | 4042 / 4239 | 12081 / 14746 / 14927 | 4577 / 5001 / 5265 | ×1.2 |
| ecr-action-modifier | 104 | non mesuré seul | 58 / 1022 / 1729 | 49 / 260 / 571 | — |
| ecr-action-creer | 180 | non mesuré seul | 25 / 544 / 1271 | 25 / 183 / 536 | — |

Lecture : la queue est plus courte que le 19/11 (p95 du plan d'actions 400 → 148 ms, notifications 1 423 → 882 ms,
synthèse des périmètres 2 564 → 1 830 ms ; aucun maximum au-delà de 6,2 s, contre 14,9 s), parce que les requêtes de
14 s des constats ont disparu. Mais 13 des 22 routes comparées dépassent encore ×2 au p95 : les courtes attendent derrière
les lourdes sur le fil unique de Node (constats, machines et vue d'ensemble à 4–6 s, rafales de 2 072 requêtes des
registres, 268 de la synthèse des périmètres). Le pool n'est pas en cause.

### 6.3 bis Charge légère d'une heure et mémoire

Commande : `CHARGE_V750=1 node charge.mjs 5 60 legere-1h 2000 6000` (comptes `charge01` à `charge05` : 2 RSSI, 1 lecteur,
2 contributeurs ; réflexion 2 à 6 s) ; `docker stats` toutes les 30 s (120 relevés), connexions toutes les 5 s (720).

| Indicateur | 19/11 | 21/11 |
| --- | --- | --- |
| Requêtes | 3 958 en 1 h, 1,1 req/s | 4 196 en 1 h, 1,16 req/s |
| Erreurs | **3** (500, délai d’attente de 30 s des constats) | **0** |
| Médiane / p95 / max | 30 / 2 017 / 31 808 ms | 25 / 943 / 5 491 ms |
| Mémoire de l’API | 110 à 302 Mio, médiane 146 ; tranches 148, 158, 175, 163, 160, 155 ; pente +7,7 Mio/h | **120 à 263 Mio, médiane 158 ; tranches de 10 min 164, 157, 167, 153, 160, 159 Mio ; pente −6,1 Mio/h : pas de croissance continue** |
| Mémoire de la base | 366 à 536 Mio | 321 à 375 Mio, médiane 342 |
| Connexions actives | 0 (426), 1 (244), 2 (42), 3 (9) sur 721 | 0 (548), 1 (153), 2 (15), 3 (4) sur 720 ; aucune attente de verrou |

| Route | Appels 21/11 | Erreurs 21/11 | 21/11 : méd. / p95 / max (ms) | 19/11 : méd. / p95 / max (erreurs) |
| --- | --- | --- | --- | --- |
| vuln-vue | 40 | 0 | 4863 / 5451 / 5491 | 2051 / 3039 / 3745 (0) |
| vuln-constats | 77 | 0 | 4272 / 4930 / 5094 | 14027 / 28196 / 31808 (3) |
| vuln-machines | 57 | 0 | 4013 / 4649 / 5202 | 4127 / 7641 / 8415 (0) |
| synthese-perimetres | 107 | 0 | 891 / 1050 / 1147 | 720 / 1652 / 16371 (0) |
| mes-elements | 137 | 0 | 777 / 944 / 1398 | 699 / 1490 / 17820 (0) |
| notifications | 290 | 0 | 272 / 398 / 947 | 242 / 546 / 4276 (0) |
| vuln-fiche-machine | 45 | 0 | 250 / 334 / 423 | 3805 / 7131 / 7483 (0) |
| incidents | 203 | 0 | 151 / 229 / 550 | 161 / 408 / 12272 (0) |
| dashboard | 182 | 0 | 37 / 207 / 301 | 35 / 239 / 13251 (0) |
| tasks-dashboard | 165 | 0 | 26 / 165 / 356 | 25 / 218 / 2285 (0) |
| tasks | 905 | 0 | 22 / 161 / 463 | 22 / 223 / 4982 (0) |
| tasks-window | 218 | 0 | 18 / 154 / 424 | 19 / 193 / 459 (0) |
| vuln-veille-avis | 30 | 0 | 21 / 149 / 176 | — |
| ecr-action-modifier | 58 | 0 | 49 / 84 / 102 | 49 / 172 / 1491 (0) |
| vuln-fiche-constat | 54 | 0 | 57 / 78 / 131 | 29 / 61 / 99 (0) |
| ecr-action-creer | 80 | 0 | 28 / 53 / 112 | 30 / 96 / 10490 (0) |
| documents | 199 | 0 | 31 / 51 / 391 | 31 / 88 / 438 (0) |
| risk-map | 103 | 0 | 27 / 47 / 61 | 31 / 83 / 231 (0) |
| accueil-tableaux | 114 | 0 | 17 / 37 / 133 | — |
| risques-registre | 233 | 0 | 20 / 35 / 252 | 21 / 71 / 1195 (0) |
| actions | 427 | 0 | 20 / 35 / 215 | 20 / 88 / 1003 (0) |
| fiche-action | 303 | 0 | 17 / 29 / 235 | 18 / 101 / 632 (0) |
| vr-publications | 37 | 0 | 12 / 20 / 21 | — |
| me | 132 | 0 | 9 / 17 / 503 | 9 / 25 / 373 (0) |

Aucun maximum isolé au-delà de 1,4 s hors vulnérabilités (le 19/11 : 12 à 18 s sur des routes courtes, derrière les
constats de 28 à 32 s).

### 6.4 Opérations

| Opération | Mesure | Commande |
| --- | --- | --- |
| **Mise à jour 7.4.0 → 7.5.0 sur la base pleine** (578 Mo) | **indisponibilité 20,6 s** : arrêt de app, web, gateway 1,0 s ; recréation de db (nouveaux réglages), init, app 19,3 s ; app saine 0,2 s plus tard. Migrations **090, 092 à 099** appliquées au démarrage de l'API entre 09:58:09,3 et 09:58:11,2 UTC (démarrage de Node compris) ; écarts entre journalisations : 092 113 ms, 093 104 ms, 095 69 ms, 094 et 096 à 099 de 7 à 32 ms (0,39 s de 092 à 099) ; 090 non isolable du démarrage de Node (1,5 s à eux deux) ; aucune réécriture de table (colonnes à valeur par défaut constante, contraintes vérifiées sur 10 000 constats). Bien sous 5 min : aucun signalement. | `pile.sh maj` ; journal de l'API (`migration applied`) |
| Synchronisation simulée, première (7.4.0, base vide de vulnérabilités) | 24 000 éléments (1 000 machines, 3 000 constats, 20 000 détections), 48 lots : **56,7 s** (19/11 : 56,4 s) ; réclamation 1,0 s, lots 53,6 s (médiane 1,11 s, p95 1,23 s par lot dont ≈ 1 s de `docker exec`), fin 2,1 s | `node sync-simulee.mjs synchroniser <instance> 1000 3000 20000` |
| Synchronisation simulée, seconde (7.5.0, base pleine, 114 716 détections, veille chargée) | 24 000 éléments, 48 lots : **86,3 s** (19/11 : 76,8 s) ; réclamation 1,0 s, lots 58,0 s (médiane 1,20 s, p95 1,35 s par lot), **fin 27,3 s** (21,0 s) dont une lecture des faits des avis de 3,06 s (PERF-13) ; 94 716 détections devenues absentes, 7 048 lignes de suivi créées pour les constats absents de la synchronisation (même nombre que le 19/11). Demande inscrite en base (« Synchroniser maintenant » renvoie 503 sans exécutant d’exploitation, comme le 19/11). | idem |
| Extrapolation 100 000 détections | non mesurée (borne de 20 000, PERF-09) ; le 19/11 l'estimait à 4 à 5 min de réception | — |
| Sauvegarde | `pg_dump -Fc --no-owner` **15,2 s** (dump 116 Mo pour une base de 713 Mo ; 19/11 : 12,7 s, 106 Mo pour 624 Mo) ; chiffrement age 0,3 s ; déchiffrement 0,2 s | `sauvegarde-restauration.sh` |
| Restauration | `pg_restore --no-owner --role=suivi_app --exit-on-error` dans une base sœur **21,9 s** (17,6 s) ; ANALYZE **2,6 s** (1,7 s) ; requête des constats (RSSI) sur la base restaurée : 308 ms sans statistiques → 215 ms après ANALYZE (19/11 : 4 291 → 2 216 ms) ; indisponibilité estimée d’une vraie restauration ≈ 25 s de base + redémarrage (< 5 min, aucun signalement) | idem |
| **Purge des journaux** (lot PRIO-1), première, sur dix ans | au premier tic après le remplissage : **1 103,6 ms** pour la suppression de 174 069 collectes (journal de PostgreSQL), exécutions (4 059 lignes) sous 300 ms ; entrée `vulnerabilites.journaux.purges` au journal d'audit `{"collectes": 174069, "executions": 4059}`. Plan dans une transaction annulée : 1 364 ms + 71 ms (`explain-purge-dix-ans.txt`). Seconde passe en `psql` (journal réinséré) : 1 043 ms + 69 ms. | `purge-explain.sql` ; redémarrage de l'API |
| Import du rapport de l'Active Directory (300 points × 200 noms, 2,97 Mo) | 1 663 ms (premier), 1 793 ms, **1 812 ms** (troisième : 60 000 noms du premier import effacés) | `node preparer-v750.mjs` |
| Écritures du registre des incidents (3 016 incidents) | création 3 179 / 3 309 ms, modification 2 979 / 3 284 ms (médiane / p95, 15 rép.) ; instantané de 7,66 Mo par écriture | `node ecritures-incidents.mjs` |
| Démarrage de l'API sur la base pleine | sain en 1 à 2 s après la base (deux redémarrages) ; au premier tic, une lecture des faits des avis de 3,4 à 3,7 s (PERF-13) | `docker restart` |

### 6.5 Base de données

**Effet des réglages de PostgreSQL** (point 1 de la demande) :

| Indicateur | 19/11 (`3038043c`, réglages par défaut) | 21/11, 7.4.0 (réglages par défaut) | 21/11, 7.5.0 (256 Mo / 16 Mo / 768 Mo / JIT off) |
| --- | --- | --- | --- |
| Réglages lus dans `pg_settings` | `shared_buffers` 128 Mo, `work_mem` 4 Mo, `effective_cache_size` 4 Go, `jit` on | identiques | 256 Mo, 16 Mo, 768 Mo, off (source `command line`) |
| Fichiers temporaires | 350 fichiers, **3,98 Go** pendant tout le banc | 130 fichiers, 1,4 Go (remplissage et témoin ensemble) | **0 fichier, 0 octet** depuis la remise à zéro (banc à une personne, pages, charge à 20, charge légère) ; toujours 0 en fin de banc (synchronisation, sauvegarde et restauration comprises) |
| Compilation JIT | jusqu'à 1,6 s par requête (machines), 1,7 s (recherche) | active | aucune |
| Lectures servies par le cache partagé | 99,88 % ; `audit_log` 80,2 % | 99,73 % (remplissage compris) | 99,70 % ; `audit_log` 55 % (la recherche sans résultat lit toujours le tas entier, 242 Mo) |
| Routes du socle (témoin → 7.5.0) | — | référence | inchangées à ±15 % (§ 5), sauf la synthèse du mur (PERF-15, due aux tâches) : les rafales et le calcul en Node dominent, pas la base |

Le gain sur les requêtes des vulnérabilités ne se lit pas séparément : le code a changé en même temps (correctifs
PERF-01 à PERF-04) et la lecture des faits (PERF-13) masque tout. Le tri de la requête des constats ne déborde plus sur
disque (« external merge Disk: 6528kB » le 19/11) et le JIT ne coûte plus rien.

Fin de banc (`pg_stat_user_tables`) — base **713 Mo** (579 Mo juste après la mise à jour) ; `audit_log` 352 Mo, `grc_notifications` 87 Mo, **`vulnerabilites_veille_collectes` 52 Mo** pour 4 401 lignes (la place des 174 069 lignes purgées reste à la table : réutilisée par l’autovacuum, pas rendue au système), `grc_objects` 45 Mo, `vulnerabilites_detections` 29 Mo, `vulnerabilites_ad_objets` 24 Mo (120 000 noms des deux derniers imports), `suivi_incidents` 18 Mo (3 Mo avant les écritures mesurées : chaque écriture réécrit la table, PERF-07), `vulnerabilites_veille_cve` 13 Mo, `vulnerabilites_veille_avis` 8,6 Mo, `veille_reglementaire_publications` 4,7 Mo. Le plan de la requête des constats ne déborde plus de `work_mem` (`HashAggregate` en mémoire) ; la sous-requête des machines en fin de support (PRIO-1, CTE `fsm`) coûte 18 à 20 ms pour 5 877 détections (`explain-constats-v750.txt`).

## 7. Défauts

Numérotation : les défauts du 19/11 encore présents gardent leur numéro (PERF-01 à PERF-12, le 19/11 en avait déjà
attribué jusqu'à PERF-12) ; les nouveaux sont numérotés à la suite, **à partir de PERF-13**. « Socle » = session Coeur ;
« module » = Vulnérabilités, veille ou Neon (interface).

### PERF-13 — Lecture des faits des avis : 3,4 à 4,2 s à chaque calcul de priorité sur la veille chargée (nouveau)
- Gravité : **majeur** (cause commune de PERF-01, PERF-02, PERF-04, PERF-05 et des nouvelles routes parc et correctifs, toutes au-delà du double de leur objectif). Module **Vulnérabilités**.
- Mesure : 14 150 avis, liste de 12 898 CVE (toutes celles des constats lisibles) ; une lecture par appel de `GET /api/vulnerabilites/constats`, `/machines`, `/machines/parc`, `/vue-ensemble`, `/correctifs`, `/rapport` : 3 286 à 4 201 ms chacune, soit 80 à 90 % du temps de la route (§ 6.1 bis) ; vue aussi au premier tic de l'API après chaque démarrage (3 446 ms puis 3 693 ms). Dans `psql`, même requête et mêmes paramètres : **3 508 ms**.
- Cause : `apps/api/src/vulnerabilites/sources.ts` l. 143–149, `lireFaitsCve` :
  `FROM vulnerabilites_veille_avis a CROSS JOIN LATERAL unnest(a.cves) AS c(cve) WHERE a.cves && $1::text[] AND c.cve = ANY($1::text[])`
  avec `$1` de 12 898 éléments. Plan : `Seq Scan on vulnerabilites_veille_avis a … (actual time=1.054..3414.509 rows=10852) Rows Removed by Filter: 3298` : l'opérateur `&&` puis `= ANY` comparent chaque CVE de chaque avis au tableau entier, élément par élément (≈ 14 150 × 2,7 × 12 898 comparaisons de texte). Le coût croît comme (nombre d'avis) × (nombre de CVE des constats) : il était invisible sans veille (19/11 : aucun avis) et le restera dans un test sans avis.
- Correction proposée : joindre par hachage sur la liste dédoublonnée au lieu de filtrer par tableau :
  `WITH l AS (SELECT DISTINCT x AS cve FROM unnest($1::text[]) x) SELECT … FROM vulnerabilites_veille_avis a CROSS JOIN LATERAL unnest(a.cves) AS c(cve) JOIN l ON l.cve = c.cve ORDER BY …`.
  Mesuré dans `psql` sur la même requête : **3 508 ms → 97 ms**, mêmes 19 624 lignes (`explain-faits-avis.txt`, `explain-faits-avis-correctif.txt`). Même forme à reprendre l. 122 (`c.cve = ANY(liste)` sur la surface externe, vide ici). Effet attendu : −3,3 à −4,1 s sur chacune des six routes ; constats ≈ 0,7 s, machines ≈ 0,6 s, vue d'ensemble ≈ 1,0 s, parc ≈ 2 s (estimation : temps mesuré moins la lecture des faits, **non mesurée**).
- Reproductible par : `V750=1 REPET=15 node banc-api.mjs une-personne "Vulnérabilités"` ; `compter-faits.sh charge01 /api/vulnerabilites/constats` ; test proposé § 8 (avec des avis).

### PERF-01 — Liste des constats : 4,0 à 4,4 s (était 4,7 s adm. et 14,6 s RSSI)
- Gravité : **majeur (×8,5 à ×8,9 l’objectif de 500 ms ; plus aucun délai d’attente dépassé ; était bloquant)**. Module **Vulnérabilités**.
- Mesure : `GET /api/vulnerabilites/constats` (page 1, 25 lignes, 9 998 constats, 114 716 détections) : administrateur 4 055 / 4 447 / 4 447 ms, RSSI **4 042 / 4 239 / 4 239 ms** (19/11 : 4 425 / 4 711 et 13 010 / 14 563) ; à 20 personnes 4 577 / 5 001 / 5 265 ms ; charge légère d’une heure (5 personnes) 4 272 / 4 930 / 5 094 ms, **aucune erreur** (19/11 : 14 027 / 28 196 / 31 808 ms et 3 erreurs 500). Recherche par CVE : **183 / 241 ms** (adm.) et 186 / 256 ms (RSSI), sous l'objectif (19/11 : 2,5 et 11,2 s).
- Cause : le correctif PERF-01 (lisibilité par machine, `lm AS MATERIALIZED`, `failles.ts` l. 545) a fait disparaître l'écart RSSI / administrateur et la requête SQL des constats tient en 0,25 à 0,3 s (240 ms au journal, 308 ms sous `EXPLAIN ANALYZE`, sans débordement sur disque ; `explain-constats-v750.txt`) ; il reste (a) la lecture des faits des avis pour les 9 998 constats (PERF-13, 3,3 à 4,2 s), (b) le calcul de la priorité en TypeScript pour tous les constats avant de trier et de découper la page (`failles.ts` l. 627–644, ≈ 0,35 s).
- Correction proposée : PERF-13 d'abord (effet attendu ≈ 0,7 s) ; ensuite, pour passer sous 500 ms, garder la priorité calculée par constat (colonne tenue à jour en fin de synchronisation et à chaque collecte de veille, ou cache par numéro de synchronisation et de collecte) pour trier et paginer en SQL.
- Reproductible par : `V750=1 REPET=15 node banc-api.mjs une-personne "constats"`.

### PERF-02 — Liste des machines et parc : 3,7 à 6,0 s (fiche d'une machine : corrigée)
- Gravité : **majeur** (×7,5 à ×12). Module **Vulnérabilités**.
- Mesure : `GET /api/vulnerabilites/machines` 3 855 / 4 077 ms (adm.), 3 728 / 3 880 ms (RSSI) (19/11 : 4 382 / 4 794 et 4 634 / 5 124) ; **`GET /api/vulnerabilites/machines/parc` 5 599 / 5 962 ms** (adm.), 5 398 / 5 741 ms (RSSI), 364 Ko ; **fiche d'une machine : 201 / 231 ms et 238 / 277 ms** (19/11 : 4,0 à 4,8 s), sous l'objectif.
- Cause : PERF-13 (une lecture des faits, 3,3 à 3,8 s) ; reste ≈ 0,4 s de SQL et ≈ 0,5 à 1,5 s de calcul en TypeScript (parc : rangement de 1 000 machines et réponse de 364 Ko).
- Correction proposée : PERF-13 ; pour le parc, ne rendre que les machines de la zone demandée (pagination) plutôt que les 1 000.
- Reproductible par : `V750=1 node banc-api.mjs une-personne "machines"`.

### PERF-04 — Vue d'ensemble des vulnérabilités : 4,5 à 4,9 s (aggravé : 1,9 à 2,1 s le 19/11)
- Gravité : **majeur** (×3,2 l'objectif de 1,5 s ; était mineur). Module **Vulnérabilités**.
- Mesure : `GET /api/vulnerabilites/vue-ensemble` 4 650 / 4 889 ms (adm.), 4 507 / 4 791 ms (RSSI) ; 21 requêtes SQL, dont la lecture des faits 3 675 ms. Le développeur annonçait 1,39 → 0,58 s en médiane : **non reproduit avec la veille chargée** ; sans la lecture des faits, le reste de la route pèse ≈ 1,0 s (estimation, non mesurée seule). Rapport mensuel (CSV) : 4 905 / 5 038 ms, même cause (sous l'objectif de 30 s, remarque).
- Cause : PERF-13.
- Correction proposée : PERF-13 ; puis, si la route reste au-dessus de 1,5 s, mêmes agrégats que le calcul global (une lecture des faits pour la vue et le calcul global, mise en cache par numéro de synchronisation et de collecte).
- Reproductible par : `V750=1 node banc-api.mjs une-personne "vue d’ensemble"`.

### PERF-05 — Pages des vulnérabilités : 4,5 à 6,5 s
- Gravité : **majeur**. Module **Vulnérabilités**.
- Mesure (cache vide, médiane / p95) : `/vulnerabilites/vue` **5 611 / 6 518 ms** (adm., 19/11 : 2 256 / 2 537), 5 289 / 5 309 ms (RSSI) ; `/vulnerabilites/failles` 4 949 / 5 838 ms (adm.), **4 699 / 4 853 ms (RSSI, 19/11 : 13 379 / 14 035)** ; `/vulnerabilites/machines` 4 938 / 5 185 ms et 4 458 / 4 536 ms.
- Cause : PERF-01, PERF-02, PERF-04 (l'écran attend la route lente), donc PERF-13.
- Correction proposée : PERF-13 puis PERF-01, PERF-02, PERF-04.
- Reproductible par : `PAGE=Vulnérabilités V750=1 node banc-pages.mjs 15 admin`.

### PERF-14 — Accueil : le tableau « Global » charge tout le registre des incidents (6,7 Mo) (nouveau)
- Gravité : **remarque** (sous l'objectif de 2 s, mais +45 % par rapport au 19/11 ; poids en charge). Module **Neon** (interface de l'accueil) et socle pour la route d'agrégats.
- Mesure : page d'accueil, cache vide **1 831 / 1 954 ms** (19/11 : 1 261 / 1 453), cache chaud 1 461 / 1 662 ms (941 / 1 120) ; RSSI 1 801 / 1 949 ms (1 144 / 1 228) ; **6,9 Mo** d'API par chargement (52 Ko le 19/11). À 20 personnes, chaque ouverture de l'accueil sérialiserait 6,7 Mo sur le fil de l'API (le mélange de charge n'ouvre que la liste des tableaux).
- Cause : `apps/web/src/components/TableauDeBord.tsx` l. 845–853 (`useDallesTableauDeBord`) : `GET /api/incidents` (registre complet, chronologies comprises) pour les dalles « Incidents » (compteurs et nombre par mois), puis `agregerIncidents` dans le navigateur ; et `GET /api/admin/audit?limit=500` (93 Ko) pour le journal de la vue analytique. Le serveur sait déjà agréger (`tableaux-de-bord/chiffres.ts` l. 49, `agregerIncidents`, utilisé pour les chiffres ouverts).
- Correction proposée : une route d'agrégats des incidents lisibles (mêmes compteurs que `agregerIncidents`, quelques centaines d'octets), ou les agrégats dans `/api/mur/synthese` ; garder `/api/incidents` pour l'écran du registre. Effet attendu : accueil ≈ 1,2 à 1,3 s (niveau du 19/11) et 6,7 Mo de moins par ouverture.
- Reproductible par : `PAGE=Accueil V750=1 node banc-pages.mjs 15 admin` (colonne « Appels API / Ko »).

### PERF-15 — Synthèse du mur : +44 à +58 % (tâches des actions dans `data`) (nouveau)
- Gravité : **remarque** (sous l'objectif de 1,5 s, médiane et p95 en hausse de plus de 20 %). **Socle** (Coeur).
- Mesure : `GET /api/mur/synthese` (appelée par toutes les pages et par l'accueil) 567 / 667 ms (adm.) et 536 / 651 ms (RSSI), contre 358 / 407 et 378 / 429 le 19/11, et **393 / 500 et 361 / 414 au témoin 7.4.0 du jour** ; cartes des périmètres 828 / 953 et 731 / 896 ms (témoin 708 / 857 et 609 / 643 : +17 à +20 % en médiane, même cause probable, non vérifiée).
- Cause : la requête des échéances de la synthèse (`apps/api/src/tableau-de-bord.ts` l. 203–216) lit 6 fois `o.data->>…` sur toutes les actions de la portée ; depuis la 7.5.0, 2 201 actions portent leurs tâches dans `data` (jusqu'à 50, ≈ 8 Ko), qui passe en TOAST et se décompresse à chaque accès. Mesuré dans `psql`, même requête, même session : **260 ms avec les tâches, 121 ms sans** (tâches retirées dans une transaction annulée ; `explain-mur-echeances-taches.txt`). Sur 108 requêtes de la synthèse, celle-ci pèse 284 ms (`mesures.json`, `murSyntheseRequetesLentes`).
- Correction proposée : ne lire de `data` que les clés utiles une seule fois par ligne (`CROSS JOIN LATERAL (SELECT o.data->>'dueAt' AS due, o.data->>'status' AS st, …)`), ou ranger les tâches hors de `data` (table ou colonne à part, ADR 0111) ; à terme, colonnes générées `due_at` et `status` indexées. Effet attendu : −140 ms sur la synthèse (niveau du témoin), et autant sur chaque page qui l'appelle.
- Reproductible par : `requetes-lentes-appel.sh charge01 /api/mur/synthese` ; `capturer-requete.sh charge01 /api/mur/synthese "left(o.data->>'dueAt',10) due" req.sql`, puis la requête avant et après `UPDATE grc_objects SET data = data - 'taches'` dans une transaction annulée.

### PERF-16 — Rapport mensuel des vulnérabilités : 1,8 s → 4,9 s (nouveau)
- Gravité : **remarque** (sous l'objectif de 30 s, ×2,7). Module **Vulnérabilités**.
- Mesure : `GET /api/vulnerabilites/rapport?mois=2026-10&format=csv` 4 905 / 5 038 ms (adm.) et 4 791 / 4 990 ms (RSSI), 82 Ko (19/11 : 1 770 / 1 833 et 1 874 / 1 906) ; 45 requêtes, dont une lecture des faits des avis de 4 020 ms.
- Cause et correction : PERF-13.
- Reproductible par : `node banc-api.mjs une-personne "Rapport mensuel"`.

### PERF-06 — Liste des registres appelée par toutes les pages : 0,8 s (adm.), 2,0 à 2,4 s (RSSI)
- Gravité : **majeur** pour un non-administrateur (×4,8), mineur pour l'administrateur. **Socle** (Coeur).
- Mesure : `GET /api/registres?archives=false` 786 / 884 ms (adm.), **1 959 / 2 400 ms** (RSSI) (19/11 : 734 / 865 et 1 896 / 2 517) ; **2 072 requêtes SQL exécutées par appel** (RSSI) pour 254 ms de temps SQL cumulé : le reste est l'attente des allers-retours successifs.
- Cause : inchangée (`grc/registres.ts` l. 533, droits et description registre par registre) ; le code n'a pas changé depuis le 19/11.
- Correction proposée : inchangée (droits de la personne sur tous les registres en une requête, puis composition en mémoire ; effet attendu < 100 ms).
- Reproductible par : `compter-requetes.sh charge01 "/api/registres?archives=false"` ; `node banc-api.mjs une-personne "Coquille"`.

### PERF-07 — Écriture dans le registre des incidents : 3,0 à 3,3 s
- Gravité : **majeur** (jugé comme une fiche, objectif d'écriture à fixer par le RSSI). **Socle** (Coeur).
- Mesure : à 3 016 incidents, `POST /api/incidents` **3 179 / 3 309 ms**, `PATCH /api/incidents/:id` 2 979 / 3 284 ms (15 répétitions ; 19/11 : 2 633 / 2 849 et 2 703 / 2 991) ; instantané de 7,66 Mo (715 Ko compressés) ajouté à `state_history`.
- Cause : inchangée (réécriture complète de `suivi_incidents` et instantané de l'état historique à chaque écriture, ADR 0040) ; code non modifié depuis le 19/11.
- Correction proposée : inchangée (écriture de la seule ligne ; instantané limité ou différé).
- Reproductible par : `node ecritures-incidents.mjs`.

### PERF-08 — Pages des tâches récurrentes, du plan d'actions (frises), des documents, des risques, du journal et des périmètres au-delà de 2 s
- Gravité : **mineur** (×1,0 à ×1,9). **Socle** (rafales des appels communs) et **Neon** (poids du paquet de l'interface).
- Mesure (cache vide, médiane / p95) : tâches récurrentes 2 422 / 2 599 ms (adm.), **3 579 / 3 852 ms (RSSI)** ; plan d'actions (frise) 2 248 / 2 578 ms et 3 438 / 3 540 ms ; documents 2 175 / 2 458 ms et 1 770 / 2 402 ms ; risques 1 781 / 2 019 ms (adm., passe au-dessus de 2 s au p95) ; journal 1 521 / 2 010 ms ; périmètres 2 017 / 2 113 ms et 1 986 / 2 072 ms.
- Cause : celles du 19/11 (21 à 24 appels par page, `/api/registres` PERF-06, cloche 203 requêtes, synthèse, RETEX et crise qui recomposent l'état historique), plus un paquet de l'interface 10 % plus lourd (`index-*.js` 2 280 → 2 504 Ko, chargé par toutes les pages) : hausse générale de 5 à 20 % des pages dont les routes n'ont pas changé.
- Correction proposée : PERF-06 et celles du 19/11 ; découpage du paquet (chargement différé des écrans de la vue analytique, des frises et de la cartographie).
- Reproductible par : `PAGE="Tâches" V750=1 node banc-pages.mjs 15 admin`.

### PERF-09 — Synchronisation de 100 000 constats impossible
- Gravité : **bloquant** au sens du modèle ; borne voulue (`TENABLE_BORNES` inchangé : 20 000 détections, 100 pages, 480 s) : **décision du RSSI**. Module **Vulnérabilités**.
- Mesure : une synchronisation est toujours bornée à 20 000 détections ; à la borne, la réception prend 56,7 s sur une base vide de vulnérabilités et **86,3 s** sur la base pleine (dont 27,3 s de fin, PERF-13 compris).
- Correction proposée : inchangée (relever les bornes après PERF-13 et PERF-01, ou synchroniser par dépôt). L'import de fichiers `.nessus` (lot N1, 10 000 machines par import) est une autre voie de volume, non mesurée ici.
- Reproductible par : `node sync-simulee.mjs synchroniser <instance> 1000 3000 20000`.

### PERF-10 — Vingt personnes simultanées : dégradation au-delà de ×2
- Gravité : **majeur** (p95 en charge / à une personne au-delà de ×2 sur 13 des 22 routes comparées, jusqu'à ×11 pour la session et ×7 pour la fiche d'une action ; ×31 pour les publications de la veille réglementaire, sur 15 appels seulement) ; aucune erreur. **Socle** (fil unique de l'API) et module Vulnérabilités (routes de 4 à 6 s).
- Mesure : 8 343 requêtes, 13,9 req/s, 0 erreur, p95 global 941 ms (19/11 : 1 098) ; synthèse des périmètres 1 830 ms au p95 (au-delà de 1,5 s), mes éléments 1 601 ms, notifications 882 ms ; la queue a raccourci partout depuis le 19/11 (§ 6.3).
- Cause : fil unique de l'API ; requêtes de 4 à 6 s des vulnérabilités (PERF-13) et rafales (PERF-06 : 2 072 requêtes ; synthèse des périmètres 268 ; mes éléments 637 ; cloche 203).
- Correction proposée : PERF-13, PERF-06, PERF-11 et les rafales ; ensuite seulement plusieurs processus Node.
- Reproductible par : `CHARGE_V750=1 node charge.mjs 20 10 charge20 500 2000` puis `python3 comparer.py <banc>`.

### PERF-11 — « Mes éléments » : 0,75 à 0,83 s pour un non-administrateur
- Gravité : **mineur** (×1,7). **Socle**.
- Mesure : `GET /api/registres/mes-elements` 348 / 377 ms (adm.), **747 / 833 ms (RSSI)** ; 637 requêtes SQL exécutées par appel.
- Cause et correction : inchangées (regroupement des droits comme PERF-06).
- Reproductible par : `node banc-api.mjs une-personne "mes éléments"`.

### PERF-12 — Recherche sans résultat dans le journal d'audit : 1,5 à 1,7 s
- Gravité : **mineur** (×1,1). **Socle**.
- Mesure : `GET /api/admin/audit?q=zzz-introuvable` 1 521 / 1 651 ms (19/11 : 1 471 / 1 600) ; `shared_buffers` porté à 256 Mo n'y change rien (la table fait 242 Mo de tas, 110 Mo d'index).
- Cause et correction : inchangées (période par défaut, `ip <<= inet`, éventuellement trigrammes).
- Reproductible par : `SANS_CHARGE=1 node banc-api.mjs journal "Journal"`.

### Défauts du 19/11 résolus
- **PERF-03** (recherche des vulnérabilités, 4,4 à 4,6 s) : **207 / 256 ms** (adm.), 208 / 290 ms (RSSI), 15 requêtes SQL ; sous l'objectif de 1,5 s.
- **Fiche d'une machine** (partie de PERF-02) : 201 / 231 ms et 238 / 277 ms.
- **Recherche de constat par CVE** (partie de PERF-01) : 183 / 241 ms et 186 / 256 ms.
- **Fichiers temporaires et JIT** (observations du 19/11) : 0 fichier temporaire depuis la remise à zéro des statistiques (§ 6.5), aucune compilation JIT (`jit` off).
- **Délai d'attente de 30 s dépassé** sur la liste des constats en charge légère : plus aucun en une heure de charge légère (77 appels de la liste des constats, 0 erreur ; 3 sur 65 le 19/11). Attention : le 19/11, la charge légère tournait sur 2 952 constats à traiter (après une seconde synchronisation) ; aujourd’hui sur les 9 998.

### Observations (sous l'objectif, sans gravité ou remarque)

- **Chiffres d'un tableau public ou partagé** (calculés avec les droits de l'auteur) : 691 / 770 ms et 694 / 787 ms (RSSI),
  158 requêtes SQL : sous l'objectif de 1,5 s ; ils recalculent la synthèse de l'auteur et ses incidents à chaque lecture
  (limite de débit par personne, `tableauChiffres`). Pas de cache : à surveiller si un tableau public est affiché sur un
  écran mural rafraîchi souvent.
- **Veille réglementaire** : toutes les lectures sous 40 ms (liste filtrée, synthèse, fiche, recherche plein texte
  `ILIKE` 22 à 33 ms sur 9 500 publications) ; qualification 13 / 17 ms. La pagination s'arrête à la page 400 (10 000
  publications, `RecherchePublications.page.max(400)`) : au rythme retenu (≈ 950 par an), les plus anciennes ne seront plus
  atteignables sans filtre après une dizaine d'années. Le journal des collectes réglementaires n'est pas purgé (14 568
  lignes en dix ans à 24 h, ≈ 87 000 à 4 h) : sans effet mesurable ici.
- **Cartes d'avis** (marques « présente sur le parc », « exposée sur Internet ») : 13 à 25 ms (page 1), 18 à 26 ms (page
  200), recherche par CVE 32 à 51 ms ; deux lectures d'ensemble par page, comme annoncé. La marque « exposée » n'est pas
  mesurée à volume (surface externe vide).
- **Purge des journaux** (lot PRIO-1) : première purge réelle sur dix ans de journal **1,10 s** pour 174 069 collectes
  (requête des exécutions sous 300 ms, 4 059 lignes), dans la transaction du tic ; plan : parcours séquentiel et une
  recherche d'index par ligne (`Index Searches: 174069`, 0,006 ms chacune). Pas d'effet sur la disponibilité.
- **Annuaire AD** : import de 300 points × 200 noms (2,97 Mo) **1 663 à 1 812 ms** ; lecture de la synthèse 10 / 12 ms, des
  noms d'un point (200 noms) 10 à 13 / 18 à 20 ms. Le corps maximal admis (8 Mio, noms de 64 caractères) n'a pas été
  essayé.
- **Tâches des actions** : une action à 50 tâches se lit en 10 à 13 ms, se modifie en 19 / 26 ms ; les listes portent les
  tâches de chaque action (page de 50 éléments : 51 à 101 Ko au lieu de 34 Ko), sans effet mesurable sur leur temps.
- **Tableaux de bord** : liste 11 / 19 ms, tableau 10 à 16 ms, création 27 / 31 ms, suppression 14 / 16 ms ; la liste fait
  15 requêtes SQL.

## 8. Tests de non-régression proposés

Propositions, non écrites dans `apps/` (règle du banc). Le test `apps/api/test/performance-vulnerabilites.test.ts`, ajouté
par le correctif PERF-01 à PERF-04, existe désormais ; il ne contient **aucun avis** de veille, et ne peut donc pas voir
PERF-13.

1. **Compléter `performance-vulnerabilites.test.ts` avec une veille chargée** (PERF-13, PERF-01, PERF-04) : ajouter au
   jeu 10 000 avis (CERT-FR et CERT Santé, 1 à 6 CVE citées chacun, la moitié présentes sur le parc) et 20 000 CVE de
   veille ; mêmes assertions (p95 < 800 ms pour les listes, < 1 500 ms pour la vue d'ensemble), plus une assertion sur la
   lecture des faits seule :

   ```ts
   const t0 = performance.now();
   const faits = await lireFaitsCve(svc.db.k, cvesDesConstats); // 10 000 CVE ou plus
   expect(performance.now() - t0).toBeLessThan(300);
   expect(faits.size).toBe(attendu); // même résultat qu'avant la réécriture
   ```
2. **Accueil sans registre complet** (PERF-14) : test de l'interface (`apps/web/test`) qui monte `useDallesTableauDeBord`
   avec un `fetch` simulé et vérifie qu'aucun appel à `/api/incidents` n'est fait (ou, côté API, qu'une route d'agrégats
   rend moins de 2 Ko pour 3 000 incidents).
3. **Nombre de requêtes SQL par appel** (PERF-06, PERF-10, PERF-11) : celui proposé le 19/11, avec le comptage des
   seules exécutions (le 19/11 comptait aussi `parse` et `bind`) : `GET /api/registres` (60 registres, compte non
   administrateur) ≤ 40 exécutions ; aujourd'hui 2 072.
4. **Purge des journaux** (lot PRIO-1, observation) : 200 000 collectes sur dix ans ; `PurgeJournaux.purger()` < 5 s et
   garde la dernière collecte de chaque source (le test fonctionnel existe ; seul le volume manque).
5. **Banc complet** : versionner `docs/05_RECETTE/performance/2026-11-21/mesures/` dans `tests/perf/` si le RSSI le
   décide, et le rejouer avant chaque version majeure sur le serveur de recette (les seuils du RSSI y ont leur sens).

## 9. Ce qui relève d'une décision du RSSI

- **PERF-09** : inchangé depuis le 19/11 (bornes de synchronisation de Tenable).
- **PERF-14** : contrat de l'accueil (une route d'agrégats des incidents, ou des agrégats dans la synthèse) ; changement
  visible du contrat d'API, à cadrer avec le module Neon.
- **Ordre des correctifs** : PERF-13 (une requête, module Vulnérabilités) ramène d'un coup six routes de 4 à 6 s vers
  0,6 à 2 s ; c'est le premier correctif à organiser, avant de juger ce qui reste de PERF-01, PERF-02 et PERF-04.
- **Seuils** : toujours à confirmer pour les appels de la coquille et pour les écritures (PERF-07 jugé comme une fiche).
- **Registre des incidents dans l'état historique** (PERF-07), **pagination** du registre et de l'état du suivi, **fil
  unique de l'API** (PERF-10) : inchangés depuis le 19/11.
- **Conservation** : journal des collectes de la veille réglementaire sans purge ; pagination de la veille réglementaire
  bornée à 10 000 publications.
- **Versionner le banc** dans `tests/perf/` (scripts de ce passage, dans `mesures/`).

## 10. Reproduire

Variables d'environnement attendues : `BANC` et `DEPOT_750` (dossiers de travail), `BANC_CA_PILE` (autorité locale de la
pile, copie de `gateway:/data/caddy/pki/authorities/local/root.crt` : le client vérifie le certificat, il ne désactive
jamais la vérification), `BANC_CA` et `BANC_PROXY` (autorité et mandataire de sortie du poste, pour `construire.sh`).
Ajout du 21/11 à la relecture de la session Coeur, après le passage du banc : client sans désactivation du contrôle du
certificat et lecture de la session enregistrée sans test d'existence préalable (alertes CodeQL), non rejoué depuis.

Scripts du banc dans [`mesures/`](mesures/) (le dossier ne contient que des scripts, des mesures sans secret et des plans
d'exécution ; les identifiants de recette restent hors dépôt, dans `/srv/suivi-banc-perf`, effacé à la fin) :
`pile.sh` (pile jetable, `demarrer` en 7.4.0, `maj` en 7.5.0, `arreter`), `construire.sh` (images), `installer.mjs`,
`remplir-api.mjs`, `remplir-sql.sql`, `sync-simulee.mjs`, `lier-depots.mjs`, `remplir-vulns.sql`, `remplir-v750.sql`,
`preparer-v750.mjs`, `reinserer-journaux.sql`, `purge-explain.sql`, `banc-api.mjs`, `banc-pages.mjs`, `charge.mjs`,
`ecritures-incidents.mjs`, `ecritures-v750.mjs`, `compter-requetes.sh`, `compter-tout.sh`, `compter-faits.sh`,
`extraire-requete.py`, `sauvegarde-restauration.sh`, `etat-base.sh`, `stats.py`, `comparer.py`, `avant-apres.py`,
`pages-avant-apres.py`, `charge-avant-apres.py`, `bruit-temoin.py`, `legere-table.py`, `compter-objectifs.py`,
`capturer-requete.sh`, `requetes-lentes-appel.sh`, `purge-appliquer.sql`, `assembler-json.py`, `assembler-rapport.py`.

Ordre : `construire.sh` → `pile.sh demarrer` (7.4.0, `"needed":true`) → `installer.mjs` → `remplir-api.mjs` → attendre
l'automate (18 000 occurrences) → `psql -f remplir-sql.sql` → `sync-simulee.mjs preparer` puis
`synchroniser <id> 1000 3000 20000` → `lier-depots.mjs` → `psql -f remplir-vulns.sql` → `ANALYZE` →
`REPET=15 node banc-api.mjs v740-une-personne` (témoin) → `pile.sh maj` → `etat-base.sh` (réglages) →
`psql -f remplir-v750.sql` → `preparer-v750.mjs` → `pg_stat_reset()` → `V750=1 REPET=15 node banc-api.mjs
v750-une-personne` → pages → charges → écritures → synchronisation → `sauvegarde-restauration.sh` → `pile.sh arreter`.
La purge des journaux part au premier tic de l'API (une minute) : pour mesurer les routes avec dix ans de journal,
réinsérer celui-ci après une purge (`reinserer-journaux.sql`) et mesurer dans l'heure. Les scripts supposent la variable
`BANC` (dossier de travail du banc), `DEPOT_750` (arbre du commit testé) et un Chromium du système ; `pile.sh` attend le
code de la 7.4.0 dans `$BANC/src740` (`git archive v7.4.0`) et l'arbre de travail du commit testé.

Fin du banc : pile arrêtée (`pile.sh arreter` : conteneurs, réseaux et volumes supprimés), dossier `/srv/suivi-banc-perf` effacé (identifiants et sessions de recette compris), images `perf740` et `perf750` et sources de la 7.4.0 supprimées ; aucune autre image ni conteneur touché.
