# ADR 0053 — Clôture d'un écart avec des liens ouverts : refus, sauf motif écrit tracé

- Statut : acceptée
- Date : 2026-10-25
- Contexte : décision 7 du 25/10/2026 (dossiers 017-07 et 021-07) ; la clôture d'un écart est une décision immuable ([ADR 0027](0027-gestion-des-risques-ebios-et-iso27005.md)).

## Décision

- **La garde reste serveur.** Clôturer un écart (opération `close`) est refusé tant qu'un lien est ouvert : une action liée dont le statut n'est pas terminal dans la politique du périmètre, ou une tâche de la fiche non faite. Le refus dit ce qui reste ouvert (« Des liens restent ouverts (N action(s) liée(s) non terminée(s), M tâche(s) à faire) »).
- **Dérogation par motif écrit.** La demande de décision accepte un champ `openLinksReason` (15 caractères au moins). Avec ce motif, la clôture est prononcée malgré les liens ouverts. Le motif est conservé trois fois : dans la **décision** (immuable : motif, actions encore ouvertes avec leur nom, nombre de tâches), sur la **fiche** (`closureOpenLinksReason`, lisible dans l'écart et son historique de versions) et au **journal d'audit** (indicateur `closedWithOpenLinks`).
- **La clôture ne termine rien.** Les actions et tâches ouvertes restent ouvertes et suivies, sans effet sur leur statut. La réouverture du constat efface le motif de la fiche ; la décision d'origine reste au journal.
- **Pas de contournement.** Le champ de la fiche n'est pas modifiable à la main (comme la date et la note de clôture) ; seul le motif passé avec la décision l'écrit. Les autres garde-fous de clôture (causes analysées, efficacité vérifiée et tracée) ne sont pas dérogeables.
- **Interface.** La fenêtre de décision tente d'abord la clôture ; si le serveur refuse pour des liens ouverts, un champ « Motif écrit de la clôture malgré les liens ouverts » apparaît et la confirmation reste bloquée tant que le motif a moins de 15 caractères.

## Ce qui n'est pas fait

- « Lien ouvert » couvre les actions liées et les tâches de la fiche. Les liens vers d'autres écarts, des risques ou des plans ne bloquent pas la clôture.
- Pas de droit distinct pour déroger : la décision de clôture suit les droits existants du module.
- Pas de rappel automatique sur les actions encore ouvertes après une clôture dérogatoire : elles restent dans le plan d'actions comme toute action en cours.

## Conséquences

Aucune migration (le motif vit dans la fiche et dans les termes de la décision, déjà en JSON). Un champ s'ajoute à la requête de décision et à la fiche d'écart.
