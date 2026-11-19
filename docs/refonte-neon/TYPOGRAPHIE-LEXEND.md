# Police Lexend et liens redessinés

19/11/2026. Session « Refonte Neon suivi-audits » (`session_01EnWdzg9gxV5Kzkp9Y5WBcd`), branche `claude/typographie-lexend`,
partie de `claude-suivi-smsi`.

## Demande et décisions du RSSI (19/11/2026)

1. « Revoir l'écriture de toute la plateforme » : la police et les textes. Ce lot traite la police et les liens ; les textes
   seront raccourcis dans un lot à part.
2. Maquettes (données fictives) : Inter réglée, Source Sans 3, IBM Plex Sans, Atkinson Hyperlegible Next, puis, à la
   demande du RSSI, sept polices de plus (Manrope, Plus Jakarta Sans, DM Sans, Figtree, Geist, Nunito Sans, Lexend),
   comparées sur le tableau de bord, Processus, la Cartographie, les Registres et Machines. Le RSSI retient Lexend.
3. Liens : le RSSI trouve les liens soulignés « vieille page web ». Trois styles présentés ; retenu : lien bleu du menu,
   soulignement fin et pâle qui fonce au survol ou au focus.

## Réalisation

- Polices : `packages/ui/src/fonts/lexend-latin-wght-normal.woff2` et `lexend-latin-ext-wght-normal.woff2` (Lexend
  variable, SIL OFL 1.1, licence dans `fonts/LICENSE`), servies par la plateforme (CSP `font-src 'self'`). Inter retirée.
- `tokens.ts` : `POLICE` commence par Lexend. `theme.ts` : titres en 600, graisse `medium` à 500.
- `styles.css` : `@font-face` Lexend, texte courant sans resserrement (`letter-spacing: 0`), titres à -0,015 em.
- `neon-assistant.css` : la police de l'Assistant suit `--mantine-font-family` au lieu d'Inter écrit en dur.
- `docker/maintenance/maintenance.css` : la page de maintenance des mises à jour charge Lexend (même dossier de polices,
  copié par l'image `web`).
- Liens (`styles.css`, fin du fichier) : liens Mantine et liens simples du contenu, des fenêtres, des tiroirs et des listes
  déroulantes, hors navigation et onglets. Couleur `--suivi-lien` (bleu du menu mêlé au bleu nuit en clair, contraste de
  6,2 sur blanc ; bleu du menu en sombre). Le soulignement reste visible : un lien se reconnaît sans la couleur
  (WCAG 1.4.1). L'habillage des liens en pastille des fenêtres (`neon-fenetres.css`) est retiré.

## Tests

- Aucun test existant modifié. Tests unitaires : ui 285, web 789, shared 1 140.
- Les captures de référence changent toutes (police) : elles seront régénérées dans le conteneur Playwright officiel et
  présentées au RSSI avant remplacement.
