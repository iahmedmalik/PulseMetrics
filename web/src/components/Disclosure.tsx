"use client";

import { useId, useState, type ReactNode } from "react";

// A button that opens and closes a panel. The panel grows and fades with the shared motion, both ways,
// and while it is closed it is hidden from keyboards and screen readers too.
export function Disclosure({ openLabel, closedLabel, children }: { openLabel: string; closedLabel: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div>
      <button type="button" className="link-btn plain" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)}>
        {open ? openLabel : closedLabel}
      </button>
      <div className="collapse" data-open={open} id={id}>
        <div inert={!open}>{children}</div>
      </div>
    </div>
  );
}
