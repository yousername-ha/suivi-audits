# Lot C — tâches récurrentes, risques et cartographie SMSI

Statut : **exigences à implémenter**, ajoutées à la demande utilisateur du 10 octobre 2026. Ce document ne décrit pas des fonctionnalités déjà livrées. **Terminer B2 avant de commencer C.** Ces exigences complètent C1–C6 ; elles ne remplacent ni les référentiels/mappings ni la reprise obligatoire du socle v2.

Branche exclusive : `feature/gpt6-evolution-smsi-grc`. Diagnostic préalable, migrations additives, tests et PR laissée ouverte ; aucune modification directe de main ni fusion automatique.

## C7 — moteur transversal de tâches récurrentes

Une tâche/action est un objet partagé, lié à plusieurs objets sans duplication : référentiels activés, exigences, mesures, risques, audits, contrôles et plans d’action. Réutiliser et reprendre les actions existantes avant de définir les extensions ; ne pas créer un second registre déconnecté des écarts ou des plans d’action.

Fonctions exigées : récurrences configurables, responsables, échéances, rappels, statuts, justificatifs, historique et automatisations. Les vues **Kanban, liste, calendrier, planning/Gantt et tableau de bord** consultent et modifient les mêmes données, avec droits et traçabilité cohérents. Distinguer une définition récurrente de ses occurrences et de leurs décisions de clôture ; le contrat exact doit être établi lors du diagnostic.

Les automatisations restent contrôlées, idempotentes et traçables. Éviter les occurrences et rappels en double lors d’un réessai ou redémarrage. Définir explicitement fuseaux horaires, changements de récurrence, échéances, traitement des retards, désactivation des référentiels et historique des occurrences. Réutiliser les mécanismes existants lorsque leur contrat convient ; ne pas confondre tâches métier et commandes d’exploitation du lot A. Raccorder les rappels au transport autorisé du lot I lorsqu’il est disponible, en distinguant notification interne et email réellement envoyé.

## C8 — registre et moteur méthodologique de risques

Support prioritaire d’**EBIOS Risk Manager et de ses cinq ateliers ANSSI**, avec compatibilité **ISO 27005:2022**, **MÉHARI** et méthodes personnalisées. Ne pas réduire ces démarches à une formule universelle ni prétendre qu’une matrice suffit à mettre en œuvre une méthode.

Chaque SMSI peut sélectionner sa méthode et adapter sa politique d’appréciation des risques. Versionner les configurations, politiques, évaluations et décisions. Personnaliser :

- Étapes, workflows, formulaires et champs.
- Échelles de gravité, vraisemblance, impact et criticité.
- Dimensions d’impact : DICP, financier, juridique, métier, réputation et dimensions personnalisées.
- Matrices, règles de calcul, seuils d’acceptabilité et niveaux de risque.
- Stratégies de traitement, validations et critères de réévaluation.

Implémenter le registre, les scénarios, les risques bruts et résiduels, les plans de traitement et le suivi périodique. Reprendre les données et identifiants existants, avec une correspondance explicite et réversible lorsque nécessaire. Les configurations et décisions B2a/B2b constituent des capacités réutilisables, **pas un modèle de calcul obligatoire pour toutes les méthodes**. Les règles configurables ne permettent aucune exécution arbitraire de code.

Une mesure de traitement peut générer des actions suivies et apporter des éléments à l’évaluation du risque résiduel. L’avancement ou la clôture d’une action **ne modifie jamais automatiquement une évaluation résiduelle** : une réévaluation explicite et tracée est nécessaire. Conserver les évaluations antérieures et la configuration exacte utilisée, même après évolution d’une méthode ou d’un périmètre.

## C9 — cartographie des risques issue du registre

Réutiliser le module cartographique existant, ses composants graphiques, filtres, interactions et conventions Sauge. Les données métier de la carte proviennent exclusivement du registre des risques et de ses relations ; aucune deuxième saisie ni copie indépendante des risques. Les positions et préférences de présentation éventuelles restent distinctes des données métier.

Selon la méthode choisie, représenter :

- Risques bruts et résiduels ; criticité, impact, vraisemblance et acceptabilité.
- Regroupements par actif, processus, périmètre, entité, scénario ou domaine de sécurité.
- Sources de risque, événements redoutés, biens supports, scénarios stratégiques, scénarios opérationnels et mesures de traitement, notamment pour EBIOS RM.
- Risques traités, acceptés, transférés, évités ou en réduction.
- Évolutions dans le temps et comparaisons entre évaluations.

Filtres dynamiques, légende configurable, codes couleur et niveaux personnalisables, fiche détaillée au clic, export de la carte et rapports exploitables en comité SMSI ou en audit. Les règles d’affichage, de regroupement, de calcul et de couleur sont configurables **par SMSI et versionnées**. Ne supposer ni une matrice unique, ni une échelle commune, ni une comparaison numérique valide entre méthodes incompatibles. Le contrat de comparaison doit expliciter la méthode, les versions et les dimensions réellement comparables.

Actualiser la cartographie après création, modification, validation et réévaluation, en réutilisant le temps réel existant. Les fiches, cartes, tableaux de bord, rapports et exports utilisent les mêmes données et décisions. Appliquer les droits d’accès et périmètres à toutes les projections, filtres, agrégats, exports et événements ; masquer un objet ne doit pas laisser ses informations accessibles par ses relations ou un total.

## Liens natifs et bidirectionnels

Tâches, risques et cartographie sont liés aux actifs, exigences ISO/HDS, contrôles, déclaration d’applicabilité (SoA/DDA), preuves et leurs versions, audits, incidents, non-conformités, objectifs et indicateurs SMSI. Un lien est consultable depuis chacun des objets autorisés sans créer de copie métier. Respecter l’activation des modules et la conservation des historiques lors d’une désactivation.

Le diagnostic doit inventorier les modèles, adaptateurs de cartographie, permissions, portées et relations existants avant de proposer les contrats. Si l’existant ne représente pas encore plusieurs SMSI ou leurs périmètres, établir et tester ce support explicitement ; ne pas assimiler silencieusement une instance à un SMSI universel.

## Sources officielles et distinction normative

Utiliser exclusivement les publications officielles applicables : **ISO/IEC 27001:2022, ISO/IEC 27005:2022, ANSSI EBIOS Risk Manager, CLUSIF MÉHARI et référentiel HDS 2024**. Identifier avant implémentation le document officiel exact, sa version, ses éventuelles mises à jour, la date de consultation et les droits de réutilisation. Les sources ISO peuvent nécessiter un accès sous licence ; ne pas reconstruire les textes inaccessibles ni reproduire une norme sans droit.

Points de départ officiels à vérifier pendant le lot : ISO (`https://www.iso.org/`), ANSSI (`https://cyber.gouv.fr/`), CLUSIF (`https://clusif.fr/`), ANS/HDS (`https://esante.gouv.fr/services/hebergeurs-de-donnees-de-sante/les-referentiels-de-la-procedure-de-certification`). Ces adresses ne constituent pas une validation documentaire déjà réalisée.

Dans l’interface, les modèles et les rapports, distinguer exigence normative sourcée, recommandation méthodologique et choix configurable du SMSI. Aucun score, lien, mapping ou achèvement de tâche ne vaut conformité ou certification automatique.

## Découpage et critères de passage

C1–C6 restent nécessaires pour les référentiels, leurs versions, mappings et imports. Les dépendances de C7–C9 seront précisées après diagnostic ; le moteur partagé doit alimenter G (preuves/contrôles), H (actions/amélioration) et K (parcours SMSI), sans implémentations concurrentes. Le découpage en livraisons testables ne réduit pas le périmètre demandé : **les cinq vues de tâches et la cartographie de risques fonctionnelle font partie du lot C**.

| Domaine | Recette requise avant validation |
|---|---|
| Reprise de l’existant | Données, identifiants, liens, historiques, calculs et exports v2 préservés ; absence de recalcul silencieux ; migrations neuves et sur base existante testées |
| Tâches partagées | Une action liée à plusieurs objets, éditable depuis les vues autorisées sans duplication ; cinq vues synchronisées ; historique et justificatifs cohérents |
| Récurrences et rappels | Occurrences/notifications sans doublon après réessai, concurrence et redémarrage ; tests des fuseaux, changements de calendrier, retards et configuration |
| Méthodes | Parcours EBIOS RM couvrant les cinq ateliers ; cas ISO 27005, MÉHARI et personnalisé ; workflows et calculs distincts, configurations publiées versionnées |
| Décisions | Risques bruts/résiduels conservés avec versions ; validations, acceptabilité et stratégies tracées ; une action terminée ne recalcule pas automatiquement le résiduel |
| Cartographie | Registre, fiches, cartes, tableaux de bord et rapports cohérents après mutation ; graphes et dimensions propres aux méthodes ; filtres, légende, détail, exports et comparaison temporelle |
| Droits et périmètres | Contrôles serveur, MFA/origine/CSRF, activation B1 ; absence de fuite inter-SMSI, par relation, agrégat, événement, rapport ou export |
| Volumes | Pagination et requêtes/index adaptés ; filtrage côté serveur, volumes représentatifs et budgets de performance documentés ; carte exploitable sans charger systématiquement tout le registre |
| Interface et non-régression | Français, Sauge, responsive et accessibilité ; composants cartographiques réutilisés ; parcours navigateur réels et captures existantes conservés |
| Sources et traçabilité | Documents officiels identifiés/versionnés, droits vérifiés ; choix méthodologiques distincts des obligations normatives ; audit atomique et historique consultable |

Une maquette, une liste de recommandations ou un build réussi ne clôture pas C7–C9. Chaque livraison doit inclure API, persistance, permissions, interface, tests automatisés appropriés et résultats exécutés. Préparer les PR sans fusion automatique ; informer l’utilisateur des étapes franchies et des limites restantes.
