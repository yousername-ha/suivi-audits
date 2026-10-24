# 024 — Parcours guidé ISO 27001 / HDS : dossier d’implémentation

Édition du 24 octobre 2026. Transmission demandée par l’utilisateur pour implémentation, référence de conception **v011**. Le dossier décrit l’expérience cible et ses contrats d’intégration ; il ne signifie pas que ces fonctions sont déjà intégrées au produit.

Références : [maquette fonctionnelle v011](../maquettes/v011-animations-visibles/README.md) · [aperçu public](https://astra-parcours-apercu.earlycedar65.chatgpt.site) · [correspondances et sources officielles](../../../fonctionnalites-en-developpement/_prototype-transversal/demarrage-parcours-v1/SOURCES.md) · [décisions et historique](README.md).

## 1. Objectif et limites

Intégrer dans ASTRA un parcours de travail visuel et consultable qui dirige vers les capacités déjà présentes de la plateforme pour préparer un SMSI ISO/IEC 27001:2022 et, selon le périmètre et les activités concernés, les compléments HDS. Le parcours est une autre porte d’entrée sur les objets existants ; il ne crée pas de registres métier parallèles.

Le parcours 024 est distinct du premier lancement 023 : 023 configure la plateforme après installation et création de l’administrateur ; 024 accompagne ensuite le travail SMSI. Les courbes de l’arbre regroupent des travaux et ne constituent ni une séquence normative obligatoire ni des verrous.

Le parcours n’est ni un moteur de certification, ni une déclaration automatique de conformité, ni une méthode Lead Implementer officiellement approuvée. Ne pas inventer d’exigences, d’attendus obligatoires, de seuils, d’échelles, de preuves suffisantes ou de délais. Le détail normatif exhaustif doit être rapproché du texte ISO applicable détenu sous licence et validé métier.

## 2. Décision et référence visuelle

La demande « Fais le dossier technique à implémenter » du 24 octobre 2026 fait passer la fonctionnalité au stade « à implémenter », sur la base de la maquette v011. Le site public de démonstration est la [version 8](https://astra-parcours-apercu.earlycedar65.chatgpt.site). Il contient des données fictives et n’est pas une intégration au backend.

Conserver la composition et le style de v011 : coque ASTRA vert profond / sauge, fond du canevas sombre, arbre Gondor fondu derrière ses éléments, branches colorées (menthe, jaune, bleu, violet HDS), icônes, libellés, racine, liste alternative et carte de détail. Le fond Gondor est décoratif et ne capte pas les interactions.

- Vue Arbre et vue Liste couvrent les mêmes étapes, identifiants et objets.
- Cliquer sur un cercle ouvre sa carte de détail ; le petit bouton distinct développe/replie les sous-actions. Une seule branche est développée à la fois. À l’ouverture, l’arbre écarte ses éléments sans cacher ni superposer les libellés.
- La carte compacte peut être fermée par sa croix, par clic sur le fond ou par Échap. La fiche détaillée s’ouvre dans une fenêtre centrale, ferme de la même manière et rend le focus à l’élément d’origine.
- La sélection du périmètre isole les données du périmètre choisi. Utiliser les sélecteurs et identifiants déjà définis par le produit.
- Le canevas défile indépendamment du menu et de la coque. Sur téléphone, l’arbre reste navigable sans écraser les cartes ou les contrôles.
- Le flux suit la courbe dans la couleur de la branche ; la brume remonte du bas vers le haut en nappes discrètes. Les animations ne transmettent aucun état métier. Le réglage de mouvement ne remplace pas le thème global de la plateforme.
- v011 active l’animation conformément à la demande et garde les options « Animées », « Automatiques » et « Arrêtées ». En production, ne pas recopier la clé localStorage de la maquette ni sa migration de préférence de démonstration ; réutiliser la préférence d’interface existante si elle existe et respecter les préférences d’accessibilité définies ici.

La v011 conserve 11 raccourcis graphiques, 16 étapes et 26 sous-actions ; cinq compléments HDS sont représentés dans le contenu du parcours. Garder leurs identifiants stables pendant le raccordement. Ne pas réutiliser les fixtures pour créer des identifiants ou objets serveur.

## 3. Couverture fonctionnelle à livrer

| ID | Comportement demandé | Règle d’intégration | Critère d’acceptation |
|---|---|---|---|
| 024-F01 | Parcourir l’arbre ou une liste complète | Les deux vues lisent le même catalogue de nœuds et le même contexte de périmètre. Les branches sont une aide de navigation, pas un ordre ISO imposé. | Chaque étape est accessible dans les deux vues ; aucun nœud n’est perdu ou compté deux fois. |
| 024-F02 | Déplier les sous-actions et consulter l’attendu | Les descriptions, icônes et attendus viennent du contenu validé et des sources documentées. Une animation de dépliage ne modifie aucun objet métier. | Déplier/replier au clavier et au tactile ; afficher l’attendu sans collision, conserver focus et état du périmètre. |
| 024-F03 | Rejoindre les modules depuis le parcours | Chaque nœud mène au module et à l’action existants, avec le même ID d’objet et le contexte autorisé. | Après une création confirmée, le même objet apparaît dans le registre/module ; aucun doublon ou faux succès. |
| 024-F04 | Répercuter les travaux faits dans les modules | Le parcours relit les données serveur et reflète les modifications effectuées directement dans les modules. | Une modification dans le module est visible dans l’arbre/liste après lecture ou invalidation appropriée ; pas de donnée périmée d’un autre périmètre. |
| 024-F05 | Retrouver les travaux déjà réalisés | À l’entrée, rechercher les objets existants pour le périmètre ; permettre une association explicite si plusieurs candidats existent. Ne pas faire recommencer un travail existant. | Un objet existant est réutilisé par ID ; ambiguïté et absence sont visibles ; aucun rapprochement arbitraire. |
| 024-F06 | Distinguer avancement, revue et conformité | Déduire l’état seulement d’un état métier réellement disponible. Une action terminée, une case cochée, un document présent ou un cercle animé n’établit pas la conformité. | Aucun statut de nœud ne recalcule ou n’écrit automatiquement la conformité, la SoA ou une certification. |
| 024-F07 | Lier des preuves et conserver leur historique | Réutiliser le registre de preuves et les versions, droits et auteurs qu’il expose. | Une preuve ouvre sa fiche canonique ; retrait ou remplacement conserve la trace du registre ; pas de preuve factice en production. |
| 024-F08 | Adapter le parcours au SMSI/périmètre | Utiliser l’entité et la hiérarchie existantes, les permissions et les règles d’héritage. | Changer de périmètre actualise les requêtes, cartes, états et liens ; aucun élément d’un périmètre précédent n’est exposé. |
| 024-F09 | Présenter les compléments HDS | Utiliser les activités/périmètres et décisions d’applicabilité réelles. Masquer la branche HDS est une préférence d’affichage seulement. | La branche HDS n’est ni appliquée automatiquement à toute organisation de santé, ni supprimée des données si masquée. Les travaux communs ISO/HDS ne sont pas dupliqués. |
| 024-F10 | Conserver l’expérience v011 | Reprendre les composants et tokens ASTRA existants, l’arbre Gondor discret, l’animation des branches, la brume ascendante et l’option Liste. | Responsive, navigation clavier, focus, labels, mouvement réduit, chargement, vide, erreur, accès refusé et conflit sont couverts. |

## 4. Carte de raccordement métier

Ce tableau indique la destination fonctionnelle à auditer, pas des routes supposées ni une prescription de nouvelle API. Pour chaque ligne, le relevé d’existant de l’agent de codage doit inscrire : composant/route actuelle, modèle ou contrat réellement trouvé, permission, test/preuve, état, écart et action.

| Branche / nœuds de l’arbre | Destination métier à rechercher | Invariant |
|---|---|---|
| Cadrer : contexte, gouvernance, périmètre, support, objectifs | Contexte, organisation/entités, SMSI et périmètres, objectifs et leurs revues | Utiliser les IDs et hiérarchies réels. Ne pas faire du parcours 023 un second écran d’onboarding. |
| Maîtriser : critères, risques, applicabilité, traitement, mise en œuvre | Registre/évaluation des risques, échelles de plateforme, Annexe A et SoA, plans/registres d’action | EBIOS RM n’est pas un passage obligatoire d’ISO 27001. Ne pas cloner un risque, une mesure ou un plan. |
| Évaluer et améliorer : indicateurs, audit, revue, amélioration | Indicateurs, audits, écarts/non-conformités, actions, revue de direction et décisions | Les états et contrôles viennent des modules ; clôture d’action ≠ vérification d’efficacité ≠ conformité. |
| Compléments HDS : activités, SMSI, contrats, souveraineté/garanties | Activités et périmètres HDS, exigences/version du référentiel, fournisseurs/contrats, garanties pertinentes | L’applicabilité dépend du périmètre et de la décision réelle ; ne pas la déduire du secteur de santé. |
| Traversal de toutes les branches | Registre de preuves, fichiers/version, permissions et journalisation | Une seule preuve canonique ; garder le lien, la version, l’auteur et l’historique du module source. |

Les regroupements graphiques et raccourcis proviennent de la maquette ; ils ne remplacent ni l’inventaire complet d’exigences ni la structure des modules métier.

## 5. Architecture et données

Le socle de référence audité est React/Mantine/TanStack Query côté web, Fastify/PostgreSQL côté serveur, schémas Zod et packages partagés `@suivi/shared` / `@suivi/ui`. **Vérifier au SHA de la branche de codage** avant d’importer ces conventions ; conserver l’architecture réellement présente.

- Monter le parcours sous la coque et le routeur canoniques du produit, dans la navigation pilotage existante. N’inventer ni nouveau shell, ni deuxième routeur, ni alias concurrent. La route exacte et son enregistrement sont à déduire du routeur courant.
- Réutiliser `apps/web/src/api.ts`, les services, queries/mutations, composants de `@suivi/ui`, la session et les primitives d’erreur disponibles. Ne recopier ni le HTML/CSS de la maquette ni ses données `localStorage` dans la production.
- Construire la vue par assemblage de données des modules, avec `scopeId/smsiId` uniquement si les noms exacts existent. Le choix effectif, les autorisations et la validation restent côté serveur. La réponse du module source demeure autoritaire.
- Conserver les IDs, versions/ETags et relations. Si le service utilise `If-Match`, envoyer la version attendue ; sur 412, garder la saisie et demander un rechargement/résolution. Ne jamais afficher un enregistrement réussi avant confirmation serveur.
- Invalider/rafraîchir les requêtes liées après une mutation confirmée. Annuler ou ignorer les réponses tardives lorsque le contexte de périmètre change. Ne pas partager un cache entre SMSI sans clé de contexte.
- L’état d’ouverture des sous-branches, de la carte et de l’onglet peut rester dans l’interface. Aucun modèle serveur « progression » ne doit être créé par défaut. Si l’audit prouve qu’un état de parcours manque et que la demande exige une trace persistante, documenter le contrat métier manquant avant de le concevoir ailleurs ; ne pas simuler un historique immuable avec le navigateur.
- Aucune migration de base de données ou nouvelle route API n’est prescrite par ce dossier. Le backend/contrat est hors du périmètre de préparation ; si une capacité manque dans la branche de codage, préciser l’API/champ/permission absent et poursuivre les parties frontend indépendantes.

## 6. Sources, sécurité et accessibilité

Les repères et correspondances sourcés sont consignés dans [SOURCES.md](../../../fonctionnalites-en-developpement/_prototype-transversal/demarrage-parcours-v1/SOURCES.md). Ils couvrent les fiches publiques ISO/IEC 27001:2022, Amd 1:2024, la note ISO/SC27 sur la SoA et le référentiel ANS HDS v2.0 (avril 2024). La présentation publique du guide ISO pour PME a été consultée ; son contenu payant ne l’a pas été. Respecter ces limites et les citations par nœud ; ne pas transposer ISO/IEC 27003:2017 comme guide de la version 2022.

- Garder les permissions des modules/API serveur ; masquer une commande dans l’interface ne constitue pas une autorisation.
- Gérer 401/403, erreurs réseau, 404, validation 422, conflit/version 412 selon les contrats constatés. Ne pas perdre les saisies en cas d’échec ; ne pas faire d’écriture optimiste qui laisse croire qu’une commande protégée a été autorisée.
- Échapper les chaînes configurables avec les mécanismes React ; aucun HTML de fixture injecté. Respecter CSP et ne pas importer de scripts inline issus du prototype.
- Utiliser le contrôle clavier, focus visible et retour de focus, labels/états ARIA, cibles tactiles, contraste, textes alternatifs. Préserver le mouvement réduit du système dans le mode automatique et offrir un arrêt explicite ; l’animation n’est jamais un retour d’état métier.
- Ne pas modifier la cartographie dynamique historique (routes, composants, styles ou calculs), même par une règle CSS globale.

## 7. Ordre de réalisation

1. Lire le prompt commun `fonctionnalites-en-developpement/_dossiers-transversaux/socle-astra/PROMPT-IMPLEMENTATION.md`, le contrôle et l’ordre communs dans `fonctionnalites-a-implementer/_dossiers-transversaux/implementation-ui-2026-10/`, puis ce dossier et les `README.md` de la maquette/source.
2. Sur **sa propre branche de codage**, vérifier si le parcours 024 ou une partie existe déjà et fonctionne. Compléter le relevé exigence → code/API/permission/test → état → écart → action. L’audit porte sur le 024 et ses dépendances directes uniquement ; ne pas reconstruire les modules ou relancer un audit global.
3. Cartographier les nœuds vers les contrats réels, les droits, la version des objets et les états. Si les contracts existants suffisent, passer à l’UI. Consigner précisément les inconnus et continuer les branches indépendantes.
4. Intégrer d’abord route/vue arbre-liste et contexte de périmètre ; ensuite détail et sous-actions ; ensuite navigation/mutations des modules réels et preuves ; enfin affichages HDS et états d’erreur. Réutiliser chaque module existant, sans copie.
5. Contrôler desktop et mobile, clavier/lecteur d’écran ciblé, mouvement réduit et rendu des données. Exécuter build, typecheck, lint et tests pertinents selon le diff, puis tests d’intégration réciproque, droits, erreurs, version/conflits et changement de périmètre.
6. Livrer branche/SHA, tableau d’audit initial et final, fichiers touchés, réutilisations, tests réellement exécutés, limites et éventuel backend manquant. Écrire `implementation/IMPLEMENTATION-OK.md` sur la branche de codage uniquement après intégration et recette réelle.

## 8. Recette fonctionnelle et technique

Reprendre les scénarios détaillés 024-INT-01 à 06 dans [règles de conception](README.md) et les critères 024-F01 à F10 ci-dessus. Au minimum :

1. Ouvrir chaque raccourci et étape exhaustive dans Arbre et Liste ; vérifier les mêmes identifiants, attendus, sources officielles, liens et états.
2. Déplier/replier au clavier et au tactile, changer de branche rapidement, vérifier aucune collision/découpe, focus, retour au clic parent et fonctionnement du mode réduit.
3. Sélectionner un périmètre, ouvrir des objets préexistants et revenir ; changer de périmètre pendant le chargement et vérifier qu’aucune donnée de l’ancien scope ne reste.
4. Depuis le parcours, ouvrir une création/modification existante et vérifier l’objet enregistré dans le registre cible. Depuis ce registre, modifier le même objet et vérifier la mise à jour du parcours, sans double création.
5. Tester association de preuve réelle par ID/version, fermeture et reprise, absence de preuve et refus 403 ; vérifier qu’aucune fixture n’est proposée comme preuve de production.
6. Tester les réponses d’erreur/permission et conflits de version ; aucun faux succès, perte de saisie ou revue historique écrasée.
7. Vérifier HDS visible/masqué, activité/périmètre non concerné, facteurs d’applicabilité réels, et absence de changement de données au masquage.
8. Confirmer qu’une case, un statut « revu » ou une action close ne change ni conformité ni SoA automatiquement ; aucune régression de la cartographie dynamique.

Les recettes antérieures de maquette dans `tests/README.md` sont historiques, pas une preuve d’intégration actuelle. Aucun test backend ou téléphone physique n’est revendiqué pour la version de maquette v011.

## 9. Éléments à vérifier sur la branche de codage

Les routes exactes par nœud, contrats de lecture/écriture, permissions fines de revue, mapping des types d’entité, état persistant de progression et couverture complète des exigences ISO sous licence ne sont pas figés ici. Le codeur doit les rechercher dans sa branche. Si un contrat manque, ne pas inventer route ou modèle : indiquer l’écart au responsable métier/backend et livrer les adaptations indépendantes.
