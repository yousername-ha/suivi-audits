# Liaisons alignées — flux animé discret

11/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Après « C’est animé ? Sinon continue », ajout d’une animation aux [liaisons corrigées](../parties-liaisons-alignees/README.md). Le cercle était déjà animé ; les traits alignés étaient fixes. **Nouvelle variante autonome à évaluer avant intégration**, application toujours à `23b33b5`, aucun build/test applicatif ni nouveau ZIP.

[Voir la vidéo clair/sombre](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/parties-liaisons-animees/animation.mp4), [aperçu clair](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/parties-liaisons-animees/apercu-clair.png), [aperçu sombre](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/parties-liaisons-animees/apercu-sombre.png).

Deux points lumineux au maximum, un pour les acteurs internes et un pour les externes, parcourent successivement les branches. Les lignes, textes et cartes restent immobiles. Ce mouvement est décoratif : il ne représente aucun transfert, événement ou avancement métier réel. Pause/reprise conservées ; préférence de réduction des mouvements prioritaire, même après une demande de reprise.

## Résumé technique

- `index.html` réutilise le contrôleur et le routage de `parties-liaisons-alignees`, puis charge `flux.css` et `flux.js` ; aucune modification des variantes précédentes.
- `flux.js` construit des parcours invisibles à partir des segments orthogonaux existants et déplace un cercle SVG par nature avec `requestAnimationFrame`. Un passage prend 3,8 secondes, suivi d’une pause de 0,6 seconde ; les acteurs sont parcourus successivement. Le temps est figé lors d’une pause ou lorsque le document est masqué.
- Un `MutationObserver` reconstruit la couche lorsque le panorama ou son SVG sont remplacés, notamment après filtrage et redimensionnement. Il suit uniquement les changements d’enfants, pas les coordonnées animées, et ne recrée pas une couche déjà présente.
- `flux.css` limite la lueur aux points et masque la couche sous `prefers-reduced-motion`. Les données, fonctions de lecture/édition fictive, compteurs, liaisons et droits applicatifs ne sont pas modifiés.

## Vérifications de la maquette

[Rapport ciblé](controles.json), [lecture vidéo](lecture-video.json), [médias](medias.json). Déplacement réel des coordonnées SVG observé avec tracés identiques, maximum de deux points, pause stable, reprise, passage à un seul flux après filtre Interne, redimensionnement et préférence de mouvement réduit contrôlés. Aucune erreur JavaScript ni appel API métier observé dans l’enregistrement contrôlé. Le premier serveur statique n’était plus disponible ; un serveur local indépendant a été ouvert sans modification d’un service applicatif.

La vidéo est enregistrée dans Chromium puis recadrée sur le panorama, avec conservation de la plage colorimétrique. Les captures ne sont pas des images générées. Les dix dispositions et huit contrôles géométriques de la variante précédente restent historiques ; ils ne sont pas réattribués à cette animation. Aucune intégration ni vérification applicative effectuée pour cette proposition. Suite : validation du mouvement, puis intégration et contrôles du lot autorisé.
