/* Dispositions automatiques (CARTO-05) : portage à l'identique de mbDefSize, mbLayoutContext et mbLayoutProcess.
   Fonctions pures : mêmes positions que la bêta pour un même jeu d'entrée (tests de parité). */
import { type CartoObject, type MapNode, type MapObject, type MapView, CONTAINER_TYPES, familyOf } from './model.js';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export type Positions = Record<string, Rect>;

/** Un cadre (périmètre, bande, zone) ou un processus assez haut pour contenir ses sous-processus. */
export function isContainer(o: MapObject | undefined | null, n?: { h: number } | null): boolean {
  return !!o && (CONTAINER_TYPES.has(o.type) || (o.type === 'process' && !!n && n.h >= 190));
}

/** Taille par défaut d'un objet sur une carte. */
export function defaultSize(view: MapView, o: MapObject | undefined | null): { w: number; h: number } {
  if (!o) return { w: 200, h: 78 };
  if (view === 'process') return o.type === 'subprocess' ? { w: 220, h: 126 } : { w: 236, h: 156 };
  return o.type === 'isms'
    ? { w: 300, h: 116 }
    : o.type === 'process' || o.type === 'subprocess'
      ? { w: 200, h: 96 }
      : /issue/.test(o.type)
        ? { w: 224, h: 76 }
        : o.type === 'stakeholder' || o.type === 'supplier'
          ? { w: 212, h: 66 }
          : { w: 200, h: 80 };
}

const listOf = (refs: Iterable<string>, objs: ReadonlyMap<string, CartoObject>) =>
  [...refs].map((r) => objs.get(r)).filter((o): o is CartoObject => !!o);
const ASSETS = new Set(['application', 'infrastructure', 'site']);

/** Vue contexte : enjeux externes en haut, périmètre (processus, SMSI, SI) au centre, parties intéressées à gauche,
 *  fournisseurs à droite, enjeux internes en bas, puis zone hors périmètre. */
export function layoutContext(refs: Iterable<string>, objs: ReadonlyMap<string, CartoObject>): Positions {
  const P: Positions = {};
  const L = listOf(refs, objs),
    by = (f: (o: CartoObject) => boolean) => L.filter(f);
  const procIn = by((o) => (o.type === 'process' || o.type === 'subprocess') && o.scope !== 'out').sort((a, b) =>
    String(a.code).localeCompare(String(b.code)),
  );
  const assetsIn = by((o) => ASSETS.has(o.type) && o.scope !== 'out');
  const outs = by((o) => (ASSETS.has(o.type) || o.type === 'process' || o.type === 'subprocess') && o.scope === 'out');
  const pis = by((o) => o.type === 'stakeholder'),
    sups = by((o) => o.type === 'supplier'),
    ext = by((o) => o.type === 'external_issue'),
    int = by((o) => o.type === 'internal_issue');
  const W = 200,
    H = 96,
    G = 18,
    pad = 28,
    C = Math.max(4, Math.min(6, Math.max(procIn.length, assetsIn.length) > 8 ? 6 : 5));
  const rows = (n: number) => Math.ceil(n / C),
    SW = C * W + (C - 1) * G + 2 * pad;
  const prH = rows(procIn.length) * (H + G) - (procIn.length ? G : 0),
    asH = rows(assetsIn.length) * (80 + G) - (assetsIn.length ? G : 0);
  const scH = 86 + (procIn.length ? prH + 56 : 0) + 116 + (assetsIn.length ? 56 + asH : 0) + 30;
  const colH = Math.max(scH, 420),
    fit = Math.max(4, Math.floor((colH + 16) / (66 + 16))),
    perCol = Math.max(fit, Math.ceil(Math.max(pis.length, sups.length) / 2));
  const lc = Math.max(pis.length ? 1 : 0, Math.ceil(pis.length / perCol));
  const x0 = lc * (212 + 16) + (lc ? 44 : 0);
  const bandRows = (n: number) => Math.ceil(n / 4),
    bandH = (n: number) => 48 + bandRows(n) * (76 + 12);
  let y = 0;
  const band = (k: string, list: CartoObject[]) => {
    const bh = bandH(list.length);
    P['band:' + k] = { x: x0, y, w: SW, h: bh };
    const per = Math.min(4, Math.max(1, list.length)),
      cw = Math.floor((SW - 32 - (per - 1) * 14) / per);
    list.forEach((o, i) => {
      P[o.ref] = { x: x0 + 16 + (i % per) * (cw + 14), y: y + 44 + Math.floor(i / per) * (76 + 12), w: cw, h: 76 };
    });
    y += bh + 56;
  };
  if (ext.length) band('ext', ext);
  const sy = y;
  P.scope = { x: x0, y: sy, w: SW, h: scH };
  let iy = sy + 86;
  const row = (list: CartoObject[], h: number) => {
    const n = list.length;
    list.forEach((o, i) => {
      const r = Math.floor(i / C),
        inRow = Math.min(C, n - r * C),
        rw = inRow * W + (inRow - 1) * G;
      P[o.ref] = { x: x0 + (SW - rw) / 2 + (i % C) * (W + G), y: iy + r * (h + G), w: W, h };
    });
  };
  if (procIn.length) {
    row(procIn, H);
    iy += prH + 56;
  }
  P.isms = { x: x0 + (SW - 300) / 2, y: iy, w: 300, h: 116 };
  iy += 116;
  if (assetsIn.length) {
    iy += 56;
    row(assetsIn, 80);
  }
  y = sy + scH + 50;
  const placeOut = () => {
    if (!outs.length) return;
    const zr = Math.ceil(outs.length / C),
      zh = 44 + zr * (H + G);
    P['zone:out'] = { x: x0, y, w: SW, h: zh };
    outs.forEach((o, i) => {
      P[o.ref] = { x: x0 + pad + (i % C) * (W + G), y: y + 40 + Math.floor(i / C) * (H + G), w: W, h: H };
    });
    y += zh + 50;
  };
  const colY = (n: number) => sy + Math.max(0, (scH - (Math.min(n, perCol) * (66 + 16) - 16)) / 2);
  pis.forEach((o, i) => {
    const c = Math.floor(i / perCol),
      k = i % perCol;
    P[o.ref] = { x: (lc - 1 - c) * (212 + 16), y: colY(pis.length) + k * (66 + 16), w: 212, h: 66 };
  });
  sups.forEach((o, i) => {
    const c = Math.floor(i / perCol),
      k = i % perCol;
    P[o.ref] = { x: x0 + SW + 44 + c * (212 + 16), y: colY(sups.length) + k * (66 + 16), w: 212, h: 66 };
  });
  if (int.length) band('int', int);
  placeOut();
  return P;
}

const byCode = (a: CartoObject, b: CartoObject) =>
  String(a.code).localeCompare(String(b.code), 'fr', { numeric: true });

/** Vue processus : bandes pilotage, réalisation, support (et « autres »), sous-processus dans leur parent. */
export function layoutProcess(refs: Iterable<string>, objs: ReadonlyMap<string, CartoObject>): Positions {
  const P: Positions = {};
  const set = new Set(refs);
  const L = listOf(set, objs);
  const top = L.filter((o) => o.type === 'process').sort(byCode);
  const kids = (p: CartoObject) => L.filter((o) => o.type === 'subprocess' && o.parent === p.ref).sort(byCode);
  const orphans = L.filter((o) => o.type === 'subprocess' && !set.has(o.parent ?? ''));
  const lanes = (['pil', 'rea', 'sup', 'oth'] as const)
    .map((k) => ({ k, list: top.filter((o) => familyOf(o.family).k === k).concat(k === 'oth' ? orphans : []) }))
    .filter((l) => l.list.length);
  const GW = 44,
    pad = 28,
    CW = 236,
    CH = 156,
    SWd = 220,
    SH = 126;
  const itemW = (o: CartoObject) => {
      const c = kids(o);
      return c.length ? c.length * SWd + (c.length - 1) * 20 + 32 : CW;
    },
    itemH = (o: CartoObject) => (kids(o).length ? 92 + SH + 20 : CH);
  const LW = Math.max(
    940,
    ...lanes.map((l) => l.list.reduce((a, o) => a + itemW(o), 0) + (l.list.length - 1) * GW + 2 * pad),
  );
  let y = 0;
  lanes.forEach((l) => {
    const h = 86 + Math.max(...l.list.map(itemH)) + 26;
    P['lane:' + l.k] = { x: 0, y, w: LW, h };
    let x = pad;
    l.list.forEach((o) => {
      const w = itemW(o),
        hh = itemH(o);
      P[o.ref] = { x, y: y + 86, w, h: hh };
      kids(o).forEach((c, i) => {
        P[c.ref] = { x: x + 16 + i * (SWd + 20), y: y + 86 + 82, w: SWd, h: SH };
      });
      x += w + GW;
    });
    y += h + 70;
  });
  return P;
}

/** Disposition de la vue demandée. */
export const layoutFor = (view: MapView, refs: Iterable<string>, objs: ReadonlyMap<string, CartoObject>) =>
  view === 'context' ? layoutContext(refs, objs) : layoutProcess(refs, objs);

/** Nœud de carte arrondi à partir d'une position calculée. */
export const nodeFrom = (p: Rect, label: string): MapNode => ({
  x: Math.round(p.x),
  y: Math.round(p.y),
  w: Math.round(p.w),
  h: Math.round(p.h),
  label,
});
