/* Parité du tableau de bord unifié avec l'outil historique (UI-02) : `ddaStats`, `indState`, `planLate`/`plansOf` et
   les écarts ouverts de `viewDash` sont extraits de app/public/index.html et exécutés dans un contexte node:vm isolé sur
   des états fictifs générés, puis comparés aux fonctions partagées. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  conformiteParReferentiel,
  ecartsOuverts,
  etatIndicateur,
  indicateursSynthese,
  plansAnnee,
  TYPES_PLAN,
} from '../src/tableau-de-bord.js';

const INDEX = readFileSync(path.resolve(import.meta.dirname, '../../../app/public/index.html'), 'utf8');
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
  extraire('function planLate(p){', '\n'),
  extraire('function plansOf(t,y){', '\n'),
].join('\n');

/* eslint-disable @typescript-eslint/no-explicit-any */
function historique(S: unknown) {
  const ctx: Record<string, any> = { S: JSON.parse(JSON.stringify(S)) };
  vm.createContext(ctx);
  vm.runInContext(`${CODE}\n;globalThis.__h={ddaStats,indState,planLate,plansOf};`, ctx, { filename: 'index.html' });
  return ctx.__h as {
    ddaStats(ref: string): any;
    indState(ind: any): { st: string };
    planLate(p: any): boolean;
    plansOf(t: string, y: number): any[];
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
  const indicators = Array.from({ length: 20 }, (_, i) => ({
    id: `I${i}`,
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
  return { items, dda, findings, suppliers, indicators, plans };
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
      for (const p of plansAnnee(S, annee, aujourdhui)) {
        const l = h.plansOf(p.type, annee).filter((x: any) => x.status !== 'Annulé');
        expect([p.realises, p.enRetard, p.aVenir]).toEqual([
          l.filter((x: any) => x.status === 'Réalisé').length,
          l.filter((x: any) => h.planLate(x)).length,
          l.filter((x: any) => x.status !== 'Réalisé' && !h.planLate(x)).length,
        ]);
      }
      const ouverts = S.findings.filter((f) => f.status !== 'Clos');
      const e = ecartsOuverts(S);
      expect(e.ouverts).toBe(ouverts.length);
      expect(e.parType.reduce((n, t) => n + t.n, 0)).toBe(ouverts.length);
      expect(e.actionsTotal).toBe(ouverts.flatMap((f) => f.tasks).length);
      expect(e.actionsRealisees).toBe(ouverts.flatMap((f) => f.tasks).filter((t) => t.done).length);
    });
  }

  it('état vide : aucun chiffre inventé', () => {
    expect(conformiteParReferentiel({}).every((c) => c.exigences === 0 && c.applicables === 0)).toBe(true);
    expect(indicateursSynthese({})).toEqual({ total: 0, atteints: 0, nonAtteints: 0, nonMesures: 0 });
    expect(plansAnnee({}, annee, aujourdhui).map((p) => p.realises + p.aVenir + p.enRetard)).toEqual(
      TYPES_PLAN.map(() => 0),
    );
    expect(ecartsOuverts({})).toMatchObject({ ouverts: 0, actionsRealisees: 0, actionsTotal: 0 });
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
  });
});
