/* Pictogrammes de présentation, sans action ni état métier. */
const chemins = {
  niveaux: 'M12 3v9h9 M9 3.5a9 9 0 1 0 11.5 11.5',
  repartition: 'M4 19V9 M10 19V4 M16 19v-8 M22 19V6',
  applicabilite: 'M12 3 21 6v6c0 5-5 8-9 10-4-2-9-5-9-10V6Z M8 12l3 3 5-6',
  vigilance: 'M12 3 22 21H2Z M12 9v5 M12 17v1',
  document: 'M6 3h8l4 4v14H6Z M14 3v5h4 M9 12h6 M9 16h6',
  actions: 'M3 6h3 M10 6h11 M3 12h3 M10 12h11 M3 18h3 M10 18h11',
  ouvrir: 'M5 12h14 M13 6l6 6-6 6',
  liste: 'M6 5h14 M6 12h14 M6 19h14 M2 5h.1 M2 12h.1 M2 19h.1',
  reperes: 'M12 8v.1 M12 11v6 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
} as const;

export function IconeDda({ type }: { type: keyof typeof chemins }) {
  return (
    <svg className="dda-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={chemins[type]} />
    </svg>
  );
}
