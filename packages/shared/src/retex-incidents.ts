/* RETEX d'un incident : chronologie saisie événement par événement (date et heure, type, intitulé, description,
   acteur, gravité ressentie), stockée dans l'incident (champ `timeline` de l'entrée `incidents` de l'état historique).
   La chronologie générée relie les événements dans l'ordre chronologique ; la courbe suit la gravité, reportée de
   l'événement précédent quand elle n'est pas renseignée. Indicateurs calculés : durée totale, délais de confinement et
   de rétablissement depuis la détection. Horodatages « AAAA-MM-JJThh:mm » (heure locale saisie, sans fuseau). */
import { z } from 'zod';

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

/** Types d'événement : étapes de la réponse à incident (détection → clôture), plus décision et communication. */
export const TYPES_EVENEMENT_RETEX = [
  'Détection',
  'Qualification',
  'Alerte et escalade',
  'Analyse',
  'Confinement',
  'Décision',
  'Communication',
  'Éradication',
  'Rétablissement',
  'Clôture',
  'Autre',
] as const;
/** Gravité ressentie au moment de l'événement, de 0 (aucune) à 4 (critique) : ordonnée de la courbe. */
export const GRAVITES_RETEX = ['Aucune', 'Faible', 'Modérée', 'Élevée', 'Critique'] as const;
/** Nombre maximal d'événements par incident (garde de taille de l'état). */
export const MAX_EVENEMENTS_RETEX = 300;

export interface EvenementRetex {
  id: string;
  ts: string;
  type: string;
  titre: string;
  description: string;
  acteur: string;
  gravite: string;
}

const HORODATAGE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
/** Minutes depuis l'époque d'un horodatage « AAAA-MM-JJThh:mm », lu sans fuseau (NaN s'il est invalide). */
export function minutesRetex(ts: string): number {
  if (!HORODATAGE.test(ts)) return Number.NaN;
  const [d, h] = ts.split('T') as [string, string];
  const [a, m, j] = d.split('-').map(Number) as [number, number, number];
  const [hh, mm] = h.split(':').map(Number) as [number, number];
  const t = Date.UTC(a, m - 1, j, hh, mm);
  const v = new Date(t);
  // Refuse les dates qui « débordent » (31/02, 25:00…).
  if (v.getUTCFullYear() !== a || v.getUTCMonth() !== m - 1 || v.getUTCDate() !== j || hh > 23 || mm > 59)
    return Number.NaN;
  return t / 60000;
}
export const horodatageRetexValide = (ts: string) => !Number.isNaN(minutesRetex(ts));

/** Événements lisibles d'une chronologie brute, triés par date puis par identifiant ; entrées invalides ignorées. */
export function lireEvenementsRetex(brut: unknown): EvenementRetex[] {
  if (!Array.isArray(brut)) return [];
  return brut
    .filter((x): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x))
    .map((o) => ({
      id: str(o.id),
      ts: str(o.ts),
      type: (TYPES_EVENEMENT_RETEX as readonly string[]).includes(str(o.type)) ? str(o.type) : 'Autre',
      titre: str(o.titre),
      description: str(o.description),
      acteur: str(o.acteur),
      gravite: (GRAVITES_RETEX as readonly string[]).includes(str(o.gravite)) ? str(o.gravite) : '',
    }))
    .filter((e) => e.id && horodatageRetexValide(e.ts))
    .sort((a, b) => a.ts.localeCompare(b.ts) || a.id.localeCompare(b.id, 'fr', { numeric: true }));
}

/** Identifiant d'un nouvel événement : EV-nnn, numéro suivant le plus grand existant ou déjà attribué (compteur
    `timelineSeq` de l'incident), pour qu'un identifiant retiré ne soit jamais réattribué. */
export function identifiantEvenementRetex(existants: readonly string[], dernierAttribue = 0): string {
  const max = existants.reduce(
    (m, id) => {
      const r = /^EV-(\d+)$/.exec(id);
      return r ? Math.max(m, Number(r[1])) : m;
    },
    Number.isInteger(dernierAttribue) && dernierAttribue > 0 ? dernierAttribue : 0,
  );
  return `EV-${String(max + 1).padStart(3, '0')}`;
}

/** Durée lisible en minutes : « 0 min », « 45 min », « 2 h 05 », « 19 h », « 3 j 4 h ». */
export function dureeRetex(minutes: number): string {
  const t = Math.max(0, Math.round(minutes));
  if (t < 60) return `${t} min`;
  if (t < 1440) return t % 60 ? `${Math.floor(t / 60)} h ${String(t % 60).padStart(2, '0')}` : `${t / 60} h`;
  const j = Math.floor(t / 1440),
    h = Math.floor((t % 1440) / 60);
  return h ? `${j} j ${h} h` : `${j} j`;
}

/** Date et heure à la française d'un horodatage « AAAA-MM-JJThh:mm » : « 12/10/2026 08:45 ». */
export const dateHeureRetex = (ts: string) =>
  HORODATAGE.test(ts) ? `${ts.slice(8, 10)}/${ts.slice(5, 7)}/${ts.slice(0, 4)} ${ts.slice(11, 16)}` : ts;

export interface PointChronologie extends EvenementRetex {
  rang: number;
  /** Gravité retenue pour la courbe (0 à 4) : saisie, sinon reportée du point précédent, sinon 1. */
  niveau: number;
  /** Gravité reportée (non saisie sur cet événement). */
  niveauReporte: boolean;
  /** Minutes écoulées depuis l'événement précédent (null pour le premier). */
  depuisPrecedent: number | null;
  /** Minutes écoulées depuis le premier événement. */
  depuisDebut: number;
}

/** Points de la chronologie générée, dans l'ordre chronologique. */
export function chronologieRetex(evenements: readonly EvenementRetex[]): PointChronologie[] {
  const tries = lireEvenementsRetex(evenements);
  const debut = tries[0] ? minutesRetex(tries[0].ts) : 0;
  let precedent = 1;
  return tries.map((e, rang) => {
    const saisi = (GRAVITES_RETEX as readonly string[]).indexOf(e.gravite);
    const niveau = saisi >= 0 ? saisi : precedent;
    precedent = niveau;
    const t = minutesRetex(e.ts);
    return {
      ...e,
      rang,
      niveau,
      niveauReporte: saisi < 0,
      depuisPrecedent: rang ? t - minutesRetex(tries[rang - 1]!.ts) : null,
      depuisDebut: t - debut,
    };
  });
}

export interface IndicateursRetex {
  evenements: number;
  /** Du premier au dernier événement, en minutes (null si moins de deux événements). */
  dureeTotale: number | null;
  /** De la première détection (ou du premier événement) au premier confinement. */
  avantConfinement: number | null;
  /** De la première détection (ou du premier événement) au premier rétablissement. */
  avantRetablissement: number | null;
  /** Gravité maximale saisie ou reportée (vide sans événement). */
  graviteMax: string;
}
export function indicateursRetex(evenements: readonly EvenementRetex[]): IndicateursRetex {
  const p = chronologieRetex(evenements);
  if (!p.length)
    return { evenements: 0, dureeTotale: null, avantConfinement: null, avantRetablissement: null, graviteMax: '' };
  const origine = minutesRetex((p.find((e) => e.type === 'Détection') ?? p[0]!).ts);
  const delai = (type: string) => {
    const e = p.find((x) => x.type === type && minutesRetex(x.ts) >= origine);
    return e ? minutesRetex(e.ts) - origine : null;
  };
  return {
    evenements: p.length,
    dureeTotale: p.length > 1 ? p[p.length - 1]!.depuisDebut : null,
    avantConfinement: delai('Confinement'),
    avantRetablissement: delai('Rétablissement'),
    graviteMax: GRAVITES_RETEX[Math.max(...p.map((e) => e.niveau))]!,
  };
}

const t = (n: number) => z.string().trim().max(n);
const horodatage = z
  .string()
  .regex(HORODATAGE, 'Date et heure invalides (AAAA-MM-JJThh:mm).')
  .refine(horodatageRetexValide, 'Date ou heure inexistante.');
const champs = {
  ts: horodatage,
  type: z.enum(TYPES_EVENEMENT_RETEX),
  titre: t(300).min(1, 'Intitulé requis.'),
  description: t(5000),
  acteur: t(200),
  gravite: z.union([z.literal(''), z.enum(GRAVITES_RETEX)]),
};
/** Ajout d'un événement : date et heure, type et intitulé requis. */
export const EvenementRetexSaisie = z
  .object(champs)
  .partial({ description: true, acteur: true, gravite: true })
  .strict();
export type EvenementRetexSaisie = z.infer<typeof EvenementRetexSaisie>;
/** Modification d'un événement : champs fournis seulement. */
export const EvenementRetexModification = z.object(champs).partial().strict();
export type EvenementRetexModification = z.infer<typeof EvenementRetexModification>;
