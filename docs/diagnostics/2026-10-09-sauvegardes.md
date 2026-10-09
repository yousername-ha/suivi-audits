# Lot A1a — demandes manuelles de sauvegarde chiffrée

Branche exclusive : `feature/gpt6-evolution-smsi-grc`. Ce lot prolonge le socle ZIP Sauge ; il ne clôture ni A1 complet ni la reprise des modules historiques.

## Diagnostic préalable et décision

Le serveur possédait déjà `backup.sh`, `restore.sh`, des rapports d'exploitation et une planification cron. L'écran Système consultait les rapports ; les paramètres de sauvegarde étaient déclaratifs. L'API isolée ne dispose ni de Docker ni de la phrase secrète : exécuter les commandes depuis une route aurait élargi inutilement ses privilèges.

L'[ADR 0016](../adr/0016-pilotage-sauvegardes.md) conserve les scripts et définit une file SQL exclusive, une CLI interne et un exécutant hôte. La migration 006 est additive ; les migrations précédentes, données métier, modules v2 et jetons Sauge restent inchangés. Aucune dépendance ajoutée.

## Résultat fonctionnel

- Administration/Administrer : confirmation d'une demande manuelle, identifiant conservé lors d'un réessai réseau, annulation uniquement en attente avec If-Match.
- Administration/Lire : consultation du contact de l'exécutant et des 50 dernières demandes, sans action proposée.
- Serveur : verrou hôte exclusif, chiffrement obligatoire, clé privée non vide, contrôle SHA-256, heartbeat pendant les sauvegardes longues, aucune relance automatique après interruption.
- Audit : demande, prise en charge, annulation, succès, échec et interruption consignés ; transactions SQL atomiques avec les changements de statut.
- Résultat API limité au nom de fichier et aux métadonnées. Aucun chemin hôte, clé ou journal brut. Un rapport incomplet ou incohérent ne devient jamais un succès.
- Archive contenant les secrets créée dans un dossier temporaire privé ; publication après chiffrement, sans archive en clair dans la destination en cas d'échec. Le verrou de `backup.sh` est partagé avec les opérations existantes.

## Vérification

Les tests utilisent des bases PostgreSQL et des secrets fictifs isolés. Les 138 tests API passent, dont 14 pour les droits, réessais, concurrence, versions, interruptions, rapports et audit, et 7 pour les scripts. Ces derniers simulent l'appel Docker et utilisent réellement OpenSSL, SHA-256 et tar : archive chiffrée déchiffrée et contenu relu, échec de dump, échec de chiffrement sans publication, exclusion d'un second dump permissions de clé et compatibilité de la sauvegarde avant mise à jour (rétention 36500). Ils ne remplacent pas une restauration de production.

Les autres suites passent : 192 tests partagés, 102 tests UI, 12 tests web (444 au total). Typage strict, lint, format, build, syntaxe Bash, ShellCheck, CHANGELOG et extraction du guide réussis. La feuille CSS compilée conserve son nom `index-BVNHOy3h.css`. Les références visuelles existantes ne sont pas renouvelées pour ce lot.

Les résultats de la recette Playwright et des contrôles GitHub sont présentés dans la PR #12 ; leur lancement seul ne constitue pas une validation.

## Limites et exploitation

L'exploitant doit configurer le poller hôte selon [INSTALLATION, étape 11.5](../INSTALLATION.md). Il interroge la file chaque minute et ne crée pas de sauvegarde sans demande. La destination, la rétention et la phrase secrète restent côté serveur. Le poller n'est pas installé sur un serveur de production par ce lot.

A1b reste à développer : restauration guidée, planification configurable depuis le navigateur et consultation exhaustive des archives produites hors de cette file. La restauration actuelle demeure une procédure serveur confirmée ; SHA-256 ne prouve ni l'authenticité ni la restaurabilité. Le test isolé de restauration reste obligatoire avant ouverture aux utilisateurs.

Les premiers essais de tests ont révélé des erreurs de fixtures (identifiant de rôle non conforme, chaîne du faux Docker, injection d'échec d'audit). Elles ont été corrigées sans désactiver de contrôle. Aucun jeu de données métier de production n'a été utilisé.

La première CI A1a a détecté une régression de compatibilité : le nouveau plafond de rétention refusait les 36500 jours utilisés par mettre-a-jour.sh. Le plafond a été corrigé sans modifier cette procédure, et un test de sauvegarde directe avec son préfixe et sa rétention protège ce contrat. Le guide complet est rejoué sur le commit corrigé ; aucun contrôle CI n’est désactivé.
