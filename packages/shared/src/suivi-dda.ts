/* Déclaration d'applicabilité (reprise des pages « Clauses ISO 27001 », « Annexe A (DdA) » et « HDS (DdA) » de l'outil de
   suivi) : applicabilité et niveau de mise en œuvre des mesures, indicateurs de la page, incohérences (mesure « Total »
   avec un écart ouvert) et filtres, repris à l'identique de l'outil historique (`ddaStats`, `incoh`, `viewConformite`).
   Clé `dda` de l'état historique : `{ [identifiant de mesure]: { app, level, just, risk, actions, docs, url, comment } }`. */
import { z } from 'zod';

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

export const PAGES_DDA = ['ISO', 'A', 'HDS'] as const;
export type ReferenceDda = (typeof PAGES_DDA)[number];
export const LIBELLES_REFERENTIEL_DDA: Record<ReferenceDda, string> = {
  ISO: 'Clauses ISO 27001',
  A: 'Annexe A',
  HDS: 'HDS',
};
export const NIVEAUX_DDA = ['Total', 'Partiel', 'Insuffisant'] as const;
export type NiveauDda = (typeof NIVEAUX_DDA)[number];
export const NIVEAU_DDA: Record<NiveauDda, 'ok' | 'mid' | 'bad'> = { Total: 'ok', Partiel: 'mid', Insuffisant: 'bad' };

export interface MesureDda {
  id: string;
  ref: string;
  num: string;
  title: string;
  refText: string;
}
export interface Dda {
  app: '' | 'oui' | 'non';
  level: string;
  just: string;
  risk: string;
  actions: string;
  docs: string;
  url: string;
  comment: string;
  req: string;
}
export interface EcartDda {
  id: string;
  type: string;
  text: string;
  status: string;
  source: string;
  items: string[];
}
export function lireMesureDda(brut: unknown): MesureDda | null {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null;
  const o = brut as Obj;
  if (!str(o.id)) return null;
  return { id: str(o.id), ref: str(o.ref), num: str(o.num), title: str(o.title), refText: str(o.refText) };
}
export function lireDda(brut: unknown): Dda {
  const o: Obj = brut && typeof brut === 'object' && !Array.isArray(brut) ? (brut as Obj) : {};
  return {
    app: o.app === 'oui' || o.app === 'non' ? o.app : '',
    level: str(o.level),
    just: str(o.just),
    risk: str(o.risk),
    actions: str(o.actions),
    docs: str(o.docs),
    url: str(o.url),
    comment: str(o.comment),
    req: str(o.req),
  };
}
export function lireEcartDda(brut: unknown): EcartDda | null {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null;
  const o = brut as Obj;
  if (!str(o.id)) return null;
  return {
    id: str(o.id),
    type: str(o.type),
    text: str(o.text),
    status: str(o.status),
    source: str(o.source),
    items: Array.isArray(o.items) ? (o.items as unknown[]).map(str) : [],
  };
}

/** Code affiché d'une mesure : A.5.1, HDS 3, 6.1 pour les clauses. */
export const codeMesure = (m: Pick<MesureDda, 'ref' | 'num'>) =>
  m.ref === 'A' ? `A.${m.num}` : m.ref === 'HDS' ? `HDS ${m.num}` : m.num;

const pct = (n: number, d: number) => (d ? Math.round((n * 100) / d) : 0);
export interface StatsDda {
  total: number;
  /** Mesures applicables. */
  app: number;
  /** Mesures exclues. */
  na: number;
  c: Record<NiveauDda | '', number>;
  pct: number;
}
export function statsDda(mesures: readonly MesureDda[], dda: Record<string, Dda>, ref: ReferenceDda): StatsDda {
  const its = mesures.filter((m) => m.ref === ref),
    app = its.filter((m) => (dda[m.id] ?? lireDda(null)).app !== 'non');
  const c: StatsDda['c'] = { Total: 0, Partiel: 0, Insuffisant: 0, '': 0 };
  for (const m of app) {
    const l = dda[m.id]?.level ?? '';
    c[(NIVEAUX_DDA as readonly string[]).includes(l) ? (l as NiveauDda) : '']++;
  }
  return { total: its.length, app: app.length, na: its.length - app.length, c, pct: pct(c.Total, app.length) };
}
/** Écarts ouverts rattachés à une mesure. */
export const ecartsOuvertsMesure = (id: string, ecarts: readonly EcartDda[]) =>
  ecarts.filter((x) => x.status !== 'Clos' && x.items.includes(id));
/** Mesure « Total » (applicable) avec un écart ouvert non conforme ou partiel (hors veille) : incohérence à lever. */
export const incoherente = (m: MesureDda, dda: Record<string, Dda>, ecarts: readonly EcartDda[]) => {
  const d = dda[m.id] ?? lireDda(null);
  return (
    d.app !== 'non' &&
    d.level === 'Total' &&
    ecarts.some(
      (x) => x.status !== 'Clos' && x.source !== 'Veille' && /^(NC|PS)/.test(x.type) && x.items.includes(m.id),
    )
  );
};
export type FiltreDda = 'all' | NiveauDda | 'none' | 'na' | 'inc';
export function filtrerMesures(
  mesures: readonly MesureDda[],
  dda: Record<string, Dda>,
  ecarts: readonly EcartDda[],
  ref: ReferenceDda,
  f: FiltreDda,
): MesureDda[] {
  return mesures
    .filter((m) => m.ref === ref)
    .filter((m) => {
      const d = dda[m.id] ?? lireDda(null);
      if (f === 'all') return true;
      if (f === 'inc') return incoherente(m, dda, ecarts);
      if (f === 'na') return d.app === 'non';
      if (f === 'none') return d.app !== 'non' && !(NIVEAUX_DDA as readonly string[]).includes(d.level);
      return d.app !== 'non' && d.level === f;
    });
}
/** Lien d'ouverture d'un document : adresses web et fichiers, chemins réseau et lecteurs convertis en file:. */
export function lienDocument(u: string): string {
  const v = u.trim();
  if (!v) return '';
  if (/^(https?|file):/i.test(v)) return v;
  if (/^\\\\/.test(v)) return 'file:' + v.replace(/\\/g, '/');
  if (/^[A-Z]:\\/i.test(v)) return 'file:///' + v.replace(/\\/g, '/');
  if (/^www\./i.test(v)) return 'https://' + v;
  return v;
}

const t = (n: number) => z.string().trim().max(n);
const niveau = z.union([z.literal(''), z.enum(NIVEAUX_DDA)]);
export const DdaModification = z
  .object({
    app: z.union([z.literal(''), z.literal('oui'), z.literal('non')]),
    level: niveau,
    just: t(10000),
    risk: t(2000),
    actions: t(10000),
    docs: t(10000),
    url: t(2000),
    comment: t(5000),
    refText: t(50000),
  })
  .partial()
  .strict();
export type DdaModification = z.infer<typeof DdaModification>;
/** Champs modifiables d'une clause ISO : la clause est obligatoire (pas d'applicabilité, de justification ni d'actions). */
export const CHAMPS_CLAUSE_ISO = ['level', 'docs', 'url', 'comment', 'refText'] as const;
