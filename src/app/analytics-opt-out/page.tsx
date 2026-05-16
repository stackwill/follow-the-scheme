import Link from "next/link";

import { PlausibleOptOut } from "@/components/analytics/plausible-opt-out";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export default function AnalyticsOptOutPage() {
  return (
    <main className="page-shell learning-page">
      <nav className="app-topbar" aria-label="App navigation">
        <Link className="brand-mark" href="/">
          <span className="brand-spark" aria-hidden="true">
            <span />
            <span />
          </span>
          <strong>ihategcse</strong>
        </Link>
        <div className="app-topbar__actions">
          <span className="xp-chip">Internal analytics</span>
          <ThemeToggle />
        </div>
      </nav>

      <header className="course-hero">
        <div className="course-hero__icon" aria-hidden="true">
          AN
        </div>
        <div className="course-hero__copy">
          <div className="breadcrumb-line">
            <Link href="/">Home</Link>
            <span>/ Analytics opt-out</span>
          </div>
          <div className="course-title-row">
            <h1>Exclude this browser from analytics</h1>
            <span className="active-course-pill">internal</span>
          </div>
          <p className="page-description">
            Sets the Plausible local browser opt-out flag so Will testing does not count as real usage.
          </p>
        </div>
      </header>

      <PlausibleOptOut />
    </main>
  );
}
