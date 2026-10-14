# Navigation simplifiée — ajout après analyse de la vidéo

## Ce que montre la référence

Vidéo fournie le 14 octobre 2026, durée 2 min 02, résolution 1912×914, sans piste audio. Lecture visuelle par captures réparties sur toute la séquence, avec inspection en détail des menus. La vidéo montre une autre application GRC : elle constitue une référence d’organisation, pas une preuve des fonctions de legacy ni une demande de reprendre son identité graphique. Les images et données affichées dans la vidéo ne sont pas publiées dans ce dossier.

Repères approximatifs : début, tableau de bord et menu métier ; 7–15 s, indicateurs et actions ; 17–40 s, contexte, enjeux, parties intéressées et objectifs ; 42–49 s, organisation et risques ; 52–70 s, exigences, mappings et fournisseurs ; 72–80 s, constats et incidents ; 82–100 s, catégories et échelles ; 102–122 s, notifications, validations et paramètres.

À retenir : familles métier, sous-menus repliables, table de travail cohérente avec recherche/filtres/colonnes. La vidéo conserve elle-même de nombreuses entrées et sépare Configuration, Workflow et Paramétrage ; notre proposition regroupe ces administrations pour alléger davantage le menu. Le style 08 retenu reste la référence visuelle.

## Doublons confirmés et faux doublons

Le code actuel `modules/navigation-ui.js` répartit 24 sections dans quatre groupes. L’inventaire documentaire antérieur décrit 100 destinations ; il est utilisé comme base de correspondance, pas comme décompte certifié de toutes les routes au prochain SHA.

| Cas | Preuve / distinction | Décision proposée |
|---|---|---|
| Comptes et habilitations dans Périmètres et Administration | `modules/admin-ui.js:111` appelle `U.accounts()` ; `modules/integration-ui.js:405` fait de même | Une destination principale, anciens IDs en alias ; conserver l’accès annuaire déjà autorisé |
| Rôles et responsabilités dans Périmètres et Administration | `admin-ui.js:112` appelle `U.rolesView()` ; registre partagé `roles` | Une destination principale Organisation → Rôles et responsabilités ; contexte admin sous forme de lien |
| Ancien Contexte → Rôles | `navigation-ui.js` filtre `ctx-roles` et redirige vers `perimeters/roles` | Doublon déjà traité : conserver la compatibilité, ne pas le recréer |
| Actions CaRE, HAS, PCRA, IA et plan global | Vues métier contextualisées ; même libellé ne prouve pas une duplication de stockage | Un accès transversal Actions, liens contextuels dans les modules ; adapter les filtres sans fusion aveugle des données |
| Preuves globales et preuves CaRE/HAS/PCRA | Versions et restrictions métier distinctes | Documents centralise l’accès ; les preuves contextualisées restent dans leurs parcours |
| Tableaux de bord par domaine | Synthèses différentes | Une synthèse principale ; synthèses locales à l’intérieur des modules |
| Matrice des risques et cartographie SMSI | Objets et interactions distincts | Matrice dans Risques ; cartes SMSI accessibles sans aucun changement du module |
| Politiques de risque et d’impact PCRA | Configurations distinctes, parfois compatibles | Administration GRC commune avec types/versions ; conserver les règles spécifiques et les lectures contextuelles |
| Référentiels de conformité et catégories administrables | Mesures/exigences versus paramètres de classement | Conformité pour le travail métier ; Administration pour gérer les définitions |
| Incidents, crise et PCRA | Signalement, gestion de crise, préparation/reprise | Même famille Résilience, modules et états conservés |

## Arborescence proposée : sept rubriques métier

| Rubrique | Entrées secondaires |
|---|---|
| **Pilotage** | Vue d’ensemble ; Objectifs & indicateurs ; Rapports & comités ; Budgets & investissements |
| **Organisation** | Contexte & périmètres ; Processus & actifs ; Fournisseurs ; Rôles & responsabilités ; Cartographies du SMSI |
| **Risques** | Registre des risques ; Études & parcours ; Scénarios ; Traitements ; Gouvernance de l’IA |
| **Conformité & audits** | Conformité & applicabilité ; Audits ; CaRE ; HAS ; Écarts applicatifs |
| **Actions** | Plan d’action ; Tâches récurrentes ; Programmes & formation |
| **Résilience** | Incidents & crise ; PCRA · continuité ; CRRC · sauvegardes |
| **Documents** | Accès direct aux preuves et documents, avec vues internes |

**Administration**, séparée en bas : Configuration GRC ; Comptes & habilitations ; Référentiels administrés ; Apparence ; Journal & données. Configuration GRC contient les échelles, critères, matrices, catégories, méthodes et validations de parcours en onglets internes. L’accès à chaque fonction conserve ses permissions serveur ; le regroupement ne donne aucun droit supplémentaire.

Mon compte, aide, parcours de démarrage et notifications réellement disponibles se placent dans les utilitaires. Ne pas créer un centre de notifications inexistant pour imiter la vidéo. Les fonctions CRRC, CaRE, HAS, budgets, IA et écarts applicatifs sont toutes conservées.

## Règles d’épuration

- Un seul niveau de familles et un seul niveau de destinations dans la barre latérale. Les subdivisions plus fines sont des onglets de page, jamais une quatrième profondeur d’accordéon.
- Un groupe ouvert à la fois par défaut. Chevrons orientés, icônes colorées, libellés complets, focus visible et `aria-expanded` ; aucun signe +/−.
- Un objet possède une destination principale. Les accès depuis les autres modules sont des liens contextualisés conservant l’identifiant, les filtres et le bouton de retour.
- Liste, Kanban, calendrier, planning, Gantt et synthèse restent des vues d’un même registre. Ne pas créer six menus pour six présentations.
- Les tâches récurrentes restent une entrée visible sous Actions : leurs occurrences et leur historique ne sont pas fusionnés avec les actions ponctuelles.
- Dans Risques, « Matrice » est un onglet du registre ; « Études & parcours » expose les méthodes autorisées. Les cinq ateliers sont dans l’étude, pas cinq menus globaux.
- La cartographie dynamique garde exactement ses routes, composants et comportements. Seul son point d’accès est classé sous Organisation ; aucun habillage interne.
- Aucune rubrique « Divers », « Autres modules » ou « Outil de suivi ancien » fourre-tout. Un alias historique peut rester utilisable sans être une entrée principale permanente.

## Contrat d’implémentation de la navigation

Créer une configuration de navigation **de présentation**, indépendante des registres métier. Chaque destination possède `id`, `label`, `icon`, `groupId`, `route`, `requiredCapabilities`, `aliases`, `contextPolicy`. Les routes restent celles de legacy ; une destination nouvelle est explicitement marquée proposée et ne devient visible qu’après implémentation. L’annexe JSON décrit les familles cibles ; le CSV contient les correspondances des destinations documentées et des alias historiques repérés.

Modifier l’assemblage `navDef`/`LegacyNavigation.organize` et le rendu de la barre après tests, sans dupliquer les définitions dans plusieurs composants. Transformer `navOrder`, `navGroups`, `navLast` et l’historique local en conservant les préférences compatibles ; ignorer proprement les IDs retirés de l’affichage. Un ancien favori doit ouvrir sa destination canonique autorisée. Les aliases n’accordent aucune capacité et ne contournent pas la projection serveur.

Conserver les variantes lecteur/éditeur/administrateur. « Administration » n’implique pas que ses sous-écrans soient tous réservés au rôle admin si un annuaire était auparavant consultable : dissocier lecture d’annuaire et modification des habilitations, sans réduire silencieusement un accès autorisé. Le serveur demeure l’autorité.

## Validation de la proposition et recette dédiée

Les dix vues du dossier utilisent désormais cette barre simplifiée. Deux captures supplémentaires montrent le menu replié et le groupe Risques ouvert. Ce sont des propositions à valider, pas un changement du runtime.

Tests à écrire pour l’intégration : toutes les destinations du registre effectif ont une correspondance ; chaque destination principale apparaît une seule fois ; les anciens IDs fonctionnent ; recherche/favoris/retour conservent leur état ; accès lecteur/éditeur/admin identiques ; aucun panneau de cartographie changé ; accès direct aux tâches récurrentes, actions, preuves et cinq ateliers maintenu ; navigation clavier et affichage étroit ; pas de libellé tronqué sans alternative lisible.

Faire un essai utilisateur de cinq tâches : retrouver une preuve, planifier une tâche récurrente, ouvrir une étude EBIOS, retrouver un fournisseur, gérer une habilitation. Mesurer les erreurs de chemin et les retours en arrière avant/après ; ne pas inventer un gain chiffré sans mesure.
