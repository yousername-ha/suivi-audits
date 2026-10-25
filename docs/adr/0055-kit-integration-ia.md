# ADR 0055 — Kit d'intégration IA : contrôles internes, correspondances proposées, veille

- Statut : acceptée
- Date : 2026-10-25
- Contexte : un kit de l'organisation (contrôles IA internes, correspondances indicatives vers l'ISO/IEC 27001, l'HDS et des thèmes ISO/IEC 42001, deltas HDS 2.1 préparatoires, sources) doit entrer dans l'outil **depuis l'interface**, sans fichier à manipuler sur le serveur et sans que son contenu soit versionné dans le dépôt public. Réponses du 25/10/2026 : champs dédiés ; le kit prend le relais des points IA du questionnaire « Applications à intégrer » ; la page « Conformité IA » est renvoyée vers le référentiel à l'import ; sources juridiques « à revérifier » ; risques d'abord, kit ensuite. S'appuie sur la bibliothèque ([ADR 0031](0031-bibliotheque-de-referentiels.md)), la couverture par exigence ([ADR 0041](0041-evaluation-des-exigences-et-couverture.md)) et les correspondances de la bibliothèque.

## Décision

- **Les contrôles deviennent un référentiel de la bibliothèque** (`ia-controles-internes`, source « organisation », non normative, jamais « vérifiée »). Il se rattache aux périmètres, s'évalue exigence par exigence et se lit dans la Couverture comme tout autre référentiel : aucun écran parallèle.
- **Champs dédiés** (extension additive du schéma d'une exigence, facultative) : question d'audit, preuve attendue, périmètres éligibles (IA externe / IA des applications métier), priorité suggérée, fonction responsable proposée, fréquence de revue proposée, thème ISO/IEC 42001. Une exigence d'un autre référentiel n'en porte pas.
- **Chargement par l'interface** : la page Bibliothèque accepte un ou plusieurs fichiers JSON, reconnus d'après leur contenu (kit complet ou listes). Le navigateur n'en conserve rien. L'API valide (Zod), refuse un texte déclaré normatif, un delta marqué importable comme exigence en vigueur et une correspondance vers un contrôle inconnu.
- **Aperçu puis import confirmé** : `POST /api/library/ia-kit/preview` n'écrit rien et dit ce qui serait créé, rattaché, déjà présent ou non reconnu ; `POST /api/library/ia-kit/import` exige l'identifiant d'aperçu, un motif (10 caractères) et la confirmation `IMPORTER`, et passe par la publication de bibliothèque (version immuable, journal). Droit exigé : `conformite:modifier` (lecture du dernier import : `conformite:lire`). Corps limité à 4 Mio.
- **Idempotence** : l'empreinte SHA-256 du kit est enregistrée (`lib_kit_ia`, migration additive `042_kit_ia.sql`). Rejouer le même kit n'écrit rien ; si ISO/IEC 27001 ou HDS est importé plus tard, rejouer le kit rattache les correspondances restantes sans doublon.
- **Correspondances toujours « proposées »** : type « lié », couverture 0, origine « IA », jamais validées par l'import. Les indications du kit sont résolues vers les exigences des référentiels ISO et HDS de la bibliothèque (§ de clause, A.x.y de l'Annexe A, EXI nn) d'après les numéros lus dans leurs intitulés ; ce qui n'est pas reconnu est **listé, jamais deviné**. Les thèmes ISO/IEC 42001 sont conservés sans rattachement (aucun référentiel 42001 n'est attachable).
- **Annexes de veille** (actions suggérées, scénarios de risque, deltas HDS 2.1, mémos HDS, questionnaire de qualification, sources) conservées avec le kit et lisibles dans « Veille et annexes du kit ». Les deltas sont des projets préparatoires, **jamais** des exigences ; sources et statuts juridiques portent « à revérifier » (aucune date de vérification n'est inscrite).
- **Page « Conformité IA »** : une fois le kit importé, elle affiche un renvoi vers le référentiel. Ses données ne sont **pas supprimées** (opération irréversible, hors de l'import) ; leur retrait reste une décision explicite du RSSI.

## Ce qui n'est pas fait

- Les points IA du questionnaire « Applications à intégrer » ne sont pas retirés : ils restent comme repli tant que le kit n'est pas importé. Leur remplacement par le kit demande une décision sur le rattachement des services (assistant « Analyser un service »).
- La résolution des indications est au mieux : elle dépend de la numérotation des intitulés du référentiel ISO/HDS importé ; un format inattendu donne des indications non reconnues, listées.
- Pas de rattachement automatique du référentiel IA aux périmètres, ni de génération d'actions : ces gestes restent humains.
- Le contenu du kit n'est ni livré ni testé avec le texte réel ; les tests utilisent un kit fictif.

## Conséquences

Une table `lib_kit_ia` (annexes en JSON, empreinte unique), trois routes, un champ facultatif par exigence et un composant d'import. Aucune dépendance. Pas de fuite de contenu dans le dépôt ni dans les journaux (le journal garde version, effectifs et empreinte).
