/* Parité du tableau de bord unifié avec l'outil historique (UI-02) : `ddaStats`, `indState`, `planLate`/`plansOf` et
   les écarts ouverts de `viewDash` sont extraits de l'extrait historique figé et exécutés dans un contexte node:vm isolé sur
   des états fictifs générés, puis comparés aux fonctions partagées. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  analyserValeurIndicateur,
  conformiteParReferentiel,
  detailMesures,
  etatIndicateur,
  indicateursSynthese,
  objectifsParProcessus,
  objectifsPilotage,
  plansAnnee,
  plansHistoriques,
  TYPES_PLAN,
} from '../src/tableau-de-bord.js';

const INDEX = readFileSync(path.resolve(import.meta.dirname, './reference/index-historique-extrait.txt'), 'utf8');
function extraire(debut: string, fin: string): string {
  const i = INDEX.indexOf(debut);
  const j = INDEX.indexOf(fin, i + debut.length);
  if (i < 0 || j < 0 || INDEX.indexOf(debut, i + 1) >= 0) throw new Error(`fragment introuvable ou ambigu : ${debut}`);
  return INDEX.slice(i, j);
}
const CODE = [
  extraire('const today=', '\n'),
  extraire('const parseD=', '\n'),
  extraire('const DDA_LV=', '\n'),
  extraire('const pct=(n,d)=>', '\n'),
  extraire('function ddaStats(ref){', '\n}\n') + '\n}',
  extraire('function indCalc(ind){', '\n}\n') + '\n}',
  extraire('function indState(ind){', '\n}\n') + '\n}',
  extraire('function isRate(ind){', '\n'),
  extraire('function fmtVal(ind,v){', '\n'),
  extraire('function planLate(p){', '\n'),
  extraire('function plansOf(t,y){', '\n'),
].join('\n');

/* eslint-disable @typescript-eslint/no-explicit-any */
function historique(S: unknown) {
  const ctx: Record<string, any> = { S: JSON.parse(JSON.stringify(S)) };
  vm.createContext(ctx);
  vm.runInContext(`${CODE}\n;globalThis.__h={ddaStats,indState,planLate,plansOf,fmtVal};`, ctx, {
    filename: 'index-historique-extrait.txt',
  });
  return ctx.__h as {
    ddaStats(ref: string): any;
    indState(ind: any): { st: string; v: unknown };
    planLate(p: any): boolean;
    plansOf(t: string, y: number): any[];
    fmtVal(ind: any, v: unknown): string;
  };
}

/** Générateur pseudo-aléatoire reproductible (mulberry32). */
function alea(graine: number) {
  let a = graine;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const annee = new Date().getFullYear();
const jour = (r: () => number) => {
  const y = [2020, annee - 1, annee, annee + 1, 2099][Math.floor(r() * 5)];
  return `${y}-${String(1 + Math.floor(r() * 12)).padStart(2, '0')}-${String(1 + Math.floor(r() * 28)).padStart(2, '0')}`;
};

function etatFictif(graine: number) {
  const r = alea(graine);
  const un = <T>(l: readonly T[]) => l[Math.floor(r() * l.length)]!;
  const items = Array.from({ length: 40 }, (_, i) => ({ id: `M${i}`, ref: un(['ISO', 'A', 'HDS', 'X']) }));
  const dda = Object.fromEntries(
    items
      .filter(() => r() < 0.8)
      .map((i) => [i.id, { app: un(['', 'oui', 'non']), level: un(['', 'Total', 'Partiel', 'Insuffisant', 'Autre']) }]),
  );
  const findings = Array.from({ length: 25 }, (_, i) => ({
    id: `E${i}`,
    type: un(['NC maj', 'NC min', 'PS', 'PP', 'Remarque', 'Autre type']),
    status: un(['Ouvert', 'En cours', 'Clos']),
    source: un(['AFNOR', 'Interne', 'Autre']),
    year: un([2024, 2025, '2026', '', undefined]),
    tasks: Array.from({ length: Math.floor(r() * 4) }, () => ({ done: r() < 0.5 })),
  }));
  const suppliers = Array.from({ length: 8 }, () => ({
    saas: r() < 0.7,
    mfa: un(['Oui', 'Non']),
    sso: un(['Oui', 'Non']),
  }));
  const processes = Array.from({ length: 8 }, (_, i) => ({
    id: `PR${i}`,
    name: `Processus fictif ${i}`,
    family: un(['Pilotage', 'Support', undefined]),
  }));
  const objectives = Array.from({ length: 6 }, (_, i) => ({
    id: `OBJ${i}`,
    name: `Objectif fictif ${i}`,
    processes: processes.filter(() => r() < 0.25).map((p) => p.id),
  }));
  const indicators = Array.from({ length: 20 }, (_, i) => ({
    id: `I${i}`,
    obj: un([...objectives.map((o) => o.id), undefined]),
    dir: un(['', '≥', '≤', '=']),
    target: un([0.9, 3, 'Oui', '', null, 0]),
    calc: un([undefined, 'saasMfa', 'saasSso', 'afnorNcMaj', 'interneNcMaj', 'interneNcMajOpen', 'inconnu']),
    auto: un([undefined, false, true]),
    values: Array.from({ length: Math.floor(r() * 4) }, () => ({
      date: jour(r),
      v: un([0.5, 0.95, 2, 4, 'Oui', 'non', '']),
      hist: r() < 0.2 ? '2024' : undefined,
    })),
  }));
  const plans = Array.from({ length: 30 }, (_, i) => ({
    id: `P${i}`,
    type: un(['formation', 'sensi', 'audit', 'exo', 'autre']),
    status: un(['Planifié', 'En préparation', 'Réalisé', 'Reporté', 'Annulé', undefined]),
    start: r() < 0.9 ? jour(r) : '',
    end: r() < 0.5 ? jour(r) : '',
    done: r() < 0.3 ? jour(r) : '',
  }));
  return { items, dda, findings, suppliers, processes, objectives, indicators, plans };
}

const aujourdhui = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

describe('tableau de bord unifié : parité avec l’outil historique', () => {
  for (const graine of [1, 2, 3, 42, 2026]) {
    it(`état fictif ${graine} : conformité, indicateurs, plans, écarts ouverts`, () => {
      const S = etatFictif(graine);
      const h = historique(S);
      for (const c of conformiteParReferentiel(S)) {
        const x = h.ddaStats(c.ref);
        expect([c.exigences, c.applicables, c.total, c.partiel, c.insuffisant, c.nonRenseigne]).toEqual([
          x.total,
          x.app,
          x.c.Total,
          x.c.Partiel,
          x.c.Insuffisant,
          x.c[''],
        ]);
      }
      for (const ind of S.indicators) expect(etatIndicateur(ind, S)).toBe(h.indState(ind).st);
      const etats = S.indicators.map((i) => h.indState(i).st);
      expect(indicateursSynthese(S)).toEqual({
        total: etats.length,
        atteints: etats.filter((e) => e === 'ok').length,
        nonAtteints: etats.filter((e) => e === 'ko').length,
        nonMesures: etats.filter((e) => e !== 'ok' && e !== 'ko').length,
      });
      for (const t of ['audit', 'exo'])
        expect(
          plansHistoriques(S, t, aujourdhui)
            .map((p) => [p.id, p.enRetard])
            .sort(),
        ).toEqual(
          h
            .plansOf(t, 0)
            .map((x: any) => [x.id, !!h.planLate(x)])
            .sort(),
        );
      for (const p of plansAnnee(S, annee, aujourdhui)) {
        const l = h.plansOf(p.type, annee).filter((x: any) => x.status !== 'Annulé');
        expect([p.realises, p.enRetard, p.aVenir]).toEqual([
          l.filter((x: any) => x.status === 'Réalisé').length,
          l.filter((x: any) => h.planLate(x)).length,
          l.filter((x: any) => x.status !== 'Réalisé' && !h.planLate(x)).length,
        ]);
      }
      // Vues « Par objectif » et « Par processus » de viewPilotage.
      const objectifs = objectifsPilotage(S);
      for (const o of objectifs)
        for (const i of o.indicateurs) {
          const ind = S.indicators.find((x) => x.id === i.id)!;
          expect(i.valeur).toBe(h.fmtVal(ind, h.indState(ind).v));
          expect(i.etat).toBe(h.indState(ind).st);
        }
      const vue = objectifsParProcessus(S);
      const famOf = (p: { family?: string }) => p.family || 'Autres';
      expect(vue.familles.map((f) => f.famille)).toEqual([...new Set(S.processes.map(famOf))]);
      for (const f of vue.familles)
        for (const p of f.avecObjectif) {
          const os = S.objectives.filter((o) => o.processes.includes(p.id));
          const sts = [...new Set(os.flatMap((o) => S.indicators.filter((i) => i.obj === o.id)))].map(
            (i) => h.indState(i).st,
          );
          expect([p.atteints, p.nonAtteints, p.aMesurer]).toEqual([
            sts.filter((x) => x === 'ok').length,
            sts.filter((x) => x === 'ko').length,
            sts.filter((x) => x === 'na' || x === 'undef').length,
          ]);
        }
      expect(vue.familles.flatMap((f) => f.sansObjectif.map((p) => p.id)).sort()).toEqual(
        S.processes
          .filter((p) => !S.objectives.some((o) => o.processes.includes(p.id)))
          .map((p) => p.id)
          .sort(),
      );
      expect(vue.sansProcessus.map((o) => o.id)).toEqual(
        S.objectives.filter((o) => !o.processes.length).map((o) => o.id),
      );
    });
  }

  it('état vide : aucun chiffre inventé', () => {
    expect(conformiteParReferentiel({}).every((c) => c.exigences === 0 && c.applicables === 0)).toBe(true);
    expect(indicateursSynthese({})).toEqual({ total: 0, atteints: 0, nonAtteints: 0, nonMesures: 0 });
    expect(plansAnnee({}, annee, aujourdhui).map((p) => p.realises + p.aVenir + p.enRetard)).toEqual(
      TYPES_PLAN.map(() => 0),
    );
    expect(objectifsParProcessus({})).toEqual({ familles: [], sansProcessus: [] });
  });

  it('un plan sans date de début n’est jamais en retard ; un plan réalisé non plus', () => {
    const S = {
      plans: [
        { type: 'audit', status: 'Planifié', start: '', done: `${annee}-01-02` },
        { type: 'audit', status: 'Réalisé', start: `${annee}-01-01` },
        { type: 'audit', status: 'Planifié', start: '2020-01-01', end: '2099-01-01' },
      ],
    };
    const audit = plansAnnee(S, annee, aujourdhui).find((p) => p.type === 'audit')!;
    expect(audit).toMatchObject({ realises: 1, enRetard: 0, aVenir: 1 });
    const liste = plansHistoriques(S, 'audit', aujourdhui);
    expect(liste.map((p) => [p.debut, p.enRetard])).toEqual([
      ['', false],
      [`${annee}-01-01`, false],
      ['2020-01-01', false],
    ]);
    expect(plansHistoriques(S, 'exo', aujourdhui)).toEqual([]);
  });
});

describe('détail des mesures et saisie d’une valeur (interface des objectifs)', () => {
  const etat = {
    suppliers: [
      { saas: true, mfa: 'Oui' },
      { saas: true, mfa: 'Non' },
    ],
    findings: [],
  };
  it('donne tendance, date de la dernière mesure et valeur historique, comme l’outil de suivi', () => {
    const ind = {
      id: 'I1',
      dir: '≥',
      target: 0.9,
      values: [
        { date: '2025-12-31', v: 0.7, hist: '2025-2026' },
        { date: '2026-04-01', v: 0.8 },
        { date: '2026-07-01', v: 0.92 },
      ],
    };
    expect(detailMesures(ind, etat)).toEqual({
      tendance: '↗',
      source: '2026-07-01',
      historique: { periode: '2025-2026', valeur: '70 %' },
    });
    expect(detailMesures({ ...ind, values: [{ date: '2026-04-01', v: 0.8 }] }, etat).tendance).toBe('');
    const stable = [
      { date: '2026-04-01', v: 0.8 },
      { date: '2026-07-01', v: 0.8 },
    ];
    expect(detailMesures({ ...ind, values: stable }, etat).tendance).toBe('→');
  });
  it('ne donne pas de tendance à un indicateur calculé, et cite la source du calcul', () => {
    const auto = detailMesures(
      {
        calc: 'saasMfa',
        values: [
          { date: '2026-01-01', v: 1 },
          { date: '2026-02-01', v: 2 },
        ],
      },
      etat,
    );
    expect(auto).toMatchObject({ tendance: '', source: '1/2 services SaaS' });
  });
  it('analyse une saisie : Oui/Non, nombre, taux en pourcentage ramené entre 0 et 1', () => {
    const taux = { target: 0.9, dir: '≥' };
    expect(analyserValeurIndicateur(taux, '88 %')).toBe(0.88);
    expect(analyserValeurIndicateur(taux, '92')).toBe(0.92);
    expect(analyserValeurIndicateur(taux, '0,5')).toBe(0.5);
    expect(analyserValeurIndicateur({ dir: '=', target: 'Oui' }, 'oui')).toBe('Oui');
    expect(analyserValeurIndicateur({ dir: '≤', target: 3 }, '2')).toBe(2);
    expect(analyserValeurIndicateur({ dir: '≤', target: 3 }, 'abc')).toBe('abc');
    expect(analyserValeurIndicateur(taux, '  ')).toBeNull();
  });
});
