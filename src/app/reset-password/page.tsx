import { AuthPage } from "@/components/auth/auth-page";
import { authRedirectUrl } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Route } from "next";
import { redirect } from "next/navigation";

type ResetPasswordPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      authRedirectUrl("/forgot-password", {
        error: "Open the latest password reset link from your email first.",
      }) as Route,
    );
  }

  async function updatePassword(formData: FormData) {
    "use server";

    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (password !== confirmPassword) {
      redirect(authRedirectUrl("/reset-password", { error: "Passwords do not match." }) as Route);
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      redirect(authRedirectUrl("/reset-password", { error: error.message }) as Route);
    }

    await supabase.auth.signOut();
    redirect(
      authRedirectUrl("/login", {
        message: "Password updated. Log in with your new password.",
      }) as Route,
    );
  }

  return (
    <AuthPage
      alternateHref="/login"
      alternateLabel="Log in"
      alternatePrompt="Already reset?"
      legalAction="continuing"
      title="Choose a new password"
    >
      <form action={updatePassword} className="auth-form">
        {params.error ? <p className="auth-notice auth-notice--error">{params.error}</p> : null}
        <label className="auth-field">
          <span>New password</span>
          <input
            autoComplete="new-password"
            autoFocus
            minLength={6}
            name="password"
            placeholder="New password"
            required
            type="password"
          />
        </label>
        <label className="auth-field">
          <span>Confirm password</span>
          <input
            autoComplete="new-password"
            minLength={6}
            name="confirmPassword"
            placeholder="Repeat new password"
            required
            type="password"
          />
        </label>
        <button type="submit">Update password</button>
      </form>
    </AuthPage>
  );
}
