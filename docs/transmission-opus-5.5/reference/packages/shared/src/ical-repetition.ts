/* Règles de répétition iCalendar (RRULE) d'un événement : développement en jours, pour les cas courants des calendriers de
   jours fériés et de fermetures. Pris en charge : FREQ DAILY, WEEKLY, MONTHLY, YEARLY avec INTERVAL, COUNT, UNTIL ; BYDAY
   (jours simples) pour WEEKLY ; pour MONTHLY et YEARLY (avec BYMONTH) : BYMONTHDAY, positif ou négatif (-1 = dernier jour), ou
   BYDAY, tous les lundis du mois ou avec un rang (1MO premier lundi, -1FR dernier vendredi). Tout le reste (BYSETPOS, BYWEEKNO,
   BYYEARDAY, heures, BYDAY avec BYMONTHDAY…) est refusé explicitement plutôt que deviné : l'appelant le signale et laisse
   l'événement de côté. */
import { validDate } from './grc.js';

export type Frequence = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
export interface RegleRepetition {
  freq: Frequence;
  interval: number;
  count: number | null;
  /** Dernier jour de la règle (AAAA-MM-JJ). */
  until: string | null;
  /** Jours de la semaine (0 = dimanche), avec leur rang dans le mois pour MONTHLY et YEARLY (1 = premier, -1 = dernier). */
  byday: { jour: number; rang: number | null }[] | null;
  bymonth: number[] | null;
  bymonthday: number[] | null;
}
const JOURS_SEMAINE: Record<string, number> = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const PARTIES_IGNOREES = new Set(['WKST']);
const MAX_ITERATIONS = 20000;
const MAX_OCCURRENCES = 5000;

const ajouterJours = (jour: string, n: number) =>
  new Date(Date.parse(jour + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const pad = (n: number) => String(n).padStart(2, '0');

/** `AAAAMMJJ[THHMMSS[Z]]` vers `AAAA-MM-JJ` (nul si illisible). */
function jourIcs(valeur: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T\d{6}Z?)?$/.exec(valeur.trim());
  if (!m) return null;
  const j = `${m[1]}-${m[2]}-${m[3]}`;
  return validDate(j) ? j : null;
}

const joursDansMois = (annee: number, mois: number) => new Date(Date.UTC(annee, mois, 0)).getUTCDate();

/** Jours (AAAA-MM-JJ, croissants) d'un mois désignés par BYDAY ou BYMONTHDAY ; sans l'un ni l'autre, le jour de début. */
function joursDuMois(regle: RegleRepetition, annee: number, mois: number, defaut: number): string[] {
  const total = joursDansMois(annee, mois);
  const numeros = new Set<number>();
  if (regle.byday) {
    for (const { jour, rang } of regle.byday) {
      const memes: number[] = [];
      for (let d = 1; d <= total; d++) if (new Date(Date.UTC(annee, mois - 1, d)).getUTCDay() === jour) memes.push(d);
      if (rang === null) memes.forEach((d) => numeros.add(d));
      else {
        const d = rang > 0 ? memes[rang - 1] : memes[memes.length + rang];
        if (d !== undefined) numeros.add(d);
      }
    }
  } else
    for (const d of regle.bymonthday ?? [defaut]) {
      const n = d > 0 ? d : total + d + 1;
      if (n >= 1 && n <= total) numeros.add(n); // 31 février : sauté, comme le veut la norme
    }
  return [...numeros].sort((a, b) => a - b).map((d) => `${annee}-${pad(mois)}-${pad(d)}`);
}

/** Lit une règle ; renvoie la règle, ou la raison pour laquelle elle n'est pas prise en charge. */
export function lireRegle(brut: string): { regle: RegleRepetition } | { refus: string } {
  const parties = new Map<string, string>();
  for (const p of brut.split(';')) {
    const i = p.indexOf('=');
    if (i < 0) return { refus: 'règle illisible' };
    parties.set(
      p.slice(0, i).trim().toUpperCase(),
      p
        .slice(i + 1)
        .trim()
        .toUpperCase(),
    );
  }
  const freq = parties.get('FREQ');
  if (!freq || !['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'].includes(freq))
    return { refus: `fréquence ${freq ?? 'absente'} non prise en charge` };
  const autorisees = new Set(['FREQ', 'INTERVAL', 'COUNT', 'UNTIL', ...PARTIES_IGNOREES]);
  if (freq === 'WEEKLY') autorisees.add('BYDAY');
  if (freq === 'MONTHLY' || freq === 'YEARLY') {
    autorisees.add('BYDAY');
    autorisees.add('BYMONTHDAY');
    autorisees.add('BYMONTH');
  }
  for (const cle of parties.keys()) if (!autorisees.has(cle)) return { refus: `paramètre ${cle} non pris en charge` };
  const entier = (v: string | undefined, defaut: number | null, min: number, max: number) => {
    if (v === undefined) return defaut;
    return /^\d+$/.test(v) && Number(v) >= min && Number(v) <= max ? Number(v) : NaN;
  };
  const interval = entier(parties.get('INTERVAL'), 1, 1, 1000);
  const count = entier(parties.get('COUNT'), null, 1, 100000);
  if (Number.isNaN(interval) || Number.isNaN(count)) return { refus: 'INTERVAL ou COUNT invalide' };
  let until: string | null = null;
  if (parties.has('UNTIL')) {
    until = jourIcs(parties.get('UNTIL')!);
    if (!until) return { refus: 'UNTIL illisible' };
  }
  const liste = (v: string | undefined, lire: (s: string) => number | null) => {
    if (v === undefined) return null;
    const out = v.split(',').map(lire);
    return out.some((x) => x === null) ? undefined : (out as number[]);
  };
  const jourRang = (s: string) => {
    const m = /^([+-]?\d{1,2})?(SU|MO|TU|WE|TH|FR|SA)$/.exec(s);
    if (!m) return null;
    const rang = m[1] === undefined ? null : Number(m[1]);
    return rang !== null && (rang === 0 || Math.abs(rang) > 5) ? null : { jour: JOURS_SEMAINE[m[2]!]!, rang };
  };
  let byday: { jour: number; rang: number | null }[] | null | undefined = null;
  if (parties.has('BYDAY')) {
    const lus = parties.get('BYDAY')!.split(',').map(jourRang);
    byday = lus.some((x) => x === null) ? undefined : (lus as { jour: number; rang: number | null }[]);
  }
  const bymonth = liste(parties.get('BYMONTH'), (s) => (/^\d+$/.test(s) && +s >= 1 && +s <= 12 ? +s : null));
  const bymonthday = liste(parties.get('BYMONTHDAY'), (s) =>
    /^-?\d+$/.test(s) && +s !== 0 && Math.abs(+s) <= 31 ? +s : null,
  );
  if (byday === undefined) return { refus: 'BYDAY invalide (rang de 1 à 5, jour MO à SU)' };
  if (bymonth === undefined) return { refus: 'BYMONTH invalide' };
  if (bymonthday === undefined) return { refus: 'BYMONTHDAY invalide' };
  if (freq === 'WEEKLY' && byday?.some((d) => d.rang !== null))
    return { refus: 'BYDAY avec rang sur une règle hebdomadaire non pris en charge' };
  if (byday && bymonthday) return { refus: 'BYDAY et BYMONTHDAY ensemble non pris en charge' };
  if (freq === 'YEARLY' && byday && !bymonth) return { refus: 'BYDAY annuel sans BYMONTH non pris en charge' };
  return { regle: { freq: freq as Frequence, interval: interval!, count, until, byday, bymonth, bymonthday } };
}

export interface Developpement {
  /** Premiers jours des occurrences dans la fenêtre demandée. */
  jours: string[];
  /** Vrai quand la règle, sans fin, a été arrêtée à `jusqu`. */
  tronque: boolean;
}

/** Développe la règle à partir du premier jour `debut` ; ne garde que les occurrences de `depuis` à `jusqu` (inclus). */
export function developper(regle: RegleRepetition, debut: string, depuis: string, jusqu: string): Developpement {
  const sortie: string[] = [];
  let compte = 0;
  let tronque = false;
  const fin = regle.until && regle.until < jusqu ? regle.until : jusqu;
  /** Retourne faux pour arrêter. */
  const prendre = (jour: string): boolean => {
    if (jour < debut) return true;
    if (jour > fin) {
      if (!regle.until && (regle.count === null || compte < regle.count)) tronque = true;
      return false;
    }
    if (regle.count !== null && compte >= regle.count) return false;
    compte++;
    if (jour >= depuis) sortie.push(jour);
    return sortie.length < MAX_OCCURRENCES;
  };
  const [y0, m0, d0] = debut.split('-').map(Number) as [number, number, number];
  if (regle.freq === 'DAILY') {
    for (let k = 0; k < MAX_ITERATIONS; k++) if (!prendre(ajouterJours(debut, k * regle.interval))) break;
  } else if (regle.freq === 'WEEKLY') {
    const jours = [...(regle.byday?.map((d) => d.jour) ?? [new Date(debut + 'T12:00:00Z').getUTCDay()])].sort(
      (a, b) => ((a + 6) % 7) - ((b + 6) % 7),
    );
    const lundi = ajouterJours(debut, -((new Date(debut + 'T12:00:00Z').getUTCDay() + 6) % 7));
    boucle: for (let k = 0; k < MAX_ITERATIONS; k++)
      for (const d of jours) if (!prendre(ajouterJours(lundi, k * 7 * regle.interval + ((d + 6) % 7)))) break boucle;
  } else if (regle.freq === 'MONTHLY') {
    boucle: for (let k = 0; k < MAX_ITERATIONS; k++) {
      const indice = m0 - 1 + k * regle.interval;
      const annee = y0 + Math.floor(indice / 12),
        mois = (indice % 12) + 1;
      if (regle.bymonth && !regle.bymonth.includes(mois)) {
        if (`${annee}-${pad(mois)}-01` > fin) break;
        continue;
      }
      for (const j of joursDuMois(regle, annee, mois, d0)) if (!prendre(j)) break boucle;
      if (`${annee}-${pad(mois)}-01` > fin) break;
    }
  } else {
    const mois = [...(regle.bymonth ?? [m0])].sort((a, b) => a - b);
    boucle: for (let k = 0; k < MAX_ITERATIONS; k++) {
      const annee = y0 + k * regle.interval;
      for (const m of mois) for (const j of joursDuMois(regle, annee, m, d0)) if (!prendre(j)) break boucle;
      if (`${annee}-01-01` > fin) break;
    }
  }
  return { jours: sortie, tronque };
}
