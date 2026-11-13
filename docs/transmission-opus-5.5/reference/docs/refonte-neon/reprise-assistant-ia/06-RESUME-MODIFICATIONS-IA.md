# Résumé technique pour reprise IA

## Code de référence livré

Le frontend `04a310fe14efaf9878268bd3c20589c87fcd127c` ajoute le compagnon global à `Layout`, en frère du contenu des pages. L’ancienne branche `/admin/*` passe sous le même cadre authentifié, avec une garde enfant conservant `canAdminArea`, pour ne pas perdre le brouillon. L’import CSS Neon charge la feuille isolée de l’assistant. Les patchs partagés ne comprennent que ces raccordements, pas le reste de la refonte.

`AssistantGlobal.tsx` contient l’hôte de disponibilité/droits et le panneau React : fils/historique/création/suppression confirmée, sélections et brouillons par conversation, profils séparés, contexte joint explicite, sources, boîte personnelle, réponses/lecture/avis, propositions action/constat et missions. Le client `api/get` existant porte cookie et CSRF. Les requêtes privées sont identifiées par utilisateur ; les notifications partagent la clé GRC existante et ses invalidations.

`PanneauAssistant` garde l’état pendant la navigation. Le résultat d’un envoi reste dans son fil d’origine. Une conversation créée dont le premier message échoue est conservée pour réessayer sans duplication. Les mutations n’appliquent pas un résultat tardif après le démontage. La purge privée existante de session couvre le préfixe de cache assistant ; aucun stockage local persistant des contenus.

`contrats.ts` est un **pont de types frontend** vers `claude/assistant-rssi@460060a`, pas une nouvelle définition serveur. Il faut reprendre les DTO partagés de la cible et conserver les fonctions `messageAEnvoyer`, `indisponibilite`, `estNotificationAssistant` et `pointEnAttente`. `enPause` n’interdit pas le chat ; le budget est une donnée distincte. Les réponses personnelles n’exigent pas `assistant:lire` et les notifications ne portent pas de profil.

`IdentiteAssistant.tsx` fournit avatar SVG/icônes locaux ; `neon-assistant.css` porte l’habillage, les formes et les dimensions. Le dock reste borné avec ses propres zones de défilement, épinglage optionnel sur grand écran et exclusion de la cartographie. La pause manuelle et le mouvement réduit du système sont respectés.

## Portée du présent dossier

Quatre fichiers UI et le test unitaire sont transmis comme nouveaux fichiers. Les trois fichiers partagés sont transmis uniquement sous forme de diff de référence. S’ajoutent les consignes IA, la charte, les contrats, le plan, la recette, les dépendances, les deux images déjà existantes, les preuves historiques. Les E2E Assistant sont fournis comme références à adapter ; leurs dépendances de présentation Fournisseurs ne sont pas embarquées.

La création de ce paquet ne modifie pas le code applicatif, le backend, les droits, les migrations ou les configurations. Elle ne reconstruit pas l’application ni Docker et ne contacte pas Mistral. Vérifications de conditionnement : identité des sources au commit fixé, contrôle des patches sur leur base de référence isolée, empreintes, chemins, CRC et relecture du ZIP. Les résultats sont indiqués dans `VERIFICATIONS-LIVRAISON.json`.

## Reste à faire dans le dépôt cible

Réunir le frontend avec le backend approuvé, adapter les trois raccordements à la version courante, remplacer le pont DTO, raccorder les liens directs au panneau global sans double UI, conserver l’administration/rondes/mémoire/méthodes/supervision existantes et adapter les fixtures de test à l’environnement hôte. Exécuter ensuite la recette du service réel sur une pile isolée et livrer son visuel intégré.

Les 287 tests web, 246 UI, dix scénarios Assistant et les contrôles visuels précédents appartiennent au portage de référence, pas à la fabrication de ce paquet ni à la branche cible. Ne pas présenter une capture à API fictive comme une conversation Mistral réelle.
