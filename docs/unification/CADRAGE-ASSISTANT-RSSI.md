# Cadrage — assistant RSSI intégré (serveur MCP et agent Hermes)

**Statut** : cadrage du 11/11/2026, à la demande du RSSI, avec ses décisions A1 à A4 de
l'[ADR 0086](../adr/0086-assistant-rssi-serveur-mcp-et-agent.md) (**proposée**, à accepter). Aucun code, aucune migration.
Rédaction : session « Assistant RSSI intégré plateforme » (`session_01EnWdzfTjPHLznQbaTS7Ugc`).

## 1. Besoin

Un assistant dans la plateforme qui aide à **maintenir la certification ISO/IEC 27001 et HDS** :

- **surveiller** : échéances, retards, preuves manquantes, évaluations anciennes, programme d'audit ;
- **analyser** : couverture des exigences, cohérence entre écarts, actions, risques et déclaration d'applicabilité ;
- **demander** : poser une question à la bonne personne, relancer, réclamer une preuve ;
- tenir deux rôles : aide à la **mise en œuvre** et aide à l'**audit interne**.

Décisions du RSSI : modèle réglable et local par défaut ; serveur MCP natif avec Hermes Agent à côté ; l'assistant lit et
propose, une personne valide.

Ce que l'assistant **n'est pas** : un auditeur ou un RSSI au sens des normes. Il prépare, signale et rédige des
brouillons. Les décisions, les validations et la conclusion d'un audit restent celles de personnes désignées.

## 2. Schéma

```mermaid
flowchart LR
    U[Navigateur] -->|HTTPS| G[gateway] --> W[web] --> A[app : API et serveur MCP]
    A --> P[(PostgreSQL)]
    H[agent Hermes, conteneur optionnel] -->|MCP, jeton porteur| A
    A -.->|dialogue, lot A4| H
    H -->|API compatible OpenAI| M[serveur de modèle local, conteneur optionnel]
    H -.->|seulement si l'exploitant le règle| X[fournisseur extérieur]
```

Réseaux : `assistant` (interne) entre `app` et l'agent ; `modele` (interne) entre l'agent et le modèle local. L'API ne
sort jamais. L'agent n'a ni base, ni socket Docker, ni fichiers de l'application.

## 3. Ce qui est réutilisé et ce qui est nouveau

| Besoin | Réutilise (existant) | Nouveau (strict nécessaire) |
|---|---|---|
| Lire les données avec des droits | Porte de lecture (`apps/api/src/acces/portee.ts`, ADR 0083), services GRC et historiques, `grc_members`, `droits_ressources` | Portée d'un compte d'assistant ; outils MCP de lecture, paginés |
| Authentifier l'agent | Hachage SHA-256 des jetons (sessions, écran mural), `REDACT`, limiteurs (`http/security.ts`) | Compte d'assistant, jeton porteur, type d'accès `assistant` dans `route()` |
| Module et droits | `MODULES`, `MODULE_REGISTRY`, `module_activation`, rôles | Module `assistant` (3 actions) et migration de la contrainte |
| Proposer sans écrire | Cycle des rapprochements (`grc/rapprochements.ts` : statuts, `decide()`), aperçu puis confirmation | Tables de propositions et de questions ; outils de dépôt |
| Appliquer une proposition | `Grc.insert`/`Grc.write`, clôtures, évaluations d'exigences, tâches : chacun avec ses versions, son audit, son temps réel | Aiguillage d'une proposition confirmée vers le service de sa cible |
| Prévenir une personne | Notifications métier (ADR 0058), réglages par groupe, rôle et utilisateur, courriel par l'exécutant | Deux types : proposition à décider, question posée |
| Détecter | Rappels de l'automate (`grc/tasks.ts`), couverture (`couverture.ts`), plan d'audit, parcours ISO/HDS | Outil « signaux » qui assemble ces faits, sans nouveau calcul de conformité |
| Tracer | `Db.audit`, `audit_log` en ajout seul, acteurs non humains déjà admis | Audits `assistant.*` par appel d'outil |
| Déployer | Profil Compose facultatif (antivirus), réseaux internes, épinglage par empreinte (ADR 0063), `DATA_DIR` | Profil `assistant` : conteneurs Hermes et modèle, configuration générée |
| Interface | `packages/ui`, CSP stricte, écran des rapprochements, cloche des notifications | Rubrique « Assistant » : propositions, questions, rapports, puis dialogue |
| Recette | Organisation fictive et harnais du RSSI virtuel (`tests/e2e/rssi-virtuel/`) | Jeu d'évaluation de l'assistant sur données fictives |

## 4. Parcours cibles

- **Ronde de surveillance (planifiée dans Hermes).** L'agent appelle l'outil « signaux », lit les objets concernés, dépose
  des propositions et des questions, puis un court rapport daté. La personne voit une notification, ouvre la proposition,
  lit les sources citées, confirme, modifie ou rejette avec un motif.
- **Mise en œuvre.** « Où en est-on sur la clause 9 ? » : l'agent lit couverture, DdA et parcours, répond avec les
  identifiants des exigences, et propose les actions manquantes.
- **Préparation d'un audit interne.** À partir du programme, du périmètre et des exigences du référentiel attaché, l'agent
  prépare un plan, une liste de points à vérifier et les preuves à demander. Aucun texte de norme n'est reconstitué : seuls
  les intitulés présents dans la bibliothèque de l'organisation sont repris.
- **Pendant et après l'audit.** L'auditeur dicte ou saisit ses observations ; l'agent propose des constats rattachés aux
  exigences, puis un brouillon de rapport. L'auditeur valide chaque constat.
- **Administration.** Créer un compte d'assistant par profil, choisir ses périmètres, générer le jeton (affiché une fois),
  le révoquer, purger la mémoire de l'agent, lire le journal des appels.

## 5. Séparation des deux rôles

Un auditeur n'audite pas son propre travail (ISO/IEC 27001, 9.2 ; ISO 19011). D'où :

| | Profil « Mise en œuvre » | Profil « Audit interne » |
|---|---|---|
| Compte, jeton, mémoire | Propres | Propres, sans partage |
| Peut proposer | Écarts, actions, tâches, évaluations, relances, questions | Éléments de préparation, constats, questions |
| Ne propose jamais | Constat d'audit | Action corrective |
| Garde-fou | — | Constat sur un objet issu de l'assistant : signalé à l'auditeur |

## 6. Sécurité

| Risque | Parade |
|---|---|
| Fuite de données du SMSI vers un fournisseur | Modèle local par défaut, réseaux internes ; sortie seulement par réglage explicite, affichée dans l'interface |
| Injection par un contenu lu (rapport importé, fiche fournisseur) | Aucun outil d'écriture directe, aucun outil sur l'hôte, aucune sortie ; décision humaine avec sources |
| Jeton volé | Haché, à expiration, révocable, lecture seule, périmètres explicites, limiteur, journal |
| Agent compromis | Conteneur sans privilège, lecture seule, sans socket Docker ni montage ; image épinglée |
| Chiffres inventés | Aucun taux calculé par le modèle ; signaux et couvertures viennent des outils ; identifiants cités |
| Validation à la chaîne sans lecture | Pas de confirmation en lot au départ ; motif exigé au rejet ; mention d'origine conservée sur l'objet créé |
| Déni de service par l'agent | Pagination, plafonds, limiteur par jeton, verrou d'une seule ronde à la fois |

L'assistant est un usage d'IA de l'organisation : GAP IA (ADR 0064) et appréciation des risques avant mise en service.

## 7. Lots proposés (sans calendrier ; estimations non établies)

| Lot | Contenu | Acceptation |
|---|---|---|
| A0 | ADR 0086 et ce cadrage | Relus et acceptés par le RSSI |
| A1 | **Socle MCP en lecture.** Module `assistant` et migration ; comptes d'assistant et jetons ; type d'accès `assistant` ; outils de lecture par la porte de lecture ; outil « signaux » ; audit ; écran d'administration. Essai d'interopérabilité avec Hermes (révision du protocole) avant d'écrire le transport | Refus sans jeton, jeton expiré ou révoqué, module désactivé, hors périmètre, registre restreint. Aucun outil n'écrit (prouvé par test). Jeton jamais relu ni journalisé. `rbac.test.ts` vert. Migration sur base vierge et existante. Utilisable sans aucun modèle, par un client MCP quelconque |
| A2 | **Propositions et questions.** Tables, outils de dépôt, rubrique « Assistant », décision avec droit de la cible, notifications | Rien n'est écrit dans un registre avant confirmation. Confirmation refusée sans le droit de la cible. Rejet non redéposé à sources inchangées. Objet créé sous l'identité de la personne, origine mentionnée |
| A3 | **Agent et modèle.** Profil Compose `assistant`, durcissement, configuration Hermes générée (outils natifs désactivés, liste blanche), modèle local, rondes planifiées, guide d'installation, sauvegarde et purge de la mémoire | Aucune sortie réseau constatée en configuration par défaut. Outils natifs absents (prouvé). Jeu d'évaluation sur organisation fictive : résultats **mesurés et publiés**, y compris les échecs. Mesure de temps de réponse sur le matériel du RSSI |
| A4 | **Dialogue dans l'interface.** Relais de l'API vers l'agent, fil de conversation, sources cliquables | CSP stricte respectée. Le dialogue n'élargit aucun droit. Captures clair et sombre |
| A5 | **Audit interne.** Profil dédié, préparation, constats proposés, brouillon de rapport, garde-fou d'indépendance | Aucune action corrective déposée par ce profil. Aucun texte de norme reconstitué. Recette par un auditeur |
| A6 | **Mise en œuvre.** Parcours ISO/HDS, DdA, couverture, préparation de la revue de direction | Chaque réponse cite ses sources ; aucun taux hors outils |

A1 et A2 ont une valeur sans modèle : tout client MCP peut s'y brancher. A3 est le lot à risque (matériel, qualité du
modèle local) : s'il échoue, le reste n'est pas perdu.

## 8. Non vérifié à ce jour

- Révision MCP parlée par le client de Hermes 0.23.1 (2025-11-25 ou 2026-07-28).
- Existence d'un réglage Hermes unique « outils MCP seulement » : les mécanismes existent, la recette n'est pas documentée.
- Qualité et vitesse d'un modèle local sur ces outils ; matériel du serveur (inconnu dans le DAT).
- Aucun essai n'a été exécuté : ce document repose sur la lecture du code et des documentations officielles du 11/11/2026.
