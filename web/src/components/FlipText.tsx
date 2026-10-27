import type { ElementType, ReactNode } from "react";

// A heading whose words flip down into place one after another, like tiles on a scoreboard. The full text
// stays in the page for screen readers and the animated copy is hidden from them, so it is read once. It is
// pure CSS: the words show even if scripts fail, and reduced motion turns the flip into a plain fade.
export function FlipText({ as: Tag = "h1", text, children }: { as?: ElementType; text: string; children?: ReactNode }) {
  const words = text.split(" ");
  return (
    <Tag className="flip">
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {words.map((word, i) => (
          <span key={i}>
            {i > 0 ? " " : null}
            <span className="fw" style={{ ["--i" as string]: i }}>
              {word}
            </span>
          </span>
        ))}
      </span>
      {children}
    </Tag>
  );
}
