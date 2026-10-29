/* Adresse du site (ADR 0077) : nom DNS (ou adresse IPv4) auquel les utilisateurs ouvrent l'application. Proposée par
   l'assistant d'installation (adresse utilisée par le navigateur), modifiable dans l'administration ; l'exécutant du serveur
   l'applique (SITE_ADDRESS dans .env, frontal et application recréés). Même règle que le frontal : lettres, chiffres, points
   et tirets, sans port ni schéma. */
import { z } from 'zod';

export const ADRESSE_SITE_RE = /^[A-Za-z0-9]([A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$/;
export const estAdresseSite = (s: string) => ADRESSE_SITE_RE.test(s) && !s.includes('..');
export const AdresseSite = z
  .string()
  .trim()
  .toLowerCase()
  .refine(
    estAdresseSite,
    'Nom DNS ou adresse IPv4 attendu (lettres, chiffres, points et tirets ; sans https:// ni port).',
  );
export const AdresseSiteEtat = z.object({
  /** Adresse en service (celle de la configuration du serveur). */
  actuelle: z.string().nullable(),
  /** Adresse demandée dans l'application, appliquée par l'exécutant sous une minute ; null si aucune demande. */
  demandee: z.string().nullable(),
  demandeeLe: z.string().nullable(),
  demandeePar: z.string().nullable(),
});
export type AdresseSiteEtat = z.infer<typeof AdresseSiteEtat>;
export const AdresseSiteBody = z.object({
  adresse: AdresseSite,
  code: z.string().regex(/^\d{6}$/, 'Code à 6 chiffres.'),
});
