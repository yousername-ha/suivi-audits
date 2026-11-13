# Refonte Neon, lot 1 : jetons Neon, menu bleu nuit opaque et vue analytique de l'accueil

13/11/2026, Europe/Paris. Session « Refonte Neon suivi-audits » (`session_01EnWdzg9gxV5Kzkp9Y5WBcd`), branche
`claude/refonte-neon` créée depuis `claude-suivi-smsi` (`967de1d`). Audit préalable : [AUDIT-CIBLE.md](AUDIT-CIBLE.md) et
[matrice](MATRICE-COMPATIBILITE.csv). **Point d'étape demandé par le RSSI : arrêt après ce lot, en attente de validation des
captures avant de poursuivre.**

## 1. Résumé technique

| Sujet                 | Constat dans la cible                                                  | Décision du lot                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Palette               | Sauge (ADR 0015), aucun jeton Neon                                      | Jetons Neon de la référence portés dans `tokens.ts`/`theme.ts` (`--neon-*`), **rayons inchangés** (6–12 px, borne du test de contraste)                           |
| Menu                  | `Layout.tsx`, `famillesVisibles`, `useTriMenu`, `useAlertesMenu`, vert | Habillage bleu nuit opaque commun aux deux thèmes ; **même logique de navigation** (droits, ordre personnel, alertes, une famille dépliée, rail, tiroir)          |
| Pictogrammes          | Icônes 24 px monochromes par famille                                   | Huit SVG déclaratifs de la maquette retenue (`icones-menu.tsx`), cinq SVG d'administration statiques, teinte par identité (`data-identite`), aucun raster        |
| Animations            | Aucune dans le menu ; pas de pause globale                              | Mouvements internes aux dessins, **transform et opacity uniquement** ; bouton de pause (mémorisé dans le navigateur), pause si l'onglet est masqué, mouvement réduit |
| Accueil               | Tableau « verre et relief » personnalisable (ADR 0069, 0078)            | Seconde présentation « Vue analytique Neon » ; **le tableau personnalisable reste la vue par défaut** (voir § 5, décision demandée)                              |
| Carte CRRC            | Module retiré (ADR 0084), API absente                                  | Carte « Sauvegardes & résilience » **non reprise** : 11 visualisations au lieu de 12                                                                             |
| Cartographie, RETEX   | Plus récents que la référence                                          | Aucun fichier touché                                                                                                                                              |

### Réutilisé, adapté, laissé intact

- **Réutilisé tel quel** depuis la référence : `neon-graphiques.tsx` (anneau, colonnes, radar, échéances, courbes, motifs),
  `neon-donnees.ts`, l'essentiel de `neon-analytics.css`.
- **Adapté** : `NeonAnalytics.tsx` (sans CRRC, adresse actuelle du registre des incidents, nombre de cartes calculé, date
  sous `.horodatage` pour les captures), `neon.css` (finition globale sans imports de modules, sans règles de menu ni badge du
  bac à sable « sans connexion »), `styles.css` (seuls les écarts de palette de la référence ; les règles plus récentes de la
  cible, dont l'édition magnétique du tableau de bord, sont conservées), `Home.tsx` (bascule de présentation).
- **Nouveau** : `neon-menu.css`, `icones-menu.tsx`, `mouvement-menu.ts`, jetons `MENU` et `variablesMenu()`, couples de
  contraste du menu (vérifiés par le test existant).
- **Laissé intact** : navigation (`navigation.ts`, `pilotage-navigation.ts`, `tri-menu.ts`, `alertes-menu.tsx`), disposition et
  partage du tableau de bord, toutes les routes, l'API, la base, l'authentification.
- **Non porté** (lots suivants ou refusé) : dégradé ajouté à `graphiques.tsx` dans la référence (modifierait l'écran mural et la
  synthèse), `focus-fiche`, fenêtres, modules Studio, Assistant (backend sur une branche non fusionnée).

### Fichiers et contrats touchés

`git diff --stat` par rapport à `origin/claude-suivi-smsi` : 8 fichiers modifiés (+396/−141) et 9 fichiers nouveaux, tous dans
`apps/web/src` et `packages/ui`, plus ce dossier `docs/refonte-neon/` et `CHANGELOG.md`.

**Fichiers hors frontend touchés : aucun** (ni `apps/api`, ni migration, ni Compose, ni CI, ni authentification). Aucun
contrat d'API, aucun DTO, aucune préférence serveur : le choix de pause et le choix de présentation de l'accueil sont gardés
dans le navigateur (`localStorage`, confort d'affichage, lecture protégée si le stockage est indisponible). Aucun test existant
modifié, aucun `id`, `name`, `data-testid`, `data-*` ou `aria-*` retiré ; ajouts : `data-identite`, `data-mouvement`,
`aria-pressed` du bouton de pause, `aria-label` de la bascule de présentation. Aucune dépendance ajoutée.

## 2. Poids du bundle (vite build, même machine)

| Fichier              | Base `967de1d`        | Lot 1                 | Écart                         |
| -------------------- | --------------------- | --------------------- | ----------------------------- |
| CSS principal        | 436 923 o (67 210 gz) | 461 651 o (71 989 gz) | +24 728 o (+5,7 %), +4 779 gz |
| JS principal         | 1 660 783 o (493 783) | 1 686 967 o (500 660) | +26 184 o (+1,6 %), +6 877 gz |
| JS Pilotage (chunk)  | 523 803 o (145 252)   | 523 441 o (145 289)   | −362 o, +37 gz                |
| **Total JS + CSS**   | 2 622 235 o (706 705) | 2 672 785 o (718 398) | **+50 550 o (+1,9 %), +11 693 gz (+1,7 %)** |

Gzip mesuré avec `gzip -9`. Polices et images inchangées.

## 3. Vérifications réellement exécutées

Environnement : conteneur de session, Node 22.23 (le dépôt exige Node 26 : contrôle de version relâché pour l'installation
seulement), pnpm 10.34.6, PostgreSQL 16 dédié et jetable (le dépôt cible PostgreSQL 18), API lancée par `tsx` sur les sources,
**bundle compilé servi avec l'en-tête CSP exact de `docker/Caddyfile`** (`style-src 'self'`, `script-src 'self'`) et relais vers
l'API. Données : jeu fictif du dépôt (`suivi jeu-de-test`), organisation « Organisation de démonstration ». Niveau de preuve :
**API et base réelles** (hors Docker et hors Caddy), sauf mention contraire.

| Contrôle                                                                   | Résultat                                                                         |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| ESLint (`packages/ui/src`, `apps/web/src`, 0 avertissement)                 | réussi                                                                           |
| Prettier sur les fichiers touchés                                           | réussi                                                                           |
| `tsc --noEmit` `packages/ui` et `apps/web`                                  | réussi                                                                           |
| Vitest `packages/ui` (dont contrastes du menu)                              | 279/279                                                                          |
| Vitest `apps/web` (dont `charte.test.ts`)                                   | 221/221                                                                          |
| Vitest `packages/shared`                                                    | 602/602                                                                          |
| Script de recette du menu (18 contrôles, bundle compilé + CSP)              | 18/18 : keyframes limitées à transform/opacity, 8 animations, pause, reprise, mouvement réduit, coche entière au repos, habillage identique dans les 8 rubriques et les deux thèmes, aucune erreur JS ni CSP |
| Grille PC 1024×768 → 2560×1440, 1920×800, zoom 150 %, tablette, 390 px      | aucun débordement horizontal ; menu borné à la fenêtre, défilable, sans barre ; vue analytique en 4, 3, 2 ou 1 colonnes |
| E2E `menu-clavier`, `menu-ordre`, `coque`                                   | 9/9                                                                              |
| E2E `zzzzz-accessibilite` (axe, 20 écrans × clair/sombre × ordinateur/390) | 5/5                                                                              |
| E2E `zz-modules`                                                            | 6/6                                                                              |
| E2E `disposition-tableau-de-bord`                                           | partage 1/1 ; disposition : échec **identique sur la base `967de1d`** (lecture des dalles avant leur chargement) |
| E2E `zzzzzz-jeu-de-test`                                                    | échec **identique sur la base `967de1d`** (« Référentiel fictif de démonstration » absent de la bibliothèque du jeu chargé) |
| E2E `recette-cartographie` (31 tests, captures de référence exclues)       | 31/31 assertions réussies sur base neuve + jeu fictif ; échec de la remise en état finale (`afterAll` : import du module technique « schema » refusé par l'API), sans lien avec l'interface |
| E2E `retex` (dont « générer et diffuser la chronologie »)                  | 3/3                                                                              |
| E2E `tous-ecrans` : largeur exploitée à 2560 et 3840 px                     | 2/2                                                                              |

### Non exécutés

- Captures de référence Playwright (`visuel.spec.ts`, `tous-ecrans.spec.ts`, `carte-contexte-*`) : elles se comparent dans le
  conteneur Playwright officiel ; **elles changent par construction** (menu, palette) et leur régénération demande l'accord
  du RSSI. Contrôle indicatif : `carte-contexte-390-clair` diffère de 3 % des pixels, sur la marque, les boutons principaux
  (palette) et l'anticrénelage du texte (rendu de ce conteneur) ; la disposition du canevas est inchangée.
- Suite e2e complète dans l'ordre de la CI (installation comprise) : seules les séries ci-dessus ont été rejouées.
- Pile Docker complète, Caddy, Node 26, PostgreSQL 18, CI GitHub, recette sur le serveur du RSSI.

## 4. Captures

Captures de l'application intégrée (bundle compilé + CSP + API + base), 1920×1080 à densité 2, thème clair et thème sombre,
version 6.3.0 de la branche `claude/refonte-neon`, données fictives : vue analytique, tableau personnalisable, famille
Conformité dépliée sur la Bibliothèque. Elles sont transmises dans la conversation et ne sont pas versionnées (poids).

## 5. Décisions demandées, incidents et limites

1. **Vue par défaut de l'accueil.** La référence ouvrait la vue analytique quand aucune disposition n'est enregistrée. La cible
   attend « Prochaines échéances » sur `/` (`tous-ecrans.spec.ts`, lignes 95 et 163) : rendre la vue analytique par défaut
   impose d'adapter ces deux attentes et de régénérer les captures. Le lot garde donc le tableau personnalisable par défaut et
   mémorise le choix de chaque navigateur.
2. **Captures de référence Playwright** à régénérer (accord nécessaire).
3. **ADR** : la palette Neon remplace de fait la direction Sauge (ADR 0015) ; un numéro d'ADR est à attribuer par le RSSI.
4. Entrée conditionnelle « Mes contributions RETEX », absente de la maquette : teinte de la famille Résilience et pictogramme
   statique de même trait.
5. Marque : la maquette affiche « ✧ » et « ISO 27001 / HDS » ; le menu garde la marque « S » et la signature « Qualité,
   sécurité et référentiels » de l'application (produit multi-référentiels).
6. Incident de recette : un processus Vite résiduel occupait le port lors d'un premier passage du script de recette, rejoué
   ensuite sur le bundle compilé avec la CSP (résultats ci-dessus).

Prochaine action : validation des captures par le RSSI, puis lot 2 (fenêtres et lignes ouvrables) sur les choix déjà validés.
