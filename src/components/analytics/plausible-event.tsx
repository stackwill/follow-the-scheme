"use client";

import { useEffect } from "react";

import { trackPlausibleEvent } from "@/lib/analytics/plausible";

type PlausibleEventProps = {
  name: string;
  props?: Record<string, boolean | number | string | null | undefined>;
};

export function PlausibleEvent(props: PlausibleEventProps) {
  const serializedProps = JSON.stringify(props.props ?? {});

  useEffect(() => {
    const eventProps = JSON.parse(serializedProps) as PlausibleEventProps["props"];

    trackPlausibleEvent(props.name, eventProps);
  }, [props.name, serializedProps]);

  return null;
}
