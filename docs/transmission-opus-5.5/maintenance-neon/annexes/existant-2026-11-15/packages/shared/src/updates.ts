import { z } from 'zod';

export const ReleaseVersion = z
  .string()
  .regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
  .max(40);
/** Installation : confirmation écrite et code de double authentification saisi au moment de la demande (anti-rejeu). */
export const UpdateRequest = z
  .object({
    requestId: z.string().uuid(),
    version: ReleaseVersion,
    confirm: z.literal('METTRE À JOUR'),
    code: z.string().regex(/^\d{6}$/, 'Code de double authentification à 6 chiffres.'),
  })
  .strict();
export const UPDATE_PHASES = [
  'idle',
  'checking',
  'preparing',
  'backup',
  'installing',
  'verifying',
  'rollback',
  'complete',
] as const;
export const UpdatePhase = z.enum(UPDATE_PHASES);
/** Étape franchie, horodatée par l'exécutant (fichier public : aucune donnée sensible). */
export const UpdateEtape = z.object({ phase: UpdatePhase, at: z.string().datetime() });
export const UpdateState = z.object({
  installed: z.string().max(80),
  available: ReleaseVersion.nullable(),
  checkedAt: z.string().datetime().nullable(),
  notes: z.string().url().startsWith('https://github.com/yousername-ha/suivi-audits/releases/tag/v').nullable(),
  checking: z.boolean(),
  checkError: z.boolean(),
  ready: z.boolean(),
  maintenance: z.boolean(),
  id: z.string().uuid().nullable(),
  target: ReleaseVersion.nullable(),
  status: z.enum(['idle', 'queued', 'running', 'success', 'rolled_back', 'failed', 'intervention']),
  phase: UpdatePhase,
  message: z.string().max(500),
  startedAt: z.string().datetime().nullable(),
  updatedAt: z.string().datetime(),
  // Exécutants publiés avant ces champs : valeurs par défaut.
  etapes: z.array(UpdateEtape).max(30).default([]),
  finishedAt: z.string().datetime().nullable().default(null),
  /** Ajouté par l'API (jamais écrit par l'exécutant) : créneau d'installation et son état à l'instant de la lecture. */
  fenetre: z.object({ active: z.boolean(), ouverte: z.boolean(), libelle: z.string().max(200) }).optional(),
});
export type UpdateState = z.infer<typeof UpdateState>;
export type UpdateRequest = z.infer<typeof UpdateRequest>;
export type UpdateEtape = z.infer<typeof UpdateEtape>;

/* ------------------------------------------------------------------ Reçu d'une mise à jour */
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const SBOM_COMPOSANTS = ['api', 'web', 'updater'] as const;
const SbomRef = z.object({ fichier: z.enum(['api.cdx.json', 'web.cdx.json', 'updater.cdx.json']), sha256 });
const imageEpinglee = (c: string) =>
  z.string().regex(new RegExp(`^ghcr\\.io/yousername-ha/suivi-audits-${c}(@sha256:[a-f0-9]{64}|:[\\w.-]{1,40})$`));
/** Reçu structuré écrit par l'exécutant à la fin d'une installation : preuve de changement (ISO 27001 A.8.32), sans sortie
    brute de commande. Il est lisible par l'API (dossier d'état) mais n'est pas servi par le frontal public. */
export const UpdateReceipt = z.object({
  format: z.literal(1),
  id: z.string().uuid(),
  depuis: z.string().max(80),
  vers: ReleaseVersion,
  statut: z.enum(['success', 'rolled_back', 'failed', 'intervention']),
  message: z.string().max(500),
  debut: z.string().datetime().nullable(),
  fin: z.string().datetime(),
  dureeSecondes: z.number().int().min(0).nullable(),
  etapes: z.array(UpdateEtape).max(30),
  images: z
    .object({ api: imageEpinglee('api'), web: imageEpinglee('web'), updater: imageEpinglee('updater') })
    .partial(),
  signature: z.object({
    verifiee: z.boolean(),
    identite: z.string().max(300),
    emetteur: z.string().max(200),
    revision: z
      .string()
      .regex(/^[a-f0-9]{40}$/)
      .nullable(),
  }),
  sauvegarde: z.object({ fichier: z.string().max(200), sha256: sha256.nullable() }).nullable(),
  /** SBOM CycloneDX extraits des attestations signées vérifiées (ADR 0063) ; absents des reçus antérieurs. */
  sbom: z
    .object({
      api: SbomRef,
      web: SbomRef,
      updater: SbomRef,
    })
    .partial()
    .default({}),
  controles: z.object({
    avant: z.boolean().nullable(),
    apres: z.boolean().nullable(),
    documentsIdentiques: z.boolean().nullable(),
  }),
});
export type UpdateReceipt = z.infer<typeof UpdateReceipt>;
export const UpdateReceiptSummary = UpdateReceipt.pick({
  id: true,
  depuis: true,
  vers: true,
  statut: true,
  fin: true,
  dureeSecondes: true,
}).extend({ sbom: z.array(z.enum(SBOM_COMPOSANTS)) });
export type UpdateReceiptSummary = z.infer<typeof UpdateReceiptSummary>;

/* ------------------------------------------------------------------ Fenêtre de maintenance */
const heure = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Heure au format HH:MM.');
/** Créneau autorisé pour installer une mise à jour, en heure de Paris. Jours ISO : 1 = lundi … 7 = dimanche.
    Un créneau dont la fin précède le début passe minuit : il appartient au jour de son début. */
export const FenetreMaintenance = z
  .object({
    active: z.boolean(),
    jours: z
      .array(z.number().int().min(1).max(7))
      .min(1, 'Au moins un jour.')
      .max(7)
      .refine((j) => new Set(j).size === j.length, 'Jour en double.'),
    debut: heure,
    fin: heure,
  })
  .refine((f) => f.debut !== f.fin, { message: 'Le début et la fin doivent différer.', path: ['fin'] });
export type FenetreMaintenance = z.infer<typeof FenetreMaintenance>;
export const FUSEAU_MAINTENANCE = 'Europe/Paris';
export const JOURS_SEMAINE = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;
export const FENETRE_MAINTENANCE_DEFAUT: FenetreMaintenance = {
  active: false,
  jours: [1, 2, 3, 4, 5],
  debut: '12:00',
  fin: '14:00',
};

const minutes = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));
/** Jour ISO (1-7) et minute du jour à Paris, pour une date donnée. */
export function heureLocale(date: Date, timeZone = FUSEAU_MAINTENANCE): { jour: number; minute: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  const jour = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(parts.weekday ?? '') + 1;
  return { jour, minute: Number(parts.hour) * 60 + Number(parts.minute) };
}
/** Vrai si la date tombe dans le créneau (toujours vrai si la fenêtre est désactivée). */
export function dansFenetre(f: FenetreMaintenance, date = new Date()): boolean {
  if (!f.active) return true;
  const { jour, minute } = heureLocale(date);
  const d = minutes(f.debut),
    e = minutes(f.fin);
  if (d < e) return f.jours.includes(jour) && minute >= d && minute < e;
  const veille = jour === 1 ? 7 : jour - 1;
  return (f.jours.includes(jour) && minute >= d) || (f.jours.includes(veille) && minute < e);
}
/** Libellé lisible : « lundi, mardi de 12:00 à 14:00 (heure de Paris) ». */
export function libelleFenetre(f: FenetreMaintenance): string {
  if (!f.active) return 'Aucune restriction horaire.';
  const jours = [...f.jours]
    .sort((a, b) => a - b)
    .map((j) => JOURS_SEMAINE[j - 1])
    .join(', ');
  return `${jours} de ${f.debut} à ${f.fin} (heure de Paris)`;
}
