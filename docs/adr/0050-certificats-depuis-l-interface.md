# ADR 0050 — Certificats TLS : autorité interne, ACME ou certificat fourni, choisis dans l'interface

- Statut : acceptée
- Date : 2026-10-25
- Contexte : décision 3 du 25/10/2026 (« autosigné et ACME ») et exigence « rien à gérer par fichier, tout se configure depuis l'application » ; complète l'[ADR 0018](0018-exploitation-lot-a.md) (remplacement d'un certificat fourni) ; la sortie réseau de l'API reste interdite ([ADR 0014](0014-donnees-sur-le-serveur-et-mises-a-jour.md)).

## Décision

Le mode de certificat se choisit dans Administration, Système, Certificats TLS. Quatre modes, un seul actif :

| Mode | Marqueur `secrets/tls-web/mode` | Ce que reçoit Caddy |
|---|---|---|
| Réglage de départ | `env` (ou absent) | `CADDY_TLS` du `.env`, inchangé |
| Autorité interne du serveur (autosigné) | `interne` | `CADDY_TLS=internal` |
| ACME | `acme` | `CADDY_TLS=<courriel>` et `ACME_CA=<serveur>` (fichier `acme`, deux lignes) |
| Certificat fourni | `web` | le couple PEM de l'ADR 0018 |

- **Gestion web activée par défaut** : `TLS_WEB_MANAGEMENT` vaut 1 sans rien écrire dans `.env`. Mettre 0 l'interdit ; `TLS_TERMINATION=external` reste en lecture seule. Un serveur existant sans marqueur continue d'utiliser `.env` : rien ne change tant que personne ne choisit un mode.
- **Deux nouvelles demandes** (`tls_internal`, `tls_acme`, migration `041_tls_modes.sql`) passent par la file de l'ADR 0018 : confirmation `APPLIQUER`, une seule opération active, journal d'audit. Aucun secret ne circule : le courriel de contact et l'adresse du serveur ACME ne sont pas confidentiels.
- **Validation stricte des deux côtés** : le courriel et l'adresse `https://…` sont contrôlés par un schéma partagé, puis par l'exécutant hôte, puis par le script de démarrage du frontal avant d'être lus. Une valeur douteuse laisse le réglage `.env` en place. Les valeurs ne passent jamais par un interpréteur de commandes.
- **Un seul émetteur ACME** : le frontal déclare l'émetteur explicitement (`cert_issuer acme`), Let's Encrypt par défaut. Caddy n'ajoute donc pas de serveur de secours (ZeroSSL) que l'exploitant n'aurait pas choisi.
- **Application contrôlée, avec retour arrière** : l'exécutant valide la configuration Caddy, recrée le frontal, puis contrôle le certificat réellement servi. En mode interne, seule la racine de l'autorité interne est acceptée ; en mode ACME, seule une chaîne **publiquement fiable** est acceptée (ni la racine interne, ni un certificat fourni), avec un délai de quatre minutes pour l'émission. Un échec rétablit le mode, le couple et le réglage ACME antérieurs, puis vérifie le frontal ; si ce retour échoue, l'opération passe en « intervention requise » comme pour l'ADR 0018.
- **Racine interne téléchargeable** : l'exécutant publie le certificat racine **public** de l'autorité interne (jamais sa clé) dans l'état, et l'interface le propose en téléchargement pour l'installer sur les postes. Le guide n'a plus à demander une commande sur le serveur.

## Ce qui n'est pas fait

- **Aucun test contre un serveur ACME réel** : l'environnement de développement n'a pas d'accès à un serveur ACME. L'enchaînement (écriture du réglage, validation, recréation du frontal, contrôle de chaîne publique, retour arrière) est testé avec un exécutant simulé, et la configuration Caddy est validée sur l'image réelle ; l'émission reste à constater sur un serveur public.
- ACME suppose un nom public et les ports 80 et 443 joignables depuis l'extérieur, ainsi que la sortie du frontal vers le serveur ACME. L'interface le dit ; elle ne le vérifie pas à l'avance.
- Un serveur ACME privé dont la racine n'est pas publique n'est pas pris en charge (il faudrait transmettre sa racine à Caddy et à l'exécutant) ; ni le défi DNS, ni les caractères génériques.
- Aucun bouton ne force un renouvellement : Caddy renouvelle seul.

## Conséquences

- Migration additive `041_tls_modes.sql` (la contrainte sur le type d'opération accepte les deux nouveaux types).
- `.env.example` n'impose plus d'activer la gestion web ; le guide d'installation décrit le choix dans l'application. Le contrôle d'intégration du guide (job « Guide d'installation ») bascule en mode autorité interne depuis l'API et compare la racine exposée à celle de Caddy.
