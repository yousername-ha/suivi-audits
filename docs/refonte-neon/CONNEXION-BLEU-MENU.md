# Écran de connexion aux couleurs du menu

19/11/2026. Session « Refonte Neon suivi-audits » (`session_01EnWdzg9gxV5Kzkp9Y5WBcd`), branche `claude/connexion-bleu-menu`,
partie de `claude-suivi-smsi`.

## Demande et décisions du RSSI (19/11/2026)

Demande : remplacer le violet de l'écran de connexion et de la ligne du fond par le bleu du menu, et porter des
référentiels de cybersécurité sur les ronds de la ligne.

Décisions prises sur maquettes (données fictives), dans cet ordre :

1. Deux variantes présentées : panneau blanc avec accents bleus (A), panneau bleu nuit du menu (B). B, puis B rendu
   transparent, ont été écartés (trop foncé sur le fond blanc). A est retenu.
2. Les cartes Identifiant et Mot de passe prennent le bleu nuit du menu au lieu d'un bleu pâle.
3. Le bouton « Se connecter » prend le bleu nuit du menu, avec l'effet verre de la recherche du menu : lueur bleue qui fait
   le tour du cadre et reflet bleu transparent de gauche à droite.
4. Ronds de la ligne : ISO 27001, HDS, ISO 27005, NIS 2, CRA, ISO 27035, EBIOS RM, ISO 27002 (RGPD et ISO 9001 retirés).

## Réalisation

- `packages/ui/src/neon-ergonomie.css`, section « Écran de connexion aux couleurs du menu » : les variables
  `--suivi-nav-*` et `--suivi-turquoise*` sont redéfinies sur la toile du fond et sur le panneau de connexion seulement,
  à partir des jetons du menu (`--menu-*`). Le reste de l'application garde ses couleurs.
- `apps/web/src/connexion/FondConnexion.tsx` : les teintes du fond animé sont lues sur la toile elle-même (et non plus sur
  la racine du document), pour suivre ces variables. Libellés des ronds en 11 px au lieu de 10 px.
- `apps/web/src/connexion/fond-geometrie.ts` : nouvelle liste `LIBELLES`.
- Lueur du bouton : rotation seule (`transform`), arrêtée par le mouvement réduit, l'impression et les couleurs forcées.
- Contraste : contrôle axe (WCAG 2.1 AA) sans violation en clair et en sombre.

## Tests

- Adapté avec l'accord du RSSI (19/11/2026), sans vérification retirée : `apps/web/test/fond-connexion.test.ts` (liste
  exacte des nouveaux libellés).
- Aucune capture de référence ne montre l'écran de connexion : aucune capture à remplacer.
