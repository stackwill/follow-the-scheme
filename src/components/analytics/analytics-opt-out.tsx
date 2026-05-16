"use client";

import { useEffect, useState } from "react";

const UMAMI_DISABLED_KEY = "umami.disabled";

export function AnalyticsOptOut() {
  const [excluded, setExcluded] = useState(false);

  useEffect(() => {
    try {
      setExcluded(window.localStorage.getItem(UMAMI_DISABLED_KEY) === "1");
    } catch {
      setExcluded(false);
    }
  }, []);

  function excludeVisits() {
    window.localStorage.setItem(UMAMI_DISABLED_KEY, "1");
    setExcluded(true);
  }

  function includeVisits() {
    window.localStorage.removeItem(UMAMI_DISABLED_KEY);
    setExcluded(false);
  }

  return (
    <div className="paper-choice-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Umami Analytics</p>
          <h2>{excluded ? "This browser is excluded" : "This browser is counted"}</h2>
        </div>
      </div>
      <p className="page-description">
        This only affects this browser and device. Use it on Will&apos;s laptop, phone, and any other browser used for testing.
      </p>
      <div className="hero-actions">
        <button className="button-link" disabled={excluded} onClick={excludeVisits} type="button">
          Exclude my visits
        </button>
        <button className="button-link button-link--secondary" disabled={!excluded} onClick={includeVisits} type="button">
          Count this browser again
        </button>
      </div>
    </div>
  );
}
