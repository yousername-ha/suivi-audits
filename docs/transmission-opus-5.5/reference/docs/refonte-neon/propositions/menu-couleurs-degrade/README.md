> **Suite du 12/11/2026 : le clair est retravaillé dans [Menu clair — contraste et relief](../menu-clair-signature/README.md).** Le menu sombre de ce dossier reste conservé ; aucune intégration du menu ni validation du nouveau clair déduite de ce retour.

# Menu — icônes colorées, dégradé et animation légère

12/11/2026 (Europe/Paris). **Variante autonome à valider, aucune intégration du menu.**
Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Le demandeur souhaite des couleurs par entité/icône et essayer un fond dégradé. « Annulations » est compris comme « animations » dans ce contexte ; la version précédente ne possédait qu’une transition de survol. Cette demande ajuste la proposition, elle ne valide pas son ancienne version.

[Clair HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/menu-couleurs-degrade/menu-clair-hd.png) · [Sombre HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/menu-couleurs-degrade/menu-sombre-hd.png) · [Vidéo réelle](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/menu-couleurs-degrade/menu-animation.mp4) · [Aperçu interactif](apercu-autonome.html).

## Variante visuelle

Une couleur de repérage par famille : Organisation vert, Pilotage bleu, Risques ambre, Conformité cyan, Actions vert feuille, Résilience rouge doux, Documents indigo. Les accès de compte/administration reçoivent aussi des icônes vectorielles colorées. Ces couleurs désignent la navigation et ne constituent pas des états d’alerte métier.

Fond statique en dégradé blanc bleuté/céladon dans le thème clair ; bleu nuit/pétrole dans le thème sombre. La couleur de la famille active est reprise dans son filet et sa destination, sans changer la palette du fond selon la page. Lignes intermédiaires, libellés confortables et défilement local du menu conservés.

Seule l’icône de la famille active oscille de +0,5 à −0,5 px en 6,8 secondes. Les autres icônes se relèvent de 1 px au survol. Texte, positions des lignes et fond ne sont pas animés en permanence. Petite commande de pause en pied de menu ; en réduction du mouvement système, animation arrêtée et commande désactivée. Le mode clair/sombre garde sa commande distincte.

## Résumé technique pour une IA connaissant le code

- **Maquette/documentation seulement** depuis `d9d1478`. Aucun fichier applicatif, contrat, droit, préférence persistante, API/backend, donnée réelle ou dépendance modifié. La Bibliothèque Studio et l’Assistant Neon intégrés au lot précédent gardent leur état.
- `index.html` reprend `menu-final`, conserve ses dimensions et le contexte de bibliothèque déjà validé, puis ajoute `couleurs.css` et la commande de mouvement. Le dossier précédent reste un historique comparatif.
- `couleurs.css` : palette `--mc-*` par famille, variantes sombres, arrière-plan dégradé, petites plaques d’icônes, sélection et animation `mc-active-icon`. Aucune règle de page métier ni animation du gradient. Sélecteurs limités à la maquette de navigation.
- `menu.js` reprend le simulateur de navigation du dossier précédent ; ajoute `data-mh-group` pour transmettre la couleur aux destinations et cinq icônes de compte/administration. L’état `data-mh-motion` sur `html`, la commande bouton explicitement ciblée et `matchMedia` pilotent pause/reprise/réduction du mouvement. Aucun stockage ni appel réseau métier.
- `exporter.py` assemble styles/scripts/police en HTML autonome. Deux captures natives 3840×2160 (viewport 1920×1080, densité 2) et vidéo de captures natives 1440×900 avec leurs durées réelles préservées.
- Après validation : porter uniquement cet habillage dans `Layout`/la charte de navigation, supprimer les surcharges de sidebar conditionnées par certaines pages dans `neon-dda.css`, garder droits, ordre enregistré, alertes métier, IDs, routes, accès conditionnels RETEX et préférences existants. Ne pas remplacer le menu réel par le tableau statique de la maquette.
- Onglets internes, vues métiers, Assistant et cartographie/canevas/génération restent hors de ce lot. Budget/CRRC et les six rubriques de référentiels retirées ne réapparaissent pas.

## Contrôles exécutés

18 comparaisons (9 contextes × 2 thèmes) du fond, texte, bordure, largeur et police ; 16 dispositions PC de 1024×768 à 2560×1440, dont fenêtre basse 1920×800 ; aucun débordement de page/menu mesuré. Structure vérifiée : 7 familles, 26 destinations, 5 entrées de compte/administration illustratives, une famille dépliée, repère actif et commande de thème.

Six analyses Axe générales (Bibliothèque/DDA/Objectifs, deux thèmes), puis quatorze ciblées sur le menu avec chacune des sept familles actives, sans violation détectée. Sept couleurs d’icônes distinctes contrôlées dans chaque thème. Animation mesurée aux deux extrêmes du cycle ; pause, reprise et préférence de mouvement réduit contrôlées. Pas une certification exhaustive d’accessibilité.

Aucun appel API, ressource distante ou erreur JavaScript dans la vérification finale de l’export. ESLint et format ciblés réussis. Les scripts privés de capture ont été corrigés pour créer explicitement le contexte attendu par Axe et cibler la commande de thème/mouvement, plutôt que le pied de menu ou son attribut d’état global ; assertions et structure conservées. [Résultats/empreintes](controles.json) et [animation](animation.json).

**Non exécutés :** nouveau build/test applicatif, intégration globale du menu, API/DB, Docker/Windows, ZIP, CI distante, push, fusion ou déploiement. Les tests verts de l’intégration Bibliothèque/Assistant restent historiques et ne sont pas réattribués à cette variante. PR #264 consultée précédemment, aucun même travail de menu identifié ; entrées documentaires antérieures préservées.

Suite : avis sur ce rendu avant portage, suivant [AGENTS.md](../../../../AGENTS.md) : « Présenter d’abord une proposition visuelle isolée et attendre sa validation explicite. »
