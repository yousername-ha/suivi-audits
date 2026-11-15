# Plan d’exécution et critères de recette

**Plan futur, non exécuté pour cette livraison documentaire.** Une capture de maquette ne valide ni le worker, ni la sécurité du journal, ni les gardes de retour.

## 1. Audit avant modification

- Lire les instructions actuelles, contrôler la branche et les changements locaux ; ne pas écraser le travail d’une autre IA.
- Comparer les fichiers réels avec [l’audit daté](03-AUDIT-EXISTANT.md), remplir [la matrice](annexes/MATRICE-COMPATIBILITE.csv), et noter les fonctionnalités plus récentes à préserver.
- Examiner tests, scripts de paquet, CSP, volumes et droits. Ne pas déduire la version déployée de la branche seule.
- Lire l’atlas et ouvrir les scénarios isolés. Les dernières captures de maintenance restent proposées ; vérifier l’existence d’une validation plus récente, sinon présenter les captures fixes et attendre cet accord avant le lot applicatif. Vidéo uniquement après validation explicite des captures.

## 2. Portage de l’habillage autonome, après accord

Conserver le contrôleur réel, raccorder le rendu au statut/phase réels, ajouter SVG/styles locaux consolidés, pause, responsive et notices. Supprimer du portage les fixtures et commandes de démo. Vérifier la santé et le bon job par les tests existants, pas à l’œil. La page est opérationnelle sans bundle React et pendant arrêt API/DB. Ne pas changer le menu, les autres modules ou l’authentification.

## 3. Journal complet, lot distinct mais requis pour le résultat final

Définir le transport privé et son autorisation autonome, instrumenter les sources manquantes, assainir côté serveur et conserver l’historique par job. Tester le collecteur/redactor indépendamment puis le parcours durant arrêt/remplacement de l’API et de l’updater. Raccorder la fenêtre visuelle aux vraies lignes. Un écran avec journal indisponible peut constituer une étape intermédiaire honnête ; il ne satisfait pas à lui seul la demande finale de journal complet.

Toute décision d’architecture/dépendance nouvelle suit les règles actuelles d’ADR du dépôt ; ne pas réserver un numéro arbitraire à partir des documents historiques. Aucun endpoint public improvisé pour atteindre le fichier privé ou le socket Docker.

## 4. Contrôles ciblés à exécuter sur la cible autorisée

Les commandes doivent être relues dans le checkout actuel, avec ses versions et son setup. Elles ne sont pas des résultats de cette livraison. Points d’entrée lus :

| Domaine | Tests ou fichiers de vérification existants |
| --- | --- |
| Worker / exécution / reprise | `python3 scripts/tests/test_updates.py` ; également appelé par `apps/api/test/update-scripts.test.ts` |
| API / permissions / reçus | `apps/api/test/updates.test.ts`, `apps/api/test/journaux-techniques.test.ts` ; le nouveau journal privé exige ses propres tests |
| Parcours navigateur réel | `tests/e2e/specs/zy-updates.spec.ts`, via le runner actuel et un environnement isolé prévu pour la recette |
| Qualité / compilation | Scripts courants `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm build` et tests ciblés des paquets touchés, après lecture des manifests |
| Présentation | Captures réelles des thèmes et tailles PC, préférence de mouvement, pause, clavier, zoom et absence de dépendance externe |

Ne pas lancer les commandes Docker destructives d’un ancien guide, les mises à jour réelles ou la remise à zéro d’une base sur l’environnement de l’utilisateur. Employer une pile de recette avec noms, ports et DATA_DIR isolés, conforme aux instructions actuelles. Aucun secret réel dans les preuves publiques.

## 5. Scénarios d’acceptation

| ID | Vérification attendue |
| --- | --- |
| S01 | Demande juste lancée, état encore ancien : attendre le bon `id`, aucun ancien résultat/log, aucun retour prématuré. Expiration d’attente maîtrisée. |
| S02 | Préparation, sauvegarde, installation, vérification : bonnes animations pilotées par le statut, heures et durées réelles ; aucun pourcentage inventé. |
| S03 | `phase=complete` alors que `status=running` : aucun faux succès ni retour. |
| S04 | Succès, maintenance libérée, santé exacte `ok` : retour selon le comportement existant. HTTP 200 avec un autre corps ne suffit pas. |
| S05 | Échec et rollback : diagnostics visibles, aucune redirection automatique ; retour manuel après santé seulement. `intervention` bloque le retour. |
| S06 | Coupure du polling, délai >10 minutes, statut ancien/invalide : conserver dernier état fiable, avis de connexion/lenteur, aucune réussite déduite du temps. Reprise réelle. |
| S07 | `next` externe, `//`, encodages et antislashs : destination toujours same-origin et hors `/update`, aucune boucle. |
| S08 | Visiteur non connecté / lecteur : aucun détail privé, aucune commande admin ; les droits de lancement, MFA, CSRF et confirmation existants restent vérifiés. |
| L01 | Événements worker, script et sorties instrumentées présents avec source, heure, ordre et bon job ; sources indisponibles signalées, aucune ligne fictive. |
| L02 | API et DB arrêtées : suivi public et transport privé autorisé restent fonctionnels ; un visiteur public ne peut lire le journal. |
| L03 | Secrets sentinelles structurés, URL, paramètres, guillemets, échappements/encodages, PEM multilignes et coupures de chunks : absents des réponses, DOM, stockage affichable et exports. Masquer avant la première émission. |
| L04 | Révocation/expiration, autre job/compte, traversée de chemin, curseur malformé : refus sûr ; pas de privilège sur Docker/répertoire de reprise. |
| L05 | Reconnexion, rotation, rafale de logs, remplacement updater : reprise sans duplication ni mélange, trou annoncé, consommation mémoire bornée ; historique assaini conservé. |
| L06 | Error/fatal rouges, heure comprise ; stderr normal, « no error » et « 0 errors » non classés arbitrairement. Codes de sortie fiables pris en compte sans recolorer tout l’historique. |
| L07 | Texte contenant balises HTML, scripts, ANSI/OSC et retours de curseur : affichage texte sûr, aucune exécution ni lien terminal actif. |
| V01 | Journal libre directement à droite, sans sous-dalle/titre/compteur ; nouvelles entrées remontantes, fondu spatial en haut ; erreurs encore lisibles quand elles sont nouvelles. |
| V02 | Pause et reduced-motion : effets figés, données toujours actualisées. Pas de clignotement agressif ou boucle de faux logs. |
| V03 | PC portable/grand écran/faible hauteur/zoom : informations et actions accessibles, pas de scale global, pas de texte tronqué ni de colonnes minuscules. Contraste à mesurer sur la cible. |
| V04 | Assets auto-hébergés et CSP conservée ; aucun CDN ni erreur navigateur. Noyau et icônes nets en SVG. |

## 6. Livrer après intégration et contrôles

Fournir les captures de l’application intégrée, le commit testé, commandes et résultats, limitations et matrice mise à jour. Conserver le résumé IA dans la reprise. Les résultats historiques des maquettes ne remplacent pas ces contrôles. Respecter la CI/PR actuelle sans fusion, release ni déploiement implicite. Ne pas mettre à jour des snapshots automatiquement pour rendre un échec vert.

## Vérifier uniquement ce dossier maintenant

```sh
python3 docs/transmission-opus-5.5/maintenance-neon/outils/verifier_dossier.py
python3 docs/transmission-opus-5.5/outils/verifier_dossier.py
```

Ces commandes contrôlent les fichiers documentaires, pas l’application. Pour ouvrir la maquette, suivre [son mode d’emploi](maquette/README.md).
