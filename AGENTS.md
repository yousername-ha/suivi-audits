# Consignes persistantes pour la reprise

Lire [HANDOVER.md](HANDOVER.md), [PROJECT_STATUS.md](PROJECT_STATUS.md),
[l’index](docs/00_INDEX.md) et le [DAT](docs/03_ARCHITECTURE/DAT.md) avant intervention.
Suivre également [CONTRIBUTING.md](CONTRIBUTING.md).

## Périmètre actuel

- Branche exclusive : `feature/gpt6-evolution-smsi-grc`. Vérifier l’état Git avant toute édition.
  Aucun commit, push, reset, merge ou réécriture sur `main`.
- Garder le dépôt privé. Aucun changement de visibilité, aucune suppression
  d’historique/artefact ni anonymisation des auteurs sans instruction explicite.
- PR vers `main` laissée ouverte ; pas de fusion automatique.
- Périmètre métier demandé : pilotage multi-référentiels, G/H/K, début E et
  préservation de tout v2. D/J/I/F sont exclus de la livraison actuelle.
  Un besoin historique ne donne pas à lui seul autorisation d’implémenter un lot exclu.
- Audit documentaire terminé ; entretien du dépôt autorisé sur la branche dédiée.
  Supprimer uniquement les éléments dont l’inutilité est démontrée et tracer les
  références contrôlées. Préserver archives, preuves et sources encore consommées.
  Publier les changements par la PR ouverte, sans fusion ni déploiement.
- Communiquer en français les étapes franchies et limites.

## Invariants techniques

- Réutiliser React/Mantine, `packages/ui`, Fastify, zod et PostgreSQL.
  Une dépendance nouvelle nécessite une ADR.
- Toute route utilise `route()`, garde serveur, MFA/session, activation de
  module, CSRF/origine et périmètre ; le filtrage du menu ne vaut pas permission.
- Respecter `If-Match`, versions, transactions, audit et SSE filtré.
- Une seule source modifiable par objet. Les adaptateurs Pilotage écrivent
  directement le legacy commun ; seule la carte maps possède un mapper
  enregistré dans LegacyStore. Ne pas transformer cela en migration complète.
- Préserver IDs, champs extra, historique, relations et exports. Ne pas retirer
  `/legacy` tant que chaque famille n’a pas un remplacement recetté.
- Ajouter les migrations ; ne jamais réécrire une migration publiée.
- Décisions/publications immuables ; une action terminée ne recalcule pas le résiduel.
- L’API n’obtient ni socket Docker, ni commandes shell arbitraires, ni clés
  privées de sauvegarde. Les workers restent hors API.
- Sources ISO/ANSSI/CLUSIF/ANS officielles, versions/licences documentées.
  Une grille inaccessible n’est pas reconstruite. Aucun taux de conformité inventé.

## Validation et preuves

- Vérifier les fonctions impactées puis exécuter les tests pertinents autorisés.
  Préférer les tests purs pour un changement documentaire.
- Inspecter le setup avant tests API/Docker. Bases temporaires, restaurations,
  migrations et tests de charge uniquement dans un environnement isolé prévu
  et autorisé pour la tâche ; aucune opération destructive en production.
- Consigner commandes, codes retour, commit, date/fuseau, environnement et limites.
  Ne masquer aucun échec ; ne déclarer PASSÉ qu’un résultat vérifiable.
- Pas de mot de passe, token, cookie, clé, adresse personnelle ou donnée réelle
  dans les nouvelles preuves/documents. Rapports bruts privés hors Git ;
  preuves publiques synthétiques et anonymisées.
- Captures réelles seulement. Ne pas approuver automatiquement de nouvelles
  références visuelles ni réduire des assertions pour rendre la CI verte.
- Un seul scan Trivy bloquant HIGH/CRITICAL par image ; garder SBOM et garde
  de publication CI+CodeQL sur le commit exact.
- Pas de relance GitHub ou publication d’images pour compléter un audit local
  sans autorisation. Le budget Actions est une contrainte ; ne pas promettre
  50 % de minutes économisées à partir de 50 % de scans supprimés.

## Fin de session

Actualiser proportionnellement le registre bugs/optimisations, les tests réels,
les décisions structurantes, les guides impactés, le backlog, le journal et
HANDOVER. Calculer les chiffres depuis `docs/08_PILOTAGE/REGISTRES.json`.
Conserver les validations historiques datées sans les attribuer au nouveau commit.
Indiquer la prochaine action précise et les contrôles NON EXÉCUTÉS.
Horodatage utilisateur : Europe/Paris. Ne jamais simuler une validation humaine.
