/* Modules de l'outil legacy (clés de premier niveau) : libellé, phase de reprise prévue (docs/ROADMAP.md). */

export interface LegacyModule {
  key: string;
  label: string;
  /** Phase de la refonte qui reprendra ce module dans des tables dédiées (0 : métadonnées techniques). */
  phase: 0 | 1 | 2 | 3 | 4;
}

export const LEGACY_MODULES: readonly LegacyModule[] = [
  { key: 'v', label: 'Version du format', phase: 0 },
  { key: 'updatedAt', label: 'Date de dernière modification', phase: 0 },
  { key: 'schema', label: 'Version du schéma', phase: 0 },
  { key: 'years', label: 'Années du cycle de certification', phase: 1 },
  { key: 'yearLabels', label: 'Libellés des années', phase: 1 },
  { key: 'nextYear', label: 'Année du prochain audit', phase: 1 },
  { key: 'nextDate', label: 'Date du prochain audit', phase: 1 },
  { key: 'internalDate', label: "Date de l'audit interne", phase: 1 },
  { key: 'iso27001Certified', label: 'Certification ISO 27001', phase: 1 },
  { key: 'groups', label: 'Chapitres des référentiels', phase: 1 },
  { key: 'items', label: 'Mesures ISO 27001, Annexe A et HDS (couverture AFNOR et interne)', phase: 1 },
  { key: 'hdsChap', label: 'Chapitres HDS', phase: 1 },
  { key: 'findings', label: 'Écarts et actions', phase: 1 },
  { key: 'source', label: 'Source des écarts', phase: 1 },
  { key: 'closeDeadline', label: 'Échéance de clôture des écarts', phase: 1 },
  { key: 'findingsRev', label: 'Révision des écarts', phase: 1 },
  { key: 'plan', label: "Plan d'audit", phase: 1 },
  { key: 'processes', label: 'Processus', phase: 2 },
  { key: 'objectives', label: 'Objectifs', phase: 2 },
  { key: 'indicators', label: 'Indicateurs', phase: 2 },
  { key: 'dda', label: "Déclaration d'applicabilité (DdA)", phase: 2 },
  { key: 'suppliers', label: 'Fournisseurs', phase: 2 },
  { key: 'supEvals', label: 'Évaluations des fournisseurs', phase: 2 },
  { key: 'accessReviews', label: "Revues d'accès", phase: 2 },
  { key: 'reviews', label: 'Revues de direction et COPIL', phase: 2 },
  { key: 'scope', label: 'Périmètre du SMSI', phase: 2 },
  { key: 'interested', label: 'Parties intéressées', phase: 2 },
  { key: 'swots', label: 'Analyses SWOT', phase: 2 },
  { key: 'roles', label: 'Rôles et responsabilités', phase: 2 },
  { key: 'plans', label: "Plans d'action", phase: 2 },
  { key: 'recurring', label: 'Tâches récurrentes', phase: 2 },
  { key: 'evidences', label: 'Preuves', phase: 2 },
  { key: 'frameworks', label: 'Référentiels complémentaires (ReCyF)', phase: 3 },
  { key: 'activeFw', label: 'Référentiel complémentaire actif', phase: 3 },
  { key: 'entityCategory', label: "Catégorie d'entité (NIS 2)", phase: 3 },
  { key: 'appGaps', label: 'Analyses d’écart applicatives (GAP)', phase: 3 },
  { key: 'ai', label: 'Intelligence artificielle', phase: 3 },
  { key: 'crrc', label: 'CRRC (sauvegarde, restauration, reprise)', phase: 3 },
  { key: 'invest', label: 'Investissements', phase: 3 },
  { key: 'incidents', label: 'Incidents', phase: 3 },
  { key: 'crisis', label: 'Gestion de crise', phase: 3 },
  { key: 'branding', label: 'Personnalisation', phase: 4 },
];

const BY_KEY = new Map(LEGACY_MODULES.map((m) => [m.key, m]));
export const moduleLabel = (key: string): string => BY_KEY.get(key)?.label ?? key;
export const modulePhase = (key: string): LegacyModule['phase'] | null => BY_KEY.get(key)?.phase ?? null;
/** Modules techniques : jamais proposés pour « Remplacer un module ». */
export const TECHNICAL_KEYS: ReadonlySet<string> = new Set(['v', 'updatedAt', 'schema']);
