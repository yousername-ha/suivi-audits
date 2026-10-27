/* Plan d'investissement en tables (ADR 0040) : correspondance entre la clé `invest` de l'état historique
   (`{ baseYear, lines }`) et les tables invest_settings / invest_lines. Les champs non modélisés passent par `extra`
   pour que l'aller-retour ne perde rien ; /legacy et l'export reçoivent la forme historique recomposée. */
import { isObject, type Json, type JsonObject } from '@suivi/shared/legacy';
import { surConnexion, type Client } from '../../db/db.js';
import type { ModuleMapper } from '../../legacy/store.js';

const TEXTES = [
  'company',
  'priority',
  'type',
  'comment',
  'alt',
  'account',
  'perimeter',
  'renewal',
  'supplier',
] as const;
const CHAMPS_MODELISES = new Set<string>(['id', 'desc', 'n0', 'n1', 'n2', 'status', 'nature', 'notice', ...TEXTES]);
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const nombre = (v: unknown) => {
  const n = typeof v === 'string' && v.trim() === '' ? NaN : Number(v);
  return Number.isFinite(n) ? n : 0;
};

interface LigneRow {
  id: string | null;
  company: string;
  priority: string;
  type: string;
  description: string;
  n0: number;
  n1: number;
  n2: number;
  comment: string;
  alt: string;
  account: string;
  perimeter: string;
  status: string;
  nature: string;
  renewal: string;
  notice: number;
  supplier: string;
  extra: JsonObject;
}

async function lireInvest(c: Client): Promise<Json | undefined> {
  const k = surConnexion(c);
  const reglages = await k
    .selectFrom('invest_settings')
    .select(['base_year', 'extra'])
    .where('id', '=', 1)
    .executeTakeFirst();
  if (!reglages) return undefined;
  const lignes = (await k
    .selectFrom('invest_lines')
    .selectAll()
    .orderBy('position')
    .orderBy('seq')
    .execute()) as unknown as LigneRow[];
  return {
    ...(reglages.extra as JsonObject),
    baseYear: reglages.base_year,
    lines: lignes.map((r): Json => {
      if (r.extra.brut !== undefined) return r.extra.brut as Json;
      const o: JsonObject = { ...r.extra };
      if (r.id !== null) o.id = r.id;
      for (const k of TEXTES) o[k] = r[k];
      Object.assign(o, {
        desc: r.description,
        n0: r.n0,
        n1: r.n1,
        n2: r.n2,
        status: r.status,
        nature: r.nature,
        notice: r.notice,
      });
      return o;
    }),
  };
}

/** Remplace le contenu des tables par la valeur de la clé (undefined, null ou objet vide : module vidé). */
export async function ecrireInvest(c: Client, value: Json | undefined): Promise<void> {
  const k = surConnexion(c);
  await k.deleteFrom('invest_lines').execute();
  await k.deleteFrom('invest_settings').execute();
  if (!isObject(value) || !Object.keys(value).length) return;
  const annee = Number(value.baseYear);
  const { baseYear: _b, lines: _l, ...autres } = value;
  await k
    .insertInto('invest_settings')
    .values({
      base_year: Number.isInteger(annee) && annee >= 2000 && annee <= 2200 ? annee : new Date().getFullYear(),
      extra: JSON.stringify(autres),
    })
    .execute();
  const lignes = Array.isArray(value.lines) ? value.lines : [];
  for (const [position, l] of lignes.entries()) {
    if (!isObject(l)) {
      await k
        .insertInto('invest_lines')
        .values({ position, extra: JSON.stringify({ brut: l }) })
        .execute();
      continue;
    }
    const extra = Object.fromEntries(Object.entries(l).filter(([k]) => !CHAMPS_MODELISES.has(k)));
    const notice = Number(l.notice);
    await k
      .insertInto('invest_lines')
      .values({
        position,
        id: 'id' in l ? str(l.id) : null,
        company: str(l.company),
        priority: str(l.priority),
        type: str(l.type),
        description: str(l.desc),
        n0: nombre(l.n0),
        n1: nombre(l.n1),
        n2: nombre(l.n2),
        comment: str(l.comment),
        alt: str(l.alt),
        account: str(l.account),
        perimeter: str(l.perimeter),
        status: str(l.status) || 'À qualifier',
        nature: str(l.nature) || 'Abonnement',
        renewal: str(l.renewal),
        notice: Number.isInteger(notice) && notice >= 0 ? notice : 60,
        supplier: str(l.supplier),
        extra: JSON.stringify(extra),
      })
      .execute();
  }
}

export const investMapper: ModuleMapper = {
  key: 'invest',
  read: lireInvest,
  write: (c, value) => ecrireInvest(c, value),
};
