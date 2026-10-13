# Inventaire des menus et correspondances

Registre réel extrait de `api().astra.navigation()` : **24 rubriques, 100 destinations**. Chaque destination possède sa capture. Les contrôles utilitaires sont ajoutés à la galerie.

Les IDs et objets `set` sont aussi disponibles dans `technique/navigation.json` et `technique/navigation.csv`. Les trois destinations de Cartographies sont des captures de conservation, sans thème de prévisualisation.

## Cockpit RSSI

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Synthèse (`dash`) | `dash` · `{"dashView": "cards"}` | [Image](images/001-dash-dash.png) | Habillage proposé |

## Pilotage

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Par processus (`proc`) | `pilotage` · `{"pilView": "proc"}` | [Image](images/002-pil-proc.png) | Habillage proposé |
| Par objectif (`obj`) | `pilotage` · `{"pilView": "obj"}` | [Image](images/003-pil-obj.png) | Habillage proposé |
| Vue compacte (`cmp`) | `pilotage` · `{"pilView": "compact"}` | [Image](images/004-pil-cmp.png) | Habillage proposé |

## Rapports et exports

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Exports (`exp`) | `rapports` · `{"repView": "exp"}` | [Image](images/005-rep-exp.png) | Habillage proposé |
| COPIL sécurité (`copil`) | `rapports` · `{"repView": "COPIL"}` | [Image](images/006-rep-copil.png) | Habillage proposé |
| Comité de direction (`codir`) | `rapports` · `{"repView": "CODIR"}` | [Image](images/007-rep-codir.png) | Habillage proposé |

## Investissements

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Tableau de bord (`inv-dash`) | `invest` · `{"invView": "dash"}` | [Image](images/008-inv-inv-dash.png) | Habillage proposé |
| Lignes budgétaires (`inv-lines`) | `invest` · `{"invView": "lines"}` | [Image](images/009-inv-inv-lines.png) | Habillage proposé |
| Renouvellements (`inv-ren`) | `invest` · `{"invView": "ren"}` | [Image](images/010-inv-inv-ren.png) | Habillage proposé |
| Comparaison des options (`inv-cmp`) | `invest` · `{"invView": "cmp"}` | [Image](images/011-inv-inv-cmp.png) | Habillage proposé |

## Risques et études

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Registre central (`risk-register`) | `risks` · `{"riskView": "register", "riskId": "", "riskStudyId": ""}` | [Image](images/012-risks-risk-register.png) | Habillage proposé |
| Matrice des risques (`risk-map`) | `risks` · `{"riskView": "map", "riskId": "", "riskStudyId": ""}` | [Image](images/013-risks-risk-map.png) | Habillage proposé |
| Études EBIOS RM (`risk-studies`) | `risks` · `{"riskView": "studies", "riskId": "", "riskStudyId": ""}` | [Image](images/014-risks-risk-studies.png) | Habillage proposé |
| Scénarios (`risk-scenarios`) | `risks` · `{"riskView": "scenarios", "riskId": "", "riskStudyId": ""}` | [Image](images/015-risks-risk-scenarios.png) | Habillage proposé |
| Traitements et mesures (`risk-treatments`) | `risks` · `{"riskView": "treatments", "riskId": "", "riskStudyId": ""}` | [Image](images/016-risks-risk-treatments.png) | Habillage proposé |
| Politiques méthodologiques (`risk-policies`) | `risks` · `{"riskView": "policies", "riskId": "", "riskStudyId": ""}` | [Image](images/017-risks-risk-policies.png) | Habillage proposé |

## Conformité et applicabilité

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Clauses ISO 27001 (`iso`) | `conformite` · `{"confView": "ISO"}` | [Image](images/018-compliance-iso.png) | Habillage proposé |
| Annexe A (DdA) (`ann`) | `conformite` · `{"confView": "A"}` | [Image](images/019-compliance-ann.png) | Habillage proposé |
| HDS (DdA) (`hds`) | `conformite` · `{"confView": "HDS"}` | [Image](images/020-compliance-hds.png) | Habillage proposé |
| ReCyF et autres référentiels (`fw`) | `conformite` · `{"confView": "fw"}` | [Image](images/021-compliance-fw.png) | Habillage proposé |

## Programme CaRE

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Tableau de bord (`df-care-dash`) | `care` · `{"careView": "dash"}` | [Image](images/022-care-df-care-dash.png) | Habillage proposé |
| Suivis par domaine (`df-care-dossiers`) | `care` · `{"careView": "dossiers"}` | [Image](images/023-care-df-care-dossiers.png) | Habillage proposé |
| Objectifs (`df-care-grid`) | `care` · `{"careView": "grid"}` | [Image](images/024-care-df-care-grid.png) | Habillage proposé |
| Budgets et financements (`df-care-budget`) | `care` · `{"careView": "budget"}` | [Image](images/025-care-df-care-budget.png) | Habillage proposé |
| Preuves et versions (`df-care-proofs`) | `care` · `{"careView": "proofs"}` | [Image](images/026-care-df-care-proofs.png) | Habillage proposé |
| Actions (`df-care-actions`) | `care` · `{"careView": "actions"}` | [Image](images/027-care-df-care-actions.png) | Habillage proposé |
| Dossiers auditeur (`df-care-audit`) | `care` · `{"careView": "audit"}` | [Image](images/028-care-df-care-audit.png) | Habillage proposé |
| Sources et sauvegarde (`df-care-sources`) | `care` · `{"careView": "sources"}` | [Image](images/029-care-df-care-sources.png) | Habillage proposé |
| Pièces comptables et financières (`care-finance`) | `finance` · `{}` | [Image](images/030-care-care-finance.png) | Habillage proposé |

## Qualité · HAS

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Tableau de bord (`df-has-dash`) | `has` · `{"hasView": "dash"}` | [Image](images/031-has-df-has-dash.png) | Habillage proposé |
| Campagnes (`df-has-dossiers`) | `has` · `{"hasView": "dossiers"}` | [Image](images/032-has-df-has-dossiers.png) | Habillage proposé |
| Grille d’évaluation (`df-has-grid`) | `has` · `{"hasView": "grid"}` | [Image](images/033-has-df-has-grid.png) | Habillage proposé |
| Preuves et versions (`df-has-proofs`) | `has` · `{"hasView": "proofs"}` | [Image](images/034-has-df-has-proofs.png) | Habillage proposé |
| Actions (`df-has-actions`) | `has` · `{"hasView": "actions"}` | [Image](images/035-has-df-has-actions.png) | Habillage proposé |
| Mode auditeur (`df-has-audit`) | `has` · `{"hasView": "audit"}` | [Image](images/036-has-df-has-audit.png) | Habillage proposé |
| Sources et sauvegarde (`df-has-sources`) | `has` · `{"hasView": "sources"}` | [Image](images/037-has-df-has-sources.png) | Habillage proposé |

## Gestion de l'audit

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Pronostic 2027 (`cibles`) | `cibles` · `{}` | [Image](images/038-audit-cibles.png) | Habillage proposé |
| Déroulé (`deroule`) | `orga` · `{"orgaView": "deroule"}` | [Image](images/039-audit-deroule.png) | Habillage proposé |
| Planning (`cal`) | `orga` · `{"orgaView": "cal"}` | [Image](images/040-audit-cal.png) | Habillage proposé |
| Participants (`people`) | `orga` · `{"orgaView": "people"}` | [Image](images/041-audit-people.png) | Habillage proposé |
| Couverture du cycle (`couv`) | `couverture` · `{}` | [Image](images/042-audit-couv.png) | Habillage proposé |

## Preuves et justificatifs

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Registre des preuves (`prv-reg`) | `preuves` · `{"prvView": "reg"}` | [Image](images/043-proofs-prv-reg.png) | Habillage proposé |
| Couverture par mesure (`prv-cov`) | `preuves` · `{"prvView": "cov"}` | [Image](images/044-proofs-prv-cov.png) | Habillage proposé |
| Preuves repérées (`prv-det`) | `preuves` · `{"prvView": "det"}` | [Image](images/045-proofs-prv-det.png) | Habillage proposé |

## Contexte et parties intéressées

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Périmètre (`ctx-scope`) | `contexte` · `{"ctxView": "scope"}` | [Image](images/046-context-ctx-scope.png) | Habillage proposé |
| Parties intéressées (`ctx-pi`) | `contexte` · `{"ctxView": "pi"}` | [Image](images/047-context-ctx-pi.png) | Habillage proposé |
| SWOT par processus (`ctx-swot`) | `contexte` · `{"ctxView": "swot"}` | [Image](images/048-context-ctx-swot.png) | Habillage proposé |

## Cartographies

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Vue d’ensemble (`dmap`) | `dash` · `{"dashView": "map"}` | [Image](images/049-carto-dmap.png) | CONSERVER INTACT |
| Contexte et dépendances (`mb-ctx`) | `carto` · `{"mbView": "context"}` | [Image](images/050-carto-mb-ctx.png) | CONSERVER INTACT |
| Processus et interactions (`mb-proc`) | `carto` · `{"mbView": "process"}` | [Image](images/051-carto-mb-proc.png) | CONSERVER INTACT |

## Parcours guidé

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Ma démarche (`journey-home`) | `journey` · `{}` | [Image](images/052-journey-journey-home.png) | Habillage proposé |

## Fournisseurs et accès

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Fournisseurs et applications (`sup`) | `fournisseurs` · `{"supView": "list"}` | [Image](images/053-suppliers-sup.png) | Habillage proposé |
| Revues des accès (`ar`) | `fournisseurs` · `{"supView": "ar"}` | [Image](images/054-suppliers-ar.png) | Habillage proposé |
| Évaluations sécurité (`sev`) | `supeval` · `{}` | [Image](images/055-suppliers-sev.png) | Habillage proposé |

## PCRA · continuité et reprise

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Vue d’ensemble (`pcra-dashboard`) | `pcra` · `{"pcraView": "dashboard", "biaId": ""}` | [Image](images/056-pcra-pcra-dashboard.png) | Habillage proposé |
| Analyses d’impact · BIA (`pcra-bias`) | `pcra` · `{"pcraView": "bias", "biaId": ""}` | [Image](images/057-pcra-pcra-bias.png) | Habillage proposé |
| Plans de continuité · PCA (`pcra-PCA`) | `pcra` · `{"pcraView": "PCA", "biaId": ""}` | [Image](images/058-pcra-pcra-PCA.png) | Habillage proposé |
| Plans de reprise · PRA (`pcra-PRA`) | `pcra` · `{"pcraView": "PRA", "biaId": ""}` | [Image](images/059-pcra-pcra-PRA.png) | Habillage proposé |
| Exercices et RETEX (`pcra-exercises`) | `pcra` · `{"pcraView": "exercises", "biaId": ""}` | [Image](images/060-pcra-pcra-exercises.png) | Habillage proposé |
| Actions et améliorations (`pcra-actions`) | `pcra` · `{"pcraView": "actions", "biaId": ""}` | [Image](images/061-pcra-pcra-actions.png) | Habillage proposé |
| Documents et preuves (`pcra-documents`) | `pcra` · `{"pcraView": "documents", "biaId": ""}` | [Image](images/062-pcra-pcra-documents.png) | Habillage proposé |
| Politiques d’impact (`pcra-policies`) | `pcra` · `{"pcraView": "policies", "biaId": ""}` | [Image](images/063-pcra-pcra-policies.png) | Habillage proposé |

## Gouvernance de l’IA

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Synthèse (`syn`) | `ia` · `{"iaView": "syn"}` | [Image](images/064-ai-syn.png) | Habillage proposé |
| Registre des usages (`reg`) | `ia` · `{"iaView": "reg"}` | [Image](images/065-ai-reg.png) | Habillage proposé |
| Évaluation des risques (`eval`) | `ia` · `{"iaView": "eval"}` | [Image](images/066-ai-eval.png) | Habillage proposé |
| Plan d'action (`plan`) | `ia` · `{"iaView": "plan"}` | [Image](images/067-ai-plan.png) | Habillage proposé |
| Politiques à adapter (`pol`) | `ia` · `{"iaView": "pol"}` | [Image](images/068-ai-pol.png) | Habillage proposé |

## Plans d’action

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Registre & vues (`fd`) | `ecarts` · `{"ecView": "list"}` | [Image](images/069-actions-fd.png) | Habillage proposé |
| Sous-actions (`act`) | `ecarts` · `{"ecView": "actions"}` | [Image](images/070-actions-act.png) | Habillage proposé |

## Tâches récurrentes

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Tâches récurrentes (`pl-rec`) | `plans` · `{"planView": "rec"}` | [Image](images/071-recurring-pl-rec.png) | Habillage proposé |

## Programmes du SMSI

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Vue d’ensemble (`pl-cal`) | `plans` · `{"planView": "cal"}` | [Image](images/072-programs-pl-cal.png) | Habillage proposé |
| Formation (`pl-formation`) | `plans` · `{"planView": "formation"}` | [Image](images/073-programs-pl-formation.png) | Habillage proposé |
| Sensibilisation (`pl-sensi`) | `plans` · `{"planView": "sensi"}` | [Image](images/074-programs-pl-sensi.png) | Habillage proposé |
| Audit interne (`pl-audit`) | `plans` · `{"planView": "audit"}` | [Image](images/075-programs-pl-audit.png) | Habillage proposé |
| Exercices PRA et crise (`pl-exo`) | `plans` · `{"planView": "exo"}` | [Image](images/076-programs-pl-exo.png) | Habillage proposé |

## Incidents et crise

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Registre (`inc-reg`) | `incidents` · `{"incView": "reg"}` | [Image](images/077-ops-inc-reg.png) | Habillage proposé |
| Qualifier un signalement (`inc-qual`) | `incidents` · `{"incView": "qual"}` | [Image](images/078-ops-inc-qual.png) | Habillage proposé |
| Cellule de crise (`cr-cell`) | `crise` · `{"crView": "cell"}` | [Image](images/079-ops-cr-cell.png) | Habillage proposé |
| Contacts (`cr-ct`) | `crise` · `{"crView": "contacts"}` | [Image](images/080-ops-cr-ct.png) | Habillage proposé |
| Scénarios et check-lists (`cr-sc`) | `crise` · `{"crView": "scen"}` | [Image](images/081-ops-cr-sc.png) | Habillage proposé |

## Écarts applicatifs

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Applications (`apps`) | `gapapp` · `{}` | [Image](images/082-gap-apps.png) | Habillage proposé |

## Gestion CRRC

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Vue d’ensemble (`cr-over`) | `crrc` · `{"crrcView": "over"}` | [Image](images/083-crrc-cr-over.png) | Habillage proposé |
| Établissements (`cr-est`) | `crrc` · `{"crrcView": "est"}` | [Image](images/084-crrc-cr-est.png) | Habillage proposé |
| Catalogue des offres (`cr-off`) | `crrc` · `{"crrcView": "off"}` | [Image](images/085-crrc-cr-off.png) | Habillage proposé |
| Tableau de bord (`bk-dash`) | `crrc` · `{"crrcView": "bk-dash"}` | [Image](images/086-crrc-bk-dash.png) | Habillage proposé |
| Sauvegardes (`bk-res`) | `crrc` · `{"crrcView": "bk-res"}` | [Image](images/087-crrc-bk-res.png) | Habillage proposé |
| Restaurations (`bk-rest`) | `crrc` · `{"crrcView": "bk-rest"}` | [Image](images/088-crrc-bk-rest.png) | Habillage proposé |
| Alertes (`bk-alerts`) | `crrc` · `{"crrcView": "bk-alerts"}` | [Image](images/089-crrc-bk-alerts.png) | Habillage proposé |
| Rapports (`bk-rep`) | `crrc` · `{"crrcView": "bk-rep"}` | [Image](images/090-crrc-bk-rep.png) | Habillage proposé |

## Périmètres

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Organisations et établissements (`perimeter-registry`) | `perimeters` · `{"perimetersView": "registry"}` | [Image](images/091-perimeters-perimeter-registry.png) | Habillage proposé |
| Relations et classement (`perimeter-relations`) | `perimeters` · `{"perimetersView": "classification"}` | [Image](images/092-perimeters-perimeter-relations.png) | Habillage proposé |
| Comptes et habilitations (`perimeter-accounts`) | `perimeters` · `{"perimetersView": "accounts"}` | [Image](images/093-perimeters-perimeter-accounts.png) | Habillage proposé |
| Rôles et responsabilités (`perimeter-roles`) | `perimeters` · `{"perimetersView": "roles"}` | [Image](images/094-perimeters-perimeter-roles.png) | Habillage proposé |

## Administration

| Destination | Route / paramètres | Aperçu | Statut |
| --- | --- | --- | --- |
| Vue d’ensemble (`admin-overview`) | `admin` · `{"adminView": "overview"}` | [Image](images/095-admin-admin-overview.png) | Habillage proposé |
| Comptes et habilitations (`admin-users`) | `admin` · `{"adminView": "users"}` | [Image](images/096-admin-admin-users.png) | Habillage proposé |
| Rôles et responsabilités (`admin-roles`) | `admin` · `{"adminView": "roles"}` | [Image](images/097-admin-admin-roles.png) | Habillage proposé |
| Référentiels (`admin-frameworks`) | `admin` · `{"adminView": "frameworks"}` | [Image](images/098-admin-admin-frameworks.png) | Habillage proposé |
| Journal et traçabilité (`admin-audit`) | `admin` · `{"adminView": "audit"}` | [Image](images/099-admin-admin-audit.png) | Habillage proposé |
| Données de démonstration (`admin-demo`) | `admin` · `{"adminView": "demo"}` | [Image](images/100-admin-admin-demo.png) | Habillage proposé |

## Éléments de la capture utilisateur et interface réellement disponible

| Libellé de référence | Correspondance existante / traitement |
| --- | --- |
| Tableau de bord | Cockpit RSSI et accès aux tableaux détaillés historiques |
| Pilotage | Pilotage et les rubriques organisées par `LegacyNavigation` |
| Documents et liens | Preuves et justificatifs ; preuves CaRE/HAS et documents PCRA |
| Cartographie du SMSI | Trois routes protégées de Cartographies : aucune refonte |
| Évaluations IA | Gouvernance de l’IA : synthèse, registre, évaluations, plan, politique |
| Mon compte / Paramètres | Bouton utilisateur ou Paramètres : administration si administrateur, dialogue de paramètres pour les autres rôles ; aucune route Mon compte autonome dans le registre |
| Guide d’utilisation | Document existant `docs/GUIDE-UTILISATION.md` ; pas une nouvelle fonctionnalité à inventer |
| Administration | Six destinations du registre |
| Écran mural | Aucune destination autonome identifiée dans le registre inspecté ; hors périmètre de cette refonte |
| Outil de suivi / ancienne interface | Accès aux rendus historiques préservés par ASTRA ; pas de migration ou suppression |

## Utilitaires supplémentaires capturés

- [Paramètres pour un administrateur : ouvre Administration](images/utilitaire-parametres.png).
- [Recherche](images/utilitaire-recherche.png).
- [Export : dialogue seulement, aucun export réel déclenché](images/utilitaire-export.png).
- [Notifications](images/utilitaire-notifications.png).

Les captures montrent le premier écran à 1600 × 1100, pas toutes les lignes d’un registre ni toutes les variantes d’un formulaire. Des vues vides reflètent le jeu fictif utilisé.
