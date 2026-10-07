# 6. Proposition d’implémentation React Flow

## 6.1 Arborescence front indicative

```text
src/
  modules/map-builder/
    MapBuilderPage.tsx
    components/
      MapCanvas.tsx
      TopToolbar.tsx
      LeftPanel.tsx
      InspectorPanel.tsx
      GenerationWizard.tsx
      ObjectPicker.tsx
      nodes/
        ProcessNode.tsx
        StakeholderNode.tsx
        IssueNode.tsx
        AssetNode.tsx
        ScopeNode.tsx
      edges/
        PrimaryEdge.tsx
        DependencyEdge.tsx
        IssueEdge.tsx
    hooks/
      useMap.ts
      useMapHistory.ts
      useMapSync.ts
      useAutoLayout.ts
    services/
      mapApi.ts
      platformApi.ts
    state/
      mapStore.ts
    types/
      map.types.ts
```

## 6.2 Mapping React Flow

Chaque instance graphique devient un `Node` React Flow.

Exemple conceptuel :

```ts
const node = {
  id: `process:${process.id}`,
  type: 'process',
  position: { x: 800, y: 320 },
  data: {
    objectRef: process.id,
    label: process.name,
    code: process.code,
    standards: process.standards,
    inScope: process.scopeMembership === 'in'
  }
}
```

## 6.3 Node de périmètre

Deux approches possibles :

1. Group node React Flow avec enfants.
2. Overlay dédié calculé à partir des positions des nodes `inScope`.

Pour la stabilité UX, le group node explicite est recommandé si l’utilisateur doit redimensionner manuellement le périmètre.

## 6.4 Création d’un lien

Workflow :

1. l’utilisateur passe en mode `Créer un lien` ;
2. sélection source ;
3. sélection cible ;
4. popup de choix du type de relation ;
5. sauvegarde relation métier ou graphique selon le type.

Il faut distinguer :

- relation métier persistée dans la plateforme ;
- relation de présentation propre à la carte.

## 6.5 Historique local

Le front doit maintenir une pile :

- ajout ;
- retrait ;
- mouvement ;
- resize ;
- edge ;
- visibilité ;
- groupes.

`Ctrl+Z` / `Ctrl+Shift+Z` ou équivalent.

## 6.6 Auto-layout avec ELK

Entrées :

- nodes ;
- edges ;
- dimensions ;
- preset ;
- contraintes de groupes.

Sortie : positions.

Appliquer les nouvelles positions seulement :

- à la génération initiale ;
- sur demande utilisateur ;
- après ajout massif si l’utilisateur accepte.

## 6.7 Mode lecture / édition

Le même composant est utilisé.

`readOnly = true` désactive :

- drag ;
- resize ;
- connect ;
- suppression ;
- raccourcis d’édition.

## 6.8 Recherche

La recherche doit pouvoir trouver :

- code ;
- nom ;
- alias ;
- type ;
- référentiel ;
- propriétaire.

Résultat : zoom/focus sur le node s’il est déjà visible, sinon proposer de l’ajouter.
