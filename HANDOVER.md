> 01/11/2026 : [maquette Cible et Mesuré mise à jour](docs/refonte-neon/propositions/cible-et-mesure/README.md) : encadrés de même format, mesure sur fond vert/rouge. **Toujours en attente de validation explicite** ; code applicatif inchangé, aucun test lancé.

> 01/11/2026 : **nouvelle règle du demandeur : maquette → validation explicite → intégration et tests → nouveau visuel réel**. Voir [AGENTS.md](AGENTS.md#refonte-neon-codex--validation-visuelle-préalable). [Proposition autonome de cible renforcée](docs/refonte-neon/propositions/cible-visible/README.md) prête, en attente de validation ; code applicatif inchangé et aucun test lancé pour ce lot.

> 01/11/2026 : [couleurs des chiffres et tendances des objectifs](docs/refonte-neon/OBJECTIFS-INDICATEURS.md) ajoutées : hausse verte/baisse rouge, chiffre selon la cible, nuances visibles en sombre. Contrôles de contraste et captures réelles ; calculs conservés.

> 01/11/2026 : [Objectifs et indicateurs retravaillés en Neon](docs/refonte-neon/OBJECTIFS-INDICATEURS.md) : synthèse graphique, cartes Biseau, tableaux mobiles et fiches par rubriques. Calculs et actions conservés ; 230 tests web, deux scénarios e2e et lecteur réel vérifiés. Validation visuelle du demandeur en attente.

> 01/11/2026 : **présentation des quatre catégories Contexte validée par le demandeur et conservée**. Voir [la présentation retenue](docs/refonte-neon/CONTEXTE-CATEGORIES.md). Aucun changement applicatif dans cette consignation.

> 01/11/2026 : [catégories du contexte distinguées](docs/refonte-neon/CONTEXTE-CATEGORIES.md) : enjeux internes/externes et interfaces/dépendances dans quatre zones. Catégories lues explicitement, anciens textes conservés dans À préciser ; 230 tests web et trois parcours e2e réussis.

> 01/11/2026 : [Biseau généralisé aux fenêtres et hauteur naturelle](docs/refonte-neon/FENETRES-GLOBALES.md). Dalles Périmètres sans ascenseur interne, niveaux du graphe recalculés, défilement des fiches longues porté par le voile extérieur ; captures et contrôles sur la copie Codex.

> 01/11/2026 : **animations validées par le demandeur et retenues dans la refonte**, avec Biseau. Correspondance entre aperçu et CSS de l’application confirmée ; contrôle réel des animations, du mouvement réduit et de la fermeture réussi, sans écriture. Voir [cadres et animations](docs/refonte-neon/CADRES-NEON.md).

> 01/11/2026 : [vidéo MP4 et aperçu interactif des cinq animations](docs/refonte-neon/CADRES-NEON.md) fournis pour validation ; icônes agrandies et commandes Lire/Pause/Rejouer dans le fichier autonome. Aucun changement du code applicatif.

> 01/11/2026 : **Biseau retenu par le demandeur** pour la grande dalle Contexte, avec pictogrammes animés. Les variantes de comparaison sont retirées du code actif ; leurs captures restent dans [le dossier des cadres](docs/refonte-neon/CADRES-NEON.md).

> 01/11/2026 : [trois propositions de cadres néon et pictogrammes animés](docs/refonte-neon/CADRES-NEON.md) pour la grande dalle Contexte. Biseau provisoire dans la copie ; comparatifs, GIFs réels et contrôles disponibles. Choix esthétique du demandeur en attente.

> 01/11/2026 : [fonds du contexte légèrement foncés et puces partagées](docs/refonte-neon/CONTEXTE-PRESENTATION.md) entre enjeux et interfaces/dépendances ; texte enregistré conservé, cas de découpage et droits vérifiés.

> 01/11/2026 : [découpage des cinq rubriques du contexte rééquilibré](docs/refonte-neon/CONTEXTE-PRESENTATION.md) : organisation en tête, activités et dépendances côte à côte, enjeux détaillés et exclusions distinctes. Captures et parcours de droits vérifiés.

> 01/11/2026 : [contexte retravaillé en dossier de présentation](docs/refonte-neon/CONTEXTE-PRESENTATION.md), après retour visuel : colonne de référence, périmètre mis en évidence, lecture éditoriale. Captures renouvelées ; consultation, modification et lecteur réel vérifiés.

> 01/11/2026 : [présentation du contexte distincte de sa modification](docs/refonte-neon/CONTEXTE-PRESENTATION.md). Afficher ouvre une fiche sans formulaire ; Modifier reste soumis aux droits existants.

> 01/11/2026 : [fenêtres et panneaux Neon harmonisés](docs/refonte-neon/FENETRES.md), fiches de registre avec actions visibles ; contrôles et captures réelles sur la copie Codex.

> Retour visuel du 01/11/2026 : typographie des dalles Périmètres ajustée, compteurs neutres non soulignés et flèches de navigation, captures actualisées pour validation.

> 01/11/2026 : [dalles Périmètres en mode Graphe](docs/refonte-neon/DALLES-PERIMETRES.md) retravaillées, compteurs et actions conservés ; quatre tests e2e du graphe réussis.

> Complément graphique : [graphiques et menus du prototype intégrés](docs/refonte-neon/PROTOTYPE-INTEGRE.md), sur la branche Codex ; RETEX inchangé.

> Refonte graphique Codex depuis main 6.1.0 (31/10/2026, Europe/Paris) : voir [inventaire, changements et contrôles Neon](docs/refonte-neon/README.md). Copie isolée, sans changement métier ni déploiement. Recette exhaustive des 79 rubriques en attente.

# Reprendre Suivi des audits

> **Reprise la plus récente : [30/10/2026](docs/01_REPRISE_IA/REPRISE-2026-10-30.md)** (clés de sécurité FIDO2 / WebAuthn,
> ADR 0079, PR ouverte vers `claude-suivi-smsi` ; § 6 : module RETEX d'incident sur `claude/retex-incidents`,
> [ADR 0080](docs/adr/0080-habilitation-deleguee-contribution-retex.md) acceptée), qui complète celle du [29/10/2026](docs/01_REPRISE_IA/REPRISE-2026-10-29.md)
> (version 6.0.0 préparée, PR de sécurité fusionnées, écran de connexion refondu par la PR #181, reste à faire) et celle du
> [27/10/2026](docs/01_REPRISE_IA/REPRISE-2026-10-27.md) (règles de fusion, conversion Kysely, tests de bout en bout instables).
> Les sections ci-dessous sont datées.

Dernière mise à jour : **2026-10-11T04:04:46+02:00 (Europe/Paris)**.
Référence applicative analysée : **`c704fa6e6d6d516db75f963db8dd5d2049ab42c8`** ; version 3.0.2.
Branche de travail de l'unification : **`claude-suivi-smsi`** (créée depuis `feature/gpt6-evolution-smsi-grc`,
préservée comme `main`). Les sections suivantes décrivent l'état de `feature/gpt6-evolution-smsi-grc` au 11/10 matin.

Application auto-hébergée de suivi d’audit et de pilotage qualité/sécurité/HDS
multi-référentiels. On ne doit pas imposer la création d’un SMSI pour un SMQ.
Stack : Node 26+, pnpm 10.34.6, TypeScript 6.0.3, Fastify 5.12.7, React 19.3.1,
Vite 8, Vitest 5, React Router 8, Mantine 9, zod 4.6.7, PostgreSQL 18, Docker Compose, Caddy 2.11.7.

Architecture actuelle : `gateway → web → app → db` ; gateway sert la maintenance
indépendante, updater exécute les mises à jour et l’exploitation. API/base isolées
sans Internet. Documents chiffrés ; données persistantes dans DATA_DIR.
L’écran `/legacy` est retiré (ADR 0042) ; les modules sont en tables et la nouvelle interface lit
l’état par `/api/suivi/etat`. Les tables `grc_smsis` et API `/api/grc` gardent leurs
noms techniques pour compatibilité ; le parcours normal s’appelle Pilotage.

## Unification sur `claude-suivi-smsi` (11/10/2026)

Cahier de consignes « Unification et évolution de l’application SMSI/GRC ». Lire d'abord
[l'audit L1](docs/unification/L1-AUDIT-ET-CORRESPONDANCE.md) puis [le plan](docs/unification/PLAN-EVOLUTION.md).

- Réalisé : U0 (carte libre CARTO-15 à 19, socle Audit), U1 (tableau de bord unique et graphiques, menu), U2
  (DdA historique éditable, objectifs par processus, plans historiques, synthèse graphique du Pilotage), U3 (risques :
  études EBIOS RM par ateliers, fiche ISO/IEC 27005, acceptation formelle, registre ; ADR 0027, migration additive
  `016`), U4 (catalogue des relations, sens, archivés, responsables ; ADR 0028).
- Contrôles : Vitest shared, ui, web et API sur PostgreSQL 18 et Playwright complet sur la pile Docker locale ; puis,
  le dépôt étant devenu public, [CI complète verte sur `6e921fe`](https://github.com/yousername-ha/suivi-audits/actions/runs/38146426254)
  (déclenchement manuel, sans PR). Détail : `PROJECT_STATUS.md`.
- Fusionné dans `main` (11/10) par les PR #14 et #15 ; `main` = `claude-suivi-smsi`. Publiée le 12/10 : étiquette et [release v3.1.0](https://github.com/yousername-ha/suivi-audits/releases/tag/v3.1.0) (images signées) ; branches nettoyées (`main`, `claude-suivi-smsi`, `legacy` ; anciennes branches sous `archive/*`). Reste : validation du RSSI sur son serveur.
- Aucune donnée réelle ni aucun secret dans le dépôt.

## État et preuves

- 40 domaines inventoriés ; 27 validés
  automatiquement dans le périmètre décrit ; 6 partiels.
  6 familles sans remplacement Sauge complet
  identifié ; leur source legacy demeure.
- A, B1, B2a/B2b, C, G/H/K et début E ont des implémentations. B2 complet et E
  complet ne sont pas déclarés terminés. D/J/I/F exclus ; L non réalisé.
- [CI du code analysé](https://github.com/yousername-ha/suivi-audits/actions/runs/38087692231) : 587 Vitest et 143 Playwright, cinq jobs verts,
  installation, rollback, restauration et persistance compris.
  [CodeQL](https://github.com/yousername-ha/suivi-audits/actions/runs/38087692214) vert. Une seule tentative de chacun.
- Audit documentaire : **360 tests locaux sans base réussis**. Aucun test API,
  déploiement, restauration ni migration rejoué pendant cette mission.
- Dernier lot code : Trivy images 6 → 3, toujours bloquant HIGH/CRITICAL ;
  annulation CodeQL obsolète. Aucun nouveau numéro d’application pour ce lot.
- Dernier correctif fonctionnel : clic Pilotage rétabli et sauvegarde sans
  cron supplémentaire (cc285b4), updater avec GNU find et verrous de rollback
  corrigés, puis préversion **v3.0.2** au commit `fad0205`.
- 5 bugs corrigés et validés automatiquement ;
  0 bugs ouverts confirmés dans le registre.
  L’ergonomie signalée par l’utilisateur reste **CORRIGÉ NON VALIDÉ** humainement.
  « Aucun bug ouvert enregistré » ne signifie pas « aucun bug possible ».
- Résultat du test du serveur utilisateur **NON REÇU** ; aucun PV accepté.

## Prochaine action

Recetter sur le serveur de l’utilisateur : version/santé, clic Pilotage,
sauvegarde complète depuis le menu et téléchargement des données existantes
(TEST-041), puis acceptation ergonomique (TEST-042). Un ancien updater demande
un premier redéploiement ; une image immuable ancienne ne se corrige pas seule.
Consulter [le plan de reprise](docs/01_REPRISE_IA/PLAN_REPRISE.md).

Ensuite cadrer les reprises v2 restantes et compléter B2/E selon les sources
officielles disponibles. Ne pas démarrer D/J/I/F par déduction.

## Démarrer et vérifier

Développement local : installer les dépendances puis
`docker compose -f docker-compose.dev.yml up`, interface `http://localhost:5173`.
Cette pile locale ne comporte pas tous les services d’exploitation production.

```bash
git status --short --branch
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm build
pnpm --filter @suivi/shared test
pnpm --filter @suivi/ui test
pnpm --filter @suivi/web test
node --test scripts/tests/publication.test.mjs
python3 -m unittest discover -s scripts/tests -p test_updates.py
```

Ces commandes supposent Node 24+, pnpm 10.34.6 et un clone de développement.
L’installation de dépendances accède aux registres externes ; elle n’a pas été
rejouée pendant l’audit, car les dépendances étaient présentes. Les tests API,
`pnpm test` et les recettes Docker demandent une base et un environnement
explicitement dédiés. Leur setup peut supprimer les bases `suivi_t_%` :
ne jamais les pointer vers une base partagée ou de production.

Installation/serveur : suivre [le guide CI de référence](docs/INSTALLATION.md),
complété par [le guide de cette reprise](docs/06_GUIDES/GUIDE_INSTALLATION.md).
Dans le dossier installé, contrôles en lecture :

```bash
sudo docker compose ps -a
sudo docker compose logs --tail=100 app web gateway updater
```

Les logs peuvent contenir des informations privées : ne pas les committer.
Ne pas écraser .env, changer DATA_DIR, supprimer les données ou utiliser un
reset pour débloquer Git. Aucun secret dans cette documentation.

## Documents avant intervention

[AGENTS](AGENTS.md) → [PROJECT_STATUS](PROJECT_STATUS.md) →
[index](docs/00_INDEX.md) → [DAT](docs/03_ARCHITECTURE/DAT.md) →
[registre fonctionnel](docs/02_FONCTIONNALITES/INVENTAIRE_FONCTIONNEL.md) →
[comparaison v2](docs/02_FONCTIONNALITES/COMPARAISON_ANCIEN_NOUVEAU.md) →
[recette](docs/05_RECETTE/RAPPORT_RECETTE.md) →
[backlog](docs/08_PILOTAGE/BACKLOG.md).

Le dépôt reste privé et main est toujours `b148c1ba303954b7023996fce3d0eff2923326b5`.
[PR #12](https://github.com/yousername-ha/suivi-audits/pull/12) constatée ouverte
en brouillon, sans auto-merge. La documentation a été publiée sur cette branche
au commit `7cc35dc` après demande explicite. La CI historique ci-dessus reste
une preuve de c704fa6 ; la publication documentaire a déclenché les workflows
habituels. Aucun déploiement ni fusion.

## Entretien du dépôt

Nettoyage du 11 octobre : ancien prompt et rapport ponctuel retirés ; consignes
Claude regroupées autour d’AGENTS, exclusions de dossier absent supprimées,
renvois historiques clarifiés. Voir [diagnostic](docs/archive/diagnostics/2026-10-11-nettoyage-depot.md)
et [preuves](docs/05_RECETTE/preuves/2026-10-11-nettoyage.json). Les sources
applicatives, données de départ, archives et références de test sont préservées.

La CI documentaire de 7cc35dc a échoué sur une simulation API de retour arrière ;
qualité, guide et CodeQL passent. Voir le diagnostic de nettoyage. La preuve
complète verte de c704fa6 reste historique ; la prochaine CI sera celle du
nettoyage publié. Cause de l’échec NON CONFIRMÉE à ce stade.
