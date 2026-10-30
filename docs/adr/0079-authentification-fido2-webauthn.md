# ADR 0079 — Authentification FIDO2 / WebAuthn (clés de sécurité)

- Statut : proposée (numéro annoncé au RSSI le 30/10/2026, à confirmer ; 0078 est pris par la branche du tableau de bord)
- Date : 2026-10-30
- Contexte : la connexion exige le mot de passe puis un code TOTP ([ADR 0066](0066-limitation-des-essais-du-second-facteur-et-verrouillage-partage.md),
  [ADR 0070](0070-reponse-de-connexion-uniforme-et-alerte-de-verrouillage.md)). Le TOTP résiste mal à l'hameçonnage en temps
  réel (un code saisi sur un faux site est rejoué aussitôt). Le RSSI demande la prise en charge des clés FIDO2 (YubiKey 5,
  passkeys) en second facteur, obligatoire pour les administrateurs sur décision, avec le TOTP conservé en secours.

## Décision

1. **Second facteur, pas de connexion sans mot de passe.** Après le mot de passe, l'étape « second facteur » accepte au choix
   une clé de sécurité, le code TOTP ou un code de récupération. Le modèle prépare la connexion sans mot de passe
   (`residentKey: preferred`, identifiant WebAuthn du compte de 32 octets aléatoires, jamais l'UUID interne) mais la politique
   la verrouille (`passwordless: false`, valeur littérale refusée autrement). Le TOTP reste obligatoire pour tous
   (`MFA_REQUIRED`), y compris à l'installation, où l'ajout d'une clé est proposé, facultatif, juste après.
2. **Bibliothèque.** `@simplewebauthn/server` 14.0.3 et `@simplewebauthn/browser` 14.0.0, versions épinglées, publiées avec
   une provenance npm (SLSA v1), dépôt MasterKale/SimpleWebAuthn, `pnpm audit` sans faille connue ; aucune cryptographie écrite
   dans le projet. Le serveur tire une vingtaine de dépendances transitives (`@peculiar/*`, `asn1js`, `tiny-cbor`) ; le
   navigateur aucune. Lignes ajoutées à l'[ADR 0009](0009-dependances-et-versions.md).
3. **Relying party.** `RP_ID`, `RP_NAME` et `RP_ORIGINS` (liste stricte, séparée par des virgules). Sans `RP_ID` ni
   `RP_ORIGINS`, la configuration est **déduite de l'adresse du site** (`PUBLIC_URL`, donc `SITE_ADDRESS`) : une mise à jour ne
   demande aucune modification de `.env`. Une configuration déduite inutilisable (adresse IP, HTTP) **désactive** les clés sans
   bloquer le démarrage ; une configuration **explicite** incohérente **arrête le démarrage** (fail closed) : RP ID qui n'est
   pas un nom de domaine en minuscules, origine non HTTPS (HTTP admis pour `localhost` hors production seulement), origine hors
   du domaine du RP ID, origine avec un chemin. Les clés ne sont jamais exigées d'un compte quand le serveur ne les propose pas.
4. **Challenges.** 32 octets aléatoires, stockés côté serveur (`webauthn_challenges`), liés à la session (supprimés avec elle),
   un seul par session et par usage (enrôlement, connexion, ré-authentification), **usage unique** (supprimé à la première
   lecture, valide ou non), durée de vie de **5 minutes**. Seule l'empreinte SHA-256 de sa forme base64url est conservée.
5. **Vérifications.** Origine dans `RP_ORIGINS`, `rpIdHash` égal au RP ID, type de la réponse, présence **et vérification de
   l'utilisateur** (code PIN ou biométrie : `userVerification: required`), signature, algorithmes ES256 (-7), EdDSA (-8) et
   RS256 (-257). À l'enrôlement : `excludeCredentials` (clés non révoquées du compte : une clé physique révoquée peut être réenregistrée) et refus
   explicite d'une clé déjà enregistrée. À la connexion : `allowCredentials` limité aux clés non révoquées et non suspendues.
6. **Compteur de signature.** Contrôlé **après** une signature valide (une réponse forgée ne peut pas faire suspendre la clé d'un
   tiers). Une clé qui tient un compteur (non nul) doit le faire progresser ; sinon : connexion refusée, clé **suspendue**
   (`suspect_at`), évènement `auth.webauthn_compteur` et alerte (application et courriel, plafond horaire de l'ADR 0070).
   Seul un administrateur la réactive (après vérification auprès du porteur) ou la révoque. Les passkeys synchronisées
   renvoient toujours 0 : 0 après 0 est accepté. La mise à jour du compteur est conditionnelle (deux réponses simultanées ne le
   font progresser qu'une fois).
7. **Session.** Le second facteur réussi (clé ou code de récupération) efface les échecs et régénère la session, comme le TOTP.
   Les échecs (hors demande expirée) comptent dans le verrouillage partagé avec le mot de passe (ADR 0066). Limites par session
   et par compte sur toutes les routes WebAuthn, en plus de la limite globale par adresse.
8. **Ré-authentification récente (step-up).** Enrôler, révoquer une clé et générer des codes de récupération exigent une
   ré-authentification de moins de **5 minutes** : mot de passe puis code TOTP ou clé existante (`POST /api/account/reauth`).
   L'ouverture d'une session complète vaut ré-authentification. Le mot de passe seul n'est accepté que pour un compte qui n'a
   encore aucun second facteur (serveur où `MFA_REQUIRED=false`). La première clé enrôlée dans une session sans second facteur
   régénère cette session à l'état « second facteur validé ».
9. **Dernier facteur fort.** La révocation de sa dernière clé est refusée sans TOTP actif ; la désactivation du TOTP est refusée
   sans clé utilisable ; la dernière clé d'un compte soumis à l'obligation ne peut pas être révoquée par son titulaire.
10. **Codes de récupération.** Dix codes de 80 bits (base32, quatre groupes), affichés une seule fois, à usage unique ;
    empreinte HMAC-SHA-256 sous une clé dérivée (HKDF) de la clé maître, jamais le code. Ils ne comptent pas comme facteur fort.
    Leur génération annule les précédents.
11. **Politique** (Administration, Configuration système, Sécurité ; enregistrée avec `If-Match`, évènement
    `securite.webauthn_politique` avec l'avant et l'après, empreintes des certificats seulement) :
    - **obligation pour les administrateurs** (désactivée par défaut) : comptes qui détiennent `administration:administrer`,
      avec une **période de grâce** (14 jours par défaut, 0 à 90) comptée depuis l'activation ou la création du compte ; à
      l'échéance, un administrateur sans clé passe à l'étape `enroll_key` (seul l'enrôlement est ouvert). Le TOTP reste
      accepté en secours ; **chaque connexion par TOTP ou code de récupération d'un administrateur obligé qui a une clé
      déclenche une alerte** (décision du RSSI du 30/10/2026) ;
    - **clés matérielles uniquement** (désactivée par défaut) : attestation `direct` demandée, format `packed` avec chaîne de
      certificats exigé, chaîne vérifiée jusqu'aux racines FIDO de Yubico livrées avec l'application (U2F Root CA Serial
      457200631 et FIDO Root CA Serial 450203556, fichier signé vérifié) ou à des racines ajoutées par l'administrateur, et
      AAGUID dans une liste blanche (au moins un). Une attestation absente, auto-signée, non vérifiable ou d'un autre modèle
      est refusée explicitement.
12. **Administration.** Facteurs d'un compte (TOTP, clés révoquées comprises, codes restants), révocation d'une clé,
    réactivation d'une clé suspendue, réinitialisation (toutes les clés révoquées, codes effacés, sessions fermées,
    ré-enrôlement imposé à la connexion suivante). **Motif obligatoire**, consigné au journal. Pas de double validation par un
    second administrateur (décision du RSSI).
13. **Journalisation pour le SIEM.** Chaque évènement (enrôlement accepté ou refusé, connexion réussie ou refusée, code de
    récupération, ré-authentification, révocation, réactivation, réinitialisation, anomalie de compteur, connexion de secours,
    changement de politique) donne une ligne au **journal d'audit** (en ajout seul) et une ligne JSON `evt=securite.webauthn`
    sur la sortie standard, collectée par le pilote de logs Docker : horodatage, compte, adresse IP, user-agent, identifiant de
    clé **tronqué** (8 caractères), AAGUID, résultat, motif. **Jamais** de challenge, de clé publique, de signature ni de code.
14. **Données.** Migration additive `048_webauthn.sql` : tables `webauthn_credentials`, `webauthn_challenges`,
    `recovery_codes`, colonnes `users.webauthn_user_handle`, `users.webauthn_reenrolement` et `sessions.reauth_at`. Une clé
    révoquée est conservée (trace), jamais supprimée. Comme toutes les migrations du projet, elle ne s'annule pas ; une version
    antérieure ignore ces tables (décision du RSSI du 30/10/2026 : pas de script inverse). La remise à vide « tout » les efface
    avec les comptes.
15. **Navigateur.** Code empaqueté par Vite (CSP stricte inchangée, aucun script en ligne). `Permissions-Policy` limite
    `publickey-credentials-create` et `publickey-credentials-get` à l'origine. Messages en français : opération annulée ou délai
    dépassé (`NotAllowedError`), clé déjà enregistrée (`InvalidStateError`), navigateur non compatible, adresse refusée.

## Alternatives écartées

- **Connexion sans mot de passe dès maintenant** : reportée (phase 2). Elle suppose les passkeys découvrables, une procédure de
  perte de clé sans mot de passe et une revue des contrôles de verrouillage ; le modèle la prépare.
- **Implémentation maison de WebAuthn** (CBOR, COSE, chaînes X.509) : refusée, risque d'erreur cryptographique.
- **Annuaire FIDO MDS en ligne** pour la politique matérielle : écarté par défaut (appel réseau sortant depuis l'API, contraire au
  périmètre réseau actuel) ; les racines de Yubico sont livrées et l'administrateur peut en ajouter.
- **Vérification de l'AAGUID seul**, sans chaîne : refusée, l'AAGUID se falsifie.
- **Challenge dans un cookie ou côté client** : refusé (rejeu, liaison à la session impossible à garantir).
- **Suppression physique des clés révoquées** : écartée, la trace sert à l'audit (et l'unicité de l'identifiant de clé refuse sa réutilisation).
- **Migration réversible (script inverse)** : écartée par le RSSI le 30/10/2026, la migration est purement additive.

## Risques résiduels

- **Changement d'adresse du site** : le RP ID suit l'adresse ; toute clé enregistrée devient inutilisable (le TOTP et les codes
  restent valables). L'écran d'administration le rappelle ; il faut faire ré-enrôler les clés.
- **Passkeys synchronisées** : compteur toujours à 0, le clonage ne se détecte pas ; la politique « clés matérielles
  uniquement » les écarte pour qui l'exige.
- **TOTP de secours** : un administrateur obligé reste exposé à l'hameçonnage du TOTP ; l'alerte rend chaque usage visible.
- **Limites en mémoire** : une seule instance d'API (comme aujourd'hui) ; à revoir si l'API est un jour dupliquée.
- **Bibliothèque à mainteneur principal unique** : surveillance par Dependabot, Trivy et `pnpm audit` ; versions épinglées.
- **Racines d'attestation** : à mettre à jour si Yubico publie une nouvelle racine FIDO (les modèles récents sont couverts au
  30/10/2026) ; l'administrateur peut ajouter une racine sans nouvelle version.
- **Attestation `direct`** : certains navigateurs demandent alors l'accord de la personne ; un refus donne une clé sans
  attestation, refusée par la politique matérielle.
- **Non testé sur matériel réel dans la CI** : la recette manuelle ([liste de contrôle](../05_RECETTE/CHECKLIST-FIDO2.md))
  couvre les YubiKey USB et NFC, Windows Hello et les quatre navigateurs.

## Correspondance ISO/IEC 27001:2022 (annexe A)

| Mesure | Contribution |
| --- | --- |
| A.5.17 Informations d'authentification | Clés non exportables protégées par code PIN ; codes de récupération à usage unique, affichés une fois, stockés sous forme d'empreinte ; deux clés recommandées ; réinitialisation tracée avec motif. |
| A.8.2 Droits d'accès privilégiés | Clé obligatoire pour les comptes qui administrent (période de grâce, enrôlement imposé), alerte sur l'usage d'un facteur de secours, ré-authentification avant toute modification des facteurs. |
| A.8.5 Authentification sécurisée | Second facteur résistant à l'hameçonnage (origine et RP ID vérifiés), vérification de l'utilisateur exigée, challenge à usage unique de 5 minutes, détection du clonage, régénération de la session, limitation des essais et verrouillage, journalisation pour le SIEM. |

## Conséquences

- Nouvelles routes : `/api/auth/webauthn/options`, `/api/auth/webauthn`, `/api/auth/recovery`, `/api/account/reauth[/options]`,
  `/api/account/factors`, `/api/account/webauthn[/options|/:id]`, `/api/account/recovery-codes`,
  `/api/admin/users/:id/factors`, `/api/admin/users/:id/webauthn/:cle/{revoke,reactivate}`, `/api/admin/users/:id/webauthn/reset`,
  `/api/admin/webauthn/policy`. Nouvelle étape d'accès `enroll_key`.
- L'installation des mises à jour et la remise à vide gardent le code TOTP (décision du RSSI du 30/10/2026) ; leur ouverture aux
  clés est une évolution ultérieure.
- Guides : [administrateur](../06_GUIDES/GUIDE_ADMINISTRATEUR.md) (configuration, politique, réinitialisation) et
  [utilisateur](../06_GUIDES/GUIDE_UTILISATEUR.md) (enrôler, nommer, révoquer, codes).
