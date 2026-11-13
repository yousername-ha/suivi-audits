# Dashboard clair et sombre — menu bleu nuit retenu

13/11/2026, Europe/Paris. **Deux prévisualisations natives demandées ; aucun portage applicatif du menu effectué.**
Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Le demandeur rejette la variante translucide (« C’est non »), conserve le menu bleu nuit opaque et demande de le voir sur le Dashboard clair et sombre.

[Dashboard clair HD](dashboard-clair-hd.png) · [Dashboard sombre HD](dashboard-sombre-hd.png) · [Menu retenu](../menu-bleu-sur-clair/README.md).

## Résumé technique pour une IA connaissant le code

- Base documentaire `9d125e0`, application toujours à `d9d1478`. Aucun fichier `apps/`, `packages/`, service, donnée, route, droit, dépendance ou génération de cartographie modifié. Les README de décision enregistrent le rejet de la transparence et le maintien du bleu nuit.
- **Méthode de projection, distincte d’une intégration :** frontend déjà compilé dans `apps/web/dist`, route Home réelle et composant `NeonAnalytics`, alimentés exclusivement par `assistantFixture` et ses données fictives versionnées. Discussion fermée, Dashboard ouvert par son lien natif. Aucun nouveau build. Pas de graphe ou valeur dessiné manuellement dans les images.
- Dans le seul navigateur de capture, l’ancien menu est masqué et la maquette autonome retenue `menu-bleu-sur-clair/apercu-autonome.html` est rendue dans une iframe isolée de 248 px visibles, à viewport interne de 1920 px pour conserver les proportions PC. La variable de largeur du cadre est ajustée à 248 px dans cette projection ; aucune feuille applicative modifiée. L’iframe utilise le même menu validé dans les deux captures, avec ses treize couleurs, ses SVG et ses mouvements ; la préférence de réduction du mouvement fige les captures. Le libellé de thème du pied reflète le thème externe.
- Les familles sont repliées et Tableau de bord actif. Le vrai thème Mantine externe change par le bouton natif « Mode sombre », avec sauvegarde de préférence entièrement interceptée. Cela garde libellé et couleurs synchronisés. Aucun nouvel écran de connexion, service Mistral ou base lancé.
- Capture à viewport 1920×1352, densité 2 : deux PNG 3840×2704. La hauteur est cadrée sur la fin du bloc analytique, sans modifier les tailles de dalles ni inclure les cartes d’accès placées en dessous. Le Dashboard garde ses douze dalles et leurs contenus natifs ; les panneaux sans données/droits dans ce jeu de recette restent signalés comme tels, sans données inventées pour remplir les graphes.

## Vérifications réellement exécutées et limites

Un parcours de capture final réussi dans Chromium : Dashboard natif chargé, douze dalles présentes dans chaque thème, aucune erreur JavaScript observée, aucun débordement horizontal à 1920 px. Aucun changement métier Assistant demandé ou enregistré ; seule préférence de thème simulée et interceptée. Images claires/sombres inspectées visuellement. Données identiques entre les thèmes. Résultats, dimensions, source de fixture et empreintes dans `controles.json`.

Incident de capture : la première assertion cherchait l’ancienne grille `.tdb-grille` ; adaptée à la vraie vue analytique `.na-grille`, sans modifier l’application. Le premier plein écran de page étendue composait mal l’iframe fixe et gardait un libellé de thème non synchronisé ; remplacé par un viewport cadré sur le Dashboard et bascule du vrai bouton natif. Parcours final rejoué avec succès, images corrigées uniquement livrées.

**Non exécutés :** intégration React du menu, nouveaux tests unitaires/build applicatifs ou recette fonctionnelle globale, nouvelle analyse Axe/responsive exhaustive, Docker/API/DB/Mistral réels, vidéo/GIF, ZIP, push, fusion ou déploiement. Les tests historiques de la bibliothèque et de l’assistant ne sont pas réattribués à ces images. PR #264 toujours ouverte au même commit ; fichiers consultés aux tours précédents sans chevauchement avec ce lot. Entrées documentaires précédentes préservées.

Suite : poursuivre le portage du menu bleu nuit validé dans Layout et la charte existante lorsque la phase de visualisation demandée est terminée. Conserver ses droits, ordre mémorisé, routes, alertes et accès conditionnels ; l’iframe et le simulateur sont des outils de projection et ne doivent pas être intégrés à l’application. Garder le fond opaque, pas la variante transparente rejetée.
