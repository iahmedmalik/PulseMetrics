const NEVER = ["page address", "query string", "token", "name", "phone number", "email address", "health data", "IP address"];
const STORED = ["event name", "random browser id", "time of the event"];

// What the snippet never collects (each one is struck through as it appears), and the three things it does.
export function NeverStored({ heading = true }: { heading?: boolean }) {
  return (
    <div className="never-stored">
      {heading && <h2>Never stored</h2>}
      <ul className="chips never" aria-label="Never stored">
        {NEVER.map((n, i) => (
          <li key={n} style={{ ["--i" as string]: i }}>
            {n}
          </li>
        ))}
      </ul>
      <h2 className="stored-h">Stored</h2>
      <ul className="chips ok" aria-label="Stored">
        {STORED.map((n) => (
          <li key={n}>{n}</li>
        ))}
      </ul>
    </div>
  );
}
