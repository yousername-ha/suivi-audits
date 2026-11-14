/* Pictogrammes du menu latéral bleu nuit (refonte Neon, retenu le 13/11/2026). SVG déclaratifs, décoratifs (le libellé du
   lien porte l'information) : aucun état métier n'est déduit de leurs mouvements. Les huit familles bougent à l'intérieur
   du dessin, uniquement par `transform` et `opacity` (neon-menu.css) ; les entrées d'administration sont statiques.
   Les tracés reprennent la maquette retenue (menu-chaud-anime/icones.js, MENU-SYMBOLES.svg) ; la coche de Conformité se
   dessine par un masque qui s'élargit (transform), sans animer le tracé lui-même. Teinte : `--menu-teinte` posée par
   l'entrée (data-identite), jamais par la position dans le menu. */
import { useId, type ReactNode } from 'react';
import type { IdentiteMenu } from './tokens.ts';

function Famille({ children }: { children: ReactNode }) {
  return (
    <span className="nav-icone nav-icone--neon" aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}
function Administration({ children }: { children: ReactNode }) {
  return (
    <span className="nav-icone nav-icone--neon nav-icone--admin" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

/** Coche de Conformité : masque propre à chaque instance (identifiant unique, plusieurs menus peuvent coexister). */
function Conformite() {
  const id = 'mw-coche-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <Famille>
      <defs>
        <clipPath id={id}>
          <rect className="mw-motion mw-check" x="9" y="8" width="14" height="13" />
        </clipPath>
      </defs>
      <path className="mf-fill" d="m16 3 11 4v10c0 6-11 12-11 12S5 23 5 17V7Z" />
      <path d="m10 15 4 4 8-9" clipPath={`url(#${id})`} />
      <path className="mf-accent" d="M1 11v8m30-8v8M12 2h8" />
    </Famille>
  );
}

const DESSINS: Record<IdentiteMenu | 'retex', () => ReactNode> = {
  dashboard: () => (
    <Famille>
      <path className="mf-fill mw-motion mw-tiles" d="M5 6h9v9H5Zm13 12h9v8h-9Z" />
      <path d="M18 6h9v9h-9ZM5 19h9v7H5Z" />
      <path className="mf-accent" d="M22 2h5l3 3M2 23v4l3 3" />
    </Famille>
  ),
  organisation: () => (
    <Famille>
      <path d="M16 11v5M7 22v-6h18v6" />
      <path className="mf-fill mw-motion mw-organisation" d="m16 3 5 3v6l-5 3-5-3V6Z" />
      <path className="mf-fill" d="M7 21l5 3v5H2v-5Zm18 0 5 3v5H20v-5Z" />
      <circle className="mf-node" cx="16" cy="18" r="1.8" />
    </Famille>
  ),
  pilotage: () => (
    <Famille>
      <path className="mf-orbit" d="M3 23V5h26M3 12h26M3 19h26" />
      <path d="M3 27h26" />
      <path className="mf-accent mw-motion mw-pilotage" d="m5 22 6-8 6 3L27 5M21 5h6v6" />
      <circle className="mf-node" cx="17" cy="17" r="2" />
    </Famille>
  ),
  risques: () => (
    <Famille>
      <g className="mw-motion mw-risque">
        <path className="mf-fill" d="m16 3 14 25H2Z" />
        <path d="M16 11v8" />
        <circle className="mf-node" cx="16" cy="23" r="1.6" />
      </g>
      <path className="mf-accent" d="m3 8 3-5h4M26 3h3v5" />
    </Famille>
  ),
  conformite: () => <Conformite />,
  actions: () => (
    <Famille>
      <path className="mf-orbit" d="M7 7v18h20" />
      <path className="mf-fill" d="M3 3h8v8H3Zm18 18h8v8h-8Z" />
      <path d="m5 17 3 3 6-7" />
      <path className="mf-accent mw-motion mw-action" d="M17 7h10m-4-4 4 4-4 4" />
      <circle className="mf-node" cx="17" cy="25" r="1.8" />
    </Famille>
  ),
  resilience: () => (
    <Famille>
      <path className="mf-orbit" d="M16 3a13 13 0 1 0 13 13" />
      <path className="mf-accent mw-motion mw-resilience" d="M27 12a11 11 0 1 0-2 12M27 5v7h-7" />
      <path d="M16 10v7l5 3" />
      <circle className="mf-node" cx="7" cy="7" r="2" />
    </Famille>
  ),
  documents: () => (
    <Famille>
      <path className="mf-orbit" d="M4 7v22h18" />
      <path className="mf-fill" d="M9 3h12l7 7v17H9Z" />
      <path d="M21 3v8h7" />
      <path className="mw-motion mw-document" d="M13 16h10m-10 5h7" />
      <path className="mf-accent" d="M2 2h4M28 29h3v-4" />
    </Famille>
  ),
  plateforme: () => (
    <Administration>
      <path d="M3 3h7v7H3Zm11 0h7v7h-7ZM3 14h7v7H3Zm11 0h7v7h-7Z" />
    </Administration>
  ),
  parametres: () => (
    <Administration>
      <path d="M4 7h16M4 17h16M8 3v8M16 13v8" />
    </Administration>
  ),
  compte: () => (
    <Administration>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
    </Administration>
  ),
  aide: () => (
    <Administration>
      <path d="M3 4h7a4 4 0 0 1 4 4v13a5 5 0 0 0-4-2H3Zm18 0h-3a4 4 0 0 0-4 4M21 4v15h-3a5 5 0 0 0-4 2" />
    </Administration>
  ),
  mur: () => (
    <Administration>
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8m-4-4v4M6 12l4-4 4 3 4-5" />
    </Administration>
  ),
  // « Mes contributions RETEX » (entrée conditionnelle de la cible, absente de la maquette) : même trait que les autres
  // entrées d'administration, teinte de la famille Résilience à laquelle appartiennent les incidents.
  retex: () => (
    <Administration>
      <path d="M6 3h8l4 4v14H6ZM14 3v5h4" />
      <path d="M9 13h3l1.5-2.5L15 15l1-2h1" />
    </Administration>
  ),
};

/** Pictogramme d'une entrée du menu, par identité (famille ou page). */
export function IconeMenu({ identite }: { identite: IdentiteMenu | 'retex' }) {
  const Dessin = DESSINS[identite];
  return <Dessin />;
}
