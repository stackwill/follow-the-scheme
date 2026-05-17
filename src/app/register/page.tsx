import { AuthPage } from "@/components/auth/auth-page";
import { authRedirectUrl, requestOrigin, safeNextPath } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Route } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

type RegisterPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
    next?: string;
  }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && !params.error) {
    redirect(next as Route);
  }

  async function register(formData: FormData) {
    "use server";

    const name = String(formData.get("name") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const nextPath = safeNextPath(String(formData.get("next") ?? ""));
    const requestHeaders = await headers();
    const origin = requestOrigin(requestHeaders);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
        },
        emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });

    if (error) {
      redirect(authRedirectUrl("/register", { next: nextPath, error: error.message }) as Route);
    }

    if (data.session) {
      redirect(nextPath as Route);
    }

    redirect(
      authRedirectUrl("/login", {
        next: nextPath,
        message: "Check your email to confirm your account. If this email already has an account, use password reset instead.",
      }) as Route,
    );
  }

  async function registerWithGoogle() {
    "use server";

    const requestHeaders = await headers();
    const origin = requestOrigin(requestHeaders);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error || !data.url) {
      redirect(
        authRedirectUrl("/register", { next, error: error?.message ?? "Google login is not configured yet" }) as Route,
      );
    }

    redirect(data.url as Route);
  }

  return (
    <AuthPage
      alternateHref="/login"
      alternateLabel="Log in"
      alternatePrompt="Already have an account?"
      googleAction={registerWithGoogle}
      legalAction="signing up"
      title="Create your account"
    >
      <form action={register} className="auth-form">
        <input name="next" type="hidden" value={next} />
        {params.error ? <p className="auth-notice auth-notice--error">{params.error}</p> : null}
        {params.message ? <p className="auth-notice auth-notice--success">{params.message}</p> : null}
        <label className="auth-field">
          <span>Name</span>
          <input autoComplete="name" autoFocus name="name" placeholder="Your name" required type="text" />
        </label>
        <label className="auth-field">
          <span>Email</span>
          <input autoComplete="email" name="email" placeholder="you@example.com" required type="email" />
        </label>
        <label className="auth-field">
          <span>Password</span>
          <input
            autoComplete="new-password"
            minLength={6}
            name="password"
            placeholder="Choose a password"
            required
            type="password"
          />
        </label>
        <button type="submit">Create account</button>
      </form>
    </AuthPage>
  );
}
