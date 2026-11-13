import { z } from 'zod';

/** Remise à vide (ADR 0065) : « travail » efface les données de travail et garde comptes, rôles et réglages ;
    « tout » efface aussi les comptes, groupes, rôles personnalisés et réglages (retour à l'écran d'installation). */
export const REMISE_A_VIDE_PORTEES = ['travail', 'tout'] as const;
export const RemiseAVidePortee = z.enum(REMISE_A_VIDE_PORTEES);
export type RemiseAVidePortee = z.infer<typeof RemiseAVidePortee>;

/** Phrase à recopier, propre à chaque portée : on ne confond pas les deux niveaux d'un clic. */
export const REMISE_A_VIDE_PHRASES: Record<RemiseAVidePortee, string> = {
  travail: 'VIDER LES DONNÉES',
  tout: 'TOUT EFFACER',
};
/** Une sauvegarde réussie datant de moins de ce délai est exigée avant toute remise à vide. */
export const REMISE_A_VIDE_DELAI_SAUVEGARDE_MINUTES = 30;

const Code = z.string().regex(/^\d{6}$/, 'Code de double authentification à 6 chiffres.');

export const RemiseAVideEtat = z.object({
  autorisee: z.boolean(),
  sauvegarde: z.object({
    derniere: z.string().datetime().nullable(),
    recente: z.boolean(),
    delaiMinutes: z.number().int(),
  }),
  occupee: z.boolean(),
  phrases: z.object({ travail: z.string(), tout: z.string() }),
});
export type RemiseAVideEtat = z.infer<typeof RemiseAVideEtat>;

/** Activer l'interrupteur exige un code ; le désactiver n'en exige pas (le mode sûr ne se verrouille jamais). */
export const RemiseAVideAutorisation = z
  .object({ autorisee: z.boolean(), code: Code.optional() })
  .strict()
  .refine((v) => !v.autorisee || !!v.code, { message: 'Code de double authentification requis pour activer.' });
export type RemiseAVideAutorisation = z.infer<typeof RemiseAVideAutorisation>;

export const RemiseAVideRequest = z
  .object({
    requestId: z.string().uuid(),
    portee: RemiseAVidePortee,
    confirm: z.string().min(1).max(60),
    code: Code,
  })
  .strict();
export type RemiseAVideRequest = z.infer<typeof RemiseAVideRequest>;

export const RemiseAVideResultat = z.object({
  portee: RemiseAVidePortee,
  tables: z.number().int(),
  jeton: z.boolean(),
  message: z.string(),
});
export type RemiseAVideResultat = z.infer<typeof RemiseAVideResultat>;
