/* Adaptation de lecture uniquement. Le champ édité prime sur les anciennes colonnes ; aucune copie n'est enregistrée. */
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
export interface LienSwot {
  other: { ref: string; name: string; kind: string; archived?: boolean };
}

export function elementsSwot(data: Record<string, unknown>, quadrant: QuadrantSwot): string[] {
  const value = data[quadrant.field] !== undefined ? data[quadrant.field] : data[quadrant.key];
  if (typeof value === 'string')
    return value
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
  if (!Array.isArray(value)) return [];
  return value.flatMap((x) => {
    const text = typeof x === 'string' ? x : x && typeof x === 'object' ? String(x.text ?? x.t ?? x.label ?? '') : '';
    return text.trim() ? [text] : [];
  });
}

export const referenceSwot = (object: GrcObject) =>
  object.id.startsWith('legacy:') ? object.id : `object:${object.id}`;

/** Un lien dans les deux sens est déjà normalisé par l'API. Les doublons fiche/lien ne créent pas deux analyses. */
export function choixSwot(rattaches: readonly Rattache[] | null | undefined, liens: readonly LienSwot[]): ChoixSwot[] {
  const result = new Map<string, ChoixSwot>();
  for (const r of rattaches ?? []) result.set(r.ref, { ref: r.ref, name: r.name });
  for (const l of liens)
    if (l.other.kind === 'swot' && !l.other.archived && !result.has(l.other.ref))
      result.set(l.other.ref, { ref: l.other.ref, name: l.other.name });
  return [...result.values()];
}
