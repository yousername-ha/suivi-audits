# Consignes de codage — contrôle de l’existant obligatoire

Édition du 20 octobre 2026. L’utilisateur a approuvé la préparation des dossiers 020, 010, 019, 012, 022, 017, 021, 018, 002 et 003 avec cette condition : **« L’IA qui code devra vérifier juste que c’est pas déjà implémenté. »** Le 010 a depuis été explicitement inclus ; ordre actualisé le 21 octobre 2026. Les dossiers sont une livraison documentaire ; aucun module n’est déclaré intégré par ce classement.

## 1. Avant toute modification : vérifier la branche cible

Travailler exclusivement sur ta propre branche dédiée et dans ton propre espace. `legacy` est une référence en lecture. Claude est strictement en lecture seule : aucun changement de fichier, branche, index, référence, configuration, test/build générant des fichiers, pull, stash, reset, clean, merge ou rebase chez Claude. Ni fusion globale, ni déploiement, ni modification de la cartographie dynamique protégée.

1. Relever branche et SHA de la cible, état Git et changements locaux ; ne rien écraser.
2. Lire le dossier de la fonctionnalité, ses exigences identifiées et les règles communes. Rechercher les implémentations équivalentes sous d’autres noms : routes, composants, services, modèles, migrations, permissions et tests. Un fichier Markdown ou un bouton n’est pas une preuve de fonctionnement.
3. Pour **chaque exigence**, produire un tableau dans ton bilan d’intégration : ID de l’exigence ; état (implémentée et vérifiée / présente non validée / partielle / absente / indéterminée) ; chemin/symbole/API et SHA ; preuve ou test exécuté ; écart exact ; action retenue.
4. Si la fonction est déjà conforme, la conserver et ne pas la réécrire. Si elle existe mais n’est pas validée, exécuter d’abord un contrôle ciblé dans ton espace. Si elle est partielle, adapter uniquement le manque. Créer un composant/service uniquement après avoir établi son absence et vérifié le périmètre autorisé.
5. Si tout le périmètre existe et passe les contrôles, livrer un bilan de conformité **sans changement de code inutile**. Si l’accès manque, classer indéterminé et expliquer le blocage ; ne pas conclure absent. Une CI ancienne ne valide pas le SHA actuel.

Ce contrôle s’applique à tous les dossiers, particulièrement 020 et 019 cités explicitement par l’utilisateur. Il s’effectue dans la branche de codage réelle, pas seulement dans le snapshot Claude `284cb1e` ou l’audit historique `d044eb9`.

## 2. Priorité des exigences et couverture des remarques

Les dernières consignes utilisateur prévalent. Lire le tableau « Demandes, règle retenue et recette » de chaque DOSSIER-IMPLEMENTATION.md ; les variantes historiques restent des preuves de conception, pas des règles concurrentes. Le dossier spécifique et les règles communes actuelles remplacent les prescriptions anciennes explicitement corrigées. Les variantes choisies par Codex et non confirmées sont indiquées comme propositions, jamais comme obligations normatives.

Conserver ces invariants transversaux :

- Registres d’actions, d’écarts et de récurrences → un ou plusieurs périmètres ; leurs éléments héritent. Aucun sélecteur indépendant ni copie divergente sur l’élément. Le registre n’accorde pas automatiquement accès à toutes ses données ; serveur autoritaire.
- Référentiels centraux : ISO/IEC 27001:2022 (dont Annexe A), HDS et ISO 9001 selon applicabilité réelle. Ne pas fusionner leurs exigences ou déclarer conforme sur la seule présence d’un lien/action/preuve.
- Objet, évaluation, décision et preuve/version restent distincts. Historique conservé : acteur session, heure serveur, versions et contexte de réalisation. Changement d’affectation, de périmètre, de configuration ou d’action ne réécrit pas une validation passée.
- Utiliser le design system existant : style 08, vert profond, sauge clair, accents turquoise/bleu, icônes colorées et deux thèmes globaux. Les CSS de maquette sont des références visuelles, pas un deuxième design system à copier en production.
- Panneaux de saisie centraux, compacts et à contours visibles ; menu/en-tête fixes et contenu défilant, listes/timelines bornées, intitulés fixes. Couleurs doublées de libellés, clavier, focus, mobile et mouvement réduit.
- Les preuves restent dans le registre central avec droits/version ; référence plutôt que copie. Ne pas exposer secrets, documents réels, tokens ou URL de Workflow dans captures, logs ou notifications.
- Les modèles fictifs/localStorage n’ont aucune valeur de contrat serveur ou d’immutabilité. Les échelles ARM et cas ANSSI ne deviennent pas des données de production.

## 3. Ordre de réalisation selon les dépendances

Suivre l’[ordre unique des dix dossiers — L0 à L11](ORDRE-IMPLEMENTATION.md). Il remplace les anciennes séquences L0–L8 et précise les prérequis, les travaux indépendants et les conditions de passage. Les numéros de fonctionnalités restent stables ; ils ne définissent pas leur ordre de codage.

## 4. Données, erreurs et contrôles

Conserver les identifiants canoniques et utiliser les clients de données/cache existants. Les filtres et vues partagent objets et mutations ; appliquer invalidation après succès, refus 401/403, conflit 409/412, validation 422, indisponibilité, état vide et pagination. Ne pas annoncer une sauvegarde avant réponse serveur ni perdre le brouillon sur erreur. Réexaminer droits et dépendances au moment des mutations. Contrôles d’accès côté serveur ; masquer un bouton ne suffit pas.

Avant migration : inventorier données et usages, produire une prévisualisation et traiter les divergences explicitement. Aucun effacement/cascade ou recalcul automatique des historiques. Tester transaction, reprise et retour arrière dans l’environnement de codage. Les capacités existantes non représentées par la maquette restent accessibles et leurs attributs conservés.

Pour chaque incrément, exécuter les contrôles pertinents : typage/build/lint selon les scripts réels, tests des services touchés, parcours UI positifs/négatifs, permissions, conflits et doublons, clavier/mobile et thèmes. Les rapports de prototypes sont datés et limités : ne pas les attribuer à l’application intégrée ni à un autre SHA.

## 5. Livraison et marqueur

Fournir le bilan d’existant par exigence, changements ou absence justifiée de changement, branche/SHA, tests réellement exécutés, captures pertinentes et points ouverts. Pas de ZIP/BAT sans demande. Publier uniquement dans ta branche ; aucune fusion/déploiement automatique.

Lorsque la fonctionnalité et la version visée sont effectivement implémentées et vérifiées, ajouter dans **ta branche** `implementation/IMPLEMENTATION-OK.md` (ou marqueur littéral « implémentation ok »). Indiquer numéro, version, périmètre couvert, SHA, tests et limitations. Si une partie manque, écrire un bilan partiel et ne pas faire passer ce marqueur pour une livraison complète. Codex lira le marqueur en lecture seule puis gérera le déplacement vers « implémentées » sur legacy. Le présent dossier ne crée aucun marqueur.
