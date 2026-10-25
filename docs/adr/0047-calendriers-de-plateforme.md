# ADR 0047 — Calendriers de plateforme (jours fériés français et iCalendar)

- Statut : acceptée
- Date : 2026-10-25
- Contexte : décision 4 du 25/10/2026 (dossiers 012-14, 018-08, 018-09), [ADR 0014](0014-donnees-sur-le-serveur-et-mises-a-jour.md) (l'application n'a pas d'accès Internet).

## Décision

Un administrateur tient des **calendriers de plateforme** (Administration, Plateforme, Calendriers). Deux types :

- **Jours fériés** : les onze jours fériés légaux de la France métropolitaine (Code du travail, art. L3133-1) sont **calculés** pour une année (date de Pâques par le comput grégorien, puis lundi de Pâques, Ascension, lundi de Pentecôte). Les jours propres à l'Alsace-Moselle et à l'outre-mer ne sont pas calculés : ils se chargent par un fichier iCalendar.
- **Autre calendrier** : fermetures ou événements, importés depuis un fichier iCalendar collé ou lu par le navigateur, avec le lecteur existant (`lireIcs`, erreurs avec leur ligne, tout ou rien).

Le serveur ne consulte aucune adresse distante et rien ne se renouvelle seul : la **mise à jour annuelle** est une action de l'administrateur. L'écran signale les années à couvrir (l'année courante, et la suivante à partir d'octobre) pour un calendrier de jours fériés. Toute génération ou import passe par un **aperçu** ; rejouer une mise à jour n'ajoute aucun jour déjà présent. Chaque mise à jour est consignée dans un **journal immuable** (opération, année, jours ajoutés ou retirés, provenance, motif, auteur) en plus du journal d'audit. Retirer une année exige un motif ; un calendrier ne se supprime que vide.

Les **séries de tâches** reprennent ces jours : à l'import d'un calendrier dans une série (route existante `POST /api/grc/:smsi/series/:id/calendrier`), la personne choisit soit un fichier, soit un calendrier de plateforme (et une année). Les jours sont **copiés** dans les jours exclus de la série, avec l'aperçu et le contrôle de version déjà en place.

## Ce qui n'est pas fait

- Les **zones scolaires** (A, B, C, Corse) ne sont pas gérées, par décision ; elles sont au [fichier d'idées](../08_PILOTAGE/IDEES.md).
- La reprise est une **copie** : une mise à jour ultérieure du calendrier de plateforme n'est pas répercutée sur les séries qui l'ont déjà reprise. Une référence vivante demanderait que le moteur de récurrence lise les calendriers à chaque calcul ; elle est écartée pour cette livraison.
- La **couche d'affichage** des fériés derrière les tâches (018-09, Timeline et Calendrier) reste à faire.
- Les libellés des jours importés par iCalendar ne sont pas conservés (le lecteur ne retient que les dates).

## Conséquences

- Migration additive `039_calendriers_plateforme.sql` : `calendriers_plateforme`, `calendriers_plateforme_jours`, `calendriers_plateforme_journal` (immuable).
- Routes sous `/api/calendriers-plateforme` ; lecture ouverte à toute personne connectée (les séries en ont besoin), écritures réservées au droit `administration:administrer`.
- `CalendrierBody` (série) accepte `ics` ou `calendrier` (+ `annee`), jamais les deux.
