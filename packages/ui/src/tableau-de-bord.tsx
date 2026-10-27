/* Tableau de bord « verre et relief » de l'accueil (ADR 0066) : dalles en verre, chiffres clés, jauges en arc,
   barres horizontales et empilées, colorées selon des seuils. SVG sans dépendance ; couleurs par classes reliées aux
   variables --tdb-* (clair et sombre, tokens.ts) ; aucun style en ligne (CSP). Chaque métrique a une alternative
   textuelle : libellé chiffré, liste ou tableau masqué. */
import { VisuallyHidden } from '@mantine/core';
import type { ReactNode } from 'react';
import type { TeinteSeuil } from './tokens.ts';

/** Seuils d'affichage : teinte de base, puis teinte de chaque palier atteint (valeur ≥ des). */
export interface Seuils {
  base: TeinteSeuil;
  paliers: readonly { des: number; teinte: TeinteSeuil }[];
}

/** Seuils par défaut d'un taux en pourcentage : rouge sous 60, orange de 60 à 80, vert à partir de 80. */
export const SEUILS_TAUX: Seuils = {
  base: 'rouge',
  paliers: [
    { des: 60, teinte: 'orange' },
    { des: 80, teinte: 'vert' },
  ],
};

const paliersTries = (s: Seuils) => [...s.paliers].sort((a, b) => a.des - b.des);

/** Teinte d'une valeur : celle du plus haut palier atteint, sinon la base. */
export function teinteSeuil(seuils: Seuils, valeur: number): TeinteSeuil {
  return paliersTries(seuils).reduce<TeinteSeuil>((t, p) => (valeur >= p.des ? p.teinte : t), seuils.base);
}

/** Pourcentage n / d (0 si d est nul ou négatif). */
export const taux = (n: number, d: number) => (d > 0 ? (n * 100) / d : 0);
/** Pourcentage arrondi, espace fine insécable avant le signe. */
export const fmtTaux = (v: number) => `${Math.round(v)}\u202f%`;

const borne = (f: number) => Math.max(0, Math.min(1, f));
const arrondi = (n: number) => Math.round(n * 100) / 100;

/** Point du demi-cercle de centre (100, 100) : fraction 0 à gauche, 1 à droite. */
export function pointArc(fraction: number, rayon: number): [number, number] {
  const a = Math.PI * (1 - borne(fraction));
  return [arrondi(100 + rayon * Math.cos(a)), arrondi(100 - rayon * Math.sin(a))];
}

/** Chemin SVG de l'arc entre deux fractions du demi-cercle ; vide si l'arc est nul. */
export function cheminArc(de: number, a: number, rayon: number): string {
  const [f1, f2] = [borne(de), borne(a)];
  if (f2 - f1 <= 0.0005) return '';
  const [x1, y1] = pointArc(f1, rayon);
  const [x2, y2] = pointArc(f2, rayon);
  return `M ${x1} ${y1} A ${rayon} ${rayon} 0 0 1 ${x2} ${y2}`;
}

/** Zones colorées d'une jauge en pourcentage : une par teinte, de 0 à 100. */
export function bandesSeuils(seuils: Seuils) {
  const debuts = [
    { de: 0, teinte: seuils.base },
    ...paliersTries(seuils).map((p) => ({ de: p.des, teinte: p.teinte })),
  ];
  return debuts.map((b, i) => ({ ...b, a: debuts[i + 1]?.de ?? 100 })).filter((b) => b.a > b.de);
}

export type LargeurDalle = 3 | 4 | 6 | 8 | 12;

/** Dalle en verre : titre, sous-titre (source et axe), contenu. largeur : colonnes sur 12 aux grands écrans. */
export function Dalle({
  titre,
  sousTitre,
  largeur = 4,
  lueur = false,
  className = '',
  children,
}: {
  titre: string;
  sousTitre?: string;
  largeur?: LargeurDalle;
  lueur?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`tdb-dalle tdb-l${largeur}${lueur ? ' tdb-dalle--lueur' : ''}${className ? ` ${className}` : ''}`}
      aria-label={titre}
    >
      <div className="tdb-dalle-tete">
        <h2 className="tdb-dalle-titre">{titre}</h2>
        {sousTitre && <p className="tdb-dalle-sous-titre">{sousTitre}</p>}
      </div>
      <div className="tdb-dalle-corps">{children}</div>
    </section>
  );
}

/** Chiffre clé : valeur en grand (colorée selon la teinte), détail et légende. */
export function ChiffreCle({
  valeur,
  teinte,
  detail,
  legende,
}: {
  valeur: string;
  teinte?: TeinteSeuil;
  detail?: ReactNode;
  legende?: ReactNode;
}) {
  return (
    <div className="tdb-chiffre">
      <p className={`tdb-chiffre-valeur chiffres${teinte ? ` tdb-t-${teinte}` : ''}`}>{valeur}</p>
      {detail && <p className="tdb-chiffre-detail">{detail}</p>}
      {legende && <p className="tdb-chiffre-legende">{legende}</p>}
    </div>
  );
}

const DEMI_CERCLE = 'M 20 100 A 80 80 0 0 1 180 100';

/** Jauge en arc fin d'un pourcentage : zones de seuils en filet, curseur au bout de l'arc, cible facultative. */
export function JaugeArc({
  libelle,
  valeur,
  max = 100,
  seuils = SEUILS_TAUX,
  cible,
  detail,
}: {
  libelle: string;
  valeur: number;
  max?: number;
  seuils?: Seuils;
  cible?: number;
  detail?: ReactNode;
}) {
  const p = Math.min(100, taux(valeur, max));
  const f = p / 100;
  const teinte = teinteSeuil(seuils, p);
  const [kx, ky] = pointArc(f, 80);
  const texte = fmtTaux(p);
  const repere = cible != null ? [pointArc(cible / 100, 72), pointArc(cible / 100, 96)] : null;
  return (
    <figure className="tdb-jauge">
      <svg
        viewBox="0 -2 200 122"
        role="img"
        aria-label={`${libelle} : ${texte}${cible != null ? `, cible ${fmtTaux(cible)}` : ''}`}
      >
        <path d={DEMI_CERCLE} className="tdb-jauge-rail-contour" />
        <path d={DEMI_CERCLE} className="tdb-jauge-rail" />
        {bandesSeuils(seuils).map((b) => (
          <path key={b.de} d={cheminArc(b.de / 100, b.a / 100, 91)} className={`tdb-jauge-bande tdb-s-${b.teinte}`} />
        ))}
        {f > 0 && <path d={cheminArc(0, f, 80)} className="tdb-jauge-arc-contour" />}
        {f > 0 && <path d={cheminArc(0, f, 80)} className={`tdb-jauge-arc tdb-s-${teinte}`} />}
        {repere && (
          <line x1={repere[0]![0]} y1={repere[0]![1]} x2={repere[1]![0]} y2={repere[1]![1]} className="tdb-cible" />
        )}
        <circle cx={kx} cy={ky} r="6.5" className="tdb-jauge-curseur" />
        <circle cx={kx} cy={ky} r="3" className={`tdb-f-${teinte}`} />
        <text x="100" y="88" textAnchor="middle" className={`tdb-jauge-valeur chiffres tdb-t-${teinte}`}>
          {texte}
        </text>
        <text x="20" y="118" textAnchor="middle" className="tdb-jauge-borne">
          0 %
        </text>
        <text x="180" y="118" textAnchor="middle" className="tdb-jauge-borne">
          100 %
        </text>
      </svg>
      {detail && <figcaption className="tdb-jauge-detail">{detail}</figcaption>}
    </figure>
  );
}

/** Barre fine en relief (rail en creux, remplissage cerné, reflet), en pourcentage de la largeur. */
function Barre({ pourcent, teinte, cible }: { pourcent: number; teinte: TeinteSeuil; cible?: number }) {
  const p = Math.max(0, Math.min(100, pourcent));
  return (
    <svg className="tdb-barre" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
      <rect width="100" height="6" rx="3" className="tdb-rail" />
      {p > 0 && <rect width={p} height="6" rx="3" className={`tdb-barre-remplie tdb-f-${teinte}`} />}
      {p > 0 && <rect width={p} height="2.6" rx="1.3" className="tdb-reflet" />}
      {cible != null && <line x1={cible} x2={cible} y1="0" y2="6" className="tdb-cible" />}
    </svg>
  );
}

export interface LigneBarre {
  libelle: string;
  valeur: number;
  max: number;
  /** Texte affiché à droite ; par défaut, le pourcentage. */
  texte?: string;
}

/** Barres horizontales : une ligne par catégorie (libellé, valeur, barre). Avec des seuils, la barre et la valeur
    prennent la teinte de leur pourcentage ; sans seuils, la teinte fixe. */
export function BarresHorizontales({
  titre,
  lignes,
  seuils,
  teinte = 'vert',
  cible,
  vide = 'Aucune donnée.',
}: {
  titre: string;
  lignes: readonly LigneBarre[];
  seuils?: Seuils;
  teinte?: TeinteSeuil;
  cible?: number;
  vide?: string;
}) {
  if (!lignes.length) return <p className="graph-vide">{vide}</p>;
  return (
    <ul className="tdb-barres" aria-label={titre}>
      {lignes.map((l) => {
        const p = Math.min(100, taux(l.valeur, l.max));
        const t = seuils ? teinteSeuil(seuils, p) : teinte;
        return (
          <li key={l.libelle} className="tdb-barre-ligne">
            <span className="tdb-barre-libelle">{l.libelle}</span>
            <span className={`tdb-barre-valeur chiffres${seuils ? ` tdb-t-${t}` : ''}`}>{l.texte ?? fmtTaux(p)}</span>
            <Barre pourcent={p} teinte={t} cible={cible} />
          </li>
        );
      })}
    </ul>
  );
}

export interface SerieEmpilee {
  cle: string;
  libelle: string;
  teinte: TeinteSeuil;
}
export interface LigneEmpilee {
  libelle: string;
  valeurs: Record<string, number>;
}

/** Barres empilées à 100 % : une ligne par catégorie, segments séparés ; à droite, la part de la série `part`. */
export function BarresEmpilees({
  titre,
  series,
  lignes,
  part,
  libellePart,
  vide = 'Aucune donnée.',
}: {
  titre: string;
  series: readonly SerieEmpilee[];
  lignes: readonly LigneEmpilee[];
  part: string;
  libellePart: string;
  vide?: string;
}) {
  if (!lignes.length) return <p className="graph-vide">{vide}</p>;
  const ESPACE = 0.8;
  return (
    <div className="tdb-empile">
      <ul className="tdb-empile-lignes" aria-hidden="true">
        {lignes.map((l) => {
          const total = series.reduce((s, x) => s + Math.max(0, l.valeurs[x.cle] ?? 0), 0);
          const segments = series.map((s) => ({ ...s, n: Math.max(0, l.valeurs[s.cle] ?? 0) })).filter((s) => s.n > 0);
          const utile = 100 - ESPACE * Math.max(0, segments.length - 1);
          let x = 0;
          return (
            <li key={l.libelle} className="tdb-empile-ligne">
              <span className="tdb-barre-libelle">{l.libelle}</span>
              <svg className="tdb-barre" viewBox="0 0 100 6" preserveAspectRatio="none">
                {segments.map((s) => {
                  const w = total ? (s.n / total) * utile : 0;
                  const rect = (
                    <g key={s.cle}>
                      <rect x={x} width={w} height="6" rx="2" className={`tdb-barre-remplie tdb-f-${s.teinte}`}>
                        <title>{`${l.libelle} — ${s.libelle} : ${s.n} (${fmtTaux(taux(s.n, total))})`}</title>
                      </rect>
                      <rect x={x} width={w} height="2.6" rx="1.3" className="tdb-reflet" />
                    </g>
                  );
                  x += w + ESPACE;
                  return rect;
                })}
              </svg>
              <span className="tdb-barre-valeur chiffres">{fmtTaux(taux(l.valeurs[part] ?? 0, total))}</span>
            </li>
          );
        })}
      </ul>
      <ul className="tdb-legende" aria-hidden="true">
        {series.map((s) => (
          <li key={s.cle}>
            <span className={`tdb-pastille tdb-b-${s.teinte}`} />
            {s.libelle}
          </li>
        ))}
        <li className="tdb-legende-note">À droite : {libellePart}</li>
      </ul>
      <VisuallyHidden>
        <table>
          <caption>{titre}</caption>
          <thead>
            <tr>
              <th scope="col">Catégorie</th>
              {series.map((s) => (
                <th key={s.cle} scope="col">
                  {s.libelle}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.libelle}>
                <th scope="row">{l.libelle}</th>
                {series.map((s) => (
                  <td key={s.cle}>{l.valeurs[s.cle] ?? 0}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </div>
  );
}
