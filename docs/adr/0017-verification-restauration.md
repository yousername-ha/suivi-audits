# ADR 0017 — Vérification préalable des archives de restauration

Statut : acceptée, lot A1b1 (9 octobre 2026).

## Diagnostic

restore.sh extrait l'archive extérieure puis secrets.tgz et caddy.tgz sans contrôle de chemins, liens, types ni tailles. Une archive altérée pourrait écrire hors de la destination. La confirmation seule ne protège pas cette extraction. La vérification SHA-256 actuelle lit les noms du fichier d'empreinte plutôt que de vérifier exclusivement l'archive sélectionnée. L'attente PostgreSQL est sans délai maximal et aucune exclusion avec les sauvegardes n'est assurée.

## Décision

Un vérificateur Python 3 sur le serveur utilise uniquement la bibliothèque standard tarfile. Ce prérequis hôte est déclaré dans INSTALLATION ; aucune dépendance Python tierce, npm ou nouveau service. Réimplémenter un parseur tar/gzip en JavaScript ou analyser la sortie textuelle de tar serait moins fiable. Le programme ne lance aucune commande et n'utilise jamais extract/extractall : il copie les seuls fichiers réguliers validés dans un dossier temporaire privé neuf, avec droits fixes.

L'archive extérieure autorise exclusivement suivi.dump, secrets.tgz, INFO et éventuellement caddy.tgz, sans doublons. Les archives imbriquées refusent chemins absolus/traversées, liens symboliques/durs, fichiers spéciaux, sparse et doublons. Les tailles, nombres d'entrées et profondeur sont bornés ; les secrets requis et l'en-tête du dump sont vérifiés. Le script contrôle le catalogue PostgreSQL avant remplacement des données. La vérification n'atteste ni authenticité ni restaurabilité : la recette isolée reste obligatoire.

restore.sh --verifier effectue uniquement déchiffrement et contrôles dans un dossier temporaire, sans Docker, arrêt, confirmation ou écriture dans DATA_DIR. La restauration confirmée prend les verrous hôte des sauvegardes et du worker, applique seulement les fichiers validés, ferme les sessions restaurées et attend PostgreSQL puis la santé de l'application avec un délai borné. Une erreur après remplacement impose une intervention de l'exploitant et ne devient pas un succès.

## Portée et suite

Ce sous-lot sécurise le moteur existant et sa simulation ; il n'expose pas encore de déclenchement destructif HTTP. Pour A1b2, un suivi durable hors de la base remplacée, une sauvegarde de sécurité et un protocole de retour arrière sont nécessaires. Aucune restauration de production n'est réalisée par le développement. Les archives produites par backup.sh restent compatibles, y compris celles de mettre-a-jour.sh.

Les extensions PAX et sparse sont refusées avant lecture de leur contenu ; les métadonnées GNU longname sont bornées. Le vérificateur lit les fichiers par blocs et conserve uniquement les formats GNU/USTAR générés sur les hôtes Debian/Ubuntu documentés. CodeQL couvre aussi Python.
