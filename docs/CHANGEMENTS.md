# Refonte Legacy — 11 octobre 2026

Phases réalisées dans l’ordre demandé : diagnostic préalable, fondations,
parcours, CaRE D2/preuves financières, PCRA, navigation, recette.

- Registre hiérarchique des périmètres, GHT/établissements, FINESS adapté au type,
  SI mutualisés, contexte GHT/établissement et consolidation sans doublons.
- Rôles existants conservés, IDs stables et responsables par périmètre ; distinction
  entre rôle fonctionnel, titulaire et compte d’authentification.
- Serveur Python local sans nouvelle dépendance, SQLite, comptes, sessions, CSRF,
  droits serveur, pièces immuables, version optimiste et journal des modifications.
- Parcours adapté depuis les sources existantes : étapes, sous-tâches, dépendances,
  actions centrales idempotentes, données réelles, preuves et validations humaines.
- CaRE D2 : 13 références officielles identifiées, critères et preuves extraits
  du PDF effectivement contrôlé ; avertissement sur sa version contradictoire.
- Justificatifs comptables dans les preuves centrales, HT/TTC en centimes,
  versions physiques protégées et rattachements aux budgets, objectifs et actions.
- BIA avec activités et impacts temporels selon une politique versionnée, besoins
  métier, interruption maximale et objectifs RTO/RPO ; PCA/PRA liés, révision après
  évolution du BIA, exercices/RETEX et actions correctives centrales.
- Vues PCRA des actions et documents partagés ; rapports PDF et Excel avec BIA,
  plans, exercices, actions et références précises des preuves.
- Menu allégé, fonds neutres, accents Sauge, groupes repliables, clavier, mobile
  et thème sombre, avec conservation des anciennes rubriques.
- Sauvegarde/restauration métier avec pièces ; migration explicite depuis les
  données navigateur ; comptes préservés via sauvegarde du dossier privé.

Liste des fichiers, modèle et API : [REFONTE-LEGACY.md](REFONTE-LEGACY.md).
Résultats actuels : [RECETTE-REFONTE.md](RECETTE-REFONTE.md).
Limites et décisions de politique : [SOURCES-ET-LIMITES.md](SOURCES-ET-LIMITES.md).

La publication se limite à `legacy/test-lots-d-f`, déjà autorisée pour les tests.
Les 592 fichiers suivis de la copie de l’application source sont conservés. Les
lots I/J restent exclus. Aucun changement de main ou de l’application moderne.

---

## Historique : livraison locale initiale, avant autorisation de publication

# Livraison 1.0.0-local-df — 11 octobre 2026

Périmètre validé : **D CaRE** et **F HAS + mode auditeur**, sur une copie locale.
Les lots I et J ont été retirés avant développement.

## Modifications

- Diagnostic préalable de la closure legacy, du schéma 15 et des registres partagés.
- Deux rubriques dans le menu existant, avec onglets accessibles sur les petits écrans.
- Moteur commun de dossiers et évaluations versionnés, périmètres, responsables,
  échéances, applicabilité justifiée, mesures et actions réutilisées.
- Suivi CaRE de cinq domaines ; guide D1 identifié et imports versionnés pour
  les sources complémentaires ; distinction explicite des objectifs locaux.
- Budgets, dépenses et financements séparés, arithmétique en centimes, justificatifs
  et historique des montants.
- Catalogue HAS établissements de santé 2025 : 118 critères sourcés, 21 impératifs,
  avec filtres, pagination et lien vers chaque fiche officielle.
- Dépôt de pièces, classification, SHA-256, versions et vérifications internes
  dans le registre des preuves existant.
- Exports Excel, rapports/PDF et sauvegarde ZIP complète ; téléchargement adapté
  au navigateur local, bibliothèques existantes chargées localement.
- Dossier auditeur autonome avec sélection vide initiale et confirmation de portée,
  preuves précisément filtrées, observations distinctes, rapports et retour contrôlé.
- Restauration contrôlée avant écriture, garde lecture seule, refus des imports
  incohérents, des chemins d’archive dangereux et des liens non HTTP/HTTPS.
- Guides d’utilisation, sources et limites, architecture, tests et captures.

## Conservation

Le travail a été réalisé dans `/workspace/legacy-local-d-f`, extérieur au dépôt.
Les 592 fichiers suivis du dépôt source sont contrôlés par SHA-256 avant livraison.
Aucun commit, push, changement de branche, PR, déploiement ou modification GitHub
n’est effectué pour cette livraison. Les nouvelles données initiales sont vides ;
seuls les catalogues documentaires sont fournis.

Les limites de sources et de la version locale sont détaillées dans
`SOURCES-ET-LIMITES.md`, `MODE-AUDITEUR.md` et `ARCHITECTURE.md`.
