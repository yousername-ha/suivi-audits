# Campagne de recette, phase 1 : agent 5 (incidents, crise, continuité, documents, exports)

| Élément | Valeur |
| --- | --- |
| Commit testé | `2e63e86` (branche `claude/recette-rssi-2026-11-12` au lancement de la pile ; `HEAD` est passé à `4fc555d` pendant la recette, commits de documentation seulement) |
| Date | 2026-11-12, 20:55 à 21:45 (Europe/Paris) |
| Pile | `https://127.0.0.15` (projet Compose `suivi-rssi-virtuel-5`), pile Docker vierge de `lancer.sh` : PostgreSQL 18, Node 26 (briques vérifiées par la session principale) ; `GET /api/version` : `"version":"local"`, dernière migration `054_retrait_revues_acces.sql` |
| Navigateur | Chrome du pilote (`PILOTE_PORT=9338`, `PILOTE_DOSSIER=.pilote-5`), sans fuseau réglé : les heures affichées sont en UTC et ne sont pas jugées |
| Données | Jeu fictif `tests/e2e/rssi-virtuel/donnees/organisation-fictive.json` ; aucun secret recopié ici |
| Matrice | `campagne/agent-5.csv` : 90 cases, **31 ok, 41 défaut, 18 sans objet, 0 non testée** |

## Installation et périmètres

`GET /api/setup` au premier contact : `"needed":true`, `"adminExists":false`. Installation par l'écran (poivre, clé de secours,
compte `rssi` administrateur, TOTP, clé de sécurité non proposée). Périmètre racine renommé « SMSI Groupement Santé Fictif »
(champ Périmètre renseigné), sous-périmètre « Hébergement HDS » créé rattaché, « Hériter des référentiels du parent » coché
(`GET /api/grc/smsis` : `inheritFrameworks:true`, `visibility:"restricted"`).

## Écrans couverts

Les 15 écrans de la tranche, sous le périmètre racine puis sous « Hébergement HDS », états vide (balayage avant toute saisie),
rempli et erreur. Types d'objets : `continuity_plan` (PRA racine créé, modifié, lié à A.8.13, exporté ; PCRA HDS complété
puis validé avec justificatif), `continuity_exercise` (racine et HDS, plus la fiche historique PL-EXO-001), `incident`
(INC-2026-001 rançongiciel du jeu fictif, INC-2026-002 coupure réseau, INC-2026-003 demande ; une fiche vide supprimée).
Parcours croisés : incident → cellule de crise d'exercice (scénario, check-list, main courante, échéance) → RETEX
(récupération de la fiche et de la main courante, chronologie générée, cause reprise dans la fiche) → action vers le
registre des écarts (A.5.27) ; collecte RETEX avec un contributeur ; écran mural créé et activé ; exports Excel relus
(fichiers décompressés), rapport de pilotage et export des registres relus en JSON ; journal d'audit contrôlé par l'API.

## Cases sans objet et pourquoi

| Cases | Raison |
| --- | --- |
| `/mur`, `/mur/activer` sous le sous-périmètre (6) | Vue d'instance : aucun sélecteur de périmètre, l'activation d'un écran ne dépend pas du périmètre |
| `/documents`, `/documents/:id` sous le sous-périmètre (6) | Bibliothèque commune de l'instance, aucun sélecteur de périmètre |
| `/exports` sous le sous-périmètre (3) | Aucun choix de périmètre sur l'écran (l'absence est signalée dans C5-16) |
| `/retex/:incident?` sous le sous-périmètre (3) | Espace contributeur nominatif, sans périmètre |

Courriels (invitation RETEX « par courriel selon ses réglages ») : non vérifiés, service extérieur à la pile ; seule la
notification dans l'application a été vue (demande reçue par le contributeur).

## Synthèse des constats

| Gravité | Constats |
| --- | --- |
| Bloquant | aucun nouveau (INV-08 en ÉCHEC analysé plus bas : faux positif probable de l'invariant) |
| Majeur | C5-01, C5-03, C5-04, C5-05, C5-06, C5-11, C5-15, C5-16, C5-17, C5-18, C5-19 |
| Mineur | C5-02, C5-07, C5-08, C5-09, C5-10, C5-12, C5-13, C5-14, C5-20, C5-21, C5-22, C5-23, C5-24, C5-25 |
| Remarque | C5-26, C5-27 |

## Constats

Les commandes sont celles du pilote (`node tests/e2e/rssi-virtuel/pilote.mjs …`), abrégé `pilote`.

### C5-01 — Le compteur « Continuité » ne compte que les plans de type PCRA

- Gravité : majeur (chiffre faux sur quatre écrans de synthèse)
- Étape du scénario : 17 (vérification croisée) ; écran Continuité et reprise
- Référence : ISO/IEC 27001:2022, 9.1 et A.5.29, A.5.30
- Observé : `pilote ouvrir /pilotage/continuite`, « Ajouter plan de continuité ou de reprise », type « PRA — reprise
  informatique », enregistré (`GET /api/grc/<racine>/objects?kind=continuity_plan` : 1 objet, `planType:"pra"`). Puis
  `pilote ouvrir /pilotage/perimetres` : `link "0 PCRA"` sous le racine ; tableau de bord : « 0 plans de continuité et de
  reprise » ; mur : « 0 plans de continuité et de reprise (PCRA) ». Un PCRA créé sous HDS passe le compteur à 1.
  Cause lue : `apps/api/src/grc/cartes.ts:66` compte `planType='pcra'` seulement.
- Attendu : le libellé « plans de continuité et de reprise » compte PCA, PRA, PCRA et plans propres à une activité (ou le
  libellé dit exactement ce qu'il compte).
- Reproductible par : à écrire (créer un PRA, lire `/api/grc/:smsi/dashboard`).

### C5-02 — Exercice : résultat, état et dates incohérents acceptés

- Gravité : mineur
- Étape : 17 ; écran Exercices et RETEX, état erreur
- Référence : ISO/IEC 27001:2022, 7.5.2 et A.5.30
- Observé : « Ajouter exercice et retour d'expérience » : date prévue 10/12/2026, date de réalisation 15/01/2027 (future),
  résultat « Réussi », état « Planifié » → enregistré, ligne « Exercice incohérent à supprimer (fictif) Planifié ».
- Attendu : refus ou alerte (réalisation dans le futur, résultat sans réalisation, état « Planifié » avec résultat).
- Reproductible par : à écrire.

### C5-03 — Continuité et exercices : aucune fiche ne peut être archivée ni supprimée à l'écran

- Gravité : majeur (une fiche saisie par erreur reste dans le registre et dans les compteurs)
- Étape : 17 ; écrans Continuité et reprise, Exercices et RETEX
- Référence : ISO/IEC 27001:2022, 7.5.3 (maîtrise des informations documentées)
- Observé : `pilote cliquer button "Autres actions pour Exercice incohérent à supprimer (fictif)"` → menu « Créer une action
  suivie », « Décisions et réalisations » seulement ; la fiche ouverte n'a que « Fermer » et « Enregistrer ». L'API prévoit
  pourtant `DELETE /api/grc/:smsi/objects/:id` (« Archiver sans supprimer les décisions ») ; le bouton « Archiver la fiche »
  existe dans `apps/web/src/grc/ObjectEditor.tsx` mais pas dans `apps/web/src/pilotage/Registry.tsx`.
- Attendu : « Archiver la fiche » avec confirmation, selon le droit « supprimer ».
- Reproductible par : à écrire. La fiche « Exercice incohérent à supprimer (fictif) » est restée sur la pile.

### C5-04 — Deux registres d'exercices qui s'ignorent

- Gravité : majeur (exercice réalisé non compté ; même famille que BUG-037)
- Étape : 17 ; Exercices et RETEX, Cellule de crise, Plans du SMSI, mur, exports
- Référence : ISO/IEC 27001:2022, 9.1 et A.5.30 ; traçabilité
- Observé : sous le racine, l'écran porte le bloc « Plan d'exercices PRA et crise » (registre historique, PL-EXO-xxx) et le
  registre « Exercice et retour d'expérience » (objets). Exercice « Exercice de restauration de la sauvegarde (fictif) »
  réalisé le 15/10/2026, résultat partiel, lié au PRA : le bandeau du même écran reste « 0/0 réalisé(s) en 2026 ». La liste
  « Exercice planifié lié » de la cellule de crise ne propose que `PL-EXO-001`. Tableau de bord et mur : « Plans du SMSI
  2026 : Exercice 1 » (PL-EXO-001 seul). Export « Plans du SMSI » : PL-EXO-001 seul. Sous HDS, le bloc historique n'existe
  pas et l'exercice HDS n'est compté nulle part. Le PRA lié garde `testedAt:""`.
- Attendu : un seul registre d'exercices par périmètre, repris par les compteurs, la cellule de crise et les exports.
- Reproductible par : à écrire.

### C5-05 — Scénario de crise : responsable d'une action perdu sans message

- Gravité : majeur (perte silencieuse de donnée)
- Étape : 17 ; Scénarios et check-lists
- Référence : ISO/IEC 27001:2022, 7.5.3 ; A.5.24
- Observé : `pilote remplir "Action 5" …`, `pilote remplir "Responsable de l'action 5" "RSSI (fictif)"`, puis
  `pilote cliquer button "Ajouter une action"` : `textbox "Responsable de l'action 5"` vide, aussi après rechargement de la
  page. Reproduit 2 fois sur 4 (actions 1, 2 puis 5). Journal d'audit : deux `crisis.scenario-action-updated` dans la même
  seconde. Lecture du code (`apps/web/src/incidents/Crise.tsx`) : chaque champ s'enregistre à la perte du focus
  (`PATCH …/actions/k`) pendant que le clic envoie `POST …/actions` ; cause probable, mise à jour concurrente du même scénario.
- Attendu : aucune saisie perdue (enregistrement sérialisé ou contrôle de version), ou refus explicite.
- Reproductible par : à écrire (saisir puis cliquer sans attente).

### C5-06 — Incidents, RETEX, cellules, contacts et scénarios de crise ne sont rattachés à aucun périmètre

- Gravité : majeur
- Étape : 13 à 17 (HDS) ; tous les écrans « Incidents et crise »
- Référence : ISO/IEC 27001:2022, 4.3 ; HDS v2 (périmètre des activités d'hébergement) ; consigne de campagne §5 point 3
- Observé : chaque écran affiche « Périmètre affiché ». INC-2026-002 saisi sous « Hébergement HDS » apparaît sous le racine,
  INC-2026-001 saisi sous le racine apparaît sous HDS (`pilote cliquer-texte "Tous"` sous HDS : `row "INC-2026-001 …"`).
  Même chose pour le RETEX, l'historique des cellules (crise réelle ouverte sous HDS), les contacts et les scénarios. Les
  routes `/api/incidents`, `/api/crise/*` n'ont pas de paramètre de périmètre (`apps/api/src/routes/historique/`).
- Attendu : chaque incident et chaque cellule portent leur périmètre ; le sélecteur filtre ; un compte limité à un
  sous-périmètre ne voit que les siens (à vérifier en phase 2), ou bien le sélecteur est retiré de ces écrans et leur
  caractère commun est annoncé.
- Reproductible par : à écrire.

### C5-07 — Incident créé sans intitulé ni qualification

- Gravité : mineur
- Étape : 17 ; Qualifier un signalement, Registre des incidents
- Référence : A.5.25 (évaluation des événements)
- Observé : `pilote cliquer button "Créer la fiche dans le registre"` avec intitulé vide et « 0/6 questions renseignées » →
  `/pilotage/incidents-registre?incident=INC-2026-001`, `row "INC-2026-001 … Événement (sans titre) Autre – Qualifié –"`.
  « Saisir directement » crée de même `(sans titre)`.
- Attendu : intitulé exigé, qualification exigée ou statut « Nouveau » non qualifié.
- Reproductible par : à écrire.

### C5-08 — Qualification : données de santé sans rappel du RGPD

- Gravité : mineur
- Étape : 17 ; Qualifier un signalement
- Référence : A.5.26, A.5.34 ; obligations de notification d'une violation de données personnelles
- Observé : réponses service = oui, CIA = oui, règle = oui, données personnelles = « Je ne sais pas », données de santé = oui.
  Résultat « Incident de sécurité » avec rappels A.5.26 à 5.28, santé/HDS et NIS 2, mais aucun rappel de notification de
  violation de données personnelles. L'écran indique « « Je ne sais pas » est traité comme « non » ».
- Attendu : des données de santé sont des données personnelles ; « Je ne sais pas » sur une question d'obligation doit
  garder le rappel (prudence), au moins le signaler « à confirmer ».
- Reproductible par : à écrire.

### C5-09 — Référence d'incident réattribuée après suppression

- Gravité : mineur
- Étape : 17 ; Registre des incidents
- Référence : A.5.28 (preuves), 7.5.3 (traçabilité)
- Observé : fiche vide INC-2026-001 supprimée (« Supprimer INC-2026-001 ? »), l'incident suivant reçoit de nouveau
  `INC-2026-001`. Journal d'audit (`GET /api/admin/audit`) : `incident.created`, `incident.deleted`, `incident.created`
  sur la même cible `legacy:incidents:INC-2026-001`.
- Attendu : référence jamais réutilisée (ou suppression remplacée par une annulation tracée).
- Reproductible par : à écrire.

### C5-10 — Dates incohérentes acceptées (incident, chronologie)

- Gravité : mineur
- Étape : 17 ; Registre des incidents, RETEX et chronologie
- Référence : 7.5.2 ; A.5.27
- Observé : « Résolu le » 01/11/2026 10:00 pour un incident détecté le 12/11/2026 20:15, statut « En cours » :
  `GET /api/incidents` → `"resolvedAt":"2026-11-01T10:00"`, aucun message. Chronologie : événement « Rétablissement » daté
  du 13/11/2026 02:00 accepté le 12/11 vers 20:20 (heure du serveur).
- Attendu : résolution postérieure à la détection, cohérente avec le statut ; événement futur signalé.
- Reproductible par : à écrire.

### C5-11 — RETEX : gravité « Faible » inventée pour un incident critique

- Gravité : majeur (donnée fausse dans le RETEX)
- Étape : 17 ; RETEX et chronologie
- Référence : A.5.27 ; règle « aucun chiffre inventé » d'AGENTS.md
- Observé : INC-2026-001 (impact Élevé, urgence Élevé, « P1 Critique »). Après import de la fiche et de la main courante,
  chaque ligne porte « Faible (reportée) » et le bandeau « Gravité maximale : Faible », alors qu'aucune gravité n'a été
  saisie. Elle ne change qu'après saisie manuelle d'un événement « Élevée ».
- Attendu : « non renseignée » tant qu'aucune gravité n'est saisie, ou reprise de la priorité de l'incident.
- Reproductible par : à écrire.

### C5-12 — RETEX : « Je remplis seul » ouvre une collecte ; pilote absent

- Gravité : mineur
- Étape : 17 ; RETEX et chronologie
- Observé : « Ouvrir un RETEX », INC-2026-002, « Je remplis seul », « Ouvrir le RETEX » → `heading "… Collecte ouverte"`,
  compteur « Collectes ouvertes 1 ». Le RETEX de INC-2026-001 ouvert depuis la fiche d'incident est « Saisie seule » avec
  pilote « – ».
- Attendu : mode « saisie seule » respecté ; pilote toujours renseigné.
- Reproductible par : à écrire.

### C5-13 — Aucune preuve rattachable à un incident ou à une cellule de crise

- Gravité : mineur
- Étape : 3 et 17 ; Documents, Registre des incidents
- Référence : A.5.28 (collecte des preuves)
- Observé : fiche d'incident sans pièce jointe ni rattachement ; dans un document, `pilote remplir "Rattachements (mesures,
  écarts, processus…)" "INC"` ne propose que `INC-AC-01` (l'écart), aucun incident ni cellule.
- Attendu : rattacher rapport, journaux ou captures à l'incident et à la cellule de crise.
- Reproductible par : à écrire.

### C5-14 — Documents : texte de recherche enregistré comme rattachement

- Gravité : mineur
- Étape : 3 ; `/documents/:id`
- Observé : saisie « INC » dans le champ de rattachement, puis « Enregistrer » → « Document enregistré. », fiche
  « A.5.24 A.5.26 INC » ; `GET /api/documents/<id>` → `"refs":["A.5.24","A.5.26","INC"]` (aucune cible « INC »).
- Attendu : seules les options choisies sont enregistrées.
- Reproductible par : à écrire.

### C5-15 — Export Excel : « Piste de progrès » libellée « Point sensible »

- Gravité : majeur (donnée fausse dans un export remis à l'auditeur)
- Étape : 17 ; `/exports` (Écarts et actions, export complet)
- Référence : ISO/IEC 27001:2022, 10.2 ; traçabilité
- Observé : écart créé depuis INC-2026-001 (`findingType:"opportunity"`, `type:"PP"`). Mur et tableau de bord : « Piste de
  progrès 1 ». Export complet, feuille « Registre des écarts » : `INC-AC-01 | Interne | 2026 | Point sensible | Ouvert`.
  Cause lue : `apps/api/src/export/rubriques.ts:65` traduit `PP` par « Point sensible » (le modèle `packages/shared/src/audit/model.ts`
  : `PP: 'Piste de progrès'`, `PS` = point sensible).
- Attendu : même classification dans l'export que dans l'application.
- Reproductible par : à écrire (lecture de la feuille exportée).

### C5-16 — « Export complet » incomplet et sans périmètre

- Gravité : majeur
- Étape : 17 ; `/exports`
- Référence : 7.5 ; scénario étape 17 (« exports … état complet »)
- Observé : `export-all-std` (28 feuilles) relu : aucun plan de continuité, aucun exercice du registre (seul PL-EXO-001),
  ni RETEX ni chronologie, ni scénarios de crise, ni documents, ni risques, traitements ou revues de direction. Feuille
  « Périmètre du SMSI » vide (Version, Énoncé, Sites, Processus sans valeur) alors que les deux périmètres sont décrits ;
  aucune mention du sous-périmètre. Aucun choix de périmètre. Feuille « Mains courantes » : horodatages bruts
  `2026-11-12 20:17:02.168Z` à côté de `2026-11-12 20:15` dans le registre des incidents. Noms de feuilles tronqués
  (« Déclaration d'applicabilité — A », « Évaluations sécurité fournisseu »).
- Attendu : « Toutes les rubriques » contient les registres de l'application, par périmètre ; périmètre exporté renseigné.
- Reproductible par : à écrire.

### C5-17 — Resélectionner le périmètre affiché bascule sur le périmètre racine

- Gravité : majeur (donnée écrite dans le mauvais périmètre)
- Étape : 1 et 17 ; tout écran portant « Périmètre affiché » (vu sur Import et rapports)
- Observé : périmètre affiché « Hébergement HDS » ; `pilote choisir "Périmètre affiché" "Hébergement HDS"` →
  `combobox "Périmètre affiché": SMSI Groupement Santé Fictif`. Reproduit. Conséquence vécue : simulation puis
  « Confirmez l'importation atomique dans le périmètre sélectionné » → le référentiel « PSSI — exemple fictif » est dans le
  racine (`GET /api/grc/<racine>/objects?kind=framework` : 1 ; HDS : 0 ; journal `grc.object.created` sur le racine).
  Comportement d'une liste Mantine qui désélectionne l'option déjà choisie.
- Attendu : choisir le périmètre courant ne change rien ; la confirmation d'import nomme le périmètre cible.
- Reproductible par : à écrire (sélection répétée, puis lecture du combobox).

### C5-18 — Crise réelle : le bandeau rouge annoncé n'existe pas

- Gravité : majeur
- Étape : 17 ; Cellule de crise, tableau de bord, mur
- Référence : A.5.26, A.5.29
- Observé : type « Crise réelle — situation avérée : bandeau rouge sur le tableau de bord et dans le menu jusqu'à la
  clôture. », confirmation « Déclencher une cellule de CRISE RÉELLE ? », cellule `CRISE RÉELLE` ouverte. Tableau de bord
  (capture relue), menu et mur : aucune mention de crise. Le code ne contient de libellé de crise que dans
  `apps/web/src/incidents/Crise.tsx`. Cellule clôturée ensuite.
- Attendu : bandeau visible de tous les utilisateurs concernés tant que la crise est ouverte, comme l'écran l'annonce.
- Reproductible par : à écrire.

### C5-19 — Les incidents ne remontent dans aucune synthèse

- Gravité : majeur (le critère de l'étape 17 « l'incident remonte … à la revue » n'est pas tenu)
- Étape : 11 et 17
- Référence : ISO/IEC 27001:2022, 9.1, 9.3.2 ; A.5.27
- Observé : INC-2026-001 incident de sécurité P1 résolu. Tableau de bord, Synthèse (`/pilotage/synthese`), mur : aucune
  tuile ni chiffre d'incident ; vues du mur : Synthèse, Écarts ouverts, Échéances, Plan d'audit. Rapport de pilotage
  (`GET /api/grc/:smsi/report`, sections `risks`, `tasks`, `frameworks`, `mappings`) : rien sur les incidents, la
  continuité ni les exercices. Revue de direction : entrées 9.3.2 de l'ISO 9001 sans incident (BUG-031). L'écran du
  registre annonce : « Les chiffres alimentent la diapositive « Revue des incidents » du COPIL sécurité » ; aucune
  diapositive de ce nom n'existe dans le code.
- Attendu : nombre d'incidents de sécurité, ouverts, P1, délais et RETEX repris dans la synthèse et la revue ; texte de
  l'écran exact.
- Reproductible par : à écrire.

### C5-20 — Import et rapports : messages techniques ou en anglais, liste d'export vide

- Gravité : mineur
- Étape : 17 ; `/pilotage/imports`
- Observé : contenu `{"pas": ` → « Erreur Unexpected end of JSON input » ; `{"pas":"un référentiel"}` → « Données invalides
  — definition : Entrée invalide : objet attendu, indéfini reçu ; Clé non reconnue : "pas" ». L'erreur reste affichée après
  les exports réussis. « Référentiel à exporter » vide alors que clauses ISO 27001, annexe A et HDS sont suivies (même
  cause probable que BUG-030 : liste des référentiels publiés).
- Attendu : message français qui dit quoi corriger ; référentiels suivis exportables.
- Reproductible par : à écrire.

### C5-21 — Action créée depuis un incident : sans responsable, sans échéance, sans cause

- Gravité : mineur (même famille que BUG-034)
- Étape : 9 et 17
- Référence : 10.2 b) ; invariant INV-06
- Observé : « Créer une action dans le registre des écarts » → « Action INC-AC-01 (ouvert) » ; objet `nonconformity`
  `ownerId:null`, `dueAt:""`, `cause:""` alors que l'incident a un responsable et une cause. `pilote invariants` :
  `ALERTE INV-06 … « Action issue de l'incident INC-2026-001 … » sans responsable ni échéance`.
- Attendu : responsable, échéance et cause demandés ou repris.
- Reproductible par : invariant INV-06 (ALERTE).

### C5-22 — Contacts de crise : saisie non contrôlée, actions sans retour

- Gravité : mineur
- Étape : 17 ; Contacts de crise
- Observé : courriel « pas-un-courriel » enregistré sans message ; « Ajouter les fournisseurs critiques et hébergeurs »
  sans fournisseur : aucun retour ; boutons de ligne tous nommés « Supprimer » (lecteur d'écran : impossible de savoir
  quel contact).
- Attendu : adresse validée ; message « aucun fournisseur critique » ; nom « Supprimer le contact … ».
- Reproductible par : à écrire.

### C5-23 — Scénario de crise sans intitulé ; référence au plan en texte libre

- Gravité : mineur
- Étape : 17 ; Scénarios et check-lists
- Observé : intitulé vidé → bouton `(sans titre) (0)`, aucun message. « Référence (PCA, PRA) » est un texte libre, sans lien
  vers le registre des plans de continuité.
- Attendu : intitulé exigé ; scénario relié au plan.
- Reproductible par : à écrire.

### C5-24 — Prochain audit inventé sur une installation sans cycle

- Gravité : mineur (écrans d'autres tranches, vus depuis le mur et l'export)
- Étape : 8 et 17
- Référence : scénario étape 8 (« le cycle correspond aux dates de l'organisation, pas à un cycle par défaut »)
- Observé : installation vierge, aucun cycle saisi : mur et tableau de bord « Prochain audit — 2027 — Surveillance 2 » ;
  export « Pronostic de l'audit 2027 » : « Non vue par [organisme certificateur nommé] en 2026 : rotation du cycle de
  surveillance » pour chaque mesure, alors qu'aucun audit ni organisme n'est enregistré.
- Attendu : « cycle non renseigné » tant que le RSSI ne l'a pas saisi.
- Reproductible par : à écrire (case des agents 3 et 6).

### C5-25 — Contribution RETEX : décompte « J-9 » pour 8 jours ; périmètre d'un autre compte réutilisé

- Gravité : mineur
- Étape : 17 ; `/retex/:incident`
- Observé : échéance 20/11/2026 vue le 12/11 → « Échéance 20/11/2026 · J-9 » (`Math.ceil` jusqu'à 23:59:59 dans
  `MesContributionsRetex.tsx`). Connecté ensuite comme `pilote.infra` dans le même navigateur : appel
  `GET /api/grc/<HDS>/rapprochements/summary` → 404 (périmètre affiché du compte précédent conservé).
- Attendu : J-8 ; périmètre affiché propre à chaque compte.
- Reproductible par : à écrire.

### C5-26 — Remarques de contenu (continuité, documents)

- Gravité : remarque
- Observé : la fiche d'un plan n'a pas de champs d'objectifs de reprise (RTO, RPO) ; état « Brouillon » dans la fiche,
  « À préparer » dans la liste ; date de dernier test du plan (`testedAt`) non alimentée par l'exercice lié ; nouvelle
  version de document sans commentaire de modification ; documents « non_analysé » sur la pile Docker (antivirus non
  actif ou non joignable, dépôt accepté) ; options de rattachement réduites à un code (« 5.1 », « A.5.1 ») ; durée de
  validité d'écran mural 400 ramenée à 365 sans message.

### C5-27 — Remarques d'accessibilité

- Gravité : remarque (déjà notées le 12/11/2026)
- Observé : boutons de fermeture sans nom (« Confirmation », « Ajouter un lien », fiche d'incident, lien d'activation du
  mur) ; en-têtes de tableau exposés comme `cell` ; « 1 fiches ».

## Invariants (`pilote invariants`, 21:40)

| Règle | Résultat |
| --- | --- |
| INV-01 à INV-05, INV-07 | OK |
| INV-06 | ALERTE : écart issu de l'incident sans responsable ni échéance (C5-21) |
| INV-08 | ÉCHEC : « Action issue de l'incident INC-2026-001 … absent de la DdA » |

Analyse d'INV-08 : la DdA (`GET /api/dda?reference=A`) liste bien l'écart, sous l'identifiant historique `INC-AC-01`, mesure
`A-5.27`, « Ouvert » ; l'objet du registre a l'identifiant `2910ea00-…` avec `legacyId:"INC-AC-01"`. Les données concordent ;
l'invariant compare l'identifiant de l'objet sans regarder `legacyId`. Faux positif probable de l'invariant, à rejouer en
phase 3 (correction dans `tests/`, hors de ce passage). Il montre aussi qu'un même écart porte deux identifiants selon
l'écran (voir BUG-019).

## Défauts connus reconfirmés / non reproduits

| Défaut | Constat sur la pile Docker |
| --- | --- |
| BUG-018 | Reconfirmé : « Toggle password visibility » à l'installation et sur « Choisir un nouveau mot de passe » (première connexion de `pilote.infra`) |
| BUG-031 | Reconfirmé : revue de direction « ISO 9001:2015, 9.3.2 », aucun incident de sécurité parmi les entrées |
| BUG-032 | Même défaut sur la validation d'un PCA : « Complétez les informations et justificatifs avant validation. » sans désigner les six champs exigés (`pilotage/service.ts`, approbation) |
| BUG-034 | Famille reconfirmée par l'action créée depuis un incident (C5-21) |
| BUG-019 | Voisin : l'écart issu d'un incident est désigné `INC-AC-01` dans la DdA, par son UUID dans le registre |

Non reproduit dans cette tranche : aucun (les autres défauts connus portent sur des écrans d'autres tranches).

## Outillage (pas l'application)

- `pilote api` échoue sur la pile Docker (« unable to get local issuer certificate ») : le Node du pilote ne connaît pas
  l'autorité locale de Caddy. Contournement utilisé : `NODE_EXTRA_CA_CERTS` pointant vers la racine de l'autorité locale de
  la pile (fichier de la pile lu, non modifié). À intégrer à `lancer.sh` ou au pilote.
- `cliquer` n'accepte pas le suffixe `##n` (boutons homonymes) ; les boutons radio en contrôle segmenté ne sont pas
  cliquables par rôle (`cliquer-texte` fonctionne) ; `touche Tab` dans un champ date et heure ne quitte pas le champ.
- Les fichiers Excel ont été relus avec un script de lecture local (session `rssi` ouverte par l'API, mêmes droits).

## État laissé pour la phase 2

Comptes : `rssi` (administrateur), `pilote.infra` (contributeur, TOTP enrôlé, mot de passe définitif = `PASSWORD` des tests) ;
secrets dans `tests/e2e/rssi-virtuel/.pilote-5/comptes.json` uniquement. Données : PRA (racine), PCRA validé (HDS), trois
exercices du registre et PL-EXO-001 réalisé, trois incidents (INC-2026-001 résolu avec RETEX généré, INC-2026-002 en cours
avec collecte close, INC-2026-003 demande), trois cellules de crise clôturées dont une réelle, un scénario de six actions,
deux contacts, trois documents (dont une v2) et un lien, un écran mural actif, un référentiel fictif « PSSI — exemple
fictif » dans le racine, un écart INC-AC-01 ouvert. Pile et Chrome laissés démarrés.
