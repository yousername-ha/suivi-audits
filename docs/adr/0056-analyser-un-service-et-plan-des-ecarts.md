# ADR 0056 — Analyser un service et créer le plan d'action des écarts

- Statut : acceptée
- Date : 2026-10-25
- Contexte : décision 8 du 25/10/2026 : le besoin est de faire l'analyse d'écart d'un service, d'une application interne ou d'un usage de l'IA face à un référentiel, pour construire le plan d'action. Le service analysé est **un périmètre enfant** de la hiérarchie ([ADR 0039](0039-hierarchie-des-perimetres.md)), évalué exigence par exigence ([ADR 0041](0041-evaluation-des-exigences-et-couverture.md)). Le kit IA ([ADR 0055](0055-kit-integration-ia.md)) fournit le référentiel des contrôles IA.

## Décision

- **Assistant « Analyser un service »** (Conformité et audits > Référentiels et exigences) en quatre étapes : le service (nom, description, périmètre parent, héritage des référentiels du parent), la qualification (données de santé possibles ? IA embarquée ou outils d'IA utilisés, et lequel ?), les référentiels (proposés d'après les réponses, jamais rattachés sans case cochée), puis la Couverture du service. Il s'appuie sur les routes existantes (création de périmètre, rattachement de référentiel) : aucune table nouvelle.
- **La qualification oriente, elle n'évalue pas.** Santé « oui » propose l'HDS, IA « oui » propose les contrôles IA internes, l'ISO/IEC 27001 est toujours proposée. Un référentiel absent de la bibliothèque est dit absent, avec le chemin pour l'importer. Les réponses sont conservées en clair dans le texte du périmètre (« Qualification : … ») ; « je ne sais pas encore » reste « à préciser ».
- **Action groupée « Créer le plan d'action des écarts »** (Couverture, détail d'un référentiel). Un **écart** est une exigence dont l'évaluation effective est **applicable** et dont l'état est **non implémenté** ou **partiel**. Une exigence « à déterminer », exclue ou jamais évaluée n'est pas un écart. Une obligatoire (clauses 4 à 10 de l'ISO/IEC 27001) exclue à tort est comptée comme applicable (règle de la couverture).
- **Aperçu puis création confirmée** : `GET /api/grc/:smsi/plan-ecarts?frameworkId=` (lecture seule : écarts, déjà portés par une action, à créer, hors écart) puis `POST` avec les identifiants d'exigence, le plan d'actions d'accueil (registre par défaut sinon), une échéance commune facultative et la confirmation `CREER`. Le serveur **recalcule l'éligibilité** : un identifiant qui n'est plus un écart ou qui est déjà couvert est ignoré et compté.
- **Idempotence** : une exigence qui a déjà une action **active** liée (« met en œuvre ») n'en reçoit pas une deuxième ; un verrou transactionnel par exigence évite les doublons en cas de demandes simultanées. Rejouer ne crée rien. Au plus 200 actions par lot.
- **Droits** : lecture de la conformité et accès au périmètre pour l'aperçu ; création d'une action dans le registre choisi (gestion du registre, ou droit de modification du module et accès en écriture au périmètre pour le registre par défaut) pour la création. Journal d'audit `grc.plan_ecarts.created`. Le lot ne modifie aucune évaluation ni aucune exigence.

## Ce qui n'est pas fait

- Le responsable des actions n'est pas choisi dans le lot (à préciser action par action) ; l'échéance est commune.
- Une action terminée mais dont l'exigence reste en écart ne reçoit pas de nouvelle action automatiquement : l'écart se constate en réévaluant l'exigence.
- La qualification n'est pas un champ structuré du périmètre : elle est écrite dans son texte, lisible mais non filtrable.
- Les points IA du questionnaire « Applications à intégrer » ne sont pas encore remplacés par le kit.

## Conséquences

Deux routes, un service (`GrcPlanEcarts`) et deux composants ; aucune migration. L'assistant ne remplace pas la page Périmètres : il enchaîne les gestes qu'on y fait séparément.
