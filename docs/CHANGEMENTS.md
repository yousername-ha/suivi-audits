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
