# Sécurité et contrôles vérifiés

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

Modèle effectivement implémenté : auth.ts, rights.ts, http/route.ts,
http/security.ts, security/crypto.ts, routes et services métier.

| Contrôle              | Implémentation                                                                                      | Preuve / limite                                                                                                                                                           |
| --------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mot de passe          | scrypt N=2^16, sel ; politique configurable                                                         | security.test.ts dans CI ; pas de mot de passe par défaut.                                                                                                                |
| TOTP                  | Obligatoire, anti-rejeu, étapes de session                                                          | API et parcours MFA ; pas de secret TOTP dans les preuves.                                                                                                                |
| Session               | Token aléatoire empreinté, rotation MFA, expiration, cookie __Host- Secure/HttpOnly/Strict en HTTPS | security.test.ts ; exception locale dev documentée.                                                                                                                       |
| Autorisations         | Module × action, rôles/groupes, relecture serveur et périmètres GRC                                 | rbac.test.ts, grc-security.test.ts ; nom d’un rôle personnalisé ne donne pas un privilège système.                                                                        |
| CSRF/origine/débit    | Point d’entrée route(), contrôle pré-lecture, limites dédiées                                       | security.test.ts ; pas de garde UI seule.                                                                                                                                 |
| Secrets/documents     | Secrets générés si absents, AES-256-GCM des documents, clé hors API backup                          | tests documents/exploitation ; stockage réel client non inspecté.                                                                                                         |
| Historique/audit      | Audit append-only ; décisions/publications immuables, idempotence                                   | tests GRC/Pilotage, contraintes SQL et transactions.                                                                                                                      |
| Export                | Permissions serveur, données filtrées, formules CSV neutralisées                                    | Tests rbac et rapports ; pas d’export global inter-périmètre.                                                                                                             |
| Temps réel/cache      | Événements sans payload métier, filtrage/purge aux changements de droits                            | Tests realtime/modules/logout.                                                                                                                                            |
| Dépendances/livraison | Trivy HIGH/CRITICAL, SBOM, CodeQL, signatures et garde du commit exact                              | [CI](https://github.com/yousername-ha/suivi-audits/actions/runs/38087692231) et [CodeQL](https://github.com/yousername-ha/suivi-audits/actions/runs/38087692214) réussis. |

## Registre de risques de sécurité

| ID      | Risque                                                 | Niveau de preuve | Contrôles / reste à faire                                                                                                                                                                                          |
| ------- | ------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SEC-001 | CSP legacy avec unsafe-inline                          | CONFIRMÉ         | Source locale, session et droits ; CSP stricte de React conservée. Maintenir isolation et tests ; retrait seulement après reprise complète.                                                                        |
| SEC-002 | Updater root et socket Docker                          | CONFIRMÉ         | API sans socket ni shell ; tâches fixes, confirmations, signatures et états publics minimaux. Revue périodique des montages, accès Git/GHCR et exposition hôte.                                                    |
| SEC-003 | Secrets possibles dans traces de recette               | CONFIRMÉ         | Artefact Playwright seulement en échec, logs masqués, dépôt privé ; ancien nettoyage déclaré dans l’historique. Revue avant partage/publication ; les traces anciennes nettoyées ne prouvent pas l’absence future. |
| SEC-004 | Vérification exhaustive des surfaces GitHub incomplète | NON VÉRIFIÉ      | Dépôt privé vérifié ; CI/CodeQL/Trivy réussis au commit analysé. Audit dédié avec permissions et inventaire complets avant une ouverture publique.                                                                 |
| SEC-005 | Configuration de développement moins protégée          | CONFIRMÉ         | Projet dev séparé, port interface lié à 127.0.0.1 ; configuration production différente. Ne pas exposer la pile dev ; vérifier configuration et isolation avant essais.                                            |
| SEC-006 | Clés de chiffrement et reprise hors serveur            | NON VÉRIFIÉ      | Chiffrement et modes privés implémentés ; pas de valeurs de secret documentées. Recette externe de sauvegarde et garde des clés du serveur réel, autorisée et tracée.                                              |

Ce sont 6 risques/limites à surveiller, pas 6 CVE
exploitables confirmées. Les trois alertes HIGH historiques ont un correctif
tracé (69e6782), et les scans actuels passent ; aucune absence universelle de
vulnérabilité ou de secret n’est certifiée.

L’ancien audit de confidentialité a signalé des traces de recette sensibles et
un nettoyage autorisé ; ses rapports bruts privés ne sont pas ajoutés au dépôt.
Les couches GHCR, paramètres Secrets GitHub et surfaces natives non accessibles
ne sont pas entièrement contrôlés ici. Ne pas rendre public sur la base de cette
mission documentaire. Dépôt privé conservé ; identités d’auteurs conservées sans
reproduction d’adresses personnelles dans les nouveaux documents.
