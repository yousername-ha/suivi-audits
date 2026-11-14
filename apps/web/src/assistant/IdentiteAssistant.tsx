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
      <svg viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={id} x1="10" y1="5" x2="55" y2="62" gradientUnits="userSpaceOnUse">
            <stop className="as-avatar-stop-a" />
            <stop offset=".52" className="as-avatar-stop-b" />
            <stop offset="1" className="as-avatar-stop-c" />
          </linearGradient>
        </defs>
        <circle className="as-avatar-orbit" cx="32" cy="32" r="30" />
        <path
          className="as-avatar-shell"
          d="M32 6 53 15v18c0 12-10 21-21 26C21 54 11 45 11 33V15Z"
          fill={`url(#${id})`}
        />
        <path className="as-avatar-highlight" d="m32 9 18 8v9c-15-2-24 3-36 9V17Z" />
        <path
          className="as-avatar-bubble"
          d="M23 22h18a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H29l-8 5v-7a5 5 0 0 1-3-5v-8a5 5 0 0 1 5-5Z"
        />
        <g className="as-avatar-eyes">
          <rect x="25" y="28" width="3" height="5" rx="1.5" />
          <rect x="36" y="28" width="3" height="5" rx="1.5" />
        </g>
        <path className="as-avatar-smile" d="M28 37c2 2 6 2 8 0" />
        <circle className="as-avatar-signal" cx="52" cy="13" r="4" />
      </svg>
    </span>
  );
}
