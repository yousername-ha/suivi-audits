# Import des données de l'outil « legacy » — spécification

> Objectif : alimenter la nouvelle application directement à partir du fichier JSON de l'outil historique (artefact claude.ai ou `/legacy`), sans ressaisie, et garder les deux formats compatibles pendant toute la transition.

## 1. Fichiers de référence (dans `docs/legacy/` et `tests/fixtures/`)

| Fichier | Rôle |
|---|---|
| `LEGACY-FORMAT.md` | Contrat du format : tous les chemins JSON du schéma 14, leurs types et effectifs, **sans aucune valeur**. Il liste aussi les listes d'objets sans identifiant stable. |
| `legacy-fixture.json` | Jeu de test **anonymisé** qui reprend la structure réelle : 3 éléments maximum par liste, identifiants remplacés de façon cohérente, textes libres remplacés par `[clé]`. Les référentiels sont conservés. |
| `MAPPING-LEGACY.md` | À produire : correspondance de chaque chemin vers `table.colonne`, `extra` ou « ignoré », avec la justification. |

Les fichiers acceptés en entrée :
- la sauvegarde JSON de l'outil (Paramètres → Sauvegarde, `suivi-audits-smsi-sauvegarde-AAAAMMJJ.json`) ;
- le fichier `data/state.json` de l'artefact ;
- l'export « enveloppe » décrit au § 3.

## 2. Côté nouvelle application

### Processus d'import (administrateur uniquement)
1. **Dépôt** du fichier : 50 Mo maximum, JSON uniquement. Le fichier brut est conservé chiffré, avec son empreinte SHA-256.
2. **Validation** par un schéma zod (`packages/shared/legacy`) :
   - schéma 14 ou 15 accepté ;
   - schéma plus ancien refusé, avec le message : « Ouvrez ce fichier dans l'outil legacy, puis réexportez-le » ;
   - tout chemin inconnu du contrat est signalé.
3. **Simulation**, sans aucune écriture en base. Le rapport donne, par module :
   - les éléments créés, modifiés, inchangés, ignorés ;
   - les références cassées, par exemple un écart qui cite une mesure inexistante ;
   - les champs inconnus.

   Le rapport est consultable à l'écran et téléchargeable.
4. **Confirmation** par l'administrateur, avec choix du mode :
   - **Initialiser** : base vide uniquement ;
   - **Fusionner** : création ou mise à jour selon l'identifiant legacy, sans aucune suppression ;
   - **Remplacer un module** : supprime les éléments du module absents du fichier, avec une confirmation renforcée.
5. **Application** en une seule transaction :
   - une sauvegarde automatique est faite juste avant ;
   - l'import est enregistré dans le journal d'audit ;
   - des événements temps réel sont émis vers les utilisateurs connectés ;
   - un import peut être **annulé** tant qu'aucune modification ultérieure n'a touché les mêmes éléments.

### Traçabilité en base
- Table `import_batches` : identifiant, fichier, SHA-256, taille, auteur, date, mode, modules, rapport (jsonb), fichier brut chiffré.
- Sur chaque table métier :
  - `legacy_id`, qui est la clé de correspondance (unique par table) ;
  - `import_batch_id` ;
  - `extra jsonb`, qui reçoit les champs legacy non modélisés pour **ne rien perdre**.

### Export vers le format legacy
- `GET /api/admin/export/legacy` produit un JSON au schéma 15, relisible par l'outil legacy.
- Test aller-retour obligatoire dans la CI : on importe `legacy-fixture.json`, on réexporte, et le résultat doit être **identique** après normalisation (ordre des clés et des listes).

### Contrôle de couverture dans la CI
Un test lit `LEGACY-FORMAT.md` et échoue si un chemin du contrat n'est pas traité dans `MAPPING-LEGACY.md`, que ce soit vers une colonne, vers `extra` ou comme « ignoré » justifié.

## 3. Côté outil legacy (mise à jour nécessaire)

Il faut appliquer la même modification à `app/public/index.html` (servi sous `/legacy`) **et** à l'artefact claude.ai :

1. **Migration vers le schéma 15** : ajout d'un identifiant stable (`id`) aux éléments des listes qui n'en ont pas.

   | Liste | Préfixe |
   |---|---|
   | `findings[].tasks` | `TK-` |
   | `indicators[].values` | `IV-` |
   | `ai.plan` | `AP-` |
   | `ai.policies` | `AL-` |
   | `plan.slots[].proofs` | `PR-` |
   | `reviews[].cs.inc.focus` | `RF-` |
   | `reviews[].cs.sujet` | `RS-` |
   | `crisis.cells[].log` | `CL-` |
   | `roles` | `RO-` |

   L'identifiant est attribué une fois, puis conservé. Les nouveaux éléments créés dans l'outil en reçoivent un dès leur création.
2. **Export « enveloppe »** (nouveau bouton « Exporter pour la nouvelle version ») :
   ```json
   { "format": "suivi-audits-legacy", "formatVersion": 1, "schema": 15,
     "exportedAt": "…", "appVersion": "…", "sha256": "<empreinte de data>", "data": { … } }
   ```
   L'import accepte aussi l'ancien format brut, sans enveloppe.
3. Aucune autre modification fonctionnelle.

## 4. Pendant la transition : une seule source de vérité par module

- **Module pas encore repris** : les données vivent dans l'état legacy (`app_state`), et `/legacy` les modifie comme aujourd'hui.
- **Module repris** : les données vivent dans les tables.
  - `/legacy` les **affiche** à partir des tables : l'état servi à `/legacy` est recomposé à partir des tables et de l'état legacy.
  - `/legacy` ne peut plus **les modifier**. Le serveur refuse les changements qui les concernent, et l'interface affiche « Module géré dans la nouvelle interface ».
- Au moment de reprendre un module, l'import « Remplacer le module » transfère ses données de l'état legacy vers les tables, puis le module bascule.

Il n'y a jamais deux sources modifiables pour la même donnée, donc aucune divergence possible.

## 5. Découpage
- **Phase 0** :
  - contrat, schéma zod, tables `import_batches` et colonnes `legacy_id`, `import_batch_id`, `extra` ;
  - écran d'import (dépôt, simulation, confirmation, annulation), export legacy, tests de couverture et d'aller-retour sur les modules déjà présents ;
  - migration du schéma 15 et export enveloppe côté legacy.
- **Phases 1 à 3** : chaque phase ajoute les correspondances (« mappers ») de ses modules, leurs tests d'aller-retour, et bascule ces modules en lecture seule dans `/legacy`.
