# Prompt prêt à copier dans l’IA qui code

Tu travailles dans le dépôt de l’application Suivi des audits. Implémente la refonte décrite dans
`docs/refonte-neon/implementation-interface-2026-11-21/` directement dans l’application existante.

Lis d’abord `AGENTS.md`, `HANDOVER.md`, `PROJECT_STATUS.md`, puis le README de ce dossier, `REGLES-UI.md` et
`INTEGRATION-ET-RECETTE.md`. Respecte les règles du dépôt, ses branches et les signatures de session.

**Avant de modifier le code**, compare l’existant aux composants et captures fournis. L’application du RSSI peut être
plus récente ou différente du prototype : liste ce qui est présent, partiel, absent ou différent avec les fichiers
concernés. Réutilise les implémentations déjà présentes ; ne recopie pas des fichiers entiers sans examiner les écarts.
Poursuis ensuite le travail nécessaire dans une branche dédiée, avec une PR vers `claude-suivi-smsi`.

La branche source du dossier est `codex/refonte-densite-2026-11-21`, dans le dépôt `yousername-ha/suivi-audits`.
Si ces documents sont absents de ta branche, consulte-les sur GitHub ou lis cette référence séparément ; ne remplace pas
ta version de travail par une ancienne archive. Les rapports des anciens lots restent datés : les dernières règles de
ce dossier remplacent leurs anciennes décisions contradictoires. Ne réintroduis pas de module retiré à partir d’une image.

## Résultat à obtenir

1. **Densité** : le mode normal doit être moins volumineux que l’ancien compact ; le compact doit réduire encore
   l’encombrement. Revoir composition, espacements, commandes et hiérarchie, sans rendre les textes minuscules. Conserver
   Lexend, les réglages explicites de taille et le mode mural. Adapter les écrans de travail de 1280 px au 4K.
2. **Outils communs** : mêmes petits boutons de vues, même recherche et même entonnoir dans une boîte en verre aux
   couleurs du menu. Conserver noms accessibles et infobulles ; les critères se rangent dans le panneau. Préserver leurs
   valeurs, callbacks, contraintes, références, raccourcis et formulaire. Le thème clair/sombre se commande par une icône.
3. **Proportions** : aligner les libellés et saisies à gauche. Placer les aides sous les champs pour éviter les décalages
   entre colonnes. Les codes, dates, états et responsables n’ont pas la largeur d’un nom ou d’une description. Les menus
   de choix restent bornés à l’écran, avec retour à la ligne des options longues. Ne pas couper une information utile.
4. **Toutes les fiches doivent tenir à l’écran sans défilement vertical de la fenêtre.** Si le contenu ne tient pas,
   afficher un mini-menu compact dans la fiche, par exemple Informations / Analyse / Liens et preuves. Garder titre,
   fermeture et actions accessibles. Ne pas résoudre ce besoin en masquant simplement le débordement. Toutes les
   informations, lignes et commandes doivent rester atteignables dans une partie. Garder ensemble libellé, champ, aide,
   et les groupes cohérents de certificats/contrôles. Adapter le découpage à la taille disponible.
5. **État des formulaires** : changer de partie ne doit ni vider une saisie, ni perdre une preuve, ni démonter un champ
   qui doit conserver son état, ni modifier son formulaire propriétaire. Un champ invalide ou une erreur doit être
   visible dans la bonne partie. Vérifier clavier, redimensionnement, ajout de lignes, tableaux longs et fermeture.
6. **Boutons** : remplacer les gros fonds violets par des commandes fines à fond transparent, contour bleu/cyan inspiré
   du menu et de la page de maintenance. Enregistrer est une commande en contour ; Annuler est neutre et discret ; les
   actions sensibles explicitement rouges restent rouges. Préserver les états désactivés, chargements, soumissions et
   callbacks. Les couleurs métier vert/orange/rouge des états, scores et indicateurs doivent rester compréhensibles.
7. **Identité** : conserver le thème Neon retenu, avec accents cyan et violet mesurés, verre discret, contours lisibles
   et animations légères. Préserver SWOT, PESTEL, DDA, Dashboard, assistant RSSI et leurs comportements. Préserver la
   génération automatique et l’organisation visuelle de la cartographie SMSI.

Le prototype `FichesSansDefilement.tsx` et sa feuille CSS sont une base d’intégration, pas une preuve que chaque fiche de
ta version est terminée. Tu peux retenir une autre organisation interne si elle satisfait ces règles sans régression.
Corrige les limites connues décrites dans le guide : groupes coupés, parties presque vides et intitulés de menu répétés.
Vérifie notamment les tableaux et structures qui empêchent une fragmentation normale. Ne conserve aucune solution qui
cache des champs, crée des parties vides ou laisse des boutons hors de la fenêtre.

## Validation et livraison

- Vérifier clair/sombre et normal/compact, au minimum à 1280×720, 1440×900, 1920×1080 et sur grand écran. Le téléphone
  n’est pas prioritaire dans cette demande. Vérifier les données longues et nombreuses, les menus ouverts, le focus,
  les saisies conservées, l’accès aux erreurs et les actions fixes.
- Exécuter les contrôles pertinents du dépôt. Relever commandes, codes retour et portée exacte. Une compilation des
  specs E2E n’est pas leur exécution ; une API simulée ne valide pas la base ou le serveur.
- Produire des captures réelles, en résolution native, pour la validation visuelle du RSSI. Si tu changes la proposition
  graphique, présente le visuel avant de généraliser cette nouvelle direction. Ne simule aucune validation humaine et
  n’approuve pas automatiquement les références visuelles de CI.
- Préserver API, authentification, droits, périmètres, concurrence/versionnement, SSE, calculs, documents, exports et
  données. Aucune fixture, fausse session ou désactivation de connexion dans le produit. Aucune nouvelle dépendance
  sans appliquer les règles du dépôt.
- Fournir un résumé technique exploitable par une autre IA : fichiers, composants communs, décisions, invariants,
  tests effectués, limites et prochaine action précise. Actualiser proportionnellement les documents de reprise.
- Publier le code et les preuves synthétiques dans une PR de travail. Aucune fusion dans `main`, publication de version,
  image Docker ou mise en production sans l’autorisation prévue par le projet.

Ne te limite pas à des recommandations : livre une intégration cohérente et vérifiable dans le code réellement présent.
