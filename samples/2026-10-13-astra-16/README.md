# Série 16 — application intégrée : habillage global « Référence 08 »

**13 octobre 2026 · branche `claude/audit-suivi-docker-github-0pfu4y` · application représentée : `05dadbb78e28858cb1d647a0b9af705a9038312b`.**

Contrairement aux séries 08 à 15 (maquettes, injections CSS en mémoire et dossiers de préparation), **ces 50 captures
montrent le code réellement intégré** : aucune feuille de style n’est ajoutée par le script de capture. Le serveur Python
et la base SQLite sont temporaires, les données sont fictives, aucune requête vers un site externe n’a été émise.

## Ce qui est intégré

- **Deux styles globaux** : `sage` (« Référence 08 — Sauge », défaut) et `clair` (« Clair bleuté »), choisis par un administrateur
  dans **Administration → Apparence** (destination `admin-appearance`) pour **tous les utilisateurs de l’instance**.
  Le mode personnel Clair / Sombre / Système reste distinct.
- **Configuration serveur** : table `appearance` (schéma SQLite 3, migration idempotente qui ne rétrograde jamais une base plus récente),
  `GET /api/appearance` (compte actif) et `PUT /api/admin/appearance` (administrateur, CSRF, révision optimiste, 409 en cas de conflit,
  422 si valeur invalide, trace d’audit avant/après).
- **Propagation** sans rechargement ni perte de saisie : interrogation toutes les 20 secondes pour les sessions visibles, relecture au
  retour au premier plan et à la reconnexion, dernier style connu conservé en cas de coupure (`localStorage`, par instance, sans
  valeur personnelle).
- **Identité** : bandeau de 78 px (monogramme, « Suivi des audits SMSI », signature typographique Normand’e-Santé, lien ouvert
  seulement sur clic avec `rel="noopener noreferrer"`), navigation de 275 px vert profond, filet et pictogramme actifs turquoise,
  petits **chevrons à droite** (fermé : droite ; ouvert : bas) avec `aria-expanded` / `aria-controls`.
- **Matrice des risques** : cases entièrement colorées (Faible vert, Modéré jaune, Élevé orange, Critique rouge) pour la politique
  standard à quatre niveaux ; politiques personnalisées et manuelles inchangées (voir limites).
- **Plans d’action** (6 vues) et **tâches récurrentes** (4 vues + fiche et historique) : moteurs inchangés, habillage commun ;
  le doublon de badge « En retard » des récurrences est supprimé.
- **Cartographies** (`carto`, `dash/map`) : aucun fichier cartographique modifié ; l’habillage, le bandeau et les décorations sont
  retirés avant leur rendu, y compris à la réception d’un nouveau style global.

## Les 50 images

| N° | Vue | Taille | Image |
| --- | --- | --- | --- |
| 01 | Cockpit RSSI · Sauge | 1600 × 1100 | [Ouvrir](images/001-dash-dash-sage.png) |
| 02 | Risques — Registre central · Sauge | 1600 × 1100 | [Ouvrir](images/002-risks-risk-register-sage.png) |
| 03 | Risques — Matrice des risques · Sauge | 1600 × 1100 | [Ouvrir](images/003-risks-risk-map-sage.png) |
| 04 | Risques — Études EBIOS RM · Sauge | 1600 × 1100 | [Ouvrir](images/004-risks-risk-studies-sage.png) |
| 05 | Conformité — Clauses ISO 27001 · Sauge | 1600 × 1100 | [Ouvrir](images/005-compliance-iso-sage.png) |
| 06 | Conformité — Annexe A (DdA) · Sauge | 1600 × 1100 | [Ouvrir](images/006-compliance-ann-sage.png) |
| 07 | Programme CaRE — Tableau de bord · Sauge | 1600 × 1100 | [Ouvrir](images/007-care-df-care-dash-sage.png) |
| 08 | Qualité · HAS — Tableau de bord · Sauge | 1600 × 1100 | [Ouvrir](images/008-has-df-has-dash-sage.png) |
| 09 | Gestion de l’audit — Pronostic · Sauge | 1600 × 1100 | [Ouvrir](images/009-audit-cibles-sage.png) |
| 10 | Preuves — Registre · Sauge | 1600 × 1100 | [Ouvrir](images/010-proofs-prv-reg-sage.png) |
| 11 | PCRA — Vue d’ensemble · Sauge | 1600 × 1100 | [Ouvrir](images/011-pcra-pcra-dashboard-sage.png) |
| 12 | PCRA — Analyses d’impact · Sauge | 1600 × 1100 | [Ouvrir](images/012-pcra-pcra-bias-sage.png) |
| 13 | Périmètres — Organisations et établissements · Sauge | 1600 × 1100 | [Ouvrir](images/013-perimeters-perimeter-registry-sage.png) |
| 14 | Fournisseurs et applications · Sauge | 1600 × 1100 | [Ouvrir](images/014-suppliers-sup-sage.png) |
| 15 | Administration — Vue d’ensemble · Sauge | 1600 × 1100 | [Ouvrir](images/015-admin-admin-overview-sage.png) |
| 16 | Programmes — Formation · Sauge | 1600 × 1100 | [Ouvrir](images/016-programs-pl-formation-sage.png) |
| 17 | Incidents — Registre · Sauge | 1600 × 1100 | [Ouvrir](images/017-ops-inc-reg-sage.png) |
| 18 | Gouvernance de l’IA — Registre · Sauge | 1600 × 1100 | [Ouvrir](images/018-ai-reg-sage.png) |
| 19 | Contexte — Parties intéressées · Sauge | 1600 × 1100 | [Ouvrir](images/019-context-ctx-pi-sage.png) |
| 20 | Plans d’action — Liste · Sauge | 1600 × 1100 | [Ouvrir](images/020-actions-list-sage.png) |
| 21 | Plans d’action — Kanban · Sauge | 1600 × 1100 | [Ouvrir](images/021-actions-kanban-sage.png) |
| 22 | Plans d’action — Planning · Sauge | 1600 × 1100 | [Ouvrir](images/022-actions-planning-sage.png) |
| 23 | Plans d’action — Calendrier · Sauge | 1600 × 1100 | [Ouvrir](images/023-actions-calendar-sage.png) |
| 24 | Plans d’action — Gantt · Sauge | 1600 × 1100 | [Ouvrir](images/024-actions-gantt-sage.png) |
| 25 | Plans d’action — Synthèse · Sauge | 1600 × 1100 | [Ouvrir](images/025-actions-summary-sage.png) |
| 26 | Tâches récurrentes — Liste · Sauge | 1600 × 1100 | [Ouvrir](images/026-recurring-list-sage.png) |
| 27 | Tâches récurrentes — Kanban · Sauge | 1600 × 1100 | [Ouvrir](images/027-recurring-kanban-sage.png) |
| 28 | Tâches récurrentes — Planning · Sauge | 1600 × 1100 | [Ouvrir](images/028-recurring-planning-sage.png) |
| 29 | Tâches récurrentes — Calendrier · Sauge | 1600 × 1100 | [Ouvrir](images/029-recurring-calendar-sage.png) |
| 30 | Tâches récurrentes — Fiche et historique · Sauge | 1600 × 1100 | [Ouvrir](images/030-recurring-fiche-historique-sage.png) |
| 31 | Administration → Apparence — enregistré pour tous : Sauge | 1600 × 1100 | [Ouvrir](images/031-admin-appearance-enregistre.png) |
| 32 | Administration → Apparence — aperçu non enregistré : Clair bleuté | 1600 × 1100 | [Ouvrir](images/032-admin-appearance-apercu-clair.png) |
| 33 | Administration → Apparence — enregistré pour tous : Clair bleuté (révision 2) | 1600 × 1100 | [Ouvrir](images/033-admin-appearance-enregistre-clair.png) |
| 34 | Clair bleuté — dash-dash | 1600 × 1100 | [Ouvrir](images/034-dash-dash-clair.png) |
| 35 | Clair bleuté — risks-risk-map | 1600 × 1100 | [Ouvrir](images/035-risks-risk-map-clair.png) |
| 36 | Clair bleuté — actions-kanban | 1600 × 1100 | [Ouvrir](images/036-actions-kanban-clair.png) |
| 37 | Clair bleuté — recurring-list | 1600 × 1100 | [Ouvrir](images/037-recurring-list-clair.png) |
| 38 | Mode sombre — dash-dash | 1600 × 1100 | [Ouvrir](images/038-dash-dash-sombre.png) |
| 39 | Mode sombre — risks-risk-map | 1600 × 1100 | [Ouvrir](images/039-risks-risk-map-sombre.png) |
| 40 | Largeur 390 px — dash-dash | 390 × 844 | [Ouvrir](images/040-dash-dash-390.png) |
| 41 | Largeur 390 px — risks-risk-map | 390 × 844 | [Ouvrir](images/041-risks-risk-map-390.png) |
| 42 | Largeur 768 px — dash-dash | 768 × 1024 | [Ouvrir](images/042-dash-dash-768.png) |
| 43 | Largeur 768 px — risks-risk-map | 768 × 1024 | [Ouvrir](images/043-risks-risk-map-768.png) |
| 44 | Largeur 1440 px — dash-dash | 1440 × 900 | [Ouvrir](images/044-dash-dash-1440.png) |
| 45 | Largeur 1440 px — risks-risk-map | 1440 × 900 | [Ouvrir](images/045-risks-risk-map-1440.png) |
| 46 | Largeur 1920 px — dash-dash | 1920 × 1080 | [Ouvrir](images/046-dash-dash-1920.png) |
| 47 | Largeur 1920 px — risks-risk-map | 1920 × 1080 | [Ouvrir](images/047-risks-risk-map-1920.png) |
| 48 | Cartographie protégée, sans habillage — carto-context | 1600 × 1100 | [Ouvrir](images/048-carto-context-protegee.png) |
| 49 | Cartographie protégée, sans habillage — carto-process | 1600 × 1100 | [Ouvrir](images/049-carto-process-protegee.png) |
| 50 | Cartographie protégée, sans habillage — dash-map | 1600 × 1100 | [Ouvrir](images/050-dash-map-protegee.png) |

Planche d’ensemble : [PLANCHE-CONTACT.jpg](PLANCHE-CONTACT.jpg) · [Galerie hors ligne](index.html).

## Vérifications réellement exécutées

Voir [recette/apparence-globale.md](../../recette/apparence-globale.md) pour les commandes, résultats et limites. En bref : tests unitaires
Node (55) et Python (41, dont 10 nouveaux sur le contrat d’apparence et la migration), recette ASTRA existante (16 contrôles),
nouvelle recette navigateur de l’habillage (16 contrôles), comparaison avant / après des trois routes cartographiques
([technique/cartographies-avant-apres.json](technique/cartographies-avant-apres.json)), 15 contrôles de capture
([technique/verification.json](technique/verification.json)).

## Limites

- Cinq anciens parcours (`browser-carto`, `browser-interface`, `browser-risks`, `browser-refonte`, `browser`) échouent **de la même façon
  avant et après** cette série (attentes périmées sur l’ancien menu, serveur à lancer à la main) : ils ne sont pas imputables à l’habillage.
- Les vérifications d’accessibilité sont des mesures de contraste et de structure (recette navigateur) ; aucun lecteur d’écran
  ni audit humain n’a été utilisé.
- Après navigation depuis un écran habillé vers une cartographie, **28 pixels de bord diffèrent d’un niveau sur 255** par rapport à
  l’état d’origine alors que les 435 styles calculés et toutes les mesures sont identiques ; l’accès direct et toutes les interactions
  (zoom, déplacement, sélection, ajustement) sont identiques au pixel près.
- Le rouge du niveau « Critique » est assombri (`#E5192F` au lieu de `#FF293F`) : le libellé blanc passe ainsi de 3,72:1 à 4,65:1.
