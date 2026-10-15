# Archive de l'ancienne interface (« Outils (ancienne interface) »)

Sauvegarde, dans le dépôt, de ce qui reste accessible sous `/legacy` à la version 3.1.1, avec une capture de
chaque page. Elle sert de référence avant toute suppression définitive de l'ancienne interface.

**L'ancienne interface n'est pas supprimée.** Plusieurs modules n'ont pas encore d'équivalent natif (tableau
ci-dessous) : la suppression est une décision du RSSI, à prendre sur cet inventaire.

- Les sources restent dans `app/public/index.html` (ne pas le réécrire) et sont figées par la branche
  `archive/ancienne-interface-v3.1.1` et l'étiquette `v3.1.1`.
- Les captures (`captures/`) ont été prises par le scénario e2e `tests/e2e/specs/zzzzzzz-archive-ancienne-interface.spec.ts`
  (lancé avec `E2E_ARCHIVE=1`) sur une pile fraîche où le jeu de test a été chargé. Elles montrent la structure, les
  colonnes et les libellés de chaque page ; **plusieurs pages y apparaissent vides** (aucune ligne), car le jeu de
  test alimente le pilotage commun natif et non les registres historiques. Elles ne constituent donc pas une
  sauvegarde de données (la sauvegarde des données reste la sauvegarde PostgreSQL et l'export historique).
- La capture 01 est réduite (JPEG, 75 %) car la page fait 12 500 px de haut.
- Données et captures fictives : aucun contenu réel.

## Pages et correspondance avec la nouvelle interface

Statuts : **repris** (équivalent natif testé), **partiel** (équivalent natif incomplet), **non repris** (aucun
équivalent natif : la page reste la seule à porter la fonction). Les statuts « partiel » sont à confirmer avec
l'[inventaire fonctionnel](../../02_FONCTIONNALITES/INVENTAIRE_FONCTIONNEL.md) avant suppression.

| #  | Groupe → page                                          | Statut      | Équivalent natif / remarque                                                       | Capture |
| -- | ------------------------------------------------------ | ----------- | --------------------------------------------------------------------------------- | ------- |
| 01 | Gestion de l'audit → Pronostic                         | repris     | Pilotage → Gestion de l’audit → Carte du prochain audit (pronostic, mesures à préparer, guide de préparation) | [01](captures/01-gestion-de-l-audit--pronostic.jpg) |
| 02 | Gestion de l'audit → Déroulé                           | repris     | Pilotage → Gestion de l’audit → Organisation : déroulé (jours, créneaux, preuves, questions) | [02](captures/02-gestion-de-l-audit--deroule.png) |
| 03 | Gestion de l'audit → Planning                          | repris     | Pilotage → Gestion de l’audit → Organisation : planning | [03](captures/03-gestion-de-l-audit--planning.png) |
| 04 | Gestion de l'audit → Participants                      | repris     | Pilotage → Gestion de l’audit → Organisation : participants | [04](captures/04-gestion-de-l-audit--participants.png) |
| 05 | Gestion de l'audit → Couverture du cycle               | repris     | Pilotage → Gestion de l’audit → Couverture du cycle (prévue, auditée, AFNOR et interne) | [05](captures/05-gestion-de-l-audit--couverture-du-cycle.png) |
| 06 | Conformité → Clauses ISO 27001                         | partiel     | Bibliothèque de référentiels (versions verrouillées, copies) et rapprochements    | [06](captures/06-conformite--clauses-iso-27001.png) |
| 07 | Conformité → Annexe A (DDA)                            | partiel     | idem                                                                              | [07](captures/07-conformite--annexe-a-dda.png) |
| 08 | Conformité → HDS (DDA)                                 | partiel     | idem                                                                              | [08](captures/08-conformite--hds-dda.png) |
| 09 | Conformité → REcyF et autres référentiels              | partiel     | idem                                                                              | [09](captures/09-conformite--recyf-et-autres-referentiels.png) |
| 10 | Fournisseurs → Fournisseurs et applications            | repris      | Pilotage → Fournisseurs (colonnes, filtres, fiche, indicateurs MFA/SSO)           | [10](captures/10-fournisseurs--fournisseurs-et-applications.png) |
| 11 | Fournisseurs → Revues des accès                        | non repris  |                                                                                   | [11](captures/11-fournisseurs--revues-des-acces.png) |
| 12 | Fournisseurs → Évaluations sécurité                    | non repris  | Sources conservées, pas de parcours natif (FCT-031)                               | [12](captures/12-fournisseurs--evaluations-securite.png) |
| 13 | Plans → Calendrier                                     | repris      | Pilotage → Calendrier des plans (plans et tâches récurrentes de l’année)          | [13](captures/13-plans--calendrier.png) |
| 14 | Plans → Planning annuel                                | repris      | Pilotage → Planning annuel des plans (barres déplaçables à la souris et au clavier) | [14](captures/14-plans--planning-annuel.png) |
| 15 | Plans → Formation                                      | repris      | Pilotage → Plan de formation                                                      | [15](captures/15-plans--formation.png) |
| 16 | Plans → Sensibilisation                                | repris      | Pilotage → Plan de sensibilisation (enregistrement du taux dans l’indicateur)     | [16](captures/16-plans--sensibilisation.png) |
| 17 | GAP et IA → Applications à intégrer                    | non repris  |                                                                                   | [17](captures/17-gap-et-ia--applications-a-integrer.png) |
| 18 | GAP et IA → Usages de l'IA                             | non repris  | Registre des usages de l'IA                                                       | [18](captures/18-gap-et-ia--usages-de-l-ia.png) |
| 19 | Autres modules → Gestion CRRC                          | non repris  |                                                                                   | [19](captures/19-autres-modules--gestion-crrc.png) |
| 20 | Autres modules → Investissements                       | non repris  | Registre et export conservés, INV-01/INV-02 non revendiqués (FCT-034)             | [20](captures/20-autres-modules--investissements.png) |
| 21 | Autres modules → Incidents                             | non repris  |                                                                                   | [21](captures/21-autres-modules--incidents.png) |
| 22 | Autres modules → Cellule de crise                      | non repris  |                                                                                   | [22](captures/22-autres-modules--cellule-de-crise.png) |
| 23 | Autres modules → Rapports et exports                   | partiel     | Rapports natifs et exports cartographiques (FCT-040) ; exports historiques partiels | [23](captures/23-autres-modules--rapports-et-exports.png) |
| 24 | Pilotage → Processus, objectifs, indicateurs           | repris      | Pilotage → Objectifs et indicateurs (trois vues, fiches, mesures, PESTEL, revue)  | [24](captures/24-pilotage--pilotage-processus-objectifs-indicateurs.png) |

Bilan : 11 pages reprises, 5 partielles, 8 non reprises.

## Captures de la nouvelle interface (jeu de test)

Captures de validation de la nouvelle interface sur le jeu de test fictif (`suivi jeu-de-test`), prises par
`zzzzzz-jeu-de-test.spec.ts` : [`jeu-de-test/`](jeu-de-test/) — menu et pastilles, processus, objectifs (trois
vues), fiche indicateur, fournisseurs et fiche, PESTEL, parties intéressées, opportunités, séries proposées,
revue de direction, carte des risques et calque santé, bibliothèque, tableau de bord.

## Avant de supprimer l'ancienne interface

1. Décider, module par module, entre reprise native, abandon assumé ou conservation sous `/legacy`.
2. Vérifier que les données historiques correspondantes sont exportées (export historique) ou migrées.
3. Retirer alors `app/public/index.html` et la route `/legacy` dans un commit dédié (voir CLAUDE.md), après CI verte.
