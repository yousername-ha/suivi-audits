# Diagnostic préalable — rôles et interface Legacy

Demande : réparer les accents et les cartes, placer les rôles dans Pilotage,
retrouver la cartographie d’origine et fournir un compte de test admin/admin.
Périmètre exclusif : branche `legacy/test-lots-d-f`, application HTML locale.

## Accents

Les sources JSON sont UTF-8, mais trois lectures Python ne précisent pas
l’encodage. Sous Windows, une lecture CP1252 transforme notamment « Sécurité »
en « SÃ©curitÃ© ». Le navigateur affiche alors les caractères déjà corrompus.
La correction doit fixer l’encodage des lectures et écritures et réparer les
valeurs des rôles de base déjà enregistrées, uniquement lorsqu’elles sont
exactement une mauvaise interprétation de la valeur officielle. Les identités,
affectations, coordonnées et textes personnalisés doivent rester intacts.

## Présentation et rangement

La grille étire les cartes, mais leurs boutons suivent des paragraphes de
longueurs différentes. Séparer titre, fonction, titulaire, responsabilité et
actions permet d’aligner les actions en bas, sans masquer de texte. Les couleurs
et la police doivent reprendre les variables et la police Sauge existantes.
Le registre est partagé : déplacer son entrée de menu vers Pilotage ne doit
créer ni nouveau registre ni duplication de rôles.

## Cartographies de référence

L’archive `archives/v2-source.zip` du dépôt de référence contient dans
`app/public/index.html` la carte en cases cliquables `viewDashMap`. Elle est
encore présente dans ce Legacy, mais son entrée a été placée après les vues
contexte/processus sous un intitulé peu reconnaissable. La remettre en première
entrée « Vue d’ensemble » restaure le parcours original et ses liens directs.

La branche `feature/gpt6-evolution-smsi-grc` contient aussi la référence
`docs/cartographie/reference-beta-legacy/carto.js`, reprise par les modules
contexte/processus du Legacy. Conserver ces vues complémentaires ainsi que la
cartographie des évaluations de référence du registre central. Aucune saisie
de risque ni aucun calcul historique ne doit être déplacé ou dupliqué.

## Compte local de test

Le lanceur local peut provisionner admin/admin avec le même stockage PBKDF2 et
les mêmes contrôles de session que les autres comptes. Cette exception est
explicitement demandée pour les tests Legacy. Ne jamais remplacer un compte
`admin` déjà présent ni réinitialiser son mot de passe au redémarrage. Les
créations normales de comptes conservent leur minimum de 12 caractères.
L’interface de connexion doit accepter un mot de passe court déjà existant ;
la création d’accès conserve son contrôle de longueur. L’écoute reste localhost.
Une option du lanceur permet de tester le parcours historique de création du
premier administrateur sans provisionner le compte de test.
