# 018 — Registres et tâches récurrentes : dossier d’implémentation

Édition du 20 octobre 2026. **Périmètre approuvé pour transmission au codage**, sous contrôle préalable de l’existant. Référence de conception : [v008-defilement-zones-fixes](../maquettes/v008-defilement-zones-fixes/README.md). Aucun statut « implémenté » ni validation serveur revendiqué.

## Instruction obligatoire avant développement

Lire [Contrôle de l’existant et consignes de codage](../../_dossiers-transversaux/implementation-ui-2026-10/CONTROLE-EXISTANT-ET-CODAGE.md). Pour chaque exigence ci-dessous, vérifier la branche/SHA cible et renseigner preuve, état et écart. **Si c’est déjà implémenté et vérifié, conserver l’existant.** Ne coder que le manque ; aucune reconstruction sur la seule base d’une ancienne maquette ou documentation.

## Demandes, règle retenue et recette

Ces lignes consolident les remarques utilisateur applicables au périmètre. Les précisions d’intégrité, d’erreur et d’accessibilité complètent leur traduction technique. Les propositions non confirmées figurent dans les limites ci-dessous ; elles ne deviennent pas des règles normatives implicites.

| ID | Demande / sujet | Règle retenue pour l’intégration | Critère à vérifier sur la cible |
| --- | --- | --- | --- |
| 018-01 | Registres et sélection multiple | Tâches regroupées par registre ; afficher tous ou certains ; périmètres hérités du registre. | Filtres conservés entre vues, aucun doublon d’occurrence ni sélecteur de périmètre dans la tâche. |
| 018-02 | Timeline lisible | Carrés légèrement larges, opaques et foncés ; guide horizontal de la couleur de l’état sur la période ; jaune pour une occurrence ouverte en attente. | Même ligne suivie de gauche à droite ; état indiqué par texte/symbole et couleur. |
| 018-03 | Intitulés et menu fixes | Intitulés fixes pendant défilement horizontal ; menu/en-tête fixes ; zones de contenu bornées et défilements indépendants. | Longues listes et 100 cartes ne déplacent pas la navigation ni les commandes de validation. |
| 018-04 | Fenêtre centrale de réalisation | Cliquer une occurrence ouvre un rectangle central compact à contour visible ; validation OK/KO/NA. | Clavier, mobile, état fermé/futur/bloqué, annulation et erreurs gérés. |
| 018-05 | Preuve et auteur irréversibles | Associer une preuve du registre central, auteur issu de la session et heure serveur ; réalisation conservée en historique. | Double clic idempotent ; preuve retrouvable avec droits et version ; identité non éditable. |
| 018-06 | Sept récurrences et personnalisé | Journalier, hebdomadaire, mensuel, bimensuel, trimestriel, semestriel, annuel et custom. | Prévisualiser occurrences, fuseau, exceptions, fin de série ; aucune série générée deux fois. |
| 018-07 | Fenêtre de réalisation configurable | Exemple mensuel : deux dernières semaines du mois ; dates d’ouverture/fermeture et conflits explicites. | Serveur refuse hors fenêtre ; mois courts, changement d’heure et exclusion totale testés. |
| 018-08 | Vacances françaises et jours fériés par iCal | Configurer en plateforme ; source Zone A/B/C/Corse fournie, source fériés distincte ; importer/actualiser avec provenance. | Import incorrect/répété, TZ et date de fin exclusive ; pas de perte de calendrier existant. |
| 018-09 | Superpositions activables | Vacances et fériés affichables séparément derrière les tâches. Affichage distinct des règles de calcul. | Masquer le fond ne rend pas réalisable une occurrence exclue. |
| 018-10 | Kanban et liste avec détail à droite | Mêmes occurrences et résultats que timeline ; liste à gauche et détail à droite, jamais nouveau menu global pour chaque vue. | KO reste réalisé avec résultat KO ; aucune carte déplacée ne contourne une validation. |
| 018-11 | Validation rapide et enchaînement | Après succès uniquement, garder la coche/résultat et sélectionner la prochaine occurrence éligible de la liste filtrée ; option désactivable. | Erreur garde saisie/sélection ; fin de liste explicite ; aucune validation automatique de la suivante. |

## UI/UX, composants et références

Conserver les états et visuels de la [maquette de référence](../maquettes/v008-defilement-zones-fixes/README.md) et les composants natifs déjà conformes. La règle commune de style 08 et de défilements s’applique ; ne pas recopier globalement les CSS de prototype. Prévoir chargement, vide, recherche sans résultat, refus d’accès, erreur réseau, conflit de version et confirmation lorsqu’une opération le nécessite. Contrôles et actions accessibles au clavier, focus explicite, légendes textuelles, écrans étroits et thèmes Sauge/Clair.

Documents complémentaires à lire :

- [README.md](../maquettes/v008-defilement-zones-fixes/README.md).
- [README.md](../maquettes/v006-recurrence-calendriers-ical/README.md).
- [README.md](../maquettes/v005-periodicites-fenetres/README.md).

## Architecture et contrats à réutiliser

Réutiliser séries/occurrences et tâches existantes (`seriesId`, `occurrenceKey`, routes series/:id/occurrences, tasks/window/dashboard). Le snapshot ne prouve pas la commande complète OK/KO/NA avec preuve immuable : la rechercher avant toute extension. Les dates, exclusions, fenêtre et droits se décident côté serveur.

Registres multi-périmètres, moteur de récurrence, occurrences, calendrier 012, preuves et commande idempotente de réalisation.

Les modèles/réponses/API réels restent autoritaires. Identifier les composants, queries et mutations existants, conserver les IDs, versions et droits. Les fixtures ne remplacent pas les schémas partagés. Après mutation réussie, actualiser les vues liées sans création en double ; en erreur conserver les saisies. Toute migration doit préserver données et historiques et avoir une reprise documentée.

## Limites et décisions à expliciter

Les versions v005/v006 complètent la v008 ; aucune seule maquette ne constitue le backend complet. Remplacer le scope par tâche des fixtures par héritage du registre. Ne pas imposer une preuve pour toutes les occurrences parce qu’un exemple la demande. Bimensuel est présenté comme deux fois par mois, distinct d’une fois tous les deux mois ; libellé explicite et contrat moteur requis.

Ces points sont à établir par le contrôle du code courant ou à signaler comme décision manquante. Ils n’autorisent ni invention de méthode normative, ni extension silencieuse des droits, ni annonce d’une capacité non vérifiée. Le code disponible chez Claude n’est consulté qu’en lecture seule ; toute adaptation autorisée se fait sur la branche propre de l’IA de codage.

## Ordre, recette et remise

1. Auditer chaque exigence et les dépendances ; rendre le relevé d’existant avant de modifier.
2. Conserver les comportements satisfaisants et réutiliser leurs composants. Adapter lecture/navigation, puis formulaires et commandes effectivement supportées, puis relations entre modules.
3. Exécuter les critères du tableau sur données synthétiques, les contrôles métier et permissions côté serveur, puis typage/build/lint/tests pertinents et non-régressions UI. Les résultats de [tests historiques](../tests/README.md) ne sont pas une preuve d’intégration actuelle.
4. Livrer branche/SHA, écarts traités, tests, visuels et limites ; utiliser le marqueur uniquement selon les consignes communes, après intégration réelle vérifiée.

[Prompt dédié](PROMPT-IMPLEMENTATION.md). Le classement « à implémenter » transmet ce dossier à l’IA ; il ne signifie pas que tout doit être recodé ni que la maquette contient déjà tous les services.

## Références graphiques complémentaires à conserver

- [v005-periodicites-fenetres](../maquettes/v005-periodicites-fenetres/README.md).
- [v006-recurrence-calendriers-ical](../maquettes/v006-recurrence-calendriers-ical/README.md).
- [v008-defilement-zones-fixes](../maquettes/v008-defilement-zones-fixes/README.md).
