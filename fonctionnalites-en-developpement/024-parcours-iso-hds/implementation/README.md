# 024 — Parcours ISO 27001 / HDS : règles de conception

## Précision utilisateur — sous-actions dépliables et attendus (v002)

Chaque étape du parcours possède désormais un bouton avec chevron et nombre de sous-actions. Déplier/replier ne change aucun état de progression. Les 26 sous-actions issues des repères de v001 affichent une petite icône et une description courte ; un clic ouvre une fiche centrale « L’attendu », avec exemple de livrable, destination métier et lien vers la référence de l’étape.

- L’arbre recalcule les positions des rangées et les liaisons après dépliage. Les cartes d’une rangée restent alignées ; les rangées suivantes se décalent sans collision. « Tout replier » est disponible.
- Le dépliage fonctionne aussi dans la branche HDS et dans la vue liste. Pas de bouton interactif imbriqué dans un autre bouton. `aria-expanded`, `aria-controls`, clavier, fermeture par Échap et retour du focus sont conservés.
- Une sous-action peut être marquée préparée dans la démonstration. Cette action alimente le même repère de préparation que l’étape ; elle ne clôture pas l’étape ni n’attribue une conformité. Une modification d’un repère revu remet l’étape à revoir dans la simulation.
- L’attendu et les exemples de livrables sont des aides de travail proposées, reliées aux références déjà documentées. Ne pas présenter chaque format proposé comme un document obligatoire ni ces 26 aides comme la couverture exhaustive de la norme. La vérification normative détaillée reste soumise aux limites de sources de v001.
- Réutiliser en production le même ID de travail/document, ses versions, les décisions et droits serveur. Les accordéons sont de l’état d’interface ; les traces de revue ne doivent jamais dépendre de leur état ouvert/fermé.

Le détail de chaque sous-action est dans `contenu.js` de v002 (ID stable, icône, titre, description, attendu, exemple de livrable, index du repère existant). Les champs de texte doivent être échappés si leur contenu devient configurable. Aucune API métier nouvelle n’est revendiquée.


## Demandes traduites

1. Arbre de progression inspiré visuellement des arbres de compétences : jalons, branches, états marqués et liaison des travaux ; style 08 conservé, sans récompense assimilée à une certification.
2. Onze regroupements ISO et cinq compléments HDS. Chaque nœud ouvre une fenêtre centrale avec repères, référence officielle, lien documentaire fictif, état et destination métier prévue. Correspondances et limites dans les [sources](../../_prototype-transversal/demarrage-parcours-v1/SOURCES.md).
3. États UI : à préparer, en cours, à revoir, revu (démo). Le pourcentage de conformité ne se déduit jamais du nombre de nœuds revus. Les deux étapes vertes initiales appartiennent au jeu fictif, pas à une organisation réelle.
4. Consultation de tous les nœuds, sans cadenas bloquant fondé sur un ordre inventé. Les liaisons sont des dépendances de travail proposées ; audits, soutien et amélioration peuvent être itératifs et transversaux. Une future dépendance bloquante exige une justification métier réelle.
5. Filtre par périmètre ; progression isolée. Masquer HDS change uniquement l’affichage, jamais la décision d’applicabilité ni les données. La branche HDS doit partager les livrables ISO réellement communs, sans copie ni double comptage.
6. Préparation et revue distinctes. Le test « repères cochés + document fictif » ne vaut pas preuve suffisante de conformité. En production, réutiliser les évaluations/revues, droits, auteur authentifié, horodatage et versions serveur ; revoir en cas d’évolution pertinente, sans réécrire la décision historique.
7. Liaison au registre des preuves, aux périmètres, objectifs, audits, écarts et plans existants. L’interface montre la destination prévue ; elle n’appelle pas une API fictive et ne prétend pas avoir ajouté une preuve réelle.
8. Liste alternative, clavier, menu fixe, zone de contenu défilante, arbre horizontalement défilant sur mobile, fenêtres centrales, sources accessibles et mouvement réduit.

## Couverture actuelle et suite

Cette v001 est une maquette du parcours d’ensemble, pas un guide exhaustif exigence par exigence. Les fiches publiques ISO, l’amendement et le référentiel public HDS ont été examinés ; le guide pratique ISO payant n’a pas été lu. Avant de développer un accompagnement complet de type Lead Implementer, compléter les détails à partir du texte ISO détenu sous licence et du catalogue réel, puis faire valider la correspondance avec chaque exigence. Ne pas inventer les preuves suffisantes, critères d’audit, durées, seuils ou décisions d’applicabilité.

La certification externe est distincte du suivi interne. Ne pas faire de EBIOS RM un passage imposé par ISO 27001 : le choix de méthode doit respecter le cadre et les critères retenus par l’organisation.

## Existant et limites d’intégration

Aucune modification de l’environnement Claude. La copie de référence locale `onboarding-suivi/zip-analysis/suivi-audits-refonte-cartographie/apps/web/src/pages/Setup.tsx` a été consultée en lecture seule : elle gère le compte initial et `/api/setup`, pas une preuve d’existence du nouvel assistant métier. Son SHA actuel n’est pas établi. Le snapshot 284cb1e mentionné dans les précédents dossiers n’est pas accessible comme objet Git dans cette copie ; l’avancement courant de Claude demeure à revérifier. Aucun test n’y a été exécuté.

Avant codage, auditer sa propre branche : organisation/périmètres (010), configuration (019/012), droits (022), preuves, registres, conformité et éventuel parcours existant. Conserver ce qui fonctionne, compléter seulement le manque. Les routes exactes du parcours, du brouillon et de ses revues ne sont pas inventées par la maquette. Les clés localStorage n’établissent ni sécurité, ni persistance serveur, ni traçabilité immuable.

Réutiliser les identifiants, versions et permissions serveur. Les contrôles d’accès restent côté backend ; les mutations doivent gérer refus, concurrence, reprise et double soumission. Ne pas convertir la fixture en modèle métier concurrent. Ne pas toucher à la cartographie dynamique historique.

## Cycle de validation

Cette proposition reste **en développement / à valider**. Après accord sur les visuels et les comportements : compléter le dossier technique avec les contrats vérifiés et déplacer dans « à implémenter ». Après confirmation par un marqueur d’intégration valable : classement « implémenté ». Aucun marqueur créé et aucun ZIP/BAT généré pour cette livraison.
