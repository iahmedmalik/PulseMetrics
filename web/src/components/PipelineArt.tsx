// The Install page's own drawing: events travel from your app, through the API, into the database.
// Decoration only. With reduced motion the packets are hidden and the line sits still.
export function PipelineArt() {
  return (
    <svg className="art pipe" viewBox="0 0 520 150" aria-hidden="true">
      <path id="pipe-line" d="M60 75H460" stroke="var(--line)" strokeWidth="3" strokeDasharray="4 8" />
      <g fill="var(--card2)" stroke="var(--bar)" strokeWidth="2.5">
        <rect className="pop" x="10" y="40" width="100" height="70" rx="14" />
        <rect className="pop" style={{ animationDelay: ".2s" }} x="210" y="40" width="100" height="70" rx="14" />
        <rect className="pop" style={{ animationDelay: ".4s" }} x="410" y="40" width="100" height="70" rx="14" />
      </g>
      <g fill="var(--chalk)" fontSize="15" fontWeight="700" textAnchor="middle" fontFamily="var(--font-text)">
        <text x="60" y="80">Your app</text>
        <text x="260" y="80">API</text>
        <text x="460" y="80">Postgres</text>
      </g>
      {[0, 1, 2, 3].map((i) => (
        <circle key={i} className="packet" r="7" fill="var(--acc)">
          <animateMotion dur="3s" begin={`${i * 0.75}s`} repeatCount="indefinite">
            <mpath href="#pipe-line" />
          </animateMotion>
        </circle>
      ))}
    </svg>
  );
}
