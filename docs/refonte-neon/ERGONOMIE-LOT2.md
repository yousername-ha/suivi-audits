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
   parcours 29 de la recette de la carte, déjà ajusté à l'écran avant sa mesure dans la 7.3.0, n'a pas eu besoin d'autre
   adaptation.

## Méthode

Maquettes présentées au RSSI avant toute intégration. Toute modification de test ou de sélecteur est présentée et validée
avant le commit. Captures de référence régénérées dans le conteneur Playwright officiel, présentées en avant/après et
remplacées seulement avec l'accord du RSSI.

## Réalisation

- Maquettes présentées le 18/11/2026 et validées par le RSSI (planches avant/après, données fictives).
- Processus : `ProcessusStudio.tsx` sans bandeau, ligne `pr-resume` ; densité dans `neon-ergonomie.css`.
- Éléments par périmètre : `ElementsFiltres.tsx`, liste « Périmètre » visible (`.barre-avec-perimetre`).
- Documents : `FiltreColonneMultiple` et variante compacte de `FiltreColonne` (`BarreOutils.tsx`), `Documents.tsx`.
- Fenêtres : `--modal-size-lg` et `--modal-size-xl` à 64rem, présentations à 72rem.
- Tuile de l'assistant : réduite à l'avatar, libellé lu par les lecteurs d'écran, réserve en bas de `.shell-main`.
- Champs de tableau : contacts de crise (choix du RSSI : textes longs sur plusieurs lignes, téléphones et courriel sur une
  ligne ; Nom et Organisation suivent la même règle pour que plus rien ne soit coupé), étapes des scénarios, participants,
  note du plan d'audit.
- Titres en double : prop `titreVisible` de `FormSection`, transmise par les fenêtres d'Administration (Général,
  Référentiels, Apparence, Notifications, Conservation, Courriel, Sécurité, Import et export, Assistant RSSI). « Cycle » et
  « Sauvegardes » gardent leur titre intérieur, différent de celui de la fenêtre. Le panneau des flux vers l'extérieur
  (`FluxExternes.tsx`, autre session) n'est pas modifié.
- Carte : ajustement initial sur la taille réelle de la zone.
- Correctif : enjeux SWOT au format `{ text }` sur la carte (`packages/shared/src/carto/objects.ts`, test
  `carto-swot-texte.test.ts`).

## Tests

- Ajoutés : `apps/web/test/filtres-colonne.test.ts`, `apps/web/test/ergonomie-titres-champs.test.ts`,
  `packages/shared/test/carto-swot-texte.test.ts`.
- Adaptés avec l'accord du RSSI (18/11/2026), sans vérification retirée : `apps/web/test/studio-organisation-rendu.test.ts`
  (absence du bandeau, présence de la ligne des chiffres) et `tests/e2e/specs/zzzzzzzzzzzzzzzzzzzzzz-deplacement.spec.ts`
  (le périmètre se choisit dans la liste visible).
- Contrôles locaux : Prettier, ESLint, `tsc` (web, e2e, ui, shared), Vitest web 690, ui 284, shared 913.
