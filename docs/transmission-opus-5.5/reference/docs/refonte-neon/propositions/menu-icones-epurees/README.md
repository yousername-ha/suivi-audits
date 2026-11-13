# Menu clair — icônes épurées

12/11/2026, Europe/Paris. **Maquette autonome à valider ; aucune intégration applicative.**
Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Retour : les plaques colorées brillantes donnaient un aspect artificiel aux icônes. Cette proposition retire leurs fonds, cadres asymétriques et ombres ; les SVG existants sont affichés directement dans leur couleur de famille, avec trait 1,8 et surface de dessin légèrement agrandie. Les icônes administratives gardent leurs dimensions, leur trait est aligné. Fond clair, sélection et structure du menu précédent conservés. Le sombre reste identique.

[Capture HD native](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/menu-icones-epurees/menu-clair-hd.png) · [Aperçu autonome](apercu-autonome.html).

## Résumé technique pour une IA

- Base documentaire `5208c62`. Application toujours à `d9d1478` : aucun fichier applicatif, contrat, droit ou dépendance modifié.
- `index.html` importe le clair précédent et ajoute seulement `icones.css`. Cette feuille cible uniquement les icônes du menu sous `html[data-theme='light']` ; les tracés SVG et le JS existants sont réutilisés. Pas de nouvelle bibliothèque d’icônes.
- Taille des emplacements des icônes principales conservée ; réduction du padding de 3 à 2 px. Animations, pause/reprise, réduction système du mouvement et navigation du simulateur inchangées.
- `exporter.py` assemble les sources locales dans un HTML autonome ; la capture est produite par Chromium à 1920×1080, densité 2, soit 3840×2160.
- Vérifications de cette variante : comparaison native de sidebar sombre avant/après pixel-identique ; sept scans Axe du menu clair, un par famille active, sans violation détectée ; quatre dimensions PC 1280×720, 1440×900, 1920×1080 et 2560×1440 sans débordement de page ; aucune erreur JavaScript de capture ; styles calculés sans fond ni ombre sur l’icône. Résultats dans `controles.json`. Format HTML/CSS et diff contrôlés. Ces contrôles concernent la maquette uniquement.
- Non exécutés : intégration, build/tests applicatifs, Docker, API/DB/Mistral, ZIP, push, fusion ou déploiement. Aucune validation humaine déduite du retour.
- Suite : validation du nouveau rendu clair puis portage ciblé de la variante retenue dans le cadre existant, avec ses droits/routes/ordre mémorisé et ses tests applicatifs. Ne pas copier les données ou routes du simulateur.

PR ouverte #264 consultée (liste des fichiers) : retrait backend Risques, pas de fichier commun avec ce lot. Entrées documentaires antérieures préservées.
