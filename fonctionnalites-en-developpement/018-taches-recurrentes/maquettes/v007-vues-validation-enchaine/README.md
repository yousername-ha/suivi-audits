# 018 — Timeline, kanban et réalisation en chaîne

**Proposition visuelle v007 à valider — livraison du 19 octobre 2026.** Le principe des trois vues et de l’enchaînement a été confirmé par l’utilisateur. Les captures restent à examiner. Aucun ZIP ni BAT créé ; les versions précédentes sont conservées.

| Vue | Aperçu |
| --- | --- |
| Vacances et jours fériés visibles derrière les tâches | [01 — Timeline avec calendriers](images/01-timeline-calendriers-superposes.png) |
| Mêmes tâches avec les calendriers masqués | [02 — Timeline sans superpositions](images/02-timeline-calendriers-masques.png) |
| Cartes réparties par état | [03 — Kanban](images/03-vue-kanban.png) |
| Liste à gauche, détail et réalisation à droite | [04 — Avant validation](images/04-liste-detail-avant-validation.png) |
| Coche OK conservée, tâche suivante sélectionnée | [05 — Enchaînement automatique](images/05-validation-ok-tache-suivante.png) |
| Résultat KO enregistré et consultable | [06 — Lecture seule](images/06-resultat-ko-lecture-seule.png) |
| Liste et détail adaptés au téléphone | [07 — Mobile](images/07-liste-mobile.png) |

## Comportements illustrés

Deux interrupteurs distincts affichent ou masquent les vacances et les jours fériés. Ils ne modifient ni les exclusions, ni les fenêtres, ni les résultats. Les fonds se superposent derrière les lignes et les carrés opaques ; les intitulés restent fixes pendant le défilement horizontal.

Le kanban partage les mêmes occurrences et résultats que les autres vues : À réaliser, À venir, À arbitrer, Réalisées. La colonne Réalisées distingue OK, KO et NA ; KO n’est pas présenté comme une réussite. Une carte ouvre son détail dans la vue liste. Aucun glisser-déposer ne contourne la validation.

La liste reste à gauche, le détail est intégré à la page à droite. Les boutons OK / KO / NA restent visibles en bas du détail. Après enregistrement réussi, la ligne garde son symbole et son libellé. Si l’option d’enchaînement est activée, la prochaine occurrence ouverte dans la liste filtrée est sélectionnée ; les futures, bloquées et validées sont sautées. L’ordre reste stable, sans réorganisation des tâches à chaque clic. En fin de liste, un message l’indique ; aucun retour silencieux au début ni passage à un autre registre.

L’enchaînement peut être désactivé. Une preuve requise manquante ou une erreur d’enregistrement conserve la sélection et la saisie. Durant l’enregistrement simulé, les commandes de validation et de navigation sont désactivées. Un brouillon reste associé à sa tâche si l’utilisateur consulte une autre ligne. Les résultats confirmés sont consultables sans commande d’édition ou suppression.

## Limites explicites

Ces sources servent à produire les visuels et simuler les interactions **en mémoire**. Recharger réinitialise la simulation. L’auteur est fictif ; l’heure des validations simulées vient de l’horloge du navigateur, distincte de la date de démonstration fixée au 12 novembre. Aucun backend n’est raccordé, aucun fichier n’est déposé et aucune immutabilité serveur n’est démontrée. La sélection de preuves contient seulement des exemples textuels ; la liaison documentaire réelle reste à intégrer.

La preuve est requise pour la première tâche uniquement pour illustrer le blocage : cela ne fixe pas une politique métier générale. Les états et fenêtres sont des fixtures visuelles ; ils ne remplacent pas le moteur de calcul de récurrence ou d’exclusions.

La période de calendrier affichée va du 26 octobre au 15 novembre 2026. Les vacances de la Toussaint reposent sur l’événement examiné dans la [v006](../v006-recurrence-calendriers-ical/README.md), fin iCal au 2 novembre exclusive. Les repères du 1er et du 11 novembre sont des données illustratives de jours fériés, pas la preuve d’un import activé. La source de jours fériés de production reste à fournir/configurer. Aucun calendrier n’a été activé.

## Intégration future

Réutiliser les séries, occurrences, droits et preuves canoniques du socle métier. Le contrat de validation OK/KO/NA et la trace immuable restent à confirmer comme indiqué dans les versions précédentes. Le serveur doit valider l’ouverture réelle, les droits et la politique documentaire, attribuer auteur/horodatage et garantir unicité/idempotence. L’UI ne passe à la suivante qu’après réponse de succès ; elle ne valide jamais la suivante automatiquement.

Les préférences d’affichage des calendriers sont séparées de la politique d’exclusion. Conserver un modèle commun d’occurrences pour les trois vues et un résultat distinct de l’état de planification. Le filtre de registre n’est pas une autorisation. Les refus, conflits, mises à jour concurrentes et preuves indisponibles conservent le formulaire et n’avancent pas la file.

[Huit contrôles exécutés et limites](technique/verification-visuels.json) · [Script de capture](technique/capture.cjs). Vérifiés : interrupteurs indépendants, modèle partagé, preuve requise, passage automatique, désactivation, KO en lecture seule, erreur sans avancement, fin de liste filtrée, mobile sans débordement et boutons de réalisation visibles. Ces contrôles sont ceux d’une simulation locale, pas ceux du backend.
