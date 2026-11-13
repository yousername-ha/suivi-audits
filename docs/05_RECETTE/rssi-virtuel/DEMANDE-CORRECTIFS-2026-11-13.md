# Demande de correctifs à la session de développement — campagne de recette à plusieurs agents (12 et 13/11/2026)

Destinataire : session de développement dédiée (Sonnet). Émetteur : session de recette « Campagne multi-agent RSSI
virtuel » (`session_01EnWdzfKyK172mDzj6dAUWv`). Constats et bilan : [rapport de campagne](RAPPORT-CAMPAGNE-2026-11-13.md) ;
registre : [BUG-038 à BUG-077](../../04_QUALITE/REGISTRE_BUGS.md). Cette demande complète celle du
[12/11/2026](DEMANDE-CORRECTIFS-2026-11-12.md) (BUG-016 à BUG-037), toujours valable.

## 1. Répartition des rôles (décision du RSSI, 11/11/2026)

- La session de recette **teste et constate** ; elle ne modifie ni `apps/` ni `packages/`.
- La session de développement **corrige**, avec ses propres tests unitaires et de bout en bout (règles d'`AGENTS.md` et de
  `CONTRIBUTING.md`).
- Ne pas modifier `tests/e2e/rssi-virtuel/` : les tests marqués `test.fail(true, 'CAMP-… ouvert…')` passent tant que le
  défaut existe et deviennent rouges une fois corrigé. Signaler le correctif (numéro de BUG, PR) ; la recette repasse,
  vérifie à l'écran et retire le marqueur.

## 2. Briques : la campagne a tourné sur la cible

Contrairement à la recette du 12/11, tous les constats ont été obtenus **et rejoués** sur les piles Docker de `lancer.sh`
(PostgreSQL 18.6, Node 26.12.1, images de la branche, passerelle Caddy, exécutant d'exploitation), code `2e63e86`. Les
défauts BUG-016 à BUG-037 y sont reconfirmés (rapport, § 5).

Reproduire sur une pile isolée :

```bash
sudo tests/e2e/rssi-virtuel/lancer.sh --pile 1 --garder
```

Derrière un proxy TLS, construire d'abord les images avec le secret BuildKit `build_ca`, puis ajouter `--images-locales`
(en-tête du script). Arrêt et effacement : `--pile 1 --arreter`.

## 3. Ordre de traitement proposé

| Lot | Fiches | Motif |
| --- | --- | --- |
| 1. Droits | BUG-051, BUG-049, BUG-050, BUG-075, BUG-044 | Écritures ou lectures hors de ce qu'un RSSI attend du rôle ; à traiter d'abord (règle d'AGENTS.md : garde serveur, le menu ne vaut pas permission). |
| 2. Données et chiffres faux | BUG-040, BUG-041, BUG-039, BUG-043, BUG-045, BUG-047, BUG-048, BUG-065 | Bloquants d'audit : DdA (6.1.3 d), acceptation du risque (6.1.3 f, 8.3), compteurs et réglages enregistrés différemment de ce qui est affiché. |
| 3. Exports | BUG-038, BUG-046, BUG-058 | Ce qui est remis à un auditeur doit refléter les fiches saisies ; même cause que BUG-020. |
| 4. Périmètres | BUG-042, BUG-062, BUG-055, BUG-068, BUG-071 | Registres sans périmètre derrière le sélecteur ; même famille que BUG-037. |
| 5. Une seule source par objet | BUG-053, BUG-063, BUG-064, BUG-066, BUG-070, BUG-056, BUG-077 | Écrans qui lisent le registre historique alors que les formulaires écrivent les objets du Pilotage (invariant d'AGENTS.md : une seule source modifiable par objet). |
| 6. Écrans | BUG-052, BUG-054, BUG-057, BUG-059, BUG-060, BUG-061, BUG-067, BUG-069, BUG-072, BUG-073, BUG-074, BUG-076 | Saisie perdue, page qui plante, libellés techniques, fonctions annoncées absentes. |

## 4. Fiches

Périmètre commun : `00000000-0000-4000-8000-000000000001`. Comptes : administrateur de l'installation ; contributeur, lecteur, auditeur externe et contributeur limité au sous-périmètre créés par Plateforme › Utilisateurs (comme `test7-*` de la campagne). Données fictives uniquement. « Piste » = endroit repéré par la recette, sans garantie. Les étapes de reproduction exactes (requêtes, corps, réponses) sont dans les fichiers de rejeu cités.

### 1. Droits

**BUG-051 — Un compte rattaché à un périmètre enfant voit et modifie le parent ; rattaché au parent, il ne voit pas les enfants** (bloquant, P1 ; constats T1-01, T2-01, T3-01, T4-01, T5-01, T6-02)

- Observé : Le périmètre racine est « Toute l'organisation » (visibilité `instance`), sans réglage ; un contributeur membre du seul périmètre enfant (« Hébergement HDS » du jeu fictif, nom d'un périmètre, pas le référentiel HDS) lit le parent et y écrit (`POST …/objects` → 200, `PATCH /api/dda/A-5.1` → 200) ; l'appartenance ne descend pas vers les enfants.
- Attendu : Arbitrage du RSSI du 13/11/2026 : un compte rattaché à un périmètre enfant ne voit que ce périmètre ; rattaché au parent, il voit le parent et les enfants rattachés à ce parent. Contrôle côté serveur sur toutes les routes du périmètre ; écran « Accès au périmètre » racine comprise.
- Piste : visibilité `instance` du périmètre racine ; ADR 0039 (sans propagation) à amender par une ADR de la session de développement, numéro annoncé au RSSI.
- Reproduire : [`campagne/rejeu-piles-1-2.md`](campagne/rejeu-piles-1-2.md), section T1-01.
- Test de recette : `specs/41-campagne-organisation-risques.spec.ts`, « CAMP-T1-01 ouvert » et « CAMP-T1-02 ouvert ».

**BUG-049 — Un contributeur archive un registre (plan d'actions) qu'il n'a pas créé** (bloquant, P1 ; constats T4-02)

- Observé : `POST /api/registres/:id/archivage` par un contributeur sans rôle de gestionnaire → HTTP 200 ; le même compte reçoit 403 pour archiver une seule action ou un écart ; aucune commande de désarchivage.
- Attendu : Arbitrage du RSSI du 13/11/2026 : seul le gestionnaire du registre peut l'archiver. Désarchivage à prévoir (proposition de la recette, non arbitrée).
- Piste : le code lit le point 5 de l'ADR 0043 comme un droit d'archivage pour tout contributeur ; lecture écartée par le RSSI le 13/11/2026.
- Reproduire : [`campagne/rejeu-piles-3-4.md`](campagne/rejeu-piles-3-4.md), section T4-02.
- Test de recette : `specs/42-campagne-conformite-ecarts.spec.ts`, « CAMP-T4-02 ouvert ».

**BUG-050 — Un contributeur retire des événements de la chronologie RETEX sans le droit « supprimer »** (bloquant, P1 ; constats T5-02)

- Observé : `DELETE /api/incidents/:id/retex/:eid` par un contributeur → HTTP 200, y compris pour l'événement d'un autre compte ; le journal ne garde pas le contenu retiré ; la suppression de l'incident lui est refusée (403).
- Attendu : Refus sans le droit de suppression ; contenu retiré conservé au journal.
- Piste : route sans contrôle du droit de suppression.
- Reproduire : [`campagne/rejeu-piles-5-6.md`](campagne/rejeu-piles-5-6.md), section T5-02.
- Test de recette : `specs/43-campagne-incidents-plateforme.spec.ts`, « CAMP-T5-02 ouvert ».

**BUG-075 — Un contributeur modifie les décisions d'une revue de direction validée** (majeur, P1 ; constats T4-03)

- Observé : Le contributeur, qui ne peut pas valider (403), modifie une revue validée ; elle repasse en brouillon.
- Attendu : Revue validée immuable, sauf réouverture par un administrateur du pilotage.
- Piste : aggrave C4-06 (libellés d'état).
- Reproduire : [`campagne/rejeu-piles-3-4.md`](campagne/rejeu-piles-3-4.md), section T4-03.
- Test de recette : `specs/42-campagne-conformite-ecarts.spec.ts`, « CAMP-T4-03 ouvert ».

**BUG-044 — Incidents et crise sans périmètre : un compte non membre lit les incidents d'un sous-périmètre** (bloquant, P1 ; constats C5-06)

- Observé : Incidents, RETEX, cellules, contacts et scénarios ne portent aucun périmètre ; le sélecteur est sans effet ; un contributeur non membre de « Hébergement HDS » reçoit 404 sur le périmètre mais lit ses incidents et cellules de crise.
- Attendu : Chaque fiche relève d'un périmètre ; la lecture suit l'appartenance au périmètre.
- Piste : registres hors périmètre. Même famille que BUG-037 et BUG-062 ; cause commune avec BUG-051.
- Reproduire : [`campagne/rejeu-piles-5-6.md`](campagne/rejeu-piles-5-6.md), section C5-06.
- Test de recette : `specs/43-campagne-incidents-plateforme.spec.ts`, « CAMP-C5-06 ouvert ».

### 2. Données et chiffres faux

**BUG-040 — Enregistrer une fiche d'applicabilité sans rien changer déclare la mesure « Applicable »** (bloquant, P1 ; constats C3-05)

- Observé : Ouvrir la fiche d'une mesure jamais examinée puis « Enregistrer » écrit `app: "oui"` ; le journal attribue la décision au RSSI.
- Attendu : Une mesure non examinée le reste tant que l'applicabilité n'est pas choisie (6.1.3 d).
- Piste : valeur par défaut du formulaire envoyée. Prolonge RSSI-13 (BUG-017).
- Reproduire : [`campagne/rejeu-piles-3-4.md`](campagne/rejeu-piles-3-4.md), section C3-05.
- Test de recette : `specs/42-campagne-conformite-ecarts.spec.ts`, « CAMP-C3-05 ouvert ».

**BUG-041 — Écart rattaché à l'exigence d'un référentiel ignoré par la DdA** (bloquant, P1 ; constats C3-06, C4-04)

- Observé : Écart lié à « A-5.24 · 5.24 » (exigence du référentiel appliqué) : la DdA n'affiche aucun écart sur la mesure « Total » et l'indicateur « Total avec écart ouvert » reste à 0. Sous un sous-périmètre sans référentiel appliqué, aucune mesure n'est proposée pour l'écart (C4-04).
- Attendu : La DdA reprend l'écart quelle que soit la forme du rattachement ; l'incohérence « Total avec écart ouvert » est signalée.
- Piste : la DdA ne lit que les rattachements `legacy:items:`. Famille de BUG-026.
- Reproduire : [`campagne/rejeu-piles-3-4.md`](campagne/rejeu-piles-3-4.md), section C3-06.
- Test de recette : `specs/42-campagne-conformite-ecarts.spec.ts`, « CAMP-C3-06 ouvert ».

**BUG-039 — Un risque jamais apprécié peut être formellement accepté** (bloquant, P1 ; constats C2-03)

- Observé : Décision d'acceptation enregistrée (HTTP 200), immuable, sur un risque à l'état « Non apprécié ».
- Attendu : Refus tant que le risque n'a pas de niveau apprécié (ISO/IEC 27001:2022 6.1.3 f et 8.3).
- Piste : aucun contrôle de l'appréciation avant la décision. Voisin de BUG-024 (à arbitrer).
- Reproduire : [`campagne/rejeu-piles-1-2.md`](campagne/rejeu-piles-1-2.md), section C2-03.
- Test de recette : `specs/41-campagne-organisation-risques.spec.ts`, « CAMP-C2-03 ouvert ».

**BUG-043 — Compteur « Continuité » limité aux plans PCRA** (bloquant, P1 ; constats C5-01)

- Observé : Un PRA donne « 0 plan de continuité et de reprise » sur Périmètres, la Synthèse et le mur ; le tableau de bord affiche « 1 » pour deux plans.
- Attendu : Tous les plans de continuité et de reprise sont comptés.
- Piste : filtre sur le type PCRA.
- Reproduire : [`campagne/rejeu-piles-5-6.md`](campagne/rejeu-piles-5-6.md), section C5-01.
- Test de recette : `specs/43-campagne-incidents-plateforme.spec.ts`, « CAMP-C5-01 ouvert ».

**BUG-045 — RETEX : gravité « Faible » affichée pour un incident critique sans gravité saisie** (bloquant, P1 ; constats C5-11)

- Observé : « Gravité maximale : Faible » pour un incident P1 critique dont aucune gravité n'est renseignée.
- Attendu : « Non renseignée » tant qu'aucune gravité n'est saisie.
- Piste : valeur par défaut dans le calcul des indicateurs du RETEX.
- Reproduire : [`campagne/rejeu-piles-5-6.md`](campagne/rejeu-piles-5-6.md), section C5-11.
- Test de recette : `specs/43-campagne-incidents-plateforme.spec.ts`, « CAMP-C5-11 ouvert ».

**BUG-047 — « Référentiel complémentaire actif » affiché vide ; l'enregistrer désactive ReCyF** (bloquant, P1 ; constats C6-04)

- Observé : Valeur `recyf-2.5` enregistrée mais liste vide à l'écran ; choisir ReCyF enregistre le nom au lieu de l'identifiant et fait passer ReCyF de « Actif » à « Conservé ».
- Attendu : La liste affiche la valeur enregistrée ; l'enregistrer ne change pas l'état du référentiel.
- Piste : identifiant et libellé confondus entre l'écran et l'API.
- Reproduire : [`campagne/rejeu-piles-5-6.md`](campagne/rejeu-piles-5-6.md), section C6-04.
- Test de recette : `specs/43-campagne-incidents-plateforme.spec.ts`, « CAMP-C6-04 ouvert ».

**BUG-048 — Catégorie NIS 2 impossible à remettre à « Non renseignée » ; « enregistré » et journal inexacts** (bloquant, P1 ; constats C6-05)

- Observé : Vider la catégorie affiche « enregistré » et trace un changement au journal d'audit, mais la valeur reste « Entité importante ».
- Attendu : La valeur vide est enregistrée, ou refusée avec un message ; le journal reflète ce qui est enregistré.
- Piste : valeur vide ignorée par la fusion des réglages.
- Reproduire : [`campagne/rejeu-piles-5-6.md`](campagne/rejeu-piles-5-6.md), section C6-05.
- Test de recette : `specs/43-campagne-incidents-plateforme.spec.ts`, « CAMP-C6-05 ouvert ».

**BUG-065 — Niveau de mise en œuvre accepté sur une mesure non examinée et compté « Total »** (majeur, P1 ; constats C3-04)

- Observé : Niveau « Total » enregistré sans applicabilité décidée ; la mesure entre dans le taux et sort des « Non renseignées ».
- Attendu : Niveau refusé tant que l'applicabilité n'est pas décidée.
- Piste : même cause que BUG-016 ; même indicateur que BUG-017.
- Reproduire : [`campagne/rejeu-piles-3-4.md`](campagne/rejeu-piles-3-4.md), section C3-04.
- Test de recette : `specs/42-campagne-conformite-ecarts.spec.ts`, « CAMP-C3-04 ouvert ».

### 3. Exports

**BUG-038 — Export « Contexte du SMSI » vide malgré les fiches saisies** (bloquant, P1 ; constats C1-04)

- Observé : Feuilles « Parties intéressées », « SWOT » et « Rôles » réduites aux en-têtes alors que 2, 1 et 5 fiches existent ; feuille « Périmètre » vide (l'export lit `statement`, `sites`, `excl`, que le formulaire n'écrit pas) ; aucun périmètre choisi, le sous-périmètre n'est jamais exporté.
- Attendu : L'export reprend les fiches saisies à l'écran, pour le périmètre demandé.
- Piste : même famille que BUG-020 : l'export lit le registre historique au lieu des objets du Pilotage.
- Reproduire : [`campagne/rejeu-piles-1-2.md`](campagne/rejeu-piles-1-2.md), section C1-04.
- Test de recette : `specs/41-campagne-organisation-risques.spec.ts`, « CAMP-C1-04 ouvert ».

**BUG-046 — Export Excel : une piste de progrès libellée « Point sensible »** (bloquant, P1 ; constats C5-15)

- Observé : Une piste de progrès est exportée dans la colonne de classification comme « Point sensible ».
- Attendu : Le libellé exporté correspond à la classification saisie.
- Piste : table de libellés de l'export (`apps/api/src/export/rubriques.ts`, l. 65, piste de la recette).
- Reproduire : [`campagne/rejeu-piles-5-6.md`](campagne/rejeu-piles-5-6.md), section C5-15.
- Test de recette : `specs/43-campagne-incidents-plateforme.spec.ts`, « CAMP-C5-15 ouvert ».

**BUG-058 — Exports incomplets : registre des risques, traitements, EBIOS RM, « export complet »** (majeur, P2 ; constats C2-05, C5-16)

- Observé : Ni le registre des risques, ni le plan de traitement, ni les études EBIOS RM ne sont exportables ; l'« export complet » omet plans de continuité, exercices, RETEX, scénarios, documents, risques et revues, et ne permet pas de choisir le périmètre.
- Attendu : Les registres du SMSI s'exportent, pour le périmètre choisi.
- Piste : exports fondés sur le registre historique (famille de BUG-038).
- Reproduire : [`campagne/rejeu-piles-1-2.md`](campagne/rejeu-piles-1-2.md), section C2-05.
- Test de recette : `specs/41-campagne-organisation-risques.spec.ts`, « CAMP-C2-05 ouvert ».

### 4. Périmètres

**BUG-042 — Revue de direction : rien de préparé sous un périmètre enfant, et ses non-conformités absentes de la revue du parent** (bloquant, P1 ; constats C4-05)

- Observé : La revue préparée du principal annonce « 2 ouvert(s) » et omet la non-conformité majeure ouverte sous « Hébergement HDS » ; sous le sous-périmètre, aucune entrée n'est préparée.
- Attendu : Arbitrage du RSSI du 13/11/2026 : chaque périmètre enfant a sa propre revue de direction, sauf s'il hérite des référentiels du parent ; ses entrées remontent alors dans la revue du parent.
- Piste : fonction réservée au périmètre racine (famille de BUG-037) ; la règle dépend de l'héritage des référentiels (`inheritFrameworks`).
- Reproduire : [`campagne/rejeu-piles-3-4.md`](campagne/rejeu-piles-3-4.md), section C4-05.
- Test de recette : `specs/42-campagne-conformite-ecarts.spec.ts`, « CAMP-C4-05 ouvert ».

**BUG-062 — Sélecteur « Périmètre affiché » sans effet sur la DdA, l'audit et les plans annuels** (majeur, P1 ; constats C3-01, C4-02)

- Observé : Sous « Hébergement HDS », la DdA (clauses, annexe A, HDS), la gestion de l'audit, les applications à intégrer et les plans annuels montrent le principal ; une modification faite sous le sous-périmètre change le principal (`/api/dda` sans paramètre de périmètre).
- Attendu : Chaque écran filtre sur le périmètre affiché, ou dit qu'il est commun à toute l'organisation.
- Piste : registres historiques sans périmètre (famille de BUG-037).
- Reproduire : [`campagne/rejeu-piles-3-4.md`](campagne/rejeu-piles-3-4.md), section C3-01.
- Test de recette : `specs/42-campagne-conformite-ecarts.spec.ts`, « CAMP-C3-01 ouvert ».

**BUG-055 — Objectifs et indicateurs : deux modèles selon le périmètre ; synthèse du sous-périmètre sans objectifs** (majeur, P2 ; constats C1-10)

- Observé : Sous le principal, objectifs et indicateurs du registre historique ; sous un sous-périmètre, objets du Pilotage ; la Synthèse du sous-périmètre n'a pas de carte « Objectifs et indicateurs ».
- Attendu : Un seul modèle, quel que soit le périmètre.
- Piste : même cause que BUG-037 (`smsi === SOCLE`).
- Reproduire : [`campagne/rejeu-piles-1-2.md`](campagne/rejeu-piles-1-2.md), section C1-10.
- Test de recette : `specs/41-campagne-organisation-risques.spec.ts`, « CAMP-C1-10 ouvert ».

**BUG-068 — Resélectionner le périmètre affiché bascule sur le périmètre racine** (majeur, P1 ; constats C5-17, T5-04)

- Observé : Recliquer le périmètre affiché le désélectionne et affiche la racine ; un import confirmé « dans le périmètre sélectionné » (HDS) a été enregistré à la racine. Même effet sur le niveau d'accès d'un périmètre (« Lecture et écriture » → « Lecture seule »).
- Attendu : Recliquer la valeur la conserve.
- Piste : listes sans `allowDeselect={false}`.
- Reproduire : [`campagne/rejeu-piles-5-6.md`](campagne/rejeu-piles-5-6.md), section C5-17.
- Test de recette : `specs/43-campagne-incidents-plateforme.spec.ts`, « CAMP-C5-17 ouvert ».

**BUG-071 — Revue des accès (A.5.18) sans les accès aux périmètres** (majeur, P2 ; constats C6-12)

- Observé : Liste, droits effectifs et export n'indiquent pas les accès aux périmètres (dont « Hébergement HDS »).
- Attendu : La revue des accès montre les droits par périmètre.
- Piste : lié à BUG-051.
- Reproduire : [`campagne/rejeu-piles-5-6.md`](campagne/rejeu-piles-5-6.md), section C6-12.
- Test de recette : `specs/43-campagne-incidents-plateforme.spec.ts`, « CAMP-C6-12 ouvert ».

### 5. Une seule source par objet

**BUG-053 — PESTEL, cartographie et processus ignorent les SWOT et enjeux saisis à l'écran** (majeur, P2 ; constats C1-05)

- Observé : « Rattacher : SWOT » grisé ; la cartographie et la fiche processus n'affichent pas les SWOT et enjeux saisis.
- Attendu : Les fiches saisies alimentent le PESTEL, la cartographie et les processus.
- Piste : lecture du registre historique (famille de BUG-020).
- Reproduire : [`campagne/rejeu-piles-1-2.md`](campagne/rejeu-piles-1-2.md), section C1-05.
- Test de recette : `specs/41-campagne-organisation-risques.spec.ts`, « CAMP-C1-05 ouvert ».

**BUG-063 — Trois registres d'applicabilité qui s'ignorent** (majeur, P2 ; constats C3-02)

- Observé : DdA, « Applicabilité et justifications » et « Couverture par référentiel » se saisissent séparément ; la Couverture affiche « 92 à déterminer » malgré la DdA remplie.
- Attendu : Une seule source de l'applicabilité.
- Piste : famille de BUG-036.
- Reproduire : [`campagne/rejeu-piles-3-4.md`](campagne/rejeu-piles-3-4.md), section C3-02.
- Test de recette : `specs/42-campagne-conformite-ecarts.spec.ts`, « CAMP-C3-02 ouvert ».

**BUG-064 — « Référentiels et exigences » ignore les référentiels attribués et appliqués** (majeur, P2 ; constats C3-03)

- Observé : ISO/IEC 27001 et HDS, attribués et appliqués, absents de « Référentiels et exigences » et des correspondances : aucune correspondance ISO ↔ HDS possible.
- Attendu : Les référentiels appliqués sont listés et correspondables.
- Piste : à établir.
- Reproduire : [`campagne/rejeu-piles-3-4.md`](campagne/rejeu-piles-3-4.md), section C3-03.
- Test de recette : `specs/42-campagne-conformite-ecarts.spec.ts`, « CAMP-C3-03 ouvert ».

**BUG-066 — Deux registres d'exercices qui s'ignorent** (majeur, P2 ; constats C5-04)

- Observé : Exercice du registre réalisé : compté ni au bandeau, ni dans « Plans du SMSI », ni dans la cellule de crise (l'API refuse tout exercice du registre, 422), ni à l'export ; seul le plan historique `PL-EXO` est lu.
- Attendu : Un seul registre d'exercices, repris partout.
- Piste : lecture du registre historique (famille de BUG-020 et BUG-058).
- Reproduire : [`campagne/rejeu-piles-5-6.md`](campagne/rejeu-piles-5-6.md), section C5-04.
- Test de recette : `specs/43-campagne-incidents-plateforme.spec.ts`, « CAMP-C5-04 ouvert ».

**BUG-070 — Les incidents ne remontent dans aucune synthèse** (majeur, P2 ; constats C5-19)

- Observé : Tableau de bord, Synthèse, mur, rapport de pilotage et revue : aucun incident ; la diapositive « Revue des incidents » annoncée n'existe pas.
- Attendu : Les incidents alimentent les synthèses et l'entrée de revue correspondante.
- Piste : recoupe BUG-031 pour la revue.
- Reproduire : [`campagne/rejeu-piles-5-6.md`](campagne/rejeu-piles-5-6.md), section C5-19.
- Test de recette : `specs/43-campagne-incidents-plateforme.spec.ts`, « CAMP-C5-19 ouvert ».

**BUG-056 — « Créer les actions pour les écarts » du clausier : aucune action, écart sans responsable ni échéance, dupliqué** (majeur, P2 ; constats C1-12)

- Observé : Le bouton annonce des actions mais crée seulement l'écart FOU-01, sans responsable ni échéance, recréé à chaque évaluation ; rien dans le plan d'actions. L'écart est bien dans la DdA (l'échec d'INV-08 était un faux positif, corrigé dans `invariants.ts`).
- Attendu : Une action par écart, avec responsable et échéance (10.2), sans doublon.
- Piste : recoupe BUG-034 et BUG-035.
- Reproduire : [`campagne/rejeu-piles-1-2.md`](campagne/rejeu-piles-1-2.md), section C1-12.
- Test de recette : `specs/41-campagne-organisation-risques.spec.ts`, « CAMP-C1-12 ouvert ».

**BUG-077 — Clausier : identifiant FOU-0n réattribué après archivage d'un écart, création en erreur 500** (majeur, P1 ; constats R12-01)

- Observé : Après l'archivage de l'écart FOU-01, « Créer les actions pour les écarts » d'une nouvelle évaluation répond HTTP 500 ; journal de l'API : `duplicate key value violates unique constraint "grc_objects_smsi_id_legacy_key_legacy_id_key"` (deux occurrences relevées sur la pile 2 par la session principale). Défaut trouvé pendant l'écriture de CAMP-C1-12.
- Attendu : Un identifiant historique n'est jamais réattribué ; aucune réponse 5xx.
- Piste : `identifiantActionFournisseur` (`apps/api/src/historique/evals-fournisseurs.ts`) calcule le prochain numéro sans l'écart archivé. Même famille que C5-09 (référence d'incident réattribuée).
- Reproduire : [`campagne/rejeu-piles-1-2.md`](campagne/rejeu-piles-1-2.md), section R12-01.
- Test de recette : `specs/41-campagne-organisation-risques.spec.ts`, « CAMP-R12-01 ouvert ».

### 6. Écrans

**BUG-052 — Fiches du Pilotage ni archivables ni supprimables à l'écran** (majeur, P2 ; constats C1-03, C2-10, C5-03)

- Observé : Contexte, parties, SWOT, rôles, traitements, actifs, sources, opportunités, plans de continuité et exercices : le menu « Autres actions » ne propose ni archivage ni suppression, alors que l'API d'archivage existe.
- Attendu : Archiver (ou supprimer une fiche créée par erreur) depuis l'écran, selon les droits.
- Piste : fiche générique du Pilotage sans « Archiver la fiche ».
- Reproduire : [`campagne/rejeu-piles-1-2.md`](campagne/rejeu-piles-1-2.md), section C1-03.
- Test de recette : `specs/41-campagne-organisation-risques.spec.ts`, « CAMP-C1-03 ouvert ».

**BUG-054 — Évaluation d'un fournisseur : la page plante au troisième clic sur un critère** (majeur, P2 ; constats C1-07)

- Observé : Cocher, décocher, recocher un critère : « Cannot read properties of null (reading 'checked') », page inutilisable (3 fois sur 3).
- Attendu : Le critère se coche et se décoche sans erreur.
- Piste : piste : `Fournisseurs.tsx`, l. 773 (lecture de l'événement après sa libération).
- Reproduire : [`campagne/rejeu-piles-1-2.md`](campagne/rejeu-piles-1-2.md), section C1-07.
- Test de recette : `specs/41-campagne-organisation-risques.spec.ts`, « CAMP-C1-07 ouvert ».

**BUG-057 — « Stratégie » du traitement affichée « Réduire » mais envoyée vide ; refus en termes techniques** (majeur, P2 ; constats C2-01)

- Observé : Recliquer la valeur affichée la désélectionne et envoie une stratégie vide ; refus 422 libellé `strategy`, `"reduce"`.
- Attendu : La valeur affichée est celle envoyée ; message en français désignant le champ.
- Piste : liste sans `allowDeselect={false}` (même mécanisme que BUG-022 et BUG-068).
- Reproduire : [`campagne/rejeu-piles-1-2.md`](campagne/rejeu-piles-1-2.md), section C2-01.
- Test de recette : `specs/41-campagne-organisation-risques.spec.ts`, « CAMP-C2-01 ouvert ».

**BUG-059 — Codes anglais et valeurs techniques à l'écran (carte, atelier 5, rapport, éditeur de méthode)** (majeur, P2 ; constats C2-06)

- Observé : Légende de la carte, atelier 5, rapport et éditeur de méthode affichent des codes (`draft`, `unacceptable`, `judgement`…).
- Attendu : Libellés français.
- Piste : extension de BUG-023.
- Reproduire : [`campagne/rejeu-piles-1-2.md`](campagne/rejeu-piles-1-2.md), section C2-06.
- Test de recette : `specs/41-campagne-organisation-risques.spec.ts`, « CAMP-C2-06 ouvert ».

**BUG-060 — Choix des mesures d'un traitement : sans référence, avec doublons et textes tronqués** (majeur, P2 ; constats C2-07)

- Observé : 157 options au lieu de 160, sans référence (A.8.13…), avec doublons et exigences HDS tronquées.
- Attendu : Mesures désignées par leur référence, sans doublon.
- Piste : volet liens : famille de BUG-026.
- Reproduire : [`campagne/rejeu-piles-1-2.md`](campagne/rejeu-piles-1-2.md), section C2-07.
- Test de recette : `specs/41-campagne-organisation-risques.spec.ts`, « CAMP-C2-07 ouvert ».

**BUG-061 — EBIOS RM : scénario opérationnel non placé dans la matrice de l'étude** (majeur, P2 ; constats C2-09)

- Observé : Le scénario G4 × V2 reste dans « Non placés ».
- Attendu : Tout scénario évalué est placé dans la matrice.
- Piste : à établir.
- Reproduire : [`campagne/rejeu-piles-1-2.md`](campagne/rejeu-piles-1-2.md), section C2-09.
- Test de recette : `specs/41-campagne-organisation-risques.spec.ts`, « CAMP-C2-09 ouvert ».

**BUG-067 — Scénario de crise : responsable d'une action perdu sans message** (majeur, P2 ; constats C5-05)

- Observé : Responsable saisi pendant l'enregistrement du texte de l'action perdu (5 fois sur 5).
- Attendu : La saisie est conservée.
- Piste : ligne recréée à l'enregistrement du texte (clé de ligne contenant le texte).
- Reproduire : [`campagne/rejeu-piles-5-6.md`](campagne/rejeu-piles-5-6.md), section C5-05.
- Test de recette : `specs/43-campagne-incidents-plateforme.spec.ts`, « CAMP-C5-05 ouvert ».

**BUG-069 — Crise réelle : le bandeau rouge annoncé n'existe pas** (majeur, P2 ; constats C5-18)

- Observé : Cellule de crise réelle ouverte : aucun bandeau au tableau de bord ni dans le menu.
- Attendu : Bandeau visible tant que la cellule réelle est ouverte.
- Piste : à établir.
- Reproduire : [`campagne/rejeu-piles-5-6.md`](campagne/rejeu-piles-5-6.md), section C5-18.
- Test de recette : `specs/43-campagne-incidents-plateforme.spec.ts`, « CAMP-C5-18 ouvert ».

**BUG-072 — Date du dernier test de restauration dans le futur acceptée : l'alerte disparaît** (majeur, P2 ; constats C6-21)

- Observé : `PUT /api/settings/sauvegardes` accepte une date future ; l'alerte « Test de restauration à faire » disparaît.
- Attendu : Date future refusée avec un message.
- Piste : validation absente.
- Reproduire : [`campagne/rejeu-piles-5-6.md`](campagne/rejeu-piles-5-6.md), section C6-21.
- Test de recette : `specs/43-campagne-incidents-plateforme.spec.ts`, « CAMP-C6-21 ouvert ».

**BUG-073 — Versions de l'état toutes vides : télécharger ou restaurer une version ne rend rien** (majeur, P1 ; constats C6-22)

- Observé : `GET /api/admin/versions/:v` renvoie `{}` (5 octets, même empreinte pour toutes les versions) alors que l'écran propose téléchargement et restauration.
- Attendu : Une version contient l'état qu'elle date, ou l'écran ne propose pas de la restaurer.
- Piste : piste : `LegacyStore.save()` retire les modules repris dans des tables.
- Reproduire : [`campagne/rejeu-piles-5-6.md`](campagne/rejeu-piles-5-6.md), section C6-22.
- Test de recette : `specs/43-campagne-incidents-plateforme.spec.ts`, « CAMP-C6-22 ouvert ».

**BUG-074 — Au téléphone, la DdA n'affiche pas l'applicabilité ni la mise en œuvre** (majeur, P2 ; constats T3-03)

- Observé : À 390 px, les listes « Applicable » et « Mise en œuvre » (52 et 42 px) ne montrent que la croix d'effacement.
- Attendu : Valeurs lisibles au téléphone.
- Piste : largeur fixe des listes.
- Reproduire : [`campagne/rejeu-piles-3-4.md`](campagne/rejeu-piles-3-4.md), section T3-03.
- Test de recette : `specs/42-campagne-conformite-ecarts.spec.ts`, « CAMP-T3-03 ouvert ».

**BUG-076 — Le module « Incidents et PCA/PRA » n'ouvre pas les plans de continuité** (majeur, P2 ; constats T5-03)

- Observé : Un auditeur externe limité à ce module reçoit 403 sur les plans de continuité ; il faut lui ouvrir tout « Pilotage du SMSI ».
- Attendu : Le module donne accès aux PCA/PRA qu'il annonce.
- Piste : rattachement des plans de continuité au module Pilotage.
- Reproduire : [`campagne/rejeu-piles-5-6.md`](campagne/rejeu-piles-5-6.md), section T5-03.
- Test de recette : `specs/43-campagne-incidents-plateforme.spec.ts`, « CAMP-T5-03 ouvert ».

## 5. Arbitrages du RSSI

**Rendu le 13/11/2026, BUG-051** : un compte est rattaché à un périmètre ; rattaché à un périmètre enfant, il ne voit
que ce périmètre ; rattaché au parent, il voit le parent et les enfants rattachés à ce parent. À traiter au lot 1, avec
une ADR qui amende l'ADR 0039 (numéro à annoncer au RSSI).

**Rendu le 13/11/2026, BUG-049** : seul le gestionnaire du registre peut l'archiver. À traiter au lot 1. Le désarchivage
n'a pas été arbitré (proposition de la recette).

**Rendu le 13/11/2026, BUG-042** : chaque périmètre enfant a sa propre revue de direction, sauf s'il hérite des
référentiels du parent ; ses entrées remontent alors dans la revue du parent. À traiter au lot 4.

Restent à obtenir :

| Fiche | Question |
| --- | --- |
| BUG-049 (suite) | Le désarchivage d'un registre est-il prévu, et réservé à qui ? |
| BUG-024, BUG-031 | Toujours ouverts (demande du 12/11). |

## 6. Outillage de recette (pour information, déjà corrigé par la recette)

`lancer.sh` (`.env` de la pile pour `app` et `updater`, projet Compose de l'exécutant, `--images-locales`) et l'invariant
INV-08 (appariement par `legacyId`) ont été corrigés dans `tests/e2e/rssi-virtuel/` : rien à faire côté développement.
