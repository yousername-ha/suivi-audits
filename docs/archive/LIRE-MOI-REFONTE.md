# Refonte graphique « Sauge » — Suivi des audits SMSI

Copie réalisée à partir de `suivi-audits-refonte-cartographie.zip`, branche communiquée `refonte/cartographie`.

## Voir le résultat

Ouvrir `docs/refonte-ui/index.html` dans un navigateur pour consulter les aperçus, sans installer l’application. Le code de l’application est déjà modifié dans ce dossier. La galerie présente des captures réelles du rendu, pas une maquette indépendante.

## Direction graphique

- Blanc cassé, vert profond et accents sauge ; les couleurs de statut et les teintes métier de la cartographie restent distinctes.
- Inter variable, embarquée localement avec sa licence SIL OFL. Aucun nouveau paquet applicatif.
- Navigation lisible, cartes espacées, titres hiérarchisés, tableaux et formulaires harmonisés.
- Tableau de bord : mise en valeur du prochain audit, séparation des indicateurs d’écarts, barres de répartition fondées sur les valeurs existantes.
- Connexion : composition éditoriale sur ordinateur et formulaire recentré sur téléphone.
- Apparitions courtes et retours de survol, sans animation en boucle. Le réglage système de réduction des animations est respecté.
- Modes clair et sombre, navigation mobile et tablette préservés.

## Périmètre exact

Sept fichiers source existants sont modifiés :

| Fichier | Modification |
| --- | --- |
| `packages/ui/src/tokens.ts` | Palette et typographie |
| `packages/ui/src/styles.css` | Styles partagés, navigation, surfaces, états et adaptation aux écrans |
| `apps/web/src/components/Layout.tsx` | Habillage de l’en-tête et de la navigation |
| `apps/web/src/components/Synthese.tsx` | Présentation des mêmes indicateurs et graphiques de répartition |
| `apps/web/src/pages/Home.tsx` | Hiérarchie du tableau de bord et cartes d’accès |
| `apps/web/src/pages/Login.tsx` | Habillage du parcours de connexion existant |
| `app/public/index.html` | Ajout du bloc CSS autonome `sauge-ui` uniquement |

Les deux fichiers WOFF2 et leur licence sont ajoutés dans `packages/ui/src/fonts/`. Le journal des modifications et une note de décision graphique sont également fournis.

Les 106 fichiers vérifiés du serveur, du paquet partagé, du manifeste racine et du lockfile sont identiques à l’archive d’origine. Les 12 blocs de script de l’outil historique sont identiques octet pour octet ; retirer le bloc CSS `sauge-ui` restitue exactement le HTML initial. Aucun schéma, migration, droit, appel API, gestionnaire d’événement ou mécanisme d’authentification n’a été modifié. Aucun changement n’a été envoyé à GitHub et aucun déploiement n’a été effectué.

## Intégrer la copie

Travailler sur une branche dédiée dans le dépôt réel. Reporter les sept fichiers ci-dessus et le dossier de polices, ainsi que les notes de documentation souhaitées. Ne pas écraser une version plus récente sans comparer les différences. Conserver le changement du fichier historique dans un commit distinct, conformément aux consignes du projet.

Les commandes habituelles du projet restent celles du `README.md` et de `CONTRIBUTING.md`. La génération des variables CSS intervient automatiquement dans la construction web ; ne pas modifier manuellement `apps/web/src/generated/mantine-vars.css`.

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm --filter @suivi/ui test
pnpm --filter @suivi/web test
pnpm --filter @suivi/ui typecheck
pnpm --filter @suivi/web typecheck
pnpm --filter @suivi/shared build
pnpm --filter @suivi/web build
```

Les fichiers de données et la configuration serveur ne font pas partie de cette refonte. Le ZIP ne contient ni `node_modules`, ni secrets, ni dépendances de recette, ni serveur de démonstration.

## Vérifications réalisées et limites

- Compilation des paquets partagé et web : réussie.
- ESLint et vérification TypeScript des paquets UI et web : réussis.
- 102 tests existants de charte/contraste et 3 tests de centralisation des styles : réussis.
- Formatage des sources modifiées : vérifié.
- Rendu inspecté dans Chromium : accueil, documents, cartographies contexte/processus, connexion, outil historique et CRRC ; clair, sombre, téléphone 390 px, tablette 768 px, ordinateur et grand écran 2560 px selon les captures.
- Menu mobile, filtrage documentaire, fiche mobile, entrée en édition de carte, ouverture de l’ajout d’objets, navigation CRRC et paramètres historiques : contrôlés avec des réponses API fictives et isolées.
- Aucun débordement horizontal de page dans les cas mesurés. Les tableaux larges conservent leur défilement interne.
- Aucun nouvel échec JavaScript dans les parcours de recette. Un signal CSP `script-src: eval` a été observé dans le bundle de la nouvelle application et reproduit avec les sources originales reconstruites ; il est antérieur à cette refonte. La CSP n’a pas été assouplie. Aucun signal CSP dans les parcours historiques après application de l’adaptation locale des ressources prévue par le serveur.
- L’avertissement de taille de bundle Vite était déjà présent dans la construction d’origine.

La recette visuelle utilise des données fictives ; elle ne remplace pas les tests de bout en bout avec PostgreSQL, Docker, TOTP, fichiers et droits réels. Cette pile n’était pas disponible ici. Les captures de référence de la CI d’origine sont volontairement conservées : après validation visuelle sur la pile officielle, les régénérer avec la commande documentée dans `CONTRIBUTING.md`. Aucun résultat de test serveur complet n’est revendiqué.

## Revenir au rendu précédent

Restaurer les sept fichiers source depuis la branche initiale et retirer les polices ajoutées. Aucune migration de données n’est nécessaire pour annuler les seuls changements de cette refonte.
