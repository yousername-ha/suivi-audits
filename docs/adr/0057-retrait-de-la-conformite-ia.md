# ADR 0057 — Retrait de la page « Conformité IA » et de ses données

- Statut : acceptée
- Date : 2026-10-26
- Contexte : le kit d'intégration IA ([ADR 0055](0055-kit-integration-ia.md)) fournit un référentiel de contrôles IA évalué exigence par exigence, et l'assistant « Analyser un service » ([ADR 0056](0056-analyser-un-service-et-plan-des-ecarts.md)) mène du service au plan d'action. La page « Conformité IA » reprise de l'outil de suivi (registre des usages, scénarios évalués, plan, politiques) fait double emploi. L'utilisateur a décidé le 26/10/2026 de **supprimer la page et ses données dans la prochaine livraison**, après la sauvegarde automatique de la mise à jour.

## Décision

- **La page, son menu et ses routes disparaissent** : rubrique « Intelligence artificielle » du menu Conformité et audits, page `/pilotage/conformite-ia`, routes `/api/ia*`, service `ConformiteIa`, module partagé `suivi-ia`, rubriques d'export « GAP — Intelligence artificielle ».
- **Les données sont supprimées définitivement** par la migration `043_retrait_conformite_ia.sql` : lignes des tables `suivi_ia_usages`, `suivi_ia_evaluations`, `suivi_ia_etapes`, `suivi_ia_politiques` et champs complémentaires de la clé `ai` (contexte, date de début). La sauvegarde automatique de `scripts/mettre-a-jour.sh` précède la migration ; c'est le seul retour arrière. Les tables restent, **vides**, car la forme de l'état historique (import et export au format v2) les décrit encore ; l'import d'un fichier v2 qui contient une clé `ai` reste accepté.
- **Le module de droits « ia » est retiré** : ses permissions sortent des rôles personnalisés, sa restriction des attributions directes et son activation du réglage des modules (contrainte de liste recréée). La clé historique `ai` est désormais portée par le module Conformité.
- **Le questionnaire « Applications à intégrer » ne pose plus aucun point IA** : les trois questions (IA embarquée, données saisies, réutilisation par le fournisseur), les points de maîtrise qui en découlaient et l'inscription automatique d'un usage au registre IA sont retirés. L'analyse de l'IA se fait par le kit et l'assistant.
- **Le renvoi** de la page vers le référentiel (ADR 0055) n'a plus d'objet et disparaît avec elle.

## Ce qui n'est pas fait

- Les tables `suivi_ia_*` ne sont pas supprimées (compatibilité du format historique) : elles pourront l'être avec le format v2 lui-même.
- Aucune reprise des usages saisis vers le kit : ils étaient propres à l'organisation et leur suppression a été demandée telle quelle. Avant la mise à jour, exporter le registre IA depuis l'ancienne page (export Excel) si l'on veut en garder une trace.

## Conséquences

Migration destructive mais bornée (quatre tables de l'outil de suivi, un champ de présence). Aucun effet sur le journal d'audit, le kit IA importé, les couvertures ou les actions.
