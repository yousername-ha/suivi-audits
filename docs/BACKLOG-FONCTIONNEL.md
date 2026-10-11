# Backlog fonctionnel — retours du RSSI (07/10/2026)

> Chaque exigence porte un identifiant (`CRRC-01`…), à citer dans les commits et les PR qui la traitent.
> Ces exigences s'appliquent à la **refonte**. Elles s'ajoutent aux phases indiquées dans `docs/ROADMAP.md`.

---

## 1. CRRC — les offres présentées comme un catalogue  *(phase 3)*

**Constat :** aujourd'hui, l'onglet mélange le CRRC et la sauvegarde. Or le CRRC propose **plusieurs offres**, et la sauvegarde n'est que **l'une d'elles**.

### CRRC-01 — Menu « CRRC » organisé autour d'un catalogue d'offres
- La page d'accueil du CRRC présente le **catalogue des offres** sous forme de cartes : nom, résumé en une ligne, statut de l'offre (En étude, Pilote, Disponible, Arrêtée), nombre d'établissements « en run », et lien vers l'offre.
- Chaque offre dispose de **ses propres onglets** :
  - Présentation et convention ;
  - Établissements et carte ;
  - Suivi ;
  - Indicateurs ;
  - Documents.
- **Modèle générique** : ajouter une nouvelle offre ne nécessite **aucun développement**. Un administrateur crée l'offre, puis renseigne son résumé, sa convention et ses tarifs.
- La sauvegarde est la **première offre** du catalogue. Ses données actuelles sont reprises par l'import legacy.

### CRRC-02 — Onglet « Convention et offre »
- **Convention officielle :**
  - dépôt du document signé (PDF), avec gestion des versions : la version en vigueur est mise en avant, les précédentes restent consultables ;
  - date de signature, date d'effet, durée et date d'échéance (alerte 90 jours avant) ;
  - signataires.
- **Résumé de l'offre**, en une page lisible par un directeur d'établissement :
  - objet et bénéfices, en 5 lignes au maximum ;
  - **grandes lignes techniques** : architecture, localisation des données, durées de rétention, immuabilité, chiffrement, fréquence, objectifs de reprise (RPO et RTO), prérequis côté établissement ;
  - **volumes et quantités** : volumétrie incluse, unités de facturation (To, Go, licence, établissement…), seuils ;
  - **tarifs en euros** : frais de mise en service, abonnement mensuel ou annuel, prix unitaire au-delà du forfait, mention HT/TTC, date de validité de la grille ;
  - engagements de service : niveaux de service, support, horaires.
- Export de ce résumé en **PDF et Word**, aux couleurs du GCS, pour l'envoyer aux établissements.

### CRRC-03 — Statut d'un établissement pour une offre (simplification)
- **Suppression du suivi par ressource**, jugé trop détaillé.
- Pour chaque couple établissement × offre, **un seul statut de service** :

  | Statut | Signification |
  |---|---|
  | **Non délivré** | L'établissement n'a pas souscrit l'offre, ou elle ne lui est pas fournie |
  | **Non configuré** | Souscrit ou convention signée, mise en service non faite |
  | **En run** | Service en production |

- Champs associés :
  - date du dernier changement de statut ;
  - date de mise en run ;
  - commentaire ;
  - référent dans l'établissement.
- L'historique des changements de statut est conservé (qui, quand, ancien statut → nouveau statut).
- Filtres et compteurs par statut, et liste exportable.

### CRRC-04 — Carte des départements, réaliste et zoomable
- **Contours géographiques réels** des 5 départements normands (Calvados 14, Eure 27, Manche 50, Orne 61, Seine-Maritime 76). Sur demande, on peut ajouter les limites de communes ou d'EPCI.
  - Source : données ouvertes IGN (ADMIN EXPRESS) ou équivalent sous licence ouverte, simplifiées (mapshaper) et **embarquées dans l'application**. Pas d'appel à un service de cartes externe : la CSP reste stricte et l'outil fonctionne hors ligne.
  - Fond de carte en option, désactivé par défaut : les tuiles d'un service externe exposeraient les adresses IP et les zones consultées.
- Le rendu doit être soigné :
  - départements en aplat léger, avec la frontière littorale ;
  - chef-lieu et principales villes en repère discret ;
  - établissements placés à leurs **coordonnées réelles** (latitude et longitude, saisies ou obtenues à partir de l'adresse) ;
  - couleur selon le statut CRRC-03 ;
  - regroupement automatique des points proches selon le niveau de zoom.
- Interaction :
  - **zoom** à la molette, par pincement sur mobile et avec des boutons + et − ;
  - **déplacement** à la souris ou au doigt ;
  - double-clic sur un département pour zoomer dessus ;
  - bouton « Vue d'ensemble ».
  - Au survol d'un établissement : nom, type et statut. Au clic : fiche de l'établissement dans le panneau latéral.
- Légende des statuts, filtres par statut, par département et par type d'établissement, et compteurs par département.
- Adaptation à l'écran : la carte occupe toute la place disponible, jusqu'au 4K, avec la liste à côté sur grand écran.
- Export de la carte en PNG ou en SVG pour le COPIL et les présentations.

---

## 2. Pilotage  *(phase 2)*

*Aucun retour pour l'instant : à compléter.*

---

## 3. Investissements  *(phase 3)*

### INV-01 — Filtres cumulables, en haut de la liste
- Une **barre de filtres placée en haut** de la liste, toujours visible au défilement. Les filtres **se cumulent** : entre filtres différents, la condition est « ET » ; à l'intérieur d'un même filtre à choix multiple, elle est « OU ».
- Filtres :
  - année ;
  - statut ;
  - priorité ;
  - type ;
  - entreprise ou fournisseur ;
  - plage de montant ;
  - plage d'échéance ;
  - texte libre.
- Chaque filtre actif s'affiche sous forme de **puce** que l'on peut retirer d'un clic. Un bouton « Tout effacer » et un compteur « X lignes sur Y » complètent la barre.
- Les filtres sont **mémorisés dans l'adresse de la page**, donc partageables, et en option dans les préférences de l'utilisateur. Des **vues enregistrées** sont possibles, par exemple « 2027 – Prévisionnel – Priorité 1 ».
- Les totaux affichés (montants, nombre de lignes) tiennent compte des filtres en cours.

### INV-02 — Page « Prospection »
- Une nouvelle page, **identique dans le style** à la liste des investissements : même tableau, mêmes filtres cumulables, même fiche latérale.
- Une ligne de prospection contient :
  - la solution ou le service ;
  - l'entreprise ;
  - le besoin couvert ;
  - la mesure ou le risque adressé, avec un lien vers les mesures ISO 27001 ;
  - l'étape (Veille, Contact, Démonstration, Devis, Évaluation, Décision) ;
  - la priorité ;
  - le budget estimé ;
  - l'échéance de décision ;
  - le contact ;
  - la prochaine action et sa date ;
  - les documents (plaquette, devis).
- Une vue **Kanban par étape**, en complément du tableau.
- Une action **« Convertir en investissement »**, qui crée la ligne d'investissement préremplie et conserve le lien vers la prospection d'origine.

---

## 4. Incidents, PCA/PRA, événements de sécurité  *(phase 3)*

### INC-01 — Deux menus distincts
- **Menu « Incidents »** : registre des incidents, qualification, gestion de crise, retours d'expérience, déclarations (ANSSI, CERT Santé, CNIL, ARS) avec leurs échéances.
- **Menu « PCA / PRA »** :
  - plans de continuité et de reprise, par activité et par système d'information, avec leur document (gestion des versions) ;
  - objectifs RTO et RPO, et niveau de criticité ;
  - **exercices** : date, scénario, participants, résultat, écarts constatés, actions ;
  - prochaine échéance de test, avec une alerte ;
  - lien avec les sauvegardes CRRC et avec les mesures ISO 27001 A.5.29, A.5.30 et A.8.13.

### INC-02 — Suivi mensuel des événements et alertes
- **Saisie mensuelle** du nombre d'événements et d'alertes, sur deux axes :
  - **Cyber** : alertes SOC ou SIEM, hameçonnage signalé, logiciels malveillants bloqués, tentatives d'intrusion, vulnérabilités critiques…
  - **IT** : pannes, indisponibilités, incidents d'exploitation…

  Les catégories sont paramétrables dans les Paramètres.
- Saisie rapide dans une grille catégories × mois, avec import CSV possible. Les incidents du registre sont **comptés automatiquement** dans leur mois et leur catégorie.
- Visualisations :
  - **camemberts** de la répartition du mois par catégorie (un pour le cyber, un pour l'IT). Au-delà de 5 à 6 catégories, les plus petites sont regroupées en « Autres » pour rester lisibles ;
  - **évolution sur 12 mois** en barres empilées, avec comparaison au même mois de l'année précédente ;
  - indicateurs clés : total du mois, variation par rapport au mois précédent, part du cyber par rapport à l'IT.
- Ces chiffres peuvent alimenter les **indicateurs du pilotage SMSI** (objectifs et indicateurs).

### INC-03 — Alimentation automatique du COMSEC
- Lors de la génération du compte rendu du **COMSEC** (modèle Word existant de l'outil), la section « Événements et incidents de la période » est **remplie automatiquement** :
  - les chiffres du mois ou de la période du comité ;
  - les camemberts et l'évolution sur 12 mois, en images insérées ;
  - la liste des incidents significatifs ;
  - l'état des exercices PCA/PRA.
- La période est choisie au moment de la génération. Les valeurs restent modifiables avant l'export.

---

## 5. Exploitation — données sur le serveur et mises à jour  *(phase 0, chantier 9 quinquies)*

Spécification détaillée : [specs/EXPL-donnees-et-mises-a-jour.md](specs/EXPL-donnees-et-mises-a-jour.md) (demande du RSSI du 08/10/2026).

- **EXPL-01** — Toutes les données dans un dossier du serveur (`DATA_DIR`, par défaut `/srv/suivi-audits/donnees`), en montages bind avec les bons propriétaires et droits ; plus aucun volume nommé ; données intactes après suppression des conteneurs, des images ou `docker compose down -v` (test CI).
- **EXPL-02** — Script de passage des volumes nommés vers `DATA_DIR` (sauvegarde préalable, copie avec droits, contrôles, bascule) ; anciens volumes conservés jusqu'à confirmation ; idempotent ; testé en CI.
- **EXPL-03** — Script `scripts/mettre-a-jour.sh` : contrôles, notes de mise à jour, sauvegarde chiffrée obligatoire, signature des images, migrations sous verrou, contrôle de santé, retour arrière automatique (avec restauration si la base a été migrée), rapport et journal d'audit ; mode `--verifier`.
- **EXPL-04** — Compatibilité entre versions : migrations en avant uniquement, changements destructifs en deux versions, `GET /api/version`, test CI de montée depuis la dernière version publiée avec retour arrière simulé.
- **EXPL-05** — Administration > Système : version, historique des mises à jour, dernière sauvegarde (alerte au-delà de 48 h), espace disque, bandeau « nouvelle version disponible » alimenté par un script planifié sur le serveur (aucune installation automatique).
- **EXPL-06** — L'outil historique fait partie de l'image : mis à jour par une version publiée, jamais par copie sur le serveur.
- **EXPL-07** — Publication d'une version : images signées, SBOM, page de release avec un paragraphe « Notes de mise à jour » obligatoire.
- **EXPL-08** — Sauvegarde et restauration lisent `DATA_DIR`, recréent les dossiers avec les bons droits et écrivent un rapport dans `DATA_DIR/etat/`.
- **EXPL-09** — Guide d'installation : création de `DATA_DIR`, mise à jour par script, retour arrière, passage depuis les volumes nommés, sauvegarde externalisée ; rejoué en CI, mise à jour comprise.

---

## 6. Cartographie du SMSI  *(chantier « Cartographie », après 9 quinquies)*

Spécification détaillée : [cartographie/SPEC-CARTOGRAPHIE-V3.md](cartographie/SPEC-CARTOGRAPHIE-V3.md) ; recette : [cartographie/RECETTE.md](cartographie/RECETTE.md) ; référence de comportement : le module bêta de l'outil historique validé le 08/10/2026 (`cartographie/reference-beta-legacy/`).

- **CARTO-01** — Module de droits `cartographie` (lire, modifier, supprimer, exporter, administrer) ; lecture seule réelle ; objets filtrés selon les droits de leur module d'origine.
- **CARTO-02** — Source des objets par adaptateur (état legacy recomposé, puis tables des modules repris), `objectRef` stables, relations métier dérivées.
- **CARTO-03** — Tables `maps` et `map_versions`, disposition validée par `MapLayoutSchema` (zod).
- **CARTO-04** — API (`/api/carto/...`) avec `If-Match` et 412, temps réel SSE, présence, journal d'audit.
- **CARTO-05** — Génération assistée (vue contexte, vue processus), dispositions en fonctions pures, confirmation au-delà de 80 objets, refus au-delà de 400.
- **CARTO-06** — Canevas SVG sans nouvelle dépendance : zoom, panoramique, aperçu, recherche, préréglages, filtres ISO 27001 / HDS, légende.
- **CARTO-07** — Mode édition : déplacer, redimensionner, relier, masquer, retirer, annuler et rétablir (60 niveaux), enregistrement explicite, conflit 412.
- **CARTO-08** — Synchronisation : bandeaux « nouveaux objets » et « objets indisponibles », jamais d'ajout ni de déplacement automatique.
- **CARTO-09** — Ajout depuis la plateforme (seul, dépendances directes, tous les objets liés), placement sans chevauchement.
- **CARTO-10** — Fiche détaillée (inspecteur) par type d'objet et de relation, avec liens vers les écrans des modules.
- **CARTO-11** — Versions nommées (20 au plus par carte), restauration, suppression.
- **CARTO-12** — Nature des enjeux (interne / externe) déduite et corrigeable.
- **CARTO-13** — Exports PNG, SVG, PDF A3, JSON, avec titre, date et légende ; journalisés.
- **CARTO-14** — Reprise de `S.maps` par l'import legacy (mapper « maps ») ; `/legacy` en lecture seule pour la cartographie une fois reprise.

Construire une carte de zéro (demande du RSSI du 08/10/2026, [spécification](cartographie/SPEC-EDITION-LIBRE.md), ADR 0026, validée le 08/10/2026) :
- **CARTO-15** — Créer depuis la carte un objet de la plateforme (partie intéressée, fournisseur, application, enjeu, site, système, processus, sous-processus), enregistré dans son module, avec la permission de ce module.
- **CARTO-16** — Menu contextuel : clic droit, appui long, Maj+F10 ; sur le fond, un objet, une relation, une sélection (créer ici, relier, aligner, répartir, grouper, retirer…).
- **CARTO-17** — Palette en glisser-déposer : types créables, notes, cadres, objets de la plateforme non placés.
- **CARTO-18** — Renommer depuis la carte (modifie le module d'origine) ; aucune suppression d'un objet de la plateforme depuis la carte.
- **CARTO-19** — Notes et cadres libres propres à la carte ; « Partir de zéro » (carte vierge).

---

## 7. Audit — préparation, couverture, écarts, plan d'audit  *(phase 1)*

Spécification détaillée : [audit/SPEC-AUDIT-V3.md](audit/SPEC-AUDIT-V3.md) ; recette : [audit/RECETTE.md](audit/RECETTE.md) ; ADR 0025 (validée le 08/10/2026 avec les défauts du § 6 de la spécification).

- **AUD-01** — Droits par les modules existants `audit`, `ecarts`, `plan_audit` ; cycle et référentiels en `audit:administrer` ; lecture seule réelle.
- **AUD-02** — Cycle de certification en table : années, libellés, année N, dates des audits, échéance de clôture (report sur les écarts concernés), ajout et suppression d'une année vide.
- **AUD-03** — Référentiels en tables (clauses ISO 27001, Annexe A, HDS ; identifiants stables, versions), guide des preuves et questions types.
- **AUD-04** — Couverture AFNOR et interne par exigence et par année ; préparation, pilote et notes **par année** (reprise de l'année précédente).
- **AUD-05** — Pronostic porté à l'identique en fonction pure partagée, testé en parité avec l'outil historique.
- **AUD-06** — Écran « Préparation de l'audit » : bandeau (compte à rebours, frise, faits), carte des pastilles à 3 lentilles, exigences à préparer.
- **AUD-07** — Écran « Couverture du cycle » : tableau exigences × années, filtres mémorisés, badges d'écarts.
- **AUD-08** — Fiche exigence : pronostic expliqué, historique, écarts, créneaux, guide, préparation.
- **AUD-09** — Registre des écarts en tables (exigences liées, tâches) ; filtres année et pilote ; clôture datée et signée ; réouverture avec motif ; `If-Match` par écart.
- **AUD-10** — Plan d'actions transversal ; échéance et pilote facultatifs par tâche.
- **AUD-11** — Plan d'audit **par année** : jours, créneaux, participants, preuves, questions (identifiant stable) ; Déroulé, Planning, Participants ; alerte « ciblées sans créneau ».
- **AUD-12** — Synthèse : cartes et graphiques SVG (anneau des écarts ouverts, couverture du cycle, conformité par référentiel), alternative textuelle.
- **AUD-13** — Imports PRM02 et Tenacy avec simulation, application exacte et annulation, lecteur Excel sans dépendance.
- **AUD-14** — Exports Excel (rapport, modèle réimportable, Tenacy), CSV, impression du plan et de la fiche écart.
- **AUD-15** — Reprise legacy (mappers, contrat complété) ; passerelle d'ajout des écarts créés par les modules restés dans l'outil historique.
- **AUD-16** — Temps réel et présence, journal d'audit, performances (157 exigences × 4 années, 500 écarts).

---

## 8. Interface — retours du premier essai  *(transverse, demande du RSSI du 08/10/2026)*

- **UI-01** — Affichage plus compact par défaut : la taille « Auto » grossit trop sur les grands écrans ; revoir la taille et la densité par défaut de l'organisation (sans toucher aux préférences déjà choisies), et la hauteur des en-têtes et des cartes.
- **UI-02** — Graphiques de la synthèse comme dans l'outil historique : anneaux et histogrammes (empilés, à 100 %) en composants SVG de `packages/ui`, sans dépendance, jetons clair et sombre, contrastes AA, alternative textuelle ; utilisés d'abord par AUD-12, puis par les modules suivants.
- **UI-03** — Revue graphique d'ensemble après la phase 1 (espacements, hiérarchie des titres, densité des tableaux), avec mise à jour des captures de référence.

---

## 9. Gestion des risques — EBIOS RM et ISO/IEC 27005  *(lot U3 de l'unification)*

Spécification : [risques/SPEC-RISQUES-V3.md](risques/SPEC-RISQUES-V3.md) ; ADR 0027. Démarches *inspirées* des méthodes, sans conformité revendiquée.

- **RISK-01** — Étude EBIOS RM (`risk_study`) : objet, périmètre, participants, période, socle de sécurité.
- **RISK-02** — Atelier 1 : valeurs métier, biens supports, événements redoutés gradués (gravité 1 à 4).
- **RISK-03** — Atelier 2 : sources de risque et couples source de risque / objectif visé (`sr_ov`), retenus et justifiés.
- **RISK-04** — Atelier 3 : parties prenantes de l'écosystème (`ecosystem_party`, indice de menace) et scénarios stratégiques (gravité proposée).
- **RISK-05** — Atelier 4 : scénarios opérationnels (biens supports visés, vraisemblance) ; « Créer le risque » avec filiation.
- **RISK-06** — Atelier 5 et matrice gravité × vraisemblance ; validation de chaque atelier dans l'ordre, décision tracée (`pilotage:administrer`).
- **RISK-07** — Fiche de risque ISO/IEC 27005 : actifs ou processus, menace, vulnérabilité, conséquences ; appréciations brut et résiduel existantes.
- **RISK-08** — Acceptation formelle : décision immuable (responsable, date, conditions, échéance), état « à décider / acceptée / refusée / échue ».
- **RISK-09** — Registre commun : niveaux, option, acceptation, revue, filtres côté serveur (démarche, option, acceptation, retard, étude).
- **RISK-10** — Références typées vérifiées par le serveur (type, périmètre, droit de lecture) ; sélecteur filtré par cible.

---

## Critères d'acceptation communs
- Respect de la charte graphique et de l'adaptation à tous les écrans (sections 9 ter et 9 quater du prompt de la phase 0).
- Droits RBAC appliqués à chaque nouveau module : CRRC, Prospection, Incidents, PCA/PRA, Événements, Cartographie.
- Import legacy :
  - reprise des données CRRC existantes (offres, établissements, statuts convertis vers CRRC-03), des investissements et des incidents ;
  - conversion du suivi par ressource vers le statut unique, documentée dans `MAPPING-LEGACY.md`.
- Tests Playwright pour chaque parcours principal, et captures de référence à 390, 1920 et 3840 px.
