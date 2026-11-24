# ADR 0113 — Matrice RACI des fournisseurs

- Statut : acceptée (décision du RSSI du 23/11/2026 ; maquette de l'écran validée le 23/11/2026)
- Date : 2026-11-23
- Numéro : 0113 ; migration `106`, réservée par la session « Projet audit_suivi Coeur » (`session_01ES6jrfuR1tD6Az1XDgAnS3`).
- **Complète** l'[ADR 0032](0032-fournisseurs-de-l-organisation.md) (fournisseurs de l'organisation) et
  l'[ADR 0098](0098-criteres-rattaches-aux-fournisseurs.md) (critères rattachés) ; droits de suppression selon
  l'[ADR 0068](0068-suppressions-reservees-au-droit-supprimer.md).

## Contexte

Décision du RSSI du 23/11/2026 : « Dans la gestion des fournisseurs, on doit pouvoir déclarer une matrice RACI » pour chaque
fournisseur, sous la forme **activités × acteurs**. Le registre des fournisseurs est celui de l'état historique (`app_state`,
objets `suppliers[]`, référence `legacy:suppliers:<id>`), au contrat figé (`packages/shared/src/legacy/contract.generated.ts`,
tests de parité) : la matrice ne peut pas y être ajoutée.

## Décision

1. **Forme.** Lignes : activités ; colonnes : acteurs. La colonne du **fournisseur** est présente d'office, libellée de son nom
   (elle suit un renommage), ni renommable ni supprimable ; elle porte l'identifiant réservé `fournisseur`. Les autres colonnes
   sont des fonctions de l'établissement, renommables et supprimables. Activités renommables, supprimables et réordonnables ;
   ajout libre de lignes et de colonnes. Une case porte au plus une lettre : **R** (réalise), **A** (approuve, rend des
   comptes ; un seul par activité), **C** (consulté avant), **I** (informé après) ; case vide : « — », non concerné.
2. **Modèle de départ.** Activités : Application des correctifs de sécurité ; Sauvegardes et restauration ; Gestion des accès et
   des comptes ; Surveillance et supervision ; Gestion des incidents de sécurité ; Gestion des changements ; Réversibilité et
   fin de contrat. Acteurs : le fournisseur, RSSI, DSI, Référent métier. Le modèle est fixé dans le code
   (`packages/shared/src/raci-fournisseurs.ts`) ; la matrice créée à partir de lui est entièrement modifiable.
3. **Une matrice par fournisseur**, absente tant qu'on ne l'a pas créée (bouton « Créer la matrice RACI », qui enregistre le
   modèle sans aucune lettre).
4. **Règle, sans blocage.** Chaque activité doit avoir exactement un A et au moins un R. La règle est une fonction pure du
   paquet partagé (`controleRaci`), appliquée par le serveur (rendue avec la matrice) et par l'écran ; une activité qui ne la
   respecte pas est signalée en texte (« Aucun A », « Plusieurs A », « Aucun R »), l'enregistrement reste possible.
5. **Stockage.** Table nouvelle `fournisseurs_raci` (migration additive `106`) : `fournisseur_id` (clé primaire, identifiant du
   registre, sans clé étrangère possible), `activites`, `acteurs`, `cases` (jsonb), `version`, `mise_a_jour_le`,
   `mise_a_jour_par`. Bornes, contrôlées par le schéma zod `MatriceRaciBody` et par des contraintes de la base : 60 activités,
   15 fonctions de l'établissement en plus de la colonne du fournisseur, 960 cases, identifiants en minuscules, chiffres et
   tirets (40 caractères), libellés de 1 à 200 caractères sans caractère de contrôle (nettoyés par l'API). Les références des
   cases vers les lignes et les colonnes, l'unicité des identifiants et d'une lettre par case sont contrôlées par l'API (422).
6. **API.** `GET /api/suppliers/:id/raci` (`fournisseurs:lire`) rend `{ matrice | null, controle }` ;
   `PUT /api/suppliers/:id/raci` (`fournisseurs:modifier`) crée la matrice avec `If-Match: "0"` ou la remplace avec la version
   courante ; `DELETE /api/suppliers/:id/raci` exige `fournisseurs:supprimer` (ADR 0068 : toute suppression d'un
   enregistrement exige le droit « supprimer » ; le Contributeur prédéfini ne supprime donc pas une matrice) et `If-Match`.
   `If-Match` absent : 428 ; version périmée : 412 avec la version courante (convention du dépôt, `http/concurrency.ts`).
   Fournisseur absent du registre : 404 en lecture et en écriture. Comme la liste et les évaluations, la matrice appartient à
   l'organisation : aucun cloisonnement par périmètre (ADR 0032).
7. **Journal.** `supplier.raci.created`, `supplier.raci.updated`, `supplier.raci.deleted`, cible `legacy:suppliers:<id>`, détails
   limités aux nombres de lignes et de colonnes (`{ lignes, colonnes }`, colonne du fournisseur comprise). Temps réel :
   événement `grc` du module `fournisseurs`, comme les autres écritures du registre.
8. **Fournisseur retiré du registre.** La matrice est ignorée (404), signalée par le contrôle des relations (« matrice RACI :
   fournisseur absent du registre ») et peut être supprimée (`DELETE`, droit « supprimer ») ; si l'identifiant est réattribué à
   un nouveau fournisseur (le registre réutilise le plus grand numéro libre), la matrice orpheline est effacée dans la
   transaction de création (`supplier.raci.orphan_deleted`), pour ne pas passer au nouveau. La remise à vide l'efface avec les
   données de travail. Aucun crochet n'est ajouté aux chemins d'écriture de l'état historique (import, outil de suivi).
9. **Écran.** Fiche du fournisseur, onglet « Machines et responsabilités » (maquette validée par le RSSI) : section
   « Matrice RACI » (`data-fiche-section`), légende, tableau à en-têtes de colonnes (acteurs) et de lignes (activités), une
   liste nommée « <activité> – <acteur> » par case (R / A / C / I / —), colonne « Contrôle », résumé des activités à revoir
   (`role="status"`), boutons « Ajouter un acteur » et « Ajouter une activité », enregistrement et suppression. Lecture seule
   sans le droit de modifier. L'emplacement de la section « Groupes de machines maintenus », au-dessus de la matrice, est
   réservé à la session Vulnérabilités (migration `105`) et n'est pas rempli ici.
10. **Démonstration.** Le jeu fictif crée deux matrices par la route publique : l'hébergeur fictif (conforme) et le logiciel de
    dossiers fictif (deux activités à revoir).

## Conséquences

- Migration additive `106`, aucune donnée reprise, aucune commande ; le contrat de l'état historique est inchangé.
- La table est classée dans les données de travail de la remise à vide (`apps/api/src/remise-a-vide.ts`).
- Modèle de départ réglable par l'organisme : non prévu (le modèle est dans le code) ; à décider si le besoin apparaît.
- Tests : règle, bornes et modèle (`packages/shared/test/raci-fournisseurs.test.ts`) ; droits, `If-Match`, bornes, contraintes de
  la base, journal, fournisseur retiré, remise à vide (`apps/api/test/fournisseurs-raci.test.ts`) ; jeu de démonstration
  (`apps/api/test/jeu-de-test.test.ts`) ; saisie et rendu accessible (`apps/web/test/fournisseurs-raci.test.ts`).
