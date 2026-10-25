# ADR 0046 — Retrait du catalogue « Environnement » et des évaluations IA versionnées

- Statut : acceptée
- Date : 2026-10-25
- Retire : [ADR 0021](0021-echelles-et-matrices-organisationnelles-immuables.md) et [ADR 0022](0022-evaluations-ia-versionnees.md). S'appuie sur l'[ADR 0038](0038-socle-de-configuration-grc-transversal.md).

## Contexte

Deux catalogues d'échelles et de matrices coexistaient sans lien : « Environnement » (`environment_versions`, ADR 0021), qui ne servait qu'aux évaluations versionnées des scénarios IA (`risk_assessments`, ADR 0022), et la Configuration GRC (`cfg_items`, ADR 0038), utilisée par les études, les méthodes et les registres. L'audit ASTRA (012-06) y voyait le « catalogue concurrent » à éviter. Le 25/10/2026, l'utilisateur a décidé de ne garder que la Configuration GRC et d'effacer les anciennes évaluations pour repartir au propre.

## Décision

1. Suppression des tables `risk_assessments`, `environment_configuration` et `environment_versions` par la migration `037_retrait_environnement.sql` (après la sauvegarde automatique de la mise à jour), des routes `/api/admin/environment*` et `/api/ia/evaluations*` (lecture, simulation, décisions, export), des écrans « Environnement » et « Évaluations IA », de leur aide, de leurs événements temps réel et de leurs tests.
2. **Ne sont pas touchés** : la Configuration GRC, le registre IA et les évaluations de l'outil de suivi (conformité IA : usages, scénarios, plan, politiques, `PATCH /api/ia/evaluations/:id`), le journal d'audit et les décisions immuables des autres modules.
3. L'analyse d'écart d'un service, d'une application interne ou d'un usage de l'IA se fait dans « Applications à intégrer » : liste de contrôle rattachée à l'ISO/IEC 27001 et à l'HDS, plan d'action des écarts, et, quand le service embarque de l'IA, des points de maîtrise propres à l'organisation (données saisies, contrat, journalisation, exigences légales, hébergement HDS). Le service analysé peut aussi être un périmètre enfant évalué exigence par exigence (ADR 0041).

## Conséquences

- Donnée détruite : les versions de configuration d'environnement et les décisions IA versionnées. Aucun retour arrière automatique en dehors de la restauration de la sauvegarde faite avant la mise à jour.
- Plus de calcul pondéré versionné pour les scénarios IA : il sera refait, si besoin, comme méthode de la Configuration GRC.
- L'étape d'intégrité de la mise à jour réelle en CI (`scripts/ci/update-integree.py`) ne compare plus ces tables.
