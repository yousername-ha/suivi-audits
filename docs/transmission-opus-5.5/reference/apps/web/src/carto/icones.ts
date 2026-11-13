/* Icônes des objets de la carte (traits simples, 24 × 24), reprises de la bêta. Décrites en données : aucune
   balise injectée, aucun style. */
export type ElementIcone =
  | { t: 'path'; d: string }
  | { t: 'circle'; cx: number; cy: number; r: number }
  | { t: 'rect'; x: number; y: number; width: number; height: number; rx?: number };

export const ICONES_CARTE: Record<string, ElementIcone[]> = {
  shield: [
    { t: 'path', d: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z' },
    { t: 'path', d: 'M9 12l2 2 4-4' },
  ],
  building: [
    { t: 'path', d: 'M4 21V8l8-5 8 5v13' },
    { t: 'path', d: 'M9 21v-5h6v5M8 10.5h.01M12 10.5h.01M16 10.5h.01M8 13.5h.01M12 13.5h.01M16 13.5h.01' },
  ],
  gear: [
    { t: 'circle', cx: 12, cy: 12, r: 3.2 },
    {
      t: 'path',
      d: 'M12 2.5v3M12 18.5v3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M2.5 12h3M18.5 12h3M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1',
    },
  ],
  doc: [
    { t: 'path', d: 'M6 3h9l4 4v14H6z' },
    { t: 'path', d: 'M15 3v4h4M9 12h7M9 16h5' },
  ],
  users: [
    { t: 'circle', cx: 9, cy: 8, r: 3 },
    { t: 'path', d: 'M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6' },
    { t: 'circle', cx: 17, cy: 9, r: 2.4 },
    { t: 'path', d: 'M15.6 14.1c3 .2 5.4 2.6 5.4 5.9' },
  ],
  alert: [
    { t: 'path', d: 'M12 4l9 16H3z' },
    { t: 'path', d: 'M12 10v4M12 17v.5' },
  ],
  target: [
    { t: 'circle', cx: 12, cy: 12, r: 8 },
    { t: 'circle', cx: 12, cy: 12, r: 4 },
    { t: 'path', d: 'M12 12h.01' },
  ],
  app: [
    { t: 'rect', x: 3, y: 4, width: 18, height: 12, rx: 2 },
    { t: 'path', d: 'M8 20h8M12 16v4' },
  ],
  server: [
    { t: 'rect', x: 4, y: 4, width: 16, height: 7, rx: 1.5 },
    { t: 'rect', x: 4, y: 13, width: 16, height: 7, rx: 1.5 },
    { t: 'path', d: 'M8 7.5h.01M8 16.5h.01' },
  ],
  pin: [
    { t: 'path', d: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z' },
    { t: 'circle', cx: 12, cy: 10, r: 2.5 },
  ],
  box: [
    { t: 'path', d: 'M12 3l8 4.5v9L12 21l-8-4.5v-9z' },
    { t: 'path', d: 'M4 7.5l8 4.5 8-4.5M12 12v9' },
  ],
  cloud: [{ t: 'path', d: 'M7 18h10a4 4 0 0 0 .6-8A6 6 0 0 0 6 9.6 4.2 4.2 0 0 0 7 18z' }],
  ghost: [
    { t: 'circle', cx: 12, cy: 12, r: 9 },
    { t: 'path', d: 'M8.5 8.5l7 7M15.5 8.5l-7 7' },
  ],
  headset: [
    { t: 'path', d: 'M4 14v-2a8 8 0 0 1 16 0v2' },
    { t: 'rect', x: 3, y: 14, width: 4, height: 6, rx: 1.5 },
    { t: 'rect', x: 17, y: 14, width: 4, height: 6, rx: 1.5 },
  ],
  cap: [
    { t: 'path', d: 'M2 9l10-5 10 5-10 5z' },
    { t: 'path', d: 'M6 11v5c3 2 9 2 12 0v-5' },
  ],
  chat: [{ t: 'path', d: 'M4 5h16v11H9l-5 4z' }],
  cart: [
    { t: 'circle', cx: 9, cy: 20, r: 1.5 },
    { t: 'circle', cx: 18, cy: 20, r: 1.5 },
    { t: 'path', d: 'M2 3h3l2.5 12h12L22 7H6.2' },
  ],
  compass: [
    { t: 'circle', cx: 12, cy: 12, r: 9 },
    { t: 'path', d: 'M15.5 8.5l-2 5-5 2 2-5z' },
  ],
  cycle: [
    { t: 'path', d: 'M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3' },
    { t: 'path', d: 'M18 3v4h-4M6 21v-4h4' },
  ],
  tools: [
    { t: 'path', d: 'M14.5 6.5a4 4 0 0 0 5 5l-8 8a2.1 2.1 0 0 1-3-3z' },
    { t: 'path', d: 'M4 4l5 5M3 7l4-4' },
  ],
  layers: [
    { t: 'path', d: 'M12 3l9 5-9 5-9-5z' },
    { t: 'path', d: 'M3 13l9 5 9-5' },
  ],
  globe: [
    { t: 'circle', cx: 12, cy: 12, r: 9 },
    { t: 'path', d: 'M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18' },
  ],
  frame: [{ t: 'path', d: 'M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4' }],
};
