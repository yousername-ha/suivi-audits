# Constats de l’agent 3 : conformité, DdA, audits, preuves et contrôles

| Élément | Valeur |
|---|---|
| Commit testé | `9ea074b` (branche `claude/recette-rssi-2026-11-12`, version du dépôt 6.3.0). La pile a été construite quand la branche était à `2e63e86` ; les commits suivants ne touchent que `docs/` (aucune différence dans `apps/` ni `packages/`) |
| Date | 12/11/2026, 20:58 à 21:55 (Europe/Paris) |
| Pile | `https://127.0.0.13`, pile Docker éphémère n° 3, vierge au premier contact (`GET /api/setup` : `needed:true`, `adminExists:false`) |
| Versions | `GET /api/admin/info` : Node `v26.12.1`, PostgreSQL `18.6` ; `GET /api/version` : `local`, dernière migration `054_retrait_revues_acces.sql` |
| Compte | `rssi` (Administrateur), créé à l’installation ; aucun autre compte créé |
| Périmètres | principal « SMSI Groupement Santé Fictif » (racine renommée), sous-périmètre « Hébergement HDS » (rattaché, « Hériter des référentiels du parent » coché) |
| Données | jeu fictif uniquement (`organisation-fictive.json`) ; deux fichiers texte fictifs déposés comme documents |
| Matrice | tranche 3 : 126 cases, **64 ok, 61 défaut, 1 sans objet, 0 non testée** (`matrice.mjs bilan`) |

Outillage : `pilote.mjs api` échouait sur le certificat de l’autorité locale de Caddy (« unable to get local issuer
certificate ») ; la racine publique de cette autorité, lue dans le dossier de la pile, a été donnée à Node par
`NODE_EXTRA_CA_CERTS` (vérification TLS conservée). La limite de l’arbre a été relevée (`PILOTE_LIMITE`) pour lire les
tableaux de 93 et 157 lignes. Le pilote clique le premier élément d’un nom donné : les doublons de nom (boutons « Retirer »,
« Oui » / « Non » du GAP, « Prête ») ont été atteints au clavier. Aucune erreur JavaScript, CSP ni HTTP 5xx relevée ; les
seules réponses en erreur sont des 422 décrits ci-dessous. L’API n’a servi qu’à contrôler les écrans et à rétablir trois
mesures modifiées pour un test d’erreur (A-5.2, A-6.7, HDS-30 remises « non examinées »).

## Écrans couverts

Les 21 écrans de la tranche, sous le périmètre principal puis sous « Hébergement HDS », états vide, rempli, erreur.

| Écran | Principal (rempli) | Sous-périmètre HDS (rempli) |
|---|---|---|
| Carte du prochain audit, Couverture du cycle | cycle 2026-2029 de l’organisation saisi, A.8.13 auditée en interne 2026 | mêmes données (C3-01) |
| Organisation : déroulé, planning, participants | jour 1 daté, créneau A.8.13 avec participant, personne de test retirée | mêmes données (C3-01) |
| Référentiels et exigences | référentiel fictif « Exigences contractuelles des clients hébergés » publié | rien de listé (C3-03) |
| Bibliothèque | ISO/IEC 27001:2022 et HDS v2 ajoutés, attribués et appliqués au principal | bibliothèque commune |
| Clauses ISO, Annexe A, HDS (DdA) | DdA du jeu fictif (6 mesures annexe A), 4.3 et 6.1.2, HDS 01 | mêmes données (C3-01) |
| Applicabilité et justifications | fiches du socle (157) | fiche A-8.30 non applicable justifiée |
| Mesures | 2 mesures liées (« Met en œuvre » A-8.13 et A-5.24) + 1 mesure de test | 2 mesures (A-7.4, A-5.24) |
| Correspondances entre exigences | impossible avec ISO / HDS (C3-03) | idem |
| Correspondances de la bibliothèque | A-5.24 → HDS-11 partielle, validée | commune |
| Rapprochements à valider | rapprochement HDS-11 confirmé | rapprochement HDS-11 laissé « à valider » |
| Couverture par référentiel | A-5.1 testée, A-8.30 exclue justifiée | A-7.4 partielle |
| Analyser un service | service « Messagerie sécurisée de santé régionale » + doublon renommé | service « Sauvegarde externalisée » |
| Applications à intégrer | GAP guidé « Plateforme de téléexpertise (fictive) » | mêmes données (C3-01) |
| Registre des preuves | rapport de restauration examiné « Validé », export | preuve « Registre des accès » |
| Plan de contrôle | test mensuel de restauration réalisé (Réussi) | revue trimestrielle « Non réussi » |
| Audits internes | audit combiné ISO + HDS 2026, programme PL-AUD-001, écart d’origine relié | audit HDS 2027 |

Types d’objets : `framework` créé (publication), modifié (non), lié (non), supprimé (non : seul « Désactiver » existe) ;
`requirement` créé avec le référentiel, lié depuis les mesures, preuves, contrôles et écarts ; `measure` créé, modifié, lié,
**ni supprimé ni exporté** (C3-13) ; `mapping` (objet du Pilotage) **impossible à créer** avec ISO / HDS (C3-03), la
correspondance de bibliothèque l’a été ; `soa` créé, modifié, lié, ni supprimé ni exporté (C3-13) ; `control` créé, modifié,
réalisé, lié, exporté, non supprimable à l’écran ; `evidence` créée, examinée, liée, exportée, non supprimable à l’écran ;
`audit` créé, lié à un écart, ni exporté ni supprimé (C3-13). Supprimés : une personne du plan d’audit et une application
de GAP créées pour le test. Non supprimables : la mesure « Mesure créée pour tester l’archivage (fictive) » et le périmètre
« Doublon de test (agent 3) - à ignorer ».

## Cases non couvertes

Aucune case non testée. Une case sans objet : `rapprochements|principal|erreur` (plus aucun rapprochement en attente sous
le principal après confirmation ; la règle du motif de rejet a été vérifiée sous le sous-périmètre).

## Synthèse

| Gravité | Nombre | Constats |
|---|---|---|
| Bloquant | 0 | |
| Majeur | 6 | C3-01 à C3-06 |
| Mineur | 8 | C3-07 à C3-13, C3-15 |
| Remarque | 1 | C3-14 |

## Constats

### C3-01 — Le sélecteur « Périmètre affiché » est sans effet sur la DdA, la gestion de l’audit et les applications à intégrer

- Gravité : majeur
- Écrans : Clauses ISO 27001, Annexe A, HDS (DdA) ; Carte du prochain audit ; Couverture du cycle ; Organisation : déroulé,
  planning, participants ; Applications à intégrer
- Référence : ISO/IEC 27001:2022, 6.1.3 d) (DdA du SMSI considéré) et 9.2.2 ; HDS v2 (DdA et périmètre des activités
  d’hébergement)
- Observé : `pilote.mjs ouvrir /pilotage/dda-annexe-a`, `choisir "Périmètre affiché" "Hébergement HDS"` : bandeau « 3 % »,
  lignes `row "A.5.1 Politiques de sécurité de l'information Oui Total"` et `row "A.8.30 … Non Exclue Aucun développement
  externalisé dans le périmètre (décision de la revue de direction fictive)"`, identiques au principal. `choisir
  "Applicabilité de A.6.7" "Oui"` sous « Hébergement HDS », puis `choisir "Périmètre affiché" "SMSI Groupement Santé
  Fictif"` : `row "A.6.7 Travail à distance Oui"`. L’API de la DdA n’a pas de périmètre (`GET /api/dda?reference=A`,
  `PATCH /api/dda/:id`) ; le journal d’audit trace `dda.updated` sur `legacy:dda:A-6.7` sans périmètre. Même constat pour
  le plan d’audit (`/api/audit-suivi/plan/…`) : sous « Hébergement HDS », participant « Pilote du processus infrastructure
  (fictif) » et créneau « 11h00 12h00 … A.8.13 » du principal ; pour la couverture du cycle (A.8.13 « interne 2026 :
  auditée ») ; pour les applications à intégrer (« Plateforme de téléexpertise (fictive) » listée sous les deux).
- Attendu : chaque périmètre a sa DdA (le sous-périmètre HDS hérite de celle du parent ou s’en écarte explicitement), ou
  l’écran dit clairement que la donnée est commune à l’organisation et n’affiche pas de sélecteur trompeur. Une écriture
  faite sous un périmètre ne modifie pas un autre périmètre.
- Reproductible par : à écrire (modifier une mesure sous le sous-périmètre, la relire sous le principal).

### C3-02 — Trois registres d’applicabilité qui s’ignorent : DdA, « Applicabilité et justifications », « Couverture par référentiel »

- Gravité : majeur
- Référence : ISO/IEC 27001:2022, 6.1.3 d) ; AGENTS.md (une seule source modifiable par objet) ; ergonomie (double saisie)
- Observé : DdA annexe A du jeu fictif saisie (A.5.1 Oui Total, A.8.30 Non + justification, etc.), 4.3 « Total » dans les
  clauses, HDS 01 Oui Partiel. `ouvrir /pilotage/couverture` : « 93 exigence(s) à déterminer », « 31 exigence(s) à
  déterminer », `row "ISO-4.3 · 4.3 … Applicable (obligatoire) Clause pas encore conforme Non implémenté"`, `row "A-8.30 · 8.30
  — Développement externalisé À déterminer : à revoir"`. Il a fallu ressaisir A-8.30 et A-5.1 dans la Couverture. Dans la
  fiche d’une mesure liée à A-8.13 : « Applicabilité dans ce périmètre : non évaluée ». Sous « Hébergement HDS », la fiche
  « A-8.30 — Développement externalisé (Hébergement HDS) » (non applicable, justifiée, liée à A-8.30) n’est reprise ni par
  la DdA (qui affiche la justification du principal) ni par la Couverture (« À déterminer »). Le texte de la DdA annonce
  pourtant : « Le niveau de mise en œuvre de la DdA alimente la couverture présumée des autres référentiels. »
- Attendu : une décision d’applicabilité saisie une fois, relue par la DdA, la fiche d’applicabilité et la couverture.
- Reproductible par : à écrire (DdA saisie → couverture du même référentiel).

### C3-03 — « Référentiels et exigences » et « Correspondances entre exigences » ignorent les référentiels attribués et appliqués

- Gravité : majeur
- Référence : ISO/IEC 27001:2022, 6.1.3 et 7.5 ; HDS v2 (correspondance ISO ↔ HDS) ; ADR 0082 (référentiels en copie)
- Observé : ISO/IEC 27001:2022 et HDS v2 ajoutés à la bibliothèque, attribués puis appliqués au principal (« Appliqué :
  suivi en conformité », journal `grc.referentiel.applique`). `ouvrir /pilotage/referentiels`, `cliquer combobox
  "Référentiel publié"` : liste vide. `ouvrir /pilotage/correspondances`, `cliquer combobox "Référentiel source"` : liste
  vide ; après publication d’un référentiel fictif sur la page Référentiels, la liste ne propose que lui
  (`option "Exigences contractuelles des clients hébergés (fictif)"`). Les deux écrans lisent les objets `framework`
  (`GET /api/grc/<périmètre>/objects?kind=framework` → `"total":0` avant la publication), pas les copies de la bibliothèque.
  Sous le sous-périmètre, les copies héritées n’apparaissent pas non plus. Aucune correspondance ISO ↔ HDS ne peut être
  saisie sur « Correspondances entre exigences » (elle l’a été sur « Correspondances de la bibliothèque »).
- Attendu : les référentiels suivis du périmètre (copies appliquées ou héritées) sont listés et utilisables.
- Reproductible par : à écrire.

### C3-04 — Un niveau de mise en œuvre est accepté sur une mesure non examinée et compté « Total »

- Gravité : majeur
- Référence : ISO/IEC 27001:2022, 6.1.3 d) ; AGENTS.md (aucun taux inventé) ; consigne de la tranche (aucun indicateur ne
  compte une mesure non examinée)
- Observé : `ouvrir /pilotage/dda-annexe-a`, `choisir "Niveau de A.6.7" "Total"` sans rien choisir dans « Applicabilité de
  A.6.7 » : enregistré (`{'app': '', 'level': 'Total', …}`), bandeau passé de « 3 % » à « 4 % », filtre « Total » : 4 mesures
  dont A.6.7, filtre « Non renseignées » : 86 mesures (A.6.7 absente). Rétabli ensuite par
  `api PATCH /api/dda/A-6.7 {"app":"","level":""}`.
- Attendu : niveau refusé (ou ignoré) tant que l’applicabilité n’est pas décidée ; la mesure reste « non renseignée ».
- Reproductible par : à écrire (règle à ajouter à `invariants.ts` : aucun niveau sans applicabilité).

### C3-05 — Enregistrer une fiche d’applicabilité sans rien changer déclare la mesure « Applicable »

- Gravité : majeur
- Référence : ISO/IEC 27001:2022, 6.1.3 d) ; prolonge RSSI-13 (BUG-017)
- Observé : « Applicabilité et justifications », A-5.2 jamais examinée (`app: ''`) : la fiche montre `checkbox "Applicable"
  [checked]` ; `cliquer button "Enregistrer"` sans modification : `GET /api/dda?reference=A` → A-5.2 `{'app': 'oui', …}`.
  Aucun message après l’enregistrement. Rétabli par l’API.
- Attendu : une décision d’applicabilité n’est écrite que si le RSSI la prend ; état « non examinée » distinct.
- Reproductible par : à écrire.

### C3-06 — Un écart rattaché à l’exigence « A-5.15 » du référentiel est ignoré par la DdA

- Gravité : majeur
- Référence : ISO/IEC 27001:2022, 10.2 et 6.1.3 d) (état de mise en œuvre) ; traçabilité mesure → écart
- Observé : « Amélioration continue », « Ajouter un constat » « Revue trimestrielle des comptes à privilèges non tracée
  (fictif) » (non-conformité mineure, audit d’origine « Audit interne 2026 … »), onglet Liens : « Rechercher une référence »
  `5.15` propose `option "A-5.15 · 5.15 — Contrôle d'accès"` ; choisie seule, la colonne « Écarts » de A.5.15 dans la DdA
  reste vide. La recherche `Contrôle d'accès` propose en plus `option "Contrôle d'accès"` (élément historique, sans code) ;
  une fois celui-ci ajouté (`refs` : `requirement:…:A-5.15`, `legacy:items:A-5.15`), la DdA affiche l’écart (par son
  identifiant, BUG-019).
- Attendu : un écart rattaché à la mesure par son code est repris par la DdA, quel que soit le chemin de rattachement ; un
  seul choix proposé pour une même mesure.
- Reproductible par : à écrire.

### C3-07 — Lien mort « Consulter le référentiel historique »

- Gravité : mineur
- Référence : ADR 0042 (retrait de l’écran `/legacy`)
- Observé : `ouvrir /pilotage/referentiels`, `cliquer link "Consulter le référentiel historique"` : URL `/legacy/`,
  `heading "Page introuvable"`. Même page : « ReCyF · v2.5 … Actif dans le socle historique · 152 exigences » sur une
  installation neuve où le RSSI n’a rien activé.
- Attendu : lien retiré ou vers un écran existant ; référentiel non activé sans décision.
- Reproductible par : à écrire.

### C3-08 — Messages d’erreur avec noms de champs techniques

- Gravité : mineur
- Référence : ergonomie (message en français qui désigne le champ) ; même famille que BUG-025
- Observé : créneau d’audit fin 10:00 avant début 11:00 → « Données invalides — end : La fin du créneau précède son début. »
  (`HTTP 422 /api/audit-suivi/plan/creneaux/…`) ; « Enregistrer la proposition » vide → « Données invalides —
  source.frameworkId : UUID invalide ; target.frameworkId : UUID invalide ; justification : Trop petit : chaîne de
  caractères doit avoir >=10 caractères ; sourceUrl : URL invalide » ; référentiel sans nom → « name : Trop petit : chaîne de
  caractères doit avoir >=1 caractères ». Éditeur de référentiel : boutons nommés « Retirer configuration.domains 1 ».
- Attendu : « Fin », « Référentiel source », « Justification », « Source officielle », « Nom ».
- Reproductible par : à écrire.

### C3-09 — Saisie incomplète refusée sans message ni champ obligatoire signalé

- Gravité : mineur
- Référence : ergonomie ; accessibilité (champ obligatoire annoncé)
- Observé : « Ajouter mesure », « Ajouter preuve », « Ajouter contrôle », « Ajouter audit » : `remplir "Intitulé" "   "` →
  `button "Enregistrer" [disabled]`, aucune alerte, « Intitulé » sans astérisque (capture `mesure-ajout-vide.png`). Examen
  d’une preuve sans observation : « Confirmer l’enregistrement » grisé sans explication. Participants du plan d’audit : nom
  vidé → retour silencieux à l’ancienne valeur.
- Attendu : champ obligatoire marqué et message qui le nomme.
- Reproductible par : à écrire.

### C3-10 — Réaliser un contrôle périodique ne reporte pas son échéance

- Gravité : mineur
- Référence : ISO/IEC 27001:2022, 8.1 et 9.1
- Observé : contrôle « Test mensuel de restauration des sauvegardes (fictif) », fréquence Mensuelle, échéance 01/11/2026 ;
  « Réaliser le contrôle » le 10/11/2026, Réussi, justificatif : ligne `… À préparer Dernier résultat : Réussi … 01/11/2026` ;
  données `'dueAt': '2026-11-01', 'status': 'draft', 'performedAt': '2026-11-10'`.
- Attendu : prochaine échéance recalculée (décembre) ou demandée ; le contrôle réalisé n’apparaît pas en retard.
- Reproductible par : à écrire.

### C3-11 — Doublons acceptés : service analysé, application à intégrer

- Gravité : mineur
- Observé : « Analyser un service », même nom « Messagerie sécurisée de santé régionale (service fictif) » sous le même
  parent : second périmètre créé (deux boutons « Modifier le périmètre Messagerie sécurisée … » identiques) ; aucun moyen
  de le supprimer, il a été renommé « Doublon de test (agent 3) - à ignorer ». « Applications à intégrer » : « Ajouter sans
  questionnaire » puis même nom → deux lignes « Plateforme de téléexpertise (fictive) » (la seconde supprimée ensuite).
- Attendu : doublon signalé ou refusé ; périmètre créé par erreur supprimable.
- Reproductible par : à écrire.

### C3-12 — Un contrôle « Non réussi » s’enregistre sans écart ni action corrective, sans alerte

- Gravité : mineur
- Référence : ISO/IEC 27001:2022, 10.2 a)
- Observé : sous « Hébergement HDS », « Revue trimestrielle des accès à la salle d’hébergement (fictive) », Résultat « Non
  réussi », cases « Créer un écart dans le registre existant » et « Créer une action corrective suivie » non cochées :
  enregistré (`Dernier résultat : Non réussi`), aucun avertissement.
- Attendu : écart ou action proposés par défaut, ou justification demandée pour ne pas réagir.
- Reproductible par : à écrire.

### C3-13 — Mesures, déclarations d’applicabilité et audits : ni export ni archivage à l’écran

- Gravité : mineur
- Référence : ISO/IEC 27001:2022, 7.5.3 (maîtrise des informations documentées) ; consigne de la tranche (créer, modifier,
  lier, supprimer, exporter chaque type)
- Observé : « Mesures », « Applicabilité et justifications » et « Audits internes » : pas de bouton « Exporter le registre et
  ses décisions » (présent sur Preuves et Plan de contrôle) ; fiche ouverte : seulement « Fermer » et « Enregistrer » ;
  menu « Autres actions » : « Décisions et réalisations ». L’API archive (`DELETE /api/grc/:smsi/objects/:id`, « Archiver sans
  supprimer les décisions ») mais aucune fiche de ces registres ne l’offre ; la mesure de test reste en place.
- Attendu : export et archivage disponibles selon les droits, comme sur les autres registres.
- Reproductible par : à écrire.

### C3-15 — Cycle d’audit : libellé vide et date d’audit interne hors cycle acceptés

- Gravité : mineur
- Référence : ISO/IEC 27001:2022, 9.2.2 (programme d’audit)
- Observé : fenêtre « Cycle d’audit », « Libellé de 2026 » vidé et « Date de l’audit interne » 2030-01-01 (après l’audit de
  surveillance du 15/03/2027 et l’échéance de clôture du 28/02/2027) : enregistré, colonne `cell "2026"` sans libellé.
  Valeurs rétablies ensuite.
- Attendu : libellé exigé, date d’audit interne contrôlée par rapport au cycle.
- Reproductible par : à écrire.

### C3-14 — Remarques

- Gravité : remarque
- Organisme certificateur « AFNOR » écrit en dur (« auditeur AFNOR », « Prochain audit AFNOR ») ; cycle par défaut
  2025-2027 sans lien avec l’organisation (certification 2026) jusqu’à ce que le RSSI le corrige.
- « Les accès existants sont conservés. » sous chaque sélecteur de périmètre : phrase sans rapport avec le choix.
- Copies nommées « ISO/IEC 27001:2022 (PRIVE - SMSI Groupement Santé Fictif) » (majuscules, sans accent).
- Tri lexical dans la Couverture (A-5.1, A-5.10, A-5.11…) ; mesures de la carte listées sans leur code.
- La carte du prochain audit ignore les preuves validées et les contrôles réalisés de la mesure (A.8.13 : « Preuves types »
  génériques seulement).
- Export du registre des preuves : objets et décisions, pas les relations (« Démontre » la mesure).
- Correspondance de bibliothèque validée par la personne qui l’a proposée (« Validée par rssi »).
- Accessibilité : groupes « Préparation » répétés sans le nom de la mesure ; boutons « Prête » homonymes ; créneaux du
  planning dans un élément `img` ; boutons de fermeture sans nom dans plusieurs fenêtres ; en-têtes de tableau en cellules.
- Libellés d’état d’une preuve : « À produire » dans la fiche, « À préparer » dans la liste ; résultat proposé par défaut
  « Accepté » (preuve) et « Réussi » (contrôle).
- Programme d’audit interne (PL-AUD-001) et fiches « Audit » : deux saisies pour un même audit sur le même écran ; le
  programme a un champ « Auditeur », la fiche n’en a pas.

## Défauts connus reconfirmés / non reproduits

Sur les briques réelles (PostgreSQL 18.6, Node 26.12.1) :

| Défaut | Résultat | Observé |
|---|---|---|
| BUG-016 | reconfirmé (3 chemins) | A.6.7 « Non » sans justification depuis la ligne de l’annexe A ; HDS 30 idem ; A-5.2 décochée dans « Applicabilité et justifications » ; fiche `soa` du sous-périmètre créée non applicable sans justification. INV-03 ne voit que la DdA du socle |
| BUG-017 | reconfirmé | jeu fictif : « 3 % » (3 Total / 92 non exclues) au lieu de 60 % ; « 0 % » sur une DdA vide ; RSSI-13 : A-5.2 non examinée affichée « Applicable » coché |
| BUG-019 | reconfirmé | colonne « Écarts » de A.5.15 : `cell "ab957b85-2060-4b2c-96ff-3e7e0db5acd4"` |
| BUG-027 | reconfirmé | fiche A-8.13, onglet « Liens et justificatifs » : « Erreur Origine de référence inconnue. », `HTTP 422 /api/grc/<périmètre>/links?ref=legacy%3Adda%3AA-8.13` |
| BUG-030 | reconfirmé en partie | programme « 0/0 réalisé(s) en 2026, 0 au total » après la fiche « Audit interne 2026 » (compteur lu dans le programme PL-AUD-001, saisi à part) ; « Référentiels audités » **propose** ISO et HDS une fois les référentiels attribués et appliqués (non vérifié avant) |
| BUG-033 | reconfirmé | document « Politique de sécurité de l’information (fictive) » rattaché à A.5.1 : colonne « Document associé » vide, champ « Documents associés » vide dans la fiche |
| BUG-036 | reconfirmé | Parcours ISO : `button "Applicabilité (Choisir le traitement) — Aucun travail trouvé"` avec DdA et couverture renseignées |

Invariants (`pilote.mjs invariants`) : INV-01 à INV-08 OK sur l’état final (ils ne lisent que la DdA du socle : C3-02 et
C3-04 leur échappent).

## État de la pile laissée pour la phase 2

Compte : `rssi` (Administrateur) seulement, secret TOTP dans `tests/e2e/rssi-virtuel/.pilote-3/comptes.json`. Périmètres :
« SMSI Groupement Santé Fictif », « Hébergement HDS », « Messagerie sécurisée de santé régionale (service fictif) » (enfant
du principal), « Doublon de test (agent 3) - à ignorer » (enfant du principal), « Sauvegarde externalisée des données
hébergées (service fictif) » (enfant d’« Hébergement HDS »). Données « rempli » laissées en place sur les deux périmètres
(voir « Écrans couverts »), dont un rapprochement à valider sous « Hébergement HDS ».
