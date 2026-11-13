# Menu bleu nuit sur interface claire

12/11/2026, Europe/Paris. **Proposition visuelle validée et retenue le 12/11/2026 (« J’adore garde »), non intégrée : l’ultime essai translucide a été rejeté le 13/11/2026. Cette référence opaque est confirmée ; des prévisualisations Dashboard clair/sombre sont demandées avant la suite.**
Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

[Vue complète HD](menu-clair-hd.png) · [Détail du menu](menu-detail-hd.png) · [Aperçu interactif animé](apercu-autonome.html).

Le demandeur souhaite essayer le dégradé bleu du menu sombre dans l’interface claire. Cette proposition reprend exactement le fond bleu nuit/pétrole du sombre dans la seule sidebar et garde les pages en clair. Textes et contours sont adaptés à ce fond, ainsi que la luminosité des treize couleurs d’icônes. Les dessins, leurs traits renforcés, leurs mouvements et la disposition du menu restent ceux de la proposition précédente.

## Résumé technique pour une IA

- Base documentaire `cd76dde`, code applicatif toujours à `d9d1478`. Seuls la maquette et les documents changent ; aucune API, route, donnée, droit ou dépendance modifié. Le « Bien » précédent accueillait la palette ; le « J’adore garde » suivant retient explicitement ce fond. Comparaison finale demandée avant portage : [variante translucide](../menu-bleu-transparent/README.md).
- `index.html` réutilise la variante aux couleurs franches et importe `bleu.css`. Cette surcharge ne cible que `html[data-theme='light'] .mh-sidebar` et ses descendants ; les variables `--mh-*` sont locales à la sidebar. Le thème de la page ne passe pas en sombre.
- Fond repris littéralement du sombre (`#14233d` → `#142c45` → `#143239`, halo pétrole `#173f45`). Les treize couleurs de famille/admin sont éclaircies pour le contraste sur bleu nuit ; sélection, survol, focus, séparateurs, libellés et commandes de pied sont adaptés. Les sous-groupes suivent la couleur de leur famille. Aucun changement de largeur, hauteur, texte ou inventaire.
- Formes SVG, keyframes, pause/reprise et réduction système importées à l’identique des variantes précédentes ; aucun nouveau script. `exporter.py` assemble un aperçu autonome avec ressources locales.
- Pour le futur portage React : consolider la palette hybride dans la charte, garder Layout et ses droits, routes, alertes, préférences et accès conditionnels. Ne pas copier l’empilement des feuilles ou le simulateur de navigation. Cartographie/génération hors périmètre.

## Contrôles de la maquette

Comparaison native de la sidebar dans le vrai thème sombre avant/après pixel-identique. En thème clair, fond de la nouvelle sidebar calculé identique au fond sombre d’origine et capture du contenu Bibliothèque claire identique à la variante précédente à densité égale. Treize couleurs calculées distinctes, traits 1,95 ; sept analyses Axe ciblées de la navigation claire sans violation détectée. Quatre dispositions PC de 1280×720 à 2560×1440 sans débordement de page. Bascule thème/régénération des huit SVG, présence des huit mouvements, pause et réduction système contrôlées ; aucune erreur JavaScript de capture. Format HTML/CSS et diff contrôlés. Images natives 3840×2160 et détail du menu, résultats et empreintes dans `controles.json`.

Incident de contrôle : l’ancien serveur de comparaison renvoyait `ERR_EMPTY_RESPONSE` ; une nouvelle instance de la même maquette source a été lancée sur un autre port local, puis parcours complet rejoué. Les comparaisons de contenu utilisent les mêmes dimensions et densité de capture.

Non exécutés : intégration, build/tests applicatifs, recette Docker/API/DB/Mistral, nouvelle vidéo/GIF, ZIP, push, fusion ou déploiement. L’aperçu autonome conserve les animations ; les vidéos des anciennes palettes ne servent pas de preuve de ce nouvel essai. PR #264 toujours ouverte au même commit ; liste des fichiers lue aux tours précédents sans chevauchement avec ce lot. Entrées partagées antérieures préservées.

Suite : variante translucide rejetée ; [Dashboard clair/sombre avec cette référence](../dashboard-menu-retenu/README.md), puis portage du menu retenu. Les preuves techniques datées ci-dessus ne changent pas.
