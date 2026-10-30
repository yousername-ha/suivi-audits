# Recette manuelle des clés de sécurité FIDO2 / WebAuthn

Rédigé le 2026-10-30 (Europe/Paris) par la session Claude « FIDO2/WebAuthn support for suivi-audits », pour l'[ADR 0079](../adr/0079-authentification-fido2-webauthn.md). État : **NON EXÉCUTÉE**, à dérouler après la publication de la v6.0.0 (les clés de sécurité y sont livrées).
Les tests automatisés (API avec authentificateur logiciel, Playwright avec l'authentificateur virtuel de Chromium) ne
remplacent pas ce passage sur matériel réel. Consigner pour chaque ligne : date, navigateur et version, système, modèle de
clé (sans numéro de série), résultat (PASSÉ, ÉCHEC, NON APPLICABLE) et remarque. Aucun code PIN, code de récupération ni
identifiant réel dans le compte rendu.

## Préparation

- Serveur de recette en HTTPS sur un nom de domaine (pas d'adresse IP), `SITE_ADDRESS` renseigné ; Administration,
  Configuration système, Sécurité affiche la relying party (`RP_ID`, origines).
- Deux comptes fictifs : un contributeur, un administrateur. Clés : YubiKey 5 USB-A, YubiKey 5C (USB-C), YubiKey 5 NFC, avec
  un code PIN FIDO2 défini (Yubico Authenticator) ; un poste Windows avec Windows Hello configuré ; un téléphone avec NFC.
- Ouvrir le journal d'audit (Administration, Journal d'audit) et `docker compose logs -f app | grep securite.webauthn`.

## Parcours par navigateur

À dérouler avec **Chrome**, **Edge**, **Firefox** et **Safari** (macOS), pour chaque type de clé disponible sur le poste.

| N° | Étape | Attendu |
| --- | --- | --- |
| 1 | Mon compte, « Ajouter une clé » (nom « Clé 1 »), juste après la connexion | Le navigateur demande la clé puis le code PIN ; la clé apparaît (type « Clé matérielle », date d'ajout, « jamais ») ; évènement `account.webauthn_enrolled` |
| 2 | Ajouter la même clé une deuxième fois | Message « Cette clé est déjà enregistrée sur votre compte. » ; aucune ligne ajoutée |
| 3 | Ajouter une seconde clé (« Clé de secours ») | Deux clés listées ; le conseil « deux clés » disparaît |
| 4 | Se déconnecter, se reconnecter : mot de passe, puis « Utiliser ma clé de sécurité » | Code PIN demandé, accès ouvert ; « Dernière utilisation » renseignée ; `auth.webauthn_succes` |
| 5 | Même étape, annuler la fenêtre du navigateur | « Opération annulée ou délai dépassé… » ; aucun accès ; on peut recommencer |
| 6 | Même étape, laisser expirer (plus de 4 minutes sans toucher la clé) | Même message ; la tentative suivante fonctionne |
| 7 | Présenter une clé non enregistrée | Refus du navigateur ou « Cette clé n'est pas enregistrée pour votre compte. » |
| 8 | Saisir un code PIN faux | Le navigateur refuse (compteur de la clé) ; aucun accès |
| 9 | Code TOTP à la place de la clé | Accès ouvert (secours), `auth.login` avec `facteur: totp` |
| 10 | Renommer « Clé 1 » | Nouveau nom affiché ; `account.webauthn_renamed` |
| 11 | Plus de 5 minutes après la connexion, révoquer une clé | Confirmation d'identité demandée (mot de passe + code ou clé), puis révocation ; `account.webauthn_revoked` |
| 12 | Générer les codes de récupération, se connecter avec un code, réutiliser ce code | Dix codes affichés une fois ; premier usage accepté, second refusé ; « 9 codes restants » |
| 13 | Clavier seul (Tab, Entrée, Échap) sur la connexion et Mon compte | Tous les boutons atteignables, focus visible, fenêtres fermées par Échap |

## Cas propres au matériel

| N° | Cas | Attendu |
| --- | --- | --- |
| 14 | YubiKey 5 NFC sur téléphone Android (Chrome), connexion | Approche de la clé, code PIN, accès ouvert |
| 15 | YubiKey 5 NFC sur iPhone (Safari), connexion | Idem |
| 16 | YubiKey 5C sur port USB-C (ordinateur portable), enrôlement et connexion | Idem étapes 1 et 4 |
| 17 | Windows Hello (Edge puis Chrome), enrôlement puis connexion | Type affiché « Clé matérielle » ou « Passkey » selon le système ; code PIN Windows ou biométrie demandés |
| 18 | Passkey synchronisée (trousseau iCloud ou gestionnaire de mots de passe), trois connexions de suite | Type « Passkey synchronisée » ; les trois connexions passent (compteur à 0 accepté) |
| 19 | Firefox avec YubiKey sans code PIN défini | Le navigateur demande de définir un code PIN, ou refuse : message clair, aucun accès |

## Administration et politique

| N° | Cas | Attendu |
| --- | --- | --- |
| 20 | Politique : obligation des administrateurs, grâce 14 jours | Le compte administrateur voit l'échéance dans Mon compte ; rien n'est bloqué ; `securite.webauthn_politique` |
| 21 | Grâce 0 jour, compte administrateur **sans** clé | Après mot de passe et TOTP : seul l'écran « Enregistrer une clé de sécurité » est proposé |
| 22 | Administrateur **avec** clé, connexion par TOTP | Accès ouvert, alerte « Connexion par facteur de secours » dans l'application (et courriel si configuré) ; `auth.facteur_secours` |
| 23 | Politique « clés matérielles uniquement » avec les YubiKey 5 courantes | Une YubiKey 5 est acceptée ; Windows Hello et une passkey synchronisée sont refusés (« seules les clés matérielles autorisées… ») ; le navigateur peut demander l'accord pour partager le modèle de la clé |
| 24 | Fiche « Facteurs » d'un compte, révocation avec motif | Clé révoquée, sessions du compte fermées ; `admin.user_webauthn_revoked` avec le motif |
| 25 | Réinitialisation des clés d'un compte | À la connexion suivante, enregistrement d'une clé imposé ; `admin.user_webauthn_reset` |
| 26 | Clé suspendue (simulée en recette : `UPDATE webauthn_credentials SET suspect_at = now()` sur la base de recette), réactivation | Badge « suspendue (compteur) », connexion refusée ; après réactivation avec motif, connexion acceptée |
| 27 | Changer l'adresse du site (recette seulement) | Les clés enregistrées ne fonctionnent plus ; le TOTP reste accepté ; l'écran Sécurité affiche la nouvelle relying party |
| 28 | `RP_ORIGINS=http://suivi.exemple.fr` dans `.env`, redémarrage | L'API refuse de démarrer (« Configuration WebAuthn invalide : … HTTPS obligatoire ») ; retirer la valeur rétablit le service |
