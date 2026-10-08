/* Calcul de la scène (CARTO-06) : nœuds visibles, atténuation (préréglage, recherche), relations affichées et
   ordre de dessin. Portage de mbScene, mbPresetMatch et mbStdOn ; le dessin SVG est fait par l'interface. */
import { type Anchors, anchors, linkPath } from './geometry.js';
import { isContainer } from './layout.js';
import {
  type DerivedRelation,
  type MapLayout,
  type MapNode,
  type MapObject,
  type MapView,
  type Referentiel,
  type RelationType,
  isFrame,
} from './model.js';
import type { ObjectLookup } from './objects.js';

export const PRESETS: Record<MapView, { k: string; l: string; ic: string }[]> = {
  context: [
    { k: 'all', l: 'Globale', ic: 'globe' },
    { k: 'scope', l: 'Périmètre', ic: 'frame' },
    { k: 'pi', l: 'Parties intéressées', ic: 'users' },
    { k: 'issues', l: 'Enjeux', ic: 'target' },
  ],
  process: [
    { k: 'all', l: 'Globale', ic: 'globe' },
    { k: 'pil', l: 'Pilotage', ic: 'compass' },
    { k: 'rea', l: 'Réalisation', ic: 'gear' },
    { k: 'sup', l: 'Support', ic: 'tools' },
  ],
};

const IN_SCOPE_TYPES = new Set(['process', 'subprocess', 'application', 'infrastructure', 'site']);
/** L'objet reste-t-il net avec ce préréglage (sinon : atténué, jamais déplacé) ? */
export function presetMatch(view: MapView, preset: string, o: MapObject | undefined): boolean {
  if (preset === 'all' || !o) return true;
  if (view === 'context') {
    if (preset === 'scope')
      return (
        o.type === 'isms' || o.type === 'scope' || (IN_SCOPE_TYPES.has(o.type) && !isFrame(o) && o.scope !== 'out')
      );
    if (preset === 'pi') return o.type === 'isms' || o.type === 'stakeholder' || o.type === 'supplier';
    if (preset === 'issues')
      return ['isms', 'scope', 'band', 'external_issue', 'internal_issue', 'process'].includes(o.type);
    return true;
  }
  const k = ({ pil: 'Management', rea: 'Réalisation', sup: 'Support' } as Record<string, string>)[preset];
  if (o.type === 'lane') return isFrame(o) && o.fam === k;
  if (o.type === 'process' || o.type === 'subprocess') return !isFrame(o) && o.family === k;
  return true;
}

export interface SceneOptions {
  /** Référentiels activés (filtres). */
  std: readonly Referentiel[];
  preset: string;
  /** Recherche (vide : aucune). */
  q: string;
  /** Relations secondaires affichées. */
  sec: boolean;
  /** Propositions de flux affichées (vue processus). */
  gen: boolean;
  /** Export : ni recherche, ni préréglage. */
  export?: boolean;
}
export type SceneNode = [ref: string, node: MapNode, obj: MapObject | undefined];
/** Lien affiché : relation dérivée (der) ou graphique (id, gen éventuel), avec ses points d'attache et son tracé. */
export interface SceneEdge {
  key: string;
  s: string;
  t: string;
  type: RelationType;
  der?: boolean;
  sec?: boolean;
  id?: string;
  gen?: boolean;
  an: Anchors;
  d: string;
}
export interface Scene {
  /** Nœuds visibles, dans l'ordre de la carte. */
  nodes: SceneNode[];
  /** Ordre de dessin : cadres (du plus grand au plus petit), puis liens, puis cartes. */
  containers: SceneNode[];
  cards: SceneNode[];
  edges: SceneEdge[];
  dim: Set<string>;
  hits: Set<string>;
  on: Map<string, MapNode>;
}

/** Scène d'une carte : filtres par référentiel, préréglage, recherche, relations dérivées et graphiques. */
export function computeScene(
  l: MapLayout,
  view: MapView,
  lookup: ObjectLookup,
  relations: readonly DerivedRelation[],
  opt: SceneOptions,
): Scene {
  const q = (opt.export ? '' : opt.q || '').toLowerCase().trim(),
    pre = opt.export ? 'all' : opt.preset || 'all';
  const vis: SceneNode[] = [],
    dim = new Set<string>(),
    hits = new Set<string>();
  for (const [ref, n] of Object.entries(l.nodes)) {
    if (n.hidden) continue;
    const ob = lookup(ref);
    if (
      ob &&
      !isFrame(ob) &&
      ob.std &&
      !ob.std.some((s) => opt.std.includes(s)) &&
      ob.type !== 'isms' &&
      ob.type !== 'scope'
    )
      continue;
    vis.push([ref, n, ob]);
    if (!presetMatch(view, pre, ob)) dim.add(ref);
    if (
      q &&
      ob &&
      !isFrame(ob) &&
      (String(ob.name) + ' ' + (ob.code || '') + ' ' + (ob.sub || '')).toLowerCase().includes(q)
    )
      hits.add(ref);
  }
  if (q) for (const [ref, n, ob] of vis) if (!hits.has(ref) && !isContainer(ob, n)) dim.add(ref);
  const on = new Map(vis.map(([r, n]) => [r, n]));
  const ortho = view === 'process';
  const E: SceneEdge[] = [];
  const geo = (s: string, t: string) => {
    const an = anchors(on.get(s)!, on.get(t)!);
    return { an, d: linkPath(an, ortho) };
  };
  for (const e of relations) {
    if (!on.has(e.s) || !on.has(e.t) || l.hide[e.key]) continue;
    if (e.sec && !opt.sec) continue;
    const a = on.get(e.s)!,
      b = on.get(e.t)!;
    if (e.type === 'contains' && b.x >= a.x && b.y >= a.y && b.x + b.w <= a.x + a.w && b.y + b.h <= a.y + a.h) continue;
    if (e.t === 'scope' && a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h) continue;
    E.push({ ...e, ...geo(e.s, e.t) });
  }
  for (const e of l.edges)
    if (on.has(e.s) && on.has(e.t) && !(e.gen && !opt.gen)) E.push({ key: 'm:' + e.id, ...e, ...geo(e.s, e.t) });
  const order = vis.slice().sort((a, b) => {
    const ca = isContainer(a[2], a[1]) ? 1 : 0,
      cb = isContainer(b[2], b[1]) ? 1 : 0;
    return cb - ca || b[1].w * b[1].h - a[1].w * a[1].h;
  });
  return {
    nodes: vis,
    containers: order.filter(([, n, ob]) => isContainer(ob, n)),
    cards: order.filter(([, n, ob]) => !isContainer(ob, n)),
    edges: E,
    dim,
    hits,
    on,
  };
}
