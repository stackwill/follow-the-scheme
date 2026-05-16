"use client";

type AnalyticsProps = Record<string, boolean | number | string | null | undefined>;

declare global {
  interface Window {
    umami?: {
      track: (eventName: string, props?: AnalyticsProps) => void;
    };
  }
}

export function trackAnalyticsEvent(eventName: string, props?: AnalyticsProps) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (window.localStorage.getItem("umami.disabled") === "1") {
      return;
    }
  } catch {
    return;
  }

  window.umami?.track(eventName, props);
}
