# Consigne à transmettre à Claude ou à une autre IA

Tu reprends **l’implémentation de l’assistant IA RSSI uniquement** dans l’application Suivi des audits SMSI. La proposition visuelle contenue dans ce dossier est validée ; le frontend de référence est `04a310fe14efaf9878268bd3c20589c87fcd127c`. Le service Mistral existe dans `claude/assistant-rssi`, référence lue `460060a1e3b3597556bba0d64633d13146982c2b`. Ce paquet n’embarque pas son backend et n’autorise pas à le réécrire.

Commence par lire les instructions du dépôt cible, son état Git et les contrats de sa branche assistant. Travaille dans une branche dédiée, pas directement sur main. La demande couvre le portage de cette interface validée et ses vérifications ; ne redemande pas une validation des mêmes choix visuels. Si tu proposes un autre design, présente d’abord son visuel avant de le porter.

## Résultat attendu

Une présence accessible dans toute la plateforme authentifiée : icône/avatar animé, bouton flottant, panneau de discussion, historique et boîte personnelle « Pour vous ». L’instance et les brouillons restent stables pendant les changements de rubrique, y compris les anciennes routes d’administration. Ce n’est pas une nouvelle entrée du menu métier. Conserve les routes/liens directs et les fonctions d’administration existantes, sans afficher deux interfaces de conversation concurrentes.

Utilise les quatre sources de `sources/` et adapte les trois raccordements du patch de référence aux fichiers actuels. Ne remplace pas `Layout.tsx`, `main.tsx` ou `neon.css` par une ancienne version entière. Le composant doit être au niveau du cadre authentifié commun, hors des pages de l’Outlet. Conserve les gardes de connexion/MFA, les contrôles d’administration et les API existantes.

Dans la branche qui possède déjà les DTO partagés, remplace les interfaces du pont `contrats.ts` par les imports/types de `@suivi/shared` correspondant à cette version. Conserve les fonctions de contexte, disponibilité et comptage utilisées par les composants/tests. Ne crée pas de deuxième module, table, réglage de modèle ou service de conversation.

## Invariants

- Profils Mise en œuvre/Audit interne distincts ; aucune réponse tardive déplacée dans un autre fil.
- Sources affichées à partir du serveur ; pas de texte de PDF, page, indexation ou confiance inventés.
- Page jointe explicitement, instantané visible compté dans `{texte}` ; aucune collecte silencieuse du contenu d’une page.
- Notifications personnelles sans profil : ne pas filtrer arbitrairement la boîte selon le profil de discussion. Réponse autorisée au destinataire sans exiger `assistant:lire`.
- `enPause` suspend les rondes automatiques, **pas le chat**. Quota et disponibilité restent distincts.
- Aucun registre modifié sans la décision autorisée existante ; constat créé en brouillon, jamais validé/publié automatiquement par le panneau.
- Aucun faux moteur ou réponse de démonstration dans le code applicatif ; fixtures uniquement dans les tests.
- Droits et périmètres contrôlés par le serveur ; réutiliser le client API/cookie/CSRF et la purge de session existants.
- PC prioritaire, fil et listes avec défilement local, panneau borné en hauteur ; pas de zoom global qui miniaturise la plateforme.
- La cartographie et sa génération automatique sont conservées ; aucune marge réservée au dock sur son canevas.
- Préserver les autres modules, la charte existante et les données. Ne pas porter le Dashboard, Fournisseurs, Budget/CRRC ou toute la refonte à partir des arrière-plans des visuels.

## Livraison

Effectue les contrôles ciblés de `05-RECETTE-ET-PREUVES.md` et la recette du vrai service seulement dans une pile de test isolée autorisée. Les tests avec interception ne prouvent pas les droits serveur, la persistance ou Mistral. Fournis une capture du résultat intégré.

**Toujours livrer un résumé compréhensible par une IA connaissant le code** : fichiers et fonctions modifiés, changement de comportement et contrats, contrôles réellement exécutés, résultats, limites, reste à faire et commit. Conserve cette reprise dans le HANDOVER du dépôt cible. Ne transforme pas les preuves historiques de ce paquet en tests nouvellement exécutés. Ne publie, ne fusionne ni ne déploie sans l’autorisation applicable au dépôt ; la création de ce dossier n’effectue aucune de ces opérations.
