# ADR 0115 — Matrice « Qui décide quoi » des rôles et responsabilités

- Statut : acceptée (décision du RSSI du 27/11/2026, relayée par la session « Projet audit_suivi Coeur », règle 9 d'AGENTS)
- Date : 2026-11-27
- Numéro : 0115 ; migration `108`, attribués par la session « Projet audit_suivi Coeur » (`session_01ES6jrfuR1tD6Az1XDgAnS3`).
- **Complète** l'[ADR 0113](0113-matrice-raci-des-fournisseurs.md) (matrice RACI des fournisseurs), dont la grille, les lettres
  et la règle sont reprises ; droits et périmètres selon l'[ADR 0092](0092-refonte-des-droits-pyramide-des-perimetres.md) et
  l'[ADR 0095](0095-sans-rattachement-rien-ne-est-visible.md) ; libellés résolus à la lecture selon
  l'[ADR 0083](0083-porte-de-lecture-autorisee-entre-modules.md).

## Contexte

Décision du RSSI du 27/11/2026 : ajouter dans « Rôles et responsabilités » (`/pilotage/responsabilites`, famille
Organisation) un tableau « Qui décide quoi », matrice RACI des décisions de l'organisation, avec la même grille et le même
comportement que la matrice RACI des fournisseurs. Le registre « Rôles et responsabilités » d'un périmètre réunit les fiches
du Pilotage de type `governance` (`grc_objects`, référence `object:<uuid>`, rattachées à un périmètre) et, au périmètre commun
seulement, les rôles de l'outil de suivi (`app_state`, clé `roles`, référence `legacy:roles:<id>`), comme la liste du registre
(`BusinessRegistry`, `PilotageLegacy.list`).

## Décision

1. **Forme.** Lignes : décisions, saisies librement (renommables, supprimables, réordonnables), **aucune au départ** (aucun
   modèle, aucune donnée de départ). Colonnes : les rôles du registre du périmètre, **non saisis** dans la matrice : ils
   sont lus à chaque lecture (fiches non archivées du périmètre, plus les rôles de l'outil de suivi qui portent un
   identifiant au périmètre commun), dans l'ordre alphabétique, et libellés de leur nom. Une case porte au plus une lettre :
   **R** réalise, **A** approuve, **C** consulté, **I** informé ; case vide : « — », non concerné. Une colonne se renomme,
   s'ajoute ou se retire dans le registre, jamais dans la matrice.
2. **Une matrice par périmètre**, rattachée au périmètre affiché (sélecteur « Périmètre affiché »), comme le reste du
   registre. Elle est absente tant que rien n'a été enregistré : l'écran montre un tableau vide et « Ajouter une décision » ;
   le premier enregistrement la crée (`If-Match: "0"`).
3. **Règle, sans blocage** : chaque décision a exactement un A et au moins un R, la même que celle des fournisseurs.
   Le paquet partagé expose la règle d'une ligne (`regleRaci`), utilisée par `controleRaci` (fournisseurs, comportement
   inchangé) et `controleDecisionsRaci` (décisions) ; elle est appliquée par le serveur (rendue avec la matrice) et par l'écran.
   Une décision qui ne la respecte pas est signalée (« Aucun A », « Plusieurs A », « Aucun R »), l'enregistrement reste possible.
4. **Rôle retiré du registre** (fiche archivée, rôle de l'outil de suivi supprimé). La matrice des fournisseurs ne connaît
   que le retrait d'un acteur **par la personne qui saisit**, qui efface ses lettres ; ici, le rôle quitte le registre
   en dehors de la matrice, et effacer ses lettres sans le dire ferait perdre une information. La colonne reste donc
   affichée sous le libellé **« Rôle retiré »** (numéroté s'il y en a plusieurs), **ses lettres sont conservées**, ne
   comptent plus dans le contrôle (comme `controleRaci` ignore un acteur absent) et un résumé l'explique ; la personne qui
   saisit peut les effacer (bouton × de la colonne, dont les listes ne proposent plus que « — » et la lettre actuelle). Une
   fois ses lettres effacées, la colonne disparaît et le rôle ne peut plus recevoir de lettre (422). Le libellé d'un rôle
   n'est jamais recopié dans la matrice (ADR 0083, chantier 3) : un rôle retiré ne garde donc pas son ancien nom.
5. **Stockage.** Table nouvelle `responsabilites_raci` (migration additive `108`) : `smsi_id` (clé primaire, clé étrangère
   vers `grc_smsis`, `ON DELETE CASCADE`), `decisions` (jsonb, même forme que les activités de la migration `106`, contrôlée
   par la même fonction `fournisseurs_raci_elements_valides`), `cases` (jsonb `{ decision, role, lettre }`, fonction
   `responsabilites_raci_cases_valides`), `version`, `mise_a_jour_le`, `mise_a_jour_par`. Bornes, contrôlées par le schéma
   zod `MatriceDecisionsBody` et par la base : 60 décisions, 3 000 cases, identifiants et libellés comme l'ADR 0113,
   référence de rôle `object:<uuid>` ou `legacy:roles:<id>` (220 caractères, sans caractère de contrôle). L'API contrôle en
   plus qu'une case désigne une décision de la matrice, une seule lettre par case, et un rôle du registre du périmètre ou un
   rôle retiré qui y portait déjà une lettre (422). Le nombre de rôles du registre n'est pas borné.
6. **API.** `GET /api/grc/:smsi/pilotage/responsabilites/raci` (`pilotage:lire`) rend `{ matrice | null, roles, controle }`,
   `roles` étant les colonnes (`{ ref, libelle, retire }`) ; `PUT` (`pilotage:modifier`) crée la matrice avec `If-Match: "0"`
   ou la remplace avec la version courante. `If-Match` absent : 428 ; version périmée : 412 avec la version courante. Pas de
   route `DELETE` : retirer toutes les décisions vide la matrice, par le droit de modifier (comme retirer une activité de la
   matrice des fournisseurs) ; la matrice suit son périmètre (`ON DELETE CASCADE`).
7. **Droits et périmètre.** Ceux des fiches du registre : droit de lire le pilotage et accès au périmètre (404 sans
   rattachement, pyramide des périmètres, ADR 0092 et 0095) pour lire ; droit de modifier le pilotage et accès **en écriture**
   au périmètre pour enregistrer (403 en lecture seule). Contrairement à la matrice des fournisseurs, qui appartient à
   l'organisation (ADR 0032), celle-ci est cloisonnée par périmètre. Porte de lecture (ADR 0083) : le service est dans le
   module GRC (`apps/api/src/grc/raci-decisions.ts`), qui porte les primitives de lecture ; il lit les fiches du périmètre
   avec les mêmes règles que la liste du registre et l'accès vérifié du lecteur. Les fiches de rôle n'appartiennent à aucun
   registre restreint (`registreKindOf`), aucun masque ne s'y applique.
8. **Journal.** `grc.responsabilites.raci.created`, `grc.responsabilites.raci.updated`, cible
   `responsabilites-raci:<périmètre>`, détails limités au périmètre et aux nombres de lignes et de colonnes
   (`{ smsiId, lignes, colonnes }`, colonnes « Rôle retiré » comprises). Temps réel : événement `grc` du module `pilotage`,
   pour le périmètre.
9. **Contrôle des relations.** Une case dont le rôle ne désigne plus aucune fiche ni aucun rôle de l'outil de suivi est
   signalée (« matrice « Qui décide quoi » du périmètre … : rôle introuvable … »), jamais corrigée ; un rôle archivé reste une
   référence résolue, comme partout ailleurs dans ce contrôle.
10. **Écran.** Sous la liste des fiches du registre « Rôles et responsabilités » (pas de bloc « Le contexte en bref » sur
    cette page dans cette version : pas de disposition à droite), section titrée « Qui décide quoi », légende « R réalise ·
    A approuve · C consulté · I informé · — non concerné », grille commune avec la matrice des fournisseurs (`GrilleRaci`,
    `MatriceRaci.tsx`) : en-têtes de colonnes (rôles) et de lignes (décisions), une liste nommée « <décision> – <rôle> » par
    case, colonne « Contrôle », résumé des décisions à revoir (`role=status`), boutons « Ajouter une décision »,
    « Annuler les modifications » et « Enregistrer le tableau ». Lecture seule sans le droit de modifier le pilotage. Textes
    de la taille `sm` du thème (14 px) au moins, graisse 500 à 700 (classe `qui-decide-quoi`, jetons seulement, aucun style
    en ligne ni prop de style responsive, ADR 0006), valable dans tous les styles d'instance.

## Conséquences

- Migration additive `108`, aucune donnée reprise, aucune commande ; aucun flux vers l'extérieur.
- Mêmes traitements que la table `fournisseurs_raci` de l'ADR 0113 : classée dans les données de travail de la remise à vide
  (`apps/api/src/remise-a-vide.ts`), comprise dans la sauvegarde de la base ; comme pour `fournisseurs_raci`, ni l'export
  Excel ni le décompte de `controle-donnees` ne la reprennent (à décider si le besoin apparaît).
- Généralisation sans changement de comportement de la matrice des fournisseurs : `IdentifiantRaci`, `LibelleRaci` et
  `regleRaci` exportés par `packages/shared/src/raci-fournisseurs.ts` ; `GrilleRaci`, `LegendeRaci` (légende réglable) et
  `ResumeControleRaci` (mots et contrôle réglables) dans `apps/web/src/pilotage/MatriceRaci.tsx` ; `ajouterLigne` et
  `ColonneGrilleRaci` dans `apps/web/src/pilotage/raci.ts`. Les tests de la matrice des fournisseurs sont inchangés.
- Aucun jeu de démonstration (décision : aucune donnée de départ).
- Tests : contrat, colonnes et règle (`packages/shared/test/raci-decisions.test.ts`) ; droits, périmètre, colonnes du
  registre (fiches et rôles de l'outil de suivi), `If-Match`, bornes, contraintes de la base, journal, rôle retiré, contrôle
  des relations, remise à vide (`apps/api/test/responsabilites-raci.test.ts`) ; passage du contrat à la grille, saisie et
  rendu accessible (`apps/web/test/qui-decide-quoi.test.ts`).
