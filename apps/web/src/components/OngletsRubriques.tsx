/* Rubriques voisines de la page affichée (même destination du menu) : onglets de navigation, un lien par rubrique
   lisible. Rien n'est affiché quand la destination n'a qu'une rubrique ou quand la page n'appartient pas au menu. */
import { Tooltip } from '@mantine/core';
import {
  IconeCarte,
  IconeDocuments,
  IconeMur,
  IconeOrganisation,
  IconeParametres,
  IconePilotage,
  IconeResilience,
  IconeRisques,
} from '@suivi/ui';
import type { ComponentType, ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { localiser, rubriquesVisibles } from '../navigation';
import { useCan } from '../session';

function Pictogramme({ children }: { children: ReactNode }) {
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
const IconeProduit = () => (
  <Pictogramme>
    <path d="m12 2 9 5v10l-9 5-9-5V7Zm0 10v10M3 7l9 5 9-5M7.5 4.5l9 5" />
  </Pictogramme>
);
const IconeInternet = () => (
  <Pictogramme>
    <circle cx="12" cy="12" r="9" />
    <ellipse cx="12" cy="12" rx="4" ry="9" />
    <path d="M3 12h18" />
  </Pictogramme>
);
const IconeAlerte = () => (
  <Pictogramme>
    <path d="M5 17h14l-2-3v-4a5 5 0 0 0-10 0v4ZM10 20h4M12 3V2" />
  </Pictogramme>
);
const IconeTendance = () => (
  <Pictogramme>
    <path d="M3 3v18h18M6 16l5-5 4 2 6-8m-5 0h5v5" />
  </Pictogramme>
);

/* Les concepts voisins restent nommés ; les pictogrammes usuels libèrent la place occupée par les quatorze libellés
   du module Vulnérabilités. L'identifiant, et non le rang ou le droit de la personne, choisit le dessin. */
const ICONES_RISQUES: Record<string, { icone: ComponentType; libelleCourt?: string }> = {
  risques: { icone: IconeRisques },
  etudes: { icone: IconeDocuments, libelleCourt: 'Études EBIOS RM' },
  carte: { icone: IconeCarte },
  'vulnerabilites-vue': { icone: IconePilotage },
  'vulnerabilites-produits': { icone: IconeProduit },
  'vulnerabilites-veille': { icone: IconeDocuments, libelleCourt: 'Veille' },
  'vulnerabilites-failles': { icone: IconeRisques, libelleCourt: 'Failles' },
  'vulnerabilites-machines': { icone: IconeMur },
  'vulnerabilites-perimetres': { icone: IconeCarte },
  'vulnerabilites-surface': { icone: IconeInternet },
  'vulnerabilites-annuaire': { icone: IconeOrganisation, libelleCourt: 'Active Directory' },
  'vulnerabilites-alertes': { icone: IconeAlerte },
  'vulnerabilites-delais': { icone: IconeResilience, libelleCourt: 'Délais' },
  'vulnerabilites-tendances': { icone: IconeTendance },
  'vulnerabilites-rapport': { icone: IconeDocuments, libelleCourt: 'Rapport' },
  'vulnerabilites-priorite': { icone: IconeParametres, libelleCourt: 'Priorités' },
  'vulnerabilites-masque': { icone: IconeDocuments, libelleCourt: 'Masquage' },
};

export function OngletsRubriques() {
  const can = useCan();
  const { pathname } = useLocation();
  const lieu = localiser(pathname);
  if (!lieu) return null;
  const rubriques = rubriquesVisibles(lieu.destination, can);
  if (rubriques.length < 2) return null;
  const avecIcones = lieu.famille.id === 'risques';
  return (
    <nav
      aria-label={`Rubriques : ${lieu.destination.label}`}
      className={`onglets-rubriques${avecIcones ? ' onglets-rubriques--icones' : ''}`}
    >
      {rubriques.map((r) => {
        const active = r.id === lieu.rubrique.id;
        const presentation = avecIcones ? ICONES_RISQUES[r.id] : undefined;
        if (!presentation)
          return (
            <Link key={r.id} to={r.to} aria-current={active ? 'page' : undefined}>
              {r.label}
            </Link>
          );
        const Icone = presentation.icone;
        const libelleVisible = active || !!presentation.libelleCourt;
        return (
          <Tooltip
            key={r.id}
            label={r.label}
            withArrow
            openDelay={250}
            events={{ hover: true, focus: true, touch: false }}
          >
            <Link to={r.to} className="onglet-rubrique" aria-label={r.label} aria-current={active ? 'page' : undefined}>
              <span className="onglet-rubrique__icone" aria-hidden="true">
                <Icone />
              </span>
              <span className={`onglet-rubrique__libelle${libelleVisible ? '' : ' sr-only'}`}>
                {active ? r.label : (presentation.libelleCourt ?? r.label)}
              </span>
            </Link>
          </Tooltip>
        );
      })}
    </nav>
  );
}
