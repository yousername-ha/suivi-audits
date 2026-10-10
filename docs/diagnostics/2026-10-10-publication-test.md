# Diagnostic de publication de la branche de test

Analyse avant toute évolution, depuis `661309c`, sur `feature/gpt6-evolution-smsi-grc` uniquement.

- Le dépôt GitHub est privé ; aucun tag ni release n'existait. La CI et CodeQL du socle G/H/K/début E sont réussis sur ce commit.
- L'API n'exécute aucune commande Docker. Les demandes administrateur passent par la file PostgreSQL puis l'exécutant isolé, avec contrôles de rôle, sauvegarde, maintenance, signatures, reprise et santé réelle.
- Le contrat de versions est `X.Y.Z` dans le schéma partagé, l'exécutant, les scripts serveur et les comparaisons de l'interface. Un tag suffixé `-dev` ne serait pas installable depuis le menu existant.
- La découverte publique utilise GitHub `/releases/latest` et refuse les préversions. Le chemin privé réutilise la clé Git, sélectionne la plus haute étiquette numérique et contrôle la présence des trois images. Il permet déjà une **préversion GitHub à numéro numérique**, sans changement de l'exécutant installé. Cette possibilité s'applique à tous les serveurs autorisés sur le dépôt, avec confirmation administrateur obligatoire.
- La confiance exige une signature issue de `release.yml@refs/tags/vX.Y.Z` et un label de révision égal au commit du tag. Une publication manuelle depuis une branche, sans cette chaîne, serait refusée.
- La chaîne initiale publiait les étiquettes d'images avant ses scans/signatures et mettait à jour l'alias mineur. La livraison de développement doit conserver les alias stables et exposer les trois étiquettes numériques seulement après tous les contrôles.

Décision : numéro de transport `3.0.1`, manifeste de développement versionné, tag depuis la branche de travail après CI/CodeQL verts, préversion GitHub explicite, images exactes scannées/signées, aucun alias stable ni changement de main. Aucun changement de l'authentification, des migrations, de l'interface ou de l'exécutant requis. Les installations locales doivent annoncer un numéro numérique inférieur à la cible ; les installations v2 nécessitent encore la montée de version serveur préalable. Un canal de test isolé ou les préversions d'un futur dépôt public nécessiteraient une évolution distincte.

## Reprise de publication

La tentative `v3.0.1` du commit `cc285b4`, après CI et CodeQL réussis, a échoué dans `actions/setup-node@v5` avant toute construction/publication d'image : le cache automatique découvre `packageManager: pnpm` mais pnpm n'est pas installé dans le job des notes, qui utilise seulement Node et Git. Le cache est désactivé explicitement pour ce job. L'étiquette existante reste immuable ; la publication suivante utilise `3.0.2`, avec les mêmes fonctionnalités et des contrôles sur son propre commit.
