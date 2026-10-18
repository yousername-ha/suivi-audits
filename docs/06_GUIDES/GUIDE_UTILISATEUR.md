# Guide utilisateur actuel

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

Cette application suit les audits et les travaux qualité/sécurité/référentiels.
Le menu **Pilotage** est commun : il ne faut pas créer un SMSI pour une démarche
qualité. Les droits et modules activés déterminent les rubriques visibles.

Les sections suivantes couvrent les 40 domaines inventoriés. Les fonctions
historiques sont accessibles dans Pilotage (l’écran /legacy est retiré) ; NON VÉRIFIÉ signifie que son parcours
complet n’a pas été rejoué, pas qu’il est forcément inutilisable. Une partie
livrée n’est pas une certification ISO/HDS.

## FCT-001 — Installation, connexion et TOTP

Objectif : Installation avec jeton à usage unique, session complète après MFA, anti-rejeu et refus CSRF/origine.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/setup ; /login**.
Profils : Installation : première création sans compte existant via jeton à usage unique ; connexion des comptes existants.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Sur une première installation uniquement, ouvrir /setup avec le jeton obtenu par l’exploitant, sans le transmettre dans la documentation.
2. Créer le premier compte selon le formulaire puis configurer l’authentificateur TOTP.
3. Sur une installation existante, ouvrir /login, saisir identifiant/mot de passe puis le code TOTP ; terminer les changements imposés.
4. Vérifier que la session complète ouvre les menus autorisés.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Recette du serveur utilisateur non reçue.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-001.

## FCT-002 — Comptes, groupes, rôles et revue des droits

Objectif : Droits effectifs, périmètres auditeur, expiration, dernier administrateur et exports de revue.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/admin/users ; /admin/groups ; /admin/roles**.
Profils : Session complète, lecture du domaine administration ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir Administration → Utilisateurs ; consulter le compte et sa date d’expiration.
2. Attribuer des rôles directement ou par groupe ; ajuster une copie de rôle si besoin, sans modifier les rôles prédéfinis.
3. Consulter les droits effectifs et leur origine ; tester avec un compte de recette limité.
4. Exporter la revue des accès selon sa permission ; conserver les garde-fous dernier administrateur et expiration auditeur.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Recette du serveur utilisateur non reçue.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-002.

## FCT-003 — Sessions et déconnexion synchronisée

Objectif : Révocation serveur, purge privée, erreurs visibles, onglets et session murale indépendante.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/account ; /admin/sessions**.
Profils : Session complète, lecture du domaine compte ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir Mon compte pour consulter ou révoquer ses sessions.
2. Utiliser la déconnexion du menu ; attendre la confirmation serveur.
3. Vérifier que l’affichage privé disparaît aussi des autres onglets ; en cas d’erreur visible, réessayer après correction réseau.
4. Pour un écran mural, utiliser l’autorisation dédiée de l’appareil ; elle n’est pas la session personnelle.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Recette du serveur utilisateur non reçue.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-003.

## FCT-004 — Documents, versions chiffrées et liens

Objectif : Dépôt, téléchargement, versionnement et liens ; aucune copie physique par preuve métier.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/documents**.
Profils : Session complète, lecture du domaine documents ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir Documents puis utiliser l’ajout proposé avec un fichier de recette.
2. Renseigner les métadonnées et rattachements présentés puis déposer le fichier.
3. Ouvrir la fiche et télécharger le contenu ; ajouter une version si nécessaire.
4. Contrôler l’historique et les liens autorisés ; la preuve métier doit référencer la version réellement examinée.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Recette du serveur utilisateur non reçue.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-004.

## FCT-005 — Paramètres et charte Sauge

Objectif : Jetons, clair/sombre, paramètres par section, captures et contraste des combinaisons testées.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/parametres**.
Profils : Session complète, lecture du domaine parametres ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir la rubrique indiquée et consulter les fiches disponibles.
2. Si l’écriture est autorisée, utiliser le formulaire proposé pour ajouter/modifier la donnée.
3. Renseigner les champs indiqués, lier les objets déjà présents puis enregistrer.
4. Relire l’historique et, si disponible, effectuer la décision explicite ; version obsolète impose un rechargement.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Recette du serveur utilisateur non reçue.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-005.

## FCT-006 — Temps réel, présence et concurrence

Objectif : SSE filtré, présence et If-Match ; pas de preuve de capacité multi-instance à grande charge.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **Toutes les fiches concernées**.
Profils : Session complète, lecture du domaine transversal ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir la rubrique indiquée et consulter les fiches disponibles.
2. Si l’écriture est autorisée, utiliser le formulaire proposé pour ajouter/modifier la donnée.
3. Renseigner les champs indiqués, lier les objets déjà présents puis enregistrer.
4. Relire l’historique et, si disponible, effectuer la décision explicite ; version obsolète impose un rechargement.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Recette du serveur utilisateur non reçue.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-006.

## FCT-007 — Écrans muraux

Objectif : Activation, cookie mural distinct, révocation et affichage aux tailles testées.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/mur ; /admin/murs**.
Profils : Session complète, lecture du domaine administration ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir la rubrique indiquée et consulter les fiches disponibles.
2. Si l’écriture est autorisée, utiliser le formulaire proposé pour ajouter/modifier la donnée.
3. Renseigner les champs indiqués, lier les objets déjà présents puis enregistrer.
4. Relire l’historique et, si disponible, effectuer la décision explicite ; version obsolète impose un rechargement.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Recette du serveur utilisateur non reçue.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-007.

## FCT-008 — Cartographie contexte et processus

Objectif : Canevas, objets, disposition, versions, filtres, exports et mapper maps ; parité des cas testés.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/cartographie**.
Profils : Session complète, lecture du domaine cartographie ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir Cartographie et choisir la vue contexte ou processus.
2. Rechercher/filtrer les objets disponibles, zoomer et sélectionner un élément pour sa fiche.
3. Utiliser le mode édition pour la disposition, sans créer une copie de la donnée métier.
4. Enregistrer une version puis exporter dans le format proposé ; vérifier l’objet source après modification.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Recette du serveur utilisateur non reçue.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-008.

## FCT-009 — Import, export et annulation legacy

Objectif : Simulation et empreinte du contenu, initialisation/fusion/remplacement, aller-retour normalisé et annulation protégée.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/admin/import**.
Profils : Session complète, lecture du domaine import_export ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir Administration → Import des données legacy et sélectionner un export historique de recette.
2. Lancer la simulation et lire le rapport, les erreurs, collisions et modules concernés.
3. Choisir initialisation, fusion ou remplacement d’un module selon l’état, puis confirmer explicitement.
4. Consulter l’historique et l’export recomposé ; annulation seulement si les conditions serveur le permettent.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Recette du serveur utilisateur non reçue.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-009.

## FCT-010 — Sauvegardes web et planification

Objectif : Sauvegarde réelle chiffrée depuis le menu sans cron supplémentaire sur installation Compose de recette.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/admin/system**.
Profils : Session complète, lecture du domaine administration ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir Administration → Système et consulter état/heartbeat de l’exécutant et dernière sauvegarde.
2. Demander la sauvegarde depuis le bouton proposé ; aucune clé ni commande système n’est saisie dans le navigateur.
3. Suivre la demande dans le catalogue jusqu’au résultat terminal ; indisponibilité du worker n’est pas un succès.
4. Consulter politique/planification/rétention si autorisé, puis faire vérifier l’archive selon la procédure d’exploitation.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Recette du serveur utilisateur non reçue.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-010.

## FCT-011 — Vérification et restauration

Objectif : Catalogue, contrôle, confirmation, exclusivité, sauvegarde préalable et restauration sur les environnements CI.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/admin/system**.
Profils : Session complète, lecture du domaine administration ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir Système → catalogue/opérations et choisir une archive autorisée.
2. Demander sa vérification et lire le résultat ; confirmer l’environnement et la sauvegarde préalable avec l’exploitant.
3. Une restauration modifie les données : utiliser exclusivement une fenêtre et un serveur autorisés, puis la confirmation forte demandée.
4. Contrôler santé, comptes, fichiers et données restaurées ; consulter le reçu et les réserves.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Recette du serveur utilisateur non reçue.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-011.

## FCT-012 — TLS et certificats

Objectif : Observation SAN, changements TLS autorisés, validation et retour arrière sur PKI de recette ; PKI client non vérifiée.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/admin/system**.
Profils : Session complète, lecture du domaine administration ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir Système et consulter le mode TLS et les dates/observations du certificat.
2. Si un changement est autorisé, préparer les fichiers côté serveur conformément à INSTALLATION.
3. Choisir seulement un mode/profil permis et confirmer l’opération ; ne jamais saisir la clé privée dans une fiche métier.
4. Vérifier le certificat réellement servi et la santé ; en cas d’échec, consulter retour arrière et reçu.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Recette du serveur utilisateur non reçue.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-012.

## FCT-013 — Mise à jour intégrée et maintenance

Objectif : Bandeau, rôle système administrateur, confirmation, maintenance indépendante, signatures, santé et retour arrière réels en CI.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/admin/system ; /update/**.
Profils : Rôle système Administrateur obligatoire pour déclencher la mise à jour ; lecteur informé sans commande.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir Administration → Système → Mise à jour de l’application avec le rôle système Administrateur.
2. Utiliser Vérifier, comparer version installée/disponible et lire les nouveautés.
3. Enregistrer les travaux ouverts puis confirmer en tapant METTRE À JOUR.
4. Suivre la page de maintenance et les étapes réelles ; attendre le retour automatique ou lire l’échec explicite.
5. Une version déjà installée ne s’annonce pas comme nouvelle ; un ancien updater peut nécessiter le premier redéploiement du guide.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Ancien updater : premier redéploiement serveur nécessaire ; frontal entretenu séparément.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-013.

## FCT-014 — Activation des modules

Objectif : Simulation, dépendances, activation versionnée serveur, conservation des données et purge des caches.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/admin/system**.
Profils : Session complète, lecture du domaine administration ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir Système → gestion des modules et préparer l’activation/désactivation.
2. Lire la simulation des dépendances et conséquences ; la visibilité ne vaut pas autorisation.
3. Confirmer la configuration puis vérifier les menus et droits avec les comptes concernés.
4. Consulter l’historique ; les données d’un module désactivé ne doivent pas être effacées.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Recette du serveur utilisateur non reçue.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-014.

## FCT-015 — Configuration des échelles et matrices

Objectif : Simulation, matrices explicites, publication immuable, concurrence et refus des brouillons incohérents.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/admin/environment**.
Profils : Session complète, lecture du domaine administration ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir Administration → Système → Configurer l’environnement.
2. Préparer échelles/dimensions/seuils et calcul produit, somme ou matrice selon ce formulaire.
3. Lancer la simulation, corriger les incohérences puis motiver et confirmer PUBLIER.
4. Relire la version et l’historique ; en cas de conflit conserver le brouillon et recharger explicitement.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Recette du serveur utilisateur non reçue.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-015.

## FCT-016 — Décisions IA versionnées B2b

Objectif : Décision immuable liée à la source IA et à une configuration choisie ; calcul aiEval et source historique conservés.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/ia/evaluations**.
Profils : Session complète, lecture du domaine ia ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Créer ou identifier l’évaluation source dans le registre IA historique.
2. Ouvrir /ia/evaluations, sélectionner la source et une configuration publiée.
3. Renseigner l’appréciation et la justification puis confirmer la décision.
4. Consulter résultat/version/snapshot ; modifier la source ne réécrit pas une décision antérieure.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Ne constitue pas la reprise complète du registre IA (FCT-032).
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-016.

## FCT-017 — Catalogue métier et politiques

Objectif : Nomenclatures, statuts/workflows et adoption explicite versionnée ; raccordement B2 complet non établi.

État : **PARTIEL**, uniquement dans ce périmètre.
Accès : **/pilotage/configuration**.
Profils : Session complète, lecture du domaine pilotage ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir la rubrique indiquée et consulter les fiches disponibles.
2. Si l’écriture est autorisée, utiliser le formulaire proposé pour ajouter/modifier la donnée.
3. Renseigner les champs indiqués, lier les objets déjà présents puis enregistrer.
4. Relire l’historique et, si disponible, effectuer la décision explicite ; version obsolète impose un rechargement.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Raccordements des familles historiques et nomenclatures spécifiques B2 à terminer.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-017.

## FCT-018 — Contexte, parties intéressées et responsabilités

Objectif : Adaptateurs directs du périmètre commun, champs supplémentaires et responsabilités sans ID conservés.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/pilotage/contexte ; /pilotage/parties ; /pilotage/swot ; /pilotage/responsabilites**.
Profils : Session complète, lecture du domaine pilotage ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir la rubrique indiquée et consulter les fiches disponibles.
2. Si l’écriture est autorisée, utiliser le formulaire proposé pour ajouter/modifier la donnée.
3. Renseigner les champs indiqués, lier les objets déjà présents puis enregistrer.
4. Relire l’historique et, si disponible, effectuer la décision explicite ; version obsolète impose un rechargement.

Champs/paramètres : Organisation, Activités, entités et services concernés, Interfaces et dépendances, Enjeux internes et externes, Exclusions et justification
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Recette du serveur utilisateur non reçue.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-018.

## FCT-019 — Processus, objectifs et indicateurs

Objectif : Édition contrôlée, séries de valeurs historiques conservées, indicateurs automatiques protégés.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/pilotage/processus ; /pilotage/objectifs ; /pilotage/indicateurs**.
Profils : Session complète, lecture du domaine pilotage ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir la rubrique indiquée et consulter les fiches disponibles.
2. Si l’écriture est autorisée, utiliser le formulaire proposé pour ajouter/modifier la donnée.
3. Renseigner les champs indiqués, lier les objets déjà présents puis enregistrer.
4. Relire l’historique et, si disponible, effectuer la décision explicite ; version obsolète impose un rechargement.

Champs/paramètres : Valeur mesurée, Cible, Unité, Date de mesure
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Recette du serveur utilisateur non reçue.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-019.

## FCT-020 — Référentiels, exigences et correspondances

Objectif : Publications, activation, mappings révisables, simulations/imports ; sources normatives sous licence non redistribuées.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/pilotage/referentiels ; /pilotage/correspondances**.
Profils : Session complète, lecture du domaine conformite ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir Pilotage → Référentiels et exigences et sélectionner le référentiel/version.
2. Préparer les exigences organisationnelles ou l’import autorisé, simuler et vérifier les sources/droits de réutilisation.
3. Publier avec justification/confirmation ; activer seulement les versions retenues.
4. Dans Correspondances, relier les exigences, justifier et réviser le mapping en conservant son historique.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Moteur C validé ; audit/couverture annuelle et GAP historiques non entièrement migrés.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-020.

## FCT-021 — Actions et tâches récurrentes

Objectif : Actions communes, cinq vues synchronisées, séries/occurrences idempotentes, calendrier/fuseau et rappels internes.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/pilotage/actions ; /pilotage/recurrences**.
Profils : Session complète, lecture du domaine ecarts ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir Pilotage → Plan d’actions et créer ou consulter une action liée aux objets existants.
2. Renseigner responsable, échéance, statut, justificatifs et relations ; ne pas recopier l’action pour chaque objet.
3. Passer entre liste, Kanban, calendrier, planning/Gantt et tableau de bord ; les cinq vues utilisent la même donnée.
4. Dans Tâches récurrentes, préparer série/fréquence/fuseau et vérifier ses occurrences et rappels.
5. Terminer selon le workflow avec justification ; clôture d’action et réévaluation du risque sont distinctes.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Transport email exclu ; pas de migration automatique de toutes les récurrences historiques.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-021.

## FCT-022 — Méthodes et évaluations des risques

Objectif : EBIOS cinq ateliers, jugement/matrice/règles distincts, brut/résiduel immuables ; aucune réévaluation automatique après action.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/pilotage/risques ; /pilotage/scenarios ; /pilotage/traitements**.
Profils : Session complète, lecture du domaine pilotage ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir Registre des risques ; sélectionner une méthode publiée adaptée au périmètre.
2. Renseigner les étapes/champs exigés ; EBIOS RM suit cinq ateliers et les scénarios/sources/biens associés.
3. Apprécier le risque brut et résiduel selon la méthode, justifier et valider selon les droits.
4. Relier les mesures et actions de traitement ; consulter les évaluations antérieures.
5. Après réalisation d’un traitement, déclencher une réévaluation explicite ; aucun résiduel automatiquement diminué.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : ISO/MÉHARI : modèles configurables ; exhaustivité d’une méthode normative ou des classeurs officiels non certifiée.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-022.

## FCT-023 — Cartographie des risques

Objectif : Projection du registre, graphe, filtres, couleurs versionnées, détail, exports et comparaisons compatibles ; sans double saisie.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/pilotage/carte**.
Profils : Session complète, lecture du domaine cartographie ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Saisir d’abord les risques/relations dans le registre puis ouvrir Cartographie des risques.
2. Choisir brut/résiduel, filtres et regroupement proposés ; lire la légende et la méthode/version.
3. Cliquer un objet pour son détail ; utiliser le canevas/zoom et vérifier les liens autorisés.
4. Comparer des évaluations seulement si leurs configurations sont compatibles ; exporter et lire les limites.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Volumes bornés ; benchmark de charge et ergonomie sur grands graphes non réalisés.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-023.

## FCT-024 — Preuves et plan de contrôle G

Objectif : Versions documentaires effectivement examinées, contrôle/résultat immuable, constat et action atomiques, récurrences.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/pilotage/preuves ; /pilotage/controles**.
Profils : Session complète, lecture du domaine documents / pilotage ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir Registre des preuves, relier les versions exactes des documents et utiliser Examiner avec résultat/justification.
2. Ouvrir Plan de contrôle ; définir objectif, périmètre, méthode, critères, responsable et échéance.
3. Utiliser Réaliser le contrôle et enregistrer résultat et justificatifs ; une anomalie peut générer constat/action liés.
4. Si nécessaire, planifier les répétitions ; suivre les actions dans le moteur commun et terminer leur workflow distinct.

Champs/paramètres : Objectif du contrôle, Périmètre contrôlé, Comment réaliser le contrôle, Critères de réussite, Prochaine échéance, État
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Recette du serveur utilisateur non reçue.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-024.

## FCT-025 — Amélioration continue H

Objectif : Causes, actions, efficacité et clôture gardées côté serveur ; agrégats fonctionnels sur 10 000 constats.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/pilotage/amelioration**.
Profils : Session complète, lecture du domaine ecarts ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir Amélioration continue et créer/consulter le constat, écart ou opportunité.
2. Renseigner origine, causes, responsable, priorité et échéance ; lier les actions correctives.
3. Après réalisation, utiliser Vérifier l’efficacité avec résultat et preuves.
4. Clôturer le constat lorsque les conditions sont remplies ; une récidive produit un nouveau constat.

Champs/paramètres : Nature du constat, Origine, Analyse des causes, Échéance, Priorité, État
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Recette du serveur utilisateur non reçue.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-025.

## FCT-026 — Parcours guidé qualité/sécurité/HDS K

Objectif : Onze étapes, reprise et validation historisée sur objets communs ; création de SMSI non imposée.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/pilotage/parcours**.
Profils : Session complète, lecture du domaine pilotage ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir Parcours guidé puis choisir qualité/SMQ, sécurité/SMSI, HDS, intégrée ou personnalisée.
2. Renseigner organisation/périmètre/objectifs, sans créer un autre système de management obligatoire.
3. Suivre les onze étapes, réutiliser les objets enregistrés et sauvegarder pour reprendre plus tard.
4. Valider une étape avec la justification et les travaux réels, en respectant les prérequis.
5. Consulter les anciennes validations ; l’avancement ne constitue pas un taux de conformité.

Champs/paramètres : Organisation, Périmètre de la démarche, Objectifs de la démarche, Démarche, Activités HDS retenues, si concerné, Justification du périmètre HDS, si concerné
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : L’avancement ne constitue ni conformité ni certification ; recette humaine en attente.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-026.

## FCT-027 — BIA, continuité, exercices et RETEX E

Objectif : Formulaires génériques, impacts temporels, objectifs cohérents, validations et rapports HTML/JSON testés.

État : **PARTIEL**, uniquement dans ce périmètre.
Accès : **/pilotage/bia ; /pilotage/continuite ; /pilotage/exercices**.
Profils : Session complète, lecture du domaine pilotage ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Dans BIA, renseigner activité/service/scénario/dépendances et impacts dans le temps.
2. Fixer service minimum, durée maximale d’interruption et objectifs de reprise/perte compatibles.
3. Créer un plan PCA/PRA/PCRA/activité relié, avec déclenchement, stratégie, procédures et responsabilités.
4. Enregistrer exercice et RETEX, relier les améliorations à des actions puis valider avec les justificatifs.
5. Exporter le rapport HTML imprimable ou JSON ; les grilles officielles manquantes ne sont pas simulées.

Champs/paramètres : Activité, Service rendu, Périmètre, Scénario d’interruption, Criticité de l’activité, Durée maximale d’interruption (heures), Objectif de reprise (heures), Perte de données acceptable (heures), Service minimum attendu, Ressources nécessaires, Dépendances et fournisseurs, État, Justification
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Kits/grilles ANS, configuration des méthodes de continuité et reprise complète plans/crise manquent.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-027.

## FCT-028 — Audit et couverture annuelle historique

Objectif : Code conservé ; CRUD/couverture annuelle et exports complets non rejoués durant cet audit.

État : **PARTIEL**, uniquement dans ce périmètre.
Accès : **Pilotage → Audit**.
Profils : Session complète, lecture du domaine audit ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir le menu Pilotage et sélectionner la rubrique indiquée.
2. Consulter les éléments existants selon ses permissions ; conserver un jeu fictif pour toute recette.
3. Relever les champs, liens, filtres et exports effectivement présents avant de préparer une reprise.
4. Consigner tout écart : le parcours complet n’a pas été exécuté pendant cet audit.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Exigences natives disponibles, couverture interne/certification par année encore historique.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-028.

## FCT-029 — Planning et créneaux d’audit historiques

Objectif : Planning historique conservé ; registre natif audit ne prouve pas la reprise des journées/créneaux.

État : **PARTIEL**, uniquement dans ce périmètre.
Accès : **Pilotage → Plan d’audit**.
Profils : Session complète, lecture du domaine plan_audit ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir le menu Pilotage et sélectionner la rubrique indiquée.
2. Consulter les éléments existants selon ses permissions ; conserver un jeu fictif pour toute recette.
3. Relever les champs, liens, filtres et exports effectivement présents avant de préparer une reprise.
4. Consigner tout écart : le parcours complet n’a pas été exécuté pendant cet audit.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Migration et recette des participants, questions et preuves attendues à établir.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-029.

## FCT-030 — Déclaration d’applicabilité historique

Objectif : Registre SoA natif visible ; équivalence de toutes les données et décisions dda non démontrée.

État : **PARTIEL**, uniquement dans ce périmètre.
Accès : **/pilotage/applicabilite ; /pilotage/legacy**.
Profils : Session complète, lecture du domaine pilotage ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir le menu Pilotage et sélectionner la rubrique indiquée.
2. Consulter les éléments existants selon ses permissions ; conserver un jeu fictif pour toute recette.
3. Relever les champs, liens, filtres et exports effectivement présents avant de préparer une reprise.
4. Consigner tout écart : le parcours complet n’a pas été exécuté pendant cet audit.

Champs/paramètres : Applicable, Justification de l’applicabilité, Mis en œuvre
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Correspondance de dda vers SoA et recette complète à établir.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-030.

## FCT-031 — Fournisseurs et évaluations historiques

Objectif : Sources conservées, pas de nouveau parcours fournisseur Sauge identifié.

État : **NON VÉRIFIÉ**, uniquement dans ce périmètre.
Accès : **Pilotage → Fournisseurs**.
Profils : Session complète, lecture du domaine fournisseurs ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir le menu Pilotage et sélectionner la rubrique indiquée.
2. Consulter les éléments existants selon ses permissions ; conserver un jeu fictif pour toute recette.
3. Relever les champs, liens, filtres et exports effectivement présents avant de préparer une reprise.
4. Consigner tout écart : le parcours complet n’a pas été exécuté pendant cet audit.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Reprendre registre, évaluations, contacts, certifications, fréquence et exports ; maintien legacy requis.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-031.

## FCT-032 — Registre IA, plans et politiques historiques

Objectif : B2b ajoute des décisions ; registre/plans/politiques complets restent historiques.

État : **PARTIEL**, uniquement dans ce périmètre.
Accès : **Pilotage → IA ; /ia/evaluations**.
Profils : Session complète, lecture du domaine ia ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir le menu Pilotage et sélectionner la rubrique indiquée.
2. Consulter les éléments existants selon ses permissions ; conserver un jeu fictif pour toute recette.
3. Relever les champs, liens, filtres et exports effectivement présents avant de préparer une reprise.
4. Consigner tout écart : le parcours complet n’a pas été exécuté pendant cet audit.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Reprise fonctionnelle IA distincte du futur assistant MCP J, exclu.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-032.

## FCT-033 — CRRC, établissements et offres

Objectif : Code historique conservé ; parcours CRRC complet non rejoué.

État : **NON VÉRIFIÉ**, uniquement dans ce périmètre.
Accès : **Pilotage → CRRC**.
Profils : Session complète, lecture du domaine crrc ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir le menu Pilotage et sélectionner la rubrique indiquée.
2. Consulter les éléments existants selon ses permissions ; conserver un jeu fictif pour toute recette.
3. Relever les champs, liens, filtres et exports effectivement présents avant de préparer une reprise.
4. Consigner tout écart : le parcours complet n’a pas été exécuté pendant cet audit.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : CRRC-01 à CRRC-04 au backlog ; offres/statuts/carte/exports attendent cadrage autorisé.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-033.

## FCT-034 — Investissements et prospection

Objectif : Registre et code d’export conservés ; INV-01 et INV-02 ne sont pas revendiqués livrés.

État : **NON VÉRIFIÉ**, uniquement dans ce périmètre.
Accès : **Pilotage → Investissements**.
Profils : Session complète, lecture du domaine investissements ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir le menu Pilotage et sélectionner la rubrique indiquée.
2. Consulter les éléments existants selon ses permissions ; conserver un jeu fictif pour toute recette.
3. Relever les champs, liens, filtres et exports effectivement présents avant de préparer une reprise.
4. Consigner tout écart : le parcours complet n’a pas été exécuté pendant cet audit.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Filtres/vues et prospection au backlog ; lot D exclu de la livraison actuelle.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-034.

## FCT-035 — Incidents, crise et main courante

Objectif : Début E ne remplace pas le registre d’incidents ni la main courante historique.

État : **NON VÉRIFIÉ**, uniquement dans ce périmètre.
Accès : **Pilotage → Incidents / crise**.
Profils : Session complète, lecture du domaine incidents ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir le menu Pilotage et sélectionner la rubrique indiquée.
2. Consulter les éléments existants selon ses permissions ; conserver un jeu fictif pour toute recette.
3. Relever les champs, liens, filtres et exports effectivement présents avant de préparer une reprise.
4. Consigner tout écart : le parcours complet n’a pas été exécuté pendant cet audit.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : INC-01 à INC-03, déclarations, événements et COMSEC à cadrer ; aucun abandon décidé.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-035.

## FCT-036 — Revues d’accès métier historiques

Objectif : Distinct de la revue technique RBAC déjà reprise (FCT-002).

État : **NON VÉRIFIÉ**, uniquement dans ce périmètre.
Accès : **Pilotage → Pilotage**.
Profils : Session complète, lecture du domaine pilotage ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir le menu Pilotage et sélectionner la rubrique indiquée.
2. Consulter les éléments existants selon ses permissions ; conserver un jeu fictif pour toute recette.
3. Relever les champs, liens, filtres et exports effectivement présents avant de préparer une reprise.
4. Consigner tout écart : le parcours complet n’a pas été exécuté pendant cet audit.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Reprise périodique et preuve de réalisation des revues métier à spécifier.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-036.

## FCT-037 — Revues de direction

Objectif : Adaptateur direct et formulaire présents ; recette autonome d’une revue complète non retrouvée.

État : **NON VÉRIFIÉ**, uniquement dans ce périmètre.
Accès : **/pilotage/revues**.
Profils : Session complète, lecture du domaine pilotage ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir la rubrique indiquée et consulter les fiches disponibles.
2. Si l’écriture est autorisée, utiliser le formulaire proposé pour ajouter/modifier la donnée.
3. Renseigner les champs indiqués, lier les objets déjà présents puis enregistrer.
4. Relire l’historique et, si disponible, effectuer la décision explicite ; version obsolète impose un rechargement.

Champs/paramètres : Date de la revue, Participants, Résultats, risques et indicateurs examinés, Décisions et moyens, Suivi des décisions, État
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Tester les sous-sections historiques, décisions, suivis et validation de bout en bout.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-037.

## FCT-038 — Plans historiques et sous-sections

Objectif : Plans v2 conservés ; aucune migration globale implicite vers continuity_plan.

État : **NON VÉRIFIÉ**, uniquement dans ce périmètre.
Accès : **Pilotage → Plans**.
Profils : Session complète, lecture du domaine pilotage ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir le menu Pilotage et sélectionner la rubrique indiquée.
2. Consulter les éléments existants selon ses permissions ; conserver un jeu fictif pour toute recette.
3. Relever les champs, liens, filtres et exports effectivement présents avant de préparer une reprise.
4. Consigner tout écart : le parcours complet n’a pas été exécuté pendant cet audit.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Inventorier types/champs, identifiants et liens avant migration vers le début E.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-038.

## FCT-039 — Aide embarquée et navigation métier

Objectif : Recherche sans accents, contenu filtré, navigation au clic sur bureau et téléphone.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **/aide ; menu Pilotage**.
Profils : Session complète, lecture du domaine transversal ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir Aide et rechercher un mot métier ; seuls les articles autorisés sont proposés.
2. Ouvrir Pilotage par son bouton de menu puis choisir une rubrique métier.
3. Sur téléphone, choisir la rubrique via le sélecteur et consulter les fiches.
4. Signaler une erreur avec parcours/rôle/version et capture anonymisée, sans donnée réelle.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Recette du serveur utilisateur non reçue.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-039.

## FCT-040 — Rapports natifs et exports métier

Objectif : Rapports HTML imprimables/JSON et exports cartographiques ; cinq bibliothèques legacy identiques.

État : **VALIDÉ AUTOMATIQUEMENT**, uniquement dans ce périmètre.
Accès : **Pilotage → Import et rapports ; exports des registres**.
Profils : Session complète, lecture du domaine import_export ; opérations soumises aux permissions modifier/exporter/administrer et au périmètre. Une validation peut exiger un rôle de validation distinct.
Prérequis : module activé, accès au périmètre et données nécessaires disponibles ;
un environnement de recette autorisé pour les opérations sensibles.

1. Ouvrir le registre ou Import et rapports concerné.
2. Sélectionner les données/filtres autorisés, choisir JSON ou rapport HTML selon le bouton.
3. Lire les limites de volume et vérifier que les décisions/versions sont identifiées.
4. Imprimer le HTML si nécessaire ; un export technique ne vaut pas attestation de conformité.

Champs/paramètres : Champs exacts dans le formulaire courant ou le contrat API ; pour une famille historique, inventaire détaillé restant à recetter.
Résultat attendu : fiche/décision/rapport dans la source décrite, visible selon
les droits ; le résultat serveur prime sur l’affichage du bouton.
Erreurs : voir section commune ci-dessous ; conservation du brouillon en cas
de conflit, refus de validation si conditions métier manquantes.
Restriction : Les exports Word/PowerPoint serveur de la feuille de route ne sont pas déclarés implémentés.
Fonctions liées : voir la [matrice](../02_FONCTIONNALITES/MATRICE_TRACABILITE.md)
et le cas TEST-040.

## Comprendre les messages et enregistrer

- Session expirée : se reconnecter et refaire la MFA ; ne pas tenter un appel
  technique pour contourner le refus.
- Droits insuffisants : demander au responsable les permissions et le périmètre
  appropriés ; un menu masqué ne donne jamais le droit d’API.
- Données invalides : corriger les champs indiqués ; pas de validation forcée.
- Version obsolète : conserver le travail, relire la fiche courante et réessayer
  après confirmation ; ne pas écraser silencieusement une modification distante.
- Mise à jour en cours : suivre la maintenance et son retour automatique ;
  attendre un résultat réel, succès/rollback/échec distincts.
- Exécutant indisponible : consulter avec l’administrateur la version et la santé
  updater, puis le guide de dépannage ; le navigateur n’exécute aucun shell.

## Captures à ajouter après une recette réelle

Emplacements descriptifs, **aucune fausse capture générée** :

| Capture attendue             | Parcours et contenu à montrer sans données personnelles                       |
| ---------------------------- | ----------------------------------------------------------------------------- |
| Menu métier bureau/téléphone | Pilotage sélectionné, rubriques visibles et fiche d’un objet fictif.          |
| Actions synchronisées        | Même action fictive en liste/Kanban/calendrier/planning ; statut et échéance. |
| Risque/carte                 | Fiche fictive, méthode/version, légende, brut/résiduel et détail au clic.     |
| Preuve/contrôle              | Versions documentaires fictives, résultat et action liée.                     |
| Parcours qualité             | Étape et validation fictive ; aucun faux score de conformité.                 |
| Continuité                   | BIA et plan fictifs, objectifs, dépendances, rapport imprimable.              |
| Exploitation                 | État final anonymisé ; aucun chemin privé, secret ou token affiché.           |

Les références visuelles existantes tests/e2e/specs/**captures** prouvent des
comparaisons CI, pas la recette du serveur utilisateur.
