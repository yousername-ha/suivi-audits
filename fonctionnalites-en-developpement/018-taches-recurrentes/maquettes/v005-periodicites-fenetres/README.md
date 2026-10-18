# 018 — Périodicités et fenêtres de réalisation

**Proposition visuelle v005, à valider.** Livraison d’images uniquement : aucun ZIP ni BAT créé. Les sources HTML/CSS/JS servent à produire et examiner les captures ; elles ne sont pas un module métier intégré. Les versions fonctionnelles précédentes sont conservées.

| Visuel | Image |
| --- | --- |
| Sept types de tâche et états des lignes | [Vue d’ensemble](images/01-periodicites-et-fenetres.png) |
| Choix du type et de la fenêtre | [Paramétrage mensuel](images/02-parametrage-mensuel.png) |
| Occurrence ouverte à la réalisation | [Réalisation](images/03-realisation-fenetre-ouverte.png) |
| Ligne jaune sur le mois, fenêtre du 18 au 31 | [Focus mensuel](images/04-focus-mensuel-jaune.png) |
| Intitulés fixes sur petit écran | [Mobile](images/05-timeline-mobile.png) |

Périodicités représentées : journalier, hebdomadaire, mensuel, bimensuel, trimestriel, semestriel, annuel. Bimensuel est interprété **deux fois par mois**, sous réserve de la réponse utilisateur. Les périodes de démonstration sont calendaires ; le moteur de récurrence métier n’est pas remplacé.

Une fenêtre peut couvrir toute la période, ses N derniers jours, ou des jours précis pour le mensuel. Exemple : 14 derniers jours d’octobre = 18 au 31 inclus. Les intervalles invalides sont refusés dans l’aperçu. Le choix ne persiste pas après rechargement et ne replanifie pas une vraie tâche.

La ligne représente l’état de l’occurrence sur sa période entière : jaune = ouverte et en attente, vert = OK, rouge = KO, gris = NA. Avant ouverture : pointillés neutres. Après la fermeture sans résultat : rouge-orangé et libellé « En retard », distingué de KO. Une bande légère indique la fenêtre de réalisation. Les tâches hebdomadaires/journalières conservent la couleur propre à chaque occurrence ; une réalisation ne recolore pas les périodes voisines.

Le repère est fixé au 18 octobre 2026. Pour les périodes semestrielles et annuelles déjà évaluées, le carré représente le résultat fictif consulté à cette date, pas une nouvelle échéance mensuelle. Les tâches futures restent consultables ; la réalisation tardive nécessite une règle métier encore à préciser. Aucun résultat ni preuve n’est enregistré dans cette livraison visuelle.

Le contrat `SeriesData.recurrence` et le moteur natif restent la référence métier (copie Claude consultée en lecture seule au commit 284cb1e4ffbaee37e0952073db5659c2257c888e). Le choix de fenêtre et le mapping complet des périodicités devront être validés lors de l’intégration ; cette livraison n’ajoute ni endpoint ni schéma serveur. La traçabilité irréversible devra rester garantie côté serveur.

[Contrôles des visuels](technique/verification-visuels.json) : sept types, bornes de fenêtre, couleurs selon état, dialogue ouvert et intitulés fixes sur mobile. Ce contrôle ne constitue pas une recette du module complet.
