import type { Module } from '@suivi/shared';
export const PILOTAGE_NAV = [
  {
    label: 'Vue d’ensemble',
    items: [
      { id: 'synthese', label: 'Synthèse', module: 'pilotage' },
      { id: 'parcours', label: 'Parcours guidé', module: 'pilotage' },
      { id: 'perimetres', label: 'Périmètres', module: 'pilotage' },
    ],
  },
  {
    label: 'Contexte et responsabilités',
    items: [
      { id: 'contexte', label: 'Périmètre et contexte', module: 'pilotage' },
      { id: 'processus-cartes', label: 'Processus', module: 'pilotage' },
      { id: 'parties', label: 'Parties intéressées', module: 'pilotage' },
      { id: 'swot', label: 'SWOT par processus', module: 'pilotage' },
      { id: 'pestel', label: 'PESTEL des enjeux externes', module: 'pilotage' },
      { id: 'responsabilites', label: 'Rôles et responsabilités', module: 'pilotage' },
    ],
  },
  {
    label: 'Objectifs et indicateurs',
    items: [
      { id: 'processus', label: 'Objectifs par processus', module: 'pilotage' },
      { id: 'objectifs', label: 'Objectifs', module: 'pilotage' },
      { id: 'indicateurs', label: 'Indicateurs', module: 'pilotage' },
    ],
  },
  {
    label: 'Gestion de l’audit',
    items: [
      { id: 'audit-pronostic', label: 'Carte du prochain audit', module: 'audit' },
      { id: 'audit-couverture', label: 'Couverture du cycle', module: 'audit' },
      { id: 'audit-deroule', label: 'Organisation : déroulé', module: 'plan_audit' },
      { id: 'audit-planning', label: 'Organisation : planning', module: 'plan_audit' },
      { id: 'audit-participants', label: 'Organisation : participants', module: 'plan_audit' },
    ],
  },
  {
    label: 'Conformité',
    items: [
      { id: 'referentiels', label: 'Référentiels et exigences', module: 'conformite' },
      { id: 'bibliotheque', label: 'Bibliothèque de référentiels', module: 'conformite' },
      { id: 'dda-iso', label: 'Clauses ISO 27001 (DdA)', module: 'audit' },
      { id: 'dda-annexe-a', label: 'Annexe A (DdA)', module: 'audit' },
      { id: 'dda-hds', label: 'HDS (DdA)', module: 'audit' },
      { id: 'applicabilite', label: 'Applicabilité et justifications', module: 'pilotage' },
      { id: 'mesures', label: 'Mesures', module: 'audit' },
      { id: 'correspondances', label: 'Correspondances entre exigences', module: 'conformite' },
      { id: 'rapprochements', label: 'Rapprochements à valider', module: 'conformite' },
      { id: 'couverture', label: 'Couverture par référentiel', module: 'conformite' },
      { id: 'gap-applications', label: 'Applications à intégrer', module: 'conformite' },
      { id: 'conformite-ia', label: 'Conformité IA', module: 'ia' },
      { id: 'correspondances-bibliotheque', label: 'Correspondances de la bibliothèque', module: 'conformite' },
    ],
  },
  {
    label: 'Fournisseurs',
    items: [
      { id: 'fournisseurs', label: 'Fournisseurs de l’organisation', module: 'fournisseurs' },
      { id: 'criteres-fournisseurs', label: 'Critères d’évaluation des fournisseurs', module: 'fournisseurs' },
      { id: 'fournisseurs-perimetre', label: 'Fournisseurs du périmètre', module: 'fournisseurs' },
      { id: 'evaluations-clausier', label: 'Évaluations par le clausier (Club RSSI Santé)', module: 'fournisseurs' },
      { id: 'revues-acces', label: 'Revues des accès', module: 'pilotage' },
    ],
  },
  {
    label: 'Risques',
    items: [
      { id: 'risques', label: 'Registre des risques', module: 'pilotage' },
      { id: 'opportunites', label: 'Opportunités', module: 'pilotage' },
      { id: 'etudes', label: 'Études EBIOS RM', module: 'pilotage' },
      { id: 'carte', label: 'Cartographie des risques', module: 'cartographie' },
      { id: 'traitements', label: 'Traitements', module: 'pilotage' },
      { id: 'scenarios', label: 'Scénarios et actifs', module: 'pilotage' },
      { id: 'configuration-analyses', label: 'Configuration des analyses', module: 'pilotage' },
    ],
  },
  {
    label: 'Écarts et actions',
    items: [
      { id: 'amelioration', label: 'Amélioration continue', module: 'ecarts' },
      { id: 'actions', label: 'Plan d’actions', module: 'ecarts' },
      { id: 'recurrences', label: 'Tâches récurrentes', module: 'ecarts' },
    ],
  },
  {
    label: 'Preuves et contrôles',
    items: [
      { id: 'preuves', label: 'Registre des preuves', module: 'documents' },
      { id: 'controles', label: 'Plan de contrôle', module: 'pilotage' },
    ],
  },
  {
    label: 'Plans et revues',
    items: [
      { id: 'bia', label: 'Impacts sur l’activité — BIA', module: 'pilotage' },
      { id: 'continuite', label: 'Continuité et reprise', module: 'pilotage' },
      { id: 'exercices', label: 'Exercices et RETEX', module: 'pilotage' },
      { id: 'plans-calendrier', label: 'Calendrier des plans', module: 'pilotage' },
      { id: 'plans-planning', label: 'Planning annuel des plans', module: 'pilotage' },
      { id: 'plans-formation', label: 'Plan de formation', module: 'pilotage' },
      { id: 'plans-sensibilisation', label: 'Plan de sensibilisation', module: 'pilotage' },
      { id: 'audits', label: 'Audits internes', module: 'plan_audit' },
      { id: 'revues', label: 'Revues de direction', module: 'pilotage' },
    ],
  },
  {
    label: 'Incidents et crise',
    items: [
      { id: 'incidents-registre', label: 'Registre des incidents', module: 'incidents' },
      { id: 'incidents-qualifier', label: 'Qualifier un signalement', module: 'incidents' },
      { id: 'crise-cellule', label: 'Cellule de crise', module: 'incidents' },
      { id: 'crise-contacts', label: 'Contacts de crise', module: 'incidents' },
      { id: 'crise-scenarios', label: 'Scénarios et check-lists', module: 'incidents' },
    ],
  },
  {
    label: 'Gestion CRRC',
    items: [
      { id: 'crrc-ensemble', label: 'Vue d’ensemble CRRC', module: 'crrc' },
      { id: 'crrc-etablissements', label: 'Établissements et contrats', module: 'crrc' },
      { id: 'crrc-offres', label: 'Catalogue des offres', module: 'crrc' },
      { id: 'crrc-tableau', label: 'Tableau de bord des sauvegardes', module: 'crrc' },
      { id: 'crrc-ressources', label: 'Sauvegardes par ressource', module: 'crrc' },
      { id: 'crrc-restaurations', label: 'Restaurations', module: 'crrc' },
      { id: 'crrc-alertes', label: 'Alertes de sauvegarde', module: 'crrc' },
      { id: 'crrc-rapports', label: 'Rapports mensuels', module: 'crrc' },
    ],
  },
  {
    label: 'Budget',
    items: [{ id: 'investissements', label: 'Plan d’investissement', module: 'investissements' }],
  },
  {
    label: 'Outils',
    items: [
      { id: 'rappels', label: 'Mes rappels', module: 'pilotage' },
      { id: 'imports', label: 'Import et rapports', module: 'import_export' },
      { id: 'configuration', label: 'Configuration du pilotage', module: 'pilotage' },
    ],
  },
] satisfies { label: string; items: { id: string; label: string; module: Module }[] }[];
export const PILOTAGE_LABELS: Record<string, string> = Object.fromEntries(
  PILOTAGE_NAV.flatMap((g) => g.items.map((i) => [i.id, i.label])),
);
