# Inventaire des destinations et couverture visuelle

Référence : 24 rubriques / 100 destinations avant ajout d’Apparence. Extraction initiale du registre réel en série 09 ; les routes sélectionnées en série 14 ont été parcourues au HEAD `b8ff86126f70114ba3bb7e32a4552fbefd3b7b04`. Relever de nouveau le registre au début de l’implémentation. Les autres destinations restent dans le périmètre même sans image récente.

## Cockpit RSSI

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Synthèse (`dash`) | `dash` · `{"dashView": "cards"}` | [Vue 14](../../../references/vues-modules/images/001-dash-dash.png) |

## Pilotage

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Par processus (`proc`) | `pilotage` · `{"pilView": "proc"}` | À décliner avec les composants communs |
| Par objectif (`obj`) | `pilotage` · `{"pilView": "obj"}` | À décliner avec les composants communs |
| Vue compacte (`cmp`) | `pilotage` · `{"pilView": "compact"}` | À décliner avec les composants communs |

## Rapports et exports

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Exports (`exp`) | `rapports` · `{"repView": "exp"}` | À décliner avec les composants communs |
| COPIL sécurité (`copil`) | `rapports` · `{"repView": "COPIL"}` | À décliner avec les composants communs |
| Comité de direction (`codir`) | `rapports` · `{"repView": "CODIR"}` | À décliner avec les composants communs |

## Investissements

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Tableau de bord (`inv-dash`) | `invest` · `{"invView": "dash"}` | À décliner avec les composants communs |
| Lignes budgétaires (`inv-lines`) | `invest` · `{"invView": "lines"}` | À décliner avec les composants communs |
| Renouvellements (`inv-ren`) | `invest` · `{"invView": "ren"}` | À décliner avec les composants communs |
| Comparaison des options (`inv-cmp`) | `invest` · `{"invView": "cmp"}` | À décliner avec les composants communs |

## Risques et études

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Registre central (`risk-register`) | `risks` · `{"riskView": "register", "riskId": "", "riskStudyId": ""}` | [Vue 14](../../../references/vues-modules/images/002-risks-risk-register.png) |
| Matrice des risques (`risk-map`) — couleurs corrigées au § 4 bis du dossier | `risks` · `{"riskView": "map", "riskId": "", "riskStudyId": ""}` | [Vue 14](../../../references/vues-modules/images/003-risks-risk-map.png) |
| Études EBIOS RM (`risk-studies`) | `risks` · `{"riskView": "studies", "riskId": "", "riskStudyId": ""}` | [Vue 14](../../../references/vues-modules/images/004-risks-risk-studies.png) |
| Scénarios (`risk-scenarios`) | `risks` · `{"riskView": "scenarios", "riskId": "", "riskStudyId": ""}` | À décliner avec les composants communs |
| Traitements et mesures (`risk-treatments`) | `risks` · `{"riskView": "treatments", "riskId": "", "riskStudyId": ""}` | À décliner avec les composants communs |
| Politiques méthodologiques (`risk-policies`) | `risks` · `{"riskView": "policies", "riskId": "", "riskStudyId": ""}` | À décliner avec les composants communs |

## Conformité et applicabilité

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Clauses ISO 27001 (`iso`) | `conformite` · `{"confView": "ISO"}` | [Vue 14](../../../references/vues-modules/images/005-compliance-iso.png) |
| Annexe A (DdA) (`ann`) | `conformite` · `{"confView": "A"}` | [Vue 14](../../../references/vues-modules/images/006-compliance-ann.png) |
| HDS (DdA) (`hds`) | `conformite` · `{"confView": "HDS"}` | À décliner avec les composants communs |
| ReCyF et autres référentiels (`fw`) | `conformite` · `{"confView": "fw"}` | À décliner avec les composants communs |

## Programme CaRE

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Tableau de bord (`df-care-dash`) | `care` · `{"careView": "dash"}` | [Vue 14](../../../references/vues-modules/images/007-care-df-care-dash.png) |
| Suivis par domaine (`df-care-dossiers`) | `care` · `{"careView": "dossiers"}` | À décliner avec les composants communs |
| Objectifs (`df-care-grid`) | `care` · `{"careView": "grid"}` | À décliner avec les composants communs |
| Budgets et financements (`df-care-budget`) | `care` · `{"careView": "budget"}` | À décliner avec les composants communs |
| Preuves et versions (`df-care-proofs`) | `care` · `{"careView": "proofs"}` | À décliner avec les composants communs |
| Actions (`df-care-actions`) | `care` · `{"careView": "actions"}` | À décliner avec les composants communs |
| Dossiers auditeur (`df-care-audit`) | `care` · `{"careView": "audit"}` | À décliner avec les composants communs |
| Sources et sauvegarde (`df-care-sources`) | `care` · `{"careView": "sources"}` | À décliner avec les composants communs |
| Pièces comptables et financières (`care-finance`) | `finance` · `{}` | À décliner avec les composants communs |

## Qualité · HAS

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Tableau de bord (`df-has-dash`) | `has` · `{"hasView": "dash"}` | [Vue 14](../../../references/vues-modules/images/008-has-df-has-dash.png) |
| Campagnes (`df-has-dossiers`) | `has` · `{"hasView": "dossiers"}` | À décliner avec les composants communs |
| Grille d’évaluation (`df-has-grid`) | `has` · `{"hasView": "grid"}` | À décliner avec les composants communs |
| Preuves et versions (`df-has-proofs`) | `has` · `{"hasView": "proofs"}` | À décliner avec les composants communs |
| Actions (`df-has-actions`) | `has` · `{"hasView": "actions"}` | À décliner avec les composants communs |
| Mode auditeur (`df-has-audit`) | `has` · `{"hasView": "audit"}` | À décliner avec les composants communs |
| Sources et sauvegarde (`df-has-sources`) | `has` · `{"hasView": "sources"}` | À décliner avec les composants communs |

## Gestion de l'audit

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Pronostic 2027 (`cibles`) | `cibles` · `{}` | [Vue 14](../../../references/vues-modules/images/009-audit-cibles.png) |
| Déroulé (`deroule`) | `orga` · `{"orgaView": "deroule"}` | À décliner avec les composants communs |
| Planning (`cal`) | `orga` · `{"orgaView": "cal"}` | À décliner avec les composants communs |
| Participants (`people`) | `orga` · `{"orgaView": "people"}` | À décliner avec les composants communs |
| Couverture du cycle (`couv`) | `couverture` · `{}` | À décliner avec les composants communs |

## Preuves et justificatifs

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Registre des preuves (`prv-reg`) | `preuves` · `{"prvView": "reg"}` | [Vue 14](../../../references/vues-modules/images/010-proofs-prv-reg.png) |
| Couverture par mesure (`prv-cov`) | `preuves` · `{"prvView": "cov"}` | À décliner avec les composants communs |
| Preuves repérées (`prv-det`) | `preuves` · `{"prvView": "det"}` | À décliner avec les composants communs |

## Contexte et parties intéressées

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Périmètre (`ctx-scope`) | `contexte` · `{"ctxView": "scope"}` | À décliner avec les composants communs |
| Parties intéressées (`ctx-pi`) | `contexte` · `{"ctxView": "pi"}` | [Vue 14](../../../references/vues-modules/images/019-context-ctx-pi.png) |
| SWOT par processus (`ctx-swot`) | `contexte` · `{"ctxView": "swot"}` | À décliner avec les composants communs |

## Cartographies

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Vue d’ensemble (`dmap`) | `dash` · `{"dashView": "map"}` | **Protégée : aucun habillage** |
| Contexte et dépendances (`mb-ctx`) | `carto` · `{"mbView": "context"}` | **Protégée : aucun habillage** |
| Processus et interactions (`mb-proc`) | `carto` · `{"mbView": "process"}` | **Protégée : aucun habillage** |

## Parcours guidé

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Ma démarche (`journey-home`) | `journey` · `{}` | À décliner avec les composants communs |

## Fournisseurs et accès

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Fournisseurs et applications (`sup`) | `fournisseurs` · `{"supView": "list"}` | [Vue 14](../../../references/vues-modules/images/014-suppliers-sup.png) |
| Revues des accès (`ar`) | `fournisseurs` · `{"supView": "ar"}` | À décliner avec les composants communs |
| Évaluations sécurité (`sev`) | `supeval` · `{}` | À décliner avec les composants communs |

## PCRA · continuité et reprise

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Vue d’ensemble (`pcra-dashboard`) | `pcra` · `{"pcraView": "dashboard", "biaId": ""}` | [Vue 14](../../../references/vues-modules/images/011-pcra-pcra-dashboard.png) |
| Analyses d’impact · BIA (`pcra-bias`) | `pcra` · `{"pcraView": "bias", "biaId": ""}` | [Vue 14](../../../references/vues-modules/images/012-pcra-pcra-bias.png) |
| Plans de continuité · PCA (`pcra-PCA`) | `pcra` · `{"pcraView": "PCA", "biaId": ""}` | À décliner avec les composants communs |
| Plans de reprise · PRA (`pcra-PRA`) | `pcra` · `{"pcraView": "PRA", "biaId": ""}` | À décliner avec les composants communs |
| Exercices et RETEX (`pcra-exercises`) | `pcra` · `{"pcraView": "exercises", "biaId": ""}` | À décliner avec les composants communs |
| Actions et améliorations (`pcra-actions`) | `pcra` · `{"pcraView": "actions", "biaId": ""}` | À décliner avec les composants communs |
| Documents et preuves (`pcra-documents`) | `pcra` · `{"pcraView": "documents", "biaId": ""}` | À décliner avec les composants communs |
| Politiques d’impact (`pcra-policies`) | `pcra` · `{"pcraView": "policies", "biaId": ""}` | À décliner avec les composants communs |

## Gouvernance de l’IA

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Synthèse (`syn`) | `ia` · `{"iaView": "syn"}` | À décliner avec les composants communs |
| Registre des usages (`reg`) | `ia` · `{"iaView": "reg"}` | [Vue 14](../../../references/vues-modules/images/018-ai-reg.png) |
| Évaluation des risques (`eval`) | `ia` · `{"iaView": "eval"}` | À décliner avec les composants communs |
| Plan d'action (`plan`) | `ia` · `{"iaView": "plan"}` | À décliner avec les composants communs |
| Politiques à adapter (`pol`) | `ia` · `{"iaView": "pol"}` | À décliner avec les composants communs |

## Plans d’action

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Registre & vues (`fd`) | `ecarts` · `{"ecView": "list"}` | [list](../../../references/vues-modules/images/020-actions-list.png) · [kanban](../../../references/vues-modules/images/021-actions-kanban.png) · [planning](../../../references/vues-modules/images/022-actions-planning.png) · [calendar](../../../references/vues-modules/images/023-actions-calendar.png) · [gantt](../../../references/vues-modules/images/024-actions-gantt.png) · [summary](../../../references/vues-modules/images/025-actions-summary.png) |
| Sous-actions (`act`) | `ecarts` · `{"ecView": "actions"}` | À décliner avec les composants communs |

## Tâches récurrentes

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Tâches récurrentes (`pl-rec`) | `plans` · `{"planView": "rec"}` | [list](../../../references/vues-modules/images/026-recurring-list.png) · [kanban](../../../references/vues-modules/images/027-recurring-kanban.png) · [planning](../../../references/vues-modules/images/028-recurring-planning.png) · [calendar](../../../references/vues-modules/images/029-recurring-calendar.png) |

## Programmes du SMSI

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Vue d’ensemble (`pl-cal`) | `plans` · `{"planView": "cal"}` | À décliner avec les composants communs |
| Formation (`pl-formation`) | `plans` · `{"planView": "formation"}` | [Vue 14](../../../references/vues-modules/images/016-programs-pl-formation.png) |
| Sensibilisation (`pl-sensi`) | `plans` · `{"planView": "sensi"}` | À décliner avec les composants communs |
| Audit interne (`pl-audit`) | `plans` · `{"planView": "audit"}` | À décliner avec les composants communs |
| Exercices PRA et crise (`pl-exo`) | `plans` · `{"planView": "exo"}` | À décliner avec les composants communs |

## Incidents et crise

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Registre (`inc-reg`) | `incidents` · `{"incView": "reg"}` | [Vue 14](../../../references/vues-modules/images/017-ops-inc-reg.png) |
| Qualifier un signalement (`inc-qual`) | `incidents` · `{"incView": "qual"}` | À décliner avec les composants communs |
| Cellule de crise (`cr-cell`) | `crise` · `{"crView": "cell"}` | À décliner avec les composants communs |
| Contacts (`cr-ct`) | `crise` · `{"crView": "contacts"}` | À décliner avec les composants communs |
| Scénarios et check-lists (`cr-sc`) | `crise` · `{"crView": "scen"}` | À décliner avec les composants communs |

## Écarts applicatifs

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Applications (`apps`) | `gapapp` · `{}` | À décliner avec les composants communs |

## Gestion CRRC

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Vue d’ensemble (`cr-over`) | `crrc` · `{"crrcView": "over"}` | À décliner avec les composants communs |
| Établissements (`cr-est`) | `crrc` · `{"crrcView": "est"}` | À décliner avec les composants communs |
| Catalogue des offres (`cr-off`) | `crrc` · `{"crrcView": "off"}` | À décliner avec les composants communs |
| Tableau de bord (`bk-dash`) | `crrc` · `{"crrcView": "bk-dash"}` | À décliner avec les composants communs |
| Sauvegardes (`bk-res`) | `crrc` · `{"crrcView": "bk-res"}` | À décliner avec les composants communs |
| Restaurations (`bk-rest`) | `crrc` · `{"crrcView": "bk-rest"}` | À décliner avec les composants communs |
| Alertes (`bk-alerts`) | `crrc` · `{"crrcView": "bk-alerts"}` | À décliner avec les composants communs |
| Rapports (`bk-rep`) | `crrc` · `{"crrcView": "bk-rep"}` | À décliner avec les composants communs |

## Périmètres

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Organisations et établissements (`perimeter-registry`) | `perimeters` · `{"perimetersView": "registry"}` | [Vue 14](../../../references/vues-modules/images/013-perimeters-perimeter-registry.png) |
| Relations et classement (`perimeter-relations`) | `perimeters` · `{"perimetersView": "classification"}` | À décliner avec les composants communs |
| Comptes et habilitations (`perimeter-accounts`) | `perimeters` · `{"perimetersView": "accounts"}` | À décliner avec les composants communs |
| Rôles et responsabilités (`perimeter-roles`) | `perimeters` · `{"perimetersView": "roles"}` | À décliner avec les composants communs |

## Administration

| Destination | Route / paramètres | Couverture |
| --- | --- | --- |
| Vue d’ensemble (`admin-overview`) | `admin` · `{"adminView": "overview"}` | [Vue 14](../../../references/vues-modules/images/015-admin-admin-overview.png) |
| Comptes et habilitations (`admin-users`) | `admin` · `{"adminView": "users"}` | À décliner avec les composants communs |
| Rôles et responsabilités (`admin-roles`) | `admin` · `{"adminView": "roles"}` | À décliner avec les composants communs |
| Référentiels (`admin-frameworks`) | `admin` · `{"adminView": "frameworks"}` | À décliner avec les composants communs |
| Journal et traçabilité (`admin-audit`) | `admin` · `{"adminView": "audit"}` | À décliner avec les composants communs |
| Données de démonstration (`admin-demo`) | `admin` · `{"adminView": "demo"}` | À décliner avec les composants communs |

## Nouvelle destination à créer

`admin-appearance` dans Administration : `tab: admin`, `set: {adminView: "appearance"}`. Une seule entrée supplémentaire, réservée aux administrateurs ; aucune destination existante à supprimer.

[Fiche et historique des récurrences](../../../references/vues-modules/images/030-recurring-fiche-historique.png) : état de détail, pas une nouvelle route.
