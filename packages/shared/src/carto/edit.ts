/* Génération assistée, synchronisation, ajout et modifications d'une carte (CARTO-05, 07, 08, 09).
   Portage de mbGenerate, mbProcessGenEdges, mbSyncInfo, mbPlace, mbAddDialog et des actions d'édition de la bêta.
   Toutes les fonctions sont pures : elles rendent une nouvelle disposition sans modifier celle reçue. Les
   identifiants des relations créées sont fournis par l'appelant (`newId`), sans hasard dans le code partagé. */
import { boundingBox } from './geometry.js';
import { type Rect, defaultSize, isContainer, layoutFor, nodeFrom } from './layout.js';
import {
  type CartoObject,
  type DerivedRelation,
  type MapEdge,
  type MapLayout,
  type MapView,
  type ObjectType,
  type RelationType,
  emptyLayout,
  familyOf,
  isMapOnlyRef,
} from './model.js';
import { type ObjectLookup, deriveRelations, lookupIn, mapOnlyObject } from './objects.js';

/** Au-delà : confirmation ; au-delà de GENERATE_MAX : refus (CARTO-05). */
export const GENERATE_CONFIRM = 80;
export const GENERATE_MAX = 400;
/** Niveaux d'annulation (CARTO-07). */
export const UNDO_LEVELS = 60;

/** Types suivis par la synchronisation (bandeau « nouveaux objets ») et marqués « ignorés » après génération. */
export const SYNC_TYPES: Record<MapView, readonly ObjectType[]> = {
  context: [
    'process',
    'stakeholder',
    'external_issue',
    'internal_issue',
    'application',
    'infrastructure',
    'site',
    'supplier',
  ],
  process: ['process', 'subprocess'],
};
/** Types proposés par « Ajouter depuis la plateforme ». */
export const ADD_TYPES: Record<MapView, readonly ObjectType[]> = {
  context: [
    'process',
    'subprocess',
    'stakeholder',
    'external_issue',
    'internal_issue',
    'application',
    'site',
    'infrastructure',
    'supplier',
  ],
  process: ['process', 'subprocess'],
};

export const clone = (l: MapLayout): MapLayout => structuredClone(l);

/** Contexte de calcul : objets de la plateforme et relations dérivées. */
export interface CartoContext {
  objs: ReadonlyMap<string, CartoObject>;
  relations: DerivedRelation[];
  lookup: ObjectLookup;
}
export function cartoContext(objs: ReadonlyMap<string, CartoObject>): CartoContext {
  return { objs, relations: deriveRelations(objs), lookup: lookupIn(objs) };
}

/* ---------------------------------------------------------------- Génération */
export interface GenerateOptions {
  /** Vue contexte : types retenus. */
  process?: boolean;
  subprocess?: boolean;
  stakeholder?: boolean;
  supplier?: boolean;
  external_issue?: boolean;
  internal_issue?: boolean;
  application?: boolean;
  /** Sites et infrastructures. */
  assets?: boolean;
  /** Origine des enjeux : objectifs, SWOT. */
  iss_obj?: boolean;
  iss_swot?: boolean;
  /** Fournisseurs : critiques, HDS ou liés à une application (crit), ou tous (all). */
  sups?: 'crit' | 'all';
  /** Profondeur 1 à 3 (parcours depuis le SMSI et le périmètre). */
  depth?: 1 | 2 | 3;
  /** Carte existante : remplacer la disposition ou compléter (conserver les positions). */
  mode?: 'replace' | 'complete';
  /** Vue processus : propositions de flux et liens support / pilotage. */
  flows?: boolean;
  lanes?: boolean;
}

/** Options par défaut de l'assistant (identiques à la bêta). */
export function defaultGenerateOptions(view: MapView, objs: ReadonlyMap<string, CartoObject>): GenerateOptions {
  if (view === 'process') return { process: true, subprocess: true, flows: true, lanes: true, mode: 'replace' };
  const qualified = [...objs.values()].some((o) => o.type === 'supplier' && (o.crit || o.hds));
  return {
    process: true,
    subprocess: false,
    stakeholder: true,
    supplier: true,
    external_issue: true,
    internal_issue: true,
    application: true,
    assets: true,
    iss_obj: true,
    iss_swot: true,
    sups: qualified ? 'crit' : 'all',
    depth: 2,
    mode: 'replace',
  };
}

/** Objets retenus par l'assistant, dans l'ordre de la bêta (l'ordre fixe la disposition). */
export function selectForGeneration(ctx: CartoContext, view: MapView, fd: GenerateOptions): string[] {
  const all = [...ctx.objs.values()];
  const refs = new Set<string>();
  if (view === 'context') {
    const T = new Set<string>(['isms', 'scope']);
    for (const t of [
      'process',
      'subprocess',
      'stakeholder',
      'supplier',
      'external_issue',
      'internal_issue',
      'application',
    ] as const)
      if (fd[t]) T.add(t);
    if (fd.assets) {
      T.add('site');
      T.add('infrastructure');
    }
    const appSup = new Set(
      all.filter((o) => o.type === 'application' && T.has('application') && o.supRef).map((o) => o.supRef!),
    );
    const ok = (o: CartoObject) =>
      T.has(o.type) &&
      (o.type !== 'supplier' || fd.sups === 'all' || !!o.crit || !!o.hds || appSup.has(o.ref)) &&
      (!/issue/.test(o.type) ||
        (o.src ?? []).some((s) => (s.k === 'obj' && fd.iss_obj) || (s.k === 'swot' && fd.iss_swot)));
    const adj = new Map<string, string[]>();
    const push = (k: string, v: string) => {
      const l = adj.get(k);
      if (l) l.push(v);
      else adj.set(k, [v]);
    };
    for (const e of ctx.relations) {
      push(e.s, e.t);
      push(e.t, e.s);
    }
    refs.add('isms');
    refs.add('scope');
    let front = ['isms', 'scope'];
    const D = Number(fd.depth) || 2;
    for (let d = 0; d < (D >= 3 ? 20 : D) && front.length; d++) {
      const nx: string[] = [];
      for (const r of front)
        for (const t of adj.get(r) ?? []) {
          const o = ctx.objs.get(t);
          if (o && !refs.has(t) && ok(o)) {
            refs.add(t);
            nx.push(t);
          }
        }
      front = nx;
    }
    if (D >= 2) for (const o of all) if (o.type === 'process' && ok(o)) refs.add(o.ref);
  } else {
    for (const o of all)
      if ((o.type === 'process' && fd.process) || (o.type === 'subprocess' && fd.subprocess)) refs.add(o.ref);
  }
  return [...refs];
}

/** Propositions de relations de la vue processus (à valider sur la carte). */
export function processProposals(
  refs: Iterable<string>,
  objs: ReadonlyMap<string, CartoObject>,
  opt: { flows?: boolean; lanes?: boolean },
  newId: () => string,
): MapEdge[] {
  const E: MapEdge[] = [];
  const L = [...refs].map((r) => objs.get(r)).filter((o): o is CartoObject => !!o && o.type === 'process');
  const fam = (k: string) =>
    L.filter((o) => familyOf(o.family).k === k).sort((a, b) =>
      String(a.code).localeCompare(String(b.code), 'fr', { numeric: true }),
    );
  if (opt.flows)
    for (const k of ['rea', 'pil']) {
      const f = fam(k);
      for (let i = 0; i + 1 < f.length; i++)
        E.push({ id: newId(), s: f[i]!.ref, t: f[i + 1]!.ref, type: 'flows_to', gen: true });
    }
  if (opt.lanes) {
    const rea = fam('rea');
    if (fam('sup').length)
      for (const o of rea) E.push({ id: newId(), s: 'lane:sup', t: o.ref, type: 'supports', gen: true });
    if (fam('pil').length)
      for (const o of rea) E.push({ id: newId(), s: 'lane:pil', t: o.ref, type: 'applies_to', gen: true });
  }
  return E;
}

/** Applique la génération à une carte (existante ou non). Les objets non retenus deviennent « ignorés ». */
export function generateLayout(
  prev: MapLayout | null,
  ctx: CartoContext,
  view: MapView,
  refList: readonly string[],
  fd: GenerateOptions,
  newId: () => string,
): MapLayout {
  const refs = new Set(refList);
  const complete = fd.mode === 'complete' && !!prev;
  let w = prev ? clone(prev) : emptyLayout();
  if (!complete) {
    w.nodes = {};
    w.edges = w.edges.filter((e) => !e.gen);
    w.hide = {};
  }
  if (complete) {
    for (const r of refs) if (!w.nodes[r]) w = placeNode(w, r, view, ctx);
  } else {
    const P = layoutFor(view, refs, ctx.objs);
    for (const [r, p] of Object.entries(P)) w.nodes[r] = nodeFrom(p, ctx.lookup(r)?.name ?? '');
  }
  if (view === 'process' && (fd.flows || fd.lanes)) {
    const ex = new Set(w.edges.map((e) => e.s + '>' + e.t + ':' + e.type));
    for (const e of processProposals(refs, ctx.objs, { flows: fd.flows, lanes: fd.lanes }, newId))
      if (w.nodes[e.s] && w.nodes[e.t] && !ex.has(e.s + '>' + e.t + ':' + e.type)) w.edges.push(e);
  }
  for (const r of Object.keys(w.ignored)) if (refs.has(r)) delete w.ignored[r];
  const types = new Set<string>(SYNC_TYPES[view]);
  for (const o of ctx.objs.values()) if (types.has(o.type) && !refs.has(o.ref) && !w.nodes[o.ref]) w.ignored[o.ref] = 1;
  return pruneEdges(w);
}

/** Retire les relations graphiques dont une extrémité n'est plus sur la carte (règle du schéma). */
export function pruneEdges(l: MapLayout): MapLayout {
  if (l.edges.every((e) => l.nodes[e.s] && l.nodes[e.t])) return l;
  return { ...l, edges: l.edges.filter((e) => l.nodes[e.s] && l.nodes[e.t]) };
}

/** Recalcule la disposition des objets présents (« Disposition automatique »). */
export function relayout(l: MapLayout, ctx: CartoContext, view: MapView): MapLayout {
  const w = clone(l);
  const refs = new Set(Object.keys(w.nodes).filter((r) => !isMapOnlyRef(r) && ctx.objs.has(r)));
  const P = layoutFor(view, refs, ctx.objs);
  for (const r of Object.keys(w.nodes)) if (mapOnlyObject(r) && !P[r]) delete w.nodes[r];
  for (const [r, p] of Object.entries(P)) {
    const n = nodeFrom(p, '');
    w.nodes[r] = Object.assign(w.nodes[r] ?? { label: ctx.lookup(r)?.name ?? '' }, { x: n.x, y: n.y, w: n.w, h: n.h });
  }
  return pruneEdges(w);
}

/* ---------------------------------------------------------------- Synchronisation (CARTO-08) */
export interface SyncInfo {
  /** Objets de la carte absents de la plateforme (ou non accessibles). */
  miss: string[];
  /** Objets de la plateforme ni sur la carte ni ignorés. */
  news: CartoObject[];
}
export function syncInfo(l: MapLayout | null, objs: ReadonlyMap<string, CartoObject>, view: MapView): SyncInfo {
  if (!l) return { miss: [], news: [] };
  const miss = Object.keys(l.nodes).filter((r) => !mapOnlyObject(r) && !objs.has(r));
  const types = new Set<string>(SYNC_TYPES[view]);
  const news = [...objs.values()].filter((o) => types.has(o.type) && !l.nodes[o.ref] && !l.ignored[o.ref]);
  return { miss, news };
}

/* ---------------------------------------------------------------- Placement et ajout (CARTO-09) */
/** Place un objet près d'un voisin déjà sur la carte, sans chevauchement, sinon à droite de l'ensemble. */
export function placeNode(l: MapLayout, ref: string, view: MapView, ctx: CartoContext): MapLayout {
  const w = clone(l);
  const o = ctx.lookup(ref),
    sz = defaultSize(view, o);
  const nb = ctx.relations
    .filter((e) => (e.s === ref && w.nodes[e.t]) || (e.t === ref && w.nodes[e.s]))
    .map((e) => (e.s === ref ? e.t : e.s))
    .filter((r) => !isContainer(ctx.lookup(r), w.nodes[r]));
  const cards: Rect[] = Object.entries(w.nodes)
    .filter(([r, n]) => !n.hidden && !isContainer(ctx.lookup(r), n))
    .map(([, n]) => n);
  const free = (x: number, y: number) =>
    !cards.some((n) => x < n.x + n.w + 16 && x + sz.w + 16 > n.x && y < n.y + n.h + 16 && y + sz.h + 16 > n.y);
  let ax: number, ay: number;
  if (nb.length) {
    const a = w.nodes[nb[0]!]!;
    ax = a.x;
    ay = a.y;
  } else {
    const bb = boundingBox(Object.values(w.nodes));
    ax = bb.x + bb.w + 60;
    ay = bb.y;
  }
  const step = [sz.w + 24, sz.h + 20] as const;
  for (let rr = nb.length ? 1 : 0; rr < 30; rr++) {
    const C: [number, number][] = [];
    for (let i = -rr; i <= rr; i++) C.push([rr, i], [i, rr], [-rr, i], [i, -rr]);
    for (const [i, j] of C) {
      const x = ax + i * step[0],
        y = ay + j * step[1];
      if (free(x, y)) {
        w.nodes[ref] = { x: Math.round(x), y: Math.round(y), w: sz.w, h: sz.h, label: o ? o.name : '' };
        return w;
      }
    }
  }
  w.nodes[ref] = { x: ax, y: ay + 400, w: sz.w, h: sz.h, label: o ? o.name : '' };
  return w;
}

/** Sélection étendue aux objets liés : 0 = l'objet seul, 1 = dépendances directes, 9 = tous les objets liés. */
export function withDependencies(
  selected: readonly string[],
  depth: number,
  l: MapLayout,
  ctx: CartoContext,
  view: MapView,
): string[] {
  const set = new Set(selected);
  if (!depth) return [...set];
  const allowed = new Set<string>([...ADD_TYPES[view], 'isms', 'scope']);
  let front = [...set];
  for (let d = 0; d < depth && front.length; d++) {
    const nx: string[] = [];
    for (const x of front)
      for (const e of ctx.relations) {
        const t = e.s === x ? e.t : e.t === x ? e.s : null;
        if (t && !set.has(t) && !l.nodes[t] && allowed.has(ctx.objs.get(t)?.type ?? '')) {
          set.add(t);
          nx.push(t);
        }
      }
    front = nx;
  }
  return [...set];
}

/** Ajoute des objets à la carte (placement automatique) et les retire des objets ignorés. */
export function addObjects(l: MapLayout, refs: readonly string[], view: MapView, ctx: CartoContext): MapLayout {
  let w = clone(l);
  for (const x of refs) {
    if (!w.nodes[x]) w = placeNode(w, x, view, ctx);
    delete w.ignored[x];
  }
  return w;
}

/* ---------------------------------------------------------------- Actions d'édition (CARTO-07) */
/** Retire un objet de la carte (jamais de la plateforme) ; un objet de la plateforme devient « ignoré ». */
export function removeNode(l: MapLayout, ref: string): MapLayout {
  const w = clone(l);
  delete w.nodes[ref];
  w.edges = w.edges.filter((e) => e.s !== ref && e.t !== ref);
  if (!mapOnlyObject(ref)) w.ignored[ref] = 1;
  return w;
}
/** Retire les objets indisponibles. */
export function dropMissing(l: MapLayout, miss: readonly string[]): MapLayout {
  const w = clone(l);
  for (const r of miss) {
    delete w.nodes[r];
    w.edges = w.edges.filter((e) => e.s !== r && e.t !== r);
  }
  return w;
}
/** Ignore les nouveaux objets (plus de bandeau pour eux). */
export function ignoreObjects(l: MapLayout, refs: readonly string[]): MapLayout {
  const w = clone(l);
  for (const r of refs) w.ignored[r] = 1;
  return w;
}
/** Objets entraînés avec un cadre déplacé (entièrement contenus, plus petits). */
export function dragGroup(l: MapLayout, ref: string, lookup: ObjectLookup): string[] {
  const n = l.nodes[ref];
  if (!n) return [];
  const grp = [ref];
  if (isContainer(lookup(ref), n))
    for (const [r2, n2] of Object.entries(l.nodes)) {
      if (r2 === ref || n2.hidden) continue;
      if (
        n2.w * n2.h < n.w * n.h &&
        n2.x >= n.x - 1 &&
        n2.y >= n.y - 1 &&
        n2.x + n2.w <= n.x + n.w + 1 &&
        n2.y + n2.h <= n.y + n.h + 1
      )
        grp.push(r2);
    }
  return grp;
}
/** Déplace un groupe d'objets (positions de départ + décalage, arrondi au pixel). */
export function moveGroup(l: MapLayout, start: readonly [string, number, number][], dx: number, dy: number): MapLayout {
  const w = { ...l, nodes: { ...l.nodes } };
  for (const [r, x, y] of start) {
    const n = w.nodes[r];
    if (n) w.nodes[r] = { ...n, x: Math.round(x + dx), y: Math.round(y + dy) };
  }
  return w;
}
/** Redimensionne (minimum 240 × 120 pour un cadre, 140 × 52 pour une carte). */
export function resizeNode(
  l: MapLayout,
  ref: string,
  w0: number,
  h0: number,
  dx: number,
  dy: number,
  lookup: ObjectLookup,
): MapLayout {
  const n = l.nodes[ref];
  if (!n) return l;
  const cont = isContainer(lookup(ref), n);
  const nw = Math.max(cont ? 240 : 140, Math.round(w0 + dx));
  const nh = Math.max(cont ? 120 : 52, Math.round(h0 + dy));
  return { ...l, nodes: { ...l.nodes, [ref]: { ...n, w: nw, h: nh } } };
}
/** Taille par défaut d'un objet. */
export function resetSize(l: MapLayout, ref: string, view: MapView, lookup: ObjectLookup): MapLayout {
  const n = l.nodes[ref];
  if (!n) return l;
  return { ...l, nodes: { ...l.nodes, [ref]: { ...n, ...defaultSize(view, lookup(ref)) } } };
}
/** Crée une relation graphique. */
export function addEdge(l: MapLayout, s: string, t: string, type: RelationType, id: string): MapLayout {
  return { ...l, edges: [...l.edges, { id, s, t, type }] };
}
export function deleteEdge(l: MapLayout, id: string): MapLayout {
  return { ...l, edges: l.edges.filter((e) => e.id !== id) };
}
/** Valide une proposition : elle devient une relation graphique. */
export function validateEdge(l: MapLayout, id: string): MapLayout {
  return {
    ...l,
    edges: l.edges.map((e) => {
      if (e.id !== id) return e;
      const { gen: _gen, ...rest } = e;
      return rest;
    }),
  };
}
export function setEdgeType(l: MapLayout, id: string, type: RelationType): MapLayout {
  return { ...l, edges: l.edges.map((e) => (e.id === id ? { ...e, type } : e)) };
}
/** Masque une relation métier sur cette carte seulement. */
export function hideRelation(l: MapLayout, key: string): MapLayout {
  return { ...l, hide: { ...l.hide, [key]: 1 } };
}
/** Met à jour le dernier libellé connu des objets présents (à l'enregistrement). */
export function refreshLabels(l: MapLayout, objs: ReadonlyMap<string, CartoObject>): MapLayout {
  const w = clone(l);
  for (const [r, n] of Object.entries(w.nodes)) {
    const o = objs.get(r);
    if (o) n.label = o.name;
  }
  return w;
}
/** Carte vierge : vue contexte avec le SMSI seul. */
export function blankLayout(view: MapView): MapLayout {
  const l = emptyLayout();
  if (view === 'context') l.nodes.isms = { x: 0, y: 0, w: 300, h: 116, label: '' };
  return l;
}
