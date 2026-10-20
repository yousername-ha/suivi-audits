# 022 — Gestion visuelle des droits : dossier d’implémentation

Édition du 20 octobre 2026. **Périmètre approuvé pour transmission au codage**, sous contrôle préalable de l’existant. Référence de conception : [v001-acces-visuels](../maquettes/v001-acces-visuels/README.md). Aucun statut « implémenté » ni validation serveur revendiqué.

## Instruction obligatoire avant développement

Lire [Contrôle de l’existant et consignes de codage](../../_dossiers-transversaux/implementation-ui-2026-10/CONTROLE-EXISTANT-ET-CODAGE.md). Pour chaque exigence ci-dessous, vérifier la branche/SHA cible et renseigner preuve, état et écart. **Si c’est déjà implémenté et vérifié, conserver l’existant.** Ne coder que le manque ; aucune reconstruction sur la seule base d’une ancienne maquette ou documentation.

## Demandes, règle retenue et recette

Ces lignes consolident les remarques utilisateur applicables au périmètre. Les précisions d’intégrité, d’erreur et d’accessibilité complètent leur traduction technique. Les propositions non confirmées figurent dans les limites ci-dessous ; elles ne deviennent pas des règles normatives implicites.

| ID | Demande / sujet | Règle retenue pour l’intégration | Critère à vérifier sur la cible |
| --- | --- | --- | --- |
| 022-01 | Vue graphique simple sans fourre-tout | Sélection personne/groupe puis registre ; recherche, filtrage et pagination, informations ciblées. | Une organisation volumineuse ne produit pas une matrice illisible. |
| 022-02 | Ajuster visuellement les droits | Fenêtre centrale avec rôle, portée, avant/après, origine et confirmation ; montrer les héritages qui subsistent. | Rôle direct réduit ne masque pas des droits plus larges issus d’un groupe. |
| 022-03 | Collaborateur pour alimenter les éléments existants | Contribution bornée : commentaire, preuve autorisée, réalisation attribuée selon commande métier ; pas de création de registre/action/écart/série ni édition des attributs. | Tester les mutations interdites directement via API ; aucun contournement par requête manuelle. |
| 022-04 | Responsable distinct des habilitations | Personne/groupe/fonction responsable ne donne pas automatiquement des droits ; droits effectifs projetés par le serveur. | Changer un responsable ne modifie pas implicitement les rôles. |
| 022-05 | Traçabilité des changements et contributions | Auteur session, heure serveur, cible, motif, avant/après ; preuves et réalisations historiques conservées. | Révocation, conflit et double soumission n’altèrent pas l’historique. |
| 022-06 | Garde-fous administration | Préserver dernier administrateur, rôles système, restrictions d’auto-ajustement, concurrence et révocation. | Accès refusé et héritage expliqués, opérations protégées testées côté serveur. |

## UI/UX, composants et références

Conserver les états et visuels de la [maquette de référence](../maquettes/v001-acces-visuels/README.md) et les composants natifs déjà conformes. La règle commune de style 08 et de défilements s’applique ; ne pas recopier globalement les CSS de prototype. Prévoir chargement, vide, recherche sans résultat, refus d’accès, erreur réseau, conflit de version et confirmation lorsqu’une opération le nécessite. Contrôles et actions accessibles au clavier, focus explicite, légendes textuelles, écrans étroits et thèmes Sauge/Clair.

Documents complémentaires à lire :

- [SPECIFICATIONS-DROITS.md](SPECIFICATIONS-DROITS.md).

## Architecture et contrats à réutiliser

Lire `routes/access.ts`, `auth.ts`, `shared/src/permissions.ts`, `pages/AdminAccess.tsx`. Routes historiques constatées : admin/users, users/:id/rights, groups, roles, permissions, access-review. Le cumul des rôles directs/groupes existe dans le snapshot ; Collaborateur et contributions fines sont à recontrôler au SHA cible.

Annuaire, groupes, permissions effectives et contrôles serveur existants ; contrats des registres pour la portée.

Les modèles/réponses/API réels restent autoritaires. Identifier les composants, queries et mutations existants, conserver les IDs, versions et droits. Les fixtures ne remplacent pas les schémas partagés. Après mutation réussie, actualiser les vues liées sans création en double ; en erreur conserver les saisies. Toute migration doit préserver données et historiques et avoir une reprise documentée.

## Limites et décisions à expliciter

La demande interdit création et édition générale au Collaborateur. L’interface propose commentaire/preuve/réalisation attribuée ; vérifier ces commandes fines dans le backend. Ne jamais lui accorder modifier puis masquer les boutons. Toute contribution non couverte reste indisponible jusqu’au contrat nécessaire, en poursuivant les autres écrans.

Ces points sont à établir par le contrôle du code courant ou à signaler comme décision manquante. Ils n’autorisent ni invention de méthode normative, ni extension silencieuse des droits, ni annonce d’une capacité non vérifiée. Le code disponible chez Claude n’est consulté qu’en lecture seule ; toute adaptation autorisée se fait sur la branche propre de l’IA de codage.

## Ordre, recette et remise

1. Auditer chaque exigence et les dépendances ; rendre le relevé d’existant avant de modifier.
2. Conserver les comportements satisfaisants et réutiliser leurs composants. Adapter lecture/navigation, puis formulaires et commandes effectivement supportées, puis relations entre modules.
3. Exécuter les critères du tableau sur données synthétiques, les contrôles métier et permissions côté serveur, puis typage/build/lint/tests pertinents et non-régressions UI. Les résultats de [tests historiques](../tests/README.md) ne sont pas une preuve d’intégration actuelle.
4. Livrer branche/SHA, écarts traités, tests, visuels et limites ; utiliser le marqueur uniquement selon les consignes communes, après intégration réelle vérifiée.

[Prompt dédié](PROMPT-IMPLEMENTATION.md). Le classement « à implémenter » transmet ce dossier à l’IA ; il ne signifie pas que tout doit être recodé ni que la maquette contient déjà tous les services.
