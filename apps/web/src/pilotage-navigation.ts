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
      { id: 'parties', label: 'Parties intéressées', module: 'pilotage' },
      { id: 'swot', label: 'SWOT par processus', module: 'pilotage' },
      { id: 'pestel', label: 'PESTEL des enjeux externes', module: 'pilotage' },
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
      { id: 'applicabilite', label: 'Applicabilité et justifications', module: 'pilotage' },
      { id: 'mesures', label: 'Mesures', module: 'audit' },
      { id: 'correspondances', label: 'Correspondances entre exigences', module: 'conformite' },
      { id: 'rapprochements', label: 'Rapprochements à valider', module: 'conformite' },
      { id: 'couverture', label: 'Couverture par référentiel', module: 'conformite' },
      { id: 'correspondances-bibliotheque', label: 'Correspondances de la bibliothèque', module: 'conformite' },
    ],
  },
  {
    label: 'Fournisseurs',
    items: [
      { id: 'fournisseurs', label: 'Fournisseurs de l’organisation', module: 'fournisseurs' },
      { id: 'criteres-fournisseurs', label: 'Critères d’évaluation des fournisseurs', module: 'fournisseurs' },
      { id: 'fournisseurs-perimetre', label: 'Fournisseurs du périmètre', module: 'fournisseurs' },
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

/** Pages encore servies par l'outil historique (/legacy), ouvertes directement depuis le menu (lot U1).
    vue : sous-vue historique (« confView=A »…), appliquée par legacy-shim/shim.js avant le chargement de l'outil. */
export interface PageHistorique {
  label: string;
  module: Module;
  onglet: string;
  vue?: string;
}
export const PAGES_HISTORIQUES: { label: string; items: PageHistorique[] }[] = [
  {
    label: 'Conformité',
    items: [
      { label: 'Clauses ISO 27001', module: 'audit', onglet: 'conformite', vue: 'confView=ISO' },
      { label: 'Annexe A (DdA)', module: 'audit', onglet: 'conformite', vue: 'confView=A' },
      { label: 'HDS (DdA)', module: 'audit', onglet: 'conformite', vue: 'confView=HDS' },
      { label: 'ReCyF et autres référentiels', module: 'conformite', onglet: 'conformite', vue: 'confView=fw' },
    ],
  },
  {
    label: 'Fournisseurs',
    items: [
      { label: 'Fournisseurs et applications', module: 'fournisseurs', onglet: 'fournisseurs', vue: 'supView=list' },
      { label: 'Revues des accès', module: 'pilotage', onglet: 'fournisseurs', vue: 'supView=ar' },
      { label: 'Évaluations sécurité', module: 'fournisseurs', onglet: 'supeval' },
    ],
  },
  {
    label: 'GAP et IA',
    items: [
      { label: 'Applications à intégrer', module: 'conformite', onglet: 'gapapp' },
      { label: 'Usages de l’IA', module: 'ia', onglet: 'ia', vue: 'iaView=reg' },
    ],
  },
  {
    label: 'Autres modules',
    items: [
      { label: 'Gestion CRRC', module: 'crrc', onglet: 'crrc', vue: 'crrcView=over' },
      { label: 'Investissements', module: 'investissements', onglet: 'invest', vue: 'invView=dash' },
      { label: 'Incidents', module: 'incidents', onglet: 'incidents', vue: 'incView=reg' },
      { label: 'Cellule de crise', module: 'incidents', onglet: 'crise', vue: 'crView=cell' },
      { label: 'Rapports et exports', module: 'import_export', onglet: 'rapports', vue: 'repView=exp' },
    ],
  },
];

/** Lien d'ouverture directe d'une page de l'outil historique. */
export const lienHistorique = (p: Pick<PageHistorique, 'onglet' | 'vue'>) =>
  `/legacy/#ouvrir=${p.onglet}${p.vue ? '&' + p.vue : ''}`;
