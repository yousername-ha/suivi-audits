# Intégration et recette

## 1. Comparer l’état réel

Vérifier branche, modifications locales et consignes persistantes. Lire les trois dossiers de référence liés au README.
Repérer le cadre commun de navigation, les barres d’outils et le thème ; ne pas créer des versions par module.

Les adaptations antérieures sont dans `BarreOutils` / `BarreFiltres`, les proportions dans `proportions-champs.ts` et les
feuilles de `packages/ui`. La reprise doit conserver les correctifs et fonctions ajoutés depuis, particulièrement les
permissions, sélecteurs de responsables, relations et états temps réel.

## 2. Comprendre le prototype des fiches

`FichesSansDefilement` est installé une fois sous Mantine dans `main.tsx`. Il repère aussi les fenêtres rendues en portail.
Une fiche qui tient garde son affichage naturel ; une fiche trop longue reçoit un mini-menu. Le prototype fragmente le
contenu en parties avec CSS, sans déplacer les champs hors de leur formulaire ni les démonter.

Les points délicats à vérifier dans la version reprise sont : largeur réelle des colonnes (padding compris), footer
absolu restant visible dans chaque partie, titres avec leur premier champ, groupes indivisibles, tableaux, contrôles
ajoutés à la volée, affichage d’une erreur, focus d’un champ situé dans une autre partie et nettoyage des observateurs.
Les petits formulaires ne doivent pas recevoir de menu inutile. La densité et la taille d’écran peuvent changer pendant
qu’une fiche est ouverte.

Le repérage automatique du pied couvre `.fenetre-actions` et le dernier groupe de boutons d’un `Stack` directement dans
le corps. Pour un autre agencement, adapter explicitement le composant de fiche ou son marqueur. Vérifier aussi qu’un
ancêtre positionné ne fixe pas les actions au mauvais conteneur. Le style commun ne prouve pas que tous les pieds sont
déjà correctement identifiés.

La classification des champs par libellé est un repli visuel, pas une règle métier. Vérifier les schémas et valeurs
utiles : un identifiant technique long ne doit pas être réduit comme un code court. Un champ ambigu peut recevoir une
classe de format explicite. Ne pas dimensionner les champs à partir d’une valeur secrète ou provoquer des sauts à chaque saisie.

Les sélecteurs de style des listes Mantine ne sont pas interchangeables : un `Select` expose notamment
`.mantine-Select-dropdown` et `.mantine-Select-option`. Vérifier les classes réellement rendues ; la classe générique
Combobox seule ne couvre pas tous les menus. Les menus natifs restent sous contrôle du navigateur.

Le CSS reste dans `packages/ui` et est importé après les styles métier. Ne pas injecter de balise `<style>` pour mesurer
ou dimensionner les fiches. Préserver la CSP ; le prototype ne modifie que des attributs de présentation et la navigation
interne. Une autre implémentation robuste par onglets est acceptable si les contrats métier restent respectés.

### Limites constatées à corriger avant intégration finale

- La fragmentation automatique peut couper un groupe au bord d’une partie : les contrôles géométriques ne détectent pas
  chaque coupure de champ. Revoir explicitement les limites sur les images et au clavier ; ne pas se contenter de cacher
  le débordement. Chaque champ complet, son libellé, son aide et son erreur doivent rester accessibles.
- Une partie fournisseur peut ne contenir que deux boutons, avec une grande zone vide. Regrouper les commandes avec leur
  section et ajuster la hauteur au contenu utile. Ne pas imposer 90 % de hauteur à une partie qui n’en a pas besoin.
- Les intitulés automatiques « Suite 2 » ou « Analyse » répétés sont des replis du prototype. Définir des sections métier
  courtes et distinctes pour les fiches concernées ; un mini-menu interne explicite est préférable si nécessaire.
- Les longues listes dynamiques, documents intégrés, erreurs serveur, fenêtres imbriquées et pieds atypiques restent à
  vérifier dans l’application cible. Ne pas activer aveuglément le prototype global sur toutes les fiches.

Ces limites ne remettent pas en cause la consigne : aucune fiche ne doit imposer un défilement vertical de sa fenêtre.
Elles indiquent le travail d’intégration restant pour la respecter sans perdre d’informations ni agrandir inutilement les cadres.

## 3. Cas de recette obligatoires

| Cas | Vérification |
| --- | --- |
| Fiche courte | Aucun mini-menu inutile ; cadre centré, champs alignés, commandes en contour. |
| Risque long | Informations/analyse accessibles, pas de débordement vertical, valeurs conservées entre parties. |
| Fournisseur | Certificats et contrôles regroupés ; nombreux contrôles tous accessibles ; ajout et retrait fonctionnels. |
| Produit | Version courte, CPE long, menus ouverts lisibles, soumission et validation inchangées. |
| Tableau long | Toutes les lignes atteignables, aucune coupure cachée, en-têtes et actions utilisables. |
| Noms longs | Choix complet lisible, valeur choisie conservée, contrôle sans longueur excessive. |
| Erreur | Partie contenant l’erreur/champ invalide rendue accessible, focus cohérent. |
| Clavier | Mini-menu, Tab, saisies et fermeture accessibles ; aucun piège au changement de partie. |
| Redimensionnement | Ni partie vide ni contenu perdu ; tailles explicites et densités conservées. |
| Ouverture/fermeture | Nettoyage des observateurs, état de la page de fond et retour du focus préservés. |
| Couleurs | Enregistrer bleu/cyan en contour, Annuler discret, action rouge conservée, états métier lisibles. |

Utiliser les dimensions et thèmes du prompt, avec des données synthétiques pour les preuves publiques. Ne pas déclarer
chaque fenêtre validée à partir d’un simple inventaire de composants.

## 4. Contrôles et rendu de la livraison

Les tests de contrats et suites web/UI utilisent les dépendances existantes. TypeScript, lint, format et build doivent
réussir sur les fichiers effectivement livrés. Consigner les échecs corrigés et les limites ; ne pas diminuer des
assertions pour obtenir un succès. La suite E2E serveur et les tests API nécessitent la pile isolée décrite par le dépôt.

Les captures de ce dossier ne remplacent pas la validation du RSSI. Fournir la PR, le résumé technique, les commandes
exécutées, les captures finales et les actions restantes. Préserver les preuves antérieures datées.
