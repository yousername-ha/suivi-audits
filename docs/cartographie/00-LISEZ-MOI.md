# Dossier Cartographie — pour Claude Code

But : faire implémenter dans la nouvelle application (v3) la Cartographie du SMSI testée et validée dans l'outil
historique le 08/10/2026 (module bêta).

## Utilisation
1. Le dossier est dans le dépôt : `docs/cartographie/`, branche `docs/cartographie`.
2. Ouvrir Claude Code sur le dépôt et coller le texte de `PROMPT-CLAUDE-CODE.md`.
3. Relire la PR : ADR 0013 d'abord, puis le code, les tests et les captures.

## Contenu
| Élément | Rôle |
|---|---|
| `PROMPT-CLAUDE-CODE.md` | Instructions de travail (branches, ordre, règles du dépôt) |
| `SPEC-CARTOGRAPHIE-V3.md` | Exigences CARTO-01 à CARTO-14 adaptées à la v3 (droits, tables, API, temps réel, reprise legacy) |
| `RECETTE.md` | 20 parcours de recette |
| `reference-beta-legacy/` | Code du module bêta (`carto.js`, `carto.css`, `apply_carto.py`), contrat `S.maps`, scripts de test Playwright, captures sur données fictives |
| `maquette/` | Maquette Map Builder SMSI d'origine (spécification, configuration, contrats TypeScript, visuels 01 à 03) — exemples anonymisés, visuel 04 retiré (processus réels) |

## État des PR au 08/10/2026 (test de fusion)
- PR #1 à #5 : toutes fusionnables sans conflit, CI verte sur le dernier commit de chacune.
- Fusion locale de toute la pile (#1 → #5) + branche bêta : un conflit simple sur `CLAUDE.md` ; build, typage,
  tests `shared` (35), `ui` (18), `web` (3) et `api` (85, PostgreSQL) au vert ; **lint et format en échec à cause de
  `scripts/carto/`** (fragments injectés dans l'outil historique) : à exclure d'ESLint et Prettier — prévu à l'étape 0
  du prompt.
- Ordre de fusion conseillé : #1, #2, #3, #4, #5 (chacune retargetée automatiquement sur `main` après la précédente),
  puis la PR bêta, puis la PR `refonte/cartographie`.

Aucune donnée réelle dans ce dossier.
