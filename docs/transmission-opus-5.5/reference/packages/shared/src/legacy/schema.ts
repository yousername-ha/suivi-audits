/* Schéma zod du format legacy (schémas 14 et 15), brut ou en enveloppe d'export.
   Les objets sont « ouverts » (looseObject) : un champ inconnu n'est pas une erreur, il est signalé dans le rapport
   d'import (voir paths.unknownPaths) et conservé. Les types suivent LEGACY-FORMAT.md. */
import { z } from 'zod';
import { schema15Problems } from './schema15.js';
import type { Json, JsonObject } from './paths.js';

export const MIN_SCHEMA = 14;
export const MAX_SCHEMA = 15;
export const ENVELOPE_FORMAT = 'suivi-audits-legacy';
export const ENVELOPE_VERSION = 1;

const str = z.string();
const optStr = z.string().optional();
const num = z.number();
const numOrStr = z.union([z.number(), z.string()]);
const bool = z.boolean();
const strList = z.array(z.string());
const loose = z.looseObject;
const idObj = (shape: z.ZodRawShape = {}) => loose({ id: str, ...shape });

const Item = idObj({
  ref: str,
  num: str,
  title: str,
  group: optStr,
  depth: num.optional(),
  afnor: z.record(z.string(), z.string()).optional(),
  interne: z.record(z.string(), z.string()).optional(),
  prep: optStr,
  owner: optStr,
  notes: optStr,
  remInterne: optStr,
  remAfnor: optStr,
});
const Task = loose({ id: optStr, t: str, done: bool });
const Finding = idObj({
  source: optStr,
  year: num.optional(),
  type: optStr,
  status: optStr,
  text: optStr,
  desc: optStr,
  action: optStr,
  tasks: z.array(Task).optional(),
  comment: optStr,
  items: strList.optional(),
  owner: optStr,
  due: optStr,
  proof: optStr,
});
const Dda = loose({
  app: optStr,
  just: optStr,
  risk: optStr,
  level: optStr,
  actions: optStr,
  docs: optStr,
  comment: optStr,
  obj: optStr,
  req: optStr,
  url: optStr,
});
const Indicator = idObj({
  name: optStr,
  obj: optStr,
  target: numOrStr.optional(),
  values: z.array(loose({ id: optStr, date: optStr, v: numOrStr.optional(), note: optStr, hist: optStr })).optional(),
  auto: bool.optional(),
});
const Supplier = idObj({
  name: optStr,
  saas: bool.optional(),
  controls: z.array(idObj({ t: optStr, freq: num.optional() })).optional(),
  certs: z.array(z.unknown()).optional(),
});
const Role = loose({ id: optStr, name: optStr });

export const LegacyStateSchema = loose({
  v: num.optional(),
  updatedAt: num.optional(),
  schema: z.number().int(),
  years: z.array(num),
  yearLabels: z.record(z.string(), z.string()).optional(),
  nextYear: num.optional(),
  nextDate: optStr,
  internalDate: optStr,
  groups: z.array(idObj({ ref: str, num: str, title: str })),
  items: z.array(Item),
  findings: z.array(Finding).optional(),
  source: optStr,
  closeDeadline: optStr,
  findingsRev: num.optional(),
  dda: z.record(z.string(), Dda).optional(),
  processes: z.array(idObj({ name: optStr, owner: optStr, family: optStr, parent: optStr })).optional(),
  objectives: z.array(idObj({ name: optStr, processes: strList.optional(), enjeux: strList.optional() })).optional(),
  indicators: z.array(Indicator).optional(),
  suppliers: z.array(Supplier).optional(),
  frameworks: z.array(idObj({ name: optStr, requirements: z.array(idObj()).optional() })).optional(),
  ai: loose({
    register: z.array(idObj()).optional(),
    evals: z.array(idObj()).optional(),
    plan: z.array(loose({ id: optStr, step: num.optional() })).optional(),
    policies: z.array(loose({ id: optStr })).optional(),
    sources: z.array(idObj()).optional(),
    startValidated: bool.optional(),
  }).optional(),
  activeFw: optStr,
  entityCategory: optStr,
  iso27001Certified: bool.optional(),
  accessReviews: z.array(idObj({ freq: num.optional() })).optional(),
  plan: loose({
    status: optStr,
    note: optStr,
    days: z.array(idObj({ label: optStr, date: optStr })).optional(),
    slots: z
      .array(
        idObj({
          day: optStr,
          items: strList.optional(),
          people: strList.optional(),
          proofs: z.array(loose({ id: optStr, t: optStr, done: bool.optional() })).optional(),
          questions: strList.optional(),
        }),
      )
      .optional(),
    people: z.array(idObj({ name: optStr, role: optStr })).optional(),
  }).optional(),
  appGaps: z.array(idObj()).optional(),
  reviews: z.array(idObj()).optional(),
  branding: loose({}).optional(),
  plans: z.array(z.unknown()).optional(),
  scope: loose({}).optional(),
  interested: z.array(z.unknown()).optional(),
  swots: z.array(idObj()).optional(),
  incidents: z.array(z.unknown()).optional(),
  supEvals: z.array(z.unknown()).optional(),
  crisis: loose({
    contacts: z.array(z.unknown()).optional(),
    scenarios: z.array(z.unknown()).optional(),
    cells: z.array(idObj({ log: z.array(loose({ id: optStr, ts: optStr })).optional() })).optional(),
  }).optional(),
  roles: z.array(Role).optional(),
  recurring: z.array(z.unknown()).optional(),
  evidences: z.array(z.unknown()).optional(),
  invest: loose({ baseYear: num.optional(), lines: z.array(idObj()).optional() }).optional(),
  crrc: loose({}).optional(),
});

export const EnvelopeSchema = z.object({
  format: z.literal(ENVELOPE_FORMAT),
  formatVersion: z.literal(ENVELOPE_VERSION),
  schema: z.number().int(),
  exportedAt: z.string(),
  appVersion: z.string(),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  data: z.record(z.string(), z.unknown()),
});
export type LegacyEnvelope = Omit<z.infer<typeof EnvelopeSchema>, 'data'> & { data: JsonObject };

export class LegacyFileError extends Error {
  constructor(
    message: string,
    readonly details: string[] = [],
  ) {
    super(message);
    this.name = 'LegacyFileError';
  }
}

export interface ReadLegacyResult {
  data: JsonObject;
  schema: number;
  envelope: Omit<LegacyEnvelope, 'data'> | null;
}

const issuesToText = (e: z.ZodError) =>
  e.issues
    .slice(0, 50)
    .map((i) => `$${i.path.map((p) => (typeof p === 'number' ? `[${p}]` : `.${String(p)}`)).join('')} : ${i.message}`);

/** Lit un fichier legacy (objet déjà désérialisé) : enveloppe ou format brut, schéma 14 ou 15.
    sha256 : fonction d'empreinte (fournie par l'appelant) pour vérifier l'intégrité d'une enveloppe. */
export function readLegacyFile(raw: unknown, sha256?: (s: string) => string): ReadLegacyResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new LegacyFileError("Le fichier n'est pas une sauvegarde de l'outil de suivi (objet JSON attendu).");
  }
  let data: unknown = raw;
  let envelope: ReadLegacyResult['envelope'] = null;
  const r = raw as Record<string, unknown>;
  if ('format' in r) {
    const env = EnvelopeSchema.safeParse(raw);
    if (!env.success) throw new LegacyFileError("Enveloppe d'export invalide.", issuesToText(env.error));
    const { data: d, ...meta } = env.data;
    if (sha256 && sha256(JSON.stringify(d)) !== meta.sha256) {
      throw new LegacyFileError(
        "L'empreinte SHA-256 de l'enveloppe ne correspond pas aux données : fichier modifié ou incomplet.",
      );
    }
    data = d;
    envelope = meta;
  }
  const schema = (data as Record<string, unknown>).schema;
  if (typeof schema !== 'number' || schema < MIN_SCHEMA) {
    throw new LegacyFileError(
      `Ce fichier est au schéma ${typeof schema === 'number' ? schema : 'inconnu (antérieur à 14)'}, trop ancien pour être importé. ` +
        "Ouvrez ce fichier dans l'outil legacy, puis réexportez-le.",
    );
  }
  if (schema > MAX_SCHEMA) {
    throw new LegacyFileError(
      `Ce fichier est au schéma ${schema}, plus récent que cette version de l'application (schéma ${MAX_SCHEMA} au plus). Mettez l'application à jour.`,
    );
  }
  if (envelope && envelope.schema !== schema) {
    throw new LegacyFileError(
      `Incohérence : l'enveloppe annonce le schéma ${envelope.schema}, les données sont au schéma ${schema}.`,
    );
  }
  const parsed = LegacyStateSchema.safeParse(data);
  if (!parsed.success) throw new LegacyFileError('Structure de données inattendue.', issuesToText(parsed.error));
  if (schema >= 15) {
    const p = schema15Problems(data as Json);
    if (p.length) throw new LegacyFileError('Identifiants du schéma 15 manquants ou en double.', p.slice(0, 50));
  }
  return { data: data as JsonObject, schema, envelope };
}
