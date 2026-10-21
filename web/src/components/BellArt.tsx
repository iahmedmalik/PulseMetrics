// The A/B page's own drawing: a bell curve drawn in, with a ball at the top. Decoration only.
export function BellArt() {
  return (
    <svg className="art" viewBox="0 0 520 170" aria-hidden="true">
      <path d="M10 150C120 150 170 20 260 20S400 150 510 150" fill="none" stroke="var(--line)" strokeWidth="3" />
      <path className="draw" pathLength={1} d="M10 150C120 150 170 20 260 20S400 150 510 150" fill="none" stroke="var(--chalk)" strokeWidth="3" />
      <path className="draw" pathLength={1} d="M10 150C120 150 170 20 260 20" fill="none" stroke="var(--trace)" strokeWidth="4.5" style={{ animationDelay: ".5s" }} />
      <path className="draw" pathLength={1} d="M10 150L510 150" stroke="var(--line)" strokeWidth="2" />
      <g className="pop" style={{ animationDelay: "1.6s" }}>
        <circle cx="260" cy="20" r="9" fill="var(--acc)" stroke="#fff" strokeWidth="2" />
      </g>
    </svg>
  );
}
