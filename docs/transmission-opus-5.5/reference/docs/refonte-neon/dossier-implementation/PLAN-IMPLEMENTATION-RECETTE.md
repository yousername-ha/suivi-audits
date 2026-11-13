# Plan d’implémentation et recette

Ce plan sert à porter la charte validée sur une autre copie ou à l’étendre à un écran restant. Les modules déjà intégrés ne nécessitent pas une réimplémentation de leur logique.

## 1. Préparer le portage

Identifier la branche et la version cibles, puis comparer leurs composants avec les sources de référence. La livraison de référence part d’une copie de main ; elle n’autorise pas l’écrasement des évolutions ultérieures d’une autre branche.

Relever pour l’écran : ses champs, états, calculs et sources de données ; les commandes existantes ; les permissions de lecture, écriture et export ; les parcours d’ouverture, annulation et enregistrement ; les événements, historiques et relations associés.

Conserver les handlers et hooks métier. Le changement attendu concerne la structure de présentation, les composants visuels et les classes CSS. Une correction métier découverte pendant la recette doit être identifiée séparément.

Les instantanés du dossier `sources/` de l’archive sont des références de comparaison. Leur manifeste permet de vérifier leur provenance. Ils n’embarquent pas le serveur complet, les dépendances ou les données locales.

## 2. Ordre d’implémentation conseillé

| Étape | Travail de présentation | Point de contrôle |
| --- | --- | --- |
| Socle | Police Inter locale, thème Mantine, styles partagés, variables et ordre des imports. | Compilation, CSP, contraste et absence de styles en ligne dans le code produit. |
| Fenêtres | Cadres, libellés, focus, dimensions et défilement extérieur. | Titre et actions accessibles sur écran court et téléphone. |
| Familles de composants | Dalles Studio, registres en lignes, états remplis et titres alignés. | Cohérence avec la référence du module choisi. |
| Contenu spécifique | Contexte, graphe Périmètres, Objectifs, DdA, Référentiels. | Informations et commandes identiques avant/après. |
| Adaptation | Repli mobile, disposition des colonnes, largeurs variables et cas sans donnée. | Aucun contenu rendu illisible par une largeur nulle, aucune dalle tronquée. |
| Recette | Tests pertinents, captures réelles et compte rendu daté. | Validation graphique et résultat technique clairement distingués. |

Les variables restent dans `packages/ui`, près du module concerné. Réutiliser les noms et états existants ; ne pas renommer les alias historiques comme `VERT` simplement parce que sa palette d’accent est aujourd’hui violette.

Conserver les sélecteurs limités aux modules. Les sélecteurs `:has(...)` de la coque Studio doivent continuer à s’appliquer uniquement aux pages concernées. Tester toute modification globale sur des fenêtres représentatives des autres modules.

Pour une nouvelle proposition, réaliser la maquette de manière autonome et attendre son accord avant de modifier le code de l’application ou de lancer ses builds et tests. La génération et la vérification du présent dossier documentaire ne constituent pas une nouvelle intégration applicative.

## 3. Critères d’acceptation visuelle

| Cas | Résultat attendu |
| --- | --- |
| Clair | Surfaces opaques distinctes, texte encre, contours visibles, fond légèrement teinté et lueur contenue. |
| Sombre | Même contenu et mêmes états ; texte, bordures et remplissages adaptés au bleu nuit. |
| Titres et colonnes | Intitulés lisibles, axes et en-têtes alignés ; Cible / Valeur mesurée / État centrés dans les vues concernées. |
| Périmètre replié | Informations importantes visibles et + centré en bas. |
| Périmètre ouvert | Rectangle plus large, liens et voisins recalculés, aucun chevauchement ou ascenseur interne. |
| Fenêtre longue | Défilement extérieur ; titre, onglets et dernière commande atteignables. |
| DdA | Quatre dalles conservées, mesures en lignes, choix remplis sans chevron décoratif, vert/orange/rouge explicites. |
| Référentiels | Publications locales et bibliothèque distinguées, source et versions exactes, domaine lisible sur mobile. |
| Données absentes | Non renseigné, Non mesuré, À préciser ou indisponible selon le contrat ; aucune valeur inventée. |
| Animations | Alertes et pictogrammes gardent leur repère statique ; pause et mouvement réduit fonctionnent. |

Contrôler au minimum 390, 1 024 et 1 440 px, dans les deux thèmes. Ajouter un contrôle large à 1 920 px et les exports HD utiles. Ces largeurs sont une grille de recette ; les points de rupture effectifs restent ceux des composants existants.

Inspecter les dimensions réelles, au-delà de la simple présence d’une barre de défilement. Un panneau peut laisser déborder ses lignes après suppression d’`overflow: auto` si son `max-height` subsiste. Une grille devenue flex sur mobile peut avoir besoin d’un étirement explicite de ses enfants.

## 4. Critères de non-régression fonctionnelle

- Les consultations seules n’écrivent aucun objet, relation, mesure ou préférence métier.
- Les droits restent appliqués par les services existants ; un compte lecteur ne gagne aucune commande d’écriture ou d’export.
- Modifier, Annuler, Enregistrer, confirmation de publication, simulation, `If-Match`, versions et historiques restent conservés.
- Les données reçues et les données sauvegardées gardent leurs champs, identifiants et valeurs, y compris les champs supplémentaires.
- Les taux, filtres, dénominateurs, seuils, méthodes de risque et calculs d’indicateurs ne changent pas.
- Recherche, pagination ou chargement supplémentaire, filtres, pièces jointes, exports et liens gardent leur portée existante.
- Les erreurs de sauvegarde et les états désactivés restent lisibles et récupérables.

## 5. Vérifications techniques à exécuter lors d’un portage

Sur une copie autorisée, avec les dépendances du dépôt et une base de recette isolée : TypeScript, lint, formatage, contrôle du diff et build des parties touchées. Exécuter ensuite les tests de charte et les parcours correspondant aux composants modifiés.

| Famille | Références de tests existantes |
| --- | --- |
| Charte et données des graphiques | `apps/web/test/charte.test.ts`, `neon-donnees.test.ts`, `neon-graphiques-rendu.test.ts`. |
| Contexte | `categories-contexte.test.ts` et le scénario E2E de présentation Contexte. |
| Périmètres | `disposition-perimetres.test.ts` et le scénario E2E des cartes de périmètres. |
| Objectifs | `tests/e2e/specs/objectifs-neon.spec.ts` et les parcours existants du Pilotage. |
| DdA | `dda-neon.spec.ts`, tests partagés DdA et scénario d’évaluations pertinent. |
| Référentiels | `referentiels-studio.spec.ts`, scénarios bibliothèque dans `zzz-pilotage.spec.ts`, Kit IA et publication de méthode ISO 27005. |

Les chemins exacts, y compris les noms longs des scénarios historiques, sont fournis dans l’inventaire de l’archive. Ne pas affaiblir une assertion métier ni approuver automatiquement de nouveaux snapshots pour accepter une différence voulue.

Pour les vues modifiées, compléter par les mesures de débordement, un parcours clavier et une analyse Axe ciblée. Une analyse sans violation détectée ne constitue pas une attestation d’accessibilité exhaustive.

Produire de nouvelles captures natives de l’application après intégration, dans les deux thèmes, avec données fictives, police chargée et mouvement réduit pour les images fixes. Conserver le repère d’animation dans une vidéo ou un aperçu séparé. Les images de maquette ne doivent pas être présentées comme des captures du produit intégré.

## 6. Résultats déjà disponibles, datés

| Lot documenté | Résultats principaux historiques |
| --- | --- |
| Contexte, 01/11 | 230 tests web, trois parcours de présentation et de droits, catégories explicites et absence d’écriture en consultation. |
| DdA Studio, 04/11, `008cc30` | 230 tests web, six tests partagés DdA, E2E DdA, lecteur refusé en écriture avec 403 ; 24 vues et huit analyses Axe ciblées. |
| Périmètres horizontaux et Objectifs Studio, 04/11, `eed9f21` | 234 tests web, six E2E ; 26 vues et 14 analyses Axe ciblées, lecture seule vérifiée. |
| Référentiels Studio, 05/11, `65bd22f` | 234 tests web, cinq scénarios distincts réussis après corrections ; 32 vues, 14 analyses Axe ciblées et écriture lecteur refusée avec 403. |

Ces résultats ne s’additionnent pas : plusieurs lots rejouent les mêmes suites. Ils ne prouvent pas une recette exhaustive de tous les écrans, de toutes les mutations ou du Docker Desktop du demandeur. La préparation documentaire du 09/11 ne les transforme pas en tests nouvellement exécutés.

## 7. Limites ouvertes à transmettre

**Promotion après activation d’un référentiel.** Défaut API préexistant observé le 05/11 : après un changement d’activation, la version de fiche peut ne plus correspondre à une version publiée et la promotion répondre 404 « Version publiée introuvable ». Le parcours de promotion avant activation est vérifié ; le parcours inverse n’est pas déclaré réussi. Voir le [compte rendu](../REFERENTIELS-INTEGRES.md). La refonte graphique ne contient pas sa correction.

**Retour du focus à la fermeture d’une fiche.** Le lot fenêtres du 01/11 signale un retour de focus au déclencheur non assuré pour la fiche Contexte. Le maintien du focus dans la fenêtre et la fermeture sont vérifiés ; les comptes rendus ultérieurs ne documentent pas la levée de ce point. Le revérifier lors d’un portage, sans déclarer le problème résolu par un simple changement de cadre.

**Recette utilisateur et autres écrans.** Les six autres rubriques de la famille Référentiels n’ont pas toutes été redessinées, et la recette métier exhaustive des 79 rubriques n’est pas établie. Ces écrans doivent conserver leurs fonctions et recevoir une proposition propre avant une nouvelle transformation.

## 8. Essai Docker Desktop Windows

Utiliser le projet de test existant `neon-refonte-test` et son fichier `docker-compose.dev.yml`. L’archive du présent dossier fournit la documentation et les références ; elle ne remplace pas le ZIP complet de sources Docker livré séparément.

Dans le dossier de test, pour une mise à jour avec le paquet applicatif approprié :

```powershell
docker compose -p neon-refonte-test -f docker-compose.dev.yml stop web api
# Remplacer les sources applicatives en conservant .donnees-dev et la configuration locale.
docker compose -p neon-refonte-test -f docker-compose.dev.yml up -d --force-recreate web api
docker compose -p neon-refonte-test -f docker-compose.dev.yml ps
```

Ouvrir `http://localhost:5173` et recharger avec Ctrl+F5. Conserver la base et les secrets existants ; aucun effacement de volume n’est nécessaire pour un changement graphique.

La livraison complète de référence du 05/11 était `suivi-audits-neon-docker-referentiels.zip`, sources `c11277f`, SHA-256 `6231e8484ff805055841eae9dbfc3b3359f3325021207c1ffea43516042f3027`. Ce repère identifie cette archive précise, pas une future version de l’application.

Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).
