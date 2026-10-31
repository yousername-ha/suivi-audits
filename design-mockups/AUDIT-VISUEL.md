# Audit visuel du front existant (lecture seule)

Relevé effectué le 31/10/2026 sur `packages/ui/src/tokens.ts`, `packages/ui/src/theme.ts`,
`packages/ui/src/styles.css` (2 883 lignes), `apps/web/src/app.css` (4 415 lignes) et les captures
`captures-jdt/` et `captures-archive/`. Rien n'a été modifié dans l'application.

## 1. Palette réelle (direction graphique « Sauge »)

### Marque et fonds

| Rôle | Jeton | Hex |
| --- | --- | --- |
| Encre (texte principal, titres) | `BRAND.encre` | `#243B34` |
| Vert de marque (primaire, boutons pleins, liens) | `BRAND.vert` = `VERT[8]` | `#245F4C` |
| Violet (accent) | `BRAND.violet` = `VIOLET[7]` | `#5A48B5` |
| Fond de page (clair) | `BRAND.fond` | `#F5F6F2` |
| Surface des cartes | `BRAND.surface` | `#FFFFFF` |
| Texte secondaire | `GRIS[6]` | `#58695F` |
| Bordure de champ | `GRIS[5]` | `#819087` |
| Filet / séparateur | `GRIS[3]` (`--suivi-trait`) | `#D5DCD3` |
| Surface douce (en-têtes de tableau, survols) | `GRIS[0]` | `#F8F9F6` |
| Style global « Clair » (option) | `STYLE_CLAIR` | page `#F7F9FB`, surface douce `#F0F4F7` |

### Gammes à 10 nuances (Mantine)

- Vert `VERT` : `#EDF4EF` → `#194B3B` (nuance 8 = `#245F4C`).
- Encre `ENCRE` : `#EEF1F6` → `#0B1529` (nuance 8 = `#14213D`, bleu nuit, pas le `#243B34` de la marque : incohérence de nommage).
- Violet `VIOLET` : `#F2F0FB` → `#43358B`.
- Gris `GRIS` : `#F8F9F6` → `#25382D` (gris verdis).
- Sombre `SOMBRE` : `#E7EEE9` → `#0D1B15` ; fond de page sombre `#12241C`, surface `#1A2F25`.

### Navigation latérale (toujours sombre)

| Rôle | Hex |
| --- | --- |
| Fond | `#163E33` (sombre : `#0C2018`) |
| Texte | `#F2F6EF` |
| Texte secondaire | `#B5CEC0` |
| Entrée active | `#305A49` + repère gauche `#C5DBAB` (3 px) |
| Survol | `#244C3E` |
| Pastilles de famille | pilotage `#C5DBAB`, organisation `#9CC7E4`, risques `#F2A99B`, conformité `#E8D28C`, actions `#BCAAEC`, résilience `#84D6C6`, documents `#E6B8D2` |

### États (assombris pour WCAG AA, `ETATS`)

| État | Fond plein | Survol | Texte (variante légère) |
| --- | --- | --- | --- |
| Erreur / rouge | `#C92A2A` | `#B12525` | `#A82424` |
| Alerte / orange | `#CE440E` | `#B53C0C` | `#A03E08` |
| Jaune | `#AC5900` | `#974E00` | `#925500` |
| Succès / vert | `#29833B` | `#247334` | `#206D2F` |
| Sarcelle | `#087F5B` | `#077050` | `#066A4C` |
| Info / bleu | `#1971C2` | `#1663AB` | `#145B9C` |
| Violet | `#6741D9` | `#5B37C4` | `#5A2FB0` |

### Autres palettes spécialisées

- Santé des indicateurs : ok `#2F8F5B`, ko `#C2312A`, mesure `#D98A1D`.
- Tableau de bord « verre et relief » (ADR 0069) : remplissages vert `#278A58`, orange `#EA8A1A`, rouge `#D63A30`,
  violet `#6556C2`, bleu `#3A66B5`, gris `#7A887F` ; contour `#10201A` ; verre `#F3F6F1`.
- Cartographie (`CARTE`) : canevas `#F5F8FC`, marine `#0B2B55`, bleu `#1662D6`, violet `#6A3FD0`, orange `#A85808`,
  vert `#18763F`, gris `#56657D`, rouge `#C2312A` (accents clairs) ; déclinaison sombre.
- Identité « Référence 08 » (option) : turquoise `#00A8B0`, turquoise nav `#2CC4CB`.
- Sceau de connexion : bleu `#00005E`, blanc `#B9C4BD`, rouge `#9C0A14`.
- RETEX (chronologie) : fond marine mélangé au noir, néon bleu éclairci, couleurs des accents de la carte mélangées à
  55 % de blanc.

## 2. Typographie

- Famille : Inter variable (100 à 900), hébergée localement (`packages/ui/src/fonts/`), repli système.
- Monospace : `ui-monospace, SFMono-Regular, Menlo, Consolas, …`.
- Base fluide : `clamp(87.5 %, 82.5 % + 0.2vw, 100 %)` × échelle utilisateur (0,9 à 1,5 ; écran mural × 1,25).
- Titres : graisse 650 (h1), 600 (h2 à h4) ; `letter-spacing: -0.035em` ; h1 `clamp(1.65rem, 2.2vw, 2.45rem)`.
- Corps : `letter-spacing: -0.011em`, antialiasing forcé.
- Libellés de champ 0,82 rem / 550 ; en-têtes de tableau 0,68 rem / 600 / `letter-spacing 0.035em` / couleur « dimmed ».
- Légendes de navigation 0,61 rem majuscules, `letter-spacing 0.14em`.
- Chiffres tabulaires dans les tableaux et `.chiffres`.

## 3. Espacements, rayons, ombres, mouvement

| Jeton | Valeur |
| --- | --- |
| Espacements | 2xs 0,25 rem, xs 0,5, sm 0,75, md 1, lg 1,5, xl 2, 2xl 3 rem |
| Rayons | xs 6 px, sm 8, md 10, lg et xl 12 px (Modal/Card `lg`, Button `md`, Badge `sm`) |
| Ombre courante `--suivi-ombre` | `0 2px 4px rgb(27 54 37 / 2%), 0 8px 28px rgb(27 54 37 / 3%)` |
| Ombre haute `--suivi-ombre-haute` | `0 18px 54px rgb(27 54 37 / 12%)` |
| Survol bouton plein | `0 4px 12px rgb(18 63 41 / 14%)` |
| Anneau de focus champ | `0 0 0 3px` (primaire léger) ; `--suivi-trait-focus: 2px` |
| Durées | `--suivi-motion: 180ms`, `--suivi-motion-entree: 360ms` |
| Courbe | `cubic-bezier(0.2, 0.7, 0.2, 1)` |
| En-tête | 3,75 rem (4,5 rem en identité 08) ; nav 15,5 rem (repliée 4,25 rem) |
| Marge de page | `clamp(0.75rem, 0.5rem + 1vw, 2.5rem)` |
| Points de rupture | xs 36 em, sm 48, md 64, lg 90, xl 120, xxl 160 em |

Le tableau de bord « verre » ajoute `backdrop-filter: blur(18px) saturate(180%)`, un liseré dégradé en masque et
sept couches d'ombre : l'effet le plus riche de l'interface, isolé à l'accueil.

## 4. Composants (Mantine 7 + surcharges statiques, CSP stricte)

- **Coquille** : en-tête collant blanc (marque, nom du GCS, pastille « En direct », rôle, bouton Déconnexion) ;
  navigation latérale sombre à familles dépliables et pastilles de couleur ; thème clair/sombre/auto.
- **Cartes** : bordure 1 px `--suivi-trait`, ombre basse, padding `lg`, rayon 12 px ; variante « dalle en verre ».
- **Boutons** : graisse 550, variante `default` (bordure, survol surface douce), `filled` vert ; rayon 10 px.
- **Badges** : rayon 8 px, casse normale, graisse 550, variantes légères avec texte assombri.
- **Tableaux** : en-têtes capitales fines gris, lignes `highlightOnHover`, en-tête et première colonne figés
  (`.data-table`), chiffres tabulaires ; pagination et filtres par composants `Filtres.tsx`, `Colonnes.tsx`.
- **Formulaires** : libellés 0,82 rem, champs rayon 10 px, anneau de focus 3 px, largeurs normalisées
  (`--suivi-champ-xs` à `l`, formulaire 45 rem).
- **Onglets** : liste soulignée 1 px, onglet actif vert plein (clair) / vert clair (sombre).
- **Modales et tiroirs** : ombre haute, en-tête souligné, `lockScroll=false`.
- **Notifications** : en haut à droite, bouton de fermeture nommé.
- **Graphiques** : SVG maison (`graphiques.tsx`, `tableau-de-bord.tsx`) : barres, anneaux, jauges, matrice de risques,
  cartographie ; RETEX : courbe néon animée sur fond sombre.
- **Icônes** : `icones.tsx` (traits fins, 1,5 px).

## 5. Écrans principaux

| Route | Écran |
| --- | --- |
| `/` | Accueil : tableau de bord (prochain audit, écarts, conformité, objectifs, plans, pilotage, échéances) |
| `/pilotage/:section` | Pilotage SMSI : processus, objectifs, indicateurs, risques, fournisseurs, revue de direction, plans d'action… |
| Gestion de l'audit (pronostic, déroulé, planning, participants, couverture du cycle) | Audits de certification ISO 27001 / HDS |
| `/documents`, `/registres`, `/exports` | Documents et liens, registres, exports |
| `/cartographie/:vue` | Cartographie du SMSI |
| `/retex/:incident` | RETEX : chronologie animée d'un incident, collecte des contributions |
| `/parametres`, `/admin/:tab`, `/account` | Paramètres, administration, compte |
| `/mur` | Écran mural |
| `/login`, `/setup` | Connexion, installation |

## 6. Défauts visuels constatés

1. **Surcharge de l'accueil** : plus de quinze cartes empilées sans hiérarchie (KPI, graphiques, « espace de travail »,
   « reprise des modules » en puces) ; la page dépasse 2 600 px de haut à 1440 px de large.
2. **Trois identités qui cohabitent** : « Sauge » (nav vert sombre), « Référence 08 » (turquoise, en-tête 4,5 rem),
   « Clair bleuté » ; plus un tableau de bord « verre » et un RETEX néon sombre. L'ensemble manque d'unité.
3. **Incohérences de palette** : la gamme `ENCRE` (`#14213D`, bleu nuit) ne correspond pas à l'encre de marque
   (`#243B34`) ; la cartographie et le tableau de bord ont chacun leur rouge, leur violet et leur bleu.
4. **Densité inégale** : graphiques minuscules (barres de « Conformité par référentiel » à 100 % identiques, légende
   illisible à 0,68 rem) à côté de grands chiffres ; tuiles ISO/HDS sur fond rose saturé (déroulé) qui écrasent la page.
5. **Contrastes limites** : textes « dimmed » à 0,61 à 0,68 rem en capitales espacées ; libellés sur fond orange plein
   (`A.5.x`) ; bordures 1 px `#D5DCD3` sur `#F5F6F2` presque invisibles.
6. **Signalement par la couleur seule** à plusieurs endroits : chiffres rouge/orange des KPI (« 1 en retard ») sans
   icône, traits de la chronologie d'audit (pleins, vides).
7. **Bordures et filets partout** : cartes bordées + ombres + séparateurs internes + en-têtes soulignés, ce qui
   alourdit alors que l'ombre est quasi invisible (2 à 3 % d'opacité).
8. **Cibles tactiles hétérogènes** : badges 1,3 rem de haut, liens soulignés en permanence, boutons `xs`.
9. **Vocabulaire visuel vieillissant** : barres de progression plates, anneaux à traits épais, tableaux en gris,
   absence de squelettes de chargement cohérents (un `Loader` centré).
10. **Mode sombre partiel** : nav toujours sombre, contenus parfois clairs, verre et cartographie avec leurs propres
    réglages.
