# Matrice de couverture de la recette

Fichier généré par `node tests/e2e/rssi-virtuel/matrice.mjs generer` à partir du code de l’interface. Ne pas le
modifier à la main : corriger le rattachement dans `matrice.mjs`, puis régénérer.

- Écrans inventoriés : **107**
- Types d’objets du registre : **35**
- Cases exigées : **1712**

## Axes

| Axe | Valeurs |
|---|---|
| Périmètre | `principal` (périmètre commun), `sous-perimetre` (périmètre rattaché), `restreint` (compte limité à un sous-périmètre) |
| Rôle | `administrateur`, `rssi`, `contributeur`, `lecteur`, `auditeur_externe` |
| État | `vide` (rien de saisi), `rempli` (jeu de données fictif), `erreur` (saisie refusée : champ obligatoire, valeur invalide, doublon) |
| Affichage | `bureau` (1440 × 900), `telephone` (390 × 844) |

## Cases exigées par écran

- **Agent du domaine** (6 cases) : rôle `rssi`, périmètres `principal` et `sous-perimetre`, états `vide`, `rempli`, `erreur`.
- **Agent transversal** (10 cases) : chaque autre rôle sous `principal` et `sous-perimetre` (état `rempli`), le
  contributeur `restreint`, et le RSSI au `telephone`.

Résultats possibles d’une case : `ok`, `defaut` (avec la référence du constat), `sans-objet` (avec la raison, par
exemple un écran indépendant du périmètre). Une case absente des résultats est `non testée`.

## Répartition

| Agent | Tranche | Écrans | Cases |
|---|---|---|---|
| 1 | Organisation, contexte, objectifs, fournisseurs | 19 | 114 |
| 2 | Risques : méthode, appréciation, traitement, EBIOS RM | 7 | 42 |
| 3 | Conformité, DdA, audits, preuves et contrôles | 21 | 126 |
| 4 | Écarts, actions, plans annuels, revue de direction, registres | 10 | 60 |
| 5 | Incidents, crise, continuité, documents, exports | 15 | 90 |
| 6 | Installation, comptes, Plateforme, Système, paramètres | 35 | 210 |
| 7 | Tous les écrans sous chaque rôle, chaque périmètre, et au téléphone | 107 | 1070 |

## Agent 1 : Organisation, contexte, objectifs, fournisseurs

| Écran | Chemin | Rubrique | Module |
|---|---|---|---|
| Synthèse | `/pilotage/synthese` | Vue d’ensemble | pilotage |
| Périmètres | `/pilotage/perimetres` | Vue d’ensemble | pilotage |
| Parcours ISO 27001 / HDS | `/pilotage/parcours-iso` | Parcours guidé | pilotage |
| Parcours par démarche | `/pilotage/parcours` | Parcours guidé | pilotage |
| Périmètre et contexte | `/pilotage/contexte` | Contexte et responsabilités | pilotage |
| Processus | `/pilotage/processus-cartes` | Contexte et responsabilités | pilotage |
| Parties intéressées | `/pilotage/parties` | Contexte et responsabilités | pilotage |
| SWOT par processus | `/pilotage/swot` | Contexte et responsabilités | pilotage |
| PESTEL des enjeux externes | `/pilotage/pestel` | Contexte et responsabilités | pilotage |
| Rôles et responsabilités | `/pilotage/responsabilites` | Contexte et responsabilités | pilotage |
| Objectifs par processus | `/pilotage/processus` | Objectifs et indicateurs | pilotage |
| Objectifs | `/pilotage/objectifs` | Objectifs et indicateurs | pilotage |
| Indicateurs | `/pilotage/indicateurs` | Objectifs et indicateurs | pilotage |
| Fournisseurs de l’organisation | `/pilotage/fournisseurs` | Fournisseurs | fournisseurs |
| Critères d’évaluation des fournisseurs | `/pilotage/criteres-fournisseurs` | Fournisseurs | fournisseurs |
| Fournisseurs du périmètre | `/pilotage/fournisseurs-perimetre` | Fournisseurs | fournisseurs |
| Évaluations par le clausier (Club RSSI Santé) | `/pilotage/evaluations-clausier` | Fournisseurs | fournisseurs |
| / | `/` | Hors menu du pilotage | sans |
| /cartographie/:vue? | `/cartographie/:vue?` | Hors menu du pilotage | sans |

Types d’objets à créer, modifier, lier, supprimer et exporter au moins une fois :

`context`, `stakeholder`, `swot`, `governance`, `process`, `objective`, `indicator`, `journey`

## Agent 2 : Risques : méthode, appréciation, traitement, EBIOS RM

| Écran | Chemin | Rubrique | Module |
|---|---|---|---|
| Registre des risques | `/pilotage/risques` | Risques | pilotage |
| Opportunités | `/pilotage/opportunites` | Risques | pilotage |
| Études EBIOS RM | `/pilotage/etudes` | Risques | pilotage |
| Cartographie des risques | `/pilotage/carte` | Risques | cartographie |
| Traitements | `/pilotage/traitements` | Risques | pilotage |
| Scénarios et actifs | `/pilotage/scenarios` | Risques | pilotage |
| Configuration des analyses | `/pilotage/configuration-analyses` | Risques | pilotage |

Types d’objets à créer, modifier, lier, supprimer et exporter au moins une fois :

`risk`, `risk_source`, `feared_event`, `business_asset`, `support_asset`, `strategic_scenario`, `operational_scenario`, `treatment`, `risk_study`, `sr_ov`, `ecosystem_party`, `opportunity`

## Agent 3 : Conformité, DdA, audits, preuves et contrôles

| Écran | Chemin | Rubrique | Module |
|---|---|---|---|
| Carte du prochain audit | `/pilotage/audit-pronostic` | Gestion de l’audit | audit |
| Couverture du cycle | `/pilotage/audit-couverture` | Gestion de l’audit | audit |
| Organisation : déroulé | `/pilotage/audit-deroule` | Gestion de l’audit | plan_audit |
| Organisation : planning | `/pilotage/audit-planning` | Gestion de l’audit | plan_audit |
| Organisation : participants | `/pilotage/audit-participants` | Gestion de l’audit | plan_audit |
| Référentiels et exigences | `/pilotage/referentiels` | Conformité | conformite |
| Bibliothèque de référentiels | `/pilotage/bibliotheque` | Conformité | conformite |
| Clauses ISO 27001 (DdA) | `/pilotage/dda-iso` | Conformité | audit |
| Annexe A (DdA) | `/pilotage/dda-annexe-a` | Conformité | audit |
| HDS (DdA) | `/pilotage/dda-hds` | Conformité | audit |
| Applicabilité et justifications | `/pilotage/applicabilite` | Conformité | pilotage |
| Mesures | `/pilotage/mesures` | Conformité | audit |
| Correspondances entre exigences | `/pilotage/correspondances` | Conformité | conformite |
| Rapprochements à valider | `/pilotage/rapprochements` | Conformité | conformite |
| Couverture par référentiel | `/pilotage/couverture` | Conformité | conformite |
| Analyser un service | `/pilotage/analyser-service` | Conformité | conformite |
| Applications à intégrer | `/pilotage/gap-applications` | Conformité | conformite |
| Correspondances de la bibliothèque | `/pilotage/correspondances-bibliotheque` | Conformité | conformite |
| Registre des preuves | `/pilotage/preuves` | Preuves et contrôles | documents |
| Plan de contrôle | `/pilotage/controles` | Preuves et contrôles | pilotage |
| Audits internes | `/pilotage/audits` | Plans et revues | plan_audit |

Types d’objets à créer, modifier, lier, supprimer et exporter au moins une fois :

`framework`, `requirement`, `measure`, `mapping`, `soa`, `control`, `evidence`, `audit`

## Agent 4 : Écarts, actions, plans annuels, revue de direction, registres

| Écran | Chemin | Rubrique | Module |
|---|---|---|---|
| Amélioration continue | `/pilotage/amelioration` | Écarts et actions | ecarts |
| Plan d’actions | `/pilotage/actions` | Écarts et actions | ecarts |
| Tâches récurrentes | `/pilotage/recurrences` | Écarts et actions | ecarts |
| Calendrier des plans | `/pilotage/plans-calendrier` | Plans et revues | pilotage |
| Planning annuel des plans | `/pilotage/plans-planning` | Plans et revues | pilotage |
| Plan de formation | `/pilotage/plans-formation` | Plans et revues | pilotage |
| Plan de sensibilisation | `/pilotage/plans-sensibilisation` | Plans et revues | pilotage |
| Revues de direction | `/pilotage/revues` | Plans et revues | pilotage |
| Mes rappels | `/pilotage/rappels` | Outils | pilotage |
| /registres/:id? | `/registres/:id?` | Hors menu du pilotage | sans |

Types d’objets à créer, modifier, lier, supprimer et exporter au moins une fois :

`action`, `task_series`, `nonconformity`, `management_review`

## Agent 5 : Incidents, crise, continuité, documents, exports

| Écran | Chemin | Rubrique | Module |
|---|---|---|---|
| Continuité et reprise | `/pilotage/continuite` | Plans et revues | pilotage |
| Exercices et RETEX | `/pilotage/exercices` | Plans et revues | pilotage |
| Registre des incidents | `/pilotage/incidents-registre` | Incidents et crise | incidents |
| Qualifier un signalement | `/pilotage/incidents-qualifier` | Incidents et crise | incidents |
| RETEX et chronologie | `/pilotage/incidents-retex` | Incidents et crise | incidents |
| Cellule de crise | `/pilotage/crise-cellule` | Incidents et crise | incidents |
| Contacts de crise | `/pilotage/crise-contacts` | Incidents et crise | incidents |
| Scénarios et check-lists | `/pilotage/crise-scenarios` | Incidents et crise | incidents |
| Import et rapports | `/pilotage/imports` | Outils | import_export |
| /mur | `/mur` | Hors menu du pilotage | sans |
| /mur/activer | `/mur/activer` | Hors menu du pilotage | sans |
| /documents | `/documents` | Hors menu du pilotage | sans |
| /documents/:id | `/documents/:id` | Hors menu du pilotage | sans |
| /exports | `/exports` | Hors menu du pilotage | sans |
| /retex/:incident? | `/retex/:incident?` | Hors menu du pilotage | sans |

Types d’objets à créer, modifier, lier, supprimer et exporter au moins une fois :

`incident`, `continuity_plan`, `continuity_exercise`

## Agent 6 : Installation, comptes, Plateforme, Système, paramètres

| Écran | Chemin | Rubrique | Module |
|---|---|---|---|
| Configuration du pilotage | `/pilotage/configuration` | Outils | pilotage |
| Général | `/plateforme/general` | Plateforme | administration |
| Cycle de certification | `/plateforme/cycle` | Plateforme | administration |
| Référentiels | `/plateforme/referentiels` | Plateforme | administration |
| Échelles et matrices (GRC) | `/plateforme/echelles` | Plateforme | administration |
| Configuration du pilotage | `/plateforme/configuration-pilotage` | Plateforme | administration |
| Utilisateurs | `/plateforme/utilisateurs` | Plateforme | administration |
| Groupes | `/plateforme/groupes` | Plateforme | administration |
| Fonctions | `/plateforme/fonctions` | Plateforme | administration |
| Rôles et droits | `/plateforme/roles` | Plateforme | administration |
| Conservation | `/plateforme/conservation` | Plateforme | administration |
| Calendriers | `/plateforme/calendriers` | Plateforme | administration |
| Types de processus | `/plateforme/types-processus` | Plateforme | administration |
| Apparence | `/plateforme/apparence` | Plateforme | administration |
| Notifications | `/plateforme/notifications` | Plateforme | administration |
| Destinataires des notifications | `/plateforme/notifications-destinataires` | Plateforme | administration |
| Écrans muraux | `/plateforme/murs` | Plateforme | administration |
| Import et export | `/plateforme/import` | Plateforme | administration |
| Sauvegardes et restauration | `/systeme/sauvegardes` | Système | administration |
| Courriel | `/systeme/courriel` | Système | administration |
| Mises à jour et versions | `/systeme/mises-a-jour` | Système | administration |
| Certificats et opérations | `/systeme/certificats` | Système | administration |
| Sécurité | `/systeme/securite` | Système | administration |
| Sessions actives | `/systeme/sessions` | Système | administration |
| Journal d’audit | `/systeme/journal` | Système | administration |
| Journaux techniques | `/systeme/journaux-techniques` | Système | administration |
| Modules | `/systeme/modules` | Système | administration |
| Détails techniques | `/systeme/details` | Système | administration |
| /setup | `/setup` | Hors menu du pilotage | sans |
| /login | `/login` | Hors menu du pilotage | sans |
| /account | `/account` | Hors menu du pilotage | sans |
| /aide | `/aide` | Hors menu du pilotage | sans |
| /parametres/configuration-grc/:kind? | `/parametres/configuration-grc/:kind?` | Hors menu du pilotage | sans |
| /parametres/:section? | `/parametres/:section?` | Hors menu du pilotage | sans |
| /admin/:tab? | `/admin/:tab?` | Hors menu du pilotage | sans |

## Agent 7 : transversal

Tous les écrans ci-dessus. Pour chaque case, vérifier ce que le rôle voit, ce qu’il peut modifier, et ce que l’API
refuse quand l’interface masque le bouton (appel direct avec `pilote.mjs api`). Le passage transversal se fait
tranche par tranche, sur la pile déjà remplie par l’agent du domaine (`matrice.mjs modele 7 <tranche>`).
