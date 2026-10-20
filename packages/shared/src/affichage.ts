/* Affichage : préférences par personne (taille, densité, thème, colonnes), écrans muraux, synthèse du tableau de bord
   (calculée à partir de l'état de l'outil historique, déjà filtré selon les droits). */
import { z } from 'zod';
import { conformiteParReferentiel, indicateursSynthese, plansAnnee } from './tableau-de-bord.js';
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
  /** Cartographie (CARTO-06) : vue affichée par carte (zoom, position), filtres et panneaux. */
  cartographie: z
    .object({
      vue: z.enum(['context', 'process']).optional(),
      viewport: z
        .partialRecord(
          z.enum(['context', 'process']),
          z.object({ x: z.number().finite(), y: z.number().finite(), k: z.number().min(0.2).max(2.5) }),
        )
        .optional(),
      referentiels: z.array(z.enum(['ISO 27001', 'HDS', 'ISO 9001'])).optional(),
      secondaires: z.boolean().optional(),
      propositions: z.boolean().optional(),
      panneau: z.boolean().optional(),
    })
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

/* ---------------------------------------------------------------- Synthèse (tableau de bord, écran mural) :
   écarts, actions, récurrences, risques et continuité viennent des fiches de registre (tous les périmètres lisibles, hors
   registres restreints non lisibles) ; mesures, conformité, indicateurs et plans viennent du suivi du SMSI. */
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
      parSource: z.record(z.string(), z.number()),
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
      /** « Écart » ou « Action ». */
      type: z.string(),
      perimetre: z.string(),
    }),
  ),
  plan: z
    .object({
      statut: z.string(),
      jours: z.array(z.object({ label: z.string(), date: z.string(), creneaux: z.number() })),
    })
    .nullable(),
  mesures: z.object({ total: z.number(), parReferentiel: z.record(z.string(), z.number()) }).nullable(),
  /* Tableau de bord unifié (UI-02) : graphiques repris du tableau de bord historique, et compteurs du Pilotage. */
  conformite: z
    .array(
      z.object({
        ref: z.string(),
        libelle: z.string(),
        exigences: z.number(),
        applicables: z.number(),
        total: z.number(),
        partiel: z.number(),
        insuffisant: z.number(),
        nonRenseigne: z.number(),
      }),
    )
    .nullable(),
  ecartsOuverts: z
    .object({
      ouverts: z.number(),
      parType: z.array(z.object({ type: z.string(), libelle: z.string(), n: z.number() })),
      actionsRealisees: z.number(),
      actionsTotal: z.number(),
    })
    .nullable(),
  indicateurs: z
    .object({ total: z.number(), atteints: z.number(), nonAtteints: z.number(), nonMesures: z.number() })
    .nullable(),
  plans: z
    .object({
      annee: z.number(),
      types: z.array(
        z.object({
          type: z.string(),
          libelle: z.string(),
          realises: z.number(),
          aVenir: z.number(),
          enRetard: z.number(),
        }),
      ),
    })
    .nullable(),
  /** Actions autonomes (hors occurrences de tâches récurrentes) : ouvertes, en retard, terminées. */
  actions: z
    .object({ total: z.number(), ouvertes: z.number(), enRetard: z.number(), terminees: z.number() })
    .nullable(),
  /** Tâches récurrentes : séries actives et occurrences ouvertes ou en retard. */
  recurrences: z
    .object({ series: z.number(), occurrencesOuvertes: z.number(), occurrencesEnRetard: z.number() })
    .nullable(),
  /** Risques : total, sans appréciation validée, revue échue. */
  risques: z.object({ total: z.number(), sansDecision: z.number(), revueEchue: z.number() }).nullable(),
  /** Continuité : analyses d'impact (BIA) et plans de continuité. */
  continuite: z.object({ bia: z.number(), plans: z.number() }).nullable(),
  /** Compteurs du Pilotage utilisés par les alertes du menu : constats ouverts, risques, actions en retard. */
  pilotage: z
    .object({
      constatsOuverts: z.number().nullable(),
      risques: z.number().nullable(),
      risquesSansDecision: z.number().nullable(),
      actionsEnRetard: z.number().nullable(),
    })
    .nullable(),
});
export type Synthese = z.infer<typeof Synthese>;

type Obj = Record<string, unknown>;
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Obj[]) : []);
const s = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

/** Synthèse des sections du suivi du SMSI (état déjà filtré selon les droits : un module masqué est vide). Les sections
    issues des fiches de registre (écarts, échéances, actions, récurrences, risques, continuité) sont ajoutées par le serveur. */
export function computeSynthese(
  state: Obj,
  opts: { organisation: string; aujourdHui: Date; lisible: (cle: string) => boolean },
): Synthese {
  const today = opts.aujourdHui.toISOString().slice(0, 10);
  const labels = (state.yearLabels && typeof state.yearLabels === 'object' ? state.yearLabels : {}) as Obj;
  const nextYear = typeof state.nextYear === 'number' ? state.nextYear : null;

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
    ecarts: null,
    echeances: [],
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
    conformite: opts.lisible('items') && opts.lisible('dda') ? conformiteParReferentiel(state) : null,
    ecartsOuverts: null,
    actions: null,
    recurrences: null,
    risques: null,
    continuite: null,
    indicateurs: opts.lisible('indicators') ? indicateursSynthese(state) : null,
    plans: opts.lisible('plans')
      ? { annee: opts.aujourdHui.getFullYear(), types: plansAnnee(state, opts.aujourdHui.getFullYear(), today) }
      : null,
    pilotage: null,
  };
}
