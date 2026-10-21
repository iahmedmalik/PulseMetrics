"use client";

import { useState } from "react";

// A block of code with a Copy button. If copying is refused (an insecure address, for example) the text
// stays selectable and the button says so, instead of pretending it worked.
export function CopyBlock({ code, label }: { code: string; label: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setState("copied");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <div className="copy-block">
      <pre className="snippet" tabIndex={0} aria-label={label}>
        {code}
      </pre>
      <button type="button" className="btn small" onClick={copy}>
        {state === "copied" ? "Copied" : state === "failed" ? "Select and copy" : "Copy"}
      </button>
      <span className="sr-only" aria-live="polite">
        {state === "copied" ? `${label} copied` : ""}
      </span>
    </div>
  );
}
