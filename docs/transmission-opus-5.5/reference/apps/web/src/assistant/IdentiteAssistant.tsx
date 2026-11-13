import { useId } from 'react';
const TRACES: Record<string, string> = {
  history: 'M3 11a9 9 0 1 0 3-6M3 3v6h6M12 7v5l3 2',
  plus: 'M12 5v14M5 12h14',
  expand: 'M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6',
  close: 'm6 6 12 12M6 18 18 6',
  layers: 'm3 8 9-5 9 5-9 5Zm0 5 9 5 9-5M3 18l9 5 9-5',
  chevron: 'm7 9 5 5 5-5',
  pin: 'm8 3 8 0-1 6 4 4v2H5v-2l4-4Zm4 12v7',
  send: 'm3 3 19 9-19 9 4-9Zm4 9h15',
  pause: 'M8 4v16M16 4v16',
  play: 'm7 4 14 8-14 8Z',
  file: 'M6 3h8l4 4v14H6Zm8 0v5h4M9 12h6M9 16h6',
  question: 'M8 8a4 4 0 0 1 8 0c0 3-4 3-4 6M12 18h.01',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  back: 'M19 12H5m5-5-5 5 5 5',
  check: 'm5 12 4 4L19 6',
  bell: 'M5 16h14l-2-3V9a5 5 0 0 0-10 0v4Zm5 4h4M12 2v2',
  action: 'm8 12 3 3 5-6M9 3h6l2 3h3v15H4V6h3Z',
  shield: 'm12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z',
};
export function IconeAssistant({ nom }: { nom: string }) {
  return (
    <svg
      className="as-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={TRACES[nom] || TRACES.file} />
    </svg>
  );
}
export function AvatarAssistant() {
  const id = useId();
  return (
    <span className="as-avatar" aria-hidden="true">
      <svg viewBox="0 0 96 96" fill="none" shapeRendering="geometricPrecision">
        <defs>
          <linearGradient id={`${id}-shell`} x1="20" y1="10" x2="75" y2="86" gradientUnits="userSpaceOnUse">
            <stop className="an-shell-start" />
            <stop offset=".52" className="an-shell-mid" />
            <stop offset="1" className="an-shell-end" />
          </linearGradient>
          <linearGradient id={`${id}-face`} x1="31" y1="28" x2="66" y2="68" gradientUnits="userSpaceOnUse">
            <stop className="an-face-start" />
            <stop offset="1" className="an-face-end" />
          </linearGradient>
        </defs>
        <g className="an-orbit" strokeWidth="1.6">
          <path opacity=".65" d="M12 27V16l9-8h16M59 8h16l9 8v11M84 69v11l-9 8H59M37 88H21l-9-8V69" />
          <circle cx="48" cy="48" r="41" strokeDasharray="2 11" opacity=".45" />
        </g>
        <path
          d="m48 12 28 11v24c0 16-13 29-28 37C33 76 20 63 20 47V23Z"
          fill={`url(#${id}-shell)`}
          className="an-shell"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        <path d="m48 17 23 9v11c-19-4-28 0-46 9V26Z" className="an-highlight" opacity=".12" />
        <path
          d="M35 31h26a7 7 0 0 1 7 7v14a7 7 0 0 1-7 7H45l-12 8V57a7 7 0 0 1-5-7V38a7 7 0 0 1 7-7Z"
          fill={`url(#${id}-face)`}
          className="an-face"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <g className="an-eyes">
          <rect x="37" y="40" width="5" height="8" rx="2.5" />
          <rect x="54" y="40" width="5" height="8" rx="2.5" />
        </g>
        <path d="M41 53c4 3 10 3 14 0" className="an-smile" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M48 22v3M25 45h-5M76 45h-5M48 76v-4"
          className="an-connector"
          strokeWidth="2"
          strokeLinecap="round"
          opacity=".8"
        />
        <circle cx="78" cy="18" r="5" className="an-signal" strokeWidth="2" />
      </svg>
    </span>
  );
}
