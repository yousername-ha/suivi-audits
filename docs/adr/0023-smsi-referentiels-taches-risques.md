# ADR 0023 — Registres transversaux et politiques versionnées par SMSI

Date : 10 octobre 2026. Décision : retenue pour le lot C, recette et contrôles de PR requis avant fusion.

## Contexte

Les objets v2 restent dans LegacyStore ; les cartes disposent déjà d’une scène, d’un canevas et d’exports. Les risques nécessitent plusieurs méthodes, des évaluations conservées et des portées distinctes. Les actions ne doivent pas devenir des copies propres à chaque référentiel ou chaque vue.

## Décision

Les migrations additives 012–014 ajoutent des politiques métier immuables, SMSI/membres, objets partagés, relations, publications de référentiels et méthodes, décisions de risques, séries/occurrences et notifications. Les permissions existantes se cumulent avec l’appartenance au SMSI et l’activation des modules. Le rôle système administrateur est identifié par ses droits réels, jamais par un libellé.

Le SMSI historique partagé conserve les sources v2. Les adaptateurs présentent les actions d’écarts et les prochaines réalisations récurrentes depuis leurs données d’origine. La réalisation écrit dans cette source avec contrôle de version et empreinte, sans reprise destructive ni copie éditable. Les autres objets historiques demeurent sélectionnables comme références ; les cartes historiques et leurs exports conservent leur contrat.

Les publications sont immuables. L’adoption d’une politique métier et la sélection d’une méthode par un SMSI sont explicites ; les décisions passées et risques existants conservent leur version. Le calcul distingue jugement explicite, matrice exhaustive et règles de correspondance. Aucun code utilisateur n’est exécuté. Les modèles méthodologiques sont organisationnels et ne prétendent ni fournir une norme ISO ni redistribuer une base MÉHARI.

Chaque décision conserve méthode/version, fiche source, critères bruts et résiduels, résultat, auteur/date et justification. Une tâche réalisée ne recalcule pas le résiduel. L’approbation impose les ateliers requis et le droit d’administration ; l’acceptation d’un résiduel inacceptable est refusée. Les correspondances de référentiels restent proposées jusqu’à une revue humaine distincte, y compris lorsqu’elles sont issues d’une IA ou importées.

Le planificateur existant de l’API génère des occurrences déterministes dans le fuseau choisi, verrouillées par série et protégées par une clé unique. Il rattrape 50 occurrences par série et traite 500 séries par passage, avec rotation sur la dernière vérification pour éviter la famine. Les références de référentiels désactivés suspendent les séries concernées. Les rappels restent internes ; l’intégration de transports externes appartient au lot I.

La carte relit le registre et les décisions. Les champs de référence des ateliers alimentent aussi le graphe ; aucune deuxième saisie graphique n’est nécessaire. Les facettes proviennent des objets liés autorisés. Les méthodes et versions ont leurs légendes propres ; les comparaisons ne rapprochent pas des scores incompatibles. Les événements SSE relisent les droits et la portée avant diffusion, y compris sur une connexion déjà ouverte.

## Bornes et conséquences

Les registres sont paginés par 50. La carte affiche au plus 1 000 risques, 1 000 nœuds et 2 500 relations sur six niveaux ; les limites sont annoncées dans l’interface. Les vues calendrier/planning refusent une période de plus de 2 000 actions. Les imports sont limités à 8 Mo compressés / 20 Mo décompressés, 10 000 exigences et 1 000 propositions de correspondance. Formules, entités XML externes, relations externes et chemins ZIP dangereux sont refusés.

Les projections datées figent les fiches et appréciations à la date choisie. Le réseau de relations reste celui du registre actuel, explicitement annoncé ; les modifications de relations sont tracées dans l’audit immuable. Les rapports HTML et JSON portent sur les sections autorisées et annoncent leurs plafonds.

Les documents officiels et droits de reproduction sont consignés dans [le registre des sources](../sources-lot-c.json). Les pages ISO publiques suffisent à identifier les éditions, pas à redistribuer leur contenu. Le PDF HDS 2024 n’a pas pu être obtenu auprès de l’ANS dans cet environnement ; l’arrêté et la transition sont identifiés par COFRAC. Les imports permettent l’utilisation de référentiels détenus légalement, avec déclaration et revue de provenance.

## Validation

Tests de migrations neuves et v2, conformité SQL/Drizzle, droits/CSRF/périmètres/SSE, publications/mappings/imports, quatre familles méthodologiques, récurrences/fuseaux/concurrence, reprise historique sans perte d’extras, cohérence des cinq vues, absence de recalcul implicite et registre de 10 000 risques. Parcours navigateur sur la pile Docker/TLS, mobile, exports et références visuelles existantes. La recette de mise à jour CI compare aussi les politiques, registres et décisions GRC avant/après mise à jour et retour arrière.
