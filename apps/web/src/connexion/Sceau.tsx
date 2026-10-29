/* Sceau décoratif du panneau de connexion (aria-hidden) : anneau, texte circulaire qui tourne, écu tricolore assombri et
   coche blanche contournée. Teintes : jetons --suivi-sceau-* et navigation (packages/ui). */
import { useId } from 'react';

const ECU = 'M120 91 L145 100 V120 C145 136 134 145 120 151 C106 145 95 136 95 120 V100 Z';
const COCHE = 'M109 121 l8 8 l14 -16';

export function Sceau() {
  const id = useId();
  const cercle = `${id}-cercle`;
  const ecu = `${id}-ecu`;
  return (
    <svg className="auth-sceau" aria-hidden="true" focusable="false" viewBox="0 0 240 240">
      <defs>
        <path id={cercle} d="M120 120 m-70 0 a70 70 0 1 1 140 0 a70 70 0 1 1 -140 0" />
        <clipPath id={ecu}>
          <path d={ECU} />
        </clipPath>
      </defs>
      <g className="auth-sceau__deco">
        <circle className="auth-sceau__anneau" cx="120" cy="120" r="88" />
        <circle className="auth-sceau__fin" cx="120" cy="120" r="56" />
        <g className="auth-sceau__tourne">
          <text className="auth-sceau__texte">
            <textPath href={`#${cercle}`}>GOUVERNANCE · RISQUES · CONFORMITÉ · SMSI · SMQ ·</textPath>
          </text>
        </g>
        <circle className="auth-sceau__coeur" cx="120" cy="120" r="50" />
      </g>
      <g className="auth-sceau__drapeau" clipPath={`url(#${ecu})`}>
        <rect className="auth-sceau__bleu" x="95" y="90" width="16.7" height="62" />
        <rect className="auth-sceau__blanc" x="111.7" y="90" width="16.6" height="62" />
        <rect className="auth-sceau__rouge" x="128.3" y="90" width="16.7" height="62" />
        <rect className="auth-sceau__ombre" x="120" y="90" width="25" height="62" />
      </g>
      <path className="auth-sceau__bord" d={ECU} />
      <path className="auth-sceau__coche-fond" d={COCHE} />
      <path className="auth-sceau__coche" d={COCHE} />
    </svg>
  );
}
