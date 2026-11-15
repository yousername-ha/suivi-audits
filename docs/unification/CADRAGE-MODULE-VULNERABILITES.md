# Cadrage — module Vulnérabilités (veille, Tenable Security Center, Ekialis, assistant RSSI)

**Statut** : cadrage du 15/11/2026, à la demande du RSSI, avec ses décisions V1 à V7 de
l'[ADR 0100](../adr/0100-module-vulnerabilites.md) (proposée, à valider). Aucun code, aucune migration. Rédigé par la session
« Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`).

## 1. Besoin

Savoir, sans y penser, quelles failles publiées concernent l'organisation, lesquelles sont exploitées, et quoi traiter d'abord :

- **surveiller les publications** de sources fiables : CERT-FR, CERT Santé, catalogue CISA des failles exploitées (KEV), EPSS, NVD ;
- **savoir ce qui est présent** : résultats de Tenable Security Center (interne), produits de l'organisation (saisis, ou lus
  dans Ekialis) rapprochés par fournisseur et par produit ;
- **prioriser et alerter** : la plateforme calcule la priorité ; l'assistant RSSI rédige l'alerte, rappelle le responsable et
  propose l'action.

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

## 4. Lots proposés (sans calendrier ; estimations non établies)

| Lot | Contenu                                                                                                                                                             | Acceptation                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V0  | ADR 0100 et ce cadrage                                                                                                                                              | Relus et validés par le RSSI ; points ouverts tranchés                                                                                                                                                  |
| V1  | **Socle.** Module `vulnerabilites`, migration additive, registre des produits surveillés, rubrique et droits                                                        | Refus sans droit, module désactivé, hors périmètre. Migration testée sur base vierge. Captures clair et sombre                                                                                          |
| V2  | **Veille, sources structurées.** Script de l'exécutant, flux `veille-vulnerabilites`, KEV, EPSS, NVD ; failles rangées en champs structurés                         | Aucun hôte hors liste joint, prouvé par test. Flux fermé : rien n'est émis. Réponse trop grosse ou mal formée refusée. Collecte rejouée sans doublon. Test d'architecture du registre des flux vert     |
| V3  | **Veille, avis en français.** CERT-FR et CERT Santé (RSS) : identifiants extraits, résumé borné et nettoyé                                                          | Flux piégé (balisage, déclaration de type, entités, texte démesuré) refusé ou nettoyé, prouvé par test. Identifiant mal formé écarté                                                                    |
| V4  | **Rapprochement et priorité.** Rapprochement par produit avec confirmation, règles de priorité, seuils réglables, états de la faille, lien vers une action          | Priorité rejouable à l'identique à données égales. Rapprochement par nom jamais appliqué sans décision. Rejet non reproposé. Action créée avec les droits de la personne                                |
| V5  | **Tenable Security Center.** Adaptateur sur le socle de l'ADR 0076, agrégats par faille, proposition « corrigée » quand la faille disparaît                         | Seuls les points d'accès de lecture listés sont émis, prouvé par test. Aucun nom de machine ni adresse rangé. Clé jamais relue ni journalisée. Essai sur l'instance de recette                          |
| V6  | **Alerte et assistant.** Notification « faille exploitée », outil de lecture en agrégats, ronde sur événement, rappel, proposition d'action                         | Alerte émise sans assistant. Ce qui part au modèle ne contient ni machine ni adresse, prouvé par test. Résumé piégé non suivi (jeu d'évaluation). Une seule alerte par faille tant qu'elle ne change pas |
| V7  | **Ekialis.** Adaptateur et propositions de produits, ou import de fichier si l'API ne convient pas                                                                  | Lot cadré après lecture de la documentation de l'API ; aucun produit créé sans décision                                                                                                                 |

Dépendance : V5 et V7 demandent le socle des connecteurs (lots I1 et I4 de
l'[ADR 0076](../adr/0076-module-integrations.md), DEV-006). V1 à V4 n'en dépendent pas. Chaque lot livre le code, la migration
additive éventuelle, les droits serveur, les tests et la documentation. Une PR par lot vers `claude-suivi-smsi`.

## 5. Ce qu'il faut du RSSI

- **V0** : la validation de l'ADR 0100 et la réponse à ses cinq points ouverts.
- **V5** : la version de Tenable Security Center ; un compte **en lecture seule** et sa clé d'API ; une instance de recette
  joignable par l'exécutant, ou des **exemples de réponses anonymisés** (aucun nom de machine ni adresse réels : le dépôt est
  public) ; les filtres voulus (gravité minimale, dépôts ou groupes de machines).
- **V7** : la documentation de l'API d'Ekialis, un compte en lecture seule, et les champs à reprendre (éditeur, application,
  version, responsable).
- **V4 et V6** : les seuils de départ, les destinataires de l'alerte, et les produits à surveiller en premier.
- **Avant la mise en service** : la lecture des conditions d'usage de chaque source (NVD et CISA publient pour un usage
  public ; CERT-FR, CERT Santé et EPSS restent à lire).

## 6. Ce que ce cadrage n'établit pas

- L'API d'Ekialis : rien n'a été vérifié, aucun champ n'est supposé.
- Les points d'accès exacts de Tenable Security Center, son authentification et ses vues agrégées : à lire sur l'instance.
- Un téléchargement en masse des scores EPSS, les limites de débit et la stabilité des formats des cinq sources. Chacune a
  répondu à une requête de lecture le 15/11/2026 depuis le conteneur de la session, pas depuis un serveur installé.
- La qualité du rapprochement par nom et la pertinence des alertes de l'assistant : non mesurées.
- Aucun balayage de réseau, aucune écriture vers un outil externe, aucune lecture de réseaux sociaux dans ces lots.
