# Assistant RSSI global — intégration du frontend

**12 novembre 2026 · Visuel validé par « top », puis portage et contrôles.**
Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

L’interface proposée dans [la maquette Assistant global](propositions/assistant-global/README.md) est portée dans le frontend sur `codex/refonte-neon-main`, à partir de `338f40d`. L’entrée flottante et le panneau appartiennent au cadre global de la plateforme : aucune nouvelle rubrique principale. Une seule [capture HD du frontend compilé](preuves/assistant-global/assistant-integre-hd.png), **avec API fictive interceptée**, et non une capture du service Mistral en fonctionnement.

## État exact et limite de raccordement

La branche indiquée par l’utilisateur est **`claude/assistant-rssi`**, relue au commit [`460060a1e3b3597556bba0d64633d13146982c2b`](https://github.com/yousername-ha/suivi-audits/tree/460060a1e3b3597556bba0d64633d13146982c2b), plus récent que la référence de la maquette (`575154f`). Le service ajoute désormais des propositions de **constats d’audit**, conservées comme telles dans le panneau.

**Seul le frontend est intégré ici.** Le backend Mistral reste sur sa branche dédiée : aucun fichier API, schéma partagé, droit, module ou migration n’est porté/fusionné par ce lot. L’ADR 0086 de la branche assistant impose de conserver ce développement isolé jusqu’à l’approbation de sa PR RSSI. Les appels du panneau utilisent ses contrats existants ; il n’existe aucun moteur local, réponse fictive de remplacement ou activation automatique dans le frontend livré.

Sur le Docker de refonte actuel, sans permission `assistant:lire` ni service assistant, la discussion reste absente. Les notifications personnelles déjà reçues peuvent rendre la boîte accessible. Pour utiliser ce panneau avec Mistral dans ce Docker, il faudra **réunir les changements frontend avec la branche backend assistant**, vérifier son état alors courant et effectuer la recette complète de cette pile. La capture prouve le portage du frontend et ses appels attendus avec interception, pas cette réunion ni une persistance réelle.

## Résumé des modifications pour une IA connaissant le code

| Fichier | Changement et raison |
| --- | --- |
| `apps/web/src/components/Layout.tsx` | Monte `AssistantGlobal` en frère du contenu des pages ; conserve son instance pendant la navigation. Un état `assistantPinned` réserve la largeur à la demande. Menu métier, déconnexion et préférences conservés. |
| `apps/web/src/main.tsx` | Réunit les anciennes routes `/admin/:tab?` sous le même cadre authentifié, avec une garde `RequireAdministration` utilisant le même `canAdminArea`. Évite le démontage du panneau/brouillon lors du passage par ces adresses ; refus sans droit vérifié. |
| `apps/web/src/assistant/AssistantGlobal.tsx` | Hôte de disponibilité/droits et panneau React : fils, historique/création/suppression confirmée, brouillons et contexte par conversation, profils séparés, sources, boîte personnelle, réponse/lecture/avis, examen/décision de proposition, mission de suivi. Appels via `api/get` existants (cookie/CSRF), cache TanStack Query et attente serveur. |
| `apps/web/src/assistant/contrats.ts` | Petit pont de types frontend vers les DTO de `460060a`, sans ajouter le module au schéma partagé de cette branche. Fonctions de disponibilité, contexte visible dans `{texte}` et comptage des points personnels. À remplacer par les imports `@suivi/shared` appropriés lorsque les branches seront réunies. |
| `apps/web/src/assistant/IdentiteAssistant.tsx` | Avatar SVG original avec identifiants de dégradé uniques et icônes locales ; aucune image distante, marque Mistral copiée ou couleur dans les composants. |
| `packages/ui/src/neon-assistant.css`, import dans `neon.css` | Habillage isolé `as-*`, palettes clair/sombre, formes biseautées, fil/inbox/détails à défilement local, panneau épinglé/agrandi, animations discrètes avec pause et mouvement réduit. Aucun style applicatif en ligne ni nouvelle dépendance. |
| `apps/web/test/assistant-global.test.ts` | Huit cas de régression métier : la pause des rondes laisse le chat disponible, quota serveur, profil/périmètre, motif, contexte compté dans la limite, question lue encore en attente, rappel lu et autres notifications. |
| `tests/e2e/interface/assistant-{fixture.ts,global.spec.ts}`, `fixtures/assistant-global.json` | Dix parcours du frontend compilé. Réponses explicitement fictives et interceptées, compte des écritures, corps stricts et CSRF. Aucune écriture réseau réelle ni clé de modèle. |

### Comportement et état

- Une entrée discrète globale, panneau non modal fermé au démarrage, agrandissement et épinglage optionnels sur les grands écrans. La discussion, son brouillon et ses références de page survivent aux changements de rubrique et à la réduction du panneau, **pas à un rechargement ou changement de session**.
- `AssistantGlobal` lit les permissions reçues du serveur et n’appelle `/api/assistant/*` qu’avec `assistant:lire`. Les permissions brutes sont utilisées comme pont car le module n’existe pas encore dans les types partagés de la branche de refonte. Le serveur reste seul juge ; un refus/une absence du service n’active aucune simulation. L’hôte remonte avec une nouvelle clé quand l’identité ou le droit de lire change.
- Les requêtes privées utilisent le préfixe `assistant-global` et l’identité. Elles sont couvertes par la purge privée de `logout.ts` existante. Le composant vérifie son démontage avant d’appliquer un résultat de mutation tardif ; aucune écriture de cache après sa disparition. Aucun contenu de conversation en `localStorage`.
- Les profils **Mise en œuvre** et **Audit interne** gardent leurs propres sélections et fils. Les conversations chargées sont vérifiées contre le profil courant avant affichage. Une réponse asynchrone met à jour sa conversation d’origine, pas celle affichée après une navigation. Le fil est relu toutes les **1500 ms uniquement tant que le serveur le déclare en cours**, sans streaming ni annulation inventés.
- Une nouvelle discussion n’est créée qu’après une action explicite (bouton ou premier envoi). Une conversation créée dont le premier message échoue est conservée pour réessayer sans créer un second fil. Les saisies/contextes restent disponibles en cas d’erreur. La suppression utilise la confirmation existante et ne concerne que le fil choisi.
- Le contexte est **joint explicitement** à la question dans le champ strict `{texte}`. Il inclut nom/page/périmètre connu, reste visible avant envoi et figé pendant la navigation. La longueur du préfixe entre dans les **4000 caractères**. Aucun champ serveur `context` ajouté, aucune collecte silencieuse du contenu d’une page.
- Les messages sont rendus comme texte React, sans HTML de modèle exécuté. Les sources sont celles du DTO reçu, sans extraits/pages/confiance inventés. Le détail distingue une fiche documentaire du contenu d’un fichier ; l’accès utilise le lien de synthèse du périmètre déjà prévu par le service source.
- La boîte **Pour vous** affiche les notifications personnelles `assistant_question` et `assistant_rappel`, **sans filtrage par profil**, car ces DTO n’en portent pas. La question peut aussi apparaître sous une conversation qui cite réellement le même objet/périmètre. Les deux vues partagent notification et réponse ; une lecture seule ne retire pas une question non répondue du compteur.
- Un destinataire répond via `/api/grc/notifications/:id/reponse` sans droit de discussion requis. La réponse est annoncée comme reprise lors d’une **prochaine ronde**. Lecture et avis réutilisent les routes de notification ; toutes les mutations sont attendues et les erreurs conservées. Les invalidations sont communes avec les vues GRC existantes et leur temps réel.
- Les propositions restent identifiées **action ou constat**, avec leur profil, nature et avertissement `sourceIssueAssistant` si fourni. `assistant:modifier` conditionne la décision ; titre 200, description 2000, note 500, date ou null, corps strict existant. Une confirmation de constat crée un **brouillon**, sans validation/publication d’audit par l’interface. Une action n’est créée que par le service après confirmation. Rejet et résultats viennent du serveur, aucun identifiant de création inventé.
- « Demander un suivi » appelle la mission existante `{profil,consigne}`, 2000 caractères, pour ses prochaines rondes ; aucune heure/date de rappel arbitraire promise.
- **Correction du scénario initial : `enPause` signifie pause des rondes, pas quota ni interdiction du chat.** La production laisse le dialogue actif ; le budget est évalué séparément avec `jetonsDuJour`/`budgetJetonsJour` et les erreurs du serveur. Les preuves historiques de maquette restent datées, sans leur attribuer cette correction.

### Proportions et zones préservées

Le dock est borné à la hauteur disponible, sans agrandir ou miniaturiser la page par un zoom. Son fil et ses listes ont leur propre défilement ; le compositeur et les commandes restent accessibles. Sur les petits écrans PC, le panneau se superpose ; à partir de 1700 px, l’épinglage réserve de la place dans le contenu, pas dans le menu/en-tête. Le mode agrandi ne réserve pas cette marge.

**La cartographie `/cartographie/*` ne réserve aucune largeur pour l’assistant** : canevas, cadrage, génération automatique et présentation existante conservés. Rien dans l’éditeur n’est modifié. Les dialogues de l’application restent au-dessus du panneau et gardent leur focus ; Échap n’agit sur le dock que depuis un élément de celui-ci. La préférence système réduit les mouvements ; le bouton de pause l’indique au lieu de prétendre réactiver une animation interdite par le système.

## Vérifications réellement exécutées

- TypeScript web et E2E : **réussis** ; ESLint ciblé et format des fichiers touchés : **réussis**.
- Build frontend Vite : **réussi**. Avertissements non bloquants conservés : script externe `/update/client.js` sans `type=module` et bundle principal supérieur au seuil conseillé de 900 kB. Aucun seuil abaissé, dépendance ou sécurité CSP changée pour les masquer.
- Vitest web : **287 tests**, dont les huit nouveaux ; Vitest UI : **246 tests**, réussis sur cette livraison.
- Playwright : **17 parcours réussis** dans le passage final, soit dix Assistant et sept Fournisseurs. Les sept Fournisseurs ont été rejoués pour ce lot transversal ; ce ne sont pas uniquement les résultats historiques de sa livraison.
- Contrôle complémentaire du frontend compilé : **16 dispositions PC** (huit tailles, clair/sombre) : 1024×768, 1280×720, 1366×768, 1440×900, 1536×864, 1920×1080, 2560×1440, 1920×800. Dock, fil et compositeur bornés, pas de débordement horizontal de la page ; vérification supplémentaire à 150 % de taille d’affichage en 1920×1080.
- Assistant : **quatre analyses Axe** discussion/Pour vous, clair/sombre ; une analyse supplémentaire Dashboard/discussion dans la capture, sans violation détectée. Fournisseurs : **quatre analyses** registre/consultation clair/sombre dans les sept parcours rejoués, sans violation détectée. Pas une certification d’accessibilité exhaustive.
- Une capture native **3840×2160**, viewport 1920×1080 à densité 2. Visuel inspecté ; aucune recomposition ni retouche de capture. Données exclusivement fictives ; aucun appel de modèle ou notification sortante.

Les premiers parcours ont fait ressortir deux problèmes de recette : réponse Dashboard fictive de mauvaise forme (complétée avec les DTO attendus, sans modifier le Dashboard), et repérage du libellé implicite de réponse après erreur (libellé explicite du textarea). Le test de reprise conserve ses assertions de texte. L’historique/suppression a été ajouté puis vérifié. La continuité de l’ancien chemin `/admin/*` et son refus sans droit sont vérifiés dans un dixième parcours Assistant ; la garde reste appliquée au sein du même cadre authentifié. Les essais ponctuels de capture ont aussi demandé un contexte ESM et le bon intitulé « Bonjour Démonstration », sans modification produit pour ces erreurs de setup.

Commandes usuelles, depuis le dépôt (Node 26 et dépendances déjà installées) :

```bash
node node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p tests/e2e/tsconfig.json --noEmit
cd apps/web
node scripts/mantine-css-vars.ts
node node_modules/vite/bin/vite.js build
node node_modules/vitest/vitest.mjs run
cd ../../packages/ui
node node_modules/vitest/vitest.mjs run
cd ../../tests/e2e
PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium node node_modules/@playwright/test/cli.js test --config playwright.interface.config.ts assistant-global.spec.ts fournisseurs-studio.spec.ts
```

Le serveur de fichiers de `playwright.interface.config.ts` ne fournit **aucune API** ; les fixtures interceptent les requêtes dans le navigateur. Ici un serveur statique dédié 5216 a été utilisé avec `E2E_UI_URL`, sans service métier. Le script ponctuel de capture/contrôles complémentaires et les sorties brutes restent privés hors Git ; le [reçu synthétique](preuves/assistant-global/controles.json) conserve résultats et empreintes.

**Non exécutés :** tests API/DB, véritable conversation Mistral, droits serveur/rondes réels, notifications sortantes, extraction/indexation documentaire, Docker Desktop Windows, reconstruction d’image ou ZIP. Aucune publication, fusion ou déploiement. Les tests avec interception ne valident pas ces opérations.

## Prochaine reprise

Réunir ce frontend avec le backend approuvé de la branche assistant sur une branche de travail dédiée, remplacer les alias DTO par les imports partagés et conserver ses réglages/administration, routes de conversation, rondes, missions, mémoire, méthodes et supervision existants. Si la réunion réintroduit une entrée de menu quotidien `/assistant`, la remplacer par cet accès global, **en préservant la route et les liens directs** ; raccorder ces liens au fil global sans afficher deux interfaces de conversation concurrentes. Ne pas retirer l’administration. Relire la référence serveur alors courante, rejouer les parcours avec le vrai service dans une pile de test isolée, puis fournir le visuel Docker demandé à ce stade. La cartographie demeure de côté.

PR ouvertes consultées pendant le lot : aucune au moment du contrôle ; aucun fichier distant modifié.
