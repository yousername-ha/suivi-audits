# ADR 0051 — Couche visuelle EBIOS RM : chemins, pictogrammes, cercle, flux

- Statut : acceptée
- Date : 2026-10-25
- Contexte : décision 5 du 25/10/2026 (dossiers 003-07 à 003-10), « dans le style du parcours 024 » ; contraintes de l'[ADR 0006](0006-front-react-mantine-csp-stricte.md) (CSP stricte, aucun style en ligne) et de l'[ADR 0029](0029-recette-automatisee.md).

## Décision

Dans une étude (Gestion des risques, Études EBIOS RM), deux onglets s'ajoutent aux cinq ateliers. **Aucune donnée, aucune API, aucune migration** : tout est dessiné à partir des liens déjà saisis (couple source / objectif visé, parties prenantes dans l'ordre saisi, événements redoutés, scénarios opérationnels).

- **Chemins** (003-08, 003-10) : graphe en trois colonnes (sources de risque, parties prenantes, événements redoutés) avec des flèches dans le sens de lecture. Un chemin se choisit dans une liste de boutons (clavier compris) ; seul le chemin choisi reçoit un contour épais et un flux animé, les autres restent tracés. Les chemins qui partagent la source ou un événement sont proposés comme alternatives à comparer. Un scénario stratégique auquel il manque un couple, une source ou un événement redouté **n'est pas dessiné** et la donnée manquante est écrite. Les scénarios opérationnels qui en découlent s'ouvrent, et la synthèse se retrouve en un clic (aller et retour).
- **Suivi, matrice et cercle** (003-07) : les scénarios opérationnels sont montrés dans une liste, dans la matrice gravité × vraisemblance et dans un cercle, avec **une sélection et des filtres communs**. La liste est l'équivalent complet des graphiques. Le cercle répartit les scénarios régulièrement dans l'ordre alphabétique : **sa position ne traduit aucun score** (c'est écrit sous le graphique) ; la couleur donne la gravité du scénario stratégique et les valeurs sont toujours écrites à côté. Un scénario sans rang de gravité ou de vraisemblance est listé à part, jamais placé.
- **Pictogrammes** (003-09) : sept dessins propres au projet (aucune bibliothèque tierce, donc aucune licence à suivre) : acteur malveillant, criminel, étatique, interne ou prestataire, accident ou incendie, événement naturel, catégorie non reconnue. Le dessin est **proposé d'après la catégorie saisie** pour la source, toujours accompagné d'un libellé écrit (« pictogramme indicatif : … »), décoratif pour les lecteurs d'écran. Il ne modifie ni la source ni son classement : les règles testent d'abord ce qui n'est pas intentionnel, de sorte qu'un incendie ou un accident n'apparaît jamais comme un attaquant.
- **Mouvement** : le flux est décoratif. Réglage « Animées / Automatiques / Arrêtées » (le même que le parcours guidé), bouton de pause, respect de `prefers-reduced-motion`, arrêt quand l'onglet est masqué. Mouvement arrêté, les flèches et la sélection restent visibles.
- **Accessibilité et CSP** : graphiques en SVG avec classes (aucun attribut `style`), alternative textuelle complète, contrôle axe sur les deux vues.

## Ce qui n'est pas fait

- Pas d'éditeur graphique : on ne crée ni ne relie rien en dessinant ; les liens se saisissent dans les ateliers.
- Les chemins viennent des liens du scénario stratégique ; les « chemins d'attaque » opérationnels (séquences d'opérations) restent un texte libre.
- La matrice garde le rang numérique 1 à 4 des scénarios ; une gravité ou une vraisemblance de l'échelle publiée sans rang numérique est écrite mais n'est pas placée dans la matrice.
- La matrice de risques colorée du registre (autre écran) n'est pas fusionnée avec celle-ci.
- Les pictogrammes ne couvrent que sept familles ; la reconnaissance se fait sur des mots-clés de la catégorie saisie.
