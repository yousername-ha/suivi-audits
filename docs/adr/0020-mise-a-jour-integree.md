# ADR 0020 — Mise à jour web et maintenance indépendante

Statut : accepté pour implémentation sur la branche de travail.

Le frontal HTTPS reste en service pendant le remplacement des composants applicatifs. L'exécutant privilégié est isolé de l'API : celle-ci garde ses réseaux internes et ne reçoit jamais le socket Docker. Les commandes web exigent le rôle système administrateur, une session complète et les contrôles CSRF/origine habituels. Les demandes sont enregistrées/auditées puis prises par une CLI locale, avec un identifiant idempotent. Le navigateur ne fournit que la confirmation et la version publiée déjà connue.

Le frontal sert des fichiers de maintenance/état atomiques et non sensibles, sans dépendre de PostgreSQL, de l'API ou de l'exécutant. Les écrans ouverts vérifient cet état et rejoignent la maintenance. La reprise utilise une sonde réelle de santé avant redirection, et un retour arrière n'est jamais présenté comme une installation réussie. Le système n'invente aucun pourcentage.

Un conteneur exécutant monté uniquement sur le projet, les données et le socket Docker est un composant de confiance ayant de fait les privilèges de l'hôte. Il n'expose aucun port, ne reçoit aucune requête HTTP et ne fait tourner aucun code fourni par un utilisateur. Il vérifie les images signées de la publication officielle. L'exécutant lui-même est remplacé à la fin de l'opération ; un journal durable permet sa reprise. Le frontal est versionné indépendamment des versions applicatives afin de préserver la disponibilité pendant ces remplacements.
