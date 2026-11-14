/* Frise des actions : une barre par action, du début à l'échéance, sur une période qui défile (le Gantt mensuel ne
   montre qu'un mois). Calcul pur de la période et du placement ; le rendu est celui de la Timeline Studio
   (TimelineStudio.tsx, refonte Neon, lot 6). Les actions sans aucune date sont listées à part ; rien n'est inventé pour
   les placer. */
import type { GrcObject, TaskData } from '@suivi/shared';

const JOUR = 86_400_000;

export interface Frise {
  /** Premier jour affiché (minuit UTC) et nombre de jours. */
  debut: number;
  jours: number;
  /** Actions placées (au moins une date) et actions sans date. */
  placees: { objet: GrcObject; de: number; a: number }[];
  sansDate: GrcObject[];
  /** Actions dont les dates ne se placent pas, avec la raison : jamais corrigées ni inversées en silence. */
  incoherentes: { objet: GrcObject; raison: RaisonDate }[];
  /** Vrai quand la période a été bornée à deux ans : des actions peuvent alors tomber hors de la période affichée. */
  tronquee: boolean;
  /** Actions placées dont la barre est entièrement hors de la période affichée (non dessinées). */
  horsPeriode: GrcObject[];
}
export type RaisonDate = 'debut-apres-echeance' | 'date-illisible';
export const RAISON_DATE_LABELS: Record<RaisonDate, string> = {
  'debut-apres-echeance': 'le début est postérieur à l’échéance',
  'date-illisible': 'une date est illisible',
};
const jourDe = (iso: string) => Math.floor(new Date(iso).getTime() / JOUR) * JOUR;

/** Calcul pur (testé) : bornes de la période affichée et position de chaque action. Marge d'une semaine de chaque côté,
    période bornée à deux ans pour garder une frise lisible. */
export function calculerFrise(items: GrcObject[], aujourdhui: number): Frise {
  const placees: Frise['placees'] = [];
  const sansDate: GrcObject[] = [];
  const incoherentes: Frise['incoherentes'] = [];
  for (const objet of items) {
    const t = objet.data as Partial<TaskData>;
    const brutes = [t.startAt, t.dueAt].filter((d): d is string => typeof d === 'string' && !!d);
    if (!brutes.length) {
      sansDate.push(objet);
      continue;
    }
    const dates = brutes.map(jourDe);
    if (dates.some((d) => !Number.isFinite(d))) {
      incoherentes.push({ objet, raison: 'date-illisible' });
      continue;
    }
    // Début et échéance renseignés : un début après l'échéance est une erreur de saisie, pas une barre à l'envers.
    if (brutes.length === 2 && dates[0]! > dates[1]!) {
      incoherentes.push({ objet, raison: 'debut-apres-echeance' });
      continue;
    }
    placees.push({ objet, de: Math.min(...dates), a: Math.max(...dates) });
  }
  const jourAuj = Math.floor(aujourdhui / JOUR) * JOUR;
  const bornes = [...placees.flatMap((p) => [p.de, p.a]), jourAuj];
  const debut = Math.min(...bornes) - 7 * JOUR;
  const finComplete = Math.max(...bornes) + 7 * JOUR;
  const fin = Math.min(finComplete, debut + 730 * JOUR);
  placees.sort((x, y) => x.de - y.de || x.a - y.a);
  const horsPeriode = placees.filter((p) => p.de > fin || p.a < debut).map((p) => p.objet);
  return {
    debut,
    jours: Math.round((fin - debut) / JOUR) + 1,
    placees: placees.filter((p) => !horsPeriode.includes(p.objet)),
    sansDate,
    incoherentes,
    tronquee: finComplete > fin,
    horsPeriode,
  };
}
