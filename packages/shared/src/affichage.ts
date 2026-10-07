/* Affichage : préférences par personne (taille, densité, thème, colonnes), écrans muraux, synthèse du tableau de bord
   (calculée à partir de l'état de l'outil historique, déjà filtré selon les droits). */
import { z } from 'zod';
import { BUSINESS_MODULES } from './permissions.js';

/* ---------------------------------------------------------------- Préférences */
export const TAILLES = ['90', '100', '115', '130', '150', 'auto'] as const;
export const TAILLE_LABELS: Record<(typeof TAILLES)[number], string> = {
  '90': '90 %',
  '100': '100 %',
  '115': '115 %',
  '130': '130 %',
  '150': '150 %',
  auto: 'Automatique (plus grand au-delà de 2560 px)',
};
export const Preferences = z.object({
  taille: z.enum(TAILLES).default('auto'),
  /** « organisation » : valeur par défaut de l'organisation (Paramètres > Apparence). */
  densite: z.enum(['organisation', 'compacte', 'normale', 'confortable']).default('organisation'),
  theme: z.enum(['organisation', 'auto', 'clair', 'sombre']).default('organisation'),
  /** Colonnes affichées, par tableau (sélecteur de colonnes mémorisé). */
  colonnes: z
    .record(z.string().regex(/^[a-z0-9_-]{1,40}$/), z.array(z.string().regex(/^[a-z0-9_-]{1,40}$/)).max(30))
    .refine((r) => Object.keys(r).length <= 30, 'Trop de tableaux.')
    .default({}),
});
export type Preferences = z.infer<typeof Preferences>;
export const DEFAULT_PREFERENCES: Preferences = Preferences.parse({});

/* ---------------------------------------------------------------- Écrans muraux */
export const WallCreateBody = z.object({
  nom: z.string().trim().min(1, 'Nom obligatoire.').max(80),
  jours: z.number().int().min(1).max(365).default(180),
  modules: z
    .array(z.enum(BUSINESS_MODULES))
    .min(1, 'Au moins un module.')
    .default([...BUSINESS_MODULES]),
});
export const WallOut = z.object({
  id: z.string(),
  name: z.string(),
  modules: z.array(z.string()),
  activated_at: z.string().nullable(),
  activation_expires: z.string().nullable(),
  expires_at: z.string(),
  revoked_at: z.string().nullable(),
  last_seen_at: z.string().nullable(),
  created_by: z.string(),
  created_at: z.string(),
  version: z.number(),
});
export type WallOut = z.infer<typeof WallOut>;

/* ---------------------------------------------------------------- Synthèse (tableau de bord, écran mural) */
export const Synthese = z.object({
  organisation: z.string(),
  genereLe: z.string(),
  prochainAudit: z.object({ date: z.string(), annee: z.number().nullable(), libelle: z.string() }).nullable(),
  auditInterne: z.string().nullable(),
  ecarts: z
    .object({
      total: z.number(),
      ouverts: z.number(),
      enRetard: z.number(),
      aEcheance: z.number(),
      parStatut: z.record(z.string(), z.number()),
      parType: z.record(z.string(), z.number()),
    })
    .nullable(),
  echeances: z.array(
    z.object({
      id: z.string(),
      texte: z.string(),
      echeance: z.string(),
      pilote: z.string(),
      statut: z.string(),
      enRetard: z.boolean(),
    }),
  ),
  plan: z
    .object({
      statut: z.string(),
      jours: z.array(z.object({ label: z.string(), date: z.string(), creneaux: z.number() })),
    })
    .nullable(),
  mesures: z.object({ total: z.number(), parReferentiel: z.record(z.string(), z.number()) }).nullable(),
});
export type Synthese = z.infer<typeof Synthese>;

type Obj = Record<string, unknown>;
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Obj[]) : []);
const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const CLOS = /^(clos|close|clôturé|soldé|levé)/i;

/** Synthèse de l'état (déjà filtré selon les droits : un module masqué est vide). joursEcheance : horizon des échéances. */
export function computeSynthese(
  state: Obj,
  opts: { organisation: string; aujourdHui: Date; joursEcheance: number; lisible: (cle: string) => boolean },
): Synthese {
  const today = opts.aujourdHui.toISOString().slice(0, 10);
  const horizon = new Date(opts.aujourdHui.getTime() + opts.joursEcheance * 86400e3).toISOString().slice(0, 10);
  const labels = (state.yearLabels && typeof state.yearLabels === 'object' ? state.yearLabels : {}) as Obj;
  const nextYear = typeof state.nextYear === 'number' ? state.nextYear : null;

  let ecarts: Synthese['ecarts'] = null;
  let echeances: Synthese['echeances'] = [];
  if (opts.lisible('findings')) {
    const f = arr(state.findings);
    const ouverts = f.filter((x) => !CLOS.test(s(x.status)));
    const count = (k: string) =>
      f.reduce<Record<string, number>>(
        (m, x) => ((m[s(x[k]) || 'Non renseigné'] = (m[s(x[k]) || 'Non renseigné'] ?? 0) + 1), m),
        {},
      );
    const dues = ouverts.filter((x) => /^\d{4}-\d{2}-\d{2}/.test(s(x.due)));
    ecarts = {
      total: f.length,
      ouverts: ouverts.length,
      enRetard: dues.filter((x) => s(x.due).slice(0, 10) < today).length,
      aEcheance: dues.filter((x) => s(x.due).slice(0, 10) >= today && s(x.due).slice(0, 10) <= horizon).length,
      parStatut: count('status'),
      parType: count('type'),
    };
    echeances = dues
      .filter((x) => s(x.due).slice(0, 10) <= horizon)
      .sort((a, b) => s(a.due).localeCompare(s(b.due)))
      .slice(0, 12)
      .map((x) => ({
        id: s(x.id),
        texte: s(x.text) || s(x.desc),
        echeance: s(x.due).slice(0, 10),
        pilote: s(x.owner),
        statut: s(x.status),
        enRetard: s(x.due).slice(0, 10) < today,
      }));
  }
  const plan = opts.lisible('plan') && state.plan && typeof state.plan === 'object' ? (state.plan as Obj) : null;
  const slots = arr(plan?.slots);
  let mesures: Synthese['mesures'] = null;
  if (opts.lisible('items')) {
    const items = arr(state.items);
    mesures = {
      total: items.length,
      parReferentiel: items.reduce<Record<string, number>>((m, i) => ((m[s(i.ref)] = (m[s(i.ref)] ?? 0) + 1), m), {}),
    };
  }
  const audit = opts.lisible('nextDate');
  return {
    organisation: opts.organisation,
    genereLe: opts.aujourdHui.toISOString(),
    prochainAudit:
      audit && (s(state.nextDate) || nextYear)
        ? { date: s(state.nextDate), annee: nextYear, libelle: nextYear ? s(labels[String(nextYear)]) : '' }
        : null,
    auditInterne: audit && s(state.internalDate) ? s(state.internalDate) : null,
    ecarts,
    echeances,
    plan: plan
      ? {
          statut: s(plan.status),
          jours: arr(plan.days).map((d) => ({
            label: s(d.label),
            date: s(d.date),
            creneaux: slots.filter((x) => s(x.day) === s(d.id)).length,
          })),
        }
      : null,
    mesures,
  };
}
