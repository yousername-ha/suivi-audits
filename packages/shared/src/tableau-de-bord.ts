/* Tableau de bord unifié (UI-02, lot U1 du plan d'unification) : agrégats du tableau de bord de l'outil historique
   (`viewDash`), portés à l'identique en fonctions pures et testés en parité (packages/shared/test/tableau-de-bord.test.ts).
   Fonctions historiques reprises : `ddaStats` (l. 1794), `indCalc` et `indState` (l. 1801, 1816), `planLate` et
   `plansOf` (l. 3641, 3644), et les écarts ouverts de `viewDash` (l. 4855). L'état reçu est déjà filtré selon les droits :
   un module masqué est vide. Aucun de ces chiffres n'est un taux de conformité certifié. */

type Obj = Record<string, unknown>;
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Obj[]) : []);
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

/* ---------------------------------------------------------------- Conformité par référentiel (DdA) */

export const REFERENTIELS_DDA = [
  { ref: 'ISO', libelle: 'Clauses ISO 27001' },
  { ref: 'A', libelle: 'Annexe A' },
  { ref: 'HDS', libelle: 'HDS' },
] as const;

export interface ConformiteReferentiel {
  ref: string;
  libelle: string;
  /** Exigences du référentiel, applicables (DdA différente de « non »), puis répartition des applicables. */
  exigences: number;
  applicables: number;
  total: number;
  partiel: number;
  insuffisant: number;
  nonRenseigne: number;
}

const NIVEAUX_DDA = ['Total', 'Partiel', 'Insuffisant'];

/** `ddaStats(ref)` de l'outil historique, pour les trois référentiels de la DdA. */
export function conformiteParReferentiel(state: Obj): ConformiteReferentiel[] {
  const items = arr(state.items);
  const dda = obj(state.dda);
  return REFERENTIELS_DDA.map(({ ref, libelle }) => {
    const its = items.filter((i) => i.ref === ref);
    const app = its.filter((i) => obj(dda[str(i.id)]).app !== 'non');
    const c: Record<string, number> = { Total: 0, Partiel: 0, Insuffisant: 0, '': 0 };
    for (const i of app) {
      const l = str(obj(dda[str(i.id)]).level);
      c[NIVEAUX_DDA.includes(l) ? l : '']!++;
    }
    return {
      ref,
      libelle,
      exigences: its.length,
      applicables: app.length,
      total: c.Total!,
      partiel: c.Partiel!,
      insuffisant: c.Insuffisant!,
      nonRenseigne: c['']!,
    };
  });
}

/* ---------------------------------------------------------------- Indicateurs */

export type EtatIndicateur = 'ok' | 'ko' | 'na' | 'undef';

function calculAuto(ind: Obj, state: Obj): { v: number | null } | null {
  const saas = arr(state.suppliers).filter((x) => x.saas);
  const findings = arr(state.findings);
  const derniere = (src: string) =>
    Math.max(0, ...findings.filter((f) => f.source === src).map((f) => +str(f.year) || 0));
  switch (ind.calc) {
    case 'saasMfa':
      return { v: saas.length ? saas.filter((x) => x.mfa === 'Oui').length / saas.length : null };
    case 'saasSso':
      return { v: saas.length ? saas.filter((x) => x.sso === 'Oui').length / saas.length : null };
    case 'afnorNcMaj': {
      const y = derniere('AFNOR');
      return { v: findings.filter((f) => f.source === 'AFNOR' && f.type === 'NC maj' && +str(f.year) === y).length };
    }
    case 'interneNcMaj': {
      const y = derniere('Interne');
      return { v: findings.filter((f) => f.source === 'Interne' && f.type === 'NC maj' && +str(f.year) === y).length };
    }
    case 'interneNcMajOpen':
      return { v: findings.filter((f) => f.source === 'Interne' && f.type === 'NC maj' && f.status !== 'Clos').length };
  }
  return null;
}

/** État d'un indicateur (`indState(ind).st`) : atteint, non atteint, non mesuré ou cible à définir. */
export function etatIndicateur(ind: Obj, state: Obj): EtatIndicateur {
  const auto = ind.calc && ind.auto !== false ? calculAuto(ind, state) : null;
  const valeurs = arr(ind.values)
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .filter((x) => !x.hist);
  const derniere = valeurs[valeurs.length - 1];
  const v = auto ? auto.v : derniere ? derniere.v : null;
  if (!ind.dir || ind.target === '' || ind.target == null) return 'undef';
  if (v == null || v === '') return 'na';
  if (ind.dir === '=') return String(v).toLowerCase() === String(ind.target).toLowerCase() ? 'ok' : 'ko';
  if (ind.dir === '≤') return +(v as number) <= +(ind.target as number) ? 'ok' : 'ko';
  if (ind.dir === '≥') return +(v as number) >= +(ind.target as number) ? 'ok' : 'ko';
  return 'na';
}

export interface SyntheseIndicateurs {
  total: number;
  atteints: number;
  nonAtteints: number;
  /** Non mesurés, y compris les cibles à définir (comme le tableau de bord historique). */
  nonMesures: number;
}

export function indicateursSynthese(state: Obj): SyntheseIndicateurs {
  const etats = arr(state.indicators).map((i) => etatIndicateur(i, state));
  const atteints = etats.filter((e) => e === 'ok').length;
  const nonAtteints = etats.filter((e) => e === 'ko').length;
  return { total: etats.length, atteints, nonAtteints, nonMesures: etats.length - atteints - nonAtteints };
}

/* ---------------------------------------------------------------- Plans du SMSI */

export const TYPES_PLAN = [
  { type: 'formation', libelle: 'Formation' },
  { type: 'sensi', libelle: 'Sensibilisation' },
  { type: 'audit', libelle: 'Audit interne' },
  { type: 'exo', libelle: 'Exercice' },
] as const;

/** `planLate(p)` : ni réalisé ni annulé, avec une date de fin (ou de début) dépassée. Dates « AAAA-MM-JJ ». */
export function planEnRetard(p: Obj, aujourdhui: string): boolean {
  if (['Réalisé', 'Annulé'].includes(str(p.status)) || !p.start) return false;
  const fin = str(p.end || p.start).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(fin) && fin < aujourdhui;
}

export interface PlanAnnee {
  type: string;
  libelle: string;
  realises: number;
  aVenir: number;
  enRetard: number;
}

/** Actions des plans de l'année par type (`plansOf(type, année)` sans les annulées). */
export function plansAnnee(state: Obj, annee: number, aujourdhui: string): PlanAnnee[] {
  const plans = arr(state.plans);
  return TYPES_PLAN.map(({ type, libelle }) => {
    const l = plans.filter(
      (p) => p.type === type && str(p.start || p.done).startsWith(String(annee)) && p.status !== 'Annulé',
    );
    const enRetard = l.filter((p) => planEnRetard(p, aujourdhui)).length;
    const realises = l.filter((p) => p.status === 'Réalisé').length;
    return { type, libelle, realises, enRetard, aVenir: l.length - realises - enRetard };
  });
}

/* ---------------------------------------------------------------- Écarts ouverts */

export const TYPES_ECART = [
  { type: 'NC maj', libelle: 'NC majeure' },
  { type: 'NC min', libelle: 'NC mineure' },
  { type: 'PS', libelle: 'Point sensible' },
  { type: 'PP', libelle: 'Piste de progrès' },
  { type: 'Remarque', libelle: 'Remarque' },
] as const;

export interface EcartsOuverts {
  ouverts: number;
  parType: { type: string; libelle: string; n: number }[];
  actionsRealisees: number;
  actionsTotal: number;
}

/** Écarts ouverts (statut différent de « Clos ») par type et actions de ces écarts, comme `viewDash`. */
export function ecartsOuverts(state: Obj): EcartsOuverts {
  const ouverts = arr(state.findings).filter((f) => f.status !== 'Clos');
  const taches = ouverts.flatMap((f) => arr(f.tasks));
  const connus = new Set<string>(TYPES_ECART.map((t) => t.type));
  const autres = ouverts.filter((f) => !connus.has(str(f.type))).length;
  return {
    ouverts: ouverts.length,
    parType: [
      ...TYPES_ECART.map(({ type, libelle }) => ({ type, libelle, n: ouverts.filter((f) => f.type === type).length })),
      ...(autres ? [{ type: '', libelle: 'Autre', n: autres }] : []),
    ],
    actionsRealisees: taches.filter((t) => t.done).length,
    actionsTotal: taches.length,
  };
}
