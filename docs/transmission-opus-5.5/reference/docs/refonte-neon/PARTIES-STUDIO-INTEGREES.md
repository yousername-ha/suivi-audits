# Parties intéressées Studio — intégration et reprise IA

12 novembre 2026, Europe/Paris — suite du travail du 11 novembre. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Après les retours sur les liaisons et leur animation, « Continue » autorise la poursuite avec la dernière présentation examinée : **Parties intéressées, liaisons orthogonales et flux discret intégrés au code**, sur `codex/refonte-neon-main`. Les anciennes maquettes sont conservées. Ce lot ne déploie pas la nouvelle proposition responsive à tous les modules.

## Comportement livré

- Panorama par défaut : acteurs internes à gauche, externes à droite, périmètre au centre. Les natures absentes ou inconnues restent dans « Nature à préciser », sans liaison inventée.
- Au maximum deux sorties du cercle. Les rails partagés et branches passent dans des gouttières entre les cartes, sans traverser leurs textes. Le tracé est recalculé après redimensionnement, changement de contenu et chargement des polices.
- Au maximum deux points lumineux, un par nature, parcourent les branches. Les lignes et libellés restent fixes. Pause/reprise, suspension en arrière-plan et préférence de mouvement réduit respectées ; aucun avancement métier représenté.
- Icônes pour panorama/liste compacte, recherche, filtres, pause et registre détaillé. La recherche porte sur les champs textuels des fiches **chargées** et le responsable ; filtres nature, traitement, revue, catégorie et responsable. Réinitialisation visible. Le registre détaillé conserve les filtres URL, les commandes et l’historique des décisions antérieurs.
- Cartes et lignes ouvrables par clic ou clavier ; sélection de texte et touches modificatrices préservées, retour du focus à la fermeture. Les longues listes défilent dans leur zone ; les en-têtes de la liste restent visibles.
- Consultation distincte de la modification : besoins/attentes, exigences, prise en compte, suivi/responsabilité, puis liens/justificatifs et historique. « Modifier la fiche » ouvre le formulaire existant ; « Annuler » rétablit la lecture enregistrée. La fenêtre conserve une hauteur naturelle sans défilement imbriqué.
- Le panorama utilise la hauteur disponible sous les commandes. Les préférences de taille, la navigation et les couleurs globales ne sont pas remplacées. Sur un portable, la zone peut défiler pour conserver des cartes lisibles plutôt que les miniaturiser.

Les compteurs et filtres de la nouvelle présentation portent explicitement sur les fiches chargées. Les deux paginations existantes de 50 éléments, native et historique, sont accessibles. Aucun chargement silencieux de tout le registre : le bouton suivant et le total serveur restent visibles. Le repère de revue conserve le seuil existant de 365 jours, sans inventer une obligation de revue annuelle.

## Résumé technique pour une IA connaissant le dépôt

| Fichier | Modification et raison |
| --- | --- |
| `apps/web/src/pilotage/PartiesInteresseesStudio.tsx` | Nouveau composant React de présentation, filtres locaux et liste. `Panorama` mesure les éléments par `ResizeObserver`, nettoie ses abonnements et recalcule après `document.fonts.ready`. `Flux` utilise `requestAnimationFrame`, nettoie son animation au démontage et conserve sa position en pause. Réutilise `ficheCliquable` pour les interactions et le focus. |
| `apps/web/src/pilotage/parties-liaisons.ts` | Fonctions pures `liaisonsParties`, `parcoursParties`, `cheminPartie` : géométrie orthogonale et parcours continus uniquement décoratifs, sans relation persistée. |
| `apps/web/src/pilotage/PartiePresentation.tsx` | Vue de lecture ; reçoit les sources, responsables et révisions de `RecordEditor`, lit les relations via la route et la clé de cache existantes. Aucune mutation dans cette présentation. |
| `apps/web/src/pilotage/Registry.tsx` | Branche `stakeholder` branchée sur les objets des deux requêtes existantes, le droit d’écriture et les callbacks existants. Ajout du nom du périmètre et accès au registre détaillé. Pagination exposée à la nouvelle vue, erreurs conservées. Autres registres et fenêtre des décisions conservés. |
| `apps/web/src/pilotage/RecordEditor.tsx` | Le mécanisme lecture/édition du contexte couvre également `stakeholder`. Formulaire, droits, état fermé, POST/PUT, `If-Match`, `sourceSha`, extra et adaptateurs restent existants. |
| `apps/web/src/pages/Pilotage.tsx` | Transmission du nom du périmètre ; sélecteur plus court dans cette rubrique. Remplacement du seul ancien bandeau Parties par les compteurs du registre chargé pour inclure les fiches natives et respecter le périmètre sélectionné. PESTEL inchangé. |
| `packages/ui/src/neon-parties.css`, `neon.css` | Styles locaux des deux thèmes, rails, cartes, commandes, fiche et adaptation à la place disponible. Import dans le thème, conformément à la règle qui centralise couleurs et dimensions hors du code applicatif. |
| `packages/ui/src/theme.ts` | Extension `.ts` ajoutée à l’import de `focus-fiche` : le générateur CSS peut être exécuté directement par Node 26, sans chargeur de développement. Les artefacts compilés sont identiques à ceux de l’application testée. |
| `eslint.config.js` | Déclaration du contexte navigateur des cinq dossiers de maquettes récents, comme pour les précédents scripts autonomes. Aucune règle désactivée ; les anciens scripts qui déclarent déjà leurs globals restent hors de ces motifs. |
| `apps/web/test/parties-liaisons.test.ts` | Six cas de géométrie : deux colonnes, une rangée, une colonne, une seule nature, absence d’acteurs connus ; branches uniques, tracés hors cartes et parcours continus. |
| `tests/e2e/specs/parties-studio.spec.ts` | Trois parcours réels : consultation historique sans écriture, modification native versionnée avec conservation des champs, pagination/défilement avec 55 acteurs fictifs. |

Aucune route API, migration, dépendance, donnée de référence ni permission serveur modifiée. Les champs sont déjà normalisés par l’adaptateur historique (`type` → `nature`, `needs` → `expectations`, `req` → `requirements`, `how` → `treatment`, `reviewed` → `reviewedAt`). Aucune copie parallèle des données. L’ancienne fonction de synthèse du PESTEL est conservée dans son fichier mais n’est plus appelée par cette page.

## Contrôles réels

Instance Docker de recette avec données fictives, frontend compilé sur `http://localhost:5174`, Node 26.13.0 et Chromium système. Frontend remplacé dans **le seul conteneur de test existant**, sans changement de base, volume ni image publiée.

| Contrôle | Résultat final |
| --- | --- |
| Web | 34 fichiers, 271 tests réussis, dont les six nouveaux cas de géométrie |
| UI | 4 fichiers, 243 tests réussis |
| E2E ciblés | 6 réussis, un worker, zéro rejeu : trois Parties, contexte, lecture SWOT et lecture PESTEL |
| TypeScript | Web, UI et E2E : codes 0 |
| Compilation | Génération CSS par Node direct puis Vite du profil interfaces : codes 0 ; les neuf fichiers de la compilation finale sont identiques octet pour octet à ceux testés dans Docker |
| Qualité | Prettier complet et ESLint complet : codes 0 |
| Dispositions | 10 : 1024×768, 1280×800, 1366×768, 1920×1080, 2560×1440, dans les deux thèmes. Aucun débordement de page ni croisement des cartes, en-têtes ou textes du centre détecté |
| Compléments navigateur | Filtres externes seuls et rangée unique ; mouvement effectif avec lignes fixes, pause/reprise, mouvement réduit ; affichage lecteur simulé (sans création de rôle) |
| Accessibilité | 5 analyses Axe ciblées, sans violation détectée : panorama et consultation dans les deux thèmes, liste sur portable |
| Médias | Six captures natives, dont quatre à 3840×2160 ; vidéo 1588×672 de 16 s, décodée intégralement sans erreur |

Les premiers contrôles ont corrigé la hauteur de la scène et l’emplacement des styles dans le thème. Le test de recherche a été précisé avec un sélecteur de champ et une expression unique sans accents : « confidentialité » correspondait effectivement à deux fiches, car la recherche couvre aussi les exigences. Aucun contrôle d’application n’a été supprimé pour obtenir le passage. Le lint complet a révélé les globals de navigateur non déclarés dans les maquettes précédentes, puis une déclaration trop large : la liste de dossiers a été précisée, sans désactiver `no-undef` ou `no-redeclare`.

Le générateur CSS direct révélait également l’import ESM sans extension de `focus-fiche` ; l’extension explicite résout ce point. La compilation garde ses avertissements connus sur les bundles volumineux et la configuration Vite native future. Les erreurs d’amorçage des premiers E2E provenaient de l’absence de l’état de navigateur local : un état **vide** a été préparé pour le frontal interfaces qui fournit déjà sa session de démonstration ; aucune identité n’a été extraite.

[Reçu synthétique et empreintes](captures-parties/validation.json).

## Visuels intégrés

[Panorama clair HD](captures-parties/parties-light-hd.png) · [Panorama sombre HD](captures-parties/parties-dark-hd.png) · [Portable](captures-parties/parties-portable.png) · [Liste compacte](captures-parties/liste-portable.png) · [Fiche claire HD](captures-parties/fiche-light-hd.png) · [Fiche sombre HD](captures-parties/fiche-dark-hd.png) · [Vidéo réelle](captures-parties/parties-integrees-animees.mp4).

Captures réelles sans retouche. La vidéo est recadrée sur la dalle ; les thèmes sont ceux de l’application. Les rapports bruts et états de navigateur restent privés hors Git.

## Limites et prochaine action

La recette lecteur complémentaire simule les permissions renvoyées à l’interface ; les gardes serveur ne sont pas modifiées et leur recette multi-comptes n’est pas rejouée. La suite API, la suite E2E intégrale, Docker Desktop Windows, une nouvelle construction complète d’image, le déploiement et la CI distante ne sont pas exécutés. Aucun push. Les anciens ZIP restent inchangés : **ce lot est intégré aux sources et vérifié dans le conteneur de recette ; aucun nouveau ZIP n’a été demandé ou produit**.

Pour une reprise Claude, repartir de cette branche après le commit qui contient ce rapport. Prochaine étape : avis sur les captures intégrées puis proposition du prochain écran Organisation selon la règle visuel → validation → intégration/tests → captures réelles. Les nouvelles propositions transversales de commandes/responsive du 11 novembre restent distinctes ; ne pas les considérer comme toutes intégrées avec ce module.
