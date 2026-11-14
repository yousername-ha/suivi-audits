# Refonte Neon, lot 1 : jetons Neon, menu bleu nuit opaque et vue analytique de l'accueil

13/11/2026, Europe/Paris. Session « Refonte Neon suivi-audits » (`session_01EnWdzg9gxV5Kzkp9Y5WBcd`), branche
`claude/refonte-neon` créée depuis `claude-suivi-smsi` (`967de1d`). Audit préalable : [AUDIT-CIBLE.md](AUDIT-CIBLE.md) et
[matrice](MATRICE-COMPATIBILITE.csv). Décision : [ADR 0093](../adr/0093-refonte-neon-charte-menu-et-accueil.md). **Point d'étape
demandé par le RSSI : arrêt après ce lot, en attente de validation des captures avant de poursuivre.** Les réponses du RSSI
aux questions du point d'étape sont intégrées (§ 5).

## 1. Résumé technique

| Sujet                 | Constat dans la cible                                                  | Décision du lot                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Palette               | Sauge (ADR 0015), aucun jeton Neon                                      | Jetons Neon de la référence portés dans `tokens.ts`/`theme.ts` (`--neon-*`), **rayons inchangés** (6–12 px, borne du test de contraste)                           |
| Menu                  | `Layout.tsx`, `famillesVisibles`, `useTriMenu`, `useAlertesMenu`, vert | Habillage bleu nuit opaque commun aux deux thèmes ; **même logique de navigation** (droits, ordre personnel, alertes, une famille dépliée, rail, tiroir)          |
| Pictogrammes          | Icônes 24 px monochromes par famille                                   | Huit SVG déclaratifs de la maquette retenue (`icones-menu.tsx`), cinq SVG d'administration statiques, teinte par identité (`data-identite`), aucun raster        |
| Animations            | Aucune dans le menu ; pas de pause globale                              | Mouvements internes aux dessins, **transform et opacity uniquement** ; bouton de pause (mémorisé dans le navigateur), pause si l'onglet est masqué, mouvement réduit |
| Accueil               | Tableau « verre et relief » personnalisable (ADR 0069, 0078)            | Seconde présentation « Vue analytique Neon » ; **le tableau personnalisable reste la vue par défaut** ; choix de la personne **enregistré dans son compte**         |
| Marque                | Pastille « S » dans l'en-tête ; logo de l'organisation déjà configurable | **Logo de Plateforme > Général** en tête du menu et dans l'en-tête (route publique existante), pastille « S » à défaut                                            |
| Carte CRRC            | Module retiré (ADR 0084), API absente                                  | Carte « Sauvegardes & résilience » **non reprise** : 11 visualisations au lieu de 12                                                                             |
| Cartographie, RETEX   | Plus récents que la référence                                          | Aucun fichier touché                                                                                                                                              |

### Réutilisé, adapté, laissé intact

- **Réutilisé tel quel** depuis la référence : `neon-graphiques.tsx` (anneau, colonnes, radar, échéances, courbes, motifs),
  `neon-donnees.ts`, l'essentiel de `neon-analytics.css`.
- **Adapté** : `NeonAnalytics.tsx` (sans CRRC, adresse actuelle du registre des incidents, nombre de cartes calculé, date
  sous `.horodatage` pour les captures), `neon.css` (finition globale sans imports de modules, sans règles de menu ni badge du
  bac à sable « sans connexion »), `styles.css` (seuls les écarts de palette de la référence ; les règles plus récentes de la
  cible, dont l'édition magnétique du tableau de bord, sont conservées), `Home.tsx` (bascule de présentation).
- **Nouveau** : `neon-menu.css`, `icones-menu.tsx`, `mouvement-menu.ts`, `MarqueOrganisation.tsx`, jetons `MENU` et
  `variablesMenu()`, couples de contraste du menu (vérifiés par le test existant), champ facultatif `accueil` des préférences.
- **Laissé intact** : navigation (`navigation.ts`, `pilotage-navigation.ts`, `tri-menu.ts`, `alertes-menu.tsx`), disposition et
  partage du tableau de bord, toutes les routes, l'API, la base, l'authentification.
- **Non porté** (lots suivants ou refusé) : dégradé ajouté à `graphiques.tsx` dans la référence (modifierait l'écran mural et la
  synthèse), `focus-fiche`, fenêtres, modules Studio, Assistant (backend sur une branche non fusionnée).

### Fichiers et contrats touchés

Code : `apps/web/src` (Layout, Home, Settings pour recharger le logo, composants nouveaux), `packages/ui` (jetons, thème,
feuilles et icônes), `packages/shared/src/affichage.ts` (un champ facultatif). Documentation : `docs/refonte-neon/`,
`docs/adr/0093-…`, index des ADR, `CHANGELOG.md`. Tests **ajoutés** (aucun test existant modifié) : `apps/web/test/`
`neon-donnees`, `neon-graphiques-rendu`, `icones-menu` ; `packages/ui/test/neon-graphiques` ; `packages/shared/test/`
`preferences-accueil`.

**Fichiers hors frontend touchés : un seul, `packages/shared/src/affichage.ts`**, décision du RSSI (choix de l'accueil
enregistré dans le compte) : un champ facultatif `accueil` du schéma zod des préférences, que la route existante
`/api/account/preferences` valide et enregistre telle quelle. Aucun fichier de `apps/api`, aucune migration (préférences
stockées en JSON), ni Compose, ni CI, ni authentification. Le choix de pause du menu reste dans le navigateur (confort
d'affichage). Aucun `id`, `name`, `data-testid`, `data-*` ou `aria-*` retiré ; ajouts : `data-identite`, `data-mouvement`,
`aria-pressed` du bouton de pause, `aria-label` de la bascule de présentation. Aucune dépendance ajoutée.

## 2. Poids du bundle (vite build, même machine)

| Fichier              | Base `967de1d`        | Lot 1                 | Écart                         |
| -------------------- | --------------------- | --------------------- | ----------------------------- |
| CSS principal        | 436 923 o (67 210 gz) | 462 119 o (72 102 gz) | +25 196 o (+5,8 %), +4 892 gz |
| JS principal         | 1 660 783 o (493 783) | 1 687 255 o (500 780) | +26 472 o (+1,6 %), +6 997 gz |
| JS Pilotage (chunk)  | 523 803 o (145 252)   | 523 441 o (145 288)   | −362 o, +36 gz                |
| **Total JS + CSS**   | 2 622 235 o (706 705) | 2 673 541 o (718 630) | **+51 306 o (+2,0 %), +11 925 gz (+1,7 %)** |

Gzip mesuré avec `gzip -9`. Polices et images inchangées.

## 3. Vérifications réellement exécutées

Environnement : conteneur de session, Node 22.23 (le dépôt exige Node 26 : contrôle de version relâché pour l'installation
seulement), pnpm 10.34.6, PostgreSQL 16 dédié et jetable (le dépôt cible PostgreSQL 18), API lancée par `tsx` sur les sources,
**bundle compilé servi avec l'en-tête CSP exact de `docker/Caddyfile`** (`style-src 'self'`, `script-src 'self'`) et relais vers
l'API. Données : jeu fictif du dépôt (`suivi jeu-de-test`), organisation « Organisation de démonstration ». Niveau de preuve :
**API et base réelles** (hors Docker et hors Caddy), sauf mention contraire.

| Contrôle                                                                   | Résultat                                                                         |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| ESLint du dépôt (`eslint . --max-warnings 0`)                               | réussi                                                                           |
| Prettier du dépôt (`prettier --check .`)                                    | réussi                                                                           |
| `tsc --noEmit` `packages/ui`, `packages/shared`, `apps/web`                 | réussi                                                                           |
| Vitest `packages/ui` (dont contrastes du menu)                              | 281/281 (279 existants + 2 ajoutés)                                              |
| Vitest `apps/web` (dont `charte.test.ts`)                                   | 230/230 (221 existants + 9 ajoutés)                                              |
| Vitest `packages/shared`                                                    | 606/606 (602 existants + 4 ajoutés)                                              |
| Script de recette du lot 1 bis (11 contrôles, API et base réelles)          | 11/11 : tableau personnalisable par défaut ; choix « Vue analytique » enregistré dans le compte (API) et retrouvé dans un autre navigateur vierge, sans stockage local ; « Modifier la disposition » ramène au tableau personnalisable ; logo fictif déposé par la route existante, affiché dans le menu et l'en-tête tablette, retiré, pastille « S » de repli |
| Script de recette du menu (18 contrôles, bundle compilé + CSP)              | 18/18 : keyframes limitées à transform/opacity, 8 animations, pause, reprise, mouvement réduit, coche entière au repos, habillage identique dans les 8 rubriques et les deux thèmes, aucune erreur JS ni CSP |
| Grille PC 1024×768 → 2560×1440, 1920×800, zoom 150 %, tablette, 390 px      | aucun débordement horizontal ; menu borné à la fenêtre, défilable, sans barre ; vue analytique en 4, 3, 2 ou 1 colonnes |
| E2E `menu-clavier`, `menu-ordre`, `coque`                                   | 9/9 (rejoués après le lot 1 bis : 9/9)                                           |
| E2E `zzzzz-accessibilite` (axe, 20 écrans × clair/sombre × ordinateur/390) | 5/5 (rejoués après le lot 1 bis : 5/5)                                           |
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

## 5. Réponses du RSSI au point d'étape (13/11/2026) et suites données

1. **Accueil** : sans droits, rien ; avec les droits, le tableau par défaut existant (tableau personnalisable), chacun
   choisissant son défaut, **enregistré dans son compte** → fait (préférence `accueil`). Les deux présentations ne s'affichent
   qu'avec un droit de lecture métier (`canReadBusiness`, comme le tableau existant) et leurs données restent filtrées par le
   serveur selon les droits de la personne. **Écart signalé, non traité** : le rôle prédéfini Contributeur lit tous les modules
   métier (`packages/shared/src/permissions.ts`) et voit donc le tableau de bord ; limiter un contributeur à ce qui lui est
   attribué (lui ou son groupe) change le modèle de droits, hors refonte graphique : **traité dans une autre session**
   (réponse du RSSI du 13/11/2026).
2. **Captures de référence Playwright** : régénération dans le conteneur officiel (CI), puis relecture image par image par le
   RSSI avant tout commit.
3. **ADR 0093** réservée et rédigée.
4. **Marque** : le logo configuré dans Plateforme > Général prend la place de la pastille ; pastille « S » à défaut.
5. **Entrée « Mes contributions RETEX »** : différence de teinte jugée imperceptible ; teinte Résilience conservée.
6. **Nouveaux tests** : ajouts autorisés, sans modification des tests existants → cinq fichiers ajoutés.

## 6. Incidents et limites

- Un processus Vite résiduel occupait le port lors d'un premier passage du script de recette, rejoué ensuite sur le bundle
  compilé avec la CSP (résultats ci-dessus).
- Rejeu de la série cartographie : il a fallu repartir d'une base neuve et vider les fichiers temporaires des e2e (comptes et
  sessions d'une base précédente) ; la série dépend de l'état laissé par l'installation.
- Le test de rendu des pictogrammes est placé dans `apps/web/test` : `packages/ui` n'a pas les types de `react-dom` et aucune
  dépendance n'est ajoutée.

Captures du lot 1 **validées par le RSSI le 13/11/2026** ; suite : [lot 2](LOT-2-FENETRES-LIGNES.md).
