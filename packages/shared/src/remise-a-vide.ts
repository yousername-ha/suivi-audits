import { z } from 'zod';

/** Remise à vide (ADR 0065) : « travail » efface les données de travail et garde comptes, rôles et réglages ;
    « tout » efface aussi les comptes, groupes, rôles personnalisés et réglages (retour à l'écran d'installation). */
export const REMISE_A_VIDE_PORTEES = ['travail', 'tout'] as const;
export const RemiseAVidePortee = z.enum(REMISE_A_VIDE_PORTEES);
export type RemiseAVidePortee = z.infer<typeof RemiseAVidePortee>;

/** Choix proposés à l'écran : les deux portées, et « demonstration » (décision du RSSI du 23/11/2026) : effacer les données
    de travail puis recharger le jeu de démonstration fictif, avec les mêmes garde-fous que la remise à vide. */
export const REMISE_A_VIDE_CHOIX = ['travail', 'demonstration', 'tout'] as const;
export type RemiseAVideChoix = (typeof REMISE_A_VIDE_CHOIX)[number];

/** Phrase à recopier, propre à chaque choix : on ne confond pas les niveaux d'un clic. */
export const REMISE_A_VIDE_PHRASES: Record<RemiseAVideChoix, string> = {
  travail: 'VIDER LES DONNÉES',
  demonstration: 'RÉGÉNÉRER LA DÉMONSTRATION',
  tout: 'TOUT EFFACER',
};

/** Phrase saisie ramenée à une forme comparable : composition Unicode (NFC : « É » tapé en deux caractères, comme le font
    certains claviers et téléphones, vaut « É »), espaces de début et de fin retirés, espaces multiples réduits. La casse et
    les accents comptent toujours. */
export const normaliserPhrase = (s: string): string => s.normalize('NFC').trim().replace(/\s+/g, ' ');

/** Phrase attendue pour une demande : celle de la démonstration si elle est demandée, sinon celle de la portée. */
export const phraseRemiseAVide = (r: { portee: RemiseAVidePortee; demonstration?: boolean | undefined }): string =>
  REMISE_A_VIDE_PHRASES[r.demonstration ? 'demonstration' : r.portee];
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
  phrases: z.object({ travail: z.string(), demonstration: z.string(), tout: z.string() }),
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
    /** Recharger le jeu de démonstration après l'effacement (portée « travail » seulement). */
    demonstration: z.boolean().optional(),
  })
  .strict()
  .refine((v) => !v.demonstration || v.portee === 'travail', {
    message: 'La démonstration se recharge après l’effacement des données de travail seulement.',
  });
export type RemiseAVideRequest = z.infer<typeof RemiseAVideRequest>;

export const RemiseAVideResultat = z.object({
  portee: RemiseAVidePortee,
  tables: z.number().int(),
  jeton: z.boolean(),
  message: z.string(),
  /** Jeu de démonstration rechargé après l'effacement, ou échec du chargement (les données restent effacées). */
  demonstration: z.enum(['chargee', 'echec']).optional(),
});
export type RemiseAVideResultat = z.infer<typeof RemiseAVideResultat>;
