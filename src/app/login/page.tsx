import { cookies } from "next/headers";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { authCookieOptions, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { createNodeSessionToken } from "@/lib/auth/session-node";
import { isPasswordConfigured, verifyPassword } from "@/lib/auth/password";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
    next?: string;
  }>;
};

function safeNextPath(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }

  return value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const authReady = isPasswordConfigured();

  async function signIn(formData: FormData) {
    "use server";

    const password = String(formData.get("password") ?? "");
    const nextPath = safeNextPath(String(formData.get("next") ?? ""));

    if (!isPasswordConfigured()) {
      redirect(`/login?error=${encodeURIComponent("Password auth is not configured.")}`);
    }

    if (!verifyPassword(password)) {
      redirect(`/login?error=${encodeURIComponent("Incorrect password.")}&next=${encodeURIComponent(nextPath)}`);
    }

    const sessionSecret = process.env.AUTH_SESSION_SECRET;

    if (!sessionSecret) {
      redirect(`/login?error=${encodeURIComponent("Password auth is not configured.")}`);
    }

    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, createNodeSessionToken(sessionSecret), authCookieOptions());

    redirect(nextPath as Route);
  }

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel__mark" aria-hidden="true">
          FTS
        </div>
        <div className="login-panel__copy">
          <p className="eyebrow">Follow the Scheme</p>
          <h1 id="login-title">Enter password</h1>
          <p>Access is limited to people Will has shared the password with.</p>
        </div>
        <form action={signIn} className="login-form">
          <input type="hidden" name="next" value={safeNextPath(params.next)} />
          <label className="field-stack">
            <span>Password</span>
            <input
              autoComplete="current-password"
              autoFocus
              disabled={!authReady}
              name="password"
              required
              type="password"
            />
          </label>
          {params.error ? (
            <p className="form-error" role="alert">
              {params.error}
            </p>
          ) : null}
          {!authReady ? (
            <p className="form-error" role="alert">
              Set AUTH_PASSWORD and AUTH_SESSION_SECRET in the environment before using the app.
            </p>
          ) : null}
          <button disabled={!authReady} type="submit">
            Continue
          </button>
        </form>
      </section>
    </main>
  );
}
