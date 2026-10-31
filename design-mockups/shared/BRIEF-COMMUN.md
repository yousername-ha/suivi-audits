# Brief commun aux maquettes (A à F)

Ce document fixe ce que toutes les maquettes partagent, pour que la page comparative `design-mockups/index.html`
puisse les charger et basculer de l'une à l'autre sur le même écran.

## Structure d'un dossier de maquette

```
X-nom/
  index.html      page unique, routage par ancre (#/…), charge ../shared/fake-data.js
  tokens.css      design tokens (variables CSS uniquement, pas de règles)
  styles.css      styles de la maquette (peut être découpé, mais tout reste dans le dossier)
  app.js          rendu des écrans, graphiques SVG, interactions (JS natif, sans module ES, sans CDN)
  README.md       intention, palette, typo, animations, points forts/limites, écarts d'accessibilité
```

Pas de build, pas de dépendance. La page doit fonctionner ouverte en `file://` **et** servie par `npx serve`
(donc : pas de `type="module"`, pas de `fetch` de fichiers locaux, chemins relatifs `../shared/fake-data.js`).

## Routes (ancre), identiques pour toutes

| Ancre | Écran |
| --- | --- |
| `#/dashboard` (défaut) | Dashboard de pilotage SMSI |
| `#/audits` | Liste des audits (filtres, tri, recherche, badges, pagination) |
| `#/audit/AUD-07` | Fiche détail d'un audit (onglets : Synthèse, Constats, Plan d'actions, Historique) |
| `#/formulaire` | Formulaire de création/édition d'un audit (validation, erreur, succès) |
| `#/retex` | RETEX : chronologie déroulable point par point (incident `INC-2026-014`) |
| `#/composants` | Composants transverses : modale de confirmation, toasts, états vides, chargement |

Changement d'écran = `hashchange`. La navigation principale reflète l'écran courant (`aria-current="page"`).
Écouter aussi `message` : la page comparative envoie `{ type: 'route', hash: '#/audits' }` via `postMessage`
pour basculer l'écran de l'iframe (répondre en changeant `location.hash`).

## Données

Uniquement `window.FAKE` (voir `shared/fake-data.js`) : `audits` (36), `constats`, `nonConformites`, `actions`,
`risques`, `indicateurs`, `evolution` (12 mois), `incidents` (RETEX), `kpi` (agrégats), `echeances`,
`utilisateur(id)`, `referentiel(id)`, `constatsDe(auditId)`, `actionsDe(auditId)`, `historiqueAudit(audit)`,
`fr(iso)`, `frLong(iso)`, `daysUntil(iso)`. Ne jamais inventer d'autres noms de personnes ou d'organisations.

## Contenu minimal de chaque écran

1. **Dashboard** : 4 à 6 KPI (audits en cours, NC ouvertes, actions en retard, taux de conformité…), état des
   audits par statut, NC par criticité, avancement des actions, prochaines échéances (avec échéances dépassées
   signalées par icône + libellé), au moins trois graphiques SVG natifs : barres, donut ou jauge, courbe d'évolution.
2. **Liste** : tableau des 36 audits, recherche plein texte, filtres (statut, type, référentiel), tri par colonne
   (indicateur visuel + `aria-sort`), badges de statut (icône ou libellé, jamais couleur seule), pagination (10/page).
   Clic sur une ligne → `#/audit/ID`.
3. **Fiche** : en-tête (nom, badges, dates, responsable, progression), onglets fonctionnels avec indicateur qui glisse
   (`role="tablist"`), constats avec criticité, plan d'actions avec avancement, historique en chronologie.
4. **Formulaire** : champs obligatoires, aide, validation à la soumission et au blur, messages d'erreur reliés
   (`aria-describedby`, `aria-invalid`), état succès (bandeau ou toast), bouton désactivé pendant « l'envoi ».
5. **RETEX** : chronologie des événements de `FAKE.incidents[0]`, déroulée point par point (bouton « Point suivant »,
   « Tout dérouler », clavier), détail de chaque point, gravité visible (icône + libellé).
6. **Composants** : bouton ouvrant une modale de confirmation (`role="dialog"`, focus piégé, Échap ferme),
   déclencheurs de toasts (succès, alerte, erreur, info) avec fermeture, état vide illustré, squelette de chargement
   + bouton « Simuler un chargement ».

## Règles non négociables

- Contraste WCAG 2.1 AA (4,5 : 1 texte, 3 : 1 composants). Focus clavier visible partout (`:focus-visible`).
- Les statuts combinent toujours couleur + icône ou libellé.
- Animations : uniquement `transform` et `opacity` (plus `stroke-dashoffset` pour les tracés SVG). 150–400 ms pour
  les interactions, ≤ 1,2 s pour les graphiques. Aucune boucle infinie gratuite.
- `@media (prefers-reduced-motion: reduce)` : animations coupées ou réduites à un fondu.
- Responsive : 1440 px prioritaire, tablette 1024 px correcte (navigation repliée en icônes acceptée).
- Polices système ou embarquées localement (Inter est disponible : `<link rel="stylesheet" href="../shared/fonts.css">`). Aucun CDN.
- Pas de style en ligne imposé par le HTML ; les valeurs dynamiques (largeur d'une barre, progression) passent par
  des variables CSS posées sur l'élément (`style.setProperty('--valeur', …)`) ou des attributs SVG.
- Chaque maquette ne touche qu'à son propre dossier.
- Aucune erreur de console. Tester avec Playwright (Chromium pré-installé, `require('playwright')`).
