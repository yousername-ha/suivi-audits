# Parcours et moteur multiméthode

## Moteur commun, sens métier distinct

Une méthode publiée référence ses étapes, leurs entrées/sorties typées, ses configurations et ses validateurs. Elle peut réutiliser sélecteurs, matrices, preuves et décisions. Elle ne récupère pas automatiquement les cinq ateliers EBIOS. Un formulaire rendu depuis un JSON ne suffit pas : les contraintes de cohérence propres à chaque méthode sont validées côté serveur.

Cycle d’étude proposé : Brouillon → En cours → En revue → Clôturée → Archivée. L’adaptateur conserve les états historiques existants (`En cours`, `Clôturée`, `Archivée`) ; les états supplémentaires exigent une évolution explicite des validateurs. Les étapes peuvent être revisitées ; une modification amont déclenche « À revoir » en aval, sans détruire les anciens livrables ni recalculer une décision. La clôture n’efface pas les risques suivis.

## EBIOS RM : cinq ateliers, livrables et validations

Les intitulés et la démarche sont issus du guide ANSSI v1.5. Les règles de complétude UI ci-dessous sont des **propositions d’application**, pas des exigences normatives universelles.

| Atelier | Entrées et actions | Livrables liés | Validation proposée |
|---|---|---|---|
| 1 — Cadrage et socle de sécurité | Cadre, participants, cycles, missions, VM, supports, besoins, ER, socle et écarts | Contexte ; associations VM/support ; ER évalués ; référentiels et écarts | Périmètre explicite, objets rapprochés, gravités justifiées, exceptions documentées |
| 2 — Sources de risque | SR/OV réutilisables ; couples ; motivation, ressources et activité ; pertinence ; sélection | Observations par couple ; proposition calculée si matrice publiée ; décision retenu/non retenu | Intentionalité compatible, justification de sélection, références VM/ER pertinentes |
| 3 — Scénarios stratégiques | Parties prenantes de l’écosystème ; caractérisation ; chemins stratégiques ; mesures sur l’écosystème | Évaluations contextuelles des parties prenantes ; scénarios stratégiques liés SR/OV et ER | Traces entre sources, objectif, chemin et conséquences ; hypothèses explicites |
| 4 — Scénarios opérationnels | Déclinaison des scénarios stratégiques ; actions élémentaires ; modes opératoires ; vraisemblance | Graphes et variantes ; évaluations de vraisemblance selon l’échelle choisie | Chaque variante reliée à son scénario ; étapes et vraisemblance justifiées |
| 5 — Traitement du risque | Synthèse, stratégie, mesures, risque résiduel et surveillance | Évaluations du registre ; plans/actions/preuves ; décisions d’acceptation ; réexamens | Décideur habilité, mesure appliquée ou hypothèse distinguée ; réévaluation explicite |

L’échelle d’activité et celles de dangerosité/vraisemblance ne sont pas dans l’export ARM. Les rendre configurables à partir de sources validées avant de les activer ; ne pas les compléter silencieusement. Les durées des cycles sont à choisir, pas à inventer depuis les cellules vides.

Le guide recommande d’apprécier motivation, ressources et activité (p. 38). La matrice ARM motivation×ressources est une configuration locale. L’activité peut être un critère documenté distinct ; elle ne devient pas un multiplicateur caché. La décision de retenir un couple reste explicite avec motif, y compris lorsqu’elle diffère d’une suggestion issue de la pertinence.

Le guide articule socle de sécurité pour les risques courants, accidentels/environnementaux et scénarios intentionnels avancés (p. 4). Un OV accidentel importé est conservé mais signalé : il ne doit pas être validé automatiquement comme objectif d’un attaquant dans l’atelier 2. L’icône incendie illustre un événement ou une catégorie adaptée, jamais une intention inventée.

## Représentations demandées

**Suivi ligne par ligne** : une ligne par objet évalué dans un contexte (couple en A2, risque en synthèse A5). Colonnes adaptables au type : SR, OV, VM/ER, dimensions, proposition, retenu, justification, propriétaire, état. La sélection pilote les panneaux inférieurs. Une multisélection affiche son nombre et ses références ; zéro sélection ne supprime aucune donnée.

**Matrice** : en A2, ressources×motivation→pertinence (3×3 ARM). En synthèse, gravité×vraisemblance→niveau de risque selon la politique publiée. Titre, axes, légende et version toujours visibles. La matrice de risque 4×4 de la maquette précédente est une proposition distincte ; elle n’est pas issue de cet export.

**Cercle** : groupement SR ou OV des couples ; anneaux par pertinence (élevée vers le centre pour la référence ARM), avec liste textuelle équivalente. En synthèse A5, ne pas réutiliser ce cercle en l’intitulant « risque » sans définir une autre sémantique. Afficher le contexte exact et les cas non évalués séparément.

**Scénario visuel** : colonnes Connaître / Rentrer / Trouver / Exploiter pour la vue opérationnelle inspirée du guide ; alternatives de chemins sélectionnables, transitions directionnelles animées, contour renforcé des nœuds sélectionnés, fond atténué des autres chemins. Animation CSS de flux sur un tracé SVG orienté ; `prefers-reduced-motion` fige le mouvement tout en conservant flèches et sélection. Le modèle de graphe permet des scénarios plus riches : ne pas imposer quatre étapes à toute méthode ou toute attaque.

## ISO/IEC 27005

Méthode paramétrable : contexte et critères ; identification ; analyse ; évaluation ; traitement ; acceptation et suivi, avec communication/consultation et revue. Cette séquence est une proposition de structuration de l’application ; ce dossier ne prétend pas reproduire le texte intégral de la norme ni en certifier la conformité. Consigner l’édition de référence retenue et les documents autorisés lors du cadrage métier.

Réutiliser risques, actifs, événements, évaluations, mesures et décisions. Ne pas rendre obligatoires les couples SR/OV, les ateliers EBIOS ou les colonnes du graphe opérationnel pour cette méthode. La comparaison des résultats dépend de critères compatibles publiés, jamais du seul libellé « ISO 27005 ».

## Personnalisée et MÉHARI

L’éditeur de méthodes personnalisées choisit les types d’objets, étapes, critères, configurations, justifications requises, validations et sorties. Les conditions restent déclaratives et limitées à des opérateurs autorisés ; prévisualisation et tests avant publication. Une méthode en brouillon ne crée pas d’étude validable.

MÉHARI existe comme méthode déclarée dans legacy. Préserver ses études et évaluations via un adaptateur `legacy-declared` ; ne pas promettre un moteur MÉHARI complet ni convertir ses données en EBIOS. Une extension complète nécessite ses propres sources et contrats.
