# Demande de correctifs à la session de développement — recette du RSSI virtuel (11 et 12/11/2026)

Destinataire : session de développement dédiée (Sonnet). Émetteur : session de recette « Agent RSSI virtuel »
(`session_01EnWdzi6XW7jw824ozEWpfF`). Constats détaillés : rapports du [11/11](RAPPORT-2026-11-11.md) et du
[12/11](RAPPORT-2026-11-12.md) ; registre : [BUG-016 à BUG-036](../../04_QUALITE/REGISTRE_BUGS.md).

## 1. Répartition des rôles (décision du RSSI, 11/11/2026)

- La session de recette **teste et constate** ; elle ne modifie ni `apps/` ni `packages/`.
- La session de développement **corrige**, avec ses propres tests unitaires et de bout en bout (règles d'`AGENTS.md` et de
  `CONTRIBUTING.md`).
- Ne pas modifier `tests/e2e/rssi-virtuel/` : les tests marqués `test.fail(true, 'RSSI-NN ouvert…')` passent tant que le
  défaut existe et deviennent rouges une fois corrigé. Signaler le correctif (numéro de BUG, PR) ; la recette repasse,
  vérifie à l'écran et retire le marqueur. Ces tests ne tournent que dans le workflow « RSSI virtuel », pas dans les
  contrôles exigés pour fusionner.

## 2. Avertissement : la recette n'a pas tourné sur les briques de l'application

| Brique | Application (`docker-compose.yml`, `package.json`) | Recette des 11 et 12/11 |
| --- | --- | --- |
| Base de données | PostgreSQL 18 (`postgres:18-alpine`) | **PostgreSQL 16.15** |
| Node | 26 ou plus | **22.23** (contrôle `engines` levé) |
| Exécution | images Docker, Caddy, service de mise à jour | API par `tsx`, interface par Vite, sans passerelle |
| Navigateur | conteneur Playwright officiel | Chrome du poste |

Cause : les registres d'images (Docker Hub, GHCR, MCR) et les dépôts de PostgreSQL et de Node sont refusés par le réseau de
la session de recette ; l'installation de binaires tiers y est interdite. **Le RSSI demande les mêmes briques que
l'application** : tant que ce n'est pas le cas, les constats sont à tenir pour **non confirmés sur la cible**.

Conséquences pour le développement :

1. **Avant de corriger un constat, le reproduire sur la pile réelle** (PostgreSQL 18, Node 26) :
   `sudo tests/e2e/rssi-virtuel/lancer.sh` (pile Docker éphémère et harnais) ou
   `sudo tests/e2e/rssi-virtuel/lancer.sh --garder` puis les étapes de reproduction ci-dessous. Ce script n'a jamais été
   exécuté : s'il échoue, le signaler à la recette (c'est son outil), ne pas le contourner.
2. Appréciation de la recette, à vérifier : aucun constat ne repose sur un comportement SQL. Tous portent sur des libellés,
   des règles de validation ou la source lue par un écran, et cinq causes sont confirmées par lecture du code (BUG-017, 020,
   021, 027, 032). Ce n'est pas une preuve sur PostgreSQL 18.
3. À ignorer : la réponse 404 sur `/update/client.js` et les heures affichées en UTC viennent de la pile de recette.

## 3. Ordre de traitement proposé

| Lot | Constats | Motif |
| --- | --- | --- |
| 1. Chiffres faux de la revue de direction | BUG-020, BUG-021, BUG-030 | Deux bloquants ; même famille : l'écran lit le registre historique au lieu des fiches du Pilotage |
| 2. Déclaration d'applicabilité | BUG-016, BUG-017, BUG-026, BUG-027, BUG-019, BUG-033, BUG-036 | Exigence 6.1.3 d) et traçabilité risque → traitement → mesure |
| 3. Risques | BUG-022, BUG-023, BUG-025 | Blocages et affichage illisible à la première utilisation |
| 4. Libellés | BUG-029, BUG-018 | Interface en français |
| 5. Indicateurs et actions | BUG-028, BUG-034, BUG-035 | Chiffres et saisies ambigus |
| 6. Revue de direction | BUG-032 | Message de validation |
| En attente d'arbitrage du RSSI | BUG-031, BUG-024 | **Ne pas corriger avant décision** (voir § 5) |

## 4. Fiches

Périmètre commun : `00000000-0000-4000-8000-000000000001`. Compte : administrateur créé à l'installation. Données fictives
uniquement. « Piste » = endroit repéré par la recette en lisant le code, sans garantie.

### Lot 1

**BUG-020 — Parties intéressées saisies à l'écran comptées nulle part** (bloquant, P1)

- Reproduire : Organisation → Parties intéressées → « Ajouter partie intéressée » (exigences traitées : Oui ; dernière revue :
  01/06/2025) → Enregistrer. Puis Pilotage → Revues de direction.
- Observé : fiche listée, mais bandeau « 0 parties intéressées, 0 exigences traitées, 0 non revues depuis un an » ; la revue
  indique « 0 partie intéressée enregistrée(s) ».
- Attendu : bandeau 1 / 1 / 0 / 1 ; entrée de revue cohérente.
- Piste (cause confirmée) : `apps/web/src/pilotage/Pestel.tsx` (`SynthesePartiesBandeau`) et `apps/api/src/pilotage/revue.ts`
  lisent `interested` de l'état historique (`/api/suivi/etat`), pas les objets `stakeholder`.
- Test de recette : `specs/30-recette-2026-11-12.spec.ts`, « RSSI-05 ouvert ».

**BUG-021 — Revue de direction validée non reconnue comme dernière revue** (bloquant, P1)

- Reproduire : Revues de direction → « Préparer une revue avec ces entrées » → intitulé, date, participants, responsable,
  « Résultats, risques et indicateurs examinés », « Décisions et moyens » → Enregistrer → « Valider » avec un justificatif.
- Observé : état « Validé », mais « Dernière revue : Aucune » et entrée 9.3.2 a « Aucune revue de direction précédente
  enregistrée. ».
- Attendu : date de la revue validée au bandeau ; entrée 9.3.2 a alimentée par ses décisions.
- Piste (cause confirmée) : `apps/api/src/pilotage/revue.ts` lit `etat.reviews`, pas les objets `management_review`.

**BUG-030 — Audit interne : référentiels impossibles à choisir, programme à zéro** (majeur, P2)

- Reproduire : Pilotage → Audits internes → « Ajouter audit » (date prévue 10/12/2026) ; ouvrir la liste « Référentiels
  audités ».
- Observé : liste sans option ; « Programme d'audit interne 0/0 réalisé(s), 0 au total » ; revue : « Audit interne 2026 : 0
  réalisé(s), 0 à venir, 0 en retard ».
- Attendu : clauses ISO 27001, annexe A et HDS proposées ; audit planifié compté « à venir » au programme et dans la revue.
- Piste : `apps/web/src/pilotage/Fields.tsx` (liste alimentée par les référentiels publiés, aucun sur installation neuve) ;
  compteurs du programme dans `packages/shared/src/suivi-plans.ts` et `apps/web/src/pilotage/Plans.tsx`.

### Lot 2

**BUG-016 — Exclusion d'une mesure de la DdA sans justification** (majeur, P1)

- Reproduire : Conformité → Annexe A → colonne « Applicable » d'une mesure → « Non », justification vide ; ou
  `PATCH /api/dda/A-5.7 {"app":"non","just":""}`.
- Observé : 200, mesure « Exclue », aucun signalement.
- Attendu : justification exigée, ou exclusion non justifiée signalée (indicateur et filtre, comme « Total avec écart
  ouvert »).
- Piste : `packages/shared/src/suivi-dda.ts` (`DdaModification`, `incoherente`).
- Test de recette : `specs/10-dda.spec.ts`, « RSSI-01 ouvert » ; invariant INV-03.

**BUG-017 — Taux de mise en œuvre calculé sur les mesures non examinées** (majeur, P1), avec son complément RSSI-13

- Reproduire : DdA de l'annexe A avec 6 mesures examinées, dont 5 applicables et 3 « Total ».
- Observé : « 3 % en mise en œuvre totale » (3 / 92) au lieu de 60 % ; dans « Applicabilité et justifications », une mesure
  jamais examinée (A-5.2) est affichée « Applicable ☑ ».
- Attendu : taux sur les mesures examinées et applicables ; « non examinée » distincte de « applicable » sur tous les écrans.
  La Synthèse du Pilotage le fait déjà (« Non renseigné 95 % ») : s'en inspirer.
- Piste (cause confirmée) : `statsDda` dans `packages/shared/src/suivi-dda.ts`.
- Test de recette : `specs/10-dda.spec.ts`, « RSSI-02 ouvert ».

**BUG-026 — Traitement d'un risque invisible dans la DdA** (majeur, P1)

- Reproduire : publier une méthode, créer le risque R-01, puis Risques → Traitements → « Ajouter un traitement » relié à R-01
  et à la mesure « Sauvegarde des informations » (A.8.13). Ouvrir la fiche A.8.13 de la DdA.
- Observé : « Risques traités » vide (texte libre), aucun lien ; rien dans « Applicabilité et justifications ».
- Attendu : la mesure affiche les risques et traitements reliés (lecture seule, avec lien).
- Piste : `apps/web/src/dda/Dda.tsx` (champ libre « Risques traités ») ; le traitement stocke
  `measureRefs: ["legacy:items:A-8.13"]`.

**BUG-027 — « Origine de référence inconnue » dans les liens d'une déclaration d'applicabilité** (majeur, P1)

- Reproduire : Conformité → Applicabilité et justifications → ouvrir A-8.13 → onglet « Liens et justificatifs ».
- Observé : alerte d'erreur ; `GET /api/grc/<périmètre>/links?ref=legacy:dda:A-8.13` → 422.
- Attendu : 200 et liste des liens (vide ou non).
- Piste : `apps/api/src/grc/core.ts`, ligne 1437 environ (origine `legacy:dda` non reconnue).
- Test de recette : `specs/30-recette-2026-11-12.spec.ts`, « RSSI-12 ouvert ».

**BUG-019 — Écart désigné par son identifiant technique dans la DdA** (mineur, P2)

- Observé : colonne « Écarts » = UUID de l'écart. Attendu : intitulé, avec lien vers la fiche.
- Piste : `apps/web/src/dda/Dda.tsx`, lignes 181 à 183 et 252 (`{e.id}`). Le test existant
  `zzzzzzzzzzzzzzz-dda-evaluations.spec.ts` vérifie aujourd'hui cet identifiant : à adapter.
- Test de recette : `specs/20-ecarts.spec.ts`, « RSSI-04 ouvert ».

**BUG-033 — Document rattaché à une mesure invisible dans la DdA** (mineur, P3)

- Reproduire : Documents → déposer un fichier → Modifier → « Rattachements » : A.5.1 → Enregistrer ; ouvrir la fiche A.5.1.
- Observé : « Documents associés » vide. Attendu : documents rattachés listés.

**BUG-036 — Parcours ISO : « Applicabilité — Aucun travail trouvé »** (mineur, P3)

- Observé : étape « Applicabilité » sans travail alors que six mesures de la DdA sont examinées ; les autres étapes passent
  bien à « Travaux présents ». Piste : `apps/web/src/parcours-iso/travaux.ts`.

### Lot 3

**BUG-022 — Créer un risque sans méthode publiée** (majeur, P2)

- Reproduire : installation neuve → Risques → « Ajouter un risque » → remplir → « Enregistrer la fiche ».
- Observé : liste « Méthode publiée » vide sans explication ; « Erreur Données invalides — methodId : UUID invalide ».
- Attendu : message « publiez d'abord une méthode » avec le lien vers la configuration.
- Piste : `apps/web/src/grc/ObjectEditor.tsx`, ligne 447 environ.

**BUG-023 — Décisions d'appréciation en JSON brut, libellés anglais** (majeur, P2)

- Reproduire : apprécier un risque deux fois → « Décisions conservées ».
- Observé : `{"gross":{"color":…,"level":"low","score":null…` ; « Méthode conservée : … · draft » ; « Brut : Élevé ·
  unacceptable ».
- Attendu : brut, résiduel, acceptabilité et décision en français.
- Piste : `apps/web/src/grc/Risks.tsx`, lignes 229 à 239 ; libellés déjà présents dans
  `apps/web/src/config-grc/editeurs.tsx` (« Inacceptable »).

**BUG-025 — Refus de validation sans désigner l'étape ni le champ** (majeur, P2)

- Observé : « Validez toutes les étapes avant d'approuver l'appréciation. » (les validations sont dans la fiche du risque),
  puis « Complétez les champs obligatoires avant de valider. » ; cinq champs homonymes « Analyse et justification ».
- Attendu : message qui nomme l'étape ou le champ ; champs obligatoires marqués ; libellés distincts par étape.
- Piste : `apps/api/src/grc/risks.ts`, lignes 210 et 253.

### Lot 4

**BUG-029 — Réglages de récurrence en anglais technique** (majeur, P2)

- Reproduire : Pilotage → Tâches récurrentes → « Ajouter une tâche récurrente ».
- Observé : boutons « start », « time », « timezone », « interval », « until », « count », « reminderDays », « active » ; champ
  « recurrence.start ».
- Attendu : libellés français (début, heure, fuseau, intervalle, fin, nombre d'occurrences, rappel, active).
- Piste : `apps/web/src/grc/ObjectEditor.tsx`, vers la ligne 378.
- Test de recette : `specs/30-recette-2026-11-12.spec.ts`, « RSSI-15 ouvert ».

**BUG-018 — « Toggle password visibility »** (mineur, P3)

- Observé : écran d'installation (2 boutons) et écran « Choisir un nouveau mot de passe » (3 boutons). L'écran de connexion
  est correct (« Afficher la saisie ») : reprendre son réglage.
- Piste : `PasswordInput` dans `apps/web/src/pages/Setup.tsx` (lignes 265, 279) et `apps/web/src/pages/Login.tsx`.
- Test de recette : `specs/00-installation.spec.ts`, « RSSI-03 ouvert ».

### Lot 5

**BUG-028 — Cible d'indicateur convertie en pourcentage** (majeur, P2)

- Reproduire : Objectifs et indicateurs → « Ajouter un indicateur » → sens « ≥ », cible « 1 », valeur « 0 ».
- Observé : « ≥ 100 % » et « 0 % » ; à la réouverture, cible « 100 % ».
- Attendu : unité au choix, ou règle de saisie affichée dans la fiche.

**BUG-034 — « Créer une action suivie » : action sans intitulé ni échéance** (mineur, P3)

- Observé : formulaire de décision ; action nommée « Action : <intitulé du constat> », `dueAt` vide alors que le constat a
  une échéance ; le texte saisi n'est pas repris. Piste : `apps/api/src/pilotage/service.ts`, ligne 453 environ.

**BUG-035 — « Actions » comptées différemment selon l'écran** (mineur, P3)

- Observé : Amélioration continue « 3 ouvertes, 3 en retard » (occurrences d'une série récurrente) ; Synthèse et tableau de
  bord « 0 action ouverte » et « 3 occurrences en retard ». Attendu : même définition partout.

### Lot 6

**BUG-032 — Validation de la revue refusée sans désigner « Décisions et moyens »** (majeur, P2)

- Observé : « Complétez les informations et justificatifs avant validation. » ; le champ exigé n'est pas marqué.
- Piste (cause confirmée) : `apps/api/src/pilotage/service.ts`, vers la ligne 330 (`inputs`, `decisions`, justificatif).

## 5. En attente d'arbitrage du RSSI : ne pas développer

- **BUG-031** : la revue de direction prépare les entrées de l'ISO 9001 (choix de l'ADR 0036). Question posée au RSSI :
  ajouter celles de l'ISO/IEC 27001:2022, 9.3.2 (dont les résultats de l'appréciation des risques, l'état du plan de
  traitement et les incidents de sécurité) quand le périmètre porte ce référentiel ?
- **BUG-024** : le modèle de méthode « ISO/IEC 27005 » laisse déclarer « Grave × Probable = Faible, acceptable » sans
  alerte. Question : alerte, matrice par défaut, ou jugement libre assumé ?
- **Rôle d'auditeur interne** : aucun rôle ne permet de saisir des constats sans pouvoir modifier la DdA auditée.

## 4 bis. Ajout du 12/11 au soir : rattachement des processus (BUG-037, majeur, P1)

Demande expresse du RSSI : un processus doit être rattaché à un périmètre.

- Reproduire : créer un sous-périmètre (Organisation → Périmètres → « Ajouter un enfant »), puis Organisation → Processus avec
  ce sous-périmètre dans « Périmètre affiché ».
- Observé : page blanche. Les processus de la racine sont dans le registre historique (`suivi_processus`, sans colonne de
  périmètre, fiche sans champ de périmètre) ; ceux d'un sous-périmètre sont des objets du Pilotage créés depuis « Objectifs
  par processus », avec un autre formulaire. Les deux registres s'ignorent.
- Attendu : périmètre porté par chaque processus et visible dans sa fiche ; page « Processus » utilisable pour tout
  périmètre ; un seul registre.
- Piste (cause confirmée) : `apps/web/src/pages/Pilotage.tsx`, conditions `smsi === SOCLE` autour de `CartesProcessus` et
  d'`ObjectifsProcessus`. Changement de modèle de données probable : à cadrer par une ADR avant de coder.
- Test de recette : `specs/30-recette-2026-11-12.spec.ts`, « RSSI-23 ouvert ».

## 5 bis. Défauts graphiques

Vingt-trois constats d'affichage (GR-01 à GR-23), avec captures : [dossier graphique](DOSSIER-GRAPHIQUE-2026-11-12.md), relevé sur
la 6.3.0. À traiter d'abord : GR-16, GR-17 (BUG-029) et GR-07.

## 6. Retour vers la recette

Pour chaque correctif fusionné dans `claude-suivi-smsi` : numéro de BUG, PR, commit. La session de recette rejoue le
parcours à l'écran, sur les briques de l'application dès qu'elles lui sont accessibles, met à jour le rapport et le registre
(statut), et retire le marqueur `test.fail`.
