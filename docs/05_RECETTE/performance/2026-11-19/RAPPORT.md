# Banc de performance « dix ans d'exploitation » — rapport du 19/11/2026

> Premier passage du banc (agent `banc-performance`), à la demande du RSSI. Données entièrement fictives, pile jetable
> détruite à la fin. Les mesures viennent d'un conteneur de développement partagé : elles **ne valent pas mesure sur le
> serveur réel** ; elles valent comparaison relative (avant / après correctif) et ordre de grandeur.

## 1. Cadre

| Élément | Valeur |
| --- | --- |
| Commit testé | `3038043c` (branche `claude/analyse-statistiques`, version 7.4.0 + ANALYZE après restauration et synchronisation, PR #332) |
| Images | construites depuis ce commit (`docker buildx build`, étiquette locale `perf3038`) : api `23309a7b1fb9`, web `de7364f36b09` |
| Date, fuseau | 19/11/2026, 21 h 00 – 00 h 05 (Europe/Paris) |
| Machine | conteneur de développement : 4 vCPU Intel Xeon 2,1 GHz, 15 Go de RAM, disque partagé (≈ 15 Go libres pendant le banc) ; démon Docker local |
| Pile | projet Compose `suivi-banc-perf`, adresse `127.0.0.77`, données dans `/srv/suivi-banc-perf` ; services init, db (PostgreSQL 18.6, `mem_limit` 1 Go, `shared_buffers` 128 Mo, `work_mem` 4 Mo, `jit` actif par défaut), app (`mem_limit` 768 Mo, pool de 10 connexions), web, gateway. Updater et antivirus non démarrés. |
| Écarts au réglage de production | `MFA_REQUIRED=false` (connexion scriptée des 20 comptes), `RATE_LIMIT_PER_MINUTE=100000` (toutes les personnes simulées partagent une adresse), `EXPLOITATION_AUTO=0` (pas d'opération automatique pendant les mesures). Limite de 20 connexions par adresse et par 15 min : contournée en réutilisant les sessions (trois redémarrages de l'API pendant le remplissage, un pour le diagnostic avant les mesures, aucun pendant les mesures). Diagnostic : `auto_explain` activé quelques minutes puis retiré avant les mesures ; `log_min_duration_statement = 300 ms` laissé actif pendant les mesures (coût négligeable). |
| Premier contact | `GET /api/setup` → `"needed":true` (pile vierge), installation par l'API (compte de recette fictif, poivre généré, clé de secours age jetable). |
| Rapport précédent | aucun (`docs/05_RECETTE/performance/` n'existe pas) : pas de comparaison possible ; seul repère, le budget du test TEST-043 (p95 < 800 ms sur 10 000 risques, exécuteur de CI). |

## 2. Volumes atteints

| Objet du profil | Cible | Atteint | Chemin |
| --- | --- | --- | --- |
| Périmètres | 30 | 30 (4 établissements et 24 sites rattachés, taille inégale : loi de Zipf, le premier ≈ 12 %) | API |
| Comptes | 300 | 300 (administrateur, RSSI, contributeurs, lecteurs) ; 853 accès à des périmètres | API (≈ 350 ms par compte : hachage du mot de passe) |
| Tâches d'exploitation récurrentes | 150 / mois × 10 ans = 18 000 | 151 séries mensuelles commencées en déc. 2016, **18 114 occurrences** (actions) générées par l'automate de l'application ; 93 % des occurrences de plus de 45 jours passées « faites », le reste en retard ou annulé | API + automate (statuts mis à jour en base) |
| Plan d'actions | 5 000 | 5 000 actions (hors occurrences) ; 23 114 actions au total | 58 par l'API, le reste en base |
| Vulnérabilités : constats | 100 000 | **interprétation** : 114 718 **détections** (contrôle × machine × port) sur 10 000 constats (un constat = un contrôle Tenable, unique par instance) ; 80 % des détections sur 20 % des machines | 24 000 éléments par une synchronisation simulée (chemin normal), le reste en base |
| Vulnérabilités : machines | 1 000 | 1 000, 6 dépôts reliés à 6 périmètres, 80 machines avec périmètre propre | synchronisation simulée |
| Veille : CVE | 20 000 | 20 000 (`CVE-2099-nnnnn`, 5 % au catalogue KEV fictif) | base |
| Incidents (avec chronologies) | 3 000 | 3 000 (30 par l'API), 8 événements de chronologie chacun (23 760) | API + base (`suivi_incidents`) |
| Risques | 2 000 | 2 000 (24 par l'API), méthode ISO 27005 publiée dans chaque périmètre | API + base |
| Documents | 2 000 fiches | 2 000 (20 avec pièce déposée par l'API) | API + base |
| Journal d'audit | 2 000 000 | 2 000 010 lignes sur dix ans (densité croissante) | base + activité réelle |
| Notifications | 200 000 | 200 346 (rappels d'échéance, 90 % lues) | base + automate |

- **Forme du profil** : « 100 000 constats » n'a pas d'équivalent direct. Dans l'application, un constat est un contrôle
  Tenable, unique par instance (`UNIQUE (integration_id, plugin_id)`) ; 100 000 contrôles distincts sur 1 000 machines ne
  sont pas réalistes. Le banc a donc rempli 100 000 **détections** (et un peu plus). De plus, **une synchronisation est bornée
  par conception à 20 000 détections** (`TENABLE_BORNES.detections`, 100 pages de 200 ; bilan refusé au-delà) : une
  synchronisation de 100 000 constats ou détections est **impossible** (voir PERF-09).
- **Incidents** : le registre des incidents vit dans l'état historique (`suivi_incidents`, ADR 0040), pas dans `grc_objects` ;
  les chronologies (RETEX) sont rangées dans la colonne `extra` de chaque incident.
- Remplissage : API ≈ 4 min (dont 106 s pour 300 comptes) ; automate : 18 114 occurrences en ≈ 4 min (50 par série et par
  passage d'une minute) ; SQL : 48 s (dont journal d'audit 20 s, notifications 27 s) ; vulnérabilités : synchronisation
  simulée 56 s + 7,6 s en base. `ANALYZE` complet après le remplissage direct (1,9 s).
- Base après remplissage : **589 Mo** (`pg_database_size`). Plus grosses relations : `audit_log` 351 Mo (tas 242 Mo,
  index 109 Mo : `audit_log_ts` 54 Mo, `audit_log_pkey` 43 Mo, `audit_log_action` 13 Mo), `grc_notifications` 84 Mo,
  `grc_objects` 57 Mo, `vulnerabilites_detections` 27 Mo, `grc_object_versions` 21 Mo. Aucune ligne morte après
  remplissage ; autovacuum et autoanalyze passés sur toutes les grosses tables.

## 3. Ce qui a été mesuré, ce qui ne l'a pas été

Mesuré : 53 routes d'API à une personne (administrateur et RSSI non administrateur, 1 échauffement + 15 répétitions,
5 pour les exports) ; 12 pages dans Chromium (cache vide et cache chaud, 15 répétitions administrateur, 5 RSSI) ;
20 personnes simultanées pendant 10 min ; 1 h de charge légère avec la mémoire relevée toutes les 30 s ;
synchronisation simulée à la borne (deux fois) ; écritures dans le registre des incidents ; sauvegarde (pg_dump + age) et
restauration (pg_restore + ANALYZE) dans une base sœur ; plans `EXPLAIN (ANALYZE, BUFFERS)` des requêtes lentes ; nombre de
requêtes SQL par appel ; points signalés par le conseiller.

**Non mesuré** :
- Synchronisation de 100 000 détections : impossible par conception (borne de 20 000) ; seule la réception côté application
  d'une synchronisation à la borne est mesurée. Le script `integration-http.py` (lecture de Tenable) n'est pas exercé
  (aucun Tenable simulé) : sa durée de lecture est hors mesure.
- Rejeu des migrations sur une copie de la base pleine : toutes les migrations du commit sont déjà appliquées ; il n'existe
  pas de migration plus récente à rejouer. La durée d'une mise à jour réelle n'est donc pas mesurée (seul le démarrage de
  l'API sur une base déjà remplie l'est indirectement : sain en moins de 30 s).
- Sauvegarde et restauration par `scripts/backup.sh` / `restore.sh` eux-mêmes (ils supposent le `.env` et l'updater de
  l'installation) : mesurées avec leurs primitives (mêmes commandes `pg_dump`, `age`, `pg_restore`, `ANALYZE`), sans
  l'arrêt-redémarrage des conteneurs.
- Pages des autres modules (cartographie, continuité, fournisseurs, conformité, assistant) : non mesurées (non concernées par
  le profil de volume).
- État des vulnérabilités pendant la charge légère : la seconde synchronisation simulée (complète) a proposé « corrigés, à
  confirmer » 7 048 constats absents de la synchronisation ; les détections ont été remises « présentes » en base, mais ces
  propositions restent : la liste des constats de la charge légère est plus courte (2 952 constats à traiter au lieu de 9 946).
- Charge d'une heure à 20 personnes : non tenue (temps) ; la charge longue est une charge légère (5 personnes pendant 1 h, temps de réflexion 2 à 6 s).

## 4. Synthèse

**Ne tient pas la charge du profil** : d'abord le module Vulnérabilités (bloquant), ensuite les écritures du registre des
incidents, la coquille commune des pages et la tenue à 20 personnes (majeurs). Le reste (tâches récurrentes, plan d'actions,
risques, incidents en lecture, documents, journal d'audit, notifications, exports) tient les objectifs **à une personne** ;
à 20 personnes pendant 10 min, aucune erreur, mais une dégradation au-delà de ×2 sur 13 des 19 routes comparées ; en
charge légère d'une heure, **3 délais d'attente dépassés (erreurs 500)** sur la liste des constats. Mémoire de l'API stable.

| Gravité | Nombre | Défauts |
| --- | --- | --- |
| Bloquant | 2 | PERF-01 constats (4,7 s adm. / 14,6 s RSSI à une personne ; **délai d'attente de 30 s dépassé** 3 fois en charge légère), PERF-09 (synchronisation de 100 000 détections impossible : borne de 20 000 par conception) |
| Majeur | 6 | PERF-02 machines et fiche machine (4,2 à 5,1 s), PERF-03 recherche vulnérabilités (4,6 s), PERF-05 pages Vulnérabilités (5 à 14 s), PERF-06 liste des registres de la coquille (2,5 s RSSI), PERF-07 écritures du registre des incidents (2,6 à 3,0 s), PERF-10 dégradation à 20 personnes (p95 ×2,7 à ×15 sur 13 routes) |
| Mineur | 4 | PERF-04 vue d'ensemble des vulnérabilités (1,9 à 2,1 s), PERF-08 pages tâches récurrentes, plan d'actions, documents, journal (2,0 à 3,5 s), PERF-11 « mes éléments » (0,73 s RSSI), PERF-12 recherche sans résultat dans le journal d'audit (1,6 s) |
| Remarque | — | aucune au sens du modèle (pas de rapport précédent) ; observations en fin du § 7 |

Chiffres clés (p95, conteneur de développement, 4 vCPU) :
- Listes et fiches : 32 des 37 routes mesurées sous 500 ms pour tous les comptes ; plan d'actions 26 ms, tâches 152–181 ms,
  risques 29–31 ms, incidents 157–254 ms (mais 6,7 Mo non paginés), documents 24–29 ms, journal 8–19 ms, notifications
  274–290 ms. Au-delà : constats, machines, fiche machine, liste des registres (coquille), « mes éléments » (RSSI).
- Vulnérabilités : constats 4,7 s (administrateur) et **14,6 s** (RSSI non administrateur), machines 4,8–5,1 s, fiche d'une
  machine 4,2–4,8 s, recherche 4,4–4,6 s, vue d'ensemble 1,9–2,1 s.
- Tableaux de bord, cartes et recherches : 15 des 19 routes sous 1,5 s ; au-delà : vue d'ensemble des vulnérabilités,
  recherche des vulnérabilités, recherche de constat par CVE, recherche sans résultat du journal. Synthèse des périmètres
  0,69–0,80 s.
- Exports et rapports : les 5 mesurés sous 2 s (objectif 30 s).
- Pages : 7 pages sur 12 au-delà de 2 s au p95 (administrateur, dont le journal pour un seul chargement sur 15) ; failles
  5,5 s (adm.) et 14 s (RSSI), machines 6,1 s ; tâches récurrentes et plan d'actions 2,6–3,5 s.
- 20 personnes, 10 min : 7 945 requêtes, 13,2 req/s, **0 erreur**, p95 global 1,1 s ; pool de 10 connexions jamais saturé
  (5 actives au plus, relevé toutes les 5 s) ; processus Node de l'API à 45–95 % d'un cœur : le goulot est le fil unique de
  l'API, pas la base.
- Mémoire de l'API : **stable sur 1 h** de charge légère (120 relevés) : 110 à 302 Mio, médiane 146 Mio ; moyenne du premier
  quart 152 Mio, du dernier 158 Mio ; moyennes par tranche de 10 min 148, 158, 175, 163, 160, 155 Mio : pas de croissance
  continue (pente + 7,7 Mio/h, dans le bruit du ramasse-miettes). Base : 366 à 536 Mio.
- **Charge légère (5 personnes, 1 h) : 3 erreurs 500** sur 65 appels de la liste des constats (délai d'attente de 30 s
  dépassé, `canceling statement due to statement timeout`) ; constats p50 14,0 s, p95 28,2 s, max 31,8 s.
- Sauvegarde (pg_dump) 12,7 s, restauration (pg_restore) 17,6 s, ANALYZE 1,7 s ; archive 106 Mo pour une base de 624 Mo.
- Synchronisation simulée à la borne (24 000 éléments) : 56 s (première), 77 s (seconde, base pleine, dont 21 s de fin :
  7 048 constats proposés « corrigés, à confirmer » et ANALYZE).
- Effet de l'ANALYZE ajouté (PR #332) : requête des constats sur une base restaurée **4,29 s sans statistiques → 2,22 s
  après ANALYZE** (même résultat, 2 952 lignes).

## 5. Comparaison avec le rapport précédent

Aucun rapport précédent : ce passage sert de référence. Les mesures brutes sont dans `RAPPORT-2026-11-19.json`.

## 6. Mesures

### 6.1 API à une personne (cache chaud, 1 + 15 répétitions, médiane / p95 / max en ms)

Périmètre mesuré : le plus gros (« Pilotage de l'organisation », ≈ 12 % des données). Compte RSSI `charge01` : rôle RSSI,
accès à 6 périmètres (403 = droit absent, attendu).

| Route | Objectif | Administrateur | RSSI (non administrateur) | Taille (Ko) | |
| --- | --- | --- | --- | --- | --- |
| Tâches récurrentes : occurrences (page 1) | 500 ms | 125 / 152 / 152 | 135 / 181 / 181 | 34 | 15 |  |
| Tâches récurrentes : occurrences en retard | 500 ms | 137 / 161 / 161 | 117 / 157 / 157 | 37 | 15 |  |
| Tâches récurrentes : séries | 500 ms | 16 / 18 / 18 | 13 / 14 / 14 | 24 | 15 |  |
| Tâches récurrentes : calendrier du mois | 500 ms | 115 / 184 / 184 | 104 / 128 / 128 | 32 | 15 |  |
| Tâches récurrentes : tableau de bord | 1,5 s | 138 / 177 / 177 | 141 / 203 / 203 | 0 | 15 |  |
| Plan d’actions (page 1) | 500 ms | 18 / 26 / 26 | 18 / 26 / 26 | 33 | 15 |  |
| Plan d’actions : page 40 | 500 ms | 28 / 32 / 32 | 27 / 45 / 45 | 37 | 15 |  |
| Plan d’actions : recherche « fictive » | 1,5 s | 20 / 30 / 30 | 22 / 28 / 28 | 33 | 15 |  |
| Registres : mes éléments | 500 ms | 312 / 338 / 338 | 683 / 732 / 732 | 41 | 15 | **dépasse** |
| Registres : éléments (actions) | 500 ms | 59 / 66 / 66 | 138 / 174 / 174 | 35 | 15 |  |
| Fiche action | 500 ms | 8 / 9 / 9 | 15 / 23 / 23 | 1 | 15 |  |
| Risques (page 1) | 500 ms | 13 / 24 / 24 | 15 / 16 / 16 | 34 | 15 |  |
| Registre des risques | 500 ms | 27 / 29 / 29 | 26 / 31 / 31 | 147 | 15 |  |
| Carte des risques | 1,5 s | 30 / 41 / 41 | 28 / 32 / 32 | 481 | 15 |  |
| Fiche risque | 500 ms | 11 / 19 / 19 | 11 / 11 / 11 | 1 | 15 |  |
| Incidents (registre, tous périmètres) | 500 ms | 212 / 248 / 248 | 210 / 254 / 254 | 6709 | 15 |  |
| Incidents (un périmètre) | 500 ms | 130 / 157 / 157 | 144 / 186 / 186 | 1259 | 15 |  |
| Documents (liste) | 500 ms | 20 / 24 / 24 | 26 / 29 / 29 | 497 | 15 |  |
| Documents : recherche | 1,5 s | 22 / 38 / 38 | 24 / 29 / 29 | 497 | 15 |  |
| Fiche document | 500 ms | 8 / 12 / 12 | 8 / 9 / 9 | 1 | 15 |  |
| Vulnérabilités : constats (page 1) | 500 ms | 4425 / 4711 / 4711 | 13010 / 14563 / 14563 | 34 | 15 | **dépasse** |
| Vulnérabilités : constats recherche CVE | 1,5 s | 2459 / 2709 / 2709 | 11221 / 12435 / 12435 | 1 | 15 | **dépasse** |
| Vulnérabilités : machines (page 1) | 500 ms | 4382 / 4794 / 4794 | 4634 / 5124 / 5124 | 27 | 15 | **dépasse** |
| Vulnérabilités : fiche machine la plus touchée | 500 ms | 4034 / 4246 / 4246 | 4185 / 4813 / 4813 | 1 | 15 | **dépasse** |
| Vulnérabilités : fiche constat le plus répandu | 500 ms | 51 / 61 / 61 | 119 / 160 / 160 | 208 | 15 |  |
| Vulnérabilités : vue d’ensemble | 1,5 s | 1779 / 1889 / 1889 | 1909 / 2133 / 2133 | 91 | 15 | **dépasse** |
| Vulnérabilités : tendances | 1,5 s | 9 / 11 / 11 | 10 / 13 / 13 | 5 | 15 |  |
| Vulnérabilités : délais | 1,5 s | 13 / 16 / 16 | 13 / 15 / 15 | 1 | 15 |  |
| Vulnérabilités : veille (failles) | 500 ms | 36 / 43 / 43 | 30 / 40 / 40 | 24 | 15 |  |
| Vulnérabilités : produits | 500 ms | 7 / 9 / 9 | 6 / 8 / 8 | 0 | 15 |  |
| Vulnérabilités : recherche globale | 1,5 s | 4307 / 4595 / 4595 | 4246 / 4435 / 4435 | 2 | 15 | **dépasse** |
| Vulnérabilités : périmètres | 500 ms | 7 / 10 / 10 | 9 / 12 / 12 | 2 | 15 |  |
| Journal d’audit (200 dernières) | 500 ms | 7 / 8 / 8 | 403 (droit) | 49 | 15 |  |
| Journal d’audit : recherche « login » | 1,5 s | 10 / 12 / 12 | 403 (droit) | 28 | 15 |  |
| Journal d’audit : recherche rare « verrou » | 1,5 s | 378 / 437 / 437 | 403 (droit) | 29 | 15 |  |
| Journal d’audit : un mois de 2019 | 500 ms | 14 / 19 / 19 | 403 (droit) | 31 | 15 |  |
| Journal d’audit : un compte | 500 ms | 13 / 15 / 15 | 403 (droit) | 32 | 15 |  |
| Notifications (cloche) | 500 ms | 247 / 290 / 290 | 242 / 274 / 274 | 35 | 15 |  |
| Compte : notifications | 500 ms | 10 / 10 / 10 | 9 / 15 / 15 | 4 | 15 |  |
| Tableau de bord du périmètre | 1,5 s | 147 / 183 / 183 | 160 / 210 / 210 | 1 | 15 |  |
| Cartes des périmètres (synthèse) | 1,5 s | 670 / 800 / 800 | 647 / 694 / 694 | 22 | 15 |  |
| Mur : synthèse | 1,5 s | 358 / 407 / 407 | 378 / 429 / 429 | 5 | 15 |  |
| État du suivi (état historique) | 1,5 s | 197 / 232 / 232 | 189 / 234 / 234 | 6919 | 15 |  |
| Administration : informations | 1,5 s | 57 / 70 / 70 | 403 (droit) | 4 | 15 |  |
| Administration : système | 1,5 s | 9 / 12 / 12 | 403 (droit) | 8 | 15 |  |
| Couverture du périmètre | 1,5 s | 127 / 160 / 160 | 113 / 168 / 168 | 0 | 15 |  |
| Périmètres accessibles | 500 ms | 8 / 9 / 9 | 11 / 12 / 12 | 11 | 15 |  |
| Session (auth/me) | 500 ms | 5 / 6 / 6 | 5 / 7 / 7 | 2 | 15 |  |
| Export : journal d’audit CSV (5 000 lignes) | 30 s | 45 / 76 / 76 | 403 (droit) | 600 | 5 |  |
| Export : suivi complet (Excel) | 30 s | 372 / 394 / 394 | 321 / 340 / 340 | 505 | 5 |  |
| Rapport comité SMSI | 30 s | 284 / 318 / 318 | 289 / 312 / 312 | 595 | 5 |  |
| Rapport mensuel vulnérabilités (CSV) | 30 s | 1770 / 1833 / 1833 | 1874 / 1906 / 1906 | 61 | 5 |  |
| Export de l’état historique | 30 s | 372 / 509 / 509 | 369 / 402 / 402 | 6919 | 5 |  |
| Journal d’audit : recherche sans résultat | 1,5 s | 1471 / 1600 / 1600 | non mesuré | 0 | 15 | **dépasse** |
| Journal d’audit : page 2 000 (before) | 500 ms | 8 / 9 / 9 | non mesuré | 32 | 15 |  |
| Coquille : registres * | 500 ms | 734 / 865 / 865 | 1896 / 2517 / 2517 | 36 | 15 | **dépasse** |
| Coquille : responsables du périmètre * | 500 ms | 193 / 223 / 223 | 201 / 242 / 242 | 13 | 15 |  |
| Coquille : invitations RETEX * | 500 ms | 170 / 270 / 270 | 170 / 217 / 217 | 0 | 15 |  |
| Coquille : crise * | 500 ms | 96 / 135 / 135 | 115 / 169 / 169 | 0 | 15 |  |
| Coquille : alertes vulnérabilités (fenêtre) * | 500 ms | 19 / 24 / 24 | 29 / 37 / 37 | 3 | 15 |  |
| Coquille : état de l’assistant * | 500 ms | 10 / 11 / 11 | 14 / 15 / 15 | 4 | 15 |  |

« * » : appels de la coquille commune à toutes les pages, mesurés pendant la charge légère (5 personnes) : légère surévaluation possible. Avec 15 répétitions, le p95 est le maximum.

### 6.2 Pages à l'écran (Chromium, temps jusqu'à la page utilisable)

« Utilisable » : plus aucune requête `/api/` en cours depuis 500 ms (flux `/api/events` exclu) et aucun indicateur de
chargement visible ; cache vide = nouveau contexte ; cache chaud = seconde navigation dans le même contexte. Les échecs
`/api/settings/logo`, `/api/presence` signalés par le navigateur sont des requêtes annulées par la navigation suivante,
pas des erreurs de l'application.

| Page | Adm., cache vide : méd. / p95 / max (15 rép.) | Adm., cache chaud | RSSI, cache vide : méd. / p95 (5 rép.) | RSSI, cache chaud | Appels API / Ko (adm., chaud) | |
| --- | --- | --- | --- | --- | --- | --- |
| Accueil (tableau de bord) (`/`) | 1261 / 1453 / 1453 | 941 / 1120 / 1120 | 1144 / 1228 | 909 / 939 | 16 / 52 |  |
| Tâches récurrentes (`/pilotage/recurrences`) | 2319 / 2678 / 2678 | 2026 / 2391 / 2391 | 3378 / 3433 | 3100 / 3325 | 24 / 236 | **dépasse** |
| Plan d’actions (`/pilotage/actions`) | 2108 / 2607 / 2607 | 1843 / 1961 / 1961 | 3319 / 3472 | 3151 / 3188 | 23 / 212 | **dépasse** |
| Risques (`/pilotage/risques`) | 1593 / 1694 / 1694 | 1242 / 1380 / 1380 | 1523 / 1610 | 1201 / 1333 | 19 / 216 |  |
| Registre des incidents (`/pilotage/incidents-registre`) | 1359 / 1554 / 1554 | 1065 / 1272 / 1272 | 1267 / 1360 | 1007 / 1065 | 18 / 1329 |  |
| Documents (`/documents`) | 1982 / 2367 / 2367 | 1596 / 1923 / 1923 | 1745 / 2269 | 1758 / 2036 | 18 / 549 | **dépasse** |
| Vulnérabilités : vue d’ensemble (`/vulnerabilites/vue`) | 2256 / 2537 / 2537 | 1967 / 2122 / 2122 | 2529 / 2571 | 2166 / 2274 | 20 / 146 | **dépasse** |
| Vulnérabilités : failles (`/vulnerabilites/failles`) | 4954 / 5453 / 5453 | 4676 / 4944 / 4944 | 13379 / 14035 | 12971 / 14631 | 17 / 86 | **dépasse** |
| Vulnérabilités : machines (`/vulnerabilites/machines`) | 4913 / 6104 / 6104 | 4820 / 5158 / 5158 | 5379 / 5644 | 5126 / 5369 | 16 / 81 | **dépasse** |
| Vulnérabilités : veille (`/vulnerabilites/veille`) | 1243 / 1382 / 1382 | 918 / 1051 / 1051 | 1216 / 1260 | 916 / 997 | 17 / 78 |  |
| Journal d’audit (`/systeme/journal`) | 1221 / 2044 / 2044 | 917 / 1034 / 1034 | 1167 / 1341 | 894 / 923 | 16 / 108 | **dépasse** |
| Périmètres (cartes) (`/pilotage/perimetres`) | 1684 / 1767 / 1767 | 1422 / 1491 / 1491 | 1837 / 1976 | 1527 / 1545 | 19 / 92 |  |

Commande : `node banc-pages.mjs 15 admin` puis `node banc-pages.mjs 5 charge01` (Chromium du système, fenêtre 1440 × 900). Chaque page déclenche 14 à 24 appels d'API, dont une quinzaine communs à toutes les pages (coquille : notifications, synthèse du mur, registres, invitations RETEX, crise, assistant, alertes…) ; pendant le banc des pages, un seul navigateur suffit à tenir le processus de l'API à ≈ 98 % d'un cœur (relevé `docker stats`). Temps moyens relevés dans le journal de l'API pendant ces chargements : `/api/registres` 1 288 ms, `/api/grc/notifications` 939 ms, `/api/mur/synthese` 878 ms, `/api/grc/:smsi/owners` 712 ms, `/api/retex/invitations` 454 ms, `/api/crise` 449 ms.


### 6.3 Vingt personnes simultanées (10 min)

Commande : `node charge.mjs 20 10 charge20 500 2000` — 20 comptes (`charge01` à `charge20` : 2 RSSI, 12 contributeurs,
6 lecteurs, chacun sur 6 périmètres), temps de réflexion 0,5 à 2 s, mélange : listes et fiches (tâches, actions, risques,
incidents d'un périmètre, documents, notifications, registres), tableaux de bord, vulnérabilités (RSSI seulement : les
autres rôles n'ont pas le droit de lecture du module), ≈ 5 % d'écritures (création et modification d'actions avec If-Match).

| Indicateur | Valeur |
| --- | --- |
| Requêtes | 7 945 en 10 min, **13,2 req/s** |
| Erreurs | **0** (aucune 5xx, aucun délai dépassé) |
| Médiane / p95 / max (toutes routes) | 38 ms / 1 098 ms / 14 927 ms |
| Connexions de l'API à PostgreSQL (relevé toutes les 5 s) | actives : 0 (25 relevés), 1 (39), 2 (31), 3 (18), 4 (6), 5 (1) sur 120 ; jamais d'attente de verrou ; 12 à 13 connexions ouvertes (pool de 10 + verrous et écoute) |
| Processeur (relevé toutes les 30 s) | API 28 à 132 % (un fil Node, souvent 55–95 %), base 38 à 226 % (sur 400 %) |
| Mémoire | API 190 à 330 Mio (limite 768), base 630 à 820 Mio (limite 1 Gio, cache de pages compris) |

Un premier essai (`charge20-essai1-droits`) avait envoyé les vulnérabilités à tous les comptes : 1 268 refus 403 attendus
(droit absent) et 106 refus 422 dus au banc (corps de modification incomplet) ; résultats écartés, mélange corrigé.

Comparaison à une personne (même compte RSSI, p95 sur 15 répétitions ; en charge, les 6 périmètres sont tirés au hasard,
le premier étant le plus gros) :

| Route (mélange) | Appels | Une personne RSSI : méd. / p95 | 20 personnes : méd. / p95 / max | Rapport méd. / p95 |
| --- | --- | --- | --- | --- |
| actions | 869 | 18 / 26 | 23 / 400 / 1641 | ×1.3 / ×15.4 |
| fiche-action | 607 | 15 / 23 | 18 / 326 / 1767 | ×1.2 / ×14.2 |
| risques-registre | 490 | 26 / 31 | 22 / 346 / 1622 | ×0.8 / ×11.2 |
| me | 250 | 5 / 7 | 9 / 77 / 1329 | ×1.8 / ×11.0 |
| notifications | 597 | 242 / 274 | 340 / 1423 / 4182 | ×1.4 / ×5.2 |
| risk-map | 218 | 28 / 32 | 29 / 159 / 1644 | ×1.0 / ×5.0 |
| incidents | 410 | 144 / 186 | 181 / 914 / 2120 | ×1.3 / ×4.9 |
| documents | 374 | 26 / 29 | 30 / 136 / 1375 | ×1.2 / ×4.7 |
| dashboard | 421 | 160 / 210 | 49 / 793 / 1994 | ×0.3 / ×3.8 |
| synthese-perimetres | 214 | 647 / 694 | 862 / 2564 / 3117 | ×1.3 / ×3.7 |
| tasks-window | 395 | 104 / 128 | 24 / 456 / 1992 | ×0.2 / ×3.6 |
| mes-elements | 309 | 683 / 732 | 874 / 2180 / 3338 | ×1.3 / ×3.0 |
| tasks | 2102 | 135 / 181 | 27 / 497 / 2112 | ×0.2 / ×2.7 |
| tasks-dashboard | 323 | 141 / 203 | 33 / 313 / 1655 | ×0.2 / ×1.5 |
| vuln-machines | 28 | 4634 / 5124 | 4987 / 5655 / 5685 | ×1.1 / ×1.1 |
| vuln-vue | 18 | 1909 / 2133 | 2015 / 2372 / 2372 | ×1.1 / ×1.1 |
| vuln-constats | 20 | 13010 / 14563 | 12081 / 14746 / 14927 | ×0.9 / ×1.0 |
| vuln-fiche-machine | 10 | 4185 / 4813 | 4385 / 4771 / 4771 | ×1.0 / ×1.0 |
| vuln-fiche-constat | 10 | 119 / 160 | 27 / 109 / 109 | ×0.2 / ×0.7 |
| ecr-action-modifier (écriture) | 123 | non mesuré seul | 58 / 1022 / 1729 | — |
| ecr-action-creer (écriture) | 157 | non mesuré seul | 25 / 544 / 1271 | — |

Lecture : les médianes restent proches (×0,2 à ×1,8) mais la **queue** s’allonge fortement (p95 ×2,7 à ×15 sur 13 des 19 routes) : des requêtes
courtes attendent derrière des requêtes lourdes sur le fil unique de Node (incidents 6,7 Mo à sérialiser, rafales de 600 à
770 requêtes SQL des notifications, des registres et de la synthèse des périmètres). Le pool n'est pas en cause.

### 6.3 bis Charge légère d'une heure et mémoire

Commande : `node charge.mjs 5 60 legere-1h 2000 6000` (comptes `charge01` à `charge05` : 2 RSSI, 1 lecteur,
2 contributeurs ; temps de réflexion 2 à 6 s) ; `docker stats` toutes les 30 s (120 relevés), connexions toutes les 5 s.

| Indicateur | Valeur |
| --- | --- |
| Requêtes | 3 958 en 1 h, 1,1 req/s |
| Erreurs | **3** (500 sur la liste des constats : délai d'attente de 30 s de PostgreSQL dépassé) |
| Médiane / p95 / max | 30 ms / 2 017 ms / 31 808 ms |
| Mémoire de l'API | 110 à 302 Mio (limite 768), médiane 146 ; moyennes par tranche de 10 min : 148, 158, 175, 163, 160, 155 Mio ; **pas de croissance continue** |
| Mémoire de la base | 366 à 536 Mio (limite 1 Gio), médiane 459 |
| Connexions actives | 0 (426 relevés), 1 (244), 2 (42), 3 (9) sur 721 |

| Route | Appels | Erreurs | Médiane / p95 / max (ms) |
| --- | --- | --- | --- |
| vuln-constats | 65 | 3 | 14027 / 28196 / 31808 |
| vuln-machines | 50 | 0 | 4127 / 7641 / 8415 |
| vuln-fiche-machine | 38 | 0 | 3805 / 7131 / 7483 |
| vuln-vue | 47 | 0 | 2051 / 3039 / 3745 |
| synthese-perimetres | 129 | 0 | 720 / 1652 / 16371 |
| mes-elements | 161 | 0 | 699 / 1490 / 17820 |
| notifications | 296 | 0 | 242 / 546 / 4276 |
| incidents | 189 | 0 | 161 / 408 / 12272 |
| dashboard | 178 | 0 | 35 / 239 / 13251 |
| tasks | 829 | 0 | 22 / 223 / 4982 |
| tasks-dashboard | 165 | 0 | 25 / 218 / 2285 |
| tasks-window | 205 | 0 | 19 / 193 / 459 |
| ecr-action-modifier | 55 | 0 | 49 / 172 / 1491 |
| fiche-action | 278 | 0 | 18 / 101 / 632 |
| ecr-action-creer | 96 | 0 | 30 / 96 / 10490 |
| actions | 472 | 0 | 20 / 88 / 1003 |
| documents | 185 | 0 | 31 / 88 / 438 |
| risk-map | 102 | 0 | 31 / 83 / 231 |
| risques-registre | 252 | 0 | 21 / 71 / 1195 |
| vuln-fiche-constat | 51 | 0 | 29 / 61 / 99 |
| me | 115 | 0 | 9 / 25 / 373 |

Des maxima isolés de 12 à 18 s sur des routes courtes (synthèse, mes éléments, incidents, tableau de bord) coïncident avec
les requêtes des constats de 28 à 32 s : file d'attente sur le fil de l'API ou sur la base pendant ces requêtes.

### 6.4 Opérations

| Opération | Mesure | Commande |
| --- | --- | --- |
| Synchronisation simulée, première (base vide de vulnérabilités) | 24 000 éléments (1 000 machines, 3 000 constats, 20 000 détections), 48 lots : **56,4 s** (réclamation 1,0 s ; lots 53,8 s, médiane 1,1 s / p95 1,3 s par lot dont ≈ 1 s de `docker exec` + démarrage de la CLI ; fin 1,6 s) | `node sync-simulee.mjs synchroniser <instance> 1000 3000 20000` |
| Synchronisation simulée, seconde (base pleine, 114 718 détections) | mêmes 24 000 éléments : **76,8 s** (lots 54,8 s ; **fin 21,0 s** : 94 718 détections devenues absentes, 7 048 constats proposés « corrigés, à confirmer », ANALYZE de la PR #332 exécuté, `last_analyze` mis à jour) | idem (demande inscrite en base : « Synchroniser maintenant » renvoie 503 sans exécutant d'exploitation) |
| Extrapolation 100 000 détections | ≈ 200 lots de détections + machines et constats : 4 à 5 min de réception si la borne était levée (estimation, **non mesurée**) | — |
| Sauvegarde | `pg_dump -Fc --no-owner` **12,7 s** (dump 106 Mo) ; chiffrement age 0,1 s ; déchiffrement 0,2 s | `sauvegarde-restauration.sh` |
| Restauration | `pg_restore --no-owner --role=suivi_app --exit-on-error` dans une base sœur **17,6 s** ; ANALYZE **1,7 s** ; indisponibilité estimée de l'application lors d'une vraie restauration : ≈ 20 s de base + redémarrage (< 5 min, aucun signalement) | idem |
| Effet de l'ANALYZE après restauration | requête des constats (administrateur, sans JIT) : **4 291 ms sans statistiques → 2 216 ms** après ANALYZE | `extraire-requete.py` + `psql` |
| Écritures du registre des incidents (3 000 incidents) | création : médiane **2 633 ms**, p95 2 849 ms ; modification : médiane **2 703 ms**, p95 2 991 ms (15 répétitions chacune, après échauffement) ; pendant le remplissage (≈ 30 incidents) : ≈ 100 ms | `node ecritures-incidents.mjs` |
| Instantané de l'état à chaque écriture | 7,66 Mo de JSON (715 Ko compressés) ajoutés à `state_history` par écriture ; les écritures d'une même personne en moins de 10 min se remplacent ; `STATE_HISTORY_KEEP=1000` | idem |
| Migrations sur base pleine | **non mesurée** (aucune migration plus récente que le commit) | — |
| Démarrage de l'API sur la base pleine | sain en moins de 30 s (un redémarrage sur la base pleine ; durée non chronométrée précisément) | `docker restart` |

### 6.5 Base de données

- Taille : 589 Mo après remplissage, 624 Mo en fin de banc. Statistiques : `ANALYZE` complet après le remplissage direct ;
  autovacuum et autoanalyze passés sur toutes les grosses tables (`n_dead_tup` = 0 sur `audit_log`, `grc_notifications`,
  `vulnerabilites_detections`, `suivi_incidents` en fin de banc ; `grc_objects` 124).
- Cache : 99,88 % de lectures servies par `shared_buffers` sur l'ensemble du banc ; **`audit_log` 80,2 %** seulement (tas
  242 Mo pour 128 Mo de `shared_buffers`) : les recherches dans le journal lisent dans le cache du système (35 409 blocs lus
  pour une recherche sans résultat).
- **Fichiers temporaires : 350 fichiers, 3,98 Go écrits** pendant le banc (tris débordant de `work_mem` = 4 Mo : « external
  merge Disk: 6528kB » dans la requête des constats).
- **JIT actif** : la requête des machines est estimée à 1,09 million (au-dessus de `jit_optimize_above_cost`), d'où
  **1,6 s de compilation par appel** (Inlining 77 ms, Optimization 846 ms, Emission 689 ms) ; même chose pour la recherche
  (1,7 s) et la vue d'ensemble (0,4 s).
- `effective_cache_size` = 4 Go (valeur par défaut) pour un conteneur limité à 1 Gio : le planificateur suppose un cache
  qu'il n'a pas.

Fin de banc (`pg_stat_user_tables`, heures de Paris) — base 625 Mo :

| Table | Lignes vivantes | Lignes mortes | Dernier autovacuum | Dernier autoanalyze | Taille totale |
| --- | --- | --- | --- | --- | --- |
| `audit_log` | 2000982 | 0 | 21:21 | 21:21 | 351 MB |
| `grc_notifications` | 203538 | 0 | 21:21 | 21:21 | 86 MB |
| `grc_objects` | 25678 | 178 | 21:20 | 21:20 | 57 MB |
| `vulnerabilites_detections` | 114718 | 0 | 22:56 | 21:33 | 46 MB |
| `grc_object_versions` | 18942 | 0 | 21:19 | 21:20 | 21 MB |
| `grc_links` | 18114 | 0 | 21:19 | 21:20 | 8232 kB |
| `suivi_incidents` | 3016 | 0 | 22:54 | 22:54 | 8160 kB |
| `vulnerabilites_veille_cve` | 20000 | 0 | 21:35 | — | 7272 kB |
| `vulnerabilites_constats` | 10000 | 0 | 22:54 | 22:54 | 5456 kB |
| `grc_occurrences` | 18114 | 0 | 21:19 | 21:20 | 4048 kB |

`vulnerabilites_detections` est passée de 27 à 46 Mo après la mise à jour de 94 718 lignes (remise « présentes » après la
seconde synchronisation) et `suivi_incidents` de 3 à 8 Mo après 30 écritures (chaque écriture réécrit les 3 000 lignes,
PERF-07) : place rendue à la table par l'autovacuum, pas au système.

Points signalés par le conseiller :

| Point | Mesure | Avis |
| --- | --- | --- |
| `count(*)` sur `audit_log` dans l'état d'administration (`routes/admin.ts`, route `/api/admin/info`) | route 57 / 70 ms (médiane / p95) ; la requête seule : 125 ms à froid (parcours parallèle de l'index `audit_log_action`, 1 585 blocs) | sous l'objectif à 2 M de lignes ; croît linéairement. Remplacer par `reltuples` (estimation) ou un compteur si le journal dépasse 10 M de lignes. |
| Recherche ILIKE dans le journal (`routes/admin.ts` ~l. 145) | terme fréquent 10 / 12 ms ; terme rare 378 / 437 ms ; **sans résultat 1 471 / 1 600 ms** (parcours arrière complet des 2 M de lignes, 4 ILIKE par ligne dont `ip::text`) | défaut PERF-12. |
| Filtres action + ts des alertes de sécurité (`alertes-securite.ts` l. 209, 274, 435, 468) | 1,3 à 3,4 ms (BitmapAnd des index `audit_log_action` et `audit_log_ts`) ; action fréquente `auth.login` : 22 ms | aucun problème ; un index `(action, ts)` ramènerait à < 1 ms, inutile aujourd'hui. |
| `shared_buffers` 128 Mo pour un conteneur de 1 Gio | taux global 99,88 %, `audit_log` 80 % ; base 624 Mo | porter à 256 Mo (25 % de la limite), `work_mem` 8 à 16 Mo, `effective_cache_size` 512 Mo, `jit = off` (voir PERF-02). |

## 7. Défauts



### PERF-01 — Liste des constats de vulnérabilités : 4,7 s (administrateur), 14,6 s (RSSI), délai d'attente dépassé en charge
- Gravité : **bloquant** (délai d'attente de 30 s dépassé : 3 erreurs 500 sur 65 appels pendant la charge légère de 5 personnes, dont 2 RSSI ; à une personne ×9,4 et ×29 l'objectif de 500 ms).
- Mesure : `GET /api/vulnerabilites/constats` (page 1, 25 lignes), 114 718 détections, 10 000 constats, 1 000 machines ; administrateur 4 425 / 4 711 / 4 711 ms, RSSI 13 010 / 14 563 / 14 563 ms (médiane / p95 / max, 15 répétitions) ; à 20 personnes (2 RSSI) 12 081 / 14 746 / 14 927 ms ; **charge légère d'1 h (5 personnes) : 14 027 / 28 196 / 31 808 ms, 3 erreurs 500 `canceling statement due to statement timeout`** (journal de PostgreSQL, 23 h 07–23 h 08) ; le pool n'était pas saturé (3 connexions actives au plus). Recherche par CVE (`?q=CVE-2099-10007`) : 2 459 / 2 709 ms et 11 221 / 12 435 ms (objectif 1,5 s).
- Cause : `vulnerabilites/failles.ts` l. 450, CTE `x` : la lisibilité est calculée **par détection** (`CASE … grc_smsi_visible(coalesce(m.perimetre_id, (SELECT td.perimetre_id …)), $u)`, `vulnerabilites/sql.ts` l. 16), soit 114 718 appels de fonction ; pour un non-administrateur, chaque appel parcourt la pyramide des périmètres (`grc_acces_perimetre`, CTE récursive) : « CTE x … actual time=2.957..11595.423 rows=114718 » (RSSI), 2 141 ms pour l'administrateur (sous-plan du dépôt exécuté 106 378 fois). Puis agrégation de **toutes** les détections à chaque page (9 946 lignes rendues à Node, tri et découpage en JavaScript), tri débordant sur disque (`external merge Disk: 6528kB`, `work_mem` 4 Mo), JIT 85 ms.
- Correction proposée : calculer la lisibilité **une fois par machine** (ou une fois par périmètre : `WITH lisibles AS MATERIALIZED (SELECT id FROM grc_smsis WHERE grc_smsi_visible(id, $u))`), puis joindre. Mesuré dans `psql` sur la requête exacte réécrite (CTE matérialisée par machine) : **12 734 ms → 827 ms** pour le RSSI, mêmes 9 946 lignes (`explain-constats-charge01-correctif-propose.txt`). Ensuite, trier et paginer en SQL (ou tenir par constat un compteur de machines lisibles recalculé en fin de synchronisation) : objectif < 300 ms. Risque faible si les tests de droits existants (lecture par périmètre, dépôt relié, machine sans périmètre) sont rejoués.
- Reproductible par : `REPET=15 node banc-api.mjs une-personne "constats"` ; test proposé § 8.

### PERF-02 — Liste des machines et fiche d'une machine : 4,2 à 5,1 s
- Gravité : **majeur** (×8,5 à ×10).
- Mesure : `GET /api/vulnerabilites/machines` 4 382 / 4 794 ms (adm.), 4 634 / 5 124 ms (RSSI) ; `GET /api/vulnerabilites/machines/:id` (une seule machine) 4 034 / 4 246 ms et 4 185 / 4 813 ms ; 15 répétitions.
- Cause : (a) la fiche appelle `machinesRangees(user)` puis `.find((x) => x.id === id)` (`failles.ts` l. 725) : **la liste complète des 1 000 machines est calculée pour en afficher une** ; (b) **JIT** : coût estimé 1 093 469, compilation de 1,6 s à chaque appel (« Timing: … Optimization 845.818 ms, Emission 689.375 ms, Total 1622.501 ms ») ; sans JIT la même requête passe de 4 141 ms à 2 596 ms ; (c) sous-requête « fins de support » par machine : `Seq Scan on vulnerabilites_constats` répété 1 000 fois (≈ 1 ms chacun) ; (d) agrégat latéral par machine (1 000 × 1,4 ms) ; (e) pagination en Node (`machines()` l. 670 filtre puis découpe le tableau complet).
- Correction proposée : (a) fiche : `WHERE m.id = $id` dans la requête (effet attendu < 50 ms) ; (b) `jit = off` pour le rôle applicatif (`ALTER ROLE suivi_app SET jit = off` dans une migration, ou `-c jit=off` dans `docker-compose.yml`) : −1,6 s mesurés ; (c) index partiel `CREATE INDEX ON vulnerabilites_constats (fin_support_le) WHERE fin_support_le IS NOT NULL` : le sous-plan passe de ≈ 1 000 ms à 7 ms (mesuré dans une transaction annulée) ; (d) compteurs par un seul `GROUP BY machine_id` sur les détections présentes au lieu de 1 000 sous-requêtes ; (e) lisibilité par machine comme PERF-01. Effet attendu : < 400 ms.
- Reproductible par : `node banc-api.mjs une-personne "machines"`.

### PERF-03 — Recherche dans les vulnérabilités : 4,4 à 4,6 s
- Gravité : **majeur** (×3 l'objectif de 1,5 s).
- Mesure : `GET /api/vulnerabilites/recherche?q=CVE-2099-1000` 4 307 / 4 595 ms (adm.), 4 246 / 4 435 ms (RSSI) ; 49 requêtes SQL par appel, somme 9,1 s (requêtes parallèles), la plus lente 4,46 s.
- Cause : la recherche reprend la requête complète des machines (même plan, JIT 1,7 s) et celle des constats, puis filtre en Node.
- Correction proposée : celles de PERF-01 et PERF-02, et une recherche ciblée en SQL (égalité sur la CVE, `ILIKE` borné sur le nom ou l'adresse) au lieu de filtrer les listes complètes. Effet attendu < 500 ms.
- Reproductible par : `node banc-api.mjs une-personne "recherche globale"`.

### PERF-04 — Vue d'ensemble des vulnérabilités : 1,9 à 2,1 s
- Gravité : **mineur** (×1,3 à ×1,4).
- Mesure : `GET /api/vulnerabilites/vue-ensemble` 1 779 / 1 889 ms (adm.), 1 909 / 2 133 ms (RSSI) ; 55 requêtes SQL, la plus lente 851 ms dont 406 ms de JIT.
- Correction proposée : `jit = off` (−0,4 s attendu) et lisibilité par machine (PERF-01).
- Reproductible par : `node banc-api.mjs une-personne "vue d’ensemble"`.

### PERF-05 — Pages des vulnérabilités : 5 à 14 s
- Gravité : **majeur** (failles, machines) ; vue d'ensemble 2,3 / 2,5 s (mineur).
- Mesure (cache vide, médiane / p95) : `/vulnerabilites/failles` 4 954 / 5 453 ms (adm.), **13 379 / 14 035 ms (RSSI)** ; `/vulnerabilites/machines` 4 913 / 6 104 ms et 5 379 / 5 644 ms ; `/vulnerabilites/vue` 2 256 / 2 537 ms et 2 529 / 2 571 ms.
- Cause : PERF-01, PERF-02, PERF-04 (l'écran attend la route lente).
- Correction proposée : celles de PERF-01 à PERF-04.
- Reproductible par : `PAGE=Vulnérabilités node banc-pages.mjs 15 admin`.

### PERF-06 — Liste des registres appelée par toutes les pages : 0,87 s (adm.), 2,5 s (RSSI)
- Gravité : **majeur** pour un non-administrateur (×5), mineur pour l'administrateur.
- Mesure : `GET /api/registres?archives=false` (60 registres : 30 plans d'actions, 29 de tâches récurrentes, 1 d'écarts) 734 / 865 ms (adm.), 1 896 / 2 517 ms (RSSI), 15 répétitions pendant la charge légère ; dans le navigateur, 1 288 ms en moyenne par chargement de page.
- Cause : `grc/registres.ts` l. 533 : `for (const reg of rows) if (await this.peut(user, reg, null, 'lire')) out.push(await this.dto(user, reg))` : droits et description **calculés registre par registre**, plusieurs requêtes chacun (rafale N+1) ; plus coûteux pour un non-administrateur (droits par ressource et par périmètre).
- Correction proposée : charger en une requête les droits de la personne sur tous les registres (`droits_ressources`, `registre_perimetres`, accès aux périmètres) et les compteurs, puis composer en mémoire ; effet attendu < 100 ms, et une page plus rapide de 0,5 à 1,5 s.
- Reproductible par : `node banc-api.mjs coquille "Coquille"`.

### PERF-07 — Écriture dans le registre des incidents : 2,6 à 3,0 s
- Gravité : **majeur** (×5 à ×6 si l'on applique l'objectif des fiches ; le profil ne fixe pas d'objectif d'écriture : à confirmer par le RSSI).
- Mesure : à 3 016 incidents, `POST /api/incidents` 2 633 / 2 849 ms, `PATCH /api/incidents/:id` 2 703 / 2 991 ms (15 répétitions) ; ≈ 100 ms à 30 incidents.
- Cause : modèle de l'état historique (ADR 0040) : chaque écriture recompose tout l'état (`legacy/store.ts` `recompose`), **efface puis réinsère les 3 016 lignes** de `suivi_incidents` (`historique/tables/collection.ts` l. 144, `DELETE FROM …` puis insertion), et ajoute dans `state_history` un **instantané complet de 7,66 Mo** (715 Ko compressés), conservé jusqu'à `STATE_HISTORY_KEEP=1000` versions (≈ 0,7 Go à ce volume). L'écriture tient le verrou global de l'état : toutes les écritures de l'état historique (incidents, plans, crise, RETEX…) sont sérialisées, ≈ 0,4 écriture par seconde au plus pour toute la plateforme.
- Correction proposée : écrire la seule ligne modifiée (insertion ou mise à jour par identifiant) au lieu de réécrire la table ; ne pas recomposer l'état entier pour une écriture d'incident ; instantané de `state_history` limité aux clés de l'état restées dans `app_state` (ou différé). Effet attendu < 200 ms et quelques Ko par version. Décision d'architecture (§ 9).
- Reproductible par : `node ecritures-incidents.mjs`.

### PERF-08 — Pages tâches récurrentes, plan d'actions, documents et journal au-delà de 2 s
- Gravité : **mineur** (×1,0 à ×1,7).
- Mesure (cache vide, médiane / p95) : tâches récurrentes 2 319 / 2 678 ms (adm.), 3 378 / 3 433 ms (RSSI) ; plan d'actions 2 108 / 2 607 ms et 3 319 / 3 472 ms ; documents 1 982 / 2 367 ms ; journal d'audit 1 221 / 2 044 ms (un seul chargement au-dessus de 2 s sur 15). Cache chaud : tâches 2 026 / 2 391 ms, plan d'actions 1 843 / 1 961 ms.
- Cause : 21 à 24 appels d'API par page, servis par un seul fil Node : `/api/registres` (PERF-06), `/api/grc/notifications` (609 requêtes SQL par appel : `g.visible` appelé pour chacune des 100 notifications, `grc/tasks.ts` l. 560), `/api/mur/synthese`, `/api/grc/:smsi/owners`, et deux appels qui **recomposent l'état historique complet (6,9 Mo)** à chaque page : `/api/retex/invitations` et `/api/crise`. Un seul navigateur tient le processus de l'API à ≈ 98 % d'un cœur.
- Correction proposée : PERF-06 ; notifications : mémoriser `visible(smsi, module)` pendant l'appel (≤ 30 périmètres : ≈ 600 → ≈ 20 requêtes) ; RETEX et crise : ne lire que leurs clés de l'état (ou mettre en cache l'état recomposé par numéro de version d'`app_state`). Effet attendu : pages sous 1,5 s.
- Reproductible par : `PAGE="Tâches" node banc-pages.mjs 15 admin`.

### PERF-09 — Synchronisation de 100 000 constats impossible
- Gravité : **bloquant** au sens du modèle (opération impossible au volume cible) ; c'est une borne voulue (`TENABLE_BORNES`) : **décision du RSSI**.
- Mesure : une synchronisation est bornée à 20 000 détections (100 pages de 200), 100 000 éléments (200 lots de 500) et 480 s ; le bilan est refusé au-delà (`BilanSynchronisation.detections ≤ 20 000`). Au-delà de 20 000 détections, la synchronisation s'arrête « incomplète » et ne marque plus rien comme disparu. À la borne, la réception côté application prend 56 à 77 s.
- Correction proposée : relever les bornes (détections 100 000 à 150 000, pages en conséquence, `lots` 300) **après** les correctifs PERF-01 et PERF-02, ou synchroniser par dépôt (une exécution bornée par dépôt) ; lots plus gros (2 000 éléments) pour réduire le coût fixe d'environ 1 s par `docker exec`. Extrapolation (non mesurée) : 4 à 5 min de réception pour 100 000 détections, sous l'objectif de 10 min.
- Reproductible par : `node sync-simulee.mjs synchroniser <instance> 1000 3000 20000`.

### PERF-10 — Vingt personnes simultanées : dégradation au-delà de ×2
- Gravité : **majeur** (p95 ×2,7 à ×15 sur 13 des 19 routes comparées, pour un objectif de ×2) ; aucune erreur.
- Mesure : `node charge.mjs 20 10 charge20 500 2000` : 7 945 requêtes, 13,2 req/s, 0 erreur ; p95 en charge / à une personne : plan d'actions 400 / 26 ms (×15), fiche action 326 / 23 ms (×14), registre des risques 346 / 31 ms (×11), notifications 1 423 / 274 ms (×5,2), incidents 914 / 186 ms (×4,9), synthèse des périmètres 2 564 / 694 ms (×3,7, au-delà de 1,5 s), mes éléments 2 180 / 732 ms (×3), tâches 497 / 181 ms (×2,7). Médianes peu changées.
- Cause : processus Node unique de l'API à 55–95 % d'un cœur pendant toute la charge ; le pool de 10 connexions n'est jamais saturé (5 actives au plus) et aucune attente de verrou : les requêtes courtes attendent derrière les lourdes sur le fil d'exécution (sérialisation de 6,7 Mo pour le registre des incidents, rafales de 600 à 770 requêtes SQL : notifications, registres, mes éléments, synthèse des périmètres).
- Correction proposée : supprimer les rafales N+1 (PERF-06, PERF-08, PERF-11 ; synthèse des périmètres : 747 requêtes, `grc/cartes.ts` `cartesPerimetres`, boucle séquentielle par périmètre) ; paginer le registre des incidents ; ensuite seulement, si la queue reste longue, plusieurs processus Node. Effet attendu : p95 en charge ≤ ×2.
- Reproductible par : `node charge.mjs 20 10 charge20 500 2000` puis `python3 comparer.py <banc>`.

### PERF-11 — « Mes éléments » : 0,73 s pour un non-administrateur
- Gravité : **mineur** (×1,5).
- Mesure : `GET /api/registres/mes-elements` 312 / 338 ms (adm.), 683 / 732 ms (RSSI) ; 771 requêtes SQL par appel.
- Cause : rafale N+1 (droits et éléments registre par registre).
- Correction proposée : même regroupement que PERF-06. Effet attendu < 150 ms.
- Reproductible par : `node banc-api.mjs une-personne "mes éléments"`.

### PERF-12 — Recherche sans résultat dans le journal d'audit : 1,6 s
- Gravité : **mineur** (×1,07) ; croît avec le journal.
- Mesure : `GET /api/admin/audit?q=zzz-introuvable`, 2 000 010 lignes : 1 471 / 1 600 ms (15 répétitions) ; terme rare 378 / 437 ms ; terme fréquent 10 / 12 ms.
- Cause : `routes/admin.ts` l. 140–150 : quatre `ILIKE '%…%'` dont `ip::text`, sans borne de période : parcours arrière complet de `audit_log_pkey` (« Rows Removed by Filter: 666849 » × 3 processus, 35 409 blocs lus hors `shared_buffers`).
- Correction proposée : imposer une période par défaut quand `q` est fourni (90 jours, élargissable), rechercher l'adresse par `ip <<= $1::inet` plutôt que `ip::text ILIKE` ; si la recherche libre sur toute la durée est voulue, index trigramme (`pg_trgm`, disponible dans l'image) sur `username`, `action`, `target` (coût : plusieurs dizaines de Mo d'index et des insertions plus lentes sur une table qui ne fait que croître). Effet attendu : < 200 ms sur 90 jours.
- Reproductible par : `SANS_CHARGE=1 node banc-api.mjs journal "Journal"`.

### Observations (sous l’objectif, sans gravité)

- **Registre des incidents non paginé** : `GET /api/incidents` rend 6,7 Mo (tous périmètres, chronologies comprises) en 212 / 248 ms ; `GET /api/suivi/etat` et l'export de l'état 6,9 Mo. Sous l'objectif à une personne, mais en charge ce sont eux qui bloquent le fil Node (PERF-10).
- **Notifications** : 609 requêtes SQL par appel de la cloche (247 / 290 ms) ; **synthèse des périmètres** : 747 requêtes (670 / 800 ms) ; **coquille** : `/api/retex/invitations` et `/api/crise` recomposent l'état historique complet (170 / 270 ms et 96 / 135 ms).
- **`count(*)` du journal d'audit** (`/api/admin/info`) : 57 / 70 ms à 2 M de lignes, linéaire.
- **Fichiers temporaires** : 3,98 Go écrits pendant le banc (tris au-delà de `work_mem` = 4 Mo).
- **Automate des occurrences** : rattrapage de 18 114 occurrences en ≈ 4 min (50 par série et par minute) ; à surveiller si une série est créée avec une date de début lointaine (plusieurs passages).
- **Création de compte** : ≈ 350 ms (hachage) ; 300 comptes en 106 s, attendu.


## 8. Tests de non-régression proposés

Propositions, non écrites dans `apps/` (règle du banc) ; sur le modèle de `apps/api/test/performance.test.ts` (TEST-043),
budget de CI de 800 ms au p95 sur 15 mesures (budget existant, exécuteur partagé), l'objectif de 500 ms restant celui du
serveur réel.

1. **`apps/api/test/performance-vulnerabilites.test.ts`** (PERF-01 à PERF-04) : une instance Tenable, 1 000 machines
   réparties sur 6 dépôts reliés à 6 périmètres, 5 000 constats, 50 000 détections présentes (insertion en base, puis
   `ANALYZE`) ; un compte **RSSI non administrateur** membre de 3 périmètres, et l'administrateur. Pour chacun :
   `GET /api/vulnerabilites/constats`, `/machines`, `/machines/:id`, `/vue-ensemble`, `/recherche?q=CVE-2099-…` ;
   assertion p95 < 800 ms (listes et fiche) et < 1 500 ms (vue d'ensemble, recherche), et **même résultat** que la
   requête de référence (nombre de constats et de machines lisibles), pour que l'optimisation ne change pas les droits.
   Esquisse :

   ```ts
   const p95 = await mesurer('constats (RSSI)', '/api/vulnerabilites/constats', (r) => expect(r.total).toBe(attendu));
   expect(p95.p95Ms).toBeLessThan(800);
   const fiche = await mesurer('fiche machine', `/api/vulnerabilites/machines/${machine}`, () => {});
   expect(fiche.p95Ms).toBeLessThan(800);
   ```
2. **Nombre de requêtes SQL par appel** (PERF-06, PERF-08, PERF-10, PERF-11) : compter les requêtes du pool pendant un
   appel (`svc.db.pool.query` enveloppé dans le test) sur un jeu de 30 périmètres et 60 registres ;
   `GET /api/registres`, `/api/registres/mes-elements`, `/api/grc/notifications` (100 notifications),
   `/api/grc/perimetres/synthese` : assertion « nombre de requêtes indépendant du nombre de registres, de notifications
   et de périmètres » (par exemple ≤ 40), ce qui détecte toute rafale N+1 sans dépendre de la machine.
3. **Écriture du registre des incidents** (PERF-07) : 3 000 incidents insérés ; `POST /api/incidents` et
   `PATCH /api/incidents/:id` p95 < 800 ms, et taille ajoutée à `state_history` par écriture < 100 Ko.
4. **Journal d'audit** (PERF-12) : 2 000 000 de lignes (`generate_series`) ; `GET /api/admin/audit?q=<absent>` p95
   < 1 500 ms. Coût d'insertion élevé en CI (≈ 20 s) : à réserver à un travail nocturne si nécessaire.
5. **Banc complet** : versionner les scripts de ce passage dans `tests/perf/` et les lancer avant chaque version majeure
   sur le serveur de recette (les seuils du RSSI y ont leur sens), pas en CI.


## 9. Ce qui relève d'une décision du RSSI

- **PERF-09** : lever ou non les bornes de synchronisation Tenable (20 000 détections, 100 pages, 480 s, 100 000 éléments)
  pour un parc de 1 000 machines, ou synchroniser par dépôt (plusieurs exécutions bornées) ; effet sur la durée et sur la
  place en base.
- **Paramètres de PostgreSQL** (`shared_buffers`, `work_mem`, `effective_cache_size`, `jit`) et éventuellement la limite
  mémoire du conteneur db (1 Gio) : changement du `docker-compose.yml` publié.
- **Seuils** : le RSSI peut confirmer que l'objectif « liste 500 ms » s'applique aussi aux appels de la coquille (registres,
  notifications) et fixer un objectif d'écriture (le profil n'en donne pas : les écritures du registre des incidents sont
  jugées ici comme des fiches).
- **Registre des incidents dans l'état historique** (ADR 0040) : la réécriture complète de la table et l'instantané de
  7,7 Mo à chaque écriture sont des conséquences du modèle ; passer à une écriture par ligne ou sortir les incidents de
  l'état historique est une décision d'architecture.
- **Pagination** du registre des incidents (6,7 Mo) et de l'état du suivi (6,9 Mo) : changement de contrat d'API visible
  de l'écran.
- **Fil unique de l'API** : si, après correctifs, la queue reste longue à 20 personnes, plusieurs processus Node (grappe)
  ou une seconde instance derrière le frontal ; décision d'architecture et d'exploitation.
- **Versionner le banc** dans `tests/perf/` (scripts de ce passage) et le test de non-régression proposé.

## 10. Reproduire

Scripts du banc (non versionnés, à ranger dans `tests/perf/` si le RSSI le décide) : `pile.sh` (pile jetable),
`installer.mjs`, `remplir-api*.mjs`, `remplir-sql.sql`, `remplir-vulns.sql`, `sync-simulee.mjs`, `banc-api.mjs`,
`banc-pages.mjs`, `charge.mjs`, `ecritures-incidents.mjs`, `sauvegarde-restauration.sh`, `extraire-requete.py`,
`comparer.py`. Ordre : `pile.sh demarrer` → `installer.mjs` → `remplir-api.mjs` → attendre l'automate (18 000 occurrences)
→ `psql -f remplir-sql.sql` → `sync-simulee.mjs preparer` puis `synchroniser <id> 1000 3000 20000` →
`psql -f remplir-vulns.sql` → `ANALYZE` → mesures → `pile.sh arreter`.

`pile.sh` attend un `git worktree` du commit testé dans `banc/wt` (créé au début, supprimé à la fin de ce passage). Fin du
banc : pile arrêtée (`pile.sh arreter`), dossier `/srv/suivi-banc-perf` effacé (identifiants et sessions de recette
compris), images `perf3038` et worktree supprimés ; le dépôt principal n'a pas été modifié.
