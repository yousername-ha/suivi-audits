/* Pictogrammes d'illustration des sources de risque (003-09). Dessins propres au projet (aucune bibliothèque tierce, donc
   aucune licence à suivre), tracés en contour avec la couleur du texte. Purement décoratifs : toujours accompagnés d'un
   libellé écrit, jamais seul porteur d'information, et sans effet sur le classement de la source. */
import type { ReactNode } from 'react';
import { FAMILLES, type FamilleSource } from './modele';

const TRACES: Record<FamilleSource, ReactNode> = {
  malveillant: (
    <>
      <path d="M12 3c-4 0-7 3-7 7v3h14v-3c0-4-3-7-7-7Z" />
      <path d="M5 13c0 4 3 8 7 8s7-4 7-8" />
      <path d="M9 11h2M13 11h2" />
    </>
  ),
  criminel: (
    <>
      <path d="M4 8c3-2 13-2 16 0v4c0 4-3 8-8 8s-8-4-8-8V8Z" />
      <path d="M7.5 11.5h3M13.5 11.5h3" />
      <path d="M9 16c2 1 4 1 6 0" />
    </>
  ),
  etatique: (
    <>
      <path d="M3 10 12 4l9 6" />
      <path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />
    </>
  ),
  interne: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c0-4 3-6.5 6.5-6.5s6.5 2.5 6.5 6.5" />
      <path d="M19 6v5M19 14.2v.3" />
    </>
  ),
  accident: (
    <>
      <path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-9Z" />
    </>
  ),
  naturel: (
    <>
      <path d="M7 17a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8.5a4 4 0 0 1 .5 8.5" />
      <path d="m12 11-2 4h3l-2 4" />
    </>
  ),
  autre: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M9.7 9.5a2.4 2.4 0 1 1 3.5 2.1c-.8.5-1.2 1-1.2 1.9M12 16.8v.3" />
    </>
  ),
};

export const libelleFamille = (f: FamilleSource) => FAMILLES.find((x) => x.id === f)?.libelle ?? '';

/** Pictogramme seul, masqué pour les lecteurs d'écran (le libellé écrit est toujours à côté). */
export function PictoSource({ famille, taille = 24 }: { famille: FamilleSource; taille?: number }) {
  return (
    <svg
      className="ebios-picto"
      width={taille}
      height={taille}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {TRACES[famille]}
    </svg>
  );
}

/** Légende des pictogrammes : famille, dessin, rappel qu'il est indicatif. */
export function LegendePictos() {
  return (
    <ul className="ebios-legende-pictos" aria-label="Légende des pictogrammes de sources">
      {FAMILLES.map((f) => (
        <li key={f.id}>
          <PictoSource famille={f.id} taille={20} /> {f.libelle}
        </li>
      ))}
    </ul>
  );
}
