# Vues en icônes et filtres à la demande

11/11/2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

**Proposition indépendante à valider avant intégration**, après la demande de petites icônes de vue, d’une recherche discrète et de filtres moins encombrants. Le principe est illustré sur le Plan d’actions et les Tâches récurrentes. Aucun accord sur cette nouvelle finition n’est déduit des intégrations précédentes.

L’application reste à `23b33b5ce4fd4cf5eeee0af97c9638b18852b61a` ; les documents de la livraison précédente sont à `23dc622`. Aucun changement de `apps/`, `packages/`, API, dépendance, base ou Docker pour cette proposition. **Aucun build ni test applicatif, aucun nouveau ZIP.** Les validations et le paquet Docker du lot précédent restent acquis.

## Proposition

- Une seule rangée de petites icônes : Timeline, liste compacte, Kanban, calendrier, planning/Gantt et synthèse. Le nom apparaît au survol et au clavier ; la vue sélectionnée reste identifiable.
- Une loupe ouvre un champ de recherche court, également accessible par `/`. Entrée ou Échap referme le champ ; la recherche active reste visible dans une pastille supprimable.
- Un bouton Filtres ouvre un panneau compact : registre, responsable, état et série pour les récurrences. Les raccourcis et éléments clos sont dans « Plus d’options ». La recherche et les critères se combinent.
- Seuls les critères actifs apparaissent sous la barre ; un compteur signale leur présence. Ils peuvent être retirés individuellement ou tous ensemble.
- Les chiffres principaux restent sur une ligne discrète ; les dalles détaillées sont accessibles par l’icône Synthèse. Les vues initiales déjà approuvées restent acquises, notamment la Timeline pour Actions/Récurrences.

Les lignes, couleurs, animations, repères temporels et défilement de la zone de liste reprennent la charte Studio. La sélection d’une série rejoint le panneau de filtres ; les choix de période restent près de la frise. Les détails et formulaires du prototype sont illustratifs et ne remplacent pas les parcours réels de consultation, validation OK/KO, commentaire, preuve, droits et historique déjà intégrés.

Le même principe pourra habiller les autres registres après accord, avec leurs propres critères et vues disponibles. Il ne s’agit pas de retirer les dalles DdA validées ni de changer le défaut Graphe des périmètres ou Compact des objectifs.

## Images et vidéo

| Aperçu | Clair | Sombre |
| --- | --- | --- |
| Plan d’actions, commandes repliées | [HD](actions-light-hd.png) | [HD](actions-dark-hd.png) |
| Panneau de filtres ouvert | [HD](filtres-light-hd.png) | [HD](filtres-dark-hd.png) |
| Tâches récurrentes | — | [HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/commandes-discretes/recurrences-dark-hd.png) |
| Mobile | [Interface](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/commandes-discretes/mobile-light.png), [filtres](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/commandes-discretes/mobile-filtres-light.png) | — |

[Vidéo des commandes](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/commandes-discretes/commandes-discretes.mp4) : changement de vue, info-bulles, recherche, filtres, pastilles et récurrences. Captures natives Chromium, cinq images de 3 840 × 2 400 pixels et deux de 390 × 844 pixels. Aucun dessin généré ni retouche d’image. La zone de liste défile indépendamment ; les captures montrent l’écran complet, pas l’ensemble des lignes hors cadre.

[Maquette interactive](index.html), à servir par un serveur statique depuis la racine du dépôt ; la police locale provient du dossier voisin `organisation-contexte-studio`. Aucune dépendance ajoutée.

## Périmètre des vérifications

Les contrôles concernent **uniquement cette maquette autonome**. Node 26.13.0, Chromium système et serveur statique local ; données entièrement fictives datées du 11 novembre 2026, huit actions, six séries et huit occurrences.

Les rapports de rendu et de lecture vidéo sont joints dans [controles.json](controles.json) et [lecture-video.json](lecture-video.json). Les premiers passages ont révélé des contrastes légèrement insuffisants dans le thème clair et une remise à zéro incomplète de la case des éléments clos ; ces points ont été corrigés dans la maquette avant les rendus finaux. Les scripts et journaux intermédiaires restent privés, hors du dépôt.

- Douze dispositions, de 320 à 1 920 px dans les deux thèmes : aucun débordement horizontal détecté, panneau de filtres borné au cadre, y compris avec « Plus d’options » ouvert.
- Cinq analyses Axe WCAG A/AA ciblées : aucune violation détectée dans les écrans contrôlés.
- Six vues, recherche, critères combinables, remise à zéro, filtre Série, pastilles supprimables, fermeture et retour de focus vérifiés dans le jeu fictif.
- Aucune erreur JavaScript et aucun appel API observés pendant ces parcours.
- Vidéo H.264 de 1 600 × 1 050 px ; ouverture, lecture et déplacement au milieu de la vidéo vérifiés dans Chromium. [Dimensions et empreintes des médias](medias.json).

La vérification applicative des droits, écritures, filtres réels et préférences n’a pas été rejouée. **Prochaine étape : retour explicite du demandeur sur ces visuels ; après validation, intégration dans les composants existants, contrôles pertinents et nouvelles captures de l’application.**
