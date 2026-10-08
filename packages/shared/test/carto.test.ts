/* Cartographie : schéma de disposition (CARTO-03), actions d'édition (CARTO-07), synchronisation (CARTO-08),
   ajout (CARTO-09), droits par module d'origine (CARTO-01), bornes de génération (CARTO-05). */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GENERATE_MAX,
  MapLayoutSchema,
  addEdge,
  addObjects,
  blankLayout,
  buildObjects,
  cartoContext,
  computeScene,
  defaultGenerateOptions,
  dragGroup,
  dropMissing,
  generateLayout,
  hideRelation,
  moveGroup,
  pruneEdges,
  refModule,
  removeNode,
  resizeNode,
  selectForGeneration,
  syncInfo,
  validateEdge,
  withDependencies,
} from '../src/carto/index.js';

const RACINE = path.resolve(import.meta.dirname, '../../..');
const DONNEES = JSON.parse(readFileSync(path.join(RACINE, 'tests/fixtures/carto-donnees.json'), 'utf8')) as Record<
  string,
  unknown
>;
const objs = buildObjects(DONNEES, { org: 'Organisation fictive', details: true });
const ctx = cartoContext(objs);
let n = 0;
const id = () => `e${n++}`;
const contexte = () => {
  const fd = defaultGenerateOptions('context', objs);
  return generateLayout(null, ctx, 'context', selectForGeneration(ctx, 'context', fd), fd, id);
};
const processus = () => {
  const fd = defaultGenerateOptions('process', objs);
  return generateLayout(null, ctx, 'process', selectForGeneration(ctx, 'process', fd), fd, id);
};

describe('jeu de recette (RECETTE.md)', () => {
  it('contient les objets attendus', () => {
    const c = (t: string) => [...objs.values()].filter((o) => o.type === t).length;
    expect(c('process') + c('subprocess')).toBe(8);
    expect(c('subprocess')).toBe(2);
    expect(c('stakeholder')).toBe(4);
    expect(c('supplier')).toBe(8);
    expect(c('application')).toBe(2);
    expect(c('site')).toBe(1);
    expect(c('infrastructure')).toBe(1);
    expect(objs.get('sup:SUP-101')).toMatchObject({ hds: true, crit: true, std: ['ISO 27001', 'HDS'] });
    expect(objs.get('process:PRS-001.1')).toMatchObject({ type: 'subprocess', parent: 'process:PRS-001', scope: 'in' });
    expect(objs.get('process:PRP-001')!.scope).toBe('out');
    expect(objs.get('app:APP-101')).toMatchObject({ supRef: 'sup:SUP-103', scope: 'in' });
  });
  it('calcule les indicateurs KO et la fiche détaillée sans données brutes', () => {
    const p = objs.get('process:PRR-001')!;
    expect(p.nKo).toBe(1);
    expect(p.details!.indicators!.map((i) => i.st)).toEqual(['ko', 'ok']);
    expect(p.details!.swot).toMatchObject({ id: 'SWOT-102', S: 1, W: 1, O: 1, T: 1 });
    expect(objs.get('process:PRS-001')!.details!.children!.map((c) => c.code)).toEqual(['PRS-001.1', 'PRS-001.2']);
    expect(objs.get('isms')!.details!.counts).toContainEqual({ label: 'Écarts ouverts', value: 1 });
    expect(JSON.stringify([...objs.values()])).not.toContain('"data"');
  });
  it('sans les clés d’un module non lisible, ses objets sont absents (CARTO-01)', () => {
    const { suppliers: _s, ...sansFournisseurs } = DONNEES;
    const o = buildObjects(sansFournisseurs, { org: 'X' });
    expect([...o.values()].some((x) => x.type === 'supplier')).toBe(false);
    expect(o.get('app:APP-101')!.supRef).toBe('');
    expect(refModule('sup:SUP-101')).toBe('fournisseurs');
    expect(refModule('app:APP-1')).toBe('conformite');
    expect(refModule('process:P')).toBe('pilotage');
    expect(refModule('lane:pil')).toBeNull();
    expect(refModule('isms')).toBeNull();
  });
});

describe('génération (CARTO-05)', () => {
  it('vue contexte : SMSI au centre du périmètre, PI à gauche, fournisseurs à droite, bandes d’enjeux', () => {
    const l = contexte();
    const sc = l.nodes.scope!,
      isms = l.nodes.isms!;
    expect(isms.x).toBeGreaterThan(sc.x);
    expect(isms.x + isms.w).toBeLessThan(sc.x + sc.w);
    expect(l.nodes['pi:PI-001']!.x + 212).toBeLessThanOrEqual(sc.x);
    expect(l.nodes['sup:SUP-101']!.x).toBeGreaterThanOrEqual(sc.x + sc.w);
    expect(l.nodes['band:ext']!.y).toBeLessThan(sc.y);
    expect(l.nodes['band:int']!.y).toBeGreaterThan(sc.y + sc.h);
    expect(l.nodes['zone:out']).toBeDefined();
    // Fournisseurs « critiques ou HDS, et liés à une application » : les autres sont ignorés.
    expect(l.nodes['sup:SUP-106']).toBeUndefined();
    expect(l.ignored['sup:SUP-106']).toBe(1);
    expect(MapLayoutSchema.safeParse(l).success).toBe(true);
  });
  it('vue processus : 3 bandes, sous-processus dans le parent, propositions à valider', () => {
    const l = processus();
    expect(Object.keys(l.nodes).filter((r) => r.startsWith('lane:'))).toEqual(['lane:pil', 'lane:rea', 'lane:sup']);
    const p = l.nodes['process:PRS-001']!,
      c = l.nodes['process:PRS-001.1']!;
    expect(c.x).toBeGreaterThan(p.x);
    expect(c.x + c.w).toBeLessThan(p.x + p.w);
    expect(l.edges.every((e) => e.gen)).toBe(true);
    expect(l.edges.filter((e) => e.type === 'flows_to').map((e) => [e.s, e.t])).toEqual([
      ['process:PRR-001', 'process:PRR-002'],
      ['process:PRP-001', 'process:PRP-002'],
    ]);
    expect(l.edges.filter((e) => e.s === 'lane:sup')).toHaveLength(2);
  });
  it('compte au-delà des seuils (confirmation 80, refus 400)', () => {
    const big = {
      processes: Array.from({ length: GENERATE_MAX + 5 }, (_, i) => ({
        id: `P-${i}`,
        name: `P ${i}`,
        family: 'Support',
      })),
    };
    const o = buildObjects(big, { org: 'X' });
    const refs = selectForGeneration(cartoContext(o), 'process', defaultGenerateOptions('process', o));
    expect(refs.length).toBeGreaterThan(GENERATE_MAX);
    const l = generateLayout(null, cartoContext(o), 'process', refs.slice(0, GENERATE_MAX - 1), {}, id);
    expect(Object.keys(l.nodes)).toHaveLength(GENERATE_MAX);
    expect(MapLayoutSchema.safeParse(l).success).toBe(true);
  });
});

describe('édition (CARTO-07)', () => {
  it('retirer un objet ne touche que la carte et le marque ignoré', () => {
    const l = processus();
    const r = removeNode(l, 'process:PRR-001');
    expect(r.nodes['process:PRR-001']).toBeUndefined();
    expect(r.ignored['process:PRR-001']).toBe(1);
    expect(r.edges.some((e) => e.s === 'process:PRR-001' || e.t === 'process:PRR-001')).toBe(false);
    expect(l.nodes['process:PRR-001']).toBeDefined();
    expect(objs.has('process:PRR-001')).toBe(true);
    expect(removeNode(l, 'lane:pil').ignored['lane:pil']).toBeUndefined();
  });
  it('déplacer un cadre emporte les objets entièrement contenus', () => {
    const l = contexte();
    const grp = dragGroup(l, 'scope', ctx.lookup);
    expect(grp).toContain('isms');
    expect(grp).toContain('process:PRR-001');
    expect(grp).not.toContain('pi:PI-001');
    const start = grp.map((r) => [r, l.nodes[r]!.x, l.nodes[r]!.y] as [string, number, number]);
    const m = moveGroup(l, start, 60, 40);
    expect(m.nodes.isms!.x - l.nodes.isms!.x).toBe(60);
    expect(m.nodes['pi:PI-001']).toEqual(l.nodes['pi:PI-001']);
  });
  it('redimensionner respecte les minimums', () => {
    const l = contexte();
    expect(resizeNode(l, 'pi:PI-001', 212, 66, -500, -500, ctx.lookup).nodes['pi:PI-001']).toMatchObject({
      w: 140,
      h: 52,
    });
    expect(resizeNode(l, 'scope', 400, 400, -500, -500, ctx.lookup).nodes.scope).toMatchObject({ w: 240, h: 120 });
  });
  it('relations graphiques, propositions validées et relations métier masquées', () => {
    let l = processus();
    l = addEdge(l, 'process:PRR-001', 'process:PRS-002', 'depends_on', 'manuel1');
    expect(l.edges.at(-1)).toEqual({ id: 'manuel1', s: 'process:PRR-001', t: 'process:PRS-002', type: 'depends_on' });
    const g = l.edges.find((e) => e.gen)!;
    l = validateEdge(l, g.id);
    expect(l.edges.find((e) => e.id === g.id)!.gen).toBeUndefined();
    l = hideRelation(l, 'd:process:PRS-001>process:PRS-001.1:contains');
    expect(MapLayoutSchema.safeParse(l).success).toBe(true);
  });
  it('les relations vers un objet absent sont refusées par le schéma, puis élaguées', () => {
    const l = addEdge(blankLayout('context'), 'isms', 'scope', 'related_to', 'x1');
    expect(MapLayoutSchema.safeParse(l).success).toBe(false);
    expect(pruneEdges(l).edges).toHaveLength(0);
  });
});

describe('synchronisation et ajout (CARTO-08, CARTO-09)', () => {
  it('nouveaux objets, objets indisponibles, ajout près d’un voisin sans chevauchement', () => {
    let l = contexte();
    l.nodes['pi:PI-999'] = { x: 0, y: 0, w: 212, h: 66, label: 'Partie supprimée' };
    const s = syncInfo(l, objs, 'context');
    expect(s.miss).toEqual(['pi:PI-999']);
    expect(s.news).toHaveLength(0); // les objets non retenus sont ignorés
    l = dropMissing(l, s.miss);
    expect(l.nodes['pi:PI-999']).toBeUndefined();
    const avec = buildObjects(
      {
        ...DONNEES,
        interested: [...(DONNEES.interested as object[]), { id: 'PI-005', name: 'Nouvelle partie', type: 'Externe' }],
      },
      { org: 'X' },
    );
    const s2 = syncInfo(l, avec, 'context');
    expect(s2.news.map((o) => o.ref)).toEqual(['pi:PI-005']);
    const c2 = cartoContext(avec);
    const a = addObjects(l, withDependencies(['pi:PI-005'], 0, l, c2, 'context'), 'context', c2);
    const n = a.nodes['pi:PI-005']!;
    for (const [r, m] of Object.entries(a.nodes)) {
      if (r === 'pi:PI-005' || ['scope', 'band:ext', 'band:int', 'zone:out'].includes(r)) continue;
      const chevauche = n.x < m.x + m.w && n.x + n.w > m.x && n.y < m.y + m.h && n.y + n.h > m.y;
      expect(chevauche, r).toBe(false);
    }
  });
});

describe('scène (CARTO-06)', () => {
  it('filtre HDS désactivé : seuls les objets HDS seuls sont masqués ; préréglage sans déplacement', () => {
    const l = contexte();
    const all = computeScene(l, 'context', ctx.lookup, ctx.relations, {
      std: ['ISO 27001', 'HDS'],
      preset: 'all',
      q: '',
      sec: false,
      gen: true,
    });
    const iso = computeScene(l, 'context', ctx.lookup, ctx.relations, {
      std: ['ISO 27001'],
      preset: 'pi',
      q: '',
      sec: false,
      gen: true,
    });
    expect(iso.nodes.length).toBe(all.nodes.length); // aucun objet n'est « HDS seul » dans le jeu de recette
    const hds = computeScene(l, 'context', ctx.lookup, ctx.relations, {
      std: ['HDS'],
      preset: 'all',
      q: '',
      sec: false,
      gen: true,
    });
    expect(hds.nodes.some(([r]) => r === 'pi:PI-001')).toBe(false);
    expect(iso.dim.has('process:PRR-001')).toBe(true);
    expect(iso.on.get('process:PRR-001')).toEqual(l.nodes['process:PRR-001']);
  });
  it('recherche « achat » : un résultat, le reste atténué', () => {
    const l = contexte();
    const s = computeScene(l, 'context', ctx.lookup, ctx.relations, {
      std: ['ISO 27001', 'HDS'],
      preset: 'all',
      q: 'achat',
      sec: false,
      gen: true,
    });
    expect([...s.hits]).toEqual(['process:PRS-001']);
    expect(s.dim.has('isms')).toBe(true);
    expect(s.dim.has('scope')).toBe(false);
  });
});

describe('schéma de disposition (CARTO-03)', () => {
  const ok = { nodes: { isms: { x: 0, y: 0, w: 300, h: 116, label: '' } }, edges: [], hide: {}, ignored: {} };
  it.each([
    ['coordonnée infinie', { nodes: { isms: { ...ok.nodes.isms, x: Infinity } } }],
    ['taille trop petite', { nodes: { isms: { ...ok.nodes.isms, w: 10 } } }],
    ['taille trop grande', { nodes: { isms: { ...ok.nodes.isms, h: 250000 } } }],
    ['référence inconnue', { nodes: { 'autre:x': ok.nodes.isms } }],
    ['type de relation inconnu', { edges: [{ id: 'a', s: 'isms', t: 'isms', type: 'mange' }] }],
    [
      'plus de 400 objets',
      { nodes: Object.fromEntries(Array.from({ length: 401 }, (_, i) => [`pi:${i}`, ok.nodes.isms])) },
    ],
  ])('refuse : %s', (_n, patch) => {
    expect(MapLayoutSchema.safeParse({ ...ok, ...patch }).success).toBe(false);
  });
  it('accepte une carte vierge et complète les champs absents', () => {
    expect(MapLayoutSchema.parse({ nodes: ok.nodes })).toEqual(ok);
  });
});
