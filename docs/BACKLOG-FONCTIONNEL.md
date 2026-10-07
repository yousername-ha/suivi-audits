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

## Critères d'acceptation communs
- Respect de la charte graphique et de l'adaptation à tous les écrans (sections 9 ter et 9 quater du prompt de la phase 0).
- Droits RBAC appliqués à chaque nouveau module : CRRC, Prospection, Incidents, PCA/PRA, Événements.
- Import legacy :
  - reprise des données CRRC existantes (offres, établissements, statuts convertis vers CRRC-03), des investissements et des incidents ;
  - conversion du suivi par ressource vers le statut unique, documentée dans `MAPPING-LEGACY.md`.
- Tests Playwright pour chaque parcours principal, et captures de référence à 390, 1920 et 3840 px.
