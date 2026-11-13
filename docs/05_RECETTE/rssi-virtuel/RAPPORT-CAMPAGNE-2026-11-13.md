# Rapport de la campagne de recette à plusieurs agents — 12 et 13/11/2026

| Élément | Valeur |
| --- | --- |
| Session | « Campagne multi-agent RSSI virtuel » (`session_01EnWdzfKyK172mDzj6dAUWv`), session de recette ; aucune correction de l'application |
| Dossier suivi | [CAMPAGNE-MULTI-AGENT.md](CAMPAGNE-MULTI-AGENT.md), appliqué en trois phases |
| Code testé | `2e63e86` (branche `claude/recette-rssi-2026-11-12`) ; les commits suivants de la branche ne touchent que la documentation et l'outillage de recette (`tests/e2e/rssi-virtuel/`) |
| Dates | Phase 1 : 12/11/2026, 20:55 à 23:05 ; phase 2 : 12/11, 23:05 au 13/11, 01:15 (interrompue de 00:00 à 00:40 par la limite d'utilisation puis un redémarrage) ; phase 3 : 13/11/2026, à partir de 01:15 (Europe/Paris) |
| Environnement | Six piles Docker de `lancer.sh --images-locales --pile N --garder` (`https://127.0.0.11` à `127.0.0.16`), images construites depuis la branche ; PostgreSQL 18.6 et Node 26.12.1 relevés dans les conteneurs ; Docker 29.9.2 ; Chrome de Playwright piloté par `pilote.mjs` |
| Données | Jeu fictif `tests/e2e/rssi-virtuel/donnees/organisation-fictive.json` et comptes `test7-*` ; aucune donnée réelle, aucun secret recopié |
| Agents | Phase 1 : six agents `rssi-virtuel` (un par tranche et par pile) ; phase 2 : six agents transversaux ; phase 3 : trois agents de rejeu indépendants (piles 1-2, 3-4, 5-6), puis écriture des tests |

**Briques de l'application.** Contrairement aux recettes des 11 et 12/11, la campagne a tourné sur les briques de
l'application (PostgreSQL 18, Node 26, images Docker, passerelle Caddy, exécutant d'exploitation). Les défauts BUG-016 à
BUG-037 relevés hors Docker sont **reconfirmés sur la cible** (§ 5), à l'exception partielle de BUG-030.

## 1. Bilan de la matrice

`node tests/e2e/rssi-virtuel/matrice.mjs bilan` : code retour 0, **aucune case non testée, aucune ligne mal formée**.

| Agent | Tranche | Exigées | ok | défaut | sans objet |
| --- | --- | --- | --- | --- | --- |
| 1 | Organisation, contexte, objectifs, fournisseurs | 114 | 49 | 49 | 16 |
| 2 | Risques : méthode, appréciation, traitement, EBIOS RM | 42 | 13 | 28 | 1 |
| 3 | Conformité, DdA, audits, preuves et contrôles | 126 | 64 | 61 | 1 |
| 4 | Écarts, actions, plans annuels, revue de direction, registres | 60 | 23 | 33 | 4 |
| 5 | Incidents, crise, continuité, documents, exports | 90 | 31 | 41 | 18 |
| 6 | Installation, comptes, Plateforme, Système, paramètres | 210 | 70 | 39 | 101 |
| 7 | Transversal : rôles, périmètres, compte restreint, téléphone | 1 070 | 755 | 283 | 32 |
| **Total** | | **1 712** | **1 005** | **534** | **173** |

Une case `defaut` renvoie au constat qui l'explique ; plusieurs cases partagent souvent le même constat (le défaut de
cloisonnement au sous-périmètre occupe à lui seul plus de 60 cases `restreint`). Le nombre de cases en défaut ne mesure
donc pas le nombre de défauts.

**Cases sans objet (173), et pourquoi.**

| Raison | Cases |
| --- | --- |
| Réglage, bibliothèque ou administration d'instance, mur, documents, exports : l'écran n'a pas de sélecteur de périmètre (case « sous-périmètre » de la phase 1) ; contenu relu identique | 109 |
| Même raison, vue par les autres rôles en phase 2 (tableau de bord, cartographie, mur, documents, exports, espace contributeur, activation d'un écran mural) | 32 |
| Écran sans saisie ou à choix fermés : aucun état « erreur » possible (synthèse, calendrier des plans, rappels, sessions, détails techniques, apparence) | 17 |
| Installation, connexion et préférences personnelles, indépendantes du périmètre | 9 |
| Écran jamais vide : aucun état « vide » possible (journal d'audit, journaux techniques, détails techniques, guide) | 4 |
| Fonction dépendant d'un service extérieur à la pile (vérification des mises à jour) ou d'un fichier absent du jeu fictif (export Tenacy) | 2 |

**Cases rattachées à C6-20, écarté.** Six cases de « Sauvegardes », « Mises à jour » et « Certificats » renvoyaient à
C6-20, que le rejeu a classé « outillage » (§ 3). Après correction de `lancer.sh`, elles ont été **retestées** sur la pile 6
([constats du rejeu](campagne/constats-rejeu-pile-6.md)) : trois ok, deux en défaut sur des constats nouveaux (R6-01,
R6-03, mineurs), une en défaut sur T6-04 (téléphone). Les chiffres ci-dessus en tiennent compte.

## 2. Défauts par gravité

| Étape | Bloquants | Majeurs | Mineurs | Remarques | Total |
| --- | --- | --- | --- | --- | --- |
| Constats des phases 1 et 2 (avant dédoublonnage) | 6 | 47 | 80 | 27 | 160 |
| Constats de la phase 3 (R12-01 en écrivant les tests ; R6-01 à R6-04 en retestant les cases C6-20) | 0 | 1 | 3 | 1 | 5 |
| Après rejeu des bloquants et majeurs, et arbitrage de BUG-051 (constats) | 19 | 31 | 86 | 28 | 164 |
| **Défauts inscrits au registre (BUG-038 à BUG-077)** | **14** | **26** | — | — | **40** |

- **Rejeu** (phase 3) : 53 constats bloquants ou majeurs. 50 reproduits (dont 4 en partie), 1 « outillage » (C6-20),
  **0 non reproduit** ; T5-01 et T6-02, doublons de T1-01, n'ont pas été rejoués séparément.
- **Gravités montées à bloquant** : C2-03, C3-05, C3-06, C4-05, C5-01, C5-06, C5-11, C5-15, C6-04, C6-05.
- **Gravités baissées** : C1-12 (bloquant → majeur : l'écart est bien dans la DdA) ; C2-08, C2-17, C6-15 (majeur → mineur).
- **Dédoublonnage** : 49 constats retenus → 39 fiches. Fusions : cloisonnement au sous-périmètre (T1-01, T2-01, T3-01,
  T4-01, T5-01, T6-02 → BUG-051) ; fiches non archivables (C1-03, C2-10, C5-03 → BUG-052) ; exports incomplets (C2-05,
  C5-16 → BUG-058) ; écart ignoré par la DdA (C3-06, C4-04 → BUG-041) ; sélecteur de périmètre sans effet (C3-01, C4-02 →
  BUG-062) ; resélection du périmètre (C5-17, avec le mineur T5-04 → BUG-068).
- **Défaut nouveau trouvé en phase 3** (écriture du test CAMP-C1-12) : identifiant FOU-0n du clausier réattribué après
  archivage, création en erreur 500 (R12-01 → BUG-077), confirmé par la session principale dans le journal de l'API.
- **Mineurs et remarques** (114) : non rejoués (le § 5 de la campagne ne l'exige que pour les bloquants et majeurs), non
  inscrits un par un au registre ; ils restent dans les fichiers `campagne/constats-*.md` (dont R6-01 à R6-04 dans
  `campagne/constats-rejeu-pile-6.md`). Thèmes dominants : messages
  d'erreur qui nomment le champ par sa clé technique ou affichent la clé de permission (`Droit requis : pilotage:modifier`) ;
  actions proposées à un rôle puis refusées par le serveur ; boutons de fermeture sans nom accessible ; doublons et dates
  incohérentes acceptés sans message ; au téléphone, colonnes d'actions coupées dans les tableaux ; date d'expiration d'un
  compte calculée en UTC (le compte reste ouvert jusqu'à 00:59 le lendemain à Paris) ; vocabulaire ISO 9001 dans un SMSI
  ISO/IEC 27001.

### Bloquants (14)

| Fiche | Défaut | Constats |
| --- | --- | --- |
| BUG-038 | Export « Contexte du SMSI » vide malgré les fiches saisies | C1-04 |
| BUG-039 | Un risque jamais apprécié peut être formellement accepté | C2-03 |
| BUG-040 | Enregistrer une fiche d'applicabilité sans rien changer déclare la mesure « Applicable » | C3-05 |
| BUG-041 | Écart rattaché à l'exigence d'un référentiel ignoré par la DdA | C3-06, C4-04 |
| BUG-042 | Revue de direction : rien sous un périmètre enfant sans héritage ; non-conformités d'un enfant qui hérite absentes de la revue du parent | C4-05 |
| BUG-043 | Compteur « Continuité » limité aux plans PCRA | C5-01 |
| BUG-044 | Incidents et crise sans périmètre : un non-membre lit les incidents d'un sous-périmètre | C5-06 |
| BUG-045 | RETEX : gravité « Faible » affichée pour un incident critique sans gravité saisie | C5-11 |
| BUG-046 | Export Excel : une piste de progrès libellée « Point sensible » | C5-15 |
| BUG-047 | « Référentiel complémentaire actif » affiché vide ; l'enregistrer désactive ReCyF | C6-04 |
| BUG-048 | Catégorie NIS 2 impossible à remettre à vide ; « enregistré » et journal inexacts | C6-05 |
| BUG-049 | Un contributeur archive un registre qu'il n'a pas créé | T4-02 |
| BUG-050 | Un contributeur retire des événements de la chronologie RETEX sans le droit « supprimer » | T5-02 |
| BUG-051 | Un compte rattaché à un périmètre enfant voit et modifie le parent ; rattaché au parent, il ne voit pas les enfants | T1-01, T2-01, T3-01, T4-01, T5-01, T6-02 |

**BUG-051, arbitré par le RSSI le 13/11/2026** : un compte est rattaché à un périmètre ; rattaché à un périmètre enfant,
il ne voit que ce périmètre ; rattaché au parent, il voit le parent et les enfants rattachés à ce parent. Aujourd'hui, le
contributeur membre du seul périmètre enfant lit le parent et y écrit (`POST …/objects` et `PATCH /api/dda/A-5.1` → 200),
et l'appartenance ne descend pas vers les enfants (ADR 0039). « Hébergement HDS » est le nom du périmètre enfant du jeu
fictif, pas le référentiel HDS. La correction amende l'ADR 0039 (ADR de la session de développement).

### Majeurs (26)

| Fiche | Défaut | Constats |
| --- | --- | --- |
| BUG-052 | Fiches du Pilotage ni archivables ni supprimables à l'écran | C1-03, C2-10, C5-03 |
| BUG-053 | PESTEL, cartographie et processus ignorent les SWOT et enjeux saisis | C1-05 |
| BUG-054 | Évaluation d'un fournisseur : la page plante au troisième clic sur un critère | C1-07 |
| BUG-055 | Objectifs et indicateurs : deux modèles selon le périmètre | C1-10 |
| BUG-056 | Clausier : « Créer les actions » ne crée aucune action ; écart sans responsable ni échéance | C1-12 |
| BUG-057 | « Stratégie » affichée « Réduire » mais envoyée vide | C2-01 |
| BUG-058 | Exports incomplets : risques, traitements, EBIOS RM, « export complet » | C2-05, C5-16 |
| BUG-059 | Codes anglais et valeurs techniques à l'écran (extension de BUG-023) | C2-06 |
| BUG-060 | Choix des mesures d'un traitement sans référence, avec doublons | C2-07 |
| BUG-061 | EBIOS RM : scénario opérationnel non placé dans la matrice | C2-09 |
| BUG-062 | Sélecteur « Périmètre affiché » sans effet sur la DdA, l'audit et les plans annuels | C3-01, C4-02 |
| BUG-063 | Trois registres d'applicabilité qui s'ignorent | C3-02 |
| BUG-064 | « Référentiels et exigences » ignore les référentiels appliqués | C3-03 |
| BUG-065 | Niveau de mise en œuvre accepté sur une mesure non examinée et compté « Total » | C3-04 |
| BUG-066 | Deux registres d'exercices qui s'ignorent | C5-04 |
| BUG-067 | Scénario de crise : responsable d'une action perdu sans message | C5-05 |
| BUG-068 | Resélectionner le périmètre affiché bascule sur la racine | C5-17, T5-04 |
| BUG-069 | Crise réelle : le bandeau rouge annoncé n'existe pas | C5-18 |
| BUG-070 | Les incidents ne remontent dans aucune synthèse | C5-19 |
| BUG-071 | Revue des accès (A.5.18) sans les accès aux périmètres | C6-12 |
| BUG-072 | Date du dernier test de restauration dans le futur acceptée | C6-21 |
| BUG-073 | Versions de l'état toutes vides | C6-22 |
| BUG-074 | Au téléphone, la DdA n'affiche pas l'applicabilité ni la mise en œuvre | T3-03 |
| BUG-075 | Un contributeur modifie les décisions d'une revue de direction validée | T4-03 |
| BUG-076 | Le module « Incidents et PCA/PRA » n'ouvre pas les plans de continuité | T5-03 |
| BUG-077 | Clausier : identifiant FOU-0n réattribué après archivage, création en erreur 500 | R12-01 (phase 3) |

Détail (observé, attendu, piste, test) : [registre des bugs](../../04_QUALITE/REGISTRE_BUGS.md), BUG-038 à BUG-077.

### Causes communes

- **Registre historique contre objets du Pilotage** : BUG-038, 053, 058, 066 (et BUG-020 de la recette précédente) : un
  écran ou un export lit l'état historique (`/api/suivi/etat`) alors que les formulaires écrivent les objets
  (`/api/grc/:smsiId/objects`).
- **Fonctions réservées au périmètre racine** : BUG-042, 044, 055, 062 (et BUG-037) : registres sans colonne de périmètre
  derrière le sélecteur « Périmètre affiché ».
- **Droits** : BUG-049, 050, 075 : une écriture permise au contributeur qu'un RSSI attend réservée ; BUG-051 : cloisonnement par
  périmètre arbitré par le RSSI.
  Ailleurs, les refus sont conformes (§ 4).
- **Listes Mantine désélectionnables** : BUG-057, 068 (et BUG-022) : recliquer la valeur affichée la vide.

## 3. Constats écartés

| Constat | Verdict du rejeu | Suite |
| --- | --- | --- |
| C6-20 « Exécutant d'exploitation indisponible » | **outillage** : l'exécutant (`updater`) ne trouvait pas le `.env` de la pile, puis lançait `docker compose` sans le nom de projet de la pile | `lancer.sh` corrigé (commits `2171449`, `8a4f53a`) ; exécutant disponible, deux sauvegardes chiffrées réussies et listées sur la pile 6 |
| INV-08 en ÉCHEC (piles 1 et 5) | **faux positif de l'invariant** : la DdA désigne un écart né dans le registre historique par son `legacyId` (« FOU-01 », « INC-AC-01 ») | `invariants.ts` corrigé (commit `988e7b0`) |

Aucun constat bloquant ou majeur n'a été écarté pour « non reproduit ».

## 4. Ce qui est conforme

- **Droits, sur les six tranches** : lecteur et auditeur externe en lecture seule (plusieurs centaines d'écritures rejouées
  par l'API, toutes refusées en 403, données inchangées) ; contributeur sans suppression, administration, validation de
  revue, import ni export (sauf BUG-049, BUG-050, BUG-075) ; un compte non membre d'un périmètre reçoit 404 ;
  l'auditeur externe ne voit que ses modules ; son expiration coupe la session ouverte (401) et refuse la connexion ;
  le journal d'audit attribue chaque écriture à son auteur.
- **Chaîne écart → action → efficacité → clôture** : conforme (clôture refusée sans analyse des causes, efficacité refusée
  sans preuve) ; une action terminée ne recalcule pas le résiduel.
- **Risques** : niveau brut recalculé depuis les échelles de la matrice épinglée ; carte égale au registre, en brut et en
  résiduel ; calculs EBIOS RM justes.
- **DdA** : 93 mesures (37/8/14/34).
- **Isolement des données** entre périmètres pour les registres qui portent un périmètre (organisation, risques, écarts,
  actions, revues).
- **Sauvegardes** (après correction de l'outillage) : exécutant disponible ; cinq sauvegardes demandées à l'écran par
  l'administrateur installé et un second administrateur, toutes réussies, chiffrées, empreinte vérifiée, tracées au journal.
- **Aucune erreur JavaScript ni CSP** relevée ; une seule réponse HTTP 5xx, trouvée en phase 3 (BUG-077) ; aucune page ne défile horizontalement au téléphone.

## 5. Défauts connus (BUG-016 à BUG-037) sur les briques réelles

Reconfirmés : BUG-016, 017, 018, 019, 020, 021, 022, 023, 025, 026, 027, 028, 029, 032, 033, 034, 035, 036, 037.
Constatés sans être tranchés (arbitrage du RSSI) : BUG-024, BUG-031. **Reproduit en partie** : BUG-030 (la liste
« Référentiels audités » propose ISO/IEC 27001 et HDS une fois les référentiels attribués et appliqués ; le programme reste
à « 0/0 » après la création de la fiche d'audit). Extensions relevées : BUG-018 touche aussi Mon compte, Courriel et
Sécurité ; BUG-023 s'étend à la carte, à l'atelier 5 et au rapport (BUG-059).

## 6. Arbitrages du RSSI

Rendus le 13/11/2026 : BUG-051 (voir § 2, bloquants) ; BUG-049, seul le gestionnaire du registre peut l'archiver et le désarchiver ;
BUG-042, chaque périmètre enfant a sa propre revue de direction, sauf s'il hérite des référentiels du parent (ses
entrées remontent alors dans la revue du parent) ; BUG-024 (recette du 12/11), la matrice est obligatoire pour apprécier
un risque (test RSSI-09 ajouté au fichier 41). Restent attendus :

| Sujet | Question |
| --- | --- |
| BUG-031, rôle d'auditeur interne | Arbitrages de la recette du 12/11, toujours ouverts. |

## 7. Tests de non-régression

46 tests `test.fail` ajoutés au harnais, un ou plusieurs par fiche (BUG-038 à BUG-077), écrits par les agents de rejeu
à partir de leurs recettes et nommés « CAMP-<constat> ouvert : <comportement attendu> » :

| Fichier | Tests | Fiches |
| --- | --- | --- |
| `specs/41-campagne-organisation-risques.spec.ts` | 15 | organisation, fournisseurs, risques, EBIOS RM, cloisonnement par périmètre (CAMP-T1-01 et CAMP-T1-02, ajouté après l'arbitrage de BUG-051), BUG-077 (CAMP-R12-01) |
| `specs/42-campagne-conformite-ecarts.spec.ts` | 13 | DdA, référentiels, écarts, plans, revue de direction, registres |
| `specs/43-campagne-incidents-plateforme.spec.ts` | 18 | continuité, incidents, crise, exports, Plateforme, Système |

Chaque fichier ne dépend que de l'installation : il crée ses données fictives, ses périmètres et ses comptes, et archive ce
qui gênerait les invariants. Chaque test décrit le comportement attendu après correction ; il échoue tant que le défaut
existe et **devient rouge le jour où il est corrigé**, ce qui oblige à retirer le marqueur. Aucune assertion affaiblie,
aucun `test.skip`.

**Exécution du harnais complet** : `sudo CI=1 tests/e2e/rssi-virtuel/lancer.sh --images-locales` sur une pile vierge
`https://localhost`, quatre passages : **65 passed** puis, après l'ajout de CAMP-T1-02 et l'alignement de CAMP-C4-05
sur les arbitrages, **66 passed**, code retour 0
(12 tests verts, dont les invariants INV-01 à INV-08 ; 54 échecs attendus, 8 de la recette du 12/11 et 46 de la
campagne). Le message d'échec de chacun des 54 a été relu dans
`test-results/resultats.json` : c'est l'assertion du défaut dans tous les cas, jamais une préparation
([relevé](campagne/harnais-2026-11-13.md)).

Un premier passage sur une pile numérotée (`--pile 7`, `https://127.0.0.17`) n'est **pas valable** : sur une adresse IP,
l'installation ne propose pas de clé de sécurité, `00-installation` s'arrête et les tests suivants échouent faute de
compte ; les `test.fail` y « passent » pour une mauvaise raison. Le harnais complet ne se lance donc que sans `--pile`.

Non exécutés : `pnpm --filter @suivi/api test` (dont `references-organisation.test.ts`, qui exige la base PostgreSQL de
test, absente de la session ; une recherche des motifs interdits sur les fichiers ajoutés ne trouve rien), le workflow
GitHub `rssi-virtuel.yml`. Exécutés : `pnpm run typecheck` (tests de bout en bout), `prettier --check` et `eslint` sur les
fichiers de tests ajoutés : code retour 0.

## 8. Outillage de recette

- `lancer.sh` exécuté pour la première fois : trois défauts corrigés dans le script (`.env` de la pile pour `app` et
  `updater`, projet Compose de l'exécutant, option `--images-locales` pour construire derrière un proxy TLS avec le secret
  BuildKit `build_ca`). Docker crée un `.env` vide (ignoré par Git) comme point de montage ; `--arreter` le retire.
- `lancer.sh` vérifie le port 443 avec `ss`, absent de certaines machines : le contrôle est alors muet. À durcir.
- `pilote.mjs api` exige `NODE_EXTRA_CA_CERTS` pointant vers la racine publique de la pile (autorité locale de Caddy).
- Limites du pilote contournées par de petits scripts Playwright hors dépôt : pas d'en-tête `If-Match`, pas de récupération
  des téléchargements, pas de choix du n-ième bouton homonyme ni des listes à choix multiples. À ajouter au pilote.
- Interruptions : limite d'utilisation des agents (phase 2) et deux redémarrages de la machine ; les données des piles ont
  survécu, les agents ont repris sans perte de résultat.

## 9. Limites

- La matrice garantit que chaque écran a été ouvert dans chaque situation, pas que chaque règle métier a été vérifiée.
- Non vérifiés : envoi réel de courriel, vérification et installation d'une mise à jour (service extérieur), renouvellement
  de certificat, restauration de sauvegarde (non exécutée par prudence), clés WebAuthn (adresse IP), exports PNG, PDF et SVG
  de la cartographie, rapport imprimable.
- Mineurs et remarques non rejoués.
