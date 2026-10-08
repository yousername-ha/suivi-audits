/* Géométrie des liens (CARTO-06) : portage de mbBBox, mbAnch et mbPath. Courbes en vue contexte, tracés
   orthogonaux à angles arrondis en vue processus. */
import type { Rect } from './layout.js';

/** Rectangle englobant (carte vide : 800 × 500 à l'origine). */
export function boundingBox(nodes: Iterable<Rect>): Rect {
  let x1 = 1e9,
    y1 = 1e9,
    x2 = -1e9,
    y2 = -1e9,
    k = 0;
  for (const n of nodes) {
    k++;
    x1 = Math.min(x1, n.x);
    y1 = Math.min(y1, n.y);
    x2 = Math.max(x2, n.x + n.w);
    y2 = Math.max(y2, n.y + n.h);
  }
  return k ? { x: x1, y: y1, w: x2 - x1, h: y2 - y1 } : { x: 0, y: 0, w: 800, h: 500 };
}

export interface Anchors {
  p1: [number, number];
  p2: [number, number];
  /** v : départ et arrivée sur les bords haut / bas ; h : sur les bords gauche / droit. */
  o: 'v' | 'h';
}

/** Points d'attache d'un lien entre deux rectangles. */
export function anchors(a: Rect, b: Rect): Anchors {
  const ax = a.x + a.w / 2,
    ay = a.y + a.h / 2,
    bx = b.x + b.w / 2,
    by = b.y + b.h / 2,
    cl = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const vg = b.y >= a.y + a.h ? b.y - (a.y + a.h) : a.y >= b.y + b.h ? a.y - (b.y + b.h) : -1,
    hg = b.x >= a.x + a.w ? b.x - (a.x + a.w) : a.x >= b.x + b.w ? a.x - (b.x + b.w) : -1;
  if (vg >= 0 && (hg < 0 || vg >= hg * 0.6)) {
    const dn = b.y >= a.y + a.h,
      o0 = Math.max(a.x, b.x),
      o1 = Math.min(a.x + a.w, b.x + b.w);
    let x1: number, x2: number;
    if (o1 - o0 >= 28) {
      x1 = x2 = cl(a.w <= b.w ? ax : bx, o0 + 14, o1 - 14);
    } else {
      x1 = cl(bx, a.x + 16, a.x + a.w - 16);
      x2 = cl(ax, b.x + 18, b.x + b.w - 18);
    }
    return { p1: [x1, dn ? a.y + a.h : a.y], p2: [x2, dn ? b.y : b.y + b.h], o: 'v' };
  }
  if (hg >= 0) {
    const rt = b.x >= a.x + a.w,
      o0 = Math.max(a.y, b.y),
      o1 = Math.min(a.y + a.h, b.y + b.h);
    let y1: number, y2: number;
    if (o1 - o0 >= 20) {
      y1 = y2 = cl(a.h <= b.h ? ay : by, o0 + 10, o1 - 10);
    } else {
      y1 = cl(by, a.y + 12, a.y + a.h - 12);
      y2 = cl(ay, b.y + 14, b.y + b.h - 14);
    }
    return { p1: [rt ? a.x + a.w : a.x, y1], p2: [rt ? b.x : b.x + b.w, y2], o: 'h' };
  }
  return { p1: [ax, a.y + a.h], p2: [bx, b.y], o: 'v' };
}

/** Tracé SVG (attribut d) d'un lien : courbe de Bézier, ou orthogonal à angles arrondis (ortho). */
export function linkPath(an: Anchors, ortho: boolean): string {
  const [x1, y1] = an.p1,
    [x2, y2] = an.p2;
  if (Math.abs(x1 - x2) < 1.5 || Math.abs(y1 - y2) < 1.5) return `M${x1} ${y1}L${x2} ${y2}`;
  if (!ortho) {
    if (an.o === 'v') {
      const m = (y2 - y1) / 2;
      return `M${x1} ${y1}C${x1} ${y1 + m} ${x2} ${y2 - m} ${x2} ${y2}`;
    }
    const m = (x2 - x1) / 2;
    return `M${x1} ${y1}C${x1 + m} ${y1} ${x2 - m} ${y2} ${x2} ${y2}`;
  }
  const r = Math.min(10, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2),
    sx = Math.sign(x2 - x1),
    sy = Math.sign(y2 - y1);
  if (an.o === 'v') {
    const ym = (y1 + y2) / 2;
    return `M${x1} ${y1}V${ym - sy * r}Q${x1} ${ym} ${x1 + sx * r} ${ym}H${x2 - sx * r}Q${x2} ${ym} ${x2} ${ym + sy * r}V${y2}`;
  }
  const xm = (x1 + x2) / 2;
  return `M${x1} ${y1}H${xm - sx * r}Q${xm} ${y1} ${xm} ${y1 + sy * r}V${y2 - sy * r}Q${xm} ${y2} ${xm + sx * r} ${y2}H${x2}`;
}

/** Milieu d'un lien (pastille « à valider » des propositions). */
export const midpoint = (an: Anchors): [number, number] => [(an.p1[0] + an.p2[0]) / 2, (an.p1[1] + an.p2[1]) / 2];
