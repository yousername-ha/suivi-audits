# Recette d’implémentation à exécuter

Cette recette décrit les tests du futur code. Elle ne prétend pas qu’ils sont déjà passés. Les seuls contrôles exécutés sur le présent dossier sont consignés dans `VERIFICATIONS.json`.

| ID | Scénario | Résultat exigé |
|---|---|---|
| DAT-01 | Lire les 21 classeurs et les 3 PNG, classer le cache | Inventaire 25 ; feuilles et colonnes tracées ; zéro formule exécutée |
| DAT-02 | Importer la feuille de missions fusionnées | 9 missions, pas 89 ; aucune VM/support inventé |
| DAT-03 | Importer deux fois avec les mêmes décisions | Aucun doublon ; rapport et liaisons stables |
| DAT-04 | Responsable ambigu, parent manquant, libellé identique hors organisation | À rapprocher ; aucune association silencieuse |
| CFG-01 | Échelle d’intégrité 3 niveaux et confidentialité 4 | Aucun alignement forcé ; valeur numérique facultative |
| CFG-02 | Évaluer les neuf couples ressources/motivation | 1/1 faible, 1/2 faible, 1/3 moyenne ; 2/1 faible, 2/2 moyenne, 2/3 élevée ; 3/1 moyenne, 3/2 élevée, 3/3 élevée |
| CFG-03 | Cellule absente/dupliquée, ID étranger, axe incompatible | Publication refusée avec emplacement précis |
| CFG-04 | Publier v2 puis consulter étude épinglée v1 | Résultats/échelles/labels v1 inchangés ; adoption explicite seulement |
| CFG-05 | Deux affectations au même rang ; fork étude | Conflit bloquant ; fork traçable et autorisé, origine intacte |
| CFG-06 | Matrice rectangulaire 3×4 ; méthode sans matrice | Rendu/calcul conformes au contrat, aucune grille 4×4 imposée |
| SEC-01 | Organisation A tente lecture/recherche/export/liaison vers B | Refus serveur, pas de libellé/snapshot/compteur divulgué |
| SEC-02 | Éditeur modifie une configuration héritée ou un objet hors périmètre | Refus serveur ; objets cachés préservés par fusion |
| SEC-03 | Client forge auteur, validation, résultat calculé ou niveau | Recalcul/validation serveur, auteur réel, rejet des falsifications |
| SEC-04 | CSRF absent, session expirée, utilisateur lecteur | Aucune mutation ; saisie locale récupérable sans exposition |
| SEC-05 | Historique, dépendances et rapport d’import avec référence interdite | Projection restrictive jusque dans les détails |
| EBI-01 | Étude synthétique : mission/VM/support → ER → couple → stratégique → opérationnel → traitement | Traçabilité complète, liens persistants après rechargement |
| EBI-02 | Activité non renseignée et OV accidentel dans le parcours intentionnel | Manques explicites et revue humaine ; aucun calcul/choix inventé |
| EBI-03 | Sélection ligne/cellule/cercle puis aucun résultat | Même ensemble d’IDs, filtres visibles, état vide exact |
| EBI-04 | Sélection des trois chemins au clavier | Flèches orientées, nœuds renforcés, équivalent textuel, mouvement réduit respecté |
| EBI-05 | Clôturer une action sans réévaluation | Risque résiduel inchangé, aucune acceptation automatique |
| EBI-06 | Accepter un risque sans droit puis avec droit et justification | Refus puis décision immuable liée à l’évaluation exacte |
| MET-01 | Étude personnalisée sans SR/OV et résultat qualitatif | Aucun atelier EBIOS imposé |
| MET-02 | Ouvrir les études historiques des quatre méthodes | Lecture/export possibles, aucune conversion arbitraire |
| MIG-01 | Migration sur copie, seconde exécution, interruption, restauration | Idempotence, atomicité, retour prouvé vers version compatible |
| MIG-02 | Comparer hashes des anciennes évaluations/politiques/décisions | Identiques ; codes de présentation gérés selon règles historiques |
| CON-01 | Deux publications/validations concurrentes sur même version | Une seule écriture acceptée ; autre rejetée sans écrasement |
| REG-01 | Lien risque ↔ Annexe A et plan de traitement après migration | Bidirectionnel intact ; conformité non déduite |
| REG-02 | Cartographie dynamique avant/après | Fichiers protégés inchangés, mêmes routes/interactions et données |
| REG-03 | Audits, preuves, PCRA, tâches récurrentes, plans d’action | Scénarios existants passent ; aucun nouveau registre concurrent |
| EXP-01 | Export historique v1 et nouvelles données v2 | Ancien format préservé ; extension v2 documentée et sans perte silencieuse |
| UX-01 | Zoom 200 %, clavier, lecteur d’écran, écran étroit | Aucun contrôle inaccessible ; légendes et équivalents textuels présents |
| UX-02 | Changer le thème global depuis un compte autorisé | Tous les utilisateurs concernés, sans modifier couleurs des niveaux |

## Parcours manuel de référence

Sur un jeu **FICTIF** : créer une organisation/périmètre autorisé et choisir une version de méthode ; sélectionner une VM et un support ; évaluer un ER ; sélectionner SR et OV puis motivation/ressources/activité ; justifier la sélection du couple ; construire un scénario stratégique et sa variante opérationnelle ; choisir une politique de vraisemblance/gravité publiée ; enregistrer l’évaluation centrale ; lier une mesure Annexe A et une action existante ; constater l’application avec preuve ; créer une nouvelle évaluation résiduelle ; prendre une décision habilitée et planifier la revue. Recharger à chaque étape clé. Modifier ensuite une configuration : constater que l’étude conserve sa version jusqu’à adoption explicite.

## Navigation ajoutée après la vidéo

NAV-01 : toutes les destinations recensées ont une cible, sans orphelin. NAV-02 : comptes et rôles ont chacun une destination principale et des alias compatibles. NAV-03 : lecteur/éditeur/admin gardent leurs accès autorisés. NAV-04 : tâches récurrentes, actions contextuelles, preuves et cartes restent accessibles. NAV-05 : clavier, chevrons, retour et préférences fonctionnent ; aucune modification interne des cartes. Voir les scénarios détaillés du chapitre 12.
