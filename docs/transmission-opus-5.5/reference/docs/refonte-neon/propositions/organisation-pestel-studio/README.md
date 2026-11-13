# Organisation — proposition PESTEL Studio

> Mise à jour du 10/11/2026 : **PESTEL explicitement validé et [intégré dans l’application](../../PESTEL-STUDIO-INTEGRE.md)** au commit `5dd1c68`. Les mentions d’attente ci-dessous décrivent les étapes historiques de la proposition. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

> Mise à jour du 10/11/2026 : le dernier modèle **SWOT au centre agrandi est [validé et intégré](../../SWOT-CENTRE-AGRANDI-INTEGRE.md)** (`51d7022`). Le PESTEL ci-dessous reste une proposition distincte à évaluer ; l’état « application inchangée » décrit sa création antérieure à cet accord. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

10/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

**Proposition autonome à évaluer avant intégration.** Après « On continue sur la suite après le swot », le prochain onglet du contexte est le PESTEL des enjeux externes. Cette maquette reprend la charte Studio, sans modifier l’application au commit `016d69c50c7775a62640e9e2d75d2875e9c85374`, ni le ZIP Docker existant. Le nouveau centre SWOT agrandi reste lui aussi une proposition non intégrée ; le passage à la suite ne constitue pas son accord explicite.

## Présentation proposée

- Constellation de six facteurs colorés et sélectionnables, commandes en relief au survol et au clavier, liaisons et cercle animés. Ces éléments représentent la navigation entre catégories, sans poids ni score d’influence.
- Compteurs calculés depuis le jeu fictif existant : cinq enjeux externes, quatre classés, un non classé ; trois enjeux internes séparés. Les affectations PESTEL sont illustratives, comme dans la proposition Organisation précédente.
- Panneau de lecture du facteur sélectionné, enjeux et processus concernés ; sélection initiale Technologique. Les facteurs vides disposent d’un état explicite, sans ajouter de contenu fictif.
- Bandeau orange pour les enjeux externes à classer ; classement et déclassement simulés en mémoire, répercutés sur les compteurs, le graphe et le registre.
- Enjeux internes dans un panneau replié distinct, sans classement PESTEL. Registre complet accessible avec recherche et sélecteurs ; note méthodologique ISO existante conservée en accordéon.
- Deux thèmes, pause/reprise, préférence de mouvement réduit et adaptation mobile, sans défilement intérieur.

## Médias

- [Vue claire HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-pestel-studio/pestel-light-hd.png) — page complète, 3840 × 2724 px.
- [Vue sombre HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-pestel-studio/pestel-dark-hd.png) — même cadrage et résolution.
- [Vidéo](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/organisation-pestel-studio/pestel-video.mp4) — capture native des interactions, clair puis sombre, environ treize secondes, 1920 × 1280 px, H.264.

Les images proviennent de Chromium, sans retouche ; les animations y sont suspendues pour la lecture. La vidéo montre les mouvements actifs. Les empreintes et dimensions se trouvent dans [captures.json](captures.json), et sa lecture vérifiée dans [validation-video.json](validation-video.json).

## Contrôles de la maquette

[Résultats](controles-maquette.json) : 29 dispositions, de 390 à 1920 px, dans les deux thèmes et sur les six facteurs ; aucun débordement horizontal, défilement intérieur ou chevauchement du centre avec les boutons. Six analyses Axe ciblées sur `main`, sans violation détectée. Sélection au clavier et maintien du focus, recherche/résultat vide, classement/déclassement local, séparation des enjeux internes, pause/reprise et mouvement réduit vérifiés. Aucun appel externe, écriture HTTP ou erreur JavaScript détectés.

Le premier contrôle à 390 px a signalé un manque de réserve autour du centre. Les dimensions fixes du centre et des boutons ont été remplacées par des proportions du graphe, puis les 29 dispositions finales ont réussi, avec les mêmes assertions de non-chevauchement.

Servir le dossier parent `propositions` avec un serveur statique, puis ouvrir `organisation-pestel-studio/`. Styles, police et données fictives partagés lus depuis `organisation-contexte-studio`, sans modifier cette ancienne proposition. Aucun serveur applicatif nécessaire.

**Non exécutés : intégration, build, tests applicatifs, génération d’un ZIP Docker, publication ou déploiement.** La sélection et le classement n’appellent pas l’API et disparaissent au rechargement.

## Après validation explicite

Porter la présentation dans `apps/web/src/pilotage/Pestel.tsx` et `packages/ui`, en conservant la lecture de `/api/grc/:smsi/pilotage/pestel`, les affectations existantes et la garde `pilotage/modifier`. Utiliser les facteurs effectivement renvoyés par la nomenclature : ne pas imposer les six identifiants illustratifs de la maquette ni un nouveau classement automatique. Préserver les descriptions, les processus, les enjeux non classés/internes, les erreurs, le chargement et la limitation au pilotage commun de l’organisation. Prévoir contenus longs, facteurs variables et vides ; contrôler les fonctions et les droits puis fournir les captures de l’application intégrée.
