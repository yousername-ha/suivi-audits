/* Gestion de l'audit de l'outil de suivi (reprise) : lecture partagée de l'état d'audit, pronostic calculé avec les
   fonctions partagées (parité avec l'outil historique) et petits composants communs. */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { analyzeAll, type Analysis, type AuditItem, type AuditPlan } from '@suivi/shared/audit';
import { api, get } from '../api';

export interface ExigenceAudit extends AuditItem {
  prep: string;
  owner: string;
}
export interface EcartAudit {
  id: string;
  source: string;
  year: number;
  type: string;
  status: string;
  text: string;
  action: string;
  items: string[];
}
export interface DonneesAudit {
  version: number;
  years: number[];
  yearLabels: Record<string, string>;
  nextYear: number;
  nextDate: string;
  internalDate: string;
  closeDeadline: string;
  groups: { id: string; ref: string; num: string; title: string }[];
  items: ExigenceAudit[];
  findings: EcartAudit[];
  plan: AuditPlan | null;
}

export const CLE_AUDIT = ['audit-suivi'];

export function useAudit() {
  const q = useQuery({ queryKey: CLE_AUDIT, queryFn: () => get<DonneesAudit>('/api/audit-suivi') });
  const d = q.data;
  const analyses: Record<string, Analysis> = d
    ? analyzeAll({ years: d.years, findings: d.findings, items: d.items }, d.nextYear)
    : {};
  return { q, d, analyses };
}

/** Appelle l'API puis rafraîchit l'état d'audit (et la synthèse). */
export function useActionAudit() {
  const qc = useQueryClient();
  return async (methode: string, url: string, body?: unknown) => {
    const r = await api(methode, `/api/audit-suivi${url}`, body === undefined ? {} : { body });
    await qc.invalidateQueries({ queryKey: CLE_AUDIT });
    await qc.invalidateQueries({ queryKey: ['synthese'] });
    return r;
  };
}

export const libelleAnnee = (d: Pick<DonneesAudit, 'yearLabels'>, y: number) => d.yearLabels[String(y)] ?? '';
export const jourFr = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) ? d.split('-').reverse().join('/') : '');
export const heureFr = (t: string) => (t ? t.replace(/^0(\d)/, '$1').replace(':', 'h') : '');
export const minutes = (t: string) => {
  const [h, m] = String(t || '0:0')
    .split(':')
    .map(Number);
  return (h || 0) * 60 + (m || 0);
};
export const REF_LABELS: Record<string, string> = {
  ISO: 'ISO 27001 (clauses)',
  A: 'ISO 27001 Annexe A',
  HDS: 'HDS v2',
};
