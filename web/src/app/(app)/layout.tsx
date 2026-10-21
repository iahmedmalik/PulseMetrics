import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";

// Pages for signed-in owners. (Signed-out visitors are sent to /sign-in once sign-in is wired up.)
export default function AppLayout({ children }: { children: ReactNode }) {
  return <Shell>{children}</Shell>;
}
