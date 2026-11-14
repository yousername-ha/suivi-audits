# Campagne de recette, phase 1 : agent 1 (organisation, contexte, objectifs, fournisseurs)

| Élément | Valeur |
| --- | --- |
| Commit testé | `2e63e86` au démarrage, `e359b05` à la fin (commits intermédiaires de documentation de recette seulement, aucun changement dans `apps/` ni `packages/`) |
| Date | 12/11/2026, 20:58 à 21:45 (Europe/Paris) |
| Pile | `https://127.0.0.11` (pile Docker n° 1 de `lancer.sh`, PostgreSQL 18, Node 26, images de la branche) ; `/api/version` : `local`, dernière migration `054_retrait_revues_acces.sql` |
| Pilote | `PILOTE_PORT=9334`, `PILOTE_DOSSIER=.pilote-1` ; navigateur sans fuseau réglé (UTC) : les heures affichées ne sont pas jugées |
| Données | jeu fictif `organisation-fictive.json` ; aucun secret recopié ici |
| Règle | aucune modification de l’application ni des tests ; constats seulement |

Premier contact : `GET /api/setup` → `{"needed":true,"pending":true,"adminExists":false,…}` (pile vierge). Installation par
l’écran (poivre, clé de secours, jeton, compte `rssi`, TOTP ; l’étape « clé de sécurité » n’est pas proposée sur une adresse IP).

Outillage : `pilote.mjs api` échouait (« unable to get local issuer certificate ») car le processus Node ne connaît pas
l’autorité locale de Caddy. Contournement sans désactiver la vérification TLS : `NODE_EXTRA_CA_CERTS` pointant vers la
racine publique de la pile (`/srv/suivi-rssi-virtuel-1/donnees/caddy/…/root.crt`). Les fichiers Excel ont été téléchargés
avec la session du navigateur par un petit script du bloc-notes (le pilote ne sait pas récupérer un téléchargement).
`pilote.mjs api` n’envoie pas d’en-tête `If-Match` : impossible de supprimer un objet de test par l’API.

## Écrans couverts

Les 19 écrans de la tranche, sous « SMSI Groupement Santé Fictif » (principal) puis « Hébergement HDS » (sous-périmètre,
hérite des référentiels), en vide, rempli et erreur. Bilan du CSV : **114 cases : 49 ok, 49 défaut, 16 sans objet,
0 non testée**.

Types d’objets : `context`, `stakeholder`, `swot`, `governance`, `process`, `objective`, `indicator`, `journey` créés et
modifiés sous les deux périmètres ; liens bidirectionnels vérifiés (partie intéressée → contexte, indicateur « Démontre »
objectif) ; suppression possible seulement pour les processus, objectifs et indicateurs du principal (C1-03) ; export
seulement par « Exports Excel » (C1-04). Fournisseurs, certificats, contrôles, critères, évaluations natives et par le
clausier, rattachements aux périmètres : créés, modifiés, retirés ou supprimés.

Isolement des périmètres : **conforme** sur Contexte, Parties intéressées, SWOT, Rôles, Objectifs, Indicateurs,
Parcours et Fournisseurs du périmètre (rien du sous-périmètre sous le principal, rien du principal sous le
sous-périmètre). Le principal ne voit pas non plus les fiches de ses enfants (aucune vue consolidée). Héritage des
référentiels ISO/IEC 27001 et HDS v2 du principal vers « Hébergement HDS » affiché et désactivable.

Compteurs : Synthèse du principal (1/2 indicateurs atteints, 1 écart ouvert) = Objectifs et indicateurs = tableau de
bord ; Parcours ISO faux au principal (C1-06) ; carte de contexte et bandeau des parties intéressées à 0 (BUG-020).

## Cases sans objet et pourquoi

- Synthèse, tableau de bord (`/`) : état « erreur » sans objet (écrans de lecture sans saisie) ; tableau de bord sans
  sélecteur de périmètre (« tous périmètres lisibles ») : ses cases sous-périmètre sont sans objet.
- Fournisseurs de l’organisation, Critères, Évaluations par le clausier : registres de l’organisation, indépendants du
  périmètre (bandeau de l’écran) : état « vide » du sous-périmètre sans objet ; le contenu identique sous les deux
  périmètres a été vérifié.
- Fournisseurs du périmètre : écran de lecture (le rattachement se gère ailleurs) : « erreur » sans objet.
- PESTEL : aucune saisie hors classement d’un enjeu externe, et aucun enjeu externe n’est proposé (C1-05).
- Cartographie : carte unique de l’organisation, sans sélecteur de périmètre (C1-18) ; la création d’objets par
  glisser-déposer n’est pas pilotable par le pilote (un clic sur la carte sélectionne une zone).

Non vérifiés : contenu des fichiers PNG, PDF et SVG de la cartographie (téléchargement non récupéré) ; entrée « parties
intéressées » de la revue de direction (écran de l’agent 4).

## Constats

| Constat | Gravité | Titre |
| --- | --- | --- |
| C1-01 | mineur | Erreur de fuseau désignée par la clé technique « timezone » |
| C1-02 | mineur | Périmètre en doublon accepté, et aucun périmètre ne peut être supprimé |
| C1-03 | majeur | Contexte, parties, SWOT, rôles, parcours et objets du sous-périmètre : ni archivage ni export depuis l’écran |
| C1-04 | bloquant | Export Excel « Contexte du SMSI » vide malgré les fiches saisies |
| C1-05 | majeur | PESTEL, cartographie et processus ignorent les SWOT et enjeux saisis à l’écran |
| C1-06 | mineur | Parcours ISO du principal : objectifs, indicateurs et fiche de périmètre non comptés |
| C1-07 | majeur | Évaluation d’un fournisseur : la page plante en cochant un critère |
| C1-08 | mineur | Valeur d’indicateur non numérique acceptée (principal) ou effacée sans message (sous-périmètre) |
| C1-09 | mineur | Fiches du Pilotage : champ obligatoire non signalé, doublons et coordonnées invalides acceptés |
| C1-10 | majeur | Objectifs et indicateurs : deux modèles selon le périmètre, sous-périmètre absent des synthèses |
| C1-11 | mineur | Synthèse : « Référentiels activés » vide sans message malgré deux référentiels appliqués |
| C1-12 | bloquant | Écart créé par le clausier sans responsable, sans échéance, absent de la DdA (INV-08 en échec) |
| C1-13 | mineur | Pourcentages calculés sur un ensemble vide (« 0 % SaaS avec MFA (0/0) ») |
| C1-14 | mineur | Export Fournisseurs sans les évaluations natives ni les périmètres de rattachement |
| C1-15 | remarque | Vocabulaire : renvois à l’ISO 9001 dans un SMSI ISO/IEC 27001, libellés techniques |
| C1-16 | remarque | Accessibilité : boutons sans nom, en-têtes de tableau non déclarés, libellés répétés |
| C1-17 | remarque | Tableau de bord : « 2027 — Surveillance 2 » tiré d’un cycle par défaut jamais saisi |
| C1-18 | remarque | Cartographie sans sélecteur de périmètre |
| C1-19 | mineur | Évaluation par le clausier datée de 2030 et sans évaluateur acceptée |
| C1-20 | mineur | « Ajouter un objectif » crée une fiche « Nouvel objectif » qui subsiste sans enregistrement |

Décompte par gravité : bloquant 2 (C1-04, C1-12) ; majeur 4 (C1-03, C1-05, C1-07, C1-10) ; mineur 10 (C1-01, 02, 06,
08, 09, 11, 13, 14, 19, 20) ; remarque 4 (C1-15 à C1-18).

### C1-01 — Erreur de fuseau désignée par la clé technique « timezone »
- Gravité : mineur
- Écran : Périmètres (principal, erreur)
- Référence : AGENTS.md (interface en français) ; ergonomie
- Observé : `cliquer button "Modifier le périmètre Pilotage de l’organisation"`, `remplir "Fuseau horaire" "Mars/Olympus"`,
  `cliquer button "Enregistrer"` → `alert "Erreur": "Erreur Données invalides — timezone : Fuseau inconnu."`, HTTP 422
  sur `PATCH /api/grc/smsis/…`. Nom vide : bouton « Enregistrer » grisé sans message, « Nom » non marqué obligatoire.
- Attendu : « Fuseau horaire : fuseau inconnu (ex. Europe/Paris) », champ désigné par son libellé.
- Reproductible par : à écrire.

### C1-02 — Périmètre en doublon accepté, et aucun périmètre ne peut être supprimé
- Gravité : mineur
- Écran : Périmètres (sous-périmètre, erreur)
- Référence : ISO/IEC 27001:2022, 4.3 (domaine d’application) ; 7.5.3
- Observé : deuxième `Ajouter un périmètre enfant à SMSI Groupement Santé Fictif` nommé « Hébergement HDS » → créé sans
  alerte ; `GET /api/grc/smsis` renvoie deux « Hébergement HDS » de même parent. Aucun bouton de suppression ou
  d’archivage (ni graphe, ni liste, ni fiche), aucune route `DELETE` des périmètres. Le doublon apparaît ensuite dans le
  sélecteur « Périmètre affiché » (liste plate, sans hiérarchie) et dans les rattachements des fournisseurs. Il a été
  renommé « Doublon de test (fictif, à ignorer) » faute de mieux. La création d’un cycle (racine rattachée à son enfant)
  est bien empêchée (liste « Rattaché à » vide).
- Attendu : doublon signalé ou refusé ; archivage d’un périmètre vide créé par erreur.
- Reproductible par : à écrire.

### C1-03 — Ni archivage ni export depuis les registres du contexte
- Gravité : majeur
- Écrans : Périmètre et contexte, Parties intéressées, SWOT, Rôles, Parcours par démarche ; Objectifs par processus,
  Objectifs et Indicateurs du sous-périmètre
- Référence : ISO/IEC 27001:2022, 7.5.3 (maîtrise des informations documentées) ; types de la tranche
- Observé : menu `Autres actions pour Équipe d'exploitation (fictive)` → seul `menuitem "Décisions et réalisations"` ;
  la fiche n’a que « Fermer » et « Enregistrer ». Le doublon de rôle « Direction du groupement » créé pour le test n’a pu
  être que renommé (« Doublon de test… aucune suppression possible »). L’API exige `If-Match` (HTTP 428 via le pilote).
  Cause probable : `apps/web/src/pilotage/Registry.tsx` (`BusinessRegistry`) n’expose pas l’archivage que propose
  `ObjectEditor.tsx` (« Archiver la fiche »). Au principal, processus, objectifs et indicateurs (registre historique) ont
  bien « Supprimer le processus » et « Supprimer l’objectif » (vérifié sur un processus et un objectif de test).
  Aucun bouton d’export sur ces écrans ; seul « Exports Excel » couvre le contexte (C1-04).
- Attendu : archivage tracé d’une fiche créée par erreur ; export depuis la rubrique ou export complet fidèle.
- Reproductible par : à écrire (présence d’une action d’archivage dans le menu d’une fiche).

### C1-04 — Export Excel « Contexte du SMSI » vide malgré les fiches saisies
- Gravité : bloquant (donnée fausse remise à un auditeur)
- Écrans : Périmètre et contexte, Parties intéressées, SWOT, Rôles (rempli) ; Exports Excel
- Référence : ISO/IEC 27001:2022, 4.1 à 4.3, 5.3, 7.5 ; même famille que BUG-020 (registre historique)
- Observé : après saisie de la fiche de périmètre (complétée), 2 parties intéressées, 1 SWOT et 5 rôles au principal,
  `GET /api/suivi/export?groupe=ctx&mode=std` (bouton « Excel classique : Contexte du SMSI ») → classeur de 4 feuilles :
  « Périmètre du SMSI » (lignes Version, Validé le, Validé par, Énoncé, Sites, Processus inclus **toutes vides**),
  « Parties intéressées », « Analyses SWOT », « Rôles et responsabilités » : **en-têtes seuls**.
  `GET /api/suivi/etat` : `interested`, `swots`, `roles` vides ; `scope` contient `text`, `org`, `issues`, `exclusions`,
  `interfaces`, `desc`, alors que l’export lit `statement`, `sites`, `processes`, `excl`
  (`apps/api/src/export/rubriques.ts`, jeux `perimetre`, `parties`, `swot`, `roles`). Les fiches des écrans sont des
  objets `stakeholder`, `swot`, `governance` (`GET /api/grc/<principal>/objects?kind=governance` → 5). L’export n’a pas
  de paramètre de périmètre : rien du sous-périmètre n’est exportable.
  Contrôle : l’export « Objectifs et indicateurs » est juste (OBJ1, OBJ2, IND1, IND2, PR1 du principal).
- Attendu : l’export reprend les fiches affichées, par périmètre.
- Reproductible par : à écrire (comparer les lignes des feuilles au nombre de fiches de chaque rubrique).

### C1-05 — PESTEL, cartographie et processus ignorent les SWOT et enjeux saisis à l’écran
- Gravité : majeur
- Écrans : PESTEL (rempli, deux périmètres), SWOT, Processus, cartographie
- Référence : ISO/IEC 27001:2022, 4.1 (enjeux externes et internes)
- Observé : SWOT « SWOT du processus Hébergement (fictif) » créé (forces, faiblesses, opportunités, menaces) et fiche de
  contexte avec « Enjeux internes et externes » renseignés. `ouvrir /pilotage/pestel` : tous les facteurs à 0,
  « Enjeux externes non classés (0) », seul l’enjeu saisi dans l’objectif OBJ1 apparaît (« Enjeux internes, hors PESTEL
  (1) »). Cartographie, « Générer depuis la plateforme » : « Enjeux externes (0) ». Fiche du processus PR1 :
  `combobox "Rattacher : SWOT" [disabled]` alors qu’un SWOT existe. Cause lue : `apps/api/src/pilotage/pestel.ts` et
  `packages/shared/src/carto/objects.ts` lisent les SWOT historiques rattachés à un processus historique
  (`swotLatest`), pas les objets `swot`. Le SWOT du sous-périmètre n’est repris nulle part.
- Attendu : les enjeux des SWOT et du contexte saisis à l’écran alimentent le PESTEL, la carte et la fiche processus.
- Reproductible par : à écrire.

### C1-06 — Parcours ISO du principal : objectifs, indicateurs et fiche de périmètre non comptés
- Gravité : mineur (même famille que BUG-036)
- Écran : Parcours ISO 27001 / HDS (principal, rempli et erreur)
- Référence : ISO/IEC 27001:2022, 6.2 et 9.1 ; traçabilité
- Observé : principal avec OBJ1, OBJ2 et deux indicateurs mesurés : « Fixer les objectifs — Aucun travail trouvé »,
  « Mesurer les résultats — Aucun travail trouvé » ; sous-action « Préparer les objectifs » : « Objectif : aucun
  élément » ; « Associer une fiche » + recherche « Revue » → « Aucun élément trouvé ». La fiche « Périmètre de
  l’organisation » complétée n’est pas comptée (« Périmètre et contexte : 1 élément », seulement la 2e fiche). Sous
  « Hébergement HDS », les mêmes rubriques passent bien à « Travaux présents ».
- Attendu : le parcours compte les objectifs et indicateurs du principal (registre historique compris).
- Reproductible par : à écrire.

### C1-07 — Évaluation d’un fournisseur : la page plante en cochant un critère
- Gravité : majeur (saisie perdue, page inutilisable jusqu’au rechargement)
- Écran : Fournisseurs de l’organisation (rempli)
- Référence : ISO/IEC 27001:2022, A.5.19 à A.5.22 ; règle « aucune erreur JavaScript »
- Observé : `cliquer button "Évaluer le fournisseur Infogérant fictif"`, puis clic sur la case d’un critère :
  `heading "Une erreur est survenue"`, `paragraph: Cannot read properties of null (reading 'checked')`, console
  `TypeError: Cannot read properties of null (reading 'checked')`. Reproduit deux fois sur quatre clics (cocher, décocher,
  recocher la case ; le clic sur le libellé passe en général). Cause probable : `apps/web/src/pilotage/Fournisseurs.tsx`
  (l. 773) lit `e.currentTarget.checked` dans la fonction passée à `setChoix`, exécutée après le gestionnaire.
- Attendu : la case se coche, sans erreur.
- Reproductible par : à écrire (cocher, décocher, recocher un critère dans « Évaluer »).

### C1-08 — Valeur d’indicateur non numérique
- Gravité : mineur
- Écrans : Objectifs par processus, Indicateurs (erreur)
- Référence : ISO/IEC 27001:2022, 9.1 (résultats valides)
- Observé : principal, IND1, `remplir "Valeur" "abc"`, « Ajouter la mesure » → ligne « 2026-11-12 abc », indicateur
  compté « Non atteint » (« 1 non atteints »). Sous-périmètre, « Valeur mesurée » « abc » → enregistré sans message,
  `value: null` dans `GET /api/grc/<HDS>/objects?kind=indicator`.
- Attendu : valeur refusée avec un message sur le champ « Valeur ».
- Reproductible par : à écrire.

### C1-09 — Champ obligatoire non signalé, doublons et coordonnées invalides acceptés
- Gravité : mineur
- Écrans : Contexte, Parties, SWOT, Rôles, Processus, Objectifs (sous-périmètre), Parcours (erreur)
- Référence : ergonomie ; grille de l’agent (le message désigne le champ)
- Observé : intitulé vide → `button "Enregistrer" [disabled]`, sans message ni marque d’obligation (vérifié sur six
  écrans sous « Hébergement HDS »). Rôles : « Adresse de contact » « pas-une-adresse » et « Téléphone » « abc »
  acceptés ; second « Direction du groupement » accepté (non supprimable, C1-03). Processus : second « Hébergement et
  infogérance » accepté (PR2, supprimé ensuite). Les écrans Fournisseurs et Critères refusent, eux, les doublons avec un
  message clair.
- Attendu : champs obligatoires marqués, message sur le champ, doublon signalé.
- Reproductible par : à écrire.

### C1-10 — Objectifs et indicateurs : deux modèles selon le périmètre
- Gravité : majeur (même cause que BUG-037, étendue aux objectifs et indicateurs)
- Écrans : Synthèse, Objectifs, Indicateurs, Objectifs par processus (sous-périmètre, rempli)
- Référence : ISO/IEC 27001:2022, 6.2 et 9.1
- Observé : au principal, « Ajouter un objectif » ouvre « Objectif OBJ1 » (processus associés, enjeux, indicateurs) et
  les indicateurs ont un historique de mesures mais aucune unité (BUG-028). Sous « Hébergement HDS », les mêmes
  menus ouvrent un registre générique : objectif « Résultat attendu » sans processus ni indicateur, indicateur avec
  « Unité » mais sans objectif ni historique. La Synthèse du sous-périmètre n’a **aucune** carte « Objectifs et
  indicateurs » (ni écarts, ni conformité) alors qu’un objectif et un indicateur y sont saisis. Le principal ne voit pas
  les objectifs de ses sous-périmètres.
- Attendu : un seul modèle d’objectif et d’indicateur pour tous les périmètres, repris dans la Synthèse.
- Reproductible par : à écrire.

### C1-11 — Synthèse : « Référentiels activés » vide sans message
- Gravité : mineur
- Écran : Synthèse (deux périmètres)
- Observé : ISO/IEC 27001:2022 et HDS v2 attribués et appliqués au principal (« Appliqué : suivi en conformité »),
  hérités par le sous-périmètre. Tableau « Référentiels activés et correspondances revues » : en-têtes seuls, aucune
  ligne, aucun message ; `GET /api/grc/<principal>/dashboard` → `"frameworks":[]` (la requête lit
  `grc_framework_versions`, que l’application d’une copie ne semble pas alimenter : à confirmer par l’agent 3).
- Attendu : les référentiels appliqués listés, ou un message expliquant pourquoi aucun ne l’est.
- Reproductible par : à écrire.

### C1-12 — Écart créé par le clausier sans responsable, sans échéance, absent de la DdA
- Gravité : bloquant (invariant INV-08 en échec)
- Écran : Évaluations par le clausier (rempli)
- Référence : ISO/IEC 27001:2022, 10.2 ; A.5.19 à A.5.22 ; invariants INV-06 et INV-08
- Observé : point O-1.2 « Non conforme », `cliquer button "Créer les actions pour les écarts"` → « Action FOU-01 créée
  avec 1 point(s) à traiter. » L’élément apparaît dans « Amélioration continue » comme écart (« Piste de progrès »,
  « Non attribué », sans échéance), au tableau de bord et dans la Synthèse (1 écart ouvert), mais pas dans « Plan
  d’actions » (« Aucune action dans cette période et ces filtres »). `pilote.mjs invariants` : `ALERTE INV-06 … sans
  responsable ni échéance` ; `ÉCHEC INV-08 … « Évaluation sécurité Infogérant fictif : 1 point(s) à traiter » absent de
  la DdA`.
- Attendu : action (ou écart) avec responsable et échéance proposés, rattachée à une mesure (A.5.20 ou A.5.22), visible
  dans le plan d’actions.
- Reproductible par : invariant INV-08 (existant).

### C1-13 — Pourcentages sur un ensemble vide
- Gravité : mineur
- Écran : Fournisseurs de l’organisation (vide)
- Référence : grille (« 0 % » n’est pas « non évalué »)
- Observé : `paragraph: 0 %` / `SaaS avec MFA (0/0)`, idem SSO, sans aucun fournisseur SaaS.
- Attendu : « — » ou « aucun service SaaS ».
- Reproductible par : à écrire.

### C1-14 — Export Fournisseurs incomplet
- Gravité : mineur
- Observé : `GET /api/suivi/export?groupe=sup` : feuilles fournisseurs, certificats, contrôles (justes, contrôle en
  retard compris) et évaluations par le clausier ; l’évaluation native (« 1 répond · 1 ne répond pas », prochaine
  réévaluation 2027-11-12) et les périmètres de rattachement n’y figurent pas.
- Attendu : évaluation courante et rattachements exportés.
- Reproductible par : à écrire.

### C1-15 — Vocabulaire
- Gravité : remarque
- Observé : PESTEL (« n’est pas exigé par la norme ISO 9001:2015 »), objectif (« ISO 9001:2015, 6.2.2 »), indicateur
  (« ISO 9001:2015, 9.1.1 »), critères (« ISO 9001:2015, 8.4.1 »), fiche processus (« ISO 9001, 4.4.1 ») dans un SMSI
  ISO/IEC 27001 ; carte « Certification ISO 27001 / HDS / ISO 9001 » sans ISO 9001 déclarée ; copies nommées
  « (PRIVE - SMSI …) » ; bouton « Ajouter analyse swot » ; dates ISO « Le 2026-11-12 », « Réévaluation 2027-11-12 » ;
  « Fiche de Infogérant fictif » ; « 1 fiches », « 1 étapes », « 1 ouverts » ; texte d’en-tête générique « Qualité,
  sécurité et référentiels : pilotez vos travaux… » sur chaque écran ; description par défaut du périmètre racine
  « Données historiques et nouvelles relations communes ».
- Attendu : références ISO/IEC 27001 (4.1, 6.2, 9.1, A.5.19) quand le périmètre porte ce référentiel.

### C1-16 — Accessibilité
- Gravité : remarque
- Observé : bouton de fermeture sans nom (`button: - img`) dans « Modifier le périmètre », « Créer un périmètre »,
  « Référentiels du périmètre », « Nouveau processus », « Objectif OBJ1 », « Définir un critère », « Évaluer … » ;
  en-têtes des tableaux du Pilotage en `cell` (pas `columnheader`) ; fiche fournisseur : libellés « Contrôle »,
  « Résultat », « Dernier contrôle » répétés à l’identique pour chaque contrôle ; bouton « Organisation et objectifs »
  qui ouvre en fait la fiche du parcours ; « Usages » (liste multiple) inatteignable au clic par le pilote, atteint au
  clavier.

### C1-17 — Tableau de bord : cycle par défaut affiché comme réel
- Gravité : remarque (écran du cycle : agent 6)
- Observé : installation neuve, `/` : « Prochain audit — » puis « 2027 — Surveillance 2 » ; `GET /api/settings`
  section `cycle` : `years [2025,2026,2027]`, « Certification initiale » 2025, alors que le jeu fictif certifie en
  2026-03 et que rien n’a été saisi.
- Attendu : « cycle non renseigné » tant que le RSSI n’a pas saisi ses dates.

### C1-18 — Cartographie sans sélecteur de périmètre
- Gravité : remarque
- Observé : `/cartographie` et `/cartographie/processus` n’ont pas de « Périmètre affiché » ; la génération ne propose
  que le processus du principal (« Processus (1) »).

### C1-19 — Évaluation par le clausier datée de 2030 et sans évaluateur
- Gravité : mineur
- Observé : sous-périmètre, « Nouvelle évaluation », fournisseur « Opérateur réseau fictif », « Date » 2030-01-01,
  « Évaluateur » vide → ligne « 01/01/2030 – – » acceptée (évaluation de test supprimée ensuite, confirmation demandée).
- Attendu : date future refusée ou signalée, évaluateur exigé.

### C1-20 — « Ajouter un objectif » crée une fiche fantôme
- Gravité : mineur
- Observé : principal, `cliquer button "Ajouter un objectif"`, intitulé vidé, `Fermer` → « OBJ3 Nouvel objectif,
  Échéance – · responsable à définir » reste dans la liste (supprimé ensuite par « Supprimer l’objectif »).
- Attendu : rien n’est créé sans « Enregistrer ».

## Défauts connus reconfirmés / non reproduits

Reconfirmés sur les briques réelles (PostgreSQL 18, Node 26, pile Docker) :

- **BUG-020** : bandeau « Parties intéressées » à 0 avec 2 fiches au principal ; s’étend à la cartographie (« Parties
  intéressées (0) » dans la génération et dans les chiffres clés). Entrée de revue de direction non vérifiée (agent 4).
- **BUG-028** : IND2, cible « 1 » → « ≥ 100 % », valeur « 1 » → « 100 % », sans unité (au principal seulement ; le
  formulaire du sous-périmètre a un champ « Unité », voir C1-10).
- **BUG-037** : formulaire « Nouveau processus » sans périmètre ; page « Processus » blanche sous « Hébergement HDS »
  (seuls titre et sélecteur) ; processus du sous-périmètre créé par « Objectifs par processus » avec un champ
  « Périmètre » texte libre, absent de la page Processus et de la cartographie.
- **BUG-017** (partie tableau de bord) : « Taux de conformité global 0 % » et « 0 % » par référentiel sur une
  installation neuve où les 157 mesures sont « Non renseigné ».
- **BUG-018** (hors tranche, vu à l’installation) : « Toggle password visibility » sur « Mot de passe » et
  « Confirmation ».

Non reproduit : aucun des défauts connus de la tranche n’a disparu.

## Signalements pour d’autres tranches

- Agent 4 : l’écart FOU-01 créé par le clausier est dans « Amélioration continue » mais absent du « Plan d’actions »
  (C1-12).
- Agent 3 : `dashboard.frameworks` vide après application d’une copie de référentiel (C1-11) ; `GET /api/settings`
  section `referentiels` : `activeFw: "recyf-2.5"` sur une installation neuve.
- Agent 6 : cycle par défaut (C1-17).

## État de la pile pour la phase 2

Pile 1 laissée en marche, Chrome du pilote 1 ouvert. Seul compte : `rssi` (administrateur ; secret TOTP dans
`tests/e2e/rssi-virtuel/.pilote-1/comptes.json`). Données laissées : périmètre principal « SMSI Groupement Santé
Fictif » (ISO/IEC 27001 et HDS appliqués), sous-périmètre « Hébergement HDS » (héritage), périmètre « Doublon de test
(fictif, à ignorer) » ; contexte (2 + 1), parties intéressées (2 + 1), SWOT (1 + 1), rôles (5 dont un doublon renommé +
1), processus PR1 + processus HDS, objectifs OBJ1, OBJ2 + 1, indicateurs IND1, IND2 + 1, parcours (1 + 1), carte de
contexte enregistrée, fournisseurs « Infogérant fictif » (rattaché à HDS, évalué, certificat HDS, 4 contrôles) et
« Opérateur réseau fictif » (rattaché au principal), 2 critères actifs + 1 retiré, 1 évaluation par le clausier et
l’écart FOU-01 qui en découle.
