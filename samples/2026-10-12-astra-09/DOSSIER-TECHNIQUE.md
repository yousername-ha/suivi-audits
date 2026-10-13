# Dossier technique — style retenu « Sauge profond / Normand’e-Santé »

Livraison : 13 octobre 2026 (préparation commencée le 12). Branche exclusive : `legacy`.
Base inspectée : `f7e543a5c1f31e0bd904f40cf941dbed32fa9dd3`.

## 1. Décision visuelle et portée de cette livraison

La dernière proposition choisie par l’utilisateur remplace les variantes précédentes : **barre latérale vert profond**, surfaces blanches, fond légèrement chaud, touches sauge et **turquoise assombri en bleu-vert**. Ne pas repartir de la variante à barre gauche sauge clair. L’identité Normand’e-Santé apparaît dans l’en-tête avec une signature typographique marine, un petit repère bleu-vert et un accès discret au site.

Cette livraison est un dossier d’implémentation : documentation, prototype CSS, reconstitution HTML de la référence et captures des menus. Le thème n’est pas intégré à l’application. Les dates, taux et données des aperçus ne sont pas des exigences métier ni un état réel de conformité.

La référence `images/000-reference-style.png` est une **reconstitution HTML du style approuvé**, pas l’image générée originale. Elle fixe la composition recherchée. Les autres images montrent les écrans réels de la branche avec un habillage injecté en mémoire ; leur contenu, leurs tables et leurs états vides viennent du jeu de démonstration. Les différences de composition du cockpit réel sont détaillées ci-dessous.

**Interdiction explicite : ne modifier ni l’interface ni le fonctionnement de la cartographie dynamique.** Par prudence, les trois destinations de la rubrique Cartographies sont exclues du thème, y compris leur enveloppe visuelle. Les captures correspondantes montrent le rendu existant, sans habillage.

## 2. Palette normative

| Jeton proposé | Valeur | Usage |
| --- | --- | --- |
| `--nes-nav` | `#173F34` | Barre latérale, carte prochain audit, action primaire |
| `--nes-nav-active` | `#315B4B` | Élément actif et survol de navigation |
| `--nes-nav-text` | `#F6FAF6` | Texte actif sur fond vert |
| `--nes-nav-muted` | `#BDCEC2` | Icônes et libellés secondaires sur fond vert |
| `--nes-sage` | `#84A28C` | Petits repères et progressions |
| `--nes-sage-soft` | `#E4EEE6` | Badges et surfaces secondaires |
| `--nes-sage-ink` | `#244B32` | Texte sur sauge clair |
| `--nes-accent` | `#236B70` | Turquoise assombri retenu ; filets et petits accents sur blanc |
| `--nes-marine` | `#142F61` | Signature Normand’e-Santé et lien au site |
| `--nes-paper` | `#F5F6F1` | Fond principal |
| `--nes-surface` | `#FFFFFF` | Cartes, dialogues, en-tête |
| `--nes-ink` | `#173F34` | Titres et textes principaux |
| `--nes-muted` | `#52645E` | Textes secondaires |
| `--nes-line` | `#DCE2DB` | Bordures et séparateurs |
| `--nes-focus` | `#326899` | Anneau de focus clavier |

La couleur cible exacte de l’implémentation est `#236B70`, car un rendu généré peut varier. Ne plus employer le cyan vif des premières propositions. Sur fond vert profond, le bleu-vert seul ne suffit pas comme indicateur : conserver le fond actif, le texte clair, le filet sauge et l’état ARIA. Garder les couleurs sémantiques existantes des risques, retards, conformités et graphiques. Aucun remplacement global de couleurs SVG/canvas.

## 3. Composition et composants

### En-tête

Hauteur cible 78–82 px sur bureau. À gauche : monogramme S, « Suivi des audits SMSI », sous-titre « Qualité, sécurité et référentiels ». À proximité : signature textuelle Normand’e-Santé, bleu marine et carré bleu-vert de 9–11 px. Le sous-titre « Numérique en santé » reste secondaire. Ne pas présenter cette typographie comme un logo officiel ; remplacer par un actif local approuvé seulement s’il est fourni.

Les contrôles du compte, le rôle et la déconnexion restent accessibles. Réutiliser les éléments et gestionnaires existants (`#userBox`, `#lx-account`) ; ne pas créer un second compte ou une seconde déconnexion factice. La barre d’outils existante doit conserver recherche, état de sauvegarde, import/export et notifications. Le prototype conserve cette barre sous la signature pour ne perdre aucune fonction ; une fusion ultérieure n’est acceptable qu’avec la même couverture fonctionnelle.

Le lien « Site Normand’e-Santé » ouvre `https://www.normand-esante.fr/` par action utilisateur, sans paramètres, avec `target="_blank"` et `rel="noopener noreferrer"`. Pas d’iframe, de SDK, de script distant, de police distante ni de récupération automatique du site au démarrage. L’application reste utilisable hors ligne. Employer une icône SVG locale pour le lien externe, pas un caractère dépendant d’une police absente.

### Navigation gauche

Largeur bureau : 252 px, largeur compacte conservée. Fond vert profond, groupes repliables et préférences d’ordre existants. Ligne active : fond `#315B4B`, texte clair, repère sauge ; le bleu-vert peut souligner un détail sans devenir l’unique signal. Conserver les identifiants de routes et les gestionnaires `data-act`, `data-sec`, `data-sub`, `data-lx-nav-group`. Préserver réduction de navigation, défilement interne, focus et accès clavier.

La capture de référence a une navigation simplifiée. **Ne pas supprimer les destinations réelles pour imiter cette capture.** Le registre actuel contient 24 rubriques et 100 destinations. Les aperçus techniques respectent ce registre ; l’inventaire JSON et la galerie font foi.

### Cartes, tables et formulaires

Cartes blanches, bordure 1 px `#DCE2DB`, rayon 12 px, ombre discrète `0 3px 15px #173F3408`. Espacement entre cartes 20–24 px, intérieur 24–28 px. Densité de table conservée, pas de conversion systématique en cartes. Polices locales déjà embarquées (« Sauge Inter »), repli Arial/sans-serif ; 14 px texte courant, 12 px secondaire, 28–34 px titres.

Champs et boutons restent de véritables contrôles HTML. Conserver `label`, erreurs de validation, état désactivé, états chargement/sauvegarde, ordre de tabulation et focus de retour des dialogues. Aucun bouton visuellement actif sans action réelle. Les états vides indiquent la cause et l’action permise ; ils ne sont pas remplacés par des chiffres inventés.

### Cockpit : composition cible et migration

La référence approuvée place en premier une grille 2 × 2 : prochain audit, synthèse des écarts, conformité par référentiel, répartition des écarts. Recomposer uniquement la présentation à partir des données existantes. Les calculs actuels de conformité, seuils, filtres, périmètres et dates restent la source de vérité.

Le cockpit ASTRA actuel possède aussi priorités, risques résiduels, incidents et tâches récurrentes. Les conserver sous la première grille ou dans « Tableaux de bord détaillés » ; ne pas les supprimer pour copier l’image. Garder l’accès au tableau historique. Les valeurs fictives de la référence — 100 %, 2 écarts, dates 2027 — **ne doivent jamais être codées en dur** dans le rendu livré.

### Responsive et thème sombre

Cibles de recette : 390, 768, 1440 et 1920 px. Sous 700 px, conserver le comportement mobile existant, une seule colonne pour les cartes, un en-tête compact, et un défilement local pour les grandes tables. Aucun masquage d’une fonction sans accès alternatif. La version sombre existante reste disponible ; elle exige sa propre palette et sa recette, elle n’est pas spécifiée par la seule capture claire. Le prototype ne vaut pas validation finale mobile ou sombre : consulter les résultats réels dans `technique/verification.json`.

## 4. Architecture actuelle vérifiée

Application locale HTML/CSS/JavaScript, sans compilation frontend. `demarrer.py` démarre `legacy_server.py` sur 127.0.0.1. SQLite et pièces privées sont dans `.legacy-data`, avec sessions, contrôle des périmètres et versions optimistes côté serveur. Aucun besoin de React, Vite, Tailwind, Docker ou service externe pour cette refonte.

| Fichier / point | Intervention envisagée | Invariant |
| --- | --- | --- |
| `index.html` | Monter l’en-tête et charger le thème à la fin des styles ; garder les nœuds utiles | Ne pas remplacer le document monolithique ni les données embarquées |
| `modules/astra.css` | Identifier les règles existantes ; éviter une modification globale | Aucun effet involontaire sur les cartographies |
| `modules/nes-sage.css` **à créer** | Jetons et styles sous attribut de thème explicite | Tous les sélecteurs applicatifs sont bornés au thème |
| `modules/nes-sage-ui.js` **à créer** | Montage idempotent de la signature et activation par route | Aucun calcul métier, aucun stockage métier |
| `modules/astra-ui.js` | Recomposer le cockpit en conservant API, calculs, accès détaillé et actions | Réutiliser les registres et fonctions existants |
| `modules/navigation-ui.js` | Seulement si nécessaire pour positionnement / accessibilité | Préserver groupes, ordre, IDs et 100 destinations |
| `modules/integration-ui.js` | Réutiliser toolkit, comptes, formulaires et liens | Aucun doublon de registre ni contournement des permissions |
| `modules/risk-ui.js`, `pcra-ui.js`, `finance-ui.js`, `df-ui.js`, `admin-ui.js`, `journey-ui.js` | Ajustements ciblés de présentation si CSS insuffisant | Mêmes opérations, formulaires et validations |
| `modules/server-client.js` | Aucune modification nécessaire pour une refonte visuelle | File d’écriture, identifiants internes et conflits préservés |
| `modules/*-core.js`, `legacy_server.py`, `legacy_risks.py` | Hors intervention visuelle | Calculs, schémas, sessions, périmètres et validations inchangés |
| `modules/carto-core.js`, `modules/carto-ui.js`, `modules/carto.css`, `legacy_cartography.py` | **Interdiction de modifier** | Interface, géométrie, commandes et fonctionnement inchangés |

Le toolkit réel est `LegacyIntegrationUI.toolkit`. Il expose `api()`, `state()` et `mutate()`. La navigation réelle est disponible via `api().astra.navigation()`, et le changement de vue via `api().navigate(tab, set)`. Ne pas inventer un routeur parallèle.

## 5. Cloisonnement obligatoire des cartographies

Détecter avant d’appliquer les jetons :

```js
function isProtectedCartography(ui) {
  return ui.tab === 'carto' ||
    (ui.tab === 'dash' && ui.dashView === 'map');
}
```

L’attribut du thème racine doit être **retiré** sur ces routes, et le nouvel en-tête démonté/restauré proprement. Ne pas laisser hériter les nouvelles variables de couleur ou de typographie dans leur canevas, leurs commandes ou leur enveloppe. Les styles des nouveaux composants doivent eux aussi être bornés ; la CSS du prototype est un exemple de rendu, pas un fichier à copier sans revue.

Tester la transition vers la carte depuis un écran thémé, puis le retour, et la navigation directe. Comparer les captures avant/après pour un même état et une même taille, vérifier position/zoom/pan/sélection, nœuds, liens, filtres, exports et droits. Le simple fait de ne pas modifier `carto.css` ne garantit pas l’absence de régression par héritage CSS.

## 6. Invariants métier et sécurité

- Source de vérité serveur : SQLite, sessions, contrôles d’écriture et périmètres inchangés.
- `objectRefs` bidirectionnels risque ↔ mesure Annexe A ISO 27001:2022 conservés ; préserver aussi les liens indirects via les traitements.
- Lier une mesure n’atteste pas sa conformité et ne réduit pas automatiquement le risque résiduel.
- Évaluations, décisions, politiques versionnées et identifiants internes gardent leur immutabilité.
- Actions, sous-actions, programmes, tâches récurrentes, preuves, CaRE/HAS, PCRA et incidents continuent de lire leurs registres existants.
- Sauvegarde après édition rapide, erreurs 409/422, droit lecteur et interdiction de mutation restent gérés par les composants existants.
- Aucun secret, base, session, document réel ni compte personnel dans Git ou dans le ZIP.
- Conserver les séries `samples` jusqu’à demande explicite de suppression.

## 7. Plan d’implémentation recommandé

1. Vérifier `legacy`, HEAD, instructions et modifications locales. Capturer les cartographies de référence dans une base fictive. Relever tous les points de montage et les styles actuels.
2. Créer les jetons et le composant de marque ; les activer uniquement sur les routes autorisées. Traiter tout de suite la sortie/entrée des cartographies.
3. Habiller en-tête, navigation, champs, dialogues et surfaces. Réutiliser les contrôles réels ; pas de duplication d’actions.
4. Recomposer le cockpit selon la référence, sans coder les valeurs illustratives. Garder les tableaux détaillés et priorités ASTRA.
5. Décliner sur les 24 rubriques / 100 destinations à partir de l’inventaire. Corriger les exceptions locales avec des sélecteurs ciblés.
6. Vérifier clavier, lecteurs, responsive, thème sombre et exports. Exécuter la recette ciblée ci-dessous et publier de nouveaux aperçus sans écraser ceux du dossier.
7. Livrer diff revu, résultat des tests réellement exécutés et ZIP de l’application via le script existant. Aucun déploiement, release, CI ou changement de branche parallèle.

## 8. Recette d’acceptation de l’implémentation future

| Domaine | Critère observable |
| --- | --- |
| Identité | Vert profond dominant ; marine réservé à l’identité/lien ; bleu-vert `#236B70`, pas de cyan vif |
| Navigation | 24 rubriques et 100 routes présentes ; IDs et transitions préservés |
| Site | Lien exact, ouverture explicite, aucun appel réseau automatique tiers |
| Cockpit | Composition approuvée et valeurs calculées depuis l’état autorisé |
| Risques | Liaison/déliaison multi-mesures Annexe A, lien inverse et lecture seule fonctionnent |
| Écritures | Création puis modification rapide persiste sans perte d’ID ou de champ |
| Cartographie | Fichiers protégés inchangés, captures et comportements identiques avant/après |
| Dialogues | Focus, labels, erreurs, validation, fermeture et retour au déclencheur fonctionnent |
| Responsive | Pas de débordement global sur quatre largeurs ; tables et cartes lisibles |
| Sombre | Parcours principal et contrastes conservés avec thème sombre existant |
| Métier | CaRE/HAS, preuves, finances, PCRA, récurrences et exports conservent leurs règles |

Commandes existantes à adapter à l’environnement, **à exécuter lors de l’implémentation** :

```sh
node --test tests/*.test.cjs
python3 -m unittest discover -s tests -p '*_test.py'
CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/astra-browser.cjs
CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/browser-carto.cjs
CHROMIUM_EXECUTABLE=/usr/bin/chromium node tests/browser-interface.cjs
```

Ces commandes ne sont pas déclarées exécutées pour cette livraison documentaire. Les vérifications effectivement faites sur les captures sont dans `VERIFICATIONS.md` et `technique/verification.json`. Ne pas transformer les captures présentes en preuve de fonctionnement d’une implémentation future.

## 9. Limites à transmettre au développeur

La navigation de la capture utilisateur n’est pas exactement celle de `legacy` à ce SHA. Les entrées « Mon compte », « Guide d’utilisation » et « Écran mural » ne figurent pas comme destinations autonomes dans les 100 routes retournées. Le contrôle du compte ouvre l’administration pour un administrateur et les paramètres actuels pour un autre rôle ; le guide existe dans `docs/GUIDE-UTILISATION.md`. Ne pas inventer un écran mural ou un nouveau compte dans le cadre de cette refonte graphique. L’inventaire donne les correspondances disponibles.

Certaines vues sont vides avec la fixture utilisée : c’est l’état réel de cette fixture, pas une fonctionnalité manquante. Les aperçus cadrent le premier écran, pas toutes les lignes ni tous les onglets contextuels d’un formulaire. Les captures de référence ne sont pas une certification d’accessibilité ; mesurer les contrastes et vérifier les parcours clavier dans la réalisation.
