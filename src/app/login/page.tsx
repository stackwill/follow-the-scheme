import { cookies } from "next/headers";
import { headers } from "next/headers";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { authCookieOptions, AUTH_COOKIE_NAME } from "@/lib/auth/session";
import { createNodeSessionToken } from "@/lib/auth/session-node";
import { isPasswordConfigured, verifyPassword } from "@/lib/auth/password";
import { clearFailedLogins, loginRetryAfterSeconds, recordFailedLogin } from "@/lib/auth/login-rate-limit";

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

function clientRateLimitKey(headerList: Headers) {
  const forwardedFor = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = headerList.get("x-real-ip")?.trim();

  return forwardedFor || realIp || "local";
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const authReady = isPasswordConfigured();

  async function signIn(formData: FormData) {
    "use server";

    const school = String(formData.get("school") ?? "");
    const nextPath = safeNextPath(String(formData.get("next") ?? ""));
    const headerList = await headers();
    const rateLimitKey = clientRateLimitKey(headerList);
    const retryAfterSeconds = loginRetryAfterSeconds(rateLimitKey);

    if (!isPasswordConfigured()) {
      redirect(`/login?error=${encodeURIComponent("Access is not configured.")}`);
    }

    if (retryAfterSeconds > 0) {
      redirect(
        `/login?error=${encodeURIComponent(`Too many tries. Wait ${retryAfterSeconds} seconds before trying again.`)}&next=${encodeURIComponent(nextPath)}`,
      );
    }

    if (!verifyPassword(school)) {
      const lockoutSeconds = recordFailedLogin(rateLimitKey);
      const message =
        lockoutSeconds > 0
          ? `Too many tries. Wait ${lockoutSeconds} seconds before trying again.`
          : "That school was not recognised.";

      redirect(`/login?error=${encodeURIComponent(message)}&next=${encodeURIComponent(nextPath)}`);
    }

    const sessionSecret = process.env.AUTH_SESSION_SECRET;

    if (!sessionSecret) {
      redirect(`/login?error=${encodeURIComponent("Access is not configured.")}`);
    }

    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, createNodeSessionToken(sessionSecret), authCookieOptions());
    clearFailedLogins(rateLimitKey);

    redirect(nextPath as Route);
  }

  return (
    <main className="login-shell">
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-panel__mark" aria-hidden="true">
          FTS
        </div>
        <div className="login-panel__copy">
          <p className="eyebrow">reallycool.lol</p>
          <h1 id="login-title">What school are you?</h1>
          <p>Answer with the school name to continue.</p>
        </div>
        <form action={signIn} className="login-form">
          <input type="hidden" name="next" value={safeNextPath(params.next)} />
          <label className="field-stack">
            <span>School</span>
            <input
              autoComplete="organization"
              autoFocus
              disabled={!authReady}
              name="school"
              required
              type="text"
            />
          </label>
          {params.error ? (
            <p className="form-error" role="alert">
              {params.error}
            </p>
          ) : null}
          {!authReady ? (
            <p className="form-error" role="alert">
              Set AUTH_SESSION_SECRET in the environment before using the app.
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
