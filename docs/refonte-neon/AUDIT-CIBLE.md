# Refonte Neon : audit de la version cible avant portage

13/11/2026, Europe/Paris. Session « Refonte Neon suivi-audits » (`session_01EnWdzg9gxV5Kzkp9Y5WBcd`). Audit en lecture seule, fait **avant toute modification**
du code. La matrice remplie est dans [MATRICE-COMPATIBILITE.csv](MATRICE-COMPATIBILITE.csv) : une ligne par module du
dossier de transmission, avec preuves, différences à préserver, tests et lot retenu.

## 1. Identité de la version auditée

| Élément                | Constat                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| Branche de base        | `claude-suivi-smsi`, commit `967de1d` (PR #267, ADR 0089 lot 3), version 6.3.0 des `package.json`          |
| Branche de travail     | `claude/refonte-neon`, créée depuis `origin/claude-suivi-smsi` le 13/11/2026                                |
| Dossier de transmission | branche `codex/transmission-neon-opus-5-5` (`fb1ca14` = `967de1d` + documentation seule)                   |
| Référence de refonte   | instantané `55d43ee` (dernier état applicatif `d9d1478`), jamais fusionné : aucun fichier `neon-*` en cible |
| Application exécutée   | non auditable depuis cette session ; la recette se fait sur une pile locale isolée (voir § 4)               |

Aucun travail en cours d'une autre session n'a été touché : la branche de transmission reste intacte, la branche
`claude/assistant-rssi` (backend de l'Assistant, non fusionnée) a seulement été lue.

## 2. Constats principaux

- **La refonte n'est pas dans la cible.** Ni feuilles `neon-*.css`, ni composants « Studio », ni `fiche-cliquable`,
  `focus-fiche`, `NeonAnalytics`, `neon-graphiques`. La palette de la cible est « Sauge » (ADR 0015).
- **La cible est plus récente que la référence sur plusieurs points**, à ne pas rétrograder : disposition du tableau de
  bord en édition magnétique (ADR 0078 lot 2d), périmètres organisation/fournisseur (ADR 0082), boîtes de pilotage des
  objectifs, plan d'action dans le registre des risques (ADR 0090), RETEX dans la fiche incident (ADR 0091),
  bibliothèque fusionnée avec la couverture (ADR 0089, autrement que dans la référence).
- **Retraits à ne pas ressusciter** : CRRC et Budget (ADR 0084), Revues des accès (0087), BIA (0088), six pages de
  Conformité dont « Référentiels et exigences » et les correspondances (0089), opportunités/traitements/scénarios du menu
  Risques (0090), pages Qualifier et RETEX séparées (0091). La carte « Sauvegardes & résilience » du Dashboard Neon
  repose sur l'API CRRC retirée : elle n'est pas portée.
- **Assistant RSSI** : absent de la cible ; son backend existe sur `claude/assistant-rssi` (ADR 0086, migrations 055-057 et
  060-066). Le portage de l'habillage attend la fusion de ce backend.
- **Cartographie SMSI et graphe RETEX** : plus récents dans la cible, protégés ; aucun fichier de la référence n'y est
  copié.

## 3. Garde-fous identifiés

- `apps/web/test/charte.test.ts` : aucune couleur, longueur px/rem ni `style={}` dans `apps/web/src` ; les valeurs vont
  dans `packages/ui`.
- `packages/ui/test/contraste.test.ts` : rayons limités à 12 px (la référence les portait à 18 px : non repris),
  `STYLE_CLAIR` identique à `styles.css`, couples de contraste WCAG AA.
- E2E fonctionnels sensibles : menu (`menu-clavier`, `menu-ordre`, `coque`, `jeu-de-test` : sept `.nav-famille`),
  accueil (`tous-ecrans` attend « Prochaines échéances » sur `/` ; `disposition-tableau-de-bord`).
- 68 captures de référence Playwright (`tests/e2e/specs/__captures__`) : toute évolution visuelle les modifie ; leur
  régénération demande l'accord du RSSI (aucune approbation automatique).
- CSP stricte (ADR 0006) : pas de style en ligne, pas d'AppShell, `lockScroll={false}`.

## 4. Ordre des lots

| Lot | Contenu                                                                                     | Statut     |
| --- | ------------------------------------------------------------------------------------------- | ---------- |
| 0   | Audit, matrice                                                                              | fait       |
| 1   | Jetons Neon, menu bleu nuit opaque animé, Dashboard analytique                              | ce lot     |
| 2   | Fenêtres (lecture distincte, voile extérieur), lignes ouvrables, `focus-fiche`              | à venir    |
| 3   | Contexte, Périmètres compacts, Objectifs compacts                                           | à venir    |
| 4   | Bibliothèque (présentation), DDA en lignes                                                  | à venir    |
| 5   | SWOT, PESTEL, Parties intéressées, Processus, Fournisseurs                                  | à venir    |
| 6   | Timeline Studio des actions et récurrences, validation rapide des occurrences               | à venir    |
| 7   | Habillage de l'Assistant, après fusion de `claude/assistant-rssi`                           | reporté    |
| 8   | Grille PC complète et harmonisation finale                                                  | à venir    |

Rôles et responsabilités reste hors lot (proposition non validée). Chaque lot vérifie la grille PC (1024×768 à
2560×1440, 1920×800, zoom 150 %), les deux thèmes, la pause et la préférence de mouvement réduit.

## 5. Environnement de recette de cette session

Pile locale isolée, sans Docker (registres d'images inaccessibles depuis la session) : PostgreSQL 16 dédié (données
jetables hors du dépôt), API lancée par `tsx` sur les sources, interface Vite. Compte et données **entièrement fictifs**
(jeu `suivi jeu-de-test` du dépôt, organisation « Organisation de démonstration »). Node 22 au lieu de Node 26 exigé :
contrôle de version relâché pour l'installation des dépendances uniquement. Ces écarts sont rappelés dans chaque
rapport de lot ; la CI de la PR reste la référence.
