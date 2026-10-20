/* Exports de la carte (CARTO-13), produits dans le navigateur : SVG (vectoriel), PNG (× 2, 36 Mpx au plus),
   PDF A3 paysage (image JPEG dans un PDF minimal écrit sans bibliothèque, comme la bêta) et disposition JSON.
   Titre, organisation, date, référentiels et légende sont inclus. Le dessin est rendu hors écran avec les couleurs
   claires (classe carte-export), puis les couleurs calculées sont recopiées en attributs SVG (aucun attribut style). */
import {
  MAP_VIEW_TITLES,
  boundingBox,
  isContainer,
  type MapLayout,
  type MapView,
  type ObjectLookup,
  type Scene,
} from '@suivi/shared/carto';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Definitions, Lien, Noeud } from './rendu';

export type FormatExport = 'png' | 'svg' | 'pdf' | 'json';

interface Legende {
  teinte: string;
  libelle: string;
  tirets?: boolean;
}
const LEGENDE: Record<MapView, Legende[]> = {
  context: [
    { teinte: 'bleu', libelle: 'Périmètre SMSI', tirets: true },
    { teinte: 'bleu', libelle: 'Élément interne' },
    { teinte: 'violet', libelle: 'Partie intéressée, fournisseur' },
    { teinte: 'orange', libelle: 'Enjeu' },
  ],
  process: [
    { teinte: 'violet', libelle: 'Pilotage' },
    { teinte: 'bleu', libelle: 'Réalisation' },
    { teinte: 'vert', libelle: 'Support' },
    { teinte: 'gris', libelle: 'Sous-processus', tirets: true },
  ],
};
const LIENS: Record<MapView, [string, string][]> = {
  context: [
    ['primary', 'Lien principal'],
    ['dependency', 'Dépendance, support'],
    ['issue', 'Impact d’un enjeu'],
  ],
  process: [
    ['primary', 'Flux principal'],
    ['dependency', 'Dépendance, support'],
  ],
};

/** Propriétés calculées recopiées en attributs de présentation. */
const PROPS = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-opacity',
  'opacity',
  'flood-color',
  'flood-opacity',
] as const;

function figer(svg: SVGSVGElement) {
  const todo: Element[] = [svg, ...svg.querySelectorAll('*')];
  const styles = todo.map((el) => getComputedStyle(el));
  todo.forEach((el, i) => {
    const cs = styles[i]!;
    for (const p of PROPS) {
      const v = cs.getPropertyValue(p);
      if (v && v !== 'normal' && !(p === 'stroke-dasharray' && v === 'none')) el.setAttribute(p, v);
    }
    el.removeAttribute('class');
    el.removeAttribute('tabindex');
    el.removeAttribute('role');
    el.removeAttribute('aria-pressed');
    el.removeAttribute('data-n');
    el.removeAttribute('data-e');
  });
  svg.setAttribute('font-family', getComputedStyle(svg).fontFamily);
}

export interface ExportCtx {
  view: MapView;
  layout: MapLayout;
  scene: Scene;
  lookup: ObjectLookup;
  organisation: string;
  std: string[];
  title?: string;
  legend?: { label: string; color: string }[];
  source?: unknown;
}

/** Dessin SVG autonome de la carte (couleurs claires recopiées en attributs). */
function exportSvg(c: ExportCtx): { svg: string; W: number; H: number } {
  const bb = boundingBox(c.scene.nodes.map(([, n]) => n));
  const pad = 40,
    head = 78,
    leg = c.legend ? Math.ceil(c.legend.length / 3) * 28 + 26 : 54;
  const W = Math.round(
      Math.max(
        bb.w + 2 * pad,
        c.legend?.length
          ? Math.max(...c.legend.map((l) => l.label.length * 6.6 + 44)) * Math.min(3, c.legend.length) + 2 * pad
          : 0,
      ),
    ),
    H = Math.round(bb.h + 2 * pad + head + leg);
  const date = new Date().toLocaleDateString('fr-FR');
  let lx = pad;
  const legende = c.legend
    ? c.legend.map((l, i) => {
        const x = pad + ((i % 3) * (W - 2 * pad)) / 3,
          ly = H - leg + 16 + Math.floor(i / 3) * 28;
        return (
          <g key={l.label}>
            <rect
              x={x}
              y={ly}
              width={20}
              height={14}
              rx={4}
              fill={/^#[a-fA-F0-9]{6}$/.test(l.color) ? l.color : undefined}
            />
            <text x={x + 28} y={ly + 11} fontSize={12} className="c-sec">
              {l.label}
            </text>
          </g>
        );
      })
    : LEGENDE[c.view].map((l) => {
        const x = lx;
        lx += l.libelle.length * 6.6 + 44;
        return (
          <g key={l.libelle} className={`ct-${l.teinte}`}>
            <rect
              x={x}
              y={H - leg + 16}
              width={20}
              height={14}
              rx={4}
              className={`c-fond${l.tirets ? ' c-tirets' : ''}`}
            />
            <text x={x + 28} y={H - leg + 27} fontSize={12} className="c-sec">
              {l.libelle}
            </text>
          </g>
        );
      });
  const liens = (c.legend ? [] : LIENS[c.view]).map(([st, l]) => {
    const x = lx;
    lx += l.length * 6.6 + 60;
    return (
      <g key={l}>
        <path d={`M${x} ${H - leg + 23}h26`} className={`lien-trait l-${st}`} fill="none" />
        <text x={x + 34} y={H - leg + 27} fontSize={12} className="c-sec">
          {l}
        </text>
      </g>
    );
  });
  const etat = (ref: string, n: MapLayout['nodes'][string], o: ReturnType<ObjectLookup>) => ({
    sel: false,
    dim: false,
    hit: false,
    edit: false,
    src: false,
    view: c.view,
    std: c.std,
    cont: isContainer(o, n),
    inaccessible: false,
  });
  const hote = document.createElement('div');
  hote.className = 'carte-export carte-hors-ecran';
  document.body.appendChild(hote);
  const root = createRoot(hote);
  try {
    flushSync(() =>
      root.render(
        <svg xmlns="http://www.w3.org/2000/svg" width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="carte-svg">
          <Definitions />
          <rect width={W} height={H} className="c-fond-export" />
          <text x={pad} y={44} fontSize={24} fontWeight={700} className="c-titre-marine">
            {c.title ?? MAP_VIEW_TITLES[c.view]}
          </text>
          <text x={pad} y={68} fontSize={13} className="c-sec">
            {`${c.organisation} — ${date} — Référentiels : ${c.std.join(', ') || 'aucun'}`}
          </text>
          <line x1={pad} x2={W - pad} y1={head} y2={head} className="c-separateur" />
          <g transform={`translate(${pad - bb.x} ${pad + head - bb.y})`}>
            {c.scene.containers.map(([r, n, o]) => (
              <Noeud key={r} ref_={r} n={n} o={o} st={etat(r, n, o)} />
            ))}
            {c.scene.edges.map((e) => (
              <Lien key={e.key} e={e} sel={false} dim={false} edit={false} exporting />
            ))}
            {c.scene.cards.map(([r, n, o]) => (
              <Noeud key={r} ref_={r} n={n} o={o} st={etat(r, n, o)} />
            ))}
          </g>
          <line x1={pad} x2={W - pad} y1={H - leg} y2={H - leg} className="c-separateur" />
          {legende}
          {liens}
        </svg>,
      ),
    );
    const svg = hote.querySelector('svg')!;
    figer(svg);
    for (const t of svg.querySelectorAll('title')) t.remove();
    return { svg: new XMLSerializer().serializeToString(svg), W, H };
  } finally {
    root.unmount();
    hote.remove();
  }
}

function canvasDe(x: { svg: string; W: number; H: number }, scale: number): Promise<HTMLCanvasElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas'),
        s = Math.min(scale, Math.sqrt(36e6 / (x.W * x.H)));
      c.width = Math.round(x.W * s);
      c.height = Math.round(x.H * s);
      const g = c.getContext('2d')!;
      g.fillStyle = 'white';
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      res(c);
    };
    img.onerror = () => rej(new Error('svg'));
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(x.svg);
  });
}
const octets = (dataUrl: string) => {
  const b = atob(dataUrl.split(',')[1]!),
    u = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i);
  return u;
};

/** PDF A3 paysage contenant une image JPEG (même construction que la bêta). */
function pdfA3(jpg: Uint8Array, iw: number, ih: number, title: string): Uint8Array<ArrayBuffer> {
  const PW = 1190.55,
    PH = 841.89,
    m = 24,
    sc = Math.min((PW - 2 * m) / iw, (PH - 2 * m) / ih),
    w = iw * sc,
    h = ih * sc,
    x = (PW - w) / 2,
    y = (PH - h) / 2;
  const enc = new TextEncoder(),
    parts: Uint8Array[] = [],
    offs: number[] = [];
  let len = 0;
  const push = (b: string | Uint8Array) => {
    const u = typeof b === 'string' ? enc.encode(b) : b;
    parts.push(u);
    len += u.length;
  };
  const obj = (n: number, s: string) => {
    offs[n] = len;
    push(n + ' 0 obj\n' + s + '\nendobj\n');
  };
  const SANS: Record<string, string> = { é: 'e', è: 'e', ê: 'e', à: 'a', ç: 'c', ô: 'o', î: 'i', É: 'E', '’': "'" };
  const ttl = String(title)
    .replace(/[^\x20-\x7E]/g, (c) => SANS[c] ?? '')
    .replace(/[()\\]/g, '');
  push('%PDF-1.4\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(
    3,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>`,
  );
  offs[4] = len;
  push(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${iw} /Height ${ih} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`,
  );
  push(jpg);
  push('\nendstream\nendobj\n');
  const cs = `q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /Im1 Do Q`;
  obj(5, `<< /Length ${cs.length} >>\nstream\n${cs}\nendstream`);
  obj(6, `<< /Title (${ttl}) /Producer (Suivi SMSI) >>`);
  const xr = len;
  push(
    `xref\n0 7\n0000000000 65535 f \n${[1, 2, 3, 4, 5, 6].map((n) => String(offs[n]).padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 7 /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xr}\n%%EOF`,
  );
  const out = new Uint8Array(len);
  let p = 0;
  for (const b of parts) {
    out.set(b, p);
    p += b.length;
  }
  return out;
}

function enregistrer(nom: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** Produit et télécharge l'export demandé. */
export async function exporter(format: FormatExport, c: ExportCtx): Promise<void> {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
  const base = `Cartographie_${c.view === 'context' ? 'contexte' : 'processus'}_${stamp}`;
  if (format === 'json') {
    const json = {
      type: 'smsi-map-layout',
      view: c.view,
      exportedAt: d.toISOString(),
      map: c.layout,
      ...(c.source !== undefined ? { source: c.source } : {}),
    };
    enregistrer(base + '.json', JSON.stringify(json, null, 1), 'application/json');
    return;
  }
  const x = exportSvg(c);
  if (format === 'svg') {
    enregistrer(base + '.svg', x.svg, 'image/svg+xml');
    return;
  }
  const cv = await canvasDe(x, format === 'pdf' ? 1.6 : 2);
  if (format === 'png') {
    enregistrer(base + '.png', octets(cv.toDataURL('image/png')), 'image/png');
    return;
  }
  enregistrer(
    base + '.pdf',
    pdfA3(octets(cv.toDataURL('image/jpeg', 0.92)), cv.width, cv.height, c.title ?? MAP_VIEW_TITLES[c.view]),
    'application/pdf',
  );
}
