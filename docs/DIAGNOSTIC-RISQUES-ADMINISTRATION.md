# Diagnostic préalable — administration et registre des risques

Branche exclusive `legacy/test-lots-d-f`, 11 octobre 2026.

Le Legacy possède les périmètres, rôles, actions et preuves centraux, mais aucun
registre général des risques ni étude EBIOS structurée. Les risques IA et textes
de comité existants sont spécifiques et ne doivent pas être convertis implicitement.
La carte du SMSI utilise `mtile`, `.map`, `.mrow`, `.tiles` et les légendes partagées :
ces composants seront réutilisés pour la cartographie des risques.

Les rôles existants sont conservés ; un catalogue de fonctions de base sera ajouté
sans inventer de titulaires ni de comptes. Les formulaires de comptes et rôles seront
réutilisés par l’administration. Celle-ci regroupera paramètres, habilitations,
référentiels, journal et démonstration, sans écran de sauvegarde ou de mise à jour.

Les clés techniques existantes restent stables. Les références internes lisibles
seront attribuées automatiquement par le serveur : PERI, IMP, RISK, EBRM, EVR,
SCEN, MES, DEC, TRT, ACT, PRE, ROLE, etc. Un compteur SQLite transactionnel
évite les collisions et la réutilisation après suppression ; les références anciennes
sont conservées. Le champ interne du périmètre devient non modifiable.

Nouvelles collections indépendantes : risques, études, évaluations, scénarios,
politiques méthodologiques versionnées, plans de traitement, mesures et décisions.
Les études contiennent des références aux risques ; les évaluations relient les deux.
Le risque conserve ses références initiale/résiduelle et sa décision d’acceptation.
L’archivage d’une étude ne modifie aucun risque ni évaluation. Les évaluations et
décisions sont append-only, datées et attribuées au compte authentifié côté serveur.
La carte utilise uniquement les références explicites du risque, jamais une moyenne
ou la dernière ligne historique sélectionnée arbitrairement.

Les contrôles de périmètre/CSRF/version existants seront étendus aux collections.
Les règles humaines, l’immutabilité et les relations sont contrôlées sur le serveur.
Une action de traitement terminée ne recalcule jamais un risque résiduel : une
nouvelle évaluation est nécessaire. Les échelles proposées sont des choix internes,
sans prétention de constituer les barèmes normatifs des méthodes.

Le jeu de données sera explicitement FICTIF, ajouté sur demande depuis
l’administration, idempotent et sans écrasement des données existantes. Il démontrera
un GHT, deux établissements, des rôles, CaRE/PCRA et le critère des trois risques
avec deux études dont la seconde réévalue un seul risque.
