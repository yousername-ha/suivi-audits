# Spécifications préparatoires — 022 Gestion des droits

Analyse détaillée antérieure, complément du dossier courant. Le périmètre de préparation a été approuvé le 20 octobre ; les hypothèses de capacités serveur restent à vérifier. Référence visuelle : [v001](../maquettes/v001-acces-visuels/README.md).

## Parcours UI/UX

1. Administration → Comptes & habilitations → Vue des accès. Conserver comptes, groupes et rôles existants dans ce contexte, sans nouveau menu principal.
2. Sélectionner utilisateur ou groupe ; filtrer par périmètre du registre et nom. Limiter les cartes visibles avec recherche/pagination côté produit ; ne jamais rendre toute l’organisation sous forme de matrice géante.
3. Choisir un registre. Présenter identité, origines, profil effectif et opérations permises/interdites. Les couleurs sont accompagnées de textes et symboles.
4. Ajuster le rôle dans une fenêtre centrale : choix explicite, avant/après, nombre de personnes concernées, motif et confirmation. Mentionner les droits hérités qui subsistent.
5. Consulter l’origine précise des droits. Ne pas présenter un rôle direct faible comme un refus prioritaire.
6. Tester un accès concret et consulter les ajustements. Le produit devra utiliser les décisions du serveur ; les données locales du prototype ne sont pas un journal d’audit sécurisé.

Le menu reste fixe et le contenu défile indépendamment. Les modales restent contenues dans la fenêtre, utilisables au clavier et sur mobile. Garder le style 08, les icônes colorées, les panneaux clairs et les contours lisibles. `shell.css` est un instantané de la coque de 017 ; mutualiser avec le design system de la branche cible lors de l’intégration.

## Collaborateur — interprétation conservatrice à confirmer

| Opération | Proposition |
|---|---|
| Consulter | Contenus autorisés uniquement |
| Commenter | Ajouter un commentaire sur un élément existant |
| Preuve | Ajouter ou rattacher une preuve autorisée, retrouvable dans le registre des preuves |
| Réalisation | Réaliser une action ou occurrence attribuée, si son état et sa fenêtre le permettent |
| Création | Ni nouveau registre, ni action, écart ou définition de tâche |
| Édition | Ni titre, description, dates, responsable, récurrence, périmètres, ni suppression |
| Administration | Aucun changement d’habilitation ou de structure |
| Écart | Aucun droit implicite de clôture, réouverture ou validation de conformité |

La réalisation autorise une transition métier limitée, pas l’édition générale. Les validations OK/KO/NA des occurrences doivent respecter les règles réelles du module : auteur et date serveur, pièces liées et trace immuable ; pas de réécriture d’une validation passée. Les commentaires/preuves ne doivent pas servir à modifier ou supprimer un contenu antérieur. Les affectations personne/groupe/fonction doivent être résolues côté serveur ; une fonction responsable n’est pas automatiquement un rôle d’accès.

Les registres portent un ou plusieurs périmètres, hérités par les éléments. Aucune sélection indépendante de périmètre sur une action, un écart ou une tâche. Un rôle ne contourne pas la visibilité autorisée du registre ni celle des preuves liées. La projection autorisée du prototype est une fixture : elle ne définit pas la politique de visibilité multi-périmètres du produit. Cette politique reste à vérifier dans les services réels.

## Existant consulté en lecture seule

Source : instantané Claude au SHA `284cb1e4ffbaee37e0952073db5659c2257c888e`, consulté le 19 octobre 2026. Ce relevé ne garantit pas l’état le plus récent de sa branche. Aucun fichier, index, branche, build ou test Claude n’a été modifié/exécuté.

- `packages/shared/src/permissions.ts` : actions `lire`, `modifier`, `supprimer`, `exporter`, `administrer`. `modifier` signifie « Créer et modifier » ; rôles système Administrateur, RSSI, Contributeur, Lecteur et Auditeur externe. Collaborateur absent de cet instantané.
- Les permissions effectives résultent du cumul des rôles directs et des groupes, avec leurs origines. Pas de refus prioritaire démontré.
- `apps/api/src/routes/access.ts` : comptes, groupes, rôles, catalogue de permissions, revue des accès et droits d’un utilisateur. Routes existantes `/api/admin/users`, `/api/admin/users/:id/rights`, `/api/admin/groups`, `/api/admin/roles`, `/api/admin/permissions`, `/api/admin/access-review`.
- `apps/api/src/auth.ts` : résolution des droits et contrôles serveur.
- `apps/web/src/pages/AdminAccess.tsx` : panneaux d’administration existants, React/Mantine, requêtes TanStack, `useCan`, gestion des erreurs, invalidation de cache et export. Réutiliser ces contrats et composants en adaptant la présentation.

Les attributions par registre et les permissions fines commenter/preuve/réaliser ne sont pas confirmées dans ces contrats. Elles constituent un besoin d’intégration, pas des API existantes. Le profil Contributeur de la maquette simplifie l’affichage des opérations du registre ; il ne remplace pas la définition complète du rôle système.

## Contrats et intégration à finaliser

Ne pas accorder `modifier` au Collaborateur en masquant les boutons de création. Faire fournir par le socle métier une distinction serveur entre contributions encadrées, création et édition. Sans ces capacités, conserver ce rôle en démonstration et les mutations indisponibles dans le produit. Ne pas inventer un endpoint concurrent.

Réutiliser les identifiants de compte, groupe, rôle, registre et preuve. Demander une projection serveur des opérations effectives, de leur origine et des conditions applicables ; confirmer le niveau d’attribution module/registre et les règles multi-périmètres avant raccordement. Le journal réel doit conserver acteur, cible, portée, avant/après, raison, date serveur et identifiant de requête, avec les garanties du socle.

Préserver les garde-fous existants : contrôle `administration:lire` pour consulter, permission d’administration pour modifier, interdiction d’auto-ajustement non autorisé, maintien d’un administrateur, rôles système protégés, concurrence `If-Match`, révocation des sessions concernées et audit. Gérer accès refusé, état expiré, chargement, échec réseau et conflit sans annoncer à tort un succès. Ne jamais journaliser de secret.

Ordre : vérifier les fondations d’habilitation en L1 du dossier transversal ; adapter la vue d’administration avec la coque en L2 ; raccorder les contextes des registres après L3. L’interface complète 022 n’est pas un préalable artificiel à tous les modules, mais les capacités serveur fines sont nécessaires avant toute contribution réelle du Collaborateur.

La portée des contributions reste la seule question utilisateur pendante : réalisation/commentaire/preuve, ou également création d’actions/écarts dans un registre existant. La v001 choisit la première option sans la présenter comme confirmée.

## Recette à réaliser lors de l’intégration

Vérifier les requêtes directes au serveur, pas seulement les boutons : création/édition/suppression refusées au Collaborateur ; réalisation interdite si non attribuée, hors fenêtre ou déjà validée ; preuve inaccessible non rattachable ; cumul des groupes et retrait de rôle correctement expliqués ; accès multi-périmètres ; auto-ajustement et dernier administrateur ; concurrence et révocation ; audit immuable ; aucun accès hors contexte par changement d’identifiant. Tester ensuite clavier, focus, annonces des erreurs, contrastes, responsive et chargement de grands annuaires.

Les 22 contrôles locaux de la maquette sont consignés dans [tests](../tests/README.md). Ils ne valident ni ces garanties serveur ni une intégration de production.
