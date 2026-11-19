/* Graphiques Neon : présentation SVG seule, sans dépendance ni valeur métier de démonstration.
   Les motifs orbitaux et les vagues sont décoratifs. Les autres dessins ont une alternative chiffrée. */
import { useId, type ReactNode } from 'react';
export interface ValeurNeon {
  libelle: string;
  valeur: number;
}
export interface AxeNeon {
  libelle: string;
  valeur: number | null;
}
export const nombreNeon = (v: number) => (Number.isFinite(v) ? Math.max(0, v) : 0);
export function pointsRadar(axes: readonly AxeNeon[], rayon = 64) {
  return axes
    .map((a, i) => {
      const angle = (i * Math.PI * 2) / axes.length - Math.PI / 2;
      const r = (Math.min(100, nombreNeon(a.valeur ?? 0)) / 100) * rayon;
      return `${90 + Math.cos(angle) * r},${90 + Math.sin(angle) * r}`;
    })
    .join(' ');
}
export function positionsDates(lignes: readonly { libelle: string; date: string }[]) {
  const dates = lignes
    .map((l) => ({ ...l, t: Date.parse(l.date) }))
    .filter((l) => Number.isFinite(l.t))
    .sort((a, b) => a.t - b.t);
  const debut = dates[0]?.t ?? 0,
    fin = dates.at(-1)?.t ?? debut;
  return dates.map((l) => ({ ...l, position: fin === debut ? 50 : 8 + ((l.t - debut) / (fin - debut)) * 84 }));
}
function Alternative({ children }: { children: ReactNode }) {
  return <figcaption className="neon-alternative">{children}</figcaption>;
}
function Degrade({ id, inverse = false, ligne = false }: { id: string; inverse?: boolean; ligne?: boolean }) {
  return (
    <linearGradient
      id={id}
      gradientUnits={ligne ? 'userSpaceOnUse' : 'objectBoundingBox'}
      x1="0"
      y1={inverse ? '1' : '0'}
      x2={ligne ? '360' : '1'}
      y2="0"
    >
      <stop className="neon-stop-violet" />
      <stop offset=".6" className="neon-stop-rose" />
      <stop offset="1" className="neon-stop-orange" />
    </linearGradient>
  );
}
export function NeonAnneau({
  titre,
  valeur,
  total,
  centre,
  detail,
}: {
  titre: string;
  valeur: number;
  total: number;
  centre?: string;
  detail?: string;
}) {
  const id = useId();
  const v = nombreNeon(valeur),
    t = nombreNeon(total),
    fraction = t ? Math.min(1, v / t) : 0;
  return (
    <figure className="neon-anneau">
      <svg viewBox="0 0 160 160" role="img" aria-label={`${titre} : ${t ? `${v} sur ${t}` : 'aucune donnée'}`}>
        <defs>
          <Degrade id={id} />
        </defs>
        <circle cx="80" cy="80" r="61" className="neon-ring-piste" />
        <circle
          cx="80"
          cy="80"
          r="61"
          pathLength="100"
          transform="rotate(-90 80 80)"
          stroke={`url(#${id})`}
          strokeDasharray={`${fraction * 100} 100`}
          className="neon-ring-valeur"
        />
        <text x="80" y="82" textAnchor="middle" className="neon-ring-centre">
          {centre ?? (t ? `${Math.round(fraction * 100)}%` : '—')}
        </text>
        <text x="80" y="101" textAnchor="middle" className="neon-axe">
          {detail}
        </text>
      </svg>
      <Alternative>
        {titre} : {t ? `${v} sur ${t}` : 'aucune donnée'}
      </Alternative>
    </figure>
  );
}
export function NeonColonnes({ titre, valeurs }: { titre: string; valeurs: readonly ValeurNeon[] }) {
  const id = useId(),
    max = Math.max(1, ...valeurs.map((v) => nombreNeon(v.valeur))),
    pas = 320 / Math.max(1, valeurs.length);
  return (
    <figure className="neon-colonnes">
      <svg viewBox="0 0 360 180" role="img" aria-label={titre}>
        <defs>
          <Degrade id={id} inverse />
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line x1="25" x2="350" y1={140 - i * 40} y2={140 - i * 40} className="neon-grille" />
            <text x="21" y={144 - i * 40} textAnchor="end" className="neon-axe">
              {Math.round((max * i) / 3)}
            </text>
          </g>
        ))}
        {valeurs.map((v, i) => {
          const h = (nombreNeon(v.valeur) / max) * 120,
            x = 30 + i * pas;
          return (
            <g key={v.libelle}>
              <rect
                x={x}
                y={140 - h}
                width={pas * 0.82}
                height={h}
                rx="3"
                fill={`url(#${id})`}
                className="neon-colonne"
              >
                <title>
                  {v.libelle} : {v.valeur}
                </title>
              </rect>
              <text x={x + pas * 0.41} y="163" textAnchor="middle" className="neon-axe">
                {v.libelle}
              </text>
            </g>
          );
        })}
      </svg>
      <Alternative>{valeurs.map((v) => `${v.libelle} : ${v.valeur}`).join(' ; ') || 'Aucune donnée'}</Alternative>
    </figure>
  );
}
export function NeonRadar({ titre, axes }: { titre: string; axes: readonly AxeNeon[] }) {
  const id = useId();
  const point = (r: number) =>
    pointsRadar(
      axes.map((a) => ({ ...a, valeur: 100 })),
      r,
    );
  return (
    <figure className="neon-radar">
      <svg viewBox="0 0 180 180" role="img" aria-label={titre}>
        <defs>
          <Degrade id={id} />
        </defs>
        {[0.3, 0.6, 1].map((f) => (
          <polygon key={f} points={point(64 * f)} className="neon-grille" fill="none" />
        ))}
        {axes.map((a, i) => {
          const angle = (i * Math.PI * 2) / axes.length - Math.PI / 2;
          return (
            <g key={a.libelle}>
              <line
                x1="90"
                y1="90"
                x2={90 + Math.cos(angle) * 64}
                y2={90 + Math.sin(angle) * 64}
                className="neon-grille"
              />
              <text
                x={90 + Math.cos(angle) * 82}
                y={93 + Math.sin(angle) * 82}
                textAnchor="middle"
                className="neon-axe"
              >
                {a.libelle}
              </text>
            </g>
          );
        })}
        {axes.length >= 3 && axes.every((a) => a.valeur !== null) && (
          <polygon points={pointsRadar(axes)} fill={`url(#${id})`} className="neon-radar-donnee" />
        )}
      </svg>
      <Alternative>
        {axes
          .map((a) => `${a.libelle} : ${a.valeur === null ? 'non renseigné' : `${Math.round(a.valeur)} %`}`)
          .join(' ; ')}
      </Alternative>
    </figure>
  );
}
export function NeonEcheances({ lignes }: { lignes: readonly { libelle: string; date: string }[] }) {
  const id = useId(),
    dates = positionsDates(lignes).slice(0, 6);
  return (
    <figure className="neon-echeances">
      <svg viewBox="0 0 360 180" role="img" aria-label="Repères des échéances ; aucune durée d’action n’est déduite">
        <defs>
          <Degrade id={id} ligne />
        </defs>
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1={20 + i * 80} x2={20 + i * 80} y1="8" y2="145" className="neon-grille" />
        ))}
        {dates.map((d, i) => (
          <g key={`${d.libelle}-${d.date}`}>
            <title>
              {d.libelle} : {d.date.slice(0, 10)}
            </title>
            <line
              x1="20"
              x2={20 + d.position * 3.2}
              y1={18 + i * 22}
              y2={18 + i * 22}
              stroke={`url(#${id})`}
              className={`neon-echeance neon-serie-${i % 6}`}
            />
            <circle cx={20 + d.position * 3.2} cy={18 + i * 22} r="4" className={`neon-point neon-serie-${i % 6}`} />
          </g>
        ))}
        {dates.length > 0 && (
          <>
            <text x="20" y="170" className="neon-axe">
              {dates[0]!.date.slice(0, 10)}
            </text>
            <text x="340" y="170" textAnchor="end" className="neon-axe">
              {dates.at(-1)!.date.slice(0, 10)}
            </text>
          </>
        )}
      </svg>
      <Alternative>
        {dates.map((d) => `${d.libelle} : ${d.date.slice(0, 10)}`).join(' ; ') || 'Aucune échéance renseignée'}
      </Alternative>
    </figure>
  );
}
export interface SerieNeon {
  libelle: string;
  /** Une valeur par intervalle ; null : aucune mesure (la courbe s'interrompt, aucun zéro n'est inventé). */
  valeurs: readonly (number | null)[];
  /** Classe de teinte de la série (sinon la teinte Neon de son rang). */
  classe?: string;
}
/** Formes des marques de points, une par série : la série se reconnaît sans la couleur (avec le trait et la légende). */
export const FORMES_MARQUES = ['rond', 'carre', 'triangle', 'losange'] as const;
export type FormeMarque = (typeof FORMES_MARQUES)[number];
export const formeMarque = (rang: number): FormeMarque => FORMES_MARQUES[rang % FORMES_MARQUES.length]!;
/** Chemin SVG d'une marque centrée sur (x, y), de demi-taille r. */
export function cheminMarque(forme: FormeMarque, x: number, y: number, r = 3): string {
  switch (forme) {
    case 'carre':
      return `M${x - r} ${y - r}h${2 * r}v${2 * r}h${-2 * r}Z`;
    case 'triangle':
      return `M${x} ${y - r * 1.2}L${x + r * 1.15} ${y + r * 0.9}H${x - r * 1.15}Z`;
    case 'losange':
      return `M${x} ${y - r * 1.3}L${x + r * 1.3} ${y}L${x} ${y + r * 1.3}L${x - r * 1.3} ${y}Z`;
    default:
      return `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
  }
}
/** Graduations de l'axe : quatre intervalles arrondis (présentation d'origine), ou des entiers ronds (pas entier, le haut de
    l'axe en multiple de quatre fois le pas) avec `entieres`. */
export function graduationsCourbes(max: number, entieres: boolean): { haut: number; valeurs: number[] } {
  if (!entieres) return { haut: max, valeurs: [0, 1, 2, 3].map((i) => Math.round((max * i) / 3)) };
  const pas = Math.max(1, Math.ceil(max / 4));
  return { haut: pas * 4, valeurs: [0, 1, 2, 3, 4].map((i) => i * pas) };
}
/** Points des segments continus d'une série (les valeurs nulles coupent la courbe). */
export function segmentsCourbe(
  valeurs: readonly (number | null)[],
  haut: number,
): { x: number; y: number; k: number }[][] {
  const out: { x: number; y: number; k: number }[][] = [];
  let courant: { x: number; y: number; k: number }[] = [];
  valeurs.forEach((v, k) => {
    if (v === null) {
      if (courant.length) out.push(courant);
      courant = [];
      return;
    }
    courant.push({
      x: 25 + (k / Math.max(1, valeurs.length - 1)) * 320,
      y: 145 - (nombreNeon(v) / Math.max(1, haut)) * 126,
      k,
    });
  });
  if (courant.length) out.push(courant);
  return out;
}
export function NeonCourbes({
  series,
  debut,
  fin,
  titre,
  marques = false,
  entieres = false,
  etiquettes,
}: {
  series: readonly SerieNeon[];
  debut: string;
  fin: string;
  /** Nom accessible du graphique (par défaut : événements par intervalle). */
  titre?: string;
  /** Marques de points (une forme par série) et trait propre à chaque série. */
  marques?: boolean;
  /** Graduations entières (nombres de failles, niveaux). */
  entieres?: boolean;
  /** Libellé de chaque intervalle (bulle des marques). */
  etiquettes?: readonly string[];
}) {
  const max = Math.max(1, ...series.flatMap((s) => s.valeurs.flatMap((v) => (v === null ? [] : [nombreNeon(v)]))));
  const axe = graduationsCourbes(max, entieres);
  const y = (v: number) => 145 - (v / Math.max(1, axe.haut)) * 126;
  return (
    <figure className="neon-courbes">
      <svg viewBox="0 0 360 180" role="img" aria-label={titre ?? `Événements par intervalle, de ${debut} à ${fin}`}>
        {axe.valeurs.map((v, i) => {
          // Présentation d'origine : quatre lignes régulières ; graduations entières : à la hauteur de leur valeur.
          const yy = entieres ? y(v) : 145 - i * 42;
          return (
            <g key={i}>
              <line x1="25" x2="345" y1={yy} y2={yy} className="neon-grille" />
              <text x="21" y={yy + 4} textAnchor="end" className="neon-axe">
                {v}
              </text>
            </g>
          );
        })}
        {series.map((s, i) => {
          const teinte = s.classe ?? `neon-serie-${i % 6}`;
          const segments = segmentsCourbe(s.valeurs, axe.haut);
          return (
            <g key={s.libelle} className={teinte}>
              {segments.map((seg) => (
                <polyline
                  key={seg[0]!.k}
                  className={`neon-courbe${marques ? ` neon-trait-${i % FORMES_MARQUES.length}` : ''}`}
                  points={seg.map((p) => `${p.x},${p.y}`).join(' ')}
                >
                  <title>{s.libelle}</title>
                </polyline>
              ))}
              {marques &&
                segments.flat().map((p) => (
                  <path key={p.k} className="neon-marque" d={cheminMarque(formeMarque(i), p.x, p.y)}>
                    <title>{`${s.libelle}${etiquettes?.[p.k] ? `, ${etiquettes[p.k]}` : ''} : ${s.valeurs[p.k]}`}</title>
                  </path>
                ))}
            </g>
          );
        })}
        <text x="25" y="170" className="neon-axe">
          {debut}
        </text>
        <text x="345" y="170" textAnchor="end" className="neon-axe">
          {fin}
        </text>
      </svg>
      <Alternative>
        {series
          .map((s) => `${s.libelle} : ${s.valeurs.map((v) => (v === null ? 'aucune mesure' : v)).join(', ')}`)
          .join(' ; ') || 'Aucun événement'}
      </Alternative>
    </figure>
  );
}
export function NeonMotif({ type }: { type: 'risques' | 'orbite' | 'vagues' }) {
  return (
    <svg className={`neon-motif neon-motif-${type}`} viewBox="0 0 260 180" aria-hidden="true">
      {type === 'vagues' ? (
        Array.from({ length: 5 }, (_, i) => (
          <path
            key={i}
            className={`neon-vague neon-serie-${i}`}
            d={`M-10 ${45 + i * 23} C25 ${-30 + i * 25} 55 ${150 + i * 6} 95 ${55 + i * 22} S155 ${140 + i * 10} 190 ${45 + i * 15} S245 ${-15 + i * 14} 280 ${80 + i * 23}`}
          />
        ))
      ) : (
        <>
          <g className="neon-grille">
            {[35, 55, 76].map((r) => (
              <circle key={r} cx="130" cy="90" r={r} fill="none" />
            ))}
          </g>
          <g className="neon-tourne">
            {type === 'risques'
              ? Array.from({ length: 96 }, (_, i) => {
                  const a = i * 2.399963,
                    r = 22 + ((i * 19) % 63);
                  return (
                    <circle
                      key={i}
                      cx={130 + Math.cos(a) * r}
                      cy={90 + Math.sin(a) * r}
                      r={i % 7 === 0 ? 1.8 : 1}
                      className={`neon-point neon-serie-${i % 6}`}
                    />
                  );
                })
              : Array.from({ length: 16 }, (_, j) => (
                  <polyline
                    key={j}
                    className={`neon-orbite neon-serie-${j % 6}`}
                    points={Array.from({ length: 121 }, (_, k) => {
                      const a = (k * 2 * Math.PI) / 120,
                        r = 43 + 13 * Math.sin(3 * a + j * 0.3) + 5 * Math.cos(5 * a - j * 0.18);
                      return `${130 + Math.cos(a + j * 0.12) * r},${90 + Math.sin(a + j * 0.12) * r * 0.82}`;
                    }).join(' ')}
                  />
                ))}
          </g>
        </>
      )}
    </svg>
  );
}
