# Scénario du RSSI virtuel : mettre en œuvre un SMSI ISO/IEC 27001:2022 + HDS sur une installation neuve

Lu par l'agent [`rssi-virtuel`](../../../.claude/agents/rssi-virtuel.md). Organisation et données : [jeu fictif](donnees/gcs-fictif.json).
Les étapes 1 à 11 suivent le **parcours ISO 27001 / HDS de l'application** (`/pilotage/parcours-iso`), les étapes 12 à 16 ses
compléments HDS. L'étape 0 est l'installation, l'étape 17 la vérification croisée. Le parcours ISO de l'application est la porte
d'entrée de chaque étape : il mène à la bonne rubrique avec le bon périmètre, et **le fait qu'il y mène est lui-même vérifié**.

Colonne « Harnais » : ce qui est déjà vérifié par un test déterministe (`specs/`) ou un invariant (`invariants.ts`). Le reste
est exploratoire : l'agent le vérifie à la main, puis propose le test qui manque.

| Étape | Ce que fait le RSSI | Critères d'acceptation (extraits) | Harnais |
| --- | --- | --- | --- |
| 0. Installer | Poivre et clé de secours au coffre, jeton, compte administrateur, TOTP, clé de sécurité « Plus tard » | Chaque secret exige la recopie de sa fin ; `/setup` fermé ensuite ; aucune erreur JS/CSP ; libellés en français | `00-installation` |
| 1. Définir le cadre (4.1 à 4.4) | Nom de l'organisation, périmètre du SMSI et périmètre HDS (sous-périmètre), enjeux internes et externes, parties intéressées | Le périmètre HDS hérite des référentiels du SMSI ou s'en écarte explicitement ; le contexte est rattaché au bon périmètre | à écrire |
| 2. Engager la direction (5.1 à 5.3) | Politique de sécurité (document), rôles : RSSI, DPO, pilote de processus, auditeur interne, direction (comptes du jeu fictif) | Chaque compte n'obtient que les droits de son rôle ; l'auditeur interne ne modifie pas ce qu'il audite ; le journal d'audit trace les attributions | à écrire |
| 3. Mobiliser les moyens (7.1 à 7.5) | Déposer les documents (politique, PSSI, procédure de gestion des incidents), versions, liens vers les mesures | Version, auteur, date et document chiffré ; une nouvelle version garde l'historique ; un document est rattachable à une mesure de la DdA | à écrire |
| 4. Apprécier les risques (6.1.1, 6.1.2, 8.2) | Méthode (échelles, critères d'acceptation), actifs, scénarios du jeu fictif, évaluation | Méthode publiée et versionnée avant l'évaluation ; niveau brut recalculable depuis les échelles ; carte des risques cohérente avec le registre | à écrire |
| 5. Fixer les objectifs (6.2, 6.3) | Objectifs mesurables du jeu fictif, indicateurs et valeurs | Un objectif a une cible, une échéance, un responsable ; la valeur saisie apparaît dans la synthèse | à écrire |
| 6. Choisir le traitement (6.1.3, 8.3) | Traitement de chaque risque (réduire, accepter, transférer, éviter), mesures de l'annexe A choisies, acceptation formelle du risque résiduel | Un risque « réduit » pointe vers des mesures applicables de la DdA ; une acceptation porte son décideur et sa date | à écrire |
| 6 bis. Déclaration d'applicabilité (6.1.3 d) | DdA annexe A, clauses ISO et HDS : applicabilité, niveau, **justification de chaque inclusion et exclusion** | 93 mesures (37/8/14/34) ; aucune exclusion sans justification ; indicateurs recalculables ; une mesure non examinée n'est pas comptée applicable | `10-dda`, invariants INV-01 à INV-04 |
| 7. Mettre en œuvre (8.1) | Planifier les contrôles récurrents (revue des accès, sauvegardes), conserver les enregistrements | Une occurrence en retard apparaît au tableau de bord ; la preuve est rattachée à l'occurrence | à écrire |
| 8. Auditer le SMSI (9.2) | Programme d'audit interne (cycle : certification, surveillances, renouvellement), plan d'audit, constats | Le cycle correspond aux dates de l'organisation, pas à un cycle par défaut ; un constat porte sa clause ou sa mesure | partiel (`20-ecarts`) |
| 9. Relier les constats (10.2) | Écart mineur sur une mesure déclarée « Total », action corrective, responsable, échéance | Incohérence « Total avec écart ouvert » signalée ; l'écart apparaît au tableau de bord et dans le plan d'écarts ; clôture avec efficacité | `20-ecarts`, INV-05 à INV-07 |
| 10. Mesurer les résultats (9.1) | Indicateurs d'amélioration, synthèse du Pilotage | Chiffres de la synthèse égaux à ceux des registres | à écrire |
| 11. Réunir la direction (9.3) | Revue de direction : entrées a) à g) de 9.3.2, décisions, export | Toutes les entrées présentes ; décisions immuables ; export lisible | à écrire |
| 12. Améliorer (10.1) | Suivre les corrections, vérifier l'efficacité, clôturer | Une action terminée ne recalcule pas le résiduel ; un écart clos sans efficacité vérifiée est signalé | à écrire |
| 13 à 16. HDS | Qualifier les activités d'hébergement, compléments HDS du SMSI, contrats (sous-traitants du jeu fictif), souveraineté et localisation, dossier de certification | Les six activités HDS sont qualifiables ; chaque sous-traitant a ses engagements ; les données de localisation sont exportables | à écrire |
| 17. Vérification croisée | Incident fictif, cellule de crise, RETEX ; exports (DdA, registres, état complet) ; sauvegarde | L'incident remonte au registre, au RETEX et à la revue ; un export réimporté redonne le même état ; tous les invariants verts | INV-08, INV-09 |

## Comptes du jeu fictif

Créés à l'étape 2 par l'administrateur, chacun enrôle son TOTP à la première connexion (`pilote.mjs totp <secret>`). Les
secrets ne sont pas notés dans le rapport. Mot de passe des tests de bout en bout (`PASSWORD` de `helpers.ts`), jamais un mot
de passe réel.

## Ce qui n'est pas dans le périmètre

Lots D, J, I, F (exclus de la livraison, `AGENTS.md`) ; mises à jour de l'application et restauration (tests d'exploitation
existants) ; clés FIDO2 physiques (liste de contrôle manuelle `docs/05_RECETTE/CHECKLIST-FIDO2.md`).
