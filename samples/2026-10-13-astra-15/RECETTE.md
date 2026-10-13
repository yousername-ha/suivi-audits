# Recette de l’implémentation — à exécuter sur le code réalisé

Ces contrôles sont des exigences de réalisation, **pas des résultats déjà obtenus** lors de la livraison documentaire.

| Domaine | Vérification attendue |
| --- | --- |
| Référence | Style 08 et déclinaisons 14, pas de retour implicite à la palette 09 ; texte et commandes suffisamment contrastés |
| Deux styles | Fond Sauge référence 08 et Clair bleuté ; identité commune ; combinaison avec Clair/Sombre/Système |
| Icônes | Pictogrammes de référence conservés ; icône active turquoise, filet turquoise, fond vert éclairci et texte clair dans les deux styles |
| Dépli/repli | Chevron à droite, orientation droite/bas cohérente, sous-menus conservés, clavier et aria-expanded/aria-controls ; pas de substitution par +/− |
| Navigation | Toutes les destinations initiales préservées et une seule nouvelle destination Apparence |
| Global | Deux comptes dans deux contextes navigateur indépendants voient le même style ; persistance après redémarrage serveur |
| Sessions actives | Propagation en ligne sous 30 s et au retour au premier plan ; aucune perte de saisie/scroll/focus |
| Administrateur | Écriture autorisée pour admin actif, refusée à editor/viewer ; vérification par appels API directs |
| Authentification | Lecture refusée sans session ; écriture refusée sans CSRF ; compte désactivé refusé |
| Validation | Styles inconnus, types incorrects, révision absente/invalide refusés ; pas d’écriture partielle |
| Concurrence | Deux administrateurs sur une même révision : premier succès, second 409, choix conservé pour résolution explicite |
| Migration | Base existante préservée, défaut correct, migration répétée sans réinitialisation, versions cohérentes |
| Audit | Auteur, avant/après et date enregistrés pour un changement effectif, aucune donnée sensible |
| Réseau | Erreur, délai et coupure : aucun faux succès ; dernière valeur connue conservée ; reprise correcte |
| Prévisualisation | Sélection sans écriture ; abandon restaure le global ; mise à jour distante pendant un aperçu gérée explicitement |
| Actions | Liste/Kanban/Planning/Calendrier/Gantt/Synthèse ; création puis édition rapide, changement d’état, sous-actions et lecture seule |
| Récurrences | Liste/Kanban/Planning/Calendrier/fiche ; recherche, tri, responsable, fréquence et historique corrects |
| Réalisation | Date/commentaire/preuve/auteur persistés après rechargement, prochaine échéance recalculée par le moteur existant |
| Série | Modification de fréquence sans altération des réalisations passées ; aucune édition isolée d’une projection prétendue |
| Matrice des risques | Cases pleines vert/jaune/orange/rouge, libellés/nombres/références lisibles, axes, sélection bleue, panneau et reset ; mêmes totaux/positions avant/après, deux styles et sombre |
| Politiques de risque | Fixture matricielle explicite pour la référence ; couleurs personnalisées préservées, aucune couleur de cellule déduite pour une politique manuelle, aucune mutation des politiques/évaluations immuables |
| Annexe A | Liaison/déliaison risque–mesures 2022, lien inverse et droits, aucune modification automatique de conformité |
| Cartographies | Trois routes inchangées visuellement et fonctionnellement, y compris réception d’un style global et transitions |
| Responsive | 390/768/1440/1920 px, zoom 200 %, clavier et dialogues ; aucun débordement global non prévu |
| Régressions métier | Sessions, périmètres, CaRE/HAS, preuves, finances, PCRA, incidents et exports préservés |

## Commandes existantes

Vérifier d’abord leurs prérequis au HEAD réel ; utiliser uniquement des bases temporaires et des fixtures. Ne pas écraser les données de l’utilisateur.

```sh
node --test tests/*.test.cjs
python3 -m unittest discover -s tests -p '*_test.py'
CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/astra-browser.cjs
CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/browser-carto.cjs
CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/browser-interface.cjs
CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/browser-risks.cjs
```

Ajouter les tests ciblés du nouveau contrat API, de sa migration et de la synchronisation entre sessions : ils ne sont pas couverts par de simples captures. Conserver les assertions métier existantes. Documenter séparément les échecs préexistants et ceux introduits ; ne pas diminuer les tests pour les faire passer.

## Éléments de preuve à livrer

Pour chaque contrôle : commande/scénario, résultat observé, environnement, SHA et limite éventuelle. Captures avant/après des cartes à données et dimensions identiques. Nouvelle série datée dans `samples`, sans écraser les séries 08 à 15. Vérifier intégrité du ZIP produit par `python3 scripts/package_astra.py --output <chemin-du-zip>` ; le script ne distribue que les fichiers suivis, donc inclure les nouveaux modules avant packaging.
