# ADR 0068 — Suppressions réservées au droit « supprimer »

- Statut : acceptée
- Date : 2026-10-28
- Contexte : revue de sécurité du contrôle d'accès (OWASP ASVS 4.0 niveau 2 ; ISO 27001:2022 A.5.15). L'[ADR 0010](0010-droits-rbac.md) prévoit qu'un Contributeur « ne peut plus supprimer ». Plusieurs routes de suppression des modules repris de l'outil de suivi n'exigeaient que le droit `modifier`.

## Décision

1. **Règle.** Toute suppression d'un enregistrement exige le droit `<module>:supprimer`, y compris pour les sous-éléments édités dans une fiche (points d'un GAP, jours, créneaux et personnes du plan d'audit, échéances et contacts de crise, actions de scénario, mesures d'un indicateur).
2. **Routes.** Les routes `DELETE` du plan d'actions, du plan d'audit, du GAP, des investissements, du CRRC (établissements, ressources, sauvegardes, offres), des incidents, de la cellule de crise et des évaluations du clausier exigent `supprimer` sur leur module.
3. **Pilotage.** La suppression d'un processus, d'un objectif (qui emporte ses indicateurs), d'un indicateur et d'une mesure exige `supprimer` dans le service, sur le chemin de suppression seulement ; les autres écritures gardent `modifier`.
4. **Service.** La modification sous verrou de l'état historique accepte un droit à exiger (`modifier` par défaut, `supprimer` pour une suppression), pour que la garde du service reste alignée sur celle de la route.
5. **Interface.** Les boutons de suppression ne s'affichent que si la personne a le droit `supprimer` du module. Le serveur reste seul juge.

## Conséquences

- Aucune migration. Le Contributeur prédéfini (`lire` et `modifier`) ne supprime plus ces enregistrements ; le RSSI et l'Administrateur, oui. Pour garder cette capacité à un profil, lui attribuer un rôle personnalisé qui porte `supprimer` sur les modules voulus.
- Les suppressions faites par les rôles qui ont déjà `supprimer` ne changent pas.
- Un test parcourt chaque route de suppression concernée : refus pour un Contributeur, passage de la garde pour un compte qui peut supprimer.
