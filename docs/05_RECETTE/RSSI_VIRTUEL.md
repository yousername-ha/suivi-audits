# RSSI virtuel : recette exploratoire et non-régression du point de vue d'un RSSI

Mis en place le 2026-11-11 (Europe/Paris) par la session « Agent RSSI virtuel » (`session_01EnWdzi6XW7jw824ozEWpfF`), à la
demande du RSSI. Objectif : vérifier la **cohérence métier**, le **fonctionnement** et la **non-régression** de l'application
en la faisant utiliser, sur une installation neuve, par un RSSI qui y met en œuvre un SMSI ISO/IEC 27001:2022 + HDS.

## Deux étages

| Étage | Quoi | Quand | Résultat |
| --- | --- | --- | --- |
| Exploratoire (agent) | Sous-agent Claude Code [`rssi-virtuel`](../../.claude/agents/rssi-virtuel.md) : persona de RSSI, [scénario en 17 étapes](../../tests/e2e/rssi-virtuel/scenario.md) aligné sur le parcours ISO 27001 / HDS de l'application, [jeu de données fictif](../../tests/e2e/rssi-virtuel/donnees/gcs-fictif.json), navigateur piloté pas à pas | Après une évolution métier, avant une PR de version | Rapport daté dans [`rssi-virtuel/`](rssi-virtuel/), constats `RSSI-NN`, tests proposés |
| Non-régression (harnais) | Tests Playwright déterministes [`tests/e2e/rssi-virtuel/specs/`](../../tests/e2e/rssi-virtuel/specs/) et [invariants du SMSI](../../tests/e2e/rssi-virtuel/invariants.ts), sur une pile Docker éphémère | Manuel ou hebdomadaire ([workflow « RSSI virtuel »](../../.github/workflows/rssi-virtuel.yml)), hors des 7 contrôles de PR | Vert / rouge ; avertissements en annotations |

L'agent découvre ; le harnais empêche que ce qui a été vérifié régresse. Chaque parcours que l'agent vérifie a vocation à
devenir un test du harnais.

## Lancer le harnais

Sur un poste avec Docker (même prérequis que les tests de bout en bout, `CONTRIBUTING.md`), port 443 libre :

```bash
pnpm install --frozen-lockfile --filter @suivi/e2e
sudo tests/e2e/rssi-virtuel/lancer.sh                   # images de la branche ; --version X.Y.Z pour les images publiées
```

Le script crée une pile vierge (projet Compose `suivi-rssi-virtuel`, données dans `/srv/suivi-rssi-virtuel`, `.env` du dépôt
non touché), installe l'application par l'écran comme le RSSI, déroule les parcours, contrôle les invariants, puis détruit la
pile et ses données. Le premier test refuse une pile déjà installée.

## Lancer l'agent

Dans Claude Code, à la racine du dépôt :

```text
sudo tests/e2e/rssi-virtuel/lancer.sh --garder
> Fais passer le RSSI virtuel sur la branche courante (étapes 0 à 9), rapport et tests proposés.
```

L'agent pilote un Chrome par `node tests/e2e/rssi-virtuel/pilote.mjs` (commandes `demarrer`, `ouvrir`, `voir`, `cliquer`,
`remplir`, `choisir`, `capture`, `api`, `invariants`…). `voir` affiche la page telle qu'un lecteur d'écran la perçoit. Le
pilote ne journalise ni mot de passe, ni jeton, ni secret TOTP ; ses fichiers (`.pilote/`) ne sont pas versionnés car l'écran
d'installation y montre le poivre et la clé de secours, fictifs mais à ne pas publier. À la fin :
`sudo tests/e2e/rssi-virtuel/lancer.sh --arreter`, puis `lancer.sh` pour la non-régression.

## Invariants du SMSI

Réécrits à partir des normes, sans réutiliser le code de l'application (un défaut de calcul ne doit pas se retrouver dans son
propre contrôle). Aucun texte normatif sous licence : numéros de clause et de mesure seulement.

| Règle | Contrôle | Source | Gravité |
| --- | --- | --- | --- |
| INV-01 | Annexe A complète : 93 mesures (37 / 8 / 14 / 34), sans doublon | ISO/IEC 27001:2022, 6.1.3 c), annexe A | bloquant |
| INV-02 | Clauses 4 à 10 présentes, jamais déclarées non applicables | ISO/IEC 27001:2022, 1 | bloquant |
| INV-03 | Toute exclusion de la DdA (annexe A, HDS) est justifiée | 6.1.3 d) | bloquant |
| INV-04 | Toute inclusion est justifiée (justification ou actions) | 6.1.3 d) | avertissement |
| INV-05 | Aucune mesure « Total » avec une non-conformité ou un point sensible ouvert | 6.1.3 d), 10.2 | bloquant |
| INV-06 | Écart ouvert avec responsable et échéance | 10.2 b), 6.2 | avertissement |
| INV-07 | Écart rattaché à une clause, une mesure ou une exigence | 9.2.2, 10.2 | avertissement |
| INV-08 | Écarts du registre et écarts vus par la DdA concordants (mesures, état) | traçabilité, AGENTS.md | bloquant |
| Journal | Chaque modification de la DdA par le RSSI figure au journal d'audit | A.8.15, 7.5.3 | bloquant |

## Constats ouverts et marqueurs `test.fail`

Un constat reproductible devient un test marqué `test.fail(true, 'RSSI-NN ouvert : …')` : le harnais reste vert tant que le
défaut existe et **devient rouge quand il est corrigé**, ce qui oblige à retirer le marqueur dans la PR du correctif. Ce n'est
pas une assertion réduite : l'assertion décrit le comportement attendu. Constats ouverts : BUG-016 à BUG-019
([registre](../04_QUALITE/REGISTRE_BUGS.md)), détail dans le [rapport du 11/11/2026](rssi-virtuel/RAPPORT-2026-11-11.md).

## Limites

- Couverture déterministe actuelle : étapes 0 (installation), 6 bis (DdA) et 9 (écarts) du scénario ; les autres étapes sont
  exploratoires (colonne « Harnais » du scénario).
- Les écarts du harnais sont posés par l'API du registre (comme un import de rapport d'audit) ; leur saisie à l'écran reste à
  écrire.
- `lancer.sh` construit les images comme la CI ; il n'a pas été exécuté dans la session qui l'a créé (registres d'images
  inaccessibles) : premier passage à faire par le workflow manuel.
