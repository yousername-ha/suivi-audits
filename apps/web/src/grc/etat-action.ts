/* État d'une action tel que l'écran le dit en toutes lettres : jamais par la couleur seule. Le retard est dérivé de
   l'échéance, du statut terminal de la politique publiée et de la validation d'une occurrence récurrente (une occurrence
   validée n'est pas en retard) ; il ne change jamais le statut. Même règle que les compteurs du serveur. */
import type { BusinessPolicy, GrcObject } from '@suivi/shared';

const SYMBOLES: Record<string, string> = { todo: '○', progress: '▶', blocked: '⏸', done: '✓', cancelled: '✕' };

/** Symbole du statut : les cinq statuts par défaut ont le leur ; un statut personnalisé reçoit ✓ s'il est terminal, ● sinon. */
export function symboleStatut(policy: BusinessPolicy, statusId: unknown): string {
  const id = String(statusId);
  if (SYMBOLES[id]) return SYMBOLES[id]!;
  return policy.statuses.find((s) => s.id === id)?.terminal ? '✓' : '●';
}

export function libelleStatut(policy: BusinessPolicy, o: GrcObject): string {
  return (
    policy.statuses.find((s) => s.id === o.data.status)?.label ??
    (o.data.status === 'done' ? 'Terminée (historique)' : 'À faire (historique)')
  );
}

/** Vrai si l'action est ouverte, a une échéance dépassée et n'est pas une occurrence déjà validée. */
export function enRetard(o: GrcObject, policy: BusinessPolicy, maintenant = Date.now()): boolean {
  const echeance = typeof o.data.dueAt === 'string' ? Date.parse(o.data.dueAt) : Number.NaN;
  if (!Number.isFinite(echeance) || echeance >= maintenant) return false;
  if (policy.statuses.find((s) => s.id === o.data.status)?.terminal) return false;
  if (o.data.legacy && o.data.status === 'done') return false;
  const validation = (o as GrcObject & { validation?: { result?: string } | null }).validation;
  return !validation;
}

const RESULTATS: Record<string, string> = { ok: 'OK', ko: 'KO', na: 'NA' };
/** Résultat de la dernière validation d'une occurrence récurrente (OK, KO ou NA), ou null : la carte dit ce que le
    statut d'action ne dit pas. */
export function validationDe(o: GrcObject): string | null {
  const validation = (o as GrcObject & { validation?: { result?: string } | null }).validation;
  const r = validation?.result;
  return r ? (RESULTATS[r.toLowerCase()] ?? r.toUpperCase()) : null;
}
