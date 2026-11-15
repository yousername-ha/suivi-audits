# Portage de l’écran et des animations

Cette note décrit une réalisation future après validation. Les sources jointes sont une maquette autonome ; ne pas remplacer le client réel par `studio.js`.

## Périmètre et points d’entrée

| Fichier actuel | Travail attendu, après audit de la cible |
| --- | --- |
| `docker/maintenance/index.html` | Adapter structure accessible, noyau SVG, grande dalle, versions, frise, notices, zone de logs et pause. Conserver les points d’entrée du client réel ou les remapper explicitement. |
| `docker/maintenance/maintenance.css` | Porter les styles retenus, consolider les couches de référence et les tokens locaux ; thème/contraste, pause et mouvement réduit. |
| `docker/maintenance/maintenance.js` | Garder polling, gardes et navigation ; extraire un rendu piloté par données réelles et ajouter un client de journal seulement quand son contrat privé existe. |
| `docker/maintenance/client.js`, `notice.css` | Préserver redirection depuis toute la plateforme et absence de bannière au login. Hors refonte de ce lot sauf adaptation démontrée. |
| `docker/Caddyfile.gateway` et Compose | Ne changer qu’après conception du vrai transport privé, validation de CSP/montages/permissions. Aucun besoin de les élargir pour une simple animation. |
| Worker/script/shared/API/tests | Modifications ciblées nécessaires au flux complet ; voir spécification du journal. Aucun nouveau framework pour la page autonome. |

Les snapshots `annexes/existant-2026-11-15/` sont datés. Toujours relire la cible avant de définir le diff réel. Les règles de `packages/ui` concernent l’identité commune ; l’écran doit rester utilisable quand le bundle React est indisponible. Garder CSS, SVG, police et scripts locaux sous la CSP actuelle, sans CDN, inline obligatoire ni dépendance runtime ajoutée.

## Composition retenue comme proposition

En-tête léger, titre, grande dalle centrale à angles biseautés, puis frise de cinq étapes et notices utiles. Dans la dalle : noyau vectoriel animé, informations de version/phase/durée, puis lignes techniques libres à droite. Le journal ne reçoit aucune sous-dalle. Les contrôles de pause et thème restent discrets et utilisables au clavier. Les versions/dates/durées et messages viennent des données réelles.

Palette sombre de référence : `--bg #060f20`, `--panel #0c1c31`, `--card #10253d`, texte `#eff7ff`, secondaire `#a0b5ce`, contour `#2a435f`, cyan `#64e4ec`. L’accent violet léger `#ad96f3` intervient sur un arc, une face de cube et quelques repères ; pas sur tout le fond ni sur la sémantique des erreurs. Ces valeurs décrivent la maquette, à rapprocher des tokens actuels avant portage.

L’index de référence contient tous les SVG originaux : conserver leur précision vectorielle, leurs viewBox, épaisseurs lisibles et décorations `aria-hidden`. Ne pas redessiner les icônes à partir des JPEG. Le réseau et les paquets restent derrière le texte, sans interception de pointeur. Limiter halos/flous ; ne pas masquer les états réels par les effets.

## Rendu piloté par l’état réel

Traiter dans cet ordre : opération attendue et bonne identité → dernier état fiable → statut terminal/rollback/intervention → phase active → connexion/délai. L’illustration découle de ces données ; elle ne déclenche jamais l’étape suivante.

| Donnée réelle | Art de la maquette | Mouvement / texte à préserver |
| --- | --- | --- |
| Attente du bon `demande`, job non pris en charge | `waiting`, `.stage-waiting` | Signal d’attente, pas de frise ni de logs du job précédent. |
| `phase=preparing` | `download`, `.stage-download` | Paquets descendants et barre indéterminée, « préparation / téléchargement et vérifications ». Aucun pourcentage faute de mesure réelle. |
| `phase=backup` | `backup`, `.stage-backup` | Copies dirigées vers coffre, animation de sauvegarde ; ne révèle aucun chemin/secret privé. |
| `phase=installing` | `building`, `.stage-building` | Petits cubes isométriques qui s’assemblent ; peut inclure de vrais pulls, aucune règle de durée fictive. |
| `phase=verifying` | `verifying`, `.stage-verifying` | Scanner et liste de vérification, sans inventer les résultats des contrôles. |
| Succès réellement publié, puis santé/libération vérifiées pour le retour | `complete`, `.stage-complete` | Portail et coche ; `phase=complete` seule n’active pas une réussite. |
| Retour arrière actif | `rollback`, `.stage-rollback` | Mouvement inverse ; garder versions et raison réelles. |
| `status=rolled_back` | `restored`, `.stage-restored` | Version précédente rétablie, diagnostic visible ; retour manuel seulement si santé réelle. |
| `status=failed` | `alert`, `.stage-alert` | Échec compréhensible, pas de réussite ni de redirection automatique ; ne prétend pas à la disponibilité sans santé. |
| `status=intervention` | `alert`, `.stage-alert` | Intervention, aucun retour automatique ni bouton de relance inventé. |
| Polling interrompu | Dernier art connu + état « suivi interrompu » | Garder la phase réellement connue ; la démo utilise arbitrairement installation pour ce scénario. |
| Temps long réel | Art connu + notice de lenteur | Pas de faux échec après 10 minutes. |
| Phase inconnue / aucune opération | État neutre lisible | Aucun numéro inventé, aucun succès dérivé de la seule illustration ; conserver les branches d’entrée/sortie existantes. |

Les cinq rangs `01/05` à `05/05` représentent des phases, jamais des pourcentages. `etapes[].at` est une entrée dans la phase, pas une preuve de succès. Les phases de restauration ne font pas partie d’une progression linéaire normale. Ne pas poser un intervalle qui avance les étapes.

## Sources cumulatives, à consolider

CSS dans cet ordre : `studio.css` → `effects.css` → `phases.css` → `journal.css` → `direct.css` → `technique.css` → `violet.css` → `erreurs.css`.

Scripts de démonstration dans cet ordre : `studio.js` → `technique.js` → `direct.js` → `erreurs.js`. Tous sont fournis pour examiner les scénarios et le rendu. En production, leurs fixtures et sélecteurs sont remplacés par le vrai client.

- `studio.css` : structure, thème, orbites, responsive, pause ; `effects.css` : réseau et paquets.
- `phases.css` et SVG de l’index : `.stage-*`, animations `transfer-pass`, `backup-copy`, `voxel-install`, `verification-scan`, `portal-open`, `restore-cube` et variantes terminales.
- `journal.css` : disposition en trois zones et ancienne présentation encadrée. `direct.css` annule les bordures, fond, titres, compteurs et séparateurs. **Ne jamais porter `journal.css` seule.**
- `technique.css` : console monospacée ; lignes de référence de 36 px, heure 56 px, espacement 11 px, texte 11,5 px. C’est une base d’étude : le petit texte doit être vérifié sur PC à taille réelle, sans le réduire davantage pour éviter un débordement.
- `violet.css` : accents limités ; `erreurs.css` : erreurs rouges `#ff4c43` sombre / `#c52b23` clair, horaire à 75 % d’opacité.
- Le texte technique ordinaire est blanc à 78 % dans la couche finale, y compris la variante claire. Ne pas corriger silencieusement ce choix dans une intégration : contrôler le contraste du rendu clair et proposer une adaptation sur capture si nécessaire. Les références finales livrées sont sombres.

Le prototype conserve du DOM historique masqué pour les en-têtes du journal et un `aria-labelledby` vers ce titre. Lors du portage, simplifier la structure et fournir un libellé accessible stable sans remettre de titre visuel. Ne pas copier des contrôles invisibles ou une structure sémantique devenue incohérente.

## Journal et mouvements

La fenêtre visuelle est un masque vertical de 220 px dans la maquette : transparent en haut, opacité progressive vers le bas. La liste est ancrée en bas ; une nouvelle entrée fait remonter le groupe de 36 px pendant 0,85 s. Aucun mouvement perpétuel de fausses lignes. Pour des messages longs, calculer le déplacement d’après la hauteur réelle ajoutée, traiter les arrivées en lots et préserver l’ordre. La fenêtre visuelle peut masquer le haut ; l’historique complet assaini reste conservé ailleurs pour le compte habilité.

Le DOM de démo conserve toutes ses quelques fixtures pour montrer le fondu ; ce n’est pas une architecture adaptée à un journal réel illimité. Prévoir tampon DOM borné, batches et reprise par curseur. Les messages doivent être rendus avec `textContent` ; pas de HTML ou de séquences terminales interprétées.

La classe `.log-error` de la démo préfère sévérité structurée (error/fatal ou Pino 50/60), puis code de sortie non nul, puis préfixes ancrés `ERREUR :`, `ERROR :`, `FATAL :`, `[ERROR]`, `[FATAL]`. En production, utiliser le niveau fiable du collecteur. Ne pas colorer tout stderr ni « no error »/« 0 errors ». Une seule ligne d’erreur n’impose pas la couleur rouge aux autres logs ni un échec global.

## Adaptation et accessibilité

Priorité aux PC : 1280×720, 1366×768, 1440×900, 1920×1080, 2560×1440 et 3840×2160 ; vérifier aussi fenêtre étroite et hauteur 600 px, zoom 125/150/200 %. Adapter la grille et les marges avant de réduire les polices. Aucune mise à l’échelle globale par `transform: scale`. Ne pas rogner un contrôle pour prétendre à zéro scroll. Un défilement de secours à faible hauteur vaut mieux qu’un contenu inaccessible ; éviter le défilement interne de la grande dalle dans la vue PC principale.

Pause : figer les effets visuels, **continuer à recevoir/rendre les états et logs**. `prefers-reduced-motion: reduce` : version statique immédiate, même information. Les changements de phase importants sont annoncés discrètement ; ne pas lire chaque ligne de log via un `aria-live` bavard. État et erreurs compréhensibles sans la seule couleur. Focus visible, contraste AA des informations utiles, aucun flash rapide.

L’indisponibilité du journal ne doit jamais dégrader le polling, la santé, le retour ni les consignes d’intervention. La logique de présentation reste testable sans Docker ni vraie mise à jour ; la recette réelle vient ensuite dans un environnement isolé autorisé.
