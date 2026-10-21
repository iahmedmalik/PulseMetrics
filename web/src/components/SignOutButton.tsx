"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignOutButton({ className = "btn" }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function signOut() {
    setBusy(true);
    try {
      await fetch("/backend/v1/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    } finally {
      router.push("/sign-in");
      router.refresh();
    }
  }

  return (
    <button type="button" className={className} onClick={signOut} disabled={busy}>
      Sign out
    </button>
  );
}
