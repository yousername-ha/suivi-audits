# ADR 0011 — Charte graphique unique et page Paramètres

**Statut** : acceptée (phase 0, chantier 9 ter).

## Contexte
L'interface doit garder l'identité de l'outil historique : encre #14213D, vert #0D6B6B, violet #5A48B5, fonds #EDF1F0 et #FFFFFF, rayons arrondis, police système. Elle doit exister en mode clair et en mode sombre, respecter les contrastes WCAG AA et rester compatible avec la CSP stricte (aucun style injecté). Les paramètres tenaient dans une petite fenêtre ; ils deviennent une page complète, utilisable au téléphone.

## Décision
- **`packages/ui`**, source unique de la charte :
  - `tokens.ts` : couleurs, nuances, fonds par mode, rayons de 6 à 12 px, espacements, points de rupture, polices, calcul de contraste ;
  - `theme.ts` : thème Mantine et résolveur de variables CSS ;
  - `styles.css` : coquille de l'application, largeurs de lecture et de formulaire, chiffres tabulaires, densité ;
  - composants communs : `Page`, `PageHeader`, `DataTable`, `FormSection`, `StatusChip`, `ConfirmDialog`, `ConfirmButton`, `ErrorAlert`.
- Les variables Mantine, y compris celles du mode sombre, sont **écrites dans un fichier statique** à la construction (`apps/web/scripts/mantine-css-vars.ts`), à partir du thème de `packages/ui`.
- **Garde-fous automatiques** :
  - `packages/ui/test/contraste.test.ts` vérifie chaque couple texte et fond (seuils 4,5 pour le texte, 3 pour les composants), en clair et en sombre ;
  - `apps/web/test/charte.test.ts` échoue sur toute couleur, tout style en ligne ou toute taille numérique codés dans l'interface, ainsi que sur toute longueur en px ou rem dans ses feuilles de style.
- **Page Paramètres** (`/parametres/:section`) :
  - huit sections : Général, Cycle d'audit et années, Référentiels, Apparence, Notifications, Import et export, Sauvegardes, Sécurité ;
  - chaque section a sa version (`If-Match`, 412 en cas de modification concurrente), son bouton Enregistrer, l'indication des modifications non enregistrées, une confirmation avant de la quitter, et sa trace dans le journal (avant/après).
- **Mise en page** : sur grand écran (≥ 1024 px), navigation latérale ; sur tablette et téléphone, sélecteur de section en haut, champs en pleine largeur, aucun défilement horizontal.
- **Permissions** :
  - lecture : `parametres:lire` ;
  - enregistrement : `parametres:modifier` ;
  - la Sécurité exige `parametres:administrer` ;
  - le Cycle d'audit et les Référentiels, écrits dans l'état de l'outil historique, exigent aussi `audit:modifier` et `conformite:modifier`.
- **Politique de sécurité réglable**, avec des bornes non négociables :
  - mot de passe d'au moins 12 caractères ;
  - session de 1 à 24 h, inactivité de 5 à 240 min ;
  - verrouillage après 3 à 10 échecs ;
  - double authentification toujours obligatoire.

  Les valeurs du fichier `.env` servent de valeurs par défaut.
- **Captures de référence** : Playwright compare les pages Paramètres et Administration à 1440, 768 et 390 px, en clair et en sombre. Les tests de bout en bout s'exécutent dans le **conteneur Playwright officiel** (`tests/e2e/run-in-container.sh`), en local comme en CI, pour un rendu identique.

## Conséquences
- Tout nouvel écran utilise les composants et les jetons de `packages/ui`. Un nouveau besoin graphique se traite par un jeton ou un composant de la charte, jamais par une valeur locale.
- Toute évolution visuelle volontaire régénère les captures (`./tests/e2e/run-in-container.sh --update-snapshots`), relues dans la PR.
- Aucune nouvelle dépendance : le paquet `packages/ui` n'utilise que Mantine et React, déjà retenus (ADR 0006, 0009).
