/** Routage de présentation seulement : les traits ne créent aucune relation métier. */
export type PointPartie = [number, number];
export type CartePartie = { id: string; left: number; right: number; top: number; bottom: number };
export type RoutePartie = {
  side: 'internal' | 'external';
  role: 'outlet' | 'trunk' | 'feed' | 'branch';
  points: PointPartie[];
  target?: string;
};
export const cheminPartie = (points: PointPartie[]) => points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');

export function liaisonsParties(
  hub: { cx: number; cy: number; radius: number },
  internes: CartePartie[],
  externes: CartePartie[],
): RoutePartie[] {
  const routes: RoutePartie[] = [];
  for (const [side, cards] of [
    ['internal', internes],
    ['external', externes],
  ] as const) {
    if (!cards.length) continue;
    const px = hub.cx + (side === 'internal' ? -1 : 1) * (hub.radius + 8);
    const cy = (c: CartePartie) => (c.top + c.bottom) / 2;
    const line = (role: RoutePartie['role'], points: PointPartie[], target?: string) => {
      routes.push({ side, role, points, target });
    };
    if (side === 'internal') {
      const rail = (Math.max(...cards.map((c) => c.right)) + px) / 2;
      line('outlet', [
        [px, hub.cy],
        [rail, hub.cy],
      ]);
      line('trunk', [
        [rail, Math.min(hub.cy, ...cards.map(cy))],
        [rail, Math.max(hub.cy, ...cards.map(cy))],
      ]);
      for (const c of cards)
        line(
          'branch',
          [
            [rail, cy(c)],
            [c.right, cy(c)],
          ],
          c.id,
        );
      continue;
    }
    const columns: { left: number; cards: CartePartie[] }[] = [];
    for (const c of [...cards].sort((a, b) => a.left - b.left || a.top - b.top)) {
      let column = columns.find((col) => Math.abs(col.left - c.left) < 1);
      if (!column) {
        column = { left: c.left, cards: [] };
        columns.push(column);
      }
      column.cards.push(c);
    }
    const rails = columns.map((col, i) =>
      i === 0 ? (px + col.left) / 2 : (Math.max(...columns[i - 1]!.cards.map((c) => c.right)) + col.left) / 2,
    );
    const firstRowTop = Math.min(...cards.map((c) => c.top));
    const firstRowBottom = Math.max(...cards.filter((c) => Math.abs(c.top - firstRowTop) < 1).map((c) => c.bottom));
    const nextTop = Math.min(...cards.filter((c) => c.top > firstRowTop + 1).map((c) => c.top));
    const channel = Number.isFinite(nextTop) ? (firstRowBottom + nextTop) / 2 : firstRowTop - 11;
    line('outlet', [
      [px, hub.cy],
      [rails[0]!, hub.cy],
    ]);
    if (columns.length > 1)
      line('feed', [
        [rails[0]!, channel],
        [rails.at(-1)!, channel],
      ]);
    columns.forEach((col, i) => {
      const ys = [...col.cards.map(cy), ...(i === 0 ? [hub.cy] : []), ...(columns.length > 1 ? [channel] : [])];
      line('trunk', [
        [rails[i]!, Math.min(...ys)],
        [rails[i]!, Math.max(...ys)],
      ]);
      for (const c of col.cards)
        line(
          'branch',
          [
            [rails[i]!, cy(c)],
            [c.left, cy(c)],
          ],
          c.id,
        );
    });
  }
  return routes;
}

/** Chemins continus pour deux points décoratifs, un par nature. */
export function parcoursParties(routes: RoutePartie[]) {
  return routes
    .filter((r) => r.role === 'branch')
    .map((branch) => {
      const outlet = routes.find((r) => r.side === branch.side && r.role === 'outlet')!;
      const feed = routes.find((r) => r.side === branch.side && r.role === 'feed');
      const points: PointPartie[] = [...outlet.points];
      if (feed && Math.abs(branch.points[0]![0] - outlet.points[1]![0]) > 1)
        points.push(feed.points[0]!, [branch.points[0]![0], feed.points[0]![1]]);
      points.push(...branch.points);
      return { ...branch, points };
    });
}
