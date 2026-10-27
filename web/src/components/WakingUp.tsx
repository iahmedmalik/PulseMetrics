"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FlipText } from "./FlipText";

// Shown while the API wakes up (the free plan puts it to sleep after 15 quiet minutes, and waking takes
// about a minute). It tries again by itself every few seconds, so nobody has to press anything.
export function WakingUp() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <section className="hero" aria-live="polite">
      <div>
        <FlipText text="Waking up" />
        <p className="sub">
          The server sleeps when nobody is using it and takes about a minute to wake. This page tries again by itself.
        </p>
      </div>
      <svg className="art" viewBox="0 0 520 160" aria-hidden="true">
        <path d="M10 100H180l14-60 22 110 18-80 12 30H510" fill="none" stroke="var(--line)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path className="draw" pathLength={1} d="M10 100H180l14-60 22 110 18-80 12 30H510" fill="none" stroke="var(--trace)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </section>
  );
}
