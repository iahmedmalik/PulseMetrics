import type { ReactNode } from "react";

// One drawn icon set, one stroke weight (2) and round caps, used by the phone tab bar.
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const icons: Record<string, ReactNode> = {
  sites: (
    <svg {...base}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  innings: (
    <svg {...base}>
      <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
    </svg>
  ),
  funnel: (
    <svg {...base}>
      <path d="M3 4h18l-7 9v6l-4 2v-8z" />
    </svg>
  ),
  ab: (
    <svg {...base}>
      <path d="M4 18c3-12 6-12 8 0s5 12 8-12" />
    </svg>
  ),
  more: (
    <svg {...base}>
      <path d="M5 12h.01M12 12h.01M19 12h.01" />
    </svg>
  ),
  check: (
    <svg {...base}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ),
};
