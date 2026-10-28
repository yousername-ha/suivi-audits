# ADR 0073 — Module Intégrations : connecteurs natifs en lecture seule, par SMSI, appels réseau par l'exécutant d'exploitation

- Statut : proposée (numéro confirmé par le RSSI le 28/10/2026)
- Date : 2026-10-28
- Contexte : le RSSI demande, le 28/10/2026, un module « Intégrations » qui crée des intégrations natives dans l'outil :
  connecteur API GLPI, import ORADAD et import Silène (ANSSI, Club SSI), d'autres à venir. Selon ce que chaque source
  permet de récupérer, les intégrations alimentent des écarts, des métriques (nombre d'incidents, d'incidents IT, de
  demandes…) et le registre des fournisseurs. Exigence explicite : **ne rien réinventer ni dupliquer** de l'existant.
  Cadrage détaillé et lots : [CADRAGE-MODULE-INTEGRATIONS](../unification/CADRAGE-MODULE-INTEGRATIONS.md).

## Décisions du RSSI (28/10/2026)

| N° | Question | Décision |
|---|---|---|
| R1 | Sens des échanges | Lecture seule : rien n'est jamais écrit dans un outil externe |
| R2 | ORADAD | Le RSSI fournit un rapport **JSON lisible** ; le connecteur est un import de fichier |
| R3 | Silène | Import de fichier **JSON** |
| R4 | Métriques | Alimentent des **indicateurs Pilotage** existants, non saisissables à la main tant qu'ils sont liés |
| R5 | Fournisseurs GLPI | Rapprochement puis **validation humaine** avant toute écriture |
| R6 | Déclenchement | Manuel **et** planifié |
| R7 | GLPI | GLPI 10 (API REST v1) et GLPI 11 (API v2) ; socle d'appels REST sortants réutilisable |
| R8 | Connecteur REST générique | Plus tard : connecteurs natifs d'abord |
| R9 | Écarts disparus d'un rapport | **Proposer la clôture**, l'utilisateur choisit |
| R10 | Droits | L'administrateur configure, le métier lance et applique ; jetons jamais réaffichés |
| R11 | Rattachement | Une instance de connecteur **par SMSI** |
| R12 | Réseau | Appels sortants **par l'exécutant d'exploitation**, jamais par l'API |
| R13 | Indicateurs et SMSI | Seul un connecteur du **périmètre commun** alimente des indicateurs (ils n'existent que là) |
| R14 | Ordre | Socle, ORADAD, Silène, puis GLPI |
| R15 | Présentation | Connecteurs en **tuiles avec le logo de l'application**, logo embarqué seulement si son droit d'usage est vérifié, sinon pictogramme neutre ; logo déposable par l'administrateur |
| R16 | Tuiles ORADAD et Silène | Les deux outils relèvent de l'ANSSI (Club SSI) : **logo de l'ANSSI** et **nom de l'application en gras** (« **ORADAD** », « **Silène** ») ; pas de logo propre à chaque outil |

## Décision

1. **Nouveau module `integrations`** (non métier, comme `import_export`), ajouté à `MODULES`
   (`packages/shared/src/permissions.ts`) avec des dépendances facultatives vers `ecarts`, `pilotage` et `fournisseurs`
   ([ADR 0019](0019-activation-modules.md)). La contrainte `module_activation_disabled_connus` est étendue par une
   **nouvelle migration**, sans réécrire les migrations 008 et 043. Actions :
   - `integrations:lire` : connecteurs, exécutions, rapports ;
   - `integrations:modifier` : lancer, simuler, appliquer, décider des propositions ;
   - `integrations:administrer` : créer et configurer un connecteur, définir ou retirer ses secrets, planifier.

   Écrire dans une cible exige **en plus** le droit de la cible et l'écriture sur le périmètre, comme l'import Tenacy :
   `ecarts:modifier` pour les écarts, `pilotage:modifier` pour les mesures, `fournisseurs:modifier` pour les fournisseurs.
   Le droit sur le module Intégrations ne contourne jamais celui de la cible.
2. **Catalogue en code, instances en base.** Chaque type de connecteur (`oradad`, `silene`, `glpi`, puis d'autres) est un
   adaptateur déclaré dans un catalogue partagé (`packages/shared`). Il fournit : mode (fichier ou appel réseau), données
   produites (écarts, mesures, fournisseurs), schéma zod de configuration, noms de ses champs secrets, et conversion vers
   des lignes normalisées. Ajouter un connecteur, c'est ajouter un adaptateur, sans toucher au socle. Une **instance**
   (table `integrations`) appartient à **un SMSI** : type, nom, configuration non secrète, état actif, planification,
   version (`If-Match`, [ADR 0004](0004-concurrence-par-enregistrement.md)).
3. **Aucun moteur d'import d'écarts en double.** Le calcul de l'import Tenacy (`apps/api/src/tenacy.ts`) est **extrait**
   en moteur commun d'écarts externes, et Tenacy en devient le premier client, **sans changement de comportement**. Les
   tests Tenacy existants servent de non-régression. Ce moteur fait déjà tout le nécessaire :
   - simulation sans écriture ;
   - empreinte sha256 recalculée à l'application (409 si les lignes ont changé) ;
   - verrou consultatif par périmètre et transaction unique ;
   - écarts `nonconformity` écrits par `Grc.insert`/`Grc.write` (versions, audit, temps réel) ;
   - idempotence par identifiant externe rangé dans `data.<source>.id` (comme `data.tenacy.id`) ;
   - écarts clos conservés ;
   - audit global de l'import.

   Seul ajout, en option du moteur : les écarts **disparus** du nouveau rapport sont listés « corrigés selon la source »,
   et l'utilisateur coche ceux à clore. La clôture passe par la fonction de clôture existante. Tenacy garde son
   comportement « conservé ».
4. **Fichiers JSON (ORADAD, Silène) : traités par l'API, sans réseau.** Le dépôt du fichier reprend
   `routes/import.ts` : corps brut, plafond `MAX_IMPORT_MB`, retrait du BOM, `JSON.parse`, validation zod, 422 détaillé.
   Des limites de lignes et de textes sont fixées comme `TENACY_LIMITES`. Le fichier n'est pas conservé : l'audit garde
   son empreinte et le rapport.

   Le schéma de chaque format est écrit **à partir d'un exemple anonymisé fourni par le RSSI**. Aucun champ n'est
   supposé, et aucune grille de l'ANSSI n'est reconstruite ou reproduite : seuls les identifiants, intitulés
   et niveaux présents dans le fichier de l'utilisateur sont repris.
5. **Appels réseau (GLPI, connecteurs API futurs) : par l'exécutant d'exploitation, sur le modèle du courriel**
   ([ADR 0049](0049-courriel-et-sortie-reseau-optionnelle.md)). L'API garde **zéro accès sortant**
   ([ADR 0014](0014-donnees-sur-le-serveur-et-mises-a-jour.md)) :
   1. l'API inscrit une exécution « en file » (table `integration_executions`) ;
   2. `exploitation-worker.py` la réclame par la CLI (`integrations-claim`, comme `mail-claim`) et lance un script dédié
      en isolement, comme `courriel-envoi.py` : `python -I`, uid 65534, environnement minimal, délai borné. Le script
      utilise uniquement la bibliothèque standard (`urllib`, `ssl`) ; le certificat est toujours vérifié (TLS 1.2 au
      minimum, autorité de certification interne collée dans l'interface comme pour le courriel). Seules des lectures
      sont émises : ouverture et fermeture de session ou obtention d'un jeton, puis requêtes de consultation. La réponse
      est bornée en taille et en nombre d'éléments ;
   3. l'exécutant rend des données **normalisées** par la CLI (`integrations-finish`), sans aucun secret dans son
      rapport ;
   4. l'API simule et rend le rapport.

   La vie de l'exécutant (`backup_worker.seen_at`) est affichée comme pour le courriel : sans exécutant, aucune
   synchronisation réseau n'est possible, et l'interface le dit. L'hôte garde la main sur le pare-feu (ADR 0049).
6. **GLPI 10 et 11.** La configuration choisit l'API :
   - **v1** (`apirest.php`, App-Token et jeton utilisateur, pagination par plage) pour GLPI 10 et 11 ;
   - **v2** (API haut niveau, OAuth2) pour GLPI 11.

   Le client GLPI de l'exécutant repose sur un **socle HTTP commun** (TLS, délais, plafonds, pagination, refus de toute
   méthode d'écriture métier), réutilisable par les connecteurs API suivants et par le futur connecteur REST générique
   (R8). Les points d'accès et numéros de champs de recherche sont vérifiés sur la documentation de l'instance de
   recette au lot GLPI, pas supposés ici.
7. **Métriques vers les indicateurs Pilotage, par le chemin existant.** Une instance du **périmètre commun** associe
   chacune de ses métriques (par exemple « tickets de type incident créés sur le mois ») à un indicateur existant
   (`IND…`). L'association est rangée dans une table de liaisons du module ; le modèle des indicateurs est inchangé.

   Chaque valeur passe par `PilotageObjectifs.ajouterValeur` : normalisation `analyserValeurIndicateur`, version de
   l'état, audit `pilotage.indicators.value-added`, notification. La note de la valeur cite l'instance et l'exécution.
   L'idempotence se fait par (instance, métrique, période) : une période déjà rapportée n'ajoute pas de seconde valeur.

   Un indicateur calculé (`calc` non vide) ne peut pas être lié. Un indicateur lié refuse la saisie manuelle, avec un
   message qui nomme l'intégration ; le lien se retire par l'administrateur. Une instance d'un autre SMSI ne propose pas
   de métriques (R13).
8. **Fournisseurs : propositions puis décision, sur le modèle des rapprochements**
   ([ADR 0031](0031-bibliotheque-de-referentiels.md), `apps/api/src/grc/rapprochements.ts`). Une table de propositions
   reprend les mêmes statuts `pending | confirmed | rejected | withdrawn` et les mêmes champs `decided_by`,
   `decided_at` et `decision_note`. La décision se prend par identifiant, en transaction avec `FOR UPDATE`, avec un
   résultat par identifiant. Un rejet n'est pas reproposé tant que les données de la source n'ont pas changé (empreinte).

   Le rapprochement se fait par la correspondance déjà enregistrée, puis par nom normalisé (`cleTexte`). La confirmation
   écrit par les services existants : `Suppliers.create` (refus du doublon de nom inchangé) ou `Suppliers.update`, limité
   aux champs que la source fournit. Le registre des fournisseurs reste sans périmètre ([ADR 0032](0032-fournisseurs-de-l-organisation.md)).
   La correspondance identifiant externe ↔ `SUP-nnn` est gardée par le module, sans ajouter de champ au fournisseur.
9. **Planification par le tic existant de l'API.** Le tic de 60 s (`server.ts`, déjà utilisé pour les séries de tâches)
   inscrit les exécutions échues. Il vérifie d'abord l'activation du module (ADR 0019) et prend un verrou par instance.
   Le créneau est consommé avant l'inscription, comme les sauvegardes : pas de rejeu après panne. L'exécutant ne fait que
   réclamer la file.

   À l'exécution planifiée, les **mesures** sont appliquées automatiquement, sous l'acteur `planification`, comme les
   sauvegardes planifiées. Les **fournisseurs** et les **écarts** restent soumis à décision humaine.
10. **Secrets en écriture seule**, sur le modèle de `secret:courriel` (ADR 0049) et `secret:poivre`
    ([ADR 0072](0072-poivre-des-mots-de-passe.md)) :
    - chaque secret est scellé par le coffre (`Vault.sealSmall`, AAD `integration:<id>:<champ>`) dans une ligne
      `settings` `secret:integration:<id>` ;
    - il n'est jamais relu par l'interface, ni renvoyé, ni écrit au journal ;
    - il est ouvert uniquement pour être remis à l'exécutant au moment de la réclamation.

    Les noms des champs secrets (`appToken`, `userToken`, `clientSecret`, `accessToken`, `sessionToken`…) sont ajoutés
    au masquage `REDACT` de `log.ts`. Les données reçues d'une source, dans l'attente d'une décision, sont chiffrées par
    le coffre (`vault.encrypt`, comme `import_batches`) et purgées après application ou expiration.
11. **Journal et traçabilité.** La table des exécutions est le journal du module : origine (manuel ou planifié), auteur,
    état (`en_file`, `en_cours`, `recu`, `applique`, `echec`, `expire`), dates, totaux, erreur nettoyée. Chaque étape
    écrit un audit `integration.*` sans secret. Chaque objet modifié garde l'audit et la version de son propre service.
12. **Interface en tuiles.** Une rubrique « Intégrations » du Pilotage (module `integrations`, action `lire`) regroupe
    connecteurs, exécutions et propositions. Elle respecte la charte et les composants de `packages/ui`, sous la CSP
    stricte ([ADR 0006](0006-front-react-mantine-csp-stricte.md)) ; le tableau de rapport reprend l'écran Tenacy.
    - **Catalogue en tuiles** : une tuile par type de connecteur et par instance, avec le logo de l'application, son
      nom, ce qu'elle alimente (écarts, mesures, fournisseurs), son état (non configurée, active, en échec) et la date
      de la dernière exécution. Les tuiles reprennent les dalles et les jetons de couleur du tableau de bord
      ([ADR 0069](0069-tableau-de-bord-verre-et-relief.md)), sans valeur codée en dur.
    - **Logos** : un logo est une marque. Il n'est embarqué dans le dépôt, en fichier SVG ou PNG local relu, que si son droit
      d'usage est vérifié ou, sans autorisation écrite, si le RSSI retient un usage d'identification seulement ;
      dans les deux cas, la décision est consignée (organisme, source, empreinte, date, conditions) dans le cadrage puis
      le registre des sources. Le logo de
      l'ANSSI suit la charte graphique de l'État ; il sert aux deux tuiles ORADAD et Silène (R16), un seul fichier
      pour les deux, chaque tuile affichant en plus le nom de l'application en gras. Sans droit vérifié, la tuile montre un **pictogramme neutre** de
      `packages/ui` et le nom de l'application.
    - **Logo déposé par l'administrateur**, pour son instance (`integrations:administrer`) : PNG ou WebP seulement
      (pas de SVG, qui peut porter du script), taille bornée, contrôle antivirus et stockage par le circuit de fichiers
      existant. Il est servi par l'application elle-même : aucun chargement externe, conformément à la CSP.
13. **Aucune nouvelle dépendance**, ni côté API (TypeScript existant) ni côté exécutant (Python standard).

## Conséquences

- L'outil devient capable de lire des systèmes tiers **sans ouvrir l'API au réseau** : la surface SSRF de l'API reste
  nulle. En contrepartie, une synchronisation réseau dépend de l'exécutant d'exploitation, de son réseau et du pare-feu
  de l'hôte.
- Les écarts créés dans le **périmètre commun** entrent dans la projection `state.findings` et peuvent changer les
  indicateurs calculés (`interneNcMaj`, `interneNcMajOpen`…). C'est cohérent (ce sont de vrais écarts), mais à vérifier
  à la recette du lot ORADAD.
- Ajouter un module touche la liste fermée des modules, les rôles système (`rssi` reçoit tout sauf l'administration) et
  la contrainte SQL : une migration additive, testée sur base vierge et sur base existante.
- L'extraction du moteur Tenacy est un refactor à risque maîtrisé : il ne passe qu'avec les tests Tenacy existants
  inchangés.
- **Limites assumées** :
  - lecture seule (aucun ticket GLPI créé) ;
  - pas de connecteur REST générique avant un lot dédié ;
  - les indicateurs restent propres au périmètre commun ;
  - les formats ORADAD et Silène dépendent d'exemples fournis : sans exemple, pas de lot.
- **Alternatives écartées** :
  - ouvrir la sortie réseau de l'API (contraire aux ADR 0014 et 0049, protections SSRF à construire) ;
  - un tableau de métriques propre au module (doublon du Pilotage) ;
  - un champ « identifiant GLPI » dans le fournisseur (modèle de chaque fournisseur alourdi pour une seule source) ;
  - un second moteur d'import d'écarts à côté de celui de Tenacy.
