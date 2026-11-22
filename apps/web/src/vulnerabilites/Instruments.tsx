/* Module Vulnérabilités, « Vue d'ensemble » : instruments du niveau d'alerte et des chiffres clés, dans le vocabulaire du
   réacteur de la page de maintenance (docker/maintenance) : croix de visée, graduations, anneau en tirets qui tourne,
   orbites et satellite, crans du niveau en arc. Choix du RSSI du 22/11/2026 (proposition 1). Dessins décoratifs
   (aria-hidden) : le niveau, son libellé et l'échelle restent écrits dans la page. Sous la CSP stricte (ADR 0006) : aucun
   style en ligne ; positions par attributs SVG ; couleurs et animations par packages/ui/src/neon-vulnerabilites.css
   (animations coupées par le mouvement réduit et à l'impression). */
import { NIVEAUX_ALERTE_GLOBAL, type NiveauAlerteGlobal } from '@suivi/shared';

const C = 120;

/** Point d'un cercle de centre (C, C), angle en degrés compté depuis le haut, dans le sens des aiguilles d'une montre. */
function point(r: number, angle: number): [number, number] {
  const a = (angle * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
}

/** Arc de cercle de a0 à a1 (degrés, a0 < a1), en chemin SVG. */
export function arcReacteur(r: number, a0: number, a1: number): string {
  const [x0, y0] = point(r, a0);
  const [x1, y1] = point(r, a1);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}

/** Crans du niveau : quatre arcs sur 270 degrés, ouverts en bas (le libellé s'y écrit). */
const DEBUT = -135;
const PAS = 67.5;
const JEU = 2.5;
export function arcCran(n: NiveauAlerteGlobal): string {
  return arcReacteur(82, DEBUT + (n - 1) * PAS + JEU, DEBUT + n * PAS - JEU);
}

/** Réacteur du niveau d'alerte : décor seulement (le niveau est écrit à côté, dans la page). */
export function Reacteur({ niveau }: { niveau: NiveauAlerteGlobal }) {
  const [px, py] = point(99, 62);
  return (
    <svg className="vu-reacteur" viewBox="0 0 240 240" aria-hidden="true" focusable="false">
      <g className="vu-reacteur__croix">
        <path d="M120 0v12M120 228v12M0 120h12M228 120h12M37 37l8 8M195 195l8 8M37 203l8-8M195 45l8-8" />
        <circle cx={C} cy={C} r="114" strokeDasharray="1 7" />
        <circle cx={C} cy={C} r="106" className="vu-reacteur__fin" />
      </g>
      <g className="vu-reacteur__anneau">
        <circle cx={C} cy={C} r="99" strokeDasharray="70 12 26 9 150 40 50 26" />
        <path className="vu-reacteur__arc" d={arcReacteur(99, 18, 62)} />
        <circle className="vu-reacteur__point" cx={px.toFixed(1)} cy={py.toFixed(1)} r="3.5" />
      </g>
      <g className="vu-reacteur__orbites">
        <ellipse cx={C} cy={C} rx="116" ry="44" transform="rotate(-31 120 120)" />
        <ellipse cx={C} cy={C} rx="116" ry="44" transform="rotate(31 120 120)" />
        <circle className="vu-reacteur__satellite" cx="219" cy="64" r="3" />
      </g>
      {NIVEAUX_ALERTE_GLOBAL.map((n) => (
        <g key={n} className={`vu-cran vu-cran--${n}${n <= niveau ? ' vu-cran--atteint' : ''}`}>
          {n === niveau && <path className="vu-cran__halo" d={arcCran(n)} />}
          <path className="vu-cran__arc" d={arcCran(n)} />
        </g>
      ))}
      <g className="vu-reacteur__graduations">
        <circle cx={C} cy={C} r="65" strokeDasharray="1.2 5.6" />
      </g>
      {niveau >= 3 && <circle className="vu-reacteur__coeur" cx={C} cy={C} r="50" />}
    </svg>
  );
}

/** Icônes des chiffres clés (traits, 24 unités) : décor des cases, à la manière des étapes de la maintenance. */
const ICONES = {
  exploitees:
    'M9 9h6v7a3 3 0 0 1-6 0zM10 9V7.5a2 2 0 0 1 4 0V9M5 12.5h4M15 12.5h4M6 18l3-1.5M18 18l-3-1.5M6.5 7.5 9 9.5M17.5 7.5 15 9.5',
  aTraiter:
    'M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9M12 2v3M12 19v3M2 12h3M19 12h3',
  aConfirmer:
    'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2M9.8 9.6a2.3 2.3 0 1 1 3.4 2c-.8.5-1.2 1-1.2 1.9M12 16.5v.01',
  depassement: 'M12 5a8 8 0 1 0 0 16 8 8 0 0 0 0-16M12 9v4l2.8 1.8M9 2.5h6',
  finSupport: 'M7 3h10M7 21h10M8 3c0 4.5 8 4.5 8 9s-8 4.5-8 9M16 3c0 4.5-8 4.5-8 9s8 4.5 8 9',
  corrigees: 'M12 3 19 6v5.5c0 4.3-2.9 7.5-7 9.5-4.1-2-7-5.2-7-9.5V6zM9 12l2.2 2.2L15.5 10',
  /* Veille réglementaire : à qualifier (document), à suivre (œil), impactant (balance), sans objet (archive). */
  aQualifierVeille: 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5',
  aSuivreVeille: 'M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  impactantVeille: 'M12 3v18M5 21h14M7 7h10M7 7l-3 7a3 3 0 0 0 6 0zM17 7l-3 7a3 3 0 0 0 6 0z',
  sansObjetVeille: 'M4 5h16v4H4zM5 9v10h14V9M10 13h4',
} as const;
export type IconeTuile = keyof typeof ICONES;

/** En-tête décoratif d'une case : icône dans un carré bordé, numéro à deux chiffres. */
export function TeteCase({ icone, rang }: { icone: IconeTuile; rang: number }) {
  return (
    <>
      <span className="vu-case__icone" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d={ICONES[icone]} />
        </svg>
      </span>
      <span className="vu-case__rang" aria-hidden="true">
        {String(rang).padStart(2, '0')}
      </span>
    </>
  );
}

/** Ondes de la maintenance, à côté d'un chiffre qui demande une action (décor). */
export function Ondes() {
  return (
    <span className="vu-case__ondes" aria-hidden="true">
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
