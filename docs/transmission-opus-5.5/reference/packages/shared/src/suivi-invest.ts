/* Plan d'investissement (reprise de la page « Investissements » de l'outil de suivi) : lignes budgétaires sur trois ans
   (N, N+1, N+2), statut, périmètre, renouvellements et comparaison des options. Calculs repris à l'identique de l'outil
   historique (`invTot`, `invLive`, `invRenewals`, vues tableau de bord, renouvellements et comparaison). Dates AAAA-MM-JJ. */
import { z } from 'zod';

type Obj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));
const nombre = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const STATUTS_INVEST = ['À qualifier', 'Prévisionnel', 'Validé', 'En place', 'Annulé'] as const;
export const NATURES_INVEST = [
  'Abonnement',
  'Licence perpétuelle',
  'Maintenance',
  'Prestation',
  'Matériel',
  'Autre',
] as const;
export const PRIORITES_INVEST = ['', '1', '2', '3', '4', '5'] as const;

export interface LigneInvest {
  id: string;
  company: string;
  priority: string;
  type: string;
  desc: string;
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
}

export function lireLigneInvest(brut: unknown): LigneInvest | null {
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null;
  const o = brut as Obj;
  if (!str(o.id)) return null;
  return {
    id: str(o.id),
    company: str(o.company),
    priority: str(o.priority),
    type: str(o.type),
    desc: str(o.desc),
    n0: nombre(o.n0),
    n1: nombre(o.n1),
    n2: nombre(o.n2),
    comment: str(o.comment),
    alt: str(o.alt),
    account: str(o.account),
    perimeter: str(o.perimeter),
    status: str(o.status) || 'À qualifier',
    nature: str(o.nature) || 'Abonnement',
    renewal: /^\d{4}-\d{2}-\d{2}$/.test(str(o.renewal)) ? str(o.renewal) : '',
    notice: o.notice === undefined || o.notice === '' ? 60 : nombre(o.notice),
    supplier: str(o.supplier),
  };
}

export const totalInvest = (l: Pick<LigneInvest, 'n0' | 'n1' | 'n2'>) => l.n0 + l.n1 + l.n2;
export const ligneVivante = (l: Pick<LigneInvest, 'status'>) => l.status !== 'Annulé';

/** Identifiant d'une nouvelle ligne : INV-nnn, premier numéro libre. */
export function identifiantInvest(existants: readonly string[]): string {
  let k = 1;
  while (existants.includes('INV-' + String(k).padStart(3, '0'))) k++;
  return 'INV-' + String(k).padStart(3, '0');
}

const JOUR = 864e5;
const enMs = (d: string) => Date.parse(d + 'T00:00:00Z');
const enJour = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Lignes non annulées dont le renouvellement tombe dans les `jours` à venir (échéances dépassées comprises), par date. */
export function renouvellements(lignes: readonly LigneInvest[], jours: number, aujourdhui: string): LigneInvest[] {
  const limite = enJour(enMs(aujourdhui) + jours * JOUR);
  return lignes
    .filter((l) => ligneVivante(l) && l.renewal && l.renewal <= limite)
    .sort((a, b) => a.renewal.localeCompare(b.renewal));
}
export type NiveauInvest = 'ok' | 'mid' | 'bad' | 'na';
/** État d'un renouvellement : échu, à anticiper (le préavis est atteint), à venir ou non renseigné. */
export function etatRenouvellement(
  l: Pick<LigneInvest, 'renewal' | 'notice'>,
  aujourdhui: string,
): [libelle: string, niveau: NiveauInvest] {
  if (!l.renewal) return ['Non renseigné', 'na'];
  if (l.renewal < aujourdhui) return ['Échu', 'bad'];
  if (enJour(enMs(l.renewal) - (l.notice || 60) * JOUR) <= aujourdhui) return ['À anticiper', 'mid'];
  return ['À venir', 'ok'];
}
export type NiveauStatutInvest = 'ok' | 'info' | 'mid' | 'na';
export const niveauStatutInvest = (s: string): NiveauStatutInvest =>
  s === 'En place' ? 'ok' : s === 'Validé' ? 'info' : s === 'Prévisionnel' ? 'mid' : 'na';

/** Tri de la liste des lignes : priorité (sans priorité en dernier), puis coût sur trois ans décroissant. */
export function trierLignesInvest(lignes: readonly LigneInvest[]): LigneInvest[] {
  return [...lignes].sort(
    (a, b) => (Number(a.priority) || 9) - (Number(b.priority) || 9) || totalInvest(b) - totalInvest(a),
  );
}
export interface SyntheseInvest {
  budgetN: number;
  budgetNEnPlace: number;
  total3ans: number;
  previsionnels: { nombre: number; total: number };
  /** Budget de chaque année par statut : en place, validé, prévisionnel (y compris à qualifier). */
  parAnnee: { cle: 'n0' | 'n1' | 'n2'; annee: number; enPlace: number; valide: number; previsionnel: number }[];
  parPerimetre: { libelle: string; valeur: number }[];
  principales: LigneInvest[];
}
export function syntheseInvest(lignes: readonly LigneInvest[], anneeN: number): SyntheseInvest {
  const vivantes = lignes.filter(ligneVivante);
  const somme = (cle: 'n0' | 'n1' | 'n2', f: (l: LigneInvest) => boolean = () => true) =>
    vivantes.filter(f).reduce((a, l) => a + l[cle], 0);
  const prev = vivantes.filter((l) => ['Prévisionnel', 'Validé', 'À qualifier'].includes(l.status));
  const par = new Map<string, number>();
  for (const l of vivantes)
    par.set(l.perimeter || 'Non renseigné', (par.get(l.perimeter || 'Non renseigné') ?? 0) + totalInvest(l));
  return {
    budgetN: somme('n0'),
    budgetNEnPlace: somme('n0', (l) => l.status === 'En place'),
    total3ans: vivantes.reduce((a, l) => a + totalInvest(l), 0),
    previsionnels: { nombre: prev.length, total: prev.reduce((a, l) => a + totalInvest(l), 0) },
    parAnnee: (['n0', 'n1', 'n2'] as const).map((cle, i) => ({
      cle,
      annee: anneeN + i,
      enPlace: somme(cle, (l) => l.status === 'En place'),
      valide: somme(cle, (l) => l.status === 'Validé'),
      previsionnel: somme(cle, (l) => ['Prévisionnel', 'À qualifier'].includes(l.status)),
    })),
    parPerimetre: [...par].map(([libelle, valeur]) => ({ libelle, valeur })).sort((a, b) => b.valeur - a.valeur),
    principales: [...vivantes].sort((a, b) => totalInvest(b) - totalInvest(a)).slice(0, 6),
  };
}
export interface GroupeComparaison {
  type: string;
  options: LigneInvest[];
  /** Coût minimal sur trois ans parmi les options non annulées de coût positif (`null` s'il n'y en a pas). */
  minimum: number | null;
}
/** Comparaison des options : lignes de même type (au moins deux), de la moins chère à la plus chère. */
export function comparerOptions(lignes: readonly LigneInvest[]): GroupeComparaison[] {
  const groupes = new Map<string, LigneInvest[]>();
  for (const l of lignes) {
    const k = l.type.trim() || 'Sans type';
    groupes.set(k, [...(groupes.get(k) ?? []), l]);
  }
  return [...groupes]
    .filter(([, l]) => l.length > 1)
    .sort((a, b) => a[0].localeCompare(b[0], 'fr'))
    .map(([type, options]) => {
      const couts = options
        .filter(ligneVivante)
        .map(totalInvest)
        .filter((x) => x > 0);
      return {
        type,
        options: [...options].sort((a, b) => totalInvest(a) - totalInvest(b)),
        minimum: couts.length ? Math.min(...couts) : null,
      };
    });
}

const texte = (n: number) => z.string().trim().max(n);
const montant = z.number().min(0).max(1e9);
export const LigneInvestModification = z
  .object({
    company: texte(200),
    priority: z.enum(PRIORITES_INVEST),
    type: texte(200),
    desc: texte(5000),
    n0: montant,
    n1: montant,
    n2: montant,
    comment: texte(5000),
    alt: texte(2000),
    account: texte(100),
    perimeter: texte(200),
    status: z.enum(STATUTS_INVEST),
    nature: z.enum(NATURES_INVEST),
    renewal: z.union([z.literal(''), z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide (AAAA-MM-JJ).')]),
    notice: z.number().int().min(0).max(3650),
    supplier: texte(100),
  })
  .partial()
  .strict();
export type LigneInvestModification = z.infer<typeof LigneInvestModification>;
export const AnneeInvest = z.object({ baseYear: z.number().int().min(2000).max(2200) }).strict();
