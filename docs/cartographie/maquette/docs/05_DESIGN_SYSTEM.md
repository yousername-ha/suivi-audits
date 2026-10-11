# 5. Design system du Map Builder

## 5.1 Direction visuelle

Référence principale : `images/01_reference_vue_contexte_preferee.jpeg`.

Caractéristiques :

- fond blanc / gris très clair ;
- bleu nuit pour la navigation et le centre SMSI ;
- bleu clair pour les éléments internes ;
- violet doux pour les parties intéressées externes ;
- orange discret pour les enjeux ;
- vert réservé aux états positifs / `In scope` ;
- rouge réservé aux alertes, écarts ou criticités ;
- coins arrondis ;
- ombres très légères ;
- lignes fines ;
- beaucoup d’espace blanc.

## 5.2 Couleurs indicatives

Les valeurs sont des tokens de départ, à aligner ensuite avec la charte réelle de la plateforme.

```json
{
  "navy": "#0B2B55",
  "blue": "#1677FF",
  "blueSoft": "#EAF3FF",
  "purple": "#7A4CE0",
  "purpleSoft": "#F3EEFF",
  "orange": "#E98A15",
  "orangeSoft": "#FFF5E8",
  "green": "#20A05A",
  "greenSoft": "#EAF8F0",
  "red": "#D84949",
  "redSoft": "#FDEEEE",
  "surface": "#FFFFFF",
  "surfaceAlt": "#F7F9FC",
  "border": "#DDE5EF",
  "text": "#102445",
  "textMuted": "#66758F"
}
```

## 5.3 Typographie

Utiliser la police du design system principal de la plateforme. À défaut : sans-serif moderne.

Échelle indicative :

- titre écran : 24–28 px ;
- titre section : 18–20 px ;
- titre node : 13–15 px ;
- texte node : 11–13 px ;
- badge : 10–12 px.

## 5.4 Node de base

Structure :

```text
[icône] CODE / TYPE
Titre
Description courte
[tag] [tag]
```

États :

- normal ;
- hover ;
- selected ;
- muted ;
- warning ;
- error ;
- unavailable.

## 5.5 Edge

- principal : trait bleu plein ;
- dépendance : trait bleu pointillé ;
- relation secondaire : gris pointillé ;
- enjeu : orange pointillé ;
- sélection : accent plus marqué.

Éviter d’afficher toutes les relations en permanence.

## 5.6 Bascule de vue

Composant segmenté :

```text
[ Vue contexte ] [ Vue processus ]
```

Un seul état actif.

## 5.7 Panneau de droite

Largeur fixe ou redimensionnable.

Sections :

- identité ;
- métadonnées ;
- relations ;
- référentiels ;
- exigences ;
- risques ;
- KPI ;
- activité récente.

Les blocs inutiles pour un type d’objet sont masqués.
