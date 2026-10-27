import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Shell } from "@/components/Shell";
import { WakingUp } from "@/components/WakingUp";
import { askIsOn, getMe } from "@/lib/api";

// Pages for signed-in owners. Nobody signed in goes to /sign-in. If the API is asleep we say so and
// keep trying, instead of showing an error.
export default async function AppLayout({ children }: { children: ReactNode }) {
  let me;
  try {
    me = await getMe();
  } catch {
    return (
      <Shell>
        <WakingUp />
      </Shell>
    );
  }
  if (!me) redirect("/sign-in");
  return <Shell askOn={await askIsOn()}>{children}</Shell>;
}
