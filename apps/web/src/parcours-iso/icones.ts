/* Pictogrammes du parcours ISO / HDS (tracés de la maquette v011, repris tels quels). */
export const ICONES_PARCOURS: Record<string, string> = {
  shield: 'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z M8 12l3 3 5-6',
  context: 'M12 3v18 M3 12h18 M18 6a8.5 8.5 0 1 1-12 0',
  govern:
    'M8 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M16 11a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5 M2 21v-3a6 6 0 0 1 12 0v3 M16 14a5 5 0 0 1 6 5v2',
  support: 'M4 8h16v13H4Z M8 8V4h8v4 M4 13h16 M10 12v3h4v-3',
  risk: 'M12 3 2 21h20Z M12 9v5 M12 17v1',
  objectives: 'M21 12a9 9 0 1 1-9-9 M17 12a5 5 0 1 1-5-5 M12 12l9-9 M16 3h5v5',
  treatment: 'M5 3h11l3 3v15H5Z M8 9h8 M8 13h8 M8 17h5',
  operate: 'M4 4h6v6H4Z M14 4h6v6h-6Z M4 14h6v6H4Z M14 14h6v6h-6Z',
  audit: 'M8 5H5v16h14V5h-3 M8 3h8v4H8Z M8 14l3 3 5-6',
  measure: 'M4 20V10h4v10 M10 20V4h4v16 M16 20v-7h4v7',
  review: 'M4 4h16v13H9l-5 4Z M8 8h8 M8 12h5',
  improve: 'M20 8A8 8 0 1 0 20 16 M20 3v5h-5 M8 12l3 3 5-6',
  hds: 'M4 4h16v6H4Z M4 14h16v6H4Z M7 7h1 M7 17h1',
  home: 'M3 11 12 3l9 8 M5 10v11h5v-7h4v7h5V10',
  map: 'M3 5l6-2 6 3 6-2v16l-6 2-6-3-6 2Z M9 3v16 M15 6v16',
  tree: 'M12 3v6 M5 15V9h14v6 M2 16h6v5H2Z M9 1h6v4H9Z M16 16h6v5h-6Z',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2',
  handshake: 'M2 9l5-5 5 2 5-2 5 5-7 10-4-1-7-7 M7 4l-5 5 3 4 M12 6l-4 4 3 2 3-3 5 5 M8 14l4 4 M11 12l5 5',
};
export const iconeParcours = (id: string) => ICONES_PARCOURS[id] ?? ICONES_PARCOURS.hds!;
