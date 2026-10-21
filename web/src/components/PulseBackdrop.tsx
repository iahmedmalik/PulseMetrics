// The header's pulse line: a quiet base line with one bright segment that runs along it.
const D = "M0 40H300l14-26 18 48 14-34 10 12H700l14-26 18 48 14-34 10 12H1200";

export function PulseBackdrop() {
  return (
    <svg className="pulse-bg" viewBox="0 0 1200 66" preserveAspectRatio="none" aria-hidden="true">
      <path className="base" d={D} />
      <path d={D} />
    </svg>
  );
}

// Faint field rings behind every page's heading: they draw themselves in once.
export function FieldRings() {
  return (
    <svg className="field-rings" viewBox="0 0 1180 520" aria-hidden="true">
      <ellipse pathLength="1" cx="590" cy="260" rx="580" ry="250" />
      <ellipse pathLength="1" cx="590" cy="260" rx="470" ry="200" style={{ animationDelay: ".2s" }} />
      <ellipse pathLength="1" cx="590" cy="260" rx="360" ry="150" style={{ animationDelay: ".4s" }} />
    </svg>
  );
}

export function LogoMark() {
  return (
    <svg viewBox="0 0 36 22" aria-hidden="true">
      <path d="M0 12h9l3-10 6 19 4-13 2 4h12" fill="none" stroke="var(--acc)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
