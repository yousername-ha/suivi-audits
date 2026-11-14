/* Matrice SWOT Studio (refonte Neon, lot 5) : adaptation de lecture uniquement. Les champs édités de la fiche priment sur
   les anciennes colonnes historiques (S, W, O, T) ; rien n'est recopié ni enregistré. Aucun processus, lien ou élément n'est
   fabriqué pour compléter la présentation. */
import type { GrcObject, Rattache } from '@suivi/shared';

export const QUADRANTS_SWOT = [
  { key: 'S', field: 'strengths', label: 'Forces', nature: 'Interne', angle: 'Favorable', sign: '+', icon: 'bolt' },
  {
    key: 'W',
    field: 'weaknesses',
    label: 'Faiblesses',
    nature: 'Interne',
    angle: 'Défavorable',
    sign: '−',
    icon: 'adjust',
  },
  {
    key: 'O',
    field: 'opportunities',
    label: 'Opportunités',
    nature: 'Externe',
    angle: 'Favorable',
    sign: '+',
    icon: 'compass',
  },
  { key: 'T', field: 'threats', label: 'Menaces', nature: 'Externe', angle: 'Défavorable', sign: '−', icon: 'warning' },
] as const;
export type QuadrantSwot = (typeof QUADRANTS_SWOT)[number];

export interface ChoixSwot {
  ref: string;
  name: string;
}
/** Relation renvoyée par `GET /api/grc/:smsi/links` (champs lus par la matrice). */
export interface LienSwot {
  other: { ref: string; name: string; kind: string; archived?: boolean };
}

/** Éléments d'un quadrant : une ligne par élément (texte saisi) ou les éléments d'une liste historique. Un champ édité
    vide ou effacé masque l'ancienne colonne : il ne réaffiche jamais une valeur retirée. */
export function elementsSwot(data: Record<string, unknown>, quadrant: QuadrantSwot): string[] {
  const value = data[quadrant.field] !== undefined ? data[quadrant.field] : data[quadrant.key];
  if (typeof value === 'string')
    return value
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
  if (!Array.isArray(value)) return [];
  return value.flatMap((x: unknown) => {
    const o = x && typeof x === 'object' ? (x as Record<string, unknown>) : null;
    const text = typeof x === 'string' ? x : o ? String(o.text ?? o.t ?? o.label ?? '') : '';
    return text.trim() ? [text] : [];
  });
}

/** Référence transverse d'une analyse : `legacy:swots:<id>` (registre historique) ou `object:<id>` (fiche du Pilotage). */
export const referenceSwot = (object: Pick<GrcObject, 'id'>) =>
  object.id.startsWith('legacy:') ? object.id : `object:${object.id}`;

/** Les analyses du registre historique relèvent du pilotage commun : l'API ne les sert pas sous un autre périmètre. */
export const analyseLisible = (ref: string, perimetreCommun: boolean) => perimetreCommun || !ref.startsWith('legacy:');

/** Analyses d'un processus : rattachements de la carte (champ de la fiche ou lien) puis relations transverses, dans les deux
    sens (déjà normalisées par l'API). Une même analyse n'apparaît qu'une fois ; les autres relations et les analyses
    archivées sont écartées, comme les analyses historiques hors du pilotage commun. */
export function choixSwot(
  rattaches: readonly Rattache[] | null | undefined,
  liens: readonly LienSwot[],
  perimetreCommun = true,
): ChoixSwot[] {
  const result = new Map<string, ChoixSwot>();
  for (const r of rattaches ?? [])
    if (analyseLisible(r.ref, perimetreCommun) && !result.has(r.ref)) result.set(r.ref, { ref: r.ref, name: r.name });
  for (const l of liens)
    if (
      l.other.kind === 'swot' &&
      !l.other.archived &&
      analyseLisible(l.other.ref, perimetreCommun) &&
      !result.has(l.other.ref)
    )
      result.set(l.other.ref, { ref: l.other.ref, name: l.other.name });
  return [...result.values()];
}

/** Repère court d'un processus : son identifiant métier (PR2…), jamais un identifiant technique illisible. */
export const codeProcessus = (id: string) => (id.length <= 12 ? id : 'Processus');

/** Date ISO (aaaa-mm-jj…) en jj/mm/aaaa ; vide si absente. */
export const dateSwot = (v: unknown) =>
  typeof v === 'string' && v ? v.slice(0, 10).split('-').reverse().join('/') : '';

/** Ligne d'information de l'analyse : date et version de l'analyse, sinon version de la fiche. */
export function metaAnalyse(object: Pick<GrcObject, 'data' | 'version'>) {
  return [
    dateSwot(object.data.date),
    object.data.version !== undefined && object.data.version !== null && object.data.version !== ''
      ? `Version ${String(object.data.version)}`
      : `Fiche version ${object.version}`,
  ]
    .filter(Boolean)
    .join(' / ');
}

/** Processus affiché sans choix explicite : le premier qui a une analyse rattachée, sinon le premier de la liste. */
export function processusParDefaut<P extends { rattaches?: readonly unknown[] | null }>(
  processus: readonly P[],
): P | undefined {
  return processus.find((p) => p.rattaches?.length) ?? processus[0];
}
