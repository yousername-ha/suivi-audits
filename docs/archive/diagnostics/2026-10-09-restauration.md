# Diagnostic préalable — restauration (A1b1)

Branche exclusive : feature/gpt6-evolution-smsi-grc ; main reste inchangée.

Le moteur de restauration existe mais les extractions tar ne contrôlent ni chemins ni liens imbriqués. L'empreinte peut désigner un autre fichier, l'attente PostgreSQL est infinie et les sauvegardes peuvent chevaucher la restauration. Le script affiche un succès avant contrôle de santé. Une base restaurée peut aussi remettre en service des sessions anciennes.

L'ADR 0017 définit les protections et le prérequis Python 3 standard, sans dépendance tierce. Le lot ajoute une simulation locale sans mutation, une extraction contrôlée, une exclusion opérationnelle et une attente bornée. Les archives malveillantes sont refusées avant arrêt et remplacement ; les extractions demeurent dans un dossier temporaire privé. Une restauration isolée avec une vraie base doit confirmer la compatibilité.

Le suivi et le déclenchement web restent A1b2 : une file conservée uniquement dans la base ne survit pas à son remplacement. Une confirmation web ne suffit pas à résoudre ce problème. La restauration avec rollback automatique nécessite en plus une sauvegarde préalable contrôlée et un journal hôte durable ; aucun bouton ne prétend assurer cela dans A1b1.

Les résultats exécutés seront indiqués dans la PR #12 après validation, séparément des capacités encore à développer.


## Recette du sous-lot

445 tests Vitest du socle réussis (192 partagés, 102 UI, 139 API, 12 web). La recette appelée par l’API exécute 19 tests Python standard avec fichiers fictifs et Docker simulé : traversées et liens imbriqués, types spéciaux/sparse/PAX, doublons, profondeur, tailles, secrets absents, checksum désignant un autre fichier ou incorrect, mauvaise phrase secrète, compatibilité GNU longname et backup.sh, confirmation, catalogue PostgreSQL, verrou, remplacement des anciens liens/dossiers de secrets sans suivi, attentes et absence de faux succès. Le vrai OpenSSL, GNU tar et SHA-256 sont utilisés ; le PostgreSQL de restauration est simulé dans cette recette locale.

Le guide GitHub rejoue sauvegarde puis restauration sur la vraie pile isolée et contrôle les comptes, documents et données. La montée de version couvre aussi le rollback. Leurs résultats finaux sont présentés dans la PR ; leur lancement ne vaut pas validation. CodeQL analyse maintenant aussi Python, avec le même seuil élevé/critique et sans suppression des contrôles.
