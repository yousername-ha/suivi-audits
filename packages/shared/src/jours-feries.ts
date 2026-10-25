/* Jours fériés légaux français (Code du travail, art. L3133-1), calculés pour une année donnée. Seuls les onze jours
   fériés de la France métropolitaine sont produits : les jours propres à l'Alsace-Moselle ou à l'outre-mer ne le sont pas
   (ils se chargent par un fichier iCalendar). Le calcul est déterministe et sans réseau ; la date de Pâques suit le
   comput grégorien (algorithme de Meeus, Jones et Butcher). Les vacances scolaires ne sont pas traitées. */

export interface JourFerie {
  /** Jour calendaire AAAA-MM-JJ. */
  date: string;
  label: string;
}

export const ANNEE_FERIES_MIN = 1583;
export const ANNEE_FERIES_MAX = 2200;

const jour = (annee: number, mois: number, j: number) => new Date(Date.UTC(annee, mois - 1, j, 12));
const iso = (d: Date) => d.toISOString().slice(0, 10);
const plus = (d: Date, n: number) => new Date(d.getTime() + n * 86_400_000);

/** Dimanche de Pâques de l'année grégorienne donnée. */
export function paques(annee: number): string {
  const a = annee % 19,
    b = Math.floor(annee / 100),
    c = annee % 100,
    d = Math.floor(b / 4),
    e = b % 4,
    f = Math.floor((b + 8) / 25),
    g = Math.floor((b - f + 1) / 3),
    h = (19 * a + b - d - g + 15) % 30,
    i = Math.floor(c / 4),
    k = c % 4,
    l = (32 + 2 * e + 2 * i - h - k) % 7,
    m = Math.floor((a + 11 * h + 22 * l) / 451),
    mois = Math.floor((h + l - 7 * m + 114) / 31),
    j = ((h + l - 7 * m + 114) % 31) + 1;
  return iso(jour(annee, mois, j));
}

/** Les onze jours fériés légaux de la métropole, triés par date. */
export function joursFeriesFrance(annee: number): JourFerie[] {
  if (!Number.isInteger(annee) || annee < ANNEE_FERIES_MIN || annee > ANNEE_FERIES_MAX)
    throw new RangeError(`Année hors de ${ANNEE_FERIES_MIN}–${ANNEE_FERIES_MAX}.`);
  const p = new Date(paques(annee) + 'T12:00:00Z');
  const liste: JourFerie[] = [
    { date: iso(jour(annee, 1, 1)), label: 'Jour de l’An' },
    { date: iso(plus(p, 1)), label: 'Lundi de Pâques' },
    { date: iso(jour(annee, 5, 1)), label: 'Fête du Travail' },
    { date: iso(jour(annee, 5, 8)), label: 'Victoire 1945' },
    { date: iso(plus(p, 39)), label: 'Ascension' },
    { date: iso(plus(p, 50)), label: 'Lundi de Pentecôte' },
    { date: iso(jour(annee, 7, 14)), label: 'Fête nationale' },
    { date: iso(jour(annee, 8, 15)), label: 'Assomption' },
    { date: iso(jour(annee, 11, 1)), label: 'Toussaint' },
    { date: iso(jour(annee, 11, 11)), label: 'Armistice 1918' },
    { date: iso(jour(annee, 12, 25)), label: 'Noël' },
  ];
  return liste.sort((x, y) => x.date.localeCompare(y.date));
}
