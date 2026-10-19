# 022 — Gestion visuelle des droits

Proposition à valider, publiée le 19 octobre 2026. Simulation fonctionnelle, sans connexion au backend ni modification de droits réels.

[Voir les six aperçus](maquettes/v001-acces-visuels/README.md) · [Spécifications préparatoires](implementation/README.md) · [Contrôles effectués](tests/README.md)

Choisir une personne ou un groupe, puis un plan ou registre. Une seule fiche de droits est détaillée à la fois. La chaîne visuelle explique qui reçoit quoi, par quel groupe ou rôle direct. Une fenêtre centrale permet de comparer avant/après et de confirmer un ajustement motivé.

Le rôle **Collaborateur** est distinct du Contributeur existant. Hypothèse en attente de confirmation : consulter, commenter, ajouter une preuve et réaliser ses actions/tâches attribuées ; sans créer d’élément, modifier librement une fiche ou administrer les registres. La réalisation est une opération métier encadrée, pas une permission générale de modification. Les écarts ne disposent pas de l’opération de réalisation d’action/tâche.

La nouvelle vue complète « Administration → Comptes & habilitations », sans ajouter une famille de menu. Elle ne remplace pas tous les outils d’administration : comptes, groupes, rôles système, export et revue des accès restent à intégrer depuis l’existant.

La fonctionnalité reste en développement jusqu’à validation du comportement et des visuels. Après validation et finalisation du dossier technique, déplacer le dossier complet vers « à implémenter ». Ne le classer « implémenté » qu’après lecture d’un marqueur d’implémentation correspondant à la version. Aucun ZIP/BAT produit.
