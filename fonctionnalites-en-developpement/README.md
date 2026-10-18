# Fonctionnalités en développement

Étape 1 du cycle de la branche `legacy`. Les dossiers contiennent des maquettes et des préparations techniques ; leur présence ne prouve pas une intégration métier ni une validation utilisateur.

Commencer par l’[audit Codex / Claude du 18 octobre 2026](AUDIT-CONVERGENCE.md), puis le [prompt technique courant](_dossiers-transversaux/socle-astra/PROMPT-IMPLEMENTATION.md). Le socle Claude se consulte exclusivement en lecture seule. Les anciens documents Python/SQLite décrivent la cible historique ; ils ne doivent pas conduire à reconstruire les fonctions du socle React/Fastify.

## Catalogue et parcours

La [liste numérotée des fonctionnalités](../LISTE-FONCTIONNALITES.md), générée depuis le [catalogue JSON](../docs/catalogue-fonctionnalites.json), est la liste maintenue. Les versions et statuts ne sont plus recopiés dans ce README.

- [Tester le prototype transversal](_prototype-transversal/README.md) : navigation et parcours EBIOS.
- [010 — Périmètres](010-perimetres/README.md) : proposition visuelle ; héritage GHT non disponible dans le contrat Claude audité.
- [012 — Apparence](012-administration-apparence/implementation/README.md) : réutiliser le réglage global existant.
- [017 — Plans d’action](017-plans-action/README.md) et [021 — Registres d’écarts](021-registres-ecarts/README.md) : proposition commune ; lire les incompatibilités métier avant codage.
- [019 — Configuration GRC](019-configuration-grc/README.md) : analyse ARM et propositions à confronter aux contrats réels.
- [020 — Navigation](020-navigation/README.md) : style conservé, ordonnancement à valider.
- [Téléchargements Windows](../downloads/README.md) : maquettes publiées, sans valeur de validation métier.

## Cycle de validation

[En développement](README.md) → [À implémenter](../fonctionnalites-a-implementer/README.md) → [Implémentées](../fonctionnalites-implementees/README.md).

Conserver les numéros, les versions utiles et les fichiers non commitées. Une validation technique de maquette ne remplace ni l’accord utilisateur ni une preuve d’intégration. Les [règles d’organisation](../docs/ORGANISATION-LEGACY.md) restent applicables ; les instructions directes de l’utilisateur priment. Aucun dossier n’est déplacé par l’audit.
