# Refonte Neon, lot 5 : SWOT relié aux processus et PESTEL

14/11/2026, Europe/Paris. Session « Refonte Neon suivi-audits » (`session_01EnWdzg9gxV5Kzkp9Y5WBcd`), portage confié à un
agent sur une copie de travail isolée, à partir de `a1d096a` (feuilles de style déclarées). Décision :
[ADR 0093](../adr/0093-refonte-neon-charte-menu-et-accueil.md). Référence : dossier de transmission, modules « SWOT relié aux
processus — Matrice Studio » (dernier modèle retenu, `51d7022`) et « PESTEL — constellation Studio » (`5dd1c68`), notes
`SWOT-STUDIO-INTEGRE`, `SWOT-CENTRE-AGRANDI-INTEGRE` et `PESTEL-STUDIO-INTEGRE`.

## 1. Ce qui est porté

| Écran                                           | Présentation portée                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organisation > Contexte > SWOT par processus    | Bandeau du processus (type, pilote, nombre d'analyses) et choix du processus ; matrice biseautée, quatre quadrants colorés avec axes interne/externe et favorable/défavorable ; grand cercle processus au croisement (184 px ordinateur, 134 px tablette, 120 px téléphone), découpes circulaires et réserves qui dégagent titres, compteurs, boutons et dernières lignes ; liaisons et pictogrammes animés, pause ; lecture agrandie d'un quadrant ; résumé du processus ; bandeau des analyses. |
| Organisation > Contexte > PESTEL                | Synthèse (externes, classés, à classer, internes) ; constellation des facteurs autour du nombre d'enjeux externes ; enjeux du facteur choisi avec leurs processus ; légende des facteurs ; bandeau ambre des enjeux externes à classer ; enjeux internes dans un panneau repliable, sans classement ; registre complet sur demande avec recherche.                                                                                                                                              |

Fichiers : `apps/web/src/pilotage/SwotMatrice.tsx`, `swot-presentation.ts`, `PestelStudio.tsx`, `pestel-presentation.ts`
(nouveaux) ; `Registry.tsx` (insertion de la matrice, 17 lignes) ; `Pestel.tsx` (le bandeau des parties intéressées du même
fichier n'est pas modifié) ; `packages/ui/src/neon-swot.css` et `neon-pestel.css` (déjà déclarés et importés).

## 2. Adapté à la version actuelle, et pourquoi

| Sujet                                  | Référence                                                     | Cible (ce lot)                                                                                                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registre SWOT                          | Replié derrière « Parcourir le registre »                     | **Toujours affiché sous la matrice** (région « Registre complet des analyses SWOT ») ; « Parcourir le registre » y conduit. Un test e2e existant (CAMP-C1-03) ouvre une analyse depuis sa ligne dès l'arrivée. |
| Périmètres                             | Cartes des processus et PESTEL limités au pilotage commun     | Les API actuelles servent chaque périmètre (référentiels en copie, ADR 0082 ; BUG-053) : cartes des processus et PESTEL sont lus dans le périmètre affiché, sans restriction ajoutée.                           |
| Analyses historiques hors socle        | —                                                             | L'API ne sert le registre historique des SWOT que sous le pilotage commun : ailleurs, ces références ne sont pas proposées (elles produiraient une erreur 404).                                                  |
| Facteur affiché par défaut             | « Technologique », s'il existe                                | Facteur de l'adresse, sinon le premier qui a des enjeux, sinon le premier : aucun identifiant de facteur privilégié.                                                                                           |
| Note méthodologique ISO 9001 (PESTEL)  | Repliée dans « À propos » (le test e2e avait été modifié)     | **Affichée** en bas de page : le test existant la cherche sans l'ouvrir, et les tests ne se modifient pas.                                                                                                      |
| Cercle et liaisons du SWOT             | Position et tracés calculés en JavaScript (ResizeObserver)    | Grille CSS : le cercle occupe la case du croisement réel, quelle que soit la hauteur des textes ; liaisons dessinées en CSS. Aucun style écrit par le script.                                                   |
| Animations                             | `stroke-dashoffset`, relief par translation du panneau        | `transform` et `opacity` seulement ; aucun texte ne bouge (le relief au survol change bordure et liseré, seul le pictogramme bouge). Mouvement réduit et impression : aucune animation, pause masquée.           |
| Couleurs                               | Palette locale en hexadécimal                                 | Jetons de la charte : `--carte-*` (quadrants), `--tdb-*` (facteurs), `--neon-*`, `--suivi-*`, `--mantine-*` ; clair et sombre. Couleurs forcées : contours système.                                             |
| Dimensions                             | Pixels, textes de 7 à 9 px                                    | rem (taille d'affichage du compte), aucun texte sous 0,6875 rem, rayons bornés à 12 px ; tailles du cercle en `max(rem, px)` pour garder 184/134/120 px au minimum.                                          |
| Disposition                            | Requêtes sur la largeur de fenêtre                            | Requêtes de conteneur : la largeur réellement disponible (menu ouvert ou replié, taille d'affichage) choisit la disposition ; PESTEL en grille de facteurs sur téléphone.                                       |
| Titres de quadrant                     | Coupés au besoin                                              | Jamais coupés au milieu d'un mot : le compteur passe à la ligne.                                                                                                                                              |
| Fenêtres (lecture agrandie, processus) | Habillage propre                                              | Habillage commun du lot 2 (`neon-fenetres.css`, non modifié) ; retour du focus par `retenirFocusFiche` à l'ouverture de la fiche.                                                                              |

Conservé à l'identique : appels d'API (`processus-cartes`, `objects?kind=process` paginé, `links`, lecture de la fiche,
`GET`/`PUT /pilotage/pestel`), droits (`useCan`, création et classement réservés à `pilotage:modifier`, lecture seule
sinon), filtres et recherche du registre dans l'adresse, historique « Décisions et réalisations », fiche `RecordEditor`,
erreurs (`ErrorAlert`, réessai), chargement, noms de processus et références non résolues affichées telles quelles.

## 3. Laissé de côté

- Aucun module retiré n'est réintroduit ; aucune donnée ni aucun lien n'est fabriqué par la présentation.
- Pas d'ouverture directe de la fiche du processus depuis le cercle : la page Processus n'offre pas d'ouverture par
  l'adresse ; le cercle ouvre, comme dans la référence, le résumé du processus réel.
- Pas de bascule « pause » mémorisée : la pause vaut pour la page (comme dans la référence).

## 4. Sélecteurs e2e vérifiés (conservés)

| Test                                                        | Sélecteur                                                                                     | État                                                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `zzzzzz-jeu-de-test` (PESTEL)                               | `getByText('Le PESTEL n’est pas exigé par la norme ISO 9001:2015')` visible                   | Note toujours affichée, texte identique, élément unique                                     |
| `zzzzzz-jeu-de-test` (PESTEL)                               | `getByLabel('Enjeux internes')` visible                                                       | `details[aria-label="Enjeux internes"]`, unique, visible replié                             |
| `rssi-virtuel/41` CAMP-C1-03                                | `/pilotage/swot` : `row` de l'analyse > bouton « Ouvrir » ; dialogue « Fiche — Analyse SWOT » | Registre affiché d'emblée, lignes et boutons inchangés ; `RecordEditor` non modifié          |
| `rssi-virtuel/41` CAMP-C1-05                                | API PESTEL seulement                                                                          | Inchangée                                                                                   |
| `zzz-pilotage`, `navigation.test.ts`                        | Rubriques « Contexte de l’organisation », routes `/pilotage/swot` et `/pilotage/pestel`       | Inchangées (navigation non touchée)                                                         |

Les libellés existants sont gardés (`Facteur de l’enjeu …`, « Enjeux externes non classés », « Tous les enjeux externes
sont classés. », texte de l'état vide). Aucune capture de référence ne couvre ces deux écrans.

## 5. Contrôles exécutés

Node 22 (contrôle de version relâché à l'installation), copie de travail du lot.

| Contrôle                                                                                    | Résultat                                                  |
| ------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `pnpm install --frozen-lockfile`, compilation de `packages/shared`, variables Mantine       | codes 0                                                   |
| ESLint (`--max-warnings 0`) et Prettier sur les fichiers modifiés                           | codes 0                                                   |
| `tsc --noEmit` `packages/ui` et `apps/web`                                                  | codes 0                                                   |
| Vitest `packages/ui`                                                                        | 284/284                                                   |
| Vitest `apps/web` (dont `charte`, listes, événements)                                       | 272/272 (251 + 21 ajoutés)                                |
| `vite build`                                                                                | code 0 (avertissement de taille de paquet préexistant)    |

Contrôle visuel dans Chrome (Playwright), sur un harnais temporaire non versionné rendant les deux composants avec des
réponses d'API fictives (pas d'API réelle) :

- SWOT, 1920, 1440, 1280, 1024, 768 et 390 px, deux thèmes, textes courts et longs : cercle de 184, 134 et 120 px, centre à
  0 px du croisement des panneaux, aucun texte (titres, compteurs, éléments, boutons) dans le dégagement du cercle, aucun
  débordement horizontal ni défilement intérieur ; taille d'affichage 115 et 150 % et zoom 150 % : mêmes résultats.
- PESTEL, 1440, 1280, 1024 et 390 px, deux thèmes : nomenclature usuelle, étendue (8 facteurs, libellé long), absente,
  lecteur sans droit de modification, textes longs ; aucun débordement ni défilement intérieur.
- Parcours : lecture agrandie puis retour du focus sur « Lire », résumé du processus puis retour du focus sur le cercle,
  pause, « Parcourir le registre » (focus sur le registre) ; facteur choisi écrit dans l'adresse, registre complet et
  recherche (focus sur le champ), panneau des internes.
- Axe-core (WCAG 2.1 A et AA) : 12 analyses (deux thèmes, six cas), aucune violation.
- Mouvement réduit et impression : aucune animation, pause absente ; images clés limitées à `transform` et `opacity`.

Poids (`vite build`, même machine, base `a1d096a`) : CSS 493,75 → 544,77 kB (+51,0 kB, gzip +8,2 kB) ; paquet Pilotage
530,33 → 561,14 kB (+30,8 kB, gzip +9,4 kB) ; JS principal inchangé.

### Non exécutés

- Tests de bout en bout, pile Docker, API et base réelles : à rejouer après intégration (CI de la PR).
- Lecteur d'écran, recette sur le serveur du RSSI, captures de l'application intégrée.

## 6. Risques et points d'attention pour l'intégration

- `Registry.tsx` est aussi visé par le portage des Parties intéressées : ici, seul le `return` final est encapsulé
  (`const registre = (…)` puis matrice SWOT pour `kind === 'swot'`). Une fusion avec l'autre lot se règle à cet endroit.
- `SwotMatrice` et `Pestel` lisent les cartes des processus par `CARTES_PROCESSUS_KEY` de
  `apps/web/src/processus/CartesProcessus.tsx` (lot Processus) : la clé doit rester exportée.
- La page SWOT fait désormais quatre lectures de plus (cartes des processus, processus natifs, relations du processus,
  analyse affichée) ; la page PESTEL, une (cartes des processus). Une erreur de l'une d'elles s'affiche sans bloquer le
  registre ni le classement.
- Aucun export ni import supplémentaire n'est nécessaire.
