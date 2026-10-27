import type { ReactNode } from "react";
import { PageTransition } from "@/components/PageTransition";

// Recreated on every navigation between dashboard pages, so each change of page plays the transition.
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
