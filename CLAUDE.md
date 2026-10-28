# Reprise du projet avec Claude Code

Les consignes communes sont dans [AGENTS.md](AGENTS.md). Les lire avant toute
intervention, puis consulter [HANDOVER.md](HANDOVER.md),
[PROJECT_STATUS.md](PROJECT_STATUS.md) et [docs/00_INDEX.md](docs/00_INDEX.md).
Ces fichiers donnent l’état actuel, les preuves de test et les priorités. Commencer par la
[reprise du 27/10/2026](docs/01_REPRISE_IA/REPRISE-2026-10-27.md), la plus récente.

- Trois branches (décision du RSSI, 11/10/2026) : `main` (version Docker unique, publiée par étiquette
  `vX.Y.Z`), `claude-suivi-smsi` (branche de travail, [plan d'unification](docs/unification/PLAN-EVOLUTION.md)),
  `legacy` (outil historique autonome). Les autres branches sont conservées sous les étiquettes `archive/*`.
- `main` n'évolue que par PR depuis `claude-suivi-smsi`, après CI verte. Dépôt public : aucune donnée réelle
  ni aucun secret, y compris dans les messages de commit.
- Architecture actuelle : [DAT](docs/03_ARCHITECTURE/DAT.md).
- Conventions et commandes : [CONTRIBUTING.md](CONTRIBUTING.md).
- Installation et exploitation : [guide](docs/INSTALLATION.md).
- Fonctionnalités et limites : [inventaire](docs/02_FONCTIONNALITES/INVENTAIRE_FONCTIONNEL.md),
  [recette](docs/05_RECETTE/RAPPORT_RECETTE.md), [backlog](docs/08_PILOTAGE/BACKLOG.md).

L’écran `/legacy` est retiré ([ADR 0042](docs/adr/0042-retrait-de-lecran-legacy.md)) ; l’outil autonome est
conservé sur `archive/outil-legacy-autonome` (le fichier `app/public/index.html`, ses bibliothèques, `scripts/update-ui.sh`
et `archives/` ont été retirés du dépôt).
Les données de départ restent vides et les fixtures anonymisées. Les cartes et
les familles historiques encore attendues sont conservées.

La charte vient de `packages/ui`. Respecter la CSP de l’interface native : pas
de script ou style en ligne, pas d’AppShell, `lockScroll={false}` et pas de props
Mantine de style responsives ([ADR 0006](docs/adr/0006-front-react-mantine-csp-stricte.md)).

Les décisions, règles de sécurité, permissions, tests et précautions de données
restent celles d’AGENTS et CONTRIBUTING. Les références datées expliquent
l’historique ; elles ne remplacent pas les consignes actuelles.
