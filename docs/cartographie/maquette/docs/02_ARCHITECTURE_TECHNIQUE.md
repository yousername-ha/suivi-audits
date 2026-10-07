# 2. Architecture technique recommandée

## 2.1 Vue d’ensemble

```text
React / TypeScript
      |
      +-- MapShell
      +-- MapCanvas
      +-- NodeRenderer
      +-- EdgeRenderer
      +-- ScopeBoundary
      +-- FilterPanel
      +-- ObjectLibrary
      +-- InspectorPanel
      +-- GenerationWizard
      +-- HistoryToolbar
      |
      v
Map API / BFF
      |
      +-------------------+
      |                   |
      v                   v
Platform API          Map Persistence
(données métier)      (présentation)
```

## 2.2 Front-end

Recommandation :

- React ;
- TypeScript ;
- React Flow pour le canvas ;
- ELK.js pour l’auto-layout ;
- gestion d’état via le standard déjà utilisé par la plateforme ;
- design system partagé avec la plateforme.

## 2.3 Composants principaux

### `MapShell`

Gère :

- barre supérieure ;
- panneaux latéraux ;
- bascule de vue ;
- permissions ;
- chargement / sauvegarde.

### `MapCanvas`

Gère :

- nodes ;
- edges ;
- zoom ;
- pan ;
- sélection ;
- drag & drop ;
- raccourcis clavier ;
- minimap ;
- grille optionnelle.

### `NodeRenderer`

Rendu par type :

- process ;
- stakeholder ;
- issue ;
- application ;
- infrastructure ;
- site ;
- supplier ;
- requirement ;
- risk ;
- generic.

### `ScopeBoundary`

Node de groupe spécial avec :

- bordure pointillée ;
- titre ;
- badge de référentiel ;
- détection enfant ;
- règles de redimensionnement.

### `InspectorPanel`

Affichage/édition contextuelle selon le type de node.

### `GenerationWizard`

Collecte les critères de génération puis appelle le moteur de génération.

## 2.4 Backend / BFF

Le BFF agrège :

- objets métier ;
- relations métier ;
- métadonnées de périmètre ;
- données de cartographie ;
- permissions ;
- versions.

Il peut exposer une structure déjà normalisée au front pour éviter que le front connaisse le schéma de toutes les briques métier.

## 2.5 Persistance

Séparer au minimum :

### `map_definition`

- id
- name
- view_type
- organization_id
- scope_id
- created_by
- created_at
- updated_at
- current_version

### `map_node_instance`

- map_id
- object_ref
- object_type
- x
- y
- width
- height
- hidden
- collapsed
- group_id
- presentation_overrides

### `map_edge_instance`

- map_id
- relation_ref ou relation locale
- source_ref
- target_ref
- edge_type
- hidden
- presentation_overrides

### `map_version`

- map_id
- version_number
- snapshot
- author
- comment
- created_at

## 2.6 API indicative

```text
GET    /maps/:mapId
POST   /maps
PATCH  /maps/:mapId
POST   /maps/:mapId/save
GET    /maps/:mapId/versions
POST   /maps/:mapId/versions/:version/restore

GET    /platform-objects?type=&search=&scope=
GET    /platform-objects/:id/relations
POST   /maps/:mapId/import
POST   /maps/:mapId/generate
POST   /maps/:mapId/auto-layout
POST   /maps/:mapId/export
```

## 2.7 Sécurité et habilitations

Prévoir des droits distincts :

- voir une carte ;
- éditer la présentation ;
- créer une carte ;
- importer des objets ;
- modifier les propriétés métier depuis l’inspecteur ;
- publier une version ;
- exporter ;
- restaurer une version.

Ne pas déduire qu’un droit d’édition graphique autorise la modification des données métier.

## 2.8 Performance

Prévoir :

- chargement lazy des détails ;
- limitation configurable du nombre de nodes ;
- profondeur de relations ;
- clustering / collapse de groupes ;
- virtualization si le graphe devient très grand ;
- cache des données métier ;
- auto-layout côté worker si nécessaire.
