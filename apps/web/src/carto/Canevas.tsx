/* Canevas SVG de la carte (CARTO-06, CARTO-07, CARTO-16, CARTO-17) : zoom (molette, pincement, boutons),
   panoramique, sélection (Maj+clic et lasso Maj+glisser pour une sélection multiple), déplacement (un cadre emporte
   son contenu), redimensionnement, liaison, menu contextuel (clic droit, appui long), placement au clic, aperçu
   cliquable. Le zoom ne modifie jamais les positions enregistrées. Redessin limité à requestAnimationFrame pendant
   les glisser-déposer. Les éléments flottants (menu, fantôme d'un glisser depuis la palette) sont dessinés dans une
   surcouche SVG positionnée par attributs : aucun style en ligne. */
import { ActionIcon, Tooltip } from '@mantine/core';
import {
  boundingBox,
  dragGroup,
  isContainer,
  moveGroup,
  nodesWithin,
  refModule,
  resizeNode,
  type MapLayout,
  type MapView,
  type ObjectLookup,
  type Scene,
} from '@suivi/shared/carto';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type MutableRefObject,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { Definitions, Lien, Noeud, teinteOf, type EtatNoeud } from './rendu';

export interface Viewport {
  x: number;
  y: number;
  k: number;
}
export type Selection = { k: 'n'; ref: string } | { k: 'e'; key: string } | { k: 'm'; refs: string[] } | null;
/** Point dans le dessin (coordonnées de la carte) et dans la zone du canevas (pixels). */
export interface Point {
  x: number;
  y: number;
}
/** Cible d'un menu contextuel : fond de carte, objet ou relation. */
export type CibleMenu = { k: 'fond' } | { k: 'n'; ref: string } | { k: 'e'; key: string };
export interface DemandeMenu {
  cible: CibleMenu;
  monde: Point;
  ecran: Point;
}
/** Conversion des coordonnées de la fenêtre (événements pointeur) vers la carte ; null hors du canevas. */
export interface CanevasApi {
  versMonde: (clientX: number, clientY: number) => { monde: Point; ecran: Point } | null;
  centre: () => { monde: Point; ecran: Point };
}
const APPUI_LONG_MS = 500;

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
  kind: 'pan' | 'mv' | 'rz' | 'link' | 'edge' | 'lasso';
  shift?: boolean;
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
  /** Menu contextuel demandé (clic droit, appui long). */
  onMenu: (d: DemandeMenu) => void;
  /** Mode « placer » armé depuis la palette : un clic sur le fond indique l'emplacement. */
  arme: boolean;
  onPlace: (monde: Point) => void;
  /** Éléments flottants dessinés dans la surcouche (coordonnées de la zone). */
  surcouche?: (taille: { w: number; h: number }) => ReactNode;
  apiRef?: MutableRefObject<CanevasApi | null>;
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
  const [lasso, setLasso] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const appui = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const versMonde = useCallback((clientX: number, clientY: number) => {
    const el = box.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const ex = clientX - r.left,
      ey = clientY - r.top;
    if (ex < 0 || ey < 0 || ex > r.width || ey > r.height) return null;
    const v = latest.current.vp;
    return { ecran: { x: ex, y: ey }, monde: { x: (ex - v.x) / v.k, y: (ey - v.y) / v.k } };
  }, []);
  useEffect(() => {
    if (!p.apiRef) return;
    p.apiRef.current = {
      versMonde,
      centre: () => {
        const r = box.current!.getBoundingClientRect();
        return versMonde(r.left + r.width / 2, r.top + r.height / 2)!;
      },
    };
  }, [p.apiRef, versMonde]);
  const cibleDe = (t: Element): CibleMenu => {
    const nEl = t.closest('[data-n]'),
      eEl = t.closest('[data-e]');
    return nEl
      ? { k: 'n', ref: nEl.getAttribute('data-n')! }
      : eEl
        ? { k: 'e', key: eEl.getAttribute('data-e')! }
        : { k: 'fond' };
  };
  const menuAu = (t: Element, clientX: number, clientY: number) => {
    const pt = versMonde(clientX, clientY);
    if (pt) latest.current.onMenu({ cible: cibleDe(t), ...pt });
  };
  const finAppui = () => {
    if (appui.current) clearTimeout(appui.current);
    appui.current = null;
  };

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
      finAppui();
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), vp };
      drag.current = null;
      return;
    }
    const t = e.target as Element;
    const hEl = t.closest('[data-h]'),
      nEl = t.closest('[data-n]'),
      eEl = t.closest('[data-e]');
    const d: Drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, moved: false, shift: e.shiftKey };
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
        // Objet d'une sélection multiple : toute la sélection se déplace (avec le contenu des cadres).
        const sel = p.sel?.k === 'm' && p.sel.refs.includes(ref) ? p.sel.refs : [ref];
        const refs = [...new Set(sel.flatMap((r) => dragGroup(L, r, p.lookup)))];
        const grp = refs.map((r) => [r, L.nodes[r]!.x, L.nodes[r]!.y] as [string, number, number]);
        Object.assign(d, { kind: 'mv', grp, before: L });
      }
    } else if (eEl) Object.assign(d, { kind: 'edge', key: eEl.getAttribute('data-e')! });
    else if (e.shiftKey && e.pointerType === 'mouse') d.kind = 'lasso';
    if (d.kind === 'pan') d.vp = { ...vp };
    drag.current = d;
    // Appui long (tactile) : menu contextuel, si le doigt n'a pas bougé.
    finAppui();
    if (e.pointerType === 'touch') {
      const cx = e.clientX,
        cy = e.clientY;
      appui.current = setTimeout(() => {
        appui.current = null;
        if (drag.current === d && !d.moved && pointers.current.size === 1) {
          drag.current = null;
          menuAu(t, cx, cy);
        }
      }, APPUI_LONG_MS);
    }
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
    finAppui();
    if (d.kind === 'lasso') {
      const a = versMonde(d.sx, d.sy),
        b = versMonde(e.clientX, e.clientY);
      if (a && b)
        setLasso({
          x: Math.min(a.monde.x, b.monde.x),
          y: Math.min(a.monde.y, b.monde.y),
          w: Math.abs(a.monde.x - b.monde.x),
          h: Math.abs(a.monde.y - b.monde.y),
        });
    } else if (d.kind === 'pan' && d.vp) {
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
    finAppui();
    setPanning(false);
    if (!d) return;
    // Maj+clic : ajoute ou retire l'objet de la sélection multiple.
    const choisir = (ref: string) => {
      if (!d.shift) return p.onSelect({ k: 'n', ref });
      const cur = p.sel?.k === 'm' ? p.sel.refs : p.sel?.k === 'n' ? [p.sel.ref] : [];
      const refs = cur.includes(ref) ? cur.filter((r) => r !== ref) : [...cur, ref];
      p.onSelect(refs.length > 1 ? { k: 'm', refs } : refs.length ? { k: 'n', ref: refs[0]! } : null);
    };
    if (d.kind === 'lasso') {
      setLasso(null);
      const a = versMonde(d.sx, d.sy),
        b = versMonde(e.clientX, e.clientY);
      if (!a || !b) return;
      const refs = nodesWithin(p.layout, {
        x: Math.min(a.monde.x, b.monde.x),
        y: Math.min(a.monde.y, b.monde.y),
        w: Math.abs(a.monde.x - b.monde.x),
        h: Math.abs(a.monde.y - b.monde.y),
      });
      p.onSelect(refs.length > 1 ? { k: 'm', refs } : refs.length ? { k: 'n', ref: refs[0]! } : null);
      return;
    }
    if (d.kind === 'pan') {
      if (d.moved) setVp(latest.current.vp, true);
      else if (d.ref) choisir(d.ref);
      else if (p.arme) {
        const pt = versMonde(e.clientX, e.clientY);
        if (pt) p.onPlace(pt.monde);
      } else p.onSelect(null);
      return;
    }
    if (d.kind === 'mv' || d.kind === 'rz') {
      if (d.moved) {
        if (raf.current) cancelAnimationFrame(raf.current);
        flush();
        if (d.before) p.onCommit(d.before);
      } else if (d.ref) choisir(d.ref);
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
    sel: (sel?.k === 'n' && sel.ref === ref) || (sel?.k === 'm' && sel.refs.includes(ref)),
    poignee: sel?.k === 'n' && sel.ref === ref,
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
      {lasso && (
        <rect
          x={lasso.x}
          y={lasso.y}
          width={lasso.w}
          height={lasso.h}
          className="carte-lasso"
          strokeWidth={1.5 / vp.k}
        />
      )}
    </g>
  );

  return (
    <div
      ref={box}
      className={`carte-zone${p.edit ? ' carte-edition' : ''}${p.linkSrc !== undefined ? ' carte-liaison' : ''}${
        panning ? ' carte-panoramique' : ''
      }${p.arme ? ' carte-armee' : ''}`}
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
        onContextMenu={(e) => {
          e.preventDefault();
          drag.current = null;
          finAppui();
          menuAu(e.target as Element, e.clientX, e.clientY);
        }}
      >
        <Definitions />
        {contenu}
      </svg>
      {p.surcouche && <svg className="carte-surcouche">{p.surcouche(size)}</svg>}
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
