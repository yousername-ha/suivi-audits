/* Icônes de navigation (SVG, traits simples, sans dépendance). Décoratives : le libellé reste porté par le lien. */
import type { ReactNode } from 'react';

function Icone({ children }: { children: ReactNode }) {
  return (
    <span className="nav-icone" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </span>
  );
}

export const IconeAccueil = () => (
  <Icone>
    <path d="M3 11l9-7 9 7" />
    <path d="M5 10v10h5v-6h4v6h5V10" />
  </Icone>
);
export const IconeDocuments = () => (
  <Icone>
    <path d="M7 3h7l5 5v13H7z" />
    <path d="M14 3v5h5" />
    <path d="M10 13h6M10 17h6" />
  </Icone>
);
export const IconeCompte = () => (
  <Icone>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
  </Icone>
);
export const IconeParametres = () => (
  <Icone>
    <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" />
    <circle cx="16" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="18" cy="18" r="2" />
  </Icone>
);
export const IconeAdministration = () => (
  <Icone>
    <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
    <path d="M9 12l2 2 4-4" />
  </Icone>
);
export const IconeHistorique = () => (
  <Icone>
    <rect x="3" y="4" width="18" height="5" rx="1" />
    <path d="M5 9v11h14V9" />
    <path d="M10 13h4" />
  </Icone>
);
export const IconeMur = () => (
  <Icone>
    <rect x="3" y="4" width="18" height="12" rx="1.5" />
    <path d="M8 20h8M12 16v4" />
  </Icone>
);
export const IconeCarte = () => (
  <Icone>
    <path d="M9 4L3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z" />
    <path d="M9 4v13.5M15 6.5V20" />
  </Icone>
);
export const IconeTheme = () => (
  <Icone>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </Icone>
);

/* Une icône par famille du menu ; la couleur vient des jetons --suivi-famille-* (styles.css), jamais du composant. */
export const IconePilotage = () => (
  <Icone>
    <path d="M4 19a8 8 0 1 1 16 0" />
    <path d="M12 19l4-6" />
    <path d="M12 7v2M6.3 9.3l1.4 1.4M17.7 9.3l-1.4 1.4" />
  </Icone>
);
export const IconeOrganisation = () => (
  <Icone>
    <rect x="9" y="3" width="6" height="5" rx="1" />
    <rect x="3" y="16" width="6" height="5" rx="1" />
    <rect x="15" y="16" width="6" height="5" rx="1" />
    <path d="M12 8v4M6 16v-4h12v4" />
  </Icone>
);
export const IconeRisques = () => (
  <Icone>
    <path d="M12 3l10 18H2z" />
    <path d="M12 10v5M12 18h0" />
  </Icone>
);
export const IconeConformite = () => (
  <Icone>
    <rect x="5" y="4" width="14" height="17" rx="1.5" />
    <path d="M9 3h6v3H9z" />
    <path d="M9 13l2 2 4-4" />
  </Icone>
);
export const IconeActions = () => (
  <Icone>
    <path d="M5 21V4" />
    <path d="M5 5h12l-2.5 4L17 13H5" />
  </Icone>
);
export const IconeResilience = () => (
  <Icone>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="3.5" />
    <path d="M5.6 5.6l3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9" />
  </Icone>
);
