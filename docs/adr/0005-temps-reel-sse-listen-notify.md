# ADR 0005 — Temps réel : SSE alimenté par LISTEN/NOTIFY

**Statut** : acceptée (phase 0)

## Contexte
Les utilisateurs doivent voir les modifications des autres sans recharger, et savoir qui consulte ou modifie quoi.

## Décision
- Des **déclencheurs PostgreSQL** (`suivi_notify`) publient sur le canal `suivi_events` : entité, identifiant, version, opération et auteur. L'auteur provient de `set_config('suivi.actor', …)` dans la transaction. Toute écriture, y compris par la ligne de commande, est donc diffusée.
- L'API écoute ce canal sur une connexion dédiée, reconnectée automatiquement, et le relaie en **Server-Sent Events** sur `/api/events`.
- Le flux est filtré selon le rôle : les comptes, les sessions et les imports ne vont qu'aux administrateurs. Il ne contient **jamais de donnée métier** : le client recharge ce qu'il a le droit de lire.
- La session est revalidée toutes les 60 s ; une session fermée coupe le flux.
- SSE plutôt que WebSocket : sens unique suffisant, reconnexion native du navigateur, passage simple par Caddy (`flush_interval -1`, pas de compression du flux), et même contrôle de cookie que le reste de l'API.
- La présence (`POST /api/presence`, renouvelée toutes les 20 s, expirée après 45 s) transite elle aussi par PostgreSQL (`suivi_presence`) : plusieurs instances d'API restent cohérentes.

## Conséquences
- Côté interface, chaque événement invalide le cache TanStack Query de l'entité concernée. Après une reconnexion, tout est rechargé.
- L'ancienne interface (`/legacy`) prévient elle aussi quand un autre utilisateur enregistre.
