# ADR 0013 — Cartographie du SMSI

**Statut** : acceptée (chantier « Cartographie », exigences `CARTO-01` à `CARTO-14`).
Spécification : [`docs/cartographie/SPEC-CARTOGRAPHIE-V3.md`](../cartographie/SPEC-CARTOGRAPHIE-V3.md) (elle l'emporte sur la
maquette) ; recette : [`RECETTE.md`](../cartographie/RECETTE.md) ; référence de comportement : le module bêta de l'outil
historique validé le 08/10/2026 ([`reference-beta-legacy/`](../cartographie/reference-beta-legacy/)).

## Contexte
Le RSSI veut deux cartes du SMSI tenues à jour par les données de la plateforme, pas des images : la **vue contexte**
(SMSI, périmètre, parties intéressées, fournisseurs, enjeux, SI) et la **vue processus** (pilotage, réalisation,
support, sous-processus, flux). Le module bêta de l'outil historique a validé le comportement (génération, édition,
synchronisation, versions, exports) avec un moteur SVG écrit à la main. Les modules sources (processus, parties
intéressées, SWOT, périmètre, GAP, fournisseurs) ne sont pas encore repris : leurs données sont dans l'état legacy.

## Décision

### 1. Séparation données métier / présentation
- Les **objets métier** (nom, code, type, famille, responsable, référentiels, périmètre, relations métier) sont relus
  dans la plateforme à chaque affichage ; la **carte** ne stocke que la présentation : positions et tailles, cadres,
  relations graphiques, relations métier masquées, objets ignorés, et le dernier libellé connu de chaque objet.
- Un renommage dans la plateforme apparaît sans déplacer la boîte ; un objet disparu reste affiché « Objet
  indisponible » (dernier libellé) jusqu'à la décision de l'utilisateur ; **aucun ajout ni déplacement automatique**.

### 2. Moteur de rendu : SVG en React, sans nouvelle dépendance
- Pas de React Flow ni d'ELK : la bêta prouve qu'un moteur SVG maison suffit (dispositions déterministes, 400 nœuds),
  et le dépôt n'ajoute pas de dépendance sans nécessité forte (ADR 0009). Redessin limité par `requestAnimationFrame`
  pendant les glisser-déposer.
- Sous CSP stricte : aucun attribut `style` (même dans le SVG) ; couleurs par classes et jetons « carte » de
  `packages/ui` (clair et sombre, contrastes AA vérifiés).
- Exports **dans le navigateur** : SVG (vectoriel), PNG (×2, plafonné à 36 Mpx), PDF A3 paysage écrit sans
  bibliothèque (image JPEG dans un PDF minimal, comme la bêta), JSON (disposition). Le passage au moteur d'export
  serveur de la phase 3 reste possible sans changer le modèle.

### 3. Algorithmes partagés et purs (`packages/shared/src/carto/`)
- Objets et relations dérivées, dispositions (contexte, processus), génération assistée, propositions de flux,
  synchronisation (nouveaux, indisponibles), placement sans chevauchement, ancrages et tracés des liens, calcul de la
  scène (filtres, préréglages, recherche) : **fonctions pures**, portées de `carto.js` à l'identique. Des tests Vitest
  exécutent le code de la bêta dans un bac à sable et comparent les sorties (mêmes positions pour les mêmes données).
- Le serveur construit les objets (adaptateur) ; le navigateur exécute dispositions, génération et rendu.

### 4. Source des objets : adaptateur (`CartoObjectSource`)
- Interface unique côté API (`apps/api/src/carto/sources/`) : `list(contexte de droits)` → objets normalisés,
  relations dérivées par la fonction partagée.
- Implémentation actuelle : **état legacy recomposé** (`LegacyStore.recompose`), filtré par `redactLegacy` selon les
  droits de la personne : un objet d'un module non lisible n'est **jamais envoyé** au navigateur ; celui-ci affiche
  « Objet non accessible » d'après le préfixe de la référence (module d'origine connu de `packages/shared`).
- Quand un module sera repris (ADR 0007), sa source passera sur les tables **sans changer le front ni les cartes**.
- Références (`objectRef`) : `process:<code>`, `pi:<id>`, `sup:<id>`, `app:<id>`, `issue:<hash>`, `site:<hash>`,
  `infra:<hash>`, `isms`, `scope` ; cadres propres à la carte : `lane:pil|rea|sup|oth`, `band:ext|int`, `zone:out`.
  Enjeux, sites et systèmes n'ont pas d'identifiant stable au schéma 15 : hachage du libellé (fonction partagée,
  identique à la bêta, testée en parité).
- La fiche détaillée reçoit des champs **choisis un par un** par l'adaptateur (pas d'objet legacy brut).

### 5. Stockage
- Migration `005_cartographie.sql` : tables `maps` (`view`, `name`, `layout` jsonb, `settings` jsonb, `version`,
  traçabilité, `legacy_id`, `import_batch_id`, `extra`) et `map_versions` (20 au plus par carte, la plus ancienne
  supprimée) ; déclencheurs de notification (temps réel). Validation zod `MapLayoutSchema` : au plus 400 nœuds,
  coordonnées finies, tailles de 40 à 200 000 (une bande de 400 processus générée dépasse 100 000 px : la borne de
  6 000 de la spécification est relevée), types de relation connus, relations entre nœuds existants.
- **Reprise immédiate des cartes de la bêta** : la migration recopie `app_state.data.maps` (s'il existe) dans ces
  tables ; la clé reste dans `app_state` jusqu'au prochain enregistrement (l'empreinte de l'état n'est pas recalculée
  en SQL), mais l'état servi est recomposé depuis les tables. Un `ModuleMapper` « maps » est enregistré (ADR 0007). L'import legacy
  écrit donc `S.maps` dans les tables, l'export le reconstruit, et `/legacy` affiche la cartographie en lecture
  seule (écritures refusées par 409, comme tout module repris).
- Une carte par vue au départ ; le modèle permet plusieurs cartes par vue.

### 6. API, concurrence, temps réel, journal
- Routes `/api/carto/*` déclarées par `route()` avec leur permission `cartographie:*` ; `PUT` avec `If-Match`
  obligatoire (ADR 0004) ; 412 avec l'auteur et la date de la version en base ; « Écraser » = nouvelle requête avec la
  version courante, journalisée (`carto.map_overwrite`).
- Événement SSE `maps` (identifiant, version, auteur) filtré par `cartographie:lire` ; présence « modifie la carte »
  (ADR 0005). Les changements d'objets métier émettent déjà `legacy_state` : le navigateur recharge les objets.
- Journal d'audit : création, enregistrement, écrasement, version figée, restauration, suppression, nature d'un enjeu,
  export.

### 7. Droits (`CARTO-01`)
- Nouveau module métier `cartographie` (5 actions). Rôles prédéfinis : Administrateur et RSSI tout ; Contributeur
  lire, modifier et exporter ; Lecteur lire et exporter ; Auditeur externe lire si le module lui est ouvert.
- Lecture seule réelle : sans `cartographie:modifier`, aucune poignée ni bouton d'édition, et le serveur refuse toute
  écriture (403), vérifié par la matrice rôles × routes.

### 8. Points à arbitrer : choix par défaut (spécification § 6)
1. Relations entre processus : **graphiques** (propositions `gen` à valider), pas de table métier.
2. Appartenance au périmètre : modifiée par l'**écran Périmètre**, jamais par la carte.
3. Nature des enjeux : `maps.settings.issueKind` (carte de contexte) jusqu'à la reprise des enjeux (phase 3).
4. Versions : **explicites** seulement, figées à partir de la carte enregistrée ; l'historique fin est dans le journal d'audit.
5. Export PDF : **support visuel**, pas une preuve documentaire.
6. **Une carte par vue** ; le modèle en accepte plusieurs (par site, par offre CRRC) plus tard.
7. Filtres : **ISO 27001 et HDS** (pas d'ISO 9001).

## Conséquences
- Aucune nouvelle dépendance npm.
- Les modules repris plus tard fourniront leur propre source d'objets ; les cartes existantes restent valides tant
  que les références sont stables (identifiants du schéma 15, hachage pour les libellés).
- Les écarts volontaires avec la bêta sont listés dans `docs/legacy/MAPPING-LEGACY.md` (section « maps ») : pas
  d'attribut `style`, couleurs par jetons, objets construits par le serveur selon les droits, identifiants de relation
  générés par le serveur ou le navigateur sans `Math.random` dans les fonctions partagées.
