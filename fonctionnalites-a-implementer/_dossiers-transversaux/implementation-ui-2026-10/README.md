# Dossier technique d’implémentation — ASTRA UI/UX

Édition du **19 octobre 2026**, préparée à la demande de l’utilisateur. Périmètre : navigation, registres et héritage des périmètres, plans d’action, tâches récurrentes, écarts et interfaces de périmètres. Les fonctionnalités historiques restantes sont à préserver.

**Étape : à implémenter**, sur instruction explicite de l’utilisateur du 19 octobre 2026. Le dossier technique complet a été déplacé ici ; ce classement ne signifie pas que l’intégration est déjà réalisée. La règle d’héritage est confirmée. L’ordonnancement final du menu reste à valider. L’agent de codage utilise exclusivement sa propre branche.

## Lire dans cet ordre

1. [Spécifications UI/UX et règles communes](SPECIFICATIONS.md).
2. [Contrats, intégration et recette](INTEGRATION-RECETTE.md).
3. [Arborescence de navigation proposée](navigation.json).
4. [Prompt à donner à l’IA de codage](PROMPT-IMPLEMENTATION.md).

Ces documents prévalent sur les prescriptions contradictoires des anciennes maquettes pour l’héritage et la navigation. Le [dossier commun](../../../fonctionnalites-en-developpement/_dossiers-transversaux/socle-astra/README.md) reste la référence complémentaire pour les conventions non remplacées. Ne pas importer des modèles fictifs dans le backend.

## Ordre technique corrigé

Audit → fondations existantes (périmètres, droits, annuaires, applicabilité, preuves/journal) → coque/menu → registres et héritage → plans d’action → écarts et liens correctifs → récurrences → cartes et compteurs → recette intégrée.

Les [lots L0–L8](INTEGRATION-RECETTE.md#ordre-dintégration-et-conditions-de-passage) précisent les dépendances et conditions de passage. Les tests ont lieu à chaque lot. Les récurrences peuvent avancer indépendamment des écarts dès que leurs propres contrats sont prêts ; la structure du graphe peut précéder ses compteurs.

## État réel des références

| N° | Référence à consulter | État constaté / portée |
| --- | --- | --- |
| 010 | [Périmètres v007](../../../fonctionnalites-en-developpement/010-perimetres/maquettes/v007-fond-uni/README.md) | Cartes, conformité, écarts et compteurs ; fond uni. Simulation graphique, pas un raccordement backend |
| 017 | [Plans d’action v004](../../../fonctionnalites-en-developpement/017-plans-action/maquettes/v004-perimetres-herites/README.md) | Héritage du plan réalisé dans la maquette ; 35 contrôles locaux exécutés ; quatre nouveaux visuels |
| 018 | [Tâches récurrentes v008](../../../fonctionnalites-en-developpement/018-taches-recurrentes/maquettes/v008-defilement-zones-fixes/README.md) | Référence UI pour timeline, liste, Kanban et réalisation ; les champs `scope` des fixtures par tâche sont **à remplacer** par l’héritage du registre lors de l’intégration |
| 020 | [Navigation v001](../../../fonctionnalites-en-developpement/020-navigation/maquettes/v001-menu-epure/README.md) | Style apprécié ; sept familles proposées ; ordre global non validé. Les menus partiels des maquettes ne constituent pas l’inventaire complet |
| 021 | [Écarts v003](../../../fonctionnalites-en-developpement/021-registres-ecarts/maquettes/v003-cloture-preservee/README.md) | Écart déjà rattaché à son registre ; registre limité à un périmètre dans cette maquette. Étendre au multi-périmètre dans le contrat réel ; ne pas recopier son ancien formulaire d’action |

Les résultats de recette des versions antérieures sont historiques. Seuls les tests cités avec leur version sont attestés. Aucune suite backend, aucun build React ni test de permissions serveur n’a été exécuté pour ce dossier.

## Navigation : ce qui est prêt et ce qui reste ouvert

Prêts : style 08, icônes colorées, chevrons, regroupement par familles, séparation des vues internes et du menu global, coque fixe avec zone de contenu défilante. À finaliser : ordre des familles et des destinations, mapping exhaustif vers les routes réelles du SHA d’intégration, alias historiques et droits. La vidéo a servi à la proposition historique ; elle n’est ni réutilisée ni incluse ici.

Le dossier contient une proposition cohérente, pas une affirmation que le menu de production est déjà refondu. La navigation existante et ses accès restent à conserver jusqu’à la validation de leur remplacement.

## Livraison et cycle

Pas de nouveau ZIP/BAT. Aperçus publiés sur `legacy`, sources HTML consultables dans chaque version. Ouvrir les prototypes localement permet leurs essais fictifs ; les liens GitHub ne sont pas un déploiement de l’application.

Le présent dossier transversal est classé dans `fonctionnalites-a-implementer` à la demande de l’utilisateur. Les maquettes sources restent référencées dans leurs dossiers numérotés ; les dépendances et points ouverts restent décrits pour l’implémenteur. À réception d’un fichier « implémentation ok » confirmant sa version, conserver sa provenance et déplacer vers `fonctionnalites-implementees`. Aucun marqueur de confirmation trouvé à cette reprise. Le classement demandé est consigné dans [le suivi](suivi.json).
