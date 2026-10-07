# 3. Modèle de données

## 3.1 Principe

Un objet métier et son instance graphique sont deux objets distincts.

### Objet métier

```json
{
  "id": "PR04",
  "type": "process",
  "category": "realisation",
  "name": "Processus de réalisation 04",
  "scope": true,
  "standards": ["ISO27001", "HDS", "ISO9001"]
}
```

### Instance graphique

```json
{
  "mapId": "map-smsi-main",
  "objectRef": "PR04",
  "x": 810,
  "y": 360,
  "width": 260,
  "height": 120,
  "hidden": false,
  "collapsed": false
}
```

## 3.2 Types d’objets recommandés

- `isms` : centre SMSI / organisation
- `scope` : frontière de périmètre
- `process`
- `subprocess`
- `stakeholder`
- `internal_issue`
- `external_issue`
- `application`
- `infrastructure`
- `site`
- `supplier`
- `requirement`
- `risk`
- `document`
- `generic`

## 3.3 Relations

Exemples :

- `contains`
- `depends_on`
- `supports`
- `flows_to`
- `interacts_with`
- `owned_by`
- `applies_to`
- `mitigates`
- `impacts`
- `requires`
- `hosted_by`
- `located_at`
- `related_to`

## 3.4 Exemple de relation

```json
{
  "id": "REL-001",
  "source": "PS01",
  "target": "PR04",
  "type": "supports",
  "direction": "outbound"
}
```

## 3.5 Données métier vs présentation

| Domaine | Source de vérité |
|---|---|
| Nom | Plateforme |
| Code | Plateforme |
| Type | Plateforme |
| Responsable | Plateforme |
| Référentiels | Plateforme |
| Risques liés | Plateforme |
| Exigences liées | Plateforme |
| Relations métier | Plateforme |
| Position x/y | Cartographie |
| Taille | Cartographie |
| Objet visible/masqué | Cartographie |
| Groupe graphique | Cartographie |
| Libellé court personnalisé | Cartographie, si autorisé |
| Couleur de rendu | Configuration / cartographie |

## 3.6 Gestion du périmètre

Ne pas confondre :

- `scopeMembership` : donnée métier indiquant si l’objet appartient au périmètre ;
- `insideBoundary` : position graphique dans le cadre.

La cohérence peut être contrôlée, mais l’un ne doit pas être dérivé aveuglément de l’autre.

## 3.7 Référentiels

Stocker les référentiels comme des identifiants :

```json
[
  {"id": "ISO27001", "label": "ISO 27001"},
  {"id": "HDS", "label": "HDS"},
  {"id": "ISO9001", "label": "ISO 9001"}
]
```

Les règles d’affichage et filtres se basent sur ces identifiants.
