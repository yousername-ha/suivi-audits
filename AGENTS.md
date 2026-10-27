# Consignes persistantes pour la reprise

Lire [HANDOVER.md](HANDOVER.md), [PROJECT_STATUS.md](PROJECT_STATUS.md),
[l’index](docs/00_INDEX.md) et le [DAT](docs/03_ARCHITECTURE/DAT.md) avant intervention.
Suivre également [CONTRIBUTING.md](CONTRIBUTING.md).

## Périmètre actuel

- Branches : `main` (version Docker unique), `claude-suivi-smsi` (branche de travail),
  `legacy` (outil historique autonome) ; anciennes branches sous `archive/*`.
  Vérifier l’état Git avant toute édition. Aucun commit direct, reset ou réécriture sur `main` :
  `main` n'évolue que par PR depuis `claude-suivi-smsi`, après CI verte et accord du RSSI.
- Dépôt public depuis le 11/10/2026 : aucune donnée réelle ni aucun secret. Aucune suppression
  d’historique/artefact ni anonymisation des auteurs sans instruction explicite.
- Périmètre métier demandé : pilotage multi-référentiels, G/H/K, début E et
  préservation de tout v2. D/J/I/F sont exclus de la livraison actuelle.
  Un besoin historique ne donne pas à lui seul autorisation d’implémenter un lot exclu.
- Audit documentaire terminé ; entretien du dépôt autorisé sur la branche dédiée.
  Supprimer uniquement les éléments dont l’inutilité est démontrée et tracer les
  références contrôlées. Préserver archives, preuves et sources encore consommées.
  Publier les changements par la PR ouverte, sans fusion ni déploiement.
- Communiquer en français les étapes franchies et limites.

## Sessions parallèles (directive commune du 27/10/2026, validée par le RSSI)

Depuis le 27/10/2026 (fin de la session « Opus »), **une seule session est active** (« Sonnet »). Les règles ci-dessous
restent valables si plusieurs sessions Claude travaillent de nouveau en même temps sur le dépôt :

1. Branche de référence unique : `claude-suivi-smsi`. Chaque session travaille sur sa propre branche (`claude/…`) et y
   fusionne `claude-suivi-smsi` avant tout travail.
2. Toute PR vise `claude-suivi-smsi`, en fusion classique (merge commit), après les 7 contrôles verts. Rien ne vise
   `main` directement : `main` n'évolue que par la PR `claude-suivi-smsi` → `main`, fusionnée par le RSSI ou sur son
   accord explicite. Aucune étiquette `v*` sans le RSSI.
3. Les PR Dependabot visent `claude-suivi-smsi` (`target-branch` de `.github/dependabot.yml`) ; une PR Dependabot
   ouverte vers `main` avant ce réglage est fermée.
4. Avant de toucher `apps/api/src` ou un fichier tenu par une autre session, prévenir celle-ci par le RSSI. Aucun fichier
   n'est tenu par une autre session depuis le 27/10/2026 (`apps/api/src/historique/gap.ts`, GAP IA, était tenu par la session
   Sonnet, aujourd'hui seule active).
5. Numéros d'ADR : annoncer le numéro pris au RSSI avant de l'utiliser (0065 retenu par la session Sonnet le 27/10/2026).
6. Dossier de reprise commun : le plus récent de `docs/01_REPRISE_IA/REPRISE-*.md`.

## Invariants techniques

- Réutiliser React/Mantine, `packages/ui`, Fastify, zod et PostgreSQL.
  Une dépendance nouvelle nécessite une ADR.
- Toute route utilise `route()`, garde serveur, MFA/session, activation de
  module, CSRF/origine et périmètre ; le filtrage du menu ne vaut pas permission.
- Respecter `If-Match`, versions, transactions, audit et SSE filtré.
- Une seule source modifiable par objet. Les adaptateurs Pilotage écrivent
  directement le legacy commun ; seule la carte maps possède un mapper
  enregistré dans LegacyStore. Ne pas transformer cela en migration complète.
- Préserver IDs, champs extra, historique, relations et exports. L’écran `/legacy` est retiré
  (ADR 0042) ; l’import/export au format historique et les versions de l’état sont conservés.
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
  sans autorisation. Ne pas promettre
  50 % de minutes économisées à partir de 50 % de scans supprimés.

## Fin de session

Actualiser proportionnellement le registre bugs/optimisations, les tests réels,
les décisions structurantes, les guides impactés, le backlog, le journal et
HANDOVER. Calculer les chiffres depuis `docs/08_PILOTAGE/REGISTRES.json`.
Conserver les validations historiques datées sans les attribuer au nouveau commit.
Indiquer la prochaine action précise et les contrôles NON EXÉCUTÉS.
Horodatage utilisateur : Europe/Paris. Ne jamais simuler une validation humaine.
