/* Revues des accès des applications (contrôles de la gestion des accès, revue annuelle) : états et prochaine échéance,
   repris à l'identique de l'outil de suivi historique (`arNext`, `arState`). Mois au format AAAA-MM. Rien n'est estimé :
   sans mois de dernière revue, la revue reste « Jamais réalisée ». */
import { z } from 'zod';

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

export interface RevueAcces {
  id: string;
  app: string;
  supplier: string;
  /** Mois de la dernière revue (AAAA-MM) ou vide. */
  month: string;
  /** Périodicité en mois (12 par défaut). */
  freq: number;
  source: string;
  comment: string;
}
export type NiveauRevue = 'ok' | 'mid' | 'bad';

export function lireRevueAcces(brut: unknown): RevueAcces | null {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null;
  const o = brut as Obj;
  if (!str(o.id)) return null;
  const f = Number(o.freq);
  return {
    id: str(o.id),
    app: str(o.app),
    supplier: str(o.supplier),
    month: /^\d{4}-\d{2}$/.test(str(o.month)) ? str(o.month) : '',
    freq: Number.isFinite(f) && f > 0 ? f : 12,
    source: str(o.source),
    comment: str(o.comment),
  };
}

const MOIS_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];
/** Mois ajouté à un mois AAAA-MM : renvoie [année, mois 0-11]. */
const decaler = (annee: number, mois0: number, n: number): [number, number] => {
  const t = annee * 12 + mois0 + n;
  return [Math.floor(t / 12), ((t % 12) + 12) % 12];
};
const cle = (a: number, m0: number) => a * 12 + m0;

/** Prochaine revue : mois de la dernière revue + périodicité (premier jour du mois), ou `null` sans dernière revue. */
export function revueSuivante(
  r: Pick<RevueAcces, 'month' | 'freq'>,
): { annee: number; mois: number; libelle: string } | null {
  if (!r.month) return null;
  const [y, m] = r.month.split('-').map(Number) as [number, number];
  const [annee, mois] = decaler(y, m - 1, r.freq || 12);
  return { annee, mois, libelle: `${MOIS_FR[mois]} ${annee}` };
}
/** État : jamais réalisée, en retard (échéance avant le mois courant), à planifier (sous deux mois), à jour. */
export function revueEtat(
  r: Pick<RevueAcces, 'month' | 'freq'>,
  aujourdhui: string,
): [libelle: string, niveau: NiveauRevue] {
  const n = revueSuivante(r);
  if (!n) return ['Jamais réalisée', 'bad'];
  const [y, m] = aujourdhui.split('-').map(Number) as [number, number];
  const courant = cle(y, m - 1),
    echeance = cle(n.annee, n.mois);
  if (echeance < courant) return ['En retard', 'bad'];
  if (echeance <= courant + 2) return ['À planifier', 'mid'];
  return ['À jour', 'ok'];
}
export interface SyntheseRevues {
  total: number;
  aJour: number;
  jamais: number;
  enRetard: number;
  aPlanifier: number;
}
export function revuesSynthese(revues: readonly RevueAcces[], aujourdhui: string): SyntheseRevues {
  const etats = revues.map((r) => revueEtat(r, aujourdhui)[0]);
  const n = (l: string) => etats.filter((e) => e === l).length;
  return {
    total: revues.length,
    aJour: n('À jour'),
    jamais: n('Jamais réalisée'),
    enRetard: n('En retard'),
    aPlanifier: n('À planifier'),
  };
}
/** Identifiant d'une nouvelle revue : CONTROL-n, premier numéro supérieur à tous les numéros existants. */
export function identifiantRevue(existants: readonly string[]): string {
  const max = existants.reduce((m, id) => Math.max(m, Number(/^CONTROL-(\d+)$/.exec(id)?.[1] ?? 0)), 0);
  return `CONTROL-${Math.max(max, existants.length) + 1}`;
}

const mois = z.union([z.literal(''), z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Mois invalide (AAAA-MM).')]);
export const RevueAccesModification = z
  .object({
    app: z.string().trim().min(1).max(200),
    supplier: z.string().trim().max(200),
    month: mois,
    freq: z.number().int().min(1).max(120),
    source: z.string().trim().max(500),
    comment: z.string().trim().max(5000),
  })
  .partial()
  .strict();
export type RevueAccesModification = z.infer<typeof RevueAccesModification>;
