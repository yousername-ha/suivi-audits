# Dépannage

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

Commencer dans le dossier applicatif, relever version/branche, contexte et
message ; consulter logs en privé. Préserver .env/DATA_DIR et travail Git.

| Symptôme                         | Vérification en lecture                                  | Cause démontrée ou piste                                                  | Action prévue                                                                                            |
| -------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Pilotage ne s’ouvre pas au clic  | Version/image réelle et accès direct /pilotage           | BUG-001 corrigé dans cc285b4 ; ancienne image possible, pas supposée      | TEST-041 puis mise à niveau autorisée ; droits/modules si refus serveur.                                 |
| Exécutant serveur indisponible   | docker compose ps -a ; état updater et EXPLOITATION_AUTO | Worker/heartbeat absent ; ancienne installation sans intégration possible | Lire logs privés ; bootstrap ancien updater via INSTALLATION 12.0, garder clés.                          |
| Sauvegarde en attente            | Catalogue/heartbeat/locks en état Système                | Worker indisponible ou opération exclusive active                         | Attendre/diagnostiquer ; ne pas déclarer succès ni lancer plusieurs opérations.                          |
| find échoue pendant mise à jour  | Version updater et log privé                             | BUG-003 ancienne image sans GNU find                                      | Premier redéploiement de l’image corrigée, pas désactivation de rotation.                                |
| Mise à jour absente              | Version numérique, accès Git/GHCR et trois artefacts     | Déjà 3.0.2, accès expiré ou publication partielle                         | Vérifier résultat du contrôle ; aucune fausse version nouvelle.                                          |
| Maintenance longue/échouée       | /update/, status minimal, état Docker et receipts privés | Santé/rollback/reprise à déterminer                                       | Maintenir protection ; analyser avant toute restauration autorisée.                                      |
| Lecture seule ou menu absent     | Droits effectifs, activation et périmètre                | Comportement normal si permission absente                                 | Ajustement autorisé par admin ; ne pas contourner le serveur.                                            |
| Conflit 412/428                  | Version de la fiche et requête If-Match                  | Fiche changée ou version manquante                                        | Recharger explicitement ; conserver le brouillon.                                                        |
| Import refusé                    | Rapport de simulation, hash/version/type                 | Fichier différent, format invalide, droits ou écriture concurrente        | Refaire simulation, corriger fichier fictif ; pas de force aveugle.                                      |
| Document illisible après reprise | Version/clé/environnement                                | Clé manquante ou archive/configuration incohérente : hypothèse            | Vérification privée et procédure restore autorisée ; ne pas générer une nouvelle clé pour lire l’ancien. |
| Tests API dangereux              | global-setup.ts et TEST_PG_*                             | Cleanup de bases temporaires dans le setup                                | Isoler la base ; ne pas exécuter sur serveur partagé/production.                                         |

Commandes de lecture :

```bash
git status --short --branch
sudo docker compose ps -a
sudo docker compose logs --tail=100 app web gateway updater
```

Les journaux partagés doivent être expurgés. Ne pas joindre .env, clefs,
documents réels ou traces Playwright brutes. Voir INSTALLATION, section 13, pour les
cas d’installation ; aucun diagnostic à distance du serveur client n’est
confirmé par la seule existence d’une hypothèse dans cette table.
