import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";

// Pages anyone can open: sign-in, privacy, how it is built.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <Shell signedIn={false}>{children}</Shell>;
}
