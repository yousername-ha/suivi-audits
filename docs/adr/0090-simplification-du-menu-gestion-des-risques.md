# ADR 0090 — Simplification du menu Gestion des risques : quatre pages retirées, plan d'action dans le Registre

- Statut : acceptée (décision du RSSI du 12/11/2026 ; numéro annoncé et accepté dans la session)
- Date : 2026-11-12
- Rédaction : session « Projet audit_suivi Coeur » (`session_01ES6jrfuR1tD6Az1XDgAnS3`)
- Même logique que l'[ADR 0089](0089-simplification-du-menu-conformite.md) ; programme en **deux lots**, chacun dans sa PR.

## Contexte

Le menu « Gestion des risques » comptait sept pages. Le RSSI garde le **Registre des risques**, les **Études EBIOS RM**
(« le cœur de notre gestion de risque ») et la **Cartographie des risques**, et retire :

- **Opportunités** : ne sert plus ;
- **Traitements** : remplacé par un **plan d'action rattaché à chaque risque**, dans le Registre ;
- **Scénarios et actifs** : les scénarios vivent dans EBIOS RM, avec le risque attaché ;
- **Configuration des analyses** : déjà présente dans la configuration de la plateforme (Paramètres → Configuration GRC).

## Décision

**Lot 1 (interface, cette PR)**
- Les quatre pages disparaissent du menu, des rubriques et des routes. Le menu garde Registre, Études EBIOS RM et Cartographie.
- **Registre des risques** : chaque ligne a un bouton « Plan d'action » qui ouvre le plan de traitement du risque :
  traitements et mesures en place qui l'atténuent, actions rattachées, « Générer une action » depuis un traitement (plan d'actions
  d'accueil au choix), « Ajouter un traitement ou une mesure » (la fiche s'ouvre déjà rattachée au risque). Ce sont les fiches
  « traitement » et « action » existantes, reliées par le lien « Traite » : aucune donnée nouvelle, aucun changement d'API. Le
  risque résiduel reste celui de la dernière appréciation validée.
- **Configuration des analyses** : le même écran reste dans Paramètres → Configuration GRC (un seul stockage, une seule API) ; la
  variante « analyses » de l'écran disparaît.
- Parcours ISO : trois renvois qui pointaient vers des rubriques retirées sont redirigés (Registre, Bibliothèque, Configuration
  GRC) ; un test vérifie désormais que chaque étape du parcours mène à une rubrique qui existe.
- Tests de navigation et de bout en bout adaptés (l'action de traitement se génère depuis le plan d'action du risque).

**Lot 2 (fait)** : retrait des fiches « opportunité » du serveur (décision du RSSI du 12/11/2026).
- Type de fiche `opportunity` retiré du schéma partagé (types, droits, libellés, champs du formulaire) : l'API refuse d'en créer ;
  le bilan préparatoire de la revue de direction ne compte plus d'opportunités (les constats de type « observation ou
  opportunité » du registre des écarts, qui sont une nature d'écart, restent) ; le jeu de données de démonstration n'en crée plus.
- **Conservés** : les fiches « traitement » (le plan d'action du Registre s'appuie dessus) et les éléments EBIOS RM (valeurs
  métier, biens supports, sources de risque, événements redoutés, scénarios stratégiques et opérationnels), qui vivent dans les
  études.
- **Pas de migration** : les fiches « opportunité » déjà saisies vivent dans l'historique immuable des objets, qu'on ne contourne
  pas ; l'application n'étant pas encore en production, elles restent inertes jusqu'à la réinstallation.

## Ce qui n'est pas fait

- Pas de suppression de donnée ni de route dans le lot 1 (le lot 2 retire le code ; aucune donnée n'est effacée).
- Pas de colonne « Actions » (nombre, retard) dans le tableau du Registre : elle demanderait une évolution de l'API.

## Conséquences

Un menu plus court, un parcours du risque à l'action sans changer de page. Les anciens signets vers les pages retirées
n'aboutissent plus.
