# ADR 0048 — Conservation : durées réglables, aperçu, aucune purge automatique

- Statut : acceptée
- Date : 2026-10-25
- Contexte : décision 2 du 25/10/2026 (dossiers 012-07 et 012-10), [ADR 0014](0014-donnees-sur-le-serveur-et-mises-a-jour.md).

## Décision

Une nouvelle section de paramètres **Conservation** (Administration, Plateforme, Conservation) fixe, par catégorie, une durée en jours ou la conservation sans limite (par défaut) :

- documents dans la corbeille (depuis leur mise à la corbeille) ;
- rappels déjà lus (depuis leur lecture) ;
- éléments archivés — fiches et registres (depuis leur dernière modification).

**Rien n'est supprimé automatiquement.** Il n'y a ni planificateur ni tâche de nettoyage. Un **aperçu en lecture seule** (`GET /api/settings/conservation/apercu`) dit, pour chaque durée réglée, combien d'éléments seraient candidats, combien sont protégés par une règle de conservation, et la date du plus ancien. Un document cité comme preuve (fiche, lien, décision, validation) est compté comme protégé : sa suppression définitive reste refusée, comme aujourd'hui. Le journal d'audit est immuable et n'apparaît pas.

La section suit le mécanisme des paramètres (version par section, `If-Match`, journal d'audit à chaque enregistrement). Droit de lecture et d'écriture : `parametres:lire` / `parametres:modifier`.

## Ce qui n'est pas fait

- Aucune purge, manuelle ou automatique, n'est ajoutée : la suppression définitive d'un document reste l'action de Documents (`documents:administrer`). Il n'existe pas de suppression des rappels ni des éléments archivés ; l'aperçu n'en mesure que l'ancienneté.
- Pas de motifs d'exclusion par catégorie, ni de durées par périmètre.
- L'aperçu s'arrête à 2 000 documents en corbeille ; au-delà, il compte les 2 000 plus anciens.

## Conséquences

- Aucune migration SQL : les durées vivent dans la table `settings`.
- La vérification « document cité comme preuve » est extraite dans `apps/api/src/documents-usage.ts` et partagée avec la suppression définitive.
