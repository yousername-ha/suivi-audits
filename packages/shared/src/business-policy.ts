import { z } from 'zod';
const key = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,39}$/)
  .refine((x) => !['constructor', 'prototype', '__proto__'].includes(x));
const named = z.object({ id: key, label: z.string().trim().min(1).max(120) }).strict();
const catalogue = z
  .array(named)
  .min(1)
  .max(100)
  .refine((a) => new Set(a.map((x) => x.id)).size === a.length, 'Identifiants uniques requis.');
export const BUSINESS_CATALOGUES = [
  'actionCategories',
  'measureCategories',
  'proofCategories',
  'controlTypes',
  'frequencies',
  'riskDomains',
] as const;
export const BusinessPolicy = z
  .object({
    name: z.string().trim().min(1).max(120),
    statuses: z
      .array(named.extend({ terminal: z.boolean(), color: z.string().regex(/^#[a-fA-F0-9]{6}$/) }))
      .min(2)
      .max(20),
    transitions: z.array(z.object({ from: key, to: key }).strict()).max(200),
    catalogues: z
      .object(
        Object.fromEntries(BUSINESS_CATALOGUES.map((k) => [k, catalogue])) as Record<
          (typeof BUSINESS_CATALOGUES)[number],
          typeof catalogue
        >,
      )
      .strict(),
    dashboard: z
      .object({
        cards: z.array(z.enum(['tasks', 'risks', 'frameworks', 'controls', 'evidence'])).max(5),
        showOverdue: z.boolean(),
        showUnvalidated: z.boolean(),
      })
      .strict(),
    notifications: z
      .object({
        enabled: z.boolean(),
        leadDays: z.number().int().min(0).max(365),
        title: z.string().min(1).max(120),
        message: z.string().min(1).max(1000),
      })
      .strict(),
    templates: z.array(named.extend({ category: key, text: z.string().max(10000) })).max(100),
    display: z
      .object({
        defaultTaskView: z.enum(['kanban', 'list', 'calendar', 'gantt', 'dashboard']),
        weekStartsOn: z.union([z.literal(0), z.literal(1)]),
        showClosed: z.boolean(),
      })
      .strict(),
  })
  .strict()
  .superRefine((p, c) => {
    const ids = new Set(p.statuses.map((s) => s.id));
    if (ids.size !== p.statuses.length || !p.statuses.some((s) => s.terminal) || p.statuses[0]?.terminal)
      c.addIssue({
        code: 'custom',
        message: 'Statuts uniques, premier état ouvert et au moins un état terminal requis.',
      });
    if (
      p.transitions.some((t) => !ids.has(t.from) || !ids.has(t.to) || t.from === t.to) ||
      new Set(p.transitions.map((t) => t.from + '/' + t.to)).size !== p.transitions.length
    )
      c.addIssue({ code: 'custom', message: 'Transitions inconnues ou dupliquées.' });
    if (new Set(p.dashboard.cards).size !== p.dashboard.cards.length)
      c.addIssue({ code: 'custom', message: 'Cartes de pilotage dupliquées.' });
  });
export type BusinessPolicy = z.infer<typeof BusinessPolicy>;
export function businessDefaults(): BusinessPolicy {
  return {
    name: 'Organisation — nomenclatures métier',
    statuses: [
      { id: 'todo', label: 'À faire', terminal: false, color: '#718975' },
      { id: 'progress', label: 'En cours', terminal: false, color: '#637D90' },
      { id: 'blocked', label: 'Bloquée', terminal: false, color: '#A18A65' },
      { id: 'done', label: 'Terminée', terminal: true, color: '#527E63' },
      { id: 'cancelled', label: 'Annulée', terminal: true, color: '#858B85' },
    ],
    transitions: [
      { from: 'todo', to: 'progress' },
      { from: 'todo', to: 'cancelled' },
      { from: 'progress', to: 'blocked' },
      { from: 'progress', to: 'done' },
      { from: 'progress', to: 'cancelled' },
      { from: 'blocked', to: 'progress' },
      { from: 'done', to: 'progress' },
    ],
    catalogues: {
      actionCategories: [{ id: 'action', label: 'Action SMSI' }],
      measureCategories: [{ id: 'security', label: 'Sécurité' }],
      proofCategories: [
        { id: 'document', label: 'Document' },
        { id: 'record', label: 'Enregistrement' },
      ],
      controlTypes: [
        { id: 'review', label: 'Revue' },
        { id: 'test', label: 'Test' },
      ],
      frequencies: [
        { id: 'monthly', label: 'Mensuelle' },
        { id: 'quarterly', label: 'Trimestrielle' },
        { id: 'yearly', label: 'Annuelle' },
      ],
      riskDomains: [{ id: 'information', label: 'Sécurité de l’information' }],
    },
    dashboard: {
      cards: ['tasks', 'risks', 'frameworks', 'controls', 'evidence'],
      showOverdue: true,
      showUnvalidated: true,
    },
    notifications: {
      enabled: true,
      leadDays: 7,
      title: 'Échéance SMSI',
      message: 'Une action vous est attribuée. Consultez sa fiche pour connaître son échéance et ses liens.',
    },
    templates: [
      {
        id: 'review',
        label: 'Revue périodique',
        category: 'action',
        text: 'Décrire le contrôle réalisé et joindre ses justificatifs.',
      },
    ],
    display: { defaultTaskView: 'list', weekStartsOn: 1, showClosed: false },
  };
}
