import { AuthPage } from "@/components/auth/auth-page";
import { authRedirectUrl, requestOrigin, safeNextPath } from "@/lib/auth/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Route } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    message?: string;
    next?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && !params.error) {
    redirect(next as Route);
  }

  async function login(formData: FormData) {
    "use server";

    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const nextPath = safeNextPath(String(formData.get("next") ?? ""));
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      redirect(authRedirectUrl("/login", { next: nextPath, error: error.message }) as Route);
    }

    redirect(nextPath as Route);
  }

  async function loginWithGoogle() {
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
      redirect(authRedirectUrl("/login", { next, error: error?.message ?? "Google login is not configured yet" }) as Route);
    }

    redirect(data.url as Route);
  }

  return (
    <AuthPage
      alternateHref="/register"
      alternateLabel="Sign up"
      alternatePrompt="Don't have an account?"
      googleAction={loginWithGoogle}
      legalAction="continuing"
      title="Log in to your account"
    >
      <form action={login} className="auth-form">
        <input name="next" type="hidden" value={next} />
        {params.error ? <p className="auth-notice auth-notice--error">{params.error}</p> : null}
        {params.message ? <p className="auth-notice auth-notice--success">{params.message}</p> : null}
        <label className="auth-field">
          <span>Email</span>
          <input autoComplete="email" autoFocus name="email" placeholder="you@example.com" required type="email" />
        </label>
        <label className="auth-field">
          <span>
            Password
            <a href="/forgot-password">Forgot password?</a>
          </span>
          <input autoComplete="current-password" name="password" placeholder="Your password" required type="password" />
        </label>
        <button type="submit">Log in</button>
      </form>
    </AuthPage>
  );
}
