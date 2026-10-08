/* Schémas zod de la cartographie (CARTO-03, CARTO-04) : disposition d'une carte, réglages, échanges avec l'API. */
import { z } from 'zod';
import { GENERATE_MAX } from './edit.js';
import { MAP_VIEWS, OBJECT_TYPES, REFERENTIELS, RELATION_TYPES } from './model.js';

/** Bornes de la disposition. Une bande de 400 processus générée mesure plus de 100 000 px : la taille maximale
 *  est 200 000 px (au lieu de 6 000 dans la spécification), les coordonnées restent finies et bornées. */
export const LAYOUT_LIMITS = { nodes: GENERATE_MAX, minSize: 40, maxSize: 200000, coord: 1e6, edges: 2000 } as const;

// Référence : préfixe connu, puis 1 à 200 caractères imprimables (aucun caractère de contrôle, pas d'espace en tête).
const REF_RE = /^(isms|scope|(process|pi|sup|app|issue|site|infra|lane|band|zone):\S[^\p{Cc}]{0,199})$/u;
export const ObjectRef = z.string().max(220).regex(REF_RE, 'Référence d’objet invalide.');
const coord = z.number().finite().min(-LAYOUT_LIMITS.coord).max(LAYOUT_LIMITS.coord);
const size = z.number().finite().min(LAYOUT_LIMITS.minSize).max(LAYOUT_LIMITS.maxSize);

export const MapNodeSchema = z.object({
  x: coord,
  y: coord,
  w: size,
  h: size,
  label: z.string().max(300),
  hidden: z.boolean().optional(),
});
export const MapEdgeSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, 'Identifiant de relation invalide.'),
  s: ObjectRef,
  t: ObjectRef,
  type: z.enum(RELATION_TYPES),
  gen: z.boolean().optional(),
});
const keyRecord = (key: z.ZodString, max: number) =>
  z
    .record(key, z.literal(1))
    .refine((r) => Object.keys(r).length <= max, `Au plus ${max} entrées.`)
    .default({});

/** Disposition d'une carte (présentation seule : jamais de donnée métier). */
export const MapLayoutSchema = z
  .object({
    nodes: z
      .record(ObjectRef, MapNodeSchema)
      .refine((n) => Object.keys(n).length <= LAYOUT_LIMITS.nodes, `Au plus ${LAYOUT_LIMITS.nodes} objets par carte.`),
    edges: z.array(MapEdgeSchema).max(LAYOUT_LIMITS.edges).default([]),
    hide: keyRecord(z.string().max(500).regex(/^d:/), 2000),
    ignored: keyRecord(ObjectRef, 5000),
  })
  .superRefine((l, ctx) => {
    const ids = new Set<string>();
    l.edges.forEach((e, i) => {
      if (!l.nodes[e.s] || !l.nodes[e.t])
        ctx.addIssue({ code: 'custom', path: ['edges', i], message: 'Relation vers un objet absent de la carte.' });
      if (e.s === e.t)
        ctx.addIssue({ code: 'custom', path: ['edges', i], message: 'Relation d’un objet vers lui-même.' });
      if (ids.has(e.id))
        ctx.addIssue({ code: 'custom', path: ['edges', i], message: 'Identifiant de relation en double.' });
      ids.add(e.id);
    });
  });
export type MapLayoutInput = z.input<typeof MapLayoutSchema>;

/** Réglages d'une carte : nature des enjeux corrigée à la main (CARTO-12, carte de contexte). */
export const MapSettingsSchema = z.object({
  issueKind: z
    .record(z.string().regex(/^issue:[a-z0-9]{1,16}$/), z.enum(['ext', 'int']))
    .refine((r) => Object.keys(r).length <= 2000, 'Trop d’entrées.')
    .optional(),
});
export type MapSettings = z.infer<typeof MapSettingsSchema>;

export const MapViewSchema = z.enum(MAP_VIEWS);
const name = z.string().trim().min(1, 'Nom obligatoire.').max(120);

/* ---------------------------------------------------------------- API */
export const MapCreateBody = z.object({ view: MapViewSchema, name: name.optional(), layout: MapLayoutSchema });
export const MapSaveBody = z.object({
  layout: MapLayoutSchema,
  name: name.optional(),
  /** Écraser une version plus récente (après un 412) : journalisé. */
  overwrite: z.boolean().optional(),
});
export const VersionCreateBody = z.object({ label: z.string().trim().max(120).default('') });
export const IssueKindBody = z.object({
  ref: z.string().regex(/^issue:[a-z0-9]{1,16}$/, 'Référence d’enjeu invalide.'),
  /** null : revenir à la nature déduite. */
  kind: z.enum(['ext', 'int']).nullable(),
});
export const ExportBody = z.object({ view: MapViewSchema, format: z.enum(['png', 'svg', 'pdf', 'json']) });

const Person = z.object({ id: z.string(), name: z.string() }).nullable();
export const MapOut = z.object({
  id: z.string(),
  view: MapViewSchema,
  name: z.string(),
  layout: MapLayoutSchema,
  settings: MapSettingsSchema,
  version: z.number(),
  created_at: z.string(),
  created_by: Person,
  updated_at: z.string(),
  updated_by: Person,
  versions: z.number(),
});
export type MapOut = z.infer<typeof MapOut>;
export const MapVersionOut = z.object({
  id: z.string(),
  label: z.string(),
  created_at: z.string(),
  created_by: Person,
  nodes: z.number(),
});
export type MapVersionOut = z.infer<typeof MapVersionOut>;
export const MapVersionDetailOut = MapVersionOut.extend({ layout: MapLayoutSchema });

const IssueSourceSchema = z.object({
  k: z.enum(['obj', 'swot']),
  id: z.string(),
  l: z.string(),
  proc: z.string().optional(),
  q: z.enum(['S', 'W', 'O', 'T']).optional(),
});
export const CartoObjectSchema = z.object({
  ref: z.string(),
  type: z.enum(OBJECT_TYPES),
  name: z.string(),
  sub: z.string().optional(),
  code: z.string().optional(),
  owner: z.string().optional(),
  family: z.string().optional(),
  parent: z.string().optional(),
  scope: z.enum(['in', 'out', 'unk']).optional(),
  scopeLabel: z.string().optional(),
  std: z.array(z.enum(REFERENTIELS)),
  ic: z.string().optional(),
  nObj: z.number().optional(),
  nInd: z.number().optional(),
  nKo: z.number().optional(),
  ext: z.boolean().optional(),
  crit: z.boolean().optional(),
  hds: z.boolean().optional(),
  saas: z.boolean().optional(),
  supRef: z.string().optional(),
  src: z.array(IssueSourceSchema).optional(),
  procs: z.array(z.string()).optional(),
  auto: z.enum(['ext', 'int']).optional(),
  scDef: z.boolean().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export const ObjectsOut = z.object({
  organisation: z.string(),
  objects: z.array(CartoObjectSchema),
  /** Modules dont les objets ne sont pas envoyés faute de droit de lecture (« Objet non accessible »). */
  hiddenModules: z.array(z.string()),
});
export type ObjectsOut = z.infer<typeof ObjectsOut>;
