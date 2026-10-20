# Audit Codex / Claude — 18 octobre 2026

## Conclusion et périmètre

Les trois dossiers Codex sont **trois étapes d'un même dépôt**, pas trois applications ni trois worktrees. Il n'y a donc pas trois implémentations à fusionner. Le socle Claude fournit déjà une grande partie des fonctions demandées, y compris les deux styles globaux. La priorité est de raccorder les propositions ASTRA aux contrats existants et de corriger les prescriptions anciennes qui feraient reconstruire ces fonctions.

Audit de code et de documentation, avec consultation des résultats CI publics. Aucun build, test, checkout, modification de référence ou écriture n'a été effectué dans un environnement Claude. Une copie Git isolée sous `/workspace/work/audit-convergence-20261018/` a servi à la lecture. Les modifications non commitées de l'environnement distant Claude ne sont pas accessibles : leur état reste **indéterminé**.

Références figées pour rendre ces conclusions vérifiables :

- Codex : `legacy`, `3b5ee9f83207fa33be0ce06f18fe4bbb20ab1d89` avant cet incrément.
- [Claude : arbre d044eb9](https://github.com/yousername-ha/suivi-audits/tree/d044eb9265930b55029f9dae46be8f21edc0bca0), branche `claude-suivi-smsi`, version déclarée 3.4.0. Référence retenue d'après son code, son historique et ses documents d'agents ; à réviser si l'utilisateur désigne une autre branche.
- `claude/audit-suivi-docker-github-0pfu4y` : `23e7aba02a2752da1323f8dd3a3fbc2ae409b1ef`, ancienne ligne de travail. Elle ne représente pas le même avancement que le socle ci-dessus.
- `main` observée : `ed6190361f1b03bf87a21e9b85c63f8fe25bbf81`. Aucune fusion ni modification de cette branche.

Les chemins Claude mentionnés ci-dessous se lisent dans l'arbre **d044eb9**, pas dans les fichiers homonymes locaux non suivis.

## 1. Cartographie des trois dossiers

Racine commune : `/workspace/suivi-audits`, dépôt `https://github.com/yousername-ha/suivi-audits.git`, branche active `legacy`. Un seul worktree recensé dans ce dépôt. Aucun des trois dossiers ne possède son propre `.git` ni son propre manifeste de dépendances.

| Chemin relatif à la racine | Rôle vérifié | Contenu au début de l'audit | État Git initial |
| --- | --- | --- | --- |
| `fonctionnalites-en-developpement/` | Maquettes, dossiers préparatoires, recettes et ressources communes | 321 fichiers, dont 148 Markdown, 8 HTML, 13 JS, 14 CSS, 42 PNG ; 21 fonctionnalités numérotées et ressources transversales | Fichiers suivis sans modification ; `010-perimetres/maquettes/v002-organigramme-heritage/` non suivi, travail en cours conservé |
| `fonctionnalites-a-implementer/` | Dossiers validés à transmettre pour codage | Un README ; aucune fonctionnalité déplacée ici | Propre |
| `fonctionnalites-implementees/` | Fonctionnalités intégrées avec preuve de recette | Un README ; aucune fonctionnalité déplacée ici | Propre |

Ces nombres incluent le brouillon 010 non suivi et décrivent l'état avant le nettoyage documentaire. Les fichiers non suivis `apps/`, `packages/`, `tests/e2e/`, hors des trois dossiers, sont conservés sans modification ni ajout au commit. La copie extraite sous `onboarding-suivi/` n'est pas assimilée à un quatrième espace autorisé.

Technologies Codex : maquettes HTML/CSS/JavaScript autonomes, stockage navigateur et données fictives ; lanceurs BAT ; scripts de recette CJS/Playwright et utilitaires Python. Les captures statiques ne sont pas des composants connectés. L'absence de `package.json` dans les trois étapes ne permet pas d'y annoncer un build React, un typage ou un lint applicatif réussi.

## 2. Socle Claude : fonctions réellement trouvées

Stack constatée dans les manifestes : React 19, Vite 7, Mantine 8, TanStack Query 5, Fastify 5, PostgreSQL/Drizzle, Zod ; paquets `@suivi/shared` et `@suivi/ui`. Node >= 26 et pnpm 10 sont déclarés. Les anciens adaptateurs écrivent dans leur source historique au lieu de dupliquer les objets.

**Qualification des tests :** « testée CI » signifie qu'un test ciblé est présent et que sa suite passe sur le SHA audité. Cela ne garantit pas tous les cas du module ni une recette utilisateur. Aucun de ces tests n'a été relancé dans Claude par cet audit.

| Fonction | État du périmètre vérifié | Modèles, services, API et UI constatés | Contrôles / limites et conséquence Codex |
| --- | --- | --- | --- |
| Organisation / entités | Partiellement implémentée | Paramètres d'identité d'organisation ; contexte et champs d'entité dans les objets | Aucun CRUD générique d'organisations/entités hiérarchiques identifié. Ne pas confondre identité d'instance et organigramme |
| Périmètres | Implémentée et testée CI pour CRUD et accès | `SmsiCreate/Update`, `grc_smsis`, `grc/core.ts`, `/api/grc/smsis`, `pilotage/Perimetres.tsx` ; `perimetres.test.ts` | `pilotage:administrer`, périmètre restreint, membres, If-Match à la modification. Réutiliser ces formulaires et commandes |
| Hiérarchie parent/enfant, héritage GHT | Absente des contrats inspectés | Aucun `parentId` dans `SmsiCreate/Update` ni `grc_smsis` ; pas de propagation dans les rattachements | La maquette 010 reste une proposition. Contrat métier nécessaire avant raccordement ; aucune API concurrente à créer |
| Référentiels ISO 27001 / HDS / ISO 9001 | Implémentée et testée CI pour bibliothèque, versions et rattachements | `grc/library.ts`, `frameworks.ts`, `routes/grc.ts`, `Bibliotheque.tsx`, `library.test.ts`, `grc-frameworks.test.ts` | Import/publication/version/activation explicites, permissions et contrôles serveur. Le contenu normatif réellement chargé chez l'utilisateur n'est pas vérifiable ici |
| Exigences, mesures, contrôles, rapprochements | Implémentée et testée CI sur les parcours couverts | Objets `requirement`, `measure`, `control`, mappings ; `rapprochements.ts`, `Couverture.tsx`, `RecordEditor.tsx` | Une correspondance proposée n'est pas une conformité acquise. Conserver les références versionnées et les décisions humaines |
| Évaluations | Implémentée et testée CI sur risques, DDA et fournisseurs | `risk-assessments.ts`, `grc/risks.ts`, `grc/suppliers.ts`, services DDA ; tests associés | Plusieurs objets d'évaluation distincts : ne pas inventer un schéma universel à partir des JSON de démo |
| DDA / SoA | Implémentée et testée CI sur la DDA reprise | `shared/src/suivi-dda.ts`, `/api/dda`, `/api/dda/:id`, sections `dda-iso`, `dda-annexe-a`, `dda-hds` ; `historique-dda.test.ts`, `pilotage-dda.test.ts` | **DDA = Déclaration d'applicabilité**. Pages ISO/A/HDS, niveaux Total/Partiel/Insuffisant. Le kind `soa` existe aussi : suivre la source de chaque objet, sans seconde copie éditable |
| Risques et EBIOS RM | Implémentée et testée CI pour les contrats inspectés | `shared/src/risques.ts`, `grc/risks.ts`, routes évaluation/registre/études ; `Risques`, `Pilotage`, tests `risk-assessments`, `config-grc-etudes` | Évaluation et décision distinctes ; liens typés ; études/configurations versionnées. Conserver les visualisations Codex, réutiliser les calculs serveur |
| Plans et actions | Partiellement implémentée relativement à la demande de registres multiples | Kind `action`, traitements, tâches ; `/api/plans` et `/api/plans/:id/ecart`, `pilotage/Plans.tsx`, `historique-audit.test.ts` | Plans historiques de programmation ≠ preuve d'un modèle identique aux registres multi-plans de 021. Clarifier le regroupement avant de mapper les IDs fictifs |
| Tâches récurrentes | Implémentée et testée CI dans la suite GRC | `shared/src/recurrence.ts`, `grc/tasks.ts`, `legacy-tasks.ts`, routes séries/occurrences, vue récurrences | Réutiliser moteur et réalisations ; la projection d'une série n'est pas une occurrence indépendante à créer |
| Audits | Implémentée et testée CI sur la reprise et la préparation | `shared/src/audit/`, `/api/audit-suivi`, plans, création d'écart depuis un plan, `pilotage/Couverture.tsx` et vues audit | Modules `audit` / `plan_audit`, validations serveur. Ne pas remplacer le programme existant par le jeu fictif 021 |
| Écarts / non-conformités | Partiellement implémentée relativement aux registres multiples ; clôture testée CI | `ImprovementData`, `grc/core.ts`, `pilotage/service.ts`, commandes décisions, `Registry.tsx`, `Decision.tsx`, `pilotage.test.ts` | Clôture conservée ; vérification d'efficacité et décision dédiées. **La réouverture des v001/v002 de 021 est incompatible** ; candidate v003 corrigée, voir §4 |
| Fournisseurs | Implémentée et testée CI sur les parcours inspectés | `grc/suppliers.ts`, schémas `fournisseurs.ts`, routes `/api/library/...` et périmètres, `Fournisseurs.tsx`, `fournisseurs.test.ts` | Registre organisationnel, évaluations immuables, rattachement à plusieurs périmètres ; aucune grille universelle à inventer |
| Preuves / documents | Implémentée et testée CI sur les parcours inspectés | `ProofData`, décisions de revue, routes documents et objet `evidence`, `documents.test.ts`, `pilotage.test.ts` | Référence de version de document, contrôles d'accès et revue de preuve. Un champ texte de démo n'est pas un dépôt de preuve sécurisé |
| Objectifs, indicateurs, tableaux de bord | Implémentée et testée CI pour les services inspectés ; portée partielle | `pilotage/objectifs.ts`, `boites.ts`, `ObjectifsProcessus.tsx`, `pilotage-objectifs.test.ts` | Le service historique des objectifs/processus refuse les périmètres autres que `DEFAULT_SMSI`. Ne pas promettre cette édition dans tous les enfants GHT |
| Qualité ISO 9001 | Partiellement implémentée relativement à une expérience qualité complète | Processus/objectifs/indicateurs, PESTEL, opportunités, préparation revue (`PreparationRevue.tsx`, `pilotage/revue.ts`), tests PESTEL/revue | Le cadrage Markdown n'est pas une preuve de réalisation de tous ses lots. Préserver les différences métier ; ne pas imposer EBIOS RM à la qualité |
| Apparence Sauge / Clair | Implémentée et testée CI pour persistance globale | `ApparenceSettings`, `/api/settings/apparence`, `Settings.tsx`, `Layout.tsx`, `settings.test.ts` | Ne pas recréer `/api/appearance`. Droit réel `parametres:modifier`, à rapprocher de la demande « administrateurs seulement » ; masquage UI insuffisant |

Aucune fonctionnalité n'est classée « en cours » sur la seule présence d'un plan. Les travaux locaux non publiés de Claude restent indéterminés.

## 3. Contrats à réutiliser et pièges de raccordement

| Besoin frontend | Contrat observé | Règle d'intégration |
| --- | --- | --- |
| Liste / création périmètres | `GET/POST /api/grc/smsis` | Respecter `SmsiCreate` ; noms/nature/fuseau ne définissent pas une hiérarchie |
| Modifier périmètre | `PATCH /api/grc/smsis/:smsi` | `SmsiUpdate`, `confirm: 'ENREGISTRER'`, If-Match ; pas de `parentId` ajouté au corps strict |
| Référentiels du périmètre | `/api/grc/:smsi/framework-attachments` et `/:id`, activation séparée | Une version précise est rattachée ; ce mécanisme n'est pas une cascade parent/enfant |
| Objets / liens | `/api/grc/:smsi/objects`, `/objects/:id`, `/links` | Utiliser DTO et références typées réels, droits et validations de chaque kind ; pas de copie des collections mock |
| Risque évalué | `/api/grc/:smsi/risks/:id/preview`, `/evaluate`, `/evaluations` | La matrice présente les résultats/politiques du serveur ; ne pas recalculer le résiduel après clôture d'action |
| Étude EBIOS | `GET /api/grc/:smsi/risk-studies/:id` | Réutiliser liens/configurations de l'étude, distinguer pertinence des couples et risque |
| Vérifier / clôturer | `POST /api/grc/:smsi/pilotage/decisions` | Corps `{ref, decision}` validé par `PilotageRecord`, If-Match ; opérations `effectiveness` et `close`, pas d'écriture générique de `closedAt` |
| Audit → écart | `POST /api/plans/:id/ecart` pour les plans historiques | Vérifier le type de l'audit avant réutilisation ; ce n'est pas une commande générale de création atomique registre + écart |
| Apparence | `GET/PUT /api/settings/apparence` ; lecture utilisateur via `/api/auth/me` | Champs `theme`, `densite`, `style`, version/ETag/If-Match ; conserver les autres réglages de la section |
| Navigation | `/pilotage/:section?`, `/parametres/:section?`, `/admin/:tab?` | Réconcilier le menu 020 avec `pilotage-navigation.ts` et `main.tsx`. Les hashes des maquettes ne sont pas des routes serveur |

`/api/gap` désigne la démarche GAP des applications, **pas** le registre générique des écarts d'audit. Les namespaces `legacy:…`, `object:…`, références normatives et documents ne sont pas interchangeables.

Réutilisations techniques prioritaires : `apps/web/src/api.ts` (CSRF, If-Match, erreurs), `session.tsx` et les contrôles `useCan`, TanStack Query, `ErrorAlert`, `ConfirmDialog`, `DataTable`, `PageHeader`, `StatusChip` et les pictogrammes de `@suivi/ui`. Vérifier leur export réel au prochain SHA. Les contrôles UI complètent `http/route.ts` et `grc/core.ts` ; ils ne remplacent pas les permissions serveur.

## 4. Écarts et risques de régression

1. **Périmètres 010 :** l'organigramme non commité utilise `parentId` et `cascade`, absents des contrats Claude. Besoin métier à transmettre : modèle de hiérarchie, interdiction des cycles, droits par descendant, versions héritées, exceptions locales, désactivation, comptage des écarts et historique. Ne pas présenter une simulation locale comme un héritage enregistré côté serveur.
2. **Écarts 021 v001/v002 :** `recheck()` remet un écart clos « À vérifier » et `closeGap()` permet de le rouvrir. Claude conserve la clôture et demande un nouveau constat pour une récidive (`grc/core.ts`). La [candidate v003](../fonctionnalites-a-implementer/021-registres-ecarts/maquettes/v003-cloture-preservee/README.md) préserve les preuves passées et propose un nouveau constat lié, sans réécrire les ZIP historiques. Cette correction locale ne vaut pas raccordement API. Les registres multiples et leur atomicité exigent aussi une correspondance métier explicite.
3. **Apparence 012 :** le réglage global existe. Anciennes prescriptions d'endpoints à créer et de SQLite inapplicables au socle courant. L'API donne l'écriture à `parametres:modifier`, pas à un test de rôle nommé « administrateur » ; la politique exclusive demandée et la propagation sous 30 s ne sont pas établies par ce seul audit. Besoin à porter au responsable métier si cette permission est plus large que souhaité.
4. **Qualité / GHT :** certains adaptateurs historiques n'écrivent que dans le périmètre commun. Un sélecteur d'enfant ne suffit pas à rendre ces services multi-périmètres. Afficher une indisponibilité explicite plutôt que contourner cette limite.
5. **Styles / CSP :** ne pas injecter directement les HTML/CSS des captures dans React. La cible interdit les scripts/styles inline ; réutiliser le système de styles natif et des classes bornées. Préserver sombre, focus, contrastes, clavier, tiroir mobile et mouvement réduit. Les captures examinées ne prouvent pas une conformité WCAG.
6. **Cartographie dynamique :** aucun changement, y compris par héritage CSS global ou réorganisation de routes. La matrice du registre et les scénarios EBIOS restent distincts.
7. **Données fictives et imports :** pas de seuil, texte ISO/HDS, règle ARM ou référence de preuve déduits d'un exemple. L'import JSON de maquette n'est pas l'import métier de production. La résistance aux injections de tous les imports n'a pas été certifiée dans cet audit.
8. **Historique et état local :** ne pas supprimer les versions antérieures, les exports utilisateurs ni les fichiers non commitées. Les anciennes recettes documentent leur version, pas le nouveau SHA.

## 5. Doublons et choix UI/UX

L'inventaire par empreinte trouve six groupes de fichiers texte identiques. Ils ne traversent pas trois applications : ils se trouvent dans des versions/paquets de développement autonomes.

| Éléments | Décision et motif |
| --- | --- |
| `base.css` de 010, 021 v1/v2, prototype transversal v2 ; `graphiques/style.css` du dossier ARM | Conserver les copies livrées : elles servent les ZIP hors ligne. À l'avenir, produire les copies depuis une source commune lors du packaging, sans liens externes cassant les ZIP |
| `prototype.css` partagé par les mêmes prototypes | Même décision. Référence comportementale : prototype transversal ; adaptation native par `@suivi/ui`, pas troisième design system |
| `index.html`, `seed.js`, `registres.css` identiques entre 021 v1 et v2 | Historique de versions, pas code mort. Les `app.js` diffèrent : v2 apporte la création depuis audit |
| 017 Plans et 021 Registres | Garder l'interface plans/actions de 021 comme proposition commune. 017 doit y renvoyer, sans nouveau moteur d'actions |
| 003 EBIOS ciblé et prototype transversal v2 | Garder le parcours transversal pour les cinq ateliers ; garder le ciblé comme référence des scénarios et animations. Ne pas fusionner leurs modèles fictifs avec le moteur de risques |
| Tableau de versions dans le README de développement | Supprimé : doublonne le catalogue et affiche encore l'ancienne version 017. Renvoi à la liste générée, seule liste maintenue |
| Prompts ASTRA et ARM prescrivant une nouvelle implémentation Python/SQLite | Consolidés vers un prompt courant et un audit ; prescriptions historiques signalées, pas transposées à React/Fastify |

Éléments à préserver après examen des aperçus : style 08 (barre vert profond, fond sauge clair, cartes blanches, accents turquoise/bleu), icônes colorées et chevrons ; menu épuré 020 avec ordre encore à valider ; contexte audit visible dans le formulaire 021 ; tableau EBIOS synchronisé avec cercle/matrice ; sélection de chemin animée et contours renforcés. Les 30 vues demeurent des références visuelles, pas un inventaire de composants opérationnels.

Refactorisation ultérieure ciblée : extraire formulaires, navigation, rendu et validation des `app.js` monolithiques avant leur adaptation ; réutiliser les composants natifs ci-dessus. Aucun package applicatif n'est déclaré dans les trois dossiers : aucune dépendance n'a été retirée par supposition. Aucune route n'est déclarée morte sur la seule comparaison de noms.

## 6. Plan de convergence et incrément réalisé

| Priorité | Action | État / condition de sortie |
| --- | --- | --- |
| P0 | Identifier les espaces, figer la référence Claude, conserver les travaux non commités | Fait ; aucune écriture dans Claude |
| P0 | Corriger les instructions contradictoires et centraliser l'audit | Réalisé dans les dossiers Codex ; ancien dossier technique explicitement historique |
| P0 | Signaler 010/012/021 avant codage | Consignes d'intégration mises à jour ; contrats manquants identifiés, sans modèle parallèle |
| P1 | Adapter le menu et les écrans avec `@suivi/ui` et les routes existantes | Lot frontend à réaliser dans un espace Codex contenant une copie de travail de la cible ; aucune fusion globale ni écrasement des `apps/` non suivis |
| P1 | Nouvelle maquette 021 : conserver la clôture et créer une récidive liée | Candidate v003 réalisée ; 30 contrôles navigateur passés, 11 aperçus. Validation utilisateur et mapping API encore requis |
| P1 | Finaliser 010 puis raccorder l'héritage | Visuel à valider ; contrat hiérarchie/permissions requis pour l'intégration métier |
| P2 | Harmoniser ISO 27001 / HDS (bibliothèque, DDA, preuves, audits) | Réutiliser les sources et commandes existantes ; pas de second registre métier |
| P2 | Étendre l'expérience ISO 9001 (processus, objectifs, indicateurs, revue) | Vérifier les limites de portée des adaptateurs ; cartographie dynamique protégée |
| P3 | Génération commune des ressources ZIP et réduction des monolithes | Conserver l'autonomie des archives et leur historique ; recette des parcours avant substitution |

Cet incrément comporte un **audit, un nettoyage documentaire et une correction de maquette 021 en version candidate**, pas une intégration applicative. Il ne déplace aucune fonctionnalité vers « à implémenter » ou « implémentées ». Le brouillon 010, les maquettes publiées et les données locales sont préservés. Les deux autres étapes restent séparées conformément au cycle utilisateur. Le catalogue racine n’a pas été modifié : la candidate est annoncée dans le dossier 021, tous les changements restant dans les trois espaces autorisés.

## 7. Vérification et limites

Preuves externes consultées en lecture seule, au SHA `d044eb9` : [CI réussie](https://github.com/yousername-ha/suivi-audits/actions/runs/38723236911) et [CodeQL réussi](https://github.com/yousername-ha/suivi-audits/actions/runs/38723236955). Les jobs CI confirment lint/format/typage/build, tests Vitest avec PostgreSQL, composants UI et tests Playwright de la pile. Ils ne valident ni les maquettes Codex ni tous les souhaits métier décrits ici.

Contrôles locaux de cet incrément : 30 contrôles Playwright passés pour 021 v003 (clôture conservée, constat lié, annulation, liens, import hors périmètre, restitution HTML, parcours précédents et mobile), 11 captures ; résolution des liens Markdown et structure du catalogue avec `scripts/verifier_structure.py`, intégrité du manifeste du socle, `git diff --check` (avec `core.whitespace=trailing-space,space-before-tab,cr-at-eol` pour les fins de ligne Windows du BAT), contrôle des chemins modifiés et conservation des fichiers non suivis. La recette est enregistrée dans `021-registres-ecarts/maquettes/v003-cloture-preservee/technique/recette.json`. Les 30 contrôles passent également sur une extraction du ZIP livré ; 21 fonctionnalités et 629 liens locaux sont validés par le vérificateur de structure. Les manifestes ASTRA et ARM ont été contrôlés. Aucun test de backend Claude n'a été lancé ; aucun parcours Windows/BAT, audit d'accessibilité exhaustif ou mesure de performance n'est revendiqué pour cet incrément.

Pour le prochain lot frontend : tester 401/403/412/422, erreur réseau, reprise de saisie, concurrence, changement de périmètre sans fuite de cache, permissions par module, navigation clavier/mobile, mouvement réduit, sombre et deux sessions pour l'apparence. Exécuter build/typage/lint et tests pertinents **dans la copie Codex autorisée** ; ne pas inscrire « opérationnel » avant cette recette.
