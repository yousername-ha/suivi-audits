# Tester tout le parcours EBIOS RM

Extraire le ZIP puis ouvrir **TESTER-PARCOURS-COMPLET.bat**. Le lanceur ouvre les cinq ateliers. **DEMARRER.bat** ouvre le suivi graphique des risques. Les deux entrées donnent accès à la même maquette.

## Parcours des cinq ateliers

Choisir « Commencer par le cadrage ». À chaque étape, saisir une courte note de test dans les deux champs, cliquer **Enregistrer les notes**, puis **Étape suivante**. Les champs ne sont pas des formulaires métier complets et ne valident pas une étude. Les notes restent locales au navigateur.

| Atelier | Étape | À contrôler |
| --- | --- | --- |
| 1 · Cadrage et socle de sécurité | A · Définir le cadre | Deux champs de notes ; schéma ; source guide p. 19 ; navigation |
| 1 · Cadrage et socle de sécurité | B · Délimiter le périmètre | Deux champs de notes ; schéma ; source guide p. 20 ; navigation |
| 1 · Cadrage et socle de sécurité | C · Événements redoutés et gravité | Deux champs de notes ; schéma ; source guide p. 24 ; navigation |
| 1 · Cadrage et socle de sécurité | D · Évaluer le socle de sécurité | Deux champs de notes ; schéma ; source guide p. 28 ; navigation |
| 2 · Sources de risque | A · Identifier les couples SR/OV | Deux champs de notes ; schéma ; source guide p. 36 ; navigation |
| 2 · Sources de risque | B · Apprécier la pertinence | Deux champs de notes ; schéma ; source guide p. 38 ; navigation |
| 2 · Sources de risque | C · Retenir les priorités | Deux champs de notes ; schéma ; source guide p. 38 ; navigation |
| 3 · Scénarios stratégiques | A · Analyser l’écosystème | Deux champs de notes ; schéma ; source guide p. 43 ; navigation |
| 3 · Scénarios stratégiques | B · Construire les scénarios | Deux champs de notes ; schéma ; source guide p. 48 ; navigation |
| 3 · Scénarios stratégiques | C · Protéger l’écosystème | Deux champs de notes ; schéma ; source guide p. 53 ; navigation |
| 4 · Scénarios opérationnels | A · Élaborer les scénarios | Deux champs de notes ; schéma ; source guide p. 59 ; navigation |
| 4 · Scénarios opérationnels | B · Estimer la vraisemblance | Deux champs de notes ; schéma ; source guide p. 65 ; navigation |
| 5 · Traitement du risque | A · Synthétiser les risques | Deux champs de notes ; schéma ; source guide p. 71 ; navigation |
| 5 · Traitement du risque | B · Choisir le traitement | Deux champs de notes ; schéma ; source guide p. 74 ; navigation |
| 5 · Traitement du risque | C · Définir les mesures | Deux champs de notes ; schéma ; source guide p. 76 ; navigation |
| 5 · Traitement du risque | D · Documenter le risque résiduel | Deux champs de notes ; schéma ; source guide p. 78 ; navigation |
| 5 · Traitement du risque | E · Organiser le suivi | Deux champs de notes ; schéma ; source guide p. 81 ; navigation |
| 5 · Traitement du risque | F · Mettre sous surveillance | Deux champs de notes ; schéma ; source guide p. 82 ; navigation |

À la fin de l’atelier 5, revenir au parcours. Revenir ensuite dans les ateliers et recharger la page : les notes enregistrées doivent être restituées dans le même navigateur. Vérifier aussi la navigation directe entre ateliers et la consultation des sources ANSSI.

## Vues graphiques

1. Ouvrir **Suivi des risques**. Choisir successivement R1 à R5 : le tableau et la cellule de matrice doivent sélectionner le même risque ; le cercle souligne P3 pour R2, F3 pour R3 et F2 pour R4. R1 et R5 n’ont pas d’intermédiaire dans les chemins illustrés.
2. Depuis R1, ouvrir **Graphe**. Afficher tous les chemins puis isoler 1, 2 et 3 : seules les flèches du chemin sélectionné s’animent et ses blocs ont un contour renforcé.
3. Tester **Pause du flux**, puis reprise. Tester les pictogrammes et la fermeture clavier de la palette. Si la réduction des mouvements est activée sur l’appareil, le flux reste statique.
4. Revenir au parcours : les notes déjà enregistrées restent disponibles.

## Ce qui est testable dans cette livraison

Navigation des cinq ateliers et des 18 étapes ; notes locales ; liens aux sources ; cas ANSSI dans le tableau, le cercle et la matrice ; sélection synchronisée ; graphe R1 à trois chemins ; animations ; pictogrammes ; affichage adapté aux petits écrans.

## Ce qui reste à intégrer au module métier

Création d’études et d’objets structurés, données serveur, comptes et permissions, rattachements réels risques / mesures / preuves, édition de graphes, cotation fondée sur une politique, décisions d’acceptation et exports métier. Les risques affichés sont ceux de l’exemple pédagogique ANSSI et ne sont pas générés par les notes du parcours.

Le BAT est fourni pour Windows, mais les contrôles automatisés de cette livraison sont réalisés dans Chromium sous Linux. Les notes de test automatisées sont confinées à un profil navigateur temporaire et ne sont pas livrées dans le ZIP.
