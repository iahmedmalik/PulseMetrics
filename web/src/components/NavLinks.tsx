"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { icons } from "./icons";

const NAV = [
  { href: "/", label: "Sites" },
  { href: "/innings", label: "Innings" },
  { href: "/funnel", label: "Funnel" },
  { href: "/ab", label: "A v B" },
  { href: "/install", label: "Install" },
  { href: "/ask", label: "Ask" },
] as const;

// On a phone the same destinations sit in a bottom bar, with the rest behind "More".
const TABS = [
  { href: "/", label: "Sites", icon: "sites" },
  { href: "/innings", label: "Innings", icon: "innings" },
  { href: "/funnel", label: "Funnel", icon: "funnel" },
  { href: "/ab", label: "A v B", icon: "ab" },
  { href: "/more", label: "More", icon: "more" },
] as const;

// "More" also stands for the pages that have no tab of their own.
const MORE_PAGES = ["/more", "/install", "/ask", "/privacy", "/how-its-built"];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/more") return MORE_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MainNav() {
  const pathname = usePathname();
  return (
    <nav className="main-nav" aria-label="Main">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} aria-current={isActive(pathname, n.href) ? "page" : undefined}>
          {n.label}
        </Link>
      ))}
    </nav>
  );
}

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="tab-bar" aria-label="Main">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={isActive(pathname, t.href) ? "page" : undefined}>
          {icons[t.icon]}
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
