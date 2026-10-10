# Journal de bord reconstitué

Référence applicative analysée : `c704fa6e6d6d516db75f963db8dd5d2049ab42c8`. Mise à jour : 2026-10-11T00:57:18+02:00 (Europe/Paris).

Historique ci-dessous issu de Git : date enregistrée au commit et résumé.
L’heure exacte, l’objectif détaillé, la difficulté et le résultat de chaque
ancienne session ne sont pas tous reconstructibles. Consulter les diagnostics
datés et exécutions liées ; ne pas convertir un message Git en preuve de test.

| Commit  | Date Git   | Résumé                                                                           |
| ------- | ---------- | -------------------------------------------------------------------------------- |
| 99e5f80 | 2026-10-09 | docs: diagnostiquer la base Sauge avant évolution SMSI GRC                       |
| 7dc4c37 | 2026-10-09 | chore(legacy): intégrer la base Sauge et conserver intégralement la v2           |
| 6442289 | 2026-10-09 | docs: cadrer la reprise intégrale du socle v2 et les lots A–L                    |
| 0e45380 | 2026-10-09 | fix: fiabiliser les parcours Sauge (A3–A6, CARTO-10)                             |
| f909a61 | 2026-10-09 | feat: piloter les demandes de sauvegarde chiffrée (A1a, EXPL-08)                 |
| 9f93bb2 | 2026-10-09 | fix: conserver les sauvegardes avant mise à jour (A1a, EXPL-08)                  |
| 4901e86 | 2026-10-09 | feat: vérifier et sécuriser les restaurations serveur (A1b1, EXPL-08)            |
| f4966d8 | 2026-10-09 | fix: borner les empreintes et cibler les sessions restaurées (A1b1)              |
| 568a103 | 2026-10-09 | test: attendre l'écrasement avant de consulter son audit                         |
| 9c2dd8a | 2026-10-09 | feat(exploitation): achever le lot A sauvegardes restauration et TLS             |
| 2fe55c2 | 2026-10-09 | fix(exploitation): publier les métadonnées sous umask root restrictive           |
| 413d341 | 2026-10-09 | test(exploitation): utiliser un contenu fictif sans en-tête de clé privée        |
| 9bc2b78 | 2026-10-09 | fix(securite): lire l’état par descripteur et restreindre TLS et permissions     |
| 2daa769 | 2026-10-09 | fix(tls): observer les certificats SAN-only sans sujet de Caddy                  |
| 417b2f0 | 2026-10-09 | test(ci): fermer les connexions avant les reprises du frontal                    |
| 69e6782 | 2026-10-09 | fix(security): remediate Drizzle and Caddy high vulnerabilities                  |
| 86bf4ca | 2026-10-09 | feat(modules): activation versionnée, dépendances et conservation du socle v2    |
| 2187e73 | 2026-10-09 | fix(ci): construire le paquet partagé avant les tests web                        |
| 17b6754 | 2026-10-09 | fix(web): préserver le cache initial quand les droits SSE sont inchangés         |
| a690dbd | 2026-10-09 | fix(realtime): conserver la présence initiale filtrée du serveur                 |
| 9135ba3 | 2026-10-09 | fix(realtime): recharger la présence après reconfiguration et reconnexion        |
| 8df4d05 | 2026-10-09 | fix(modules): préserver les paramètres des dépendances facultatives actives      |
| 8e836b3 | 2026-10-09 | docs(ui): préciser l'actualisation des écrans avant confirmation                 |
| 0e4a136 | 2026-10-10 | feat: intégrer les mises à jour web et la maintenance indépendante               |
| 58b3a62 | 2026-10-10 | fix: sécuriser les clés et permettre les réessais de mise à jour                 |
| e32944d | 2026-10-10 | fix: préserver l’audit et les adresses clientes pendant les mises à jour         |
| 91691dc | 2026-10-10 | fix(updates): conserver l'origine validée du retour après maintenance            |
| bfce9da | 2026-10-10 | feat(configuration): publier des échelles et matrices immuables (B2a)            |
| e5425b8 | 2026-10-10 | feat(ia): conserver des décisions liées aux configurations versionnées (B2b)     |
| 22611aa | 2026-10-10 | docs(lot-c): intégrer tâches récurrentes, risques multi-méthodes et cartographie |
| 1a9c128 | 2026-10-10 | feat(grc): intégrer référentiels, tâches et risques versionnés par SMSI          |
| b8caf58 | 2026-10-10 | fix(grc): sérialiser politiques et récurrences activées                          |
| 553be29 | 2026-10-10 | feat(grc): revise mappings with accessible version history                       |
| 661309c | 2026-10-10 | feat(pilotage): reprendre le menu métier et intégrer G H K avec le début E       |
| 99dbf38 | 2026-10-10 | ci(publication): prépare une préversion installable depuis le menu existant      |
| cc285b4 | 2026-10-10 | fix(pilotage): rétablit le menu et active les sauvegardes intégrées              |
| cdc7848 | 2026-10-10 | fix(release): désactive le cache pnpm des notes et prépare 3.0.2                 |
| ab9204b | 2026-10-10 | fix(ci): compare le commit de départ des tags annotés                            |
| cb827c4 | 2026-10-10 | fix(updates): prépare la recette updater et conserve les diagnostics             |
| f6a52bb | 2026-10-10 | fix(updates): préserver les verrous pendant le retour arrière                    |
| fad0205 | 2026-10-10 | test(pilotage): synchroniser les imports et les captures de référence            |
| c704fa6 | 2026-10-10 | ci(ci): supprime les scans Trivy redondants et annule CodeQL obsolète            |

## Session documentaire du 11 octobre 2026

- Objectif : reprise autonome par une autre IA.
- Analyse : code, contrats, navigation, scripts, migrations, ADR, archives,
  branches/tags et CI en lecture ; scopes/limitations explicités.
- Difficultés : documents de phase 0 incomplets ; noms techniques SMSI persistants ;
  aucune recette du serveur ni acceptation humaine disponibles.
- Solutions : dossier indexé et registre commun avec IDs ; anciens diagnostics
  conservés et renvois datés vers l’état actuel.
- Fichiers : AGENTS, HANDOVER, PROJECT_STATUS, docs/00_INDEX et dossiers 01–08,
  README et avis de contexte ciblés des documents historiques.
- Tests : 360 tests purs sans base, conservation v2 et extraction API.
  Codes retour 0 ; preuves synthétiques dans 05_RECETTE/preuves.
- Non exécuté : API/PostgreSQL, migrations, recettes Docker et services externes
  pendant la mission. CI/CodeQL c704fa6 vérifiés, pas relancés.
- Points ouverts : TEST-041/042, B2/E partiels, reprise v2 et optimisations mesurées.
- Référence : c704fa6e6d6d516db75f963db8dd5d2049ab42c8 ; commit documentaire local identifié par Git après création.
- Prochaine action : compte rendu serveur puis PV humain.

### Contrôles de clôture

- Première comparaison brute du guide : code 1, commentaires de provenance
  différents uniquement (EXE-010). Le contrôle suivant a détecté une ligne vide
  ajoutée dans le changelog publié (EXE-011, code 1) ; elle a été retirée.
- Contrôle final du guide : EXE-012, code 0 ; 64 blocs lus de chaque côté,
  commandes préservées, syntaxe valide et sections publiées inchangées.
- Renvois corrigés vers le service des indicateurs et les sections du guide.
  Deux lectures ciblées ont initialement utilisé des noms de fichiers inexistants ;
  les bons chemins ont ensuite été lus. Aucun cas de recette n’en dépend.
- La configuration Prettier du dépôt ignore les Markdown et docs : le premier
  passage ne les contrôlait donc pas. Le format et le contrôle des seuls nouveaux
  documents utilisent explicitement `--ignore-path /dev/null`.
- Preuves finales : [contrôles documentaires](../05_RECETTE/preuves/2026-10-11-controles-documentaires.json).
  Les rapports bruts restent privés hors Git. Aucune nouvelle CI/push/release.

- Une sonde `git rev-parse refs/heads/main` a retourné 128 (script Python : 1),
  car ce clone n’a pas de branche main locale. La vérification adaptée a passé :
  origin/main et `git ls-remote --heads origin main` pointent vers b148c1b,
  sans création ni modification de main. Aucun diff applicatif/infrastructure.
