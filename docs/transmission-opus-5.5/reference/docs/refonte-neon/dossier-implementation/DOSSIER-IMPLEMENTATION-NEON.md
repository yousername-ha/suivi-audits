# Charte Neon — spécification d’implémentation

Référence figée au 09/11/2026 : application `65bd22f`, captures et comptes rendus `c11277f`. Cette charte consolide les choix déjà validés, dans leur ordre d’évolution.

## 1. Objectif et périmètre

Donner à Suivi des audits une présentation professionnelle, analytique et légèrement futuriste, adaptée à la lecture en audit. La lisibilité des informations, les états et la hiérarchie passent avant les effets décoratifs.

La refonte est graphique. Elle conserve les fonctionnalités, les calculs, les valeurs mesurées, les sources, les formulaires, les sauvegardes, les versions, les droits et les API. Le graphique généré du RETEX est explicitement exclu des transformations graphiques demandées ; l’habillage de sa fenêtre peut reprendre les règles communes.

Le socle reste React, Mantine et `packages/ui`. Les textes métier et les données de démonstration des prototypes ne deviennent pas des données applicatives.

## 2. Direction visuelle retenue

Deux traitements coexistent dans la dernière version validée.

| Usage | Traitement de référence |
| --- | --- |
| Présentation du Contexte et cadre commun historique des fenêtres | Biseau : angles coupés, contour violet/cyan net, accents géométriques et pictogrammes animés. |
| DdA, périmètres compacts, objectifs et référentiels récents | Studio : surfaces opaques, angles arrondis, ombres courtes, contours visibles et icônes légèrement en relief. |
| Dashboard | Composition analytique issue des images et du HTML fournis : dalles graphiques, anneaux, barres, courbes et détails consultables. |

L’évolution vers Studio ne supprime pas le Biseau validé du Contexte. Le Biseau ne doit pas non plus remplacer indistinctement les cartes arrondies des derniers lots approuvés.

### Thème clair

Fond clair légèrement lavande, surfaces blanches opaques et panneaux secondaires teintés. Texte encre, contours identifiables et relief discret. La navigation des pages Studio conserve son indigo foncé. Le contenu principal reste plus lumineux que le menu.

Les retours « trop blanc », « trop transparent » et « trop gris » conduisent à éviter les surfaces qui se confondent, le verre dépoli dominant et les fonds gris uniformes. La piste vert sauge a été explorée puis abandonnée ; elle n’est pas la charte finale.

### Thème sombre

Fond bleu nuit, cartes marine, texte clair et accents de couleur. Conserver les mêmes libellés, valeurs, regroupements et possibilités d’action qu’en clair. Les couleurs de texte et de bordure possèdent leurs variantes sombres ; une simple inversion des couleurs est insuffisante.

### Usage des accents

Le violet indique principalement l’action, la sélection ou la cible d’un indicateur. Les autres accents se répartissent entre vert/menthe, orange/ambre, cyan et bleu selon leur rôle. Les états métier conservent leur signification : vert favorable, orange partiel ou à préciser, rouge défavorable ou en alerte, neutre pour une donnée absente.

La demande « pas de rose, que du rouge » concerne les états de la DdA. La signature historique de marque peut encore contenir du rose dans le logo ou un dégradé décoratif global ; cela n’autorise pas un état DdA rose.

Limiter le halo et le flou. Le contour, le remplissage et la séparation des lignes doivent suffire à identifier les éléments au repos. Les effets néon servent d’accent et d’avertissement, sans réduire le contraste du texte.

## 3. Typographie, densité et chiffres

La police de référence est **Inter**, chargée localement avec ses replis système. Les titres utilisent généralement une graisse 650 ; les libellés sont plus discrets, les valeurs importantes plus affirmées. Les intitulés restent des textes de lecture, avec une couleur neutre et sans soulignement décoratif.

Une commande reste identifiable par son bouton, son contour ou son pictogramme. Les liens documentaires restent reconnaissables et accessibles ; le refus de l’aspect « hyperlien » sur les dalles ne justifie pas de supprimer tous les repères des liens réels.

Les chiffres comparables utilisent les chiffres tabulaires. Aligner les libellés, les nombres, les unités et les noms de colonnes. La couleur d’un chiffre reflète son état réel, avec un libellé ou un symbole complémentaire.

Les unités `rem` suivent la racine responsive existante. Une dimension observée à 1 440 px ne devient pas une taille fixe universelle. Les titres longs, traductions et données détaillées doivent pouvoir augmenter la hauteur d’un bloc.

Les valeurs exactes se trouvent dans `tokens.ts` et dans les feuilles de module. L’inventaire JSON joint donne les sélecteurs et variables d’origine ; il ne remplace pas leur cascade CSS.

| Famille de dimensions du socle | Valeurs existantes |
| --- | --- |
| Rayons | 6, 8, 10, 14 et 18 px ; les panneaux Studio disposent aussi de valeurs locales en rem. |
| Espacements | 0,25 ; 0,5 ; 0,75 ; 1 ; 1,5 ; 2 et 3 rem. |
| Points de rupture du thème | 36, 48, 64, 90, 120 et 160 em. |
| Largeurs de contrôle récurrentes | 390 px pour téléphone ; 1 024 et 1 440 px pour adaptation ; 1 920 px et rendus HD de 3 840 px. |

## 4. Surfaces, fenêtres et défilement

Les dalles, panneaux de lecture et corps de fenêtre prennent la hauteur de leur contenu. Une barre verticale à l’intérieur d’une dalle Périmètre ou d’un panneau d’exigences est un défaut de mise en page.

Une fiche longue défile dans le voile extérieur de la modale, au bord de l’écran. Le titre, les onglets et les actions de fin restent atteignables. La fenêtre conserve son centrage horizontal ; lorsqu’elle est trop haute, son début reste accessible en haut de l’écran.

Les listes déroulantes, champs multiligne et zones de navigation d’un graphe ou tableau large gardent leurs interactions existantes. Cette exception ne permet pas de réintroduire un second ascenseur vertical dans le corps d’une fiche ou d’une dalle.

Conserver les focus visibles, Échap, les noms accessibles des commandes, les zones réellement cliquables et les gardes en lecture seule. Les décorations ne capturent pas les clics et sont masquées aux lecteurs d’écran.

Lorsqu’un tableau passe de `overflow: auto` à une hauteur naturelle, retirer également sa limite `max-height`. Sur mobile, vérifier la largeur effective des colonnes, même quand aucun débordement de page n’est détecté : une colonne de largeur nulle peut allonger artificiellement chaque ligne.

## 5. Contexte : présentation destinée à l’auditeur

Le bouton **Afficher** ouvre une fiche de lecture distincte du formulaire de modification. Les métadonnées utiles, l’organisation et les activités restent identifiables. Les onglets Liens et justificatifs et Historique restent consultables.

Le contenu différencie explicitement quatre catégories : **Interfaces**, **Dépendances**, **Enjeux internes** et **Enjeux externes**. Chaque catégorie dispose d’un titre, d’une zone et d’un repère propres. Les puces et séparateurs forment un système cohérent entre les catégories. Les exclusions et leur justification restent visibles.

Les catégories proviennent des titres ou préfixes explicites des textes enregistrés. Les informations non classées apparaissent dans **À préciser**. Le système ne déduit pas une catégorie à partir du sens d’une phrase et ne réécrit pas les données à l’ouverture. Une catégorie vide indique son absence de renseignement.

Conserver le cadre Biseau et les cinq pictogrammes validés. Les éléments internes du bâtiment, de la cible, des connexions, de la boussole et de la sortie bougent sans déplacer les textes. L’activation initiale dure 3,2 secondes ; le survol relance ou prolonge le mouvement selon les règles existantes. Le mouvement réduit désactive les animations.

Modifier reste soumis aux droits et ouvre l’éditeur existant. Annuler, Enregistrer, Agrandir/Réduire et la création d’une nouvelle fiche conservent leur comportement. La création ouvre le formulaire, tandis qu’une fiche Contexte existante s’ouvre en présentation.

Référence : [catégories et captures finales](../CONTEXTE-CATEGORIES.md), [Biseau et animations](../CADRES-NEON.md).

## 6. Périmètres : graphe compact et centré

La vue **Graphe** s’ouvre par défaut. Les cartes sont repliées et affichent les informations importantes, leurs compteurs disponibles et leur état. Le graphe entier est centré ; le centrage ne porte pas seulement sur la première carte.

Le **+ est centré en bas de chaque carte**. Il devient un − au même emplacement. Chaque carte se déplie indépendamment et s’élargit en rectangle sur ordinateur : largeur de référence 260 px repliée et 620 px ouverte. La hauteur reste naturelle ; les hauteurs mesurées dépendent des informations réellement présentes.

Les détails se répartissent en trois zones : couverture, activité/continuité, écarts/actions. Les cartes voisines, niveaux, fournisseurs et liaisons se repositionnent à partir des largeurs et hauteurs mesurées. Conserver le calcul de disposition et `ResizeObserver` ; ne pas remplacer ces mesures par une hauteur constante issue d’une capture.

La commande Centrer revient au centre du graphe et Tout replier conserve les commandes existantes. Le mobile réorganise les zones selon sa largeur disponible. Les compteurs interdits à la personne restent indisponibles ; un tiret ou une information indisponible ne devient pas zéro.

Référence : [périmètres horizontaux intégrés](../HORIZONTAL-STUDIO-INTEGRE.md).

## 7. Objectifs et indicateurs

L’entrée principale ouvre **la Vue compacte par défaut**, regroupée par objectif. Les quatre vues, filtres, processus, responsables, échéances, historiques et boîtes de pilotage restent disponibles. L’entrée Objectifs par processus conserve sa vue spécifique.

Les trois familles **Cible à atteindre**, **Valeur mesurée** et **État** forment un ensemble aligné. Les titres de colonnes sont visibles et centrés au-dessus des valeurs. La cible reste violette et suffisamment contrastée ; la valeur mesurée et l’état utilisent des blocs remplis cohérents.

La version B validée réduit les blocs, sans agrandir les titres d’objectifs. Son principe de proportion est conservé dans Studio : éviter des pavés colorés qui dominent l’intitulé. Les anciennes dimensions détaillées 132 × 82 px à 1 440 px restent une mesure du lot B, pas une contrainte imposée à toutes les vues ou au tableau Studio actuel.

**Non atteint est conservé et animé**, avec contour rouge plus marqué et pictogramme d’avertissement. Les flèches de tendance sont également conservées et animées. Le demandeur a précisé « Les animer », et non leur suppression.

Les flèches existantes décrivent l’évolution numérique brute : hausse verte et baisse rouge. La couleur de la valeur et l’état d’atteinte proviennent de sa comparaison avec la cible et son opérateur. Une baisse peut donc améliorer un indicateur dont la cible est un maximum ; la refonte ne modifie pas cette règle.

Les états Non mesuré et Cible à définir restent distincts. Pause/Activer les animations et la préférence de mouvement réduit neutralisent les mouvements sans supprimer la couleur et le pictogramme d’avertissement.

Références : [version B](../OBJECTIFS-VERSION-B.md), [défaut compact](../OBJECTIFS-VUE-COMPACTE.md), [habillage Studio final](../HORIZONTAL-STUDIO-INTEGRE.md).

## 8. DdA : dalles de synthèse et registre en lignes

Conserver les quatre dalles de synthèse au-dessus du registre : niveau Total, répartition, applicabilité et vigilance. Leurs chiffres viennent des données existantes et de `statsDda` ; ils ne constituent pas un score de certification.

Les nombreuses mesures restent **en lignes**, avec code, intitulé, Applicabilité, Mise en œuvre, actions/justification, documents et écarts. La séparation et la teinte des lignes donnent le relief ; le tableau ne reprend pas la présentation des essais rejetés de type Excel ou Bootstrap.

Les contrôles Applicable et Mise en œuvre sont remplis et lisibles au repos. Oui/Non se différencient visuellement. Total, Partiel et Insuffisant conservent leurs couleurs vert, orange et rouge ; les absences de renseignement restent distinctes. Les textes et bordures complètent les couleurs.

Les petits chevrons décoratifs ont été retirés des deux sélecteurs. Cliquer sur le contrôle ouvre son menu ; clavier, effacement, options, messages d’erreur et état désactivé restent disponibles. Les clauses ISO conservent leurs restrictions.

Le thème final est blanc/lavande avec relief discret en clair, marine en sombre. Les tons des états sont soutenus et opaques ; la lueur reste faible. Les dégradés turquoise/orange des anciens essais ne doivent pas remplacer les remplissages de la dernière version approuvée.

La fiche conserve tous les champs, textes de référence, documents, commentaires, risques, justifications, actions, erreurs et marqueurs existants. Elle reprend le style du registre et le défilement extérieur.

Référence : [DdA Studio intégrée](../DDA-STUDIO-INTEGREE.md).

## 9. Référentiels et bibliothèque

Le catalogue affiche les publications réellement présentes dans le périmètre. Les dalles indiquent le nom, le nombre d’exigences, la source, l’activation et les versions utiles. La sélection donne accès au registre en lignes : code, intitulé et domaine, avec chargement des lignes supplémentaires existant.

La fiche **Source et publication** distingue l’édition du document source, la version de fiche et la dernière version publiée. Les métadonnées absentes sont signalées. Une source non vérifiée garde son statut ; l’interface n’invente ni édition officielle ni vérification.

La bibliothèque partagée reste distincte des publications locales. Ses cartes montrent version, exigences, rattachements et provenance. Les versions sources restent verrouillées ; les copies de l’organisation restent personnalisables selon les droits. Import, simulation, confirmation, promotion, copie et nouvelle édition utilisent les parcours existants.

Le socle historique et le kit IA sont repliables. Leurs recherches, consultations et commandes restent accessibles. L’absence de publication locale renvoie vers la bibliothèque, sans créer artificiellement les trois publications de la maquette.

Les huit rubriques de navigation sont conservées. Les six autres écrans de cette famille n’ont pas été intégralement redessinés par ce lot.

Référence : [référentiels intégrés et limite API connue](../REFERENTIELS-INTEGRES.md).

## 10. Dashboard et graphiques

Le Dashboard et le prototype fourni sont la référence analytique initiale : douze compositions graphiques, recherche de cartes, filtre de référentiel, détails et accès aux registres.

Une disposition personnelle ou d’organisation existante garde sa priorité. Les vagues, particules et orbites restent décoratives. Les graphiques de données gardent leurs valeurs, dates, légendes, unités, permissions et alternatives chiffrées. Une valeur inconnue n’est pas dessinée comme zéro et une échéance seule ne crée pas une durée de Gantt.

Les cartes Risques ne remplacent pas les couleurs de la méthode de risque active. La refonte d’un graphique n’autorise pas un changement de règle de calcul ou d’interprétation d’un score. Le graphique RETEX généré reste préservé.

Référence : [correspondance du prototype et des données](../PROTOTYPE-INTEGRE.md). La demande de capture du Dashboard du 05/11 n’a ajouté aucune modification applicative.

## 11. Références de réalisation

| Domaine | Sources à réutiliser |
| --- | --- |
| Thème et palette de base | `packages/ui/src/tokens.ts`, `theme.ts`, `styles.css`, `neon.css`. |
| Graphiques | `neon-analytics.css`, `neon-graphiques.tsx`, composants Dashboard existants. |
| Fenêtres et Contexte | `neon-fenetres.css`, `ContextPresentation.tsx`, `RecordEditor.tsx`, `Registry.tsx`. |
| Périmètres | `neon-perimetres.css`, `CartesPerimetres.tsx`, `Perimetres.tsx`. |
| Objectifs | `neon-objectifs.css`, `ObjectifsProcessus.tsx`, navigation et paramètres de vue existants. |
| DdA | `neon-dda.css`, `Dda.tsx`, `DdaSynthese.tsx`, `DdaIcone.tsx`. |
| Référentiels | `neon-referentiels.css`, `Publication.tsx`, `ReferentielsStudio.tsx`, `LegacyFrameworks.tsx`, `Bibliotheque.tsx`. |
| Chargement CSS et CSP | `apps/web/src/main.tsx`, `apps/web/scripts/mantine-css-vars.ts`, exports de `packages/ui/package.json`. |

Les feuilles de modules utilisent leurs propres variables sémantiques dans `packages/ui`. L’implémentation doit conserver cet emplacement et le périmètre des sélecteurs. L’ordre réel des imports dans `main.tsx` fait partie de la référence ; les ajustements Studio sont chargés après les règles plus générales.

Le dossier de transmission fournit des instantanés identifiés par empreinte SHA-256. Ils servent à comparer et à porter les changements sur une autre branche ; un remplacement aveugle des fichiers risquerait d’écraser des évolutions fonctionnelles ultérieures.

Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).
