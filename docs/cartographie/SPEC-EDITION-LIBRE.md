# Cartographie — construire une carte de zéro (CARTO-15 à CARTO-19)

> Évolution demandée par le RSSI le 08/10/2026 après le premier essai sur le serveur : « je dois pouvoir construire
> de zéro, si possible avec un clic droit ou un glisser-déposer » (ajouter une partie intéressée, un élément…).
> **Statut : validée par le RSSI le 08/10/2026**, avec les défauts du § 5. Décisions : [ADR 0016](../adr/0016-cartographie-creation-depuis-la-carte.md).
> Complète la [spécification v3](SPEC-CARTOGRAPHIE-V3.md) ; recette : [RECETTE.md](RECETTE.md), parcours 21 à 32.

## 1. Constat
- La carte n'affiche que des objets **déjà saisis** dans la plateforme (processus, parties intéressées, fournisseurs,
  applications, enjeux, sites, systèmes) ; l'édition se limite à les placer, les relier, les masquer ou les retirer
  (CARTO-07, CARTO-09). Les objets se saisissent aujourd'hui dans l'outil historique (`/legacy`), modules non repris.
- Sur une installation neuve, la carte est donc vide et **rien ne permet de la construire** depuis l'écran
  Cartographie : il faut d'abord remplir plusieurs modules ailleurs.
- Le module bêta de l'outil historique avait la même limite.

## 2. Principe retenu
- **Une seule source pour chaque donnée** (ADR 0013) : un objet créé depuis la carte est un **vrai objet de la
  plateforme**, enregistré dans son module (une partie intéressée créée sur la carte apparaît dans la liste des
  parties intéressées, avec les mêmes champs). La carte continue de ne stocker que la présentation.
- Pour ce qui n'est pas un objet métier (une zone, une annotation), la carte reçoit des **éléments propres à la
  carte** : cadres libres et notes, stockés dans la disposition.

## 3. Exigences

### CARTO-15 — Créer un objet de la plateforme depuis la carte
- Types créables, selon la vue :

  | Type | Vue | Module (permission requise en plus de `cartographie:modifier`) | Champs de création |
  |---|---|---|---|
  | Partie intéressée | contexte | `pilotage:modifier` | nom, interne / externe, catégorie, attentes (facultatif) |
  | Fournisseur | contexte | `fournisseurs:modifier` | nom, SaaS, hébergeur HDS, critique |
  | Application | contexte | `conformite:modifier` | nom, fournisseur (liste), statut « À étudier » |
  | Enjeu | contexte | `cartographie:modifier` | libellé, interne / externe, description (voir § 5, point 2) |
  | Site, système d'information | contexte | `pilotage:modifier` | libellé (ajouté à la liste du périmètre) |
  | Processus, sous-processus | processus (et contexte) | `pilotage:modifier` | code (proposé), nom, famille (pilotage, réalisation, support), processus parent, pilote |

- Saisie dans une **petite fenêtre** ouverte à l'endroit voulu : seuls les champs indispensables, « Créer » place la
  boîte à cet endroit sans chevauchement (`placeNode`) ; « Créer et compléter » ouvre ensuite la fiche du module.
- Le serveur écrit l'objet dans son module (aujourd'hui l'état legacy, demain la table du module repris), avec un
  identifiant au format de ce module (`PI-…`, `PR…`, etc.), au nom de la personne, et journalise
  (`carto.object_create`). Les autres sessions le voient arriver (temps réel) ; sur les autres cartes, il apparaît
  dans le bandeau « nouveaux objets » (CARTO-08), jamais placé automatiquement.
- La création et la disposition sont deux enregistrements distincts : l'objet existe dès « Créer » ; sa position
  s'enregistre avec la carte (« Enregistrer »). « Annuler » (Ctrl+Z) retire la boîte de la carte, **pas** l'objet
  (un message le rappelle, avec un lien vers la fiche).
- Concurrence : écriture sous verrou de l'état legacy ; une session de `/legacy` ouverte en même temps reçoit le
  conflit habituel de l'outil historique à son prochain enregistrement et recharge.

### CARTO-16 — Menu contextuel (clic droit, appui long, clavier)
- **Sur le fond de carte** : « Créer ici » (sous-menu des types autorisés), « Ajouter un objet existant… »
  (CARTO-09), « Ajouter une note », « Ajouter un cadre », « Coller », « Disposition automatique », « Ajuster
  l'affichage ».
- **Sur un objet** : « Ouvrir la fiche », « Renommer » (CARTO-18), « Relier à… », « Copier », « Taille par défaut »,
  « Masquer les relations métier », « Retirer de la carte » (Suppr) ; pour un objet indisponible : « Retirer » ou
  « Ignorer ».
- **Sur une relation** : type de relation, « Valider la proposition », « Masquer », « Supprimer ».
- **Sur une sélection multiple** : « Aligner » (gauche, centre, haut), « Répartir », « Grouper dans un cadre »,
  « Retirer de la carte ».
- Ouverture : clic droit (souris), **appui long de 500 ms** (tactile), touche Menu ou **Maj+F10** (clavier) ; menu
  au point visé, navigable au clavier, fermé par Échap ; entrées grisées avec leur raison quand le droit manque.
- En lecture seule, seules les entrées de consultation sont proposées (fiche, copier, ajuster).

### CARTO-17 — Palette et glisser-déposer
- En mode édition, une **palette** (colonne repliable à gauche ; barre en bas au téléphone) présente les types
  créables (CARTO-15), « Note » et « Cadre », chacun avec son icône et sa couleur de carte.
- Glisser un type de la palette sur la carte ouvre la fenêtre de création **au point de dépôt** ; un clic sur un
  type, puis un clic sur la carte, fait de même (accessible sans glisser). Clavier : Entrée sur un type crée l'objet
  au centre de la vue.
- La palette liste aussi les **objets de la plateforme non placés** (avec recherche) : on les glisse sur la carte
  pour les placer, comme « Ajouter un objet existant ».
- Glisser une boîte **dans un cadre** l'y range (le cadre l'emporte ensuite) ; glisser d'une poignée d'objet à un
  autre crée une relation (déjà possible avec « Relier »).

### CARTO-18 — Modifier depuis la carte
- **Renommer** (double-clic sur le titre, ou F2) : modifie le nom dans le module d'origine, avec la permission de
  ce module ; confirmation la première fois (« Le nom change partout dans la plateforme »).
- Changer la **nature d'un enjeu** reste propre à la carte (CARTO-12) ; changer la famille d'un processus ou la
  nature d'une partie intéressée se fait dans la fenêtre « Modifier » de la fiche, enregistrée dans le module.
- **Pas de suppression d'un objet de la plateforme depuis la carte** (§ 5, point 3) : « Retirer de la carte »
  seulement ; la fiche propose « Ouvrir dans son module ».

### CARTO-19 — Éléments propres à la carte, carte vierge
- **Note** : texte court (500 caractères), couleur parmi les teintes de carte, redimensionnable, exportée.
- **Cadre libre** : titre, teinte, emporte son contenu comme les cadres générés (bandes, zones) ; sert à grouper
  (« Site principal », « Hébergement HDS »…).
- Références `note:<id>` et `frame:<id>` dans la disposition (`MapLayoutSchema` étendu : texte, teinte ; au plus
  200 éléments propres par carte) ; reprises par les versions, l'export JSON et le mapper legacy (champ ignoré par
  l'outil historique).
- **Carte vierge** : l'assistant propose « Partir de zéro » (seulement le SMSI et le périmètre pour la vue
  contexte, les trois bandes vides pour la vue processus) ; l'état vide de l'écran affiche « Construire la carte »
  (palette ouverte) à côté de « Générer depuis la plateforme ».

## 4. Tests attendus
- Vitest `packages/shared` : schéma étendu (notes, cadres libres, limites), placement au point de dépôt, alignement
  et répartition, rangement dans un cadre.
- Vitest `apps/api` : création par type avec les doubles permissions (403 si l'une manque), identifiants au format
  du module, écriture sous verrou, événement temps réel, journal ; renommage ; aucune suppression possible.
- Playwright : parcours 21 à 32 de [RECETTE.md](RECETTE.md), clic droit, appui long (émulation tactile), Maj+F10,
  glisser-déposer depuis la palette, captures 390 / 1920 / 3840 px, aucune violation de CSP.

## 5. Points à arbitrer (défaut retenu entre parenthèses)
1. Créer depuis la carte de vrais objets de la plateforme, ou des boîtes « libres » sans lien avec les modules ?
   (**vrais objets**, enregistrés dans leur module ; les boîtes libres se limitent aux notes et aux cadres)
2. Où ranger un enjeu créé sur la carte (il n'existe aujourd'hui que dans les objectifs et les SWOT) ?
   (**dans les réglages de la carte**, `maps.settings.issues`, jusqu'à la reprise des enjeux en phase 3)
3. Supprimer un objet de la plateforme depuis la carte ? (**non**, seulement le retirer de la carte)
4. Renommer depuis la carte modifie le module d'origine ? (**oui**, avec confirmation la première fois)
