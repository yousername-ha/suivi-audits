# Processus Studio et cercle Parties — intégration

12 novembre 2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Après « Continue », intégration des deux aperçus présentés au commit `8289ff9`, sur la branche isolée `codex/refonte-neon-main`. Le dernier code applicatif avant ce lot était `81ea06a`. **Le centrage et Processus Studio sont portés dans l’application réelle** ; une seule capture est livrée, conformément à la demande précédente. Aucun nouveau ZIP ni nouvelle vidéo.

## Comportement

Les en-têtes des acteurs et leurs cartes occupent deux rangées distinctes. Le cercle Parties est aligné sur la rangée des cartes, dans la colonne centrale ; sa légende est indépendante et bornée à cette colonne. Les rails, branches, deux points animés, pause et réduction du mouvement restent existants. Aucun décalage vertical fixe ne remplace le centrage par la grille.

Organisation → Processus affiche les cartes regroupées par types, leurs pilotes et les cinq catégories de rattachements. Le + centré déplie la finalité et les sous-processus ; le corps entier ouvre la consultation, au clic ou au clavier. Cartes par défaut, liste compacte et critères recherche/type/pilote/rattachement accessibles par des icônes. Les résultats défilent dans leur zone, sans allonger toute la page.

La consultation présente l’identité, la finalité et les rattachements par catégorie. Leurs origines restent visibles. Les catégories inaccessibles sont distinguées des listes vides, également dans les compteurs et filtres. « Modifier le processus » ouvre le formulaire existant, avec ses commandes de rattachement/détachement. Annuler revient à la lecture enregistrée ; une sauvegarde réussie y revient après actualisation des données ; une erreur conserve la saisie dans le formulaire.

Un enfant trouvé par les filtres reste visible même si son parent est hors critères. Les types archivés, absents ou inconnus gardent leur libellé ou code. Le choix d’un parent exclut tous les descendants. Les légendes de groupe utilisent un identifiant de présentation sûr, y compris lorsque le code contient des espaces. Les préférences de taille restent appliquées ; le badge du seul profil Docker interfaces peut se replier sur plusieurs lignes à 150 %.

## Résumé technique pour une IA connaissant le code

| Fichier | Changement et contrat conservé |
| --- | --- |
| `apps/web/src/processus/CartesProcessus.tsx` | Conserve la requête `CARTES_PROCESSUS_KEY(smsi)`, le registre des types et la sélection/création ; branche la nouvelle présentation et distingue consultation/édition. Fermer une fenêtre démontée rend explicitement le focus par le gestionnaire commun. |
| `ProcessusStudio.tsx` | Nouveau composant de lecture des données agrégées réelles : cartes, liste, filtres et puces actives, dépliage, compteurs, animations et défilement local. Réutilise `ficheCliquable` et la rétention du focus. Aucune requête ou mutation métier propre à ce composant. |
| `ProcessusPresentation.tsx`, `ProcessusIcone.tsx` | Fiche de consultation sans champ ni commande d’écriture, catégories et origines `via`, lien vers les objectifs par processus ; pictogrammes SVG locaux sans dépendance ajoutée. |
| `processus-presentation.ts` | Fonctions pures `filtrerProcessus`, `regrouperProcessus`, `parentsPossibles`. Corrige l’enfant masqué par le filtre du parent, garde les types non actifs et respecte les catégories nulles. |
| `FicheCarteProcessus.tsx` | Formulaire, PATCH, POST/DELETE des relations et invalidations existants. Ajoute les callbacks optionnels `onCancel`/`onSaved` pour revenir à la lecture, plus le filtrage des parents descendants. Les commandes de rattachement/détachement gardent leurs règles d’origine et leurs droits. |
| `apps/web/src/pilotage/PartiesInteresseesStudio.tsx` | Regroupe les textes sous le cercle dans `.pi-hub-caption` ; mesures SVG et flux React existants conservés. |
| `packages/ui/src/neon-parties.css` | Porte la grille du centrage validé et les variantes internes/externes/nature inconnue, avec une légende qui ne participe plus au centrage. |
| `packages/ui/src/neon-processus.css`, `neon.css` | Styles locaux des deux thèmes, types du registre, dimensions relatives, adaptation à la largeur disponible, fenêtre à hauteur naturelle et mise en page dans la hauteur de l’écran. |
| `apps/web/src/pages/Pilotage.tsx` | Transmet le nom réel du périmètre et compacte le sélecteur de cette seule rubrique, comme pour Parties. La garde `smsi === SOCLE` de Processus est conservée. |
| `apps/web/src/components/Layout.tsx`, `neon.css` | Ajoute une classe au seul badge du profil interfaces pour permettre son retour à la ligne à 150 %. Session, authentification normale et déconnexion inchangées. |
| `packages/ui/src/focus-fiche.ts` | Un dialogue en cours d’entrée à opacité zéro compte encore comme une fenêtre ouverte : l’ancienne fenêtre ne consomme plus le déclencheur partagé pendant la transition consultation/édition. Retour après retrait du dernier dialogue. |
| Tests | Huit cas purs de présentation, trois cas du gestionnaire de focus, deux E2E Processus Studio ; ancien scénario cartes/rattachements adapté à la consultation préalable et aux sélecteurs de la nouvelle présentation, assertions métier conservées. |

Les fichiers Processus sans chemin complet ci-dessus sont sous `apps/web/src/processus/`. Les styles sont centralisés dans `packages/ui`, pas dans les composants applicatifs ni dans des styles en ligne.

La lecture reste `GET /api/grc/:smsi/pilotage/processus-cartes`. L’édition reste `PATCH /pilotage/objectifs/processes/:id`, les objectifs sont rattachés via leur liste `processes`, les autres catégories via les liens transverses existants. Les détachements issus d’une fiche ou d’un objectif gardent leurs restrictions. Aucune copie parallèle, route, migration, politique de droits, source de référence ou dépendance créée. Aucun score de conformité, relation entre processus ou avancement inventé.

## Environnement et limites

Node 26.13.0, Chromium système, conteneur Docker de recette existant `neon-interface-compilee-api-1`, frontend compilé sur le port local 5174 et données exclusivement fictives. Les contrôles de création/édition utilisent uniquement cette instance de recette. Les réponses de permissions et de type personnalisé sont simulées dans des contrôles complémentaires de l’interface, pas dans la base.

Le frontend compilé est copié dans le seul conteneur de recette existant. Aucune nouvelle image reconstruite, base renommée, migration exécutée ou donnée réelle utilisée. Le mode sans connexion reste réservé au profil interfaces. **Suite API, suite E2E intégrale, CI distante, Docker Desktop Windows et reconstruction complète d’image non exécutés. Aucun push ni déploiement.** Les anciens ZIP restent inchangés.

Les rapports bruts restent privés hors Git ; le reçu de livraison ne contient que les résultats synthétiques et l’empreinte de la capture.

## Vérifications et capture

| Contrôle | Résultat final |
| --- | --- |
| Web | 35 fichiers, 279 tests réussis, dont huit nouveaux cas de filtrage/hiérarchie |
| UI | 5 fichiers, 246 tests réussis, dont trois nouveaux cas de retour du focus |
| E2E ciblés | Six réussis, un worker, zéro rejeu : lecture Parties, lecture PESTEL, deux Processus Studio, lecture SWOT, création/sous-processus/rattachement et détachement d’objectif/cartographie |
| Stabilité du focus | Trois passages consécutifs réussis du parcours consultation → modification → annulation → fermeture, avant la recette finale |
| TypeScript | Web, UI et E2E : codes 0 |
| Qualité | ESLint complet, Prettier complet et contrôle du diff : codes 0 |
| Compilation | Générateur CSS Node 26 puis Vite interfaces : codes 0 ; avertissements connus sur la taille des bundles et la future configuration native Vite |
| Dimensions | Huit fenêtres Processus dans les deux thèmes, 1024×768 à 2560×1440 : aucun débordement de page détecté ; défilement local conservé |
| Centrage | Huit mesures Parties dans les deux thèmes : écart vertical de 0 px CSS, écart horizontal de 0 à 0,008 px ; aucune branche traversant cartes, en-têtes ou légende détectée |
| Accessibilité | Quatre analyses Axe ciblées sur les cartes et la consultation, dans les deux thèmes, sans violation détectée |
| Compléments | Taille 150 % avec titres à 25,5 px et sans débordement horizontal ; lecteur et catégorie inaccessible simulés ; type personnalisé archivé avec espaces, teinte orange et intitulé long lisible |
| Médias | Une capture native sombre de 3840×2160 px, sans retouche ; aucun autre visuel créé pour cette livraison |

Les premiers contrôles ont révélé le débordement du badge de test à 150 % et deux chemins de retour du focus. Le démontage de la fenêtre Processus nécessite son retour explicite ; le passage lecture/édition ne doit pas consommer le déclencheur pendant l’entrée à opacité zéro d’une nouvelle fenêtre. Les corrections et leurs tests sont conservés ; les assertions au clavier n’ont pas été supprimées ni affaiblies. Le passage final des six E2E est réussi en une seule exécution, sans rejeu automatique.

La vérification géométrique/visuelle n’a émis aucune mutation métier ; les préférences de thème du compte fictif sont enregistrées séparément. Les fixtures créées par les scénarios métier restent dans la seule instance de recette et expliquent le nombre de processus affiché sur la capture finale. Les six processus de démonstration et leurs rattachements existants n’ont pas été réécrits pour obtenir ce visuel.

[Capture intégrée unique](captures-processus/processus-studio-sombre-hd.png) · [Reçu synthétique](captures-processus/validation.json).

Prochaine étape : retour sur la capture intégrée puis proposition du prochain écran Organisation, **Rôles et responsabilités**, selon la règle habituelle. La refonte responsive générale et les autres maquettes restent distinctes de ce lot.
