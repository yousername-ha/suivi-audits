/* Registre des types de processus (Plateforme) : pilotage, réalisation, support ou tout type défini par l'organisation.
   Le champ « famille » d'un processus référence le `code` d'un type ; le code ne change jamais après création, le libellé,
   la description, la teinte et le rang se modifient. Les trois types de départ reprennent les valeurs historiques. */
import { z } from 'zod';

export const TEINTES_TYPE_PROCESSUS = ['vert', 'bleu', 'violet', 'orange', 'rouge', 'gris'] as const;
export type TeinteTypeProcessus = (typeof TEINTES_TYPE_PROCESSUS)[number];
export const LIBELLES_TEINTE: Record<TeinteTypeProcessus, string> = {
  vert: 'Vert',
  bleu: 'Bleu',
  violet: 'Violet',
  orange: 'Orange',
  rouge: 'Rouge',
  gris: 'Gris',
};

const libelle = z.string().trim().min(1, 'Libellé obligatoire.').max(80);
export const TypeProcessusBody = z
  .object({
    label: libelle,
    description: z.string().trim().max(500).default(''),
    tint: z.enum(TEINTES_TYPE_PROCESSUS).default('gris'),
  })
  .strict();
export type TypeProcessusBody = z.output<typeof TypeProcessusBody>;
export const TypeProcessusPatch = z
  .object({
    label: libelle,
    description: z.string().trim().max(500),
    tint: z.enum(TEINTES_TYPE_PROCESSUS),
    archived: z.boolean(),
  })
  .partial()
  .strict();
export type TypeProcessusPatch = z.output<typeof TypeProcessusPatch>;
export const OrdreTypesProcessus = z.object({ ids: z.array(z.uuid()).min(1).max(200) }).strict();

export interface TypeProcessusDto {
  id: string;
  /** Valeur du champ « famille » des processus ; immuable. */
  code: string;
  label: string;
  description: string;
  tint: TeinteTypeProcessus;
  rank: number;
  archived: boolean;
  /** Nombre de processus qui portent ce type. */
  usage: number;
}

/** Code d'un nouveau type : le libellé sans accents ni ponctuation, unique parmi les codes existants. */
export function codeDepuisLibelle(label: string, existants: Iterable<string>): string {
  const pris = new Set([...existants].map((c) => c.toLowerCase()));
  const base =
    label
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 50) || 'type';
  let code = base;
  for (let n = 2; pris.has(code.toLowerCase()); n++) code = `${base}_${n}`;
  return code;
}
