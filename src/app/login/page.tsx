import Link from "next/link";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
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
    <main className="page-shell learning-page login-page">
      <nav className="app-topbar" aria-label="App navigation">
        <Link className="brand-mark" href="/">
          <span className="brand-spark" aria-hidden="true">
            <span />
            <span />
          </span>
          <strong>ihategcse</strong>
        </Link>
        <div className="app-topbar__actions">
          <span className="xp-chip">Private beta</span>
          <ThemeToggle />
        </div>
      </nav>

      <header className="course-hero login-hero">
        <div className="course-hero__icon" aria-hidden="true">
          😡
        </div>
        <div className="course-hero__copy">
          <div className="breadcrumb-line">
            <Link href="/">Home</Link>
            <span>/ Sign in</span>
          </div>
          <div className="course-title-row">
            <h1 id="login-title">Open your GCSE workspace</h1>
            <span className="active-course-pill">ihategcse</span>
          </div>
          <p className="page-description">
            Sign in to open your past-paper workspace.
          </p>
        </div>
        <aside className="study-callout login-access-card" aria-labelledby="login-title">
          <strong>School access</strong>
          <span>Use the school name you were given for ihategcse.</span>
          <form action={signIn} className="login-form">
            <input type="hidden" name="next" value={safeNextPath(params.next)} />
            <label className="field-stack login-field">
              <span>School name</span>
              <input
                autoComplete="organization"
                autoFocus
                disabled={!authReady}
                name="school"
                placeholder="Type your school"
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
        </aside>
      </header>
    </main>
  );
}
