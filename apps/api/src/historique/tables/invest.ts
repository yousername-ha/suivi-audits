/* Plan d'investissement en tables (ADR 0040) : correspondance entre la clé `invest` de l'état historique
   (`{ baseYear, lines }`) et les tables invest_settings / invest_lines. Les champs non modélisés passent par `extra`
   pour que l'aller-retour ne perde rien ; /legacy et l'export reçoivent la forme historique recomposée. */
import { isObject, type Json, type JsonObject } from '@suivi/shared/legacy';
import type { Client } from '../../db/db.js';
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
  const reglages = (
    await c.query<{ base_year: number; extra: JsonObject }>('SELECT base_year, extra FROM invest_settings WHERE id=1')
  ).rows[0];
  if (!reglages) return undefined;
  const lignes = (await c.query<LigneRow>('SELECT * FROM invest_lines ORDER BY position, seq')).rows;
  return {
    ...reglages.extra,
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
  await c.query('DELETE FROM invest_lines');
  await c.query('DELETE FROM invest_settings');
  if (!isObject(value) || !Object.keys(value).length) return;
  const annee = Number(value.baseYear);
  const { baseYear: _b, lines: _l, ...autres } = value;
  await c.query('INSERT INTO invest_settings(base_year, extra) VALUES ($1,$2)', [
    Number.isInteger(annee) && annee >= 2000 && annee <= 2200 ? annee : new Date().getFullYear(),
    autres,
  ]);
  const lignes = Array.isArray(value.lines) ? value.lines : [];
  for (const [position, l] of lignes.entries()) {
    if (!isObject(l)) {
      await c.query('INSERT INTO invest_lines(position, extra) VALUES ($1,$2)', [position, { brut: l }]);
      continue;
    }
    const extra = Object.fromEntries(Object.entries(l).filter(([k]) => !CHAMPS_MODELISES.has(k)));
    const notice = Number(l.notice);
    await c.query(
      `INSERT INTO invest_lines(position,id,company,priority,type,description,n0,n1,n2,comment,alt,account,perimeter,
                                status,nature,renewal,notice,supplier,extra)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
      [
        position,
        'id' in l ? str(l.id) : null,
        str(l.company),
        str(l.priority),
        str(l.type),
        str(l.desc),
        nombre(l.n0),
        nombre(l.n1),
        nombre(l.n2),
        str(l.comment),
        str(l.alt),
        str(l.account),
        str(l.perimeter),
        str(l.status) || 'À qualifier',
        str(l.nature) || 'Abonnement',
        str(l.renewal),
        Number.isInteger(notice) && notice >= 0 ? notice : 60,
        str(l.supplier),
        extra,
      ],
    );
  }
}

export const investMapper: ModuleMapper = {
  key: 'invest',
  read: lireInvest,
  write: (c, value) => ecrireInvest(c, value),
};
