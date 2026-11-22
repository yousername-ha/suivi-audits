# Règles visuelles et comportementales

## Palette et hiérarchie

- Bleu nuit et dégradé bleu/teal du menu ; accents cyan, violet discret. Fonds clairs lisibles, sans gris sale ni grande
  transparence qui efface les contours. Les couleurs d’état conservent leur sens vert/orange/rouge.
- Police Lexend, titres et graisses mesurés. Le gain d’espace vient de la composition ; pas d’agrandissement arbitraire
  sur PC 4K, ni de réduction globale par `zoom` ou `transform`.
- Les icônes occupent le centre géométrique de leur commande. Les vues se choisissent par petits pictogrammes avec
  nom accessible, infobulle et état actif ; conserver un libellé quand le sens reste ambigu.

## Champs et fenêtres

- Alignement à gauche, colonnes cohérentes, aides sous les saisies. Code court, date, nombre et état sont plus courts
  qu’un nom libre ; responsable de largeur contenue, choix complet toujours accessible dans le menu.
- Dans le prototype à 100 % : code 160 px, nombre 144 px, date 192 px, état 208 px, choix courant 288 px, responsable
  352 px, dans la limite de la colonne. CPE/URL/empreinte restent des données longues. Ne pas redimensionner le contrôle
  à chaque changement de valeur ; éviter les sauts de disposition.
- Fiches standard : lg 736 px, xl 864 px à 100 %. Garder une taille utile aux grands graphiques et tableaux. Adapter les
  colonnes à la largeur de la fiche. Centrer la fenêtre ; les tiroirs latéraux conservent leur ancrage.
- Aucune barre de défilement vertical de fiche. Si nécessaire : mini-menu sobre en haut du contenu, parties cohérentes,
  titre/fermeture/actions visibles. Un grand tableau doit rester entièrement consultable, sans coupure ou ligne perdue.
- Tous les champs et commandes restent présents et fonctionnels. Aucun vidage des valeurs au changement de partie,
  aucun mélange de formulaires, aucun accès à une erreur rendu impossible par le découpage.

## Commandes

- Aspect de l’exemple du RSSI : petit rectangle, contour fin lisible, fond transparent. Bleu/cyan du menu pour les
  commandes principales ; Annuler neutre ; rouge pour l’action sensible explicitement signalée en rouge.
- Aucun gros pavé violet de validation. Hover et focus discrets, états désactivés/chargement conservés. Les variantes
  d’état ou de sélection doivent toujours indiquer ce qui est actif.
- Les filtres, bascules, commandes de ligne et fenêtres suivent la même charte sur toute la plateforme.

## Préservations

Les références privées ne sont pas publiées. Les captures sont natives et fictives. Les graphiques et contenus métier
existants restent issus des vraies données de l’application ; aucune nouvelle source fictive dans le produit.

Les comportements déjà retenus sont à conserver s’ils existent : périmètre en graphe centré, cartes repliées et bouton
d’expansion en bas ; objectifs en compact par défaut ; actions et récurrences en timeline ; SWOT/PESTEL dans leur style
retenu ; DDA et bibliothèque dans leur habillage validé ; assistant RSSI global. Vérifier le code actuel avant tout report.
