# Cas de test

Référence applicative analysée : `f9545c3ce1a1338f13bb39bdaa4468bcc907da2d`. Mise à jour : 2026-10-11T22:10:00+02:00 (Europe/Paris).

Cas stables, référencés par fonctions/bugs/backlog. Les procédures des cas
automatisés résument le contrat ; consulter le fichier de test pour tous les
gestes/fixtures/assertions exacts. Les cas manuels ne sont jamais marqués passés
par existence du code.

## TEST-001 — Installation, connexion et TOTP

- Fonction : FCT-001 ; priorité : P1.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Installation avec jeton à usage unique, session complète après MFA, anti-rejeu et refus CSRF/origine.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Installation avec jeton à usage unique, session complète après MFA, anti-rejeu et refus CSRF/origine.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/security.test.ts](../../apps/api/test/security.test.ts) ; [tests/e2e/specs/parcours.spec.ts](../../tests/e2e/specs/parcours.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Recette du serveur utilisateur non reçue.

## TEST-002 — Comptes, groupes, rôles et revue des droits

- Fonction : FCT-002 ; priorité : P1.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Droits effectifs, périmètres auditeur, expiration, dernier administrateur et exports de revue.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Droits effectifs, périmètres auditeur, expiration, dernier administrateur et exports de revue.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/rbac.test.ts](../../apps/api/test/rbac.test.ts) ; [tests/e2e/specs/parcours.spec.ts](../../tests/e2e/specs/parcours.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Recette du serveur utilisateur non reçue.

## TEST-003 — Sessions et déconnexion synchronisée

- Fonction : FCT-003 ; priorité : P1.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Révocation serveur, purge privée, erreurs visibles, onglets et session murale indépendante.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Révocation serveur, purge privée, erreurs visibles, onglets et session murale indépendante.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/web/test/logout.test.ts](../../apps/web/test/logout.test.ts) ; [apps/api/test/security.test.ts](../../apps/api/test/security.test.ts) ; [tests/e2e/specs/z-fiabilisation.spec.ts](../../tests/e2e/specs/z-fiabilisation.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Recette du serveur utilisateur non reçue.

## TEST-004 — Documents, versions chiffrées et liens

- Fonction : FCT-004 ; priorité : P1.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Dépôt, téléchargement, versionnement et liens ; aucune copie physique par preuve métier.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Dépôt, téléchargement, versionnement et liens ; aucune copie physique par preuve métier.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/documents.test.ts](../../apps/api/test/documents.test.ts) ; [tests/e2e/specs/parcours.spec.ts](../../tests/e2e/specs/parcours.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Recette du serveur utilisateur non reçue.

## TEST-005 — Paramètres et charte Sauge

- Fonction : FCT-005 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Jetons, clair/sombre, paramètres par section, captures et contraste des combinaisons testées.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Jetons, clair/sombre, paramètres par section, captures et contraste des combinaisons testées.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [packages/ui/test/contraste.test.ts](../../packages/ui/test/contraste.test.ts) ; [apps/web/test/charte.test.ts](../../apps/web/test/charte.test.ts) ; [tests/e2e/specs/visuel.spec.ts](../../tests/e2e/specs/visuel.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Recette du serveur utilisateur non reçue.

## TEST-006 — Temps réel, présence et concurrence

- Fonction : FCT-006 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. SSE filtré, présence et If-Match ; pas de preuve de capacité multi-instance à grande charge.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : SSE filtré, présence et If-Match ; pas de preuve de capacité multi-instance à grande charge.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/realtime.test.ts](../../apps/api/test/realtime.test.ts) ; [tests/e2e/specs/parcours.spec.ts](../../tests/e2e/specs/parcours.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Recette du serveur utilisateur non reçue.

## TEST-007 — Écrans muraux

- Fonction : FCT-007 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Activation, cookie mural distinct, révocation et affichage aux tailles testées.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Activation, cookie mural distinct, révocation et affichage aux tailles testées.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/affichage.test.ts](../../apps/api/test/affichage.test.ts) ; [tests/e2e/specs/tous-ecrans.spec.ts](../../tests/e2e/specs/tous-ecrans.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Recette du serveur utilisateur non reçue.

## TEST-008 — Cartographie contexte et processus

- Fonction : FCT-008 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Canevas, objets, disposition, versions, filtres, exports et mapper maps ; parité des cas testés.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Canevas, objets, disposition, versions, filtres, exports et mapper maps ; parité des cas testés.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/carto.test.ts](../../apps/api/test/carto.test.ts) ; [packages/shared/test/carto-parite.test.ts](../../packages/shared/test/carto-parite.test.ts) ; [tests/e2e/specs/recette-cartographie.spec.ts](../../tests/e2e/specs/recette-cartographie.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Recette du serveur utilisateur non reçue.

## TEST-009 — Import, export et annulation legacy

- Fonction : FCT-009 ; priorité : P1.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Simulation et empreinte du contenu, initialisation/fusion/remplacement, aller-retour normalisé et annulation protégée.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Simulation et empreinte du contenu, initialisation/fusion/remplacement, aller-retour normalisé et annulation protégée.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/import.test.ts](../../apps/api/test/import.test.ts) ; [packages/shared/test/legacy.test.ts](../../packages/shared/test/legacy.test.ts) ; [tests/e2e/specs/parcours.spec.ts](../../tests/e2e/specs/parcours.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Recette du serveur utilisateur non reçue.

## TEST-010 — Sauvegardes web et planification

- Fonction : FCT-010 ; priorité : P1.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Sauvegarde réelle chiffrée depuis le menu sans cron supplémentaire sur installation Compose de recette.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Sauvegarde réelle chiffrée depuis le menu sans cron supplémentaire sur installation Compose de recette.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/backups.test.ts](../../apps/api/test/backups.test.ts) ; [tests/e2e/specs/systeme.spec.ts](../../tests/e2e/specs/systeme.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Recette du serveur utilisateur non reçue.

## TEST-011 — Vérification et restauration

- Fonction : FCT-011 ; priorité : P1.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Catalogue, contrôle, confirmation, exclusivité, sauvegarde préalable et restauration sur les environnements CI.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Catalogue, contrôle, confirmation, exclusivité, sauvegarde préalable et restauration sur les environnements CI.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/operations.test.ts](../../apps/api/test/operations.test.ts) ; [apps/api/test/restore-scripts.test.ts](../../apps/api/test/restore-scripts.test.ts) ; [tests/e2e/specs/y-exploitation.spec.ts](../../tests/e2e/specs/y-exploitation.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Recette du serveur utilisateur non reçue.

## TEST-012 — TLS et certificats

- Fonction : FCT-012 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Observation SAN, changements TLS autorisés, validation et retour arrière sur PKI de recette ; PKI client non vérifiée.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Observation SAN, changements TLS autorisés, validation et retour arrière sur PKI de recette ; PKI client non vérifiée.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/operations.test.ts](../../apps/api/test/operations.test.ts) ; [tests/e2e/specs/y-exploitation.spec.ts](../../tests/e2e/specs/y-exploitation.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Recette du serveur utilisateur non reçue.

## TEST-013 — Mise à jour intégrée et maintenance

- Fonction : FCT-013 ; priorité : P1.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Bandeau, rôle système administrateur, confirmation, maintenance indépendante, signatures, santé et retour arrière réels en CI.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Bandeau, rôle système administrateur, confirmation, maintenance indépendante, signatures, santé et retour arrière réels en CI.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/updates.test.ts](../../apps/api/test/updates.test.ts) ; [tests/e2e/specs/zy-updates.spec.ts](../../tests/e2e/specs/zy-updates.spec.ts) ; [scripts/ci/update-integree.py](../../scripts/ci/update-integree.py)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Ancien updater : premier redéploiement serveur nécessaire ; frontal entretenu séparément.

## TEST-014 — Activation des modules

- Fonction : FCT-014 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Simulation, dépendances, activation versionnée serveur, conservation des données et purge des caches.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Simulation, dépendances, activation versionnée serveur, conservation des données et purge des caches.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/modules.test.ts](../../apps/api/test/modules.test.ts) ; [tests/e2e/specs/zz-modules.spec.ts](../../tests/e2e/specs/zz-modules.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Recette du serveur utilisateur non reçue.

## TEST-015 — Configuration des échelles et matrices

- Fonction : FCT-015 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Simulation, matrices explicites, publication immuable, concurrence et refus des brouillons incohérents.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Simulation, matrices explicites, publication immuable, concurrence et refus des brouillons incohérents.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/environment.test.ts](../../apps/api/test/environment.test.ts) ; [tests/e2e/specs/zz-environment.spec.ts](../../tests/e2e/specs/zz-environment.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Recette du serveur utilisateur non reçue.

## TEST-016 — Décisions IA versionnées B2b

- Fonction : FCT-016 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Décision immuable liée à la source IA et à une configuration choisie ; calcul aiEval et source historique conservés.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Décision immuable liée à la source IA et à une configuration choisie ; calcul aiEval et source historique conservés.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/risk-assessments.test.ts](../../apps/api/test/risk-assessments.test.ts) ; [tests/e2e/specs/zz-ia-evaluations.spec.ts](../../tests/e2e/specs/zz-ia-evaluations.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Ne constitue pas la reprise complète du registre IA (FCT-032).

## TEST-017 — Catalogue métier et politiques

- Fonction : FCT-017 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Nomenclatures, statuts/workflows et adoption explicite versionnée ; raccordement B2 complet non établi.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Nomenclatures, statuts/workflows et adoption explicite versionnée ; raccordement B2 complet non établi.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/grc-security.test.ts](../../apps/api/test/grc-security.test.ts) ; [tests/e2e/specs/zz-grc.spec.ts](../../tests/e2e/specs/zz-grc.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Raccordements des familles historiques et nomenclatures spécifiques B2 à terminer.

## TEST-018 — Contexte, parties intéressées et responsabilités

- Fonction : FCT-018 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Adaptateurs directs du périmètre commun, champs supplémentaires et responsabilités sans ID conservés.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Adaptateurs directs du périmètre commun, champs supplémentaires et responsabilités sans ID conservés.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/pilotage.test.ts](../../apps/api/test/pilotage.test.ts) ; [tests/e2e/specs/zzz-pilotage.spec.ts](../../tests/e2e/specs/zzz-pilotage.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Recette du serveur utilisateur non reçue.

## TEST-019 — Processus, objectifs et indicateurs

- Fonction : FCT-019 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Édition contrôlée, séries de valeurs historiques conservées, indicateurs automatiques protégés ; vues « Par processus » et « Vue compacte » avec états d’indicateurs calculés comme l’outil historique (test de parité).
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Édition contrôlée, séries de valeurs historiques conservées, indicateurs automatiques protégés ; vues « Par processus » et « Vue compacte » avec états d’indicateurs calculés comme l’outil historique (test de parité).
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/pilotage.test.ts](../../apps/api/test/pilotage.test.ts) ; [packages/shared/test/tableau-de-bord.test.ts](../../packages/shared/test/tableau-de-bord.test.ts) ; [tests/e2e/specs/zzzz-pilotage.spec.ts](../../tests/e2e/specs/zzzz-pilotage.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Recette du serveur utilisateur non reçue.

## TEST-020 — Référentiels, exigences et correspondances

- Fonction : FCT-020 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Publications, activation, mappings révisables, simulations/imports ; sources normatives sous licence non redistribuées.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Publications, activation, mappings révisables, simulations/imports ; sources normatives sous licence non redistribuées.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/grc-frameworks.test.ts](../../apps/api/test/grc-frameworks.test.ts) ; [tests/e2e/specs/zz-grc.spec.ts](../../tests/e2e/specs/zz-grc.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Moteur C validé ; audit/couverture annuelle et GAP historiques non entièrement migrés.

## TEST-021 — Actions et tâches récurrentes

- Fonction : FCT-021 ; priorité : P1.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Actions communes, cinq vues synchronisées, séries/occurrences idempotentes, calendrier/fuseau et rappels internes.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Actions communes, cinq vues synchronisées, séries/occurrences idempotentes, calendrier/fuseau et rappels internes.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/grc.test.ts](../../apps/api/test/grc.test.ts) ; [packages/shared/test/grc.test.ts](../../packages/shared/test/grc.test.ts) ; [tests/e2e/specs/zz-grc.spec.ts](../../tests/e2e/specs/zz-grc.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Transport email exclu ; pas de migration automatique de toutes les récurrences historiques.

## TEST-022 — Méthodes et évaluations des risques

- Fonction : FCT-022 ; priorité : P1.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. EBIOS cinq ateliers, jugement/matrice/règles distincts, brut/résiduel immuables ; aucune réévaluation automatique après action.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : EBIOS cinq ateliers, jugement/matrice/règles distincts, brut/résiduel immuables ; aucune réévaluation automatique après action.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/grc.test.ts](../../apps/api/test/grc.test.ts) ; [apps/api/test/grc-security.test.ts](../../apps/api/test/grc-security.test.ts) ; [tests/e2e/specs/zz-grc.spec.ts](../../tests/e2e/specs/zz-grc.spec.ts) ; [apps/api/test/risques.test.ts](../../apps/api/test/risques.test.ts) ; [packages/shared/test/risques.test.ts](../../packages/shared/test/risques.test.ts) ; [tests/e2e/specs/zzzz-risques.spec.ts](../../tests/e2e/specs/zzzz-risques.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : ISO/MÉHARI : modèles configurables ; exhaustivité d’une méthode normative ou des classeurs officiels non certifiée.

## TEST-023 — Cartographie des risques

- Fonction : FCT-023 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Projection du registre, graphe, filtres, couleurs versionnées, détail, exports et comparaisons compatibles ; sans double saisie.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Projection du registre, graphe, filtres, couleurs versionnées, détail, exports et comparaisons compatibles ; sans double saisie.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/grc.test.ts](../../apps/api/test/grc.test.ts) ; [tests/e2e/specs/zz-grc.spec.ts](../../tests/e2e/specs/zz-grc.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Volumes bornés ; benchmark de charge et ergonomie sur grands graphes non réalisés.

## TEST-024 — Preuves et plan de contrôle G

- Fonction : FCT-024 ; priorité : P1.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Versions documentaires effectivement examinées, contrôle/résultat immuable, constat et action atomiques, récurrences.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Versions documentaires effectivement examinées, contrôle/résultat immuable, constat et action atomiques, récurrences.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/pilotage.test.ts](../../apps/api/test/pilotage.test.ts) ; [tests/e2e/specs/zzz-pilotage.spec.ts](../../tests/e2e/specs/zzz-pilotage.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Recette du serveur utilisateur non reçue.

## TEST-025 — Amélioration continue H

- Fonction : FCT-025 ; priorité : P1.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Causes, actions, efficacité et clôture gardées côté serveur ; agrégats fonctionnels sur 10 000 constats.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Causes, actions, efficacité et clôture gardées côté serveur ; agrégats fonctionnels sur 10 000 constats.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/pilotage.test.ts](../../apps/api/test/pilotage.test.ts) ; [tests/e2e/specs/zzz-pilotage.spec.ts](../../tests/e2e/specs/zzz-pilotage.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Recette du serveur utilisateur non reçue.

## TEST-026 — Parcours guidé qualité/sécurité/HDS K

- Fonction : FCT-026 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Onze étapes, reprise et validation historisée sur objets communs ; création de SMSI non imposée.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Onze étapes, reprise et validation historisée sur objets communs ; création de SMSI non imposée.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/pilotage.test.ts](../../apps/api/test/pilotage.test.ts) ; [tests/e2e/specs/zzz-pilotage.spec.ts](../../tests/e2e/specs/zzz-pilotage.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : L’avancement ne constitue ni conformité ni certification ; recette humaine en attente.

## TEST-027 — BIA, continuité, exercices et RETEX E

- Fonction : FCT-027 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Formulaires génériques, impacts temporels, objectifs cohérents, validations et rapports HTML/JSON testés.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Formulaires génériques, impacts temporels, objectifs cohérents, validations et rapports HTML/JSON testés.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/pilotage.test.ts](../../apps/api/test/pilotage.test.ts) ; [tests/e2e/specs/zzz-pilotage.spec.ts](../../tests/e2e/specs/zzz-pilotage.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Kits/grilles ANS, configuration des méthodes de continuité et reprise complète plans/crise manquent.

## TEST-028 — Audit et couverture annuelle historique

- Fonction : FCT-028 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Programme d’audit interne affiché en lecture seule dans « Audits internes » ; socle partagé @suivi/shared/audit (pronostic en parité avec l’outil historique) sans écran propre ; couverture interne/certification par année encore historique.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Programme d’audit interne affiché en lecture seule dans « Audits internes » ; socle partagé @suivi/shared/audit (pronostic en parité avec l’outil historique) sans écran propre ; couverture interne/certification par année encore historique.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [packages/shared/test/audit.test.ts](../../packages/shared/test/audit.test.ts) ; [packages/shared/test/audit-parite.test.ts](../../packages/shared/test/audit-parite.test.ts) ; [tests/e2e/specs/zzzz-pilotage.spec.ts](../../tests/e2e/specs/zzzz-pilotage.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Écrans Audit natifs (AUD-01 à AUD-16 hors socle) non livrés ; couverture annuelle historique à reprendre.

## TEST-029 — Planning et créneaux d’audit historiques

- Fonction : FCT-029 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Inventorier la source historique, créer une fiche fictive, modifier, consulter, filtrer, exporter et comparer aux données/relations avant modification.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Même capacité et mêmes données/relations ; écarts documentés, aucun abandon implicite.
- Type / automatisation : MANUEL ; À PRÉPARER.
- Code de référence : Aucun test automatisé dédié identifié pour ce cas complet.
- Dernier statut : NON EXÉCUTÉ ; preuve : Aucune.
- Limite : Migration et recette des participants, questions et preuves attendues à établir.

## TEST-030 — Déclaration d’applicabilité historique

- Fonction : FCT-030 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. La DdA de l’outil de suivi s’affiche et se modifie dans « Applicabilité » sans copie (entrée réécrite sous verrou, version, journal) ; équivalence avec le registre SoA natif non démontrée.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : La DdA de l’outil de suivi s’affiche et se modifie dans « Applicabilité » sans copie (entrée réécrite sous verrou, version, journal) ; équivalence avec le registre SoA natif non démontrée.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/api/test/pilotage-dda.test.ts](../../apps/api/test/pilotage-dda.test.ts) ; [tests/e2e/specs/zzzz-pilotage.spec.ts](../../tests/e2e/specs/zzzz-pilotage.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Correspondance de dda vers SoA et recette métier à établir ; recette du serveur utilisateur non reçue.

## TEST-031 — Fournisseurs et évaluations historiques

- Fonction : FCT-031 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Inventorier la source historique, créer une fiche fictive, modifier, consulter, filtrer, exporter et comparer aux données/relations avant modification.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Même capacité et mêmes données/relations ; écarts documentés, aucun abandon implicite.
- Type / automatisation : MANUEL ; À PRÉPARER.
- Code de référence : Aucun test automatisé dédié identifié pour ce cas complet.
- Dernier statut : NON EXÉCUTÉ ; preuve : Aucune.
- Limite : Reprendre registre, évaluations, contacts, certifications, fréquence et exports ; maintien legacy requis.

## TEST-032 — Registre IA, plans et politiques historiques

- Fonction : FCT-032 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Inventorier la source historique, créer une fiche fictive, modifier, consulter, filtrer, exporter et comparer aux données/relations avant modification.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Même capacité et mêmes données/relations ; écarts documentés, aucun abandon implicite.
- Type / automatisation : MANUEL ; À PRÉPARER.
- Code de référence : Aucun test automatisé dédié identifié pour ce cas complet.
- Dernier statut : NON EXÉCUTÉ ; preuve : Aucune.
- Limite : Reprise fonctionnelle IA distincte du futur assistant MCP J, exclu.

## TEST-033 — CRRC, établissements et offres

- Fonction : FCT-033 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Inventorier la source historique, créer une fiche fictive, modifier, consulter, filtrer, exporter et comparer aux données/relations avant modification.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Même capacité et mêmes données/relations ; écarts documentés, aucun abandon implicite.
- Type / automatisation : MANUEL ; À PRÉPARER.
- Code de référence : Aucun test automatisé dédié identifié pour ce cas complet.
- Dernier statut : NON EXÉCUTÉ ; preuve : Aucune.
- Limite : CRRC-01 à CRRC-04 au backlog ; offres/statuts/carte/exports attendent cadrage autorisé.

## TEST-034 — Investissements et prospection

- Fonction : FCT-034 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Inventorier la source historique, créer une fiche fictive, modifier, consulter, filtrer, exporter et comparer aux données/relations avant modification.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Même capacité et mêmes données/relations ; écarts documentés, aucun abandon implicite.
- Type / automatisation : MANUEL ; À PRÉPARER.
- Code de référence : Aucun test automatisé dédié identifié pour ce cas complet.
- Dernier statut : NON EXÉCUTÉ ; preuve : Aucune.
- Limite : Filtres/vues et prospection au backlog ; lot D exclu de la livraison actuelle.

## TEST-035 — Incidents, crise et main courante

- Fonction : FCT-035 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Inventorier la source historique, créer une fiche fictive, modifier, consulter, filtrer, exporter et comparer aux données/relations avant modification.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Même capacité et mêmes données/relations ; écarts documentés, aucun abandon implicite.
- Type / automatisation : MANUEL ; À PRÉPARER.
- Code de référence : Aucun test automatisé dédié identifié pour ce cas complet.
- Dernier statut : NON EXÉCUTÉ ; preuve : Aucune.
- Limite : INC-01 à INC-03, déclarations, événements et COMSEC à cadrer ; aucun abandon décidé.

## TEST-036 — Revues d’accès métier historiques

- Fonction : FCT-036 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Inventorier la source historique, créer une fiche fictive, modifier, consulter, filtrer, exporter et comparer aux données/relations avant modification.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Même capacité et mêmes données/relations ; écarts documentés, aucun abandon implicite.
- Type / automatisation : MANUEL ; À PRÉPARER.
- Code de référence : Aucun test automatisé dédié identifié pour ce cas complet.
- Dernier statut : NON EXÉCUTÉ ; preuve : Aucune.
- Limite : Reprise périodique et preuve de réalisation des revues métier à spécifier.

## TEST-037 — Revues de direction

- Fonction : FCT-037 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Inventorier la source historique, créer une fiche fictive, modifier, consulter, filtrer, exporter et comparer aux données/relations avant modification.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Même capacité et mêmes données/relations ; écarts documentés, aucun abandon implicite.
- Type / automatisation : MANUEL ; À PRÉPARER.
- Code de référence : Aucun test automatisé dédié identifié pour ce cas complet.
- Dernier statut : NON EXÉCUTÉ ; preuve : Aucune.
- Limite : Tester les sous-sections historiques, décisions, suivis et validation de bout en bout.

## TEST-038 — Plans historiques et sous-sections

- Fonction : FCT-038 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Programme d’audit interne et plan d’exercices de l’outil de suivi affichés en lecture seule (retards signalés), avec lien vers leur planification ; aucune migration vers continuity_plan.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Programme d’audit interne et plan d’exercices de l’outil de suivi affichés en lecture seule (retards signalés), avec lien vers leur planification ; aucune migration vers continuity_plan.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [packages/shared/test/tableau-de-bord.test.ts](../../packages/shared/test/tableau-de-bord.test.ts) ; [tests/e2e/specs/zzzz-pilotage.spec.ts](../../tests/e2e/specs/zzzz-pilotage.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Édition dans le Pilotage, autres plans et sous-sections, types/champs et liens à inventorier avant migration vers le début E.

## TEST-039 — Aide embarquée et navigation métier

- Fonction : FCT-039 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Recherche sans accents, contenu filtré, navigation au clic sur bureau et téléphone.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Recherche sans accents, contenu filtré, navigation au clic sur bureau et téléphone.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/web/test/help.test.ts](../../apps/web/test/help.test.ts) ; [tests/e2e/specs/z-fiabilisation.spec.ts](../../tests/e2e/specs/z-fiabilisation.spec.ts) ; [tests/e2e/specs/zzz-pilotage.spec.ts](../../tests/e2e/specs/zzz-pilotage.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Recette du serveur utilisateur non reçue.

## TEST-040 — Rapports natifs et exports métier

- Fonction : FCT-040 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Rapports HTML imprimables/JSON et exports cartographiques ; cinq bibliothèques legacy identiques.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Rapports HTML imprimables/JSON et exports cartographiques ; cinq bibliothèques legacy identiques.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [apps/web/test/pilotage-report.test.ts](../../apps/web/test/pilotage-report.test.ts) ; [tests/e2e/specs/zzz-pilotage.spec.ts](../../tests/e2e/specs/zzz-pilotage.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Les exports Word/PowerPoint serveur de la feuille de route ne sont pas déclarés implémentés.

## TEST-041 — Installation serveur client

- Fonction : FCT-010 ; priorité : P1.
- Prérequis : Autorisation et environnement de recette adaptés ; aucun essai destructif en production.
- Données : Jeux fictifs ou données serveur uniquement sous contrôle de leur responsable.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Préparer le scénario, consigner contexte/version, effectuer le parcours puis relever résultat et réserves.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Pilotage au clic, heartbeat exploitation, sauvegarde chiffrée réelle et données anciennes présentes.
- Type / automatisation : MANUEL ; PARTIELLE OU À PRÉPARER.
- Code de référence : Aucun test automatisé dédié identifié pour ce cas complet.
- Dernier statut : NON EXÉCUTÉ ; preuve : Aucune.
- Limite : Aucun résultat ni validation humaine reçus.

## TEST-042 — Acceptation ergonomique humaine

- Fonction : FCT-026 ; priorité : P1.
- Prérequis : Autorisation et environnement de recette adaptés ; aucun essai destructif en production.
- Données : Jeux fictifs ou données serveur uniquement sous contrôle de leur responsable.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Préparer le scénario, consigner contexte/version, effectuer le parcours puis relever résultat et réserves.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Utilisateur comprend le menu métier et valide les parcours bureau/téléphone sans jargon technique imposé.
- Type / automatisation : MANUEL ; PARTIELLE OU À PRÉPARER.
- Code de référence : Aucun test automatisé dédié identifié pour ce cas complet.
- Dernier statut : NON EXÉCUTÉ ; preuve : Aucune.
- Limite : Aucun résultat ni validation humaine reçus.

## TEST-043 — Performance aux volumes cibles

- Fonction : FCT-023 ; priorité : P2.
- Prérequis : Autorisation et environnement de recette adaptés ; aucun essai destructif en production.
- Données : Jeux fictifs ou données serveur uniquement sous contrôle de leur responsable.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Préparer le scénario, consigner contexte/version, effectuer le parcours puis relever résultat et réserves.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Budgets de latence/mémoire et comportement de la carte mesurés sur jeu fictif représentatif.
- Type / automatisation : MANUEL ; PARTIELLE OU À PRÉPARER.
- Code de référence : Aucun test automatisé dédié identifié pour ce cas complet.
- Dernier statut : NON EXÉCUTÉ ; preuve : Aucune.
- Limite : Aucun résultat ni validation humaine reçus.

## TEST-044 — Référentiels officiels et continuité

- Fonction : FCT-027 ; priorité : P2.
- Prérequis : Autorisation et environnement de recette adaptés ; aucun essai destructif en production.
- Données : Jeux fictifs ou données serveur uniquement sous contrôle de leur responsable.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Préparer le scénario, consigner contexte/version, effectuer le parcours puis relever résultat et réserves.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Documents officiels exacts accessibles et droits validés ; limites normatives distinguées des choix organisationnels.
- Type / automatisation : MANUEL ; PARTIELLE OU À PRÉPARER.
- Code de référence : Aucun test automatisé dédié identifié pour ce cas complet.
- Dernier statut : NON EXÉCUTÉ ; preuve : Aucune.
- Limite : Aucun résultat ni validation humaine reçus.

## TEST-045 — Reprise complète hors serveur

- Fonction : FCT-011 ; priorité : P1.
- Prérequis : Autorisation et environnement de recette adaptés ; aucun essai destructif en production.
- Données : Jeux fictifs ou données serveur uniquement sous contrôle de leur responsable.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Préparer le scénario, consigner contexte/version, effectuer le parcours puis relever résultat et réserves.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Archive, clé gardée séparément et configuration restaurées sur serveur de recette autorisé ; contrôles de données réussis.
- Type / automatisation : MANUEL ; PARTIELLE OU À PRÉPARER.
- Code de référence : Aucun test automatisé dédié identifié pour ce cas complet.
- Dernier statut : NON EXÉCUTÉ ; preuve : Aucune.
- Limite : Aucun résultat ni validation humaine reçus.

## TEST-046 — Tableau de bord unifié et graphiques

- Fonction : FCT-041 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Graphiques conformité par référentiel, écarts par type, actions, objectifs/indicateurs et plans calculés comme l’outil historique (tests de parité) ; composants SVG sans dépendance, contrastes vérifiés.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Graphiques conformité par référentiel, écarts par type, actions, objectifs/indicateurs et plans calculés comme l’outil historique (tests de parité) ; composants SVG sans dépendance, contrastes vérifiés.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [packages/shared/test/tableau-de-bord.test.ts](../../packages/shared/test/tableau-de-bord.test.ts) ; [packages/ui/test/graphiques.test.ts](../../packages/ui/test/graphiques.test.ts) ; [tests/e2e/specs/zzzz-pilotage.spec.ts](../../tests/e2e/specs/zzzz-pilotage.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Seuls les graphiques repris sont couverts ; autres vues du tableau de bord historique non inventoriées une à une ; recette du serveur utilisateur non reçue.

## TEST-047 — Études EBIOS RM, processus ISO/IEC 27005 et registre des risques

- Fonction : FCT-042 ; priorité : P1.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Étude EBIOS RM en cinq ateliers d’objets typés avec validation tracée, fiche de risque ISO/IEC 27005, acceptation formelle immuable avec échéance, registre filtrable, références typées contrôlées par le serveur.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Étude EBIOS RM en cinq ateliers d’objets typés avec validation tracée, fiche de risque ISO/IEC 27005, acceptation formelle immuable avec échéance, registre filtrable, références typées contrôlées par le serveur.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [packages/shared/test/risques.test.ts](../../packages/shared/test/risques.test.ts) ; [apps/api/test/risques.test.ts](../../apps/api/test/risques.test.ts) ; [tests/e2e/specs/zzzz-risques.spec.ts](../../tests/e2e/specs/zzzz-risques.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Aucune conformité à EBIOS RM ou à l’ISO/IEC 27005 revendiquée ni certifiée ; recette métier et du serveur utilisateur non reçues.

## TEST-048 — Liens transverses et catalogue de relations

- Fonction : FCT-043 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Relations acceptées seulement pour les paires prévues (422 sinon, « Lié à » ouvert), sens lisible des deux côtés, objets archivés signalés et fermés aux nouveaux liens, données historiques limitées au périmètre commun, responsables proposés limités aux comptes autorisés.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Relations acceptées seulement pour les paires prévues (422 sinon, « Lié à » ouvert), sens lisible des deux côtés, objets archivés signalés et fermés aux nouveaux liens, données historiques limitées au périmètre commun, responsables proposés limités aux comptes autorisés.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [packages/shared/test/liens.test.ts](../../packages/shared/test/liens.test.ts) ; [apps/api/test/liens.test.ts](../../apps/api/test/liens.test.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Panneau branché depuis le registre des risques seulement ; parcours navigateur dédié non écrit ; recette du serveur utilisateur non reçue.

## TEST-049 — Socle partagé Audit (sans écran)

- Fonction : FCT-044 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Modèle, pronostic en parité avec l’outil historique, règles des écarts et du plan d’actions, schémas zod, vérifiés par tests unitaires.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Modèle, pronostic en parité avec l’outil historique, règles des écarts et du plan d’actions, schémas zod, vérifiés par tests unitaires.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [packages/shared/test/audit.test.ts](../../packages/shared/test/audit.test.ts) ; [packages/shared/test/audit-parite.test.ts](../../packages/shared/test/audit-parite.test.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Aucun écran ni route Audit natifs ; le socle seul ne constitue pas la reprise du module Audit.

## TEST-050 — Cartographie : création depuis la carte, notes et cadres libres

- Fonction : FCT-045 ; priorité : P2.
- Prérequis : Jeu fictif ; rôles adaptés ; environnement dédié si API ou Docker.
- Données : Données synthétiques et identifiants créés par le test ; aucune donnée de production.
- Procédure :
  1. Identifier version/commit, permissions et environnement isolé.
  2. Création d’objets dans leur module avec sa permission (sous verrou, journalisée), renommage, notes et cadres libres, carte vierge, appui long, alignement ; aucune suppression d’objet depuis la carte.
  3. Relever le résultat effectif, l’erreur éventuelle et les réserves, sans secret.
- Résultat attendu : Création d’objets dans leur module avec sa permission (sous verrou, journalisée), renommage, notes et cadres libres, carte vierge, appui long, alignement ; aucune suppression d’objet depuis la carte.
- Type / automatisation : AUTOMATISÉ ; EXISTANTE.
- Code de référence : [packages/shared/test/carto-creation.test.ts](../../packages/shared/test/carto-creation.test.ts) ; [apps/api/test/carto.test.ts](../../apps/api/test/carto.test.ts) ; [tests/e2e/specs/recette-cartographie.spec.ts](../../tests/e2e/specs/recette-cartographie.spec.ts)
- Dernier statut : PASSÉ ; preuve : EXE-013.
- Limite : Parcours exécutés sur données fictives ; recette du serveur utilisateur non reçue.
