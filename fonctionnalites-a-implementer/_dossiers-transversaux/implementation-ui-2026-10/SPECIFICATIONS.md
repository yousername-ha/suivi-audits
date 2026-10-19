# Spécifications fonctionnelles et graphiques

## 1. Règle transversale confirmée : le registre porte les périmètres

Un registre peut concerner un ou plusieurs périmètres. Les actions d’un plan, les écarts d’un registre et les tâches d’un registre de récurrences héritent de ce rattachement. « Transversal » signifie que le module reçoit des éléments issus de plusieurs parcours ; ce n’est pas un type supplémentaire de plan.

| Conteneur | Élément | Où choisir les périmètres ? |
| --- | --- | --- |
| Plan / registre d’actions | Action ponctuelle | Dans le plan uniquement |
| Registre d’écarts | Écart / non-conformité | Dans le registre uniquement |
| Registre de tâches récurrentes | Série de tâches puis occurrences | Dans le registre uniquement |

Le rattachement est une référence au registre réel, pas une liste de périmètres copiée et modifiable dans l’élément. Les fiches montrent « Périmètres hérités du registre » en lecture seule. La timeline et les tableaux utilisent la même résolution. Les filtres globaux trouvent les registres correspondants puis leurs éléments, sans créer une vue concurrente ni dupliquer les objets.

- Création directe : sélectionner le registre, puis saisir le contenu ; aucun second sélecteur de périmètre.
- Création depuis audit, risque ou autre module : conserver l’origine, sélectionner un registre autorisé et compatible ; présenter le rattachement hérité avant enregistrement.
- Changement de registre : actualiser les périmètres affichés, revalider droits et liens côté serveur, conserver la trace du déplacement. Ne pas changer l’identité de l’élément.
- Modification des périmètres d’un registre : afficher l’impact (éléments et liens concernés), appliquer une commande atomique contrôlée ; éviter une écriture individuelle sur chaque enfant.
- Archivage du registre : conserver ses éléments, historiques et preuves ; comportement de création/modification soumis aux règles métier réelles, pas à une suppression en cascade.
- Pour un registre multi-périmètre, ne pas sommer deux fois le même élément dans les compteurs globaux. Les compteurs par périmètre peuvent retrouver le même objet ; l’agrégat utilise les identifiants distincts.

**Historique :** un changement de périmètre actuel ne réécrit jamais la validation d’une occurrence, la clôture d’un écart, l’auteur ou les pièces probantes. Conserver le contexte historique de la décision selon le mécanisme existant. Héritage du rattachement actuel et traçabilité historique sont deux besoins distincts.

**Référentiels :** la portée d’un registre ne rend pas une exigence applicable partout. Les liens exigence/mesure/évaluation gardent le contexte du ou des périmètres auxquels cette exigence s’applique. Afficher ce contexte à côté de la référence ; utiliser les décisions d’applicabilité existantes. Ne pas inventer une union ou une intersection normative implicite.

Cette règle concerne les modules organisés en registres ; elle ne signifie pas que tous les objets de la plateforme deviennent des enfants de registre. Fournisseurs, preuves, études et périmètres gardent leurs modèles réels.

## 2. Navigation proposée

[Configuration de présentation](navigation.json) : sept familles métier et Administration séparée. Identifiants logiques uniquement ; le développeur mappe les routes et capacités existantes. Aucune route API ou permission n’est créée par ce JSON.

- Pilotage : synthèse, objectifs/indicateurs, rapports/comités, budgets.
- Organisation : contexte, périmètres, processus/actifs, fournisseurs, rôles/responsabilités, cartographies SMSI.
- Risques : registre et matrice interne, études/parcours, scénarios, traitements, gouvernance IA.
- Conformité & audits : conformité/applicabilité, audits, registres d’écarts, CaRE, HAS. Les écarts applicatifs spécialisés restent accessibles en vue/contextes du registre si leur modèle le permet ; ne pas les perdre en supprimant un ancien menu.
- Actions : plans d’action, tâches récurrentes, programmes/formation. « Toutes les actions » devient une vue filtrée des plans, pas une entrée concurrente.
- Résilience : incidents/crise, PCRA/continuité, CRRC/sauvegardes.
- Documents : preuves et documents via un accès central ; préserver leurs versions et restrictions métier.
- Administration séparée en bas : configuration GRC, comptes/habilitations, référentiels administrés, apparence, journal/données.

L’ordre ci-dessus est une **proposition à valider**. Le style est retenu. Une famille et un niveau de destinations ; détails dans les onglets de page. Une destination canonique par objet, liens contextuels depuis les autres modules. Chevrons orientés, icônes colorées, `aria-expanded`, entrée courante, focus visible. Un groupe ouvert par défaut, sans interdire l’accès clavier.

Le menu et l’en-tête restent fixes. Le contenu central défile verticalement ; le menu possède son propre débordement sur petit écran. Les tableaux/timelines défilent dans une zone bornée, avec intitulés fixes à gauche. Aucune longueur de liste ne doit étirer le menu. Sur mobile : menu repliable, retour au contenu et fermeture accessibles.

La cartographie dynamique du module cartographique est protégée : aucun changement de ses composants, routes, interactions ou styles internes. Son point d’accès peut être présenté sans mutation de sa destination.

## 3. Composants à partager

Adapter les composants existants de l’application cible et son design system : coque de navigation, sélection de registres, filtre global, badges d’état, tableau, calendrier horizontal, volet liste/détail, fenêtre centrale, sélecteur de responsable typé, affichage du contexte hérité. Les snapshots CSS des maquettes illustrent le résultat ; ne pas en faire un deuxième design system.

Style 08 : vert profond `#163E33`, fond clair sauge `#F5F5F0`, cartes blanches, texte `#203E37`, accents turquoise `#007D85` et bleu `#285FA3`, contours perceptibles. Fond des graphes uni, sans points. Fenêtres centrales compactes, largeur cible 680 px sur desktop, bornées au viewport, boutons de confirmation visibles. Pas de panneau d’édition latéral imposé.

Conserver les deux styles globaux déjà disponibles dans le socle si confirmés au SHA cible ; sélection en Administration pour tous les utilisateurs. Tester contraste, focus, mobile et mouvement réduit dans les deux thèmes. Les couleurs ne portent jamais seules l’information.

## 4. Plans d’action (017)

Référence v004. Plan → actions ; filtre de plans multiples, recherche et filtre de périmètre global. Timeline avec barre début/fin inclusive, liste de tâches fixe et période défilante ; traitement des dates absentes, barres d’un jour, limites du mois et actions hors fenêtre. Aucun glisser-déposer livré dans la maquette.

Quatre statuts demandés : À planifier (gris bleuté), En cours (bleu), En attente (orange, blocage), Terminé (vert). Retard rouge distinct du statut. Les identifiants et transitions viennent de la politique serveur. Motif de blocage visible ; compte rendu de réalisation conservé. Le responsable est une personne, un groupe ou une fonction, référencé par identifiant, distinct de l’auteur connecté.

Création, modification, changement de plan, lecture du contexte hérité. Même objet dans Timeline, Kanban et Liste & détail. Une action peut être créée directement ou issue d’un écart ; conserver les liens. Action terminée ≠ écart clôturé ≠ conformité validée.

## 5. Tâches récurrentes (018)

Référence visuelle v008 et compléments des versions v005/v006 pour les fenêtres et calendriers. Remplacer le `scope` des fixtures par le contexte hérité du registre. Les maquettes séparées ne constituent pas encore un parcours unique connecté.

Périodicités demandées : journalier, hebdomadaire, mensuel, bimensuel, trimestriel, semestriel, annuel et personnalisé. Conserver le sens retenu dans l’existant pour « bimensuel » (deux occurrences par mois, distinct d’une fois tous les deux mois) et afficher une formulation non ambiguë. Dates, fuseau, exceptions et fin de série doivent s’appuyer sur le moteur réel.

Fenêtre de réalisation configurable, par exemple les deux dernières semaines du mois. Afficher périodes futures, ouvertes, fermées et conflits ; ne pas autoriser une réalisation uniquement parce que le bouton est visible. Guides de timeline de la couleur de l’état courant, carrés opaques et lisibles. Intitulés fixes.

Import iCal de jours fériés et vacances dans la configuration de la plateforme ; zones françaises. Source utilisateur : https://fr.ftp.opendatasoft.com/openscol/fr-en-calendrier-scolaire/Zone-A-B-C-Corse.ics . Ne pas prétendre que ce calendrier scolaire fournit tous les jours fériés : gérer les sources séparément. Prévisualisation, provenance, zone/fuseau, validation, doublons, mises à jour et erreurs d’import. Les vacances superposées à la timeline peuvent être masquées sans désactiver les règles de réalisation.

Timeline, Kanban, Liste & réalisation. Dans la liste, détail à droite, validation OK/KO/NA et passage automatique à la prochaine occurrence éligible si activé. Un KO reste une occurrence réalisée avec résultat KO. Les fermées, futures et bloquées sont ignorées par l’enchaînement. Échec serveur : conserver le brouillon et la sélection ; double-clic : une seule validation.

Auteur issu de la session et horodatage serveur, irréversibles dans l’historique. Preuve référencée au registre central des preuves avec version et droits réels ; une pièce ne devient pas accessible à tous par son association. Pas d’identité éditable ni d’immutabilité prétendue sur un stockage navigateur.

## 6. Écarts (021)

Registre lié à un ou plusieurs périmètres, éventuellement à un audit. Depuis un audit, créer un écart dans un registre compatible ou créer ce registre selon les capacités réelles ; conserver la relation audit → registre → écart.

L’écart hérite du registre. Plusieurs exigences/mesures applicables peuvent être liées, avec leur contexte. Classification visible : NC majeure rouge, NC mineure orange foncé, point sensible violet ; libellés textuels. Origine, constat, cause, correction et responsables restent dans la fiche.

Créer/lier une action dans un plan existant sans dupliquer l’action. Une action peut être reliée à plusieurs écarts via les liens métier. Vérifier la cohérence des contextes du plan et du registre ; ne pas déplacer implicitement l’un pour établir le lien.

Clôture : critères d’efficacité, vérification et preuves selon le socle. Une action rouverte ou un nouveau problème ne réécrit pas la clôture : conserver le constat clos et créer un constat lié pour la récidive. Réévaluation de conformité séparée et justifiée.

## 7. Gestion graphique des périmètres (010)

Référence v007. Liste et diagramme représentent les mêmes objets de la plateforme ; création/modification depuis l’un actualise l’autre. Hiérarchie symétrique parent/enfants, liens orientés animés avec pause/mouvement réduit, fournisseur extérieur rattaché au registre fournisseurs.

Cartes : conformité et couverture distinguées ; « Écarts ouverts » sous le taux, majeurs rouges, mineurs orange foncé, points sensibles violets ; mini-compteurs BIA, PCRA, tâches et actions en retard. Résoudre les vrais objets et les permissions ; ne pas copier les pourcentages ou formules fictifs. Pas de double comptage des occurrences récurrentes dans les actions. Référentiels hérités parent/enfant seulement selon le choix et les règles existants.
