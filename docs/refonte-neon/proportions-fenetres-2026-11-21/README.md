# Proportions des fenêtres, champs et menus

21 novembre 2026, Europe/Paris — session « Codex » (`01a193c1-316c-7677-831f-2f31592aa052`).

Complément à l’[harmonisation de la plateforme](../harmonisation-plateforme-2026-11-21/README.md), fondé sur
`55e6fcba08efccbfa7c20968875ddf028c00f154`. Le RSSI demande des alignements plus cohérents, des sélecteurs moins longs
et des fenêtres moins larges lorsqu’elles n’ont pas besoin d’autant d’espace. Le thème Neon est conservé.

**Étape intermédiaire** : ce lot vérifie les proportions et alignements. La consigne suivante du RSSI impose des fiches
sans défilement vertical, avec un mini-menu quand le contenu dépasse. Cette évolution est traitée ensuite ; les captures
présentes ici ne constituent pas sa validation.

## Modifications pour l’IA qui reprend le code

- `packages/ui/src/proportions-champs.ts` définit une classification commune par nature de donnée, à partir des libellés
  existants et du type de saisie. Les largeurs restent stables pendant la sélection ; elles ne suivent pas chaque valeur.
  Les libellés inconnus gardent un repli : texte libre extensible, choix simple de largeur moyenne.
- `packages/ui/src/theme.ts` applique ces classes aux `TextInput`, `Select` et `NativeSelect`, et une classe numérique
  aux `NumberInput`. La classification n’altère aucune valeur, option, contrainte, référence, requête ou callback.
  Les classes locales existantes restent disponibles. La liste des choix ne dépend pas de cette classification.
- `InputWrapper` place par défaut **libellé → saisie → aide → erreur**. Les aides de longueurs différentes ne poussent
  plus les saisies voisines à des hauteurs différentes. Un ordre explicitement demandé par un écran reste prioritaire.
  Les associations accessibles des descriptions et erreurs sont conservées.
- `packages/ui/src/neon-harmonisation.css` applique les largeurs aux contrôles dans les fenêtres, tiroirs métier et
  panneaux de filtres. Les aides gardent la largeur de leur colonne. Les libellés, valeurs et aides s’alignent à gauche ;
  les filtres s’alignent par le haut. Les textes longs et les sélections multiples gardent leur espace utile.
- Les colonnes de formulaire utilisent `auto-fit` avec une largeur minimale bornée par le conteneur. Elles suivent
  l’espace de la fenêtre plutôt qu’un seuil fondé uniquement sur la largeur de l’écran. L’ordre DOM/clavier est conservé.
- Les menus `Select` prennent une largeur adaptée à leur contenu, bornée par l’écran et 32 rem ; les options longues
  reviennent à la ligne. Les menus natifs restent rendus par le navigateur. Les menus de sélection multiple sont bornés
  également, tandis que leurs champs gardent la place pour les étiquettes sélectionnées.
- `packages/ui/src/neon-ergonomie.css` différencie à nouveau les tailles des fiches : `lg` = **46 rem**, `xl` = **54 rem**.
  La précédente surcharge ramenait les deux à 64 rem. Les petits dialogues, grandes présentations graphiques, plein
  écran et élargissements utiles aux tableaux conservent leurs règles propres.

Largeurs maximales des contrôles à 100 %, dans la limite de leur colonne : code/version courte **160 px**, nombre
**144 px**, date **192 px**, état/choix court **208 px**, choix courant **288 px**, responsable **352 px**. Les identifiants
techniques longs (CPE, URL, empreinte, secret, etc.) sont distingués des codes courts. Un texte libre ou une sélection
multiple n’est pas contraint par ces petites largeurs. Les tailles choisies par l’utilisateur continuent de s’appliquer.

L’inventaire syntaxique couvre **710 déclarations de saisies dans 136 fichiers**, dont **302 sélecteurs** : 264 `Select`,
5 `NativeSelect`, 33 `MultiSelect`. Ce comptage décrit les points d’application du socle ; il ne signifie pas que les 302
sélecteurs ont été ouverts manuellement. Les formulaires construits par schéma utilisent le même thème à l’exécution.

## Recette et images

Les captures proviennent du frontend compilé avec API interceptée et données entièrement fictives. Aucune donnée privée
de référence n’est incluse. Les preuves détaillent les commandes, codes retour, mesures des champs, cas et limites.

Les fenêtres de risque, fournisseur et produit sont comparées aux captures et mesures du lot précédent. À 100 % : la fiche
de risque passe de 1 024 à **864 px** et la création de produit de 1 024 à **736 px**. Le code et le responsable n’occupent
plus toute la demi-colonne du risque. Les dialogues courts gardent leur largeur de 440 px.

Les contrôles incluent le centrage de la fenêtre, l’alignement du contrôle sur son libellé visible, l’aide sous la saisie,
les limites du document/corps de fenêtre, les filtres, le clavier et les menus. Les libellés volontairement masqués des
recherches et le texte intérieur des champs à étiquettes multiples ne sont pas traités comme des libellés visibles.

Les tests de contrat sont dans `apps/web/test/proportions-champs.test.ts` : ordre et associations accessibles,
conservation des ordres spécifiques, identifiants longs, valeur et soumission d’un responsable, options natives et valeur
numérique zéro. Ils utilisent les dépendances de rendu serveur déjà présentes dans le paquet web, sans ajout de dépendance.

**Limites** : aucune validation humaine, recette Docker/API/base réelle, exécution de la suite E2E serveur, installation,
publication d’image ou déploiement. Les tests de présentation ne remplacent pas la recette de chaque formulaire et de
ses permissions. Les références visuelles de CI ne sont pas approuvées automatiquement. Les animations réduites des
captures ne valident pas les animations en mouvement.

Résultats de cette étape : **934 tests web + 285 tests UI = 1 219 tests distincts** réussis ; TypeScript web/UI,
lint, format et build verts. Les tentatives corrigées et reprises sont tracées dans [les contrôles](preuves/controles-code.json).
La dernière finition CSS des menus a été reconstruite et vérifiée au navigateur. Les [mesures client](preuves/recette-client.json)
regroupent 72 cas de pages et 56 ouvertures de 7 variantes, en clair/sombre et normal/compact sur 1280, 1440, 1920 et 3840 px.
Aucune erreur JavaScript, route imprévue ou mutation métier dans ces campagnes finales.

Captures natives de cette étape : [risque clair](captures/risque-clair-1920.png), [sombre](captures/risque-sombre-1920.png),
[produit clair](captures/produit-clair-1920.png), [fournisseur sombre](captures/fournisseur-sombre-1920.png),
[nom long dans le menu](captures/responsable-menu-1440.png), [1280 compact](captures/risque-compact-1280.png).

## Reprise

Lire `AGENTS.md`, `HANDOVER.md`, puis ce dossier. Vérifier l’état du code avant de reporter les règles sur une autre
branche. Ne pas réintroduire la surcharge identique `lg/xl = 64rem`, ni dimensionner les champs à partir des données
sensibles ou du texte actuellement sélectionné. Réutiliser les classes communes ; garder les champs, gardes métier,
callbacks et aides accessibles. La cartographie/génération SMSI, les calculs, API, base, droits et mode mural sont conservés.

Prochaine action : validation des images par le RSSI, puis recette des formulaires sur une pile Docker isolée avec API
réelle. Les preuves du lot précédent restent datées et ne sont pas réattribuées à ce complément.
