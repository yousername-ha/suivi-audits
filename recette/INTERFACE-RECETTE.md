# Recette rôles, présentation et compte de test — 11 octobre 2026

Évolution depuis `f0e34bdc`, exclusivement sur `legacy/test-lots-d-f`.
Toutes les recettes utilisent des comptes et des données FICTIVES,
des bases SQLite temporaires et des profils Chromium isolés.

| Contrôle exécuté | Résultat |
|---|---:|
| Tests unitaires historiques, risques et cartographies | 53 passés |
| Serveur : historique, risques, cartographies et interface | 30 passés |
| Navigateur : risques et administration | 18 passés |
| Navigateur : périmètres, parcours, CaRE et PCRA | 17 passés |
| Navigateur : dossier auditeur et fonctions historiques | 22 passés |
| Navigateur : canevas SVG et navigation | 12 passés |
| Navigateur : compte demandé, accents, cartes et V2 | 8 passés |
| **Total** | **160 passés, 0 échec final** |

Le scénario historique `file://` reste non exécuté : ce protocole est bloqué
dans le Chromium du workspace. L’application principale est testée sur localhost.
Le dossier auditeur autonome a été exécuté séparément.

## Vérifications de la demande

- Le démarrage normal provisionne admin/admin, connexion vérifiée avec le
  formulaire et les API, autorisations serveur et nonce de session conservés.
- Un compte `admin` existant n’est jamais réinitialisé, réactivé ou promu.
  Changer son mot de passe supprime l’indication du compte de test ; le nouveau
  mot de passe reste valable après redémarrage. La création normale de comptes
  continue à refuser les mots de passe de moins de 12 caractères.
- Les lectures UTF-8 restent correctes avec un encodage par défaut Windows
  simulé. Ce contrôle est exécuté sous Linux ; aucune session Windows native
  n’est présentée comme réalisée.
- Une base comportant les libellés de base corrompus en CP1252 est réparée
  au redémarrage, une seule fois, avec une entrée de journal et une nouvelle
  version de l’état. Les titulaires, identifiants, périmètres, contacts,
  responsabilités personnalisées et historiques d’évaluation restent inchangés.
- Rôles et responsabilités est accessible dans Pilotage et y reste après
  rechargement. Le registre partagé n’est ni déplacé physiquement ni dupliqué.
- Les cartes et boutons sont mesurés dans le navigateur : hauteurs et boutons
  alignés par rangée, même avec une responsabilité longue. Police Sauge,
  responsive à 390 pixels, thèmes clair/sombre et absence de débordement vérifiés.
- Cartographies ouvre la Vue d’ensemble issue de la V2. Les lectures de la
  légende et l’ouverture réelle d’une fiche de mesure sont vérifiées.
  Contexte/processus issus de la référence GPT6 et risques consolidés restent
  fonctionnels, avec leurs exports, droits et historiques.

Les captures ont été inspectées visuellement. Elles restent hors Git, ainsi que
les bases et profils de recette. Aucune requête réseau externe ni erreur JavaScript
n’a été relevée dans les recettes navigateur finales.

## Conservation et livraison

Les 592 fichiers suivis du dépôt source ont les mêmes empreintes. Les références
distantes de `main` et `feature/gpt6-evolution-smsi-grc` sont lues avant publication ;
la seule destination d’écriture est `legacy/test-lots-d-f`.
Le scan Gitleaks des fichiers ne détecte aucun secret. Le mot de passe public
admin/admin est l’exception de recette explicitement demandée ; aucun mot de
passe utilisateur, cookie ou fichier SQLite n’est publié.

Résultats : `interface-verification.json`, `interface-unit-resultats.txt`,
`interface-serveur-resultats.txt`, `interface-browser-resultats.json` et recettes
navigateur des risques, de la refonte, des cartographies et de la régression.
Aucune CI GitHub, PR ou fusion vers l’application principale n’est effectuée.
