> **Suite du 12/11/2026 : visuel validé par « top ». [Portage frontend et contrôles](../../ASSISTANT-RSSI-GLOBAL-INTEGRE.md).** Ce dossier conserve la proposition et ses preuves historiques ; le rapport distingue frontend intégré et backend encore sur sa branche dédiée. Correction de portage : `enPause` suspend les rondes, pas le chat.

# Assistant RSSI — présence globale Studio

**12 novembre 2026 · Proposition autonome à valider, non intégrée.**
Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

Demande : donner une interface de discussion, une icône et un avatar à l’assistant Mistral déjà connecté, présent dans toute la plateforme, sans le cantonner à une rubrique. L’utilisateur précise que le raccordement est sur la branche « assistant RSSI ». Source retrouvée : **`claude/assistant-rssi`**, consultée en lecture seule et figée au commit [`575154f42a1c5d4ebe5ec218b7d18e2fae7b26a5`](https://github.com/yousername-ha/suivi-audits/tree/575154f42a1c5d4ebe5ec218b7d18e2fae7b26a5).

L’application sur `codex/refonte-neon-main` reste celle de `ee8b524` (Fournisseurs intégrés). Aucun fichier de `apps/` ou `packages/`, API, permission, migration ou dépendance modifié ; aucune fusion de la branche assistant, requête Mistral, notification réelle, archive Docker, publication ou push. La règle visuel → validation → intégration/tests → visuel intégré reste applicable.

## Proposition à évaluer

- Une entrée flottante en bas à droite, badge des points à suivre et avatar SVG original : bouclier/dialogue bleu et turquoise, regard discret, orbite lente et pause. Ce n’est pas un logo officiel Mistral. Mouvement réduit du système respecté.
- Un panneau non modal, réductible, épinglable sur grand écran et agrandissable. La conversation et ses brouillons restent en mémoire pendant la navigation. Le fil et les suivis ont leur propre défilement ; le panneau reste dans la hauteur disponible.
- Une discussion distincte pour **Mise en œuvre** et **Audit interne**, historique propre et création d’une nouvelle discussion. Le profil d’une conversation existante ne change pas.
- La page courante peut être jointe explicitement à la prochaine question. Ce contexte est un instantané de navigation ; il ne change pas lorsque l’on navigue et n’est pas présenté comme une source déjà lue.
- Des boutons de sources consultées, avec détail de la fiche, sans citation ou contenu de document inventé.
- **Pour vous** rassemble la question reçue, le rappel et l’action proposée. Réponse, lecture, avis, examen puis confirmation/rejet sont simulés. La question dans le fil et celle de la boîte ont le même identifiant et le même état.
- « Demander un suivi » confie une consigne au profil courant pour ses prochaines rondes. Ce n’est pas un calendrier de rappels à date/heure arbitraires.
- Thèmes clair/sombre, contours nets, cyan/bleu pour l’assistant, ambre pour une réponse attendue. L’utilisateur garde la page accessible ; le panneau ne piège pas le focus. Échap agit seulement lorsque le focus se trouve dans l’assistant.

Ouvrir [l’aperçu autonome](apercu-autonome.html), puis essayer la réduction, l’agrandissement, la navigation Tableau de bord/Fournisseurs, les profils et l’onglet Pour vous. **Toutes les données et les réponses sont fictives, sans réseau.** L’état est conservé pendant la session de la page, pas après un rechargement. Les pages d’arrière-plan servent uniquement à montrer la présence transversale ; ce dossier ne propose pas une nouvelle refonte du Dashboard.

Une seule [image HD](https://raw.githubusercontent.com/yousername-ha/suivi-audits/55d43eebbc77fa2e367037b246e5396ced79abc8/docs/refonte-neon/propositions/assistant-global/assistant-global-hd.png), capture native de Chromium en 1920×1080 à densité 2, soit **3840×2160**. Elle montre le même fil après passage de Fournisseurs au Tableau de bord. Le clair et les autres états sont dans l’aperçu interactif, sans multiplication des captures.

## Résumé technique pour reprise IA

`index.html` héberge le panneau en frère du shell, hors des pages. Il réutilise le décor fictif Fournisseurs de la proposition précédente et un arrière-plan Dashboard illustratif. Aucun lien Assistant n’est ajouté au menu principal.

`assistant.css` est isolé par `as-`/`--as-*`. Le dock est fixe, borné en hauteur ; le fil, l’inbox et les détails utilisent `min-height: 0` et un défilement local. À partir de 1700 px, l’épinglage réserve la largeur du panneau dans le shell ; en dessous, le panneau se superpose. Une largeur agrandie est disponible. La maquette d’arrière-plan Fournisseurs conserve sa propre liste avec défilement horizontal si ses colonnes ne tiennent pas ; aucune miniature de la page n’est appliquée.

`assistant.js` contient seulement l’état local : conversations et brouillons par identifiant, profil courant, contexte joint par conversation, navigation, onglets, sous-vues, notifications personnelles et décisions simulées. `renderComposer()` applique disponibilité, quota et longueur ; `sendMessage()` rattache le résultat à la conversation initiale, même après un changement de profil. `decide()` contrôle le droit avant mutation locale. Les textes interpolés sont échappés ; aucune réponse utilisateur/modèle n’est exécutée comme HTML. Pas de `fetch`, stockage persistant ni appel de modèle. `ASSISTANT_APERCU` expose des commandes réservées à la recette de cette maquette (états/droits/échec suivant/snapshot), à ne pas porter en production.

`donnees-assistant.js` fournit les familles de DTO fictives et les deux profils. Les données reprennent les formes du service autant que possible ; elles ne remplacent ni une réponse serveur ni une autorisation. Les identifiants `demo-*` et `simulation-*` ne représentent pas des objets réels. Les compteurs sont dérivés du scénario local, pas d’une activité de production.

`exporter.py` incorpore les styles, scripts et polices locales dans `apercu-autonome.html`. Cet export est destiné à la consultation ; ne pas copier ses scripts en ligne sous la CSP applicative. Sources et capture sont empreintées dans [validation.json](validation.json).

### Contrats réellement retrouvés dans la branche assistant

| Besoin de l’interface | Contrat existant au commit consulté | Consigne de portage |
| --- | --- | --- |
| Disponibilité, fournisseur, profils/périmètres autorisés | `GET /api/assistant/etat` | Afficher le fournisseur effectif. Respecter `actif`, `pret`, `motif`, `enPause`, droits utilisateur et intersection des périmètres. Aucun accès global implicite. |
| Créer/charger une discussion | `GET/POST /api/assistant/conversations`, `GET/DELETE /api/assistant/conversations/:id` | POST strict `{profil}`. Conserver l’historique, la suppression existante et les liens directs. Le prototype illustre seulement historique/création. |
| Envoyer un message | `POST /api/assistant/conversations/:id/messages` | Corps strict `{texte}`, 4000 caractères maximum. Pas de champ `context` inventé : joindre la référence de page dans le texte, visiblement, en comptant ce préfixe dans la limite. |
| Attendre une réponse | Conversation `etat: 'en_cours' / 'pret'`, relecture actuelle toutes les 1500 ms | Pas de streaming ni de route d’annulation constatés. La maquette simule une attente, pas des jetons reçus en direct. Préserver l’erreur et la reprise serveur lors du portage. |
| Sources d’une réponse | `SourceAssistant {perimetre, objet?, type?, nom}` | Métadonnées de fiches. Ne pas fabriquer pages de PDF, extraits, version, score de confiance ou droit d’ouvrir un document. Navigation réelle vers la fiche après vérification des droits. |
| Boîte personnelle | `GET /api/grc/notifications` | Les notifications propres au destinataire **ne portent pas de profil**. Ne pas les filtrer arbitrairement par profil, ni déduire celui-ci du texte. |
| Répondre à une question reçue | `PUT /api/grc/notifications/:id/reponse`, `{texte}`, max. 2000 | Garde serveur sur le destinataire. Pas besoin du droit assistant pour répondre à sa propre notification. La réponse est reprise à une prochaine ronde, sans réponse immédiate du modèle promise. |
| Lire un rappel / donner un avis | `PUT /api/grc/notifications/:id/read`, `PUT /api/grc/notifications/:id/avis` avec `{avis:'utile'|'inutile'}` | Réutiliser les identifiants et retours serveur, ne pas envoyer de notification depuis le navigateur. |
| Confier un suivi | `GET/POST /api/assistant/missions`, POST `{profil,consigne}`, max. 2000 | Respecter `assistant:modifier` et le profil ; traitement lors des prochaines rondes. Pas de nouvelle API de calendrier ou de date/heure de rappel supposée. |
| Examiner une proposition | `GET /api/assistant/propositions`, `POST /api/assistant/propositions/:id/decision` | Corps existant `{decision:'confirmer'|'rejeter',titre?,description?,echeance?,note?}` ; `echeance` date ou null. Une action réelle n’est créée que par le service après confirmation autorisée ; ne pas modifier directement le registre côté UI. |
| Questions de supervision et rondes | `GET /api/assistant/questions`, `GET/POST /api/assistant/rondes` | La liste de supervision n’est pas l’API des réponses du destinataire. Garder administration, mémoire/méthodes, missions et réglages existants ; ce dock ne les remplace pas. |

Sources lues dans cette référence :

- `apps/web/src/assistant/AssistantPage.tsx` : conversations, état, sources et interrogation périodique.
- `apps/web/src/assistant/AutonomieAssistant.tsx` : questions, propositions, missions, rondes et décisions.
- `apps/web/src/pages/Pilotage.tsx`, composant `Reminders` : notifications personnelles et réponse.
- `apps/api/src/routes/assistant.ts`, `assistant/{index,outils,agent,rondes}.ts` et `packages/shared/src/assistant.ts` : gardes, outils, DTO, limites et autonomie.
- `docs/adr/0086-assistant-rssi-integre.md` : architecture, distinction des deux profils et développement isolé de l’assistant.

**Documents :** l’ADR prévoit l’accès au texte/indexation ; au commit consulté, les outils lus consultent les fiches/registries et leurs métadonnées, sans extraction de PDF/Word retrouvée. Le prototype prépare la présentation des sources mais ne prouve pas un RAG documentaire opérationnel. Vérifier l’évolution de la branche avant raccordement ; si une nouvelle API apporte le texte extrait, la citer et l’utiliser réellement avant d’afficher des extraits. Le nom du modèle de démonstration n’est pas une preuve de configuration réelle.

### Intégration future après validation explicite

Monter un hôte global au niveau du layout authentifié, **au-dessus de l’Outlet des pages**, avec un état/provider stable et les services existants de `claude/assistant-rssi`. Ne pas recréer le composant à chaque navigation ni relabeller une conversation lors d’un changement de profil. Réconcilier avec la version alors courante de la branche, sans remplacer son backend ou fusionner son contenu implicitement. Son ADR prévoit un travail isolé jusqu’à approbation de la PR RSSI.

Porter dans React/Mantine/`packages/ui`, avec requêtes, états/erreurs serveur, CSRF, droits et périmètres existants. Le menu masqué ne constitue pas une garde. Conserver l’entrée d’administration, ses permissions et les routes/liens existants ; l’entrée flottante sert le travail quotidien. Respecter un modèle configuré différent de Mistral si le serveur le renvoie. Afficher uniquement les sources reçues et ne jamais considérer le contexte joint comme une source vérifiée.

Prévoir la fermeture sur déconnexion et la purge des brouillons/contextes quand la session change ; chargement et historique sur API, erreurs, budget, absence de périmètre et disponibilité du module. Ne pas mémoriser de contenu sensible en stockage navigateur sans décision dédiée. La réponse asynchrone doit rester dans sa conversation d’origine. Révoquer/réinterroger les droits côté serveur ; jamais créer une action en faisant confiance à la seule visibilité d’un bouton.

Conserver le travail en cours de la page, son scroll et son focus lors d’un rappel entrant ; badge discret sans ouverture forcée. Coordonner avec les dialogues natifs, formulaires, cartes et plein écran. Ne pas réserver une marge pour le dock dans les zones qui doivent garder leur canevas native ; la cartographie et sa génération demeurent inchangées. La règle PC reste prioritaire, le téléphone n’est pas un prérequis de ce lot.

## Contrôles exécutés sur cette maquette uniquement

- **13 parcours** : brouillons/navigation/focus ; séparation des profils/historique ; réponse asynchrone rattachée au bon fil ; réponse à la question et échec conservant le texte ; lecture/avis du rappel ; proposition éditée, échec et confirmation ; rejet sans création ; gardes de droits ; consigne de suivi/échec ; sources et clavier ; indisponibilité/quota/périmètre absent ; limites 4000/2000 ; pause/mouvement réduit.
- **16 dispositions PC**, soit huit tailles dans les deux thèmes : 1024×768, 1280×720, 1366×768, 1440×900, 1536×864, 1920×1080, 2560×1440 et 1920×800. Dock et compositeur dans l’écran, fil lisible, sans débordement de page, épinglage au seuil prévu. L’inbox longue défile localement.
- **Quatre analyses Axe** (discussion et Pour vous, clair/sombre), aucune violation détectée dans le passage final. Le premier passage avait signalé le cyan des boutons du thème clair à 4,41:1 ; couleur foncée puis passages répétés. Ce n’est pas une certification complète d’accessibilité.
- Aucun appel API ni erreur JavaScript pendant ces parcours. ESLint ciblé et format des quatre sources HTML/CSS/JS réussis. Export autonome ouvert avec une seule requête, aucune ressource externe ni erreur JavaScript ; navigation, onglets et ouverture d’une proposition contrôlés. Deux analyses Axe supplémentaires sur l’export Dashboard/discussion, clair/sombre, sans violation détectée. Capture PNG vérifiée à 3840×2160. Détail dans le reçu.

Commandes de source :

```bash
node node_modules/eslint/bin/eslint.js --no-warn-ignored docs/refonte-neon/propositions/assistant-global/assistant.js docs/refonte-neon/propositions/assistant-global/donnees-assistant.js
node node_modules/prettier/bin/prettier.cjs --check --ignore-path /dev/null docs/refonte-neon/propositions/assistant-global/index.html docs/refonte-neon/propositions/assistant-global/assistant.css docs/refonte-neon/propositions/assistant-global/assistant.js docs/refonte-neon/propositions/assistant-global/donnees-assistant.js
python3 docs/refonte-neon/propositions/assistant-global/exporter.py
```

Environnement : Node 26, Python 3, Chromium système via Playwright déjà présent, données fictives, serveur HTTP local. Les scripts de recette ponctuels et rapports bruts sont privés hors Git ; seul le reçu synthétique est public.

**Non exécutés :** build/tests de l’application, recette des vrais endpoints, moteur Mistral, extraction documentaire, rondes réelles, notification sortante, authentification/DB/Docker et essai Windows. Aucune validation humaine déduite des contrôles. Suite : avis sur ce visuel, puis raccordement autorisé, tests applicatifs ciblés et capture de l’application intégrée.
