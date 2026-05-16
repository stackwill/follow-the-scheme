"use client";

import { useEffect } from "react";

type UmamiScriptProps = {
  hostUrl: string;
  scriptSrc: string;
  websiteId: string;
};

export function UmamiScript(props: UmamiScriptProps) {
  useEffect(() => {
    if (document.querySelector("script[data-ihategcse-umami='true']")) {
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.dataset.hostUrl = props.hostUrl;
    script.dataset.ihategcseUmami = "true";
    script.dataset.websiteId = props.websiteId;
    script.defer = true;
    script.src = props.scriptSrc;
    document.head.append(script);
  }, [props.hostUrl, props.scriptSrc, props.websiteId]);

  return null;
}
