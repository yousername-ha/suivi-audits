# ADR 0032 — Gestion des fournisseurs de l'organisation : évaluation indépendante des périmètres (lot M4)

**Statut** : proposée le 13/10/2026. Met en œuvre les décisions D5, D6 et D11 du [cadrage](../unification/CADRAGE-MODULE-QUALITE-9001.md)
(§4.4) et l'[ADR 0030](0030-perimetre-agnostique-qualite-fournisseurs.md). Le RSSI : « un fournisseur évalué peut être sur plusieurs
périmètres en même temps ; mon évaluation de lui n'a pas changé, peu importe le périmètre » ; **pas de grille pour le moment**.

## Contexte (constats de lecture du code)

- Le registre des fournisseurs est la clé `suppliers` de l'état historique (`app_state`), **à l'échelle de l'instance** : un
  fournisseur (`id`, `name`, `saas`, `rattachement`, `critical`, `hds`, `contact`, `notes`, `controls[]`, `certs[]`) n'appartient à
  aucun périmètre. L'outil historique l'édite sous verrou (`legacyWrite`), et les indicateurs calculés (`saasMfa`, `saasSso`) le lisent.
- Les objets du registre commun (`control`, `action`, `task_series`) ont un périmètre **obligatoire** : y stocker l'évaluation la
  rattacherait à un périmètre.
- Les références `legacy:` ne se résolvent que dans le périmètre commun (`core.ts`).

## Décision

1. **Le fournisseur reste celui du registre historique** : pas de copie, identité = identifiant historique. Le module en offre
   la lecture et la **création** (identifiant, nom) sous verrou ; les autres champs historiques restent modifiables dans
   l'outil historique (lien depuis la page). Droit : module `fournisseurs`.
2. **Critères d'évaluation** définis par l'organisme, **aucun fourni** (D6). Un critère porte un libellé, une description, des
   **usages** pris dans le texte de l'ISO 9001:2015 8.4.1 (sélection, évaluation, surveillance des performances, réévaluation)
   et des **exigences visées** de la bibliothèque (`requirement:…`), sans dépendre d'un périmètre. Chaque modification crée une
   version ; un instantané immuable est conservé. Droit de définir : `fournisseurs:administrer`.
3. **Évaluations immuables, sans périmètre** : date, évaluateur, conclusion libre, date de prochaine réévaluation facultative
   (aucune fréquence par défaut), et une ligne par critère retenu : libellé et version du critère **figés**, « répond »
   (oui / non / non évalué : **pas une échelle**, aucun seuil, aucun score) et un résultat libre. Une correction se fait par une
   nouvelle évaluation ; la plus récente est « courante », les autres restent consultables. Droit : `fournisseurs:modifier`.
4. **Rattachement à des périmètres** : lien fournisseur ↔ périmètre, plusieurs à la fois, **sans donnée d'évaluation**. Le retirer
   ne supprime ni le fournisseur ni ses évaluations. Droit : `fournisseurs:modifier` et écriture sur le périmètre.
5. **Lecture par périmètre** (sans copie) : fournisseurs rattachés, évalués, non évalués, à réévaluer (date dépassée). La même
   évaluation est affichée quel que soit le périmètre. Chiffres d'aide au pilotage, pas un résultat de conformité.
6. **Reporté (M4 suite)** : action ou constat née d'une évaluation dans un périmètre choisi (D11), série de ré-évaluation.
   Obstacle constaté : `legacy:suppliers:<id>` n'est résolu que dans le périmètre commun ; il faudra une référence propre
   (`supplier:<id>`) au catalogue des liens avant de relier une action d'un autre périmètre. Rien n'est simulé en attendant.
7. **ISO/IEC 27001:2022 et HDS** : aucune exigence citée ; elles viendront des référentiels importés dans la bibliothèque.

## Conséquences

- Migration additive `020_fournisseurs_organisation.sql` : `sup_criteria`, `sup_criterion_history`, `sup_evaluations`,
  `sup_evaluation_items`, `sup_scope_links`. Aucune table existante n'est modifiée ; le registre historique est inchangé.
- Un fournisseur retiré du registre historique garde ses évaluations (nom figé dans l'évaluation).
- Le module est inactif si le module `fournisseurs` est désactivé.
