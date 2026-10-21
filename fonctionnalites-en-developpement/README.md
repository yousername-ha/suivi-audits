# Fonctionnalités en développement

Étape 1 du cycle de la branche `legacy`. Les dossiers contiennent des maquettes et des préparations techniques ; leur présence ne prouve pas une intégration métier ni une validation utilisateur.

Commencer par l’[audit Codex / Claude du 18 octobre 2026](AUDIT-CONVERGENCE.md), puis le [prompt technique courant](_dossiers-transversaux/socle-astra/PROMPT-IMPLEMENTATION.md). Le socle Claude se consulte exclusivement en lecture seule. Les anciens documents Python/SQLite décrivent la cible historique ; ils ne doivent pas conduire à reconstruire les fonctions du socle React/Fastify.

## Catalogue et parcours

La [liste numérotée des fonctionnalités](../LISTE-FONCTIONNALITES.md), générée depuis le [catalogue JSON](../docs/catalogue-fonctionnalites.json), est la liste maintenue. Les versions et statuts ne sont plus recopiés dans ce README.

- [Tester le prototype transversal](_prototype-transversal/README.md) : navigation et parcours EBIOS.
- [010 — Périmètres](../fonctionnalites-a-implementer/010-perimetres/README.md) : graphique et liste d’un même registre ; héritage, conformité et fournisseurs rattachés.
- [012 — Apparence](../fonctionnalites-a-implementer/012-administration-apparence/implementation/README.md) : réutiliser le réglage global existant.
- [017 — Plans d’action](../fonctionnalites-a-implementer/017-plans-action/README.md) et [021 — Registres d’écarts](../fonctionnalites-a-implementer/021-registres-ecarts/README.md) : proposition commune ; lire les incompatibilités métier avant codage.
- [019 — Configuration GRC](../fonctionnalites-a-implementer/019-configuration-grc/README.md) : analyse ARM et propositions à confronter aux contrats réels.
- [020 — Navigation](../fonctionnalites-a-implementer/020-navigation/README.md) : style conservé, ordonnancement à valider.
- [Téléchargements Windows](../downloads/README.md) : maquettes publiées, sans valeur de validation métier.

## Cycle de validation

[En développement](README.md) → [À implémenter](../fonctionnalites-a-implementer/README.md) → [Implémentées](../fonctionnalites-implementees/README.md).

Conserver les numéros, les versions utiles et les fichiers non commitées. Une validation technique de maquette ne remplace ni l’accord utilisateur ni une preuve d’intégration. Les [règles d’organisation](../docs/ORGANISATION-LEGACY.md) restent applicables ; les instructions directes de l’utilisateur priment. Appliquer le cycle courant : dossier prêt et validé vers « à implémenter », puis lecture du marqueur « implémentation ok » avant classement dans « implémentées ». Aucun marqueur local trouvé le 19 octobre 2026.
