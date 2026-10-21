// The "How it's built" page's drawing: three stacked layers sliding in, joined by a drawn line. Decoration only.
const LAYERS: [string, number, string][] = [
  ["Snippet", 20, "var(--acc)"],
  ["API and rules", 84, "var(--bar)"],
  ["Database", 148, "var(--trace)"],
];

export function BuildArt() {
  return (
    <svg className="art" viewBox="0 0 520 210" aria-hidden="true">
      {LAYERS.map(([text, y, color], i) => (
        <g key={text} className="pop" style={{ animationDelay: `${i * 0.35}s` }}>
          <rect x={60 + i * 30} y={y} width="320" height="48" rx="12" fill="var(--card2)" stroke={color} strokeWidth="3" />
          <text x={80 + i * 30} y={y + 30} fill="var(--chalk)" fontSize="15" fontWeight="700" fontFamily="var(--font-text)">
            {text}
          </text>
        </g>
      ))}
      <path className="draw" pathLength={1} style={{ animationDelay: "1.2s" }} d="M440 40C500 40 500 190 440 190" fill="none" stroke="var(--line)" strokeWidth="3" strokeDasharray="6 8" />
    </svg>
  );
}
