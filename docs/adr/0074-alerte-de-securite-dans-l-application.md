# ADR 0074 — Alerte de verrouillage dans l'application

- Statut : acceptée par le RSSI le 29/10/2026 (numéro confirmé)
- Date : 2026-10-28
- Contexte : l'[ADR 0070](0070-reponse-de-connexion-uniforme-et-alerte-de-verrouillage.md) envoie un courriel au contact technique et aux administrateurs quand un compte est verrouillé, mais ne prévoyait pas de notification dans l'application : `grc_notifications` était rattachée à un SMSI et à un objet (colonnes obligatoires). Le RSSI demande une alerte dans l'application pour les administrateurs, en plus du courriel du contact administrateur et du contact technique.

## Décision

1. **Mêmes évènements, mêmes administrateurs actifs.** À chaque alerte émise par l'ADR 0070 (détaillée, ou synthèse horaire une fois le plafond de 10 par heure atteint), chaque administrateur actif (rôle `administrateur`, direct ou par un groupe) reçoit une notification dans l'application. Le courriel du contact technique et des administrateurs est inchangé.
2. **Indépendante du courriel.** Elle est créée même quand le courriel n'est pas configuré : c'est le seul canal visible dans ce cas.
3. **Stockage.** Migration additive `046_alertes_securite_notifications.sql` : `smsi_id` et `object_id` de `grc_notifications` deviennent facultatifs **pour le seul type `alerte_securite`** (contrainte `CHECK` : tout autre type garde ses deux références). Un index unique partiel (`user_id`, `due_key`) garantit une seule alerte par compte destinataire et par évènement (`verrou:<compte>:<fin du verrou>` ou `synthese:<heure>`). Aucune notification existante n'est modifiée.
4. **Hors réglages.** Ce type ne figure pas dans `NOTIFICATION_TYPES` : les réglages par groupe, rôle ou utilisateur (ADR 0058) ne le concernent pas, il ne se désactive pas. Aucun courriel supplémentaire n'est déclenché par ce canal.
5. **Contenu.** Le compte, l'heure, le motif et la fin du verrou ; jamais d'adresse IP ni de code saisi (elle reste au journal d'audit, action `auth.account_locked`).
6. **Lecture.** `GET /api/account/alertes-securite` (alertes non lues du compte connecté) et `PUT /api/account/alertes-securite/:id/read`, réservés au droit `administration:administrer` ; seul le destinataire peut marquer son alerte comme lue. Un bandeau en haut de l'application affiche les alertes non lues aux administrateurs jusqu'à ce qu'elles soient marquées comme lues. Les rappels rattachés à un SMSI (`/api/grc/notifications`) ne les contiennent pas.

## Conséquences

- Une alerte non lue est conservée sans limite ; une alerte lue suit la durée de conservation des rappels lus ([ADR 0048](0048-conservation-sans-purge-automatique.md), réglage « rappels lus »).
- Les évènements du poivre ([ADR 0072](0072-poivre-des-mots-de-passe.md)) et de l'antivirus restent par courriel seul dans cette version.
- Le bandeau interroge le serveur une fois par minute pour les administrateurs.
