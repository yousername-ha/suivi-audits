# Stratégie de recette

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

Objectifs : prouver les contrats actuels, prévenir régression/données perdues,
séparer automatisation technique et acceptation utilisateur.

Environnements : workspace cloud pour tests purs ; runners GitHub dédiés pour
API/PostgreSQL et Docker/TLS ; serveur utilisateur non observé. Jeux fictifs :
tests/fixtures et fixtures générées par les tests. Aucune donnée réelle ajoutée.

Critères d’entrée : branche/commit connus, état Git préservé, environnement
isolé et autorisé, dépendances/versions identifiées, clés de recette fictives.
Inspecter setup et nettoyage avant tests API ou exploitation.

Critères de sortie : contrôles appropriés passés, erreurs/limitations documentées,
preuve datée/versionnée et aucune assertion abaissée pour contourner un échec.
Acceptation humaine séparée, explicite et traçable.

La mission a exécuté uniquement 360 tests sans connexion à une base, extraction
API et comparaison d’archive. L’API globalSetup crée/supprime des bases ; les
scripts Docker peuvent installer/resetter/restaurer leur environnement. Ils
restent NON EXÉCUTÉS pendant l’audit, même si leur CI précédente est PASSÉE.

En cas d’échec : conserver rapport privé, enregistrer BUG/EXE, classifier cause
démontrée versus hypothèse, corriger sous tâche autorisée puis rejouer le test
pertinent. Ne pas supprimer une référence ni relancer toute la CI par réflexe.
