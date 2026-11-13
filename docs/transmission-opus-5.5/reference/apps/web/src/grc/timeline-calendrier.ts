/* Géométrie calendaire de la Timeline Studio. Aucune date ni occurrence n’est créée par cette présentation. */
import type { GrcObject } from '@suivi/shared';

export const JOUR = 86_400_000;
export const ECHELLES = { day: 'Journalier', week: 'Hebdomadaire', month: 'Mensuel', year: 'Annuel' } as const;
export type Echelle = keyof typeof ECHELLES;
export type ChoixEchelle = Echelle | 'auto';
export const jour = (s: unknown): number => {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}(T|$)/.test(s)) return NaN;
  const n = Date.parse(s);
  return Number.isFinite(n) && new Date(n).toISOString().slice(0, 10) === s.slice(0, 10)
    ? Math.floor(n / JOUR) * JOUR
    : NaN;
};
export const lundi = (n: number) => n - ((new Date(n).getUTCDay() + 6) % 7) * JOUR;
const annee = (n: number) => new Date(n).getUTCFullYear();
const janvier = (y: number) => Date.UTC(y, 0, 1);
export const dateFrise = (n: number, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  new Date(n).toLocaleDateString('fr-FR', { ...options, timeZone: 'UTC' });
export const uniteSerie = (o?: GrcObject): Echelle => {
  const r = o?.data.recurrence as { unit?: string } | undefined;
  return r?.unit && r.unit in ECHELLES ? (r.unit as Echelle) : 'day';
};
export function infererEchelle(series: GrcObject[], items: GrcObject[], focus: string): Echelle {
  const selection = focus
    ? series.filter((s) => s.id === focus)
    : series.filter((s) => items.some((o) => o.data.seriesId === s.id));
  return (Object.keys(ECHELLES) as Echelle[]).find((u) => selection.some((s) => uniteSerie(s) === u)) ?? 'day';
}
export interface Intervalle {
  debut: number;
  fin: number;
  label: string;
  court: string;
}
export interface Periode {
  debut: number;
  fin: number;
  jours: number;
  unite: Echelle;
  reperes: Intervalle[];
}
const numeroSemaine = (n: number) => {
  const d = new Date(n);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return Math.ceil(((d.getTime() - janvier(d.getUTCFullYear())) / JOUR + 1) / 7);
};
export function periodeCalendaire(unite: Echelle, maintenant: number, origine?: number, dates?: number[]): Periode {
  const today = Math.floor(maintenant / JOUR) * JOUR;
  let debut =
    origine ??
    (unite === 'day' || unite === 'week'
      ? lundi(today - (unite === 'day' ? 7 : 42) * JOUR)
      : janvier(annee(today) - (unite === 'year' ? 2 : 0)));
  let fin =
    unite === 'day' || unite === 'week'
      ? debut + (unite === 'day' ? 14 : 84) * JOUR
      : janvier(annee(debut) + (unite === 'year' ? 5 : 1));
  if (dates) {
    const toutes = [today, ...dates.filter(Number.isFinite)];
    const min = Math.min(...toutes),
      max = Math.max(...toutes);
    if (unite === 'day' || unite === 'week') {
      debut = lundi(min - 3 * JOUR);
      fin = debut + Math.max(14, Math.ceil((max + 5 * JOUR - debut) / JOUR / 7) * 7) * JOUR;
    } else {
      debut = janvier(Math.min(annee(min), annee(debut)));
      fin = janvier(Math.max(annee(max) + 1, annee(fin)));
    }
  }
  const jours = Math.round((fin - debut) / JOUR),
    reperes: Intervalle[] = [];
  if (unite === 'day' || unite === 'week') {
    const pas = unite === 'day' ? Math.max(1, Math.ceil(jours / 14)) : 7 * Math.max(1, Math.ceil(jours / 84));
    for (let n = debut; n < fin; n += pas * JOUR)
      reperes.push({
        debut: n,
        fin: Math.min(fin, n + pas * JOUR),
        label:
          unite === 'day'
            ? dateFrise(n, { weekday: 'short', day: 'numeric' })
            : `S${numeroSemaine(n)} · ${dateFrise(n)}`,
        court: unite === 'day' ? dateFrise(n, { day: 'numeric' }) : `S${numeroSemaine(n)}`,
      });
  } else if (unite === 'month') {
    // Les tailles de février et des autres mois sont réelles, y compris les années bissextiles.
    for (let n = debut; n < fin;) {
      const d = new Date(n),
        next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + Math.max(1, Math.ceil(jours / 366)), 1);
      reperes.push({
        debut: n,
        fin: Math.min(fin, next),
        label: dateFrise(n, { month: 'short', year: 'numeric' }),
        court: dateFrise(n, { month: '2-digit' }),
      });
      n = next;
    }
  } else {
    const pas = Math.max(1, Math.ceil((annee(fin) - annee(debut)) / 12));
    for (let y = annee(debut); y < annee(fin); y += pas)
      reperes.push({ debut: janvier(y), fin: Math.min(fin, janvier(y + pas)), label: String(y), court: String(y) });
  }
  return { debut, fin, jours, unite, reperes };
}
export function decalerPeriode(p: Periode, sens: number) {
  return p.unite === 'month' || p.unite === 'year'
    ? janvier(annee(p.debut) + sens * (annee(p.fin) - annee(p.debut)))
    : p.debut + sens * p.jours * JOUR;
}
export interface Placement {
  objet: GrcObject;
  debut: number;
  fin: number;
}
export function classerDates(items: GrcObject[], periode: Periode, occurrences: boolean) {
  const visibles: Placement[] = [],
    horsPeriode: GrcObject[] = [],
    sansDate: GrcObject[] = [],
    incoherentes: GrcObject[] = [];
  for (const objet of items) {
    const a = jour(objet.data.startAt),
      b = jour(objet.data.dueAt);
    const brutes = [objet.data.startAt, objet.data.dueAt].filter(Boolean);
    if (!brutes.length || (occurrences && !objet.data.dueAt)) {
      sansDate.push(objet);
      continue;
    }
    if (brutes.some((s) => !Number.isFinite(jour(s))) || (Number.isFinite(a) && Number.isFinite(b) && a > b)) {
      incoherentes.push(objet);
      continue;
    }
    const debut = Number.isFinite(a) ? a : b,
      fin = Number.isFinite(b) ? b : a;
    if (fin < periode.debut || debut >= periode.fin) horsPeriode.push(objet);
    else visibles.push({ objet, debut, fin });
  }
  visibles.sort((a, b) => a.debut - b.debut || a.fin - b.fin);
  return { visibles, horsPeriode, sansDate, incoherentes };
}
/** Les repères voisins gardent leur vraie abscisse et prennent un étage distinct plutôt qu'un défilement interne. */
export function etagerReperes(positions: number[], distance = 82): number[] {
  const fins: number[] = [],
    etages: number[] = [];
  positions.forEach((x) => {
    let i = fins.findIndex((fin) => x - fin >= distance);
    if (i < 0) i = fins.length;
    fins[i] = x;
    etages.push(i);
  });
  return etages;
}
