# Refonte Neon, lots 3 et 5 : lecture distincte, Parties intéressées et Processus Studio

14/11/2026, Europe/Paris. Session « Refonte Neon suivi-audits » (`session_01EnWdzg9gxV5Kzkp9Y5WBcd`), portage parallèle
sur une copie de travail issue de `a1d096a` (branche `claude/refonte-neon`). Décision :
[ADR 0093](../adr/0093-refonte-neon-charte-menu-et-accueil.md), § 7 (lecture distincte limitée au Contexte, aux Parties
intéressées et aux Processus, décision du RSSI du 13/11/2026). Référence : branche
`codex/transmission-neon-opus-5-5`, modules « Organisation — Périmètre et contexte », « Parties intéressées — panorama
centré et liaisons » et « Processus — cartes Studio et lecture distincte » de `04-PORTAGE-PAR-MODULE.md`.

## 1. Ce qui est porté

| Écran (route)                                        | Porté                                                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organisation > Périmètre et contexte (`/pilotage/contexte`) | Une fiche existante s'ouvre en **présentation** (`ContextPresentation.tsx`) : dossier à cinq sections, Interfaces / Dépendances / Enjeux internes / Enjeux externes et « À préciser » (`categories-contexte.ts`, `liste-interfaces.ts`), cadre Biseau propre et cinq pictogrammes animés, Agrandir / Réduire, onglets Liens et justificatifs et Historique en lecture. « Modifier » ouvre le formulaire existant ; « Annuler » revient à la lecture sans brouillon ; « Enregistrer » garde la sauvegarde existante. Aide de saisie des catégories sur les deux champs. Bouton de ligne « Afficher ». |
| Parties intéressées (`/pilotage/parties`)            | `PartiesInteresseesStudio.tsx` : panorama centré (internes à gauche, externes à droite, nature inconnue à part), liaisons orthogonales (`parties-liaisons.ts`), deux points lumineux au plus, pause et mouvement réduit ; liste compacte ; recherche et filtres sur les fiches chargées ; compteurs « chargées sur n » ; pagination existante. Consultation distincte (`PartiePresentation.tsx`), puis formulaire existant. |
| Processus (`/pilotage/processus-cartes`)             | `ProcessusStudio.tsx` : bandeau du périmètre, cartes par type du registre, pilotes, cinq compteurs de rattachements, dépliage centré (finalité, sous-processus), liste compacte et critères (recherche, type, pilote, rattachement) ; résultats défilant dans leur zone. Consultation `ProcessusPresentation.tsx` (identité, finalité, rattachements par catégorie et origine), puis formulaire existant `FicheCarteProcessus` (Annuler et retour à la lecture après enregistrement). |

Feuilles : `neon-fenetres.css` (fin de feuille, présentation du Contexte), `neon-parties.css`, `neon-processus.css`.

## 2. Adapté à la version actuelle, et pourquoi

- **Droits et fonctions de la cible conservés** : la commande « Archiver la fiche » (BUG-052) reste disponible dans les
  présentations, selon le droit de suppression ; le sélecteur de registre, la migration d'étude, `allowDeselect` des
  listes et toutes les requêtes restent ceux de la cible. Les branches BIA de la référence ne sont pas reprises (hors lot).
- **Une création de processus ouvre toujours le formulaire** (la référence ouvrait la consultation) : c'est le
  comportement de la création d'un contexte, et le parcours e2e existant attend les rattachements juste après la
  création.
- **Parties intéressées : registre détaillé replié, pas démonté.** La référence réindentait tout `BusinessRegistry` ; ici
  un attribut `data-registre-parties` et une règle CSS replient le registre (filtres d'URL, commandes, décisions et
  réalisations conservés). Diff de `Registry.tsx` limité à des blocs ajoutés. Le registre s'ouvre d'emblée si une
  recherche ou un filtre d'URL est actif ; le focus va à son titre, puis revient au bouton du panorama au repli.
- **Bandeau « Synthèse des parties intéressées » conservé** : la référence le remplaçait par les compteurs du Studio,
  mais un parcours e2e (`zzzzzz-jeu-de-test`) le lit. Les deux coexistent (voir § 5).
- **Nom du périmètre** lu dans le cache existant (`usePerimetres`, clé `['grc','smsis']`) au lieu d'une prop passée par
  `Pilotage.tsx`, qui n'est pas modifié ; le sélecteur de périmètre est raccourci par CSS seulement, libellé et aide
  conservés.
- **Liens d'une présentation** lus avec le périmètre affiché (`smsi`), comme le composant `Relations` du formulaire
  (même clé de cache), et non avec `object.smsiId`.
- **Palette** : les couleurs codées de la référence sont remplacées par les jetons du thème (surfaces, texte, `--neon-*`,
  palette de la carte `--carte-<teinte>-accent/-doux` pour les types de processus et les natures, couleurs d'état
  `--mantine-color-*-filled` sous texte blanc). Contrastes calculés ≥ 4,5:1 pour les textes sur fonds unis, clair et
  sombre.
- **Animations** : les points lumineux se déplacent par l'attribut `transform` (la référence modifiait `cx`/`cy`) ;
  pictogrammes et orbite en transform/opacity ; arrêt en mouvement réduit, en pause, onglet masqué et à l'impression ;
  contours système en couleurs forcées.
- **Biseau** : la présentation du Contexte garde son cadre propre (coins SVG) ; elle est ajoutée aux exclusions du Biseau
  commun (`:not(.retex-modal, .contexte-presentation, [data-full-screen])`), sans toucher aux autres exclusions (RETEX,
  plein écran, menu mobile). Les règles du Contexte reprennent la spécificité des règles communes pour les remplacer.
- **Origine des rattachements** dans la consultation d'un processus : un objectif se détache dans le formulaire du
  processus (règle de la cible) ; il n'est donc pas présenté « géré dans sa source ».
- **Sous-processus** : le dépliage d'une carte montre tous ses sous-processus (les critères portent sur les cartes) ; un
  enfant trouvé par les critères reste visible quand son parent ne l'est pas (`regrouperProcessus`).

## 3. Laissé de côté

- Changements de `Pilotage.tsx` de la référence (prop `scopeName`, classe du sélecteur, remplacement du bandeau) : fichier
  partagé, remplacés comme indiqué au § 2.
- Tests e2e de la référence (`parties-studio.spec.ts`, `contexte-presentation`, adaptation de `processus-cartes`) : aucun
  test existant n'est modifié ; pas de nouveau test e2e non rejouable ici.
- `eslint.config.js`, `theme.ts`, `Layout.tsx` (badge du profil « interfaces ») et `focus-fiche.ts` de la référence : sans
  objet ou déjà portés au lot 2.
- Règles devenues inutiles d'`app.css` (`.section-processus`, `.grille-processus`, `.carte-processus__*`) : fichier
  partagé, laissées ; `.carte-processus` est neutralisée dans `neon-processus.css`.

## 4. Sélecteurs e2e vérifiés

Recherchés dans `tests/e2e/specs` et `tests/e2e/rssi-virtuel`, tous conservés :

- `zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-processus-cartes` : bouton « Nouveau processus » (le « + » est
  `aria-hidden`), dialogues « Nouveau processus » et `${id} · ${nom}`, « Rattacher : Objectifs », « Détacher … »,
  `getByRole('region', { name: <type> })`, `.carte-processus` (gardée sur la carte Studio), texte « Objectifs 1 »,
  bouton `/Afficher les sous-processus \(1\)/`, axe WCAG 2 A/AA de la page.
- `zzz-pilotage` : titres « Périmètre et contexte » (h1) et navigation vers « Parties intéressées », inchangés.
- `zzzzzz-jeu-de-test` : `getByLabel('Synthèse des parties intéressées')` contenant « non revues depuis un an ».
- `rssi-virtuel` (hors CI des PR) : `CAMP-C1-03` porte sur le SWOT (formulaire inchangé) ; `RSSI-23` trouve « Rechercher
  un processus » ; `RSSI-05` (marqué `test.fail`) cherche une ligne de tableau sur `/pilotage/parties` : le registre est
  désormais replié par défaut (la fiche est une carte « Afficher … » du panorama).
- Autres registres : ouverture, titre « Fiche — … » et bouton « Fermer » inchangés (vérifié sur Revues de direction).

## 5. Contrôles exécutés

Node 22 (contrôle de version relâché pour l'installation), copie de travail à `880aee5`.

| Contrôle                                                                       | Résultat                     |
| ------------------------------------------------------------------------------ | ---------------------------- |
| `pnpm install --frozen-lockfile`, `tsc` du paquet partagé, variables Mantine   | réussis                      |
| ESLint et Prettier des 23 fichiers modifiés ou ajoutés                         | réussis (0 avertissement)    |
| `packages/ui` : `tsc --noEmit`, Vitest                                         | réussi, 284/284              |
| `apps/web` : `tsc --noEmit`, Vitest (dont `charte`, `listes-sans-deselection`) | réussi, 288/288 (251 + 37 ajoutés) |
| `apps/web` : `vite build`                                                      | réussi (avertissement connu : chunks > 900 ko) |
| Recette navigateur locale (24 contrôles, détail ci-dessous)                    | 24/24                        |

Recette locale : bundle compilé servi avec la CSP exacte de `docker/Caddyfile`, API sur les sources, PostgreSQL 16 local,
base neuve et données fictives, Chromium. Contrôles : présentation du Contexte sans champ, axe sans violation, plein
écran, Modifier / Annuler sans brouillon, enregistrement (version 2, texte des enjeux non réécrit), création en
formulaire direct, retour du focus à la ligne ; autre registre inchangé ; panorama des parties (5 branches, 2 sorties,
au plus 2 points), centrage du cercle sur la rangée des cartes (écart ≤ 2 px), axe sans violation, filtres et liste
compacte, consultation → modification → annulation → fermeture avec retour du focus, registre détaillé et fenêtre des
décisions, mouvement réduit ; **parcours e2e `processus-cartes` rejoué à l'identique (axe compris)**, consultation et
formulaire d'un processus, enfant trouvé sans son parent ; thème sombre à 1024, 1440, 1920 et 390 px sans débordement
horizontal ; compte lecteur sans commande « Modifier » ni « Nouveau processus » ; aucune erreur JavaScript ni violation
CSP. Le script et les captures restent hors Git.

Poids (même machine, `vite build`) : CSS principal 493,75 → 543,25 ko (+49,5 ko, +7,6 ko compressés) ; chunk Pilotage
530,33 → 575,48 ko (+45,2 ko, +12,8 ko compressés) ; JS principal inchangé.

### Non exécutés

Suite e2e complète dans l'ordre de la CI, captures de référence Playwright (elles changent sur ces écrans), pile Docker,
Node 26, PostgreSQL 18, lecteur d'écran, recette par le RSSI.

## 6. Limites et points ouverts

- Sur Parties intéressées, le bandeau historique (registre de l'outil de suivi seul, constat RSSI-05) et les compteurs du
  Studio (fiches chargées, natives comprises) peuvent différer. Retirer le bandeau suppose de modifier le parcours e2e
  qui le lit : décision du RSSI.
- La lecture distincte ne vaut que pour le Contexte, les Parties intéressées et les Processus ; les autres fiches gardent
  leur formulaire (ADR 0093, § 7).
- Fichiers partagés touchés hors du périmètre annoncé : `Fields.tsx` (aide de saisie du Contexte, une constante et une
  ligne) et `Registry.tsx` (blocs ajoutés pour les parties, libellé « Afficher » pour le Contexte et les parties).
  Aucun export ni import supplémentaire n'est nécessaire (les feuilles étaient déjà déclarées).
