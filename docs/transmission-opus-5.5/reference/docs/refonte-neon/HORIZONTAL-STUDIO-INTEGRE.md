# Périmètres horizontaux et objectifs Studio intégrés

04/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Le demandeur valide les deux propositions avec **« Ok tu peux implémenter les modif précédente et celle-ci »** :
[périmètres horizontaux](propositions/perimetres-depliage-horizontal/README.md) et
[objectifs Studio](propositions/objectifs-style-studio/README.md).
Intégration sur la copie isolée de main, branche `codex/refonte-neon-main`, commit applicatif
**`eed9f219c597d111475a6a00454421de49576afe`**. Aucune validation préalable restante pour ces deux intégrations.

## Résultat

- Périmètres : le « + » est centré en bas et reste au même endroit lorsqu’il devient « − ». Une carte ouverte passe
  de 260 à 620 px sur ordinateur ; les cartes voisines et leurs liens se repositionnent selon leurs largeurs et
  hauteurs réelles. Le graphe reste centré, fournisseurs extérieurs compris.
- Les détails sont répartis en trois zones : couverture, activité/continuité et écarts/actions. Les compteurs,
  classifications, alertes, sous-totaux dédupliqués et commandes de gestion sont conservés. Les hauteurs restent
  naturelles : environ 207 px replié et 529 px ouvert pour le périmètre racine de recette, qui contient davantage
  d’informations que l’exemple de maquette. Aucun défilement interne aux dalles ; disposition adaptée au téléphone.
- Objectifs et indicateurs : panneaux arrondis, relief discret, tableau compact regroupé par objectif, cible violette
  et états remplis dans les couleurs de la DdA. Les en-têtes des valeurs sont centrés ; l’avertissement rouge et les
  flèches conservent leurs animations, leur pause et le respect du mouvement réduit.
- Les filtres existants restent disponibles ; leurs raccourcis et compteurs sont visibles dans le registre. Les quatre
  vues, processus, boîtes de pilotage et formulaires restent présents. Les fiches reprennent la même palette.
- Le menu ouvre Objectifs en vue compacte, comme Indicateurs ; la rubrique Objectifs par processus garde sa propre
  vue initiale. Ce réglage précédent est inclus dans la livraison Docker.

Les données, cibles, mesures, calculs, identifiants, droits, API et configurations Docker sont conservés. Aucun fichier API,
schéma ou migration modifié, aucune dépendance ajoutée. Les flèches représentent toujours l’évolution brute de la valeur,
indépendamment du résultat de sa comparaison avec la cible. Les compteurs absents restent indisponibles et aucun taux
de conformité ou historique n’est inventé.

## Captures de l’application

Application compilée et API réelle, données fictives de la base de recette séparée. Les visuels ne simulent pas de réponse
API. Un compte dispose explicitement des quatre périmètres de démonstration pour isoler la présentation des objets créés
par les tests. Captures Chromium natives, sans retouche ; les cadrages de composants évitent la barre d’en-tête fixe.

| Présentation | Clair | Sombre |
| --- | --- | --- |
| Graphe replié | [Image](captures-horizontal-studio/graphe-replie-light-1440.png) | [Image](captures-horizontal-studio/graphe-replie-dark-1440.png) |
| Graphe déplié en largeur | [Image](captures-horizontal-studio/graphe-deplie-light-1440.png) | [Image](captures-horizontal-studio/graphe-deplie-dark-1440.png) |
| Périmètres dépliés, page HD | [Image](captures-horizontal-studio/deplie-light-hd.png) | [Image](captures-horizontal-studio/deplie-dark-hd.png) |
| Objectifs, vue compacte | [Image](captures-horizontal-studio/objectifs-light-1440.png) | [Image](captures-horizontal-studio/objectifs-dark-1440.png) |
| Objectifs, page HD | [Image](captures-horizontal-studio/objectifs-light-hd.png) | [Image](captures-horizontal-studio/objectifs-dark-hd.png) |
| Objectifs, autre vue | [Par objectif](captures-horizontal-studio/objectifs-par-objectif-light.png) | [Par objectif](captures-horizontal-studio/objectifs-par-objectif-dark.png) |
| Téléphone : périmètres | [Image](captures-horizontal-studio/deplie-light-390.png) | [Image](captures-horizontal-studio/deplie-dark-390.png) |
| Téléphone : objectifs | [Image](captures-horizontal-studio/objectifs-light-390.png) | [Image](captures-horizontal-studio/objectifs-dark-390.png) |

[Fiche indicateur complète](captures-horizontal-studio/objectifs-fiche-indicateur-light.png),
[périmètre unique en lecture seule](captures-horizontal-studio/perimetre-seul-lecteur.png) et
[reçu des contrôles](captures-horizontal-studio/validation.json). Les images HD font 3 840 px de large.

## Contrôles exécutés

Node 26, Chromium système, PostgreSQL 18 dans la base isolée `suivi_neon_perimetres_compacts`, ports locaux 8087/5177.
Les journaux et sessions restent hors Git. Aucun environnement de production utilisé.

| Contrôle | Résultat |
| --- | --- |
| TypeScript web, ESLint complet, Prettier complet et diff | Code 0 |
| Compilation web | Code 0 ; avertissements préexistants sur le script d’exploitation et les gros bundles |
| Vitest web | 30 fichiers, 234 tests réussis, dont huit tests de disposition |
| E2E existants, complétés pour la largeur et le bouton centré | Six réussites, zéro échec, aucun rejeu |
| Périmètres, clair/sombre, 1440/1024/390 et HD | 16 vues contrôlées ; aucune carte hors cadre, aucun chevauchement ou défilement interne ; centrage du bouton et du graphe vérifiés |
| Objectifs, mêmes dimensions et vue alternative | 10 vues contrôlées ; dalles alignées, en-têtes centrés, aucun débordement de page ou défilement interne ; défaut compact et filtres vérifiés |
| Axe sur les deux modules | 14 analyses, aucune violation détectée sur les critères sélectionnés |
| Lecture seule | Consultations et fiches permises, champs de l’indicateur désactivés, ajouts et gestion absents |
| Écritures avec corps valides en lecture seule | Périmètre et indicateur : 403, données conservées |
| JavaScript, CSP stricte et écritures métier pendant les captures | Aucune erreur ou écriture détectée ; tableaux processus/objectifs/indicateurs identiques avant/après |

Les scénarios E2E conservent leurs assertions métier : rattachements et planification, ajout et relecture d’une mesure,
filtres et quatre vues, création/modification d’un périmètre et même identifiant dans la liste, sous-totaux, fournisseurs,
classifications et liens filtrés, pause et mouvement réduit. Deux tests purs supplémentaires couvrent l’absence de
chevauchement lorsque plusieurs cartes s’élargissent, et le centrage d’un parent plus large que son enfant.

La première inspection a révélé une synthèse restée en disposition bloc et des règles de l’ancienne grille de compteurs.
Ces conflits CSS ont été corrigés avant la collecte finale. Le lint a également signalé deux déclarations superflues de
minuteurs dans la maquette autonome ; leur retrait ne change pas son visuel. Les six E2E ont ensuite réussi sur la dernière
compilation. Aucune référence de comparaison visuelle n’a été approuvée automatiquement.

Commandes : TypeScript via `node node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit`, lint/format complets
depuis la racine, Vitest depuis `apps/web`, script de variables Mantine puis `vite build`. E2E et captures par les scripts
privés de `/workspace/work/neon-perimetres-instance/horizontal-studio`, un worker et zéro rejeu.

## Livraison Docker Desktop Windows

Le ZIP local `suivi-audits-neon-docker-studio.zip` contient les sources courantes, y compris la DdA déjà intégrée et le
défaut compact des objectifs. Il exclut dépendances installées, données locales, secrets, maquettes et grandes captures.
Ce paquet de test Docker ne remplace pas une archive Git destinée à rejouer les références visuelles de CI.

Dans le dossier de test existant qui contient `docker-compose.dev.yml` :

```powershell
docker compose -p neon-refonte-test -f docker-compose.dev.yml stop web api
# Remplacer les sources par le CONTENU de suivi-audits-neon-test dans ce même dossier.
# Conserver .donnees-dev et la configuration locale.
docker compose -p neon-refonte-test -f docker-compose.dev.yml up -d --force-recreate web api
docker compose -p neon-refonte-test -f docker-compose.dev.yml ps
```

Ouvrir `http://localhost:5173` et recharger avec `Ctrl+F5`. Aucun effacement de données ou changement de projet Compose.
La recette sur le Docker Desktop Windows du demandeur reste à effectuer ; les contrôles ci-dessus proviennent du cloud.
Aucun push, fusion, CI distante ou déploiement. Prochaine action : essai local du demandeur avec les deux intégrations.
