# ADR 0052 — Le registre fait foi ; la matrice et les échelles sont des barèmes

- Statut : acceptée
- Date : 2026-10-25
- Contexte : décision 6 du 25/10/2026 (dossier 002-01), vérifiée contre le guide de l'ANSSI pour EBIOS RM (le niveau se déduit de la gravité et de la vraisemblance, avec des échelles définies par l'organisation) et ISO/IEC 27005 (qui ne prescrit ni matrice ni modèle de registre) ; complète les ADR 0027 et 0031 sur les méthodes publiées et versionnées.

## Décision

- **Le registre porte les appréciations.** Le niveau d'un risque est celui de son appréciation enregistrée (cotations, méthode et version, niveau calculé à ce moment-là, immuable). La matrice et les échelles d'une méthode sont des **barèmes** : publier une nouvelle version ne réécrit aucune appréciation.
- **Une seule règle de référence.** Le registre, la cartographie des risques et la matrice retiennent la même appréciation : celle qui est **approuvée en priorité, sinon la plus récente**. Avant cette décision, la carte et la matrice prenaient la plus récente quelle que soit sa décision et pouvaient afficher un autre niveau que le registre pour le même risque.
- **Un écart est signalé, jamais corrigé.** Pour chaque risque, le serveur rejoue les cotations enregistrées avec la version la plus récente de la méthode, en lecture seule. Si le niveau brut ou résiduel diffère, le registre affiche « Écart avec la matrice courante » avec les deux niveaux et les deux versions ; si les échelles ont changé au point que les cotations n'existent plus, « Matrice courante non comparable » (aucun niveau n'est inventé). Le filtre « Écart avec la matrice » ne garde que ces risques. Rien n'est recalculé : le niveau enregistré reste affiché, l'historique des appréciations est inchangé, et seule une réévaluation explicite (avec sa justification) aligne le risque.

## Ce qui n'est pas fait

- Pas de réévaluation en masse ni de proposition de nouveau niveau à valider : l'écart se traite risque par risque par une réévaluation.
- Pas de signalement dans la matrice colorée ni dans la carte : l'écart n'est signalé que dans le registre.
- « Matrice courante » veut dire la version la plus récente de la méthode du risque ; l'outil ne sait pas distinguer une version « en vigueur » d'une version plus récente en préparation.

## Conséquences

- Aucune migration. Un champ `ecartMatrice` s'ajoute à chaque ligne du registre et un filtre `ecart=1` à la requête ; le calcul est la fonction pure `ecartMatriceCourante` du paquet partagé.
- Le changement d'ordre de l'appréciation retenue sur la carte et la matrice n'a d'effet que lorsqu'une appréciation approuvée a été suivie d'une révision non approuvée.
