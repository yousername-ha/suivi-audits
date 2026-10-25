# ADR 0021 — Échelles et matrices organisationnelles immuables (B2a)

Statut : **retiré le 25/10/2026** ([ADR 0046](0046-retrait-du-catalogue-environnement.md)) ; accepté à l’origine sur la branche de travail.

La configuration métier centrale est distincte des réglages de sécurité/identité existants et de l'état v2. La migration additive 010 crée un registre de versions immuables et un pointeur vers la publication courante. L'initialisation idempotente conserve toute publication déjà présente ; la configuration initiale ne modifie aucune évaluation historique. Les triggers refusent modification, suppression et troncature des définitions publiées.

Le contrat partagé zod fixe identifiants, ordre, bornes, seuils et cellules. Le calcul utilise uniquement des opérations connues : produit, somme ou matrice exhaustive ; plafond, réduction de maturité et arrondi au dixième précèdent le classement. Pas de code, d'expression libre, de URL ni de moteur dynamique. La matrice initiale est une proposition organisationnelle à valider, sans portée normative. Elle ne remplace pas la méthode IA pondérée ni la matrice d'incidents v2.

La lecture exige `administration:lire` ; simulation et publication exigent `administration:administrer`, session complète/MFA, origine et CSRF. Un brouillon validé est lié à l'empreinte de sa définition et à la version de départ. La publication confirme `PUBLIER`, exige un motif et un If-Match, verrouille la ligne courante et enregistre définition/pointeur/audit dans une transaction unique. Une reprise d'ancienne définition crée une nouvelle version et conserve tout le passé. SSE ne transporte que version/auteur ; l'interface garde son brouillon lors d'une publication distante et impose un rechargement confirmé.

Les nouvelles évaluations métier devront référencer une version explicite et conserver leur résultat ; aucun consommateur ne doit recalculer une évaluation avec « la dernière configuration ». B2a livre édition, simulation, publication et consultation des configurations. Le raccordement des évaluations et les autres nomenclatures/workflows/modèles restent des sous-lots B2, avant C. Il n'est pas prétendu que ces consommateurs existent déjà.

Les exports/imports de l'état v2 restent inchangés : cette nouvelle configuration n'est pas dissimulée dans une clé legacy ni réimportée silencieusement. Sauvegarde/restauration PostgreSQL conserve le registre et son pointeur. L'extraction séparée des configurations et les migrations des objets métier seront spécifiées lors de leur raccordement.
