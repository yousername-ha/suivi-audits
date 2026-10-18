# Cartographie du SMSI — spécification pour la nouvelle application (v3)

> Exigences `CARTO-01` à `CARTO-14`, à citer dans les commits et les PR, comme celles de `docs/archive/BACKLOG-FONCTIONNEL.md`.
> Référence de comportement : le module bêta testé dans l'outil historique (`reference-beta-legacy/`),
> validé par le RSSI le 08/10/2026. Référence visuelle : `maquette/images/01` à `03`.
> La maquette (`maquette/docs/`) reste la source pour l'intention fonctionnelle ; **ce document l'emporte**
> sur elle quand ils divergent (stack, dépendances, stockage, droits).

## 1. Objectif

Un éditeur de cartes **piloté par les données de la plateforme**, pas une image :

- **Vue contexte** : SMSI au centre, cadre « Périmètre SMSI », processus et SI du périmètre à l'intérieur,
  parties intéressées à gauche, fournisseurs à droite, enjeux externes en haut, enjeux internes en bas,
  zone « Hors périmètre ».
- **Vue processus** : trois bandes (pilotage, réalisation, support), sous-processus imbriqués dans leur parent,
  flux principal entre processus, liens support / pilotage vers la réalisation.
- Même moteur pour les deux vues, cartes générées puis ajustées à la main, disposition stable dans le temps.

## 2. Principe d'architecture (non négociable)

**Données métier** (objets, relations, noms, codes, responsables, périmètre) et **présentation**
(positions, tailles, cadres, relations graphiques, masquages) sont séparées.

| Gagne | Champs |
|---|---|
| Plateforme | nom, code, type, famille, responsable, référentiels, appartenance au périmètre, relations métier |
| Carte | x, y, w, h, masqué, cadres, relations graphiques, relations métier masquées, objets ignorés |

Un renommage dans la plateforme est repris sans déplacer la boîte. Un objet supprimé reste affiché
« Objet indisponible » (dernier libellé connu) jusqu'à décision de l'utilisateur.

## 3. Exigences

### CARTO-01 — Module et droits
- Nouveau module métier `cartographie` dans `packages/shared/src/permissions.ts` (`BUSINESS_MODULES`, `MODULE_LABELS`),
  avec les 5 actions : `lire` (voir les cartes), `modifier` (générer, déplacer, relier, enregistrer, versions),
  `supprimer` (supprimer une carte ou une version), `exporter` (PNG, SVG, PDF, JSON), `administrer`.
- Rôles prédéfinis : Administrateur et RSSI tout ; Contributeur lire / modifier / exporter ; Lecteur lire / exporter ;
  Auditeur externe lire si le module lui est ouvert.
- **Lecture seule réelle** : sans `cartographie:modifier`, aucune poignée, aucun déplacement, aucun bouton d'édition ;
  le serveur refuse toute écriture (403), testé dans la matrice rôles × routes.
- Les objets affichés respectent les droits de leur module d'origine : un objet d'un module non lisible
  (ex. `fournisseurs:lire` absent) n'est **pas** envoyé au navigateur (boîte remplacée par « Objet non accessible »).

### CARTO-02 — Source des objets métier (adaptateur)
Les modules concernés ne sont pas encore repris (processus : phase 2 ; parties intéressées, SWOT, périmètre,
GAP : phase 3). La cartographie lit donc les objets via une interface unique, côté API :

```ts
interface CartoObjectSource { // apps/api/src/carto/sources/*.ts
  list(ctx: { user; permissions }): Promise<CartoObject[]>;   // objets normalisés
  relations(objects: CartoObject[]): CartoRelation[];        // relations métier dérivées
}
```

- Implémentation 1 : **état legacy recomposé** (`LegacyStore`, `app_state` + modules repris) — les mêmes règles que la bêta.
- Quand un module est repris (mapper ADR 0007), sa source passe sur les tables, **sans changer le front ni les cartes**
  (les `objectRef` restent identiques grâce aux identifiants stables du schéma 15).
- `objectRef` : `process:<code>`, `pi:<id>`, `sup:<id>`, `app:<id>`, `issue:<id>`, `site:<id>`, `infra:<id>`,
  `isms`, `scope` ; cadres propres à la carte : `lane:pil|rea|sup|oth`, `band:ext|int`, `zone:out`.
  Dans la bêta, enjeux, sites et systèmes sont repérés par un hachage du libellé : en v3, utiliser l'identifiant
  stable s'il existe (schéma 15), sinon le même hachage (fonction pure partagée, testée en parité avec la bêta).

Objets et relations repris (voir `reference-beta-legacy/CONTRAT-S-MAPS.md`) :

| Objet | Origine | Remarques |
|---|---|---|
| SMSI | organisation (Paramètres > Général) | toujours présent |
| Périmètre | `scope` | `processes` = processus inclus ; vide → « Périmètre à confirmer » |
| Processus / sous-processus | `processes` | famille → bande ; `parent` ou code `X.Y` → sous-processus ; nb objectifs, indicateurs, indicateurs KO |
| Parties intéressées | `interested` | externe / interne, catégorie |
| Enjeux | `objectives[].enjeux` (« Libellé : description ») et SWOT le plus récent par processus | forces/faiblesses = internes, opportunités/menaces = externes ; nature corrigeable (CARTO-12) |
| Applications | `appGaps` | statut Intégrée = dans le périmètre, Écartée = hors, sinon à confirmer ; fournisseur par nom |
| Sites, systèmes | lignes de `scope.sites`, `scope.systems` | dans le périmètre |
| Fournisseurs | `suppliers` | critique, HDS, SaaS |

Relations métier dérivées (lecture seule sur la carte) : processus et SI du périmètre → SMSI (`part_of`) ;
parties intéressées → périmètre (`interacts_with`) ; fournisseurs → périmètre (`supports`) ;
application → fournisseur (`depends_on`) ; enjeu → périmètre (`impacts`) ; enjeu → processus (`impacts`, secondaire) ;
processus → sous-processus (`contains`, non dessinée si imbriqué).

### CARTO-03 — Stockage des cartes
Migration `apps/api/migrations/NNN_cartographie.sql` (nouvelle migration, jamais modifier une existante) :

```sql
CREATE TABLE maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  view text NOT NULL CHECK (view IN ('context','process')),
  name text NOT NULL,
  layout jsonb NOT NULL,          -- { nodes, edges, hide, ignored } (contrat S.maps, sans versions)
  settings jsonb NOT NULL DEFAULT '{}',  -- référentiels, préréglage, relations secondaires, issueKind
  version integer NOT NULL DEFAULT 1,    -- If-Match (ADR 0004)
  created_at, created_by, updated_at, updated_by, legacy_id text, import_batch_id, extra jsonb
);
CREATE TABLE map_versions (
  id uuid PRIMARY KEY, map_id uuid REFERENCES maps ON DELETE CASCADE,
  label text NOT NULL, layout jsonb NOT NULL, created_at, created_by
);
```
- Une carte par vue au départ (`context`, `process`) ; le modèle permet plusieurs cartes par vue plus tard.
- Validation zod de `layout` dans `packages/shared` (`MapLayoutSchema`) : bornes (≤ 400 nœuds, coordonnées finies,
  tailles min 40, max 6000), types de relation connus, références de nœuds existantes.
- Drizzle : schéma à jour (le test « schéma Drizzle = base migrée » doit passer).

### CARTO-04 — API
Toutes les routes par `route()` (accès, CSRF, zod, OpenAPI), garde `requirePermission`, journal d'audit pour
enregistrement, restauration, suppression, export.

| Méthode | Route | Permission | Rôle |
|---|---|---|---|
| GET | `/api/carto/objects` | `cartographie:lire` | objets + relations dérivées, filtrés par droits |
| GET | `/api/carto/maps` / `/api/carto/maps/:id` | `lire` | carte (layout + version, ETag) |
| POST | `/api/carto/maps` | `modifier` | créer (vierge ou générée) |
| PUT | `/api/carto/maps/:id` | `modifier` | enregistrer, **If-Match obligatoire**, 412 si changée |
| GET/POST | `/api/carto/maps/:id/versions` | `lire` / `modifier` | lister / figer une version (20 au plus, la plus ancienne supprimée) |
| POST | `/api/carto/maps/:id/versions/:v/restore` | `modifier` | restaure dans la carte (nouvelle version de l'enregistrement) |
| DELETE | `/api/carto/maps/:id/versions/:v` | `supprimer` | |
| PUT | `/api/carto/settings/issue-kind` | `modifier` | nature d'un enjeu (CARTO-12) |

- Temps réel : événement SSE `map` (id, version, auteur) via LISTEN/NOTIFY, filtré par droit ; présence
  « X modifie la carte » (ADR 0005) affichée dans la barre d'outils.
- Un changement d'objet métier (processus renommé…) émet déjà ses événements : le front recharge `/api/carto/objects`.

### CARTO-05 — Génération assistée
Assistant identique à la bêta (`reference-beta-legacy/captures/1_wizard.png`) :
- Vue contexte : types (processus, sous-processus, parties intéressées, fournisseurs, enjeux externes / internes,
  applications, sites et infrastructures), origine des enjeux (objectifs, SWOT), fournisseurs (critiques/HDS et liés
  à une application, ou tous), profondeur 1 à 3 (parcours en largeur depuis SMSI et périmètre), mode
  « Remplacer la disposition » ou « Compléter (conserver les positions) ».
- Vue processus : processus, sous-processus, propositions de flux (chaîne de réalisation et de pilotage dans
  l'ordre des codes), liens support / pilotage vers chaque processus de réalisation.
- Au-delà de 80 objets : confirmation ; au-delà de 400 : refus.
- Après génération, les objets non retenus sont marqués « ignorés » (pas de bandeau « nouveaux objets » pour eux).
- Les algorithmes de disposition (`mbLayoutContext`, `mbLayoutProcess`) et de génération sont des **fonctions pures**
  dans `packages/shared/src/carto/`, testées par Vitest (mêmes positions que la bêta pour un même jeu d'entrée).

### CARTO-06 — Canevas et interactions
- Rendu **SVG en React, sans nouvelle dépendance** (pas de React Flow ni ELK : CLAUDE.md « pas de dépendance sans
  nécessité forte » ; la bêta prouve qu'un moteur SVG maison suffit). Si le développeur estime une dépendance
  indispensable, il l'argumente dans une ADR et demande l'accord avant de l'ajouter.
- Zoom molette et pincement, panoramique, ajuster à l'écran, boutons + / − / ajuster, aperçu (minimap) cliquable,
  zoom 0,2 à 2,5 ; le zoom ne modifie jamais les positions enregistrées ; viewport mémorisé par personne
  (préférences d'affichage côté serveur, ADR 0012).
- Sélection simple ; double-clic = fiche de l'objet ; Échap désélectionne.
- Recherche : met en évidence et atténue le reste, Entrée centre sur le premier résultat, compteur.
- Préréglages de vue (atténuation, positions inchangées) : contexte Globale / Périmètre / Parties intéressées / Enjeux ;
  processus Globale / Pilotage / Réalisation / Support. Filtres ISO 27001 / HDS. Relations secondaires masquées par défaut.
- Légende et chiffres clés par vue ; panneau latéral repliable ; plein écran.
- Liens : courbes en vue contexte, orthogonaux à angles arrondis en vue processus ; styles par type
  (principal plein, dépendance pointillé bleu, secondaire pointillé gris, impact orange) ; flèches selon le sens.
- Performance : 100 nœuds fluides (critère maquette), 400 utilisables ; redessin limité à `requestAnimationFrame`
  pendant le glisser.

### CARTO-07 — Mode édition
- Déplacer (un cadre — périmètre, bande, zone, processus parent — emporte les objets entièrement contenus),
  redimensionner (poignée), flèches du clavier (4 px, Maj 20 px).
- Relier deux objets (type choisi) = **relation graphique** ; supprimer une relation graphique ; masquer une relation
  métier sur cette carte ; valider une proposition (`gen`).
- Retirer de la carte (Suppr) — **ne supprime jamais l'objet métier** ; taille par défaut ; disposition automatique
  (confirmation, annulable).
- Annuler / rétablir (Ctrl+Z, Ctrl+Y / Maj+Ctrl+Z), 60 niveaux.
- Enregistrement explicite (« Modifications non enregistrées »), proposition d'enregistrer en quittant l'édition,
  alerte avant de quitter la page.
- Conflit 412 : afficher « La carte a été modifiée par X » avec « Recharger » et « Écraser » (Écraser = nouvelle
  requête avec la version courante, réservée à `cartographie:modifier`, journalisée).

### CARTO-08 — Synchronisation
À chaque ouverture et à chaque événement temps réel métier :
- bandeau « N nouveaux objets » (non présents, non ignorés) → « Choisir et ajouter » ou « Ignorer » ;
- bandeau « N objets indisponibles » → « Retirer de la carte » ;
- **jamais** d'ajout ni de repositionnement automatique.

### CARTO-09 — Ajout depuis la plateforme
Liste filtrable par type, cases à cocher, « l'objet seul / et ses dépendances directes / et tous les objets liés » ;
placement près d'un voisin déjà sur la carte, sans chevauchement, sinon à droite de l'ensemble.

### CARTO-10 — Fiche détaillée (inspecteur)
Panneau à droite (bas d'écran sur téléphone), selon le type :
- processus : type/famille, périmètre, responsable, référentiels, parent / sous-processus, objectifs liés,
  indicateurs avec état, SWOT (date, nombre d'éléments), relations ; liens vers les écrans du module ;
- partie intéressée : nature, catégorie, besoins, exigences, prise en compte, revue ;
- fournisseur : SaaS, HDS, critique, SSO, MFA, certifications, applications liées ;
- application : statut, fournisseur (cliquable), données de santé, hébergement ;
- enjeu : description, nature (modifiable), origine (objectif / SWOT), processus concernés ;
- périmètre, SMSI, cadres, objet indisponible ; relation : type, origine, destination, nature (métier, graphique,
  proposition).
Les liens ouvrent l'écran v3 du module s'il est repris, sinon `/legacy` à la bonne rubrique.

### CARTO-11 — Versions
« Enregistrer une version » (libellé, ex. « Revue de direction 2026 »), liste, restauration (devient la carte courante
après enregistrement), suppression (`supprimer`). 20 versions au plus par carte.

### CARTO-12 — Nature des enjeux
Nature interne / externe déduite (règle de la bêta), corrigeable dans la fiche ; stockée dans `maps.settings.issueKind`
tant que les enjeux n'ont pas de table propre (à migrer vers un champ de l'enjeu en phase 3).

### CARTO-13 — Exports
PNG (×2, plafonné à 36 Mpx), SVG, PDF A3 paysage, disposition JSON ; titre, organisation, date, référentiels et légende
inclus. Côté navigateur dans un premier temps (la bêta génère le PDF sans bibliothèque) ; bascule possible sur le moteur
d'export serveur de la phase 3. Permission `cartographie:exporter`, export journalisé.

### CARTO-14 — Reprise legacy et transition
- `S.maps` (clé de premier niveau, voir contrat) est repris par un `ModuleMapper` « maps » : `context` et `process`
  → `maps` (+ `map_versions`), `issueKind` → `settings`. Mise à jour de `docs/legacy/MAPPING-LEGACY.md`,
  `LEGACY-FORMAT.md` (nouvelle clé `maps`), test d'aller-retour sur la fixture (ajouter une carte fictive à
  `tests/fixtures/legacy-fixture.json`).
- Une fois le module repris, `/legacy` affiche la cartographie en lecture seule (« Module géré dans la nouvelle
  interface ») et le serveur refuse ses écritures (409), comme les autres modules repris.

## 4. Charte, écrans, accessibilité
- Couleurs et espacements uniquement par jetons `packages/ui` (le test `apps/web/test/charte.test.ts` interdit les
  valeurs codées en dur) : ajouter des jetons « carte » (marine SMSI, bleu interne, violet externe, orange enjeux,
  vert support, gris hors périmètre) en clair et en sombre, contrastes AA vérifiés.
- CSP stricte : aucun `style=` (y compris dans le SVG : utiliser attributs SVG et classes), aucun script en ligne.
- Écrans : canevas qui occupe la hauteur disponible ; < 900 px : panneaux sous le canevas, inspecteur en feuille basse ;
  ≥ 2560 px : inspecteur ouvert en permanence ; captures 390, 1920, 3840 px. Écran mural : carte en lecture seule
  possible sur `/mur` (option).
- Clavier : objets focusables (Tab), Entrée = fiche, flèches = déplacement en édition ; libellés ARIA ; textes
  alternatifs des exports.

## 5. Tests attendus
- Vitest `packages/shared` : relations dérivées, dispositions (instantanés de positions), génération et profondeur,
  synchronisation (nouveaux, indisponibles), ancrages et tracés de liens, validation `MapLayoutSchema`, hachage
  (parité bêta).
- Vitest `apps/api` : routes et matrice des droits, If-Match / 412, versions (limite 20), filtrage des objets par droits
  de module, événements SSE, mapper legacy (aller-retour), migration.
- Playwright : parcours de `RECETTE.md`, captures 390 / 1920 / 3840, aucune violation CSP, lecture seule.

## 6. Points à arbitrer (défaut retenu entre parenthèses)
1. Relations entre processus : données métier (table `process_relations`) ou graphiques ? (**graphiques**, propositions `gen`)
2. Qui modifie l'appartenance au périmètre ? (**écran Périmètre**, pas la carte)
3. Nature des enjeux : champ métier ? (**`settings.issueKind`** jusqu'à la phase 3)
4. Versionnement automatique en plus des versions explicites ? (**non**, historique par l'audit)
5. Export PDF = preuve documentaire ? (**support visuel** ; référence documentaire si besoin plus tard)
6. Plusieurs cartes par vue (par site, par offre CRRC) ? (**une par vue**, modèle prêt)
7. ISO 9001 dans les filtres ? (**non**, ISO 27001 et HDS)
