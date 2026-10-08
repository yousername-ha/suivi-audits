/* Parité avec le module bêta validé (CARTO-02, 05, 06, 08, 09) : le code de la bêta est exécuté dans un bac à
   sable sur les mêmes données, et ses sorties sont comparées à celles des fonctions partagées. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type CartoObject,
  type GenerateOptions,
  type MapLayout,
  type MapView,
  type Referentiel,
  MapLayoutSchema,
  anchors,
  buildObjects,
  cartoContext,
  computeScene,
  defaultGenerateOptions,
  deriveRelations,
  generateLayout,
  issueKindAuto,
  layoutContext,
  layoutProcess,
  linkPath,
  mbHash,
  placeNode,
  relayout,
  selectForGeneration,
  syncInfo,
} from '../src/carto/index.js';
import { type Beta, beta, normaliserObjet, normaliserRelation } from './beta-carto.js';

const RACINE = path.resolve(import.meta.dirname, '../../..');
const DONNEES = JSON.parse(readFileSync(path.join(RACINE, 'tests/fixtures/carto-donnees.json'), 'utf8')) as Record<
  string,
  unknown
>;
const ORG = 'Organisation fictive';

/* ---------------------------------------------------------------- Générateur pseudo-aléatoire (reproductible) */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
const FAMILLES = ['Management', 'Réalisation', 'Support', '', 'Autre'];
const MOTS = ['menace cyber', 'climat social', 'compétences', 'outils', 'marché', 'budget', 'ARS', 'CNIL', 'qualité'];

/** État fictif aléatoire : n processus (dont sous-processus), parties intéressées, enjeux, fournisseurs… */
function etatAleatoire(seed: number, n: number): Record<string, unknown> {
  const r = lcg(seed),
    pick = <T>(l: T[]) => l[Math.floor(r() * l.length)]!;
  const processes: Record<string, unknown>[] = [];
  for (let i = 1; i <= n; i++) {
    const code = `P-${String(i).padStart(3, '0')}`;
    processes.push({
      id: code,
      name: `Processus ${pick(MOTS)} ${i}`,
      owner: r() < 0.5 ? 'Pilote' : '',
      family: pick(FAMILLES),
    });
    if (r() < 0.3)
      processes.push({ id: `${code}.${1 + Math.floor(r() * 3)}`, name: `Sous-processus ${i}`, family: pick(FAMILLES) });
    if (r() < 0.1) processes.push({ id: `S-${i}`, name: `Rattaché ${i}`, parent: code, family: '' });
  }
  const ids = processes.map((p) => p.id as string);
  const interested = Array.from({ length: Math.floor(r() * 12) }, (_, i) => ({
    id: `PI-${i}`,
    name: `Partie ${i}`,
    type: r() < 0.5 ? 'Interne' : 'Externe',
    cat: r() < 0.5 ? 'Catégorie' : '',
  }));
  const objectives = Array.from({ length: Math.floor(r() * 6) }, (_, i) => ({
    id: `OBJ-${i}`,
    name: `Objectif ${i}`,
    processes: [pick(ids), pick(ids)],
    enjeux: Array.from({ length: Math.floor(r() * 4) }, () =>
      r() < 0.6 ? `${pick(MOTS)} ${Math.floor(r() * 5)} : description` : `${pick(MOTS)} sans description`,
    ),
  }));
  const swots = Array.from({ length: Math.floor(r() * 5) }, (_, i) => ({
    id: `SW-${i}`,
    process: pick(ids),
    date: `2026-0${1 + Math.floor(r() * 9)}-1${Math.floor(r() * 9)}`,
    S: r() < 0.5 ? [`force ${pick(MOTS)}`] : [],
    W: [],
    O: r() < 0.5 ? [`opportunité ${i}`] : [],
    T: r() < 0.5 ? [`${pick(MOTS)}`] : [],
  }));
  const suppliers = Array.from({ length: Math.floor(r() * 14) }, (_, i) => ({
    id: `SUP-${i}`,
    name: `Fournisseur ${i}`,
    saas: r() < 0.4,
    hds: r() < 0.3 ? 'Oui' : '',
    critical: r() < 0.3 ? 'Oui' : r() < 0.5 ? 'non' : '',
    mfa: r() < 0.5 ? 'Oui' : 'Non',
  }));
  const appGaps = Array.from({ length: Math.floor(r() * 5) }, (_, i) => ({
    id: `APP-${i}`,
    name: `Application ${i}`,
    supplier: suppliers.length && r() < 0.7 ? `Fournisseur ${Math.floor(r() * suppliers.length)}` : '',
    status: pick(['Intégrée', 'Écartée', 'À étudier', '']),
    dscp: r() < 0.5 ? 'Oui' : 'Non',
  }));
  const inScope = r() < 0.8 ? ids.filter(() => r() < 0.4) : [];
  return {
    processes,
    interested,
    objectives,
    indicators: objectives.map((o, i) => ({
      id: `IND-${i}`,
      obj: o.id,
      target: 0.8,
      dir: '≥',
      values: [{ date: '2026-01-01', v: r() }],
    })),
    swots,
    suppliers,
    appGaps,
    findings: [],
    scope: {
      processes: inScope,
      sites: r() < 0.5 ? 'Site A\nSite B' : '',
      systems: r() < 0.5 ? ['- Système X', 'Système Y'] : '',
    },
  };
}
const ETATS: [string, Record<string, unknown>][] = [
  ['jeu de recette', DONNEES],
  ['état vide', {}],
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((s): [string, Record<string, unknown>] => [
    `aléatoire ${s}`,
    etatAleatoire(s, 3 + s * 4),
  ]),
  ['grand état', etatAleatoire(99, 140)],
];

const objetsDe = (S: unknown, issueKind?: Record<string, 'ext' | 'int'>) => buildObjects(S, { org: ORG, issueKind });
function betaSur(S: Record<string, unknown>, issueKind?: Record<string, 'ext' | 'int'>): Beta {
  const b = beta(structuredClone(issueKind ? { ...S, maps: { issueKind } } : S), ORG);
  b.MB.objs = b.mbObjects();
  return b;
}
const sansId = (l: { edges: { id: string }[] }) => l.edges.map(({ id: _id, ...e }) => e);

describe('hachage des libellés (parité mbHash)', () => {
  it('donne les mêmes références que la bêta', () => {
    const b = beta({});
    for (const s of ['', 'menace cyber', 'Compétences internes', 'éàçüœ', '😀 enjeu', 'a'.repeat(500), 'ARS : tutelle'])
      expect(mbHash(s)).toBe(b.mbHash(s));
    expect(mbHash('menace cyber')).toMatch(/^[0-9a-z]+$/);
  });
  it('déduit la nature des enjeux comme la bêta', () => {
    const b = beta({});
    for (const s of ['Menace cyber', 'Climat social', 'Compétences', 'Exigences des clients', 'ARS', 'Outils internes'])
      expect(issueKindAuto(s)).toBe(b.mbIssueKindAuto(s));
  });
});

describe.each(ETATS)('%s', (_nom, S) => {
  const objs = objetsDe(S);
  const ctx = cartoContext(objs);
  const b = betaSur(S);

  it('objets métier identiques (références, ordre, champs)', () => {
    const attendus = [...b.MB.objs.values()].map(normaliserObjet);
    const obtenus = [...objs.values()].map((o) => JSON.parse(JSON.stringify(o)) as CartoObject);
    expect(obtenus.map((o) => o.ref)).toEqual(attendus.map((o) => o.ref));
    expect(obtenus).toEqual(attendus);
  });

  it('relations dérivées identiques', () => {
    expect(deriveRelations(objs)).toEqual(b.mbRelations(b.MB.objs).map(normaliserRelation));
  });

  it('dispositions identiques (tous les objets et sous-ensembles)', () => {
    const all = [...objs.keys()];
    const sous = all.filter((_, i) => i % 3 !== 1);
    for (const refs of [all, sous, all.slice().reverse()]) {
      expect(layoutContext(refs, objs)).toEqual(JSON.parse(JSON.stringify(b.mbLayoutContext(new Set(refs)))));
      expect(layoutProcess(refs, objs)).toEqual(JSON.parse(JSON.stringify(b.mbLayoutProcess(new Set(refs)))));
    }
  });

  const VARIANTES: [MapView, Partial<GenerateOptions>][] = [
    ['context', {}],
    ['context', { depth: 1 }],
    ['context', { depth: 3, sups: 'all', subprocess: true }],
    ['context', { iss_swot: false, application: false, assets: false }],
    ['process', {}],
    ['process', { subprocess: false, lanes: false }],
  ];
  it.each(VARIANTES)('génération %s %j identique', (view, extra) => {
    const fd = { ...defaultGenerateOptions(view, objs), ...extra };
    const refs = selectForGeneration(ctx, view, fd);
    let n = 0;
    const l = generateLayout(null, ctx, view, refs, fd, () => `e${n++}`);
    const bb = betaSur(S);
    bb.ui.mbView = view;
    // La bêta lit les cases cochées : booléens, et « depth » sous forme de texte.
    const fdBeta = { ...fd, depth: String(fd.depth ?? '') };
    return bb.mbGenerate(view, fdBeta).then(() => {
      const w = bb.MB.work[view];
      if (refs.length > 400) {
        expect(w ?? null).toBeNull();
        return;
      }
      expect(l.nodes).toEqual(JSON.parse(JSON.stringify(w.nodes)));
      expect(l.ignored).toEqual(w.ignored);
      expect(l.hide).toEqual(w.hide);
      expect(sansId(l)).toEqual(sansId(JSON.parse(JSON.stringify(w))).map((e) => ({ ...e, gen: true })));
      expect(MapLayoutSchema.safeParse(l).success).toBe(true);
    });
  });

  it('génération en mode « compléter » identique (placement sans chevauchement)', async () => {
    const view: MapView = 'context';
    const fd = { ...defaultGenerateOptions(view, objs), depth: 1 as const };
    const base = generateLayout(null, ctx, view, selectForGeneration(ctx, view, fd), fd, () => 'x');
    const fd2 = { ...fd, depth: 3 as const, sups: 'all' as const, subprocess: true, mode: 'complete' as const };
    const l = generateLayout(base, ctx, view, selectForGeneration(ctx, view, fd2), fd2, () => 'y');
    const bb = betaSur(S);
    bb.ui.mbView = view;
    bb.MB.sRef = bb.S;
    bb.MB.at[view] = '';
    bb.MB.work[view] = structuredClone(base);
    await bb.mbGenerate(view, { ...fd2, depth: '3' });
    expect(l.nodes).toEqual(JSON.parse(JSON.stringify(bb.MB.work[view].nodes)));
  });

  it('synchronisation, placement et disposition automatique identiques', async () => {
    for (const view of ['context', 'process'] as MapView[]) {
      const fd = defaultGenerateOptions(view, objs);
      const l: MapLayout = generateLayout(null, ctx, view, selectForGeneration(ctx, view, fd), fd, () => 'e');
      // Carte retravaillée : un objet disparu, un ignoré retiré, un objet déplacé.
      l.nodes['process:DISPARU'] = { x: 5, y: 5, w: 200, h: 80, label: 'Ancien processus' };
      const premier = Object.keys(l.ignored)[0];
      if (premier) delete l.ignored[premier];
      const bb = betaSur(S);
      bb.ui.mbView = view;
      bb.MB.sRef = bb.S;
      bb.MB.at[view] = '';
      bb.MB.work[view] = structuredClone(l);
      const sb = bb.mbSyncInfo(view);
      const sy = syncInfo(l, objs, view);
      expect(sy.miss).toEqual(sb.miss);
      expect(sy.news.map((o) => o.ref)).toEqual(sb.news.map((o: CartoObject) => o.ref));
      for (const o of sy.news.slice(0, 5)) {
        const w = structuredClone(l);
        bb.mbPlace(w, o.ref, view);
        expect(placeNode(l, o.ref, view, ctx).nodes[o.ref]).toEqual(w.nodes[o.ref]);
      }
      const rl = relayout(l, ctx, view);
      bb.MB.dirty[view] = true;
      await bb.mbAct({ dataset: { mb: 'relayout' } });
      const w = bb.MB.work[view];
      for (const [r, n] of Object.entries(rl.nodes)) {
        const nb = w.nodes[r];
        expect({ x: n.x, y: n.y, w: n.w, h: n.h }).toEqual({ x: nb.x, y: nb.y, w: nb.w, h: nb.h });
      }
      expect(Object.keys(rl.nodes).sort()).toEqual(Object.keys(w.nodes).sort());
    }
  });

  it('scène identique (filtres, préréglages, recherche, relations secondaires)', () => {
    for (const view of ['context', 'process'] as MapView[]) {
      const fd = defaultGenerateOptions(view, objs);
      const l = generateLayout(null, ctx, view, selectForGeneration(ctx, view, fd), fd, () => 'e1');
      const bb = betaSur(S);
      bb.ui.mbView = view;
      bb.MB.sRef = bb.S;
      bb.MB.at[view] = '';
      bb.MB.work[view] = structuredClone(l);
      const cas: { std: Referentiel[]; preset: string; q: string; sec: boolean; gen: boolean }[] = [
        { std: ['ISO 27001', 'HDS'], preset: 'all', q: '', sec: false, gen: true },
        { std: ['ISO 27001'], preset: view === 'context' ? 'pi' : 'rea', q: 'process', sec: true, gen: false },
        { std: ['HDS'], preset: view === 'context' ? 'scope' : 'sup', q: 'fournisseur', sec: true, gen: true },
      ];
      for (const c of cas) {
        bb.ui.mbStd = { 'ISO 27001': c.std.includes('ISO 27001'), HDS: c.std.includes('HDS') };
        bb.ui.mbPre = { [view]: c.preset };
        bb.ui.mbSec = c.sec;
        bb.ui.mbGen = c.gen;
        bb.MB.q = c.q;
        const sb = bb.mbScene(view);
        const sc = computeScene(l, view, ctx.lookup, ctx.relations, { ...c, std: [...c.std] });
        expect(sc.nodes.map(([r]) => r)).toEqual(sb.nodes.map(([r]: [string]) => r));
        expect(sc.edges.map((e) => e.key)).toEqual(sb.edges.map((e: { key: string }) => e.key));
        expect([...sc.hits]).toEqual([...sb.hits]);
        expect([...sc.containers, ...sc.cards].map(([r]) => r).sort()).toEqual(
          sb.nodes.map(([r]: [string]) => r).sort(),
        );
      }
    }
  });
});

describe('géométrie des liens (parité mbAnch, mbPath)', () => {
  it('mêmes ancrages et tracés sur 2 000 paires de rectangles', () => {
    const b = beta({}),
      r = lcg(7);
    const rect = () => ({
      x: Math.round(r() * 1200),
      y: Math.round(r() * 900),
      w: 40 + Math.round(r() * 300),
      h: 40 + Math.round(r() * 200),
    });
    for (let i = 0; i < 2000; i++) {
      const a = rect(),
        c = i % 10 === 0 ? { ...a, x: a.x + 10 } : rect();
      const an = anchors(a, c);
      expect(an).toEqual(b.mbAnch(a, c));
      expect(linkPath(an, false)).toBe(b.mbPath(an, false));
      expect(linkPath(an, true)).toBe(b.mbPath(an, true));
    }
  });
});

describe('nature des enjeux corrigée (CARTO-12)', () => {
  it('la correction change le type, comme dans la bêta', () => {
    const base = objetsDe(DONNEES);
    const enjeu = [...base.values()].find((o) => o.type === 'external_issue')!;
    const kinds = { [enjeu.ref]: 'int' as const };
    const objs = objetsDe(DONNEES, kinds);
    expect(objs.get(enjeu.ref)!.type).toBe('internal_issue');
    expect(objs.get(enjeu.ref)!.auto).toBe('ext');
    const b = betaSur(DONNEES, kinds);
    expect(normaliserObjet(b.MB.objs.get(enjeu.ref))).toEqual(JSON.parse(JSON.stringify(objs.get(enjeu.ref))));
  });
});
