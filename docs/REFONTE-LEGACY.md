# Refonte Legacy — architecture et transmission

11 octobre 2026 · `legacy/test-lots-d-f` exclusivement. Les phases sont exécutées
selon le prompt utilisateur : audit, fondations, parcours, D2/preuves, PCRA, interface,
recette. Le diagnostic est écrit avant toute modification fonctionnelle.

## Fichiers et points d’intégration

| Fichier | Responsabilité |
| --- | --- |
| `index.html` | HTML/CSS/JS historique conservé ; hooks migration, sauvegarde, rendu et démarrage |
| `demarrer.py`, `legacy_server.py` | Serveur localhost, SQLite, sessions, contrôle des écritures et des pièces |
| `modules/integration-core.js` | Périmètres, rôles stables, responsables et relations des registres existants |
| `modules/integration-ui.js` | Formulaires partagés, comptes, classement et pont vers les anciens composants |
| `modules/server-client.js` | Source de vérité serveur, file de sauvegarde, versions et adaptateur des pièces |
| `sources/journey-steps.json`, `modules/journey-steps.js` | Définition commune des étapes, bundle navigateur généré |
| `modules/journey-core.js`, `journey-ui.js` | Sous-tâches, actions, données métier et calcul des étapes |
| `modules/finance-core.js`, `finance-ui.js` | Métadonnées financières sur `evidences`, dépôt et rattachements |
| `modules/pcra-core.js`, `pcra-ui.js` | Politiques, BIA, PCA/PRA, exercices, versions, actions et rapports |
| `modules/navigation-ui.js`, `integration.css` | Rubriques repliables, accents Sauge, clavier, responsive et thème sombre |
| `modules/df-ui.js` | Formulaires existants réutilisés pour évaluations, preuves et dossiers, périmètres structurés |
| `sources/catalogue.json`, `verification.json`, `df-sources.js` | Sources D1/HAS conservées ; D2 officiel ajouté et vérifié |
| `tests/*` | Recettes synthétiques de moteur, API, navigateur et non-régression |

Aucune dépendance d’exécution ajoutée : Python standard et bibliothèques JS
existantes. Aucun changement React/Fastify/Docker ou CI dans une autre branche.
Les sources du parcours dans `packages/shared/src/pilotage.ts` ont été consultées
sans modification. L’étape continuité s’ajoute aux étapes adaptées du parcours.

## Données et migrations

L’état JSON reste `v:1`, schéma Legacy 15, D/F 1. Les migrations transversales sont
additives et répétables : `integration.schema`, `journey.schema`, `pcra.schema` à 1.
Les champs anciens et inconnus sont conservés. Les rôles reçoivent un identifiant
stable, sans second registre fonctionnel.

- `perimeters` : hiérarchie, FINESS pertinents, relations mutualisées, références,
  responsables, statut ; jamais de rattachement organisationnel inventé.
- `roles` : IDs, titulaires/suppléants historiques, fonction, périmètres et comptes
  affectés. Les comptes d’authentification résident séparément dans SQLite.
- `journey.runs/tasks` : référence vers le registre métier, exigence/évaluation,
  responsables, due, priorité, dépendances, règles, preuves exactes, validation
  humaine et `actionId`. Les étapes sont recalculées aussi sur le serveur.
- `findings` : **plan central existant**, actions de sous-tâches et exercices.
- `evidences` : **preuves existantes**, versions et vérifications ; `financial`
  ajoute fournisseur, numéro, dates, HT/TTC en centimes, engagement et objectif.
- `df.dossiers/evaluations/budgets` : suivis CaRE/HAS conservés, périmètres par IDs.
- `pcra.policies` : échelles internes versionnées ; une version est immuable.
- `pcra.bias` : activités, impacts par horizon/dimension, interruption maximale,
  service minimum, besoins, date d’analyse, RTO/RPO métier, preuves, versions et validation.
- `pcra.plans` : type PCA ou PRA, BIA et révision sources, activités, scénario,
  déclenchement, procédures, communication, ressources, reprise, RTO/RPO techniques.
- `pcra.exercises` : plan/version, type, dates, participants, déroulement, résultats, RETEX, écarts,
  durées constatées, preuves et liens vers les actions centrales.

`perimeterIds` et `responsible:{roleId,userId}` structurent les affectations.
`objectRefs:{kind,id}` conserve les liens bidirectionnels sans copier les objets.
Les anciens établissements CRRC se relient par `perimeterId` : le nom historique
est conservé, et le libellé de compatibilité est synchronisé avec le registre commun.
La vue consolidée GHT compte les objets partagés une seule fois et garde le
contexte organisationnel pendant la navigation vers un établissement. Les SI
mutualisés restent des relations distinctes des descendants hiérarchiques.
Les anciens `scope` textuels des dossiers restent conservés ; après classement par
IDs, leur affichage dérive des périmètres. Un changement n’exige pas une seconde saisie.

SQLite `user_version=1` : tables `state`, `users`, `sessions`, `files`, `audit`.
`state` porte une version optimiste. Les fichiers sont immuables, contrôlés par taille
et SHA-256. Les comptes ne font pas partie du JSON métier. Les nouveaux comptes
conservent un mot de passe de 12 caractères minimum. Le lanceur propose désormais
le compte de recette explicitement demandé `admin` / `admin`, sans écraser un
compte existant ; `--sans-compte-test` désactive son provisionnement. Le journal serveur identifie le compte réel et
les champs modifiés ; les déclarations de responsables restent distinctes.

## API locale

| Route | Accès et comportement |
| --- | --- |
| `GET /api/session` | Installation initialisée, compte courant et nonce de session |
| `POST /api/setup` | Premier compte administrateur, localhost, une seule initialisation |
| `POST /api/login`, `/api/logout` | Authentification et révocation de session |
| `GET /api/state` | Projection selon les périmètres et droits, jamais l’état entier d’un autre établissement |
| `PUT /api/state` | Version attendue, fusion conservant les données masquées, validations et réconciliation métier |
| `GET /api/users` | Comptes utiles aux affectations autorisées ; administration voit le registre complet |
| `POST /api/users` | Création/habilitations réservées à l’administrateur, révocation des sessions après changement |
| `PUT /api/files/{id}` | Dépôt authentifié, 20 Mo maximum, identifiant immuable |
| `GET /api/files/{id}` | Vérification du périmètre de la preuve, téléchargement en pièce jointe |
| `GET /api/audit` | Dernières opérations serveur, réservées à l’administration |

Sessions de huit heures, cookies HttpOnly/SameSite Strict, mots de passe PBKDF2
avec sel et 310 000 itérations. Origine/Host et CSRF contrôlés pour les mutations.
Refus des JSON ambigus, constantes non finies et identifiants pouvant injecter
des attributs HTML. Le serveur ne sert ni bases,
répertoires Git, fichiers de configuration privés ni pièces par chemin statique.
La lecture seule est contrôlée sur l’API même après contournement de l’interface.
Les liens mutualisés ne transmettent aucun droit. Un conflit de version reçoit 409.

## Règles du parcours et continuité

Une action est créée ou rattachée une fois ; relancer l’opération retrouve son lien.
La clôture centrale actualise la sous-tâche. Les données métier, couverture, preuves,
dépendances et validation humaine restent des conditions distinctes. Les cycles de
dépendances sont refusés. Les étapes suivantes se positionnent après validation.

La validation humaine référence les données réellement examinées. Les modifications,
preuves refusées, obsolètes ou arrivées à révision rouvrent les étapes concernées.
La politique d’une sous-tâche peut exiger la version de preuve la plus récente.
Cela **ne déplace pas** les références historiques CaRE/HAS : une version ancienne
explicitement acceptée reste utilisable dans son évaluation tant qu’elle n’est pas
invalidée. Les choix de contrôles du parcours sont réservés à l’administration.
Les tâches facultatives ne bloquent pas l’étape.

Les BIA conservent les impacts temporels par activité et dimension. La synthèse
prend le niveau maximal par horizon selon la politique interne du BIA, dont les
couleurs et rangs sont configurables. Les besoins RTO/RPO métier restent distincts
des objectifs techniques du PRA. Les valeurs initiales sont des exemples internes,
pas des seuils normatifs ANS. Une évolution significative du BIA change sa révision
et signale les PCA/PRA à réexaminer ; elle ne réécrit pas leurs procédures ni décisions.
Les vues Actions et Documents PCRA lisent les registres centraux. Les rapports
PDF/Excel réutilisent BIA, plans, exercices, actions et versions exactes des preuves.
Les exercices génèrent des actions centrales sans doublon ; leur clôture ne vaut
pas validation automatique du plan ou de CaRE D2.

## Limites explicites

- Application **locale** : pas de service Internet, TLS, annuaire ou SSO ajouté.
  Ne pas exposer directement le serveur sur Internet.
- État JSON transactionnel limité à 40 Mo ; pièces 20 Mo ; sauvegarde métier ZIP
  100 Mo et 3 000 versions. Aucun qualificatif de performance pour des volumes
  hospitaliers réels n’est revendiqué sans mesure sur les jeux correspondants.
- La sauvegarde métier n’inclut ni comptes ni secrets de sessions. Déplacer le
  dossier privé complet, serveur arrêté, pour conserver toute l’installation.
- Les objets historiques non classés et les rubriques communes (`scope`, DdA,
  plan d’audit global, IA/crise globales, catalogues) restent administratifs.
  Les contributeurs utilisent les objets affectés à leurs périmètres. Les anciens
  snapshots sans cloisonnement sûr sont masqués, sans être supprimés.
- La saisie guidée couvre les registres existants et les exigences des campagnes
  CaRE/HAS. Les autres référentiels continuent à utiliser leurs menus et modèles
  historiques ; aucune grille normative absente n’est inventée. L’étape générale
  « risques » relie les objets existants et ne crée pas un second moteur de risques.
- Le kit ANS complet n’a pas pu être téléchargé depuis la page protégée. Le module
  est fondé sur les besoins BIA du prompt et les passages PCRA du guide D2 officiel
  effectivement lu ; il ne prétend pas reproduire les modèles du kit inaccessibles.
- Ni éligibilité financière, ni certification : les validations sont internes.
  Le pied de page du guide D2 et son historique donnent des versions différentes.

## Reproduire les sources

`python3 scripts/generer_etapes_parcours.py` régénère le bundle depuis les étapes
JSON communes. Pour D2, télécharger les deux PDF officiels indiqués dans
`verification.json`, exécuter `pdftotext -layout`, puis utiliser
`scripts/importer_sources_d2.py` avec le dossier de recherche. Les hashes enregistrés
permettent de vérifier les documents effectivement consultés ; le script refuse
un identifiant manquant ou un extrait trop long. Il n’affirme pas la dernière version.
