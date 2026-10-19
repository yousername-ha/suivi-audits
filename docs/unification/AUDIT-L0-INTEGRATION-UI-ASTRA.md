# Audit L0 — intégration des interfaces ASTRA (navigation, registres, plans d'action, écarts, récurrences)

Audit du **19 octobre 2026** sur `main` au commit `22c75a7` (fusion de la PR #57), demandé par le prompt
d'implémentation de la branche `legacy` (`fonctionnalites-a-implementer/_dossiers-transversaux/implementation-ui-2026-10/`).
Il correspond au lot **L0** de ce prompt : distinguer ce qui est prouvé, partiel, absent ou incertain **avant** tout code.

**Méthode.** Trois lectures indépendantes du code (navigation et droits ; périmètres, registres et fondations ; écarts, plans
et récurrences), des références `fichier:ligne`, puis vérification directe par l'auteur de trois constats saillants
(absence d'entité « registre », filtres ignorés de `GET /objects`, absence de vue Timeline). **Aucun test, build ni application
n'a été exécuté pour cet audit** : les constats viennent du code, pas d'un comportement observé. La branche `legacy` n'a pas
été modifiée.

**Branche de travail.** Le prompt demande de ne toucher à aucune « branche Claude » : il s'adresse à un autre agent de
codage. Ici, la branche de travail du dépôt est `claude-suivi-smsi` ([CLAUDE.md](../../CLAUDE.md)) ; `main` n'évolue que par
PR après CI verte, et `legacy` reste en lecture seule.

## 1. Constat d'ensemble

1. **Il n'existe aucune entité « registre ».** Ni table, ni route, ni type. Le périmètre (« smsi ») est l'unité qui partitionne
   tout le modèle GRC : chaque objet porte son propre `smsi_id` (`grc_objects.smsi_id NOT NULL`, et une dizaine d'autres tables),
   et toutes les routes de l'API GRC l'exigent dans l'URL. La règle confirmée du prompt (« le registre porte les périmètres,
   ses éléments les héritent ») est **un nouveau concept de modèle**, pas un raccordement.
2. **Deux modèles parallèles, sans pont automatique**, pour les écarts, les actions et les tâches récurrentes :
   - *hérité* : tables `suivi_*` (recomposées en JSON plat), **globales, sans colonne de périmètre**, exposées seulement pour
     le périmètre par défaut `DEFAULT_SMSI` ;
   - *natif* : objets `grc_objects` (`nonconformity`, `action`, `task_series`), utilisables dans tous les périmètres.
3. **L'héritage entre périmètres ne porte que sur les référentiels** (ADR 0039 §4 : rien d'autre n'est hérité).
4. **Le menu actuel est une liste plate de 11 entrées**, dont un Pilotage de 14 groupes et 72 rubriques ; il est couplé à
   des tests, à des captures et aux pastilles d'alerte (libellés de groupe).
5. Les briques techniques sont solides là où elles existent : politique d'action versionnée par périmètre, moteur de
   récurrence sans dérive, automate idempotent, journal et tables immuables, décisions horodatées côté serveur.

## 2. Matrice présent / partiel / absent

| Capacité demandée | État | Preuve (code) |
| --- | --- | --- |
| Périmètres, hiérarchie parent/enfant sans cycle, héritage des référentiels | Présent | migrations 013, 017, 022 ; `grc/core.ts:267-307` ; ADR 0039 |
| Droits par périmètre (utilisateur) | Présent | `grc_members`, `Grc.access` (`core.ts:181-208`) |
| Droits par groupe/rôle sur un périmètre, droit sur un ensemble de périmètres, accès hérité par la hiérarchie | **Absent** | `grc_members` n'a que `user_id` ; un seul `:smsi` par requête |
| **Registre** (conteneur) portant un ou plusieurs périmètres | **Absent** | aucune table ni route |
| Rattachement plusieurs-à-plusieurs à des périmètres | Partiel | fournisseurs (`sup_scope_links`), référentiels (`grc_scope_frameworks`) seulement |
| Éléments héritant le périmètre de leur registre | **Absent** | chaque élément porte son propre `smsi_id` |
| Liens entre objets de périmètres différents | **Absent** | `Grc.object()` refuse (`core.ts:470-476`) ; `grc_links.smsi_id` |
| Plan d'action = conteneur d'actions (début, fin, statut, responsable) | **Absent** | « Plans » = lignes à plat (formation, sensibilisation, audit, exercice), pas un conteneur |
| Action autonome : dates début/fin, statut, justification, dépendances | Présent | `TaskData` (`packages/shared/src/grc.ts:363`) ; `core.ts:548-584` |
| Politique de statuts et transitions par périmètre | Présent | `business-policy.ts` ; quatre statuts par défaut (todo, progress, blocked, done) + cancelled |
| Responsable personne | Présent | `ownerId` (uuid de compte), `checkOwner` |
| **Responsable groupe ou fonction** | **Absent** | groupes RBAC = droits seulement ; « fonctions » (`suivi_roles`) = texte libre sans lien à un compte |
| Vues Liste, Kanban, Calendrier, Gantt, tableau de bord des actions | Présent | `apps/web/src/grc/Tasks.tsx` |
| Vue **Timeline** (barres début/fin, période défilante) | **Absent** | le Gantt n'affiche qu'un mois (`Math.min(30, …)`) |
| Séries et occurrences natives, automate 60 s idempotent | Présent | `grc_series`, `grc_occurrences`, `grc/tasks.ts:84-182` |
| Périodicités jour/semaine/mois/an, fuseau, fin de série (`until`, `count`) | Présent | `packages/shared/src/recurrence.ts` |
| Journalier, hebdomadaire, **bimensuel**, trimestriel, semestriel, personnalisé nommés | Partiel | exprimables par `unit` × `interval` ; pas de libellés ni de « deux fois par mois » |
| Jours précis, jours ouvrés, exceptions, saut d'occurrence | **Absent** | `recurrence.ts` |
| **Fenêtre de réalisation** configurable | **Absent** | seulement `reminderDays` |
| **Import iCal** (jours fériés, vacances), zones, prévisualisation, doublons | **Absent** | aucune occurrence de `ics`, `VEVENT`, `RRULE` dans le dépôt |
| **Validation OK/KO/NA** d'une occurrence, preuve, immuable, idempotente | **Absent** | validation = modification de l'action (« done » peut être rouvert) ; pas de `requestId` pour les actions |
| Décision immuable idempotente par `requestId` | Partiel | `pilotage_decisions`, `grc_risk_evaluations` (autres opérations, pas les occurrences) |
| Tâches récurrentes héritées : création/modification | **Absent** | seule la réalisation (« Réaliser ») existe |
| Preuves versionnées | Partiel | versions de documents oui ; **aucun périmètre** sur un document ; pas de trigger d'immutabilité sur `document_versions` |
| Journal d'audit append-only, auteur et heure côté serveur | Présent | `audit_log`, `Db.audit` |
| Applicabilité par périmètre et version de référentiel | Présent | migration 027, `evaluations-exigences.ts` |
| Écart : classification NC majeure / mineure / point sensible | Partiel | hérité seulement ; **non affichée** dans la liste/fiche d'écart de Pilotage |
| Lien écart ↔ audit d'origine | **Absent** | libellés `source` + `year` |
| Lien écart ↔ exigences, ↔ actions | Partiel | `items`/`tasks` (hérité) ; `refs` et liens `treats` (natif) |
| Clôture gardée (efficacité, actions terminées), décisions tracées | Présent | `pilotage/service.ts:156-195` |
| Critères d'efficacité structurés, vérification planifiée | **Absent** | texte libre |
| **Récidive** (nouveau constat lié à l'ancien) | **Absent** | seule règle : fiche close immuable |
| Réouverture avec motif | **Absent** | fonctions pures sans route ni écran (`packages/shared/src/audit/ecarts.ts`) |
| Concurrence If-Match, temps réel SSE | Présent | un seul `scope` par événement (`core.ts:830`) |

## 3. Navigation

- **Définition** : `apps/web/src/components/Layout.tsx` (liste plate codée en dur, lignes 76-86) et
  `apps/web/src/pilotage-navigation.ts` (14 groupes, 72 rubriques `{id, label, module}` ; route = `/pilotage/<id>`).
- **Droits** : toujours `<module>:lire` via `useCan()` ; filtrage d'affichage seulement, le serveur reste juge. Le droit est
  ré-appliqué dans `Pilotage.tsx` : filtrer le menu ne suffit pas.
- **Routes** : une seule définition (`main.tsx:61-104`) ; **un seul alias** existant (`/grc` → `/pilotage`). Des dizaines
  d'URL `/pilotage/<id>` sont codées en dur (liens, guide `help.ts`, tests) : elles doivent rester valides ou être redirigées.
- **Pastilles d'alerte** : indexées par le **libellé** des groupes (`alertes-menu.tsx`, `alertes-menu.test.ts`) : renommer
  ou fusionner des groupes casse ce couplage.
- **Icônes** : 9 icônes SVG maison dans `packages/ui` ; il en faut pour les sept familles (pas de bibliothèque externe,
  toute dépendance nouvelle exige un ADR).
- **Coque** : menu replié en icônes entre 36 em et 64 em, tiroir sous 36 em ; défilement du document (en-tête et menu
  « collants », pas de conteneur interne) ; thème clair/sombre/automatique **stocké sur le serveur** (préférences du compte).
  Le prompt demande « menu fixe, contenu défilant » : l'écart avec l'existant est à mesurer lors du lot L2.
- **Contraintes** : CSP stricte, pas d'`AppShell`, `lockScroll={false}`, aucun `style=` en JSX, aucune couleur codée en dur,
  pas de `px/rem` dans les `.css` de l'application (`apps/web/test/charte.test.ts`).
- **Tests couplés** : `zzzzzz-jeu-de-test.spec.ts` (structure du Pilotage, pastille rouge, accordéon), `zzz-pilotage.spec.ts`
  (libellés de groupe et d'item), `zz-modules.spec.ts`, `parcours.spec.ts`, 48 captures « écran » et 12 captures
  « administration/paramètres » qui contiennent le menu, et l'accessibilité axe sur 22 écrans (URL à conserver).
- **Cartographie dynamique (protégée, R18)** : `/cartographie/:vue?`, `apps/web/src/carto/*`, `pages/Cartographie.tsx`,
  `packages/shared/src/carto/*`, `apps/api/src/routes/carto.ts`, tests `recette-cartographie.spec.ts`. À ne pas modifier.
  Ne pas confondre avec « Cartographie des risques » (`/pilotage/carte`, `grc/RiskMap.tsx`).

## 4. Anomalies relevées pendant l'audit (non traitées ici)

| # | Constat | Gravité |
| --- | --- | --- |
| A1 | `GET /api/grc/:smsi/objects` accepte `scope` et `relatedRef` mais `listObjects` ne filtre que `status`, `ownerId`, `domain`, `entity` : les deux filtres sont **ignorés en silence** (`routes/grc.ts:285-286`, `core.ts:477-495`) | Moyenne (résultat non filtré sans erreur) |
| A2 | `Grc.owners()` n'est pas la même règle que `checkOwner` (le second ne vérifie pas les droits de lecture) | Faible |
| A3 | `document_versions` n'a pas de trigger d'immutabilité ; `classification` est stockée mais jamais appliquée ; `db.audit(...)` est appelé hors transaction dans `routes/documents.ts` (erreurs avalées) | Moyenne (preuves) |
| A4 | Les références `legacy:tasks:<écart>/<indice>` reposent sur la **position** dans `tasks[]` : insérer ou supprimer une tâche décale les références existantes | Moyenne |
| A5 | `legacy:recurring` se résout en `task_series` mais est listé comme `action` ; `legacy:plans` se résout en `action` | Faible |
| A6 | Deux sources de comptage divergent pour le périmètre par défaut : synthèse/mur/exports lisent le JSON hérité, `dashboard.ts` lit le natif | Moyenne (R17 : pas de double comptage) |
| A7 | `suivi_ecarts.tenacy_*` n'est jamais lu ni écrit par du code métier | Information |
| A8 | Le Kanban masque les tâches héritées si la politique du périmètre n'a pas les identifiants `todo`/`done` | Faible |

## 5. Contrats manquants (producteur = backend de ce dépôt)

Ce dépôt n'a pas d'« agent métier » séparé : le producteur de ces contrats est ce même code. Ils ne sont **pas inventés ici** ;
chacun demande une décision de conception (ADR) avant implémentation.

| Besoin | Ce qui manque | Lot bloqué |
| --- | --- | --- |
| Registre multi-périmètres + héritage | Entité registre (table, type, routes), rattachement N-N à `grc_smsis`, résolution du contexte hérité, commande atomique « changer les périmètres d'un registre » avec aperçu d'impact, déplacement d'un élément (droits, liens, concurrence, trace) | L3, L4, L5, L6, L7 |
| Accès partiel à un registre A/B | Politique serveur (voir décision D1) | L3 (R05) |
| Éléments de registre vs `smsi_id` des objets | Choix : l'élément garde un `smsi_id` dérivé, ou référence le registre (migration des tables immuables par rattachement additionnel, jamais `UPDATE`) | L3 |
| Responsable personne / groupe / fonction | Type de responsable (référence polymorphe) et résolution fonction → personnes ; groupes assignables | L4, L6 |
| Validation d'occurrence OK/KO/NA immuable | Commande dédiée : `requestId` idempotent, auteur de session, heure serveur, référence de preuve versionnée, historique ; pas de réouverture silencieuse | L6 |
| Fenêtres de réalisation, exceptions, jours ouvrés, périodicités nommées | Extension de `recurrence.ts` et de `Recurrence` (versionnée, sans casser les séries existantes) | L6 |
| Calendriers iCal | Modèle de source (provenance, zone, fuseau, validation), import avec prévisualisation, déduplication, mise à jour, erreurs ; jours fériés et vacances scolaires comme sources **séparées** | L6 |
| Preuves rattachées au périmètre | Les documents n'ont pas de périmètre ; une pièce ne doit pas devenir accessible à tous par son association (prompt) | L6, L5 |
| Écart → audit d'origine, récidive, réouverture | Lien relationnel à un audit, champ de récidive (constat lié), routes de réouverture | L5 |
| Plan d'action = conteneur | Objet « plan » avec dates, statut, responsable, actions ordonnées, périmètres via le registre | L4 |

## 6. Données existantes et migration (préalable à toute migration, L1)

- `smsi_id` est présent dans une douzaine de tables, dont des index de pagination et des clés d'unicité (`grc_links`).
- Plusieurs tables sont **immuables** par trigger (`grc_object_versions`, `grc_occurrences`, `grc_requirement_assessments`,
  `pilotage_decisions`, `grc_risk_evaluations`, `audit_log`) : un rattachement ne peut s'y corriger par `UPDATE` ; il passe par
  de nouvelles lignes ou une table de rattachement additionnelle.
- Les données du suivi (`suivi_*`) n'ont **aucun périmètre** : elles appartiennent implicitement au périmètre commun. Leurs
  identifiants sont du texte, sans clé étrangère possible.
- Des champs « périmètre » existent en **texte libre** dans `data` (`scope`, `entity`, `domain`) : à inventorier et **conserver**
  comme contexte historique (le prompt interdit de les effacer sous prétexte d'une saisie courante supprimée).
- Un événement temps réel porte un seul `scope` : un élément de registre multi-périmètre demande soit de notifier chaque
  périmètre, soit un identifiant de registre et un filtre adapté (`routes/events.ts:44-62`).
- Un rapport de reprise (registre, périmètres du registre, périmètres des éléments, liens, décisions historiques) devra être
  produit avant la migration, avec test de transaction, de reprise sur erreur et de retour arrière.

## 7. Séquencement réaliste

Le prompt fixe L0 à L8. Compte tenu des constats :

- **Peut avancer sans nouveau contrat serveur** : L2 (coque, familles, icônes, alias, tests de navigation) à condition de faire
  valider l'ordre du menu ; vue Timeline et Kanban sur les actions **existantes** ; affichage de la classification des écarts ;
  correction des anomalies A1, A4 (identifiant stable des tâches héritées), A8.
- **Demande d'abord un ADR** : tout ce qui touche au registre (L3) ; L4 à L7 en dépendent.
- **Indépendant du registre** (peut avancer en parallèle, sur un seul périmètre à la fois) : configuration des calendriers
  iCal et prévisualisation des fenêtres (L6, première moitié), responsables typés (L4/L6), commande de validation d'occurrence.

## 8. Décisions à prendre (soumises à l'utilisateur)

- **D1 — Accès à un registre A/B pour un utilisateur autorisé seulement sur A.** Proposition : *lecture* si l'utilisateur est
  autorisé sur **au moins un** des périmètres du registre (il voit les éléments du registre, avec le contexte hérité, mais pas les
  données propres d'un périmètre non autorisé) ; *création, modification, déplacement et changement des périmètres du registre*
  exigent l'écriture sur **tous** ses périmètres. Choix **par le serveur**, jamais par le frontend (prompt, R05).
- **D2 — Ordre du menu.** Les sept familles de `navigation.json` sont une proposition « à valider ». À soumettre avant tout
  remplacement global (lot L2).
- **D3 — Où vivent les registres au départ.** Les écarts, actions et tâches **héritées** sont globales (périmètre commun). Proposition :
  un registre « Pilotage commun » créé à la reprise, rattaché au périmètre par défaut, qui reçoit les données héritées sans
  réécrire leur contexte historique.

## 9. Limites de l'audit

- Rien n'a été exécuté : les statuts de tests viennent des titres. Les comportements (replis, défilement) sont déduits du CSS.
- Non lus ou non établis : détail de `RecordEditor.tsx`, `Decision.tsx`, `ObjectEditor.tsx`, routes d'import
  (`/api/admin/import/*`) vis-à-vis de `findings`/`recurring`, usage historique de `tenacy_*`, volumes et charges réelles,
  éventuelles références `legacy:tasks:` déjà présentes dans `grc_links` en production.
- Les trois audits couvrent le code du dépôt au commit indiqué ; ils ne couvrent ni les maquettes de la branche `legacy`
  (consultées seulement via les quatre documents de référence), ni un serveur en production.
