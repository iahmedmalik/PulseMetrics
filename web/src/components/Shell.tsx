import Link from "next/link";
import type { ReactNode } from "react";
import { MainNav, TabBar } from "./NavLinks";
import { SignOutButton } from "./SignOutButton";
import { FieldRings, LogoMark, PulseBackdrop } from "./PulseBackdrop";

// The frame around every page: header with the pulse line, content, footer, and the phone tab bar.
export function Shell({ children, signedIn = true, askOn = false }: { children: ReactNode; signedIn?: boolean; askOn?: boolean }) {
  return (
    <>
      <header className="shell-header">
        <PulseBackdrop />
        <Link href={signedIn ? "/" : "/sign-in"} className="logo">
          <LogoMark />
          PulseMetrics
        </Link>
        {signedIn && <MainNav askOn={askOn} />}
        <div className="header-actions">
          <Link href="/how-its-built" className="btn">
            How it&apos;s built
          </Link>
          {signedIn ? (
            <>
              <SignOutButton />
              <a href="/#new-site-name" className="btn header-new">
                New site
              </a>
            </>
          ) : (
            <Link href="/sign-in" className="btn primary">
              Sign in
            </Link>
          )}
        </div>
      </header>
      <main className="content">
        <FieldRings />
        {children}
        <p className="foot">
          <Link href="/privacy">Privacy</Link> · No cookies on your visitors. No page addresses stored.
        </p>
      </main>
      {signedIn && <TabBar />}
    </>
  );
}
