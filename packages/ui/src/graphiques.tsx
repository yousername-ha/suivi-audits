/* Graphiques de tableau de bord (UI-02) : anneau, histogramme empilé et jauge, en SVG sans dépendance.
   Couleurs : classes « graph-<teinte> » reliées aux teintes de la charte (--carte-<teinte>-accent, clair et sombre) ;
   aucun style en ligne (CSP). Chaque graphique a une alternative textuelle : légende chiffrée ou tableau masqué. */
import { VisuallyHidden } from '@mantine/core';
import type { TeinteCarte } from './tokens.ts';

export type TeinteGraphique = Exclude<TeinteCarte, 'marine'>;

export interface PartGraphique {
  libelle: string;
  valeur: number;
  teinte: TeinteGraphique;
}

const pourcent = (n: number, total: number) => (total ? Math.round((n * 100) / total) : 0);
const RAYON = 40;
const CIRCONFERENCE = 2 * Math.PI * RAYON;

/** Arcs de l'anneau : longueur et décalage de chaque part sur la circonférence (parts nulles omises). */
export function arcsAnneau(parts: readonly PartGraphique[]) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.valeur), 0);
  let debut = 0;
  return parts
    .filter((p) => p.valeur > 0)
    .map((p) => {
      const longueur = total ? (p.valeur / total) * CIRCONFERENCE : 0;
      const arc = { ...p, longueur, decalage: debut };
      debut += longueur;
      return arc;
    });
}

/** Anneau avec chiffre central et légende chiffrée (pourcentages arrondis). */
export function Anneau({
  titre,
  parts,
  centre,
  sousCentre,
}: {
  titre: string;
  parts: readonly PartGraphique[];
  centre: string;
  sousCentre?: string;
}) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.valeur), 0);
  const resume = parts.map((p) => `${p.libelle} : ${p.valeur}`).join(', ');
  return (
    <div className="graph-anneau">
      <svg viewBox="0 0 100 100" role="img" aria-label={`${titre} : ${total ? resume : 'aucune donnée'}`}>
        <circle cx="50" cy="50" r={RAYON} className="graph-piste" />
        {arcsAnneau(parts).map((a) => (
          <circle
            key={a.libelle}
            cx="50"
            cy="50"
            r={RAYON}
            className={`graph-arc graph-${a.teinte}`}
            strokeDasharray={`${a.longueur} ${CIRCONFERENCE - a.longueur}`}
            strokeDashoffset={-a.decalage}
            transform="rotate(-90 50 50)"
          >
            <title>{`${a.libelle} : ${a.valeur} (${pourcent(a.valeur, total)} %)`}</title>
          </circle>
        ))}
        <text x="50" y={sousCentre ? 49 : 54} className="graph-centre" textAnchor="middle">
          {centre}
        </text>
        {sousCentre && (
          <text x="50" y="62" className="graph-sous-centre" textAnchor="middle">
            {sousCentre}
          </text>
        )}
      </svg>
      <ul className="graph-legende" aria-label={`Légende : ${titre}`}>
        {parts.map((p) => (
          <li key={p.libelle}>
            <span className={`graph-pastille graph-${p.teinte}`} aria-hidden="true" />
            <span className="graph-legende-libelle">{p.libelle}</span>
            <span className="graph-legende-valeur chiffres">{p.valeur}</span>
            <span className="graph-legende-pourcent chiffres">{pourcent(p.valeur, total)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface SerieGraphique {
  cle: string;
  libelle: string;
  teinte: TeinteGraphique;
}
export interface CategorieGraphique {
  libelle: string;
  valeurs: Record<string, number>;
}

/** Graduation haute « arrondie » de l'axe (au moins 3, multiple de 3 pour trois intervalles entiers). */
export function hautAxe(max: number) {
  return Math.max(3, Math.ceil((max * 1.08) / 3) * 3);
}

/** Histogramme empilé (une barre par catégorie). max fixe (par exemple 100 pour des pourcentages). */
export function Histogramme({
  titre,
  categories,
  series,
  max,
  format = (v: number) => String(Math.round(v)),
  vide,
}: {
  titre: string;
  categories: readonly CategorieGraphique[];
  series: readonly SerieGraphique[];
  max?: number;
  format?: (v: number) => string;
  vide?: string;
}) {
  const W = 420,
    H = 210,
    gauche = 44,
    bas = 24,
    hautZone = 22;
  const totaux = categories.map((c) => series.reduce((s, x) => s + Math.max(0, c.valeurs[x.cle] ?? 0), 0));
  const haut = max ?? hautAxe(Math.max(0, ...totaux));
  if (vide && totaux.every((t) => t === 0)) return <p className="graph-vide">{vide}</p>;
  const pas = (W - gauche - 8) / Math.max(categories.length, 1);
  const largeur = Math.min(38, pas * 0.6);
  const echelle = (v: number) => (v / haut) * (H - bas - hautZone);
  return (
    <div className="graph-histogramme">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={titre}>
        {[0, 1, 2, 3].map((i) => {
          const y = H - bas - ((H - bas - hautZone) * i) / 3;
          return (
            <g key={i}>
              <line x1={gauche} x2={W} y1={y} y2={y} className="graph-grille" />
              <text x={gauche - 8} y={y + 4} textAnchor="end" className="graph-axe">
                {format((haut * i) / 3)}
              </text>
            </g>
          );
        })}
        {categories.map((c, i) => {
          const x = gauche + pas * i + (pas - largeur) / 2;
          let y = H - bas;
          return (
            <g key={c.libelle}>
              {series.map((s) => {
                const h = echelle(Math.max(0, c.valeurs[s.cle] ?? 0));
                if (h <= 0) return null;
                y -= h;
                return (
                  <rect key={s.cle} x={x} y={y} width={largeur} height={h} className={`graph-barre graph-${s.teinte}`}>
                    <title>{`${c.libelle} — ${s.libelle} : ${format(c.valeurs[s.cle] ?? 0)}`}</title>
                  </rect>
                );
              })}
              <text x={x + largeur / 2} y={y - 6} textAnchor="middle" className="graph-total">
                {format(totaux[i]!)}
              </text>
              <text x={x + largeur / 2} y={H - 7} textAnchor="middle" className="graph-axe">
                {c.libelle}
              </text>
            </g>
          );
        })}
      </svg>
      <ul className="graph-legende graph-legende-ligne" aria-hidden="true">
        {series.map((s) => (
          <li key={s.cle}>
            <span className={`graph-pastille graph-${s.teinte}`} />
            <span className="graph-legende-libelle">{s.libelle}</span>
          </li>
        ))}
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
            {categories.map((c) => (
              <tr key={c.libelle}>
                <th scope="row">{c.libelle}</th>
                {series.map((s) => (
                  <td key={s.cle}>{format(c.valeurs[s.cle] ?? 0)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </VisuallyHidden>
    </div>
  );
}

/** Jauge horizontale « valeur sur maximum », avec une cible facultative en pourcentage. */
export function Jauge({
  libelle,
  valeur,
  max,
  texte,
  detail,
  cible,
}: {
  libelle: string;
  valeur: number;
  max: number;
  texte?: string;
  detail?: string;
  cible?: number;
}) {
  const p = max ? Math.min(100, (valeur * 100) / max) : 0;
  const teinte: TeinteGraphique = cible != null && p < cible ? 'orange' : 'vert';
  return (
    <div className="graph-jauge">
      <div className="graph-jauge-tete">
        <span>{libelle}</span>
        <b className="chiffres">{texte ?? `${Math.round(p)} %`}</b>
      </div>
      <svg
        viewBox="0 0 100 4"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${libelle} : ${texte ?? `${Math.round(p)} %`}`}
      >
        <rect width="100" height="4" rx="2" className="graph-piste-jauge" />
        <rect width={p} height="4" rx="2" className={`graph-barre graph-${teinte}`} />
        {cible != null && <line x1={cible} x2={cible} y1="0" y2="4" className="graph-cible" />}
      </svg>
      {detail && <div className="graph-jauge-detail">{detail}</div>}
    </div>
  );
}
