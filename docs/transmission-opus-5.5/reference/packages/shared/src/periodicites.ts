/* Périodicités usuelles d'une série de tâches (dossier 018) : sept préréglages qui s'écrivent avec l'unité et l'intervalle
   du moteur de récurrence, plus une périodicité personnalisée. « Bimensuel » est ambigu en français (deux fois par mois
   ou tous les deux mois) : le préréglage s'appelle explicitement « Tous les deux mois ». Une cadence de deux fois par
   mois ne s'exprime pas avec une seule date par intervalle : elle se crée avec deux séries. */
import { recurrenceSlot } from './recurrence.js';
import type { Recurrence } from './grc.js';

export interface Periodicite {
  id: string;
  label: string;
  unit: Recurrence['unit'];
  interval: number;
}
export const PERIODICITES: readonly Periodicite[] = [
  { id: 'journalier', label: 'Journalier', unit: 'day', interval: 1 },
  { id: 'hebdomadaire', label: 'Hebdomadaire', unit: 'week', interval: 1 },
  { id: 'mensuel', label: 'Mensuel', unit: 'month', interval: 1 },
  { id: 'tous-les-deux-mois', label: 'Tous les deux mois', unit: 'month', interval: 2 },
  { id: 'trimestriel', label: 'Trimestriel', unit: 'month', interval: 3 },
  { id: 'semestriel', label: 'Semestriel', unit: 'month', interval: 6 },
  { id: 'annuel', label: 'Annuel', unit: 'year', interval: 1 },
];
export const PERIODICITE_PERSONNALISEE = 'personnalisee';
export const UNITES_LABELS: Record<Recurrence['unit'], string> = {
  day: 'jour(s)',
  week: 'semaine(s)',
  month: 'mois',
  year: 'an(s)',
};

/** Préréglage qui correspond à l'unité et à l'intervalle, sinon « personnalisée ». */
export function periodiciteDe(r: Pick<Recurrence, 'unit' | 'interval'>): string {
  return PERIODICITES.find((p) => p.unit === r.unit && p.interval === r.interval)?.id ?? PERIODICITE_PERSONNALISEE;
}
/** Applique un préréglage (ou garde l'unité et l'intervalle courants pour « personnalisée »). */
export function appliquerPeriodicite<T extends Pick<Recurrence, 'unit' | 'interval'>>(r: T, id: string): T {
  const p = PERIODICITES.find((x) => x.id === id);
  return p ? { ...r, unit: p.unit, interval: p.interval } : r;
}
export interface OccurrenceApercu {
  /** Jour local de l'échéance (après report des jours exclus), instant de l'échéance et indication de report. */
  local: string;
  dueAt: string;
  decalee: boolean;
}
/** Prochaines échéances de la série, calculées par le moteur lui-même (fins de mois, fuseau, jours exclus). Une
    configuration invalide ne produit aucun aperçu plutôt qu'une erreur. */
export function apercuOccurrences(r: Recurrence, n = 5): OccurrenceApercu[] {
  const out: OccurrenceApercu[] = [];
  try {
    for (let i = 0; i < 1000 && out.length < n; i++) {
      const s = recurrenceSlot(r, i);
      if (!s) break;
      out.push({ local: s.local, dueAt: s.dueAt, decalee: s.decalee });
    }
  } catch {
    return [];
  }
  return out;
}
