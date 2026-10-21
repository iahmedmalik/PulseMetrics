import Link from "next/link";

const RANGES = [7, 14, 30] as const;

function hrefQuery(keep: Record<string, string | undefined>, range: number): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(keep)) if (v) q.set(k, v);
  q.set("range", String(range));
  return q.toString();
}

// 7, 14 or 30 days. Plain links, so the chosen range is in the address and survives a reload.
export function RangeTabs({ current, basePath, keep = {} }: { current: number; basePath: string; keep?: Record<string, string | undefined> }) {
  return (
    <nav className="tabs" aria-label="Range">
      {RANGES.map((r) => (
        <Link key={r} href={`${basePath}?${hrefQuery(keep, r)}`} aria-current={r === current ? "page" : undefined} replace>
          {r} days
        </Link>
      ))}
    </nav>
  );
}

export function parseRange(value: string | string[] | undefined, fallback = 14): 7 | 14 | 30 {
  const n = Number(Array.isArray(value) ? value[0] : value);
  return (RANGES as readonly number[]).includes(n) ? (n as 7 | 14 | 30) : (fallback as 14);
}
