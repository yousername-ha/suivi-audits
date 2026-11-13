/* Pronostic de l'audit (AUD-05, ADR 0025 § 3) : portage à l'identique de `analyze` (l. 858), `worst` (l. 1368),
   `coverage` (l. 1369) et `slotFindings` (l. 1364) de l'outil historique, en fonctions pures. L'année du prochain
   audit `N` est un paramètre explicite (l'outil historique lit `S.nextYear`). Testé en parité avec le code historique
   exécuté dans un bac à sable (test/audit-parite.test.ts). */
import {
  type AuditFinding,
  type AuditItem,
  type AuditPlanSlot,
  type AuditState,
  type Level,
  LV,
  findingTypeLabel,
} from './model.js';

/** Pondérations du score (AUD-05). Toute modification casse la parité avec l'outil historique. */
export const WEIGHTS = {
  /** Non-conformité (majeure ou mineure) ouverte. */
  nc: 100,
  /** Point sensible ouvert relevé par l'AFNOR. */
  psAfnor: 70,
  /** Point sensible ouvert d'une autre source. */
  psAutre: 35,
  /** Autre type d'écart ouvert (piste de progrès, remarque). */
  autre: 10,
  /** Au moins un écart clos lié. */
  clos: 15,
  /** Mesure non vue par l'AFNOR en P (rotation du cycle). */
  nonVueP: 60,
  /** Angle mort en P : ni AFNOR ni audit interne. */
  angleMortP: 25,
  /** Mesure inscrite au plan d'audit AFNOR de N. */
  planN: 40,
} as const;
/** Seuils des niveaux (mesures de l'Annexe A seulement). */
export const THRESHOLDS = { certain: 100, tres: 60, probable: 30 } as const;

/** Résultat du pronostic d'une exigence (`analyze` : `sc`, `level`, `reasons`, `open`, `closed`, `blind`, `notSeen`,
 *  `internalGap`, `fs`). */
export interface Analysis {
  /** Score (`sc`). */
  score: number;
  level: Level;
  /** Motifs, dans l'ordre de l'outil historique. */
  reasons: string[];
  /** Écarts liés non clos. */
  open: AuditFinding[];
  /** Écarts liés clos. */
  closed: AuditFinding[];
  /** Angle mort en P (ni AFNOR ni interne). */
  blind: boolean;
  /** Non vue par l'AFNOR en P. */
  notSeen: boolean;
  /** Certaine ou très probable en N et pas encore prévue à l'audit interne N. */
  internalGap: boolean;
  /** Tous les écarts liés (`fs`). */
  findings: AuditFinding[];
}

type Etat = Pick<AuditState, 'years' | 'findings'>;

/** Pronostic d'une exigence pour l'audit AFNOR de l'année `N` (`analyze`). */
export function analyze(etat: Etat, it: AuditItem, N: number): Analysis {
  const P = N - 1,
    r: string[] = [];
  let sc = 0;
  const fs = etat.findings.filter((f) => f.items.includes(it.id));
  const open = fs.filter((f) => f.status !== 'Clos'),
    closed = fs.filter((f) => f.status === 'Clos');
  const socle = it.ref !== 'A';
  if (socle) r.push('Socle audité à chaque visite');
  for (const f of open) {
    if (f.type.startsWith('NC')) {
      sc += WEIGHTS.nc;
      r.push(`${findingTypeLabel(f.type)} ouverte (${f.source} ${f.year}) : sa levée sera vérifiée`);
    } else if (f.type === 'PS' && f.source === 'AFNOR') {
      sc += WEIGHTS.psAfnor;
      r.push(`Point sensible relevé par l'AFNOR en ${f.year}`);
    } else if (f.type === 'PS') {
      sc += WEIGHTS.psAutre;
      r.push(`Point sensible de l'audit interne ${f.year}`);
    } else {
      sc += WEIGHTS.autre;
      r.push(`Remarque ${f.source} ${f.year} encore ouverte`);
    }
  }
  if (closed.length) {
    sc += WEIGHTS.clos;
    r.push(
      closed.length > 1
        ? `${closed.length} écarts clos : preuves de clôture à présenter`
        : 'Écart clos : preuves de clôture à présenter',
    );
  }
  const afnor = it.afnor ?? {},
    interne = it.interne ?? {};
  let blind = false,
    notSeen = false;
  const hasP = etat.years.includes(P);
  if (!socle && hasP) {
    if (!afnor[P]) {
      sc += WEIGHTS.nonVueP;
      notSeen = true;
      r.push(`Non vue par l'AFNOR en ${P} : rotation du cycle de surveillance`);
    }
    if (!afnor[P] && !interne[P]) {
      sc += WEIGHTS.angleMortP;
      blind = true;
      r.push(`Angle mort ${P} : ni audit interne ni AFNOR`);
    }
  }
  if (!socle && afnor[N]) {
    sc += WEIGHTS.planN;
    r.push(`Inscrite au plan d'audit AFNOR ${N}`);
  }
  let level: Level;
  if (socle) level = open.length ? 'certain' : 'socle';
  else
    level =
      sc >= THRESHOLDS.certain
        ? 'certain'
        : sc >= THRESHOLDS.tres
          ? 'tres'
          : sc >= THRESHOLDS.probable
            ? 'probable'
            : 'faible';
  const internalGap = (level === 'certain' || level === 'tres') && !interne[N] && etat.years.includes(N);
  return { score: sc, level, reasons: r, open, closed, blind, notSeen, internalGap, findings: fs };
}

/** Pronostic de toutes les exigences, indexé par identifiant (`analysisAll`). */
export function analyzeAll(
  etat: Pick<AuditState, 'years' | 'findings' | 'items'>,
  N: number,
): Record<string, Analysis> {
  const m: Record<string, Analysis> = {};
  for (const it of etat.items) m[it.id] = analyze(etat, it, N);
  return m;
}

/** Pire pronostic (niveau le plus probable) des exigences d'un créneau, ou `null` (`worst`). */
export function worstLevel(slot: Pick<AuditPlanSlot, 'items'>, AN: Record<string, Analysis>): Level | null {
  let best: Level | null = null;
  for (const id of slot.items) {
    const a = AN[id];
    if (!a) continue;
    if (!best || LV[a.level].o < LV[best].o) best = a.level;
  }
  return best;
}

/** Niveaux ciblés par le plan d'audit : certaines, très probables et socle. */
export const TARGET_LEVELS: readonly Level[] = ['certain', 'tres', 'socle'];

export interface PlanCoverage {
  /** Identifiants placés dans au moins un créneau. */
  placed: Set<string>;
  /** Exigences ciblées (certaines, très probables, socle). */
  targets: AuditItem[];
  /** Exigences ciblées sans créneau. */
  miss: AuditItem[];
}

/** Couverture des exigences ciblées par le plan d'audit (`coverage`). */
export function planCoverage(
  items: readonly AuditItem[],
  slots: readonly Pick<AuditPlanSlot, 'items'>[],
  AN: Record<string, Analysis>,
): PlanCoverage {
  const placed = new Set(slots.flatMap((s) => s.items));
  const targets = items.filter((i) => {
    const l = AN[i.id]?.level;
    return l !== undefined && TARGET_LEVELS.includes(l);
  });
  return { placed, targets, miss: targets.filter((i) => !placed.has(i.id)) };
}

/** Écarts non clos à présenter dans un créneau : liés à l'une de ses exigences (`slotFindings`). */
export function slotFindings(findings: readonly AuditFinding[], slot: Pick<AuditPlanSlot, 'items'>): AuditFinding[] {
  return findings.filter((f) => f.status !== 'Clos' && f.items.some((i) => slot.items.includes(i)));
}
