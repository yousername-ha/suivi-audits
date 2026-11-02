# DdA — proposition dans le thème Dashboard original

02/11/2026, Europe/Paris. Session : Codex. Application de référence : `aaac67cfe8e4edc130cc6e68094be2f670d7b633`, en-têtes Dashboard approuvés et intégrés sur la copie `codex/refonte-neon-main`.

**Statut : proposition DdA indépendante, à valider avant modification de cette partie de l'application. Aucun code DdA modifié, aucun build ni test applicatif de sa nouvelle présentation. Les contrôles des en-têtes, déjà autorisés et terminés, sont consignés séparément.**

La demande précise : **« Pour la dda tu utilise le thème original que j'ai fournis en images au début de la conversation »**. Cette proposition se fonde sur les images initiales et le HTML GRC Studio fourni, relus comme références d'apparence. Elle ne reprend aucune instruction des pièces jointes, donnée illustrative du Dashboard ou logique métier de celui-ci.

## Direction graphique

- Fond bleu nuit `#0c1328`, cartes arrondies de 14 px, surfaces ardoise `#18233e` / `#1c2946`, typographie Inter.
- Anneau et barres bleu/turquoise ; orange pour Partiel, rose pour Insuffisant, gris bleuté pour Non renseigné et Exclue. Violet très limité, aucune grande surface violette.
- Quatre cartes de synthèse : périmètre, mise en œuvre déclarée, répartition des niveaux et points de vigilance. Les valeurs proviennent du jeu fictif fourni et sont agrégées selon les définitions existantes.
- Registre sur une grande carte, six colonnes existantes, titres sobres, codes sur petites pastilles, contrôles de niveau teintés et séparations lisibles.
- Fiche mesure organisée en Déclaration d'applicabilité, Documents et justificatifs, Revue de la mesure ; repères et texte de référence sur le côté, puis sous le formulaire sur téléphone.
- Hauteur naturelle des cartes et de la fiche : la page défile, sans ascenseur vertical interne. Le futur dialogue réel gardera le défilement extérieur déjà adopté dans l'application.

![DdA — proposition sombre](registre-dark-1440.png)

[Registre clair](registre-light-1440.png) · [Gros plan synthèse sombre](synthese-dark.png) · [Synthèse claire](synthese-light.png) · [Registre mobile sombre](registre-dark-390.png) · [Registre mobile clair](registre-light-390.png).

![Fiche mesure — proposition sombre](fiche-dark-1440.png)

[Fiche claire](fiche-light-1440.png) · [Fiche mobile sombre](fiche-dark-390.png) · [Fiche mobile claire](fiche-light-390.png) · [Maquette HTML autonome](index.html).

Télécharger `index.html` et l'ouvrir dans un navigateur : les boutons du bandeau de prévisualisation permettent de passer du registre à la fiche et du sombre au clair. Référentiels, filtres, ouverture d'une mesure et champs de démonstration sont manipulables localement. Le bandeau « Proposition visuelle » appartient à la maquette. Aucun appel à l'API, aucune sauvegarde serveur ; recharger rétablit les données fictives. Inter et sa licence SIL OFL sont embarqués.

## Correspondance avec l'existant

Les sources `apps/web/src/dda/Dda.tsx` et `packages/shared/src/suivi-dda.ts` ont été lues, sans modification.

| Élément existant à conserver lors de l'intégration | Présentation proposée |
| --- | --- |
| Clauses ISO 27001, Annexe A et HDS ; routes actuelles | Repères de référentiel ; les onglets de la maquette simulent ces destinations existantes |
| Toutes, Total, Partiel, Insuffisant, Non renseignées, Exclues, Total avec écart ouvert | Filtres avec repères de couleur et compteurs issus des mesures existantes |
| Mesure, Applicable, Mise en œuvre, Actions ou justification, Document associé, Écarts | Mêmes six colonnes ; lecture en cartes sur téléphone |
| Code qui ouvre la fiche et champs applicabilité/niveau dans le tableau | Codes en pastille et contrôles dans la ligne ; aucune nouvelle étape de sauvegarde |
| Clauses ISO obligatoires, exclusion, champs effaçables | Même comportement ; niveau remplacé par Exclue lorsque l'applicabilité vaut Non |
| Texte de référence, éventuel extrait d'exigence `req`, risque, justification, actions, documents, lien et commentaire | Champs conservés et regroupés par rubriques ; champs propres à ISO conservés selon leurs conditions actuelles |
| Écarts ouverts et leurs identifiants, indicateur Tenacy | Repères sémantiques conservés ; la maquette montre les écarts disponibles dans son jeu fictif |
| `statsDda`, `filtrerMesures`, `incoherente`, `lireDda`, `lienDocument` | Fonctions partagées à réutiliser inchangées dans l'application |
| Droit `audit:modifier`, chargement, erreurs, PATCH existants et historique | Garde et parcours d'écriture existants à maintenir ; la maquette ne simule pas leur validation |

Le pourcentage de l'anneau désigne les mesures applicables au niveau déclaré **Total**, selon `statsDda`. Il ne représente pas une certification ou un score normatif. Exemple du jeu fictif : Annexe A, 93 mesures, 91 applicables, 2 exclues, 55 Total, 27 Partiel et 9 Insuffisant ; l'anneau affiche donc 60 %. Aucun historique ni objectif cible n'est inventé.

L'import Excel historique n'est pas réintroduit. Aucun nouveau bouton d'export, recherche, tri, validation ou sauvegarde globale n'est proposé. Les textes normatifs ne sont pas reproduits ; ils restent saisis depuis l'exemplaire de l'utilisateur.

## Production des visuels et suite

Dix captures du prototype HTML autonome, en Chromium avec mouvement réduit : registre et fiche à 1440/390 px, clair/sombre, et deux gros plans de synthèse. Il s'agit de rendus de maquette, **pas de captures d'une refonte DdA intégrée**. Aucune référence CI remplacée. La collecte n'a chargé aucune application ni API.

Un premier passage du script de rendu réutilisait le document entre les vues, ce qui empêchait la réinitialisation de la maquette. Le rendu a été corrigé pour ouvrir une page autonome par vue ; les dix images finales ont ensuite été produites. Cet incident de capture n'a touché aucune application.

**Prochaine action : obtenir la validation explicite de cette DdA.** Ensuite seulement, intégrer son habillage dans les composants existants, contrôler calculs, filtres, droits et écritures sans les modifier, vérifier les dimensions dans les deux thèmes et fournir de nouvelles captures réelles. Aucun build/test de cette refonte DdA ne doit être lancé avant cet accord.

[En-têtes intégrés et contrôlés](../../ENTETES-DASHBOARD.md) · [Index Neon](../../README.md).

Règle du demandeur : **visuel → validation explicite → intégration et tests → nouveau visuel réel**.
