"use client";

type PlausibleProps = Record<string, boolean | number | string | null | undefined>;

declare global {
  interface Window {
    plausible?: (eventName: string, options?: { props?: PlausibleProps }) => void;
  }
}

export function trackPlausibleEvent(eventName: string, props?: PlausibleProps) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (window.localStorage.getItem("plausible_ignore") === "true") {
      return;
    }
  } catch {
    return;
  }

  window.plausible?.(eventName, props ? { props } : undefined);
}
