# Sources, preuves et limites de cette transmission

## Instantané et vérité de la cible

Source Git locale de l’assemblage : `55d43ee` sur `codex/refonte-neon-main`. Dernier commit applicatif : `d9d1478`. Les commits suivants ont ajouté des propositions, décisions et captures. Les références distantes lues lors du conditionnement sont dans `annexes/ETAT-GIT-DISTANT.json` ; elles ne prouvent pas le commit déployé chez le demandeur. En particulier, la branche Assistant RSSI observée est plus récente que le contrat historique utilisé pour le frontend de refonte.

Les instructions/source de référence sont figées dans `reference/`. Les fichiers métier pertinents ont leurs empreintes d’origine dans `MANIFESTE.json`. La consultation GitHub du SHA `55d43ee` a confirmé que cette révision locale n’y est pas publiée (réponse 422, commit introuvable). Utiliser les sources embarquées ; ne pas supposer qu’un fetch de ce SHA fonctionnera dans la cible. Aucun `.git`, `node_modules`, build `dist`, volume, `.env`, secret ou rapport brut privé n’est livré. Cette collection n’est pas une application exécutable complète : elle sert au rapprochement avec le dépôt cible, qui possède ses routes/serveurs/build actuels.

## Contenu des références

- Frontend `apps/web/src`, composants/styles de `packages/ui`, types de `packages/shared` et tests UI/web/E2E utiles : **exemples à comparer**, pas une autorisation de rétrograder un DTO ou un service de la cible.
- Spécifications et preuves de la refonte, anciens dossiers de reprise et code des maquettes : conservés avec leur date et leur statut. Les modèles finaux priment sur les essais intermédiaires.
- Visuels natifs retenus et médias de référence embarqués ; atlas avec leur provenance et leur statut. Les images anciennes d’un module peuvent afficher un ancien menu : leur référence porte sur le module, et le menu commun final les remplace.
- Médias d’essais intermédiaires non embarqués pour éviter les doublons : listés avec hash et lien Git figé dans `annexes/HISTORIQUE-MEDIAS.json`. Les documents Markdown historiques conservent un lien de provenance Git figé quand une illustration non retenue n’est pas incluse. Ces liens ne sont pas disponibles sur GitHub tant que la révision locale n’est pas publiée ; cette livraison ne publie rien. Les médias retenus et nécessaires au portage sont embarqués et vérifiés localement. Cette réécriture de liens est consignée ; le texte et l’état historiques restent identifiables.
- Les fichiers bruts joints au fil de conversation ne sont pas tous présents dans le dépôt : les captures locales de restitution et d’intégration sont fournies, sans prétendre livrer les pièces jointes originales absentes.

## Contrôles de cette livraison

L’assembleur vérifie l’existence des références, l’inventaire des fichiers sélectionnés, les empreintes, les médias copiés sans retouche, l’absence de symlinks/chemins sortants ou fichiers d’environnement sensibles, puis construit le ZIP. `outils/verifier_dossier.py` contrôle les octets de chaque fichier, les liens des documents principaux et de l’atlas, les dimensions des images et l’intégrité du ZIP lors de la fabrication. Les exceptions historiques sont consignées, pas masquées.

Aucun résultat de tests applicatifs historique n’est attribué à ce conditionnement. Pas de nouveau build/UI/E2E applicatif, DB/API/Mistral, Docker, CI, push, fusion ou déploiement effectué pour fabriquer ce dossier. La consultation Git distante est en lecture seule ; l’application exécutée du demandeur n’a pas été auditée à distance.

## Résumé des modifications pour une IA

Cette livraison consolide toute la refonte documentée jusqu’aux deux Dashboard avec menu bleu nuit opaque approuvés. Elle ajoute un prompt Opus 5.5, un audit préalable d’existence/compatibilité, un état par module, une spécification concrète du menu et de ses animations, les règles de charte/PC, le raccordement Assistant, un plan et une recette par lots, un atlas avec images originales et un instantané de sources identifié par empreintes. Les refus et propositions non validées sont séparés de ce qui est intégré ou retenu à porter.

La prochaine action d’Opus est de constater l’existant sur SA version, remplir la matrice avec preuves, puis adapter les lots validés. Aucun remplacement global de source, suppression de fonction plus récente, réintroduction de module retiré ou copie de maquette ne peut être présenté comme ce portage.

Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).
