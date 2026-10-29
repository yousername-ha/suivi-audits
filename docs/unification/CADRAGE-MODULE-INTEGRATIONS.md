# Cadrage — module Intégrations (GLPI, ORADAD, Silène et connecteurs à venir)

**Statut** : cadrage du 28/10/2026, à la demande du RSSI, avec ses décisions (R1 à R16 de
l'[ADR 0076](../adr/0076-module-integrations.md), proposée). Aucun code, aucune migration. Les lots (§4) démarrent un par
un après validation de ce plan.

## 1. Besoin

Créer dans l'outil des intégrations natives qui lisent des sources externes et alimentent, selon ce que chaque source
permet de récupérer :

- des **écarts** (non-conformités du SMSI visé) ;
- des **métriques**, sous forme de mesures d'indicateurs Pilotage (par exemple nombre d'incidents, d'incidents IT, de
  demandes sur GLPI) ;
- le **registre des fournisseurs** (liste des fournisseurs GLPI).

Premières sources : GLPI (API), ORADAD (rapport JSON) et Silène (JSON), outils de l'ANSSI (Club SSI). D'autres suivront.
Lecture seule. Règle du RSSI : **rien de réinventé ni de dupliqué**.

## 2. Ce qui est réutilisé et ce qui est nouveau

| Besoin | Réutilise (existant) | Nouveau (strict nécessaire) |
|---|---|---|
| Écarts importés, idempotents, simulés puis appliqués | Moteur de l'import Tenacy (`apps/api/src/tenacy.ts`), **extrait** en moteur commun ; `Grc.insert`/`Grc.write`, fonction de clôture, audit, temps réel | Option « disparus → clôture proposée » |
| Dépôt d'un fichier JSON | `routes/import.ts` (`readUpload`, `MAX_IMPORT_MB`, BOM, zod, 422) | Adaptateurs `oradad` et `silene` (schéma tiré des exemples) |
| Mesures d'indicateurs | `PilotageObjectifs.ajouterValeur`, `analyserValeurIndicateur`, version de l'état, audit `pilotage.indicators.value-added` | Table de liaisons métrique ↔ indicateur ; refus de saisie manuelle d'un indicateur lié |
| Fournisseurs | `Suppliers.create`/`update` (doublon de nom refusé), cycle de vie des rapprochements (`pending/confirmed/rejected/withdrawn`, `decide()`) | Table de propositions et de correspondances identifiant externe ↔ `SUP-nnn` |
| Appel réseau | Modèle du courriel : file en base, `exploitation-worker.py`, CLI `*-claim`/`*-finish`, script isolé (`python -I`, uid 65534), TLS vérifié avec autorité de certification fournie, signal de vie `backup_worker` | Script `integration-glpi.py` et socle HTTP commun de l'exécutant ; commandes CLI `integrations-claim`/`integrations-finish` |
| Planification | Tic de 60 s de l'API (`server.ts`), créneau consommé avant la demande, acteur `planification` | Échéancier par instance |
| Secrets | `Vault.sealSmall`, ligne `settings` `secret:…` en écriture seule (courriel, poivre), masquage `REDACT` | Ligne `secret:integration:<id>` ; nouveaux noms masqués |
| Données reçues en attente | `vault.encrypt` (comme `import_batches`) | Purge après application ou expiration |
| Module, droits, menu | `MODULES`, `MODULE_REGISTRY`, `route()` (garde, CSRF, activation), rubriques du Pilotage | Module `integrations` et migration de la contrainte des modules |
| Interface | Écran de rapport Tenacy, dalles et jetons du tableau de bord (ADR 0069), `packages/ui`, CSP stricte, circuit de fichiers avec antivirus | Rubrique « Intégrations » en **tuiles avec logo** (connecteurs, exécutions, propositions) ; ORADAD et Silène : logo de l'ANSSI et nom en gras ; logo déposable par l'administrateur |

## 3. Parcours cibles

- **Import de fichier (ORADAD, Silène)** :
  1. dépôt du JSON sur une instance du SMSI ;
  2. simulation : créés, mis à jour, inchangés, conservés (clos), **corrigés selon la source** ;
  3. choix des écarts à clore ;
  4. application, avec contrôle de l'empreinte.
- **Synchronisation GLPI** :
  1. « Synchroniser » ou échéance planifiée : exécution en file ;
  2. l'exécutant interroge GLPI et rend des données normalisées ;
  3. rapport : mesures par indicateur lié, fournisseurs proposés ou rapprochés ;
  4. les mesures sont appliquées (automatiquement si l'exécution est planifiée) ;
  5. les fournisseurs attendent une décision par proposition.
- **Configuration (administrateur)** : créer une instance, choisir l'API GLPI (v1 ou v2), saisir l'URL et l'autorité de
  certification, définir les secrets (jamais réaffichés), lier les métriques aux indicateurs (périmètre commun),
  planifier.

## 4. Lots proposés (sans calendrier ; estimations non établies)

| Lot | Contenu | Acceptation |
|---|---|---|
| I0 | ADR 0076 et ce cadrage | Relus et validés par le RSSI |
| I1 | **Socle.** Module `integrations` et migration additive : contrainte des modules, tables `integrations`, `integration_executions`, `integration_correspondances`, `integration_propositions`, `integration_liaisons`. Catalogue partagé des connecteurs. Routes de configuration et secrets. **Extraction du moteur d'écarts de Tenacy.** Rubrique « Intégrations » en tuiles avec logo ou pictogramme neutre, configuration, dépôt du logo par l'administrateur | Tests Tenacy inchangés et verts. Tuiles vérifiées par captures (clair, sombre, 390 à 1440 px) ; logo déposé refusé s'il est SVG ou trop lourd. Droits : refus sans le droit de la cible, sans écriture sur le périmètre, module désactivé. Secret jamais relu ni journalisé. Migration testée sur base vierge et sur base existante |
| I2 | **ORADAD.** Adaptateur JSON, simulation et application, disparus proposés à la clôture | Fixture anonymisée tirée de l'exemple fourni. Second import identique sans effet. Clôture seulement des écarts cochés. Effet sur les indicateurs calculés vérifié |
| I3 | **Silène.** Adaptateur JSON (écarts, et métriques si le format en porte) | Mêmes critères qu'I2 |
| I4 | **Exécutant et GLPI, métriques.** File, CLI, script isolé, socle HTTP de l'exécutant, API v1 et v2, liaisons métrique ↔ indicateur | Lectures seules prouvées par test (aucune méthode d'écriture métier émise). TLS vérifié, délais et plafonds. Idempotence par période. Indicateur lié non saisissable. Rapport sans secret |
| I5 | **GLPI, fournisseurs.** Propositions, rapprochement (correspondance puis nom), décision | Création et mise à jour seulement après confirmation. Rejet non reproposé à données égales. Doublon de nom refusé comme aujourd'hui |
| I6 | **Planification.** Échéancier par instance sur le tic de l'API, application automatique des seules mesures | Pas de rejeu après panne. Module désactivé : rien n'est inscrit. Acteur `planification` audité |
| I7 | Connecteur REST générique (R8) | Lot à cadrer plus tard, sur le socle HTTP d'I4 |

Chaque lot livre le code, la migration additive éventuelle, les droits serveur, les tests (unitaires, API sur
PostgreSQL, Playwright pour les parcours) et la documentation (inventaire, recette, backlog). Une PR par lot vers
`claude-suivi-smsi`.

## 5. Ce qu'il faut du RSSI

- **I2** : un **exemple de rapport ORADAD JSON anonymisé** (aucun nom de domaine, compte ou serveur réel). Le dépôt est
  public.
- **I3** : un **exemple de JSON Silène anonymisé**, et ce qu'il contient (écarts, scores, métriques).
- **I4** : la **liste exacte des métriques GLPI** voulues : type de ticket, catégories qui font un « incident IT »,
  entités, statuts, période (mois, semaine), date de référence (ouverture ou résolution). Il faut aussi une instance
  GLPI 10 ou 11 **de recette** joignable par l'exécutant, avec un compte en lecture seule.
- **I5** : les champs du fournisseur GLPI à reprendre (nom, contact…) parmi ceux du registre.
- **Logos (I1)** : pour chaque logo à embarquer, le fichier et la preuve du droit d'usage (éditeur de GLPI ;
  ANSSI selon la charte de l'État, un seul logo pour les tuiles ORADAD et Silène). Sans cette preuve, la tuile montre un
  pictogramme neutre, toujours avec le nom de l'application en gras.

## 5 bis. Sources des logos

| Tuile | Fichier | Source | Licence et conditions | État |
|---|---|---|---|---|
| GLPI | `glpi.svg` (1 903 octets, SHA-256 `6d92bb891522dcd0ab74787991645d536c30cf374a5c627e442b6acbcb20c14d`) | Collection *dashboard-icons* de homarr-labs, fournie par le RSSI le 28/10/2026 : `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/glpi.svg` | Collection sous Apache-2.0. Selon son avertissement, les marques restent à leurs propriétaires et les icônes servent **à identifier le produit seulement**, sans laisser croire à un partenariat. C'est l'usage prévu : désigner le connecteur GLPI | Retenu pour I1. Contrôlé le 28/10/2026 : SVG simple, sans script, sans lien, sans ressource externe. Embarqué en fichier local, jamais chargé depuis le CDN (CSP) |
| ORADAD, Silène | `anssi.png` : emblème rond de l'ANSSI, PNG 256 × 256 (44 284 octets, SHA-256 `cfa618e20d61f08e2b68a0813bbe72618edb41a434884897ab3d7edaedd5490d`) | Désignée par le RSSI le 28/10/2026 : compte GitHub `ANSSI-FR` qui publie ORADAD (https://github.com/ANSSI-FR/ORADAD). Le dépôt ORADAD ne contient aucune image ; le fichier est l'avatar de ce compte : `https://avatars.githubusercontent.com/ANSSI-FR?size=256` | La licence GPL-3.0 d'ORADAD couvre le code, **pas l'emblème**. L'emblème appartient à l'ANSSI et relève de la charte graphique de l'État. Aucune autorisation écrite : le RSSI retient un usage **d'identification seulement** (désigner les outils de l'ANSSI), sans laisser croire à un partenariat ni à une homologation | Retenu pour I1, un seul fichier pour les deux tuiles, avec le nom de l'application en gras. Contrôlé le 28/10/2026 : PNG valide. Embarqué en fichier local, jamais chargé depuis GitHub (CSP). À retirer si l'ANSSI le demande |

## 6. Ce que ce cadrage n'établit pas

- Les formats ORADAD et Silène : aucun champ n'est supposé avant réception des exemples.
- Les points d'accès exacts et les numéros de champs de recherche de GLPI : ils sont vérifiés sur l'instance de recette
  au lot I4.
- La joignabilité réseau de GLPI depuis l'exécutant : elle dépend de l'hôte et de son pare-feu.
- Aucune écriture vers un outil externe, aucun indicateur par SMSI, aucun connecteur générique dans ces lots.
