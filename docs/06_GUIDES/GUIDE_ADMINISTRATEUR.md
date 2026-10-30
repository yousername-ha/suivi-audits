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

## Clés de sécurité FIDO2 / WebAuthn ([ADR 0079](../adr/0079-authentification-fido2-webauthn.md))

Les clés de sécurité (YubiKey 5, clés FIDO2, passkeys) servent de second facteur après le mot de passe, à côté du code TOTP qui
reste obligatoire. Mise à jour : 2026-10-30 (Europe/Paris). Recette sur matériel réel : **NON EXÉCUTÉE**
([liste de contrôle](../05_RECETTE/CHECKLIST-FIDO2.md)).

**Configuration du serveur (relying party).** Par défaut, rien à faire : le domaine des clés (`RP_ID`) et l'origine acceptée
(`RP_ORIGINS`) sont déduits de l'adresse du site (`SITE_ADDRESS`). Pour les fixer, renseigner dans `.env` :

- `RP_ID` : nom de domaine en minuscules, sans schéma ni port (par exemple `suivi.exemple.fr`, ou le domaine parent
  `exemple.fr` pour accepter plusieurs sous-domaines) ; jamais une adresse IP ;
- `RP_ORIGINS` : liste stricte des origines, séparées par des virgules (`https://suivi.exemple.fr`), en HTTPS, dans le domaine
  de `RP_ID`, sans chemin ;
- `RP_NAME` : nom affiché par le navigateur (par défaut, le nom de l'application).

Une valeur explicite incohérente **arrête le démarrage** de l'API (message dans `docker compose logs app`). Une adresse de site
en IP ou en HTTP ne bloque rien : les clés ne sont simplement pas proposées. Administration, Configuration système, Sécurité
affiche la configuration retenue. **Changer l'adresse du site rend toutes les clés inutilisables** (le TOTP reste valable) :
prévenir les utilisateurs et leur faire enregistrer de nouvelles clés.

**Politique** (Administration, Configuration système, Sécurité, carte « Clés de sécurité ») :

1. *Clé obligatoire pour les administrateurs* : comptes qui détiennent « Administration : administrer ». Choisir la période de
   grâce (14 jours par défaut, 0 à 90), comptée depuis l'activation (ou la création d'un compte plus récent). À l'échéance, un
   administrateur sans clé ne peut plus qu'enregistrer une clé après sa connexion. **Avant de mettre 0 jour, enregistrer sa
   propre clé.** Le code TOTP reste accepté en secours ; chaque connexion par TOTP ou code de récupération d'un administrateur
   obligé déclenche une alerte (application et courriel), à traiter comme un incident si elle n'est pas expliquée.
2. *Clés matérielles uniquement* : seules les clés dont l'attestation remonte à une autorité connue et dont le modèle (AAGUID)
   figure dans la liste sont acceptées. Le bouton « Ajouter les YubiKey 5 courantes » remplit la liste ; les racines FIDO de
   Yubico sont incluses, d'autres racines (PEM) peuvent être ajoutées. Les passkeys synchronisées et Windows Hello sont alors
   refusés, sauf AAGUID ajouté. Les clés déjà enregistrées ne sont pas réexaminées.

Chaque changement de politique est journalisé (`securite.webauthn_politique`, avant et après).

**Facteurs d'un compte** (Droits, Utilisateurs, bouton « Facteurs ») : TOTP, clés (révoquées comprises), codes de récupération
restants. Actions, toutes avec un **motif obligatoire** consigné au journal :

- *Révoquer* une clé (clé perdue ou volée) : les sessions du compte sont fermées ;
- *Réactiver* une clé **suspendue** : une clé est suspendue quand son compteur de signature ne progresse pas (clonage
  possible) ; vérifier d'abord avec son porteur qu'il l'a en main et ne l'a ni prêtée ni perdue, sinon la révoquer ;
- *Réinitialiser les clés (forcer le ré-enrôlement)* : toutes les clés révoquées, codes effacés, sessions fermées ; à sa
  prochaine connexion (mot de passe puis TOTP), la personne doit enregistrer une nouvelle clé.

**Procédure de réinitialisation tracée** (clé perdue sans clé de secours) : vérifier l'identité de la personne par un canal
distinct (présentiel ou rappel sur un numéro connu), réinitialiser ses clés avec un motif qui cite le ticket, lui demander
d'enregistrer deux clés, puis relire l'évènement `admin.user_webauthn_reset` du journal d'audit. Téléphone perdu aussi :
réinitialiser également le TOTP (bouton « TOTP »).

**Journal d'audit et SIEM.** Évènements : `account.webauthn_enrolled`, `account.webauthn_enrolement_refuse`,
`auth.webauthn_succes`, `auth.webauthn_failed`, `auth.webauthn_compteur`, `auth.code_recuperation_utilise`,
`auth.code_recuperation_refuse`, `auth.facteur_secours`, `account.reauth`, `account.reauth_failed`, `account.webauthn_revoked`,
`account.webauthn_renamed`, `account.codes_recuperation_generes`, `admin.user_webauthn_revoked`,
`admin.user_webauthn_reactivated`, `admin.user_webauthn_reset`, `securite.webauthn_politique`. Chacun figure au journal d'audit
et sur la sortie standard de l'API (ligne JSON `"evt":"securite.webauthn"`, collectée par le pilote de logs Docker) avec
l'heure, le compte, l'adresse IP, le navigateur, l'identifiant de clé tronqué (8 caractères), l'AAGUID et le résultat. Les
alertes à remonter en priorité : `auth.webauthn_compteur` et `auth.facteur_secours`. Aucun challenge, clé ni code n'y figure.

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
