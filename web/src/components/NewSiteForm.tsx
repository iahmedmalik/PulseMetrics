"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function NewSiteForm({ first = false }: { first?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = String(new FormData(form).get("name") ?? "").trim();
    if (!name) {
      setError("Give the site a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/backend/v1/sites", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
      if (res.ok) {
        form.reset();
        router.refresh();
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error?.replace(/^The request is not valid[^:]*: /, "") ?? "Could not create the site. Try again in a moment.");
    } catch {
      setError("Can't reach the server. It may be waking up: try again in a minute.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card new-site" onSubmit={onSubmit} noValidate>
      <h2>{first ? "Make your first site" : "Add a site"}</h2>
      <label>
        Name it
        <input name="name" placeholder="for example QueueCare" maxLength={60} autoComplete="off" />
      </label>
      <div role="alert">{error && <p className="note bad">{error}</p>}</div>
      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? "Creating…" : "Create site"}
      </button>
    </form>
  );
}
