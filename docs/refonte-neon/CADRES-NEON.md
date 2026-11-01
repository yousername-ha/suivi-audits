# Cadres néon et pictogrammes animés

01/11/2026, Europe/Paris. Session : Codex. Branche `codex/refonte-neon-main`, depuis `bf7530595e517c4fcfd8a3213f8e9e116de8639c`.

## Cadre retenu : Biseau

Le demandeur a choisi **Biseau** (« Biseau très bien »). Le cadre biseauté cyan/violet et les pictogrammes animés sont donc conservés pour cette dalle. Les deux autres variantes ont été retirées du code actif ; leurs captures restent archivées pour garder la comparaison.

## Propositions comparées (historique)

Le contenu du contexte, les cinq rubriques, les listes et les commandes sont conservés. Seul l’encadrement de la fenêtre varie :

| Proposition      | Traitement                                                              |
| ---------------- | ----------------------------------------------------------------------- |
| **1 · Biseau**   | Quatre angles coupés, contour fin violet/cyan et diagonales lumineuses. |
| **2 · Équerres** | Angles presque carrés et repères d’angle lumineux plus présents.        |
| **3 · Halo**     | Coins arrondis, double liseré et lueur extérieure discrète.             |

Lors du lot de propositions, la recette changeait uniquement l’attribut décoratif `data-cadre` dans le navigateur. Les comparatifs ci-dessous conservent les rendus de ce lot. Aucun menu ou réglage enregistré n’a été ajouté au produit.

| Biseau                                                                                   | Équerres                                                                                       | Halo                                                                               |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| [![Biseau](captures-cadres/biseau-angle-dark.png)](captures-cadres/biseau-dark-1440.png) | [![Équerres](captures-cadres/equerres-angle-dark.png)](captures-cadres/equerres-dark-1440.png) | [![Halo](captures-cadres/halo-angle-dark.png)](captures-cadres/halo-dark-1440.png) |

Vues complètes : [Biseau](captures-cadres/biseau-dark-1440.png), [Équerres](captures-cadres/equerres-dark-1440.png), [Halo](captures-cadres/halo-dark-1440.png).

Comparatifs clairs : [Biseau](captures-cadres/biseau-light-1440.png), [Équerres](captures-cadres/equerres-light-1440.png), [Halo](captures-cadres/halo-light-1440.png). Les gros plans et captures mobiles sont dans le même dossier.

## Voir les cinq animations pour validation

Pour rendre les mouvements visibles indépendamment de l’affichage des images dans la conversation :

- [Vidéo MP4 des cinq icônes agrandies](captures-cadres/validation-animations/animations-5-icones.mp4) : 18 secondes, séquence répétée cinq fois, à vitesse réelle.
- [Aperçu interactif autonome à télécharger](captures-cadres/validation-animations/apercu-icones.zip) : extraire l’archive, ouvrir `apercu-icones.html`, puis utiliser Lire, Pause et Rejouer. La démonstration démarre en pause et ne charge aucune ressource distante. L’archive contient aussi le MP4, les instructions et la licence de la police Inter.

Les SVG et les règles d’animation sont repris de l’application au commit `7f5fb78c9eb04be48abb9670dfb4391948ea8dcd`. Seul le grossissement de l’aperçu est différent. Le code, la taille des icônes et le comportement de l’application restent inchangés. Les boutons de lecture appartiennent uniquement au fichier de validation.

Vérifications : cinq icônes, sept animations, 36 images distinctes du navigateur assemblées en vidéo H.264 de 1280 × 386, 180 images sur 18 secondes ; lecture et décodage effectifs vérifiés dans Chromium. La page autonome finale a été testée avec les trois commandes et à 390 px sans débordement horizontal, sans erreur JavaScript ni requête externe. Aucun objet ou lien modifié pendant la collecte depuis l’application. L’ouverture `file://` est bloquée par la politique de Chromium dans l’environnement cloud ; les octets du fichier HTML ont donc été chargés en mémoire pour la recette, sans serveur. L’archive ZIP est relue et son intégrité vérifiée.

Les preuves privées restent dans `/workspace/work/neon-instance/apercu-icones` : `validation.json`, `validation-video.json` et `validation-html-final.json`. Aucun test applicatif complet n’est déclaré rejoué pour cet ajout d’aperçus. La validation esthétique des mouvements reste à faire par le demandeur.

## Animations des pictogrammes

Les cinq pictogrammes conservent leurs formes ; seuls certains éléments internes bougent : fenêtres du bâtiment, cadre intérieur du périmètre, nœuds des interfaces, aiguille de la boussole et flèche de sortie. Sept éléments SVG sont animés, sans déplacement des textes ou des blocs.

Une activation de 3,2 secondes se joue à l’ouverture, avec un léger décalage entre les nœuds. L’animation se poursuit lorsque le pointeur survole le pictogramme. La préférence système de mouvement réduit supprime les animations. Les décorations sont masquées aux lecteurs d’écran et ne capturent aucun clic. Le cadre décoratif disparaît en couleurs forcées au profit d’une bordure système.

![Connexions](captures-cadres/connexions.gif) ![Boussole](captures-cadres/boussole.gif)

Ces GIFs proviennent de 36 captures du navigateur à différentes positions des animations CSS, assemblées avec FFmpeg. Ils montrent les pictogrammes réels agrandis par le facteur de pixels du navigateur, sans modification des données ni dessin de remplacement. Les captures statiques utilisent le mouvement réduit pour faciliter la comparaison.

## Contrôles du lot de propositions (e73f7ef)

Instance fictive isolée, vraie API et PostgreSQL 18, Node 26.13.0, Chromium système :

- 18 vues vérifiées : trois cadres, clair/sombre, 1440 × 1080, 1024 × 768 et 390 × 844 ; six gros plans supplémentaires. Aucun débordement horizontal de page. Les cinq sections restent entièrement visibles à 1440 × 1080 sur le jeu fictif.
- Les boutons restent visibles et cliquables dans les trois cadres ; le calque décoratif ne reçoit pas les événements de pointeur.
- Six analyses axe sur les fenêtres bureau : aucune violation détectée dans cet échantillon.
- Sept animations actives observées avec le mouvement autorisé ; aucune animation active après activation du mouvement réduit. Couleurs forcées : suppression du cadre décoratif et de la découpe vérifiées.
- Aucune erreur JavaScript, violation CSP, réponse API en échec ou écriture d’objet/relation pendant la recette de comparaison.
- Deux parcours e2e existants réussis, sans changement d’assertions : consultation, agrandissement, modification, annulation, sauvegarde, création et compte réel limité à la lecture avec refus serveur HTTP 403.
- Trois tests ciblés de charte, typage web, lint du composant, formatage et build réussis. Avertissements de build existants : script `/update/client.js` externe et taille de chunks. Les suites unitaires complètes ne sont pas déclarées rejouées pour ce lot graphique.

Preuve détaillée hors Git : `/workspace/work/neon-instance/validation-cadres-contexte.json`. Les 36 poses de connexions sont distinctes ; 32 poses de boussole le sont également. Les GIFs bouclent pour la démonstration ; le produit conserve l’activation brève puis le survol.

Aucune modification métier, de droits, d’API ou de données de production. Aucune nouvelle dépendance ni référence visuelle de CI remplacée automatiquement. Main, le dépôt d’origine et le graphique RETEX restent intacts. Aucun déploiement. Le choix du cadre est confirmé. La modification reste sur la branche de refonte, sans fusion ni mise en production.

## Finalisation du choix

Après confirmation du demandeur, retrait des styles Équerres/Halo et du tracé SVG inutilisé. Biseau et les animations conservent leur rendu. Typage, lint, formatage et build réussis ; contrôle navigateur ciblé réussi : cadre biseauté, quatre coins, animations actives puis arrêtées avec mouvement réduit, commandes accessibles et fermeture, sans erreur JavaScript ni écriture. Preuve privée : `validation-biseau-retenu.json`. Les tests du lot de propositions ci-dessus restent historiques et ne sont pas déclarés rejoués pour ce nettoyage.
