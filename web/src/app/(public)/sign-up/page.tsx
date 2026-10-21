import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { OvalArt } from "@/components/art";
import { getMe } from "@/lib/api";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage() {
  if (await getMe().catch(() => null)) redirect("/");

  return (
    <section className="hero">
      <div>
        <h1>Create an account</h1>
        <p className="sub">One account, as many sites as you like. No cookies on your visitors, ever.</p>
        <div className="auth-wrap">
          <AuthForm mode="sign-up" />
        </div>
      </div>
      <OvalArt sites={[]} />
    </section>
  );
}
