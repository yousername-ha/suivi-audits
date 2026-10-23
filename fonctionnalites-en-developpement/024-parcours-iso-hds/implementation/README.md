# 024 — Parcours ISO 27001 / HDS : règles de conception

## Reprise du style de référence v004 — 23 octobre 2026

La demande porte sur la fidélité à l’image : en-tête compact, menu vert, courbes végétales et feuilles, halos, libellés à droite des cercles, racine et fiche compacte située en haut à droite. Le choix d’un nœud actualise cette fiche ; l’attendu détaillé et le suivi/revue s’ouvrent dans une fenêtre centrale. Le formulaire de revue et les données communes aux modules simulés sont conservés.

La composition synthétique utilise 11 raccourcis graphiques vers les objets existants, sans retrancher des travaux : la liste conserve 16 étapes et 26 sous-actions. Contexte/Périmètre ciblent `context`, Applicabilité/Traitement ciblent `treatment`. Les deux lignes Identifier/Évaluer pointent vers `risk-2` ; elles ne doivent ni dupliquer l’évaluation ni augmenter la progression. La branche HDS garde ses cinq étapes dans la liste. Ces regroupements sont des décisions UI, pas des prescriptions normatives.

Le dessin SVG se dimensionne proportionnellement et reste défilant sur les petits écrans. Le menu est fixe. Les raccourcis HDS et la configuration de démonstration se règlent depuis Administration. Les couleurs de sélection suivent chaque branche, les états restent différenciés par leurs symboles et libellés. Aucun nouvel ordre bloquant, moteur de risques, objet ou API métier n’est créé.

Stockage isolé `astra-parcours-reference-v4`, sans migration des essais précédents. Recette : 56 contrôles Chromium via HTTP local, captures 1280 × 720 et mobile ; pas de test Windows ou `file://`. Aucune intégration serveur. v003 conservée pour l’historique, v004 en développement à valider. Pas de ZIP/BAT.

## Alternative fonctionnelle v003 — arbre organique

La nouvelle variante reprend les identifiants et contenus sourcés de v002. Quatre branches graphiques : cadrer, maîtriser, évaluer/améliorer, compléments HDS. Leurs courbes ne représentent pas un nouvel ordre normatif ni des verrous. Chaque étape ouvre une fiche centrale avec sous-actions dépliables, attendu, exemple de livrable et source. Le menu reste fixe, le contenu défile séparément, la liste propose une recherche. Respect du mouvement réduit pour les flux visuels.

L’HTML autonome embarque CSS, SVG et JavaScript. Un stockage local propre à v003 isole les essais par périmètre. Les modules de démonstration et l’arbre partagent les mêmes repères et notes : les modifications sont réciproques, sans copie. Ces fiches simulées servent à tester la règle 024-INT, elles ne sont pas des modules métier à réimplémenter en production. Les routes, permissions, objets et revues serveur restent à auditer et à raccorder selon les critères ci-dessous. Aucun backend Claude modifié.

Les statuts vont de « à préparer » à « en cours », « à revoir », puis « revu · démo ». La revue simulée exige les repères cochés et la preuve fictive pour tester l’interface uniquement ; ce mécanisme ne doit pas être repris comme critère suffisant de conformité. Une modification après revue remet à revoir. Aucune preuve réelle ni journal immuable n’est produit.

40 contrôles exécutés : arbre/liste, attendus des 16 étapes, revue, sauvegarde, réciprocité des repères, isolation, filtrage HDS, zoom, clavier, responsive et stockage indisponible. Tests via HTTP local ; ouverture directe `file://` bloquée par la politique du navigateur de cet environnement, donc non vérifiée ici. Version en développement, à valider, sans ZIP/BAT.

## Précision utilisateur — sous-actions dépliables et attendus (v002)

Chaque étape du parcours possède désormais un bouton avec chevron et nombre de sous-actions. Déplier/replier ne change aucun état de progression. Les 26 sous-actions issues des repères de v001 affichent une petite icône et une description courte ; un clic ouvre une fiche centrale « L’attendu », avec exemple de livrable, destination métier et lien vers la référence de l’étape.

- L’arbre recalcule les positions des rangées et les liaisons après dépliage. Les cartes d’une rangée restent alignées ; les rangées suivantes se décalent sans collision. « Tout replier » est disponible.
- Le dépliage fonctionne aussi dans la branche HDS et dans la vue liste. Pas de bouton interactif imbriqué dans un autre bouton. `aria-expanded`, `aria-controls`, clavier, fermeture par Échap et retour du focus sont conservés.
- Une sous-action peut être marquée préparée dans la démonstration. Cette action alimente le même repère de préparation que l’étape ; elle ne clôture pas l’étape ni n’attribue une conformité. Une modification d’un repère revu remet l’étape à revoir dans la simulation.
- L’attendu et les exemples de livrables sont des aides de travail proposées, reliées aux références déjà documentées. Ne pas présenter chaque format proposé comme un document obligatoire ni ces 26 aides comme la couverture exhaustive de la norme. La vérification normative détaillée reste soumise aux limites de sources de v001.
- Réutiliser en production le même ID de travail/document, ses versions, les décisions et droits serveur. Les accordéons sont de l’état d’interface ; les traces de revue ne doivent jamais dépendre de leur état ouvert/fermé.

Le détail de chaque sous-action est dans `contenu.js` de v002 (ID stable, icône, titre, description, attendu, exemple de livrable, index du repère existant). Les champs de texte doivent être échappés si leur contenu devient configurable. Aucune API métier nouvelle n’est revendiquée.


## Règle confirmée — un parcours intégré aux modules de la plateforme

Le parcours est une vue guidée des fonctionnalités de la plateforme. Tout travail réalisé dans le parcours doit être accessible et gérable dans le module correspondant, indépendamment de l’arbre. Il ne constitue pas un registre métier parallèle.

- **024-INT-01 — Objets communs.** Chaque sous-action référence les objets réels par leurs identifiants et versions : organisation, périmètres, échelles, risques, applicabilité, objectifs, documents/preuves, audits, écarts, plans d’action et revues selon le travail concerné. Réutiliser d’abord les objets existants ; ne pas les recopier pour alimenter le parcours.
- **024-INT-02 — Création et modification réciproques.** Depuis une sous-action, ouvrir la fiche ou le formulaire du module, avec le contexte autorisé. Une création réussie apparaît dans le module et dans le parcours avec le même identifiant. Une modification effectuée directement dans le module est reflétée dans le parcours après relecture des données serveur. Aucun succès ne doit être affiché avant confirmation de l’enregistrement.
- **024-INT-03 — Travaux déjà réalisés.** À l’ouverture du parcours, retrouver les éléments existants pour le périmètre choisi et proposer leur association lorsqu’elle exige un choix. Ne pas obliger l’utilisateur à refaire un travail déjà présent. L’existence d’un objet ne suffit pas à déclarer une étape revue ou une exigence conforme.
- **024-INT-04 — Règles partagées.** Conserver les permissions serveur, versions, auteurs et historiques du module d’origine. Les actions, écarts et tâches héritent des périmètres de leurs registres ; le parcours n’ajoute pas de sélecteur de périmètre concurrent. Les preuves proviennent du registre commun et restent liées à leur version. Une évolution peut nécessiter une nouvelle revue sans réécrire les décisions historiques.
- **024-INT-05 — Contrats vérifiés avant codage.** Pour chaque sous-action, identifier le module cible, la route existante, le type d’objet, la commande de création/modification et les permissions. Vérifier ce qui fonctionne déjà dans la branche de l’IA qui code. Si une fonction manque, documenter le besoin et son intégration dans la plateforme ; ne pas la simuler comme opérationnelle dans le parcours. Les accordéons et préférences d’affichage peuvent rester propres au parcours, pas les données métier.
- **024-INT-06 — Recette d’intégration.** Vérifier une création depuis le parcours puis sa consultation dans le module, le chemin inverse, la mise à jour réciproque, la reprise d’éléments préexistants sans doublon, les accès refusés, les conflits de version et la conservation des preuves/historiques. Vérifier que ces opérations ne valident pas automatiquement la conformité.

**État actuel :** ces règles décrivent l’intégration attendue. La v002 est une maquette locale avec destinations prévues et données fictives ; elle n’est pas encore raccordée aux modules serveur.

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
