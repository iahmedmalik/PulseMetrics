import type { Metadata } from "next";
import { AbCalculator } from "@/components/AbCalculator";
import { BellArt } from "@/components/BellArt";
import { FlipText } from "@/components/FlipText";

export const metadata: Metadata = { title: "A v B" };

export default function AbPage() {
  return (
    <section>
      <div className="hero">
        <div>
          <FlipText text="A v B" />
          <p className="sub">Did the new version really win, or is it luck? Enter how many people saw each version and how many did the thing.</p>
        </div>
        <BellArt />
      </div>
      <AbCalculator />
    </section>
  );
}
