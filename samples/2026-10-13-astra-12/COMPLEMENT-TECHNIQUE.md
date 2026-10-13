# Administration → Apparence : complément d’implémentation

Demande du 13 octobre 2026. Référence inspectée : `12a08a1d1c47053889f080c639309f7f2dc4fc85`, branche `legacy`.
**Statut : spécification et prototype, aucun réglage ajouté au code de l’application.** Ce complément prolonge le dossier de la série 09 ; les séries précédentes restent intactes.

## Deux styles disponibles

| Jeton | Sauge doux (`sage`) | Clair bleuté (`clair`) |
| --- | --- | --- |
| Fond principal | `#F5F6F1` | `#F7F9FB` |
| Fond secondaire | `#EDF2EE` | `#F0F4F7` |
| Bordures | `#DCE2DB` | `#DCE5E9` |
| Séparateurs | `#E9EDE7` | `#EEF2F4` |
| Cartes | `#FFFFFF` | `#FFFFFF` |

Commun : navigation `#173F34`, sélection `#315B4B`, sauge `#84A28C`, bleu marine `#142F61`, accent turquoise sombre `#236B70`. Conserver couleurs des statuts et graphiques.

## Parcours et portée

Ajouter **Administration → Apparence** : deux cartes de choix avec boutons radio natifs, miniatures, application immédiate, message accessible de mémorisation et retour à Sauge doux. Le choix reste stable à la navigation et au rechargement. Par défaut : Sauge doux, style précédemment validé. Le prototype montre les deux variantes en mode clair.

Hypothèse retenue en attendant la préférence de l’utilisateur : **choix personnel, par compte et navigateur**. Ce n’est pas un réglage global pour tous les comptes, ni une synchronisation entre appareils. Le panneau reste réservé aux administrateurs conformément aux droits actuels ; un administrateur modifie ici sa propre préférence. Une ouverture aux autres rôles dans « Mon compte » est hors périmètre de ce complément.

Le mode existant « Système / Clair / Sombre » est indépendant et doit rester accessible. Le style sélectionné est conservé en mode sombre, mais ses fonds clairs ne doivent jamais écraser les variables sombres existantes. Au retour au mode clair, restaurer sa palette. Aucun changement du contraste des statuts.

## Points d’intégration

1. `modules/admin-ui.js` : ajouter la branche `adminView === 'appearance'` à `view()`, après le contrôle administrateur existant. Réutiliser composants, délégation d’événements et outils d’échappement. Conserver toutes les sections actuelles.
2. `modules/navigation-ui.js` : ajouter une seule destination `admin-appearance`, `tab: 'admin'`, `set: {adminView: 'appearance'}`, au registre réel. Vérifier l’extension d’administration et éviter les doublons. Le registre de référence passe de 100 à 101 destinations, toujours 24 rubriques ; réconcilier avec le HEAD réel.
3. Dans les modules d’habillage proposés au dossier 09, centraliser lecture/validation/application de la préférence ; valeurs autorisées strictement `sage` et `clair`. Préférer un attribut dédié (`data-nes-style`), distinct de l’attribut clair/sombre existant. Toutes les règles et les variables de cette refonte sont bornées à l’attribut de style actif et au mode approprié.
4. Persister via `localStorage` sous une clé versionnée incluant l’identifiant stable du compte authentifié, et l’instance si plusieurs instances partagent une origine. Lire l’identité dans `LegacyServer.user()` après authentification ; inspecter son contrat avant de choisir le champ, ne pas utiliser le nom affiché. Ne stocker ni jeton de session ni mot de passe. Stockage indisponible : appliquer en mémoire, informer que la préférence n’est pas mémorisée. Valeur inconnue : revenir à `sage`.
5. Au changement de compte et à la déconnexion, retirer le style précédent avant le rendu suivant. Ne pas écrire dans l’état métier via `U.mutate`, dans les exports métier ou dans la file de sauvegarde. Aucune migration serveur pour ce choix local.
6. Synchroniser le choix entre onglets du même compte via l’événement `storage`. Monter les gestionnaires une fois et nettoyer les effets au changement de route.

## Cartographies exclues impérativement

Ne modifier aucun fichier cartographique. Sur `ui.tab === 'carto'` et sur `ui.tab === 'dash' && ui.dashView === 'map'`, retirer avant rendu **tous** les effets du nouvel habillage : attribut, variables, en-tête ajouté, polices, offsets et dimensions. Cela couvre `dmap`, `mb-ctx`, `mb-proc`. La préférence est conservée mais suspendue sur ces routes, puis réappliquée à la sortie. Changer le style dans un autre onglet pendant qu’une carte est affichée ne doit pas modifier cette carte.

## Recette requise pour l’implémentation

- Basculer dans les deux sens, au clavier et à la souris ; vérifier sélection radio, focus, message et retour au défaut.
- Vérifier rechargement, navigation, deux comptes sur un navigateur, onglets et déconnexion ; vérifier valeur invalide et stockage bloqué.
- Tester séparément les deux styles × les modes clair, sombre, système (préférences système claire et sombre), sans flash de mauvaise palette.
- Préserver contrôle administrateur : route directe non autorisée inchangée. Aucun appel de mutation métier ou serveur lors du choix.
- Vérifier cockpit, risques, Annexe A, les six vues Plans d’action et le reste du registre ; conserver tous les parcours.
- Comparer les trois cartes avant/après avec mêmes données, dimensions et mode historique : apparence, canevas et interactions identiques, y compris navigation directe et événement `storage`.
- Tester 390 / 768 / 1440 / 1920 px, contrastes WCAG AA, zoom 200 %, navigation clavier.

## Limites du prototype livré

`index.html` est une page autonome hors application. Son menu latéral est illustratif et abrégé ; il ne remplace pas le registre réel. Le sélecteur fonctionne et mémorise uniquement un choix de démonstration sous `astra-appearance-prototype-v1`, sans authentification. Cette clé n’est pas le modèle de persistance de production. Le sélecteur clair/sombre est seulement décrit, pas simulé. Les captures ne prouvent pas une intégration ni une recette métier.
