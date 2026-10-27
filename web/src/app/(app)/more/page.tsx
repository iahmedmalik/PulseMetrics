import type { Metadata } from "next";
import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import { FlipText } from "@/components/FlipText";
import { askIsOn } from "@/lib/api";

export const metadata: Metadata = { title: "More" };

// On a phone the bottom bar has room for five places, so the rest live here.
export default async function MorePage() {
  const askOn = await askIsOn();
  return (
    <section>
      <FlipText text="More" />
      <ul className="more-list">
        <li>
          <Link href="/install">Install the snippet</Link>
          <span>One script tag, then one line per event</span>
        </li>
        <li>
          <Link href="/ask">
            Ask your data{!askOn && <> <small className="soon">Soon</small></>}
          </Link>
          <span>Questions in plain words</span>
        </li>
        <li>
          <Link href="/how-its-built">How it&apos;s built</Link>
          <span>The story, the stack and the tests</span>
        </li>
        <li>
          <Link href="/privacy">Privacy</Link>
          <span>What is and is not collected</span>
        </li>
      </ul>
      <SignOutButton className="btn" />
    </section>
  );
}
