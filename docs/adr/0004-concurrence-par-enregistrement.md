# ADR 0004 — Concurrence optimiste par enregistrement

**Statut** : acceptée (phase 0)

## Contexte
L'outil historique enregistre tout l'état en un seul document : deux personnes qui modifient deux écarts différents entrent en conflit.

## Décision
- Chaque table métier porte une colonne `version`, incrémentée à chaque modification.
- La lecture d'un enregistrement renvoie `ETag: "<version>"`. Une modification (`PATCH`) exige `If-Match`, sinon elle est refusée en **428**.
- La réponse **412** n'est renvoyée **que si cet enregistrement** a changé. Elle contient sa version courante (`current`) et l'auteur de la modification, pour que l'interface propose de recharger.
- Deux utilisateurs qui modifient deux enregistrements différents ne sont jamais en conflit.

## Conséquences
- L'interface conserve la version lue et la renvoie à l'enregistrement. Le temps réel (ADR 0005) prévient dès qu'un autre utilisateur modifie l'élément ouvert.
- L'état legacy (`app_state`) garde son contrôle global (`If-Match: "vN"`) jusqu'à la reprise de chaque module.
