# Maquette B — Fidèle épurée

Maquette statique et cliquable de la refonte graphique de « Suivi des audits SMSI », direction **fidèle épurée** :
mêmes couleurs de base que l’application (vert `#245F4C`, encre `#243B34`, violet `#5A48B5`) mais nuancées, beaucoup
plus de blanc, aucun aplat sombre, quasi aucune bordure, ombres presque nulles. Ouvrir `index.html` (en `file://` ou
servi) ; les routes sont celles du [brief commun](../shared/BRIEF-COMMUN.md) : `#/dashboard`, `#/audits`,
`#/audit/AUD-07`, `#/formulaire`, `#/retex`, `#/composants`. Données : `window.FAKE` uniquement, sans persistance.

## Intention

Garder ce que les utilisateurs reconnaissent (sauge, encre, violet, Inter, vocabulaire des statuts) tout en retirant
ce qui charge l’écran actuel : la navigation sombre devient claire, les cartes bordées deviennent des sections à fond
sauge très léger séparées par l’espace, les tableaux perdent leur grille, et la couleur vive est réservée aux statuts
et à l’action principale. La hiérarchie repose sur la typographie (chiffres clés en 2,75 rem, titres 600, légendes
en capitales espacées) plutôt que sur des cadres.

## Palette (hex)

| Rôle | Hex | Contraste vérifié |
| --- | --- | --- |
| Fond de page | `#FBFCFB` | — |
| Surface blanche | `#FFFFFF` | — |
| Fond de section (sauge) | `#F3F7F4` | — |
| Sauge 2 (pistes, survols, squelettes) | `#E6EFE9` | — |
| Fond de navigation | `#F5F8F5` | — |
| Encre (texte, titres) | `#243B34` | 12,0 : 1 sur blanc, 10,8 : 1 sur sauge |
| Encre 80 % (texte secondaire) | `#4F6159` | 6,6 : 1 sur blanc, 5,9 : 1 sur sauge |
| Encre 60 % (légendes, aides) | `#5F7169` | 5,2 : 1 sur blanc, 4,6 : 1 sur sauge |
| Vert de marque (action principale, nav active) | `#245F4C` | 7,5 : 1 sur blanc ; blanc sur vert 7,5 : 1 |
| Vert sombre (liens) | `#1F5A46` | 8,1 : 1 sur blanc |
| Vert pâle (nav active, badge « en cours ») | `#E3EEE7` | vert dessus 6,3 : 1 |
| Violet (accent, avatars, « Mineure ») | `#5A48B5` | 6,9 : 1 sur blanc, 5,9 : 1 sur violet pâle |
| Violet pâle | `#EDEAF8` | — |
| Succès | texte `#206D2F` / fond `#E6F2E8` / plein `#2F8F5B` | 5,5 : 1 |
| Alerte | texte `#A03E08` / fond `#FAEBE0` / plein `#D97A1F` | 5,7 : 1 |
| Erreur | texte `#B02424` / fond `#FCE8E8` / plein `#C2312A` | 5,7 : 1 ; blanc sur `#B02424` 6,7 : 1 |
| Info | texte `#145B9C` / fond `#E4EEF9` / plein `#2F6FC2` | 6,0 : 1 |
| Jaune (« Rapport attendu », « À vérifier ») | texte `#8A5200` / fond `#FBF0DC` | 5,7 : 1 |
| Neutre | texte `#4F6159` / fond `#EEF1EE` | 5,8 : 1 |
| Données 1 à 6 (graphiques) | `#1F8A5C`, `#5A48B5`, `#2F6FC2`, `#D97A1F`, `#7A68C9`, `#B02424` | voir ci-dessous |
| Ombre modale | `rgba(36, 59, 52, 0.14)` | seule ombre notable de l’interface |

Palettes de graphiques validées avec le validateur du skill dataviz (bande de luminosité, chroma, séparation daltonienne,
écart en vision normale, contraste ≥ 3 : 1 sur la surface) : courbe `#1F8A5C` + `#5A48B5` ; barre segmentée des actions
`#1F8A5C`, `#2F6FC2`, `#7A68C9`, `#D97A1F` ; donut des criticités `#B02424`, `#D97A1F`, `#7A68C9`. Le diagramme « audits
par statut » est monochrome (une seule série, l’identité vient du libellé). Les couples texte/fond ci-dessus ont été
recalculés en Node (luminance relative WCAG) : tous ≥ 4,5 : 1.

## Typographie

Inter variable (locale, `../shared/fonts.css`), repli système. Corps 0,9375 rem / 400, interlettrage −0,011 em ; titres
600, interlettrage −0,02 em (h1 2 rem) ; chiffres clés 2,75 rem / 600 / −0,03 em, chiffres tabulaires ; légendes et
en-têtes de tableau 0,75 rem en capitales, interlettrage 0,06 em, encre 60 % ; monospace système pour les références.

## Animations (transform, opacity, stroke-dashoffset uniquement)

- Entrée d’écran et de panneau d’onglet : fondu + translation 6 px, 360 ms / 220 ms, courbe `cubic-bezier(.2,.7,.2,1)`.
- Indicateur d’onglet qui glisse : `translateX` + `scaleX`, 220 ms.
- Courbe d’évolution : tracé progressif par `stroke-dashoffset` 900 ms, aire en fondu, points et étiquettes de fin en fondu différé.
- Barres horizontales et segments : `scaleX` depuis la gauche, 900 ms, décalage 60–80 ms par élément (`--delai`).
- Donut et jauge : arcs dessinés par `stroke-dashoffset` 900 ms, décalage 120 ms par segment.
- Barres de progression : `scaleX` 360 ms via la variable `--p`.
- Info-bulle : fondu 150 ms, position par variables `--tx` / `--ty`.
- Toasts : glissement 16 px + fondu 220 ms à l’entrée et à la sortie, disparition après 6 s.
- Modale : voile en fondu, panneau `translateY(8px) scale(.98)` → repos, 220 ms.
- RETEX : chaque point révélé entre par fondu + translation ; défilement doux vers le point actif.
- Squelette de chargement : pulsation d’opacité 1,3 s, uniquement pendant les 1,4 s de chargement simulé.
- `prefers-reduced-motion: reduce` : tout est remplacé par un fondu court, les tracés SVG apparaissent déjà dessinés, les
  transitions passent à 1 ms, la pulsation et le défilement doux sont coupés.

## Points forts

- Nettement moins chargée que l’accueil actuel : six chiffres clés typographiques, cinq sections, aucune carte bordée.
- Statuts toujours portés par couleur + icône + libellé (audits, constats, actions, criticités, gravités RETEX, référentiels).
- Tableau sans grille, tri par colonne avec `aria-sort` et icône, filtres, recherche, pagination 10 par page, lignes
  cliquables et activables au clavier.
- Onglets `role="tablist"` avec flèches, Début/Fin ; modale `role="dialog"` à focus piégé, Échap, retour du focus ;
  toasts `aria-live="polite"` (erreurs en `role="alert"`) avec fermeture nommée ; formulaire validé au blur et à la
  soumission avec résumé d’erreurs focalisé, `aria-invalid`, `aria-describedby`.
- Graphiques SVG natifs générés par `app.js`, info-bulles au survol et au focus (barres, segments, arcs sont focalisables).
- Aucune erreur ni avertissement de console en mode normal et en mouvement réduit (`test/test.cjs`).

## Limites connues

- Pas de mode sombre : la direction est volontairement claire ; la bascule clair/sombre de l’application n’est pas maquettée.
- La courbe d’évolution n’est pas navigable au clavier point par point ; un `<title>` SVG résume les douze valeurs des deux
  séries, mais il n’y a pas de tableau de données sous le graphique.
- Les actions de la fiche (Modifier, Supprimer) et l’enregistrement du formulaire sont simulés ; rien n’est conservé.
- À 1024 px, la liste masque les colonnes Réf., Type et Site (la fiche les reprend) ; sous 860 px, la mise en page n’est
  pas travaillée (mobile hors périmètre).
- La navigation « Fiche d’audit » pointe toujours sur AUD-07, conformément au brief ; elle reste active pour toute fiche.
- Le script de test est en `.cjs` parce que le `package.json` du dépôt impose les modules ES ; la maquette elle-même
  n’utilise aucun module.

## Écarts d’accessibilité éventuels

- Les textes dans les graphiques SVG (axes, 11 px) sont en encre 60 % sur sauge : 4,6 : 1, conforme mais proche du seuil.
- L’orange de données `#D97A1F` est à 2,9 : 1 sur le blanc (règle de relief appliquée : légende avec libellé et valeur,
  info-bulle, et le même statut porte toujours un badge texte).
- Les info-bulles sont annoncées via `role="tooltip"` sans `aria-describedby` dynamique ; l’information est doublée par
  les `aria-label` des éléments focalisables.
- La liste des audits rend chaque ligne focalisable (`tabindex="0"`) : navigation au clavier un peu longue sur 10 lignes,
  le lien du nom reste accessible par le clic.
- Les champs de saisie n’ont pas de bordure (séparation par le fond sauge/blanc) : le contraste du contour n’est pas
  mesurable ; l’anneau de focus 3 px vert (7,5 : 1) compense.

## Fichiers

`index.html` (coquille, modale, zone de toasts), `tokens.css` (variables seulement), `styles.css`, `app.js`,
`test/test.cjs` (Playwright : six ancres, onglets, filtre, tri, modale, toasts, RETEX, formulaire, 1024 px, mouvement
réduit ; captures dans `test/captures/`).
