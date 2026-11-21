# ADR 0111 — Tâches d'une action et avancement

- Statut : acceptée (version 7.5.0)
- Date : 2026-11-21
- Numéro : 0111, réservé auprès de la session « Projet audit_suivi Coeur ».
- Contexte : décision du RSSI pour la 7.5.0, sur maquette validée (fiche d'une action avec ses tâches, frise du plan
  d'actions aux tubes remplis), appuyée par la session Coeur pour les droits. Une action du plan se découpe souvent en
  quelques étapes (inventorier, choisir, déployer…) : le RSSI veut les suivre dans la fiche et voir l'avancement dans la
  frise, sans créer d'action de plus ni changer le modèle des droits ([ADR 0092](0092-refonte-des-droits-pyramide-des-perimetres.md)).

## Décision

1. **Données.** Le champ facultatif `taches` s'ajoute aux données d'une action (`TaskData`,
   `packages/shared/src/grc.ts`) : un tableau d'au plus **50** tâches, chacune un objet strict
   `{ id (uuid), intitule (texte d'une ligne, caractères de contrôle et espaces superflus retirés, 1 à 200 caractères),
   faite (booléen), responsable (même type que celui de l'action, facultatif, nul permis), echeance (date AAAA-MM-JJ ou nul) }`.
   Les identifiants sont uniques dans l'action. Tout champ inconnu, tout volume ou toute valeur hors bornes est refusé
   (422). Champ absent : aucune tâche.
2. **Pas de migration, pas de reprise.** Les tâches vivent dans le JSON de l'action (`grc_objects.data`) : aucune
   migration SQL, aucune reprise de données (consigne du 14/11/2026). La limite de 256 Ko d'une fiche reste en vigueur.
3. **Droits.** Le responsable d'une tâche est un **simple affichage** : il ne vaut pas « Attribuer à »
   ([ADR 0092](0092-refonte-des-droits-pyramide-des-perimetres.md), lot 2) et n'ouvre l'action à personne. L'accès ne lit
   que `ownerId` et `responsable` de l'action, jamais ceux de ses tâches. Seul qui peut déjà modifier l'action ajoute,
   modifie, coche ou supprime ses tâches, par la mise à jour existante (version et `If-Match`) ; la contribution d'une
   personne attribuée reste limitée à l'état et à la justification. Une désignation nouvelle ou changée est contrôlée
   (compte actif, groupe ou fonction existants) ; une désignation déjà enregistrée ne bloque pas la mise à jour.
4. **Avancement sans clôture automatique.** L'avancement est le nombre de tâches faites sur le total, en pourcentage
   arrondi. Cocher toutes les tâches **ne termine pas** l'action : l'état reste celui du parcours de la politique.
5. **Fiche de l'action.** Section « Tâches » : « n faites sur N », barre d'avancement avec le pourcentage, liste (case à
   cocher, intitulé barré si faite, responsable en initiales avec le sélecteur de responsable existant, échéance en
   rouge gras si dépassée et non faite, menu ⋯ Modifier / Supprimer), champ « Nouvelle tâche… » et bouton « Ajouter ».
   Les tâches s'enregistrent avec la fiche ; lecture seule sans droit de modifier. Pas de section pour une occurrence de
   tâche récurrente.
6. **Frise du plan d'actions.** Le tube garde exactement son style ; la part faite y est une partie plus foncée de la
   même teinte. « n/N · p % » s'écrit au bout du tube quand il y a la place, sinon dans l'infobulle, qui ajoute toujours
   « Tâches : n/N (p %) ». Sous le tube, nettement en dessous, un fil fin et un petit losange par tâche datée, à son
   échéance : vide à faire, vert faite, rouge en retard (échéance passée, non faite), avec son infobulle (intitulé,
   responsable, échéance, état). La légende cite « Tâche à faire », « Tâche faite » et « Tâche en retard » seulement s'il
   y a des tâches datées. Une action sans tâche garde son tube inchangé.

## Conséquences

- Les lectures génériques des données d'action restent sûres : l'assistant n'en lit que des champs choisis (les tâches
  n'en sortent pas), l'historique des versions garde l'instantané complet et n'affiche que version, auteur et motif, les
  recherches textuelles sur le JSON (usages d'un document, références à un référentiel) restent exactes, et l'export
  Excel du suivi n'inclut pas les actions du plan.
- Tests : schéma et avancement (`packages/shared/test/taches-action.test.ts`), repères et infobulles de la frise
  (`apps/web/test/frise-actions.test.ts`), bornes et droits par l'API (`apps/api/test/taches-action.test.ts`).
