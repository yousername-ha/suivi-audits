# Guide administrateur

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:46:53+02:00 (Europe/Paris).

Source complète d’installation/exploitation : [INSTALLATION](../INSTALLATION.md).
Une permission personnalisée d’administration ne donne pas à elle seule le
rôle système Administrateur exigé par la mise à jour.

## Comptes, groupes et rôles

1. Administration → Utilisateurs : créer un compte nominatif de recette,
   attribuer rôles et expiration si nécessaire.
2. Groupes : gérer membres/attributions ; les droits effectifs sont l’union des
   rôles directs et de groupes, avec origine consultable.
3. Rôles : copier un rôle puis ajuster la matrice ; rôles prédéfinis protégés.
4. Contrôler avec un compte limité. Retrait de droit coupe/purge les sessions
   concernées ; dernier administrateur permanent protégé.
5. Auditeur externe : date d’expiration et modules requis ; pas d’accès global
   automatique. Exporter la revue des droits selon permission.

## Paramétrage et pilotage

Paramètres : enregistrer par section avec le droit correspondant. Système :
prévisualiser activation/dépendances avant confirmation. Configurer l’environnement
(échelles/matrices) exige simulation et motif, puis PUBLIER ; l’historique est
immuable. La politique métier a sa propre version, adoptée explicitement par
périmètre ; elle ne recalcule pas l’historique. Un conflit impose relecture,
pas remplacement forcé du brouillon.

Périmètres restreints : administration de membres autorisée dans le périmètre ;
permissions métier et rôle de validation restent cumulatives. Le périmètre
commun est automatique ; la création d’un SMSI n’est pas un prérequis normal.

## Supervision et maintenance

Système : version, état des workers, catalogue/planification sauvegardes,
restauration/TLS et mise à jour. Les demandes sont auditées ; une demande en
attente n’est pas un résultat réussi. Depuis 3.0.2, updater intègre l’exploitation
sans cron supplémentaire avec EXPLOITATION_AUTO=1 par défaut.

Sauvegarde : demander puis vérifier le résultat/catalogue. Clés/destination
sur le serveur ; anciennes archives nécessitent leur clé d’origine. Restaurer
ou changer TLS uniquement sur serveur/fenêtre autorisés, avec vérification,
sauvegarde préalable et confirmation forte ; consulter les reçus.

Mise à jour : Vérifier → lire versions/nouveautés → sauvegarder travaux ouverts
→ METTRE À JOUR. Une seule active. Le frontal maintient /update pendant les
redémarrages ; attendre santé/données puis retour. Un rollback n’est pas une
mise à jour réussie. Ne jamais supprimer une maintenance pour masquer un échec.
Un ancien updater demande un premier déploiement depuis INSTALLATION 12.0.

Clés, login registry/SSH, fichiers TLS et opérations CLI restent au responsable
serveur. Ne jamais les enregistrer dans un guide, un ticket Git ou un rapport.
Les commandes d’arrêt/migration/restauration sont dans le guide de référence,
pas exécutées dans cette mission.
