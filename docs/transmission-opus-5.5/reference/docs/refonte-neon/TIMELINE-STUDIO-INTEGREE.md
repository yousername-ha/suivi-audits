# Actions et récurrences Studio intégrées

11 novembre 2026 — Europe/Paris. Session : Codex (01a193c1-316c-7677-831f-2f31592aa052).

La demande d’augmenter l’intensité de l’animation puis de fournir le ZIP complet sans connexion autorise cette intégration. Les propositions précédentes Actions / Récurrences / Timeline adaptative passent dans l’application ; aucune nouvelle approbation n’est attendue pour ce lot.

## Résultat

Timeline par défaut, panneaux biseautés dans la palette SWOT/PESTEL, cartes et repères dépliables en trois zones, fiches métier complètes accessibles au clavier. Les dates, responsables, états, validations, filtres, registres, droits et versions viennent des API existantes. La liste compacte garde sa sémantique de tableau ; les vues Kanban, calendrier, Gantt et synthèse restent accessibles. Les réglages, modèles et calendriers iCalendar des séries sont regroupés dans « Séries et réglages ».

La pulsation orange passe de 2,8 à 2,2 secondes, avec un halo et un liseré plus visibles. Le texte et les positions restent stables. Pause et `prefers-reduced-motion` couvrent les éléments et leurs pseudo-éléments. Le retard reste une information distincte du statut et du résultat de validation.

Auto suit la périodicité de la série sélectionnée ; toutes séries confondues, il retient l’unité la plus fine des séries représentées. Journalier = 14 jours, hebdomadaire = 12 semaines, mensuel = 12 mois calendaires, annuel = cinq années civiles. Les mois ont leurs vraies largeurs, les semaines sont ISO, les années bissextiles sont respectées. Navigation, retour à aujourd’hui et ajustement à toutes les dates sont disponibles. Les repères proches prennent un étage supplémentaire. Aucune échéance ni occurrence n’est créée par le rendu ; les fiches hors horizon, sans échéance ou incohérentes restent accessibles. Une série annuelle en pause conserve ses commandes et son état vide.

Le [profil Docker interfaces](DOCKER-INTERFACES.md) initialise automatiquement une instance fictive isolée et ouvre directement l’application. Les profils habituels conservent leur connexion. Aucune route, garde, migration ou dépendance serveur n’a été modifiée.

## Recette réelle

- 250 tests web et 243 tests UI réussis ; 27 contrôles ciblés rejoués après les dernières finitions.
- Neuf parcours E2E réussis : périodicités et série vide, animation/pause/clavier, navigateur neuf sans connexion, attribution de droits depuis une action, fenêtre/validation/enchaînement/iCalendar, cent actions sur ordinateur et téléphone, filtres par registre, jours de fond.
- Sept parcours ont réussi au premier passage. Les deux cas « cent actions » signalaient un liseré qui dépassait de 2 px en bas : il a été placé à l’intérieur du panneau ; les deux parcours passent ensuite, sans réduire leurs assertions et sans rejeu automatique.
- 24 dispositions clair/sombre, Actions/Récurrences, de 320 à 1920 px, sans débordement détecté ; quatre analyses Axe ciblées sans violation, aucune erreur JavaScript relevée.
- API directe sans session refusée (401), écriture sans CSRF refusée (403), fichier de session refusé par Vite (403), connexion du profil normal conservée. Ces vérifications complètent les parcours avec l’API réelle.
- TypeScript web, E2E et entrée de démonstration, lint racine, format racine et build web normal réussis. L’image Docker de livraison a été construite avec installation figée. Le contexte de construction exclut données locales, secrets, dépendances de l’hôte et grandes preuves.

Le lint racine a aussi révélé les globales navigateur manquantes des deux maquettes Actions : leur environnement navigateur est déclaré explicitement sans désactiver de règle ; une variable inutilisée a été retirée. Le contrôle TypeScript E2E a nécessité un chemin de types vers le package partagé et l’assertion du premier élément de la fixture Référentiels existante. Ces corrections ne modifient pas les interfaces.

Les [résultats synthétiques](captures/timeline-studio/recette.json) ne contiennent aucun jeton, cookie, mot de passe ni donnée réelle. Les rapports bruts restent privés hors Git. Les [captures Actions claires](captures/timeline-studio/actions-clair-hd.png), [sombres](captures/timeline-studio/actions-sombre-hd.png), [Récurrences claires](captures/timeline-studio/recurrences-clair-hd.png) et [sombres](captures/timeline-studio/recurrences-sombre-hd.png) sont natives, larges de 3840 px. La vidéo native fournie séparément montre la pulsation renforcée, les deux thèmes, le dépliage, la pause et la reprise.

## Limites et reprise

Le démarrage complet du nouveau Compose dans le cloud n’est **pas validé** : les créations de conteneurs ont manqué d’espace disque. Le contrôle automatique a refusé le nettoyage manuel du stockage interne Docker, car une erreur pourrait endommager des couches ou données d’autres conteneurs. Ces dossiers n’ont pas été modifiés. Une image Playwright inutilisée et les images/caches de cette recette ont été retirés par les commandes Docker prises en charge ; les volumes et données de l’installation précédente ont été conservés.

L’initialisation complète, le redémarrage sans doublon, les données fictives, l’API et le relais Vite ont été vérifiés avec la même entrée applicative exécutée nativement dans le cloud, sur une base isolée dans PostgreSQL 18 sous Docker. La construction de l’image Docker a réussi séparément. Le demandeur doit encore vérifier le lancement sur son Docker Desktop Windows avec le guide fourni. Les suites API/E2E complètes et la CI distante n’ont pas été relancées.

La PR #226 a été consultée : recouvrement sur `Pilotage.tsx` et quatre anciens scénarios E2E, modifications limitées à cette branche isolée ; aucune intégration de cette PR ni écriture sur sa branche. `apps/api/src` est inchangé. Aucun push, publication, fusion ou déploiement.

Prochaine action : extraire le ZIP puis lancer `docker compose -p neon-interface-test -f docker-compose.ui-test.yml up -d --build`, ouvrir http://localhost:5174 et évaluer l’interface. Les rubriques Organisation non approuvées restent des propositions séparées.
