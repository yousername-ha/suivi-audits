/* Icônes du formulaire de connexion (SVG, traits simples, décoratives : le libellé reste porté par le champ ou le bouton). */
import type { ReactNode } from 'react';

function Icone({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

export const IconePersonne = () => (
  <Icone className="auth-icone">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </Icone>
);
export const IconeCadenas = () => (
  <Icone className="auth-icone">
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </Icone>
);
export const IconeOeil = () => (
  <Icone>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icone>
);
export const IconeOeilBarre = () => (
  <Icone>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    <path d="M4 4l16 16" />
  </Icone>
);
export const IconeFleche = () => (
  <Icone>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icone>
);
