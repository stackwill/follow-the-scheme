import "./styles/globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Script from "next/script";

import { UmamiScript } from "@/components/analytics/umami-script";

export const metadata: Metadata = {
  title: {
    default: "IHateGCSE",
    template: "%s | IHateGCSE",
  },
  applicationName: "IHateGCSE",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const umamiWebsiteId = process.env.UMAMI_WEBSITE_ID ?? "f7d3a380-c96b-40e0-84c2-a9bbca6c08af";
  const umamiHostUrl = process.env.UMAMI_HOST_URL ?? "https://cloud.umami.is";
  const umamiScriptSrc = process.env.UMAMI_SCRIPT_SRC ?? "/umami/script.js";

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Script id="theme-boot" strategy="beforeInteractive">
          {`
            try {
              var savedTheme = window.localStorage.getItem("followthescheme-theme");
              var theme = savedTheme === "dark" || savedTheme === "light"
                ? savedTheme
                : "light";
              document.documentElement.dataset.theme = theme;
            } catch (_) {}
          `}
        </Script>
        <UmamiScript hostUrl={umamiHostUrl} scriptSrc={umamiScriptSrc} websiteId={umamiWebsiteId} />
        {children}
      </body>
    </html>
  );
}
