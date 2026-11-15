# Cadrage — module Vulnérabilités (veille, Tenable Security Center, Ekialis, assistant RSSI)

**Statut** : cadrage du 15/11/2026, à la demande du RSSI, avec ses décisions V1 à V7 de
l'[ADR 0100](../adr/0100-module-vulnerabilites.md) (acceptée le 15/11/2026), complétées le même jour par V8 à V14 (écrans, machines,
rôles, assistant). Les lots démarrent par V1. Rédigé par la session
« Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`).

## 1. Besoin

Savoir, sans y penser, quelles failles publiées concernent l'organisation, lesquelles sont exploitées, et quoi traiter d'abord :

- **surveiller les publications** de sources fiables : CERT-FR, CERT Santé, catalogue CISA des failles exploitées (KEV), EPSS, NVD ;
- **savoir ce qui est présent** : résultats de Tenable Security Center (interne), produits de l'organisation (saisis, ou lus
  dans Ekialis) rapprochés par fournisseur et par produit ;
- **prioriser et alerter** : la plateforme calcule la priorité ; l'assistant RSSI rédige l'alerte, rappelle le responsable et
  propose l'action.

- **voir et chercher** : barre de recherche, vue par faille avec ses machines, vue par machine, vue par périmètre où le front
  est relié au back applicatif puis aux bases ;
- **décider vite** : un écran de type poste de commandement, avec un radar dont chaque point est une faille, le vecteur
  d'attaque traduit en clair et les recommandations des sources.

Exemple du RSSI : une faille de PHP est publiée puis exploitée. La veille la relève, Tenable dit si des machines sont
touchées et combien, la plateforme la classe au plus haut niveau, le RSSI est alerté avec une proposition d'action.

## 2. Ce qui est réutilisé et ce qui est nouveau

| Besoin                          | Réutilise (existant ou déjà décidé)                                                                                       | Nouveau (strict nécessaire)                                                                |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Module, droits, menu            | `MODULES`, `route()` (garde, CSRF, activation), ADR 0019                                                                  | Module `vulnerabilites` et migration de la contrainte des modules                          |
| Produits de l'organisation      | Registre des fournisseurs (`SUP-nnn`, ADR 0032)                                                                           | Registre des produits surveillés                                                           |
| Téléchargement des sources      | Modèle du courriel : file en base, `exploitation-worker.py`, CLI de réclamation et de retour, script isolé, TLS vérifié   | Script de veille, liste fermée d'hôtes, lecture bornée du JSON et du RSS                   |
| Ouverture du réseau             | Registre des flux et validation explicite (ADR 0097), test d'architecture sur `docker-compose.yml`                        | Flux `veille-vulnerabilites`, `tenable`, `ekialis`                                         |
| Tenable, Ekialis                | Socle des connecteurs de l'ADR 0076 (instance, secrets scellés, exécution en file, rapport sans secret) : **non réalisé** | Adaptateurs `tenable` et `ekialis` ; liste fermée de points d'accès de lecture             |
| Produits proposés par Ekialis   | Cycle « proposition puis décision » (`pending`, `confirmed`, `rejected`, `withdrawn`)                                     | Propositions de produits                                                                   |
| Planification                   | Tic de 60 s de l'API, créneau consommé avant l'inscription, acteur `planification`                                        | Cadence par source                                                                         |
| Traitement d'une faille         | Registre des actions (`createObject`), droits et périmètres existants                                                     | Lien faille ↔ action ; état de la faille                                                   |
| Alerte                          | Notifications métier (ADR 0058) ; rondes sur événement, rappels et propositions d'action de l'assistant (ADR 0086)        | Type de notification « faille exploitée » ; outil de lecture de l'assistant ; déclencheur  |
| Interface                       | `packages/ui`, tableaux et fiches existants, CSP stricte (ADR 0006)                                                       | Rubrique « Vulnérabilités » : failles suivies, produits surveillés, sources               |
| Machines | Périmètres et droits de la pyramide (ADR 0092, 0095) | Inventaire des machines (Tenable, Ekialis), rôle, rattachement à un périmètre, affectation en masse |
| Classement par l'assistant | Rondes, propositions d'action (ADR 0086) | Rang calculé par la plateforme ; repères anonymes envoyés au modèle, remplacés en local au retour |
| Charte | Page de mise à jour (`docker/maintenance`), `packages/ui` | Radar, niveau d'alerte, schéma du vecteur d'attaque, vue par ligne |

## 3. Parcours cibles

- **Mise en service (administrateur)** :
  1. activer le module ;
  2. ouvrir le flux de veille après lecture des destinations et de ce qui sort ;
  3. créer le connecteur Tenable (adresse, autorité de certification, clé jamais réaffichée), tester, planifier ;
  4. régler les seuils de priorité et les destinataires de l'alerte.
- **Produits surveillés (RSSI, pilote)** : saisir un produit (fournisseur, produit, version, responsable), ou décider des
  produits proposés depuis Ekialis.
- **Chaque jour, sans intervention** :
  1. l'exécutant télécharge les sources et interroge Tenable ;
  2. la plateforme rapproche, calcule la priorité et met à jour la liste des failles suivies ;
  3. les rapprochements par nom attendent une confirmation.
- **Faille exploitée et détectée** :
  1. la plateforme notifie les personnes désignées ;
  2. si l'assistant est actif, une ronde ciblée part : alerte rédigée, rappel au responsable, action proposée ;
  3. une personne décide de l'action, puis fait vivre l'état de la faille jusqu'à « corrigée » ou « risque accepté ».

## 3 bis. Écrans (maquettes, données fictives)

Captures dans [maquettes-vulnerabilites](maquettes-vulnerabilites/), montées avec la feuille de style de la page de mise à jour.
Elles ne montrent ni le menu latéral de l'application, ni le thème clair, ni la largeur d'un téléphone.

| Écran | Capture | Contenu |
| --- | --- | --- |
| Vue d'ensemble | [01-vue](maquettes-vulnerabilites/01-vue.png) | Niveau d'alerte, radar, cible prioritaire, journal de veille, cibles par priorité, état des sources |
| Fiche d'une faille | [02-fiche](maquettes-vulnerabilites/02-fiche.png) | Position sur le radar, faits, vecteur d'attaque en clair et schéma, recommandations des sources, proposition de l'assistant, parcours |
| Recherche, vue par faille | [03-failles](maquettes-vulnerabilites/03-failles.png) | Recherche, faille dépliée sur ses machines regroupées par rôle |
| Vue par machine | [04-machines](maquettes-vulnerabilites/04-machines.png), [grand écran](maquettes-vulnerabilites/04b-machines-grand-ecran.png) | Machines en icônes rangées par ligne (front, back, bases, sans rôle), frontières visibles entre les lignes, rang, failles par gravité, lecture de l’assistant ; mode réduit (les plus prioritaires) et mode grand écran (tout le parc) |
| Vue par périmètre | [05-perimetre](maquettes-vulnerabilites/05-perimetre.png) | Front, back applicatif et bases, reliés par ligne |
| Produits surveillés | [06-produits](maquettes-vulnerabilites/06-produits.png) | Registre, origine, propositions venues d'Ekialis |
| Alerte critique | [07-alerte-critique](maquettes-vulnerabilites/07-alerte-critique.png) | Grande fenêtre rouge affichée quand une faille est exploitée et détectée, à prendre en compte |

## 4. Lots proposés (sans calendrier ; estimations non établies)

| Lot | Contenu                                                                                                                                                             | Acceptation                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V0  | ADR 0100 et ce cadrage                                                                                                                                              | Relus et validés par le RSSI ; points ouverts tranchés                                                                                                                                                  |
| V1  | **Socle.** Module `vulnerabilites`, migration additive, registre des produits surveillés, rubrique et droits                                                        | Refus sans droit, module désactivé, hors périmètre. Migration testée sur base vierge. Captures clair et sombre                                                                                          |
| V2  | **Veille, sources structurées.** Script de l'exécutant, flux `veille-vulnerabilites`, KEV, EPSS, NVD ; failles rangées en champs structurés                         | Aucun hôte hors liste joint, prouvé par test. Flux fermé : rien n'est émis. Réponse trop grosse ou mal formée refusée. Collecte rejouée sans doublon. Test d'architecture du registre des flux vert     |
| V3  | **Veille, avis en français.** CERT-FR et CERT Santé (RSS) : identifiants extraits, résumé borné et nettoyé                                                          | Flux piégé (balisage, déclaration de type, entités, texte démesuré) refusé ou nettoyé, prouvé par test. Identifiant mal formé écarté                                                                    |
| V4  | **Rapprochement et priorité.** Rapprochement par produit avec confirmation, règles de priorité, seuils réglables, états de la faille, lien vers une action          | Priorité rejouable à l'identique à données égales. Rapprochement par nom jamais appliqué sans décision. Rejet non reproposé. Action créée avec les droits de la personne                                |
| V5  | **Tenable Security Center et machines.** Adaptateur sur le socle de l'ADR 0076, failles et machines touchées, inventaire des machines, rôle et périmètre (un par un, en masse), proposition « corrigée » quand la faille disparaît                         | Seuls les points d'accès de lecture listés sont émis, prouvé par test. Une machine n'est lue qu'avec le droit de son périmètre. Clé jamais relue ni journalisée. Essai sur l'instance de recette                          |
| V6  | **Alerte et assistant.** Notification « faille exploitée », outil de lecture en agrégats, ronde sur événement, rappel, proposition d'action, classement des machines par repères                         | Alerte émise sans assistant. Ce qui part au modèle ne contient ni nom, ni adresse, ni rôle de machine, prouvé par test sur la requête émise ; repères remplacés en local ; repère inconnu écarté. Résumé piégé non suivi (jeu d'évaluation). Une seule alerte par faille tant qu'elle ne change pas |
| V7  | **Ekialis.** Adaptateur, propositions de produits et de machines (rôle et périmètre s'il les fournit), ou import de fichier si l'API ne convient pas                                                                  | Lot cadré après lecture de la documentation de l'API ; aucun produit créé sans décision                                                                                                                 |
| V8  | **Écrans du poste de commandement.** Radar, niveau d'alerte, recherche, vues par faille, par machine et par périmètre, vecteur d'attaque en clair, recommandations | Position d'un point rejouable à l'identique à données égales. Traduction du vecteur vérifiée valeur par valeur. CSP stricte respectée. Captures clair et sombre selon le thème retenu, de 390 à 1440 px |

Dépendance : V5 et V7 demandent le socle des connecteurs (lots I1 et I4 de
l'[ADR 0076](../adr/0076-module-integrations.md), DEV-006). V1 à V4 n'en dépendent pas. Chaque lot livre le code, la migration
additive éventuelle, les droits serveur, les tests et la documentation. Une PR par lot vers `claude-suivi-smsi`.

## 5. Ce qu'il faut du RSSI

- **V0** : la validation de l'ADR 0100 et la réponse à ses douze points ouverts.
- **V5** : Tenable Security Center est en version **6.9** (indiqué le 15/11/2026) ; un compte **en lecture seule** et ses clés d'API,
  saisies dans l'interface et jamais communiquées à une session ; une instance de recette
  joignable par l'exécutant, ou des **exemples de réponses anonymisés** (aucun nom de machine ni adresse réels : le dépôt est
  public) ; les filtres voulus (gravité minimale, dépôts ou groupes de machines).
- **V7** : la documentation de l'API d'Ekialis, un compte en lecture seule, et les champs à reprendre (éditeur, application,
  version, responsable).
- **V4 et V6** : les seuils de départ, les destinataires de l'alerte, et les produits à surveiller en premier.
- **Avant la mise en service** : la lecture des conditions d'usage de chaque source (NVD et CISA publient pour un usage
  public ; CERT-FR, CERT Santé et EPSS restent à lire).

## 5 bis. Tenable Security Center 6.9 : ce que dit la documentation publique

Version indiquée par le RSSI le 15/11/2026 : **6.9**. Lu le même jour dans la documentation publique de l'API
(`docs.tenable.com/security-center/api`), **sans essai sur une instance**.

| Sujet | Ce que la documentation indique | Conséquence pour le connecteur |
| --- | --- | --- |
| Authentification | Clés d'API dans l'en-tête `x-apikey: accesskey=…; secretkey=…;`. L'API « Token » (ouverture de session) est **dépréciée en 6.9** | Clés d'API seulement : deux secrets scellés, aucune session à ouvrir ni à fermer |
| Failles | `POST /analysis`, type `vuln`, source `cumulative`, pagination par `startOffset` et `endOffset` ; la réponse porte `totalRecords`, `returnedRecords` et `results` | La lecture se fait par `POST` : liste fermée de points d'accès de lecture (ADR 0100, point 6) |
| Vues agrégées | Outils `sumid` (par contrôle), `sumcve`, `sumip`, `sumseverity` ; détail par `vulndetails`, `listvuln`, `vulnipdetail`, `cveipdetail` | Agrégats par faille d'un côté, machines touchées de l'autre, sans rapatrier tout le détail |
| Filtres | `severity`, `exploitAvailable`, `cveID`, `vprScore`, `epssScore`, `cvssV3Vector`, `firstSeen`, `lastSeen`, `repository`, `pluginID` | Filtrage fait par Tenable : gravité minimale, dépôts, date de dernière détection |
| Champs d'un résultat | `pluginID`, `severity`, `vprScore`, `epssScore`, `ip`, `uuid`, `dnsName`, `name` | Nom et adresse de la machine disponibles ; score EPSS aussi fourni par Tenable |
| Machines | `GET /hosts` : `uuid`, `name`, `ipAddress`, `os`, `firstSeen`, `lastSeen`, `netBios`, criticité de l'actif (`acr`) ; `GET /hosts/{uuid}` ajoute `tags` | Inventaire des machines ; les étiquettes de Tenable peuvent porter le rôle, à confirmer |
| Correctif | `POST /solutions` et `POST /solutions/{pluginID}`, annoncés **expérimentaux** | Recommandation « Tenable » possible, mais l'accès peut changer d'une version à l'autre |

Points d'accès retenus pour la liste fermée, tous en lecture : `POST /analysis`, `POST /solutions`, `POST /solutions/{pluginID}`,
`GET /hosts`, `GET /hosts/{uuid}`, `GET /system`. Tout autre appel est refusé par le socle, en particulier
`PATCH /hosts/{uuid}/acr`, qui écrit.

Pour produire des exemples de réponses anonymisés depuis un poste Windows sans droits d'administrateur :
[`scripts/dev/exemples-tenable.ps1`](../../scripts/dev/exemples-tenable.ps1) (lecture seule, **non essayé** : aucun PowerShell
ni aucune instance dans la session).

**Non vérifié** : le préfixe des adresses sur l'instance (`/rest`), le rôle minimal du compte en lecture seule, la forme exacte
des réponses de chaque outil, les champs réellement renseignés selon la licence (score VPR, criticité de l'actif), les volumes
et les temps de réponse.

## 6. Ce que ce cadrage n'établit pas

- L'API d'Ekialis : rien n'a été vérifié, aucun champ n'est supposé.
- Les points d'accès exacts de Tenable Security Center, son authentification et ses vues agrégées : à lire sur l'instance.
- Un téléchargement en masse des scores EPSS, les limites de débit et la stabilité des formats des cinq sources. Chacune a
  répondu à une requête de lecture le 15/11/2026 depuis le conteneur de la session, pas depuis un serveur installé.
- La qualité du rapprochement par nom et la pertinence des alertes de l'assistant : non mesurées.
- Ce qu'Ekialis et Tenable fournissent sur les machines (rôle, périmètre, correctif indiqué) : à lire sur les instances.
- Aucun balayage de réseau, aucune écriture vers un outil externe, aucune lecture de réseaux sociaux dans ces lots.
