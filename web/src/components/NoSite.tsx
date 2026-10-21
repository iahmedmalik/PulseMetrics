import Link from "next/link";
import { OvalArt } from "./art";

// Shown by the pages that need a site (Innings, Funnel, Install, Ask) when the owner has none yet.
export function NoSite({ title }: { title: string }) {
  return (
    <section>
      <div className="hero">
        <div>
          <h1>{title}</h1>
          <p className="sub">Make a site first. It takes a name and a click, and gives you the snippet to paste.</p>
          <p style={{ marginTop: 18 }}>
            <Link href="/" className="btn primary">
              Make a site
            </Link>
          </p>
        </div>
        <OvalArt sites={[]} />
      </div>
    </section>
  );
}
