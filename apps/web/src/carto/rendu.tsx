/* Rendu SVG de la carte (CARTO-06) : portage de mbNodeSvg et du dessin des liens de la bêta, en composants React.
   Couleurs : classes et variables --carte-* (packages/ui), jamais d'attribut style ni de couleur codée en dur.
   Les tailles et positions sont des coordonnées du dessin (unités SVG), pas des espacements d'interface. */
import {
  RELATIONS,
  TYPE_ICONS,
  TYPE_LABELS,
  familyOf,
  isFrame,
  midpoint,
  type CartoObject,
  type MapNode,
  type MapObject,
  type MapView,
  type SceneEdge,
} from '@suivi/shared/carto';
import { memo, type ReactNode } from 'react';
import { ICONES_CARTE } from './icones';

/* ---------------------------------------------------------------- Texte */
/** Coupe un texte en lignes (largeur estimée d'après la taille de police), avec points de suspension. */
export function wrap(t: unknown, maxW: number, fs: number, maxL: number, bold?: boolean): string[] {
  const n = Math.max(4, Math.floor(maxW / (fs * (bold ? 0.585 : 0.54))));
  const words = String(t ?? '')
    .split(/\s+/)
    .filter(Boolean);
  const L: string[] = [];
  let cur = '';
  for (const w of words) {
    const c = cur ? cur + ' ' + w : w;
    if (c.length <= n) cur = c;
    else {
      if (cur) L.push(cur);
      cur = w.length > n ? w.slice(0, n - 1) + '…' : w;
    }
  }
  if (cur) L.push(cur);
  if (L.length > maxL) {
    const k = L.slice(0, maxL);
    let l = k[maxL - 1]!;
    if (l.length > n - 1) l = l.slice(0, n - 1);
    k[maxL - 1] = l.replace(/[\s,;:.–-]+$/, '') + '…';
    return k;
  }
  return L;
}

function Texte({
  x,
  y,
  lines,
  fs,
  cls,
  bold,
  anchor,
  interligne,
}: {
  x: number;
  y: number;
  lines: string[];
  fs: number;
  cls: string;
  bold?: boolean;
  anchor?: 'middle';
  interligne?: number;
}) {
  if (!lines.length) return null;
  const h = interligne ?? Math.round(fs * 1.3);
  return (
    <text x={x} y={y} fontSize={fs} className={cls} fontWeight={bold ? 700 : undefined} textAnchor={anchor}>
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i ? h : 0}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

export function Icone({
  k,
  x,
  y,
  s,
  cls,
  sw,
}: {
  k: string;
  x: number;
  y: number;
  s: number;
  cls: string;
  sw?: number;
}) {
  const els = ICONES_CARTE[k] ?? ICONES_CARTE.layers!;
  return (
    <g
      transform={`translate(${x} ${y}) scale(${s / 24})`}
      className={`ic ${cls}`}
      strokeWidth={sw ?? 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      {els.map((e, i) =>
        e.t === 'path' ? (
          <path key={i} d={e.d} />
        ) : e.t === 'circle' ? (
          <circle key={i} cx={e.cx} cy={e.cy} r={e.r} />
        ) : (
          <rect key={i} x={e.x} y={e.y} width={e.width} height={e.height} rx={e.rx} />
        ),
      )}
    </g>
  );
}

/* ---------------------------------------------------------------- Pastilles */
type Puce = 'in' | 'out' | 'unk' | 'blue' | 'hds' | 'bad' | 'gen';
const PUCE_TEINTE: Record<Puce, string> = {
  in: 'vert',
  out: 'gris',
  unk: 'orange',
  blue: 'bleu',
  hds: 'violet',
  bad: 'rouge',
  gen: 'orange',
};
export const chipW = (l: string, k: Puce) => Math.round(String(l).length * 5.85 + (k === 'in' ? 27 : 16));
function Pastille({ x, y, l, k }: { x: number; y: number; l: string; k: Puce }) {
  const w = chipW(l, k);
  return (
    <g className={`ct-${PUCE_TEINTE[k]}`}>
      <rect x={x} y={y} width={w} height={18} rx={9} className="c-doux" />
      {k === 'in' && (
        <>
          <circle cx={x + 10} cy={y + 9} r={5.2} className="c-accent-f" />
          <path
            d={`M${x + 7.5} ${y + 9.2}l1.8 1.8 3.1-3.3`}
            className="c-coche"
            strokeWidth={1.5}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
      <text x={x + (k === 'in' ? 19 : 8)} y={y + 12.7} fontSize={10.5} fontWeight={600} className="c-accent-f">
        {l}
      </text>
    </g>
  );
}
const scopeChip = (o: CartoObject): [string, Puce] | null =>
  o.scope === 'in'
    ? ['Dans le périmètre', 'in']
    : o.scope === 'out'
      ? ['Hors périmètre', 'out']
      : o.scope === 'unk'
        ? [o.scopeLabel || 'Périmètre à confirmer', 'unk']
        : null;

/* ---------------------------------------------------------------- Teintes */
const FAMILLE_TEINTE: Record<string, string> = { pil: 'violet', rea: 'bleu', sup: 'vert', oth: 'gris' };
/** Teinte d'un objet (classe ct-*) : couleur d'accent, pastille, fond et bordure. */
export function teinteOf(o: MapObject | undefined): string {
  if (!o) return 'gris';
  switch (o.type) {
    case 'isms':
      return 'marine';
    case 'scope':
    case 'application':
    case 'infrastructure':
    case 'site':
      return 'bleu';
    case 'band':
    case 'external_issue':
    case 'internal_issue':
      return 'orange';
    case 'grc':
    case 'zone':
      return 'gris';
    case 'note':
    case 'frame':
      return (isFrame(o) && o.tint) || (o.type === 'note' ? 'orange' : 'gris');
    case 'lane':
      return FAMILLE_TEINTE[familyOf(isFrame(o) ? o.fam : undefined).k]!;
    case 'stakeholder':
    case 'supplier':
      return 'violet';
    case 'process':
    case 'subprocess':
      return FAMILLE_TEINTE[familyOf((o as CartoObject).family).k]!;
  }
}
export const iconOf = (o: MapObject | undefined): string => {
  if (!o) return 'ghost';
  if (o.type === 'isms') return 'building';
  if (o.type === 'scope') return 'shield';
  if (o.type === 'lane') return familyOf(isFrame(o) ? o.fam : undefined).ic;
  if (o.type === 'band') return 'alert';
  if (o.type === 'zone') return 'layers';
  if (o.type === 'note') return 'doc';
  if (o.type === 'frame') return 'layers';
  return (o as CartoObject).ic || TYPE_ICONS[o.type] || 'layers';
};

/* ---------------------------------------------------------------- Nœud */
export interface EtatNoeud {
  sel: boolean;
  /** Poignée de redimensionnement (sélection simple, en édition). */
  poignee?: boolean;
  dim: boolean;
  hit: boolean;
  edit: boolean;
  src: boolean;
  view: MapView;
  std: string[];
  cont: boolean;
  /** Objet non envoyé faute de droit de lecture sur son module (CARTO-01). */
  inaccessible: boolean;
}

function corps(ref: string, n: MapNode, o: MapObject | undefined, st: EtatNoeud): ReactNode {
  const { x, y, w, h } = n;
  if (!o) {
    return (
      <g className="ct-gris">
        <rect x={x} y={y} width={w} height={h} rx={10} className="c-fond c-tirets" />
        <Icone k="ghost" x={x + 14} y={y + (h - 22) / 2} s={22} cls="c-accent-s" />
        <Texte
          x={x + 46}
          y={y + h / 2 - 4}
          lines={wrap(n.label || ref, w - 56, 12, 1, true)}
          fs={12}
          cls="c-texte"
          bold
        />
        <Texte
          x={x + 46}
          y={y + h / 2 + 12}
          lines={[st.inaccessible ? 'Objet non accessible' : 'Objet indisponible']}
          fs={10.5}
          cls="c-sec"
        />
      </g>
    );
  }
  if (o.type === 'isms') {
    const t = wrap(o.name, w - 30, 15, 2, true);
    const subY = y + 60 + t.length * 19 + 2;
    return (
      <g className="ct-marine">
        <rect x={x} y={y} width={w} height={h} rx={14} className="c-fond-plein" filter="url(#carteOmbre)" />
        <Icone k="building" x={x + w / 2 - 13} y={y + 13} s={26} cls="c-sur-marine-s" sw={1.7} />
        <Texte x={x + w / 2} y={y + 60} lines={t} fs={15} cls="c-sur-marine" bold anchor="middle" />
        <Texte
          x={x + w / 2}
          y={subY}
          lines={wrap(
            (o as CartoObject).sub,
            w - 30,
            11.5,
            Math.max(1, Math.floor((h - (60 + t.length * 19 + 2) - 8) / 15) + 1),
          )}
          fs={11.5}
          cls="c-sur-marine-2"
          anchor="middle"
        />
      </g>
    );
  }
  if (o.type === 'scope') {
    const c = o as CartoObject;
    const sd = st.std.join(' / ') || 'Aucun référentiel';
    const cl = 'Certification ' + sd,
      cw = chipW(cl, 'blue');
    const l2 = 'Processus du périmètre à préciser';
    return (
      <g className="ct-bleu">
        <rect x={x} y={y} width={w} height={h} rx={20} className="c-fond c-perimetre" />
        <Icone k="shield" x={x + 22} y={y + 20} s={26} cls="c-accent-s" />
        <Texte x={x + 58} y={y + 38} lines={['Périmètre SMSI']} fs={17} cls="c-titre-marine" bold />
        <Texte
          x={x + 58}
          y={y + 57}
          lines={wrap(c.details?.statement || 'Certification ' + sd, Math.max(200, w - 300), 12, 1)}
          fs={12}
          cls="c-sec"
        />
        <Pastille x={x + w - cw - 22} y={y + 24} l={cl} k="blue" />
        {!c.scDef && <Pastille x={x + w - chipW(l2, 'unk') - 22} y={y + 48} l={l2} k="unk" />}
      </g>
    );
  }
  if (o.type === 'band')
    return (
      <g className="ct-orange">
        <rect x={x} y={y} width={w} height={h} rx={16} className="c-fond" />
        <Texte x={x + 18} y={y + 29} lines={[o.name]} fs={15} cls="c-accent-f" bold />
      </g>
    );
  if (o.type === 'zone')
    return (
      <g className="ct-gris">
        <rect x={x} y={y} width={w} height={h} rx={14} className="c-fond c-tirets" />
        <Texte x={x + 16} y={y + 25} lines={[o.name]} fs={13} cls="c-accent-f" bold />
        <Texte x={x + 130} y={y + 25} lines={[o.sub ?? '']} fs={11.5} cls="c-sec" />
      </g>
    );
  if (o.type === 'note') {
    const fs = 13;
    const lignes = String(o.name)
      .split('\n')
      .flatMap((l) => (l.trim() ? wrap(l, w - 28, fs, 50) : ['']));
    return (
      <g className={`ct-${teinteOf(o)}`}>
        <rect x={x} y={y} width={w} height={h} rx={8} className="c-doux c-note" />
        <path d={`M${x + w - 18} ${y}v18h18`} className="c-note-coin" fill="none" />
        <Texte
          x={x + 14}
          y={y + 24}
          lines={lignes.slice(0, Math.max(1, Math.floor((h - 18) / 17)))}
          fs={fs}
          cls="c-texte"
          interligne={17}
        />
      </g>
    );
  }
  if (o.type === 'frame')
    return (
      <g className={`ct-${teinteOf(o)}`}>
        <rect x={x} y={y} width={w} height={h} rx={16} className="c-fond c-cadre-libre" />
        <Texte x={x + 18} y={y + 30} lines={wrap(o.name, w - 36, 15, 1, true)} fs={15} cls="c-accent-f" bold />
      </g>
    );
  if (o.type === 'lane') {
    const f = familyOf(isFrame(o) ? o.fam : undefined);
    return (
      <g className={`ct-${teinteOf(o)}`}>
        <rect x={x} y={y} width={w} height={h} rx={18} className="c-fond" />
        <Icone k={f.ic} x={x + 22} y={y + 20} s={30} cls="c-accent-s" sw={2} />
        <Texte x={x + 64} y={y + 40} lines={[o.name]} fs={19} cls="c-accent-f" bold />
        <Texte x={x + 64} y={y + 62} lines={[o.sub ?? '']} fs={13} cls="c-sec" />
      </g>
    );
  }
  // Objet de la plateforme (processus, partie intéressée, enjeu, application, fournisseur…).
  const c = o as CartoObject;
  const cont = st.cont,
    tall = !cont && w >= 180 && h >= 118,
    ic = iconOf(c);
  const chips: [string, Puce][] = [];
  const sc = scopeChip(c);
  if (sc) chips.push(sc);
  if (c.type === 'supplier' && c.hds) chips.push(['HDS', 'hds']);
  if (c.nKo) chips.push([c.nKo + ' indicateur' + (c.nKo > 1 ? 's' : '') + ' KO', 'bad']);
  const proc = c.type === 'process' || c.type === 'subprocess';
  const sub = proc
    ? st.view === 'process'
      ? [
          c.owner ? 'Pilote : ' + c.owner : '',
          c.nObj
            ? c.nObj +
              ' objectif' +
              (c.nObj > 1 ? 's' : '') +
              (c.nInd ? ' · ' + c.nInd + ' indicateur' + (c.nInd > 1 ? 's' : '') : '')
            : '',
        ]
          .filter(Boolean)
          .join('\n') || familyOf(c.family).l
      : familyOf(c.family).l
    : (c.sub ?? '');
  const boite = c.type === 'stakeholder' || c.type === 'supplier' ? 'c-fond' : 'c-boite';
  const out: ReactNode[] = [
    <rect
      key="r"
      x={x}
      y={y}
      width={w}
      height={h}
      rx={cont ? 16 : 11}
      className={`${cont ? 'c-boite' : boite}${c.type === 'subprocess' ? ' c-sous' : ''}`}
      strokeWidth={1.2}
      filter={c.type === 'process' ? 'url(#carteOmbre)' : undefined}
    />,
  ];
  if (tall || cont) {
    out.push(<rect key="ib" x={x + 14} y={y + 14} width={38} height={38} rx={10} className="c-doux" />);
    out.push(<Icone key="ic" k={ic} x={x + 22} y={y + 22} s={22} cls="c-accent-s" />);
    let ty = y + 38;
    if (c.code) {
      out.push(<Texte key="code" x={x + 62} y={y + 30} lines={[c.code]} fs={12.5} cls="c-accent-f" bold />);
      ty = y + 30;
    }
    const tl = wrap(c.name, cont ? w - 80 : w - 28, 14, cont ? 1 : 3, true);
    if (cont) {
      out.push(<Texte key="nom" x={x + 62} y={y + 50} lines={tl} fs={14} cls="c-texte" bold />);
      ty = y + 50 + 16;
    } else {
      out.push(<Texte key="nom" x={x + 14} y={y + 76} lines={tl} fs={14} cls="c-texte" bold />);
      ty = y + 76 + tl.length * 18;
    }
    const sl = String(sub)
      .split('\n')
      .flatMap((l) => wrap(l, cont ? w - 80 : w - 28, 12, cont ? 1 : 2));
    if (sl.length && ty + 4 < y + h - 30)
      out.push(
        <Texte
          key="sub"
          x={cont ? x + 62 : x + 14}
          y={ty + (cont ? 0 : 2)}
          lines={sl.slice(0, cont ? 1 : Math.max(1, Math.floor((y + h - 30 - ty) / 15)))}
          fs={12}
          cls="c-sec"
        />,
      );
    let cx = cont ? x + w - 14 : x + 14;
    chips.forEach(([l, k], i) => {
      const cw = chipW(l, k);
      if (cont) {
        cx -= cw;
        out.push(<Pastille key={'p' + i} x={cx} y={y + 18} l={l} k={k} />);
        cx -= 6;
      } else if (cx + cw <= x + w - 8) {
        out.push(<Pastille key={'p' + i} x={cx} y={y + h - 28} l={l} k={k} />);
        cx += cw + 6;
      }
    });
  } else {
    const ix = x + 12,
      iy = y + Math.min(14, (h - 34) / 2);
    out.push(<rect key="ib" x={ix} y={iy} width={34} height={34} rx={9} className="c-doux" />);
    out.push(<Icone key="ic" k={ic} x={ix + 7} y={iy + 7} s={20} cls="c-accent-s" />);
    const tx = x + 56,
      tw = w - 64;
    let ty = y + 20;
    if (c.code) {
      out.push(<Texte key="code" x={tx} y={ty} lines={[c.code]} fs={10.5} cls="c-accent-f" bold />);
      ty += 14;
    }
    const room = h - (ty - y) - (chips.length && h >= 74 ? 26 : 6);
    const tl = wrap(c.name, tw, 12.5, Math.max(1, Math.min(2, Math.floor(room / 16))), true);
    out.push(<Texte key="nom" x={tx} y={ty} lines={tl} fs={12.5} cls="c-texte" bold interligne={15} />);
    ty += tl.length * 15;
    const left = y + h - (chips.length && h >= 74 ? 26 : 6) - ty;
    if (sub && left >= 10)
      out.push(
        <Texte
          key="sub"
          x={tx}
          y={ty + 1}
          lines={wrap(String(sub).split('\n')[0], tw, 11, Math.max(1, Math.min(2, Math.floor(left / 14))))}
          fs={11}
          cls="c-sec"
          interligne={13.5}
        />,
      );
    if (chips.length && h >= 74) {
      let cx = tx;
      chips.forEach(([l, k], i) => {
        const cw = chipW(l, k);
        if (cx + cw <= x + w - 6) {
          out.push(<Pastille key={'p' + i} x={cx} y={y + h - 25} l={l} k={k} />);
          cx += cw + 5;
        }
      });
    }
  }
  return <g className={`ct-${teinteOf(c)}`}>{out}</g>;
}

export const Noeud = memo(function Noeud({
  ref_,
  n,
  o,
  st,
}: {
  ref_: string;
  n: MapNode;
  o: MapObject | undefined;
  st: EtatNoeud;
}) {
  const { x, y, w, h } = n;
  const titre = o
    ? `${TYPE_LABELS[o.type] ?? o.type} — ${o.name}`
    : `${st.inaccessible ? 'Objet non accessible' : 'Objet indisponible'} — ${n.label || ref_}`;
  return (
    <g
      className={`noeud${st.dim ? ' c-attenue' : ''}`}
      data-n={ref_}
      tabIndex={0}
      role="button"
      aria-label={titre}
      aria-pressed={st.sel}
    >
      <title>{titre}</title>
      {corps(ref_, n, o, st)}
      {o && !isFrame(o) && o.riskColor && /^#[a-fA-F0-9]{6}$/.test(o.riskColor) && (
        <rect x={x} y={y + h - 6} width={w} height={6} rx={3} fill={o.riskColor} />
      )}
      {st.hit && <rect x={x - 5} y={y - 5} width={w + 10} height={h + 10} rx={14} className="c-hit" />}
      {st.sel && <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8} rx={14} className="c-sel" />}
      {st.src && <rect x={x - 4} y={y - 4} width={w + 8} height={h + 8} rx={14} className="c-src" />}
      {st.poignee && st.edit && (
        <rect data-h={ref_} x={x + w - 7} y={y + h - 7} width={14} height={14} rx={3.5} className="c-poignee" />
      )}
    </g>
  );
});

/* ---------------------------------------------------------------- Liens */
export const Lien = memo(function Lien({
  e,
  sel,
  dim,
  edit,
  exporting,
}: {
  e: SceneEdge;
  sel: boolean;
  dim: boolean;
  edit: boolean;
  exporting: boolean;
}) {
  const T = RELATIONS[e.type] ?? RELATIONS.related_to;
  const nature = e.gen ? ' (proposition à valider)' : e.der ? ' (donnée de la plateforme)' : ' (relation graphique)';
  const [mx, my] = midpoint(e.an);
  const marque = sel ? 'sel' : T.st;
  return (
    <g className={`lien${dim ? ' c-attenue-lien' : e.gen && !exporting ? ' c-proposition' : ''}`} data-e={e.key}>
      <title>{T.l + nature}</title>
      {!exporting && <path d={e.d} className="lien-zone" strokeWidth={12} fill="none" />}
      <path
        d={e.d}
        fill="none"
        className={`lien-trait l-${T.st}${sel ? ' l-sel' : ''}`}
        markerEnd={T.dir ? `url(#carteFleche-${marque})` : undefined}
      />
      {e.gen && !exporting && edit && (
        <g className="ct-orange">
          <circle cx={mx} cy={my} r={8} className="c-doux c-trait-accent" />
          <text x={mx} y={my + 3.8} fontSize={10.5} fontWeight={700} textAnchor="middle" className="c-accent-f">
            ?
          </text>
        </g>
      )}
    </g>
  );
});

/** Définitions communes : ombre portée et flèches par style de lien. */
export function Definitions() {
  return (
    <defs>
      <filter id="carteOmbre" x="-10%" y="-10%" width="120%" height="140%">
        <feDropShadow dx={0} dy={3} stdDeviation={5} className="c-ombre" />
      </filter>
      {(['primary', 'dependency', 'secondary', 'issue', 'structural', 'sel'] as const).map((k) => (
        <marker
          key={k}
          id={`carteFleche-${k}`}
          viewBox="0 0 10 10"
          refX={9}
          refY={5}
          markerWidth={7}
          markerHeight={7}
          orient="auto-start-reverse"
        >
          <path d="M0 0L10 5L0 10z" className={`fleche l-${k}`} />
        </marker>
      ))}
    </defs>
  );
}
