import type { ReactNode } from 'react';
const ICONS: Record<string, ReactNode> = {
  tree: (
    <>
      <rect x="9" y="2" width="6" height="5" rx="1" />
      <path d="M12 7v5M5 17v-5h14v5" />
      <rect x="2" y="17" width="6" height="5" rx="1" />
      <rect x="16" y="17" width="6" height="5" rx="1" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </>
  ),
  list: <path d="M7 6h14M7 12h14M7 18h14M3 6h.01M3 12h.01M3 18h.01" />,
  search: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="m15 15 6 6" />
    </>
  ),
  filter: <path d="M4 6h16M7 12h10M10 18h4" />,
  pause: <path d="M8 4v16M16 4v16" />,
  play: <path d="m7 4 14 8-14 8z" />,
  user: (
    <>
      <circle cx="12" cy="7" r="4" />
      <path d="M4 22v-3a8 8 0 0 1 16 0v3" />
    </>
  ),
  cycle: <path d="M3 10a9 9 0 0 1 16-5M21 14a9 9 0 0 1-16 5M19 1v5h-5M5 23v-5h5" />,
};
export function ProcessusIcone({ name }: { name: string }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name] ?? ICONS.tree}
    </svg>
  );
}
