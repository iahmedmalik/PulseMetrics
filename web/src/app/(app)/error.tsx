"use client";

// Next.js supplies retry to re-fetch and render this route after a temporary failure.
export default function PageError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <section className="hero" role="alert">
      <div>
        <h1>Could not load this page</h1>
        <p className="sub">The server may be waking up or the connection may have dropped. Try again in a moment.</p>
        <button className="btn primary" type="button" onClick={retry}>Try again</button>
      </div>
    </section>
  );
}
