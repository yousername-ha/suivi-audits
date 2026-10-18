# Contrat préparatoire — récurrences, validation et preuves

Proposition du 18 octobre 2026, à consolider après validation UI/UX. Elle complète le [prompt de convergence](https://github.com/yousername-ha/suivi-audits/blob/legacy/fonctionnalites-en-developpement/_dossiers-transversaux/socle-astra/PROMPT-IMPLEMENTATION.md). L'agent d'intégration travaille uniquement dans son espace et sa branche autorisés ; Claude reste strictement en lecture seule.

## Existant consulté

Référence métier : [Claude, commit 284cb1e](https://github.com/yousername-ha/suivi-audits/tree/284cb1e4ffbaee37e0952073db5659c2257c888e), obtenu dans une copie de lecture Codex. Les chemins ci-dessous sont ceux de cet arbre. Aucun test/build n'a été lancé dans Claude.

| Besoin | Source réelle | Réutilisation / limite |
| --- | --- | --- |
| Séries et occurrences | `packages/shared/src/grc.ts`, `apps/api/src/grc/tasks.ts` | `SeriesData`, `TaskData`, clé unique série/créneau, génération transactionnelle ; ne pas remplacer ce moteur par les dates fixes de la maquette |
| Fenêtre temporelle | `GET /api/grc/:smsi/tasks/window` | Contrôle de périmètre, droit `ecarts:lire`, borne de 2 000 actions. Proposer une période plus courte si le serveur refuse |
| Réalisations d'une série | `GET /api/grc/:smsi/series/:id/occurrences` | Historique paginé ; ne pas confondre occurrences générées et projections à venir |
| Réalisation historique | `POST /api/grc/legacy-tasks/complete`, `grc/legacy-tasks.ts` | Attend `ref`, `sourceSha`, date, commentaire, preuve texte, `confirm: REALISER`, If-Match. Le serveur renseigne `by: user.username` et `createdAt`, puis journalise |
| Sources et liens | `/api/grc/:smsi/sources`, `/api/grc/:smsi/links` | Références typées et droits existants à reprendre ; pas de nouvelles copies des preuves |
| Preuve et document | `ProofData` dans `shared/src/pilotage.ts`, kind `evidence`, `routes/documents.ts` | `documentRefs` vers une version ; `POST /api/documents`, `POST /api/documents/:id/versions` et téléchargement contrôlé existent. Respecter leurs schémas, limites et permissions |
| Décisions métier | `PilotageRecord`, `apps/api/src/pilotage/service.ts` | Historique nominatif et mécanismes de décision existants ; ne pas détourner une opération de contrôle pour une occurrence de tâche sans vérifier les kinds autorisés |

**Écart confirmé :** la commande historique de réalisation consultée n'accepte pas de champ métier OK/KO/NA ni de liste de versions de preuves. `TaskData` ne fournit pas non plus cette validation nominative immuable. Les résultats `pass/fail/...` de `PilotageRecord` ne constituent pas un mapping approuvé vers OK/KO/NA ; NA n'y figure pas. Ne pas envoyer un champ `result` ignoré puis annoncer qu'il est enregistré.

Le socle enregistre déjà une identité serveur et un historique. Cela ne prouve pas que toutes les propriétés d'irréversibilité et d'unicité demandées ici sont satisfaites. Le responsable métier doit confirmer ou compléter le contrat ; aucun backend concurrent n'est créé dans cette livraison.

## Invariants à garantir côté application intégrée

1. **Occurrence précise** : une validation référence l'identifiant canonique de l'occurrence et sa série/créneau. Elle ne valide pas toute la série et ne modifie pas la cadence. Une projection n'est pas validable tant que le backend ne l'a pas matérialisée selon ses règles.
2. **Résultat explicite** : OK, KO ou NA, avec sémantique documentée. KO n'est pas une validation réussie ; NA n'est pas une tâche oubliée. La politique de preuve obligatoire et de justification NA reste à confirmer, sans seuil normatif inventé.
3. **Acteur authentifié** : identifiant de compte issu de la session serveur, avec nom/qualité affichés au moment de la validation. Ne jamais accepter le validateur fourni par le navigateur comme autorité. L'assigné de la tâche ne se substitue pas à l'acteur réel.
4. **Horodatage serveur** : enregistrer l'instant en UTC ; afficher le fuseau choisi. Séparer une éventuelle date de réalisation déclarée de l'instant réel d'enregistrement. Aucun antidatage de la trace technique.
5. **Conservation** : refuser la modification/suppression de la validation depuis les commandes applicatives et protéger cette règle au niveau du stockage et des droits. Le changement ultérieur de nom de compte ou de tâche ne doit pas réécrire la trace passée. Une éventuelle correction doit être un nouvel événement lié, jamais un écrasement ; ce parcours de correction n'est pas livré ici.
6. **Unicité et concurrence** : transaction, contrôle de version et clé d'idempotence. Deux clics, retries ou sessions ne doivent pas produire deux validations concurrentes de la même occurrence. Le contrôle local de révision de cette maquette ne remplace pas cette garantie serveur.
7. **Preuve versionnée** : rattacher un identifiant stable de preuve et la version exacte du document, avec intégrité du fichier. Une nouvelle version ne remplace pas silencieusement la pièce d'une validation historique. Le registre des preuves et la tâche lisent la même référence ; pas de copie de fichiers par occurrence.
8. **Dépôt et confirmation** : un fichier sélectionné est provisoire tant que la validation n'est pas confirmée. Prévoir le dépôt temporaire, le nettoyage des abandons et une association transactionnelle ; éviter une validation enregistrée sans la preuve annoncée ou une preuve orpheline après annulation.
9. **Permissions** : vérifier côté serveur l'accès à la tâche, au périmètre, à la preuve et à la version documentaire, en lecture comme en écriture/téléchargement. Le filtre de sélection UI ne suffit pas. Respecter les règles des membres de périmètres et modules activés.

## Structure de la maquette

- `index.html` : structure, navigation conservée et conteneurs accessibles.
- `app.js` : timeline/liste, panneau, confirmation, registre des preuves, journal et téléchargements. Labels échappés ; fichiers téléchargés sans rendu HTML de leur contenu.
- `model.js` : fixtures, stockage local, contrôle d'occurrence, sélection de preuves, auteur automatique fictif et enregistrement. `get()` retourne une copie ; aucune commande d'édition/suppression d'une validation n'est exposée.
- `timeline.css` : dispositions responsive, résultats colorés avec symboles/libellés, focus et panneau latéral. `base.css` réutilise la base visuelle ASTRA ; la copie est embarquée pour l'autonomie du ZIP.
- `technique/parcours.cjs` : parcours navigateur et génération des aperçus ; `recette.json` contient uniquement des résultats exécutés.

Les collections locales `series`, `occurrences`, `validations`, `proofs` sont un modèle de démonstration, **pas un schéma de migration ou un contrat REST**. La clé de stockage est `astra-018-timeline-v2`, séparée des autres maquettes. Le jeu initial contient 6 séries et 17 occurrences fictives, pas un programme réglementaire de contrôles. La date de repère du calendrier est le 18 octobre 2026 ; l'heure des confirmations vient de l'horloge du navigateur.

## Adaptation frontend attendue après validation

Réutiliser `@suivi/ui`, React/Mantine, le client HTTP existant et TanStack Query. Rattacher l'écran à la rubrique récurrences existante du Pilotage. Réutiliser les DTO natifs et les contrôles serveur ; ne pas créer un nouvel endpoint par ressemblance avec `model.js`. Préserver les autres modules, les chemins dynamiques cartographiques et les préférences globales Sauge/Clair.

Le formulaire doit conserver la saisie lors d'un 403/412/422 ou d'une erreur réseau, empêcher une seconde confirmation pendant l'envoi et ne présenter la lecture seule qu'après succès du serveur. Charger les preuves selon les droits réels et afficher les erreurs de dépôt. Les colonnes de tâche restent fixes pendant le défilement horizontal ; les boutons d'occurrence exposent tâche, échéance et état au clavier/lecteur d'écran. Conserver les symboles et textes en plus des couleurs.

## Recette d'intégration à exécuter dans Codex

Authentification de deux comptes distincts ; acteur non falsifiable ; horodatage serveur ; rôle lecteur refusé ; preuve hors périmètre refusée ; dépôt abandonné ; fichier indisponible ; validation avec preuve existante et nouvelle ; retries idempotents et double confirmation concurrente ; résultat NA ; conservation après modification de la série et nouvelle version de preuve ; tentative de modification/suppression refusée ; droits du téléchargement ; pagination ; clavier, petit écran, focus et contraste. Ajouter build/typage/lint et tests ciblés de l'intégration réelle. Ne pas attribuer la recette locale de cette maquette au backend.
