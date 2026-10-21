// The Funnel page's own drawing: a channel that narrows, with a few drops falling out. Decoration only.
export function FunnelArt() {
  return (
    <svg className="art" viewBox="0 0 520 200" aria-hidden="true">
      <path className="channel" d="M30 40L190 40C250 40 250 70 310 70L490 70L490 130L310 130C250 130 250 160 190 160L30 160Z" />
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} className="drop" cx={215 + i * 20} cy="150" r="5" style={{ animationDelay: `${i * 0.4}s` }} />
      ))}
      <g className="pop" style={{ animationDelay: ".4s" }}>
        <circle cx="30" cy="100" r="9" fill="var(--acc)" stroke="#fff" strokeWidth="2" />
      </g>
      <g className="pop" style={{ animationDelay: "1s" }}>
        <path d="M490 100V60" stroke="var(--acc-t)" strokeWidth="3" strokeLinecap="round" />
        <path d="M490 62h26l-7 8 7 8h-26z" fill="var(--acc)" />
      </g>
    </svg>
  );
}
