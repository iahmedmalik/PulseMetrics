import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { OvalArt } from "@/components/art";
import { getMe } from "@/lib/api";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  // Already signed in: nothing to do here. (If the API is asleep we just show the form.)
  if (await getMe().catch(() => null)) redirect("/");

  return (
    <section className="hero">
      <div>
        <h1>Sign in</h1>
        <p className="sub">See how your apps are doing. Only you see your sites.</p>
        <div className="auth-wrap">
          <AuthForm mode="sign-in" />
        </div>
      </div>
      <OvalArt sites={[]} />
    </section>
  );
}
