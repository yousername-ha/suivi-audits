# Exigences finales et statut des validations

15 novembre 2026, Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Lire d’abord [le point d’entrée](00-LIRE-EN-PREMIER.md), puis les [références fixes](visuels/).
Ce document distingue les demandes explicites du demandeur et les propositions qui les illustrent.
La préparation de ce dossier est autorisée ; elle **ne vaut pas validation finale d’intégration des dernières captures**.

## État réel à la transmission

Le demandeur a demandé une refonte de la page qui apparaît lorsque la mise à jour commence, puis des
ajustements successifs de son animation et du journal. La dernière proposition associe le style violet léger,
le journal technique en écriture directe et les erreurs rouges. Elle reste une **maquette autonome**.

Les exigences ci-dessous sont explicites. Aucun message de la séquence récente n’approuve expressément
le portage applicatif de cette dernière composition. Ne pas transformer « Reprend », une demande de correction
ou la demande du présent dossier en validation visuelle des captures.

Les résultats de maquettes, captures et vérifications historiques ne constituent pas une recette du code cible.
L’IA repreneuse doit d’abord constater ce qui existe dans sa branche et dans la version effectivement utilisée.

## Matrice des demandes et critères de portage

| Sujet | Demande finale | État à la transmission | Critère observable après portage autorisé |
| --- | --- | --- | --- |
| Écran concerné | Refaire la page affichée pendant la mise à jour, avec tous les éléments utiles à son suivi. | Exigence explicite ; maquette autonome. | La page de maintenance est habillée, les informations et comportements existants sont conservés. L’écran d’administration qui déclenche l’opération ne se trouve pas remplacé par cette page. |
| Direction graphique | Aspect futuriste Neon/cyberpunk, cohérent avec la refonte. | Direction demandée ; composition récente à valider sur captures. | Fond bleu nuit/cyan, contours biseautés, noyau vectoriel net, effets lisibles et proportionnés. Pas de zoom global pour faire tenir la page. |
| Accent violet | Une touche violet néon **légère**. | Demande explicite, variante fixe présentée. | Violet ponctuel sur un arc, une face des cubes, quelques contours et repères. Le cyan demeure dominant. Les couleurs fonctionnelles des états ne sont pas remplacées par du violet. |
| Décor animé | Évoquer téléchargement, réseau et effets de l’écran de connexion. | Demande explicite ; prototype SVG/CSS. | Réseau de points et liaisons, paquets descendants, grille en perspective et ondes en arrière-plan. Ils restent décoratifs, sous les informations, sans interception des clics. |
| Animation centrale | Une animation **logique différente pour chaque étape**. | Demande explicite ; six illustrations principales proposées. | Le dessin change quand la phase réelle change. La même flèche de transfert n’est pas utilisée pour sauvegarde, installation et vérification. Voir [le portage UI et animations](04-PORTAGE-UI-ET-ANIMATIONS.md). |
| Préparation / téléchargement | Une barre de chargement et une évocation du transfert. | Illustration de préparation ; aucune mesure d’avancement fournie par la maquette. | Barre indéterminée et paquets descendants tant qu’aucune métrique serveur fiable n’existe. Aucun remplissage de 0 à 100 %, pourcentage, débit ou délai restant inventé. |
| Sauvegarde | Représenter l’opération de sauvegarde. | Proposition : documents ou blocs rejoignant un coffre. | Le visuel accompagne l’état de sauvegarde réel. Il ne prétend pas qu’une vérification de sauvegarde a réussi avant de disposer d’un résultat réel. |
| Installation | Simuler l’installation au moyen de petits cubes. | Demande explicite sur les cubes ; assemblage proposé. | Des cubes s’assemblent en module pendant l’installation. Le nombre de cubes n’est pas présenté comme un nombre réel de fichiers ou de composants installés. |
| Vérification | Représenter les contrôles en cours. | Proposition : scanner, liste et loupe. | Le balayage correspond à la phase de vérification. Les signes illustratifs ne deviennent pas des attestations de contrôles, signatures ou taux de conformité réels. |
| Succès / retour | Représenter la fin et le retour à l’application. | Proposition : portail et coche stabilisée. | L’illustration de succès dépend d’un vrai succès. L’affirmation de disponibilité et le retour respectent les gardes et contrôles de santé de la cible. `phase=complete` seul ne suffit pas à inventer la disponibilité. |
| Restauration / erreur | Illustrer le retour arrière et les interruptions. | Propositions : blocs en sens inverse, puis avertissement fixe. | Restauration seulement si réellement déclenchée. En intervention, les animations de travail s’interrompent ; aucun bouton de relance ou de restauration supplémentaire n’est inventé. |
| Contenu du journal | **Logs techniques** de l’installation et des services, pas seulement les étapes métier. | Demande explicite ; extraits simulés dans les captures. Le vrai flux reste à raccorder. | Les lignes proviennent du journal technique réellement collecté et de ses sources disponibles. Le tableau `etapes[]` ne sert pas à fabriquer des sorties de commandes. Voir [journal complet et secrets](05-JOURNAL-COMPLET-ET-SECRETS.md). |
| Couverture du journal | « Tout les log possibles sauf si y a des secrets d’affiche ». | Exigence explicite documentée ; collecte exhaustive non implémentée dans les maquettes. | Toutes les lignes techniques disponibles de l’opération sont conservées après assainissement : sources, niveaux, diagnostics et erreurs. Les limites d’instrumentation, interruptions ou portions manquantes sont signalées. Aucune exhaustivité fictive. |
| Placement du journal | Directement dans la grande dalle, dans la partie centrale à droite. | Demande explicite après rejet de la sous-dalle du journal. | Aucune carte, bordure, titre, compteur, points ou séparateurs propres au journal. Le bloc de texte occupe la zone droite ; les lignes console peuvent garder leur alignement interne pour faciliter la lecture. |
| Apparence du journal | Écriture blanche légèrement transparente, de type console. | Demande explicite ; variante monospace présentée. | Texte monospacé, horaires alignés, messages ordinaires blancs dans le thème sombre, sans teinte cyan imposée au dernier message. Le masque reste en arrière-plan visuel de la grande dalle. |
| Défilement / disparition | Le journal remonte et devient de plus en plus transparent jusqu’à disparaître en haut. | Demande explicite ; masque spatial proposé. | Une vraie nouvelle ligne arrive en bas, les précédentes remontent et s’effacent au sommet. Aucun défilement alimenté par des messages inventés. Le fondu visuel ne supprime pas l’historique complet. |
| Erreurs dans le journal | Les erreurs doivent être rouges. | Demande explicite ; capture d’erreur présentée. | La ligne en erreur et son horaire sont rouges ; les autres lignes conservent leur couleur normale. Classification par sévérité réelle, pas par la présence quelconque du mot « error » ou par tout le canal `stderr`. |
| Secrets | Ne pas afficher de secrets dans les logs. | Exigence explicite ; masquage serveur encore à réaliser ou réconcilier avec la cible. | Secrets masqués avant persistance dans le flux affichable et avant transmission au navigateur. La censure CSS ou JavaScript seule est insuffisante. Les diagnostics non sensibles restent disponibles. |
| Droits / maintenance | Conserver les protections et le fonctionnement de l’application pendant la mise à jour. | Invariants existants à vérifier dans la cible. | Le fichier privé n’est pas rendu public ; droits/session/MFA préservés. Le mécanisme de suivi continue à fonctionner lorsque les services applicatifs s’arrêtent. |
| Adaptation PC | L’interface doit s’adapter à la taille de l’écran ; le téléphone n’est pas prioritaire. | Consigne transversale explicite, toujours applicable. | Vérifier largeur **et hauteur** de fenêtres PC, portable et bureau. Redisposer les éléments plutôt que rapetisser toute la page. Ne jamais masquer un avis long pour imposer artificiellement un écran sans défilement. |
| Mouvement | Garder les informations utilisables malgré les effets. | Comportements de maquette à préserver et valider dans la cible. | Textes principaux fixes, pause et `prefers-reduced-motion` respectés. Une nouvelle erreur ou ligne reçue reste visible même si les animations sont en pause. |
| Livraison visuelle | **Captures fixes avant toute nouvelle vidéo**. | Consigne explicite du demandeur, conservée dans les instructions de reprise. | Présenter les captures de la proposition, attendre leur validation avant d’enregistrer une vidéo. Ne pas produire une vidéo au seul motif d’une demande de correction graphique. |

## Séquence de validation et de réalisation

1. **Auditer l’existant en lecture seule.** Constater la branche, les fichiers, le contrat réel, les autorisations,
   le déclenchement de maintenance, la disponibilité du journal et les évolutions depuis ces maquettes.
   Préparer la matrice de compatibilité sans écraser une implémentation plus récente.
2. **Présenter ou rapprocher les captures fixes.** La maquette récente n’a pas reçu d’accord final d’intégration
   dans cette séquence. Consigner précisément l’accord obtenu ; ne pas le déduire d’une correction ou de la demande du dossier.
3. **Porter après accord les seuls éléments couverts.** Adapter l’UI et le raccordement aux capacités réelles.
   Préserver les fonctionnalités, données, droits, statuts et gardes. Le dossier contient des références de rendu,
   pas une application de remplacement.
4. **Exécuter les vérifications pertinentes sur le code porté.** Tests des fonctions affectées, du suivi de phase,
   du journal/masquage, des autorisations et du comportement de retour dans un environnement isolé adapté.
   Puis fournir des captures de l’application intégrée et un résumé technique fidèle des résultats et limites.
5. **Vidéo seulement après validation explicite des captures.** Les vidéos historiques servent au mieux
   de références datées d’animation ; elles n’autorisent pas de nouvel enregistrement et ne prouvent pas
   le comportement de la version cible.
6. **Aucune fusion ni mise en production déduite du présent dossier.** Respecter les branches et le circuit
   d’approbation du dépôt.

Ces règles n’interdisent pas la lecture, la documentation et le rendu de maquettes indépendantes pendant
l’attente de validation. Elles empêchent de présenter une proposition comme déjà intégrée ou testée en production.

## Versions et comportements obsolètes à ne pas porter

Les répertoires anciens peuvent rester nécessaires pour résoudre les imports de la maquette finale. Leur
présence technique ne réhabilite pas leurs choix visuels écrasés par les dernières feuilles de styles.

- **Symbole central unique pour toutes les phases** dans la première proposition orbitale : remplacé par les
  illustrations distinctes de `maintenance-neon-etapes`.
- **Journal en sous-dalle**, avec cadre, titre « JOURNAL DE L’OPÉRATION », compteur, points, trait de frise ou
  séparateurs visibles : explicitement écarté. Le CSS de disposition de cette variante peut être réutilisé,
  mais son habillage ne doit pas réapparaître.
- **Journal ne contenant que « Préparation démarrée », « Installation démarrée », etc.** : ce n’est pas le
  journal technique demandé. Ces phases restent utiles dans la frise principale et pour choisir l’illustration.
- **Dernière ligne du journal systématiquement cyan** : remplacée par du blanc ; les erreurs sont rouges.
- **Limite arbitraire aux sept dernières lignes reçues** comme unique historique : retirée de la maquette.
  Un tampon visuel borné est compatible avec la demande uniquement si l’historique assaini complet est conservé
  selon les règles de rétention et si les interruptions ou omissions ne sont pas silencieuses.
- **Même fond et mêmes accents sans la touche violet récente** : les captures de `maintenance-neon-reseau`
  ou de `maintenance-neon-journal-technique` antérieures au violet ne constituent plus seules la composition finale.
- **Toutes les lignes deviennent rouges parce que l’opération a échoué** : incorrect. Le rouge est propre
  aux messages en erreur, indépendamment du statut global du job.
- **Toute sortie `stderr` est une erreur** ou recherche non contextualisée de « error » : incorrect.
  Des messages tels que « 0 errors » et « no error » ne doivent pas devenir rouges.
- **Défilement infini de faux logs, progression temporelle de 0 à 100 %, ETA ou débit inventés** : à exclure.
- **Démonstrateurs comme client de production** : les fixtures, heures, durées, sélecteur de scènes,
  `focus=1`, galerie de comparaison et retour bloqué par `preventDefault()` n’ont aucune place dans le portage.
- **Coupure générique qui revient toujours à l’installation** : le scénario de maquette simule précisément
  une coupure pendant installation ; la cible doit conserver sa dernière phase et ses derniers logs réellement connus.
- **Succès ou disponibilité déduits du seul visuel ou d’un clic de sélecteur** : réserver ces états aux réponses
  réelles et conserver les gardes de santé/retour de l’existant.
- **Fichier `.log` privé servi directement, ou secret reçu puis caché dans le navigateur** : ne satisfait pas
  la demande de masquage et compromet les protections existantes.

## Sources de référence finales

Le point d’entrée de la composition récente est [maquette/index.html](maquette/index.html), issu de `maintenance-neon-journal-erreurs/index.html` dans les sources locales. Les références fixes sont regroupées dans [visuels/](visuels/). La planche des six illustrations
décrit les mouvements par phase, mais représente un état antérieur du journal : ne pas la lire comme une
référence complète de page finale.

Ordre de composition CSS à préserver ou à consolider : `studio.css` → `effects.css` → `phases.css` →
`journal.css` de disposition → `direct.css` → `technique.css` → `violet.css` → `erreurs.css`.

Ordre des JavaScript de **maquette** : `studio.js` → `technique.js` → `direct.js` → `erreurs.js`.
Ces scripts expliquent l’intention visuelle ; leur moteur de scénarios ne remplace pas les services réels.
Les détails du mapping UI sont dans [04-PORTAGE-UI-ET-ANIMATIONS.md](04-PORTAGE-UI-ET-ANIMATIONS.md),
et ceux du journal dans [05-JOURNAL-COMPLET-ET-SECRETS.md](05-JOURNAL-COMPLET-ET-SECRETS.md).

**État de ce document :** synthèse documentaire en lecture seule des demandes et des sources de maquette.
Aucune nouvelle capture, vidéo, modification applicative, exécution de test applicatif ou validation humaine simulée.
