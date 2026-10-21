import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";
import { getMe } from "@/lib/api";

// Pages anyone can open: sign-in, privacy, how it is built. A signed-in owner still gets the full navigation
// around them, so reading these pages never feels like being signed out.
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const signedIn = Boolean(await getMe().catch(() => null));
  return <Shell signedIn={signedIn}>{children}</Shell>;
}
