/* Canevas SVG de la carte (CARTO-06, CARTO-07) : zoom (molette, pincement, boutons), panoramique, sélection,
   déplacement (un cadre emporte son contenu), redimensionnement, liaison, aperçu cliquable. Le zoom ne modifie jamais
   les positions enregistrées. Redessin limité à requestAnimationFrame pendant les glisser-déposer. */
import { ActionIcon, Tooltip } from '@mantine/core';
import {
  boundingBox,
  dragGroup,
  isContainer,
  moveGroup,
  refModule,
  resizeNode,
  type MapLayout,
  type MapView,
  type ObjectLookup,
  type Scene,
} from '@suivi/shared/carto';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react';
import { Definitions, Lien, Noeud, teinteOf, type EtatNoeud } from './rendu';

export interface Viewport {
  x: number;
  y: number;
  k: number;
}
export type Selection = { k: 'n'; ref: string } | { k: 'e'; key: string } | null;

const ZOOM_MIN = 0.2,
  ZOOM_MAX = 2.5;
const clampK = (k: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, k));

/** Viewport qui affiche toute la scène (zoom 0,2 à 1,25). */
export function fitViewport(scene: Scene, w: number, h: number, inset = 0): Viewport {
  const bb = boundingBox(scene.nodes.map(([, n]) => n));
  const W = Math.max(200, w - inset - 40),
    H = Math.max(200, h - 40);
  const k = Math.max(ZOOM_MIN, Math.min(1.25, W / bb.w, H / bb.h));
  return { k, x: 20 + (W - bb.w * k) / 2 - bb.x * k, y: 20 + (H - bb.h * k) / 2 - bb.y * k };
}

interface Drag {
  kind: 'pan' | 'mv' | 'rz' | 'link' | 'edge';
  sx: number;
  sy: number;
  moved: boolean;
  ref?: string;
  key?: string;
  vp?: Viewport;
  grp?: [string, number, number][];
  size?: { w: number; h: number };
  before?: MapLayout;
}

export interface CanevasProps {
  layout: MapLayout;
  view: MapView;
  scene: Scene;
  lookup: ObjectLookup;
  std: string[];
  hidden: ReadonlySet<string>;
  sel: Selection;
  edit: boolean;
  linkSrc: string | null | undefined;
  vp: Viewport;
  setVp: (v: Viewport, persist?: boolean) => void;
  onSize: (w: number, h: number) => void;
  /** Disposition modifiée pendant un glisser (aperçu, sans annulation). */
  onLive: (l: MapLayout) => void;
  /** Fin d'un déplacement ou d'un redimensionnement : « before » rejoint la pile d'annulation. */
  onCommit: (before: MapLayout) => void;
  onSelect: (s: Selection) => void;
  onOpen: (ref: string) => void;
  onLink: (ref: string) => void;
}

export function Canevas(p: CanevasProps) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const raf = useRef(0);
  const pending = useRef<MapLayout | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; vp: Viewport } | null>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [panning, setPanning] = useState(false);
  const { vp, setVp } = p;
  const latest = useRef(p);
  latest.current = p;

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
      latest.current.onSize(r.width, r.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const zoomAt = useCallback(
    (f: number, cx?: number, cy?: number) => {
      const r = box.current!.getBoundingClientRect();
      const px = cx ?? r.width / 2,
        py = cy ?? r.height / 2;
      const cur = latest.current.vp;
      const k = clampK(cur.k * f),
        wx = (px - cur.x) / cur.k,
        wy = (py - cur.y) / cur.k;
      setVp({ k, x: px - wx * k, y: py - wy * k }, true);
    },
    [setVp],
  );

  // Molette : écouteur non passif (empêche le défilement de la page pendant le zoom).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const flush = () => {
    raf.current = 0;
    if (pending.current) latest.current.onLive(pending.current);
    pending.current = null;
  };
  const schedule = (l: MapLayout) => {
    pending.current = l;
    if (!raf.current) raf.current = requestAnimationFrame(flush);
  };

  const down = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button > 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), vp };
      drag.current = null;
      return;
    }
    const t = e.target as Element;
    const hEl = t.closest('[data-h]'),
      nEl = t.closest('[data-n]'),
      eEl = t.closest('[data-e]');
    const d: Drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, moved: false };
    const L = p.layout;
    if (p.edit && hEl) {
      const ref = hEl.getAttribute('data-h')!;
      const n = L.nodes[ref];
      if (n) Object.assign(d, { kind: 'rz', ref, size: { w: n.w, h: n.h }, before: L });
    } else if (nEl) {
      const ref = nEl.getAttribute('data-n')!;
      d.ref = ref;
      if (p.linkSrc !== undefined) d.kind = 'link';
      else if (p.edit && L.nodes[ref]) {
        const grp = dragGroup(L, ref, p.lookup).map(
          (r) => [r, L.nodes[r]!.x, L.nodes[r]!.y] as [string, number, number],
        );
        Object.assign(d, { kind: 'mv', grp, before: L });
      }
    } else if (eEl) Object.assign(d, { kind: 'edge', key: eEl.getAttribute('data-e')! });
    if (d.kind === 'pan') d.vp = { ...vp };
    drag.current = d;
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* capture refusée (pointeur déjà relâché) */
    }
  };
  const move = (e: PointerEvent<SVGSVGElement>) => {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const d2 = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      const r = box.current!.getBoundingClientRect();
      const cx = (a!.x + b!.x) / 2 - r.left,
        cy = (a!.y + b!.y) / 2 - r.top;
      const v0 = pinch.current.vp,
        k = clampK((v0.k * d2) / Math.max(1, pinch.current.d));
      const wx = (cx - v0.x) / v0.k,
        wy = (cy - v0.y) / v0.k;
      setVp({ k, x: cx - wx * k, y: cy - wy * k });
      return;
    }
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx,
      dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < 4) return;
    d.moved = true;
    if (d.kind === 'pan' && d.vp) {
      setPanning(true);
      setVp({ k: d.vp.k, x: d.vp.x + dx, y: d.vp.y + dy });
    } else if (d.kind === 'mv' && d.before && d.grp) schedule(moveGroup(d.before, d.grp, dx / vp.k, dy / vp.k));
    else if (d.kind === 'rz' && d.before && d.ref && d.size)
      schedule(resizeNode(d.before, d.ref, d.size.w, d.size.h, dx / vp.k, dy / vp.k, p.lookup));
  };
  const up = (e: PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      if (pointers.current.size < 2) {
        pinch.current = null;
        setVp(latest.current.vp, true);
      }
      return;
    }
    const d = drag.current;
    drag.current = null;
    setPanning(false);
    if (!d) return;
    if (d.kind === 'pan') {
      if (d.moved) setVp(latest.current.vp, true);
      else p.onSelect(d.ref ? { k: 'n', ref: d.ref } : null);
      return;
    }
    if (d.kind === 'mv' || d.kind === 'rz') {
      if (d.moved) {
        if (raf.current) cancelAnimationFrame(raf.current);
        flush();
        if (d.before) p.onCommit(d.before);
      } else if (d.ref) p.onSelect({ k: 'n', ref: d.ref });
      return;
    }
    if (d.kind === 'edge' && !d.moved && d.key) p.onSelect({ k: 'e', key: d.key });
    if (d.kind === 'link' && !d.moved && d.ref) p.onLink(d.ref);
  };
  const dbl = (e: MouseEvent<SVGSVGElement>) => {
    const n = (e.target as Element).closest('[data-n]');
    if (n && p.linkSrc === undefined) p.onOpen(n.getAttribute('data-n')!);
  };

  const sel = p.sel;
  const etat = (ref: string, n: MapLayout['nodes'][string], o: ReturnType<ObjectLookup>): EtatNoeud => ({
    sel: sel?.k === 'n' && sel.ref === ref,
    dim: p.scene.dim.has(ref),
    hit: p.scene.hits.has(ref),
    edit: p.edit,
    src: p.linkSrc === ref,
    view: p.view,
    std: p.std,
    cont: isContainer(o, n),
    inaccessible: !o && p.hidden.has(refModule(ref) ?? ''),
  });
  const contenu = (
    <g transform={`translate(${vp.x.toFixed(1)} ${vp.y.toFixed(1)}) scale(${vp.k.toFixed(4)})`}>
      {p.scene.containers.map(([r, n, o]) => (
        <Noeud key={r} ref_={r} n={n} o={o} st={etat(r, n, o)} />
      ))}
      {p.scene.edges.map((e) => (
        <Lien
          key={e.key}
          e={e}
          sel={sel?.k === 'e' && sel.key === e.key}
          dim={p.scene.dim.has(e.s) || p.scene.dim.has(e.t)}
          edit={p.edit}
          exporting={false}
        />
      ))}
      {p.scene.cards.map(([r, n, o]) => (
        <Noeud key={r} ref_={r} n={n} o={o} st={etat(r, n, o)} />
      ))}
    </g>
  );

  return (
    <div
      ref={box}
      className={`carte-zone${p.edit ? ' carte-edition' : ''}${p.linkSrc !== undefined ? ' carte-liaison' : ''}${
        panning ? ' carte-panoramique' : ''
      }`}
    >
      <svg
        className="carte-svg"
        role="application"
        aria-label="Carte : glisser pour se déplacer, molette pour zoomer, Tab pour parcourir les objets"
        tabIndex={0}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onDoubleClick={dbl}
      >
        <Definitions />
        {contenu}
      </svg>
      <div className="carte-zoom">
        <Tooltip label="Zoom avant" position="left">
          <ActionIcon variant="default" aria-label="Zoom avant" onClick={() => zoomAt(1.25)}>
            +
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Zoom arrière" position="left">
          <ActionIcon variant="default" aria-label="Zoom arrière" onClick={() => zoomAt(0.8)}>
            −
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Ajuster à l’écran" position="left">
          <ActionIcon
            variant="default"
            aria-label="Ajuster à l’écran"
            onClick={() => setVp(fitViewport(p.scene, size.w, size.h), true)}
          >
            ⤢
          </ActionIcon>
        </Tooltip>
      </div>
      <Apercu scene={p.scene} vp={vp} size={size} setVp={setVp} />
    </div>
  );
}

/** Aperçu (minimap) : cliquer ou glisser pour centrer la vue. */
function Apercu({
  scene,
  vp,
  size,
  setVp,
}: {
  scene: Scene;
  vp: Viewport;
  size: { w: number; h: number };
  setVp: (v: Viewport, persist?: boolean) => void;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const bb = useMemo(() => {
    const b = boundingBox(scene.nodes.map(([, n]) => n));
    const pad = 30;
    return { x: b.x - pad, y: b.y - pad, w: b.w + 2 * pad, h: b.h + 2 * pad };
  }, [scene.nodes]);
  if (!scene.nodes.length) return null;
  const centrer = (cx: number, cy: number, persist: boolean) => {
    const r = ref.current!.getBoundingClientRect();
    const s = Math.min(r.width / bb.w, r.height / bb.h),
      ox = (r.width - bb.w * s) / 2,
      oy = (r.height - bb.h * s) / 2;
    const wx = bb.x + (cx - r.left - ox) / s,
      wy = bb.y + (cy - r.top - oy) / s;
    setVp({ k: vp.k, x: size.w / 2 - wx * vp.k, y: size.h / 2 - wy * vp.k }, persist);
  };
  return (
    <svg
      ref={ref}
      className="carte-mini"
      viewBox={`${bb.x} ${bb.y} ${bb.w} ${bb.h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-label="Aperçu de la carte : cliquer pour centrer la vue"
      role="img"
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
        centrer(e.clientX, e.clientY, false);
      }}
      onPointerMove={(e) => {
        if (e.buttons) centrer(e.clientX, e.clientY, false);
      }}
      onPointerUp={(e) => centrer(e.clientX, e.clientY, true)}
    >
      {scene.nodes.map(([r, n, o]) => (
        <rect
          key={r}
          x={n.x}
          y={n.y}
          width={n.w}
          height={n.h}
          rx={8}
          className={`mini-${o?.type === 'scope' ? 'perimetre' : isContainer(o, n) ? 'cadre' : 'objet'} ct-${teinteOf(o)}`}
        />
      ))}
      <rect
        x={-vp.x / vp.k}
        y={-vp.y / vp.k}
        width={size.w / vp.k}
        height={size.h / vp.k}
        rx={6}
        className="mini-vue"
        strokeWidth={Math.max(3, (bb.w / 180) * 1.6)}
      />
    </svg>
  );
}
