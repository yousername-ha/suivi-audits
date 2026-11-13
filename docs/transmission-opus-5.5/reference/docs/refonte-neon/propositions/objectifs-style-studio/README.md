# Objectifs et indicateurs — proposition dans le style Studio

> **04/11/2026 — Validée et intégrée** avec les deux propositions, commit applicatif `eed9f21`.
> [Captures réelles, contrôles et livraison Docker](../../HORIZONTAL-STUDIO-INTEGRE.md).
> Les indications de maquette et d’attente de validation ci-dessous sont historiques. Session : Codex.

04/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Demande : « Mets-le dans le style du périmètre et de la DdA », après le passage des objectifs à la vue compacte par défaut.

**Maquette autonome à valider avant intégration.** Le code de l’application reste celui de `9742686` ; aucun build ou test
applicatif n’est lancé pour cette proposition. Aucun ZIP ni envoi GitHub.

## Composition proposée

- Même famille que les [périmètres](../perimetres-depliage-horizontal/README.md) et la
  [DdA Studio intégrée](../../DDA-STUDIO-INTEGREE.md) : panneaux opaques arrondis, fond blanc légèrement lavande,
  navigation indigo, contours lisibles et ombres courtes ; déclinaison bleu nuit.
- Trois dalles de synthèse plus sobres, puis registre compact regroupé par objectif. Les grands cadres biseautés
  sont remplacés par les contours des dernières propositions Studio.
- Cible violette, mesure et état sur fonds remplis assortis à la DdA : vert, rouge, orange ou neutre. Titres lisibles,
  trois en-têtes centrés, repère coloré discret sur les lignes et avertissement rouge animé pour « Non atteint ».
- Vue compacte initiale ; vue par objectif illustrée avec les mêmes valeurs. Sur mobile, chaque ligne se réorganise
  sans défilement horizontal. Les dalles et lignes n’ont pas de zone de défilement interne.
- Fiches indicateur et objectif illustrées dans la même palette. Les formulaires longs gardent une hauteur naturelle ;
  le défilement appartient au voile extérieur, pas à un contenu de fiche contraint.

La maquette utilise uniquement le jeu fictif déjà présent dans les propositions : quatre objectifs, huit indicateurs,
deux atteints, quatre non atteints, un non mesuré et une cible à définir. L’anneau 25 % représente 2 indicateurs sur 8,
sans score de certification. Les flèches restent l’évolution brute de la mesure ; leur sens ne remplace pas la
comparaison avec la cible.

Les filtres, thèmes, pause, vues illustrées et ouvertures de fiches fonctionnent localement. La vue par processus reprend
les six processus fictifs. Les boîtes de pilotage portent un message de périmètre : leurs informations métier ne sont
pas simulées. Les champs et commandes des fiches sont illustratifs, sans calcul, droit d’écriture ou sauvegarde serveur.
Lors d’une intégration approuvée, conserver tous les contrôles, champs, relations, calculs, API et droits existants.

## Visuels

| Présentation | Clair | Sombre |
| --- | --- | --- |
| Vue complète 1 440 px | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/objectifs-style-studio/objectifs-light-1440.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/objectifs-style-studio/objectifs-dark-1440.png) |
| Vue complète HD, largeur 3 840 px | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/objectifs-style-studio/objectifs-light-hd.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/objectifs-style-studio/objectifs-dark-hd.png) |
| Registre, détail | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/objectifs-style-studio/registre-light-1440.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/objectifs-style-studio/registre-dark-1440.png) |
| Vue par objectif | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/objectifs-style-studio/par-objectif-light-1440.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/objectifs-style-studio/par-objectif-dark-1440.png) |
| Mobile 390 px, densité ×2 | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/objectifs-style-studio/objectifs-light-mobile.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/objectifs-style-studio/objectifs-dark-mobile.png) |
| Fiche indicateur, hauteur complète | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/objectifs-style-studio/fiche-indicateur-light.png) | [Image](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/objectifs-style-studio/fiche-indicateur-dark.png) |

Ouvrir `index.html` pour consulter la maquette ; les sources HTML/CSS/JS et la police Inter sont locales
([licence](https://github.com/yousername-ha/suivi-audits/blob/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/objectifs-style-studio/OFL.txt)). Les captures sont des rendus Chromium natifs, sans retouche.

## Contrôles limités à la maquette

Rendu local : `/workspace/work/runtime/bin/node /workspace/work/neon-instance/objectifs-style-studio/rendre.mjs`.
Résultats détaillés : [captures.json](captures.json), douze images.

- Vue compacte initiale et répartition des huit états vérifiées ; filtres 2 / 4 / 1 / 1 et retour à huit.
- Vues par objectif et processus, ouverture des fiches et fermeture Échap vérifiées.
- Aucun débordement horizontal, texte débordant ou défilement interne des dalles aux largeurs 390, 720, 768, 1 024,
  1 280, 1 440 et 1 920 px ; en-têtes centrés sur les trois colonnes de valeurs sur ordinateur.
- Animation rouge, flèches, pause et reprise contrôlées ; captures avec mouvement réduit.
- Aucune erreur JavaScript ni requête HTTP ; syntaxe du seul script de maquette vérifiée avec `node --check`.

**Non exécutés : intégration, build, tests et captures de l’application, nouvelle archive Docker.**
Attendre la validation de cette proposition. Le dépliage horizontal des périmètres reste déjà validé, à intégrer
après les priorités du demandeur, sans lui redemander cet accord.
