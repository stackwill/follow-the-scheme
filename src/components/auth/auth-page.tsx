import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

type AuthPageProps = {
  title: string;
  children: ReactNode;
  alternatePrompt: string;
  alternateHref: "/forgot-password" | "/login" | "/register" | "/reset-password";
  alternateLabel: string;
  legalAction: string;
  googleAction?: (formData: FormData) => Promise<void>;
};

function GoogleIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 48 48">
      <path
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        fill="#EA4335"
      />
      <path
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        fill="#4285F4"
      />
      <path
        d="M10.53 28.59A14.48 14.48 0 0 1 9.75 24c0-1.59.28-3.12.78-4.59l-7.98-6.19A23.86 23.86 0 0 0 0 24c0 3.86.92 7.5 2.55 10.78l7.98-6.19z"
        fill="#FBBC05"
      />
      <path
        d="M24 48c6.47 0 11.9-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        fill="#34A853"
      />
    </svg>
  );
}

function SocialButton({ label, icon }: { label: string; icon: ReactNode }) {
  return (
    <button className="template-auth__social-button" type="submit">
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function AuthPage({
  title,
  children,
  alternatePrompt,
  alternateHref,
  alternateLabel,
  legalAction,
  googleAction,
}: AuthPageProps) {
  return (
    <div className="template-auth">
      <header className="template-auth__header">
        <Link className="template-auth__logo" href="/">
          <span className="template-auth__logo-mark" aria-hidden="true" />
          <span>ihategcse</span>
        </Link>
        <Link className="template-auth__header-button" href={alternateHref as Route}>
          {alternateLabel}
        </Link>
      </header>

      <div className="template-auth__body">
        <main className="template-auth__main">
          <section className="template-auth__panel" aria-labelledby="auth-title">
            <div className="template-auth__heading">
              <h1 id="auth-title">{title}</h1>
            </div>

            {googleAction ? (
              <>
                <form action={googleAction} className="template-auth__providers" aria-label="Alternative sign in options">
                  <SocialButton icon={<GoogleIcon />} label="Continue with Google" />
                </form>

                <div className="template-auth__divider" aria-hidden="true">
                  <span />
                  <strong>or</strong>
                  <span />
                </div>
              </>
            ) : null}

            {children}
          </section>

          <div className="template-auth__switch">
            <span>{alternatePrompt}</span>
            <Link href={alternateHref as Route}>{alternateLabel}</Link>
          </div>

          <p className="template-auth__terms">
            By {legalAction}, I agree to the service <a href="#">terms</a>, <a href="#">privacy policy</a>, and{" "}
            <a href="#">cookie policy</a>.
          </p>
        </main>
      </div>

      <footer className="template-auth__footer">
        <Link href="/">Support</Link>
        <Link href="/">System status</Link>
        <Link href="/">Careers</Link>
        <a href="#">Terms of Use</a>
        <a href="#">Privacy Policy</a>
        <span>2026 ihategcse</span>
      </footer>
    </div>
  );
}
