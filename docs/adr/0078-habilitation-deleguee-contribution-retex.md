# ADR 0078 — Habilitation déléguée sur un objet : contribution à un RETEX

- Statut : proposée (numéro confirmé par le RSSI le 30/10/2026 ; décision à accepter après relecture de la PR)
- Date : 2026-10-30
- Contexte : le retour d'expérience (RETEX) d'un incident doit rassembler ce qu'ont vécu des personnes d'autres pôles
  (exploitation, communication, métiers) qui n'ont, le plus souvent, **aucun droit sur le module Incidents**. Les droits
  de l'application sont attribués par module ([ADR 0010](0010-droits-rbac.md)) ou par ressource réservée
  ([ADR 0067](0067-attribution-des-droits-par-ressource-reservee.md)) ; aucun ne permet d'autoriser une personne sur **un
  seul** incident, pour une seule action (proposer des éléments), le temps d'une collecte. Donner le droit de lecture des
  incidents à ces personnes leur ouvrirait tout le registre, y compris les incidents de sécurité et leurs obligations
  réglementaires. Le RETEX est stocké dans l'incident, dans l'état historique (`app_state`, modèle de l'ADR 0032).

## Décision

1. **Deux habilitations distinctes.** Le **pilote** agit avec le droit `incidents:modifier` (ouverture, invitations,
   relances, file à valider, récupération, clôture, diffusion) : routes `/api/incidents/:id/retex/...` déclarées avec cette
   permission et écrites par `RegistreHistorique.modifier`. Le **contributeur** n'a **aucun droit de module** : il est
   habilité sur un seul RETEX parce que son compte figure dans la liste `retexCollecte.contributeurs` de l'incident, posée
   par le pilote. Cette habilitation n'est pas un droit : elle n'apparaît ni dans les rôles, ni dans les droits par
   ressource, et disparaît quand le pilote retire la personne.
2. **Routes en accès `auth`.** Les six routes du contributeur (`GET /api/retex/invitations`, `GET /api/retex/:id`,
   `POST /api/retex/:id/propositions`, `PATCH` et `DELETE /api/retex/:id/propositions/:pid`, `PUT /api/retex/:id/terminee`)
   sont déclarées par `route()` avec l'accès `auth` : session complète, double authentification comprise, CSRF et origine
   contrôlés, corps validés par zod. Elles sont ajoutées à la **liste explicite** des routes sans permission de module de
   `apps/api/test/rbac.test.ts`, qui échoue pour toute route `auth` non justifiée.
3. **Écriture déléguée sous verrou.** `RegistreHistorique.modifierDelegue(user, ip, cible, autoriser, appliquer)` reprend
   exactement `modifier` (activation du module, transaction, verrou de l'état, contrôle de version, journal d'audit,
   notification temps réel) en remplaçant le contrôle du droit de module par `autoriser(data)`, appelé **sous verrou, sur
   l'état courant**, avant `appliquer`. Pour le RETEX, `autoriser` vérifie que la personne est contributrice et que la
   collecte est ouverte ; un retrait ou une clôture concurrents sont donc pris en compte. Une proposition d'un autre
   contributeur est traitée comme absente.
4. **Lecture déléguée filtrée par l'appelant.** `RegistreHistorique.lireDelegue(module)` ne contrôle que l'activation du
   module ; l'appelant (`Retex.invitations`, `Retex.contribution`) **doit** filtrer ce qu'il renvoie. Le contributeur ne
   reçoit que le contexte minimal (identifiant et intitulé de l'incident, nom du pilote, consigne, échéance, état), ses
   propres propositions, et la chronologie complète seulement si le pilote l'a diffusée après clôture. Ni la description,
   ni les obligations, ni les propositions des autres ne lui sont transmises.
5. **404 identiques.** Un incident absent, un incident sans RETEX et un RETEX où la personne n'est pas invitée donnent la
   **même** réponse 404 (« RETEX introuvable. ») : un compte non invité ne peut pas savoir si un incident existe.
6. **Notifications `retex_contribution` sans SMSI ni objet.** Les invitations et relances sont des notifications métier
   ([ADR 0058](0058-notifications-metier.md)) de type `retex_contribution`, réglables par groupe, rôle ou personne et
   envoyées par courriel selon ces réglages, sans aucune donnée métier dans le courriel (lien vers « Mes contributions
   RETEX »). Rattachées à un incident de l'état historique, elles n'ont ni SMSI ni objet du socle : la migration additive
   `047_retex_contributions.sql` étend la contrainte `grc_notifications_portee` posée par la migration `046`
   ([ADR 0074](0074-alerte-de-securite-dans-l-application.md)) à ce seul type, et un index unique partiel
   (`user_id`, `due_key` = `incident:numéro d'envoi`) garantit une seule notification par personne et par envoi. Aucune
   notification existante n'est modifiée. L'ouverture de la contribution marque ces notifications comme lues.
7. **Données.** La collecte vit dans le champ `retexCollecte` de l'incident ; le champ historique `retex` reste le texte des
   enseignements, inchangé. Plafonds : 50 contributeurs, 500 propositions et 300 événements par RETEX.

## Conséquences

- Premier cas d'habilitation sur un objet sans droit de module. Toute autre délégation (contribution à un exercice, à une
  revue) devra reprendre le même schéma — `modifierDelegue` / `lireDelegue`, contrôle sous verrou, réponse filtrée,
  404 uniforme, route ajoutée à la liste explicite de `rbac.test.ts` — et faire l'objet de sa propre ADR.
- `lireDelegue` est volontairement sans filtre : un appelant qui renverrait l'état brut exposerait tout le module. Les
  revues de code vérifient que chaque appelant filtre ; le test `retex-collecte.test.ts` vérifie qu'un contributeur ne
  reçoit ni la chronologie non diffusée ni les propositions des autres.
- Le menu « Mes contributions RETEX » et le bandeau d'invitation n'apparaissent que si la personne a au moins une demande ;
  le filtrage du menu ne vaut pas permission, le serveur reste seul juge.
- Retirer un contributeur retire ses propositions en attente ; les éléments déjà intégrés à la chronologie restent, avec
  le nom de leur auteur (« Proposé par … »).
- Aucune dépendance nouvelle. Retour arrière : la migration `047` est additive ; une version antérieure ignore le champ
  `retexCollecte` et les notifications de ce type.
