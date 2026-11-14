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

/** Occurrence d'une série (seule à porter un résultat OK, KO ou NA dans la version actuelle de l'API). */
export function estOccurrence(o: GrcObject): boolean {
  return (
    (typeof o.data.seriesId === 'string' && o.data.seriesId !== '') ||
    (typeof o.data.occurrenceKey === 'string' && o.data.occurrenceKey !== '')
  );
}

/** Fiche de la Timeline des récurrences : occurrence d'une série, ou tâche récurrente historique (source conservée). */
export function estRecurrente(o: GrcObject): boolean {
  return estOccurrence(o) || o.data.legacyRecurring === true;
}

/* Teintes de la refonte Neon (lot 6) : une teinte par sens, toujours doublée d'un texte (statut, résultat, retard).
   Le retard n'est jamais une teinte : il a son propre repère (contour et mention « En retard »). */
export type TonTache = 'amber' | 'blue' | 'teal' | 'red' | 'muted';

/** Teinte d'un statut : orange pour « à faire » (premier état ouvert de la politique, ou état historique non terminé),
    rouge pour bloqué, gris pour annulé, vert pour un état terminal, bleu pour les autres états ouverts. */
export function tonStatut(policy: BusinessPolicy, statusId: unknown): TonTache {
  const id = String(statusId);
  if (id === 'blocked') return 'red';
  if (id === 'cancelled') return 'muted';
  const statut = policy.statuses.find((s) => s.id === id);
  if (!statut) return id === 'done' ? 'teal' : 'amber';
  if (statut.terminal) return 'teal';
  return id === 'todo' || statut.id === policy.statuses[0]?.id ? 'amber' : 'blue';
}

/** Teinte d'une fiche : le résultat d'une occurrence validée prime (OK vert, KO rouge, NA gris), sinon son statut. */
export function tonTache(o: GrcObject, policy: BusinessPolicy): TonTache {
  const v = validationDe(o);
  if (v) return v === 'OK' ? 'teal' : v === 'KO' ? 'red' : 'muted';
  return tonStatut(policy, o.data.status);
}

/** Classe du repère d'une occurrence : en attente tant qu'aucun résultat n'est enregistré. */
export function classeResultat(o: GrcObject): 'attente' | 'ok' | 'ko' | 'na' {
  const v = validationDe(o);
  return v === 'OK' ? 'ok' : v === 'KO' ? 'ko' : v === 'NA' ? 'na' : 'attente';
}

/** Commande d'un repère : résultat d'une occurrence, réalisation d'une tâche historique (dans sa source, par sa fiche)
    ou suivi d'une action (commentaires et preuves ; pas de résultat OK/KO hors série dans l'API actuelle). */
export function commandeRepere(o: GrcObject): string {
  if (o.id.startsWith('legacy:')) return 'Réaliser la tâche historique';
  return estOccurrence(o) ? 'Saisir le résultat' : 'Suivi de réalisation';
}

/** Ce que dit un repère de la Timeline, sans l'intitulé (porté par la ligne) : état, résultat, retard et période. */
export function descriptionRepere(
  o: GrcObject,
  policy: BusinessPolicy,
  maintenant: number,
  date: (iso: string) => string,
): string {
  const v = validationDe(o);
  const debut = typeof o.data.startAt === 'string' && o.data.startAt ? `du ${date(o.data.startAt)}` : '';
  const echeance = typeof o.data.dueAt === 'string' && o.data.dueAt ? `échéance le ${date(o.data.dueAt)}` : '';
  return [
    libelleStatut(policy, o).toLowerCase(),
    estOccurrence(o) ? (v ? `validée (${v})` : 'résultat en attente') : '',
    enRetard(o, policy, maintenant) ? 'en retard' : '',
    debut,
    echeance,
  ]
    .filter(Boolean)
    .join(', ');
}
