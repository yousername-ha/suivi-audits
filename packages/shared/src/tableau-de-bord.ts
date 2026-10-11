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

/** Valeur courante d'un indicateur (`indState(ind).v`) : calculée par l'outil, sinon dernière mesure hors historique. */
export function valeurIndicateur(ind: Obj, state: Obj): { v: unknown; calcule: boolean; date: string } {
  const auto = ind.calc && ind.auto !== false ? calculAuto(ind, state) : null;
  const valeurs = arr(ind.values)
    .slice()
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .filter((x) => !x.hist);
  const derniere = valeurs[valeurs.length - 1];
  if (auto) return { v: auto.v, calcule: true, date: '' };
  return { v: derniere ? derniere.v : null, calcule: false, date: derniere ? str(derniere.date) : '' };
}

/** `fmtVal(ind, v)` : taux (cible entre 0 et 1) en pourcentage, nombres à la française, « – » sans valeur. */
export function formatValeurIndicateur(ind: Obj, v: unknown): string {
  if (v == null || v === '') return '–';
  const taux = typeof ind.target === 'number' && ind.target > 0 && ind.target <= 1;
  if (typeof v === 'number' && taux) return String(Math.round(v * 1000) / 10).replace('.', ',') + ' %';
  if (typeof v === 'number') return String(v).replace('.', ',');
  return str(v);
}

/** État d'un indicateur (`indState(ind).st`) : atteint, non atteint, non mesuré ou cible à définir. */
export function etatIndicateur(ind: Obj, state: Obj): EtatIndicateur {
  const v = valeurIndicateur(ind, state).v;
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

/* ---------------------------------------------------------------- Objectifs par processus */

export interface IndicateurObjectif {
  id: string;
  nom: string;
  cible: string;
  valeur: string;
  calcule: boolean;
  etat: EtatIndicateur;
}
export interface ObjectifPilotage {
  id: string;
  nom: string;
  echeance: string;
  responsable: string;
  processus: string[];
  indicateurs: IndicateurObjectif[];
  atteints: number;
}
export interface ProcessusPilotage {
  id: string;
  nom: string;
  pilote: string;
  objectifs: ObjectifPilotage[];
  /** Indicateurs distincts des objectifs rattachés, par état (comme la carte « Par processus » historique). */
  atteints: number;
  nonAtteints: number;
  aMesurer: number;
}
export interface FamilleProcessus {
  famille: string;
  avecObjectif: ProcessusPilotage[];
  sansObjectif: { id: string; nom: string }[];
}

/** Objectifs du SMSI et leurs indicateurs (vue « Par objectif » et « Vue compacte » de `viewPilotage`). */
export function objectifsPilotage(state: Obj): ObjectifPilotage[] {
  const indicateurs = arr(state.indicators);
  return arr(state.objectives).map((o) => {
    const its = indicateurs
      .filter((i) => i.obj === o.id)
      .map((i) => {
        const val = valeurIndicateur(i, state);
        return {
          id: str(i.id),
          nom: str(i.name),
          cible: `${str(i.dir) || '?'} ${formatValeurIndicateur(i, i.target)}`,
          valeur: formatValeurIndicateur(i, val.v),
          calcule: val.calcule,
          etat: etatIndicateur(i, state),
        };
      });
    return {
      id: str(o.id),
      nom: str(o.name),
      echeance: str(o.due).slice(0, 10),
      responsable: str(o.owner),
      processus: Array.isArray(o.processes) ? o.processes.map(str) : [],
      indicateurs: its,
      atteints: its.filter((x) => x.etat === 'ok').length,
    };
  });
}

/** Vue « Par processus » de `viewPilotage` : familles, processus avec objectifs, processus sans objectif. */
export function objectifsParProcessus(state: Obj): { familles: FamilleProcessus[]; sansProcessus: ObjectifPilotage[] } {
  const objectifs = objectifsPilotage(state);
  const processus = arr(state.processes);
  const famille = (p: Obj) => str(p.family) || 'Autres';
  const familles = [...new Set(processus.map(famille))].map((f) => {
    const ps = processus.filter((p) => famille(p) === f);
    const avec: ProcessusPilotage[] = [];
    const sans: { id: string; nom: string }[] = [];
    for (const p of ps) {
      const os = objectifs.filter((o) => o.processus.includes(str(p.id)));
      if (!os.length) {
        sans.push({ id: str(p.id), nom: str(p.name) });
        continue;
      }
      const etats = [...new Map(os.flatMap((o) => o.indicateurs).map((i) => [i.id, i.etat])).values()];
      avec.push({
        id: str(p.id),
        nom: str(p.name),
        pilote: str(p.owner),
        objectifs: os,
        atteints: etats.filter((e) => e === 'ok').length,
        nonAtteints: etats.filter((e) => e === 'ko').length,
        aMesurer: etats.filter((e) => e === 'na' || e === 'undef').length,
      });
    }
    return { famille: f, avecObjectif: avec, sansObjectif: sans };
  });
  return { familles, sansProcessus: objectifs.filter((o) => !o.processus.length) };
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

export interface PlanHistorique {
  id: string;
  titre: string;
  modalite: string;
  debut: string;
  fin: string;
  realiseLe: string;
  statut: string;
  responsable: string;
  /** Périmètre (audit) ou scénario (exercice), selon le type. */
  objet: string;
  enRetard: boolean;
}

/** Plans historiques d'un type (`plansOf(type)`), les plus récents d'abord, avec leur retard (`planLate`). */
export function plansHistoriques(state: Obj, type: string, aujourdhui: string): PlanHistorique[] {
  return arr(state.plans)
    .filter((p) => p.type === type)
    .map((p) => ({
      id: str(p.id),
      titre: str(p.title),
      modalite: str(p.kind),
      debut: str(p.start).slice(0, 10),
      fin: str(p.end).slice(0, 10),
      realiseLe: str(p.done).slice(0, 10),
      statut: str(p.status),
      responsable: str(p.owner || p.auditor),
      objet: str(type === 'exo' ? p.scenario : p.scope),
      enRetard: planEnRetard(p, aujourdhui),
    }))
    .sort((a, b) => (b.debut || b.realiseLe).localeCompare(a.debut || a.realiseLe) || a.id.localeCompare(b.id));
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
