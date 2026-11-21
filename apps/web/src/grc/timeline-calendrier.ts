/* Géométrie calendaire de la Timeline des occurrences (refonte Neon, lot 6) : période adaptée à la périodicité, repères
   calendaires réels (semaines ISO, vraies longueurs des mois, années bissextiles), navigation et classement des fiches.
   Calcul pur : aucune date, aucune échéance ni aucune occurrence n'est créée ou corrigée par cette présentation. */
import { PERIODICITES, UNITES_LABELS, type GrcObject } from '@suivi/shared';

export const JOUR = 86_400_000;
export const ECHELLES = { day: 'Journalier', week: 'Hebdomadaire', month: 'Mensuel', year: 'Annuel' } as const;
export type Echelle = keyof typeof ECHELLES;
export type ChoixEchelle = Echelle | 'auto';

/** Jour civil (minuit UTC) d'une date ISO, ou NaN si elle est illisible ou désigne un jour inexistant (30 février). */
export function jour(s: unknown): number {
  if (typeof s !== 'string') return Number.NaN;
  const m = /^(\d{4})-(\d{2})-(\d{2})(T.*)?$/.exec(s);
  if (!m) return Number.NaN;
  const [annee, mois, quantieme] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const civil = Date.UTC(annee, mois - 1, quantieme);
  const d = new Date(civil);
  if (d.getUTCFullYear() !== annee || d.getUTCMonth() !== mois - 1 || d.getUTCDate() !== quantieme) return Number.NaN;
  if (!m[4]) return civil;
  const n = Date.parse(s);
  return Number.isFinite(n) ? Math.floor(n / JOUR) * JOUR : Number.NaN;
}
export const lundi = (n: number) => n - ((new Date(n).getUTCDay() + 6) % 7) * JOUR;
const annee = (n: number) => new Date(n).getUTCFullYear();
const janvier = (y: number) => Date.UTC(y, 0, 1);
export const dateFrise = (n: number, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) =>
  new Date(n).toLocaleDateString('fr-FR', { ...options, timeZone: 'UTC' });

/** Unité de récurrence d'une série (jour par défaut si elle n'est pas lisible). */
export function uniteSerie(o?: GrcObject): Echelle {
  const r = o?.data.recurrence as { unit?: string } | undefined;
  return r?.unit && r.unit in ECHELLES ? (r.unit as Echelle) : 'day';
}
/** Rythme d'une série en toutes lettres (préréglage du dossier 018 ou périodicité personnalisée), pause comprise. */
export function rythmeSerie(s: GrcObject): string {
  const r = s.data.recurrence as { unit?: string; interval?: number; active?: boolean } | undefined;
  if (!r || typeof r.unit !== 'string' || !(r.unit in ECHELLES)) return 'Périodicité non lisible';
  const unite = r.unit as Echelle,
    n = Number.isInteger(r.interval) && Number(r.interval) > 0 ? Number(r.interval) : 1;
  const libelle =
    PERIODICITES.find((p) => p.unit === unite && p.interval === n)?.label ?? `Tous les ${n} ${UNITES_LABELS[unite]}`;
  return r.active === false ? `${libelle} · En pause` : libelle;
}
/** Échelle « Auto » : celle de la série suivie, sinon l'unité la plus fine parmi les séries représentées. */
export function infererEchelle(series: readonly GrcObject[], items: readonly GrcObject[], focus: string): Echelle {
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
  /** Premier jour affiché (inclus) et fin (exclue), en millisecondes UTC. */
  debut: number;
  fin: number;
  jours: number;
  unite: Echelle;
  reperes: Intervalle[];
}
/** Numéro de semaine ISO 8601 du jour `n` (minuit UTC). */
export const numeroSemaine = (n: number) => {
  const d = new Date(n);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  return Math.ceil(((d.getTime() - janvier(d.getUTCFullYear())) / JOUR + 1) / 7);
};

/** Période affichée : 14 jours, 12 semaines ISO, 12 mois civils ou 5 années civiles ; `origine` (navigation) et
    `dates` (« Tout afficher ») la déplacent ou l'élargissent sans jamais réduire les repères à plus de quatorze. */
export function periodeCalendaire(unite: Echelle, maintenant: number, origine?: number, dates?: number[]): Periode {
  const today = Math.floor(maintenant / JOUR) * JOUR;
  const parJour = unite === 'day' || unite === 'week';
  const depart = origine !== undefined && Number.isFinite(origine) ? origine : undefined;
  let debut = parJour
    ? lundi(depart ?? today - (unite === 'day' ? 7 : 42) * JOUR)
    : janvier(annee(depart ?? today) - (depart === undefined && unite === 'year' ? 2 : 0));
  let fin = parJour ? debut + (unite === 'day' ? 14 : 84) * JOUR : janvier(annee(debut) + (unite === 'year' ? 5 : 1));
  if (dates) {
    const toutes = [today, ...dates.filter(Number.isFinite)];
    const min = Math.min(...toutes),
      max = Math.max(...toutes);
    if (parJour) {
      debut = lundi(min - 3 * JOUR);
      fin = debut + Math.max(14, Math.ceil((max + 5 * JOUR - debut) / JOUR / 7) * 7) * JOUR;
    } else {
      debut = janvier(Math.min(annee(min), annee(debut)));
      fin = janvier(Math.max(annee(max) + 1, annee(fin)));
    }
  }
  const jours = Math.round((fin - debut) / JOUR),
    reperes: Intervalle[] = [];
  if (parJour) {
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
    // Février et les autres mois ont leur vraie longueur, années bissextiles comprises.
    const pasMois = Math.max(1, Math.ceil(jours / 366));
    for (let n = debut; n < fin;) {
      const d = new Date(n),
        suivant = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + pasMois, 1);
      reperes.push({
        debut: n,
        fin: Math.min(fin, suivant),
        label: dateFrise(n, { month: 'short', year: 'numeric' }),
        court: dateFrise(n, { month: '2-digit' }),
      });
      n = suivant;
    }
  } else {
    const pas = Math.max(1, Math.ceil((annee(fin) - annee(debut)) / 12));
    for (let y = annee(debut); y < annee(fin); y += pas)
      reperes.push({ debut: janvier(y), fin: Math.min(fin, janvier(y + pas)), label: String(y), court: String(y) });
  }
  return { debut, fin, jours, unite, reperes };
}
/** Origine de la période voisine (sens = -1 ou +1), alignée sur les bornes calendaires. */
export function decalerPeriode(p: Periode, sens: number): number {
  return p.unite === 'month' || p.unite === 'year'
    ? janvier(annee(p.debut) + sens * (annee(p.fin) - annee(p.debut)))
    : p.debut + sens * p.jours * JOUR;
}

export interface Placement {
  objet: GrcObject;
  debut: number;
  fin: number;
}
/** Range chaque fiche : visible dans la période, hors période, sans date ou à dates incohérentes. Rien n'est écarté ni
    corrigé ; une occurrence sans échéance ne prend pas son début comme échéance fictive. */
export function classerDates(items: readonly GrcObject[], periode: Periode, occurrences: boolean) {
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
  visibles.sort((x, y) => x.debut - y.debut || x.fin - y.fin);
  return { visibles, horsPeriode, sansDate, incoherentes };
}
/** Étage de chaque repère (abscisses croissantes) : deux repères trop proches gardent leur vraie abscisse et prennent
    des étages distincts, plutôt qu'un défilement interne ou un chevauchement. */
export function etagerReperes(positions: readonly number[], distance = 82): number[] {
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
