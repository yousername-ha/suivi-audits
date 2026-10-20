/* Responsables : une personne, un groupe ou une fonction de l'organisation (migration 031). */
import { z } from 'zod';

/** Un responsable est une personne, un groupe ou une fonction de l'organisation. */
export const TYPES_RESPONSABLE = ['utilisateur', 'groupe', 'fonction'] as const;
export type TypeResponsable = (typeof TYPES_RESPONSABLE)[number];
export const RESPONSABLE_LABELS: Record<TypeResponsable, string> = {
  utilisateur: 'Personne',
  groupe: 'Groupe',
  fonction: 'Fonction',
};
export const ResponsableRef = z.object({ type: z.enum(TYPES_RESPONSABLE), id: z.uuid() }).strict();
export type ResponsableRef = z.infer<typeof ResponsableRef>;
export const FonctionBody = z
  .object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000).default(''),
    members: z.array(z.uuid()).max(500).default([]),
  })
  .strict();
export type FonctionBody = z.infer<typeof FonctionBody>;
export interface FonctionDto {
  id: string;
  name: string;
  description: string;
  archived: boolean;
  members: { id: string; displayName: string; username: string }[];
}
/** Responsables proposables dans un périmètre. */
export interface ResponsablesProposables {
  utilisateurs: { id: string; username: string; displayName: string }[];
  groupes: { id: string; name: string; membres: number }[];
  fonctions: { id: string; name: string; membres: number }[];
}
