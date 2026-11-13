# ADR 0091 — Simplification du menu Résilience (Incidents et crise) : RETEX et qualification dans la fiche de l'incident

- Statut : acceptée (décision du RSSI du 12/11/2026)
- Date : 2026-11-12
- Rédaction : session « Projet audit_suivi Coeur » (`session_01ES6jrfuR1tD6Az1XDgAnS3`)
- Même logique que les [ADR 0089](0089-simplification-du-menu-conformite.md) et [0090](0090-simplification-du-menu-gestion-des-risques.md) :
  moins de pages, le travail se fait dans l'objet.

## Contexte

La destination « Incidents et crise » du menu Résilience comptait six pages : Registre des incidents, **Qualifier un signalement**,
**RETEX et chronologie**, Cellule de crise, Contacts de crise, Scénarios et check-lists. Un même incident se retrouvait réparti sur trois
pages (la fiche du registre, le questionnaire de qualification, la page RETEX), avec des allers-retours par l'adresse de la page et un
questionnaire qui ne servait qu'à la création de la fiche : ses réponses n'étaient plus modifiables ensuite.

Le RSSI décide que la **chronologie et le RETEX** vivent **dans la fiche de l'incident**, elle-même dans le **Registre des incidents**, et que
la page « Qualifier un signalement » disparaît, son questionnaire passant dans la fiche.

## Décision

- Les rubriques `incidents-qualifier` et `incidents-retex` sont retirées du menu, des rubriques de Pilotage et des routes. La destination
  « Incidents et crise » garde Registre des incidents, Cellule de crise, Contacts de crise, Scénarios et check-lists.
- **La fiche d'un incident s'ouvre en page du registre** (au lieu d'une fenêtre), avec un lien de retour au registre et trois onglets :
  1. **Fiche** : le contenu actuel (champs, priorité ITIL, obligations à cocher, action du registre des écarts, suppression) ;
  2. **Qualification guidée** : les six questions oui / non / je ne sais pas, **modifiables à tout moment** (enregistrées dans les réponses de
     l'incident), la qualification proposée avec sa justification, les obligations à vérifier calculées comme avant, et un bouton
     « Retenir » qui applique la qualification proposée à la fiche (et passe le statut « Nouveau » à « Qualifié ») ;
  3. **Chronologie et RETEX** : les rubriques de l'ancienne page (chronologie, contributeurs, à valider, récupération d'éléments, chronologie
     générée, plein écran), le bouton « Ouvrir un RETEX » (collecte seul ou avec contributeurs) pour l'incident courant.
- **Adresses** : `/pilotage/incidents-registre?incident=INC-…&onglet=qualification|retex&vue=…` (`onglet` absent = « Fiche », `vue` absent =
  chronologie). L'ancienne `/pilotage/incidents-retex?incident=X&vue=Y` est **redirigée** vers
  `/pilotage/incidents-registre?incident=X&onglet=retex&vue=Y`, et `/pilotage/incidents-qualifier` vers le registre.
- **Registre** : « Nouvel incident » crée une fiche vide et l'ouvre ; le bouton « Qualifier un signalement » disparaît. Chaque ligne affiche
  l'**état du RETEX** (pas de RETEX, saisie seule, collecte ouverte, close) et le nombre de propositions à valider ; un filtre « RETEX »
  complète les filtres existants. Aucune donnée nouvelle : l'état se déduit de la chronologie et de la collecte déjà chargées.
- **Un seul changement côté contrat** : `PATCH /api/incidents/:id` accepte désormais `answers` (réponses du questionnaire, mêmes valeurs et
  mêmes clés que pour la création, remplacées en bloc), sans quoi les réponses ne seraient pas modifiables. La qualification (`kind`) ne
  bouge que si l'utilisateur la retient. Aucun changement de schéma de stockage.

## Ce qui n'est pas fait

- **Pas de migration, pas de changement de stockage** : les champs `answers`, `timeline` et `retexCollecte` de l'incident sont inchangés.
- Les routes `/api/incidents/*` et `/api/retex/*`, la page `/retex` (« Mes contributions RETEX », pour les contributeurs invités) et la
  cellule de crise sont **inchangées**.
- Les réponses ne recalculent pas automatiquement la qualification de la fiche. Les obligations cochées sont repérées par leur rang dans la
  liste : si une réponse modifiée change cette liste (par exemple en retirant « RGPD »), les cases déjà cochées sont à vérifier. C'était déjà
  le cas quand on changeait la qualification à la main ; aucune réindexation n'est faite.
- Pas de filtre « RETEX » sur la durée ou la gravité : seul l'état de la collecte est filtré.

## Conséquences

Un incident se traite d'un seul endroit, de la qualification au retour d'expérience. Les signets vers les deux anciennes pages continuent de
fonctionner par redirection. La liste des RETEX (page « Retours d'expérience ») n'existe plus : le registre, filtré par état du RETEX, la remplace.
