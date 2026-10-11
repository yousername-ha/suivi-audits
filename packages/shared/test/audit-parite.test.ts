/* Parité du pronostic avec l'outil historique (AUD-05, ADR 0025 § 3) : `analyze`, `worst`, `coverage` et
   `slotFindings` d'app/public/index.html sont exécutés dans un bac à sable sur les mêmes états que les fonctions
   partagées ; scores, niveaux, motifs, drapeaux et listes doivent être identiques. Un test de mutation vérifie que
   ces comparaisons détectent la modification de chaque pondération, de chaque seuil et des règles du socle. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type Analysis,
  type AuditFinding,
  type AuditItem,
  type AuditPlanSlot,
  type AuditState,
  FINDING_SOURCES,
  FINDING_STATUSES,
  FINDING_TYPES,
  THRESHOLDS,
  WEIGHTS,
  analyzeAll,
  planCoverage,
  slotFindings,
  worstLevel,
} from '../src/audit/index.js';
import { type Mutation, historique } from './historique-audit.js';

const RACINE = path.resolve(import.meta.dirname, '../../..');
const DONNEES = JSON.parse(
  readFileSync(path.join(RACINE, 'tests/fixtures/audit-donnees.json'), 'utf8'),
) as AuditState & { plan: { slots: AuditPlanSlot[] } };

/* ---------------------------------------------------------------- Générateur pseudo-aléatoire (reproductible) */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** État aléatoire : années du cycle, couverture, écarts concentrés sur un groupe d'exigences (pour atteindre les
 *  seuils exactement), créneaux du plan (dont des exigences inconnues). Retourne aussi l'année N à évaluer. */
function etatAleatoire(seed: number): { S: AuditState & { plan: { slots: AuditPlanSlot[] } }; N: number } {
  const r = lcg(seed),
    pick = <T>(l: readonly T[]) => l[Math.floor(r() * l.length)]!;
  const debut = 2022 + Math.floor(r() * 4),
    nb = 2 + Math.floor(r() * 3);
  const years = Array.from({ length: nb }, (_, i) => debut + i);
  if (r() < 0.2) years.splice(1, 1); // cycle à trou : P peut manquer
  const valeur = () => (r() < 0.45 ? '' : r() < 0.5 ? 'P' : 'X');
  const items: AuditItem[] = DONNEES.items.map((it) => {
    const afnor: Record<string, string> = {},
      interne: Record<string, string> = {};
    for (const y of years) {
      if (r() < 0.95) afnor[y] = valeur(); // clé parfois absente
      if (r() < 0.95) interne[y] = valeur();
    }
    return { ...it, afnor, interne };
  });
  const ids = items.map((i) => i.id);
  const groupe = Array.from({ length: 12 }, () => pick(ids));
  const findings: AuditFinding[] = Array.from({ length: Math.floor(r() * 45) }, (_, k) => ({
    id: `F${String(k + 1).padStart(2, '0')}`,
    source: r() < 0.05 ? 'Autre' : pick(FINDING_SOURCES),
    year: pick(years),
    type: pick(FINDING_TYPES),
    status: pick(FINDING_STATUSES),
    items: Array.from({ length: Math.floor(r() * 4) }, () =>
      r() < 0.05 ? 'A-9.99' : r() < 0.7 ? pick(groupe) : pick(ids),
    ),
    tasks: [],
  }));
  const slots: AuditPlanSlot[] = Array.from({ length: Math.floor(r() * 12) }, (_, k) => ({
    id: `s${k}`,
    day: 'j1',
    start: '09:00',
    end: '10:00',
    type: 'audit',
    title: '',
    detail: '',
    place: '',
    items: Array.from({ length: Math.floor(r() * 6) }, () => (r() < 0.1 ? 'A-9.99' : pick(ids))),
    people: [],
    proofs: [],
    questions: [],
  }));
  const choix = r();
  const N = choix < 0.7 ? pick(years) : choix < 0.85 ? years[years.length - 1]! + 1 : years[0]!;
  return {
    S: { years, nextYear: N, items, findings, plan: { status: 'Projet', note: '', days: [], slots, people: [] } },
    N,
  };
}

/* ---------------------------------------------------------------- Comparaison */
/* eslint-disable @typescript-eslint/no-explicit-any */
const idsDe = (l: { id: string }[]) => l.map((f) => f.id);
function normaliserHistorique(a: any) {
  return {
    score: a.sc,
    level: a.level,
    reasons: [...a.reasons],
    open: idsDe(a.open),
    closed: idsDe(a.closed),
    blind: a.blind,
    notSeen: a.notSeen,
    internalGap: a.internalGap,
    findings: idsDe(a.fs),
  };
}
function normaliserPortage(a: Analysis) {
  return { ...a, open: idsDe(a.open), closed: idsDe(a.closed), findings: idsDe(a.findings) };
}

/** Différences entre l'outil historique et le portage sur un état et une année N (liste vide = parité). */
function differences(
  S: AuditState & { plan: { slots: AuditPlanSlot[] } },
  N: number,
  mutations: Mutation[] = [],
): string[] {
  const h = historique({ ...S, nextYear: N }, mutations);
  const ANh = h.analysisAll();
  const AN = analyzeAll(S, N);
  const diff: string[] = [];
  for (const it of S.items) {
    const a = JSON.stringify(normaliserHistorique(ANh[it.id]));
    const b = JSON.stringify(normaliserPortage(AN[it.id]!));
    if (a !== b) diff.push(`${it.id} : historique ${a} ≠ portage ${b}`);
  }
  for (const s of S.plan.slots) {
    const w = h.worst(s, ANh),
      w2 = worstLevel(s, AN);
    if (w !== w2) diff.push(`créneau ${s.id} : pire pronostic ${w} ≠ ${w2}`);
    const f = JSON.stringify(idsDe(h.slotFindings(s))),
      f2 = JSON.stringify(idsDe(slotFindings(S.findings, s)));
    if (f !== f2) diff.push(`créneau ${s.id} : écarts ${f} ≠ ${f2}`);
  }
  const c = h.coverage(ANh),
    c2 = planCoverage(S.items, S.plan.slots, AN);
  const cov = (x: { placed: Set<string>; targets: { id: string }[]; miss: { id: string }[] }) =>
    JSON.stringify({ placed: [...x.placed].sort(), targets: idsDe(x.targets), miss: idsDe(x.miss) });
  if (cov(c) !== cov(c2)) diff.push(`couverture du plan : ${cov(c)} ≠ ${cov(c2)}`);
  return diff;
}

/** État des seuils : scores exactement égaux à 100, 60 et 30 sur des mesures de l'Annexe A (jeu fictif, N = 2026),
 *  pour que la mutation d'un seuil soit détectée. */
function etatSeuils(): AuditState & { plan: { slots: AuditPlanSlot[] } } {
  const A = DONNEES.items.filter((i) => i.ref === 'A');
  const vues = A.filter((i) => i.afnor[2025] && !i.afnor[2026]);
  const [x1, x2, x3] = vues;
  const f = (id: string, type: string, source: string, item: string): AuditFinding => ({
    id,
    source,
    year: 2025,
    type,
    status: 'Ouvert',
    items: [item],
    tasks: [],
  });
  return {
    ...DONNEES,
    findings: [
      f('F01', 'PP', 'AFNOR', x1!.id),
      f('F02', 'Remarque', 'Interne', x1!.id),
      f('F03', 'Remarque', 'Veille', x1!.id),
      f('F04', 'NC min', 'AFNOR', x2!.id),
      f('F05', 'PS', 'Interne', x3!.id),
    ],
    // Les mesures non vues par l'AFNOR en P, vues en interne et sans écart ont le score 60.
    plan: { ...DONNEES.plan, slots: [] },
  };
}
const SEUILS = etatSeuils();

const ALEATOIRES = Array.from({ length: 12 }, (_, i) => ({ seed: 1000 + i * 7919, ...etatAleatoire(1000 + i * 7919) }));

describe('Pronostic : parité avec l’outil historique (AUD-05)', () => {
  it('le jeu fictif couvre les cas du pronostic', () => {
    const AN = analyzeAll(DONNEES, DONNEES.nextYear);
    const niveaux = new Set(Object.values(AN).map((a) => a.level));
    expect([...niveaux].sort()).toEqual(['certain', 'faible', 'probable', 'socle', 'tres']);
    expect(Object.values(AN).filter((a) => a.blind)).toHaveLength(3);
    expect(Object.values(AN).some((a) => a.internalGap)).toBe(true);
    expect(Object.values(AN).some((a) => a.closed.length > 1)).toBe(true);
  });

  for (const N of [2025, 2026, 2027, 2028])
    it(`jeu fictif, N = ${N}`, () => {
      expect(differences(DONNEES, N)).toEqual([]);
    });

  it('état des seuils (scores 100, 60 et 30)', () => {
    const scores = Object.values(analyzeAll(SEUILS, 2026)).map((a) => a.score);
    expect(scores).toEqual(expect.arrayContaining([100, 60, 30, 35]));
    expect(differences(SEUILS, 2026)).toEqual([]);
  });

  for (const { seed, S, N } of ALEATOIRES)
    it(`état aléatoire (graine ${seed}, ${S.items.length} exigences, ${S.findings.length} écarts, N = ${N})`, () => {
      expect(differences(S, N)).toEqual([]);
    });

  it('motifs mot pour mot sur des cas connus du jeu fictif', () => {
    const AN = analyzeAll(DONNEES, 2026);
    expect(AN['A-5.15']!.reasons).toEqual([
      'NC majeure ouverte (AFNOR 2025) : sa levée sera vérifiée',
      "Point sensible relevé par l'AFNOR en 2025",
      'Écart clos : preuves de clôture à présenter',
      "Non vue par l'AFNOR en 2025 : rotation du cycle de surveillance",
    ]);
    // Comportement historique conservé : « prévue » en interne P compte comme vue (pas d'angle mort).
    expect(AN['A-5.15']).toMatchObject({ score: 245, level: 'certain', blind: false, notSeen: true });
    expect(AN['A-8.8']!.reasons).toEqual([
      'NC majeure ouverte (Interne 2026) : sa levée sera vérifiée',
      "Inscrite au plan d'audit AFNOR 2026",
    ]);
    expect(AN['A-5.30']!.reasons).toContain('2 écarts clos : preuves de clôture à présenter');
    expect(AN['A-5.7']!.reasons).toEqual([
      "Non vue par l'AFNOR en 2025 : rotation du cycle de surveillance",
      'Angle mort 2025 : ni audit interne ni AFNOR',
    ]);
    expect(AN['ISO-4.1']).toMatchObject({ level: 'socle', reasons: ['Socle audité à chaque visite'] });
    expect(AN['ISO-9.2']!.level).toBe('certain');
  });
});

describe('Pronostic : les tests de parité détectent les mutations', () => {
  const etats = [
    { S: DONNEES, N: 2026 },
    { S: DONNEES, N: 2027 },
    { S: SEUILS, N: 2026 },
    ...ALEATOIRES.map(({ S, N }) => ({ S, N })),
  ];
  const detecte = (mutations: Mutation[]) => etats.some(({ S, N }) => differences(S, N, mutations).length > 0);

  const MUTATIONS_HISTORIQUES: [string, Mutation][] = [
    ['pondération NC', { avant: 'sc+=100', apres: 'sc+=101' }],
    ['pondération PS AFNOR', { avant: 'sc+=70', apres: 'sc+=71' }],
    ['pondération PS autre source', { avant: 'sc+=35', apres: 'sc+=36' }],
    ['pondération autre type', { avant: 'sc+=10;', apres: 'sc+=11;' }],
    ['pondération écarts clos', { avant: 'sc+=15', apres: 'sc+=16' }],
    ['pondération non vue P', { avant: 'sc+=60', apres: 'sc+=61' }],
    ['pondération angle mort P', { avant: 'sc+=25', apres: 'sc+=26' }],
    ['pondération plan AFNOR N', { avant: 'sc+=40', apres: 'sc+=41' }],
    ['seuil certain', { avant: "sc>=100?'certain'", apres: "sc>=101?'certain'" }],
    ['seuil très probable', { avant: "sc>=60?'tres'", apres: "sc>=61?'tres'" }],
    ['seuil probable', { avant: "sc>=30?'probable'", apres: "sc>=31?'probable'" }],
    ['socle sans HDS', { avant: "const socle=it.ref!=='A'", apres: "const socle=it.ref==='ISO'" }],
    ['motif', { avant: 'encore ouverte', apres: 'toujours ouverte' }],
    ['cibles sans socle', { avant: "['certain','tres','socle'].includes", apres: "['certain','tres'].includes" }],
    ['pire pronostic inversé', { avant: 'LV[a.level].o<LV[best].o', apres: 'LV[a.level].o>LV[best].o' }],
  ];
  for (const [nom, m] of MUTATIONS_HISTORIQUES)
    it(`code historique muté : ${nom}`, () => {
      expect(detecte([m])).toBe(true);
    });

  /** Mute une constante du portage le temps d'une vérification. */
  function avecMutation(obj: Record<string, number>, cle: string, delta: number, f: () => boolean): boolean {
    const avant = obj[cle]!;
    obj[cle] = avant + delta;
    try {
      return f();
    } finally {
      obj[cle] = avant;
    }
  }
  for (const cle of Object.keys(WEIGHTS))
    it(`portage muté : pondération ${cle}`, () => {
      expect(avecMutation(WEIGHTS as unknown as Record<string, number>, cle, 1, () => detecte([]))).toBe(true);
      expect(detecte([])).toBe(false);
    });
  for (const cle of Object.keys(THRESHOLDS))
    it(`portage muté : seuil ${cle}`, () => {
      expect(avecMutation(THRESHOLDS as unknown as Record<string, number>, cle, 1, () => detecte([]))).toBe(true);
    });
});
