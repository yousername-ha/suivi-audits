/* Graphiques SVG des pages reprises de l'outil de suivi (barres empilées, anneau) : positions en attributs SVG, couleurs
   par classes (jetons --carte-*), aucun style en ligne (CSP stricte). */
import { Card, Group, Text } from '@mantine/core';

export interface SerieBarres {
  cle: string;
  libelle: string;
  /** Teinte 0 à 5 de la palette des graphiques. */
  teinte: number;
}
export interface ColonneBarres {
  libelle: string;
  valeurs: Record<string, number>;
}
const L = 520,
  H = 220,
  GAUCHE = 60,
  BAS = 26,
  HAUT = 10;

/** Barres empilées par colonne ; `sommet` est la valeur de l'axe en haut du graphique (trois intervalles). */
export function BarresEmpilees({
  colonnes,
  series,
  sommet,
  formatAxe,
  formatTotal,
  ariaLabel,
}: {
  colonnes: ColonneBarres[];
  series: SerieBarres[];
  sommet: number;
  formatAxe: (v: number) => string;
  formatTotal?: (v: number) => string;
  ariaLabel: string;
}) {
  const hauteurUtile = H - BAS - HAUT;
  const pas = (L - GAUCHE) / Math.max(1, colonnes.length),
    largeur = Math.min(70, pas * 0.5);
  return (
    <svg viewBox={`0 0 ${L} ${H}`} role="img" aria-label={ariaLabel} className="gr-svg">
      {[0, 1, 2, 3].map((i) => {
        const y = H - BAS - (hauteurUtile * i) / 3;
        return (
          <g key={i}>
            <line x1={GAUCHE} x2={L} y1={y} y2={y} className="gr-grille" />
            <text x={GAUCHE - 6} y={y + 4} textAnchor="end" className="gr-axe">
              {formatAxe((sommet * i) / 3)}
            </text>
          </g>
        );
      })}
      {colonnes.map((c, i) => {
        const x = GAUCHE + pas * i + (pas - largeur) / 2;
        let y = H - BAS;
        const total = series.reduce((a, s) => a + (c.valeurs[s.cle] ?? 0), 0);
        return (
          <g key={c.libelle}>
            {series.map((s) => {
              const v = c.valeurs[s.cle] ?? 0,
                h = (v / sommet) * hauteurUtile;
              if (h <= 0) return null;
              y -= h;
              return (
                <rect key={s.cle} x={x} y={y} width={largeur} height={h} className={`gr-t${s.teinte}`}>
                  <title>
                    {c.libelle} — {s.libelle} : {formatAxe(v)}
                  </title>
                </rect>
              );
            })}
            <text x={x + largeur / 2} y={H - 8} textAnchor="middle" className="gr-etiquette">
              {c.libelle}
            </text>
            {formatTotal && total > 0 && (
              <text x={x + largeur / 2} y={y - 6} textAnchor="middle" className="gr-total">
                {formatTotal(total)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export interface PartAnneau {
  libelle: string;
  valeur: number;
  teinte: number;
  /** Texte de la valeur dans la légende (par défaut, la valeur). */
  texte?: string;
}
const R = 74,
  r = 46;
const point = (a: number, rayon: number) => `${100 + rayon * Math.cos(a)} ${100 + rayon * Math.sin(a)}`;

/** Anneau avec légende (libellé, valeur, pourcentage). */
export function Anneau({
  parts,
  centre,
  sous,
  ariaLabel,
}: {
  parts: PartAnneau[];
  centre: string;
  sous: string;
  ariaLabel: string;
}) {
  const total = parts.reduce((a, p) => a + p.valeur, 0);
  let a0 = -Math.PI / 2;
  return (
    <Group align="center" gap="md">
      <svg viewBox="0 0 200 200" role="img" aria-label={ariaLabel} className="gr-anneau">
        {total <= 0 && <circle cx="100" cy="100" r={(R + r) / 2} className="gr-vide" />}
        {parts.map((p) => {
          if (p.valeur <= 0) return null;
          const a1 = a0 + (p.valeur / total) * Math.PI * 2 - 0.012,
            grand = a1 - a0 > Math.PI ? 1 : 0;
          const d = `M${point(a0, R)}A${R} ${R} 0 ${grand} 1 ${point(a1, R)}L${point(a1, r)}A${r} ${r} 0 ${grand} 0 ${point(a0, r)}Z`;
          a0 = a1 + 0.012;
          return (
            <path key={p.libelle} d={d} className={`gr-t${p.teinte}`}>
              <title>
                {p.libelle} : {p.texte ?? p.valeur}
              </title>
            </path>
          );
        })}
        <text x="100" y="99" textAnchor="middle" className="gr-centre">
          {centre}
        </text>
        <text x="100" y="118" textAnchor="middle" className="gr-sous">
          {sous}
        </text>
      </svg>
      <ul className="gr-legende">
        {parts.map((p) => (
          <li key={p.libelle}>
            <span className={`gr-pastille gr-t${p.teinte}`} aria-hidden="true" />
            <Text size="sm" component="span">
              {p.libelle}
            </Text>
            <Text size="sm" fw={600} component="span">
              {p.texte ?? p.valeur}
            </Text>
            <Text size="sm" c="dimmed" component="span">
              {total ? Math.round((p.valeur * 100) / total) : 0} %
            </Text>
          </li>
        ))}
      </ul>
    </Group>
  );
}

/** Légende des séries d'un graphique en barres. */
export function LegendeSeries({ series }: { series: SerieBarres[] }) {
  return (
    <ul className="gr-legende gr-legende-ligne">
      {series.map((s) => (
        <li key={s.cle}>
          <span className={`gr-pastille gr-t${s.teinte}`} aria-hidden="true" />
          <Text size="sm" component="span">
            {s.libelle}
          </Text>
        </li>
      ))}
    </ul>
  );
}

/** Bandeau de chiffres clés (valeur, libellé, précision). */
export function Chiffres({ items }: { items: { valeur: string | number; libelle: string; detail?: string }[] }) {
  return (
    <Group>
      {items.map((i) => (
        <Card key={i.libelle} withBorder padding="sm">
          <Text fw={700} size="lg">
            {i.valeur}
          </Text>
          <Text size="xs" c="dimmed">
            {i.libelle}
          </Text>
          {i.detail && <Text size="xs">{i.detail}</Text>}
        </Card>
      ))}
    </Group>
  );
}
