import type { ReactNode } from "react";

// A template (unlike a layout) is created fresh on every navigation, so each page rises in the same way.
export default function Template({ children }: { children: ReactNode }) {
  return <div className="page">{children}</div>;
}
