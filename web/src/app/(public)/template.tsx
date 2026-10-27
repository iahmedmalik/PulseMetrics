import type { ReactNode } from "react";
import { PageTransition } from "@/components/PageTransition";

// Recreated on every navigation between the public pages (sign in, sign up, privacy, how it's built).
export default function Template({ children }: { children: ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
