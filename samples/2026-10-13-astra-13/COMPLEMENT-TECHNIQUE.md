# Administration → Apparence : complément d’implémentation

Demande du 13 octobre 2026. Référence inspectée : `0f074fbfe69ee7cb7d77071eb343d98871d33531`, branche `legacy`.
**Statut : spécification et prototype, aucun réglage ajouté au code de l’application.** Ce complément remplace la portée personnelle proposée en série 12, conformément à la réponse de l’utilisateur : **à tous les utilisateurs**. Il prolonge le dossier 09 ; les séries précédentes restent intactes.

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

Ajouter **Administration → Apparence** : deux cartes de choix avec boutons radio natifs et miniatures. La sélection prévisualise le style dans le panneau ; le bouton **Enregistrer pour tous** applique le choix global après réponse positive du serveur. Message de succès accessible, erreur explicite sans faux succès, indicateur de modification non enregistrée et retour à Sauge doux. Le style par défaut est Sauge doux ; revenir à ce défaut doit aussi être enregistré pour tous.

**Portée confirmée : tous les utilisateurs de cette instance**, quels que soient leur compte, navigateur et appareil. Seuls les administrateurs peuvent modifier ce réglage. Tous les rôles authentifiés peuvent lire la préférence pour afficher la même palette. Le réglage persiste après redémarrage du serveur. Ne proposer aucune dérogation personnelle au style global.

Le mode existant « Système / Clair / Sombre » est indépendant et doit rester accessible. Le style sélectionné est conservé en mode sombre, mais ses fonds clairs ne doivent jamais écraser les variables sombres existantes. Au retour au mode clair, restaurer sa palette. Aucun changement du contraste des statuts.

## Points d’intégration

1. `modules/admin-ui.js` : ajouter la branche `adminView === 'appearance'` à `view()`, après le contrôle administrateur existant. Réutiliser composants, délégation d’événements et outils d’échappement. Conserver toutes les sections actuelles.
2. `modules/navigation-ui.js` : ajouter une seule destination `admin-appearance`, `tab: 'admin'`, `set: {adminView: 'appearance'}`, au registre réel. Vérifier l’extension d’administration et éviter les doublons. Le registre de référence passe de 100 à 101 destinations, toujours 24 rubriques ; réconcilier avec le HEAD réel.
3. Dans les modules d’habillage proposés au dossier 09, centraliser lecture/validation/application de la préférence ; valeurs autorisées strictement `sage` et `clair`. Préférer un attribut dédié (`data-nes-style`), distinct de l’attribut clair/sombre existant. Toutes les règles et les variables de cette refonte sont bornées à l’attribut de style actif et au mode approprié.
4. Persister le style dans une configuration d’instance côté serveur/SQLite, séparée de l’état métier et des exports métier. Inspecter les paramètres serveur existants et réutiliser leur stockage si approprié ; sinon ajouter une migration minimale, versionnée et idempotente, avec défaut `sage`. Le serveur est la source de vérité ; `localStorage` seul est insuffisant.
5. Prévoir un contrat de lecture authentifiée (`GET /api/appearance`) et d’écriture administrateur (`PUT /api/admin/appearance`), à adapter aux conventions actuelles. Réponse : `{style, revision}`. L’écriture transmet la révision attendue ; concurrence obsolète : 409 et relecture, sans écraser silencieusement un autre administrateur. Valider strictement `sage`/`clair` côté serveur (422), vérifier session, rôle et protections d’origine/CSRF existantes. Refuser les non-administrateurs (403). Mise à jour atomique et audit avant/après, sans données sensibles.
6. Charger le style global après authentification, avant le rendu habillé. Rafraîchir au retour au premier plan et via le mécanisme existant de synchronisation ; à défaut, interrogation légère toutes les 30 secondes pour les sessions visibles. Les sessions déjà ouvertes adoptent le nouveau style dans ce délai, les nouvelles sessions dès connexion. Ne pas imposer un rechargement qui ferait perdre un formulaire. Un cache par instance peut servir temporairement en cas de coupure, sans être une préférence personnelle. Échec d’enregistrement : conserver la dernière valeur serveur, maintenir le choix comme non enregistré et permettre de réessayer ; ne pas mettre l’écriture en file métier. Aucun faux message « enregistré ».
7. Au changement d’instance ou à la déconnexion, supprimer les effets d’une prévisualisation non enregistrée ; tous les comptes de la même instance reçoivent le même style validé. Conserver le mode clair/sombre/système personnel existant. Monter les gestionnaires une seule fois et nettoyer timers/écouteurs.

## Cartographies exclues impérativement

Ne modifier aucun fichier cartographique. Sur `ui.tab === 'carto'` et sur `ui.tab === 'dash' && ui.dashView === 'map'`, retirer avant rendu **tous** les effets du nouvel habillage : attribut, variables, en-tête ajouté, polices, offsets et dimensions. Cela couvre `dmap`, `mb-ctx`, `mb-proc`. La préférence est conservée mais suspendue sur ces routes, puis réappliquée à la sortie. Recevoir une modification globale depuis un autre compte ou appareil pendant qu’une carte est affichée ne doit pas modifier cette carte.

## Recette requise pour l’implémentation

- Prévisualiser puis enregistrer dans les deux sens, au clavier et à la souris ; vérifier sélection, focus, état non enregistré, message et retour au défaut.
- Vérifier deux comptes et deux contextes navigateur indépendants, rechargement, navigation, redémarrage serveur et propagation à une session ouverte sous 30 secondes. Tester coupure réseau, refus serveur, valeur invalide et conflit entre deux administrateurs.
- Tester séparément les deux styles × les modes clair, sombre, système (préférences système claire et sombre), sans flash de mauvaise palette.
- Vérifier les permissions serveur directement : lecture par chaque rôle authentifié, écriture refusée aux non-administrateurs. Contrôler persistance et audit ; aucune mutation des risques, actions ou autres données métier.
- Vérifier cockpit, risques, Annexe A, les six vues Plans d’action et le reste du registre ; conserver tous les parcours.
- Comparer les trois cartes avant/après avec mêmes données, dimensions et mode historique : apparence, canevas et interactions identiques, y compris navigation directe et réception d’une mise à jour globale.
- Tester 390 / 768 / 1440 / 1920 px, contrastes WCAG AA, zoom 200 %, navigation clavier.

## Limites du prototype livré

`index.html` est une page autonome hors application, sans serveur ni authentification. Le menu est illustratif et abrégé. La sélection permet une prévisualisation ; « Enregistrer pour tous » **simule** la validation et mémorise uniquement dans ce navigateur, sous `astra-global-appearance-prototype-v1`. Les messages portent explicitement la mention simulation. Aucune propagation entre utilisateurs n’est implémentée dans cette maquette. Le mode clair/sombre est décrit, pas simulé. Les captures et contrôles du prototype ne prouvent ni l’intégration serveur ni la recette multi-utilisateur.
