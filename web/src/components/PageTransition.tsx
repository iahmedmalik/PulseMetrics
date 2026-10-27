import { ViewTransition } from "react";
import type { ReactNode } from "react";

// Wraps one page so moving between pages lets the old page leave quickly and the new one fade and rise in,
// while the header and the phone tab bar stay still (they have their own fixed view-transition names).
// It is used from each route group's template.tsx: a template is created fresh on every navigation inside
// its group, so enter and exit run; a layout persists, so they never would.
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div className="page">{children}</div>
    </ViewTransition>
  );
}
