# Recette — Audit (AUD-01 à AUD-16)

Jeu de données : fixture legacy anonymisée (`tests/fixtures/legacy-fixture.json`) complétée de données **fictives** :
cycle de 3 années (N = deuxième année), date d'audit AFNOR à J+20, échéance de clôture à J+60 ; 12 écarts (2 NC
majeures, 2 NC mineures, 4 points sensibles dont 2 AFNOR, 2 pistes de progrès, 2 remarques ; 3 clos, 2 en retard,
1 sans exigence liée, 1 créé par le module GAP) ; couverture AFNOR et interne partielle (dont 3 angles morts P) ;
plan d'audit de 2 jours, 8 créneaux, 5 participants. Fichiers PRM02 et Tenacy fictifs dans `tests/fixtures/`.
Aucune donnée réelle.

| # | Parcours | Résultat attendu | Exigence |
|---|---|---|---|
| 1 | Lecteur ouvre Préparation, Couverture, Écarts, Plan | Tout est lisible ; aucun contrôle de saisie ; une écriture forcée par l'API reçoit 403 | 01 |
| 2 | RSSI ouvre Paramètres > Audit, ajoute une année, change l'année N | Nouvelle colonne vide dans la couverture ; frise et pronostic recalculés | 02 |
| 3 | Change l'échéance de clôture | « 7 écarts concernés » ; après validation, échéances reportées et journalisées une par une | 02 |
| 4 | Ouvre Préparation de l'audit | Compte à rebours J-20 ; frise ; 4 faits ; carte des pastilles ; niveaux identiques à l'outil historique pour les mêmes données | 05, 06 |
| 5 | Bascule les lentilles AFNOR P et Interne P | Pastilles et légende changent ; aucune donnée modifiée | 06 |
| 6 | Filtre « Certain et très probable », passe une exigence à « Prête » | Ligne mise à jour ; fait « Exigences ciblées prêtes » recalculé ; autre session à jour sans recharger | 06, 16 |
| 7 | Couverture : clic sur une pastille AFNOR N (3 fois) | Non auditée → prévue → auditée → non auditée ; pronostic de la ligne mis à jour | 04, 07 |
| 8 | Filtres « Angles morts P » puis « Avec écart ouvert », recherche « 5.15 » | Compteurs exacts ; filtres retrouvés après rechargement | 07 |
| 9 | Ouvre la fiche A.5.15 | Motifs du pronostic, historique, écarts liés, créneaux, preuves et questions types, préparation | 08 |
| 10 | « Placer dans un créneau » depuis la fiche | Exigence ajoutée au créneau ; alerte « sans créneau » décrémentée | 08, 11 |
| 11 | Crée un écart depuis une fiche exigence | Identifiant `F12` (premier numéro libre ; le 12e écart du jeu est `GAP-01`), exigence liée, année N, échéance = échéance de clôture | 09 |
| 12 | Coche la première tâche d'un écart ouvert, puis toutes | Écart « En cours » ; invitation à clôturer ; clôture : date et auteur enregistrés | 09 |
| 13 | Rouvre un écart clos | Motif demandé ; statut « En cours » ; réouverture journalisée | 09 |
| 14 | Filtres du registre (À traiter, AFNOR, Annexe A, année, pilote) | Tri : non clos, AFNOR, type, identifiant ; compteurs exacts | 09 |
| 15 | Deux sessions modifient le même écart | Présence affichée ; la seconde reçoit 412 « modifié par … à … » ; une autre fiche reste modifiable | 09, 16 |
| 16 | Plan d'actions : coche une tâche en retard | Indicateurs (à faire, réalisées, en retard, %) mis à jour ; échéance de la tâche prioritaire sur celle de l'écart | 10 |
| 17 | Plan : ajoute un jour et un créneau, change la fin avant le début | Créneau à la suite du précédent, 60 min ; fin recalée ; jours renumérotés après suppression d'un jour vide | 11 |
| 18 | « Ajouter les preuves types » sur un créneau à 3 exigences | Preuves et questions du guide ajoutées sans doublon ; cochables | 11 |
| 19 | Vues Planning et Participants | Grille horaire colorée par pire pronostic ; temps mobilisé par personne | 11 |
| 20 | Accueil et écran mural | Cartes et graphiques (anneau des écarts, couverture, conformité) ; « Voir les données » affiche le tableau ; clair et sombre | 12 |
| 21 | Import PRM02 fictif | Simulation : n écarts créés, m mis à jour, k ignorés (Tenacy), couverture et remarques ; application identique ; annulation | 13 |
| 22 | Import Tenacy fictif | Statuts et types convertis, mesures reconnues ; simulation puis application | 13 |
| 23 | Exports : rapport Excel, modèle consolidé, Tenacy, CSV, impression du plan | Fichiers lisibles par un tableur ; réimport du modèle sans perte ; impression A4 ; exports journalisés | 14 |
| 24 | Import legacy d'un fichier complet | Modules repris reconnus ; `/legacy` affiche audit, écarts et plan en lecture seule ; export retour identique | 15 |
| 25 | Dans `/legacy`, le module GAP crée un écart | Écart `GAP-nn` créé dans les tables au nom de la personne, journalisé ; une modification d'écart depuis `/legacy` reçoit 409 | 15 |
| 26 | 390, 1920, 3840 px | Pas de défilement horizontal de la page ; fiche en feuille basse au téléphone ; captures de référence | 06–12 |
