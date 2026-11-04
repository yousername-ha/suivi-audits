# ADR 0081 — « Mes rappels » seul dans le Pilotage ; « Configuration du pilotage » dans la Plateforme

- Statut : acceptée (décision du RSSI du 04/11/2026, option A)
- Date : 2026-11-04
- Rédaction : session « Projet audit_suivi Coeur » (`session_01ES6jrfuR1tD6Az1XDgAnS3`)
- Contexte : la destination du menu Pilotage « Rappels et configuration » réunissait deux pages sans lien entre elles :
  « Mes rappels » (notifications personnelles, ouvert à toute personne qui lit le Pilotage) et « Configuration du pilotage »
  (publication des méthodes d'appréciation, politique métier, accès aux périmètres existants), qui est un réglage de la
  plateforme. Le menu Pilotage faisait ainsi doublon avec les pages de configuration de l'Administration
  ([ADR 0011](0011-charte-graphique-et-parametres.md), cartes de la page « Plateforme »). Le RSSI retient l'option A :
  séparer les deux et ranger la configuration avec les autres configurations de la plateforme.

## Décision

1. **« Mes rappels »** devient l'unique rubrique de la destination `rappels` du menu Pilotage (identifiant inchangé, donc
   l'ordre personnalisé du menu enregistré par chacun reste valable ; libellé « Mes rappels »). Adresse `/pilotage/rappels`
   et droit (`pilotage:lire`) inchangés.
2. **« Configuration du pilotage »** quitte le menu Pilotage et devient une carte de la page **Plateforme**, juste après
   « Échelles et matrices (GRC) » (carte `configuration-pilotage`). Comme cette dernière, la carte ouvre une page entière
   (`lien`), et non une fenêtre : la page dépend du périmètre affiché (méthodes, accès) et garde son sélecteur de périmètre.
3. **Aucune adresse ne change.** La page reste servie à `/pilotage/configuration` : anciens signets, liens du guide, lien
   « Choisir ou adapter la méthode d'appréciation » du registre des risques et tests existants continuent de fonctionner,
   sans redirection. `/pilotage/rappels` reste l'adresse des notifications ([ADR 0058](0058-notifications-metier.md)). Sur
   cette page, l'entrée « Plateforme » du menu est en surbrillance (extension de l'alias d'adresses de
   `administration-droits.ts`) et un lien « ← Plateforme » ramène à la page de cartes.
4. **Aucun droit ne change.** La carte est visible si et seulement si la personne a `pilotage:lire`, soit le droit de
   l'ancienne rubrique ; la page contrôle toujours ses propres droits, les panneaux gardent les leurs (politique métier :
   `administration:lire` ; accès au périmètre : `pilotage:administrer`), et l'API est inchangée. Le filtrage du menu ne vaut
   pas permission.
5. **Garde-fou.** `PILOTAGE_DANS_ADMINISTRATION` (administration-droits.ts) liste les rubriques du Pilotage rangées dans
   l'Administration ; le test `navigation.test.ts` exige que toute autre rubrique de `PILOTAGE_NAV` figure une fois au menu,
   et `administration-droits.test.ts` vérifie l'équivalence des droits.

## Conséquences

- Toute personne qui lit le Pilotage voit désormais l'entrée de menu « Plateforme » (avec cette seule carte tant qu'elle n'a pas
  `parametres:lire` ou `administration:lire`) : c'est la contrepartie du maintien de son droit d'accès à la page. Le
  restreindre à l'administration changerait un droit et demanderait une autre décision.
- Doublons constatés et **non traités** (rien n'est supprimé sans décision) : (a) les échelles et matrices (Configuration GRC)
  restent accessibles de trois endroits (carte « Échelles et matrices (GRC) », Risques › Configuration des analyses,
  `/parametres/configuration-grc`), mêmes API et mêmes droits ; (b) l'accès aux périmètres (composant `Members`) se règle à la
  fois dans « Configuration du pilotage » et dans la fiche d'un périmètre (Organisation › Périmètres) ; (c) la politique métier
  porte des blocs « notifications » et « affichage » proches des cartes « Notifications » et « Apparence » de la Plateforme,
  mais ce sont d'autres réglages, stockés ailleurs.
- Une éventuelle adresse canonique sous `/plateforme/…` (avec redirection de `/pilotage/configuration`) reste possible plus
  tard ; elle supposerait de sortir la page du composant Pilotage.
- Aucune dépendance, aucune migration, aucune route d'API. Retour arrière : remettre `p('configuration')` dans la destination
  `rappels` et retirer la carte.
