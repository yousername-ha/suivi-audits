# ADR 0045 — Parcours guidé ISO 27001 / HDS (dossier 024)

- Statut : acceptée
- Date : 2026-10-25
- Contexte : dossier 024 (référence de conception v011), [ADR 0006](0006-front-react-mantine-csp-stricte.md) (CSP stricte), [ADR 0043](0043-registres-perimetres-herites-et-droits-par-ressource.md) (droits).

## Décision

Le parcours est une **vue de navigation** sous Pilotage (`/pilotage/parcours-iso`), pas un registre. Il ajoute :

- un catalogue de contenu dans `packages/shared/src/parcours-iso.ts` (16 étapes, 26 sous-actions, 11 raccourcis, 5 compléments HDS, sources et limites) ; aucune table, aucune migration, aucune route ;
- une vue Arbre (SVG à repère fixe 1109 × 737, défilement horizontal en dessous de 62 rem), une vue Liste (mêmes identifiants) et une fiche détaillée (fenêtre) ;
- la relecture, pour le périmètre affiché, des fiches que les modules tiennent déjà (`GET /api/grc/:smsi/objects?kind=…`, déjà filtrée par droits, périmètres et registres restreints) ;
- l'ouverture d'une fiche dans son module par le mécanisme existant `?ouvrir=<id>&perimetre=<id>&retour=<chemin>` ;
- une préférence d'affichage par personne (`parcoursIso` : vue, compléments HDS, mouvement) dans `/api/account/preferences`, sans stockage navigateur.

Ce que le parcours **ne fait pas** : il n'écrit aucune donnée métier, ne calcule aucun état d'avancement ni de conformité, ne verrouille aucune étape. Une étape parcourue, une preuve attachée ou une action close n'établit ni revue, ni conformité, ni certification. ISO/IEC 27001 n'impose ni l'ordre proposé ni EBIOS RM. La cartographie dynamique n'est pas touchée.

## Pourquoi sans modèle de progression

Le dossier interdit de simuler un historique avec le navigateur et ne prescrit aucun modèle serveur. Les modules portent déjà l'état réel (statut des fiches, journaux immuables, validations). Un état « parcouru » propre au parcours serait un second registre qui divergerait des modules. Il n'est donc pas créé ; le besoin éventuel est consigné dans les écarts ci-dessous.

## Mouvement et accessibilité

Animations (flux des branches, brume ascendante, apparition des sous-actions) en CSS seul, déclenchées par `data-anime` et `data-visible`, sans script ni style en ligne (CSP). Trois réglages : « Animées », « Automatiques » (suit `prefers-reduced-motion`), « Arrêtées » ; l'onglet masqué suspend l'animation. Le fond Gondor est décoratif et ne capte aucune interaction. Clavier : cercles et boutons de sous-actions focalisables (Entrée / Espace), Échap ferme la fiche, puis la carte ; le focus revient à l'élément d'origine. Placement des sous-actions calculé par `geometrie.ts` : aucune ne recouvre un nœud ni une autre sous-action (test unitaire sur les 11 raccourcis, avec et sans HDS, et test de collision dans le navigateur).

## Relevé d'existant et état final (SHA de la branche à renseigner à la livraison)

Avant ce chantier, rien n'existait pour 024 : ni route, ni composant, ni contenu ; seules des rubriques de modules isolées (Contexte, Risques, Audits, Revue de direction, etc.) servaient de destinations.

| ID | Avant | Après (code exécutable) | Preuve | État | Écart / action |
|---|---|---|---|---|---|
| F01 Arbre et liste | absent | `Arbre.tsx`, `ListeEtapes.tsx`, catalogue partagé | `parcours-iso.test.ts` (16/26/11, identifiants uniques), e2e « arbre, carte… » | Livré | — |
| F02 Sous-actions et attendu | absent | `CarteCompacte.tsx`, `FicheEtape.tsx`, `SousActionDetail.tsx` | e2e (clavier, attendu, focus rendu) | Livré | Une seule branche développée à la fois ; le dépliage « écarte » les éléments par placement calculé, pas par l'animation d'écartement de v011 |
| F03 Rejoindre les modules | rubriques existantes | `destinations.ts` : `?ouvrir`, `perimetre`, `retour` | test de navigation (toute destination existe), e2e « ouverts dans leur module » | Livré | Création depuis le parcours : non faite, le parcours ouvre le module qui crée |
| F04 Répercuter les travaux | absent | `travaux.ts` ; l'invalidation SSE `['grc', …]` rafraîchit aussi les relevés | e2e (action créée dans le périmètre retrouvée, absente d'un autre périmètre) | Livré, rafraîchissement en direct non testé dans le navigateur | Modules sans type de fiche (fournisseurs, plans de formation) : pas de compteur |
| F05 Retrouver l'existant | absent | idem, ouverture par identifiant | e2e par périmètre | Partiel | Pas d'association explicite lorsque plusieurs candidats existent : seul le nombre et les premiers éléments sont proposés ; aucun contrat serveur d'association par sous-action |
| F06 Avancement ≠ conformité | absent | aucun statut calculé ; mentions explicites | e2e (aucun libellé « conforme » ou « revu » calculé), `parcours-iso.test.ts` | Livré | — |
| F07 Preuves | registre de preuves existant | renvoi vers les modules et le registre | — | Partiel | Pas d'association de preuve depuis le parcours : aucun contrat d'association par sous-action n'existe ; à définir avec le responsable métier avant toute écriture |
| F08 Périmètre | existant | sélecteur de périmètre, clé de cache par périmètre | e2e par périmètre (ancien périmètre non conservé) | Livré | — |
| F09 Compléments HDS | absent | interrupteur d'affichage par personne (16 étapes avec les compléments, 11 sans) | e2e HDS visible/masqué + rechargement | Partiel | Affichage seul : l'applicabilité réelle (activités, décisions du périmètre) n'est pas lue ; masquer ne change aucune donnée |
| F10 Expérience v011 | absent | arbre, flux, brume, carte, liste, mouvement, mobile | e2e animations/mouvement réduit/mobile, axe-core | Partiel | Fond Gondor et jetons repris ; carte compacte pouvant être rognée sur très petit écran (la fiche détaillée reste complète) |

| Scénario | Verdict |
|---|---|
| INT-01 Raccourcis et étapes dans Arbre et Liste | Couvert (e2e) |
| INT-02 Dépliage clavier/tactile, collisions, mouvement réduit | Couvert (e2e, tactile non testé sur appareil physique) |
| INT-03 Périmètre, rechargement, changement de périmètre | Couvert (e2e) |
| INT-04 Création/modification dans le module puis relecture | Partiel : relecture couverte ; aucune création depuis le parcours |
| INT-05 Preuve réelle par identifiant/version, 403 | Non couvert : voir F07 ; le refus 403 est couvert pour les relevés (état « refusé », jamais un zéro) |
| INT-06 Erreurs, conflits de version | Partiel : lecture seule, donc pas de conflit d'écriture ; erreur et refus affichés |

## Contrats manquants (à décider par le responsable métier)

1. Association explicite d'une fiche existante à une sous-action (F05) et d'une preuve (F07) : aucune table ni route n'existe ; la proposer exigerait un modèle d'association versionné et journalisé.
2. Lecture de l'applicabilité HDS réelle (F09) : activités et décisions par périmètre à brancher quand le contrat existe.
3. Compteurs pour les modules sans type de fiche GRC.

## Conséquences

- Aucune migration ; aucune route ; le schéma des préférences gagne une clé optionnelle (compatibilité ascendante, valeur par défaut `{}`).
- `IMPLEMENTATION-OK` n'est pas posé : trois capacités restent partielles (F05, F07, F09) et la recette sur appareil tactile n'a pas été faite.
