import type { Metadata } from "next";
import { AbCalculator } from "@/components/AbCalculator";
import { BellArt } from "@/components/BellArt";

export const metadata: Metadata = { title: "A v B" };

export default function AbPage() {
  return (
    <section>
      <div className="hero">
        <div>
          <h1>A v B</h1>
          <p className="sub">Did the new version really win, or is it luck? Enter how many people saw each version and how many did the thing.</p>
        </div>
        <BellArt />
      </div>
      <AbCalculator />
    </section>
  );
}
