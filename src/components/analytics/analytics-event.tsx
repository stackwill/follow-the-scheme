"use client";

import { useEffect } from "react";

import { trackAnalyticsEvent } from "@/lib/analytics/umami";

type AnalyticsEventProps = {
  name: string;
  props?: Record<string, boolean | number | string | null | undefined>;
};

export function AnalyticsEvent(props: AnalyticsEventProps) {
  const serializedProps = JSON.stringify(props.props ?? {});

  useEffect(() => {
    const eventProps = JSON.parse(serializedProps) as AnalyticsEventProps["props"];

    trackAnalyticsEvent(props.name, eventProps);
  }, [props.name, serializedProps]);

  return null;
}
