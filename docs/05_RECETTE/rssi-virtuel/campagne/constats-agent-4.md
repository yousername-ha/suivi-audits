# Constats de l’agent 4 : écarts, actions, plans annuels, revue de direction, registres

| Élément | Valeur |
|---|---|
| Commit testé | `2e63e86` (branche `claude/recette-rssi-2026-11-12`, version du dépôt 6.3.0). La branche est passée à `4fc555d` pendant la recette : commits de documentation seulement (`campagne/*.csv`), aucun changement de l’application |
| Date | 12/11/2026, 20:58 à 21:50 (Europe/Paris) |
| Pile | `https://127.0.0.14`, pile Docker éphémère n° 4 (`postgres:18-alpine`, images `suivi-audits-api`, `-web`, `-updater` construites en local), vierge au premier contact (`GET /api/setup` : `needed:true`, `adminExists:false`) |
| Version affichée | `GET /api/version` : `local`, dernière migration `054_retrait_revues_acces.sql` |
| Compte | `rssi` (Administrateur), créé à l’installation ; aucun autre compte créé |
| Périmètres | principal « SMSI Groupement Santé Fictif » (racine renommée, description du jeu fictif), sous-périmètre « Hébergement HDS » (rattaché, « Hériter des référentiels du parent » coché) |
| Données | jeu fictif uniquement (`organisation-fictive.json`) |
| Matrice | tranche 4 : 60 cases, **23 ok, 33 défaut, 4 sans objet, 0 non testée** (`matrice.mjs bilan`) |

Outillage : pilote (`pilote.mjs`, port 9337, dossier `.pilote-4`) pour la navigation, l’arbre d’accessibilité, les
captures et l’API. `pilote.mjs api` échouait sur le certificat de l’autorité locale de Caddy (« unable to get local issuer
certificate ») : la racine publique de cette autorité, lue dans le dossier de la pile 4, a été donnée à Node par
`NODE_EXTRA_CA_CERTS` (vérification TLS conservée, aucune modification de `tests/`). Pour un libellé présent à la fois dans
la page et dans la fiche ouverte (« Responsable », « État »), le suffixe `##2` du pilote désigne le champ de la fiche.
Aucune erreur JavaScript, CSP ni HTTP 5xx relevée au journal du pilote ; les seules réponses en erreur sont les 4xx
provoquées par les cas d’erreur décrits ci-dessous.

## Écrans couverts

Sous chaque périmètre, états vide, rempli et erreur.

| Écran | Principal | Sous-périmètre HDS |
|---|---|---|
| Amélioration continue | 2 écarts du jeu fictif (A.5.15, A.5.1), action suivie, efficacité vérifiée, clôture ; doublon de test | 1 écart majeur (contrat de l’infogérant), action suivie |
| Plan d’actions | création, modification, lien « Traite », archivage de 2 actions de test, clôture ; six vues | action renommée et datée ; action dans un registre partagé |
| Tâches récurrentes | série mensuelle (restauration), occurrences, validation OK, série de test archivée | série trimestrielle (sauvegardes) |
| Calendrier, planning, formation, sensibilisation | PL-FOR-001 (réalisé, preuve), PL-FOR-002 (en retard, décalé au clavier), PL-AUD-001, PL-FOR-003 supprimé | PL-SEN-001 |
| Revues de direction | revue 2026 préparée, enregistrée, validée | revue HDS en préparation |
| Mes rappels | rappels d’occurrences, ouverture, « Marquer comme lu » | rappels HDS |
| Registres (`/registres`) | registres par défaut, registre créé puis partagé, registre de test archivé, renommage | éléments par périmètre, registre HDS |

Types d’objets : `nonconformity`, `action`, `task_series`, `management_review` créés, modifiés et liés. Supprimés
(archivés) : `action` et `task_series` à l’écran ; `nonconformity` et `management_review` impossibles à l’écran (C4-08).
Exportés : « Exporter le registre et ses décisions » (JSON) et « Télécharger le rapport imprimable » proposés sur
Amélioration continue et Revues ; contenu JSON relu par l’API (`/api/grc/<périmètre>/pilotage/export?kind=…`), fichier
téléchargé non relu (Chrome sans tête ne l’enregistre pas). Le Plan d’actions n’a pas d’export propre.

Vérifications de cohérence faites : écarts du registre = tableau de bord (« ouverts », par type, par statut) =
« Total · Écarts ouverts » de Périmètres = entrée 9.3.2 c 4 de la revue (périmètre principal) ; audit interne planifié
repris en 9.3.2 c 6 (« 1 à venir ») ; décalage, suppression de plan, archivage de registre, validations au journal
d’audit ; invariants (`pilote.mjs invariants`) : INV-01 à INV-05 et INV-08 OK, INV-06 et INV-07 en ALERTE sur le doublon
de test seulement.

**Conforme, vu de bout en bout** : chaîne écart → action → efficacité → clôture (clôture refusée sans analyse des causes,
efficacité refusée sans causes ni preuve, clôture acceptée après action terminée et efficacité positive) ; une action de
traitement terminée ne recalcule pas le résiduel (R-01 reste « Modéré », le dialogue d’appréciation l’annonce) ;
séparation des écarts, actions, séries et revues entre périmètres ; registre partagé visible sous ses deux périmètres
comme annoncé ; changement de périmètres d’un registre avec aperçu d’impact et motif.

## Cases sans objet

| Case | Raison |
|---|---|
| `plans-calendrier`, principal et sous-périmètre, erreur | écran de consultation sans saisie ; les erreurs de saisie se testent dans les fiches de plan |
| `rappels`, principal et sous-périmètre, erreur | écran sans saisie (lecture et « Marquer comme lu ») |

## Constats

### C4-01 — Messages de refus qui nomment le champ par sa clé technique

- Gravité : mineur
- Écrans : Plan d’actions, Tâches récurrentes, Registres (les deux périmètres)
- Référence : AGENTS.md (interface en français) ; consigne de la campagne (« le message doit désigner le champ en français »)
- Observé : `cliquer button "Ajouter une action"` puis `cliquer button "Enregistrer la fiche"` → alerte « Erreur Données
  invalides — name : Trop petit : chaîne de caractères doit avoir >=1 caractères » (HTTP 422 `POST /api/grc/<périmètre>/objects`),
  le champ « Nom de la fiche » n’est ni marqué obligatoire ni signalé. Série, intervalle 0 ou -2 : « recurrence.interval :
  Trop petit : nombre doit être >=1 ». Registre, fin avant début : « dateFin : La date de fin ne peut pas précéder la date
  de début. » Les messages métier voisins sont corrects (« Le début doit précéder l’échéance. », « Une clôture doit
  conserver sa justification. »).
- Attendu : le libellé affiché du champ (« Nom de la fiche », « Intervalle », « Fin du plan ») et le champ marqué.
- Reproductible par : à écrire (création d’action sans nom, lecture de l’alerte).

### C4-02 — Plans annuels sans périmètre : ce qui est saisi sous un périmètre apparaît sous l’autre

- Gravité : majeur
- Écrans : Calendrier des plans, Planning annuel des plans, Plan de formation, Plan de sensibilisation
- Référence : ISO/IEC 27001:2022, 4.3, 7.2, 7.3, 9.2 ; HDS (périmètre des activités d’hébergement) ; même famille que BUG-037
- Observé : PL-FOR-001 saisi sous « SMSI Groupement Santé Fictif » ; `ouvrir /pilotage/plans-formation?perimetre=<HDS>` →
  combobox « Périmètre affiché : Hébergement HDS », ligne « PL-FOR-001 Formation des administrateurs… ». À l’inverse,
  PL-SEN-001 saisi sous « Hébergement HDS » s’affiche sous le périmètre principal. Calendrier et planning sous HDS montrent
  aussi PL-FOR-002 et l’audit interne PL-AUD-001 du principal. Les plans sont lus par `GET /api/plans` (aucun paramètre de
  périmètre, registre historique `plans` de `/api/suivi/etat`).
- Attendu : chaque action de plan porte son périmètre ; un plan HDS distinct du plan du groupement, ou un rattachement
  explicite.
- À vérifier en phase 2 : un contributeur limité au sous-périmètre lit-il les plans de tout le groupement (lecture hors
  droits, bloquant si oui) ?
- Reproductible par : à écrire (saisie sous un périmètre, lecture sous l’autre).

### C4-03 — Fiches de plan : valeurs incohérentes enregistrées sans message

- Gravité : mineur
- Écrans : Plan de formation, Plan de sensibilisation (et donc calendrier et planning)
- Référence : 7.2 et 7.3 (preuves de compétence et de sensibilisation), 7.5
- Observé : PL-FOR-001, « Date prévue » 2026-10-15, « Date de fin » 2026-10-01, « Durée (heures) » -3, présents 12 pour
  8 prévus → « Modifications enregistrées. », ligne « 15/10/2026 au 01/10/2026 ». PL-SEN-001 : fin 01/01/2027 avant le
  20/01/2027 et « Taux de participation (%) » 150 enregistrés. « Preuve (lien…) » : « javascript:alert(1) » et « pas une
  adresse » enregistrés sans avertissement (affichés en texte, pas en lien : pas d’injection constatée).
- Attendu : refus ou avertissement nommant le champ, comme le fait déjà la fiche de registre (« La date de fin ne peut pas
  précéder la date de début »).
- Reproductible par : à écrire.

### C4-04 — Écart d’un sous-périmètre impossible à rattacher à une mesure ou une exigence

- Gravité : majeur
- Écran : Amélioration continue sous « Hébergement HDS » (onglet « Liens et justificatifs »)
- Référence : ISO/IEC 27001:2022, 9.2.2 et 10.2 ; traçabilité mesure → écart (grille de l’agent)
- Observé : sous le principal, « Rechercher une référence » = « accès » propose « Contrôle d’accès », « Droits d’accès »…
  (`GET /api/grc/<principal>/sources?search=accès` → `legacy:items:A-5.15`…). Sous « Hébergement HDS » (héritage des
  référentiels coché), même recherche : liste vide, aucun message ; `GET /api/grc/<HDS>/sources?search=accès` →
  `{"items":[],"truncated":false}`. L’écart majeur HDS est enregistré sans référence. Les invariants ne le voient pas :
  INV-07 ne lit que les écarts projetés du périmètre principal.
- Attendu : les mesures et exigences des référentiels du sous-périmètre (hérités ou propres) proposées, ou un message
  qui dit pourquoi il n’y en a pas.
- Reproductible par : à écrire ; règle INV-07 à étendre aux écarts de tous les périmètres.

### C4-05 — Revue de direction : rien de préparé sous un sous-périmètre, et ses écarts absents des entrées du principal

- Gravité : majeur
- Écran : Revues de direction
- Référence : ISO/IEC 27001:2022, 9.3.2 c) (non-conformités et actions correctives)
- Observé : sous « Hébergement HDS », la page n’a ni bandeau « Préparer la prochaine revue » ni entrées 9.3.2 ; la fiche
  « Ajouter revue de direction » a les champs 9.3.2 vides (`PreparationRevue` renvoie `null` hors du périmètre racine).
  Sous le principal, l’entrée 9.3.2 c 4 indique « 3 constats enregistrés, 2 ouvert(s) » alors que le tableau de bord
  (« tous périmètres lisibles ») compte 3 écarts ouverts dont la non-conformité majeure HDS : la NC majeure du périmètre
  d’hébergement n’entre dans aucune revue préparée.
- Attendu : entrées préparées pour chaque périmètre, ou entrées du périmètre parent qui reprennent ses sous-périmètres
  (à arbitrer par le RSSI : bloquant si la revue du SMSI doit couvrir le périmètre HDS).
- Reproductible par : à écrire.

### C4-06 — Revue validée affichée « Brouillon » dans sa fiche ; libellés d’état divergents

- Gravité : mineur
- Écran : Revues de direction
- Référence : 7.5.3 (maîtrise des informations documentées), 9.3.3
- Observé : après « Valider » (liste : « Validé »), `cliquer button Ouvrir` → combobox « État : Brouillon » (seules options
  « Brouillon » et « À valider ») ; la liste dit « À préparer » pour l’état que la fiche nomme « Brouillon ». Une
  modification de « Décisions et moyens » après validation est acceptée et remet la revue « À préparer » (`data.status`
  `validated` → `draft`, versions 3 → 4) ; l’alerte « Une modification demande une nouvelle vérification. Les décisions
  précédentes restent conservées. » est bien affichée et l’historique garde la version validée.
- Attendu : l’état réel (« Validée ») affiché dans la fiche, un seul libellé par état ; l’immuabilité des décisions validées
  à confirmer par le RSSI (scénario, étape 11 : « décisions immuables »).
- Reproductible par : à écrire.

### C4-07 — Plan d’actions, vue « Planning / Gantt » : une action à cheval sur deux mois disparaît

- Gravité : mineur
- Écran : Plan d’actions
- Référence : ergonomie (planification des actions, 6.2, 10.2)
- Observé : action « Relire et faire approuver la politique… » du 13/11/2026 au 20/12/2026. `choisir "Vue synchronisée"
  "Planning / Gantt"`, mois 2026-11 → « 2026-11 — début et échéance réels » et « Aucune action dans cette période et ces
  filtres. » (capture `c4-gantt-vide.png`). La vue « Timeline » l’affiche sur la même période ; le Gantt ne la montre qu’en
  décembre. La fenêtre ne retient que les actions dont l’échéance tombe dans le mois.
- Attendu : toute action dont la période recoupe le mois affiché.
- Reproductible par : à écrire.

### C4-08 — Écart ou revue saisis par erreur : ni archivage ni annulation à l’écran

- Gravité : mineur
- Écrans : Amélioration continue, Revues de direction
- Référence : 7.5.3 ; cohérence des chiffres de la revue
- Observé : un écart de même intitulé qu’un écart existant est accepté sans avertissement (« 3 constats »). Sa fiche n’a que
  « Fermer » et « Enregistrer », le menu « Autres actions » que « Clôturer le constat », « Créer une action suivie »,
  « Décisions et réalisations » ; l’état n’a pas de valeur « Annulé » ; la clôture exige causes et efficacité. Les fiches
  d’action et de série ont « Archiver la fiche », et l’API propose `DELETE /api/grc/:smsi/objects/:id` (« Archiver sans
  supprimer les décisions »). Le doublon, laissé en place et renommé « Doublon saisi par erreur (test de suppression,
  fictif) », reste compté (tableau de bord, revue 9.3.2 c 4) et déclenche les alertes INV-06 et INV-07.
- Attendu : archivage motivé (ou état « Annulé ») d’un écart ou d’une revue saisis par erreur, tracé au journal.
- Reproductible par : à écrire.

### C4-09 — Tableau de bord : le même écart « Non classé » compté « Remarque » dans un bloc et « Non classé » dans l’autre

- Gravité : mineur
- Écran : Tableau de bord (repris des écarts de la tranche)
- Référence : cohérence des chiffres
- Observé : écart sans classification (doublon). « Écarts ouverts par type : NC majeure : 1, NC mineure : 1, Point sensible :
  0, Piste de progrès : 0, Remarque : 1 » ; même écran, « Écarts par classification : Non-conformité mineure 2, Non classé 1,
  Non-conformité majeure 1 ».
- Attendu : « Non classé » partout (un écart non classé n’est pas une remarque).
- Reproductible par : à écrire.

### C4-10 — « Mes rappels » : cartes sans intitulé ni date

- Gravité : mineur
- Écran : Mes rappels (les deux périmètres)
- Référence : ergonomie, accessibilité
- Observé : trois cartes identiques « Échéance SMSI — Une action vous est attribuée. Consultez sa fiche pour connaître son
  échéance et ses liens. », chacune avec des boutons « Ouvrir » et « Marquer comme lu » de même nom ; la première ouvre
  l’occurrence du 05/09/2026 déjà validée « OK ».
- Attendu : intitulé et échéance de l’action dans la carte et dans le nom des boutons ; rappel retiré quand l’occurrence est
  validée.
- Reproductible par : à écrire.

### C4-11 — Entrée de revue « Tous les indicateurs disposent d’une valeur mesurée » sans aucun indicateur

- Gravité : mineur
- Écran : Revues de direction (périmètre principal)
- Référence : ISO/IEC 27001:2022, 9.1 et 9.3.2 ; AGENTS.md (aucun taux inventé : « 0 » n’est pas « non évalué »)
- Observé : installation sans indicateur ; entrée « 9.3.2 c 5 Résultats de surveillance et de mesure » : « Tous les
  indicateurs disposent d’une valeur mesurée. », recopiée telle quelle dans la fiche préparée (`entree_c5`).
- Attendu : « Aucun indicateur enregistré. »
- Reproductible par : à écrire.

### C4-12 — Remarques de vocabulaire et d’ergonomie

- Gravité : remarque
- Observé :
  - « Vue synchronisée » propose « Timeline » (anglais) ;
  - registres par défaut du principal nommés « — Pilotage commun » alors que le périmètre a été renommé ; deux registres de
    même nom acceptés (« Plan d’actions — Hébergement HDS » donné à un registre du principal) ;
  - confirmation de suppression d’une action de plan : « Cette action disparaîtra aussi de l’outil historique. » ;
  - « Délai moyen de traitement : 0.0 jours » (point décimal) ; « 1 fiches », « 3 constats » ;
  - fiche de plan d’audit : bouton « Reporter dans la couverture du cycle (audit interne ) » avant enregistrement ;
    « Responsable » des plans en texte libre, pas un compte ;
  - fiche d’écart : deux champs « Audit à l’origine » (type) et « Audit d’origine » (fiche) ; l’écart reste « Ouvert »
    quand son unique action est terminée ;
  - action sans responsable acceptée ; « Rappel avant l’échéance » -5 ramené à 0 sans message ; « Terminée » proposée
    depuis « À faire » puis refus « Cette transition n’est pas autorisée par le workflow. » sans dire l’étape attendue ;
  - liste des séries sans périodicité ni état actif ou inactif ; l’écran « Tâches récurrentes » liste aussi les actions
    ordinaires ;
  - boutons de fermeture sans nom (fiche de plan, « Nouveau registre », « Confirmation »), en-têtes de tableau en cellules ;
  - « Créer une action suivie » (BUG-034) contraste avec « Générer une action de traitement » des Traitements, qui demande
    nom, échéance et plan d’accueil et annonce que le résiduel ne change pas : modèle à reprendre.

## Défauts connus reconfirmés / non reproduits (briques réelles : PostgreSQL 18, images Docker)

| Défaut | Résultat | Observé sur la pile 4 |
|---|---|---|
| BUG-021 | reconfirmé | « Revue de direction 2026 (fictive) » validée (liste « Validé ») ; bandeau « Dernière revue : Aucune », 9.3.2 a « Aucune revue de direction précédente enregistrée. », `GET /api/grc/<principal>/pilotage/revue/entrees` → `"precedente":null` |
| BUG-031 | constaté, non arbitré | bandeau « Revue de direction · ISO 9001:2015, 9.3.2 », entrées « Satisfaction du client », « Atteinte des objectifs qualité », « conformité des produits et services » ; 9.3.2 c 4 ne donne aucun état des actions correctives |
| BUG-032 | reconfirmé | « Valider » sans « Décisions et moyens » → « Complétez les informations et justificatifs avant validation. » (HTTP 422), sous les deux périmètres |
| BUG-034 | reconfirmé | « Créer une action suivie » : formulaire de décision (« Date de réalisation », « Travaux réalisés ») ; action créée « Action : <intitulé de l’écart> », `dueAt: null`, texte saisi non repris |
| BUG-035 | reconfirmé, précisé | Amélioration continue « 4 ouvertes · 1 closes · 3 en retard » ; tableau de bord « 0 sur 1 action ouverte » ; Synthèse « 1 actions ouvertes, 3 occurrences en retard ». Après validation « OK » d’une occurrence, Amélioration continue la compte encore ouverte (« 4 ouvertes · 2 en retard »), la Synthèse non (« 2 occurrence(s) ouverte(s) ») |
| BUG-029 | reconfirmé | boutons « start », « time », « timezone », « interval », « until », « count », « reminderDays », « active » ; champs « recurrence.start », « recurrence.active » |
| BUG-019 | reconfirmé (écran de l’agent 3) | DdA annexe A : lignes « A.5.1 … 070ed0d3-… » et « A.5.15 … b2b5200c-… » |
| BUG-023 | reconfirmé (écran de l’agent 2) | appréciation de R-01 : « Brut : Élevé · unacceptable », « Résiduel : Modéré · conditional », décision en JSON brut, « Méthode conservée : … · draft » |
| BUG-018 | reconfirmé (installation, agent 6) | « Toggle password visibility » sur les deux champs de mot de passe de l’étape 3 |

Non reproduit dans la tranche : aucun des défauts listés pour la tranche 4.

## Signalé aux autres tranches (non vérifié ici)

- Agent 5, `/exports` « Écarts et actions » : la feuille « Plan d’actions » est construite à partir des `tasks` des écarts
  projetés (`apps/api/src/export/rubriques.ts`), que la projection des écarts natifs ne remplit pas
  (`apps/api/src/historique/ecarts-natifs.ts`) ; la projection ne retient que le périmètre principal. Le fichier Excel n’a
  pas pu être relu ici : à vérifier qu’il contient les actions et l’écart HDS.
- Invariants : INV-06 et INV-07 ne portent que sur les écarts du périmètre principal (l’écart HDS sans référence n’est pas
  signalé).

## État de la pile 4 pour la phase 2

- Pile et Chrome laissés en marche (`https://127.0.0.14`, pilote sur le port 9337, dossier `.pilote-4`).
- Compte : `rssi` (Administrateur) seulement ; identifiant et secret TOTP dans `tests/e2e/rssi-virtuel/.pilote-4/comptes.json`
  (dossier ignoré par Git). Racine de l’autorité locale de la pile : `.pilote-4/ca.crt` (pour `NODE_EXTRA_CA_CERTS`).
- Données laissées en place : principal : 3 écarts (1 clos, 1 ouvert avec action, 1 doublon de test non archivable), 3
  actions hors séries (1 close, 1 ouverte, 1 de traitement close), série mensuelle avec 3 occurrences (1 validée OK), revue
  2026 validée, méthode ISO 27005 publiée, risque R-01 apprécié, traitement ; plans : PL-FOR-001, PL-FOR-002, PL-AUD-001,
  PL-SEN-001 (communs aux deux périmètres, C4-02) ; HDS : 1 écart majeur, 2 actions (dont 1 dans le registre partagé
  « Plan de mise en conformité HDS 2027 (fictif) »), série trimestrielle, revue en préparation ; registres renommés
  « Plan d’actions — SMSI Groupement Santé Fictif » et « Plan de mise en conformité HDS 2027 (fictif) ».
