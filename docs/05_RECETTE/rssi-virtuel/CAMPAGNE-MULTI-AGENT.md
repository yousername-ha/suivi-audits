# Campagne de recette complète à plusieurs agents

Dossier de reprise pour une **nouvelle session Claude Code** chargée de recetter toute l'application, écran par écran,
sans trou. Il se suffit à lui-même : la session qui le lit n'a pas besoin de l'historique de la session « Agent RSSI
virtuel » qui l'a rédigé le 12/11/2026.

## 1. Objet

La recette du 12/11/2026 a suivi un scénario de 17 étapes. Elle a trouvé 22 défauts (BUG-016 à BUG-037), mais un
scénario ne croise pas tout : le défaut des processus sans périmètre (BUG-037) n'apparaît que sur l'écran « Processus »
affiché sous un sous-périmètre, et aucun parcours n'y passait. La campagne remplace le scénario par une **matrice de
couverture** tirée du code : chaque case non testée reste visible.

| Élément | Valeur |
|---|---|
| Matrice | [MATRICE-COUVERTURE.md](MATRICE-COUVERTURE.md) : 107 écrans, 1 712 cases, 35 types d'objets |
| Outil | `tests/e2e/rssi-virtuel/matrice.mjs` (`generer`, `modele`, `bilan`) |
| Piles | `tests/e2e/rssi-virtuel/lancer.sh --pile N --garder` : une pile vierge par agent |
| Agent | `.claude/agents/rssi-virtuel.md` (sous-agent `rssi-virtuel`) |
| Résultats | `docs/05_RECETTE/rssi-virtuel/campagne/` |

## 2. Rôle de la session : recette seulement

Décision du RSSI du 12/11/2026, à appliquer sans exception :

- La session **teste et rapporte**. Elle ne corrige rien dans `apps/` ni `packages/`. Les corrections sont faites par
  la session de développement dédiée, à partir du registre des bugs.
- Elle travaille sur la branche `claude/recette-rssi-2026-11-12` (ou une branche `claude/recette-…` créée depuis
  `claude-suivi-smsi`). **Aucune PR vers `main`, aucune fusion** sans demande explicite du RSSI.
- Dépôt public : données fictives uniquement (`tests/e2e/rssi-virtuel/donnees/organisation-fictive.json`), aucun
  secret, aucun nom d'organisation réelle, y compris dans les messages de commit. Le test
  `apps/api/test/references-organisation.test.ts` échoue sinon.
- Les refus du réseau ou des permissions ne se contournent pas : la session s'arrête et le signale.
- `AGENTS.md` et `CONTRIBUTING.md` s'appliquent à tout ce qui est écrit.

## 3. Prérequis

| Prérequis | Vérification |
|---|---|
| Docker et Compose utilisables avec `sudo` | `sudo docker info` |
| Images accessibles (`postgres:18-alpine`, image Playwright, images de construction) | `sudo docker pull postgres:18-alpine` |
| Environ 2 Go de mémoire par pile, soit 12 Go pour six piles | `free -g` |
| Node et pnpm pour le pilote, dépendances installées | `pnpm install` puis `node tests/e2e/rssi-virtuel/pilote.mjs` |

**Briques techniques.** La recette du 12/11/2026 a tourné hors Docker sur PostgreSQL 16 et Node 22, faute d'accès aux
registres. Le RSSI exige les briques de l'application (PostgreSQL 18, Node 26) : la campagne ne tourne **que** sur les
piles Docker de `lancer.sh`. Si Docker n'est pas disponible, la session s'arrête là et le dit.

**Première exécution (12 et 13/11/2026).** `lancer.sh --pile N --garder` a tourné pour la campagne
([rapport](RAPPORT-CAMPAGNE-2026-11-13.md)) après trois corrections du script ; derrière un proxy TLS, construire les images
une fois avec le secret BuildKit `build_ca` puis passer `--images-locales` (en-tête du script). Le harnais complet
(`lancer.sh` sans `--garder`) ne passe que sur la pile sans numéro (`https://localhost`) : sur une adresse IP,
l'installation ne propose pas de clé de sécurité et `00-installation` s'arrête. Le workflow `rssi-virtuel.yml` n'a pas
été exécuté. Historique : `lancer.sh` et ce workflow avaient été écrits et relus sans Docker. La première étape de la campagne est donc de lancer une seule pile
(`--pile 1 --garder`), de constater qu'elle répond, puis de l'arrêter. Un défaut du script se corrige dans le script :
c'est de l'outillage de recette, pas du code de l'application.

## 4. Piles en parallèle

```bash
sudo tests/e2e/rssi-virtuel/lancer.sh --pile 1 --garder     # https://127.0.0.11
sudo tests/e2e/rssi-virtuel/lancer.sh --pile 2 --garder     # https://127.0.0.12
sudo tests/e2e/rssi-virtuel/lancer.sh --pile 1 --arreter    # arrêt et effacement
```

Chaque pile a son projet Compose (`suivi-rssi-virtuel-N`), son dossier (`/srv/suivi-rssi-virtuel-N`) et son adresse
de bouclage (`127.0.0.(10+N)`, port 443). Le script affiche les variables à donner au pilote ; chaque agent a aussi
son propre navigateur et son propre journal :

```bash
export E2E_BASE_URL=https://127.0.0.11 PILOTE_PORT=9334 PILOTE_DOSSIER=.pilote-1
export E2E_TOKEN_CMD='sudo docker compose -p suivi-rssi-virtuel-1 --env-file /srv/suivi-rssi-virtuel-1/.env exec -T app setup-token'
node tests/e2e/rssi-virtuel/pilote.mjs demarrer
```

Les clés de sécurité (WebAuthn) ne fonctionnent pas sur une adresse IP : leur recette se fait sur la pile sans numéro
(`https://localhost`), une fois les autres arrêtées.

## 5. Déroulé en trois phases

### Phase 1 : six agents de domaine, en parallèle

Un sous-agent `rssi-virtuel` par tranche, chacun sur sa pile (agent N sur la pile N).

| Agent | Tranche | Écrans | Cases |
|---|---|---|---|
| 1 | Organisation, contexte, objectifs, fournisseurs | 19 | 114 |
| 2 | Risques : méthode, appréciation, traitement, EBIOS RM | 7 | 42 |
| 3 | Conformité, DdA, audits, preuves et contrôles | 21 | 126 |
| 4 | Écarts, actions, plans annuels, revue de direction, registres | 10 | 60 |
| 5 | Incidents, crise, continuité, documents, exports | 15 | 90 |
| 6 | Installation, comptes, Plateforme, Système, paramètres | 35 | 210 |

Consigne de chaque agent :

1. Vérifier que la pile est vierge (`GET /api/setup` : `needed:true`, `adminExists:false`), l'installer, créer un
   sous-périmètre rattaché au périmètre commun.
2. Produire son modèle : `node tests/e2e/rssi-virtuel/matrice.mjs modele N > docs/05_RECETTE/rssi-virtuel/campagne/agent-N.csv`.
3. Pour chaque écran de sa tranche, sous le périmètre principal puis sous le sous-périmètre :
   - **vide** : l'écran s'affiche, dit clairement qu'il n'y a rien, propose l'action de création ;
   - **rempli** : saisir les données fictives, relire, modifier, lier aux autres objets, supprimer, exporter ; vérifier
     que la donnée saisie sous un périmètre n'apparaît pas sous l'autre, et que les compteurs et synthèses la reprennent ;
   - **erreur** : champ obligatoire vide, valeur invalide, doublon ; le message doit désigner le champ en français.
4. Couvrir les types d'objets de sa tranche (liste dans la matrice) : créer, modifier, lier, supprimer, exporter.
5. Juger en RSSI avec la grille de `.claude/agents/rssi-virtuel.md` : une donnée qui disparaît, un chiffre faux, un
   écran qui contredit un autre sont des défauts même sans erreur technique.
6. Remplir son CSV au fil de l'eau (`ok`, `defaut` avec référence, `sans-objet` avec raison) et rédiger
   `campagne/constats-agent-N.md` avec le modèle de constat de l'agent. Références provisoires : `C<N>-01`, `C<N>-02`…
7. **Ne pas arrêter sa pile** : elle sert à la phase 2.

Un défaut déjà connu (BUG-016 à BUG-037, [registre](../../04_QUALITE/REGISTRE_BUGS.md)) se note `defaut` avec son
numéro `BUG-…`, sans nouveau constat. Un écran d'une autre tranche qui affiche une donnée fausse se signale dans les
constats, la case reste à l'agent de cette tranche.

### Phase 2 : passage transversal, sur les piles remplies

Six sous-agents en parallèle, un par pile laissée remplie par la phase 1. Chacun :

1. Produit son modèle : `matrice.mjs modele 7 N > campagne/agent-7-tranche-N.csv`.
2. Crée un compte par rôle (`administrateur`, `contributeur`, `lecteur`, `auditeur_externe` avec date d'expiration et
   modules choisis) et un contributeur limité au sous-périmètre.
3. Pour chaque écran de la tranche et chaque compte : ce que le rôle voit, ce qu'il peut modifier, et ce que l'API
   refuse quand l'interface masque le bouton (`pilote.mjs api`). Une lecture ou une écriture hors droits est un défaut
   **bloquant**.
4. Passe chaque écran au téléphone (`pilote.mjs taille 390 844`) : rien de coupé, rien d'inaccessible.
5. Rédige `campagne/constats-agent-7-tranche-N.md`.

### Phase 3 : consolidation, par la session principale

1. `node tests/e2e/rssi-virtuel/matrice.mjs bilan` : le code de retour est 1 tant qu'il reste une case non testée ou
   une ligne mal formée. Relancer un agent sur les cases manquantes plutôt que les déclarer sans objet.
2. Fusionner les constats, supprimer les doublons, **rejouer chaque défaut bloquant ou majeur** avant de l'inscrire :
   un constat non reproduit est écarté et listé comme tel.
3. Inscrire les défauts retenus au [registre des bugs](../../04_QUALITE/REGISTRE_BUGS.md) (BUG-038 et suivants),
   rédiger `RAPPORT-CAMPAGNE-<date>.md` (bilan de la matrice, défauts par gravité, cases sans objet et pourquoi) et
   la demande de correctifs sur le modèle de [DEMANDE-CORRECTIFS-2026-11-12.md](DEMANDE-CORRECTIFS-2026-11-12.md).
4. Pour chaque défaut bloquant ou majeur, ajouter au harnais (`tests/e2e/rssi-virtuel/specs/`) un test marqué
   `test.fail(true, 'RSSI-NN ouvert : …')` : il passe tant que le défaut existe et devient rouge le jour où il est
   corrigé. Ne jamais affaiblir une assertion.
5. Arrêter les piles (`--pile N --arreter`), mettre à jour `CHANGELOG.md` (« Non publié ») et `docs/00_INDEX.md`,
   valider et pousser sur la branche de recette. Pas de PR sans demande.

## 6. Quel modèle

| Usage | Modèle |
|---|---|
| Session principale (orchestration, consolidation, rejeu des défauts) | Opus 5.5 ou Fable 5.2 |
| Sous-agents de recette | Opus (déjà réglé dans `.claude/agents/rssi-virtuel.md`) |
| Corrections, par la session de développement | Sonnet 5.5 |

Juger une cohérence normative et repérer ce qui manque demande le modèle le plus capable ; Sonnet convient au travail
cadré de correction, pas à la recette exploratoire.

## 7. Texte de lancement

À coller dans une nouvelle session Claude Code ouverte sur le dépôt, branche `claude/recette-rssi-2026-11-12`, sur
une machine où Docker fonctionne :

```text
Tu es la session de recette de l'application. Lis CLAUDE.md, AGENTS.md, puis
docs/05_RECETTE/rssi-virtuel/CAMPAGNE-MULTI-AGENT.md et applique-le à la lettre.

Règles : tu testes et tu rapportes, tu ne corriges rien dans apps/ ni packages/. Pas de PR, pas de fusion.
Données fictives uniquement, aucun secret, aucun nom d'organisation réelle. Briques de l'application
uniquement (piles Docker de lancer.sh) : si Docker ou les images ne sont pas accessibles, arrête-toi et dis-le.

Étapes :
1. Vérifie les prérequis du §3, puis valide lancer.sh avec une seule pile (--pile 1 --garder, puis --arreter).
2. Phase 1 : lance six piles et six sous-agents rssi-virtuel en parallèle, un par tranche.
3. Phase 2 : six sous-agents transversaux sur les piles remplies.
4. Phase 3 : bilan de la matrice (aucune case non testée), rejeu des défauts bloquants et majeurs,
   registre des bugs, rapport de campagne, demande de correctifs, tests test.fail, arrêt des piles, commit et push
   sur la branche de recette.

Rends-moi compte à la fin de chaque phase : cases couvertes, défauts par gravité, ce qui te bloque.
```

## 8. Ce qui est déjà connu

- Rapports : [11/11/2026](RAPPORT-2026-11-11.md), [12/11/2026](RAPPORT-2026-11-12.md),
  [dossier graphique](DOSSIER-GRAPHIQUE-2026-11-12.md) (GR-01 à GR-23, 16 vues examinées seulement).
- Défauts ouverts : BUG-016 à BUG-037, dont deux bloquants (BUG-020 parties intéressées, BUG-021 revue validée non
  reconnue). Tous constatés hors briques réelles : **à confirmer** pendant la campagne, dans les cases concernées.
- Cause fréquente : des écrans lisent encore le registre historique (`/api/suivi/etat`) alors que les formulaires
  écrivent des objets du registre (`/api/grc/:smsiId/objects`). Tout écran de synthèse est à comparer à sa saisie.
- Arbitrages attendus du RSSI, à ne pas trancher : BUG-031 (entrées de revue ISO 27001 9.3.2), BUG-024 (appréciation
  du risque sans matrice), rôle d'auditeur interne.
- Harnais : `tests/e2e/rssi-virtuel/specs/`, 20 tests attendus dont 8 `test.fail`. Quand la session de développement
  corrige un défaut, le test devient rouge : la recette rejoue le cas puis retire le marqueur.

## 9. Limites de ce dossier

- La matrice garantit que chaque écran est ouvert dans chaque situation, pas que chaque règle métier est vérifiée :
  la profondeur dépend du jugement de l'agent. Le rejeu de la phase 3 et les invariants
  (`tests/e2e/rssi-virtuel/invariants.ts`) sont le filet.
- L'inventaire lit le menu du pilotage, les cartes Plateforme et Système et les routes. Les fenêtres, onglets et
  fiches ouverts depuis un écran ne sont pas des lignes de la matrice : ils se testent dans la case de leur écran.
- Les notifications par courriel, les sauvegardes, les mises à jour et les certificats dépendent de services
  extérieurs à la pile : cases `sans-objet` acceptées si la raison est écrite.
