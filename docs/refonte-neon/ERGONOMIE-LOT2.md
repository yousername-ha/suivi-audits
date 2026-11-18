# Ergonomie, lot 2 : suite du relevé sur écran 1920 × 1080

18/11/2026. Session « Refonte Neon suivi-audits » (`session_01EnWdzg9gxV5Kzkp9Y5WBcd`), branche `claude/ergonomie-lot2`,
partie de `claude-suivi-smsi`. Suite du [lot 7.3.0](ERGONOMIE-7.3.0.md) et du [relevé](RELEVE-ECRAN-1920.md).

## Décisions du RSSI (18/11/2026)

1. **Processus** : retirer le bandeau « Périmètre affiché », qui répète la petite liste de l'en-tête. Le test unitaire qui
   le lit sera adapté.
2. **Éléments par périmètre** : le choix du périmètre, premier geste de la page, reste visible à côté de la boîte
   d'outils au lieu d'être dans les filtres avancés.
3. **Documents** : Catégorie et Étiquettes se filtrent sur le titre de leur colonne, avec un filtre de colonne à choix
   multiple (cases à cocher). Les autres listes gardent le filtre à choix unique.
4. **Suite du relevé** :
   - fenêtres ramenées à quelques tailles communes (aujourd'hui 440, 800, 1 024 et 1 216 px) ;
   - champs de tableau élargis là où le texte est coupé (contacts de crise, participants d'audit, étapes de scénario,
     note du plan d'audit) ;
   - tuile de l'Assistant RSSI qui ne masque plus le contenu ;
   - page Processus plus dense (plus de processus visibles) ;
   - titre en double retiré des fenêtres des cartes de Plateforme et de Configuration système.
5. **Cartographie du SMSI** : à l'ouverture, la carte remplit toujours sa zone, puis ne bouge plus d'elle-même. Le
   parcours 29 de la recette de la carte sera adapté.

## Méthode

Maquettes présentées au RSSI avant toute intégration. Toute modification de test ou de sélecteur est présentée et validée
avant le commit. Captures de référence régénérées dans le conteneur Playwright officiel, présentées en avant/après et
remplacées seulement avec l'accord du RSSI.
