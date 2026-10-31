# Maquettes de refonte graphique

Test visuel uniquement : six maquettes statiques et cliquables de « Suivi des audits SMSI », sur données fictives,
sans aucun lien avec le code de l'application. Rien ici n'est à déployer.

## Ouvrir

- Double-cliquer sur `index.html` (page comparative : cartes des maquettes, bascule de maquette et d'écran dans un
  cadre), ou servir le dossier : `npx serve design-mockups` puis ouvrir l'URL indiquée.
- Chaque maquette s'ouvre aussi directement : `A-fidele/index.html`, `B-epuree/index.html`,
  `C-institutionnel/index.html`, `D-soc-sombre/index.html`, `E-data-dense/index.html`, `F-inspiration/index.html`.
  Écrans par ancre : `#/dashboard`, `#/audits`, `#/audit/AUD-07`, `#/formulaire`, `#/retex`, `#/composants`.

## Contenu

| Chemin | Rôle |
| --- | --- |
| `AUDIT-VISUEL.md` | relevé de la charte actuelle (palette, typo, composants, écrans) et défauts constatés |
| `reference/` | images de référence du commanditaire et `ANALYSE-INSPIRATION.md` |
| `shared/` | `fake-data.js` (données fictives communes), `BRIEF-COMMUN.md` (règles), police Inter locale |
| `A-fidele/` … `F-inspiration/` | une maquette par dossier : `index.html`, `tokens.css`, `styles.css`, `app.js`, `README.md`, `test/` |
| `screenshots/` | captures de chaque écran, planche comparative, GIF et vidéos des animations de F |
| `scripts/capture.cjs` | régénère les captures (`node design-mockups/scripts/capture.cjs`) |
| `SYNTHESE.md` | tableau comparatif, estimation d'effort, résultats des vérifications, recommandation |

Aucune dépendance, aucun CDN, aucune donnée réelle.
