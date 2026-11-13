# Plan de portage ciblé

## 1. Vérifier la base de travail

Lire AGENTS/HANDOVER et l’état Git du dépôt cible. Le backend assistant existe déjà sur sa branche dédiée ; identifier la version qui sera utilisée et respecter ses règles de PR. Ne pas fusionner implicitement tout le backend ou toute la refonte, ni travailler directement sur main.

Le portage du visuel de ce dossier est validé. Préserver les modifications récentes du dépôt cible, le service Mistral, les documents, les comptes, les droits et les routes. Le paquet ne fournit ni environnement ni secrets.

## 2. Ajouter les sources de l’assistant

Les fichiers de `sources/` et le test unitaire de `tests/` sont exacts au commit `04a310f`. Les comparer d’abord à la cible. On peut copier ces **nouveaux fichiers ciblés** ou utiliser `patches/01-assistant-nouveaux-fichiers.patch` si leurs chemins sont encore libres. Le test est inclus dans ce patch.

Depuis la racine du dépôt cible, après lecture du patch :

```bash
git apply --check /chemin/du/dossier/patches/01-assistant-nouveaux-fichiers.patch
```

Puis appliquer le patch si le contrôle est réussi et le diff conforme au portage demandé. Si les fichiers existent déjà, les réconcilier ; ne pas forcer l’écrasement. Ne pas appliquer ce patch dans le dossier de livraison lui-même.

Dans `contrats.ts`, utiliser les DTO/constantes de `@suivi/shared` de la branche assistant lorsque leurs formes correspondent. Les fonctions de disponibilité, contexte et comptage restent nécessaires. Garder une seule définition modifiable de chaque contrat, pas un deuxième backend ou modèle de données.

## 3. Raccorder trois points partagés

Le patch `02-raccordement-global-reference.patch` est extrait du portage **338f40d → 04a310f** sur la branche de refonte. Il n’est pas présumé applicable tel quel à `claude/assistant-rssi` : ses imports, sa navigation et son router peuvent avoir évolué. Reprendre ses changements sémantiques dans la version courante, sans copier un ancien fichier partagé entier.

- **Layout** : importer `AssistantGlobal`, garder un état `assistantPinned`, affecter `data-assistant-pinned` au cadre et monter le composant en frère du contenu avec `onPinned={setAssistantPinned}`. L’instance vit hors de l’Outlet métier et ne doit pas se recréer à chaque page.
- **Router** : conserver un cadre authentifié commun, y compris pour `/admin/:tab?`. L’autorisation d’administration reste une garde enfant utilisant le contrôle existant (`canAdminArea` dans la référence). Ne pas retirer connexion, MFA, refus d’accès ou garde serveur pour préserver un brouillon.
- **CSS** : importer `neon-assistant.css` une seule fois depuis la feuille Neon déjà chargée. Préserver les autres imports, CSP et styles existants. Ne pas embarquer toute la refonte pour obtenir l’arrière-plan d’une capture.

Si le cadre cible est déjà commun, ne pas refaire inutilement sa structure : vérifier simplement la persistance et le contrôle d’accès. Les écrans de connexion et mural restent hors du compagnon de travail authentifié.

## 4. Réconcilier la branche assistant

Conserver les routes et liens directs `/assistant/:id` ; les raccorder au fil global sans deux discussions concurrentes à l’écran. L’entrée quotidienne devient flottante, pas un nouvel item du menu métier. Conserver l’administration et ses droits, les rondes, missions, mémoire/méthodes, supervision et suppression existantes.

Utiliser l’identité courante pour le cache privé et la remise à zéro de session. Préserver les brouillons à l’erreur et lors de la navigation ; ne jamais affecter une réponse tardive au profil désormais affiché. Le contexte joint reste un instantané, et les notifications personnelles ne gagnent pas artificiellement un profil.

La réservation de largeur exclut la cartographie. Ne pas changer son canevas, sa génération ni ses vues. Ne pas toucher aux autres modules, aux exports métier ou aux données.

## 5. Vérifier et livrer

Exécuter les contrôles adaptés au dépôt cible, puis la recette du service réel dans une pile de test isolée autorisée. Le patch ne déclenche aucune migration, notification, conversation ou décision par lui-même. Ne pas utiliser les fixtures en production.

Livrer le diff final, ses tests réellement exécutés, un visuel intégré et un résumé IA. Le raccordement Mistral et les branches réunies ne sont pas validés par les seules preuves de frontend de ce paquet. Ne pas publier ou déployer le résultat sans l’autorisation applicable.
