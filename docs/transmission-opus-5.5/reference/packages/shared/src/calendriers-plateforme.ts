/* Calendriers de plateforme (décision 4 du 25/10/2026) : jours fériés français calculés et calendriers iCalendar importés,
   tenus par l'administrateur et réutilisables par les séries de tâches. La mise à jour est annuelle et manuelle : aucune
   adresse distante n'est consultée et rien ne se renouvelle seul. Les zones scolaires ne sont pas gérées. */
import { z } from 'zod';
import { ANNEE_FERIES_MAX, ANNEE_FERIES_MIN } from './jours-feries.js';
import { ICAL_MAX_OCTETS } from './ical.js';

export const TYPES_CALENDRIER_PLATEFORME = ['feries', 'autre'] as const;
export type TypeCalendrierPlateforme = (typeof TYPES_CALENDRIER_PLATEFORME)[number];
export const LIBELLES_TYPE_CALENDRIER: Record<TypeCalendrierPlateforme, string> = {
  feries: 'Jours fériés',
  autre: 'Autre calendrier (fermetures, événements)',
};

export const CalendrierPlateformeBody = z
  .object({
    name: z.string().trim().min(1, 'Nom obligatoire.').max(120),
    kind: z.enum(TYPES_CALENDRIER_PLATEFORME),
  })
  .strict();
export type CalendrierPlateformeBody = z.output<typeof CalendrierPlateformeBody>;

const annee = z.number().int().min(ANNEE_FERIES_MIN).max(ANNEE_FERIES_MAX);
/** Génération des jours fériés légaux d'une année ; l'aperçu (par défaut) n'écrit rien. */
export const GenererFeriesBody = z.object({ year: annee, apercu: z.boolean().default(true) }).strict();
export type GenererFeriesBody = z.output<typeof GenererFeriesBody>;
export const ImporterCalendrierPlateformeBody = z
  .object({
    ics: z.string().min(1).max(ICAL_MAX_OCTETS),
    /** Nom du fichier, conservé comme provenance. */
    filename: z.string().trim().max(200).default(''),
    apercu: z.boolean().default(true),
  })
  .strict();
export type ImporterCalendrierPlateformeBody = z.output<typeof ImporterCalendrierPlateformeBody>;
export const RetirerAnneeBody = z.object({ reason: z.string().trim().min(5, 'Motif obligatoire.').max(500) }).strict();
export type RetirerAnneeBody = z.output<typeof RetirerAnneeBody>;

export interface JourCalendrierDto {
  date: string;
  label: string;
  origin: 'calcul' | 'ical';
}
export interface AnneeCalendrierDto {
  year: number;
  days: number;
}
export interface CalendrierPlateformeDto {
  id: string;
  name: string;
  kind: TypeCalendrierPlateforme;
  years: AnneeCalendrierDto[];
  updatedAt: string | null;
  updatedBy: string | null;
  /** Années utiles non couvertes (année courante, et suivante à partir d'octobre) : rappel de la mise à jour annuelle. */
  missingYears: number[];
}
export interface ApercuMiseAJourCalendrier {
  added: JourCalendrierDto[];
  alreadyPresent: JourCalendrierDto[];
  errors: { line: number; message: string }[];
  ignored: { line: number; message: string }[];
  applied: boolean;
}

/** Années à couvrir : l'année courante, et la suivante dès octobre (la mise à jour est annuelle, à la charge de l'administrateur). */
export function anneesAttendues(maintenant: Date): number[] {
  const y = maintenant.getUTCFullYear();
  return maintenant.getUTCMonth() >= 9 ? [y, y + 1] : [y];
}
