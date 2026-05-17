import { AuthPage } from "@/components/auth/auth-page";
import { authRedirectUrl, requestOrigin } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Route } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

type ForgotPasswordPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
  }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;

  async function requestPasswordReset(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "").trim();
    const requestHeaders = await headers();
    const origin = requestOrigin(requestHeaders);
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
    });

    if (error) {
      redirect(authRedirectUrl("/forgot-password", { error: error.message }) as Route);
    }

    redirect(
      authRedirectUrl("/forgot-password", {
        message: "Check your email for a password reset link.",
      }) as Route,
    );
  }

  return (
    <AuthPage
      alternateHref="/login"
      alternateLabel="Log in"
      alternatePrompt="Remembered it?"
      legalAction="continuing"
      title="Reset your password"
    >
      <form action={requestPasswordReset} className="auth-form">
        {params.error ? <p className="auth-notice auth-notice--error">{params.error}</p> : null}
        {params.message ? <p className="auth-notice auth-notice--success">{params.message}</p> : null}
        <p className="auth-help-text">
          Enter the email for your account and we&apos;ll send you a link to choose a new password.
        </p>
        <label className="auth-field">
          <span>Email</span>
          <input autoComplete="email" autoFocus name="email" placeholder="you@example.com" required type="email" />
        </label>
        <button type="submit">Send reset link</button>
      </form>
    </AuthPage>
  );
}
