# ADR 0114 — Connexion unique SAML 2.0 (Microsoft Entra ID, Keycloak)

- Statut : acceptée (décisions du RSSI du 25/11/2026, relayées par la session « Projet audit_suivi Coeur »,
  `session_01ES6jrfuR1tD6Az1XDgAnS3`, qui valent décision écrite, AGENTS.md, règle 9)
- Date : 2026-11-25
- Numéro : 0114 ; migration `107`, attribués par la session Coeur (0112 est réservé au relais NVD).
- **Complète** l'[ADR 0066](0066-limitation-des-essais-du-second-facteur-et-verrouillage-partage.md) et
  l'[ADR 0070](0070-reponse-de-connexion-uniforme-et-alerte-de-verrouillage.md) (connexion), l'[ADR 0074](0074-alerte-de-securite-dans-l-application.md)
  (alertes de sécurité), l'[ADR 0079](0079-authentification-fido2-webauthn.md) (second facteur, ré-authentification) et
  l'[ADR 0097](0097-flux-sortants-pilotes-par-les-modules.md) (flux vers l'extérieur) ; respecte l'[ADR 0006](0006-front-react-mantine-csp-stricte.md)
  (CSP stricte), l'[ADR 0014](0014-donnees-sur-le-serveur-et-mises-a-jour.md) (l'API n'a pas d'accès Internet) et
  l'[ADR 0092](0092-refonte-des-droits-pyramide-des-perimetres.md) (droits et périmètres, inchangés).
- **Remplace**, pour la phase 4 de la feuille de route, l'authentification unique OIDC prévue : SAML retenu par le RSSI.

## Contexte

Les établissements disposent déjà d'un fournisseur d'identité (Microsoft Entra ID, Keycloak). Le RSSI demande que les personnes
s'y connectent sans mot de passe propre à l'application, sans affaiblir la double authentification exigée partout ailleurs
(`MFA_REQUIRED`) et sans déléguer les droits au fournisseur.

## Décisions du RSSI du 25/11/2026 (reportées telles quelles)

1. **Double authentification** : la connexion SSO n'est acceptée que si l'assertion **prouve une MFA faite chez l'IdP**. Pas de
   second facteur local pour les comptes SSO. Sans preuve de MFA, refus.
   - Entra : claim `http://schemas.microsoft.com/claims/authnmethodsreferences` contenant
     `http://schemas.microsoft.com/claims/multipleauthn`.
   - Keycloak : `AuthnContextClassRef` ou attribut configuré.
   - Ce réglage se fait par fournisseur : nom de l'attribut et valeurs acceptées, avec des valeurs par défaut selon le type de
     fournisseur.
2. **Comptes créés d'avance** : l'administrateur crée le compte, le marque « connexion SSO » et saisit l'identifiant attendu de
   l'IdP. Une personne sans compte est refusée. Aucune création à la volée.
3. **Droits locaux seulement** : rôles, groupes et périmètres restent attribués dans l'application. L'IdP ne fait que prouver
   l'identité.
4. **Connexion locale par compte, avec secours** : un compte SSO ne peut plus se connecter par mot de passe ni par TOTP. Les
   comptes locaux restent possibles, avec au moins un administrateur local (mot de passe, TOTP, clé). L'application refuse de
   passer en SSO le dernier administrateur local actif.
5. **Métadonnées : la solution la plus sûre et automatique**, et non l'import seul. Formulation du RSSI : « Le plus secure et
   moderne et automatique. Si flux doit être ouvert alors comme le reste au moment de la configuration ça ouvrira les flux. »
   - L'application lit périodiquement l'URL de métadonnées de chaque fournisseur, en HTTPS uniquement, par un **flux sortant
     déclaré dans le registre** `packages/shared/src/flux-externes.ts`. Le flux est fermé par défaut et s'ouvre, comme les
     autres, quand l'administrateur configure le fournisseur et confirme.
   - Destinations : Entra, `login.microsoftonline.com` ; Keycloak, l'hôte de l'URL saisie, souvent interne, montré à la
     confirmation d'ouverture du flux ; le http clair et les URL avec identifiants sont refusés.
   - Métadonnées signées : signature vérifiée ; cohérence de l'entityID contrôlée.
   - L'**import manuel** du fichier XML reste possible en secours, flux fermé.
   - Alerte de sécurité dans l'application (ADR 0074) avant l'expiration du certificat de signature de l'IdP (30 jours), et
     quand une relecture des métadonnées échoue ou change le certificat.
6. **XML dans l'API** avec une bibliothèque éprouvée : `@node-saml/node-saml`, en version exacte publiée depuis au moins deux
   semaines. Analyse XML durcie (DTD et entités refusées, taille limitée). Assertion **signée obligatoire** (réponse ou
   assertion), algorithmes SHA-256 ou plus seulement, contrôles `Audience`, `Destination`, `Recipient`, `NotBefore` et
   `NotOnOrAfter` avec une petite tolérance d'horloge. Le principe « l'API ne lit aucun XML » devient **« aucun XML hors
   SAML »**.

**Destination Internet nouvelle** (règle d'AGENTS : décision écrite et datée du RSSI) : `login.microsoftonline.com`, TCP 443,
par le flux `sso-saml`, autorisée par la décision 5 du 25/11/2026 ci-dessus. Pour Keycloak ou un fournisseur SAML générique, la
destination est l'hôte de l'adresse saisie par l'administrateur, montrée et validée à chaque adresse nouvelle.

## Mise en œuvre

### Connexion (SP-initiated seulement)

- **Départ** : `GET /api/auth/sso/:id/connexion?retour=…` (lien de la page de connexion, navigation de la page entière, sans
  script). La demande (AuthnRequest, HTTP-Redirect, signée RSA SHA-256 si la clé du service existe) est enregistrée en base
  (`sso_requetes` : identifiant, fournisseur, chemin de retour validé, cinq minutes, usage unique). Chemin de retour : relatif et
  interne (`/…`, jamais `//`, `/\`, `/api/…` ni caractère de contrôle), sinon 400. Le binding POST sortant est écarté :
  `form-action 'self'` et l'interdiction des scripts en ligne l'empêchent.
- **Retour** : `POST /api/auth/sso/:id/acs` (HTTP-POST, `application/x-www-form-urlencoded`). Une adresse par fournisseur :
  l'adresse elle-même désigne les certificats à utiliser, sans lire le document avant sa validation. **Seule route** exemptée du
  contrôle d'origine (`origineExterne: 'acs-saml'` de `route()`, refusée à l'enregistrement pour toute autre adresse, sans
  session ni CSRF) ; analyseur de formulaire propre à cette route (contexte Fastify encapsulé), corps limité à 256 Kio, un
  champ répété est refusé. L'état n'est jamais lié par cookie (le cookie `SameSite=Strict` ne passe pas sur le POST du
  fournisseur). Succès : session ouverte à l'état `mfaOk` (`sessions.par_sso`), redirection 303 vers le chemin de retour ; le
  cookie `SameSite=Strict` posé sur cette réponse accompagne ensuite les appels de l'interface (`/api/auth/me`, même origine).
  Refus : 303 vers `/login?sso=<code>` (refus, mfa, compte, expire, indisponible), jamais le motif exact.
- **Contrôles** : XML durci avant toute analyse (`connexion-unique/xml.ts` : taille, UTF-8 strict, aucun `<!` autre qu'un
  commentaire ou une section CDATA, donc ni DOCTYPE, ni ENTITY, ni ATTLIST ; aucun caractère nul ; encodage UTF-8) ;
  algorithmes de toutes les signatures limités à `rsa-sha256`, `sha256-rsa-MGF1`, `rsa-sha512` et condensés SHA-256/SHA-512
  (SHA-1 refusé) ; racine `samlp:Response`, assertion non chiffrée et unique ; `Destination` égale à l'adresse de retour ;
  puis `@node-saml/node-saml` : signature de la réponse ou de l'assertion (l'une des deux exigée), émetteur, `Audience`
  (entityID du service), `NotBefore`/`NotOnOrAfter` avec deux minutes de tolérance, `InResponseTo` obligatoire et consommé
  une fois (`validateInResponseTo: always` ; IdP-initiated refusé), anti-rejeu des identifiants d'assertion jusqu'à leur
  `NotOnOrAfter` (`sso_assertions_vues`) ; enfin, sur l'assertion vérifiée : `Recipient` d'une confirmation « bearer » égal à
  l'adresse de retour, preuve de la double authentification (attribut nommé, ou `AuthnContextClassRef`, parmi les valeurs
  acceptées), compte rapproché.
- **Comptes** : colonnes additives `users.mode_connexion` (`local` ou `sso`), `sso_fournisseur_id`, `sso_identifiant`, unicité
  (fournisseur, identifiant sans casse). Rapprochement par NameID (défaut) ou par un attribut nommé. `password_hash` reste
  obligatoire : un compte `sso` reçoit une empreinte inutilisable (`sso$inutilisable`), jamais vérifiée. Refus du mot de passe
  d'un compte `sso` : réponse uniforme `ECHEC_CONNEXION` (ADR 0070), motif `sso` au journal. Passage d'un compte en `sso` :
  TOTP effacé, clés révoquées et codes de récupération effacés (`reinitialiser`), sessions fermées ; retour en `local` : mot de
  passe temporaire à générer. Mot de passe, TOTP, clés et codes : routes refusées (403, `reason: sso`) pour un compte `sso`.
  Une session d'un compte `sso` qui n'a pas été ouverte par la connexion unique n'est jamais admise.
- **Moteur d'étapes** (`accessStage`) : compte `sso` connecté par SSO, étape `ok` (ni `enroll`, ni `mfa`, ni `enroll_key`, ni
  `password`). Règles des comptes locaux inchangées ; `MFA_REQUIRED` et `mfaRequired: true` restent vrais pour eux.
- **Dernier administrateur local** : `assertAdminRemains` exige aussi un administrateur actif et permanent en connexion locale
  (409, `reason: dernier_admin_local`) ; sans compte `sso`, le contrôle est le précédent.
- **Ré-authentification** : `POST /api/account/reauth/sso` rend l'adresse d'un aller-retour avec `ForceAuthn="true"` ; le retour
  marque `reauth_at` de la session nommée par la demande (identifiant de session et compte enregistrés avec elle), après
  contrôle que l'assertion désigne le même compte. Elle tient lieu de mot de passe et de second facteur pour `exigerReauth`.
- **Déconnexion** : locale seulement. Pas de déconnexion unique (SLO) : elle passerait par des cadres cachés, interdits par
  `frame-ancestors 'none'`, ou par des redirections en chaîne vers chaque fournisseur ; la session du fournisseur reste ouverte.
- **Journal** (`db.audit`) : `auth.sso_succes`, `auth.sso_refus` (motif : `xml`, `signature`, `algorithme`, `audience`,
  `destination`, `expiration`, `rejeu`, `requete_inconnue`, `idp_initie`, `mfa_absente`, `compte_inconnu`, `compte_local`,
  `compte_desactive`, `reauth_autre_compte`, `fournisseur`, `statut`, `invalide`), `auth.sso_reauth`,
  `auth.sso_fournisseur_cree|modifie|supprime`, `auth.sso_metadonnees_lues|refusees|echec`, `auth.sso_relecture_demandee`,
  `auth.sso_certificat_expire_bientot`. Un refus pour double authentification absente ou signature invalide (ou algorithme
  refusé) déclenche une alerte de sécurité.

### Fournisseurs et métadonnées

- Plusieurs fournisseurs (`entra`, `keycloak`, `saml` générique), actifs ou non ; valeurs par défaut de la preuve de double
  authentification par type (`MFA_PAR_DEFAUT` : Entra, claim des méthodes ; Keycloak, `AuthnContextClassRef`, valeurs à aligner
  sur le royaume). Keycloak et générique avec `AuthnContextClassRef` : la classe attendue est demandée dans l'AuthnRequest
  (`RequestedAuthnContext`, comparaison `exact`) ; Entra n'accepte pas ces demandes. Identifiant attendu (entityID) obligatoire :
  métadonnées et assertions doivent le porter.
- **Lecture automatique** (flux `sso-saml`) : porteur **exécutant d'exploitation** (service `updater`), sur le modèle des
  connecteurs et de la veille : l'API enregistre l'état voulu et tient la file ; l'exécutant réclame une lecture due
  (`suivi sso-metadonnees-claim` : jamais lue, plus de six heures, ou relecture demandée), la confie au script isolé
  `scripts/sso-metadonnees.py` (compte 65534, `python -I`, environnement minimal, 30 secondes, HTTPS seulement, certificat et nom
  vérifiés, autorité facultative du fournisseur, aucune redirection, 1 Mio au plus, **aucune analyse XML**) et rend le contenu
  en base64 (`suivi sso-metadonnees-finish <id>`). L'API contrôle alors le document : XML durci, un seul `EntityDescriptor`,
  entityID attendu, `IDPSSODescriptor` SAML 2.0, adresse HTTP-Redirect en `https://`, certificats de signature. Métadonnées
  signées : signature vérifiée (mêmes algorithmes) et seules les données couvertes lues ; à la relecture, la signature doit
  venir d'un certificat déjà connu (une rotation annoncée à l'avance dans les métadonnées passe) ; au premier chargement et à
  l'import, d'un certificat que le document déclare. Refus : configuration conservée, erreur affichée, alerte au premier échec.
- **Ouverture du flux** : enregistrer une adresse de métadonnées nouvelle ou changée exige `fluxConfirme: true` (409
  `flux_validation` sinon, avec la destination), puis ouvre le flux dans la même transaction (journal `flux.externe.ouvert`,
  origine `sso.fournisseur`) ; plus aucune adresse : flux refermé. La route commune ferme toujours.
- **Import manuel** (`POST /api/admin/sso/fournisseurs/:id/metadonnees`) : même contrôle, flux fermé possible.
- **Alertes** (ADR 0074) : certificat de signature qui expire dans moins de 30 jours (vérifié toutes les heures, une alerte
  par jeu de certificats), relecture en échec (au passage en échec), certificat changé, refus pour double authentification
  absente ou signature invalide. Plafond horaire par type d'alerte : une rafale de refus ne masque pas l'alerte d'expiration.
- **Service (SP)** : entityID `https://<site>/api/auth/sso/sp`, adresse de retour par fournisseur, certificat des demandes
  signées et fichier XML de métadonnées du service (`GET /api/admin/sso/fournisseurs/:id/metadonnees-sp`) à recopier chez le
  fournisseur. Clé RSA 3072 bits et certificat auto-signé (dix ans) générés par le service `init` (`saml_sp_key`,
  `saml_sp_cert`, dossier des secrets, jamais dans le dépôt), sauvegardés avec les autres secrets.
- **Interface** : boutons « Se connecter avec … » sur la page de connexion, un par fournisseur actif et prêt, au-dessus du
  formulaire local ; carte « Connexion unique (SAML) » dans Configuration système > Sécurité ; mode de connexion dans la fiche
  d'un compte ; « Mon compte » d'un compte `sso` : confirmation d'identité par le fournisseur à la place du mot de passe, du
  TOTP et des clés.

### Dépendance

`@node-saml/node-saml` **5.2.0** (version exacte, publiée le 26/10/2026), seule dépendance nouvelle de l'API ; elle tire
`xml-crypto` 6.4.0, `@xmldom/xmldom` 0.8.15, `xml2js` 0.6.2, `xmlbuilder` 15.1.1, `xml-encryption` 3.1.0 et `xpath` 0.0.35.
Les tests signent leurs réponses avec la même bibliothèque. Aucune autre partie de l'API n'analyse de XML (test
`connexion-unique-architecture.test.ts`) ; l'import Nessus reste lu dans le navigateur.

## Choix faits par la session de développement, à faire valider

1. **Porteur du flux** : l'exécutant d'exploitation par un script isolé dédié (`sso-metadonnees.py`), comme Tenable et la veille.
2. **Mandataire de l'établissement** (ADR 0101) : non utilisé dans ce lot (`USAGE_MANDATAIRE` : « pas encore pris en charge ») ;
   une installation qui ne sort vers Internet que par le mandataire importe les métadonnées d'Entra ID à la main.
3. **Période de relecture** : six heures ; relecture immédiate à la demande.
4. **Adresse de retour par fournisseur** plutôt qu'une seule adresse (pas de lecture du document avant sa validation).
5. **Demandes de connexion toujours signées** quand la clé du service existe ; assertions chiffrées non prises en charge (le
   canal est déjà chiffré) : une assertion chiffrée est refusée.
6. **Installer une mise à jour et remettre la base à vide** restent sous code TOTP : réservés aux comptes locaux (l'aller-retour
   SSO pourrait y remplacer le code, à décider).
7. **Entra ID** : seul l'hôte `login.microsoftonline.com` (pas les nuages souverains).
8. **Risque résiduel, état non lié au navigateur** (consigne : ne pas lier l'état par cookie) : la demande est liée au
   fournisseur, pas au navigateur qui l'a lancée. Une personne qui a elle-même un compte « sso » pourrait faire poster sa
   propre réponse, encore valable, par le navigateur d'une autre (connexion forcée sur le compte de l'attaquant, sans accès
   aux données de la victime). Parade possible, à décider : un témoin `SameSite=None; Secure; HttpOnly` de cinq minutes, propre
   à la demande, vérifié sur l'adresse de retour.

## Conséquences

- Le flux `sso-saml` est fermé sur toute installation, neuve ou mise à jour ; rien ne sort tant qu'aucune adresse de
  métadonnées n'est validée.
- Une sauvegarde antérieure à cette version, restaurée, ne contient pas la clé du service : `init` en génère une nouvelle, dont
  le certificat est à recopier chez le fournisseur si celui-ci vérifie les demandes signées.
- Tests : `apps/api/test/connexion-unique.test.ts` (fournisseur fictif, réponses signées), `connexion-unique-architecture.test.ts`,
  `packages/shared/test/connexion-unique.test.ts`, `apps/web/test/connexion-unique.test.ts`,
  `scripts/tests/test_sso_metadonnees.py`.
