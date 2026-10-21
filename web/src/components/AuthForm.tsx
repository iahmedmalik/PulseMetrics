"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type Mode = "sign-in" | "sign-up";

const MIN_PASSWORD = 10;

// The message names the problem and what to do about it.
function messageFor(status: number): string {
  if (status === 401) return "That email and password don't match. Check them and try again.";
  if (status === 400) return `Use a password of at least ${MIN_PASSWORD} characters, and a real email address.`;
  if (status === 422 || status === 409) return "There is already an account with that email. Sign in instead.";
  if (status === 403) return "That request was blocked. Reload the page and try again.";
  if (status === 429) return "Too many tries. Wait a minute and try again.";
  return "Something went wrong on our side. Try again in a moment.";
}

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signIn = mode === "sign-in";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const name = String(form.get("name") ?? "").trim() || email.split("@")[0] || "Owner";

    if (!signIn && password.length < MIN_PASSWORD) {
      setError(messageFor(400));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/backend/v1/auth/${signIn ? "sign-in" : "sign-up"}/email`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(signIn ? { email, password } : { name, email, password }),
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
        return;
      }
      setError(messageFor(res.status));
    } catch {
      setError("Can't reach the server. It may be waking up: try again in a minute.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card auth-form" onSubmit={onSubmit} noValidate>
      {!signIn && (
        <label>
          Your name
          <input name="name" autoComplete="name" required />
        </label>
      )}
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete={signIn ? "current-password" : "new-password"} required minLength={signIn ? undefined : MIN_PASSWORD} />
      </label>
      {!signIn && <p className="hint">At least {MIN_PASSWORD} characters.</p>}
      <div role="alert">{error && <p className="note bad">{error}</p>}</div>
      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? "One moment…" : signIn ? "Sign in" : "Create account"}
      </button>
      <p className="hint">
        {signIn ? (
          <>
            New here? <Link href="/sign-up">Create an account</Link>
          </>
        ) : (
          <>
            Already have an account? <Link href="/sign-in">Sign in</Link>
          </>
        )}
      </p>
    </form>
  );
}
