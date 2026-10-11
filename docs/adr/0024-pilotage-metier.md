# ADR 0024 — Pilotage métier, décisions G/H/K et début E

Date : 10 octobre 2026. Décision : retenue sur la branche de travail, sans fusion automatique.

L’interface du lot C est rejetée en recette utilisateur. Le pilotage doit organiser plusieurs référentiels, y compris un SMQ, et reprendre les familles du menu historique. Le parcours normal affiche les données communes automatiquement ; il ne crée plus de SMSI. Les tables/API de périmètres privés sont conservées pour leurs accès et historiques.

Réutiliser les objets, relations, publications, documents, moteur de tâches et styles existants. Introduire des écrans métier et adaptateurs d’édition directe du socle historique plutôt qu’une migration de copies. L’empreinte de la fiche et la version globale protègent les mutations historiques ; les champs non modélisés sont conservés.

Ajouter une table immuable de décisions de pilotage pour preuves, réalisations, efficacité, clôture, étapes et validations. Les commandes gardent versions, date/auteur, justification, références exactes et instantané source ; leurs effets métier/audit sont transactionnels et idempotents. Les contrôles génèrent les constats/actions du même moteur ; les clôtures et validations ne sont pas des champs modifiables librement. Les contrôles restent planifiés par les séries existantes, sans second planificateur.

Le parcours guidé est une orchestration de travaux existants ; ses validations sont liées à sa version. Son avancement ne représente ni certification ni conformité. Les formulaires BIA/continuité/exercice commencent E avec des choix génériques ; aucun kit ou texte officiel indisponible n’est inventé. D/J/I/F restent hors périmètre.

Conséquences : migration additive 015, aucune nouvelle dépendance/service, maintien de la compatibilité des périmètres privés et du socle v2. Les rapports HTML sont autonomes, échappés, sans scripts ni ressources distantes ; JSON conserve les identifiants de traçabilité. Le plan de non-régression couvre l’existant C, droits, données, concurrence, anti-contournement, grands registres et usages mobiles.
