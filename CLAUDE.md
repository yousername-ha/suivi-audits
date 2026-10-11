# Reprise du projet avec Claude Code

Les consignes communes sont dans [AGENTS.md](AGENTS.md). Les lire avant toute
intervention, puis consulter [HANDOVER.md](HANDOVER.md),
[PROJECT_STATUS.md](PROJECT_STATUS.md) et [docs/00_INDEX.md](docs/00_INDEX.md).
Ces fichiers donnent l’état actuel, les preuves de test et les priorités.

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

L’ancien outil reste accessible sous `/legacy`. Ne pas réécrire son HTML ; toute
évolution de ce fichier fait l’objet d’un commit dédié. `scripts/update-ui.sh`
s’utilise sur un poste de développement ; le serveur reçoit une version publiée.
Les données de départ restent vides et les fixtures anonymisées. Les cartes et
les familles historiques encore attendues sont conservées.

La charte vient de `packages/ui`. Respecter la CSP de l’interface native : pas
de script ou style en ligne, pas d’AppShell, `lockScroll={false}` et pas de props
Mantine de style responsives ([ADR 0006](docs/adr/0006-front-react-mantine-csp-stricte.md)).

Les décisions, règles de sécurité, permissions, tests et précautions de données
restent celles d’AGENTS et CONTRIBUTING. Les références datées expliquent
l’historique ; elles ne remplacent pas les consignes actuelles.
