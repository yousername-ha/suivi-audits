# FAQ

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

## Faut-il créer un SMSI pour piloter une démarche qualité ?

Non. Pilotage réutilise le périmètre commun et accepte qualité/SMQ, sécurité/SMSI,
HDS, intégré ou personnalisé. Les noms techniques grc_smsis subsistent pour
compatibilité, sans imposer ce parcours à l’utilisateur.

## Que devient l’ancien outil ?

L’écran /legacy est retiré (ADR 0042). Ses données sont dans les tables de la plateforme ; l’outil
autonome reste téléchargeable, testable, sur la branche `archive/outil-legacy-autonome`. Les exports
Excel sont dans « Exports Excel » ; ReCyF, le pronostic d’audit en export, le clausier fournisseurs et
le GAP applications en export Excel ne sont pas encore repris.

## Une action terminée réduit-elle le risque résiduel ?

Non. Le traitement fournit des éléments ; une réévaluation explicite et
tracée est nécessaire pour modifier le risque résiduel.

## Les rappels sont-ils des emails ?

Les rappels livrés sont internes. Le transport email I reste exclu.

## La sauvegarde demande-t-elle un cron supplémentaire ?

Installation Compose depuis 3.0.2 : non, l’updater intègre le poller exploitation.
Une ancienne image peut nécessiter le premier redéploiement documenté.

## Peut-on mettre à jour depuis le menu ?

Oui pour l’installation v3 préparée : rôle système Administrateur, accès
serveur Git/GHCR, version complète signée et confirmation. Une ancienne image
updater peut demander le premier passage serveur. Le frontal est entretenu séparément.

## Pourquoi aucun nouveau numéro après l’optimisation ?

c704fa6 ne change que CI/documentation. Trivy passe de six à trois scans
d’images ; le programme reste 3.0.2.

## Tous les tests passés prouvent-ils la conformité et l’ergonomie ?

Non. Ils prouvent les contrats testés au commit cité. Les sources normatives
inaccessibles, la recette du serveur et l’acceptation utilisateur restent distinctes.

## Peut-on supprimer l’ancien code ou effacer les données pour tester ?

Pas dans cette mission. Conserver les sources, paramètres et données ; suivre
une recette isolée autorisée. Aucune destruction ou fusion automatique.
