> 01/11/2026 : [proposition de cible plus visible](propositions/cible-visible/README.md), **à valider avant toute intégration**. Nouvelle règle du demandeur : visuel → validation → modifications et tests → nouveau visuel réel. Code applicatif inchangé à ce stade.

> 01/11/2026 : [Objectifs et indicateurs : synthèse, cartes et fiches Neon](OBJECTIFS-INDICATEURS.md), captures réelles et contrôles.

> 01/11/2026 : [enjeux internes/externes et interfaces/dépendances distingués](CONTEXTE-CATEGORIES.md), captures et règles de lecture des textes existants.

> 01/11/2026 : [fenêtres Biseau et correction des dimensions](FENETRES-GLOBALES.md). Les dalles et corps de fenêtre ne défilent plus ; les longues fiches utilisent le voile extérieur.

> Rendu validé par le demandeur et intégré à la refonte : **cadre Biseau et cinq pictogrammes animés**. [État et contrôles](CADRES-NEON.md).

> Complément du 01/11/2026 : [vue de présentation du contexte pour consultation en audit](CONTEXTE-PRESENTATION.md).

> Complément du 01/11/2026 : [fenêtres, fiches et panneaux latéraux](FENETRES.md), captures et contrôles.

> Complément du 01/11/2026 : [dalles Périmètres en mode Graphe](DALLES-PERIMETRES.md).

> Complément : [intégration des graphiques et menus du prototype](PROTOTYPE-INTEGRE.md).

# Refonte graphique Neon — copie de main

Session : Codex. Référence : main 6.1.0, commit `6a59d3f919523fdb2da0987659c190e2ad5bea37`, vérifié par le connecteur GitHub le 31 octobre 2026 (Europe/Paris).
Copie indépendante : `/workspace/work/codex-grc-neon`, branche `codex/refonte-neon-main`. Le dépôt `/workspace/suivi-audits` n'a pas été modifié.

## Périmètre

Remplacement global de la palette Sauge par Neon Analytics, sans modification de calcul, permission, endpoint, modèle, route ni contenu métier. Les couleurs sémantiques de risque, de conformité et d'incident restent indépendantes des accents décoratifs. Aucun chiffre n'est repris des images de référence.

Les valeurs internes `sage` et `clair` sont conservées pour relire les préférences existantes. Les deux styles utilisent désormais Neon ; le second conserve une variante de fond plus lumineuse. Le mécanisme existant de thème personnel/organisation, de stockage et de préférence système reste intact.

## Inventaire et architecture

Voir `inventaire.json` pour les chemins relevés. Points d'entrée : `apps/web/src/main.tsx`, navigation dans `navigation.ts` et `pilotage-navigation.ts`, coquille dans `components/Layout.tsx`. Mantine 9.7.3, React 19.3.1 ; graphiques SVG internes, sans nouvelle bibliothèque.

- `packages/ui/src/tokens.ts` : source des palettes clair/sombre, fonds, textes, accents, rayons et couples de contraste. `VERT` et `BRAND.vert` restent des alias publics historiques de l'accent d'action violet.
- `theme.ts` : thème Mantine commun, résolution des variables Neon et des couleurs sémantiques.
- `styles.css` : remplacement des couleurs historiques de navigation et du verre vert.
- `neon.css` : finitions communes, cartes, tables, champs, menus, dialogues, notifications, dashboard et mouvement réduit. Importée après les styles métiers pour couvrir les variantes spécialisées.
- `apps/web/scripts/mantine-css-vars.ts` : génération statique existante conservée, conforme à la CSP. Aucun style injecté et aucune dépendance ajoutée.

Palette : page sombre `#0c1328`, navigation `#0c1429`, surface `#18233e`, page claire `#f5f4f7`, surface blanche. Accent textuel violet assombri en clair et éclairci en sombre pour le contraste ; rose, cyan, bleu et orange décoratifs. Inter locale conservée. Cartes 14 px et panneaux 18 px. Focus visible et mouvements désactivés avec la préférence système ; animation des barres désactivée sur téléphone.

## Checklist et priorités

- [x] P0 : isoler une copie de main et inventorier les entrées graphiques.
- [x] P1 : palettes et thème global, navigation, typographie et surfaces.
- [x] P1 : primitives Mantine, cartes, tableaux, champs, dialogues, menus et notifications.
- [x] P2 : surfaces du dashboard et couleurs des séries décoratives ; données, seuils, légendes et alternatives textuelles préservés.
- [x] P2 : diffusion aux sept familles via leurs composants et leur fournisseur de thème communs. Aucune nouvelle rubrique ajoutée.
- [x] P2 : libellés d'apparence et aide actualisés ; contrats de préférences conservés.
- [x] P3 : compilation, lint, typage UI/web, tests sans base et captures d'échantillons dans les deux thèmes.
- [ ] P3 : recette humaine de chacune des 79 rubriques, formulaires ouverts, erreurs, permissions et exports avec API/PostgreSQL réelles.
- [ ] P3 : audit complet WCAG au clavier et lecteur d'écran ; contraste des couples de tokens testé, sans attestation WCAG exhaustive.
- [ ] P3 : validation visuelle utilisateur avant fusion et déploiement.

## Vérifications

Environnement local isolé, Node 26.13.0 et pnpm 10.34.6. Installation `--frozen-lockfile` réussie ; aucune modification du lockfile. Le cache préinstallé obsolète a d'abord empêché la compilation ; les résultats ci-dessous sont ceux obtenus après installation des versions prescrites.

- UI : 241 tests réussis, dont les couples de contraste WCAG AA (textes et focus/selection/navigation Neon inclus).
- Web : 212 tests réussis, dont navigation, charte sans couleurs en dur dans les écrans, droits côté UI et comportement existant.
- Shared : 624 tests réussis. Total : 1 077.
- TypeScript UI et web : code 0.
- ESLint dépôt complet : code 0 ; Prettier sur fichiers modifiés et `git diff --check` : code 0.
- Build web : code 0. Avertissements existants : script `/update/client.js` externe et chunk dépassant 900 ko. Pas de modification du découpage des modules.
- 42 captures Chromium : accueil, connexion, contexte Organisation, actions, incidents, documents et plateforme ; 1440, 1024, 390 px ; clair/sombre. Aucune erreur JavaScript ni débordement horizontal détecté dans cet échantillon.

Les captures rendent les composants réels avec réponses GET interceptées depuis l'export fictif fourni. Les endpoints absents de l'export répondent explicitement par une erreur de recette : certaines zones montrent donc l'état d'erreur. Ce dispositif reste extérieur au code applicatif. Il ne valide ni les mutations CRUD, ni les gardes serveur, ni la base. Les captures sont faites avec mouvement réduit pour être stables.

## Différences connues et suite

La composition existante est conservée, y compris la disposition personnalisable du dashboard. Les formes de graphiques des illustrations (radars, particules, courbes décoratives) ne sont pas ajoutées lorsqu'aucune donnée existante ne les justifie. Les critères sémantiques vert/orange/rouge et les couleurs définies par une méthode de risque restent reconnaissables. La refonte graphique est globale par les primitives ; cela ne constitue pas une validation individuelle des 79 rubriques.

Lors du lot graphique initial, aucun test API/PostgreSQL, test Docker, envoi, fusion, publication ou déploiement n’avait été effectué ; la recette réelle complémentaire est décrite ci-dessous. Aucun snapshot de référence CI remplacé automatiquement. Prochaine action : recette des 79 rubriques et des états interactifs sur une instance isolée du produit complet, puis validation humaine des écarts visuels avant intégration.

Retour arrière : abandonner cette copie ou retirer le patch ; main et les dossiers Claude sont intacts.

## Instance de recette réelle — 31/10/2026, Europe/Paris

L'instance isolée est démarrée : PostgreSQL 18, base `suivi_neon_test`, conteneur `codex-neon-db`, API Node 26 sur `127.0.0.1:8086` et interface compilée sur le port `5176`. Aucun service d'exploitation de production n'est connecté. Aucun changement dans le dépôt d'origine. Données et secrets séparés dans `/workspace/work/neon-instance`, hors Git.

L'installation normale a créé un compte de recette, enregistré les secrets dans ce dossier privé et activé le TOTP, puis chargé le jeu fictif intégré (7 écarts et 7 risques relus par l'API). Le contrôle de santé répond 200 et ne signale aucune migration en attente. Le dépôt d'un document fictif, sa modification de titre et son téléchargement ont été vérifiés dans Chromium sur la vraie API et la vraie base.

Les 79 routes du menu fourni ont été ouvertes avec une session authentifiée : aucune erreur JavaScript et aucun débordement horizontal à 1440 px. Six captures complémentaires de l'accueil ont été réalisées, aux trois largeurs dans les deux thèmes. Ce parcours ne valide pas chaque opération de chaque rubrique. Les alertes persistantes relues sur Fournisseurs, Bibliothèque et Imports sont des informations de fonctionnement, et non des échecs API. Les alertes transitoires sur PESTEL et Actions ne se reproduisent pas après chargement. Le seul chargement d’une route ne vaut pas validation métier. Les tests API complets et les opérations d'exploitation ne sont pas déclarés exécutés.

L'adresse `http://localhost:5176` est locale à l'environnement cloud. Aucun outil d'ouverture de port vers un aperçu intégré Codex n'est disponible dans cette session ; elle n'est donc pas présentée comme un lien accessible depuis le poste utilisateur. Démarrage reproductible localement à cet environnement : `/workspace/work/neon-instance/demarrer.sh`.
