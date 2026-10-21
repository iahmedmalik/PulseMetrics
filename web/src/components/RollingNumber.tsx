// A scoreboard number: each digit rolls up from zero to its place, one after another.
// It is pure CSS (no script), the final number is the real text for screen readers, and with reduced
// motion the digits simply appear in place.
export function RollingNumber({ value, className = "" }: { value: number | string; className?: string }) {
  const text = typeof value === "number" ? value.toLocaleString("en") : value;
  let digitIndex = 0;
  return (
    <span className={`roll num ${className}`}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="roll-digits">
        {[...text].map((ch, i) => {
          if (!/\d/.test(ch)) return <span key={i}>{ch}</span>;
          const n = Number(ch);
          const delay = 60 + digitIndex++ * 70;
          return (
            <span key={i} className="dg">
              <i style={{ transform: `translateY(${-n}em)`, animationDelay: `${delay}ms` }}>
                {Array.from({ length: 10 }, (_, d) => (
                  <b key={d}>{d}</b>
                ))}
              </i>
            </span>
          );
        })}
      </span>
    </span>
  );
}
