# ADR 0096 — Déclaration d'applicabilité par périmètre

**Statut** : acceptée le 13/11/2026 (décision du RSSI du 13/11/2026, BUG-062 de la campagne de recette). Numéro annoncé au RSSI.
Complète l'[ADR 0092](0092-refonte-des-droits-pyramide-des-perimetres.md) et l'[ADR 0039](0039-hierarchie-des-perimetres.md).

## Contexte

La déclaration d'applicabilité (DdA, ISO/IEC 27001:2022, 6.1.3 d) était un registre historique unique (`dda` de l'état), affiché derrière
le sélecteur « Périmètre affiché » : une décision prise sous un sous-périmètre se retrouvait sous la racine (C3-01).

## Décision

1. **Le périmètre commun garde la DdA de l'outil de suivi** (clé `dda`, aucune migration de données).
2. **Chaque autre périmètre a sa propre DdA** : table `dda_perimetres` (migration `061`, additive), une ligne par mesure décidée. Une mesure
   sans ligne reste « non examinée » dans ce périmètre. La liste des mesures (`items`) reste commune ; les décisions, non.
3. Mêmes règles partout : applicabilité décidée avant tout niveau (BUG-065), clauses ISO obligatoires (niveau, documents, lien et commentaire
   seulement), accès au périmètre exigé (404 sinon, écriture en écriture), droits `audit:modifier` et `pilotage:modifier`.
4. **Écarts** : sous un périmètre autre que le commun, la DdA reprend les écarts natifs de ce périmètre (références `legacy:items:` ou exigence du
   référentiel). **Couverture** d'un référentiel : à défaut d'évaluation enregistrée, elle reprend la DdA du périmètre (BUG-063).
5. **Pas d'héritage de la DdA du parent** : un enfant, même héritier des référentiels, décide pour lui-même (une preuve ou une décision n'est
   pas réputée valable pour une autre entité, ADR 0039 point 4).

## Conséquences

- API : `GET /api/dda?reference=&smsi=` et `PATCH /api/dda/:id?smsi=` (sans `smsi` : périmètre commun, comme avant).
- Pas d'historique d'état propre aux DdA des périmètres (journal d'audit `dda.updated` seulement) ; pas de contrôle de version (`If-Match`).
- Retour arrière : la table est ignorée d'une version antérieure, qui n'affiche alors que la DdA commune.
