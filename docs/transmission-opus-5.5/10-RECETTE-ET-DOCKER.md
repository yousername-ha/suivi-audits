# Recette et Docker de la version cible

## Séparer trois niveaux de preuve

1. **Maquette/aperçu** : peut valider un visuel et un comportement local, ne prouve pas une intégration ou un serveur.
2. **Frontend compilé et API interceptée** : vérifie UI, états, accessibilité et contrats simulés, ne prouve pas DB/Mistral/gardes serveur.
3. **Application portée avec API/DB réelles en environnement de recette autorisé** : nécessaire pour confirmer les fonctions réelles et leurs protections.

Les documents historiques conservent le niveau réellement exécuté pour chaque lot. Les deux images finales Dashboard/menu sont du niveau 1 composé avec un frontend existant de niveau 2. Les chiffres de tests anciens sont datés et ne constituent pas la recette de la nouvelle cible.

## Avant les tests

Lire scripts, versions et setup de la cible. Utiliser ses commandes, son lockfile et ses outils actuels ; le snapshot indiquait Node ≥26/pnpm 10.34.6, mais cela ne justifie pas un changement de pile dans une cible plus récente. Ne pas installer les dépendances dans le dossier de référence comme s’il s’agissait du projet exécutable.

Vérifications attendues, selon les scripts présents : format/lint et contrôle des tokens, TypeScript, tests UI/web pertinents, build frontend, E2E des fonctions concernées. Élargir aux checks obligatoires du dépôt avant PR ; ne jamais réduire une assertion ou approuver automatiquement un nouveau snapshot pour masquer une régression. Toute référence visuelle mise à jour doit être relue.

## Matrice de recette pratique

| Axe            | Cas minimum                                                                                                                        |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Deux thèmes    | Menu final identique, contenu clair/sombre, sélection et survol lisibles                                                           |
| Droits         | Administrateur, lecteur, permissions partielles ; commandes d’écriture et données non lisibles protégées                           |
| Fiches         | Lecture/édition distinctes, erreurs et annulation, contenu long, champs complets, titre et actions accessibles                     |
| Lignes         | Clic sur fond, Entrée/Espace, sélection de texte, bouton/input/lien imbriqué, retour du focus                                      |
| Registres      | Recherche et tous les filtres réels, indicateurs de filtre actif, reset, pagination et total serveur                               |
| Graphes        | Polices chargées, resize, dimensions réelles, textes longs, pas de liaison dans les cartes, aucun lien métier inventé              |
| Dates          | Jour/semaine ISO/mois/année, bissextile, horizon, dates absentes ou incohérentes, aucune occurrence générée par le rendu           |
| Validations    | OK/KO/NA selon contrat, preuve/commentaire, erreur, réouverture motivée, historique/version préservés                              |
| Animations     | Réglage normal, pause/reprise, réduction système ; aucune position de texte instable                                               |
| PC             | 1024×768 à 2560×1440, fenêtre basse et zoom 150 %, listes/fiches longues et commandes accessibles                                  |
| Assistant      | Conversation persistante, profils/brouillons, contexte figé, quota/pause distincts, sources/destinataire, erreurs et confirmations |
| API réelle     | CSRF/session/périmètre/droits/If-Match, filtrage des événements et garde des mutations selon les tests actuels                     |
| Non-régression | Dispositions personnelles, imports/exports, historiques, cartographie et génération automatique, graphe RETEX                      |

Les composants d’accessibilité doivent être testés au clavier ; Axe sans violation ne suffit pas à lui seul.

## Docker : ne pas reprendre une recette ancienne sans diagnostic

Identifier le projet, les services et les fichiers Compose de la cible avant toute commande. La référence a connu plusieurs profils (`docker-compose.dev.yml`, `docker-compose.ui-test.yml`, profil compilé). Certains utilisent Vite et un montage de sources ; d’autres servent du frontend compilé. Le mode détermine le besoin de rebuild/redémarrage et les ports. `stop web api` sans relancer `web` explique une interface sans écoute ; vérifier les services et ports actuels, pas seulement des logs historiques.

Le profil ancien « sans connexion » était un Docker de test d’interfaces avec données fictives et session locale isolée. **Ne pas porter ce mécanisme dans le Compose normal ou en production.** Authentification, MFA, CSRF et gardes du service courant restent intacts.

Tests DB/restauration/migration/charge uniquement dans l’environnement isolé prévu et autorisé. Ne pas toucher aux volumes de l’application existante pour réinitialiser une démo. Aucun `down -v`, suppression de dossier de données ou nouveau jeu fictif dans la base actuelle au titre de la refonte. Lire les instructions actuelles du dépôt avant d’utiliser ses outils de recette.

Après portage, prouver que le service web écoute, que les services requis sont sains, et que le navigateur charge le bundle correspondant à la version testée ; vérifier cache/ancien bundle si le résultat ne correspond pas. Fournir ensuite les visuels de l’application réelle en précisant la version et l’environnement, puis suivre les accords de publication/déploiement du dépôt cible.

Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).
