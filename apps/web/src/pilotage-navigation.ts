import type { Module } from '@suivi/shared';
export const PILOTAGE_NAV = [
  {
    label: 'Vue d’ensemble',
    items: [
      { id: 'synthese', label: 'Synthèse', module: 'pilotage' },
      { id: 'parcours', label: 'Parcours guidé', module: 'pilotage' },
    ],
  },
  {
    label: 'Contexte et responsabilités',
    items: [
      { id: 'contexte', label: 'Périmètre et contexte', module: 'pilotage' },
      { id: 'parties', label: 'Parties intéressées', module: 'pilotage' },
      { id: 'swot', label: 'SWOT par processus', module: 'pilotage' },
      { id: 'responsabilites', label: 'Rôles et responsabilités', module: 'pilotage' },
    ],
  },
  {
    label: 'Objectifs et indicateurs',
    items: [
      { id: 'processus', label: 'Processus', module: 'pilotage' },
      { id: 'objectifs', label: 'Objectifs', module: 'pilotage' },
      { id: 'indicateurs', label: 'Indicateurs', module: 'pilotage' },
    ],
  },
  {
    label: 'Conformité',
    items: [
      { id: 'referentiels', label: 'Référentiels et exigences', module: 'conformite' },
      { id: 'applicabilite', label: 'Applicabilité et justifications', module: 'pilotage' },
      { id: 'mesures', label: 'Mesures', module: 'audit' },
      { id: 'correspondances', label: 'Correspondances entre exigences', module: 'conformite' },
    ],
  },
  {
    label: 'Risques',
    items: [
      { id: 'risques', label: 'Registre des risques', module: 'pilotage' },
      { id: 'carte', label: 'Cartographie des risques', module: 'cartographie' },
      { id: 'traitements', label: 'Traitements', module: 'pilotage' },
      { id: 'scenarios', label: 'Scénarios et actifs', module: 'pilotage' },
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
      { id: 'audits', label: 'Audits internes', module: 'plan_audit' },
      { id: 'revues', label: 'Revues de direction', module: 'pilotage' },
    ],
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
