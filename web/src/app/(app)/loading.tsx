// Shown in the page area while a dashboard page fetches its numbers (the header stays put). It fades in
// only after a moment, so a fast page never flashes it; a slow or waking API gets a visible answer to the click.
export default function Loading() {
  return (
    <div className="page-loading" role="status">
      <svg viewBox="0 0 120 28" aria-hidden="true">
        <path className="draw" pathLength={1} d="M4 22L24 14L42 18L62 8L82 14L100 6L116 10" fill="none" stroke="var(--trace)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Fetching the numbers…</span>
    </div>
  );
}
