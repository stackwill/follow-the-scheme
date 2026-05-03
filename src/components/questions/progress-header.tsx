import Link from "next/link";
import type { Route } from "next";

import { ThemeToggle } from "@/components/theme-toggle";

export function ProgressHeader(props: {
  paperTitle: string;
  paperHref: Route;
  current: number;
  total: number;
  previousHref: Route | null;
  nextHref: Route | null;
}) {
  const percentage = props.total === 0 ? 0 : Math.round((props.current / props.total) * 100);

  return (
    <header className="progress-header">
      <div className="progress-header__top">
        <Link className="subtle-link" href={props.paperHref}>
          Back to paper
        </Link>
        <div className="progress-header__actions">
          <div className="progress-header__nav" aria-label="Question navigation">
            {props.previousHref ? (
              <Link className="button-link button-link--secondary" href={props.previousHref}>
                Previous
              </Link>
            ) : null}
            {props.nextHref ? (
              <Link className="button-link button-link--secondary" href={props.nextHref}>
                Next
              </Link>
            ) : null}
          </div>
          <ThemeToggle />
        </div>
      </div>
      <div className="progress-header__title">
        <p className="eyebrow">{props.paperTitle}</p>
        <h1>
          Group {props.current} of {props.total}
        </h1>
      </div>
      <div className="progress-bar" aria-label={`${percentage}% through paper`}>
        <div style={{ width: `${percentage}%` }} />
      </div>
    </header>
  );
}
