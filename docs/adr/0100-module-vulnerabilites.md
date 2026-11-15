# ADR 0100 — Module Vulnérabilités : veille sur listes fiables, lecture de Tenable Security Center et d'Ekialis, priorité calculée par la plateforme, alerte par l'assistant

- Statut : **proposée**, à valider par le RSSI. Numéro 0100 annoncé au RSSI et retenu par lui le 15/11/2026 (libre sur toutes les
  branches du dépôt à cette date). Aucun code, aucune migration.
- Date : 2026-11-15
- Rédaction : session « Module surveillance vulnérabilités SMSI » (`session_01EnWdzdnc8fBi6Yrc154Jy6`)
- Contexte : le RSSI demande, le 15/11/2026, un **module de surveillance des vulnérabilités** : suivre les failles publiées à
  partir du nom du fournisseur et du produit, récupérer par API les éléments de **Tenable Security Center** (interne) et
  d'**Ekialis**, surveiller les publications, et faire **prioriser et alerter l'assistant RSSI** quand une faille est exploitée
  (exemple donné : une faille de PHP). Cadrage détaillé et lots :
  [CADRAGE-MODULE-VULNERABILITES](../unification/CADRAGE-MODULE-VULNERABILITES.md).
- S'appuie sur : [ADR 0014](0014-donnees-sur-le-serveur-et-mises-a-jour.md) (API sans accès sortant),
  [ADR 0019](0019-activation-modules.md) (modules), [ADR 0032](0032-fournisseurs-de-l-organisation.md) (fournisseurs),
  [ADR 0058](0058-notifications-metier.md) (notifications), [ADR 0076](0076-module-integrations.md) (connecteurs en lecture
  seule, appels réseau par l'exécutant), [ADR 0086](0086-assistant-rssi-integre.md) (assistant),
  [ADR 0097](0097-flux-sortants-pilotes-par-les-modules.md) (flux pilotés par les modules).

## Décisions du RSSI (15/11/2026)

| N°  | Question                  | Décision                                                                                                                                         |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| V1  | Place dans l'application  | **Nouveau module « Vulnérabilités »**, avec ses droits et son activation. Il s'appuie sur le socle des connecteurs de l'ADR 0076                  |
| V2  | Sources de veille         | **CERT-FR, CERT Santé, catalogue CISA des failles exploitées (KEV), EPSS, NVD**. Des **listes fiables** seulement, pour limiter l'injection       |
| V3  | Tenable Security Center   | Lu **par API**. La plateforme est **hébergée en interne** et peut le joindre                                                                     |
| V4  | Ekialis                   | Lu **par API**                                                                                                                                   |
| V5  | Ce que reçoit le modèle   | **Des agrégats seulement**, par faille et par produit (gravité, exploitation, nombre de machines). Ni nom de machine ni adresse IP ne sort        |
| V6  | Rôle de l'assistant       | Il **priorise et alerte** en cas d'exploitation                                                                                                  |
| V7  | Démarrage                 | Cadrage et ADR d'abord, **sans code**                                                                                                            |

## Faits relevés le 15/11/2026

- **Existant** : l'ADR 0076 est acceptée, mais le module Intégrations n'est pas réalisé (DEV-006, « À FAIRE ») : ni table
  `integrations`, ni commandes `integrations-claim` et `integrations-finish`, ni socle HTTP de l'exécutant. L'assistant
  (ADR 0086) et le registre des flux (ADR 0097, `packages/shared/src/flux-externes.ts`) existent. Le registre des fournisseurs
  existe, sans notion de produit ; la cartographie applicative a été retirée (ADR 0089).
- **Sources essayées depuis le conteneur de la session** (une requête de lecture chacune, réponse 200) :
  - CISA KEV : `www.cisa.gov`, fichier JSON unique (1 781 failles, champs `cveID`, `vendorProject`, `product`, dates) ;
  - EPSS : `api.first.org/data/v1/epss`, JSON (score et centile par faille) ;
  - NVD : `services.nvd.nist.gov/rest/json/cves/2.0`, JSON ;
  - CERT-FR : flux RSS des alertes et des avis ; l'adresse historique `www.cert.ssi.gouv.fr` renvoie vers `cert.cyber.gouv.fr` ;
  - CERT Santé : flux RSS `cyberveille.esante.gouv.fr/alertes-et-vulnerabilites/rss.xml` (titre « produit - identifiant CVE »).
- **Hébergement** : le RSSI indique que la plateforme est hébergée en interne. L'ADR 0086 décrivait un VPS ; ce point ne
  change rien à l'assistant, dont le modèle reste distant.
- **Non vérifié** : l'API de Tenable Security Center telle que l'instance du RSSI l'expose (la documentation publique décrit
  une interrogation `POST /rest/analysis` de type `vuln` ; l'authentification par clé d'API et les vues agrégées restent à lire
  sur l'instance) ; **l'existence, le contenu et les conditions d'une API Ekialis** (rien trouvé sur le site public) ; les
  conditions d'usage et les limites de débit de chaque source ; un téléchargement en masse des scores EPSS.

## Décision proposée

1. **Nouveau module `vulnerabilites`**, ajouté à `MODULES`, désactivable (ADR 0019), avec des dépendances facultatives vers
   `fournisseurs`, `ecarts` et `assistant`. Actions :
   - `vulnerabilites:lire` : failles suivies, produits surveillés, état des sources ;
   - `vulnerabilites:modifier` : qualifier une faille, confirmer un rapprochement, tenir les produits surveillés ;
   - `vulnerabilites:administrer` : sources de veille, connecteurs, secrets, seuils de priorité.

   Créer une action à partir d'une faille exige **en plus** le droit du registre des actions et l'écriture sur le périmètre.
   Migration additive qui recrée la contrainte des modules, sans réécrire une migration publiée.

2. **Registre des produits surveillés.** Une fiche par produit : fournisseur (lien vers `SUP-nnn` quand il existe), nom du
   produit, version, identifiant normalisé facultatif (CPE), criticité, responsable, origine (saisie, Ekialis, Tenable). C'est
   la base de la veille « par fournisseur et par produit ». Le registre est proposé **au niveau de l'organisation**, comme les
   fournisseurs (ADR 0032) : point à confirmer par le RSSI (voir « Points ouverts »).

3. **Veille par l'exécutant d'exploitation, jamais par l'API ni par le modèle.** L'API garde zéro accès sortant (ADR 0014).
   Un script isolé de l'exécutant, sur le modèle de `courriel-envoi.py` (`python -I`, uid 65534, environnement minimal, durée
   bornée, bibliothèque standard seule), télécharge les sources retenues :
   - **liste fermée d'hôtes, écrite dans le code** : aucune adresse de source n'est réglable dans l'interface ;
   - lectures seules, HTTPS, certificat vérifié, taille et nombre d'éléments bornés, redirections suivies seulement vers un
     hôte de la liste ;
   - téléchargement **en masse ou par fenêtre de dates**, jamais par produit : les requêtes ne révèlent pas le parc ;
   - cadence par source, inscrite par le tic de l'API ; le résultat revient par la CLI, comme pour le courriel.

4. **Un flux déclaré par besoin** dans le registre de l'ADR 0097, fermé par défaut, ouvert par l'activation et sa validation
   explicite, refermé par la désactivation du module :
   - `veille-vulnerabilites` : sortie TCP 443 vers les cinq sources ; ce qui sort : l'adresse IP du serveur et des demandes de
     lecture, aucune donnée métier ;
   - `tenable` et `ekialis` : sortie vers l'adresse réglée de chaque outil ; ce qui sort : la clé d'API et des requêtes de
     lecture. Le flux vers Tenable ne quitte pas le réseau interne ; il est déclaré quand même, puisqu'il quitte le serveur.

5. **Les avis sont des données, pas des consignes.** De chaque source, la plateforme ne retient que des **champs
   structurés** : identifiant de la faille (CVE), identifiant de l'avis, fournisseur et produit, gravité, exploitation avérée,
   score EPSS, dates, adresse de l'avis. Le texte libre (titre, résumé) est débarrassé de son balisage, borné en longueur et
   rangé comme texte venu de l'extérieur. Un identifiant qui ne respecte pas son format est écarté. Les flux RSS sont lus avec
   la bibliothèque standard, taille bornée, toute déclaration de type de document refusée. **Aucun lien n'est jamais ouvert**
   par l'assistant.

6. **Tenable Security Center : connecteur en lecture seule**, sur le socle de l'ADR 0076 (instance, secret scellé en écriture
   seule, exécution en file, exécutant, rapport sans secret). L'interrogation de Tenable est une lecture émise par `POST` :
   le socle, qui refuse les méthodes d'écriture, admet pour ce connecteur une **liste fermée de points d'accès de lecture**. Le
   connecteur demande des résultats **déjà filtrés et agrégés par faille** : gravité, exploit disponible, nombre de machines
   touchées, première et dernière détection. **Les noms de machines et les adresses IP ne sont pas rangés dans la plateforme**
   dans la première version ; le détail reste dans Tenable. Point à confirmer par le RSSI.

7. **Ekialis : connecteur en lecture seule** qui alimente le registre des produits surveillés par **propositions** soumises à
   décision (`pending | confirmed | rejected | withdrawn`), comme les fournisseurs GLPI de l'ADR 0076. Tant que son API n'est
   pas lue sur sa documentation, aucun champ n'est supposé ; à défaut d'API utilisable, un import de fichier la remplace.

8. **Rapprochement entre une faille publiée et l'organisation**, par ordre de fiabilité :
   - **détectée** : Tenable rapporte la faille sur au moins une machine ;
   - **produit concerné, à confirmer** : la faille vise un produit surveillé, par identifiant normalisé s'il est renseigné,
     sinon par nom normalisé du fournisseur et du produit. Un rapprochement par nom est toujours **confirmé ou rejeté par une
     personne** ; un rejet n'est pas reproposé à données égales ;
   - **sans rapport connu** : la faille n'est pas suivie.

9. **Priorité calculée par la plateforme, pas par le modèle.** Des règles déterministes classent chaque faille suivie selon
   quatre faits : exploitation avérée (présence au catalogue KEV, alerte du CERT-FR ou du CERT Santé), présence dans
   l'organisation (détectée, à confirmer), gravité, score EPSS. Les seuils se règlent avec `vulnerabilites:administrer`. Le
   plus haut niveau est : **exploitée et détectée**. Aucun taux n'est inventé ; chaque niveau cite les faits qui le fondent.

10. **Suivi d'une faille.** Chaque faille suivie porte un état décidé par une personne : nouvelle, à traiter, en cours,
    corrigée, risque accepté, non concernée. Le traitement passe par une **action du registre existant**, liée à la faille :
    pas de second registre d'actions. Quand Tenable ne rapporte plus la faille, la plateforme **propose** de la passer
    « corrigée » ; la personne décide.

11. **Assistant RSSI** (ADR 0086), en plus et non à la place :
    - un outil de lecture rend les failles suivies **en agrégats** (V5), avec leur priorité calculée et leurs faits ;
    - une faille qui atteint le plus haut niveau déclenche une **ronde sur événement** ; l'assistant rédige l'alerte, rappelle
      le responsable du produit et peut **proposer une action**, décidée par une personne ;
    - le modèle hiérarchise et rédige ; il ne calcule ni priorité ni nombre, n'ouvre aucune page, n'écrit dans aucun registre.

    **Sans assistant, le module alerte quand même** : une notification métier (ADR 0058) part vers les personnes désignées
    quand une faille atteint le plus haut niveau. La surveillance de base ne dépend pas du modèle.

12. **Traçabilité.** Chaque collecte, chaque synchronisation et chaque décision écrit un audit `vulnerabilites.*`, sans secret.
    Chaque source affiche la date de sa dernière collecte réussie ; une source en panne est signalée.

13. **Aucune dépendance nouvelle**, ni côté API ni côté exécutant.

## Conséquences

- La plateforme gagne trois flux réseau de plus, tous fermés par défaut et portés par l'exécutant. La surface de l'API ne
  change pas.
- **Dépendance au module Intégrations** : le socle des connecteurs (lots I1 et I4 de l'ADR 0076) doit être réalisé avant les
  connecteurs Tenable et Ekialis. La veille sur les sources publiques n'en dépend pas.
- Les failles et leur présence dans l'organisation sont des informations sensibles : elles sont lues à travers les droits du
  module, et seuls des agrégats partent chez le fournisseur du modèle.
- **L'injection par le contenu reste un risque résiduel** : même venu d'une source officielle, un résumé est un texte
  extérieur. Parades : champs structurés, texte borné, aucun lien ouvert, aucune écriture sans décision humaine.
- **Limites assumées** :
  - la plateforme ne balaie aucun réseau : ce qui n'est ni scanné par Tenable ni inscrit au registre des produits n'est pas vu ;
  - le rapprochement par nom produit des faux positifs et des oublis, d'où la confirmation humaine ;
  - pas de lecture de réseaux sociaux ni de sites non listés ;
  - les sources publient avec retard ; le score EPSS est une probabilité, pas un constat ;
  - aucune écriture dans Tenable ni dans Ekialis.
- **Alternatives écartées** : veille par le modèle avec navigation web (contraire aux parades de l'ADR 0086) ; sortie réseau
  donnée à l'API (ADR 0014) ; tout porter dans le module Intégrations (droits non distincts, écarté par V1) ; transmettre le
  détail des machines au modèle (écarté par V5) ; adresses de sources réglables dans l'interface (ouvre la veille à une source
  non fiable).

## Points ouverts, à trancher par le RSSI

1. Registre des produits surveillés : au niveau de l'organisation (proposé), ou rattaché aux périmètres ?
2. Détail des machines touchées : non rangé dans la plateforme (proposé), ou rangé et visible avec un droit dédié ?
3. Qui reçoit l'alerte du plus haut niveau quand le produit n'a pas de responsable ?
4. Seuils de départ de la priorité (gravité, score EPSS).
5. Ordre des travaux par rapport à DEV-006 (socle des connecteurs).
