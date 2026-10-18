# ADR 0042 — Retrait de l'écran /legacy

**Statut** : proposée le 18/10/2026 (lot H2e). Prolonge les [ADR 0007](0007-transition-legacy.md) (transition depuis l'outil
historique) et [0040](0040-sortie-du-json-plat-modules-en-tables.md) (sortie du JSON plat).

## Contexte

Tous les modules métier de l'outil historique sont repris dans des tables (ADR 0040) : `/legacy` n'affichait plus que
l'état recomposé, en lecture seule, et refusait toute écriture sur un module repris. La décision du RSSI est de
retirer l'ancien outil de l'application et de le conserver, testable, sur la branche d'archive
`archive/outil-legacy-autonome` (archive ZIP de l'outil autonome, version 3.4.0, avec sa somme de contrôle).

## Décision

- L'écran `/legacy`, son adaptateur (`legacy-shim`), sa politique CSP à scripts en ligne, ses bibliothèques locales et le
  chemin Caddy associé sont retirés. L'image de l'API n'embarque plus `app/public`.
- La lecture de l'état par la nouvelle interface passe par `GET /api/suivi/etat` et `GET /api/suivi/modules` (mêmes
  données, mêmes droits, même ETag qu'avant). `PUT /api/legacy/state` disparaît : les écritures passent par les écrans
  natifs (`nativeWrite`) et par l'import.
- Les exports Excel de l'ancien menu « Rapports et exports » sont repris côté serveur (`GET /api/suivi/export`, page
  « Exports Excel »). Les exports de comité (Word, PowerPoint, Excel) existent pour la revue de direction.
- **Conservés** : l'import et l'export au format historique (schéma 15), les versions de l'état et la restauration,
  `app/public/index.html` (référence des tests de parité et de la CI ; plus servi), la fixture anonymisée.

## Non repris (à décider)

Pronostic de l'audit en export, référentiel ReCyF (couvert par la page Couverture et les référentiels natifs), évaluations
fournisseurs (clausier) et GAP applications en export Excel. Ces limites sont listées dans le journal des modifications.

## Conséquences

- Une instance mise à jour n'a plus de page `/legacy` : un signet existant mène à la page d'erreur. Les données ne sont
  pas touchées (migrations 023 à 027, ADR 0040).
- Les tests d'écriture par `PUT /api/legacy/state` et de pages `/legacy` sont supprimés ; l'aide de test e2e `ecrireEtat`
  passe uniquement par l'import « Remplacer un module ».
- Retirer ensuite l'import historique serait une décision distincte (sauvegardes JSON, données de départ des tests).
